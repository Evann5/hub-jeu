// Tests des règles de Menteur : node --test games/menteur/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, move, view, status, timeout, leave, minQuantity, bidError, countFace, alive, totalDice, START_DICE,
} from './rules.js';

const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);

// Hasard fixé : rend les valeurs données (des dés de 1 à 6, ou des réels de 0 à 1 pour le tirage du premier joueur).
function fixed(values) {
  let i = 0;
  return () => values[i++ % values.length];
}
const ctxWith = (random, now = NOW) => ({ now, random });
const die = (v) => (v - 1) / 6 + 0.01; // fait sortir la valeur v
const P = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `joueur${i + 1}` }));
const OPTS = { turnTime: 0, exact: true };

// Une partie à n joueurs dont on impose les dés et le joueur qui ouvre (état JSON ordinaire).
function game(n, dice, { starter = 1, options = OPTS, counts } = {}) {
  const s = setup(P(n), options, ctxWith(fixed([0])));
  const c = counts || Object.fromEntries(P(n).map((p) => [p.id, dice[p.id]?.length ?? 0]));
  return { ...s, counts: c, dice, turn: starter };
}
const bid = (s, id, qty, face, ctx = ctxWith(fixed([0.5]))) => move(s, id, { type: 'bid', qty, face }, ctx).state;

test('minQuantity : surenchères classiques', () => {
  assert.equal(minQuantity(null, 3), 1);
  assert.equal(minQuantity({ qty: 3, face: 4 }, 4), 4); // même valeur : un dé de plus
  assert.equal(minQuantity({ qty: 3, face: 4 }, 2), 4); // valeur plus basse : un dé de plus
  assert.equal(minQuantity({ qty: 3, face: 4 }, 5), 3); // valeur plus haute : même nombre
  assert.equal(minQuantity({ qty: 3, face: 6 }, 2), 4);
});

test('minQuantity : passage aux 1 (moitié arrondie au-dessus) et retour (double plus un)', () => {
  assert.equal(minQuantity({ qty: 5, face: 4 }, 1), 3);
  assert.equal(minQuantity({ qty: 4, face: 4 }, 1), 2);
  assert.equal(minQuantity({ qty: 1, face: 4 }, 1), 1);
  assert.equal(minQuantity({ qty: 3, face: 1 }, 1), 4); // 1 après 1 : un de plus
  assert.equal(minQuantity({ qty: 3, face: 1 }, 6), 7);
  assert.equal(minQuantity({ qty: 2, face: 1 }, 2), 5);
});

test('bidError : annonces valides et refusées, avec un message en français', () => {
  assert.equal(bidError(null, 1, 1, 10), null);
  assert.equal(bidError({ qty: 3, face: 4 }, 3, 5, 10), null);
  assert.match(bidError({ qty: 3, face: 4 }, 3, 4, 10), /surenchérir/);
  assert.match(bidError({ qty: 3, face: 4 }, 2, 6, 10), /surenchérir/);
  assert.match(bidError(null, 0, 3, 10), /au moins 1 dé/);
  assert.match(bidError(null, 1.5, 3, 10), /au moins 1 dé/);
  assert.match(bidError(null, 2, 7, 10), /entre 1 et 6/);
  assert.match(bidError(null, 2, 0, 10), /entre 1 et 6/);
  assert.match(bidError(null, 11, 3, 10), /Il n’y a que 10 dés/);
  assert.match(bidError({ qty: 6, face: 3 }, 2, 1, 10), /moitié.*arrondie/);
  assert.equal(bidError({ qty: 6, face: 3 }, 3, 1, 10), null);
  assert.match(bidError({ qty: 3, face: 1 }, 6, 5, 20), /double/);
  assert.equal(bidError({ qty: 3, face: 1 }, 7, 5, 20), null);
});

test('countFace : les 1 sont des jokers, sauf sur une annonce de 1', () => {
  const dice = { 1: [1, 2, 4, 4, 6], 2: [1, 1, 3, 4, 5] };
  assert.equal(countFace(dice, 4), 6); // 3 quatre + 3 jokers
  assert.equal(countFace(dice, 6), 4); // 1 six + 3 jokers
  assert.equal(countFace(dice, 1), 3); // seulement les 1
  assert.equal(countFace(dice, 2), 4); // 1 deux + 3 jokers
});

test('setup : 5 dés cachés chacun, tirés avec ctx.random, de 1 à 6', () => {
  const s = setup(P(3), OPTS, ctxWith(fixed([0.5, die(1), die(2), die(3), die(4), die(5), die(6), die(1), die(2), die(3), die(4), die(5), die(6), die(1), die(2)])));
  assert.equal(s.round, 1);
  assert.equal(s.phase, 'bid');
  assert.equal(s.turn, 2); // 0,5 * 3 = place 1 → joueur 2
  assert.deepEqual(s.dice[1], [1, 2, 3, 4, 5]);
  assert.equal(totalDice(s), 15);
  for (const id of [1, 2, 3]) {
    assert.equal(s.dice[id].length, START_DICE);
    assert.ok(s.dice[id].every((d) => d >= 1 && d <= 6));
  }
  // Même hasard, même partie.
  assert.deepEqual(setup(P(3), OPTS, ctxWith(fixed([0.5, 0.3]))), setup(P(3), OPTS, ctxWith(fixed([0.5, 0.3]))));
});

test('setup : refuse moins de 2 et plus de 8 joueurs', () => {
  assert.throws(() => setup(P(1), OPTS, ctxWith(fixed([0]))), /au moins 2 joueurs/);
  assert.throws(() => setup(P(9), OPTS, ctxWith(fixed([0]))), /8 joueurs/);
  assert.equal(setup(P(8), OPTS, ctxWith(fixed([0]))).players.length, 8);
});

const CTX = () => ctxWith(fixed([die(3), die(4), die(5), die(6), die(2)]));

test('annonce : seul le joueur dont c\'est le tour joue, l\'annonce suivante doit surenchérir', () => {
  let s = game(3, { 1: [2, 2, 3, 4, 5], 2: [1, 2, 3, 4, 5], 3: [6, 6, 6, 6, 6] });
  assert.throws(() => move(s, 2, { type: 'bid', qty: 1, face: 2 }, CTX()), /pas ton tour/);
  s = bid(s, 1, 3, 4);
  assert.equal(s.turn, 2);
  assert.deepEqual(s.bid, { id: 1, qty: 3, face: 4 });
  assert.deepEqual(s.history, [{ id: 1, qty: 3, face: 4 }]);
  assert.throws(() => move(s, 2, { type: 'bid', qty: 3, face: 4 }, CTX()), /surenchérir/);
  s = bid(s, 2, 3, 5);
  assert.equal(s.turn, 3);
  // 3 dés de 5 → des 1 : il en faut au moins 2 (moitié arrondie au-dessus)
  assert.throws(() => move(s, 3, { type: 'bid', qty: 1, face: 1 }, CTX()), /moitié/);
  s = bid(s, 3, 2, 1);
  assert.equal(s.history.length, 3);
  assert.equal(s.turn, 1, 'le tour revient au premier joueur');
  assert.throws(() => move(s, 1, { type: 'bid', qty: 16, face: 6 }, CTX()), /Il n’y a que 15 dés/);
});

test('annonce : action inconnue, annonce illisible', () => {
  const s = game(2, { 1: [1, 2, 3, 4, 5], 2: [1, 2, 3, 4, 5] });
  assert.throws(() => move(s, 1, { type: 'tricher' }, CTX()), /Action inconnue/);
  assert.throws(() => move(s, 1, undefined, CTX()), /Action inconnue/);
  assert.throws(() => move(s, 1, { type: 'bid', qty: 'abc', face: 3 }, CTX()), /au moins 1 dé/);
  assert.throws(() => move(s, 1, { type: 'bid', qty: 2, face: null }, CTX()), /entre 1 et 6/);
});

test('Menteur ! sans annonce : refusé', () => {
  const s = game(2, { 1: [1, 2, 3, 4, 5], 2: [1, 2, 3, 4, 5] });
  assert.throws(() => move(s, 1, { type: 'liar' }, CTX()), /aucune annonce/);
  assert.throws(() => move(s, 1, { type: 'exact' }, CTX()), /aucune annonce/);
});

test('Menteur ! à tort : l\'annonce était juste, celui qui a crié perd un dé et ouvre la manche suivante', () => {
  // Annonce : 5 dés de 4. Sur la table : 4,4 + jokers 1,1,1 = 5 → juste.
  let s = game(2, { 1: [1, 1, 4, 4, 6], 2: [1, 2, 3, 5, 6] });
  s = bid(s, 1, 5, 4);
  const r = move(s, 2, { type: 'liar' }, CTX());
  s = r.state;
  assert.equal(s.phase, 'reveal');
  assert.equal(s.counts[2], 4);
  assert.equal(s.counts[1], 5);
  assert.equal(s.reveal.count, 5);
  assert.equal(s.reveal.success, true);
  assert.deepEqual(s.reveal.changed, { id: 2, delta: -1 });
  assert.deepEqual(s.reveal.dice[1], [1, 1, 4, 4, 6]);
  assert.deepEqual(s.reveal.dice[2], [1, 2, 3, 5, 6]);
  assert.equal(s.nextStarter, 2);
  assert.deepEqual(s.dice, {}, 'les dés secrets sont effacés de l\'état');
  assert.deepEqual(status(s).turn, [1, 2], 'les deux doivent dire « prêt »');
  assert.equal(status(s).deadline, NOW + 20_000);
});

test('Menteur ! à raison : l\'annonce était fausse, l\'auteur perd un dé et ouvre la manche suivante', () => {
  let s = game(2, { 1: [2, 2, 3, 3, 6], 2: [1, 2, 3, 5, 6] });
  s = bid(s, 1, 6, 2); // il y a 2+1+1 = 4 dés de 2 (jokers compris) : faux
  s = move(s, 2, { type: 'liar' }, CTX()).state;
  assert.equal(s.reveal.count, 4);
  assert.equal(s.reveal.success, false);
  assert.equal(s.counts[1], 4);
  assert.equal(s.counts[2], 5);
  assert.equal(s.nextStarter, 1);
});

test('Menteur ! sur une annonce de 1 : seuls les 1 comptent', () => {
  let s = game(2, { 1: [1, 1, 4, 4, 6], 2: [1, 2, 3, 5, 6] });
  s = bid(s, 1, 3, 1); // 3 uns exactement
  s = move(s, 2, { type: 'liar' }, CTX()).state;
  assert.equal(s.reveal.count, 3);
  assert.equal(s.reveal.success, true);
  assert.equal(s.counts[2], 4);
});

test('manche suivante : tout le monde prêt, ou le minuteur, relance les dés', () => {
  let s = game(3, { 1: [2, 2, 3, 3, 6], 2: [1, 2, 3, 5, 6], 3: [4, 4, 4, 4, 4] });
  s = bid(s, 1, 6, 2);
  s = move(s, 2, { type: 'liar' }, CTX()).state; // 1 perd un dé et ouvre
  assert.throws(() => move(s, 2, { type: 'bid', qty: 1, face: 2 }, CTX()), /Manche suivante/);
  s = move(s, 1, { type: 'next' }, CTX()).state;
  assert.equal(s.phase, 'reveal');
  assert.deepEqual(status(s).turn, [2, 3]);
  s = move(s, 1, { type: 'next' }, CTX()).state; // deux fois : sans effet
  assert.deepEqual(s.ready, [1]);
  s = move(s, 2, { type: 'next' }, CTX()).state;
  s = move(s, 3, { type: 'next' }, CTX()).state;
  assert.equal(s.phase, 'bid');
  assert.equal(s.round, 2);
  assert.equal(s.turn, 1);
  assert.equal(s.bid, null);
  assert.deepEqual(s.history, []);
  assert.equal(s.dice[1].length, 4);
  assert.equal(s.dice[2].length, 5);
  assert.equal(s.reveal, null);

  // Par le minuteur
  let t = game(2, { 1: [2, 2, 3, 3, 6], 2: [1, 2, 3, 5, 6] });
  t = bid(t, 1, 6, 2);
  t = move(t, 2, { type: 'liar' }, CTX()).state;
  t = timeout(t, CTX()).state;
  assert.equal(t.phase, 'bid');
  assert.equal(t.round, 2);
  assert.equal(t.turn, 1);
});

test('élimination à 0 dé : le joueur sort, le suivant ouvre, le dernier gagne', () => {
  let s = game(3, { 1: [2, 2, 3, 3, 6], 2: [3], 3: [4, 4, 4, 4, 4] }, { starter: 2 });
  s = bid(s, 2, 9, 5); // 11 dés en jeu
  assert.equal(s.turn, 3);
  s = move(s, 3, { type: 'liar' }, CTX()).state; // faux (2 cinq…) : 2 perd son dernier dé
  assert.equal(s.counts[2], 0);
  assert.deepEqual(s.out, [2]);
  assert.equal(s.reveal.eliminated, true);
  assert.equal(s.nextStarter, 3, 'le joueur suivant, 3, ouvre');
  assert.deepEqual(alive(s), [1, 3]);
  assert.deepEqual(status(s).turn, [1, 3], 'un éliminé n\'a rien à valider');
  assert.throws(() => move(s, 2, { type: 'next' }, CTX()), /éliminé/);
  // Manche suivante entre 1 et 3, 3 ouvre.
  s = move(move(s, 1, { type: 'next' }, CTX()).state, 3, { type: 'next' }, CTX()).state;
  assert.equal(s.turn, 3);
  assert.equal(s.dice[2], undefined);
  assert.equal(view(s, 2).mine, null, 'l\'éliminé ne voit plus de dés');
  // On fixe la fin : 1 n'a plus qu'un dé, 3 annonce juste, 1 crie « Menteur ! » à tort et sort.
  s = { ...s, dice: { 1: [2], 3: [4, 4, 4, 4, 4] }, counts: { 1: 1, 2: 0, 3: 5 } };
  s = bid(s, 3, 3, 4);
  const end = move(s, 1, { type: 'liar' }, CTX()).state;
  assert.equal(end.phase, 'over');
  assert.equal(end.counts[1], 0);
  assert.equal(end.counts[3], 5);
  assert.equal(end.winner, 3);
  assert.deepEqual(end.out, [2, 1]);
});

test('fin de partie : le dernier joueur avec des dés gagne', () => {
  let s = game(2, { 1: [2, 2, 3, 3, 6], 2: [4] }, { starter: 2 });
  s = bid(s, 2, 5, 5); // il y a 1 cinq... faux
  const end = move(s, 1, { type: 'liar' }, CTX());
  assert.equal(end.state.phase, 'over');
  assert.equal(end.state.winner, 1);
  assert.deepEqual(status(end.state), { turn: null, over: true, winners: [1], deadline: null });
  assert.deepEqual(end.state.out, [2]);
  assert.deepEqual(view(end.state, 1).reveal.dice[2], [4], 'la dernière manche reste visible');
  assert.throws(() => move(end.state, 1, { type: 'liar' }, CTX()), /terminée/);
});

test('Tout pile : juste, on regagne un dé (5 au maximum) ; faux, on en perd un', () => {
  const dice = { 1: [1, 4, 4, 5, 6], 2: [2, 3, 3, 5, 6] };
  // 4 : 2 quatre + 1 joker = 3 exactement
  let s = bid(game(2, dice, { counts: { 1: 4, 2: 5 } }), 1, 3, 4);
  let r = move(s, 2, { type: 'exact' }, CTX()).state;
  assert.equal(r.reveal.success, true);
  assert.equal(r.reveal.changed, null, 'déjà au maximum : pas de sixième dé');
  assert.equal(r.counts[2], 5);
  assert.equal(r.nextStarter, 2);

  const partial = bid(game(2, dice, { counts: { 1: 5, 2: 3 } }), 1, 3, 4);
  r = move(partial, 2, { type: 'exact' }, CTX()).state;
  assert.equal(r.counts[2], 4);
  assert.deepEqual(r.reveal.changed, { id: 2, delta: 1 });

  // Faux : 2 dés annoncés alors qu'il y en a 3
  s = bid(game(2, dice), 1, 2, 4);
  r = move(s, 2, { type: 'exact' }, CTX()).state;
  assert.equal(r.reveal.success, false);
  assert.equal(r.counts[2], 4);
  assert.equal(r.nextStarter, 2);
});

test('Tout pile : refusé quand l\'option est coupée', () => {
  const s = bid(game(2, { 1: [1, 4, 4, 5, 6], 2: [2, 3, 3, 5, 6] }, { options: { turnTime: 0, exact: false } }), 1, 3, 4);
  assert.throws(() => move(s, 2, { type: 'exact' }, CTX()), /pas activé/);
});

test('Tout pile : perdre son dernier dé élimine', () => {
  // 3 dés de 4 sur la table, 2 annoncés : tout pile est faux
  let s = bid(game(2, { 1: [1, 4, 4, 5, 6], 2: [2] }, { starter: 1 }), 1, 2, 4);
  s = move(s, 2, { type: 'exact' }, CTX()).state;
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 1);
  assert.deepEqual(s.out, [2]);
});

test('minuteur : « Menteur ! » s\'il y a une annonce, sinon l\'annonce minimale', () => {
  const o = { turnTime: 30, exact: true };
  let s = game(3, { 1: [2, 3, 4, 5, 6], 2: [2, 3, 4, 5, 6], 3: [2, 3, 4, 5, 6] }, { options: o });
  s = timeout(s, ctxWith(fixed([0]), NOW + 40_000)).state;
  assert.deepEqual(s.bid, { id: 1, qty: 1, face: 2, auto: true });
  assert.equal(s.turn, 2);
  assert.equal(s.deadline, NOW + 70_000);
  // Au tour de 2, annonce existante : le minuteur dit « Menteur ! » (1 dé de 2 : il y en a 3 → juste, 2 perd un dé)
  s = timeout(s, ctxWith(fixed([die(1)]), NOW + 80_000)).state;
  assert.equal(s.phase, 'reveal');
  assert.equal(s.reveal.caller, 2);
  assert.equal(s.counts[2], 4);
});

test('minuteur : status donne l\'échéance, vide sans minuteur', () => {
  const timed = game(2, { 1: [2], 2: [3] }, { options: { turnTime: 60, exact: true } });
  assert.equal(status({ ...timed, deadline: NOW + 60_000 }).deadline, NOW + 60_000);
  assert.equal(status(game(2, { 1: [2], 2: [3] })).deadline, null);
  const s = setup(P(2), { turnTime: 60 }, ctxWith(fixed([0])));
  assert.equal(s.deadline, NOW + 60_000);
  assert.equal(bid(s, 1, 1, 2, ctxWith(fixed([0]), NOW + 5_000)).deadline, NOW + 65_000, 'chaque annonce relance le minuteur');
});

test('view : je vois mes dés et le nombre de ceux des autres, jamais leurs valeurs', () => {
  const s = bid(game(3, { 1: [1, 2, 3, 4, 5], 2: [6, 6, 6, 6, 6], 3: [2, 2, 2, 2, 2] }), 1, 2, 3);
  const v = view(s, 2);
  assert.deepEqual(v.mine, [6, 6, 6, 6, 6]);
  assert.deepEqual(v.counts, { 1: 5, 2: 5, 3: 5 });
  assert.equal(JSON.stringify(v).includes('"dice"'), false);
  assert.equal(v.total, 15);
  assert.deepEqual(v.history, [{ id: 1, qty: 2, face: 3 }]);
  assert.deepEqual(v.minQty, [1, 2, 2, 3, 2, 2].map((_, f) => minQuantity(s.bid, f + 1)));
  assert.equal(v.minQty[0], 1, 'des 1 après 2 dés : au moins 1');
  assert.equal(v.minQty[2], 3);
  assert.equal(v.minQty[3], 2);
  // Spectateur : aucun dé du tout.
  const spec = view(s, null);
  assert.equal(spec.mine, null);
  assert.equal(JSON.stringify(spec).includes('[6,6,6,6,6]'), false);
  assert.equal(JSON.stringify(view(s, 3)).includes('[6,6,6,6,6]'), false);
});

test('view : la révélation montre les dés de tous, mais plus rien de secret ensuite', () => {
  let s = bid(game(2, { 1: [2, 2, 3, 3, 6], 2: [1, 2, 3, 5, 6] }), 1, 6, 2);
  s = move(s, 2, { type: 'liar' }, CTX()).state;
  const v = view(s, null);
  assert.deepEqual(v.reveal.dice[2], [1, 2, 3, 5, 6]);
  assert.equal(v.mine, null);
  assert.equal(v.minQty, null);
  s = move(move(s, 1, { type: 'next' }, CTX()).state, 2, { type: 'next' }, CTX()).state;
  assert.equal(view(s, null).reveal, null);
  assert.equal(view(s, 1).mine.length, 4);
});

test('leave : ses dés sortent, la partie continue', () => {
  let s = bid(game(3, { 1: [2, 2, 3, 3, 6], 2: [1, 2, 3, 5, 6], 3: [4, 4, 4, 4, 4] }), 1, 2, 2);
  // C'est le tour de 2 : il part, 3 doit répondre à l'annonce de 1.
  s = leave(s, 2, CTX()).state;
  assert.equal(s.counts[2], 0);
  assert.deepEqual(s.left, [2]);
  assert.equal(s.turn, 3);
  assert.equal(s.dice[2], undefined);
  assert.deepEqual(s.bid, { id: 1, qty: 2, face: 2 });
  assert.equal(totalDice(s), 10);
  assert.equal(status(s).turn, 3);
  // Il ne reste que 1 et 3 ; 1 part → 3 gagne.
  const end = leave(s, 1, CTX()).state;
  assert.equal(end.phase, 'over');
  assert.equal(end.winner, 3);
  assert.deepEqual(status(end).winners, [3]);
});

test('leave : hors de son tour, la partie ne change pas de main ; deux fois, sans effet', () => {
  let s = bid(game(3, { 1: [2, 2, 3, 3, 6], 2: [1, 2, 3, 5, 6], 3: [4, 4, 4, 4, 4] }), 1, 2, 2);
  s = leave(s, 3, CTX()).state;
  assert.equal(s.turn, 2);
  assert.deepEqual(leave(s, 3, CTX()).state, s);
});

test('leave : en fin de manche, le départ peut lancer la suivante', () => {
  let s = bid(game(3, { 1: [2, 2, 3, 3, 6], 2: [1, 2, 3, 5, 6], 3: [4, 4, 4, 4, 4] }), 1, 6, 2);
  s = move(s, 2, { type: 'liar' }, CTX()).state; // 1 perd, ouvre
  s = move(move(s, 1, { type: 'next' }, CTX()).state, 2, { type: 'next' }, CTX()).state;
  assert.equal(s.phase, 'reveal');
  s = leave(s, 3, CTX()).state; // 3 était le seul à ne pas être prêt
  assert.equal(s.phase, 'bid');
  assert.equal(s.round, 2);
  assert.equal(s.turn, 1);
  assert.equal(s.dice[3], undefined);
});

test('leave : celui qui devait ouvrir part en fin de manche, le suivant ouvre', () => {
  let s = bid(game(3, { 1: [2, 2, 3, 3, 6], 2: [1, 2, 3, 5, 6], 3: [4, 4, 4, 4, 4] }), 1, 6, 2);
  s = move(s, 2, { type: 'liar' }, CTX()).state; // 1 ouvre
  s = leave(s, 1, CTX()).state;
  assert.equal(s.nextStarter, 2);
});

test('leave : un éliminé qui part ne change rien pour les autres', () => {
  const s = game(3, { 1: [2], 2: [], 3: [4] }, { counts: { 1: 1, 2: 0, 3: 1 } });
  const r = leave(s, 2, CTX()).state;
  assert.equal(r.phase, 'bid');
  assert.deepEqual(r.left, [2]);
});

test('parties complètes : 200 parties au hasard se terminent avec un seul gagnant', () => {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let g = 0; g < 200; g += 1) {
    const n = 2 + (g % 7);
    const ctx = { now: NOW, random: rnd };
    let s = setup(P(n), { turnTime: 0, exact: g % 2 === 0 }, ctx);
    let steps = 0;
    while (s.phase !== 'over') {
      steps += 1;
      assert.ok(steps < 5000, 'la partie ne finit pas');
      if (s.phase === 'reveal') {
        s = timeout(s, ctx).state;
      } else {
        const { bid: b } = s;
        const v = view(s, s.turn);
        const roll = rnd();
        if (b && roll < 0.35) s = move(s, s.turn, { type: 'liar' }, ctx).state;
        else if (b && s.options.exact && roll < 0.42) s = move(s, s.turn, { type: 'exact' }, ctx).state;
        else {
          // la plus petite annonce autorisée sur une valeur au hasard (ou on crie si c'est impossible)
          const face = 1 + Math.floor(rnd() * 6);
          const qty = v.minQty[face - 1];
          if (qty > v.total) s = move(s, s.turn, { type: 'liar' }, ctx).state;
          else s = move(s, s.turn, { type: 'bid', qty, face }, ctx).state;
        }
      }
    }
    assert.equal(alive(s).length, 1);
    assert.deepEqual(status(s).winners, alive(s));
  }
});
