// Écran Jouer : les jeux de la classe (ouvrir une table) et les tables en cours (rejoindre, reprendre, regarder).
import { h, icon, token, toast, count, gameLogo } from '../dom.js';
import { call } from '../net.js';
import { state, go, gameOf, myTurnTables } from '../store.js';

let container = null;
let family = 'tous'; // famille de jeux (champ family de game.json)
let filter = 'tous'; // combien on est : tous, 2, petit (3 à 6), grand (7 et plus)

const FAMILIES = [
  { key: 'tous', label: 'Tous' },
  { key: 'plateau', label: 'Plateau et dés' },
  { key: 'cartes', label: 'Cartes' },
  { key: 'bluff', label: 'Bluff' },
  { key: 'ambiance', label: 'Ambiance' },
];

const FILTERS = [
  { key: 'tous', label: 'Tous', test: () => true },
  { key: 'duel', label: 'À deux', test: (g) => g.minPlayers <= 2 && g.maxPlayers >= 2 },
  { key: 'petit', label: '3 à 6', test: (g) => g.maxPlayers >= 3 && g.minPlayers <= 6 },
  { key: 'grand', label: '7 et plus', test: (g) => g.maxPlayers >= 7 },
];

export function leave() {
  container = null;
}

const playersLabel = (g) => (g.minPlayers === g.maxPlayers ? `${g.minPlayers} joueurs` : `${g.minPlayers} à ${g.maxPlayers} joueurs`);

async function openTable(game, btn) {
  btn.disabled = true;
  try {
    const { id } = await call(state.socket, 'table:create', { game: game.id });
    go(`#/t/${id}`);
  } catch (err) {
    toast(err.message, { error: true });
    btn.disabled = false;
  }
}

function gameCard(g) {
  const btn = h('button.btn.btn-sm.btn-dark.game-open', {
    type: 'button',
    'aria-label': `Ouvrir une table de ${g.name}`,
    onclick: (e) => openTable(g, e.currentTarget),
  }, icon('plus'), h('span', 'Ouvrir une table'));
  return h('article.game-card', { style: `--g:${g.color};--g-ink:${g.ink}` },
    gameLogo(g),
    h('div.game-card-body',
      h('h2', g.name),
      h('p.game-meta', playersLabel(g), g.duration ? `, ${g.duration}` : ''),
      h('p.game-tagline', g.tagline)),
    btn);
}

function statusLabel(t, g) {
  if (t.status === 'lobby') return `Salon · ${t.seats.length}/${g.maxPlayers}`;
  if (t.status === 'playing') return t.turn.includes(state.me.id) ? 'À toi de jouer' : 'En cours';
  return 'Terminée';
}

function tableRow(t) {
  const g = gameOf(t.game);
  if (!g) return null;
  const host = state.users.get(t.hostId);
  const seated = t.seats.includes(state.me.id);
  const action = t.status === 'lobby'
    ? (seated ? 'Ouvrir' : t.seats.length < g.maxPlayers ? 'Rejoindre' : 'Regarder')
    : seated && t.status === 'playing' ? 'Reprendre' : 'Regarder';
  const mine = t.status === 'playing' && t.turn.includes(state.me.id);
  return h('li', h(`a.table-row${mine ? '.is-turn' : ''}`, { href: `#/t/${t.id}`, style: `--g:${g.color};--g-ink:${g.ink}` },
    h('span.table-chip', gameLogo(g)),
    h('span.table-info',
      h('b', g.name),
      h('span', host ? `Table de ${host.pseudo}` : 'Table', ' · ', statusLabel(t, g))),
    h('span.table-seats', { 'aria-label': count(t.seats.length, 'joueur', 'joueurs') },
      t.seats.slice(0, 5).map((id) => token(state.users.get(id), { size: 's' })),
      t.seats.length > 5 ? h('span.more', `+${t.seats.length - 5}`) : null),
    h('span.table-action', action)));
}

export function render(el) {
  container = el;
  const tables = [...state.tables].sort((a, b) => b.updatedAt - a.updatedAt);
  const mineFirst = (list) => [...list.filter((t) => t.seats.includes(state.me.id)), ...list.filter((t) => !t.seats.includes(state.me.id))];
  const open = mineFirst(tables.filter((t) => t.status === 'lobby'));
  const playing = mineFirst(tables.filter((t) => t.status === 'playing'));
  const over = tables.filter((t) => t.status === 'over' && t.seats.includes(state.me.id)).slice(0, 6);
  const turns = myTurnTables().length;

  const section = (title, list, empty) => h('section.table-section',
    h('h2.section-title', title, list.length ? h('span.section-count', String(list.length)) : null),
    list.length ? h('ul.table-list', list.map(tableRow)) : h('p.section-empty', empty));

  const test = FILTERS.find((f) => f.key === filter).test;
  const shown = state.games.filter((g) => test(g) && (family === 'tous' || g.family === family));
  const chips = (label, list, value, set) => h('div.filter-chips', { role: 'radiogroup', 'aria-label': label }, list.map((f) => h('button.chip', {
    type: 'button',
    role: 'radio',
    'aria-checked': String(f.key === value),
    onclick: () => {
      set(f.key);
      render(el);
    },
  }, f.label)));
  const filters = h('div.games-filters',
    chips('Type de jeu', FAMILIES, family, (k) => { family = k; }),
    chips('Nombre de joueurs', FILTERS.map((f) => (f.key === 'tous' ? { ...f, label: 'Tous joueurs' } : f)), filter, (k) => { filter = k; }));

  el.replaceChildren(h('div.page',
    h('div.view-head.page-head',
      h('div', h('h1', 'Jouer'),
        h('p.view-sub', turns ? `C’est à toi de jouer sur ${count(turns, 'table', 'tables')}.` : 'Ouvre une table, invite la classe, joue en direct.'))),
    open.length || playing.length ? h('div.tables-cols',
      section('Salons ouverts', open, 'Aucun salon ouvert pour l’instant.'),
      section('Parties en cours', playing, 'Aucune partie en cours.')) : null,
    h('div.games-head', h('h2.section-title', 'Les jeux', h('span.section-count', String(shown.length))), filters),
    shown.length
      ? h('div.game-grid', shown.map(gameCard))
      : h('p.section-empty', 'Aucun jeu ne correspond à ces deux filtres. Essaie un autre nombre de joueurs.'),
    over.length ? section('Tes dernières parties', over, '') : null));
}

// La liste des tables a changé : on redessine si l'écran est ouvert.
export function refresh() {
  if (container?.isConnected) render(container);
}
