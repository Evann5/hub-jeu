// Code secret : chacun compose un code de couleurs pour l'adversaire, puis les deux cherchent en même temps.
// Les règles sont pures : ni réseau, ni base, ni affichage. Le hasard et l'heure viennent de ctx.
//
// Phases : « coding » (les deux composent leur code), « guessing » (manches d'essais simultanés), « over ».
// Un essai par manche et par joueur ; la manche se termine quand les deux ont joué, et les indications sont données ensemble.
// Celui qui trouve le code le premier (en moins d'essais) gagne ; si les deux trouvent à la même manche : égalité.

export const MAX_TRIES = 10;

const other = (seat) => 1 - seat;
const seatOf = (state, playerId) => state.players.indexOf(playerId);

// Indications d'un essai : « black » = bien placés, « white » = bonne couleur mal placée (chaque pion compté une seule fois).
export function score(secret, guess) {
  let black = 0;
  const left = new Map();
  const mine = new Map();
  secret.forEach((c, i) => {
    if (c === guess[i]) {
      black += 1;
    } else {
      left.set(c, (left.get(c) || 0) + 1);
      mine.set(guess[i], (mine.get(guess[i]) || 0) + 1);
    }
  });
  let white = 0;
  for (const [c, n] of mine) white += Math.min(n, left.get(c) || 0);
  return { black, white };
}

// Contrôle un code ou un essai : bon nombre de trous, couleurs connues, doublons seulement si autorisés.
export function checkCode(state, code, what = 'code') {
  if (!Array.isArray(code) || code.length !== state.holes) {
    throw new Error(`Remplis les ${state.holes} trous avant de valider.`);
  }
  const colors = code.map(Number);
  if (colors.some((c) => !Number.isInteger(c) || c < 0 || c >= state.colors)) throw new Error('Une des couleurs n’existe pas.');
  if (!state.doubles && new Set(colors).size !== colors.length) {
    throw new Error(`Les doublons sont interdits dans cette partie : utilise ${state.holes} couleurs différentes dans ton ${what}.`);
  }
  return colors;
}

function randomCode(state, random) {
  const pool = Array.from({ length: state.colors }, (_, i) => i);
  const code = [];
  for (let i = 0; i < state.holes; i += 1) {
    const k = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    code.push(pool[k]);
    if (!state.doubles) pool.splice(k, 1);
  }
  return code;
}

export function setup(players, options = {}, ctx) {
  return {
    players: players.map((p) => p.id),
    holes: Number(options.holes) === 5 ? 5 : 4,
    colors: Number(options.colors) === 8 ? 8 : 6,
    doubles: Boolean(options.doubles),
    timer: Number(options.timer) > 0 ? Number(options.timer) : 0, // secondes par manche, 0 = sans minuteur
    phase: 'coding',
    secrets: [null, null], // secrets[i] : le code composé par la place i, que l'autre cherche
    guesses: [[], []], // guesses[i] : les essais de la place i : { code, black, white }
    pending: [null, null], // essai de la manche en cours, pas encore révélé
    deadline: ctx && Number(options.timer) > 0 ? ctx.now + Number(options.timer) * 1000 : null,
    winners: [],
    forfeit: null,
  };
}

const deadlineFor = (state, ctx) => (state.timer ? ctx.now + state.timer * 1000 : null);

// Quand les deux essais de la manche sont posés : on donne les indications et on regarde si quelqu'un a trouvé.
function closeRound(state, ctx) {
  const guesses = state.guesses.map((list, seat) => {
    const code = state.pending[seat];
    const { black, white } = score(state.secrets[other(seat)], code);
    return [...list, { code, black, white }];
  });
  const found = guesses.map((list) => list.at(-1).black === state.holes);
  const round = guesses[0].length;
  const base = { ...state, guesses, pending: [null, null] };
  if (found.some(Boolean) || round >= MAX_TRIES) {
    return { ...base, phase: 'over', deadline: null, winners: state.players.filter((_, i) => found[i]) };
  }
  return { ...base, deadline: deadlineFor(state, ctx) };
}

function startGuessing(state, secrets, ctx) {
  return { ...state, secrets, phase: 'guessing', deadline: deadlineFor(state, ctx) };
}

export function move(state, playerId, action, ctx) {
  const seat = seatOf(state, playerId);
  if (seat < 0) throw new Error('Tu regardes cette partie.');
  if (state.phase === 'over') throw new Error('La partie est terminée.');

  if (state.phase === 'coding') {
    if (state.secrets[seat]) throw new Error('Ton code est enregistré : attends ton adversaire.');
    if (action?.type !== 'code') throw new Error('Compose d’abord le code que ton adversaire devra trouver.');
    const code = checkCode(state, action.code, 'code');
    const secrets = state.secrets.map((s, i) => (i === seat ? code : s));
    return { state: secrets.every(Boolean) ? startGuessing(state, secrets, ctx) : { ...state, secrets } };
  }

  if (action?.type !== 'guess') throw new Error('C’est le moment de chercher le code de ton adversaire.');
  if (state.pending[seat]) throw new Error('Ton essai est joué : attends ton adversaire.');
  const code = checkCode(state, action.code, 'essai');
  const pending = state.pending.map((p, i) => (i === seat ? code : p));
  const next = { ...state, pending };
  return { state: pending.every(Boolean) ? closeRound(next, ctx) : next };
}

// Minuteur échu : ceux qui n'ont pas joué jouent un code au hasard.
export function timeout(state, ctx) {
  if (state.phase === 'coding') {
    const secrets = state.secrets.map((s) => s || randomCode(state, ctx.random));
    return { state: startGuessing(state, secrets, ctx) };
  }
  if (state.phase === 'guessing') {
    const pending = state.pending.map((p) => p || randomCode(state, ctx.random));
    return { state: closeRound({ ...state, pending }, ctx) };
  }
  return { state };
}

// Abandon : l'autre joueur gagne.
export function leave(state, playerId) {
  const seat = seatOf(state, playerId);
  if (seat < 0 || state.phase === 'over') return { state };
  return { state: { ...state, phase: 'over', deadline: null, forfeit: playerId, winners: [state.players[other(seat)]] } };
}

// Chacun voit son propre code, les essais publics des deux joueurs, et seulement si l'autre a joué (pas ce qu'il a joué).
// Le code adverse n'apparaît qu'à la fin.
export function view(state, playerId) {
  const seat = seatOf(state, playerId);
  const over = state.phase === 'over';
  return {
    players: state.players,
    seat, // −1 pour un spectateur
    holes: state.holes,
    colors: state.colors,
    doubles: state.doubles,
    timer: state.timer,
    maxTries: MAX_TRIES,
    phase: state.phase,
    codeSet: state.secrets.map(Boolean),
    guessed: state.pending.map(Boolean),
    myCode: seat >= 0 ? state.secrets[seat] : null,
    myPending: seat >= 0 ? state.pending[seat] : null,
    guesses: state.guesses,
    secrets: over ? state.secrets : null,
    deadline: state.deadline,
    winners: state.winners,
    forfeit: state.forfeit,
  };
}

export function status(state) {
  if (state.phase === 'over') return { turn: null, over: true, winners: state.winners };
  const waiting = state.phase === 'coding'
    ? state.players.filter((_, i) => !state.secrets[i])
    : state.players.filter((_, i) => !state.pending[i]);
  return { turn: waiting, over: false, winners: [], deadline: state.deadline ?? undefined };
}
