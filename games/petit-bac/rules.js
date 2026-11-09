// Petit Bac : une lettre, des catégories, tout le monde écrit en même temps.
// Les règles sont pures : ni réseau, ni base, ni affichage. L'heure vient de ctx.now, le hasard de ctx.random.
//
// Une manche = deux phases :
//   « writing » : chacun écrit ses réponses (cachées aux autres). Fin au chrono, ou 10 s après un « Stop ! ».
//   « review »  : toutes les réponses sont montrées, on peut contester ; les points sont calculés en direct
//                 et deviennent définitifs quand tout le monde a fini de vérifier (ou au chrono).
import { CATEGORIES } from './categories.js';

export const LETTERS = 'ABCDEFGHIJLMNOPQRSTUV'.split(''); // sans K, W, X, Y, Z
export const RARE_LETTERS = ['K', 'W', 'X', 'Y', 'Z'];
export const STOP_GRACE_MS = 10_000; // temps laissé aux autres après un « Stop ! »
export const REVIEW_MS = 90_000; // temps pour lire et contester
export const MAX_LEN = 40; // longueur d'une réponse
export const POINTS = { unique: 10, duplicate: 5 };

const ARTICLES = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd']);

// ——— Textes ———

function words(text) {
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

// Forme de comparaison : sans accents ni casse, sans ponctuation ni espaces, sans article au début
// (« la baleine », « Baleine » et « l'baleine » comptent comme le même mot).
export function normalize(text) {
  let w = words(text);
  while (w.length > 1 && ARTICLES.has(w[0])) w = w.slice(1);
  return w.join('');
}

// Une réponse vide, mauvaise lettre ou bonne. « Les Misérables » est bon pour L comme pour M.
export function checkAnswer(text, letter) {
  const w = words(text);
  if (!w.length) return 'empty';
  const l = letter.toLowerCase();
  return w.join('').startsWith(l) || normalize(text).startsWith(l) ? 'ok' : 'letter';
}

function cleanText(x) {
  return String(x ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LEN);
}

function cleanAnswers(list, count) {
  if (!Array.isArray(list)) throw new Error('Réponses invalides : recharge la page.');
  return Array.from({ length: count }, (_, i) => cleanText(list[i]));
}

// ——— Hasard (toujours via ctx.random) ———

const pickIndex = (random, length) => Math.min(length - 1, Math.floor(random() * length));

function pickCategories(count, usedIdx, random) {
  let pool = CATEGORIES.map((_, i) => i).filter((i) => !usedIdx.includes(i));
  let used = usedIdx;
  if (pool.length < count) {
    pool = CATEGORIES.map((_, i) => i);
    used = [];
  }
  const chosen = [];
  for (let k = 0; k < count; k++) chosen.push(pool.splice(pickIndex(random, pool.length), 1)[0]);
  return { chosen, used: [...used, ...chosen] };
}

function pickLetter(rare, usedLetters, random) {
  const allowed = rare ? [...LETTERS, ...RARE_LETTERS].sort() : LETTERS;
  let pool = allowed.filter((l) => !usedLetters.includes(l));
  let used = usedLetters;
  if (!pool.length) {
    pool = allowed;
    used = [];
  }
  const letter = pool[pickIndex(random, pool.length)];
  return { letter, used: [...used, letter] };
}

// ——— Mise en place ———

function startRound(state, round, ctx) {
  const { letter, used: usedLetters } = pickLetter(state.options.rareLetters, state.usedLetters, ctx.random);
  const { chosen, used: usedCats } = pickCategories(state.options.categories, state.usedCats, ctx.random);
  return {
    ...state,
    phase: 'writing',
    round,
    letter,
    usedLetters,
    usedCats,
    categories: chosen.map((i) => CATEGORIES[i]),
    answers: {},
    stopBy: null,
    votes: {},
    ready: [],
    deadline: ctx.now + state.options.seconds * 1000,
  };
}

function cleanOptions(options = {}) {
  const num = (v, min, max, def) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  return {
    seconds: [60, 90, 120].includes(Number(options.seconds)) ? Number(options.seconds) : 90,
    rounds: num(options.rounds, 1, 10, 4),
    categories: num(options.categories, 6, 8, 6),
    rareLetters: options.rareLetters === true,
  };
}

// players : [{ id, pseudo }] dans l'ordre des places.
export function setup(players, options, ctx) {
  const base = {
    players: players.map((p) => p.id),
    left: [],
    options: cleanOptions(options),
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    history: [], // [{ round, letter, points: { id: points } }]
    usedLetters: [],
    usedCats: [],
  };
  return startRound(base, 1, ctx);
}

const active = (s) => s.players.filter((id) => !s.left.includes(id));

// ——— Calcul des points d'une manche ———

// Pour chaque catégorie, une case par joueur : { id, text, state, votes, need, points }.
// state : 'empty' (vide) | 'letter' (mauvaise lettre) | 'refused' (contestée par la majorité)
//       | 'duplicate' (même réponse qu'un autre) | 'unique'.
export function evaluate(state) {
  const parts = active(state);
  const voters = parts.length - 1;
  const need = Math.floor(voters / 2) + 1;
  return state.categories.map((_, ci) => {
    const row = parts.map((id) => {
      const text = (state.answers[id] || [])[ci] || '';
      const check = checkAnswer(text, state.letter);
      const votes = check === 'ok'
        ? (state.votes[`${ci}:${id}`] || []).filter((v) => v !== id && parts.includes(v)).length
        : 0;
      const refused = check === 'ok' && voters > 0 && votes >= need;
      return { id, text, state: check === 'ok' ? (refused ? 'refused' : 'unique') : check, votes, need, points: 0 };
    });
    const counts = new Map();
    for (const c of row) {
      if (c.state === 'unique') counts.set(normalize(c.text), (counts.get(normalize(c.text)) || 0) + 1);
    }
    for (const c of row) {
      if (c.state !== 'unique') continue;
      if (counts.get(normalize(c.text)) > 1) c.state = 'duplicate';
      c.points = c.state === 'unique' ? POINTS.unique : POINTS.duplicate;
    }
    return row;
  });
}

function roundPoints(state) {
  const points = Object.fromEntries(active(state).map((id) => [id, 0]));
  for (const row of evaluate(state)) for (const c of row) points[c.id] += c.points;
  return points;
}

// Fin de la vérification : on fige les points, puis manche suivante ou fin de partie.
function finishReview(state, ctx) {
  const points = roundPoints(state);
  const scores = { ...state.scores };
  for (const [id, p] of Object.entries(points)) scores[id] = (scores[id] || 0) + p;
  const next = {
    ...state,
    scores,
    history: [...state.history, { round: state.round, letter: state.letter, points }],
  };
  if (state.round >= state.options.rounds) return { ...next, phase: 'over', deadline: null, ready: [] };
  return startRound(next, state.round + 1, ctx);
}

function toReview(state, ctx) {
  return { ...state, phase: 'review', ready: [], votes: {}, deadline: ctx.now + REVIEW_MS };
}

// ——— Les coups ———

// { type: 'draft', answers: [..] }        brouillon des réponses (enregistré sans fin de manche)
// { type: 'stop', answers: [..] }         « Stop ! » (toutes les cases remplies, bonne lettre)
// { type: 'contest', cat, target }        contester (ou retirer sa contestation) la réponse d'un autre
// { type: 'ready' }                       j'ai fini de vérifier
export function move(state, playerId, action, ctx) {
  if (state.phase === 'over') throw new Error('La partie est terminée.');
  if (!active(state).includes(playerId)) throw new Error('Tu ne joues plus dans cette partie.');
  const type = action?.type;
  const count = state.categories.length;

  if (type === 'draft') {
    if (state.phase !== 'writing') return { state }; // brouillon arrivé après la fin de la manche : sans importance
    return { state: { ...state, answers: { ...state.answers, [playerId]: cleanAnswers(action.answers, count) } } };
  }

  if (type === 'stop') {
    if (state.phase !== 'writing') throw new Error('La manche est déjà terminée.');
    if (state.stopBy) throw new Error('Quelqu’un a déjà crié « Stop ! ».');
    const answers = action.answers === undefined ? state.answers[playerId] || [] : cleanAnswers(action.answers, count);
    for (let i = 0; i < count; i++) {
      const check = checkAnswer(answers[i] || '', state.letter);
      if (check === 'empty') throw new Error(`Il te manque encore une réponse : « ${state.categories[i]} ».`);
      if (check === 'letter') throw new Error(`« ${answers[i]} » ne commence pas par ${state.letter} (${state.categories[i]}).`);
    }
    return {
      state: {
        ...state,
        answers: { ...state.answers, [playerId]: answers },
        stopBy: playerId,
        deadline: Math.min(state.deadline, ctx.now + STOP_GRACE_MS),
      },
    };
  }

  if (type === 'contest') {
    if (state.phase !== 'review') throw new Error('Tu pourras contester quand la manche sera terminée.');
    const cat = Number(action.cat);
    const target = Number(action.target);
    if (!Number.isInteger(cat) || cat < 0 || cat >= count || !active(state).includes(target)) throw new Error('Réponse inconnue.');
    if (target === playerId) throw new Error('Tu ne peux pas contester ta propre réponse.');
    const cell = evaluate(state)[cat].find((c) => c.id === target);
    if (cell.state === 'empty' || cell.state === 'letter') throw new Error('Cette réponse ne rapporte déjà aucun point.');
    const key = `${cat}:${target}`;
    const current = state.votes[key] || [];
    const next = current.includes(playerId) ? current.filter((v) => v !== playerId) : [...current, playerId];
    return { state: { ...state, votes: { ...state.votes, [key]: next } } };
  }

  if (type === 'ready') {
    if (state.phase !== 'review') throw new Error('Pas encore : la manche n’est pas terminée.');
    if (state.ready.includes(playerId)) return { state };
    const next = { ...state, ready: [...state.ready, playerId] };
    return { state: active(next).every((id) => next.ready.includes(id)) ? finishReview(next, ctx) : next };
  }

  throw new Error('Action inconnue.');
}

// Le minuteur est échu : fin de la saisie, ou fin de la vérification.
export function timeout(state, ctx) {
  if (state.phase === 'writing') return { state: toReview(state, ctx) };
  if (state.phase === 'review') return { state: finishReview(state, ctx) };
  return { state };
}

// Abandon : le joueur sort de la partie (ses réponses ne comptent plus). Moins de deux joueurs : fin.
export function leave(state, playerId, ctx) {
  if (state.phase === 'over' || state.left.includes(playerId)) return { state };
  const next = { ...state, left: [...state.left, playerId] };
  if (active(next).length < 2) return { state: { ...next, phase: 'over', deadline: null } };
  if (next.phase === 'review' && active(next).every((id) => next.ready.includes(id))) return { state: finishReview(next, ctx) };
  return { state: next };
}

// ——— Ce que voit chaque personne ———

// playerId null = spectateur. Pendant la saisie, les réponses des autres ne sortent JAMAIS d'ici :
// on ne donne que le nombre de cases remplies. Une fois la manche terminée, tout est public.
export function view(state, playerId) {
  const parts = active(state);
  const out = {
    phase: state.phase,
    players: state.players,
    left: state.left,
    options: state.options,
    round: state.round,
    rounds: state.options.rounds,
    letter: state.letter,
    categories: state.categories,
    scores: state.scores,
    history: state.history,
    stopBy: state.stopBy,
  };
  if (state.phase === 'writing') {
    out.mine = parts.includes(playerId) ? cleanAnswers(state.answers[playerId] || [], state.categories.length) : null;
    out.progress = Object.fromEntries(parts.map((id) => [
      id,
      (state.answers[id] || []).filter((a) => a !== '').length,
    ]));
  }
  if (state.phase === 'review') {
    const grid = evaluate(state);
    out.grid = grid.map((row, ci) => row.map((c) => ({
      ...c,
      mine: playerId !== null && (state.votes[`${ci}:${c.id}`] || []).includes(playerId),
    })));
    out.roundPoints = roundPoints(state);
    out.ready = state.ready;
  }
  return out;
}

export function status(state) {
  if (state.phase === 'over') {
    const parts = active(state);
    const best = Math.max(...parts.map((id) => state.scores[id] || 0));
    return { turn: null, over: true, winners: parts.filter((id) => (state.scores[id] || 0) === best), deadline: null };
  }
  const parts = active(state);
  return {
    turn: state.phase === 'writing' ? parts : parts.filter((id) => !state.ready.includes(id)),
    over: false,
    winners: [],
    deadline: state.deadline,
  };
}
