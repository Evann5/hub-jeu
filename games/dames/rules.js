// Dames internationales 10 × 10. Règles pures (ni réseau, ni base, ni Date.now()) : l'heure et le hasard arrivent par ctx = { now, random }.
//
// Plateau : index = ligne * 10 + colonne, ligne 0 en haut. Les pièces sont sur les cases foncées : (ligne + colonne) impair.
// Contenu d'une case : 0 vide, 1 pion blanc, 2 dame blanche, -1 pion noir, -2 dame noire.
// Place 0 = blancs (en bas, montent, commencent) ; place 1 = noirs (en haut, descendent).
//
// Un coup est une rafle complète, donnée comme la liste des cases : [départ, arrivée] pour un déplacement, [départ, 1re arrivée, 2e arrivée…]
// pour une prise (une arrivée par saut). Les pièces prises sont celles qui se trouvent sur chaque segment.

export const SIZE = 10;
export const QUIET_LIMIT = 50; // coups de dame de suite (25 par joueur), sans prise ni mouvement de pion, avant la nulle
const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

const sideOf = (piece) => (piece > 0 ? 0 : 1);
const isKing = (piece) => Math.abs(piece) === 2;
const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

// players : [{ id, pseudo }] dans l'ordre des places.
export function setup(players, options, ctx) {
  const board = Array(SIZE * SIZE).fill(0);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 0) continue;
      if (r < 4) board[r * SIZE + c] = -1;
      else if (r > 5) board[r * SIZE + c] = 1;
    }
  }
  const timer = Number(options?.timer) > 0 ? Number(options.timer) : 0;
  return {
    players: players.map((p) => p.id),
    board,
    turn: 0,
    quiet: 0, // coups de dame d'affilée sans prise ni pion
    timer, // secondes par coup, 0 = sans minuteur
    deadline: timer ? ctx.now + timer * 1000 : null,
    last: null, // { path, taken, auto, by } : dernier coup, pièces prises, joué au hasard par le minuteur, id de qui l'a joué
    winner: null, // id du gagnant
    draw: false,
    forfeit: null, // id de qui a abandonné
  };
}

// Toutes les rafles possibles à partir de `from` : [{ path, taken }] (sans le filtre « prise majoritaire »).
function capturesFrom(board, from, side) {
  const lifted = board.slice();
  const piece = lifted[from];
  lifted[from] = 0; // la pièce qui joue quitte sa case : elle peut repasser dessus
  const king = isKing(piece);
  const out = [];

  const walk = (pos, path, taken) => {
    const r0 = Math.floor(pos / SIZE);
    const c0 = pos % SIZE;
    let extended = false;
    for (const [dr, dc] of DIRS) {
      let r = r0 + dr;
      let c = c0 + dc;
      if (king) while (inside(r, c) && lifted[r * SIZE + c] === 0) { r += dr; c += dc; }
      if (!inside(r, c)) continue;
      const victim = r * SIZE + c;
      const v = lifted[victim];
      // On saute une pièce adverse pas encore prise (celles déjà prises restent sur le plateau jusqu'à la fin de la rafle et font obstacle).
      if (v === 0 || sideOf(v) === side || taken.includes(victim)) continue;
      let lr = r + dr;
      let lc = c + dc;
      while (inside(lr, lc) && lifted[lr * SIZE + lc] === 0) {
        extended = true;
        walk(lr * SIZE + lc, [...path, lr * SIZE + lc], [...taken, victim]);
        if (!king) break; // un pion atterrit juste derrière
        lr += dr;
        lc += dc;
      }
    }
    if (!extended && taken.length) out.push({ path, taken });
  };
  walk(from, [from], []);
  return out;
}

// Déplacements simples (sans prise) d'une pièce.
function stepsFrom(board, from) {
  const piece = board[from];
  const king = isKing(piece);
  const fwd = piece > 0 ? -1 : 1;
  const r0 = Math.floor(from / SIZE);
  const c0 = from % SIZE;
  const out = [];
  for (const [dr, dc] of DIRS) {
    if (!king && dr !== fwd) continue;
    let r = r0 + dr;
    let c = c0 + dc;
    while (inside(r, c) && board[r * SIZE + c] === 0) {
      out.push({ path: [from, r * SIZE + c], taken: [] });
      if (!king) break;
      r += dr;
      c += dc;
    }
  }
  return out;
}

// Toutes les rafles de `side`, même celles qui ne prennent pas le maximum (pour expliquer un refus).
function allCaptures(board, side) {
  const out = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== 0 && sideOf(board[i]) === side) out.push(...capturesFrom(board, i, side));
  }
  return out;
}

// Tous les coups légaux de `side` : si une prise existe, il faut prendre, et le plus de pièces possible (une dame compte pour une pièce).
export function legalMoves(board, side) {
  const captures = allCaptures(board, side);
  if (captures.length) {
    const most = Math.max(...captures.map((m) => m.taken.length));
    return captures.filter((m) => m.taken.length === most);
  }
  const steps = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== 0 && sideOf(board[i]) === side) steps.push(...stepsFrom(board, i));
  }
  return steps;
}

const samePath = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// Joue le coup `m` (un élément de legalMoves) et renvoie le nouvel état.
function apply(state, m, ctx, auto) {
  const side = state.turn;
  const board = state.board.slice();
  const piece = board[m.path[0]];
  const end = m.path[m.path.length - 1];
  board[m.path[0]] = 0;
  for (const t of m.taken) board[t] = 0;
  // Un pion ne devient dame que s'il finit sa rafle sur la dernière ligne.
  const promoted = !isKing(piece) && Math.floor(end / SIZE) === (side === 0 ? 0 : SIZE - 1);
  board[end] = promoted ? piece * 2 : piece;
  const quiet = isKing(piece) && !m.taken.length ? state.quiet + 1 : 0;

  const next = {
    ...state,
    board,
    quiet,
    turn: 1 - side,
    last: { path: m.path, taken: m.taken, auto, by: state.players[side] },
  };
  if (!legalMoves(board, 1 - side).length) next.winner = state.players[side]; // l'adversaire ne peut plus jouer (plus de pièces ou bloqué)
  else if (quiet >= QUIET_LIMIT) next.draw = true;
  const over = Boolean(next.winner || next.draw);
  next.deadline = over || !state.timer ? null : ctx.now + state.timer * 1000;
  return { state: next };
}

const isOver = (s) => Boolean(s.winner || s.draw || s.forfeit);

// Un coup : { path: [cases] }. Renvoie { state } ou lève une Error en français qui dit quoi faire.
export function move(state, playerId, action, ctx) {
  if (isOver(state)) throw new Error('La partie est terminée.');
  if (state.players[state.turn] !== playerId) throw new Error("Ce n’est pas ton tour.");
  const path = action?.path;
  if (!Array.isArray(path) || path.length < 2 || path.length > 41 || !path.every((n) => Number.isInteger(n) && n >= 0 && n < SIZE * SIZE)) {
    throw new Error('Coup incomplet : choisis une pièce puis sa case d’arrivée.');
  }
  const piece = state.board[path[0]];
  if (piece === 0 || sideOf(piece) !== state.turn) throw new Error("Cette pièce n’est pas à toi : joue une de tes pièces.");
  const moves = legalMoves(state.board, state.turn);
  const found = moves.find((m) => samePath(m.path, path));
  if (found) return apply(state, found, ctx, false);

  const mustTake = moves.length && moves[0].taken.length;
  if (mustTake) {
    const n = moves[0].taken.length;
    if (moves.some((m) => m.path.length > path.length && samePath(m.path.slice(0, path.length), path))) {
      throw new Error('Ta prise n’est pas finie : continue de sauter par-dessus les pièces adverses.');
    }
    if (allCaptures(state.board, state.turn).some((m) => samePath(m.path, path))) {
      throw new Error(`Prise majoritaire : tu dois prendre le plus de pièces possible (${n} ici).`);
    }
    throw new Error(`Prise obligatoire : tu dois prendre${n > 1 ? ` au moins ${n} pièces` : ''} avec une pièce qui peut sauter.`);
  }
  throw new Error('Coup impossible : un pion avance d’une case en diagonale, une dame glisse sur la diagonale.');
}

// Tout est public aux dames. On ajoute les coups possibles du joueur dont c'est le tour pour que le client les surligne.
export function view(state) {
  return {
    ...state,
    moves: isOver(state) ? [] : legalMoves(state.board, state.turn),
  };
}

export function status(state) {
  const over = isOver(state);
  return {
    turn: over ? null : state.players[state.turn],
    over,
    winners: state.winner ? [state.winner] : [],
    deadline: over ? null : state.deadline,
  };
}

// Minuteur échu : un coup légal tiré au hasard.
export function timeout(state, ctx) {
  if (isOver(state)) return { state };
  const moves = legalMoves(state.board, state.turn);
  const m = moves[Math.min(moves.length - 1, Math.floor(ctx.random() * moves.length))];
  return apply(state, m, ctx, true);
}

// Abandon : l'autre joueur gagne.
export function leave(state, playerId) {
  if (isOver(state) || !state.players.includes(playerId)) return { state };
  const other = state.players.find((id) => id !== playerId);
  return { state: { ...state, forfeit: playerId, winner: other, deadline: null } };
}
