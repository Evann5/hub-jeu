// Tests des règles de Président : node --test games/president/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, status, view, timeout, leave, buildDeck, titleOf, rankOf } from './rules.js';

// Qui peut agir : celui dont c'est le tour, plus les coups libres (status().may).
const actors = (s) => { const st = status(s); return [...new Set([...[].concat(st.turn ?? []), ...(st.may ?? [])])]; };

const players = [1, 2, 3, 4].map((id) => ({ id, pseudo: `p${id}` }));
const mulberry = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const T0 = 1_000_000;
const ctx = (now = T0, seed = 7) => ({ now, random: mulberry(seed) });
const play = (s, id, cards, c = ctx()) => move(s, id, { type: 'play', cards }, c).state;
const pass = (s, id, c = ctx()) => move(s, id, { type: 'pass' }, c).state;
const throwsMsg = (fn, re) => assert.throws(fn, (e) => e instanceof Error && re.test(e.message));

// Manche en cours à 4 joueurs, c'est à 1 d'ouvrir, avec des mains choisies.
function table(hands, extra = {}) {
  const s = setup(players, {}, ctx());
  const h = { 1: ['3S', '5H', '5D', 'KS'], 2: ['4S', '6H', 'QD', 'AS'], 3: ['3H', '7S', 'JD', '2H'], 4: ['4H', '8S', '9D', '2S'], ...hands };
  return { ...s, hands: h, turn: 0, pli: null, stack: [], last: null, passed: [], finished: [], deadline: null, phase: 'play', exchange: null, ...extra };
}

test('52 cartes distribuées en entier, 13 chacun à 4 joueurs', () => {
  assert.equal(buildDeck().length, 52);
  assert.equal(new Set(buildDeck()).size, 52);
  const s = setup(players, { rounds: 2, timer: 30 }, ctx(T0));
  for (const p of players) assert.equal(s.hands[p.id].length, 13);
  assert.equal(s.deadline, T0 + 30000);
  assert.equal(s.rounds, 2);
  assert.deepEqual(setup(players, {}, ctx()), setup(players, {}, ctx())); // hasard fixé
});

test('à 3 joueurs : 18, 17 et 17 cartes ; à 8 : tout le paquet est distribué', () => {
  const s3 = setup(players.slice(0, 3), {}, ctx());
  assert.deepEqual([1, 2, 3].map((id) => s3.hands[id].length).sort(), [17, 17, 18]);
  const eight = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id, pseudo: `p${id}` }));
  const s8 = setup(eight, {}, ctx());
  assert.equal(eight.reduce((n, p) => n + s8.hands[p.id].length, 0), 52);
});

test("la première manche commence par celui qui a le 3 de trèfle", () => {
  const s = setup(players, {}, ctx());
  const holder = players.find((p) => s.hands[p.id].includes('3C')).id;
  assert.equal(status(s).turn, holder);
});

test('le 2 est la plus forte, le 3 la plus faible', () => {
  assert.ok(rankOf('2S') > rankOf('AS'));
  assert.ok(rankOf('AS') > rankOf('KH'));
  assert.ok(rankOf('3C') < rankOf('4C'));
  assert.ok(rankOf('10H') < rankOf('JH'));
});

test('on ouvre avec 1 à 4 cartes de même valeur, pas de valeurs mélangées', () => {
  const s = table();
  const a = play(s, 1, ['5H', '5D']);
  assert.deepEqual(a.pli.cards.sort(), ['5D', '5H']);
  assert.equal(a.pli.count, 2);
  assert.equal(status(a).turn, 2);
  throwsMsg(() => move(s, 1, { type: 'play', cards: ['5H', 'KS'] }, ctx()), /même valeur/);
  throwsMsg(() => move(s, 1, { type: 'play', cards: [] }, ctx()), /au moins une/);
  throwsMsg(() => move(s, 1, { type: 'play', cards: ['5H', '5H'] }, ctx()), /deux fois/);
  throwsMsg(() => move(s, 1, { type: 'play', cards: ['9S'] }, ctx()), /pas toutes/);
  throwsMsg(() => move(s, 1, { type: 'play', cards: ['3S', '3S', '3S', '3S', '3S'] }, ctx()), /au plus 4/);
  throwsMsg(() => move(s, 2, { type: 'play', cards: ['4S'] }, ctx()), /pas ton tour/);
});

test('il faut le même nombre de cartes, plus fortes ou égales', () => {
  const s = play(table({ 2: ['6H', '6S', 'AS', '4S'] }), 1, ['5H', '5D']);
  throwsMsg(() => move(s, 2, { type: 'play', cards: ['AS'] }, ctx()), /exactement 2/);
  throwsMsg(() => move(s, 2, { type: 'play', cards: ['4S'] }, ctx()), /exactement 2/);
  const s2 = play(s, 2, ['6H', '6S']);
  assert.equal(s2.pli.rank, rankOf('6S'));
});

test('une valeur plus faible est refusée', () => {
  const s = play(table({ 1: ['9H', '5D'], 2: ['6H', 'AS'] }), 1, ['9H']);
  throwsMsg(() => move(s, 2, { type: 'play', cards: ['6H'] }, ctx()), /plus forte ou égale/);
});

test("passer est interdit quand on ouvre le pli", () => {
  throwsMsg(() => move(table(), 1, { type: 'pass' }, ctx()), /ouvres le pli/);
});

test("quand tout le monde passe, le pli revient à celui qui a posé en dernier, qui rouvre", () => {
  let s = play(table(), 1, ['KS']);
  s = pass(s, 2);
  s = pass(s, 3);
  assert.equal(status(s).turn, 4);
  s = pass(s, 4);
  assert.equal(s.pli, null);
  assert.equal(status(s).turn, 1);
  assert.deepEqual(s.passed, []);
  // il rouvre : passer est de nouveau interdit
  throwsMsg(() => move(s, 1, { type: 'pass' }, ctx()), /ouvres le pli/);
});

test('on peut repasser après avoir passé tant que le pli continue', () => {
  let s = play(table({ 2: ['6H', 'AS'], 3: ['7S', '2H'], 4: ['8S', '9D'] }), 1, ['5H']);
  s = play(s, 2, ['6H']);
  s = pass(s, 3);
  s = play(s, 4, ['8S']);
  assert.equal(status(s).turn, 1);
  s = pass(s, 1);
  assert.equal(status(s).turn, 2); // 2 a le droit de jouer à nouveau
  assert.deepEqual(s.stack.length, 2);
});

test('un 2 ramasse le pli tout de suite et son auteur rouvre', () => {
  let s = play(table(), 1, ['KS']);
  s = pass(s, 2);
  s = play(s, 3, ['2H']);
  assert.equal(s.pli, null);
  assert.equal(status(s).turn, 3);
  assert.equal(s.hands[3].length, 3);
});

test('un 2 doit respecter le nombre de cartes du pli', () => {
  let s = play(table({ 2: ['6H', '6S'], 3: ['2H', '2D', '7S'] }), 1, ['5H', '5D']);
  s = pass(s, 2);
  throwsMsg(() => move(s, 3, { type: 'play', cards: ['2H'] }, ctx()), /exactement 2/);
});

test('une valeur égale fait sauter le joueur suivant', () => {
  let s = play(table({ 1: ['5H', '9S'], 2: ['5S', 'AS'] }), 1, ['5H']);
  s = play(s, 2, ['5S']);
  assert.equal(status(s).turn, 4); // 3 est sauté
  assert.equal(s.log.some((e) => e.k === 'skip' && e.target === 3), true);
});

test('avec une valeur égale, si le suivant est celui qui a posé avant : le pli est ramassé', () => {
  // 2 joueurs encore en lice : l'égalité fait sauter l'autre, le pli revient à l'auteur
  let s = table({ 1: ['5H', '9S'], 2: ['5S', 'AS'] }, { finished: [3, 4] });
  s = play(s, 1, ['5H']);
  s = play(s, 2, ['5S']);
  assert.equal(s.pli, null);
  assert.equal(status(s).turn, 2);
});

test("la sortie est enregistrée dans l'ordre ; celui qui sort ne joue plus", () => {
  let s = play(table({ 1: ['KS'], 2: ['AS', '4S'] }), 1, ['KS']);
  assert.deepEqual(s.finished, [1]);
  s = play(s, 2, ['AS']);
  s = pass(s, 3);
  s = pass(s, 4);
  // 2 a posé en dernier et rouvre ; 1 est sorti et saute
  assert.equal(status(s).turn, 2);
  assert.equal(view(s, 1).canPass, false);
});

test("quand celui qui a posé en dernier est sorti, le suivant ouvre", () => {
  let s = play(table({ 1: ['KS'] }), 1, ['KS']);
  s = pass(s, 2);
  s = pass(s, 3);
  s = pass(s, 4);
  assert.equal(s.pli, null);
  assert.equal(status(s).turn, 2);
});

test('sortir sur un 2 : le joueur suivant ouvre', () => {
  const s = play(table({ 1: ['2S'] }), 1, ['2S']);
  assert.deepEqual(s.finished, [1]);
  assert.equal(s.pli, null);
  assert.equal(status(s).turn, 2);
});

test('titres : Président, Vice-président, Neutre, Vice-pauvre, Pauvre', () => {
  assert.deepEqual([0, 1, 2, 3].map((p) => titleOf(p, 4)), ['Président', 'Vice-président', 'Vice-pauvre', 'Pauvre']);
  assert.deepEqual([0, 1, 2].map((p) => titleOf(p, 3)), ['Président', 'Neutre', 'Pauvre']);
  assert.deepEqual([0, 1, 2, 3, 4].map((p) => titleOf(p, 5)), ['Président', 'Vice-président', 'Neutre', 'Vice-pauvre', 'Pauvre']);
});

// Une manche jusqu'au bout : 1 sort, puis 2, puis 3 ; 4 reste dernier.
function endOfRound(extra = {}, ctxIn = ctx(T0)) {
  let s = table({ 1: ['KS'], 2: ['AS'], 3: ['2H'], 4: ['4H', '8S'] }, { rounds: 3, ...extra });
  s = play(s, 1, ['KS'], ctxIn);
  s = play(s, 2, ['AS'], ctxIn);
  s = play(s, 3, ['2H'], ctxIn);
  return s;
}

test('fin de manche : classement, points (Président 3, puis 2, 1, 0) et pause', () => {
  const s = endOfRound();
  assert.equal(s.phase, 'between');
  assert.deepEqual(s.result.order, [1, 2, 3, 4]);
  assert.deepEqual(s.result.titles, { 1: 'Président', 2: 'Vice-président', 3: 'Vice-pauvre', 4: 'Pauvre' });
  assert.deepEqual(s.scores, { 1: 3, 2: 2, 3: 1, 4: 0 });
  assert.equal(status(s).deadline, T0 + 12000);
  assert.deepEqual(actors(s), [1, 2, 3, 4]);
  throwsMsg(() => move(s, 4, { type: 'pass' }, ctx()), /manche est finie/);
});

test('une seule manche : la partie est finie, le Président gagne', () => {
  const s = endOfRound({ rounds: 1 });
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s), { turn: null, over: true, winners: [1], deadline: null });
});

test('manche suivante : échange du Pauvre (ses 2 meilleures cartes) vers le Président', () => {
  const s0 = endOfRound({ rounds: 2 });
  const s = move(s0, 3, { type: 'next' }, ctx(T0 + 5000, 3)).state;
  assert.equal(s.phase, 'exchange');
  assert.equal(s.round, 2);
  assert.equal(s.exchange.president, 1);
  assert.equal(s.exchange.pauvre, 4);
  assert.equal(s.exchange.received.length, 2);
  // le Pauvre a perdu ses deux meilleures cartes
  const pv = s.hands[4];
  for (const c of s.exchange.received) {
    assert.equal(pv.includes(c), false);
    assert.equal(s.hands[1].includes(c), true);
    assert.ok(pv.every((x) => rankOf(x) <= rankOf(c) || s.exchange.received.some((r) => rankOf(r) >= rankOf(x))));
  }
  assert.equal(status(s).turn, 1);
  // 52 cartes toujours : 13 chacun, +2 pour le Président, -2 pour le Pauvre
  assert.equal(s.hands[1].length, 15);
  assert.equal(s.hands[4].length, 11);
  assert.equal(s.hands[2].length + s.hands[3].length, 26); // les vice ont échangé 1 contre 1
  // le Vice-pauvre a reçu la plus faible du Vice-président, et inversement
  assert.equal(s.hands[2].length, 13);
});

test("le Président rend 2 cartes de son choix, puis le Pauvre ouvre", () => {
  const s0 = endOfRound({ rounds: 2 });
  const s = move(s0, 1, { type: 'next' }, ctx(T0, 5)).state;
  const give = s.hands[1].slice(0, 2);
  throwsMsg(() => move(s, 4, { type: 'give', cards: give }, ctx()), /Seul le Président/);
  throwsMsg(() => move(s, 1, { type: 'give', cards: [give[0]] }, ctx()), /exactement 2/);
  throwsMsg(() => move(s, 1, { type: 'give', cards: [give[0], give[0]] }, ctx()), /exactement 2/);
  throwsMsg(() => move(s, 1, { type: 'give', cards: ['3Z', '4Z'] }, ctx()), /pas toutes/);
  throwsMsg(() => move(s, 1, { type: 'play', cards: [s.hands[1][0]] }, ctx()), /Choisis les deux cartes/);
  const done = move(s, 1, { type: 'give', cards: give }, ctx()).state;
  assert.equal(done.phase, 'play');
  assert.equal(done.hands[1].length, 13);
  assert.equal(done.hands[4].length, 13);
  for (const c of give) assert.equal(done.hands[4].includes(c), true);
  assert.equal(status(done).turn, 4);
  assert.deepEqual(view(done, 4).exchange.given, give);
  assert.equal(view(done, 2).exchange.given, null);
});

test("échange : le minuteur rend automatiquement les 2 plus faibles cartes", () => {
  const s0 = endOfRound({ rounds: 2, timer: 20 });
  const s = move(s0, 1, { type: 'next' }, ctx(T0, 5)).state;
  assert.equal(s.deadline, T0 + 20000);
  const weakest = s.hands[1].slice().sort((a, b) => rankOf(a) - rankOf(b) || a.localeCompare(b)).slice(0, 2);
  const done = timeout(s, ctx(T0 + 20000)).state;
  assert.equal(done.phase, 'play');
  assert.equal(done.hands[1].length, 13);
  assert.equal(done.exchange.given.length, 2);
  for (const c of done.exchange.given) assert.ok(rankOf(weakest[weakest.length - 1]) >= rankOf(c));
});

test('après la pause, le minuteur lance la manche suivante ; à 3 joueurs, pas d\'échange des vice', () => {
  const tri = players.slice(0, 3);
  let s = setup(tri, { rounds: 2 }, ctx());
  s = { ...s, hands: { 1: ['KS'], 2: ['AS'], 3: ['4H', '8S'] }, turn: 0, pli: null, last: null, stack: [], passed: [], finished: [], deadline: null };
  s = play(s, 1, ['KS']);
  s = play(s, 2, ['AS']);
  assert.equal(s.phase, 'between');
  assert.deepEqual(s.result.titles, { 1: 'Président', 2: 'Neutre', 3: 'Pauvre' });
  const n = timeout(s, ctx(T0 + 12000, 9)).state;
  assert.equal(n.phase, 'exchange');
  assert.equal(n.exchange.vice, null);
  assert.equal(n.hands[2].length, 17);
});

test("fin de partie en plusieurs manches : le meilleur total gagne", () => {
  const s0 = endOfRound({ rounds: 2 });
  let s = move(s0, 1, { type: 'next' }, ctx(T0, 5)).state;
  s = timeout(s, ctx(T0)).state; // échange automatique
  // le joueur 4 (Pauvre) ouvre ; on force la fin de manche : 4 sort premier
  s = { ...s, hands: { 1: ['KS'], 2: ['AS'], 3: ['5D'], 4: ['3S'] }, pli: null, last: null, stack: [], passed: [], finished: [] };
  assert.equal(status(s).turn, 4);
  s = play(s, 4, ['3S']);
  s = play(s, 1, ['KS']);
  s = play(s, 2, ['AS']);
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.scores, { 1: 3 + 2, 2: 2 + 1, 3: 1 + 0, 4: 0 + 3 });
  assert.deepEqual(s.winners, [1]);
});

test('égalité de points à la fin : le mieux classé à la dernière manche gagne', () => {
  const s0 = endOfRound({ rounds: 2, round: 2, scores: { 1: 0, 2: 1, 3: 2, 4: 5 } });
  // 1:3, 2:3, 3:3, 4:5 -> 4 gagne ; on teste l'égalité autrement
  assert.deepEqual(s0.winners, [4]);
  const t = endOfRound({ rounds: 2, round: 2, scores: { 1: 0, 2: 1, 3: 2, 4: 3 } });
  // 1:3, 2:3, 3:3, 4:3 -> égalité à 4, le Président de la manche (1) l'emporte
  assert.deepEqual(t.scores, { 1: 3, 2: 3, 3: 3, 4: 3 });
  assert.deepEqual(t.winners, [1]);
});

test('minuteur : on passe si un pli est ouvert', () => {
  let s = play(table({}, { timer: 20 }), 1, ['KS'], ctx(T0));
  assert.equal(status(s).deadline, T0 + 20000);
  s = timeout(s, ctx(T0 + 20000));
  s = s.state;
  assert.deepEqual(s.passed, [2]);
  assert.equal(status(s).turn, 3);
  assert.equal(status(s).deadline, T0 + 40000);
});

test("minuteur : en ouvrant le pli, on pose la carte la plus faible", () => {
  const s = timeout(table({}, { timer: 20, deadline: T0 }), ctx(T0 + 20000)).state;
  assert.deepEqual(s.pli.cards, ['3S']);
  assert.equal(s.hands[1].length, 3);
  assert.equal(status(s).turn, 2);
});

test('sans minuteur, pas de deadline', () => {
  assert.equal(status(table()).deadline, null);
});

test("abandon pendant son tour : ses cartes sortent du jeu, la partie continue", () => {
  const { state: s } = leave(table(), 1, ctx());
  assert.deepEqual(s.out, [1]);
  assert.deepEqual(s.hands[1], []);
  assert.equal(status(s).turn, 2);
  assert.equal(status(s).over, false);
  throwsMsg(() => move(s, 1, { type: 'pass' }, ctx()), /ne joues plus/);
  // le tour saute le joueur parti
  let t = play(s, 2, ['6H']);
  t = pass(t, 3);
  t = pass(t, 4);
  assert.equal(status(t).turn, 2);
});

test("abandon de celui qui a posé en dernier : le pli passe au suivant", () => {
  let s = play(table(), 1, ['KS']);
  s = leave(s, 1, ctx()).state;
  assert.equal(status(s).turn, 2);
  s = pass(s, 2);
  s = pass(s, 3);
  s = pass(s, 4);
  assert.equal(s.pli, null);
  assert.equal(status(s).turn, 2);
});

test('abandon : il termine dernier de la manche', () => {
  let s = table({ 1: ['KS'], 2: ['AS'], 3: ['2H'], 4: ['4H', '8S'] }, { rounds: 2 });
  s = leave(s, 4, ctx()).state;
  s = play(s, 1, ['KS']);
  s = play(s, 2, ['AS']);
  assert.equal(s.phase, 'between');
  assert.deepEqual(s.result.order, [1, 2, 3, 4]);
  assert.equal(s.scores[4], 0);
  // la manche suivante se joue sans lui
  const n = timeout(s, ctx(T0 + 12000, 4)).state;
  assert.equal(n.dealt.length, 3);
  assert.equal(n.hands[4].length, 0);
});

test("abandon : quand il ne reste qu'un joueur, il gagne", () => {
  let s = leave(table(), 1, ctx()).state;
  s = leave(s, 2, ctx()).state;
  assert.equal(status(s).over, false);
  s = leave(s, 3, ctx()).state;
  assert.deepEqual(status(s), { turn: null, over: true, winners: [4], deadline: null });
});

test("abandon qui laisse une seule personne en lice dans la manche : la manche se termine", () => {
  let s = table({ 1: ['KS'], 2: ['AS', '4S'], 3: ['2H', '3H'], 4: ['4H', '8S'] }, { rounds: 2 });
  s = play(s, 1, ['KS']);
  s = leave(s, 3, ctx()).state;
  s = leave(s, 4, ctx()).state;
  assert.equal(s.phase, 'between');
  assert.deepEqual(s.result.order, [1, 2, 4, 3]);
});

test('abandon du Président pendant l\'échange : le Pauvre récupère ses cartes', () => {
  const s0 = endOfRound({ rounds: 2 });
  const s = move(s0, 1, { type: 'next' }, ctx(T0, 5)).state;
  const received = s.exchange.received;
  const n = leave(s, 1, ctx()).state;
  assert.equal(n.phase, 'play');
  for (const c of received) assert.equal(n.hands[4].includes(c), true);
  assert.equal(n.hands[4].length, 13);
  assert.equal(status(n).turn, 4);
});

test('la vue cache les mains des autres ; le spectateur ne voit aucune carte', () => {
  const s = table();
  const v = view(s, 1);
  assert.deepEqual(v.hand, ['3S', '5H', '5D', 'KS']);
  assert.deepEqual(v.counts, { 1: 4, 2: 4, 3: 4, 4: 4 });
  const json = JSON.stringify(v);
  for (const c of ['4S', 'AS', '7S', '2H', '9D']) assert.equal(json.includes(`"${c}"`), false, c);
  assert.deepEqual(view(s, null).hand, []);
  assert.deepEqual(view(s, 2).playable, []);
  assert.deepEqual(view(s, 1).playable, ['3', '5', 'K']);
  assert.equal(view(s, 1).canPass, false);
});

test("valeurs jouables : seulement celles qui battent le pli, avec assez de cartes", () => {
  const s = play(table({ 2: ['6H', '6S', 'AS', 'QD', 'QS', '4S'] }), 1, ['5H', '5D']);
  assert.deepEqual(view(s, 2).playable, ['6', 'Q']);
  assert.equal(view(s, 2).canPass, true);
});

test('un coup inconnu est refusé', () => {
  throwsMsg(() => move(table(), 1, { type: 'triche' }, ctx()), /inconnu/);
});

test("l'état reçu n'est jamais modifié", () => {
  const s = table();
  const before = JSON.stringify(s);
  play(s, 1, ['KS']);
  leave(s, 2, ctx());
  timeout(s, ctx());
  assert.equal(JSON.stringify(s), before);
});

// Parties jouées au hasard avec des coups légaux : elles se terminent toujours, sans perdre ni dupliquer de carte.
function randomPlayout(seed, n, rounds, timer) {
  const rnd = mulberry(seed);
  const ps = Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `p${i + 1}` }));
  const c = (now) => ({ now, random: rnd });
  let now = T0;
  let s = setup(ps, { rounds, timer }, c(now));
  for (let step = 0; step < 4000 && !status(s).over; step++) {
    const st = status(s);
    const who = actors(s)[0];
    const v = view(s, who);
    now += 1000;
    if (v.phase === 'between') {
      s = (rnd() < 0.5 ? timeout(s, c(now)) : move(s, who, { type: 'next' }, c(now))).state;
    } else if (v.phase === 'exchange') {
      s = move(s, who, { type: 'give', cards: v.hand.slice().sort(() => rnd() - 0.5).slice(0, 2) }, c(now)).state;
    } else if (timer && rnd() < 0.15) {
      s = timeout(s, c(now)).state;
    } else if (v.playable.length && (!v.canPass || rnd() < 0.8)) {
      const rank = v.playable[Math.floor(rnd() * v.playable.length)];
      const same = v.hand.filter((x) => x.slice(0, -1) === rank);
      const count = v.pli ? v.pli.count : 1 + Math.floor(rnd() * same.length);
      s = move(s, who, { type: 'play', cards: same.slice(0, count) }, c(now)).state;
    } else {
      s = move(s, who, { type: 'pass' }, c(now)).state;
    }
    if (s.phase !== 'over' && s.phase !== 'exchange') {
      const inHands = Object.values(s.hands).flat();
      const onTable = [...s.stack.flat(), ...(s.pli ? s.pli.cards : [])];
      assert.equal(new Set(inHands).size, inHands.length);
      for (const card of onTable) assert.equal(inHands.includes(card), false);
    }
  }
  return s;
}

test('parties au hasard : elles se terminent, 3 à 8 joueurs, avec ou sans minuteur', () => {
  for (const [n, rounds, timer] of [[3, 2, 0], [4, 3, 20], [5, 1, 0], [6, 2, 30], [8, 2, 0], [8, 3, 60]]) {
    for (let seed = 1; seed <= 8; seed++) {
      const s = randomPlayout(seed * 100 + n, n, rounds, timer);
      assert.equal(status(s).over, true, `n=${n} seed=${seed}`);
      assert.equal(status(s).winners.length, 1);
    }
  }
});

test('révolution : un carré inverse l’ordre, il faut poser plus faible ; le 3 ramasse le pli', () => {
  let s = table({ 1: ['7S', '7H', '7D', '7C', 'KS'], 2: ['5S', 'QD', 'AS', '2D'], 3: ['3H', '6S', 'JD', '2H'], 4: ['4H', '8S', '9D', '2S'] });
  s = play(s, 1, ['7S', '7H', '7D', '7C']);
  assert.equal(s.revolution, true);
  assert.equal(s.log.at(-1).k, 'revolution');
  // Personne ne peut suivre un carré : tout le monde passe, 1 rouvre.
  s = pass(s, 2); s = pass(s, 3); s = pass(s, 4);
  assert.equal(status(s).turn, 1);
  s = play(s, 1, ['KS']);
  throwsMsg(() => move(s, 2, { type: 'play', cards: ['AS'] }, ctx()), /plus faible ou égale/);
  assert.deepEqual(view(s, 2).playable, ['5', 'Q']);
  s = play(s, 2, ['5S']);
  s = play(s, 3, ['3H']); // le 3 est la plus forte : il ramasse et rouvre
  assert.equal(s.pli, null);
  assert.equal(status(s).turn, 3);
});

test('révolution coupée dans les réglages : un carré ne change rien', () => {
  const base = table({ 1: ['7S', '7H', '7D', '7C', 'KS'] });
  const s = play({ ...base, revolutionRule: false }, 1, ['7S', '7H', '7D', '7C']);
  assert.equal(s.revolution, false);
});
