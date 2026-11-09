// Illustrations des Loups-garous en SVG simple : cartes de rôle, décor du village. Aucun texte injecté, que des formes.

const NS = 'http://www.w3.org/2000/svg';

export function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid) el.append(kid);
  return el;
}

const PAPER = '#FFFFFF';
const PAPER2 = '#DCEFE6';
const INK = '#082420';
const GOLD = '#FFC23D';

const star = (x, y, s = 1, o = 1) => svg('path', {
  d: 'M0-6 1.6-1.6 6 0 1.6 1.6 0 6-1.6 1.6-6 0-1.6-1.6Z', fill: GOLD, opacity: o, transform: `translate(${x} ${y}) scale(${s})`,
});

// Chaque rôle : nom, courte phrase, couleur de la médaille, dessin (viewBox 120 × 120). currentColor = couleur du rôle.
export const ROLES = {
  wolf: {
    name: 'Loup-garou', short: 'Loup', color: '#FF5468', team: 'les loups',
    line: 'Chaque nuit, tu dévores un villageois avec ta meute. Le jour, fais comme si de rien n’était.',
    art: () => [
      svg('polygon', { points: '60,106 34,88 24,58 28,18 52,40 68,40 92,18 96,58 86,88', fill: PAPER }),
      svg('polygon', { points: '33,30 47,44 35,53', fill: 'currentColor' }),
      svg('polygon', { points: '87,30 73,44 85,53', fill: 'currentColor' }),
      svg('polygon', { points: '60,42 54,58 60,66 66,58', fill: INK, opacity: 0.8 }),
      svg('polygon', { points: '60,106 47,90 51,70 69,70 73,90', fill: PAPER2 }),
      svg('polygon', { points: '37,60 54,66 49,73 39,68', fill: GOLD }),
      svg('polygon', { points: '83,60 66,66 71,73 81,68', fill: GOLD }),
      svg('polygon', { points: '45,64 52,67 49,70', fill: INK }),
      svg('polygon', { points: '75,64 68,67 71,70', fill: INK }),
      svg('polygon', { points: '53,84 67,84 60,93', fill: INK }),
      svg('path', { d: 'M60 93v8M60 101q-5 4-9 1M60 101q5 4 9 1', stroke: INK, 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }),
    ],
  },
  villager: {
    name: 'Villageois', short: 'Villageois', color: '#6EC8FF', team: 'le village',
    line: 'Tu n’as aucun pouvoir, seulement ton flair. Écoute, débats, et trouve les loups avant qu’il ne soit trop tard.',
    art: () => [
      svg('path', { d: 'M82 30c-5-7 5-9 0-17', stroke: PAPER, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', opacity: 0.7 }),
      svg('rect', { x: 78, y: 28, width: 10, height: 22, fill: INK }),
      svg('rect', { x: 26, y: 58, width: 68, height: 44, rx: 2, fill: PAPER }),
      svg('polygon', { points: '16,64 60,24 104,64', fill: INK }),
      svg('polygon', { points: '28,62 60,34 92,62', fill: 'currentColor', opacity: 0.85 }),
      svg('rect', { x: 52, y: 76, width: 16, height: 26, rx: 8, fill: 'currentColor' }),
      svg('rect', { x: 33, y: 68, width: 13, height: 13, rx: 2, fill: GOLD }),
      svg('rect', { x: 74, y: 68, width: 13, height: 13, rx: 2, fill: GOLD }),
      svg('path', { d: 'M39.5 68v13M33 74.5h13M80.5 68v13M74 74.5h13', stroke: INK, 'stroke-width': 1.5 }),
      svg('rect', { x: 18, y: 100, width: 84, height: 5, rx: 2.5, fill: INK, opacity: 0.45 }),
    ],
  },
  seer: {
    name: 'Voyante', short: 'Voyante', color: '#B79CFF', team: 'le village',
    line: 'Chaque nuit, tu sondes un joueur et découvres son vrai rôle. Guide le village sans te faire repérer.',
    art: () => [
      star(22, 28, 1.1), star(98, 22, 0.9), star(100, 84, 0.7, 0.8), star(16, 76, 0.6, 0.8),
      svg('path', { d: 'M34 104 42 86h36l8 18Z', fill: GOLD }),
      svg('rect', { x: 30, y: 102, width: 60, height: 6, rx: 3, fill: PAPER2 }),
      svg('circle', { cx: 60, cy: 54, r: 33, fill: INK, stroke: PAPER, 'stroke-width': 3 }),
      svg('circle', { cx: 60, cy: 54, r: 29, fill: 'currentColor', opacity: 0.55 }),
      svg('path', { d: 'M36 54Q60 32 84 54Q60 76 36 54Z', fill: PAPER }),
      svg('circle', { cx: 60, cy: 54, r: 10, fill: GOLD }),
      svg('circle', { cx: 60, cy: 54, r: 4.5, fill: INK }),
      svg('path', { d: 'M38 36a28 28 0 0 1 14-9', stroke: PAPER, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', opacity: 0.8 }),
    ],
  },
  witch: {
    name: 'Sorcière', short: 'Sorcière', color: '#3FE0A8', team: 'le village',
    line: 'Tu as deux potions, une pour sauver, une pour empoisonner. Une seule fois chacune : choisis bien.',
    art: () => [
      star(24, 30, 1, 0.9), star(98, 40, 0.8), star(86, 100, 0.6, 0.8),
      svg('path', { d: 'M30 82C44 64 52 42 58 24 62 12 76 12 78 22 70 20 66 24 68 32 72 50 82 68 90 82Z', fill: INK }),
      svg('path', { d: 'M40 70 85 70 90 80 34 80Z', fill: GOLD }),
      svg('rect', { x: 55, y: 68, width: 14, height: 14, rx: 2, fill: INK }),
      svg('rect', { x: 59, y: 72, width: 6, height: 6, fill: GOLD }),
      svg('ellipse', { cx: 60, cy: 84, rx: 44, ry: 10, fill: INK }),
      svg('ellipse', { cx: 60, cy: 82, rx: 44, ry: 9, fill: INK, stroke: PAPER, 'stroke-width': 1.5, opacity: 0.9 }),
      svg('circle', { cx: 40, cy: 104, r: 4, fill: PAPER, opacity: 0.8 }),
      svg('circle', { cx: 52, cy: 100, r: 2.5, fill: PAPER, opacity: 0.6 }),
      svg('circle', { cx: 82, cy: 102, r: 3.5, fill: PAPER, opacity: 0.7 }),
    ],
  },
  hunter: {
    name: 'Chasseur', short: 'Chasseur', color: '#FF9F43', team: 'le village',
    line: 'Si tu meurs, tu as le temps d’un dernier tir : emporte quelqu’un avec toi. Vise juste.',
    art: () => [
      svg('circle', { cx: 56, cy: 66, r: 38, fill: PAPER }),
      svg('circle', { cx: 56, cy: 66, r: 28, fill: 'currentColor' }),
      svg('circle', { cx: 56, cy: 66, r: 19, fill: PAPER }),
      svg('circle', { cx: 56, cy: 66, r: 10, fill: 'currentColor' }),
      svg('circle', { cx: 56, cy: 66, r: 4, fill: GOLD }),
      svg('path', { d: 'M96 18 58 64', stroke: INK, 'stroke-width': 4.5, 'stroke-linecap': 'round' }),
      svg('polygon', { points: '54,70 58,58 66,66', fill: INK }),
      svg('polygon', { points: '96,18 110,16 104,28', fill: GOLD }),
      svg('polygon', { points: '96,18 104,32 92,30', fill: GOLD, opacity: 0.85 }),
    ],
  },
  cupid: {
    name: 'Cupidon', short: 'Cupidon', color: '#FF7AC6', team: 'le village',
    line: 'La première nuit, tu unis deux joueurs pour la vie. Si l’un meurt, l’autre le suit.',
    art: () => [
      svg('path', { d: 'M22 52C12 40 14 26 28 26c10 0 14 8 14 16 0 6-6 12-20 10Z', fill: PAPER2 }),
      svg('path', { d: 'M98 52c10-12 8-26-6-26-10 0-14 8-14 16 0 6 6 12 20 10Z', fill: PAPER2 }),
      svg('path', { d: 'M60 102C16 72 24 30 46 32c8 1 12 6 14 12 2-6 6-11 14-12 22-2 30 40-14 70Z', fill: PAPER }),
      svg('path', { d: 'M60 44C54 34 40 34 38 46c-1 8 6 14 14 20', fill: 'none', stroke: 'currentColor', 'stroke-width': 3, opacity: 0.35, 'stroke-linecap': 'round' }),
      svg('path', { d: 'M20 104 98 24', stroke: INK, 'stroke-width': 4.5, 'stroke-linecap': 'round' }),
      svg('polygon', { points: '104,18 90,22 100,32', fill: GOLD }),
      svg('polygon', { points: '20,104 14,92 10,100 16,106', fill: GOLD }),
      svg('polygon', { points: '20,104 30,108 24,112 14,110', fill: GOLD }),
      star(98, 74, 0.7), star(18, 18, 0.8, 0.8),
    ],
  },
};

// Médaille ronde : la couleur du rôle, le dessin, un fin cerclage. size en px.
export function medal(role, size = 64) {
  const r = ROLES[role];
  const el = svg('svg', { viewBox: '0 0 120 120', width: size, height: size, 'aria-hidden': 'true', focusable: 'false', class: 'lg-medal' });
  el.style.color = r.color;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.append(
    svg('circle', { cx: 60, cy: 60, r: 58, fill: r.color }),
    svg('circle', { cx: 60, cy: 60, r: 50, fill: 'none', stroke: INK, 'stroke-width': 1.5, opacity: 0.22 }),
    svg('g', { stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, ...r.art()),
    svg('circle', { cx: 60, cy: 60, r: 58, fill: 'none', stroke: INK, 'stroke-width': 4 }),
  );
  return el;
}

// Sapin à deux étages, pointe en haut : un morceau de tracé (x = centre, y = pied, hh = hauteur, w = demi-largeur).
const fir = (x, y, hh, w) => {
  const t = y - hh * 0.48;
  return `M${x - w} ${y}L${x - w * 0.42} ${t}H${x - w * 0.68}L${x} ${y - hh}L${x + w * 0.68} ${t}H${x + w * 0.42}L${x + w} ${y}Z`;
};
const n2 = (v) => Math.round(v * 10) / 10;

// Décor : une lisière de sapins, le village dans la clairière, des yeux dans le noir. Les couleurs viennent du CSS (classes).
// Les grands sapins encadrent les bords ; le milieu reste bas pour laisser voir le village.
export function scene() {
  const root = svg('svg', { viewBox: '0 0 1200 300', preserveAspectRatio: 'xMidYMax slice', class: 'lg-scene', 'aria-hidden': 'true', focusable: 'false' });
  let far = 'M0 300V236H1200V300Z';
  for (let x = -10, i = 0; x <= 1210; x += 26, i++) {
    const hh = 58 + 30 * Math.abs(Math.sin(i * 1.7)) + 18 * Math.abs(Math.sin(i * 0.31));
    far += fir(x, 250, n2(hh), n2(15 + (i % 3) * 3));
  }
  root.append(svg('path', { class: 'far', d: far }));
  const houses = [[520, 1], [574, 0.8], [628, 1.15], [688, 0.9]];
  for (const [x, k] of houses) {
    const w = 40 * k;
    const hh = 26 * k;
    const y = 272;
    root.append(
      svg('path', { class: 'house', d: `M${n2(x - w / 2)} ${y}V${n2(y - hh)}L${x} ${n2(y - hh - 22 * k)}L${n2(x + w / 2)} ${n2(y - hh)}V${y}Z` }),
      svg('rect', { class: 'win', x: n2(x - 5 * k), y: n2(y - hh + 6 * k), width: n2(10 * k), height: n2(9 * k), rx: 1.5 }),
    );
  }
  let near = 'M0 300V276H1200V300Z';
  for (let x = -20, i = 0; x <= 1220; x += 34, i++) {
    const edge = Math.min(1, Math.abs(x - 604) / 420); // 0 au centre (la clairière), 1 sur les bords
    const hh = 16 + 164 * edge ** 1.6 + 22 * Math.abs(Math.sin(i * 2.3));
    near += fir(x, 300, n2(hh), n2(18 + 12 * edge + (i % 2) * 4));
  }
  root.append(svg('path', { class: 'near', d: near }));
  // Des yeux dans le noir : visibles la nuit seulement (CSS).
  [[402, 262, 1], [826, 266, 0.9], [150, 236, 1.1], [1058, 230, 1]].forEach(([x, y, k], i) => {
    root.append(svg('g', { class: `eyes e${i}`, transform: `translate(${x} ${y}) scale(${k})` },
      svg('path', { d: 'M-11 0q4-4.5 8 0q-4 2.6-8 0Z' }),
      svg('path', { d: 'M3 0q4-4.5 8 0q-4 2.6-8 0Z' })));
  });
  return root;
}
