// Tests des règles de Six Savoirs : node --test games/savoirs/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, timeout, leave, status, view, BOARD, CATS, SIZE } from './rules.js';

function seeded(seed = 3) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}
const ctx = (now = 1000, seed = 3) => ({ now, random: seeded(seed) });
const players = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `p${i + 1}` }));
const play = (s, id, action, now = 1000) => move(s, id, action, ctx(now)).state;

test('plateau : 30 cases, un Sceau par catégorie, jamais deux cases voisines de la même couleur', () => {
  assert.equal(BOARD.length, SIZE);
  assert.deepEqual(BOARD.filter((c) => c.seal).map((c) => c.cat).sort(), [...CATS].sort());
  for (let i = 0; i < SIZE; i++) assert.notEqual(BOARD[i].cat, BOARD[(i + 1) % SIZE].cat, `cases ${i} et ${i + 1}`);
});

test('un tour : lancer, choisir entre avancer et reculer, répondre', () => {
  let s = setup(players(2), { goal: 3, time: 20 }, ctx());
  assert.equal(status(s).turn, 1);
  assert.throws(() => move(s, 2, { type: 'roll' }, ctx()), /pas ton tour/);
  s = play(s, 1, { type: 'roll' });
  assert.equal(s.phase, 'move');
  assert.ok(s.die >= 1 && s.die <= 6);
  assert.deepEqual([...s.dests].sort((a, b) => a - b), [...new Set([s.die % SIZE, (SIZE - s.die) % SIZE])].sort((a, b) => a - b));
  assert.throws(() => play(s, 1, { type: 'move', to: 13 }), /surbrillance/);
  s = play(s, 1, { type: 'move', to: s.dests[0] });
  assert.equal(s.phase, 'question');
  assert.equal(s.question.cat, BOARD[s.dests[0]].cat);
  assert.equal(view(s).question.correct, null, 'la bonne réponse ne part pas au navigateur pendant la question');
});

test('mauvaise réponse : la main passe ; bonne réponse : on rejoue', () => {
  let s = setup(players(2), {}, ctx());
  s = play(play(s, 1, { type: 'roll' }), 1, { type: 'move', to: play(s, 1, { type: 'roll' }).dests[0] });
  const wrong = (s.question.correct + 1) % 4;
  let t = play(s, 1, { type: 'answer', choice: wrong });
  assert.equal(t.phase, 'reveal');
  assert.equal(view(t).question.correct, s.question.correct, 'la bonne réponse est montrée à la révélation');
  t = timeout(t, ctx(9000)).state;
  assert.equal(status(t).turn, 2, 'au suivant');

  t = play(s, 1, { type: 'answer', choice: s.question.correct });
  t = timeout(t, ctx(9000)).state;
  assert.equal(status(t).turn, 1, 'il rejoue');
  assert.equal(t.phase, 'roll');
});

test('une bonne réponse sur un Sceau donne le sceau ; le premier au but gagne', () => {
  let s = setup(players(2), { goal: 3 }, ctx());
  // On place le joueur 1 devant un Sceau et on force le dé par une question directe.
  for (const [i, cat] of [[5, CATS[1]], [10, CATS[2]], [15, CATS[3]]]) {
    s = { ...s, cur: 0, phase: 'move', die: 1, dests: [i] };
    s = play(s, 1, { type: 'move', to: i });
    assert.equal(s.question.cat, cat);
    s = play(s, 1, { type: 'answer', choice: s.question.correct });
    assert.ok(s.seals[1].includes(cat));
    if (s.winner === null) s = timeout(s, ctx(9000)).state;
  }
  assert.equal(s.winner, 1);
  s = timeout(s, ctx(9000)).state;
  assert.equal(status(s).over, true);
  assert.deepEqual(status(s).winners, [1]);
});

test('un sceau ne se gagne qu’une fois', () => {
  let s = setup(players(2), { goal: 6 }, ctx());
  s = { ...s, seals: { ...s.seals, 1: ['histoire'] }, phase: 'move', die: 5, dests: [5] };
  s = play(s, 1, { type: 'move', to: 5 });
  s = play(s, 1, { type: 'answer', choice: s.question.correct });
  assert.deepEqual(s.seals[1], ['histoire']);
});

test('minuteurs : le dé se lance seul, la case Sceau manquante est choisie, la question non répondue est ratée', () => {
  let s = setup(players(2), {}, ctx());
  s = timeout(s, ctx(40_000)).state;
  assert.equal(s.phase, 'move');
  s = { ...s, dests: [3, 5] };
  s = timeout(s, ctx(70_000)).state;
  assert.equal(s.pos[1], 5, 'la case Sceau d’abord');
  s = timeout(s, ctx(100_000)).state;
  assert.equal(s.phase, 'reveal');
  assert.equal(s.answer.right, false);
  assert.equal(s.answer.choice, null);
});

test('les questions ne se répètent pas dans une catégorie', () => {
  let s = setup(players(1), {}, ctx());
  const seen = new Set();
  for (let k = 0; k < 10; k++) {
    s = { ...s, cur: 0, phase: 'move', dests: [5] };
    s = move(s, 1, { type: 'move', to: 5 }, ctx(1000, k + 11)).state;
    assert.ok(!seen.has(s.question.q), 'question déjà posée');
    seen.add(s.question.q);
  }
});

test('abandon : on passe au suivant ; seul restant, il gagne', () => {
  let s = setup(players(3), {}, ctx());
  s = leave(s, 1, ctx()).state;
  assert.equal(status(s).turn, 2);
  s = leave(s, 3, ctx()).state;
  assert.equal(status(s).over, true);
  assert.deepEqual(status(s).winners, [2]);
});
