// Écran Membres : toute la classe en cartes, en ligne d'abord, avec une recherche par pseudo.
// Avec des rôles, rangée comme sur Discord : un groupe par rôle (le premier rôle de chacun), puis les autres membres.
import { h, changedOnly, icon, token, count, keepFocus, staffTag, colorOf } from '../dom.js';
import { state, sortedUsers, rolesOf, roleColor } from '../store.js';
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
  grid = h('div.member-groups');
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
  counter.textContent = q ? count(list.length, 'résultat', 'résultats') : `${count(all.length, 'membre', 'membres')}, dont ${online} en ligne`;

  if (!list.length) {
    grid.replaceChildren(h('p.member-empty', `Personne ne s’appelle « ${query.trim()} ».`));
    return;
  }
  const card = (u) => {
    const isOn = state.online.has(u.id);
    const me = u.id === state.me.id;
    return h('li', h('button.member-card', {
      type: 'button',
      className: `member-card${isOn ? '' : ' offline'}`,
      onclick: () => openProfile(u.id),
    },
    token(u, { size: 'l', online: isOn }),
    h('span.member-name', { style: roleColor(u) ? `color:${colorOf(roleColor(u))}` : null }, u.pseudo, me ? h('span.tag-me', 'toi') : null, staffTag(u)),
    isOn ? h('span.sr-only', 'En ligne') : h('span.member-status', 'Hors ligne'), // la pastille le dit déjà : on n'écrit que l'exception
    h('span.member-bio', u.bio || ' ')));
  };
  const groups = state.roles.map((r) => ({ title: r.name, color: r.color, people: list.filter((u) => rolesOf(u)[0]?.id === r.id) }));
  groups.push({ title: 'Membres', people: list.filter((u) => !rolesOf(u).length) });
  const titled = groups.some((g) => g.color && g.people.length); // des titres seulement si quelqu'un a un rôle
  keepFocus(grid, () => changedOnly(grid).replaceChildren(...(titled
    ? groups.filter((g) => g.people.length).map((g) => h('section.member-group',
      h('h2.member-group-title', { style: g.color ? `--rc:${colorOf(g.color)}` : null }, g.title, h('span', ` — ${g.people.length}`)),
      h('ul.member-grid', g.people.map(card))))
    : [h('ul.member-grid', list.map(card))])));
}
