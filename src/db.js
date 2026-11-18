// Base SQLite intégrée à Node (aucun module natif à compiler sur l'hébergement).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.js';

mkdirSync(config.dataDir, { recursive: true });
export const db = new DatabaseSync(join(config.dataDir, 'hubuno.sqlite'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  -- Pendant un redémarrage, l'ancienne copie de l'appli peut encore écrire quelques instants : on attend son verrou (2 s au plus) au lieu d'échouer.
  PRAGMA busy_timeout = 2000;

  -- AUTOINCREMENT : l'identifiant d'un compte supprimé n'est jamais redonné à un autre (sinon il hériterait de ses messages privés).
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pseudo TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '🎲',
    color TEXT NOT NULL DEFAULT 'rouge',
    bio TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'membre' CHECK (role IN ('membre', 'modo', 'admin')),
    muted_until INTEGER NOT NULL DEFAULT 0,
    banned INTEGER NOT NULL DEFAULT 0,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    topic TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  -- scope : « c:<canal> », « dm:<petit id>:<grand id> » ou « t:<table de jeu> ».
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    scope TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS messages_scope ON messages (scope, id);

  CREATE TABLE IF NOT EXISTS reactions (
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    PRIMARY KEY (message_id, user_id, emoji)
  );

  -- Dernier message lu par personne et par conversation, pour les pastilles « non lu ».
  CREATE TABLE IF NOT EXISTS reads (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    last_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, scope)
  );

  -- Rôles décoratifs, comme sur Discord : un nom et une couleur ; le premier de la liste colore le pseudo.
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    color TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
  );

  -- Journal de modération (journal.js) : sans clé étrangère, une ligne survit au compte qu'elle cite.
  CREATE TABLE IF NOT EXISTS mod_log (
    id INTEGER PRIMARY KEY,
    at INTEGER NOT NULL,
    actor_id INTEGER NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT ''
  );

  -- Journal des erreurs (etat.js) : celles du serveur et celles des navigateurs, lues par les admins. Gardé 30 jours.
  CREATE TABLE IF NOT EXISTS error_log (
    id INTEGER PRIMARY KEY,
    at INTEGER NOT NULL,
    last_at INTEGER NOT NULL,
    source TEXT NOT NULL,
    who TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    place TEXT NOT NULL DEFAULT '',
    count INTEGER NOT NULL DEFAULT 1
  );

  -- Tables de jeu : places (ids des joueurs, dans l'ordre), réglages et état du jeu en JSON.
  CREATE TABLE IF NOT EXISTS game_tables (
    id INTEGER PRIMARY KEY,
    game TEXT NOT NULL,
    host_id INTEGER,
    status TEXT NOT NULL CHECK (status IN ('lobby', 'playing', 'over')),
    seats TEXT NOT NULL,
    options TEXT NOT NULL,
    state TEXT,
    left_ids TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    started_at INTEGER
  );
`);

// Colonne ajoutée après coup : joueurs qui ont abandonné la partie en cours.
if (!db.prepare('PRAGMA table_info(game_tables)').all().some((c) => c.name === 'left_ids')) {
  db.exec("ALTER TABLE game_tables ADD COLUMN left_ids TEXT NOT NULL DEFAULT '[]'");
}

// Colonne ajoutée après coup : l'heure du dernier lancement de la partie (le navigateur y reconnaît une nouvelle manche).
if (!db.prepare('PRAGMA table_info(game_tables)').all().some((c) => c.name === 'started_at')) {
  db.exec('ALTER TABLE game_tables ADD COLUMN started_at INTEGER');
}

// Colonne ajoutée après coup : un canal réservé à l'équipe (modos et admins).
if (!db.prepare('PRAGMA table_info(channels)').all().some((c) => c.name === 'staff_only')) {
  db.exec('ALTER TABLE channels ADD COLUMN staff_only INTEGER NOT NULL DEFAULT 0');
}

// Rôle « modo » ajouté après coup : SQLite ne sait pas changer une contrainte CHECK, on recopie la table des comptes
// (méthode officielle : clés étrangères coupées le temps de la copie, compteur d'identifiants conservé).
if (!/'modo'/.test(db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get().sql)) {
  const hasSeq = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'sqlite_sequence'").get(); // absent dans les toutes premières bases
  const seq = (hasSeq && db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'users'").get()?.seq) || 0;
  const cols = 'id, pseudo, pass_hash, avatar, color, bio, role, muted_until, banned, must_change_password, created_at';
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec('BEGIN');
    try {
      db.exec(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pseudo TEXT NOT NULL UNIQUE COLLATE NOCASE,
          pass_hash TEXT NOT NULL,
          avatar TEXT NOT NULL DEFAULT '🎲',
          color TEXT NOT NULL DEFAULT 'rouge',
          bio TEXT NOT NULL DEFAULT '',
          role TEXT NOT NULL DEFAULT 'membre' CHECK (role IN ('membre', 'modo', 'admin')),
          muted_until INTEGER NOT NULL DEFAULT 0,
          banned INTEGER NOT NULL DEFAULT 0,
          must_change_password INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );
        INSERT INTO users_new (${cols}) SELECT ${cols} FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `);
      db.prepare("UPDATE sqlite_sequence SET seq = max(seq, ?) WHERE name = 'users'").run(seq);
      if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Migration des rôles : clés étrangères cassées, rien n’est changé.');
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

// Colonne ajoutée après coup (après la recopie ci-dessus, qui ne la connaît pas) : jusqu'à quand le mot de passe provisoire d'un compte est valable.
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'temp_until')) {
  db.exec('ALTER TABLE users ADD COLUMN temp_until INTEGER NOT NULL DEFAULT 0');
}

// Colonne ajoutée après coup : le personnage de chacun (JSON { style, skin, hair }), vide tant qu'il n'en a pas créé.
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'character')) {
  db.exec("ALTER TABLE users ADD COLUMN character TEXT NOT NULL DEFAULT ''");
}

// Colonnes ajoutées après coup (18/11/2026) : jeux favoris (JSON, visibles de leur seul propriétaire), photo envoyée (nom du fichier
// dans data/photos) et choix de l'avatar : '' (le personnage s'il existe, sinon la silhouette), 'personnage', 'photo' ou 'silhouette'.
for (const [name, def] of [['favorites', "TEXT NOT NULL DEFAULT '[]'"], ['photo', "TEXT NOT NULL DEFAULT ''"], ['pic', "TEXT NOT NULL DEFAULT ''"]]) {
  if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
}

// Résultats des parties terminées, pour les stats (séries, classements) et les succès des profils.
// Sans clé étrangère vers users : un compte supprimé voit ses lignes effacées à la main (deleteUserData).
db.exec(`
  CREATE TABLE IF NOT EXISTS game_results (
    table_id INTEGER NOT NULL,
    round INTEGER NOT NULL,
    game TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    won INTEGER NOT NULL,
    players INTEGER NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (table_id, round, user_id)
  );
  CREATE INDEX IF NOT EXISTS game_results_user ON game_results (user_id, at);
  CREATE INDEX IF NOT EXISTS game_results_at ON game_results (at);
`);

if (!db.prepare('SELECT 1 FROM channels LIMIT 1').get()) {
  const add = db.prepare('INSERT INTO channels (name, topic, position, created_at) VALUES (?, ?, ?, ?)');
  add.run('général', 'Le salon de toute la classe', 0, Date.now());
  add.run('on-joue-quand', 'Organiser les prochaines parties', 1, Date.now());
}

export function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
}

export function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

// Exécute fn dans une transaction : tout ou rien.
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
