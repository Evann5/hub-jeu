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

// Le personnage de chacun, pièce par pièce. Il apparaît dans le profil, comme avatar (sa tête) et dans les jeux qui ont des pions (Escales).
// Chaque liste : clé enregistrée -> nom affiché. Les couleurs sont en hex. Sans personnage, le jeu donne un voyageur par place.
export const CHARACTER = {
  skins: ['#FAD9C1', '#F6D7BC', '#F2C9A5', '#EFC09A', '#E8B48E', '#D9A77E', '#C68B5E', '#8D5A3C', '#7A4A30', '#5F3B28'],
  hairs: { noir: '#23202A', brun: '#4F3325', chatain: '#7A4B2A', blond: '#E5B84C', roux: '#C4562B', gris: '#C3C7CF', blanc: '#F1F1F1', bleu: '#3B6FD9', vert: '#3DBE7A', rose: '#E46BA8', violet: '#8C5BD8' },
  hairStyles: { court: 'Court', mi: 'Mi-long', long: 'Long', chignon: 'Chignon', tresse: 'Tresse', boucles: 'Boucles', crete: 'Crête', rase: 'Rasé' },
  hats: { aucun: 'Aucun', casquette: 'Casquette', bonnet: 'Bonnet', paille: 'Chapeau de paille', explorateur: 'Chapeau d’explorateur', beret: 'Béret', pilote: 'Casquette de pilote', casque: 'Casque de vélo', toque: 'Toque', couronne: 'Couronne', bandeau: 'Bandeau' },
  glasses: { aucune: 'Aucune', rondes: 'Rondes', carrees: 'Carrées', soleil: 'De soleil' },
  beards: { aucune: 'Aucune', moustache: 'Moustache', courte: 'Barbe courte', longue: 'Grande barbe' },
  accessories: { aucun: 'Aucun', sac: 'Sac à dos', valise: 'Valise', appareil: 'Appareil photo', planche: 'Planche de surf', canne: 'Canne', sacoche: 'Sacoche', guitare: 'Guitare', ballon: 'Ballon' },
  legs: { pantalon: 'Pantalon', short: 'Short', jupe: 'Jupe' },
  topStyles: { tshirt: 'T-shirt', sweat: 'Sweat à capuche', veste: 'Veste', raye: 'Pull rayé', robe: 'Robe' },
  eyes: { normaux: 'Normaux', grands: 'Grands', joyeux: 'Rieurs', clin: 'Clin d’œil', endormis: 'Endormis' },
  mouths: { sourire: 'Sourire', grand: 'Grand sourire', neutre: 'Neutre', surpris: 'Surpris', langue: 'Langue tirée' },
  cheeks: { aucune: 'Aucune', rosees: 'Rosées' },
  clothes: { rouge: '#E5213C', orange: '#FF8A00', jaune: '#F5C400', vert: '#16A34A', menthe: '#2EC4B6', cyan: '#0891B2', bleu: '#2563EB', marine: '#27304D', violet: '#7C3AED', rose: '#DB2777', marron: '#92602F', beige: '#D9BF8C', gris: '#64748B', noir: '#23202A', blanc: '#F5F5F5' },
};

// Les anciens personnages (une tenue parmi 10, juin–novembre 2026) deviennent des personnages pièce par pièce.
const LEGACY = [
  { hat: 'pilote' }, { hat: 'casquette', accessory: 'sac', legs: 'short' }, { hat: 'paille', accessory: 'appareil', legs: 'short' },
  { hat: 'bonnet', beard: 'courte' }, { hairStyle: 'chignon', accessory: 'valise', legs: 'jupe' }, { hat: 'casque', legs: 'short' },
  { hat: 'explorateur', hairStyle: 'tresse', accessory: 'sacoche' }, { accessory: 'planche', legs: 'short' }, { hat: 'toque' },
  { hat: 'beret', glasses: 'rondes', accessory: 'canne' },
];
const pick = (value, list, fallback) => (Object.hasOwn(list, value) ? value : fallback);

// Un personnage reçu (du navigateur ou de la base) : rendu propre, ou null s'il n'est pas valable.
export function cleanCharacter(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const skin = Number(c.skin);
  if (!Number.isInteger(skin) || skin < 0 || skin >= CHARACTER.skins.length) return null;
  if (!Object.hasOwn(CHARACTER.hairs, c.hair)) return null;
  let src = c;
  if (c.v !== 2) { // ancien format : { style, skin, hair }
    const style = Number(c.style);
    if (!Number.isInteger(style) || style < 0 || style >= LEGACY.length) return null;
    src = { ...LEGACY[style], hair: c.hair };
  }
  const look = {
    v: 2,
    skin,
    hair: src.hair,
    hairStyle: pick(src.hairStyle, CHARACTER.hairStyles, 'court'),
    hat: pick(src.hat, CHARACTER.hats, 'aucun'),
    glasses: pick(src.glasses, CHARACTER.glasses, 'aucune'),
    beard: pick(src.beard, CHARACTER.beards, 'aucune'),
    accessory: pick(src.accessory, CHARACTER.accessories, 'aucun'),
    legs: pick(src.legs, CHARACTER.legs, 'pantalon'),
    top: pick(src.top, CHARACTER.clothes, 'bleu'),
    bottom: pick(src.bottom, CHARACTER.clothes, 'marine'),
    topStyle: pick(src.topStyle, CHARACTER.topStyles, 'tshirt'),
    shoes: pick(src.shoes, CHARACTER.clothes, 'noir'),
    eyes: pick(src.eyes, CHARACTER.eyes, 'normaux'),
    mouth: pick(src.mouth, CHARACTER.mouths, 'sourire'),
    cheeks: pick(src.cheeks, CHARACTER.cheeks, 'aucune'),
  };
  // Un nouveau personnage doit être entièrement valable : une pièce inconnue est refusée, pas remplacée en silence.
  if (c.v === 2) {
    for (const [key, list] of [['hairStyle', 'hairStyles'], ['hat', 'hats'], ['glasses', 'glasses'], ['beard', 'beards'], ['accessory', 'accessories'], ['legs', 'legs'], ['top', 'clothes'], ['bottom', 'clothes']]) {
      if (!Object.hasOwn(CHARACTER[list], c[key])) return null;
    }
    // Pièces ajoutées après coup (17/11/2026) : absentes, elles prennent leur valeur par défaut ; présentes, elles doivent exister.
    for (const [key, list] of [['topStyle', 'topStyles'], ['shoes', 'clothes'], ['eyes', 'eyes'], ['mouth', 'mouths'], ['cheeks', 'cheeks']]) {
      if (c[key] !== undefined && !Object.hasOwn(CHARACTER[list], c[key])) return null;
    }
  }
  return look;
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
