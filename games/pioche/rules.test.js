// Tests des règles de Pioche ! : node --test games/pioche/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, status, view, timeout, leave, buildDeck, canPlay, points } from './rules.js';

// Qui peut agir : celui dont c'est le tour, plus les coups libres (status().may).
const actors = (s) => { const st = status(s); return [...new Set([...[].concat(st.turn ?? []), ...(st.may ?? [])])]; };

const players = [1, 2, 3].map((id) => ({ id, pseudo: `p${id}` }));
const mulberry = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const T0 = 1_000_000;
const ctx = (now = T0, seed = 7) => ({ now, random: mulberry(seed) });

// Partie à 3 joueurs, c'est au joueur 1 de jouer, avec des mains et une défausse choisies.
function table({ hands, top = 'R5', color, options = {}, extra = {} } = {}) {
  const s = setup(players, options, ctx());
  const h = { 1: ['R1', 'J2', 'V3'], 2: ['B4', 'B5', 'V6'], 3: ['J7', 'J8', 'R9'], ...hands };
  return {
    ...s,
    starter: 0,
    turn: 0,
    hands: h,
    discard: ['B0', top],
    color: color ?? (top[0] === 'W' ? 'R' : top[0]),
    draw: ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'J0', 'J1', 'B1', 'B2'],
    deadline: null,
    ...extra,
  };
}
const play = (s, id, action, c = ctx()) => move(s, id, action, c).state;
const throwsMsg = (fn, re) => assert.throws(fn, (e) => e instanceof Error && re.test(e.message));

test('le paquet fait 108 cartes et chaque joueur en reçoit 7', () => {
  assert.equal(buildDeck().length, 108);
  const s = setup(players, { rounds: 1, timer: 0 }, ctx());
  for (const p of players) assert.equal(s.hands[p.id].length, 7);
  assert.equal(s.draw.length + 21 + s.discard.length, 108);
  assert.match(s.discard[0], /^[RJVB]\d$/); // la première carte est un chiffre
  assert.equal(s.color, s.discard[0][0]);
});

test('le hasard fixé donne la même donne', () => {
  assert.deepEqual(setup(players, {}, ctx()), setup(players, {}, ctx()));
  assert.notDeepEqual(setup(players, {}, ctx(T0, 1)).hands, setup(players, {}, ctx(T0, 2)).hands);
});

test('même couleur ou même valeur, sinon refus', () => {
  const s = table({ top: 'R5' });
  assert.equal(canPlay(s, 'R1'), true);
  assert.equal(canPlay(s, 'B5'), true);
  assert.equal(canPlay(s, 'J2'), false);
  assert.equal(canPlay(s, 'WC'), true);
  throwsMsg(() => move(s, 1, { type: 'play', card: 'J2' }, ctx()), /ne va pas/);
  throwsMsg(() => move(s, 1, { type: 'play', card: 'B9' }, ctx()), /pas cette carte/);
});

test('poser une carte change la défausse et passe le tour', () => {
  const s = play(table(), 1, { type: 'play', card: 'R1' });
  assert.equal(s.discard.at(-1), 'R1');
  assert.deepEqual(s.hands[1], ['J2', 'V3']);
  assert.equal(status(s).turn, 2);
});

test("ce n'est pas le tour : refusé, et l'état reçu n'est pas modifié", () => {
  const s = table();
  const before = JSON.stringify(s);
  throwsMsg(() => move(s, 2, { type: 'play', card: 'B5' }, ctx()), /pas ton tour/);
  play(s, 1, { type: 'play', card: 'R1' });
  assert.equal(JSON.stringify(s), before);
});

test('+2 sans cumul : le suivant pioche deux cartes et passe son tour', () => {
  const s = play(table({ hands: { 1: ['R+2', 'J2', 'V3'] }, options: { stack: false } }), 1, { type: 'play', card: 'R+2' });
  assert.equal(s.hands[2].length, 5);
  assert.equal(status(s).turn, 3);
  assert.deepEqual(s.log.at(-1).draw, { to: 2, n: 2 });
});

test('cumul : +2 sur +2, puis +4 ; le suivant pioche tout et passe', () => {
  let s = table({ hands: { 1: ['R+2', 'J2', 'V3'], 2: ['B+2', 'B5', 'V6'], 3: ['WF', 'J8', 'R9'] } });
  s = play(s, 1, { type: 'play', card: 'R+2' });
  assert.equal(s.stack, 2);
  assert.equal(status(s).turn, 2);
  assert.deepEqual(view(s, 2).playable, ['B+2']);
  throwsMsg(() => move(s, 2, { type: 'play', card: 'B5' }, ctx()), /ne va pas/);
  s = play(s, 2, { type: 'play', card: 'B+2' });
  assert.equal(s.stack, 4);
  s = play(s, 3, { type: 'play', card: 'WF', color: 'J' });
  assert.equal(s.stack, 8);
  assert.equal(status(s).turn, 1);
  assert.deepEqual(view(s, 1).playable, []); // pas de +4 en main : il faut piocher
  s = play(s, 1, { type: 'draw' });
  assert.equal(s.hands[1].length, 2 + 8);
  assert.equal(s.stack, 0);
  assert.equal(status(s).turn, 2); // il a passé son tour
});

test('cumul : un +2 ne renchérit pas sur un +4 ; le minuteur fait piocher le cumul', () => {
  let s = table({ hands: { 1: ['WF', 'J2', 'V3'], 2: ['B+2', 'B5', 'V6'] }, options: { timer: 30 } });
  s = play(s, 1, { type: 'play', card: 'WF', color: 'B' });
  assert.deepEqual(view(s, 2).playable, []);
  s = timeout(s, ctx(T0 + 60_000)).state;
  assert.equal(s.hands[2].length, 3 + 4);
  assert.equal(s.stack, 0);
  assert.equal(status(s).turn, 3);
});

test('passe : le suivant saute son tour', () => {
  const s = play(table({ hands: { 1: ['RX', 'J2', 'V3'] } }), 1, { type: 'play', card: 'RX' });
  assert.equal(status(s).turn, 3);
  assert.equal(s.hands[2].length, 3);
});

test("sens inverse à 3 : l'ordre change ; à 2 : le joueur rejoue", () => {
  let s = play(table({ hands: { 1: ['RI', 'J2', 'V3'] } }), 1, { type: 'play', card: 'RI' });
  assert.equal(s.dir, -1);
  assert.equal(status(s).turn, 3); // 1 -> 3 dans l'autre sens
  s = play(s, 3, { type: 'play', card: 'R9' });
  assert.equal(status(s).turn, 2);

  const duo = setup(players.slice(0, 2), {}, ctx());
  const d = { ...duo, turn: 0, hands: { 1: ['RI', 'J2', 'J3'], 2: ['B4', 'V6'] }, discard: ['B0', 'R5'], color: 'R' };
  const after = play(d, 1, { type: 'play', card: 'RI' });
  assert.equal(status(after).turn, 1);
});

test('joker : il faut choisir une couleur, puis elle devient la couleur demandée', () => {
  const s = table({ hands: { 1: ['WC', 'J2', 'V3'] } });
  throwsMsg(() => move(s, 1, { type: 'play', card: 'WC' }, ctx()), /couleur/);
  throwsMsg(() => move(s, 1, { type: 'play', card: 'WC', color: 'Z' }, ctx()), /couleur/);
  const after = play(s, 1, { type: 'play', card: 'WC', color: 'B' });
  assert.equal(after.color, 'B');
  assert.equal(canPlay(after, 'B4'), true);
  assert.equal(canPlay(after, 'R1'), false);
  assert.equal(canPlay(after, 'WC'), true);
});

test('joker +4 sans cumul : le suivant pioche quatre cartes et passe', () => {
  const s = play(table({ hands: { 1: ['WF', 'J2', 'V3'] }, options: { stack: false } }), 1, { type: 'play', card: 'WF', color: 'V' });
  assert.equal(s.hands[2].length, 7);
  assert.equal(status(s).turn, 3);
  assert.equal(s.color, 'V');
});

test('un chiffre sur un joker : seule la couleur demandée compte', () => {
  const s = table({ top: 'WC', color: 'B', hands: { 1: ['B4', 'R4', 'V3'] } });
  assert.equal(canPlay(s, 'B4'), true);
  assert.equal(canPlay(s, 'R4'), false);
});

test('piocher une carte jouable : on peut la jouer ou passer, pas jouer une autre', () => {
  const s0 = table({ hands: { 1: ['J2', 'V3', 'V4'] }, extra: { draw: ['V0', 'R7'] } });
  let s = play(s0, 1, { type: 'draw' });
  assert.equal(s.phase, 'drawn');
  assert.equal(s.drawn, 'R7');
  assert.equal(status(s).turn, 1);
  throwsMsg(() => move(s, 1, { type: 'draw' }, ctx()), /déjà pioché/);
  throwsMsg(() => move(s, 1, { type: 'play', card: 'V3' }, ctx()), /que tu viens de piocher/);
  assert.deepEqual(view(s, 1).playable, ['R7']);
  assert.equal(view(s, 1).canPass, true);
  const played = play(s, 1, { type: 'play', card: 'R7' });
  assert.equal(played.discard.at(-1), 'R7');
  assert.equal(status(played).turn, 2);
  s = play(s, 1, { type: 'pass' });
  assert.equal(status(s).turn, 2);
  assert.equal(s.hands[1].length, 4);
});

test('piocher une carte injouable : le tour passe tout seul', () => {
  const s = play(table({ hands: { 1: ['J2', 'V3', 'V4'] }, extra: { draw: ['V0', 'J9'] } }), 1, { type: 'draw' });
  assert.equal(s.phase, 'play');
  assert.equal(status(s).turn, 2);
  assert.equal(s.hands[1].length, 4);
});

test('passer sans avoir pioché est refusé', () => {
  throwsMsg(() => move(table(), 1, { type: 'pass' }, ctx()), /piocher/);
});

test('pioche vide : la défausse est mélangée avec le hasard fourni', () => {
  const s0 = table({ extra: { draw: [], discard: ['B1', 'B2', 'B3', 'B4', 'R5'] } });
  const a = play(s0, 1, { type: 'draw' }, ctx(T0, 3));
  const b = play(s0, 1, { type: 'draw' }, ctx(T0, 3));
  assert.deepEqual(a, b);
  assert.equal(a.discard.length, 1);
  assert.equal(a.discard[0], 'R5');
  assert.equal(a.hands[1].length, 4);
  assert.equal(a.draw.length, 3);
});

test('plus aucune carte nulle part : on ne plante pas', () => {
  const s = play(table({ extra: { draw: [], discard: ['R5'] } }), 1, { type: 'draw' });
  assert.equal(s.hands[1].length, 3);
  assert.equal(status(s).turn, 2);
});

test('« Dernière ! » : annoncée à temps, rien ne se passe', () => {
  const s0 = table({ hands: { 1: ['R1', 'R2'] } });
  const s1 = play(s0, 1, { type: 'play', card: 'R1' }, ctx(T0));
  assert.equal(s1.pending, 1);
  assert.equal(s1.deadline, T0 + 5000);
  assert.deepEqual(actors(s1), [2, 1, 3]);
  const s2 = play(s1, 1, { type: 'call' });
  assert.equal(s2.pending, null);
  throwsMsg(() => move(s2, 2, { type: 'accuse' }, ctx()), /Personne/);
  assert.equal(status(s2).turn, 2);
});

test('« Dernière ! » oubliée et dénoncée : +2 cartes', () => {
  const s1 = play(table({ hands: { 1: ['R1', 'R2'] } }), 1, { type: 'play', card: 'R1' });
  throwsMsg(() => move(s1, 1, { type: 'accuse' }, ctx()), /clique/);
  const s2 = play(s1, 3, { type: 'accuse' });
  assert.equal(s2.hands[1].length, 3);
  assert.equal(s2.pending, null);
  assert.equal(s2.log.at(-1).k, 'accuse');
});

test('annoncer à deux cartes juste avant de poser évite toute dénonciation', () => {
  const s0 = table({ hands: { 1: ['R1', 'R2'] } });
  const s1 = play(s0, 1, { type: 'call' });
  assert.deepEqual(s1.called, [1]);
  const s2 = play(s1, 1, { type: 'play', card: 'R1' });
  assert.equal(s2.pending, null);
  assert.equal(status(s2).turn, 2);
  throwsMsg(() => move(s0, 2, { type: 'call' }, ctx()), /Dernière/);
});

test("la fenêtre se ferme quand le suivant joue, ou quand le minuteur échoit", () => {
  const s1 = play(table({ hands: { 1: ['R1', 'R2'], 2: ['R6', 'B5', 'V6'] } }), 1, { type: 'play', card: 'R1' });
  const s2 = play(s1, 2, { type: 'play', card: 'R6' });
  assert.equal(s2.pending, null);
  throwsMsg(() => move(s2, 3, { type: 'accuse' }, ctx()), /Personne/);
  const s3 = timeout(s1, ctx(T0 + 5000)).state;
  assert.equal(s3.pending, null);
  assert.equal(s3.hands[2].length, 3); // le suivant n'a pas encore perdu son tour
  assert.equal(status(s3).turn, 2);
});

test('avec le minuteur, le décompte du suivant démarre à la fin de la fenêtre', () => {
  const s0 = table({ hands: { 1: ['R1', 'R2'] }, extra: { timer: 30 } });
  const s1 = play(s0, 1, { type: 'play', card: 'R1' }, ctx(T0));
  assert.equal(status(s1).deadline, T0 + 5000);
  const s2 = timeout(s1, ctx(T0 + 5000)).state;
  assert.equal(status(s2).deadline, T0 + 35000);
});

test('minuteur échu : pioche une carte et passe, même si elle irait', () => {
  const s0 = table({ extra: { timer: 20, deadline: T0 + 20000, draw: ['V0', 'R7'] } });
  const s = timeout(s0, ctx(T0 + 20000)).state;
  assert.equal(s.hands[1].length, 4);
  assert.equal(s.phase, 'play');
  assert.equal(status(s).turn, 2);
  assert.equal(status(s).deadline, T0 + 40000);
  assert.equal(s.log.at(-1).k, 'timeout');
});

test('minuteur échu après avoir pioché : on passe', () => {
  const s0 = play(table({ hands: { 1: ['J2', 'V3', 'V4'] }, extra: { timer: 20, draw: ['V0', 'R7'] } }), 1, { type: 'draw' }, ctx(T0));
  assert.equal(s0.phase, 'drawn');
  const s = timeout(s0, ctx(T0 + 20000)).state;
  assert.equal(s.phase, 'play');
  assert.equal(status(s).turn, 2);
  assert.equal(s.hands[1].length, 4);
});

test('sans minuteur, pas de deadline', () => {
  assert.equal(status(table()).deadline, null);
});

test("fin de manche : le gagnant marque les points des cartes restantes", () => {
  const s0 = table({ hands: { 1: ['R1'], 2: ['B4', 'WC', 'R+2'], 3: ['J7', 'J8'] }, extra: { called: [1] } });
  const s = play(s0, 1, { type: 'play', card: 'R1' });
  assert.equal(s.phase, 'over');
  assert.equal(s.roundResult.gain, 4 + 50 + 20 + 7 + 8);
  assert.deepEqual(status(s), { turn: null, over: true, winners: [1], deadline: null });
  assert.equal(points('R0'), 0);
  assert.equal(points('BX'), 20);
});

test('plusieurs manches : pause, puis nouvelle donne ; la fin désigne le meilleur total', () => {
  const s0 = table({ hands: { 1: ['R1'], 2: ['B4'], 3: ['J7'] }, extra: { rounds: 2, called: [1] } });
  let s = play(s0, 1, { type: 'play', card: 'R1' }, ctx(T0));
  assert.equal(s.phase, 'between');
  assert.equal(s.scores[1], 11);
  assert.deepEqual(actors(s), [1, 2, 3]);
  assert.equal(status(s).deadline, T0 + 12000);
  throwsMsg(() => move(s, 1, { type: 'draw' }, ctx()), /manche est finie/);
  // le minuteur de pause lance la manche suivante
  const n = timeout(s, ctx(T0 + 12000, 11)).state;
  assert.equal(n.phase, 'play');
  assert.equal(n.round, 2);
  for (const id of [1, 2, 3]) assert.equal(n.hands[id].length, 7);
  assert.equal(n.roundResult, null);
  assert.equal(n.scores[1], 11);
  // ou n'importe quel joueur la lance
  assert.equal(play(s, 2, { type: 'next' }, ctx(T0, 5)).round, 2);
  // manche 2 : le joueur 2 gagne et passe devant au total
  let m = { ...n, hands: { 1: ['J2'], 2: ['B4'], 3: ['J7', 'J8'] }, discard: ['B0', 'B5'], color: 'B', turn: 1, called: [2] };
  m = play(m, 2, { type: 'play', card: 'B4' });
  assert.equal(m.phase, 'over');
  assert.equal(m.scores[2], 17); // 2 + 7 + 8 contre 11 pour le joueur 1
  assert.deepEqual(m.winners, [2]);
});

test('égalité de points : celui qui gagne la dernière manche l\'emporte', () => {
  const s0 = table({ hands: { 1: ['R1'], 2: ['B0'], 3: ['J0'] }, extra: { called: [1] } });
  const s = play(s0, 1, { type: 'play', card: 'R1' });
  assert.equal(s.scores[1], 0);
  assert.deepEqual(s.winners, [1]);
});

test('abandon pendant son tour : ses cartes vont sous la pioche et la partie continue', () => {
  const s0 = table();
  const { state: s } = leave(s0, 1, ctx());
  assert.deepEqual(s.out, [1]);
  assert.deepEqual(s.hands[1], []);
  assert.equal(s.draw.length, s0.draw.length + 3);
  assert.deepEqual(s.draw.slice(0, 3), ['R1', 'J2', 'V3']); // sous la pioche = début du tableau
  assert.equal(status(s).over, false);
  assert.equal(status(s).turn, 2);
  throwsMsg(() => move(s, 1, { type: 'draw' }, ctx()), /ne joues plus/);
  // le tour saute le joueur parti
  const s2 = play(s, 2, { type: 'play', card: 'B5' });
  assert.equal(status(s2).turn, 3);
});

test('abandon hors de son tour : le tour ne change pas', () => {
  const { state: s } = leave(table(), 3, ctx());
  assert.equal(status(s).turn, 1);
  assert.equal(view(s, 3).hand.length, 0);
});

test("il ne reste qu'un joueur : la partie se termine et il gagne", () => {
  let s = leave(table(), 1, ctx()).state;
  s = leave(s, 2, ctx()).state;
  assert.deepEqual(status(s), { turn: null, over: true, winners: [3], deadline: null });
  assert.equal(leave(s, 3, ctx()).state.phase, 'over');
});

test('abandon du joueur à dénoncer : plus de dénonciation possible', () => {
  const s1 = play(table({ hands: { 1: ['R1', 'R2'] } }), 1, { type: 'play', card: 'R1' });
  const { state: s } = leave(s1, 1, ctx());
  assert.equal(s.pending, null);
  assert.equal(status(s).turn, 2);
});

test('la vue cache les cartes des autres, la pioche et les spectateurs ne voient aucune main', () => {
  const s = table();
  const v = view(s, 1);
  assert.deepEqual(v.hand, ['R1', 'J2', 'V3'].sort((a, b) => 'RJVB'.indexOf(a[0]) - 'RJVB'.indexOf(b[0])));
  assert.deepEqual(v.counts, { 1: 3, 2: 3, 3: 3 });
  const json = JSON.stringify(v);
  for (const c of ['B4', 'J7', 'R9', 'V5']) assert.equal(json.includes(`"${c}"`), false, c);
  assert.equal(v.drawCount, 10);
  const spec = view(s, null);
  assert.deepEqual(spec.hand, []);
  assert.deepEqual(spec.playable, []);
  assert.equal(spec.canDraw, false);
  assert.equal(view(s, 2).playable.length, 0); // pas son tour
  assert.deepEqual(view(s, 1).playable, ['R1']);
});

test('la carte piochée reste secrète pour les autres', () => {
  const s = play(table({ hands: { 1: ['J2', 'V3', 'V4'] }, extra: { draw: ['V0', 'R7'] } }), 1, { type: 'draw' });
  assert.equal(view(s, 1).drawn, 'R7');
  assert.equal(view(s, 2).drawn, null);
  assert.equal(view(s, null).drawn, null);
});

test('coup inconnu ou spectateur : refus', () => {
  throwsMsg(() => move(table(), 1, { type: 'triche' }, ctx()), /inconnu/);
  throwsMsg(() => move(table(), 99, { type: 'draw' }, ctx()), /ne joues plus/);
});

// Parties jouées au hasard avec des coups légaux : elles se terminent, et aucune carte n'est perdue ou dupliquée.
function randomPlayout(seed, n, rounds, timer) {
  const rnd = mulberry(seed);
  const ps = Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `p${i + 1}` }));
  const c = (now) => ({ now, random: rnd });
  let now = T0;
  let s = setup(ps, { rounds, timer }, c(now));
  for (let step = 0; step < 6000 && !status(s).over; step++) {
    const who = actors(s)[0];
    const v = view(s, who);
    now += 1000;
    if (v.phase === 'between') {
      s = (rnd() < 0.5 ? timeout(s, c(now)) : move(s, who, { type: 'next' }, c(now))).state;
    } else if (v.pending && rnd() < 0.3) {
      const others = actors(s).filter((id) => id !== v.pending);
      s = move(s, others[0], { type: 'accuse' }, c(now)).state;
    } else if (v.canCall && rnd() < 0.5) {
      s = move(s, who, { type: 'call' }, c(now)).state;
    } else if (timer && rnd() < 0.1) {
      s = timeout(s, c(now)).state;
    } else if (v.playable.length && rnd() < 0.85) {
      const card = v.playable[Math.floor(rnd() * v.playable.length)];
      s = move(s, who, { type: 'play', card, color: 'RJVB'[Math.floor(rnd() * 4)] }, c(now)).state;
    } else if (v.canDraw) {
      s = move(s, who, { type: 'draw' }, c(now)).state;
    } else if (v.canPass) {
      s = move(s, who, { type: 'pass' }, c(now)).state;
    } else {
      s = timeout(s, c(now)).state; // pending en cours et rien d'autre à faire : la fenêtre se ferme
    }
    if (s.phase !== 'over') {
      const all = [...Object.values(s.hands).flat(), ...s.draw, ...s.discard];
      assert.equal(all.length, 108, `cartes perdues ou en trop (n=${n} seed=${seed} step=${step})`);
    }
  }
  return s;
}

test('parties au hasard : elles se terminent, 2 à 8 joueurs, cartes toujours au nombre de 108', () => {
  for (const [n, rounds, timer] of [[2, 1, 0], [3, 2, 0], [4, 1, 20], [5, 3, 30], [8, 2, 0], [8, 1, 60]]) {
    for (let seed = 1; seed <= 8; seed++) {
      const s = randomPlayout(seed * 100 + n, n, rounds, timer);
      assert.equal(status(s).over, true, `n=${n} seed=${seed}`);
      assert.ok(status(s).winners.length >= 1);
    }
  }
});

test('boutons proposés : « Dernière ! » pour le joueur à risque ou à deux cartes, « Dénoncer » pour les autres', () => {
  const s0 = table({ hands: { 1: ['R1', 'R2'] } });
  assert.equal(view(s0, 1).canCall, true); // deux cartes, son tour
  assert.equal(view(s0, 2).canCall, false);
  const s1 = play(s0, 1, { type: 'play', card: 'R1' });
  assert.equal(view(s1, 1).canCall, true);
  assert.equal(view(s1, 1).canAccuse, false);
  assert.equal(view(s1, 2).canAccuse, true);
  assert.equal(view(s1, 2).canCall, false);
  assert.equal(view(s1, null).canAccuse, false); // un spectateur ne dénonce pas
  throwsMsg(() => move(s1, 99, { type: 'accuse' }, ctx()), /ne joues plus/);
});
