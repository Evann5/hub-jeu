// Tests des règles de la bataille navale : node --test games/bataille-navale/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, view, status, timeout, leave, checkFleet, randomFleet, cellsOf, FLEET } from './rules.js';

const players = [{ id: 1, pseudo: 'ana' }, { id: 2, pseudo: 'bob' }];
const T0 = 1_000_000;
const ctx = (random = () => 0.9, now = T0) => ({ now, random });

// Générateur pseudo-aléatoire déterministe pour les tests de placement.
function seeded(seed) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

// Flotte rangée en lignes : un bateau par ligne, à gauche.
const lined = (offset = 0) => FLEET.map((size, i) => ({ size, r: i * 2 + offset, c: 0, h: true }));
const ready = (s, id, ships, c = ctx()) => move(s, id, { type: 'ready', ships }, c).state;
const fireAt = (s, id, cell, c = ctx()) => move(s, id, { type: 'fire', cell }, c).state;

// Partie prête à tirer : 1 a la flotte « lined(0) », 2 a « lined(1) » ; random 0.1 → la place 0 (joueur 1) commence.
function started(options = {}) {
  let s = setup(players, options);
  s = ready(s, 1, lined(0), ctx(() => 0.1));
  s = ready(s, 2, lined(1), ctx(() => 0.1));
  return s;
}

test('la flotte classique a 5 bateaux : 5, 4, 3, 3, 2', () => {
  assert.deepEqual(FLEET, [5, 4, 3, 3, 2]);
});

test('placement : une flotte valide est acceptée', () => {
  const ships = checkFleet(lined());
  assert.equal(ships.length, 5);
  assert.deepEqual(cellsOf({ size: 3, r: 2, c: 4, h: false }), [24, 34, 44]);
});

test('placement : bateau hors grille, qui dépasse, qui chevauche, flotte incomplète ou fausse', () => {
  const bad = (mut, re) => assert.throws(() => checkFleet(mut(lined())), re);
  bad((f) => { f[0].c = 6; return f; }, /dépasse/);
  bad((f) => { f[1].r = 10; return f; }, /hors de la grille/);
  bad((f) => { f[1].r = f[0].r; return f; }, /chevauchent/);
  bad((f) => f.slice(1), /Place les 5 bateaux/);
  bad((f) => { f[0].size = 4; return f; }, /5, 4, 3, 3 et 2/);
  assert.throws(() => checkFleet(null), /Place les 5 bateaux/);
});

test('placement au hasard : toujours une flotte valide, et le hasard fixé donne le même résultat', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const fleet = randomFleet(seeded(seed));
    assert.doesNotThrow(() => checkFleet(fleet));
    assert.deepEqual(fleet, randomFleet(seeded(seed)));
  }
});

test('placement : « random » pose la flotte côté serveur sans la valider', () => {
  let s = setup(players, {});
  s = move(s, 1, { type: 'random' }, ctx(seeded(7))).state;
  assert.equal(s.fleets[0].length, 5);
  assert.equal(s.ready[0], false);
  assert.deepEqual(status(s).turn, [1, 2]);
});

test('placement simultané : « prêt » retire le joueur des gens attendus, la partie démarre quand les deux sont prêts', () => {
  let s = setup(players, {});
  assert.deepEqual(status(s).turn, [1, 2]);
  s = ready(s, 2, lined(1));
  assert.deepEqual(status(s).turn, [1]);
  assert.equal(s.phase, 'placing');
  assert.throws(() => move(s, 2, { type: 'random' }, ctx()), /attends ton adversaire/);
  assert.throws(() => move(s, 1, { type: 'fire', cell: 0 }, ctx()), /Place ta flotte/);
  s = ready(s, 1, lined(0), ctx(() => 0.9));
  assert.equal(s.phase, 'firing');
  assert.equal(s.turn, 1); // random 0.9 → la place 1 commence
  assert.equal(status(s).turn, 2);
});

test('tirs : à l\'eau, touché, coulé, et le tour passe', () => {
  let s = started();
  assert.equal(status(s).turn, 1);
  // Joueur 1 vise la flotte de 2 (lignes 1, 3, 5, 7, 9). Case 99 : eau.
  s = fireAt(s, 1, 0); // ligne 0 : eau (la flotte de 2 commence à la ligne 1)
  assert.equal(s.last.result, 'miss');
  assert.equal(status(s).turn, 2);
  s = fireAt(s, 2, 0); // le porte-avions de 1 est sur 0..4 → touché
  assert.equal(s.last.result, 'hit');
  assert.equal(status(s).turn, 1);
});

test('tirs : un bateau coulé est annoncé avec sa taille et ses cases', () => {
  let s = started();
  s = fireAt(s, 1, 90); // eau, ligne 9 : bateau de 2 en 90..91 ! en fait touché
  assert.equal(s.last.result, 'hit');
  s = fireAt(s, 2, 99);
  s = fireAt(s, 1, 91);
  assert.equal(s.last.result, 'sunk');
  assert.equal(s.last.size, 2);
  assert.deepEqual(s.shots[0].at(-1).ship, { size: 2, cells: [90, 91] });
});

test('tirs : case déjà jouée, hors grille, pas son tour, mauvaise phase', () => {
  let s = started();
  assert.throws(() => fireAt(s, 2, 0), /pas ton tour/);
  s = fireAt(s, 1, 0);
  s = fireAt(s, 2, 50);
  assert.throws(() => fireAt(s, 1, 0), /déjà tiré/);
  assert.throws(() => fireAt(s, 1, 100), /n’existe pas/);
  assert.throws(() => fireAt(s, 1, -1), /n’existe pas/);
  assert.throws(() => fireAt(s, 1, 'a'), /n’existe pas/);
  assert.throws(() => move(s, 1, { type: 'ready', ships: lined() }, ctx()), /moment de tirer/);
  assert.throws(() => move(s, 99, { type: 'fire', cell: 3 }, ctx()), /regardes/);
});

test('option « rejouer après une touche » : touché ou coulé rejoue, eau passe la main', () => {
  let s = started({ salvo: true });
  s = fireAt(s, 1, 90); // touché
  assert.equal(status(s).turn, 1);
  s = fireAt(s, 1, 91); // coulé
  assert.equal(s.last.result, 'sunk');
  assert.equal(status(s).turn, 1);
  s = fireAt(s, 1, 0); // eau
  assert.equal(status(s).turn, 2);
});

test('sans l\'option, une touche ne fait pas rejouer', () => {
  let s = started({ salvo: false });
  s = fireAt(s, 1, 90);
  assert.equal(status(s).turn, 2);
});

test('victoire : toute la flotte coulée', () => {
  let s = started({ salvo: true });
  const targets = lined(1).flatMap(cellsOf);
  for (const cell of targets) s = fireAt(s, 1, cell);
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s), { turn: null, over: true, winners: [1] });
  assert.throws(() => fireAt(s, 2, 0), /terminée/);
});

test('victoire alternée : le dernier tir gagne même sans l\'option', () => {
  let s = started();
  const targets = lined(1).flatMap(cellsOf);
  let miss = 5; // cases d'eau pour l'autre joueur, lignes paires de la flotte 1… on tire à des cases distinctes
  for (const cell of targets) {
    s = fireAt(s, 1, cell);
    if (s.phase === 'over') break;
    s = fireAt(s, 2, miss);
    miss += 1;
  }
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 1);
});

test('view : on ne voit jamais la flotte adverse avant la fin', () => {
  const s = started();
  const v1 = view(s, 1);
  assert.deepEqual(v1.fleet, s.fleets[0]);
  assert.equal(v1.fleets, null);
  assert.equal(JSON.stringify(v1).includes(JSON.stringify(s.fleets[1])), false);
  const v2 = view(s, 2);
  assert.deepEqual(v2.fleet, s.fleets[1]);
  const spectator = view(s, null);
  assert.equal(spectator.fleet, null);
  assert.equal(spectator.fleets, null);
  assert.equal(spectator.seat, -1);
});

test('view : pendant le placement, l\'adversaire ne voit rien de ma flotte', () => {
  let s = setup(players, {});
  s = move(s, 1, { type: 'random' }, ctx(seeded(3))).state;
  assert.equal(view(s, 2).fleet.length, 0);
  assert.equal(view(s, 2).fleets, null);
  assert.equal(view(s, 1).fleet.length, 5);
});

test('view : un bateau coulé est révélé par les tirs, pas les autres', () => {
  let s = started();
  s = fireAt(s, 1, 90);
  s = fireAt(s, 2, 99);
  s = fireAt(s, 1, 91);
  const v = view(s, 1);
  assert.equal(v.shots[0].at(-1).ship.size, 2);
  assert.equal(v.fleets, null);
});

test('à la fin, les deux flottes sont visibles de tous', () => {
  let s = started();
  s = leave(s, 2).state;
  const v = view(s, null);
  assert.equal(v.fleets.length, 2);
  assert.equal(v.fleets[0].length, 5);
});

test('minuteur : échéance posée à chaque tir, tir au hasard sur une case jamais visée', () => {
  let s = setup(players, { timer: 30 });
  s = ready(s, 1, lined(0), ctx(() => 0.1, T0));
  s = ready(s, 2, lined(1), ctx(() => 0.1, T0));
  assert.equal(status(s).deadline, T0 + 30_000);
  s = fireAt(s, 1, 0, ctx(() => 0.1, T0 + 5_000));
  assert.equal(status(s).deadline, T0 + 35_000);
  assert.equal(setup(players, {}).deadline, null);
  // Timeout du joueur 2 : random 0 → première case libre (0, déjà jouée par 1 mais pas par 2 → 0).
  const t = timeout(s, ctx(() => 0, T0 + 36_000)).state;
  assert.equal(t.shots[1].length, 1);
  assert.equal(t.shots[1][0].cell, 0);
  assert.equal(t.last.by, 1);
  assert.equal(status(t).turn, 1);
  assert.equal(status(t).deadline, T0 + 66_000);
});

test('minuteur : ne choisit jamais une case déjà jouée', () => {
  let s = setup(players, { timer: 15 });
  s = ready(s, 1, lined(0), ctx(() => 0.1));
  s = ready(s, 2, lined(1), ctx(() => 0.1));
  s = fireAt(s, 1, 10);
  s = fireAt(s, 2, 0);
  s = fireAt(s, 1, 11);
  s = fireAt(s, 2, 1);
  // Place 0 a joué 10 et 11 ; avec random à 0 le tir tombe sur la case 0, pas sur 10 ni 11.
  const t = timeout(s, ctx(() => 0)).state;
  assert.equal(t.shots[0].at(-1).cell, 0);
  const t2 = timeout(t, ctx(() => 0)).state;
  assert.equal(t2.shots[1].at(-1).cell, 2);
});

test('minuteur : sans option, pas d\'échéance ; timeout en phase de placement ne fait rien', () => {
  const s = setup(players, {});
  assert.equal(status(s).deadline, undefined);
  assert.equal(timeout(s, ctx()).state, s);
  const f = started();
  assert.equal(status(f).deadline, undefined);
});

test('minuteur échu avec l\'option rejouer : un tir au hasard qui touche garde la main', () => {
  let s = setup(players, { timer: 30, salvo: true });
  s = ready(s, 1, lined(0), ctx(() => 0.1));
  s = ready(s, 2, lined(1), ctx(() => 0.1));
  // random 0.999 → dernière case libre = 99 ; la flotte 2 n'y est pas (ligne 9 : 90..91). Eau → passe la main.
  const t = timeout(s, ctx(() => 0.999)).state;
  assert.equal(t.last.cell, 99);
  assert.equal(status(t).turn, 2);
});

test('abandon : l\'autre gagne, pendant le placement comme pendant les tirs', () => {
  let s = setup(players, {});
  s = leave(s, 1).state;
  assert.deepEqual(status(s), { turn: null, over: true, winners: [2] });
  assert.equal(s.forfeit, 1);
  let f = started();
  f = leave(f, 1).state;
  assert.deepEqual(status(f).winners, [2]);
  assert.throws(() => fireAt(f, 2, 0), /terminée/);
});

test('l\'état reste du JSON pur et n\'est jamais modifié', () => {
  const s = started();
  const copy = JSON.stringify(s);
  fireAt(s, 1, 90);
  timeout(s, ctx());
  leave(s, 1);
  assert.equal(JSON.stringify(s), copy);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});
