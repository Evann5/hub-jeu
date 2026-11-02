// Quiz : des questions à 4 réponses, tout le monde répond en même temps. Bonne réponse = 500 points,
// plus un bonus de rapidité jusqu'à 500. Après chaque question, la bonne réponse et les points sont montrés.
import { QUESTIONS, THEMES } from './questions.js';

const READY_MS = 4000; // « Prêts ? » avant la première question
const REVEAL_MS = 6000; // affichage de la bonne réponse

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function setup(players, options, ctx) {
  const pool = options.theme && options.theme !== 'tout' ? QUESTIONS.filter((q) => q.t === options.theme) : QUESTIONS;
  const count = Math.min(Number(options.count) || 10, pool.length);
  const questions = shuffle(pool, ctx.random).slice(0, count).map((item) => {
    const order = shuffle([0, 1, 2, 3], ctx.random);
    return { q: item.q, theme: THEMES[item.t], choices: order.map((i) => item.a[i]), correct: order.indexOf(0) };
  });
  return {
    players: players.map((p) => p.id),
    left: [],
    questions,
    time: (Number(options.time) || 15) * 1000,
    index: -1,
    phase: 'ready',
    startedAt: ctx.now,
    deadline: ctx.now + READY_MS,
    answers: {}, // id -> { choice, ms }
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    gained: {},
    history: [], // par question : nombre de bonnes réponses
  };
}

const active = (s) => s.players.filter((id) => !s.left.includes(id));

function nextQuestion(s, ctx) {
  const index = s.index + 1;
  if (index >= s.questions.length) return { ...s, phase: 'over', deadline: null, answers: {} };
  return { ...s, index, phase: 'question', startedAt: ctx.now, deadline: ctx.now + s.time, answers: {}, gained: {} };
}

function reveal(s, ctx) {
  const q = s.questions[s.index];
  const scores = { ...s.scores };
  const gained = {};
  for (const [id, a] of Object.entries(s.answers)) {
    if (a.choice !== q.correct) continue;
    const speed = Math.max(0, 1 - a.ms / s.time);
    gained[id] = 500 + Math.round(500 * speed);
    scores[id] = (scores[id] || 0) + gained[id];
  }
  return { ...s, phase: 'reveal', scores, gained, deadline: ctx.now + REVEAL_MS, history: [...s.history, Object.keys(gained).length] };
}

export function move(s, playerId, action, ctx) {
  if (s.phase !== 'question') throw new Error('Attends la prochaine question.');
  if (action?.type !== 'answer') throw new Error('Choisis une réponse.');
  const choice = Number(action.choice);
  if (![0, 1, 2, 3].includes(choice)) throw new Error('Réponse inconnue.');
  if (playerId in s.answers) throw new Error('Tu as déjà répondu.');
  const t = { ...s, answers: { ...s.answers, [playerId]: { choice, ms: Math.max(0, ctx.now - s.startedAt) } } };
  return { state: active(t).every((id) => id in t.answers) ? reveal(t, ctx) : t };
}

export function timeout(s, ctx) {
  if (s.phase === 'question') return { state: reveal(s, ctx) };
  return { state: nextQuestion(s, ctx) };
}

export function leave(s, playerId, ctx) {
  const t = { ...s, left: [...s.left, playerId] };
  if (!active(t).length) return { state: { ...t, phase: 'over', deadline: null } };
  if (t.phase === 'question' && active(t).every((id) => id in t.answers)) return { state: reveal(t, ctx) };
  return { state: t };
}

function ranking(s) {
  return [...s.players].sort((a, b) => s.scores[b] - s.scores[a]);
}

export function status(s) {
  if (s.phase === 'over') {
    const best = Math.max(...active(s).map((id) => s.scores[id]), 0);
    return { over: true, turn: null, winners: active(s).length ? active(s).filter((id) => s.scores[id] === best && best > 0) : [] };
  }
  const turn = s.phase === 'question' ? active(s).filter((id) => !(id in s.answers)) : [];
  return { over: false, turn, winners: [], deadline: s.deadline };
}

export function view(s, playerId) {
  const q = s.questions[s.index];
  const showAnswer = s.phase === 'reveal' || s.phase === 'over';
  const counts = [0, 0, 0, 0];
  if (showAnswer) for (const a of Object.values(s.answers)) counts[a.choice]++;
  return {
    phase: s.phase,
    index: s.index,
    total: s.questions.length,
    deadline: s.deadline,
    time: s.time,
    question: q && s.phase !== 'ready' ? { q: q.q, theme: q.theme, choices: q.choices } : null,
    correct: showAnswer && q ? q.correct : null,
    counts: showAnswer ? counts : null,
    mine: playerId !== null && s.answers[playerId] ? s.answers[playerId].choice : null,
    answered: Object.keys(s.answers).map(Number),
    gained: showAnswer ? s.gained : {},
    scores: s.scores,
    ranking: ranking(s),
    left: s.left,
    players: s.players,
  };
}
