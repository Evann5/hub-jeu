// Messagerie : canaux, messages privés, réactions et non-lus. Les fonctions ici ne connaissent pas Socket.IO.
import { db } from './db.js';
import { LIMITS, REACTIONS } from './options.js';
import { config } from './config.js';
import { tableExists } from './tables.js';

const PAGE = 50;

export class ChatError extends Error {}

export function dmScope(a, b) {
  return a < b ? `dm:${a}:${b}` : `dm:${b}:${a}`;
}

// Vérifie que l'utilisateur peut lire et écrire dans ce scope ; renvoie ce qu'on sait du scope.
export function checkScope(scope, userId) {
  const m = typeof scope === 'string' ? /^(c|dm|t):(\d+)(?::(\d+))?$/.exec(scope) : null; // un scope qui n'est pas du texte n'est jamais valide
  // Une seule écriture par conversation : « c:01 » ou « c:1:99 » créeraient des non-lus que personne ne peut effacer.
  const canonical = m && (m[1] === 'dm' ? `dm:${Number(m[2])}:${Number(m[3])}` : `${m[1]}:${Number(m[2])}`);
  if (!m || canonical !== scope) throw new ChatError('Conversation introuvable.');
  if (m[1] === 't') {
    // Chat d'une table : ouvert aux joueurs et aux spectateurs (toute la classe peut regarder).
    if (!tableExists(m[2])) throw new ChatError("Cette partie n'existe plus.");
    return { kind: 'table', tableId: Number(m[2]) };
  }
  if (m[1] === 'c') {
    const channel = db.prepare('SELECT id FROM channels WHERE id = ?').get(Number(m[2]));
    if (!channel) throw new ChatError("Ce canal n'existe plus.");
    return { kind: 'channel', channelId: channel.id };
  }
  const a = Number(m[2]);
  const b = Number(m[3]);
  if (!(a < b) || (userId !== a && userId !== b)) throw new ChatError('Conversation introuvable.');
  const other = userId === a ? b : a;
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(other)) throw new ChatError("Cette personne n'a plus de compte.");
  return { kind: 'dm', members: [a, b] };
}

function withReactions(rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const reacts = db
    .prepare(`SELECT message_id, user_id, emoji FROM reactions WHERE message_id IN (${ids.map(() => '?').join(',')}) ORDER BY rowid`)
    .all(...ids);
  return rows.map((r) => {
    const reactions = {};
    for (const x of reacts) if (x.message_id === r.id) (reactions[x.emoji] ??= []).push(x.user_id);
    return { id: r.id, scope: r.scope, userId: r.user_id, body: r.body, createdAt: r.created_at, reactions };
  });
}

export function history(scope, before) {
  before = Number(before) || 0;
  const rows = before
    ? db.prepare('SELECT * FROM messages WHERE scope = ? AND id < ? ORDER BY id DESC LIMIT ?').all(scope, Number(before), PAGE)
    : db.prepare('SELECT * FROM messages WHERE scope = ? ORDER BY id DESC LIMIT ?').all(scope, PAGE);
  return { messages: withReactions(rows.reverse()), complete: rows.length < PAGE };
}

export function getMessage(id) {
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(id));
  return row ? withReactions([row])[0] : null;
}

export function cleanBody(body) {
  const text = String(body ?? '').replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  if (!text) throw new ChatError('Le message est vide.');
  if (text.length > LIMITS.messageMax) throw new ChatError(`Le message dépasse ${LIMITS.messageMax} caractères.`);
  return text;
}

export function postMessage(scope, userId, body) {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO messages (scope, user_id, body, created_at) VALUES (?, ?, ?, ?)')
    .run(scope, userId, cleanBody(body), Date.now());
  markRead(userId, scope, Number(lastInsertRowid));
  return getMessage(lastInsertRowid);
}

export function toggleReaction(messageId, userId, emoji) {
  if (!REACTIONS.includes(emoji)) throw new ChatError('Réaction inconnue.');
  const msg = getMessage(messageId);
  if (!msg) throw new ChatError("Ce message n'existe plus.");
  const had = db.prepare('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(msg.id, userId, emoji);
  if (!had.changes) db.prepare('INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)').run(msg.id, userId, emoji);
  return getMessage(msg.id);
}

export function deleteMessage(id) {
  const msg = getMessage(id);
  if (!msg) throw new ChatError("Ce message n'existe plus.");
  db.prepare('DELETE FROM messages WHERE id = ?').run(msg.id);
  return msg;
}

export function markRead(userId, scope, lastId) {
  db.prepare(
    `INSERT INTO reads (user_id, scope, last_id) VALUES (?, ?, ?)
     ON CONFLICT(user_id, scope) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)`,
  ).run(userId, scope, Number(lastId) || 0);
}

// Au départ, un nouveau compte n'a rien en retard dans les canaux.
export function markAllChannelsRead(userId) {
  for (const { id } of db.prepare('SELECT id FROM channels').all()) {
    const last = db.prepare('SELECT MAX(id) AS id FROM messages WHERE scope = ?').get(`c:${id}`).id;
    if (last) markRead(userId, `c:${id}`, last);
  }
}

// Les conversations privées possibles de la personne : une requête par conversation, sur l'index (scope, id), plutôt qu'un parcours de tous les messages.
function dmScopesOf(userId) {
  return db.prepare('SELECT id FROM users WHERE id != ?').all(userId).map((u) => dmScope(userId, u.id));
}

// Nombre de messages non lus par scope (canaux et messages privés de la personne).
export function unreadCounts(userId) {
  const reads = new Map(db.prepare('SELECT scope, last_id FROM reads WHERE user_id = ?').all(userId).map((r) => [r.scope, r.last_id]));
  const channels = db.prepare('SELECT id FROM channels').all().map((c) => `c:${c.id}`);
  const count = db.prepare('SELECT COUNT(*) AS n FROM messages WHERE scope = ? AND id > ? AND user_id != ?');
  const out = {};
  for (const scope of [...channels, ...dmScopesOf(userId)]) {
    const { n } = count.get(scope, reads.get(scope) ?? 0, userId);
    if (n) out[scope] = n;
  }
  return out;
}

// Conversations privées de la personne, la plus récente d'abord.
export function dmList(userId) {
  const latest = db.prepare('SELECT id AS last_id, created_at AS last_at FROM messages WHERE scope = ? ORDER BY id DESC LIMIT 1');
  const rows = dmScopesOf(userId)
    .map((scope) => ({ scope, ...latest.get(scope) }))
    .filter((r) => r.last_id)
    .sort((x, y) => y.last_id - x.last_id);
  return rows.map((r) => {
    const [a, b] = r.scope.split(':').slice(1).map(Number);
    return { scope: r.scope, otherId: a === userId ? b : a, lastAt: r.last_at };
  });
}

export function listChannels() {
  return db.prepare('SELECT id, name, topic, position FROM channels ORDER BY position, id').all();
}

export function cleanChannel({ name, topic }) {
  const clean = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  if (clean.length < 2 || clean.length > LIMITS.channelNameMax) {
    throw new ChatError(`Le nom du canal doit faire de 2 à ${LIMITS.channelNameMax} caractères (lettres, chiffres, tirets).`);
  }
  const t = String(topic ?? '').trim();
  if (t.length > LIMITS.topicMax) throw new ChatError(`La description dépasse ${LIMITS.topicMax} caractères.`);
  return { name: clean, topic: t };
}

export function createChannel(input) {
  const { name, topic } = cleanChannel(input);
  if (db.prepare('SELECT 1 FROM channels WHERE name = ?').get(name)) throw new ChatError('Un canal porte déjà ce nom.');
  const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM channels').get().p;
  db.prepare('INSERT INTO channels (name, topic, position, created_at) VALUES (?, ?, ?, ?)').run(name, topic, pos, Date.now());
}

export function updateChannel(id, input) {
  const { name, topic } = cleanChannel(input);
  const clash = db.prepare('SELECT id FROM channels WHERE name = ?').get(name);
  if (clash && clash.id !== Number(id)) throw new ChatError('Un canal porte déjà ce nom.');
  const res = db.prepare('UPDATE channels SET name = ?, topic = ? WHERE id = ?').run(name, topic, Number(id));
  if (!res.changes) throw new ChatError("Ce canal n'existe plus.");
}

export function deleteChannel(id) {
  if (db.prepare('SELECT COUNT(*) AS n FROM channels').get().n <= 1) throw new ChatError('Il faut garder au moins un canal.');
  const scope = `c:${Number(id)}`;
  db.prepare('DELETE FROM messages WHERE scope = ?').run(scope);
  db.prepare('DELETE FROM reads WHERE scope = ?').run(scope);
  const res = db.prepare('DELETE FROM channels WHERE id = ?').run(Number(id));
  if (!res.changes) throw new ChatError("Ce canal n'existe plus.");
}

// Suppression d'un compte : efface ses messages privés (dans les deux sens) et les « lus » de ces conversations.
// Ses messages dans les canaux et ses réactions partent avec la ligne du compte (clés étrangères en cascade).
export function deleteUserData(userId) {
  const mine = [`dm:${Number(userId)}:%`, `dm:%:${Number(userId)}`];
  db.prepare('DELETE FROM messages WHERE scope LIKE ? OR scope LIKE ?').run(...mine);
  db.prepare('DELETE FROM reads WHERE scope LIKE ? OR scope LIKE ?').run(...mine);
}

// Efface les messages de plus d'un an (décision du 23/10/2026).
export function purgeOldMessages() {
  const limit = Date.now() - config.messageRetentionDays * 86400_000;
  return db.prepare('DELETE FROM messages WHERE created_at < ?').run(limit).changes;
}
