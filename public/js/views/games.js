// Écran Jouer : les jeux de la classe (ouvrir une table) et les tables en cours (rejoindre, reprendre, regarder).
import { h, icon, token, count, gameLogo, keepFocus, arrowKeys } from '../dom.js';
import { call } from '../net.js';
import { modal } from '../dialogs.js';
import { wantJoin } from './table.js';
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

// La fiche d'un jeu : on voit de quoi il s'agit et qui attend déjà, avant d'ouvrir une table visible par toute la classe.
function openGameSheet(g) {
  const waiting = state.tables.filter((t) => t.game === g.id && t.status === 'lobby');
  const problem = h('p.form-error', { role: 'alert', hidden: true });
  const open = h('button.btn', {
    type: 'button',
    onclick: async () => {
      open.disabled = true;
      problem.hidden = true;
      try {
        const { id } = await call(state.socket, 'table:create', { game: g.id });
        dlg.close();
        go(`#/t/${id}`);
      } catch (err) {
        problem.textContent = err.message; // dans la fenêtre : une notification passerait dessous
        problem.hidden = false;
        open.disabled = false;
      }
    },
  }, icon('plus'), 'Créer une partie');
  const dlg = modal(g.name,
    h('div.game-sheet', { 'data-game': g.id, style: `--g:${g.color};--g-ink:${g.ink}` },
      gameLogo(g),
      h('div',
        h('p.game-meta', playersLabel(g), g.duration ? `, ${g.duration}` : ''),
        h('p.game-sheet-text', g.description || g.tagline))),
    g.how?.length ? h('details.game-sheet-how', h('summary', 'Comment on joue ?'), h('ol.how', g.how.map((line) => h('li', line)))) : null,
    waiting.length ? h('div.game-sheet-tables',
      h('h3', count(waiting.length, 'partie attend', 'parties attendent'), ' des joueurs'),
      h('ul.table-list', waiting.map((t) => h('li', h('a.game-sheet-table', { href: `#/t/${t.id}`, onclick: () => { if (!t.seats.includes(state.me.id)) wantJoin(t.id); dlg.close(); } },
        h('span', `Partie de ${state.users.get(t.hostId)?.pseudo ?? '…'}, ${t.seats.length}/${g.maxPlayers}`),
        h('b', t.seats.includes(state.me.id) ? 'Y retourner' : 'Rejoindre')))))) : null,
    problem,
    h('div.dlg-actions', h('button.btn.btn-ghost', { type: 'button', onclick: () => dlg.close() }, 'Annuler'), open));
  dlg.querySelector('.dlg-actions .btn:last-child').focus();
}

function gameCard(g) {
  const btn = h('button.btn.btn-sm.btn-dark.game-open', {
    type: 'button',
    'aria-label': `Jouer à ${g.name}`,
    onclick: () => openGameSheet(g),
  }, 'Jouer');
  return h('article.game-card', { style: `--g:${g.color};--g-ink:${g.ink}`, onclick: (e) => { if (!e.target.closest('button')) openGameSheet(g); } }, // le bouton reste l'accès au clavier
    gameLogo(g),
    h('div.game-card-body',
      h('h3', g.name),
      h('p.game-meta', playersLabel(g), g.duration ? `, ${g.duration}` : ''),
      h('p.game-tagline', g.tagline)),
    btn);
}

// Le jeu phare de la classe : une grande carte, avant la liste.
function featuredCard(g) {
  const live = state.tables.filter((t) => t.game === g.id && t.status !== 'over');
  const waiting = live.filter((t) => t.status === 'lobby').length;
  const playing = live.length - waiting;
  const news = [waiting ? count(waiting, 'partie en attente', 'parties en attente') : null, playing ? count(playing, 'partie en cours', 'parties en cours') : null].filter(Boolean).join(', ');
  return h('section.game-hero', { 'data-game': g.id, style: `--g:${g.color};--g-ink:${g.ink}` },
    gameLogo(g),
    h('div.game-hero-text',
      h('p.game-hero-kicker', 'Le jeu de la classe'),
      h('h2', g.name),
      h('p.game-tagline', g.tagline),
      h('p.game-meta', playersLabel(g), g.duration ? `, ${g.duration}` : '', news ? `. ${news}.` : '')),
    h('button.btn.btn-dark', { type: 'button', onclick: () => openGameSheet(g) }, 'Jouer à ' + g.name));
}

function statusLabel(t, g) {
  if (t.status === 'lobby') return `En attente · ${t.seats.length}/${g.maxPlayers}`;
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
  return h('li', h(`a.table-row${mine ? '.is-turn' : ''}`, { href: `#/t/${t.id}`, onclick: () => { if (action === 'Rejoindre') wantJoin(t.id); }, style: `--g:${g.color};--g-ink:${g.ink}` },
    h('span.table-chip', gameLogo(g)),
    h('span.table-info',
      h('b', g.name),
      h('span', host ? `Partie de ${host.pseudo}` : 'Partie', ' · ', statusLabel(t, g))),
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
  const hero = state.games.find((g) => g.featured);
  const shown = state.games.filter((g) => g !== hero && test(g) && (family === 'tous' || g.family === family));
  const chips = (label, list, value, set) => arrowKeys(h('div.filter-chips', { role: 'radiogroup', 'aria-label': label }, list.map((f) => h('button.chip', {
    type: 'button',
    role: 'radio',
    'aria-checked': String(f.key === value),
    onclick: () => {
      set(f.key);
      render(el);
    },
  }, f.label))));
  const filters = h('div.games-filters',
    chips('Type de jeu', FAMILIES, family, (k) => { family = k; }),
    chips('Nombre de joueurs', FILTERS.map((f) => (f.key === 'tous' ? { ...f, label: 'Tous joueurs' } : f)), filter, (k) => { filter = k; }));

  keepFocus(el, () => el.replaceChildren(h('div.page',
    h('div.view-head.page-head',
      h('div', h('h1', 'Jouer'),
        h('p.view-sub', turns ? `C’est à toi de jouer sur ${count(turns, 'partie', 'parties')}.` : 'Crée une partie, invite la classe, joue en direct.'))),
    hero ? featuredCard(hero) : null,
    open.length || playing.length ? h('div.tables-cols',
      section('Parties en attente', open, 'Aucune partie en attente pour l’instant.'),
      section('Parties en cours', playing, 'Aucune partie en cours.')) : null,
    h('div.games-head', h('h2.section-title', 'Les jeux', h('span.section-count', String(shown.length))), filters),
    shown.length
      ? h('div.game-grid', shown.map(gameCard))
      : h('p.section-empty', 'Aucun jeu ne correspond à ces deux filtres. Essaie un autre nombre de joueurs.'),
    over.length ? section('Tes dernières parties', over, '') : null)));
}

// La liste des tables a changé : on redessine si l'écran est ouvert.
export function refresh() {
  if (container?.isConnected) render(container);
}
