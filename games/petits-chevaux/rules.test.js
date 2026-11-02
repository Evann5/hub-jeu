// Tests des règles des Petits chevaux : node --test games/petits-chevaux/*.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, status, view, timeout, leave, legalMoves, absOf } from './rules.js';

const T0 = 1_000_000;
const P = [{ id: 1, pseudo: 'ana' }, { id: 2, pseudo: 'bob' }, { id: 3, pseudo: 'cle' }, { id: 4, pseudo: 'dan' }];

// Hasard fixé : chaque appel rend le dé suivant de la liste (1 à 6).
function dice(...values) {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)];
    i++;
    return (v - 1) / 6 + 0.01;
  };
}
const ctx = (...values) => ({ now: T0, random: dice(...values) });
const start = (n = 2, options = {}) => setup(P.slice(0, n), options, ctx());
const roll = (s, id, ...values) => move(s, id, { type: 'roll' }, ctx(...values)).state;
const pick = (s, id, horse) => move(s, id, { type: 'move', horse }, ctx()).state;
// Place des chevaux directement : with(s, { 0: [1, 0, 0, 0] }, { turn: 0 })
const withPos = (s, pos, extra = {}) => {
  const rows = s.pos.map((row, seat) => pos[seat] || row);
  const turn = extra.turn ?? s.turn;
  return { ...s, pos: rows, tries: rows[turn].some((p) => p > 0 && p < 62) ? 1 : 3, ...extra };
};

test('2 joueurs se font face, 3 et 4 prennent les couleurs dans l’ordre', () => {
  assert.deepEqual(start(2).colors, [0, 2]);
  assert.deepEqual(start(3).colors, [0, 1, 2]);
  assert.deepEqual(start(4).colors, [0, 1, 2, 3]);
});

test('au départ : tous les chevaux à l’écurie, le premier joueur lance, trois essais', () => {
  const s = start(3);
  assert.deepEqual(s.pos, [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  assert.deepEqual(status(s), { turn: 1, over: false, winners: [], deadline: null });
  assert.equal(s.phase, 'roll');
  assert.equal(s.tries, 3);
});

test('les cases du circuit : départ de chaque couleur, tour complet, échelle à part', () => {
  assert.deepEqual([0, 1, 2, 3].map((c) => absOf(c, 1)), [0, 14, 28, 42]);
  assert.equal(absOf(0, 56), 55);
  assert.equal(absOf(1, 56), 13);
  assert.equal(absOf(1, 43), 0); // la couleur 1 passe sur la case 0 après 43 pas
});

test("l'état reçu n'est jamais modifié", () => {
  const s = start();
  const copy = JSON.stringify(s);
  roll(s, 1, 6);
  assert.equal(JSON.stringify(s), copy);
});

test('trois essais pour sortir un 6 quand tous les chevaux sont à l’écurie, puis on passe', () => {
  let s = start();
  s = roll(s, 1, 2);
  assert.equal(s.turn, 0);
  assert.equal(s.tries, 2);
  assert.deepEqual(s.last, { seat: 0, die: 2, horse: null, from: null, to: null, captured: null, auto: false });
  s = roll(s, 1, 5);
  assert.equal(s.turn, 0);
  assert.equal(s.tries, 1);
  s = roll(s, 1, 1);
  assert.equal(s.turn, 1); // c'est à bob
  assert.equal(s.tries, 3);
  assert.deepEqual(s.pos, [[0, 0, 0, 0], [0, 0, 0, 0]]);
});

test('un 6 sort un cheval sur la case de départ et fait rejouer', () => {
  let s = start();
  s = roll(s, 1, 6);
  assert.deepEqual(s.pos[0], [1, 0, 0, 0]);
  assert.equal(s.turn, 0); // rejoue
  assert.equal(s.phase, 'roll');
  assert.equal(s.tries, 1); // un cheval est sur le circuit : un seul essai ensuite
  assert.equal(s.last.auto, true);
});

test('sans cheval sur le circuit, un 6 ne laisse pas choisir entre chevaux identiques', () => {
  const s = withPos(start(), {}, { die: 6 });
  assert.equal(legalMoves(s).length, 1);
});

test('avec un cheval sorti et un autre à l’écurie, un 6 donne le choix : sortir ou avancer', () => {
  const s0 = withPos(start(), { 0: [5, 0, 0, 0] });
  const s = roll(s0, 1, 6);
  assert.equal(s.phase, 'choose');
  assert.deepEqual(view(s, 1).choices.map((c) => [c.horse, c.from, c.to]), [[0, 5, 11], [1, 0, 1]]);
  assert.equal(s.deadline, null);
  const out = pick(s, 1, 1);
  assert.deepEqual(out.pos[0], [5, 1, 0, 0]);
  assert.equal(out.turn, 0); // le 6 fait rejouer
  const adv = pick(s, 1, 0);
  assert.deepEqual(adv.pos[0], [11, 0, 0, 0]);
});

test('un seul coup possible : il est joué tout seul, et la main passe (hors 6)', () => {
  const s = roll(withPos(start(), { 0: [10, 0, 0, 0] }), 1, 3);
  assert.deepEqual(s.pos[0], [13, 0, 0, 0]);
  assert.equal(s.turn, 1);
  assert.deepEqual(s.last, { seat: 0, die: 3, horse: 0, from: 10, to: 13, captured: null, auto: true });
});

test('aucun coup possible : passage automatique', () => {
  // un seul cheval, à 61 : un 3 dépasse l'arrivée
  const s = roll(withPos(start(), { 0: [61, 62, 62, 62] }), 1, 3);
  assert.equal(s.turn, 1);
  assert.equal(s.last.horse, null);
  assert.equal(s.last.die, 3);
});

test('plusieurs coups : choisir un cheval, refus d’un cheval qui ne peut pas jouer', () => {
  let s = roll(withPos(start(), { 0: [10, 20, 0, 0] }), 1, 4);
  assert.equal(s.phase, 'choose');
  assert.throws(() => pick(s, 1, 2), /ne peut pas avancer/); // cheval à l'écurie
  assert.throws(() => pick(s, 1, 9), /ne peut pas avancer/);
  assert.throws(() => move(s, 1, { type: 'roll' }, ctx(3)), /déjà lancé/);
  s = pick(s, 1, 1);
  assert.deepEqual(s.pos[0], [10, 24, 0, 0]);
  assert.equal(s.turn, 1);
});

test('lancer avant de jouer, pas son tour, partie finie', () => {
  const s = start();
  assert.throws(() => move(s, 1, { type: 'move', horse: 0 }, ctx()), /Lance d’abord/);
  assert.throws(() => move(s, 2, { type: 'roll' }, ctx(3)), /pas ton tour/);
  assert.throws(() => move(s, 1, { type: 'danse' }, ctx(3)), /Action inconnue/);
  assert.throws(() => move(s, 9, { type: 'roll' }, ctx(3)), /ne joues plus/);
});

test('prise : tomber pile sur un cheval adverse le renvoie à l’écurie', () => {
  // la couleur 0 à p = 10 (case 9) joue un 5 : p = 15 (case 14), la case de départ de la couleur 1 (p = 1)
  const s0 = withPos(start(3), { 0: [10, 0, 0, 0], 1: [1, 30, 0, 0] });
  const s = roll(s0, 1, 5);
  assert.deepEqual(s.pos[0], [15, 0, 0, 0]);
  assert.deepEqual(s.pos[1], [0, 30, 0, 0]);
  assert.deepEqual(s.last.captured, { seat: 1, horse: 0 });
});

test('prise sur la case de départ en sortant un cheval', () => {
  const s0 = withPos(start(3), { 0: [0, 0, 0, 0], 2: [1, 0, 0, 0] }); // couleur 2 : départ case 28 ; couleur 0 : case 0
  // un cheval de la couleur 2 est sur la case 0 (p = 29) : le 6 de la couleur 0 le prend
  const t = withPos(s0, { 2: [29, 0, 0, 0] });
  const s = roll(t, 1, 6);
  assert.deepEqual(s.pos[0], [1, 0, 0, 0]);
  assert.deepEqual(s.pos[2], [0, 0, 0, 0]);
});

test('on ne tombe pas sur un de ses chevaux : le coup n’existe pas, et le départ est occupé', () => {
  let s = withPos(start(), { 0: [10, 13, 0, 0] });
  s = { ...s, die: 3 };
  assert.deepEqual(legalMoves(s).map((m) => m.horse), [1]); // le cheval à 10 tomberait sur 13
  const blocked = { ...withPos(start(), { 0: [1, 0, 0, 0] }), die: 6 };
  assert.deepEqual(legalMoves(blocked).map((m) => [m.horse, m.to]), [[0, 7]]); // sortir est impossible : le départ est pris
});

test('les chevaux sautent par-dessus les autres', () => {
  const s = withPos(start(), { 0: [10, 0, 0, 0], 1: [12, 13, 0, 0] });
  const t = roll(s, 1, 4);
  assert.deepEqual(t.pos[0], [14, 0, 0, 0]);
  assert.deepEqual(t.pos[1], [12, 13, 0, 0]); // les adversaires n'ont pas été touchés
});

test('pas de prise sur l’échelle : les échelles sont privées', () => {
  // couleur 0 à p = 57 (échelle) ; couleur 1 à p = 44 : elle est sur la case 1 du circuit, pas dans l'échelle
  const s0 = withPos(start(), { 0: [57, 0, 0, 0], 1: [44, 0, 0, 0] });
  const s = roll(s0, 1, 2);
  assert.deepEqual(s.pos[0], [59, 0, 0, 0]);
  assert.deepEqual(s.pos[1], [44, 0, 0, 0]);
});

test('un cheval au bout du circuit (p = 56) monte à l’échelle avec le chiffre exact', () => {
  const s = withPos(start(), { 0: [56, 0, 0, 0] }, { die: 4 });
  assert.deepEqual(legalMoves(s).map((m) => m.to), [60]);
});

test('arrivée : compte exact, trop grand refusé', () => {
  const s = { ...withPos(start(), { 0: [60, 0, 0, 0] }), die: 3 };
  assert.deepEqual(legalMoves(s).map((m) => [m.horse, m.to]), []);
  assert.deepEqual(legalMoves({ ...s, die: 2 }).map((m) => m.to), [62]);
  assert.deepEqual(legalMoves({ ...s, die: 1 }).map((m) => m.to), [61]);
});

test('plusieurs chevaux peuvent finir sur la dernière case de l’échelle', () => {
  const s = { ...withPos(start(), { 0: [62, 61, 0, 0] }), die: 1 };
  assert.deepEqual(legalMoves(s).map((m) => [m.horse, m.to]), [[1, 62]]);
});

test('un cheval arrivé ne bouge plus', () => {
  const s = { ...withPos(start(), { 0: [62, 30, 0, 0] }), die: 2 };
  assert.deepEqual(legalMoves(s).map((m) => m.horse), [1]);
});

test('victoire : les quatre chevaux arrivés', () => {
  const s0 = withPos(start(), { 0: [62, 62, 62, 61] });
  const s = roll(s0, 1, 1);
  assert.deepEqual(status(s), { turn: null, over: true, winners: [1], deadline: null });
  assert.equal(s.phase, 'over');
  assert.throws(() => move(s, 2, { type: 'roll' }, ctx(3)), /terminée/);
});

test('la dernière case gagnante avec un 6 ne fait pas rejouer : la partie est finie', () => {
  const s0 = withPos(start(), { 0: [62, 62, 62, 56] });
  const s = roll(s0, 1, 6);
  assert.equal(s.phase, 'over');
  assert.deepEqual(status(s).winners, [1]);
});

test('un 6 sans coup possible fait rejouer quand même', () => {
  // un cheval à p = 60 : le 6 dépasse ; trois chevaux arrivés
  const s = roll(withPos(start(), { 0: [60, 62, 62, 62] }), 1, 6);
  assert.equal(s.turn, 0);
  assert.equal(s.phase, 'roll');
  assert.equal(s.last.die, 6);
});

test('un seul essai quand un cheval est sur le circuit : sans coup, on passe', () => {
  const s = roll(withPos(start(), { 0: [60, 0, 0, 0] }), 1, 5);
  assert.equal(s.turn, 1);
});

test('le tour passe aux joueurs dans l’ordre des places, en sautant ceux qui sont partis', () => {
  let s = start(3);
  s = withPos(s, { 0: [5, 0, 0, 0] });
  s = roll(s, 1, 2);
  assert.equal(s.turn, 1);
  const gone = leave(s, 2, ctx()).state;
  assert.equal(gone.turn, 2); // bob est parti pendant son tour : la main passe à cle
  s = roll(gone, 3, 2); // cle n'a que des chevaux à l'écurie : un essai de moins
  assert.equal(s.turn, 2);
});

test('minuteur : échéance posée à chaque tour, timeout lance le dé et joue le premier coup', () => {
  let s = setup(P.slice(0, 2), { timer: 30 }, { now: T0, random: dice(1) });
  assert.equal(status(s).deadline, T0 + 30000);
  s = withPos(s, { 0: [10, 20, 0, 0] });
  const t = timeout(s, { now: T0 + 30000, random: dice(4) }).state;
  assert.deepEqual(t.pos[0], [14, 20, 0, 0]); // premier coup possible : le cheval 0
  assert.equal(t.turn, 1);
  assert.equal(status(t).deadline, T0 + 60000);
});

test('minuteur après le lancer : choisir le premier cheval qui peut jouer', () => {
  let s = setup(P.slice(0, 2), { timer: 20 }, { now: T0, random: dice(1) });
  s = withPos(s, { 0: [10, 20, 0, 0] });
  s = move(s, 1, { type: 'roll' }, { now: T0 + 5000, random: dice(2) }).state;
  assert.equal(s.phase, 'choose');
  assert.equal(status(s).deadline, T0 + 25000);
  const t = timeout(s, { now: T0 + 25000, random: dice(1) }).state;
  assert.deepEqual(t.pos[0], [12, 20, 0, 0]);
});

test('minuteur sans coup possible : on passe (ou on réessaie) à la nouvelle échéance', () => {
  const s = setup(P.slice(0, 2), { timer: 30 }, { now: T0, random: dice(1) });
  const t = timeout(s, { now: T0 + 30000, random: dice(2) }).state;
  assert.equal(t.turn, 0);
  assert.equal(t.tries, 2);
  assert.equal(status(t).deadline, T0 + 60000);
});

test('abandon à deux : l’autre gagne', () => {
  const s = leave(start(2), 1, ctx()).state;
  assert.deepEqual(status(s), { turn: null, over: true, winners: [2], deadline: null });
});

test('abandon à trois : les chevaux de celui qui part sont retirés, la partie continue', () => {
  const s0 = withPos(start(3), { 0: [10, 0, 0, 0], 1: [20, 5, 0, 0] });
  const s = leave(s0, 2, ctx()).state;
  assert.equal(s.phase, 'roll');
  assert.deepEqual(s.pos[1], [0, 0, 0, 0]);
  assert.deepEqual(s.left, [2]);
  assert.equal(status(s).over, false);
  assert.equal(s.turn, 0); // ce n'était pas son tour : rien ne change
  const t = roll(s, 1, 2);
  assert.equal(t.turn, 2); // la main saute bob
  assert.throws(() => move(t, 2, { type: 'roll' }, ctx(2)), /pas ton tour|ne joues plus/);
});

test('abandon du joueur dont c’est le tour : la main passe au suivant', () => {
  const s = leave(start(3), 1, ctx()).state;
  assert.equal(s.turn, 1);
  assert.equal(s.phase, 'roll');
});

test('un cheval d’un joueur parti ne peut plus être pris', () => {
  const s0 = withPos(start(3), { 0: [10, 0, 0, 0], 1: [1, 0, 0, 0] });
  const gone = leave({ ...s0, turn: 2 }, 2, ctx()).state;
  assert.deepEqual(gone.pos[1], [0, 0, 0, 0]);
  assert.equal(gone.turn, 2); // ce n'était pas son tour : la main ne bouge pas
});

test('la vue montre tout : choix possibles pendant la phase de choix, rien de caché', () => {
  const s = roll(withPos(start(), { 0: [10, 20, 0, 0] }), 1, 4);
  const v = view(s, 2);
  assert.equal(v.you, 1);
  assert.equal(view(s, null).you, null);
  assert.equal(v.phase, 'choose');
  assert.deepEqual(v.choices.map((c) => c.horse), [0, 1]);
  assert.equal(v.die, 4);
  assert.deepEqual(v.pos, s.pos);
});

test('hasard : le dé vient de ctx.random et reste entre 1 et 6', () => {
  for (const r of [0, 0.5, 0.999999]) {
    const s = move(start(), 1, { type: 'roll' }, { now: T0, random: () => r }).state;
    assert.ok(s.last.die >= 1 && s.last.die <= 6);
  }
  assert.equal(roll(start(), 1, 6).pos[0][0], 1);
});

test("l'état tient en JSON", () => {
  const s = roll(roll(start(3), 1, 6), 1, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('partie complète à deux, dés imposés : un cheval fait le tour et monte à l’échelle', () => {
  let s = start(2);
  s = roll(s, 1, 6); // ana sort un cheval et rejoue
  let guard = 0;
  while (s.pos[0][0] < 62 && guard++ < 100) {
    if (s.turn === 0) {
      const remaining = 62 - s.pos[0][0];
      const die = Math.min(5, remaining); // jamais de 6 : on reste maître de la progression
      s = roll(s, 1, die);
    } else {
      s = roll(s, 2, 1); // bob ne sort jamais
    }
  }
  assert.equal(s.pos[0][0], 62);
  assert.equal(s.phase, 'roll'); // un seul cheval est arrivé : la partie continue
});
