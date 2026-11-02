// Tests des règles du Yams : node --test games/yams/rules.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, move, view, status, timeout, leave, scoreBox, totalsOf, allowedBoxes, preview, emptySheet, isYams, BOXES,
} from './rules.js';

const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const OPTS = { turnTime: 0, extraYams: false };
const P = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `joueur${i + 1}` }));
const die = (v) => (v - 1) / 6 + 0.01; // fait sortir la valeur v
function fixed(values) {
  let i = 0;
  return () => values[i++ % values.length];
}
const ctxOf = (values = [1], now = NOW) => ({ now, random: fixed(values.map(die)) });

// Un état où le joueur dont c'est le tour a déjà lancé, avec ces dés et ces cases remplies.
function withDice(s, dice, { rolls = 1, boxes = {}, id = s.turn, extraYams } = {}) {
  const sheet = s.sheets[id];
  return {
    ...s,
    dice,
    rolls,
    sheets: { ...s.sheets, [id]: { boxes: { ...sheet.boxes, ...boxes }, extraYams: extraYams ?? sheet.extraYams } },
  };
}

test('cases du haut : somme des dés de la valeur choisie', () => {
  assert.equal(scoreBox('ones', [1, 1, 2, 3, 6]), 2);
  assert.equal(scoreBox('twos', [2, 2, 2, 3, 6]), 6);
  assert.equal(scoreBox('threes', [3, 1, 2, 3, 6]), 6);
  assert.equal(scoreBox('fours', [4, 4, 4, 4, 4]), 20);
  assert.equal(scoreBox('fives', [1, 2, 3, 4, 6]), 0);
  assert.equal(scoreBox('sixes', [6, 6, 1, 6, 2]), 18);
});

test('brelan et carré : total de tous les dés, sinon 0', () => {
  assert.equal(scoreBox('brelan', [3, 3, 3, 5, 6]), 20);
  assert.equal(scoreBox('brelan', [3, 3, 4, 5, 6]), 0);
  assert.equal(scoreBox('brelan', [2, 2, 2, 2, 5]), 13, 'un carré est aussi un brelan');
  assert.equal(scoreBox('carre', [2, 2, 2, 2, 5]), 13);
  assert.equal(scoreBox('carre', [2, 2, 2, 5, 5]), 0);
  assert.equal(scoreBox('carre', [6, 6, 6, 6, 6]), 30);
});

test('full : 3 + 2 = 25, pas un carré, ni un Yams', () => {
  assert.equal(scoreBox('full', [2, 2, 5, 5, 5]), 25);
  assert.equal(scoreBox('full', [5, 2, 5, 2, 5]), 25);
  assert.equal(scoreBox('full', [2, 2, 2, 2, 5]), 0);
  assert.equal(scoreBox('full', [4, 4, 4, 4, 4]), 0);
  assert.equal(scoreBox('full', [1, 2, 3, 3, 3]), 0);
});

test('petite suite (4 à la suite) = 30, grande suite (5) = 40', () => {
  assert.equal(scoreBox('petite', [1, 2, 3, 4, 6]), 30);
  assert.equal(scoreBox('petite', [2, 3, 4, 5, 5]), 30);
  assert.equal(scoreBox('petite', [6, 3, 4, 5, 3]), 30);
  assert.equal(scoreBox('petite', [1, 2, 3, 5, 6]), 0);
  assert.equal(scoreBox('petite', [1, 2, 3, 3, 3]), 0);
  assert.equal(scoreBox('petite', [1, 2, 3, 4, 5]), 30, 'une grande suite contient une petite');
  assert.equal(scoreBox('grande', [1, 2, 3, 4, 5]), 40);
  assert.equal(scoreBox('grande', [6, 5, 4, 3, 2]), 40);
  assert.equal(scoreBox('grande', [1, 2, 3, 4, 6]), 0);
  assert.equal(scoreBox('grande', [1, 2, 3, 4, 4]), 0);
});

test('Yams = 50, chance = total', () => {
  assert.equal(scoreBox('yams', [3, 3, 3, 3, 3]), 50);
  assert.equal(scoreBox('yams', [3, 3, 3, 3, 4]), 0);
  assert.equal(isYams([6, 6, 6, 6, 6]), true);
  assert.equal(scoreBox('chance', [1, 2, 3, 4, 6]), 16);
  assert.equal(scoreBox('chance', [6, 6, 6, 6, 6]), 30);
  assert.throws(() => scoreBox('autre', [1, 1, 1, 1, 1]), /Case inconnue/);
});

test('bonus de 35 si le haut atteint 63 (à 62 : rien)', () => {
  const s = emptySheet();
  Object.assign(s.boxes, { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 });
  assert.deepEqual(totalsOf(s), { upper: 63, bonus: 35, lower: 0, extra: 0, total: 98 });
  s.boxes.ones = 2;
  assert.deepEqual(totalsOf(s), { upper: 62, bonus: 0, lower: 0, extra: 0, total: 62 });
  s.boxes.chance = 20;
  s.boxes.yams = 50;
  s.extraYams = 2;
  assert.deepEqual(totalsOf(s), { upper: 62, bonus: 0, lower: 70, extra: 200, total: 332 });
});

test('setup : feuilles vides, le premier joueur commence, aucun dé lancé', () => {
  const s = setup(P(3), OPTS, ctxOf());
  assert.equal(s.turn, 1);
  assert.deepEqual(s.dice, []);
  assert.equal(s.rolls, 0);
  for (const id of [1, 2, 3]) assert.ok(BOXES.every((b) => s.sheets[id].boxes[b] === null));
  assert.throws(() => setup([], OPTS, ctxOf()), /au moins 1 joueur/);
  assert.throws(() => setup(P(7), OPTS, ctxOf()), /6 joueurs/);
  assert.equal(setup(P(1), OPTS, ctxOf()).turn, 1);
});

test('lancer : le premier lancer tire 5 dés avec ctx.random, de 1 à 6', () => {
  let s = setup(P(2), OPTS, ctxOf());
  s = move(s, 1, { type: 'roll' }, ctxOf([1, 2, 3, 4, 5])).state;
  assert.deepEqual(s.dice, [1, 2, 3, 4, 5]);
  assert.equal(s.rolls, 1);
  assert.deepEqual(s.rerolled, [0, 1, 2, 3, 4]);
  // Les valeurs restent dans 1..6 même avec un hasard extrême.
  let t = setup(P(1), OPTS, ctxOf());
  t = move(t, 1, { type: 'roll' }, { now: NOW, random: () => 0.9999999 }).state;
  assert.deepEqual(t.dice, [6, 6, 6, 6, 6]);
  t = setup(P(1), OPTS, ctxOf());
  t = move(t, 1, { type: 'roll' }, { now: NOW, random: () => 0 }).state;
  assert.deepEqual(t.dice, [1, 1, 1, 1, 1]);
});

test('lancer : on garde les dés choisis, on relance les autres, 3 lancers au maximum', () => {
  let s = setup(P(2), OPTS, ctxOf());
  s = move(s, 1, { type: 'roll' }, ctxOf([1, 2, 3, 4, 5])).state;
  s = move(s, 1, { type: 'roll', keep: [0, 4] }, ctxOf([6, 6, 6])).state;
  assert.deepEqual(s.dice, [1, 6, 6, 6, 5]);
  assert.deepEqual(s.rerolled, [1, 2, 3]);
  assert.equal(s.rolls, 2);
  s = move(s, 1, { type: 'roll', keep: [1, 2, 3] }, ctxOf([2, 2])).state;
  assert.deepEqual(s.dice, [2, 6, 6, 6, 2]);
  assert.equal(s.rolls, 3);
  assert.throws(() => move(s, 1, { type: 'roll', keep: [] }, ctxOf()), /déjà lancé 3 fois/);
});

test('lancer : refus du mauvais joueur, des indices faux, de « tout garder »', () => {
  let s = setup(P(2), OPTS, ctxOf());
  assert.throws(() => move(s, 2, { type: 'roll' }, ctxOf()), /pas ton tour/);
  s = move(s, 1, { type: 'roll' }, ctxOf([1, 2, 3, 4, 5])).state;
  assert.throws(() => move(s, 1, { type: 'roll', keep: [7] }, ctxOf()), /Dé inconnu/);
  assert.throws(() => move(s, 1, { type: 'roll', keep: [-1] }, ctxOf()), /Dé inconnu/);
  assert.throws(() => move(s, 1, { type: 'roll', keep: ['a'] }, ctxOf()), /Dé inconnu/);
  assert.throws(() => move(s, 1, { type: 'roll', keep: [0, 1, 2, 3, 4] }, ctxOf()), /relâche-en au moins un/);
  assert.throws(() => move(s, 1, { type: 'tricher' }, ctxOf()), /Action inconnue/);
  // keep absent ou mal formé : on relance tout
  const t = move(s, 1, { type: 'roll', keep: 'oui' }, ctxOf([6, 6, 6, 6, 6])).state;
  assert.deepEqual(t.dice, [6, 6, 6, 6, 6]);
});

test('inscrire : refusé avant le premier lancer, sur une case remplie ou inconnue', () => {
  let s = setup(P(2), OPTS, ctxOf());
  assert.throws(() => move(s, 1, { type: 'score', box: 'chance' }, ctxOf()), /Lance les dés/);
  s = withDice(s, [1, 2, 3, 4, 6], { boxes: { chance: 16 } });
  assert.throws(() => move(s, 1, { type: 'score', box: 'chance' }, ctxOf()), /déjà remplie/);
  assert.throws(() => move(s, 1, { type: 'score', box: 'bidule' }, ctxOf()), /Case inconnue/);
  assert.throws(() => move(s, 2, { type: 'score', box: 'ones' }, ctxOf()), /pas ton tour/);
});

test('inscrire : les points entrent dans la case, le tour passe au joueur suivant avec des dés neufs', () => {
  let s = setup(P(2), OPTS, ctxOf());
  s = withDice(s, [3, 3, 3, 5, 6]);
  s = move(s, 1, { type: 'score', box: 'threes' }, ctxOf()).state;
  assert.equal(s.sheets[1].boxes.threes, 9);
  assert.equal(s.turn, 2);
  assert.deepEqual(s.dice, []);
  assert.equal(s.rolls, 0);
  assert.deepEqual(s.last, { id: 1, box: 'threes', points: 9, extra: false, auto: false });
  // Barrer une case : 0 point.
  s = withDice(s, [1, 2, 3, 5, 6]);
  s = move(s, 2, { type: 'score', box: 'yams' }, ctxOf()).state;
  assert.equal(s.sheets[2].boxes.yams, 0);
  assert.equal(s.turn, 1, 'le tour revient au premier joueur');
});

test('13 tours : la partie se termine quand toutes les feuilles sont pleines, le plus gros total gagne', () => {
  let s = setup(P(2), OPTS, ctxOf());
  for (let round = 0; round < 13; round += 1) {
    for (const id of [1, 2]) {
      assert.equal(s.over, false);
      assert.equal(s.turn, id);
      // Le joueur 1 fait des 6 partout ; le joueur 2 des dés pauvres.
      const dice = id === 1 ? [6, 6, 6, 6, 6] : [1, 2, 3, 4, 6];
      s = move(s, id, { type: 'roll' }, ctxOf(dice)).state;
      s = move(s, id, { type: 'score', box: BOXES[round] }, ctxOf()).state;
    }
  }
  assert.equal(s.over, true);
  assert.deepEqual(status(s), { turn: null, over: true, winners: [1], deadline: null });
  assert.equal(totalsOf(s.sheets[1]).total > totalsOf(s.sheets[2]).total, true);
  assert.throws(() => move(s, 1, { type: 'roll' }, ctxOf()), /terminée/);
});

test('égalité : plusieurs gagnants', () => {
  let s = setup(P(2), OPTS, ctxOf());
  for (let round = 0; round < 13; round += 1) {
    for (const id of [1, 2]) {
      s = move(s, id, { type: 'roll' }, ctxOf([1, 2, 3, 4, 6])).state;
      s = move(s, id, { type: 'score', box: BOXES[round] }, ctxOf()).state;
    }
  }
  assert.deepEqual(s.winners, [1, 2]);
});

test('partie solo : 13 tours, on gagne', () => {
  let s = setup(P(1), OPTS, ctxOf());
  for (const box of BOXES) {
    s = move(s, 1, { type: 'roll' }, ctxOf([2, 2, 2, 2, 2])).state;
    s = move(s, 1, { type: 'score', box }, ctxOf()).state;
  }
  assert.equal(s.over, true);
  assert.deepEqual(s.winners, [1]);
});

test('Yams supplémentaire coupé : un 2e Yams compte comme n\'importe quels dés', () => {
  let s = setup(P(1), OPTS, ctxOf());
  s = withDice(s, [4, 4, 4, 4, 4], { boxes: { yams: 50 } });
  assert.equal(allowedBoxes(s.sheets[1], s.dice, s.options).length, 12);
  assert.equal(preview(s.sheets[1], s.dice, s.options).full, 0);
  s = move(s, 1, { type: 'score', box: 'chance' }, ctxOf()).state;
  assert.equal(s.sheets[1].boxes.chance, 20);
  assert.equal(s.sheets[1].extraYams, 0);
});

test('Yams supplémentaire : +100 si le Yams vaut 50, case du haut d\'abord, joker ensuite', () => {
  const opts = { turnTime: 0, extraYams: true };
  let s = setup(P(1), opts, ctxOf());
  s = withDice(s, [4, 4, 4, 4, 4], { boxes: { yams: 50 } });
  // Case des 4 libre : obligatoire.
  assert.deepEqual(Object.keys(preview(s.sheets[1], s.dice, opts)), ['fours']);
  assert.throws(() => move(s, 1, { type: 'score', box: 'full' }, ctxOf()), /dois remplir les 4/);
  const t = move(s, 1, { type: 'score', box: 'fours' }, ctxOf()).state;
  assert.equal(t.sheets[1].boxes.fours, 20);
  assert.equal(t.sheets[1].extraYams, 1);
  assert.equal(totalsOf(t.sheets[1]).extra, 100);
  assert.equal(t.last.extra, true);

  // Case des 4 prise : une case du bas, en joker (full 25, petite 30, grande 40 à leur valeur).
  let u = setup(P(1), opts, ctxOf());
  u = withDice(u, [4, 4, 4, 4, 4], { boxes: { yams: 50, fours: 16 } });
  const pv = preview(u.sheets[1], u.dice, opts);
  assert.deepEqual(Object.keys(pv).sort(), ['brelan', 'carre', 'chance', 'full', 'grande', 'petite']);
  assert.equal(pv.full, 25);
  assert.equal(pv.petite, 30);
  assert.equal(pv.grande, 40);
  assert.equal(pv.brelan, 20);
  assert.throws(() => move(u, 1, { type: 'score', box: 'ones' }, ctxOf()), /case du bas/);
  assert.equal(move(u, 1, { type: 'score', box: 'grande' }, ctxOf()).state.sheets[1].boxes.grande, 40);

  // Le bas est plein : n'importe quelle case du haut libre (0 point si ce n'est pas la bonne valeur).
  let w = setup(P(1), opts, ctxOf());
  w = withDice(w, [4, 4, 4, 4, 4], { boxes: { yams: 50, fours: 16, brelan: 1, carre: 1, full: 1, petite: 1, grande: 1, chance: 1 } });
  assert.deepEqual(Object.keys(preview(w.sheets[1], w.dice, opts)), ['ones', 'twos', 'threes', 'fives', 'sixes']);
  assert.equal(move(w, 1, { type: 'score', box: 'sixes' }, ctxOf()).state.sheets[1].boxes.sixes, 0);
});

test('Yams supplémentaire : pas de bonus si le Yams a été barré (0), mais le joker s\'applique', () => {
  const opts = { turnTime: 0, extraYams: true };
  let s = setup(P(1), opts, ctxOf());
  s = withDice(s, [2, 2, 2, 2, 2], { boxes: { yams: 0, twos: 4 } });
  s = move(s, 1, { type: 'score', box: 'full' }, ctxOf()).state;
  assert.equal(s.sheets[1].boxes.full, 25);
  assert.equal(s.sheets[1].extraYams, 0);
});

test('Yams supplémentaire : le premier Yams se joue normalement (case Yams libre)', () => {
  const opts = { turnTime: 0, extraYams: true };
  let s = setup(P(1), opts, ctxOf());
  s = withDice(s, [6, 6, 6, 6, 6]);
  const pv = preview(s.sheets[1], s.dice, opts);
  assert.equal(pv.yams, 50);
  assert.equal(pv.full, 0);
  assert.equal(Object.keys(pv).length, 13);
});

test('minuteur : lance si besoin, puis inscrit dans la case qui rapporte le plus', () => {
  const opts = { turnTime: 60, extraYams: false };
  const s = setup(P(2), opts, ctxOf());
  assert.equal(s.deadline, NOW + 60_000);
  assert.equal(status(s).deadline, NOW + 60_000);
  // Rien lancé : lancer automatique [6,6,6,2,1] (21 points). Brelan et chance rapportent 21 : le brelan (plus difficile) passe devant.
  const r = timeout(s, ctxOf([6, 6, 6, 2, 1], NOW + 61_000));
  assert.equal(r.state.sheets[1].boxes.brelan, 21);
  assert.equal(r.state.sheets[1].boxes.chance, null);
  assert.equal(r.state.turn, 2);
  assert.equal(r.state.last.auto, true);
  assert.equal(r.state.deadline, NOW + 121_000, 'le tour suivant a son propre minuteur');
  assert.equal(r.state.rolls, 0);

  // Dés déjà lancés : on garde ces dés. Un Yams de 3 : la case Yams (50) bat tout.
  const t = timeout(withDice(setup(P(2), opts, ctxOf()), [3, 3, 3, 3, 3], { rolls: 2 }), ctxOf());
  assert.equal(t.state.sheets[1].boxes.yams, 50);
});

test('minuteur : quand tout rapporte 0, on sacrifie la case la moins utile', () => {
  const opts = { turnTime: 60, extraYams: false };
  let s = setup(P(1), opts, ctxOf());
  // Seules yams, grande et ones sont libres ; dés [2,2,3,4,6] : tout vaut 0, on barre les 1.
  const taken = Object.fromEntries(BOXES.filter((b) => !['yams', 'grande', 'ones'].includes(b)).map((b) => [b, 1]));
  s = withDice(s, [2, 2, 3, 4, 6], { rolls: 1, boxes: taken });
  const r = timeout(s, ctxOf()).state;
  assert.equal(r.sheets[1].boxes.ones, 0);
  assert.equal(r.sheets[1].boxes.yams, null);
});

test('minuteur : respecte la règle du joker', () => {
  const opts = { turnTime: 60, extraYams: true };
  let s = setup(P(1), opts, ctxOf());
  s = withDice(s, [5, 5, 5, 5, 5], { rolls: 1, boxes: { yams: 50 } });
  const r = timeout(s, ctxOf()).state;
  assert.equal(r.sheets[1].boxes.fives, 25, 'la case des 5 est obligatoire');
  assert.equal(r.sheets[1].extraYams, 1);
});

test('leave : le joueur sort, les autres continuent', () => {
  let s = setup(P(3), OPTS, ctxOf());
  s = leave(s, 2, ctxOf()).state;
  assert.deepEqual(s.left, [2]);
  assert.equal(s.turn, 1);
  // Le tour saute le joueur parti.
  s = withDice(s, [1, 1, 1, 1, 1]);
  s = move(s, 1, { type: 'score', box: 'ones' }, ctxOf()).state;
  assert.equal(s.turn, 3);
  s = withDice(s, [1, 1, 1, 1, 1]);
  s = move(s, 3, { type: 'score', box: 'ones' }, ctxOf()).state;
  assert.equal(s.turn, 1);
});

test('leave : pendant son tour, le suivant reçoit la main avec des dés neufs ; la partie se finit sans lui', () => {
  let s = setup(P(3), { turnTime: 60, extraYams: false }, ctxOf());
  s = move(s, 1, { type: 'roll' }, ctxOf([1, 2, 3, 4, 5])).state;
  s = leave(s, 1, ctxOf([1], NOW + 10_000)).state;
  assert.equal(s.turn, 2);
  assert.deepEqual(s.dice, []);
  assert.equal(s.rolls, 0);
  assert.equal(s.deadline, NOW + 70_000);
  // 13 tours à deux : 2 et 3 remplissent leur feuille, 1 est ignoré.
  for (let round = 0; round < 13; round += 1) {
    for (const id of [2, 3]) {
      assert.equal(s.turn, id);
      s = move(s, id, { type: 'roll' }, ctxOf([5, 5, 5, 5, 5])).state;
      s = move(s, id, { type: 'score', box: BOXES[round] }, ctxOf()).state;
    }
  }
  assert.equal(s.over, true);
  assert.equal(s.winners.includes(1), false);
});

test('leave : il ne reste qu\'un joueur d\'une partie à plusieurs, il gagne ; en solo, la partie s\'arrête sans gagnant', () => {
  const s = leave(setup(P(2), OPTS, ctxOf()), 1, ctxOf()).state;
  assert.equal(s.over, true);
  assert.deepEqual(s.winners, [2]);
  assert.deepEqual(status(s).winners, [2]);
  const solo = leave(setup(P(1), OPTS, ctxOf()), 1, ctxOf()).state;
  assert.equal(solo.over, true);
  assert.deepEqual(solo.winners, []);
  assert.deepEqual(leave(s, 2, ctxOf()).state, s, 'après la fin, rien ne change');
});

test('view : tout est public ; les points possibles ne sont montrés qu\'au joueur dont c\'est le tour', () => {
  let s = setup(P(2), OPTS, ctxOf());
  assert.equal(view(s, 1).preview, null, 'avant le premier lancer');
  s = withDice(s, [3, 3, 3, 5, 6]);
  const mine = view(s, 1);
  assert.equal(mine.preview.threes, 9);
  assert.equal(mine.preview.brelan, 20);
  assert.equal(mine.preview.yams, 0);
  assert.equal(view(s, 2).preview, null);
  assert.equal(view(s, null).preview, null);
  assert.deepEqual(mine.dice, [3, 3, 3, 5, 6]);
  assert.equal(mine.round, 1);
  assert.equal(mine.totals[1].total, 0);
  s = move(s, 1, { type: 'score', box: 'threes' }, ctxOf()).state;
  assert.equal(view(s, 2).totals[1].total, 9);
  assert.equal(view(s, 2).sheets[1].boxes.threes, 9);
  assert.equal(view(s, 2).round, 1, 'le joueur 2 en est à son premier tour');
});

test('parties complètes au hasard (joueurs automatiques) : toujours 13 cases remplies pour tous', () => {
  let seed = 98765;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let g = 0; g < 100; g += 1) {
    const n = 1 + (g % 6);
    const ctx = { now: NOW, random: rnd };
    let s = setup(P(n), { turnTime: g % 2 ? 60 : 0, extraYams: g % 3 === 0 }, ctx);
    let steps = 0;
    while (!s.over) {
      steps += 1;
      assert.ok(steps < 2000, 'la partie ne finit pas');
      const id = s.turn;
      if (rnd() < 0.3) { s = timeout(s, ctx).state; continue; }
      s = move(s, id, { type: 'roll' }, ctx).state;
      if (rnd() < 0.6) s = move(s, id, { type: 'roll', keep: [0, 1] }, ctx).state;
      const allowed = Object.keys(view(s, id).preview);
      s = move(s, id, { type: 'score', box: allowed[Math.floor(rnd() * allowed.length)] }, ctx).state;
    }
    for (const id of s.players) assert.ok(BOXES.every((b) => s.sheets[id].boxes[b] !== null));
    assert.ok(s.winners.length >= 1);
  }
});
