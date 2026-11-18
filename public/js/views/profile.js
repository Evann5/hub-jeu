// Écran Profil : mon avatar (personnage, photo ou silhouette), ma couleur, ma bio, mes succès, le thème, mon mot de passe, les règles, la déconnexion et la suppression du compte.
import { h, icon, token, toast, keepFocus, colorOf, picOf } from '../dom.js';
import { api, call } from '../net.js';
import { state, actions, isAdmin, LEVELS } from '../store.js';
import { isDesktop, hideSecrets, setHideSecrets } from '../secret.js';
import { modal, asyncForm, openRules } from '../dialogs.js';
import { characterImage } from '../character.js';
import { badgesCard } from '../dialogs.js';
import { themeCard } from '../theme.js';

// Redessine la carte « Mon profil » quand le serveur confirme un changement (photo envoyée ou retirée).
let syncProfile = () => {};
export const onMeChange = () => syncProfile();

// Une photo choisie sur l'appareil -> un carré de 256 px en JPEG (data URL), recadré au centre. Le serveur n'accepte que ce format.
async function squarePhoto(file) {
  if (!/^image\//.test(file.type)) throw new Error('Choisis une image (JPEG, PNG ou WebP).');
  if (file.size > 15 * 1024 * 1024) throw new Error('Cette image est trop lourde (15 Mo au plus).');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('Image illisible : essaie une autre photo.'); });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; // une image transparente garde un fond blanc
  ctx.fillRect(0, 0, 256, 256);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  bitmap.close?.();
  for (const quality of [0.86, 0.75, 0.6]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length * 0.75 < 140 * 1024) return url;
  }
  throw new Error('Cette image ne passe pas : essaie une autre photo.');
}

const PICS = [
  { key: 'personnage', label: 'Mon personnage', hint: 'La tête de ton personnage' },
  { key: 'photo', label: 'Une photo', hint: 'Envoyée depuis ton appareil' },
  { key: 'silhouette', label: 'Par défaut', hint: 'La silhouette grise' },
];

export function render(container) {
  const { colors, limits } = state.options;
  const draft = { color: state.me.color, pic: state.me.pic };
  const preview = h('div.preview');
  const picRow = h('div.pic-row', { role: 'radiogroup', 'aria-label': 'Ce que montre ton avatar' });
  const colorRow = h('div.color-row', { role: 'group', 'aria-label': 'Couleur du fond de ta tête' });
  const photoInput = h('input', { type: 'file', accept: 'image/*', hidden: true, name: 'photo_file' });
  const photoNote = h('p.dlg-note.photo-note', { role: 'status' });
  const sending = { on: false };

  const look = () => ({ ...state.me, ...draft, photo: state.me.photo });
  const available = (key) => (key === 'personnage' ? Boolean(state.me.character) : key === 'photo' ? Boolean(state.me.photo) : true);

  function draw() {
    preview.style.setProperty('--c', colorOf(draft.color));
    preview.replaceChildren(token(look(), { size: 'l' }),
      h('div', h('strong', state.me.pseudo), h('span', LEVELS[state.me.role] ?? 'Membre')));
    keepFocus(picRow, () => picRow.replaceChildren(...PICS.map((p) => {
      const on = picOf(look()) === p.key;
      return h(`button.pic-choice${on ? '.is-on' : ''}`, {
        type: 'button',
        role: 'radio',
        'aria-checked': String(on),
        disabled: !available(p.key) && p.key !== 'photo',
        onclick: () => {
          if (p.key === 'photo' && !state.me.photo) { photoInput.click(); return; }
          draft.pic = p.key;
          draw();
        },
      }, token({ ...look(), pic: p.key }, { size: 's' }), h('span', h('b', p.label), h('small', p.key === 'personnage' && !state.me.character ? 'Crée-le plus bas' : p.key === 'photo' && !state.me.photo ? 'Choisir une photo' : p.hint)));
    })));
    keepFocus(colorRow, () => colorRow.replaceChildren(...Object.keys(colors).map((c) => h('button', {
      type: 'button',
      'aria-pressed': String(c === draft.color),
      'aria-label': c,
      title: c,
      onclick: () => { draft.color = c; draw(); },
    }, token({ ...look(), pic: 'personnage', color: c })))));
    colorField.hidden = picOf(look()) !== 'personnage';
    removePhoto.hidden = !state.me.photo;
  }

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    photoInput.value = '';
    if (!file || sending.on) return;
    sending.on = true;
    photoNote.textContent = 'Envoi de la photo…';
    try {
      const data = await squarePhoto(file);
      await call(state.socket, 'profile:photo', { data });
      draft.pic = 'photo';
      photoNote.textContent = '';
      draw();
      toast('Photo enregistrée : c’est ton avatar.');
    } catch (err) {
      photoNote.textContent = err.message;
    } finally {
      sending.on = false;
    }
  });
  const removePhoto = h('button.btn.btn-ghost.btn-sm', {
    type: 'button',
    onclick: async () => {
      try {
        await call(state.socket, 'profile:photo', { data: null });
        if (draft.pic === 'photo') draft.pic = '';
        draw();
        toast('Photo retirée.');
      } catch (err) {
        toast(err.message, { error: true });
      }
    },
  }, icon('trash'), 'Retirer ma photo');
  const colorField = h('div.field', h('span', 'Couleur du fond de ta tête'), colorRow);
  // Le serveur confirme une photo envoyée ou retirée par « user » : la fiche suit (sans perdre ce qui est en cours d'écriture).
  syncProfile = () => {
    if (draft.pic === 'photo' && !state.me.photo) draft.pic = '';
    if (container.isConnected) draw();
  };

  const bio = h('textarea.input', { name: 'bio_text', maxlength: limits.bioMax, rows: 2, placeholder: 'Ex. : toujours partant pour une partie le soir' });
  bio.value = state.me.bio;
  const profileForm = asyncForm(h('form.stack',
    preview,
    h('div.field', h('span', 'Mon avatar'), picRow,
      h('div.card-actions.start', h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => photoInput.click() }, icon('camera'), state.me.photo ? 'Changer de photo' : 'Envoyer une photo'), removePhoto),
      photoInput, photoNote),
    colorField,
    h('label.field', h('span', 'Bio'), bio, h('small', `${limits.bioMax} caractères au plus.`)),
    h('div.card-actions', h('button.btn', { type: 'submit' }, 'Enregistrer le profil'))),
  async () => {
    await call(state.socket, 'profile', { color: draft.color, pic: draft.pic, bio: bio.value });
    toast('Profil enregistré.');
  });
  draw();
  const syncAvatar = () => draw();

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
      characterCard(syncAvatar),
      h('section.card.card-panel', h('h2', 'Mon profil'), profileForm),
      h('section.card.card-panel.card-wide', h('h2', 'Mes succès'), badgesCard(state.me.id)),
      h('div.page-col',
        themeCard(),
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

// Mon personnage, pièce par pièce. Les autres le voient sur ma fiche, sa tête sert d'avatar partout, et c'est mon pion dans Escales.
function characterCard(onSaved = () => {}) {
  const o = state.options.character;
  const keys = (list) => Object.keys(list);
  const any = (list) => list[Math.floor(Math.random() * list.length)];
  const random = () => ({
    v: 2,
    skin: Math.floor(Math.random() * o.skins.length),
    hair: any(keys(o.hairs)),
    hairStyle: any(keys(o.hairStyles)),
    hat: Math.random() < 0.55 ? 'aucun' : any(keys(o.hats)),
    glasses: Math.random() < 0.7 ? 'aucune' : any(keys(o.glasses)),
    beard: Math.random() < 0.75 ? 'aucune' : any(keys(o.beards)),
    accessory: Math.random() < 0.5 ? 'aucun' : any(keys(o.accessories)),
    legs: any(keys(o.legs)),
    top: any(keys(o.clothes)),
    bottom: any(['marine', 'noir', 'gris', 'beige', 'bleu', 'marron']),
    topStyle: any(keys(o.topStyles)),
    shoes: any(['noir', 'blanc', 'marron', 'rouge', 'bleu', 'gris']),
    eyes: Math.random() < 0.5 ? 'normaux' : any(keys(o.eyes)),
    mouth: Math.random() < 0.5 ? 'sourire' : any(keys(o.mouths)),
    cheeks: any(keys(o.cheeks)),
  });
  const defaults = { topStyle: 'tshirt', shoes: 'noir', eyes: 'normaux', mouth: 'sourire', cheeks: 'aucune' };
  const draft = state.me.character?.v === 2 ? { ...defaults, ...state.me.character } : random();
  let turn = 0.35;

  const picture = h('img.character-big', { alt: 'Aperçu de ton personnage', draggable: false });
  const face = h('img.character-head', { alt: '' });
  const stage = h('div.character-stage.is-studio', picture,
    h('div.character-turn',
      h('button.btn.btn-ghost.btn-sm', { type: 'button', 'aria-label': 'Tourner vers la gauche', onclick: () => { turn -= Math.PI / 4; paint(); } }, '↺'),
      h('span', 'Fais-le tourner'),
      h('button.btn.btn-ghost.btn-sm', { type: 'button', 'aria-label': 'Tourner vers la droite', onclick: () => { turn += Math.PI / 4; paint(); } }, '↻')));
  // À la souris ou au doigt : glisser fait tourner le personnage.
  let dragX = null;
  picture.addEventListener('pointerdown', (e) => { dragX = e.clientX; picture.setPointerCapture(e.pointerId); });
  picture.addEventListener('pointermove', (e) => {
    if (dragX === null) return;
    const dx = e.clientX - dragX;
    if (Math.abs(dx) < 12) return;
    turn += dx * 0.012;
    dragX = e.clientX;
    paint();
  });
  const stopDrag = () => { dragX = null; };
  // Au repos, l'aperçu tourne doucement sur lui-même ; il s'arrête dès qu'on y touche, et pour qui préfère moins d'animations.
  let idle = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const still = () => { idle = false; };
  picture.addEventListener('pointerdown', still);
  stage.addEventListener('click', still);
  const spin = setInterval(() => {
    if (!picture.isConnected) { clearInterval(spin); return; }
    if (!idle || document.hidden) return;
    turn = Math.round((turn + Math.PI / 12) / (Math.PI / 12)) * (Math.PI / 12); // 24 angles : chacun n'est dessiné qu'une fois
    paint();
  }, 220);
  picture.addEventListener('pointerup', stopDrag);
  picture.addEventListener('pointercancel', stopDrag);

  let paintN = 0;
  async function paint() {
    const n = ++paintN; // une image plus ancienne qui arrive en retard ne remplace pas la dernière
    const [body, head] = await Promise.all([characterImage(draft, { turn }), characterImage(draft, { head: true })]);
    if (n !== paintN) return;
    if (body) picture.src = body;
    else stage.replaceChildren(h('p.card-text', 'Ton navigateur ne sait pas afficher la 3D : le personnage sera quand même visible chez les autres.'));
    if (head) face.src = head;
  }

  // Une rangée de choix (mots) ou de pastilles (couleurs).
  const chips = (key, list, label) => h('div.chip-row', { role: 'group', 'aria-label': label }, Object.entries(list).map(([value, name]) => h('button.chip-pick', {
    type: 'button', 'aria-pressed': String(draft[key] === value), onclick: () => { draft[key] = value; draw(); },
  }, name)));
  const swatches = (key, entries, label) => h('div.swatch-row', { role: 'group', 'aria-label': label }, entries.map(([value, hex, name]) => h('button.swatch', {
    type: 'button', 'aria-pressed': String(draft[key] === value), 'aria-label': `${label} : ${name}`, title: name, style: `--sw:${hex}`, onclick: () => { draft[key] = value; draw(); },
  })));
  const colorsOf = (list) => Object.entries(list).map(([k, hex]) => [k, hex, k]);
  const field = (label, control) => h('div.field', h('span', label), control);

  const TABS = {
    visage: ['Visage', () => [
      field('Peau', swatches('skin', o.skins.map((hex, i) => [i, hex, `teinte ${i + 1}`]), 'Peau')),
      field('Yeux', chips('eyes', o.eyes, 'Yeux')),
      field('Bouche', chips('mouth', o.mouths, 'Bouche')),
      field('Joues', chips('cheeks', o.cheeks, 'Joues')),
      field('Barbe', chips('beard', o.beards, 'Barbe')),
      field('Lunettes', chips('glasses', o.glasses, 'Lunettes'))]],
    cheveux: ['Cheveux', () => [
      field('Coupe', chips('hairStyle', o.hairStyles, 'Coupe')),
      field('Couleur', swatches('hair', colorsOf(o.hairs), 'Cheveux'))]],
    chapeau: ['Chapeau', () => [field('Sur la tête', chips('hat', o.hats, 'Chapeau'))]],
    tenue: ['Tenue', () => [
      field('Style du haut', chips('topStyle', o.topStyles, 'Style du haut')),
      field('Couleur du haut', swatches('top', colorsOf(o.clothes), 'Haut')),
      field('Bas', chips('legs', o.legs, 'Bas')),
      field('Couleur du bas', swatches('bottom', colorsOf(o.clothes), 'Bas')),
      field('Chaussures', swatches('shoes', colorsOf(o.clothes), 'Chaussures'))]],
    accessoire: ['Accessoire', () => [field('Dans les mains ou sur le dos', chips('accessory', o.accessories, 'Accessoire'))]],
  };
  let tab = 'visage';
  const tabBar = h('div.studio-tabs', { role: 'tablist', 'aria-label': 'Parties du personnage' });
  const panel = h('div.studio-panel', { role: 'tabpanel' });
  function draw() {
    keepFocus(tabBar, () => tabBar.replaceChildren(...Object.entries(TABS).map(([id, [name]]) => h('button.studio-tab', {
      type: 'button', role: 'tab', 'aria-selected': String(tab === id), onclick: () => { tab = id; draw(); },
    }, name))));
    keepFocus(panel, () => panel.replaceChildren(...TABS[tab][1]()));
    paint();
  }
  draw();

  const note = h('p.card-text', state.me.character ? 'Personnage enregistré : c’est ton pion dans Escales, et ton avatar si tu le choisis.' : 'Pas encore enregistré : crée-le pour t’en servir comme avatar.');
  const form = asyncForm(h('form.stack',
    h('div.studio',
      h('div.studio-left', stage, h('div.studio-avatar', face, h('span', h('b', 'Ton avatar'), h('small', 'Si tu choisis « Mon personnage » comme avatar.')))),
      h('div.studio-right', tabBar, panel)),
    note,
    h('div.card-actions',
      h('button.btn.btn-ghost', { type: 'button', onclick: () => { Object.assign(draft, random()); draw(); } }, 'Au hasard'),
      h('button.btn', { type: 'submit' }, 'Enregistrer le personnage'))),
  async () => {
    await call(state.socket, 'profile', { color: state.me.color, bio: state.me.bio, character: { ...draft } });
    note.textContent = 'Personnage enregistré : c’est ton pion dans Escales, et ton avatar si tu le choisis.';
    state.me = { ...state.me, character: { ...draft } }; // le serveur le confirme aussi par « user » ; l'écran suit tout de suite
    onSaved();
    toast('Personnage enregistré.');
  });
  return h('section.card.card-panel.card-wide', h('h2', 'Mon personnage'), form);
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
