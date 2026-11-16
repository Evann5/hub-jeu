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

// Le personnage de chacun : une tenue (10 styles), une couleur de peau et une couleur de cheveux.
// Il apparaît dans le profil et dans les jeux qui ont des personnages (les pions d'Escales). Rien de choisi : le jeu en donne un par place.
export const CHARACTER = {
  styles: ['Pilote', 'Sac à dos', 'Chapeau de paille', 'Marin', 'Valise', 'Casque de vélo', 'Explorateur', 'Surf', 'Cuisine', 'Béret et canne'],
  skins: ['#F6D7BC', '#F2C9A5', '#EFC09A', '#E8B48E', '#D9A77E', '#C68B5E', '#8D5A3C', '#7A4A30', '#5F3B28', '#FAD9C1'],
  hairs: { noir: '#23202A', brun: '#4F3325', blond: '#E5B84C', roux: '#C4562B', gris: '#C3C7CF', bleu: '#3B6FD9', rose: '#E46BA8' },
};

// Un personnage reçu (du navigateur ou de la base) : rendu propre, ou null s'il n'est pas valable.
export function cleanCharacter(c) {
  if (!c || typeof c !== 'object') return null;
  const style = Number(c.style);
  const skin = Number(c.skin);
  if (!Number.isInteger(style) || style < 0 || style >= CHARACTER.styles.length) return null;
  if (!Number.isInteger(skin) || skin < 0 || skin >= CHARACTER.skins.length) return null;
  if (!Object.hasOwn(CHARACTER.hairs, c.hair)) return null;
  return { style, skin, hair: c.hair };
}

export function readCharacter(text) {
  try {
    return text ? cleanCharacter(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

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
