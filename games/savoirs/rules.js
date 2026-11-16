// Six Savoirs : un circuit de 30 cases aux couleurs de 6 catégories. À ton tour, tu lances le dé, tu choisis d'avancer ou de
// reculer, puis tu réponds à une question à 4 choix de la catégorie de ta case. Bonne réponse : tu rejoues, et sur une case
// Sceau tu gagnes le sceau de sa catégorie. Le premier à réunir le nombre de sceaux demandé gagne.
// Les questions viennent du Quiz (games/quiz/questions.js), regroupées en 6 catégories.
import { QUESTIONS } from '../quiz/questions.js';

export const CATS = ['geo', 'histoire', 'sciences', 'divert', 'sport', 'lettres'];
export const CAT_NAMES = { geo: 'Géographie', histoire: 'Histoire', sciences: 'Sciences', divert: 'Divertissement', sport: 'Sport', lettres: 'Arts et lettres' };
// Les thèmes du Quiz rangés dans les 6 catégories.
const FROM_QUIZ = { geo: 'geo', histoire: 'histoire', sciences: 'sciences', pop: 'divert', table: 'divert', sport: 'sport', arts: 'lettres', langue: 'lettres' };
const BANK = Object.fromEntries(CATS.map((c) => [c, QUESTIONS.filter((q) => FROM_QUIZ[q.t] === c)]));

export const SIZE = 30; // cases du circuit
// Toutes les 5 cases, un Sceau (une catégorie chacun) ; entre deux, les catégories tournent pour que chaque coup de dé varie.
export const BOARD = Array.from({ length: SIZE }, (_, i) => {
  const block = Math.floor(i / 5);
  return i % 5 === 0 ? { cat: CATS[block], seal: true } : { cat: CATS[(block + i % 5) % 6], seal: false };
});

const ROLL_MS = 30_000; // pour lancer le dé
const MOVE_MS = 20_000; // pour choisir sa case
const REVEAL_MS = 4_000; // la bonne réponse reste affichée

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function setup(players, options, ctx) {
  const ids = players.map((p) => p.id);
  const goal = [3, 4, 6].includes(Number(options.goal)) ? Number(options.goal) : 4;
  return {
    players: ids,
    left: [],
    pos: Object.fromEntries(ids.map((id) => [id, 0])),
    seals: Object.fromEntries(ids.map((id) => [id, []])),
    goal,
    time: ([15, 20, 30].includes(Number(options.time)) ? Number(options.time) : 20) * 1000,
    cur: 0, // index dans players : à qui c'est
    phase: 'roll', // roll | move | question | reveal | over
    die: null,
    dests: [], // cases possibles après le dé
    question: null, // { cat, q, choices, correct }
    answer: null, // { choice, right } pendant la révélation
    used: Object.fromEntries(CATS.map((c) => [c, []])), // questions déjà posées, par catégorie
    streak: 0, // bonnes réponses d'affilée du joueur en cours
    deadline: ctx.now + ROLL_MS,
    log: [], // [{ id, text }] les derniers événements, publics
    winner: null,
  };
}

const active = (s) => s.players.filter((id) => !s.left.includes(id));
const current = (s) => s.players[s.cur];
const say = (s, text) => [...s.log, { n: (s.log.at(-1)?.n ?? 0) + 1, text }].slice(-30);

// Une question de la catégorie, jamais deux fois tant que la catégorie n'est pas épuisée.
function draw(s, cat, ctx) {
  const bank = BANK[cat];
  let used = s.used[cat];
  if (used.length >= bank.length) used = [];
  const free = bank.map((_, i) => i).filter((i) => !used.includes(i));
  const pick = free[Math.floor(ctx.random() * free.length)];
  const item = bank[pick];
  const order = shuffle([0, 1, 2, 3], ctx.random);
  return {
    used: { ...s.used, [cat]: [...used, pick] },
    question: { cat, q: item.q, choices: order.map((i) => item.a[i]), correct: order.indexOf(0) },
  };
}

function nextPlayer(s, ctx) {
  const alive = active(s);
  if (!alive.length) return { ...s, phase: 'over', deadline: null };
  let i = s.cur;
  for (let k = 0; k < s.players.length; k++) {
    i = (i + 1) % s.players.length;
    if (!s.left.includes(s.players[i])) break;
  }
  return { ...s, cur: i, phase: 'roll', die: null, dests: [], question: null, answer: null, streak: 0, deadline: ctx.now + ROLL_MS };
}

function roll(s, ctx) {
  const die = 1 + Math.floor(ctx.random() * 6);
  const p = s.pos[current(s)];
  const dests = [...new Set([(p + die) % SIZE, (p - die + SIZE) % SIZE])];
  return { ...s, phase: 'move', die, dests, deadline: ctx.now + MOVE_MS, log: say(s, `#${current(s)} lance ${die}.`) };
}

function goTo(s, to, ctx) {
  const id = current(s);
  const { used, question } = draw(s, BOARD[to].cat, ctx);
  return { ...s, pos: { ...s.pos, [id]: to }, phase: 'question', used, question, answer: null, deadline: ctx.now + s.time };
}

function answer(s, choice, ctx) {
  const id = current(s);
  const right = choice === s.question.correct;
  const sq = BOARD[s.pos[id]];
  let seals = s.seals;
  let gained = null;
  if (right && sq.seal && !s.seals[id].includes(sq.cat)) {
    seals = { ...seals, [id]: [...seals[id], sq.cat] };
    gained = sq.cat;
  }
  const text = right
    ? gained ? `#${id} répond juste et gagne le sceau ${CAT_NAMES[gained]} !` : `#${id} répond juste.`
    : choice === null ? `#${id} n’a pas répondu à temps.` : `#${id} se trompe.`;
  const t = { ...s, seals, phase: 'reveal', answer: { choice, right, gained }, streak: right ? s.streak + 1 : 0, deadline: ctx.now + REVEAL_MS, log: say(s, text) };
  if (seals[id].length >= s.goal) return { ...t, winner: id, log: say(t, `#${id} réunit ${s.goal} sceaux et gagne la partie !`) };
  return t;
}

// Après la révélation : on rejoue après une bonne réponse, sinon c'est au suivant.
function afterReveal(s, ctx) {
  if (s.winner !== null) return { ...s, phase: 'over', deadline: null };
  if (s.answer?.right && !s.left.includes(current(s))) return { ...s, phase: 'roll', die: null, dests: [], question: null, answer: null, deadline: ctx.now + ROLL_MS };
  return nextPlayer(s, ctx);
}

export function move(s, playerId, action, ctx) {
  if (s.phase === 'over') throw new Error('La partie est terminée.');
  if (current(s) !== playerId) throw new Error('Ce n’est pas ton tour.');
  const type = action?.type;
  switch (s.phase) {
    case 'roll':
      if (type !== 'roll') throw new Error('Lance le dé.');
      return { state: roll(s, ctx) };
    case 'move': {
      if (type !== 'move') throw new Error('Choisis ta case.');
      const to = Number(action.to);
      if (!s.dests.includes(to)) throw new Error('Tu ne peux aller que sur une des cases en surbrillance.');
      return { state: goTo(s, to, ctx) };
    }
    case 'question': {
      if (type !== 'answer') throw new Error('Réponds à la question.');
      const choice = Number(action.choice);
      if (!Number.isInteger(choice) || choice < 0 || choice > 3) throw new Error('Choisis une des quatre réponses.');
      return { state: answer(s, choice, ctx) };
    }
    case 'reveal':
      if (type !== 'next') throw new Error('Un instant : la réponse s’affiche.');
      return { state: afterReveal(s, ctx) };
    default:
      throw new Error('Coup inconnu.');
  }
}

// Le temps est écoulé : le jeu avance tout seul (dé lancé, meilleure case choisie, question ratée).
export function timeout(s, ctx) {
  switch (s.phase) {
    case 'roll': return { state: roll(s, ctx) };
    case 'move': {
      const id = current(s);
      // Une case Sceau qui manque, sinon la première.
      const best = s.dests.find((d) => BOARD[d].seal && !s.seals[id].includes(BOARD[d].cat)) ?? s.dests[0];
      return { state: goTo(s, best, ctx) };
    }
    case 'question': return { state: answer(s, null, ctx) };
    case 'reveal': return { state: afterReveal(s, ctx) };
    default: return { state: s };
  }
}

// Abandon : ses sceaux disparaissent avec lui ; si c'était son tour, on passe au suivant. Seul en jeu, le dernier gagne.
export function leave(s, playerId, ctx) {
  if (s.phase === 'over' || s.left.includes(playerId)) return { state: s };
  let t = { ...s, left: [...s.left, playerId], log: say(s, `#${playerId} quitte la partie.`) };
  const alive = active(t);
  if (s.players.length > 1 && alive.length === 1) return { state: { ...t, winner: alive[0], phase: 'over', deadline: null } };
  if (!alive.length) return { state: { ...t, phase: 'over', deadline: null } };
  if (current(t) === playerId) t = nextPlayer(t, ctx);
  return { state: t };
}

export function status(s) {
  const over = s.phase === 'over';
  return {
    turn: over ? null : current(s),
    over,
    winners: s.winner !== null ? [s.winner] : [],
    deadline: s.deadline,
  };
}

// Tout est public, sauf la bonne réponse tant que la question court.
export function view(s) {
  const question = s.question && {
    cat: s.question.cat,
    q: s.question.q,
    choices: s.question.choices,
    correct: s.phase === 'reveal' || s.phase === 'over' ? s.question.correct : null,
  };
  return {
    board: BOARD,
    cats: CATS,
    catNames: CAT_NAMES,
    players: s.players,
    left: s.left,
    pos: s.pos,
    seals: s.seals,
    goal: s.goal,
    cur: current(s),
    phase: s.phase,
    die: s.die,
    dests: s.dests,
    question,
    answer: s.answer,
    streak: s.streak,
    deadline: s.deadline,
    time: s.time,
    log: s.log,
    winner: s.winner,
  };
}
