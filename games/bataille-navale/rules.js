// Bataille navale : deux flottes cachées sur une grille 10 × 10, on se tire dessus à tour de rôle.
// Les règles sont pures : ni réseau, ni base, ni affichage. Le hasard et l'heure viennent de ctx.
//
// Phases : « placing » (les deux placent leur flotte en même temps), « firing » (tirs alternés), « over ».
// Une case est un nombre 0..99 : ligne × 10 + colonne.

export const SIZE = 10;
export const FLEET = [5, 4, 3, 3, 2];
const MAX_ATTEMPTS = 2000;

const other = (seat) => 1 - seat;

// ——— Flotte ———

// Les cases d'un bateau { size, r, c, h } : h vrai = à l'horizontale (vers la droite), sinon vers le bas.
export function cellsOf(ship) {
  return Array.from({ length: ship.size }, (_, i) => (ship.h ? ship.r * SIZE + ship.c + i : (ship.r + i) * SIZE + ship.c));
}

// Contrôle une flotte envoyée par un joueur et renvoie une version propre, ou lève une Error en français.
export function checkFleet(input) {
  if (!Array.isArray(input) || input.length !== FLEET.length) {
    throw new Error(`Place les ${FLEET.length} bateaux avant de te déclarer prêt.`);
  }
  const ships = input.map((s) => ({ size: Number(s?.size), r: Number(s?.r), c: Number(s?.c), h: Boolean(s?.h) }));
  const sizes = ships.map((s) => s.size).sort((a, b) => b - a);
  if (sizes.some((n, i) => n !== FLEET[i])) throw new Error('La flotte doit avoir les bateaux de 5, 4, 3, 3 et 2 cases.');
  const used = new Set();
  for (const s of ships) {
    if (![s.r, s.c].every((n) => Number.isInteger(n) && n >= 0 && n < SIZE)) throw new Error('Un bateau est hors de la grille.');
    const end = (s.h ? s.c : s.r) + s.size - 1;
    if (end >= SIZE) throw new Error('Un bateau dépasse de la grille.');
    for (const cell of cellsOf(s)) {
      if (used.has(cell)) throw new Error('Deux bateaux se chevauchent.');
      used.add(cell);
    }
  }
  return ships.sort((a, b) => b.size - a.size || a.r - b.r || a.c - b.c);
}

// Flotte au hasard : on place du plus grand au plus petit, en recommençant si un bateau ne rentre pas.
export function randomFleet(random) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const used = new Set();
    const ships = [];
    let ok = true;
    for (const size of FLEET) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t += 1) {
        const h = random() < 0.5;
        const r = Math.floor(random() * (h ? SIZE : SIZE - size + 1));
        const c = Math.floor(random() * (h ? SIZE - size + 1 : SIZE));
        const ship = { size, r, c, h };
        const cells = cellsOf(ship);
        if (cells.some((x) => used.has(x))) continue;
        cells.forEach((x) => used.add(x));
        ships.push(ship);
        placed = true;
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok) return ships;
  }
  // Ne devrait jamais arriver : flotte fixe de secours.
  return FLEET.map((size, r) => ({ size, r, c: 0, h: true }));
}

// ——— Mise en place ———

export function setup(players, options = {}) {
  return {
    players: players.map((p) => p.id),
    salvo: Boolean(options.salvo), // rejouer après une touche
    timer: Number(options.timer) > 0 ? Number(options.timer) : 0, // secondes par tir, 0 = sans minuteur
    phase: 'placing',
    fleets: [[], []], // flotte de chaque place (placée mais pas forcément validée)
    ready: [false, false],
    shots: [[], []], // shots[i] : tirs de la place i, contre la flotte de l'autre : { cell, result, ship? }
    turn: 0,
    deadline: null,
    last: null, // dernier tir : { by, cell, result, size? }
    winner: null,
    forfeit: null,
  };
}

const seatOf = (state, playerId) => state.players.indexOf(playerId);

// Résultat d'un tir de la place « seat » sur la case « cell » : met à jour les tirs, ne touche pas au reste.
function resolveShot(state, seat, cell) {
  const target = state.fleets[other(seat)];
  const mine = state.shots[seat];
  const ship = target.find((s) => cellsOf(s).includes(cell));
  let entry;
  if (!ship) {
    entry = { cell, result: 'miss' };
  } else {
    const cells = cellsOf(ship);
    const hits = new Set(mine.filter((s) => s.result !== 'miss').map((s) => s.cell));
    hits.add(cell);
    const sunk = cells.every((x) => hits.has(x));
    entry = sunk ? { cell, result: 'sunk', ship: { size: ship.size, cells } } : { cell, result: 'hit' };
  }
  const shots = state.shots.map((list, i) => (i === seat ? [...list, entry] : list));
  const allSunk = target.every((s) => {
    const hits = new Set(shots[seat].filter((x) => x.result !== 'miss').map((x) => x.cell));
    return cellsOf(s).every((x) => hits.has(x));
  });
  return { entry, shots, allSunk };
}

function deadlineFor(state, ctx) {
  return state.timer ? ctx.now + state.timer * 1000 : null;
}

function fire(state, seat, cell, ctx) {
  const { entry, shots, allSunk } = resolveShot(state, seat, cell);
  const last = { by: seat, cell, result: entry.result, size: entry.ship?.size ?? null };
  if (allSunk) {
    return { ...state, shots, last, phase: 'over', winner: state.players[seat], deadline: null };
  }
  const again = state.salvo && entry.result !== 'miss';
  const next = again ? seat : other(seat);
  return { ...state, shots, last, turn: next, deadline: deadlineFor(state, ctx) };
}

export function move(state, playerId, action, ctx) {
  const seat = seatOf(state, playerId);
  if (seat < 0) throw new Error('Tu regardes cette partie.');
  if (state.phase === 'over') throw new Error('La partie est terminée.');
  const type = action?.type;

  if (state.phase === 'placing') {
    if (state.ready[seat]) throw new Error('Ta flotte est prête : attends ton adversaire.');
    if (type === 'random') {
      const fleets = state.fleets.map((f, i) => (i === seat ? randomFleet(ctx.random) : f));
      return { state: { ...state, fleets } };
    }
    if (type === 'ready') {
      const ships = checkFleet(action.ships);
      const fleets = state.fleets.map((f, i) => (i === seat ? ships : f));
      const ready = state.ready.map((r, i) => (i === seat ? true : r));
      if (!ready.every(Boolean)) return { state: { ...state, fleets, ready } };
      const first = ctx.random() < 0.5 ? 0 : 1;
      return { state: { ...state, fleets, ready, phase: 'firing', turn: first, deadline: deadlineFor(state, ctx) } };
    }
    throw new Error('Place ta flotte, puis déclare-toi prêt.');
  }

  // Phase de tirs.
  if (type !== 'fire') throw new Error('C’est le moment de tirer.');
  if (state.turn !== seat) throw new Error("Ce n'est pas ton tour.");
  const cell = Number(action.cell);
  if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE) throw new Error('Cette case n’existe pas.');
  if (state.shots[seat].some((s) => s.cell === cell)) throw new Error('Tu as déjà tiré sur cette case.');
  return { state: fire(state, seat, cell, ctx) };
}

// Minuteur échu : tir au hasard sur une case jamais visée.
export function timeout(state, ctx) {
  if (state.phase !== 'firing') return { state };
  const tried = new Set(state.shots[state.turn].map((s) => s.cell));
  const free = [];
  for (let i = 0; i < SIZE * SIZE; i += 1) if (!tried.has(i)) free.push(i);
  if (!free.length) return { state };
  const cell = free[Math.min(free.length - 1, Math.floor(ctx.random() * free.length))];
  return { state: fire(state, state.turn, cell, ctx) };
}

// Abandon : l'autre joueur gagne.
export function leave(state, playerId) {
  const seat = seatOf(state, playerId);
  if (seat < 0 || state.phase === 'over') return { state };
  return { state: { ...state, phase: 'over', forfeit: playerId, winner: state.players[other(seat)], deadline: null } };
}

// ——— Ce que chacun voit ———

// Ma flotte et les résultats des tirs : jamais la flotte adverse avant la fin (sauf les bateaux coulés, révélés par les tirs).
export function view(state, playerId) {
  const seat = seatOf(state, playerId);
  const over = state.phase === 'over';
  return {
    players: state.players,
    seat, // −1 pour un spectateur
    size: SIZE,
    fleetSizes: FLEET,
    salvo: state.salvo,
    timer: state.timer,
    phase: state.phase,
    ready: state.ready,
    fleet: seat >= 0 ? state.fleets[seat] : null,
    shots: state.shots,
    turn: state.phase === 'firing' ? state.turn : null,
    last: state.last,
    deadline: state.deadline,
    winner: state.winner,
    forfeit: state.forfeit,
    // À la fin, tout le monde voit les deux flottes.
    fleets: over ? state.fleets : null,
  };
}

export function status(state) {
  if (state.phase === 'over') return { turn: null, over: true, winners: state.winner ? [state.winner] : [] };
  if (state.phase === 'placing') {
    return { turn: state.players.filter((_, i) => !state.ready[i]), over: false, winners: [] };
  }
  return { turn: state.players[state.turn], over: false, winners: [], deadline: state.deadline ?? undefined };
}
