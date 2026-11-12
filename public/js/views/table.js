// Écran d'une table (#/t/:id) : le salon (places, réglages, lancement), puis le jeu monté depuis games/<id>/client.js,
// les joueurs et le chat de la table. Sur téléphone, deux onglets : « Partie » et « Chat ».
import { h, icon, token, toast, colorOf, count, gameLogo, keepFocus, arrowKeys, announce, de } from '../dom.js';
import { call } from '../net.js';
import { state, go, gameOf, isAdmin, isStaff } from '../store.js';
import { modal, confirmDialog, openProfile } from '../dialogs.js';
import { secret, isDesktop, hideSecrets } from '../secret.js';

let cur = null; // la table ouverte, null quand on est ailleurs
// Les fichiers des jeux gardent la même adresse d'une visite à l'autre : le serveur les fait revérifier à chaque fois (réponse 304, quasi gratuite).
// Un ?v= changeant à chaque ouverture de page, comme avant, obligeait à retélécharger client.js et style.css en entier chaque fois.
const preloaded = new Set();
// Pendant que les joueurs s'installent au salon, le navigateur charge déjà le code du jeu (client.js et tout ce qu'il importe).
function preloadGame(id) {
  if (preloaded.has(id)) return;
  preloaded.add(id);
  document.head.append(h('link', { rel: 'modulepreload', href: `games/${id}/client.js` }));
}

const userOf = (id) => state.users.get(id) || { id, pseudo: 'Compte supprimé', avatar: '?', color: '' };
const isHost = () => cur?.table?.hostId === state.me.id;
const seated = () => Boolean(cur?.table?.seats.includes(state.me.id));
const mobile = () => matchMedia('(max-width: 760px)').matches;

export function render(container) {
  leave();
  const id = state.route.id;
  cur = { id, el: container, table: null, view: null, watchers: 0, offset: 0, listeners: new Set(), tab: 'game', chatUnread: 0, chat: [] };
  container.replaceChildren(h('div.table-loading', 'Ouverture de la partie…'));
  call(state.socket, 'table:watch', { id }).catch((err) => {
    if (cur?.id !== id) return;
    toast(err.message, { error: true });
    go('#/jouer');
  });
  loadChat(id);
}

export function leave() {
  if (!cur) return;
  if (state.socket?.connected) call(state.socket, 'table:unwatch', { id: cur.id }).catch(() => {});
  unmountGame();
  cur = null;
}

// ——— Événements du serveur ———

export function onTable(payload) {
  const { table, view, watchers, events, serverNow } = payload;
  if (!cur || table.id !== cur.id) return;
  const before = cur.table;
  cur.offset = serverNow - Date.now();
  cur.table = table;
  cur.view = view;
  cur.watchers = watchers;
  cur.events = events || [];
  cur.game = gameOf(table.game);
  renderChatFoot();
  joinIfWanted();
  if (!cur.ui) buildShell();
  renderHead();
  renderSide();
  if (table.status === 'lobby') {
    unmountGame();
    renderLobby();
  } else {
    // Une autre manche que celle qui est montée (revanche lancée pendant une coupure) : le jeu repart de zéro.
    if (cur.mounted && cur.mountedFor !== table.startedAt) unmountGame();
    if (!cur.mounted) mountGame();
    else notifyGame();
    renderEndBar();
  }
}

// Après une coupure de connexion : on redemande la partie et son chat, sans rien démonter. Le jeu reçoit l'état à jour,
// la saisie en cours (chat) et ce que le joueur regardait restent en place.
export function resync() {
  if (!cur) return;
  const id = cur.id;
  call(state.socket, 'table:watch', { id }).catch((err) => {
    if (cur?.id !== id) return;
    toast(err.message, { error: true });
    go('#/jouer');
  });
  loadChat(id, cur.chat);
}

// Rejoindre depuis la liste ou une invitation : on s'assoit en arrivant, sans second clic.
export function wantJoin(id) {
  state.joinOnOpen = Number(id);
  if (cur?.id === Number(id) && cur.table) joinIfWanted();
}

function joinIfWanted() {
  if (state.joinOnOpen !== cur?.id) return;
  state.joinOnOpen = null;
  const t = cur.table;
  if (t.status !== 'lobby' || t.seats.includes(state.me.id) || t.kicked?.includes(state.me.id) || t.seats.length >= cur.game.maxPlayers) return;
  call(state.socket, 'table:join', { id: t.id }).catch((err) => toast(err.message, { error: true }));
}

export function onKicked({ id }) {
  if (cur?.id !== id) return;
  toast('L’hôte t’a retiré de cette partie.');
  go('#/jouer');
}

export function onClosed({ id }) {
  if (cur?.id !== id) return;
  toast('La partie a été fermée.');
  unmountGame(); // sinon la 3D, le son et les écouteurs du jeu continuent de tourner
  cur = null;
  go('#/jouer');
}

// ——— Coque ———

function buildShell() {
  const g = cur.game;
  cur.ui = {
    head: h('header.table-head'),
    main: h('div.table-main'),
    side: h('aside.table-side', { 'aria-label': 'Joueurs et chat' }),
    players: h('section.table-players'),
    chat: h('section.table-chat', { 'aria-label': 'Chat de la partie' }),
  };
  cur.ui.side.append(cur.ui.players, cur.ui.chat);
  cur.ui.root = h(`div.${viewClass().replaceAll(' ', '.')}`, { 'data-game': g.id, style: `--g:${g.color};--g-ink:${g.ink}` },
    cur.ui.head, h('div.table-body', cur.ui.main, cur.ui.side));
  cur.el.replaceChildren(cur.ui.root);
  renderChat();
}

// Un jeu « large » prend tout l'écran pendant la partie ; dans le salon, la colonne des joueurs reste visible.
const isWide = () => Boolean(cur.game?.wide && cur.table?.status !== 'lobby');
const viewClass = () => `table-view tab-${cur.tab}${isWide() ? ' is-wide' : ''}`;

function setTab(tab) {
  if (!cur?.ui) return;
  cur.tab = tab;
  if (tab === 'chat') cur.chatUnread = 0;
  cur.ui.root.className = viewClass();
  renderHead();
  if (tab === 'chat') scrollChat();
}

const timeLeft = (deadline) => {
  const s = Math.max(0, Math.ceil((deadline - (Date.now() + (cur?.offset ?? 0))) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
setInterval(() => {
  const el = cur?.ui?.head?.querySelector('.tab-time');
  if (el && cur.table?.deadline) el.textContent = timeLeft(cur.table.deadline);
}, 1000);

function renderHead() {
  const { table: t, game: g } = cur;
  cur.ui.root.className = viewClass();
  const myTurn = cur.turnGated ? cur.turnShown : t.turn.includes(state.me.id); // un jeu peut retenir l'annonce jusqu'à la fin de son animation (api.showTurn)
  const label = t.status === 'lobby' ? 'En attente' : t.status === 'over' ? 'Terminée' : myTurn ? 'À toi de jouer' : 'En cours';
  if (cur.spoken !== undefined && cur.spoken !== label && (label === 'À toi de jouer' || label === 'Terminée')) announce(label === 'Terminée' ? 'Partie terminée.' : 'À toi de jouer.');
  if (cur.spoken !== undefined && cur.spoken !== 'Terminée' && label === 'Terminée' && cur.tab === 'chat' && (mobile() || isWide())) toast('Partie terminée : regarde l’onglet Partie.');
  cur.spoken = label;
  const tab = (key, text, extra) => h('button.table-tab', {
    type: 'button',
    dataset: { key: `tab-${key}` },
    role: 'tab',
    'aria-selected': String(cur.tab === key),
    onclick: () => setTab(key),
  }, text, extra);
  keepFocus(cur.ui.head, () => cur.ui.head.replaceChildren(...[
    h('a.icon-btn.table-back', { href: '#/jouer', title: 'Retour aux jeux', onclick: () => { if (t.status === 'lobby' && seated()) toast('Ta place reste gardée. Un salon vide se ferme au bout de 5 minutes.'); } }, icon('back', 'Retour aux jeux')),
    h('span.table-emoji', gameLogo(g)),
    h('div.table-title', h('h1', g.name), h('p', `Partie ${de(userOf(t.hostId).pseudo)}`)),
    h(`span.table-pill${t.status === 'playing' && myTurn ? '.is-turn' : ''}`, label),
    cur.watchers ? h('span.table-watchers', { title: count(cur.watchers, 'spectateur', 'spectateurs') }, icon('eye'), String(cur.watchers)) : null,
    seated() || t.status === 'lobby' ? null : h('span.table-pill.is-watch', 'Spectateur'),
    arrowKeys(h('div.table-tabs', { role: 'tablist', 'aria-label': 'Affichage' },
      // Depuis le chat, on garde un œil sur la partie : à qui c'est, et le temps qu'il reste.
      tab('game', 'Partie', cur.tab !== 'game' && t.status === 'over' ? h('span.tab-turn', { title: 'Partie terminée' }) : cur.tab !== 'game' && t.status === 'playing' ? [myTurn ? h('span.tab-turn', { title: 'À toi de jouer' }) : null, t.deadline ? h('span.tab-time', timeLeft(t.deadline)) : null] : null),
      tab('chat', 'Joueurs et chat', cur.chatUnread ? h('span.badge', String(cur.chatUnread)) : null))),
  ].filter(Boolean)));
}

// ——— Joueurs (colonne de droite) ———

function renderSide() {
  const { table: t, game: g } = cur;
  const rows = t.seats.map((id) => {
    const u = userOf(id);
    const turn = t.status === 'playing' && t.turn.includes(id);
    const won = t.status === 'over' && t.winners.includes(id);
    return h(`li.seat-row${turn ? '.is-turn' : ''}`,
      h('button.seat-user', { type: 'button', onclick: () => state.users.has(id) && openProfile(id) },
        token(u, { size: 's', online: state.online.has(id) }),
        h('span.label', u.pseudo),
        id === t.hostId ? h('span.tag-host', 'hôte') : null,
        won ? h('span.tag-win', 'gagne') : null,
        turn ? h('span.sr-only', ', à son tour') : null));
  });
  const inLobby = t.status === 'lobby'; // la carte du salon montre déjà les joueurs, Inviter et Quitter
  const actions = [];
  if (seated() && !inLobby) actions.push(h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: openInvite }, icon('users'), 'Inviter'));
  if (seated() && t.status === 'playing' && !t.left.includes(state.me.id)) actions.push(h('button.btn.btn-danger.btn-sm', { type: 'button', onclick: forfeit }, 'Abandonner'));
  if (seated() && t.status === 'over') actions.push(h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: leaveTable }, icon('logout'), 'Quitter la partie'));
  // Un modo ne ferme que la partie d'un membre (le serveur le vérifie aussi).
  if (isHost() || isAdmin() || (isStaff() && state.users.get(t.hostId)?.role === 'membre')) actions.push(h('button.btn.btn-danger.btn-sm', { type: 'button', onclick: closeTable }, icon('trash'), 'Fermer la partie'));
  keepFocus(cur.ui.players, () => cur.ui.players.replaceChildren(
    h('h2', 'Joueurs', h('span.section-count', `${t.seats.length}/${g.maxPlayers}`)),
    ...(inLobby ? [] : [h('ul.seat-list', rows)]),
    ...(actions.length ? [h('div.side-actions', actions)] : [])));
}

// ——— Salon ———

function playersLabel(g) {
  return g.minPlayers === g.maxPlayers ? `${g.minPlayers} joueurs` : `de ${g.minPlayers} à ${g.maxPlayers} joueurs`;
}

function optionControl(def, value, editable) {
  const send = (v) => call(state.socket, 'table:options', { id: cur.id, options: { [def.key]: v } }).catch((err) => toast(err.message, { error: true }));
  let control;
  if (def.type === 'multi') {
    const picked = value ?? def.default ?? [];
    const full = picked.length >= def.max;
    // Le minimum suit le nombre de joueurs, robots compris.
    const seats = cur.table.seats.length;
    const total = Math.min(cur.game.maxPlayers, seats + (Number(cur.table.options.bots) || (seats === 1 ? 3 : 0)));
    const need = def.minByPlayers ? Math.min(def.max, Math.max(def.minByPlayers, total)) : 0;
    const missing = Math.max(0, need - picked.length);
    const row = h('div.opt-row.is-multi',
      h('span.opt-label', def.label, def.help ? h('small', def.help) : null),
      h('div.multi-head', h('output.multi-count', { 'aria-live': 'polite' }, missing ? `${picked.length} choisis, ${missing} de plus tiré${missing > 1 ? 's' : ''} au hasard` : `${picked.length} sur ${def.max}`),
        editable ? h('button.link-btn', { type: 'button', onclick: () => send([...def.choices].map((c) => c.value).sort(() => Math.random() - 0.5).slice(0, def.max)) }, 'Au hasard') : null,
        editable && picked.length ? h('button.link-btn', { type: 'button', onclick: () => send([]) }, 'Tout enlever') : null),
      h('div.multi', { role: 'group', 'aria-label': def.label }, def.choices.map((c) => {
        const on = picked.includes(c.value);
        return h(`button.multi-item${on ? '.is-on' : ''}`, {
          type: 'button',
          'aria-pressed': String(on),
          disabled: !editable || (!on && full),
          onclick: () => send(on ? picked.filter((x) => x !== c.value) : [...picked, c.value]),
        }, c.image ? h('img.multi-flag', { src: `games/${cur.game.id}/${c.image}`, alt: '', width: 24, height: 16 }) : null, c.label);
      })));
    return row;
  }
  if (def.type === 'number') {
    control = h('div.stepper',
      h('button', { type: 'button', disabled: !editable || value <= def.min, 'aria-label': `${def.label} : moins`, onclick: () => send(value - 1) }, '−'),
      h('output', { 'aria-live': 'polite' }, String(value)),
      h('button', { type: 'button', disabled: !editable || value >= def.max, 'aria-label': `${def.label} : plus`, onclick: () => send(value + 1) }, '+'));
  } else if (def.type === 'bool') {
    control = h('button.switch-btn', { type: 'button', role: 'switch', 'aria-checked': String(Boolean(value)), 'aria-label': def.label, disabled: !editable, onclick: () => send(!value) }, h('span'));
  } else {
    control = arrowKeys(h('div.seg', { role: 'radiogroup', 'aria-label': def.label }, def.choices.map((c) => h('button', {
      type: 'button',
      role: 'radio',
      dataset: { key: `${def.key}-${c.value}` },
      'aria-checked': String(c.value === value),
      disabled: !editable,
      onclick: () => send(c.value),
    }, c.label))));
  }
  return h('div.opt-row', h('span.opt-label', def.label, def.help ? h('small', def.help) : null), control);
}

function renderLobby() {
  const { table: t, game: g } = cur;
  preloadGame(g.id);
  const full = t.seats.length >= g.maxPlayers;
  const missing = Math.max(0, g.minPlayers - t.seats.length);

  const seats = t.seats.map((id) => {
    const u = userOf(id);
    return h('li.lobby-seat',
      token(u, { online: state.online.has(id) }),
      h('span.label', u.pseudo, id === state.me.id ? h('span.tag-me', 'toi') : null),
      id === t.hostId ? h('span.tag-host', 'hôte') : null,
      isHost() && id !== state.me.id ? h('button.icon-btn.sm', {
        type: 'button',
        title: `Retirer ${u.pseudo} de la partie`,
        onclick: () => call(state.socket, 'table:kick', { id: cur.id, userId: id }).catch((err) => toast(err.message, { error: true })),
      }, icon('x', `Retirer ${u.pseudo}`)) : null);
  });
  if (!full) seats.push(h('li.lobby-seat.empty', h('span.token.empty-token', { 'aria-hidden': 'true' }, icon('plus')), h('span.label', g.maxPlayers - t.seats.length > 1 ? `${g.maxPlayers - t.seats.length} places libres` : '1 place libre')));

  const actions = [];
  if (!seated()) {
    actions.push(t.kicked?.includes(state.me.id)
      ? h('p.lobby-note', 'L’hôte t’a retiré de cette partie : tu pourras la regarder quand elle commencera.')
      : full
      ? h('p.lobby-note', 'La partie est complète : tu pourras la regarder quand elle commencera.')
      : h('button.btn.btn-dark', { type: 'button', onclick: (e) => act(e, 'table:join') }, icon('plus'), 'Rejoindre la partie'));
  } else {
    const waiting = missing > 0; // tant qu'on ne peut pas lancer, le bouton principal, c'est Inviter
    const invite = h(`button.btn.${waiting ? 'btn-dark' : 'btn-outline-dark'}`, { type: 'button', onclick: openInvite }, icon('users'), 'Inviter');
    if (waiting) actions.push(invite);
    if (isHost()) {
      actions.push(h(`button.btn.${waiting ? 'btn-outline-dark' : 'btn-dark'}`, { type: 'button', disabled: waiting, onclick: (e) => act(e, 'table:start') }, icon('dice'), 'Lancer la partie'));
    }
    if (!waiting) actions.push(invite);
    actions.push(h('button.btn.btn-outline-dark', { type: 'button', onclick: leaveTable }, icon('logout'), 'Quitter'));
  }
  const hint = missing > 0
    ? `Encore ${count(missing, 'joueur', 'joueurs')} pour lancer.`
    : isHost() ? 'Tout le monde est là ? Lance la partie.' : seated() ? (state.online.has(t.hostId) ? `${userOf(t.hostId).pseudo} peut lancer la partie.` : `${userOf(t.hostId).pseudo} est hors ligne : dans une minute, un autre joueur pourra lancer la partie.`) : null;

  // Le corps défile ; le pied (message + boutons) reste toujours visible en bas de la carte.
  const fillMain = (node) => keepFocus(cur.ui.main, () => cur.ui.main.replaceChildren(node));
  fillMain(h('div.lobby',
    h('section.lobby-card',
      h('div.lobby-body',
        h('div.lobby-top', h('span.lobby-emoji', gameLogo(g)), h('span.game-meta', playersLabel(g), g.duration ? ` · ${g.duration}` : '')),
        h('h2', g.name),
        h('p.lobby-desc', g.description),
        g.how?.length ? h('button.link-btn.dark', { type: 'button', onclick: () => openHow(g) }, 'Comment on joue ?') : null,
        h('ul.lobby-seats', seats),
        g.options.length ? h('div.lobby-options',
          h('h3', 'Réglages', isHost() ? null : h('small', ' · choisis par l’hôte')),
          g.options.map((d) => optionControl(d, t.options[d.key], isHost()))) : null),
      h('div.lobby-foot',
        hint ? h('p.lobby-note', hint) : null,
        h('div.card-actions', actions)))));
}

export function openHow(g) {
  modal(`${g.name} : les règles`, h('div.prose', h('ol.how', g.how.map((line) => h('li', line)))));
}

async function act(e, event) {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    await call(state.socket, event, { id: cur.id });
  } catch (err) {
    toast(err.message, { error: true });
  } finally {
    if (btn.isConnected) btn.disabled = false;
  }
}

async function leaveTable() {
  const id = cur.id;
  try {
    await call(state.socket, 'table:leave', { id });
    go('#/jouer');
  } catch (err) {
    toast(err.message, { error: true });
  }
}

async function forfeit() {
  const ok = await confirmDialog('Abandonner la partie', 'Tu quittes la partie en cours. Les autres continuent sans toi. Si vous étiez deux, ton adversaire gagne.', { confirmLabel: 'Abandonner', danger: true });
  if (!ok || !cur) return;
  try {
    await call(state.socket, 'table:leave', { id: cur.id });
  } catch (err) {
    toast(err.message, { error: true });
  }
}

async function closeTable() {
  const ok = await confirmDialog('Fermer la partie', 'La partie et son chat disparaissent pour tout le monde.', { confirmLabel: 'Fermer la partie', danger: true });
  if (!ok || !cur) return;
  try {
    await call(state.socket, 'table:close', { id: cur.id });
  } catch (err) {
    toast(err.message, { error: true });
  }
}

function openInvite() {
  const t = cur.table;
  const people = [...state.users.values()]
    .filter((u) => u.id !== state.me.id && !t.seats.includes(u.id))
    .sort((a, b) => Number(state.online.has(b.id)) - Number(state.online.has(a.id)) || a.pseudo.localeCompare(b.pseudo, 'fr'));
  const chosen = new Set();
  const list = h('ul.invite-list', people.map((u) => h('li', h('label.invite-row',
    h('input', { type: 'checkbox', onchange: (e) => (e.target.checked ? chosen.add(u.id) : chosen.delete(u.id)) }),
    token(u, { size: 's', online: state.online.has(u.id) }),
    h('span.label', u.pseudo),
    h('small', state.online.has(u.id) ? 'en ligne' : 'hors ligne')))));
  const dlg = modal('Inviter à la partie',
    h('p', 'Les personnes choisies reçoivent une notification pour rejoindre.'),
    people.length ? list : h('p', 'Tout le monde est déjà dans la partie.'),
    h('div.dlg-actions',
      h('button.btn.btn-ghost', { type: 'button', onclick: () => dlg.close() }, 'Annuler'),
      h('button.btn', {
        type: 'button',
        onclick: async () => {
          try {
            const { sent } = await call(state.socket, 'table:invite', { id: t.id, userIds: [...chosen] });
            toast(`${count(sent, 'invitation envoyée', 'invitations envoyées')}.`);
            dlg.close();
          } catch (err) {
            toast(err.message, { error: true });
          }
        },
      }, 'Inviter')));
}

// ——— Le jeu ———

function info() {
  const t = cur.table;
  return {
    status: t.status, turn: t.turn, over: t.over, winners: t.winners, deadline: t.deadline,
    events: cur.events, watchers: cur.watchers, isPlayer: seated(), hostId: t.hostId,
  };
}

function notifyGame() {
  for (const cb of cur.listeners) {
    try {
      cb(cur.view, info());
    } catch (err) {
      console.error(err);
    }
  }
}

async function mountGame() {
  const mine = cur;
  const g = cur.game;
  mine.mounted = true;
  mine.mountedFor = mine.table.startedAt;
  mine.stage = h(`div.game-stage.g-${g.id}`);
  mine.endbar = h('div.table-endbar', { hidden: true });
  cur.ui.main.replaceChildren(mine.endbar, mine.stage);
  if (g.style && !document.querySelector(`link[data-game="${g.id}"]`)) {
    document.head.append(h('link', { rel: 'stylesheet', href: `games/${g.id}/style.css`, dataset: { game: g.id } }));
  }
  const api = {
    game: g,
    me: state.me,
    seat: mine.table.seats.indexOf(state.me.id),
    players: mine.table.seats.map(userOf),
    user: userOf,
    colorOf,
    onState(cb) {
      mine.listeners.add(cb);
      if (mine.view !== null) cb(mine.view, info());
      return () => mine.listeners.delete(cb);
    },
    sendMove(action) {
      return call(state.socket, 'table:move', { id: mine.id, action }).catch((err) => {
        toast(err.message, { error: true, ms: 2400 }); // assez court : il passe au-dessus des joueurs
        throw err;
      });
    },
    now: () => Date.now() + mine.offset,
    openChat: () => setTab('chat'),
    gateTurn() { mine.turnGated = true; mine.overShown = false; mine.turnShown = mine.table.turn.includes(state.me.id); },
    showTurn() {
      if (cur !== mine || !mine.turnGated) return;
      const now = mine.table.turn.includes(state.me.id);
      if (now !== mine.turnShown) {
        mine.turnShown = now;
        renderHead();
      }
      if (mine.table.status === 'over' && !mine.overShown) {
        mine.overShown = true;
        renderEndBar();
      }
    },
    asset: (path) => `games/${g.id}/assets/${path}`,
    h,
    token,
    toast,
    hidesSecrets: () => isDesktop() && hideSecrets(), // vrai si les secrets sont masqués sur cet écran
    secret, // en classe, sur ordinateur : masque un rôle, un mot, une main secrète (maintenir le clic pour voir)
  };
  try {
    const mod = await import(`../../games/${g.id}/client.js`);
    if (cur !== mine || !mine.mounted) return;
    mine.cleanup = mod.mount(mine.stage, api);
  } catch (err) {
    console.error(err);
    if (cur === mine) mine.stage.replaceChildren(h('p.game-error', 'Le jeu n’a pas pu se charger. Recharge la page ; si ça continue, préviens un admin.'));
  }
}

function unmountGame() {
  if (!cur?.mounted) return;
  cur.mounted = false;
  cur.turnGated = false;
  cur.overShown = false;
  cur.listeners.clear();
  try {
    if (typeof cur.cleanup === 'function') cur.cleanup();
  } catch (err) {
    console.error(err);
  }
  cur.cleanup = null;
}

function renderEndBar() {
  const { table: t, endbar } = cur;
  if (!endbar) return;
  // Un jeu animé garde la fin pour lui jusqu'à la fin de sa dernière animation (api.showTurn).
  endbar.hidden = t.status !== 'over' || (cur.turnGated && !cur.overShown);
  if (endbar.hidden) return;
  const names = t.winners.map((id) => userOf(id).pseudo);
  endbar.replaceChildren(h('div.endbar',
    h('p', h('b', 'Partie terminée'), t.label ? ` · ${t.label.replace(new RegExp(`^${state.me.pseudo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} gagne$`), 'Tu gagnes')}` : names.length ? ` · ${names.length > 1 ? 'Gagnants' : 'Gagnant'} : ${names.join(', ')}` : ' · Personne ne gagne'),
    h('div.endbar-actions',
      // N'importe quel joueur de la partie peut lancer la revanche (l'hôte a pu partir).
      seated() ? h('button.btn.btn-sm', { type: 'button', onclick: (e) => act(e, 'table:restart') }, 'Revanche') : null,
      h('a.btn.btn-ghost.btn-sm', { href: '#/jouer' }, 'Retour aux jeux'))));
}

// ——— Chat de la table ———

// before : les messages déjà affichés avant une coupure (ils sont remplacés par l'historique à jour : un message effacé entre-temps disparaît).
async function loadChat(id, before = []) {
  const stale = new Set(before.map((m) => m.id));
  try {
    const res = await call(state.socket, 'history', { scope: `t:${id}` });
    if (cur?.id !== id) return;
    const known = new Set(res.messages.map((m) => m.id));
    cur.chat = [...res.messages, ...cur.chat.filter((m) => !known.has(m.id) && !stale.has(m.id))]; // ceux arrivés pendant le chargement restent
    renderChatList();
  } catch {
    // La table n'existe plus : l'erreur est déjà affichée par table:watch.
  }
}

function chatMessage(m) {
  const u = userOf(m.userId);
  return h('li.tchat-msg', { style: `--author:${colorOf(u.color)}` },
    token(u, { size: 's' }),
    h('div', h('b', u.pseudo), h('p', m.body)));
}

// Le chat est construit une fois ; seuls les messages sont redessinés (la saisie en cours ne se perd pas).
function renderChat() {
  if (!cur?.ui) return;
  cur.ui.chatList = h('ol.tchat-list');
  const input = h('input.input', { type: 'text', placeholder: 'Écrire aux joueurs', 'aria-label': 'Écrire aux joueurs', maxlength: 500, enterkeyhint: 'send', autocomplete: 'off' });
  const form = h('form.tchat-form', input, h('button.btn', { type: 'submit', title: 'Envoyer' }, icon('send', 'Envoyer')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body) return;
    input.value = '';
    try {
      await call(state.socket, 'send', { scope: `t:${cur.id}`, body });
    } catch (err) {
      input.value = body;
      toast(err.message, { error: true });
    }
  });
  cur.ui.chatForm = form;
  cur.ui.chatFoot = h('div.tchat-foot');
  cur.ui.chat.replaceChildren(h('h2', 'Chat de la partie'), h('div.tchat-log', { role: 'log', 'aria-live': 'off', 'aria-label': 'Messages de la partie' }, cur.ui.chatList), cur.ui.chatFoot);
  renderChatFoot();
  renderChatList();
}

// Sous le chat : la zone d'écriture, ou pourquoi on ne peut pas écrire (sourdine, éliminé du jeu). Le texte en cours est gardé.
function renderChatFoot() {
  if (!cur?.ui?.chatFoot) return;
  const muted = state.mutedUntil > Date.now();
  const silent = cur.table?.silent?.includes(state.me.id);
  const next = muted ? h('p.composer-note', 'Tu es en sourdine.')
    : silent ? h('p.composer-note', 'Tu es éliminé : tu pourras écrire aux joueurs à la fin de la partie.')
      : cur.ui.chatForm;
  if (cur.ui.chatFoot.firstChild !== next) cur.ui.chatFoot.replaceChildren(next);
}

function renderChatList() {
  if (!cur?.ui?.chatList) return;
  cur.ui.chatList.replaceChildren(...(cur.chat.length
    ? cur.chat.map(chatMessage)
    : [h('li.tchat-empty', 'Le chat de la partie. Joueurs et spectateurs peuvent écrire ici.')]));
  scrollChat();
}

function scrollChat() {
  const list = cur?.ui?.chatList;
  if (list) list.scrollTop = list.scrollHeight;
}

export function onMessage(m) {
  if (!cur || m.scope !== `t:${cur.id}`) return;
  if (cur.chat.some((x) => x.id === m.id)) return;
  cur.chat.push(m);
  if (cur.chat.length > 200) cur.chat.shift();
  if (m.userId !== state.me.id && (mobile() || isWide()) && cur.tab !== 'chat') {
    cur.chatUnread += 1;
    renderHead();
  } else if (m.userId !== state.me.id) {
    announce(`${userOf(m.userId).pseudo} : ${m.body}`);
  }
  renderChatList();
}

export function onMessageDeleted({ id, scope }) {
  if (!cur || scope !== `t:${cur.id}`) return;
  cur.chat = cur.chat.filter((m) => m.id !== id);
  renderChatList();
}

export function onMuted() {
  renderChat();
}

// Profils ou présence changés : on redessine les joueurs.
export function refresh() {
  if (!cur?.ui || !cur.table) return;
  renderSide();
  if (cur.table.status === 'lobby') renderLobby();
}
