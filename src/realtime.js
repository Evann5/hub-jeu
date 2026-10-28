// Temps réel avec Socket.IO : présence, messages, réactions, frappe et actions des admins.
// L'état « qui est en ligne » vit en mémoire : l'appli doit tourner en une seule instance.
import { Server } from 'socket.io';
import { db, getSetting, setSetting } from './db.js';
import { config } from './config.js';
import { COLORS, AVATARS, LIMITS } from './options.js';
import {
  COOKIE, readCookie, userFromToken, getUser, publicUser, classCode, hashPassword, deleteUserSessions,
} from './auth.js';
import * as chat from './chat.js';

let io;
const online = new Map(); // userId -> nombre de connexions ouvertes
const sendTimes = new Map(); // userId -> horodatages des derniers envois

function allUsers() {
  return db.prepare('SELECT * FROM users WHERE banned = 0 ORDER BY pseudo COLLATE NOCASE').all().map(publicUser);
}

// Envoie un événement à toutes les personnes concernées par un scope.
function emitToScope(scope, event, payload) {
  if (scope.startsWith('dm:')) {
    const [a, b] = scope.split(':').slice(1);
    io.to(`u:${a}`).to(`u:${b}`).emit(event, payload);
  } else {
    io.to('membres').emit(event, payload);
  }
}

function broadcastPresence() {
  io.to('membres').emit('presence', [...online.keys()]);
}

export function broadcastUser(user) {
  io?.to('membres').emit('user', publicUser(user));
}

export function broadcastChannels() {
  io?.to('membres').emit('channels', chat.listChannels());
}

// Ferme toutes les connexions d'une personne (bannie, compte supprimé, déconnectée).
export function disconnectUser(userId, reason) {
  if (!io) return;
  io.to(`u:${userId}`).emit('kicked', reason);
  io.in(`u:${userId}`).disconnectSockets(true);
}

export function removeUser(userId) {
  io?.to('membres').emit('user:removed', userId);
}

function rateLimited(userId) {
  const now = Date.now();
  const times = (sendTimes.get(userId) || []).filter((t) => now - t < 5000);
  times.push(now);
  sendTimes.set(userId, times);
  return times.length > 5;
}

// Enveloppe un gestionnaire : relit l'utilisateur à jour, transmet les erreurs en français.
function handler(socket, fn, { admin = false } = {}) {
  return async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const me = getUser(socket.data.userId);
      if (!me || me.banned) {
        socket.disconnect(true);
        return;
      }
      if (admin && me.role !== 'admin') throw new chat.ChatError('Réservé aux admins.');
      reply({ ok: true, ...(await fn(payload ?? {}, me)) });
    } catch (err) {
      if (!(err instanceof chat.ChatError)) console.error(err);
      reply({ ok: false, error: err instanceof chat.ChatError ? err.message : 'Erreur du serveur, réessaie dans un instant.' });
    }
  };
}

function targetUser(userId, me) {
  const user = getUser(Number(userId));
  if (!user) throw new chat.ChatError("Cette personne n'a plus de compte.");
  if (user.id === me.id) throw new chat.ChatError('Tu ne peux pas faire ça sur ton propre compte.');
  return user;
}

export function attachRealtime(httpServer) {
  io = new Server(httpServer, {
    path: `${config.basePath}/socket.io`,
    serveClient: true,
    // Refuse les connexions venues d'un autre site.
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      callback(null, !origin || new URL(origin).host === req.headers.host);
    },
  });

  io.use((socket, next) => {
    const user = userFromToken(readCookie(socket.request.headers.cookie, COOKIE));
    if (!user) return next(new Error('non-connecte'));
    socket.data.userId = user.id;
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const me = getUser(userId);
    socket.join(['membres', `u:${userId}`]);
    online.set(userId, (online.get(userId) || 0) + 1);

    socket.emit('state', {
      me: publicUser(me),
      mustChangePassword: Boolean(me.must_change_password),
      mutedUntil: me.muted_until,
      users: allUsers(),
      channels: chat.listChannels(),
      dms: chat.dmList(userId),
      unread: chat.unreadCounts(userId),
      online: [...online.keys()],
    });
    broadcastPresence();

    socket.on('disconnect', () => {
      const n = (online.get(userId) || 1) - 1;
      if (n <= 0) online.delete(userId);
      else online.set(userId, n);
      broadcastPresence();
    });

    socket.on('history', handler(socket, ({ scope, before }, me) => {
      chat.checkScope(scope, me.id);
      return chat.history(scope, before);
    }));

    socket.on('send', handler(socket, ({ scope, body }, me) => {
      chat.checkScope(scope, me.id);
      if (me.muted_until > Date.now()) {
        const until = new Date(me.muted_until).toLocaleString('fr-FR', {
          timeZone: 'Europe/Paris', weekday: 'long', hour: '2-digit', minute: '2-digit',
        });
        throw new chat.ChatError(`Un admin t'a mis en sourdine jusqu'à ${until}.`);
      }
      if (rateLimited(me.id)) throw new chat.ChatError('Doucement : attends quelques secondes avant le prochain message.');
      const message = chat.postMessage(scope, me.id, body);
      emitToScope(scope, 'message', message);
      return { message };
    }));

    socket.on('react', handler(socket, ({ messageId, emoji }, me) => {
      const before = chat.getMessage(messageId);
      if (!before) throw new chat.ChatError("Ce message n'existe plus.");
      chat.checkScope(before.scope, me.id);
      const message = chat.toggleReaction(messageId, me.id, emoji);
      emitToScope(message.scope, 'message:update', message);
      return {};
    }));

    socket.on('read', handler(socket, ({ scope, lastId }, me) => {
      chat.checkScope(scope, me.id);
      chat.markRead(me.id, scope, lastId);
      return {};
    }));

    socket.on('typing', handler(socket, ({ scope }, me) => {
      chat.checkScope(scope, me.id);
      const payload = { scope, userId: me.id };
      if (scope.startsWith('dm:')) {
        const [a, b] = scope.split(':').slice(1).map(Number);
        socket.to(`u:${a === me.id ? b : a}`).emit('typing', payload);
      } else {
        socket.to('membres').emit('typing', payload);
      }
      return {};
    }));

    socket.on('profile', handler(socket, ({ avatar, color, bio }, me) => {
      if (!AVATARS.includes(avatar)) throw new chat.ChatError('Avatar inconnu.');
      if (!Object.hasOwn(COLORS, color)) throw new chat.ChatError('Couleur inconnue.');
      const cleanBio = String(bio ?? '').trim();
      if (cleanBio.length > LIMITS.bioMax) throw new chat.ChatError(`La bio dépasse ${LIMITS.bioMax} caractères.`);
      db.prepare('UPDATE users SET avatar = ?, color = ?, bio = ? WHERE id = ?').run(avatar, color, cleanBio, me.id);
      broadcastUser(getUser(me.id));
      return {};
    }));

    // ——— Admins ———

    socket.on('admin:deleteMessage', handler(socket, ({ id }) => {
      const msg = chat.deleteMessage(id);
      emitToScope(msg.scope, 'message:deleted', { id: msg.id, scope: msg.scope });
      return {};
    }, { admin: true }));

    socket.on('admin:mute', handler(socket, ({ userId, minutes }, me) => {
      const user = targetUser(userId, me);
      const m = Number(minutes);
      if (!(m >= 0 && m <= 60 * 24 * 30)) throw new chat.ChatError('Durée invalide.');
      const until = m === 0 ? 0 : Date.now() + m * 60_000;
      db.prepare('UPDATE users SET muted_until = ? WHERE id = ?').run(until, user.id);
      io.to(`u:${user.id}`).emit('muted', until);
      return { mutedUntil: until };
    }, { admin: true }));

    socket.on('admin:ban', handler(socket, ({ userId, banned }, me) => {
      const user = targetUser(userId, me);
      db.prepare('UPDATE users SET banned = ? WHERE id = ?').run(banned ? 1 : 0, user.id);
      if (banned) {
        deleteUserSessions(user.id);
        disconnectUser(user.id, 'Un admin a bloqué ton compte.');
        removeUser(user.id);
      } else {
        broadcastUser(getUser(user.id));
      }
      return {};
    }, { admin: true }));

    socket.on('admin:bannedList', handler(socket, () => ({
      users: db.prepare('SELECT * FROM users WHERE banned = 1 ORDER BY pseudo COLLATE NOCASE').all().map(publicUser),
    }), { admin: true }));

    socket.on('admin:resetPassword', handler(socket, ({ userId }, me) => {
      const user = targetUser(userId, me);
      // Mot de passe provisoire facile à dicter : trois syllabes et deux chiffres.
      const syl = ['ba', 'de', 'ki', 'lo', 'mu', 'na', 'pi', 'ro', 'su', 'ta', 'vo', 'ze'];
      const pick = () => syl[Math.floor(Math.random() * syl.length)];
      const temp = `${pick()}${pick()}${pick()}${pick()}-${Math.floor(10 + Math.random() * 90)}`;
      db.prepare('UPDATE users SET pass_hash = ?, must_change_password = 1 WHERE id = ?').run(hashPassword(temp), user.id);
      deleteUserSessions(user.id);
      disconnectUser(user.id, 'Ton mot de passe a été réinitialisé : reconnecte-toi avec le mot de passe provisoire.');
      return { tempPassword: temp };
    }, { admin: true }));

    socket.on('admin:setRole', handler(socket, ({ userId, role }, me) => {
      const user = targetUser(userId, me);
      if (!['membre', 'admin'].includes(role)) throw new chat.ChatError('Rôle inconnu.');
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
      broadcastUser(getUser(user.id));
      return {};
    }, { admin: true }));

    socket.on('admin:getClassCode', handler(socket, () => ({ classCode: classCode() }), { admin: true }));

    socket.on('admin:setClassCode', handler(socket, ({ code }) => {
      const clean = String(code ?? '').trim();
      if (clean.length < 4 || clean.length > 40) throw new chat.ChatError('Le code doit faire de 4 à 40 caractères.');
      setSetting('class_code', clean);
      return { classCode: getSetting('class_code') };
    }, { admin: true }));

    socket.on('admin:createChannel', handler(socket, (input) => {
      chat.createChannel(input);
      broadcastChannels();
      return {};
    }, { admin: true }));

    socket.on('admin:updateChannel', handler(socket, ({ id, name, topic }) => {
      chat.updateChannel(id, { name, topic });
      broadcastChannels();
      return {};
    }, { admin: true }));

    socket.on('admin:deleteChannel', handler(socket, ({ id }) => {
      chat.deleteChannel(id);
      broadcastChannels();
      return {};
    }, { admin: true }));
  });

  return io;
}
