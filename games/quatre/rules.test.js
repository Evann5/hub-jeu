// Tests des règles de « Quatre à la suite » : node --test games/quatre/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, view, status, timeout, leave, openColumns } from './rules.js';

const players = [{ id: 1, pseudo: 'ana' }, { id: 2, pseudo: 'bob' }];
const T0 = 1_000_000;
const ctx = (random = () => 0) => ({ now: T0, random });
const start = (options = {}) => setup(players, options, ctx());
const play = (s, id, col, c = ctx()) => move(s, id, { col }, c).state;
// Rejoue une suite de [joueur, colonne].
const replay = (s, moves) => moves.reduce((acc, [id, col]) => play(acc, id, col), s);
const at = (r, c) => r * 7 + c;

test('le joueur 1 commence et le jeton tombe tout en bas', () => {
  let s = start();
  assert.equal(status(s).turn, 1);
  s = play(s, 1, 3);
  assert.equal(s.board[at(5, 3)], 0);
  assert.equal(status(s).turn, 2);
  s = play(s, 2, 3);
  assert.equal(s.board[at(4, 3)], 1);
  assert.deepEqual(s.last, { cell: at(4, 3), auto: false });
});

test("l'état reçu n'est jamais modifié", () => {
  const s = start();
  const copy = JSON.stringify(s);
  play(s, 1, 0);
  assert.equal(JSON.stringify(s), copy);
});

test('coups refusés : mauvais tour, colonne inconnue, colonne pleine', () => {
  let s = start();
  assert.throws(() => move(s, 2, { col: 0 }, ctx()), /pas ton tour/);
  assert.throws(() => move(s, 1, { col: 7 }, ctx()), /Colonne inconnue/);
  assert.throws(() => move(s, 1, { col: -1 }, ctx()), /Colonne inconnue/);
  assert.throws(() => move(s, 1, { col: 'x' }, ctx()), /Colonne inconnue/);
  assert.throws(() => move(s, 1, {}, ctx()), /Colonne inconnue/);
  for (let i = 0; i < 6; i++) s = play(s, i % 2 ? 2 : 1, 0);
  assert.throws(() => move(s, 1, { col: 0 }, ctx()), /pleine/);
});

test('quatre en ligne gagnent', () => {
  const s = replay(start(), [[1, 0], [2, 0], [1, 1], [2, 1], [1, 2], [2, 2], [1, 3]]);
  assert.deepEqual(status(s), { turn: null, over: true, winners: [1], deadline: null });
  assert.deepEqual(s.line, [at(5, 0), at(5, 1), at(5, 2), at(5, 3)]);
  assert.throws(() => move(s, 2, { col: 4 }, ctx()), /terminée/);
});

test('quatre en colonne gagnent', () => {
  const s = replay(start(), [[1, 0], [2, 1], [1, 0], [2, 1], [1, 0], [2, 1], [1, 0]]);
  assert.deepEqual(status(s).winners, [1]);
  assert.deepEqual(s.line, [at(2, 0), at(3, 0), at(4, 0), at(5, 0)]);
});

test('diagonale montante (bas gauche vers haut droite)', () => {
  // Joueur 1 : (5,0) (4,1) (3,2) (2,3)
  const s = replay(start(), [[1, 0], [2, 1], [1, 1], [2, 2], [1, 6], [2, 2], [1, 2], [2, 3], [1, 3], [2, 3], [1, 3]]);
  assert.deepEqual(status(s).winners, [1]);
  assert.deepEqual(s.line, [at(2, 3), at(3, 2), at(4, 1), at(5, 0)]);
});

test('diagonale descendante (haut gauche vers bas droite)', () => {
  // Le joueur 2 (place 1) a déjà (2,0) (3,1) (4,2) ; il pose le jeton qui tombe en (5,3).
  const board = Array(42).fill(null);
  [at(2, 0), at(3, 1), at(4, 2)].forEach((i) => { board[i] = 1; });
  [at(5, 0), at(4, 0), at(3, 0), at(5, 1), at(4, 1), at(5, 2)].forEach((i) => { board[i] = 0; });
  const after = play({ ...start(), board, turn: 1 }, 2, 3);
  assert.deepEqual(status(after).winners, [2]);
  assert.deepEqual(after.line, [at(2, 0), at(3, 1), at(4, 2), at(5, 3)]);
});

test('trois jetons ne suffisent pas', () => {
  const s = replay(start(), [[1, 0], [2, 4], [1, 1], [2, 4], [1, 2]]);
  assert.equal(status(s).over, false);
  assert.equal(s.line, null);
});

test('grille pleine sans alignement : match nul', () => {
  // Motif sans aucune série de 4 (21 jetons de chaque couleur) ; la dernière case, en haut à droite, reste libre.
  const board = Array.from({ length: 42 }, (_, i) => (Math.floor((i % 7) / 2) + Math.floor(i / 7)) % 2);
  board[at(0, 6)] = null;
  const result = play({ ...start(), board, turn: 1 }, 2, 6);
  assert.equal(result.line, null);
  assert.equal(result.draw, true);
  assert.deepEqual(status(result), { turn: null, over: true, winners: [], deadline: null });
});

test("l'abandon donne la victoire à l'autre, même hors de son tour", () => {
  const s = start();
  const after = leave(s, 2).state;
  assert.deepEqual(status(after).winners, [1]);
  assert.equal(after.forfeit, 2);
  assert.equal(status(after).over, true);
  // Une fois la partie finie, un second abandon ne change rien.
  assert.deepEqual(leave(after, 1).state, after);
});

test('minuteur : échéance posée au lancement et après chaque coup', () => {
  let s = start({ timer: 30 });
  assert.equal(status(s).deadline, T0 + 30_000);
  const later = { now: T0 + 12_000, random: () => 0 };
  s = move(s, 1, { col: 2 }, later).state;
  assert.equal(status(s).deadline, T0 + 42_000);
  assert.equal(status(start()).deadline, null);
  assert.equal(status(start({ timer: 0 })).deadline, null);
});

test('timeout : un jeton légal au hasard, joué pour le joueur dont c’est le tour', () => {
  const s = start({ timer: 30 });
  const first = timeout(s, ctx(() => 0)).state;
  assert.equal(first.board[at(5, 0)], 0);
  assert.deepEqual(first.last, { cell: at(5, 0), auto: true });
  assert.equal(status(first).turn, 2);
  const last = timeout(s, ctx(() => 0.999)).state;
  assert.equal(last.board[at(5, 6)], 0);
});

test('timeout ne tombe jamais dans une colonne pleine', () => {
  let s = start({ timer: 30 });
  for (let i = 0; i < 6; i++) s = play(s, i % 2 ? 2 : 1, 0);
  assert.deepEqual(openColumns(s.board), [1, 2, 3, 4, 5, 6]);
  const t = timeout(s, ctx(() => 0)).state;
  assert.equal(t.board[at(5, 1)] !== null, true);
  assert.equal(t.board.filter((v) => v !== null).length, 7);
});

test('timeout après la fin ne change rien', () => {
  const s = leave(start({ timer: 30 }), 1).state;
  assert.deepEqual(timeout(s, ctx()).state, s);
});

test('view : spectateur et joueurs voient la même chose, état sérialisable', () => {
  const s = play(start(), 1, 3);
  assert.deepEqual(view(s, null), view(s, 1));
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});
