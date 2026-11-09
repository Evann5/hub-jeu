// Président : jeu de plis à 52 cartes (3 à 8 joueurs). Les règles sont pures : pas de réseau, pas de base, pas d'affichage.
//
// Cartes : « valeur + enseigne », par exemple 7H, 10S, AC, 2D. Enseignes : S pique, H cœur, D carreau, C trèfle.
// Force croissante : 3 4 5 6 7 8 9 10 J Q K A 2 (le 2 est le plus fort).

export const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
export const SUITS = ['S', 'H', 'D', 'C'];
const TWO = RANKS.length - 1;
const BETWEEN_MS = 12000; // pause entre deux manches
const LOG_SIZE = 6;

export const rankOf = (card) => RANKS.indexOf(card.slice(0, -1));
const suitOf = (card) => SUITS.indexOf(card.slice(-1));
const cmp = (a, b) => rankOf(a) - rankOf(b) || suitOf(a) - suitOf(b);

export function buildDeck() {
  return RANKS.flatMap((r) => SUITS.map((s) => `${r}${s}`)); // 52 cartes
}

// Titre d'un rang (0 = premier) dans une manche de m joueurs.
export function titleOf(pos, m) {
  if (pos === 0) return 'Président';
  if (pos === m - 1) return 'Pauvre';
  if (m >= 4 && pos === 1) return 'Vice-président';
  if (m >= 4 && pos === m - 2) return 'Vice-pauvre';
  return 'Neutre';
}

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isActive = (s, id) => !s.out.includes(id) && !s.finished.includes(id);
const alive = (s) => s.players.filter((id) => !s.out.includes(id));
const inRound = (s) => s.players.filter((id) => s.dealt.includes(id));

// ——— Mise en place ———

function deal(s, ctx) {
  const ids = alive(s);
  const deck = shuffle(buildDeck(), ctx.random);
  s.hands = Object.fromEntries(s.players.map((id) => [id, []]));
  deck.forEach((c, i) => s.hands[ids[i % ids.length]].push(c));
  for (const id of ids) s.hands[id].sort(cmp);
  s.dealt = ids;
  s.finished = [];
  s.pli = null;
  s.stack = [];
  s.last = null;
  s.passed = [];
  s.result = null;
  s.exchange = null;
  s.phase = 'play';
}

// Ordre des valeurs : normal (le 2 est la plus forte) ou inversé pendant une révolution (le 3 est la plus forte).
const beats = (s, rank, ref) => (s.revolution ? rank <= ref : rank >= ref);
const topRank = (s) => (s.revolution ? 0 : TWO);
const weakFirst = (s) => (a, b) => (s.revolution ? cmp(b, a) : cmp(a, b));

function startRound(s, ctx) {
  s.revolution = false;
  deal(s, ctx);
  const prev = s.lastRanks.filter((id) => s.dealt.includes(id));
  if (s.round === 1 || prev.length < 2) {
    // Première manche : celui qui a le 3 de trèfle ouvre (sinon le plus petit 3).
    const holder = s.dealt.find((id) => s.hands[id].includes('3C')) ?? s.dealt[0];
    s.turn = s.players.indexOf(holder);
    setDeadline(s, ctx);
    return;
  }
  const president = prev[0];
  const pauvre = prev[prev.length - 1];
  const m = prev.length;
  // Échange automatique des deux meilleures cartes du Pauvre contre deux cartes au choix du Président.
  const best = s.hands[pauvre].slice().sort((a, b) => cmp(b, a)).slice(0, 2);
  s.hands[pauvre] = s.hands[pauvre].filter((c) => !best.includes(c));
  s.hands[president] = [...s.hands[president], ...best].sort(cmp);
  // Chez les vice : une carte, la meilleure du Vice-pauvre contre la plus faible du Vice-président (automatique).
  let vice = null;
  if (m >= 4) {
    const vp = prev[1];
    const vpauvre = prev[m - 2];
    const up = s.hands[vpauvre].slice().sort((a, b) => cmp(b, a))[0];
    const down = s.hands[vp].slice().sort(cmp)[0];
    s.hands[vpauvre] = [...s.hands[vpauvre].filter((c) => c !== up), down].sort(cmp);
    s.hands[vp] = [...s.hands[vp].filter((c) => c !== down), up].sort(cmp);
    vice = { vp, vpauvre };
  }
  s.exchange = { president, pauvre, received: best, given: null, vice };
  s.phase = 'exchange';
  s.turn = s.players.indexOf(president);
  note(s, { k: 'exchange', president, pauvre, cards: best });
  setDeadline(s, ctx);
}

export function setup(players, options, ctx) {
  const ids = players.map((p) => p.id);
  const s = {
    players: ids,
    out: [],
    dealt: [],
    hands: {},
    turn: 0,
    phase: 'play',
    pli: null, // { rank, count, by, cards } : la dernière pose, à battre
    stack: [], // les poses précédentes du pli, pour l'affichage
    last: null, // qui a posé en dernier : le pli lui revient si tout le monde passe
    passed: [],
    finished: [], // ordre de sortie de la manche
    lastRanks: [], // classement de la manche précédente
    exchange: null,
    result: null,
    scores: Object.fromEntries(ids.map((id) => [id, 0])),
    round: 1,
    rounds: Math.max(1, Math.round(Number(options?.rounds)) || 1),
    timer: [20, 30, 60].includes(Number(options?.timer)) ? Number(options.timer) : 0,
    revolutionRule: options?.revolution !== false, // un carré inverse l'ordre des cartes jusqu'à la fin de la manche
    revolution: false,
    deadline: null,
    winners: [],
    log: [],
    seq: 0,
  };
  startRound(s, ctx);
  return s;
}

// ——— Aides internes (elles modifient la copie de travail) ———

function setDeadline(s, ctx) {
  s.deadline = s.timer ? ctx.now + s.timer * 1000 : null;
}

function note(s, entry) {
  s.seq += 1;
  s.log = [...s.log, { n: s.seq, ...entry }].slice(-LOG_SIZE);
}

const curId = (s) => s.players[s.turn];

function mustBeActive(s, id) {
  if (!s.players.includes(id) || s.out.includes(id)) throw new Error('Tu ne joues plus dans cette partie.');
}

function mustBeTurn(s, id) {
  mustBeActive(s, id);
  if (s.phase === 'over') throw new Error('La partie est terminée.');
  if (s.phase === 'between') throw new Error('La manche est finie : attends la suivante.');
  if (s.phase === 'exchange') throw new Error(id === s.exchange.president ? 'Choisis les deux cartes à donner au Pauvre.' : "L’échange de cartes est en cours.");
  if (curId(s) !== id) throw new Error("Ce n’est pas ton tour.");
}

// Cherche qui joue après `from`. Si on retombe sur celui qui a posé en dernier, le pli est terminé :
// il est ramassé et la personne suivante (lui, s'il joue encore) ouvre un nouveau pli.
function advance(s, from, skip, ctx) {
  const n = s.players.length;
  const lastSeat = s.last ? s.players.indexOf(s.last) : -1;
  const step = (seat) => {
    let p = seat;
    for (let i = 0; i < n; i++) {
      p = (p + 1) % n;
      if (p === lastSeat) {
        while (!isActive(s, s.players[p])) p = (p + 1) % n;
        return { seat: p, ended: true };
      }
      if (isActive(s, s.players[p])) return { seat: p, ended: false };
    }
    return { seat: from, ended: true };
  };
  let r = step(from);
  if (skip && !r.ended) {
    note(s, { k: 'skip', target: s.players[r.seat] });
    r = step(r.seat);
  }
  if (r.ended) clearPli(s, s.players[r.seat]);
  s.turn = r.seat;
  setDeadline(s, ctx);
}

function clearPli(s, leader) {
  if (s.pli) note(s, { k: 'clear', by: s.pli.by, next: leader });
  s.pli = null;
  s.stack = [];
  s.last = null;
  s.passed = [];
}

function finishRound(s, ctx) {
  const rest = s.dealt.filter((id) => !s.finished.includes(id) && !s.out.includes(id));
  const quitters = s.out.filter((id) => s.dealt.includes(id) && !s.finished.includes(id)).reverse();
  const order = [...s.finished, ...rest, ...quitters];
  const m = order.length;
  const gains = {};
  order.forEach((id, pos) => {
    gains[id] = m - 1 - pos;
    s.scores[id] = (s.scores[id] || 0) + gains[id];
  });
  s.lastRanks = order;
  s.result = { order, titles: Object.fromEntries(order.map((id, pos) => [id, titleOf(pos, m)])), gains };
  s.pli = null;
  s.stack = [];
  s.last = null;
  s.passed = [];
  note(s, { k: 'round', president: order[0] });
  if (s.round >= s.rounds) {
    const ids = alive(s);
    const best = Math.max(...ids.map((id) => s.scores[id]));
    const tied = ids.filter((id) => s.scores[id] === best);
    // À égalité de points : le mieux classé à la dernière manche.
    s.winners = tied.length > 1 ? [order.find((id) => tied.includes(id))] : tied;
    s.phase = 'over';
    s.deadline = null;
  } else {
    s.phase = 'between';
    s.deadline = ctx.now + BETWEEN_MS;
  }
}

// Après un coup ou un abandon : la manche est-elle finie ?
function roundDone(s) {
  return s.dealt.filter((id) => isActive(s, id)).length <= 1;
}

// ——— Coups ———

function doPlay(s, id, cards, ctx) {
  const hand = s.hands[id];
  const rank = rankOf(cards[0]);
  const before = s.pli;
  if (before) {
    if (cards.length !== before.count) {
      throw new Error(`Il faut poser exactement ${before.count} carte${before.count > 1 ? 's' : ''} de la même valeur.`);
    }
    if (!beats(s, rank, before.rank)) {
      throw new Error(s.revolution
        ? `Révolution : il faut une valeur plus faible ou égale (${RANKS[before.rank]} ou moins).`
        : `Il faut une valeur plus forte ou égale (${RANKS[before.rank]} ou mieux).`);
    }
  }
  s.hands[id] = hand.filter((c) => !cards.includes(c));
  if (before) s.stack = [...s.stack, before.cards].slice(-3);
  s.pli = { rank, count: cards.length, by: id, cards: cards.slice().sort(cmp) };
  s.last = id;
  s.passed = [];
  const equal = Boolean(before) && rank === before.rank;
  const strongest = rank === topRank(s);
  note(s, { k: 'play', by: id, cards: s.pli.cards, equal });
  if (cards.length === 4 && s.revolutionRule) {
    // Un carré déclenche la révolution (ou la contre-révolution) : l'ordre des valeurs s'inverse.
    s.revolution = !s.revolution;
    note(s, { k: 'revolution', by: id, on: s.revolution });
  }
  if (!s.hands[id].length) {
    s.finished.push(id);
    note(s, { k: 'out', by: id, pos: s.finished.length - 1 });
  }
  if (roundDone(s)) {
    finishRound(s, ctx);
    return;
  }
  const seat = s.players.indexOf(id);
  if (strongest) {
    // La plus forte valeur (le 2, ou le 3 pendant une révolution) ramasse le pli tout de suite : le même joueur rouvre (le suivant s'il n'a plus de cartes).
    note(s, { k: 'two', by: id });
    clearPli(s, isActive(s, id) ? id : null);
    if (isActive(s, id)) {
      s.turn = seat;
      setDeadline(s, ctx);
    } else {
      advance(s, seat, false, ctx); // il n'a plus de cartes : le joueur suivant ouvre
    }
    return;
  }
  advance(s, seat, equal, ctx);
}

function actPlay(s, id, action, ctx) {
  mustBeTurn(s, id);
  const cards = Array.isArray(action.cards) ? action.cards.map(String) : [];
  if (!cards.length) throw new Error('Choisis au moins une carte.');
  if (cards.length > 4) throw new Error('Tu peux poser au plus 4 cartes à la fois.');
  if (new Set(cards).size !== cards.length) throw new Error('Une même carte est choisie deux fois.');
  for (const c of cards) if (!s.hands[id].includes(c)) throw new Error("Tu n’as pas toutes ces cartes.");
  if (new Set(cards.map(rankOf)).size !== 1) throw new Error('Les cartes posées doivent toutes avoir la même valeur.');
  doPlay(s, id, cards, ctx);
}

function doPass(s, id, ctx) {
  s.passed = [...s.passed, id];
  note(s, { k: 'pass', by: id });
  advance(s, s.players.indexOf(id), false, ctx);
}

function actPass(s, id, ctx) {
  mustBeTurn(s, id);
  if (!s.pli) throw new Error('Tu ouvres le pli : pose au moins une carte.');
  doPass(s, id, ctx);
}

// Le Président rend deux cartes au Pauvre.
function doGive(s, cards, ctx) {
  const { president, pauvre } = s.exchange;
  s.hands[president] = s.hands[president].filter((c) => !cards.includes(c));
  s.hands[pauvre] = [...s.hands[pauvre], ...cards].sort(cmp);
  s.exchange = { ...s.exchange, given: cards };
  s.phase = 'play';
  s.turn = s.players.indexOf(pauvre); // le Pauvre ouvre la manche
  note(s, { k: 'given', by: president, to: pauvre });
  setDeadline(s, ctx);
}

function actGive(s, id, action, ctx) {
  mustBeActive(s, id);
  if (s.phase !== 'exchange') throw new Error("Il n’y a pas d’échange de cartes en cours.");
  if (id !== s.exchange.president) throw new Error('Seul le Président choisit les cartes qu’il rend.');
  const cards = Array.isArray(action.cards) ? action.cards.map(String) : [];
  if (cards.length !== 2 || new Set(cards).size !== 2) throw new Error('Choisis exactement 2 cartes différentes à donner au Pauvre.');
  for (const c of cards) if (!s.hands[id].includes(c)) throw new Error("Tu n’as pas toutes ces cartes.");
  doGive(s, cards, ctx);
}

export function move(state, playerId, action, ctx) {
  const s = structuredClone(state);
  const a = action || {};
  switch (a.type) {
    case 'play': actPlay(s, playerId, a, ctx); break;
    case 'pass': actPass(s, playerId, ctx); break;
    case 'give': actGive(s, playerId, a, ctx); break;
    case 'next':
      mustBeActive(s, playerId);
      if (s.phase !== 'between') throw new Error('Pas de manche à lancer pour le moment.');
      s.round += 1;
      startRound(s, ctx);
      break;
    default: throw new Error('Coup inconnu.');
  }
  return { state: s };
}

// Minuteur échu : manche suivante, échange automatique, pose de la carte la plus faible si on ouvre, sinon on passe.
export function timeout(state, ctx) {
  const s = structuredClone(state);
  if (s.phase === 'over') return { state: s };
  if (s.phase === 'between') {
    s.round += 1;
    startRound(s, ctx);
  } else if (s.phase === 'exchange') {
    const weakest = s.hands[s.exchange.president].slice().sort(cmp).slice(0, 2);
    doGive(s, weakest, ctx);
  } else {
    const id = curId(s);
    note(s, { k: 'timeout', by: id });
    if (s.pli) doPass(s, id, ctx);
    else doPlay(s, id, [s.hands[id].slice().sort(weakFirst(s))[0]], ctx);
  }
  return { state: s };
}

// Abandon : ses cartes sortent du jeu, il termine dernier de la manche, la partie continue.
export function leave(state, playerId, ctx) {
  const s = structuredClone(state);
  if (!s.players.includes(playerId) || s.out.includes(playerId) || s.phase === 'over') return { state: s };
  const wasTurn = s.phase === 'play' && curId(s) === playerId;
  const ex = s.exchange;
  const exchanging = s.phase === 'exchange';
  if (exchanging && ex.president === playerId) {
    // Le Président part avant d'avoir rendu : le Pauvre récupère ses cartes.
    s.hands[ex.pauvre] = [...s.hands[ex.pauvre], ...ex.received].sort(cmp);
  }
  s.hands[playerId] = [];
  s.out.push(playerId);
  s.passed = s.passed.filter((x) => x !== playerId);
  note(s, { k: 'left', by: playerId });
  const left = alive(s);
  if (left.length <= 1) {
    s.phase = 'over';
    s.winners = left;
    s.deadline = null;
    return { state: s };
  }
  if (s.phase === 'between') return { state: s };
  if (exchanging && (ex.president === playerId || ex.pauvre === playerId)) {
    // L'échange est annulé : le Pauvre ouvre (ou le joueur suivant s'il est parti).
    s.exchange = { ...ex, given: [] };
    s.phase = 'play';
    const opener = ex.pauvre === playerId ? ex.president : ex.pauvre;
    s.turn = s.players.indexOf(opener);
    setDeadline(s, ctx);
    return { state: s };
  }
  if (roundDone(s)) {
    finishRound(s, ctx);
    return { state: s };
  }
  if (wasTurn) advance(s, s.turn, false, ctx);
  return { state: s };
}

// ——— Ce que voit chaque personne ———

// Valeurs que je peux poser maintenant (selon le pli en cours et ma main).
function playableRanks(s, hand) {
  const counts = {};
  for (const c of hand) counts[rankOf(c)] = (counts[rankOf(c)] || 0) + 1;
  return Object.keys(counts).map(Number).sort((a, b) => a - b)
    .filter((r) => (s.pli ? counts[r] >= s.pli.count && beats(s, r, s.pli.rank) : true))
    .map((r) => RANKS[r]);
}

export function view(s, playerId) {
  const seated = playerId !== null && s.players.includes(playerId) && !s.out.includes(playerId);
  const hand = seated ? s.hands[playerId].slice().sort(cmp) : [];
  const playing = s.phase === 'play';
  const myTurn = seated && playing && curId(s) === playerId;
  const ex = s.exchange;
  const mine = ex && (playerId === ex.pauvre || playerId === ex.president) ? ex.given : null;
  const prev = s.lastRanks.filter((id) => s.dealt.includes(id));
  return {
    players: s.players,
    out: s.out,
    counts: Object.fromEntries(s.players.map((id) => [id, s.hands[id].length])),
    hand,
    phase: s.phase,
    turn: playing ? curId(s) : null,
    pli: s.pli,
    revolution: Boolean(s.revolution),
    stack: s.stack,
    passed: s.passed,
    finished: s.finished,
    // Titre de chacun tiré de la manche précédente (affiché pendant la manche en cours).
    roles: Object.fromEntries(prev.map((id, pos) => [id, titleOf(pos, prev.length)])),
    playable: myTurn ? playableRanks(s, hand) : [],
    canPass: myTurn && Boolean(s.pli),
    exchange: ex && { president: ex.president, pauvre: ex.pauvre, received: ex.received, given: mine, done: ex.given !== null, vice: ex.vice },
    scores: s.scores,
    round: s.round,
    rounds: s.rounds,
    timer: s.timer,
    deadline: s.deadline,
    log: s.log,
    result: s.result,
    winners: s.winners,
  };
}

export function status(s) {
  if (s.phase === 'over') return { turn: null, over: true, winners: s.winners, deadline: null };
  // Entre deux manches, n'importe qui peut lancer la suivante : coup libre, sans « à toi de jouer ».
  if (s.phase === 'between') return { turn: null, may: alive(s), over: false, winners: [], deadline: s.deadline };
  const turn = s.phase === 'exchange' ? s.exchange.president : curId(s);
  return { turn, over: false, winners: [], deadline: s.deadline };
}
