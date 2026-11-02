// Morpion côté navigateur : l'affichage et les clics. Le hub fournit api (voir docs/integration.md §8) :
// api.onState(cb) donne l'état vu par ce joueur, api.sendMove(action) joue un coup, api.h crée des éléments.

export function mount(root, api) {
  const { h } = api;
  const cells = Array.from({ length: 9 }, (_, i) => h('button.mp-cell', {
    type: 'button',
    onclick: () => api.sendMove({ cell: i }).catch(() => {}),
  }));
  const status = h('p.mp-status', { 'aria-live': 'polite' });
  const players = h('div.mp-players');
  root.append(h('div.mp', players, h('div.mp-board', { role: 'grid', 'aria-label': 'Grille du morpion' }, cells), status));

  const mark = (n) => (n === 0 ? '✕' : '◯');

  api.onState((s, info) => {
    const myTurn = info.turn.includes(api.me.id);
    players.replaceChildren(...s.players.map((id, seat) => h(`div.mp-player${s.turn === seat && !info.over ? '.is-turn' : ''}`,
      h('span.mp-mark', mark(seat)),
      api.token(api.user(id), { size: 's' }),
      h('span', api.user(id).pseudo))));
    s.board.forEach((v, i) => {
      const c = cells[i];
      c.textContent = v === null ? '' : mark(v);
      c.className = `mp-cell${v === null ? '' : v === 0 ? ' is-x' : ' is-o'}${s.line?.includes(i) ? ' is-win' : ''}`;
      c.disabled = !myTurn || v !== null;
      c.setAttribute('aria-label', `Case ${i + 1}${v === null ? ', libre' : `, ${v === 0 ? 'croix' : 'rond'}`}`);
    });
    const name = (id) => (id === api.me.id ? 'Tu' : api.user(id).pseudo);
    status.textContent = s.forfeit ? `${api.user(s.forfeit).pseudo} a abandonné. ${name(s.winner)} ${s.winner === api.me.id ? 'gagnes' : 'gagne'} !`
      : s.winner ? `${name(s.winner)} ${s.winner === api.me.id ? 'gagnes' : 'gagne'} !`
        : s.draw ? 'Match nul.'
          : myTurn ? 'À toi : choisis une case.'
            : `${api.user(s.players[s.turn]).pseudo} réfléchit…`;
  });
}
