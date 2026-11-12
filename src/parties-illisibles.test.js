// Une partie que son jeu ne sait plus lire (état d'un ancien format après une mise à jour, bogue des règles) ne doit jamais
// bloquer le hub : ni au démarrage, ni en cours de partie. La base utilisée est un dossier temporaire, jamais celle du hub.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { lancerServeur, inscrire, Client, jusque } from '../tests/aide-serveur.mjs';

const dataDir = mkdtempSync(join(tmpdir(), 'hubuno-illisible-'));
process.env.DATA_DIR = dataDir;
const { games } = await import('./games.js');
const tables = await import('./tables.js');
const { ChatError } = await import('./erreurs.js');
after(() => rmSync(dataDir, { recursive: true, force: true }));

test('au démarrage : une partie à l’état illisible est mise de côté, le hub démarre et les autres parties sont là', async () => {
  const srv = await lancerServeur();
  try {
    const anna = await inscrire(srv, 'anna-illisible');
    const tom = await inscrire(srv, 'tom-illisible');
    await srv.couper();
    const db = new DatabaseSync(join(srv.dir, 'hubuno.sqlite'));
    const now = Date.now();
    const ajouter = db.prepare('INSERT INTO game_tables (game, host_id, status, seats, options, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    // Comme après une mise à jour d'Escales : une partie en cours dont l'état a l'ancien format.
    const cassee = Number(ajouter.run('escales', anna.id, 'playing', JSON.stringify([anna.id, tom.id]), '{}', '{"ancien":true}', now, now).lastInsertRowid);
    const abimee = Number(ajouter.run('morpion', anna.id, 'playing', 'pas du JSON', '{}', '{}', now, now).lastInsertRowid);
    const saine = Number(ajouter.run('morpion', tom.id, 'lobby', JSON.stringify([tom.id]), '{}', null, now, now).lastInsertRowid);
    db.close();

    await srv.demarrer(); // lève une erreur si le serveur ne démarre pas
    const c = await new Client(srv, tom).ouvrir();
    try {
      const vues = (await jusque(() => c.dernier('state'), 'état reçu à la connexion')).tables.map((t) => t.id);
      assert.deepEqual(vues, [saine], 'seule la partie saine est proposée');
      assert.match(srv.journal, new RegExp(`Partie ${cassee} \\(escales\\) illisible, mise de côté`));
      assert.match(srv.journal, new RegExp(`Partie ${abimee} \\(morpion\\) illisible, mise de côté`));
      assert.equal((await c.appel('table:watch', { id: cassee })).ok, false, 'la partie mise de côté ne s’ouvre pas');
      // Tom jouait dans la partie d'Escales mise de côté : il est prévenu à son retour.
      const avis = c.recus.filter((r) => r.ev === 'notice');
      assert.equal(avis.length, 1);
      assert.match(avis[0].data, /Escales.*interrompue par une mise à jour/);
      const avisDe = async (client) => { await client.ouvrir(); await jusque(() => client.dernier('state'), 'état reçu'); await new Promise((r) => setTimeout(r, 150)); client.fermer(); return client.recus.filter((r) => r.ev === 'notice').length; };
      assert.equal(await avisDe(new Client(srv, tom)), 0, 'reçu une fois, l’avis ne revient pas');
      // Anna, elle, se reconnecte avec une page qui n'a pas le temps de le recevoir (elle se recharge) : l'avis lui est redonné ensuite.
      const presse = new Client(srv, anna);
      presse.sansAccuse = true;
      assert.equal(await avisDe(presse), 1);
      assert.equal(await avisDe(new Client(srv, anna)), 1, 'pas d’accusé de réception : l’avis est redonné');
      assert.equal(await avisDe(new Client(srv, anna)), 0);
      assert.equal((await c.appel('table:create', { game: 'morpion' })).ok, true, 'on peut créer une nouvelle partie');
      // Le serveur redémarre (une autre mise à jour) : la partie est de nouveau mise de côté, mais personne n'est prévenu deux fois.
      await srv.couper();
      await srv.demarrer();
      assert.equal(await avisDe(new Client(srv, tom)), 0, 'après un redémarrage, pas de second avis');
      assert.equal(await avisDe(new Client(srv, anna)), 0);
    } finally {
      c.fermer();
    }
    const db2 = new DatabaseSync(join(srv.dir, 'hubuno.sqlite'), { readOnly: true });
    assert.equal(db2.prepare('SELECT COUNT(*) AS n FROM game_tables WHERE id IN (?, ?)').get(cassee, abimee).n, 2, 'rien n’est effacé : les lignes restent dans la base');
    db2.close();
  } finally {
    await srv.arreter();
  }
});

// Un jeu d'essai dont les règles plantent sur commande.
games.set('zz-casse', {
  id: 'zz-casse', name: 'Jeu cassé', minPlayers: 1, maxPlayers: 2, options: [],
  rules: {
    setup: (players, options) => ({ n: 0, boom: options.boomAuDepart === true }),
    move: (state, playerId, action) => ({ state: action.boom ? { boom: true } : { ...state, n: state.n + 1 } }),
    view: (state) => state,
    status: (state) => {
      if (state.boom) throw new TypeError('le jeu plante sur cet état');
      return { turn: 1, over: false, winners: [] };
    },
  },
});

test('en partie : un coup dont le résultat ferait planter le jeu est refusé, la partie reste jouable et la liste reste entière', () => {
  const t = tables.createTable('zz-casse', 1);
  tables.startTable(t.id, 1);
  tables.playMove(t.id, 1, {});
  assert.equal(tables.getTable(t.id).state.n, 1);
  assert.throws(() => tables.playMove(t.id, 1, { boom: true }), ChatError, 'le coup est refusé avec un message pour le joueur');
  assert.deepEqual(tables.getTable(t.id).state, { n: 1, boom: false }, 'l’état d’avant le coup est gardé');
  assert.equal(tables.summaries().find((x) => x.id === t.id).status, 'playing');
  tables.playMove(t.id, 1, {});
  assert.equal(tables.getTable(t.id).state.n, 2, 'on peut continuer à jouer');
});

test('en partie : si l’état en mémoire fait quand même planter le jeu, la partie est mise de côté et la liste des autres tient', () => {
  const saine = tables.createTable('zz-casse', 2);
  const malade = tables.createTable('zz-casse', 3);
  tables.startTable(malade.id, 3);
  tables.getTable(malade.id).state = { boom: true }; // un état que les règles ne savent pas lire
  const liste = tables.summaries();
  assert.ok(liste.some((x) => x.id === saine.id), 'la partie saine est dans la liste');
  assert.ok(!liste.some((x) => x.id === malade.id), 'la partie malade n’y est plus');
  assert.equal(tables.tableExists(malade.id), false);
});
