// Tests des règles des Loups-garous : node --test games/loup-garou/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, timeout, leave, view, status, composition, autoWolves } from './rules.js';

const ctx = (random = () => 0, now = 1_000_000) => ({ now, random });

// Une partie dont les rôles sont fixés : liste dans l'ordre des places (id 1, 2, 3…).
function game(roleList, options = {}) {
  const players = roleList.map((_, i) => ({ id: i + 1, pseudo: `p${i + 1}` }));
  const s = setup(players, options, ctx());
  const roles = {};
  roleList.forEach((r, i) => { roles[i + 1] = r; });
  return { ...s, roles };
}
const act = (s, id, action, c = ctx()) => move(s, id, action, c).state;
const deadIds = (s) => s.dead.map((d) => d.id);

// Villageois × 3, 1 loup, 1 voyante, 1 sorcière, 1 chasseur, 1 cupidon
const FULL = ['wolf', 'villager', 'villager', 'seer', 'witch', 'hunter', 'cupid', 'villager']; // ids 1..8
const NO_ROLE = { seer: false, witch: false, hunter: false, cupid: false };

// Passe la nuit : cupidon/voyante absents → seuls les loups votent.
const wolvesKill = (s, wolves, victim) => wolves.reduce((acc, w) => act(acc, w, { type: 'wolf', target: victim }), s);

test('répartition conseillée selon le nombre de joueurs', () => {
  assert.equal(autoWolves(5), 1);
  assert.equal(autoWolves(7), 2);
  assert.equal(autoWolves(11), 3);
  assert.equal(autoWolves(18), 4);
  assert.deepEqual(composition(5, {}), { wolf: 1, seer: 1, witch: 1, hunter: 1, villager: 1 }); // Cupidon écarté : il faut un villageois
  assert.deepEqual(composition(8, {}), { wolf: 2, seer: 1, witch: 1, hunter: 1, cupid: 1, villager: 2 });
  assert.deepEqual(composition(8, { wolves: 3, cupid: false, hunter: false }), { wolf: 3, seer: 1, witch: 1, villager: 3 });
  assert.equal(composition(5, { wolves: 5 }).wolf, 2, 'jamais la majorité de loups au départ');
});

test('setup distribue les rôles de la composition, avec le hasard du contexte', () => {
  const players = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, pseudo: `p${i + 1}` }));
  const a = setup(players, {}, ctx(() => 0.1));
  const b = setup(players, {}, ctx(() => 0.1));
  assert.deepEqual(a.roles, b.roles);
  const counts = {};
  for (const r of Object.values(a.roles)) counts[r] = (counts[r] || 0) + 1;
  assert.deepEqual(counts, composition(9, {}));
  assert.equal(a.phase, 'night');
  assert.equal(a.deadline, 1_000_000 + 45_000);
});

test('durées réglables', () => {
  const players = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, pseudo: 'x' }));
  const s = setup(players, { night: 30, debate: 60, vote: 90 }, ctx());
  assert.deepEqual(s.times, { night: 30_000, debate: 60_000, vote: 90_000 });
});

test('view ne révèle jamais un rôle vivant à qui ne doit pas le connaître', () => {
  const s = game(['wolf', 'wolf', 'villager', 'seer', 'witch', 'hunter', 'cupid', 'villager', 'villager']);
  const v3 = view(s, 3); // simple villageois
  assert.deepEqual(v3.roles, { 3: 'villager' });
  assert.equal(v3.wolfVotes, undefined);
  assert.equal(v3.seen, undefined);
  assert.equal(v3.witch, undefined);
  const vw = view(s, 1); // loup : voit son équipe
  assert.deepEqual(vw.roles, { 1: 'wolf', 2: 'wolf' });
  assert.deepEqual(vw.wolves, [1, 2]);
  const vs = view(s, null); // spectateur
  assert.deepEqual(vs.roles, {});
  assert.equal(vs.me, null);
  assert.equal(vs.lovers, null);
  assert.equal(JSON.stringify(vs).includes('"seer"'), true, 'seul le nombre de rôles en jeu est public (comp)');
  assert.deepEqual(Object.keys(vs.roles), []);
  assert.equal(view(s, 4).roles[1], undefined);
  assert.equal(view(s, 5).witch.victim, null);
});

test('de nuit, tous les vivants sont « à jouer » : status ne dévoile pas les rôles', () => {
  const s = game(FULL);
  assert.equal(status(s).turn, null); // public : personne n'a la main la nuit
  assert.deepEqual(status(s).may, [1, 2, 3, 4, 5, 6, 7, 8]); // reste sur le serveur
  assert.equal(status(s).over, false);
  assert.equal(status(s).deadline, s.deadline);
});

test('la Voyante voit un rôle, une seule fois, pas le sien', () => {
  let s = game(FULL);
  assert.throws(() => act(s, 4, { type: 'peek', target: 4 }), /quelqu’un d’autre/);
  assert.throws(() => act(s, 2, { type: 'peek', target: 1 }), /Tu ne peux pas/);
  s = act(s, 4, { type: 'peek', target: 1 });
  assert.deepEqual(view(s, 4).seen, [{ n: 1, target: 1, role: 'wolf' }]);
  assert.throws(() => act(s, 4, { type: 'peek', target: 2 }), /Tu ne peux pas/);
  assert.equal(view(s, 4).me.acted, true);
  assert.equal(view(s, 2).seen, undefined);
});

test('les loups ne dévorent pas un loup ni un mort, et se voient entre eux', () => {
  let s = game(['wolf', 'wolf', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  assert.throws(() => act(s, 1, { type: 'wolf', target: 2 }), /autre loup/);
  assert.throws(() => act(s, 3, { type: 'wolf', target: 4 }), /Tu ne peux pas/);
  s = act(s, 1, { type: 'wolf', target: 3 });
  assert.deepEqual(view(s, 2).wolfVotes, { 1: 3 });
  assert.equal(view(s, 3).wolfVotes, undefined);
  assert.equal(s.phase, 'night', 'le second loup n’a pas encore voté');
});

test('loups unanimes : la nuit se termine tout de suite, la victime meurt à l’aube', () => {
  let s = game(['wolf', 'wolf', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  s = wolvesKill(s, [1, 2], 3);
  assert.equal(s.phase, 'debate');
  assert.deepEqual(deadIds(s), [3]);
  assert.deepEqual(s.log[0], { k: 'dawn', n: 1, dead: [3] });
  assert.deepEqual(view(s, null).dead, [{ id: 3, role: 'villager', cause: 'night', n: 1 }]);
  assert.deepEqual(view(s, null).roles, { 3: 'villager' }, 'rôle du mort révélé à tous');
});

test('loups divisés : on attend, ils peuvent changer d’avis, puis la majorité à l’échéance', () => {
  let s = game(['wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  s = act(s, 1, { type: 'wolf', target: 4 });
  s = act(s, 2, { type: 'wolf', target: 5 });
  s = act(s, 3, { type: 'wolf', target: 5 });
  assert.equal(s.phase, 'night');
  s = act(s, 1, { type: 'wolf', target: 5 }); // 1 change d'avis : unanimité
  assert.equal(s.phase, 'debate');
  assert.deepEqual(deadIds(s), [5]);
  let t = game(['wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  t = act(t, 1, { type: 'wolf', target: 4 });
  t = act(t, 2, { type: 'wolf', target: 5 });
  t = act(t, 3, { type: 'wolf', target: 5 });
  t = timeout(t, ctx()).state;
  assert.deepEqual(deadIds(t), [5], 'la majorité l’emporte à l’échéance');
});

test('égalité entre loups à l’échéance : tirage au sort via ctx.random parmi les ex æquo', () => {
  const base = game(['wolf', 'wolf', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  let s = act(act(base, 1, { type: 'wolf', target: 3 }), 2, { type: 'wolf', target: 4 });
  assert.deepEqual(deadIds(timeout(s, ctx(() => 0)).state), [3]);
  s = act(act(base, 1, { type: 'wolf', target: 3 }), 2, { type: 'wolf', target: 4 });
  assert.deepEqual(deadIds(timeout(s, ctx(() => 0.99)).state), [4]);
});

test('échéance de la nuit sans aucun vote : pas de victime', () => {
  const s = timeout(game(['wolf', 'villager', 'villager', 'villager', 'villager'], NO_ROLE), ctx()).state;
  assert.equal(s.phase, 'debate');
  assert.deepEqual(s.dead, []);
  assert.deepEqual(s.log[0], { k: 'dawn', n: 1, dead: [] });
});

test('la nuit attend aussi la Voyante et Cupidon', () => {
  let s = game(['wolf', 'villager', 'seer', 'cupid', 'villager', 'villager'], { witch: false, hunter: false });
  s = act(s, 1, { type: 'wolf', target: 5 });
  assert.equal(s.phase, 'night');
  s = act(s, 3, { type: 'peek', target: 1 });
  assert.equal(s.phase, 'night');
  s = act(s, 4, { type: 'love', targets: [2, 6] });
  assert.equal(s.phase, 'debate');
});

test('Cupidon : deux personnes différentes, une seule fois, seulement la 1re nuit', () => {
  const s = game(['wolf', 'villager', 'cupid', 'villager', 'villager', 'villager'], NO_ROLE);
  assert.throws(() => act(s, 3, { type: 'love', targets: [2] }), /deux personnes/);
  assert.throws(() => act(s, 3, { type: 'love', targets: [2, 2] }), /deux personnes/);
  const t = act(s, 3, { type: 'love', targets: [2, 4] });
  assert.throws(() => act(t, 3, { type: 'love', targets: [2, 5] }), /Tu ne peux pas/);
  assert.deepEqual(view(t, 2).lovers, [2, 4]);
  assert.deepEqual(view(t, 4).lovers, [2, 4]);
  assert.deepEqual(view(t, 3).lovers, [2, 4], 'Cupidon connaît le couple qu’il a formé');
  assert.equal(view(t, 5).lovers, null);
  assert.equal(view(t, 2).roles[4], undefined, 'un amoureux ne connaît pas le rôle de l’autre');
});

test('un amoureux mort entraîne l’autre', () => {
  let s = game(['wolf', 'villager', 'cupid', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  s = act(s, 3, { type: 'love', targets: [2, 4] });
  s = wolvesKill(s, [1], 2);
  assert.deepEqual(deadIds(s).sort(), [2, 4]);
  assert.equal(s.dead.find((d) => d.id === 4).cause, 'love');
  assert.deepEqual(s.log[0].dead, [2, 4]);
  assert.equal(view(s, null).dead.find((d) => d.id === 4).cause, 'love');
});

test('Sorcière : voit la victime, peut la sauver (une seule fois)', () => {
  let s = game(['wolf', 'villager', 'witch', 'villager', 'villager', 'villager'], { seer: false, hunter: false, cupid: false });
  s = wolvesKill(s, [1], 2);
  assert.equal(s.phase, 'witch');
  assert.equal(view(s, 3).witch.victim, 2);
  assert.equal(view(s, 4).witch, undefined);
  assert.equal(view(s, null).witch, undefined);
  assert.throws(() => act(s, 4, { type: 'save' }), /Sorcière/);
  s = act(s, 3, { type: 'save' });
  s = act(s, 3, { type: 'pass' });
  assert.deepEqual(s.dead, []);
  assert.equal(s.phase, 'debate');
  assert.equal(view(s, 3).witch.life, false);
  assert.equal(view(s, 3).witch.victim, null, 'la victime n’est plus montrée après la phase');
});

test('Sorcière : la potion de vie ne sert qu’une fois dans la partie', () => {
  let s = game(['wolf', 'villager', 'witch', 'villager', 'villager', 'villager', 'villager'], { seer: false, hunter: false, cupid: false });
  s = act(wolvesKill(s, [1], 2), 3, { type: 'save' }); // nuit 1 : sauve (la phase se termine d'elle-même si la mort reste)
  s = act(s, 3, { type: 'poison', target: 4 }); // même nuit : encore la potion de mort
  assert.deepEqual(deadIds(s), [4]);
  // jour 1 : tout le monde passe, personne n'est éliminé
  for (const id of [1, 2, 3, 5, 6, 7]) s = act(s, id, { type: 'ready' });
  for (const id of [1, 2, 3, 5, 6, 7]) s = act(s, id, { type: 'vote', target: null });
  assert.equal(s.phase, 'night');
  assert.equal(s.n, 2);
  s = wolvesKill(s, [1], 5);
  assert.equal(s.phase, 'witch');
  assert.throws(() => act(s, 3, { type: 'save' }), /déjà utilisé ta potion de vie/);
  assert.throws(() => act(s, 3, { type: 'poison', target: 6 }), /déjà utilisé ta potion de mort/);
});

test('Sorcière : poison, pas sur elle-même, et la phase se termine quand elle n’a plus rien à faire', () => {
  let s = game(['wolf', 'villager', 'witch', 'villager', 'villager', 'villager', 'villager'], { seer: false, hunter: false, cupid: false });
  s = wolvesKill(s, [1], 2);
  assert.throws(() => act(s, 3, { type: 'poison', target: 3 }), /toi-même/);
  assert.throws(() => act(s, 3, { type: 'poison', target: 99 }), /encore en vie/);
  s = act(s, 3, { type: 'poison', target: 4 });
  assert.equal(s.phase, 'witch', 'elle peut encore sauver');
  s = act(s, 3, { type: 'save' });
  assert.equal(s.phase, 'debate', 'plus de potion : la nuit est finie');
  assert.deepEqual(deadIds(s), [4]);
});

test('Sorcière : sans victime elle ne peut pas sauver ; l’échéance ne fait rien', () => {
  let s = game(['wolf', 'villager', 'witch', 'villager', 'villager', 'villager'], { seer: false, hunter: false, cupid: false });
  s = timeout(s, ctx()).state; // les loups n'ont pas voté
  assert.equal(s.phase, 'witch');
  assert.throws(() => act(s, 3, { type: 'save' }), /Personne n’est menacé/);
  s = timeout(s, ctx()).state;
  assert.equal(s.phase, 'debate');
  assert.deepEqual(s.dead, []);
});

test('sans potion, la phase de la Sorcière est courte (elle ne révèle pas qu’elle est vide)', () => {
  let s = game(['wolf', 'villager', 'witch', 'villager', 'villager', 'villager'], { seer: false, hunter: false, cupid: false });
  s.potions = { life: false, death: false };
  s = wolvesKill(s, [1], 2);
  assert.equal(s.phase, 'witch');
  assert.equal(s.deadline, 1_000_000 + 6000);
  assert.equal(status(s).may.includes(3), true);
  s = act(s, 3, { type: 'pass' });
  assert.deepEqual(deadIds(s), [2]);
});

test('Sorcière morte : la phase est sautée', () => {
  let s = game(['wolf', 'villager', 'witch', 'villager', 'villager', 'villager', 'villager'], { seer: false, hunter: false, cupid: false });
  s.dead = [{ id: 3, role: 'witch', cause: 'vote', n: 0 }];
  s = wolvesKill(s, [1], 2);
  assert.equal(s.phase, 'debate');
  assert.deepEqual(deadIds(s), [3, 2]);
});

test('Chasseur tué la nuit : il tire à l’aube, puis le débat commence', () => {
  let s = game(['wolf', 'hunter', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  s = wolvesKill(s, [1], 2);
  assert.equal(s.phase, 'hunter');
  assert.deepEqual(status(s).turn, 2, 'le chasseur est connu de tous : il est mort et révélé');
  assert.throws(() => act(s, 3, { type: 'shoot', target: 1 }), /Chasseur est en train/);
  s = act(s, 2, { type: 'shoot', target: 3 });
  assert.equal(s.phase, 'debate');
  assert.deepEqual(deadIds(s), [2, 3]);
  assert.deepEqual(s.log[1], { k: 'shot', n: 1, hunter: 2, target: 3, dead: [3] });
});

test('Chasseur éliminé par le vote : il tire, puis nuit suivante', () => {
  let s = game(['wolf', 'hunter', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  s = timeout(s, ctx()).state; // nuit sans victime
  for (const id of [1, 2, 3, 4, 5, 6]) s = act(s, id, { type: 'ready' });
  assert.equal(s.phase, 'vote');
  for (const id of [1, 3, 4, 5, 6]) s = act(s, id, { type: 'vote', target: 2 });
  s = act(s, 2, { type: 'vote', target: 3 });
  assert.equal(s.phase, 'hunter');
  assert.equal(s.after, 'night');
  s = act(s, 2, { type: 'shoot', target: 1 }); // le loup
  assert.equal(s.phase, 'over');
  assert.equal(s.winner.side, 'village');
});

test('le Chasseur qui ne tire pas à l’échéance : pas de tir', () => {
  let s = game(['wolf', 'hunter', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  s = wolvesKill(s, [1], 2);
  s = timeout(s, ctx()).state;
  assert.equal(s.phase, 'debate');
  assert.deepEqual(deadIds(s), [2]);
});

test('le tir du Chasseur sur un amoureux entraîne l’autre', () => {
  let s = game(['wolf', 'wolf', 'hunter', 'cupid', 'villager', 'villager', 'villager', 'villager', 'villager'], { seer: false, witch: false });
  s = act(s, 4, { type: 'love', targets: [5, 6] });
  s = wolvesKill(s, [1, 2], 3);
  s = act(s, 3, { type: 'shoot', target: 5 });
  assert.deepEqual(deadIds(s).sort((a, b) => a - b), [3, 5, 6]);
});

test('Chasseur tué par un amoureux : le tir est toujours possible', () => {
  let s = game(['wolf', 'wolf', 'hunter', 'cupid', 'villager', 'villager', 'villager', 'villager', 'villager'], { seer: false, witch: false });
  s = act(s, 4, { type: 'love', targets: [3, 5] });
  s = wolvesKill(s, [1, 2], 5); // 5 meurt, le chasseur 3 suit
  assert.equal(s.phase, 'hunter');
  assert.equal(s.hunters[0], 3);
});

test('débat : tout le monde prêt = vote tout de suite ; sinon à l’échéance', () => {
  let s = timeout(game(['wolf', 'villager', 'villager', 'villager', 'villager'], NO_ROLE), ctx()).state;
  assert.equal(s.phase, 'debate');
  assert.equal(s.deadline, 1_000_000 + 120_000);
  assert.throws(() => act(s, 2, { type: 'vote', target: 1 }), /débat/);
  for (const id of [1, 2, 3, 4]) s = act(s, id, { type: 'ready' });
  assert.equal(s.phase, 'debate');
  assert.equal(view(s, 2).ready, 4);
  s = act(s, 5, { type: 'ready' });
  assert.equal(s.phase, 'vote');
  let t = timeout(game(['wolf', 'villager', 'villager', 'villager', 'villager'], NO_ROLE), ctx()).state;
  t = timeout(t, ctx(() => 0, 2_000_000)).state;
  assert.equal(t.phase, 'vote');
  assert.equal(t.deadline, 2_000_000 + 45_000);
});

function toVote(roleList, options = NO_ROLE) {
  let s = timeout(game(roleList, options), ctx()).state;
  s = timeout(s, ctx()).state;
  assert.equal(s.phase, 'vote');
  return s;
}

test('vote du village : la majorité relative élimine, rôle révélé', () => {
  let s = toVote(['wolf', 'villager', 'villager', 'villager', 'villager', 'villager']);
  assert.throws(() => act(s, 2, { type: 'vote', target: 2 }), /contre toi-même/);
  s = act(s, 2, { type: 'vote', target: 1 });
  s = act(s, 3, { type: 'vote', target: 1 });
  s = act(s, 4, { type: 'vote', target: 5 });
  assert.equal(view(s, 2).me.vote, 1);
  assert.equal(view(s, 2).voted, 3);
  s = act(s, 5, { type: 'vote', target: 1 });
  s = act(s, 6, { type: 'vote', target: null });
  s = act(s, 1, { type: 'vote', target: 2 });
  assert.equal(s.phase, 'over'); // le loup éliminé : le village gagne
  assert.deepEqual(s.dead[0], { id: 1, role: 'wolf', cause: 'vote', n: 1 });
  assert.deepEqual(status(s).winners, [2, 3, 4, 5, 6]);
});

test('vote : une égalité n’élimine personne et la nuit suivante commence', () => {
  let s = toVote(['wolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager']);
  s = act(s, 2, { type: 'vote', target: 3 });
  s = act(s, 3, { type: 'vote', target: 2 });
  for (const id of [1, 4, 5, 6, 7]) s = act(s, id, { type: 'vote', target: null });
  assert.equal(s.phase, 'night');
  assert.equal(s.n, 2);
  assert.deepEqual(s.dead, []);
  assert.equal(s.log.at(-1).out, null);
});

test('vote à l’échéance : on compte les votes déjà exprimés, sans vote personne ne meurt', () => {
  let s = toVote(['wolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager']);
  s = act(s, 2, { type: 'vote', target: 3 });
  const t = timeout(s, ctx()).state;
  assert.deepEqual(deadIds(t), [3]);
  const u = timeout(toVote(['wolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager']), ctx()).state;
  assert.deepEqual(u.dead, []);
  assert.equal(u.phase, 'night');
});

test('les votes sont secrets jusqu’au dépouillement', () => {
  let s = toVote(['wolf', 'villager', 'villager', 'villager', 'villager']);
  s = act(s, 2, { type: 'vote', target: 3 });
  const v = JSON.stringify(view(s, 4));
  assert.equal(v.includes('"votes"'), false);
  assert.equal(view(s, 4).me.vote, undefined);
  assert.equal(view(s, 2).me.vote, 3);
});

test('victoire des loups : au moins aussi nombreux que les autres', () => {
  let s = game(['wolf', 'villager', 'villager'], NO_ROLE);
  // 1 loup contre 2 villageois : une victime et c'est fini
  s = wolvesKill(s, [1], 2);
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.winner, { side: 'wolves', ids: [1] });
  assert.deepEqual(status(s), { turn: null, over: true, winners: [1], deadline: null });
});

test('victoire du village : plus aucun loup', () => {
  let s = toVote(['wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'villager']);
  for (const id of [2, 3, 4, 5, 6, 7]) s = act(s, id, { type: 'vote', target: 1 });
  s = act(s, 1, { type: 'vote', target: 2 });
  assert.equal(s.phase, 'night');
  assert.deepEqual(deadIds(s), [1]);
});

test('amoureux loup + villageois : ils gagnent seuls à deux', () => {
  let s = game(['wolf', 'villager', 'cupid', 'villager'], NO_ROLE);
  s = act(s, 3, { type: 'love', targets: [1, 2] });
  s = wolvesKill(s, [1], 4); // reste 1, 2, 3
  assert.equal(s.phase, 'debate', 'à trois, la partie continue malgré 1 loup contre 2');
  for (const id of [1, 2, 3]) s = act(s, id, { type: 'ready' });
  s = act(s, 1, { type: 'vote', target: 3 });
  s = act(s, 2, { type: 'vote', target: 3 });
  s = act(s, 3, { type: 'vote', target: 1 });
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.winner, { side: 'lovers', ids: [1, 2] });
  assert.deepEqual(status(s).winners, [1, 2]);
});

test('amoureux de même camp : victoire normale de leur camp', () => {
  let s = game(['wolf', 'villager', 'cupid', 'villager', 'villager'], NO_ROLE);
  s = act(s, 3, { type: 'love', targets: [2, 4] });
  s = wolvesKill(s, [1], 2); // 2 et 4 meurent, il reste 1, 3, 5
  assert.deepEqual(deadIds(s), [2, 4]);
  assert.equal(s.phase, 'debate');
});

test('tout le monde meurt : partie nulle', () => {
  let s = game(['wolf', 'villager', 'cupid'], NO_ROLE);
  s = act(s, 3, { type: 'love', targets: [1, 2] });
  s = leave(s, 3, ctx()).state;
  assert.equal(s.phase, 'over');
});

test('fin de partie : tous les rôles sont révélés à tout le monde', () => {
  let s = game(['wolf', 'villager', 'villager'], NO_ROLE);
  s = wolvesKill(s, [1], 2);
  const v = view(s, null);
  assert.deepEqual(v.roles, { 1: 'wolf', 2: 'villager', 3: 'villager' });
  assert.equal(v.winner.side, 'wolves');
});

test('les morts voient tous les rôles, mais pas les spectateurs', () => {
  let s = game(['wolf', 'villager', 'villager', 'seer', 'villager', 'villager', 'villager'], { witch: false, hunter: false, cupid: false });
  s = act(s, 4, { type: 'peek', target: 1 });
  s = wolvesKill(s, [1], 2);
  const dead = view(s, 2);
  assert.equal(dead.god, true);
  assert.equal(dead.roles[1], 'wolf');
  assert.equal(dead.roles[4], 'seer');
  assert.equal(dead.me.alive, false);
  assert.equal(view(s, 3).roles[1], undefined);
  assert.equal(view(s, null).roles[1], undefined);
  assert.deepEqual(view(s, 3).dead.map((d) => d.id), [2]);
});

test('coups refusés : mort, mauvaise phase, partie finie', () => {
  let s = game(['wolf', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  assert.throws(() => act(s, 2, { type: 'vote', target: 3 }), /Tu ne peux pas/);
  assert.throws(() => act(s, 2, {}), /Tu ne peux pas/);
  assert.throws(() => act(s, 2, null), /Tu ne peux pas/);
  s = wolvesKill(s, [1], 2);
  assert.throws(() => act(s, 2, { type: 'ready' }), /Tu es mort/);
  assert.throws(() => act(s, 1, { type: 'wolf', target: 3 }), /débat|Tu ne peux pas/);
  const over = game(['wolf', 'villager', 'villager'], NO_ROLE);
  const fin = wolvesKill(over, [1], 2);
  assert.throws(() => act(fin, 1, { type: 'wolf', target: 3 }), /terminée/);
});

test('l’état d’origine n’est jamais modifié', () => {
  const s = game(['wolf', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  const copy = JSON.stringify(s);
  move(s, 1, { type: 'wolf', target: 2 }, ctx());
  timeout(s, ctx());
  leave(s, 3, ctx());
  assert.equal(JSON.stringify(s), copy);
  JSON.parse(JSON.stringify(timeout(s, ctx()).state));
});

test('départ d’un villageois en cours de nuit : il est éliminé, rôle révélé', () => {
  let s = game(['wolf', 'villager', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  s = leave(s, 3, ctx()).state;
  assert.deepEqual(s.dead, [{ id: 3, role: 'villager', cause: 'left', n: 1 }]);
  assert.deepEqual(s.left, [3]);
  assert.equal(view(s, 3).me, null, 'il devient spectateur : aucun secret');
  assert.equal(view(s, 3).roles[1], undefined);
  assert.equal(s.phase, 'night');
  assert.deepEqual(status(s).may, [1, 2, 4, 5, 6]);
});

test('départ du dernier loup : le village gagne', () => {
  const s = leave(game(['wolf', 'villager', 'villager', 'villager', 'villager'], NO_ROLE), 1, ctx()).state;
  assert.equal(s.phase, 'over');
  assert.equal(s.winner.side, 'village');
});

test('départ du loup qui devait encore voter : la nuit avance avec les autres', () => {
  let s = game(['wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  s = act(s, 1, { type: 'wolf', target: 3 });
  s = leave(s, 2, ctx()).state;
  assert.equal(s.phase, 'debate');
  assert.deepEqual(deadIds(s), [2, 3]);
});

test('départ de la Voyante ou de Cupidon : la nuit ne reste pas bloquée', () => {
  let s = game(['wolf', 'villager', 'seer', 'cupid', 'villager', 'villager', 'villager'], { witch: false, hunter: false });
  s = act(s, 1, { type: 'wolf', target: 5 });
  s = leave(s, 3, ctx()).state;
  assert.equal(s.phase, 'night');
  s = leave(s, 4, ctx()).state;
  assert.equal(s.phase, 'debate');
});

test('départ de la Sorcière pendant sa phase : l’aube arrive', () => {
  let s = game(['wolf', 'villager', 'witch', 'villager', 'villager', 'villager', 'villager'], { seer: false, hunter: false, cupid: false });
  s = wolvesKill(s, [1], 2);
  s = leave(s, 3, ctx()).state;
  assert.equal(s.phase, 'debate');
  assert.equal(deadIds(s).includes(2), true);
});

test('départ du Chasseur : pas de tir ; départ avant son tir : la file avance', () => {
  let s = game(['wolf', 'hunter', 'villager', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  s = leave(s, 2, ctx()).state;
  assert.equal(s.phase, 'night');
  assert.deepEqual(s.hunters, []);
  let t = game(['wolf', 'hunter', 'villager', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  t = wolvesKill(t, [1], 2);
  assert.equal(t.phase, 'hunter');
  t = leave(t, 2, ctx()).state;
  assert.equal(t.phase, 'debate');
});

test('départ d’un joueur qui n’a pas voté : le vote se termine s’il était le dernier attendu', () => {
  let s = toVote(['wolf', 'villager', 'villager', 'villager', 'villager']);
  for (const id of [1, 2, 3, 4]) s = act(s, id, { type: 'vote', target: id === 1 ? 2 : 1 });
  assert.equal(s.phase, 'vote');
  s = leave(s, 5, ctx()).state;
  assert.equal(s.phase, 'over');
  assert.equal(s.winner.side, 'village');
});

test('départ d’un amoureux : l’autre le suit', () => {
  let s = game(['wolf', 'villager', 'cupid', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  s = act(s, 3, { type: 'love', targets: [2, 4] });
  s = leave(s, 2, ctx()).state;
  assert.deepEqual(deadIds(s).sort(), [2, 4]);
});

test('toutes les phases ont une échéance, y compris après un tour complet', () => {
  let s = game(['wolf', 'villager', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  for (let i = 0; i < 4; i++) {
    assert.ok(Number.isFinite(status(s).deadline), `phase ${s.phase}`);
    s = timeout(s, ctx(() => 0, 5_000_000 + i)).state;
  }
});
