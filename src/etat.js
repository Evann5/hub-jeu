// Ce que l'écran Admin montre du serveur : son état (version, base, sauvegardes, copies de l'appli qui tournent) et le journal des erreurs,
// celles du serveur comme celles des navigateurs. En classe, personne n'ouvre la console ni le fichier stderr.log.
import { randomBytes } from 'node:crypto';
import { statSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { db, setSetting } from './db.js';
import { config } from './config.js';

// ——— Battement de cœur : chaque copie de l'appli écrit l'heure toutes les 20 s. Deux battements récents = deux copies (il n'en faut qu'une). ———
const INSTANCE = randomBytes(4).toString('hex');
const BEAT_MS = 20_000;
const ALIVE_MS = 50_000;
export const startedAt = Date.now();

function beat(now = Date.now()) {
  setSetting(`instance:${INSTANCE}`, String(now));
  db.prepare("DELETE FROM settings WHERE key LIKE 'instance:%' AND CAST(value AS INTEGER) < ?").run(now - 3600_000);
}
const stopBeat = () => { try { db.prepare('DELETE FROM settings WHERE key = ?').run(`instance:${INSTANCE}`); } catch { /* base fermée ou pleine : tant pis */ } };

export function startBeat() {
  beat();
  setInterval(() => { try { beat(); } catch { /* disque plein : le battement manquera, rien d'autre */ } }, BEAT_MS).unref();
  // À l'arrêt demandé (Restart), la copie retire son battement : la suivante n'est pas comptée en double pendant une minute.
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { stopBeat(); process.exit(0); });
}

export const liveInstances = (now = Date.now()) => db.prepare("SELECT COUNT(*) AS n FROM settings WHERE key LIKE 'instance:%' AND CAST(value AS INTEGER) > ?").get(now - ALIVE_MS).n;

// ——— Journal des erreurs ———
const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const MAX_ROWS = 300;
const DAY = 86400_000;

// source : « serveur » ou « navigateur ». Une même erreur au même endroit, dans la journée, ne fait qu'une ligne avec un compteur.
// N'échoue jamais : noter une erreur ne doit pas en créer une autre (disque plein, par exemple).
export function logError(source, { who = '', message, place = '' }, now = Date.now()) {
  try {
    const msg = clean(message, 300);
    const where = clean(place, 200);
    if (!msg) return;
    const same = db.prepare('SELECT id FROM error_log WHERE source = ? AND message = ? AND place = ? AND last_at > ?').get(source, msg, where, now - DAY);
    if (same) db.prepare('UPDATE error_log SET count = count + 1, last_at = ?, who = ? WHERE id = ?').run(now, clean(who, 40), same.id);
    else db.prepare('INSERT INTO error_log (at, last_at, source, who, message, place) VALUES (?, ?, ?, ?, ?, ?)').run(now, now, source, clean(who, 40), msg, where);
  } catch { /* rien */ }
}

export const recentErrors = (limit = 60) => db.prepare('SELECT id, at, last_at AS lastAt, source, who, message, place, count FROM error_log ORDER BY last_at DESC LIMIT ?').all(limit);

// Gardé 30 jours, 300 lignes au plus.
export function purgeErrors(now = Date.now()) {
  db.prepare('DELETE FROM error_log WHERE last_at < ?').run(now - 30 * DAY);
  db.prepare('DELETE FROM error_log WHERE id NOT IN (SELECT id FROM error_log ORDER BY last_at DESC LIMIT ?)').run(MAX_ROWS);
}

// ——— État ———
const size = (file) => (existsSync(file) ? statSync(file).size : 0);

export function serverStatus(now = Date.now()) {
  const dir = join(config.dataDir, 'sauvegardes');
  const backups = existsSync(dir) ? readdirSync(dir).filter((f) => /^hubuno-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort() : [];
  const last = backups.at(-1);
  const count = (sql, ...args) => db.prepare(sql).get(...args).n;
  return {
    startedAt,
    node: process.version,
    copies: liveInstances(now),
    accounts: count('SELECT COUNT(*) AS n FROM users WHERE banned = 0'),
    messages: count('SELECT COUNT(*) AS n FROM messages'),
    dbBytes: ['hubuno.sqlite', 'hubuno.sqlite-wal'].reduce((n, f) => n + size(join(config.dataDir, f)), 0),
    backups: backups.length,
    backupsBytes: backups.reduce((n, f) => n + size(join(dir, f)), 0),
    lastBackupAt: last ? statSync(join(dir, last)).mtimeMs : null,
    errors24h: count('SELECT COALESCE(SUM(count), 0) AS n FROM error_log WHERE last_at > ?', now - DAY),
    memoryBytes: process.memoryUsage().rss,
  };
}
