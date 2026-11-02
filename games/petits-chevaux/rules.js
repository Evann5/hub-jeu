// Petits chevaux : les règles, pures (ni réseau, ni base, ni affichage). Dé tiré avec ctx.random, heure avec ctx.now.
//
// Le circuit a 56 cases, numérotées 0 à 55 dans le sens du jeu. Chaque couleur (0 à 3) part de la case 14 × couleur.
// La progression d'un cheval (son « p ») : 0 = à l'écurie, 1 à 56 = sur le circuit (1 = case de départ, 56 = la case juste
// avant son départ, après un tour complet), 57 à 62 = sur l'échelle (62 = arrivé, il faut le compte exact).
// Règles : un 6 pour sortir, un 6 fait rejouer, prise en tombant pile sur un cheval adverse (il retourne à l'écurie),
// on ne peut pas tomber sur un de ses propres chevaux (sauf à l'arrivée), les chevaux sautent par-dessus les autres.
// Quand tous les chevaux restants sont à l'écurie, on a trois essais pour sortir un 6.

export const LAP = 56;
export const TOP = 62;
const SLOTS = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] }; // couleurs prises selon le nombre de joueurs (2 : face à face)

// Case du circuit (0 à 55) où se trouve un cheval de la couleur donnée à la progression p (1 à 56).
export const absOf = (color, p) => (14 * color + p - 1) % LAP;

const activeSeats = (s) => s.players.map((_, seat) => seat).filter((seat) => !s.left.includes(s.players[seat]));

// Essais pour sortir un 6 : trois si aucun cheval n'est sur le circuit ou l'échelle, sinon un.
function triesFor(s, seat) {
  const onTrack = s.pos[seat].some((p) => p > 0 && p < TOP);
  return onTrack ? 1 : 3;
}

// Les coups possibles avec le dé : [{ horse, from, to, capture: { seat, horse } | null }].
export function legalMoves(s) {
  const seat = s.turn;
  const die = s.die;
  const mine = s.pos[seat];
  const color = s.colors[seat];
  const out = [];
  let stableOffered = false;
  mine.forEach((p, horse) => {
    let to;
    if (p === 0) {
      if (die !== 6 || stableOffered) return; // sortir : un 6, et tous les chevaux à l'écurie se valent
      to = 1;
      stableOffered = true;
    } else if (p === TOP) {
      return;
    } else {
      to = p + die;
      if (to > TOP) return; // il faut le compte exact
    }
    if (to < TOP && mine.some((q, other) => other !== horse && q === to)) return; // un de ses chevaux est déjà là
    let capture = null;
    if (to <= LAP) {
      const square = absOf(color, to);
      s.pos.forEach((others, otherSeat) => {
        if (otherSeat === seat) return;
        others.forEach((q, otherHorse) => {
          if (q >= 1 && q <= LAP && absOf(s.colors[otherSeat], q) === square) capture = { seat: otherSeat, horse: otherHorse };
        });
      });
    }
    out.push({ horse, from: p, to, capture });
  });
  return out;
}

function nextSeat(s, from) {
  const n = s.players.length;
  for (let i = 1; i <= n; i++) {
    const seat = (from + i) % n;
    if (!s.left.includes(s.players[seat])) return seat;
  }
  return from;
}

// Donne la main à un joueur : il doit lancer le dé.
function startTurn(s, seat, ctx) {
  return {
    ...s,
    turn: seat,
    phase: 'roll',
    die: null,
    tries: triesFor(s, seat),
    deadline: s.timer ? ctx.now + s.timer * 1000 : null,
  };
}

function applyMove(s, mv, ctx) {
  const seat = s.turn;
  const pos = s.pos.map((row) => row.slice());
  pos[seat][mv.horse] = mv.to;
  if (mv.capture) pos[mv.capture.seat][mv.capture.horse] = 0;
  const last = { seat, die: s.die, horse: mv.horse, from: mv.from, to: mv.to, captured: mv.capture, auto: false };
  let next = { ...s, pos, last };
  if (pos[seat].every((p) => p === TOP)) {
    return { ...next, phase: 'over', die: null, deadline: null, winner: s.players[seat] };
  }
  // Un 6 fait rejouer le même joueur.
  return startTurn(next, s.die === 6 ? seat : nextSeat(next, seat), ctx);
}

// Le joueur a lancé le dé : on regarde ce qu'il peut jouer.
function resolveRoll(s, die, ctx) {
  const rolled = { ...s, die, rolls: s.rolls + 1 };
  const moves = legalMoves(rolled);
  if (moves.length === 1) {
    const done = applyMove(rolled, moves[0], ctx);
    return { ...done, last: { ...done.last, auto: true } };
  }
  if (moves.length > 1) {
    return { ...rolled, phase: 'choose', deadline: s.timer ? ctx.now + s.timer * 1000 : null, last: { seat: s.turn, die, horse: null, from: null, to: null, captured: null, auto: false } };
  }
  // Aucun coup : un 6 fait rejouer quand même ; sinon on retente tant qu'il reste des essais, puis on passe la main.
  const last = { seat: s.turn, die, horse: null, from: null, to: null, captured: null, auto: false };
  if (die === 6) return startTurn({ ...rolled, last }, s.turn, ctx);
  const tries = s.tries - 1;
  if (tries > 0) return { ...rolled, phase: 'roll', die: null, tries, last, deadline: s.timer ? ctx.now + s.timer * 1000 : null };
  return startTurn({ ...rolled, last }, nextSeat(rolled, s.turn), ctx);
}

const rollDie = (ctx) => Math.min(6, 1 + Math.floor(ctx.random() * 6));

// players : [{ id, pseudo }] dans l'ordre des places (2 à 4). Option : timer (secondes par action, 0 = sans).
export function setup(players, options, ctx) {
  const n = Math.min(4, Math.max(2, players.length));
  const s = {
    players: players.map((p) => p.id),
    colors: SLOTS[n].slice(0, players.length),
    pos: players.map(() => [0, 0, 0, 0]),
    left: [],
    timer: Number(options?.timer) || 0,
    turn: 0,
    phase: 'roll', // 'roll' : lancer le dé ; 'choose' : choisir le cheval ; 'over'
    die: null,
    tries: 3,
    deadline: null,
    rolls: 0,
    last: null,
    winner: null,
  };
  return startTurn(s, 0, ctx);
}

// Un coup : { type: 'roll' } ou { type: 'move', horse: 0..3 }.
export function move(s, playerId, action, ctx) {
  if (s.phase === 'over') throw new Error('La partie est terminée.');
  const seat = s.players.indexOf(playerId);
  if (seat < 0 || s.left.includes(playerId)) throw new Error('Tu ne joues plus cette partie.');
  if (seat !== s.turn) throw new Error("Ce n'est pas ton tour.");
  if (action?.type === 'roll') {
    if (s.phase !== 'roll') throw new Error('Le dé est déjà lancé : choisis un cheval.');
    return { state: resolveRoll(s, rollDie(ctx), ctx) };
  }
  if (action?.type === 'move') {
    if (s.phase !== 'choose') throw new Error('Lance d’abord le dé.');
    const horse = Number(action.horse);
    const mv = legalMoves(s).find((m) => m.horse === horse);
    if (!Number.isInteger(horse) || !mv) throw new Error('Ce cheval ne peut pas avancer de ce nombre : choisis-en un autre.');
    return { state: applyMove(s, mv, ctx) };
  }
  throw new Error('Action inconnue.');
}

// Temps écoulé : on lance le dé si besoin et on joue le premier coup possible.
export function timeout(s, ctx) {
  if (s.phase === 'over') return { state: s };
  let t = s;
  if (t.phase === 'roll') {
    t = resolveRoll(t, rollDie(ctx), ctx);
    if (t.phase !== 'choose') return { state: t };
  }
  const first = legalMoves(t)[0];
  const done = applyMove(t, first, ctx);
  return { state: { ...done, last: { ...done.last, auto: true } } };
}

// Abandon : ses chevaux sont retirés, la partie continue. S'il ne reste qu'un joueur, il gagne.
export function leave(s, playerId, ctx) {
  const seat = s.players.indexOf(playerId);
  if (seat < 0 || s.phase === 'over' || s.left.includes(playerId)) return { state: s };
  const left = [...s.left, playerId];
  const pos = s.pos.map((row, i) => (i === seat ? [0, 0, 0, 0] : row));
  const t = { ...s, left, pos };
  const remaining = activeSeats(t);
  if (remaining.length <= 1) {
    return { state: { ...t, phase: 'over', die: null, deadline: null, winner: remaining.length ? t.players[remaining[0]] : null } };
  }
  if (s.turn === seat) return { state: startTurn({ ...t, last: null }, nextSeat(t, seat), ctx) };
  return { state: t };
}

export function status(s) {
  const over = s.phase === 'over';
  return {
    turn: over ? null : s.players[s.turn],
    over,
    winners: s.winner !== null ? [s.winner] : [],
    deadline: over ? null : s.deadline,
  };
}

// Rien n'est caché : tout le monde voit tout. `you` : ma place (null = spectateur).
export function view(s, playerId) {
  const choices = s.phase === 'choose'
    ? legalMoves(s).map(({ horse, from, to, capture }) => ({ horse, from, to, capture }))
    : [];
  return {
    players: s.players,
    colors: s.colors,
    pos: s.pos,
    left: s.left,
    you: playerId === null ? null : s.players.indexOf(playerId),
    turn: s.turn,
    phase: s.phase,
    die: s.die,
    tries: s.tries,
    choices,
    last: s.last,
    rolls: s.rolls,
    timer: s.timer,
    deadline: s.deadline,
    winner: s.winner,
  };
}
