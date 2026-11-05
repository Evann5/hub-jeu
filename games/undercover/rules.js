// Undercover : les civils ont un mot, les Undercover un mot proche, Mr. White n'en a pas.
// Chaque manche : un indice chacun, débat dans le chat de la table, vote, la personne désignée révèle son rôle.
// Les civils gagnent quand tous les infiltrés sont éliminés ; les infiltrés gagnent s'ils sont parmi les deux derniers.
// Mr. White éliminé peut encore gagner seul s'il devine le mot des civils.
import { PAIRS } from './words.js';

const SECONDS = { word: 25, verdict: 12, vote: 40, white: 45 };

export function setup(players, options, ctx) {
  const n = players.length;
  const white = options.mrWhite && n >= 4 ? 1 : 0;
  const under = Math.max(1, Math.min(options.undercovers ?? 1, maxUndercovers(n, white)));
  if (n < 3) throw new Error('Il faut au moins 3 joueurs.');
  const [a, b] = PAIRS[Math.floor(ctx.random() * PAIRS.length)];
  const [civilWord, underWord] = ctx.random() < 0.5 ? [a, b] : [b, a];

  // Distribution des rôles au hasard.
  const ids = shuffle(players.map((p) => p.id), ctx.random);
  const roles = {};
  ids.forEach((id, i) => {
    roles[id] = i < under ? 'under' : i < under + white ? 'white' : 'civil';
  });
  // Ordre de parole : au hasard, mais Mr. White ne commence jamais (il n'aurait rien entendu).
  let order = shuffle(players.map((p) => p.id), ctx.random);
  while (roles[order[0]] === 'white') order = [...order.slice(1), order[0]];

  return nextPhase({
    players: players.map((p) => p.id),
    roles,
    words: { civil: civilWord, under: underWord },
    order,
    out: [], // éliminés, dans l'ordre
    left: [], // ont quitté la partie
    round: 1,
    clues: [], // [{ round, id, text }] ; text null = pas d'indice à temps
    times: { clue: options.clueTime ?? 45, debate: options.debateTime ?? 90 },
    phase: null,
    ready: [],
    votes: {},
    candidates: null, // en cas d'égalité, le second vote se fait entre ces joueurs
    verdicts: [], // [{ round, id, role, tally, by: 'vote' | 'tirage' | 'départ' }]
    whiteGuess: null,
    result: null, // { winner: 'civil' | 'under' | 'white', winners: [ids] }
    deadline: null,
  }, 'word', ctx);
}

// Nombre maximal d'Undercover : les civils doivent rester majoritaires au départ.
export function maxUndercovers(n, white) {
  return Math.max(1, Math.floor((n - white - 1) / 2));
}

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const alive = (s) => s.order.filter((id) => !s.out.includes(id));
const wordOf = (s, id) => (s.roles[id] === 'white' ? null : s.words[s.roles[id]]);

// Met en forme un mot pour comparer : minuscules, sans accents ni ponctuation, sans « s » final.
export function normalize(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/(\w)s\b/g, '$1');
}

function nextPhase(s, phase, ctx, extra = {}) {
  const secs = phase === 'clues' ? s.times.clue : phase === 'debate' ? s.times.debate : SECONDS[phase];
  return { ...s, phase, ready: [], ...extra, deadline: secs ? ctx.now + secs * 1000 : null };
}

// Prochain joueur qui doit donner un indice dans la manche, ou null si tout le monde l'a fait.
function nextClueGiver(s) {
  const given = new Set(s.clues.filter((c) => c.round === s.round).map((c) => c.id));
  return alive(s).find((id) => !given.has(id)) ?? null;
}

function afterClue(s, ctx) {
  return nextClueGiver(s) === null ? nextPhase(s, 'debate', ctx) : nextPhase(s, 'clues', ctx);
}

// Fin de partie ? Les civils gagnent sans infiltré vivant ; les infiltrés quand il ne reste que deux joueurs (ou plus de civil).
function checkEnd(s) {
  const left = alive(s);
  const civils = left.filter((id) => s.roles[id] === 'civil').length;
  const infiltres = left.length - civils;
  if (infiltres === 0) return { winner: 'civil', winners: s.players.filter((id) => s.roles[id] === 'civil') };
  if (civils === 0 || left.length <= 2) {
    return {
      winner: 'under',
      winners: s.players.filter((id) => s.roles[id] === 'under' || (s.roles[id] === 'white' && left.includes(id))),
    };
  }
  return null;
}

function finish(s, result) {
  return { ...s, phase: 'over', result, deadline: null, ready: [] };
}

// Élimine un joueur, puis : dernière chance de Mr. White, fin de partie ou verdict.
function eliminate(s, id, by, tally, ctx) {
  const t = { ...s, out: [...s.out, id], verdicts: [...s.verdicts, { round: s.round, id, role: s.roles[id], tally, by }], votes: {}, candidates: null };
  if (s.roles[id] === 'white' && by !== 'départ') return nextPhase(t, 'white', ctx);
  const end = checkEnd(t);
  return end ? finish(t, end) : nextPhase(t, 'verdict', ctx);
}

// Dépouillement : le plus de voix est éliminé ; égalité = second vote entre ex æquo, puis tirage au sort.
function countVotes(s, ctx) {
  const tally = {};
  for (const target of Object.values(s.votes)) tally[target] = (tally[target] || 0) + 1;
  const rows = Object.entries(tally).map(([id, n]) => ({ id: Number(id), n })).sort((a, b) => b.n - a.n);
  if (!rows.length) {
    // Personne n'a voté : personne n'est éliminé, on passe à la manche suivante.
    return nextPhase({ ...s, verdicts: [...s.verdicts, { round: s.round, id: null, role: null, tally: [], by: 'personne' }], votes: {}, candidates: null }, 'verdict', ctx);
  }
  const top = rows.filter((r) => r.n === rows[0].n).map((r) => r.id);
  if (top.length === 1) return eliminate(s, top[0], 'vote', rows, ctx);
  if (!s.candidates) return nextPhase({ ...s, votes: {}, candidates: top, tie: rows }, 'vote', ctx);
  return eliminate(s, top[Math.floor(ctx.random() * top.length)], 'tirage', rows, ctx);
}

function nextRound(s, ctx) {
  return nextPhase({ ...s, round: s.round + 1, tie: null }, 'clues', ctx);
}

// ——— Coups ———

export function move(s, playerId, action, ctx) {
  const type = action?.type;
  switch (s.phase) {
    case 'word':
    case 'debate':
    case 'verdict': {
      if (type !== 'ready') throw new Error('Action impossible maintenant.');
      const t = { ...s, ready: [...new Set([...s.ready, playerId])] };
      if (alive(t).every((id) => t.ready.includes(id))) return { state: endOfTimedPhase(t, ctx) };
      return { state: t };
    }
    case 'clues': {
      if (type !== 'clue') throw new Error('C’est le moment de donner ton indice.');
      if (nextClueGiver(s) !== playerId) throw new Error('Ce n’est pas à toi de donner un indice : attends ton tour.');
      const text = String(action.text ?? '').replace(/\s+/g, ' ').trim();
      if (!text) throw new Error('Écris un indice.');
      if (text.length > 40) throw new Error('Ton indice est trop long : 40 caractères au plus.');
      const word = wordOf(s, playerId);
      if (word && normalize(text).includes(normalize(word))) throw new Error('Ton indice ne doit pas contenir ton mot.');
      const used = s.clues.filter((c) => c.text).some((c) => normalize(c.text) === normalize(text));
      if (used) throw new Error('Cet indice a déjà été donné : trouves-en un autre.');
      return { state: afterClue({ ...s, clues: [...s.clues, { round: s.round, id: playerId, text }] }, ctx) };
    }
    case 'vote': {
      if (type !== 'vote') throw new Error('C’est le moment de voter.');
      if (!alive(s).includes(playerId)) throw new Error('Tu es éliminé : tu ne votes plus.');
      if (playerId in s.votes) throw new Error('Tu as déjà voté.');
      const target = Number(action.target);
      const pool = s.candidates || alive(s);
      if (target === playerId) throw new Error('Tu ne peux pas voter pour toi.');
      if (!pool.includes(target)) throw new Error('Choisis un joueur encore en jeu.');
      const t = { ...s, votes: { ...s.votes, [playerId]: target } };
      if (alive(t).every((id) => id in t.votes)) return { state: countVotes(t, ctx) };
      return { state: t };
    }
    case 'white': {
      if (type !== 'guess') throw new Error('Mr. White doit proposer un mot.');
      if (playerId !== s.verdicts.at(-1).id) throw new Error('Seul Mr. White, éliminé, propose un mot.');
      const guess = String(action.text ?? '').trim().slice(0, 40);
      if (!guess) throw new Error('Propose un mot.');
      return { state: whiteGuessed(s, playerId, guess, ctx) };
    }
    default:
      throw new Error('La partie est terminée.');
  }
}

function whiteGuessed(s, id, guess, ctx) {
  const right = guess !== null && normalize(guess) === normalize(s.words.civil);
  const t = { ...s, whiteGuess: { id, text: guess, right } };
  if (right) return finish(t, { winner: 'white', winners: [id] });
  const end = checkEnd(t);
  return end ? finish(t, end) : nextPhase(t, 'verdict', ctx);
}

// Fin d'une phase minutée (tout le monde est prêt, ou le temps est écoulé).
function endOfTimedPhase(s, ctx) {
  if (s.phase === 'word') return nextPhase(s, 'clues', ctx);
  if (s.phase === 'debate') return nextPhase(s, 'vote', ctx);
  if (s.phase === 'verdict') return nextRound(s, ctx);
  return s;
}

export function timeout(s, ctx) {
  switch (s.phase) {
    case 'clues': {
      const id = nextClueGiver(s);
      return { state: afterClue({ ...s, clues: [...s.clues, { round: s.round, id, text: null }] }, ctx) };
    }
    case 'vote':
      return { state: countVotes(s, ctx) };
    case 'white':
      return { state: whiteGuessed(s, s.verdicts.at(-1).id, null, ctx) };
    default:
      return { state: endOfTimedPhase(s, ctx) };
  }
}

// Abandon : le joueur sort de la partie et son rôle est révélé.
export function leave(s, playerId, ctx) {
  if (s.out.includes(playerId)) return { state: { ...s, left: [...s.left, playerId] } };
  let t = { ...s, left: [...s.left, playerId] };
  const wasClueGiver = s.phase === 'clues' && nextClueGiver(s) === playerId;
  const votes = { ...t.votes };
  delete votes[playerId];
  for (const [voter, target] of Object.entries(votes)) if (target === playerId) delete votes[voter];
  t = { ...t, votes, out: [...t.out, playerId], verdicts: [...t.verdicts, { round: t.round, id: playerId, role: t.roles[playerId], tally: [], by: 'départ' }] };
  const end = checkEnd(t);
  if (end) return { state: finish(t, end) };
  if (s.phase === 'white' && s.verdicts.at(-1).id === playerId) return { state: nextPhase(t, 'verdict', ctx) };
  if (wasClueGiver) return { state: afterClue(t, ctx) };
  if (['word', 'debate', 'verdict'].includes(t.phase) && alive(t).every((id) => t.ready.includes(id))) return { state: endOfTimedPhase(t, ctx) };
  if (t.phase === 'vote' && alive(t).every((id) => id in t.votes)) return { state: countVotes(t, ctx) };
  return { state: t };
}

// ——— Ce que voit chacun ———

export function status(s) {
  if (s.phase === 'over') return { over: true, winners: s.result.winners, turn: null };
  const left = alive(s);
  let turn;
  if (s.phase === 'clues') turn = nextClueGiver(s);
  else if (s.phase === 'vote') turn = left.filter((id) => !(id in s.votes));
  else if (s.phase === 'white') turn = s.verdicts.at(-1).id;
  else turn = left.filter((id) => !s.ready.includes(id));
  return { turn, over: false, winners: [], deadline: s.deadline };
}

export function view(s, playerId) {
  const over = s.phase === 'over';
  const me = playerId !== null && s.players.includes(playerId) ? playerId : null;
  // Rôle révélé : les éliminés pour tous, tout le monde à la fin.
  const revealed = (id) => over || s.out.includes(id);
  return {
    phase: s.phase,
    round: s.round,
    deadline: s.deadline,
    order: s.order,
    alive: alive(s),
    out: s.out,
    left: s.left,
    me: me === null ? null : {
      id: me,
      word: wordOf(s, me),
      white: s.roles[me] === 'white',
      out: s.out.includes(me),
      voted: s.votes[me] ?? null,
    },
    roles: Object.fromEntries(s.players.filter(revealed).map((id) => [id, s.roles[id]])),
    words: over ? s.words : null,
    revealedWords: Object.fromEntries(s.players.filter(revealed).map((id) => [id, wordOf(s, id)])),
    clues: s.clues,
    current: s.phase === 'clues' ? nextClueGiver(s) : null,
    ready: s.ready,
    voted: Object.keys(s.votes).map(Number), // qui a voté, jamais pour qui
    candidates: s.candidates,
    tie: s.phase === 'vote' ? s.tie ?? null : null,
    verdict: s.verdicts.at(-1) ?? null,
    whiteGuess: s.whiteGuess,
    result: s.result,
    counts: {
      under: Object.values(s.roles).filter((r) => r === 'under').length,
      white: Object.values(s.roles).filter((r) => r === 'white').length,
      civil: Object.values(s.roles).filter((r) => r === 'civil').length,
    },
  };
}
