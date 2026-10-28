// Routes HTTP : inscription, connexion, mot de passe, suppression du compte.
import express from 'express';
import { db } from './db.js';
import { config } from './config.js';
import { COLORS, AVATARS, REACTIONS, LIMITS } from './options.js';
import * as auth from './auth.js';
import { markAllChannelsRead } from './chat.js';
import { broadcastUser, disconnectUser, removeUser } from './realtime.js';

export const api = express.Router();

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Les requêtes qui modifient quelque chose doivent venir de Hubuno lui-même, en JSON.
api.use((req, res, next) => {
  if (req.method === 'GET') return next();
  const origin = req.get('origin');
  if (origin && new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Requête refusée.' });
  if (!req.is('application/json')) return res.status(415).json({ error: 'Requête refusée.' });
  next();
});
api.use(express.json({ limit: '10kb' }));

function setSessionCookie(req, res, { token, expires }) {
  res.cookie(auth.COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    path: config.basePath || '/',
    expires: new Date(expires),
  });
}

function currentUser(req) {
  return auth.userFromToken(auth.readCookie(req.headers.cookie, auth.COOKIE));
}

function requireUser(req) {
  const user = currentUser(req);
  if (!user) throw new ApiError(401, 'Ta session a expiré : reconnecte-toi.');
  return user;
}

const str = (v) => (typeof v === 'string' ? v : '');

api.get('/options', (req, res) => {
  res.json({ colors: COLORS, avatars: AVATARS, reactions: REACTIONS, limits: LIMITS });
});

api.get('/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Non connecté.' });
  res.json({ user: auth.publicUser(user), mustChangePassword: Boolean(user.must_change_password) });
});

api.post('/register', (req, res) => {
  const pseudo = str(req.body.pseudo).trim();
  const password = str(req.body.password);
  const code = str(req.body.classCode).trim();

  const expected = auth.classCode();
  if (!expected) throw new ApiError(503, "Les inscriptions ne sont pas encore ouvertes : aucun code de classe n'est réglé.");
  if (code.toLowerCase() !== expected.toLowerCase()) {
    throw new ApiError(400, 'Ce code de classe ne marche pas. Demande-le à un admin.');
  }
  const pseudoError = auth.validatePseudo(pseudo);
  if (pseudoError) throw new ApiError(400, pseudoError);
  const passError = auth.validatePassword(password);
  if (passError) throw new ApiError(400, passError);
  if (req.body.acceptRules !== true) throw new ApiError(400, 'Coche la case pour accepter les règles de Hubuno.');
  if (auth.findUserByPseudo(pseudo)) throw new ApiError(409, 'Ce pseudo est déjà pris.');

  const user = auth.createUser({ pseudo, password });
  markAllChannelsRead(user.id);
  setSessionCookie(req, res, auth.createSession(user.id));
  broadcastUser(user);
  res.status(201).json({ user: auth.publicUser(user), mustChangePassword: false });
});

api.post('/login', (req, res) => {
  const pseudo = str(req.body.pseudo).trim();
  const password = str(req.body.password);
  const key = `${req.ip}|${pseudo.toLowerCase()}`;
  if (auth.tooManyFailures(key)) throw new ApiError(429, 'Trop d’essais ratés. Réessaie dans 15 minutes, ou demande à un admin.');

  const user = auth.findUserByPseudo(pseudo);
  if (!user || !auth.checkPassword(password, user.pass_hash)) {
    auth.recordFailure(key);
    throw new ApiError(400, 'Pseudo ou mot de passe incorrect.');
  }
  if (user.banned) throw new ApiError(403, 'Ce compte a été bloqué par un admin.');
  auth.clearFailures(key);
  setSessionCookie(req, res, auth.createSession(user.id));
  res.json({ user: auth.publicUser(user), mustChangePassword: Boolean(user.must_change_password) });
});

api.post('/logout', (req, res) => {
  auth.deleteSession(auth.readCookie(req.headers.cookie, auth.COOKIE));
  res.clearCookie(auth.COOKIE, { path: config.basePath || '/' });
  res.json({ ok: true });
});

api.post('/password', (req, res) => {
  const user = requireUser(req);
  const password = str(req.body.password);
  if (!user.must_change_password && !auth.checkPassword(str(req.body.current), user.pass_hash)) {
    throw new ApiError(400, 'Le mot de passe actuel est incorrect.');
  }
  const passError = auth.validatePassword(password);
  if (passError) throw new ApiError(400, passError);
  db.prepare('UPDATE users SET pass_hash = ?, must_change_password = 0 WHERE id = ?').run(auth.hashPassword(password), user.id);
  // Les autres appareils sont déconnectés ; celui-ci reçoit une nouvelle session.
  auth.deleteUserSessions(user.id);
  disconnectUser(user.id, 'Ton mot de passe a changé : reconnecte-toi.');
  setSessionCookie(req, res, auth.createSession(user.id));
  res.json({ ok: true });
});

api.post('/delete-account', (req, res) => {
  const user = requireUser(req);
  if (!auth.checkPassword(str(req.body.password), user.pass_hash)) throw new ApiError(400, 'Mot de passe incorrect.');
  // Supprime le compte, ses sessions, ses messages et ses réactions (clés étrangères en cascade).
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  disconnectUser(user.id, 'Ton compte a été supprimé.');
  removeUser(user.id);
  res.clearCookie(auth.COOKIE, { path: config.basePath || '/' });
  res.json({ ok: true });
});

api.use((req, res) => res.status(404).json({ error: 'Adresse inconnue.' }));

// Express 5 transmet aussi les erreurs des gestionnaires asynchrones.
api.use((err, req, res, next) => {
  if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Requête illisible.' });
  console.error(err);
  res.status(500).json({ error: 'Erreur du serveur, réessaie dans un instant.' });
});
