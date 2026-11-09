// Escales : la carte du jeu. Partagée par rules.js (serveur) et client.js (navigateur).
// Pour changer de villes : modifier REGIONS, rien d'autre. 8 régions de 4 villes, de la moins chère à la plus chère.
// model : le monument 3D de la ville (client/monuments.js).

import { EXTRA_COUNTRIES } from './pays.js';

const STARTERS = [
  { id: 'maroc', name: 'Maroc', color: '#2EC4B6', cities: [
    { name: 'Chefchaouen', model: 'maisonsBleues', fact: 'La ville bleue, ruelles peintes du sol au toit.' },
    { name: 'Fès', model: 'riad', fact: 'Une immense médina sans voitures, classée à l’UNESCO.' },
    { name: 'Marrakech', model: 'minaret', fact: 'Jemaa el-Fna s’allume à la tombée de la nuit.' },
    { name: 'Casablanca', model: 'mosquee', fact: 'L’océan, l’art déco et la mosquée Hassan II.' },
  ] },
  { id: 'vietnam', name: 'Vietnam', color: '#FFC93C', cities: [
    { name: 'Hội An', model: 'lanternes', fact: 'Des lanternes par milliers au-dessus de la rivière.' },
    { name: 'Huế', model: 'porte', fact: 'L’ancienne cité impériale, sur la rivière des Parfums.' },
    { name: 'Hanoï', model: 'pagodeUnPilier', fact: 'Le vieux quartier dit des 36 rues, aux noms de métiers.' },
    { name: 'Hô Chi Minh-Ville', short: 'Hô Chi Minh', model: 'gratteCiel', fact: 'Des millions de scooters, jour et nuit.' },
  ] },
  { id: 'portugal', name: 'Portugal', color: '#6CC551', cities: [
    { name: 'Faro', model: 'phare', fact: 'La porte de l’Algarve et de ses falaises dorées.' },
    { name: 'Coimbra', model: 'tourHorloge', fact: 'Une des plus vieilles universités d’Europe.' },
    { name: 'Porto', model: 'pontArche', fact: 'Les quais de la Ribeira, face aux caves du Douro.' },
    { name: 'Lisbonne', model: 'tram', fact: 'Le tram 28 grimpe les collines de l’Alfama.' },
  ] },
  { id: 'mexique', name: 'Mexique', color: '#FF5FA2', cities: [
    { name: 'Oaxaca', model: 'maisonsColorees', fact: 'Le mole et les alebrijes en bois sculpté.' },
    { name: 'Guanajuato', model: 'maisonsColorees2', fact: 'Des maisons de toutes les couleurs et des rues sous terre.' },
    { name: 'Guadalajara', model: 'cathedrale', fact: 'La ville du mariachi, avec son festival international.' },
    { name: 'Mexico', model: 'pyramide', fact: 'Une ville géante, posée sur un ancien lac.' },
  ] },
  { id: 'italie', name: 'Italie', color: '#FF9248', cities: [
    { name: 'Naples', model: 'volcan', fact: 'La pizza, avec le Vésuve en toile de fond.' },
    { name: 'Florence', model: 'duomo', fact: 'Le dôme de Brunelleschi domine les toits rouges.' },
    { name: 'Venise', model: 'gondole', fact: 'Plus de 400 ponts, et pas de voitures dans le centre.' },
    { name: 'Rome', model: 'colisee', fact: 'On y marche sur plus de 2 000 ans d’histoire.' },
  ] },
  { id: 'japon', name: 'Japon', color: '#FFB3C7', cities: [
    { name: 'Nara', model: 'pagode', fact: 'Des cerfs en liberté saluent les passants.' },
    { name: 'Kyoto', model: 'torii', fact: 'Plus de mille temples et les allées de bambous.' },
    { name: 'Osaka', model: 'chateau', fact: 'Dotonbori et ses enseignes géantes, la cuisine du pays.' },
    { name: 'Tokyo', model: 'tourTokyo', fact: 'Shibuya, l’un des carrefours les plus fréquentés au monde.' },
  ] },
  { id: 'france', name: 'France', color: '#6FA1FF', cities: [
    { name: 'Marseille', model: 'basilique', fact: 'Le Vieux-Port, et la Bonne Mère qui veille.' },
    { name: 'Bordeaux', model: 'arcades', fact: 'Le miroir d’eau face à la place de la Bourse.' },
    { name: 'Lyon', model: 'basilique2', fact: 'Les traboules et les bouchons.' },
    { name: 'Paris', model: 'eiffel', fact: 'La tour Eiffel scintille à chaque heure, le soir.' },
  ] },
  { id: 'usa', name: 'États-Unis', color: '#FF6B5E', cities: [
    { name: 'La Nouvelle-Orléans', short: 'Nlle-Orléans', model: 'bateauVapeur', fact: 'Du jazz à tous les coins de rue.' },
    { name: 'Chicago', model: 'gratteCiel2', fact: 'Le berceau des gratte-ciel, au bord du lac Michigan.' },
    { name: 'San Francisco', model: 'goldenGate', fact: 'Le Golden Gate sort du brouillard.' },
    { name: 'New York', model: 'empire', fact: 'Times Square ne s’éteint jamais.' },
  ] },
];

// Tous les pays au choix. Le plateau en pose 8 : REGIONS est la carte en cours, les 8 de départ tant qu'on n'en a pas choisi d'autres.
export const COUNTRIES = [...STARTERS, ...EXTRA_COUNTRIES];
export const DEFAULT_MAP = STARTERS.map((c) => c.id);
export const REGIONS = [...STARTERS];
export const MAP_SIZE = REGIONS.length;
const byId = new Map(COUNTRIES.map((c) => [c.id, c]));
export const isCountry = (id) => byId.has(id);
// Combien de pays il faut choisir : autant que de joueurs, de 4 à 8. Les places restantes sont tirées au hasard.
export const minCountries = (players) => Math.min(MAP_SIZE, Math.max(4, players));

// Prix des 4 villes de chaque région, coût d'un niveau de construction.
const PRICES = [
  [60, 60, 70, 80], [90, 90, 100, 120], [130, 130, 140, 160], [170, 170, 180, 200],
  [220, 220, 230, 250], [260, 260, 280, 300], [310, 310, 330, 350], [370, 370, 400, 450],
];
const BUILD = [50, 50, 100, 100, 150, 150, 200, 200];

// Loyer d'une ville selon son niveau : multiplie le loyer de base (10 % du prix).
export const LEVEL_MULT = [1, 5, 13, 26, 40];
export const LEVEL_NAMES = ['Ville nue', 'Quartier', 'Quartier animé', 'Tours', 'Skyline'];
export const MAX_LEVEL = 4;
export const ESCALE_PRICE = 200;
export const ESCALE_RENTS = [0, 25, 50, 100, 200]; // selon le nombre d'escales du propriétaire
export const CUSTOMS_POS = 12;
export const SIZE = 48;

const ESCALES = ['Escale Nord', 'Escale Est', 'Escale Sud', 'Escale Ouest'];

// Chaque côté : 4 villes, une case, une escale au milieu, 4 villes, une case… puis un coin.
function buildTiles() {
  const tiles = [];
  const city = (r, i) => ({
    type: 'city', region: r, slot: i, name: REGIONS[r].cities[i].name, short: REGIONS[r].cities[i].short, model: REGIONS[r].cities[i].model, fact: REGIONS[r].cities[i].fact,
    price: PRICES[r][i], build: BUILD[r], rent: Math.round(PRICES[r][i] / 10),
  });
  const SIDES = [
    { corner: { type: 'start', name: 'Départ' }, a: 0, b: 1, s1: { type: 'telex', name: 'Télex' }, s2: { type: 'tax', name: 'Impôts', tax: 'percent' } },
    { corner: { type: 'customs', name: 'Douane' }, a: 2, b: 3, s1: { type: 'telex', name: 'Télex' }, s2: { type: 'chantier', name: 'Chantier' } },
    { corner: { type: 'festival', name: 'Festival' }, a: 4, b: 5, s1: { type: 'telex', name: 'Télex' }, s2: { type: 'tax', name: 'Taxe de séjour', tax: 'flat', amount: 100 } },
    { corner: { type: 'control', name: 'Contrôle' }, a: 6, b: 7, s1: { type: 'telex', name: 'Télex' }, s2: { type: 'chantier', name: 'Chantier' } },
  ];
  SIDES.forEach((side, n) => {
    tiles.push(side.corner, city(side.a, 0), city(side.a, 1), side.s1, city(side.a, 2), city(side.a, 3),
      { type: 'escale', name: ESCALES[n], price: ESCALE_PRICE },
      city(side.b, 0), city(side.b, 1), side.s2, city(side.b, 2), city(side.b, 3));
  });
  return tiles.map((t, pos) => ({ ...t, pos }));
}

export const TILES = buildTiles();

// Le nom d'une case sur une carte donnée. Le serveur fait tourner plusieurs tables en même temps : il ne touche jamais à TILES.
export function nameOn(map, pos) {
  const t = TILES[pos];
  if (t.type !== 'city' || !map) return t.name;
  return byId.get(map[t.region])?.cities[t.slot].name ?? t.name;
}

// Dans le navigateur, une seule table à la fois : la carte de la partie remplace celle de départ.
export function applyMap(map) {
  (map ?? DEFAULT_MAP).forEach((id, r) => { REGIONS[r] = byId.get(id) ?? STARTERS[r]; });
  for (const t of TILES) {
    if (t.type !== 'city') continue;
    const { name, short, model, fact } = REGIONS[t.region].cities[t.slot];
    Object.assign(t, { name, short, model, fact });
  }
}

// Les règles en bref, consultables pendant la partie.
export const RULES = [
  'Lance les dés et avance. Un double fait rejouer ; au troisième de suite, c’est la Douane.',
  'Au Départ : +200 €.',
  'Ville libre : achète-la ou passe. Si tu passes, elle reste libre.',
  'Avec 3 villes d’un pays (2 suffisent à 2 ou 3 joueurs), le loyer double et tu peux construire. Avec les 4, il triple.',
  'Escales : le loyer monte avec leur nombre.',
  'Festival : tu gagnes 100 €. Chantier : tu paies 50 €.',
  'Échange à tout moment, même hors de ton tour : villes contre argent.',
  'Plus d’argent ? Vends des constructions, mets des villes en gage ou négocie. Sinon, c’est la faillite.',
  'Au dernier tour, le plus gros patrimoine gagne (argent, villes, constructions).',
];

// Le gage : ce qu'il rapporte, et ce que coûte le rachat.
export const mortgageValue = (t) => Math.floor(t.price / 2);
export const unmortgageCost = (t) => Math.ceil((t.price / 2) * 1.1);
