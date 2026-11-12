// Sauvegarde de la base, une fois par jour, dans data/sauvegardes/ : une copie cohérente faite par SQLite lui-même (VACUUM INTO),
// même pendant que l'appli écrit. Les 7 dernières sont gardées. Pour restaurer : docs/mise-en-ligne.md, « Restaurer une sauvegarde ».
import { mkdirSync, existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { db } from './db.js';
import { config } from './config.js';

export const BACKUPS_KEPT = 7;
const NAME_RE = /^hubuno-\d{4}-\d{2}-\d{2}\.sqlite$/;
const two = (n) => String(n).padStart(2, '0');

// Fait la sauvegarde du jour si elle n'existe pas encore ; rend son chemin, ou null s'il n'y avait rien à faire.
export function backupIfDue(now = new Date()) {
  const dir = join(config.dataDir, 'sauvegardes');
  mkdirSync(dir, { recursive: true });
  const name = `hubuno-${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}.sqlite`;
  const file = join(dir, name);
  if (existsSync(file)) return null;
  const tmp = `${file}.tmp`; // écrite à part puis renommée : une sauvegarde interrompue ne passe jamais pour une bonne
  rmSync(tmp, { force: true });
  db.exec(`VACUUM INTO '${tmp.replaceAll("'", "''")}'`);
  renameSync(tmp, file);
  for (const old of readdirSync(dir).filter((f) => NAME_RE.test(f)).sort().slice(0, -BACKUPS_KEPT)) rmSync(join(dir, old), { force: true });
  return file;
}
