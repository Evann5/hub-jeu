// Crânes et roses : chacun a 4 disques (3 roses, 1 crâne). On en pose en secret, puis on parie combien de disques
// on peut retourner sans tomber sur un crâne. Deux défis réussis gagnent ; sans disque, on est éliminé.
// Règles pures : ni réseau, ni base, ni affichage. Le hasard ne sert qu'à choisir le disque perdu, le premier joueur
// et les retournements du minuteur.

const WIN_POINTS = 2;
const RESULT_SECS = 12; // pause après chaque défi pour regarder les disques retournés
const LOG_MAX = 60;

const clone = (x) => structuredClone(x);

export const isOut = (s, id) => s.out.includes(id);
const alive = (s) => s.order.filter((id) => !isOut(s, id));

function nextAlive(s, id) {
  const n = s.order.length;
  const from = s.order.indexOf(id);
  for (let k = 1; k <= n; k++) {
    const cand = s.order[(from + k) % n];
    if (!isOut(s, cand)) return cand;
  }
  return id;
}

const discsOf = (s, id) => s.own[id].roses + (s.own[id].skull ? 1 : 0);
// Disques encore dans la main d'un joueur (ceux de sa pile n'y sont plus).
function handOf(s, id) {
  const pile = s.pile[id];
  const roses = pile.filter((d) => d === 'r').length;
  return { roses: Math.max(0, s.own[id].roses - roses), skull: s.own[id].skull && !pile.includes('s') };
}
const totalOnTable = (s) => s.order.reduce((n, id) => n + s.pile[id].length, 0);
const revealedTotal = (s) => s.order.reduce((n, id) => n + s.revealed[id], 0);

function note(s, entry) {
  s.log.push(entry);
  if (s.log.length > LOG_MAX) s.log.splice(0, s.log.length - LOG_MAX);
}

function arm(s, ctx, secs = s.time) {
  s.deadline = secs ? ctx.now + secs * 1000 : null;
}

// ——— Mise en place ———

export function setup(players, options, ctx) {
  const n = players.length;
  if (n < 3 || n > 6) throw new Error('Crânes et roses se joue de 3 à 6.');
  const order = players.map((p) => p.id);
  const s = {
    order,
    own: Object.fromEntries(order.map((id) => [id, { roses: 3, skull: true }])),
    pile: Object.fromEntries(order.map((id) => [id, []])),
    revealed: Object.fromEntries(order.map((id) => [id, 0])),
    score: Object.fromEntries(order.map((id) => [id, 0])),
    out: [], left: [],
    time: Number(options?.turnTime ?? 60) || 0,
    round: 0, phase: null, starter: null, actor: null,
    bid: null, passed: [], challenger: null, ready: [], result: null, next: null,
    deadline: null, log: [], winner: null,
  };
  return startRound(s, order[Math.floor(ctx.random() * n)], ctx);
}

// Nouvelle manche : les disques reviennent en main, chacun pose d'abord un disque, en commençant par `starter`.
function startRound(s, starter, ctx) {
  for (const id of s.order) {
    s.pile[id] = [];
    s.revealed[id] = 0;
  }
  s.round += 1;
  s.phase = 'place1';
  s.starter = starter;
  s.actor = starter;
  s.bid = null;
  s.passed = [];
  s.challenger = null;
  s.ready = [];
  s.result = null;
  s.next = null;
  arm(s, ctx);
  return s;
}

function finish(s, winner) {
  s.phase = 'over';
  s.winner = winner;
  s.deadline = null;
  s.actor = null;
  note(s, { t: 'win', who: winner });
  return s;
}

// ——— Poser, parier ———

function place(s, id, disc, ctx) {
  const hand = handOf(s, id);
  if (disc === 'rose') {
    if (hand.roses <= 0) throw new Error('Tu n’as plus de rose en main.');
  } else if (disc === 'skull') {
    if (!hand.skull) throw new Error('Ton crâne est déjà posé.');
  } else throw new Error('Choisis une rose ou le crâne.');
  s.pile[id].push(disc === 'rose' ? 'r' : 's');
  note(s, { t: 'place', who: id });
  if (s.phase === 'place1') {
    const waiting = alive(s).filter((p) => s.pile[p].length === 0);
    if (waiting.length === 0) s.phase = 'choose';
  }
  s.actor = nextAlive(s, id);
  arm(s, ctx);
  return s;
}

function bid(s, id, n, ctx) {
  const total = totalOnTable(s);
  if (!Number.isInteger(n) || n < 1) throw new Error('Choisis un nombre de disques à retourner (1 au moins).');
  if (n > total) throw new Error(`Il n’y a que ${total} disque${total > 1 ? 's' : ''} sur la table.`);
  if (s.bid && n <= s.bid.n) throw new Error(`Surenchéris : plus de ${s.bid.n}, ou passe.`);
  s.bid = { by: id, n };
  note(s, { t: 'bid', who: id, n });
  if (n === total) return startFlip(s, id, ctx);
  s.phase = 'bid';
  s.actor = nextBidder(s, id);
  arm(s, ctx);
  return s;
}

function nextBidder(s, id) {
  const n = s.order.length;
  const from = s.order.indexOf(id);
  for (let k = 1; k <= n; k++) {
    const cand = s.order[(from + k) % n];
    if (!isOut(s, cand) && !s.passed.includes(cand)) return cand;
  }
  return id;
}

function pass(s, id, ctx) {
  s.passed.push(id);
  note(s, { t: 'pass', who: id });
  const left = alive(s).filter((p) => !s.passed.includes(p));
  if (left.length <= 1) return startFlip(s, s.bid.by, ctx);
  s.actor = nextBidder(s, id);
  arm(s, ctx);
  return s;
}

function startFlip(s, id, ctx) {
  s.phase = 'flip';
  s.challenger = id;
  s.actor = id;
  note(s, { t: 'challenge', who: id, n: s.bid.n });
  arm(s, ctx);
  return s;
}

// ——— Retourner ———

function flip(s, id, target, ctx) {
  const c = s.challenger;
  const own = s.pile[c];
  if (s.revealed[c] < own.length) {
    if (target !== c) throw new Error('Retourne d’abord toute ta pile.');
    while (s.revealed[c] < own.length) {
      const disc = own[own.length - 1 - s.revealed[c]];
      s.revealed[c] += 1;
      note(s, { t: 'flip', who: c, of: c, disc });
      if (disc === 's') return fail(s, c, ctx);
    }
  } else {
    if (!Number.isInteger(target) || !s.pile[target] || target === c || isOut(s, target)) throw new Error('Choisis la pile d’un autre joueur.');
    if (s.revealed[target] >= s.pile[target].length) throw new Error('Cette pile est déjà retournée en entier.');
    const disc = s.pile[target][s.pile[target].length - 1 - s.revealed[target]];
    s.revealed[target] += 1;
    note(s, { t: 'flip', who: c, of: target, disc });
    if (disc === 's') return fail(s, target, ctx);
  }
  if (revealedTotal(s) >= s.bid.n) return succeed(s, ctx);
  arm(s, ctx);
  return s;
}

function succeed(s, ctx) {
  const c = s.challenger;
  s.score[c] += 1;
  note(s, { t: 'success', who: c, n: s.bid.n });
  s.result = { kind: 'success', challenger: c, n: s.bid.n };
  s.next = c;
  if (s.score[c] >= WIN_POINTS) return finish(s, c);
  return toResult(s, ctx);
}

// Un crâne est sorti : le défieur perd un disque tiré au hasard parmi les siens, sans que personne ne le voie.
function fail(s, skullOwner, ctx) {
  const c = s.challenger;
  const discs = [...Array(s.own[c].roses).fill('rose'), ...(s.own[c].skull ? ['skull'] : [])];
  const lost = discs[Math.floor(ctx.random() * discs.length)];
  if (lost === 'skull') s.own[c].skull = false;
  else s.own[c].roses -= 1;
  const eliminated = discsOf(s, c) === 0;
  if (eliminated) s.out.push(c);
  note(s, { t: 'fail', who: c, skullOwner, n: s.bid.n });
  if (eliminated) note(s, { t: 'out', who: c });
  s.result = { kind: 'fail', challenger: c, n: s.bid.n, skullOwner, lost, eliminated };
  s.next = !eliminated ? c : skullOwner !== c ? skullOwner : nextAlive(s, c);
  const left = alive(s);
  if (left.length <= 1) return finish(s, left[0] ?? null);
  return toResult(s, ctx);
}

function toResult(s, ctx) {
  s.phase = 'result';
  s.actor = null;
  s.ready = [];
  arm(s, ctx, RESULT_SECS);
  return s;
}

function endResult(s, ctx) {
  const starter = s.next && !isOut(s, s.next) ? s.next : alive(s)[0];
  return startRound(s, starter, ctx);
}

// ——— Coups ———

export function move(state, playerId, action, ctx) {
  const s = clone(state);
  if (!s.order.includes(playerId)) throw new Error('Tu ne joues pas cette partie.');
  if (isOut(s, playerId)) throw new Error('Tu es éliminé : tu regardes la fin de la partie.');
  action = action ?? {};
  const type = action.type;
  const mustAct = s.phase === 'flip' ? s.challenger : s.actor;
  if (['place1', 'choose', 'bid', 'flip'].includes(s.phase) && playerId !== mustAct) throw new Error('Ce n’est pas ton tour.');
  switch (s.phase) {
    case 'place1':
      if (type !== 'place') throw new Error('Pose d’abord un disque face cachée.');
      return { state: place(s, playerId, action.disc, ctx) };
    case 'choose':
      if (type === 'place') return { state: place(s, playerId, action.disc, ctx) };
      if (type === 'bid') return { state: bid(s, playerId, Number(action.n), ctx) };
      throw new Error('Pose un disque ou lance un défi.');
    case 'bid':
      if (type === 'bid') return { state: bid(s, playerId, Number(action.n), ctx) };
      if (type === 'pass') return { state: pass(s, playerId, ctx) };
      throw new Error('Surenchéris ou passe.');
    case 'flip':
      if (type !== 'flip') throw new Error('Retourne des disques.');
      return { state: flip(s, playerId, action.target === undefined ? undefined : Number(action.target), ctx) };
    case 'result': {
      if (type !== 'ready') throw new Error('Action impossible maintenant.');
      if (isOut(s, playerId)) throw new Error('Tu es éliminé.');
      s.ready = [...new Set([...s.ready, playerId])];
      if (alive(s).every((id) => s.ready.includes(id))) return { state: endResult(s, ctx) };
      return { state: s };
    }
    default:
      throw new Error('La partie est terminée.');
  }
}

// ——— Minuteur ———

export function timeout(state, ctx) {
  const s = clone(state);
  const id = s.actor;
  switch (s.phase) {
    case 'place1':
      return { state: place(s, id, handOf(s, id).roses > 0 ? 'rose' : 'skull', ctx) };
    case 'choose':
      if (handOf(s, id).roses > 0) return { state: place(s, id, 'rose', ctx) };
      return { state: bid(s, id, 1, ctx) };
    case 'bid':
      return { state: pass(s, id, ctx) };
    case 'flip': {
      const c = s.challenger;
      if (s.revealed[c] < s.pile[c].length) return { state: flip(s, c, c, ctx) };
      const open = alive(s).filter((p) => p !== c && s.revealed[p] < s.pile[p].length);
      return { state: flip(s, c, open[Math.floor(ctx.random() * open.length)], ctx) };
    }
    case 'result':
      return { state: endResult(s, ctx) };
    default:
      return { state: s };
  }
}

// ——— Abandon ———

export function leave(state, playerId, ctx) {
  const s = clone(state);
  if (!s.order.includes(playerId) || s.left.includes(playerId)) return { state: s };
  const wasOut = isOut(s, playerId);
  s.left.push(playerId);
  if (!wasOut) s.out.push(playerId);
  s.own[playerId] = { roses: 0, skull: false };
  s.pile[playerId] = [];
  s.revealed[playerId] = 0;
  if (wasOut || s.phase === 'over') return { state: s };
  note(s, { t: 'left', who: playerId });
  const left = alive(s);
  if (left.length <= 1) return { state: finish(s, left[0] ?? null) };

  switch (s.phase) {
    case 'place1':
    case 'choose': {
      if (s.actor === playerId) s.actor = nextAlive(s, playerId);
      if (s.phase === 'place1' && alive(s).every((p) => s.pile[p].length > 0)) s.phase = 'choose';
      arm(s, ctx);
      return { state: s };
    }
    case 'bid':
    case 'flip': {
      // Le nombre de disques sur la table a changé : la manche est annulée, sans point ni perte.
      note(s, { t: 'cancel' });
      const starter = s.challenger && !isOut(s, s.challenger) ? s.challenger : nextAlive(s, playerId);
      return { state: startRound(s, starter, ctx) };
    }
    case 'result':
      s.ready = s.ready.filter((p) => p !== playerId);
      if (s.next === playerId) s.next = nextAlive(s, playerId);
      if (alive(s).every((p) => s.ready.includes(p))) return { state: endResult(s, ctx) };
      return { state: s };
    default:
      return { state: s };
  }
}

// ——— Statut et vues ———

export function status(s) {
  if (s.phase === 'over') return { turn: null, over: true, winners: s.winner ? [s.winner] : [], deadline: null };
  let turn;
  if (s.phase === 'result') turn = alive(s).filter((id) => !s.ready.includes(id));
  else turn = s.actor;
  return { turn, over: false, winners: [], deadline: s.deadline };
}

// Mes disques, oui. Ceux des autres : jamais, tant qu'ils ne sont pas retournés (sauf en fin de partie).
export function view(s, playerId) {
  const over = s.phase === 'over';
  const me = playerId !== null && s.order.includes(playerId) ? playerId : null;
  const piles = {};
  for (const id of s.order) {
    const pile = s.pile[id];
    const n = pile.length;
    piles[id] = pile.map((d, i) => {
      const up = i >= n - s.revealed[id];
      return { up, k: up || id === me || over ? d : null };
    });
  }
  const challenger = s.challenger;
  return {
    phase: s.phase,
    round: s.round,
    order: s.order,
    actor: s.actor,
    starter: s.starter,
    deadline: s.deadline,
    out: s.out,
    left: s.left,
    score: s.score,
    discs: Object.fromEntries(s.order.map((id) => [id, discsOf(s, id)])),
    piles,
    hand: me === null || isOut(s, me) ? null : handOf(s, me),
    total: totalOnTable(s),
    bid: s.bid,
    passed: s.passed,
    challenger,
    flipped: revealedTotal(s),
    ready: s.ready,
    result: s.result && { kind: s.result.kind, challenger: s.result.challenger, n: s.result.n, skullOwner: s.result.skullOwner ?? null, eliminated: s.result.eliminated ?? false },
    // Le disque perdu : seul le joueur concerné le sait.
    lost: s.result?.kind === 'fail' && me === s.result.challenger ? s.result.lost : null,
    log: s.log,
    winner: s.winner,
    me,
  };
}
