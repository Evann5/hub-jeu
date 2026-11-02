import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, move, view, status, timeout, leave, makeSet, sidesFor, place, endsOf, playableTiles, pips, handSize, tileId,
} from './rules.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ctx = (seed = 1, now = 1_000_000) => ({ now, random: rng(seed) });
const people = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `p${i + 1}` }));
const mk = (n, options = {}, seed = 1) => setup(people(n), { target: 100, timer: 0, ...options }, ctx(seed));
const act = (s, seat, action, c = ctx()) => move(s, seat + 1, action, c).state;

// Manche fabriquée : mains, chaîne et pioche au choix.
function manche(n, hands, { chain = [[6, 6]], turn = 1, stock = [], extra = {} } = {}) {
  const base = mk(n);
  return { ...base, hands, chain, turn, stock, passes: 0, ...extra };
}

test('le jeu complet compte 28 dominos différents', () => {
  const set = makeSet();
  assert.equal(set.length, 28);
  assert.equal(new Set(set).size, 28);
  assert.equal(set.reduce((s, id) => s + pips(id), 0), 168);
});

test('distribution : 7 chacun à deux (pioche de 14), 6 chacun à trois (pioche de 10) et quatre (pas de pioche)', () => {
  assert.equal(handSize(2), 7);
  assert.equal(handSize(3), 6);
  assert.equal(handSize(4), 6);
  // Après l'ouverture, le joueur qui a ouvert a un domino de moins.
  for (const [n, stock] of [[2, 14], [3, 10], [4, 0]]) {
    const s = mk(n);
    const total = s.hands.reduce((sum, h) => sum + h.length, 0) + s.stock.length + s.chain.length;
    assert.equal(s.stock.length, stock, `${n} joueurs`);
    assert.equal(s.chain.length, 1);
    assert.equal(total, n === 4 ? 24 : 28);
    const all = [...s.hands.flat(), ...s.stock, tileId(...s.chain[0])];
    assert.equal(new Set(all).size, all.length);
  }
});

test('le plus gros double ouvre la manche', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const s = mk(2, {}, seed);
    const opener = s.lastMove.seat;
    const [a, b] = s.chain[0];
    assert.equal(a, b);
    // Aucun double plus fort dans les mains
    for (const h of s.hands) for (const id of h) if (id.split('-')[0] === id.split('-')[1]) assert.ok(Number(id[0]) < a, `seed ${seed}: ${id} > ${a}-${a}`);
    assert.equal(s.turn, (opener + 1) % 2);
    assert.equal(s.lastMove.kind, 'open');
  }
});

// Hasard truqué : fait sortir du mélange l'ordre voulu (Fisher-Yates à l'envers), en boucle.
function rigged(order) {
  const calls = [];
  const a = makeSet();
  for (let i = a.length - 1; i > 0; i--) {
    const j = a.indexOf(order[i]);
    [a[i], a[j]] = [a[j], a[i]];
    calls.push((j + 0.5) / (i + 1));
  }
  let k = 0;
  return () => calls[k++ % calls.length];
}

test('sans aucun double dans les mains, le domino le plus lourd ouvre', () => {
  const doubles = makeSet().filter((id) => id[0] === id[2]);
  const others = makeSet().filter((id) => id[0] !== id[2]);
  const random = rigged([...others, ...doubles]);
  const s = setup(people(2), { target: 100 }, { now: 0, random });
  // 14 premiers dominos sans double : la place 0 a les 7 premiers, la place 1 les 7 suivants ; le plus lourd est 1-6 (7)
  assert.deepEqual(s.chain, [[1, 6]]);
  assert.equal(s.lastMove.tile, '1-6');
  assert.equal(s.hands[0].length + s.hands[1].length, 13);
});

test('les côtés où un domino peut se poser', () => {
  const chain = [[2, 3], [3, 5]]; // bouts : 2 et 5
  assert.deepEqual(sidesFor('2-5', chain), ['left', 'right']);
  assert.deepEqual(sidesFor('2-2', chain), ['left']);
  assert.deepEqual(sidesFor('5-6', chain), ['right']);
  assert.deepEqual(sidesFor('0-1', chain), []);
  assert.deepEqual(endsOf(chain), [2, 5]);
  assert.deepEqual(playableTiles(['0-1', '5-6'], chain), [{ tile: '5-6', sides: ['right'] }]);
});

test('poser aux deux bouts retourne le domino pour que les chiffres se touchent', () => {
  let chain = [[6, 6]];
  chain = place(chain, '1-6', 'right');
  assert.deepEqual(chain, [[6, 6], [6, 1]]);
  chain = place(chain, '2-6', 'left');
  assert.deepEqual(chain, [[2, 6], [6, 6], [6, 1]]);
  chain = place(chain, '1-3', 'right');
  assert.deepEqual(chain, [[2, 6], [6, 6], [6, 1], [1, 3]]);
  chain = place(chain, '0-2', 'left');
  assert.deepEqual(chain, [[0, 2], [2, 6], [6, 6], [6, 1], [1, 3]]);
  assert.deepEqual(endsOf(chain), [0, 3]);
});

test('coup normal : un domino posé sur la chaîne, la main et le tour avancent', () => {
  let s = manche(2, [['1-2', '3-4'], ['6-1', '0-2', '5-5']], { chain: [[6, 6]], turn: 1 });
  s = act(s, 1, { type: 'play', tile: '6-1', side: 'right' });
  assert.deepEqual(s.chain, [[6, 6], [6, 1]]);
  assert.equal(s.turn, 0);
  assert.equal(s.hands[1].length, 2);
  assert.equal(s.lastMove.kind, 'play');
  s = act(s, 0, { type: 'play', tile: '1-2' });
  assert.deepEqual(s.chain, [[6, 6], [6, 1], [1, 2]]);
});

test('choix du bout obligatoire quand le domino va des deux côtés', () => {
  const s = manche(2, [['2-5', '3-4'], ['1-1', '0-0']], { chain: [[2, 3], [3, 5]], turn: 0 });
  assert.throws(() => act(s, 0, { type: 'play', tile: '2-5' }), /Choisis le bout/);
  const left = act(s, 0, { type: 'play', tile: '2-5', side: 'left' });
  assert.deepEqual(endsOf(left.chain), [5, 5]);
  const right = act(s, 0, { type: 'play', tile: '2-5', side: 'right' });
  assert.deepEqual(endsOf(right.chain), [2, 2]);
});

test('un seul côté possible : le côté est choisi tout seul, un mauvais côté est refusé', () => {
  const s = manche(2, [['5-6', '3-4'], ['1-1', '0-0']], { chain: [[2, 3], [3, 5]], turn: 0 });
  const t = act(s, 0, { type: 'play', tile: '5-6' });
  assert.deepEqual(endsOf(t.chain), [2, 6]);
  assert.throws(() => act(s, 0, { type: 'play', tile: '5-6', side: 'left' }), /pas de ce côté/);
});

test('un domino qui ne va pas, ou qui n’est pas dans la main, est refusé', () => {
  const s = manche(2, [['0-1', '3-4'], ['1-1', '0-0']], { chain: [[2, 3], [3, 5]], turn: 0 });
  assert.throws(() => act(s, 0, { type: 'play', tile: '0-1' }), /bouts de la chaîne sont 2 et 5/);
  assert.throws(() => act(s, 0, { type: 'play', tile: '6-6' }), /pas dans ta main/);
  assert.throws(() => act(s, 1, { type: 'play', tile: '1-1' }), /pas ton tour/);
});

test('pioche : refusée si on peut jouer, puis tire jusqu’à pouvoir jouer', () => {
  const s = manche(2, [['0-1', '2-4'], ['6-6']], { chain: [[2, 3], [3, 5]], turn: 0, stock: ['0-4', '1-1', '2-6', '4-4'] });
  // 2-4 se pose : on ne peut pas piocher ; la pioche n'est pas vide : on ne peut pas passer
  assert.throws(() => act(s, 0, { type: 'draw' }), /Tu peux jouer/);
  const s2 = manche(2, [['0-1', '0-0'], ['6-6']], { chain: [[2, 3], [3, 5]], turn: 0, stock: ['0-4', '1-1', '2-6', '4-4'] });
  assert.throws(() => act(s2, 0, { type: 'pass' }), /Pioche d’abord/);
  const t = act(s2, 0, { type: 'draw' });
  assert.deepEqual(t.hands[0], ['0-1', '0-0', '0-4', '1-1', '2-6']);
  assert.deepEqual(t.stock, ['4-4']);
  assert.equal(t.turn, 0); // c'est toujours à lui de jouer
  assert.equal(t.lastMove.kind, 'draw');
  assert.equal(t.lastMove.count, 3);
});

test('pioche vide : on passe', () => {
  let s = manche(2, [['0-1', '0-0'], ['3-6']], { chain: [[2, 3], [3, 5]], turn: 0, stock: ['0-4'] });
  s = act(s, 0, { type: 'draw' });
  assert.equal(s.stock.length, 0);
  assert.equal(s.turn, 0);
  assert.throws(() => act(s, 0, { type: 'draw' }), /pioche est vide/);
  s = act(s, 0, { type: 'pass' });
  assert.equal(s.turn, 1);
  assert.equal(s.lastMove.kind, 'pass');
  assert.equal(s.passes, 1);
});

test('à quatre joueurs : pas de pioche, on passe', () => {
  const s = manche(4, [['0-1'], ['3-6'], ['4-4'], ['1-1']], { chain: [[2, 3], [3, 5]], turn: 0 });
  assert.throws(() => act(s, 0, { type: 'draw' }), /pas de pioche/);
  const t = act(s, 0, { type: 'pass' });
  assert.equal(t.turn, 1);
  assert.equal(view(s, 1).draw, false);
  assert.equal(view(s, 1).mustPass, true);
  assert.equal(view(s, 1).canDraw, false);
});

test('on ne passe pas quand on peut jouer', () => {
  const s = manche(4, [['2-6'], ['3-6'], ['4-4'], ['1-1']], { chain: [[2, 3], [3, 5]], turn: 0 });
  assert.throws(() => act(s, 0, { type: 'pass' }), /Tu peux jouer/);
});

test('manche gagnée en vidant sa main : la somme des points restants des autres', () => {
  const s = manche(3, [['2-5'], ['6-6', '1-0'], ['3-4', '0-0', '5-5']], { chain: [[2, 3], [3, 5]], turn: 0 });
  const t = act(s, 0, { type: 'play', tile: '2-5', side: 'left' });
  assert.equal(t.phase, 'recap');
  assert.equal(t.recap.kind, 'domino');
  assert.equal(t.recap.winner, 0);
  assert.deepEqual(t.recap.points, [0, 13, 17]);
  assert.deepEqual(t.recap.gained, [30, 0, 0]);
  assert.deepEqual(t.scores, [30, 0, 0]);
});

test('partie bloquée : le moins de points gagne la somme des points des autres', () => {
  // Chaîne dont les deux bouts sont des 1 ; personne n'a de 1.
  let s = manche(3, [['5-6', '4-4'], ['3-3', '6-6'], ['2-2', '3-4']], { chain: [[1, 2], [2, 1]], turn: 0 });
  s = act(s, 0, { type: 'pass' });
  s = act(s, 1, { type: 'pass' });
  assert.equal(s.phase, 'play');
  s = act(s, 2, { type: 'pass' });
  assert.equal(s.phase, 'recap');
  assert.equal(s.recap.kind, 'blocked');
  assert.deepEqual(s.recap.points, [19, 18, 11]);
  assert.equal(s.recap.winner, 2);
  assert.deepEqual(s.recap.gained, [0, 0, 37]);
});

test('partie bloquée à égalité de points : manche nulle', () => {
  let s = manche(2, [['4-6'], ['5-5']], { chain: [[1, 2], [2, 1]], turn: 0, stock: [] });
  s = act(s, 0, { type: 'pass' });
  s = act(s, 1, { type: 'pass' });
  assert.equal(s.recap.winner, null);
  assert.deepEqual(s.recap.gained, [0, 0]);
  assert.deepEqual(s.scores, [0, 0]);
});

test('un coup casse le blocage : le compte des passes repart de zéro', () => {
  let s = manche(3, [['5-6'], ['1-6'], ['4-4']], { chain: [[1, 2], [2, 2]], turn: 0 });
  s = act(s, 0, { type: 'pass' });
  assert.equal(s.passes, 1);
  s = act(s, 1, { type: 'play', tile: '1-6', side: 'left' });
  assert.equal(s.passes, 0);
});

test('manche suivante : tout le monde confirme, les points sont gardés, nouvelle donne', () => {
  let s = manche(2, [['2-5'], ['6-6', '1-0']], { chain: [[2, 3], [3, 5]], turn: 0 });
  s = act(s, 0, { type: 'play', tile: '2-5', side: 'left' });
  assert.deepEqual(status(s).turn, [1, 2]);
  assert.throws(() => act(s, 0, { type: 'play', tile: '2-5' }), /Manche suivante/);
  s = act(s, 0, { type: 'next' });
  assert.deepEqual(status(s).turn, [2]);
  s = act(s, 1, { type: 'next' });
  assert.equal(s.phase, 'play');
  assert.equal(s.handNo, 2);
  assert.deepEqual(s.scores, [13, 0]);
  assert.equal(s.chain.length, 1);
});

test('la manche suivante démarre toute seule à l’échéance', () => {
  let s = manche(2, [['2-5'], ['6-6', '1-0']], { chain: [[2, 3], [3, 5]], turn: 0 });
  s = act(s, 0, { type: 'play', tile: '2-5', side: 'left' }, ctx(1, 5_000_000));
  assert.equal(status(s).deadline, 5_030_000);
  assert.equal(timeout(s, ctx(2, 5_031_000)).state.handNo, 2);
});

test('fin de partie : au seuil de 100 points', () => {
  const s = manche(2, [['2-5'], ['6-6', '1-0']], { chain: [[2, 3], [3, 5]], turn: 0, extra: { scores: [90, 40] } });
  const t = act(s, 0, { type: 'play', tile: '2-5', side: 'left' });
  assert.equal(t.phase, 'over');
  assert.equal(t.winner, 0);
  assert.deepEqual(status(t), { turn: null, over: true, winners: [1], deadline: null });
  assert.throws(() => act(t, 1, { type: 'next' }), /terminée/);
});

test('l’option 50 points termine plus vite, 100 est la valeur par défaut', () => {
  assert.equal(mk(2, { target: 50 }).target, 50);
  assert.equal(mk(2, { target: 999 }).target, 100);
  const s = manche(2, [['2-5'], ['6-6', '1-0']], { chain: [[2, 3], [3, 5]], turn: 0, extra: { target: 50, scores: [40, 0] } });
  assert.equal(act(s, 0, { type: 'play', tile: '2-5', side: 'left' }).phase, 'over');
});

test('la vue cache les dominos des autres et donne les coups possibles', () => {
  const s = manche(2, [['2-5', '0-1'], ['6-6', '1-0']], { chain: [[2, 3], [3, 5]], turn: 0, stock: ['4-4'] });
  const v = view(s, 1);
  assert.deepEqual(v.hand, ['2-5', '0-1']);
  assert.deepEqual(v.counts, [2, 2]);
  assert.deepEqual(v.playable, [{ tile: '2-5', sides: ['left', 'right'] }]);
  assert.equal(v.stockCount, 1);
  assert.ok(!JSON.stringify(v).includes('6-6'));
  assert.ok(!('hands' in v) && !('stock' in v));
  const spec = view(s, null);
  assert.deepEqual(spec.hand, []);
  assert.deepEqual(spec.playable, []);
  assert.equal(spec.seat, -1);
  assert.ok(!JSON.stringify(spec).includes('2-5') || JSON.stringify(spec.chain).includes('[2,'));
  // Pas son tour : pas de coups proposés
  assert.deepEqual(view(s, 2).playable, []);
});

test('minuteur : échéance à chaque tour, le domino le plus lourd qui se pose', () => {
  const s = manche(2, [['2-6', '5-5', '1-2'], ['0-0']], { chain: [[2, 3], [3, 5]], turn: 0, extra: { timer: 30 } });
  const t = timeout(s, ctx(1, 2_000_000)).state;
  assert.equal(t.chain.length, 3);
  assert.equal(t.lastMove.tile, '5-5');
  assert.equal(t.turn, 1);
  assert.equal(t.deadline, 2_030_000);
  assert.equal(mk(2).deadline, null);
});

test('minuteur : sans coup possible il pioche puis joue, ou passe', () => {
  const s = manche(2, [['0-1', '0-0'], ['6-6']], { chain: [[2, 3], [3, 5]], turn: 0, stock: ['0-4', '2-6', '4-4'], extra: { timer: 30 } });
  const t = timeout(s, ctx()).state;
  assert.equal(t.lastMove.kind, 'play'); // a pioché 0-4 puis 2-6 et l'a joué
  assert.equal(t.lastMove.tile, '2-6');
  assert.equal(t.stock.length, 1);
  assert.equal(t.turn, 1);
  const noStock = manche(2, [['0-1', '0-0'], ['6-6']], { chain: [[2, 3], [3, 5]], turn: 0, stock: [], extra: { timer: 30 } });
  const u = timeout(noStock, ctx()).state;
  assert.equal(u.lastMove.kind, 'pass');
  assert.equal(u.turn, 1);
});

test('abandon à deux : l’autre gagne', () => {
  const s = mk(2);
  const t = leave(s, 1, ctx()).state;
  assert.equal(t.phase, 'over');
  assert.deepEqual(status(t), { turn: null, over: true, winners: [2], deadline: null });
});

test('abandon à quatre : la partie continue à trois, le tour saute le joueur parti', () => {
  let s = mk(4, {}, 3);
  const turn = s.turn;
  const t = leave(s, turn + 1, ctx()).state;
  assert.equal(t.phase, 'play');
  assert.equal(t.out[turn], true);
  assert.notEqual(t.turn, turn);
  assert.equal(t.hands[turn].length, 0);
  assert.equal(status(t).over, false);
  // Les autres continuent ; en partant à son tour tout le monde, il reste un gagnant
  let u = t;
  u = leave(u, ((u.turn + 1) % 4) + 1, ctx()).state;
  const remaining = u.out.filter((o) => !o).length;
  assert.equal(remaining, 2);
  const w = u.players.filter((_, i) => !u.out[i])[0];
  const z = leave(u, w, ctx()).state;
  assert.equal(z.phase, 'over');
  assert.equal(status(z).winners.length, 1);
});

test('abandon pendant le compte entre deux manches', () => {
  let s = manche(3, [['2-5'], ['6-6', '1-0'], ['0-0', '3-3']], { chain: [[2, 3], [3, 5]], turn: 0 });
  s = act(s, 0, { type: 'play', tile: '2-5', side: 'left' });
  s = act(s, 0, { type: 'next' });
  s = act(s, 1, { type: 'next' });
  const t = leave(s, 3, ctx()).state; // le dernier qui n'avait pas confirmé part : la manche suivante démarre
  assert.equal(t.phase, 'play');
  assert.equal(t.handNo, 2);
  assert.equal(t.hands[2].length, 0);
});

test('parties entières au hasard, de 2 à 4 joueurs, jusqu’à la fin avec des comptes justes', () => {
  for (const n of [2, 3, 4]) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const c = ctx(seed);
      let s = setup(people(n), { target: 50, timer: 15 }, c);
      let steps = 0;
      let manches = 0;
      while (s.phase !== 'over' && steps++ < 20000) {
        c.now += 1000;
        const dominos = [...s.hands.flat(), ...s.stock, ...s.chain.map(([a, b]) => tileId(a, b))];
        if (s.phase === 'play') {
          assert.equal(new Set(dominos).size, dominos.length);
          // chaîne cohérente
          for (let i = 0; i + 1 < s.chain.length; i++) assert.equal(s.chain[i][1], s.chain[i + 1][0]);
        }
        if (s.phase === 'recap') manches++;
        s = timeout(s, c).state;
      }
      assert.equal(s.phase, 'over', `n=${n} seed=${seed}`);
      assert.ok(Math.max(...s.scores) >= 50);
      assert.equal(status(s).winners.length, 1);
      assert.ok(manches >= 1);
    }
  }
});

test('l’état reste du JSON pur et rien ne mute l’état reçu', () => {
  const s = mk(2);
  const frozen = JSON.stringify(s);
  const seat = s.turn;
  const p = playableTiles(s.hands[seat], s.chain)[0];
  if (p) act(s, seat, { type: 'play', tile: p.tile, side: p.sides[0] });
  else if (s.stock.length) act(s, seat, { type: 'draw' });
  assert.equal(JSON.stringify(s), frozen);
  assert.deepEqual(JSON.parse(frozen), s);
});
