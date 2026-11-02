// Belote côté navigateur : un mur de street-art. Couleurs bombe, cartes « stickers » dessinées en SVG,
// bonbons de score. Les cartes jouables viennent de la vue (view().legal) : le client
// ne laisse jouer que ce que les règles autorisent.

const NS = 'http://www.w3.org/2000/svg';
const SUITS = ['S', 'H', 'C', 'D']; // alternance noir / rouge pour trier la main
const SUIT_NAME = { S: 'pique', H: 'cœur', D: 'carreau', C: 'trèfle' };
const RANK_NAME = { 7: 'sept', 8: 'huit', 9: 'neuf', 10: 'dix', J: 'valet', Q: 'dame', K: 'roi', A: 'as' };
const RED = '#E0144C';
const BLACK = '#1A0B3B';
const PLAIN_ORDER = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
const TRUMP_ORDER = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J'];
const HOLD_MS = 1400; // un pli fini reste visible un instant
const BUBBLE_MS = 2400;

const suitOf = (c) => c[0];
const rankOf = (c) => c.slice(1);
const isRed = (s) => s === 'H' || s === 'D';
const cardName = (c) => `${RANK_NAME[rankOf(c)]} de ${SUIT_NAME[suitOf(c)]}`;

function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const kid of kids.flat()) if (kid) el.append(kid);
  return el;
}

// Les quatre couleurs, dessinées dans une boîte de 24 × 24.
function suitShape(suit, fill) {
  if (suit === 'H') return [svg('path', { fill, d: 'M12 22C5 16 1.5 12 1.5 7.4 1.5 4 4 1.8 6.9 1.8c2.2 0 4 1.2 5.1 3.3 1.1-2.1 2.9-3.3 5.1-3.3 2.9 0 5.4 2.2 5.4 5.6C22.5 12 19 16 12 22z' })];
  if (suit === 'D') return [svg('path', { fill, d: 'M12 1.2 21 12l-9 10.8L3 12z' })];
  if (suit === 'S') return [svg('path', { fill, d: 'M12 1.5C12 1.5 2 9.2 2 14.6c0 3.2 2.6 5.2 5.2 5.2 1.7 0 3.1-.7 4-2-.2 2.4-1.2 4.2-3.2 5.2h7.9c-2-1-3-2.8-3.2-5.2.9 1.3 2.3 2 4 2 2.6 0 5.3-2 5.3-5.2C22 9.2 12 1.5 12 1.5z' })];
  return [
    svg('circle', { cx: 12, cy: 7.3, r: 5.3, fill }), svg('circle', { cx: 6.2, cy: 15, r: 5.3, fill }), svg('circle', { cx: 17.8, cy: 15, r: 5.3, fill }),
    svg('path', { fill, d: 'M10.6 13c0 4-1 7.4-3.2 9.8h9.2c-2.2-2.4-3.2-5.8-3.2-9.8z' }),
  ];
}

function pip(suit, x, y, size, flip = false) {
  const fill = isRed(suit) ? RED : BLACK;
  const k = size / 24;
  const t = `translate(${x - size / 2} ${y - size / 2}) ${flip ? `rotate(180 ${size / 2} ${size / 2}) ` : ''}scale(${k})`;
  return svg('g', { transform: t }, suitShape(suit, fill));
}

// Positions des couleurs (colonne gauche x=32, centre x=50, colonne droite x=68).
const L = 32;
const C = 50;
const R = 68;
const PIPS = {
  7: [[L, 34], [L, 70], [L, 106], [R, 34], [R, 70], [R, 106], [C, 52]],
  8: [[L, 34], [L, 70], [L, 106], [R, 34], [R, 70], [R, 106], [C, 52], [C, 88]],
  9: [[L, 32], [L, 56], [L, 84], [L, 108], [R, 32], [R, 56], [R, 84], [R, 108], [C, 70]],
  10: [[L, 32], [L, 56], [L, 84], [L, 108], [R, 32], [R, 56], [R, 84], [R, 108], [C, 44], [C, 96]],
};

// Une moitié de figure (valet, dame ou roi) : la carte porte deux moitiés, la seconde retournée.
function faceHalf(rank, suit) {
  const coat = rank === 'Q' ? '#FF2E93' : rank === 'K' ? '#7B3BFF' : '#12B5E5';
  const gold = '#FF9F1C';
  const skin = '#FFC9A8';
  const hair = '#1A0B3B';
  const parts = [
    svg('rect', { x: 24, y: 22, width: 52, height: 48, fill: '#FFE93B' }),
    svg('path', { d: 'M24 70V60Q26 50 38 47h24q12 3 14 13v10z', fill: coat }),
    svg('path', { d: 'M24 70L50 50 76 70', fill: 'none', stroke: gold, 'stroke-width': 2.4 }),
    svg('rect', { x: 45, y: 42, width: 10, height: 8, fill: skin }),
    svg('circle', { cx: 50, cy: 38, r: 9.2, fill: skin }),
  ];
  if (rank === 'K') {
    parts.push(svg('path', { d: 'M38 36q0 8 5 10l-3 4q-8-3-8-14zM62 36q0 8-5 10l3 4q8-3 8-14z', fill: hair }));
    parts.push(svg('path', { d: 'M40 31l1-9 5 5 4-7 4 7 5-5 1 9z', fill: gold, stroke: '#1A0B3B', 'stroke-width': 1 }));
  } else if (rank === 'Q') {
    parts.push(svg('path', { d: 'M40 40q-5 4-4 14l6-4zM60 40q5 4 4 14l-6-4z', fill: hair }));
    parts.push(svg('path', { d: 'M40 33q10-9 20 0l-2 3q-8-5-16 0z', fill: hair }));
    parts.push(svg('path', { d: 'M42 31l2-6 3 3 3-5 3 5 3-3 2 6z', fill: gold, stroke: '#1A0B3B', 'stroke-width': 1 }));
  } else {
    parts.push(svg('path', { d: 'M39 38q0 5 3 8l-3 2q-6-5-3-13z', fill: hair }));
    parts.push(svg('path', { d: 'M38 33q12-10 26 0 0 4-3 4-8-3-14 0z', fill: coat, stroke: gold, 'stroke-width': 1 }));
    parts.push(svg('path', { d: 'M58 28q10-6 14 4-7-2-10 2z', fill: '#C94A38' }));
  }
  parts.push(pip(suit, 50, 63, 11).cloneNode(true));
  parts.at(-1).querySelectorAll('path, circle').forEach((p) => p.setAttribute('fill', '#FFF8EA'));
  parts.push(svg('circle', { cx: 46.5, cy: 38.5, r: 1.1, fill: '#1A0B3B' }), svg('circle', { cx: 53.5, cy: 38.5, r: 1.1, fill: '#1A0B3B' }));
  return svg('g', {}, parts);
}

function cardSvg(card) {
  const suit = suitOf(card);
  const rank = rankOf(card);
  const color = isRed(suit) ? RED : BLACK;
  const kids = [
    svg('rect', { x: 1.5, y: 1.5, width: 97, height: 137, rx: 9, fill: '#FFFFFF', stroke: '#1A0B3B', 'stroke-width': 3 }),
  ];
  const corner = (flip) => svg('g', flip ? { transform: 'rotate(180 50 70)' } : {},
    svg('text', { x: 13, y: 25, 'text-anchor': 'middle', 'font-size': rank === '10' ? 15 : 20, 'font-weight': 800, fill: color, 'font-family': 'BL Unbounded, system-ui, sans-serif' }, rank),
    pip(suit, 12, 35, 12));
  if (PIPS[rank]) {
    for (const [x, y] of PIPS[rank]) kids.push(pip(suit, x, y, 19, y > 70));
  } else if (rank === 'A') {
    kids.push(pip(suit, 50, 70, 44));
  } else {
    kids.push(svg('rect', { x: 22, y: 20, width: 56, height: 100, fill: 'none', stroke: color, 'stroke-width': 1.6 }));
    kids.push(faceHalf(rank, suit));
    const lower = faceHalf(rank, suit);
    lower.setAttribute('transform', 'rotate(180 50 70)');
    kids.push(lower);
    kids.push(svg('line', { x1: 22, y1: 70, x2: 78, y2: 70, stroke: color, 'stroke-width': 1.2 }));
  }
  kids.push(corner(false), corner(true));
  return svg('svg', { viewBox: '0 0 100 140', class: 'bl-face', 'aria-hidden': 'true', focusable: 'false' }, kids);
}

function suitIcon(suit, size = 18) {
  return svg('svg', { viewBox: '0 0 24 24', width: size, height: size, class: 'bl-suit', 'aria-hidden': 'true', focusable: 'false' }, suitShape(suit, isRed(suit) ? RED : BLACK));
}

function sortHand(hand, trump) {
  const order = (c) => (suitOf(c) === trump ? TRUMP_ORDER : PLAIN_ORDER).indexOf(rankOf(c));
  return hand.slice().sort((a, b) => SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b)) || order(a) - order(b));
}

export function mount(root, api) {
  const { h } = api;
  const el = h('div.bl');
  root.append(el);
  let v = null;
  let busy = false;
  let seenAnnounce = null;
  let seenTrick = null;
  let hold = null; // { trick, until } : le dernier pli reste affiché un instant
  let bubble = null; // { seat, text, until }
  let handFocus = false;
  let prevTrickKey = null;
  let holdTimer = 0;
  let bubbleTimer = 0;

  const name = (seat) => api.user(v.players[seat]).pseudo;
  const mySeat = () => (v.seat >= 0 ? v.seat : 0);
  const rel = (seat) => (seat - mySeat() + 4) % 4; // 0 moi, 1 à ma gauche, 2 en face, 3 à ma droite
  const myTeam = () => mySeat() % 2;
  const teamName = (t) => (v.seat >= 0 ? (t === myTeam() ? 'Nous' : 'Eux') : `${name(t)} & ${name(t + 2)}`);

  function play(action) {
    if (busy) return;
    busy = true;
    api.sendMove(action).catch(() => { busy = false; });
  }

  // ——— Pièces ———

  function cardButton(card, { legal, interactive }) {
    const dim = interactive && !legal;
    const b = h('button.bl-card', {
      type: 'button',
      'data-card': card,
      'aria-label': `${cardName(card)}${dim ? ', interdit' : ''}`,
      'aria-disabled': interactive ? String(!legal) : 'true',
      class: `bl-card${isRed(suitOf(card)) ? ' is-red' : ''}${legal ? ' is-legal' : ''}${dim ? ' is-dim' : ''}${interactive ? '' : ' is-idle'}`,
      onclick: () => {
        if (!interactive) return;
        if (!legal) { api.toast(v.hint || 'Cette carte n’est pas permise.'); return; }
        play({ type: 'play', card });
      },
    }, cardSvg(card));
    if (!interactive) b.tabIndex = -1;
    return b;
  }

  const faceCard = (card, extra = '') => h(`div.bl-card.is-table${extra}`, { role: 'img', 'aria-label': cardName(card) }, cardSvg(card));

  function backs(count, vertical) {
    return h(`div.bl-backs${vertical ? '.is-v' : ''}`, { 'aria-hidden': 'true' },
      Array.from({ length: count }, () => h('i.bl-back')));
  }

  function seatBadge(seat) {
    const r = rel(seat);
    const turnNow = (v.phase === 'bid1' || v.phase === 'bid2' || v.phase === 'play') && v.turn === seat;
    const bid = (v.phase === 'bid1' || v.phase === 'bid2') ? [...v.bids].reverse().find((b) => b.seat === seat) : null;
    const said = bubble && bubble.seat === seat && bubble.until > Date.now() ? bubble.text : null;
    let bidText = null;
    if (bid) bidText = bid.act === 'pass' ? 'Je passe' : `Je prends à ${SUIT_NAME[bid.suit]}`;
    const partner = v.seat >= 0 && r === 2;
    const you = v.seat >= 0 && r === 0;
    return h(`div.bl-seat.rel-${r}${turnNow ? '.is-turn' : ''}${seat % 2 === myTeam() ? '.is-ours' : ''}`,
      h('div.bl-who',
        api.token(api.user(v.players[seat]), { size: 's' }),
        h('span.bl-name', { title: name(seat) }, you ? `${name(seat)} (toi)` : name(seat)),
        seat === v.dealer ? h('span.bl-chip.is-dealer', { title: 'Donneur', 'aria-label': 'Donneur' }, 'D') : null,
        partner ? h('span.bl-chip', 'Partenaire') : null,
        v.taker === seat ? h('span.bl-chip.is-taker', 'A pris') : null),
      r === 0 && v.seat >= 0 ? null : backs(v.counts[seat], r !== 2),
      said ? h('div.bl-say', { 'aria-hidden': 'true' }, said) : null,
      bidText ? h('div.bl-bid', bidText) : null);
  }

  function trickBox() {
    const shown = hold ? hold.trick : { cards: v.trick, winner: null };
    const cards = shown.cards;
    const key = JSON.stringify(cards);
    const fresh = key !== prevTrickKey; // seule une vraie nouvelle carte joue l'animation d'arrivée
    prevTrickKey = key;
    return h('div.bl-trick', { role: 'group', 'aria-label': 'Pli en cours' },
      cards.map((t, i) => faceCard(t.card, `.pos-${rel(t.seat)}${shown.winner === t.seat ? '.is-winner' : ''}${fresh && i === cards.length - 1 ? '.is-new' : ''}`)));
  }

  function bidPanel() {
    const up = v.upcard;
    const myTurn = v.turn === v.seat;
    const first = v.phase === 'bid1';
    const nodes = [];
    nodes.push(h('p.bl-bidtitle', first ? '1er tour' : '2e tour'));
    if (!myTurn) return null; // la ligne d'état dit déjà qui réfléchit
    if (first) {
      nodes.push(h('button.bl-btn.is-main', { type: 'button', onclick: () => play({ type: 'take' }) },
        'Je prends à ', suitIcon(suitOf(up), 20), h('span', SUIT_NAME[suitOf(up)])));
    } else {
      nodes.push(h('div.bl-suits', SUITS.filter((s) => s !== suitOf(up)).map((s) =>
        h('button.bl-btn.is-suit', { type: 'button', 'aria-label': `Atout ${SUIT_NAME[s]}`, onclick: () => play({ type: 'take', suit: s }) },
          suitIcon(s, 26), h('span', SUIT_NAME[s])))));
    }
    nodes.push(h('button.bl-btn', { type: 'button', onclick: () => play({ type: 'pass' }) }, 'Je passe'));
    return h('div.bl-bidbox', nodes);
  }

  function slate() {
    const t0 = myTeam();
    const row = (t) => h(`div.bl-sc${t === t0 && v.seat >= 0 ? '.is-ours' : ''}`,
      h('span.bl-sc-name', teamName(t)),
      h('b.bl-sc-n', String(v.scores[t])),
      h('small.bl-sc-tricks', v.phase === 'play' || v.phase === 'recap' ? `${v.tricks[t]} pli${v.tricks[t] > 1 ? 's' : ''}` : ' '));
    const trumpBox = v.trump
      ? h('div.bl-trump', suitIcon(v.trump, 26), h('span', [h('small', 'Atout'), h('b', SUIT_NAME[v.trump])]))
      : h('div.bl-trump.is-none', h('span', [h('small', 'Atout'), h('b', 'à choisir')]));
    return h('header.bl-slate',
      h('div.bl-scores', row(t0), row(1 - t0)),
      trumpBox,
      h('div.bl-meta', h('span', `Donne ${v.handNo}`), h('span', `${v.target} points`), h('span.bl-clock', { 'aria-hidden': 'true' })));
  }

  // Partie arrêtée en cours de donne (abandon) : pas de bilan, juste le résultat.
  function forfeitPanel() {
    const t0 = myTeam();
    return h('section.bl-recap', { 'aria-label': 'Fin de la partie' },
      h('h2', 'Fin de la partie'),
      h('p.bl-verdict', `${name(v.forfeit)} a quitté la partie : on ne joue pas à la belote à trois, la partie s’arrête.`),
      h('p.bl-final', v.seat >= 0 ? (v.winnerTeam === t0 ? 'Victoire de ton équipe !' : 'L’autre équipe gagne la partie.') : `${teamName(v.winnerTeam)} gagnent la partie.`));
  }

  function recapPanel() {
    if (!v.recap) return forfeitPanel();
    const r = v.recap;
    const t0 = myTeam();
    const teams = [t0, 1 - t0];
    const takerTeam = r.taker % 2;
    const over = v.phase === 'over';
    const verdict = r.capot !== null
      ? `Capot pour ${v.seat >= 0 ? (r.capot === t0 ? 'nous' : 'eux') : teamName(r.capot)} : 252 points !`
      : r.made
        ? `${name(r.taker)} avait pris à ${SUIT_NAME[r.trump]} : contrat rempli.`
        : `${name(r.taker)} avait pris à ${SUIT_NAME[r.trump]} : dedans ! 162 points pour la défense.`;
    const rows = [
      ['Plis', (t) => r.trickPoints[t]],
      ['Dix de der', (t) => (r.lastTrickTeam === t ? 10 : 0)],
      ['Belote-rebelote', (t) => r.belote[t]],
      ['Marqué', (t) => r.gained[t], true],
      ['Total', (t) => v.scores[t], true],
    ];
    const readyCount = v.ready.filter(Boolean).length;
    const iAmReady = v.seat >= 0 && v.ready[v.seat];
    let end = null;
    if (over) {
      end = v.forfeit !== null
        ? h('p.bl-final', `${name(v.forfeit)} a quitté la partie : on ne joue pas à la belote à trois, la partie s’arrête.`)
        : h('p.bl-final', v.seat >= 0 ? (v.winnerTeam === t0 ? 'Victoire de ton équipe !' : 'L’autre équipe gagne la partie.') : `${teamName(v.winnerTeam)} gagnent la partie.`);
    }
    return h('section.bl-recap', { 'aria-label': 'Bilan de la donne' },
      h('h2', over ? 'Fin de la partie' : `Donne ${v.handNo} terminée`),
      h('p.bl-verdict', verdict),
      h('table.bl-tab',
        h('thead', h('tr', h('th', { scope: 'col' }, h('span.sr', 'Détail')), teams.map((t) => h('th', { scope: 'col', class: takerTeam === t ? 'is-taker' : '' }, teamName(t))))),
        h('tbody', rows.map(([label, fn, strong]) => h(`tr${strong ? '.is-strong' : ''}`, h('th', { scope: 'row' }, label), teams.map((t) => h('td', String(fn(t)))))))),
      end,
      over ? null : v.seat >= 0
        ? h('button.bl-btn.is-main', { type: 'button', disabled: iAmReady, onclick: () => play({ type: 'next' }) }, iAmReady ? 'En attente des autres…' : 'Donne suivante')
        : null,
      over ? null : h('p.bl-small', `${readyCount} sur 4 prêts · la suite démarre toute seule dans un instant`));
  }

  // Confettis de victoire : des pastilles de couleur qui tombent (coupées si l'animation est réduite).
  function confetti() {
    const colors = ['#FF2E93', '#FFE93B', '#19D3F3', '#2BE3A4', '#FF7A1A', '#9B5CFF'];
    return h('div.bl-confetti', { 'aria-hidden': 'true' }, Array.from({ length: 24 }, (_, i) => {
      const bit = h('i');
      bit.style.setProperty('--x', `${(i * 97) % 100}%`);
      bit.style.setProperty('--d', `${(i % 9) * 0.18}s`);
      bit.style.setProperty('--c', colors[i % colors.length]);
      bit.style.setProperty('--r', `${(i * 53) % 360}deg`);
      return bit;
    }));
  }

  function statusText() {
    if (v.phase === 'over') return v.forfeit !== null ? 'Partie terminée.' : 'Partie terminée : bravo aux gagnants !';
    if (v.phase === 'recap') return 'Bilan de la donne.';
    const mine = v.turn === v.seat;
    if (v.phase === 'bid1') return mine ? `À toi : prends à ${SUIT_NAME[suitOf(v.upcard)]} ou passe.` : `${name(v.turn)} choisit : prendre ou passer…`;
    if (v.phase === 'bid2') return mine ? 'À toi : choisis l’atout ou passe.' : `${name(v.turn)} choisit l’atout ou passe…`;
    return mine ? `À toi de jouer. ${v.hint}` : `${name(v.turn)} joue…`;
  }

  function tick() {
    const clock = el.querySelector('.bl-clock');
    if (!clock) return;
    const active = v && v.deadline && v.phase !== 'over';
    if (!active) { clock.textContent = ''; return; }
    const left = Math.max(0, Math.ceil((v.deadline - api.now()) / 1000));
    clock.textContent = `${left} s`;
    clock.classList.toggle('is-low', left <= 5);
  }
  const clockTimer = setInterval(tick, 500);

  function render() {
    const focused = document.activeElement?.closest?.('.bl-hand') ? document.activeElement.dataset.card || true : null;
    handFocus = Boolean(focused);
    const holding = Boolean(hold && hold.until > Date.now() && v.trick.length === 0);
    if (!holding) hold = null;
    const mine = v.seat >= 0;
    const playing = v.phase === 'play' && v.turn === v.seat;
    const hand = sortHand(v.hand, v.trump);
    const showRecap = (v.phase === 'recap' || v.phase === 'over') && !holding;

    const center = [];
    if (v.phase === 'bid1' || v.phase === 'bid2') {
      center.push(h('div.bl-up', faceCard(v.upcard, '.is-up'), h('small', 'Retourne')));
    } else {
      center.push(trickBox());
    }

    const felt = h('div.bl-felt',
      h('div.bl-grid',
        seatBadge((mySeat() + 2) % 4),
        seatBadge((mySeat() + 1) % 4),
        h('div.bl-center', center),
        seatBadge((mySeat() + 3) % 4)),
      showRecap ? recapPanel() : null,
      showRecap && v.phase === 'over' && v.forfeit === null && (v.seat < 0 || v.winnerTeam === myTeam()) ? confetti() : null);

    const actions = (v.phase === 'bid1' || v.phase === 'bid2') ? bidPanel() : null;

    const showMe = mine && v.phase !== 'over' && v.phase !== 'recap';
    el.replaceChildren(...[
      slate(),
      felt,
      h('p.bl-status', { 'aria-live': 'polite', role: 'status' }, statusText()),
      showMe || actions ? h('div.bl-row', showMe ? h('div.bl-me', seatBadge(mySeat())) : null, actions) : null,
      h('div.bl-hand', { role: 'group', 'aria-label': 'Ta main', onkeydown: handKeys }, hand.map((c) => cardButton(c, { legal: playing && v.legal.includes(c), interactive: playing }))),
    ].filter(Boolean));
    fitHand();
    tick();
    if (handFocus) {
      const target = typeof focused === 'string' ? el.querySelector(`.bl-hand [data-card="${focused}"]`) : null;
      (target && !target.hasAttribute('tabindex') ? target : el.querySelector('.bl-hand .is-legal'))?.focus({ preventScroll: true });
    }
  }

  // Flèches gauche et droite : passer d'une carte à l'autre.
  function handKeys(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const cards = [...el.querySelectorAll('.bl-hand .bl-card:not([tabindex="-1"])')];
    const i = cards.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    cards[Math.max(0, Math.min(cards.length - 1, i + (e.key === 'ArrowLeft' ? -1 : 1)))].focus();
  }

  // Les cartes de la main se chevauchent juste assez pour tenir en largeur (téléphone compris).
  function fitHand() {
    const handEl = el.querySelector('.bl-hand');
    if (!handEl) return;
    const cards = handEl.children.length;
    const first = handEl.firstElementChild;
    if (!first || cards < 2) { handEl.style.setProperty('--overlap', '0px'); return; }
    const cw = first.getBoundingClientRect().width;
    const avail = handEl.clientWidth - 8;
    const overlap = Math.max(0, Math.min(cw * 0.6, (cw * cards - avail) / (cards - 1)));
    handEl.style.setProperty('--overlap', `${Math.ceil(overlap)}px`);
  }
  const resize = new ResizeObserver(() => fitHand());
  resize.observe(el);

  const off = api.onState((view) => {
    const first = v === null;
    v = view;
    busy = false;
    // Un pli qui vient de se terminer reste affiché un instant.
    const trickKey = view.lastTrick ? JSON.stringify(view.lastTrick) : null;
    if (!first && trickKey && trickKey !== seenTrick && view.trick.length === 0) {
      hold = { trick: view.lastTrick, until: Date.now() + HOLD_MS };
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => { hold = null; if (v) render(); }, HOLD_MS + 20);
    }
    seenTrick = trickKey;
    // Belote, rebelote, redistribution : annoncés à tous.
    const n = view.announce?.n ?? 0;
    if (!first && seenAnnounce !== null && n !== seenAnnounce) {
      if (view.announce.kind === 'redeal') api.toast('Personne n’a pris : on redistribue les cartes.');
      else {
        bubble = { seat: view.announce.seat, text: view.announce.kind === 'belote' ? 'Belote !' : 'Rebelote !', until: Date.now() + BUBBLE_MS };
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(() => { bubble = null; if (v) render(); }, BUBBLE_MS + 20);
      }
    }
    seenAnnounce = n;
    render();
  });

  return () => {
    clearInterval(clockTimer);
    clearTimeout(holdTimer);
    clearTimeout(bubbleTimer);
    resize.disconnect();
    off?.();
  };
}
