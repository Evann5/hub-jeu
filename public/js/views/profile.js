// Écran Profil : mon avatar, ma couleur, ma bio, mon mot de passe, les règles, la déconnexion et la suppression du compte.
import { h, icon, token, toast, keepFocus, colorOf } from '../dom.js';
import { api, call } from '../net.js';
import { state, actions, isAdmin, LEVELS } from '../store.js';
import { isDesktop, hideSecrets, setHideSecrets } from '../secret.js';
import { modal, asyncForm, openRules } from '../dialogs.js';
import { characterImage } from '../character.js';

export function render(container) {
  const { colors, avatars, limits } = state.options;
  const draft = { avatar: state.me.avatar, color: state.me.color };
  const preview = h('div.preview');
  const avatarGrid = h('div.avatar-grid', { role: 'group', 'aria-label': 'Avatar' });
  const colorRow = h('div.color-row', { role: 'group', 'aria-label': 'Couleur de l’avatar' });

  function draw() {
    preview.style.setProperty('--c', colorOf(draft.color));
    preview.replaceChildren(token({ ...state.me, ...draft }, { size: 'l' }),
      h('div', h('strong', state.me.pseudo), h('span', LEVELS[state.me.role] ?? 'Membre')));
    keepFocus(avatarGrid, () => avatarGrid.replaceChildren(...avatars.map((a) => h('button', {
      type: 'button',
      'aria-pressed': String(a === draft.avatar),
      'aria-label': `Avatar ${a}`,
      onclick: () => { draft.avatar = a; draw(); },
    }, a))));
    keepFocus(colorRow, () => colorRow.replaceChildren(...Object.keys(colors).map((c) => h('button', {
      type: 'button',
      'aria-pressed': String(c === draft.color),
      'aria-label': c,
      title: c,
      onclick: () => { draft.color = c; draw(); },
    }, token({ color: c, avatar: draft.avatar })))));
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
      h('div.page-col',
        h('section.card.card-panel', h('h2', 'Mon profil'), profileForm),
        characterCard()),
      h('div.page-col',
        h('section.card.card-panel', h('h2', 'Mot de passe'), passForm),
        isDesktop() ? h('section.card.card-panel',
          h('h2', 'En classe'),
          h('label.check',
            h('input', { type: 'checkbox', name: 'hide_secrets', checked: hideSecrets(), onchange: (e) => { setHideSecrets(e.currentTarget.checked); toast(e.currentTarget.checked ? 'Tes secrets seront cachés.' : 'Tes secrets resteront visibles sur cet ordinateur.'); } }),
            h('span', 'Cacher mon rôle, mon mot ou mes cartes secrètes sur cet ordinateur : je maintiens le clic pour les voir, ils se recachent quand je lâche. Sur téléphone, rien n’est caché.'))) : null,
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

// Mon personnage : une tenue, une peau, des cheveux. Les autres le voient sur ma fiche et comme pion dans les jeux qui en ont (Escales).
function characterCard() {
  const o = state.options.character;
  const random = () => ({
    style: Math.floor(Math.random() * o.styles.length),
    skin: Math.floor(Math.random() * o.skins.length),
    hair: Object.keys(o.hairs)[Math.floor(Math.random() * Object.keys(o.hairs).length)],
  });
  const draft = state.me.character ? { ...state.me.character } : random();
  const picture = h('img.character-big', { alt: 'Aperçu de ton personnage' });
  const styles = h('div.chip-row', { role: 'group', 'aria-label': 'Tenue' });
  const skins = h('div.swatch-row', { role: 'group', 'aria-label': 'Peau' });
  const hairs = h('div.swatch-row', { role: 'group', 'aria-label': 'Cheveux' });
  const note = h('p.card-text', state.me.character ? 'Ton personnage est enregistré : les autres le voient en partie.' : 'Pas encore enregistré : en partie, tu as le voyageur de ta place.');
  let paintN = 0;
  async function paint() {
    const n = ++paintN; // une image plus ancienne qui arrive en retard ne remplace pas la dernière
    const url = await characterImage(draft, state.me.color);
    if (n !== paintN) return;
    if (url) picture.src = url;
    else picture.replaceWith(h('p.card-text', 'Ton navigateur ne sait pas afficher la 3D : le personnage sera quand même visible chez les autres.'));
  }
  function draw() {
    keepFocus(styles, () => styles.replaceChildren(...o.styles.map((name, i) => h('button.chip-pick', {
      type: 'button', 'aria-pressed': String(draft.style === i), onclick: () => { draft.style = i; draw(); },
    }, name))));
    keepFocus(skins, () => skins.replaceChildren(...o.skins.map((hex, i) => h('button.swatch', {
      type: 'button', 'aria-pressed': String(draft.skin === i), 'aria-label': `Peau ${i + 1}`, style: `--sw:${hex}`, onclick: () => { draft.skin = i; draw(); },
    }))));
    keepFocus(hairs, () => hairs.replaceChildren(...Object.entries(o.hairs).map(([key, hex]) => h('button.swatch', {
      type: 'button', 'aria-pressed': String(draft.hair === key), 'aria-label': `Cheveux ${key}`, title: key, style: `--sw:${hex}`, onclick: () => { draft.hair = key; draw(); },
    }))));
    paint();
  }
  draw();
  const save = (character) => call(state.socket, 'profile', { avatar: state.me.avatar, color: state.me.color, bio: state.me.bio, character });
  const form = asyncForm(h('form.stack',
    h('div.character-stage', { style: `--c:${colorOf(state.me.color)}` }, picture),
    h('div.field', h('span', 'Tenue'), styles),
    h('div.field', h('span', 'Peau'), skins),
    h('div.field', h('span', 'Cheveux'), hairs),
    h('small.card-text', 'La couleur des vêtements est celle de ton profil. En partie, ton pion porte la couleur de ta place, pour qu’on reconnaisse les joueurs.'),
    note,
    h('div.card-actions',
      h('button.btn.btn-ghost', { type: 'button', onclick: () => { Object.assign(draft, random()); draw(); } }, 'Au hasard'),
      h('button.btn', { type: 'submit' }, 'Enregistrer le personnage'))),
  async () => {
    await save({ ...draft });
    note.textContent = 'Ton personnage est enregistré : les autres le voient en partie.';
    toast('Personnage enregistré.');
  });
  return h('section.card.card-panel', h('h2', 'Mon personnage'), form);
}

function openDeleteAccount() {
  const form = asyncForm(h('form',
    h('p', 'Ton compte, tes messages et tes réactions seront effacés tout de suite. Ça ne peut pas être annulé.'),
    h('label.field', h('span', 'Ton mot de passe, pour confirmer'),
      h('input.input', { name: 'del_password', type: 'password', autocomplete: 'current-password', required: true })),
    h('div.dlg-actions',
      h('button.btn.btn-ghost', { type: 'button', onclick: () => dlg.close() }, 'Annuler'),
      h('button.btn.btn-danger-solid', { type: 'submit' }, 'Supprimer définitivement mon compte'))),
  async () => {
    await api('delete-account', { password: form.elements.del_password.value });
    dlg.close();
    actions.logout('Ton compte a été supprimé.');
  });
  const dlg = modal('Supprimer mon compte', form);
}
