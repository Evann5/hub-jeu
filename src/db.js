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

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    pseudo TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '🎲',
    color TEXT NOT NULL DEFAULT 'rouge',
    bio TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'membre' CHECK (role IN ('membre', 'admin')),
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
    updated_at INTEGER NOT NULL
  );
`);

// Colonne ajoutée après coup : joueurs qui ont abandonné la partie en cours.
if (!db.prepare('PRAGMA table_info(game_tables)').all().some((c) => c.name === 'left_ids')) {
  db.exec("ALTER TABLE game_tables ADD COLUMN left_ids TEXT NOT NULL DEFAULT '[]'");
}

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
