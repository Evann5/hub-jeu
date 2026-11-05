// Écran Accueil : un tableau de bord en cartes — bonjour, qui est en ligne, messages non lus, jouer, mon profil.
import { h, icon, token, count, gameLogo } from '../dom.js';
import { state, unreadTotal, sortedUsers, myTurnTables } from '../store.js';
import { openProfile } from '../dialogs.js';

const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

function hello() {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 5 ? 'Bonsoir' : 'Salut';
}

// Les conversations avec des messages non lus, les plus chargées d'abord.
function unreadRows() {
  return Object.entries(state.unread)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([scope, n]) => {
      if (scope.startsWith('c:')) {
        const c = state.channels.find((x) => x.id === Number(scope.slice(2)));
        return c && { href: `#/c/${c.id}`, label: c.name, n, lead: h('span.conv-icon', icon('hash')) };
      }
      const [a, b] = scope.split(':').slice(1).map(Number);
      const u = state.users.get(a === state.me.id ? b : a);
      return u && { href: `#/dm/${u.id}`, label: u.pseudo, n, lead: token(u, { size: 's' }) };
    })
    .filter(Boolean)
    .slice(0, 5);
}

export function render(container) {
  const online = sortedUsers().filter((u) => u.id !== state.me.id && state.online.has(u.id));
  const total = unreadTotal();
  const rows = unreadRows();
  const first = state.channels[0];
  const turns = myTurnTables().length;
  const lobbies = state.tables.filter((t) => t.status === 'lobby').length;
  const playText = turns ? `C’est à toi de jouer sur ${count(turns, 'table', 'tables')}.`
    : lobbies ? `${count(lobbies, 'salon ouvert attend', 'salons ouverts attendent')} des joueurs.`
      : `${count(state.games.length, 'jeu', 'jeux')} : ouvre une table et invite la classe.`;

  const summary = [
    online.length ? `${count(online.length, 'personne est', 'personnes sont')} en ligne` : 'Personne d’autre n’est en ligne',
    total ? `tu as ${count(total, 'message non lu', 'messages non lus')}` : 'tu es à jour',
  ].join(', et ');

  container.replaceChildren(h('div.home',
    h('section.card.card-hello',
      h('p.card-kicker', dateFmt.format(new Date())),
      h('h1', `${hello()} ${state.me.pseudo}`),
      h('p.card-text', `${summary}.`),
      h('div.card-actions',
        h('a.btn.btn-dark', { href: total && rows[0] ? rows[0].href : first ? `#/c/${first.id}` : '#/messages' },
          icon('chat'), total ? 'Lire mes messages' : 'Ouvrir le chat'),
        h('a.btn.btn-outline-dark', { href: '#/jouer' }, icon('dice'), 'Jouer'))),

    h('a.card.card-play', { href: '#/jouer' },
      h('span.card-corner', icon('open')),
      h('div.play-mosaic', { 'aria-hidden': 'true' }, state.games.slice(0, 8).map((g) => h('span.play-tile', { style: `--g:${g.color};--g-ink:${g.ink}` }, gameLogo(g)))),
      h('div', h('h2', turns ? 'À toi de jouer' : 'Jouer'), h('p.card-text', playText))),

    h('section.card.card-online',
      h('div.card-top', h('h2', 'En ligne'), online.length ? h('span.big-num', String(online.length)) : h('span.card-text', 'Personne')),
      online.length
        ? h('ul.online-tokens', online.slice(0, 12).map((u) => h('li', h('button.token-btn', {
          type: 'button',
          title: u.pseudo,
          onclick: () => openProfile(u.id),
        }, token(u), h('span.sr-only', u.pseudo)))))
        : h('p.card-text', 'Personne d’autre pour l’instant. Les membres connectés apparaîtront ici.'),
      h('a.card-link', { href: '#/membres' }, 'Voir tous les membres')),

    h('section.card.card-inbox',
      h('div.card-top', h('h2', 'Non lus'), total ? h('span.badge', total > 99 ? '99+' : String(total)) : null),
      rows.length
        ? h('ul.inbox', rows.map((r) => h('li', h('a.conv-item', { href: r.href }, r.lead, h('span.label', r.label), h('span.badge', String(r.n))))))
        : h('div.inbox-empty',
          h('p.card-text', 'Rien de nouveau. Lance la discussion :'),
          first ? h('a.conv-item', { href: `#/c/${first.id}` }, h('span.conv-icon', icon('hash')), h('span.label', first.name)) : null)),

    h('a.card.card-me', { href: '#/profil' },
      h('span.card-corner', icon('open')),
      token(state.me, { size: 'l' }),
      h('div', h('h2', state.me.pseudo), h('p.card-text', state.me.bio || 'Ajoute une bio et choisis ton avatar.'))),
  ));
}
