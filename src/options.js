// Choix proposés dans le profil et la messagerie, partagés avec le navigateur par /api/options.

// Couleurs des jetons (avatars). La valeur hex sert aussi côté CSS.
export const COLORS = {
  rouge: '#EF5B5B',
  orange: '#F39237',
  jaune: '#F4C542',
  vert: '#3DBE7A',
  cyan: '#3CC4D0',
  bleu: '#4C8DF6',
  violet: '#A77BF3',
  rose: '#F078B5',
};

export const AVATARS = [
  '🎲', '♟️', '🃏', '🎯', '🧩', '👑', '🦊', '🐸', '🐙', '🦉', '🐼', '🦁',
  '🐢', '🦄', '🐝', '🍀', '🌵', '🍕', '🍩', '🚀', '⚡', '🔥', '🌙', '⭐',
];

export const REACTIONS = ['👍', '😂', '❤️', '😮', '😢', '🔥', '🎲', '👏'];

export const LIMITS = {
  pseudoMin: 3,
  pseudoMax: 20,
  passwordMin: 10,
  bioMax: 140,
  messageMax: 2000,
  channelNameMax: 30,
  topicMax: 100,
};
