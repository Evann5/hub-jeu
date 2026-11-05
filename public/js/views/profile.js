// Écran Profil : mon avatar, ma couleur, ma bio, mon mot de passe, les règles, la déconnexion et la suppression du compte.
import { h, icon, token, toast } from '../dom.js';
import { api, call } from '../net.js';
import { state, actions, isAdmin } from '../store.js';
import { modal, asyncForm, openRules } from '../dialogs.js';

export function render(container) {
  const { colors, avatars, limits } = state.options;
  const draft = { avatar: state.me.avatar, color: state.me.color };
  const preview = h('div.preview');
  const avatarGrid = h('div.avatar-grid', { role: 'group', 'aria-label': 'Avatar' });
  const colorRow = h('div.color-row', { role: 'group', 'aria-label': 'Couleur de l’avatar' });

  function draw() {
    preview.replaceChildren(token({ ...state.me, ...draft }, { size: 'l' }),
      h('div', h('strong', state.me.pseudo), h('span', isAdmin() ? 'Admin' : 'Membre')));
    avatarGrid.replaceChildren(...avatars.map((a) => h('button', {
      type: 'button',
      'aria-pressed': String(a === draft.avatar),
      'aria-label': `Avatar ${a}`,
      onclick: () => { draft.avatar = a; draw(); },
    }, a)));
    colorRow.replaceChildren(...Object.keys(colors).map((c) => h('button', {
      type: 'button',
      'aria-pressed': String(c === draft.color),
      'aria-label': c,
      title: c,
      onclick: () => { draft.color = c; draw(); },
    }, token({ color: c, avatar: draft.avatar }))));
  }
  draw();

  const bio = h('textarea.input', { name: 'bio_text', maxlength: limits.bioMax, rows: 2, placeholder: 'Ex. : toujours partant pour une partie le soir' });
  bio.value = state.me.bio;
  const profileForm = asyncForm(h('form.stack',
    preview,
    h('div.field', h('span', 'Avatar'), avatarGrid),
    h('div.field', h('span', 'Couleur'), colorRow),
    h('label.field', h('span', 'Bio'), bio, h('small', `${limits.bioMax} caractères au plus.`)),
    h('div.card-actions', h('button.btn', { type: 'submit' }, 'Enregistrer le profil'))),
  async () => {
    await call(state.socket, 'profile', { ...draft, bio: bio.value });
    toast('Profil enregistré.');
  });

  const passForm = asyncForm(h('form.stack',
    h('label.field', h('span', 'Mot de passe actuel'),
      h('input.input', { name: 'cur_password', type: 'password', autocomplete: 'current-password', required: true })),
    h('label.field', h('span', 'Nouveau mot de passe'),
      h('input.input', { name: 'new_password', type: 'password', autocomplete: 'new-password', required: true, minlength: limits.passwordMin }),
      h('small', `Au moins ${limits.passwordMin} caractères. Tes autres appareils seront déconnectés.`)),
    h('div.card-actions', h('button.btn.btn-ghost', { type: 'submit' }, 'Changer le mot de passe'))),
  async () => {
    await api('password', { current: passForm.elements.cur_password.value, password: passForm.elements.new_password.value });
    passForm.reset();
    toast('Mot de passe changé.');
  });

  container.replaceChildren(h('div.page',
    h('div.view-head.page-head', h('div', h('h1', 'Profil'), h('p.view-sub', 'Ce que les autres voient de toi, et ton compte.'))),
    h('div.page-grid',
      h('section.card.card-panel', h('h2', 'Mon profil'), profileForm),
      h('div.page-col',
        h('section.card.card-panel', h('h2', 'Mot de passe'), passForm),
        h('section.card.card-panel',
          h('h2', 'Compte'),
          h('ul.menu-list',
            isAdmin() ? h('li', h('a.menu-item', { href: '#/admin' }, icon('shield'), 'Administration')) : null,
            h('li', h('button.menu-item', { type: 'button', onclick: openRules }, icon('user'), 'Règles et données')),
            h('li', h('button.menu-item', {
              type: 'button',
              onclick: async () => {
                await api('logout', {}).catch(() => {});
                actions.logout();
              },
            }, icon('logout'), 'Se déconnecter')),
            h('li', h('button.menu-item.danger', { type: 'button', onclick: openDeleteAccount }, icon('trash'), 'Supprimer mon compte'))))))));
}

function openDeleteAccount() {
  const form = asyncForm(h('form',
    h('p', 'Ton compte, tes messages et tes réactions seront effacés tout de suite. Ça ne peut pas être annulé.'),
    h('label.field', h('span', 'Ton mot de passe, pour confirmer'),
      h('input.input', { name: 'del_password', type: 'password', autocomplete: 'current-password', required: true })),
    h('div.dlg-actions', h('button.btn.btn-danger-solid', { type: 'submit' }, 'Supprimer définitivement mon compte'))),
  async () => {
    await api('delete-account', { password: form.elements.del_password.value });
    dlg.close();
    actions.logout('Ton compte a été supprimé.');
  });
  const dlg = modal('Supprimer mon compte', form);
}
