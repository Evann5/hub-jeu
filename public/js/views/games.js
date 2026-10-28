// Écran Jouer : en attendant l'étape 2 (tables de jeu), annonce ce qui arrive.
import { h, icon } from '../dom.js';
import { state } from '../store.js';

export function render(container) {
  const seats = ['rouge', 'bleu', 'jaune', 'vert'].map((c) => h('span.token.seat', { style: `--c:${state.options.colors[c]}`, 'aria-hidden': 'true' }));
  const waiting = state.channels.find((c) => c.name === 'on-joue-quand') || state.channels[0];
  container.replaceChildren(h('div.page',
    h('div.view-head.page-head', h('div', h('h1', 'Jouer'), h('p.view-sub', 'Les jeux de la classe, en direct.'))),
    h('section.card.card-table',
      h('div.seats', seats),
      h('h2', 'Les tables ouvrent bientôt'),
      h('p.card-text', 'Ici, tu pourras ouvrir une table, inviter la classe et jouer en direct. Le premier jeu est en préparation.'),
      waiting ? h('div.card-actions', h('a.btn.btn-dark', { href: `#/c/${waiting.id}` }, icon('chat'), `Organiser une partie dans #${waiting.name}`)) : null)));
}
