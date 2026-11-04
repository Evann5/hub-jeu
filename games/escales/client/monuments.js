// Les monuments d'Escales, en 3D, façon maquette. Un monument tient sur une case de 2 × 3 (le bas à y = 0, l'avant vers +z).
// Pour une nouvelle ville : écrire ici une fonction avec le petit kit (box, cyl, cone, dome, bars) et la nommer dans board.js.
import * as THREE from './three/three.module.js';

const mats = new Map();
export function mat(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.72, metalness: 0.02, ...opts }));
  return mats.get(key);
}

function kit(g) {
  const add = (geo, color, x, y, z, opts) => {
    const m = new THREE.Mesh(geo, mat(color, opts));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  return {
    box: (w, h, d, color, x = 0, y = 0, z = 0) => add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z),
    cyl: (rt, rb, h, seg, color, x = 0, y = 0, z = 0) => add(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y + h / 2, z),
    cone: (r, h, seg, color, x = 0, y = 0, z = 0) => add(new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z),
    ball: (r, color, x = 0, y = 0, z = 0) => add(new THREE.SphereGeometry(r, 12, 9), color, x, y, z),
    dome: (r, color, x = 0, y = 0, z = 0) => add(new THREE.SphereGeometry(r, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), color, x, y, z),
    torus: (r, t, arc, color, x, y, z, rotY = 0) => {
      const m = add(new THREE.TorusGeometry(r, t, 6, 18, arc), color, x, y, z);
      m.rotation.y = rotY;
      return m;
    },
    // Des barres entre deux points, regroupées en une seule forme : c'est ce qui donne la dentelle de la tour Eiffel.
    bars: (list, color) => {
      const geo = new THREE.CylinderGeometry(1, 1, 1, 5);
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
      mesh.castShadow = true;
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

export function buildMonument(name) {
  const g = new THREE.Group();
  (MONUMENTS[name] ?? MONUMENTS.maisonsColorees)(g);
  return g;
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
  SPECIALS[type]?.(g);
  return g;
}
