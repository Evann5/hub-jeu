// Écran Membres : toute la classe en cartes, en ligne d'abord, avec une recherche par pseudo.
import { h, icon, token, count } from '../dom.js';
import { state, sortedUsers } from '../store.js';
import { openProfile } from '../dialogs.js';

let query = '';
let grid = null;
let counter = null;

export function leave() {
  grid = null;
}

export function render(container) {
  const search = h('input.input.search-input', {
    type: 'search',
    name: 'member_search',
    placeholder: 'Chercher un pseudo',
    'aria-label': 'Chercher un membre',
    autocomplete: 'off',
    spellcheck: false,
    value: query,
  });
  search.addEventListener('input', () => {
    query = search.value;
    renderGrid();
  });
  grid = h('ul.member-grid');
  counter = h('p.view-sub', { 'aria-live': 'polite' });
  container.replaceChildren(h('div.page',
    h('div.view-head.page-head',
      h('div', h('h1', 'Membres'), counter),
      h('label.search', icon('search'), search)),
    grid));
  renderGrid();
}

export function renderGrid() {
  if (!grid) return;
  const all = sortedUsers();
  const q = query.trim().toLocaleLowerCase('fr');
  const list = q ? all.filter((u) => u.pseudo.toLocaleLowerCase('fr').includes(q)) : all;
  const online = all.filter((u) => state.online.has(u.id)).length;
  counter.textContent = `${count(all.length, 'membre', 'membres')}, dont ${online} en ligne`;

  if (!list.length) {
    grid.replaceChildren(h('li.member-empty', `Personne ne s’appelle « ${query.trim()} ».`));
    return;
  }
  grid.replaceChildren(...list.map((u) => {
    const isOn = state.online.has(u.id);
    const me = u.id === state.me.id;
    return h('li', h('button.member-card', {
      type: 'button',
      className: `member-card${isOn ? '' : ' offline'}`,
      onclick: () => openProfile(u.id),
    },
    token(u, { size: 'l', online: isOn }),
    h('span.member-name', u.pseudo, me ? h('span.tag-me', 'toi') : null, u.role === 'admin' ? h('span.tag-admin', 'admin') : null),
    h('span.member-status', isOn ? 'En ligne' : 'Hors ligne'),
    h('span.member-bio', u.bio || ' ')));
  }));
}
