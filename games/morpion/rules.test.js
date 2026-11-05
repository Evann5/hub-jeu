// Tests des règles du morpion : node --test games/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, status, leave } from './rules.js';

const players = [{ id: 1, pseudo: 'ana' }, { id: 2, pseudo: 'bob' }];
const play = (s, id, cell) => move(s, id, { cell }).state;

test('les croix commencent et le tour passe', () => {
  let s = setup(players);
  assert.equal(status(s).turn, 1);
  s = play(s, 1, 4);
  assert.equal(status(s).turn, 2);
  assert.equal(s.board[4], 0);
});

test('une case prise est refusée', () => {
  const s = play(setup(players), 1, 0);
  assert.throws(() => move(s, 2, { cell: 0 }), /déjà prise/);
  assert.throws(() => move(s, 2, { cell: 9 }), /inconnue/);
});

test('trois à la suite gagnent', () => {
  let s = setup(players);
  for (const [id, c] of [[1, 0], [2, 3], [1, 1], [2, 4], [1, 2]]) s = play(s, id, c);
  assert.deepEqual(status(s), { turn: null, over: true, winners: [1] });
  assert.deepEqual(s.line, [0, 1, 2]);
});

test('grille pleine sans ligne : match nul', () => {
  let s = setup(players);
  for (const [id, c] of [[1, 0], [2, 1], [1, 2], [2, 4], [1, 3], [2, 5], [1, 7], [2, 6], [1, 8]]) s = play(s, id, c);
  assert.equal(s.draw, true);
  assert.deepEqual(status(s).winners, []);
  assert.equal(status(s).over, true);
});

test("l'abandon donne la victoire à l'autre", () => {
  const s = leave(setup(players), 1).state;
  assert.deepEqual(status(s).winners, [2]);
});

// Audit des coups forgés : le hub filtre déjà par `turn`, mais move() doit refuser seul un coup hors tour.
test('un joueur ne joue pas pendant le tour de l’autre, ni après la fin', () => {
  const s = setup(players);
  assert.throws(() => move(s, 2, { cell: 0 }), /pas ton tour/);
  assert.throws(() => move(s, 99, { cell: 0 }), /pas ton tour/);
  let fin = setup(players);
  for (const [id, c] of [[1, 0], [2, 3], [1, 1], [2, 4], [1, 2]]) fin = play(fin, id, c);
  assert.throws(() => move(fin, 2, { cell: 8 }), /terminée/);
});
