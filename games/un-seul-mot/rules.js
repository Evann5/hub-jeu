// Un seul mot : jeu coopératif. À chaque manche un joueur « devine » un mot qu'il ne voit pas ; les autres écrivent
// chacun un indice d'un seul mot. Les indices identiques ou de la même famille que le mot sont annulés (et ceux que
// plus de la moitié des autres écarte par vote). Le devineur voit les indices restants et propose un mot, ou passe.
import { WORDS } from './words.js';

export const CHOICES = 5; // numéros proposés au devineur
const RESULT_MS = 20000; // pause sur le résultat quand un minuteur est réglé
const MAX_CLUE = 24;

// ——— Mots : normalisation et « même famille » ———

export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/g, '');
}

// Racine grossière : sans pluriel ni « e » final, pour que ami/amie/amis soient le même mot.
export function stem(text) {
  let n = normalize(text);
  if (n.length > 3 && /[sx]$/.test(n)) n = n.slice(0, -1);
  if (n.length > 3 && n.endsWith('e')) n = n.slice(0, -1);
  return n;
}

// Deux mots identiques, ou dont l'un contient l'autre (4 lettres au moins), ou qui partagent un long début
// (chanter / chanteur, pomme / pommier).
export function related(a, b) {
  const x = stem(a);
  const y = stem(b);
  if (!x || !y) return false;
  if (x === y || x.replace(/au$/, 'al') === y || y.replace(/au$/, 'al') === x) return true; // cheval / chevaux
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= 4 && long.includes(short)) return true;
  let p = 0;
  while (p < short.length && short[p] === long[p]) p++;
  return p >= 5 && p >= short.length - 1;
}

// Ce que le devineur propose, sans article : « la mer » ou « l'ours » valent « mer » et « ours ».
function bare(text) {
  const words = String(text ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').split(/[\s'’]+/).filter(Boolean);
  while (words.length > 1 && /^(le|la|les|l|un|une|des|du|de|d)$/.test(words[0])) words.shift();
  return words.join('').replace(/[^a-z0-9]/g, '');
}
export function sameWord(guess, word) {
  const g = stem(bare(guess));
  const w = stem(word);
  return g.length > 0 && g === w;
}

// Un indice valide : un seul mot, pas de la famille du mot mystère. Renvoie le texte nettoyé ou lève une erreur claire.
export function checkClue(text, word) {
  const clue = String(text ?? '').trim();
  if (!clue) throw new Error('Écris ton indice : un seul mot.');
  if (/\s/.test(clue)) throw new Error('Un seul mot : retire les espaces.');
  if (clue.length > MAX_CLUE) throw new Error(`Ton indice est trop long (${MAX_CLUE} lettres au plus).`);
  if (!/^[\p{L}\p{N}-]+$/u.test(clue)) throw new Error('Écris seulement des lettres, sans apostrophe ni signe.');
  if (related(clue, word)) throw new Error('Cet indice est trop proche du mot mystère (même mot, ou même famille). Trouves-en un autre.');
  return clue;
}

// ——— Mise en place ———

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const active = (s) => s.players.filter((id) => !s.left.includes(id));
const writers = (s) => active(s).filter((id) => id !== s.active);
// Échéance d'une étape : seulement si un minuteur est réglé.
const due = (s, now, ms) => (s.timer ? now + ms : null);

export function setup(players, options, ctx) {
  const rounds = Math.max(1, Math.min(Number(options?.rounds) || 13, 20));
  const s = {
    players: players.map((p) => p.id),
    left: [],
    rounds,
    timer: Number(options?.timer) || 0,
    deck: shuffle([...new Set(WORDS)], ctx.random).slice(0, rounds * CHOICES), // secret : jamais dans view()
    round: 0,
    cursor: 0,
    phase: 'pick',
    active: null,
    candidates: [],
    word: null,
    clues: {}, // id -> texte
    auto: {}, // id -> 'doublon' | 'invalide'
    votes: {}, // id de l'auteur -> ids de ceux qui veulent annuler son indice
    done: [], // ids qui ont fini de voter
    final: [], // indices gardés pour le devineur : { by, text }, mélangés
    guess: null,
    outcome: null,
    score: 0,
    history: [],
    deadline: null,
  };
  return startRound(s, ctx.now);
}

function startRound(s, now) {
  const n = s.players.length;
  let i = s.cursor % n;
  while (s.left.includes(s.players[i])) i = (i + 1) % n;
  return {
    ...s,
    phase: 'pick',
    active: s.players[i],
    cursor: i + 1,
    candidates: s.deck.slice(s.round * CHOICES, s.round * CHOICES + CHOICES),
    word: null, clues: {}, auto: {}, votes: {}, done: [], final: [], guess: null, outcome: null,
    deadline: due(s, now, Math.min(s.timer, 30) * 1000),
  };
}

// ——— Passages d'une phase à l'autre ———

function cancelledByVote(s, id) {
  const others = writers(s).filter((w) => w !== id).length;
  return (s.votes[id] || []).filter((v) => !s.left.includes(v)).length * 2 > others;
}
const kept = (s) => Object.keys(s.clues).map(Number).filter((id) => !s.auto[id] && !cancelledByVote(s, id));

function toReview(s, ctx) {
  // Annulations automatiques : indices trop proches du mot, ou entre eux.
  const ids = Object.keys(s.clues).map(Number);
  const auto = {};
  for (const id of ids) if (related(s.clues[id], s.word)) auto[id] = 'invalide';
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (auto[ids[i]] === 'invalide' || auto[ids[j]] === 'invalide') continue;
      if (related(s.clues[ids[i]], s.clues[ids[j]])) { auto[ids[i]] = 'doublon'; auto[ids[j]] = 'doublon'; }
    }
  }
  const t = { ...s, auto, phase: 'review', done: [], votes: {}, deadline: due(s, ctx.now, s.timer * 1000) };
  // Rien à examiner : on passe directement à la devinette.
  return ids.some((id) => !auto[id]) ? t : toGuess(t, ctx);
}

function toGuess(s, ctx) {
  const final = shuffle(kept(s), ctx.random).map((by) => ({ by, text: s.clues[by] }));
  return { ...s, phase: 'guess', final, deadline: due(s, ctx.now, s.timer * 1000) };
}

function finishRound(s, ctx, outcome, guess = null) {
  const entry = {
    active: s.active,
    word: s.word, // null si le numéro n'a jamais été choisi
    outcome,
    guess,
    clues: Object.keys(s.clues).map(Number).map((by) => ({ by, text: s.clues[by], cancelled: s.auto[by] || (cancelledByVote(s, by) ? 'vote' : null) })),
  };
  return {
    ...s, phase: 'result', outcome, guess, deadline: due(s, ctx.now, RESULT_MS),
    score: s.score + (outcome === 'win' ? 1 : 0), history: [...s.history, entry],
  };
}

function nextRound(s, ctx) {
  if (s.round + 1 >= s.rounds) return { ...s, phase: 'over', deadline: null };
  return startRound({ ...s, round: s.round + 1 }, ctx.now);
}

// ——— Coups ———

export function move(s, playerId, action, ctx) {
  const type = action?.type;
  const isActive = playerId === s.active;
  switch (s.phase) {
    case 'pick': {
      if (type !== 'pick') throw new Error('Choisis un numéro de 1 à 5.');
      const n = Number(action.n);
      if (!isActive) throw new Error('C’est à un autre joueur de choisir le numéro.');
      if (!Number.isInteger(n) || n < 1 || n > CHOICES) throw new Error('Choisis un numéro de 1 à 5.');
      return { state: { ...s, phase: 'write', word: s.candidates[n - 1], deadline: due(s, ctx.now, s.timer * 1000) } };
    }
    case 'write': {
      if (type !== 'clue') throw new Error('Écris ton indice.');
      if (isActive) throw new Error('Tu devines : ce sont les autres qui écrivent.');
      if (playerId in s.clues) throw new Error('Tu as déjà donné ton indice.');
      const t = { ...s, clues: { ...s.clues, [playerId]: checkClue(action.text, s.word) } };
      return { state: writers(t).every((id) => id in t.clues) ? toReview(t, ctx) : t };
    }
    case 'review': {
      if (isActive) throw new Error('Tu devines : attends que les autres aient trié les indices.');
      if (type === 'done') {
        const t = { ...s, done: [...s.done, playerId] };
        return { state: writers(t).every((id) => t.done.includes(id)) ? toGuess(t, ctx) : t };
      }
      if (type !== 'cancel') throw new Error('Vote pour annuler un indice, ou confirme que tout est bon.');
      const target = Number(action.target);
      if (!(target in s.clues)) throw new Error('Cet indice n’existe pas.');
      if (target === playerId) throw new Error('Tu ne peux pas annuler ton propre indice.');
      if (s.auto[target]) throw new Error('Cet indice est déjà annulé.');
      const has = (s.votes[target] || []).includes(playerId);
      const list = has ? s.votes[target].filter((v) => v !== playerId) : [...(s.votes[target] || []), playerId];
      return { state: { ...s, votes: { ...s.votes, [target]: list } } };
    }
    case 'guess': {
      if (!isActive) throw new Error('C’est à un autre joueur de deviner.');
      if (type === 'pass') return { state: finishRound(s, ctx, 'pass') };
      if (type !== 'guess') throw new Error('Propose un mot, ou passe.');
      const text = String(action.text ?? '').trim();
      if (!text) throw new Error('Écris ta proposition, ou passe.');
      if (text.length > 40) throw new Error('Ta proposition est trop longue.');
      return { state: finishRound(s, ctx, sameWord(text, s.word) ? 'win' : 'miss', text) };
    }
    case 'result':
      // Plusieurs joueurs peuvent cliquer en même temps : seul le premier compte.
      return { state: type === 'next' ? nextRound(s, ctx) : s };
    default:
      throw new Error('La partie est terminée.');
  }
}

export function timeout(s, ctx) {
  switch (s.phase) {
    case 'pick': return { state: { ...s, phase: 'write', word: s.candidates[Math.floor(ctx.random() * CHOICES)], deadline: due(s, ctx.now, s.timer * 1000) } };
    case 'write': return { state: toReview(s, ctx) };
    case 'review': return { state: toGuess(s, ctx) };
    case 'guess': return { state: finishRound(s, ctx, 'pass') };
    case 'result': return { state: nextRound(s, ctx) };
    default: return { state: s };
  }
}

export function leave(s, playerId, ctx) {
  if (s.phase === 'over') return { state: s };
  let t = { ...s, left: [...s.left, playerId] };
  if (active(t).length < 3) return { state: { ...t, phase: 'over', deadline: null } };
  if (playerId === s.active && ['pick', 'write', 'review', 'guess'].includes(s.phase)) return { state: finishRound(t, ctx, 'abandon') };
  if (t.phase === 'write' && writers(t).every((id) => id in t.clues)) t = toReview(t, ctx);
  else if (t.phase === 'review') {
    t = { ...t, done: t.done.filter((id) => id !== playerId) };
    if (writers(t).every((id) => t.done.includes(id))) t = toGuess(t, ctx);
  }
  return { state: t };
}

export function status(s) {
  if (s.phase === 'over') {
    const won = s.score >= Math.ceil(s.rounds / 2);
    return { over: true, turn: null, winners: won ? active(s) : [], ...(won ? {} : { label: `${s.score} sur ${s.rounds} : c'est raté cette fois` }) };
  }
  let turn;
  if (s.phase === 'pick' || s.phase === 'guess') turn = [s.active];
  else if (s.phase === 'write') turn = writers(s).filter((id) => !(id in s.clues));
  else if (s.phase === 'review') turn = writers(s).filter((id) => !s.done.includes(id));
  else turn = active(s);
  return { over: false, turn, winners: [], deadline: s.deadline };
}

// ——— Ce que chacun voit ———

export function view(s, playerId) {
  const seated = playerId !== null && s.players.includes(playerId) && !s.left.includes(playerId);
  const isActive = seated && playerId === s.active;
  const revealed = s.phase === 'result' || s.phase === 'over';
  // Le mot : jamais pour le devineur ni pour les spectateurs avant la fin de la manche.
  const word = revealed ? s.word : seated && !isActive && ['write', 'review', 'guess'].includes(s.phase) ? s.word : null;
  const base = {
    phase: s.phase,
    round: s.round,
    rounds: s.rounds,
    timer: s.timer,
    active: s.active,
    score: s.score,
    deadline: s.deadline,
    players: s.players,
    left: s.left,
    word,
    wrote: Object.keys(s.clues).map(Number),
    done: s.done,
    choices: CHOICES,
    // Tout ce qui est fini est public.
    history: s.history,
    last: s.phase === 'result' ? s.history[s.history.length - 1] : null,
    mine: seated && playerId in s.clues ? s.clues[playerId] : null,
  };
  if (s.phase === 'review' && seated && !isActive) {
    const others = writers(s);
    base.review = Object.keys(s.clues).map(Number).map((by) => ({
      by,
      text: s.clues[by],
      auto: s.auto[by] || null,
      votes: s.votes[by] || [],
      need: Math.floor(others.filter((w) => w !== by).length / 2) + 1, // « plus de la moitié des autres »
      cancelled: Boolean(s.auto[by]) || cancelledByVote(s, by),
    }));
  }
  if (s.phase === 'review') base.clueCount = Object.keys(s.clues).length;
  if (s.phase === 'guess') {
    if (isActive) base.final = s.final.map((c) => c.text);
    else if (seated) base.finalBy = s.final;
    base.clueCount = s.final.length;
  }
  return base;
}
