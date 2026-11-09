// « Retourne » : les règles du Reversi sur un plateau de 8 × 8.
// Règles pures (ni réseau, ni base, ni Date.now()) : l'heure et le hasard arrivent par ctx = { now, random }.

export const SIZE = 8;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

// players : [{ id, pseudo }] dans l'ordre des places. La place 0 joue les noirs et commence ; la place 1 joue les blancs.
// La case (ligne r, colonne c) est à l'index r * 8 + c ; la ligne 0 est en haut.
export function setup(players, options, ctx) {
  const board = Array(SIZE * SIZE).fill(null); // null, 0 (noir) ou 1 (blanc)
  board[3 * SIZE + 3] = 1;
  board[4 * SIZE + 4] = 1;
  board[3 * SIZE + 4] = 0;
  board[4 * SIZE + 3] = 0;
  const timer = Number(options?.timer) > 0 ? Number(options.timer) : 0;
  return {
    players: players.map((p) => p.id),
    board,
    turn: 0,
    timer, // secondes par coup, 0 = sans minuteur
    deadline: timer ? ctx.now + timer * 1000 : null,
    last: null, // { cell, flipped, auto, by } : dernier pion posé, pions retournés, joué au hasard par le minuteur, id de qui l'a posé
    passed: null, // id du joueur qui vient de passer son tour (aucun coup possible)
    over: false,
    winner: null, // id du gagnant (null si nul)
    draw: false,
    forfeit: null, // id de qui a abandonné
  };
}

// Pions retournés si `color` pose un pion en `cell` (liste vide : coup illégal).
export function flipsFor(board, cell, color) {
  if (board[cell] !== null) return [];
  const r0 = Math.floor(cell / SIZE);
  const c0 = cell % SIZE;
  const flips = [];
  for (const [dr, dc] of DIRS) {
    const run = [];
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] === 1 - color) {
      run.push(r * SIZE + c);
      r += dr;
      c += dc;
    }
    if (run.length && r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] === color) flips.push(...run);
  }
  return flips;
}

// Cases où `color` peut jouer.
export function legalCells(board, color) {
  const cells = [];
  for (let i = 0; i < board.length; i++) if (flipsFor(board, i, color).length) cells.push(i);
  return cells;
}

export function counts(board) {
  return [board.filter((v) => v === 0).length, board.filter((v) => v === 1).length];
}

// Pose le pion, retourne, puis décide qui joue : l'adversaire, ou encore soi s'il doit passer, ou personne si la partie est finie.
function place(state, cell, ctx, auto) {
  const color = state.turn;
  const flipped = flipsFor(state.board, cell, color);
  const board = state.board.slice();
  board[cell] = color;
  for (const i of flipped) board[i] = color;

  let turn = 1 - color;
  let passed = null;
  let over = false;
  if (!legalCells(board, turn).length) {
    if (legalCells(board, color).length) {
      passed = state.players[turn];
      turn = color;
    } else {
      over = true;
    }
  }
  const next = { ...state, board, turn, passed, last: { cell, flipped, auto, by: state.players[color] }, over, deadline: over || !state.timer ? null : ctx.now + state.timer * 1000 };
  if (over) {
    const [black, white] = counts(board);
    next.draw = black === white;
    next.winner = black === white ? null : state.players[black > white ? 0 : 1];
  }
  return { state: next };
}

const isOver = (s) => Boolean(s.over || s.forfeit);

// Un coup : { cell: 0..63 }. Renvoie { state } ou lève une Error en français.
export function move(state, playerId, action, ctx) {
  if (isOver(state)) throw new Error('La partie est terminée.');
  if (state.players[state.turn] !== playerId) throw new Error("Ce n’est pas ton tour.");
  const cell = Number(action?.cell);
  if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE) throw new Error('Case inconnue.');
  if (state.board[cell] !== null) throw new Error('Cette case est déjà occupée : choisis une case marquée d’un point.');
  if (!flipsFor(state.board, cell, state.turn).length) throw new Error('Ce coup ne retourne aucun pion : choisis une case marquée d’un point.');
  return place(state, cell, ctx, false);
}

// Rien n'est caché. On ajoute les coups possibles pour le joueur dont c'est le tour et le décompte des pions.
export function view(state) {
  return {
    ...state,
    counts: counts(state.board),
    legal: isOver(state) ? [] : legalCells(state.board, state.turn),
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
  const cells = legalCells(state.board, state.turn);
  const cell = cells[Math.min(cells.length - 1, Math.floor(ctx.random() * cells.length))];
  return place(state, cell, ctx, true);
}

// Abandon : l'autre joueur gagne.
export function leave(state, playerId) {
  if (isOver(state) || !state.players.includes(playerId)) return { state };
  const other = state.players.find((id) => id !== playerId);
  return { state: { ...state, forfeit: playerId, winner: other, deadline: null } };
}
