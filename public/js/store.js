// État partagé entre les écrans : qui je suis, les membres, les canaux, les non-lus, les conversations chargées.

export const state = {
  options: null,
  socket: null,
  me: null,
  users: new Map(),
  channels: [],
  dms: [], // [{ scope, otherId, lastAt }]
  unread: {},
  online: new Set(),
  mutedUntil: 0,
  route: { view: 'home', id: null },
  convs: new Map(), // scope -> { messages, complete, loaded, pendingRead }
  typing: new Map(), // scope -> Map(userId -> timer)
  games: [], // catalogue : [{ id, name, minPlayers, maxPlayers, color, options… }]
  joinOnOpen: null, // la partie à rejoindre dès qu'elle s'affiche (bouton Rejoindre, invitation)
  roles: [], // rôles décoratifs : [{ id, name, color }], dans l'ordre (le premier d'un membre colore son pseudo)
  tables: [], // résumés des tables : [{ id, game, hostId, status, seats, turn… }]
};

// Actions fournies par app.js au démarrage (évite les imports circulaires).
export const actions = {
  logout: () => {},
};

export function go(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

export function dmScope(otherId) {
  const me = state.me.id;
  return me < otherId ? `dm:${me}:${otherId}` : `dm:${otherId}:${me}`;
}

export function otherOf(scope) {
  const [a, b] = scope.split(':').slice(1).map(Number);
  return a === state.me.id ? b : a;
}

export function unreadTotal() {
  return Object.values(state.unread).reduce((a, b) => a + b, 0);
}

export const isAdmin = () => state.me?.role === 'admin';
// L'équipe : modérateurs (sourdine, messages, parties) et admins (tout).
export const isStaff = () => state.me?.role === 'admin' || state.me?.role === 'modo';
export const LEVELS = { membre: 'Membre', modo: 'Modérateur', admin: 'Admin' };
export const rolesOf = (u) => state.roles.filter((r) => u?.roles?.includes(r.id));
export const roleColor = (u) => rolesOf(u)[0]?.color ?? null; // clé de la palette, ou null

// Membres triés : en ligne d'abord, puis par pseudo.
export function sortedUsers() {
  return [...state.users.values()].sort((a, b) =>
    Number(state.online.has(b.id)) - Number(state.online.has(a.id)) || a.pseudo.localeCompare(b.pseudo, 'fr'));
}

export const gameOf = (id) => state.games.find((g) => g.id === id);

// Tables où c'est mon tour de jouer.
export const myTurnTables = () => state.tables.filter((t) => t.status === 'playing' && t.turn.includes(state.me.id));
