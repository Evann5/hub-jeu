// Espions : jeu d'équipes à mots-indices. Les règles sont pures : le hasard et l'heure arrivent par ctx.
//
// Déroulé :
//   teams   chacun choisit son équipe (Rouge ou Bleue) et peut se proposer chef ; « Commencer » quand chaque équipe a un chef
//           et au moins un agent.
//   clue    le chef de l'équipe qui joue donne un indice : un mot et un nombre (0 = autant d'essais qu'on veut).
//   guess   les agents de cette équipe cherchent les cartes. Nombre + 1 essais au plus. Une carte est retournée quand
//           la MAJORITÉ STRICTE des agents l'a désignée (avec un seul agent, son choix compte tout de suite).
//           « S'arrêter » est un vote comme un autre (carte −1), possible après au moins un essai.
//   over    l'équipe qui a trouvé tous ses mots gagne ; toucher l'assassin fait perdre tout de suite.
//
// Choix documentés :
// - Le hasard sert à répartir les équipes au départ, à tirer les 25 mots et à placer la clé.
// - Les désignations des agents sont publiques (tout le monde voit qui vise quoi) ; seule la clé est secrète.
// - Minuteurs facultatifs : indice trop long = on passe la main ; essais trop longs = fin du tour.
// - Un joueur qui part sort de son équipe ; si c'était le chef, un agent le remplace ; une équipe réduite à moins de
//   deux personnes (un chef et un agent) déclare forfait.

import { WORDS } from './words.js';

export const TEAMS = ['red', 'blue'];
const other = (t) => (t === 'red' ? 'blue' : 'red');
const TEAM_NAME = { red: 'rouge', blue: 'bleue' };
const clone = (s) => structuredClone(s);

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sec = (v) => (Number(v) > 0 ? Number(v) * 1000 : 0);

// Un mot comparé sans accents ni majuscules.
export const normalize = (w) => String(w).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

// Un indice ne peut être ni un mot encore en jeu, ni en contenir un (ou être contenu dedans) dès 4 lettres.
export function tooClose(clue, word) {
  const a = normalize(clue);
  const b = normalize(word);
  return a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)));
}

export function setup(players, options, ctx) {
  const ids = players.map((p) => p.id);
  const order = shuffle(ids, ctx.random);
  const team = {};
  order.forEach((id, i) => { team[id] = TEAMS[i % 2]; });
  return {
    phase: 'teams',
    players: ids,
    gone: [],
    team,
    lead: { red: null, blue: null },
    times: { clue: sec(options?.clue), guess: sec(options?.guess) },
    words: [],
    key: [],
    revealed: [],
    first: 'red',
    active: 'red',
    clue: null,
    guesses: 0,
    max: null,
    picks: {},
    log: [],
    winner: null,
    deadline: null,
  };
}

// ——— Aides ———

const present = (s) => s.players.filter((id) => !s.gone.includes(id));
const members = (s, t) => present(s).filter((id) => s.team[id] === t);
const agents = (s, t) => members(s, t).filter((id) => id !== s.lead[t]);
const remaining = (s, t) => s.key.filter((k, i) => k === t && !s.revealed[i]).length;
const deadlineFor = (s, ctx, ms) => (ms ? ctx.now + ms : null);

function startClue(s, ctx) {
  s.phase = 'clue';
  s.clue = null;
  s.guesses = 0;
  s.max = null;
  s.picks = {};
  s.deadline = deadlineFor(s, ctx, s.times.clue);
}

function endTurn(s, ctx) {
  s.active = other(s.active);
  startClue(s, ctx);
}

function finish(s, team, reason) {
  s.phase = 'over';
  s.winner = { team, reason };
  s.deadline = null;
  s.picks = {};
}

// Retourne une carte et applique ses conséquences.
function reveal(s, card, ctx) {
  const kind = s.key[card];
  const entry = s.log.at(-1);
  s.revealed[card] = true;
  s.picks = {};
  entry.guesses.push({ card, kind });
  if (kind === 'assassin') {
    entry.ended = 'assassin';
    return finish(s, other(s.active), 'assassin');
  }
  if (remaining(s, 'red') === 0) return finish(s, 'red', 'cards');
  if (remaining(s, 'blue') === 0) return finish(s, 'blue', 'cards');
  if (kind === s.active) {
    s.guesses += 1;
    if (s.max !== null && s.guesses >= s.max) {
      entry.ended = 'max';
      endTurn(s, ctx);
    } else {
      s.deadline = deadlineFor(s, ctx, s.times.guess);
    }
    return s;
  }
  entry.ended = kind === 'neutral' ? 'neutral' : 'enemy';
  return endTurn(s, ctx);
}

// Regarde si une désignation a la majorité stricte des agents de l'équipe qui joue.
function settle(s, ctx) {
  if (s.phase !== 'guess') return s;
  const team = agents(s, s.active);
  const votes = new Map();
  for (const id of team) {
    if (s.picks[id] !== undefined) votes.set(s.picks[id], (votes.get(s.picks[id]) || 0) + 1);
  }
  for (const [card, n] of votes) {
    if (n * 2 > team.length) {
      if (card === -1) {
        s.log.at(-1).ended = 'stop';
        endTurn(s, ctx);
      } else {
        reveal(s, card, ctx);
      }
      break;
    }
  }
  return s;
}

function startGame(s, ctx) {
  const first = TEAMS[Math.floor(ctx.random() * 2)];
  const kinds = [
    ...Array(9).fill(first), ...Array(8).fill(other(first)), ...Array(7).fill('neutral'), 'assassin',
  ];
  s.words = shuffle(WORDS, ctx.random).slice(0, 25);
  s.key = shuffle(kinds, ctx.random);
  s.revealed = Array(25).fill(false);
  s.first = first;
  s.active = first;
  s.log = [];
  startClue(s, ctx);
}

// ——— Coups ———

export function move(state, playerId, action, ctx) {
  const s = clone(state);
  const a = action && typeof action === 'object' ? action : {};
  if (s.phase === 'over') throw new Error('La partie est terminée.');
  if (s.gone.includes(playerId)) throw new Error('Tu as quitté la partie.');

  if (s.phase === 'teams') {
    const mine = s.team[playerId];
    if (a.type === 'team') {
      if (!TEAMS.includes(a.team)) throw new Error('Équipe inconnue.');
      if (mine !== a.team) {
        if (s.lead[mine] === playerId) s.lead[mine] = null;
        s.team[playerId] = a.team;
      }
    } else if (a.type === 'lead') {
      if (a.on === false) {
        if (s.lead[mine] === playerId) s.lead[mine] = null;
      } else if (s.lead[mine] && s.lead[mine] !== playerId) {
        throw new Error(`L’équipe ${TEAM_NAME[mine]} a déjà un chef : demande-lui de laisser sa place.`);
      } else {
        s.lead[mine] = playerId;
      }
    } else if (a.type === 'shuffle') {
      const order = shuffle(present(s), ctx.random);
      order.forEach((id, i) => { s.team[id] = TEAMS[i % 2]; });
      s.lead = { red: null, blue: null };
    } else if (a.type === 'start') {
      for (const t of TEAMS) {
        if (!s.lead[t]) throw new Error(`Il manque un chef à l’équipe ${TEAM_NAME[t]} : quelqu’un doit se proposer.`);
        if (agents(s, t).length < 1) throw new Error(`L’équipe ${TEAM_NAME[t]} a besoin d’au moins un agent en plus de son chef.`);
      }
      startGame(s, ctx);
    } else {
      throw new Error('Choisis ton équipe, puis « Commencer ».');
    }
    return { state: s };
  }

  if (s.phase === 'clue') {
    if (playerId !== s.lead[s.active]) throw new Error(`C’est au chef de l’équipe ${TEAM_NAME[s.active]} de donner l’indice.`);
    if (a.type !== 'clue') throw new Error('Donne un indice : un mot et un nombre.');
    const word = String(a.word ?? '').trim();
    if (!word || word.length > 24 || !/^[\p{L}'’-]+$/u.test(word)) throw new Error('Ton indice doit être un seul mot, sans espace ni chiffre.');
    const number = Number(a.number);
    if (!Number.isInteger(number) || number < 0 || number > 9) throw new Error('Le nombre doit être entre 0 et 9.');
    const clash = s.words.find((w, i) => !s.revealed[i] && tooClose(word, w));
    if (clash) throw new Error(`Ton indice est trop proche du mot « ${clash} » : choisis-en un autre.`);
    s.clue = { team: s.active, word, number };
    s.max = number === 0 ? null : number + 1;
    s.log.push({ team: s.active, word, number, guesses: [], ended: null });
    s.phase = 'guess';
    s.picks = {};
    s.deadline = deadlineFor(s, ctx, s.times.guess);
    return { state: s };
  }

  // phase guess
  if (!agents(s, s.active).includes(playerId)) {
    if (s.lead[s.active] === playerId) throw new Error('Tu es le chef : tes agents cherchent, toi tu ne parles plus.');
    throw new Error(`C’est à l’équipe ${TEAM_NAME[s.active]} de chercher.`);
  }
  if (a.type !== 'pick') throw new Error('Désigne une carte.');
  if (a.card === null || a.card === undefined) {
    delete s.picks[playerId]; // on retire sa désignation
    return { state: s };
  }
  const card = Number(a.card);
  if (card === -1) {
    if (!s.log.at(-1).guesses.length) throw new Error('Désigne au moins une carte avant de t’arrêter.');
  } else if (!Number.isInteger(card) || card < 0 || card > 24) {
    throw new Error('Carte inconnue.');
  } else if (s.revealed[card]) {
    throw new Error('Cette carte est déjà retournée.');
  }
  s.picks[playerId] = card;
  return { state: settle(s, ctx) };
}

// Le minuteur est échu : l'indice manque (on passe la main) ou les agents n'ont pas fini (fin du tour).
export function timeout(state, ctx) {
  const s = clone(state);
  if (s.phase === 'clue') {
    s.log.push({ team: s.active, word: null, number: 0, guesses: [], ended: 'skipped' });
    endTurn(s, ctx);
  } else if (s.phase === 'guess') {
    s.log.at(-1).ended = 'timeout';
    endTurn(s, ctx);
  }
  return { state: s };
}

// Un joueur part. Le chef est remplacé par un agent ; une équipe trop petite déclare forfait.
export function leave(state, playerId, ctx) {
  const s = clone(state);
  if (s.phase === 'over' || s.gone.includes(playerId)) return { state: s };
  s.gone.push(playerId);
  delete s.picks[playerId];
  const team = s.team[playerId];
  if (s.phase === 'teams') {
    for (const t of TEAMS) if (s.lead[t] === playerId) s.lead[t] = null;
    if (present(s).length < 4) finish(s, null, 'left'); // à moins de 4, la partie ne pourrait plus jamais commencer
    return { state: s };
  }
  if (s.lead[team] === playerId) {
    const next = agents(s, team)[0];
    s.lead[team] = next ?? null;
    if (next !== undefined) delete s.picks[next];
  }
  if (members(s, team).length < 2) {
    finish(s, other(team), 'forfeit');
    return { state: s };
  }
  return { state: settle(s, ctx) };
}

// ——— Vues ———

// Ce que voit une personne. La clé n'est donnée qu'aux deux chefs (et à tout le monde une fois la partie finie).
export function view(s, playerId) {
  const viewer = playerId !== null && s.players.includes(playerId) && !s.gone.includes(playerId) ? playerId : null;
  const over = s.phase === 'over';
  const isChef = viewer !== null && (s.lead.red === viewer || s.lead.blue === viewer);
  const v = {
    phase: s.phase,
    players: s.players,
    gone: s.gone,
    team: s.team,
    lead: s.lead,
    me: viewer === null ? null : { id: viewer, team: s.team[viewer], role: isChef ? 'chef' : 'agent' },
    winner: s.winner,
    log: s.log,
  };
  if (s.phase === 'teams') return v;
  v.cards = s.words.map((word, i) => ({ word, kind: s.revealed[i] ? s.key[i] : null }));
  v.first = s.first;
  v.active = s.active;
  v.clue = s.clue;
  v.guesses = s.guesses;
  v.max = s.max;
  v.picks = s.picks;
  v.left = { red: remaining(s, 'red'), blue: remaining(s, 'blue') };
  v.span = s.deadline ? (s.phase === 'clue' ? s.times.clue : s.times.guess) : 0;
  if (isChef || over) v.key = s.key;
  return v;
}

export function status(s) {
  const over = s.phase === 'over';
  let turn = null;
  if (s.phase === 'teams') turn = present(s);
  else if (s.phase === 'clue') turn = s.lead[s.active];
  else if (s.phase === 'guess') turn = agents(s, s.active);
  return {
    turn,
    over,
    winners: over && s.winner.team ? s.players.filter((id) => s.team[id] === s.winner.team) : [],
    deadline: s.deadline,
    ...(over && !s.winner.team ? { label: 'Trop de joueurs sont partis' } : {}),
  };
}
