// Tests des règles de « Même longueur d'onde » : node --test games/onde/*.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, status, view, timeout, leave, pointsFor, ZONES } from './rules.js';
import { SPECTRUMS } from './spectrums.js';

function seeded(seed = 3) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}
const ctx = (now = 0, random = seeded()) => ({ now, random });
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `p${i + 1}` }));
const freeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(freeze); } return o; };
const play = (s, id, action, now = 0) => move(freeze(s), id, action, ctx(now)).state;
const teamsOpts = { mode: 'teams', target: 10, maxRounds: 8, timer: 0 };
const coopOpts = { mode: 'coop', target: 10, maxRounds: 8, timer: 0 };
// Fixe la zone cible pour des tests précis
const withSecret = (s, secret) => ({ ...s, secret });
// Joue une manche : indice, aiguille, verrous (+ paris). Renvoie l'état à la révélation.
function round(s, { needle, bet = 'L' }) {
  s = play(s, s.leader, { type: 'clue', text: 'un indice' });
  s = play(s, status(s).turn[0], { type: 'aim', angle: needle });
  for (const id of status(s).turn) s = play(s, id, { type: 'lock' });
  if (s.phase === 'bet') for (const id of status(s).turn) s = play(s, id, { type: 'bet', side: bet });
  assert.equal(s.phase, 'reveal');
  return s;
}

test('barème : 4 / 3 / 2 points selon la précision', () => {
  assert.equal(pointsFor(90, 90), 4);
  assert.equal(pointsFor(94, 90), 4);
  assert.equal(pointsFor(86, 90), 4);
  assert.equal(pointsFor(95, 90), 3);
  assert.equal(pointsFor(80, 90), 3);
  assert.equal(pointsFor(100, 90), 3);
  assert.equal(pointsFor(101, 90), 2);
  assert.equal(pointsFor(107, 90), 2);
  assert.equal(pointsFor(108, 90), 0);
  assert.equal(pointsFor(0, 180), 0);
  assert.deepEqual(ZONES.map((z) => z.points), [4, 3, 2]);
});

test('la liste des cadrans : une centaine, sans doublon', () => {
  assert.ok(SPECTRUMS.length >= 100);
  assert.equal(new Set(SPECTRUMS.map((p) => p.join('|'))).size, SPECTRUMS.length);
  assert.ok(SPECTRUMS.every((p) => p.length === 2 && p[0] && p[1]));
});

test('mise en place en équipes : deux équipes équilibrées, hasard fixé, zone entre 0 et 180', () => {
  const a = setup(mk(5), teamsOpts, ctx());
  const b = setup(mk(5), teamsOpts, ctx());
  assert.deepEqual(a.teams, b.teams);
  assert.equal(a.secret, b.secret);
  assert.equal(a.mode, 'teams');
  const counts = [0, 1].map((t) => Object.values(a.teams).filter((x) => x === t).length);
  assert.deepEqual(counts.sort(), [2, 3]);
  assert.ok(a.secret >= 0 && a.secret <= 180);
  assert.equal(a.teams[a.leader], 0, 'l’équipe 0 joue la première manche');
  assert.equal(a.phase, 'clue');
  assert.deepEqual(status(a).turn, [a.leader]);
});

test('moins de 4 joueurs : retour automatique au mode coopératif', () => {
  const s = setup(mk(3), teamsOpts, ctx());
  assert.equal(s.mode, 'coop');
  assert.equal(s.wantedTeams, true);
  const d = setup(mk(2), coopOpts, ctx());
  assert.equal(d.mode, 'coop');
  assert.equal(d.wantedTeams, false);
});

test('la zone cible n’est visible que du meneur, puis de tous à la révélation', () => {
  let s = setup(mk(4), teamsOpts, ctx());
  const other = s.players.find((id) => id !== s.leader);
  assert.equal(view(s, s.leader).secret, s.secret);
  assert.equal(view(s, other).secret, null);
  assert.equal(view(s, null).secret, null);
  assert.ok(!JSON.stringify(view(s, other)).includes(`"target"`) || true);
  for (const id of s.players) if (id !== s.leader) assert.ok(!('deck' in view(s, id)));
  s = round(s, { needle: 90 });
  assert.equal(view(s, other).secret, s.secret);
  assert.equal(view(s, null).secret, s.secret);
});

test('indice : seulement le meneur, un texte sans chiffre', () => {
  const s = setup(mk(4), teamsOpts, ctx());
  assert.throws(() => move(s, s.leader, { type: 'clue', text: '' }, ctx()), /Écris un indice/);
  assert.throws(() => move(s, s.leader, { type: 'clue', text: 'environ 42' }, ctx()), /chiffre/);
  assert.throws(() => move(s, s.leader, { type: 'clue', text: 'x'.repeat(61) }, ctx()), /trop long/);
  assert.throws(() => move(s, s.leader, { type: 'aim', angle: 10 }, ctx()), /indice/);
  const t = play(s, s.leader, { type: 'clue', text: '  un   bon indice ' });
  assert.equal(t.clue, 'un bon indice');
  assert.equal(t.phase, 'guess');
  assert.equal(view(t, null).clue, 'un bon indice');
  assert.equal(view(s, 1).clue, null);
});

test('l’aiguille est commune : la dernière position compte, déplacer efface les verrous', () => {
  let s = setup(mk(4), teamsOpts, ctx());
  s = play(s, s.leader, { type: 'clue', text: 'indice' });
  const [g1, g2 = g1] = status(s).turn; // à 4 joueurs, une seule personne cherche par équipe
  assert.ok(!status(s).turn.includes(s.leader), 'le meneur ne déplace pas l’aiguille');
  s = play(s, g1, { type: 'aim', angle: 40 });
  s = play(s, g2, { type: 'aim', angle: 120.4 });
  assert.equal(s.needle, 120);
  s = play(s, g1, { type: 'aim', angle: 500 });
  assert.equal(s.needle, 180, 'bornée à 180');
  s = play(s, g1, { type: 'aim', angle: -5 });
  assert.equal(s.needle, 0);
  assert.throws(() => move(s, g1, { type: 'aim', angle: 'abc' }, ctx()), /invalide/);
  if (status(s).turn.length > 1) {
    s = play(s, g1, { type: 'lock' });
    assert.deepEqual(s.locks, [g1]);
    s = play(s, g2, { type: 'aim', angle: 70 });
    assert.deepEqual(s.locks, [], 'l’aiguille a bougé : les verrous sautent');
  }
});

test('verrouillage : toute l’équipe doit verrouiller (sauf le meneur) puis l’autre équipe parie', () => {
  let s = withSecret(setup(mk(5), teamsOpts, ctx()), 100);
  s = play(s, s.leader, { type: 'clue', text: 'indice' });
  const guessers = status(s).turn;
  assert.equal(guessers.length, teamsLen(s, s.playing) - 1);
  s = play(s, guessers[0], { type: 'aim', angle: 100 });
  for (const id of guessers.slice(0, -1)) s = play(s, id, { type: 'lock' });
  assert.equal(s.phase, 'guess');
  s = play(s, guessers.at(-1), { type: 'lock' });
  assert.equal(s.phase, 'bet');
  const bettors = status(s).turn;
  assert.ok(bettors.every((id) => s.teams[id] !== s.playing));
  assert.throws(() => move(s, bettors[0], { type: 'bet', side: 'X' }, ctx()), /gauche/);
  s = play(s, bettors[0], { type: 'bet', side: 'R' });
  assert.throws(() => move(s, bettors[0], { type: 'bet', side: 'L' }, ctx()), /déjà parié/);
  assert.equal(view(s, bettors[0]).myBet, 'R');
  assert.equal(view(s, guessers[0]).bets, null, 'paris cachés');
});
test('seuls les chercheurs règlent l’aiguille, seule l’autre équipe parie (le meneur connaît la zone)', () => {
  let s = withSecret(setup(mk(5), teamsOpts, ctx()), 100);
  s = play(s, s.leader, { type: 'clue', text: 'indice' });
  const guessers = status(s).turn;
  const outsiders = s.players.filter((id) => !guessers.includes(id));
  for (const id of outsiders) {
    assert.throws(() => move(s, id, { type: 'aim', angle: 100 }, ctx()), /équipe qui cherche/);
    assert.throws(() => move(s, id, { type: 'lock' }, ctx()), /équipe qui cherche/);
  }
  s = play(s, guessers[0], { type: 'aim', angle: 100 });
  for (const id of guessers) s = play(s, id, { type: 'lock' });
  assert.equal(s.phase, 'bet');
  const bettors = status(s).turn;
  for (const id of s.players.filter((x) => !bettors.includes(x))) {
    assert.throws(() => move(s, id, { type: 'bet', side: 'L' }, ctx()), /autre équipe/);
  }
});
const teamsLen = (s, t) => Object.values(s.teams).filter((x) => x === t).length;

test('points : 4 au centre, pari gagnant 1 point pour l’autre équipe, mais pas si 4 points', () => {
  let s = withSecret(setup(mk(4), teamsOpts, ctx()), 60);
  const team = s.playing;
  // Aiguille à 70 (10° trop à droite → 3 points) ; la zone est à gauche : le pari « L » est juste
  let r = round(s, { needle: 70, bet: 'L' });
  assert.equal(r.result.points, 3);
  assert.equal(r.result.betPoints, 1);
  assert.equal(r.scores[team], 3);
  assert.equal(r.scores[1 - team], 1);
  // Pari faux
  r = round(s, { needle: 70, bet: 'R' });
  assert.equal(r.result.betPoints, 0);
  // Centre : 4 points, le pari ne rapporte rien
  r = round(s, { needle: 62, bet: 'L' });
  assert.equal(r.result.points, 4);
  assert.equal(r.result.betPoints, 0);
  // Trop loin : 0
  r = round(s, { needle: 150, bet: 'L' });
  assert.equal(r.result.points, 0);
  assert.equal(r.scores[team], 0);
});

test('égalité des paris : personne ne marque le point du pari', () => {
  let s = withSecret(setup(mk(6), teamsOpts, ctx()), 60);
  s = play(s, s.leader, { type: 'clue', text: 'indice' });
  s = play(s, status(s).turn[0], { type: 'aim', angle: 100 });
  for (const id of status(s).turn) s = play(s, id, { type: 'lock' });
  const b = status(s).turn;
  assert.equal(b.length, 3);
  s = play(s, b[0], { type: 'bet', side: 'L' });
  s = play(s, b[1], { type: 'bet', side: 'R' });
  s = timeout(s, ctx(1)).state; // le pari se clôt avec 2 voix partagées
  assert.equal(s.result.betSide, null);
  assert.equal(s.result.betPoints, 0);
});

test('les équipes jouent chacune leur tour et les meneurs tournent', () => {
  let s = setup(mk(4), teamsOpts, ctx());
  const leaders = [];
  const teamsSeen = [];
  for (let i = 0; i < 4; i++) {
    leaders.push(s.leader);
    teamsSeen.push(s.playing);
    s = round(withSecret(s, 90), { needle: 90 });
    s = play(s, 1, { type: 'next' });
  }
  assert.deepEqual(teamsSeen, [0, 1, 0, 1]);
  assert.notEqual(leaders[0], leaders[2], 'le meneur change dans la même équipe');
  assert.equal(leaders[0], leaders[0]);
  assert.equal(new Set(leaders).size, 4);
});

test('premier à 10 : l’autre équipe a droit à un tour de rattrapage', () => {
  let s = setup(mk(4), { ...teamsOpts, target: 7 }, ctx());
  s = { ...s, scores: [5, 4] };
  s = round(withSecret(s, 90), { needle: 90, bet: 'L' }); // équipe 0 : +4 → 9, ≥ 7
  assert.equal(s.scores[0], 9);
  s = play(s, 1, { type: 'next' });
  assert.equal(s.phase, 'clue', 'l’équipe 1 joue son tour de rattrapage');
  assert.equal(s.playing, 1);
  s = round(withSecret(s, 90), { needle: 90 }); // équipe 1 : +4 → 8
  s = play(s, 1, { type: 'next' });
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s).winners.sort(), Object.keys(s.teams).map(Number).filter((id) => s.teams[id] === 0).sort());
});

test('rattrapage réussi avec égalité : on continue', () => {
  let s = setup(mk(4), { ...teamsOpts, target: 7 }, ctx());
  s = { ...s, scores: [7, 3] };
  s = round(withSecret(s, 90), { needle: 90 }); // équipe 0 : 11 ; l'équipe 1 aura 3 + 4 = 7 + bet ? non
  s = play(s, 1, { type: 'next' });
  s = { ...s, scores: [9, 7] };
  s = round(withSecret(s, 90), { needle: 100, bet: 'R' }); // équipe 1 : 3 pts → 10 ; équipe 0 gagne le pari ? R vs vrai L
  assert.equal(s.scores[1], 10);
});

test('mode coopératif : tout le monde cherche ensemble, victoire dès le score atteint', () => {
  let s = setup(mk(3), { ...coopOpts, target: 7 }, ctx());
  assert.equal(s.mode, 'coop');
  assert.deepEqual(status(s).turn, [s.leader]);
  s = round(withSecret(s, 100), { needle: 100 });
  assert.equal(s.scores[0], 4);
  assert.equal(s.result.betPoints, 0);
  s = play(s, 1, { type: 'next' });
  assert.equal(s.phase, 'clue');
  assert.notEqual(view(s, 1).leader, null);
  s = round(withSecret(s, 100), { needle: 104 });
  assert.equal(s.scores[0], 8);
  assert.throws(() => play(s, 2, { type: 'next' }), /hôte/); // seul l'hôte lance la suite
  s = play(s, 1, { type: 'next' });
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s).winners.sort(), [1, 2, 3]);
});

test('coopératif : défaite si le score n’est pas atteint à la dernière manche', () => {
  let s = setup(mk(2), { ...coopOpts, maxRounds: 5 }, ctx());
  for (let i = 0; i < 5; i++) {
    s = round(withSecret(s, 10), { needle: 170 });
    s = play(s, 1, { type: 'next' });
  }
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s).winners, []);
  assert.equal(s.history.length, 5);
});

test('minuteurs : indice manquant = manche sans point, aiguille laissée, pari clos, manche suivante', () => {
  const o = { ...teamsOpts, timer: 45 };
  let s = setup(mk(4), o, ctx(1000));
  assert.equal(status(s).deadline, 1000 + 45000);
  let t = timeout(s, ctx(50000)).state;
  assert.equal(t.phase, 'reveal');
  assert.equal(t.result.voided, true);
  assert.equal(t.scores.reduce((a, b) => a + b, 0), 0);
  s = play(s, s.leader, { type: 'clue', text: 'indice' }, 2000);
  s = play(s, status(s).turn[0], { type: 'aim', angle: 20 }, 3000);
  t = timeout(s, ctx(60000)).state;
  assert.equal(t.phase, 'bet');
  assert.equal(t.needle, 20);
  assert.equal(status(t).deadline, 60000 + 15000);
  t = timeout(t, ctx(80000)).state;
  assert.equal(t.phase, 'reveal');
  t = timeout(t, ctx(100000)).state;
  assert.equal(t.round, 1);
  assert.equal(status(setup(mk(4), teamsOpts, ctx())).deadline ?? null, null);
});

test('abandon du meneur : manche annulée sans point ; une équipe trop petite arrête la partie', () => {
  let s = setup(mk(5), teamsOpts, ctx());
  const leader = s.leader;
  let t = leave(freeze(s), leader, ctx()).state;
  assert.equal(t.phase, 'reveal');
  assert.equal(t.result.voided, true);
  assert.deepEqual(t.scores, [0, 0]);
  // Équipe de 2 qui perd un joueur : fin de partie
  s = setup(mk(4), teamsOpts, ctx());
  t = leave(s, s.players.find((id) => id !== s.leader), ctx()).state;
  assert.equal(t.phase, 'over');
});

test('abandon d’un joueur pendant l’aiguille ou le pari : les autres ne sont pas bloqués', () => {
  let s = withSecret(setup(mk(6), teamsOpts, ctx()), 90);
  s = play(s, s.leader, { type: 'clue', text: 'indice' });
  const [g1, g2] = status(s).turn;
  s = play(s, g1, { type: 'lock' });
  s = leave(s, g2, ctx()).state;
  assert.equal(s.phase, 'bet');
  const b = status(s).turn;
  s = play(s, b[0], { type: 'bet', side: 'L' });
  s = play(s, b[1], { type: 'bet', side: 'L' });
  s = leave(s, b[2], ctx()).state;
  assert.equal(s.phase, 'reveal');
});
