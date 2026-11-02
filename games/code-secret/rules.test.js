// Tests des règles du code secret : node --test games/code-secret/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, view, status, timeout, leave, score, checkCode, MAX_TRIES } from './rules.js';

const players = [{ id: 1, pseudo: 'ana' }, { id: 2, pseudo: 'bob' }];
const T0 = 5_000_000;
const ctx = (random = () => 0, now = T0) => ({ now, random });
const code = (s, id, c) => move(s, id, { type: 'code', code: c }, ctx()).state;
const guess = (s, id, c, k = ctx()) => move(s, id, { type: 'guess', code: c }, k).state;

// Partie en cours : le code de 1 est [0,1,2,3], celui de 2 est [3,3,4,5] (doublons autorisés).
function started(options = { doubles: true }) {
  let s = setup(players, options, ctx());
  s = code(s, 1, [0, 1, 2, 3]);
  s = code(s, 2, [3, 3, 4, 5]);
  return s;
}

test('indications : bien placés et mal placés', () => {
  assert.deepEqual(score([0, 1, 2, 3], [0, 1, 2, 3]), { black: 4, white: 0 });
  assert.deepEqual(score([0, 1, 2, 3], [3, 2, 1, 0]), { black: 0, white: 4 });
  assert.deepEqual(score([0, 1, 2, 3], [0, 2, 1, 5]), { black: 1, white: 2 });
  assert.deepEqual(score([0, 1, 2, 3], [4, 4, 4, 4]), { black: 0, white: 0 });
});

test('indications avec doublons : chaque pion n\'est compté qu\'une fois', () => {
  // Code 0 0 1 1, essai 0 1 0 0 : 1 bien placé (0), 2 mal placés (le 1 et un 0), pas trois.
  assert.deepEqual(score([0, 0, 1, 1], [0, 1, 0, 0]), { black: 1, white: 2 });
  // Code 1 2 3 4, essai 1 1 1 1 : un seul 1 existe.
  assert.deepEqual(score([1, 2, 3, 4], [1, 1, 1, 1]), { black: 1, white: 0 });
  // Code 1 1 2 3, essai 2 2 1 1 : 0 bien placé, 1 de chaque couleur compté deux fois pour le 1, une fois pour le 2.
  assert.deepEqual(score([1, 1, 2, 3], [2, 2, 1, 1]), { black: 0, white: 3 });
  // Code 5 5 5 0, essai 0 5 5 5.
  assert.deepEqual(score([5, 5, 5, 0], [0, 5, 5, 5]), { black: 2, white: 2 });
});

test('mise en place : 4 trous, 6 couleurs, sans doublon par défaut ; options 5 trous et 8 couleurs', () => {
  const s = setup(players, {}, ctx());
  assert.deepEqual([s.holes, s.colors, s.doubles, s.phase], [4, 6, false, 'coding']);
  const big = setup(players, { holes: 5, colors: 8, doubles: true }, ctx());
  assert.deepEqual([big.holes, big.colors, big.doubles], [5, 8, true]);
  assert.deepEqual(status(s).turn, [1, 2]);
});

test('composer un code : bon nombre de trous, couleurs connues, doublons seulement si autorisés', () => {
  const s = setup(players, {}, ctx());
  assert.throws(() => code(s, 1, [0, 1, 2]), /Remplis les 4 trous/);
  assert.throws(() => code(s, 1, [0, 1, 2, 6]), /n’existe pas/);
  assert.throws(() => code(s, 1, [0, 1, 2, -1]), /n’existe pas/);
  assert.throws(() => code(s, 1, [0, 1, 2, 'x']), /n’existe pas/);
  assert.throws(() => code(s, 1, [0, 0, 2, 3]), /doublons sont interdits/);
  assert.throws(() => code(s, 1, null), /Remplis/);
  assert.throws(() => move(s, 1, { type: 'guess', code: [0, 1, 2, 3] }, ctx()), /Compose d’abord/);
  assert.throws(() => code(s, 99, [0, 1, 2, 3]), /regardes/);
  assert.deepEqual(checkCode({ holes: 4, colors: 6, doubles: true }, [0, 0, 0, 0]), [0, 0, 0, 0]);
  assert.deepEqual(checkCode({ holes: 4, colors: 6, doubles: false }, ['0', '1', '2', '3']), [0, 1, 2, 3]);
});

test('composer un code : on attend l\'autre, puis la recherche commence pour tous les deux', () => {
  let s = setup(players, {}, ctx());
  s = code(s, 1, [0, 1, 2, 3]);
  assert.equal(s.phase, 'coding');
  assert.deepEqual(status(s).turn, [2]);
  assert.throws(() => code(s, 1, [3, 2, 1, 0]), /attends ton adversaire/);
  s = code(s, 2, [3, 2, 1, 0]);
  assert.equal(s.phase, 'guessing');
  assert.deepEqual(status(s).turn, [1, 2]);
});

test('une manche : chacun joue, les indications tombent quand les deux ont joué', () => {
  let s = started();
  s = guess(s, 1, [3, 3, 4, 0]); // contre le code de 2 : 3 3 4 5 → 3 bien placés
  assert.deepEqual(s.guesses, [[], []]);
  assert.deepEqual(status(s).turn, [2]);
  assert.throws(() => guess(s, 1, [0, 0, 0, 0]), /attends ton adversaire/);
  s = guess(s, 2, [0, 1, 5, 5]); // contre 0 1 2 3 → 2 bien placés
  assert.deepEqual(s.guesses[0], [{ code: [3, 3, 4, 0], black: 3, white: 0 }]);
  assert.deepEqual(s.guesses[1], [{ code: [0, 1, 5, 5], black: 2, white: 0 }]);
  assert.equal(s.phase, 'guessing');
  assert.deepEqual(status(s).turn, [1, 2]);
});

test('celui qui trouve gagne', () => {
  let s = started();
  s = guess(s, 1, [3, 3, 4, 5]);
  s = guess(s, 2, [0, 1, 5, 5]);
  assert.deepEqual(status(s), { turn: null, over: true, winners: [1] });
  assert.throws(() => guess(s, 2, [0, 1, 2, 3]), /terminée/);
});

test('les deux trouvent à la même manche : égalité', () => {
  let s = started();
  s = guess(s, 1, [0, 0, 0, 0]);
  s = guess(s, 2, [0, 0, 0, 0]);
  s = guess(s, 1, [3, 3, 4, 5]);
  s = guess(s, 2, [0, 1, 2, 3]);
  assert.deepEqual(status(s).winners, [1, 2]);
  assert.equal(status(s).over, true);
});

test('moins d\'essais gagne : trouver à la manche 2 bat trouver à la manche 3', () => {
  let s = started();
  s = guess(s, 1, [0, 0, 0, 0]);
  s = guess(s, 2, [0, 0, 0, 0]);
  s = guess(s, 2, [0, 1, 2, 3]); // 2 trouve à la manche 2
  s = guess(s, 1, [3, 3, 4, 4]);
  assert.deepEqual(status(s).winners, [2]);
  assert.equal(s.guesses[0].length, 2);
});

test('dix essais sans trouver : égalité sans gagnant', () => {
  let s = started();
  for (let i = 0; i < MAX_TRIES; i += 1) {
    assert.equal(s.phase, 'guessing');
    s = guess(s, 1, [0, 0, 0, 0]);
    s = guess(s, 2, [0, 0, 0, 0]);
  }
  assert.deepEqual(status(s), { turn: null, over: true, winners: [] });
  assert.equal(s.guesses[0].length, 10);
});

test('essai : doublons refusés si interdits, couleurs hors palette refusées', () => {
  let s = setup(players, { doubles: false }, ctx());
  s = code(s, 1, [0, 1, 2, 3]);
  s = code(s, 2, [1, 2, 3, 4]);
  assert.throws(() => guess(s, 1, [1, 1, 2, 3]), /doublons sont interdits/);
  assert.throws(() => guess(s, 1, [1, 2, 3, 9]), /n’existe pas/);
  assert.throws(() => move(s, 1, { type: 'code', code: [0, 1, 2, 3] }, ctx()), /moment de chercher/);
});

test('variante 5 trous et 8 couleurs', () => {
  let s = setup(players, { holes: 5, colors: 8, doubles: true }, ctx());
  s = code(s, 1, [7, 7, 0, 1, 2]);
  s = code(s, 2, [0, 1, 2, 3, 4]);
  assert.throws(() => guess(s, 1, [0, 1, 2, 3]), /Remplis les 5 trous/);
  s = guess(s, 1, [0, 1, 2, 3, 4]);
  s = guess(s, 2, [7, 7, 0, 1, 5]);
  assert.deepEqual(status(s).winners, [1]);
  assert.deepEqual(s.guesses[1][0], { code: [7, 7, 0, 1, 5], black: 4, white: 0 });
});

test('view : le code adverse et l\'essai adverse en cours restent cachés jusqu\'à la fin', () => {
  let s = started();
  s = guess(s, 1, [4, 4, 4, 4]);
  const v1 = view(s, 1);
  assert.deepEqual(v1.myCode, [0, 1, 2, 3]);
  assert.deepEqual(v1.myPending, [4, 4, 4, 4]);
  assert.equal(v1.secrets, null);
  const v2 = view(s, 2);
  assert.deepEqual(v2.myCode, [3, 3, 4, 5]);
  assert.equal(v2.myPending, null);
  assert.deepEqual(v2.guessed, [true, false]);
  assert.equal(JSON.stringify(v2).includes('[4,4,4,4]'), false); // l'essai de 1 n'est pas révélé à 2
  assert.equal(JSON.stringify(v1).includes('[3,3,4,5]'), false); // le code de 2 non plus
  const spec = view(s, null);
  assert.equal(spec.myCode, null);
  assert.equal(spec.myPending, null);
  assert.equal(spec.secrets, null);
  assert.equal(spec.seat, -1);
});

test('view : pendant la composition, personne ne voit le code de l\'autre', () => {
  let s = setup(players, {}, ctx());
  s = code(s, 1, [0, 1, 2, 3]);
  assert.equal(JSON.stringify(view(s, 2)).includes('[0,1,2,3]'), false);
  assert.equal(JSON.stringify(view(s, null)).includes('[0,1,2,3]'), false);
  assert.deepEqual(view(s, 2).codeSet, [true, false]);
});

test('view : à la fin, les deux codes sont révélés', () => {
  let s = started();
  s = guess(s, 1, [3, 3, 4, 5]);
  s = guess(s, 2, [0, 0, 0, 0]);
  assert.deepEqual(view(s, 2).secrets, [[0, 1, 2, 3], [3, 3, 4, 5]]);
  assert.deepEqual(view(s, null).secrets, [[0, 1, 2, 3], [3, 3, 4, 5]]);
});

test('minuteur : échéance à chaque phase, codes et essais au hasard pour ceux qui n\'ont pas joué', () => {
  let s = setup(players, { timer: 60, doubles: true }, ctx(() => 0, T0));
  assert.equal(status(s).deadline, T0 + 60_000);
  s = code(s, 1, [0, 1, 2, 3]);
  const t = timeout(s, ctx(() => 0.5, T0 + 61_000)).state;
  assert.equal(t.phase, 'guessing');
  assert.deepEqual(t.secrets[0], [0, 1, 2, 3]);
  assert.deepEqual(t.secrets[1], [3, 3, 3, 3]); // random 0.5 sur 6 couleurs = couleur n° 3
  assert.equal(status(t).deadline, T0 + 121_000);
  let g = guess(t, 1, [3, 3, 3, 4], ctx(() => 0, T0 + 70_000));
  assert.equal(status(g).deadline, T0 + 121_000); // l'échéance de la manche ne bouge pas à chaque essai
  g = timeout(g, ctx(() => 0, T0 + 125_000)).state;
  assert.deepEqual(g.guesses[1][0].code, [0, 0, 0, 0]);
  assert.equal(g.guesses[0].length, 1);
  assert.equal(status(g).deadline, T0 + 185_000);
  assert.deepEqual(status(g).turn, [1, 2]);
});

test('minuteur sans doublons : le code au hasard est valide', () => {
  const s = setup(players, { timer: 30 }, ctx());
  for (const r of [() => 0, () => 0.99, () => 0.5]) {
    const t = timeout(s, ctx(r)).state;
    for (const c of t.secrets) assert.doesNotThrow(() => checkCode(s, c));
  }
});

test('sans minuteur : pas d\'échéance, et timeout sans effet une fois la partie finie', () => {
  const s = started();
  assert.equal(status(s).deadline, undefined);
  const f = leave(s, 1).state;
  assert.equal(timeout(f, ctx()).state, f);
});

test('abandon : l\'autre gagne, à tout moment', () => {
  let s = setup(players, {}, ctx());
  s = leave(s, 2).state;
  assert.deepEqual(status(s), { turn: null, over: true, winners: [1] });
  assert.equal(s.forfeit, 2);
  let g = started();
  g = guess(g, 1, [0, 0, 0, 0]);
  g = leave(g, 1).state;
  assert.deepEqual(status(g).winners, [2]);
  assert.deepEqual(view(g, null).secrets, [[0, 1, 2, 3], [3, 3, 4, 5]]);
});

test('l\'état reste du JSON pur et n\'est jamais modifié', () => {
  const s = started();
  const copy = JSON.stringify(s);
  guess(s, 1, [0, 0, 0, 0]);
  timeout(s, ctx());
  leave(s, 1);
  assert.equal(JSON.stringify(s), copy);
});
