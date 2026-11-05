// Écran Administration (admins) : code de la classe, canaux, comptes bloqués, état de la connexion en direct.
import { h, icon, token, toast } from '../dom.js';
import { call } from '../net.js';
import { state } from '../store.js';
import { asyncForm, openChannelEditor } from '../dialogs.js';

let channelList = null;

export function leave() {
  channelList = null;
}

export function render(container) {
  const codeBox = h('div.code-box', h('span', '…'));
  const codeInput = h('input.input', { name: 'class_code', autocomplete: 'off', spellcheck: false, minlength: 10, maxlength: 40, required: true });
  const codeForm = asyncForm(h('form.stack', { novalidate: true },
    h('label.field', h('span', 'Nouveau code'), codeInput, h('small', 'Au moins 10 caractères. Les comptes existants ne sont pas touchés : le code sert seulement à s’inscrire.')),
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
  const bannedList = h('ul.row-list', h('li', h('span.label', 'Chargement…')));
  const websocket = state.socket.io.engine?.transport?.name === 'websocket';

  container.replaceChildren(h('div.page',
    h('div.view-head.page-head', h('div', h('h1', 'Administration'), h('p.view-sub', 'Réservé aux admins.'))),
    h('div.page-grid',
      h('section.card.card-panel',
        h('h2', 'Code de la classe'),
        h('p.card-text', 'À donner aux élèves pour qu’ils créent leur compte.'),
        codeBox,
        codeForm),
      h('section.card.card-panel',
        h('div.card-top', h('h2', 'Canaux'),
          h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => openChannelEditor() }, icon('plus'), 'Créer')),
        channelList),
      h('section.card.card-panel',
        h('h2', 'Comptes bloqués'),
        bannedList,
        h('p.card-text', 'Pour agir sur un membre (sourdine, mot de passe, blocage, rôle admin), ouvre sa fiche depuis Membres.')),
      h('section.card.card-panel',
        h('h2', 'Connexion en direct'),
        h('p.card-text', websocket
          ? 'WebSocket : la connexion directe fonctionne.'
          : 'Long-polling : la connexion de secours est utilisée. Hubuno marche, avec un peu plus de délai. Voir le guide de mise en ligne.')))));

  Promise.all([call(state.socket, 'admin:getClassCode'), call(state.socket, 'admin:bannedList')])
    .then(([{ classCode }, { users }]) => {
      codeBox.replaceChildren(h('span', classCode || 'Aucun code : les inscriptions sont fermées.'));
      const drawBanned = (list) => bannedList.replaceChildren(...(list.length ? list.map((u) => h('li',
        token(u, { size: 's' }), h('span.label', u.pseudo),
        h('button.btn.btn-ghost.btn-sm', {
          type: 'button',
          onclick: async () => {
            try {
              await call(state.socket, 'admin:ban', { userId: u.id, banned: false });
              toast(`Compte de ${u.pseudo} débloqué.`);
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
    icon('hash'), h('span.label', c.name),
    h('button.icon-btn', { type: 'button', onclick: () => openChannelEditor(c) }, icon('pencil', `Modifier #${c.name}`)))));
}
