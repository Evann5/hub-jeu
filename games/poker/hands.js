// Poker : évaluation des mains et pots secondaires. Fonctions pures, sans hasard ni heure.
// Une carte est un entier de 0 à 51 : rang = (c % 13) + 2 (2 à 14, 14 = As), couleur = floor(c / 13) (0 ♠, 1 ♥, 2 ♦, 3 ♣).

export const rankOf = (c) => (c % 13) + 2;
export const suitOf = (c) => Math.floor(c / 13);

export const CATEGORIES = [
  'Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush',
];

const BASE = 15; // les rangs vont de 2 à 14 : une base 15 donne un score unique à chaque main de 5 cartes

// Score d'une main de exactement 5 cartes : plus il est grand, plus la main est forte.
// Retourne { score, cat, ranks } ; ranks = rangs dans l'ordre de départage (pour la roue, l'As compte pour 1 : [5,4,3,2,1]).
export function evaluate5(cards) {
  if (cards.length !== 5) throw new Error('Il faut 5 cartes.');
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));
  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  // Groupes triés par nombre d'occurrences puis par rang : c'est l'ordre de départage.
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const shape = groups.map((g) => g[1]).join('');
  const distinct = groups.length === 5;
  let straightHigh = 0;
  if (distinct) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
    else if (ranks[0] === 14 && ranks[1] === 5 && ranks[4] === 2) straightHigh = 5; // la roue A-2-3-4-5
  }
  let cat;
  let tie;
  if (straightHigh && flush) { cat = 8; tie = [straightHigh]; }
  else if (shape === '41') { cat = 7; tie = groups.map((g) => g[0]); }
  else if (shape === '32') { cat = 6; tie = groups.map((g) => g[0]); }
  else if (flush) { cat = 5; tie = ranks; }
  else if (straightHigh) { cat = 4; tie = [straightHigh]; }
  else if (shape === '311') { cat = 3; tie = groups.map((g) => g[0]); }
  else if (shape === '221') { cat = 2; tie = groups.map((g) => g[0]); }
  else if (shape === '2111') { cat = 1; tie = groups.map((g) => g[0]); }
  else { cat = 0; tie = ranks; }
  let score = cat;
  for (let i = 0; i < 5; i++) score = score * BASE + (tie[i] || 0);
  return { score, cat, ranks: tie };
}

// Les 5 cartes parmi 5 à 7 qui font la meilleure main. Retourne { score, cat, ranks, cards }.
export function bestHand(cards) {
  if (cards.length < 5 || cards.length > 7) throw new Error('Il faut entre 5 et 7 cartes.');
  let best = null;
  const n = cards.length;
  const pick = [];
  const rec = (start) => {
    if (pick.length === 5) {
      const e = evaluate5(pick);
      if (!best || e.score > best.score) best = { ...e, cards: pick.slice() };
      return;
    }
    for (let i = start; i < n; i++) {
      pick.push(cards[i]);
      rec(i + 1);
      pick.pop();
    }
  };
  rec(0);
  return best;
}

const PLURAL = { 14: 'as', 13: 'rois', 12: 'dames', 11: 'valets', 10: 'dix', 9: 'neuf', 8: 'huit', 7: 'sept', 6: 'six', 5: 'cinq', 4: 'quatre', 3: 'trois', 2: 'deux' };
const SINGLE = { 14: 'As', 13: 'Roi', 12: 'Dame', 11: 'Valet', 10: 'Dix', 9: 'Neuf', 8: 'Huit', 7: 'Sept', 6: 'Six', 5: 'Cinq', 4: 'Quatre', 3: 'Trois', 2: 'Deux' };
const HIGH = { 14: 'à l’as', 13: 'au roi', 12: 'à la dame', 11: 'au valet', 10: 'au dix', 9: 'au neuf', 8: 'au huit', 7: 'au sept', 6: 'au six', 5: 'au cinq' };

const de = (r) => (r === 14 ? 'd’as' : `de ${PLURAL[r]}`);

// Nom lisible d'une main évaluée, par exemple « Full aux as par les rois ».
export function handName(e) {
  const [a, b] = e.ranks;
  switch (e.cat) {
    case 8: return a === 14 ? 'Quinte flush royale' : `Quinte flush ${HIGH[a]}`;
    case 7: return `Carré ${de(a)}`;
    case 6: return `Full aux ${PLURAL[a]} par les ${PLURAL[b]}`;
    case 5: return `Couleur ${HIGH[a]}`;
    case 4: return `Quinte ${HIGH[a]}`;
    case 3: return `Brelan ${de(a)}`;
    case 2: return `Double paire ${de(a)} et ${de(b)}`;
    case 1: return `Paire ${de(a)}`;
    default: return `${SINGLE[a]} haut`;
  }
}

// ——— Pots secondaires ———

// contribs : [{ id, total, folded }] = ce que chaque joueur a mis dans la main (couché ou non).
// Retourne les pots dans l'ordre, du principal aux secondaires : [{ amount, eligible: [ids] }].
// Un pot n'a qu'un seul ayant droit quand une mise n'a pas été suivie : elle lui revient.
export function buildPots(contribs) {
  const levels = [...new Set(contribs.filter((c) => c.total > 0).map((c) => c.total))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const level of levels) {
    const inLayer = contribs.filter((c) => c.total >= level);
    const amount = (level - prev) * inLayer.length;
    const eligible = inLayer.filter((c) => !c.folded).map((c) => c.id);
    prev = level;
    if (amount === 0) continue;
    if (!eligible.length) {
      // Personne de vivant dans cette tranche (cas rare) : elle rejoint le pot précédent.
      if (pots.length) pots[pots.length - 1].amount += amount;
      else pots.push({ amount, eligible: [] });
      continue;
    }
    const last = pots[pots.length - 1];
    // Deux tranches voisines avec les mêmes ayants droit ne font qu'un pot (un joueur couché a fait grossir la tranche).
    if (last && last.eligible.length === eligible.length && last.eligible.every((id, i) => id === eligible[i])) last.amount += amount;
    else pots.push({ amount, eligible });
  }
  // Un premier pot sans ayant droit (tous les contributeurs de la tranche sont couchés) passe au suivant.
  while (pots.length > 1 && !pots[0].eligible.length) {
    const first = pots.shift();
    pots[0].amount += first.amount;
  }
  return pots;
}

// Partage un pot entre ses gagnants. order : les ids dans l'ordre de distribution, à partir du joueur après le donneur.
// Les jetons qui ne se divisent pas vont un par un aux premiers gagnants de cet ordre.
// Retourne { id: gain }.
export function splitPot(amount, winners, order) {
  const sorted = order.filter((id) => winners.includes(id));
  const share = Math.floor(amount / sorted.length);
  let rest = amount - share * sorted.length;
  const gains = {};
  for (const id of sorted) {
    gains[id] = share + (rest > 0 ? 1 : 0);
    if (rest > 0) rest--;
  }
  return gains;
}
