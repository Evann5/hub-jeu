// Comptes et sessions : mots de passe hachés avec scrypt, jeton de session dans un cookie httpOnly.
import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { db, getSetting } from './db.js';
import { config } from './config.js';
import { COLORS, AVATARS, LIMITS, readCharacter } from './options.js';
import { createLimiter, passwordProblem, safeEqual, PASSWORD_MAX } from './securite.js';

export const COOKIE = 'hubuno_session';
// Alphabet latin seulement : sinon un « а » cyrillique permet d'imiter le pseudo d'un admin.
const PSEUDO_RE = new RegExp(`^[\\p{Script=Latin}0-9_.-]{${LIMITS.pseudoMin},${LIMITS.pseudoMax}}$`, 'u');
const FOLD = { ı: 'i', ł: 'l', ø: 'o', đ: 'd', ð: 'd', ħ: 'h', ŧ: 't', ß: 'ss', æ: 'ae', œ: 'oe', ſ: 's' };
const plainPseudo = (pseudo) => pseudo.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[ıłøđðħŧßæœſ]/g, (c) => FOLD[c]);
// Pour comparer ce que l'œil confond : MINH et MlNH, Olivia et 0livia.
const lookalike = (pseudo) => plainPseudo(pseudo).replace(/[._-]/g, '').replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/[il1]/g, 'l').replace(/0/g, 'o');

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

// Rôles décoratifs d'un compte, dans l'ordre de la liste des rôles (le premier colore le pseudo).
const rolesOfUser = db.prepare('SELECT r.id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? ORDER BY r.position, r.id');

// L'avatar affiché : la photo envoyée, la tête du personnage ou la silhouette par défaut. Sans choix (''), le personnage s'il existe.
export function picOf(u) {
  const character = readCharacter(u.character);
  if (u.pic === 'photo' && u.photo) return 'photo';
  if (u.pic === 'silhouette') return 'silhouette';
  if ((u.pic === '' || u.pic === 'personnage' || u.pic === undefined) && character) return 'personnage';
  return 'silhouette';
}

// Ce que les autres voient d'un compte. Le niveau (admin, modo) ne se montre qu'à l'équipe : pour les membres, tout le monde
// est « membre » (staff: false). Un compte voit toujours son propre niveau (state.me).
export function publicUser(u, { staff = true } = {}) {
  const pic = picOf(u);
  return {
    id: u.id,
    pseudo: u.pseudo,
    avatar: u.avatar,
    color: u.color,
    bio: u.bio,
    character: readCharacter(u.character),
    pic,
    photo: pic === 'photo' ? `photos/${u.photo}` : null,
    role: staff ? u.role : 'membre',
    roles: rolesOfUser.all(u.id).map((r) => r.id),
  };
}

export function classCode() {
  return getSetting('class_code') ?? config.classCode;
}

// Un admin peut fermer les inscriptions une fois la classe inscrite : plus aucun compte ne se crée (sauf avec le code admin).
export const signupsOpen = () => getSetting('signups_open') !== '0';

export function validatePseudo(pseudo) {
  // Accents acceptés (Élodie, Trần) ; lettres qui imitent une lettre normale refusées (ｚ pleine chasse, ɑ, ı seul…).
  const plainEnough = pseudo.normalize('NFKC') === pseudo.normalize('NFC') && /^[a-z0-9_.-]*$/.test(plainPseudo(pseudo));
  if (!PSEUDO_RE.test(pseudo) || !plainEnough) {
    return `Le pseudo doit faire de ${LIMITS.pseudoMin} à ${LIMITS.pseudoMax} caractères : lettres, chiffres, point, tiret ou tiret bas.`;
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
    role: isAdminPseudo(pseudo) ? 'admin' : 'membre',
  };
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (pseudo, pass_hash, avatar, color, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(user.pseudo, user.pass_hash, user.avatar, user.color, user.role, Date.now());
  return getUser(Number(lastInsertRowid));
}

export function getUser(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// Élodie, élodie et Elodie sont le même pseudo pour un lecteur : un seul compte. Un sosie du pseudo d'un admin est pris même si cet admin n'est pas encore inscrit.
export function pseudoTaken(pseudo) {
  const wanted = lookalike(pseudo);
  if (config.admins.some((a) => lookalike(a) === wanted && a !== plainPseudo(pseudo) && a !== pseudo.toLowerCase())) return true;
  return db.prepare('SELECT pseudo FROM users').all().some((u) => lookalike(u.pseudo) === wanted);
}

// Pour renommer un compte : le nouveau pseudo ne doit ressembler à aucun autre compte, ni à un pseudo réservé aux admins (ADMINS).
export function pseudoTakenByOther(pseudo, exceptId) {
  const wanted = lookalike(pseudo);
  if (config.admins.some((a) => lookalike(a) === wanted)) return true;
  return db.prepare('SELECT id, pseudo FROM users').all().some((u) => u.id !== exceptId && lookalike(u.pseudo) === wanted);
}

// Pseudos qui feraient passer un élève pour l'équipe ou pour Hubuno lui-même (comparés comme l'œil les lit : « adm1n », « Admin »).
const RESERVED = new Set(['admin', 'admins', 'administrateur', 'administratrice', 'administrator', 'modo', 'modos', 'moderateur', 'moderatrice', 'moderation',
  'moderator', 'hubuno', 'systeme', 'system', 'support', 'equipe', 'staff', 'prof', 'professeur'].map(lookalike));
export const reservedPseudo = (pseudo) => RESERVED.has(lookalike(pseudo)) && !isAdminPseudo(pseudo);

export function isAdminPseudo(pseudo) {
  return config.admins.includes(plainPseudo(pseudo)) || config.admins.includes(pseudo.toLowerCase());
}

export function findUserByPseudo(pseudo) {
  return db.prepare('SELECT * FROM users WHERE pseudo = ?').get(pseudo);
}

const MAX_SESSIONS = 10; // appareils et navigateurs connectés en même temps, par compte

export function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const expires = Date.now() + config.sessionDays * 86400_000;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expires);
  // Les MAX_SESSIONS dernières connexions d'un compte restent valables : sans plafond, des connexions en boucle rempliraient la base.
  db.prepare(`DELETE FROM sessions WHERE user_id = ? AND token_hash NOT IN
    (SELECT token_hash FROM sessions WHERE user_id = ? ORDER BY expires_at DESC, rowid DESC LIMIT ?)`).run(userId, userId, MAX_SESSIONS);
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

export function deleteOtherSessions(userId, keepToken) {
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(userId, sha256(keepToken));
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
const failuresByIp = createLimiter({ max: 500, windowMs: WINDOW }); // large : toute une classe partage souvent la même adresse ; un pseudo inventé n'y compte pas
const SLOW_TRY = 60_000; // une fois bloqué, un essai par minute reste permis : un camarade ne peut pas enfermer quelqu'un dehors
const slowTries = new Map(); // clé -> dernier essai accordé
const loginKey = (ip, pseudo) => `${ip}|${String(pseudo).toLowerCase().slice(0, 40)}`;

export function tooManyFailures(ip, pseudo, now = Date.now()) {
  if (failuresByIp.blocked(ip, now)) return true;
  const key = loginKey(ip, pseudo);
  if (!failuresByKey.blocked(key, now)) return false;
  if (now - (slowTries.get(key) ?? -Infinity) < SLOW_TRY) return true;
  if (slowTries.size >= 10_000) slowTries.clear();
  slowTries.set(key, now);
  return false;
}

// Un pseudo qui n'existe pas ne compte pas pour l'adresse : sinon, 500 pseudos inventés bloqueraient toute la classe.
// Il a son propre compteur : au-delà, seuls ces essais sont refusés, sans calcul, et les vrais comptes passent toujours.
const unknownByIp = createLimiter({ max: 1000, windowMs: WINDOW });
export function unknownPseudoAttempt(ip) {
  failuresByIp.undo(ip);
  if (unknownByIp.blocked(ip)) return false;
  unknownByIp.hit(ip);
  return true;
}

// On compte l'essai AVANT de vérifier le mot de passe (le calcul est asynchrone : une rafale en parallèle passerait sinon toute entière
// entre le contrôle et l'écriture), puis on le rend si la connexion réussit.
export function recordAttempt(ip, pseudo) {
  failuresByIp.hit(ip);
  failuresByKey.hit(loginKey(ip, pseudo));
}

// Connexion réussie : le compteur du pseudo repart à zéro et l'essai est rendu à l'adresse (qui garde ses vrais échecs : un compte à soi
// ne sert pas à vider le compteur).
export function recordSuccess(ip, pseudo) {
  failuresByKey.clear(loginKey(ip, pseudo));
  failuresByIp.undo(ip);
}

// Inscriptions : 10 mauvais codes de classe par 15 minutes et 60 inscriptions par heure, par adresse.
const badCodes = createLimiter({ max: 40, windowMs: WINDOW });
const signups = createLimiter({ max: 60, windowMs: 3600_000 }); // large : toute une classe peut s'inscrire d'un coup depuis le même Wi-Fi

export const badCodeBlocked = (ip) => badCodes.blocked(ip);
export const recordBadCode = (ip) => badCodes.hit(ip);
export const signupBlocked = (ip) => signups.blocked(ip);
export const recordSignup = (ip) => signups.hit(ip);
export const refundSignup = (ip) => signups.undo(ip);

// Plafond pour tout le hub, quelle que soit l'adresse : 80 inscriptions par heure (une classe de 40 s'inscrit d'un coup sans le toucher).
// Sans lui, quelqu'un qui connaît le code de classe et change d'adresse créerait des comptes sans fin.
const allSignups = createLimiter({ max: 80, windowMs: 3600_000 });
export const allSignupsBlocked = () => allSignups.blocked('hub');
export const recordAnySignup = () => allSignups.hit('hub');
export const refundAnySignup = () => allSignups.undo('hub');

export const TEMP_PASSWORD_MS = 24 * 3600_000; // un mot de passe provisoire donné par un admin sert dans la journée
