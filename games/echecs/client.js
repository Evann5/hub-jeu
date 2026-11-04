// Échecs côté navigateur : design minimal noir et blanc, pièces dessinées en SVG, une seule couleur d'accent.
// Toucher une pièce montre ses coups légaux (le serveur les envoie dans view.legal), toucher une case d'arrivée joue le coup.
// Clavier : flèches pour se déplacer sur le plateau, Entrée ou Espace pour choisir, Échap pour annuler.
import { sprite, pieceSvg, PIECE_NAMES } from './client/pieces.js';

const FILES = 'abcdefgh';
const VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9 };
const START_COUNT = { P: 8, N: 2, B: 2, R: 2, Q: 1 };
const COLOR_NAME = ['blancs', 'noirs'];
const PROMO_CHOICES = [['Q', 'Dame'], ['R', 'Tour'], ['B', 'Fou'], ['N', 'Cavalier']];

const isWhite = (piece) => piece === piece.toUpperCase();
const squareName = (sq) => FILES[sq & 7] + ((sq >> 3) + 1);

function fmtClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function mount(root, api) {
  const { h } = api;
  let v = null;
  let info = null;
  let selected = null; // case de la pièce choisie
  let promo = null; // { from, to } : choix de la pièce de promotion en cours
  let focusSq = null; // case qui reçoit le focus au clavier
  let busy = false;

  // Orientation : les noirs voient le plateau retourné.
  let flipped = false;
  let drawnFlip = null; // orientation déjà posée dans le DOM
  const squaresInOrder = () => Array.from({ length: 64 }, (_, i) => {
    const row = i >> 3;
    const col = i & 7;
    return flipped ? row * 8 + (7 - col) : (7 - row) * 8 + col;
  });

  // ——— Construction ———
  const cells = new Map(); // case -> { el, piece }
  const boardEl = h('div.eq-board', { role: 'group', 'aria-label': 'Plateau d’échecs' });
  const promoEl = h('div.eq-promo', { hidden: true, role: 'dialog', 'aria-label': 'Choisis la pièce de promotion' });
  const ranksEl = h('div.eq-ranks', { 'aria-hidden': 'true' });
  const filesEl = h('div.eq-files', { 'aria-hidden': 'true' });
  const statusEl = h('p.eq-status', { 'aria-live': 'polite' });
  const movesEl = h('ol.eq-moves', { 'aria-label': 'Coups joués' });
  const movesBox = h('section.eq-movebox', h('h3', 'Feuille de partie'), movesEl);
  const actionsEl = h('div.eq-actions');
  const bars = [h('div.eq-player'), h('div.eq-player')]; // haut, bas
  const clockEls = new Map(); // couleur -> élément

  for (let sq = 0; sq < 64; sq++) {
    const el = h('button.eq-sq', {
      type: 'button',
      tabindex: '-1',
      'data-sq': String(sq),
      onclick: () => onSquare(sq),
      onfocus: () => { focusSq = sq; },
    });
    cells.set(sq, { el, piece: null, key: '' });
  }

  const stage = h('div.eq-stage',
    h('div.eq-left',
      bars[0],
      h('div.eq-frame', ranksEl, filesEl,
        h('div.eq-boardwrap', boardEl, promoEl)),
      bars[1],
      statusEl),
    h('div.eq-right', actionsEl, movesBox));
  const eq = h('div.eq', sprite(), stage);
  root.append(eq);

  promoEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !promo) return;
    promo = null;
    render();
    focusCell(selected ?? focusSq);
    e.preventDefault();
  });

  boardEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (promo || selected !== null) {
        promo = null;
        selected = null;
        render();
        e.preventDefault();
      }
      return;
    }
    const delta = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (!delta || focusSq === null) return;
    e.preventDefault();
    const order = squaresInOrder();
    const at = order.indexOf(focusSq);
    const col = Math.min(7, Math.max(0, (at & 7) + delta[0]));
    const row = Math.min(7, Math.max(0, (at >> 3) + delta[1]));
    focusCell(order[row * 8 + col]);
  });

  function focusCell(sq) {
    focusSq = sq;
    for (const [s, c] of cells) c.el.tabIndex = s === sq ? 0 : -1;
    cells.get(sq).el.focus();
  }

  // ——— Actions ———
  const canPlay = () => info?.isPlayer && v && v.you !== null && v.turn === v.you && !v.result && !busy;

  async function send(action) {
    busy = true;
    try {
      await api.sendMove(action);
    } catch {
      /* le hub affiche déjà l'erreur */
    } finally {
      busy = false;
      selected = null;
      promo = null;
      if (v) render();
    }
  }

  function onSquare(sq) {
    if (!canPlay() || promo) return;
    const piece = v.board[sq];
    if (selected !== null && v.legal[selected]?.includes(sq)) {
      if (v.promos.includes(`${selected}-${sq}`)) {
        promo = { from: selected, to: sq };
        render();
        promoEl.querySelector('button')?.focus();
        return;
      }
      send({ type: 'move', from: selected, to: sq });
      return;
    }
    if (piece && isWhite(piece) === (v.you === 0)) {
      selected = selected === sq ? null : sq;
      if (selected !== null && !v.legal[sq]) {
        selected = null;
        statusEl.textContent = 'Cette pièce ne peut pas bouger pour l’instant.';
        return;
      }
    } else {
      selected = null;
    }
    render();
  }

  // ——— Affichage ———
  function pieceLabel(piece) {
    return `${PIECE_NAMES[piece.toUpperCase()]} ${isWhite(piece) ? 'blanc' : 'noir'}`;
  }

  function renderBoard() {
    const order = squaresInOrder();
    if (drawnFlip !== flipped) {
      boardEl.replaceChildren(...order.map((sq) => cells.get(sq).el)); // seulement au changement d'orientation : le focus clavier reste en place
      drawnFlip = flipped;
    }
    const legalTargets = selected !== null ? new Set(v.legal[selected] || []) : new Set();
    const movable = canPlay() ? new Set(Object.keys(v.legal).map(Number)) : new Set();
    for (const sq of order) {
      const c = cells.get(sq);
      const piece = v.board[sq];
      const key = piece || '';
      if (c.key !== key) {
        c.el.querySelector('.eq-p')?.remove();
        if (piece) c.el.prepend(pieceSvg(piece, isWhite(piece)));
        c.key = key;
      }
      const dark = ((sq & 7) + (sq >> 3)) % 2 === 0;
      const classes = ['eq-sq', dark ? 'is-dark' : 'is-light'];
      if (selected === sq) classes.push('is-selected');
      if (legalTargets.has(sq)) {
        const enPassant = !piece && v.board[selected].toUpperCase() === 'P' && (sq & 7) !== (selected & 7);
        classes.push(piece || enPassant ? 'is-capture' : 'is-target');
      }
      if (v.last && v.last.includes(sq)) classes.push('is-last');
      if (v.check === sq) classes.push('is-check');
      if (movable.has(sq) && selected === null) classes.push('is-movable');
      if (v.last && v.last[1] === sq) classes.push('is-landed');
      c.el.className = classes.join(' ');
      const where = squareName(sq);
      let label = `${where}, ${piece ? pieceLabel(piece) : 'vide'}`;
      if (selected === sq) label += ', choisie';
      if (legalTargets.has(sq)) label += ', coup possible';
      if (v.check === sq) label += ', roi en échec';
      c.el.setAttribute('aria-label', label);
      c.el.removeAttribute('aria-selected');
      c.el.tabIndex = sq === focusSq ? 0 : -1;
    }
    if (focusSq === null || !cells.has(focusSq)) {
      focusSq = v.you === 1 ? 52 : 12; // e7 ou e2 : devant le roi
      cells.get(focusSq).el.tabIndex = 0;
    }
    // coordonnées sur les bords
    const ranks = order.filter((_, i) => (i & 7) === 0).map((sq) => (sq >> 3) + 1);
    const files = order.slice(56).map((sq) => FILES[sq & 7]);
    ranksEl.replaceChildren(...ranks.map((r) => h('span', String(r))));
    filesEl.replaceChildren(...files.map((f) => h('span', f)));
  }

  function renderPromo() {
    promoEl.hidden = !promo;
    if (!promo) return;
    promoEl.replaceChildren(
      h('p', 'Promotion : choisis une pièce'),
      h('div.eq-promo-row', PROMO_CHOICES.map(([letter, name]) => h('button.eq-promo-btn', {
        type: 'button',
        'aria-label': name,
        onclick: () => send({ type: 'move', from: promo.from, to: promo.to, promo: letter }),
      }, pieceSvg(letter, v.you === 0), h('span', name)))),
      h('button.eq-promo-cancel', { type: 'button', onclick: () => { promo = null; render(); focusCell(selected ?? focusSq); } }, 'Annuler'));
  }

  // Pièces prises par chaque camp, et l'avantage de matériel.
  function material() {
    const count = [{}, {}];
    for (const p of v.board) if (p && p.toUpperCase() !== 'K') {
      const c = isWhite(p) ? 0 : 1;
      count[c][p.toUpperCase()] = (count[c][p.toUpperCase()] || 0) + 1;
    }
    // On ne peut pas retrouver les pions promus : on compte ce qui manque par rapport au départ.
    const lost = [{}, {}];
    const score = [0, 0];
    for (const c of [0, 1]) {
      for (const t of Object.keys(START_COUNT)) {
        const missing = Math.max(0, START_COUNT[t] - (count[c][t] || 0));
        if (missing) lost[c][t] = missing;
      }
      score[c] = Object.entries(count[c]).reduce((n, [t, k]) => n + VALUE[t] * k, 0);
    }
    return { lost, diff: score[0] - score[1] };
  }

  function clockMs(color) {
    const c = v.clock;
    if (!c) return null;
    const running = !v.result && v.turn === color;
    const ms = c.ms[color] - (running ? api.now() - c.since : 0);
    return v.result?.reason === 'time' && v.turn === color ? 0 : Math.max(0, ms);
  }

  function playerBar(el, color) {
    const id = v.players[color];
    const { lost, diff } = material();
    const taken = lost[1 - color]; // ce que ce joueur a pris à l'autre camp
    const gain = color === 0 ? diff : -diff;
    const turn = !v.result && v.turn === color;
    const order = ['Q', 'R', 'B', 'N', 'P'];
    const clockEl = h('span.eq-clock', { role: 'timer', 'aria-label': `Temps des ${COLOR_NAME[color]}` });
    clockEls.set(color, clockEl);
    el.className = `eq-player${turn ? ' is-turn' : ''}`;
    el.replaceChildren(
      h(`span.eq-dot.${color === 0 ? 'w' : 'b'}`, { 'aria-hidden': 'true' }),
      api.token(api.user(id), { size: 's' }),
      h('span.eq-who',
        h('b', api.user(id).pseudo + (id === api.me.id ? ' (toi)' : '')),
        h('small', `les ${COLOR_NAME[color]}${turn ? ' · au trait' : ''}`)),
      h('span.eq-taken', { 'aria-label': 'Pièces prises' },
        order.flatMap((t) => Array.from({ length: taken[t] || 0 }, () => pieceSvg(t, color === 1))),
        gain > 0 ? h('em', `+${gain}`) : null),
      ...(v.clock ? [clockEl] : []));
    tick();
  }

  function tick() {
    if (!v?.clock) return;
    for (const [color, el] of clockEls) {
      const ms = clockMs(color);
      el.textContent = fmtClock(ms);
      const running = !v.result && v.turn === color;
      el.classList.toggle('is-low', ms < 30000);
      el.classList.toggle('is-running', running);
    }
  }
  const clockTimer = setInterval(tick, 250);

  function renderMoves() {
    const rows = [];
    for (let i = 0; i < v.moves.length; i += 2) {
      rows.push(h('li', { value: i / 2 + 1 },
        h('span.eq-n', `${i / 2 + 1}.`),
        h(`span.eq-m${i === v.moves.length - 1 ? '.is-last' : ''}`, v.moves[i]),
        v.moves[i + 1] ? h(`span.eq-m${i + 1 === v.moves.length - 1 ? '.is-last' : ''}`, v.moves[i + 1]) : h('span.eq-m')));
    }
    movesEl.replaceChildren(...(rows.length ? rows : [h('li.eq-empty', 'Aucun coup pour l’instant.')]));
    movesEl.scrollTop = movesEl.scrollHeight;
    requestAnimationFrame(() => { movesEl.scrollTop = movesEl.scrollHeight; }); // après la mise en page : la dernière ligne reste entière
  }

  function renderActions() {
    const mine = v.you;
    const parts = [];
    if (info?.isPlayer && mine !== null && !v.result) {
      const myTurn = v.turn === mine;
      if (v.offer !== null && v.offer !== mine && myTurn) {
        parts.push(h('div.eq-offer', { role: 'group', 'aria-label': 'Proposition de nulle' },
          h('p', `${api.user(v.players[v.offer]).pseudo} te propose la nulle.`),
          h('div.eq-offer-btns',
            h('button.eq-btn.is-main', { type: 'button', onclick: () => send({ type: 'draw-accept' }) }, 'Accepter la nulle'),
            h('button.eq-btn', { type: 'button', onclick: () => send({ type: 'draw-decline' }) }, 'Refuser'))));
      } else if (v.offer === mine) {
        parts.push(h('p.eq-note', myTurn ? 'Nulle proposée : joue ton coup, ton adversaire répondra à son tour.' : 'Nulle proposée : ton adversaire répond à son prochain tour.'));
      } else if (myTurn && v.offer === null) {
        parts.push(h('button.eq-btn', { type: 'button', onclick: () => send({ type: 'draw-offer' }) }, 'Proposer la nulle'));
      }
    }
    actionsEl.replaceChildren(...parts);
  }

  const nameOf = (id) => (id === api.me.id ? 'Tu' : api.user(id).pseudo);
  const verbWin = (id) => (id === api.me.id ? 'gagnes' : 'gagne');

  function statusText() {
    const r = v.result;
    if (r) {
      const win = r.winner !== null ? v.players[r.winner] : null;
      const lose = r.winner !== null ? v.players[1 - r.winner] : null;
      switch (r.reason) {
        case 'mate': return `Échec et mat. ${nameOf(win)} ${verbWin(win)} !`;
        case 'resign': return `${api.user(lose).pseudo} abandonne. ${nameOf(win)} ${verbWin(win)} !`;
        case 'time': return `Le temps de ${lose === api.me.id ? 'ton camp' : api.user(lose).pseudo} est écoulé. ${nameOf(win)} ${verbWin(win)} !`;
        case 'stalemate': return 'Pat : le camp au trait n’a aucun coup possible. Partie nulle.';
        case 'insufficient': return 'Matériel insuffisant pour mater. Partie nulle.';
        case 'fifty': return 'Règle des 50 coups : partie nulle.';
        case 'repetition': return 'Même position trois fois : partie nulle.';
        case 'agreement': return 'Nulle acceptée : partie nulle.';
        case 'time-insufficient': return 'Temps écoulé, mais l’adversaire ne peut plus mater : partie nulle.';
        default: return 'Partie terminée.';
      }
    }
    const mover = v.players[v.turn];
    const check = v.check !== null ? ' Échec !' : '';
    if (info?.isPlayer && mover === api.me.id) {
      return selected !== null ? 'Touche une case marquée pour y jouer la pièce.' : `À toi de jouer.${check}`;
    }
    if (!info?.isPlayer) return `${api.user(mover).pseudo} joue les ${COLOR_NAME[v.turn]}.${check}`;
    return `${api.user(mover).pseudo} réfléchit…${check}`;
  }

  function render() {
    renderBoard();
    renderPromo();
    // joueur du haut = l'adversaire (ou les noirs pour un spectateur)
    const bottom = flipped ? 1 : 0;
    playerBar(bars[0], 1 - bottom);
    playerBar(bars[1], bottom);
    renderActions();
    statusEl.textContent = statusText();
    statusEl.classList.toggle('is-over', Boolean(v.result));
    const won = Boolean(v.result && v.result.winner !== null && v.players[v.result.winner] === api.me.id);
    statusEl.classList.toggle('is-win', won);
    statusEl.classList.toggle('is-check', !v.result && v.check !== null);
  }

  let lastMoves = -1;
  const off = api.onState((view, i) => {
    v = view;
    info = i;
    flipped = v.you === 1;
    if (v.moves.length !== lastMoves) {
      selected = null;
      promo = null;
      lastMoves = v.moves.length;
      renderMoves();
    }
    if (v.result || v.turn !== v.you) selected = null;
    render();
  });

  return () => {
    clearInterval(clockTimer);
    off();
  };
}
