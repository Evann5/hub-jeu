// Morpion : le jeu d'exemple du hub. Les règles sont pures : pas de réseau, pas de base, pas d'affichage.
// Le hub appelle setup() au lancement, move() à chaque coup, view() pour chaque personne et status() après chaque changement.

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // lignes
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // colonnes
  [0, 4, 8], [2, 4, 6], // diagonales
];

// players : [{ id, pseudo }] dans l'ordre des places. Le premier joue les croix et commence.
export function setup(players) {
  return {
    players: players.map((p) => p.id),
    board: Array(9).fill(null), // null, 0 (croix) ou 1 (rond)
    turn: 0,
    line: null, // les trois cases gagnantes
    winner: null, // id du gagnant
    draw: false,
    forfeit: null, // id de qui a abandonné
  };
}

// Un coup : { cell: 0..8 }. On renvoie un nouvel état, ou on lève une Error avec un message pour le joueur.
export function move(state, playerId, { cell }) {
  // Le hub filtre déjà par `turn`, mais les règles refusent seules un coup hors tour ou après la fin.
  if (state.winner !== null || state.draw || state.forfeit !== null) throw new Error('La partie est terminée.');
  if (state.players[state.turn] !== playerId) throw new Error("Ce n'est pas ton tour.");
  const i = Number(cell);
  if (!Number.isInteger(i) || i < 0 || i > 8) throw new Error('Case inconnue.');
  if (state.board[i] !== null) throw new Error('Cette case est déjà prise.');
  const board = state.board.slice();
  board[i] = state.turn;
  const line = LINES.find((l) => l.every((c) => board[c] === state.turn)) || null;
  const draw = !line && board.every((c) => c !== null);
  return {
    state: {
      ...state,
      board,
      line,
      draw,
      winner: line ? playerId : null,
      turn: line || draw ? state.turn : 1 - state.turn,
    },
  };
}

// Rien n'est caché au morpion : tout le monde (spectateurs compris) voit la même chose.
export function view(state) {
  return state;
}

export function status(state) {
  const over = Boolean(state.winner || state.draw || state.forfeit);
  return {
    turn: over ? null : state.players[state.turn],
    over,
    winners: state.winner ? [state.winner] : [],
  };
}

// Abandon : l'autre joueur gagne.
export function leave(state, playerId) {
  const other = state.players.find((id) => id !== playerId);
  return { state: { ...state, forfeit: playerId, winner: other } };
}
