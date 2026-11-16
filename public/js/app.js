// Hubuno côté navigateur : démarrage, connexion temps réel, barre de navigation et choix de l'écran.
import { h, changedOnly, icon, token, toast, setColors, count, keepFocus } from './dom.js';
import { api, connect } from './net.js';
import './erreurs.js'; // les erreurs JavaScript de la page remontent au serveur (Admin)
import { renderAuth, renderForcedPassword } from './auth.js';
import { state, actions, go, dmScope, unreadTotal, isAdmin, gameOf, myTurnTables } from './store.js';
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

// Écran plein cadre pour ce qui bloque tout (réseau coupé, trop d'onglets) : un titre, une phrase, un bouton.
function showNotice(title, text, label = 'Recharger la page') {
  root.replaceChildren(h('main.notice', h('div.notice-card',
    h('h1', title),
    h('p', text),
    h('button.btn', { type: 'button', onclick: () => location.reload() }, label))));
}

async function boot() {
  root.replaceChildren(h('div.boot', 'Chargement…'));
  try {
    state.options = await api('options');
    setColors(state.options.colors);
  } catch (err) {
    showNotice('Hubuno ne répond pas', err.message);
    return;
  }
  try {
    afterLogin(await api('me'));
  } catch (err) {
    if (err.status === 401) showAuth();
    else showNotice('Hubuno ne répond pas', err.message);
  }
}

function showAuth(mode) {
  state.socket?.disconnect();
  state.socket = null;
  ui = null;
  renderAuth(root, { mode, onDone: afterLogin, signupsOpen: state.options?.signupsOpen !== false });
}

// Quand la sourdine se termine, la zone de saisie revient sans changer d'écran.
let muteTimer = null;
function armMuteEnd() {
  clearTimeout(muteTimer);
  const left = state.mutedUntil - Date.now();
  if (left > 0) muteTimer = setTimeout(() => { messages.renderComposer(); table.onMuted(); armMuteEnd(); }, Math.min(left + 500, 2 ** 31 - 1));
}

function afterLogin({ mustChangePassword }) {
  if (mustChangePassword) renderForcedPassword(root, { onDone: startRealtime });
  else startRealtime();
}

actions.logout = (message) => {
  const wasOn = Boolean(state.socket); // la déconnexion par le serveur peut suivre celle de l'écran : un seul message
  state.socket?.disconnect();
  state.socket = null;
  if (message && wasOn) toast(message, { ms: 6000 });
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
    // Le serveur a redémarré avec un autre code (mise à jour) : cette page a l’ancien, on propose de recharger.
    if (state.version && s.version && s.version !== state.version && s.version !== state.laterVersion) showUpdate(s.version);
    state.version ??= s.version;
    const wasMuted = state.mutedUntil > Date.now();
    if (state.me?.id !== s.me.id) state.invites.clear(); // un autre compte dans le même onglet ne voit pas les invitations du précédent
    state.me = s.me;
    state.mutedUntil = s.mutedUntil;
    armMuteEnd();
    state.users = new Map(s.users.map((u) => [u.id, u]));
    state.channels = s.channels;
    state.dms = s.dms;
    state.unread = s.unread;
    state.online = new Set(s.online);
    state.games = s.games;
    state.tables = s.tables;
    state.roles = s.roles ?? [];
    // Après une coupure, on recharge les conversations : des messages ont pu arriver entre-temps.
    // Les messages pas encore partis restent à l'écran, avec « Réessayer ».
    const unsent = [...state.convs].map(([scope, c]) => [scope, c.messages.filter((m) => m.id < 0)]).filter(([, list]) => list.length);
    state.convs.clear();
    for (const [scope, list] of unsent) state.convs.set(scope, { messages: list, complete: false, loaded: false });
    if (s.mustChangePassword) {
      socket.disconnect();
      renderForcedPassword(root, { onDone: startRealtime });
      return;
    }
    // Première connexion, ou l'écran affiché n'existe plus (canal supprimé, compte parti, droits retirés) : on affiche l'écran de l'adresse.
    // Simple reconnexion : on rafraîchit l'écran en place, sans le reconstruire (ni brouillon perdu, ni jeu remonté).
    const first = !ui;
    if (first) buildShell();
    const now = parseRoute();
    if (first || now.view !== state.route.view || now.id !== state.route.id) {
      applyRoute();
      return;
    }
    const { view } = state.route;
    if (view === 'table') table.resync();
    else if (['messages', 'channel', 'dm'].includes(view)) messages.resync();
    else if (view === 'home') keepFocus(ui.content, () => home.render(ui.content));
    else if (view === 'games') games.refresh();
    else if (view === 'members') members.renderGrid();
    else if (view === 'admin') { // canaux et rôles ont pu changer pendant la coupure
      admin.renderChannels();
      admin.renderRoles();
    }
    if (wasMuted !== state.mutedUntil > Date.now()) { // la sourdine a changé pendant la coupure
      messages.renderComposer();
      table.onMuted();
    }
    renderNav();
  });

  socket.on('connect_error', (err) => {
    if (err.message === 'non-connecte') actions.logout('Ta session a expiré : reconnecte-toi.');
  });
  socket.on('disconnect', (reason) => {
    if (reason !== 'io client disconnect') setBanner('Connexion perdue. Reconnexion en cours…');
  });
  socket.on('connect', () => setBanner(null));
  socket.on('kicked', (reason) => actions.logout(reason));
  socket.on('notice', (text, received) => { // un mot du serveur (partie interrompue par une mise à jour)
    toast(String(text), { ms: 20000, action: true });
    if (typeof received === 'function') received(); // il ne sera pas redonné
  });
  // Le compte est ouvert sur trop d'onglets : le serveur a fermé celui-ci, le plus ancien. Il ne se reconnecte pas tout seul (sinon les onglets se chasseraient à tour de rôle).
  socket.on('replaced', () => {
    state.socket = null;
    ui = null;
    showNotice('Hubuno est ouvert dans trop d’onglets', 'Cet onglet s’est mis en pause pour laisser la place au plus récent. Ferme ceux dont tu ne te sers plus, puis reprends ici.', 'Reprendre ici');
  });

  socket.on('presence', (ids) => {
    // Depuis quand chacun est hors ligne (pour ne proposer « Continuer sans » qu'après le délai) : noté quand on le voit partir.
    for (const id of state.online) if (!ids.includes(id)) state.awaySince.set(id, Date.now());
    for (const id of ids) state.awaySince.delete(id);
    state.online = new Set(ids);
    refreshPeople();
  });
  socket.on('user', (u) => {
    // Mon niveau change : une fiche ouverte avec des outils d'équipe n'est plus à jour, on la ferme.
    if (u.id === state.me.id && u.role !== state.me.role) document.querySelectorAll('dialog[open]').forEach((d) => d.querySelector('.staff-tools') && d.close());
    state.users.set(u.id, u);
    if (u.id === state.me.id) state.me = u;
    if (u.id === state.me.id && state.route.view === 'admin' && !isAdmin()) go('#/'); // rétrogradé pendant qu'il regardait l'écran admin
    renderNav();
    refreshPeople();
    messages.onUsersChange();
    admin.renderRoles(); // le nombre de membres de chaque rôle
    admin.renderMembers();
  });
  socket.on('renamed', (pseudo) => toast(`Un membre de l’équipe a changé ton pseudo : tu t’appelles maintenant ${pseudo}.`, { ms: 8000 }));
  socket.on('user:removed', (id) => {
    state.users.delete(id);
    state.dms = state.dms.filter((d) => d.otherId !== id);
    delete state.unread[dmScope(id)]; // sinon la pastille compte une conversation qui n'existe plus
    renderNav();
    for (const conv of state.convs.values()) conv.messages = conv.messages.filter((m) => m.userId !== id);
    if (state.route.view === 'dm' && state.route.id === id) go('#/messages');
    else refreshPeople();
  });
  socket.on('roles', (list) => {
    state.roles = list;
    refreshPeople();
    messages.onUsersChange();
    admin.renderRoles();
  });
  socket.on('channels', (channels) => {
    state.channels = channels;
    for (const scope of Object.keys(state.unread)) {
      if (scope.startsWith('c:') && !channels.some((c) => `c:${c.id}` === scope)) delete state.unread[scope];
    }
    renderNav();
    if (state.route.view === 'channel' && !channels.some((c) => c.id === state.route.id)) {
      go('#/messages');
      return;
    }
    messages.renderList();
    admin.renderChannels();
  });
  socket.on('muted', (until) => {
    state.mutedUntil = until;
    armMuteEnd();
    messages.renderComposer();
    table.onMuted();
    toast(until ? 'Tu es en sourdine : tu ne peux plus écrire pour le moment.' : 'Tu peux de nouveau écrire.');
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
  socket.on('read', messages.onReadElsewhere);

  // ——— Tables de jeu ———
  // La liste repart à chaque coup de chaque table : on ne redessine que si quelque chose de visible a changé.
  let tablesSeen = '';
  const onTables = () => {
    // Une invitation ne vaut que tant que la partie attend des joueurs et que je n'y suis pas assis.
    for (const id of state.invites.keys()) {
      const t = state.tables.find((x) => x.id === id);
      if (!t || t.status !== 'lobby' || t.seats.includes(state.me.id)) state.invites.delete(id);
    }
    const seen = JSON.stringify(state.tables.map(({ updatedAt, deadline, ...visible }) => visible));
    if (seen === tablesSeen) return;
    tablesSeen = seen;
    renderNav();
    games.refresh();
    if (state.route.view === 'home') home.render(ui.content);
  };
  // La liste complète arrive à la connexion (« state ») ; ensuite le serveur n'envoie que la partie qui change, ou celle qui disparaît.
  socket.on('tables:update', ({ table: t, removed }) => {
    if (removed !== undefined) state.tables = state.tables.filter((x) => x.id !== removed);
    else if (state.tables.some((x) => x.id === t.id)) state.tables = state.tables.map((x) => (x.id === t.id ? t : x));
    else state.tables = [...state.tables, t];
    onTables();
  });
  socket.on('table', table.onTable);
  socket.on('table:closed', table.onClosed);
  socket.on('table:kicked', table.onKicked);
  socket.on('invite', ({ tableId, game, from }) => {
    const g = gameOf(game);
    const who = state.users.get(from)?.pseudo || 'Quelqu’un';
    state.invites.set(tableId, from); // la notification passe, la trace reste sur la page Jouer
    games.refresh();
    toast([`${who} t’invite à jouer à ${g?.name || 'un jeu'}. `, h('a.toast-link', { href: `#/t/${tableId}`, onclick: (e) => { table.wantJoin(tableId); e.currentTarget.closest('.toast')?.remove(); } }, 'Rejoindre')], { ms: 30000, action: true });
  });
}

// Présence ou profils changés : on redessine les écrans qui montrent des membres.
function refreshPeople() {
  if (!ui) return;
  const { view } = state.route;
  if (view === 'home') keepFocus(ui.content, () => home.render(ui.content));
  else if (view === 'members') members.renderGrid();
  else if (view === 'table') table.refresh();
  else if (['messages', 'channel', 'dm'].includes(view)) {
    messages.renderList();
    messages.renderOnline();
  }
}

// ——— Navigation ———
// #/ accueil, #/jouer, #/t/5 (une table), #/messages, #/c/3, #/dm/7, #/membres, #/profil, #/admin

window.addEventListener('hashchange', () => ui && applyRoute({ moved: true }));

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

function applyRoute({ moved = false } = {}) {
  let route = parseRoute();
  // Sur ordinateur, « Messages » ouvre directement la dernière conversation (la liste est déjà à côté).
  if (route.view === 'messages' && !matchMedia('(max-width: 760px), (max-height: 500px)').matches) {
    const target = lastConv && parseRoute(lastConv).view !== 'messages' ? lastConv : state.channels[0] && `#/c/${state.channels[0].id}`;
    if (target) {
      history.replaceState(null, '', target);
      route = parseRoute();
    }
  }
  if (route.view === 'channel' || route.view === 'dm') lastConv = location.hash;

  for (const v of [messages, members, admin, games, table]) v.leave();
  state.cameFrom = state.route.view;
  state.route = route;
  ui.content.className = `view view-${route.view === 'channel' || route.view === 'dm' ? 'messages' : route.view}`;
  ui.content.scrollTop = 0;
  ui.content.replaceChildren(); // un autre écran repart d'une page vide : changedOnly() ne compare que deux dessins du même écran
  const view = {
    home, games, table, members, profile, admin,
    messages, channel: messages, dm: messages,
  }[route.view];
  view.render(ui.content);
  renderNav();
  // Nouvel écran : le clavier et le lecteur d'écran repartent de son titre (sauf si l'écran a déjà placé le focus, comme la zone d'écriture).
  if (moved && !ui.content.contains(document.activeElement)) {
    const title = ui.content.querySelector('h1');
    if (title) title.tabIndex = -1;
    (title ?? ui.content).focus({ preventScroll: true });
  }
}

// Le nom de l'écran, dans le titre de l'onglet.
function pageName({ view, id }) {
  if (view === 'channel') return `#${state.channels.find((c) => c.id === id)?.name ?? 'canal'}`;
  if (view === 'dm') return state.users.get(id)?.pseudo ?? 'Messages';
  if (view === 'table') return gameOf(state.tables.find((t) => t.id === id)?.game)?.name ?? 'Partie';
  return { home: 'Accueil', games: 'Jouer', messages: 'Messages', members: 'Membres', profile: 'Profil', admin: 'Admin' }[view] ?? '';
}

// ——— Coque : barre de navigation + écran ———

function buildShell() {
  ui = {
    nav: h('nav.navbar', { 'aria-label': 'Navigation principale' }),
    content: h('main.view', { id: 'contenu', tabindex: '-1' }),
    banner: h('div.banner.conn-banner', { hidden: true, role: 'status' }),
  };
  root.replaceChildren(
    h('a.skip-link', { href: '#contenu', onclick: (e) => { e.preventDefault(); ui.content.focus(); } }, 'Aller au contenu'),
    ui.banner,
    h('div.app', ui.nav, ui.content));
}

// Une notification qui reste là où arrivent les autres (elle ne cache ni l'en-tête ni la zone d'écriture) :
// recharger maintenant, ou plus tard (elle ne revient alors qu'à la version suivante). Une partie en cours reprend après le rechargement.
// Une page qui a l'ancien code se recharge toute seule dès qu'on ne la regarde plus, si rien n'est en cours :
// ni partie ouverte, ni fenêtre, ni texte commencé. Sinon elle attend (le bandeau reste proposé).
function reloadIfIdle() {
  if (!state.updateReady || !document.hidden) return;
  const typing = [...document.querySelectorAll('textarea, input:not([type=checkbox]):not([type=radio])')].some((el) => el.value.trim());
  if (state.route.view !== 'table' && !document.querySelector('dialog[open]') && !typing) location.reload();
}
document.addEventListener('visibilitychange', reloadIfIdle);

function showUpdate(version) {
  state.updateReady = true;
  reloadIfIdle();
  if (document.querySelector('.update-banner')) return;
  const el = toast([
    h('span', 'Hubuno a été mis à jour.'),
    h('span.update-actions',
      h('button.btn.btn-dark.btn-sm', { type: 'button', onclick: () => location.reload() }, 'Recharger la page'),
      h('button.update-later', { type: 'button', onclick: () => { state.laterVersion = version; el.remove(); } }, 'Plus tard')),
  ], { ms: 24 * 3600_000 });
  el.classList.add('update-banner');
  el.setAttribute('role', 'status');
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
  const turnsNow = myTurnTables().length; // visible depuis un autre onglet ou une autre fenêtre
  document.title = `${total ? `(${total > 99 ? '99+' : total}) ` : ''}${turnsNow ? 'À toi de jouer · ' : ''}${pageName(state.route)} · Hubuno`;
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

  keepFocus(ui.nav, () => changedOnly(ui.nav).replaceChildren(
    h('a.nav-brand', { href: '#/', 'aria-label': 'Hubuno, accueil' }, h('span.brand-mark', 'H'), h('span.brand-name', 'Hubuno')),
    h('ul.nav-items',
      item('home', '#/', 'Accueil', icon('home')),
      item('games', '#/jouer', 'Jouer', icon('dice'), turnBadge, turns ? `, à toi de jouer sur ${count(turns, 'partie', 'parties')}` : null),
      item('messages', '#/messages', 'Messages', icon('chat'), badge, unreadText),
      item('members', '#/membres', 'Membres', icon('users')),
      isAdmin() ? item('admin', '#/admin', 'Admin', icon('shield')) : null,
      item('profile', '#/profil', 'Profil', token(state.me, { size: 's', online: true }))),
  ));
}

boot();
