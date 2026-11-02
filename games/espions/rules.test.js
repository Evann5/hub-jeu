// Tests des règles d'Espions : node --test games/espions/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, timeout, leave, view, status, tooClose, normalize } from './rules.js';
import { WORDS } from './words.js';

const ctx = (random = () => 0, now = 1_000_000) => ({ now, random });
const act = (s, id, action, c = ctx()) => move(s, id, action, c).state;

// Salon : 1, 3, 5 en rouge (chef 1) ; 2, 4, 6 en bleu (chef 2). Avec random() = 0, le rouge commence (9 cartes).
function lobby(n = 6, options = {}) {
  const players = Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `p${i + 1}` }));
  const s = setup(players, options, ctx());
  for (const p of players) s.team[p.id] = p.id % 2 ? 'red' : 'blue';
  s.lead = { red: 1, blue: 2 };
  return s;
}
function started(n = 6, options = {}, c = ctx()) {
  return act(lobby(n, options), 1, { type: 'start' }, c);
}
const idx = (s, kind) => s.key.map((k, i) => (k === kind ? i : -1)).filter((i) => i >= 0);
// Un indice qui ne ressemble à aucun mot de la grille.
const CLUE = { type: 'clue', word: 'zzzz', number: 2 };

test('setup : tout le monde a une équipe, réparties à parts égales, avec le hasard du contexte', () => {
  const players = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, pseudo: `p${i}` }));
  const a = setup(players, {}, ctx(() => 0.3));
  const b = setup(players, {}, ctx(() => 0.3));
  assert.deepEqual(a.team, b.team);
  assert.equal(a.phase, 'teams');
  const red = Object.values(a.team).filter((t) => t === 'red').length;
  assert.equal(red, 4);
  assert.equal(Object.keys(a.team).length, 7);
  assert.deepEqual(a.lead, { red: null, blue: null });
  assert.equal(view(a, 1).cards, undefined, 'pas de grille avant le début');
  assert.equal(status(a).over, false);
  assert.equal(status(a).deadline, null);
});

test('équipes : changer d’équipe, se proposer chef, un seul chef par équipe', () => {
  const players = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, pseudo: `p${i}` }));
  let s = setup(players, {}, ctx());
  s = act(s, 1, { type: 'team', team: 'red' });
  s = act(s, 1, { type: 'lead' });
  assert.equal(s.lead.red, 1);
  s = act(s, 2, { type: 'team', team: 'red' });
  assert.throws(() => act(s, 2, { type: 'lead' }), /déjà un chef/);
  s = act(s, 1, { type: 'team', team: 'blue' }); // changer d'équipe fait perdre la place de chef
  assert.equal(s.lead.red, null);
  assert.equal(s.team[1], 'blue');
  s = act(s, 2, { type: 'lead' });
  s = act(s, 2, { type: 'lead', on: false });
  assert.equal(s.lead.red, null);
  assert.throws(() => act(s, 1, { type: 'team', team: 'vert' }), /Équipe inconnue/);
  assert.throws(() => act(s, 1, { type: 'danse' }), /Choisis ton équipe/);
});

test('répartition au hasard : les chefs sont à reprendre', () => {
  const s = act(lobby(), 3, { type: 'shuffle' }, ctx(() => 0.7));
  assert.deepEqual(s.lead, { red: null, blue: null });
  const red = Object.values(s.team).filter((t) => t === 'red').length;
  assert.equal(red, 3);
});

test('commencer : il faut un chef et un agent dans chaque équipe', () => {
  const s = lobby();
  assert.throws(() => act({ ...s, lead: { red: null, blue: 2 } }, 1, { type: 'start' }), /Il manque un chef à l’équipe rouge/);
  assert.throws(() => act({ ...s, lead: { red: 1, blue: null } }, 1, { type: 'start' }), /Il manque un chef à l’équipe bleue/);
  const lonely = { ...s, team: { ...s.team, 3: 'blue', 5: 'blue' } }; // le rouge n'a plus que son chef
  assert.throws(() => act(lonely, 1, { type: 'start' }), /au moins un agent/);
  assert.equal(act(s, 4, { type: 'start' }).phase, 'clue');
});

test('début de partie : 25 mots différents, clé 9 / 8 / 7 / 1, l’équipe qui commence a 9 cartes', () => {
  for (const r of [0, 0.4, 0.99]) {
    const s = started(6, {}, ctx(() => r));
    assert.equal(s.words.length, 25);
    assert.equal(new Set(s.words).size, 25);
    assert.ok(s.words.every((w) => WORDS.includes(w)));
    const count = (k) => s.key.filter((x) => x === k).length;
    assert.equal(count(s.first), 9);
    assert.equal(count(s.first === 'red' ? 'blue' : 'red'), 8);
    assert.equal(count('neutral'), 7);
    assert.equal(count('assassin'), 1);
    assert.equal(s.active, s.first);
    assert.equal(s.phase, 'clue');
  }
  assert.equal(started(6, {}, ctx(() => 0)).first, 'red');
  assert.equal(started(6, {}, ctx(() => 0.99)).first, 'blue');
});

test('la liste de mots est assez grande, sans doublon ni mot trop long', () => {
  assert.ok(WORDS.length >= 400);
  assert.equal(new Set(WORDS).size, WORDS.length);
  assert.ok(WORDS.every((w) => w.length >= 3 && w.length <= 9 && !/\s/.test(w)));
});

test('view : seuls les chefs voient la clé, les agents et spectateurs ne la voient pas', () => {
  const s = started();
  const chef = view(s, 1);
  assert.deepEqual(chef.key, s.key);
  assert.equal(chef.me.role, 'chef');
  assert.deepEqual(view(s, 2).key, s.key, 'le chef adverse aussi');
  for (const who of [3, 4, 5, 6, null]) {
    const v = view(s, who);
    assert.equal(v.key, undefined);
    assert.ok(v.cards.every((c) => c.kind === null), 'aucune carte retournée : aucun type visible');
    assert.equal(JSON.stringify(v).includes('assassin'), false);
  }
  assert.equal(view(s, 3).me.role, 'agent');
  assert.equal(view(s, null).me, null);
});

test('une carte retournée montre son type à tous, la fin de partie révèle la clé', () => {
  let s = started(4);
  s = act(s, 1, CLUE);
  const mine = idx(s, 'red')[0];
  s = act(s, 3, { type: 'pick', card: mine });
  assert.equal(view(s, 3).cards[mine].kind, 'red');
  assert.equal(view(s, null).cards[mine].kind, 'red');
  assert.equal(view(s, 3).key, undefined);
  const a = idx(s, 'assassin')[0];
  s = act(s, 3, { type: 'pick', card: a });
  assert.equal(s.phase, 'over');
  assert.deepEqual(view(s, 3).key, s.key, 'fin : la clé est montrée à tous');
  assert.deepEqual(view(s, null).key, s.key);
});

test('indice : seulement le chef de l’équipe qui joue, un mot et un nombre', () => {
  const s = started();
  assert.throws(() => act(s, 2, CLUE), /chef de l’équipe rouge/);
  assert.throws(() => act(s, 3, CLUE), /chef de l’équipe rouge/);
  assert.throws(() => act(s, 1, { type: 'pick', card: 0 }), /indice/);
  assert.throws(() => act(s, 1, { type: 'clue', word: '', number: 1 }), /seul mot/);
  assert.throws(() => act(s, 1, { type: 'clue', word: 'deux mots', number: 1 }), /seul mot/);
  assert.throws(() => act(s, 1, { type: 'clue', word: 'abc12', number: 1 }), /seul mot/);
  assert.throws(() => act(s, 1, { type: 'clue', word: 'x'.repeat(30), number: 1 }), /seul mot/);
  assert.throws(() => act(s, 1, { type: 'clue', word: 'zzzz', number: 10 }), /entre 0 et 9/);
  assert.throws(() => act(s, 1, { type: 'clue', word: 'zzzz', number: 1.5 }), /entre 0 et 9/);
  assert.throws(() => act(s, 1, { type: 'clue', word: 'zzzz', number: -1 }), /entre 0 et 9/);
  const t = act(s, 1, { type: 'clue', word: 'Évasion', number: 3 });
  assert.equal(t.phase, 'guess');
  assert.deepEqual(t.clue, { team: 'red', word: 'Évasion', number: 3 });
  assert.equal(t.max, 4, 'nombre + 1 essais');
  assert.deepEqual(status(t).turn, [3, 5]);
});

test('indice : jamais un mot de la grille (accents, majuscules, mots proches)', () => {
  const s = started();
  const w = s.words[0];
  assert.throws(() => act(s, 1, { type: 'clue', word: w.toUpperCase(), number: 1 }), /trop proche/);
  assert.throws(() => act(s, 1, { type: 'clue', word: `${normalize(w)}s`, number: 1 }), w.length >= 4 ? /trop proche/ : /^$|./);
  assert.equal(tooClose('Soleil', 'soleil'), true);
  assert.equal(tooClose('ensoleillé', 'soleil'), true);
  assert.equal(tooClose('éléphant', 'elephant'), true);
  assert.equal(tooClose('chat', 'chaton'), true);
  assert.equal(tooClose('pin', 'pince'), false, 'sous 4 lettres : pas de test de contenu');
  assert.equal(tooClose('ciel', 'mer'), false);
});

test('indice : un mot déjà retourné peut être utilisé', () => {
  let s = started(4);
  s = act(s, 1, CLUE);
  const c = idx(s, 'red')[0];
  s = act(s, 3, { type: 'pick', card: c });
  s = act(s, 3, { type: 'pick', card: -1 }); // s'arrêter
  assert.equal(s.active, 'blue');
  const used = s.words[c];
  s = act(s, 2, { type: 'clue', word: used, number: 1 });
  assert.equal(s.clue.word, used);
  assert.throws(() => act(started(4), 1, { type: 'clue', word: used, number: 1 }), /trop proche/, 'mais pas tant qu’il est en jeu');
});

test('indice 0 : autant d’essais que l’on veut', () => {
  const s = act(started(), 1, { type: 'clue', word: 'zzzz', number: 0 });
  assert.equal(s.max, null);
});

test('chercher : agents de l’équipe qui joue seulement', () => {
  const s = act(started(), 1, CLUE);
  assert.throws(() => act(s, 1, { type: 'pick', card: 0 }), /chef/);
  assert.throws(() => act(s, 4, { type: 'pick', card: 0 }), /équipe rouge de chercher/);
  assert.throws(() => act(s, 3, { type: 'pick', card: 30 }), /Carte inconnue/);
  assert.throws(() => act(s, 3, { type: 'pick', card: 'x' }), /Carte inconnue/);
  assert.throws(() => act(s, 3, { type: 'clue', word: 'abc', number: 1 }), /Désigne une carte/);
  assert.throws(() => act(s, 3, { type: 'pick', card: -1 }), /au moins une carte/);
});

test('majorité stricte des agents : deux agents doivent être d’accord', () => {
  let s = act(started(), 1, CLUE); // agents rouges : 3 et 5
  const [a, b] = idx(s, 'red');
  s = act(s, 3, { type: 'pick', card: a });
  assert.equal(s.revealed[a], false);
  assert.deepEqual(view(s, 4).picks, { 3: a }, 'les désignations sont publiques');
  s = act(s, 5, { type: 'pick', card: b });
  assert.equal(s.revealed[a] || s.revealed[b], false);
  s = act(s, 5, { type: 'pick', card: a });
  assert.equal(s.revealed[a], true);
  assert.deepEqual(s.picks, {}, 'les désignations sont remises à zéro');
});

test('on peut retirer ou changer sa désignation', () => {
  let s = act(started(), 1, CLUE);
  const [a, b] = idx(s, 'red');
  s = act(s, 3, { type: 'pick', card: a });
  s = act(s, 3, { type: 'pick', card: null });
  assert.deepEqual(s.picks, {});
  s = act(s, 3, { type: 'pick', card: a });
  s = act(s, 3, { type: 'pick', card: b });
  assert.deepEqual(s.picks, { 3: b });
});

test('trois agents : deux suffisent', () => {
  let s = act(started(8), 1, CLUE); // rouge : chef 1, agents 3, 5, 7
  const a = idx(s, 'red')[0];
  s = act(s, 3, { type: 'pick', card: a });
  assert.equal(s.revealed[a], false);
  s = act(s, 7, { type: 'pick', card: a });
  assert.equal(s.revealed[a], true);
});

test('un seul agent : son choix compte tout de suite', () => {
  const s = act(act(started(4), 1, CLUE), 3, { type: 'pick', card: idx(started(4), 'red')[0] });
  assert.equal(s.guesses, 1);
});

test('une carte déjà retournée ne se choisit plus', () => {
  let s = act(act(started(4), 1, CLUE), 3, { type: 'pick', card: idx(started(4), 'red')[0] });
  assert.throws(() => act(s, 3, { type: 'pick', card: idx(s, 'red')[0] }), /déjà retournée/);
});

test('un contact de son équipe : on continue, jusqu’à nombre + 1 essais', () => {
  let s = act(started(4), 1, { type: 'clue', word: 'zzzz', number: 1 }); // 2 essais
  const [a, b, c] = idx(s, 'red');
  s = act(s, 3, { type: 'pick', card: a });
  assert.equal(s.active, 'red');
  assert.equal(s.guesses, 1);
  s = act(s, 3, { type: 'pick', card: b });
  assert.equal(s.active, 'blue', 'deuxième essai atteint : la main passe');
  assert.equal(s.phase, 'clue');
  assert.equal(s.log[0].ended, 'max');
  assert.deepEqual(s.log[0].guesses.map((g) => g.card), [a, b]);
  assert.equal(s.revealed[c], false);
});

test('un passant neutre termine le tour', () => {
  let s = act(started(4), 1, CLUE);
  s = act(s, 3, { type: 'pick', card: idx(s, 'neutral')[0] });
  assert.equal(s.active, 'blue');
  assert.equal(s.log[0].ended, 'neutral');
  assert.equal(s.phase, 'clue');
});

test('un contact adverse est retourné pour l’autre équipe et termine le tour', () => {
  let s = act(started(4), 1, CLUE);
  const c = idx(s, 'blue')[0];
  s = act(s, 3, { type: 'pick', card: c });
  assert.equal(s.revealed[c], true);
  assert.equal(view(s, null).left.blue, 7);
  assert.equal(s.active, 'blue');
  assert.equal(s.log[0].ended, 'enemy');
});

test('l’assassin fait perdre l’équipe tout de suite', () => {
  let s = act(started(4), 1, CLUE);
  s = act(s, 3, { type: 'pick', card: idx(s, 'assassin')[0] });
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.winner, { team: 'blue', reason: 'assassin' });
  assert.deepEqual(status(s), { turn: null, over: true, winners: [2, 4], deadline: null });
  assert.throws(() => act(s, 3, { type: 'pick', card: 0 }), /terminée/);
});

test('tous les contacts retrouvés : l’équipe gagne', () => {
  let s = started(4);
  const reds = idx(s, 'red');
  s = act(s, 1, { type: 'clue', word: 'zzzz', number: 9 }); // 10 essais
  for (const c of reds) s = act(s, 3, { type: 'pick', card: c });
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.winner, { team: 'red', reason: 'cards' });
  assert.deepEqual(status(s).winners, [1, 3]);
});

test('retourner le dernier contact adverse fait gagner l’autre équipe', () => {
  let s = started(4);
  s.revealed = s.key.map((k) => k === 'blue' && k !== undefined); // tout le bleu est déjà retourné…
  const last = idx(s, 'blue')[0];
  s.revealed[last] = false; // … sauf un
  s = act(s, 1, CLUE);
  s = act(s, 3, { type: 'pick', card: last });
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.winner, { team: 'blue', reason: 'cards' });
});

test('s’arrêter volontairement : après au moins un essai, à la majorité', () => {
  let s = act(started(), 1, { type: 'clue', word: 'zzzz', number: 3 });
  const [a] = idx(s, 'red');
  s = act(s, 3, { type: 'pick', card: a });
  s = act(s, 5, { type: 'pick', card: a });
  assert.equal(s.guesses, 1);
  s = act(s, 3, { type: 'pick', card: -1 });
  assert.equal(s.active, 'red', 'un seul agent sur deux ne suffit pas');
  s = act(s, 5, { type: 'pick', card: -1 });
  assert.equal(s.active, 'blue');
  assert.equal(s.log[0].ended, 'stop');
});

test('minuteurs : seulement si l’option est choisie', () => {
  const sans = started(4);
  assert.equal(status(sans).deadline, null);
  const avec = started(4, { clue: 60, guess: 90 });
  assert.equal(status(avec).deadline, 1_000_000 + 60_000);
  const g = act(avec, 1, CLUE, ctx(() => 0, 2_000_000));
  assert.equal(status(g).deadline, 2_000_000 + 90_000);
  assert.equal(view(g, 3).span, 90_000);
});

test('indice trop long : on passe la main à l’autre équipe', () => {
  let s = started(4, { clue: 60 });
  s = timeout(s, ctx(() => 0, 5_000_000)).state;
  assert.equal(s.active, 'blue');
  assert.equal(s.phase, 'clue');
  assert.equal(s.log[0].ended, 'skipped');
  assert.equal(status(s).deadline, 5_000_000 + 60_000);
});

test('recherche trop longue : fin du tour, les cartes retournées restent', () => {
  let s = act(started(4, { guess: 90 }), 1, { type: 'clue', word: 'zzzz', number: 3 });
  s = act(s, 3, { type: 'pick', card: idx(s, 'red')[0] });
  s = timeout(s, ctx()).state;
  assert.equal(s.active, 'blue');
  assert.equal(s.log[0].ended, 'timeout');
  assert.equal(s.revealed.filter(Boolean).length, 1);
});

test('départ dans le salon : on sort de l’équipe et de la place de chef', () => {
  const s = leave(lobby(), 1, ctx()).state;
  assert.equal(s.lead.red, null);
  assert.deepEqual(s.gone, [1]);
  assert.equal(view(s, 1).me, null);
  assert.deepEqual(status(s).turn, [2, 3, 4, 5, 6]);
  assert.throws(() => act(s, 1, { type: 'team', team: 'blue' }), /quitté/);
});

test('départ d’un agent : la partie continue, sa désignation disparaît', () => {
  let s = act(started(), 1, CLUE);
  const [a, b] = idx(s, 'red');
  s = act(s, 3, { type: 'pick', card: b });
  s = leave(s, 3, ctx()).state;
  assert.deepEqual(s.picks, {});
  assert.deepEqual(status(s).turn, [5]);
  assert.equal(s.phase, 'guess');
});

test('départ d’un agent après que l’autre a désigné : la majorité est recalculée', () => {
  let s = act(started(), 1, CLUE);
  const [a] = idx(s, 'red');
  s = act(s, 5, { type: 'pick', card: a });
  assert.equal(s.revealed[a], false);
  s = leave(s, 3, ctx()).state; // reste un seul agent, qui avait désigné
  assert.equal(s.revealed[a], true);
});

test('départ du chef : un agent le remplace et peut donner l’indice', () => {
  let s = started();
  s = leave(s, 1, ctx()).state;
  assert.equal(s.lead.red, 3);
  assert.equal(s.phase, 'clue');
  assert.deepEqual(status(s).turn, 3);
  assert.deepEqual(view(s, 3).key, s.key, 'le nouveau chef voit la clé');
  assert.equal(view(s, 5).key, undefined);
  s = act(s, 3, CLUE);
  assert.equal(s.phase, 'guess');
});

test('une équipe réduite à moins de deux personnes déclare forfait', () => {
  let s = started(4);
  s = leave(s, 3, ctx()).state;
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.winner, { team: 'blue', reason: 'forfeit' });
  assert.deepEqual(status(s).winners, [2, 4]);
});

test('le chef qui part avec un seul agent restant : forfait', () => {
  const s = leave(started(4), 1, ctx()).state;
  assert.deepEqual(s.winner, { team: 'blue', reason: 'forfeit' });
});

test('l’état d’origine n’est jamais modifié et tient en JSON', () => {
  const s = started();
  const copy = JSON.stringify(s);
  act(s, 1, CLUE);
  timeout(s, ctx());
  leave(s, 3, ctx());
  assert.equal(JSON.stringify(s), copy);
  JSON.parse(JSON.stringify(act(s, 1, CLUE)));
});

test('coups illégaux : joueur parti, action vide', () => {
  const s = started();
  assert.throws(() => act(s, 1, null), /indice/);
  assert.throws(() => act(s, 1, {}), /indice/);
});

test('une partie complète à 6 joueurs, tour par tour', () => {
  let s = started(6);
  const log = [];
  for (let guard = 0; guard < 40 && s.phase !== 'over'; guard++) {
    const team = s.active;
    const chef = s.lead[team];
    s = act(s, chef, { type: 'clue', word: `indice${'abcdefghijklmnopqrstuvwxyz'[guard % 26]}`.replace(/\d/g, ''), number: 1 });
    const mates = Object.keys(s.team).map(Number).filter((id) => s.team[id] === team && id !== chef);
    const target = idx(s, team).find((i) => !s.revealed[i]);
    for (const m of mates) s = act(s, m, { type: 'pick', card: target });
    log.push(team);
    if (s.phase === 'guess') for (const m of mates) s = act(s, m, { type: 'pick', card: -1 });
  }
  assert.equal(s.phase, 'over');
  assert.equal(s.winner.reason, 'cards');
  assert.ok(log.length >= 9);
});
