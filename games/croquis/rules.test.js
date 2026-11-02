// Tests des règles de Croquis : node --test games/croquis/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, move, view, status, timeout, leave, judge, normalize,
  CHOOSE_MS, REVEAL_MS, GUESS_POINTS, DRAWER_POINTS, MAX_STROKES, MAX_POINTS_PER_STROKE,
} from './rules.js';
import { WORDS } from './words.js';

const players = [{ id: 1, pseudo: 'ana' }, { id: 2, pseudo: 'bob' }, { id: 3, pseudo: 'cli' }, { id: 4, pseudo: 'dan' }];
const T0 = 5_000_000;
// Hasard fixe : renvoie les valeurs dans l'ordre, puis toujours 0.
const rnd = (...values) => {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0);
};
const ctx = (now = T0, random = rnd()) => ({ now, random });
const OPTS = { seconds: 80, turns: 2 };

// Avec un hasard à 0, les 3 mots sont les 3 premiers de la liste : chat, chien, cheval.
const start = (ps = players, opts = OPTS) => setup(ps, opts, ctx());
const play = (s, id, action, c = ctx()) => move(s, id, action, c).state;
const drawing = (ps = players, opts = OPTS) => play(start(ps, opts), 1, { type: 'choose', index: 0 }); // le mot est « chat »
const stroke = (extra = {}) => ({ type: 'stroke', c: 2, w: 1, p: [10, 10, 500, 500, 990, 20], ...extra });
const guess = (s, id, text, now = T0 + 5_000) => play(s, id, { type: 'guess', text }, ctx(now));

test('la liste de mots est assez grande, sans doublon', () => {
  assert.ok(WORDS.length >= 300);
  assert.equal(new Set(WORDS).size, WORDS.length);
  assert.ok(WORDS.every((w) => w === w.trim() && !/[A-Z]{2}/.test(w)));
});

test('le premier dessinateur est la première place, 3 mots tirés avec ctx.random', () => {
  const s = start();
  assert.equal(s.phase, 'choosing');
  assert.equal(s.drawer, 1);
  assert.deepEqual(s.choices, ['chat', 'chien', 'cheval']);
  assert.equal(status(s).deadline, T0 + CHOOSE_MS);
  assert.deepEqual(status(s).turn, [1]);
  const other = setup(players, OPTS, ctx(T0, rnd(0.999999)));
  assert.equal(other.choices.length, 3);
  assert.equal(new Set(other.choices).size, 3);
});

test('les options sont bornées', () => {
  assert.deepEqual(setup(players, { seconds: 7, turns: 99 }, ctx()).options, { seconds: 80, turns: 5 });
});

test('seul le dessinateur voit le mot, ni les autres ni les spectateurs', () => {
  const s = start();
  assert.deepEqual(view(s, 1).choices, ['chat', 'chien', 'cheval']);
  for (const who of [2, 3, null]) {
    const json = JSON.stringify(view(s, who));
    assert.ok(!json.includes('chat') && !json.includes('chien') && !json.includes('cheval'), `fuite pour ${who}`);
  }
  const d = drawing();
  assert.equal(view(d, 1).word, 'chat');
  for (const who of [2, 3, 4, null]) {
    const v = view(d, who);
    assert.equal(v.word, undefined);
    assert.ok(!JSON.stringify(v).includes('chat'), `fuite pour ${who}`);
    assert.deepEqual(v.mask, ['_', '_', '_', '_']);
  }
});

test('choisir le mot : seul le dessinateur, un des trois, sinon le premier au bout de 20 s', () => {
  const s = start();
  assert.throws(() => move(s, 2, { type: 'choose', index: 0 }, ctx()), /dessinateur/);
  assert.throws(() => move(s, 1, { type: 'choose', index: 5 }, ctx()), /trois mots/);
  const picked = play(s, 1, { type: 'choose', index: 1 }, ctx(T0 + 3_000));
  assert.equal(picked.word, 'chien');
  assert.equal(picked.phase, 'drawing');
  assert.equal(picked.endsAt, T0 + 3_000 + 80_000);
  const auto = timeout(s, ctx(T0 + CHOOSE_MS)).state;
  assert.equal(auto.word, 'chat');
  assert.equal(auto.phase, 'drawing');
});

test('pendant le dessin, tout le monde peut jouer sauf ceux qui ont trouvé', () => {
  let s = drawing();
  assert.deepEqual(status(s).turn, [1, 2, 3, 4]);
  s = guess(s, 3, 'chat');
  assert.deepEqual(status(s).turn, [1, 2, 4]);
});

test('un trait : accepté, arrondi et borné ; refusé s’il est invalide', () => {
  let s = drawing();
  s = play(s, 1, stroke({ p: [10.4, -5, 500.6, 2000] }));
  assert.deepEqual(s.strokes[0].p, [10, 0, 501, 1000]);
  assert.throws(() => move(s, 2, stroke(), ctx()), /Seul le dessinateur/);
  assert.throws(() => move(s, 1, stroke({ p: [1, 2, 3] }), ctx()), /invalide/);
  assert.throws(() => move(s, 1, stroke({ p: [1, 'x'] }), ctx()), /invalide/);
  assert.throws(() => move(s, 1, stroke({ c: 10 }), ctx()), /Couleur/);
  assert.throws(() => move(s, 1, stroke({ w: 3 }), ctx()), /Épaisseur/);
  assert.throws(() => move(s, 1, stroke({ p: new Array(MAX_POINTS_PER_STROKE * 2 + 2).fill(5) }), ctx()), /trop long/);
  assert.equal(move(s, 1, stroke({ c: -1 }), ctx()).state.strokes[1].c, -1); // la gomme
});

test('annuler enlève le dernier trait, effacer tout vide la feuille', () => {
  let s = drawing();
  s = play(s, 1, stroke());
  s = play(s, 1, stroke({ c: 4 }));
  s = play(s, 1, { type: 'undo' });
  assert.equal(s.strokes.length, 1);
  assert.equal(s.strokes[0].c, 2);
  s = play(s, 1, { type: 'clear' });
  assert.deepEqual(s.strokes, []);
  assert.deepEqual(play(s, 1, { type: 'undo' }).strokes, []); // rien à annuler : sans erreur
  assert.throws(() => move(s, 2, { type: 'undo' }, ctx()), /Seul le dessinateur/);
});

test('la feuille a une limite de traits', () => {
  let s = drawing();
  for (let i = 0; i < MAX_STROKES; i++) s = play(s, 1, stroke());
  assert.throws(() => move(s, 1, stroke(), ctx()), /feuille est pleine/);
  s = play(s, 1, { type: 'undo' });
  s = play(s, 1, stroke()); // de la place est revenue
  assert.equal(s.strokes.length, MAX_STROKES);
});

test('la view contient les traits, pour tout le monde', () => {
  const s = play(drawing(), 1, stroke());
  for (const who of [1, 2, null]) assert.equal(view(s, who).strokes.length, 1);
});

test('normalisation et jugement des propositions', () => {
  assert.equal(normalize('  Éléphant '), 'elephant');
  assert.equal(normalize('Le chat'), normalize('chats'));
  assert.equal(judge('CHAT', 'chat'), 'right');
  assert.equal(judge('un chat', 'chat'), 'right');
  assert.equal(judge('éléphant', 'éléphant'), 'right');
  assert.equal(judge('tour eiffel', 'tour Eiffel'), 'right');
  assert.equal(judge('pomme-de-terre', 'pomme de terre'), 'right');
  assert.equal(judge('chas', 'chat'), 'close'); // une faute
  assert.equal(judge('elefant', 'éléphant'), 'close');
  assert.equal(judge('chien', 'chat'), 'wrong');
  assert.equal(judge('lit', 'lie'), 'wrong'); // trop court pour « presque »
  assert.equal(judge('', 'chat'), 'wrong');
  assert.equal(judge('parachute', 'parachutes'), 'right');
});

test('une bonne réponse n’est jamais montrée aux autres, un « presque » seulement à son auteur', () => {
  let s = drawing();
  s = guess(s, 2, 'chien');
  s = guess(s, 3, 'chas');
  s = guess(s, 4, 'Chat');
  const feed = (who) => view(s, who).feed;
  // Bob : sa propre proposition fausse ; Cli : son « presque » ; Dan : « a trouvé » sans le mot.
  assert.deepEqual(feed(2).map((e) => e.kind), ['wrong', 'found']);
  assert.deepEqual(feed(3).map((e) => e.kind), ['wrong', 'close', 'found']);
  assert.deepEqual(feed(null).map((e) => e.kind), ['wrong', 'found']);
  for (const who of [1, 2, 3, null]) {
    const found = feed(who).find((e) => e.kind === 'found');
    assert.deepEqual(found, { id: 4, kind: 'found' });
  }
  assert.ok(!JSON.stringify(feed(2)).includes('chas'));
  assert.ok(!JSON.stringify(view(s, 2)).includes('"Chat"'));
  assert.ok(!JSON.stringify(view(s, 2)).includes('"chat"'));
});

test('points dégressifs selon l’ordre, et le dessinateur gagne par devineur', () => {
  let s = drawing();
  s = guess(s, 3, 'chat');
  s = guess(s, 2, 'chat');
  assert.equal(s.scores[3], GUESS_POINTS[0]);
  assert.equal(s.scores[2], GUESS_POINTS[1]);
  assert.equal(s.scores[1], 2 * DRAWER_POINTS);
  assert.equal(s.scores[4], 0);
  assert.ok(GUESS_POINTS[0] > GUESS_POINTS[1] && GUESS_POINTS[1] > GUESS_POINTS[2]);
  assert.deepEqual(s.found, [3, 2]);
});

test('on ne peut pas trouver deux fois, ni deviner en dessinant, ni hors du dessin', () => {
  let s = drawing();
  s = guess(s, 2, 'chat');
  assert.throws(() => move(s, 2, { type: 'guess', text: 'chat' }, ctx()), /déjà trouvé/);
  assert.throws(() => move(s, 1, { type: 'guess', text: 'chat' }, ctx()), /ce sont les autres/);
  assert.throws(() => move(s, 3, { type: 'guess', text: '   ' }, ctx()), /proposition/);
  assert.throws(() => move(start(), 2, { type: 'guess', text: 'chat' }, ctx()), /prochain dessin/);
});

test('le tour finit dès que tout le monde a trouvé : le mot et les points s’affichent', () => {
  let s = drawing();
  s = guess(s, 2, 'chat', T0 + 10_000);
  s = guess(s, 3, 'chat', T0 + 12_000);
  assert.equal(s.phase, 'drawing');
  s = guess(s, 4, 'chat', T0 + 20_000);
  assert.equal(s.phase, 'reveal');
  const st = status(s);
  assert.deepEqual(st.turn, []);
  assert.equal(st.deadline, T0 + 20_000 + REVEAL_MS);
  const v = view(s, 2);
  assert.equal(v.word, 'chat');
  assert.deepEqual(v.gained, { 2: 300, 1: 3 * DRAWER_POINTS, 3: 240, 4: 200 });
  assert.equal(view(s, null).word, 'chat'); // les spectateurs voient aussi le mot, maintenant
});

test('le tour finit au chrono si personne n’a tout trouvé', () => {
  let s = drawing();
  s = guess(s, 2, 'chat');
  s = timeout(s, ctx(T0 + 80_000)).state;
  assert.equal(s.phase, 'reveal');
  assert.equal(view(s, 3).word, 'chat');
  assert.deepEqual(view(s, 3).gained, { 2: 300, 1: DRAWER_POINTS });
});

test('les indices : une lettre de plus à chaque échéance, jamais le mot entier', () => {
  let s = play(start(), 1, { type: 'choose', index: 0 }, ctx(T0, rnd(0.5))); // « chat »
  assert.equal(s.hintAt.length, 1);
  assert.equal(status(s).deadline, T0 + Math.round(80_000 * 0.35));
  assert.equal(view(s, 2).mask.filter((c) => c !== '_').length, 0);
  s = timeout(s, ctx(T0 + 28_000)).state;
  assert.equal(s.phase, 'drawing');
  const mask = view(s, 2).mask;
  assert.equal(mask.filter((c) => c !== '_').length, 1);
  assert.equal(status(s).deadline, T0 + 80_000); // plus d'indice : prochaine échéance = la fin
  // Le hub peut réveiller le minuteur quelques ms trop tôt : on ne finit pas le tour pour autant.
  assert.equal(timeout(s, ctx(T0 + 79_900 - 100)).state.phase, 'drawing');
});

test('un mot long dévoile jusqu’à 3 lettres, espaces et tirets restent visibles', () => {
  let s = start();
  s = { ...s, choices: ['pomme de terre', 'x', 'y'] };
  s = play(s, 1, { type: 'choose', index: 0 });
  assert.equal(s.hintAt.length, 3);
  assert.deepEqual(view(s, 2).mask.join(''), '_____ __ _____');
  s = timeout(s, ctx(T0 + 20_000)).state;
  s = timeout(s, ctx(T0 + 44_000)).state;
  s = timeout(s, ctx(T0 + 60_000)).state;
  const m = view(s, 2).mask;
  assert.equal(m.filter((c) => c !== '_' && c !== ' ').length, 3);
  assert.equal(m[5], ' ');
  assert.equal(m[8], ' ');
  const dash = { ...start(), choices: ['arc-en-ciel', 'a', 'b'] };
  assert.equal(view(play(dash, 1, { type: 'choose', index: 0 }), 2).mask[3], '-');
});

test('tour suivant : dessinateur suivant, nouveaux mots, points conservés', () => {
  let s = drawing();
  s = guess(s, 2, 'chat');
  s = timeout(s, ctx(T0 + 80_000)).state; // reveal
  s = timeout(s, ctx(T0 + 90_000, rnd(0.2))).state;
  assert.equal(s.phase, 'choosing');
  assert.equal(s.drawer, 2);
  assert.equal(s.turn, 1);
  assert.deepEqual(s.strokes, []);
  assert.deepEqual(s.found, []);
  assert.ok(!s.choices.includes('chat'));
  assert.equal(s.scores[2], 300);
  assert.equal(view(s, 3).round, 1);
});

test('la partie dure « tours de table » × joueurs tours, puis le plus de points gagne', () => {
  let s = setup(players.slice(0, 3), { seconds: 60, turns: 2 }, ctx());
  let t = T0;
  let drawers = [];
  for (let i = 0; i < 6; i++) {
    drawers.push(s.drawer);
    s = play(s, s.drawer, { type: 'choose', index: 0 }, ctx(t));
    const guesserIds = [1, 2, 3].filter((id) => id !== s.drawer);
    // Le joueur 2 trouve toujours en premier quand il le peut : il gagne.
    const first = guesserIds.includes(2) ? 2 : guesserIds[0];
    s = guess(s, first, s.word, t + 1000);
    t += 100_000;
    s = timeout(s, ctx(t)).state; // fin du tour
    s = timeout(s, ctx(t + 10_000)).state; // fin de l'écran de mot
    t += 10_000;
  }
  assert.deepEqual(drawers, [1, 2, 3, 1, 2, 3]);
  assert.equal(s.phase, 'over');
  const st = status(s);
  assert.equal(st.over, true);
  assert.equal(st.turn, null);
  assert.deepEqual(st.winners, [2]);
  assert.throws(() => move(s, 1, { type: 'guess', text: 'x' }, ctx()), /terminée/);
});

test('le dessinateur qui part arrête le tour, sans dessinateur à sa place', () => {
  let s = drawing();
  s = guess(s, 2, 'chat');
  s = leave(s, 1, ctx(T0 + 30_000)).state;
  assert.equal(s.phase, 'reveal');
  assert.equal(view(s, 3).word, 'chat');
  assert.throws(() => move(s, 1, { type: 'choose', index: 0 }, ctx()), /ne joues plus/);
  s = timeout(s, ctx(T0 + 40_000)).state;
  assert.equal(s.drawer, 2); // le suivant
  // Et ses tours suivants sont sautés : il y avait 8 tours, il en reste 6 (3 joueurs × 2).
  const drawersLater = [];
  for (let i = 0; i < 8 && s.phase !== 'over'; i++) {
    drawersLater.push(s.drawer);
    s = play(s, s.drawer, { type: 'choose', index: 0 }, ctx(T0 + 100_000 * (i + 1)));
    s = timeout(s, ctx(T0 + 100_000 * (i + 1) + 80_000)).state;
    s = timeout(s, ctx(T0 + 100_000 * (i + 1) + 90_000)).state;
  }
  assert.ok(!drawersLater.includes(1));
  assert.equal(s.phase, 'over');
  assert.ok(!status(s).winners.includes(1));
});

test('un dessinateur qui part pendant le choix du mot : on passe au suivant', () => {
  const s = leave(start(), 1, ctx(T0 + 2_000)).state;
  assert.equal(s.phase, 'choosing');
  assert.equal(s.drawer, 2);
});

test('un devineur qui part : si tous les autres ont trouvé, le tour finit', () => {
  let s = drawing();
  s = guess(s, 2, 'chat');
  s = guess(s, 3, 'chat');
  assert.equal(s.phase, 'drawing');
  s = leave(s, 4, ctx(T0 + 30_000)).state;
  assert.equal(s.phase, 'reveal');
});

test('moins de deux joueurs : la partie se termine', () => {
  let s = setup(players.slice(0, 3), OPTS, ctx());
  s = leave(s, 2, ctx()).state;
  assert.notEqual(s.phase, 'over');
  s = leave(s, 3, ctx()).state;
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s).winners, [1]);
});

test('l’état reçu n’est jamais modifié', () => {
  const s = drawing();
  const copy = JSON.stringify(s);
  guess(s, 2, 'chien');
  guess(s, 2, 'chat');
  play(s, 1, stroke());
  timeout(s, ctx(T0 + 80_000));
  assert.equal(JSON.stringify(s), copy);
});
