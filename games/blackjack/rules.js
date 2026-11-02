// Blackjack : de 1 à 7 joueurs contre la banque (le serveur), sabot de 6 jeux, jetons virtuels.
// Règles retenues :
//  - tout le monde mise en même temps (mise : multiple de 10, au moins 10), puis les cartes sont distribuées ;
//  - carte, rester, doubler (sur les deux premières cartes, une seule carte de plus), séparer (une seule fois, deux
//    cartes de même valeur : un 10, un valet, une dame et un roi se séparent entre eux) ; pas d'assurance ;
//  - après une séparation d'as, chaque as ne reçoit qu'une carte ; un 21 après séparation n'est pas un blackjack ;
//  - un blackjack (as + figure ou 10 d'entrée) est payé 3 pour 2 ; toute autre victoire 1 pour 1 ; égalité : mise rendue ;
//  - la banque tire jusqu'à 17 et reste sur tous les 17, y compris un 17 « souple » (avec un as compté 11) ;
//  - si sa carte visible est un as ou une carte qui vaut 10, la banque regarde sa carte cachée : en cas de blackjack, la
//    manche s'arrête là (on ne perd pas de mise supplémentaire en doublant ou en séparant) ;
//  - la banque ne tire pas si tous les joueurs ont dépassé 21 ou ont un blackjack.
// Le hasard (mélange du sabot) vient de ctx.random ; l'état tient en JSON.

export const MIN_BET = 10;
const DECKS = 6;
const RESULT_MS = 8000; // résultat affiché entre deux manches
const RESHUFFLE_BELOW = 78; // on remélange quand il reste moins d'un quart du sabot au début d'une manche

const clone = (x) => structuredClone(x);
const rankOf = (c) => (c % 13) + 2;

export function cardValue(c) {
  const r = rankOf(c);
  return r === 14 ? 11 : Math.min(r, 10);
}

// Valeur d'une main : { total, soft } ; un as vaut 11 tant que ça ne fait pas dépasser 21.
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (rankOf(c) === 14) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export const isBlackjack = (cards) => cards.length === 2 && handValue(cards).total === 21;

function newShoe(random) {
  const a = Array.from({ length: 52 * DECKS }, (_, i) => i % 52);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function readOptions(options = {}) {
  const start = [500, 1000, 2000].includes(Number(options.start)) ? Number(options.start) : 1000;
  const rounds = [5, 10, 15, 20].includes(Number(options.rounds)) ? Number(options.rounds) : 10;
  const timer = [0, 15, 20, 30].includes(Number(options.timer)) ? Number(options.timer) : 20;
  return { start, rounds, timer };
}

const emptySeat = (id, chips) => ({ id, chips, placed: false, hands: [], cur: 0, out: false, left: false, delta: 0, rank: 0 });

export function setup(players, options, ctx) {
  const opts = readOptions(options);
  const s = {
    players: players.map((p) => p.id),
    seats: players.map((p) => emptySeat(p.id, opts.start)),
    opts,
    solo: players.length === 1,
    round: 0,
    phase: 'bet',
    shoe: newShoe(ctx.random),
    dealer: { cards: [], revealed: false },
    turn: null, // index de siège du joueur qui joue
    deadline: null,
    outCount: 0,
    shuffled: 1,
  };
  return startRound(s, ctx);
}

const active = (s) => s.seats.filter((x) => !x.out);

function startRound(s, ctx) {
  const t = clone(s);
  t.round += 1;
  if (t.shoe.length < RESHUFFLE_BELOW) {
    t.shoe = newShoe(ctx.random);
    t.shuffled += 1;
  }
  t.phase = 'bet';
  t.dealer = { cards: [], revealed: false };
  t.turn = null;
  for (const x of t.seats) Object.assign(x, { placed: false, hands: [], cur: 0, delta: 0 });
  t.deadline = t.opts.timer ? ctx.now + t.opts.timer * 1000 : null;
  return t;
}

const draw = (t) => t.shoe.pop();

// Mise d'un joueur. Quand tout le monde a misé, les cartes sont distribuées.
function placeBet(t, x, amount, ctx) {
  x.chips -= amount;
  x.placed = true;
  x.hands = [{ cards: [], bet: amount, done: false, bust: false, natural: false, doubled: false, split: false, result: null, gain: 0 }];
  if (active(t).every((y) => y.placed)) return deal(t, ctx);
  return t;
}

function deal(t, ctx) {
  const seats = active(t);
  for (let pass = 0; pass < 2; pass++) {
    for (const x of seats) x.hands[0].cards.push(draw(t));
    t.dealer.cards.push(draw(t));
  }
  for (const x of seats) {
    if (isBlackjack(x.hands[0].cards)) {
      x.hands[0].natural = true;
      x.hands[0].done = true;
    }
  }
  // La banque regarde sa carte cachée si la carte visible est un as ou vaut 10.
  if (cardValue(t.dealer.cards[0]) >= 10 && isBlackjack(t.dealer.cards)) {
    t.dealer.revealed = true;
    return settle(t, ctx);
  }
  return nextToPlay(t, ctx, -1);
}

// Cherche le prochain joueur qui a encore une main à jouer, à partir du siège `from` (sa main courante comprise si from >= 0
// et qu'elle n'est pas finie). Sinon la banque joue.
function nextToPlay(t, ctx, from) {
  for (let i = Math.max(from, 0); i < t.seats.length; i++) {
    const x = t.seats[i];
    if (x.out || !x.placed) continue;
    const k = x.hands.findIndex((hd) => !hd.done);
    if (k !== -1) {
      x.cur = k;
      t.turn = i;
      t.deadline = t.opts.timer ? ctx.now + t.opts.timer * 1000 : null;
      t.phase = 'play';
      return t;
    }
  }
  return dealerPlays(t, ctx);
}

function dealerPlays(t, ctx) {
  t.turn = null;
  t.dealer.revealed = true;
  const live = t.seats.some((x) => !x.out && x.hands.some((hd) => !hd.bust && !hd.natural && !hd.forfeit));
  if (live) {
    while (handValue(t.dealer.cards).total < 17) t.dealer.cards.push(draw(t));
  }
  return settle(t, ctx);
}

function settle(t, ctx) {
  const dealer = handValue(t.dealer.cards).total;
  const dealerBJ = isBlackjack(t.dealer.cards);
  for (const x of t.seats) {
    if (x.out && !x.hands.length) continue;
    for (const hd of x.hands) {
      if (hd.forfeit) {
        hd.result = 'lose';
        hd.gain = -hd.bet;
        continue;
      }
      const v = handValue(hd.cards).total;
      let result;
      if (hd.bust) result = 'lose';
      else if (hd.natural) result = dealerBJ ? 'push' : 'blackjack';
      else if (dealerBJ) result = 'lose';
      else if (dealer > 21) result = 'win';
      else result = v > dealer ? 'win' : v === dealer ? 'push' : 'lose';
      hd.result = result;
      hd.gain = result === 'blackjack' ? (hd.bet * 3) / 2 : result === 'win' ? hd.bet : result === 'push' ? 0 : -hd.bet;
      if (!x.left && result !== 'lose') x.chips += hd.bet + hd.gain; // la mise revient, plus le gain
      x.delta += hd.gain;
    }
  }
  t.turn = null;
  t.phase = 'result';
  t.deadline = ctx.now + RESULT_MS;
  // Éliminés : plus assez pour la mise minimale.
  for (const x of t.seats) {
    if (!x.out && x.chips < MIN_BET) {
      x.out = true;
      x.rank = ++t.outCount;
    }
  }
  const remaining = active(t);
  const endEarly = t.seats.length > 1 ? remaining.length <= 1 : remaining.length === 0;
  if (t.round >= t.opts.rounds || endEarly) {
    t.phase = 'over';
    t.deadline = null;
  }
  return t;
}

// ——— Coups ———

function options(t, x) {
  const hd = x.hands[x.cur];
  const two = hd.cards.length === 2;
  const maxBet = Math.floor(x.chips / 10) * 10;
  return {
    canHit: true,
    canDouble: two && x.chips >= hd.bet,
    canSplit: two && x.hands.length === 1 && cardValue(hd.cards[0]) === cardValue(hd.cards[1]) && x.chips >= hd.bet,
    maxBet,
  };
}

export function move(s, playerId, action, ctx) {
  const idx = s.seats.findIndex((x) => x.id === playerId);
  if (idx === -1) throw new Error('Tu ne joues pas cette partie.');
  const t = clone(s);
  const x = t.seats[idx];
  const type = action?.type;

  if (t.phase === 'bet') {
    if (type !== 'bet') throw new Error('Place ta mise pour commencer la manche.');
    if (x.out || x.left) throw new Error('Tu ne joues plus.');
    if (x.placed) throw new Error('Ta mise est déjà placée.');
    const amount = Number(action.amount);
    if (!Number.isInteger(amount) || amount < MIN_BET) throw new Error(`La mise minimale est de ${MIN_BET} jetons.`);
    if (amount % 10 !== 0) throw new Error('Mise par multiples de 10 jetons.');
    if (amount > x.chips) throw new Error(`Tu n’as que ${x.chips} jetons.`);
    return { state: placeBet(t, x, amount, ctx) };
  }
  if (t.phase !== 'play') throw new Error('Attends la prochaine manche.');
  if (t.turn !== idx) throw new Error('Ce n’est pas ton tour.');
  const hd = x.hands[x.cur];
  const o = options(t, x);
  const finishHand = () => nextToPlay(t, ctx, idx);

  if (type === 'hit') {
    hd.cards.push(draw(t));
    const v = handValue(hd.cards).total;
    if (v > 21) {
      hd.bust = true;
      hd.done = true;
    } else if (v === 21) hd.done = true;
    return { state: hd.done ? finishHand() : refresh(t, ctx) };
  }
  if (type === 'stand') {
    hd.done = true;
    return { state: finishHand() };
  }
  if (type === 'double') {
    if (hd.cards.length !== 2) throw new Error('Tu ne peux doubler que sur tes deux premières cartes.');
    if (x.chips < hd.bet) throw new Error('Pas assez de jetons pour doubler.');
    x.chips -= hd.bet;
    hd.bet *= 2;
    hd.doubled = true;
    hd.cards.push(draw(t));
    hd.done = true;
    if (handValue(hd.cards).total > 21) hd.bust = true;
    return { state: finishHand() };
  }
  if (type === 'split') {
    if (x.hands.length > 1) throw new Error('Tu ne peux séparer qu’une seule fois.');
    if (!o.canSplit) throw new Error(hd.cards.length === 2 && cardValue(hd.cards[0]) !== cardValue(hd.cards[1]) ? 'Il faut deux cartes de même valeur pour séparer.' : 'Tu ne peux pas séparer ici.');
    x.chips -= hd.bet;
    const [a, b] = hd.cards;
    const aces = rankOf(a) === 14;
    const make = (c) => ({ cards: [c, draw(t)], bet: hd.bet, done: false, bust: false, natural: false, doubled: false, split: true, result: null, gain: 0 });
    x.hands = [make(a), make(b)];
    for (const h of x.hands) {
      const v = handValue(h.cards).total;
      if (aces || v === 21) h.done = true; // as séparé : une seule carte ; 21 : on reste
    }
    x.cur = 0;
    return { state: x.hands.some((h) => !h.done) ? refresh(t, ctx, idx) : finishHand() };
  }
  throw new Error('Action inconnue.');
}

// Après une action qui laisse la main ouverte : on garde la main courante, et le minuteur repart.
function refresh(t, ctx, idx = t.turn) {
  const x = t.seats[idx];
  x.cur = Math.max(0, x.hands.findIndex((h) => !h.done));
  t.deadline = t.opts.timer ? ctx.now + t.opts.timer * 1000 : null;
  return t;
}

export function timeout(s, ctx) {
  if (s.phase === 'result') return { state: startRound(s, ctx) };
  const t = clone(s);
  if (s.phase === 'bet') {
    // Mise minimale pour ceux qui n'ont pas misé.
    for (const x of t.seats) {
      if (!x.out && !x.placed) {
        x.chips -= MIN_BET;
        x.placed = true;
        x.hands = [{ cards: [], bet: MIN_BET, done: false, bust: false, natural: false, doubled: false, split: false, result: null, gain: 0 }];
      }
    }
    return { state: deal(t, ctx) };
  }
  if (s.phase === 'play' && t.turn !== null) {
    const x = t.seats[t.turn];
    x.hands[x.cur].done = true; // le temps est écoulé : on reste
    return { state: nextToPlay(t, ctx, t.turn) };
  }
  return { state: s };
}

// Le joueur quitte : sa mise est perdue, la manche continue sans lui.
export function leave(s, playerId, ctx) {
  const idx = s.seats.findIndex((x) => x.id === playerId);
  if (idx === -1 || s.seats[idx].left || s.phase === 'over') return { state: s };
  const t = clone(s);
  const x = t.seats[idx];
  const wasTurn = t.phase === 'play' && t.turn === idx;
  x.left = true;
  if (!x.out) {
    x.out = true;
    x.rank = ++t.outCount;
  }
  for (const hd of x.hands) {
    if (t.phase === 'bet' || t.phase === 'play') {
      hd.forfeit = true;
      hd.done = true;
    }
  }
  const remaining = active(t);
  if (!remaining.length || (t.seats.length > 1 && remaining.length <= 1 && t.phase === 'result')) {
    t.phase = 'over';
    t.deadline = null;
    t.turn = null;
    return { state: t };
  }
  if (t.phase === 'bet') {
    if (remaining.every((y) => y.placed)) return { state: deal(t, ctx) };
    return { state: t };
  }
  if (t.phase === 'play') {
    if (wasTurn) return { state: nextToPlay(t, ctx, idx) };
    // Il n'avait pas encore joué : ses mains sont marquées terminées, rien d'autre à faire.
    return { state: t };
  }
  return { state: t };
}

// ——— Fin de partie ———

function finalists(s) {
  const players = s.seats.filter((x) => !x.left);
  if (!players.length) return [];
  const best = Math.max(...players.map((x) => x.chips));
  if (s.solo) return best >= s.opts.start ? [players[0].id] : [];
  return players.filter((x) => x.chips === best).map((x) => x.id);
}

export function status(s) {
  if (s.phase === 'over') return { over: true, turn: null, winners: finalists(s) };
  let turn = null;
  if (s.phase === 'bet') turn = s.seats.filter((x) => !x.out && !x.placed).map((x) => x.id);
  else if (s.phase === 'play' && s.turn !== null) turn = s.seats[s.turn].id;
  return { over: false, turn, winners: [], deadline: s.deadline };
}

function ranking(s) {
  return [...s.seats].sort((a, b) => (a.left === b.left ? b.chips - a.chips : a.left ? 1 : -1)).map((x) => x.id);
}

// Ce que voit un joueur : la banque cache sa deuxième carte jusqu'à son tour ; pendant les mises, on ne voit pas la mise des autres.
export function view(s, playerId) {
  const hidden = !s.dealer.revealed && s.dealer.cards.length > 0;
  const bets = s.phase === 'bet';
  const myIdx = playerId === null ? -1 : s.seats.findIndex((x) => x.id === playerId);
  const me = myIdx !== -1 ? s.seats[myIdx] : null;
  let mine = null;
  if (me && s.phase === 'bet' && !me.placed && !me.out) mine = { maxBet: Math.floor(me.chips / 10) * 10, minBet: MIN_BET };
  if (me && s.phase === 'play' && s.turn === myIdx) mine = options(s, me);
  return {
    phase: s.phase,
    round: s.round,
    rounds: s.opts.rounds,
    timer: s.opts.timer,
    start: s.opts.start,
    deadline: s.deadline,
    shoeLeft: s.shoe.length,
    shuffled: s.shuffled,
    dealer: {
      cards: hidden ? [s.dealer.cards[0], null] : s.dealer.cards,
      value: s.dealer.cards.length && !hidden ? handValue(s.dealer.cards).total : null,
      shown: hidden ? cardValue(s.dealer.cards[0]) : null,
      blackjack: !hidden && isBlackjack(s.dealer.cards),
      bust: !hidden && handValue(s.dealer.cards).total > 21,
    },
    turn: s.turn === null ? null : s.seats[s.turn].id,
    me: mine,
    seats: s.seats.map((x, i) => {
      const own = i === myIdx;
      const pending = bets && !own;
      return {
        id: x.id,
        chips: pending && x.placed ? x.chips + x.hands[0].bet : x.chips,
        placed: x.placed,
        out: x.out,
        left: x.left,
        cur: x.cur,
        delta: x.delta,
        hands: x.hands.map((hd) => {
          const val = handValue(hd.cards);
          return {
            cards: hd.cards,
            bet: pending ? null : hd.bet,
            total: val.total,
            soft: val.soft && val.total <= 21,
            done: hd.done,
            bust: hd.bust,
            natural: hd.natural,
            doubled: hd.doubled,
            split: hd.split,
            forfeit: Boolean(hd.forfeit),
            result: hd.result,
            gain: hd.gain,
          };
        }),
      };
    }),
    ranking: s.phase === 'over' ? ranking(s) : null,
    winners: s.phase === 'over' ? finalists(s) : [],
    solo: s.solo,
    players: s.players,
  };
}
