// Tests des règles de Télépathie : node --test games/telepathie/*.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, status, view, leave, levelsFor, livesFor, starsFor } from './rules.js';

function seeded(seed = 7) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}
const ctx = () => ({ now: 0, random: seeded() });
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `p${i + 1}` }));
const freeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(freeze); } return o; };
const play = (s, id, action) => move(freeze(s), id, action, ctx()).state;
const readyAll = (s) => { for (const id of s.players) s = play(s, id, { type: 'ready' }); return s; };
// État de jeu avec des mains choisies (niveau en cours)
const withHands = (s, hands) => ({ ...s, hands: { ...s.hands, ...hands } });

test('réglages selon le nombre de joueurs', () => {
  assert.deepEqual([2, 3, 4, 8].map(levelsFor), [12, 10, 8, 8]);
  assert.deepEqual([2, 3, 4, 8].map(livesFor), [2, 3, 4, 4]);
  assert.deepEqual([2, 4, 5, 8].map(starsFor), [1, 1, 1, 2]);
  const s = setup(mk(3), { levels: 0 }, ctx());
  assert.equal(s.levels, 10);
  assert.equal(setup(mk(3), { levels: 12 }, ctx()).levels, 12);
  assert.equal(setup(mk(8), { levels: 12 }, ctx()).levels, 12);
});

test('concentration : le niveau commence quand tout le monde est prêt', () => {
  let s = setup(mk(3), {}, ctx());
  assert.equal(s.phase, 'focus');
  assert.deepEqual(status(s).turn, [1, 2, 3]);
  s = play(s, 2, { type: 'ready' });
  assert.deepEqual(status(s).turn, [1, 3]);
  assert.throws(() => move(s, 2, { type: 'ready' }, ctx()), /déjà prêt/);
  assert.throws(() => move(s, 1, { type: 'play', card: 5 }, ctx()), /Prêt/);
  s = play(s, 1, { type: 'ready' });
  s = play(s, 3, { type: 'ready' });
  assert.equal(s.phase, 'play');
});

test('distribution : N cartes chacun, triées, toutes différentes, hasard fixé', () => {
  const a = readyAll(setup(mk(3), {}, ctx()));
  const b = readyAll(setup(mk(3), {}, ctx()));
  assert.deepEqual(a.hands, b.hands);
  const all = Object.values(a.hands).flat();
  assert.equal(all.length, 3);
  assert.equal(new Set(all).size, 3);
  assert.ok(all.every((c) => c >= 1 && c <= 100));
  // niveau 3
  let s = withHands(readyAll(setup(mk(2), {}, ctx())), { 1: [10], 2: [20] });
  s = play(s, 1, { type: 'play', card: 10 });
  s = play(s, 2, { type: 'play', card: 20 });
  assert.equal(s.level, 2);
  s = readyAll(s);
  assert.equal(s.hands[1].length, 2);
  assert.equal(s.hands[2].length, 2);
  assert.ok(s.hands[1][0] < s.hands[1][1]);
});

test('poser dans l’ordre réussit le niveau', () => {
  let s = withHands(readyAll(setup(mk(2), {}, ctx())), { 1: [10], 2: [20] });
  s = play(s, 1, { type: 'play', card: 10 });
  assert.equal(s.pile.length, 1);
  assert.equal(s.lives, 2);
  assert.equal(s.notice.kind, 'play');
  s = play(s, 2, { type: 'play', card: 20 });
  assert.equal(s.phase, 'focus');
  assert.equal(s.level, 2);
  assert.equal(s.notice.kind, 'cleared');
  assert.deepEqual(s.ready, []);
});

test('on ne pose que sa plus petite carte, et seulement s’il en reste', () => {
  const s = withHands(readyAll(setup(mk(2), {}, ctx())), { 1: [10, 30], 2: [20, 40] });
  assert.throws(() => move(s, 1, { type: 'play', card: 30 }, ctx()), /plus petite carte/);
  assert.throws(() => move(s, 1, { type: 'play' }, ctx()), /plus petite carte/);
  const t = withHands(s, { 1: [] });
  assert.throws(() => move(t, 1, { type: 'play', card: 10 }, ctx()), /plus de carte/);
});

test('une erreur coûte une vie et défausse les cartes plus petites', () => {
  let s = withHands(readyAll(setup(mk(3), {}, ctx())), { 1: [50], 2: [20], 3: [30] });
  s = play(s, 1, { type: 'play', card: 50 });
  assert.equal(s.lives, 2); // 3 joueurs : 3 vies au départ
  assert.equal(s.notice.kind, 'cleared');
  assert.equal(s.notice.prev.kind, 'mistake', 'l’erreur reste visible après le niveau');
  assert.deepEqual(s.notice.prev.lost.map((l) => l.card).sort(), [20, 30]);
  assert.equal(s.phase, 'focus', 'plus aucune carte : niveau suivant');
  assert.equal(s.level, 2);
});

test('une erreur ne défausse que les cartes plus petites', () => {
  let s = withHands(readyAll(setup(mk(2), { levels: 8 }, ctx())), { 1: [10, 20], 2: [5, 30] });
  // niveau 1 : on force des mains de 2 cartes
  s = play(s, 1, { type: 'play', card: 10 });
  assert.equal(s.lives, 1);
  assert.deepEqual(s.hands[2], [30]);
  assert.deepEqual(s.hands[1], [20]);
  assert.equal(s.phase, 'play');
});

test('plus de vie : la partie est perdue', () => {
  let s = withHands(readyAll(setup(mk(2), {}, ctx())), { 1: [10, 60, 70], 2: [5, 20, 90] });
  s = play(s, 1, { type: 'play', card: 10 }); // 5 défaussé : 1 vie
  assert.equal(s.lives, 1);
  s = play(s, 1, { type: 'play', card: 60 }); // 20 défaussé : 0 vie
  assert.equal(s.phase, 'over');
  assert.equal(s.result, 'lost');
  assert.equal(status(s).over, true);
  assert.deepEqual(status(s).winners, []);
  assert.throws(() => move(s, 1, { type: 'play', card: 70 }, ctx()), /terminée/);
});

test('étoile : tout le monde doit accepter, puis chacun défausse sa plus petite carte', () => {
  let s = withHands(readyAll(setup(mk(3), {}, ctx())), { 1: [10, 40], 2: [20, 50], 3: [30, 60] });
  s = play(s, 1, { type: 'star' });
  assert.deepEqual(s.starVote.yes, [1]);
  assert.throws(() => move(s, 2, { type: 'play', card: 20 }, ctx()), /étoile/);
  assert.throws(() => move(s, 2, { type: 'star' }, ctx()), /déjà proposée/);
  s = play(s, 2, { type: 'star-yes' });
  assert.equal(s.stars, 1);
  s = play(s, 3, { type: 'star-yes' });
  assert.equal(s.stars, 0);
  assert.equal(s.starVote, null);
  assert.deepEqual(s.hands, { 1: [40], 2: [50], 3: [60] });
  assert.deepEqual(s.notice.cards.map((c) => c.card), [10, 20, 30]);
  assert.equal(s.lives, 3, 'pas de vie perdue');
  assert.throws(() => move(s, 1, { type: 'star' }, ctx()), /plus d’étoile/);
});

test('un refus annule l’étoile sans la dépenser', () => {
  let s = withHands(readyAll(setup(mk(3), {}, ctx())), { 1: [10], 2: [20], 3: [30] });
  s = play(s, 1, { type: 'star' });
  s = play(s, 2, { type: 'star-no' });
  assert.equal(s.starVote, null);
  assert.equal(s.stars, 1);
  assert.equal(s.notice.kind, 'star-no');
  assert.throws(() => move(s, 3, { type: 'star-yes' }, ctx()), /Aucune étoile/);
  s = play(s, 3, { type: 'play', card: 30 }); // on peut rejouer
  assert.equal(s.lives, 2);
});

test('l’étoile qui vide toutes les mains réussit le niveau', () => {
  let s = withHands(readyAll(setup(mk(2), {}, ctx())), { 1: [10], 2: [20] });
  s = play(s, 1, { type: 'star' });
  s = play(s, 2, { type: 'star-yes' });
  assert.equal(s.phase, 'focus');
  assert.equal(s.level, 2);
});

test('bonus : une étoile après le niveau 2, une vie après le niveau 3', () => {
  let s = setup(mk(2), { levels: 8 }, ctx());
  // p1 pose ses cartes 1..L, puis p2 ses cartes 50.. : toujours croissant, donc sans erreur
  const clearSeq = (s) => {
    s = readyAll(s);
    const L = s.level;
    const h = { 1: Array.from({ length: L }, (_, k) => k + 1), 2: Array.from({ length: L }, (_, k) => 50 + k) };
    s = withHands(s, h);
    for (let k = 0; k < L; k++) s = play(s, 1, { type: 'play', card: s.hands[1][0] });
    for (let k = 0; k < L; k++) s = play(s, 2, { type: 'play', card: s.hands[2][0] });
    return s;
  };
  s = clearSeq(s); assert.equal(s.level, 2); assert.equal(s.stars, 1);
  s = clearSeq(s); assert.equal(s.level, 3); assert.equal(s.stars, 2); assert.equal(s.notice.bonus, 'star');
  s = clearSeq(s); assert.equal(s.level, 4); assert.equal(s.lives, 3); assert.equal(s.notice.bonus, 'life');
});

test('dernier niveau réussi : victoire de toute l’équipe', () => {
  let s = setup(mk(2), { levels: 4 }, ctx());
  s = { ...s, level: 4 };
  s = withHands(readyAll(s), { 1: [1, 2, 3, 4], 2: [5, 6, 7, 8] });
  for (let k = 0; k < 4; k++) s = play(s, 1, { type: 'play', card: s.hands[1][0] });
  for (let k = 0; k < 4; k++) s = play(s, 2, { type: 'play', card: s.hands[2][0] });
  assert.equal(s.phase, 'over');
  assert.equal(s.result, 'won');
  assert.deepEqual(status(s), { over: true, turn: null, winners: [1, 2] });
});

test('la vue cache les mains des autres et celles du spectateur', () => {
  const s = withHands(readyAll(setup(mk(3), {}, ctx())), { 1: [10], 2: [20], 3: [30] });
  assert.deepEqual(view(s, 2).hand, [20]);
  assert.equal(view(s, null).hand, null);
  assert.deepEqual(view(s, 2).counts, { 1: 1, 2: 1, 3: 1 });
  const json = JSON.stringify(view(s, 2));
  assert.ok(!json.includes('"10"') && !/\[10\]/.test(json) && !/\[30\]/.test(json));
  assert.ok(!('hands' in view(s, 2)));
});

test('abandon : à moins de deux joueurs la partie est perdue ; sinon elle continue', () => {
  let s = withHands(readyAll(setup(mk(2), {}, ctx())), { 1: [10], 2: [20] });
  let t = leave(freeze(s), 2, ctx()).state;
  assert.equal(t.result, 'lost');
  s = withHands(readyAll(setup(mk(3), {}, ctx())), { 1: [10], 2: [20], 3: [30] });
  s = play(s, 1, { type: 'star' });
  s = play(s, 2, { type: 'star-yes' });
  t = leave(s, 3, ctx()).state; // le dernier qui n'avait pas accepté part : l'étoile passe
  assert.equal(t.stars, 0);
  assert.equal(t.phase, 'focus', 'les cartes restantes sont défaussées : niveau réussi');
  // abandon pendant la concentration : les autres, déjà prêts, lancent le niveau
  let f = setup(mk(3), {}, ctx());
  f = play(f, 1, { type: 'ready' });
  f = play(f, 2, { type: 'ready' });
  f = leave(f, 3, ctx()).state;
  assert.equal(f.phase, 'play');
  assert.deepEqual(status(f).turn, [1, 2]);
  assert.equal(f.hands[3].length, 0);
});

test('abandon de celui qui a proposé l’étoile : la proposition tombe', () => {
  let s = withHands(readyAll(setup(mk(3), {}, ctx())), { 1: [10], 2: [20], 3: [30] });
  s = play(s, 1, { type: 'star' });
  const t = leave(s, 1, ctx()).state;
  assert.equal(t.starVote, null);
  assert.equal(t.stars, 1);
});

test('toutes les cartes de la partie sont uniques et le hasard ne vient que de ctx', () => {
  const s = readyAll(setup(mk(8), { levels: 12 }, ctx()));
  const all = Object.values(s.hands).flat();
  assert.equal(all.length, 8);
  const s2 = { ...s, level: 12 };
  const t = readyAll({ ...s2, phase: 'focus', ready: [] });
  const cards = Object.values(t.hands).flat();
  assert.equal(cards.length, 96);
  assert.equal(new Set(cards).size, 96);
});
