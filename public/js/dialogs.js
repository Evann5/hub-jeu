// Fenêtres : confirmation, règles, profil d'un membre (avec les outils admin), création et modification de canal.
import { h, icon, token, toast, focusKey, findByKey, colorOf, staffTag } from './dom.js';
import { call } from './net.js';
import { state, go, isAdmin, isStaff, LEVELS, rolesOf } from './store.js';
import { characterPicture } from './character.js';

// Ouvre une fenêtre modale ; elle se retire du DOM à la fermeture et rend le focus à l'élément d'avant.
export function modal(title, ...content) {
  const opener = document.activeElement;
  const openerKey = opener instanceof HTMLElement ? focusKey(opener) : null;
  const dlg = h('dialog', { 'aria-label': title },
    h('div.dlg',
      h('div.dlg-head', h('h2', title),
        h('button.icon-btn', { type: 'button', onclick: () => dlg.close() }, icon('x', 'Fermer'))),
      ...content));
  dlg.addEventListener('close', () => {
    dlg.remove();
    // L'écran a pu être redessiné pendant que la fenêtre était ouverte : on retrouve l'équivalent, sinon le contenu.
    if (opener instanceof HTMLElement && opener.isConnected && !opener.disabled) opener.focus();
    else if (document.activeElement === document.body || !document.activeElement) (openerKey && findByKey(document.body, openerKey) || document.getElementById('contenu'))?.focus();
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

// Remplace confirm() : renvoie true si la personne confirme.
export function confirmDialog(title, text, { confirmLabel = 'Confirmer', danger = false } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    const dlg = modal(title,
      h('p', text),
      h('div.dlg-actions',
        h('button.btn.btn-ghost', { type: 'button', onclick: () => dlg.close() }, 'Annuler'),
        h(`button.btn${danger ? '.btn-danger-solid' : ''}`, {
          type: 'button',
          onclick: () => {
            ok = true;
            dlg.close();
          },
        }, confirmLabel)));
    dlg.addEventListener('close', () => resolve(ok));
    // Sur une action destructrice, Entrée trop rapide ne doit rien casser.
    dlg.querySelector(danger ? '.dlg-actions .btn-ghost' : '.dlg-actions .btn:last-child').focus();
  });
}

export function errorBox(form, message) {
  let box = form.querySelector('.form-error');
  if (!message) return box?.remove();
  if (!box) {
    box = h('p.form-error', { role: 'alert' });
    form.querySelector('button[type=submit]').closest('.dlg-actions, .card-actions, button').before(box);
  }
  box.textContent = message;
  box.scrollIntoView({ block: 'nearest' });
}

// Formulaire dont l'envoi est asynchrone : bouton désactivé pendant l'envoi, erreur affichée sans perdre la saisie.
export function asyncForm(form, action) {
  form.addEventListener('input', () => errorBox(form, null)); // on corrige : l'ancienne erreur ne reste pas affichée
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    errorBox(form, null);
    btn.disabled = true;
    try {
      await action();
    } catch (err) {
      errorBox(form, err.message);
    } finally {
      btn.disabled = false;
    }
  });
  return form;
}

// ——— Règles et données ———

export function openRules() {
  modal('Règles et données',
    h('div.prose',
      h('h3', 'Entre nous'),
      h('ul',
        h('li', 'Hubuno est réservé à la classe : on y entre avec le code de la classe.'),
        h('li', 'On se respecte : pas d’insultes, de harcèlement ni de contenus choquants.'),
        h('li', 'Les admins peuvent supprimer un message, mettre quelqu’un en sourdine ou bloquer un compte.')),
      h('h3', 'Ce que Hubuno garde'),
      h('ul',
        h('li', 'Ton pseudo, ton avatar, ta couleur et ta bio.'),
        h('li', 'Ton mot de passe, chiffré : personne ne peut le lire, même pas les admins.'),
        h('li', 'Tes messages et tes réactions. Ils sont effacés automatiquement au bout d’un an.'),
        h('li', 'Aucune adresse e-mail, aucun vrai nom demandé, aucune publicité, aucun pistage.'),
        h('li', 'Un seul cookie, pour rester connecté.')),
      h('h3', 'Qui voit quoi'),
      h('ul',
        h('li', 'Les canaux sont lus par tous les membres inscrits.'),
        h('li', 'Un message privé n’apparaît que pour les deux personnes de la conversation. Les personnes qui gèrent le serveur peuvent techniquement accéder à la base de données.'),
        h('li', 'Hubuno tourne sur un serveur privé, sans publicité ni service tiers. Tes données ne sont ni vendues ni partagées.')),
      h('h3', 'Partir'),
      h('p', 'Dans ton profil, « Supprimer mon compte » efface tout de suite ton compte, tes messages et tes réactions. Pour toute question, écris à un admin.')));
}

// ——— Profil d'un membre ———

export function openProfile(userId) {
  const u = state.users.get(userId);
  if (!u) return;
  if (u.id === state.me.id) {
    go('#/profil');
    return;
  }
  const online = state.online.has(u.id);
  const dlg = modal('Profil',
    h('div.profile-card', { style: `--c:${colorOf(u.color)}` },
      token(u, { size: 'l', online }),
      h('div',
        h('p.pseudo', u.pseudo, staffTag(u)),
        rolesOf(u).length ? h('p.role-chips', rolesOf(u).map((r) => h('span.role-chip', { style: `--rc:${colorOf(r.color)}` }, r.name))) : null,
        h(online ? 'p.status.is-online' : 'p.status', online ? 'En ligne' : 'Hors ligne'),
        h('p.bio', u.bio || 'Pas encore de bio.'))),
    u.character ? h('div.character-stage.is-small', { style: `--c:${colorOf(u.color)}` }, characterPicture(u.character, 'character-big'), h('small', 'Son personnage en partie')) : null,
    h('div.dlg-actions',
      h('button.btn', {
        type: 'button',
        onclick: () => {
          dlg.close();
          go(`#/dm/${u.id}`);
        },
      }, icon('chat'), 'Envoyer un message')),
    isStaff() ? staffTools(u, () => dlg.close()) : null);
}

// Outils de l'équipe : un modérateur n'a que la sourdine, et seulement sur les membres ; un admin a tout.
function staffTools(u, close) {
  if (!isAdmin() && u.role !== 'membre') return null;
  const mute = h('select.input', { 'aria-label': 'Durée de la sourdine' },
    h('option', { value: '10' }, '10 minutes'),
    h('option', { value: '60' }, '1 heure'),
    h('option', { value: '1440' }, '1 jour'),
    h('option', { value: '10080' }, '1 semaine'),
    h('option', { value: '0' }, 'Lever la sourdine'));

  const act = (fn) => async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await fn();
    } catch (err) {
      toast(err.message, { error: true });
    } finally {
      btn.disabled = false;
      if (btn.isConnected && !btn.closest('dialog')?.contains(document.activeElement)) btn.focus();
    }
  };

  const tempBox = h('div.dlg-sub', { role: 'status' });

  // Le profil : renommer (pseudo inapproprié), effacer la bio ou le personnage. Modérateurs (sur les membres) et admins.
  const pseudoInput = h('input.input', { name: 'new_pseudo', value: u.pseudo, autocomplete: 'off', spellcheck: false, maxlength: state.options.limits.pseudoMax, 'aria-label': `Nouveau pseudo pour ${u.pseudo}` });
  const profileRows = [
    h('div.dlg-actions.start',
      pseudoInput,
      h('button.btn.btn-ghost', {
        type: 'button',
        onclick: act(async () => {
          const next = pseudoInput.value.trim();
          if (!next || next === u.pseudo) return;
          const old = u.pseudo;
          await call(state.socket, 'admin:rename', { userId: u.id, pseudo: next });
          toast(`${old} s’appelle maintenant ${next}.`);
          close();
        }),
      }, 'Renommer')),
    h('div.dlg-actions.start',
      h('button.btn.btn-ghost', {
        type: 'button',
        disabled: !u.bio,
        onclick: act(async () => {
          await call(state.socket, 'admin:clearProfile', { userId: u.id, part: 'bio' });
          toast(`Bio de ${u.pseudo} effacée.`);
          close();
        }),
      }, 'Effacer la bio'),
      h('button.btn.btn-ghost', {
        type: 'button',
        disabled: !u.character,
        onclick: act(async () => {
          await call(state.socket, 'admin:clearProfile', { userId: u.id, part: 'character' });
          toast(`Personnage de ${u.pseudo} effacé.`);
          close();
        }),
      }, 'Effacer le personnage')),
  ];
  const muteRow = h('div.dlg-actions.start',
    mute,
    h('button.btn.btn-ghost', {
      type: 'button',
      onclick: act(async () => {
        const minutes = Number(mute.value);
        await call(state.socket, 'admin:mute', { userId: u.id, minutes });
        toast(minutes ? `${u.pseudo} est en sourdine.` : `${u.pseudo} peut de nouveau écrire.`);
      }),
    }, 'Mettre en sourdine'));
  if (!isAdmin()) return h('div.dlg-sub.staff-tools', h('hr'), h('h3', 'Outils de modération'), ...profileRows, muteRow);

  // Niveau : ce que la personne a le droit de faire.
  const level = h('select.input', { 'aria-label': `Niveau de ${u.pseudo}` },
    Object.entries(LEVELS).map(([value, label]) => h('option', { value, selected: u.role === value }, label)));
  const levelRow = h('div.dlg-actions.start',
    level,
    h('button.btn.btn-ghost', {
      type: 'button',
      onclick: act(async () => {
        if (level.value === u.role) return;
        await call(state.socket, 'admin:setRole', { userId: u.id, role: level.value });
        toast(`Niveau de ${u.pseudo} : ${LEVELS[level.value]}.`);
        close();
      }),
    }, 'Changer le niveau'));

  // Rôles décoratifs : cochés ou non, enregistrés aussitôt.
  const roleBoxes = state.roles.map((r) => h('input', { type: 'checkbox', value: String(r.id), checked: u.roles?.includes(r.id) }));
  const saveRoles = async (e) => {
    const box = e.currentTarget;
    roleBoxes.forEach((b) => { b.disabled = true; });
    try {
      await call(state.socket, 'admin:setUserRoles', { userId: u.id, roleIds: roleBoxes.filter((b) => b.checked).map((b) => Number(b.value)) });
    } catch (err) {
      box.checked = !box.checked;
      toast(err.message, { error: true });
    } finally {
      roleBoxes.forEach((b) => { b.disabled = false; });
    }
  };
  roleBoxes.forEach((b) => b.addEventListener('change', saveRoles));
  const rolesBlock = state.roles.length
    ? h('fieldset.role-picks', h('legend', 'Rôles'), state.roles.map((r, i) => h('label.check.role-pick', { style: `--rc:${colorOf(r.color)}` }, roleBoxes[i], h('span', r.name))))
    : h('p.dlg-note', 'Aucun rôle pour l’instant : crée-les dans Admin, section Rôles.');

  return h('div.dlg-sub.staff-tools',
    h('hr'),
    h('h3', 'Outils admin'),
    ...profileRows,
    levelRow,
    rolesBlock,
    muteRow,
    h('div.dlg-actions.start',
      h('button.btn.btn-ghost', {
        type: 'button',
        onclick: act(async () => {
          const ok = await confirmDialog('Réinitialiser le mot de passe',
            `Cette personne sera déconnectée partout et devra choisir un nouveau mot de passe.`, { confirmLabel: 'Réinitialiser' });
          if (!ok) return;
          const { tempPassword } = await call(state.socket, 'admin:resetPassword', { userId: u.id });
          tempBox.replaceChildren(
            h('p', `Donne ce mot de passe provisoire à ${u.pseudo} :`),
            h('div.code-box', { tabindex: '-1' }, h('span', tempPassword)),
            h('p.dlg-note', 'Il sert 24 heures : passé ce délai, il faudra en redonner un.'));
          tempBox.querySelector('.code-box').focus();
          tempBox.scrollIntoView({ block: 'nearest' }); // sur petit écran, il apparaît sous le bord de la fiche
        }),
      }, 'Réinitialiser le mot de passe'),
      h('button.btn.btn-danger', {
        type: 'button',
        onclick: act(async () => {
          const ok = await confirmDialog('Bloquer le compte',
            `${u.pseudo} ne pourra plus se connecter tant qu’un admin ne le débloque pas.`,
            { confirmLabel: 'Bloquer', danger: true });
          if (!ok) return;
          await call(state.socket, 'admin:ban', { userId: u.id, banned: true });
          toast(`Compte bloqué : ${u.pseudo}.`);
          close();
        }),
      }, 'Bloquer le compte')),
    tempBox);
}

// ——— Canaux (admins) ———

export function openChannelEditor(channel) {
  const { limits } = state.options;
  const name = h('input.input', { name: 'chan_name', required: true, maxlength: limits.channelNameMax, autocomplete: 'off', spellcheck: false });
  const topic = h('input.input', { name: 'chan_topic', maxlength: limits.topicMax, autocomplete: 'off' });
  name.value = channel?.name || '';
  topic.value = channel?.topic || '';
  const staffOnly = h('input', { type: 'checkbox', name: 'chan_staff', checked: Boolean(channel?.staffOnly) });
  const form = asyncForm(h('form',
    h('label.field', h('span', 'Nom du canal'), name, h('small', 'En minuscules, les espaces deviennent des tirets.')),
    h('label.field', h('span', 'Description (facultative)'), topic),
    h('label.check', staffOnly, h('span', 'Réservé à l’équipe : seuls les modérateurs et les admins le voient.')),
    h('div.dlg-actions',
      channel ? h('button.btn.btn-danger', {
        type: 'button',
        onclick: async () => {
          const ok = await confirmDialog(`Supprimer #${channel.name}`,
            'Le canal et tous ses messages seront effacés pour tout le monde.', { confirmLabel: 'Supprimer', danger: true });
          if (!ok) return;
          try {
            await call(state.socket, 'admin:deleteChannel', { id: channel.id });
            dlg.close();
            toast(`#${channel.name} supprimé.`);
          } catch (err) {
            toast(err.message, { error: true });
          }
        },
      }, 'Supprimer le canal') : null,
      h('button.btn', { type: 'submit' }, channel ? 'Enregistrer' : 'Créer le canal'))),
  async () => {
    // Un canal d'équipe qui devient public : ses anciens messages deviennent lisibles par toute la classe. On prévient.
    if (channel?.staffOnly && !staffOnly.checked) {
      const ok = await confirmDialog(`Rendre #${channel.name} public`,
        'Toute la classe pourra lire les messages déjà écrits dans ce canal par l’équipe. Pour repartir de zéro, crée plutôt un nouveau canal.',
        { confirmLabel: 'Rendre public', danger: true });
      if (!ok) return;
    }
    if (channel) await call(state.socket, 'admin:updateChannel', { id: channel.id, name: name.value, topic: topic.value, staffOnly: staffOnly.checked });
    else await call(state.socket, 'admin:createChannel', { name: name.value, topic: topic.value, staffOnly: staffOnly.checked });
    dlg.close();
    toast(channel ? 'Canal enregistré.' : 'Canal créé.');
  });
  const dlg = modal(channel ? `Modifier #${channel.name}` : 'Créer un canal', form);
  name.focus();
}

// ——— Rôles décoratifs (admins) ———

export function openRoleEditor(role) {
  const name = h('input.input', { name: 'role_name', required: true, maxlength: 24, autocomplete: 'off', spellcheck: false });
  name.value = role?.name || '';
  let color = role?.color || Object.keys(state.options.colors)[0];
  const colorRow = h('div.color-row', { role: 'group', 'aria-label': 'Couleur du rôle' });
  const drawColors = () => keepColorFocus(colorRow, () => colorRow.replaceChildren(...Object.keys(state.options.colors).map((c) => h('button', {
    type: 'button',
    'aria-pressed': String(c === color),
    'aria-label': c,
    title: c,
    onclick: () => { color = c; drawColors(); },
  }, h('span.role-dot', { style: `--rc:${colorOf(c)}` })))));
  drawColors();
  const form = asyncForm(h('form',
    h('label.field', h('span', 'Nom du rôle'), name, h('small', 'Par exemple « Délégués » ou « Champion d’Escales ». Il ne donne aucun droit.')),
    h('div.field', h('span', 'Couleur'), colorRow, h('small', 'Le pseudo prend la couleur du premier rôle de la liste.')),
    h('div.dlg-actions',
      role ? h('button.btn.btn-danger', {
        type: 'button',
        onclick: async () => {
          const ok = await confirmDialog(`Supprimer le rôle « ${role.name} »`, 'Les membres qui l’ont le perdent. Leurs comptes ne sont pas touchés.', { confirmLabel: 'Supprimer', danger: true });
          if (!ok) return;
          try {
            await call(state.socket, 'admin:deleteRole', { id: role.id });
            dlg.close();
            toast(`Rôle « ${role.name} » supprimé.`);
          } catch (err) {
            toast(err.message, { error: true });
          }
        },
      }, 'Supprimer le rôle') : null,
      h('button.btn', { type: 'submit' }, role ? 'Enregistrer' : 'Créer le rôle'))),
  async () => {
    if (role) await call(state.socket, 'admin:updateRole', { id: role.id, name: name.value, color });
    else await call(state.socket, 'admin:createRole', { name: name.value, color });
    dlg.close();
    toast(role ? 'Rôle enregistré.' : 'Rôle créé : donne-le depuis la fiche d’un membre.');
  });
  const dlg = modal(role ? `Modifier le rôle « ${role.name} »` : 'Créer un rôle', form);
  name.focus();
}

// Redessine les pastilles sans perdre le focus clavier sur celle qu'on vient de choisir.
function keepColorFocus(row, draw) {
  const i = [...row.children].indexOf(document.activeElement);
  draw();
  if (i >= 0) row.children[i]?.focus();
}
