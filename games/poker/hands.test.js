// Tests de l'évaluateur de mains et des pots secondaires : node --test games/poker/*.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate5, bestHand, handName, buildPots, splitPot, CATEGORIES } from './hands.js';

const RANKS = '23456789TJQKA';
const SUITS = 'shdc';
// « As » = as de pique, « Td » = dix de carreau…
const card = (str) => SUITS.indexOf(str[1]) * 13 + RANKS.indexOf(str[0]);
const cards = (str) => str.split(' ').map(card);
const ev = (str) => evaluate5(cards(str));
const best = (str) => bestHand(cards(str));

test('chaque catégorie de main est reconnue', () => {
  assert.equal(ev('As Kd 9h 5c 2s').cat, 0);
  assert.equal(ev('As Ad 9h 5c 2s').cat, 1);
  assert.equal(ev('As Ad 9h 9c 2s').cat, 2);
  assert.equal(ev('As Ad Ah 9c 2s').cat, 3);
  assert.equal(ev('5s 6d 7h 8c 9s').cat, 4);
  assert.equal(ev('As Ks 9s 5s 2s').cat, 5);
  assert.equal(ev('As Ad Ah 9c 9s').cat, 6);
  assert.equal(ev('As Ad Ah Ac 9s').cat, 7);
  assert.equal(ev('5s 6s 7s 8s 9s').cat, 8);
});

test('l’ordre des catégories est strict', () => {
  const ladder = ['As Kd 9h 5c 2s', 'As Ad 9h 5c 2s', 'As Ad 9h 9c 2s', 'As Ad Ah 9c 2s', '5s 6d 7h 8c 9s', 'As Ks 9s 5s 2s', 'As Ad Ah 9c 9s', 'As Ad Ah Ac 9s', '5s 6s 7s 8s 9s'];
  for (let i = 1; i < ladder.length; i++) assert.ok(ev(ladder[i]).score > ev(ladder[i - 1]).score, ladder[i]);
});

test('la roue A-2-3-4-5 est une quinte à 5, la plus petite', () => {
  const wheel = ev('As 2d 3h 4c 5s');
  assert.equal(wheel.cat, 4);
  assert.deepEqual(wheel.ranks, [5]);
  assert.ok(wheel.score < ev('2s 3d 4h 5c 6s').score, 'la quinte au six bat la roue');
  assert.ok(wheel.score > ev('As Ad Ah Kc Qs').score, 'la roue bat un brelan');
  assert.equal(handName(wheel), 'Quinte au cinq');
});

test('la quinte flush : roue, haute carte, royale', () => {
  const wheelFlush = ev('As 2s 3s 4s 5s');
  assert.equal(wheelFlush.cat, 8);
  assert.ok(wheelFlush.score < ev('2s 3s 4s 5s 6s').score);
  assert.ok(ev('9h Th Jh Qh Kh').score < ev('Ah Kh Qh Jh Th').score);
  assert.equal(handName(ev('Ah Kh Qh Jh Th')), 'Quinte flush royale');
  assert.equal(handName(ev('9h Th Jh Qh Kh')), 'Quinte flush au roi');
  assert.ok(ev('2s 3s 4s 5s 6s').score > ev('As Ad Ah Ac Ks').score, 'quinte flush > carré');
});

test('la quinte ne passe pas par-dessus l’As : Q-K-A-2-3 n’est pas une quinte', () => {
  assert.equal(ev('Qs Kd Ah 2c 3s').cat, 0);
  assert.equal(ev('Js Qd Kh Ac 2s').cat, 0);
  assert.equal(ev('Ts Jd Qh Kc As').cat, 4);
});

test('départage par les cartes qui accompagnent', () => {
  assert.ok(ev('As Ad Kh 5c 2s').score > ev('As Ad Qh Jc Ts').score, 'paire d’as : meilleur kicker');
  assert.ok(ev('As Ad Kh 5c 2s').score > ev('Ks Kd Ah 5c 2s').score, 'paire d’as bat paire de rois');
  assert.ok(ev('As Ad Kh Kc 2s').score > ev('As Ad Qh Qc Ks').score, 'double paire : la deuxième paire compte avant le kicker');
  assert.ok(ev('As Ad Kh Kc 3s').score > ev('As Ad Kh Kc 2s').score, 'double paire : le kicker');
  assert.ok(ev('Ks Kd Kh 2c 3s').score > ev('Qs Qd Qh Ac Ks').score, 'brelan de rois bat brelan de dames');
  assert.ok(ev('Ks Kd Kh Ac 3s').score > ev('Ks Kd Kh Qc 3s').score, 'brelan : premier kicker');
  assert.ok(ev('Ks Kd Kh Ac 3s').score > ev('Ks Kd Kh Ac 2s').score, 'brelan : second kicker');
  assert.ok(ev('2s 2d 2h Ac Ad').score < ev('3s 3d 3h 4c 4d').score, 'full : le brelan prime sur la paire');
  assert.ok(ev('3s 3d 3h 2c 2d').score < ev('4s 4d 4h 2c 2d').score);
  assert.ok(ev('As Ad Ah Kc Kd').score > ev('Ks Kd Kh Ac Ad').score, 'full aux as bat full aux rois');
  assert.ok(ev('2s 2d 2h 2c Ks').score < ev('3s 3d 3h 3c 2s').score, 'carré de trois bat carré de deux');
  assert.ok(ev('2s 2d 2h 2c As').score > ev('2s 2d 2h 2c Ks').score, 'carré : kicker');
  assert.ok(ev('As Qs 9s 5s 3s').score > ev('Ks Qs 9s 5s 3s').score, 'couleur : carte la plus haute');
  assert.ok(ev('As Qs 9s 5s 3s').score > ev('As Qs 9s 5s 2s').score, 'couleur : dernière carte');
  assert.ok(ev('As Kd 9h 5c 3s').score > ev('As Kd 9h 5c 2s').score, 'carte haute : dernière carte');
});

test('deux mains équivalentes ont le même score, quelles que soient les couleurs', () => {
  assert.equal(ev('As Kd 9h 5c 3s').score, ev('Ac Kh 9d 5s 3c').score);
  assert.equal(ev('As Ad Kh Kc 3s').score, ev('Ah Ac Kd Ks 3d').score);
  assert.equal(ev('5s 6d 7h 8c 9s').score, ev('5h 6c 7s 8d 9h').score);
  assert.equal(ev('As 2d 3h 4c 5s').score, ev('Ac 2h 3s 4d 5c').score);
});

test('7 cartes : le tableau seul peut former la meilleure main', () => {
  const b = best('2c 3d 4h 5s 6c Kd Kh');
  assert.equal(b.cat, 4);
  assert.equal(handName(b), 'Quinte au six');
});

test('7 cartes : deux brelans donnent un full avec le plus haut brelan', () => {
  const b = best('Ks Kd Kh 7c 7d 7h 2s');
  assert.equal(b.cat, 6);
  assert.deepEqual(b.ranks, [13, 7]);
});

test('7 cartes : trois paires, on garde les deux meilleures et le meilleur kicker', () => {
  const b = best('As Ad Kh Kc 5s 5d Qh');
  assert.equal(b.cat, 2);
  assert.deepEqual(b.ranks, [14, 13, 12], 'le kicker est la dame, pas le cinq');
  const b2 = best('As Ad Kh Kc 5s 5d 6h');
  assert.deepEqual(b2.ranks, [14, 13, 6], 'kicker : le six bat le cinq de la troisième paire');
});

test('7 cartes : couleur à six cartes, on garde les cinq plus hautes', () => {
  const b = best('As Ks Qs 9s 5s 2s 3d');
  assert.equal(b.cat, 5);
  assert.deepEqual(b.ranks, [14, 13, 12, 9, 5]);
});

test('7 cartes : la quinte plus haute est choisie (6 cartes qui se suivent)', () => {
  const b = best('4s 5d 6h 7c 8s 9d Kc');
  assert.equal(b.cat, 4);
  assert.deepEqual(b.ranks, [9]);
});

test('7 cartes : roue avec une paire et une carte haute', () => {
  const b = best('As 2d 3h 4c 5s Ad Kc');
  assert.equal(b.cat, 4);
  assert.deepEqual(b.ranks, [5]);
});

test('7 cartes : une quinte et une couleur séparées ne font pas une quinte flush', () => {
  // quinte 5-9 en couleurs mixtes, couleur à pique sans suite : la couleur (5) bat la quinte (4)
  const b = best('5s 6s 7d 8s 9h As Kd');
  assert.equal(b.cat, 4, 'quatre piques seulement : une quinte, pas une couleur');
  const b2 = best('5s 6s 7s 8s 9h As Ks');
  assert.equal(b2.cat, 5, 'six piques et une quinte avec le 9 de cœur : la couleur bat la quinte, ce n’est pas une quinte flush');
  const b3 = best('5s 6s 7s 8s 9s As Ks');
  assert.equal(b3.cat, 8);
});

test('7 cartes : quinte flush battue par une quinte flush plus haute, pas par une quinte ordinaire', () => {
  const low = best('5h 6h 7h 8h 9h Kd Kc');
  const high = best('6h 7h 8h 9h Th Kd Kc');
  assert.ok(high.score > low.score);
  assert.equal(handName(best('Ah Kh Qh Jh Th 2d 3c')), 'Quinte flush royale');
});

test('7 cartes : le carré avec le meilleur kicker disponible', () => {
  const b = best('9s 9d 9h 9c As 2d 3c');
  assert.equal(b.cat, 7);
  assert.deepEqual(b.ranks, [9, 14]);
});

test('7 cartes : égalité quand le tableau fait la main', () => {
  const board = 'As Ks Qs Js Ts';
  assert.equal(best(`${board} 2d 3c`).score, best(`${board} 4d 5c`).score);
});

test('noms des mains en français', () => {
  assert.equal(handName(ev('As Kd 9h 5c 2s')), 'As haut');
  assert.equal(handName(ev('As Ad 9h 5c 2s')), 'Paire d’as');
  assert.equal(handName(ev('As Ad Kh Kc 2s')), 'Double paire d’as et de rois');
  assert.equal(handName(ev('Ks Kd Kh 9c 9s')), 'Full aux rois par les neuf');
});

test('fréquence des 2 598 960 mains de 5 cartes : les chiffres classiques du poker', () => {
  const counts = new Array(9).fill(0);
  const hand = [0, 0, 0, 0, 0];
  for (let a = 0; a < 48; a++) {
    for (let b = a + 1; b < 49; b++) {
      for (let c = b + 1; c < 50; c++) {
        for (let d = c + 1; d < 51; d++) {
          for (let e = d + 1; e < 52; e++) {
            hand[0] = a; hand[1] = b; hand[2] = c; hand[3] = d; hand[4] = e;
            counts[evaluate5(hand).cat]++;
          }
        }
      }
    }
  }
  assert.deepEqual(counts, [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40]);
  assert.equal(CATEGORIES.length, 9);
});

// ——— Pots secondaires ———

const sum = (list) => list.reduce((n, p) => n + p.amount, 0);

test('pots : tout le monde a mis pareil, un seul pot', () => {
  const pots = buildPots([{ id: 1, total: 100 }, { id: 2, total: 100 }, { id: 3, total: 100 }]);
  assert.deepEqual(pots, [{ amount: 300, eligible: [1, 2, 3] }]);
});

test('pots : un tapis court crée un pot principal et un pot secondaire', () => {
  const pots = buildPots([{ id: 1, total: 100 }, { id: 2, total: 300 }, { id: 3, total: 300 }]);
  assert.deepEqual(pots, [{ amount: 300, eligible: [1, 2, 3] }, { amount: 400, eligible: [2, 3] }]);
});

test('pots : trois tapis différents, et la mise non suivie revient à son auteur', () => {
  const pots = buildPots([{ id: 1, total: 100 }, { id: 2, total: 300 }, { id: 3, total: 500 }]);
  assert.deepEqual(pots, [
    { amount: 300, eligible: [1, 2, 3] },
    { amount: 400, eligible: [2, 3] },
    { amount: 200, eligible: [3] },
  ]);
});

test('pots : un joueur couché alimente les pots mais n’y a pas droit', () => {
  const pots = buildPots([{ id: 1, total: 50, folded: true }, { id: 2, total: 100 }, { id: 3, total: 100 }]);
  assert.deepEqual(pots, [{ amount: 250, eligible: [2, 3] }]);
});

test('pots : couché au milieu des tranches', () => {
  const pots = buildPots([
    { id: 1, total: 20 }, { id: 2, total: 60, folded: true }, { id: 3, total: 100 }, { id: 4, total: 100 },
  ]);
  // tranche 20 : 80 pour 1,3,4 ; tranche 60 : 3×40 = 120 pour 3,4 ; tranche 100 : 2×40 = 80 pour 3,4 (même pot que la précédente)
  assert.deepEqual(pots, [{ amount: 80, eligible: [1, 3, 4] }, { amount: 200, eligible: [3, 4] }]);
});

test('pots : une tranche sans joueur vivant rejoint le pot précédent', () => {
  const pots = buildPots([{ id: 1, total: 50 }, { id: 2, total: 80, folded: true }, { id: 3, total: 50 }]);
  assert.equal(sum(pots), 180);
  assert.deepEqual(pots.map((p) => p.eligible), [[1, 3]]);
});

test('pots : un joueur sans mise ne compte pas', () => {
  const pots = buildPots([{ id: 1, total: 0, folded: true }, { id: 2, total: 40 }, { id: 3, total: 40 }]);
  assert.deepEqual(pots, [{ amount: 80, eligible: [2, 3] }]);
});

test('pots : la somme des pots est toujours la somme des mises (essais au hasard)', () => {
  let x = 7;
  const rnd = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
  for (let k = 0; k < 500; k++) {
    const n = 2 + Math.floor(rnd() * 8);
    const contribs = Array.from({ length: n }, (_, i) => ({ id: i + 1, total: Math.floor(rnd() * 5) * 50 + (rnd() < 0.3 ? 7 : 0), folded: rnd() < 0.3 }));
    if (!contribs.some((c) => !c.folded)) contribs[0].folded = false;
    const pots = buildPots(contribs);
    assert.equal(sum(pots), contribs.reduce((a, c) => a + c.total, 0));
    for (const p of pots) for (const id of p.eligible) assert.ok(!contribs.find((c) => c.id === id).folded);
  }
});

test('partage : un seul gagnant prend tout', () => {
  assert.deepEqual(splitPot(300, [2], [1, 2, 3]), { 2: 300 });
});

test('partage : égalité sans reste', () => {
  assert.deepEqual(splitPot(300, [1, 3], [1, 2, 3]), { 1: 150, 3: 150 });
});

test('partage : le jeton impair va au premier gagnant après le donneur', () => {
  // ordre à partir du joueur après le donneur : 3, 1, 2
  assert.deepEqual(splitPot(301, [1, 3], [3, 1, 2]), { 3: 151, 1: 150 });
  assert.deepEqual(splitPot(301, [1, 3], [1, 2, 3]), { 1: 151, 3: 150 });
});

test('partage : plusieurs jetons en trop vont un par un aux premiers', () => {
  assert.deepEqual(splitPot(100, [1, 2, 3], [2, 3, 1]), { 2: 34, 3: 33, 1: 33 });
  assert.deepEqual(splitPot(101, [1, 2, 3], [2, 3, 1]), { 2: 34, 3: 34, 1: 33 });
  assert.deepEqual(splitPot(2, [1, 2, 3], [1, 2, 3]), { 1: 1, 2: 1, 3: 0 });
});

test('partage : aucun jeton ne se perd (essais au hasard)', () => {
  for (let amount = 0; amount < 200; amount += 7) {
    for (let w = 1; w <= 5; w++) {
      const winners = Array.from({ length: w }, (_, i) => i + 1);
      const gains = splitPot(amount, winners, [5, 4, 3, 2, 1]);
      assert.equal(Object.values(gains).reduce((a, b) => a + b, 0), amount);
    }
  }
});
