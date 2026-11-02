// Dominos : règles pures (ni réseau, ni base, ni affichage). Le hasard et l'heure viennent de ctx.
//
// Un domino s'écrit "a-b" avec a <= b (le double-six est "6-6", le blanc-trois "0-3"). La chaîne est une liste de
// [gauche, droite] bout à bout : chain[i][1] === chain[i + 1][0]. Les places vont de 0 à n - 1 dans le sens du tour.
//
// Règles retenues (double-six, 28 dominos, 2 à 4 joueurs, chacun pour soi) :
// - Distribution : 7 dominos chacun à deux joueurs, 6 chacun à trois et quatre joueurs.
// - Pioche : à 2 et 3 joueurs, les dominos restants forment la pioche. À 4 joueurs, les 4 restants sont écartés sans
//   être vus : pas de pioche, on passe quand on ne peut pas jouer (« partie bloquée »).
// - Le plus gros double des mains ouvre la manche (posé tout seul au début). Sans aucun double : le domino le plus lourd.
// - À son tour, on pose un domino à l'un des deux bouts de la chaîne. Sans coup possible, on pioche jusqu'à pouvoir
//   jouer (un seul clic) ; si la pioche est vide ou absente, on passe.
// - Manche gagnée en vidant sa main (elle marque la somme des points des dominos restant aux autres), ou, si plus personne
//   ne peut jouer (tout le monde passe de suite), par le joueur qui a le moins de points : il marque la somme des
//   points des dominos des autres. Égalité au moins de points : manche nulle, personne ne marque.
// - Partie en 50, 100 ou 150 points : la première personne qui atteint le seuil gagne (la plus haute en cas de deux).
// - Abandon (leave) : à deux, l'autre gagne. À trois ou quatre, la partie continue sans lui (ses dominos sont écartés).

const RECAP_MS = 30_000;
const SIDE = { left: 0, right: 1 };

export const tileId = (a, b) => (a <= b ? `${a}-${b}` : `${b}-${a}`);
export const parseTile = (id) => id.split('-').map(Number);
export const pips = (id) => parseTile(id).reduce((s, n) => s + n, 0);
export const isDouble = (id) => { const [a, b] = parseTile(id); return a === b; };

export function makeSet() {
  const all = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) all.push(tileId(a, b));
  return all;
}

export function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const handSize = (n) => (n === 2 ? 7 : 6);
export const drawsAllowed = (n) => n < 4;

// Les deux chiffres libres de la chaîne : [gauche, droite]. null si la chaîne est vide.
export function endsOf(chain) {
  return chain.length ? [chain[0][0], chain[chain.length - 1][1]] : null;
}

// De quel(s) côté(s) ce domino peut se poser ? Liste vide : il ne se pose pas.
export function sidesFor(id, chain) {
  const ends = endsOf(chain);
  if (!ends) return ['left', 'right'];
  const [a, b] = parseTile(id);
  const sides = [];
  if (a === ends[0] || b === ends[0]) sides.push('left');
  if (a === ends[1] || b === ends[1]) sides.push('right');
  return sides;
}

export const playableTiles = (hand, chain) => hand.map((id) => ({ tile: id, sides: sidesFor(id, chain) })).filter((p) => p.sides.length);

// Ajoute un domino à un bout (en le retournant si besoin) et renvoie la nouvelle chaîne.
export function place(chain, id, side) {
  const [a, b] = parseTile(id);
  if (!chain.length) return [[a, b]];
  const ends = endsOf(chain);
  if (side === 'left') {
    const t = b === ends[0] ? [a, b] : [b, a];
    return [t, ...chain];
  }
  const t = a === ends[1] ? [a, b] : [b, a];
  return [...chain, t];
}

// Domino le plus lourd d'une liste (à égalité : le plus grand côté, puis l'identifiant).
const heaviest = (ids) => ids.slice().sort((x, y) => pips(y) - pips(x) || Math.max(...parseTile(y)) - Math.max(...parseTile(x)) || (x < y ? -1 : 1))[0];

// ——— Cycle d'une partie ———

const activeSeats = (s) => s.players.map((_, i) => i).filter((i) => !s.out[i]);
const nextActive = (s, seat) => {
  for (let k = 1; k <= s.players.length; k++) {
    const n = (seat + k) % s.players.length;
    if (!s.out[n]) return n;
  }
  return seat;
};
const deadlineFor = (s, ctx) => (s.timer ? ctx.now + s.timer * 1000 : null);
const noteMove = (s, move) => ({ ...s, lastMove: { n: s.lastMove.n + 1, ...move } });

// Nouvelle manche : mélange, distribue, et pose le plus gros double pour ouvrir.
export function dealManche(base, ctx) {
  const seats = base.players.map((_, i) => i).filter((i) => !base.out[i]);
  const size = handSize(seats.length);
  let hands;
  let stock;
  let opener = -1;
  let openTile = null;
  for (let attempt = 0; attempt < 100 && openTile === null; attempt++) {
    const deck = shuffle(makeSet(), ctx.random);
    hands = base.players.map(() => []);
    seats.forEach((seat, i) => { hands[seat] = deck.slice(i * size, (i + 1) * size); });
    stock = drawsAllowed(seats.length) ? deck.slice(seats.length * size) : [];
    const doubles = seats.flatMap((seat) => hands[seat].filter(isDouble).map((id) => ({ seat, id })));
    if (doubles.length) {
      const top = doubles.sort((x, y) => parseTile(y.id)[0] - parseTile(x.id)[0])[0];
      ({ seat: opener, id: openTile } = top);
    }
  }
  if (openTile === null) { // aucun double après 100 mélanges (quasi impossible) : le domino le plus lourd ouvre
    const all = seats.flatMap((seat) => hands[seat].map((id) => ({ seat, id })));
    const top = heaviest(all.map((x) => x.id));
    opener = all.find((x) => x.id === top).seat;
    openTile = top;
  }
  hands[opener] = hands[opener].filter((id) => id !== openTile);
  const state = {
    ...base,
    phase: 'play',
    hands,
    stock,
    chain: place([], openTile, 'right'),
    turn: nextActive({ ...base }, opener),
    passes: 0,
    recap: null,
    ready: base.players.map((_, i) => Boolean(base.out[i])),
    lastMove: { n: (base.lastMove?.n || 0) + 1, seat: opener, kind: 'open', tile: openTile },
  };
  state.deadline = deadlineFor(state, ctx);
  return state;
}

// players : [{ id, pseudo }] dans l'ordre des places. options : { target: 50|100|150, timer: 0|15|30|60 }.
export function setup(players, options, ctx) {
  if (players.length < 2 || players.length > 4) throw new Error('Les dominos se jouent de deux à quatre.');
  const base = {
    players: players.map((p) => p.id),
    out: players.map(() => false),
    target: [50, 100, 150].includes(options?.target) ? options.target : 100,
    timer: Math.max(0, Math.floor(Number(options?.timer) || 0)),
    scores: players.map(() => 0),
    handNo: 1,
    lastMove: { n: 0 },
    winner: null,
    forfeit: null,
  };
  return dealManche(base, ctx);
}

function endManche(state, kind, winnerSeat, ctx) {
  const seats = activeSeats(state);
  const hands = state.hands;
  const points = hands.map((h) => h.reduce((s, id) => s + pips(id), 0));
  let winner = winnerSeat;
  if (kind === 'blocked') {
    const best = Math.min(...seats.map((i) => points[i]));
    const tied = seats.filter((i) => points[i] === best);
    winner = tied.length === 1 ? tied[0] : null;
  }
  const gained = state.players.map(() => 0);
  if (winner !== null) gained[winner] = seats.filter((i) => i !== winner).reduce((s, i) => s + points[i], 0);
  const scores = state.scores.map((s, i) => s + gained[i]);
  const top = Math.max(...seats.map((i) => scores[i]));
  const leaders = seats.filter((i) => scores[i] === top);
  const finished = top >= state.target && leaders.length === 1;
  return {
    ...state,
    scores,
    phase: finished ? 'over' : 'recap',
    winner: finished ? leaders[0] : null,
    recap: { kind, winner, gained, points, hands },
    ready: state.players.map((_, i) => Boolean(state.out[i])),
    turn: null,
    deadline: finished ? null : ctx.now + RECAP_MS,
  };
}

function nextManche(state, ctx) {
  const { hands, stock, chain, passes, recap, ready, ...base } = state;
  return dealManche({ ...base, handNo: state.handNo + 1 }, ctx);
}

// Pose un domino (déjà validé) et fait avancer la manche.
function playTile(state, seat, id, side, ctx) {
  const hands = state.hands.map((h, i) => (i === seat ? h.filter((x) => x !== id) : h));
  const s = noteMove({ ...state, hands, chain: place(state.chain, id, side), passes: 0 }, { seat, kind: 'play', tile: id, side });
  if (!hands[seat].length) return endManche(s, 'domino', seat, ctx);
  return { ...s, turn: nextActive(s, seat), deadline: deadlineFor(s, ctx) };
}

// Pioche jusqu'à pouvoir jouer ou jusqu'à ce que la pioche soit vide.
function drawUntilPlayable(state, seat, ctx) {
  const stock = state.stock.slice();
  const hand = state.hands[seat].slice();
  let n = 0;
  while (stock.length && !playableTiles(hand, state.chain).length) {
    hand.push(stock.shift());
    n++;
  }
  const hands = state.hands.map((h, i) => (i === seat ? hand : h));
  return { ...noteMove({ ...state, hands, stock }, { seat, kind: 'draw', count: n }), deadline: deadlineFor(state, ctx) };
}

function passTurn(state, seat, ctx) {
  const passes = state.passes + 1;
  const s = noteMove({ ...state, passes }, { seat, kind: 'pass' });
  if (passes >= activeSeats(s).length) return endManche(s, 'blocked', null, ctx);
  return { ...s, turn: nextActive(s, seat), deadline: deadlineFor(s, ctx) };
}

// Un coup : { type: 'play', tile: "3-5", side?: 'left'|'right' } | { type: 'draw' } | { type: 'pass' } | { type: 'next' }.
export function move(state, playerId, action, ctx) {
  const seat = state.players.indexOf(playerId);
  if (seat < 0 || state.out[seat]) throw new Error('Tu ne fais pas partie de cette partie.');
  const type = action?.type;
  if (state.phase === 'over') throw new Error('La partie est terminée.');

  if (state.phase === 'recap') {
    if (type !== 'next') throw new Error('La manche est finie : clique sur « Manche suivante ».');
    const ready = state.ready.slice();
    ready[seat] = true;
    if (ready.every(Boolean)) return { state: nextManche(state, ctx) };
    return { state: { ...state, ready } };
  }

  if (state.turn !== seat) throw new Error('Ce n’est pas ton tour.');
  const hand = state.hands[seat];
  const playable = playableTiles(hand, state.chain);

  if (type === 'play') {
    const id = String(action.tile);
    if (!hand.includes(id)) throw new Error('Ce domino n’est pas dans ta main.');
    const sides = sidesFor(id, state.chain);
    if (!sides.length) {
      const [l, r] = endsOf(state.chain);
      throw new Error(`Ce domino ne se pose pas : les bouts de la chaîne sont ${l} et ${r}.`);
    }
    let side = action.side;
    if (side === undefined || side === null) {
      const [l, r] = endsOf(state.chain);
      if (sides.length === 1 || l === r) side = sides[0];
      else throw new Error('Choisis le bout où poser ce domino.');
    }
    if (!(side in SIDE) || !sides.includes(side)) throw new Error('Ce domino ne se pose pas de ce côté.');
    return { state: playTile(state, seat, id, side, ctx) };
  }

  if (type === 'draw') {
    if (playable.length) throw new Error('Tu peux jouer : pose un domino.');
    if (!drawsAllowed(activePlayers(state))) throw new Error('À quatre joueurs il n’y a pas de pioche : passe ton tour.');
    if (!state.stock.length) throw new Error('La pioche est vide : passe ton tour.');
    return { state: drawUntilPlayable(state, seat, ctx) };
  }

  if (type === 'pass') {
    if (playable.length) throw new Error('Tu peux jouer : pose un domino.');
    if (drawsAllowed(activePlayers(state)) && state.stock.length) throw new Error('Pioche d’abord.');
    return { state: passTurn(state, seat, ctx) };
  }

  throw new Error('Pose un domino, pioche ou passe.');
}

const activePlayers = (s) => activeSeats(s).length;

// Tour automatique d'un joueur trop lent : le domino le plus lourd qui se pose, sinon pioche, sinon passe.
function autoTurn(state, ctx) {
  const seat = state.turn;
  let s = state;
  let playable = playableTiles(s.hands[seat], s.chain);
  if (!playable.length && drawsAllowed(activePlayers(s)) && s.stock.length) {
    s = drawUntilPlayable(s, seat, ctx);
    playable = playableTiles(s.hands[seat], s.chain);
  }
  if (!playable.length) return passTurn(s, seat, ctx);
  const id = heaviest(playable.map((p) => p.tile));
  return playTile(s, seat, id, playable.find((p) => p.tile === id).sides[0], ctx);
}

export function timeout(state, ctx) {
  if (state.phase === 'recap') return { state: nextManche(state, ctx) };
  if (state.phase === 'play') return { state: autoTurn(state, ctx) };
  return { state };
}

// Abandon : à deux, l'autre gagne ; à trois ou quatre, la partie continue sans lui.
export function leave(state, playerId, ctx) {
  const seat = state.players.indexOf(playerId);
  if (state.phase === 'over' || seat < 0 || state.out[seat]) return { state };
  const out = state.out.slice();
  out[seat] = true;
  const hands = state.hands.map((h, i) => (i === seat ? [] : h));
  const left = out.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0);
  let s = { ...state, out, hands, forfeit: seat };
  if (left.length < 2) return { state: { ...s, phase: 'over', winner: left[0] ?? null, turn: null, deadline: null } };
  const ready = s.ready.slice();
  ready[seat] = true;
  s = { ...s, ready };
  if (s.phase === 'recap') return { state: ready.every(Boolean) ? nextManche(s, ctx) : s };
  s = noteMove(s, { seat, kind: 'leave' });
  if (state.turn === seat) s = { ...s, turn: nextActive(s, seat), passes: 0, deadline: deadlineFor(s, ctx) };
  else if (s.passes >= left.length) return { state: endManche(s, 'blocked', null, ctx) };
  return { state: s };
}

// Ce que voit chaque personne : sa main, le nombre de dominos des autres. Les mains ne sont révélées qu'à la fin d'une manche.
export function view(state, playerId) {
  const seat = playerId === null ? -1 : state.players.indexOf(playerId);
  const mine = seat >= 0 ? state.hands[seat] : [];
  const myTurn = state.phase === 'play' && seat >= 0 && state.turn === seat;
  const playable = myTurn ? playableTiles(mine, state.chain) : [];
  const n = activePlayers(state);
  const canDraw = myTurn && !playable.length && drawsAllowed(n) && state.stock.length > 0;
  return {
    players: state.players,
    seat,
    out: state.out,
    phase: state.phase,
    handNo: state.handNo,
    target: state.target,
    timer: state.timer,
    scores: state.scores,
    turn: state.turn,
    deadline: state.deadline,
    chain: state.chain,
    ends: endsOf(state.chain),
    stockCount: state.stock.length,
    draw: drawsAllowed(n),
    counts: state.hands.map((h) => h.length),
    hand: mine,
    playable,
    canDraw,
    mustPass: myTurn && !playable.length && !canDraw,
    lastMove: state.lastMove,
    recap: state.recap,
    ready: state.ready,
    winner: state.winner,
    forfeit: state.forfeit,
  };
}

export function status(state) {
  const over = state.phase === 'over';
  let turn = null;
  if (!over) {
    turn = state.phase === 'recap' ? state.players.filter((_, i) => !state.ready[i]) : state.players[state.turn];
  }
  return { turn, over, winners: over && state.winner !== null ? [state.players[state.winner]] : [], deadline: over ? null : state.deadline };
}
