// Tests des règles de Passe-Dessin : node --test games/passe-dessin/rules.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, timeout, leave, status, view, GRACE_MS, TEXT_MAX } from './rules.js';

const ctx = (now = 1000) => ({ now, random: () => 0.5 });
const players = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `p${i + 1}` }));
const play = (s, id, action, now = 1000) => move(s, id, action, ctx(now)).state;
const stroke = (x = 100) => ({ c: 2, w: 1, p: [x, 100, x + 50, 150, x + 80, 300] });

// Chacun fait sa copie de l'étape en cours (texte ou dessin selon ce qu'il a reçu).
function everyone(s, label = 'x') {
  for (const id of s.players.filter((p) => !s.left.includes(p))) {
    if (s.phase !== 'play') break;
    const v = view(s, id);
    s = play(s, id, v.task.kind === 'draw' ? { type: 'submit', strokes: [stroke(id * 10)] } : { type: 'submit', text: `${label} de ${id}` });
  }
  return s;
}

test('une chaîne par joueur, chacun touche chaque chaîne une fois : phrase, dessin, description…', () => {
  let s = setup(players(4), {}, ctx());
  assert.equal(s.steps, 4, 'tour complet : autant d’étapes que de joueurs');
  assert.equal(view(s, 1).task.kind, 'write');
  s = everyone(s, 'phrase');
  assert.equal(s.step, 1);
  // À l'étape 1, le joueur 2 dessine la phrase du joueur 1 (la chaîne de sa voisine d'avant).
  assert.equal(view(s, 2).task.kind, 'draw');
  assert.deepEqual(view(s, 2).task.prompt, { text: 'phrase de 1', by: 1 });
  s = everyone(s);
  assert.equal(view(s, 3).task.kind, 'guess', 'puis on décrit un dessin');
  assert.equal(view(s, 3).task.prompt.by, 2);
  assert.ok(Array.isArray(view(s, 3).task.prompt.strokes));
  assert.equal(view(s, 3).task.prompt.text, undefined, 'sans voir la phrase de départ');
  s = everyone(s, 'vu');
  s = everyone(s);
  assert.equal(s.phase, 'album');
  for (const c of s.chains) {
    assert.deepEqual(c.entries.map((e) => e.kind), ['text', 'drawing', 'text', 'drawing']);
    assert.deepEqual(new Set(c.entries.map((e) => e.by)).size, 4, 'quatre mains différentes');
    assert.equal(c.entries[0].by, c.owner);
  }
});

test('pendant les étapes, on ne voit que sa copie à faire, jamais les autres chaînes', () => {
  let s = setup(players(3), {}, ctx());
  s = everyone(s, 'secret');
  const v = view(s, 1);
  assert.equal(v.chains, undefined);
  assert.equal(JSON.stringify(v).includes('secret de 2'), false);
  assert.equal(JSON.stringify(v).includes('secret de 1'), false, 'pas même sa propre phrase');
  const spect = view(s, null);
  assert.equal(spect.task, undefined);
  assert.equal(JSON.stringify(spect).includes('secret'), false);
});

test('copie vide refusée à la main, acceptée à la fin du temps (case passée) ; « Modifier » reprend la copie', () => {
  let s = setup(players(3), {}, ctx());
  assert.throws(() => play(s, 1, { type: 'submit', text: '  ' }), /Écris une phrase/);
  assert.throws(() => play(s, 1, { type: 'submit', text: 'a'.repeat(TEXT_MAX + 1) }), /caractères au plus/);
  s = play(s, 1, { type: 'submit', text: 'Un chat sur la Lune' });
  assert.throws(() => play(s, 1, { type: 'submit', text: 'autre' }), /Modifier/);
  assert.deepEqual(status(s).turn, [2, 3]);
  assert.deepEqual(status(s).may, [1]);
  s = play(s, 1, { type: 'edit' });
  assert.equal(view(s, 1).sent, null);
  s = play(s, 1, { type: 'submit', text: 'Un chien sur Mars' });
  s = play(s, 2, { type: 'submit', text: '', auto: true });
  s = play(s, 3, { type: 'submit', text: 'Une pizza volante' });
  assert.equal(s.step, 1);
  assert.equal(s.chains[1].entries[0].kind, 'skip');
  // La chaîne vide repart d'une phrase chez le joueur suivant.
  assert.equal(view(s, 3).task.kind, 'write');
  assert.equal(view(s, 3).task.restart, true);
});

test('dessins : traits bornés, couleur et épaisseur vérifiées, dessin vide refusé', () => {
  let s = setup(players(3), {}, ctx());
  s = everyone(s);
  assert.throws(() => play(s, 2, { type: 'submit', strokes: [] }), /Dessine quelque chose/);
  assert.throws(() => play(s, 2, { type: 'submit', strokes: [{ c: 99, w: 0, p: [1, 1] }] }), /Couleur/);
  assert.throws(() => play(s, 2, { type: 'submit', strokes: [{ c: 0, w: 9, p: [1, 1] }] }), /Épaisseur/);
  assert.throws(() => play(s, 2, { type: 'submit', strokes: Array.from({ length: 12 }, () => ({ c: 0, w: 0, p: Array(800).fill(5) })) }), /trop chargé/);
  s = play(s, 2, { type: 'submit', strokes: [{ c: -1, w: 3, p: [5000, -20] }] });
  assert.deepEqual(s.pending[2].strokes[0].p, [1000, 0], 'points ramenés dans le cadre');
});

test('minuteur : l’étape se ferme seule (cases passées pour ceux qui n’ont rien rendu) ; deadline avec un délai de grâce', () => {
  let s = setup(players(3), { writeSec: 30, drawSec: 60 }, ctx(0));
  assert.equal(s.stepEnds, 30_000);
  assert.equal(status(s).deadline, 30_000 + GRACE_MS);
  s = play(s, 1, { type: 'submit', text: 'Une baleine' });
  s = timeout(s, ctx(33_000)).state;
  assert.equal(s.step, 1);
  assert.equal(s.stepEnds, 33_000 + 60_000, 'une étape de dessin dure le temps du dessin');
  assert.deepEqual(s.chains.map((c) => c.entries[0].kind), ['text', 'skip', 'skip']);
});

test('longueur des chaînes : 4 étapes au plus avec l’option, même à 6 joueurs', () => {
  let s = setup(players(6), { steps: 4 }, ctx());
  assert.equal(s.steps, 4);
  for (let k = 0; k < 4; k++) s = everyone(s);
  assert.equal(s.phase, 'album');
  assert.ok(s.chains.every((c) => c.entries.length === 4));
});

test('album : l’hôte dévoile page après page, chaîne après chaîne ; cœurs ; puis tout est visible', () => {
  let s = setup(players(3), {}, ctx());
  for (let k = 0; k < 3; k++) s = everyone(s);
  assert.equal(s.phase, 'album');
  assert.deepEqual(status(s).turn, [1]);
  let v = view(s, 2);
  assert.equal(v.chains[0].entries.length, 1, 'une seule page dévoilée');
  assert.equal(v.chains[1].entries.length, 0);
  assert.throws(() => play(s, 2, { type: 'next' }), /hôte/);
  assert.throws(() => play(s, 2, { type: 'like', chain: 1, entry: 0 }), /pas encore dévoilée/);
  assert.throws(() => play(s, 1, { type: 'like', chain: 0, entry: 0 }), /soi-même/, 'la page 0 de la chaîne 0 est du joueur 1');
  s = play(s, 2, { type: 'like', chain: 0, entry: 0 });
  assert.equal(view(s, 2).chains[0].entries[0].likes, 1);
  assert.equal(view(s, 2).chains[0].entries[0].liked, true);
  assert.equal(view(s, 3).chains[0].entries[0].liked, false);
  s = play(s, 2, { type: 'like', chain: 0, entry: 0 });
  assert.equal(view(s, 2).chains[0].entries[0].likes, 0, 'second clic : le cœur s’enlève');
  for (let k = 0; k < 8; k++) s = play(s, 1, { type: 'next' }); // 9 pages : la dernière est dévoilée au 8e clic
  assert.equal(s.phase, 'album');
  s = play(s, 1, { type: 'next' });
  assert.equal(s.phase, 'over');
  assert.equal(status(s).over, true);
  assert.deepEqual(status(s).winners, []);
  v = view(s, null);
  assert.ok(v.chains.every((c) => c.entries.length === 3), 'à la fin, tout est visible, même pour un spectateur');
});

test('album sans clic : il avance tout seul', () => {
  let s = setup(players(3), {}, ctx());
  for (let k = 0; k < 3; k++) s = everyone(s);
  const before = s.album.shown;
  s = timeout(s, ctx(s.albumAt)).state;
  assert.equal(s.album.shown, before + 1);
});

test('abandon : sa copie devient une case passée, l’étape se ferme si les autres ont fini ; seul restant, on passe à l’album', () => {
  let s = setup(players(4), {}, ctx());
  s = play(s, 1, { type: 'submit', text: 'a' });
  s = play(s, 2, { type: 'submit', text: 'b' });
  s = play(s, 3, { type: 'submit', text: 'c' });
  s = leave(s, 4, ctx()).state;
  assert.equal(s.step, 1, 'les trois autres avaient fini');
  assert.equal(s.chains[3].entries[0].kind, 'skip');
  // Aux étapes suivantes, la place du joueur parti est passée d'office.
  s = everyone(s);
  assert.equal(s.step, 2);
  s = leave(s, 3, ctx()).state;
  s = leave(s, 2, ctx()).state;
  assert.equal(s.phase, 'album');
  assert.deepEqual(status(s).turn, [1]);
});
