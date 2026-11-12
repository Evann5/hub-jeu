// Écran Administration (admins) : code de la classe et inscriptions, canaux, rôles, comptes bloqués, état du serveur, journaux.
import { h, icon, token, toast, colorOf, stamp, count } from '../dom.js';
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

  // Inscriptions ouvertes ou fermées : une fois la classe inscrite, on ferme (plus de faux comptes, plus de code à deviner).
  const signupSwitch = h('button.switch-btn', { type: 'button', role: 'switch', 'aria-checked': 'true', 'aria-label': 'Inscriptions ouvertes' }, h('span'));
  const signupNote = h('small');
  const showSignups = (open) => {
    signupSwitch.setAttribute('aria-checked', String(open));
    signupNote.textContent = open
      ? 'Ferme-les quand toute la classe a son compte : plus personne ne pourra en créer.'
      : 'Fermées : personne ne peut créer de compte. Rouvre-les pour un nouvel élève.';
  };
  showSignups(true);
  signupSwitch.addEventListener('click', async () => {
    try {
      const { signupsOpen } = await call(state.socket, 'admin:setSignups', { open: signupSwitch.getAttribute('aria-checked') !== 'true' });
      showSignups(signupsOpen);
      toast(signupsOpen ? 'Inscriptions rouvertes.' : 'Inscriptions fermées.');
    } catch (err) {
      toast(err.message, { error: true });
    }
  });

  channelList = h('ul.row-list');
  renderChannels();
  const status = h('dl.status-list', h('div', h('dt', 'État'), h('dd', 'Chargement…')));
  const errorList = h('ul.mod-log', h('li', h('span.muted', 'Chargement…')));
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
        codeForm,
        h('div.setting-row', h('span.setting-text', h('b', 'Inscriptions ouvertes'), signupNote), signupSwitch)),
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
        h('div.card-top', h('h2', 'État du serveur'),
          h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => loadStatus(status) }, 'Actualiser')),
        h('h3.sr-only', 'Connexion en direct'),
        connection,
        status),
      h('section.card.card-panel.card-wide',
        h('div.card-top', h('h2', 'Journal de modération'),
          h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => loadJournal(journal) }, 'Actualiser')),
        h('p.card-text', 'Ce que l’équipe a fait, du plus récent au plus ancien (gardé un an). Seuls les admins le voient.'),
        journal),
      h('section.card.card-panel.card-wide',
        h('div.card-top', h('h2', 'Journal des erreurs'),
          h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => loadErrors(errorList) }, 'Actualiser')),
        h('p.card-text', 'Ce qui a planté, sur le serveur ou dans le navigateur d’un élève, du plus récent au plus ancien (gardé 30 jours). À envoyer à la personne qui s’occupe du code.'),
        errorList))));
  loadJournal(journal);
  loadStatus(status);
  loadErrors(errorList);

  Promise.all([call(state.socket, 'admin:getClassCode'), call(state.socket, 'admin:bannedList')])
    .then(([{ classCode, signupsOpen }, { users }]) => {
      showSignups(signupsOpen !== false);
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

const megas = (bytes) => `${(bytes / 1048576).toFixed(1).replace('.', ',')} Mo`;

// État du serveur : ce qu'il faut pour savoir si tout va bien sans ouvrir de fichier chez l'hébergeur.
async function loadStatus(list) {
  try {
    const { status: s } = await call(state.socket, 'admin:status');
    const line = (label, value, warn = null) => h('div', h('dt', label), h('dd', value, warn ? h('p.status-warn', { role: 'alert' }, warn) : null));
    const backupAge = s.lastBackupAt ? Date.now() - s.lastBackupAt : Infinity;
    list.replaceChildren(
      line('Copies de l’appli', String(s.copies), s.copies > 1
        ? 'Il ne doit y en avoir qu’une : avec plusieurs, des gens paraissent hors ligne et des messages se perdent. Normal pendant la minute qui suit un redémarrage ; sinon, demande à l’hébergeur de limiter l’appli à une seule instance.'
        : null),
      line('En ligne', `${count(s.online, 'personne', 'personnes')} (${count(s.sockets, 'onglet', 'onglets')})`),
      line('Comptes', String(s.accounts)),
      line('Messages gardés', String(s.messages)),
      line('Parties', `${s.lobby} en attente, ${s.playing} en cours, ${s.over} terminées`, s.aside
        ? `${count(s.aside, 'partie illisible a été mise', 'parties illisibles ont été mises')} de côté au dernier démarrage (après une mise à jour d’un jeu).`
        : null),
      line('Base', megas(s.dbBytes)),
      line('Sauvegardes', s.backups ? `${count(s.backups, 'gardée', 'gardées')} (${megas(s.backupsBytes)}), la dernière ${stamp(s.lastBackupAt)}` : 'aucune', backupAge > 36 * 3600_000
        ? 'Pas de sauvegarde depuis plus d’un jour : regarde le journal des erreurs, le disque est peut-être plein.'
        : null),
      line('Erreurs sur 24 h', String(s.errors24h)),
      line('Mémoire', megas(s.memoryBytes)),
      line('Démarré', `${stamp(s.startedAt)} · version ${s.version} · Node ${s.node.replace(/^v/, '')}`));
  } catch (err) {
    toast(err.message, { error: true });
  }
}

// Journal des erreurs : serveur et navigateurs, une ligne par sorte d'erreur avec son nombre.
async function loadErrors(list) {
  try {
    const { entries } = await call(state.socket, 'admin:errors');
    list.replaceChildren(...(entries.length ? entries.map((e) => h('li',
      h('time', { dateTime: new Date(e.lastAt).toISOString() }, stamp(e.lastAt)),
      h('span', h('b', e.source === 'serveur' ? 'Serveur' : `Navigateur${e.who ? ` de ${e.who}` : ''}`), ` · ${e.message}`,
        e.count > 1 ? h('b', ` (${e.count} fois)`) : null, e.place ? h('span.muted', ` · ${e.place}`) : null)))
      : [h('li', h('span.muted', 'Aucune erreur. Tant mieux.'))]));
  } catch (err) {
    toast(err.message, { error: true });
  }
}
