// Dominos côté navigateur : des dominos acidulés sur une plage tropicale pop. Chaque moitié de domino a la couleur de son
// chiffre, la chaîne se range en serpentin pour tenir dans l'écran, les doubles sont posés en travers. Les coups possibles
// viennent de la vue (view().playable) : le client ne propose que ce que les règles autorisent.

const NS = 'http://www.w3.org/2000/svg';
const SEAT_COLORS = ['pink', 'lemon', 'mint', 'cyan'];
const PIP_CELLS = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [1, 3], [3, 1], [3, 3]],
  5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
  6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]],
};

const parseTile = (id) => id.split('-').map(Number);

function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const kid of kids.flat()) if (kid) el.append(kid);
  return el;
}

// Décor de plage (soleil, palmes), purement décoratif.
function frond(x, y, scale, flip) {
  const leaf = (angle) => svg('path', {
    d: 'M0 0C30-34 90-40 150 6 108 0 56 10 0 0Z', fill: '#2BE3A4', stroke: '#1A0B3B', 'stroke-width': 4, 'stroke-linejoin': 'round',
    transform: `rotate(${angle})`,
  });
  return svg('g', { transform: `translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})` },
    svg('path', { d: 'M-8 160Q0 70 0 0', fill: 'none', stroke: '#FF8A1F', 'stroke-width': 14, 'stroke-linecap': 'round' }),
    svg('path', { d: 'M-8 160Q0 70 0 0', fill: 'none', stroke: '#1A0B3B', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-dasharray': '2 18' }),
    [-170, -140, -105, -70, -35, -5].map(leaf),
    svg('circle', { cx: 0, cy: 4, r: 9, fill: '#FFE93B', stroke: '#1A0B3B', 'stroke-width': 4 }));
}

function decor() {
  return svg('svg', { class: 'dm-deco', viewBox: '0 0 400 300', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true', focusable: 'false' },
    svg('circle', { cx: 330, cy: 70, r: 92, fill: 'rgb(255 255 255 / 0.35)' }),
    svg('circle', { cx: 330, cy: 70, r: 62, fill: '#FFE93B', stroke: '#1A0B3B', 'stroke-width': 5 }),
    svg('path', { d: 'M0 262q25-16 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0V300H0z', fill: '#19D3F3', stroke: '#1A0B3B', 'stroke-width': 4 }),
    frond(34, 290, 0.9, false),
    frond(372, 292, 0.8, true));
}

export function mount(root, api) {
  const { h } = api;
  const el = h('div.dm');
  root.append(el);
  let v = null;
  let busy = false;
  let selected = null; // domino choisi quand il peut se poser aux deux bouts
  let seenMove = -1;
  let animTile = null; // le domino qui vient d'être posé (animation d'arrivée)
  let lastSize = '';

  const name = (seat) => api.user(v.players[seat]).pseudo;
  const color = (seat) => SEAT_COLORS[seat % 4];
  const active = () => v.out.filter((o) => !o).length;

  function play(action) {
    if (busy) return;
    busy = true;
    api.sendMove(action).catch(() => { busy = false; });
  }

  // ——— Dominos ———

  // Un domino [a, b] : chaque moitié a la couleur de son chiffre. vertical : debout (les doubles, la main).
  function tile(a, b, { vertical = false, size = null } = {}) {
    const half = (n) => h(`span.dm-half.n${n}`,
      Array.from({ length: n }, (_, i) => {
        const [r, c] = PIP_CELLS[n][i];
        const p = h('i.dm-pip');
        p.style.gridArea = `${r} / ${c}`;
        return p;
      }));
    const t = h(`span.dm-tile.${vertical ? 'is-v' : 'is-h'}`, half(a), half(b));
    if (size) t.style.setProperty('--s', `${size}px`);
    return t;
  }

  function handTile(id, p) {
    const [a, b] = parseTile(id);
    const playable = Boolean(p);
    const mineTurn = v.phase === 'play' && v.turn === v.seat;
    const cls = `dm-hand-tile${mineTurn ? (playable ? ' is-ok' : ' is-no') : ' is-idle'}${selected === id ? ' is-picked' : ''}`;
    const btn = h('button', {
      type: 'button',
      class: cls,
      'data-tile': id,
      'aria-label': `Domino ${a === 0 ? 'blanc' : a} et ${b === 0 ? 'blanc' : b}${mineTurn && !playable ? ', ne se pose pas' : ''}`,
      'aria-pressed': selected === id ? 'true' : 'false',
      'aria-disabled': mineTurn ? String(!playable) : 'true',
      onclick: () => {
        if (!mineTurn) return;
        if (!playable) { api.toast(`Ce domino ne se pose pas : les bouts sont ${v.ends[0]} et ${v.ends[1]}.`); return; }
        const [l, r] = v.ends;
        if (p.sides.length === 1) play({ type: 'play', tile: id, side: p.sides[0] });
        else if (l === r) play({ type: 'play', tile: id, side: 'left' });
        else { selected = selected === id ? null : id; render(); }
      },
    }, tile(a, b, { vertical: true }));
    if (!mineTurn) btn.tabIndex = -1;
    return btn;
  }

  // ——— La chaîne en serpentin ———

  // Choisit la plus grande taille de domino pour laquelle la chaîne tient dans W × H, et range les dominos en rangées.
  function plan(chain, W, H) {
    let best = null;
    for (let s = W > 700 ? 64 : 46; s >= 12; s -= 2) {
      const gap = Math.max(3, Math.round(s * 0.14));
      const rows = [];
      let cur = [];
      let w = 0;
      for (const [a, b] of chain) {
        const tw = a === b ? s : 2 * s;
        if (cur.length && w + gap + tw > W) { rows.push(cur); cur = []; w = 0; }
        w += (cur.length ? gap : 0) + tw;
        cur.push([a, b]);
      }
      if (cur.length) rows.push(cur);
      const heights = rows.map((r) => (r.some(([a, b]) => a === b) ? 2 * s : s));
      const total = heights.reduce((x, y) => x + y, 0) + (rows.length - 1) * (gap + 8);
      best = { s, gap, rows, heights };
      if (total <= H) return best;
    }
    return best;
  }

  function layoutChain() {
    const area = el.querySelector('.dm-chain');
    if (!area || !v || v.phase === 'recap' || v.phase === 'over') return;
    const W = area.clientWidth;
    const H = area.clientHeight;
    if (W < 40 || H < 40) return;
    const { s, gap, rows, heights } = plan(v.chain, W, H);
    area.setAttribute('aria-label', `La chaîne : ${v.chain.length} domino${v.chain.length > 1 ? 's' : ''}, bouts ${v.ends[0]} et ${v.ends[1]}`);
    area.style.setProperty('--s', `${s}px`);
    area.style.setProperty('--gap', `${gap}px`);
    const sides = selected ? v.playable.find((p) => p.tile === selected)?.sides || [] : [];
    let index = 0;
    const last = v.chain.length - 1;
    const maxW = Math.max(...rows.map((row) => row.reduce((w, [a, b]) => w + (a === b ? s : 2 * s), 0) + gap * (row.length - 1)));
    area.replaceChildren(h('div.dm-snake', { style: `width:${maxW}px` }, rows.map((row, ri) => h(`div.dm-row${ri % 2 ? '.is-rev' : ''}`, { style: `height:${heights[ri]}px` },
      row.map(([a, b]) => {
        const i = index++;
        const t = tile(a, b, { vertical: a === b });
        t.classList.add('is-chain');
        const id = a <= b ? `${a}-${b}` : `${b}-${a}`;
        const slot = h('span.dm-slot', t);
        if (animTile === id && i === (v.lastMove.side === 'left' ? 0 : last)) slot.classList.add('is-new');
        if (v.lastMove.kind === 'play' && v.lastMove.tile === id) slot.classList.add('is-last'); // le dernier domino posé reste repéré
        if (v.chain.length > 1 && i === 0) slot.append(h('b.dm-flag', 'Début'));
        if (v.chain.length > 1 && i === last) slot.append(h('b.dm-flag', 'Fin'));
        if ((i === 0 && sides.includes('left')) || (i === last && sides.includes('right'))) t.classList.add('is-pick');
        return slot;
      })))));
  }

  // ——— Pièces de l'écran ———

  function scoreboard() {
    return h('div.dm-scores', v.players.map((_, seat) => {
      const turnNow = v.phase === 'play' && v.turn === seat;
      const me = seat === v.seat;
      return h(`div.dm-player.c-${color(seat)}${turnNow ? '.is-turn' : ''}${v.out[seat] ? '.is-out' : ''}`,
        api.token(api.user(v.players[seat]), { size: 's' }),
        h('span.dm-who', h('b.dm-name', { title: name(seat) }, name(seat)),
          h('small', v.out[seat] ? 'est parti' : `${me ? 'toi · ' : ''}${v.counts[seat]} domino${v.counts[seat] > 1 ? 's' : ''}`)),
        h('b.dm-pts', String(v.scores[seat])));
    }));
  }

  function statusText() {
    if (v.phase === 'over') return 'Partie terminée.';
    if (v.phase === 'recap') return 'Bilan de la manche.';
    const mine = v.turn === v.seat;
    if (!mine) {
      const m = v.lastMove;
      if (m && m.kind === 'draw' && m.seat === v.turn) return `${name(v.turn)} pioche ${m.count} domino${m.count > 1 ? 's' : ''}…`;
      return `${name(v.turn)} réfléchit…`;
    }
    if (v.playable.length) return selected ? 'Où le poser ?' : 'À toi : pose un domino qui brille.';
    if (v.canDraw) return 'Rien à poser : pioche !';
    return v.draw ? 'Rien à poser et la pioche est vide : passe ton tour.' : 'Rien à poser : passe ton tour (pas de pioche à quatre).';
  }

  function actionBar() {
    if (v.phase !== 'play' || v.turn !== v.seat) return null;
    const sel = selected ? v.playable.find((p) => p.tile === selected) : null;
    if (sel) {
      return h('div.dm-actions', { role: 'group', 'aria-label': `Où poser le domino ${selected} ?` },
        h('button.dm-btn', { type: 'button', onclick: () => play({ type: 'play', tile: selected, side: 'left' }) }, `Début · ${v.ends[0]}`),
        h('button.dm-btn', { type: 'button', onclick: () => play({ type: 'play', tile: selected, side: 'right' }) }, `Fin · ${v.ends[1]}`),
        h('button.dm-btn.is-ghost', { type: 'button', onclick: () => { selected = null; render(); } }, 'Annuler'));
    }
    if (v.canDraw) return h('div.dm-actions', h('button.dm-btn.is-main', { type: 'button', onclick: () => play({ type: 'draw' }) }, `Piocher (${v.stockCount})`));
    if (v.mustPass) return h('div.dm-actions', h('button.dm-btn.is-main', { type: 'button', onclick: () => play({ type: 'pass' }) }, 'Je passe'));
    return null;
  }

  // Partie arrêtée en cours de manche (abandon) : pas de bilan, juste le résultat.
  function forfeitPanel() {
    return h('section.dm-recap', { 'aria-label': 'Fin de la partie' },
      h('h2', 'Fin de la partie'),
      h('p.dm-verdict', `${name(v.forfeit)} a quitté la partie.`),
      h('p.dm-final', v.winner === v.seat ? 'Tu gagnes la partie !' : `${name(v.winner)} gagne la partie !`));
  }

  function recapPanel() {
    if (!v.recap) return forfeitPanel();
    const r = v.recap;
    const over = v.phase === 'over';
    let verdict;
    if (r.kind === 'domino') verdict = `${name(r.winner)} a posé son dernier domino : +${r.gained[r.winner]} points.`;
    else if (r.winner !== null) verdict = `Manche bloquée : ${name(r.winner)} a le moins de points et marque +${r.gained[r.winner]}.`;
    else verdict = 'Manche bloquée, égalité au plus petit total : personne ne marque.';
    let end = null;
    if (over) {
      end = v.forfeit !== null && v.out.filter((o) => !o).length < 2
        ? h('p.dm-final', `${name(v.forfeit)} a quitté la partie : ${v.winner === v.seat ? 'tu gagnes' : `${name(v.winner)} gagne`} !`)
        : h('p.dm-final', v.winner === v.seat ? 'Tu gagnes la partie !' : `${name(v.winner)} gagne la partie !`);
    }
    const ready = v.ready.filter(Boolean).length;
    const iAmReady = v.seat >= 0 && v.ready[v.seat];
    const seats = v.players.map((_, i) => i).filter((i) => !v.out[i] || r.hands[i].length);
    return h('section.dm-recap', { 'aria-label': 'Bilan de la manche' },
      h('h2', over ? 'Fin de la partie' : `Manche ${v.handNo} terminée`),
      h('p.dm-verdict', verdict),
      h('table.dm-tab',
        h('thead', h('tr', ['Joueur', 'Reste', 'Valeur', 'Marqué', 'Total'].map((c) => h('th', { scope: 'col' }, c)))),
        h('tbody', seats.map((i) => h(`tr.c-${color(i)}${r.winner === i ? '.is-win' : ''}`,
          h('th', { scope: 'row' }, name(i)),
          h('td.dm-left', r.hands[i].length ? r.hands[i].map((id) => tile(...parseTile(id), { size: 16 })) : h('span', 'aucun')),
          h('td', String(r.points[i])),
          h('td', r.gained[i] ? `+${r.gained[i]}` : '0'),
          h('td.dm-total', String(v.scores[i])))))),
      end,
      over || v.seat < 0 ? null : h('button.dm-btn.is-main', { type: 'button', disabled: iAmReady, onclick: () => play({ type: 'next' }) }, iAmReady ? 'En attente des autres…' : 'Manche suivante'),
      over ? null : h('p.dm-small', `${ready} sur ${active()} prêts`));
  }

  function confetti() {
    const colors = ['#FF2E93', '#FFE93B', '#19D3F3', '#2BE3A4', '#FF7A1A', '#9B5CFF'];
    return h('div.dm-confetti', { 'aria-hidden': 'true' }, Array.from({ length: 24 }, (_, i) => {
      const bit = h('i');
      bit.style.setProperty('--x', `${(i * 97) % 100}%`);
      bit.style.setProperty('--d', `${(i % 9) * 0.18}s`);
      bit.style.setProperty('--c', colors[i % colors.length]);
      bit.style.setProperty('--r', `${(i * 53) % 360}deg`);
      return bit;
    }));
  }

  function tick() {
    const clock = el.querySelector('.dm-clock');
    if (!clock) return;
    if (!v || !v.deadline || v.phase === 'over') { clock.textContent = ''; return; }
    const left = Math.max(0, Math.ceil((v.deadline - api.now()) / 1000));
    clock.textContent = `${left} s`;
    clock.classList.toggle('is-low', left <= 5);
  }
  const clockTimer = setInterval(tick, 500);

  function render() {
    const showRecap = v.phase === 'recap' || v.phase === 'over';
    const mine = v.seat >= 0;
    const hand = v.hand;
    const byTile = new Map(v.playable.map((p) => [p.tile, p]));
    if (selected && !byTile.has(selected)) selected = null;
    const focused = document.activeElement?.closest?.('.dm-hand') ? document.activeElement.dataset.tile || true : null;

    el.replaceChildren(
      decor(),
      h('div.dm-body',
        h('header.dm-head',
          scoreboard(),
          h('div.dm-meta',
            h('span', `Manche ${v.handNo}`), h('span', `${v.target} points`),
            v.draw && !showRecap ? h('span', `Pioche : ${v.stockCount}`) : null,
            h('span.dm-clock', { 'aria-hidden': 'true' }))),
        h('div.dm-beach',
          showRecap ? recapPanel() : h('div.dm-chain', { 'aria-label': 'La chaîne de dominos', role: 'img' }),
          showRecap && v.phase === 'over' && (v.seat < 0 || v.winner === v.seat) ? confetti() : null),
        h('p.dm-status', { 'aria-live': 'polite', role: 'status' }, statusText()),
        actionBar(),
        mine && !showRecap ? h(`div.dm-hand${hand.length > 7 ? '.is-many' : ''}`, { role: 'group', 'aria-label': 'Ta main', onkeydown: handKeys }, hand.map((id) => handTile(id, byTile.get(id)))) : null));
    layoutChain();
    tick();
    if (focused) {
      const target = typeof focused === 'string' ? el.querySelector(`.dm-hand [data-tile="${focused}"]`) : null;
      (target && !target.hasAttribute('tabindex') ? target : el.querySelector('.dm-hand .is-ok'))?.focus({ preventScroll: true });
    }
  }

  function handKeys(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const items = [...el.querySelectorAll('.dm-hand .dm-hand-tile:not([tabindex="-1"])')];
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowLeft' ? -1 : 1)))].focus();
  }

  const resize = new ResizeObserver(() => {
    const key = `${el.clientWidth}x${el.clientHeight}`;
    if (key !== lastSize) { lastSize = key; layoutChain(); }
  });
  resize.observe(el);

  const off = api.onState((view) => {
    const first = v === null;
    v = view;
    busy = false;
    if (view.lastMove.n !== seenMove) {
      animTile = !first && view.lastMove.kind === 'play' ? view.lastMove.tile : null;
      seenMove = view.lastMove.n;
      selected = null;
    }
    render();
  });

  return () => {
    clearInterval(clockTimer);
    resize.disconnect();
    off?.();
  };
}
