// Complot : à la cour, chacun cache deux influences (des personnages) et bluffe pour éliminer les autres.
// Dernier courtisan avec une influence face cachée gagne. Règles pures : ni réseau, ni base, ni affichage.
//
// Déroulement d'un tour : l'acteur annonce une action. Si elle exige un personnage, tout le monde peut la mettre en doute
// (fenêtre « challenge »). Si elle peut être contrée, la cible (ou tout le monde pour l'aide étrangère) peut la contrer
// (fenêtre « block »), et tout le monde peut mettre en doute le contre (fenêtre « blockChallenge »).
// Celui qui perd une influence choisit laquelle (phase « lose »).

export const CHARS = ['doge', 'lame', 'courtisane', 'condottiere', 'emissaire'];

// Les actions. claim : le personnage dont l'acteur se réclame (peut être mis en doute).
// blockBy : les personnages qui peuvent contrer ; blockers : « all » (tous les autres) ou « target ».
export const ACTIONS = {
  income: { cost: 0 },
  aid: { cost: 0, blockBy: ['doge'], blockers: 'all' },
  coup: { cost: 7, target: true },
  tax: { cost: 0, claim: 'doge' },
  assassinate: { cost: 3, claim: 'lame', target: true, blockBy: ['courtisane'], blockers: 'target' },
  steal: { cost: 0, claim: 'condottiere', target: true, blockBy: ['condottiere', 'emissaire'], blockers: 'target' },
  exchange: { cost: 0, claim: 'emissaire' },
};

const COUP_AT = 7;
const MUST_COUP = 10;
const LOG_MAX = 80;

const clone = (x) => structuredClone(x);

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isAlive = (s, id) => Boolean(s.p[id]) && s.p[id].cards.some((c) => !c.up);
const aliveIds = (s) => s.order.filter((id) => isAlive(s, id));
const hidden = (s, id) => s.p[id].cards.map((c, i) => (c.up ? -1 : i)).filter((i) => i >= 0);

// Joueur vivant suivant dans l'ordre des places (même si `id` vient de sortir).
function nextAlive(s, id) {
  const n = s.order.length;
  const from = s.order.indexOf(id);
  for (let k = 1; k <= n; k++) {
    const cand = s.order[(from + k) % n];
    if (isAlive(s, cand)) return cand;
  }
  return id;
}

function note(s, entry) {
  s.log.push(entry);
  if (s.log.length > LOG_MAX) s.log.splice(0, s.log.length - LOG_MAX);
}

// Échéance : « turn » = temps pour jouer ou choisir, « react » = fenêtre de réaction.
function arm(s, kind, ctx) {
  const secs = kind === 'react' ? s.times.react : s.times.turn;
  s.deadline = secs ? ctx.now + secs * 1000 : null;
}

// ——— Mise en place ———

export function setup(players, options, ctx) {
  const n = players.length;
  if (n < 2 || n > 6) throw new Error('Complot se joue de 2 à 6.');
  const order = players.map((p) => p.id);
  const deck = shuffle(CHARS.flatMap((c) => [c, c, c]), ctx.random);
  const p = {};
  for (const id of order) p[id] = { coins: 2, cards: [{ c: deck.pop(), up: false }, { c: deck.pop(), up: false }], left: false };
  const actor = order[Math.floor(ctx.random() * n)];
  // À deux, celui qui commence n'a qu'une pièce (règle officielle du duel).
  if (n === 2) p[actor].coins = 1;
  const s = {
    order, p, deck, actor, turnNo: 1,
    phase: 'action', act: null, block: null, win: null, lose: null, exch: null,
    times: { turn: Number(options?.turnTime ?? 60) || 0, react: Number(options?.reactTime ?? 15) || 15 },
    deadline: null, log: [], winner: null,
  };
  note(s, { t: 'start', who: actor });
  arm(s, 'turn', ctx);
  return s;
}

// ——— Fin de tour, fin de partie ———

function finish(s, winner) {
  s.phase = 'over';
  s.winner = winner;
  s.act = s.block = s.win = s.lose = s.exch = null;
  s.deadline = null;
  note(s, { t: 'win', who: winner });
  return s;
}

function endTurn(s, ctx) {
  s.act = s.block = s.win = s.lose = s.exch = null;
  const left = aliveIds(s);
  if (left.length <= 1) return finish(s, left[0] ?? null);
  s.actor = nextAlive(s, s.actor);
  s.turnNo += 1;
  s.phase = 'action';
  arm(s, 'turn', ctx);
  return s;
}

// L'action en cours est annulée (départ d'un joueur concerné) : l'acteur récupère ce qu'il avait payé.
function cancelTurn(s, ctx) {
  // Un échange interrompu rend à la pioche les deux cartes piochées.
  if (s.exch) s.deck = shuffle([...s.deck, ...s.exch.options.slice(s.exch.keep)], ctx.random);
  if (s.act?.paid && s.p[s.act.by] && !s.p[s.act.by].left) s.p[s.act.by].coins += s.act.cost;
  return endTurn(s, ctx);
}

// ——— Perte d'influence ———

function loseInfluence(s, id, after, ctx) {
  const open = hidden(s, id);
  if (open.length === 0) return resume(s, after, ctx);
  if (open.length === 1) return finishLose(s, id, open[0], after, ctx);
  s.phase = 'lose';
  s.lose = { player: id, after };
  s.win = null;
  arm(s, 'turn', ctx);
  return s;
}

function finishLose(s, id, index, after, ctx) {
  const card = s.p[id].cards[index];
  card.up = true;
  note(s, { t: 'lose', who: id, char: card.c });
  s.lose = null;
  if (!isAlive(s, id)) {
    s.p[id].coins = 0;
    note(s, { t: 'out', who: id });
    const left = aliveIds(s);
    if (left.length <= 1) return finish(s, left[0] ?? null);
  }
  return resume(s, after, ctx);
}

// Ce qui se passe une fois l'influence perdue.
function resume(s, after, ctx) {
  if (after === 'afterChallenge') return toBlockOrExecute(s, ctx);
  if (after === 'execute') return execute(s, ctx);
  return endTurn(s, ctx);
}

// ——— Fenêtres de réaction ———

function openWindow(s, phase, who, ctx) {
  s.phase = phase;
  s.win = { who: who.filter((id) => isAlive(s, id)), passed: [] };
  arm(s, 'react', ctx);
  if (s.win.who.length === 0) return windowEnd(s, ctx);
  return s;
}

// Après la fenêtre de doute : le contre est-il possible ? Sinon l'action s'exécute.
function toBlockOrExecute(s, ctx) {
  const a = ACTIONS[s.act.type];
  const target = s.act.target;
  if (a.target && !isAlive(s, target)) return endTurn(s, ctx);
  if (!a.blockBy) return execute(s, ctx);
  const who = a.blockers === 'target' ? [target] : aliveIds(s).filter((id) => id !== s.act.by);
  return openWindow(s, 'block', who, ctx);
}

// Plus personne ne réagit : si c'était la fenêtre de contre, l'action passe ; si c'était celle du doute sur un contre,
// le contre tient et l'action est annulée.
function windowEnd(s, ctx) {
  const phase = s.phase;
  s.win = null;
  if (phase === 'challenge') return toBlockOrExecute(s, ctx);
  if (phase === 'block') return execute(s, ctx);
  // blockChallenge : personne n'a mis le contre en doute, l'action est annulée.
  note(s, { t: 'blocked', by: s.block.by, char: s.block.char });
  return endTurn(s, ctx);
}

// ——— Mise en doute ———

// Le personnage annoncé est-il vraiment là ? Oui : il est montré puis remélangé, le douteur perd une influence.
// Non : celui qui a menti perd une influence.
function resolveChallenge(s, challenger, claimant, char, kind, ctx) {
  note(s, { t: 'challenge', by: challenger, on: claimant, char, kind });
  const idx = s.p[claimant].cards.findIndex((c) => !c.up && c.c === char);
  s.win = null;
  if (idx >= 0) {
    s.deck.push(char);
    s.deck = shuffle(s.deck, ctx.random);
    s.p[claimant].cards[idx].c = s.deck.pop();
    note(s, { t: 'reveal', who: claimant, char, ok: true });
    if (kind === 'block') note(s, { t: 'blocked', by: claimant, char });
    return loseInfluence(s, challenger, kind === 'action' ? 'afterChallenge' : 'endTurn', ctx);
  }
  note(s, { t: 'reveal', who: claimant, char, ok: false });
  if (kind === 'action') {
    // Le mensonge annule l'action : ce qui avait été payé revient (assassinat).
    if (s.act.paid) {
      s.p[claimant].coins += s.act.cost;
      s.act.paid = false;
    }
    return loseInfluence(s, claimant, 'endTurn', ctx);
  }
  // Faux contre : il tombe, l'action reprend.
  s.block = null;
  return loseInfluence(s, claimant, 'execute', ctx);
}

// ——— Effet de l'action ———

function execute(s, ctx) {
  const act = s.act;
  const a = ACTIONS[act.type];
  s.win = null;
  s.block = null;
  if (a.target && !isAlive(s, act.target)) return endTurn(s, ctx);
  act.paid = false;
  const me = s.p[act.by];
  switch (act.type) {
    case 'income':
      me.coins += 1;
      return endTurn(s, ctx);
    case 'aid':
      me.coins += 2;
      note(s, { t: 'gain', who: act.by, n: 2 });
      return endTurn(s, ctx);
    case 'tax':
      me.coins += 3;
      note(s, { t: 'gain', who: act.by, n: 3 });
      return endTurn(s, ctx);
    case 'steal': {
      const n = Math.min(2, s.p[act.target].coins);
      s.p[act.target].coins -= n;
      me.coins += n;
      note(s, { t: 'stole', who: act.by, target: act.target, n });
      return endTurn(s, ctx);
    }
    case 'assassinate':
    case 'coup':
      return loseInfluence(s, act.target, 'endTurn', ctx);
    case 'exchange': {
      const mine = hidden(s, act.by).map((i) => me.cards[i].c);
      const drawn = s.deck.splice(0, 2);
      s.exch = { options: [...mine, ...drawn], keep: mine.length };
      s.phase = 'exchange';
      arm(s, 'turn', ctx);
      return s;
    }
    default:
      return endTurn(s, ctx);
  }
}

function keepCards(s, indexes, ctx) {
  const { options, keep } = s.exch;
  const me = s.p[s.act.by];
  const kept = indexes.map((i) => options[i]);
  const back = options.filter((_, i) => !indexes.includes(i));
  hidden(s, s.act.by).forEach((slot, k) => { me.cards[slot].c = kept[k]; });
  s.deck = shuffle([...s.deck, ...back], ctx.random);
  note(s, { t: 'exchanged', who: s.act.by, n: keep });
  return endTurn(s, ctx);
}

// ——— Coups ———

const targetOf = (s, action, playerId) => {
  const t = Number(action.target);
  if (!Number.isInteger(t) || !s.p[t]) throw new Error('Choisis un joueur pour cette action.');
  if (t === playerId) throw new Error('Tu ne peux pas te viser toi-même.');
  if (!isAlive(s, t)) throw new Error('Ce joueur est déjà éliminé.');
  return t;
};

function declare(s, playerId, action, ctx) {
  const type = action.type;
  const a = ACTIONS[type];
  if (!a) throw new Error('Action inconnue.');
  const me = s.p[playerId];
  if (me.coins >= MUST_COUP && type !== 'coup') throw new Error('Tu as 10 pièces ou plus : tu dois lancer un coup d’État.');
  if (me.coins < a.cost) throw new Error(`Il te faut ${a.cost} pièces pour cette action (tu en as ${me.coins}).`);
  const target = a.target ? targetOf(s, action, playerId) : null;
  if (type === 'steal' && s.p[target].coins === 0) throw new Error('Cette personne n’a aucune pièce à voler.');
  if (type === 'exchange' && s.deck.length < 2) throw new Error('Il n’y a plus assez de cartes à la pioche pour échanger.');
  me.coins -= a.cost;
  s.act = { type, by: playerId, target, cost: a.cost, paid: a.cost > 0, claim: a.claim ?? null };
  note(s, { t: 'declare', by: playerId, action: type, target });
  if (a.claim) return openWindow(s, 'challenge', aliveIds(s).filter((id) => id !== playerId), ctx);
  return toBlockOrExecute(s, ctx);
}

function react(s, playerId, action, ctx) {
  if (!s.win.who.includes(playerId) || s.win.passed.includes(playerId)) throw new Error('Tu ne peux pas réagir maintenant.');
  const type = action?.type;
  if (type === 'pass') {
    s.win.passed.push(playerId);
    if (s.win.passed.length >= s.win.who.length) return windowEnd(s, ctx);
    return s;
  }
  if (s.phase === 'challenge') {
    if (type !== 'challenge') throw new Error('Mets en doute ou laisse passer.');
    return resolveChallenge(s, playerId, s.act.by, s.act.claim, 'action', ctx);
  }
  if (s.phase === 'block') {
    if (type !== 'block') throw new Error('Contre ou laisse passer.');
    const allowed = ACTIONS[s.act.type].blockBy;
    const char = allowed.length === 1 ? allowed[0] : action.char;
    if (!allowed.includes(char)) throw new Error('Choisis le personnage avec lequel tu contres.');
    s.block = { by: playerId, char };
    note(s, { t: 'block', by: playerId, char });
    return openWindow(s, 'blockChallenge', aliveIds(s).filter((id) => id !== playerId), ctx);
  }
  if (type !== 'challenge') throw new Error('Mets en doute ou laisse passer.');
  return resolveChallenge(s, playerId, s.block.by, s.block.char, 'block', ctx);
}

export function move(state, playerId, action, ctx) {
  const s = clone(state);
  if (!s.p[playerId]) throw new Error('Tu ne joues pas cette partie.');
  action = action ?? {};
  switch (s.phase) {
    case 'action':
      if (playerId !== s.actor) throw new Error('Ce n’est pas ton tour.');
      return { state: declare(s, playerId, action, ctx) };
    case 'challenge':
    case 'block':
    case 'blockChallenge':
      return { state: react(s, playerId, action, ctx) };
    case 'lose': {
      if (playerId !== s.lose.player) throw new Error('Ce n’est pas à toi de choisir.');
      const i = Number(action.card);
      if (action.type !== 'lose' || !hidden(s, playerId).includes(i)) throw new Error('Choisis une de tes cartes cachées.');
      return { state: finishLose(s, playerId, i, s.lose.after, ctx) };
    }
    case 'exchange': {
      if (playerId !== s.act.by) throw new Error('Ce n’est pas à toi de choisir.');
      const keep = Array.isArray(action.keep) ? action.keep.map(Number) : [];
      const okIdx = keep.every((i) => Number.isInteger(i) && i >= 0 && i < s.exch.options.length) && new Set(keep).size === keep.length;
      if (action.type !== 'keep' || !okIdx || keep.length !== s.exch.keep) {
        throw new Error(`Garde exactement ${s.exch.keep} carte${s.exch.keep > 1 ? 's' : ''}.`);
      }
      return { state: keepCards(s, keep, ctx) };
    }
    default:
      throw new Error('La partie est terminée.');
  }
}

// ——— Minuteur ———

export function timeout(state, ctx) {
  const s = clone(state);
  switch (s.phase) {
    case 'action': {
      const me = s.p[s.actor];
      if (me.coins >= MUST_COUP) {
        const targets = aliveIds(s).filter((id) => id !== s.actor);
        return { state: declare(s, s.actor, { type: 'coup', target: targets[Math.floor(ctx.random() * targets.length)] }, ctx) };
      }
      return { state: declare(s, s.actor, { type: 'income' }, ctx) };
    }
    case 'challenge':
    case 'block':
    case 'blockChallenge':
      return { state: windowEnd(s, ctx) };
    case 'lose': {
      const open = hidden(s, s.lose.player);
      const i = open[Math.floor(ctx.random() * open.length)];
      return { state: finishLose(s, s.lose.player, i, s.lose.after, ctx) };
    }
    case 'exchange':
      return { state: keepCards(s, Array.from({ length: s.exch.keep }, (_, i) => i), ctx) };
    default:
      return { state: s };
  }
}

// ——— Abandon ———

export function leave(state, playerId, ctx) {
  const s = clone(state);
  const me = s.p[playerId];
  if (!me || me.left) return { state: s };
  const wasAlive = isAlive(s, playerId);
  const inPlay = s.phase !== 'over';
  // Ses cartes cachées retournent à la pioche sans être montrées.
  const back = me.cards.filter((c) => !c.up).map((c) => c.c);
  s.deck = shuffle([...s.deck, ...back], ctx.random);
  me.cards = me.cards.filter((c) => c.up);
  me.coins = 0;
  me.left = true;
  if (!wasAlive || !inPlay) return { state: s };
  note(s, { t: 'left', who: playerId });
  const left = aliveIds(s);
  if (left.length <= 1) return { state: finish(s, left[0] ?? null) };

  const involved = s.actor === playerId || s.act?.target === playerId || s.block?.by === playerId || s.lose?.player === playerId;
  if (involved) return { state: cancelTurn(s, ctx) };
  // Un spectateur de la scène : on le retire simplement de la fenêtre en cours.
  if (s.win) {
    s.win.who = s.win.who.filter((id) => id !== playerId);
    s.win.passed = s.win.passed.filter((id) => id !== playerId);
    if (s.win.passed.length >= s.win.who.length) return { state: windowEnd(s, ctx) };
  }
  return { state: s };
}

// ——— Statut et vues ———

export function status(s) {
  if (s.phase === 'over') return { turn: null, over: true, winners: s.winner ? [s.winner] : [], deadline: null };
  let turn;
  if (s.phase === 'action') turn = s.actor;
  else if (s.phase === 'lose') turn = s.lose.player;
  else if (s.phase === 'exchange') turn = s.act.by;
  else turn = s.win.who.filter((id) => !s.win.passed.includes(id));
  return { turn, over: false, winners: [], deadline: s.deadline };
}

// Ce que voit chacun : ses cartes, les cartes retournées de tous, jamais les cartes cachées des autres.
export function view(s, playerId) {
  const over = s.phase === 'over';
  const me = playerId !== null && s.p[playerId] ? playerId : null;
  const p = {};
  for (const id of s.order) {
    const q = s.p[id];
    p[id] = {
      coins: q.coins,
      left: q.left,
      alive: isAlive(s, id),
      // c est connu pour les cartes retournées, pour mes cartes, et pour tout le monde en fin de partie.
      cards: q.cards.map((c) => ({ up: c.up, c: c.up || id === me || over ? c.c : null })),
    };
  }
  return {
    phase: s.phase,
    turnNo: s.turnNo,
    actor: s.actor,
    order: s.order,
    p,
    deckCount: s.deck.length,
    act: s.act && { type: s.act.type, by: s.act.by, target: s.act.target, claim: s.act.claim },
    block: s.block,
    win: s.win,
    lose: s.lose && { player: s.lose.player },
    exch: s.exch && me === s.act.by ? s.exch : null,
    deadline: s.deadline,
    log: s.log,
    winner: s.winner,
    mustCoup: s.phase === 'action' && s.p[s.actor].coins >= MUST_COUP,
    me,
  };
}

export { COUP_AT, MUST_COUP };
