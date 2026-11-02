// Tests des règles du poker (déroulé d'une main, mises, pots, abattage, fin de partie) : node --test games/poker/*.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _newGame, _startHand, setup, move, status, view, timeout, leave } from './rules.js';

const RANKS = '23456789TJQKA';
const SUITS = 'shdc';
const card = (str) => SUITS.indexOf(str[1]) * 13 + RANKS.indexOf(str[0]);
const cards = (str) => str.split(' ').map(card);

function seeded(seed = 5) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}
const zero = () => 0; // hasard fixe : le premier siège est le donneur
let NOW = 1_000_000;
const ctx = (now = NOW, random = zero) => ({ now, random });
const players = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, pseudo: `j${i + 1}` }));

// Le paquet commence par les cartes des joueurs : on les intercale avant le tableau.
const deckOf = (holes, board) => {
  const h = holes.flatMap(cards);
  const b = cards(board);
  const rest = Array.from({ length: 52 }, (_, i) => i).filter((c) => !h.includes(c) && !b.includes(c));
  return [...h, ...b, ...rest];
};

// Une partie à n joueurs, tapis donnés, première main truquée. Le siège 0 est le donneur.
function game(n, { stacks, holes, board = '2c 7d 9h Js 3s', opts = {}, handNo = 0 } = {}) {
  let s = _newGame(players(n), { stack: 1000, levelEvery: 0, timer: 30, ...opts }, ctx());
  if (stacks) s.seats.forEach((x, i) => { x.chips = stacks[i]; x.stack0 = stacks[i]; });
  s.handNo = handNo;
  s = _startHand(s, ctx(), holes ? deckOf(holes, board) : null);
  return s;
}
const act = (s, id, action, now = NOW) => move(s, id, action, ctx(now)).state;
const turnId = (s) => status(s).turn;
const chipsOf = (s, id) => s.seats.find((x) => x.id === id).chips;
const totalChips = (s) => s.seats.reduce((n, x) => n + x.chips, 0) + s.seats.reduce((n, x) => n + x.total, 0) - (s.phase === 'result' || s.phase === 'over' ? s.seats.reduce((n, x) => n + x.total, 0) : 0);

// Tout le monde suit ou parle jusqu'à la fin de la main.
function checkDown(s) {
  let guard = 0;
  while (s.phase === 'hand' && guard++ < 100) {
    const id = turnId(s);
    const o = view(s, id).me;
    s = act(s, id, { type: o.canCheck ? 'check' : 'call' });
  }
  return s;
}

test('au départ : blindes postées, cartes distribuées, premier à parler après la grosse blinde', () => {
  const s = setup(players(3), { stack: 1000 }, ctx());
  assert.equal(s.phase, 'hand');
  assert.equal(s.handNo, 1);
  const sb = s.seats[s.sbSeat];
  const bb = s.seats[s.bbSeat];
  assert.equal(sb.bet, 10);
  assert.equal(bb.bet, 20);
  assert.equal(sb.chips, 990);
  assert.equal(bb.chips, 980);
  assert.ok(s.seats.every((x) => x.cards.length === 2));
  assert.equal(new Set(s.seats.flatMap((x) => x.cards)).size, 6, 'six cartes différentes');
  assert.equal(s.deck.length, 46);
  assert.equal(s.seats[s.toAct].id, s.seats[(s.bbSeat + 1) % 3].id, 'sous le feu : le joueur après la grosse blinde');
  assert.notEqual(s.toAct, s.sbSeat);
  assert.equal(s.currentBet, 20);
  assert.equal(totalChips(s), 3000);
});

test('à 3, ordre des places : donneur, petite blinde, grosse blinde', () => {
  const s = game(3);
  assert.equal(s.button, 0);
  assert.equal(s.sbSeat, 1);
  assert.equal(s.bbSeat, 2);
  assert.equal(s.toAct, 0);
});

test('face-à-face : le donneur poste la petite blinde et parle en premier avant le flop, en dernier après', () => {
  let s = game(2);
  assert.equal(s.sbSeat, s.button);
  assert.equal(s.seats[s.button].bet, 10);
  assert.equal(s.seats[1 - s.button].bet, 20);
  assert.equal(s.toAct, s.button, 'le donneur parle en premier avant le flop');
  s = act(s, turnId(s), { type: 'call' });
  s = act(s, turnId(s), { type: 'check' });
  assert.equal(s.board.length, 3);
  assert.equal(s.toAct, 1 - s.button, 'après le flop, la grosse blinde parle en premier');
});

test('les cartes des autres ne sont jamais dans la vue, ni le paquet', () => {
  const s = game(3, { holes: ['As Ad', 'Ks Kd', 'Qs Qd'] });
  const v1 = view(s, 1);
  assert.deepEqual(v1.seats[0].cards, cards('As Ad'));
  assert.equal(v1.seats[1].cards, null);
  assert.equal(v1.seats[2].cards, null);
  const spectator = view(s, null);
  assert.ok(spectator.seats.every((x) => x.cards === null));
  for (const v of [v1, spectator, view(s, 2)]) {
    const json = JSON.stringify(v);
    assert.ok(!('deck' in v));
    assert.ok(!json.includes('"deck"'));
  }
  assert.equal(view(s, 2).seats[1].cards.length, 2);
  assert.equal(view(s, 2).seats[0].cards, null);
});

test('un coup hors tour ou une action inconnue sont refusés avec un message', () => {
  const s = game(3);
  assert.throws(() => act(s, 2, { type: 'call' }), /pas ton tour/);
  assert.throws(() => act(s, 3, { type: 'fold' }), /pas ton tour/);
  assert.throws(() => act(s, 99, { type: 'fold' }), /pas ton tour/);
  assert.throws(() => act(s, turnId(s), { type: 'danser' }), /inconnue/);
  assert.throws(() => act(s, turnId(s), null), /inconnue/);
});

test('parler est refusé s’il y a une mise à suivre, suivre est refusé s’il n’y a rien à suivre', () => {
  let s = game(3);
  assert.throws(() => act(s, 2, { type: 'check' }), /pas ton tour/);
  assert.throws(() => act(s, turnId(s), { type: 'check' }), /suivre \(20\)/);
  s = act(s, turnId(s), { type: 'call' });
  s = act(s, turnId(s), { type: 'call' }); // la petite blinde complète
  assert.equal(s.toAct, 2, 'la grosse blinde a encore la parole (option)');
  assert.throws(() => act(s, 3, { type: 'call' }), /Rien à suivre/);
  s = act(s, 3, { type: 'check' });
  assert.equal(s.street, 'flop');
});

test('la relance minimale est refusée avec le bon montant, puis les relances se cumulent', () => {
  let s = game(3);
  assert.throws(() => act(s, 1, { type: 'raise', to: 39 }), /minimale est à 40/);
  assert.throws(() => act(s, 1, { type: 'raise', to: 20 }), /dépasser la mise actuelle \(20\)/);
  assert.throws(() => act(s, 1, { type: 'raise', to: 'abc' }), /montant/);
  assert.throws(() => act(s, 1, { type: 'raise', to: 41.5 }), /montant/);
  assert.throws(() => act(s, 1, { type: 'raise' }), /montant/);
  s = act(s, 1, { type: 'raise', to: 60 }); // relance de 40
  assert.equal(s.currentBet, 60);
  assert.equal(s.minRaise, 40);
  assert.throws(() => act(s, 2, { type: 'raise', to: 99 }), /minimale est à 100/);
  s = act(s, 2, { type: 'raise', to: 100 });
  assert.equal(s.minRaise, 40);
  assert.equal(s.currentBet, 100);
  assert.equal(totalChips(s), 3000);
});

test('après un flop, la mise minimale est la grosse blinde', () => {
  let s = game(3);
  s = act(s, 1, { type: 'call' });
  s = act(s, 2, { type: 'call' });
  s = act(s, 3, { type: 'check' });
  assert.equal(s.street, 'flop');
  assert.equal(s.currentBet, 0);
  assert.equal(s.toAct, 1, 'après le donneur : la petite blinde parle en premier');
  assert.throws(() => act(s, 2, { type: 'raise', to: 19 }), /minimale est à 20/);
  s = act(s, 2, { type: 'raise', to: 20 });
  assert.equal(s.seats[1].last.t, 'bet');
});

test('tout le monde se couche : la grosse blinde gagne sans montrer, les autres cartes restent cachées', () => {
  let s = game(3, { holes: ['As Ad', 'Ks Kd', 'Qs Qd'] });
  s = act(s, 1, { type: 'fold' });
  s = act(s, 2, { type: 'fold' });
  assert.equal(s.phase, 'result');
  assert.equal(chipsOf(s, 3), 1000 + 10);
  assert.equal(chipsOf(s, 2), 990);
  assert.equal(chipsOf(s, 1), 1000);
  assert.equal(s.showdown.byFold, true);
  assert.deepEqual(s.showdown.shown, []);
  for (const id of [1, 2, 3, null]) {
    const v = view(s, id);
    v.seats.forEach((x, i) => {
      if (v.seats[i].id !== id) assert.equal(x.cards, null, `joueur ${id} ne voit pas les cartes de ${x.id}`);
    });
  }
  assert.equal(status(s).turn, null);
  assert.equal(s.deadline, NOW + 4500);
});

test('abattage : le meilleur brelan gagne, ses cartes et celles du perdant deviennent visibles pour tous', () => {
  let s = game(3, { holes: ['As Ad', 'Ks Kd', '5c 4c'], board: 'Ah Kh 5d 9c 2s' });
  s = act(s, 1, { type: 'call' });
  s = act(s, 2, { type: 'call' });
  s = act(s, 3, { type: 'check' });
  assert.equal(s.board.length, 3);
  // flop, turn, river : tout le monde parle
  s = checkDown(s);
  assert.equal(s.phase, 'result');
  assert.equal(s.board.length, 5);
  // joueur 1 : brelan d'as ; joueur 2 : brelan de rois ; joueur 3 : double paire 5
  assert.equal(chipsOf(s, 1), 1040);
  assert.equal(chipsOf(s, 2), 980);
  assert.equal(chipsOf(s, 3), 980);
  assert.deepEqual(s.showdown.shown, [1, 2, 3]);
  assert.equal(s.showdown.hands[1].name, 'Brelan d’as');
  assert.equal(s.showdown.hands[2].name, 'Brelan de rois');
  assert.equal(s.showdown.hands[3].name, 'Paire de cinq');
  const spectator = view(s, null);
  assert.deepEqual(spectator.seats[0].cards, cards('As Ad'));
  assert.deepEqual(spectator.seats[1].cards, cards('Ks Kd'));
  assert.equal(totalChips(s), 3000);
  assert.equal(s.deadline, NOW + 9000);
});

test('un joueur couché ne montre pas ses cartes à l’abattage des autres', () => {
  let s = game(3, { holes: ['As Ad', 'Ks Kd', '5c 4c'], board: 'Ah Kh 5d 9c 2s' });
  s = act(s, 1, { type: 'raise', to: 60 });
  s = act(s, 2, { type: 'fold' });
  s = act(s, 3, { type: 'call' });
  s = checkDown(s);
  assert.equal(s.phase, 'result');
  assert.deepEqual(s.showdown.shown, [1, 3]);
  const v = view(s, null);
  assert.equal(v.seats[1].cards, null);
  assert.ok(v.seats[0].cards && v.seats[2].cards);
  assert.equal(totalChips(s), 3000);
});

test('égalité : le pot est partagé, le jeton impair va au premier joueur après le donneur', () => {
  // niveau 1 : blindes 15/30. Le joueur 3 (petite blinde) se couche : pot de 15 + 30 + 30 = 75, partagé entre 1 et 2
  let s = game(3, { holes: ['2c 3c', '4d 5d', '6h 7h'], board: 'As Ad Ah Ks Kd', handNo: 7, opts: { levelEvery: 5 } });
  assert.equal(s.sb, 15);
  assert.equal(s.button, 1, 'le donneur tourne');
  // égalité : mains 1 et 2 jouent le tableau (full as par rois) ; on met 6h 7h hors-jeu en les couchant
  while (s.phase === 'hand') {
    const id = turnId(s);
    // les joueurs 1 et 2 suivent, le joueur 3 se couche
    if (id === 3) s = act(s, id, { type: 'fold' });
    else s = act(s, id, { type: view(s, id).me.canCheck ? 'check' : 'call' });
  }
  assert.equal(s.phase, 'result');
  const pot = s.showdown.pots.reduce((n, p) => n + p.amount, 0);
  assert.equal(pot % 2, 1, 'pot impair');
  const g1 = s.showdown.gains[1];
  const g2 = s.showdown.gains[2];
  assert.equal(g1 + g2, pot);
  // à partir du donneur (siège 1 = joueur 2), le premier après lui est le joueur 3 (couché), puis le joueur 1
  assert.equal(g1, (pot + 1) / 2, 'le joueur 1 est le premier gagnant après le donneur');
  assert.equal(g2, (pot - 1) / 2);
  assert.equal(totalChips(s), 3000);
});

test('plusieurs tapis : pot principal et pots secondaires, chacun au meilleur de ses ayants droit', () => {
  // stacks 100 / 300 / 500. Le joueur 1 (le plus court) a la meilleure main, le 2 la deuxième, le 3 la pire.
  let s = game(3, { stacks: [100, 300, 500], holes: ['As Ad', 'Ks Kd', 'Qs Qd'], board: '2c 7d 9h Js 3s' });
  s = act(s, 1, { type: 'allin' });
  s = act(s, 2, { type: 'allin' });
  s = act(s, 3, { type: 'allin' });
  assert.equal(s.phase, 'result');
  assert.equal(s.board.length, 5, 'le tableau est distribué d’un coup');
  const pots = s.showdown.pots;
  assert.deepEqual(pots.map((p) => p.amount), [300, 400, 200]);
  assert.deepEqual(pots.map((p) => p.winners), [[1], [2], [3]]);
  assert.equal(pots[2].refund, true, 'la mise non suivie revient à son auteur');
  assert.equal(chipsOf(s, 1), 300);
  assert.equal(chipsOf(s, 2), 400);
  assert.equal(chipsOf(s, 3), 200);
  assert.equal(totalChips(s), 900);
  assert.equal(s.phase, 'result');
});

test('plusieurs tapis : le plus court perd, le pot secondaire va au meilleur des deux autres', () => {
  let s = game(3, { stacks: [100, 300, 500], holes: ['2s 2d', 'Ks Kd', 'Qs Qd'], board: '7c 8d 9h Js 3s' });
  s = act(s, 1, { type: 'allin' });
  s = act(s, 2, { type: 'allin' });
  s = act(s, 3, { type: 'call' });
  assert.equal(s.phase, 'result');
  assert.equal(chipsOf(s, 1), 0);
  assert.equal(chipsOf(s, 2), 300 + 400, 'le joueur 2 gagne le principal et le secondaire');
  assert.equal(chipsOf(s, 3), 200, 'et la mise de 200 non suivie revient au joueur 3');
  assert.equal(totalChips(s), 900);
  assert.equal(s.seats[0].out, true);
  assert.equal(s.phase, 'result', 'deux joueurs restent : la partie continue');
  assert.equal(s.seats[0].busted, 1);
});

test('égalité sur un pot secondaire seulement', () => {
  // joueur 1 (100) gagne le principal ; joueurs 2 et 3 (300 chacun) font égalité sur le secondaire
  let s = game(3, { stacks: [100, 300, 300], holes: ['As Ad', 'Ks Qd', 'Kd Qs'], board: '2c 7d 9h Js 3s' });
  s = act(s, 1, { type: 'allin' });
  s = act(s, 2, { type: 'allin' });
  s = act(s, 3, { type: 'call' });
  assert.deepEqual(s.showdown.pots.map((p) => p.amount), [300, 400]);
  assert.deepEqual(s.showdown.pots[1].winners, [2, 3]);
  assert.equal(chipsOf(s, 1), 300);
  assert.equal(chipsOf(s, 2), 200);
  assert.equal(chipsOf(s, 3), 200);
});

test('un joueur couché alimente un pot où il n’a pas droit', () => {
  let s = game(3, { stacks: [100, 1000, 1000], holes: ['As Ad', 'Ks Kd', 'Qs Qd'], board: '2c 7d 9h Js 3s' });
  s = act(s, 1, { type: 'allin' });
  s = act(s, 2, { type: 'raise', to: 300 });
  s = act(s, 3, { type: 'fold' }); // la grosse blinde (20) se couche
  // le joueur 1 est en tapis et le joueur 2 seul peut miser : le tableau est distribué d'un coup
  assert.equal(s.phase, 'result');
  assert.deepEqual(s.showdown.pots.map((p) => [p.amount, p.eligible, p.winners]), [[220, [1, 2], [1]], [200, [2], [2]]]);
  assert.equal(chipsOf(s, 1), 220);
  assert.equal(chipsOf(s, 2), 900);
  assert.equal(chipsOf(s, 3), 980);
  assert.equal(totalChips(s), 2100);
});

test('un tapis incomplet ne rouvre pas les enchères pour ceux qui ont déjà parlé', () => {
  // joueur 3 a 150 : tapis à 150 après une mise à 100 = relance de 50 < 80 (relance minimale)
  let s = game(3, { stacks: [1000, 1000, 150], holes: ['As Ad', 'Ks Kd', 'Qs Qd'] });
  s = act(s, 1, { type: 'raise', to: 100 }); // relance de 80
  assert.equal(s.minRaise, 80);
  s = act(s, 2, { type: 'call' }); // le joueur 2 (petite blinde) suit
  s = act(s, 3, { type: 'raise', to: 150 }); // 150 : tapis de 50 de plus, relance incomplète
  assert.equal(s.currentBet, 150);
  assert.equal(s.minRaise, 80);
  assert.equal(s.seats[2].allIn, true);
  assert.equal(s.toAct, 0);
  assert.throws(() => act(s, 1, { type: 'raise', to: 300 }), /pas relancer/);
  assert.throws(() => act(s, 1, { type: 'allin' }), /pas relancer/);
  const v = view(s, 1);
  assert.equal(v.me.canRaise, false);
  s = act(s, 1, { type: 'call' });
  assert.equal(s.toAct, 1);
  assert.throws(() => act(s, 2, { type: 'raise', to: 400 }), /pas relancer/);
  s = act(s, 2, { type: 'call' });
  assert.equal(s.street, 'flop');
});

test('un tapis qui est une vraie relance rouvre les enchères', () => {
  let s = game(3, { stacks: [1000, 1000, 400], holes: ['As Ad', 'Ks Kd', 'Qs Qd'] });
  s = act(s, 1, { type: 'raise', to: 100 });
  s = act(s, 2, { type: 'call' });
  s = act(s, 3, { type: 'allin' }); // 400 : relance de 300
  assert.equal(s.minRaise, 300);
  assert.equal(s.currentBet, 400);
  s = act(s, 1, { type: 'raise', to: 700 });
  assert.equal(s.currentBet, 700);
});

test('suivre avec moins que la mise : tapis, et le suivant n’a plus à répondre pour la différence', () => {
  let s = game(3, { stacks: [1000, 1000, 50], holes: ['As Ad', 'Ks Kd', 'Qs Qd'] });
  s = act(s, 1, { type: 'raise', to: 200 });
  s = act(s, 2, { type: 'fold' });
  s = act(s, 3, { type: 'call' });
  assert.equal(s.seats[2].allIn, true);
  assert.equal(s.seats[2].total, 50);
  assert.equal(s.phase, 'result', 'un seul joueur peut encore miser : le tableau est distribué jusqu’à l’abattage');
  assert.equal(totalChips(s), 2050);
});

test('un montant plus grand que le tapis devient un tapis', () => {
  let s = game(3);
  s = act(s, 1, { type: 'raise', to: 99999 });
  assert.equal(s.seats[0].allIn, true);
  assert.equal(s.seats[0].bet, 1000);
});

test('si la grosse blinde ne peut pas la payer en entier, elle est tapis et les autres suivent la grosse blinde', () => {
  let s = game(3, { stacks: [1000, 1000, 8], holes: ['As Ad', 'Ks Kd', 'Qs Qd'] });
  assert.equal(s.seats[2].bet, 8);
  assert.equal(s.seats[2].allIn, true);
  assert.equal(s.currentBet, 20);
  s = act(s, 1, { type: 'call' });
  s = act(s, 2, { type: 'call' });
  assert.equal(s.street, 'flop');
  assert.equal(totalChips(s), 2008);
});

test('toutes les blindes en tapis : on distribue tout et on va à l’abattage tout de suite', () => {
  const s = game(2, { stacks: [5, 8], holes: ['As Ad', 'Ks Kd'] });
  assert.equal(s.phase, 'result');
  assert.equal(s.board.length, 5);
  assert.equal(chipsOf(s, 1) + chipsOf(s, 2), 13);
});

test('délai de parole : check si possible, sinon couché', () => {
  let s = game(3);
  assert.equal(s.deadline, NOW + 30000);
  let t = timeout(s, ctx(NOW + 30000)).state;
  assert.equal(t.seats[0].folded, true, 'il y a une mise à suivre : couché');
  assert.equal(t.seats[0].misses, 1);
  t = act(t, 2, { type: 'call' });
  assert.equal(t.toAct, 2);
  t = timeout(t, ctx(NOW + 60000)).state; // la grosse blinde peut parler : check
  assert.equal(t.seats[2].folded, false);
  assert.equal(t.seats[2].misses, 1);
  assert.equal(t.street, 'flop');
  const r = timeout(game(2), ctx(NOW + 30000)).state; // à deux, le donneur doit suivre : couché
  assert.equal(r.phase, 'result');
  assert.equal(r.showdown.byFold, true);
});

test('minuteur par action : sans option, pas d’échéance pendant les mises', () => {
  const s = game(3, { opts: { timer: 0 } });
  assert.equal(s.deadline, null);
  assert.equal(status(s).deadline, null);
});

test('un joueur qui laisse passer deux minuteurs n’a plus que 5 secondes', () => {
  let s = game(3, { opts: { timer: 60 } });
  s.seats[1].misses = 2;
  s = act(s, 1, { type: 'call' });
  assert.equal(s.toAct, 1);
  assert.equal(s.deadline, NOW + 5000);
  s = act(s, 2, { type: 'call' });
  assert.equal(s.seats[1].misses, 0, 'agir remet le compteur à zéro');
});

test('timeout en phase « résultat » : la main suivante commence, le donneur a tourné', () => {
  let s = game(3);
  s = act(s, 1, { type: 'fold' });
  s = act(s, 2, { type: 'fold' });
  assert.equal(s.phase, 'result');
  const t = timeout(s, ctx(NOW + 5000)).state;
  assert.equal(t.phase, 'hand');
  assert.equal(t.handNo, 2);
  assert.equal(t.button, 1);
  assert.equal(t.showdown, null);
  assert.ok(t.seats.every((x) => x.cards.length === 2));
  assert.equal(totalChips(t), 3000);
});

test('les blindes montent toutes les N mains', () => {
  let s = setup(players(2), { stack: 1000, levelEvery: 5 }, ctx(0, seeded()));
  assert.equal(s.sb, 10);
  for (let i = 0; i < 4; i++) {
    s = act(s, turnId(s), { type: 'fold' });
    s = timeout(s, ctx(NOW)).state;
  }
  assert.equal(s.handNo, 5);
  assert.equal(s.sb, 10, 'cinquième main : encore le niveau 1');
  s = act(s, turnId(s), { type: 'fold' });
  s = timeout(s, ctx(NOW)).state;
  assert.equal(s.handNo, 6);
  assert.equal(s.sb, 15);
  assert.equal(s.bb, 30);
  assert.equal(view(s, 1).handsToLevel, 5);
  const none = setup(players(2), { stack: 1000, levelEvery: 0 }, ctx());
  assert.equal(view(none, 1).handsToLevel, null);
});

test('tapis de départ : les blindes s’adaptent', () => {
  assert.equal(setup(players(2), { stack: 2000 }, ctx()).sb, 20);
  assert.equal(setup(players(2), { stack: 5000 }, ctx()).sb, 50);
  assert.equal(setup(players(2), { stack: 123 }, ctx()).opts.stack, 1000, 'valeur inconnue : tapis par défaut');
});

test('éliminé sans jetons, le dernier joueur gagne la partie', () => {
  let s = game(2, { holes: ['As Ad', 'Ks Kd'], board: '2c 7d 9h Js 3s' });
  s = act(s, turnId(s), { type: 'allin' });
  s = act(s, turnId(s), { type: 'call' });
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 1);
  assert.deepEqual(status(s), { over: true, turn: null, winners: [1] });
  assert.equal(chipsOf(s, 1), 2000);
  assert.equal(s.seats[1].out, true);
  const v = view(s, 2);
  assert.deepEqual(v.ranking, [1, 2]);
  assert.deepEqual(v.seats[0].cards, cards('As Ad'), 'les mains montrées à l’abattage restent visibles à la fin');
});

test('trois joueurs : classement final selon l’ordre d’élimination', () => {
  let s = game(3, { stacks: [100, 300, 600], holes: ['2s 3d', 'Ks Kd', 'Qs Qd'], board: '7c 8d Jh 4s 9s' });
  s = act(s, 1, { type: 'allin' });
  s = act(s, 2, { type: 'allin' });
  s = act(s, 3, { type: 'call' });
  assert.equal(s.phase, 'result');
  assert.equal(s.seats[0].out, true);
  assert.equal(chipsOf(s, 3), 300, 'ses 300 de mise suivis sont perdus : 600 - 300');
  assert.equal(chipsOf(s, 2), 700);
  s = timeout(s, ctx(NOW + 9000)).state;
  assert.equal(s.phase, 'hand');
  assert.equal(s.handNo, 2);
  assert.equal(s.seats.filter((x) => !x.out).length, 2);
  assert.ok(s.seats[0].cards.length === 0, 'le joueur éliminé ne reçoit pas de cartes');
  assert.equal(s.sbSeat === 0 || s.bbSeat === 0 || s.button === 0, false, 'ni blinde ni donneur pour l’éliminé');
});

test('abandon : le joueur dont c’est le tour se couche et la partie continue', () => {
  let s = game(3);
  s = leave(s, 1, ctx()).state;
  assert.equal(s.seats[0].out, true);
  assert.equal(s.seats[0].left, true);
  assert.equal(s.toAct, 1, 'c’est maintenant à la petite blinde');
  assert.equal(totalChips(s), 3000, 'ses jetons restent comptés (hors jeu)');
});

test('abandon hors de son tour : la partie continue, il ne parle plus', () => {
  let s = game(3);
  s = leave(s, 3, ctx()).state;
  assert.equal(s.toAct, 0, 'toujours au même joueur');
  s = act(s, 1, { type: 'call' });
  s = act(s, 2, { type: 'call' });
  assert.equal(s.street, 'flop');
  assert.equal(s.toAct, 1);
  assert.deepEqual(s.seats.filter((x) => !x.out).map((x) => x.id), [1, 2]);
});

test('abandon d’un adversaire à deux : l’autre gagne', () => {
  let s = game(2);
  s = leave(s, 2, ctx()).state;
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 1);
  assert.deepEqual(status(s).winners, [1]);
  assert.ok(chipsOf(s, 1) >= 1000);
});

test('abandon pendant le résultat, et abandon répété sans effet', () => {
  let s = game(3);
  s = act(s, 1, { type: 'fold' });
  s = act(s, 2, { type: 'fold' });
  const t = leave(s, 1, ctx()).state;
  assert.equal(t.phase, 'result');
  assert.equal(t.seats[0].out, true);
  assert.equal(leave(t, 1, ctx()).state, t);
  const next = timeout(t, ctx(NOW + 5000)).state;
  assert.equal(next.phase, 'hand');
  assert.equal(next.seats[0].cards.length, 0);
  const alone = leave(t, 2, ctx()).state;
  assert.equal(alone.phase, 'over');
  assert.equal(alone.winner, 3);
});

test('l’état reste du JSON pur et n’est jamais modifié', () => {
  const s = game(3, { holes: ['As Ad', 'Ks Kd', 'Qs Qd'] });
  const before = JSON.stringify(s);
  act(s, 1, { type: 'raise', to: 100 });
  try { act(s, 1, { type: 'raise', to: 3 }); } catch { /* attendu */ }
  view(s, 1);
  status(s);
  timeout(s, ctx(NOW + 99999));
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(JSON.parse(before), s);
});

test('mains jouées au hasard : jamais de jeton perdu ni créé, jamais de blocage, jamais d’erreur', () => {
  for (let seed = 1; seed <= 120; seed++) {
    const rnd = seeded(seed * 7919);
    const n = 2 + Math.floor(rnd() * 8);
    const stack = [1000, 2000, 5000][Math.floor(rnd() * 3)];
    let now = NOW;
    let s = setup(players(n), { stack, levelEvery: [0, 5, 8][seed % 3], timer: [0, 30][seed % 2] }, ctx(now, rnd));
    const expected = n * stack;
    let steps = 0;
    while (s.phase !== 'over' && steps++ < 4000) {
      assert.equal(s.seats.reduce((a, x) => a + x.chips + (s.phase === 'hand' ? x.total : 0), 0), expected, `jetons conservés (graine ${seed})`);
      if (s.phase === 'result') {
        now += 9000;
        s = timeout(s, ctx(now, rnd)).state;
        continue;
      }
      const id = status(s).turn;
      assert.ok(id !== null, 'quelqu’un doit parler');
      const o = view(s, id).me;
      assert.ok(o, 'le joueur voit ses options');
      const r = rnd();
      let action;
      if (r < 0.04 && s.seats.filter((x) => !x.out).length > 2) {
        s = leave(s, id, ctx(now, rnd)).state;
        continue;
      }
      if (r < 0.12) action = o.canRaise ? { type: 'allin' } : { type: o.canCheck ? 'check' : 'call' };
      else if (r < 0.3 && o.canRaise) action = { type: 'raise', to: o.minTo + Math.floor(rnd() * (o.maxTo - o.minTo + 1)) };
      else if (r < 0.55 && !o.canCheck) action = { type: 'fold' };
      else action = { type: o.canCheck ? 'check' : 'call' };
      if (action.type === 'raise' && !o.canRaise) action = { type: 'call' };
      s = move(s, id, action, ctx(now, rnd)).state;
      if (rnd() < 0.03 && s.phase === 'hand') s = timeout(s, ctx(now + 31000, rnd)).state;
    }
    assert.equal(s.phase, 'over', `la partie finit (graine ${seed})`);
    assert.equal(s.seats.reduce((a, x) => a + x.chips, 0), expected);
    assert.equal(s.seats.filter((x) => !x.out).length, 1);
    assert.equal(status(s).winners.length, 1);
    const winner = s.seats.find((x) => x.id === s.winner);
    assert.ok(winner.chips > 0);
  }
});
