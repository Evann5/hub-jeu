// Tests des règles d'Undercover : node --test games/undercover/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, status, view, timeout, leave, normalize, maxUndercovers } from './rules.js';

// Hasard fixe : une suite de nombres qui se répète.
function seeded(seed = 1) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}
const ctx = (now = 1000) => ({ now, random: seeded(7) });
const players = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `p${i + 1}` }));
const opts = { undercovers: 1, mrWhite: true, clueTime: 45, debateTime: 90 };

function play(s, id, action) {
  return move(s, id, action, ctx()).state;
}
// Tout le monde mémorise son mot.
function pastWord(s) {
  for (const id of s.order) s = play(s, id, { type: 'ready' });
  return s;
}
// Indices de tous les vivants, dans l'ordre.
function allClues(s) {
  let i = 0;
  while (s.phase === 'clues') {
    const id = status(s).turn;
    s = play(s, id, { type: 'clue', text: `indice${s.round}x${i++}` });
  }
  return s;
}
const byRole = (s, role) => s.players.filter((id) => s.roles[id] === role);

test('distribution : 1 Undercover, 1 Mr. White, le reste civils ; Mr. White ne commence pas', () => {
  for (let seed = 1; seed < 30; seed++) {
    const s = setup(players(6), opts, { now: 0, random: seeded(seed) });
    assert.equal(byRole(s, 'under').length, 1);
    assert.equal(byRole(s, 'white').length, 1);
    assert.equal(byRole(s, 'civil').length, 4);
    assert.notEqual(s.roles[s.order[0]], 'white');
    assert.notEqual(s.words.civil, s.words.under);
  }
});

test('pas de Mr. White à 3 joueurs, Undercover limités par la taille de la table', () => {
  const s = setup(players(3), { ...opts, undercovers: 3 }, ctx());
  assert.equal(byRole(s, 'white').length, 0);
  assert.equal(byRole(s, 'under').length, 1);
  assert.equal(maxUndercovers(12, 1), 5);
});

test('chacun ne voit que son mot ; Mr. White sait qu’il est Mr. White ; le spectateur ne voit rien', () => {
  const s = setup(players(5), opts, ctx());
  const civil = byRole(s, 'civil')[0];
  const white = byRole(s, 'white')[0];
  assert.equal(view(s, civil).me.word, s.words.civil);
  assert.equal(view(s, white).me.word, null);
  assert.equal(view(s, white).me.white, true);
  const spec = view(s, null);
  assert.equal(spec.me, null);
  assert.deepEqual(spec.roles, {});
  assert.equal(spec.words, null);
  assert.ok(!JSON.stringify(spec).includes(s.words.civil));
});

test('phase mot : passe aux indices quand tout le monde est prêt, ou au minuteur', () => {
  let s = setup(players(4), opts, ctx());
  assert.equal(s.phase, 'word');
  assert.equal(status(s).turn.length, 4);
  s = pastWord(s);
  assert.equal(s.phase, 'clues');
  const t = timeout(setup(players(4), opts, ctx()), ctx(99_000)).state;
  assert.equal(t.phase, 'clues');
});

test('indices : chacun son tour, refus du mot lui-même et des doublons', () => {
  let s = pastWord(setup(players(5), opts, ctx()));
  const first = status(s).turn;
  assert.equal(first, s.order[0]);
  const word = s.words[s.roles[first]];
  assert.throws(() => move(s, first, { type: 'clue', text: word.toUpperCase() }, ctx()), /ne doit pas contenir/);
  assert.throws(() => move(s, first, { type: 'clue', text: '   ' }, ctx()), /Écris un indice/);
  s = play(s, first, { type: 'clue', text: 'Rouge' });
  assert.equal(status(s).turn, s.order[1]);
  assert.throws(() => move(s, s.order[1], { type: 'clue', text: 'rouge' }, ctx()), /déjà été donné/);
});

test('minuteur d’indice : le joueur passe sans indice', () => {
  let s = pastWord(setup(players(4), opts, ctx()));
  const first = status(s).turn;
  s = timeout(s, ctx(50_000)).state;
  assert.deepEqual(s.clues.at(-1), { round: 1, id: first, text: null });
  assert.equal(status(s).turn, s.order[1]);
});

test('vote : l’Undercover éliminé à 4 joueurs sans Mr. White → les civils gagnent', () => {
  let s = allClues(pastWord(setup(players(4), { ...opts, mrWhite: false }, ctx())));
  assert.equal(s.phase, 'debate');
  s = pastWord(s); // tout le monde prêt à voter
  assert.equal(s.phase, 'vote');
  const under = byRole(s, 'under')[0];
  const civils = byRole(s, 'civil');
  assert.throws(() => move(s, civils[0], { type: 'vote', target: civils[0] }, ctx()), /pour toi/);
  for (const id of civils) s = play(s, id, { type: 'vote', target: under });
  assert.equal(s.phase, 'vote'); // l'Undercover n'a pas encore voté
  s = play(s, under, { type: 'vote', target: civils[0] });
  assert.equal(s.phase, 'over');
  assert.equal(s.result.winner, 'civil');
  assert.deepEqual(status(s).winners.sort(), civils.sort());
  assert.equal(view(s, null).words.civil, s.words.civil);
});

test('les intrus gagnent quand il ne reste que deux joueurs', () => {
  let s = allClues(pastWord(setup(players(3), opts, ctx())));
  s = pastWord(s);
  const under = byRole(s, 'under')[0];
  const [c1, c2] = byRole(s, 'civil');
  s = play(s, under, { type: 'vote', target: c1 });
  s = play(s, c2, { type: 'vote', target: c1 });
  s = play(s, c1, { type: 'vote', target: under });
  assert.equal(s.phase, 'over');
  assert.equal(s.result.winner, 'under');
  assert.deepEqual(status(s).winners, [under]);
});

test('à 4 avec Mr. White, éliminer un civil ne termine pas la partie', () => {
  let s = allClues(pastWord(setup(players(4), opts, ctx())));
  s = pastWord(s);
  const [c1] = byRole(s, 'civil');
  for (const id of s.order) s = play(s, id, { type: 'vote', target: id === c1 ? s.order.find((x) => x !== c1) : c1 });
  assert.equal(s.phase, 'verdict');
});

test('égalité : second vote entre ex æquo, puis tirage au sort', () => {
  let s = allClues(pastWord(setup(players(4), { ...opts, mrWhite: false }, ctx())));
  s = pastWord(s);
  const [a, b, c, d] = s.order;
  s = play(s, a, { type: 'vote', target: b });
  s = play(s, b, { type: 'vote', target: a });
  s = play(s, c, { type: 'vote', target: a });
  s = play(s, d, { type: 'vote', target: b });
  assert.equal(s.phase, 'vote');
  assert.deepEqual(s.candidates.sort(), [a, b].sort());
  assert.throws(() => move(s, c, { type: 'vote', target: d }, ctx()), /encore en jeu/);
  s = play(s, a, { type: 'vote', target: b });
  s = play(s, b, { type: 'vote', target: a });
  s = play(s, c, { type: 'vote', target: a });
  s = play(s, d, { type: 'vote', target: b });
  assert.equal(s.verdicts.at(-1).by, 'tirage');
  assert.ok([a, b].includes(s.verdicts.at(-1).id));
});

test('le vote ne dit pas qui a voté pour qui', () => {
  let s = allClues(pastWord(setup(players(4), opts, ctx())));
  s = pastWord(s);
  const [a, b] = s.order;
  s = play(s, a, { type: 'vote', target: b });
  const v = view(s, b);
  assert.deepEqual(v.voted, [a]);
  assert.equal(v.me.voted, null);
  assert.equal(view(s, a).me.voted, b);
  assert.ok(!JSON.stringify(v).includes('"votes"'));
});

test('Mr. White éliminé : il devine le mot des civils et gagne seul', () => {
  let s = allClues(pastWord(setup(players(5), opts, ctx())));
  s = pastWord(s);
  const white = byRole(s, 'white')[0];
  for (const id of s.order) s = play(s, id, { type: 'vote', target: id === white ? s.order.find((x) => x !== white) : white });
  assert.equal(s.phase, 'white');
  assert.equal(status(s).turn, white);
  s = play(s, white, { type: 'guess', text: ` ${s.words.civil.toUpperCase()}S ` });
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.result, { winner: 'white', winners: [white] });
});

test('Mr. White se trompe : verdict puis manche suivante', () => {
  let s = allClues(pastWord(setup(players(5), opts, ctx())));
  s = pastWord(s);
  const white = byRole(s, 'white')[0];
  for (const id of s.order) s = play(s, id, { type: 'vote', target: id === white ? s.order.find((x) => x !== white) : white });
  s = play(s, white, { type: 'guess', text: 'pas du tout' });
  assert.equal(s.phase, 'verdict');
  assert.equal(s.whiteGuess.right, false);
  s = timeout(s, ctx(10_000_000)).state;
  assert.equal(s.phase, 'clues');
  assert.equal(s.round, 2);
  assert.ok(!s.order.filter((id) => !s.out.includes(id)).includes(white));
});

test('personne ne vote : personne n’est éliminé, manche suivante', () => {
  let s = allClues(pastWord(setup(players(4), opts, ctx())));
  s = pastWord(s);
  s = timeout(s, ctx(10_000_000)).state;
  assert.equal(s.phase, 'verdict');
  assert.equal(s.out.length, 0);
  assert.equal(s.verdicts.at(-1).by, 'personne');
});

test('abandon pendant son tour d’indice : la partie continue', () => {
  let s = pastWord(setup(players(5), opts, ctx()));
  const first = status(s).turn;
  s = leave(s, first, ctx()).state;
  assert.ok(s.out.includes(first));
  assert.notEqual(status(s).turn, first);
  assert.equal(s.verdicts.at(-1).by, 'départ');
});

test('normalize : accents, casse, pluriel', () => {
  assert.equal(normalize('Crêpes'), normalize('crepe'));
  assert.equal(normalize('Pain au Chocolat'), 'pain au chocolat');
});

// Audit des coups forgés : move() refuse seul ce que le hub filtre déjà par `turn`.
test('un indice se donne à son tour, pas avant', () => {
  const s = pastWord(setup(players(5), opts, ctx()));
  assert.equal(s.phase, 'clues');
  const turn = status(s).turn;
  const other = s.order.find((id) => id !== turn);
  assert.throws(() => move(s, other, { type: 'clue', text: 'bizarre' }, ctx()), /pas à toi/);
});

test('on ne vote qu’une fois, et pas quand on est éliminé', () => {
  let s = allClues(pastWord(setup(players(5), { ...opts, mrWhite: false }, ctx())));
  s = pastWord(s);
  const [victim, a, b, c, d] = [...byRole(s, 'civil'), byRole(s, 'under')[0]];
  s = play(s, a, { type: 'vote', target: b });
  assert.throws(() => move(s, a, { type: 'vote', target: c }, ctx()), /déjà voté/);
  assert.equal(s.votes[a], b);
  // Le vote élimine un civil (4 voix sur 5) ; il ne vote plus ensuite.
  s = play(s, b, { type: 'vote', target: victim });
  s = play(s, c, { type: 'vote', target: victim });
  s = play(s, d, { type: 'vote', target: victim });
  s = play(s, victim, { type: 'vote', target: a });
  assert.ok(s.out.includes(victim), 'le civil est éliminé');
  assert.equal(s.phase, 'verdict');
  s = allClues(pastWord(s)); // manche suivante : indices, puis débat
  s = pastWord(s);
  assert.equal(s.phase, 'vote');
  assert.throws(() => move(s, victim, { type: 'vote', target: a }, ctx()), /éliminé/);
});

test('seul Mr. White éliminé propose un mot', () => {
  let s = allClues(pastWord(setup(players(5), opts, ctx())));
  s = pastWord(s);
  const white = byRole(s, 'white')[0];
  for (const id of s.order) s = play(s, id, { type: 'vote', target: id === white ? s.order.find((x) => x !== white) : white });
  assert.equal(s.phase, 'white');
  const other = s.order.find((id) => id !== white);
  assert.throws(() => move(s, other, { type: 'guess', text: s.words.civil }, ctx()), /Mr. White/);
});
