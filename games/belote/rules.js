// Belote : règles pures (ni réseau, ni base, ni affichage). Le hasard et l'heure viennent de ctx.
//
// Places : 0 et 2 contre 1 et 3 (places 1 et 3 contre 2 et 4 à l'écran). Le tour passe de la place n à la place n+1.
// Cartes : "S7", "H10", "DK"… = couleur (S pique, H cœur, D carreau, C trèfle) + valeur (7 8 9 10 J Q K A).
//
// Règles retenues (belote classique) :
// - 32 cartes, 8 par joueur. Distribution 3 + 2, la 21e carte est retournée.
// - Premier tour : chacun peut prendre à la couleur retournée. Second tour : chacun peut choisir une autre couleur.
//   Si personne ne prend, on redistribue (le donneur suivant).
// - Le preneur reçoit la retourne, puis le reste est distribué (2 cartes au preneur, 3 aux autres).
// - Obligations : fournir ; sinon couper (sauf si le partenaire est maître) en surcoupant si possible ; à l'atout, monter.
// - Belote-rebelote : 20 points, annoncés automatiquement quand on joue le second du roi et de la dame d'atout.
// - Dix de der : 10 points. Capot (huit plis) : 252 points. Contrat : le preneur doit faire strictement plus que la défense
//   (belote comprise), sinon il est « dedans » : la défense marque 162 (252 si elle fait tous les plis).
// - Partie en 501 ou 1001 points. Une égalité au contrat compte comme « dedans ».
// - Abandon (leave) : on ne peut pas jouer à trois, la partie se termine et l'autre équipe gagne.

export const SUITS = ['S', 'H', 'D', 'C'];
export const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUIT_NAMES = { S: 'pique', H: 'cœur', D: 'carreau', C: 'trèfle' };

const TRUMP_ORDER = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J']; // du plus faible au plus fort
const PLAIN_ORDER = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
const TRUMP_POINTS = { J: 20, 9: 14, A: 11, 10: 10, K: 4, Q: 3, 8: 0, 7: 0 };
const PLAIN_POINTS = { A: 11, 10: 10, K: 4, Q: 3, J: 2, 9: 0, 8: 0, 7: 0 };
const RECAP_MS = 30_000; // pause entre deux donnes avant la suivante

export const suitOf = (card) => card[0];
export const rankOf = (card) => card.slice(1);
export const teamOf = (seat) => seat % 2;

export function makeDeck() {
  return SUITS.flatMap((s) => RANKS.map((r) => s + r));
}

// Mélange de Fisher-Yates avec le hasard fourni.
export function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Force d'une carte dans sa couleur (plus grand = plus fort).
export const rankStrength = (card, trump) => (suitOf(card) === trump ? TRUMP_ORDER : PLAIN_ORDER).indexOf(rankOf(card));
export const cardPoints = (card, trump) => (suitOf(card) === trump ? TRUMP_POINTS : PLAIN_POINTS)[rankOf(card)];

// Plateau en cours : [{ seat, card }, …] dans l'ordre de jeu. Renvoie l'entrée qui l'emporte pour l'instant.
export function trickLeader(trick, trump) {
  const trumps = trick.filter((t) => suitOf(t.card) === trump);
  const pool = trumps.length ? trumps : trick.filter((t) => suitOf(t.card) === suitOf(trick[0].card));
  return pool.reduce((best, t) => (rankStrength(t.card, trump) > rankStrength(best.card, trump) ? t : best));
}

// Cartes autorisées et raison de l'obligation. trick vide = on ouvre, tout est permis.
export function obligation(hand, trick, trump, seat) {
  if (!trick.length) return { legal: hand.slice(), reason: 'Tu ouvres le pli : joue la carte que tu veux.' };
  const led = suitOf(trick[0].card);
  const follow = hand.filter((c) => suitOf(c) === led);
  const winning = trickLeader(trick, trump);
  const topTrump = trick.filter((t) => suitOf(t.card) === trump).reduce((m, t) => Math.max(m, rankStrength(t.card, trump)), -1);
  if (led === trump) {
    if (!follow.length) return { legal: hand.slice(), reason: 'Tu n’as pas d’atout : joue ce que tu veux.' };
    const higher = follow.filter((c) => rankStrength(c, trump) > topTrump);
    return higher.length
      ? { legal: higher, reason: 'Tu dois monter à l’atout.' }
      : { legal: follow, reason: 'Tu ne peux pas monter, mais tu dois jouer atout.' };
  }
  if (follow.length) return { legal: follow, reason: `Tu dois fournir à ${SUIT_NAMES[led]}.` };
  if (teamOf(winning.seat) === teamOf(seat)) return { legal: hand.slice(), reason: 'Ton partenaire est maître : tu n’es pas obligé de couper.' };
  const trumps = hand.filter((c) => suitOf(c) === trump);
  if (!trumps.length) return { legal: hand.slice(), reason: `Tu n’as ni ${SUIT_NAMES[led]} ni atout : joue ce que tu veux.` };
  if (topTrump >= 0) {
    const higher = trumps.filter((c) => rankStrength(c, trump) > topTrump);
    return higher.length
      ? { legal: higher, reason: 'Tu dois surcouper.' }
      : { legal: trumps, reason: 'Tu ne peux pas surcouper, mais tu dois jouer atout.' };
  }
  return { legal: trumps, reason: 'Tu dois couper à l’atout.' };
}

export const legalCards = (hand, trick, trump, seat) => obligation(hand, trick, trump, seat).legal;

// Compte d'une donne. raw : points des plis + dix de der par équipe (162 au total) ; belote : 20 pour l'équipe qui l'a.
export function scoreHand({ takerTeam, trickPoints, tricks, lastTrickTeam, belote }) {
  const raw = [0, 1].map((t) => trickPoints[t] + (lastTrickTeam === t ? 10 : 0));
  const capot = tricks[0] === 8 ? 0 : tricks[1] === 8 ? 1 : null;
  const total = [raw[0] + belote[0], raw[1] + belote[1]];
  const made = total[takerTeam] > total[1 - takerTeam];
  const gained = [0, 0];
  if (made) {
    for (const t of [0, 1]) gained[t] = (capot === t ? 252 : raw[t]) + belote[t];
  } else {
    const def = 1 - takerTeam;
    gained[def] = (capot === def ? 252 : 162) + belote[def];
    gained[takerTeam] = belote[takerTeam];
  }
  return { raw, belote, capot, made, gained, takerTeam };
}

// ——— Cycle d'une partie ———

const nextSeat = (s) => (s + 1) % 4;
const deadlineFor = (state, ctx) => (state.timer ? ctx.now + state.timer * 1000 : null);

// Distribue une donne : 3 + 2 cartes, la 21e est retournée, 11 cartes restent pour le preneur et les autres.
export function dealHand(base, dealer, ctx) {
  const deck = shuffle(makeDeck(), ctx.random);
  const first = nextSeat(dealer);
  const hands = [[], [], [], []];
  let p = 0;
  for (const n of [3, 2]) for (let i = 0; i < 4; i++) for (let k = 0; k < n; k++) hands[(first + i) % 4].push(deck[p++]);
  const state = {
    ...base,
    dealer,
    phase: 'bid1',
    hands,
    upcard: deck[p++],
    stock: deck.slice(p),
    turn: first,
    passes: 0,
    bids: [],
    taker: null,
    trump: null,
    trick: [],
    lastTrick: null,
    tricks: [0, 0],
    trickPoints: [0, 0],
    belote: [0, 0],
    beloteSeat: null,
    beloteSeen: 0,
    lastTrickTeam: null,
    recap: null,
    ready: [false, false, false, false],
  };
  state.deadline = deadlineFor(state, ctx);
  return state;
}

// players : [{ id, pseudo }] dans l'ordre des places. options : { target: 501|1001, timer: 0|20|30|60 }.
export function setup(players, options, ctx) {
  if (players.length !== 4) throw new Error('La belote se joue à quatre.');
  const base = {
    players: players.map((p) => p.id),
    target: options?.target === 1001 ? 1001 : 501,
    timer: Math.max(0, Math.floor(Number(options?.timer) || 0)),
    scores: [0, 0],
    handNo: 1,
    announce: { n: 0, kind: null, seat: null },
    winnerTeam: null,
    forfeit: null,
  };
  return dealHand(base, Math.floor(ctx.random() * 4) % 4, ctx);
}

const announce = (state, kind, seat) => ({ n: state.announce.n + 1, kind, seat });
const seatOf = (state, id) => state.players.indexOf(id);

function pass(state, ctx) {
  const bids = [...state.bids, { seat: state.turn, act: 'pass', round: state.phase === 'bid1' ? 1 : 2 }];
  const passes = state.passes + 1;
  if (passes < 4) return { ...state, bids, passes, turn: nextSeat(state.turn), deadline: deadlineFor(state, ctx) };
  if (state.phase === 'bid1') {
    return { ...state, bids, phase: 'bid2', passes: 0, turn: nextSeat(state.dealer), deadline: deadlineFor(state, ctx) };
  }
  // Personne n'a pris : on redistribue avec le donneur suivant.
  const redone = dealHand(state, nextSeat(state.dealer), ctx);
  return { ...redone, announce: announce(state, 'redeal', null) };
}

function take(state, seat, suit, ctx) {
  const trump = state.phase === 'bid1' ? suitOf(state.upcard) : suit;
  if (state.phase === 'bid2') {
    if (!SUITS.includes(suit)) throw new Error('Choisis une couleur d’atout.');
    if (suit === suitOf(state.upcard)) throw new Error('Au second tour, choisis une autre couleur que la retournée.');
  }
  const first = nextSeat(state.dealer);
  const hands = state.hands.map((h) => h.slice());
  hands[seat].push(state.upcard);
  let p = 0;
  for (let i = 0; i < 4; i++) {
    const s = (first + i) % 4;
    const n = s === seat ? 2 : 3;
    hands[s].push(...state.stock.slice(p, p + n));
    p += n;
  }
  const beloteSeat = hands.findIndex((h) => h.includes(`${trump}K`) && h.includes(`${trump}Q`));
  const next = {
    ...state,
    phase: 'play',
    hands,
    stock: [],
    taker: seat,
    trump,
    bids: [...state.bids, { seat, act: 'take', suit: trump, round: state.phase === 'bid1' ? 1 : 2 }],
    beloteSeat: beloteSeat >= 0 ? beloteSeat : null,
    beloteSeen: 0,
    turn: first,
    trick: [],
    passes: 0,
  };
  next.deadline = deadlineFor(next, ctx);
  return next;
}

// Joue une carte (déjà validée) et fait avancer le pli, la donne ou la partie.
function playCard(state, seat, card, ctx) {
  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c !== card) : h));
  const trick = [...state.trick, { seat, card }];
  let s = { ...state, hands, trick };
  // Belote-rebelote : annoncée automatiquement par celui qui a le roi et la dame d'atout.
  if (seat === state.beloteSeat && (card === `${state.trump}K` || card === `${state.trump}Q`)) {
    s.beloteSeen = state.beloteSeen + 1;
    s.announce = announce(state, s.beloteSeen === 1 ? 'belote' : 'rebelote', seat);
    if (s.beloteSeen === 2) {
      s.belote = state.belote.slice();
      s.belote[teamOf(seat)] += 20;
    }
  }
  if (trick.length < 4) return { ...s, turn: nextSeat(seat), deadline: deadlineFor(state, ctx) };

  const winner = trickLeader(trick, state.trump).seat;
  const team = teamOf(winner);
  const points = trick.reduce((sum, t) => sum + cardPoints(t.card, state.trump), 0);
  const tricks = state.tricks.slice();
  const trickPoints = state.trickPoints.slice();
  tricks[team] += 1;
  trickPoints[team] += points;
  s = { ...s, trick: [], lastTrick: { cards: trick, winner }, tricks, trickPoints };
  if (hands.some((h) => h.length)) return { ...s, turn: winner, deadline: deadlineFor(state, ctx) };
  return finishHand({ ...s, lastTrickTeam: team }, ctx);
}

function finishHand(state, ctx) {
  const result = scoreHand({
    takerTeam: teamOf(state.taker),
    trickPoints: state.trickPoints,
    tricks: state.tricks,
    lastTrickTeam: state.lastTrickTeam,
    belote: state.belote,
  });
  const scores = [state.scores[0] + result.gained[0], state.scores[1] + result.gained[1]];
  const best = Math.max(scores[0], scores[1]);
  const finished = best >= state.target && scores[0] !== scores[1];
  return {
    ...state,
    scores,
    phase: finished ? 'over' : 'recap',
    winnerTeam: finished ? (scores[0] > scores[1] ? 0 : 1) : null,
    recap: { ...result, taker: state.taker, trump: state.trump, tricks: state.tricks, trickPoints: state.trickPoints, lastTrickTeam: state.lastTrickTeam },
    ready: [false, false, false, false],
    turn: null,
    deadline: finished ? null : ctx.now + RECAP_MS,
  };
}

function nextHand(state, ctx) {
  const { hands, stock, upcard, passes, bids, taker, trump, trick, lastTrick, tricks, trickPoints, belote, beloteSeat, beloteSeen, lastTrickTeam, recap, ready, ...base } = state;
  return dealHand({ ...base, handNo: state.handNo + 1 }, nextSeat(state.dealer), ctx);
}

// Un coup : { type: 'take', suit? } | { type: 'pass' } | { type: 'play', card } | { type: 'next' }.
export function move(state, playerId, action, ctx) {
  const seat = seatOf(state, playerId);
  if (seat < 0) throw new Error('Tu ne fais pas partie de cette partie.');
  const type = action?.type;
  if (state.phase === 'over') throw new Error('La partie est terminée.');

  if (state.phase === 'recap') {
    if (type !== 'next') throw new Error('La donne est finie : clique sur « Donne suivante ».');
    const ready = state.ready.slice();
    ready[seat] = true;
    if (ready.every(Boolean)) return { state: nextHand(state, ctx) };
    return { state: { ...state, ready } };
  }

  if (state.turn !== seat) throw new Error('Ce n’est pas ton tour.');

  if (state.phase === 'bid1' || state.phase === 'bid2') {
    if (type === 'pass') return { state: pass(state, ctx) };
    if (type === 'take') return { state: take(state, seat, action.suit, ctx) };
    throw new Error(state.phase === 'bid1' ? 'Prends ou passe.' : 'Choisis une couleur ou passe.');
  }

  if (type !== 'play') throw new Error('Joue une carte.');
  const card = String(action.card);
  if (!state.hands[seat].includes(card)) throw new Error('Cette carte n’est pas dans ta main.');
  const { legal, reason } = obligation(state.hands[seat], state.trick, state.trump, seat);
  if (!legal.includes(card)) throw new Error(`Cette carte n’est pas permise. ${reason}`);
  return { state: playCard(state, seat, card, ctx) };
}

// La carte jouée à la place d'un joueur trop lent : la plus faible parmi les cartes autorisées.
export function lowestLegal(hand, trick, trump, seat) {
  const legal = legalCards(hand, trick, trump, seat);
  const key = (c) => [cardPoints(c, trump), rankStrength(c, trump), SUITS.indexOf(suitOf(c))];
  return legal.slice().sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
  })[0];
}

// Minuteur échu : passer pendant les enchères, la plus petite carte autorisée en jeu, donne suivante après le compte.
export function timeout(state, ctx) {
  if (state.phase === 'recap') return { state: nextHand(state, ctx) };
  if (state.phase === 'bid1' || state.phase === 'bid2') return { state: pass(state, ctx) };
  if (state.phase === 'play') {
    const card = lowestLegal(state.hands[state.turn], state.trick, state.trump, state.turn);
    return { state: playCard(state, state.turn, card, ctx) };
  }
  return { state };
}

// Abandon : à trois la belote ne se joue pas, la partie s'arrête et l'autre équipe gagne.
export function leave(state, playerId) {
  const seat = seatOf(state, playerId);
  if (state.phase === 'over' || seat < 0) return { state };
  return { state: { ...state, phase: 'over', forfeit: seat, winnerTeam: 1 - teamOf(seat), turn: null, deadline: null } };
}

// Ce que voit chaque personne : seule sa propre main est visible. playerId null = spectateur.
export function view(state, playerId) {
  const seat = playerId === null ? -1 : seatOf(state, playerId);
  const mine = seat >= 0 ? state.hands[seat] : [];
  let legal = [];
  let hint = '';
  if (state.phase === 'play' && seat >= 0 && state.turn === seat) {
    ({ legal, reason: hint } = obligation(mine, state.trick, state.trump, seat));
  }
  return {
    players: state.players,
    seat,
    phase: state.phase,
    dealer: state.dealer,
    handNo: state.handNo,
    target: state.target,
    timer: state.timer,
    scores: state.scores,
    turn: state.turn,
    deadline: state.deadline,
    upcard: state.phase === 'bid1' || state.phase === 'bid2' ? state.upcard : null,
    bids: state.bids,
    taker: state.taker,
    trump: state.trump,
    trick: state.trick,
    lastTrick: state.lastTrick,
    tricks: state.tricks,
    counts: state.hands.map((h) => h.length),
    hand: mine,
    legal,
    hint,
    belote: state.beloteSeat !== null && state.beloteSeat === seat,
    announce: state.announce,
    recap: state.recap,
    ready: state.ready,
    winnerTeam: state.winnerTeam,
    forfeit: state.forfeit,
  };
}

export function status(state) {
  const over = state.phase === 'over';
  let turn = null;
  if (!over) {
    if (state.phase === 'recap') turn = state.players.filter((_, i) => !state.ready[i]);
    else turn = state.players[state.turn];
  }
  const winners = over ? state.players.filter((_, i) => teamOf(i) === state.winnerTeam) : [];
  return { turn, over, winners, deadline: over ? null : state.deadline };
}
