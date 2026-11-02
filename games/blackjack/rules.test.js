// Tests des règles du blackjack : node --test games/blackjack/*.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, status, view, timeout, leave, handValue, isBlackjack, MIN_BET } from './rules.js';

const RANKS = '23456789TJQKA';
const SUITS = 'shdc';
const card = (str) => SUITS.indexOf(str[1]) * 13 + RANKS.indexOf(str[0]);
const cards = (str) => str.split(' ').map(card);

function seeded(seed = 11) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}
let NOW = 5_000_000;
const ctx = (now = NOW, random = seeded()) => ({ now, random });
const players = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `j${i + 1}` }));

// Une partie à n joueurs dont le sabot est truqué : `order` donne les cartes dans l'ordre où elles seront tirées
// (un tour de table : joueurs 1..n puis banque, deux fois ; puis les cartes tirées ensuite).
function game(n, order, opts = {}, round = 1) {
  const s = { ...setup(players(n), { start: 1000, rounds: 10, timer: 20, ...opts }, ctx()), round };
  const seq = cards(order);
  const filler = s.shoe.slice(0, s.shoe.length - seq.length);
  return { ...s, shoe: [...filler, ...seq.reverse()] };
}
const bet = (s, id, amount) => move(s, id, { type: 'bet', amount }, ctx()).state;
const play = (s, id, type, extra = {}) => move(s, id, { type, ...extra }, ctx()).state;
const chips = (s, id) => s.seats.find((x) => x.id === id).chips;

test('valeur d’une main : as souple, as dur, plusieurs as, dépassement', () => {
  assert.deepEqual(handValue(cards('As Kd')), { total: 21, soft: true });
  assert.deepEqual(handValue(cards('As 6d')), { total: 17, soft: true });
  assert.deepEqual(handValue(cards('As 6d Kc')), { total: 17, soft: false });
  assert.deepEqual(handValue(cards('As Ad')), { total: 12, soft: true });
  assert.deepEqual(handValue(cards('As Ad Ah')), { total: 13, soft: true });
  assert.deepEqual(handValue(cards('As Ad Kh Qc')), { total: 22, soft: false });
  assert.deepEqual(handValue(cards('Ks Qd 5h')), { total: 25, soft: false });
  assert.deepEqual(handValue(cards('9s 7d 5h')), { total: 21, soft: false });
  assert.deepEqual(handValue(cards('2s 3d 4h')), { total: 9, soft: false });
});

test('blackjack : deux cartes seulement, un as et une carte qui vaut 10', () => {
  assert.equal(isBlackjack(cards('As Kd')), true);
  assert.equal(isBlackjack(cards('Td Ac')), true);
  assert.equal(isBlackjack(cards('7s 7d 7h')), false, '21 en trois cartes');
  assert.equal(isBlackjack(cards('Ks Qd')), false);
});

test('au départ : sabot de 6 jeux, mises ouvertes à tous', () => {
  const s = setup(players(3), {}, ctx());
  assert.equal(s.shoe.length, 312);
  const counts = new Map();
  for (const c of s.shoe) counts.set(c, (counts.get(c) || 0) + 1);
  assert.equal(counts.size, 52);
  assert.ok([...counts.values()].every((n) => n === 6));
  assert.equal(s.phase, 'bet');
  assert.equal(s.round, 1);
  assert.deepEqual(status(s).turn, [1, 2, 3]);
  assert.equal(status(s).deadline, NOW + 20000);
  assert.equal(s.seats[0].chips, 1000);
});

test('options : valeurs inconnues remplacées, minuteur facultatif', () => {
  const s = setup(players(1), { start: 77, rounds: 3, timer: 999 }, ctx());
  assert.deepEqual(s.opts, { start: 1000, rounds: 10, timer: 20 });
  const t = setup(players(1), { start: 500, rounds: 5, timer: 0 }, ctx());
  assert.equal(t.deadline, null);
  assert.equal(status(t).deadline, null);
});

test('mises refusées avec un message clair', () => {
  const s = game(2, 'Ts 9d');
  assert.throws(() => bet(s, 1, 5), /minimale/);
  assert.throws(() => bet(s, 1, 0), /minimale/);
  assert.throws(() => bet(s, 1, 'abc'), /minimale/);
  assert.throws(() => bet(s, 1, 15), /multiples de 10/);
  assert.throws(() => bet(s, 1, 1010), /1000 jetons/);
  assert.throws(() => bet(s, 1, 33.5), /multiples|minimale/);
  assert.throws(() => bet(s, 9, 10), /ne joues pas/);
  assert.throws(() => play(s, 1, 'hit'), /mise/);
  const t = bet(s, 1, 100);
  assert.throws(() => bet(t, 1, 100), /déjà/);
  assert.equal(chips(t, 1), 900);
  assert.deepEqual(status(t).turn, [2]);
});

test('les mises des autres restent cachées pendant les mises', () => {
  let s = game(3, 'Ts 9d');
  s = bet(s, 1, 200);
  const v2 = view(s, 2);
  assert.equal(v2.seats[0].placed, true);
  assert.equal(v2.seats[0].hands[0].bet, null);
  assert.equal(v2.seats[0].chips, 1000, 'les jetons restants ne trahissent pas la mise');
  const v1 = view(s, 1);
  assert.equal(v1.seats[0].hands[0].bet, 200);
  assert.equal(v1.seats[0].chips, 800);
  assert.equal(view(s, null).seats[0].hands[0].bet, null);
  assert.equal(v1.me, null, 'sa mise est placée');
  assert.deepEqual(view(s, 2).me, { maxBet: 1000, minBet: MIN_BET });
});

test('la distribution suit l’ordre : joueurs, banque, joueurs, banque', () => {
  let s = game(2, 'Ts 9d 5h 6c 2s 3d');
  s = bet(s, 1, 100);
  s = bet(s, 2, 100);
  assert.deepEqual(s.seats[0].hands[0].cards, cards('Ts 6c'));
  assert.deepEqual(s.seats[1].hands[0].cards, cards('9d 2s'));
  assert.deepEqual(s.dealer.cards, cards('5h 3d'));
  assert.equal(s.phase, 'play');
  assert.equal(s.turn, 0);
  assert.deepEqual(status(s), { over: false, turn: 1, winners: [], deadline: NOW + 20000 });
});

test('la carte cachée de la banque ne sort jamais de view() tant qu’elle est cachée, ni le sabot', () => {
  let s = game(1, 'Ts 5h 9d 6c 2s');
  s = bet(s, 1, 100);
  for (const id of [1, null]) {
    const v = view(s, id);
    assert.equal(v.dealer.cards[1], null);
    assert.equal(v.dealer.value, null);
    assert.equal(v.dealer.shown, 5);
    const json = JSON.stringify(v);
    assert.ok(!json.includes('"shoe"'));
    assert.equal(v.dealer.cards.includes(card('6c')), false, 'la carte cachée n’est pas dans la vue');
  }
  assert.equal(view(s, 1).shoeLeft, s.shoe.length);
});

test('blackjack payé 3 pour 2, la banque ne tire pas', () => {
  let s = game(1, 'As 9d Kc 7h');
  s = bet(s, 1, 100);
  assert.equal(s.phase, 'result', 'blackjack du joueur : plus rien à jouer');
  assert.equal(s.dealer.cards.length, 2);
  assert.equal(chips(s, 1), 1000 + 150);
  assert.equal(s.seats[0].hands[0].result, 'blackjack');
  assert.equal(s.seats[0].delta, 150);
});

test('blackjack du joueur et de la banque : égalité, mise rendue', () => {
  let s = game(1, 'As Ad Kc Kh');
  s = bet(s, 1, 100);
  assert.equal(s.seats[0].hands[0].natural, true);
  assert.equal(s.phase, 'result');
  assert.equal(s.seats[0].hands[0].result, 'push');
  assert.equal(chips(s, 1), 1000);
});

test('la banque a blackjack (carte visible : as) : la manche s’arrête avant de jouer', () => {
  let s = game(2, '9s Ts Ad Kc 8h 7s'.replace('Kc 8h 7s', 'Qd Kh Js'));
  // joueurs : 9s+Qd = 19 et Ts+Kh = 20 ; banque : Ad + Js = blackjack
  s = bet(s, 1, 100);
  s = bet(s, 2, 50);
  assert.equal(s.phase, 'result');
  assert.equal(s.dealer.revealed, true);
  assert.equal(chips(s, 1), 900);
  assert.equal(chips(s, 2), 950);
  assert.equal(s.seats[0].hands[0].result, 'lose');
  assert.equal(view(s, 1).dealer.blackjack, true);
});

test('la banque a blackjack avec un 10 visible : pareil', () => {
  let s = game(1, 'Ts Kd 9h Ac'.replace('Ts Kd 9h Ac', '9s Kd 8h Ac'));
  s = bet(s, 1, 100);
  assert.equal(s.phase, 'result');
  assert.equal(chips(s, 1), 900);
});

test('l’as visible sans blackjack : la manche continue', () => {
  let s = game(1, '9s Ad 8h 6c');
  s = bet(s, 1, 100);
  assert.equal(s.phase, 'play');
});

test('carte : on tire, 21 arrête tout seul, dépasser 21 perd', () => {
  let s = game(1, '5s 9d 6h 7c 10h'.replace('10h', 'Th') + ' 4d Kd');
  s = bet(s, 1, 100); // joueur 5s 6h = 11 ; banque 9d 7c = 16
  s = play(s, 1, 'hit'); // Th : 21
  assert.equal(s.seats[0].hands[0].done, true, 'à 21 on reste automatiquement');
  assert.equal(s.phase, 'result');
  // la banque 16 tire 4d = 20 : le joueur à 21 gagne
  assert.equal(chips(s, 1), 1100);

  let b = game(1, 'Ts 9d 6h 7c Kd');
  b = bet(b, 1, 100);
  b = play(b, 1, 'hit');
  assert.equal(b.seats[0].hands[0].bust, true);
  assert.equal(b.dealer.cards.length, 2, 'tous les joueurs ont dépassé : la banque ne tire pas');
  assert.equal(chips(b, 1), 900);
});

test('rester : la banque tire jusqu’à 17 et on compare', () => {
  // joueur Ts 9h = 19 ; banque 5d 6c = 11, tire 2s (13) puis 4h (17) : le joueur gagne
  let s = game(1, 'Ts 5d 9h 6c 2s 4h');
  s = bet(s, 1, 100);
  s = play(s, 1, 'stand');
  assert.deepEqual(s.dealer.cards, cards('5d 6c 2s 4h'));
  assert.equal(handValue(s.dealer.cards).total, 17);
  assert.equal(s.seats[0].hands[0].result, 'win');
  assert.equal(chips(s, 1), 1100);
});

test('la banque reste sur un 17 souple, tire sur un 16 souple', () => {
  // banque As + 6 = 17 souple : reste
  let s = game(1, 'Ts Ad 9h 6c 5s');
  s = bet(s, 1, 100);
  s = play(s, 1, 'stand');
  assert.equal(s.dealer.cards.length, 2, 'reste sur 17 souple');
  assert.equal(s.seats[0].hands[0].result, 'win');
  // banque As + 5 = 16 souple : tire un 10 -> 16 dur... As+5+T = 16, tire encore
  let t = game(1, 'Ts Ad 7h 5c Td 2c');
  t = bet(t, 1, 100);
  t = play(t, 1, 'stand');
  assert.deepEqual(t.dealer.cards, cards('Ad 5c Td 2c'));
  assert.equal(handValue(t.dealer.cards).total, 18);
  assert.equal(t.seats[0].hands[0].result, 'lose', '17 contre 18');
});

test('banque qui dépasse : les mains qui restent gagnent', () => {
  // J1 : Ts 9h = 19 ; banque : 6d + Kc = 16, tire Qh = 26
  let s = game(1, 'Ts 6d 9h Kc Qh');
  s = bet(s, 1, 100);
  s = play(s, 1, 'stand');
  assert.equal(view(s, 1).dealer.bust, true);
  assert.equal(s.seats[0].hands[0].result, 'win');
  assert.equal(chips(s, 1), 1100);
});

test('égalité : mise rendue ; moins que la banque : perdu', () => {
  let s = game(2, 'Ts 9s Kd 9c 8h Qd');
  // J1 Ts 9c = 19 ; J2 9s 8h = 17 ; banque Kd Qd = 20
  s = bet(s, 1, 100);
  s = bet(s, 2, 100);
  s = play(s, 1, 'stand');
  s = play(s, 2, 'stand');
  assert.equal(s.seats[0].hands[0].result, 'lose');
  assert.equal(s.seats[1].hands[0].result, 'lose');
  assert.equal(chips(s, 1), 900);
  let p = game(1, 'Ts Kd Qc Qd'); // 20 contre 20
  p = bet(p, 1, 100);
  p = play(p, 1, 'stand');
  assert.equal(p.seats[0].hands[0].result, 'push');
  assert.equal(chips(p, 1), 1000);
});

test('doubler : une seule carte, mise doublée, main terminée', () => {
  let s = game(1, '5s 9d 6h 7c Th 2d');
  s = bet(s, 1, 100); // 11 contre 16
  s = play(s, 1, 'double'); // Th : 21
  assert.equal(chips(s, 1), 1000 - 200 + 400, 'mise doublée gagnée');
  assert.equal(s.seats[0].hands[0].doubled, true);
  assert.equal(s.seats[0].hands[0].cards.length, 3);
  assert.equal(s.phase, 'result');
});

test('doubler est refusé après la première carte ou sans assez de jetons', () => {
  let s = game(1, '2s 9d 3h 6c 4d 2h');
  s = bet(s, 1, 100);
  s = play(s, 1, 'hit'); // 2+3+4 = 9
  assert.throws(() => play(s, 1, 'double'), /deux premières cartes/);
  let t = game(1, '5s 9d 6h 7c Th', { start: 500 });
  t = bet(t, 1, 300);
  assert.throws(() => play(t, 1, 'double'), /Pas assez/);
});

test('doubler et perdre : la mise doublée est perdue', () => {
  let s = game(1, 'Ts 9d 6h 7c Kd');
  s = bet(s, 1, 100);
  s = play(s, 1, 'double');
  assert.equal(s.seats[0].hands[0].bust, true);
  assert.equal(chips(s, 1), 800);
});

test('séparer : deux mains, chacune reçoit une carte, la mise est répétée', () => {
  // J1 : 8s 8h ; banque : 9d 7c ; cartes ensuite : 3d (main 1), 2c (main 2)
  let s = game(1, '8s 9d 8h 7c 3d 2c');
  s = bet(s, 1, 100);
  s = play(s, 1, 'split');
  assert.equal(s.seats[0].hands.length, 2);
  assert.deepEqual(s.seats[0].hands[0].cards, cards('8s 3d'));
  assert.deepEqual(s.seats[0].hands[1].cards, cards('8h 2c'));
  assert.equal(chips(s, 1), 800);
  assert.equal(s.seats[0].hands[0].split, true);
  assert.equal(s.seats[0].cur, 0);
  assert.throws(() => play(s, 1, 'split'), /une seule fois/);
});

test('séparer : on joue la première main puis la seconde', () => {
  let s = game(1, '8s 9d 8h 7c 3d 2c Td 9c Kc');
  s = bet(s, 1, 100);
  s = play(s, 1, 'split');
  s = play(s, 1, 'hit'); // main 1 : 8+3+T = 21 -> automatiquement terminée
  assert.equal(s.seats[0].hands[0].done, true);
  assert.equal(s.seats[0].cur, 1);
  assert.equal(s.turn, 0);
  s = play(s, 1, 'hit'); // main 2 : 8+2+9 = 19
  s = play(s, 1, 'stand');
  assert.equal(s.phase, 'result');
  // banque 9d 7c = 16 -> tire Kc = 26 : bust. Les deux mains gagnent.
  assert.equal(s.seats[0].hands[0].result, 'win', '21 après séparation : pas un blackjack, payé 1 pour 1');
  assert.equal(s.seats[0].hands[1].result, 'win');
  assert.equal(chips(s, 1), 1200);
});

test('séparer des as : une carte chacun, et un 21 n’est pas un blackjack', () => {
  let s = game(1, 'As 9d Ah 7c Kd 5c');
  s = bet(s, 1, 100);
  s = play(s, 1, 'split');
  assert.equal(s.seats[0].hands.every((h) => h.done), true);
  assert.equal(s.phase, 'result');
  assert.deepEqual(s.seats[0].hands.map((h) => h.natural), [false, false]);
  assert.equal(s.seats[0].hands[0].result, 'win', 'A+K = 21 contre 16 + tirage');
  assert.equal(s.seats[0].hands[0].gain, 100, 'pas de 3 pour 2');
});

test('séparer : même valeur seulement (dix et dame se séparent), sinon refusé', () => {
  let s = game(1, 'Ts 9d Qh 7c 3d 2c');
  s = bet(s, 1, 100);
  s = play(s, 1, 'split');
  assert.equal(s.seats[0].hands.length, 2);
  let t = game(1, 'Ts 9d 9h 7c');
  t = bet(t, 1, 100);
  assert.throws(() => play(t, 1, 'split'), /même valeur/);
});

test('séparer sans assez de jetons est refusé', () => {
  let s = game(1, '8s 9d 8h 7c', { start: 500 });
  s = bet(s, 1, 300);
  assert.throws(() => play(s, 1, 'split'), /ne peux pas/);
});

test('hors tour ou action inconnue : refusé', () => {
  let s = game(2, 'Ts 9d 5h 6c 2s 3d');
  s = bet(s, 1, 100);
  s = bet(s, 2, 100);
  assert.throws(() => play(s, 2, 'stand'), /pas ton tour/);
  assert.throws(() => play(s, 1, 'danser'), /inconnue/);
  assert.throws(() => play(s, 1, 'bet', { amount: 10 }), /inconnue/);
});

test('à plusieurs, on joue à tour de rôle, puis la banque', () => {
  let s = game(2, 'Ts 9s 8d 7h 5c 4d Kd Qs');
  s = bet(s, 1, 100); // J1 Ts 5c = 15 ; J2 9s 4d = 13 ; banque 8d 7h = 15
  s = bet(s, 2, 100);
  assert.equal(status(s).turn, 1);
  s = play(s, 1, 'hit'); // Kd : 25 bust
  assert.equal(status(s).turn, 2);
  s = play(s, 2, 'hit'); // Qs : 23 bust
  assert.equal(s.phase, 'result');
  assert.equal(s.dealer.cards.length, 2);
});

test('le minuteur : mise minimale pour ceux qui n’ont pas misé, puis rester', () => {
  let s = game(2, 'Ts 9s 8d 7h 5c 4d');
  s = bet(s, 1, 100);
  let t = timeout(s, ctx(NOW + 20000)).state;
  assert.equal(t.phase, 'play');
  assert.equal(chips(t, 2), 990);
  assert.equal(t.seats[1].hands[0].bet, 10);
  assert.equal(chips(t, 1), 900);
  t = timeout(t, ctx(NOW + 40000)).state;
  assert.equal(t.seats[0].hands[0].done, true, 'rester');
  assert.equal(status(t).turn, 2);
  t = timeout(t, ctx(NOW + 60000)).state;
  assert.equal(t.phase, 'result');
});

test('après le résultat, la manche suivante commence et remet les jetons en jeu', () => {
  let s = game(1, 'Ts 6d 9h Kc Qh');
  s = bet(s, 1, 100);
  s = play(s, 1, 'stand');
  assert.equal(s.deadline, NOW + 8000);
  const t = timeout(s, ctx(NOW + 8000)).state;
  assert.equal(t.phase, 'bet');
  assert.equal(t.round, 2);
  assert.deepEqual(t.seats[0].hands, []);
  assert.deepEqual(t.dealer.cards, []);
  assert.equal(chips(t, 1), 1100);
});

test('le sabot est remélangé quand il reste moins d’un quart des cartes', () => {
  let s = game(1, 'Ts 6d 9h Kc Qh');
  s = bet(s, 1, 100);
  s = play(s, 1, 'stand');
  s = { ...s, shoe: s.shoe.slice(0, 60) };
  const t = timeout(s, ctx(NOW + 8000)).state;
  assert.equal(t.shoe.length, 312);
  assert.equal(t.shuffled, 2);
});

test('dernière manche : phase « over », gagnants = les plus riches', () => {
  let s = game(2, 'Ts 9s 6d 7h 9c Kd', { rounds: 5 }, 5);
  s = bet(s, 1, 100); // J1 Ts 9c = 19 ; J2 9s Kd = 19 ; banque 6d 7h = 13
  s = bet(s, 2, 200);
  s = play(s, 1, 'stand');
  s = play(s, 2, 'stand');
  assert.equal(s.phase, 'over');
  assert.equal(status(s).over, true);
  const v = view(s, 1);
  assert.equal(v.ranking.length, 2);
  const richest = Math.max(chips(s, 1), chips(s, 2));
  assert.ok(status(s).winners.length >= 1);
  for (const id of status(s).winners) assert.equal(chips(s, id), richest);
  assert.equal(v.ranking[0], status(s).winners[0]);
});

test('égalité de jetons à la fin : les deux gagnent', () => {
  let s = game(2, 'Ts 9s 6d 7h 9c Kd', { rounds: 5 }, 5);
  s = bet(s, 1, 100);
  s = bet(s, 2, 100);
  s = play(s, 1, 'stand');
  s = play(s, 2, 'stand');
  assert.equal(s.phase, 'over');
  assert.equal(chips(s, 1), chips(s, 2));
  assert.deepEqual(status(s).winners, [1, 2]);
});

test('manche 4 sur 5 : la partie continue ; l’avant-dernière ne termine pas', () => {
  let s = game(1, 'Ts 6d 9h Kc Qh', { rounds: 5 }, 4);
  s = bet(s, 1, 100);
  s = play(s, 1, 'stand');
  assert.equal(s.phase, 'result');
});

test('éliminé sous la mise minimale ; le dernier joueur à table gagne tout de suite', () => {
  let s = game(2, 'Ts 9s Kd 8c 7h Qd', { start: 500 });
  s = { ...s, seats: s.seats.map((x) => (x.id === 2 ? { ...x, chips: 10 } : x)) };
  s = bet(s, 1, 10);
  s = bet(s, 2, 10);
  s = play(s, 1, 'stand');
  s = play(s, 2, 'stand'); // J1 18, J2 16 contre 20 : les deux perdent
  assert.equal(s.seats[1].out, true);
  assert.equal(chips(s, 2), 0);
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s).winners, [1]);
  assert.deepEqual(view(s, 1).ranking, [1, 2]);
});

test('solo : on gagne si on finit avec au moins ses jetons de départ', () => {
  let s = game(1, 'As 9d Kc 7h', { rounds: 5 }, 5);
  s = bet(s, 1, 100);
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s).winners, [1]);
  let l = game(1, 'Ts 9d 6h 7c Kd', { rounds: 5 }, 5);
  l = bet(l, 1, 100);
  l = play(l, 1, 'hit');
  assert.equal(l.phase, 'over');
  assert.deepEqual(status(l).winners, []);
});

test('solo éliminé : la partie s’arrête', () => {
  let s = game(1, 'Ts 9d 6h 7c Kd', { start: 500 });
  s = { ...s, seats: s.seats.map((x) => ({ ...x, chips: 10 })) };
  s = bet(s, 1, 10);
  s = play(s, 1, 'hit');
  assert.equal(s.phase, 'over');
  assert.equal(s.seats[0].out, true);
});

test('abandon pendant les mises : la partie continue avec les autres', () => {
  let s = game(3, 'Ts 9d');
  s = bet(s, 1, 100);
  s = leave(s, 2, ctx()).state;
  assert.equal(s.seats[1].out, true);
  assert.deepEqual(status(s).turn, [3]);
  s = bet(s, 3, 100);
  assert.equal(s.phase, 'play', 'tout le monde a misé : on distribue');
  assert.equal(s.seats[1].hands.length, 0);
});

test('abandon pendant le jeu : sa mise est perdue et le tour passe au suivant', () => {
  let s = game(2, 'Ts 9s 6d 7h 5c 4d Kd Qs');
  s = bet(s, 1, 100);
  s = bet(s, 2, 100);
  s = leave(s, 1, ctx()).state;
  assert.equal(status(s).turn, 2);
  assert.equal(chips(s, 1), 900);
  s = play(s, 2, 'stand');
  assert.equal(s.phase, 'over', 'il ne reste qu’un joueur face à la banque');
  assert.deepEqual(status(s).winners, [2]);
  assert.equal(chips(s, 1), 900, 'rien n’est rendu à celui qui est parti');
  assert.equal(s.seats[0].hands[0].result, 'lose');
});

test('abandon d’un joueur qui n’avait pas encore joué', () => {
  let s = game(3, 'Ts 9s 8c 6d 7h 5c 4d Kd Qs');
  s = bet(s, 1, 100);
  s = bet(s, 2, 100);
  s = bet(s, 3, 100);
  s = leave(s, 3, ctx()).state;
  assert.equal(status(s).turn, 1);
  s = play(s, 1, 'stand');
  s = play(s, 2, 'stand');
  assert.ok(s.phase === 'result' || s.phase === 'over');
  assert.equal(chips(s, 3), 900);
});

test('abandon du dernier joueur : la partie se termine', () => {
  let s = game(1, 'Ts 9d');
  s = leave(s, 1, ctx()).state;
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s).winners, []);
  assert.equal(leave(s, 1, ctx()).state, s);
});

test('l’état n’est jamais modifié et reste du JSON', () => {
  let s = game(2, 'Ts 9s 6d 7h 9c Kd');
  s = bet(s, 1, 100);
  const before = JSON.stringify(s);
  bet(s, 2, 100);
  try { bet(s, 2, 15); } catch { /* attendu */ }
  view(s, 1);
  status(s);
  timeout(s, ctx(NOW + 99999));
  leave(s, 1, ctx());
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(JSON.parse(before), s);
});

test('parties au hasard : pas d’erreur, jetons entiers et positifs, la partie finit', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const rnd = seeded(seed * 104729);
    const n = 1 + Math.floor(rnd() * 7);
    let s = setup(players(n), { start: [500, 1000][seed % 2], rounds: [5, 10][seed % 2], timer: seed % 3 === 0 ? 0 : 20 }, ctx(NOW, rnd));
    let now = NOW;
    let steps = 0;
    while (s.phase !== 'over' && steps++ < 3000) {
      const st = status(s);
      if (s.phase === 'result') {
        now += 8000;
        s = timeout(s, ctx(now, rnd)).state;
        continue;
      }
      const ids = [].concat(st.turn);
      assert.ok(ids.length > 0, 'quelqu’un doit jouer');
      const id = ids[Math.floor(rnd() * ids.length)];
      const o = view(s, id).me;
      assert.ok(o, 'le joueur voit ses options');
      if (rnd() < 0.01 && s.seats.filter((x) => !x.out).length > 1) {
        s = leave(s, id, ctx(now, rnd)).state;
      } else if (s.phase === 'bet') {
        s = move(s, id, { type: 'bet', amount: Math.max(10, Math.floor((rnd() * o.maxBet) / 10) * 10) }, ctx(now, rnd)).state;
      } else {
        const r = rnd();
        const type = r < 0.15 && o.canDouble ? 'double' : r < 0.25 && o.canSplit ? 'split' : r < 0.6 ? 'hit' : 'stand';
        s = move(s, id, { type }, ctx(now, rnd)).state;
      }
      if (rnd() < 0.02) s = timeout(s, ctx(now + 30000, rnd)).state;
      for (const x of s.seats) {
        assert.ok(Number.isInteger(x.chips) && x.chips >= 0, `jetons valides (graine ${seed})`);
        assert.ok(x.hands.length <= 2);
      }
      assert.ok(s.shoe.length > 0);
    }
    assert.equal(s.phase, 'over', `la partie finit (graine ${seed})`);
    assert.ok(Array.isArray(view(s, null).ranking));
  }
});
