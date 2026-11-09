// Yams : les règles du jeu de dés. Pures : ni réseau, ni base, ni affichage.
// Chacun son tour : jusqu'à 3 lancers de 5 dés (on garde ceux qu'on veut), puis on inscrit dans une case de sa feuille.
// 13 cases, 13 tours. Les lancers se font ici, avec ctx.random(). L'heure vient de ctx.now.

export const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const LOWER = ['brelan', 'carre', 'full', 'petite', 'grande', 'yams', 'chance'];
export const BOXES = [...UPPER, ...LOWER];
export const BONUS_THRESHOLD = 63;
export const BONUS_POINTS = 35;
export const EXTRA_YAMS_POINTS = 100;
export const MAX_ROLLS = 3;

const FACE_OF = Object.fromEntries(UPPER.map((b, i) => [b, i + 1]));
const FIXED = { full: 25, petite: 30, grande: 40, yams: 50 };
const LABEL = {
  ones: 'les 1', twos: 'les 2', threes: 'les 3', fours: 'les 4', fives: 'les 5', sixes: 'les 6',
  brelan: 'le brelan', carre: 'le carré', full: 'le full', petite: 'la petite suite', grande: 'la grande suite', yams: 'le Yams', chance: 'la chance',
};
// Quand le temps est écoulé et que tout rapporte 0 : on sacrifie la case la moins utile en premier.
const SACRIFICE = ['ones', 'yams', 'twos', 'grande', 'carre', 'petite', 'threes', 'full', 'brelan', 'fours', 'fives', 'sixes', 'chance'];
// À points égaux, la case la plus difficile à remplir passe devant.
const PREFER = ['yams', 'grande', 'petite', 'full', 'carre', 'brelan', 'sixes', 'fives', 'fours', 'threes', 'twos', 'ones', 'chance'];

const rollDie = (ctx) => 1 + Math.min(5, Math.floor(ctx.random() * 6));
const sum = (dice) => dice.reduce((a, b) => a + b, 0);

// ——— Calcul des points ———

function tally(dice) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d] += 1;
  return c;
}

export const isYams = (dice) => dice.length === 5 && dice.every((d) => d === dice[0]);

function hasRun(dice, length) {
  const c = tally(dice);
  let run = 0;
  for (let v = 1; v <= 6; v += 1) {
    run = c[v] > 0 ? run + 1 : 0;
    if (run >= length) return true;
  }
  return false;
}

// Points d'une case pour ces dés, sans règle de Yams supplémentaire.
export function scoreBox(box, dice) {
  const c = tally(dice);
  const max = Math.max(...c);
  if (box in FACE_OF) return FACE_OF[box] * c[FACE_OF[box]];
  switch (box) {
    case 'brelan': return max >= 3 ? sum(dice) : 0;
    case 'carre': return max >= 4 ? sum(dice) : 0;
    case 'full': return c.includes(3) && c.includes(2) ? FIXED.full : 0;
    case 'petite': return hasRun(dice, 4) ? FIXED.petite : 0;
    case 'grande': return hasRun(dice, 5) ? FIXED.grande : 0;
    case 'yams': return isYams(dice) ? FIXED.yams : 0;
    case 'chance': return sum(dice);
    default: throw new Error('Case inconnue.');
  }
}

// Avec la règle du Yams supplémentaire, un Yams est un joker : full et suites comptent leurs points entiers.
function scoreJoker(box, dice) {
  return box in FIXED && box !== 'yams' ? FIXED[box] : scoreBox(box, dice);
}

export const emptySheet = () => ({ boxes: Object.fromEntries(BOXES.map((b) => [b, null])), extraYams: 0 });

export function totalsOf(sheet) {
  const upper = UPPER.reduce((n, b) => n + (sheet.boxes[b] ?? 0), 0);
  const bonus = upper >= BONUS_THRESHOLD ? BONUS_POINTS : 0;
  const lower = LOWER.reduce((n, b) => n + (sheet.boxes[b] ?? 0), 0);
  const extra = sheet.extraYams * EXTRA_YAMS_POINTS;
  return { upper, bonus, lower, extra, total: upper + bonus + lower + extra };
}

const isFull = (sheet) => BOXES.every((b) => sheet.boxes[b] !== null);
const openBoxes = (sheet) => BOXES.filter((b) => sheet.boxes[b] === null);

// Un 2e Yams (ou plus) avec la règle activée : la case du Yams est déjà prise, le joker s'applique.
const jokerApplies = (sheet, dice, options) => options.extraYams && isYams(dice) && sheet.boxes.yams !== null;

// Les cases où l'on peut inscrire ces dés. Joker : la case du chiffre d'abord, sinon une case du bas, sinon une case du haut.
export function allowedBoxes(sheet, dice, options) {
  const open = openBoxes(sheet);
  if (!jokerApplies(sheet, dice, options)) return open;
  const same = UPPER[dice[0] - 1];
  if (open.includes(same)) return [same];
  const lower = open.filter((b) => LOWER.includes(b));
  return lower.length ? lower : open;
}

// Points de chaque case permise pour ces dés : { box: points }.
export function preview(sheet, dice, options) {
  if (!dice.length) return {};
  const joker = jokerApplies(sheet, dice, options);
  return Object.fromEntries(allowedBoxes(sheet, dice, options).map((b) => [b, joker ? scoreJoker(b, dice) : scoreBox(b, dice)]));
}

// ——— Cycle de la partie ———

const deadlineFor = (s, ctx) => (s.options.turnTime > 0 ? ctx.now + s.options.turnTime * 1000 : null);
const activeOf = (s) => s.players.filter((id) => !s.left.includes(id));

// Le joueur suivant (qui n'est pas parti), après `id` dans l'ordre des places.
function nextActive(s, id) {
  const n = s.players.length;
  const from = s.players.indexOf(id);
  for (let k = 1; k <= n; k += 1) {
    const cand = s.players[(from + k) % n];
    if (!s.left.includes(cand)) return cand;
  }
  return null;
}

function beginTurn(s, id, ctx) {
  const next = { ...s, turn: id, dice: [], rolls: 0, rerolled: [] };
  return { ...next, deadline: deadlineFor(next, ctx) };
}

function finish(s, winnersPool) {
  const scored = winnersPool.map((id) => [id, totalsOf(s.sheets[id]).total]);
  const best = Math.max(...scored.map(([, t]) => t));
  return { ...s, over: true, turn: null, deadline: null, winners: scored.filter(([, t]) => t === best).map(([id]) => id) };
}

// players : [{ id, pseudo }] dans l'ordre des places ; le premier commence.
export function setup(players, options, ctx) {
  if (players.length < 1) throw new Error('Il faut au moins 1 joueur.');
  if (players.length > 6) throw new Error('Le Yams se joue à 6 joueurs au maximum.');
  const ids = players.map((p) => p.id);
  const s = {
    players: ids,
    options: { turnTime: Number(options?.turnTime) || 0, extraYams: Boolean(options?.extraYams) },
    sheets: Object.fromEntries(ids.map((id) => [id, emptySheet()])),
    left: [],
    turn: null,
    dice: [],
    rolls: 0,
    rerolled: [],
    last: null, // dernière inscription : { id, box, points, extra }
    over: false,
    winners: [],
    deadline: null,
  };
  return beginTurn(s, ids[0], ctx);
}

function doRoll(s, keep, ctx) {
  const dice = s.rolls === 0 ? [0, 0, 0, 0, 0] : s.dice.slice();
  const kept = s.rolls === 0 ? [] : keep;
  const rerolled = [];
  for (let i = 0; i < 5; i += 1) {
    if (!kept.includes(i)) {
      dice[i] = rollDie(ctx);
      rerolled.push(i);
    }
  }
  return { ...s, dice, rolls: s.rolls + 1, rerolled };
}

function doScore(s, id, box, ctx) {
  const sheet = s.sheets[id];
  const joker = jokerApplies(sheet, s.dice, s.options);
  const points = joker ? scoreJoker(box, s.dice) : scoreBox(box, s.dice);
  const extra = joker && sheet.boxes.yams === FIXED.yams; // un 2e Yams gagné après un Yams à 50 : +100
  const nextSheet = { boxes: { ...sheet.boxes, [box]: points }, extraYams: sheet.extraYams + (extra ? 1 : 0) };
  const done = { ...s, sheets: { ...s.sheets, [id]: nextSheet }, last: { id, box, points, extra, auto: false } };
  const active = activeOf(done);
  if (active.every((p) => isFull(done.sheets[p]))) return finish(done, active);
  return beginTurn(done, nextActive(done, id), ctx);
}

// Actions : { type: 'roll', keep: [indices des dés gardés] } | { type: 'score', box }
export function move(state, playerId, action, ctx) {
  if (state.over) throw new Error('La partie est terminée.');
  if (state.turn !== playerId) throw new Error("Ce n’est pas ton tour.");
  const type = action?.type;

  if (type === 'roll') {
    if (state.rolls >= MAX_ROLLS) throw new Error('Tu as déjà lancé 3 fois : choisis une case pour inscrire tes points.');
    let keep = [];
    if (state.rolls > 0) {
      const raw = Array.isArray(action.keep) ? action.keep : [];
      keep = [...new Set(raw.map(Number))];
      if (keep.some((i) => !Number.isInteger(i) || i < 0 || i > 4)) throw new Error('Dé inconnu.');
      if (keep.length === 5) throw new Error('Tu gardes les 5 dés : relâches-en au moins un pour relancer, ou choisis une case.');
    }
    return { state: doRoll(state, keep, ctx), events: [{ type: 'roll' }] };
  }

  if (type === 'score') {
    const box = action.box;
    if (!BOXES.includes(box)) throw new Error('Case inconnue.');
    if (state.rolls === 0) throw new Error('Lance les dés avant d’inscrire des points.');
    const sheet = state.sheets[playerId];
    if (sheet.boxes[box] !== null) throw new Error('Cette case est déjà remplie.');
    if (!allowedBoxes(sheet, state.dice, state.options).includes(box)) {
      const same = UPPER[state.dice[0] - 1];
      throw new Error(sheet.boxes[same] === null
        ? `Avec un Yams en plus, tu dois remplir ${LABEL[same]}.`
        : 'Avec un Yams en plus, tu dois remplir une case du bas de la feuille tant qu’il en reste une.');
    }
    return { state: doScore(state, playerId, box, ctx), events: [{ type: 'score', box }] };
  }
  throw new Error('Action inconnue.');
}

// Temps écoulé : on lance une fois si ce n'est pas fait, puis on inscrit dans la case qui rapporte le plus.
export function timeout(state, ctx) {
  if (state.over || state.turn === null) return { state };
  let s = state.rolls === 0 ? doRoll(state, [], ctx) : state;
  const sheet = s.sheets[s.turn];
  const options = preview(sheet, s.dice, s.options);
  const boxes = Object.keys(options);
  const best = Math.max(...boxes.map((b) => options[b]));
  const pool = best > 0 ? boxes.filter((b) => options[b] === best) : boxes;
  const order = best > 0 ? PREFER : SACRIFICE;
  const box = order.find((b) => pool.includes(b));
  s = doScore(s, s.turn, box, ctx);
  return { state: { ...s, last: { ...s.last, auto: true } }, events: [{ type: 'score', box, auto: true }] };
}

// Qui quitte sort de la partie ; les autres continuent. S'il ne reste qu'un joueur d'une partie à plusieurs, il gagne.
export function leave(state, playerId, ctx) {
  if (state.over || state.left.includes(playerId)) return { state };
  const s = { ...state, left: [...state.left, playerId] };
  const active = activeOf(s);
  if (active.length === 0) return { state: { ...s, over: true, turn: null, deadline: null, winners: [] } };
  if (active.length === 1 && s.players.length > 1) return { state: finish(s, active) };
  if (s.turn !== playerId) return { state: s };
  return { state: beginTurn(s, nextActive(s, playerId), ctx) };
}

// ——— Ce que voit chaque personne : tout est public (les dés, les feuilles), sauf les points possibles, propres au joueur actif ———

export function view(state, playerId) {
  const mine = playerId !== null && playerId === state.turn && !state.over;
  const sheet = state.turn !== null ? state.sheets[state.turn] : null;
  return {
    players: state.players,
    left: state.left,
    options: state.options,
    sheets: state.sheets,
    totals: Object.fromEntries(state.players.map((id) => [id, totalsOf(state.sheets[id])])),
    turn: state.turn,
    round: sheet ? BOXES.length - openBoxes(sheet).length + 1 : BOXES.length,
    dice: state.dice,
    rolls: state.rolls,
    rerolled: state.rerolled,
    preview: mine && state.rolls > 0 ? preview(sheet, state.dice, state.options) : null,
    last: state.last,
    over: state.over,
    winners: state.winners,
    deadline: state.deadline,
  };
}

export function status(state) {
  return { turn: state.over ? null : state.turn, over: state.over, winners: state.winners, deadline: state.deadline };
}
