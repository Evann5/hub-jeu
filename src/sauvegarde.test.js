// Sauvegarde quotidienne de la base (src/sauvegarde.js). La base utilisée est un dossier temporaire, jamais celle du hub.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDir = mkdtempSync(join(tmpdir(), 'hubuno-sauvegarde-'));
process.env.DATA_DIR = dataDir;
const { db } = await import('./db.js');
const { backupIfDue, BACKUPS_KEPT } = await import('./sauvegarde.js');
after(() => rmSync(dataDir, { recursive: true, force: true }));

test('une sauvegarde par jour, lisible et complète, pendant que la base sert', () => {
  db.prepare('INSERT INTO users (pseudo, pass_hash, created_at) VALUES (?, ?, ?)').run('anna', 'x', Date.now());
  db.prepare('INSERT INTO messages (scope, user_id, body, created_at) VALUES (?, ?, ?, ?)').run('c:1', 1, 'bonjour', Date.now());
  const jour = new Date(2026, 10, 12, 9, 30);
  const fichier = backupIfDue(jour);
  assert.equal(fichier, join(dataDir, 'sauvegardes', 'hubuno-2026-11-12.sqlite'));
  assert.equal(backupIfDue(new Date(2026, 10, 12, 18, 0)), null, 'une seule par jour');
  const copie = new DatabaseSync(fichier, { readOnly: true });
  assert.equal(copie.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.equal(copie.prepare('SELECT body FROM messages').get().body, 'bonjour');
  assert.equal(copie.prepare('SELECT pseudo FROM users').get().pseudo, 'anna');
  copie.close();
  assert.ok(!existsSync(`${fichier}.tmp`), 'aucun fichier provisoire ne reste');
});

test(`les ${BACKUPS_KEPT} dernières sauvegardes sont gardées, les plus anciennes partent`, () => {
  for (let j = 13; j <= 21; j++) assert.ok(backupIfDue(new Date(2026, 10, j)));
  const gardees = readdirSync(join(dataDir, 'sauvegardes')).sort();
  assert.equal(gardees.length, BACKUPS_KEPT);
  assert.equal(gardees[0], 'hubuno-2026-11-15.sqlite');
  assert.equal(gardees.at(-1), 'hubuno-2026-11-21.sqlite');
});
