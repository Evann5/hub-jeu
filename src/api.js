// Routes HTTP : inscription, connexion, mot de passe, suppression du compte.
import express from 'express';
import { db, transaction } from './db.js';
import { config } from './config.js';
import { COLORS, AVATARS, REACTIONS, LIMITS } from './options.js';
import * as auth from './auth.js';
import { markAllChannelsRead, deleteUserData } from './chat.js';
import { createLimiter } from './securite.js';
import { broadcastUser, disconnectUser, disconnectOtherSessions, disconnectSession, removeUser } from './realtime.js';
import { sameOrigin } from './securite.js';

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
  if (!sameOrigin(req.get('origin'), req.get('host'))) return res.status(403).json({ error: 'Requête refusée.' });
  if (!req.is('application/json')) return res.status(415).json({ error: 'Requête refusée.' });
  next();
});
// Connexion et inscription ne reçoivent que quelques champs : 1 ko suffit ; le reste des routes garde 10 ko.
api.post(['/login', '/register'], express.json({ limit: '1kb' }));
api.use(express.json({ limit: '10kb' }));
api.use((req, res, next) => {
  req.body ??= {};
  next();
});

function setSessionCookie(req, res, { token, expires }) {
  res.cookie(auth.COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' || req.secure,
    path: config.basePath || '/',
    expires: new Date(expires),
  });
}

function currentUser(req) {
  return auth.userFromToken(auth.readCookie(req.headers.cookie, auth.COOKIE));
}

function requireUser(req) {
  const user = currentUser(req);
  if (!user) throw new ApiError(401, 'Ta session a expiré : reconnecte-toi.');
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

api.post('/register', async (req, res) => {
  const pseudo = str(req.body.pseudo).trim().normalize('NFC'); // même écriture quel que soit le clavier
  const password = str(req.body.password);
  const code = str(req.body.classCode).trim();

  if (auth.badCodeBlocked(req.ip)) throw new ApiError(429, 'Trop de codes de classe ratés depuis cette connexion. Réessaie dans 15 minutes.');
  if (auth.signupBlocked(req.ip)) throw new ApiError(429, 'Trop d’inscriptions depuis cette connexion. Réessaie dans une heure.');
  if (auth.allSignupsBlocked()) throw new ApiError(429, 'Beaucoup d’inscriptions en ce moment. Réessaie dans une heure, ou préviens un admin.');
  const expected = auth.classCode();
  if (!expected) throw new ApiError(503, "Les inscriptions ne sont pas encore ouvertes : aucun code de classe n’est réglé.");
  const adminPseudo = auth.isAdminPseudo(pseudo);
  const adminCodeOk = Boolean(config.adminCode) && auth.codeMatches(code, config.adminCode);
  if (!adminCodeOk && !auth.codeMatches(code, expected)) {
    auth.recordBadCode(req.ip);
    throw new ApiError(400, 'Ce code de classe ne marche pas. Demande-le à un admin.');
  }
  // Les pseudos d'admin sont réservés : sinon, le premier élève qui s'inscrit avec le pseudo d'un admin le devient.
  if (config.adminCode && adminPseudo && !adminCodeOk) throw new ApiError(409, 'Ce pseudo est déjà pris.');
  const pseudoError = auth.validatePseudo(pseudo);
  if (pseudoError) throw new ApiError(400, pseudoError);
  if (auth.reservedPseudo(pseudo)) throw new ApiError(409, 'Ce pseudo est réservé à l’équipe de Hubuno. Choisis-en un autre.');
  const passError = auth.validatePassword(password, pseudo);
  if (passError) throw new ApiError(400, passError);
  if (req.body.acceptRules !== true) throw new ApiError(400, 'Coche la case pour accepter les règles de Hubuno.');
  if (auth.pseudoTaken(pseudo)) throw new ApiError(409, 'Ce pseudo est déjà pris.');

  auth.recordSignup(req.ip); // compté d'avance (le calcul est asynchrone), rendu si l'inscription échoue
  auth.recordAnySignup();
  let user;
  try {
    const passHash = await auth.hashPassword(password);
    // Pendant le calcul, quelqu'un d'autre a pu prendre le pseudo : on revérifie juste avant d'écrire.
    if (auth.pseudoTaken(pseudo)) throw new ApiError(409, 'Ce pseudo est déjà pris.');
    user = auth.createUser({ pseudo, passHash });
  } catch (err) {
    auth.refundSignup(req.ip);
    auth.refundAnySignup();
    throw err;
  }
  markAllChannelsRead(user.id);
  setSessionCookie(req, res, auth.createSession(user.id));
  broadcastUser(user);
  res.status(201).json({ user: auth.publicUser(user), mustChangePassword: false });
});

api.post('/login', async (req, res) => {
  const pseudo = str(req.body.pseudo).trim().normalize('NFC'); // même écriture quel que soit le clavier
  const password = str(req.body.password);
  if (auth.tooManyFailures(req.ip, pseudo)) throw new ApiError(429, 'Trop d’essais ratés. Réessaie dans une minute, ou demande à un admin.');

  auth.recordAttempt(req.ip, pseudo); // compté d'avance, rendu si le mot de passe est bon
  // Le calcul se fait aussi quand le pseudo n'existe pas : même durée dans les deux cas.
  const user = auth.findUserByPseudo(pseudo);
  if (!user && !auth.unknownPseudoAttempt(req.ip)) throw new ApiError(429, 'Trop d’essais ratés. Réessaie dans 15 minutes.');
  const ok = await auth.checkPassword(password, user?.pass_hash);
  if (!user || !ok) {
    throw new ApiError(400, 'Pseudo ou mot de passe incorrect.');
  }
  if (user.banned) throw new ApiError(403, 'Ce compte a été bloqué par un admin.');
  if (user.must_change_password && user.temp_until && Date.now() > user.temp_until) {
    throw new ApiError(403, 'Ce mot de passe provisoire a expiré (il sert 24 heures). Demande-en un nouveau à un admin.');
  }
  auth.recordSuccess(req.ip, pseudo);
  setSessionCookie(req, res, auth.createSession(user.id));
  res.json({ user: auth.publicUser(user), mustChangePassword: Boolean(user.must_change_password) });
});

api.post('/logout', (req, res) => {
  const token = auth.readCookie(req.headers.cookie, auth.COOKIE);
  auth.deleteSession(token);
  disconnectSession(token); // les connexions en direct de cette session se ferment aussi
  res.clearCookie(auth.COOKIE, { path: config.basePath || '/' });
  res.json({ ok: true });
});

// Le mot de passe actuel, redemandé pour changer de mot de passe ou supprimer le compte : 5 erreurs en 15 minutes par compte.
const wrongCurrent = createLimiter({ max: 5, windowMs: 15 * 60_000 });
async function checkCurrent(user, given, message) {
  if (wrongCurrent.blocked(user.id)) throw new ApiError(429, 'Trop d’essais ratés. Réessaie dans 15 minutes.');
  if (!(await auth.checkPassword(str(given), user.pass_hash))) {
    wrongCurrent.hit(user.id);
    throw new ApiError(400, message);
  }
  wrongCurrent.clear(user.id);
}

api.post('/password', async (req, res) => {
  const user = requireUser(req);
  const password = str(req.body.password);
  if (!user.must_change_password) await checkCurrent(user, req.body.current, 'Le mot de passe actuel est incorrect.');
  const passError = auth.validatePassword(password, user.pseudo);
  if (passError) throw new ApiError(400, passError);
  const passHash = await auth.hashPassword(password);
  db.prepare('UPDATE users SET pass_hash = ?, must_change_password = 0 WHERE id = ?').run(passHash, user.id);
  // Les autres appareils sont déconnectés ; celui-ci garde sa session et ses onglets ouverts.
  const token = auth.readCookie(req.headers.cookie, auth.COOKIE);
  auth.deleteOtherSessions(user.id, token);
  disconnectOtherSessions(user.id, token, 'Ton mot de passe a changé : reconnecte-toi.');
  res.json({ ok: true });
});

api.post('/delete-account', async (req, res) => {
  const user = requireUser(req);
  await checkCurrent(user, req.body.password, 'Mot de passe incorrect.');
  if (user.role === 'admin' && db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND banned = 0").get().n <= 1) throw new ApiError(400, 'Tu es le dernier admin : nomme d’abord un autre admin.');
  // Supprime le compte, ses sessions, ses messages et ses réactions (clés étrangères en cascade), puis ses messages privés et ses lectures.
  transaction(() => {
    deleteUserData(user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  });
  disconnectUser(user.id, 'Ton compte a été supprimé.');
  removeUser(user.id, { deleted: true });
  res.clearCookie(auth.COOKIE, { path: config.basePath || '/' });
  res.json({ ok: true });
});

api.use((req, res) => res.status(404).json({ error: 'Adresse inconnue.' }));

// Express 5 transmet aussi les erreurs des gestionnaires asynchrones.
api.use((err, req, res, next) => {
  if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Requête illisible.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Requête trop volumineuse.' });
  if (err instanceof auth.BusyError) return res.status(503).json({ error: err.message });
  if (err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: 'Requête refusée.' });
  if (/database or disk is full/i.test(String(err?.message))) {
    console.error(err);
    return res.status(507).json({ error: 'Le serveur n’a plus de place pour enregistrer. Préviens un admin.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Erreur du serveur, réessaie dans un instant.' });
});
