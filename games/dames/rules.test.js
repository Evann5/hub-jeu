// Tests des règles des dames internationales : node --test "games/dames/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, view, status, timeout, leave, legalMoves, QUIET_LIMIT } from './rules.js';

const players = [{ id: 1, pseudo: 'ana' }, { id: 2, pseudo: 'bob' }];
const T0 = 1_000_000;
const ctx = (random = () => 0) => ({ now: T0, random });
const start = (options = {}) => setup(players, options, ctx());
const sq = (r, c) => {
  assert.equal((r + c) % 2, 1, `(${r},${c}) n'est pas une case foncée`);
  return r * 10 + c;
};
const W = 1; // pion blanc
const WK = 2; // dame blanche
const B = -1;
const BK = -2;
// Position à la main : [[ligne, colonne, pièce], …]
const custom = (pieces, turn = 0, options = {}) => {
  const board = Array(100).fill(0);
  for (const [r, c, p] of pieces) board[sq(r, c)] = p;
  return { ...start(options), board, turn };
};
const path = (...cells) => cells.map(([r, c]) => sq(r, c));
const play = (s, id, cells) => move(s, id, { path: cells }, ctx()).state;
const pathsOf = (s) => legalMoves(s.board, s.turn).map((m) => m.path);

test('départ : 20 pièces chacun sur les cases foncées, les blancs ont 9 coups', () => {
  const s = start();
  assert.equal(s.board.filter((p) => p === W).length, 20);
  assert.equal(s.board.filter((p) => p === B).length, 20);
  s.board.forEach((p, i) => { if (p) assert.equal((Math.floor(i / 10) + (i % 10)) % 2, 1); });
  assert.equal(status(s).turn, 1);
  assert.equal(legalMoves(s.board, 0).length, 9);
  assert.equal(view(s, null).moves.length, 9);
});

// Nombre de positions atteintes après n coups depuis le départ : valeurs connues des dames internationales.
test('dénombrement des coups depuis le départ (9, 81, 658, 4265, 27117)', () => {
  const applyMove = (board, m, side) => {
    const b = board.slice();
    const p = b[m.path[0]];
    const end = m.path.at(-1);
    b[m.path[0]] = 0;
    m.taken.forEach((t) => { b[t] = 0; });
    b[end] = Math.abs(p) === 1 && Math.floor(end / 10) === (side === 0 ? 0 : 9) ? p * 2 : p;
    return b;
  };
  const perft = (b, side, d) => (d === 0 ? 1 : legalMoves(b, side).reduce((n, m) => n + perft(applyMove(b, m, side), 1 - side, d - 1), 0));
  [9, 81, 658, 4265, 27117].forEach((expected, i) => assert.equal(perft(start().board, 0, i + 1), expected, `profondeur ${i + 1}`));
});

test("un pion avance d'une case en diagonale, vers l'avant, et le tour passe", () => {
  let s = start();
  s = play(s, 1, path([6, 1], [5, 2]));
  assert.equal(s.board[sq(5, 2)], W);
  assert.equal(s.board[sq(6, 1)], 0);
  assert.equal(status(s).turn, 2);
  assert.deepEqual(s.last, { path: path([6, 1], [5, 2]), taken: [], auto: false, by: 1 });
});

test("l'état reçu n'est jamais modifié", () => {
  const s = start();
  const copy = JSON.stringify(s);
  play(s, 1, path([6, 1], [5, 2]));
  assert.equal(JSON.stringify(s), copy);
});

test('coups refusés : pièce adverse, case vide, pion en arrière, trop loin, case occupée, mauvais tour, entrée absurde', () => {
  const s = start();
  assert.throws(() => move(s, 2, { path: path([3, 0], [4, 1]) }, ctx()), /pas ton tour/);
  assert.throws(() => move(s, 1, { path: path([3, 0], [4, 1]) }, ctx()), /pas à toi/); // pion noir
  assert.throws(() => move(s, 1, { path: path([5, 0], [4, 1]) }, ctx()), /pas à toi/); // case vide
  assert.throws(() => move(s, 1, { path: path([7, 0], [6, 1]) }, ctx()), /impossible/); // case occupée
  assert.throws(() => move(s, 1, { path: path([6, 1], [4, 3]) }, ctx()), /impossible/); // deux cases
  assert.throws(() => move(s, 1, { path: [61] }, ctx()), /incomplet/);
  assert.throws(() => move(s, 1, { path: 'x' }, ctx()), /incomplet/);
  assert.throws(() => move(s, 1, { path: [61, 100] }, ctx()), /incomplet/);
  assert.throws(() => move(s, 1, {}, ctx()), /incomplet/);
  const back = custom([[5, 2, W], [0, 1, B]]);
  assert.throws(() => move(back, 1, { path: path([5, 2], [6, 3]) }, ctx()), /impossible/); // un pion ne recule pas
  // case claire
  assert.throws(() => move(start(), 1, { path: [60, 51] }, ctx()), /pas à toi/);
});

test('un pion prend aussi en arrière', () => {
  const s = custom([[5, 4, W], [6, 5, B], [0, 1, B]]);
  assert.deepEqual(pathsOf(s), [path([5, 4], [7, 6])]);
  const after = play(s, 1, path([5, 4], [7, 6]));
  assert.equal(after.board[sq(6, 5)], 0);
  assert.equal(after.board[sq(7, 6)], W);
  assert.deepEqual(after.last.taken, [sq(6, 5)]);
});

test('la prise est obligatoire : un déplacement simple est refusé', () => {
  const s = custom([[5, 4, W], [4, 3, B], [9, 0, W], [0, 1, B]]);
  assert.deepEqual(pathsOf(s), [path([5, 4], [3, 2])]);
  assert.throws(() => move(s, 1, { path: path([9, 0], [8, 1]) }, ctx()), /Prise obligatoire/);
  assert.throws(() => move(s, 1, { path: path([5, 4], [4, 5]) }, ctx()), /Prise obligatoire|Prise majoritaire/);
});

test('rafle de plusieurs sauts : le coup doit être complet', () => {
  // Le pion saute (4,3) puis (2,3)... : (6,5)->(4,3)->(2,5)? on place deux pions noirs en zigzag.
  const s = custom([[6, 5, W], [5, 4, B], [3, 4, B], [0, 1, B]]);
  assert.deepEqual(pathsOf(s), [path([6, 5], [4, 3], [2, 5])]);
  assert.throws(() => move(s, 1, { path: path([6, 5], [4, 3]) }, ctx()), /pas finie/);
  const after = play(s, 1, path([6, 5], [4, 3], [2, 5]));
  assert.equal(after.board[sq(5, 4)], 0);
  assert.equal(after.board[sq(3, 4)], 0);
  assert.equal(after.board[sq(2, 5)], W);
  assert.deepEqual(after.last.taken, [sq(5, 4), sq(3, 4)]);
});

test('prise majoritaire : on doit prendre le plus de pièces possible', () => {
  // Le pion (6,1) prend 1 pièce, le pion (6,7) en prend 2.
  const s = custom([[6, 1, W], [5, 2, B], [6, 7, W], [5, 6, B], [3, 6, B]]);
  assert.deepEqual(pathsOf(s), [path([6, 7], [4, 5], [2, 7])]);
  assert.throws(() => move(s, 1, { path: path([6, 1], [4, 3]) }, ctx()), /majoritaire/);
  const after = play(s, 1, path([6, 7], [4, 5], [2, 7]));
  assert.deepEqual(after.last.taken.sort(), [sq(3, 6), sq(5, 6)].sort());
});

test('une dame vole : elle prend de loin et atterrit sur n\'importe quelle case libre derrière', () => {
  const s = custom([[9, 0, WK], [6, 3, B], [0, 1, B]]);
  assert.deepEqual(pathsOf(s), [
    path([9, 0], [5, 4]), path([9, 0], [4, 5]), path([9, 0], [3, 6]), path([9, 0], [2, 7]), path([9, 0], [1, 8]), path([9, 0], [0, 9]),
  ]);
  const after = play(s, 1, path([9, 0], [2, 7]));
  assert.equal(after.board[sq(6, 3)], 0);
  assert.equal(after.board[sq(2, 7)], WK);
});

test('dame : la prise majoritaire force la suite, quel que soit le point d\'atterrissage', () => {
  const s = custom([[9, 0, WK], [6, 3, B], [3, 6, B]]);
  const moves = pathsOf(s);
  assert.equal(moves.length, 6); // 2 atterrissages × 3 atterrissages
  assert.ok(moves.every((p) => p.length === 3));
  assert.ok(moves.some((p) => p[1] === sq(5, 4)) && moves.some((p) => p[1] === sq(4, 5)));
  assert.throws(() => move(s, 1, { path: path([9, 0], [5, 4]) }, ctx()), /pas finie/);
  assert.equal(play(s, 1, path([9, 0], [5, 4], [2, 7])).board[sq(2, 7)], WK);
});

test("une dame ne saute ni ses propres pièces, ni deux pièces d'affilée", () => {
  const own = custom([[9, 0, WK], [6, 3, W], [0, 1, B]]);
  assert.ok(pathsOf(own).every((p) => p[0] !== sq(9, 0) || p[1] === sq(8, 1) || p[1] === sq(7, 2)));
  const two = custom([[9, 0, WK], [6, 3, B], [5, 4, B], [0, 1, B]]);
  assert.ok(!pathsOf(two).some((p) => p.length === 2 && p[1] === sq(4, 5)));
  assert.ok(legalMoves(two.board, 0).every((m) => m.taken.length === 0));
});

test('une pièce déjà prise reste sur le plateau jusqu\'à la fin de la rafle : on ne la saute pas deux fois', () => {
  // Dame blanche en (9,0) : prend (6,3), atterrit (5,4) ou (4,5) ; le chemin retour passe par la pièce prise, donc bloqué.
  const s = custom([[9, 0, WK], [6, 3, B], [0, 1, B]]);
  assert.ok(legalMoves(s.board, 0).every((m) => m.taken.length === 1));
});

test('le pion qui finit sa rafle sur la dernière ligne devient dame ; en passant seulement, non', () => {
  const end = custom([[2, 1, W], [1, 2, B], [9, 8, B]]);
  assert.deepEqual(pathsOf(end), [path([2, 1], [0, 3])]);
  assert.equal(play(end, 1, path([2, 1], [0, 3])).board[sq(0, 3)], WK);
  // Passe par la ligne 0 puis reprend en arrière : il reste un pion.
  const through = custom([[2, 1, W], [1, 2, B], [1, 4, B]]);
  assert.deepEqual(pathsOf(through), [path([2, 1], [0, 3], [2, 5])]);
  const after = play(through, 1, path([2, 1], [0, 3], [2, 5]));
  assert.equal(after.board[sq(2, 5)], W);
});

test('un pion qui avance jusqu\'à la dernière ligne devient dame (blancs et noirs)', () => {
  const white = custom([[1, 2, W], [9, 8, B]]);
  assert.equal(play(white, 1, path([1, 2], [0, 1])).board[sq(0, 1)], WK);
  const black = custom([[8, 1, B], [0, 3, W]], 1);
  assert.equal(play(black, 2, path([8, 1], [9, 0])).board[sq(9, 0)], BK);
});

test("la victoire : l'adversaire n'a plus de pièce, ou ne peut plus bouger", () => {
  const wipe = custom([[5, 4, W], [4, 3, B]]);
  const won = play(wipe, 1, path([5, 4], [3, 2]));
  assert.deepEqual(status(won), { turn: null, over: true, winners: [1], deadline: null });
  assert.throws(() => move(won, 2, { path: path([0, 1], [1, 2]) }, ctx()), /terminée/);
  assert.deepEqual(view(won).moves, []);

  // Le pion noir en (0,1) est bloqué par trois pions blancs ; les blancs jouent un autre pion.
  const blocked = custom([[0, 1, B], [1, 0, W], [1, 2, W], [2, 3, W], [6, 1, W]]);
  assert.deepEqual(legalMoves(blocked.board, 1), []);
  const after = play(blocked, 1, path([6, 1], [5, 0]));
  assert.deepEqual(status(after).winners, [1]);
});

test('nulle : 25 coups de dame par joueur sans prise ni mouvement de pion', () => {
  assert.equal(QUIET_LIMIT, 50);
  let s = custom([[9, 2, WK], [0, 1, BK]]);
  const whiteCycle = [path([9, 2], [8, 3]), path([8, 3], [9, 2])];
  const blackCycle = [path([0, 1], [1, 0]), path([1, 0], [0, 1])];
  for (let ply = 0; ply < QUIET_LIMIT; ply++) {
    assert.equal(status(s).over, false, `pas finie au coup ${ply}`);
    const white = ply % 2 === 0;
    s = play(s, white ? 1 : 2, (white ? whiteCycle : blackCycle)[Math.floor(ply / 2) % 2]);
  }
  assert.equal(s.quiet, 50);
  assert.equal(s.draw, true);
  assert.deepEqual(status(s), { turn: null, over: true, winners: [], deadline: null });
});

test('le compteur de nulle repart à zéro après un mouvement de pion ou une prise', () => {
  const base = custom([[9, 2, WK], [0, 1, BK], [6, 1, W], [3, 2, B]]);
  assert.equal(play({ ...base, quiet: 20 }, 1, path([6, 1], [5, 0])).quiet, 0);
  assert.equal(play({ ...base, quiet: 20 }, 1, path([9, 2], [8, 3])).quiet, 21);
  const capture = custom([[9, 2, WK], [6, 5, B], [0, 1, BK]]);
  const taken = legalMoves(capture.board, 0).find((m) => m.taken.length === 1);
  assert.equal(play({ ...capture, quiet: 20 }, 1, taken.path).quiet, 0);
});

test("l'abandon donne la victoire à l'autre, même hors de son tour", () => {
  const after = leave(start(), 2).state;
  assert.deepEqual(status(after), { turn: null, over: true, winners: [1], deadline: null });
  assert.deepEqual(leave(after, 1).state, after);
});

test('minuteur : échéance au lancement et après chaque coup, aucune sans option', () => {
  let s = start({ timer: 120 });
  assert.equal(status(s).deadline, T0 + 120_000);
  s = move(s, 1, { path: path([6, 1], [5, 2]) }, { now: T0 + 7000, random: () => 0 }).state;
  assert.equal(status(s).deadline, T0 + 127_000);
  assert.equal(status(start()).deadline, null);
});

test('timeout : joue un coup légal choisi par ctx.random (une prise s\'il y en a une)', () => {
  const s = start({ timer: 30 });
  const all = pathsOf(s);
  const first = timeout(s, ctx(() => 0)).state;
  assert.deepEqual(first.last.path, all[0]);
  assert.equal(first.last.auto, true);
  assert.deepEqual(timeout(s, ctx(() => 0.999)).state.last.path, all[all.length - 1]);
  assert.equal(status(first).turn, 2);

  const forced = custom([[6, 5, W], [5, 4, B], [3, 4, B], [9, 0, W]], 0, { timer: 30 });
  assert.deepEqual(timeout(forced, ctx(() => 0.5)).state.last.path, path([6, 5], [4, 3], [2, 5]));
});

test('timeout après la fin ne change rien', () => {
  const s = leave(start({ timer: 30 }), 1).state;
  assert.deepEqual(timeout(s, ctx()).state, s);
});

test('parties jouées au hasard : tous les coups proposés sont acceptés, plateau toujours valide', () => {
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let finished = 0;
  for (let g = 0; g < 25; g++) {
    let s = start();
    for (let ply = 0; ply < 300 && !status(s).over; ply++) {
      const moves = view(s).moves;
      assert.ok(moves.length > 0);
      const m = moves[Math.floor(rnd() * moves.length)];
      s = move(s, s.players[s.turn], { path: m.path }, ctx()).state;
      s.board.forEach((p, i) => { if (p) assert.equal((Math.floor(i / 10) + (i % 10)) % 2, 1); });
      assert.ok(s.board.filter((p) => p > 0).length <= 20 && s.board.filter((p) => p < 0).length <= 20);
    }
    if (status(s).over) finished++;
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  }
  assert.ok(finished > 0, 'au moins une partie aléatoire se termine');
});
