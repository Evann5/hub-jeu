// Pioche ! : jeu de défausse (2 à 8 joueurs). Les règles sont pures : pas de réseau, pas de base, pas d'affichage.
//
// Cartes : une chaîne « couleur + valeur ». Couleurs R (rose), J (jaune), V (vert), B (bleu).
// Valeurs : 0 à 9, +2, X (passe), I (inverse). Jokers : WC (change de couleur), WF (change de couleur et +4).
// La pile de pioche est un tableau dont le dernier élément est le dessus ; la défausse aussi.

export const COLORS = ['R', 'J', 'V', 'B'];
const VALUE_ORDER = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+2', 'X', 'I'];
const HAND_SIZE = 7;
const CALL_WINDOW_MS = 5000; // temps pour annoncer « Dernière ! » ou dénoncer
const BETWEEN_MS = 12000; // pause entre deux manches
const LOG_SIZE = 6;

const isWild = (c) => c[0] === 'W';
const colorOf = (c) => (isWild(c) ? null : c[0]);
const valueOf = (c) => c.slice(1);

export function buildDeck() {
  const deck = [];
  for (const c of COLORS) {
    deck.push(`${c}0`);
    for (let v = 1; v <= 9; v++) deck.push(`${c}${v}`, `${c}${v}`);
    for (const v of ['+2', 'X', 'I']) deck.push(`${c}${v}`, `${c}${v}`);
  }
  for (let i = 0; i < 4; i++) deck.push('WC', 'WF');
  return deck; // 108 cartes
}

// Points d'une carte restée en main en fin de manche.
export function points(card) {
  if (isWild(card)) return 50;
  const v = valueOf(card);
  return /^\d$/.test(v) ? Number(v) : 20;
}

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sortKey = (c) => (isWild(c) ? 100 + (c === 'WF' ? 1 : 0) : COLORS.indexOf(c[0]) * 20 + VALUE_ORDER.indexOf(valueOf(c)));
const sortHand = (hand) => hand.slice().sort((a, b) => sortKey(a) - sortKey(b));

const active = (s) => s.players.filter((id) => !s.out.includes(id));

// Une carte peut-elle se poser sur la défausse ?
export function canPlay(s, card) {
  // Cumul en cours : on ne peut que renchérir (+2 sur +2, +4 sur +2 ou +4), sinon on pioche le tout.
  if (s.stack) return card === 'WF' || (s.stackKind === '+2' && valueOf(card) === '+2');
  if (isWild(card)) return true;
  const top = s.discard[s.discard.length - 1];
  return colorOf(card) === s.color || (!isWild(top) && valueOf(card) === valueOf(top));
}

// ——— Mise en place ———

function dealRound(s, ctx) {
  const ids = active(s);
  let draw = shuffle(buildDeck(), ctx.random);
  const hands = Object.fromEntries(s.players.map((id) => [id, []]));
  for (let i = 0; i < HAND_SIZE; i++) for (const id of ids) hands[id].push(draw.pop());
  // La première carte de la défausse est un chiffre ; les autres vont sous la pioche.
  const buried = [];
  let first = null;
  while (draw.length && first === null) {
    const c = draw.pop();
    if (/^[RJVB]\d$/.test(c)) first = c;
    else buried.push(c);
  }
  s.draw = [...buried, ...draw];
  s.hands = hands;
  s.discard = [first];
  s.color = colorOf(first);
  s.dir = 1;
  s.stack = 0;
  s.stackKind = null;
  s.phase = 'play';
  s.drawn = null;
  s.pending = null;
  s.called = [];
  s.roundResult = null;
  s.turn = s.starter;
  setDeadline(s, ctx);
}

export function setup(players, options, ctx) {
  const ids = players.map((p) => p.id);
  const s = {
    players: ids,
    out: [],
    hands: {},
    draw: [],
    discard: [],
    color: 'R',
    dir: 1,
    turn: 0,
    starter: Math.floor(ctx.random() * ids.length),
    phase: 'play',
    drawn: null,
    pending: null,
    called: [],
    scores: Object.fromEntries(ids.map((id) => [id, 0])),
    round: 1,
    rounds: Math.max(1, Math.round(Number(options?.rounds)) || 1),
    timer: [20, 30, 60].includes(Number(options?.timer)) ? Number(options.timer) : 0,
    stacking: options?.stack !== false, // les +2 et +4 s'empilent (règle de maison courante)
    stack: 0, // cartes à piocher accumulées
    stackKind: null, // '+2' ou 'F' : la dernière carte du cumul
    deadline: null,
    roundResult: null,
    winners: [],
    log: [],
    seq: 0,
  };
  dealRound(s, ctx);
  return s;
}

// ——— Aides internes (elles modifient la copie de travail) ———

function setDeadline(s, ctx) {
  s.deadline = s.timer ? ctx.now + s.timer * 1000 : null;
}

function note(s, entry) {
  s.seq += 1;
  s.log = [...s.log, { n: s.seq, ...entry }].slice(-LOG_SIZE);
}

function nextSeat(s, from, steps = 1) {
  const n = s.players.length;
  let seat = from;
  for (let k = 0; k < steps; k++) {
    do seat = (seat + s.dir + n) % n; while (s.out.includes(s.players[seat]));
  }
  return seat;
}

function refill(s, ctx) {
  if (s.discard.length <= 1) return;
  const top = s.discard.pop();
  s.draw = shuffle(s.discard, ctx.random);
  s.discard = [top];
}

function drawCards(s, id, count, ctx) {
  let got = 0;
  for (let i = 0; i < count; i++) {
    if (!s.draw.length) refill(s, ctx);
    if (!s.draw.length) break;
    s.hands[id].push(s.draw.pop());
    got += 1;
  }
  if (s.hands[id].length > 2) s.called = s.called.filter((x) => x !== id);
  return got;
}

function endTurn(s, ctx, steps = 1) {
  s.turn = nextSeat(s, s.turn, steps);
  s.phase = 'play';
  s.drawn = null;
  setDeadline(s, ctx);
}

const curId = (s) => s.players[s.turn];

function mustBeActive(s, id) {
  if (!s.players.includes(id) || s.out.includes(id)) throw new Error('Tu ne joues plus dans cette partie.');
}

function mustBeTurn(s, id) {
  mustBeActive(s, id);
  if (s.phase === 'between') throw new Error('La manche est finie : attends la suivante.');
  if (s.phase === 'over') throw new Error('La partie est terminée.');
  if (curId(s) !== id) throw new Error("Ce n'est pas ton tour.");
}

function finishRound(s, winner, ctx) {
  const left = {};
  let gain = 0;
  for (const id of s.players) {
    if (id === winner) continue;
    left[id] = s.hands[id].slice();
    gain += s.hands[id].reduce((sum, c) => sum + points(c), 0);
  }
  s.scores = { ...s.scores, [winner]: (s.scores[winner] || 0) + gain };
  s.roundResult = { winner, gain, left };
  s.pending = null;
  note(s, { k: 'round', by: winner, gain });
  if (s.round >= s.rounds) {
    const best = Math.max(...active(s).map((id) => s.scores[id]));
    let top = active(s).filter((id) => s.scores[id] === best);
    if (top.length > 1 && top.includes(winner)) top = [winner]; // à égalité : celui qui a gagné la dernière manche
    s.winners = top;
    s.phase = 'over';
    s.deadline = null;
  } else {
    s.phase = 'between';
    s.deadline = ctx.now + BETWEEN_MS;
  }
}

function startNextRound(s, ctx) {
  s.round += 1;
  const ids = active(s);
  s.starter = nextSeat({ ...s, dir: 1 }, s.starter, 1);
  if (!ids.includes(s.players[s.starter])) s.starter = s.players.indexOf(ids[0]);
  dealRound(s, ctx);
  note(s, { k: 'deal', round: s.round });
}

// ——— Coups ———

function actPlay(s, id, action, ctx) {
  mustBeTurn(s, id);
  const card = String(action.card || '');
  const hand = s.hands[id];
  if (!hand.includes(card)) throw new Error("Tu n'as pas cette carte.");
  if (s.phase === 'drawn' && card !== s.drawn) {
    throw new Error('Tu peux jouer seulement la carte que tu viens de piocher, ou passer.');
  }
  if (!canPlay(s, card)) throw new Error('Cette carte ne va pas : il faut la même couleur ou la même valeur, ou un joker.');
  let chosen = colorOf(card);
  if (isWild(card)) {
    chosen = String(action.color || '');
    if (!COLORS.includes(chosen)) throw new Error('Choisis la couleur que tu demandes.');
  }
  s.pending = null;
  hand.splice(hand.indexOf(card), 1);
  s.discard.push(card);
  s.color = chosen;
  s.drawn = null;

  const entry = { k: 'play', by: id, card, color: chosen, draw: null, skipped: null, reversed: false };
  let steps = 1;
  const v = valueOf(card);
  if ((v === '+2' || v === 'F') && s.stacking) {
    // Le suivant peut renchérir ou piocher tout le cumul.
    s.stack += v === 'F' ? 4 : 2;
    s.stackKind = v;
    entry.stack = s.stack;
  } else if (v === '+2' || v === 'F') {
    const victim = s.players[nextSeat(s, s.turn, 1)];
    const n = drawCards(s, victim, v === 'F' ? 4 : 2, ctx);
    entry.draw = { to: victim, n };
    steps = 2;
  } else if (v === 'X') {
    entry.skipped = s.players[nextSeat(s, s.turn, 1)];
    steps = 2;
  } else if (v === 'I') {
    s.dir = -s.dir;
    entry.reversed = true;
    if (active(s).length === 2) steps = 2; // à deux, l'inverse fait rejouer
  }
  note(s, entry);

  if (!hand.length) {
    finishRound(s, id, ctx);
    return;
  }
  endTurn(s, ctx, steps);
  if (hand.length === 1 && !s.called.includes(id)) {
    // Il reste une carte et rien n'a été annoncé : tout le monde peut le dénoncer un court instant.
    s.pending = id;
    s.deadline = ctx.now + CALL_WINDOW_MS;
  }
}

// Fin d'un cumul : le joueur pioche tout et passe son tour.
function takeStack(s, id, ctx, kind = 'draw') {
  const n = drawCards(s, id, s.stack, ctx);
  note(s, { k: kind === 'timeout' ? 'timeout' : 'stack', by: id, n });
  s.stack = 0;
  s.stackKind = null;
  endTurn(s, ctx);
}

function actDraw(s, id, ctx) {
  mustBeTurn(s, id);
  if (s.phase !== 'play') throw new Error('Tu as déjà pioché : joue cette carte ou passe.');
  s.pending = null;
  if (s.stack) {
    takeStack(s, id, ctx);
    return;
  }
  const got = drawCards(s, id, 1, ctx);
  note(s, { k: 'draw', by: id, n: got });
  const card = s.hands[id][s.hands[id].length - 1];
  if (got && canPlay(s, card)) {
    s.phase = 'drawn';
    s.drawn = card;
    setDeadline(s, ctx);
  } else {
    endTurn(s, ctx);
  }
}

function actPass(s, id, ctx) {
  mustBeTurn(s, id);
  if (s.phase !== 'drawn') throw new Error("Tu dois d'abord piocher une carte (ou en jouer une).");
  s.pending = null;
  note(s, { k: 'pass', by: id });
  endTurn(s, ctx);
}

function actCall(s, id, ctx) {
  mustBeActive(s, id);
  if (s.phase === 'between' || s.phase === 'over') throw new Error('La manche est finie.');
  const n = s.hands[id].length;
  const myTurn = curId(s) === id;
  if (s.pending === id) {
    s.pending = null;
    s.called.push(id);
    setDeadline(s, ctx);
  } else if (n === 1 || (n === 2 && myTurn)) {
    if (s.called.includes(id)) throw new Error('Tu as déjà annoncé « Dernière ! ».');
    s.called.push(id);
  } else {
    throw new Error('Tu annonces « Dernière ! » quand il te reste une carte, ou deux juste avant de jouer.');
  }
  note(s, { k: 'call', by: id });
}

function actAccuse(s, id, ctx) {
  mustBeActive(s, id);
  if (!s.pending) throw new Error("Personne n'a oublié d'annoncer « Dernière ! » (ou c'est trop tard).");
  if (s.pending === id) throw new Error("C'est toi qui n'as pas annoncé : clique « Dernière ! ».");
  const victim = s.pending;
  s.pending = null;
  const n = drawCards(s, victim, 2, ctx);
  note(s, { k: 'accuse', by: id, target: victim, n });
  setDeadline(s, ctx);
}

export function move(state, playerId, action, ctx) {
  const s = structuredClone(state);
  const a = action || {};
  switch (a.type) {
    case 'play': actPlay(s, playerId, a, ctx); break;
    case 'draw': actDraw(s, playerId, ctx); break;
    case 'pass': actPass(s, playerId, ctx); break;
    case 'call': actCall(s, playerId, ctx); break;
    case 'accuse': actAccuse(s, playerId, ctx); break;
    case 'next':
      mustBeActive(s, playerId);
      if (s.phase !== 'between') throw new Error('Pas de manche à lancer pour le moment.');
      startNextRound(s, ctx);
      break;
    default: throw new Error('Coup inconnu.');
  }
  return { state: s };
}

// Le minuteur est échu : fin de la fenêtre « Dernière ! », manche suivante, ou tour perdu.
export function timeout(state, ctx) {
  const s = structuredClone(state);
  if (s.phase === 'over') return { state: s };
  if (s.phase === 'between') {
    startNextRound(s, ctx);
  } else if (s.pending) {
    s.pending = null; // trop tard pour dénoncer
    setDeadline(s, ctx);
  } else if (s.phase === 'play' && s.stack) {
    takeStack(s, curId(s), ctx, 'timeout');
  } else if (s.phase === 'play') {
    const id = curId(s);
    const got = drawCards(s, id, 1, ctx);
    note(s, { k: 'timeout', by: id, n: got });
    endTurn(s, ctx);
  } else {
    const id = curId(s);
    note(s, { k: 'timeout', by: id, n: 0 });
    endTurn(s, ctx);
  }
  return { state: s };
}

// Abandon : ses cartes retournent sous la pioche et la partie continue ; fin s'il ne reste qu'une personne.
export function leave(state, playerId, ctx) {
  const s = structuredClone(state);
  if (!s.players.includes(playerId) || s.out.includes(playerId) || s.phase === 'over') return { state: s };
  const wasTurn = (s.phase === 'play' || s.phase === 'drawn') && curId(s) === playerId;
  s.draw = [...s.hands[playerId], ...s.draw];
  s.hands[playerId] = [];
  s.called = s.called.filter((x) => x !== playerId);
  if (s.pending === playerId) s.pending = null;
  s.out.push(playerId);
  note(s, { k: 'left', by: playerId });
  const left = active(s);
  if (left.length <= 1) {
    s.phase = 'over';
    s.winners = left;
    s.deadline = null;
    s.pending = null;
    return { state: s };
  }
  if (wasTurn) {
    s.stack = 0; // le cumul part avec le joueur
    s.stackKind = null;
    endTurn(s, ctx);
  }
  return { state: s };
}

// ——— Ce que voit chaque personne ———

export function view(s, playerId) {
  const seated = playerId !== null && s.players.includes(playerId) && !s.out.includes(playerId);
  const hand = seated ? sortHand(s.hands[playerId]) : [];
  const playing = s.phase === 'play' || s.phase === 'drawn';
  const myTurn = seated && playing && curId(s) === playerId;
  const playable = myTurn
    ? [...new Set(hand.filter((c) => (s.phase === 'drawn' ? c === s.drawn : canPlay(s, c))))]
    : [];
  return {
    players: s.players,
    out: s.out,
    counts: Object.fromEntries(s.players.map((id) => [id, s.hands[id].length])),
    hand,
    top: s.discard[s.discard.length - 1],
    color: s.color,
    dir: s.dir,
    drawCount: s.draw.length,
    stack: s.stack || 0,
    stackKind: s.stackKind || null,
    phase: s.phase,
    turn: playing ? curId(s) : null,
    drawn: myTurn ? s.drawn : null,
    playable,
    canDraw: myTurn && s.phase === 'play',
    canPass: myTurn && s.phase === 'drawn',
    canCall: seated && playing && !s.called.includes(playerId)
      && (s.pending === playerId || (myTurn && s.hands[playerId].length === 2)),
    canAccuse: seated && playing && Boolean(s.pending) && s.pending !== playerId,
    pending: s.pending,
    called: s.called,
    scores: s.scores,
    round: s.round,
    rounds: s.rounds,
    timer: s.timer,
    deadline: s.deadline,
    log: s.log,
    roundResult: s.roundResult,
    winners: s.winners,
  };
}

export function status(s) {
  if (s.phase === 'over') return { turn: null, over: true, winners: s.winners, deadline: null };
  const ids = active(s);
  // Entre deux manches, n'importe qui peut lancer la suivante ; pendant la fenêtre « Dernière ! »,
  // tout le monde peut annoncer ou dénoncer. Ce sont des coups libres (may) : seul le joueur courant « a la main ».
  if (s.phase === 'between') return { turn: null, may: ids, over: false, winners: [], deadline: s.deadline };
  const cur = curId(s);
  return { turn: cur, may: s.pending ? ids : [], over: false, winners: [], deadline: s.deadline };
}
