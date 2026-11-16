// Les monuments d'Escales, façon maquette d'architecte. Un monument tient sur une case de 2 × 3 (le bas à y = 0, l'avant vers +z).
// Pour une nouvelle ville : écrire ici une fonction avec le petit kit (box, cyl, cone, dome, bars) et la nommer dans board.js.
// Les couleurs écrites ici ne servent qu'à donner des nuances : bake() les change en tons de blanc, et le tout est fondu en une seule forme.
import * as THREE from './three/three.module.js?v=r186'; // même adresse que scene.js (sinon three serait chargé deux fois)
import { TILES } from './board.js';

const mats = new Map();
function mat(color) {
  if (!mats.has(color)) mats.set(color, new THREE.MeshBasicMaterial({ color }));
  return mats.get(color);
}

function kit(g) {
  const add = (geo, color, x, y, z) => {
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  return {
    box: (w, h, d, color, x = 0, y = 0, z = 0) => add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z),
    cyl: (rt, rb, h, seg, color, x = 0, y = 0, z = 0) => add(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y + h / 2, z),
    cone: (r, h, seg, color, x = 0, y = 0, z = 0) => add(new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z),
    ball: (r, color, x = 0, y = 0, z = 0) => add(new THREE.SphereGeometry(r, 10, 6), color, x, y, z),
    dome: (r, color, x = 0, y = 0, z = 0) => add(new THREE.SphereGeometry(r, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), color, x, y, z),
    torus: (r, t, arc, color, x, y, z, rotY = 0) => {
      const m = add(new THREE.TorusGeometry(r, t, 4, 14, arc), color, x, y, z);
      m.rotation.y = rotY;
      return m;
    },
    // Des barres entre deux points, regroupées en une seule forme : c'est ce qui donne la dentelle de la tour Eiffel.
    bars: (list, color) => {
      const geo = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true);
      const mesh = new THREE.InstancedMesh(geo, mat(color), list.length);
      const up = new THREE.Vector3(0, 1, 0);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      list.forEach(([a, b, r], i) => {
        const A = new THREE.Vector3(...a);
        const B = new THREE.Vector3(...b);
        const dir = B.clone().sub(A);
        const len = dir.length();
        q.setFromUnitVectors(up, dir.normalize());
        m.compose(A.add(B).multiplyScalar(0.5), q, new THREE.Vector3(r, len, r));
        mesh.setMatrixAt(i, m);
      });
      g.add(mesh);
      return mesh;
    },
  };
}

// Une tour en treillis : quatre pieds courbes, des croisillons, des plateformes. Tour Eiffel et tour de Tokyo.
function latticeTower(g, { h = 5.4, base = 1, iron, deck, spire }) {
  const k = kit(g);
  const hw = (y) => base * Math.exp(-y / (h * 0.24)) + 0.045;
  const STEPS = 22;
  const levels = Array.from({ length: STEPS + 1 }, (_, i) => (i / STEPS) * h * 0.86);
  const legs = [];
  const braces = [];
  const corner = (sx, sz, y, inset = 1) => [sx * hw(y) * inset, y, sz * hw(y) * inset];
  for (let i = 0; i < STEPS; i += 1) {
    const [y0, y1] = [levels[i], levels[i + 1]];
    const r = Math.max(0.018, 0.075 - y0 * 0.012);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) legs.push([corner(sx, sz, y0), corner(sx, sz, y1), r]);
    const thin = Math.max(0.01, 0.02 - y0 * 0.002);
    // Croisillons en X sur les quatre faces
    const faces = [[[1, 1], [-1, 1]], [[1, -1], [-1, -1]], [[1, 1], [1, -1]], [[-1, 1], [-1, -1]]];
    if (y0 > h * 0.19 || i % 2) {
      for (const [a, b] of faces) {
        braces.push([corner(a[0], a[1], y0), corner(b[0], b[1], y1), thin]);
        braces.push([corner(b[0], b[1], y0), corner(a[0], a[1], y1), thin]);
      }
    }
    // Sous la première plateforme, chaque pied a aussi ses propres croisillons, côté intérieur.
    if (y1 < h * 0.2) {
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        braces.push([corner(sx, sz, y0, 0.62), corner(sx, sz, y1, 1), thin]);
        braces.push([corner(sx, sz, y0, 1), corner(sx, sz, y1, 0.62), thin]);
        legs.push([corner(sx, sz, y0, 0.62), corner(sx, sz, y1, 0.62), r * 0.7]);
      }
    }
  }
  k.bars(legs, iron);
  k.bars(braces, iron);
  // Plateformes
  const deck1 = h * 0.2;
  const deck2 = h * 0.38;
  const deck3 = h * 0.8;
  k.box(hw(deck1) * 2.4, 0.09, hw(deck1) * 2.4, deck, 0, deck1, 0);
  k.box(hw(deck2) * 2.5, 0.07, hw(deck2) * 2.5, deck, 0, deck2, 0);
  k.box(hw(deck3) * 3.4, 0.08, hw(deck3) * 3.4, deck, 0, deck3, 0);
  // Les grandes arches sous la première plateforme
  for (const rot of [0, Math.PI / 2]) {
    for (const s of [1, -1]) {
      const r = hw(deck1) * 0.92;
      const x = rot ? s * hw(deck1 * 0.5) : 0;
      const z = rot ? 0 : s * hw(deck1 * 0.5);
      k.torus(r, 0.03, Math.PI, iron, x, deck1 - r - 0.03, z, rot);
    }
  }
  // Le sommet
  k.cyl(0.03, 0.09, h * 0.1, 6, spire, 0, h * 0.82, 0);
  k.cyl(0.008, 0.02, h * 0.1, 5, spire, 0, h * 0.92, 0);
}

function house(k, x, z, w, h, d, wall, roof) {
  k.box(w, h, d, wall, x, 0, z);
  const r = k.cone(Math.hypot(w, d) * 0.56, h * 0.5, 4, roof, x, h, z);
  r.rotation.y = Math.PI / 4;
}

const flatHouse = (k, x, z, w, h, d, wall, door = '#2B3A67') => {
  k.box(w, h, d, wall, x, 0, z);
  k.box(w * 0.26, h * 0.42, 0.02, door, x, 0, z + d / 2);
};

function pagodaTiers(k, tiers, wall, roof, startW = 1.2, tierH = 0.42) {
  let y = 0;
  for (let i = 0; i < tiers; i += 1) {
    const w = startW * (1 - i * 0.16);
    k.box(w * 0.72, tierH, w * 0.72, wall, 0, y, 0);
    y += tierH;
    const r = k.cyl(w * 0.34, w * 0.92, 0.2, 4, roof, 0, y, 0);
    r.rotation.y = Math.PI / 4;
    y += 0.2;
  }
  return y;
}

const stepped = (k, list, color) => list.forEach(([w, y, h, d = w, c = color]) => k.box(w, h, d, c, 0, y, 0));

export const MONUMENTS = {
  // ——— France ———
  eiffel: (g) => latticeTower(g, { iron: '#6E4A2E', deck: '#D9A441', spire: '#6E4A2E' }),
  basilique: (g) => { // Notre-Dame de la Garde, sur sa colline
    const k = kit(g);
    k.cone(1, 0.7, 7, '#7FA65A', 0, 0, 0);
    k.box(0.9, 0.5, 0.5, '#F2EEE3', 0, 0.55, 0);
    k.cyl(0.13, 0.17, 1.1, 8, '#F2EEE3', 0, 0.8, 0);
    k.cone(0.08, 0.2, 6, '#D9A441', 0, 1.9, 0);
    k.ball(0.09, '#D9A441', 0, 2.15, 0);
  },
  arcades: (g) => { // La place de la Bourse et son miroir d'eau
    const k = kit(g);
    k.box(1.7, 0.03, 0.8, '#7FD5E8', 0, 0, 0.45);
    k.box(1.7, 0.75, 0.55, '#EADBB8', 0, 0, -0.35);
    for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) k.box(0.15, 0.38, 0.02, '#3F4C78', x, 0.06, -0.07);
    k.box(1.8, 0.12, 0.65, '#4D5B86', 0, 0.75, -0.35);
  },
  basilique2: (g) => { // Fourvière et ses quatre tours
    const k = kit(g);
    k.box(1.15, 0.85, 0.75, '#F3EBDA', 0, 0, 0);
    for (const [x, z] of [[-0.55, -0.34], [0.55, -0.34], [-0.55, 0.34], [0.55, 0.34]]) {
      k.cyl(0.12, 0.14, 1.25, 8, '#F3EBDA', x, 0, z);
      k.cone(0.16, 0.22, 8, '#B9A67E', x, 1.25, z);
    }
    k.cone(0.45, 0.35, 4, '#B9A67E', 0, 0.85, 0).rotation.y = Math.PI / 4;
  },
  // ——— Italie ———
  colisee: (g) => {
    const k = kit(g);
    const R = 0.92;
    const stone = '#E5CFA0';
    const N = 22;
    for (let i = 0; i < N; i += 1) {
      const a = (i / N) * Math.PI * 2;
      const broken = i > 13 && i < 19; // le côté effondré
      for (let tier = 0; tier < (broken ? 2 : 3); tier += 1) {
        const m = k.box(0.14, 0.34, 0.16, stone, Math.cos(a) * R, tier * 0.38 + 0.04, Math.sin(a) * R);
        m.rotation.y = -a;
      }
    }
    for (const y of [0.38, 0.76]) k.torus(R, 0.045, Math.PI * 2, stone, 0, y, 0).rotation.x = Math.PI / 2;
    k.torus(R, 0.05, Math.PI * 1.45, stone, 0, 1.16, 0).rotation.x = Math.PI / 2;
    k.cyl(R * 0.72, R * 0.76, 0.2, 18, '#C89B62', 0, 0, 0);
    k.cyl(R * 0.45, R * 0.45, 0.02, 16, '#E9D59E', 0, 0.2, 0);
  },
  duomo: (g) => {
    const k = kit(g);
    k.box(0.75, 0.55, 1.4, '#F2EDE1', 0, 0, 0.1);
    k.cyl(0.42, 0.45, 0.45, 8, '#F2EDE1', 0, 0.55, -0.25);
    k.dome(0.42, '#C8553D', 0, 1, -0.25).scale.y = 1.3;
    k.cyl(0.05, 0.08, 0.2, 8, '#F2EDE1', 0, 1.52, -0.25);
    k.box(0.22, 1.15, 0.22, '#F2EDE1', 0.55, 0, 0.5);
  },
  gondole: (g) => {
    const k = kit(g);
    k.box(1.8, 0.03, 2.2, '#2FA8C8', 0, 0, 0);
    k.box(0.6, 0.85, 0.55, '#E98A5B', -0.55, 0, -0.75);
    k.box(0.6, 1.1, 0.55, '#F2C879', 0.25, 0, -0.75);
    k.box(0.14, 0.62, 0.14, '#EFEFEA', 0.7, 0, -0.75);
    k.box(0.2, 0.05, 1.05, '#16181F', 0, 0.05, 0.4);
    k.cone(0.06, 0.26, 4, '#16181F', 0, 0.1, 0.98).rotation.x = 0.7;
    k.cone(0.05, 0.2, 4, '#16181F', 0, 0.08, -0.15).rotation.x = -0.7;
    k.cyl(0.035, 0.05, 0.42, 6, '#D93636', 0, 0.1, 0.6);
    k.ball(0.06, '#F2D2B0', 0, 0.56, 0.6);
  },
  volcan: (g) => { // Le Vésuve au-dessus de la baie de Naples
    const k = kit(g);
    k.cyl(0.26, 1.02, 1.25, 9, '#6A5B57', 0, 0, -0.2);
    k.cyl(0.23, 0.26, 0.06, 9, '#FF7A2E', 0, 1.25, -0.2);
    k.ball(0.17, '#E9E9EC', 0.05, 1.6, -0.2);
    k.ball(0.13, '#E9E9EC', -0.1, 1.85, -0.15);
    k.ball(0.09, '#E9E9EC', 0.05, 2.05, -0.2);
    flatHouse(k, 0.55, 0.75, 0.32, 0.3, 0.3, '#F2C879');
    flatHouse(k, -0.45, 0.8, 0.35, 0.4, 0.32, '#E98A5B');
  },
  // ——— États-Unis ———
  empire: (g) => {
    const k = kit(g);
    const stone = '#D7DCE8';
    stepped(k, [[1.25, 0, 0.75, 1.1], [0.95, 0.75, 1.1, 0.85], [0.72, 1.85, 1.15, 0.64], [0.48, 3, 0.9, 0.44], [0.28, 3.9, 0.4, 0.26]], stone);
    k.cyl(0.05, 0.14, 0.5, 8, '#F2C14E', 0, 4.3, 0);
    k.cyl(0.012, 0.03, 0.45, 5, '#F2C14E', 0, 4.8, 0);
    // Les lignes de fenêtres montent sur toute la façade.
    for (const x of [-0.27, -0.09, 0.09, 0.27]) k.box(0.05, 2.6, 0.02, '#4B5B8A', x, 0.9, 0.33);
  },
  goldenGate: (g) => {
    const k = kit(g);
    const red = '#D8432F';
    k.box(1.9, 0.03, 2.4, '#2FA8C8', 0, 0, 0);
    for (const z of [-0.8, 0.8]) {
      for (const x of [-0.26, 0.26]) k.box(0.11, 2.3, 0.14, red, x, 0, z);
      for (const y of [0.9, 1.4, 1.85, 2.25]) k.box(0.58, 0.1, 0.12, red, 0, y, z);
    }
    k.box(0.5, 0.06, 2.8, red, 0, 0.65, 0);
    const cable = [];
    const hang = [];
    for (const x of [-0.26, 0.26]) {
      const y = (z) => 0.95 + (z * z) * 2;
      for (let z = -1.4; z < 1.4; z += 0.2) {
        const c = (v) => Math.min(y(Math.abs(v) <= 0.8 ? v : 0.8), 2.3);
        const yy = (v) => (Math.abs(v) <= 0.8 ? 0.95 + v * v * 2.1 : 2.3 - (Math.abs(v) - 0.8) * 2.1);
        cable.push([[x, yy(z), z], [x, yy(z + 0.2), z + 0.2], 0.018]);
        hang.push([[x, yy(z), z], [x, 0.68, z], 0.006]);
        void c;
      }
    }
    k.bars(cable, red);
    k.bars(hang, red);
  },
  gratteCiel2: (g) => { // Chicago : la tour en faisceaux, et ses voisines
    const k = kit(g);
    stepped(k, [[0.95, 0, 1.9, 0.9, '#2C3550'], [0.72, 1.9, 1, 0.72, '#2C3550'], [0.46, 2.9, 0.75, 0.46, '#2C3550']], '#2C3550');
    k.cyl(0.015, 0.03, 0.75, 5, '#EDEFF5', 0.13, 3.65, 0);
    k.cyl(0.015, 0.03, 0.75, 5, '#EDEFF5', -0.13, 3.65, 0);
    k.box(0.36, 1.25, 0.36, '#8FA4C6', 0.75, 0, 0.55);
    k.box(0.32, 0.8, 0.32, '#C5D0E4', -0.72, 0, 0.6);
  },
  bateauVapeur: (g) => {
    const k = kit(g);
    k.box(1.8, 0.03, 2.3, '#3E9BB2', 0, 0, 0);
    k.box(0.72, 0.2, 1.6, '#F5F2E8', 0, 0.03, 0);
    k.box(0.62, 0.26, 1.25, '#E4483E', 0, 0.23, 0);
    k.box(0.5, 0.25, 0.8, '#F5F2E8', 0, 0.49, -0.1);
    for (const x of [-0.14, 0.14]) k.cyl(0.05, 0.05, 0.75, 8, '#1F2130', x, 0.72, -0.3);
    k.cyl(0.24, 0.24, 0.5, 12, '#E4483E', 0, 0.08, -0.82).rotation.z = Math.PI / 2;
  },
  // ——— Japon ———
  tourTokyo: (g) => latticeTower(g, { h: 5.1, iron: '#E5462C', deck: '#F5F3EE', spire: '#F5F3EE', base: 0.95 }),
  torii: (g) => {
    const k = kit(g);
    const red = '#E2442F';
    for (const x of [-0.62, 0.62]) {
      k.cyl(0.075, 0.095, 1.5, 10, red, x, 0, 0);
      k.cyl(0.11, 0.11, 0.1, 10, '#1E1E26', x, 0, 0);
    }
    k.box(1.55, 0.1, 0.14, red, 0, 1.12, 0);
    k.box(1.85, 0.13, 0.2, red, 0, 1.45, 0);
    k.box(2, 0.07, 0.26, '#1E1E26', 0, 1.58, 0);
    k.box(0.09, 0.32, 0.1, red, 0, 1.15, 0);
    // L'allée de pierre et un cerisier
    for (const z of [0.55, 0.9, 1.2]) k.box(0.4, 0.03, 0.2, '#C9C6BC', 0, 0, z);
    k.cyl(0.04, 0.06, 0.45, 6, '#5B3E31', 0.72, 0, -0.75);
    k.ball(0.27, '#FFB6D3', 0.72, 0.62, -0.75);
  },
  pagode: (g) => {
    const k = kit(g);
    pagodaTiers(k, 5, '#B73E2F', '#3A3D4E', 1.2, 0.34);
    k.cyl(0.015, 0.03, 0.4, 5, '#D9A441', 0, 2.7, 0);
  },
  chateau: (g) => { // Le château d'Osaka, sur son socle de pierre
    const k = kit(g);
    k.cyl(0.62, 0.9, 0.42, 4, '#8E8D8A', 0, 0, 0).rotation.y = Math.PI / 4;
    const top = pagodaTiers({ ...k, box: (w, h, d, c, x, y, z) => k.box(w, h, d, c, x, y + 0.42, z), cyl: (a, b, h, s, c, x, y, z) => k.cyl(a, b, h, s, c, x, y + 0.42, z) }, 4, '#F7F5EE', '#2F7E78', 1.15, 0.34);
    k.box(0.28, 0.1, 0.06, '#D9A441', 0, top + 0.42, 0);
  },
  // ——— Mexique ———
  pyramide: (g) => {
    const k = kit(g);
    const s = '#C9A26D';
    for (let i = 0; i < 6; i += 1) k.box(1.75 - i * 0.26, 0.24, 1.75 - i * 0.26, i % 2 ? '#B58D5A' : s, 0, i * 0.24, 0);
    k.box(0.32, 0.26, 0.3, '#8C6A41', 0, 1.44, 0);
    for (let i = 0; i < 6; i += 1) k.box(0.36, 0.24, 0.1, '#E0C08D', 0, i * 0.24, 0.9 - i * 0.13);
  },
  cathedrale: (g) => { // Guadalajara et ses deux flèches jaunes
    const k = kit(g);
    k.box(1.05, 0.72, 0.85, '#F0E6D2', 0, 0, 0);
    for (const x of [-0.42, 0.42]) {
      k.box(0.26, 1.1, 0.26, '#F0E6D2', x, 0, 0.32);
      k.cone(0.19, 0.72, 8, '#F3C13A', x, 1.1, 0.32);
    }
    k.dome(0.28, '#F3C13A', 0, 0.72, -0.1);
    k.box(0.24, 0.42, 0.02, '#4D3A2A', 0, 0, 0.43);
  },
  maisonsColorees: (g) => {
    const k = kit(g);
    [[-0.5, -0.6, 0.55, '#FF6F91'], [0.1, -0.7, 0.8, '#FFC145'], [0.62, -0.5, 0.5, '#4FC1E9'], [-0.45, 0.2, 0.45, '#7ED957'], [0.35, 0.3, 0.55, '#B983FF']].forEach(([x, z, h, c]) => flatHouse(k, x, z, 0.52, h, 0.5, c));
  },
  maisonsColorees2: (g) => { // Guanajuato : les maisons montent à flanc de colline
    const k = kit(g);
    k.cone(1.1, 1, 6, '#8AA66B', 0, 0, -0.35);
    [[-0.55, 0.55, 0, '#FF8FA3'], [0, 0.65, 0, '#FFD166'], [0.55, 0.55, 0, '#6FD6FF'], [-0.3, 0.05, 0.28, '#C39BFF'], [0.3, 0.05, 0.3, '#FF9F5A'], [0, -0.42, 0.55, '#7EE0A4']].forEach(([x, z, y, c]) => {
      k.box(0.42, 0.42, 0.4, c, x, y, z);
    });
  },
  // ——— Maroc ———
  minaret: (g) => { // La Koutoubia
    const k = kit(g);
    k.box(0.62, 2.35, 0.62, '#D2794D', 0, 0, -0.3);
    for (const y of [0.55, 1.2, 1.85]) k.box(0.2, 0.32, 0.02, '#7D3F27', 0, y, 0.015);
    k.box(0.72, 0.1, 0.72, '#E6D4B8', 0, 2.35, -0.3);
    k.box(0.32, 0.5, 0.32, '#D2794D', 0, 2.45, -0.3);
    k.dome(0.16, '#2C9C8A', 0, 2.95, -0.3);
    k.cyl(0.012, 0.012, 0.25, 5, '#D9A441', 0, 3.08, -0.3);
    for (const x of [-0.75, 0.75]) {
      k.cyl(0.03, 0.05, 0.6, 6, '#7D5A3C', x, 0, 0.55);
      k.cone(0.26, 0.3, 7, '#3E9B59', x, 0.55, 0.55);
    }
  },
  riad: (g) => { // Fès : une porte bleue en fer à cheval
    const k = kit(g);
    k.box(1.65, 1.1, 0.42, '#2B6CB5', 0, 0, -0.2);
    k.box(0.66, 0.78, 0.46, '#1B2A45', 0, 0, -0.2);
    k.torus(0.33, 0.06, Math.PI, '#F0D58C', 0, 0.78, 0.04);
    for (const x of [-0.5, 0, 0.5]) k.box(0.3, 0.16, 0.48, '#2F9C74', x, 1.1, -0.2);
    flatHouse(k, -0.6, 0.65, 0.5, 0.4, 0.48, '#D88F5F');
    flatHouse(k, 0.6, 0.65, 0.5, 0.5, 0.48, '#E5AE78');
  },
  maisonsBleues: (g) => {
    const k = kit(g);
    [[-0.55, -0.6, 0.8, '#3F88D8'], [0.1, -0.68, 1.05, '#6BB3F0'], [0.65, -0.5, 0.7, '#2F6FBE'], [-0.4, 0.15, 0.5, '#8BC8F6'], [0.42, 0.25, 0.6, '#4B9BE3']].forEach(([x, z, h, c]) => flatHouse(k, x, z, 0.52, h, 0.5, c, '#F3F7FB'));
    for (const [x, z] of [[-0.8, 0.8], [0.85, 0.85]]) k.cyl(0.09, 0.07, 0.18, 8, '#D8622E', x, 0, z);
  },
  mosquee: (g) => { // Hassan II, face à l'océan
    const k = kit(g);
    k.box(1.8, 0.03, 0.75, '#2FA8C8', 0, 0, 0.75);
    k.box(1.2, 0.5, 0.85, '#EDE4D3', -0.25, 0, -0.45);
    k.box(0.32, 2.55, 0.32, '#2F9C74', 0.6, 0, -0.4);
    k.box(0.38, 0.08, 0.38, '#F0D58C', 0.6, 2.55, -0.4);
    k.box(0.18, 0.35, 0.18, '#2F9C74', 0.6, 2.63, -0.4);
    k.dome(0.09, '#F0D58C', 0.6, 2.98, -0.4);
    k.cone(0.6, 0.28, 4, '#2F9C74', -0.25, 0.5, -0.45).rotation.y = Math.PI / 4;
  },
  // ——— Vietnam ———
  lanternes: (g) => {
    const k = kit(g);
    k.box(1.1, 0.6, 0.65, '#F2C14E', 0, 0, -0.55);
    const r = k.cyl(0.3, 0.82, 0.3, 4, '#A95F35', 0, 0.6, -0.55);
    r.rotation.y = Math.PI / 4;
    r.scale.z = 0.8;
    k.box(1.8, 0.03, 0.9, '#2FA8C8', 0, 0, 0.6);
    k.bars([[[-0.85, 1.05, 0.15], [0.85, 1.05, 0.15], 0.012]], '#2A2340');
    for (const x of [-0.85, 0.85]) k.cyl(0.02, 0.02, 1.05, 5, '#2A2340', x, 0, 0.15);
    [['#FF5A4F', -0.55], ['#FFC145', -0.2], ['#FF5C9E', 0.2], ['#FFC145', 0.55]].forEach(([c, x]) => {
      k.ball(0.11, c, x, 0.88, 0.15).scale.y = 1.25;
    });
  },
  porte: (g) => { // La porte du Midi de la cité impériale
    const k = kit(g);
    k.box(1.75, 0.65, 0.65, '#8D7F73', 0, 0, -0.1);
    k.box(0.42, 0.45, 0.68, '#2A2230', 0, 0, -0.1);
    k.box(1.3, 0.3, 0.5, '#C73E3A', 0, 0.65, -0.1);
    const r = k.cyl(0.42, 0.88, 0.25, 4, '#E8B23A', 0, 0.95, -0.1);
    r.rotation.y = Math.PI / 4;
    k.box(0.7, 0.15, 0.32, '#C73E3A', 0, 1.2, -0.1);
    const r2 = k.cyl(0.2, 0.46, 0.18, 4, '#E8B23A', 0, 1.35, -0.1);
    r2.rotation.y = Math.PI / 4;
  },
  pagodeUnPilier: (g) => { // Hanoï : la pagode au pilier unique, sur son étang
    const k = kit(g);
    k.cyl(0.95, 1, 0.04, 16, '#2FA8C8', 0, 0, 0);
    k.cyl(0.11, 0.13, 0.65, 10, '#8D7F73', 0, 0.04, 0);
    k.box(0.72, 0.05, 0.72, '#6D3F2D', 0, 0.69, 0);
    k.box(0.5, 0.42, 0.5, '#B7492F', 0, 0.74, 0);
    const r = k.cyl(0.14, 0.62, 0.3, 4, '#3A3D4E', 0, 1.16, 0);
    r.rotation.y = Math.PI / 4;
    k.ball(0.05, '#D9A441', 0, 1.5, 0);
    k.ball(0.13, '#FF7FB0', -0.55, 0.08, 0.45).scale.y = 0.4;
    k.ball(0.12, '#FF7FB0', 0.6, 0.08, -0.35).scale.y = 0.4;
  },
  gratteCiel: (g) => { // La tour en forme de lotus, et son héliport
    const k = kit(g);
    k.cyl(0.26, 0.4, 2.7, 10, '#AFC6DD', 0, 0, -0.1);
    k.cyl(0.2, 0.26, 0.5, 10, '#E8EEF5', 0, 2.7, -0.1);
    k.cyl(0.42, 0.28, 0.07, 12, '#E4483E', 0.05, 2.45, -0.1);
    k.cyl(0.02, 0.04, 0.45, 5, '#E8EEF5', 0, 3.2, -0.1);
    k.box(0.4, 0.9, 0.4, '#7E9BB9', 0.72, 0, 0.55);
    k.box(0.4, 0.6, 0.4, '#FFB84D', -0.72, 0, 0.55);
  },
  // ——— Portugal ———
  phare: (g) => {
    const k = kit(g);
    k.cone(0.92, 0.5, 7, '#E1C27E', 0, 0, 0);
    for (let i = 0; i < 5; i += 1) k.cyl(0.25 - i * 0.022, 0.27 - i * 0.022, 0.36, 12, i % 2 ? '#F5F5F0' : '#D93636', 0, 0.42 + i * 0.36, 0);
    k.cyl(0.21, 0.19, 0.25, 12, '#FFE27A', 0, 2.22, 0);
    k.cone(0.22, 0.2, 12, '#D93636', 0, 2.47, 0);
  },
  tourHorloge: (g) => { // La tour de l'université de Coimbra
    const k = kit(g);
    k.box(1.6, 0.55, 0.85, '#F2E7CF', 0, 0, -0.1);
    k.box(0.5, 2, 0.5, '#F2E7CF', 0, 0, -0.1);
    k.cyl(0.14, 0.14, 0.02, 14, '#26324F', 0, 1.55, 0.16).rotation.x = Math.PI / 2;
    k.cone(0.34, 0.42, 4, '#C8553D', 0, 2, -0.1).rotation.y = Math.PI / 4;
  },
  pontArche: (g) => { // Le pont Dom-Luís, à Porto
    const k = kit(g);
    k.box(1.9, 0.03, 2.4, '#2C8FB0', 0, 0, 0);
    const iron = '#5A5E6B';
    k.torus(0.95, 0.055, Math.PI, iron, 0, 0.03, -0.1).scale.y = 1.15;
    k.box(2, 0.07, 0.34, iron, 0, 1.15, -0.1);
    const b = [];
    for (const x of [-0.75, -0.4, 0, 0.4, 0.75]) b.push([[x, 1.15, -0.1], [x, Math.max(0.06, Math.sqrt(Math.max(0, 0.9 - x * x)) * 1.15), -0.1], 0.016]);
    k.bars(b, iron);
    flatHouse(k, -0.65, 0.75, 0.38, 0.5, 0.36, '#F2A65A');
    flatHouse(k, 0.65, 0.75, 0.38, 0.62, 0.36, '#EF6F6C');
  },
  tram: (g) => { // Le tram 28
    const k = kit(g);
    k.box(1.8, 0.02, 0.5, '#73777F', 0, 0, 0.25);
    k.box(1.35, 0.5, 0.52, '#FFD23F', 0, 0.12, 0.25);
    k.box(1.35, 0.12, 0.52, '#F7F4EA', 0, 0.02, 0.25);
    for (const x of [-0.45, -0.15, 0.15, 0.45]) k.box(0.22, 0.2, 0.54, '#2C3550', x, 0.34, 0.25);
    k.box(1.4, 0.05, 0.5, '#EFEDE3', 0, 0.62, 0.25);
    k.bars([[[0.1, 0.67, 0.25], [0.5, 1.1, 0.25], 0.012]], '#2C3550');
    flatHouse(k, -0.55, -0.65, 0.55, 0.9, 0.55, '#6FB5E8');
    house(k, 0.3, -0.75, 0.6, 0.75, 0.5, '#F6F1E5', '#C8553D');
  },
};

// Les monuments sculptés dans Blender (assets/monuments/*.glb) remplacent ceux écrits en code. Chaque fichier ne contient qu'une forme
// et des couleurs de sommets : ce petit lecteur suffit, sans dépendance. Si un fichier manque, le monument en code reste.
const fileOf = (name) => (name === 'goldenGate' ? 'golden-gate' : name);
const sculpted = new Map();

function parseGlb(buffer) {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Ce n’est pas un fichier GLB.');
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
  const binStart = 20 + jsonLength + 8;
  const prim = json.meshes[0].primitives[0];
  const read = (index) => {
    const acc = json.accessors[index];
    const bv = json.bufferViews[acc.bufferView];
    const offset = binStart + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
    const Kind = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[acc.componentType];
    return { data: new Kind(buffer.slice(offset, offset + acc.count * size * Kind.BYTES_PER_ELEMENT)), size, count: acc.count, max: acc.componentType === 5126 ? 1 : 2 ** (8 * Kind.BYTES_PER_ELEMENT) - 1 };
  };
  const position = read(prim.attributes.POSITION);
  const color = read(prim.attributes.COLOR_0);
  const indices = read(prim.indices);
  const rgb = new Float32Array(color.count * 3);
  for (let i = 0; i < color.count; i += 1) {
    for (let k = 0; k < 3; k += 1) rgb[i * 3 + k] = color.data[i * color.size + k] / color.max;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position.data, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  geo.setIndex(new THREE.BufferAttribute(indices.data, 1));
  return geo;
}

export async function loadSculpted(urlOf) {
  const names = [...TILES.filter((t) => t.model).map((t) => t.model), ...new Set(TILES.filter((t) => t.type !== 'city').map((t) => `special-${t.type}`))];
  await Promise.all(names.map(async (name) => {
    try {
      const res = await fetch(urlOf(`monuments/${fileOf(name)}.glb`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      sculpted.set(name, parseGlb(await res.arrayBuffer()));
    } catch (err) {
      console.warn(`Monument ${name} : on garde la version en code (${err.message}).`);
    }
  }));
}

export function buildMonument(name) {
  const g = new THREE.Group();
  if (sculpted.has(name)) g.add(new THREE.Mesh(sculpted.get(name), mat('#FFFFFF')));
  else (MONUMENTS[name] ?? MONUMENTS.maisonsColorees)(g);
  return g;
}

// Les personnages : 10 petits voyageurs, un par place. Même corps pour tous, en grosse tête ; la tenue prend la couleur du joueur.
// Hauteur d'environ 1 avec le chapeau, les pieds à y = 0, le regard vers +z.
const SKIN = ['#F2C9A5', '#8D5A3C', '#E8B48E', '#5F3B28', '#F6D7BC', '#C68B5E', '#7A4A30', '#EFC09A', '#FAD9C1', '#D9A77E'];
const HAIR = { noir: '#23202A', brun: '#4F3325', blond: '#E5B84C', roux: '#C4562B', gris: '#C3C7CF' };
const WHITE = '#FFFFFF';
const NAVY = '#27304D';
const SAND = '#D9BF8C';
const SHOE = '#23202A';

function person(k, { skin, hair, brow = null, top, bottom = NAVY, skirt = false, short = false }) {
  for (const x of [-0.078, 0.078]) {
    if (!skirt) k.cyl(0.056, 0.05, 0.24, 8, short ? skin : bottom, x, 0.03, 0);
    if (short) k.cyl(0.066, 0.064, 0.11, 8, bottom, x, 0.17, 0);
    if (skirt) k.cyl(0.04, 0.04, 0.2, 8, skin, x, 0.03, 0);
    k.box(0.1, 0.05, 0.17, SHOE, x, 0, 0.025);
  }
  if (skirt) k.cyl(0.11, 0.19, 0.2, 12, bottom, 0, 0.17, 0);
  k.cyl(0.125, 0.145, 0.27, 12, top, 0, 0.26, 0);
  const shoulders = k.ball(0.135, top, 0, 0.53, 0);
  shoulders.scale.y = 0.55;
  for (const s of [-1, 1]) {
    const arm = k.cyl(0.042, 0.036, 0.25, 8, top, 0, 0, 0);
    arm.position.set(s * 0.17, 0.42, 0);
    arm.rotation.z = s * 0.14;
    k.ball(0.042, skin, s * 0.19, 0.285, 0);
  }
  k.ball(0.205, skin, 0, 0.74, 0);
  // Le visage : de grands yeux, des sourcils et un sourire, lisibles même à petite taille.
  for (const s of [-1, 1]) {
    k.ball(0.044, '#FFFFFF', s * 0.076, 0.765, 0.158);
    k.ball(0.027, '#16151C', s * 0.076, 0.765, 0.192);
    k.box(0.07, 0.014, 0.012, hair ?? brow ?? '#3A2A20', s * 0.076, 0.83, 0.18);
  }
  const smile = k.ball(0.05, '#8E2F2F', 0, 0.672, 0.176);
  smile.scale.set(1, 0.32, 0.45);
  if (hair) {
    const h = k.dome(0.226, hair, 0, 0.75, -0.016);
    h.scale.y = 0.92;
  }
}

export const CAST = [
  (k, c, L = {}) => { // La pilote
    person(k, { skin: L.skin ?? SKIN[0], hair: L.hair ?? HAIR.brun, top: c });
    k.cyl(0.17, 0.18, 0.08, 14, WHITE, 0, 0.87, 0);
    k.cyl(0.2, 0.17, 0.035, 14, NAVY, 0, 0.95, 0);
    k.box(0.22, 0.02, 0.1, NAVY, 0, 0.86, 0.16);
    k.box(0.05, 0.16, 0.012, NAVY, 0, 0.34, 0.14);
  },
  (k, c, L = {}) => { // Le routard, et son gros sac
    person(k, { skin: L.skin ?? SKIN[1], hair: L.hair ?? HAIR.noir, top: c, bottom: SAND, short: true });
    k.box(0.27, 0.42, 0.19, '#5D7A52', 0, 0.26, -0.22);
    k.box(0.22, 0.14, 0.04, '#46603E', 0, 0.3, -0.33);
    const roll = k.cyl(0.075, 0.075, 0.32, 10, '#C4562B', 0, 0, 0);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, 0.74, -0.22);
    k.cyl(0.12, 0.2, 0.09, 12, c, 0, 0.87, 0);
    k.cyl(0.105, 0.12, 0.06, 12, c, 0, 0.95, 0);
  },
  (k, c, L = {}) => { // Le touriste : chapeau de paille et appareil photo
    person(k, { skin: L.skin ?? SKIN[2], hair: null, brow: L.hair, top: c, bottom: SAND, short: true });
    k.cyl(0.23, 0.25, 0.022, 18, '#EBCF7E', 0, 0.9, 0);
    k.cyl(0.14, 0.16, 0.1, 14, '#EBCF7E', 0, 0.88, 0);
    k.cyl(0.165, 0.165, 0.02, 14, NAVY, 0, 0.88, 0);
    k.box(0.15, 0.1, 0.07, '#23202A', 0, 0.33, 0.14);
    const lens = k.cyl(0.033, 0.033, 0.04, 10, '#6C7690', 0, 0, 0);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.38, 0.195);
    for (const s of [-1, 1]) k.box(0.1, 0.05, 0.02, '#16151C', s * 0.062, 0.725, 0.165);
  },
  (k, c, L = {}) => { // Le marin : marinière, bonnet et barbe
    person(k, { skin: L.skin ?? SKIN[3], hair: null, brow: L.hair, top: WHITE, bottom: NAVY });
    for (const y of [0.3, 0.38, 0.46]) k.cyl(0.14, 0.142, 0.035, 12, c, 0, y, 0);
    k.dome(0.183, c, 0, 0.77, 0);
    k.cyl(0.187, 0.187, 0.055, 14, WHITE, 0, 0.75, 0);
    const beard = k.ball(0.125, L.hair ?? HAIR.gris, 0, 0.64, 0.075);
    beard.scale.set(1, 0.72, 0.8);
  },
  (k, c, L = {}) => { // L'hôtesse : chignon, foulard, jupe et valise à roulettes
    person(k, { skin: L.skin ?? SKIN[4], hair: L.hair ?? HAIR.roux, top: c, bottom: c, skirt: true });
    k.ball(0.07, L.hair ?? HAIR.roux, 0, 0.92, -0.05);
    k.box(0.14, 0.05, 0.1, WHITE, 0, 0.53, 0.1);
    k.box(0.2, 0.32, 0.12, NAVY, 0.34, 0.03, 0.02);
    k.bars([[[0.3, 0.35, 0.02], [0.27, 0.5, 0.02], 0.009], [[0.38, 0.35, 0.02], [0.35, 0.5, 0.02], 0.009]], '#9AA5B8');
    k.box(0.1, 0.018, 0.02, '#9AA5B8', 0.31, 0.5, 0.02);
  },
  (k, c, L = {}) => { // La cycliste : casque et short
    person(k, { skin: L.skin ?? SKIN[5], hair: L.hair ?? HAIR.noir, top: c, bottom: '#23202A', short: true });
    const helmet = k.dome(0.2, WHITE, 0, 0.79, -0.01);
    helmet.scale.set(1, 0.85, 1.12);
    for (const x of [-0.07, 0, 0.07]) k.box(0.03, 0.03, 0.27, c, x, 0.935, -0.01);
    k.box(0.15, 0.02, 0.04, '#16151C', 0, 0.8, 0.17);
    k.ball(0.04, L.hair ?? HAIR.noir, 0, 0.72, -0.19);
  },
  (k, c, L = {}) => { // L'exploratrice : chapeau à large bord, tresse et sacoche
    person(k, { skin: L.skin ?? SKIN[6], hair: L.hair ?? HAIR.noir, top: c, bottom: '#7A6240' });
    k.cyl(0.22, 0.235, 0.025, 16, '#8A6A3F', 0, 0.9, 0);
    k.cyl(0.13, 0.165, 0.12, 12, '#8A6A3F', 0, 0.89, 0);
    k.cyl(0.167, 0.167, 0.025, 12, '#4F3325', 0, 0.89, 0);
    k.cyl(0.035, 0.022, 0.26, 7, L.hair ?? HAIR.noir, 0.12, 0.45, -0.13);
    k.box(0.15, 0.13, 0.06, '#4F3325', -0.17, 0.2, 0.06);
    k.bars([[[-0.17, 0.33, 0.06], [0.1, 0.56, 0.09], 0.012]], '#4F3325');
  },
  (k, c, L = {}) => { // Le surfeur et sa planche
    person(k, { skin: L.skin ?? SKIN[7], hair: L.hair ?? HAIR.blond, top: c, bottom: '#19A7C8', short: true });
    const board = k.ball(0.17, WHITE, 0.36, 0.62, -0.04);
    board.scale.set(0.72, 3.5, 0.14);
    const stripe = k.box(0.04, 1.02, 0.05, c, 0.36, 0.12, -0.04);
    stripe.scale.z = 1;
    for (const s of [-1, 1]) k.box(0.1, 0.05, 0.02, '#16151C', s * 0.062, 0.725, 0.168);
    const lock = k.ball(0.07, L.hair ?? HAIR.blond, 0.1, 0.87, 0.06);
    lock.scale.y = 0.6;
  },
  (k, c, L = {}) => { // La cheffe : toque et tablier
    person(k, { skin: L.skin ?? SKIN[8], hair: L.hair ?? HAIR.brun, top: c, bottom: NAVY });
    k.cyl(0.165, 0.15, 0.13, 14, WHITE, 0, 0.87, 0);
    const puff = k.ball(0.205, WHITE, 0, 1.08, 0);
    puff.scale.y = 0.72;
    k.box(0.21, 0.32, 0.03, WHITE, 0, 0.17, 0.13);
    k.box(0.14, 0.13, 0.03, WHITE, 0, 0.45, 0.125);
    const spoon = k.cyl(0.012, 0.012, 0.32, 6, '#8A6A3F', 0, 0, 0);
    spoon.position.set(0.22, 0.4, 0.04);
    k.ball(0.04, '#8A6A3F', 0.22, 0.57, 0.04);
  },
  (k, c, L = {}) => { // Le grand-père : béret, lunettes, canne
    person(k, { skin: L.skin ?? SKIN[9], hair: L.hair ?? HAIR.gris, top: c, bottom: '#5A5F6E' });
    const beret = k.ball(0.195, NAVY, 0.015, 0.895, -0.015);
    beret.scale.y = 0.34;
    k.cyl(0.012, 0.012, 0.03, 5, NAVY, 0, 0.955, 0);
    for (const s of [-1, 1]) {
      const g = k.torus(0.036, 0.009, Math.PI * 2, '#16151C', s * 0.062, 0.75, 0.163);
      g.scale.z = 0.5;
    }
    k.cyl(0.014, 0.014, 0.33, 6, '#6B4A2E', 0.24, 0, 0.05);
    k.ball(0.028, '#6B4A2E', 0.24, 0.34, 0.05);
    k.box(0.13, 0.09, 0.012, '#FFFFFF', 0, 0.45, 0.13);
  },
];

// Les petits éléments de chaque pays, posés sur son bandeau.
export const PROPS = {
  palmier: (k) => {
    k.cyl(0.05, 0.09, 1, 6, '#9A6B3F', 0, 0, 0);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const leaf = k.cone(0.13, 0.75, 4, i % 2 ? '#2FA65A' : '#3CBF6C', Math.cos(a) * 0.3, 0.86, Math.sin(a) * 0.3);
      leaf.rotation.set(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25);
    }
  },
  tajine: (k) => {
    k.cyl(0.42, 0.34, 0.1, 12, '#B5532F', 0, 0, 0);
    k.cone(0.32, 0.5, 12, '#D9703F', 0, 0.1, 0);
    k.ball(0.06, '#F2C14E', 0, 0.62, 0);
  },
  bambou: (k) => {
    for (const [x, z, h] of [[-0.14, 0, 1.3], [0.12, 0.1, 1.05], [0.02, -0.15, 1.5]]) {
      k.cyl(0.04, 0.05, h, 6, '#6DB33F', x, 0, z);
      for (let y = 0.3; y < h; y += 0.35) k.cyl(0.055, 0.055, 0.03, 6, '#4C8A2A', x, y, z);
      const leaf = k.cone(0.09, 0.4, 4, '#4C9F38', x + 0.12, h - 0.22, z);
      leaf.rotation.z = -1.1;
    }
  },
  lanternePied: (k) => {
    k.cyl(0.02, 0.03, 0.95, 6, '#3A2E2A', 0, 0, 0);
    const lamp = k.ball(0.22, '#E5322D', 0, 1.12, 0);
    lamp.scale.y = 1.15;
    k.cyl(0.1, 0.1, 0.04, 8, '#F2C14E', 0, 1.34, 0);
    k.cyl(0.1, 0.1, 0.04, 8, '#F2C14E', 0, 0.88, 0);
  },
  citronnier: (k) => {
    k.cyl(0.05, 0.07, 0.55, 6, '#7A5534', 0, 0, 0);
    k.ball(0.42, '#3F9E43', 0, 0.82, 0);
    for (const [x, y, z] of [[0.28, 0.9, 0.26], [-0.26, 0.74, 0.3], [0.05, 1.08, 0.3], [0.32, 0.66, -0.14]]) k.ball(0.08, '#FFE14D', x, y, z);
  },
  sardine: (k) => {
    k.cyl(0.26, 0.28, 0.08, 14, '#F2F0E6', 0, 0, 0);
    for (const [x, c] of [[-0.12, '#7FB3D5'], [0.12, '#5F9BC4']]) {
      const f = k.ball(0.1, c, x, 0.14, 0);
      f.scale.set(0.55, 0.5, 2);
    }
  },
  cactus: (k) => {
    const g = '#2F9E58';
    k.cyl(0.13, 0.15, 1.05, 8, g, 0, 0, 0);
    k.ball(0.13, g, 0, 1.05, 0);
    k.cyl(0.07, 0.07, 0.42, 7, g, 0.3, 0.42, 0);
    k.box(0.28, 0.12, 0.12, g, 0.14, 0.4, 0);
    k.ball(0.07, g, 0.3, 0.84, 0);
    k.cyl(0.07, 0.07, 0.34, 7, g, -0.28, 0.55, 0);
    k.box(0.26, 0.12, 0.12, g, -0.14, 0.52, 0);
    k.ball(0.07, g, -0.28, 0.89, 0);
    k.ball(0.06, '#FF5FA2', 0, 1.2, 0);
  },
  sombrero: (k) => {
    k.cyl(0.55, 0.58, 0.05, 18, '#F2C14E', 0, 0.02, 0);
    k.cyl(0.16, 0.24, 0.34, 12, '#F2C14E', 0, 0.07, 0);
    k.cyl(0.245, 0.25, 0.06, 12, '#E5322D', 0, 0.08, 0);
    k.cyl(0.58, 0.58, 0.02, 18, '#E5322D', 0, 0.06, 0);
  },
  cypres: (k) => {
    k.cyl(0.05, 0.06, 0.25, 6, '#6B4A2E', 0, 0, 0);
    const c = k.ball(0.26, '#1F6E4A', 0, 0.85, 0);
    c.scale.y = 2.7;
  },
  vespa: (k) => {
    const c = '#7FD8BE';
    const w = (z) => { const m = k.cyl(0.12, 0.12, 0.07, 12, '#23202A', 0, 0, 0); m.rotation.z = Math.PI / 2; m.position.set(0, 0.12, z); };
    w(0.34);
    w(-0.34);
    k.box(0.2, 0.2, 0.42, c, 0, 0.14, -0.14);
    k.box(0.2, 0.42, 0.08, c, 0, 0.12, 0.28);
    k.box(0.17, 0.08, 0.3, '#6B4A2E', 0, 0.34, -0.14);
    k.box(0.44, 0.04, 0.04, '#23202A', 0, 0.56, 0.28);
    k.ball(0.06, '#FFF3BF', 0, 0.5, 0.33);
  },
  cerisier: (k) => {
    k.cyl(0.05, 0.08, 0.55, 6, '#5B3E31', 0, 0, 0);
    k.ball(0.42, '#FF8FB5', 0, 0.82, 0);
    k.ball(0.26, '#FFA9C7', 0.28, 0.95, 0.12);
    k.ball(0.24, '#FF9ABD', -0.27, 0.72, 0.16);
    k.ball(0.2, '#FFC2D6', -0.12, 1.12, -0.12);
  },
  lanternePierre: (k) => {
    const s = '#A7A8A5';
    k.cyl(0.2, 0.26, 0.1, 6, s, 0, 0, 0);
    k.cyl(0.07, 0.09, 0.4, 6, s, 0, 0.1, 0);
    k.cyl(0.2, 0.14, 0.08, 6, s, 0, 0.5, 0);
    k.box(0.2, 0.2, 0.2, '#FFE9A8', 0, 0.58, 0);
    k.cone(0.34, 0.2, 6, s, 0, 0.78, 0);
    k.ball(0.05, s, 0, 1, 0);
  },
  reverbere: (k) => {
    k.cyl(0.03, 0.05, 1.25, 6, '#26382F', 0, 0, 0);
    k.bars([[[0, 1.1, 0], [0.26, 1.2, 0], 0.016], [[0, 1.1, 0], [-0.26, 1.2, 0], 0.016]], '#26382F');
    for (const x of [-0.27, 0.27]) {
      k.ball(0.08, '#FFF3BF', x, 1.11, 0);
      k.cone(0.08, 0.07, 6, '#26382F', x, 1.18, 0);
    }
  },
  kiosque: (k) => {
    k.cyl(0.26, 0.28, 0.72, 10, '#2D5A47', 0, 0, 0);
    k.cyl(0.285, 0.285, 0.2, 10, '#FF9248', 0, 0.42, 0);
    const d = k.dome(0.33, '#2D5A47', 0, 0.72, 0);
    d.scale.y = 0.8;
    k.ball(0.04, '#D9A441', 0, 1, 0);
  },
  taxi: (k) => {
    const y = '#FFC21A';
    for (const z of [-0.3, 0.3]) for (const x of [-0.2, 0.2]) {
      const m = k.cyl(0.09, 0.09, 0.06, 10, '#23202A', 0, 0, 0);
      m.rotation.z = Math.PI / 2;
      m.position.set(x, 0.09, z);
    }
    k.box(0.4, 0.17, 0.95, y, 0, 0.08, 0);
    k.box(0.36, 0.15, 0.48, '#2C3550', 0, 0.25, -0.04);
    k.box(0.37, 0.025, 0.5, y, 0, 0.4, -0.04);
    k.box(0.18, 0.06, 0.08, '#FFFFFF', 0, 0.425, -0.04);
  },
  borne: (k) => {
    k.cyl(0.11, 0.13, 0.42, 10, '#E5322D', 0, 0, 0);
    k.dome(0.11, '#E5322D', 0, 0.42, 0);
    k.ball(0.03, '#F5F5F0', 0, 0.54, 0);
    const a = k.cyl(0.045, 0.045, 0.32, 8, '#F5F5F0', 0, 0, 0);
    a.rotation.z = Math.PI / 2;
    a.position.set(0, 0.28, 0);
  },
};

export function buildProp(name) {
  const g = new THREE.Group();
  PROPS[name]?.(kit(g));
  return g;
}

// look (facultatif) : le personnage créé par le joueur dans son profil, { style, skin, hair } avec les couleurs en hex.
// Sans lui, chaque place a son voyageur.
export function buildCharacter(seat, color, look = null) {
  const g = new THREE.Group();
  const style = look && Number.isInteger(look.style) ? look.style : seat;
  CAST[style % CAST.length](kit(g), color, look ? { skin: look.skin, hair: look.hair } : {});
  return g;
}

// Le ton de blanc d'une pièce selon sa couleur d'origine : les pièces sombres restent un peu plus foncées, pour garder le relief.
function toneOf(material) {
  const c = material.color;
  const l = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
  return 0.62 + 0.38 * Math.min(1, Math.sqrt(l));
}

// Fond plusieurs objets en une seule forme (un seul appel de dessin), avec une face plate par triangle et un ton par pièce.
// items : [{ object, matrix? }]. Renvoie une géométrie avec position, normal et color.
// fullColor : garde les vraies couleurs (les personnages), au lieu des tons de blanc (la maquette).
export function bake(items, { fullColor = false } = {}) {
  const pos = [];
  const col = [];
  const info = []; // pour chaque sommet : le numéro de sa case (48 = hors case), et 1 s'il peut s'élever au-dessus
  let tileNow = 48;
  let liftNow = 0;
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const i2 = new THREE.Matrix4();
  const push = (geometry, matrix, tone, material, ao) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const p = g.attributes.position;
    const own = g.attributes.color; // un monument sculpté apporte ses propres couleurs
    const c = material.color;
    for (let i = 0; i < p.count; i += 1) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      pos.push(v.x, v.y, v.z);
      info.push(tileNow, liftNow);
      // ao : la hauteur du sol. Plus une pièce en est proche, plus elle s'assombrit : ça pose les objets dans le décor.
      const k = ao === undefined ? 1 : 0.56 + 0.44 * Math.min(1, Math.max(0, (v.y - ao) / 1.1)) ** 0.7;
      if (own) col.push(own.getX(i) * k, own.getY(i) * k, own.getZ(i) * k);
      else if (fullColor) col.push(c.r * k, c.g * k, c.b * k);
      else col.push(tone, tone, tone);
    }
  };
  for (const { object, matrix, tone, ao, tile = 48, lift = false } of items) {
    tileNow = tile;
    liftNow = lift ? 1 : 0;
    object.updateMatrixWorld(true);
    object.traverse((o) => {
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i += 1) {
          o.getMatrixAt(i, i2);
          m.multiplyMatrices(o.matrixWorld, i2);
          if (matrix) m.premultiply(matrix);
          push(o.geometry, m, toneOf(o.material), o.material, ao);
        }
      } else if (o.isMesh) {
        m.copy(o.matrixWorld);
        if (matrix) m.premultiply(matrix);
        push(o.geometry, m, tone ?? toneOf(o.material), o.material, ao);
      }
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('tileInfo', new THREE.Float32BufferAttribute(info, 2));
  geo.computeVertexNormals();
  return geo;
}

// Les cases spéciales.
export const SPECIALS = {
  start: (g) => {
    const k = kit(g);
    for (const x of [-1, 1]) k.box(0.2, 2, 0.2, '#16181F', x, 0, -0.4);
    for (let i = 0; i < 10; i += 1) k.box(0.22, 0.2, 0.2, i % 2 ? '#FFFFFF' : '#16181F', -1 + i * 0.222, 2, -0.4);
    for (let i = 0; i < 10; i += 1) k.box(0.22, 0.2, 0.2, i % 2 ? '#16181F' : '#FFFFFF', -1 + i * 0.222, 2.2, -0.4);
  },
  customs: (g) => {
    const k = kit(g);
    k.box(1.1, 1.05, 1, '#EEF1F6', -0.5, 0, -0.5);
    k.box(1.25, 0.12, 1.15, '#22458C', -0.5, 1.05, -0.5);
    k.box(0.6, 0.45, 0.02, '#2C3550', -0.5, 0.45, 0.01);
    k.cyl(0.07, 0.07, 0.55, 8, '#22458C', 0.45, 0, 0.4);
    const bar = k.box(1.35, 0.08, 0.08, '#E4483E', 1.05, 0.5, 0.4);
    bar.rotation.z = 0.2;
    for (const x of [0.65, 1.05, 1.45]) k.box(0.13, 0.085, 0.09, '#FFFFFF', x, 0.495 + (x - 1.05) * 0.2, 0.4);
  },
  festival: (g) => {
    const k = kit(g);
    k.cone(1.15, 1.2, 8, '#E4483E', 0, 0.75, -0.2);
    k.cyl(1, 1.05, 0.75, 8, '#FFD23F', 0, 0, -0.2);
    k.ball(0.09, '#FFFFFF', 0, 2.05, -0.2);
    [['#FF5C9E', -1.15, 0.85], ['#5BE0C8', 1.15, 0.95], ['#FFD23F', 0.75, -1.15]].forEach(([c, x, z]) => {
      k.cyl(0.012, 0.012, 1.3, 5, '#FFFFFF', x, 0, z);
      k.ball(0.17, c, x, 1.45, z).scale.y = 1.2;
    });
  },
  control: (g) => {
    const k = kit(g);
    k.box(1, 1.9, 0.9, '#3A4466', 0, 0, -0.55);
    k.box(1.15, 0.45, 1.05, '#7FD5E8', 0, 1.9, -0.55);
    k.box(1.25, 0.1, 1.15, '#E4483E', 0, 2.35, -0.55);
    for (const x of [-0.75, 0, 0.75]) {
      k.cone(0.15, 0.42, 8, '#FF7A2E', x, 0, 0.75);
      k.cyl(0.075, 0.1, 0.07, 8, '#FFFFFF', x, 0.14, 0.75);
    }
  },
  escale: (g) => { // Un avion sur la piste
    const k = kit(g);
    k.box(0.6, 0.02, 2.6, '#3A3F4B', 0, 0, 0);
    for (const z of [-0.8, -0.3, 0.2, 0.7]) k.box(0.06, 0.02, 0.25, '#FFFFFF', 0, 0.005, z);
    const body = k.cyl(0.13, 0.13, 1.4, 10, '#FFFFFF', 0, 0.08, 0);
    body.rotation.x = Math.PI / 2;
    body.position.y = 0.32;
    k.ball(0.13, '#FFFFFF', 0, 0.32, 0.7);
    k.box(1.55, 0.04, 0.34, '#E4483E', 0, 0.28, 0);
    k.box(0.04, 0.3, 0.22, '#E4483E', 0, 0.36, -0.62);
    k.box(0.56, 0.03, 0.16, '#E4483E', 0, 0.42, -0.62);
    k.box(0.1, 0.1, 0.16, '#16181F', 0, 0.36, 0.66);
    k.cyl(0.05, 0.05, 0.14, 6, '#16181F', 0, 0.02, 0.1);
  },
  telex: (g) => { // Une dépêche sort de la machine
    const k = kit(g);
    k.box(1.05, 0.42, 0.7, '#2C3550', 0, 0, -0.1);
    k.box(0.75, 0.75, 0.03, '#FFFFFF', 0, 0.42, -0.2).rotation.x = -0.18;
    for (const y of [0.92, 0.78, 0.64]) k.box(0.55, 0.05, 0.035, '#2C3550', 0, y, -0.15 + (y - 0.78) * -0.2);
    k.box(0.8, 0.05, 0.28, '#FFD23F', 0, 0.42, 0.14);
  },
  tax: (g) => { // Des piles de pièces
    const k = kit(g);
    [[-0.45, 0.2, 5], [0.05, -0.3, 8], [0.5, 0.25, 3]].forEach(([x, z, n]) => {
      for (let i = 0; i < n; i += 1) k.cyl(0.25, 0.25, 0.09, 12, i % 2 ? '#F3C13A' : '#E0A92B', x + (i % 2) * 0.012, i * 0.095, z);
    });
  },
  chantier: (g) => { // Une grue
    const k = kit(g);
    const y = '#FFC21A';
    k.box(0.14, 2.3, 0.14, y, -0.3, 0, -0.5);
    k.box(1.7, 0.1, 0.12, y, 0.1, 2.25, -0.5);
    k.box(0.3, 0.25, 0.25, '#3A3F4B', -0.72, 2.03, -0.5);
    k.bars([[[0.65, 2.25, -0.5], [0.65, 1.15, -0.5], 0.012]], '#22242E');
    k.box(0.32, 0.22, 0.32, '#E4483E', 0.65, 0.93, -0.5);
    k.box(0.75, 0.32, 0.65, '#D0D3DA', 0.2, 0, 0.6);
    k.box(0.45, 0.32, 0.4, '#E3E5EA', 0.2, 0.32, 0.6);
  },
};

export function buildSpecial(type) {
  const g = new THREE.Group();
  if (sculpted.has(`special-${type}`)) g.add(new THREE.Mesh(sculpted.get(`special-${type}`), mat('#FFFFFF')));
  else SPECIALS[type]?.(g);
  return g;
}
