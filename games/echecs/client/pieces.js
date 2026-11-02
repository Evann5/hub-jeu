// Les six pièces, dessinées à la main en SVG (viewBox 100 × 100), une seule fois dans un « sprite » réutilisé par <use>.

const NS = 'http://www.w3.org/2000/svg';

// Pièces épurées et contemporaines : formes géométriques pleines, trait fin, aucun ornement.
// Les formes n'ont ni remplissage ni trait : ils viennent du CSS (classes .w et .b) ; les détails utilisent currentColor.

const LINE = { fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round' };

// Socle : une simple barre
const BASE = [['rect', { x: 26, y: 78, width: 48, height: 9, rx: 2.5 }]];

const SHAPES = {
  P: [
    ['circle', { cx: 50, cy: 31, r: 12 }],
    ['path', { d: 'M39 78 L44 47 H56 L61 78 Z' }],
    ['rect', { x: 36, y: 44, width: 28, height: 6, rx: 3 }],
    ...BASE,
  ],
  R: [
    ['path', { d: 'M31 20 H41 V28 H45 V20 H55 V28 H59 V20 H69 V40 H31 Z' }],
    ['path', { d: 'M36 40 H64 L67 78 H33 Z' }],
    ...BASE,
  ],
  B: [
    ['path', { d: 'M50 13 C65 27 68 42 59 54 L62 78 H38 L41 54 C32 42 35 27 50 13 Z' }],
    ['path', { d: 'M50 28 L56 38', ...LINE }],
    ...BASE,
  ],
  N: [
    ['path', { d: 'M30 78 L38 52 L26 46 L28 40 L42 22 L41 12 L51 19 C69 22 75 44 71 78 Z' }],
    ['circle', { cx: 40, cy: 31, r: 2.8, fill: 'currentColor', stroke: 'none' }],
    ['path', { d: 'M34 46 L40 44', ...LINE }],
    ...BASE,
  ],
  Q: [
    ['path', { d: 'M33 78 L26 32 L41 50 L50 26 L59 50 L74 32 L67 78 Z' }],
    ['circle', { cx: 26, cy: 28, r: 4.5 }],
    ['circle', { cx: 50, cy: 21, r: 5 }],
    ['circle', { cx: 74, cy: 28, r: 4.5 }],
    ...BASE,
  ],
  K: [
    ['path', { d: 'M33 78 L29 48 C29 38 38 34 50 34 C62 34 71 38 71 48 L67 78 Z' }],
    ['path', { d: 'M45.5 5 H54.5 V13 H62.5 V22 H54.5 V30 H45.5 V22 H37.5 V13 H45.5 Z' }],
    ...BASE,
  ],
};

export const PIECE_NAMES = { K: 'roi', Q: 'dame', R: 'tour', B: 'fou', N: 'cavalier', P: 'pion' };

function make(tag, attrs, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
  el.append(...children);
  return el;
}

// Le sprite : à poser une fois dans le jeu. Les symboles s'appellent eq-K, eq-Q…
export function sprite() {
  const defs = make('defs', {}, ...Object.entries(SHAPES).map(([key, shapes]) => make('symbol', { id: `eq-${key}`, viewBox: '0 0 100 100' },
    ...shapes.map(([tag, attrs]) => make(tag, attrs)))));
  return make('svg', { class: 'eq-sprite', width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false' }, defs);
}

// Une pièce prête à poser : letter = 'K'… (type), white = vrai pour les blancs.
export function pieceSvg(letter, white) {
  return make('svg', { class: `eq-p ${white ? 'w' : 'b'}`, viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false' },
    make('use', { href: `#eq-${letter.toUpperCase()}`, width: 100, height: 100 }));
}
