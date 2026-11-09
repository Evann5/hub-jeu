// Quatre à la suite : grille 7 colonnes × 6 lignes, quatre jetons alignés gagnent.
// Règles pures (ni réseau, ni base, ni Date.now()) : l'heure et le hasard arrivent par ctx = { now, random }.

export const COLS = 7;
export const ROWS = 6;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]]; // droite, bas, diagonale descendante, diagonale montante

// players : [{ id, pseudo }] dans l'ordre des places. La place 0 (rouge) commence.
// La case (ligne r, colonne c) est à l'index r * 7 + c ; la ligne 0 est tout en haut.
export function setup(players, options, ctx) {
  const timer = Number(options?.timer) > 0 ? Number(options.timer) : 0;
  return {
    players: players.map((p) => p.id),
    board: Array(COLS * ROWS).fill(null), // null, 0 (place 0) ou 1 (place 1)
    turn: 0,
    timer, // secondes par coup, 0 = sans minuteur
    deadline: timer ? ctx.now + timer * 1000 : null,
    last: null, // { cell, auto } : dernier jeton posé (auto = joué au hasard par le minuteur)
    line: null, // les cases gagnantes
    winner: null, // id du gagnant
    draw: false,
    forfeit: null, // id de qui a abandonné
  };
}

// Colonnes où il reste de la place.
export function openColumns(board) {
  const cols = [];
  for (let c = 0; c < COLS; c++) if (board[c] === null) cols.push(c);
  return cols;
}

// Toute la série de jetons de la même couleur qui passe par `cell`, ou null si elle fait moins de 4.
function winningLine(board, cell, color) {
  const r0 = Math.floor(cell / COLS);
  const c0 = cell % COLS;
  for (const [dr, dc] of DIRS) {
    const run = [cell];
    for (const sign of [1, -1]) {
      let r = r0 + dr * sign;
      let c = c0 + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r * COLS + c] === color) {
        run.push(r * COLS + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (run.length >= 4) return run.sort((a, b) => a - b);
  }
  return null;
}

function drop(state, col, ctx, auto) {
  const board = state.board.slice();
  let row = ROWS - 1;
  while (row >= 0 && board[row * COLS + col] !== null) row--;
  const cell = row * COLS + col;
  board[cell] = state.turn;
  const line = winningLine(board, cell, state.turn);
  const draw = !line && board.every((v) => v !== null);
  const over = Boolean(line || draw);
  const turn = over ? state.turn : 1 - state.turn;
  return {
    state: {
      ...state,
      board,
      line,
      draw,
      winner: line ? state.players[state.turn] : null,
      turn,
      last: { cell, auto },
      deadline: !over && state.timer ? ctx.now + state.timer * 1000 : null,
    },
  };
}

const isOver = (s) => Boolean(s.winner || s.draw || s.forfeit);

// Un coup : { col: 0..6 }. Renvoie { state } ou lève une Error en français.
export function move(state, playerId, action, ctx) {
  if (isOver(state)) throw new Error('La partie est terminée.');
  if (state.players[state.turn] !== playerId) throw new Error('Ce n’est pas ton tour.');
  const col = Number(action?.col);
  if (!Number.isInteger(col) || col < 0 || col >= COLS) throw new Error('Colonne inconnue : choisis une colonne de 1 à 7.');
  if (state.board[col] !== null) throw new Error('Cette colonne est pleine : choisis-en une autre.');
  return drop(state, col, ctx, false);
}

// Rien n'est caché : tout le monde (spectateurs compris) voit la même grille.
export function view(state) {
  return state;
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

// Minuteur échu : un jeton tombe dans une colonne libre tirée au hasard.
export function timeout(state, ctx) {
  if (isOver(state)) return { state };
  const cols = openColumns(state.board);
  const col = cols[Math.min(cols.length - 1, Math.floor(ctx.random() * cols.length))];
  return drop(state, col, ctx, true);
}

// Abandon : l'autre joueur gagne.
export function leave(state, playerId) {
  if (isOver(state) || !state.players.includes(playerId)) return { state };
  const other = state.players.find((id) => id !== playerId);
  return { state: { ...state, forfeit: playerId, winner: other, deadline: null } };
}
