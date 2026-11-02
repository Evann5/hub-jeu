// Poker : Texas Hold'em sans limite, de 2 à 9 joueurs, avec des jetons virtuels.
// Les règles sont pures : l'heure et le hasard arrivent par ctx ({ now, random }), l'état tient en JSON.
// Déroulé d'une main : blindes, préflop, flop, turn, river, abattage. Les pots secondaires et l'évaluation des mains
// sont dans hands.js. Entre deux mains, la phase « result » montre le résultat quelques secondes (minuteur du hub).
import { bestHand, handName, buildPots, splitPot } from './hands.js';

const BLIND_STEPS = [1, 1.5, 2.5, 4, 6, 10, 15, 25, 40, 60, 100]; // multiplicateurs de la petite blinde de départ
const RESULT_MS = 9000; // résultat affiché après un abattage
const RESULT_FOLD_MS = 4500; // résultat affiché quand tout le monde s'est couché
const AFK_MS = 5000; // temps laissé à un joueur qui a laissé passer deux minuteurs de suite
const STREETS = ['preflop', 'flop', 'turn', 'river'];

const clone = (x) => structuredClone(x);

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Index du premier siège après `from` (tour de table) qui vérifie `pred`, ou -1.
function nextIdx(t, from, pred) {
  const n = t.seats.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (pred(t.seats[i], i)) return i;
  }
  return -1;
}

const inHand = (x) => !x.out && !x.folded;
const needsAction = (t) => (x) => inHand(x) && !x.allIn && (!x.acted || x.bet < t.currentBet);

function blindsFor(opts, level) {
  const sb = Math.round((opts.stack / 100) * BLIND_STEPS[Math.min(level, BLIND_STEPS.length - 1)]);
  return { sb, bb: sb * 2 };
}

function readOptions(options = {}) {
  const stack = [1000, 2000, 5000].includes(Number(options.stack)) ? Number(options.stack) : 1000;
  const levelEvery = [0, 5, 8, 12].includes(Number(options.levelEvery)) ? Number(options.levelEvery) : 8;
  const timer = [0, 20, 30, 45, 60].includes(Number(options.timer)) ? Number(options.timer) : 30;
  return { stack, levelEvery, timer };
}

// Partie sans main distribuée (sert aux tests). setup() en distribue la première.
export function _newGame(players, options, ctx) {
  const opts = readOptions(options);
  return {
    players: players.map((p) => p.id),
    seats: players.map((p) => ({
      id: p.id, chips: opts.stack, stack0: opts.stack, bet: 0, total: 0, folded: false, allIn: false, out: false, left: false,
      cards: [], acted: false, noRaise: false, misses: 0, last: null, busted: 0,
    })),
    opts,
    handNo: 0,
    level: 0,
    sb: blindsFor(opts, 0).sb,
    bb: blindsFor(opts, 0).bb,
    button: 0,
    sbSeat: -1,
    bbSeat: -1,
    deck: [],
    board: [],
    street: 'preflop',
    phase: 'hand',
    toAct: null,
    currentBet: 0,
    minRaise: 0,
    deadline: null,
    showdown: null,
    bustCount: 0,
    winner: null,
    startedAt: ctx.now,
  };
}

export function setup(players, options, ctx) {
  return _startHand(_newGame(players, options, ctx), ctx);
}

function commit(x, amount) {
  const a = Math.min(amount, x.chips);
  x.chips -= a;
  x.bet += a;
  x.total += a;
  if (x.chips === 0) x.allIn = true;
  return a;
}

function actionDeadline(t, x, ctx) {
  if (!t.opts.timer) return null;
  return ctx.now + (x.misses >= 2 ? AFK_MS : t.opts.timer * 1000);
}

// Distribue une nouvelle main. `deck` (facultatif) impose l'ordre des cartes : 2 par joueur en jeu, dans l'ordre des
// sièges, puis le tableau.
export function _startHand(s, ctx, deck = null) {
  const t = clone(s);
  const alive = t.seats.filter((x) => !x.out);
  t.handNo += 1;
  if (t.opts.levelEvery) t.level = Math.floor((t.handNo - 1) / t.opts.levelEvery);
  ({ sb: t.sb, bb: t.bb } = blindsFor(t.opts, t.level));
  if (t.handNo === 1) {
    const first = alive[Math.floor(ctx.random() * alive.length)];
    t.button = t.seats.indexOf(first);
  } else {
    t.button = nextIdx(t, t.button, (x) => !x.out);
  }
  t.deck = deck ? deck.slice() : shuffle(Array.from({ length: 52 }, (_, i) => i), ctx.random);
  t.board = [];
  t.street = 'preflop';
  t.phase = 'hand';
  t.showdown = null;
  for (const x of t.seats) {
    Object.assign(x, { bet: 0, total: 0, allIn: false, acted: false, noRaise: false, last: null, cards: [], folded: x.out, stack0: x.chips });
  }
  for (const x of t.seats) if (!x.out) x.cards = [t.deck.shift(), t.deck.shift()];
  // Face-à-face : le donneur poste la petite blinde et parle en premier avant le flop.
  const headsUp = alive.length === 2;
  t.sbSeat = headsUp ? t.button : nextIdx(t, t.button, (x) => !x.out);
  t.bbSeat = nextIdx(t, t.sbSeat, (x) => !x.out);
  const sbPosted = commit(t.seats[t.sbSeat], t.sb);
  const bbPosted = commit(t.seats[t.bbSeat], t.bb);
  t.seats[t.sbSeat].last = { t: 'sb', amt: sbPosted };
  t.seats[t.bbSeat].last = { t: 'bb', amt: bbPosted };
  t.currentBet = t.bb;
  t.minRaise = t.bb;
  return proceed(t, t.bbSeat, ctx);
}

// Décide la suite : fin de main, prochain joueur à parler ou fin du tour d'enchères. Modifie et renvoie t.
function proceed(t, from, ctx) {
  const live = t.seats.filter(inHand);
  if (live.length <= 1) return finishHand(t, ctx);
  const nxt = nextIdx(t, from, needsAction(t));
  if (nxt !== -1) {
    t.toAct = nxt;
    t.deadline = actionDeadline(t, t.seats[nxt], ctx);
    return t;
  }
  return endStreet(t, ctx);
}

function endStreet(t, ctx) {
  for (const x of t.seats) {
    x.bet = 0;
    x.acted = false;
    x.noRaise = false;
    if (x.last && x.last.t !== 'fold' && x.last.t !== 'allin') x.last = null;
  }
  t.currentBet = 0;
  t.minRaise = t.bb;
  t.toAct = null;
  t.deadline = null;
  if (t.street === 'river') return finishHand(t, ctx);
  t.street = STREETS[STREETS.indexOf(t.street) + 1];
  const count = t.street === 'flop' ? 3 : 1;
  for (let i = 0; i < count; i++) t.board.push(t.deck.shift());
  // Si personne (ou une seule personne) ne peut plus miser, on distribue le reste du tableau d'un coup.
  const canBet = t.seats.filter((x) => inHand(x) && !x.allIn).length;
  if (canBet <= 1) return endStreet(t, ctx);
  return proceed(t, t.button, ctx);
}

// Abattage ou victoire par abandon : calcule les pots, les gains, les éliminés, puis passe en phase « result ».
function finishHand(t, ctx) {
  const live = t.seats.filter(inHand);
  const showdown = live.length >= 2;
  const hands = {};
  if (showdown) {
    for (const x of live) {
      const best = bestHand([...x.cards, ...t.board]);
      hands[x.id] = { score: best.score, name: handName(best), best: best.cards, cat: best.cat };
    }
  }
  const order = [];
  for (let k = 1; k <= t.seats.length; k++) order.push(t.seats[(t.button + k) % t.seats.length].id);
  const contribs = t.seats.filter((x) => x.total > 0).map((x) => ({ id: x.id, total: x.total, folded: !inHand(x) }));
  const pots = buildPots(contribs).map((pot) => {
    let winners;
    if (pot.eligible.length <= 1) winners = pot.eligible;
    else {
      const top = Math.max(...pot.eligible.map((id) => hands[id].score));
      winners = pot.eligible.filter((id) => hands[id].score === top);
    }
    const gains = winners.length ? splitPot(pot.amount, winners, order) : {};
    return { amount: pot.amount, eligible: pot.eligible, winners, gains, refund: pot.eligible.length === 1 && showdown };
  });
  const gains = {};
  for (const pot of pots) for (const [id, g] of Object.entries(pot.gains)) gains[id] = (gains[id] || 0) + g;
  for (const x of t.seats) {
    x.chips += gains[x.id] || 0;
    x.bet = 0; // les mises de la dernière tournée sont dans les pots
  }
  t.showdown = {
    shown: showdown ? live.map((x) => x.id) : [],
    hands: Object.fromEntries(Object.entries(hands).map(([id, h]) => [id, { name: h.name, best: h.best, cat: h.cat }])),
    pots,
    gains,
    byFold: !showdown,
  };
  t.toAct = null;
  t.phase = 'result';
  // Éliminations : on classe ceux qui tombent dans la même main selon leur tapis de départ.
  const busted = t.seats.filter((x) => !x.out && x.chips === 0).sort((a, b) => a.stack0 - b.stack0);
  for (const x of busted) {
    x.out = true;
    x.busted = ++t.bustCount;
  }
  return settle(t, ctx, showdown ? RESULT_MS : RESULT_FOLD_MS);
}

// La partie est finie quand il reste au plus un joueur avec des jetons.
function settle(t, ctx, wait) {
  const remaining = t.seats.filter((x) => !x.out);
  if (remaining.length <= 1) {
    t.phase = 'over';
    t.winner = remaining.length ? remaining[0].id : null;
    t.deadline = null;
    t.toAct = null;
  } else {
    t.deadline = wait ? ctx.now + wait : t.deadline;
  }
  return t;
}

// Ce que le joueur assis à `idx` peut faire maintenant.
function options(t, idx) {
  const x = t.seats[idx];
  const toCall = Math.min(Math.max(0, t.currentBet - x.bet), x.chips);
  const maxTo = x.bet + x.chips;
  const minTo = Math.min(t.currentBet + t.minRaise, maxTo);
  return { toCall, minTo, maxTo, canCheck: x.bet >= t.currentBet, canRaise: !x.noRaise && maxTo > t.currentBet };
}

export function move(s, playerId, action, ctx) {
  if (s.phase !== 'hand') throw new Error('Attends la main suivante.');
  const idx = s.seats.findIndex((x) => x.id === playerId);
  if (idx === -1 || s.toAct !== idx) throw new Error('Ce n’est pas ton tour.');
  const type = action?.type;
  const t = clone(s);
  const x = t.seats[idx];
  const o = options(t, idx);

  if (type === 'fold') {
    x.folded = true;
    x.last = { t: 'fold' };
  } else if (type === 'check') {
    if (!o.canCheck) throw new Error(`Tu ne peux pas parler : il faut suivre (${o.toCall}) ou te coucher.`);
    x.last = { t: 'check' };
  } else if (type === 'call') {
    if (o.canCheck) throw new Error('Rien à suivre : tu peux parler.');
    commit(x, o.toCall);
    x.last = { t: x.allIn ? 'allin' : 'call', amt: x.bet };
  } else if (type === 'raise' || type === 'allin') {
    let to = type === 'allin' ? o.maxTo : Number(action.to);
    if (type === 'raise' && (!Number.isInteger(to) || to <= 0)) throw new Error('Indique le montant de ta relance.');
    if (to > o.maxTo) to = o.maxTo;
    if (to <= t.currentBet) {
      // Tapis trop court pour relancer : c'est un simple « suivre » avec tout ce qui reste.
      if (type === 'raise' && to < o.maxTo) throw new Error(`Une relance doit dépasser la mise actuelle (${t.currentBet}).`);
      commit(x, to - x.bet);
      x.last = { t: 'allin', amt: x.bet };
    } else {
      if (x.noRaise) throw new Error('Tu ne peux pas relancer : la dernière mise était un tapis trop court pour rouvrir les enchères. Tu peux suivre ou te coucher.');
      if (to < o.minTo) throw new Error(`La relance minimale est à ${o.minTo}.`);
      const size = to - t.currentBet;
      commit(x, to - x.bet);
      x.last = { t: x.allIn ? 'allin' : t.currentBet === 0 ? 'bet' : 'raise', amt: x.bet };
      if (size >= t.minRaise) {
        // Relance complète : tout le monde doit reparler et peut relancer à son tour.
        t.minRaise = size;
        for (const y of t.seats) {
          if (y !== x) {
            y.acted = false;
            y.noRaise = false;
          }
        }
      } else {
        // Tapis incomplet : ceux qui ont déjà parlé peuvent suivre ou se coucher, pas relancer.
        for (const y of t.seats) if (y !== x && y.acted) y.noRaise = true;
      }
      t.currentBet = x.bet;
    }
  } else {
    throw new Error('Action inconnue.');
  }
  x.acted = true;
  x.misses = 0;
  return { state: proceed(t, idx, ctx) };
}

export function timeout(s, ctx) {
  if (s.phase === 'result') return { state: _startHand(s, ctx) };
  if (s.phase !== 'hand' || s.toAct === null) return { state: s };
  const t = clone(s);
  const idx = t.toAct;
  const x = t.seats[idx];
  if (x.bet >= t.currentBet) x.last = { t: 'check' };
  else {
    x.folded = true;
    x.last = { t: 'fold' };
  }
  x.acted = true;
  x.misses += 1;
  return { state: proceed(t, idx, ctx) };
}

// Le joueur quitte : il se couche, ses jetons restent perdus pour lui, la partie continue sans lui.
export function leave(s, playerId, ctx) {
  const idx = s.seats.findIndex((x) => x.id === playerId);
  if (idx === -1 || s.seats[idx].out || s.phase === 'over') return { state: s };
  const t = clone(s);
  const x = t.seats[idx];
  const wasTurn = t.phase === 'hand' && t.toAct === idx;
  x.left = true;
  x.folded = true;
  x.out = true;
  x.busted = ++t.bustCount;
  if (t.phase === 'hand') {
    x.last = { t: 'fold' };
    x.acted = true;
    if (wasTurn || t.seats.filter(inHand).length <= 1) return { state: proceed(t, idx, ctx) };
    return { state: t };
  }
  return { state: settle(t, ctx, 0) };
}

export function status(s) {
  if (s.phase === 'over') return { over: true, turn: null, winners: s.winner === null ? [] : [s.winner] };
  return { over: false, turn: s.phase === 'hand' && s.toAct !== null ? s.seats[s.toAct].id : null, winners: [], deadline: s.deadline };
}

function ranking(s) {
  const rest = s.seats.filter((x) => x.id !== s.winner);
  return [...(s.winner === null ? [] : [s.winner]), ...rest.sort((a, b) => b.busted - a.busted).map((x) => x.id)];
}

// Ce que voit un joueur : ses cartes, et celles des autres seulement si elles ont été montrées à l'abattage.
export function view(s, playerId) {
  const shown = s.showdown ? s.showdown.shown : [];
  const myIdx = playerId === null ? -1 : s.seats.findIndex((x) => x.id === playerId);
  const me = s.phase === 'hand' && s.toAct !== null && s.toAct === myIdx ? options(s, myIdx) : null;
  const levelEvery = s.opts.levelEvery;
  const lastLevel = s.level >= BLIND_STEPS.length - 1;
  return {
    phase: s.phase,
    handNo: s.handNo,
    street: s.street,
    button: s.button,
    sbSeat: s.sbSeat,
    bbSeat: s.bbSeat,
    sb: s.sb,
    bb: s.bb,
    levelEvery,
    handsToLevel: levelEvery && !lastLevel ? levelEvery - ((s.handNo - 1) % levelEvery) : null,
    nextBlinds: levelEvery && !lastLevel ? blindsFor(s.opts, s.level + 1) : null,
    timer: s.opts.timer,
    deadline: s.deadline,
    board: s.board,
    pot: s.seats.reduce((n, x) => n + x.total, 0),
    currentBet: s.currentBet,
    toAct: s.toAct === null ? null : s.seats[s.toAct].id,
    me,
    seats: s.seats.map((x, i) => ({
      id: x.id,
      chips: x.chips,
      bet: x.bet,
      folded: x.folded && !x.out,
      allIn: x.allIn,
      out: x.out,
      left: x.left,
      inHand: inHand(x),
      cards: i === myIdx || shown.includes(x.id) ? x.cards : null,
      last: x.last,
      misses: x.misses,
    })),
    showdown: s.showdown,
    winner: s.winner,
    ranking: s.phase === 'over' ? ranking(s) : null,
    players: s.players,
  };
}
