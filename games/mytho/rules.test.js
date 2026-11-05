// Tests des règles de Mytho : node --test games/mytho/*.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, status, view, timeout, leave, POINTS } from './rules.js';

function seeded(seed = 5) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}
const ctx = (now = 0) => ({ now, random: seeded() });
const players = [1, 2, 3].map((id) => ({ id, pseudo: `p${id}` }));
const start = () => setup(players, { rounds: 3, writeTime: 60 }, ctx());
const play = (s, id, action) => move(s, id, action, ctx(1000)).state;
const writeAll = (s) => {
  for (const id of [1, 2, 3]) if (!(id in s.defs)) s = play(s, id, { type: 'define', text: `Fausse définition numéro ${id}` });
  return s;
};

test('tout le monde écrit en même temps, puis le vote commence', () => {
  let s = start();
  assert.equal(s.phase, 'write');
  assert.deepEqual(status(s).turn, [1, 2, 3]);
  s = play(s, 1, { type: 'define', text: 'Un petit chapeau' });
  assert.deepEqual(status(s).turn, [2, 3]);
  s = writeAll(s);
  assert.equal(s.phase, 'vote');
  assert.equal(s.options.length, 4);
});

test('refuse la vraie définition et les textes trop courts', () => {
  const s = start();
  assert.throws(() => move(s, 1, { type: 'define', text: s.words[0][1].toUpperCase() }, ctx()), /vraie définition/);
  assert.throws(() => move(s, 1, { type: 'define', text: 'a' }, ctx()), /trop courte/);
});

test('pendant le vote, les auteurs restent cachés ; on ne vote pas pour soi', () => {
  const s = writeAll(start());
  const v = view(s, 2);
  assert.ok(v.options.every((o) => o.by === null));
  assert.equal(v.options.filter((o) => o.mine).length, 1);
  assert.equal(v.truth, null);
  const own = v.options.find((o) => o.mine).index;
  assert.throws(() => move(s, 2, { type: 'vote', option: own }, ctx()), /propre définition/);
});

test('points : +3 pour la vraie, +2 par joueur piégé', () => {
  let s = writeAll(start());
  const truth = s.options.findIndex((o) => o.by === 'vrai');
  const of = (id) => s.options.findIndex((o) => o.by === id);
  s = play(s, 1, { type: 'vote', option: truth }); // 1 trouve
  s = play(s, 2, { type: 'vote', option: of(1) }); // 2 piégé par 1
  s = play(s, 3, { type: 'vote', option: of(1) }); // 3 piégé par 1
  assert.equal(s.phase, 'reveal');
  assert.deepEqual(s.scores, { 1: POINTS.found + 2 * POINTS.fooled, 2: 0, 3: 0 });
  const v = view(s, null);
  assert.equal(v.truth, s.words[0][1]);
  assert.deepEqual(v.options[of(1)].voters.sort(), [2, 3]);
});

test('minuteurs : écriture → vote → révélation → manche suivante → fin', () => {
  let s = start();
  s = play(s, 1, { type: 'define', text: 'Une sorte de fromage' });
  s = timeout(s, ctx(70000)).state;
  assert.equal(s.phase, 'vote');
  assert.equal(s.options.length, 2);
  s = timeout(s, ctx(120000)).state;
  assert.equal(s.phase, 'reveal');
  s = timeout(s, ctx(140000)).state;
  assert.equal(s.round, 1);
  s = timeout(s, ctx(200000)).state; // personne n'écrit : réponse directe
  assert.equal(s.phase, 'reveal');
  s = timeout(timeout(s, ctx(300000)).state, ctx(400000)).state;
  s = timeout(s, ctx(500000)).state;
  assert.equal(s.phase, 'over');
});

test('abandon pendant l’écriture : on n’attend plus le joueur', () => {
  let s = start();
  s = play(s, 1, { type: 'define', text: 'Une danse ancienne' });
  s = play(s, 2, { type: 'define', text: 'Un oiseau des marais' });
  s = leave(s, 3, ctx(2000)).state;
  assert.equal(s.phase, 'vote');
});

// Audit des coups forgés : move() refuse seul ce que le hub filtre déjà par `turn`.
test('une définition ne s’écrit qu’une fois, et pas par un joueur parti', () => {
  let s = start();
  s = play(s, 1, { type: 'define', text: 'Un petit chapeau' });
  assert.throws(() => move(s, 1, { type: 'define', text: 'Un autre texte' }, ctx(1000)), /déjà/);
  assert.equal(s.defs[1], 'Un petit chapeau');
  s = leave(s, 3, ctx(1000)).state;
  assert.throws(() => move(s, 3, { type: 'define', text: 'Je suis parti' }, ctx(1000)), /quitté/);
});

test('un joueur parti ne vote pas', () => {
  let s = writeAll(start());
  s = leave(s, 3, ctx(1000)).state;
  const of = (id) => s.options.findIndex((o) => o.by === id);
  assert.throws(() => move(s, 3, { type: 'vote', option: of(1) }, ctx(1000)), /quitté/);
});
