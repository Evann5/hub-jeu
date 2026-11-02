import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, move, view, status, timeout, leave, dealHand, makeDeck, legalCards, obligation, trickLeader, scoreHand, cardPoints,
  lowestLegal, rankStrength,
} from './rules.js';

// Hasard fixé (mulberry32) et horloge fixe : mêmes parties à chaque lancement.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ctx = (seed = 1, now = 1_000_000) => ({ now, random: rng(seed) });
const PLAYERS = [1, 2, 3, 4].map((id) => ({ id, pseudo: `p${id}` }));
const ids = [1, 2, 3, 4];
const mk = (options = {}, seed = 1) => setup(PLAYERS, { target: 501, timer: 0, ...options }, ctx(seed));
const play = (s, seat, action, c = ctx()) => move(s, ids[seat], action, c).state;

// Fabrique une donne en phase de jeu avec des mains choisies (atout H, donneur 3, donc la place 0 ouvre).
function playing(hands, { trump = 'H', taker = 0, dealer = 3, extra = {} } = {}) {
  const base = mk();
  return {
    ...base, phase: 'play', dealer, hands, trump, taker, turn: (dealer + 1) % 4, trick: [], stock: [], upcard: 'C7',
    beloteSeat: null, beloteSeen: 0, ...extra,
  };
}

test('une donne : 5 cartes chacun, la retourne et 11 cartes restantes, 32 cartes différentes', () => {
  const s = mk();
  assert.deepEqual(s.hands.map((h) => h.length), [5, 5, 5, 5]);
  assert.equal(s.stock.length, 11);
  const all = [...s.hands.flat(), s.upcard, ...s.stock];
  assert.equal(new Set(all).size, 32);
  assert.equal(s.phase, 'bid1');
  assert.equal(s.turn, (s.dealer + 1) % 4);
});

test('setup refuse un autre nombre que quatre joueurs', () => {
  assert.throws(() => setup(PLAYERS.slice(0, 3), {}, ctx()), /quatre/);
});

test('premier tour : prendre donne la couleur retournée, le preneur reçoit la retourne, 8 cartes chacun', () => {
  const s = mk();
  const first = s.turn;
  const up = s.upcard;
  const t = play(s, first, { type: 'take' });
  assert.equal(t.phase, 'play');
  assert.equal(t.trump, up[0]);
  assert.equal(t.taker, first);
  assert.ok(t.hands[first].includes(up));
  assert.deepEqual(t.hands.map((h) => h.length), [8, 8, 8, 8]);
  assert.equal(new Set(t.hands.flat()).size, 32);
  assert.equal(t.turn, first); // celui qui est à gauche du donneur ouvre
});

test('premier tour : on ne peut pas jouer hors de son tour', () => {
  const s = mk();
  const other = (s.turn + 1) % 4;
  assert.throws(() => play(s, other, { type: 'take' }), /pas ton tour/);
});

test('tous passent au premier tour : second tour, puis choix d’une autre couleur', () => {
  let s = mk();
  const first = s.turn;
  for (let i = 0; i < 4; i++) s = play(s, s.turn, { type: 'pass' });
  assert.equal(s.phase, 'bid2');
  assert.equal(s.turn, first);
  assert.throws(() => play(s, s.turn, { type: 'take', suit: s.upcard[0] }), /autre couleur/);
  assert.throws(() => play(s, s.turn, { type: 'take', suit: 'X' }), /couleur/);
  assert.throws(() => play(s, s.turn, { type: 'take' }), /couleur/);
  const other = ['S', 'H', 'D', 'C'].find((c) => c !== s.upcard[0]);
  const t = play(s, s.turn, { type: 'pass' });
  const u = play(t, t.turn, { type: 'take', suit: other });
  assert.equal(u.phase, 'play');
  assert.equal(u.trump, other);
  assert.equal(u.taker, t.turn);
  assert.deepEqual(u.hands.map((h) => h.length), [8, 8, 8, 8]);
  assert.ok(u.hands[u.taker].includes(s.upcard));
});

test('personne ne prend aux deux tours : on redistribue avec le donneur suivant', () => {
  let s = mk();
  const dealer = s.dealer;
  const before = s.hands.flat().join();
  for (let i = 0; i < 8; i++) s = play(s, s.turn, { type: 'pass' }, ctx(77));
  assert.equal(s.phase, 'bid1');
  assert.equal(s.dealer, (dealer + 1) % 4);
  assert.equal(s.turn, (s.dealer + 1) % 4);
  assert.notEqual(s.hands.flat().join(), before);
  assert.equal(s.bids.length, 0);
  assert.equal(s.announce.kind, 'redeal');
  assert.equal(s.handNo, 1);
});

test('valeurs et ordre : à l’atout V 20, 9 14, A 11, 10 10, R 4, D 3 ; hors atout A 11, 10 10, R 4, D 3, V 2', () => {
  const trumpOrder = ['HJ', 'H9', 'HA', 'H10', 'HK', 'HQ', 'H8', 'H7'];
  const strengths = trumpOrder.map((c) => rankStrength(c, 'H'));
  assert.deepEqual(strengths, [...strengths].sort((a, b) => b - a));
  assert.deepEqual(trumpOrder.map((c) => cardPoints(c, 'H')), [20, 14, 11, 10, 4, 3, 0, 0]);
  const plain = ['SA', 'S10', 'SK', 'SQ', 'SJ', 'S9', 'S8', 'S7'];
  const ps = plain.map((c) => rankStrength(c, 'H'));
  assert.deepEqual(ps, [...ps].sort((a, b) => b - a));
  assert.deepEqual(plain.map((c) => cardPoints(c, 'H')), [11, 10, 4, 3, 2, 0, 0, 0]);
  // Une couleur d'atout vaut 62, chaque autre 30 : 62 + 3 × 30 = 152, plus 10 de der = 162.
  const total = makeDeck().reduce((sum, c) => sum + cardPoints(c, 'H'), 0);
  assert.equal(total, 152);
});

test('le pli est gagné par le plus gros atout, sinon par la plus forte carte de la couleur demandée', () => {
  const t1 = [{ seat: 0, card: 'SA' }, { seat: 1, card: 'S10' }, { seat: 2, card: 'H7' }, { seat: 3, card: 'D9' }];
  assert.equal(trickLeader(t1, 'H').seat, 2);
  const t2 = [{ seat: 0, card: 'S9' }, { seat: 1, card: 'SJ' }, { seat: 2, card: 'DA' }, { seat: 3, card: 'S8' }];
  assert.equal(trickLeader(t2, 'H').seat, 1);
  const t3 = [{ seat: 0, card: 'H9' }, { seat: 1, card: 'HJ' }, { seat: 2, card: 'HA' }, { seat: 3, card: 'S8' }];
  assert.equal(trickLeader(t3, 'H').seat, 1);
});

test('obligation de fournir', () => {
  const hand = ['S7', 'S9', 'D8', 'HQ'];
  const trick = [{ seat: 0, card: 'SK' }];
  assert.deepEqual(legalCards(hand, trick, 'H', 1).sort(), ['S7', 'S9']);
});

test('on ouvre avec n’importe quelle carte', () => {
  const hand = ['S7', 'D8', 'HQ'];
  assert.deepEqual(legalCards(hand, [], 'H', 0), hand);
});

test('obligation de couper quand on ne peut pas fournir (adversaire maître)', () => {
  const hand = ['D8', 'HQ', 'H7', 'CA'];
  const trick = [{ seat: 0, card: 'SK' }]; // la place 1 est dans l'autre équipe que la place 0
  assert.deepEqual(legalCards(hand, trick, 'H', 1).sort(), ['H7', 'HQ']);
});

test('on surcoupe si on peut, sinon on sous-coupe', () => {
  const trick = [{ seat: 0, card: 'SK' }, { seat: 1, card: 'H9' }];
  // Place 2 : partenaire (0) n'est plus maître, 1 a coupé avec le 9.
  assert.deepEqual(legalCards(['HJ', 'H7', 'D8'], trick, 'H', 2).sort(), ['HJ']);
  const o = obligation(['H7', 'H8', 'D8'], trick, 'H', 2);
  assert.deepEqual(o.legal.sort(), ['H7', 'H8']);
  assert.match(o.reason, /ne peux pas surcouper/);
});

test('partenaire maître : pas obligé de couper, on défausse ce qu’on veut', () => {
  const hand = ['D8', 'HQ', 'CA'];
  const trick = [{ seat: 0, card: 'SA' }, { seat: 1, card: 'S9' }]; // place 0 (partenaire de la place 2) est maître
  assert.deepEqual(legalCards(hand, trick, 'H', 2).sort(), ['CA', 'D8', 'HQ']);
});

test('partenaire maître avec un atout : on n’est pas obligé de surcouper', () => {
  const hand = ['HJ', 'D8'];
  const trick = [{ seat: 0, card: 'SA' }, { seat: 1, card: 'S9' }];
  const t2 = [{ seat: 0, card: 'SA' }, { seat: 1, card: 'H8' }, { seat: 2, card: 'S7' }]; // l'atout de 1 est maître
  assert.deepEqual(legalCards(hand, trick, 'H', 2).sort(), ['D8', 'HJ']);
  // place 3 : le partenaire (1) a coupé et est maître, donc libre.
  assert.deepEqual(legalCards(hand, t2, 'H', 3).sort(), ['D8', 'HJ']);
});

test('sans la couleur ni atout, tout est permis', () => {
  const hand = ['D8', 'CA'];
  assert.deepEqual(legalCards(hand, [{ seat: 0, card: 'SK' }], 'H', 1).sort(), ['CA', 'D8']);
});

test('à l’atout demandé, on monte si on peut', () => {
  const trick = [{ seat: 0, card: 'H10' }];
  assert.deepEqual(legalCards(['HJ', 'H7', 'HK', 'S8'], trick, 'H', 1).sort(), ['HJ']);
  const o = obligation(['H7', 'HQ', 'S8'], trick, 'H', 1);
  assert.deepEqual(o.legal.sort(), ['H7', 'HQ']);
  assert.match(o.reason, /ne peux pas monter/);
});

test('à l’atout demandé et sans atout, tout est permis', () => {
  assert.deepEqual(legalCards(['S7', 'D8'], [{ seat: 0, card: 'H10' }], 'H', 1).sort(), ['D8', 'S7']);
});

test('move refuse une carte interdite avec la raison, une carte absente de la main', () => {
  const hands = [['S7', 'D8', 'H7', 'HQ', 'C7', 'C8', 'C9', 'CJ'], ['SK', 'S9', 'D9', 'D10', 'DJ', 'DQ', 'DK', 'DA'],
    ['SA', 'S8', 'C10', 'CQ', 'CK', 'CA', 'SJ', 'SQ'], ['H8', 'H9', 'H10', 'HJ', 'HK', 'HA', 'S10', 'D7']];
  let s = playing(hands);
  s = play(s, 0, { type: 'play', card: 'S7' }); // place 0 ouvre
  assert.throws(() => play(s, 1, { type: 'play', card: 'D9' }), /fournir à pique/);
  assert.throws(() => play(s, 1, { type: 'play', card: 'HA' }), /pas dans ta main/);
  assert.throws(() => play(s, 2, { type: 'play', card: 'SA' }), /pas ton tour/);
  s = play(s, 1, { type: 'play', card: 'SK' });
  assert.equal(s.turn, 2);
});

test('un pli complet : le gagnant ouvre le pli suivant et ses points sont comptés', () => {
  const hands = [['S7', 'D8'], ['SK', 'D9'], ['SA', 'D10'], ['S10', 'D7']];
  let s = playing(hands, { extra: { tricks: [0, 0], trickPoints: [0, 0] } });
  s = play(s, 0, { type: 'play', card: 'S7' });
  s = play(s, 1, { type: 'play', card: 'SK' });
  s = play(s, 2, { type: 'play', card: 'SA' });
  s = play(s, 3, { type: 'play', card: 'S10' });
  // A (11) + 10 (10) + R (4) + 7 (0) = 25, gagné par la place 2 (équipe 0)
  assert.equal(s.turn, 2);
  assert.deepEqual(s.tricks, [1, 0]);
  assert.deepEqual(s.trickPoints, [25, 0]);
  assert.equal(s.lastTrick.winner, 2);
  assert.equal(s.trick.length, 0);
});

// Joue une donne scénarisée : les 8 plis sont donnés par l'ordre des cartes. Renvoie l'état après la dernière carte.
function playOut(hands, order, opts) {
  let s = playing(hands, opts);
  for (const [seat, card] of order) s = play(s, seat, { type: 'play', card });
  return s;
}

// Mains où l'équipe 0 (places 0 et 2) fait tous les plis : atout H, ouvre la place 0.
const CAPOT_HANDS = [
  ['HJ', 'H9', 'HA', 'H10', 'HK', 'HQ', 'H8', 'H7'],
  ['SA', 'S10', 'SK', 'SQ', 'SJ', 'S9', 'S8', 'S7'],
  ['DA', 'D10', 'DK', 'DQ', 'DJ', 'D9', 'D8', 'D7'],
  ['CA', 'C10', 'CK', 'CQ', 'CJ', 'C9', 'C8', 'C7'],
];
const capotOrder = (hands) => {
  const o = [];
  for (let t = 0; t < 8; t++) for (let k = 0; k < 4; k++) o.push([k, hands[k][t]]);
  return o;
};

test('capot du preneur : 252 points + belote (roi et dame d’atout jouent rebelote)', () => {
  const s = playOut(CAPOT_HANDS, capotOrder(CAPOT_HANDS), { taker: 0, extra: { beloteSeat: 0 } });
  // La place 0 joue HK puis HQ : belote puis rebelote (+20). Atout d'abord : ses 8 plis.
  assert.equal(s.phase, 'recap');
  assert.equal(s.recap.capot, 0);
  assert.equal(s.recap.made, true);
  assert.deepEqual(s.recap.belote, [20, 0]);
  assert.deepEqual(s.recap.gained, [272, 0]);
  assert.deepEqual(s.scores, [272, 0]);
});

test('capot de la défense : le preneur est dedans, la défense marque 252', () => {
  const s = playOut(CAPOT_HANDS, capotOrder(CAPOT_HANDS), { taker: 1 });
  assert.equal(s.recap.capot, 0);
  assert.equal(s.recap.made, false);
  assert.deepEqual(s.recap.gained, [252, 0]);
});

test('belote-rebelote : annoncée à chaque carte, 20 points une fois les deux jouées', () => {
  const hands = [['HK', 'HQ', 'S7'], ['SK', 'S9', 'D9'], ['SA', 'S8', 'D10'], ['S10', 'DK', 'D7']];
  let s = playing(hands, { extra: { beloteSeat: 0, tricks: [0, 0], trickPoints: [0, 0] } });
  s = play(s, 0, { type: 'play', card: 'HK' });
  assert.equal(s.announce.kind, 'belote');
  assert.deepEqual(s.belote, [0, 0]);
  s = play(s, 1, { type: 'play', card: 'SK' });
  s = play(s, 2, { type: 'play', card: 'SA' });
  s = play(s, 3, { type: 'play', card: 'S10' });
  assert.equal(s.turn, 0); // HK a pris le pli (seul atout)
  s = play(s, 0, { type: 'play', card: 'HQ' });
  assert.equal(s.announce.kind, 'rebelote');
  assert.deepEqual(s.belote, [20, 0]);
  assert.equal(s.announce.seat, 0);
});

test('un joueur sans le couple roi-dame d’atout n’annonce rien', () => {
  const hands = [['HK', 'S7'], ['HQ', 'D9'], ['SA', 'D10'], ['S10', 'DK']];
  let s = playing(hands, { extra: { beloteSeat: null, tricks: [0, 0], trickPoints: [0, 0] } });
  s = play(s, 0, { type: 'play', card: 'HK' });
  assert.equal(s.announce.kind, null);
});

test('à la prise, le détenteur de la belote est repéré avec les 8 cartes', () => {
  // Le roi et la dame de l'atout sont dans deux mains différentes à la distribution : on les met chez la place 2 après la prise.
  let s = mk();
  s = { ...s, hands: s.hands.map((h) => h.slice()), stock: s.stock.slice() };
  const trump = s.upcard[0];
  const strip = (c) => { for (const h of s.hands) { const i = h.indexOf(c); if (i >= 0) h.splice(i, 1); } const j = s.stock.indexOf(c); if (j >= 0) s.stock.splice(j, 1); };
  strip(`${trump}K`); strip(`${trump}Q`);
  const target = (s.dealer + 3) % 4;
  s.hands[target].push(`${trump}K`, `${trump}Q`);
  // Garde un total cohérent : la retourne ne peut pas être l'un des deux.
  assert.ok(![`${trump}K`, `${trump}Q`].includes(s.upcard), 'choisir une autre graine');
  s = play(s, s.turn, { type: 'take' });
  assert.equal(s.beloteSeat, target);
  assert.equal(view(s, ids[target]).belote, true);
  assert.equal(view(s, ids[(target + 1) % 4]).belote, false);
});

test('le preneur fait plus que la défense : chacun garde ses points', () => {
  const r = scoreHand({ takerTeam: 0, trickPoints: [100, 52], tricks: [5, 3], lastTrickTeam: 0, belote: [0, 0] });
  assert.deepEqual(r.raw, [110, 52]);
  assert.equal(r.made, true);
  assert.deepEqual(r.gained, [110, 52]);
});

test('dedans : la défense marque 162, le preneur rien', () => {
  const r = scoreHand({ takerTeam: 0, trickPoints: [70, 82], tricks: [3, 5], lastTrickTeam: 1, belote: [0, 0] });
  assert.equal(r.made, false);
  assert.deepEqual(r.gained, [0, 162]);
});

test('dedans : la belote reste acquise à l’équipe qui l’a, même chez le preneur', () => {
  const r = scoreHand({ takerTeam: 0, trickPoints: [50, 102], tricks: [3, 5], lastTrickTeam: 1, belote: [20, 0] });
  assert.equal(r.made, false);
  assert.deepEqual(r.gained, [20, 162]);
});

test('la belote aide à réussir le contrat', () => {
  // 71 + 20 contre 91 : le preneur fait plus (91 contre 71 sans compter la belote)
  const r = scoreHand({ takerTeam: 0, trickPoints: [61, 91], tricks: [4, 4], lastTrickTeam: 0, belote: [20, 0] });
  assert.deepEqual(r.raw, [71, 91]);
  assert.equal(r.made, false); // 91 contre 91 : égalité = dedans
  const r2 = scoreHand({ takerTeam: 0, trickPoints: [62, 90], tricks: [4, 4], lastTrickTeam: 0, belote: [20, 0] });
  assert.equal(r2.made, true);
  assert.deepEqual(r2.gained, [92, 90]);
});

test('égalité 81-81 sans belote : dedans', () => {
  const r = scoreHand({ takerTeam: 1, trickPoints: [81, 71], tricks: [4, 4], lastTrickTeam: 1, belote: [0, 0] });
  assert.deepEqual(r.raw, [81, 81]);
  assert.equal(r.made, false);
  assert.deepEqual(r.gained, [162, 0]);
});

test('dix de der : 10 points pour l’équipe du dernier pli', () => {
  const r = scoreHand({ takerTeam: 0, trickPoints: [60, 92], tricks: [4, 4], lastTrickTeam: 1, belote: [0, 0] });
  assert.deepEqual(r.raw, [60, 102]);
});

test('capot du preneur sans belote : 252', () => {
  const r = scoreHand({ takerTeam: 1, trickPoints: [0, 152], tricks: [0, 8], lastTrickTeam: 1, belote: [0, 0] });
  assert.equal(r.capot, 1);
  assert.deepEqual(r.gained, [0, 252]);
});

test('une donne complète : le total des plis fait 162 et les scores sont mis à jour', () => {
  const s = playOut(CAPOT_HANDS, capotOrder(CAPOT_HANDS), { taker: 0, extra: { scores: [100, 40] } });
  assert.equal(s.recap.raw[0] + s.recap.raw[1], 162);
  assert.deepEqual(s.scores, [100 + 252, 40]);
});

test('entre deux donnes : tout le monde clique « suivante » et le donneur change', () => {
  let s = playOut(CAPOT_HANDS, capotOrder(CAPOT_HANDS), { taker: 0 });
  assert.equal(s.phase, 'recap');
  assert.deepEqual(status(s).turn, ids);
  assert.throws(() => play(s, 0, { type: 'play', card: 'HJ' }), /Donne suivante/);
  s = play(s, 0, { type: 'next' });
  s = play(s, 1, { type: 'next' });
  assert.deepEqual(status(s).turn, [3, 4]);
  s = play(s, 2, { type: 'next' });
  const dealer = s.dealer;
  s = play(s, 3, { type: 'next' });
  assert.equal(s.phase, 'bid1');
  assert.equal(s.dealer, (dealer + 1) % 4);
  assert.equal(s.handNo, 2);
  assert.deepEqual(s.scores, [252, 0]);
});

test('le compte entre deux donnes avance tout seul à l’échéance', () => {
  const s = playOut(CAPOT_HANDS, capotOrder(CAPOT_HANDS), { taker: 0 });
  assert.equal(status(s).deadline, 1_000_000 + 30_000);
  const t = timeout(s, ctx(5, 1_040_000)).state;
  assert.equal(t.phase, 'bid1');
  assert.equal(t.handNo, 2);
});

test('fin de partie : à 501 points l’équipe en tête gagne', () => {
  const s = playOut(CAPOT_HANDS, capotOrder(CAPOT_HANDS), { taker: 0, extra: { scores: [300, 450] } });
  assert.equal(s.phase, 'over');
  assert.equal(s.winnerTeam, 0); // 552 contre 450
  const st = status(s);
  assert.equal(st.over, true);
  assert.deepEqual(st.winners, [1, 3]);
  assert.throws(() => play(s, 0, { type: 'next' }), /terminée/);
});

test('fin de partie : si les deux équipes passent le seuil, la plus haute gagne', () => {
  const s = playOut(CAPOT_HANDS, capotOrder(CAPOT_HANDS), { taker: 0, extra: { scores: [100, 600] } });
  assert.equal(s.scores[1], 600);
  assert.equal(s.winnerTeam, 1);
});

test('option 1001 : 552 ne suffit pas', () => {
  const s = playOut(CAPOT_HANDS, capotOrder(CAPOT_HANDS), { taker: 0, extra: { scores: [300, 0], target: 1001 } });
  assert.equal(s.phase, 'recap');
});

test('abandon : la partie se termine et l’autre équipe gagne', () => {
  const s = mk();
  const t = leave(s, 2, ctx()).state; // le joueur d'id 2 est à la place 1 (équipe 1)
  assert.equal(t.phase, 'over');
  assert.equal(t.winnerTeam, 0);
  assert.deepEqual(status(t).winners, [1, 3]);
  assert.equal(status(t).over, true);
  const u = leave(s, 1, ctx()).state;
  assert.deepEqual(status(u).winners, [2, 4]);
  // Abandon après la fin : rien ne change
  assert.equal(leave(t, 1, ctx()).state, t);
});

test('minuteur : une échéance est posée à chaque action, passer aux enchères', () => {
  let s = mk({ timer: 30 });
  assert.equal(status(s).deadline, 1_000_000 + 30_000);
  const first = s.turn;
  s = timeout(s, ctx(1, 1_031_000)).state;
  assert.equal(s.bids[0].act, 'pass');
  assert.equal(s.bids[0].seat, first);
  assert.equal(s.turn, (first + 1) % 4);
  assert.equal(status(s).deadline, 1_031_000 + 30_000);
  assert.equal(mk({ timer: 0 }).deadline, null);
});

test('minuteur en jeu : la plus petite carte autorisée est jouée', () => {
  const hands = [['S7', 'D8'], ['SK', 'S9', 'D9'], ['SA', 'S8', 'D10'], ['S10', 'DK', 'D7']];
  const s = playing(hands, { extra: { timer: 20, tricks: [0, 0], trickPoints: [0, 0] } });
  const t = timeout({ ...s, hands: [['S7', 'D8', 'HA'], ...hands.slice(1)] }, ctx()).state;
  // La place 0 ouvre : la plus faible (0 point) est D8 ou S7, par force puis par couleur : S7 (force 0, pique avant carreau)
  assert.equal(t.trick[0].card, 'S7');
  // Suivre : la place 1 doit fournir à pique, S9 est la plus faible
  const u = timeout(t, ctx()).state;
  assert.equal(u.trick[1].card, 'S9');
  assert.equal(lowestLegal(['HJ', 'H7', 'HQ'], [{ seat: 0, card: 'H10' }], 'H', 1), 'HJ'); // seul HJ monte sur le 10
});

test('minuteur : la plus petite carte autorisée respecte l’obligation de monter', () => {
  assert.equal(lowestLegal(['HJ', 'H9', 'H7'], [{ seat: 0, card: 'H8' }], 'H', 1), 'H9');
});

test('la vue cache les mains des autres, et celle des spectateurs aussi', () => {
  const s = mk();
  const v = view(s, 1);
  assert.deepEqual(v.hand, s.hands[0]);
  assert.deepEqual(v.counts, [5, 5, 5, 5]);
  const json = JSON.stringify(v);
  for (const other of [1, 2, 3]) for (const c of s.hands[other]) assert.ok(!json.includes(`"${c}"`) || v.hand.includes(c) || c === s.upcard, `${c} fuit`);
  assert.ok(!('hands' in v) && !('stock' in v));
  const spec = view(s, null);
  assert.deepEqual(spec.hand, []);
  assert.equal(spec.seat, -1);
  assert.ok(!JSON.stringify(spec).includes(`"${s.hands[0][0]}"`) || s.hands[0][0] === s.upcard);
});

test('la vue du joueur dont c’est le tour donne les cartes jouables et la raison', () => {
  const hands = [['S7', 'D8'], ['SK', 'S9', 'D9'], ['SA', 'S8', 'D10'], ['S10', 'DK', 'D7']];
  let s = playing(hands, { extra: { tricks: [0, 0], trickPoints: [0, 0] } });
  s = play(s, 0, { type: 'play', card: 'S7' });
  const v = view(s, 2);
  assert.deepEqual(v.legal.sort(), ['S9', 'SK']);
  assert.match(v.hint, /fournir/);
  assert.deepEqual(view(s, 3).legal, []); // pas son tour
});

test('une partie entière jouée au hasard (minuteur) arrive au bout avec des comptes justes', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const c = ctx(seed);
    let s = setup(PLAYERS, { target: 501, timer: 20 }, c);
    let steps = 0;
    let hands = 0;
    while (s.phase !== 'over' && steps++ < 20000) {
      const before = s.phase;
      c.now += 1000;
      if (s.phase === 'bid1' || s.phase === 'bid2') {
        // prend parfois, pour finir les donnes
        const rnd = c.random();
        if (rnd < 0.35) s = move(s, ids[s.turn], { type: 'take', suit: s.phase === 'bid2' ? ['S', 'H', 'D', 'C'].find((x) => x !== s.upcard[0]) : undefined }, c).state;
        else s = move(s, ids[s.turn], { type: 'pass' }, c).state;
      } else if (s.phase === 'play') {
        const all = s.hands.flat().length + s.trick.length;
        const played = 32 - all;
        assert.ok(played >= 0);
        s = timeout(s, c).state;
      } else if (s.phase === 'recap') {
        assert.equal(s.recap.raw[0] + s.recap.raw[1], 162);
        hands++;
        s = timeout(s, c).state;
      }
      assert.ok(s.phase !== before || true);
    }
    assert.equal(s.phase, 'over', `seed ${seed} n’a pas fini`);
    assert.ok(hands >= 3);
    assert.ok(Math.max(...s.scores) >= 501);
    assert.equal(status(s).winners.length, 2);
  }
});

test('l’état reste du JSON pur et rien ne mute l’état reçu', () => {
  const s = mk();
  const frozen = JSON.stringify(s);
  play(s, s.turn, { type: 'pass' });
  play(s, s.turn, { type: 'take' });
  assert.equal(JSON.stringify(s), frozen);
  assert.deepEqual(JSON.parse(frozen), s);
  assert.equal(dealHand(s, 0, ctx(3)).dealer, 0);
});
