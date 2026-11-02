// Télépathie : jeu coopératif et silencieux. Au niveau N, chacun reçoit N cartes de 1 à 100 et l'équipe doit les poser
// dans l'ordre croissant sans se parler. Pas de tour : tout le monde peut poser sa plus petite carte quand il veut.
// Une erreur coûte une vie et défausse les cartes plus petites ; une étoile (accord de tous) défausse la plus petite
// carte de chacun. Aucun minuteur : le jeu repose sur le temps réel.

export const MAX_CARD = 100;
export const STARS_AT = [2, 5, 8]; // niveaux réussis qui offrent une étoile de plus
export const LIVES_AT = [3, 6, 9]; // niveaux réussis qui offrent une vie de plus
export const MAX_LIVES = 5;
export const MAX_STARS = 3;

export const levelsFor = (n) => (n <= 2 ? 12 : n === 3 ? 10 : 8);
export const livesFor = (n) => (n <= 2 ? 2 : n === 3 ? 3 : 4);
export const starsFor = (n) => (n <= 5 ? 1 : 2);

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const active = (s) => s.players.filter((id) => !s.left.includes(id));
const note = (s, notice) => ({ ...s, notice: { ...notice, id: s.notice.id + 1 } });

export function setup(players, options, ctx) {
  const ids = players.map((p) => p.id);
  const wanted = Number(options?.levels) > 0 ? Number(options.levels) : levelsFor(ids.length);
  const levels = Math.max(1, Math.min(wanted, Math.floor(MAX_CARD / ids.length)));
  return {
    players: ids,
    left: [],
    levels,
    level: 1,
    phase: 'focus', // focus : temps de concentration ; play : le niveau ; over : fin
    lives: livesFor(ids.length),
    livesMax: livesFor(ids.length),
    stars: starsFor(ids.length),
    starsMax: starsFor(ids.length),
    hands: Object.fromEntries(ids.map((id) => [id, []])),
    pile: [], // cartes posées ce niveau : { card, by }, la dernière est au-dessus
    burned: [], // cartes défaussées ce niveau : { id, card }
    ready: [],
    starVote: null, // { by, yes: [ids] }
    notice: { id: 0, kind: 'start' },
    result: null, // 'won' | 'lost'
    seed: ctx.random(), // sert seulement à varier le ciel côté affichage
  };
}

function startLevel(s, ctx) {
  const deck = shuffle(Array.from({ length: MAX_CARD }, (_, i) => i + 1), ctx.random);
  const hands = Object.fromEntries(s.players.map((id) => [id, []]));
  let at = 0;
  for (const id of active(s)) {
    hands[id] = deck.slice(at, at + s.level).sort((a, b) => a - b);
    at += s.level;
  }
  return { ...s, phase: 'play', hands, pile: [], burned: [], ready: [], starVote: null };
}

function noCardsLeft(s) {
  return active(s).every((id) => s.hands[id].length === 0);
}

// Tout le monde a posé ou défaussé ses cartes : niveau réussi, bonus éventuel, puis concentration (ou victoire).
function clearLevel(s) {
  if (s.level >= s.levels) {
    return note({ ...s, phase: 'over', result: 'won', starVote: null }, { kind: 'won', prev: s.notice });
  }
  let { lives, livesMax, stars, starsMax } = s;
  let bonus = null;
  if (STARS_AT.includes(s.level) && stars < MAX_STARS) { stars += 1; starsMax = Math.max(starsMax, stars); bonus = 'star'; }
  if (LIVES_AT.includes(s.level) && lives < MAX_LIVES) { lives += 1; livesMax = Math.max(livesMax, lives); bonus = 'life'; }
  const next = { ...s, level: s.level + 1, phase: 'focus', ready: [], pile: [], burned: [], starVote: null, lives, livesMax, stars, starsMax };
  next.hands = Object.fromEntries(s.players.map((id) => [id, []]));
  return note(next, { kind: 'cleared', level: s.level, bonus, prev: s.notice });
}

function lose(s, why) {
  return note({ ...s, phase: 'over', result: 'lost', starVote: null }, { kind: 'lost', why, prev: s.notice });
}

function playCard(s, id, card) {
  const hand = s.hands[id];
  if (!hand.length) throw new Error('Tu n’as plus de carte à poser dans ce niveau.');
  if (card !== hand[0]) throw new Error('Ta plus petite carte a changé : regarde ta main.');
  const hands = {};
  const lost = [];
  for (const p of s.players) {
    if (p === id) { hands[p] = s.hands[p].slice(1); continue; }
    hands[p] = s.hands[p].filter((c) => c > card);
    for (const c of s.hands[p]) if (c < card) lost.push({ id: p, card: c });
  }
  let t = { ...s, hands, pile: [...s.pile, { card, by: id }], burned: [...s.burned, ...lost] };
  if (lost.length) {
    t = note({ ...t, lives: t.lives - 1 }, { kind: 'mistake', by: id, card, lost });
    if (t.lives <= 0) return lose(t, 'lives');
  } else {
    t = note(t, { kind: 'play', by: id, card });
  }
  return noCardsLeft(t) ? clearLevel(t) : t;
}

// Chacun défausse sa plus petite carte.
function applyStar(s) {
  const hands = {};
  const cards = [];
  for (const id of s.players) {
    const [lowest, ...rest] = s.hands[id];
    hands[id] = rest;
    if (lowest !== undefined && !s.left.includes(id)) cards.push({ id, card: lowest });
  }
  let t = note({ ...s, hands, stars: s.stars - 1, starVote: null, burned: [...s.burned, ...cards] }, { kind: 'star', cards });
  if (noCardsLeft(t)) t = clearLevel(t);
  return t;
}

export function move(s, playerId, action, ctx) {
  if (s.phase === 'over') throw new Error('La partie est terminée.');
  const type = action?.type;
  if (s.phase === 'focus') {
    if (type !== 'ready') throw new Error('Respire : clique sur « Prêt » quand tu es concentré.');
    if (s.ready.includes(playerId)) throw new Error('Tu es déjà prêt. Attends les autres.');
    const t = { ...s, ready: [...s.ready, playerId] };
    return { state: active(t).every((id) => t.ready.includes(id)) ? startLevel(t, ctx) : t };
  }
  // phase « play »
  if (type === 'play') {
    if (s.starVote) throw new Error('Une étoile est proposée : accepte-la ou refuse-la avant de poser une carte.');
    return { state: playCard(s, playerId, Number(action.card)) };
  }
  if (type === 'star') {
    if (s.starVote) throw new Error('Une étoile est déjà proposée.');
    if (s.stars <= 0) throw new Error('Il ne reste plus d’étoile.');
    return { state: note({ ...s, starVote: { by: playerId, yes: [playerId] } }, { kind: 'star-ask', by: playerId }) };
  }
  if (type === 'star-yes') {
    if (!s.starVote) throw new Error('Aucune étoile n’est proposée.');
    if (s.starVote.yes.includes(playerId)) throw new Error('Tu as déjà accepté.');
    const t = { ...s, starVote: { ...s.starVote, yes: [...s.starVote.yes, playerId] } };
    return { state: active(t).every((id) => t.starVote.yes.includes(id)) ? applyStar(t) : t };
  }
  if (type === 'star-no') {
    if (!s.starVote) throw new Error('Aucune étoile n’est proposée.');
    return { state: note({ ...s, starVote: null }, { kind: 'star-no', by: playerId, asked: s.starVote.by }) };
  }
  throw new Error('Action inconnue.');
}

export function leave(s, playerId, ctx) {
  if (s.phase === 'over') return { state: s };
  let t = { ...s, left: [...s.left, playerId], hands: { ...s.hands, [playerId]: [] }, ready: s.ready.filter((id) => id !== playerId) };
  if (active(t).length < 2) return { state: lose(t, 'alone') };
  t = note(t, { kind: 'left', by: playerId });
  if (t.phase === 'focus') {
    return { state: active(t).every((id) => t.ready.includes(id)) ? startLevel(t, ctx) : t };
  }
  if (t.starVote) {
    if (t.starVote.by === playerId) t = { ...t, starVote: null };
    else {
      t = { ...t, starVote: { ...t.starVote, yes: t.starVote.yes.filter((id) => id !== playerId) } };
      if (active(t).every((id) => t.starVote.yes.includes(id))) t = applyStar(t);
    }
  }
  if (t.phase === 'play' && noCardsLeft(t)) t = clearLevel(t);
  return { state: t };
}

export function status(s) {
  if (s.phase === 'over') return { over: true, turn: null, winners: s.result === 'won' ? active(s) : [] };
  const turn = s.phase === 'focus' ? active(s).filter((id) => !s.ready.includes(id)) : active(s);
  return { over: false, turn, winners: [] };
}

export function view(s, playerId) {
  const counts = Object.fromEntries(s.players.map((id) => [id, s.hands[id].length]));
  return {
    phase: s.phase,
    level: s.level,
    levels: s.levels,
    lives: s.lives,
    livesMax: s.livesMax,
    stars: s.stars,
    starsMax: s.starsMax,
    pile: s.pile.slice(-14),
    pileSize: s.pile.length,
    burned: s.burned,
    hand: playerId !== null && s.players.includes(playerId) ? s.hands[playerId] : null, // jamais la main des autres
    counts,
    ready: s.ready,
    starVote: s.starVote,
    notice: s.notice,
    result: s.result,
    left: s.left,
    players: s.players,
    seed: s.seed,
  };
}
