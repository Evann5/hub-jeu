// Tests des règles de Six Savoirs : node --test games/savoirs/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, timeout, leave, status, view, reach, BOARD, ADJ, CATS, SIZE, HUB, RING } from './rules.js';

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

test('plateau en roue : anneau de 36, 6 rayons de 4, un Centre ; un Sceau par catégorie ; voisins de couleurs différentes', () => {
  assert.equal(SIZE, 61);
  assert.equal(BOARD[HUB].hub, true);
  assert.deepEqual(BOARD.filter((c) => c.seal).map((c) => c.cat).sort(), [...CATS].sort());
  assert.equal(BOARD.filter((c) => c.again).length, 6);
  for (let i = 0; i < SIZE; i++) {
    for (const j of ADJ[i]) {
      assert.ok(ADJ[j].includes(i), `lien ${i}-${j} dans les deux sens`);
      if (BOARD[i].cat && BOARD[j].cat) assert.notEqual(BOARD[i].cat, BOARD[j].cat, `cases ${i} et ${j}`);
    }
  }
  assert.equal(ADJ[HUB].length, 6);
  assert.deepEqual(reach(HUB, 5).filter((i) => BOARD[i].seal).length, 6, 'chaque Sceau est à 5 cases du Centre');
});

test('un tour : lancer, choisir une case atteignable, répondre', () => {
  let s = setup(players(2), { goal: 3, time: 20 }, ctx());
  assert.equal(status(s).turn, 1);
  assert.equal(s.pos[1], HUB, 'on part du Centre');
  assert.throws(() => move(s, 2, { type: 'roll' }, ctx()), /pas ton tour/);
  s = play(s, 1, { type: 'roll' });
  assert.equal(s.phase, 'move');
  assert.ok(s.die >= 1 && s.die <= 6);
  assert.deepEqual(s.dests, reach(HUB, s.die));
  assert.throws(() => play(s, 1, { type: 'move', to: HUB }), /surbrillance/);
  const to = s.dests.find((d) => !BOARD[d].again);
  s = play(s, 1, { type: 'move', to });
  assert.equal(s.phase, 'question');
  assert.equal(s.question.cat, BOARD[to].cat);
  assert.equal(view(s).question.correct, null, 'la bonne réponse ne part pas au navigateur pendant la question');
});

test('déplacement : on ne repasse pas par la même case', () => {
  assert.deepEqual(reach(0, 1), [1, RING - 1, RING].sort((a, b) => a - b));
  assert.ok(!reach(1, 2).includes(1));
  assert.ok(reach(RING + 3, 2).includes(RING + 4 * 1 + 3), 'on traverse le Centre vers un autre rayon');
});

test('case Rejoue : pas de question, on relance', () => {
  let s = setup(players(2), {}, ctx());
  s = { ...s, phase: 'move', die: 3, dests: [3] };
  s = play(s, 1, { type: 'move', to: 3 });
  assert.equal(s.phase, 'roll');
  assert.equal(status(s).turn, 1);
  assert.equal(s.pos[1], 3);
});

test('mauvaise réponse : la main passe ; bonne réponse : on rejoue', () => {
  let s = setup(players(2), {}, ctx());
  s = play(play(s, 1, { type: 'roll' }), 1, { type: 'move', to: play(s, 1, { type: 'roll' }).dests.find((d) => !BOARD[d].again) });
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

test('un Sceau se gagne sur sa case ; tous ses sceaux, on gagne au Centre par la question finale', () => {
  let s = setup(players(2), { goal: 3 }, ctx());
  for (const [i, cat] of [[6, CATS[1]], [12, CATS[2]], [18, CATS[3]]]) {
    s = { ...s, cur: 0, phase: 'move', die: 1, dests: [i] };
    s = play(s, 1, { type: 'move', to: i });
    assert.equal(s.question.cat, cat);
    assert.equal(view(s).question.final, false);
    s = play(s, 1, { type: 'answer', choice: s.question.correct });
    assert.ok(s.seals[1].includes(cat));
    s = timeout(s, ctx(9000)).state;
  }
  assert.equal(s.winner, null, 'les sceaux ne suffisent pas : il faut revenir au Centre');
  // Sur une case normale, une bonne réponse ne donne rien.
  s = { ...s, cur: 0, phase: 'move', die: 1, dests: [1] };
  s = play(s, 1, { type: 'move', to: 1 });
  s = play(s, 1, { type: 'answer', choice: s.question.correct });
  assert.equal(s.seals[1].length, 3);
  s = timeout(s, ctx(9000)).state;
  // Le minuteur choisit le Centre quand on peut l'atteindre.
  s = { ...s, cur: 0, phase: 'move', die: 5, dests: [6, HUB] };
  s = timeout(s, ctx(20_000)).state;
  assert.equal(s.pos[1], HUB);
  assert.equal(view(s).question.final, true);
  s = play(s, 1, { type: 'answer', choice: s.question.correct });
  assert.equal(s.winner, 1);
  s = timeout(s, ctx(30_000)).state;
  assert.equal(status(s).over, true);
  assert.deepEqual(status(s).winners, [1]);
});

test('un sceau ne se gagne qu’une fois', () => {
  let s = setup(players(2), { goal: 6 }, ctx());
  s = { ...s, seals: { ...s.seals, 1: ['histoire'] }, phase: 'move', die: 5, dests: [6] };
  s = play(s, 1, { type: 'move', to: 6 });
  s = play(s, 1, { type: 'answer', choice: s.question.correct });
  assert.deepEqual(s.seals[1], ['histoire']);
});

test('minuteurs : le dé se lance seul, la case Sceau manquante est choisie, la question non répondue est ratée', () => {
  let s = setup(players(2), {}, ctx());
  s = timeout(s, ctx(40_000)).state;
  assert.equal(s.phase, 'move');
  s = { ...s, dests: [4, 6] };
  s = timeout(s, ctx(70_000)).state;
  assert.equal(s.pos[1], 6, 'la case Sceau d’abord');
  s = timeout(s, ctx(100_000)).state;
  assert.equal(s.phase, 'reveal');
  assert.equal(s.answer.right, false);
  assert.equal(s.answer.choice, null);
});

test('les questions ne se répètent pas dans une catégorie', () => {
  let s = setup(players(1), {}, ctx());
  const seen = new Set();
  for (let k = 0; k < 10; k++) {
    s = { ...s, cur: 0, phase: 'move', dests: [6] };
    s = move(s, 1, { type: 'move', to: 6 }, ctx(1000, k + 11)).state;
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
