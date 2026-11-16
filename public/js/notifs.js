// Notifications de messages privés : une carte par personne, en haut à droite (en haut de l'écran sur téléphone),
// avec les derniers messages reçus et un champ pour répondre sans quitter ce qu'on fait (une partie, un autre salon).
// La carte reste tant qu'on y écrit ou qu'on la survole ; sinon elle s'en va seule au bout de 25 s.
import { h, icon, token, richText } from './dom.js';
import { call } from './net.js';
import { state } from './store.js';

const LIFE_MS = 25_000;
const SHOWN = 3; // messages gardés dans la carte
const cards = new Map(); // id de l'expéditeur -> { el, list, input, timer, scope, lastId }

let afterRead = () => {};
// messages.js prévient la liste et la navigation quand une conversation devient lue.
export function setAfterRead(fn) {
  afterRead = fn;
}

function box() {
  let el = document.getElementById('dm-notifs');
  if (!el) {
    el = h('div#dm-notifs', { 'aria-live': 'polite', 'aria-label': 'Messages privés reçus' });
    document.body.append(el);
  }
  return el;
}

function close(id) {
  const card = cards.get(id);
  if (!card) return;
  clearTimeout(card.timer);
  card.el.remove();
  cards.delete(id);
}

// La carte part toute seule, sauf si on est en train d'y écrire ou de la regarder.
function arm(id) {
  const card = cards.get(id);
  if (!card) return;
  clearTimeout(card.timer);
  card.timer = setTimeout(() => {
    const busy = card.el.matches(':hover') || card.el.contains(document.activeElement) || card.input.value.trim();
    if (busy) arm(id);
    else close(id);
  }, LIFE_MS);
}

function line(text, mine = false) {
  return h(`p.dm-notif-line${mine ? '.is-mine' : ''}`, mine ? [h('b', 'Toi : '), text] : richText(text));
}

export function notifyDM(m) {
  const from = state.users.get(m.userId);
  if (!from) return;
  let card = cards.get(m.userId);
  if (!card) {
    const list = h('div.dm-notif-list');
    const input = h('input.input.dm-notif-input', {
      type: 'text', name: 'dm_reply', autocomplete: 'off', maxlength: state.options?.limits?.messageMax ?? 2000,
      placeholder: `Répondre à ${from.pseudo}…`, 'aria-label': `Répondre à ${from.pseudo}`, enterkeyhint: 'send',
    });
    const status = h('p.dm-notif-status', { role: 'status' });
    const send = h('button.btn.btn-sm', { type: 'submit', title: 'Envoyer' }, icon('send', 'Envoyer'));
    const form = h('form.dm-notif-form', input, send);
    const el = h('section.dm-notif', { role: 'dialog', 'aria-label': `Message privé de ${from.pseudo}` },
      h('header.dm-notif-head',
        token(from, { size: 's', online: state.online?.has(from.id) }),
        h('span', h('b', from.pseudo), h('small', 'Message privé')),
        h('a.btn.btn-ghost.btn-sm', { href: `#/dm/${from.id}`, onclick: () => close(from.id) }, 'Ouvrir'),
        h('button.dm-notif-close', { type: 'button', 'aria-label': 'Fermer', onclick: () => close(from.id) }, icon('x', 'Fermer'))),
      list, form, status);
    card = { el, list, input, scope: m.scope, lastId: m.id, timer: 0 };
    cards.set(m.userId, card);
    el.addEventListener('mouseleave', () => arm(from.id));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = input.value.trim();
      if (!body) return;
      send.disabled = true;
      input.disabled = true;
      status.textContent = '';
      try {
        await call(state.socket, 'send', { scope: card.scope, body });
        card.list.append(line(body, true));
        input.value = '';
        // Répondre, c'est avoir lu : la conversation n'apparaît plus comme non lue.
        delete state.unread[card.scope];
        call(state.socket, 'read', { scope: card.scope, lastId: card.lastId }).catch(() => {});
        afterRead();
        status.textContent = 'Envoyé.';
        clearTimeout(card.timer);
        card.timer = setTimeout(() => close(from.id), 2500);
      } catch (err) {
        status.textContent = err.message; // sourdine, message trop long, coupure : la réponse reste dans le champ
        status.classList.add('is-error');
        arm(from.id);
      } finally {
        send.disabled = false;
        input.disabled = false;
        if (cards.has(from.id)) input.focus({ preventScroll: true });
      }
    });
    box().prepend(el);
  }
  card.lastId = m.id;
  card.list.append(line(m.body));
  while (card.list.childElementCount > SHOWN) card.list.firstElementChild.remove();
  arm(m.userId);
}

// En ouvrant la conversation elle-même, la carte n'a plus de raison d'être.
export function closeDMNotif(userId) {
  close(userId);
}

// Échap ferme la carte où l'on se trouve.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const [id, card] of cards) if (card.el.contains(document.activeElement)) close(id);
});

