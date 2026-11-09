// Écran Messages : liste des canaux et des messages privés, conversation, membres en ligne (grand écran).
// Sur téléphone, la liste et la conversation s'affichent l'une après l'autre (#/messages puis #/c/1).
import { h, icon, token, toast, colorOf, staffTag, mentions, timeOf, dayKey, dayLabel, stamp, richText, count, keepFocus, announce } from '../dom.js';
import { call } from '../net.js';
import { state, dmScope, otherOf, isAdmin, isStaff, roleColor, sortedUsers } from '../store.js';
import { openProfile, openChannelEditor, confirmDialog } from '../dialogs.js';

let ui = null; // éléments de l'écran ouvert, null quand on est ailleurs

const mobile = () => matchMedia('(max-width: 760px), (max-height: 500px)').matches;
const touch = () => matchMedia('(hover: none)').matches;

export function currentScope() {
  const { view, id } = state.route;
  if (view === 'channel') return `c:${id}`;
  if (view === 'dm') return dmScope(id);
  return null;
}

export function leave() {
  ui = null;
}

// ——— Rendu de l'écran ———

export function render(container) {
  const scope = currentScope();
  ui = {
    list: h('nav.conv-list', { 'aria-label': 'Conversations' }),
    conv: h('section.conv'),
    online: h('aside.online-col', { 'aria-label': 'En ligne' }),
  };
  container.classList.add(scope ? 'has-conv' : 'has-list');
  container.replaceChildren(ui.list, ui.conv, ui.online);
  renderList();
  renderOnline();
  if (scope) openConversation(scope);
  else ui.conv.replaceChildren(h('div.conv-empty', h('p', 'Choisis un canal ou une conversation.')));
}

const badge = (n) => (n ? h('span.badge', { 'aria-label': count(n, 'message non lu', 'messages non lus') }, n > 99 ? '99+' : String(n)) : null);

export function renderList() {
  if (!ui) return;
  const scope = currentScope();
  const channelItems = state.channels.map((c) => {
    const s = `c:${c.id}`;
    return h('li', h('a', {
      href: `#/c/${c.id}`,
      className: `conv-item${state.unread[s] ? ' has-unread' : ''}`,
      'aria-current': scope === s ? 'page' : null,
    }, h('span.conv-icon', icon(c.staffOnly ? 'shield' : 'hash')), h('span.label', c.name), badge(state.unread[s])));
  });

  // Les conversations privées, plus celle qu'on vient d'ouvrir et qui n'a pas encore de message.
  const dmIds = state.dms.map((d) => d.otherId).filter((id) => state.users.has(id));
  if (state.route.view === 'dm' && !dmIds.includes(state.route.id)) dmIds.unshift(state.route.id);
  const dmItems = dmIds.map((id) => {
    const u = state.users.get(id);
    const s = dmScope(id);
    return h('li', h('a', {
      href: `#/dm/${id}`,
      className: `conv-item${state.unread[s] ? ' has-unread' : ''}`,
      'aria-current': scope === s ? 'page' : null,
    }, token(u, { size: 's', online: state.online.has(id) }), h('span.label', u.pseudo), badge(state.unread[s])));
  });

  keepFocus(ui.list, () => ui.list.replaceChildren(
    h('div.view-head', h(scope ? 'h2' : 'h1', 'Messages')),
    h('div.conv-scroll',
      h('div.nav-title', h('h2', 'Canaux'),
        isAdmin() ? h('button.icon-btn.sm', { type: 'button', onclick: () => openChannelEditor(), title: 'Créer un canal' }, icon('plus', 'Créer un canal')) : null),
      h('ul.nav-list', channelItems),
      h('div.nav-title', h('h2', 'Messages privés'),
        h('a.icon-btn.sm', { href: '#/membres', title: 'Écrire à quelqu’un' }, icon('plus', 'Écrire à quelqu’un'))),
      dmItems.length ? h('ul.nav-list', dmItems) : h('p.nav-empty', 'Aucune conversation privée. Choisis quelqu’un dans Membres pour lui écrire.')),
  ));
}

export function renderOnline() {
  if (!ui) return;
  const users = sortedUsers().filter((u) => u.id !== state.me.id);
  const on = users.filter((u) => state.online.has(u.id));
  const row = (u, isOn) => h(`button.member${isOn ? '' : '.offline'}`, { type: 'button', onclick: () => openProfile(u.id) },
    token(u, { online: isOn }), h('span.label', { style: roleColor(u) ? `color:${colorOf(roleColor(u))}` : null }, u.pseudo), staffTag(u));
  keepFocus(ui.online, () => ui.online.replaceChildren(
    h('h2', `En ligne — ${on.length}`),
    ...(on.length ? on.map((u) => row(u, true)) : [h('p.nav-empty', 'Personne d’autre pour l’instant.')]),
    ...(users.length > on.length ? [h('h2', `Hors ligne — ${users.length - on.length}`), ...users.filter((u) => !state.online.has(u.id)).map((u) => row(u, false))] : []),
  ));
}

function openConversation(scope) {
  let title;
  let topic = null;
  if (state.route.view === 'channel') {
    const c = state.channels.find((x) => x.id === state.route.id);
    title = h('h1', icon(c.staffOnly ? 'shield' : 'hash'), h('span.label', c.name), c.staffOnly ? h('span.tag-admin.tag-modo', 'équipe') : null);
    topic = c.topic;
  } else {
    const u = state.users.get(state.route.id);
    title = h('h1', h('button.head-user', { type: 'button', onclick: () => openProfile(u.id) },
      token(u, { size: 's', online: state.online.has(u.id) }), h('span.label', u.pseudo)));
    topic = state.online.has(u.id) ? 'En ligne' : 'Hors ligne';
  }
  ui.messages = h('div.messages', { role: 'log', 'aria-live': 'off', 'aria-label': 'Messages', tabindex: '0' }); // les nouveaux messages sont annoncés un par un (announce)
  ui.typing = h('div.typing', { 'aria-hidden': 'true' });
  ui.composer = h('div');
  ui.jump = h('button.jump-new', {
    type: 'button',
    hidden: true,
    onclick: () => {
      ui.messages.scrollTop = ui.messages.scrollHeight;
      ui.jump.hidden = true;
      ui.composer.querySelector('textarea')?.focus({ preventScroll: true });
    },
  }, 'Nouveaux messages ↓');
  ui.conv.replaceChildren(
    h('header.conv-head',
      h('a.icon-btn.back', {
        href: '#/messages',
        title: 'Retour aux conversations',
        // Venu de la liste : on y revient, sans ajouter une étape que le Retour du navigateur rouvrirait.
        onclick: (e) => { if (state.cameFrom === 'messages') { e.preventDefault(); history.back(); } },
      }, icon('back', 'Retour aux conversations')),
      title,
      topic ? h('p.topic', topic) : null,
      state.route.view === 'channel' && isAdmin()
        ? h('button.icon-btn.head-action', {
          type: 'button',
          title: 'Modifier le canal',
          onclick: () => openChannelEditor(state.channels.find((x) => x.id === state.route.id)),
        }, icon('pencil', 'Modifier le canal'))
        : null),
    ui.messages,
    h('div.composer-wrap', ui.jump, ui.typing, ui.composer),
  );
  let atBottom = true;
  ui.messages.addEventListener('scroll', () => {
    atBottom = nearBottom();
    if (atBottom) {
      ui.jump.hidden = true;
      markRead();
    }
  });
  // Le clavier du téléphone réduit la liste : si on lisait la fin, on la garde sous les yeux.
  if (typeof ResizeObserver === 'function') {
    const box = ui.messages;
    new ResizeObserver(() => { if (atBottom) box.scrollTop = box.scrollHeight; }).observe(box);
  }
  renderComposer();
  renderTyping();

  const conv = state.convs.get(scope);
  if (conv?.loaded) {
    placeNewLine(scope);
    renderMessages({ toBottom: true });
    markRead();
  } else {
    ui.messages.replaceChildren(h('p.messages-start', 'Chargement des messages…'));
    loadHistory(scope);
  }
}

async function loadHistory(scope, before) {
  try {
    const res = await call(state.socket, 'history', { scope, before });
    const conv = state.convs.get(scope) || { messages: [], complete: false, loaded: false };
    const known = new Set(conv.messages.map((m) => m.id));
    conv.messages = [...res.messages.filter((m) => !known.has(m.id)), ...conv.messages];
    // Un message resté « Pas envoyé » pendant une coupure a pu arriver quand même : il n'apparaît alors qu'une fois.
    const mine = res.messages.filter((m) => m.userId === state.me.id);
    conv.messages = conv.messages.filter((x) => x.id > 0 || !mine.some((m) => m.body === x.body && m.createdAt >= x.createdAt - 5000));
    conv.complete = res.complete;
    conv.loaded = true;
    state.convs.set(scope, conv);
    if (!ui?.messages || scope !== currentScope()) return;
    if (before) {
      const fromBottom = ui.messages.scrollHeight - ui.messages.scrollTop;
      renderMessages();
      ui.messages.scrollTop = ui.messages.scrollHeight - fromBottom;
    } else {
      placeNewLine(scope);
      renderMessages({ toBottom: true });
      markRead();
    }
  } catch (err) {
    toast(err.message, { error: true });
  }
}

// Le repère « Nouveaux messages » : avant le premier message reçu depuis la dernière visite.
function placeNewLine(scope) {
  const conv = state.convs.get(scope);
  const n = state.unread[scope] || 0;
  const others = conv.messages.filter((m) => m.id > 0 && m.userId !== state.me.id);
  conv.newFrom = n ? (others.at(-n) ?? others[0])?.id ?? null : null;
}

function nearBottom() {
  return ui?.messages ? ui.messages.scrollHeight - ui.messages.scrollTop - ui.messages.clientHeight < 80 : false;
}

// Signale au serveur ce qu'on a lu, et met à jour les pastilles.
function markRead() {
  const scope = currentScope();
  if (!scope || document.hidden || !ui?.messages) return;
  const conv = state.convs.get(scope);
  if (!state.unread[scope] && !conv?.pendingRead) return;
  delete state.unread[scope];
  if (conv) conv.pendingRead = false;
  const last = conv?.messages.filter((m) => m.id > 0).at(-1);
  if (last) call(state.socket, 'read', { scope, lastId: last.id }).catch(() => {});
  renderList();
  onUnreadChange();
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) markRead();
});

// Appelé par app.js pour rafraîchir la pastille de la barre de navigation.
let onUnreadChange = () => {};
export function setUnreadListener(fn) {
  onUnreadChange = fn;
}

function conversationStart() {
  if (state.route.view === 'channel') {
    const c = state.channels.find((x) => x.id === state.route.id);
    return h('div.messages-start',
      h('div.start-icon', icon('hash')),
      h('h2', `Bienvenue dans #${c.name}`),
      h('p', c.topic ? `${c.topic}. C’est le début du canal.` : 'C’est le début du canal.'));
  }
  const u = state.users.get(state.route.id);
  return h('div.messages-start',
    token(u, { size: 'l' }),
    h('h2', u.pseudo),
    h('p', `C’est le début de ta conversation privée avec ${u.pseudo}. Vous seuls la voyez.`));
}

// Un message ouvre un nouveau groupe quand l'auteur change, après 7 minutes ou au changement de jour.
function startsGroup(prev, m) {
  return !prev || prev.userId !== m.userId || m.createdAt - prev.createdAt > 7 * 60_000 || dayKey(prev.createdAt) !== dayKey(m.createdAt);
}

function renderMessages({ toBottom = false } = {}) {
  if (!ui?.messages) return;
  const conv = state.convs.get(currentScope());
  if (!conv?.loaded) return;
  const stick = toBottom || nearBottom();
  const nodes = [];
  if (conv.complete) nodes.push(conversationStart());
  else {
    nodes.push(h('div.load-more', h('button.btn.btn-ghost', {
      type: 'button',
      onclick: (e) => {
        e.currentTarget.disabled = true;
        loadHistory(currentScope(), conv.messages.find((m) => m.id > 0)?.id);
      },
    }, 'Voir les messages plus anciens')));
  }
  let prev = null;
  for (const m of conv.messages) {
    if (!prev || dayKey(prev.createdAt) !== dayKey(m.createdAt)) nodes.push(h('div.day', { role: 'separator' }, dayLabel(m.createdAt)));
    if (m.id === conv.newFrom) nodes.push(h('div.new-line', { role: 'separator' }, 'Nouveaux messages'));
    nodes.push(messageEl(m, startsGroup(prev, m)));
    prev = m;
  }
  keepFocus(ui.messages, () => ui.messages.replaceChildren(...nodes));
  if (stick) ui.messages.scrollTop = ui.messages.scrollHeight;
  // À l'ouverture, s'il y a beaucoup de nouveaux messages, on commence par le premier.
  if (toBottom) ui.messages.querySelector('.new-line')?.scrollIntoView({ block: 'nearest' });
}

// Les mentions : « @pseudo » d'un compte qui existe.
function byPseudo(name) {
  const low = name.toLowerCase();
  for (const u of state.users.values()) if (u.pseudo.toLowerCase() === low) return { pseudo: u.pseudo, me: u.id === state.me.id };
  return null;
}

// La corbeille : un admin partout ; un modo seulement sur les messages des membres, hors messages privés (le serveur le vérifie aussi).
const canDelete = (m, author) => isAdmin() || (isStaff() && author.role === 'membre' && !String(m.scope ?? '').startsWith('dm:'));

function messageEl(m, first) {
  const author = state.users.get(m.userId) || { pseudo: 'Compte supprimé', avatar: '?', color: '' };
  const el = h(`article.msg${first ? '.first' : ''}${m.pending ? '.pending' : ''}${m.failed ? '.failed' : ''}`, {
    dataset: { id: String(m.id) },
    style: `--author:${colorOf(roleColor(author) ?? author.color)}`, // la couleur du premier rôle, comme sur Discord
    'aria-label': `${author.pseudo}, ${stamp(m.createdAt)}`,
  });
  if (first) {
    el.append(
      token(author),
      h('div.msg-head',
        h('button.msg-author', { type: 'button', onclick: () => state.users.has(m.userId) && openProfile(m.userId) }, author.pseudo),
        staffTag(author),
        h('time.msg-time', { dateTime: new Date(m.createdAt).toISOString(), title: stamp(m.createdAt) }, timeOf(m.createdAt))), // le jour est déjà dans le séparateur
    );
  } else {
    el.append(h('time.msg-side-time', { dateTime: new Date(m.createdAt).toISOString() }, timeOf(m.createdAt)));
  }
  el.append(h('p.msg-body', richText(m.body, byPseudo)));
  if (m.userId !== state.me.id && mentions(m.body, state.me.pseudo)) el.classList.add('is-mention'); // on te parle : le message ressort

  if (m.failed) {
    el.append(h('div.msg-fail', 'Pas envoyé.',
      h('button.link-btn', { type: 'button', onclick: () => send(m.scope, m.body, m) }, 'Réessayer'),
      h('button.link-btn', { type: 'button', onclick: () => dropLocal(m) }, 'Effacer')));
  }

  const emojis = Object.keys(m.reactions || {});
  if (emojis.length) {
    el.append(h('div.reactions', emojis.map((e) => {
      const who = m.reactions[e];
      const mine = who.includes(state.me.id);
      const names = who.map((id) => state.users.get(id)?.pseudo).filter(Boolean).join(', ');
      return h('button.reaction', {
        type: 'button',
        'aria-pressed': String(mine),
        title: names,
        dataset: { key: `reaction-${e}` },
        'aria-label': `${e} ${who.length}, ${names}${mine ? '. Retirer ma réaction' : '. Réagir aussi'}`,
        onclick: () => react(m, e),
      }, e, h('b', String(who.length)));
    })));
  }

  if (m.id > 0) {
    el.append(h('div.msg-tools',
      h('button.icon-btn', { type: 'button', title: 'Réagir', onclick: (e) => togglePicker(el, m, e.currentTarget) }, icon('smile', `Réagir au message écrit par ${author.pseudo}`)),
      canDelete(m, author) ? h('button.icon-btn.danger', { type: 'button', title: 'Supprimer (modération)', onclick: () => adminDelete(m) }, icon('trash', `Supprimer le message écrit par ${author.pseudo}`)) : null));
    // Sur écran tactile, un appui sur le message montre les outils.
    el.addEventListener('click', (e) => {
      if (e.target.closest('button, a') || !touch()) return;
      for (const x of ui.messages.querySelectorAll('.tools-open')) if (x !== el) x.classList.remove('tools-open');
      el.classList.toggle('tools-open');
    });
  }
  return el;
}

function updateMessageEl(m) {
  const old = ui?.messages?.querySelector(`[data-id="${m.id}"]`);
  if (!old) return;
  keepFocus(ui.messages, () => old.replaceWith(messageEl(m, old.classList.contains('first'))));
}

function togglePicker(el, m, opener) {
  const open = el.querySelector('.picker');
  if (open) {
    open.remove();
    return;
  }
  // Se ferme de la même façon quel que soit le chemin : le focus revient au bouton « Réagir », sauf si on a cliqué ailleurs.
  const close = ({ refocus = true } = {}) => {
    picker.remove();
    document.removeEventListener('pointerdown', onPointer, true);
    document.removeEventListener('keydown', onKey, true);
    if (refocus && opener.isConnected) opener.focus();
  };
  const onPointer = (ev) => { if (!picker.contains(ev.target)) close({ refocus: false }); };
  const onKey = (ev) => { if (ev.key === 'Escape') close(); };
  const picker = h('div.picker', { role: 'group', 'aria-label': 'Choisir une réaction' },
    state.options.reactions.map((e) => h('button', {
      type: 'button',
      'aria-label': `Réagir avec ${e}`,
      onclick: () => {
        close();
        react(m, e);
      },
    }, e)));
  el.append(picker);
  picker.querySelector('button').focus();
  document.addEventListener('pointerdown', onPointer, true);
  document.addEventListener('keydown', onKey, true);
}

async function react(m, emoji) {
  try {
    await call(state.socket, 'react', { messageId: m.id, emoji });
  } catch (err) {
    toast(err.message, { error: true });
  }
}

async function adminDelete(m) {
  const author = state.users.get(m.userId)?.pseudo || 'cette personne';
  const ok = await confirmDialog('Supprimer le message', `Le message écrit par ${author} disparaîtra pour tout le monde.`,
    { confirmLabel: 'Supprimer', danger: true });
  if (!ok) return;
  try {
    await call(state.socket, 'admin:deleteMessage', { id: m.id });
    toast('Message supprimé.');
  } catch (err) {
    toast(err.message, { error: true });
  }
}

// ——— Zone d'écriture ———

let lastTyping = 0;
let localId = -1;

export function renderComposer() {
  if (!ui?.composer) return;
  if (state.mutedUntil > Date.now()) {
    const until = new Date(state.mutedUntil).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
    ui.composer.replaceChildren(h('p.composer-note', `Tu es en sourdine jusqu’à ${until}. Tu peux lire, mais pas écrire.`));
    return;
  }
  const scope = currentScope();
  const name = state.route.view === 'channel'
    ? `#${state.channels.find((c) => c.id === state.route.id)?.name}`
    : state.users.get(state.route.id)?.pseudo;
  const area = h('textarea', {
    rows: 1,
    placeholder: `Écrire à ${name}`,
    'aria-label': `Écrire à ${name}`,
    maxlength: state.options.limits.messageMax,
    enterkeyhint: 'send',
  });
  const picks = h('ul.mention-picks', { id: 'mention-picks', role: 'listbox', 'aria-label': 'Mentionner', hidden: true });
  area.setAttribute('aria-autocomplete', 'list');
  area.setAttribute('aria-controls', 'mention-picks');
  area.setAttribute('aria-expanded', 'false');
  const form = h('form.composer', picks, area, h('button.btn', { type: 'submit', title: 'Envoyer' }, icon('send', 'Envoyer')));

  // « @ » propose les pseudos : flèches pour choisir, Entrée ou Tab pour insérer, Échap pour fermer.
  let found = [];
  let active = 0;
  const query = () => /(^|\s)@([\p{L}\p{N}_.-]{0,20})$/u.exec(area.value.slice(0, area.selectionStart));
  const closePicks = () => {
    found = [];
    picks.hidden = true;
    area.setAttribute('aria-expanded', 'false');
    area.removeAttribute('aria-activedescendant');
  };
  const insert = (u) => {
    const q = query();
    if (!q) return closePicks();
    const start = area.selectionStart - q[2].length - 1;
    area.setRangeText(`@${u.pseudo} `, start, area.selectionStart, 'end');
    closePicks();
    area.focus();
    grow();
  };
  const drawPicks = () => {
    picks.replaceChildren(...found.map((u, i) => h('li', {
      id: `mention-${u.id}`,
      role: 'option',
      'aria-selected': String(i === active),
      onmousedown: (e) => { e.preventDefault(); insert(u); }, // avant que le champ perde le focus
    }, token(u, { size: 's', online: state.online.has(u.id) }), h('span', u.pseudo))));
    picks.hidden = !found.length;
    area.setAttribute('aria-expanded', String(Boolean(found.length)));
    if (found.length) area.setAttribute('aria-activedescendant', `mention-${found[active].id}`);
  };
  const updatePicks = () => {
    const q = query();
    if (!q) return closePicks();
    const low = q[2].toLowerCase();
    found = sortedUsers().filter((u) => u.id !== state.me.id && u.pseudo.toLowerCase().startsWith(low)).slice(0, 6);
    active = 0;
    return drawPicks();
  };
  area.addEventListener('blur', closePicks);
  area.addEventListener('click', updatePicks);

  const grow = () => {
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;
  };
  area.addEventListener('input', () => {
    grow();
    updatePicks();
    if (area.value.trim() && Date.now() - lastTyping > 3000) {
      lastTyping = Date.now();
      call(state.socket, 'typing', { scope }).catch(() => {});
    }
  });
  area.addEventListener('keydown', (e) => {
    if (found.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : found.length - 1)) % found.length;
        drawPicks();
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.isComposing) {
        e.preventDefault();
        insert(found[active]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // ferme seulement la liste, pas la conversation
        closePicks();
        return;
      }
    }
    // Entrée envoie, Maj + Entrée va à la ligne (sauf pendant une saisie d'accent ou sur écran tactile).
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !touch()) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const body = area.value.trim();
    if (!body) return;
    area.value = '';
    grow();
    lastTyping = 0;
    send(scope, body);
    area.focus();
  });
  ui.composer.replaceChildren(form);
  if (!touch() && !mobile()) area.focus({ preventScroll: true });
}

async function send(scope, body, existing) {
  const conv = state.convs.get(scope);
  const local = existing || { id: localId--, scope, userId: state.me.id, body, createdAt: Date.now(), reactions: {} };
  local.pending = true;
  local.failed = false;
  if (!existing) conv?.messages.push(local);
  if (scope === currentScope()) renderMessages({ toBottom: true });
  try {
    const { message } = await call(state.socket, 'send', { scope, body });
    const live = state.convs.get(scope); // une reconnexion a pu recharger la conversation pendant l'envoi
    if (live) {
      const i = live.messages.indexOf(local);
      if (i >= 0) {
        if (live.messages.some((x) => x.id === message.id)) live.messages.splice(i, 1);
        else live.messages[i] = message;
      }
    }
  } catch (err) {
    local.pending = false;
    local.failed = true;
    toast(err.message, { error: true });
  }
  if (scope === currentScope()) renderMessages();
}

function dropLocal(m) {
  const conv = state.convs.get(m.scope);
  if (conv) conv.messages = conv.messages.filter((x) => x !== m);
  renderMessages();
}

export function renderTyping() {
  if (!ui?.typing) return;
  const ids = [...(state.typing.get(currentScope())?.keys() || [])].filter((id) => id !== state.me.id);
  const names = ids.map((id) => state.users.get(id)?.pseudo).filter(Boolean);
  ui.typing.textContent = !names.length ? ''
    : names.length === 1 ? `${names[0]} écrit…`
      : names.length <= 3 ? `${names.slice(0, -1).join(', ')} et ${names.at(-1)} écrivent…`
        : 'Plusieurs personnes écrivent…';
}

// ——— Événements du serveur (l'état est tenu à jour même quand l'écran est fermé) ———

export function onMessage(m) {
  const conv = state.convs.get(m.scope);
  if (conv?.loaded && !conv.messages.some((x) => x.id === m.id)) {
    // Remplace le message « en cours d'envoi » s'il vient de nous.
    const i = conv.messages.findIndex((x) => (x.pending || x.failed) && x.userId === m.userId && x.body === m.body); // « Pas envoyé » a pu arriver quand même
    if (i >= 0) conv.messages.splice(i, 1);
    conv.messages.push(m);
  }
  if (m.scope.startsWith('dm:')) {
    state.dms = [{ scope: m.scope, otherId: otherOf(m.scope), lastAt: m.createdAt }, ...state.dms.filter((d) => d.scope !== m.scope)];
  }
  const viewing = Boolean(ui?.messages) && m.scope === currentScope();
  const seen = viewing && !document.hidden && nearBottom();
  if (m.userId !== state.me.id && !seen && mentions(m.body, state.me.pseudo)) notifyMention(m);
  if (m.userId !== state.me.id) {
    const typers = state.typing.get(m.scope);
    if (typers?.has(m.userId)) {
      clearTimeout(typers.get(m.userId));
      typers.delete(m.userId);
    }
    if (conv) conv.pendingRead = true;
    if (!seen) state.unread[m.scope] = (state.unread[m.scope] || 0) + 1;
  }
  if (viewing) {
    if (m.userId === state.me.id || !appendMessage(m)) renderMessages();
    renderTyping();
    if (seen) markRead();
    if (m.userId !== state.me.id && !seen) ui.jump.hidden = false;
    if (m.userId !== state.me.id) announce(`${state.users.get(m.userId)?.pseudo ?? 'Quelqu’un'} : ${m.body}`);
  }
  renderList();
}

// Ajoute le dernier message à l'écran ; renvoie false quand il faut tout redessiner.
function appendMessage(m) {
  const list = state.convs.get(m.scope)?.messages;
  const prev = list?.at(-2);
  if (!ui?.messages || list?.at(-1) !== m || !prev || !ui.messages.querySelector(`[data-id="${prev.id}"]`)) return false;
  const stick = nearBottom();
  if (dayKey(prev.createdAt) !== dayKey(m.createdAt)) ui.messages.append(h('div.day', { role: 'separator' }, dayLabel(m.createdAt)));
  ui.messages.append(messageEl(m, startsGroup(prev, m)));
  if (stick) ui.messages.scrollTop = ui.messages.scrollHeight;
  return true;
}

// Quelqu'un te mentionne ailleurs que là où tu lis : une notification avec un lien vers le message.
function notifyMention(m) {
  const who = state.users.get(m.userId)?.pseudo || 'Quelqu’un';
  const channel = m.scope.startsWith('c:') ? state.channels.find((c) => `c:${c.id}` === m.scope) : null;
  const where = channel ? `dans #${channel.name}` : 'en message privé';
  const href = channel ? `#/c/${channel.id}` : `#/dm/${m.userId}`;
  toast([`${who} te mentionne ${where}. `, h('a.toast-link', { href, onclick: (e) => e.currentTarget.closest('.toast')?.remove() }, 'Voir')], { ms: 12000, action: true });
}

export function onMessageUpdate(m) {
  const conv = state.convs.get(m.scope);
  const i = conv?.messages.findIndex((x) => x.id === m.id) ?? -1;
  if (i < 0) return;
  conv.messages[i] = m;
  if (m.scope === currentScope()) updateMessageEl(m);
}

export function onMessageDeleted({ id, scope }) {
  const conv = state.convs.get(scope);
  if (!conv) return;
  conv.messages = conv.messages.filter((m) => m.id !== id);
  if (scope === currentScope()) renderMessages();
}

export function onTyping({ scope, userId }) {
  const map = state.typing.get(scope) || new Map();
  clearTimeout(map.get(userId));
  map.set(userId, setTimeout(() => {
    map.delete(userId);
    renderTyping();
  }, 4000));
  state.typing.set(scope, map);
  renderTyping();
}

// Un membre a changé (profil, rôle) : pseudos et avatars à redessiner.
export function onUsersChange() {
  renderList();
  renderOnline();
  renderMessages();
}
