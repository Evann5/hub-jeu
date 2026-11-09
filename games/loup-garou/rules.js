// Loups-garous : les règles, pures (ni réseau, ni base, ni affichage). Le hasard et l'heure arrivent par ctx.
//
// Déroulé d'un tour :
//   night     le Voleur et Cupidon (1re nuit), la Voyante, le Salvateur, le Corbeau, les Loups (et le Loup blanc une
//             nuit sur deux) agissent en même temps ; la Petite fille peut espionner la discussion des loups.
//   witch     la Sorcière apprend la victime des loups et peut la sauver ou empoisonner quelqu'un.
//   (aube)    les morts de la nuit sont annoncés, rôle révélé (option) ; le Chasseur mort tire (phase hunter),
//             le Capitaine mort désigne son successeur (phase heir).
//   election  1er jour, option Capitaine : le village élit son Capitaine.
//   debate    le village débat (chat de table) ; tout le monde peut passer au vote.
//   vote      vote du village : la majorité relative élimine (le Capitaine compte double et départage), le Chasseur tire.
//
// Choix documentés :
// - status().turn contient TOUS les vivants pendant la nuit : le hub publie « turn » à tous les membres, et une liste
//   réduite aux loups ou à la Voyante dévoilerait les rôles. Seuls les vrais acteurs ont une action possible.
// - Loups : la nuit se termine dès que tous les loups vivants ont voté pour la même victime (et que les autres rôles
//   de la nuit ont agi). Sinon, à l'échéance, la victime est la plus votée ; en cas d'égalité, tirage au sort parmi
//   les ex æquo ; sans aucun vote, pas de victime.
// - Village : égalité ou aucun vote = personne n'est éliminé (sauf si le Capitaine a voté pour l'un des ex æquo).
// - Un joueur qui part est éliminé (rôle révélé, les amoureux le suivent, pas de tir du Chasseur ; s'il était
//   Capitaine, son successeur est tiré au sort).
// - Une option absente vaut le comportement d'avant les nouveaux rôles : rôles nouveaux et Capitaine désactivés,
//   rôles des morts révélés. Le salon (game.json) coche le Capitaine par défaut.

const clone = (s) => structuredClone(s);

// Une partie commencée avant les nouveaux rôles (état enregistré en base) : on complète les champs manquants.
const LATER = {
  opts: { captain: false, wolfChat: false, reveal: true }, extra: null, captain: null, elected: false, heirFrom: null,
  protected: null, guardLast: null, elderShield: true, powersLost: false, powersBy: null, idiot: null, spying: false,
  spotted: null, ravenMark: null, marked: null, whiteVictim: null, stole: null, wolfChat: [],
};
function upgrade(s) {
  for (const [k, v] of Object.entries(LATER)) if (s[k] === undefined) s[k] = clone(v);
  return s;
}

// Échéance d'une phase ; span (sa durée) sert au client pour dessiner la barre de temps.
function setDeadline(s, ctx, ms) {
  s.deadline = ctx.now + ms;
  s.span = ms;
}

export const ROLES = ['wolf', 'villager', 'seer', 'witch', 'hunter', 'cupid', 'guard', 'elder', 'idiot', 'littleGirl', 'raven', 'whiteWolf', 'thief'];
const SPECIALS = ['seer', 'witch', 'hunter', 'cupid']; // du plus important au moins important (cochés par défaut)
const EXTRAS = ['guard', 'elder', 'idiot', 'littleGirl', 'raven', 'thief']; // rôles en option, décochés par défaut
// Villageois à pouvoir : ils perdent leurs pouvoirs si l'Ancien est tué par le village, la Sorcière ou le Chasseur.
const POWERS = ['seer', 'witch', 'hunter', 'guard', 'littleGirl', 'raven', 'idiot'];
const SHORT_WITCH_MS = 6000; // Sorcière sans potion : une phase courte, pour ne pas révéler qu'elle n'a plus rien
// La 1re nuit dure 10 s de plus : le temps de lire sa carte de rôle. La durée ne dépend jamais des rôles vivants
// (sinon elle révélerait qui est en vie).
export const FIRST_NIGHT_BONUS_MS = 10_000;

// Discussion des loups : messages courts, débit limité, fil borné (l'état est enregistré après chaque coup).
export const CHAT_MAX_LEN = 200;
export const CHAT_BURST = 4; // messages au plus par loup…
export const CHAT_WINDOW_MS = 10_000; // … sur 10 secondes
export const CHAT_NIGHT_MAX = 60; // messages au plus par nuit, toute la meute
const CHAT_KEEP = 150; // messages gardés en tout
export const SPY_RISK = 0.2; // la Petite fille qui espionne : 1 chance sur 5 d'être repérée

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 18;

export const isWolf = (role) => role === 'wolf' || role === 'whiteWolf';

// Nombre de loups conseillé selon le nombre de joueurs.
export function autoWolves(n) {
  return Math.max(1, Math.floor((n + 1) / 4));
}

// Composition des cartes : { wolf: 2, seer: 1, ... } (les villageois complètent). Avec le Voleur, deux cartes de
// Villageois en plus : n + 2 cartes, dont deux restent au milieu.
export function composition(n, options = {}) {
  const maxWolves = Math.max(1, Math.floor((n - 1) / 2));
  const asked = Number(options.wolves) || 0;
  const white = options.whiteWolf === true && maxWolves >= 2 ? 1 : 0; // le Loup blanc s'ajoute aux loups
  const wolves = Math.max(1, Math.min(maxWolves - white, asked > 0 ? asked : autoWolves(n)));
  const wanted = [...SPECIALS.filter((r) => options[r] !== false), ...EXTRAS.filter((r) => options[r] === true)];
  const room = Math.max(0, n - wolves - white - 1); // au moins un villageois
  const specials = wanted.slice(0, room);
  const comp = { wolf: wolves };
  if (white) comp.whiteWolf = 1;
  for (const r of specials) comp[r] = 1;
  comp.villager = n - wolves - white - specials.length + (comp.thief ? 2 : 0);
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
  if (comp.thief && !pool.slice(0, ids.length).some(isWolf)) {
    // Avec le Voleur, les loups ne restent jamais tous au milieu (la partie serait finie avant de commencer).
    const w = ids.length + pool.slice(ids.length).findIndex(isWolf);
    const j = pool.slice(0, ids.length).findLastIndex((r) => r !== 'thief');
    [pool[w], pool[j]] = [pool[j], pool[w]];
  }
  const roles = {};
  ids.forEach((id, i) => { roles[id] = pool[i]; });
  const s = {
    players: ids,
    comp,
    times: { night: sec(options.night, 45), debate: sec(options.debate, 120), vote: sec(options.vote, 45) },
    opts: {
      captain: options.captain === true,
      wolfChat: options.wolfChat === true || options.littleGirl === true, // la Petite fille espionne cette discussion
      reveal: options.reveal !== false,
    },
    roles,
    extra: comp.thief ? pool.slice(ids.length) : null, // les deux cartes du milieu (Voleur)
    dead: [], // { id, role, cause: 'wolves' | 'poison' | 'vote' | 'shot' | 'love' | 'left', n }
    left: [],
    lovers: null,
    n: 1,
    phase: 'night',
    deadline: null,
    span: 0,
    acts: { cupid: false, seer: false, thief: false, guard: false, raven: false, white: false },
    wolfVotes: {},
    victim: null,
    saved: false,
    poisoned: null,
    witchDone: false,
    potions: { life: true, death: true },
    seen: [], // { n, target, role } : ce que la Voyante a vu
    hunters: [],
    after: 'debate', // où aller quand les derniers gestes (Chasseur, Capitaine) sont faits : 'debate' ou 'night'
    ready: [],
    votes: {},
    log: [],
    winner: null, // { side: 'village' | 'wolves' | 'lovers' | 'white' | 'none', ids: [] }
    // Nouveaux rôles (inertes quand ils ne sont pas en jeu)
    captain: null,
    elected: false,
    heirFrom: null, // le Capitaine qui doit désigner son successeur
    protected: null, // Salvateur : protégé cette nuit
    guardLast: null, // … et la nuit précédente
    elderShield: true, // l'Ancien survit à la première attaque des loups
    powersLost: false,
    idiot: null, // l'Idiot révélé par le vote
    spying: false, // la Petite fille espionne cette nuit
    spotted: null, // la Petite fille repérée par les loups
    ravenMark: null, // cible du Corbeau cette nuit…
    marked: null, // … annoncée au village pour le vote du jour
    whiteVictim: null,
    stole: null, // { took } : ce que le Voleur a pris
    wolfChat: [], // { n, from, text, at }
  };
  setDeadline(s, ctx, s.times.night + FIRST_NIGHT_BONUS_MS);
  return settle(s, ctx);
}

// ——— Aides ———

const isDead = (s, id) => s.dead.some((d) => d.id === id);
const alive = (s) => s.players.filter((id) => !isDead(s, id));
const aliveWith = (s, role) => alive(s).filter((id) => s.roles[id] === role);
const wolvesAlive = (s) => alive(s).filter((id) => isWolf(s.roles[id]));
const mixedLovers = (s) => Boolean(s.lovers) && isWolf(s.roles[s.lovers[0]]) !== isWolf(s.roles[s.lovers[1]]);
const voters = (s) => alive(s).filter((id) => id !== s.idiot); // l'Idiot révélé ne vote plus
const pick = (list, ctx) => list[Math.floor(ctx.random() * list.length)];

// count : Map id -> voix. Rend les ex æquo de tête.
function leadersOf(count) {
  const top = Math.max(0, ...count.values());
  const leaders = [...count.entries()].filter(([, c]) => c === top).map(([id]) => Number(id)).sort((a, b) => a - b);
  return { top, leaders };
}

function tally(votes, weight = () => 1) {
  const count = new Map();
  for (const [from, t] of Object.entries(votes)) if (t !== null && t !== undefined) count.set(t, (count.get(t) || 0) + weight(Number(from)));
  return { count, ...leadersOf(count) };
}

// Mort d'un joueur (et des amoureux qui le suivent). Les Chasseurs morts sont mis en file pour tirer.
function kill(s, id, cause) {
  if (isDead(s, id) || !s.players.includes(id)) return;
  s.dead.push({ id, role: s.roles[id], cause, n: s.n });
  delete s.wolfVotes[id];
  delete s.votes[id];
  for (const book of [s.wolfVotes, s.votes]) for (const [voter, t] of Object.entries(book)) if (t === id) delete book[voter];
  s.ready = s.ready.filter((x) => x !== id);
  if (s.roles[id] === 'elder' && ['vote', 'poison', 'shot'].includes(cause) && !s.powersLost) {
    s.powersLost = true;
    s.hunters = [];
    s.powersBy = id; // annoncé dans le journal après l'aube, le vote ou le tir (notePowers)
  }
  if (s.roles[id] === 'hunter' && cause !== 'left' && !s.powersLost) s.hunters.push(id);
  if (s.captain === id) {
    s.captain = null;
    s.heirFrom = id;
  }
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
  if (wolves === 0) return { side: 'village', ids: s.players.filter((id) => !isWolf(s.roles[id])) };
  const white = aliveWith(s, 'whiteWolf');
  if (white.length) {
    // Le Loup blanc joue seul : il gagne s'il est le dernier vivant ; tant qu'il vit, les loups n'ont pas gagné.
    return living.length === 1 ? { side: 'white', ids: white } : null;
  }
  if (wolves >= living.length - wolves) return { side: 'wolves', ids: s.players.filter((id) => s.roles[id] === 'wolf') };
  return null;
}

function finish(s, winner) {
  s.winner = winner;
  s.phase = 'over';
  s.deadline = null;
}

const bothWolves = (s) => Boolean(s.extra) && s.extra.every(isWolf);

// Qui doit encore agir cette nuit (vrais acteurs seulement). La Petite fille n'est jamais attendue.
function nightPending(s) {
  const pending = [];
  if (s.n === 1 && !s.acts.thief && s.extra) pending.push(...aliveWith(s, 'thief'));
  if (s.n === 1 && !s.acts.cupid) pending.push(...aliveWith(s, 'cupid'));
  if (!s.powersLost) {
    if (!s.acts.seer) pending.push(...aliveWith(s, 'seer'));
    if (!s.acts.guard) pending.push(...aliveWith(s, 'guard'));
    if (!s.acts.raven) pending.push(...aliveWith(s, 'raven'));
  }
  if (s.n % 2 === 0 && !s.acts.white) pending.push(...aliveWith(s, 'whiteWolf'));
  const wolves = wolvesAlive(s);
  const votes = wolves.map((w) => s.wolfVotes[w]);
  const agreed = votes.every((v) => v !== undefined) && new Set(votes).size <= 1;
  const prey = alive(s).some((id) => !isWolf(s.roles[id])); // plus que des loups (Loup blanc) : rien à dévorer
  if (!agreed && prey) pending.push(...wolves);
  return pending;
}

function witchCanAct(s) {
  if (s.powersLost) return false;
  return (s.potions.life && s.victim !== null && !s.saved) || (s.potions.death && s.poisoned === null);
}

function startNight(s, ctx, n) {
  s.n = n;
  s.phase = 'night';
  s.acts = { cupid: true, seer: false, thief: true, guard: false, raven: false, white: false };
  s.wolfVotes = {};
  s.victim = null;
  s.saved = false;
  s.poisoned = null;
  s.witchDone = false;
  s.ready = [];
  s.votes = {};
  s.guardLast = s.protected;
  s.protected = null;
  s.spying = false;
  s.ravenMark = null;
  s.marked = null;
  s.whiteVictim = null;
  setDeadline(s, ctx, s.times.night);
}

function startDebate(s, ctx) {
  s.phase = 'debate';
  s.ready = [];
  s.votes = {};
  setDeadline(s, ctx, s.times.debate);
}

// Le jour commence : l'élection du Capitaine au 1er jour (option), sinon le débat.
function startDay(s, ctx) {
  if (s.opts?.captain && !s.elected) {
    s.phase = 'election';
    s.votes = {};
    s.ready = [];
    setDeadline(s, ctx, s.times.vote);
  } else startDebate(s, ctx);
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

function startHeir(s, ctx, after) {
  s.phase = 'heir';
  s.after = after;
  setDeadline(s, ctx, s.times.vote);
}

// Après des morts : le Chasseur tire, puis le Capitaine mort désigne son successeur, puis la suite.
function lastWords(s, ctx, after) {
  if (s.hunters.length) startHunter(s, ctx, after);
  else if (s.heirFrom !== null) startHeir(s, ctx, after);
  else goOn(s, ctx, after);
}

function goOn(s, ctx, after) {
  if (after === 'debate') startDay(s, ctx);
  else startNight(s, ctx, s.n + 1);
}

function setCaptain(s, id, how, from = null) {
  s.captain = id;
  s.heirFrom = null;
  s.log.push({ k: 'captain', n: s.n, id, how, ...(from !== null ? { from } : {}) });
}

// Successeur au hasard (minuteur échu, Capitaine parti).
function autoHeir(s, ctx) {
  const from = s.heirFrom;
  const living = alive(s).filter((id) => id !== from);
  if (!living.length) {
    s.heirFrom = null;
    return;
  }
  setCaptain(s, pick(living, ctx), 'random', from);
}

// Rôles des morts cachés : la phase de la Sorcière dure toujours autant, morte ou sans potion ; sinon sa durée trahirait sa mort.
const hideWitch = (s) => s.opts?.reveal === false && !s.powersLost && Object.values(s.roles).includes('witch');

// Fin de la nuit : les loups ont choisi, la Sorcière est prévenue.
function endNight(s, ctx) {
  // Le Voleur qui n'a pas choisi garde sa carte, sauf si les deux cartes du milieu sont des loups : il en prend une.
  const thief = aliveWith(s, 'thief')[0];
  if (s.n === 1 && !s.acts.thief && thief !== undefined && bothWolves(s)) steal(s, thief, Math.floor(ctx.random() * 2));
  s.acts.thief = true;
  const { leaders } = tally(s.wolfVotes);
  let victim = leaders.length ? leaders[Math.floor(ctx.random() * leaders.length)] : null;
  if (victim !== null && victim === s.protected) victim = null; // le Salvateur a protégé la victime
  s.victim = victim;
  s.phase = 'witch';
  s.witchDone = s.powersLost || (!aliveWith(s, 'witch').length && !hideWitch(s));
  setDeadline(s, ctx, witchCanAct(s) || hideWitch(s) ? s.times.night : SHORT_WITCH_MS);
}

// Aube : on applique la victime des loups (si elle n'est pas sauvée) et le poison, puis on annonce.
function morning(s, ctx) {
  const before = s.dead.length;
  if (s.victim !== null && !s.saved) {
    if (s.roles[s.victim] === 'elder' && s.elderShield) s.elderShield = false; // l'Ancien survit une fois
    else kill(s, s.victim, 'wolves');
  }
  if (s.whiteVictim !== null && s.whiteVictim !== s.protected) kill(s, s.whiteVictim, 'wolves');
  if (s.poisoned !== null) kill(s, s.poisoned, 'poison');
  s.log.push({ k: 'dawn', n: s.n, dead: s.dead.slice(before).map((d) => d.id) });
  if (s.ravenMark !== null && !isDead(s, s.ravenMark)) {
    s.marked = s.ravenMark;
    s.log.push({ k: 'raven', n: s.n, target: s.marked });
  }
  s.victim = null;
  notePowers(s);
  lastWords(s, ctx, 'debate');
}

function resolveElection(s, ctx) {
  const ballots = Object.entries(s.votes).map(([from, to]) => [Number(from), to]);
  const { leaders } = tally(s.votes);
  const pool = leaders.length ? leaders : alive(s);
  s.elected = true;
  s.log.push({ k: 'election', n: s.n, ballots });
  if (pool.length) setCaptain(s, pool.length === 1 ? pool[0] : pick(pool, ctx), leaders.length === 1 ? 'vote' : 'draw');
  s.votes = {};
  startDebate(s, ctx);
}

function resolveVote(s, ctx) {
  const weight = (from) => (from === s.captain ? 2 : 1);
  const { count } = tally(s.votes, weight);
  if (s.marked !== null && !isDead(s, s.marked)) count.set(s.marked, (count.get(s.marked) || 0) + 2); // le Corbeau
  const { top, leaders } = leadersOf(count);
  const ballots = Object.entries(s.votes).map(([from, to]) => [Number(from), to]);
  let out = top > 0 && leaders.length === 1 ? leaders[0] : null;
  if (out === null && top > 0 && s.captain !== null && leaders.includes(s.votes[s.captain])) out = s.votes[s.captain]; // le Capitaine départage
  const entry = { k: 'vote', n: s.n, ballots, out };
  if (s.captain !== null || s.marked !== null) Object.assign(entry, { count: out === null ? 0 : count.get(out), captain: s.captain, marked: s.marked });
  if (out !== null && s.roles[out] === 'idiot' && s.idiot === null && !s.powersLost) {
    // L'Idiot du village est révélé : il reste en vie mais ne vote plus. Capitaine, il passe la main.
    s.idiot = out;
    entry.spared = true;
    s.log.push(entry);
    if (s.captain === out) {
      s.captain = null;
      s.heirFrom = out;
    }
  } else {
    s.log.push(entry);
    if (out !== null) kill(s, out, 'vote');
  }
  notePowers(s);
  lastWords(s, ctx, 'night');
}

function shoot(s, hunter, target) {
  s.hunters = s.hunters.filter((h) => h !== hunter);
  if (target === null) return;
  const before = s.dead.length;
  kill(s, target, 'shot');
  s.log.push({ k: 'shot', n: s.n, hunter, target, dead: s.dead.slice(before).map((d) => d.id) });
  notePowers(s);
}

// L'Ancien vient d'être tué par le village, la Sorcière ou le Chasseur : on l'annonce une fois.
function notePowers(s) {
  if (s.powersBy === null || s.powersBy === undefined) return;
  s.log.push({ k: 'powers', n: s.n, id: s.powersBy });
  s.powersBy = null;
}

// Le Voleur prend la carte du milieu n° i (la sienne y retourne).
function steal(s, id, i) {
  const took = s.extra[i];
  s.extra[i] = 'thief';
  s.roles[id] = took;
  s.stole = { id, took };
  s.acts.thief = true;
  // Devenu loup : la meute ne peut plus le dévorer cette nuit.
  if (isWolf(took)) for (const [w, target] of Object.entries(s.wolfVotes)) if (target === id) delete s.wolfVotes[w];
}

// Fait avancer la partie tant qu'une phase est terminée (tout le monde a agi, quelqu'un est parti…).
function settle(s, ctx) {
  for (let guard = 0; guard < 30; guard++) {
    s.hunters = s.hunters.filter((h) => !s.left.includes(h));
    if (s.heirFrom !== null && s.left.includes(s.heirFrom)) autoHeir(s, ctx);
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
      if (!s.witchDone && (aliveWith(s, 'witch').length || hideWitch(s))) return s; // morte et rôles cachés : on attend le minuteur
      morning(s, ctx);
    } else if (s.phase === 'hunter') {
      if (s.hunters.length) return s;
      const win = checkWin(s);
      if (win) {
        finish(s, win);
        return s;
      }
      if (s.heirFrom !== null) startHeir(s, ctx, s.after);
      else goOn(s, ctx, s.after);
    } else if (s.phase === 'heir') {
      if (s.heirFrom !== null) return s;
      goOn(s, ctx, s.after);
    } else if (s.phase === 'election') {
      if (!voters(s).every((id) => id in s.votes)) return s;
      resolveElection(s, ctx);
    } else if (s.phase === 'debate') {
      const living = alive(s);
      if (!living.every((id) => s.ready.includes(id))) return s;
      startVote(s, ctx);
    } else if (s.phase === 'vote') {
      if (!voters(s).every((id) => id in s.votes)) return s;
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

const NOPE = 'Tu ne peux pas faire ça cette nuit.';
const noPower = (s) => {
  if (s.powersLost) throw new Error('L’Ancien a été tué par le village : les villageois ont perdu leurs pouvoirs.');
};

// Message de la discussion des loups : texte nettoyé, longueur et débit bornés.
function chat(s, playerId, raw, ctx) {
  if (!s.opts?.wolfChat) throw new Error('La discussion des loups n’est pas activée dans cette partie.');
  const text = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('Écris un message avant de l’envoyer.');
  if (text.length > CHAT_MAX_LEN) throw new Error(`Message trop long : ${CHAT_MAX_LEN} caractères au plus.`);
  const recent = s.wolfChat.filter((m) => m.from === playerId && m.at > ctx.now - CHAT_WINDOW_MS).length;
  if (recent >= CHAT_BURST) throw new Error('Doucement : attends quelques secondes avant d’écrire encore.');
  if (s.wolfChat.filter((m) => m.n === s.n).length >= CHAT_NIGHT_MAX) throw new Error('La meute a assez parlé cette nuit : choisissez votre victime.');
  s.wolfChat.push({ n: s.n, from: playerId, text, at: ctx.now });
  if (s.wolfChat.length > CHAT_KEEP) s.wolfChat = s.wolfChat.slice(-CHAT_KEEP);
}

export function move(state, playerId, action, ctx) {
  const s = upgrade(clone(state));
  const a = action && typeof action === 'object' ? action : {};
  if (s.phase === 'over') throw new Error('La partie est terminée.');
  const lastAct = (s.phase === 'hunter' && s.hunters[0] === playerId) || (s.phase === 'heir' && s.heirFrom === playerId);
  if (!isAlive(s, playerId) && !lastAct) {
    throw new Error('Tu es mort : tu regardes la suite de la partie.');
  }
  const role = s.roles[playerId];

  if (s.phase === 'night') {
    if (a.type === 'love') {
      if (role !== 'cupid' || s.n !== 1 || s.acts.cupid) throw new Error(NOPE);
      const pair = [...new Set([].concat(a.targets ?? []).map((x) => target(s, x)))];
      if (pair.length !== 2) throw new Error('Choisis deux personnes différentes à unir.');
      s.lovers = pair;
      s.acts.cupid = true;
    } else if (a.type === 'peek') {
      if (role !== 'seer' || s.acts.seer) throw new Error(NOPE);
      noPower(s);
      const t = target(s, a.target);
      if (t === playerId) throw new Error('Tu te connais déjà : choisis quelqu’un d’autre.');
      s.seen.push({ n: s.n, target: t, role: s.roles[t] });
      s.acts.seer = true;
    } else if (a.type === 'wolf') {
      if (!isWolf(role)) throw new Error(NOPE);
      const t = target(s, a.target);
      if (isWolf(s.roles[t])) throw new Error('Tu ne peux pas dévorer un autre loup.');
      s.wolfVotes[playerId] = t;
    } else if (a.type === 'wolfChat') {
      if (!isWolf(role)) throw new Error(NOPE);
      chat(s, playerId, a.text, ctx);
    } else if (a.type === 'steal') {
      if (role !== 'thief' || s.n !== 1 || s.acts.thief || !s.extra) throw new Error(NOPE);
      if (a.pick === null || a.pick === undefined) {
        if (bothWolves(s)) throw new Error('Les deux cartes sont des loups : tu dois en prendre une.');
        s.acts.thief = true;
      } else {
        const i = Number(a.pick);
        if (i !== 0 && i !== 1) throw new Error('Choisis l’une des deux cartes.');
        steal(s, playerId, i);
      }
    } else if (a.type === 'protect') {
      if (role !== 'guard' || s.acts.guard) throw new Error(NOPE);
      noPower(s);
      const t = target(s, a.target);
      if (t === s.guardLast) throw new Error('Tu l’as déjà protégé la nuit dernière : choisis quelqu’un d’autre.');
      s.protected = t;
      s.acts.guard = true;
    } else if (a.type === 'mark') {
      if (role !== 'raven' || s.acts.raven) throw new Error(NOPE);
      noPower(s);
      const t = a.target === null || a.target === undefined ? null : target(s, a.target);
      if (t === playerId) throw new Error('Désigne quelqu’un d’autre que toi.');
      s.ravenMark = t;
      s.acts.raven = true;
    } else if (a.type === 'spy') {
      if (role !== 'littleGirl' || s.spying) throw new Error(NOPE);
      noPower(s);
      if (!s.opts?.wolfChat) throw new Error(NOPE);
      s.spying = true;
      if (ctx.random() < SPY_RISK) s.spotted = playerId;
    } else if (a.type === 'white') {
      if (role !== 'whiteWolf' || s.n % 2 !== 0 || s.acts.white) throw new Error(NOPE);
      const t = a.target === null || a.target === undefined ? null : target(s, a.target);
      if (t !== null && (t === playerId || !isWolf(s.roles[t]))) throw new Error('Choisis un autre loup de la meute, ou épargne-la.');
      s.whiteVictim = t;
      s.acts.white = true;
    } else {
      throw new Error(NOPE);
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
  } else if (s.phase === 'heir') {
    if (s.heirFrom !== playerId) throw new Error('Le Capitaine est en train de choisir son successeur.');
    if (a.type !== 'heir') throw new Error('Choisis ton successeur.');
    const t = target(s, a.target);
    if (t === playerId) throw new Error('Choisis quelqu’un d’autre que toi.');
    setCaptain(s, t, 'heir', playerId);
  } else if (s.phase === 'election') {
    if (a.type !== 'elect') throw new Error('Le village élit son Capitaine.');
    if (playerId === s.idiot) throw new Error('Tu as été révélé : tu ne votes plus.');
    s.votes[playerId] = target(s, a.target);
  } else if (s.phase === 'debate') {
    if (a.type !== 'ready') throw new Error('Le débat est en cours.');
    if (!s.ready.includes(playerId)) s.ready.push(playerId);
  } else if (s.phase === 'vote') {
    if (a.type !== 'vote') throw new Error('C’est l’heure du vote.');
    if (playerId === s.idiot) throw new Error('Tu as été révélé : tu ne votes plus.');
    const t = a.target === null || a.target === undefined ? null : target(s, a.target);
    if (t === playerId) throw new Error('Tu ne peux pas voter contre toi-même.');
    s.votes[playerId] = t;
  }
  return { state: settle(s, ctx) };
}

// Le minuteur de la phase est échu : chacun garde ce qu'il a fait, le reste est « pas d'action ».
export function timeout(state, ctx) {
  const s = upgrade(clone(state));
  if (s.phase === 'night') endNight(s, ctx);
  else if (s.phase === 'witch') s.witchDone = true;
  else if (s.phase === 'hunter') shoot(s, s.hunters[0], null);
  else if (s.phase === 'heir') autoHeir(s, ctx);
  else if (s.phase === 'election') resolveElection(s, ctx);
  else if (s.phase === 'debate') startVote(s, ctx);
  else if (s.phase === 'vote') resolveVote(s, ctx);
  return { state: settle(s, ctx) };
}

// Un joueur part : il est éliminé (rôle révélé), la partie continue sans lui.
export function leave(state, playerId, ctx) {
  const s = upgrade(clone(state));
  if (s.phase === 'over' || s.left.includes(playerId)) return { state: s };
  s.left.push(playerId);
  if (!isDead(s, playerId)) {
    const before = s.dead.length;
    kill(s, playerId, 'left');
    s.log.push({ k: 'left', id: playerId, dead: s.dead.slice(before).map((d) => d.id) });
  }
  // Un Capitaine mort pendant un départ (amoureux) n'a pas de phase pour choisir : successeur au hasard.
  if (s.heirFrom !== null && s.phase !== 'hunter' && s.phase !== 'heir') autoHeir(s, ctx);
  return { state: settle(s, ctx) };
}

// ——— Vues ———

const publicCause = (c) => (c === 'wolves' || c === 'poison' ? 'night' : c);

// Ce que voit une personne. playerId null = spectateur : seulement le public.
export function view(state, playerId) {
  const s = upgrade({ ...state });
  const viewer = playerId !== null && !s.left.includes(playerId) && s.players.includes(playerId) ? playerId : null;
  const over = s.phase === 'over';
  const meDead = viewer !== null && isDead(s, viewer);
  const god = over || meDead; // les morts et la fin de partie voient tous les rôles
  const myRole = viewer !== null ? s.roles[viewer] : null;
  const wolfSide = god || (isWolf(myRole) && !meDead);
  const reveal = s.opts?.reveal !== false;

  // Rôles connus : les siens, ceux de la meute (le Loup blanc s'y montre en simple loup), les morts (option),
  // l'Idiot révélé, la Petite fille repérée (pour les loups).
  const roles = {};
  for (const id of s.players) {
    const r = s.roles[id];
    if (god || id === viewer) roles[id] = r;
    else if (reveal && isDead(s, id)) roles[id] = s.dead.find((d) => d.id === id).role;
    else if (isWolf(myRole) && isWolf(r)) roles[id] = myRole === 'whiteWolf' ? r : 'wolf';
    else if (isWolf(myRole) && s.spotted === id) roles[id] = r;
    else if (s.idiot === id) roles[id] = r;
  }

  const v = {
    players: s.players,
    phase: s.phase,
    n: s.n,
    comp: s.comp,
    dead: s.dead.map((d) => ({ id: d.id, role: roles[d.id] ?? null, cause: publicCause(d.cause), n: d.n })),
    left: s.left,
    log: s.log,
    roles,
    winner: over ? s.winner : null,
    // Cupidon connaît le couple qu'il a formé ; les autres ne le voient pas (hors amoureux et morts).
    lovers: god || (viewer !== null && (s.lovers?.includes(viewer) || myRole === 'cupid')) ? s.lovers : null,
    god,
    me: viewer === null ? null : { id: viewer, role: myRole, alive: !meDead },
    hunter: s.phase === 'hunter' ? s.hunters[0] : null,
    after: s.phase === 'hunter' || s.phase === 'heir' ? s.after : null,
    span: over ? 0 : s.span,
    ready: s.phase === 'debate' ? s.ready.length : 0,
    voted: s.phase === 'vote' || s.phase === 'election' ? Object.keys(s.votes).length : 0,
    voters: voters(s).length,
    aliveCount: alive(s).length,
    // Public : le Capitaine, son successeur à désigner, la cible du Corbeau (annoncée), l'Idiot, la perte des pouvoirs.
    opts: { captain: Boolean(s.opts?.captain), wolfChat: Boolean(s.opts?.wolfChat), reveal },
    captain: s.captain ?? null,
    heirFrom: s.phase === 'heir' ? s.heirFrom : null,
    marked: s.phase === 'debate' || s.phase === 'vote' ? s.marked ?? null : null,
    idiot: s.idiot ?? null,
    powersLost: Boolean(s.powersLost),
  };
  if (viewer !== null && (!meDead || s.heirFrom === viewer)) {
    if (s.phase === 'debate') v.me.ready = s.ready.includes(viewer);
    if (s.phase === 'vote' || s.phase === 'election') v.me.vote = viewer in s.votes ? s.votes[viewer] : undefined;
    if (s.phase === 'night') {
      if (myRole === 'cupid') v.me.acted = s.n !== 1 || s.acts.cupid;
      if (myRole === 'seer') v.me.acted = s.acts.seer;
      if (myRole === 'guard') v.me.acted = s.acts.guard;
      if (myRole === 'raven') v.me.acted = s.acts.raven;
      if (myRole === 'thief') v.me.acted = s.n !== 1 || s.acts.thief;
      if (myRole === 'littleGirl') v.me.acted = s.spying;
    }
  }
  if (s.phase === 'night' && wolfSide) {
    v.wolfVotes = s.wolfVotes;
    v.wolves = s.players.filter((id) => isWolf(s.roles[id]) && !isDead(s, id));
    v.listening = Boolean(s.spying) && aliveWith(s, 'littleGirl').length > 0; // « quelqu'un écoute », sans dire qui
  }
  if (isWolf(myRole) && !meDead && s.spotted !== null) v.spotted = s.spotted;
  if (s.opts?.wolfChat) {
    if (god || (isWolf(myRole) && !meDead)) v.wolfChat = s.wolfChat;
    else if (myRole === 'littleGirl' && !meDead && s.phase === 'night' && s.spying) {
      v.wolfChat = s.wolfChat.filter((m) => m.n === s.n).map((m) => ({ n: m.n, text: m.text, at: m.at })); // sans les noms
    }
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
  if (myRole === 'guard' || god) v.guard = { protected: s.protected ?? null, last: s.guardLast ?? null };
  if (myRole === 'raven' || god) v.raven = { target: s.ravenMark ?? null };
  if (myRole === 'elder' || god) v.elder = { shield: Boolean(s.elderShield) };
  if (myRole === 'whiteWolf' || god) v.white = { night: s.n % 2 === 0, done: Boolean(s.acts?.white), target: s.whiteVictim ?? null };
  if ((myRole === 'thief' && s.n === 1 && s.phase === 'night' && !s.acts.thief) || (god && s.extra)) v.extra = s.extra;
  if (s.stole && (god || s.stole.id === viewer)) v.stole = s.stole;
  return v;
}

export function status(state) {
  const s = upgrade({ ...state });
  const over = s.phase === 'over';
  // La nuit (et la Sorcière), qui agit est secret : personne n'a « la main » en public (turn est montré à toute
  // la classe), et les actions passent par `may`, qui reste sur le serveur. Les règles vérifient chaque rôle.
  const secret = s.phase === 'night' || s.phase === 'witch';
  let turn = null;
  if (!over && !secret) {
    if (s.phase === 'hunter') turn = s.hunters[0] ?? null;
    else if (s.phase === 'heir') turn = s.heirFrom;
    else if (s.phase === 'vote' || s.phase === 'election') turn = voters(s);
    else turn = alive(s);
  }
  return {
    turn,
    ...(!over && secret ? { may: alive(s) } : {}),
    over,
    winners: over ? s.winner.ids : [],
    deadline: over ? null : s.deadline,
    silent: over ? [] : s.dead.map((d) => d.id), // les morts voient tous les rôles : ils n'écrivent plus aux vivants
  };
}
