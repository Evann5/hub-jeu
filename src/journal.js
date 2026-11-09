// Journal de modération : qui a fait quoi, sur qui, et quand (sourdine, blocage, niveau, message effacé…), lu par les admins.
// Les pseudos sont recopiés : la ligne reste lisible si le compte est supprimé. Gardé un an, comme les messages.
import { db } from './db.js';

const YEAR = 365 * 86400_000;
const add = db.prepare('INSERT INTO mod_log (at, actor_id, actor, action, target, detail) VALUES (?, ?, ?, ?, ?, ?)');

export function logMod(actor, action, { target = '', detail = '' } = {}) {
  const now = Date.now();
  add.run(now, actor.id, actor.pseudo, action, String(target ?? ''), String(detail ?? '').slice(0, 200));
}

export const recentMod = (limit = 200) => db.prepare('SELECT id, at, actor, action, target, detail FROM mod_log ORDER BY id DESC LIMIT ?').all(limit);

export function purgeOldMod(now = Date.now()) {
  return Number(db.prepare('DELETE FROM mod_log WHERE at < ?').run(now - YEAR).changes);
}
