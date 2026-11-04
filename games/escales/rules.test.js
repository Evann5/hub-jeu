// Tests d'Escales : node --test games/escales/rules.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, move, view, status, timeout, leave, rentOf, worthOf, SALARY, CATCH_UP, FINE } from './rules.js';
import { TILES, REGIONS, SIZE, CUSTOMS_POS, FLY_COST, MAX_LEVEL } from './client/board.js';

const seeded = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const ctxOf = (seed = 1, now = 1000) => ({ now, random: seeded(seed) });
const people = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `J${i + 1}` }));
const start = (n = 3, options = {}) => setup(people(n), { rounds: 25, timer: 0, ...options }, ctxOf());

// Hasard imposé : la suite de valeurs de dés voulues.
const dice = (...faces) => {
  const queue = faces.map((f) => (f - 1) / 6 + 0.01);
  return { now: 1000, random: () => (queue.length ? queue.shift() : 0.5) };
};
const roll = (s, a, b) => move(s, s.players[s.cur].id, { type: 'roll' }, dice(a, b)).state;
const posOf = (name) => TILES.find((t) => t.name === name).pos;
const own = (s, id, ...names) => {
  for (const n of names) s.props[posOf(n)] = { owner: id, level: 0, mortgaged: false };
  return s;
};
const put = (s, pos) => {
  s.players[s.cur].pos = pos;
  return s;
};

test('la carte : 48 cases, 32 villes en 8 régions de 4, 4 escales, 4 coins', () => {
  assert.equal(TILES.length, SIZE);
  assert.equal(TILES.filter((t) => t.type === 'city').length, 32);
  assert.equal(TILES.filter((t) => t.type === 'escale').length, 4);
  for (let r = 0; r < REGIONS.length; r += 1) assert.equal(TILES.filter((t) => t.region === r).length, 4);
  assert.deepEqual([0, 12, 24, 36].map((p) => TILES[p].type), ['start', 'customs', 'festival', 'control']);
  assert.equal(TILES[CUSTOMS_POS].type, 'customs');
  const prices = TILES.filter((t) => t.type === 'city').map((t) => t.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b), 'les prix montent autour du plateau');
});

test('mise en place : argent de départ et ordre', () => {
  const s = start(10, { cash: 2000 });
  assert.equal(s.players.length, 10);
  assert.ok(s.players.every((p) => p.cash === 2000 && p.pos === 0));
  assert.deepEqual(status(s).turn, s.players[0].id);
});

test('tomber sur une ville libre : acheter', () => {
  let s = roll(start(), 1, 2); // case 3 = Télex : on place directement
  s = start();
  s = put(s, 0);
  s = roll(s, 1, 3); // case 4 : Marrakech
  assert.equal(s.phase, 'buy');
  const id = s.players[s.cur].id;
  const t = TILES[4];
  s = move(s, id, { type: 'buy' }, ctxOf()).state;
  assert.equal(s.props[4].owner, id);
  assert.equal(s.players.find((p) => p.id === id).cash, 1500 - t.price);
  assert.notEqual(s.players[s.cur].id, id, 'tour suivant');
});

test('impossible de jouer à la place d’un autre', () => {
  const s = start();
  const other = s.players[1].id;
  assert.throws(() => move(s, other, { type: 'roll' }, ctxOf()), /pas ton tour/);
});

test('l’état reçu n’est jamais modifié', () => {
  const s = start();
  const copy = structuredClone(s);
  roll(s, 1, 3);
  assert.deepEqual(s, copy);
});

test('refuser d’acheter : la ville reste libre et le tour passe au suivant', () => {
  let s = roll(start(), 1, 3);
  const [a, b] = s.players.map((p) => p.id);
  s = move(s, a, { type: 'decline' }, ctxOf()).state;
  assert.equal(s.props[4], undefined);
  assert.equal(s.players.find((p) => p.id === a).cash, 1500);
  assert.equal(s.phase, 'roll');
  assert.equal(status(s).turn, b);
  assert.equal(JSON.stringify(view(s, b)).includes('auction'), false);
});

test('loyer : ville seule, majorité × 2, région complète × 3', () => {
  const s = start(4);
  const [a] = s.players.map((p) => p.id);
  own(s, a, 'Chefchaouen');
  const base = TILES[posOf('Chefchaouen')].rent;
  assert.equal(rentOf(s, posOf('Chefchaouen')), base);
  own(s, a, 'Fès');
  assert.equal(rentOf(s, posOf('Chefchaouen')), base);
  own(s, a, 'Marrakech');
  assert.equal(rentOf(s, posOf('Chefchaouen')), base * 2);
  own(s, a, 'Casablanca');
  assert.equal(rentOf(s, posOf('Chefchaouen')), base * 3);
  s.props[posOf('Chefchaouen')].mortgaged = true;
  assert.equal(rentOf(s, posOf('Chefchaouen')), 0);
});

test('payer le loyer au propriétaire', () => {
  let s = start();
  const [a, b] = s.players.map((p) => p.id);
  own(s, b, 'Marrakech');
  const rent = rentOf(s, 4);
  s = roll(s, 1, 3);
  assert.equal(s.players.find((p) => p.id === a).cash, 1500 - rent);
  assert.equal(s.players.find((p) => p.id === b).cash, 1500 + rent);
});

test('construire demande 3 villes de la région, pas 2', () => {
  let s = start(4);
  const [a] = s.players.map((p) => p.id);
  own(s, a, 'Chefchaouen', 'Fès');
  assert.throws(() => move(s, a, { type: 'build', pos: posOf('Fès') }, ctxOf()), /3 villes/);
  own(s, a, 'Marrakech');
  s = move(s, a, { type: 'build', pos: posOf('Fès') }, ctxOf()).state;
  assert.equal(s.props[posOf('Fès')].level, 1);
  assert.equal(s.players.find((p) => p.id === a).cash, 1500 - 50);
  assert.ok(view(s, a).actions.build.includes(posOf('Fès')));
});

test('à 2 ou 3 joueurs, 2 villes suffisent pour construire', () => {
  for (const n of [2, 3]) {
    const s = start(n);
    const a = s.players[0].id;
    own(s, a, 'Chefchaouen', 'Fès');
    const next = move(s, a, { type: 'build', pos: posOf('Fès') }, ctxOf()).state;
    assert.equal(next.props[posOf('Fès')].level, 1);
  }
});

test('niveau maximum, vente à moitié prix', () => {
  let s = start();
  const [a] = s.players.map((p) => p.id);
  own(s, a, 'Chefchaouen', 'Fès', 'Marrakech');
  const pos = posOf('Fès');
  for (let i = 0; i < MAX_LEVEL; i += 1) s = move(s, a, { type: 'build', pos }, ctxOf()).state;
  assert.throws(() => move(s, a, { type: 'build', pos }, ctxOf()), /niveau libre/);
  const before = s.players.find((p) => p.id === a).cash;
  s = move(s, a, { type: 'sell', pos }, ctxOf()).state;
  assert.equal(s.props[pos].level, MAX_LEVEL - 1);
  assert.equal(s.players.find((p) => p.id === a).cash, before + 25);
});

test('gage : la ville rapporte la moitié de son prix, plus de loyer, rachat à 110 %', () => {
  let s = start();
  const [a] = s.players.map((p) => p.id);
  own(s, a, 'Casablanca');
  const pos = posOf('Casablanca');
  s = move(s, a, { type: 'mortgage', pos }, ctxOf()).state;
  assert.equal(s.players.find((p) => p.id === a).cash, 1540);
  assert.equal(rentOf(s, pos), 0);
  s = move(s, a, { type: 'unmortgage', pos }, ctxOf()).state;
  assert.equal(s.players.find((p) => p.id === a).cash, 1540 - 44);
  assert.equal(s.props[pos].mortgaged, false);
});

test('escale : le propriétaire encaisse selon ses escales, puis on peut s’envoler', () => {
  let s = start();
  const [a, b] = s.players.map((p) => p.id);
  own(s, b, 'Escale Nord', 'Escale Est');
  s = roll(s, 2, 4); // case 6
  assert.equal(s.players.find((p) => p.id === a).cash, 1500 - 50);
  assert.equal(s.phase, 'fly');
  s = move(s, a, { type: 'fly', pos: posOf('Escale Sud') }, ctxOf()).state;
  assert.equal(s.players.find((p) => p.id === a).pos, posOf('Escale Sud'));
  assert.equal(s.players.find((p) => p.id === a).cash, 1500 - 50 - FLY_COST);
});

test('passer au Départ : salaire, et prime pour qui est loin derrière', () => {
  let s = start();
  const [a, b] = s.players.map((p) => p.id);
  put(s, 46);
  s = roll(s, 1, 2); // 46 + 3 = 1
  assert.equal(s.players.find((p) => p.id === a).cash, 1500 + SALARY);
  s = start();
  s.players[1].cash = 100000;
  put(s, 46);
  s = roll(s, 1, 2);
  assert.equal(s.players.find((p) => p.id === a).cash, 1500 + SALARY + CATCH_UP);
  assert.equal(b, s.players[1].id);
});

test('douane : un double pour sortir, l’amende, le passe, et 3 essais au plus', () => {
  let s = start();
  const a = s.players[0].id;
  put(s, 34);
  s = roll(s, 1, 1); // 36 = Contrôle
  const p = () => s.players.find((x) => x.id === a);
  assert.equal(p().pos, CUSTOMS_POS);
  assert.ok(p().blocked);
  assert.equal(s.again, false, 'pas de relance après un contrôle');

  const back = (state) => { state.cur = 0; state.phase = 'roll'; return state; };
  s = back(s);
  s = roll(s, 1, 2);
  assert.equal(p().pos, CUSTOMS_POS);
  s = back(s);
  s = roll(s, 1, 2);
  s = back(s);
  s = roll(s, 1, 3); // 3e échec : amende, puis on avance
  assert.equal(p().blocked, 0);
  assert.equal(p().cash, 1500 - FINE);
  assert.equal(p().pos, CUSTOMS_POS + 4);

  s = start();
  s.players[0].pos = CUSTOMS_POS;
  s.players[0].blocked = 1;
  s = move(s, a, { type: 'payFine' }, ctxOf()).state;
  assert.equal(p().blocked, 0);
  assert.equal(p().cash, 1500 - FINE);

  s = start();
  s.players[0].blocked = 1;
  assert.throws(() => move(s, a, { type: 'usePass' }, ctxOf()), /passe-douane/);
  s.players[0].passes = 1;
  s = move(s, a, { type: 'usePass' }, ctxOf()).state;
  assert.equal(p().blocked, 0);
  assert.equal(p().passes, 0);
});

test('trois doubles de suite : douane', () => {
  let s = start();
  const a = s.players[0].id;
  const p = () => s.players.find((x) => x.id === a);
  own(s, a, 'Fès', 'Chefchaouen', 'Marrakech', 'Casablanca'); // cases sans achat à décider
  s = roll(s, 1, 1); // 2 : à lui
  assert.equal(s.phase, 'roll');
  assert.equal(p().doubles, 1);
  s = roll(s, 1, 1); // 4 : à lui
  assert.equal(p().doubles, 2);
  s = roll(s, 1, 1);
  assert.equal(p().pos, CUSTOMS_POS);
  assert.ok(p().blocked);
});

test('festival : le loyer double jusqu’au prochain tour de l’organisateur', () => {
  let s = start();
  const a = s.players[0].id;
  own(s, a, 'Marrakech');
  put(s, 21);
  s = roll(s, 1, 2); // 24
  assert.equal(s.phase, 'festival');
  const pos = posOf('Marrakech');
  const base = rentOf(s, pos);
  s = move(s, a, { type: 'festival', pos }, ctxOf()).state;
  assert.equal(rentOf(s, pos), base * 2);
  for (let i = 0; i < 2; i += 1) {
    const id = s.players[s.cur].id;
    s = move(s, id, { type: 'roll' }, dice(1, 2)).state;
    if (s.players[s.cur].id === id) s = move(s, id, { type: s.phase === 'buy' ? 'decline' : 'skip' }, ctxOf()).state;
  }
  assert.equal(s.players[s.cur].id, a);
  assert.equal(s.festival, null);
});

test('chantier : un niveau à moitié prix', () => {
  let s = start();
  const a = s.players[0].id;
  own(s, a, 'Chefchaouen', 'Fès', 'Marrakech');
  put(s, 18);
  s = roll(s, 1, 2); // 21
  assert.equal(TILES[21].type, 'chantier');
  assert.equal(s.phase, 'chantier');
  s = move(s, a, { type: 'chantier', pos: posOf('Fès') }, ctxOf()).state;
  assert.equal(s.props[posOf('Fès')].level, 1);
  assert.equal(s.players.find((p) => p.id === a).cash, 1500 - 25);
});

test('dette : il faut trouver l’argent, puis payer', () => {
  let s = start();
  const [a, b] = s.players.map((p) => p.id);
  own(s, b, 'Marrakech');
  own(s, a, 'Casablanca');
  s.players[0].cash = 1;
  s = roll(s, 1, 3);
  assert.equal(s.phase, 'debt');
  assert.throws(() => move(s, a, { type: 'pay' }, ctxOf()), /manque/);
  s = move(s, a, { type: 'mortgage', pos: posOf('Casablanca') }, ctxOf()).state;
  s = move(s, a, { type: 'pay' }, ctxOf()).state;
  assert.equal(s.debt, null);
  assert.equal(s.players.find((p) => p.id === b).cash, 1500 + TILES[4].rent);
});

test('dette : vendre ce qu’il faut en un clic, et on voit ce qu’on peut réunir', () => {
  let s = start();
  const [a, b] = s.players.map((p) => p.id);
  own(s, b, 'Marrakech');
  own(s, a, 'Casablanca', 'Fès');
  s.players[0].cash = 1;
  s = roll(s, 1, 3);
  assert.equal(s.phase, 'debt');
  assert.equal(view(s, a).raisable, 1 + 40 + 30);
  assert.equal(view(s, b).raisable, null);
  assert.throws(() => move(s, b, { type: 'raise' }, ctxOf()), /pas ton tour/);
  s = move(s, a, { type: 'raise' }, ctxOf()).state;
  assert.equal(s.debt, null);
  assert.equal(s.props[posOf('Fès')].mortgaged, true, 'une seule ville suffit');
  assert.equal(s.props[posOf('Casablanca')].mortgaged, false, 'on ne vend pas plus qu’il ne faut');
  assert.equal(s.players.find((p) => p.id === b).cash, 1500 + TILES[4].rent);
});

test('si le créancier abandonne pendant une dette, on doit à la banque, et rien ne part chez un joueur sorti', () => {
  let s = start();
  const [a, b] = s.players.map((p) => p.id);
  own(s, b, 'Marrakech');
  own(s, a, 'Casablanca');
  s.players[0].cash = 1;
  s = roll(s, 1, 3);
  s = leave(s, b, ctxOf()).state;
  assert.equal(s.debt.to, null);
  s = move(s, a, { type: 'bankrupt' }, ctxOf()).state;
  assert.equal(s.props[posOf('Casablanca')], undefined, 'la ville retourne à la banque');
});

test('coups mal formés : un refus propre, pas un plantage', () => {
  const s = start();
  const a = s.players[0].id;
  const b = s.players[1].id;
  assert.throws(() => move(s, a, { type: 'build' }, ctxOf()), /niveau libre/);
  assert.doesNotThrow(() => move(s, a, { type: 'trade', to: b, give: null, get: { cash: 1 } }, ctxOf()));
  assert.throws(() => move(s, a, null, ctxOf()), /Action inconnue/);
  for (const bad of [{ type: 'fly' }, { type: 'sell' }, { type: 'mortgage', pos: 'x' }, { type: 'bid', amount: 5 }, { type: 'tradeAccept' }]) {
    assert.throws(() => move(s, a, bad, ctxOf()), (e) => !(e instanceof TypeError), JSON.stringify(bad));
  }
});

test('un joueur ne peut pas repousser le tour d’un robot en lui envoyant des échanges', () => {
  let s = setup(people(1), { bots: 3, rounds: 20, timer: 0 }, ctxOf(5));
  while (s.players[s.cur].id === 1) {
    s.cur = (s.cur + 1) % s.players.length;
    s.phase = 'roll';
  }
  s = timeout(s, { now: 1000, random: seeded(3) }).state;
  while (!s.players[s.cur].bot) s = timeout(s, { now: 1000, random: seeded(4) }).state;
  const due = s.deadline;
  const bot = s.players[s.cur];
  const next = move(s, 1, { type: 'trade', to: bot.id, give: { cash: 1 }, get: {} }, { now: due - 10, random: seeded(1) }).state;
  assert.equal(next.deadline, due, 'l’échéance du robot ne bouge pas');
});

test('messages clairs : montant négatif, ton propre argent', () => {
  const s = start();
  const [a, b] = s.players.map((p) => p.id);
  assert.throws(() => move(s, a, { type: 'trade', to: b, give: { cash: -50 }, get: {} }, ctxOf()), /négatif/);
  assert.throws(() => move(s, a, { type: 'trade', to: b, give: { cash: 999999 }, get: {} }, ctxOf()), /^Error: Tu n'as pas/);
});

test('faillite : le créancier récupère tout, la partie continue', () => {
  let s = start();
  const [a, b] = s.players.map((p) => p.id);
  own(s, b, 'Marrakech');
  own(s, a, 'Casablanca');
  s.players[0].cash = 1;
  s.players[0].passes = 1;
  s = roll(s, 1, 3);
  s = move(s, a, { type: 'bankrupt' }, ctxOf()).state;
  assert.equal(s.players.find((p) => p.id === a).out, true);
  assert.equal(s.props[posOf('Casablanca')].owner, b);
  assert.equal(s.players.find((p) => p.id === b).passes, 1);
  assert.equal(s.over, false);
  assert.notEqual(s.players[s.cur].id, a);
});

test('l’avant-dernier fait faillite : le dernier gagne', () => {
  let s = start(2);
  const [a, b] = s.players.map((p) => p.id);
  own(s, b, 'Marrakech');
  s.players[0].cash = 1;
  s = roll(s, 1, 3);
  s = move(s, a, { type: 'bankrupt' }, ctxOf()).state;
  assert.equal(status(s).over, true);
  assert.deepEqual(status(s).winners, [b]);
});

test('fin des tours : le plus gros patrimoine gagne', () => {
  let s = start(2, { rounds: 1 });
  const [a, b] = s.players.map((p) => p.id);
  own(s, b, 'Rome', 'Tokyo');
  s = roll(s, 1, 2); // Télex possible : on force la suite
  while (!s.over) {
    const id = s.players[s.cur].id;
    if (s.phase === 'buy') s = move(s, id, { type: 'decline' }, ctxOf()).state;
    else if (s.phase === 'debt') s = move(s, id, { type: 'bankrupt' }, ctxOf()).state;
    else if (['fly', 'festival', 'chantier'].includes(s.phase)) s = move(s, id, { type: 'skip' }, ctxOf()).state;
    else if (s.phase === 'end') s = move(s, id, { type: 'endTurn' }, ctxOf()).state;
    else s = move(s, id, { type: 'roll' }, ctxOf(7)).state;
  }
  assert.equal(s.reason, 'rounds');
  const best = Math.max(...s.players.map((p) => worthOf(s, p)));
  assert.equal(worthOf(s, s.players.find((p) => p.id === s.winners[0])), best);
  assert.ok([a, b].includes(s.winners[0]));
});

test('échange : proposé à tout moment, accepté, propriétés et argent transférés', () => {
  let s = start();
  const [a, b, c] = s.players.map((p) => p.id);
  own(s, c, 'Fès');
  own(s, b, 'Marrakech');
  // c propose alors que c'est le tour de a
  s = move(s, c, { type: 'trade', to: b, give: { cash: 100, cities: [posOf('Fès')] }, get: { cities: [posOf('Marrakech')] } }, ctxOf()).state;
  assert.equal(s.trades.length, 1);
  assert.throws(() => move(s, a, { type: 'tradeAccept', id: 1 }, ctxOf()), /n’existe plus/);
  s = move(s, b, { type: 'tradeAccept', id: 1 }, ctxOf()).state;
  assert.equal(s.props[posOf('Fès')].owner, b);
  assert.equal(s.props[posOf('Marrakech')].owner, c);
  assert.equal(s.players.find((p) => p.id === c).cash, 1400);
  assert.equal(s.players.find((p) => p.id === b).cash, 1600);
  assert.equal(s.trades.length, 0);
});

test('échange : vide, avec constructions ou devenu impossible, c’est refusé', () => {
  let s = start();
  const [a, b] = s.players.map((p) => p.id);
  assert.throws(() => move(s, a, { type: 'trade', to: b, give: {}, get: {} }, ctxOf()), /vide/);
  own(s, a, 'Fès');
  s.props[posOf('Fès')].level = 1;
  assert.throws(() => move(s, a, { type: 'trade', to: b, give: { cities: [posOf('Fès')] }, get: {} }, ctxOf()), /constructions/);
  s = move(s, a, { type: 'trade', to: b, give: { cash: 1000 }, get: {} }, ctxOf()).state;
  s.players.find((p) => p.id === a).cash = 10;
  assert.throws(() => move(s, b, { type: 'tradeAccept', id: 1 }, ctxOf()), /n'a pas/);
  s = move(s, a, { type: 'trade', to: b, give: { cash: 5 }, get: {} }, ctxOf()).state;
  s = move(s, b, { type: 'tradeReject', id: 2 }, ctxOf()).state;
  assert.equal(s.trades.find((t) => t.id === 2), undefined);
});

test('abandon : les villes retournent à la banque, le jeu continue', () => {
  let s = start();
  const [a, b, c] = s.players.map((p) => p.id);
  own(s, a, 'Fès');
  s = leave(s, a, ctxOf()).state;
  assert.equal(s.props[posOf('Fès')], undefined);
  assert.equal(s.players[s.cur].id, b);
  s = roll(s, 1, 3);
  s = move(s, b, { type: 'decline' }, ctxOf()).state;
  s = leave(s, b, ctxOf()).state;
  assert.equal(s.over, true);
  assert.deepEqual(s.winners, [c]);
});

test('minuteur : l’absent joue au plus prudent, et le minuteur repart', () => {
  let s = start(3, { timer: 30 });
  assert.equal(s.deadline, 1000 + 30000);
  s = timeout(s, { now: 5000, random: dice(1, 3).random }).state;
  assert.equal(s.phase, 'buy');
  assert.equal(s.deadline, 5000 + 30000);
  s = timeout(s, { now: 6000, random: Math.random }).state;
  assert.equal(s.props[4], undefined);
  assert.equal(s.phase, 'roll');
  assert.equal(s.deadline, 6000 + 30000);
});

test('minuteur : en dette, tout est vendu, sinon faillite', () => {
  let s = start(3, { timer: 30 });
  const [a, b] = s.players.map((p) => p.id);
  own(s, b, 'Marrakech');
  own(s, a, 'Casablanca');
  s.players[0].cash = 1;
  s = roll(s, 1, 3);
  s = timeout(s, ctxOf()).state;
  assert.equal(s.props[posOf('Casablanca')].mortgaged, true);
  assert.equal(s.players.find((p) => p.id === a).out, false);
  assert.equal(s.debt, null);
});

test('la vue ne dévoile pas le paquet', () => {
  const s = start();
  const v = view(s, null);
  assert.equal('deck' in v, false);
  assert.deepEqual(v.actions.build, []);
  assert.ok(Array.isArray(v.players) && v.players[0].worth === 1500);
});

// ——— Les robots du jeu ———

function untilMyTurn(state, id) {
  let s = state;
  let guard = 0;
  while (!s.over && s.players[s.cur].id !== id) {
    guard += 1;
    assert.ok(guard < 5000, 'les robots tournent en rond');
    s = timeout(s, ctxOf(guard)).state;
  }
  return s;
}

test('seul à la table : 3 robots s’ajoutent et on peut jouer', () => {
  const s = setup(people(1), { rounds: 20, timer: 0 }, ctxOf());
  assert.equal(s.players.length, 4);
  assert.equal(s.players.filter((p) => p.bot).length, 3);
  assert.equal(new Set(s.players.map((p) => p.pseudo)).size, 4);
  assert.equal(s.majority, 3);
  const st = status(s);
  assert.deepEqual(st.may, [1], 'seul l’humain peut envoyer des coups');
});

test('le nombre de robots est borné à 10 joueurs au total', () => {
  assert.equal(setup(people(4), { bots: 9, timer: 0 }, ctxOf()).players.length, 10);
  assert.equal(setup(people(2), { bots: 0, timer: 0 }, ctxOf()).players.length, 2);
  assert.equal(setup(people(1), { bots: 1, timer: 0 }, ctxOf()).players.length, 2);
});

test('quand c’est au tour d’un robot, il a une échéance courte et il joue tout seul', () => {
  let s = setup(people(1), { bots: 3, rounds: 3, timer: 0 }, ctxOf(5));
  s = untilMyTurn(s, 1);
  assert.equal(s.players[s.cur].id, 1);
  assert.equal(s.deadline, null, 'sans minuteur, le jeu attend le joueur');
  s = move(s, 1, { type: 'roll' }, dice(1, 2)).state;
  while (s.players[s.cur].id === 1 && !s.over) {
    if (s.phase === 'buy') s = move(s, 1, { type: 'decline' }, ctxOf()).state;
    else if (s.phase === 'end') s = move(s, 1, { type: 'endTurn' }, ctxOf()).state;
    else if (s.phase === 'debt') s = move(s, 1, { type: 'bankrupt' }, ctxOf()).state;
    else if (s.phase === 'roll') s = move(s, 1, { type: 'roll' }, dice(1, 2)).state;
    else s = move(s, 1, { type: 'skip' }, ctxOf()).state;
  }
  if (!s.over) {
    assert.ok(s.players[s.cur].bot);
    assert.ok(s.deadline > 0);
  }
});

test('échange avec un robot : réponse immédiate, il accepte une bonne affaire et refuse une mauvaise', () => {
  let s = setup(people(1), { bots: 3, rounds: 20, timer: 0 }, ctxOf(3));
  const bot = s.players.find((p) => p.bot);
  own(s, bot.id, 'Fès');
  const pos = posOf('Fès');
  const bad = move(s, 1, { type: 'trade', to: bot.id, give: { cash: 1 }, get: { cities: [pos] } }, ctxOf()).state;
  assert.equal(bad.props[pos].owner, bot.id);
  assert.equal(bad.trades.length, 0);
  const good = move(s, 1, { type: 'trade', to: bot.id, give: { cash: 500 }, get: { cities: [pos] } }, ctxOf()).state;
  assert.equal(good.props[pos].owner, 1);
});

test('si le dernier humain part, les robots ne continuent pas sans lui', () => {
  const s = setup(people(1), { bots: 3, rounds: 0, timer: 0 }, ctxOf());
  const out = leave(s, 1, ctxOf()).state;
  assert.equal(out.over, true);
  assert.equal(out.reason, 'humans');
  assert.deepEqual(status(out).winners, [], 'un robot n’est pas un compte du hub');
});

test('des parties avec un humain absent et des robots vont au bout', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const rnd = seeded(seed * 53);
    let now = 0;
    const ctx = () => ({ now: (now += 500), random: rnd });
    let s = setup(people(1 + (seed % 3)), { bots: 1 + (seed % 7), rounds: 12, timer: 30 }, ctx());
    let guard = 0;
    while (!s.over) {
      guard += 1;
      assert.ok(guard < 20000, 'partie sans fin');
      s = timeout(s, ctx()).state;
      for (const p of s.players) assert.ok(Number.isInteger(p.cash) && p.cash >= 0, `argent invalide ${p.pseudo} ${p.cash}`);
    }
    assert.ok(s.winners.length >= 1);
  }
});

// ——— Parties complètes jouées par des robots ———

function botMove(s, id, rnd) {
  const v = view(s, id);
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const me = v.players.find((p) => p.id === id);
  switch (s.phase) {
    case 'roll':
      if (me.blocked && me.passes) return { type: 'usePass' };
      if (v.actions.build.length && me.cash > 500) return { type: 'build', pos: pick(v.actions.build) };
      return { type: 'roll' };
    case 'buy': {
      const t = TILES[me.pos];
      return me.cash >= t.price && rnd() < 0.8 ? { type: 'buy' } : { type: 'decline' };
    }
    case 'fly': return rnd() < 0.2 ? { type: 'fly', pos: pick(TILES.filter((t) => t.type === 'escale' && t.pos !== me.pos)).pos } : { type: 'skip' };
    case 'festival': return v.actions.festival.length ? { type: 'festival', pos: pick(v.actions.festival) } : { type: 'skip' };
    case 'chantier': return v.actions.chantier.length ? { type: 'chantier', pos: pick(v.actions.chantier) } : { type: 'skip' };
    case 'end':
      if (v.actions.unmortgage.length && me.cash > 800) return { type: 'unmortgage', pos: pick(v.actions.unmortgage) };
      if (v.actions.build.length && me.cash > 500) return { type: 'build', pos: pick(v.actions.build) };
      return { type: 'endTurn' };
    case 'debt':
      if (me.cash >= s.debt.amount) return { type: 'pay' };
      if (v.actions.sell.length) return { type: 'sell', pos: v.actions.sell[0] };
      if (v.actions.mortgage.length) return { type: 'mortgage', pos: v.actions.mortgage[0] };
      return { type: 'bankrupt' };
    default: return null;
  }
}

export function playOut(n, seed, options = {}) {
  const rnd = seeded(seed);
  let now = 0;
  const ctx = () => ({ now: (now += 100), random: rnd });
  let s = setup(people(n), { rounds: 25, timer: 0, ...options }, ctx());
  let guard = 0;
  while (!s.over) {
    guard += 1;
    if (guard > 200000) throw new Error('partie sans fin');
    {
      const id = s.players[s.cur].id;
      // De temps en temps, un échange entre deux joueurs au hasard.
      if (rnd() < 0.02) {
        const a = s.players[Math.floor(rnd() * n)];
        const b = s.players[Math.floor(rnd() * n)];
        const cities = Object.keys(s.props).map(Number).filter((pos) => s.props[pos].owner === a.id && !s.props[pos].level);
        if (!a.out && !b.out && a.id !== b.id && cities.length && a.cash >= 10 && s.trades.filter((t) => t.from === a.id).length < 3) {
          s = move(s, a.id, { type: 'trade', to: b.id, give: { cities: [cities[0]] }, get: { cash: Math.min(b.cash, 10) } }, ctx()).state;
          const t = s.trades.at(-1);
          if (b.cash >= t.get.cash && rnd() < 0.5) s = move(s, b.id, { type: 'tradeAccept', id: t.id }, ctx()).state;
        }
      }
      s = move(s, id, botMove(s, id, rnd), ctx()).state;
    }
    for (const p of s.players) assert.ok(Number.isInteger(p.cash) && p.cash >= 0, `argent invalide ${p.cash}`);
    for (const [pos, prop] of Object.entries(s.props)) {
      assert.ok(!s.players.find((p) => p.id === prop.owner)?.out, `ville ${pos} à un joueur sorti`);
      assert.ok(prop.level >= 0 && prop.level <= MAX_LEVEL);
    }
  }
  return s;
}

test('des centaines de parties de robots vont au bout, de 2 à 10 joueurs', () => {
  for (let n = 2; n <= 10; n += 1) {
    for (let seed = 1; seed <= 25; seed += 1) {
      const s = playOut(n, seed * 97 + n);
      assert.equal(s.over, true);
      assert.ok(s.winners.length >= 1);
      assert.ok(s.round <= 26);
    }
  }
});
