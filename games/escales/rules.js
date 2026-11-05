// Escales : on achète des villes, on y construit, on fait payer le passage. Les règles sont pures : ni réseau, ni base, ni affichage.
// L'heure vient de ctx.now, le hasard de ctx.random. Tout le raisonnement est expliqué dans docs/escales.md.
//
// Un tour : « roll » (lancer) → la case décide de la suite (buy, debt) → « end » → joueur suivant.
import { REGIONS, TILES, COUNTRIES, DEFAULT_MAP, MAP_SIZE, isCountry, minCountries, nameOn, LEVEL_MULT, MAX_LEVEL, ESCALE_RENTS, CUSTOMS_POS, SIZE, mortgageValue, unmortgageCost } from './client/board.js';

export const SALARY = 200;
export const FINE = 50; // pour sortir de la Douane
export const FESTIVAL_GAIN = 100; // en tombant sur le Festival
export const WORKS_FEE = 50; // en tombant sur un Chantier
export const MAX_TRADES = 3; // propositions en attente par joueur
export const BOT_MS = 900; // le temps qu'un robot prend pour jouer, pour qu'on voie ce qu'il fait
const BOT_NAMES = ['Marco', 'Aïko', 'Leïla', 'Nuno', 'Frida', 'Anh', 'Giulia', 'Sam', 'Noor', 'Paco'];

const clone = (s) => structuredClone(s);
const d6 = (ctx) => 1 + Math.floor(ctx.random() * 6);
const money = (n) => `${n.toLocaleString('fr-FR')} €`;

const cur = (s) => s.players[s.cur];
const byId = (s, id) => s.players.find((p) => p.id === id);
const active = (s) => s.players.filter((p) => !p.out);

function log(s, text) {
  s.logN += 1;
  s.log.push({ n: s.logN, text });
  if (s.log.length > 40) s.log.shift();
}

function shuffle(list, ctx) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(ctx.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ——— Ce que valent les choses ———

const ownedInRegion = (s, id, region) => TILES.filter((t) => t.region === region && s.props[t.pos]?.owner === id).length;
const escalesOf = (s, id) => TILES.filter((t) => t.type === 'escale' && s.props[t.pos]?.owner === id).length;

// Le loyer dû en tombant sur cette case, tout compris (villes du pays, niveau).
export function rentOf(s, pos) {
  const t = TILES[pos];
  const prop = s.props[pos];
  if (!prop || prop.mortgaged) return 0;
  if (t.type === 'escale') return ESCALE_RENTS[escalesOf(s, prop.owner)];
  const count = ownedInRegion(s, prop.owner, t.region);
  let rent = t.rent * LEVEL_MULT[prop.level];
  if (prop.level === 0) rent *= count === 4 ? 3 : count >= s.majority ? 2 : 1;
  else if (count === 4) rent *= 1.25;
  return Math.round(rent);
}

export function buildCost(s, pos) {
  return TILES[pos].build;
}

export function worthOf(s, p) {
  let total = p.cash;
  for (const [pos, prop] of Object.entries(s.props)) {
    if (prop.owner !== p.id) continue;
    const t = TILES[pos];
    total += prop.mortgaged ? Math.floor(t.price / 2) : t.price;
    total += prop.level * (t.build || 0);
  }
  return total;
}

function canBuildAt(s, id, pos) {
  const t = TILES[pos];
  const prop = s.props[pos];
  return t?.type === 'city' && prop?.owner === id && !prop.mortgaged && prop.level < MAX_LEVEL && ownedInRegion(s, id, t.region) >= s.majority;
}

const positionsOf = (s, id) => Object.keys(s.props).map(Number).filter((pos) => s.props[pos].owner === id);

function canManage(s, p) {
  return positionsOf(s, p.id).some((pos) => (canBuildAt(s, p.id, pos) && p.cash >= buildCost(s, pos))
    || (s.props[pos].mortgaged && p.cash >= unmortgageCost(TILES[pos])));
}

// ——— Mise en place ———

// options : cash (argent de départ), rounds (tours avant le décompte, 0 = jusqu'au dernier), timer (secondes par action, 0 = sans),
// bots (robots à ajouter). Seul à la table, 3 robots s'ajoutent d'office : on peut toujours jouer.
// Les pays de la partie : ceux choisis dans le salon, et le hasard pour les places restantes. Sans choix, les 8 de départ.
function chooseMap(options, ctx) {
  if (!Array.isArray(options.countries)) return [...DEFAULT_MAP];
  const chosen = [...new Set(options.countries.filter(isCountry))].slice(0, MAP_SIZE);
  const rest = shuffle(COUNTRIES.map((c) => c.id).filter((id) => !chosen.includes(id)), ctx);
  return shuffle([...chosen, ...rest.slice(0, MAP_SIZE - chosen.length)], ctx);
}

// Avant de lancer : assez de pays pour le nombre de joueurs.
export function checkStart(players, options = {}) {
  if (!Array.isArray(options.countries)) return null;
  const wanted = Math.max(0, Math.floor(Number(options.bots) || 0));
  const total = Math.min(10, players.length + (wanted || (players.length === 1 ? 3 : 0)));
  const need = minCountries(total);
  return options.countries.length >= need ? null : `Choisis au moins ${need} pays pour ${total} joueurs (il en manque ${need - options.countries.length}).`;
}

export function setup(players, options = {}, ctx) {
  const wanted = Math.max(0, Math.floor(Number(options.bots) || 0));
  const count = Math.min(wanted || (players.length === 1 ? 3 : 0), 10 - players.length);
  const taken = new Set(players.map((p) => p.pseudo.toLowerCase())); // un robot ne porte jamais le nom d'un joueur de la table
  const bots = shuffle(BOT_NAMES.filter((n) => !taken.has(n.toLowerCase())), ctx).slice(0, count).map((pseudo, i) => ({ id: -(i + 1), pseudo, bot: true }));
  const everyone = [...players, ...bots];
  const map = chooseMap(options, ctx);
  const s = {
    map,
    players: shuffle(everyone, ctx).map((p, seat) => ({
      id: p.id, pseudo: p.pseudo, bot: Boolean(p.bot), seat, cash: Number(options.cash) || 1500, pos: 0, out: false, blocked: 0, doubles: 0,
    })),
    cur: 0,
    phase: 'roll',
    props: {}, // position -> { owner, level, mortgaged }
    round: 1,
    majority: everyone.length <= 3 ? 2 : 3, // villes d'une région à posséder pour y construire
    maxRounds: Number(options.rounds ?? 20) || 0,
    timer: Number(options.timer ?? 60) || 0,
    dice: null,
    rollN: 0,
    again: false,
    after: null,
    debt: null,
    trades: [],
    tradeSeq: 0,
    deck: [],
    log: [],
    logN: 0,
    over: false,
    winners: [],
    reason: null,
    deadline: null,
    armedFor: null,
  };
  log(s, `Partie lancée. ${cur(s).pseudo} commence.`);
  return arm(s, ctx);
}

// Le minuteur repart à chaque nouvelle action attendue, mais pas pour un échange pendant le tour d'un autre.
function arm(s, ctx) {
  if (s.over) {
    s.deadline = null;
    return s;
  }
  const key = `${s.phase}:${s.cur}:${s.rollN}`;
  if (key === s.armedFor) return s;
  s.armedFor = key;
  if (cur(s).bot) s.deadline = ctx.now + BOT_MS; // un robot joue tout seul, une action à la fois
  else s.deadline = s.timer ? ctx.now + s.timer * 1000 : null;
  return s;
}

// ——— Enchaînement du tour ———

function settle(s, ctx) {
  const p = cur(s);
  if (p.out) return nextTurn(s, ctx);
  if (s.again && !p.blocked) {
    s.phase = 'roll';
    return undefined;
  }
  s.again = false;
  if (canManage(s, p)) s.phase = 'end';
  else nextTurn(s, ctx);
  return undefined;
}

function resume(s, after, ctx) {
  s.after = null;
  if (after?.move) return advance(s, after.move, ctx);
  return settle(s, ctx);
}

function nextTurn(s, ctx) {
  if (s.over) return;
  s.again = false;
  const from = s.cur;
  let i = from;
  do {
    i = (i + 1) % s.players.length;
  } while (s.players[i].out && i !== from);
  if (i <= from) {
    s.round += 1;
    if (s.maxRounds && s.round > s.maxRounds) {
      finish(s, 'rounds');
      return;
    }
  }
  s.cur = i;
  const p = cur(s);
  p.doubles = 0;
  s.phase = 'roll';
}

function finish(s, reason) {
  s.over = true;
  s.phase = 'over';
  s.reason = reason;
  s.trades = [];
  s.debt = null;
  s.after = null;
  const left = active(s);
  const best = Math.max(...left.map((p) => worthOf(s, p)));
  s.winners = left.filter((p) => worthOf(s, p) === best).map((p) => p.id);
  const names = s.winners.map((id) => byId(s, id).pseudo).join(' et ');
  log(s, reason === 'last' ? `${names} est le dernier en jeu.` : `${reason === 'rounds' ? 'Fin des tours' : 'Plus aucun humain en jeu'} : ${names} a le plus gros patrimoine (${money(best)}).`);
}

// Le joueur quitte la partie. to : id du créancier, ou null pour la banque.
function eliminate(s, p, to) {
  const creditor = to ? byId(s, to) : null;
  const heir = creditor && !creditor.out ? creditor : null;
  let liquidated = 0;
  for (const pos of positionsOf(s, p.id)) {
    const prop = s.props[pos];
    liquidated += Math.floor((prop.level * (TILES[pos].build || 0)) / 2);
    if (heir) s.props[pos] = { owner: heir.id, level: 0, mortgaged: prop.mortgaged };
    else delete s.props[pos];
  }
  if (heir) heir.cash += p.cash + liquidated;
  p.cash = 0;
  p.out = true;
  p.blocked = 0;
  s.trades = s.trades.filter((t) => t.from !== p.id && t.to !== p.id);
  if (active(s).length <= 1) finish(s, 'last');
  else if (!active(s).some((o) => !o.bot)) finish(s, 'humans'); // les robots ne continuent pas sans personne
}

// ——— Se déplacer et tomber sur une case ———

function collect(s, p) {
  p.cash += SALARY;
  log(s, `${p.pseudo} passe au Départ : +${money(SALARY)}.`);
}

function advance(s, steps, ctx) {
  const p = cur(s);
  const to = p.pos + steps;
  if (to >= SIZE) collect(s, p);
  p.pos = to % SIZE;
  return land(s, ctx);
}

function goForwardTo(s, pos, ctx) {
  const p = cur(s);
  return advance(s, ((pos - p.pos + SIZE) % SIZE) || SIZE, ctx);
}

function sendToCustoms(s, ctx) {
  const p = cur(s);
  p.pos = CUSTOMS_POS;
  p.blocked = 1;
  p.doubles = 0;
  s.again = false;
  log(s, `${p.pseudo} est retenu à la Douane.`);
  return settle(s, ctx);
}

// Le joueur en cours doit payer. S'il n'a pas assez, il passe en « debt » et la suite attend.
function charge(s, amount, to, why, ctx, after = null) {
  const p = cur(s);
  if (p.cash >= amount) {
    p.cash -= amount;
    if (to) byId(s, to).cash += amount;
    log(s, `${p.pseudo} paie ${money(amount)} ${why}.`);
    return resume(s, after, ctx);
  }
  s.debt = { amount, to, why };
  s.after = after;
  s.phase = 'debt';
  log(s, `${p.pseudo} doit trouver ${money(amount)} ${why}.`);
  return undefined;
}

function land(s, ctx) {
  const p = cur(s);
  const t = TILES[p.pos];
  switch (t.type) {
    case 'city':
    case 'escale': {
      const prop = s.props[p.pos];
      if (!prop) {
        s.phase = 'buy';
        return undefined;
      }
      if (prop.owner === p.id || prop.mortgaged) return settle(s, ctx);
      return charge(s, rentOf(s, p.pos), prop.owner, `à ${byId(s, prop.owner).pseudo} (${nameOn(s.map, t.pos)})`, ctx);
    }
    case 'telex':
      return drawCard(s, ctx);
    case 'tax': {
      const amount = t.tax === 'percent' ? Math.max(50, Math.floor(p.cash / 10)) : t.amount;
      return charge(s, amount, null, `(${nameOn(s.map, t.pos)})`, ctx);
    }
    case 'chantier':
      return charge(s, WORKS_FEE, null, '(Chantier)', ctx);
    case 'festival':
      p.cash += FESTIVAL_GAIN;
      log(s, `${p.pseudo} gagne ${money(FESTIVAL_GAIN)} au Festival.`);
      return settle(s, ctx);
    case 'control':
      return sendToCustoms(s, ctx);
    default:
      return settle(s, ctx); // Départ, Douane en visite
  }
}

// ——— Le Télex ———

const CARDS = [
  { text: 'Surclassement : file à la prochaine escale.', play: (s, ctx) => goForwardTo(s, TILES.find((t) => t.type === 'escale' && t.pos > cur(s).pos)?.pos ?? 6, ctx) },
  { text: 'Billet retour : retour au Départ.', play: (s, ctx) => goForwardTo(s, 0, ctx) },
  { text: 'Tes bagages sont perdus : paie 50 €.', play: (s, ctx) => charge(s, 50, null, '(bagages perdus)', ctx) },
  { text: 'Tu revends ton carnet de voyage : +100 €.', play: (s, ctx) => gain(s, 100, ctx) },
  { text: 'Tu vends tes photos de voyage : +50 €.', play: (s, ctx) => gain(s, 50, ctx) },
  { text: 'Contrôle surprise : direction la Douane.', play: (s, ctx) => sendToCustoms(s, ctx) },
  { text: 'Ta photo gagne un concours : +150 €.', play: (s, ctx) => gain(s, 150, ctx) },
  { text: 'Amende de stationnement : paie 40 €.', play: (s, ctx) => charge(s, 40, null, '(amende)', ctx) },
  { text: 'Mauvaise route : recule de 3 cases.', play: (s, ctx) => { const p = cur(s); p.pos = (p.pos - 3 + SIZE) % SIZE; return land(s, ctx); } },
  { text: 'Travaux de voirie : paie 25 € par niveau construit.', play: (s, ctx) => {
    const levels = positionsOf(s, cur(s).id).reduce((sum, pos) => sum + s.props[pos].level, 0);
    return levels ? charge(s, levels * 25, null, '(travaux de voirie)', ctx) : settle(s, ctx);
  } },
  { text: 'Une tante globe-trotteuse te lègue 200 €.', play: (s, ctx) => gain(s, 200, ctx) },
  { text: 'Mauvais taux de change : perds 10 % de ton argent.', play: (s, ctx) => {
    const amount = Math.floor(cur(s).cash / 10);
    return amount ? charge(s, amount, null, '(taux de change)', ctx) : settle(s, ctx);
  } },
  { text: 'Coup de cœur : file à la prochaine ville libre.', play: (s, ctx) => {
    const from = cur(s).pos;
    for (let i = 1; i < SIZE; i += 1) {
      const t = TILES[(from + i) % SIZE];
      if (t.type === 'city' && !s.props[t.pos]) return goForwardTo(s, t.pos, ctx);
    }
    return settle(s, ctx);
  } },
  { text: 'Prime de fidélité : +50 € par escale que tu possèdes.', play: (s, ctx) => {
    const n = escalesOf(s, cur(s).id);
    return n ? gain(s, n * 50, ctx) : settle(s, ctx);
  } },
];

function gain(s, amount, ctx) {
  cur(s).cash += amount;
  return settle(s, ctx);
}

function drawCard(s, ctx) {
  if (!s.deck.length) s.deck = shuffle(CARDS.map((_, i) => i), ctx);
  const card = CARDS[s.deck.pop()];
  log(s, `Télex pour ${cur(s).pseudo} : ${card.text}`);
  return card.play(s, ctx);
}

// ——— Le lancer ———

function doRoll(s, ctx) {
  const p = cur(s);
  const a = d6(ctx);
  const b = d6(ctx);
  s.dice = [a, b];
  s.rollN += 1;
  log(s, `${p.pseudo} lance ${a} et ${b}.`);
  if (p.blocked) {
    if (a === b) {
      p.blocked = 0;
      s.again = false;
      log(s, `Un double : ${p.pseudo} passe la Douane.`);
      return advance(s, a + b, ctx);
    }
    p.blocked += 1;
    if (p.blocked > 3) {
      p.blocked = 0;
      s.again = false;
      return charge(s, FINE, null, 'pour sortir de la Douane', ctx, { move: a + b });
    }
    s.again = false;
    return settle(s, ctx);
  }
  if (a === b) {
    p.doubles += 1;
    if (p.doubles >= 3) return sendToCustoms(s, ctx);
    s.again = true;
  } else {
    s.again = false;
  }
  return advance(s, a + b, ctx);
}

function liquidate(s, p, needed) {
  const owned = positionsOf(s, p.id);
  for (const pos of owned) {
    while (s.props[pos].level > 0 && p.cash < needed) {
      s.props[pos].level -= 1;
      p.cash += Math.floor(TILES[pos].build / 2);
    }
  }
  // Au plus juste : la plus petite ville qui suffit, sinon la plus grosse, et on recommence. Jamais une ville en gage de trop.
  while (p.cash < needed) {
    const free = owned.filter((pos) => !s.props[pos].mortgaged && s.props[pos].level === 0);
    if (!free.length) break;
    const missing = needed - p.cash;
    const byValue = free.sort((a, b) => mortgageValue(TILES[a]) - mortgageValue(TILES[b]));
    const pos = byValue.find((x) => mortgageValue(TILES[x]) >= missing) ?? byValue.at(-1);
    s.props[pos].mortgaged = true;
    p.cash += mortgageValue(TILES[pos]);
  }
}

// Ce que « Réunir l'argent » va vendre ou mettre en gage : le joueur le voit avant de décider.
function debtPlan(state, me) {
  const copy = JSON.parse(JSON.stringify(state));
  liquidate(copy, byId(copy, me.id), state.debt.amount);
  return positionsOf(state, me.id).map((pos) => ({ pos, levels: state.props[pos].level - copy.props[pos].level, mortgage: copy.props[pos].mortgaged && !state.props[pos].mortgaged })).filter((x) => x.levels || x.mortgage);
}

function settleDebt(s, ctx) {
  const p = cur(s);
  const { amount, to, why } = s.debt;
  p.cash -= amount;
  if (to) byId(s, to).cash += amount;
  log(s, `${p.pseudo} paie ${money(amount)} ${why}.`);
  s.debt = null;
  const after = s.after;
  return resume(s, after, ctx);
}

function goBankrupt(s, ctx) {
  const p = cur(s);
  const to = s.debt?.to ?? null;
  s.debt = null;
  s.after = null;
  log(s, `${p.pseudo} fait faillite.`);
  eliminate(s, p, to);
  if (!s.over) nextTurn(s, ctx);
}

// ——— Les robots ———
// Ils jouent simplement : ils achètent s'il leur reste de quoi, cherchent la majorité d'une région et construisent.

const gainsMajority = (s, p, t) => t.type === 'city' && ownedInRegion(s, p.id, t.region) + 1 >= s.majority;

// Ce que vaut une proposition pour celui qui la reçoit : les villes qui lui donnent une majorité comptent plus.
function offerValue(s, to, offer) {
  return offer.cash + offer.cities.reduce((sum, pos) => sum + TILES[pos].price * (gainsMajority(s, to, TILES[pos]) ? 1.6 : 1), 0);
}
function botAccepts(s, bot, trade) {
  const give = trade.get;
  const lost = give.cities.reduce((sum, pos) => {
    const t = TILES[pos];
    const breaks = t.type === 'city' && ownedInRegion(s, bot.id, t.region) >= s.majority;
    return sum + t.price * (breaks ? 2.5 : 1);
  }, 0);
  return offerValue(s, bot, trade.give) >= (give.cash + lost) * 1.15 && bot.cash - give.cash >= 50;
}

// Un robot à qui il manque une ville pour sa majorité essaie de la racheter : à un autre robot, ou en proposant à un joueur.
function botTrade(s, p, ctx) {
  const urge = ctx.random();
  if (urge > 0.7) return false;
  for (let r = 0; r < REGIONS.length; r += 1) {
    if (ownedInRegion(s, p.id, r) !== s.majority - 1) continue;
    const t = TILES.find((x) => x.region === r && s.props[x.pos] && s.props[x.pos].owner !== p.id && !s.props[x.pos].level);
    if (!t) continue;
    const offer = Math.floor(t.price * 1.7 / 5) * 5;
    const owner = byId(s, s.props[t.pos].owner);
    if (p.cash < offer + 150) continue;
    if (!owner.bot && urge > 0.35) continue; // un joueur n'est pas sollicité à chaque tour
    const trade = { from: p.id, to: owner.id, give: { cash: offer, cities: [] }, get: { cash: 0, cities: [t.pos] } };
    if (owner.bot) {
      if (ownedInRegion(s, owner.id, r) >= s.majority || !botAccepts(s, owner, trade)) continue;
      transfer(s, p, owner, trade.give);
      transfer(s, owner, p, trade.get);
      log(s, `${p.pseudo} rachète ${nameOn(s.map, t.pos)} à ${owner.pseudo} pour ${money(offer)}.`);
      return true;
    }
    if (s.trades.some((x) => x.from === p.id || (x.get.cities[0] === t.pos && x.to === owner.id))) continue;
    s.tradeSeq += 1;
    s.trades.push({ id: s.tradeSeq, ...trade });
    log(s, `${p.pseudo} propose un échange à ${owner.pseudo}.`);
    return true;
  }
  return false;
}

function botManage(s, p) {
  const owned = positionsOf(s, p.id);
  const again = owned.find((pos) => s.props[pos].mortgaged && p.cash >= unmortgageCost(TILES[pos]) + 400);
  if (again !== undefined) {
    p.cash -= unmortgageCost(TILES[again]);
    s.props[again].mortgaged = false;
    log(s, `${p.pseudo} récupère ${nameOn(s.map, again)}.`);
    return true;
  }
  const spot = owned.filter((pos) => canBuildAt(s, p.id, pos) && p.cash >= buildCost(s, pos) + 150).sort((a, b) => s.props[b].level - s.props[a].level)[0];
  if (spot === undefined) return false;
  p.cash -= buildCost(s, spot);
  s.props[spot].level += 1;
  log(s, `${p.pseudo} construit à ${nameOn(s.map, spot)}.`);
  return true;
}

function botStep(s, ctx) {
  const p = cur(s);
  const t = TILES[p.pos];
  switch (s.phase) {
    case 'roll':
      if (p.blocked && p.cash > 300) {
        p.cash -= FINE;
        p.blocked = 0;
        log(s, `${p.pseudo} paie ${money(FINE)} et passe la Douane.`);
        return;
      }
      if (botTrade(s, p, ctx) || botManage(s, p)) return;
      doRoll(s, ctx);
      return;
    case 'buy':
      if (p.cash >= t.price + 60) {
        p.cash -= t.price;
        s.props[p.pos] = { owner: p.id, level: 0, mortgaged: false };
        log(s, `${p.pseudo} achète ${nameOn(s.map, t.pos)} pour ${money(t.price)}.`);
      } else {
        log(s, `${p.pseudo} laisse ${nameOn(s.map, t.pos)}.`);
      }
      settle(s, ctx);
      return;
    case 'end':
      if (!botManage(s, p)) nextTurn(s, ctx);
      return;
    case 'debt':
      liquidate(s, p, s.debt.amount);
      if (p.cash >= s.debt.amount) settleDebt(s, ctx);
      else goBankrupt(s, ctx);
      return;
    default:
  }
}

// ——— Échanges ———

function cleanOffer(given) {
  const o = given ?? {};
  if (Number(o.cash) < 0) throw new Error('Un montant ne peut pas être négatif.');
  return {
    cash: Math.max(0, Math.floor(Number(o.cash) || 0)),
    cities: [...new Set((Array.isArray(o.cities) ? o.cities : []).map(Number))].filter((n) => Number.isInteger(n) && TILES[n]),
  };
}

function checkOffer(s, p, offer, actorId) {
  const mine = p.id === actorId;
  if (p.cash < offer.cash) throw new Error(mine ? `Tu n'as pas ${money(offer.cash)}.` : `${p.pseudo} n'a pas ${money(offer.cash)}.`);
  for (const pos of offer.cities) {
    const prop = s.props[pos];
    if (prop?.owner !== p.id) throw new Error(`${nameOn(s.map, pos)} n'appartient pas à ${p.pseudo}.`);
    if (prop.level > 0) throw new Error(`${nameOn(s.map, pos)} a des constructions : il faut les vendre avant.`);
  }
}

function transfer(s, from, to, offer) {
  from.cash -= offer.cash;
  to.cash += offer.cash;
  for (const pos of offer.cities) {
    s.props[pos].owner = to.id;
  }
}

// ——— Les coups ———

const TURN_ONLY = new Set(['roll', 'payFine', 'buy', 'decline', 'endTurn', 'pay', 'raise', 'bankrupt', 'build', 'sell', 'mortgage', 'unmortgage']);
const MANAGE_PHASES = new Set(['roll', 'buy', 'end']);

function needPhase(s, ...phases) {
  if (!phases.includes(s.phase)) throw new Error('Ce n’est pas le moment.');
}

function ownedProp(s, id, pos) {
  const prop = s.props[pos];
  if (!TILES[pos] || prop?.owner !== id) throw new Error('Cette ville ne t’appartient pas.');
  return prop;
}

export function move(state, playerId, given, ctx) {
  const action = given ?? {};
  if (state.over) throw new Error('La partie est terminée.');
  const s = clone(state);
  const p = byId(s, playerId);
  if (!p || p.out) throw new Error('Tu n’es plus dans cette partie.');
  const { type } = action;
  const pos = Number(action.pos);
  if (TURN_ONLY.has(type) && cur(s).id !== playerId) throw new Error('Ce n’est pas ton tour.');

  switch (type) {
    case 'roll':
      needPhase(s, 'roll');
      doRoll(s, ctx);
      break;
    case 'payFine':
      needPhase(s, 'roll');
      if (!p.blocked) throw new Error('Tu n’es pas retenu à la Douane.');
      if (p.cash < FINE) throw new Error(`Il te faut ${money(FINE)}.`);
      p.cash -= FINE;
      p.blocked = 0;
      log(s, `${p.pseudo} paie ${money(FINE)} et passe la Douane.`);
      break;
    case 'buy': {
      needPhase(s, 'buy');
      const t = TILES[p.pos];
      if (p.cash < t.price) throw new Error(`Il te manque ${money(t.price - p.cash)}.`);
      p.cash -= t.price;
      s.props[p.pos] = { owner: p.id, level: 0, mortgaged: false };
      log(s, `${p.pseudo} achète ${nameOn(s.map, t.pos)} pour ${money(t.price)}.`);
      settle(s, ctx);
      break;
    }
    case 'decline': {
      needPhase(s, 'buy');
      const t = TILES[p.pos];
      log(s, `${p.pseudo} laisse ${nameOn(s.map, t.pos)}.`);
      settle(s, ctx);
      break;
    }
    case 'endTurn':
      needPhase(s, 'end');
      nextTurn(s, ctx);
      break;
    case 'build': {
      needPhase(s, ...MANAGE_PHASES);
      if (!canBuildAt(s, p.id, pos)) throw new Error(`Il te faut ${s.majority} villes de cette région, et un niveau libre.`);
      const cost = buildCost(s, pos);
      if (p.cash < cost) throw new Error(`Il te faut ${money(cost)}.`);
      p.cash -= cost;
      s.props[pos].level += 1;
      log(s, `${p.pseudo} construit à ${nameOn(s.map, pos)}.`);
      break;
    }
    case 'sell': {
      needPhase(s, ...MANAGE_PHASES, 'debt');
      const prop = ownedProp(s, p.id, pos);
      if (!prop.level) throw new Error('Rien à vendre ici.');
      prop.level -= 1;
      p.cash += Math.floor(TILES[pos].build / 2);
      log(s, `${p.pseudo} vend une construction à ${nameOn(s.map, pos)}.`);
      break;
    }
    case 'mortgage': {
      needPhase(s, ...MANAGE_PHASES, 'debt');
      const prop = ownedProp(s, p.id, pos);
      if (prop.mortgaged) throw new Error('Cette ville est déjà en gage.');
      if (prop.level) throw new Error('Vends d’abord les constructions.');
      prop.mortgaged = true;
      p.cash += mortgageValue(TILES[pos]);
      log(s, `${p.pseudo} met ${nameOn(s.map, pos)} en gage.`);
      break;
    }
    case 'unmortgage': {
      needPhase(s, ...MANAGE_PHASES);
      const prop = ownedProp(s, p.id, pos);
      if (!prop.mortgaged) throw new Error('Cette ville n’est pas en gage.');
      const cost = unmortgageCost(TILES[pos]);
      if (p.cash < cost) throw new Error(`Il te faut ${money(cost)}.`);
      p.cash -= cost;
      prop.mortgaged = false;
      log(s, `${p.pseudo} récupère ${nameOn(s.map, pos)}.`);
      break;
    }
    case 'pay':
      needPhase(s, 'debt');
      if (p.cash < s.debt.amount) throw new Error(`Il te manque ${money(s.debt.amount - p.cash)}.`);
      settleDebt(s, ctx);
      break;
    case 'raise': // vendre juste ce qu'il faut pour payer
      needPhase(s, 'debt');
      liquidate(s, p, s.debt.amount);
      log(s, `${p.pseudo} vend ce qu'il faut pour payer.`);
      if (p.cash >= s.debt.amount) settleDebt(s, ctx);
      break;
    case 'bankrupt':
      needPhase(s, 'debt');
      goBankrupt(s, ctx);
      break;
    case 'trade': {
      const other = byId(s, action.to);
      if (!other || other.out || other.id === p.id) throw new Error('Choisis un joueur encore en jeu.');
      if (s.trades.filter((t) => t.from === p.id).length >= MAX_TRADES) throw new Error(`Pas plus de ${MAX_TRADES} propositions en attente.`);
      const give = cleanOffer(action.give);
      const get = cleanOffer(action.get);
      if (!give.cash && !give.cities.length && !get.cash && !get.cities.length) throw new Error('Cette proposition est vide.');
      checkOffer(s, p, give, p.id);
      checkOffer(s, other, get, p.id);
      s.tradeSeq += 1;
      const trade = { id: s.tradeSeq, from: p.id, to: other.id, give, get };
      log(s, `${p.pseudo} propose un échange à ${other.pseudo}.`);
      if (other.bot) { // un robot répond tout de suite
        if (botAccepts(s, other, trade)) {
          transfer(s, p, other, give);
          transfer(s, other, p, get);
          log(s, `${other.pseudo} accepte l'échange de ${p.pseudo}.`);
        } else {
          log(s, `${other.pseudo} refuse l'échange de ${p.pseudo}.`);
        }
      } else {
        s.trades.push(trade);
      }
      break;
    }
    case 'tradeAccept': {
      const t = s.trades.find((x) => x.id === Number(action.id) && x.to === p.id);
      if (!t) throw new Error('Cette proposition n’existe plus.');
      s.trades = s.trades.filter((x) => x.id !== t.id);
      const from = byId(s, t.from);
      try {
        checkOffer(s, from, t.give, p.id);
        checkOffer(s, p, t.get, p.id);
      } catch {
        log(s, `L'échange entre ${from.pseudo} et ${p.pseudo} n'est plus possible : il est annulé.`); // la situation a changé depuis la proposition
        break;
      }
      transfer(s, from, p, t.give);
      transfer(s, p, from, t.get);
      log(s, `${from.pseudo} et ${p.pseudo} concluent un échange.`);
      break;
    }
    case 'tradeReject': {
      const t = s.trades.find((x) => x.id === Number(action.id) && (x.to === p.id || x.from === p.id));
      if (!t) throw new Error('Cette proposition n’existe plus.');
      s.trades = s.trades.filter((x) => x.id !== t.id);
      log(s, t.from === p.id ? `${p.pseudo} retire sa proposition.` : `${p.pseudo} refuse l'échange.`);
      break;
    }
    default:
      throw new Error('Action inconnue.');
  }
  return { state: arm(s, ctx) };
}

// À l'échéance : le jeu joue à la place de l'absent, au plus prudent.
export function timeout(state, ctx) {
  if (state.over) return { state };
  const s = clone(state);
  const p = cur(s);
  if (p.bot) {
    botStep(s, ctx);
    s.armedFor = null;
    return { state: arm(s, ctx) };
  }
  switch (s.phase) {
    case 'roll': doRoll(s, ctx); break;
    case 'buy':
      log(s, `${p.pseudo} laisse ${nameOn(s.map, p.pos)}.`);
      settle(s, ctx);
      break;
    case 'end': nextTurn(s, ctx); break;
    case 'debt':
      liquidate(s, p, s.debt.amount);
      if (p.cash >= s.debt.amount) settleDebt(s, ctx);
      else goBankrupt(s, ctx);
      break;
    default: break;
  }
  s.armedFor = null; // même phase possible (double, joueur suivant identique) : le minuteur doit repartir
  return { state: arm(s, ctx) };
}

// Abandon : ses villes retournent à la banque, la partie continue.
export function leave(state, playerId, ctx) {
  if (state.over) return { state };
  const s = clone(state);
  const p = byId(s, playerId);
  if (!p || p.out) return { state: s };
  log(s, `${p.pseudo} quitte la partie.`);
  const wasCurrent = cur(s).id === p.id;
  if (s.debt?.to === p.id) s.debt.to = null; // on doit désormais cet argent à la banque
  eliminate(s, p, null);
  if (s.over) return { state: arm(s, ctx) };
  if (wasCurrent) {
    s.debt = null;
    s.after = null;
    nextTurn(s, ctx);
  }
  return { state: arm(s, ctx) };
}

// Tout est public sauf l'ordre du paquet.
export function view(state, playerId) {
  const { deck, armedFor, after, ...rest } = state;
  const me = playerId ? byId(state, playerId) : null;
  const mine = me && !me.out && !state.over && cur(state).id === me.id ? positionsOf(state, me.id) : [];
  const manage = MANAGE_PHASES.has(state.phase);
  const inDebt = state.phase === 'debt';
  const rents = {};
  for (const pos of Object.keys(state.props)) rents[pos] = rentOf(state, Number(pos));
  return {
    ...rest,
    players: state.players.map((p) => ({ ...p, worth: worthOf(state, p) })),
    rents,
    actions: {
      build: manage ? mine.filter((pos) => canBuildAt(state, me.id, pos) && me.cash >= buildCost(state, pos)) : [],
      sell: manage || inDebt ? mine.filter((pos) => state.props[pos].level > 0) : [],
      mortgage: manage || inDebt ? mine.filter((pos) => !state.props[pos].mortgaged && !state.props[pos].level) : [],
      unmortgage: manage ? mine.filter((pos) => state.props[pos].mortgaged && me.cash >= unmortgageCost(TILES[pos])) : [],
    },
    // Tout ce que le joueur en dette peut réunir en vendant.
    raisable: inDebt && mine.length ? me.cash + mine.reduce((sum, pos) => {
      const prop = state.props[pos];
      const t = TILES[pos];
      return sum + Math.floor((prop.level * (t.build || 0)) / 2) + (prop.mortgaged ? 0 : mortgageValue(t));
    }, 0) : null,
    costs: Object.fromEntries(mine.filter((pos) => TILES[pos].type === 'city').map((pos) => [pos, buildCost(state, pos)])),
    ...(inDebt && me && cur(state).id === me.id && me.cash < state.debt.amount ? { debtPlan: debtPlan(state, me) } : {}),
  };
}

export function status(state) {
  // Le hub ne connaît que de vrais comptes : la victoire d'un robot est annoncée par le jeu lui-même.
  if (state.over) {
    const names = state.winners.map((id) => `${byId(state, id).pseudo}${id < 0 ? ' (robot)' : ''}`).join(' et ');
    return { turn: null, over: true, winners: state.winners.filter((id) => id > 0), label: state.winners.length > 3 ? `${state.winners.length} joueurs à égalité` : `${names} ${state.winners.length > 1 ? 'gagnent' : 'gagne'}`, deadline: null };
  }
  return { turn: cur(state).id, may: active(state).filter((p) => !p.bot).map((p) => p.id), over: false, winners: [], deadline: state.deadline };
}
