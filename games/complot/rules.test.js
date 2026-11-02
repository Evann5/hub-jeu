// Tests des règles de Complot : node --test games/complot/
// Le hasard est fixé par ctx.random ; les mains sont écrites à la main dans l'état (il tient en JSON).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, status, view, timeout, leave, CHARS } from './rules.js';

const ctx = (random = () => 0, now = 1_000_000) => ({ now, random });
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };
const names = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `joueur${i + 1}` }));

// Une partie à n joueurs avec des mains choisies : hands = { 1: ['doge', 'lame'], … }, le joueur 1 commence.
function table(hands, { coins = {}, deck, times } = {}) {
  const n = Object.keys(hands).length;
  const s = setup(names(n), { turnTime: 60, reactTime: 15, ...(times || {}) }, ctx());
  s.actor = 1;
  for (const [id, cards] of Object.entries(hands)) {
    s.p[id].cards = cards.map((c) => ({ c, up: false }));
    s.p[id].coins = coins[id] ?? 2;
  }
  if (deck) s.deck = deck.slice();
  return s;
}
const play = (s, id, action, c = ctx()) => move(s, id, action, c).state;
const hand = (s, id) => s.p[id].cards.map((c) => (c.up ? `(${c.c})` : c.c));
const upCount = (s, id) => s.p[id].cards.filter((c) => c.up).length;
const pass = (s, ids) => ids.reduce((acc, id) => play(acc, id, { type: 'pass' }), s);
const total = (s) => s.deck.length + Object.values(s.p).reduce((n, q) => n + q.cards.length, 0);

test('mise en place : 15 cartes, 2 influences et 2 pièces chacun', () => {
  const s = setup(names(3), {}, ctx());
  assert.equal(s.deck.length, 9);
  for (const id of [1, 2, 3]) {
    assert.equal(s.p[id].cards.length, 2);
    assert.equal(s.p[id].coins, 2);
  }
  assert.equal(total(s), 15);
  assert.ok(CHARS.every((c) => [...s.deck, ...Object.values(s.p).flatMap((q) => q.cards.map((x) => x.c))].filter((x) => x === c).length === 3));
  assert.equal(s.phase, 'action');
  assert.deepEqual(status(s), { turn: 1, over: false, winners: [], deadline: 1_000_000 + 60_000 });
});

test('à deux, celui qui commence n’a qu’une pièce', () => {
  const s = setup(names(2), {}, ctx());
  assert.equal(s.p[s.actor].coins, 1);
  assert.equal(s.p[s.order.find((id) => id !== s.actor)].coins, 2);
  assert.throws(() => setup(names(1), {}, ctx()), /de 2 à 6/);
  assert.throws(() => setup(names(7), {}, ctx()), /de 2 à 6/);
});

test('sans minuteur de tour, pas d’échéance', () => {
  const s = setup(names(3), { turnTime: 0 }, ctx());
  assert.equal(status(s).deadline, null);
});

test('revenu : +1 pièce, le tour passe, personne ne peut réagir', () => {
  let s = table({ 1: ['doge', 'lame'], 2: ['doge', 'lame'], 3: ['doge', 'lame'] });
  s = play(s, 1, { type: 'income' });
  assert.equal(s.p[1].coins, 3);
  assert.equal(status(s).turn, 2);
  assert.equal(s.phase, 'action');
});

test('ce n’est pas mon tour, action inconnue, joueur inconnu', () => {
  const s = table({ 1: ['doge', 'lame'], 2: ['doge', 'lame'], 3: ['doge', 'lame'] });
  assert.throws(() => move(s, 2, { type: 'income' }, ctx()), /pas ton tour/);
  assert.throws(() => move(s, 1, { type: 'danse' }, ctx()), /inconnue/);
  assert.throws(() => move(s, 9, { type: 'income' }, ctx()), /ne joues pas/);
});

test('aide étrangère : tout le monde laisse passer, +2', () => {
  let s = table({ 1: ['lame', 'lame'], 2: ['doge', 'lame'], 3: ['lame', 'lame'] });
  s = play(s, 1, { type: 'aid' });
  assert.equal(s.phase, 'block');
  assert.deepEqual(status(s).turn, [2, 3]);
  s = pass(s, [2, 3]);
  assert.equal(s.p[1].coins, 4);
  assert.equal(status(s).turn, 2);
});

test('aide étrangère contrée par le Doge, personne ne met le contre en doute : annulée', () => {
  let s = table({ 1: ['lame', 'lame'], 2: ['doge', 'lame'], 3: ['lame', 'lame'] });
  s = play(s, 1, { type: 'aid' });
  s = play(s, 2, { type: 'block' });
  assert.equal(s.phase, 'blockChallenge');
  assert.deepEqual(status(s).turn, [1, 3]);
  s = pass(s, [1, 3]);
  assert.equal(s.p[1].coins, 2);
  assert.equal(status(s).turn, 2);
});

test('contre mis en doute et vrai : le douteur perd une influence, le Doge est remélangé, l’aide est annulée', () => {
  let s = table({ 1: ['lame', 'lame'], 2: ['doge', 'lame'], 3: ['lame', 'lame'] }, { deck: ['condottiere', 'emissaire'] });
  s = play(s, 1, { type: 'aid' });
  s = play(s, 2, { type: 'block' });
  s = play(s, 1, { type: 'challenge' });
  assert.equal(s.phase, 'lose');
  assert.deepEqual(status(s).turn, 1);
  s = play(s, 1, { type: 'lose', card: 0 });
  assert.equal(upCount(s, 1), 1);
  assert.equal(s.p[1].coins, 2);
  assert.equal(s.p[2].cards.length, 2);
  assert.equal(s.deck.length, 2);
  assert.ok(s.log.some((e) => e.t === 'reveal' && e.who === 2 && e.ok === true));
  assert.equal(status(s).turn, 2);
});

test('contre mis en doute et faux : le menteur perd une influence et l’aide a lieu', () => {
  let s = table({ 1: ['lame', 'lame'], 2: ['emissaire', 'lame'], 3: ['lame', 'lame'] });
  s = play(s, 1, { type: 'aid' });
  s = play(s, 2, { type: 'block' });
  s = play(s, 3, { type: 'challenge' });
  assert.equal(s.phase, 'lose');
  assert.deepEqual(status(s).turn, 2);
  s = play(s, 2, { type: 'lose', card: 0 });
  assert.equal(hand(s, 2)[0], '(emissaire)');
  assert.equal(s.p[1].coins, 4);
  assert.equal(status(s).turn, 2);
});

test('coup d’État : 7 pièces, la cible choisit l’influence perdue', () => {
  let s = table({ 1: ['lame', 'lame'], 2: ['doge', 'lame'], 3: ['lame', 'lame'] }, { coins: { 1: 8 } });
  s = play(s, 1, { type: 'coup', target: 2 });
  assert.equal(s.p[1].coins, 1);
  assert.equal(s.phase, 'lose');
  assert.deepEqual(status(s).turn, 2);
  assert.throws(() => move(s, 3, { type: 'lose', card: 0 }, ctx()), /pas à toi/);
  s = play(s, 2, { type: 'lose', card: 1 });
  assert.deepEqual(hand(s, 2), ['doge', '(lame)']);
  assert.equal(status(s).turn, 2);
  assert.equal(s.actor, 2);
});

test('coup d’État sans assez de pièces, sur soi-même, sur un éliminé', () => {
  const s = table({ 1: ['lame', 'lame'], 2: ['doge', 'lame'], 3: ['lame', 'lame'] }, { coins: { 1: 6 } });
  assert.throws(() => move(s, 1, { type: 'coup', target: 2 }, ctx()), /7 pièces/);
  const t = table({ 1: ['lame', 'lame'], 2: ['doge', 'lame'], 3: ['lame', 'lame'] }, { coins: { 1: 7 } });
  assert.throws(() => move(t, 1, { type: 'coup', target: 1 }, ctx()), /toi-même/);
  assert.throws(() => move(t, 1, { type: 'coup' }, ctx()), /Choisis un joueur/);
  t.p[3].cards[0].up = true;
  t.p[3].cards[1].up = true;
  assert.throws(() => move(t, 1, { type: 'coup', target: 3 }, ctx()), /éliminé/);
});

test('à 10 pièces ou plus, le coup d’État est obligatoire', () => {
  const s = table({ 1: ['lame', 'lame'], 2: ['doge', 'lame'], 3: ['lame', 'lame'] }, { coins: { 1: 10 } });
  assert.equal(view(s, 1).mustCoup, true);
  for (const type of ['income', 'aid', 'tax']) assert.throws(() => move(s, 1, { type }, ctx()), /coup d’État/);
  assert.throws(() => move(s, 1, { type: 'assassinate', target: 2 }, ctx()), /coup d’État/);
  const next = play(s, 1, { type: 'coup', target: 2 });
  assert.equal(next.p[1].coins, 3);
});

test('coup d’État sur une dernière influence : élimination automatique, pièces remises', () => {
  let s = table({ 1: ['lame', 'lame'], 2: ['doge', 'lame'], 3: ['lame', 'lame'] }, { coins: { 1: 7, 2: 5 } });
  s.p[2].cards[0].up = true;
  s = play(s, 1, { type: 'coup', target: 2 });
  assert.equal(s.p[2].coins, 0);
  assert.equal(view(s, 3).p[2].alive, false);
  assert.ok(s.log.some((e) => e.t === 'out' && e.who === 2));
  assert.equal(s.phase, 'action');
  assert.equal(s.actor, 3, 'le tour saute le joueur éliminé');
});

test('le dernier en lice gagne', () => {
  let s = table({ 1: ['lame', 'lame'], 2: ['doge', 'lame'] }, { coins: { 1: 7 } });
  s.p[2].cards[0].up = true;
  s = play(s, 1, { type: 'coup', target: 2 });
  assert.deepEqual(status(s), { turn: null, over: true, winners: [1], deadline: null });
  assert.throws(() => move(s, 1, { type: 'income' }, ctx()), /terminée/);
  // En fin de partie, toutes les cartes sont visibles.
  assert.equal(view(s, null).p[1].cards[0].c, 'lame');
});

test('taxe : personne ne doute, +3', () => {
  let s = table({ 1: ['doge', 'lame'], 2: ['lame', 'lame'], 3: ['lame', 'lame'] });
  s = play(s, 1, { type: 'tax' });
  assert.equal(s.phase, 'challenge');
  assert.deepEqual(status(s).turn, [2, 3]);
  s = pass(s, [2, 3]);
  assert.equal(s.p[1].coins, 5);
  assert.equal(status(s).turn, 2);
});

test('taxe mise en doute, l’acteur a le Doge : le douteur perd, la taxe a lieu, le Doge est remélangé', () => {
  let s = table({ 1: ['doge', 'lame'], 2: ['lame', 'lame'], 3: ['lame', 'lame'] }, { deck: ['emissaire', 'emissaire', 'condottiere'] });
  s = play(s, 1, { type: 'tax' });
  s = play(s, 2, { type: 'challenge' });
  assert.equal(s.phase, 'lose');
  assert.deepEqual(status(s).turn, 2);
  s = play(s, 2, { type: 'lose', card: 0 });
  assert.equal(hand(s, 2)[0], '(lame)');
  assert.equal(s.p[1].coins, 5);
  assert.equal(s.p[1].cards.length, 2);
  assert.equal(s.deck.length, 3);
  assert.equal(total(s), 3 + 6);
  assert.ok(s.log.some((e) => e.t === 'reveal' && e.who === 1 && e.char === 'doge' && e.ok));
});

test('taxe mise en doute, l’acteur bluffe : il perd une influence et ne touche rien', () => {
  let s = table({ 1: ['lame', 'emissaire'], 2: ['lame', 'lame'], 3: ['lame', 'lame'] });
  s = play(s, 1, { type: 'tax' });
  s = play(s, 3, { type: 'challenge' });
  assert.deepEqual(status(s).turn, 1);
  s = play(s, 1, { type: 'lose', card: 1 });
  assert.equal(s.p[1].coins, 2);
  assert.deepEqual(hand(s, 1), ['lame', '(emissaire)']);
  assert.equal(status(s).turn, 2);
});

test('le doute peut venir de n’importe qui, une seule fois : le premier à parler décide', () => {
  let s = table({ 1: ['lame', 'emissaire'], 2: ['lame', 'lame'], 3: ['lame', 'lame'] });
  s = play(s, 1, { type: 'tax' });
  s = play(s, 2, { type: 'pass' });
  assert.throws(() => move(s, 2, { type: 'pass' }, ctx()), /pas réagir/);
  assert.throws(() => move(s, 1, { type: 'challenge' }, ctx()), /pas réagir/);
  assert.throws(() => move(s, 3, { type: 'income' }, ctx()), /doute/);
  s = play(s, 3, { type: 'challenge' });
  assert.equal(s.phase, 'lose');
});

test('assassinat : 3 pièces, doute puis contre possibles, la cible perd si personne ne bouge', () => {
  let s = table({ 1: ['lame', 'doge'], 2: ['doge', 'doge'], 3: ['doge', 'doge'] }, { coins: { 1: 4 } });
  assert.throws(() => move(table({ 1: ['lame', 'doge'], 2: ['doge', 'doge'] }, { coins: { 1: 2 } }), 1, { type: 'assassinate', target: 2 }, ctx()), /3 pièces/);
  s = play(s, 1, { type: 'assassinate', target: 2 });
  assert.equal(s.p[1].coins, 1);
  assert.equal(s.phase, 'challenge');
  s = pass(s, [2, 3]);
  assert.equal(s.phase, 'block');
  assert.deepEqual(status(s).turn, [2], 'seule la cible peut contrer');
  s = pass(s, [2]);
  assert.equal(s.phase, 'lose');
  s = play(s, 2, { type: 'lose', card: 0 });
  assert.equal(upCount(s, 2), 1);
  assert.equal(status(s).turn, 2);
});

test('assassinat contré par la Courtisane : les 3 pièces sont perdues, la cible garde ses cartes', () => {
  let s = table({ 1: ['lame', 'doge'], 2: ['courtisane', 'doge'], 3: ['doge', 'doge'] }, { coins: { 1: 4 } });
  s = play(s, 1, { type: 'assassinate', target: 2 });
  s = pass(s, [2, 3]);
  s = play(s, 2, { type: 'block' });
  assert.equal(s.block.char, 'courtisane');
  assert.deepEqual(status(s).turn, [1, 3]);
  s = pass(s, [1, 3]);
  assert.equal(upCount(s, 2), 0);
  assert.equal(s.p[1].coins, 1);
  assert.equal(status(s).turn, 2);
});

test('assassinat : l’assassin bluffe et on le met en doute, il récupère ses 3 pièces', () => {
  let s = table({ 1: ['doge', 'doge'], 2: ['lame', 'lame'], 3: ['lame', 'lame'] }, { coins: { 1: 4 } });
  s = play(s, 1, { type: 'assassinate', target: 2 });
  s = play(s, 3, { type: 'challenge' });
  s = play(s, 1, { type: 'lose', card: 0 });
  assert.equal(s.p[1].coins, 4);
  assert.equal(upCount(s, 2), 0);
  assert.equal(upCount(s, 1), 1);
});

test('assassinat : la cible doute à tort, perd une influence puis se fait assassiner : éliminée', () => {
  let s = table({ 1: ['lame', 'doge'], 2: ['doge', 'doge'], 3: ['doge', 'doge'] }, { coins: { 1: 4 } });
  s = play(s, 1, { type: 'assassinate', target: 2 });
  s = play(s, 2, { type: 'challenge' });
  s = play(s, 2, { type: 'lose', card: 0 });
  assert.equal(s.phase, 'block', 'le contre reste possible après un doute raté');
  s = pass(s, [2]);
  // La dernière carte part toute seule : pas de choix à faire.
  assert.equal(view(s, 3).p[2].alive, false);
  assert.equal(s.log.filter((e) => e.t === 'lose' && e.who === 2).length, 2);
  assert.equal(s.actor, 3);
});

test('assassinat contré à tort par un bluff : le faux contre tombe et l’assassinat a lieu (double perte possible)', () => {
  let s = table({ 1: ['lame', 'doge'], 2: ['doge', 'doge'], 3: ['doge', 'doge'] }, { coins: { 1: 4 } });
  s = play(s, 1, { type: 'assassinate', target: 2 });
  s = pass(s, [2, 3]);
  s = play(s, 2, { type: 'block' }); // la cible bluffe la Courtisane
  s = play(s, 1, { type: 'challenge' });
  assert.equal(s.phase, 'lose');
  assert.equal(s.lose.player, 2);
  s = play(s, 2, { type: 'lose', card: 0 }); // le faux contre lui coûte une influence…
  assert.equal(view(s, 1).p[2].alive, false); // … et l’assassinat lui prend l’autre, sans rien lui demander
  assert.equal(s.log.filter((e) => e.t === 'lose' && e.who === 2).length, 2);
});

test('vol : 2 pièces, ou ce qu’il reste ; une cible sans pièce est refusée', () => {
  let s = table({ 1: ['condottiere', 'doge'], 2: ['doge', 'doge'], 3: ['doge', 'doge'] }, { coins: { 2: 1 } });
  s = play(s, 1, { type: 'steal', target: 2 });
  s = pass(s, [2, 3]);
  assert.deepEqual(status(s).turn, [2]);
  s = pass(s, [2]);
  assert.equal(s.p[1].coins, 3);
  assert.equal(s.p[2].coins, 0);
  const t = table({ 1: ['condottiere', 'doge'], 2: ['doge', 'doge'], 3: ['doge', 'doge'] }, { coins: { 2: 0 } });
  assert.throws(() => move(t, 1, { type: 'steal', target: 2 }, ctx()), /aucune pièce/);
});

test('vol contré par un Émissaire ou un Condottiere (au choix), le contre peut être mis en doute', () => {
  let s = table({ 1: ['condottiere', 'doge'], 2: ['emissaire', 'doge'], 3: ['doge', 'doge'] });
  s = play(s, 1, { type: 'steal', target: 2 });
  s = pass(s, [2, 3]);
  assert.throws(() => move(s, 2, { type: 'block' }, ctx()), /personnage/);
  assert.throws(() => move(s, 2, { type: 'block', char: 'lame' }, ctx()), /personnage/);
  s = play(s, 2, { type: 'block', char: 'emissaire' });
  assert.equal(s.block.char, 'emissaire');
  s = pass(s, [1, 3]);
  assert.equal(s.p[2].coins, 2);
  assert.equal(s.p[1].coins, 2);
});

test('vol : le Condottiere douté à raison, la cible n’a rien perdu', () => {
  let s = table({ 1: ['doge', 'doge'], 2: ['lame', 'doge'], 3: ['doge', 'doge'] });
  s = play(s, 1, { type: 'steal', target: 2 });
  s = play(s, 2, { type: 'challenge' });
  s = play(s, 1, { type: 'lose', card: 0 });
  assert.equal(s.p[2].coins, 2);
  assert.equal(s.p[1].coins, 2);
});

test('échange : on pioche 2 cartes, on garde autant qu’on a d’influences, le reste retourne à la pioche', () => {
  let s = table({ 1: ['emissaire', 'doge'], 2: ['lame', 'lame'], 3: ['lame', 'lame'] }, { deck: ['condottiere', 'courtisane', 'lame'] });
  s = play(s, 1, { type: 'exchange' });
  s = pass(s, [2, 3]);
  assert.equal(s.phase, 'exchange');
  assert.deepEqual(s.exch.options, ['emissaire', 'doge', 'condottiere', 'courtisane']);
  assert.equal(s.deck.length, 1);
  assert.deepEqual(view(s, 1).exch.options, s.exch.options);
  assert.equal(view(s, 2).exch, null, 'les autres ne voient pas les cartes proposées');
  assert.equal(view(s, null).exch, null);
  assert.throws(() => move(s, 1, { type: 'keep', keep: [0] }, ctx()), /exactement 2/);
  assert.throws(() => move(s, 1, { type: 'keep', keep: [0, 0] }, ctx()), /exactement 2/);
  assert.throws(() => move(s, 1, { type: 'keep', keep: [0, 7] }, ctx()), /exactement 2/);
  assert.throws(() => move(s, 2, { type: 'keep', keep: [0, 1] }, ctx()), /pas à toi/);
  s = play(s, 1, { type: 'keep', keep: [2, 3] });
  assert.deepEqual(hand(s, 1), ['condottiere', 'courtisane']);
  assert.equal(s.deck.length, 3);
  assert.deepEqual([...s.deck].sort(), ['doge', 'emissaire', 'lame']);
  assert.equal(status(s).turn, 2);
});

test('échange avec une seule influence : on garde une carte sur trois', () => {
  let s = table({ 1: ['emissaire', 'doge'], 2: ['lame', 'lame'], 3: ['lame', 'lame'] }, { deck: ['condottiere', 'courtisane', 'lame'] });
  s.p[1].cards[1].up = true;
  s = play(s, 1, { type: 'exchange' });
  s = pass(s, [2, 3]);
  assert.equal(s.exch.options.length, 3);
  assert.equal(s.exch.keep, 1);
  s = play(s, 1, { type: 'keep', keep: [1] });
  assert.deepEqual(hand(s, 1), ['condottiere', '(doge)']);
});

test('échange douté et bluffé : pas d’échange', () => {
  let s = table({ 1: ['lame', 'doge'], 2: ['lame', 'lame'], 3: ['lame', 'lame'] }, { deck: ['condottiere', 'courtisane', 'lame'] });
  s = play(s, 1, { type: 'exchange' });
  s = play(s, 2, { type: 'challenge' });
  s = play(s, 1, { type: 'lose', card: 1 });
  assert.equal(s.deck.length, 3);
  assert.equal(s.phase, 'action');
});

// ——— Minuteurs ———

test('minuteur du tour : revenu ; à 10 pièces, coup d’État sur un adversaire choisi au hasard', () => {
  let s = table({ 1: ['lame', 'lame'], 2: ['doge', 'doge'], 3: ['doge', 'doge'] });
  s = timeout(s, ctx()).state;
  assert.equal(s.p[1].coins, 3);
  assert.equal(s.actor, 2);
  let t = table({ 1: ['lame', 'lame'], 2: ['doge', 'doge'], 3: ['doge', 'doge'] }, { coins: { 1: 11 } });
  t = timeout(t, ctx(() => 0.99)).state;
  assert.equal(t.p[1].coins, 4);
  assert.equal(t.phase, 'lose');
  assert.equal(t.lose.player, 3);
});

test('minuteur d’une fenêtre : tous laissent passer', () => {
  let s = table({ 1: ['lame', 'doge'], 2: ['lame', 'lame'], 3: ['lame', 'lame'] });
  s = play(s, 1, { type: 'tax' });
  s = play(s, 2, { type: 'pass' });
  assert.deepEqual(status(s).turn, [3]);
  assert.equal(status(s).deadline, 1_000_000 + 15_000);
  s = timeout(s, ctx()).state;
  assert.equal(s.p[1].coins, 5);
  assert.equal(s.actor, 2);
});

test('minuteur de la perte d’influence : une carte cachée au hasard ; de l’échange : on garde ses cartes', () => {
  let s = table({ 1: ['lame', 'lame'], 2: ['doge', 'courtisane'], 3: ['doge', 'doge'] }, { coins: { 1: 7 } });
  s = play(s, 1, { type: 'coup', target: 2 });
  s = timeout(s, ctx(() => 0.9)).state;
  assert.deepEqual(hand(s, 2), ['doge', '(courtisane)']);
  let t = table({ 1: ['emissaire', 'doge'], 2: ['lame', 'lame'], 3: ['lame', 'lame'] }, { deck: ['condottiere', 'courtisane', 'lame'] });
  t = pass(play(t, 1, { type: 'exchange' }), [2, 3]);
  t = timeout(t, ctx()).state;
  assert.deepEqual(hand(t, 1), ['emissaire', 'doge']);
  assert.equal(t.deck.length, 3);
});

// ——— Abandon ———

test('abandon pendant son tour : ses cartes retournent à la pioche, le tour passe', () => {
  let s = table({ 1: ['lame', 'doge'], 2: ['lame', 'lame'], 3: ['lame', 'lame'] }, { deck: ['emissaire'] });
  s = leave(s, 1, ctx()).state;
  assert.equal(s.deck.length, 3);
  assert.equal(s.p[1].left, true);
  assert.equal(s.actor, 2);
  assert.equal(s.phase, 'action');
  assert.equal(view(s, 2).p[1].alive, false);
});

test('abandon d’un joueur visé par une action : l’action est annulée et remboursée', () => {
  let s = table({ 1: ['lame', 'doge'], 2: ['lame', 'lame'], 3: ['lame', 'lame'] }, { coins: { 1: 4 } });
  s = play(s, 1, { type: 'assassinate', target: 2 });
  s = leave(s, 2, ctx()).state;
  assert.equal(s.p[1].coins, 4);
  assert.equal(s.actor, 3);
});

test('abandon d’un spectateur de la scène : la fenêtre se referme s’il était le dernier à répondre', () => {
  let s = table({ 1: ['doge', 'lame'], 2: ['lame', 'lame'], 3: ['lame', 'lame'], 4: ['lame', 'lame'] });
  s = play(s, 1, { type: 'tax' });
  s = pass(s, [2, 3]);
  s = leave(s, 4, ctx()).state;
  assert.equal(s.p[1].coins, 5);
  assert.equal(s.actor, 2);
});

test('abandon à deux : l’autre gagne', () => {
  const s = leave(table({ 1: ['lame', 'doge'], 2: ['lame', 'lame'] }), 1, ctx()).state;
  assert.deepEqual(status(s), { turn: null, over: true, winners: [2], deadline: null });
});

// ——— Ce que voit chacun ———

test('view : mes cartes oui, celles des autres non tant qu’elles ne sont pas retournées', () => {
  let s = table({ 1: ['doge', 'lame'], 2: ['courtisane', 'emissaire'], 3: ['condottiere', 'condottiere'] }, { coins: { 1: 7 } });
  s = play(s, 1, { type: 'coup', target: 2 });
  s = play(s, 2, { type: 'lose', card: 0 });
  const v1 = view(s, 1);
  assert.deepEqual(v1.p[1].cards, [{ up: false, c: 'doge' }, { up: false, c: 'lame' }]);
  assert.deepEqual(v1.p[2].cards, [{ up: true, c: 'courtisane' }, { up: false, c: null }]);
  assert.deepEqual(v1.p[3].cards, [{ up: false, c: null }, { up: false, c: null }]);
  const spec = JSON.stringify(view(s, null));
  assert.ok(!spec.includes('emissaire') && !spec.includes('condottiere') && !spec.includes('"doge"') && !spec.includes('"lame"'));
  assert.ok(!('deck' in v1));
  assert.equal(v1.deckCount, s.deck.length);
  // Les personnes assises voient aussi le journal des actions et des contestations.
  assert.ok(v1.log.some((e) => e.t === 'declare' && e.action === 'coup'));
});

test('une partie complète à 3, avec une contestation, ne perd aucune carte', () => {
  const rnd = seq(0.1, 0.7, 0.3, 0.9, 0.5);
  let s = setup(names(3), { turnTime: 0, reactTime: 10 }, ctx(rnd));
  const start = s.actor;
  let guard = 0;
  while (status(s).over === false && guard++ < 400) {
    const st = status(s);
    const who = [].concat(st.turn)[0];
    if (s.phase === 'action') {
      const me = s.p[who];
      const foes = s.order.filter((id) => id !== who && s.p[id].cards.some((c) => !c.up));
      if (me.coins >= 7) s = play(s, who, { type: 'coup', target: foes[0] }, ctx(rnd));
      else s = play(s, who, { type: guard % 3 === 0 ? 'tax' : 'income' }, ctx(rnd));
    } else if (s.phase === 'lose') s = play(s, who, { type: 'lose', card: s.p[who].cards.findIndex((c) => !c.up) }, ctx(rnd));
    else if (s.phase === 'challenge') s = play(s, who, { type: guard % 2 ? 'challenge' : 'pass' }, ctx(rnd));
    else if (s.phase === 'exchange') s = play(s, who, { type: 'keep', keep: Array.from({ length: s.exch.keep }, (_, i) => i) }, ctx(rnd));
    else s = play(s, who, { type: 'pass' }, ctx(rnd));
    assert.equal(total(s) + (s.exch ? 2 : 0), 15);
  }
  assert.equal(status(s).over, true);
  assert.equal(status(s).winners.length, 1);
  assert.ok(s.order.includes(start));
});

// Parties au hasard (coups légaux tirés par un hasard à graine) : toujours finies, aucune carte perdue, rien de caché qui fuit.
test('300 parties au hasard, de 2 à 6 joueurs, avec contre, doute, échange et abandons', () => {
  for (let game = 0; game < 300; game++) {
    let seed = game * 7919 + 13;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const n = 2 + (game % 5);
    let s = setup(names(n), { turnTime: 30, reactTime: 10 }, ctx(rnd));
    let steps = 0;
    while (status(s).over === false) {
      assert.ok(steps++ < 2000, `partie ${game} trop longue`);
      const st = status(s);
      const who = [].concat(st.turn)[Math.floor(rnd() * [].concat(st.turn).length)];
      const foes = s.order.filter((id) => id !== who && s.p[id].cards.some((c) => !c.up));
      const pick = (list) => list[Math.floor(rnd() * list.length)];
      let action;
      if (s.phase === 'action') {
        const coins = s.p[who].coins;
        if (coins >= 10 || (coins >= 7 && rnd() < 0.6)) action = { type: 'coup', target: pick(foes) };
        else {
          const types = ['income', 'aid', 'tax', 'exchange'];
          if (coins >= 3) types.push('assassinate');
          const stealable = foes.filter((id) => s.p[id].coins > 0);
          if (stealable.length) types.push('steal');
          const type = pick(types);
          action = { type, target: type === 'steal' ? pick(stealable) : pick(foes) };
        }
      } else if (s.phase === 'lose') action = { type: 'lose', card: pick(s.p[who].cards.map((c, i) => (c.up ? -1 : i)).filter((i) => i >= 0)) };
      else if (s.phase === 'exchange') action = { type: 'keep', keep: Array.from({ length: s.exch.keep }, (_, i) => i + (s.exch.options.length - s.exch.keep)) };
      else if (s.phase === 'block') action = rnd() < 0.3 ? { type: 'block', char: pick(['condottiere', 'emissaire']) } : { type: 'pass' };
      else action = rnd() < 0.25 ? { type: 'challenge' } : { type: 'pass' };
      if (rnd() < 0.01 && n > 2) s = leave(s, pick(s.order), ctx(rnd)).state;
      else if (rnd() < 0.05) s = timeout(s, ctx(rnd)).state;
      else s = play(s, who, action, ctx(rnd));
      if (status(s).over) break;
      const left = s.order.filter((id) => s.p[id].left);
      const inHands = Object.values(s.p).reduce((c, q) => c + q.cards.length, 0);
      assert.equal(s.deck.length + inHands, 15 - (s.exch ? 2 : 0), `partie ${game} : cartes perdues`);
      for (const id of s.order) {
        const v = view(s, id);
        for (const other of s.order) if (other !== id) assert.ok(v.p[other].cards.every((c) => c.up || c.c === null), 'carte cachée visible');
      }
      assert.ok(left.length < n);
      const t = [].concat(status(s).turn).filter((id) => s.p[id].cards.some((c) => !c.up));
      assert.ok(t.length > 0, `partie ${game} : personne ne peut jouer (phase ${s.phase})`);
    }
    assert.equal(status(s).winners.length, 1);
  }
});

test('abandon pendant un échange : les deux cartes piochées retournent à la pioche', () => {
  let s = table({ 1: ['emissaire', 'doge'], 2: ['lame', 'lame'], 3: ['lame', 'lame'] }, { deck: ['condottiere', 'courtisane', 'lame'] });
  s = pass(play(s, 1, { type: 'exchange' }), [2, 3]);
  s = leave(s, 1, ctx()).state;
  assert.equal(s.exch, null);
  assert.equal(s.deck.length, 3 + 2);
  assert.equal(s.actor, 2);
});
