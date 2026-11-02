// Hubuno côté navigateur : démarrage, connexion temps réel, barre de navigation et choix de l'écran.
import { h, icon, token, toast, setColors, count } from './dom.js';
import { api, connect } from './net.js';
import { renderAuth, renderForcedPassword } from './auth.js';
import { state, actions, go, unreadTotal, isAdmin, gameOf, myTurnTables } from './store.js';
import * as home from './views/home.js';
import * as games from './views/games.js';
import * as table from './views/table.js';
import * as messages from './views/messages.js';
import * as members from './views/members.js';
import * as profile from './views/profile.js';
import * as admin from './views/admin.js';

const root = document.getElementById('app');
let ui = null; // éléments de la coque, créés une fois par connexion
let lastConv = null; // dernière conversation ouverte, pour revenir dessus depuis « Messages »

// ——— Démarrage ———

async function boot() {
  root.replaceChildren(h('div.boot', 'Chargement…'));
  try {
    state.options = await api('options');
    setColors(state.options.colors);
  } catch (err) {
    root.replaceChildren(h('div.boot', err.message));
    return;
  }
  try {
    afterLogin(await api('me'));
  } catch (err) {
    if (err.status === 401) showAuth();
    else root.replaceChildren(h('div.boot', err.message));
  }
}

function showAuth(mode) {
  state.socket?.disconnect();
  state.socket = null;
  ui = null;
  renderAuth(root, { mode, onDone: afterLogin });
}

function afterLogin({ mustChangePassword }) {
  if (mustChangePassword) renderForcedPassword(root, { onDone: startRealtime });
  else startRealtime();
}

actions.logout = (message) => {
  state.socket?.disconnect();
  state.socket = null;
  if (message) toast(message, { ms: 6000 });
  showAuth('login');
};

messages.setUnreadListener(() => {
  renderNav();
  if (state.route.view === 'home') home.render(ui.content);
});

function startRealtime() {
  root.replaceChildren(h('div.boot', 'Connexion…'));
  const socket = connect();
  state.socket = socket;

  socket.on('state', (s) => {
    state.me = s.me;
    state.mutedUntil = s.mutedUntil;
    state.users = new Map(s.users.map((u) => [u.id, u]));
    state.channels = s.channels;
    state.dms = s.dms;
    state.unread = s.unread;
    state.online = new Set(s.online);
    state.games = s.games;
    state.tables = s.tables;
    // Après une coupure, on recharge les conversations : des messages ont pu arriver entre-temps.
    state.convs.clear();
    if (s.mustChangePassword) {
      socket.disconnect();
      renderForcedPassword(root, { onDone: startRealtime });
      return;
    }
    if (!ui) buildShell();
    applyRoute();
  });

  socket.on('connect_error', (err) => {
    if (err.message === 'non-connecte') actions.logout('Ta session a expiré : reconnecte-toi.');
  });
  socket.on('disconnect', (reason) => {
    if (reason !== 'io client disconnect') setBanner('Connexion perdue. Reconnexion en cours…');
  });
  socket.on('connect', () => setBanner(null));
  socket.on('kicked', (reason) => actions.logout(reason));

  socket.on('presence', (ids) => {
    state.online = new Set(ids);
    refreshPeople();
  });
  socket.on('user', (u) => {
    state.users.set(u.id, u);
    if (u.id === state.me.id) state.me = u;
    renderNav();
    refreshPeople();
    messages.onUsersChange();
  });
  socket.on('user:removed', (id) => {
    state.users.delete(id);
    state.dms = state.dms.filter((d) => d.otherId !== id);
    for (const conv of state.convs.values()) conv.messages = conv.messages.filter((m) => m.userId !== id);
    if (state.route.view === 'dm' && state.route.id === id) go('#/messages');
    else refreshPeople();
  });
  socket.on('channels', (channels) => {
    state.channels = channels;
    if (state.route.view === 'channel' && !channels.some((c) => c.id === state.route.id)) {
      go('#/messages');
      return;
    }
    messages.renderList();
    admin.renderChannels();
  });
  socket.on('muted', (until) => {
    state.mutedUntil = until;
    messages.renderComposer();
    table.onMuted();
    toast(until ? 'Un admin t’a mis en sourdine.' : 'Tu peux de nouveau écrire.');
  });
  socket.on('message', (m) => {
    if (m.scope.startsWith('t:')) {
      table.onMessage(m);
      return;
    }
    messages.onMessage(m);
    renderNav();
    if (state.route.view === 'home') home.render(ui.content);
  });
  socket.on('message:update', messages.onMessageUpdate);
  socket.on('message:deleted', (m) => (m.scope.startsWith('t:') ? table.onMessageDeleted(m) : messages.onMessageDeleted(m)));
  socket.on('typing', messages.onTyping);

  // ——— Tables de jeu ———
  socket.on('tables', (list) => {
    state.tables = list;
    renderNav();
    games.refresh();
    if (state.route.view === 'home') home.render(ui.content);
  });
  socket.on('table', table.onTable);
  socket.on('table:closed', table.onClosed);
  socket.on('invite', ({ tableId, game, from }) => {
    const g = gameOf(game);
    const who = state.users.get(from)?.pseudo || 'Quelqu’un';
    toast([`${who} t’invite à jouer à ${g?.name || 'un jeu'}. `, h('a.toast-link', { href: `#/t/${tableId}` }, 'Rejoindre')], { ms: 12000, action: true });
  });
}

// Présence ou profils changés : on redessine les écrans qui montrent des membres.
function refreshPeople() {
  if (!ui) return;
  const { view } = state.route;
  if (view === 'home') home.render(ui.content);
  else if (view === 'members') members.renderGrid();
  else if (view === 'table') table.refresh();
  else if (['messages', 'channel', 'dm'].includes(view)) {
    messages.renderList();
    messages.renderOnline();
  }
}

// ——— Navigation ———
// #/ accueil, #/jouer, #/t/5 (une table), #/messages, #/c/3, #/dm/7, #/membres, #/profil, #/admin

window.addEventListener('hashchange', () => ui && applyRoute());

function parseRoute(hash = location.hash) {
  const m = /^#\/([a-z]+)(?:\/(\d+))?/.exec(hash);
  const id = Number(m?.[2]);
  switch (m?.[1]) {
    case 'jouer':
    case 'jeux':
      return { view: 'games' };
    case 't':
      return id ? { view: 'table', id } : { view: 'games' };
    case 'messages':
      return { view: 'messages' };
    case 'c':
      return state.channels.some((c) => c.id === id) ? { view: 'channel', id } : { view: 'messages' };
    case 'dm':
      return state.users.has(id) && id !== state.me.id ? { view: 'dm', id } : { view: 'messages' };
    case 'membres':
      return { view: 'members' };
    case 'profil':
      return { view: 'profile' };
    case 'admin':
      return isAdmin() ? { view: 'admin' } : { view: 'home' };
    default:
      return { view: 'home' };
  }
}

function applyRoute() {
  let route = parseRoute();
  // Sur ordinateur, « Messages » ouvre directement la dernière conversation (la liste est déjà à côté).
  if (route.view === 'messages' && !matchMedia('(max-width: 760px)').matches) {
    const target = lastConv && parseRoute(lastConv).view !== 'messages' ? lastConv : state.channels[0] && `#/c/${state.channels[0].id}`;
    if (target) {
      history.replaceState(null, '', target);
      route = parseRoute();
    }
  }
  if (route.view === 'channel' || route.view === 'dm') lastConv = location.hash;

  for (const v of [messages, members, admin, games, table]) v.leave();
  state.route = route;
  ui.content.className = `view view-${route.view === 'channel' || route.view === 'dm' ? 'messages' : route.view}`;
  ui.content.scrollTop = 0;
  const view = {
    home, games, table, members, profile, admin,
    messages, channel: messages, dm: messages,
  }[route.view];
  view.render(ui.content);
  renderNav();
}

// ——— Coque : barre de navigation + écran ———

function buildShell() {
  ui = {
    nav: h('nav.navbar', { 'aria-label': 'Navigation principale' }),
    content: h('main.view', { id: 'contenu', tabindex: '-1' }),
    banner: h('div.banner', { hidden: true, role: 'status' }),
  };
  root.replaceChildren(
    h('a.skip-link', { href: '#contenu', onclick: (e) => { e.preventDefault(); ui.content.focus(); } }, 'Aller au contenu'),
    ui.banner,
    h('div.app', ui.nav, ui.content));
}

function setBanner(text) {
  if (!ui) return;
  ui.banner.hidden = !text;
  ui.banner.textContent = text || '';
}

function renderNav() {
  if (!ui) return;
  const { view } = state.route;
  const total = unreadTotal();
  document.title = total ? `(${total > 99 ? '99+' : total}) Hubuno` : 'Hubuno';
  const section = ['messages', 'channel', 'dm'].includes(view) ? 'messages' : view === 'table' ? 'games' : view;
  const turns = myTurnTables().length;
  const turnBadge = turns ? h('span.badge.nav-badge.badge-turn', { 'aria-hidden': 'true' }, String(turns)) : null;

  const item = (key, href, label, lead, extra, srExtra) => h(`li.nav-${key}`, h('a.nav-link', {
    href,
    'aria-current': section === key ? 'page' : null,
  }, h('span.nav-icon', lead, extra), h('span.nav-label', label), srExtra ? h('span.sr-only', srExtra) : null));

  // La pastille est cachée aux lecteurs d'écran, qui entendent « Messages, 3 non lus » dans le bon ordre.
  const badge = total ? h('span.badge.nav-badge', { 'aria-hidden': 'true' }, total > 99 ? '99+' : String(total)) : null;
  const unreadText = total ? `, ${count(total, 'non lu', 'non lus')}` : null;

  ui.nav.replaceChildren(
    h('a.nav-brand', { href: '#/', 'aria-label': 'Hubuno, accueil' }, h('span.brand-mark', 'H'), h('span.brand-name', 'Hubuno')),
    h('ul.nav-items',
      item('home', '#/', 'Accueil', icon('home')),
      item('games', '#/jouer', 'Jouer', icon('dice'), turnBadge, turns ? `, à toi de jouer sur ${count(turns, 'table', 'tables')}` : null),
      item('messages', '#/messages', 'Messages', icon('chat'), badge, unreadText),
      item('members', '#/membres', 'Membres', icon('users')),
      isAdmin() ? item('admin', '#/admin', 'Admin', icon('shield')) : null,
      item('profile', '#/profil', 'Profil', token(state.me, { size: 's', online: true }))),
  );
}

boot();
