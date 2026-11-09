// Tables de jeu en direct : chaque table a sa salle Socket.IO « t:<id> » (joueurs et spectateurs qui la regardent).
// Chaque personne reçoit sa propre vue du jeu : on ne voit jamais les cartes ou le mot des autres.
import * as tables from './tables.js';
import { catalog } from './games.js';
import { ChatError } from './chat.js';
import { getUser } from './auth.js';
import { logMod } from './journal.js';

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

export function initPlay(server) {
  io = server;
  setInterval(sweepLobbies, 30_000).unref();
  for (const t of tables.loadTables()) schedule(t);
}

export const gamesCatalog = catalog;
export const tableList = () => tables.allTables().map(tables.summary);

function broadcastTables() {
  io.to('membres').emit('tables', tableList());
}

// Envoie à chaque personne de la salle sa vue de la table, puis la liste des tables à tout le monde.
async function pushTable(id, events = []) {
  const room = `t:${id}`;
  const sockets = await io.in(room).fetchSockets();
  let t;
  try {
    t = tables.getTable(id);
  } catch {
    io.to(room).emit('table:closed', { id });
    broadcastTables();
    return;
  }
  const summary = tables.summary(t);
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
  broadcastTables();
}

// Minuteur du jeu (temps pour jouer, débat, vote…) : à l'échéance, le jeu applique son timeout().
function schedule(t) {
  clearTimeout(timers.get(t.id));
  timers.delete(t.id);
  if (!t || t.status !== 'playing') return;
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

export function registerPlay(socket, handler) {
  const tableId = (id) => {
    const n = Number(id);
    if (!Number.isInteger(n)) throw new ChatError('Partie introuvable.');
    return n;
  };

  // Les spectateurs qui partent : on met à jour le nombre de personnes qui regardent.
  socket.on('disconnecting', () => {
    const rooms = [...socket.rooms].filter((r) => r.startsWith('t:'));
    if (rooms.length) setTimeout(() => rooms.forEach((r) => pushTable(Number(r.slice(2)))), 50);
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
    const { table, events } = tables.playMove(tableId(id), me.id, action);
    changed(table, table.id, events);
    return {};
  }, { generalLimit: false, ownLimit: tooFast })); // les coups ont leur propre limite ; un refus compte pour couper la prise

  socket.on('table:restart', handler(socket, ({ id }, me) => {
    changed(tables.restartTable(tableId(id), me.id));
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
    const targets = [...new Set([].concat(userIds || []).map(Number))]
      .filter((uid) => uid !== me.id && getUser(uid) && !getUser(uid).banned)
      .slice(0, 40);
    if (!targets.length) throw new ChatError('Choisis au moins une personne.');
    for (const uid of targets) io.to(`u:${uid}`).emit('invite', { tableId: t.id, game: t.game, from: me.id });
    return { sent: targets.length };
  }, { event: 'table:invite', muteBlocked: true }));
}
