// Le hub en temps réel, sans navigateur : un vrai serveur sur une base jetable et des connexions Socket.IO pilotées à la main.
// Chaque test rejoue un défaut corrigé (voir docs/decisions.md, 12/11/2026).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { lancerServeur, inscrire, entrer, Client, jusque, pause, RACINE, MDP, CODE, CODE_ADMIN, ADMIN } from '../tests/aide-serveur.mjs';

let srv;
let n = 0;
const pseudo = (p = 'zz') => `${p}${Date.now().toString(36).slice(-4)}${(n++).toString(36)}`;
const ouverts = [];
// Le résumé d'une partie tel que ce client le connaît : la liste reçue à la connexion, puis les mises à jour une par une.
function resume(c, id) {
  let t = c.dernier('state')?.tables.find((x) => x.id === id) ?? null;
  for (const r of c.recus) {
    if (r.ev !== 'tables:update') continue;
    if (r.data.removed === id) t = null;
    else if (r.data.table?.id === id) t = r.data.table;
  }
  return t;
}
const connecter = async (compte) => { const c = await new Client(srv, compte).ouvrir(); ouverts.push(c); return c; };

before(async () => { srv = await lancerServeur(); });
// Le compte admin du serveur commun : créé au premier appel, retrouvé ensuite.
const compteAdmin = () => inscrire(srv, ADMIN, { admin: true }).catch(() => entrer(srv, ADMIN));
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
  await jusque(() => resume(hote, id)?.kicked.length === 1, 'la liste des exclus contient une seule personne');
  assert.deepEqual(resume(hote, id).kicked, [invite.id]);
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

test('hôte absent : dans un salon, la main passe à un joueur en ligne ; après la partie, un joueur resté peut lancer la revanche', async () => {
  const s3 = await lancerServeur({ env: { HOST_AWAY_MS: '600' } });
  try {
    const hote = await inscrire(s3, pseudo());
    const autre = await inscrire(s3, pseudo());
    const ch = await new Client(s3, hote).ouvrir();
    const ca = await new Client(s3, autre).ouvrir();
    try {
      const table = (id) => resume(ca, id);
      // 1. Salon : l'hôte ferme son onglet, l'autre joueur attend.
      const { id } = await ch.appel('table:create', { game: 'morpion' });
      await ca.appel('table:watch', { id });
      assert.equal((await ca.appel('table:join', { id })).ok, true);
      assert.equal((await ca.appel('table:start', { id })).ok, false, 'tant que l’hôte est là, lui seul lance');
      ch.fermer();
      await jusque(() => table(id)?.hostId === autre.id, 'la main est passée au joueur en ligne', 5000);
      assert.deepEqual(table(id).seats, [hote.id, autre.id], 'l’ancien hôte garde sa place');
      assert.equal((await ca.appel('table:start', { id })).ok, true, 'le nouvel hôte lance la partie');
      // 2. Fin de partie : l'ancien hôte, revenu, abandonne puis repart ; l'autre lance la revanche.
      const ch2 = await new Client(s3, hote).ouvrir();
      assert.equal((await ch2.appel('table:leave', { id })).ok, true);
      await jusque(() => table(id)?.status === 'over', 'la partie est terminée');
      ch2.fermer();
      assert.equal((await ca.appel('table:restart', { id })).ok, true, 'un joueur resté lance la revanche');
      await jusque(() => table(id)?.status === 'lobby', 'retour au salon');
      assert.deepEqual(table(id).seats, [autre.id], 'celui qui a abandonné n’est pas rassis');
      // 3. L'hôte perd sa connexion à l'instant de la revanche : il garde la main ; elle ne passe qu'après le délai, comme dans un salon.
      const ch3 = await new Client(s3, hote).ouvrir();
      const { id: id3 } = await ch3.appel('table:create', { game: 'morpion' });
      await ca.appel('table:join', { id: id3 });
      await ch3.appel('table:start', { id: id3 });
      assert.equal((await ca.appel('table:leave', { id: id3 })).ok, true); // la partie est finie, l'hôte a gagné
      await jusque(() => table(id3)?.status === 'over', 'partie terminée');
      ch3.fermer();
      assert.equal((await ca.appel('table:restart', { id: id3 })).ok, true);
      await jusque(() => table(id3)?.status === 'lobby', 'retour au salon');
      assert.equal(table(id3).hostId, hote.id, 'une coupure de quelques instants ne coûte pas la main à l’hôte');
      await jusque(() => table(id3)?.hostId === autre.id, 'après le délai, la main passe au joueur en ligne', 5000);
    } finally {
      ch.fermer();
      ca.fermer();
    }
  } finally {
    await s3.arreter();
  }
});

test('revanche : refusée à un spectateur, ouverte à tous les joueurs de la partie ; si l’hôte a abandonné, celui qui relance devient l’hôte', async () => {
  const a = await inscrire(srv, pseudo());
  const b = await inscrire(srv, pseudo());
  const ca = await connecter(a);
  const cb = await connecter(b);
  const cs = await connecter(await inscrire(srv, pseudo()));
  const { id } = await ca.appel('table:create', { game: 'morpion' });
  await cb.appel('table:join', { id });
  await ca.appel('table:start', { id });
  assert.equal((await cb.appel('table:leave', { id })).ok, true); // b abandonne : la partie est finie
  assert.equal((await cs.appel('table:restart', { id })).ok, false, 'un spectateur ne relance pas');
  assert.equal((await cb.appel('table:restart', { id })).ok, true, 'un joueur qui n’est pas l’hôte relance, même après avoir abandonné');
  const salon = () => resume(ca, id);
  await jusque(() => salon()?.status === 'lobby', 'retour au salon');
  assert.equal(salon().hostId, a.id, 'l’hôte, toujours là, reste l’hôte');
  assert.deepEqual(salon().seats, [a.id, b.id]);
  // L'hôte abandonne : l'autre joueur, resté jusqu'au bout, relance et devient l'hôte.
  const { id: id2 } = await ca.appel('table:create', { game: 'morpion' });
  await cb.appel('table:join', { id: id2 });
  await ca.appel('table:start', { id: id2 });
  assert.equal((await ca.appel('table:leave', { id: id2 })).ok, true);
  assert.equal((await cb.appel('table:restart', { id: id2 })).ok, true, 'le joueur resté relance');
  const vue = () => resume(cb, id2);
  await jusque(() => vue()?.status === 'lobby' && vue().hostId === b.id, 'retour au salon, le joueur resté est l’hôte');
  assert.deepEqual(vue().seats, [b.id]);
});

test('liste des parties : seule la partie qui change est envoyée à la classe, et rien quand un spectateur entre ou sort', async () => {
  const a = await connecter(await inscrire(srv, pseudo()));
  const b = await connecter(await inscrire(srv, pseudo()));
  const spectateur = await connecter(await inscrire(srv, pseudo()));
  const temoin = await connecter(await inscrire(srv, pseudo())); // un élève sur un autre écran : il ne regarde aucune partie
  const { id } = await a.appel('table:create', { game: 'morpion' });
  await b.appel('table:join', { id });
  await a.appel('table:start', { id });
  await jusque(() => resume(temoin, id)?.status === 'playing', 'le témoin voit la partie en cours');
  const recus = () => temoin.recus.filter((r) => r.ev === 'tables:update' || r.ev === 'tables');
  // Des spectateurs entrent et sortent : rien ne change pour la classe.
  let avant = recus().length;
  for (let i = 0; i < 10; i++) { await spectateur.appel('table:watch', { id }); await spectateur.appel('table:unwatch', { id }); }
  await pause(200);
  assert.equal(recus().length, avant, 'aucun envoi à la classe pour un spectateur qui entre ou sort');
  // Trois coups : trois petits envois, chacun avec cette seule partie.
  avant = recus().length;
  const joueurs = { [a.compte.id]: a, [b.compte.id]: b };
  for (let coup = 0; coup < 3; coup++) {
    const tour = resume(temoin, id).turn[0];
    assert.equal((await joueurs[tour].appel('table:move', { id, action: { cell: coup } })).ok, true);
    await jusque(() => resume(temoin, id).turn[0] !== tour, 'le tour a changé chez le témoin');
  }
  const envois = recus().slice(avant);
  assert.equal(envois.length, 3);
  assert.ok(envois.every((r) => r.ev === 'tables:update' && r.data.table.id === id), 'la liste complète n’est jamais renvoyée');
  // La partie fermée disparaît chez le témoin, et le spectateur qui la regardait est prévenu.
  await spectateur.appel('table:watch', { id });
  assert.equal((await a.appel('table:close', { id })).ok, true);
  await jusque(() => resume(temoin, id) === null, 'la partie a disparu de la liste du témoin');
  await jusque(() => spectateur.recus.some((r) => r.ev === 'table:closed' && r.data.id === id), 'le spectateur est prévenu de la fermeture');
});

test('trop de connexions pour un compte : la plus ancienne cède la place (un wifi qui saute ne laisse personne dehors)', async () => {
  const compte = await inscrire(srv, pseudo());
  // Cinq onglets, puis le wifi saute : le serveur les croit encore ouverts.
  const morts = [];
  for (let i = 0; i < 5; i++) morts.push(await new Client(srv, compte).ouvrir());
  morts.forEach((c) => c.devenirSourd());
  const revenus = [];
  for (let i = 0; i < 3; i++) revenus.push(await new Client(srv, compte).ouvrir()); // avant : « trop-de-connexions » dès le premier
  // Six vrais onglets : le plus ancien encore ouvert est prévenu puis fermé, il ne se reconnecte pas tout seul.
  for (let i = 0; i < 2; i++) revenus.push(await new Client(srv, compte).ouvrir());
  const sixieme = await new Client(srv, compte).ouvrir();
  await jusque(() => revenus[0].recus.some((r) => r.ev === 'replaced'), 'le plus ancien onglet est prévenu');
  await jusque(() => revenus[0].ws.readyState === 3, 'et sa connexion est fermée');
  assert.equal(revenus[1].recus.some((r) => r.ev === 'replaced'), false, 'les autres onglets restent');
  [...morts, ...revenus, sixieme].forEach((c) => c.fermer());
});

test('coup trop profond : refusé avant les règles, sans erreur dans le journal du serveur', async () => {
  const a = await connecter(await inscrire(srv, pseudo()));
  const b = await connecter(await inscrire(srv, pseudo()));
  const { id } = await a.appel('table:create', { game: 'quatre' });
  await b.appel('table:join', { id });
  await a.appel('table:start', { id });
  let profond = 1;
  for (let i = 0; i < 3000; i++) profond = [profond];
  for (const c of [a, b]) { // l'un des deux a la main
    const r = await c.appel('table:move', { id, action: { col: profond } });
    assert.equal(r.ok, false);
    assert.doesNotMatch(r.error, /a rencontré une erreur/, 'le coup ne doit pas atteindre les règles du jeu');
  }
  assert.doesNotMatch(srv.journal, /RangeError|Maximum call stack/);
});

test('inscription : les pseudos qui imitent l’équipe sont réservés', async () => {
  const essayer = (p) => fetch(`${srv.url}api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ classCode: CODE, pseudo: p, password: MDP, acceptRules: true }) });
  for (const p of ['admin', 'Adm1n', 'MODO', 'moderateur', 'hubuno']) {
    const r = await essayer(p);
    assert.equal(r.status, 409, `« ${p} » doit être refusé`);
    assert.match((await r.json()).error, /réservé/);
  }
  assert.equal((await essayer(pseudo('admirable'))).status, 201, 'un pseudo qui commence comme « admin » reste libre');
});

test('mot de passe provisoire : valable 24 heures, refusé ensuite', async () => {
  const admin = await connecter(await compteAdmin());
  const eleve = await inscrire(srv, pseudo());
  const { tempPassword } = await admin.appel('admin:resetPassword', { userId: eleve.id });
  const entrer = () => fetch(`${srv.url}api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pseudo: eleve.pseudo, password: tempPassword }) });
  assert.equal((await entrer()).status, 200, 'dans la journée, le mot de passe provisoire marche');
  const db = new DatabaseSync(join(srv.dir, 'hubuno.sqlite'));
  db.exec('PRAGMA busy_timeout = 2000');
  db.prepare('UPDATE users SET temp_until = ? WHERE id = ?').run(Date.now() - 1000, eleve.id); // comme 24 heures plus tard
  db.close();
  const tard = await entrer();
  assert.equal(tard.status, 403);
  assert.match((await tard.json()).error, /expiré/);
});

test('inscriptions : plafond de 80 par heure pour tout le hub, même depuis des adresses différentes', async () => {
  const s4 = await lancerServeur();
  try {
    const essayer = (i) => fetch(`${s4.url}api/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.1.${Math.floor(i / 200)}.${(i % 200) + 1}` }, // une adresse différente à chaque fois
      body: JSON.stringify({ classCode: CODE, pseudo: `masse${i}x${Date.now().toString(36).slice(-3)}`, password: MDP, acceptRules: true }),
    });
    const debut = [];
    for (let lot = 0; lot < 8; lot++) debut.push(...await Promise.all(Array.from({ length: 10 }, (_, k) => essayer(lot * 10 + k))));
    assert.deepEqual([...new Set(debut.map((r) => r.status))], [201], 'les 80 premières inscriptions passent (une classe entière s’inscrit d’un coup)');
    const suivante = await essayer(80);
    assert.equal(suivante.status, 429);
    assert.match((await suivante.json()).error, /inscriptions/);
  } finally {
    await s4.arreter();
  }
});

test('inscriptions fermées par un admin : plus aucun compte ne se crée, bon ou mauvais code, sauf avec le code admin', async () => {
  const admin = await connecter(await compteAdmin());
  const essayer = (code, p = pseudo()) => fetch(`${srv.url}api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ classCode: code, pseudo: p, password: MDP, acceptRules: true }) });
  const eleve = await connecter(await inscrire(srv, pseudo()));
  assert.equal((await eleve.appel('admin:setSignups', { open: false })).ok, false, 'un élève ne ferme pas les inscriptions');
  assert.deepEqual(await admin.appel('admin:setSignups', { open: false }), { ok: true, signupsOpen: false });
  try {
    const bon = await essayer(CODE);
    const mauvais = await essayer('un-mauvais-code');
    assert.equal(bon.status, 403);
    assert.equal(mauvais.status, 403);
    assert.equal((await bon.json()).error, (await mauvais.json()).error, 'la réponse ne dit pas si le code était le bon');
    assert.equal((await (await fetch(`${srv.url}api/options`)).json()).signupsOpen, false, 'l’écran d’accueil le sait');
    assert.equal((await fetch(`${srv.url}api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pseudo: eleve.compte.pseudo, password: MDP }) })).status, 200, 'les comptes existants se connectent toujours');
  } finally {
    assert.deepEqual(await admin.appel('admin:setSignups', { open: true }), { ok: true, signupsOpen: true });
  }
  assert.equal((await essayer(CODE)).status, 201, 'rouvertes, les inscriptions marchent de nouveau');
});

test('journal des erreurs et état du serveur : lus par les admins seulement, une ligne par sorte d’erreur', async () => {
  const admin = await connecter(await compteAdmin());
  const eleve = await connecter(await inscrire(srv, pseudo()));
  const erreur = { message: `zz-test : x is not a function ${pseudo('')}`, place: 'jeu morpion · /games/morpion/client.js:12 · #/t/3' };
  assert.equal((await eleve.appel('client:error', erreur)).ok, true);
  assert.equal((await eleve.appel('client:error', erreur)).ok, true);
  assert.equal((await eleve.appel('admin:errors')).ok, false, 'un élève ne lit pas le journal');
  assert.equal((await eleve.appel('admin:status')).ok, false, 'ni l’état du serveur');
  const { entries } = await admin.appel('admin:errors');
  const ligne = entries.filter((e) => e.message === erreur.message);
  assert.equal(ligne.length, 1, 'la même erreur ne fait qu’une ligne');
  assert.equal(ligne[0].count, 2);
  assert.equal(ligne[0].who, eleve.compte.pseudo);
  assert.equal(ligne[0].source, 'navigateur');
  const { status } = await admin.appel('admin:status');
  assert.equal(status.copies, 1, 'une seule copie de l’appli');
  assert.ok(status.backups >= 1 && status.lastBackupAt > Date.now() - 3600_000, 'la sauvegarde du jour est faite');
  assert.ok(status.accounts >= 2 && status.dbBytes > 0 && status.online >= 2 && /^[0-9a-f]{12}$/.test(status.version));
  assert.ok(status.errors24h >= 2);
  // Une deuxième copie de l'appli démarre sur la même base : l'écran Admin de la première le voit.
  const copie = await lancerServeur({ dir: srv.dir });
  try {
    assert.equal((await admin.appel('admin:status')).status.copies, 2);
  } finally {
    await copie.arreter();
  }
});

test('joueur hors ligne en pleine partie : un autre joueur peut le mettre en abandon, après le délai seulement', async () => {
  const s5 = await lancerServeur({ env: { PLAYER_AWAY_MS: '500' } });
  try {
    const a = await new Client(s5, await inscrire(s5, pseudo())).ouvrir();
    const b = await new Client(s5, await inscrire(s5, pseudo())).ouvrir();
    const spectateur = await new Client(s5, await inscrire(s5, pseudo())).ouvrir();
    try {
      const { id } = await a.appel('table:create', { game: 'morpion' });
      await b.appel('table:join', { id });
      await a.appel('table:start', { id });
      assert.equal((await a.appel('table:eject', { id, userId: b.compte.id })).ok, false, 'un joueur en ligne ne peut pas être mis en abandon');
      b.fermer();
      await jusque(async () => /encore/.test((await a.appel('table:eject', { id, userId: b.compte.id })).error ?? ''), 'juste après son départ : on lui laisse le temps de revenir');
      assert.equal((await spectateur.appel('table:eject', { id, userId: b.compte.id })).ok, false, 'un spectateur ne décide pas');
      await pause(600);
      assert.equal((await a.appel('table:eject', { id, userId: b.compte.id })).ok, true);
      await jusque(() => resume(a, id)?.status === 'over', 'la partie se termine');
      assert.deepEqual(resume(a, id).winners, [a.compte.id]);
      assert.deepEqual(resume(a, id).left, [b.compte.id]);
    } finally {
      a.fermer();
      spectateur.fermer();
    }
  } finally {
    await s5.arreter();
  }
});
