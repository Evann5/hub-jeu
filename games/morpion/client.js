// Morpion côté navigateur : l'affichage et les clics. Le hub fournit api (voir docs/integration.md §8) :
// api.onState(cb) donne l'état vu par ce joueur, api.sendMove(action) joue un coup, api.h crée des éléments.

const NS = 'http://www.w3.org/2000/svg';

// Les deux signes sont dessinés (traits épais, bouts ronds), pas écrits : même épaisseur, même poids.
function svg(kind) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 100 100');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', `mp-glyph ${kind === 0 ? 'is-x' : 'is-o'}`);
  const add = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.setAttribute('pathLength', '1');
    s.append(e);
  };
  if (kind === 0) {
    add('path', { d: 'M26 26L74 74' });
    add('path', { d: 'M74 26L26 74' });
  } else {
    add('circle', { cx: 50, cy: 50, r: 26 });
  }
  return s;
}

export function mount(root, api) {
  const { h } = api;
  const cells = Array.from({ length: 9 }, (_, i) => {
    const ghost = h('span.mp-ghost', { 'aria-hidden': 'true' });
    const mark = h('span.mp-markslot');
    return h('button.mp-cell', {
      type: 'button',
      onclick: () => api.sendMove({ cell: i }).catch(() => {}),
    }, ghost, mark);
  });
  const status = h('p.mp-status', { 'aria-live': 'polite' });
  const players = h('div.mp-players');
  const board = h('div.mp-board', { role: 'group', 'aria-label': 'Grille du morpion' }, cells);
  root.append(h('div.mp', players, board, status));

  let prev = null; // grille déjà dessinée : seul le signe nouveau s'anime
  let last = -1;

  api.onState((s, info) => {
    const myTurn = info.turn.includes(api.me.id);
    const mySeat = s.players.indexOf(api.me.id);
    players.replaceChildren(...s.players.map((id, seat) => {
      const won = s.winner === id;
      return h(`div.mp-player.p${seat}${s.turn === seat && !info.over ? '.is-turn' : ''}${won ? '.is-won' : ''}`,
        h('span.mp-chip', svg(seat)),
        api.token(api.user(id), { size: 's' }),
        h('span.mp-name', h('span.mp-pseudo', api.user(id).pseudo), id === api.me.id ? h('small', 'toi') : null));
    }));
    if (prev && s.board.some((v, i) => v !== prev[i])) last = s.board.findIndex((v, i) => v !== null && v !== prev[i]);
    else if (!prev) last = -1;
    s.board.forEach((v, i) => {
      const c = cells[i];
      const slot = c.lastElementChild;
      if (v === null) slot.replaceChildren();
      else if (prev?.[i] !== v || !slot.firstChild) slot.replaceChildren(svg(v));
      c.className = `mp-cell${v === null ? '' : v === 0 ? ' is-x' : ' is-o'}${s.line?.includes(i) ? ' is-win' : ''}${i === last && prev ? ' is-new' : ''}`;
      if (s.line && !s.line.includes(i)) c.classList.add('is-dim');
      const ok = myTurn && v === null;
      c.disabled = !ok;
      c.firstChild.replaceChildren(...(ok && mySeat >= 0 ? [svg(mySeat)] : []));
      c.setAttribute('aria-label', `Case ${i + 1}${v === null ? ', libre' : `, ${v === 0 ? 'croix' : 'rond'}`}`);
    });
    prev = s.board.slice();
    const name = (id) => (id === api.me.id ? 'Tu' : api.user(id).pseudo);
    status.textContent = s.forfeit ? `${api.user(s.forfeit).pseudo} a abandonné. ${name(s.winner)} ${s.winner === api.me.id ? 'gagnes' : 'gagne'} !`
      : s.winner ? `${name(s.winner)} ${s.winner === api.me.id ? 'gagnes' : 'gagne'} !`
        : s.draw ? 'Match nul.'
          : myTurn ? 'À toi : choisis une case.'
            : info.isPlayer ? `${api.user(s.players[s.turn]).pseudo} réfléchit…`
              : `À ${api.user(s.players[s.turn]).pseudo} de jouer.`;
  });
}
