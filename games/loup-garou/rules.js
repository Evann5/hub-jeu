// Loups-garous : les règles, pures (ni réseau, ni base, ni affichage). Le hasard et l'heure arrivent par ctx.
//
// Déroulé d'un tour :
//   night   Cupidon (1re nuit), la Voyante et les Loups agissent en même temps.
//   witch   la Sorcière apprend la victime des loups et peut la sauver ou empoisonner quelqu'un.
//   (aube)  les morts de la nuit sont annoncés, rôle révélé ; le Chasseur mort tire (phase hunter).
//   debate  le village débat (chat de table) ; tout le monde peut passer au vote.
//   vote    vote du village : la majorité relative élimine, une égalité n'élimine personne ; le Chasseur tire.
//
// Choix documentés :
// - status().turn contient TOUS les vivants pendant la nuit : le hub publie « turn » à tous les membres, et une liste
//   réduite aux loups ou à la Voyante dévoilerait les rôles. Seuls les vrais acteurs ont une action possible.
// - Loups : la nuit se termine dès que tous les loups vivants ont voté pour la même victime. Sinon, à l'échéance,
//   la victime est la plus votée ; en cas d'égalité, tirage au sort parmi les ex æquo ; sans aucun vote, pas de victime.
// - Village : égalité ou aucun vote = personne n'est éliminé.
// - Un joueur qui part est éliminé (rôle révélé, les amoureux le suivent, pas de tir du Chasseur).

const clone = (s) => structuredClone(s);

// Échéance d'une phase ; span (sa durée) sert au client pour dessiner la barre de temps.
function setDeadline(s, ctx, ms) {
  s.deadline = ctx.now + ms;
  s.span = ms;
}

export const ROLES = ['wolf', 'villager', 'seer', 'witch', 'hunter', 'cupid'];
const SPECIALS = ['seer', 'witch', 'hunter', 'cupid']; // du plus important au moins important
const SHORT_WITCH_MS = 6000; // Sorcière sans potion : une phase courte, pour ne pas révéler qu'elle n'a plus rien
// La 1re nuit dure 10 s de plus : le temps de lire sa carte de rôle. La durée ne dépend jamais des rôles vivants
// (sinon elle révélerait qui est en vie).
export const FIRST_NIGHT_BONUS_MS = 10_000;

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 18;

// Nombre de loups conseillé selon le nombre de joueurs.
export function autoWolves(n) {
  return Math.max(1, Math.floor((n + 1) / 4));
}

// Composition des rôles : { wolf: 2, seer: 1, ... } (les villageois complètent).
export function composition(n, options = {}) {
  const maxWolves = Math.max(1, Math.floor((n - 1) / 2));
  const asked = Number(options.wolves) || 0;
  const wolves = Math.min(maxWolves, asked > 0 ? asked : autoWolves(n));
  const wanted = SPECIALS.filter((r) => options[r] !== false);
  const room = Math.max(0, n - wolves - 1); // au moins un villageois
  const specials = wanted.slice(0, room);
  const comp = { wolf: wolves };
  for (const r of specials) comp[r] = 1;
  comp.villager = n - wolves - specials.length;
  return comp;
}

function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sec = (v, fallback) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) * 1000 : fallback * 1000);

export function setup(players, options, ctx) {
  const ids = players.map((p) => p.id);
  const comp = composition(ids.length, options);
  const pool = shuffle(Object.entries(comp).flatMap(([role, k]) => Array(k).fill(role)), ctx.random);
  const roles = {};
  ids.forEach((id, i) => { roles[id] = pool[i]; });
  const s = {
    players: ids,
    comp,
    times: { night: sec(options.night, 45), debate: sec(options.debate, 120), vote: sec(options.vote, 45) },
    roles,
    dead: [], // { id, role, cause: 'wolves' | 'poison' | 'vote' | 'shot' | 'love' | 'left', n }
    left: [],
    lovers: null,
    n: 1,
    phase: 'night',
    deadline: null,
    span: 0,
    acts: { cupid: false, seer: false },
    wolfVotes: {},
    victim: null,
    saved: false,
    poisoned: null,
    witchDone: false,
    potions: { life: true, death: true },
    seen: [], // { n, target, role } : ce que la Voyante a vu
    hunters: [],
    after: 'debate', // où aller quand les Chasseurs ont tiré : 'debate' ou 'night'
    ready: [],
    votes: {},
    log: [],
    winner: null, // { side: 'village' | 'wolves' | 'lovers' | 'none', ids: [] }
  };
  setDeadline(s, ctx, s.times.night + FIRST_NIGHT_BONUS_MS);
  return settle(s, ctx);
}

// ——— Aides ———

const isDead = (s, id) => s.dead.some((d) => d.id === id);
const alive = (s) => s.players.filter((id) => !isDead(s, id));
const aliveWith = (s, role) => alive(s).filter((id) => s.roles[id] === role);
const wolvesAlive = (s) => aliveWith(s, 'wolf');
const mixedLovers = (s) => Boolean(s.lovers) && (s.roles[s.lovers[0]] === 'wolf') !== (s.roles[s.lovers[1]] === 'wolf');

function tally(votes) {
  const count = new Map();
  for (const t of Object.values(votes)) if (t !== null && t !== undefined) count.set(t, (count.get(t) || 0) + 1);
  const top = Math.max(0, ...count.values());
  const leaders = [...count.entries()].filter(([, c]) => c === top).map(([id]) => Number(id)).sort((a, b) => a - b);
  return { count, top, leaders };
}

// Mort d'un joueur (et des amoureux qui le suivent). Les Chasseurs morts sont mis en file pour tirer.
function kill(s, id, cause) {
  if (isDead(s, id) || !s.players.includes(id)) return;
  s.dead.push({ id, role: s.roles[id], cause, n: s.n });
  delete s.wolfVotes[id];
  delete s.votes[id];
  for (const book of [s.wolfVotes, s.votes]) for (const [voter, t] of Object.entries(book)) if (t === id) delete book[voter];
  s.ready = s.ready.filter((x) => x !== id);
  if (s.roles[id] === 'hunter' && cause !== 'left') s.hunters.push(id);
  if (s.lovers?.includes(id)) {
    const other = s.lovers.find((x) => x !== id);
    kill(s, other, 'love');
  }
}

function checkWin(s) {
  const living = alive(s);
  if (!living.length) return { side: 'none', ids: [] };
  if (mixedLovers(s) && s.lovers.every((id) => !isDead(s, id))) {
    // Un loup et un villageois amoureux : ils ne gagnent qu'à deux, seuls survivants.
    return living.length === 2 ? { side: 'lovers', ids: s.lovers.slice() } : null;
  }
  const wolves = wolvesAlive(s).length;
  if (wolves === 0) return { side: 'village', ids: s.players.filter((id) => s.roles[id] !== 'wolf') };
  if (wolves >= living.length - wolves) return { side: 'wolves', ids: s.players.filter((id) => s.roles[id] === 'wolf') };
  return null;
}

function finish(s, winner) {
  s.winner = winner;
  s.phase = 'over';
  s.deadline = null;
}

// Qui doit encore agir cette nuit (vrais acteurs seulement).
function nightPending(s) {
  const pending = [];
  if (s.n === 1 && !s.acts.cupid) pending.push(...aliveWith(s, 'cupid'));
  if (!s.acts.seer) pending.push(...aliveWith(s, 'seer'));
  const wolves = wolvesAlive(s);
  const votes = wolves.map((w) => s.wolfVotes[w]);
  const agreed = votes.every((v) => v !== undefined) && new Set(votes).size <= 1;
  if (!agreed) pending.push(...wolves);
  return pending;
}

function witchCanAct(s) {
  return (s.potions.life && s.victim !== null && !s.saved) || (s.potions.death && s.poisoned === null);
}

function startNight(s, ctx, n) {
  s.n = n;
  s.phase = 'night';
  s.acts = { cupid: true, seer: false };
  s.wolfVotes = {};
  s.victim = null;
  s.saved = false;
  s.poisoned = null;
  s.witchDone = false;
  s.ready = [];
  s.votes = {};
  setDeadline(s, ctx, s.times.night);
}

function startDebate(s, ctx) {
  s.phase = 'debate';
  s.ready = [];
  s.votes = {};
  setDeadline(s, ctx, s.times.debate);
}

function startVote(s, ctx) {
  s.phase = 'vote';
  s.votes = {};
  setDeadline(s, ctx, s.times.vote);
}

function startHunter(s, ctx, after) {
  s.phase = 'hunter';
  s.after = after;
  setDeadline(s, ctx, s.times.vote);
}

// Fin de la nuit : les loups ont choisi, la Sorcière est prévenue.
function endNight(s, ctx) {
  const { leaders } = tally(s.wolfVotes);
  s.victim = leaders.length ? leaders[Math.floor(ctx.random() * leaders.length)] : null;
  s.phase = 'witch';
  s.witchDone = !aliveWith(s, 'witch').length;
  setDeadline(s, ctx, witchCanAct(s) ? s.times.night : SHORT_WITCH_MS);
}

// Aube : on applique la victime des loups (si elle n'est pas sauvée) et le poison, puis on annonce.
function morning(s, ctx) {
  const before = s.dead.length;
  if (s.victim !== null && !s.saved) kill(s, s.victim, 'wolves');
  if (s.poisoned !== null) kill(s, s.poisoned, 'poison');
  s.log.push({ k: 'dawn', n: s.n, dead: s.dead.slice(before).map((d) => d.id) });
  s.victim = null;
  if (s.hunters.length) startHunter(s, ctx, 'debate');
  else startDebate(s, ctx);
}

function resolveVote(s, ctx) {
  const { top, leaders } = tally(s.votes);
  const ballots = Object.entries(s.votes).map(([from, to]) => [Number(from), to]);
  const out = top > 0 && leaders.length === 1 ? leaders[0] : null;
  s.log.push({ k: 'vote', n: s.n, ballots, out });
  if (out !== null) kill(s, out, 'vote');
  if (s.hunters.length) startHunter(s, ctx, 'night');
  else startNight(s, ctx, s.n + 1);
}

function shoot(s, hunter, target) {
  s.hunters = s.hunters.filter((h) => h !== hunter);
  if (target === null) return;
  const before = s.dead.length;
  kill(s, target, 'shot');
  s.log.push({ k: 'shot', n: s.n, hunter, target, dead: s.dead.slice(before).map((d) => d.id) });
}

// Fait avancer la partie tant qu'une phase est terminée (tout le monde a agi, quelqu'un est parti…).
function settle(s, ctx) {
  for (let guard = 0; guard < 30; guard++) {
    s.hunters = s.hunters.filter((h) => !s.left.includes(h));
    if (s.phase === 'over') return s;
    if (s.phase !== 'hunter') {
      const win = checkWin(s);
      if (win) {
        finish(s, win);
        return s;
      }
    }
    if (s.phase === 'night') {
      if (nightPending(s).length) return s;
      endNight(s, ctx);
    } else if (s.phase === 'witch') {
      if (!s.witchDone && aliveWith(s, 'witch').length) return s;
      morning(s, ctx);
    } else if (s.phase === 'hunter') {
      if (s.hunters.length) return s;
      const win = checkWin(s);
      if (win) {
        finish(s, win);
        return s;
      }
      if (s.after === 'debate') startDebate(s, ctx);
      else startNight(s, ctx, s.n + 1);
    } else if (s.phase === 'debate') {
      const living = alive(s);
      if (!living.every((id) => s.ready.includes(id))) return s;
      startVote(s, ctx);
    } else if (s.phase === 'vote') {
      const living = alive(s);
      if (!living.every((id) => id in s.votes)) return s;
      resolveVote(s, ctx);
    }
  }
  return s;
}

// ——— Coups ———

const isAlive = (s, id) => s.players.includes(id) && !isDead(s, id);

function target(s, raw) {
  const t = Number(raw);
  if (!Number.isInteger(t) || !isAlive(s, t)) throw new Error('Choisis une personne encore en vie.');
  return t;
}

export function move(state, playerId, action, ctx) {
  const s = clone(state);
  const a = action && typeof action === 'object' ? action : {};
  if (s.phase === 'over') throw new Error('La partie est terminée.');
  if (!isAlive(s, playerId) && !(s.phase === 'hunter' && s.hunters[0] === playerId)) {
    throw new Error('Tu es mort : tu regardes la suite de la partie.');
  }
  const role = s.roles[playerId];

  if (s.phase === 'night') {
    if (a.type === 'love') {
      if (role !== 'cupid' || s.n !== 1 || s.acts.cupid) throw new Error('Tu ne peux pas faire ça cette nuit.');
      const pair = [...new Set([].concat(a.targets ?? []).map((x) => target(s, x)))];
      if (pair.length !== 2) throw new Error('Choisis deux personnes différentes à unir.');
      s.lovers = pair;
      s.acts.cupid = true;
    } else if (a.type === 'peek') {
      if (role !== 'seer' || s.acts.seer) throw new Error('Tu ne peux pas faire ça cette nuit.');
      const t = target(s, a.target);
      if (t === playerId) throw new Error('Tu te connais déjà : choisis quelqu’un d’autre.');
      s.seen.push({ n: s.n, target: t, role: s.roles[t] });
      s.acts.seer = true;
    } else if (a.type === 'wolf') {
      if (role !== 'wolf') throw new Error('Tu ne peux pas faire ça cette nuit.');
      const t = target(s, a.target);
      if (s.roles[t] === 'wolf') throw new Error('Tu ne peux pas dévorer un autre loup.');
      s.wolfVotes[playerId] = t;
    } else {
      throw new Error('Tu ne peux pas faire ça cette nuit.');
    }
  } else if (s.phase === 'witch') {
    if (role !== 'witch') throw new Error('La Sorcière est en train de choisir.');
    if (s.witchDone) throw new Error('Tu as déjà fini.');
    if (a.type === 'save') {
      if (!s.potions.life) throw new Error('Tu as déjà utilisé ta potion de vie.');
      if (s.victim === null) throw new Error('Personne n’est menacé cette nuit.');
      if (s.saved) throw new Error('Tu as déjà sauvé la victime.');
      s.saved = true;
      s.potions.life = false;
    } else if (a.type === 'poison') {
      if (!s.potions.death) throw new Error('Tu as déjà utilisé ta potion de mort.');
      if (s.poisoned !== null) throw new Error('Tu as déjà empoisonné quelqu’un cette nuit.');
      const t = target(s, a.target);
      if (t === playerId) throw new Error('Tu ne peux pas t’empoisonner toi-même.');
      s.poisoned = t;
      s.potions.death = false;
    } else if (a.type === 'pass') {
      s.witchDone = true;
    } else {
      throw new Error('Choisis une potion ou passe ton tour.');
    }
    if (!witchCanAct(s)) s.witchDone = true;
  } else if (s.phase === 'hunter') {
    if (s.hunters[0] !== playerId) throw new Error('Le Chasseur est en train de viser.');
    if (a.type === 'pass') shoot(s, playerId, null);
    else if (a.type === 'shoot') shoot(s, playerId, target(s, a.target));
    else throw new Error('Choisis ta cible.');
  } else if (s.phase === 'debate') {
    if (a.type !== 'ready') throw new Error('Le débat est en cours.');
    if (!s.ready.includes(playerId)) s.ready.push(playerId);
  } else if (s.phase === 'vote') {
    if (a.type !== 'vote') throw new Error('C’est l’heure du vote.');
    const t = a.target === null || a.target === undefined ? null : target(s, a.target);
    if (t === playerId) throw new Error('Tu ne peux pas voter contre toi-même.');
    s.votes[playerId] = t;
  }
  return { state: settle(s, ctx) };
}

// Le minuteur de la phase est échu : chacun garde ce qu'il a fait, le reste est « pas d'action ».
export function timeout(state, ctx) {
  const s = clone(state);
  if (s.phase === 'night') endNight(s, ctx);
  else if (s.phase === 'witch') s.witchDone = true;
  else if (s.phase === 'hunter') shoot(s, s.hunters[0], null);
  else if (s.phase === 'debate') startVote(s, ctx);
  else if (s.phase === 'vote') resolveVote(s, ctx);
  return { state: settle(s, ctx) };
}

// Un joueur part : il est éliminé (rôle révélé), la partie continue sans lui.
export function leave(state, playerId, ctx) {
  const s = clone(state);
  if (s.phase === 'over' || s.left.includes(playerId)) return { state: s };
  s.left.push(playerId);
  if (!isDead(s, playerId)) {
    const before = s.dead.length;
    kill(s, playerId, 'left');
    s.log.push({ k: 'left', id: playerId, dead: s.dead.slice(before).map((d) => d.id) });
  }
  return { state: settle(s, ctx) };
}

// ——— Vues ———

const publicCause = (c) => (c === 'wolves' || c === 'poison' ? 'night' : c);

// Ce que voit une personne. playerId null = spectateur : seulement le public.
export function view(s, playerId) {
  const viewer = playerId !== null && !s.left.includes(playerId) && s.players.includes(playerId) ? playerId : null;
  const over = s.phase === 'over';
  const meDead = viewer !== null && isDead(s, viewer);
  const god = over || meDead; // les morts et la fin de partie voient tous les rôles
  const myRole = viewer !== null ? s.roles[viewer] : null;
  const wolfSide = god || myRole === 'wolf';

  const roles = {};
  for (const d of s.dead) roles[d.id] = d.role;
  for (const id of s.players) {
    if (god || id === viewer || (myRole === 'wolf' && s.roles[id] === 'wolf')) roles[id] = s.roles[id];
  }

  const v = {
    players: s.players,
    phase: s.phase,
    n: s.n,
    comp: s.comp,
    dead: s.dead.map((d) => ({ id: d.id, role: d.role, cause: publicCause(d.cause), n: d.n })),
    left: s.left,
    log: s.log,
    roles,
    winner: over ? s.winner : null,
    // Cupidon connaît le couple qu'il a formé ; les autres ne le voient pas (hors amoureux et morts).
    lovers: god || (viewer !== null && (s.lovers?.includes(viewer) || myRole === 'cupid')) ? s.lovers : null,
    god,
    me: viewer === null ? null : { id: viewer, role: myRole, alive: !meDead },
    hunter: s.phase === 'hunter' ? s.hunters[0] : null,
    after: s.phase === 'hunter' ? s.after : null,
    span: over ? 0 : s.span,
    ready: s.phase === 'debate' ? s.ready.length : 0,
    voted: s.phase === 'vote' ? Object.keys(s.votes).length : 0,
    aliveCount: alive(s).length,
  };
  if (viewer !== null && !meDead) {
    if (s.phase === 'debate') v.me.ready = s.ready.includes(viewer);
    if (s.phase === 'vote') v.me.vote = viewer in s.votes ? s.votes[viewer] : undefined;
    if (s.phase === 'night') {
      if (myRole === 'cupid') v.me.acted = s.n !== 1 || s.acts.cupid;
      if (myRole === 'seer') v.me.acted = s.acts.seer;
    }
  }
  if (s.phase === 'night' && wolfSide) {
    v.wolfVotes = s.wolfVotes;
    v.wolves = s.players.filter((id) => s.roles[id] === 'wolf' && !isDead(s, id));
  }
  if (myRole === 'seer' || god) v.seen = s.seen;
  if (myRole === 'witch' || god) {
    v.witch = {
      life: s.potions.life,
      death: s.potions.death,
      victim: s.phase === 'witch' ? s.victim : null,
      saved: s.saved,
      poisoned: s.poisoned,
      done: s.witchDone,
    };
  }
  return v;
}

export function status(s) {
  const over = s.phase === 'over';
  // La nuit (et la Sorcière), qui agit est secret : personne n'a « la main » en public (turn est montré à toute
  // la classe), et les actions passent par `may`, qui reste sur le serveur. Les règles vérifient chaque rôle.
  const secret = s.phase === 'night' || s.phase === 'witch';
  let turn = null;
  if (!over && !secret) turn = s.phase === 'hunter' ? s.hunters[0] ?? null : alive(s);
  return {
    turn,
    ...(!over && secret ? { may: alive(s) } : {}),
    over,
    winners: over ? s.winner.ids : [],
    deadline: over ? null : s.deadline,
  };
}
