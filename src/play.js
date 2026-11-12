// Tables de jeu en direct : chaque table a sa salle Socket.IO « t:<id> » (joueurs et spectateurs qui la regardent).
// Chaque personne reçoit sa propre vue du jeu : on ne voit jamais les cartes ou le mot des autres.
import * as tables from './tables.js';
import { catalog } from './games.js';
import { ChatError } from './chat.js';
import { getUser } from './auth.js';
import { logMod } from './journal.js';
import { config } from './config.js';

let io;
const timers = new Map(); // tableId -> minuteur en cours
const moveTimes = new Map(); // userId -> horodatages des derniers coups

// Garde-fou : 40 coups par 5 secondes et par personne (un trait de dessin ou un brouillon est un coup).
function tooFast(userId) {
  const now = Date.now();
  const times = (moveTimes.get(userId) || []).filter((t) => now - t < 5000);
  moveTimes.set(userId, times);
  if (times.length >= 40) return true; // un coup refusé n'est pas retenu : sinon une rafale ferait grossir ce tableau et gèlerait le serveur
  times.push(now);
  return false;
}

// Un salon que plus personne ne regarde se ferme au bout de 5 minutes : sinon, la liste se remplit de salons vides où personne ne répond.
const LOBBY_GRACE = 5 * 60_000;
const emptySince = new Map();
function sweepLobbies() {
  const now = Date.now();
  for (const t of tables.lobbies()) {
    if (io.sockets.adapter.rooms.get(`t:${t.id}`)?.size) {
      emptySince.delete(t.id);
      continue;
    }
    if (!emptySince.has(t.id)) emptySince.set(t.id, now);
    if (now - emptySince.get(t.id) >= LOBBY_GRACE) {
      emptySince.delete(t.id);
      tables.dropLobby(t);
      changed(null, t.id);
    }
  }
}

// Qui a au moins une connexion ouverte (salle « u:<id> » de chaque personne).
const isOnline = (userId) => Boolean(io.sockets.adapter.rooms.get(`u:${userId}`)?.size);

// Un salon dont l'hôte est hors ligne : les autres ne peuvent pas lancer. Après config.hostAwayMs, la main passe au premier joueur assis en ligne.
// On suit aussi l'hôte des parties terminées : la revanche lancée par un autre ne lui prend la main qu'après le même délai (un wifi qui saute 3 s ne coûte rien).
const hostAwaySince = new Map(); // id de la partie -> depuis quand son hôte est hors ligne
const hostAway = (t) => !isOnline(t.hostId) && Date.now() - (hostAwaySince.get(t.id) ?? Infinity) >= config.hostAwayMs;
function sweepHosts() {
  const now = Date.now();
  const followed = tables.allTables().filter((t) => t.status !== 'playing');
  for (const id of hostAwaySince.keys()) if (!followed.some((t) => t.id === id)) hostAwaySince.delete(id);
  for (const t of followed) {
    if (isOnline(t.hostId)) {
      hostAwaySince.delete(t.id);
      continue;
    }
    if (!hostAwaySince.has(t.id)) hostAwaySince.set(t.id, now);
    if (t.status !== 'lobby' || !hostAway(t)) continue;
    const next = t.seats.find((x) => x !== t.hostId && isOnline(x));
    if (next === undefined) continue; // personne d'autre en ligne : le salon vide se fermera tout seul
    hostAwaySince.delete(t.id);
    const moved = tables.passHost(t.id, next);
    if (moved) changed(moved);
  }
}

export function initPlay(server) {
  io = server;
  setInterval(sweepLobbies, 30_000).unref();
  setInterval(sweepHosts, Math.min(15_000, Math.max(200, config.hostAwayMs / 3))).unref();
  for (const t of tables.loadTables()) schedule(t);
}

export const gamesCatalog = catalog;
export const tableList = () => tables.summaries();

// La liste complète des parties part à la connexion (événement « state »). Ensuite, seule la partie qui change est envoyée
// (« tables:update »), et seulement si son résumé public a changé : un spectateur qui entre ou sort ne dérange plus toute la classe.
const lastSent = new Map(); // id -> dernier résumé envoyé (sans updatedAt, qui bouge à chaque écriture)
function broadcastSummary(summary) {
  const { updatedAt, ...visible } = summary;
  const key = JSON.stringify(visible);
  if (lastSent.get(summary.id) === key) return;
  lastSent.set(summary.id, key);
  io.to('membres').emit('tables:update', { table: summary });
}

// La partie n'existe plus : la classe la retire de sa liste, ceux qui la regardaient sont prévenus et quittent sa salle.
function broadcastRemoved(id) {
  const room = `t:${id}`;
  lastSent.delete(id);
  io.to(room).emit('table:closed', { id });
  io.in(room).socketsLeave(room);
  io.to('membres').emit('tables:update', { removed: id });
}

// Envoie à chaque personne de la salle sa vue de la table, puis la liste des tables à tout le monde.
async function pushTable(id, events = []) {
  const room = `t:${id}`;
  const sockets = await io.in(room).fetchSockets();
  let t;
  try {
    t = tables.getTable(id);
  } catch {
    broadcastRemoved(id);
    return;
  }
  const summary = tables.safeSummary(t);
  if (!summary) { // le jeu plante sur cette partie : elle est mise de côté, la salle est prévenue
    clearTimeout(timers.get(id));
    timers.delete(id);
    broadcastRemoved(id);
    return;
  }
  const watchers = new Set(sockets.map((s) => s.data.userId).filter((uid) => !t.seats.includes(uid))).size;
  const views = new Map();
  for (const s of sockets) {
    const uid = s.data.userId;
    try {
      if (!views.has(uid)) views.set(uid, tables.viewFor(t, uid));
      s.emit('table', { table: summary, view: views.get(uid), watchers, events, serverNow: Date.now() });
    } catch (err) {
      console.error(err);
    }
  }
  broadcastSummary(summary);
}

// Minuteur du jeu (temps pour jouer, débat, vote…) : à l'échéance, le jeu applique son timeout().
function schedule(t) {
  clearTimeout(timers.get(t.id));
  timers.delete(t.id);
  if (!t || t.status !== 'playing' || !tables.tableExists(t.id)) return;
  const { deadline } = tables.statusOf(t);
  if (!deadline) return;
  const delay = Math.min(Math.max(0, deadline - Date.now()), 2 ** 31 - 1);
  timers.set(t.id, setTimeout(() => {
    timers.delete(t.id);
    try {
      const res = tables.runTimeout(t.id);
      if (!res) return;
      schedule(res.table);
      pushTable(t.id, res.events);
    } catch (err) {
      console.error(err);
    }
  }, delay));
}

function changed(t, id = t?.id, events) {
  if (t) schedule(t);
  else {
    clearTimeout(timers.get(id));
    timers.delete(id);
  }
  return pushTable(id, events);
}

// Un compte disparaît (supprimé ou bloqué) : on libère ses places dans les salons.
export function dropUserFromTables(userId, options) {
  for (const { id, table } of tables.dropUser(userId, options)) changed(table, id);
}

export function purgeTables() {
  const removed = tables.purgeStaleTables();
  for (const id of removed) changed(null, id);
  return removed.length;
}

// Un coup est un petit objet : au-delà de 8 niveaux d'imbrication, ce n'est pas un joueur. Refusé avant d'atteindre les règles.
function tooDeep(value, left = 8) {
  if (value === null || typeof value !== 'object') return false;
  if (left === 0) return true;
  for (const v of Array.isArray(value) ? value : Object.values(value)) if (tooDeep(v, left - 1)) return true;
  return false;
}

export function registerPlay(socket, handler) {
  const tableId = (id) => {
    const n = Number(id);
    if (!Number.isInteger(n)) throw new ChatError('Partie introuvable.');
    return n;
  };

  // Les spectateurs qui partent : on met à jour le nombre de personnes qui regardent.
  socket.on('disconnecting', () => {
    const rooms = [...socket.rooms].filter((r) => r.startsWith('t:'));
    if (rooms.length) setTimeout(() => rooms.forEach((r) => tables.tableExists(r.slice(2)) && pushTable(Number(r.slice(2)))), 50);
  });

  socket.on('table:create', handler(socket, ({ game }, me) => {
    const t = tables.createTable(String(game), me.id);
    for (const id of tables.trimFinished(me.id)) changed(null, id);
    changed(t);
    return { id: t.id };
  }, { event: 'table:create', muteBlocked: true }));

  socket.on('table:watch', handler(socket, async ({ id }) => {
    const t = tables.getTable(tableId(id));
    await socket.join(`t:${t.id}`);
    pushTable(t.id);
    return {};
  }));

  socket.on('table:unwatch', handler(socket, async ({ id }) => {
    const n = tableId(id);
    await socket.leave(`t:${n}`);
    if (tables.tableExists(n)) pushTable(n);
    return {};
  }));

  socket.on('table:join', handler(socket, ({ id }, me) => {
    changed(tables.joinTable(tableId(id), me.id));
    return {};
  }));

  socket.on('table:leave', handler(socket, ({ id }, me) => {
    const n = tableId(id);
    changed(tables.leaveTable(n, me.id), n);
    return {};
  }));

  socket.on('table:kick', handler(socket, ({ id, userId: target }, me) => {
    const n = tableId(id);
    changed(tables.kickPlayer(n, me.id, Number(target)));
    io.to(`u:${Number(target)}`).emit('table:kicked', { id: n });
    return {};
  }));

  socket.on('table:options', handler(socket, ({ id, options }, me) => {
    changed(tables.setOptions(tableId(id), me.id, options && typeof options === 'object' ? options : {}));
    return {};
  }));

  socket.on('table:start', handler(socket, ({ id }, me) => {
    changed(tables.startTable(tableId(id), me.id));
    return {};
  }));

  socket.on('table:move', handler(socket, ({ id, action }, me) => {
    if (tooDeep(action)) throw new ChatError('Ce coup est illisible.');
    const { table, events } = tables.playMove(tableId(id), me.id, action);
    changed(table, table.id, events);
    return {};
  }, { generalLimit: false, ownLimit: tooFast })); // les coups ont leur propre limite ; un refus compte pour couper la prise

  socket.on('table:restart', handler(socket, ({ id }, me) => {
    const t = tables.getTable(tableId(id));
    changed(tables.restartTable(t.id, me.id, { hostAway: hostAway(t) }));
    return {};
  }));

  socket.on('table:close', handler(socket, ({ id }, me) => {
    const n = tableId(id);
    const t = tables.getTable(n);
    tables.closeTable(n, me);
    if (t.hostId !== me.id) logMod(me, 'a fermé la partie de', { target: getUser(t.hostId)?.pseudo ?? '?', detail: catalog().find((g) => g.id === t.game)?.name ?? t.game });
    changed(null, n);
    return {};
  }));

  // Invitation : une notification chez chaque personne choisie, avec un bouton pour rejoindre.
  socket.on('table:invite', handler(socket, ({ id, userIds }, me) => {
    const t = tables.getTable(tableId(id));
    if (!t.seats.includes(me.id)) throw new ChatError('Rejoins la partie pour inviter.');
    const targets = [...new Set([].concat(userIds || []).slice(0, 200).map(Number))] // coupée avant d'être vérifiée : une liste géante ne coûte rien
      .filter((uid) => uid !== me.id && getUser(uid) && !getUser(uid).banned)
      .slice(0, 40);
    if (!targets.length) throw new ChatError('Choisis au moins une personne.');
    for (const uid of targets) io.to(`u:${uid}`).emit('invite', { tableId: t.id, game: t.game, from: me.id });
    return { sent: targets.length };
  }, { event: 'table:invite', muteBlocked: true }));
}
