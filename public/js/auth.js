// Écrans d'accueil : connexion, inscription, changement de mot de passe obligatoire.
import { h, icon, token } from './dom.js';
import { api } from './net.js';
import { openRules } from './dialogs.js';

// Accueil : une grande carte « Hubuno » et trois petites cartes de couleur.
function bento() {
  const people = [['violet', '🦊'], ['jaune', '🐸'], ['rose', '🦄'], ['cyan', '🐙']];
  return h('div.bento',
    h('div.tile.tile-brand',
      h('h1.wordmark', 'Hubuno'),
      h('p.auth-tagline', 'Les jeux de société de la classe, et de quoi discuter entre deux parties.')),
    h('div.tile.tile-games', icon('dice'), h('p', 'Des parties en direct')),
    h('div.tile.tile-people', h('div.tile-tokens', people.map(([color, avatar]) => token({ color, avatar }))), h('p', 'Toute la classe')),
    h('div.tile.tile-chat', icon('chat'), h('p', 'Canaux et messages privés')));
}

function hero() {
  return h('section.auth-stage', bento());
}

function submitting(form, busy) {
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = busy;
}

function showError(form, message) {
  let box = form.querySelector('.form-error');
  if (!message) return box?.remove();
  if (!box) {
    box = h('p.form-error', { role: 'alert' });
    form.querySelector('button[type=submit]').before(box);
  }
  box.textContent = message;
}

export function renderAuth(root, { mode = 'login', onDone }) {
  const panel = h('div.auth-card');
  const tabs = h('div.switch', { role: 'tablist', 'aria-label': 'Connexion ou inscription' });

  function draw(next) {
    mode = next;
    tabs.replaceChildren(
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(mode === 'login'), onclick: () => draw('login') }, 'Se connecter'),
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(mode === 'register'), onclick: () => draw('register') }, 'Créer un compte'),
    );
    panel.replaceChildren(
      h('h2', mode === 'login' ? 'Bon retour sur Hubuno' : 'Rejoindre la classe'),
      tabs,
      mode === 'login' ? loginForm() : registerForm(),
    );
  }

  function loginForm() {
    const form = h('form', { novalidate: true },
      h('label.field', h('span', 'Pseudo'),
        h('input.input', { name: 'login_pseudo', autocomplete: 'username', required: true, autocapitalize: 'none', spellcheck: false })),
      h('label.field', h('span', 'Mot de passe'),
        h('input.input', { name: 'login_password', type: 'password', autocomplete: 'current-password', required: true })),
      h('button.btn.btn-block', { type: 'submit' }, 'Se connecter'),
      h('p.hint', 'Mot de passe oublié ? Demande à un admin : il te donnera un mot de passe provisoire.'),
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError(form, null);
      submitting(form, true);
      try {
        const res = await api('login', {
          pseudo: form.elements.login_pseudo.value.trim(),
          password: form.elements.login_password.value,
        });
        onDone(res);
      } catch (err) {
        showError(form, err.message);
        submitting(form, false);
      }
    });
    return form;
  }

  function registerForm() {
    const form = h('form', { novalidate: true },
      h('label.field', h('span', 'Code de la classe'),
        h('input.input', { name: 'reg_code', autocomplete: 'off', required: true, autocapitalize: 'none', spellcheck: false }),
        h('small', 'Un admin te le donne.')),
      h('label.field', h('span', 'Pseudo'),
        h('input.input', { name: 'reg_pseudo', autocomplete: 'username', required: true, autocapitalize: 'none', spellcheck: false, maxlength: 20 }),
        h('small', 'De 3 à 20 caractères. Les autres te verront sous ce nom.')),
      h('label.field', h('span', 'Mot de passe'),
        h('input.input', { name: 'reg_password', type: 'password', autocomplete: 'new-password', required: true, minlength: 10 }),
        h('small', 'Au moins 10 caractères.')),
      h('div.check',
        h('input', { type: 'checkbox', id: 'reg-rules', name: 'reg_rules', required: true }),
        h('label', { htmlFor: 'reg-rules' }, "J'accepte les ",
          h('button.link-btn', { type: 'button', onclick: (e) => { e.preventDefault(); openRules(); } }, 'règles de Hubuno'),
          ' et la façon dont mes données sont gardées.')),
      h('button.btn.btn-block', { type: 'submit' }, 'Créer mon compte'),
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError(form, null);
      submitting(form, true);
      try {
        const res = await api('register', {
          classCode: form.elements.reg_code.value.trim(),
          pseudo: form.elements.reg_pseudo.value.trim(),
          password: form.elements.reg_password.value,
          acceptRules: form.elements.reg_rules.checked,
        });
        onDone(res);
      } catch (err) {
        showError(form, err.message);
        submitting(form, false);
      }
    });
    return form;
  }

  draw(mode);
  root.replaceChildren(h('main.auth', hero(), h('section.auth-panel', panel)));
  // Sur téléphone, on n'ouvre pas le clavier d'office : il cacherait l'écran d'accueil.
  if (matchMedia('(hover: hover)').matches) panel.querySelector('input')?.focus({ preventScroll: true });
}

export function renderForcedPassword(root, { onDone }) {
  const form = h('form', { novalidate: true },
    h('label.field', h('span', 'Nouveau mot de passe'),
      h('input.input', { name: 'new_password', type: 'password', autocomplete: 'new-password', required: true, minlength: 10 }),
      h('small', 'Au moins 10 caractères.')),
    h('label.field', h('span', 'Encore une fois'),
      h('input.input', { name: 'new_password2', type: 'password', autocomplete: 'new-password', required: true })),
    h('button.btn.btn-block', { type: 'submit' }, 'Enregistrer mon mot de passe'),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError(form, null);
    const pass = form.elements.new_password.value;
    if (pass !== form.elements.new_password2.value) return showError(form, 'Les deux mots de passe ne sont pas identiques.');
    submitting(form, true);
    try {
      await api('password', { password: pass });
      onDone();
    } catch (err) {
      showError(form, err.message);
      submitting(form, false);
    }
  });
  root.replaceChildren(h('main.auth',
    hero(),
    h('section.auth-panel', h('div.auth-card',
      h('h2', 'Choisis ton mot de passe'),
      h('p.hint', 'Un admin a réinitialisé ton mot de passe. Choisis-en un nouveau que personne d’autre ne connaît.'),
      form))));
  form.querySelector('input').focus();
}
