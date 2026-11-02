// Tests des règles des Échecs : node --test games/echecs/*.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, status, view, timeout, leave, fromFen, legalMoves, perft, insufficientMaterial, squareName } from './rules.js';

const players = [{ id: 1, pseudo: 'ana' }, { id: 2, pseudo: 'bob' }];
const T0 = 1_000_000;
const ctx = (now = T0, random = () => 0) => ({ now, random });
const sq = (name) => 'abcdefgh'.indexOf(name[0]) + (Number(name[1]) - 1) * 8;
const FRESH = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const game = (fen = FRESH, options = {}) => fromFen(fen, [1, 2], options, ctx());
const posOf = (s) => ({ board: s.board, turn: s.turn, castling: s.castling, ep: s.ep });

// « e2e4 », « a7a8q » : joue un coup pour la couleur qui a le trait.
function go(s, text, now = T0) {
  const [from, to] = [text.slice(0, 2), text.slice(2, 4)];
  const action = { type: 'move', from: sq(from), to: sq(to) };
  if (text[4]) action.promo = text[4];
  return move(s, s.players[s.turn], action, ctx(now)).state;
}
const line = (s, text) => text.split(/\s+/).filter(Boolean).reduce((acc, m) => go(acc, m), s);
const refused = (s, text, pattern) => assert.throws(() => go(s, text), pattern);

test('perft : le générateur de coups donne les nombres de référence connus', () => {
  const cases = [
    [FRESH, [20, 400, 8902]],
    ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]], // roques, prises, clouages
    ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812]], // en passant et échecs à la découverte
    ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]], // promotions
    ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
    ['r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]],
  ];
  for (const [fen, counts] of cases) {
    const p = posOf(game(fen));
    counts.forEach((n, i) => assert.equal(perft(p, i + 1), n, `${fen} profondeur ${i + 1}`));
  }
});

test('la partie commence : blancs au trait, 20 coups, pas de pendule sans option', () => {
  const s = setup(players, {}, ctx());
  assert.deepEqual(s.players, [1, 2]);
  assert.equal(s.turn, 0);
  assert.equal(legalMoves(posOf(s)).length, 20);
  assert.deepEqual(status(s), { turn: 1, over: false, winners: [], deadline: null });
});

test('la couleur est tirée au sort avec ctx.random', () => {
  assert.deepEqual(setup(players, {}, ctx(T0, () => 0.1)).players, [1, 2]);
  assert.deepEqual(setup(players, {}, ctx(T0, () => 0.9)).players, [2, 1]);
});

test("l'état reçu n'est jamais modifié", () => {
  const s = game();
  const copy = JSON.stringify(s);
  go(s, 'e2e4');
  assert.equal(JSON.stringify(s), copy);
});

test('mat du berger : e4 e5 Dh5 Cc6 Fc4 Cf6 Dxf7#', () => {
  const s = line(game(), 'e2e4 e7e5 d1h5 b8c6 f1c4 g8f6 h5f7');
  assert.deepEqual(status(s), { turn: null, over: true, winners: [1], deadline: null });
  assert.deepEqual(s.result, { winner: 0, reason: 'mate' });
  assert.deepEqual(s.moves, ['e4', 'e5', 'Dh5', 'Cc6', 'Fc4', 'Cf6', 'Dxf7#']);
  assert.equal(view(s, 2).check, sq('e8'));
  assert.throws(() => move(s, 2, { type: 'move', from: sq('e8'), to: sq('f7') }, ctx()), /terminée/);
});

test('mat du fou : le mat des noirs gagne pour les noirs', () => {
  const s = line(game(), 'f2f3 e7e5 g2g4 d8h4');
  assert.deepEqual(s.result, { winner: 1, reason: 'mate' });
  assert.deepEqual(status(s).winners, [2]);
  assert.equal(s.moves.at(-1), 'Dh4#');
});

test('mat du couloir et mat à la tour', () => {
  const s = line(game('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1'), 'a1a8');
  assert.deepEqual(s.result, { winner: 0, reason: 'mate' });
});

test("le roi en échec doit parer : un coup qui l'ignore est refusé", () => {
  const s = game('4r2k/8/8/8/8/8/4R3/R3K3 w - - 0 1'); // la tour blanche en e2 protège le roi : pas d'échec, tout est permis
  assert.equal(go(s, 'a1a2').board[sq('a2')], 'R');
  const check = game('4r2k/8/8/8/8/8/8/R3K3 w - - 0 1'); // échec : il faut parer
  refused(check, 'a1a2', /roi en échec/);
  assert.equal(go(check, 'e1d1').board[sq('d1')], 'K');
  const p = game('4k3/4r3/8/8/8/8/PP6/R3K3 w - - 0 1'); // en échec : aucun coup de pion n'est légal
  assert.equal(legalMoves(posOf(p)).some((m) => m.piece === 'P'), false);
});

test('une pièce clouée ne peut pas bouger hors de la ligne', () => {
  const s = game('4r1k1/8/8/8/8/8/4B3/4K3 w - - 0 1');
  refused(s, 'e2d3', /roi en échec/);
});

test('coups refusés : mauvais tour, case vide, pièce adverse, déplacement impossible, case inconnue', () => {
  const s = game();
  assert.throws(() => move(s, 2, { type: 'move', from: sq('e7'), to: sq('e5') }, ctx()), /pas ton tour/);
  refused(s, 'e4e5', /aucune pièce/);
  refused(s, 'e7e5', /pas à toi/);
  refused(s, 'e2e5', /ne peut pas aller là/);
  refused(s, 'a1a3', /ne peut pas aller là/); // la tour est bloquée par son pion
  assert.throws(() => move(s, 1, { type: 'move', from: 64, to: 2 }, ctx()), /Case inconnue/);
  assert.throws(() => move(s, 1, { type: 'move', from: 'e2', to: 'e4' }, ctx()), /Case inconnue/);
  assert.throws(() => move(s, 1, { type: 'xyz' }, ctx()), /Action inconnue/);
  assert.throws(() => move(s, 9, { type: 'move', from: 8, to: 16 }, ctx()), /ne joues pas/);
});

test('petit roque et grand roque : le roi et la tour se déplacent, les droits disparaissent', () => {
  let s = go(game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'e1g1');
  assert.equal(s.board[sq('g1')], 'K');
  assert.equal(s.board[sq('f1')], 'R');
  assert.equal(s.board[sq('h1')], null);
  assert.equal(s.castling, 'kq');
  assert.equal(s.moves[0], 'O-O');
  s = go(s, 'e8c8');
  assert.equal(s.board[sq('c8')], 'k');
  assert.equal(s.board[sq('d8')], 'r');
  assert.equal(s.board[sq('a8')], null);
  assert.equal(s.castling, '');
  assert.equal(s.moves[1], 'O-O-O');
});

test('roque interdit : case traversée attaquée, roi en échec, case d’arrivée attaquée', () => {
  refused(game('5r1k/8/8/8/8/8/8/R3K2R w KQ - 0 1'), 'e1g1', /ne peut pas aller là/); // f1 attaquée
  assert.equal(go(game('5r1k/8/8/8/8/8/8/R3K2R w KQ - 0 1'), 'e1c1').board[sq('c1')], 'K'); // l'autre roque reste permis
  refused(game('4r2k/8/8/8/8/8/8/R3K2R w KQ - 0 1'), 'e1g1', /(ne peut pas aller là|roi)/); // roi en échec
  refused(game('4r2k/8/8/8/8/8/8/R3K2R w KQ - 0 1'), 'e1c1', /(ne peut pas aller là|roi)/);
  refused(game('6rk/8/8/8/8/8/8/R3K2R w KQ - 0 1'), 'e1g1', /ne peut pas aller là/); // g1 attaquée
});

test('roque autorisé quand seule la tour passe sur une case attaquée', () => {
  const s = game('1r5k/8/8/8/8/8/8/R3K2R w KQ - 0 1'); // b1 est attaquée, mais seule la tour la traverse
  assert.equal(go(s, 'e1c1').board[sq('c1')], 'K');
});

test('roque interdit : cases occupées entre le roi et la tour', () => {
  refused(game('7k/8/8/8/8/8/8/RN2K2R w KQ - 0 1'), 'e1c1', /ne peut pas aller là/);
  refused(game('7k/8/8/8/8/8/8/R3KB1R w KQ - 0 1'), 'e1g1', /ne peut pas aller là/);
});

test('roque interdit après que le roi ou la tour a bougé, même revenus en place', () => {
  let s = game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  s = line(s, 'h1h2 a8a7 h2h1 a7a8'); // la tour h1 a bougé, la tour a8 aussi
  assert.equal(s.castling, 'Qk');
  refused(s, 'e1g1', /ne peut pas aller là/);
  assert.equal(go(s, 'e1c1').board[sq('c1')], 'K');
  let t = line(game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'e1e2 e8e7 e2e1 e7e8');
  assert.equal(t.castling, '');
  refused(t, 'e1g1', /ne peut pas aller là/);
});

test('prendre une tour dans son coin retire le droit au roque', () => {
  const s = go(game('r3k2r/8/8/8/8/8/6B1/R3K2R w KQkq - 0 1'), 'g2a8');
  assert.equal(s.castling, 'KQk');
});

test('prise en passant : seulement juste après le double pas', () => {
  const s = line(game(), 'e2e4 a7a6 e4e5 d7d5');
  assert.equal(s.ep, sq('d6'));
  const t = go(s, 'e5d6');
  assert.equal(t.board[sq('d6')], 'P');
  assert.equal(t.board[sq('d5')], null);
  assert.equal(t.moves.at(-1), 'exd6');
  // trop tard : un autre coup a été joué entre-temps
  const late = line(game(), 'e2e4 a7a6 e4e5 d7d5 g1f3 a6a5');
  assert.equal(late.ep, null);
  refused(late, 'e5d6', /ne peut pas aller là/);
});

test('en passant pour les noirs', () => {
  const s = line(game(), 'a2a3 d7d5 a3a4 d5d4 e2e4');
  assert.equal(s.ep, sq('e3'));
  const t = go(s, 'd4e3');
  assert.equal(t.board[sq('e3')], 'p');
  assert.equal(t.board[sq('e4')], null);
});

test("prise en passant interdite si elle découvre le roi sur la rangée", () => {
  const s = game('7k/8/8/KPp4r/8/8/8/8 w - c6 0 1');
  refused(s, 'b5c6', /roi en échec/);
});

test('promotion : la pièce est demandée, puis posée (majuscule ou minuscule)', () => {
  const s = game('8/P6k/8/8/8/8/8/K7 w - - 0 1');
  refused(s, 'a7a8', /Choisis la pièce de promotion/);
  refused(s, 'a7a8k', /Choisis la pièce de promotion/);
  const queen = go(s, 'a7a8q');
  assert.equal(queen.board[sq('a8')], 'Q');
  assert.equal(queen.moves[0], 'a8=D');
  const knight = go(s, 'a7a8n');
  assert.equal(knight.board[sq('a8')], 'N');
  assert.equal(knight.moves[0], 'a8=C');
  assert.equal(go(s, 'a7a8R').board[sq('a8')], 'R');
  assert.equal(view(s, 1).promos.includes(`${sq('a7')}-${sq('a8')}`), true);
});

test('promotion avec prise, pour les noirs, et promotion qui donne mat', () => {
  const s = game('4k3/8/8/8/8/8/p7/1R2K3 b - - 0 1');
  const t = go(s, 'a2b1q');
  assert.equal(t.board[sq('b1')], 'q');
  assert.equal(t.moves[0], 'axb1=D+');
  const promoMate = go(game('7k/1P6/6K1/8/8/8/8/8 w - - 0 1'), 'b7b8q');
  assert.equal(promoMate.moves[0], 'b8=D#');
  assert.equal(promoMate.result.reason, 'mate');
});

test('pat : la partie est nulle', () => {
  const s = go(game('k7/2K5/8/2Q5/8/8/8/8 w - - 0 1'), 'c5b6');
  assert.deepEqual(s.result, { winner: null, reason: 'stalemate' });
  assert.deepEqual(status(s), { turn: null, over: true, winners: [], deadline: null });
});

test('matériel insuffisant : roi seul, roi + cavalier, roi + fou, fous de même couleur', () => {
  const s = go(game('7k/8/8/8/8/8/3n4/K1B5 w - - 0 1'), 'c1d2');
  assert.deepEqual(s.result, { winner: null, reason: 'insufficient' });
  const b = (fen) => insufficientMaterial(game(fen).board);
  assert.equal(b('7k/8/8/8/8/8/8/K7 w - - 0 1'), true);
  assert.equal(b('7k/8/8/8/8/8/8/KN6 w - - 0 1'), true);
  assert.equal(b('7k/8/8/8/8/8/8/KB6 w - - 0 1'), true);
  assert.equal(b('7k/8/8/8/8/8/6b1/KB6 w - - 0 1'), true); // b1 et g2 : même couleur de case
  assert.equal(b('7k/8/8/8/8/8/5b2/KB6 w - - 0 1'), false); // f2 est de l'autre couleur
  assert.equal(b('7k/8/8/8/8/8/8/KNN5 w - - 0 1'), false);
  assert.equal(b('7k/8/8/8/8/8/8/KNn5 w - - 0 1'), false);
  assert.equal(b('7k/8/8/8/8/8/P7/K7 w - - 0 1'), false);
  assert.equal(b('7k/8/8/8/8/8/8/KR6 w - - 0 1'), false);
});

test('règle des 50 coups : 100 demi-coups sans prise ni pion', () => {
  const s = go(game('4k3/8/8/8/8/8/8/R3K3 w - - 98 80'), 'a1a2');
  assert.equal(s.result, null);
  assert.equal(s.half, 99);
  const t = go(s, 'e8d8');
  assert.deepEqual(t.result, { winner: null, reason: 'fifty' });
});

test('un coup de pion ou une prise remet le compteur des 50 coups à zéro', () => {
  assert.equal(go(game('4k3/8/8/8/8/8/P7/R3K3 w - - 99 80'), 'a2a4').half, 0);
  assert.equal(go(game('4k3/8/8/8/8/r7/8/R3K3 w - - 99 80'), 'a1a3').half, 0);
});

test('le mat gagne même au 100e demi-coup', () => {
  const s = go(game('6k1/5ppp/8/8/8/8/8/R3K3 w - - 99 80'), 'a1a8');
  assert.deepEqual(s.result, { winner: 0, reason: 'mate' });
});

test('triple répétition : nulle à la troisième apparition de la position', () => {
  let s = game();
  s = line(s, 'g1f3 g8f6 f3g1 f6g8');
  assert.equal(s.result, null);
  s = line(s, 'g1f3 g8f6 f3g1');
  assert.equal(s.result, null);
  s = go(s, 'f6g8');
  assert.deepEqual(s.result, { winner: null, reason: 'repetition' });
});

test('la répétition ne compte pas si les droits de roque ont changé', () => {
  let s = game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  s = line(s, 'h1h2 h8h7 h2h1 h7h8 a1a2 a8a7 a2a1 a7a8 e1e2 e8e7 e2e1 e7e8');
  assert.equal(s.result, null);
});

test('nulle par accord : proposition, puis acceptation par l’autre', () => {
  let s = game();
  assert.throws(() => move(s, 2, { type: 'draw-offer' }, ctx()), /pas ton tour/);
  assert.throws(() => move(s, 1, { type: 'draw-accept' }, ctx()), /Personne/);
  s = move(s, 1, { type: 'draw-offer' }, ctx()).state;
  assert.equal(s.offer, 0);
  assert.throws(() => move(s, 1, { type: 'draw-offer' }, ctx()), /déjà envoyée/);
  s = go(s, 'e2e4'); // elle reste en attente
  assert.equal(s.offer, 0);
  assert.equal(view(s, 2).offer, 0);
  assert.throws(() => move(s, 2, { type: 'draw-offer' }, ctx()), /accepte ou refuse/);
  const done = move(s, 2, { type: 'draw-accept' }, ctx()).state;
  assert.deepEqual(done.result, { winner: null, reason: 'agreement' });
  assert.deepEqual(status(done).winners, []);
});

test('nulle refusée : refuser ou jouer efface la proposition', () => {
  let s = move(game(), 1, { type: 'draw-offer' }, ctx()).state;
  s = go(s, 'e2e4');
  const declined = move(s, 2, { type: 'draw-decline' }, ctx()).state;
  assert.equal(declined.offer, null);
  assert.equal(go(s, 'e7e5').offer, null); // jouer vaut refus
  assert.equal(go(declined, 'e7e5').result, null);
});

test('pendule : le temps passe, le délai est la fin du temps de celui qui joue', () => {
  const s = game(FRESH, { clock: 5 });
  assert.equal(s.clock.ms[0], 300000);
  assert.equal(status(s).deadline, T0 + 300000);
  const t = go(s, 'e2e4', T0 + 10000);
  assert.deepEqual(t.clock, { ms: [290000, 300000], since: T0 + 10000 });
  assert.equal(status(t).deadline, T0 + 10000 + 300000);
  const u = go(t, 'e7e5', T0 + 25000);
  assert.deepEqual(u.clock, { ms: [290000, 285000], since: T0 + 25000 });
  assert.equal(status(u).deadline, T0 + 25000 + 290000);
});

test('défaite au temps : le minuteur appelle timeout()', () => {
  const s = game(FRESH, { clock: 5 });
  const t = timeout(s, ctx(T0 + 300000)).state;
  assert.deepEqual(t.result, { winner: 1, reason: 'time' });
  assert.deepEqual(status(t).winners, [2]);
  assert.equal(timeout(game(), ctx()).state.result, null); // sans pendule, rien ne se passe
});

test('un coup joué après la fin du temps est une défaite au temps', () => {
  const s = game(FRESH, { clock: 5 });
  const t = go(s, 'e2e4', T0 + 300001);
  assert.deepEqual(t.result, { winner: 1, reason: 'time' });
  assert.equal(t.board[sq('e4')], null);
});

test('défaite au temps mais adversaire sans matériel pour mater : nulle', () => {
  const s = game('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', { clock: 5 });
  assert.deepEqual(timeout(s, ctx(T0 + 300000)).state.result, { winner: null, reason: 'time-insufficient' });
  const withPawn = game('4k3/p7/8/8/8/8/8/R3K3 w - - 0 1', { clock: 5 });
  assert.deepEqual(timeout(withPawn, ctx(T0 + 300000)).state.result, { winner: 1, reason: 'time' });
  const oneBishop = game('4k3/8/8/8/8/8/8/R3KB2 b - - 0 1', { clock: 5 });
  assert.deepEqual(timeout(oneBishop, ctx(T0 + 300000)).state.result, { winner: 0, reason: 'time' });
});

test('abandon : l’autre gagne', () => {
  const s = leave(game(), 1).state;
  assert.deepEqual(s.result, { winner: 1, reason: 'resign' });
  assert.deepEqual(status(s).winners, [2]);
  assert.deepEqual(leave(game(), 2).state.result, { winner: 0, reason: 'resign' });
  const done = leave(s, 2).state; // déjà fini : rien ne change
  assert.deepEqual(done.result, { winner: 1, reason: 'resign' });
});

test('notation : désambiguïsation, prise, échec', () => {
  const s = go(game('4k3/8/8/8/R6R/8/8/4K3 w - - 0 1'), 'a4e4');
  assert.equal(s.moves[0], 'Tae4+');
  const t = go(game('4k3/8/8/8/R6R/8/8/4K3 w - - 0 1'), 'h4e4');
  assert.equal(t.moves[0], 'The4+');
  const u = go(game('4k3/8/8/8/R7/8/8/R3K3 w - - 0 1'), 'a1a3');
  assert.equal(u.moves[0], 'T1a3');
  const v = go(game('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1'), 'e4d5');
  assert.equal(v.moves[0], 'exd5');
  assert.equal(squareName(sq('h8')), 'h8');
});

test('vue : coups légaux de départ, rien de caché, spectateur', () => {
  const s = game();
  const v = view(s, 1);
  assert.equal(v.you, 0);
  assert.equal(view(s, 2).you, 1);
  assert.equal(view(s, null).you, null);
  assert.equal(Object.keys(v.legal).length, 10);
  assert.deepEqual(v.legal[sq('e2')].sort((a, b) => a - b), [sq('e3'), sq('e4')]);
  assert.equal(v.check, null);
  const mate = line(game(), 'f2f3 e7e5 g2g4 d8h4');
  assert.deepEqual(view(mate, 1).legal, {});
  assert.equal(view(mate, 1).check, sq('e1'));
  assert.equal(view(go(game(), 'e2e4'), 2).last.join(), `${sq('e2')},${sq('e4')}`);
});

test('échec : la vue indique la case du roi attaqué', () => {
  const s = go(game('4k3/8/8/8/8/8/4R3/4K3 w - - 0 1'), 'e2e7');
  assert.equal(view(s, 2).check, sq('e8'));
});

test("l'état tient en JSON", () => {
  const s = line(game(), 'e2e4 e7e5 g1f3');
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});
