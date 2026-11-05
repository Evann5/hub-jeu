// Fenêtres : confirmation, règles, profil d'un membre (avec les outils admin), création et modification de canal.
import { h, icon, token, toast, focusKey, findByKey } from './dom.js';
import { call } from './net.js';
import { state, go, isAdmin } from './store.js';

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
        h('li', 'Hubuno est réservé à la classe : on y entre avec le code de la classe.'),
        h('li', 'On se respecte : pas d’insultes, de harcèlement ni de contenus choquants.'),
        h('li', 'Les admins peuvent supprimer un message, mettre quelqu’un en sourdine ou bloquer un compte.')),
      h('h3', 'Ce que Hubuno garde'),
      h('ul',
        h('li', 'Ton pseudo, ton avatar, ta couleur et ta bio.'),
        h('li', 'Ton mot de passe, chiffré : personne ne peut le lire, même pas les admins.'),
        h('li', 'Tes messages et tes réactions. Ils sont effacés automatiquement au bout d’un an.'),
        h('li', 'Aucune adresse e-mail, aucun vrai nom demandé, aucune publicité, aucun pistage.'),
        h('li', 'Un seul cookie, pour rester connecté.')),
      h('h3', 'Qui voit quoi'),
      h('ul',
        h('li', 'Les canaux sont lus par tous les membres inscrits.'),
        h('li', 'Un message privé n’apparaît que pour les deux personnes de la conversation. Les personnes qui gèrent le serveur peuvent techniquement accéder à la base de données.'),
        h('li', 'Hubuno est hébergé en France, chez O2Switch.')),
      h('h3', 'Partir'),
      h('p', 'Dans ton profil, « Supprimer mon compte » efface tout de suite ton compte, tes messages et tes réactions. Pour toute question, écris à un admin.')));
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
    h('div.profile-card',
      token(u, { size: 'l', online }),
      h('div',
        h('p.pseudo', u.pseudo, u.role === 'admin' ? h('span.tag-admin', 'admin') : null),
        h('p.status', online ? 'En ligne' : 'Hors ligne'),
        h('p.bio', u.bio || 'Pas encore de bio.'))),
    h('div.dlg-actions',
      h('button.btn', {
        type: 'button',
        onclick: () => {
          dlg.close();
          go(`#/dm/${u.id}`);
        },
      }, icon('chat'), 'Envoyer un message')),
    isAdmin() ? adminTools(u, () => dlg.close()) : null);
}

function adminTools(u, close) {
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
  return h('div.dlg-sub',
    h('hr'),
    h('h3', 'Outils admin'),
    h('div.dlg-actions.start',
      mute,
      h('button.btn.btn-ghost', {
        type: 'button',
        onclick: act(async () => {
          const minutes = Number(mute.value);
          await call(state.socket, 'admin:mute', { userId: u.id, minutes });
          toast(minutes ? `${u.pseudo} est en sourdine.` : `${u.pseudo} peut de nouveau écrire.`);
        }),
      }, 'Mettre en sourdine')),
    h('div.dlg-actions.start',
      h('button.btn.btn-ghost', {
        type: 'button',
        onclick: act(async () => {
          const ok = await confirmDialog('Réinitialiser le mot de passe',
            `Cette personne sera déconnectée partout et devra choisir un nouveau mot de passe.`, { confirmLabel: 'Réinitialiser' });
          if (!ok) return;
          const { tempPassword } = await call(state.socket, 'admin:resetPassword', { userId: u.id });
          tempBox.replaceChildren(
            h('p', `Donne ce mot de passe provisoire à ${u.pseudo} :`),
            h('div.code-box', { tabindex: '-1' }, h('span', tempPassword)));
          tempBox.querySelector('.code-box').focus();
          tempBox.scrollIntoView({ block: 'nearest' }); // sur petit écran, il apparaît sous le bord de la fiche
        }),
      }, 'Réinitialiser le mot de passe'),
      h('button.btn.btn-ghost', {
        type: 'button',
        onclick: act(async () => {
          const role = u.role === 'admin' ? 'membre' : 'admin';
          await call(state.socket, 'admin:setRole', { userId: u.id, role });
          toast(role === 'admin' ? `${u.pseudo} est maintenant admin.` : `${u.pseudo} n’est plus admin.`);
          close();
        }),
      }, u.role === 'admin' ? 'Retirer le rôle admin' : 'Nommer admin'),
      h('button.btn.btn-danger', {
        type: 'button',
        onclick: act(async () => {
          const ok = await confirmDialog('Bloquer le compte',
            `Le compte de ${u.pseudo} ne pourra plus se connecter tant qu’un admin ne le débloque pas.`,
            { confirmLabel: 'Bloquer', danger: true });
          if (!ok) return;
          await call(state.socket, 'admin:ban', { userId: u.id, banned: true });
          toast(`Compte de ${u.pseudo} bloqué.`);
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
  const form = asyncForm(h('form',
    h('label.field', h('span', 'Nom du canal'), name, h('small', 'En minuscules, les espaces deviennent des tirets.')),
    h('label.field', h('span', 'Description (facultative)'), topic),
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
    if (channel) await call(state.socket, 'admin:updateChannel', { id: channel.id, name: name.value, topic: topic.value });
    else await call(state.socket, 'admin:createChannel', { name: name.value, topic: topic.value });
    dlg.close();
    toast(channel ? 'Canal enregistré.' : 'Canal créé.');
  });
  const dlg = modal(channel ? `Modifier #${channel.name}` : 'Créer un canal', form);
  name.focus();
}
