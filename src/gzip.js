// Fichiers compressés : un plateau en 3D pèse 2 Mo, 560 Ko une fois compressé. Chaque fichier est compressé une fois, puis gardé en mémoire tant qu'il ne change pas.
import { gzip } from 'node:zlib';
import { stat, readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const pack = promisify(gzip);
const TEXT = new Set(['.js', '.css', '.svg', '.json', '.glb']); // les polices et les images sont déjà compressées
const MIN_SIZE = 1024;

export function gzipped(dir) {
  const root = resolve(dir);
  const cache = new Map();
  return async (req, res, next) => {
    res.vary('Accept-Encoding');
    const ext = extname(req.path);
    if (!['GET', 'HEAD'].includes(req.method) || !TEXT.has(ext) || !req.acceptsEncodings('gzip') || req.path.includes('/.')) return next();
    try {
      const file = resolve(join(root, decodeURIComponent(req.path)));
      if (!file.startsWith(root + sep)) return next();
      const info = await stat(file);
      if (!info.isFile() || info.size < MIN_SIZE) return next();
      let entry = cache.get(file);
      if (entry?.mtime !== info.mtimeMs) {
        entry = { mtime: info.mtimeMs, body: await pack(await readFile(file)), etag: `W/"${info.size.toString(16)}-${Math.round(info.mtimeMs).toString(16)}"` };
        cache.set(file, entry);
      }
      res.set({ 'Content-Encoding': 'gzip', ETag: entry.etag, 'Cache-Control': 'public, max-age=0' });
      res.type(ext);
      if (req.fresh) return res.status(304).end();
      res.set('Content-Length', String(entry.body.length));
      return req.method === 'HEAD' ? res.end() : res.end(entry.body);
    } catch {
      return next(); // fichier absent, adresse mal formée : le service normal répond
    }
  };
}
