// Écran Jouer : les stats de la classe en haut, les jeux (recherche, favoris, filtres ; ouvrir une table) et les tables en cours.
import { h, changedOnly, de, icon, token, count, gameLogo, keepFocus, arrowKeys, toast } from '../dom.js';
import { call } from '../net.js';
import { modal, openProfile } from '../dialogs.js';
import { wantJoin } from './table.js';
import { state, go, gameOf, myTurnTables } from '../store.js';

let container = null;
let family = 'tous'; // famille de jeux (champ family de game.json)
let filter = 'tous'; // combien on est : tous, 2, petit (3 à 6), grand (7 et plus)
let query = ''; // la recherche, telle que tapée
let stats = null; // les stats de la classe (bandeau du haut), demandées au serveur
let statsAsked = false;

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

const STALE_MS = 3 * 3600_000;

export function leave() {
  container = null;
  statsAsked = false; // au retour sur Jouer, les stats sont redemandées (les anciennes restent affichées en attendant)
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
    g.how?.length ? h('details.game-sheet-how', h('summary', 'Comment on joue ?'), h('ol.how', g.how.map((line) => h('li', line)))) : null,
    waiting.length ? h('div.game-sheet-tables',
      h('h3', count(waiting.length, 'partie attend', 'parties attendent'), ' des joueurs'),
      h('ul.table-list', waiting.map((t) => h('li', h('a.game-sheet-table', { href: `#/t/${t.id}`, onclick: () => { if (!t.seats.includes(state.me.id)) wantJoin(t.id); dlg.close(); } },
        h('span', `Partie ${de(state.users.get(t.hostId)?.pseudo ?? '…')}, ${t.seats.length}/${g.maxPlayers}`),
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
    favButton(g),
    gameLogo(g),
    h('div.game-card-body',
      h('h3', g.name),
      h('p.game-meta', playersLabel(g), g.duration ? `, ${g.duration}` : ''),
      h('p.game-tagline', g.tagline)),
    btn);
}

// Mettre un jeu en favori (ou l'enlever) : à moi seul, gardé sur le serveur.
function favButton(g) {
  const on = state.favorites.has(g.id);
  return h(`button.fav-btn${on ? '.is-on' : ''}`, {
    type: 'button',
    'aria-pressed': String(on),
    'aria-label': on ? `Retirer ${g.name} des favoris` : `Ajouter ${g.name} aux favoris`,
    title: on ? 'Retirer des favoris' : 'Ajouter aux favoris',
    onclick: async (e) => {
      e.stopPropagation();
      const next = !state.favorites.has(g.id);
      if (next) state.favorites.add(g.id);
      else state.favorites.delete(g.id);
      refresh(); // l'écran suit tout de suite ; le serveur confirme
      try {
        const res = await call(state.socket, 'favorite', { game: g.id, on: next });
        state.favorites = new Set(res.favorites);
      } catch (err) {
        if (next) state.favorites.delete(g.id);
        else state.favorites.add(g.id);
        toast(err.message, { error: true });
      }
      refresh();
    },
  }, icon(on ? 'star-fill' : 'star'));
}

export function forgetStats() {
  statsAsked = false;
}

// Le bandeau du haut : les séries en cours, les champions du mois, les dernières victoires et le jeu de la semaine.
export function loadStats() {
  statsAsked = true;
  call(state.socket, 'stats:class', {}).then((s) => {
    stats = s;
    refresh();
  }).catch(() => {});
}

const who = (id) => state.users.get(id);
const person = (id, extra) => {
  const u = who(id);
  if (!u) return null;
  return h('button.stat-person', { type: 'button', onclick: () => openProfile(u.id), title: `Voir le profil de ${u.pseudo}` },
    token(u, { size: 's' }), h('span.stat-name', u.pseudo), extra ? h('b.stat-num', extra) : null);
};
const ago = (ts) => {
  const min = Math.round((Date.now() - ts) / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'hier' : `il y a ${days} jours`;
};

function statsBand() {
  if (!stats) return h('section.stats-band.is-loading', { 'aria-busy': 'true' }, [0, 1, 2, 3].map(() => h('div.stat-tile.is-ghost')));
  const streaks = stats.streaks.filter((x) => who(x.userId));
  const leaders = stats.leaders.filter((x) => who(x.userId));
  const lastWins = stats.lastWins.filter((x) => who(x.userId) && gameOf(x.game)).slice(0, 4);
  if (!streaks.length && !leaders.length && !lastWins.length) {
    return h('section.stats-band.is-empty',
      h('div.stat-tile.stat-wide',
        h('p.stat-kicker', 'Les stats de la classe'),
        h('h2', 'Qui sera le premier champion ?'),
        h('p.stat-text', 'Les séries de victoires, les champions du mois et les dernières victoires apparaîtront ici après les premières parties à plusieurs. Gagne pour débloquer des succès sur ton profil.')));
  }
  const top = streaks[0];
  const topGame = stats.topGame && gameOf(stats.topGame.game);
  return h('section.stats-band', { 'aria-label': 'Les stats de la classe' },
    h('div.stat-tile.stat-fire',
      h('p.stat-kicker', '🔥 En série'),
      top
        ? [h('button.stat-hero', { type: 'button', onclick: () => openProfile(top.userId), title: `Voir le profil de ${who(top.userId).pseudo}` }, token(who(top.userId), { size: 'l' }), h('div', h('strong', who(top.userId).pseudo), h('span', `${top.streak} victoires d’affilée`))),
          streaks.length > 1 ? h('ul.stat-list', streaks.slice(1, 4).map((x) => h('li', person(x.userId, `${x.streak} d’affilée`)))) : null]
        : h('p.stat-text', 'Personne n’a de série en cours : gagne deux parties de suite pour apparaître ici.')),
    h('div.stat-tile',
      h('p.stat-kicker', '🏆 Champions du mois'),
      leaders.length
        ? h('ol.stat-list.stat-podium', leaders.slice(0, 4).map((x) => h('li', person(x.userId, count(x.wins, 'victoire', 'victoires')))))
        : h('p.stat-text', 'Aucune victoire ce mois-ci.')),
    h('div.stat-tile',
      h('p.stat-kicker', '⚡ Dernières victoires'),
      lastWins.length
        ? h('ul.stat-list', lastWins.map((x) => h('li', person(x.userId), h('span.stat-game', { style: `--g:${gameOf(x.game).color};--g-ink:${gameOf(x.game).ink}` }, gameOf(x.game).name), h('small', ago(x.at)))))
        : h('p.stat-text', 'Pas encore de victoire.')),
    h('div.stat-tile.stat-week',
      h('p.stat-kicker', '📅 Cette semaine'),
      h('p.stat-big', String(stats.weekGames)),
      h('p.stat-text', count(stats.weekGames, 'partie jouée à plusieurs', 'parties jouées à plusieurs')),
      topGame ? h('button.stat-topgame', { type: 'button', onclick: () => openGameSheet(topGame), style: `--g:${topGame.color};--g-ink:${topGame.ink}` },
        gameLogo(topGame), h('span', h('small', 'Le jeu de la semaine'), h('b', topGame.name))) : null));
}

// La recherche : sans accents ni majuscules, dans le nom, la phrase d'accroche et la description.
const plain = (text) => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const matches = (g, q) => !q || plain(`${g.name} ${g.tagline} ${g.description ?? ''}`).includes(q);
const searchInput = h('input.input.games-search-input', {
  type: 'search',
  name: 'game_search',
  placeholder: 'Rechercher un jeu',
  autocomplete: 'off',
  spellcheck: false,
  'aria-label': 'Rechercher un jeu',
  oninput: (e) => {
    query = e.currentTarget.value;
    refresh();
  },
  onkeydown: (e) => {
    if (e.key === 'Escape' && searchInput.value) {
      e.preventDefault();
      searchInput.value = '';
      query = '';
      refresh();
    }
  },
});
const searchBox = h('label.games-search', icon('search'), searchInput);

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
  const inviter = action === 'Rejoindre' ? state.users.get(state.invites.get(t.id)) : null;
  return h('li', h(`a.table-row${mine ? '.is-turn' : ''}${inviter ? '.is-invited' : ''}`, { href: `#/t/${t.id}`, onclick: () => { if (action === 'Rejoindre') wantJoin(t.id); }, style: `--g:${g.color};--g-ink:${g.ink}` },
    h('span.table-chip', gameLogo(g)),
    h('span.table-info',
      h('b', g.name),
      h('span', inviter ? `Invité par ${inviter.pseudo} · ` : null, host ? `Partie ${de(host.pseudo)}` : 'Partie', ' · ', statusLabel(t, g))),
    h('span.table-seats', { 'aria-label': count(t.seats.length, 'joueur', 'joueurs') },
      t.seats.slice(0, 5).map((id) => token(state.users.get(id), { size: 's' })),
      t.seats.length > 5 ? h('span.more', `+${t.seats.length - 5}`) : null),
    h('span.table-action', action)));
}

export function render(el) {
  container = el;
  const tables = [...state.tables].sort((a, b) => b.updatedAt - a.updatedAt);
  // Les miennes d'abord, puis celles où l'on m'a invité, puis les autres.
  const rank = (t) => (t.seats.includes(state.me.id) ? 0 : state.invites.has(t.id) ? 1 : 2);
  const mineFirst = (list) => [...list].sort((a, b) => rank(a) - rank(b));
  const open = mineFirst(tables.filter((t) => t.status === 'lobby'));
  // Une partie « en cours » où personne n'a joué depuis 3 heures est abandonnée : seuls ses joueurs la voient encore (pour la reprendre ou la fermer).
  const playing = mineFirst(tables.filter((t) => t.status === 'playing' && (t.seats.includes(state.me.id) || Date.now() - t.updatedAt < STALE_MS)));
  const over = tables.filter((t) => t.status === 'over' && t.seats.includes(state.me.id)).slice(0, 6);
  const turns = myTurnTables().length;

  const section = (title, list, empty) => h('section.table-section',
    h('h2.section-title', title, list.length ? h('span.section-count', String(list.length)) : null),
    list.length ? h('ul.table-list', list.map(tableRow)) : h('p.section-empty', empty));

  const test = FILTERS.find((f) => f.key === filter).test;
  const q = plain(query.trim());
  const shown = state.games.filter((g) => test(g) && (family === 'tous' || g.family === family) && matches(g, q));
  const favs = shown.filter((g) => state.favorites.has(g.id));
  const others = shown.filter((g) => !state.favorites.has(g.id));
  if (!statsAsked && state.socket) loadStats();
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

  keepFocus(el, () => changedOnly(el).replaceChildren(h('div.page',
    h('div.view-head.page-head',
      h('div', h('h1', 'Jouer'),
        h('p.view-sub', turns ? `C’est à toi de jouer sur ${count(turns, 'partie', 'parties')}.` : 'Crée une partie, invite la classe, joue en direct.'))),
    statsBand(),
    open.length || playing.length ? h('div.tables-cols',
      section('Parties en attente', open, 'Aucune partie en attente pour l’instant.'),
      section('Parties en cours', playing, 'Aucune partie en cours.')) : null,
    h('div.games-head', h('h2.section-title', 'Les jeux', h('span.section-count', String(shown.length))), searchBox, filters),
    favs.length ? h('section.fav-section', { 'aria-label': 'Mes favoris' },
      h('h3.fav-title', icon('star-fill'), 'Mes favoris'),
      h('div.game-grid', favs.map(gameCard))) : null,
    others.length
      ? [favs.length ? h('h3.fav-title.is-rest', 'Tous les autres jeux') : null, h('div.game-grid', others.map(gameCard))]
      : shown.length ? null
        : h('p.section-empty', q ? `Aucun jeu ne correspond à « ${query.trim()} »${family !== 'tous' || filter !== 'tous' ? ' avec ces filtres' : ''}.` : 'Aucun jeu ne correspond à ces deux filtres. Essaie un autre nombre de joueurs.'),
    over.length ? section('Tes dernières parties', over, '') : null)));
}

// La liste des tables a changé : on redessine si l'écran est ouvert.
export function refresh() {
  if (container?.isConnected) render(container);
}
