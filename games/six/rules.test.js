// Tests des règles de Six cornes : node --test games/six/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, view, status, timeout, leave, bulls, rowBulls, HAND } from './rules.js';

const names = ['ana', 'bob', 'cléo', 'dan', 'eli', 'fay', 'gus', 'hal', 'ivy', 'jo'];
const mkPlayers = (n) => names.slice(0, n).map((pseudo, i) => ({ id: i + 1, pseudo }));
const T0 = 9_000_000;
const ctx = (random = () => 0.3, now = T0) => ({ now, random });

function seeded(seed) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

// État fabriqué à la main : 3 joueurs, mains et rangées choisies.
function crafted({ hands, rows, heads = [0, 0, 0], ...rest }, options = {}) {
  const base = setup(mkPlayers(3), options, ctx(seeded(1)));
  return { ...base, hands, rows, heads, ...rest };
}
const pick = (s, id, card, k = ctx()) => move(s, id, { type: 'pick', card }, k).state;
const takeRowMove = (s, id, row, k = ctx()) => move(s, id, { type: 'row', row }, k).state;

test('têtes de bœuf : 1, 2 (multiples de 5), 3 (multiples de 10), 5 (doubles), 7 (le 55)', () => {
  assert.equal(bulls(1), 1);
  assert.equal(bulls(7), 1);
  assert.equal(bulls(15), 2);
  assert.equal(bulls(100), 3);
  assert.equal(bulls(10), 3);
  assert.equal(bulls(11), 5);
  assert.equal(bulls(99), 5);
  assert.equal(bulls(55), 7);
  assert.equal(bulls(104), 1);
  const total = Array.from({ length: 104 }, (_, i) => bulls(i + 1)).reduce((a, b) => a + b, 0);
  assert.equal(total, 171); // total officiel des 104 cartes
  assert.equal(rowBulls([10, 11, 55]), 15);
});

test('donne : 10 cartes chacun, 4 rangées d\'une carte, toutes les cartes différentes', () => {
  for (const n of [2, 3, 6, 10]) {
    const s = setup(mkPlayers(n), {}, ctx(seeded(n)));
    assert.equal(s.hands.length, n);
    for (const h of s.hands) {
      assert.equal(h.length, HAND);
      assert.deepEqual(h, [...h].sort((a, b) => a - b));
    }
    assert.equal(s.rows.length, 4);
    assert.ok(s.rows.every((r) => r.length === 1));
    const all = [...s.hands.flat(), ...s.rows.flat()];
    assert.equal(new Set(all).size, all.length);
    assert.ok(all.every((c) => c >= 1 && c <= 104));
    assert.deepEqual(status(s).turn, s.players);
  }
});

test('donne : le hasard fixé donne toujours la même donne', () => {
  const a = setup(mkPlayers(4), {}, ctx(seeded(42)));
  const b = setup(mkPlayers(4), {}, ctx(seeded(42)));
  const c = setup(mkPlayers(4), {}, ctx(seeded(43)));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.hands, c.hands);
});

test('réglages : seuil 33, 66 ou 99 (66 par défaut), minuteur', () => {
  assert.equal(setup(mkPlayers(2), {}, ctx()).target, 66);
  assert.equal(setup(mkPlayers(2), { target: 33 }, ctx()).target, 33);
  assert.equal(setup(mkPlayers(2), { target: 99 }, ctx()).target, 99);
  assert.equal(setup(mkPlayers(2), { target: 50 }, ctx()).target, 66);
  assert.equal(status(setup(mkPlayers(2), { timer: 0 }, ctx())).deadline, undefined);
  assert.equal(status(setup(mkPlayers(2), { timer: 30 }, ctx())).deadline, T0 + 30_000);
});

test('choisir une carte : refus si pas dans la main, déjà choisie, mauvais joueur, mauvais coup', () => {
  let s = crafted({ hands: [[5, 20], [30, 40], [50, 60]], rows: [[1], [2], [3], [4]] });
  assert.throws(() => pick(s, 1, 99), /pas dans ta main/);
  assert.throws(() => pick(s, 1, 'x'), /pas dans ta main/);
  assert.throws(() => pick(s, 9, 5), /regardes/);
  assert.throws(() => move(s, 1, { type: 'row', row: 0 }, ctx()), /Choisis une carte/);
  s = pick(s, 1, 5);
  assert.throws(() => pick(s, 1, 20), /attends les autres/);
  assert.deepEqual(status(s).turn, [2, 3]);
  assert.equal(s.hands[0].includes(5), false);
});

test('les cartes restent cachées tant que tout le monde n\'a pas choisi', () => {
  let s = crafted({ hands: [[5, 20], [30, 40], [50, 60]], rows: [[1], [2], [3], [4]] });
  s = pick(s, 1, 5);
  s = pick(s, 2, 30);
  const v = view(s, 3);
  assert.deepEqual(v.picked, [true, true, false]);
  assert.equal(JSON.stringify(v).includes('"picks"'), false);
  assert.deepEqual(v.hand, [50, 60]);
  assert.deepEqual(v.handCounts, [1, 1, 2]);
  assert.equal(JSON.stringify(v.queue), '[]');
  // Ni la main des autres, ni la carte choisie par ana (5), ni celle de bob (30) n'apparaissent dans la vue de cléo.
  assert.equal(v.hand.includes(5), false);
  const spec = view(s, null);
  assert.equal(spec.hand, null);
  assert.equal(spec.seat, -1);
  assert.deepEqual(spec.handCounts, [1, 1, 2]);
});

test('révélation : les cartes se placent dans l\'ordre croissant, sur la rangée qui finit le plus près', () => {
  let s = crafted({ hands: [[40, 1], [12, 1], [33, 1]], rows: [[10], [30], [50], [90]] });
  s = pick(s, 1, 40);
  s = pick(s, 2, 12);
  s = pick(s, 3, 33);
  // Ordre : 12 (sur 10), 33 (sur 30), 40 (sur 33, qui finit la rangée 30 → 30 33 40).
  assert.deepEqual(s.rows, [[10, 12], [30, 33, 40], [50], [90]]);
  assert.deepEqual(s.step.revealed, [{ seat: 1, card: 12 }, { seat: 2, card: 33 }, { seat: 0, card: 40 }]);
  assert.deepEqual(s.step.plays.map((p) => [p.seat, p.card, p.row]), [[1, 12, 0], [2, 33, 1], [0, 40, 1]]);
  assert.deepEqual(s.step.rowsBefore, [[10], [30], [50], [90]]);
  assert.equal(s.step.seq, 1);
  assert.equal(s.phase, 'choose');
  assert.equal(s.turnNo, 2);
  assert.deepEqual(status(s).turn, [1, 2, 3]);
  assert.deepEqual(s.heads, [0, 0, 0]);
});

test('la 6e carte d\'une rangée la fait ramasser : têtes ajoutées, la carte lance une nouvelle rangée', () => {
  let t = crafted({
    hands: [[15, 1], [99, 1], [98, 1]],
    rows: [[10, 11, 12, 13, 14], [30], [50], [90]],
    heads: [3, 0, 0],
  });
  t = pick(t, 1, 15);
  t = pick(t, 2, 99);
  t = pick(t, 3, 98);
  assert.equal(t.step.plays[0].gain, 3 + 5 + 1 + 1 + 1); // 10, 11, 12, 13, 14
  assert.equal(t.heads[0], 3 + 11);
  assert.deepEqual(t.rows[0], [15]);
});

test('carte plus petite que toutes les fins de rangée : le joueur choisit la rangée à ramasser', () => {
  let s = crafted({ hands: [[2, 100], [60, 100], [70, 100]], rows: [[10], [30, 31], [50], [90]] });
  s = pick(s, 1, 2);
  s = pick(s, 2, 60);
  s = pick(s, 3, 70);
  assert.equal(s.phase, 'row');
  assert.deepEqual(s.pending, { seat: 0, card: 2 });
  assert.deepEqual(status(s).turn, 1);
  assert.deepEqual(s.step.plays, []); // 60 et 70 attendent derrière la carte 2
  assert.deepEqual(view(s, 2).queue.map((q) => q.card), [2, 60, 70]);
  // Seul ana joue ; la rangée doit exister.
  assert.throws(() => takeRowMove(s, 2, 0), /pas ton tour/);
  assert.throws(() => takeRowMove(s, 1, 4), /n’existe pas/);
  assert.throws(() => takeRowMove(s, 1, -1), /n’existe pas/);
  assert.throws(() => move(s, 1, { type: 'pick', card: 100 }, ctx()), /Choisis la rangée/);
  s = takeRowMove(s, 1, 1); // ramasse [30, 31] : 3 + 1 = 4 têtes
  assert.equal(s.heads[0], 4);
  assert.deepEqual(s.rows[1], [2]);
  // Puis 60 (sur 50) et 70 (sur 60) sont posées.
  assert.deepEqual(s.rows[2], [50, 60, 70]);
  assert.equal(s.phase, 'choose');
  assert.deepEqual(s.step.plays.map((p) => [p.card, p.row, p.gain]), [[2, 1, 4], [60, 2, 0], [70, 2, 0]]);
  assert.equal(s.step.revealed, null);
  assert.equal(s.step.seq, 2);
  assert.deepEqual(s.step.rowsBefore, [[10], [30, 31], [50], [90]]);
});

test('une carte se pose sur la rangée dont la fin est la plus proche en dessous', () => {
  let s = crafted({ hands: [[45, 100], [90, 100], [91, 100]], rows: [[10], [30], [40], [44]] });
  s = pick(s, 1, 45);
  s = pick(s, 2, 90);
  s = pick(s, 3, 91);
  assert.deepEqual(s.rows[3], [44, 45, 90, 91]); // puis 90 et 91 à la suite
});

test('minuteur : carte au hasard pour ceux qui n\'ont pas choisi', () => {
  let s = crafted({ hands: [[5, 20, 70], [30, 40, 80], [50, 60, 90]], rows: [[1], [2], [3], [4]] }, { timer: 30 });
  s = pick(s, 1, 5);
  const t = timeout(s, ctx(() => 0.99, T0 + 31_000)).state;
  assert.equal(t.turnNo, 2);
  // random 0.99 → dernière carte de la main de bob (80) et de cléo (90).
  const played = t.step.revealed.map((r) => r.card).sort((a, b) => a - b);
  assert.deepEqual(played, [5, 80, 90]);
  assert.deepEqual(t.hands.map((h) => h.length), [2, 2, 2]);
  assert.equal(status(t).deadline, T0 + 31_000 + 30_000 + 1500 + 600 * 3);
});

test('minuteur : sans choix de rangée, la rangée la moins chère est ramassée', () => {
  let s = crafted({ hands: [[1, 100], [60, 100], [70, 100]], rows: [[11], [30, 31], [50, 55], [90]] }, { timer: 20 });
  s = pick(s, 1, 1);
  s = pick(s, 2, 60);
  s = pick(s, 3, 70);
  assert.equal(s.phase, 'row');
  assert.equal(status(s).deadline > T0, true);
  const t = timeout(s, ctx()).state;
  // Têtes : [11] = 5, [30,31] = 3 (30 → 3, 31 → 1 = 4), [50,55] = 3 + 7 = 10, [90] = 3. La moins chère : [90] (3).
  assert.deepEqual(t.rows[3], [1]);
  assert.equal(t.heads[0], 3);
});

test('rangée la moins chère : à égalité, la plus courte puis la première', () => {
  let s = crafted({ hands: [[1, 100], [60, 100], [70, 100]], rows: [[2, 3], [4], [91], [92, 93]] }, { timer: 20 });
  s = pick(s, 1, 1);
  s = pick(s, 2, 60);
  s = pick(s, 3, 70);
  // Têtes : [2,3] = 2, [4] = 1, [91] = 1, [92,93] = 2. À 1 tête : [4] et [91], même longueur : la première (rangée 1).
  const t = timeout(s, ctx()).state;
  assert.deepEqual(t.rows[1], [1]);
});

test('fin de manche sans atteindre le seuil : nouvelle donne, scores conservés', () => {
  let s = crafted({ hands: [[40], [50], [60]], rows: [[10], [20], [30], [35]], heads: [10, 20, 5] });
  s = pick(s, 1, 40);
  s = pick(s, 2, 50);
  s = pick(s, 3, 60);
  assert.equal(s.phase, 'choose');
  assert.equal(s.round, 2);
  assert.equal(s.turnNo, 1);
  assert.deepEqual(s.heads, [10, 20, 5]);
  assert.ok(s.hands.every((h) => h.length === HAND));
  assert.equal(s.rows.length, 4);
  assert.deepEqual(s.picks, [null, null, null]);
});

test('fin de partie : un joueur atteint le seuil, le moins de têtes gagne', () => {
  let s = crafted({ hands: [[40], [50], [60]], rows: [[10], [20], [30], [35]], heads: [10, 66, 5] });
  s = pick(s, 1, 40);
  s = pick(s, 2, 50);
  s = pick(s, 3, 60);
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s), { turn: null, over: true, winners: [3] });
  assert.throws(() => pick(s, 1, 1), /terminée/);
});

test('fin de partie : ex æquo au plus petit score', () => {
  let s = crafted({ hands: [[40], [50], [60]], rows: [[10], [20], [30], [35]], heads: [4, 70, 4] });
  s = pick(s, 1, 40);
  s = pick(s, 2, 50);
  s = pick(s, 3, 60);
  assert.deepEqual(status(s).winners, [1, 3]);
});

test('fin de partie : le seuil dépend de l\'option', () => {
  const run = (target, heads) => {
    let s = crafted({ hands: [[40], [50], [60]], rows: [[10], [20], [30], [35]], heads }, { target });
    s = pick(s, 1, 40);
    s = pick(s, 2, 50);
    return pick(s, 3, 60);
  };
  assert.equal(run(33, [33, 0, 0]).phase, 'over');
  assert.equal(run(33, [32, 0, 0]).phase, 'choose');
  assert.equal(run(99, [66, 0, 0]).phase, 'choose');
  assert.equal(run(99, [99, 0, 0]).phase, 'over');
});

test('le seuil n\'est vérifié qu\'à la fin de la manche', () => {
  // Ana ramasse une rangée au tour 1 de la manche et passe le seuil, mais la manche continue.
  let s = crafted({
    hands: [[15, 16], [90, 91], [92, 93]],
    rows: [[10, 11, 12, 13, 14], [30], [50], [95]],
    heads: [60, 0, 0],
  });
  s = pick(s, 1, 15);
  s = pick(s, 2, 90);
  s = pick(s, 3, 92);
  assert.ok(s.heads[0] > 66);
  assert.equal(s.phase, 'choose');
  assert.equal(s.turnNo, 2);
});

test('abandon : ses cartes sortent, la partie continue à plusieurs', () => {
  let s = crafted({ hands: [[40, 41], [50, 51], [60, 61]], rows: [[10], [20], [30], [35]] });
  s = pick(s, 1, 40);
  s = leave(s, 1, ctx()).state;
  assert.deepEqual(s.left, [true, false, false]);
  assert.deepEqual(s.hands[0], []);
  assert.equal(s.picks[0], null);
  assert.deepEqual(status(s).turn, [2, 3]);
  assert.throws(() => pick(s, 1, 41), /regardes/);
  s = pick(s, 2, 50);
  s = pick(s, 3, 60); // ana n'est plus attendue : la révélation a lieu
  assert.equal(s.turnNo, 2);
  assert.deepEqual(s.step.revealed.map((r) => r.card), [50, 60]);
  assert.equal(s.phase, 'choose');
});

test('abandon : quand tous les autres avaient déjà choisi, le tour se joue tout de suite', () => {
  let s = crafted({ hands: [[40, 41], [50, 51], [60, 61]], rows: [[10], [20], [30], [35]] });
  s = pick(s, 2, 50);
  s = pick(s, 3, 60);
  s = leave(s, 1, ctx()).state;
  assert.equal(s.turnNo, 2);
  assert.deepEqual(s.step.revealed.map((r) => r.card), [50, 60]);
  assert.deepEqual(status(s).turn, [2, 3]);
});

test('abandon : celui qui devait choisir une rangée s\'en va, les autres cartes sont posées', () => {
  let s = crafted({ hands: [[1, 100], [60, 100], [70, 100]], rows: [[10], [30], [50], [90]] });
  s = pick(s, 1, 1);
  s = pick(s, 2, 60);
  s = pick(s, 3, 70);
  assert.equal(s.phase, 'row');
  s = leave(s, 1, ctx()).state;
  assert.equal(s.phase, 'choose');
  assert.deepEqual(s.rows[2], [50, 60, 70]);
  assert.deepEqual(s.heads, [0, 0, 0]);
  assert.equal(s.turnNo, 2);
  assert.deepEqual(status(s).turn, [2, 3]);
});

test('abandon d\'un joueur dont la carte basse attend derrière une autre carte basse', () => {
  let s = crafted({ hands: [[1, 100], [2, 100], [60, 100]], rows: [[10], [30], [50], [90]] });
  s = pick(s, 1, 1);
  s = pick(s, 2, 2);
  s = pick(s, 3, 60);
  assert.deepEqual(s.pending, { seat: 0, card: 1 });
  s = leave(s, 2, ctx()).state; // bob part pendant que ana doit choisir : sa carte 2 sort de la file
  assert.deepEqual(s.queue.map((q) => q.card), [1, 60]);
  assert.equal(s.phase, 'row');
  s = takeRowMove(s, 1, 0);
  assert.equal(s.phase, 'choose');
  assert.deepEqual(s.rows[2], [50, 60]);
});

test('abandon à deux : l\'autre gagne', () => {
  let s = setup(mkPlayers(2), {}, ctx(seeded(5)));
  s = leave(s, 2, ctx()).state;
  assert.deepEqual(status(s), { turn: null, over: true, winners: [1] });
  assert.equal(s.forfeit, 2);
});

test('abandon : un joueur parti ne peut plus gagner, même avec le moins de têtes', () => {
  let s = crafted({ hands: [[40], [50], [60]], rows: [[10], [20], [30], [35]], heads: [0, 66, 7] });
  s = leave(s, 1, ctx()).state;
  s = pick(s, 2, 50);
  s = pick(s, 3, 60);
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s).winners, [3]);
});

test('abandon : à la fin de manche, la nouvelle donne ne distribue rien au joueur parti', () => {
  let s = crafted({ hands: [[40], [50], [60]], rows: [[10], [20], [30], [35]], heads: [0, 5, 7] });
  s = leave(s, 1, ctx()).state;
  s = pick(s, 2, 50);
  s = pick(s, 3, 60);
  assert.equal(s.round, 2);
  assert.deepEqual(s.hands[0], []);
  assert.equal(s.hands[1].length, HAND);
  assert.deepEqual(status(s).turn, [2, 3]);
});

test('partie complète à 4 joueurs : dix tours, dix cartes jouées, jusqu\'à la fin', () => {
  const rnd = seeded(2024);
  let s = setup(mkPlayers(4), { target: 33 }, ctx(rnd));
  let guard = 0;
  while (status(s).over === false && guard < 2000) {
    guard += 1;
    const st = status(s);
    if (s.phase === 'row') {
      s = takeRowMove(s, st.turn, Math.floor(rnd() * 4));
    } else {
      const id = st.turn[0];
      const seat = s.players.indexOf(id);
      s = pick(s, id, s.hands[seat][0]);
    }
    const all = [...s.hands.flat(), ...s.rows.flat(), ...s.picks.filter((c) => c !== null), ...s.queue.map((q) => q.card)];
    assert.equal(new Set(all).size, all.length); // jamais de carte en double
  }
  assert.equal(status(s).over, true);
  assert.ok(Math.max(...s.heads) >= 33);
  assert.ok(status(s).winners.length >= 1);
});

test('l\'état reste du JSON pur et n\'est jamais modifié', () => {
  const s = crafted({ hands: [[1, 100], [60, 100], [70, 100]], rows: [[10], [30], [50], [90]] });
  const copy = JSON.stringify(s);
  pick(s, 1, 1);
  timeout(s, ctx());
  leave(s, 2, ctx());
  assert.equal(JSON.stringify(s), copy);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});
