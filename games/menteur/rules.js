// Menteur : les règles du jeu de dés menteurs. Pures : ni réseau, ni base, ni affichage.
// Chacun cache 5 dés. À son tour, on surenchérit (« au moins N dés de valeur V sur toute la table ») ou on dit « Menteur ! ».
// Les 1 sont des jokers, sauf quand l'annonce porte sur les 1. Le hasard vient de ctx.random(), l'heure de ctx.now.

export const START_DICE = 5;
const REVEAL_SECONDS = 20; // temps pour regarder les dés de tous avant la manche suivante
const MIN_BID = { qty: 1, face: 2 }; // annonce posée quand le temps est écoulé et qu'il n'y a encore rien

const rollDie = (ctx) => 1 + Math.min(5, Math.floor(ctx.random() * 6));
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

// ——— Outils (exportés pour les tests) ———

// Les joueurs qui ont encore des dés, dans l'ordre des places.
export const alive = (s) => s.players.filter((id) => s.counts[id] > 0);

export const totalDice = (s) => s.players.reduce((n, id) => n + s.counts[id], 0);

// Nombre de dés qui comptent pour une annonce sur `face` : les 1 sont des jokers, sauf si l'annonce porte sur les 1.
export function countFace(diceByPlayer, face) {
  let n = 0;
  for (const dice of Object.values(diceByPlayer)) {
    for (const d of dice) if (d === face || (face !== 1 && d === 1)) n += 1;
  }
  return n;
}

// Plus petite quantité autorisée pour annoncer `face` après l'annonce `prev` (null : première annonce de la manche).
export function minQuantity(prev, face) {
  if (!prev) return 1;
  if (face === 1) return prev.face === 1 ? prev.qty + 1 : Math.ceil(prev.qty / 2);
  if (prev.face === 1) return prev.qty * 2 + 1;
  return face > prev.face ? prev.qty : prev.qty + 1;
}

// Renvoie le message à montrer au joueur si l'annonce est refusée, sinon null.
export function bidError(prev, qty, face, total) {
  if (!Number.isInteger(qty) || qty < 1) return 'Annonce au moins 1 dé.';
  if (!Number.isInteger(face) || face < 1 || face > 6) return 'Choisis une valeur entre 1 et 6.';
  if (qty > total) return `Il n'y a que ${plural(total, 'dé', 'dés')} en jeu.`;
  const min = minQuantity(prev, face);
  if (qty >= min) return null;
  if (face === 1 && prev.face !== 1) return `Pour annoncer des 1 (jokers), il faut au moins ${min} dés : la moitié de l'annonce précédente, arrondie au-dessus.`;
  if (face !== 1 && prev.face === 1) return `Après une annonce de 1, il faut au moins ${min} dés : le double, plus un.`;
  return `Il faut surenchérir : au moins ${plural(min, 'dé', 'dés')} de ${face}, ou plus de dés, ou une valeur plus haute.`;
}

// Le joueur suivant qui a encore des dés, après la place de `id` (même si `id` n'en a plus).
function nextAlive(s, id) {
  const n = s.players.length;
  const from = s.players.indexOf(id);
  for (let k = 1; k <= n; k += 1) {
    const cand = s.players[(from + k) % n];
    if (s.counts[cand] > 0) return cand;
  }
  return null;
}

const deadlineFor = (s, ctx) => (s.options.turnTime > 0 ? ctx.now + s.options.turnTime * 1000 : null);

// ——— Cycle de la partie ———

// players : [{ id, pseudo }] dans l'ordre des places. Celui qui ouvre la première manche est tiré au sort.
export function setup(players, options, ctx) {
  if (players.length < 2) throw new Error('Il faut au moins 2 joueurs.');
  if (players.length > 8) throw new Error('Menteur se joue à 8 joueurs au maximum.');
  const ids = players.map((p) => p.id);
  const counts = Object.fromEntries(ids.map((id) => [id, START_DICE]));
  const starter = ids[Math.min(ids.length - 1, Math.floor(ctx.random() * ids.length))];
  return startRound({
    players: ids,
    options: { turnTime: Number(options?.turnTime) || 0, exact: options?.exact !== false },
    counts,
    out: [], // éliminés, dans l'ordre
    left: [], // partis en cours de partie
    round: 0,
    phase: 'bid',
    dice: {},
    turn: null,
    bid: null,
    history: [],
    reveal: null,
    ready: [],
    nextStarter: null,
    deadline: null,
    winner: null,
  }, starter, ctx);
}

// Lance les dés de tous les joueurs qui en ont encore, et donne la parole à `starter`.
function startRound(s, starter, ctx) {
  const dice = {};
  for (const id of alive(s)) {
    dice[id] = Array.from({ length: s.counts[id] }, () => rollDie(ctx)).sort((a, b) => a - b);
  }
  const first = s.counts[starter] > 0 ? starter : nextAlive(s, starter);
  const next = {
    ...s, round: s.round + 1, phase: 'bid', dice, turn: first, bid: null, history: [], reveal: null, ready: [], nextStarter: null,
  };
  return { ...next, deadline: deadlineFor(next, ctx) };
}

// Fin de manche : on soulève les gobelets, on compte, et un dé change de main.
function resolve(s, callerId, kind, ctx) {
  const { bid } = s;
  const count = countFace(s.dice, bid.face);
  const counts = { ...s.counts };
  let changed = null; // { id, delta }
  let success;
  let starter;
  if (kind === 'liar') {
    success = count >= bid.qty; // l'annonce était juste
    const loser = success ? callerId : bid.id;
    if (counts[loser] > 0) {
      counts[loser] -= 1;
      changed = { id: loser, delta: -1 };
    }
    starter = loser;
  } else {
    success = count === bid.qty; // tout pile
    if (success) {
      if (counts[callerId] < START_DICE) {
        counts[callerId] += 1;
        changed = { id: callerId, delta: 1 };
      }
    } else {
      counts[callerId] -= 1;
      changed = { id: callerId, delta: -1 };
    }
    starter = callerId;
  }
  const out = changed && changed.delta < 0 && counts[changed.id] === 0 ? [...s.out, changed.id] : s.out;
  const after = { ...s, counts, out, dice: {} };
  const reveal = {
    kind, caller: callerId, bidder: bid.id, qty: bid.qty, face: bid.face, count, success, changed,
    eliminated: Boolean(changed && counts[changed.id] === 0),
    dice: s.dice,
  };
  const left = alive(after);
  if (left.length <= 1) {
    return { ...after, phase: 'over', turn: null, reveal, ready: [], nextStarter: null, deadline: null, winner: left[0] ?? null };
  }
  return {
    ...after,
    phase: 'reveal',
    turn: null,
    reveal,
    ready: [],
    nextStarter: counts[starter] > 0 ? starter : nextAlive(after, starter),
    deadline: ctx.now + REVEAL_SECONDS * 1000,
  };
}

// Actions : { type: 'bid', qty, face } | { type: 'liar' } | { type: 'exact' } | { type: 'next' } (prêt pour la manche suivante)
export function move(state, playerId, action, ctx) {
  const type = action?.type;
  if (state.phase === 'over') throw new Error('La partie est terminée.');

  if (state.phase === 'reveal') {
    if (type !== 'next') throw new Error('La manche est finie : appuie sur « Manche suivante ».');
    if (!(state.counts[playerId] > 0)) throw new Error('Tu es éliminé : tu regardes la suite.');
    const ready = state.ready.includes(playerId) ? state.ready : [...state.ready, playerId];
    const next = { ...state, ready };
    return { state: alive(next).every((id) => ready.includes(id)) ? startRound(next, next.nextStarter, ctx) : next };
  }

  if (state.turn !== playerId) throw new Error("Ce n'est pas ton tour.");

  if (type === 'bid') {
    const qty = Number(action.qty);
    const face = Number(action.face);
    const error = bidError(state.bid, qty, face, totalDice(state));
    if (error) throw new Error(error);
    const bid = { id: playerId, qty, face };
    const next = { ...state, bid, history: [...state.history, bid], turn: nextAlive(state, playerId) };
    return { state: { ...next, deadline: deadlineFor(next, ctx) }, events: [{ type: 'bid', ...bid }] };
  }
  if (type === 'liar' || type === 'exact') {
    if (!state.bid) throw new Error("Il n'y a encore aucune annonce : fais d'abord la première.");
    if (type === 'exact' && !state.options.exact) throw new Error("« Tout pile » n'est pas activé sur cette table.");
    return { state: resolve(state, playerId, type, ctx), events: [{ type }] };
  }
  throw new Error('Action inconnue.');
}

// Temps écoulé : « Menteur ! » s'il y a une annonce, sinon l'annonce minimale ; en fin de manche, on passe à la suivante.
export function timeout(state, ctx) {
  if (state.phase === 'reveal') return { state: startRound(state, state.nextStarter, ctx) };
  if (state.phase !== 'bid') return { state };
  if (state.bid) return { state: resolve(state, state.turn, 'liar', ctx), events: [{ type: 'liar', auto: true }] };
  const bid = { id: state.turn, ...MIN_BID, auto: true };
  const next = { ...state, bid, history: [bid], turn: nextAlive(state, state.turn) };
  return { state: { ...next, deadline: deadlineFor(next, ctx) }, events: [{ type: 'bid', ...bid }] };
}

// Qui quitte sort du jeu avec ses dés ; la partie continue sans lui (ou se termine s'il ne reste qu'un joueur).
export function leave(state, playerId, ctx) {
  if (state.phase === 'over' || state.left.includes(playerId)) return { state };
  const gone = state.counts[playerId] > 0;
  const counts = { ...state.counts, [playerId]: 0 };
  const dice = { ...state.dice };
  delete dice[playerId];
  let s = { ...state, counts, dice, left: [...state.left, playerId], ready: state.ready.filter((id) => id !== playerId) };
  if (!gone) return { state: s }; // déjà éliminé : rien ne change pour les autres
  const left = alive(s);
  if (left.length <= 1) {
    return { state: { ...s, phase: 'over', turn: null, ready: [], nextStarter: null, deadline: null, winner: left[0] ?? null } };
  }
  if (s.phase === 'reveal') {
    if (s.nextStarter === playerId) s = { ...s, nextStarter: nextAlive(s, playerId) };
    return { state: left.every((id) => s.ready.includes(id)) ? startRound(s, s.nextStarter, ctx) : s };
  }
  if (s.turn === playerId) {
    s = { ...s, turn: nextAlive(s, playerId) };
    s.deadline = deadlineFor(s, ctx);
  }
  return { state: s };
}

// ——— Ce que voit chaque personne ———

// playerId null = spectateur. Les dés des autres ne sortent jamais du serveur avant la fin de la manche.
export function view(state, playerId) {
  const bidding = state.phase === 'bid';
  const mine = bidding && playerId !== null && state.dice[playerId] ? state.dice[playerId] : null;
  return {
    phase: state.phase,
    round: state.round,
    players: state.players,
    counts: state.counts,
    out: state.out,
    left: state.left,
    options: state.options,
    turn: bidding ? state.turn : null,
    bid: state.bid,
    history: state.history,
    total: totalDice(state),
    minQty: bidding ? [1, 2, 3, 4, 5, 6].map((f) => minQuantity(state.bid, f)) : null,
    mine,
    reveal: state.reveal,
    ready: state.ready,
    nextStarter: state.nextStarter,
    winner: state.winner,
    deadline: state.deadline,
  };
}

export function status(state) {
  const over = state.phase === 'over';
  let turn = null;
  if (state.phase === 'bid') turn = state.turn;
  else if (state.phase === 'reveal') turn = alive(state).filter((id) => !state.ready.includes(id));
  return { turn, over, winners: over && state.winner !== null ? [state.winner] : [], deadline: state.deadline };
}
