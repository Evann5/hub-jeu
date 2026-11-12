// Temps réel avec Socket.IO : présence, messages, réactions, frappe, tables de jeu (play.js) et actions des admins.
// L'état « qui est en ligne » vit en mémoire : l'appli doit tourner en une seule instance.
import { randomInt } from 'node:crypto';
import { Server } from 'socket.io';
import { db, getSetting, setSetting } from './db.js';
import { config } from './config.js';
import { COLORS, AVATARS, LIMITS } from './options.js';
import {
  COOKIE, readCookie, userFromToken, getUser, publicUser, classCode, hashPassword, deleteUserSessions, tokenHash, ownerId, TEMP_PASSWORD_MS,
} from './auth.js';
import { createEventLimiter, sameOrigin } from './securite.js';
import { codeVersion } from './version.js';
import * as chat from './chat.js';
import * as roles from './roles.js';
import { logMod, recentMod } from './journal.js';
import { initPlay, registerPlay, gamesCatalog, tableList, dropUserFromTables } from './play.js';
import { tableExists, getTable, statusOf as tableStatus } from './tables.js';

const VERSION = codeVersion(config.root); // envoyée à chaque connexion : une page ouverte avant une mise à jour le voit
let io;
const online = new Map(); // userId -> nombre de connexions ouvertes
const sendTimes = new Map(); // userId -> horodatages des derniers envois

const DISK_FULL = 'Le serveur n’a plus de place pour enregistrer. Préviens un admin : rien ne sera gardé tant que ce n’est pas réglé.';
const MAX_SOCKETS_PER_USER = 5; // onglets et appareils ouverts en même temps, par compte
const MIN_CLASS_CODE = 10;
// Limite générale : 60 événements par 5 s et par personne (tous appareils confondus). Les coups de jeu ont la leur (play.js).
const generalLimit = createEventLimiter(60, 5000);
const hourlyMessages = createEventLimiter(300, 3600_000); // une discussion animée passe, remplir le disque non
const REFUSED_MAX = 500; // refusés d'affilée : ce n'est plus un humain, on coupe
// Limites plus strictes pour ce qui ne sert jamais en rafale (chaque minute ou chaque 5 s, par personne).
const strictLimits = {
  typing: createEventLimiter(10, 5000),
  profile: createEventLimiter(5, 60_000),
  'table:create': createEventLimiter(6, 60_000),
  'table:invite': createEventLimiter(10, 60_000),
  'table:watch': createEventLimiter(40, 60_000), // chaque entrée diffuse l'état de la table à ceux qui la regardent
};

function allUsers() {
  return db.prepare('SELECT * FROM users WHERE banned = 0 ORDER BY pseudo COLLATE NOCASE').all().map(publicUser);
}

// Envoie un événement à toutes les personnes concernées par un scope.
function emitToScope(scope, event, payload) {
  if (scope.startsWith('dm:')) {
    const [a, b] = scope.split(':').slice(1);
    io.to(`u:${a}`).to(`u:${b}`).emit(event, payload);
  } else if (scope.startsWith('t:')) {
    io.to(scope).emit(event, payload); // chat d'une table : les personnes qui la regardent
  } else {
    io.to(chat.isStaffChannel(scope) ? 'equipe' : 'membres').emit(event, payload); // un canal d'équipe ne sort pas de l'équipe
  }
}

function broadcastPresence() {
  io.to('membres').emit('presence', [...online.keys()]);
}

export function broadcastUser(user) {
  io?.to('membres').emit('user', publicUser(user));
}

// Les canaux : la liste complète pour l'équipe (salle « equipe »), sans les canaux d'équipe pour les autres.
export function broadcastChannels() {
  if (!io) return;
  const all = chat.listChannels();
  io.to('equipe').emit('channels', all);
  io.to('membres').except('equipe').emit('channels', all.filter((c) => !c.staffOnly));
}

// Après un changement de niveau : entrer dans la salle de l'équipe ou en sortir, et recevoir la bonne liste de canaux.
async function syncStaffRoom(user) {
  const staff = isStaff(user);
  for (const s of await io.in(`u:${user.id}`).fetchSockets()) {
    if (staff) s.join('equipe');
    else s.leave('equipe');
  }
  io.to(`u:${user.id}`).emit('channels', chat.listChannels(user.id));
}

// Un message effacé, pour le journal : seulement l'endroit, jamais le texte (sinon effacer puis lire le journal
// permettrait de lire ce qu'on n'avait pas le droit de lire).
function describeMessage(msg) {
  return msg.scope.startsWith('c:') ? `#${chat.listChannels().find((c) => `c:${c.id}` === msg.scope)?.name ?? '?'}` : 'chat d’une partie';
}

// Ferme toutes les connexions d'une personne (bannie, compte supprimé, déconnectée).
export function disconnectUser(userId, reason) {
  if (!io) return;
  io.to(`u:${userId}`).emit('kicked', reason);
  io.in(`u:${userId}`).disconnectSockets(true);
}

// Ferme les connexions d'une personne sur ses autres appareils : celles de la session keepToken restent ouvertes.
export function disconnectOtherSessions(userId, keepToken, reason) {
  if (!io) return;
  const keep = tokenHash(keepToken);
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.userId !== userId || socket.data.tokenHash === keep) continue;
    socket.emit('kicked', reason);
    socket.disconnect(true);
  }
}

// Ferme les connexions en direct d'une seule session (déconnexion depuis un appareil), pas celles des autres appareils.
export function disconnectSession(token) {
  if (!io || !token) return;
  const hash = tokenHash(token);
  for (const socket of io.sockets.sockets.values()) if (socket.data.tokenHash === hash) socket.disconnect(true);
}

// deleted : le compte n'existe plus (il quitte aussi les parties en cours) ; sinon il est seulement bloqué.
export function removeUser(userId, { deleted = false } = {}) {
  io?.to('membres').emit('user:removed', userId);
  if (io) dropUserFromTables(userId, { deleted });
}

function rateLimited(userId) {
  const now = Date.now();
  const times = (sendTimes.get(userId) || []).filter((t) => now - t < 5000);
  if (times.length >= 5) { // un envoi refusé ne prolonge pas l'attente
    sendTimes.set(userId, times);
    return true;
  }
  times.push(now);
  sendTimes.set(userId, times);
  return false;
}

function assertNotMuted(me) {
  if (me.muted_until > Date.now()) {
    // Heure de Paris ; le jour même, l'heure seule (« jusqu'à 12:36 »).
    const day = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
    const until = new Date(me.muted_until).toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', ...(day(me.muted_until) === day(Date.now()) ? {} : { weekday: 'long' }),
    });
    throw new chat.ChatError(`Tu es en sourdine jusqu’à ${until}.`);
  }
}

// Enveloppe un gestionnaire : limite le rythme, relit l'utilisateur à jour, transmet les erreurs en français.
// Options : admin (réservé aux admins), event (limite stricte nommée dans strictLimits), muteBlocked (refusé en sourdine),
// generalLimit: false (l'événement a sa propre limite, comme les coups de jeu).
function handler(socket, fn, { admin = false, modo = false, event = null, muteBlocked = false, generalLimit: general = true, ownLimit = null } = {}) {
  return async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const userId = socket.data.userId;
      if ((general && generalLimit.hit(userId)) || (event && strictLimits[event].hit(userId)) || ownLimit?.(userId)) {
        socket.data.refused = (socket.data.refused || 0) + 1;
        if (socket.data.refused > REFUSED_MAX) {
          socket.disconnect(true);
          return;
        }
        throw new chat.ChatError('Doucement : trop d’actions d’un coup, réessaie dans quelques secondes.');
      }
      socket.data.refused = 0;
      const me = getUser(userId);
      if (!me || me.banned) {
        socket.disconnect(true);
        return;
      }
      if (me.must_change_password) throw new chat.ChatError('Choisis d’abord ton nouveau mot de passe.'); // sinon le mot de passe provisoire resterait valable
      if (admin && me.role !== 'admin') throw new chat.ChatError('Réservé aux admins.');
      if (modo && !isStaff(me)) throw new chat.ChatError('Réservé aux modérateurs et aux admins.');
      if (muteBlocked) assertNotMuted(me);
      // Pas d'attente inutile : un gestionnaire sans promesse répond tout de suite. Sinon, quand deux demandes de la même personne arrivent
      // ensemble (historique puis envoi), la diffusion de la seconde partirait avant la réponse de la première.
      const result = fn(payload ?? {}, me);
      reply({ ok: true, ...(result instanceof Promise ? await result : result) });
    } catch (err) {
      if (!(err instanceof chat.ChatError)) console.error(err);
      // Disque plein : rien n'est perdu de ce qui était déjà écrit, mais plus rien ne s'enregistre tant qu'on n'a pas fait de place.
      const full = /database or disk is full/i.test(String(err?.message));
      reply({ ok: false, error: err instanceof chat.ChatError ? err.message : full ? DISK_FULL : 'Erreur du serveur, réessaie dans un instant.' });
    }
  };
}

// Chat d'une partie : le jeu peut faire taire des joueurs (les morts des Loups-garous connaissent les rôles). Vaut pour écrire et pour réagir.
function assertNotSilenced(scope, me) {
  if (!scope.startsWith('t:')) return;
  const t = tableExists(scope.slice(2)) ? getTable(scope.slice(2)) : null;
  if (t && tableStatus(t).silent.includes(me.id)) throw new chat.ChatError('Tu es éliminé : tu pourras écrire aux joueurs à la fin de la partie.');
}

function targetUser(userId, me) {
  const user = getUser(Number(userId));
  if (!user) throw new chat.ChatError("Cette personne n’a plus de compte.");
  if (user.id === me.id) throw new chat.ChatError('Tu ne peux pas faire ça sur ton propre compte.');
  return user;
}

// L'équipe : modérateurs et admins. Un modérateur n'agit que sur les membres, jamais sur un autre modo ou un admin.
const isStaff = (u) => u.role === 'modo' || u.role === 'admin';
function withinReach(user, me) {
  if (me.role === 'modo' && user.role !== 'membre') throw new chat.ChatError('Un modérateur n’agit que sur les membres.');
  return user;
}

export function broadcastRoles() {
  io?.to('membres').emit('roles', roles.listRoles());
}

// Le propriétaire du hub (premier admin créé) ne peut être touché par aucun autre admin.
function notOwner(user, what) {
  if (user.id === ownerId()) throw new chat.ChatError(`Tu ne peux pas ${what} (le premier admin) : aucun autre admin ne peut le faire.`);
  return user;
}

export function attachRealtime(httpServer) {
  io = new Server(httpServer, {
    path: `${config.basePath}/socket.io`,
    serveClient: true,
    maxHttpBufferSize: 64 * 1024, // un message de 64 ko au plus (la valeur par défaut est 1 Mo)
    // Refuse les connexions venues d'un autre site (ou d'une origine illisible).
    allowRequest: (req, callback) => callback(null, sameOrigin(req.headers.origin, req.headers.host)),
  });

  initPlay(io);

  io.use((socket, next) => {
    const user = userFromToken(readCookie(socket.request.headers.cookie, COOKIE));
    if (!user) return next(new Error('non-connecte'));
    // Trop de connexions pour ce compte : la plus ancienne cède la place à la nouvelle. Après un wifi qui saute, les anciennes connexions
    // restent comptées jusqu'à 45 s sans que le serveur sache qu'elles sont mortes : refuser la nouvelle laissait l'élève dehors.
    if ((online.get(user.id) || 0) >= MAX_SOCKETS_PER_USER) {
      let oldest = null;
      for (const s of io.sockets.sockets.values()) {
        if (s.data.userId === user.id && (!oldest || s.handshake.issued < oldest.handshake.issued)) oldest = s;
      }
      oldest?.emit('replaced'); // un vrai onglet l'affiche et ne se reconnecte pas tout seul ; une connexion morte ne reçoit rien
      oldest?.disconnect(true);
    }
    socket.data.userId = user.id;
    socket.data.tokenHash = tokenHash(readCookie(socket.request.headers.cookie, COOKIE));
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const me = getUser(userId);
    socket.join(['membres', `u:${userId}`]);
    if (isStaff(me)) socket.join('equipe');
    const wasOnline = online.has(userId);
    online.set(userId, (online.get(userId) || 0) + 1);

    socket.emit('state', {
      me: publicUser(me),
      mustChangePassword: Boolean(me.must_change_password),
      mutedUntil: me.muted_until,
      users: allUsers(),
      channels: chat.listChannels(userId),
      dms: chat.dmList(userId),
      unread: chat.unreadCounts(userId),
      online: [...online.keys()],
      games: gamesCatalog(),
      tables: tableList(),
      roles: roles.listRoles(),
      version: VERSION,
    });
    if (!wasOnline) broadcastPresence(); // un onglet de plus ne change rien pour les autres

    socket.on('disconnect', () => {
      const n = (online.get(userId) || 1) - 1;
      if (n > 0) {
        online.set(userId, n);
        return;
      }
      online.delete(userId);
      broadcastPresence();
    });

    socket.on('history', handler(socket, ({ scope, before }, me) => {
      chat.checkScope(scope, me.id);
      return chat.history(scope, before);
    }));

    socket.on('send', handler(socket, ({ scope, body }, me) => {
      chat.checkScope(scope, me.id);
      assertNotMuted(me);
      if (rateLimited(me.id)) throw new chat.ChatError('Doucement : attends quelques secondes avant le prochain message.');
      if (hourlyMessages.hit(me.id)) throw new chat.ChatError('Tu as envoyé beaucoup de messages : réessaie dans un moment.');
      assertNotSilenced(scope, me);
      const message = chat.postMessage(scope, me.id, body);
      emitToScope(scope, 'message', message);
      return { message };
    }));

    socket.on('react', handler(socket, ({ messageId, emoji }, me) => {
      const before = chat.getMessage(messageId);
      if (!before) throw new chat.ChatError("Ce message n’existe plus.");
      chat.checkScope(before.scope, me.id);
      assertNotMuted(me);
      assertNotSilenced(before.scope, me); // une réaction sous une question (« c'est Léa ? ») serait une réponse
      const message = chat.toggleReaction(messageId, me.id, emoji);
      emitToScope(message.scope, 'message:update', message);
      return {};
    }));

    socket.on('read', handler(socket, ({ scope, lastId }, me) => {
      chat.checkScope(scope, me.id);
      chat.markRead(me.id, scope, lastId);
      socket.to(`u:${me.id}`).emit('read', { scope, lastId: Number(lastId) || 0 }); // ses autres onglets et appareils
      return {};
    }));

    socket.on('typing', handler(socket, ({ scope }, me) => {
      chat.checkScope(scope, me.id);
      const payload = { scope, userId: me.id };
      if (scope.startsWith('dm:')) {
        const [a, b] = scope.split(':').slice(1).map(Number);
        socket.to(`u:${a === me.id ? b : a}`).emit('typing', payload);
      } else if (scope.startsWith('t:')) {
        socket.to(scope).emit('typing', payload);
      } else {
        socket.to(chat.isStaffChannel(scope) ? 'equipe' : 'membres').emit('typing', payload);
      }
      return {};
    }, { event: 'typing' }));

    socket.on('profile', handler(socket, ({ avatar, color, bio }, me) => {
      if (!AVATARS.includes(avatar)) throw new chat.ChatError('Avatar inconnu.');
      if (!Object.hasOwn(COLORS, color)) throw new chat.ChatError('Couleur inconnue.');
      const cleanBio = String(bio ?? '').trim();
      if (cleanBio.length > LIMITS.bioMax) throw new chat.ChatError(`La bio dépasse ${LIMITS.bioMax} caractères.`);
      if (cleanBio !== me.bio) assertNotMuted(me); // en sourdine, on peut changer d'avatar mais pas écrire une nouvelle bio
      db.prepare('UPDATE users SET avatar = ?, color = ?, bio = ? WHERE id = ?').run(avatar, color, cleanBio, me.id);
      broadcastUser(getUser(me.id));
      return {};
    }, { event: 'profile' }));

    registerPlay(socket, handler);

    // ——— Admins ———

    socket.on('admin:deleteMessage', handler(socket, ({ id }, me) => {
      // Un modérateur n'efface que les messages des membres, dans les canaux et les chats de partie : jamais un message privé.
      if (me.role === 'modo') {
        const target = chat.getMessage(id);
        if (!target) throw new chat.ChatError('Ce message n’existe plus.');
        if (!/^(c|t):/.test(target.scope)) throw new chat.ChatError('Un modérateur n’agit pas sur les messages privés.');
        const author = getUser(target.userId);
        if (author) withinReach(author, me);
      }
      // Personne n'efface un message privé dont il ne fait pas partie (admin compris).
      const found = chat.getMessage(id);
      if (found?.scope.startsWith('dm:')) chat.checkScope(found.scope, me.id);
      const msg = chat.deleteMessage(id);
      emitToScope(msg.scope, 'message:deleted', { id: msg.id, scope: msg.scope });
      if (msg.userId !== me.id && !msg.scope.startsWith('dm:')) logMod(me, 'a effacé un message de', { target: getUser(msg.userId)?.pseudo ?? 'compte supprimé', detail: describeMessage(msg) });
      return {};
    }, { modo: true }));

    socket.on('admin:mute', handler(socket, ({ userId, minutes }, me) => {
      const user = withinReach(notOwner(targetUser(userId, me), 'mettre en sourdine le propriétaire du hub'), me);
      const m = Number(minutes);
      if (!(m >= 0 && m <= 60 * 24 * 30)) throw new chat.ChatError('Durée invalide.');
      const until = m === 0 ? 0 : Date.now() + m * 60_000;
      db.prepare('UPDATE users SET muted_until = ? WHERE id = ?').run(until, user.id);
      io.to(`u:${user.id}`).emit('muted', until);
      logMod(me, m === 0 ? 'a levé la sourdine de' : 'a mis en sourdine', { target: user.pseudo, detail: m === 0 ? '' : m >= 1440 ? `${Math.round(m / 1440)} j` : m >= 60 ? `${Math.round(m / 60)} h` : `${m} min` });
      return { mutedUntil: until };
    }, { modo: true }));

    socket.on('admin:ban', handler(socket, ({ userId, banned }, me) => {
      const user = notOwner(targetUser(userId, me), 'bloquer le propriétaire du hub');
      db.prepare('UPDATE users SET banned = ? WHERE id = ?').run(banned ? 1 : 0, user.id);
      logMod(me, banned ? 'a bloqué' : 'a débloqué', { target: user.pseudo });
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

    socket.on('admin:resetPassword', handler(socket, async ({ userId }, me) => {
      const user = notOwner(targetUser(userId, me), 'réinitialiser le mot de passe du propriétaire du hub');
      // Mot de passe provisoire facile à dicter : quatre syllabes et deux chiffres, tirés avec un hasard sûr.
      const syl = ['ba', 'de', 'ki', 'lo', 'mu', 'na', 'pi', 'ro', 'su', 'ta', 'vo', 'ze'];
      const pick = () => syl[randomInt(syl.length)];
      const temp = `${pick()}${pick()}${pick()}${pick()}-${randomInt(10, 100)}`;
      db.prepare('UPDATE users SET pass_hash = ?, must_change_password = 1, temp_until = ? WHERE id = ?').run(await hashPassword(temp), Date.now() + TEMP_PASSWORD_MS, user.id);
      deleteUserSessions(user.id);
      disconnectUser(user.id, 'Ton mot de passe a été réinitialisé : reconnecte-toi avec le mot de passe provisoire.');
      logMod(me, 'a réinitialisé le mot de passe de', { target: user.pseudo });
      return { tempPassword: temp };
    }, { admin: true }));

    socket.on('admin:setRole', handler(socket, ({ userId, role }, me) => {
      const user = notOwner(targetUser(userId, me), 'changer le rôle du propriétaire du hub');
      if (!['membre', 'modo', 'admin'].includes(role)) throw new chat.ChatError('Rôle inconnu.');
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
      broadcastUser(getUser(user.id));
      syncStaffRoom(getUser(user.id)).catch((err) => console.error(err));
      logMod(me, 'a changé le niveau de', { target: user.pseudo, detail: { membre: 'Membre', modo: 'Modérateur', admin: 'Admin' }[role] });
      return {};
    }, { admin: true }));

    socket.on('admin:getClassCode', handler(socket, () => ({ classCode: classCode() }), { admin: true }));

    socket.on('admin:setClassCode', handler(socket, ({ code }, me) => {
      const clean = String(code ?? '').trim();
      if (clean.length < MIN_CLASS_CODE || clean.length > 40) {
        throw new chat.ChatError(`Le code doit faire de ${MIN_CLASS_CODE} à 40 caractères (il protège l’inscription : choisis-en un difficile à deviner).`);
      }
      setSetting('class_code', clean);
      logMod(me, 'a changé le code de la classe');
      return { classCode: getSetting('class_code') };
    }, { admin: true }));

    socket.on('admin:createChannel', handler(socket, (input, me) => {
      const name = chat.createChannel(input);
      broadcastChannels();
      logMod(me, 'a créé le canal', { target: `#${name}`, detail: input?.staffOnly ? 'réservé à l’équipe' : '' });
      return {};
    }, { admin: true }));

    socket.on('admin:updateChannel', handler(socket, ({ id, name, topic, staffOnly }, me) => {
      const wasStaff = Boolean(chat.listChannels().find((c) => c.id === Number(id))?.staffOnly);
      chat.updateChannel(id, { name, topic, staffOnly });
      broadcastChannels();
      const change = wasStaff && !staffOnly ? 'rendu public : ses anciens messages sont lisibles par toute la classe' : !wasStaff && staffOnly ? 'réservé à l’équipe' : '';
      logMod(me, 'a modifié le canal', { target: `#${chat.listChannels().find((c) => c.id === Number(id))?.name ?? '?'}`, detail: change });
      return {};
    }, { admin: true }));

    socket.on('admin:deleteChannel', handler(socket, ({ id }, me) => {
      const name = chat.listChannels().find((c) => c.id === Number(id))?.name;
      chat.deleteChannel(id);
      broadcastChannels();
      logMod(me, 'a supprimé le canal', { target: `#${name ?? '?'}` });
      return {};
    }, { admin: true }));

    // Rôles décoratifs : la liste change pour tout le monde ; les pseudos se recolorent chez chacun.
    const roleName = (id) => roles.listRoles().find((r) => r.id === Number(id))?.name ?? '?';
    for (const [event, fn, action] of [['admin:createRole', roles.createRole, 'a créé le rôle'], ['admin:updateRole', roles.updateRole, 'a modifié le rôle'], ['admin:moveRole', roles.moveRole, null], ['admin:deleteRole', roles.deleteRole, 'a supprimé le rôle']]) {
      socket.on(event, handler(socket, (input, me) => {
        const before = input?.id ? roleName(input.id) : null;
        fn(input);
        broadcastRoles();
        if (action) logMod(me, action, { target: before ?? String(input?.name ?? '').trim() });
        return {};
      }, { admin: true }));
    }

    socket.on('admin:setUserRoles', handler(socket, ({ userId, roleIds }, me) => {
      const user = getUser(Number(userId));
      if (!user || user.banned) throw new chat.ChatError('Cette personne n’a plus de compte.');
      roles.setUserRoles(user.id, roleIds);
      broadcastUser(getUser(user.id));
      logMod(me, 'a changé les rôles de', { target: user.pseudo, detail: roles.listRoles().filter((r) => [].concat(roleIds ?? []).map(Number).includes(r.id)).map((r) => r.name).join(', ') || 'aucun rôle' });
      return {};
    }, { admin: true }));

    socket.on('admin:modLog', handler(socket, () => ({ entries: recentMod() }), { admin: true }));
  });

  return io;
}
