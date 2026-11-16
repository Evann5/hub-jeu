// Tests des règles de « Reversi » : node --test "games/reversi/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, view, status, timeout, leave, legalCells, flipsFor, counts } from './rules.js';

const players = [{ id: 1, pseudo: 'ana' }, { id: 2, pseudo: 'bob' }];
const T0 = 1_000_000;
const ctx = (random = () => 0) => ({ now: T0, random });
const start = (options = {}) => setup(players, options, ctx());
const at = (r, c) => r * 8 + c;
const play = (s, id, cell) => move(s, id, { cell }, ctx()).state;
// Plateau à la main : { noirs: [[r,c]…], blancs: [[r,c]…] }
const custom = ({ black = [], white = [] }, turn = 0, options = {}) => {
  const board = Array(64).fill(null);
  black.forEach(([r, c]) => { board[at(r, c)] = 0; });
  white.forEach(([r, c]) => { board[at(r, c)] = 1; });
  return { ...start(options), board, turn };
};

test('départ : 4 pions au centre, les noirs ont 4 coups', () => {
  const s = start();
  assert.deepEqual(counts(s.board), [2, 2]);
  assert.equal(status(s).turn, 1);
  assert.deepEqual(legalCells(s.board, 0), [at(2, 3), at(3, 2), at(4, 5), at(5, 4)]);
  assert.deepEqual(view(s, null).legal, [at(2, 3), at(3, 2), at(4, 5), at(5, 4)]);
});

test('un coup légal retourne le pion encadré et passe la main', () => {
  let s = start();
  s = play(s, 1, at(2, 3));
  assert.equal(s.board[at(2, 3)], 0);
  assert.equal(s.board[at(3, 3)], 0); // retourné
  assert.deepEqual(counts(s.board), [4, 1]);
  assert.deepEqual(s.last, { cell: at(2, 3), flipped: [at(3, 3)], auto: false, by: 1 });
  assert.equal(status(s).turn, 2);
});

test("l'état reçu n'est jamais modifié", () => {
  const s = start();
  const copy = JSON.stringify(s);
  play(s, 1, at(2, 3));
  assert.equal(JSON.stringify(s), copy);
});

test('coups refusés : case occupée, sans retournement, hors plateau, mauvais tour', () => {
  const s = start();
  assert.throws(() => move(s, 1, { cell: at(3, 3) }, ctx()), /déjà occupée/);
  assert.throws(() => move(s, 1, { cell: at(0, 0) }, ctx()), /aucun pion/);
  assert.throws(() => move(s, 1, { cell: 64 }, ctx()), /inconnue/);
  assert.throws(() => move(s, 1, { cell: -1 }, ctx()), /inconnue/);
  assert.throws(() => move(s, 1, { cell: 'a' }, ctx()), /inconnue/);
  assert.throws(() => move(s, 1, {}, ctx()), /inconnue/);
  assert.throws(() => move(s, 2, { cell: at(2, 3) }, ctx()), /pas ton tour/);
});

test('retournement dans plusieurs directions à la fois', () => {
  // Noir joue (3,3) : flanque (3,4) vers l'est, (4,3) vers le sud et (4,4) en diagonale.
  const s = custom({ black: [[3, 5], [5, 3], [5, 5]], white: [[3, 4], [4, 3], [4, 4]] });
  assert.deepEqual(flipsFor(s.board, at(3, 3), 0).sort((a, b) => a - b), [at(3, 4), at(4, 3), at(4, 4)]);
  const after = play(s, 1, at(3, 3));
  assert.deepEqual(counts(after.board), [7, 0]);
});

test('plusieurs pions alignés se retournent, mais un trou arrête le retournement', () => {
  const s = custom({ black: [[0, 4]], white: [[0, 1], [0, 2], [0, 3]] });
  assert.deepEqual(flipsFor(s.board, at(0, 0), 0), [at(0, 1), at(0, 2), at(0, 3)]);
  const gap = custom({ black: [[0, 4]], white: [[0, 1], [0, 3]] });
  assert.deepEqual(flipsFor(gap.board, at(0, 0), 0), []);
});

test('un alignement qui sort du plateau sans pion à soi ne retourne rien', () => {
  const s = custom({ black: [[7, 7]], white: [[0, 1], [0, 2]] });
  assert.deepEqual(flipsFor(s.board, at(0, 0), 0), []);
});

test("si l'adversaire n'a aucun coup, il passe automatiquement et on rejoue", () => {
  // Après (0,0) : ligne noire, blancs à droite de (5,5) coincés contre le bord ; seul le noir a encore (5,4).
  const s = custom({ black: [[0, 2], [5, 6], [5, 7]], white: [[0, 1], [5, 5]] });
  const after = play(s, 1, at(0, 0));
  assert.equal(after.turn, 0);
  assert.equal(after.passed, 2);
  assert.equal(status(after).turn, 1);
  assert.equal(status(after).over, false);
  assert.deepEqual(view(after).legal, [at(5, 4)]);
  // Le coup suivant efface l'indication de passe.
  const next = play(after, 1, at(5, 4));
  assert.equal(next.passed, null);
});

test('personne ne peut jouer : la partie finit, le plus de pions gagne', () => {
  const s = custom({ black: [[0, 2]], white: [[0, 1]] });
  const after = play(s, 1, at(0, 0));
  assert.deepEqual(status(after), { turn: null, over: true, winners: [1], deadline: null });
  assert.equal(after.draw, false);
  assert.throws(() => move(after, 2, { cell: at(5, 5) }, ctx()), /terminée/);
  assert.deepEqual(view(after).legal, []);
});

test('fin sur égalité : nul, pas de gagnant', () => {
  const s = custom({ black: [[0, 2]], white: [[0, 1], [7, 3], [7, 4], [7, 5]] });
  const after = play(s, 1, at(0, 0));
  assert.equal(after.over, true);
  assert.equal(after.draw, true);
  assert.deepEqual(status(after), { turn: null, over: true, winners: [], deadline: null });
});

test('victoire des blancs au décompte', () => {
  // Noir joue (0,0) et retourne 1 pion ; les blancs restent plus nombreux.
  const s = custom({ black: [[0, 2]], white: [[0, 1], [7, 3], [7, 4], [7, 5], [7, 6]] });
  const after = play(s, 1, at(0, 0));
  assert.deepEqual(status(after).winners, [2]);
});

test("une partie complète jouée au hasard se termine proprement, sans état invalide", () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let g = 0; g < 20; g++) {
    let s = start();
    let plies = 0;
    while (!status(s).over && plies++ < 80) s = timeout(s, ctx(rnd)).state;
    assert.equal(status(s).over, true);
    const [b, w] = counts(s.board);
    assert.equal(s.draw, b === w);
    assert.ok(b + w <= 64 && b + w >= 5);
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  }
});

test("l'abandon donne la victoire à l'autre, même hors de son tour", () => {
  const after = leave(start(), 2).state;
  assert.deepEqual(status(after), { turn: null, over: true, winners: [1], deadline: null });
  assert.deepEqual(leave(after, 1).state, after);
});

test('minuteur : échéance au lancement et après chaque coup, aucune sans option', () => {
  let s = start({ timer: 60 });
  assert.equal(status(s).deadline, T0 + 60_000);
  s = move(s, 1, { cell: at(2, 3) }, { now: T0 + 5000, random: () => 0 }).state;
  assert.equal(status(s).deadline, T0 + 65_000);
  assert.equal(status(start()).deadline, null);
});

test('timeout : joue un coup légal choisi par ctx.random', () => {
  const s = start({ timer: 30 });
  const first = timeout(s, ctx(() => 0)).state;
  assert.equal(first.last.cell, at(2, 3));
  assert.equal(first.last.auto, true);
  const last = timeout(s, ctx(() => 0.999)).state;
  assert.equal(last.last.cell, at(5, 4));
  assert.equal(status(last).turn, 2);
});

test('timeout après la fin ne change rien', () => {
  const s = leave(start({ timer: 30 }), 1).state;
  assert.deepEqual(timeout(s, ctx()).state, s);
});
