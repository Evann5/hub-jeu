// Rôles décoratifs, comme sur Discord : un nom et une couleur de la palette, donnés par les admins.
// Ils ne donnent aucun droit (les droits viennent du niveau : membre, modo, admin) ; le premier rôle d'un compte colore son pseudo.
import { db, transaction } from './db.js';
import { COLORS } from './options.js';
import { ChatError } from './chat.js';

export const ROLE_NAME_MAX = 24;
export const MAX_ROLES = 20;

export const listRoles = () => db.prepare('SELECT id, name, color FROM roles ORDER BY position, id').all();

function cleanName(name) {
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) throw new ChatError('Donne un nom au rôle.');
  if ([...clean].length > ROLE_NAME_MAX) throw new ChatError(`Le nom du rôle fait ${ROLE_NAME_MAX} caractères au plus.`);
  return clean;
}

function cleanColor(color) {
  if (!Object.hasOwn(COLORS, color)) throw new ChatError('Couleur inconnue.');
  return color;
}

function getRole(id) {
  const role = db.prepare('SELECT id, name, color FROM roles WHERE id = ?').get(Number(id));
  if (!role) throw new ChatError('Ce rôle n’existe plus.');
  return role;
}

const nameTaken = (name, exceptId = 0) => Boolean(db.prepare('SELECT 1 FROM roles WHERE name = ? AND id != ?').get(name, exceptId));

export function createRole({ name, color }) {
  const clean = cleanName(name);
  cleanColor(color);
  if (db.prepare('SELECT COUNT(*) AS n FROM roles').get().n >= MAX_ROLES) throw new ChatError(`${MAX_ROLES} rôles au plus : supprimes-en un avant d’en créer un autre.`);
  if (nameTaken(clean)) throw new ChatError('Un rôle porte déjà ce nom.');
  const position = (db.prepare('SELECT max(position) AS p FROM roles').get().p ?? -1) + 1;
  db.prepare('INSERT INTO roles (name, color, position, created_at) VALUES (?, ?, ?, ?)').run(clean, color, position, Date.now());
}

export function updateRole({ id, name, color }) {
  const role = getRole(id);
  const clean = cleanName(name);
  cleanColor(color);
  if (nameTaken(clean, role.id)) throw new ChatError('Un rôle porte déjà ce nom.');
  db.prepare('UPDATE roles SET name = ?, color = ? WHERE id = ?').run(clean, color, role.id);
}

// Monter ou descendre un rôle dans la liste : l'ordre décide de la couleur du pseudo et du rangement des membres.
export function moveRole({ id, step }) {
  const role = getRole(id);
  const ids = listRoles().map((r) => r.id);
  const from = ids.indexOf(role.id);
  const to = from + (Number(step) < 0 ? -1 : 1);
  if (to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  transaction(() => {
    const set = db.prepare('UPDATE roles SET position = ? WHERE id = ?');
    ids.forEach((rid, i) => set.run(i, rid));
  });
}

export function deleteRole({ id }) {
  const role = getRole(id);
  db.prepare('DELETE FROM roles WHERE id = ?').run(role.id); // user_roles suit (ON DELETE CASCADE)
  return role;
}

export function setUserRoles(userId, roleIds) {
  const wanted = [...new Set([].concat(roleIds ?? []).map(Number))];
  const known = new Set(listRoles().map((r) => r.id));
  if (wanted.some((rid) => !known.has(rid))) throw new ChatError('Un de ces rôles n’existe plus.');
  transaction(() => {
    db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
    const add = db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
    wanted.forEach((rid) => add.run(userId, rid));
  });
}
