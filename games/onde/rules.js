// Même longueur d'onde : un cadran de 0 à 180° entre deux extrêmes, une zone cible cachée. Le meneur la voit et donne
// un indice ; son équipe place une aiguille commune (la dernière position compte) puis la verrouille ensemble.
// 4 / 3 / 2 points selon la précision. En équipes, l'autre équipe parie gauche ou droite (1 point). Premier à `target`.
// En coopératif, tout le monde cherche ensemble et doit atteindre `target` points en `maxRounds` manches.
import { SPECTRUMS } from './spectrums.js';

export const DIAL = 180;
export const ZONES = [{ points: 4, half: 4 }, { points: 3, half: 10 }, { points: 2, half: 17 }]; // demi-largeurs en degrés
export const MIN_TEAM_GAME = 4; // joueurs au moins pour jouer en équipes
const MAX_CLUE = 60;
const MAX_ROUNDS = 30; // garde-fou en équipes
const REVEAL_MS = 20000;

export function pointsFor(needle, target) {
  const d = Math.abs(needle - target);
  for (const z of ZONES) if (d <= z.half) return z.points;
  return 0;
}

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const active = (s) => s.players.filter((id) => !s.left.includes(id));
const teamMembers = (s, team) => active(s).filter((id) => s.teams[id] === team);
const due = (s, now, ms) => (s.timer ? now + ms : null);
// Qui déplace l'aiguille, qui parie.
const guessers = (s) => (s.mode === 'coop' ? active(s) : teamMembers(s, s.playing)).filter((id) => id !== s.leader);
const bettors = (s) => (s.mode === 'teams' ? teamMembers(s, 1 - s.playing) : []);

export function setup(players, options, ctx) {
  const ids = players.map((p) => p.id);
  const teams = options?.mode !== 'coop' && ids.length >= MIN_TEAM_GAME;
  const order = shuffle(ids, ctx.random);
  const s = {
    players: ids,
    left: [],
    mode: teams ? 'teams' : 'coop',
    wantedTeams: options?.mode !== 'coop', // vrai si l'hôte voulait des équipes mais qu'on était trop peu
    teams: teams ? Object.fromEntries(order.map((id, i) => [id, i % 2])) : {},
    target: Number(options?.target) || 10,
    maxRounds: Number(options?.maxRounds) || 8,
    timer: Number(options?.timer) || 0,
    deck: shuffle(SPECTRUMS.map((_, i) => i), ctx.random),
    round: 0, // manches terminées ou en cours (index de la manche en cours)
    pointer: [0, 0], // meneur suivant, par équipe (ou [n] en coopératif)
    playing: 0,
    leader: null,
    pair: null,
    secret: null, // angle de la zone cible : jamais dans view() sauf pour le meneur, puis à la révélation
    clue: null,
    needle: 90,
    locks: [],
    bets: {},
    scores: [0, 0],
    last: null, // résultat de la manche qui vient de finir
    history: [],
    phase: 'clue',
    result: null,
    deadline: null,
  };
  return startRound(s, ctx);
}

function pickLeader(s) {
  const pool = s.mode === 'coop' ? active(s) : teamMembers(s, s.playing);
  const slot = s.mode === 'coop' ? 0 : s.playing;
  const leader = pool[s.pointer[slot] % pool.length];
  const pointer = s.pointer.slice();
  pointer[slot] += 1;
  return { leader, pointer };
}

function startRound(s, ctx) {
  const playing = s.mode === 'teams' ? s.round % 2 : 0;
  const t = { ...s, playing };
  const { leader, pointer } = pickLeader(t);
  return {
    ...t, leader, pointer, phase: 'clue',
    pair: SPECTRUMS[s.deck[s.round % s.deck.length]],
    secret: Math.floor(ctx.random() * (DIAL + 1)),
    clue: null, needle: DIAL / 2, locks: [], bets: {}, last: null,
    deadline: due(s, ctx.now, s.timer * 1000),
  };
}

// ——— Passages de phase ———

function reveal(s, ctx, { voided = false } = {}) {
  const points = voided ? 0 : pointsFor(s.needle, s.secret);
  let betSide = null;
  let betPoints = 0;
  if (!voided && s.mode === 'teams') {
    const votes = Object.values(s.bets);
    const left = votes.filter((b) => b === 'L').length;
    const right = votes.filter((b) => b === 'R').length;
    betSide = left > right ? 'L' : right > left ? 'R' : null;
    const truth = s.secret < s.needle ? 'L' : s.secret > s.needle ? 'R' : null;
    if (betSide && betSide === truth && points < 4) betPoints = 1;
  }
  const scores = s.scores.slice();
  if (s.mode === 'coop') scores[0] += points;
  else {
    scores[s.playing] += points;
    scores[1 - s.playing] += betPoints;
  }
  const result = { voided, needle: s.needle, target: s.secret, points, betSide, betPoints, team: s.playing };
  const entry = { leader: s.leader, pair: s.pair, clue: s.clue, needle: s.needle, target: s.secret, points, betPoints, voided, team: s.playing };
  return { ...s, phase: 'reveal', scores, result, history: [...s.history, entry], deadline: due(s, ctx.now, REVEAL_MS) };
}

function afterGuess(s, ctx) {
  if (s.mode === 'coop') return reveal(s, ctx);
  return { ...s, phase: 'bet', bets: {}, deadline: due(s, ctx.now, Math.max(15, Math.round(s.timer / 3)) * 1000) };
}

function winnersOf(s) {
  if (s.mode === 'coop') return s.scores[0] >= s.target ? active(s) : [];
  if (s.scores[0] === s.scores[1]) return active(s);
  return teamMembers(s, s.scores[0] > s.scores[1] ? 0 : 1);
}

function isFinished(s) {
  if (s.mode === 'coop') return s.scores[0] >= s.target || s.round + 1 >= s.maxRounds;
  const played = s.round + 1;
  const best = Math.max(...s.scores);
  if (played >= MAX_ROUNDS) return true;
  // Tour de rattrapage : on ne s'arrête qu'après un nombre pair de manches, et pas sur une égalité.
  return played % 2 === 0 && best >= s.target && s.scores[0] !== s.scores[1];
}

function nextRound(s, ctx) {
  if (isFinished(s)) return { ...s, phase: 'over', deadline: null };
  return startRound({ ...s, round: s.round + 1 }, ctx);
}

// Équipe ou groupe trop petit pour continuer.
const broken = (s) => (s.mode === 'coop' ? active(s).length < 2 : [0, 1].some((t) => teamMembers(s, t).length < 2));

// ——— Coups ———

export function move(s, playerId, action, ctx) {
  const type = action?.type;
  switch (s.phase) {
    case 'clue': {
      if (type !== 'clue') throw new Error('Donne ton indice pour que ton équipe trouve la zone.');
      const clue = String(action.text ?? '').trim().replace(/\s+/g, ' ');
      if (!clue) throw new Error('Écris un indice.');
      if (clue.length > MAX_CLUE) throw new Error(`Ton indice est trop long (${MAX_CLUE} caractères au plus).`);
      if (/\d/.test(clue)) throw new Error('Pas de chiffre dans l’indice : décris avec des mots.');
      return { state: { ...s, phase: 'guess', clue, needle: DIAL / 2, locks: [], deadline: due(s, ctx.now, s.timer * 1000) } };
    }
    case 'guess': {
      if (type === 'aim') {
        const angle = Math.round(Number(action.angle));
        if (!Number.isFinite(angle)) throw new Error('Position d’aiguille invalide.');
        const needle = Math.max(0, Math.min(DIAL, angle));
        if (needle === s.needle && !s.locks.length) return { state: s };
        return { state: { ...s, needle, locks: [] } };
      }
      if (type === 'lock') {
        const on = action.on !== false;
        const locks = on ? [...new Set([...s.locks, playerId])] : s.locks.filter((id) => id !== playerId);
        const t = { ...s, locks };
        return { state: on && guessers(t).every((id) => locks.includes(id)) ? afterGuess(t, ctx) : t };
      }
      throw new Error('Place l’aiguille, puis verrouille.');
    }
    case 'bet': {
      if (type !== 'bet' || !['L', 'R'].includes(action.side)) throw new Error('Choisis : la zone est plus à gauche ou plus à droite.');
      if (playerId in s.bets) throw new Error('Tu as déjà parié.');
      const t = { ...s, bets: { ...s.bets, [playerId]: action.side } };
      return { state: bettors(t).every((id) => id in t.bets) ? reveal(t, ctx) : t };
    }
    case 'reveal':
      return { state: type === 'next' ? nextRound(s, ctx) : s };
    default:
      throw new Error('La partie est terminée.');
  }
}

export function timeout(s, ctx) {
  switch (s.phase) {
    case 'clue': return { state: reveal(s, ctx, { voided: true }) }; // pas d'indice : manche sans point
    case 'guess': return { state: afterGuess(s, ctx) }; // l'aiguille reste où elle est
    case 'bet': return { state: reveal(s, ctx) };
    case 'reveal': return { state: nextRound(s, ctx) };
    default: return { state: s };
  }
}

export function leave(s, playerId, ctx) {
  if (s.phase === 'over') return { state: s };
  let t = { ...s, left: [...s.left, playerId], locks: s.locks.filter((id) => id !== playerId) };
  if (broken(t)) return { state: { ...t, phase: 'over', deadline: null } };
  if (t.phase === 'reveal') return { state: t };
  if (playerId === t.leader) return { state: reveal(t, ctx, { voided: true }) };
  if (t.phase === 'guess' && guessers(t).every((id) => t.locks.includes(id))) t = afterGuess(t, ctx);
  else if (t.phase === 'bet') {
    t = { ...t, bets: Object.fromEntries(Object.entries(t.bets).filter(([id]) => Number(id) !== playerId)) };
    if (bettors(t).every((id) => id in t.bets)) t = reveal(t, ctx);
  }
  return { state: t };
}

export function status(s) {
  if (s.phase === 'over') return { over: true, turn: null, winners: winnersOf(s) };
  let turn;
  if (s.phase === 'clue') turn = [s.leader];
  else if (s.phase === 'guess') turn = guessers(s);
  else if (s.phase === 'bet') turn = bettors(s).filter((id) => !(id in s.bets));
  else turn = active(s);
  return { over: false, turn, winners: [], deadline: s.deadline };
}

export function view(s, playerId) {
  const seated = playerId !== null && s.players.includes(playerId) && !s.left.includes(playerId);
  const isLeader = seated && playerId === s.leader;
  const shown = s.phase === 'reveal' || s.phase === 'over';
  const base = {
    phase: s.phase,
    mode: s.mode,
    wantedTeams: s.wantedTeams,
    teams: s.teams,
    target: s.target,
    maxRounds: s.maxRounds,
    timer: s.timer,
    round: s.round,
    players: s.players,
    left: s.left,
    leader: s.leader,
    playing: s.playing,
    pair: s.pair,
    clue: s.phase === 'clue' ? null : s.clue,
    needle: s.needle,
    locks: s.locks,
    guessers: s.phase === 'guess' ? guessers(s) : [],
    bettors: s.phase === 'bet' ? bettors(s) : [],
    voted: Object.keys(s.bets).map(Number),
    myBet: seated && playerId in s.bets ? s.bets[playerId] : null,
    scores: s.scores,
    history: s.history,
    result: s.phase === 'reveal' ? s.result : null,
    deadline: s.deadline,
    // La zone cible : seulement pour le meneur pendant la manche, pour tout le monde à la révélation.
    secret: shown ? (s.result ? s.result.target : null) : isLeader && ['clue', 'guess', 'bet'].includes(s.phase) ? s.secret : null,
    zones: ZONES,
    // Les paris restent cachés jusqu'à la révélation.
    bets: s.phase === 'reveal' ? s.bets : null,
  };
  return base;
}
