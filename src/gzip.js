// Fichiers compressés : un plateau en 3D pèse 2 Mo, 560 Ko une fois compressé. Chaque fichier est compressé une fois, puis gardé en mémoire tant qu'il ne change pas.
import { gzip } from 'node:zlib';
import { stat, readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const pack = promisify(gzip);
const TEXT = new Set(['.js', '.css', '.svg', '.json', '.glb']); // les polices et les images sont déjà compressées
const MIN_SIZE = 1024;

// Durée de garde dans le navigateur. Le code (JS, CSS, HTML) reste à « revérifier à chaque fois » : un module qui change
// ne doit jamais rester servi dans sa vieille version à côté de ses voisins. Seuls durent longtemps :
// - three/*.js demandé avec ?v=… (la version est dans l'adresse : changer de version change l'adresse) ;
// - les polices (leur nom dit la famille et la graisse, elles ne sont jamais réécrites sous le même nom) ;
// - les images et monuments des jeux : un jour, puis un rafraîchissement discret en arrière-plan. Pire cas après une mise à jour : une visite de retard.
const DAY = 86400;
export function cachePolicy(path, query = {}) {
  if (/\/client\/three\/[\w.-]+\.js$/.test(path) && typeof query.v === 'string' && query.v) return `public, max-age=${365 * DAY}, immutable`;
  if (path.endsWith('.woff2')) return `public, max-age=${30 * DAY}`;
  if (/\/assets\/.+\.(glb|png|svg|jpg|webp)$/.test(path)) return `public, max-age=${DAY}, stale-while-revalidate=${7 * DAY}`;
  return null;
}

export function gzipped(dir) {
  const root = resolve(dir);
  const cache = new Map();
  return async (req, res, next) => {
    res.vary('Accept-Encoding');
    const ext = extname(req.path);
    if (!['GET', 'HEAD'].includes(req.method) || req.path.includes('/.')) return next();
    const policy = cachePolicy(req.path, req.query);
    const gzipable = TEXT.has(ext) && req.acceptsEncodings('gzip');
    if (!policy && !gzipable) return next();
    try {
      const file = resolve(join(root, decodeURIComponent(req.path)));
      if (!file.startsWith(root + sep)) return next();
      const info = await stat(file);
      if (!info.isFile()) return next(); // absent : jamais de durée de garde sur une erreur
      if (policy) res.set('Cache-Control', policy); // express.static laisse en place un Cache-Control déjà posé
      if (!gzipable || info.size < MIN_SIZE) return next();
      let entry = cache.get(file);
      if (entry?.mtime !== info.mtimeMs) {
        entry = { mtime: info.mtimeMs, body: await pack(await readFile(file)), etag: `W/"${info.size.toString(16)}-${Math.round(info.mtimeMs).toString(16)}"` };
        cache.set(file, entry);
      }
      res.set({ 'Content-Encoding': 'gzip', ETag: entry.etag, 'Cache-Control': policy ?? 'public, max-age=0' });
      res.type(ext);
      if (req.fresh) return res.status(304).end();
      res.set('Content-Length', String(entry.body.length));
      return req.method === 'HEAD' ? res.end() : res.end(entry.body);
    } catch {
      return next(); // fichier absent, adresse mal formée : le service normal répond
    }
  };
}
