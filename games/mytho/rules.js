// Mytho (le jeu du dictionnaire) : un mot rare s'affiche, chacun invente une fausse définition crédible,
// puis tout le monde vote pour celle qu'il croit vraie. +3 points si tu trouves la vraie, +2 par joueur piégé par la tienne.
import { WORDS } from './words.js';

const REVEAL_MS = 12000;
export const POINTS = { found: 3, fooled: 2 };

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function setup(players, options, ctx) {
  const rounds = Math.min(Number(options.rounds) || 5, WORDS.length);
  return startRound({
    players: players.map((p) => p.id),
    left: [],
    words: shuffle(WORDS, ctx.random).slice(0, rounds),
    writeTime: (Number(options.writeTime) || 90) * 1000,
    round: -1,
    phase: null,
    defs: {}, // id -> fausse définition
    options: [], // vote : [{ by: id | 'vrai', text }]
    votes: {}, // id -> index de l'option
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    gained: {},
    deadline: null,
  }, ctx);
}

const active = (s) => s.players.filter((id) => !s.left.includes(id));
const clean = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
const same = (a, b) => clean(a).toLowerCase().replace(/[.!…]+$/, '') === clean(b).toLowerCase().replace(/[.!…]+$/, '');

function startRound(s, ctx) {
  const round = s.round + 1;
  if (round >= s.words.length) return { ...s, phase: 'over', deadline: null };
  return { ...s, round, phase: 'write', defs: {}, options: [], votes: {}, gained: {}, deadline: ctx.now + s.writeTime };
}

function startVote(s, ctx) {
  const [, truth] = s.words[s.round];
  const options = shuffle([
    { by: 'vrai', text: truth },
    ...Object.entries(s.defs).map(([id, text]) => ({ by: Number(id), text })),
  ], ctx.random);
  // Sans fausse définition, voter n'a pas de sens : on montre directement la réponse.
  if (options.length < 2) return reveal({ ...s, options }, ctx);
  return { ...s, phase: 'vote', options, votes: {}, deadline: ctx.now + 45000 };
}

function voters(s) {
  return active(s);
}

function reveal(s, ctx) {
  const scores = { ...s.scores };
  const gained = {};
  const add = (id, n) => {
    gained[id] = (gained[id] || 0) + n;
    scores[id] = (scores[id] || 0) + n;
  };
  for (const [voter, index] of Object.entries(s.votes)) {
    const opt = s.options[index];
    if (opt.by === 'vrai') add(Number(voter), POINTS.found);
    else if (opt.by !== Number(voter)) add(opt.by, POINTS.fooled);
  }
  return { ...s, phase: 'reveal', scores, gained, deadline: ctx.now + REVEAL_MS };
}

export function move(s, playerId, action, ctx) {
  if (s.phase !== 'over' && (!s.players.includes(playerId) || s.left.includes(playerId))) throw new Error('Tu as quitté la partie.');
  if (s.phase === 'write') {
    if (action?.type !== 'define') throw new Error('Écris ta fausse définition.');
    const text = clean(action.text);
    if (text.length < 3) throw new Error('Ta définition est trop courte.');
    if (text.length > 160) throw new Error('Ta définition est trop longue : 160 caractères au plus.');
    if (playerId in s.defs) throw new Error('Tu as déjà écrit ta définition.');
    if (same(text, s.words[s.round][1])) throw new Error('C’est… la vraie définition ! Invente autre chose pour piéger les autres.');
    const t = { ...s, defs: { ...s.defs, [playerId]: text } };
    return { state: active(t).every((id) => id in t.defs) ? startVote(t, ctx) : t };
  }
  if (s.phase === 'vote') {
    if (action?.type !== 'vote') throw new Error('Vote pour la définition que tu crois vraie.');
    const index = Number(action.option);
    const opt = s.options[index];
    if (!opt) throw new Error('Définition inconnue.');
    if (opt.by === playerId) throw new Error('Tu ne peux pas voter pour ta propre définition.');
    if (playerId in s.votes) throw new Error('Tu as déjà voté.');
    const t = { ...s, votes: { ...s.votes, [playerId]: index } };
    return { state: voters(t).every((id) => id in t.votes) ? reveal(t, ctx) : t };
  }
  if (s.phase === 'reveal') {
    if (action?.type !== 'next') throw new Error('Attends la manche suivante.');
    return { state: startRound(s, ctx) };
  }
  throw new Error('La partie est terminée.');
}

export function timeout(s, ctx) {
  if (s.phase === 'write') return { state: startVote(s, ctx) };
  if (s.phase === 'vote') return { state: reveal(s, ctx) };
  if (s.phase === 'reveal') return { state: startRound(s, ctx) };
  return { state: s };
}

export function leave(s, playerId, ctx) {
  const t = { ...s, left: [...s.left, playerId] };
  if (!active(t).length) return { state: { ...t, phase: 'over', deadline: null } };
  if (t.phase === 'write' && active(t).every((id) => id in t.defs)) return { state: startVote(t, ctx) };
  if (t.phase === 'vote' && voters(t).every((id) => id in t.votes)) return { state: reveal(t, ctx) };
  return { state: t };
}

export function status(s) {
  if (s.phase === 'over') {
    const best = Math.max(0, ...active(s).map((id) => s.scores[id]));
    return { over: true, turn: null, winners: best > 0 ? active(s).filter((id) => s.scores[id] === best) : [] };
  }
  let turn = [];
  if (s.phase === 'write') turn = active(s).filter((id) => !(id in s.defs));
  else if (s.phase === 'vote') turn = voters(s).filter((id) => !(id in s.votes));
  else if (s.phase === 'reveal') turn = active(s); // n'importe qui peut passer à la suite
  return { over: false, turn, winners: [], deadline: s.deadline };
}

export function view(s, playerId) {
  const word = s.words[Math.max(0, Math.min(s.round, s.words.length - 1))];
  const shown = s.phase === 'reveal' || s.phase === 'over';
  return {
    phase: s.phase,
    round: s.round,
    rounds: s.words.length,
    deadline: s.deadline,
    word: word[0],
    truth: shown ? word[1] : null,
    mine: playerId !== null ? s.defs[playerId] ?? null : null,
    written: Object.keys(s.defs).map(Number),
    options: s.options.map((o, i) => ({
      index: i,
      text: o.text,
      mine: o.by === playerId,
      by: shown ? o.by : null,
      voters: shown ? Object.entries(s.votes).filter(([, v]) => v === i).map(([id]) => Number(id)) : null,
    })),
    myVote: playerId !== null && playerId in s.votes ? s.votes[playerId] : null,
    voted: Object.keys(s.votes).map(Number),
    scores: s.scores,
    gained: shown ? s.gained : {},
    players: s.players,
    left: s.left,
  };
}
