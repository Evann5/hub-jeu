// Six Savoirs : un plateau en roue aux couleurs de 6 catégories. À ton tour, tu lances le dé, tu choisis ta case parmi celles
// qu'on atteint en avançant d'autant, puis tu réponds à une question à 4 choix de sa catégorie. Bonne réponse : tu rejoues, et
// sur une case Sceau tu gagnes le sceau de sa catégorie. Avec tous tes sceaux, tu rejoins le Centre : réussis la question finale et tu gagnes.
// Les questions viennent du Quiz (games/quiz/questions.js), regroupées en 6 catégories.
import { QUESTIONS } from '../quiz/questions.js';

export const CATS = ['geo', 'histoire', 'sciences', 'divert', 'sport', 'lettres'];
export const CAT_NAMES = { geo: 'Géographie', histoire: 'Histoire', sciences: 'Sciences', divert: 'Divertissement', sport: 'Sport', lettres: 'Arts et lettres' };
// Les thèmes du Quiz rangés dans les 6 catégories.
const FROM_QUIZ = { geo: 'geo', histoire: 'histoire', sciences: 'sciences', pop: 'divert', table: 'divert', sport: 'sport', arts: 'lettres', langue: 'lettres' };
const BANK = Object.fromEntries(CATS.map((c) => [c, QUESTIONS.filter((q) => FROM_QUIZ[q.t] === c)]));

// Le plateau en roue : un anneau de 36 cases (un Sceau toutes les 6 cases, une case « Rejoue » au milieu de chaque arc),
// 6 rayons de 4 cases qui partent des Sceaux vers le Centre. On part du Centre ; on y revient, tous ses sceaux en poche,
// pour la question finale.
export const RING = 36;
export const SPOKE = 4;
export const HUB = RING + 6 * SPOKE; // la case du Centre
export const SIZE = HUB + 1;
const RING_CATS = [null, 2, 4, null, 3, 5]; // décalage de catégorie pour chaque case d'un arc (0 = Sceau, 3 = Rejoue)
const SPOKE_CATS = [1, 3, 5, 2];
const SPOKE_R = [360, 290, 220, 150]; // rayon de chaque case d'un rayon, sur un plateau de 1000 × 1000

const at = (deg, r) => ({ x: Math.round(500 + r * Math.cos((deg * Math.PI) / 180)), y: Math.round(500 + r * Math.sin((deg * Math.PI) / 180)) });

export const BOARD = [];
export const ADJ = [];
for (let i = 0; i < RING; i++) {
  const k = Math.floor(i / 6);
  const r = i % 6;
  const pos = at(-90 + i * 10, 440);
  if (r === 0) BOARD.push({ ...pos, cat: CATS[k], seal: true });
  else if (r === 3) BOARD.push({ ...pos, cat: null, again: true });
  else BOARD.push({ ...pos, cat: CATS[(k + RING_CATS[r]) % 6] });
  ADJ.push([(i + 1) % RING, (i + RING - 1) % RING]);
}
for (let k = 0; k < 6; k++) {
  for (let j = 0; j < SPOKE; j++) {
    const i = RING + k * SPOKE + j;
    BOARD.push({ ...at(-90 + k * 60, SPOKE_R[j]), cat: CATS[(k + SPOKE_CATS[j]) % 6], spoke: true });
    ADJ.push([j === 0 ? k * 6 : i - 1, j === SPOKE - 1 ? HUB : i + 1]);
    if (j === 0) ADJ[k * 6].push(i);
  }
}
BOARD.push({ x: 500, y: 500, cat: null, hub: true });
ADJ.push(Array.from({ length: 6 }, (_, k) => RING + k * SPOKE + SPOKE - 1));

// Les cases où l'on peut finir en avançant de `steps` cases sans repasser deux fois par la même.
export function reach(from, steps) {
  const out = new Set();
  const seen = new Set([from]);
  const walk = (node, left) => {
    if (!left) { out.add(node); return; }
    for (const next of ADJ[node]) {
      if (seen.has(next)) continue;
      seen.add(next);
      walk(next, left - 1);
      seen.delete(next);
    }
  };
  walk(from, steps);
  return [...out].sort((a, b) => a - b);
}

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
    pos: Object.fromEntries(ids.map((id) => [id, HUB])), // tout le monde part du Centre
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
  const dests = reach(s.pos[current(s)], die);
  return { ...s, phase: 'move', die, dests, deadline: ctx.now + MOVE_MS, log: say(s, `#${current(s)} lance ${die}.`) };
}

const ready = (s, id) => s.seals[id].length >= s.goal; // tous ses sceaux : direction le Centre

function goTo(s, to, ctx) {
  const id = current(s);
  const sq = BOARD[to];
  const pos = { ...s.pos, [id]: to };
  if (sq.again) return { ...s, pos, phase: 'roll', die: null, dests: [], deadline: ctx.now + ROLL_MS, log: say(s, `#${id} tombe sur une case Rejoue.`) };
  // Au Centre, une catégorie au hasard ; avec tous ses sceaux, c'est la question finale.
  const cat = sq.hub ? CATS[Math.floor(ctx.random() * CATS.length)] : sq.cat;
  const { used, question } = draw(s, cat, ctx);
  const final = Boolean(sq.hub && ready(s, id));
  return { ...s, pos, phase: 'question', used, question: { ...question, final }, answer: null, deadline: ctx.now + s.time };
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
  if (right && s.question.final) return { ...t, winner: id, log: say(t, `#${id} réussit la question finale et gagne la partie !`) };
  if (gained && seals[id].length >= s.goal) return { ...t, log: say(t, `#${id} a ses ${s.goal} sceaux : direction le Centre !`) };
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
      // Le Centre si tous les sceaux sont là, sinon une case Sceau qui manque, sinon la première.
      const best = (ready(s, id) && s.dests.includes(HUB) ? HUB : null)
        ?? s.dests.find((d) => BOARD[d].seal && !s.seals[id].includes(BOARD[d].cat)) ?? s.dests[0];
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
    final: s.question.final,
    correct: s.phase === 'reveal' || s.phase === 'over' ? s.question.correct : null,
  };
  return {
    board: BOARD,
    hub: HUB,
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
