// Écran Administration (admins) : code de la classe, canaux, rôles, comptes bloqués, état de la connexion en direct.
import { h, icon, token, toast, colorOf, stamp } from '../dom.js';
import { call } from '../net.js';
import { state } from '../store.js';
import { asyncForm, openChannelEditor, openRoleEditor } from '../dialogs.js';

let channelList = null;
let roleList = null;

export function leave() {
  channelList = null;
  roleList = null;
}

export function render(container) {
  const codeBox = h('div.code-box', h('span', '…'));
  const codeInput = h('input.input', { name: 'class_code', autocomplete: 'off', spellcheck: false, minlength: 10, maxlength: 40, required: true });
  const codeForm = asyncForm(h('form.stack', { novalidate: true },
    h('label.field', h('span', 'Nouveau code'), codeInput, h('small', 'Au moins 10 caractères. Les comptes existants ne sont pas touchés : le code sert seulement à s’inscrire.')),
    h('div.card-actions', h('button.btn.btn-ghost', { type: 'submit' }, 'Changer le code'))),
  async () => {
    if (codeInput.value.trim().length < 10) throw new Error('Le code doit faire au moins 10 caractères.');
    const { classCode } = await call(state.socket, 'admin:setClassCode', { code: codeInput.value });
    codeBox.replaceChildren(h('span', classCode));
    codeInput.value = '';
    toast('Code de la classe changé.');
  });

  channelList = h('ul.row-list');
  renderChannels();
  const journal = h('ul.mod-log', h('li', h('span.muted', 'Chargement…')));
  roleList = h('ul.row-list');
  renderRoles();
  const bannedList = h('ul.row-list', h('li', h('span.label', 'Chargement…')));
  const address = `${location.origin}${location.pathname}`;
  const copyInvite = async () => {
    const text = `Rejoins Hubuno, les jeux de la classe : ${address}\nCode de la classe : ${codeBox.textContent}`;
    try {
      await navigator.clipboard.writeText(text);
      toast('Message copié : colle-le dans le groupe de la classe.');
    } catch {
      toast('Copie impossible ici : recopie l’adresse et le code.', { error: true });
    }
  };
  const engine = state.socket.io.engine;
  const connection = h('p.card-text');
  const showConnection = () => {
    connection.textContent = engine?.transport?.name === 'websocket'
      ? 'Connexion directe : tout est en temps réel.'
      : 'Connexion de secours active : tout marche, avec un peu de retard.';
  };
  showConnection();
  engine?.once('upgrade', showConnection); // la connexion démarre en secours, puis passe en directe

  container.replaceChildren(h('div.page',
    h('div.view-head.page-head', h('div', h('h1', 'Administration'), h('p.view-sub', 'Réservé aux admins.'))),
    h('div.page-grid',
      h('section.card.card-panel',
        h('h2', 'À donner à la classe'),
        h('p.card-text', 'Cette adresse et ce code suffisent pour créer un compte.'),
        h('p.share-line', address),
        codeBox,
        h('button.btn.share-copy', { type: 'button', onclick: copyInvite }, 'Copier le message pour la classe'),
        codeForm),
      h('section.card.card-panel',
        h('div.card-top', h('h2', 'Canaux'),
          h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => openChannelEditor() }, icon('plus'), 'Créer')),
        channelList),
      h('section.card.card-panel',
        h('div.card-top', h('h2', 'Rôles'),
          h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => openRoleEditor() }, icon('plus'), 'Créer')),
        h('p.card-text', 'Un nom et une couleur, sans aucun droit. Le premier rôle d’un membre colore son pseudo et le range dans Membres. Pour en donner un, ouvre la fiche du membre.'),
        roleList),
      h('section.card.card-panel',
        h('h2', 'Comptes bloqués'),
        bannedList,
        h('p.card-text', 'Pour agir sur un membre (sourdine, mot de passe, blocage, niveau, rôles), ouvre sa fiche depuis Membres.')),
      h('section.card.card-panel',
        h('h2', 'Connexion en direct'),
        connection),
      h('section.card.card-panel.card-wide',
        h('div.card-top', h('h2', 'Journal de modération'),
          h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => loadJournal(journal) }, 'Actualiser')),
        h('p.card-text', 'Ce que l’équipe a fait, du plus récent au plus ancien (gardé un an). Seuls les admins le voient.'),
        journal))));
  loadJournal(journal);

  Promise.all([call(state.socket, 'admin:getClassCode'), call(state.socket, 'admin:bannedList')])
    .then(([{ classCode }, { users }]) => {
      codeBox.replaceChildren(h('span', classCode || 'Aucun code : les inscriptions sont fermées.'));
      const drawBanned = (list) => bannedList.replaceChildren(...(list.length ? list.map((u) => h('li',
        token(u, { size: 's' }), h('span.label', u.pseudo),
        h('button.btn.btn-ghost.btn-sm', {
          type: 'button',
          'aria-label': `Débloquer ${u.pseudo}`,
          onclick: async () => {
            try {
              await call(state.socket, 'admin:ban', { userId: u.id, banned: false });
              toast(`Compte débloqué : ${u.pseudo}.`);
              drawBanned(list.filter((x) => x.id !== u.id));
            } catch (err) {
              toast(err.message, { error: true });
            }
          },
        }, 'Débloquer'))) : [h('li', h('span.label.muted', 'Aucun compte bloqué.'))]));
      drawBanned(users);
    })
    .catch((err) => toast(err.message, { error: true }));
}

// Redessine la liste quand un admin crée, renomme ou supprime un canal.
export function renderChannels() {
  if (!channelList) return;
  channelList.replaceChildren(...state.channels.map((c) => h('li',
    icon(c.staffOnly ? 'shield' : 'hash'), h('span.label', c.name),
    h('button.icon-btn', { type: 'button', onclick: () => openChannelEditor(c) }, icon('pencil', `Modifier #${c.name}`)))));
}

// Redessine la liste des rôles (créé, renommé, déplacé, supprimé, par cet admin ou un autre).
export function renderRoles() {
  if (!roleList) return;
  if (!state.roles.length) {
    roleList.replaceChildren(h('li', h('span.label.muted', 'Aucun rôle pour l’instant.')));
    return;
  }
  const move = (r, step) => async () => {
    try {
      await call(state.socket, 'admin:moveRole', { id: r.id, step });
    } catch (err) {
      toast(err.message, { error: true });
    }
  };
  const holders = (r) => [...state.users.values()].filter((u) => u.roles?.includes(r.id)).length;
  roleList.replaceChildren(...state.roles.map((r, i) => h('li',
    h('span.role-dot', { style: `--rc:${colorOf(r.color)}` }),
    h('span.label', { style: `color:${colorOf(r.color)}` }, r.name),
    h('span.muted.role-count', String(holders(r))),
    h('button.icon-btn', { type: 'button', disabled: i === 0, onclick: move(r, -1) }, icon('up', `Monter « ${r.name} »`)),
    h('button.icon-btn', { type: 'button', disabled: i === state.roles.length - 1, onclick: move(r, 1) }, icon('down', `Descendre « ${r.name} »`)),
    h('button.icon-btn', { type: 'button', onclick: () => openRoleEditor(r) }, icon('pencil', `Modifier « ${r.name} »`)))));
}

// Journal de modération : les 200 dernières actions de l'équipe.
async function loadJournal(list) {
  try {
    const { entries } = await call(state.socket, 'admin:modLog');
    list.replaceChildren(...(entries.length ? entries.map((e) => h('li',
      h('time', { dateTime: new Date(e.at).toISOString() }, stamp(e.at)),
      h('span', h('b', e.actor), ` ${e.action}`, e.target ? [' ', h('b', e.target)] : null, e.detail ? h('span.muted', ` · ${e.detail}`) : null)))
      : [h('li', h('span.muted', 'Rien pour l’instant.'))]));
  } catch (err) {
    toast(err.message, { error: true });
  }
}
