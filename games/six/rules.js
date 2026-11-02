// Six cornes : 104 cartes, 4 rangées de 5 cartes au plus. Chaque tour, tout le monde pose une carte en même temps ;
// les cartes se placent dans l'ordre croissant, et la 6e carte d'une rangée oblige à ramasser les 5 autres.
// Les règles sont pures : ni réseau, ni base, ni affichage. Le hasard et l'heure viennent de ctx.
//
// Phases : « choose » (tout le monde choisit une carte), « row » (une carte trop basse : son joueur choisit la rangée à ramasser),
// « over ». À chaque étape qui place des cartes, state.step décrit ce qui vient de se passer, pour que l'écran l'anime.

export const HAND = 10;
export const ROWS = 4;
export const ROW_MAX = 5;

// Têtes de bœuf d'une carte : 1 par défaut, 2 pour les multiples de 5, 3 pour les multiples de 10, 5 pour les doubles (11, 22…), 7 pour 55.
export function bulls(card) {
  if (card === 55) return 7;
  if (card % 11 === 0) return 5;
  if (card % 10 === 0) return 3;
  if (card % 5 === 0) return 2;
  return 1;
}

export const rowBulls = (row) => row.reduce((sum, c) => sum + bulls(c), 0);

const seatOf = (state, playerId) => state.players.indexOf(playerId);
const sorted = (cards) => [...cards].sort((a, b) => a - b);

function shuffle(cards, random) {
  const a = [...cards];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Distribue une manche : 10 cartes à chaque joueur encore là, et une carte pour lancer chaque rangée.
function deal(state, random) {
  const deck = shuffle(Array.from({ length: 104 }, (_, i) => i + 1), random);
  let k = 0;
  const hands = state.players.map((_, seat) => (state.left[seat] ? [] : sorted(deck.slice(k, (k += HAND)))));
  const rows = Array.from({ length: ROWS }, () => [deck[k++]]);
  return { hands, rows: sorted(rows.map((r) => r[0])).map((c) => [c]) };
}

export function setup(players, options = {}, ctx) {
  const target = [33, 66, 99].includes(Number(options.target)) ? Number(options.target) : 66;
  const base = {
    players: players.map((p) => p.id),
    target,
    timer: Number(options.timer) > 0 ? Number(options.timer) : 0, // secondes par choix, 0 = sans minuteur
    heads: players.map(() => 0),
    left: players.map(() => false),
    round: 1, // numéro de la manche
    turnNo: 1, // numéro du tour dans la manche (1 à 10)
    phase: 'choose',
    picks: players.map(() => null), // carte choisie ce tour, cachée jusqu'à ce que tout le monde ait choisi
    queue: [], // cartes révélées qui attendent d'être placées : { seat, card }
    pending: null, // carte trop basse qui attend le choix d'une rangée : { seat, card }
    step: { seq: 0, revealed: null, rowsBefore: null, plays: [] },
    deadline: null,
    winners: [],
    forfeit: null,
    hands: [],
    rows: [],
  };
  const state = { ...base, ...deal(base, ctx.random) };
  return { ...state, deadline: deadlineFor(state, ctx, 0) };
}

// Échéance du prochain choix ; on laisse du temps à l'écran pour animer les cartes qui viennent d'être posées.
function deadlineFor(state, ctx, plays) {
  return state.timer ? ctx.now + state.timer * 1000 + (plays ? 1500 + 600 * plays : 0) : null;
}

const active = (state) => state.players.map((_, i) => i).filter((i) => !state.left[i]);

// Rangée à ramasser quand on ne choisit pas : la moins chère, puis la plus courte, puis la plus haute dans l'écran (la première).
function cheapestRow(rows) {
  let best = 0;
  rows.forEach((row, i) => {
    const a = [rowBulls(row), row.length];
    const b = [rowBulls(rows[best]), rows[best].length];
    if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) best = i;
  });
  return best;
}

// Place la carte de la file : renvoie la rangée choisie, ou null si la carte est plus petite que toutes les fins de rangée.
function targetRow(rows, card) {
  let best = -1;
  rows.forEach((row, i) => {
    const end = row[row.length - 1];
    if (end < card && (best < 0 || end > rows[best][rows[best].length - 1])) best = i;
  });
  return best < 0 ? null : best;
}

// La personne ramasse toute la rangée r : elle prend ses têtes, et sa carte lance la nouvelle rangée.
function take(state, seat, card, r) {
  const rows = state.rows.map((row) => [...row]);
  const took = rows[r];
  const gain = rowBulls(took);
  const heads = [...state.heads];
  heads[seat] += gain;
  rows[r] = [card];
  return { rows, heads, play: { seat, card, row: r, took, gain } };
}

// Pose la carte à la suite de la rangée r ; la 6e carte oblige à ramasser les cinq autres.
function place(state, seat, card, r) {
  if (state.rows[r].length >= ROW_MAX) return take(state, seat, card, r);
  const rows = state.rows.map((row, i) => (i === r ? [...row, card] : row));
  return { rows, heads: state.heads, play: { seat, card, row: r, took: null, gain: 0 } };
}

// Fait avancer la file de cartes révélées jusqu'à la fin du tour ou jusqu'à une carte trop basse.
function advance(state, ctx, step) {
  let s = { ...state };
  const plays = [...step.plays];
  const rowsBefore = step.rowsBefore ?? s.rows;
  while (s.queue.length) {
    const { seat, card } = s.queue[0];
    let r = targetRow(s.rows, card);
    if (r === null) {
      if (!s.left[seat]) {
        // C'est au joueur de choisir la rangée à ramasser.
        return {
          ...s,
          phase: 'row',
          pending: { seat, card },
          step: { seq: step.seq + 1, revealed: step.revealed, rowsBefore, plays },
          deadline: deadlineFor(s, ctx, plays.length),
        };
      }
      r = cheapestRow(s.rows);
    }
    const res = place(s, seat, card, r);
    plays.push(res.play);
    s = { ...s, rows: res.rows, heads: res.heads, queue: s.queue.slice(1), pending: null };
  }
  return endTurn({ ...s, step: { seq: step.seq + 1, revealed: step.revealed, rowsBefore, plays } }, ctx);
}

// Fin de tour : tour suivant, ou fin de manche (nouvelle donne ou fin de partie).
function endTurn(state, ctx) {
  const plays = state.step.plays.length;
  const base = { ...state, phase: 'choose', pending: null, queue: [], picks: state.players.map(() => null) };
  if (state.hands.some((h, i) => !state.left[i] && h.length > 0)) {
    return { ...base, turnNo: state.turnNo + 1, deadline: deadlineFor(state, ctx, plays) };
  }
  // Manche terminée : un joueur a-t-il atteint le seuil ?
  const alive = active(state);
  if (alive.some((i) => state.heads[i] >= state.target)) return finish(base);
  const next = { ...base, round: state.round + 1, turnNo: 1, ...deal(base, ctx.random) };
  return { ...next, deadline: deadlineFor(next, ctx, plays) };
}

// Fin de partie : le moins de têtes gagne (ex æquo possible), parmi ceux qui sont restés.
function finish(state) {
  const alive = active(state);
  const best = Math.min(...alive.map((i) => state.heads[i]));
  return {
    ...state,
    phase: 'over',
    deadline: null,
    pending: null,
    winners: alive.filter((i) => state.heads[i] === best).map((i) => state.players[i]),
  };
}

// Tout le monde a choisi : on révèle, on trie par ordre croissant et on place.
function reveal(state, ctx) {
  const revealed = state.picks
    .map((card, seat) => ({ seat, card }))
    .filter((p) => p.card !== null)
    .sort((a, b) => a.card - b.card);
  const s = { ...state, queue: revealed, picks: state.picks.map(() => null) };
  return advance(s, ctx, { seq: state.step.seq, revealed, rowsBefore: state.rows, plays: [] });
}

const allPicked = (state) => active(state).every((i) => state.picks[i] !== null);

export function move(state, playerId, action, ctx) {
  const seat = seatOf(state, playerId);
  if (seat < 0 || state.left[seat]) throw new Error('Tu regardes cette partie.');
  if (state.phase === 'over') throw new Error('La partie est terminée.');

  if (state.phase === 'choose') {
    if (action?.type !== 'pick') throw new Error('Choisis une carte de ta main.');
    if (state.picks[seat] !== null) throw new Error('Ta carte est posée : attends les autres.');
    const card = Number(action.card);
    if (!state.hands[seat].includes(card)) throw new Error('Cette carte n’est pas dans ta main.');
    const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c !== card) : h));
    const picks = state.picks.map((c, i) => (i === seat ? card : c));
    const next = { ...state, hands, picks };
    return { state: allPicked(next) ? reveal(next, ctx) : next };
  }

  // Phase « row » : seule la personne dont la carte est trop basse joue.
  if (action?.type !== 'row') throw new Error('Choisis la rangée que tu ramasses.');
  if (state.pending.seat !== seat) throw new Error("Ce n'est pas ton tour.");
  const r = Number(action.row);
  if (!Number.isInteger(r) || r < 0 || r >= ROWS) throw new Error('Cette rangée n’existe pas.');
  return { state: takeRow(state, r, ctx) };
}

// Le joueur dont la carte est trop basse ramasse la rangée r, puis la file continue.
function takeRow(state, r, ctx) {
  const { seat, card } = state.pending;
  const res = take(state, seat, card, r);
  const next = { ...state, rows: res.rows, heads: res.heads, queue: state.queue.slice(1), pending: null };
  return advance(next, ctx, { seq: state.step.seq, revealed: null, rowsBefore: state.rows, plays: [res.play] });
}

// Minuteur échu : ceux qui n'ont pas choisi posent une carte au hasard ; la rangée à ramasser est la moins chère.
export function timeout(state, ctx) {
  if (state.phase === 'choose') {
    let s = state;
    const hands = [...state.hands];
    const picks = [...state.picks];
    for (const i of active(state)) {
      if (picks[i] !== null) continue;
      const k = Math.min(hands[i].length - 1, Math.floor(ctx.random() * hands[i].length));
      picks[i] = hands[i][k];
      hands[i] = hands[i].filter((_, j) => j !== k);
    }
    s = { ...s, hands, picks };
    return { state: reveal(s, ctx) };
  }
  if (state.phase === 'row') return { state: takeRow(state, cheapestRow(state.rows), ctx) };
  return { state };
}

// Abandon : ses cartes sortent du jeu et la partie continue sans lui. Il ne reste qu'une personne : elle gagne.
export function leave(state, playerId, ctx) {
  const seat = seatOf(state, playerId);
  if (seat < 0 || state.left[seat] || state.phase === 'over') return { state };
  const left = state.left.map((l, i) => l || i === seat);
  let s = {
    ...state,
    left,
    hands: state.hands.map((h, i) => (i === seat ? [] : h)),
    picks: state.picks.map((c, i) => (i === seat ? null : c)),
    queue: state.queue.filter((q) => q.seat !== seat),
  };
  const remaining = active(s);
  if (remaining.length < 2) {
    return { state: finish({ ...s, forfeit: playerId }) };
  }
  if (s.phase === 'row' && s.pending.seat === seat) {
    // Sa carte trop basse sort du jeu avec lui : on reprend la file avec les cartes des autres.
    s = { ...s, pending: null };
    return { state: advance(s, ctx, { seq: s.step.seq, revealed: null, rowsBefore: s.rows, plays: [] }) };
  }
  if (s.phase === 'choose' && allPicked(s)) return { state: reveal(s, ctx) };
  return { state: s };
}

// ——— Ce que chacun voit ———

// Ma main, les rangées, les têtes de chacun. Jamais les mains des autres, ni les cartes choisies avant la révélation.
export function view(state, playerId) {
  const seat = seatOf(state, playerId);
  return {
    players: state.players,
    seat, // −1 pour un spectateur
    target: state.target,
    timer: state.timer,
    round: state.round,
    turnNo: state.turnNo,
    phase: state.phase,
    heads: state.heads,
    left: state.left,
    handCounts: state.hands.map((h) => h.length),
    hand: seat >= 0 ? state.hands[seat] : null,
    picked: state.picks.map((c) => c !== null),
    rows: state.rows,
    queue: state.queue,
    pending: state.pending,
    step: state.step,
    deadline: state.deadline,
    winners: state.winners,
    forfeit: state.forfeit,
  };
}

export function status(state) {
  if (state.phase === 'over') return { turn: null, over: true, winners: state.winners };
  const turn = state.phase === 'row'
    ? state.players[state.pending.seat]
    : active(state).filter((i) => state.picks[i] === null).map((i) => state.players[i]);
  return { turn, over: false, winners: [], deadline: state.deadline ?? undefined };
}
