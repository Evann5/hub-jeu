// Garde-fous de sécurité sans Express, Socket.IO ni base : limiteurs, règles de mot de passe, origine, comparaison en temps constant.
// Tout ce qui est décidé ici reçoit ses données (et l'heure) en arguments, pour pouvoir être testé seul (src/securite.test.js).
import { createHash, timingSafeEqual } from 'node:crypto';

// ——— Limiteur par clé (adresse, pseudo…) ———

const allLimiters = [];

// Compte les événements par clé dans une fenêtre fixe. La table est plafonnée : une fois pleine (après nettoyage des périmées),
// les clés nouvelles sont refusées (blocked() renvoie true) au lieu de faire grossir la mémoire.
export function createLimiter({ max, windowMs, cap = 10_000 }) {
  const map = new Map(); // clé -> { count, first }
  const fresh = (e, now) => Boolean(e) && now - e.first < windowMs;
  const sweep = (now = Date.now()) => {
    for (const [key, e] of map) if (!fresh(e, now)) map.delete(key);
  };
  const limiter = {
    blocked(key, now = Date.now()) {
      const e = map.get(key);
      if (fresh(e, now)) return e.count >= max;
      if (map.size >= cap) {
        sweep(now);
        return map.size >= cap;
      }
      return false;
    },
    hit(key, now = Date.now()) {
      const e = map.get(key);
      if (fresh(e, now)) {
        e.count++;
        return;
      }
      if (map.size >= cap) {
        sweep(now);
        if (map.size >= cap) return;
      }
      map.set(key, { count: 1, first: now });
    },
    clear(key) {
      map.delete(key);
    },
    sweep,
    get size() {
      return map.size;
    },
  };
  allLimiters.push(limiter);
  return limiter;
}

// Limiteur d'événements « N par fenêtre » avec fenêtre glissante : hit() renvoie true quand c'est trop (l'événement n'est alors pas compté).
export function createEventLimiter(max, windowMs) {
  const times = new Map(); // clé -> horodatages des événements acceptés
  const limiter = {
    hit(key, now = Date.now()) {
      const recent = (times.get(key) || []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        times.set(key, recent);
        return true;
      }
      recent.push(now);
      times.set(key, recent);
      return false;
    },
    sweep(now = Date.now()) {
      for (const [key, list] of times) if (!list.some((t) => now - t < windowMs)) times.delete(key);
    },
    get size() {
      return times.size;
    },
  };
  allLimiters.push(limiter);
  return limiter;
}

// Un seul minuteur pour tous les limiteurs : on retire les entrées périmées.
setInterval(() => {
  for (const l of allLimiters) l.sweep();
}, 5 * 60_000).unref();

// ——— Origine ———

// Vrai si l'en-tête Origin est absent ou désigne le même site. Une origine illisible (« null », adresse cassée) est refusée, jamais une exception.
export function sameOrigin(origin, host) {
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// ——— Comparaison en temps constant ———

const digest = (s) => createHash('sha256').update(String(s)).digest();

export function safeEqual(a, b) {
  return timingSafeEqual(digest(a), digest(b));
}

// ——— Mots de passe ———

export const PASSWORD_MAX = 128;

// Les mots de passe les plus courants (en minuscules). « motdepasse1 » n'y est volontairement pas : les tests s'en servent.
const COMMON_PASSWORDS = new Set([
  '1234567890', '12345678910', '123456789012', '1234567890123', '0123456789', '9876543210', '0987654321', '1234512345',
  '123456123456', '1q2w3e4r5t', '1q2w3e4r5t6y', '1qaz2wsx3edc', '1qazxsw23edc', 'azertyuiop', 'azertyuiop1', 'azertyuiop123',
  'azerty1234', 'azerty12345', 'azerty123456', 'azertyazerty', 'azertyui12', 'qwertyuiop', 'qwertyuiop1', 'qwerty1234',
  'qwerty12345', 'qwerty123456', 'qwertyqwerty', 'qsdfghjklm', 'azertyuiop!', 'wxcvbnqsdf', 'abcdefghij', 'abcdefghijk',
  'abcd123456', 'abcd1234567', 'abcde12345', 'password12', 'password123', 'password1234', 'password12345', 'password1!',
  'passw0rd12', 'passw0rd123', 'p@ssw0rd12', 'p@ssw0rd123', 'motdepasse', 'motdepasse12', 'motdepasse123', 'motdepasse1234',
  'motdepasse123456', 'monmotdepasse', 'monmotdepasse1', 'monmotdepasse12', 'motdepasse2026', 'motdepasse2025', 'iloveyou12',
  'iloveyou123', 'jetaime123', 'jetaime1234', 'jetaimemoi', 'bonjour123', 'bonjour1234', 'bonjour12345', 'bonjour2026',
  'bonsoir123', 'soleil1234', 'soleil12345', 'doudou1234', 'chocolat123', 'chocolat1234', 'football123', 'football1234',
  'marseille13', 'marseille123', 'psgpsgpsg1', 'superman123', 'minecraft1', 'minecraft12', 'minecraft123', 'fortnite123',
  'pokemon123', 'pokemon1234', 'naruto1234', 'computer123', 'trustno1234', 'letmein1234', 'welcome123', 'welcome1234',
  'adminadmin', 'admin12345', 'admin123456', 'administrateur', 'administrator', 'hubuno1234', 'hubuno2026', 'hubunohubuno',
  'hubuno12345', 'classe12345', 'etudiant123', 'etudiant1234', 'etudiants12', 'azerty2026', 'azerty2025', 'abc1234567',
  'changeme123', 'changemoi12', 'qwerty2026', 'a1b2c3d4e5', 'aaaa111111', 'aze123aze123', 'aqwzsxedc12', 'zaq12wsxcde3',
]);

// Renvoie le message d'erreur (en français) si le mot de passe est refusé, sinon null.
export function passwordProblem(password, pseudo = '', { min = 10, max = PASSWORD_MAX } = {}) {
  if (typeof password !== 'string' || password.length < min) return `Le mot de passe doit faire au moins ${min} caractères.`;
  if (password.length > max) return `Le mot de passe est trop long (${max} caractères au maximum).`;
  if (new Set(password).size === 1) return 'Ce mot de passe est trop simple : un seul caractère répété.';
  const lower = password.toLowerCase();
  const name = String(pseudo).trim().toLowerCase();
  // Les pseudos de 3 lettres ou moins se retrouveraient dans trop de mots : on ne compare qu'à partir de 4.
  if (name.length >= 4 && (lower.includes(name) || name.includes(lower))) return 'Le mot de passe ne doit pas contenir ton pseudo.';
  if (COMMON_PASSWORDS.has(lower)) return 'Ce mot de passe est l’un des plus courants : choisis-en un autre.';
  return null;
}
