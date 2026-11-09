// Version du code servi aux navigateurs : une empreinte des fichiers de public/ et games/ (chemin, taille, date), calculée au démarrage.
// Après une mise à jour et un redémarrage, elle change : les pages déjà ouvertes proposent de recharger (app.js).
import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export function codeVersion(root) {
  const hash = createHash('sha256');
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && !/\.test\.(m?js)$/.test(e.name)) {
        const s = statSync(p);
        hash.update(`${relative(root, p)}|${s.size}|${Math.round(s.mtimeMs)}\n`);
      }
    }
  };
  for (const d of ['public', 'games']) walk(join(root, d));
  return hash.digest('hex').slice(0, 12);
}
