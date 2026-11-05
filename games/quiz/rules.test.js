// Tests des règles du quiz : node --test games/quiz/*.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, status, view, timeout, leave } from './rules.js';
import { QUESTIONS } from './questions.js';

function seeded(seed = 3) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}
const players = [{ id: 1, pseudo: 'a' }, { id: 2, pseudo: 'b' }, { id: 3, pseudo: 'c' }];
const start = (opts = {}) => timeout(setup(players, { count: 5, time: 10, theme: 'tout', ...opts }, { now: 0, random: seeded() }), { now: 4000, random: seeded() }).state;
const answer = (s, id, choice, now) => move(s, id, { type: 'answer', choice }, { now, random: seeded() }).state;

test('chaque question a 4 réponses différentes et une bonne', () => {
  for (const q of QUESTIONS) {
    assert.equal(q.a.length, 4, q.q);
    assert.equal(new Set(q.a).size, 4, q.q);
  }
});

test('la partie commence par « Prêts ? » puis la première question', () => {
  const s0 = setup(players, { count: 5, time: 10, theme: 'tout' }, { now: 0, random: seeded() });
  assert.equal(s0.phase, 'ready');
  assert.deepEqual(status(s0).turn, []);
  const s = start();
  assert.equal(s.phase, 'question');
  assert.equal(s.index, 0);
  assert.deepEqual(status(s).turn, [1, 2, 3]);
  assert.equal(status(s).deadline, 14000);
});

test('la bonne réponse est cachée pendant la question', () => {
  const s = start();
  const v = view(s, 1);
  assert.equal(v.correct, null);
  assert.equal(v.counts, null);
  assert.ok(!JSON.stringify(v).includes('"correct":0') || v.correct === null);
});

test('points : 500 + bonus de rapidité, rien pour une mauvaise réponse', () => {
  let s = start();
  const good = s.questions[0].correct;
  const bad = (good + 1) % 4;
  s = answer(s, 1, good, 4000); // tout de suite : 1000
  s = answer(s, 2, good, 9000); // à mi-temps : 750
  assert.equal(s.phase, 'question');
  s = answer(s, 3, bad, 5000);
  assert.equal(s.phase, 'reveal');
  assert.deepEqual(s.scores, { 1: 1000, 2: 750, 3: 0 });
  const v = view(s, 3);
  assert.equal(v.correct, good);
  assert.equal(v.counts[good], 2);
});

test('une seule réponse par question', () => {
  const s = answer(start(), 1, 0, 5000);
  assert.throws(() => move(s, 1, { type: 'answer', choice: 1 }, { now: 6000 }), /déjà répondu/);
  assert.throws(() => move(s, 2, { type: 'answer', choice: 7 }, { now: 6000 }), /inconnue/);
});

test('minuteur : révélation puis question suivante, puis fin', () => {
  let s = start();
  for (let i = 0; i < 5; i++) {
    s = timeout(s, { now: 100000 * (i + 1), random: seeded() }).state;
    assert.equal(s.phase, 'reveal');
    s = timeout(s, { now: 100000 * (i + 1) + 6000, random: seeded() }).state;
  }
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s), { over: true, turn: null, winners: [] });
});

test('le meilleur score gagne, égalités comprises', () => {
  let s = start({ count: 1 });
  const good = s.questions[0].correct;
  s = answer(s, 1, good, 4000);
  s = answer(s, 2, good, 4000);
  s = answer(s, 3, (good + 1) % 4, 4000);
  s = timeout(s, { now: 20000, random: seeded() }).state;
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s).winners, [1, 2]);
});

test('un thème ne pioche que dans ce thème', () => {
  const s = setup(players, { count: 50, time: 10, theme: 'sport' }, { now: 0, random: seeded() });
  assert.ok(s.questions.every((q) => q.theme === 'Sport'));
  assert.equal(s.questions.length, QUESTIONS.filter((q) => q.t === 'sport').length);
});

test('abandon : on n’attend plus le joueur parti', () => {
  let s = start();
  s = answer(s, 1, 0, 5000);
  s = answer(s, 2, 0, 5000);
  s = leave(s, 3, { now: 6000, random: seeded() }).state;
  assert.equal(s.phase, 'reveal');
});

// Audit des coups forgés : move() refuse seul ce que le hub filtre déjà par `turn`.
test('un joueur parti ne répond pas', () => {
  let s = start();
  s = leave(s, 3, { now: 5000, random: seeded() }).state;
  assert.throws(() => answer(s, 3, 0, 6000), /quitté/);
});
