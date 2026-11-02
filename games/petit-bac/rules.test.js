// Tests des règles du Petit Bac : node --test games/petit-bac/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, view, status, timeout, leave, normalize, checkAnswer, evaluate, LETTERS, STOP_GRACE_MS, REVIEW_MS } from './rules.js';
import { CATEGORIES } from './categories.js';

const players = [{ id: 1, pseudo: 'ana' }, { id: 2, pseudo: 'bob' }, { id: 3, pseudo: 'cli' }];
const T0 = 1_000_000;
// Hasard fixe : renvoie les valeurs dans l'ordre, puis toujours 0.
const rnd = (...values) => {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0);
};
const ctx = (now = T0, random = rnd(0)) => ({ now, random });
const OPTS = { seconds: 90, rounds: 2, categories: 6, rareLetters: false };

// Lettre B (index 1 dans LETTERS), catégories 0..5 (premier tirage à 0 à chaque fois).
const start = (opts = OPTS, ps = players) => setup(ps, opts, ctx(T0, rnd(1 / LETTERS.length + 0.001, 0)));
const play = (s, id, action, c = ctx()) => move(s, id, action, c).state;
const draft = (s, id, answers) => play(s, id, { type: 'draft', answers });
const six = (...a) => [...a, '', '', '', '', '', ''].slice(0, 6);

test('la lettre et les catégories viennent de ctx.random', () => {
  const s = start();
  assert.equal(s.letter, 'B');
  assert.deepEqual(s.categories, CATEGORIES.slice(0, 6));
  assert.equal(s.deadline, T0 + 90_000);
  const s2 = setup(players, OPTS, ctx(T0, rnd(0.999999)));
  assert.equal(s2.letter, 'V');
  assert.equal(s2.categories.length, 6);
  assert.equal(new Set(s2.categories).size, 6);
});

test('sans option, jamais K, W, X, Y ni Z ; avec l’option, elles peuvent sortir', () => {
  for (let i = 0; i < 40; i++) {
    const l = setup(players, OPTS, ctx(T0, rnd(i / 40))).letter;
    assert.ok(!'KWXYZ'.includes(l), l);
  }
  assert.equal(setup(players, { ...OPTS, rareLetters: true }, ctx(T0, rnd(0.999999))).letter, 'Z');
});

test('les options sont bornées', () => {
  const s = setup(players, { seconds: 5, rounds: 99, categories: 1, rareLetters: 'oui' }, ctx());
  assert.deepEqual(s.options, { seconds: 90, rounds: 10, categories: 6, rareLetters: false });
});

test('normalisation : accents, casse, ponctuation et articles', () => {
  assert.equal(normalize('  Écureuil '), 'ecureuil');
  assert.equal(normalize('La Baleine'), normalize('baleine'));
  assert.equal(normalize("L'oeuf"), normalize('Œuf'.replace('Œ', 'oe')));
  assert.equal(normalize('Pomme de terre'), 'pommedeterre');
  assert.equal(normalize('Pomme-de-terre'), 'pommedeterre');
  assert.equal(normalize('Le'), 'le'); // un article seul reste un mot
});

test('vérification de la lettre', () => {
  assert.equal(checkAnswer('Banane', 'B'), 'ok');
  assert.equal(checkAnswer('éléphant', 'E'), 'ok');
  assert.equal(checkAnswer('la baleine', 'B'), 'ok');
  assert.equal(checkAnswer('Les Misérables', 'L'), 'ok');
  assert.equal(checkAnswer('Les Misérables', 'M'), 'ok');
  assert.equal(checkAnswer('Chat', 'B'), 'letter');
  assert.equal(checkAnswer('   ', 'B'), 'empty');
});

test('un brouillon est enregistré, nettoyé et reste caché aux autres', () => {
  let s = start();
  s = draft(s, 1, ['  Bébé   panda ', 'Berlin', 'x'.repeat(100)]);
  assert.equal(s.answers[1][0], 'Bébé panda');
  assert.equal(s.answers[1][2].length, 40);
  assert.equal(s.answers[1].length, 6);
  const mine = view(s, 1);
  assert.equal(mine.mine[0], 'Bébé panda');
  // Ce que voient Bob, le spectateur : aucune réponse d'Ana nulle part.
  for (const who of [2, null]) {
    const json = JSON.stringify(view(s, who));
    assert.ok(!json.includes('panda'), `fuite pour ${who}`);
    assert.ok(!json.includes('Berlin'), `fuite pour ${who}`);
  }
  assert.equal(view(s, null).mine, null);
  assert.equal(view(s, 2).progress[1], 3);
  assert.throws(() => move(s, 1, { type: 'draft', answers: 'oups' }, ctx()), /invalides/);
});

test('l’état reçu n’est jamais modifié', () => {
  const s = start();
  const copy = JSON.stringify(s);
  draft(s, 1, six('Banane'));
  assert.equal(JSON.stringify(s), copy);
});

test('tout le monde peut jouer pendant la saisie', () => {
  const s = start();
  assert.deepEqual(status(s), { turn: [1, 2, 3], over: false, winners: [], deadline: T0 + 90_000 });
});

test('Stop ! refusé s’il manque une réponse ou si la lettre est fausse', () => {
  const s = start();
  assert.throws(() => move(s, 1, { type: 'stop', answers: six('Banane', 'Bison') }, ctx()), /Il te manque encore une réponse/);
  assert.throws(() => move(s, 1, { type: 'stop', answers: ['Banane', 'Bison', 'Belgique', 'Boulanger', 'Chou', 'Bière'] }, ctx()), /ne commence pas par B/);
});

test('Stop ! : les autres ont 10 secondes, puis la vérification commence', () => {
  let s = start();
  const full = ['Baptiste', 'Bison', 'Belgique', 'Boulanger', 'Banane', 'Bière'];
  s = play(s, 1, { type: 'stop', answers: full }, ctx(T0 + 20_000));
  assert.equal(s.stopBy, 1);
  assert.equal(status(s).deadline, T0 + 30_000);
  assert.deepEqual(s.answers[1], full);
  assert.throws(() => move(s, 2, { type: 'stop', answers: full }, ctx(T0 + 21_000)), /déjà crié/);
  // Les autres peuvent encore écrire pendant ces 10 s.
  s = draft(s, 2, six('Bob'));
  s = timeout(s, ctx(T0 + 30_000)).state;
  assert.equal(s.phase, 'review');
  assert.equal(s.answers[2][0], 'Bob');
  assert.equal(status(s).deadline, T0 + 30_000 + REVIEW_MS);
});

test('Stop ! ne rallonge jamais le chrono', () => {
  let s = start();
  const full = ['Baptiste', 'Bison', 'Belgique', 'Boulanger', 'Banane', 'Bière'];
  s = play(s, 1, { type: 'stop', answers: full }, ctx(T0 + 85_000));
  assert.equal(status(s).deadline, T0 + 90_000);
});

test('au chrono, la manche passe en vérification et les brouillons sont gardés', () => {
  let s = start();
  s = draft(s, 1, six('Banane'));
  s = timeout(s, ctx(T0 + 90_000)).state;
  assert.equal(s.phase, 'review');
  assert.equal(view(s, 2).grid[0][0].text, 'Banane'); // maintenant tout est public
  // Un brouillon qui arrive en retard est ignoré sans erreur.
  const late = draft(s, 2, six('Bar'));
  assert.deepEqual(late.answers, s.answers);
});

// Manche jouée : ana, bob et cli ont tous la lettre B.
function reviewWith(rows) {
  let s = start();
  rows.forEach((answers, i) => { s = draft(s, i + 1, answers); });
  return timeout(s, ctx(T0 + 90_000)).state;
}
const pts = (s) => Object.fromEntries(view(s, null).grid[0].map((c) => [c.id, c.points]));

test('points : 10 si unique, 5 si doublon, 0 si vide ou mauvaise lettre', () => {
  const s = reviewWith([
    six('Banane', 'Baleine', 'Bébé', 'Boa', '', 'Chat'),
    six('banane', 'La baleine', 'Bob', 'Boa', '', 'Bus'),
    six('Brebis', 'Bison', '', 'Cobra', ''),
  ]);
  assert.deepEqual(view(s, 1).grid[0].map((c) => [c.state, c.points]), [['duplicate', 5], ['duplicate', 5], ['unique', 10]]);
  assert.deepEqual(view(s, 1).grid[1].map((c) => c.points), [5, 5, 10]); // article ignoré
  assert.deepEqual(view(s, 1).grid[2].map((c) => c.points), [10, 10, 0]);
  assert.deepEqual(view(s, 1).grid[3].map((c) => [c.state, c.points]), [['duplicate', 5], ['duplicate', 5], ['letter', 0]]);
  assert.deepEqual(view(s, 1).grid[4].map((c) => c.state), ['empty', 'empty', 'empty']);
  assert.deepEqual(view(s, 1).grid[5].map((c) => [c.state, c.points]), [['letter', 0], ['unique', 10], ['empty', 0]]);
  assert.deepEqual(view(s, 1).roundPoints, { 1: 5 + 5 + 10 + 5 + 0 + 0, 2: 5 + 5 + 10 + 5 + 10, 3: 10 + 10 + 0 });
});

test('contestation : la majorité des autres invalide la réponse', () => {
  let s = reviewWith([six('Banane'), six('Bière'), six('Balai')]);
  // Ana est contestée par Bob seul : 1 sur 2 ne suffit pas.
  s = play(s, 2, { type: 'contest', cat: 0, target: 1 });
  assert.equal(view(s, 3).grid[0][0].state, 'unique');
  assert.equal(view(s, 3).grid[0][0].votes, 1);
  assert.equal(view(s, 2).grid[0][0].mine, true);
  assert.equal(view(s, 3).grid[0][0].mine, false);
  // Cli aussi : 2 sur 2 = majorité.
  s = play(s, 3, { type: 'contest', cat: 0, target: 1 });
  assert.equal(view(s, 3).grid[0][0].state, 'refused');
  assert.equal(view(s, 3).grid[0][0].points, 0);
  // Bob retire sa contestation : la réponse repasse.
  s = play(s, 2, { type: 'contest', cat: 0, target: 1 });
  assert.equal(view(s, 3).grid[0][0].state, 'unique');
});

test('contestation : une réponse refusée ne fait plus doublon', () => {
  let s = reviewWith([six('Banane'), six('Banane'), six('Bus')]);
  assert.equal(view(s, 1).grid[0][0].state, 'duplicate');
  s = play(s, 2, { type: 'contest', cat: 0, target: 1 });
  s = play(s, 3, { type: 'contest', cat: 0, target: 1 });
  assert.deepEqual(view(s, 1).grid[0].map((c) => [c.state, c.points]), [['refused', 0], ['unique', 10], ['unique', 10]]);
});

test('contestation : cas refusés', () => {
  const s = reviewWith([six('Banane', '', '', '', '', 'Chat'), six('Bière'), six('Balai')]);
  assert.throws(() => move(s, 1, { type: 'contest', cat: 0, target: 1 }, ctx()), /ta propre réponse/);
  assert.throws(() => move(s, 2, { type: 'contest', cat: 1, target: 1 }, ctx()), /aucun point/); // vide
  assert.throws(() => move(s, 2, { type: 'contest', cat: 5, target: 1 }, ctx()), /aucun point/); // mauvaise lettre
  assert.throws(() => move(s, 2, { type: 'contest', cat: 99, target: 1 }, ctx()), /inconnue/);
  assert.throws(() => move(s, 2, { type: 'contest', cat: 0, target: 42 }, ctx()), /inconnue/);
  const writing = start();
  assert.throws(() => move(writing, 2, { type: 'contest', cat: 0, target: 1 }, ctx()), /manche sera terminée/);
});

test('à deux, une seule contestation suffit', () => {
  const duo = players.slice(0, 2);
  let s = setup(duo, OPTS, ctx(T0, rnd(1 / LETTERS.length + 0.001, 0)));
  s = draft(s, 1, six('Banane'));
  s = timeout(s, ctx(T0 + 90_000)).state;
  s = play(s, 2, { type: 'contest', cat: 0, target: 1 });
  assert.equal(view(s, 2).grid[0][0].state, 'refused');
});

test('fin de la vérification : points figés, puis nouvelle manche avec une autre lettre', () => {
  let s = reviewWith([six('Banane'), six('Banane'), six('Brebis')]);
  for (const id of [1, 2]) s = play(s, id, { type: 'ready' }, ctx(T0 + 100_000));
  assert.equal(s.phase, 'review');
  assert.deepEqual(status(s).turn, [3]);
  s = play(s, 3, { type: 'ready' }, ctx(T0 + 100_000, rnd(0.5, 0)));
  assert.equal(s.phase, 'writing');
  assert.equal(s.round, 2);
  assert.deepEqual(s.scores, { 1: 5, 2: 5, 3: 10 });
  assert.notEqual(s.letter, 'B');
  assert.deepEqual(s.answers, {});
  assert.equal(s.deadline, T0 + 100_000 + 90_000);
  assert.equal(s.history.length, 1);
  assert.equal(view(s, 1).history[0].points[3], 10);
});

test('fin de la vérification au chrono ; dernière manche : fin de partie et gagnants', () => {
  let s = reviewWith([six('Banane'), six('Bière'), six('Balai')]);
  s = timeout(s, ctx(T0 + 200_000, rnd(0.2, 0))).state;
  assert.equal(s.round, 2);
  s = timeout(s, ctx(T0 + 300_000)).state; // 2e manche, saisie terminée
  s = timeout(s, ctx(T0 + 400_000)).state; // fin de la vérification de la 2e manche
  assert.equal(s.phase, 'over');
  const st = status(s);
  assert.equal(st.over, true);
  assert.deepEqual(st.winners, [1, 2, 3]); // égalité parfaite à 10 chacun
  assert.equal(st.turn, null);
  assert.throws(() => move(s, 1, { type: 'ready' }, ctx()), /terminée/);
});

test('le meilleur total gagne', () => {
  let s = reviewWith([six('Banane', 'Baleine'), six('Bière'), six('Balai')]);
  s = play(s, 1, { type: 'ready' });
  s = play(s, 2, { type: 'ready' });
  s = play(s, 3, { type: 'ready' }, ctx(T0 + 100_000, rnd(0.3, 0)));
  s = timeout(s, ctx(T0 + 200_000)).state;
  s = timeout(s, ctx(T0 + 300_000)).state;
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s).winners, [1]); // 20 contre 10 et 10
});

test('un joueur qui part : la partie continue sans lui, ses réponses ne comptent plus', () => {
  let s = reviewWith([six('Banane'), six('Banane'), six('Brebis')]);
  assert.equal(view(s, 3).grid[0][0].state, 'duplicate');
  s = leave(s, 2, ctx()).state;
  assert.deepEqual(status(s).turn, [1, 3]);
  assert.equal(view(s, 3).grid[0].length, 2);
  assert.equal(view(s, 3).grid[0][0].state, 'unique'); // plus de doublon
  assert.throws(() => move(s, 2, { type: 'ready' }, ctx()), /ne joues plus/);
  // Si c'était le dernier à devoir valider, la manche se termine.
  s = play(s, 1, { type: 'ready' });
  s = leave(s, 3, ctx(T0 + 100_000)).state;
  assert.equal(s.phase, 'over'); // il ne reste qu'une personne
  assert.deepEqual(status(s).winners, [1]);
});

test('le départ du dernier non-prêt termine la vérification', () => {
  let s = reviewWith([six('Banane'), six('Bière'), six('Balai')]);
  s = play(s, 1, { type: 'ready' });
  s = play(s, 2, { type: 'ready' });
  s = leave(s, 3, ctx(T0 + 100_000, rnd(0.4, 0))).state;
  assert.equal(s.phase, 'writing');
  assert.equal(s.round, 2);
  assert.deepEqual(status(s).turn, [1, 2]);
});

test('un abandon pendant la saisie laisse les autres finir', () => {
  let s = start();
  s = leave(s, 1, ctx()).state;
  assert.deepEqual(status(s).turn, [2, 3]);
  assert.throws(() => move(s, 1, { type: 'draft', answers: six() }, ctx()), /ne joues plus/);
});

test('évaluer ne dépend pas de l’ordre des joueurs', () => {
  const a = evaluate(reviewWith([six('Banane'), six('Banane'), six('Bus')]));
  assert.equal(a[0].filter((c) => c.state === 'duplicate').length, 2);
});
