// Tests des règles de Crânes et roses : node --test games/cranes/
// Le hasard est fixé par ctx.random ; les piles sont écrites à la main quand il faut un cas précis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, status, view, timeout, leave } from './rules.js';

const ctx = (random = () => 0, now = 1_000_000) => ({ now, random });
const names = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `joueur${i + 1}` }));
const play = (s, id, action, c = ctx()) => move(s, id, action, c).state;
const place = (s, id, disc = 'rose') => play(s, id, { type: 'place', disc });

// Tout le monde a posé un disque : 1 rose chacun (le joueur 1 commence), on est à la phase de choix.
function afterFirstRound(n = 3, options = { turnTime: 60 }) {
  let s = setup(names(n), options, ctx());
  for (let id = 1; id <= n; id++) s = place(s, id);
  return s;
}

// Un défi en cours : piles choisies, `by` a parié `n`, tout le monde a passé.
function challenge(piles, by, n, options = { turnTime: 60 }) {
  let s = setup(names(Object.keys(piles).length), options, ctx());
  for (const [id, pile] of Object.entries(piles)) {
    s.pile[id] = pile.slice();
    s.own[id].roses = Math.max(s.own[id].roses, pile.filter((d) => d === 'r').length);
  }
  s.phase = 'flip';
  s.challenger = by;
  s.actor = by;
  s.bid = { by, n };
  return s;
}

test('mise en place : 3 roses et un crâne chacun, tout le monde commence par poser un disque', () => {
  const s = setup(names(4), {}, ctx());
  for (const id of [1, 2, 3, 4]) assert.deepEqual(s.own[id], { roses: 3, skull: true });
  assert.equal(s.phase, 'place1');
  assert.deepEqual(status(s), { turn: 1, over: false, winners: [], deadline: 1_000_000 + 60_000 });
  assert.throws(() => setup(names(2), {}, ctx()), /de 3 à 6/);
  assert.throws(() => setup(names(7), {}, ctx()), /de 3 à 6/);
});

test('le premier joueur est tiré au hasard', () => {
  assert.equal(setup(names(5), {}, ctx(() => 0.99)).actor, 5);
  assert.equal(setup(names(5), {}, ctx(() => 0)).actor, 1);
});

test('sans minuteur, pas d’échéance', () => {
  assert.equal(status(setup(names(3), { turnTime: 0 }, ctx())).deadline, null);
});

test('premier tour : chacun pose un disque, on ne peut pas encore parier', () => {
  let s = setup(names(3), {}, ctx());
  assert.throws(() => move(s, 1, { type: 'bid', n: 1 }, ctx()), /Pose d’abord/);
  s = place(s, 1);
  assert.equal(status(s).turn, 2);
  s = place(s, 2, 'skull');
  assert.equal(status(s).turn, 3);
  assert.equal(s.phase, 'place1');
  s = place(s, 3);
  assert.equal(s.phase, 'choose');
  assert.equal(status(s).turn, 1);
  assert.deepEqual(s.pile, { 1: ['r'], 2: ['s'], 3: ['r'] });
});

test('on ne pose que ce qu’on a en main', () => {
  const s = afterFirstRound();
  assert.throws(() => move(s, 1, { type: 'place', disc: 'cactus' }, ctx()), /rose ou le crâne/);
  const withSkull = { ...s, pile: { ...s.pile, 1: ['r', 's'] } };
  assert.throws(() => move(withSkull, 1, { type: 'place', disc: 'skull' }, ctx()), /déjà posé/);
  const noRose = { ...s, pile: { ...s.pile, 1: ['r', 'r', 'r'] } };
  assert.throws(() => move(noRose, 1, { type: 'place', disc: 'rose' }, ctx()), /plus de rose/);
  assert.throws(() => move(s, 2, { type: 'place', disc: 'rose' }, ctx()), /pas ton tour/);
});

test('à son tour : poser un autre disque ou lancer un défi', () => {
  let s = afterFirstRound();
  s = place(s, 1);
  assert.equal(s.pile[1].length, 2);
  assert.equal(status(s).turn, 2);
  assert.throws(() => move(s, 2, { type: 'ready' }, ctx()), /disque ou lance/);
  s = play(s, 2, { type: 'bid', n: 2 });
  assert.equal(s.phase, 'bid');
  assert.throws(() => move(s, 3, { type: 'place', disc: 'rose' }, ctx()), /Surenchéris/);
});

test('enchères : au moins 1, au plus les disques de la table, et il faut monter', () => {
  let s = afterFirstRound();
  assert.equal(s.pile[1].length + s.pile[2].length + s.pile[3].length, 3);
  assert.throws(() => move(s, 1, { type: 'bid', n: 0 }, ctx()), /1 au moins/);
  assert.throws(() => move(s, 1, { type: 'bid', n: 1.5 }, ctx()), /1 au moins/);
  assert.throws(() => move(s, 1, { type: 'bid', n: 4 }, ctx()), /Il n’y a que 3 disques/);
  s = play(s, 1, { type: 'bid', n: 2 });
  assert.deepEqual(s.bid, { by: 1, n: 2 });
  assert.equal(status(s).turn, 2);
  assert.throws(() => move(s, 2, { type: 'bid', n: 2 }, ctx()), /plus de 2/);
  s = play(s, 2, { type: 'bid', n: 3 });
  assert.equal(s.phase, 'flip', 'parier tous les disques lance le défi tout de suite');
  assert.equal(s.challenger, 2);
});

test('qui a passé ne joue plus ; le dernier à ne pas avoir passé retourne les disques', () => {
  let s = afterFirstRound(4);
  s = place(s, 1);
  s = place(s, 2);
  s = play(s, 3, { type: 'bid', n: 1 });
  assert.equal(status(s).turn, 4);
  s = play(s, 4, { type: 'bid', n: 2 });
  assert.equal(status(s).turn, 1);
  s = play(s, 1, { type: 'pass' });
  assert.equal(status(s).turn, 2);
  s = play(s, 2, { type: 'pass' });
  assert.equal(status(s).turn, 3, '3 a parié 1 mais n’a pas passé : il peut encore monter');
  s = play(s, 3, { type: 'pass' });
  assert.equal(s.phase, 'flip');
  assert.equal(s.challenger, 4);
  assert.deepEqual(status(s).turn, 4);
  assert.throws(() => move(s, 4, { type: 'bid', n: 5 }, ctx()), /retourne/i);
});

test('défi : on retourne d’abord toute sa pile', () => {
  let s = challenge({ 1: ['r', 'r'], 2: ['r'], 3: ['r'] }, 1, 3);
  assert.throws(() => move(s, 1, { type: 'flip', target: 2 }, ctx()), /d’abord toute ta pile/);
  s = play(s, 1, { type: 'flip', target: 1 });
  assert.equal(s.revealed[1], 2);
  assert.equal(s.phase, 'flip');
  assert.throws(() => move(s, 1, { type: 'flip', target: 1 }, ctx()), /autre joueur/);
  assert.throws(() => move(s, 1, { type: 'flip', target: 9 }, ctx()), /autre joueur/);
  s = play(s, 1, { type: 'flip', target: 3 });
  assert.equal(s.phase, 'result', '3 disques retournés sans crâne : défi réussi');
  assert.equal(s.score[1], 1);
  assert.deepEqual(s.result, { kind: 'success', challenger: 1, n: 3 });
});

test('une pile retournée en entier ne peut plus l’être', () => {
  let s = challenge({ 1: ['r'], 2: ['r'], 3: ['r', 'r'] }, 1, 4);
  s.own[1].roses = 3;
  s = play(s, 1, { type: 'flip', target: 1 });
  s = play(s, 1, { type: 'flip', target: 2 });
  assert.throws(() => move(s, 1, { type: 'flip', target: 2 }, ctx()), /déjà retournée/);
  s = play(s, 1, { type: 'flip', target: 3 });
  assert.equal(s.revealed[3], 1, 'on retourne le disque du dessus');
  s = play(s, 1, { type: 'flip', target: 3 });
  assert.equal(s.phase, 'result');
});

test('on retourne le dessus de la pile des autres, un disque à la fois', () => {
  // Pile du joueur 2, du dessous au dessus : crâne, rose. Le dessus est la rose.
  let s = challenge({ 1: ['r'], 2: ['s', 'r'], 3: ['r'] }, 1, 3);
  s = play(s, 1, { type: 'flip', target: 1 });
  s = play(s, 1, { type: 'flip', target: 2 });
  assert.equal(s.phase, 'flip');
  assert.deepEqual(s.log.at(-1), { t: 'flip', who: 1, of: 2, disc: 'r' });
  s = play(s, 1, { type: 'flip', target: 2 });
  assert.equal(s.phase, 'result');
  assert.equal(s.result.kind, 'fail');
  assert.equal(s.result.skullOwner, 2);
});

test('crâne d’un autre : le défieur perd un disque tiré au hasard, personne d’autre ne sait lequel', () => {
  // Hasard 0 : le premier disque de la liste (une rose) ; hasard 0.99 : le dernier (le crâne).
  const base = () => challenge({ 1: ['r'], 2: ['s'], 3: ['r'] }, 1, 2);
  let s = play(play(base(), 1, { type: 'flip', target: 1 }), 1, { type: 'flip', target: 2 }, ctx(() => 0));
  assert.deepEqual(s.own[1], { roses: 2, skull: true });
  assert.equal(view(s, 1).lost, 'rose');
  assert.equal(view(s, 2).lost, null);
  assert.equal(view(s, null).lost, null);
  assert.equal(view(s, 3).discs[1], 3);
  s = play(play(base(), 1, { type: 'flip', target: 1 }), 1, { type: 'flip', target: 2 }, ctx(() => 0.99));
  assert.deepEqual(s.own[1], { roses: 3, skull: false });
  assert.equal(view(s, 1).lost, 'skull');
  const seen = JSON.stringify(view(s, 2));
  assert.ok(!seen.includes('"lost":"skull"') && !seen.includes('"lost":"rose"'));
  assert.equal(s.phase, 'result');
  assert.equal(s.next, 1, 'le défieur recommence');
  assert.equal(s.score[1], 0);
});

test('son propre crâne : défi raté, un disque perdu au hasard', () => {
  let s = challenge({ 1: ['s', 'r'], 2: ['r'], 3: ['r'] }, 1, 2);
  s = play(s, 1, { type: 'flip', target: 1 }, ctx(() => 0));
  assert.equal(s.result.kind, 'fail');
  assert.equal(s.result.skullOwner, 1);
  assert.equal(s.revealed[1], 2, 'la pile est retournée du dessus vers le dessous jusqu’au crâne');
  assert.equal(s.own[1].roses + (s.own[1].skull ? 1 : 0), 3);
});

test('un disque perdu ne revient pas à la manche suivante', () => {
  let s = challenge({ 1: ['r'], 2: ['s'], 3: ['r'] }, 1, 2);
  s = play(play(s, 1, { type: 'flip', target: 1 }), 1, { type: 'flip', target: 2 }, ctx(() => 0.99));
  for (const id of [1, 2, 3]) s = play(s, id, { type: 'ready' });
  assert.equal(s.round, 2);
  assert.equal(s.phase, 'place1');
  assert.deepEqual(s.pile, { 1: [], 2: [], 3: [] });
  assert.deepEqual(view(s, 1).hand, { roses: 3, skull: false });
  assert.deepEqual(view(s, 2).hand, { roses: 3, skull: true });
  assert.throws(() => place(s, 1, 'skull'), /déjà posé/);
  assert.equal(s.actor, 1, 'celui qui a défié recommence');
});

test('après un défi, la pause se termine quand tout le monde est prêt, ou au minuteur', () => {
  let s = challenge({ 1: ['r'], 2: ['r'], 3: ['r'] }, 1, 1);
  s = play(s, 1, { type: 'flip', target: 1 });
  assert.equal(s.phase, 'result');
  assert.deepEqual(status(s).turn, [1, 2, 3]);
  assert.equal(status(s).deadline, 1_000_000 + 12_000);
  s = play(s, 2, { type: 'ready' });
  s = play(s, 2, { type: 'ready' });
  assert.deepEqual(status(s).turn, [1, 3]);
  assert.throws(() => move(s, 1, { type: 'place', disc: 'rose' }, ctx()), /impossible/);
  s = timeout(s, ctx()).state;
  assert.equal(s.round, 2);
  assert.equal(s.actor, 1);
});

test('deux défis réussis : victoire', () => {
  let s = challenge({ 1: ['r'], 2: ['r'], 3: ['r'] }, 2, 1);
  s.score[2] = 1;
  s = play(s, 2, { type: 'flip', target: 2 });
  assert.deepEqual(status(s), { turn: null, over: true, winners: [2], deadline: null });
  assert.equal(s.score[2], 2);
  assert.throws(() => move(s, 1, { type: 'ready' }, ctx()), /terminée/);
  // La partie finie, on voit les piles des autres.
  assert.equal(view(s, 1).piles[3][0].k, 'r');
});

test('perdre son dernier disque élimine ; le propriétaire du crâne commence la manche suivante', () => {
  let s = challenge({ 1: ['r'], 2: ['s'], 3: ['r'] }, 1, 2);
  s.own[1] = { roses: 1, skull: false };
  s = play(play(s, 1, { type: 'flip', target: 1 }), 1, { type: 'flip', target: 2 });
  assert.equal(s.result.eliminated, true);
  assert.deepEqual(s.out, [1]);
  assert.equal(s.phase, 'result');
  assert.deepEqual(status(s).turn, [2, 3], 'un éliminé n’est plus attendu');
  s = play(s, 2, { type: 'ready' });
  s = play(s, 3, { type: 'ready' });
  assert.equal(s.round, 2);
  assert.equal(s.actor, 2);
  assert.throws(() => move(s, 1, { type: 'ready' }, ctx()), /éliminé/);
  s = place(s, 2);
  assert.equal(status(s).turn, 3, 'le joueur éliminé est sauté');
  assert.equal(view(s, 1).hand, null);
});

test('éliminé par son propre crâne : le joueur suivant commence', () => {
  let s = challenge({ 1: ['s'], 2: ['r'], 3: ['r'] }, 1, 1);
  s.own[1] = { roses: 0, skull: true };
  s = play(s, 1, { type: 'flip', target: 1 });
  assert.equal(s.result.eliminated, true);
  assert.equal(s.next, 2);
});

test('le dernier joueur avec des disques gagne', () => {
  let s = challenge({ 1: ['r'], 2: ['s'], 3: ['r'] }, 1, 2);
  s.own[1] = { roses: 1, skull: false };
  s.out = [3];
  s.own[3] = { roses: 0, skull: false };
  s = play(play(s, 1, { type: 'flip', target: 1 }), 1, { type: 'flip', target: 2 });
  assert.deepEqual(status(s), { turn: null, over: true, winners: [2], deadline: null });
});

test('view : mes disques oui, ceux des autres seulement quand ils sont retournés', () => {
  let s = afterFirstRound();
  s.pile[2] = ['r', 's'];
  s.pile[3] = ['r'];
  const v1 = view(s, 1);
  assert.deepEqual(v1.piles[1], [{ up: false, k: 'r' }]);
  assert.deepEqual(v1.piles[2], [{ up: false, k: null }, { up: false, k: null }]);
  assert.deepEqual(v1.hand, { roses: 2, skull: true });
  const spec = JSON.stringify(view(s, null));
  assert.ok(!spec.includes('"k":"s"') && !spec.includes('"k":"r"'));
  assert.equal(view(s, null).hand, null);
  assert.equal(v1.total, 4);
  assert.ok(!('own' in v1) && !('pile' in v1));
  // Un disque retourné devient visible pour tous.
  s = { ...s, phase: 'flip', challenger: 1, bid: { by: 1, n: 3 }, revealed: { 1: 1, 2: 1, 3: 0 } };
  assert.deepEqual(view(s, 3).piles[2], [{ up: false, k: null }, { up: true, k: 's' }]);
  assert.equal(view(s, 3).flipped, 2);
});

// ——— Minuteurs ———

test('minuteur : au premier tour, on pose une rose', () => {
  let s = setup(names(3), {}, ctx());
  s = timeout(s, ctx()).state;
  assert.deepEqual(s.pile[1], ['r']);
  assert.equal(s.actor, 2);
});

test('minuteur : on pose une rose si on peut, sinon on parie 1 ; en enchère on passe', () => {
  let s = afterFirstRound();
  s = timeout(s, ctx()).state;
  assert.deepEqual(s.pile[1], ['r', 'r']);
  let t = afterFirstRound();
  t.pile[1] = ['r', 'r', 'r'];
  t = timeout(t, ctx()).state;
  assert.deepEqual(t.bid, { by: 1, n: 1 });
  assert.equal(t.phase, 'bid');
  t = timeout(t, ctx()).state;
  assert.deepEqual(t.passed, [2]);
  t = timeout(t, ctx()).state;
  assert.equal(t.phase, 'flip');
  assert.equal(t.challenger, 1);
});

test('minuteur d’un défi : sa pile d’abord, puis une pile au hasard', () => {
  let s = challenge({ 1: ['r'], 2: ['r'], 3: ['r'] }, 1, 3);
  s = timeout(s, ctx()).state;
  assert.equal(s.revealed[1], 1);
  s = timeout(s, ctx(() => 0.99)).state;
  assert.equal(s.revealed[3], 1);
  assert.equal(s.revealed[2], 0);
  s = timeout(s, ctx()).state;
  assert.equal(s.score[1], 1);
});

// ——— Abandon ———

test('abandon pendant son tour : ses disques disparaissent, le tour passe', () => {
  let s = setup(names(4), {}, ctx());
  s = leave(s, 1, ctx()).state;
  assert.deepEqual(s.out, [1]);
  assert.deepEqual(s.left, [1]);
  assert.equal(s.actor, 2);
  s = place(place(place(s, 2), 3), 4);
  assert.equal(s.phase, 'choose');
  assert.equal(s.actor, 2);
});

test('abandon pendant les enchères : la manche est annulée, sans point ni perte', () => {
  let s = afterFirstRound(4);
  s = play(s, 1, { type: 'bid', n: 2 });
  s = leave(s, 3, ctx()).state;
  assert.equal(s.phase, 'place1');
  assert.equal(s.round, 2);
  assert.deepEqual(s.pile[1], []);
  assert.deepEqual(s.score, { 1: 0, 2: 0, 3: 0, 4: 0 });
  assert.equal(s.own[1].roses, 3);
});

test('abandon d’un joueur qui n’a pas encore posé au premier tour', () => {
  let s = setup(names(3), {}, ctx());
  s = place(s, 1);
  s = leave(s, 3, ctx()).state;
  assert.equal(s.phase, 'place1');
  s = place(s, 2);
  assert.equal(s.phase, 'choose');
  assert.equal(s.actor, 1);
});

test('abandon à trois puis à deux : le dernier gagne', () => {
  let s = setup(names(3), {}, ctx());
  s = leave(s, 1, ctx()).state;
  s = leave(s, 2, ctx()).state;
  assert.deepEqual(status(s), { turn: null, over: true, winners: [3], deadline: null });
});

test('abandon pendant la pause : on n’attend plus ce joueur', () => {
  let s = challenge({ 1: ['r'], 2: ['r'], 3: ['r'] }, 1, 1);
  s = play(s, 1, { type: 'flip', target: 1 });
  s = play(s, 1, { type: 'ready' });
  s = play(s, 2, { type: 'ready' });
  s = leave(s, 3, ctx()).state;
  assert.equal(s.round, 2);
});

// ——— Parties au hasard ———

test('300 parties au hasard, de 3 à 6 joueurs : toujours finies, aucun disque inventé, rien de caché qui fuit', () => {
  for (let game = 0; game < 300; game++) {
    let seed = game * 104729 + 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const n = 3 + (game % 4);
    let s = setup(names(n), { turnTime: 30 }, ctx(rnd));
    let steps = 0;
    while (!status(s).over) {
      assert.ok(steps++ < 3000, `partie ${game} trop longue`);
      const st = status(s);
      const ids = [].concat(st.turn);
      const who = ids[Math.floor(rnd() * ids.length)];
      const pick = (list) => list[Math.floor(rnd() * list.length)];
      const hand = view(s, who).hand;
      let action;
      if (s.phase === 'place1') action = { type: 'place', disc: hand.roses > 0 && (!hand.skull || rnd() < 0.6) ? 'rose' : 'skull' };
      else if (s.phase === 'choose') {
        const total = view(s, who).total;
        action = rnd() < 0.5 && (hand.roses || hand.skull) ? { type: 'place', disc: hand.roses > 0 && (!hand.skull || rnd() < 0.6) ? 'rose' : 'skull' } : { type: 'bid', n: 1 + Math.floor(rnd() * total) };
      } else if (s.phase === 'bid') {
        const total = view(s, who).total;
        action = s.bid.n < total && rnd() < 0.4 ? { type: 'bid', n: s.bid.n + 1 + Math.floor(rnd() * (total - s.bid.n)) } : { type: 'pass' };
      } else if (s.phase === 'flip') {
        const c = s.challenger;
        const open = s.order.filter((p) => !s.out.includes(p) && p !== c && s.revealed[p] < s.pile[p].length);
        action = { type: 'flip', target: s.revealed[c] < s.pile[c].length ? c : pick(open) };
      } else action = { type: 'ready' };
      if (rnd() < 0.005) s = leave(s, pick(s.order), ctx(rnd)).state;
      else if (rnd() < 0.05) s = timeout(s, ctx(rnd)).state;
      else s = play(s, who, action, ctx(rnd));
      if (status(s).over) break;
      for (const id of s.order) {
        assert.ok(s.own[id].roses >= 0 && s.own[id].roses <= 3, `partie ${game} : roses`);
        if (s.phase !== 'result') {
          assert.ok(s.pile[id].filter((d) => d === 'r').length <= s.own[id].roses, `partie ${game} : pile plus grande que les disques`);
          assert.ok(s.pile[id].filter((d) => d === 's').length <= (s.own[id].skull ? 1 : 0));
        }
        const v = view(s, id);
        for (const other of s.order) if (other !== id) assert.ok(v.piles[other].every((d) => d.up || d.k === null), 'disque caché visible');
      }
      const ids2 = [].concat(status(s).turn).filter((p) => !s.out.includes(p));
      assert.ok(ids2.length > 0, `partie ${game} : personne ne peut jouer (phase ${s.phase})`);
    }
    assert.equal(status(s).winners.length, 1);
  }
});
