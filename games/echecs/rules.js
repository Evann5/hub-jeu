// Échecs : les règles complètes, pures (ni réseau, ni base, ni affichage).
// Cases : index 0..63, a1 = 0, h1 = 7, a8 = 56, h8 = 63 (rang = index >> 3, colonne = index & 7).
// Pièces : majuscule = blanc, minuscule = noir (P pion, N cavalier, B fou, R tour, Q dame, K roi).
// Couleurs : 0 = blancs (commencent), 1 = noirs. state.players[couleur] = id du joueur.

const FILES = 'abcdefgh';
const START_BOARD = [...'RNBQKBNR', ...'P'.repeat(8), ...Array(32).fill(null), ...'p'.repeat(8), ...'rnbqkbnr'];

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const PROMOS = ['Q', 'R', 'B', 'N'];
const FR_LETTER = { K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C' }; // notation française : Roi, Dame, Tour, Fou, Cavalier

const file = (sq) => sq & 7;
const rank = (sq) => sq >> 3;
const onBoard = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
const colorOf = (piece) => (piece === piece.toUpperCase() ? 0 : 1);
export const squareName = (sq) => FILES[file(sq)] + (rank(sq) + 1);

// ——— Position ———
// pos = { board, turn, castling: 'KQkq' (sous-ensemble), ep: case « en passant » ou null }

function attacked(board, sq, by) {
  const f = file(sq);
  const r = rank(sq);
  const P = by === 0 ? 'P' : 'p';
  const N = by === 0 ? 'N' : 'n';
  const K = by === 0 ? 'K' : 'k';
  const pr = by === 0 ? r - 1 : r + 1; // un pion blanc attaque vers le haut : il est donc un rang plus bas
  for (const df of [-1, 1]) if (onBoard(f + df, pr) && board[pr * 8 + f + df] === P) return true;
  for (const [df, dr] of KNIGHT) if (onBoard(f + df, r + dr) && board[(r + dr) * 8 + f + df] === N) return true;
  for (const [df, dr] of KING) if (onBoard(f + df, r + dr) && board[(r + dr) * 8 + f + df] === K) return true;
  const R = by === 0 ? 'R' : 'r';
  const B = by === 0 ? 'B' : 'b';
  const Q = by === 0 ? 'Q' : 'q';
  for (const [df, dr] of ROOK_DIRS) {
    for (let x = f + df, y = r + dr; onBoard(x, y); x += df, y += dr) {
      const p = board[y * 8 + x];
      if (p) {
        if (p === R || p === Q) return true;
        break;
      }
    }
  }
  for (const [df, dr] of BISHOP_DIRS) {
    for (let x = f + df, y = r + dr; onBoard(x, y); x += df, y += dr) {
      const p = board[y * 8 + x];
      if (p) {
        if (p === B || p === Q) return true;
        break;
      }
    }
  }
  return false;
}

const kingSquare = (board, color) => board.indexOf(color === 0 ? 'K' : 'k');
const inCheck = (pos) => attacked(pos.board, kingSquare(pos.board, pos.turn), 1 - pos.turn);

// Coups « pseudo-légaux » : respectent le déplacement des pièces, mais peuvent laisser le roi en échec.
function pseudoMoves(pos) {
  const { board, turn, castling, ep } = pos;
  const out = [];
  const push = (from, to, extra = {}) => out.push({ from, to, piece: board[from], ...extra });
  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (!piece || colorOf(piece) !== turn) continue;
    const f = file(from);
    const r = rank(from);
    const type = piece.toUpperCase();
    if (type === 'P') {
      const dir = turn === 0 ? 1 : -1;
      const startRank = turn === 0 ? 1 : 6;
      const lastRank = turn === 0 ? 7 : 0;
      const addPawn = (to, extra = {}) => {
        if (rank(to) === lastRank) for (const promo of PROMOS) push(from, to, { ...extra, promo });
        else push(from, to, extra);
      };
      if (onBoard(f, r + dir) && !board[(r + dir) * 8 + f]) {
        addPawn((r + dir) * 8 + f);
        if (r === startRank && !board[(r + 2 * dir) * 8 + f]) push(from, (r + 2 * dir) * 8 + f, { double: true });
      }
      for (const df of [-1, 1]) {
        if (!onBoard(f + df, r + dir)) continue;
        const to = (r + dir) * 8 + f + df;
        if (board[to] && colorOf(board[to]) !== turn) addPawn(to, { capture: board[to] });
        else if (!board[to] && to === ep) push(from, to, { capture: board[to - dir * 8], ep: true });
      }
    } else if (type === 'N' || type === 'K') {
      for (const [df, dr] of type === 'N' ? KNIGHT : KING) {
        if (!onBoard(f + df, r + dr)) continue;
        const to = (r + dr) * 8 + f + df;
        if (!board[to]) push(from, to);
        else if (colorOf(board[to]) !== turn) push(from, to, { capture: board[to] });
      }
    } else {
      const dirs = type === 'R' ? ROOK_DIRS : type === 'B' ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
      for (const [df, dr] of dirs) {
        for (let x = f + df, y = r + dr; onBoard(x, y); x += df, y += dr) {
          const to = y * 8 + x;
          if (!board[to]) push(from, to);
          else {
            if (colorOf(board[to]) !== turn) push(from, to, { capture: board[to] });
            break;
          }
        }
      }
    }
  }
  // Roque : droits conservés, cases libres entre le roi et la tour, roi pas en échec, ne traverse ni n'atteint une case attaquée.
  const home = turn === 0 ? 4 : 60;
  const king = turn === 0 ? 'K' : 'k';
  const rook = turn === 0 ? 'R' : 'r';
  const enemy = 1 - turn;
  if (board[home] === king && !attacked(board, home, enemy)) {
    if (castling.includes(turn === 0 ? 'K' : 'k') && board[home + 3] === rook && !board[home + 1] && !board[home + 2]
      && !attacked(board, home + 1, enemy) && !attacked(board, home + 2, enemy)) {
      push(home, home + 2, { castle: 'K' });
    }
    if (castling.includes(turn === 0 ? 'Q' : 'q') && board[home - 4] === rook && !board[home - 1] && !board[home - 2] && !board[home - 3]
      && !attacked(board, home - 1, enemy) && !attacked(board, home - 2, enemy)) {
      push(home, home - 2, { castle: 'Q' });
    }
  }
  return out;
}

const CASTLE_LOSS = { 0: 'Q', 7: 'K', 56: 'q', 63: 'k' };

// Joue un coup sur une position et renvoie la nouvelle position (sans rien modifier).
export function play(pos, mv) {
  const board = pos.board.slice();
  const piece = board[mv.from];
  board[mv.to] = mv.promo ? (pos.turn === 0 ? mv.promo : mv.promo.toLowerCase()) : piece;
  board[mv.from] = null;
  if (mv.ep) board[mv.to - (pos.turn === 0 ? 8 : -8)] = null;
  if (mv.castle === 'K') {
    board[mv.to - 1] = board[mv.to + 1];
    board[mv.to + 1] = null;
  } else if (mv.castle === 'Q') {
    board[mv.to + 1] = board[mv.to - 2];
    board[mv.to - 2] = null;
  }
  let castling = pos.castling;
  const lose = (letters) => { castling = [...castling].filter((c) => !letters.includes(c)).join(''); };
  if (piece === 'K') lose('KQ');
  if (piece === 'k') lose('kq');
  if (CASTLE_LOSS[mv.from]) lose(CASTLE_LOSS[mv.from]);
  if (CASTLE_LOSS[mv.to]) lose(CASTLE_LOSS[mv.to]);
  return { board, turn: 1 - pos.turn, castling, ep: mv.double ? (mv.from + mv.to) / 2 : null };
}

export function legalMoves(pos) {
  return pseudoMoves(pos).filter((mv) => {
    const next = play(pos, mv);
    return !attacked(next.board, kingSquare(next.board, pos.turn), 1 - pos.turn);
  });
}

// Nombre de positions atteignables en `depth` demi-coups : sert aux tests (valeurs de référence connues).
export function perft(pos, depth) {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  return moves.reduce((n, mv) => n + perft(play(pos, mv), depth - 1), 0);
}

// ——— Fins de partie ———

const squareColor = (sq) => (file(sq) + rank(sq)) % 2;

// Plus aucun mat possible, quoi que jouent les deux camps : roi seul, roi + 1 pièce mineure, fous tous sur la même couleur.
export function insufficientMaterial(board) {
  const rest = [];
  board.forEach((p, sq) => {
    if (p && p.toUpperCase() !== 'K') rest.push([p.toUpperCase(), sq]);
  });
  if (!rest.length) return true;
  if (rest.length === 1) return rest[0][0] === 'N' || rest[0][0] === 'B';
  return rest.every(([t, sq]) => t === 'B' && squareColor(sq) === squareColor(rest[0][1]));
}

// Un camp peut-il encore donner mat ? Sert à la défaite au temps : si l'adversaire ne peut plus mater, c'est nulle.
function canMate(board, color, opponent) {
  const mine = board.filter((p) => p && colorOf(p) === color && p.toUpperCase() !== 'K').map((p) => p.toUpperCase());
  if (mine.some((t) => t === 'P' || t === 'R' || t === 'Q')) return true;
  if (mine.length >= 2) return true;
  if (mine.length === 1) return board.some((p) => p && colorOf(p) === opponent && p.toUpperCase() !== 'K');
  return false;
}

function positionKey(pos, legal) {
  const epUsable = pos.ep !== null && legal.some((m) => m.ep);
  return `${pos.board.map((p) => p || '.').join('')} ${pos.turn} ${pos.castling || '-'} ${epUsable ? pos.ep : '-'}`;
}

// ——— Notation (française : R, D, T, F, C) ———

function notation(pos, mv, legalBefore, nextPos, nextLegal) {
  let text;
  const type = mv.piece.toUpperCase();
  if (mv.castle) text = mv.castle === 'K' ? 'O-O' : 'O-O-O';
  else {
    const capture = mv.capture ? 'x' : '';
    if (type === 'P') {
      text = (mv.capture ? FILES[file(mv.from)] : '') + capture + squareName(mv.to) + (mv.promo ? `=${FR_LETTER[mv.promo]}` : '');
    } else {
      const rivals = legalBefore.filter((m) => m.piece === mv.piece && m.to === mv.to && m.from !== mv.from);
      let from = '';
      if (rivals.length) {
        if (rivals.every((m) => file(m.from) !== file(mv.from))) from = FILES[file(mv.from)];
        else if (rivals.every((m) => rank(m.from) !== rank(mv.from))) from = String(rank(mv.from) + 1);
        else from = squareName(mv.from);
      }
      text = FR_LETTER[type] + from + capture + squareName(mv.to);
    }
  }
  if (inCheck(nextPos)) text += nextLegal.length ? '+' : '#';
  return text;
}

// ——— Le jeu ———

const START_POS = { board: START_BOARD, turn: 0, castling: 'KQkq', ep: null };
const posOf = (s) => ({ board: s.board, turn: s.turn, castling: s.castling, ep: s.ep });

// Construit l'état d'une partie à partir d'une position (FEN) : sert aux tests et à la reprise d'une partie.
export function fromFen(fen, players, options = {}, ctx = { now: 0 }) {
  const [placement, side = 'w', castle = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
  const board = Array(64).fill(null);
  placement.split('/').forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else board[(7 - i) * 8 + f++] = ch;
    }
  });
  const epSq = ep === '-' ? null : FILES.indexOf(ep[0]) + (Number(ep[1]) - 1) * 8;
  return makeState(players, options, ctx, { board, turn: side === 'w' ? 0 : 1, castling: castle === '-' ? '' : castle, ep: epSq }, Number(half), Number(full));
}

function makeState(players, options, ctx, pos, half = 0, full = 1) {
  const minutes = Number(options.clock) || 0;
  const legal = legalMoves(pos);
  return {
    players,
    ...pos,
    half, // demi-coups depuis la dernière prise ou le dernier coup de pion
    full, // numéro du coup
    positions: { [positionKey(pos, legal)]: 1 }, // positions rencontrées depuis la dernière prise ou le dernier coup de pion
    moves: [], // notation de chaque demi-coup
    last: null, // [de, vers]
    clock: minutes ? { ms: [minutes * 60000, minutes * 60000], since: ctx.now } : null, // temps restant à `since`
    offer: null, // couleur qui propose la nulle
    result: null, // { winner: 0 | 1 | null, reason }
  };
}

// players : [{ id, pseudo }] dans l'ordre des places. La couleur est tirée au sort.
export function setup(players, options, ctx) {
  const ids = players.map((p) => p.id);
  const order = ctx.random() < 0.5 ? ids : [ids[1], ids[0]];
  return makeState(order, options || {}, ctx, START_POS);
}

function finish(s, winner, reason) {
  return { ...s, result: { winner, reason }, offer: null };
}

// Un coup : { type: 'move', from, to, promo? }, ou { type: 'draw-offer' | 'draw-accept' | 'draw-decline' }.
export function move(s, playerId, action, ctx) {
  if (s.result) throw new Error('La partie est terminée.');
  const color = s.players.indexOf(playerId);
  if (color < 0) throw new Error('Tu ne joues pas cette partie.');
  if (color !== s.turn) throw new Error("Ce n'est pas ton tour.");
  const type = action?.type;
  if (type === 'draw-offer') {
    if (s.offer === color) throw new Error('Ta proposition de nulle est déjà envoyée.');
    if (s.offer !== null) throw new Error('Ton adversaire te propose la nulle : accepte ou refuse.');
    return { state: { ...s, offer: color } };
  }
  if (type === 'draw-accept') {
    if (s.offer === null || s.offer === color) throw new Error('Personne ne te propose la nulle.');
    return { state: finish(s, null, 'agreement') };
  }
  if (type === 'draw-decline') {
    if (s.offer === null || s.offer === color) throw new Error('Personne ne te propose la nulle.');
    return { state: { ...s, offer: null } };
  }
  if (type !== 'move') throw new Error('Action inconnue.');

  const from = Number(action.from);
  const to = Number(action.to);
  if (![from, to].every((n) => Number.isInteger(n) && n >= 0 && n < 64)) throw new Error('Case inconnue.');

  // Pendule : le temps écoulé depuis le dernier coup est retiré à celui qui joue ; trop tard = défaite au temps.
  let clock = s.clock;
  if (clock) {
    const left = clock.ms[color] - (ctx.now - clock.since);
    if (left <= 0) return { state: timeoutLoss(s) };
    const ms = clock.ms.slice();
    ms[color] = left;
    clock = { ms, since: ctx.now };
  }

  const pos = posOf(s);
  const legal = legalMoves(pos);
  const candidates = legal.filter((m) => m.from === from && m.to === to);
  if (!candidates.length) {
    const piece = s.board[from];
    if (!piece) throw new Error('Il n’y a aucune pièce sur cette case.');
    if (colorOf(piece) !== color) throw new Error('Cette pièce n’est pas à toi.');
    const reachable = pseudoMoves(pos).some((m) => m.from === from && m.to === to);
    throw new Error(reachable ? 'Ce coup laisserait ton roi en échec : choisis-en un autre.' : 'Cette pièce ne peut pas aller là.');
  }
  let mv = candidates[0];
  if (candidates.length > 1) {
    const promo = String(action.promo || '').toUpperCase();
    mv = candidates.find((m) => m.promo === promo);
    if (!mv) throw new Error('Choisis la pièce de promotion : dame, tour, fou ou cavalier.');
  }

  const next = play(pos, mv);
  const nextLegal = legalMoves(next);
  const check = inCheck(next);
  const irreversible = mv.piece.toUpperCase() === 'P' || Boolean(mv.capture);
  const half = irreversible ? 0 : s.half + 1;
  const key = positionKey(next, nextLegal);
  const positions = irreversible ? { [key]: 1 } : { ...s.positions, [key]: (s.positions[key] || 0) + 1 };
  let out = {
    ...s,
    ...next,
    half,
    full: color === 1 ? s.full + 1 : s.full,
    positions,
    moves: [...s.moves, notation(pos, mv, legal, next, nextLegal)],
    last: [mv.from, mv.to],
    clock,
    offer: s.offer === color ? s.offer : null, // un coup de l'adversaire refuse la proposition en cours
  };
  if (!nextLegal.length) out = check ? finish(out, color, 'mate') : finish(out, null, 'stalemate');
  else if (insufficientMaterial(next.board)) out = finish(out, null, 'insufficient');
  else if (positions[key] >= 3) out = finish(out, null, 'repetition');
  else if (half >= 100) out = finish(out, null, 'fifty');
  return { state: out };
}

// Le temps de celui qui joue est écoulé : il perd, sauf si l'autre n'a plus de quoi mater (nulle).
function timeoutLoss(s) {
  const loser = s.turn;
  return canMate(s.board, 1 - loser, loser) ? finish(s, 1 - loser, 'time') : finish(s, null, 'time-insufficient');
}

export function timeout(s) {
  if (s.result || !s.clock) return { state: s };
  return { state: timeoutLoss(s) };
}

// Abandon : l'autre gagne.
export function leave(s, playerId) {
  const color = s.players.indexOf(playerId);
  if (s.result || color < 0) return { state: s };
  return { state: finish(s, 1 - color, 'resign') };
}

export function status(s) {
  const over = Boolean(s.result);
  return {
    turn: over ? null : s.players[s.turn],
    over,
    winners: s.result && s.result.winner !== null ? [s.players[s.result.winner]] : [],
    deadline: !over && s.clock ? s.clock.since + s.clock.ms[s.turn] : null,
  };
}

// Rien n'est caché aux échecs : tout le monde voit la même chose. `you` : ma couleur (null = spectateur).
export function view(s, playerId) {
  const pos = posOf(s);
  const legal = s.result ? [] : legalMoves(pos);
  const targets = {};
  const promos = [];
  for (const m of legal) {
    (targets[m.from] ||= []).push(m.to);
    if (m.promo === 'Q') promos.push(`${m.from}-${m.to}`);
  }
  for (const k of Object.keys(targets)) targets[k] = [...new Set(targets[k])];
  return {
    players: s.players,
    you: playerId === null ? null : s.players.indexOf(playerId),
    board: s.board,
    turn: s.turn,
    legal: targets, // case de départ -> cases d'arrivée
    promos, // « de-vers » des coups qui demandent le choix d'une pièce
    check: !s.result || s.result.reason === 'mate' ? (inCheck(pos) ? kingSquare(s.board, s.turn) : null) : null,
    last: s.last,
    moves: s.moves,
    clock: s.clock,
    offer: s.offer,
    result: s.result,
    half: s.half,
  };
}
