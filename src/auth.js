// Comptes et sessions : mots de passe hachés avec scrypt, jeton de session dans un cookie httpOnly.
import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { db, getSetting } from './db.js';
import { config } from './config.js';
import { COLORS, AVATARS, LIMITS } from './options.js';
import { createLimiter, passwordProblem, safeEqual, PASSWORD_MAX } from './securite.js';

export const COOKIE = 'hubuno_session';
const PSEUDO_RE = new RegExp(`^[\\p{L}\\p{N}_.-]{${LIMITS.pseudoMin},${LIMITS.pseudoMax}}$`, 'u');

// scrypt tourne dans le pool de threads de Node (la boucle principale n'est jamais bloquée), mais on limite les calculs en parallèle :
// 2 à la fois, 100 en attente au plus, le reste est refusé (un déluge de connexions ne doit pas saturer le serveur).
const scryptAsync = promisify(scrypt);
const MAX_PARALLEL = 2;
const MAX_WAITING = 100;
let running = 0;
const waiting = [];

export class BusyError extends Error {}

async function derive(password, salt, length) {
  if (running >= MAX_PARALLEL) {
    if (waiting.length >= MAX_WAITING) throw new BusyError('Le serveur est occupé, réessaie dans un instant.');
    await new Promise((resolve) => waiting.push(resolve)); // la place est transmise telle quelle par le calcul qui se termine
  } else {
    running++;
  }
  try {
    return await scryptAsync(password, salt, length);
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

// Faux haché, comparé quand le pseudo n'existe pas : une connexion ratée prend le même temps que le pseudo soit connu ou non.
const dummyHash = hashPassword(randomBytes(12).toString('hex'));
dummyHash.catch(() => {});

// stored peut être absent (pseudo inconnu) : on fait quand même le calcul, et la réponse est toujours « non ».
export async function checkPassword(password, stored) {
  const real = typeof stored === 'string' && stored.startsWith('scrypt$');
  const [, salt, hash] = (real ? stored : await dummyHash).split('$');
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(String(password), Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected) && real;
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const tokenHash = sha256;

export function publicUser(u) {
  return { id: u.id, pseudo: u.pseudo, avatar: u.avatar, color: u.color, bio: u.bio, role: u.role };
}

export function classCode() {
  return getSetting('class_code') ?? config.classCode;
}

export function validatePseudo(pseudo) {
  if (!PSEUDO_RE.test(pseudo)) {
    return `Le pseudo doit faire de ${LIMITS.pseudoMin} à ${LIMITS.pseudoMax} caractères : lettres, chiffres, point, tiret ou tiret bas.`;
  }
  return null;
}

// Renvoie le message d'erreur si le mot de passe est refusé (trop court, trop courant, contient le pseudo…), sinon null.
export function validatePassword(password, pseudo = '') {
  return passwordProblem(password, pseudo, { min: LIMITS.passwordMin, max: PASSWORD_MAX });
}

// Code de classe : comparaison en temps constant, sans tenir compte de la casse.
export function codeMatches(given, expected) {
  return safeEqual(String(given).trim().toLowerCase(), String(expected).trim().toLowerCase());
}

// Le propriétaire du hub est le premier admin créé : aucun autre admin ne peut lui changer son mot de passe, son rôle ni le bloquer.
export function ownerId() {
  return db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get()?.id ?? null;
}

export function createUser({ pseudo, passHash }) {
  const colors = Object.keys(COLORS);
  const user = {
    pseudo,
    pass_hash: passHash,
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
    color: colors[Math.floor(Math.random() * colors.length)],
    role: config.admins.includes(pseudo.toLowerCase()) ? 'admin' : 'membre',
  };
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (pseudo, pass_hash, avatar, color, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(user.pseudo, user.pass_hash, user.avatar, user.color, user.role, Date.now());
  return getUser(Number(lastInsertRowid));
}

export function getUser(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function findUserByPseudo(pseudo) {
  return db.prepare('SELECT * FROM users WHERE pseudo = ?').get(pseudo);
}

export function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const expires = Date.now() + config.sessionDays * 86400_000;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expires);
  return { token, expires };
}

export function userFromToken(token) {
  if (!token) return null;
  const row = db
    .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .get(sha256(token), Date.now());
  if (!row || row.banned) return null;
  return row;
}

export function deleteSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function deleteUserSessions(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function purgeExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
}

export function readCookie(header, name) {
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null; // cookie mal encodé : comme s'il n'y avait pas de session
      }
    }
  }
  return null;
}

// Limite les essais de connexion ratés : 10 en 15 minutes par adresse et par pseudo, 30 par adresse seule.
// Les tables sont plafonnées à 10 000 entrées : une fois pleines, les nouvelles clés sont refusées (429).
const WINDOW = 15 * 60_000;
const failuresByKey = createLimiter({ max: 10, windowMs: WINDOW });
const failuresByIp = createLimiter({ max: 30, windowMs: WINDOW });
const loginKey = (ip, pseudo) => `${ip}|${String(pseudo).toLowerCase().slice(0, 40)}`;

export function tooManyFailures(ip, pseudo) {
  return failuresByIp.blocked(ip) || failuresByKey.blocked(loginKey(ip, pseudo));
}

export function recordFailure(ip, pseudo) {
  failuresByIp.hit(ip);
  failuresByKey.hit(loginKey(ip, pseudo));
}

// Une connexion réussie remet à zéro le compteur du pseudo, pas celui de l'adresse (sinon un compte à soi servirait à le vider).
export function clearFailures(ip, pseudo) {
  failuresByKey.clear(loginKey(ip, pseudo));
}

// Inscriptions : 10 mauvais codes de classe par 15 minutes et 20 inscriptions par heure, par adresse.
const badCodes = createLimiter({ max: 10, windowMs: WINDOW });
const signups = createLimiter({ max: 20, windowMs: 3600_000 });

export const badCodeBlocked = (ip) => badCodes.blocked(ip);
export const recordBadCode = (ip) => badCodes.hit(ip);
export const signupBlocked = (ip) => signups.blocked(ip);
export const recordSignup = (ip) => signups.hit(ip);
