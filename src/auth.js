// Comptes et sessions : mots de passe hachés avec scrypt, jeton de session dans un cookie httpOnly.
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { db, getSetting } from './db.js';
import { config } from './config.js';
import { COLORS, AVATARS, LIMITS } from './options.js';

export const COOKIE = 'hubuno_session';
const PSEUDO_RE = new RegExp(`^[\\p{L}\\p{N}_.-]{${LIMITS.pseudoMin},${LIMITS.pseudoMax}}$`, 'u');

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function checkPassword(password, stored) {
  const [, salt, hash] = stored.split('$');
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

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

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < LIMITS.passwordMin) {
    return `Le mot de passe doit faire au moins ${LIMITS.passwordMin} caractères.`;
  }
  if (password.length > 200) return 'Le mot de passe est trop long.';
  return null;
}

export function createUser({ pseudo, password }) {
  const colors = Object.keys(COLORS);
  const user = {
    pseudo,
    pass_hash: hashPassword(password),
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
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// Limite les essais de connexion : 10 échecs en 15 minutes par adresse IP et par pseudo.
const failures = new Map();
const WINDOW = 15 * 60_000;

export function tooManyFailures(key) {
  const entry = failures.get(key);
  return Boolean(entry && entry.count >= 10 && Date.now() - entry.first < WINDOW);
}

export function recordFailure(key) {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.first >= WINDOW) failures.set(key, { count: 1, first: Date.now() });
  else entry.count++;
}

export function clearFailures(key) {
  failures.delete(key);
}

setInterval(() => {
  for (const [key, entry] of failures) if (Date.now() - entry.first >= WINDOW) failures.delete(key);
}, WINDOW).unref();
