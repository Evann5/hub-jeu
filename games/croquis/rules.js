// Croquis : un jeu de dessin à deviner. Les règles sont pures : ni réseau, ni base, ni affichage.
// L'heure vient de ctx.now, le hasard de ctx.random.
//
// Un tour de dessin = trois phases :
//   « choosing » : le dessinateur choisit 1 mot parmi 3 (20 s, sinon le premier est pris).
//   « drawing »  : il dessine, les autres tapent leurs propositions. Fin quand tout le monde a trouvé ou au chrono.
//                  Des lettres du mot se dévoilent en route : chaque dévoilement est un « minuteur » du hub,
//                  donc status().deadline vaut la prochaine échéance (indice ou fin), et view().endsAt la fin du tour.
//   « reveal »   : le mot et les points du tour s'affichent quelques secondes, puis tour suivant.
import { WORDS } from './words.js';

export const CHOOSE_MS = 20_000;
export const REVEAL_MS = 7_000;
export const HINT_SHARES = [0.35, 0.55, 0.75]; // à quel moment du tour chaque lettre se dévoile
export const GUESS_POINTS = [300, 240, 200, 170, 140, 120, 100, 80, 60]; // selon l'ordre d'arrivée, puis 50
export const MIN_GUESS_POINTS = 50;
export const DRAWER_POINTS = 40; // pour le dessinateur, par personne qui trouve
export const PALETTE_SIZE = 10;
export const WIDTHS = 3;
export const MAX_STROKES = 120;
export const MAX_POINTS_PER_STROKE = 400;
export const MAX_POINTS_TOTAL = 5000;
export const FEED_SIZE = 40;
const TOLERANCE_MS = 60; // le hub peut déclencher le minuteur quelques ms avant l'heure exacte

const ARTICLES = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd']);

// ——— Textes ———

function plainWords(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

// Forme de comparaison : sans accents, casse, ponctuation, espaces, article du début, ni « s » final.
export function normalize(text) {
  let w = plainWords(text);
  while (w.length > 1 && ARTICLES.has(w[0])) w = w.slice(1);
  const joined = w.join('');
  return joined.length > 3 ? joined.replace(/s$/, '') : joined;
}

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = keep;
    }
  }
  return row[b.length];
}

// 'right' (le mot), 'close' (presque : une faute, deux sur un mot de 8 lettres ou plus) ou 'wrong'.
export function judge(guess, word) {
  const g = normalize(guess);
  const w = normalize(word);
  if (!g) return 'wrong';
  if (g === w) return 'right';
  const allowed = w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0;
  return allowed > 0 && distance(g, w) <= allowed ? 'close' : 'wrong';
}

// ——— Hasard (toujours via ctx.random) ———

const pickIndex = (random, length) => Math.min(length - 1, Math.floor(random() * length));

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = pickIndex(random, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickWords(used, random) {
  let pool = WORDS.filter((w) => !used.includes(w));
  let nextUsed = used;
  if (pool.length < 3) {
    pool = WORDS.slice();
    nextUsed = [];
  }
  const choices = [];
  for (let k = 0; k < 3; k++) choices.push(pool.splice(pickIndex(random, pool.length), 1)[0]);
  return { choices, used: [...nextUsed, ...choices] };
}

// ——— Déroulement ———

const active = (s) => s.players.filter((id) => !s.left.includes(id));
const guessers = (s) => active(s).filter((id) => id !== s.drawer);

function cleanOptions(options = {}) {
  const num = (v, min, max, def) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  return {
    seconds: [60, 80, 100].includes(Number(options.seconds)) ? Number(options.seconds) : 80,
    turns: num(options.turns, 1, 5, 2),
  };
}

// Commence le tour n° k (ou le premier suivant dont le dessinateur est encore là) ; plus personne : fin de partie.
function beginTurn(state, k, ctx) {
  const total = state.players.length * state.options.turns;
  if (active(state).length < 2) return { ...state, phase: 'over' };
  let turn = k;
  while (turn < total && state.left.includes(state.players[turn % state.players.length])) turn++;
  if (turn >= total) return { ...state, phase: 'over' };
  const { choices, used } = pickWords(state.usedWords, ctx.random);
  return {
    ...state,
    phase: 'choosing',
    turn,
    drawer: state.players[turn % state.players.length],
    usedWords: used,
    choices,
    word: null,
    hintOrder: [],
    hints: 0,
    hintAt: [],
    startedAt: null,
    endsAt: null,
    chooseUntil: ctx.now + CHOOSE_MS,
    revealUntil: null,
    strokes: [],
    found: [],
    gained: {},
    feed: [],
  };
}

function startDrawing(state, word, ctx) {
  const slots = [...word].map((ch, i) => (/[\p{L}\p{N}]/u.test(ch) ? i : -1)).filter((i) => i >= 0);
  const count = Math.min(HINT_SHARES.length, Math.max(1, Math.floor(slots.length / 3)));
  const duration = state.options.seconds * 1000;
  return {
    ...state,
    phase: 'drawing',
    word,
    choices: [],
    chooseUntil: null,
    hintOrder: shuffle(slots, ctx.random),
    hints: 0,
    hintAt: HINT_SHARES.slice(0, count).map((share) => ctx.now + Math.round(duration * share)),
    startedAt: ctx.now,
    endsAt: ctx.now + duration,
  };
}

function endTurn(state, ctx) {
  return { ...state, phase: 'reveal', revealUntil: ctx.now + REVEAL_MS };
}

function score(state, id, points) {
  return {
    scores: { ...state.scores, [id]: (state.scores[id] || 0) + points },
    gained: { ...state.gained, [id]: (state.gained[id] || 0) + points },
  };
}

// ——— Mise en place ———

// players : [{ id, pseudo }] dans l'ordre des places. Chacun dessine « turns » fois.
export function setup(players, options, ctx) {
  return beginTurn({
    players: players.map((p) => p.id),
    left: [],
    options: cleanOptions(options),
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    usedWords: [],
    phase: 'choosing',
  }, 0, ctx);
}

// ——— Les coups ———

function cleanStroke(action) {
  const c = Number(action.c);
  const w = Number(action.w);
  if (!Number.isInteger(c) || c < -1 || c >= PALETTE_SIZE) throw new Error('Couleur inconnue.');
  if (!Number.isInteger(w) || w < 0 || w >= WIDTHS) throw new Error('Épaisseur inconnue.');
  const raw = action.p;
  if (!Array.isArray(raw) || raw.length < 2 || raw.length % 2 !== 0) throw new Error('Trait invalide.');
  if (raw.length > MAX_POINTS_PER_STROKE * 2) throw new Error('Trait trop long : lève le crayon plus souvent.');
  const p = raw.map((v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error('Trait invalide.');
    return Math.min(1000, Math.max(0, Math.round(n)));
  });
  return { c, w, p };
}

const pointsOf = (strokes) => strokes.reduce((sum, s) => sum + s.p.length / 2, 0);

// { type: 'choose', index }       le dessinateur prend un des 3 mots
// { type: 'stroke', c, w, p }     un trait fini : couleur (0..9, -1 = gomme), épaisseur (0..2), points [x, y, x, y…] de 0 à 1000
// { type: 'undo' } | { type: 'clear' }
// { type: 'guess', text }         une proposition
export function move(state, playerId, action, ctx) {
  if (state.phase === 'over') throw new Error('La partie est terminée.');
  if (state.left.includes(playerId)) throw new Error('Tu ne joues plus dans cette partie.');
  const type = action?.type;
  const isDrawer = playerId === state.drawer;

  if (type === 'choose') {
    if (state.phase !== 'choosing') throw new Error('Le mot est déjà choisi.');
    if (!isDrawer) throw new Error('C’est le dessinateur qui choisit le mot.');
    const word = state.choices[Number(action.index)];
    if (!word) throw new Error('Choisis un des trois mots.');
    return { state: startDrawing(state, word, ctx) };
  }

  if (type === 'stroke' || type === 'undo' || type === 'clear') {
    if (state.phase !== 'drawing') throw new Error('On ne dessine pas pour le moment.');
    if (!isDrawer) throw new Error('Seul le dessinateur peut dessiner.');
    if (type === 'undo') return { state: { ...state, strokes: state.strokes.slice(0, -1) } };
    if (type === 'clear') return { state: { ...state, strokes: [] } };
    const stroke = cleanStroke(action);
    if (state.strokes.length >= MAX_STROKES || pointsOf(state.strokes) + stroke.p.length / 2 > MAX_POINTS_TOTAL) {
      throw new Error('La feuille est pleine : efface ou annule des traits.');
    }
    return { state: { ...state, strokes: [...state.strokes, stroke] } };
  }

  if (type === 'guess') {
    if (state.phase !== 'drawing') throw new Error('Attends le prochain dessin pour proposer.');
    if (isDrawer) throw new Error('Tu dessines : ce sont les autres qui devinent.');
    if (state.found.includes(playerId)) throw new Error('Tu as déjà trouvé : attends les autres.');
    const text = String(action.text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!text) throw new Error('Écris une proposition.');
    const verdict = judge(text, state.word);
    if (verdict !== 'right') {
      const feed = [...state.feed, { id: playerId, kind: verdict, text }].slice(-FEED_SIZE);
      return { state: { ...state, feed } };
    }
    // Bonne réponse : points selon l'ordre d'arrivée, et des points pour le dessinateur.
    const rank = state.found.length;
    const mine = score(state, playerId, GUESS_POINTS[rank] ?? MIN_GUESS_POINTS);
    const next = {
      ...state,
      found: [...state.found, playerId],
      feed: [...state.feed, { id: playerId, kind: 'found' }].slice(-FEED_SIZE),
      scores: mine.scores,
      gained: mine.gained,
    };
    const draw = score(next, state.drawer, DRAWER_POINTS);
    next.scores = draw.scores;
    next.gained = draw.gained;
    return { state: guessers(next).every((id) => next.found.includes(id)) ? endTurn(next, ctx) : next };
  }

  throw new Error('Action inconnue.');
}

// Le minuteur du hub est échu : choix du mot par défaut, nouvel indice, fin du tour, ou tour suivant.
export function timeout(state, ctx) {
  const now = ctx.now + TOLERANCE_MS;
  if (state.phase === 'choosing') return { state: startDrawing(state, state.choices[0], ctx) };
  if (state.phase === 'drawing') {
    if (now >= state.endsAt) return { state: endTurn(state, ctx) };
    const due = state.hintAt.filter((t) => t <= now).length;
    return { state: due > state.hints ? { ...state, hints: due } : state };
  }
  if (state.phase === 'reveal') return { state: beginTurn(state, state.turn + 1, ctx) };
  return { state };
}

// Abandon : on sort de la partie. Un dessinateur qui part arrête le tour ; il faut rester au moins deux.
export function leave(state, playerId, ctx) {
  if (state.phase === 'over' || state.left.includes(playerId)) return { state };
  const next = { ...state, left: [...state.left, playerId] };
  if (active(next).length < 2) return { state: { ...next, phase: 'over' } };
  if (playerId === state.drawer) {
    if (state.phase === 'choosing') return { state: beginTurn(next, state.turn + 1, ctx) };
    if (state.phase === 'drawing') return { state: endTurn(next, ctx) };
    return { state: next };
  }
  if (state.phase === 'drawing' && guessers(next).every((id) => next.found.includes(id))) return { state: endTurn(next, ctx) };
  return { state: next };
}

// ——— Ce que voit chaque personne ———

// playerId null = spectateur. Le mot n'est révélé qu'au dessinateur pendant le tour, et à tous une fois le tour fini.
// Une proposition « presque » n'est montrée qu'à son auteur ; une bonne réponse n'est jamais montrée (seulement « a trouvé »).
export function view(state, playerId) {
  const out = {
    phase: state.phase,
    players: state.players,
    left: state.left,
    options: state.options,
    scores: state.scores,
    drawer: state.drawer,
    turn: state.turn + 1,
    totalTurns: state.players.length * state.options.turns,
    round: Math.min(state.options.turns, Math.floor(state.turn / state.players.length) + 1),
    rounds: state.options.turns,
    strokes: state.strokes,
    found: state.found,
  };
  if (state.phase === 'choosing') {
    out.choices = playerId === state.drawer ? state.choices : null;
    out.chooseUntil = state.chooseUntil;
  }
  if (state.phase === 'drawing' || state.phase === 'reveal') {
    out.endsAt = state.endsAt;
    out.feed = state.feed.filter((e) => e.kind !== 'close' || e.id === playerId);
  }
  if (state.phase === 'drawing') {
    const shown = new Set(state.hintOrder.slice(0, state.hints));
    out.length = state.word.length;
    out.mask = [...state.word].map((ch, i) => (/[\p{L}\p{N}]/u.test(ch) ? (shown.has(i) ? ch : '_') : ch));
    if (playerId === state.drawer) out.word = state.word;
  }
  if (state.phase === 'reveal') {
    out.word = state.word;
    out.gained = state.gained;
    out.revealUntil = state.revealUntil;
  }
  return out;
}

export function status(state) {
  if (state.phase === 'over') {
    const parts = active(state);
    const best = Math.max(...parts.map((id) => state.scores[id] || 0));
    return { turn: null, over: true, winners: parts.filter((id) => (state.scores[id] || 0) === best), deadline: null };
  }
  if (state.phase === 'choosing') return { turn: [state.drawer], over: false, winners: [], deadline: state.chooseUntil };
  if (state.phase === 'reveal') return { turn: [], over: false, winners: [], deadline: state.revealUntil };
  const nextHint = state.hintAt[state.hints];
  return {
    turn: [state.drawer, ...guessers(state).filter((id) => !state.found.includes(id))],
    over: false,
    winners: [],
    deadline: nextHint !== undefined && nextHint < state.endsAt ? nextHint : state.endsAt,
  };
}
