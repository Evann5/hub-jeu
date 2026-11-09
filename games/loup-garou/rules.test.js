// Tests des règles des Loups-garous : node --test games/loup-garou/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, timeout, leave, view, status, composition, autoWolves, FIRST_NIGHT_BONUS_MS, CHAT_MAX_LEN, CHAT_BURST, CHAT_NIGHT_MAX } from './rules.js';

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
  assert.equal(a.deadline, 1_000_000 + 45_000 + FIRST_NIGHT_BONUS_MS); // 1re nuit : +10 s pour lire sa carte
  assert.equal(a.span, 45_000 + FIRST_NIGHT_BONUS_MS);
});

test('seule la 1re nuit est rallongée, et pas selon les rôles en jeu', () => {
  const players = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, pseudo: 'x' }));
  const avecTout = setup(players, {}, ctx());
  const sansRoles = setup(players, { seer: false, witch: false, hunter: false, cupid: false }, ctx());
  assert.equal(avecTout.deadline, sansRoles.deadline);
  assert.equal(status(avecTout).deadline, 1_000_000 + 45_000 + FIRST_NIGHT_BONUS_MS);
  assert.equal(FIRST_NIGHT_BONUS_MS, 10_000);
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
  assert.deepEqual(status(s), { turn: null, over: true, winners: [1], deadline: null, silent: [] });
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

// ——— Nouveaux rôles et options (09/11/2026) ———

const alivePlayers = (s) => s.players.filter((id) => !deadIds(s).includes(id));
const readyAll = (s) => alivePlayers(s).reduce((acc, id) => (acc.phase === 'debate' ? act(acc, id, { type: 'ready' }) : acc), s);
const votes = (s, ballots) => Object.entries(ballots).reduce((acc, [from, to]) => act(acc, Number(from), { type: 'vote', target: to }), s);
const CAP = { ...NO_ROLE, captain: true };

// Le 1er jour avec un Capitaine déjà élu (cap) : nuit sans victime, tout le monde vote pour cap, puis le vote du village.
function captainVote(roleList, cap, options = CAP) {
  let s = timeout(game(roleList, options), ctx()).state;
  assert.equal(s.phase, 'election');
  for (const id of alivePlayers(s)) s = act(s, id, { type: 'elect', target: cap });
  assert.equal(s.captain, cap);
  s = timeout(s, ctx()).state;
  assert.equal(s.phase, 'vote');
  return s;
}

test('Capitaine : élu au 1er jour, avant le débat, à la majorité ; une seule élection', () => {
  let s = game(['wolf', 'villager', 'villager', 'villager', 'villager', 'villager'], CAP);
  s = wolvesKill(s, [1], 6);
  assert.equal(s.phase, 'election');
  assert.deepEqual(status(s).turn, [1, 2, 3, 4, 5]);
  assert.throws(() => act(s, 2, { type: 'ready' }), /Capitaine/);
  assert.throws(() => act(s, 2, { type: 'elect', target: 6 }), /en vie/);
  s = act(s, 1, { type: 'elect', target: 2 });
  assert.equal(view(s, 3).voted, 1);
  assert.equal(view(s, 3).me.vote, undefined, 'les bulletins des autres restent secrets');
  assert.equal(view(s, 1).me.vote, 2);
  assert.equal(JSON.stringify(view(s, null)).includes('"votes"'), false);
  for (const id of [2, 3, 4]) s = act(s, id, { type: 'elect', target: 3 });
  s = act(s, 5, { type: 'elect', target: 5 }); // on peut voter pour soi
  assert.equal(s.phase, 'debate');
  assert.equal(s.captain, 3);
  assert.equal(view(s, null).captain, 3);
  assert.deepEqual(s.log.find((e) => e.k === 'captain'), { k: 'captain', n: 1, id: 3, how: 'vote' });
  s = timeout(timeout(s, ctx()).state, ctx()).state; // débat, vote sans bulletin : nuit 2
  s = wolvesKill(s, [1], 5);
  assert.equal(s.phase, 'debate', 'pas de seconde élection');
});

test('Capitaine : égalité ou aucun vote = tirage au sort', () => {
  const base = timeout(game(['wolf', 'villager', 'villager', 'villager', 'villager'], CAP), ctx()).state;
  const tie = act(act(base, 1, { type: 'elect', target: 2 }), 2, { type: 'elect', target: 3 });
  assert.equal(timeout(tie, ctx(() => 0)).state.captain, 2);
  assert.equal(timeout(tie, ctx(() => 0.99)).state.captain, 3);
  assert.equal(timeout(tie, ctx(() => 0)).state.log.at(-1).how, 'draw');
  assert.equal(timeout(base, ctx(() => 0)).state.captain, 1, 'sans vote : au hasard parmi les vivants');
  assert.equal(timeout(base, ctx(() => 0)).state.phase, 'debate');
});

test('sans l’option Capitaine (ou une partie d’avant) : pas d’élection', () => {
  const s = wolvesKill(game(['wolf', 'villager', 'villager', 'villager', 'villager'], NO_ROLE), [1], 5);
  assert.equal(s.phase, 'debate');
  assert.equal(view(s, null).captain, null);
  const old = structuredClone(game(['wolf', 'villager', 'villager', 'villager', 'villager'], CAP));
  for (const k of ['opts', 'captain', 'elected', 'heirFrom', 'extra', 'wolfChat', 'idiot', 'marked']) delete old[k];
  assert.equal(wolvesKill(old, [1], 5).phase, 'debate', 'un état enregistré avant les nouveaux rôles se joue comme avant');
});

test('Capitaine : sa voix compte double', () => {
  let s = captainVote(['wolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager'], 2);
  s = votes(s, { 2: 1, 3: 4 });
  s = timeout(s, ctx()).state;
  assert.deepEqual(deadIds(s), [1]);
  assert.equal(s.log.findLast((e) => e.k === 'vote').count, 2);
  assert.equal(s.winner.side, 'village');
});

test('Capitaine : il départage une égalité du vote du village', () => {
  let s = captainVote(['wolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager'], 2);
  s = votes(s, { 2: 5, 3: 4, 6: 4 }); // 5 : 2 voix (Capitaine), 4 : 2 voix
  s = timeout(s, ctx()).state;
  assert.deepEqual(deadIds(s), [5]);
  let t = captainVote(['wolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager'], 2);
  t = votes(t, { 2: null, 3: 4, 6: 5 }); // le Capitaine vote blanc : l'égalité n'élimine personne
  t = timeout(t, ctx()).state;
  assert.deepEqual(deadIds(t), []);
});

test('Capitaine mort : il désigne son successeur ; au minuteur, au hasard', () => {
  let s = captainVote(['wolf', 'villager', 'villager', 'villager', 'villager', 'villager'], 2);
  s = votes(s, { 1: 2, 3: 2, 4: 2, 5: 2, 6: 2, 2: 1 });
  assert.deepEqual(deadIds(s), [2]);
  assert.equal(s.phase, 'heir');
  assert.equal(status(s).turn, 2);
  assert.equal(view(s, null).heirFrom, 2);
  assert.equal(view(s, null).captain, null);
  const heirState = s;
  assert.throws(() => act(s, 3, { type: 'heir', target: 4 }), /successeur/);
  assert.throws(() => act(s, 2, { type: 'heir', target: 2 }), /en vie/);
  s = act(s, 2, { type: 'heir', target: 4 });
  assert.equal(s.captain, 4);
  assert.equal(s.phase, 'night');
  assert.deepEqual(s.log.at(-1), { k: 'captain', n: 1, id: 4, how: 'heir', from: 2 });
  const t = timeout(heirState, ctx(() => 0)).state;
  assert.equal(t.captain, 1);
  assert.equal(t.log.at(-1).how, 'random');
  assert.equal(t.phase, 'night');
});

test('Capitaine Chasseur : il tire d’abord, puis désigne son successeur', () => {
  let s = captainVote(['wolf', 'hunter', 'villager', 'villager', 'villager', 'villager'], 2, { ...CAP, hunter: true });
  s = votes(s, { 1: 2, 3: 2, 4: 2, 5: 2, 6: 2, 2: 1 });
  assert.equal(s.phase, 'hunter');
  s = act(s, 2, { type: 'shoot', target: 3 });
  assert.equal(s.phase, 'heir');
  s = act(s, 2, { type: 'heir', target: 5 });
  assert.equal(s.captain, 5);
  assert.equal(s.phase, 'night');
});

test('Capitaine qui quitte la partie : successeur tiré au sort, la partie continue', () => {
  let s = captainVote(['wolf', 'villager', 'villager', 'villager', 'villager', 'villager'], 3);
  s = leave(s, 3, ctx(() => 0)).state;
  assert.equal(s.captain, 1);
  assert.equal(s.phase, 'vote');
});

test('discussion des loups : réservée aux loups vivants, la nuit, invisible pour les autres', () => {
  const opts = { ...NO_ROLE, wolfChat: true };
  let s = game(['wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'villager'], opts);
  s = act(s, 1, { type: 'wolfChat', text: '  On mange   le 3 ?  ' });
  assert.deepEqual(view(s, 2).wolfChat, [{ n: 1, from: 1, text: 'On mange le 3 ?', at: 1_000_000 }]);
  assert.equal(view(s, 3).wolfChat, undefined);
  assert.equal(view(s, null).wolfChat, undefined);
  for (const v of [view(s, 3), view(s, null), status(s)]) assert.equal(JSON.stringify(v).includes('On mange'), false);
  assert.throws(() => act(s, 3, { type: 'wolfChat', text: 'coucou' }), /Tu ne peux pas/);
  assert.throws(() => act(s, 1, { type: 'wolfChat', text: '   ' }), /Écris/);
  assert.throws(() => act(s, 1, { type: 'wolfChat', text: 'x'.repeat(CHAT_MAX_LEN + 1) }), /trop long/);
  assert.equal(act(s, 1, { type: 'wolfChat', text: 'x'.repeat(CHAT_MAX_LEN) }).wolfChat.length, 2);
  // Débit : 4 messages par loup en 10 s
  let b = s;
  for (let i = 0; i < CHAT_BURST - 1; i++) b = act(b, 1, { type: 'wolfChat', text: `m${i}` });
  assert.throws(() => act(b, 1, { type: 'wolfChat', text: 'encore' }), /Doucement/);
  b = act(b, 2, { type: 'wolfChat', text: 'moi je peux' });
  b = act(b, 1, { type: 'wolfChat', text: 'plus tard' }, ctx(() => 0, 1_000_000 + 10_001));
  assert.equal(b.wolfChat.length, CHAT_BURST + 2);
  // Plafond par nuit
  let c = s;
  for (let i = 1; i < CHAT_NIGHT_MAX; i++) c = act(c, 1 + (i % 2), { type: 'wolfChat', text: `n${i}` }, ctx(() => 0, 1_000_000 + i * 3000));
  assert.throws(() => act(c, 1, { type: 'wolfChat', text: 'de trop' }, ctx(() => 0, 9_000_000)), /assez parlé/);
  // Le jour, un loup mort, l'option décochée
  const d = wolvesKill(s, [1, 2], 3);
  assert.equal(d.phase, 'debate');
  assert.throws(() => act(d, 1, { type: 'wolfChat', text: 'jour' }), /débat/);
  assert.deepEqual(view(d, 1).wolfChat.map((m) => m.text), ['On mange le 3 ?'], 'la meute garde son fil');
  const off = game(['wolf', 'wolf', 'villager', 'villager', 'villager'], NO_ROLE);
  assert.throws(() => act(off, 1, { type: 'wolfChat', text: 'x' }), /pas activée/);
  const dead = leave(s, 2, ctx()).state;
  assert.throws(() => act(dead, 2, { type: 'wolfChat', text: 'x' }), /Tu es mort/);
});

test('Salvateur : protège la victime des loups (la Sorcière ne voit personne), jamais deux nuits de suite le même', () => {
  const roles = ['wolf', 'guard', 'villager', 'villager', 'villager', 'villager', 'witch'];
  let s = game(roles, { ...NO_ROLE, witch: true, guard: true });
  assert.throws(() => act(s, 3, { type: 'protect', target: 4 }), /Tu ne peux pas/);
  s = act(s, 2, { type: 'protect', target: 3 });
  assert.throws(() => act(s, 2, { type: 'protect', target: 4 }), /Tu ne peux pas/, 'une fois par nuit');
  assert.deepEqual(view(s, 2).guard, { protected: 3, last: null });
  for (const id of [1, 3, 7, null]) assert.equal(view(s, id).guard, undefined, 'la cible protégée reste secrète');
  s = act(s, 1, { type: 'wolf', target: 3 });
  assert.equal(s.phase, 'witch');
  assert.equal(view(s, 7).witch.victim, null, 'la Sorcière voit que personne n’est menacé');
  s = act(s, 7, { type: 'pass' });
  assert.deepEqual(deadIds(s), []);
  assert.deepEqual(s.log[0], { k: 'dawn', n: 1, dead: [] });
  s = timeout(timeout(s, ctx()).state, ctx()).state; // débat, vote : nuit 2
  assert.equal(s.n, 2);
  assert.throws(() => act(s, 2, { type: 'protect', target: 3 }), /nuit dernière/);
  s = act(s, 2, { type: 'protect', target: 2 }); // il peut se protéger
  s = act(s, 1, { type: 'wolf', target: 3 });
  assert.equal(view(s, 7).witch.victim, 3);
});

test('Salvateur : la nuit l’attend ; s’il n’a protégé personne, tout le monde redevient possible', () => {
  let s = game(['wolf', 'guard', 'villager', 'villager', 'villager', 'villager'], { ...NO_ROLE, guard: true });
  s = act(s, 1, { type: 'wolf', target: 3 });
  assert.equal(s.phase, 'night');
  s = timeout(s, ctx()).state; // le Salvateur n'a rien fait
  assert.deepEqual(deadIds(s), [3]);
  s = timeout(timeout(s, ctx()).state, ctx()).state;
  assert.equal(s.n, 2);
  s = act(s, 2, { type: 'protect', target: 4 });
  s = timeout(timeout(act(s, 1, { type: 'wolf', target: 5 }), ctx()).state, ctx()).state;
  assert.equal(s.n, 3);
  assert.throws(() => act(s, 2, { type: 'protect', target: 4 }), /nuit dernière/);
});

test('Ancien : survit à la première attaque des loups, pas à la seconde', () => {
  let s = game(['wolf', 'elder', 'villager', 'villager', 'villager', 'villager'], { ...NO_ROLE, elder: true });
  s = wolvesKill(s, [1], 2);
  assert.deepEqual(deadIds(s), []);
  assert.deepEqual(s.log[0].dead, []);
  assert.equal(view(s, 2).elder.shield, false);
  assert.equal(view(s, 3).elder, undefined);
  s = timeout(timeout(s, ctx()).state, ctx()).state;
  s = wolvesKill(s, [1], 2);
  assert.deepEqual(deadIds(s), [2]);
  assert.equal(s.powersLost, false, 'tué par les loups : les pouvoirs restent');
});

test('Ancien éliminé par le village : les villageois à pouvoir perdent leurs pouvoirs', () => {
  const roles = ['wolf', 'elder', 'seer', 'hunter', 'witch', 'villager', 'villager'];
  let s = game(roles, { seer: true, witch: true, hunter: true, cupid: false, elder: true });
  s = act(s, 3, { type: 'peek', target: 1 });
  s = act(s, 1, { type: 'wolf', target: 6 });
  s = act(s, 5, { type: 'pass' });
  s = timeout(s, ctx()).state;
  assert.equal(s.phase, 'vote');
  s = votes(s, { 1: 2, 3: 2, 4: 2, 5: 2, 7: 2, 2: 1 });
  assert.equal(s.phase, 'night');
  assert.equal(s.powersLost, true);
  assert.deepEqual(s.log.slice(-2).map((e) => e.k), ['vote', 'powers']);
  assert.equal(view(s, null).powersLost, true);
  assert.throws(() => act(s, 3, { type: 'peek', target: 1 }), /perdu leurs pouvoirs/);
  s = act(s, 1, { type: 'wolf', target: 4 }); // ni Voyante attendue, ni Sorcière, ni tir du Chasseur
  assert.equal(s.phase, 'debate');
  assert.deepEqual(deadIds(s), [6, 2, 4]);
});

test('Ancien empoisonné par la Sorcière : pouvoirs perdus aussi ; mort de chagrin : non', () => {
  let s = game(['wolf', 'elder', 'witch', 'villager', 'villager', 'villager'], { ...NO_ROLE, witch: true, elder: true });
  s = act(s, 1, { type: 'wolf', target: 4 });
  s = act(s, 3, { type: 'poison', target: 2 });
  s = act(s, 3, { type: 'pass' });
  assert.equal(s.powersLost, true);
  assert.equal(s.log.at(-1).k, 'powers');
  let t = game(['wolf', 'elder', 'cupid', 'villager', 'villager', 'villager'], { ...NO_ROLE, cupid: true, elder: true });
  t = act(t, 3, { type: 'love', targets: [2, 4] });
  t = timeout(act(t, 1, { type: 'wolf', target: 5 }), ctx()).state;
  t = votes(t, { 1: 4, 2: 4, 3: 4, 4: 1, 6: 4 });
  assert.deepEqual(deadIds(t), [5, 4, 2]);
  assert.equal(t.powersLost, false);
});

test('Idiot du village : éliminé par le vote, révélé, reste en vie et ne vote plus', () => {
  let s = toVote(['wolf', 'idiot', 'villager', 'villager', 'villager', 'villager'], { ...NO_ROLE, idiot: true });
  s = votes(s, { 1: 2, 3: 2, 4: 2, 5: 2, 6: 2, 2: 1 });
  assert.equal(s.phase, 'night');
  assert.deepEqual(deadIds(s), []);
  assert.equal(s.log.at(-1).spared, true);
  assert.equal(view(s, null).roles[2], 'idiot');
  assert.equal(view(s, 3).idiot, 2);
  s = wolvesKill(s, [1], 6);
  s = timeout(s, ctx()).state;
  assert.equal(s.phase, 'vote');
  assert.deepEqual(status(s).turn, [1, 3, 4, 5]);
  assert.equal(view(s, 3).voters, 4);
  assert.throws(() => act(s, 2, { type: 'vote', target: 1 }), /ne votes plus/);
  s = votes(s, { 1: 3, 3: 2, 4: 2, 5: 2 }); // le vote se termine sans lui ; une seconde fois, il meurt
  assert.deepEqual(deadIds(s), [6, 2]);
});

test('Idiot Capitaine révélé : il passe la main ; Idiot sans pouvoirs : il meurt', () => {
  let s = captainVote(['wolf', 'idiot', 'villager', 'villager', 'villager', 'villager'], 2, { ...CAP, idiot: true });
  s = votes(s, { 1: 2, 3: 2, 4: 2, 5: 2, 6: 2, 2: 1 });
  assert.equal(s.phase, 'heir');
  assert.equal(status(s).turn, 2);
  s = act(s, 2, { type: 'heir', target: 3 });
  assert.equal(s.captain, 3);
  let t = toVote(['wolf', 'idiot', 'villager', 'villager', 'villager', 'villager'], { ...NO_ROLE, idiot: true });
  t = { ...t, powersLost: true };
  t = votes(t, { 1: 2, 3: 2, 4: 2, 5: 2, 6: 2, 2: 1 });
  assert.deepEqual(deadIds(t), [2]);
});

test('Petite fille : espionne la discussion sans les noms ; les loups savent que quelqu’un écoute', () => {
  const roles = ['wolf', 'wolf', 'littleGirl', 'villager', 'villager', 'villager', 'villager'];
  const opts = { ...NO_ROLE, littleGirl: true };
  let s = game(roles, opts);
  assert.equal(s.opts.wolfChat, true, 'la Petite fille active la discussion des loups');
  s = act(s, 1, { type: 'wolfChat', text: 'On prend le 4' });
  assert.equal(view(s, 3).wolfChat, undefined, 'sans espionner, elle ne voit rien');
  assert.equal(view(s, 1).listening, false);
  s = act(s, 3, { type: 'spy' }, ctx(() => 0.5));
  assert.deepEqual(view(s, 3).wolfChat, [{ n: 1, text: 'On prend le 4', at: 1_000_000 }]);
  assert.equal(JSON.stringify(view(s, 3)).includes('"from"'), false, 'aucun nom de loup');
  assert.equal(view(s, 3).roles[1], undefined);
  assert.equal(view(s, 1).listening, true);
  assert.equal(view(s, 1).spotted, undefined);
  assert.equal(view(s, 1).roles[3], undefined, 'les loups ne savent pas qui écoute');
  assert.equal(view(s, 4).wolfChat, undefined);
  assert.equal(view(s, 4).listening, undefined);
  assert.throws(() => act(s, 3, { type: 'spy' }), /Tu ne peux pas/);
  assert.throws(() => act(s, 3, { type: 'wolfChat', text: 'coucou' }), /Tu ne peux pas/);
  assert.equal(s.phase, 'night', 'elle n’est pas attendue : la nuit continue avec les loups');
  s = wolvesKill(s, [1, 2], 4);
  assert.equal(s.phase, 'debate');
  assert.equal(view(s, 3).wolfChat, undefined, 'le jour, plus rien');
});

test('Petite fille repérée (1 chance sur 5) : les loups apprennent qui elle est, elle non', () => {
  const roles = ['wolf', 'wolf', 'littleGirl', 'villager', 'villager', 'villager', 'villager'];
  const c = act(game(roles, { ...NO_ROLE, littleGirl: true }), 3, { type: 'spy' }, ctx(() => 0.19));
  assert.equal(view(c, 1).spotted, 3);
  assert.equal(view(c, 1).roles[3], 'littleGirl');
  assert.equal(view(c, 3).spotted, undefined);
  assert.equal(view(c, 4).roles[3], undefined);
  assert.equal(view(c, null).roles[3], undefined);
  const safe = act(game(roles, { ...NO_ROLE, littleGirl: true }), 3, { type: 'spy' }, ctx(() => 0.2));
  assert.equal(view(safe, 1).spotted, undefined);
});

test('Corbeau : sa cible a 2 voix contre elle au vote du lendemain, annoncé au village', () => {
  const roles = ['wolf', 'raven', 'villager', 'villager', 'villager', 'villager'];
  let s = game(roles, { ...NO_ROLE, raven: true });
  assert.throws(() => act(s, 2, { type: 'mark', target: 2 }), /autre que toi/);
  s = act(s, 2, { type: 'mark', target: 3 });
  assert.deepEqual(view(s, 2).raven, { target: 3 });
  for (const id of [1, 3, null]) {
    assert.equal(view(s, id).raven, undefined);
    assert.equal(view(s, id).marked, null);
  }
  s = wolvesKill(s, [1], 6);
  assert.equal(s.phase, 'debate');
  assert.equal(view(s, null).marked, 3);
  assert.deepEqual(s.log.find((e) => e.k === 'raven'), { k: 'raven', n: 1, target: 3 });
  s = timeout(s, ctx()).state;
  s = act(s, 4, { type: 'vote', target: 5 });
  s = timeout(s, ctx()).state;
  assert.deepEqual(deadIds(s), [6, 3]);
  assert.equal(s.log.findLast((e) => e.k === 'vote').count, 2);
  assert.equal(s.marked, null, 'la marque ne dure qu’un jour');
});

test('Corbeau : il peut passer ; sa cible tuée dans la nuit, pas d’annonce', () => {
  const roles = ['wolf', 'raven', 'villager', 'villager', 'villager', 'villager'];
  let s = act(game(roles, { ...NO_ROLE, raven: true }), 1, { type: 'wolf', target: 3 });
  assert.equal(s.phase, 'night', 'la nuit attend le Corbeau');
  const pass = act(s, 2, { type: 'mark', target: null });
  assert.equal(pass.phase, 'debate');
  assert.equal(pass.log.some((e) => e.k === 'raven'), false);
  const dead = act(s, 2, { type: 'mark', target: 3 });
  assert.equal(dead.marked, null);
  assert.equal(dead.log.some((e) => e.k === 'raven'), false);
});

test('Loup blanc : compté avec les loups, il se montre en simple loup à la meute', () => {
  assert.deepEqual(composition(8, { whiteWolf: true }), { wolf: 2, whiteWolf: 1, seer: 1, witch: 1, hunter: 1, cupid: 1, villager: 1 });
  assert.deepEqual(composition(5, { whiteWolf: true }), { wolf: 1, whiteWolf: 1, seer: 1, witch: 1, villager: 1 });
  let s = game(['wolf', 'whiteWolf', 'villager', 'villager', 'villager', 'villager', 'villager'], { ...NO_ROLE, whiteWolf: true });
  assert.deepEqual(view(s, 1).roles, { 1: 'wolf', 2: 'wolf' });
  assert.deepEqual(view(s, 2).roles, { 1: 'wolf', 2: 'whiteWolf' });
  assert.deepEqual(view(s, 1).wolves, [1, 2]);
  assert.equal(view(s, 1).white, undefined);
  assert.throws(() => act(s, 2, { type: 'white', target: 1 }), /Tu ne peux pas/, 'pas la 1re nuit');
  assert.throws(() => act(s, 1, { type: 'wolf', target: 2 }), /autre loup/);
  s = wolvesKill(s, [1, 2], 3);
  s = timeout(timeout(s, ctx()).state, ctx()).state;
  assert.equal(s.n, 2);
  s = wolvesKill(s, [1, 2], 4);
  assert.equal(s.phase, 'night', 'une nuit sur deux, la nuit attend le Loup blanc');
  assert.throws(() => act(s, 1, { type: 'white', target: 2 }), /Tu ne peux pas/);
  assert.throws(() => act(s, 2, { type: 'white', target: 5 }), /autre loup/);
  assert.equal(JSON.stringify(view(s, 1)).includes('"white"'), false);
  s = act(s, 2, { type: 'white', target: 1 });
  assert.deepEqual(s.log.at(-1), { k: 'dawn', n: 2, dead: [4, 1] });
  assert.equal(s.phase, 'debate', 'le Loup blanc seul contre 3 : la partie continue');
});

test('Loup blanc : il gagne seul, dernier vivant ; les loups ne gagnent pas tant qu’il vit', () => {
  let s = game(['wolf', 'whiteWolf', 'villager'], { ...NO_ROLE, whiteWolf: true });
  s = wolvesKill(s, [1, 2], 3);
  assert.equal(s.phase, 'debate', 'deux loups seuls, mais le Loup blanc vit : pas encore de vainqueur');
  s = votes(timeout(s, ctx()).state, { 1: 2, 2: 1 });
  assert.equal(s.phase, 'night');
  assert.equal(s.n, 2);
  s = act(s, 2, { type: 'white', target: 1 }); // plus de proie : les loups ne sont pas attendus
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.winner, { side: 'white', ids: [2] });
  assert.deepEqual(status(s).winners, [2]);
  let t = game(['wolf', 'whiteWolf', 'villager', 'villager'], { ...NO_ROLE, whiteWolf: true });
  t = wolvesKill(t, [1, 2], 3);
  t = votes(timeout(t, ctx()).state, { 1: 2, 4: 2, 2: 4 });
  assert.deepEqual(t.winner, { side: 'wolves', ids: [1] }, 'Loup blanc mort : victoire normale des loups');
});

test('Voleur : deux cartes de plus que de joueurs, cachées aux autres', () => {
  const opts = { ...NO_ROLE, thief: true };
  const comp = composition(6, opts);
  assert.deepEqual(comp, { wolf: 1, thief: 1, villager: 6 });
  const players = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, pseudo: `p${i + 1}` }));
  const dealt = setup(players, opts, ctx(() => 0.3));
  assert.equal(dealt.extra.length, 2);
  const cards = [...Object.values(dealt.roles), ...dealt.extra].sort();
  assert.deepEqual(cards, Object.entries(comp).flatMap(([r, k]) => Array(k).fill(r)).sort());
  for (const r of [0, 0.3, 0.5, 0.99]) {
    const g = setup(players, opts, ctx(() => r));
    assert.equal(g.phase, 'night', 'jamais tous les loups au milieu');
    assert.ok(Object.values(g.roles).includes('wolf'));
  }
  let t = { ...game(['thief', 'wolf', 'villager', 'villager', 'villager', 'villager'], opts), extra: ['seer', 'villager'] };
  assert.deepEqual(view(t, 1).extra, ['seer', 'villager']);
  for (const id of [2, 3, null]) assert.equal(view(t, id).extra, undefined);
  t = act(t, 2, { type: 'wolf', target: 3 });
  assert.equal(t.phase, 'night', 'la nuit attend le Voleur');
  assert.throws(() => act(t, 1, { type: 'steal', pick: 2 }), /deux cartes/);
  t = act(t, 1, { type: 'steal', pick: 0 });
  assert.equal(t.roles[1], 'seer');
  assert.deepEqual(t.extra, ['thief', 'villager']);
  assert.equal(view(t, 1).me.role, 'seer');
  assert.deepEqual(view(t, 1).stole, { id: 1, took: 'seer' });
  assert.equal(view(t, 2).stole, undefined);
  assert.equal(view(t, 1).extra, undefined);
  assert.equal(t.phase, 'night', 'devenu Voyante, il sonde dès cette nuit');
  t = act(t, 1, { type: 'peek', target: 2 });
  assert.equal(t.phase, 'debate');
  const keep = act({ ...game(['thief', 'wolf', 'villager', 'villager', 'villager', 'villager'], opts), extra: ['seer', 'villager'] }, 1, { type: 'steal', pick: null });
  assert.equal(keep.roles[1], 'thief');
  assert.throws(() => act(keep, 1, { type: 'steal', pick: 0 }), /Tu ne peux pas/);
});

test('Voleur : si les deux cartes sont des loups, il doit en prendre une (au hasard au minuteur)', () => {
  const opts = { ...NO_ROLE, thief: true };
  const t = { ...game(['thief', 'wolf', 'villager', 'villager', 'villager', 'villager', 'villager'], opts), extra: ['wolf', 'wolf'] };
  assert.throws(() => act(t, 1, { type: 'steal', pick: null }), /dois en prendre/);
  let w = act(t, 1, { type: 'steal', pick: 1 });
  assert.equal(w.roles[1], 'wolf');
  assert.equal(view(w, 2).roles[1], 'wolf', 'la meute connaît son nouveau loup');
  assert.deepEqual(view(w, 2).wolves, [1, 2]);
  w = act(w, 2, { type: 'wolf', target: 3 });
  assert.equal(w.phase, 'night');
  w = act(w, 1, { type: 'wolf', target: 3 });
  assert.equal(w.phase, 'debate');
  const f = timeout(t, ctx(() => 0)).state;
  assert.equal(f.roles[1], 'wolf');
  assert.deepEqual(f.extra, ['thief', 'wolf']);
});

test('option « Révéler le rôle des morts » décochée : rôle caché jusqu’à la fin (sauf aux morts)', () => {
  let s = game(['wolf', 'villager', 'villager', 'villager', 'villager', 'villager'], { ...NO_ROLE, reveal: false });
  s = wolvesKill(s, [1], 2);
  assert.equal(view(s, null).roles[2], undefined);
  assert.equal(view(s, 3).dead[0].role, null);
  assert.equal(view(s, 1).roles[2], undefined);
  assert.equal(JSON.stringify(view(s, 3).dead).includes('villager'), false);
  assert.equal(view(s, 2).roles[2], 'villager', 'le mort connaît les rôles');
  s = votes(timeout(s, ctx()).state, { 3: 1, 4: 1, 5: 1, 6: 1, 1: 3 });
  assert.equal(s.phase, 'over');
  assert.equal(view(s, null).roles[2], 'villager', 'fin de partie : tout est révélé');
  assert.equal(view(s, null).dead[0].role, 'villager');
});

test('toutes options : la vue d’un simple villageois ne contient aucun secret', () => {
  const roles = ['wolf', 'whiteWolf', 'guard', 'raven', 'littleGirl', 'thief', 'elder', 'idiot', 'villager', 'seer', 'witch'];
  const opts = { captain: true, wolfChat: true, guard: true, elder: true, idiot: true, littleGirl: true, raven: true, whiteWolf: true, thief: true, reveal: false };
  let s = { ...game(roles, opts), extra: ['villager', 'hunter'] };
  s = act(s, 1, { type: 'wolfChat', text: 'secret-de-meute' });
  s = act(s, 3, { type: 'protect', target: 9 });
  s = act(s, 4, { type: 'mark', target: 10 });
  s = act(s, 5, { type: 'spy' }, ctx(() => 0.5));
  for (const id of [9, null]) {
    const v = view(s, id);
    const json = JSON.stringify(v);
    assert.equal(json.includes('secret-de-meute'), false);
    for (const k of ['wolfChat', 'extra', 'guard', 'raven', 'white', 'spotted', 'wolfVotes', 'listening', 'seen', 'witch', 'elder', 'stole']) assert.equal(v[k], undefined, `${k} caché`);
    assert.deepEqual(Object.keys(v.roles), id === null ? [] : ['9']);
    assert.equal(v.marked, null);
  }
  assert.equal(JSON.stringify(status(s)).includes('secret'), false);
  assert.equal(status(s).turn, null);
});

test('Voleur devenu loup : sa nouvelle meute ne peut plus le dévorer cette nuit', () => {
  const opts = { ...NO_ROLE, thief: true };
  const t = { ...game(['thief', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'villager'], opts), extra: ['wolf', 'wolf'] };
  // Les loups visent le Voleur, qu'ils prennent pour un villageois.
  const visé = act(act(t, 2, { type: 'wolf', target: 1 }), 3, { type: 'wolf', target: 1 });
  // Il prend lui-même un loup : les voix contre lui tombent.
  const pris = act(visé, 1, { type: 'steal', pick: 0 });
  assert.equal(pris.roles[1], 'wolf');
  assert.equal(Object.values(pris.wolfVotes).includes(1), false);
  assert.equal(deadIds(timeout(pris, ctx()).state).includes(1), false);
  // Il ne choisit pas : le minuteur lui donne un loup, et il ne meurt pas non plus.
  const forcé = timeout(visé, ctx(() => 0)).state;
  assert.equal(forcé.roles[1], 'wolf');
  assert.equal(deadIds(forcé).includes(1), false);
});

test('rôles des morts cachés : la phase de la Sorcière dure autant qu’elle soit vivante ou morte', () => {
  const roles = ['wolf', 'witch', 'villager', 'villager', 'villager', 'villager', 'villager'];
  const phaseAprèsLesLoups = (opts, witchDead) => {
    let s = game(roles, { ...NO_ROLE, witch: true, ...opts });
    if (witchDead) s = { ...s, dead: [...s.dead, { id: 2, role: 'witch', cause: 'wolves', n: 0 }] };
    return wolvesKill(s, [1], 3);
  };
  const vivante = phaseAprèsLesLoups({ reveal: false }, false);
  const morte = phaseAprèsLesLoups({ reveal: false }, true);
  assert.equal(vivante.phase, 'witch');
  assert.equal(morte.phase, 'witch', 'la phase ne doit pas sauter : elle trahirait la mort de la Sorcière');
  assert.equal(view(morte, null).phase, view(vivante, null).phase);
  assert.equal(morte.deadline, vivante.deadline, 'même échéance publique');
  assert.equal(timeout(morte, ctx()).state.phase, 'debate', 'le minuteur passe au jour');
  // Rôles révélés (réglage par défaut) : comme avant, la phase est sautée.
  assert.equal(phaseAprèsLesLoups({}, true).phase, 'debate');
});

test('les morts se taisent : statut « silent » pendant la partie, vide à la fin', () => {
  let s = game(['wolf', 'villager', 'villager', 'villager', 'villager', 'villager'], NO_ROLE);
  assert.deepEqual(status(s).silent, []);
  s = timeout(wolvesKill(s, [1], 2), ctx()).state;
  assert.deepEqual(status(s).silent, [2], 'le mort de la nuit ne peut plus écrire aux vivants');
  s = votes(s, { 3: 1, 4: 1, 5: 1, 6: 1, 1: 3 });
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s).silent, [], 'fin de partie : tout le monde peut parler');
});
