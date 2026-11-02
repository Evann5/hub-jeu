// Tests des règles d'« Un seul mot » : node --test games/un-seul-mot/*.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, status, view, timeout, leave, normalize, related, sameWord, checkClue, CHOICES } from './rules.js';
import { WORDS } from './words.js';

function seeded(seed = 11) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}
const ctx = (now = 0) => ({ now, random: seeded() });
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `p${i + 1}` }));
const freeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(freeze); } return o; };
const play = (s, id, action, now = 0) => move(freeze(s), id, action, ctx(now)).state;
const opts = { rounds: 13, timer: 0 };
const start = (n = 4, o = opts) => setup(mk(n), o, ctx());
// Amène la partie à l'écriture avec un mot choisi
const writing = (s, word) => { s = play(s, s.active, { type: 'pick', n: 1 }); return { ...s, word }; };

test('normalisation et mots de la même famille', () => {
  assert.equal(normalize('Éléphant !'), 'elephant');
  assert.equal(normalize('œuf'), 'oeuf');
  assert.ok(related('Chevaux', 'cheval'));
  assert.ok(related('tuyaux', 'tuyau'));
  assert.ok(related('amie', 'ami'));
  assert.ok(related('Pommes', 'pomme'));
  assert.ok(related('pommier', 'pomme'));
  assert.ok(related('chanteur', 'chanter'));
  assert.ok(related('montagnard', 'montagne'));
  assert.ok(related('Éléphant', 'elephant'));
  assert.ok(related('chevalier', 'cheval'));
  assert.ok(!related('lune', 'lunettes'));
  assert.ok(!related('bateau', 'eau'), 'trois lettres : seulement l’égalité');
  assert.ok(!related('mer', 'montagne'));
  assert.ok(!related('chat', 'chaise'));
  assert.ok(!related('soleil', 'sommeil'));
});

test('la devinette ignore article, accents, majuscules et pluriel', () => {
  assert.ok(sameWord('La mer', 'mer'));
  assert.ok(sameWord("l'ours", 'ours'));
  assert.ok(sameWord('ÉCUREUIL', 'écureuil'));
  assert.ok(sameWord('pommes', 'pomme'));
  assert.ok(!sameWord('', 'mer'));
  assert.ok(!sameWord('mère', 'ours'));
  assert.ok(sameWord('arc en ciel', 'arc-en-ciel'));
});

test('un indice doit être un seul mot, court, et différent du mot mystère', () => {
  assert.equal(checkClue('  Océan ', 'mer'), 'Océan');
  assert.throws(() => checkClue('', 'mer'), /Écris ton indice/);
  assert.throws(() => checkClue('grande bleue', 'mer'), /Un seul mot/);
  assert.throws(() => checkClue("l'eau", 'mer'), /apostrophe/);
  assert.throws(() => checkClue('a'.repeat(30), 'mer'), /trop long/);
  assert.throws(() => checkClue('Mer', 'mer'), /trop proche/);
  assert.throws(() => checkClue('mers', 'mer'), /trop proche/);
  assert.throws(() => checkClue('Pommier', 'pomme'), /trop proche/);
  assert.equal(checkClue('verger', 'pomme'), 'verger');
});

test('la liste de mots : environ 400, sans doublon, un mot à la fois', () => {
  assert.ok(WORDS.length >= 400);
  assert.equal(new Set(WORDS).size, WORDS.length);
  assert.ok(WORDS.every((w) => !/\s/.test(w)));
});

test('mise en place : hasard fixé, mots tous différents, devineur qui tourne', () => {
  const a = start();
  const b = start();
  assert.deepEqual(a.deck, b.deck);
  assert.equal(a.deck.length, 13 * CHOICES);
  assert.equal(new Set(a.deck).size, a.deck.length);
  assert.equal(a.phase, 'pick');
  assert.equal(a.active, 1);
  assert.equal(a.candidates.length, CHOICES);
  assert.deepEqual(status(a).turn, [1]);
});

test('le devineur ne voit jamais le mot, ni avant le choix ni après', () => {
  let s = start();
  const before = JSON.stringify(view(s, 1));
  for (const w of s.candidates) assert.ok(!before.includes(w), 'aucun candidat dans la vue');
  s = play(s, 1, { type: 'pick', n: 2 });
  assert.equal(s.word, s.candidates[1]);
  assert.equal(view(s, 1).word, null);
  assert.equal(view(s, 2).word, s.word);
  assert.equal(view(s, null).word, null, 'spectateur : pas de spoiler');
  assert.ok(!JSON.stringify(view(s, 1)).includes('deck'));
  assert.ok(!('deck' in view(s, 2)) && !('candidates' in view(s, 2)));
});

test('choisir le numéro : seulement le devineur, de 1 à 5', () => {
  const s = start();
  assert.throws(() => move(s, 1, { type: 'pick', n: 0 }, ctx()), /1 à 5/);
  assert.throws(() => move(s, 1, { type: 'pick', n: 6 }, ctx()), /1 à 5/);
  assert.throws(() => move(s, 1, { type: 'pick', n: 'x' }, ctx()), /1 à 5/);
  assert.throws(() => move(s, 2, { type: 'pick', n: 1 }, ctx()), /autre joueur/);
});

test('écriture : tout le monde sauf le devineur, un seul indice chacun', () => {
  let s = writing(start(), 'mer');
  assert.deepEqual(status(s).turn, [2, 3, 4]);
  assert.throws(() => move(s, 1, { type: 'clue', text: 'bleu' }, ctx()), /tu devines|Tu devines/);
  s = play(s, 2, { type: 'clue', text: 'Océan' });
  assert.throws(() => move(s, 2, { type: 'clue', text: 'autre' }, ctx()), /déjà donné/);
  assert.throws(() => move(s, 3, { type: 'clue', text: 'mer' }, ctx()), /trop proche/);
  assert.deepEqual(status(s).turn, [3, 4]);
  assert.equal(view(s, 3).mine, null);
  assert.equal(view(s, 2).mine, 'Océan');
  assert.ok(!JSON.stringify(view(s, 3)).includes('Océan'), 'les autres ne voient pas ton indice avant la revue');
});

test('indices identiques : annulés automatiquement, tous les deux', () => {
  let s = writing(start(5), 'mer');
  s = play(s, 2, { type: 'clue', text: 'Océan' });
  s = play(s, 3, { type: 'clue', text: 'ocean' });
  s = play(s, 4, { type: 'clue', text: 'sable' });
  s = play(s, 5, { type: 'clue', text: 'plage' });
  assert.equal(s.phase, 'review');
  assert.equal(s.auto[2], 'doublon');
  assert.equal(s.auto[3], 'doublon');
  assert.equal(s.auto[4], undefined);
  const rev = view(s, 4).review;
  assert.equal(rev.find((c) => c.by === 2).cancelled, true);
  assert.equal(rev.find((c) => c.by === 4).cancelled, false);
  assert.equal(view(s, 1).review, undefined, 'le devineur ne voit pas la revue');
  assert.equal(view(s, 1).clueCount, 4);
});

test('même famille entre indices : annulés ; sinon gardés', () => {
  let s = writing(start(4), 'forêt');
  s = play(s, 2, { type: 'clue', text: 'arbre' });
  s = play(s, 3, { type: 'clue', text: 'arbres' });
  s = play(s, 4, { type: 'clue', text: 'bois' });
  assert.deepEqual(s.auto, { 2: 'doublon', 3: 'doublon' });
});

test('vote d’annulation : il faut plus de la moitié des autres, pas son propre indice', () => {
  let s = writing(start(5), 'mer');
  for (const [id, t] of [[2, 'bleu'], [3, 'sel'], [4, 'vague'], [5, 'bateau']]) s = play(s, id, { type: 'clue', text: t });
  assert.equal(s.phase, 'review');
  assert.throws(() => move(s, 2, { type: 'cancel', target: 2 }, ctx()), /propre indice/);
  assert.throws(() => move(s, 2, { type: 'cancel', target: 9 }, ctx()), /n’existe pas/);
  // autres auteurs que 3 : 2, 4, 5 → il faut 2 votes (3 autres, plus de la moitié = 2)
  s = play(s, 2, { type: 'cancel', target: 3 });
  assert.equal(view(s, 4).review.find((c) => c.by === 3).cancelled, false);
  assert.equal(view(s, 4).review.find((c) => c.by === 3).need, 2);
  s = play(s, 4, { type: 'cancel', target: 3 });
  assert.equal(view(s, 4).review.find((c) => c.by === 3).cancelled, true);
  // le vote se retire
  s = play(s, 4, { type: 'cancel', target: 3 });
  assert.equal(view(s, 4).review.find((c) => c.by === 3).cancelled, false);
  s = play(s, 4, { type: 'cancel', target: 3 });
  // tout le monde confirme
  for (const id of [2, 3, 4, 5]) {
    assert.ok(status(s).turn.includes(id));
    s = play(s, id, { type: 'done' });
  }
  assert.equal(s.phase, 'guess');
  assert.deepEqual(s.final.map((c) => c.text).sort(), ['bateau', 'bleu', 'vague']);
});

test('à trois joueurs, un seul vote écarte l’indice de l’autre', () => {
  let s = writing(start(3), 'mer');
  s = play(s, 2, { type: 'clue', text: 'bleu' });
  s = play(s, 3, { type: 'clue', text: 'sel' });
  s = play(s, 2, { type: 'cancel', target: 3 });
  assert.equal(view(s, 2).review.find((c) => c.by === 3).cancelled, true);
});

test('le devineur voit les indices restants, sans auteurs ni indices annulés', () => {
  let s = writing(start(4), 'mer');
  for (const [id, t] of [[2, 'bleu'], [3, 'bleu'], [4, 'sel']]) s = play(s, id, { type: 'clue', text: t });
  s = play(s, 4, { type: 'done' });
  s = play(s, 2, { type: 'done' });
  s = play(s, 3, { type: 'done' });
  assert.equal(s.phase, 'guess');
  assert.deepEqual(view(s, 1).final, ['sel']);
  assert.equal(view(s, 1).finalBy, undefined);
  assert.equal(view(s, 1).word, null);
  assert.deepEqual(view(s, 2).finalBy.map((c) => c.by), [4]);
  assert.deepEqual(status(s).turn, [1]);
});

test('si tous les indices sont annulés, on passe directement à la devinette', () => {
  let s = writing(start(3), 'mer');
  s = play(s, 2, { type: 'clue', text: 'sel' });
  s = play(s, 3, { type: 'clue', text: 'sel' });
  assert.equal(s.phase, 'guess');
  assert.deepEqual(view(s, 1).final, []);
});

test('bonne réponse = 1 point, mauvaise ou passe = 0 ; le résultat montre tout', () => {
  const round = (guessAction) => {
    let s = writing(start(4), 'mer');
    for (const [id, t] of [[2, 'bleu'], [3, 'sel'], [4, 'vague']]) s = play(s, id, { type: 'clue', text: t });
    for (const id of [2, 3, 4]) s = play(s, id, { type: 'done' });
    return play(s, 1, guessAction);
  };
  let s = round({ type: 'guess', text: 'La mer' });
  assert.equal(s.score, 1);
  assert.equal(s.outcome, 'win');
  assert.equal(s.phase, 'result');
  assert.equal(view(s, 1).word, 'mer', 'le mot est révélé à la fin de la manche');
  assert.equal(view(s, null).last.clues.length, 3);
  s = round({ type: 'guess', text: 'océan' });
  assert.equal(s.score, 0);
  assert.equal(s.outcome, 'miss');
  s = round({ type: 'pass' });
  assert.equal(s.outcome, 'pass');
  assert.equal(s.score, 0);
  const g = (() => { let t = writing(start(4), 'mer'); for (const [id, x] of [[2, 'bleu'], [3, 'sel'], [4, 'vague']]) t = play(t, id, { type: 'clue', text: x }); for (const id of [2, 3, 4]) t = play(t, id, { type: 'done' }); return t; })();
  assert.throws(() => move(g, 1, { type: 'guess', text: '  ' }, ctx()), /Écris ta proposition/);
  assert.throws(() => move(g, 2, { type: 'guess', text: 'mer' }, ctx()), /autre joueur/);
});

test('manche suivante : le devineur change, un double clic ne saute pas de manche', () => {
  let s = writing(start(4), 'mer');
  for (const [id, t] of [[2, 'bleu'], [3, 'sel'], [4, 'vague']]) s = play(s, id, { type: 'clue', text: t });
  for (const id of [2, 3, 4]) s = play(s, id, { type: 'done' });
  s = play(s, 1, { type: 'pass' });
  assert.deepEqual(status(s).turn, [1, 2, 3, 4]);
  s = play(s, 2, { type: 'next' });
  assert.equal(s.round, 1);
  assert.equal(s.active, 2);
  assert.equal(s.phase, 'pick');
  // Le second clic arrive après le changement de phase : refusé, la manche ne bouge pas.
  assert.deepEqual(status(s).turn, [2]);
  assert.throws(() => move(s, 3, { type: 'next' }, ctx()), /numéro/);
  assert.equal(s.round, 1);
});

test('partie complète : 13 manches, score sur 13, victoire de l’équipe', () => {
  let s = start(3);
  for (let r = 0; r < 13; r++) {
    assert.equal(s.round, r);
    s = play(s, s.active, { type: 'pick', n: 3 });
    const word = s.word;
    for (const id of status(s).turn) s = play(s, id, { type: 'clue', text: `indice${id}x${r}` });
    for (const id of status(s).turn) s = play(s, id, { type: 'done' });
    assert.equal(s.phase, 'guess');
    s = play(s, s.active, r < 9 ? { type: 'guess', text: word } : { type: 'pass' });
    s = play(s, 1, { type: 'next' });
  }
  assert.equal(s.phase, 'over');
  assert.equal(s.score, 9);
  assert.equal(s.history.length, 13);
  assert.equal(status(s).over, true);
  assert.deepEqual(status(s).winners, [1, 2, 3]);
  assert.deepEqual(new Set(s.history.map((h) => h.active)), new Set([1, 2, 3]));
});

test('minuteurs : numéro au hasard, indices manquants, revue close, passe, manche suivante', () => {
  const o = { rounds: 5, timer: 45 };
  let s = setup(mk(4), o, ctx(1000));
  assert.equal(status(s).deadline, 1000 + 30000, 'numéro : 30 s au plus');
  s = timeout(s, ctx(31000)).state;
  assert.equal(s.phase, 'write');
  assert.ok(s.candidates.includes(s.word));
  assert.equal(status(s).deadline, 31000 + 45000);
  s = play(s, 2, { type: 'clue', text: 'bleu' }, 32000);
  s = { ...s, word: 'mer' };
  s = timeout(s, ctx(80000)).state; // 3 et 4 n'ont rien écrit
  assert.equal(s.phase, 'review');
  assert.deepEqual(Object.keys(s.clues), ['2']);
  s = timeout(s, ctx(130000)).state;
  assert.equal(s.phase, 'guess');
  s = timeout(s, ctx(180000)).state;
  assert.equal(s.phase, 'result');
  assert.equal(s.outcome, 'pass');
  assert.equal(status(s).deadline, 180000 + 20000);
  s = timeout(s, ctx(200000)).state;
  assert.equal(s.round, 1);
  const sans = setup(mk(4), { rounds: 5, timer: 0 }, ctx());
  assert.equal(status(sans).deadline ?? null, null);
});

test('abandon du devineur : manche perdue, la partie continue ; sous 3 joueurs elle s’arrête', () => {
  let s = writing(start(4), 'mer');
  let t = leave(freeze(s), 1, ctx()).state;
  assert.equal(t.phase, 'result');
  assert.equal(t.outcome, 'abandon');
  t = move(t, 2, { type: 'next' }, ctx()).state;
  assert.equal(t.active, 2);
  const u = leave(start(3), 2, ctx()).state;
  assert.equal(u.phase, 'over');
});

test('abandon d’un auteur : les autres peuvent continuer sans l’attendre', () => {
  let s = writing(start(5), 'mer');
  s = play(s, 2, { type: 'clue', text: 'bleu' });
  s = play(s, 3, { type: 'clue', text: 'sel' });
  s = play(s, 4, { type: 'clue', text: 'vague' });
  s = leave(s, 5, ctx()).state;
  assert.equal(s.phase, 'review');
  s = play(s, 2, { type: 'done' });
  s = play(s, 3, { type: 'done' });
  s = leave(s, 4, ctx()).state;
  assert.equal(s.phase, 'guess', 'les deux restants avaient confirmé');
});

test('un joueur qui a quitté ne voit plus le mot', () => {
  let s = writing(start(5), 'mer');
  s = leave(s, 3, ctx()).state;
  assert.equal(view(s, 3).word, null);
  assert.equal(view(s, 2).word, 'mer');
});
