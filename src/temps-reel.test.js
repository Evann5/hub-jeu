// Le hub en temps réel, sans navigateur : un vrai serveur sur une base jetable et des connexions Socket.IO pilotées à la main.
// Chaque test rejoue un défaut corrigé (voir docs/decisions.md, 12/11/2026).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { lancerServeur, inscrire, Client, jusque, pause, RACINE, MDP } from '../tests/aide-serveur.mjs';

let srv;
let n = 0;
const pseudo = (p = 'zz') => `${p}${Date.now().toString(36).slice(-4)}${(n++).toString(36)}`;
const ouverts = [];
const connecter = async (compte) => { const c = await new Client(srv, compte).ouvrir(); ouverts.push(c); return c; };

before(async () => { srv = await lancerServeur(); });
after(async () => { ouverts.forEach((c) => c.fermer()); await srv.arreter(); });

test('historique puis envoi dans la même rafale : la réponse à l’historique part avant la diffusion du message', async () => {
  const a = await connecter(await inscrire(srv, pseudo()));
  for (let i = 0; i < 4; i++) {
    const texte = `rafale ${i} ${pseudo('')}`;
    const debut = a.recus.length;
    // Les deux demandes partent d'un seul trait, comme à l'ouverture d'une conversation suivie d'un envoi immédiat.
    const hist = a.envoyer('history', { scope: 'c:1' });
    const envoi = a.envoyer('send', { scope: 'c:1', body: texte });
    await jusque(() => a.recus.some((r) => r.ack === envoi), 'accusé de l’envoi');
    const recus = a.recus.slice(debut);
    const iHist = recus.findIndex((r) => r.ack === hist);
    const iMsg = recus.findIndex((r) => r.ev === 'message' && r.data.body === texte);
    assert.ok(iHist >= 0 && iMsg >= 0, 'historique et message reçus');
    assert.ok(!recus[iHist].data.messages.some((m) => m.body === texte), 'l’historique a été lu avant le message');
    assert.ok(iHist < iMsg, `essai ${i} : le message a été diffusé avant la réponse à l’historique (le navigateur le perdrait)`);
    await pause(1100); // 5 messages par 5 s au plus
  }
});

test('table:kick : seulement une personne assise, et la liste des exclus ne grossit pas avec des identifiants inventés', async () => {
  const hote = await connecter(await inscrire(srv, pseudo()));
  const invite = await inscrire(srv, pseudo());
  const joueur = await connecter(invite);
  const { id } = await hote.appel('table:create', { game: 'morpion' });
  for (let i = 0; i < 8; i++) {
    const r = await hote.appel('table:kick', { id, userId: 900000 + i });
    assert.equal(r.ok, false, 'un identifiant qui n’est pas assis est refusé');
  }
  assert.equal((await joueur.appel('table:join', { id })).ok, true);
  assert.equal((await hote.appel('table:kick', { id, userId: invite.id })).ok, true);
  assert.equal((await hote.appel('table:kick', { id, userId: invite.id })).ok, false, 'déjà retiré : refusé');
  await jusque(() => hote.dernier('tables')?.find((t) => t.id === id)?.kicked.length === 1, 'la liste des exclus contient une seule personne');
  assert.deepEqual(hote.dernier('tables').find((t) => t.id === id).kicked, [invite.id]);
  assert.equal((await joueur.appel('table:join', { id })).ok, false, 'la personne retirée ne peut pas revenir');
});

test('chat d’une partie : un joueur éliminé (silent) ne peut ni écrire ni réagir tant que la partie dure', async () => {
  // Une partie de Loups-garous avec un mort, préparée dans une base à part puis chargée au démarrage.
  const s2 = await lancerServeur();
  try {
    const comptes = [];
    for (let i = 0; i < 5; i++) comptes.push(await inscrire(s2, pseudo('lg')));
    await s2.couper();
    const rules = await import('../games/loup-garou/rules.js');
    const meta = JSON.parse(readFileSync(join(RACINE, 'games', 'loup-garou', 'game.json'), 'utf8'));
    const options = Object.fromEntries(meta.options.map((o) => [o.key, o.default]));
    const state = rules.setup(comptes.map(({ id, pseudo: p }) => ({ id, pseudo: p })), options, { now: Date.now(), random: Math.random });
    const mort = comptes[0];
    const vivant = comptes[1];
    state.dead.push({ id: mort.id, role: state.roles[mort.id], cause: 'vote', n: 1 });
    assert.ok(rules.status(state).silent.includes(mort.id), 'le jeu déclare bien le mort « silent » (sinon ce test ne prouve rien)');
    const db = new DatabaseSync(join(s2.dir, 'hubuno.sqlite'));
    const now = Date.now();
    const tableId = Number(db.prepare("INSERT INTO game_tables (game, host_id, status, seats, options, state, created_at, updated_at) VALUES ('loup-garou', ?, 'playing', ?, ?, ?, ?, ?)")
      .run(vivant.id, JSON.stringify(comptes.map((c) => c.id)), JSON.stringify(options), JSON.stringify(state), now, now).lastInsertRowid);
    db.close();
    await s2.demarrer();
    const cv = await new Client(s2, vivant).ouvrir();
    const cm = await new Client(s2, mort).ouvrir();
    try {
      const scope = `t:${tableId}`;
      const envoi = await cv.appel('send', { scope, body: 'Qui est le loup ?' });
      assert.equal(envoi.ok, true, `un vivant écrit dans le chat de la partie (${envoi.error})`);
      assert.equal((await cm.appel('send', { scope, body: 'C’est Léa' })).ok, false, 'le mort ne peut pas écrire');
      const reaction = await cm.appel('react', { messageId: envoi.message.id, emoji: '👍' });
      assert.equal(reaction.ok, false, 'le mort ne peut pas réagir non plus');
      assert.equal((await cv.appel('react', { messageId: envoi.message.id, emoji: '👍' })).ok, true, 'un vivant réagit');
    } finally {
      cv.fermer();
      cm.fermer();
    }
  } finally {
    await s2.arreter();
  }
});

test('présence : un deuxième onglet du même compte ne rediffuse rien, le départ du dernier onglet si', async () => {
  const temoin = await connecter(await inscrire(srv, pseudo()));
  const compte = await inscrire(srv, pseudo());
  const presences = () => temoin.recus.filter((r) => r.ev === 'presence').length;
  const o1 = await new Client(srv, compte).ouvrir();
  await jusque(() => temoin.dernier('presence')?.includes(compte.id), 'le témoin voit le compte en ligne');
  const avant = presences();
  const o2 = await new Client(srv, compte).ouvrir();
  o2.fermer();
  await pause(300);
  assert.equal(presences(), avant, 'ouvrir puis fermer un deuxième onglet ne diffuse aucune présence');
  o1.fermer();
  await jusque(() => !temoin.dernier('presence').includes(compte.id), 'le témoin voit le compte hors ligne');
  assert.equal(presences(), avant + 1);
});

test('sessions : 10 par compte au plus, la plus récente reste valable', async () => {
  const compte = await inscrire(srv, pseudo());
  let cookie = null;
  for (let i = 0; i < 13; i++) {
    const r = await fetch(`${srv.url}api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pseudo: compte.pseudo, password: MDP }) });
    assert.equal(r.status, 200);
    cookie = r.headers.get('set-cookie').split(';')[0];
  }
  const db = new DatabaseSync(join(srv.dir, 'hubuno.sqlite'), { readOnly: true });
  const { n: total } = db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(compte.id);
  db.close();
  assert.equal(total, 10);
  assert.equal((await fetch(`${srv.url}api/me`, { headers: { cookie } })).status, 200, 'la dernière connexion marche');
  assert.equal((await fetch(`${srv.url}api/me`, { headers: { cookie: compte.cookie } })).status, 401, 'la plus ancienne session a été retirée');
});
