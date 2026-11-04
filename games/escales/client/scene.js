// Le monde d'Escales : toute la carte d'un seul coup d'œil, vue du dessus. Chaque pays a sa couleur, son drapeau, son motif
// au sol et ses éléments ; un cadre de la couleur du joueur montre à qui appartient une ville.
// Pour rester fluide : le décor est fondu en une seule forme, les ombres sont calculées une fois, et rien n'est redessiné tant que rien ne bouge.
// Ce fichier ne connaît pas les règles : il reçoit l'état avec update(view) et signale les cases touchées avec onTile(pos).
import * as THREE from './three/three.module.js';
import { REGIONS, TILES } from './board.js';
import { buildMonument, buildSpecial, buildCharacter, buildProp, bake } from './monuments.js';
import { FLAGS, PATTERNS, PROPS_OF } from './countries.js';

// Les 10 couleurs des joueurs.
export const PAWN_COLORS = ['#E5213C', '#FF8A00', '#F5D000', '#16A34A', '#0891B2', '#2563EB', '#7C3AED', '#DB2777', '#92602F', '#475569'];

const SEA = '#A9DFEA';
const INK = '#12151F';
const TILE_W = 2; // largeur d'une case le long du côté
const TILE_D = 3; // profondeur
const BASE_H = 0.1; // le socle blanc, ou le cadre du propriétaire
const PLATE_H = 0.16;
const HALF = (11 * TILE_W + 2 * TILE_D) / 2;
const FOV = 22; // un angle serré : presque une vue de carte, sans déformation
const BANNER_D = 1.8;
const PAWN_SCALE = 1.95;

const SPECIAL_COLOR = { start: '#7BE0A5', customs: '#9DB7F5', festival: '#FF9FCB', control: '#FFA98F', escale: '#EAF1F8', telex: '#FFF0A8', tax: '#FFD88A', chantier: '#D6DBE6' };

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// Centre de chaque case et rotation pour que son avant regarde le centre du plateau.
function tileFrame(pos) {
  const corner = HALF - TILE_D / 2;
  const along = (i) => -HALF + TILE_D + TILE_W * (i - 0.5);
  if (pos === 0) return { x: -corner, z: -corner, rot: 0, corner: true, flat: true };
  if (pos < 12) return { x: along(pos), z: -corner, rot: 0, flat: true };
  if (pos === 12) return { x: corner, z: -corner, rot: 0, corner: true, flat: true };
  if (pos < 24) return { x: corner, z: along(pos - 12), rot: -Math.PI / 2 };
  if (pos === 24) return { x: corner, z: corner, rot: Math.PI, corner: true, flat: true };
  if (pos < 36) return { x: -along(pos - 24), z: corner, rot: Math.PI, flat: true };
  if (pos === 36) return { x: -corner, z: corner, rot: Math.PI, corner: true, flat: true };
  return { x: -corner, z: -along(pos - 36), rot: Math.PI / 2 };
}

const placed = (x, z, rot = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(s, s, s));

function plateGeometry(w, d, h, r) {
  const s = new THREE.Shape();
  const [x, y] = [-w / 2, -d / 2];
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 3 });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// Le monument est mis à l'échelle de sa case, aligné sur une ligne avant ; devant, le texte imprimé reste libre.
function fitModel(model, w, front) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const room = TILE_D / 2 + front - 0.2;
  const scale = Math.min(1, room / Math.max(size.z, 0.01), (w - 0.42) / Math.max(size.x, 0.01));
  model.scale.setScalar(scale);
  model.position.set(-((box.min.x + box.max.x) / 2) * scale, PLATE_H - box.min.y * scale, front - box.max.z * scale);
}

const paint = (geometry, color) => new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color }));

// Une image posée à plat, dans une forme unique : deux vecteurs donnent sa largeur et sa hauteur.
function pushQuad(pos, uv, center, U, V, [u0, v0, u1, v1]) {
  const corner = (a, b) => [center.x + U.x * a + V.x * b, center.y + U.y * a + V.y * b, center.z + U.z * a + V.z * b];
  const P = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
  const T = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  for (const i of [0, 1, 2, 0, 2, 3]) {
    pos.push(...P[i]);
    uv.push(...T[i]);
  }
}

function flatMesh(pos, uv, canvas, opts = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, ...opts }));
  mesh.frustumCulled = false;
  return mesh;
}

// Tous les textes des cases sur une seule image : le nom, le petit drapeau et le prix. Toujours lisibles depuis la caméra.
function buildPrint() {
  const COLS = 6;
  const ROWS = 8;
  const CW = 340;
  const CH = 170;
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CW;
  canvas.height = ROWS * CH;
  const c = canvas.getContext('2d');
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const pos = [];
  const uv = [];
  for (const t of TILES) {
    const col = t.pos % COLS;
    const row = Math.floor(t.pos / COLS);
    const cx = col * CW + CW / 2;
    const cy = row * CH + CH / 2;
    const name = t.short ?? t.name;
    let size = 66;
    do {
      c.font = `800 ${size}px "ES Figtree", system-ui, sans-serif`;
      size -= 2;
    } while (c.measureText(name).width > CW - 16 && size > 28);
    c.fillStyle = INK;
    c.fillText(name, cx, t.price ? cy - 34 : cy);
    if (t.price) {
      const label = `${t.price.toLocaleString('fr-FR')} €`;
      c.font = '700 50px "ES Figtree", system-ui, sans-serif';
      const tw = c.measureText(label).width;
      if (t.type === 'city') {
        const fw = 66;
        const fh = 44;
        const x0 = cx - (fw + 14 + tw) / 2;
        FLAGS[REGIONS[t.region].id](c, x0, cy + 14, fw, fh);
        c.strokeStyle = 'rgba(18,21,31,0.55)';
        c.lineWidth = 2;
        c.strokeRect(x0, cy + 14, fw, fh);
        c.fillStyle = INK;
        c.textAlign = 'left';
        c.fillText(label, x0 + fw + 14, cy + 38);
        c.textAlign = 'center';
      } else {
        c.fillStyle = INK;
        c.fillText(label, cx, cy + 36);
      }
    }
    const f = tileFrame(t.pos);
    const w = f.corner ? 2.5 : f.flat ? 1.68 : 1.42;
    const h = w / 2;
    const z = f.corner ? 0.82 : TILE_D / 2 - 0.2 - (f.flat ? h / 2 : w / 2 - 0.2);
    const center = new THREE.Vector3(0, PLATE_H + 0.012, z).applyMatrix4(placed(f.x, f.z, f.rot));
    pushQuad(pos, uv, center, new THREE.Vector3(w / 2, 0, 0), new THREE.Vector3(0, 0, -h / 2), [col / COLS, 1 - (row + 1) / ROWS, (col + 1) / COLS, 1 - row / ROWS]);
  }
  const m = flatMesh(pos, uv, canvas);
  m.renderOrder = 2;
  return m;
}

// Où se trouve le bandeau de chaque pays : le long de ses villes, côté centre du plateau.
function bannerFrame(r) {
  const side = Math.floor(r / 2);
  const part = r % 2;
  const edge = HALF - TILE_D - BANNER_D / 2 - 0.02;
  const off = [-5, 5][part];
  if (side === 0) return { center: new THREE.Vector3(off, 0, -edge), U: new THREE.Vector3(1, 0, 0), V: new THREE.Vector3(0, 0, -1) };
  if (side === 1) return { center: new THREE.Vector3(edge, 0, off), U: new THREE.Vector3(0, 0, 1), V: new THREE.Vector3(1, 0, 0) };
  if (side === 2) return { center: new THREE.Vector3(-off, 0, edge), U: new THREE.Vector3(1, 0, 0), V: new THREE.Vector3(0, 0, -1) };
  return { center: new THREE.Vector3(-edge, 0, -off), U: new THREE.Vector3(0, 0, -1), V: new THREE.Vector3(-1, 0, 0) };
}

// Les bandeaux au sol : la couleur du pays, son motif, son drapeau et son nom.
function buildBanners() {
  const W = 1024;
  const H = 230;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H * REGIONS.length;
  const c = canvas.getContext('2d');
  const pos = [];
  const uv = [];
  REGIONS.forEach((reg, r) => {
    c.save();
    c.translate(0, r * H);
    c.beginPath();
    c.roundRect(2, 2, W - 4, H - 4, 26);
    c.clip();
    c.fillStyle = reg.color;
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.strokeStyle = 'rgba(255,255,255,0.32)';
    c.lineWidth = 3;
    PATTERNS[reg.id](c, W, H);
    c.font = '800 84px "ES Figtree", system-ui, sans-serif';
    c.textBaseline = 'middle';
    const fw = 132;
    const fh = 88;
    const tw = c.measureText(reg.name).width;
    const total = fw + 24 + tw;
    const x0 = (W - total) / 2;
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.beginPath();
    c.roundRect(x0 - 26, H / 2 - 66, total + 52, 132, 22);
    c.fill();
    FLAGS[reg.id](c, x0, H / 2 - fh / 2, fw, fh);
    c.strokeStyle = 'rgba(18,21,31,0.5)';
    c.lineWidth = 2;
    c.strokeRect(x0, H / 2 - fh / 2, fw, fh);
    c.fillStyle = INK;
    c.fillText(reg.name, x0 + fw + 24, H / 2 + 3);
    c.restore();
    const { center, U, V } = bannerFrame(r);
    const n = REGIONS.length;
    pushQuad(pos, uv, center.clone().setY(0.012), U.clone().multiplyScalar(3.98), V.clone().multiplyScalar(BANNER_D / 2), [0, 1 - (r + 1) / n, 1, 1 - r / n]);
  });
  const m = flatMesh(pos, uv, canvas, { transparent: false });
  m.renderOrder = 0;
  return m;
}

// Le grand drapeau de chaque pays, sur son mât : une seule forme, légèrement ondulée.
function buildFlags() {
  const CW = 150;
  const CH = 100;
  const canvas = document.createElement('canvas');
  canvas.width = 4 * CW;
  canvas.height = 2 * CH;
  const c = canvas.getContext('2d');
  const pos = [];
  const uv = [];
  const SEG = 6;
  const FW = 1.5;
  const FH = 1;
  REGIONS.forEach((reg, r) => {
    const col = r % 4;
    const row = Math.floor(r / 4);
    FLAGS[reg.id](c, col * CW, row * CH, CW, CH);
    const { center, U } = bannerFrame(r);
    const px = center.x + U.x * 2.72;
    const pz = center.z + U.z * 2.72;
    for (let i = 0; i < SEG; i += 1) {
      const a = i / SEG;
      const b = (i + 1) / SEG;
      const wave = (t) => Math.sin(t * 5) * 0.09 * t;
      const P = (t, y) => [px + t * FW, 3.02 + y * FH, pz + wave(t)];
      const uvAt = (t, y) => [(col + t) / 4, 1 - (row + 1 - y) / 2];
      for (const [t, y] of [[a, 0], [b, 0], [b, 1], [a, 0], [b, 1], [a, 1]]) {
        pos.push(...P(t, y));
        uv.push(...uvAt(t, y));
      }
    }
  });
  return flatMesh(pos, uv, canvas, { side: THREE.DoubleSide, transparent: false, depthWrite: true });
}

// Un dé : chaque face est une petite image avec ses points.
function makeDie() {
  const faces = [3, 4, 1, 6, 2, 5]; // +x, -x, +y, -y, +z, -z
  const dots = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
  const materials = faces.map((n) => {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const c = canvas.getContext('2d');
    c.fillStyle = '#FFFFFF';
    c.fillRect(0, 0, 96, 96);
    c.fillStyle = n === 1 ? '#E5213C' : INK;
    for (const [x, y] of dots[n]) {
      c.beginPath();
      c.arc(22 + x * 26, 22 + y * 26, n === 1 ? 14 : 8.5, 0, Math.PI * 2);
      c.fill();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshLambertMaterial({ map: t });
  });
  return new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), materials);
}
// Rotation qui met la face voulue sur le dessus.
const DIE_TOP = { 1: [0, 0, 0], 2: [Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 5: [-Math.PI / 2, 0, 0], 6: [Math.PI, 0, 0] };
const DIE_Y = 0.75;

export function createWorld(host, { onTile }) {
  const startDpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ antialias: startDpr < 2 });
  let dpr = startDpr;
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // les ombres ne bougent presque jamais : on les recalcule seulement au besoin
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Le plateau en 3D : 48 cases, 8 pays de 4 villes, chacun avec son drapeau et son monument. La liste des villes est aussi dans le bouton Villes.');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SEA);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 5, 800);

  scene.add(new THREE.HemisphereLight('#FFFFFF', '#C8D6E0', 2.15));
  const sun = new THREE.DirectionalLight('#FFF6E6', 1.3);
  sun.position.set(-16, 34, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const b = HALF + 4;
  Object.assign(sun.shadow.camera, { left: -b, right: b, top: b, bottom: -b, near: 1, far: 90 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun);

  // La mer : la couleur du fond, qui ne reçoit que les ombres.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.ShadowMaterial({ color: '#124559', opacity: 0.22 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ——— Tout le décor en une seule forme : cases, monuments, éléments des pays, mâts ———
  const items = [];
  const baseGeo = { side: plateGeometry(TILE_W - 0.06, TILE_D - 0.06, BASE_H, 0.16), corner: plateGeometry(TILE_D - 0.06, TILE_D - 0.06, BASE_H, 0.16) };
  const hitBoxes = [];
  const parts = TILES.map((t) => {
    const f = tileFrame(t.pos);
    const w = f.corner ? TILE_D : TILE_W;
    const m = placed(f.x, f.z, f.rot);
    const base = paint(f.corner ? baseGeo.corner : baseGeo.side, '#FFFFFF');
    const color = t.type === 'city' ? REGIONS[t.region].color : SPECIAL_COLOR[t.type];
    const plate = paint(plateGeometry(w - 0.34, TILE_D - 0.34, PLATE_H, 0.1), color);
    const front = f.corner ? 0.05 : f.flat ? 0.34 : -0.1;
    const model = t.type === 'city' ? buildMonument(t.model) : buildSpecial(t.type);
    fitModel(model, w, front);
    items.push({ object: base, matrix: m }, { object: plate, matrix: m }, { object: model, matrix: m });
    const hit = new THREE.Mesh(new THREE.BoxGeometry(w, 2.4, TILE_D));
    hit.position.set(f.x, 1.2, f.z);
    hit.rotation.y = f.rot;
    hit.updateMatrixWorld(true);
    hit.userData.pos = t.pos;
    hitBoxes.push(hit);
    const levels = new THREE.Group();
    levels.position.set(f.x, 0, f.z);
    levels.rotation.y = f.rot;
    scene.add(levels);
    return { f, w, levels, level: 0, rim: null, shade: null, color: null };
  });

  REGIONS.forEach((reg, r) => {
    const { center, U } = bannerFrame(r);
    const spots = [-3.45, -2.5, 3.5];
    PROPS_OF[reg.id].forEach((name, i) => {
      const p = center.clone().addScaledVector(U, spots[i]);
      items.push({ object: buildProp(name), matrix: placed(p.x, p.z, Math.atan2(U.x, U.z) + 1.1, 1.05) });
    });
    const pole = new THREE.Group();
    const steel = new THREE.MeshBasicMaterial({ color: '#E7EBF0' });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 4, 6), steel);
    shaft.position.y = 2;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 5), new THREE.MeshBasicMaterial({ color: '#F2C14E' }));
    knob.position.y = 4.05;
    pole.add(shaft, knob);
    const p = center.clone().addScaledVector(U, 2.72);
    items.push({ object: pole, matrix: placed(p.x, p.z) });
  });

  const world = new THREE.Mesh(bake(items, { fullColor: true }), new THREE.MeshLambertMaterial({ vertexColors: true }));
  world.castShadow = true;
  world.receiveShadow = true;
  world.frustumCulled = false;
  scene.add(world, buildBanners(), buildFlags(), buildPrint());

  // ——— À qui sont les villes ———
  const tints = new Map();
  const tint = (hex) => {
    if (!tints.has(hex)) tints.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
    return tints.get(hex);
  };
  const shadeMat = new THREE.MeshBasicMaterial({ color: '#39414F', transparent: true, opacity: 0.55, depthWrite: false });
  const rimGeo = { side: plateGeometry(TILE_W - 0.04, TILE_D - 0.04, BASE_H + 0.02, 0.16), corner: plateGeometry(TILE_D - 0.04, TILE_D - 0.04, BASE_H + 0.02, 0.16) };
  const shadeGeo = plateGeometry(TILE_W - 0.34, TILE_D - 0.34, 0.01, 0.1);
  const levelGeo = new THREE.BoxGeometry(0.26, 1, 0.26);

  const setOwner = (part, color, mortgaged) => {
    if (part.color !== color) {
      part.color = color;
      if (color && !part.rim) {
        part.rim = new THREE.Mesh(part.f.corner ? rimGeo.corner : rimGeo.side, tint(color));
        part.rim.position.set(part.f.x, 0, part.f.z);
        part.rim.rotation.y = part.f.rot;
        scene.add(part.rim);
      } else if (color) {
        part.rim.material = tint(color);
      } else if (part.rim) {
        scene.remove(part.rim);
        part.rim = null;
      }
      part.levels.children.forEach((m) => { if (color) m.material = tint(color); });
    }
    if (mortgaged && !part.shade) {
      part.shade = new THREE.Mesh(shadeGeo, shadeMat);
      part.shade.position.set(part.f.x, PLATE_H + 0.02, part.f.z);
      part.shade.rotation.y = part.f.rot;
      scene.add(part.shade);
    } else if (!mortgaged && part.shade) {
      scene.remove(part.shade);
      part.shade = null;
    }
  };
  const LEVEL_SPOTS = [[-0.68, -1.15], [0.68, -1.15], [-0.68, -0.72], [0.68, -0.72]];
  const setLevels = (part, level, color) => {
    if (part.level === level) return false;
    part.level = level;
    part.levels.clear();
    for (let i = 0; i < level; i += 1) {
      const h = 0.42 + i * 0.16;
      const m = new THREE.Mesh(levelGeo, tint(color ?? '#FFFFFF'));
      m.scale.y = h;
      m.position.set(LEVEL_SPOTS[i][0], PLATE_H + h / 2, LEVEL_SPOTS[i][1]);
      m.castShadow = true;
      part.levels.add(m);
    }
    return true;
  };

  // ——— Le festival : un repère au-dessus de la ville ———
  const festivalMark = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 4), new THREE.MeshLambertMaterial({ color: '#FF2E93' }));
  festivalMark.rotation.x = Math.PI;
  festivalMark.visible = false;
  scene.add(festivalMark);

  // ——— Les personnages : ils marchent sur le sol, le long du bord intérieur, pour ne jamais cacher le texte ———
  const personMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const blobGeo = new THREE.CircleGeometry(0.4, 16);
  blobGeo.rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ color: '#124559', transparent: true, opacity: 0.22, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.76, 32), new THREE.MeshBasicMaterial({ color: INK, depthWrite: false, transparent: true }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  ring.renderOrder = 3;
  scene.add(ring);
  const pawns = new Map();
  const FACING = 0.3; // vue de trois quarts, face à la caméra

  function pawnSpot(p, pos) {
    const f = tileFrame(pos);
    const i = p.seat;
    const ox = ((i % 5) - 2) * 0.5;
    if (f.corner) { // sur un coin, le sol libre est en diagonale, vers le centre du plateau
      const d = TILE_D / 2 + 0.62 + (i >= 5 ? 0.8 : 0);
      const [sx, sz] = [-Math.sign(f.x), -Math.sign(f.z)];
      return new THREE.Vector3(f.x + sx * d + sx * ox * 0.7, 0, f.z + sz * d - sz * ox * 0.7);
    }
    const oz = TILE_D / 2 + 0.5 + (i >= 5 ? 0.8 : 0);
    const c = Math.cos(f.rot);
    const s = Math.sin(f.rot);
    return new THREE.Vector3(f.x + ox * c + oz * s, 0, f.z - ox * s + oz * c);
  }

  // ——— Les dés ———
  const dice = [makeDie(), makeDie()];
  dice[0].position.set(-1.15, DIE_Y, -6.3);
  dice[1].position.set(1.15, DIE_Y, -6);
  dice.forEach((d) => { d.visible = false; scene.add(d); });
  let diceAnim = null;
  let lastRollN = -1;

  // ——— La caméra : toute la carte, tout le temps. On peut tourner ou zoomer, elle revient d'elle-même ———
  const HOME = { yaw: 0, pitch: 1.12 };
  const cam = { yaw: HOME.yaw, pitch: HOME.pitch, dist: 120, target: new THREE.Vector3(), wantYaw: HOME.yaw, wantPitch: HOME.pitch, wantDist: 120 };
  let snap = true;
  let userUntil = 0;
  let size = { w: 0, h: 0 };
  let fitDist = 120;

  const placeCamera = (yaw, pitch, dist) => {
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(cam.target);
    camera.updateMatrixWorld(true);
  };

  // La plus petite distance qui montre toute la carte, quel que soit l'écran.
  function computeFit() {
    const pts = [];
    for (const x of [-HALF, HALF]) for (const z of [-HALF, HALF]) pts.push(new THREE.Vector3(x, 0, z));
    for (const x of [-HALF, HALF]) pts.push(new THREE.Vector3(x, 4.2, -HALF));
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    let lo = 30;
    let hi = 500;
    const v = new THREE.Vector3();
    for (let i = 0; i < 22; i += 1) {
      const mid = (lo + hi) / 2;
      placeCamera(HOME.yaw, HOME.pitch, mid);
      const inside = pts.every((p) => {
        v.copy(p).project(camera);
        return Math.abs(v.x) <= 0.97 && Math.abs(v.y) <= 0.97;
      });
      if (inside) hi = mid;
      else lo = mid;
    }
    fitDist = hi;
    // Sur téléphone, la carte se place en haut : le bas de l'écran est pour la carte d'action.
    if (size.w < size.h) {
      placeCamera(HOME.yaw, HOME.pitch, fitDist);
      const ys = pts.map((p) => v.copy(p).project(camera).y);
      const py = ((1 - Math.max(...ys)) / 2) * size.h;
      const tall = ((Math.max(...ys) - Math.min(...ys)) / 2) * size.h;
      const free = size.h * 0.74 - 70; // entre les liens du haut et la carte d'action
      const wanted = 70 + Math.max(0, (free - tall) / 2);
      camera.setViewOffset(size.w, size.h, 0, py - wanted, size.w, size.h);
      camera.updateProjectionMatrix();
    }
  }

  function recenter() {
    cam.wantYaw = HOME.yaw;
    // Revenir par le chemin le plus court si on a beaucoup tourné.
    cam.yaw = ((cam.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    cam.wantPitch = HOME.pitch;
    cam.wantDist = fitDist;
    userUntil = 0;
  }

  // ——— La boucle : elle ne tourne que quand quelque chose bouge ———
  let raf = 0;
  let last = 0;
  const quality = { frames: 0, total: 0, step: 0 };
  const reduced = reducedMotion();

  function lowerQuality() {
    quality.step += 1;
    if (quality.step === 1 && dpr > 1) {
      dpr = Math.max(1, dpr - 0.5);
      renderer.setPixelRatio(dpr);
      renderer.setSize(size.w, size.h, false);
    } else if (quality.step === 2) {
      sun.castShadow = false;
      ground.visible = false;
      scene.traverse((o) => { if (o.material && !Array.isArray(o.material)) o.material.needsUpdate = true; });
    } else if (quality.step === 3 && dpr > 0.75) {
      dpr = 0.75;
      renderer.setPixelRatio(dpr);
      renderer.setSize(size.w, size.h, false);
    }
  }

  let view = null;

  function tick(now) {
    raf = 0;
    if (!size.w || !size.h) return; // écran caché (onglet Chat sur téléphone)
    const dt = Math.min(0.05, (now - last) / 1000);
    const real = now - last;
    last = now;
    let busy = false;

    for (const pawn of pawns.values()) {
      if (!pawn.to && pawn.queue.length) {
        const step = pawn.queue.shift();
        pawn.from = pawn.mesh.position.clone();
        pawn.to = pawnSpot(pawn.player, step.pos);
        pawn.jump = step.jump;
        pawn.t = 0;
        pawn.dur = step.jump > 2 ? 0.8 : 0.17;
        pawn.toPos = step.pos;
        pawn.fromRot = pawn.mesh.rotation.y;
        // Il regarde où il va en marchant, puis se tourne vers nous à l'arrivée.
        pawn.toRot = Math.atan2(pawn.to.x - pawn.from.x, pawn.to.z - pawn.from.z);
        while (pawn.toRot - pawn.fromRot > Math.PI) pawn.toRot -= Math.PI * 2;
        while (pawn.toRot - pawn.fromRot < -Math.PI) pawn.toRot += Math.PI * 2;
      }
      if (pawn.to) {
        busy = true;
        pawn.t = Math.min(1, pawn.t + dt / pawn.dur);
        pawn.mesh.position.lerpVectors(pawn.from, pawn.to, ease(pawn.t));
        pawn.blob.position.set(pawn.mesh.position.x, 0.02, pawn.mesh.position.z);
        pawn.mesh.position.y = Math.sin(pawn.t * Math.PI) * pawn.jump;
        pawn.mesh.rotation.y = pawn.fromRot + (pawn.toRot - pawn.fromRot) * Math.min(1, pawn.t * 2.5);
        if (pawn.t >= 1) {
          pawn.shown = pawn.toPos;
          pawn.to = null;
          if (!pawn.queue.length) pawn.turning = true;
        }
      } else if (pawn.turning) {
        let d = FACING - pawn.mesh.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        if (Math.abs(d) < 0.01) {
          pawn.mesh.rotation.y = FACING;
          pawn.turning = false;
        } else {
          pawn.mesh.rotation.y += d * (1 - Math.exp(-dt * 9));
          busy = true;
        }
      }
    }
    const curPawn = view && pawns.get(view.players[view.cur]?.id);
    if (curPawn) {
      ring.position.x = curPawn.mesh.position.x;
      ring.position.z = curPawn.mesh.position.z;
      ring.visible = !view.over;
    }

    if (diceAnim) {
      busy = true;
      diceAnim.t += dt / 0.7;
      const k = Math.min(1, diceAnim.t);
      dice.forEach((d, i) => {
        const [x, y, z] = DIE_TOP[diceAnim.values[i]];
        const spin = (1 - ease(k)) * 12;
        d.rotation.set(x + spin, y + spin * 0.7, z + spin * 0.45);
        d.position.y = DIE_Y + Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k) * 2.6;
      });
      if (k >= 1) diceAnim = null;
    }

    const k = snap || reduced ? 1 : 1 - Math.exp(-dt * 4);
    snap = false;
    cam.yaw += (cam.wantYaw - cam.yaw) * k;
    cam.pitch += (cam.wantPitch - cam.pitch) * k;
    cam.dist += (cam.wantDist - cam.dist) * k;
    if (Math.abs(cam.wantYaw - cam.yaw) > 0.0006 || Math.abs(cam.wantPitch - cam.pitch) > 0.0006 || Math.abs(cam.wantDist - cam.dist) > 0.03) busy = true;
    else {
      cam.yaw = cam.wantYaw;
      cam.pitch = cam.wantPitch;
      cam.dist = cam.wantDist;
    }
    placeCamera(cam.yaw, cam.pitch, cam.dist);
    renderer.render(scene, camera);

    // Si la machine n'arrive pas à suivre, on baisse la qualité plutôt que de saccader.
    if (busy && real < 500) {
      quality.frames += 1;
      quality.total += real;
      if (quality.frames >= 40) {
        if (quality.total / quality.frames > 30 && quality.step < 3) lowerQuality();
        quality.frames = 0;
        quality.total = 0;
      }
    }
    if (busy || pointers.size) wake();
  }
  function wake() {
    if (raf) return;
    if (!last || performance.now() - last > 100) last = performance.now() - 16;
    raf = requestAnimationFrame(tick);
  }

  // ——— Toucher, glisser, zoomer ———
  const pointers = new Map();
  let moved = 0;
  let pinch = 0;
  const raycaster = new THREE.Raycaster();
  const limitDist = (d) => Math.min(fitDist * 1.25, Math.max(fitDist * 0.3, d));
  const hold = () => { userUntil = performance.now() + 15000; };
  const onDown = (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    pinch = 0;
  };
  const onMove = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (pointers.size === 2) {
      const [a, c] = [...pointers.values()];
      const gap = Math.hypot(a.x - c.x, a.y - c.y);
      if (pinch) cam.wantDist = limitDist(cam.wantDist * (pinch / gap));
      pinch = gap;
      hold();
      wake();
    } else if (moved > 6) {
      cam.wantYaw -= dx * 0.006;
      cam.wantPitch = Math.min(1.4, Math.max(0.55, cam.wantPitch + dy * 0.003));
      hold();
      wake();
    }
  };
  const onUp = (e) => {
    const wasDown = pointers.delete(e.pointerId);
    if (!wasDown || moved > 6 || e.type === 'pointercancel') return;
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = raycaster.intersectObjects(hitBoxes, false)[0];
    if (hit) onTile(hit.object.userData.pos);
  };
  const onWheel = (e) => {
    e.preventDefault();
    cam.wantDist = limitDist(cam.wantDist * (1 + Math.sign(e.deltaY) * 0.08));
    hold();
    wake();
  };
  // Si le navigateur retire la 3D (mise en veille, manque de mémoire), on reprend proprement quand elle revient.
  const onLost = (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const onRestored = () => {
    renderer.shadowMap.needsUpdate = true;
    wake();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  const ro = new ResizeObserver(() => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === size.w && h === size.h) return;
    size = { w, h };
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    computeFit();
    recenter();
    cam.dist = cam.wantDist;
    wake();
  });

  // ——— Mettre le monde à jour avec l'état de la partie ———
  let firstUpdate = true;
  function update(v) {
    view = v;
    let shadows = false;

    TILES.forEach((t) => {
      const part = parts[t.pos];
      const prop = v.props[t.pos];
      const owner = prop ? v.players.find((p) => p.id === prop.owner) : null;
      const color = owner ? PAWN_COLORS[owner.seat] : null;
      setOwner(part, color, Boolean(prop?.mortgaged));
      if (setLevels(part, prop?.level ?? 0, color)) shadows = true;
    });

    if (v.festival) {
      const f = tileFrame(v.festival.pos);
      festivalMark.position.set(f.x, 4.4, f.z);
      festivalMark.visible = true;
    } else {
      festivalMark.visible = false;
    }

    for (const p of v.players) {
      let pawn = pawns.get(p.id);
      if (!pawn) {
        // Chaque personnage est fondu en une seule forme, sa tenue à la couleur du joueur.
        const mesh = new THREE.Mesh(bake([{ object: buildCharacter(p.seat, PAWN_COLORS[p.seat]) }], { fullColor: true }), personMat);
        mesh.scale.setScalar(PAWN_SCALE);
        mesh.rotation.y = FACING;
        const blob = new THREE.Mesh(blobGeo, blobMat);
        blob.scale.setScalar(PAWN_SCALE * 0.8);
        scene.add(mesh, blob);
        pawn = { mesh, blob, shown: p.pos, goal: p.pos, queue: [], t: 0, from: null, to: null, player: p, turning: false };
        mesh.position.copy(pawnSpot(p, p.pos));
        blob.position.set(mesh.position.x, 0.02, mesh.position.z);
        pawns.set(p.id, pawn);
      }
      pawn.player = p;
      pawn.mesh.visible = !p.out;
      pawn.blob.visible = !p.out;
      if (p.out || pawn.goal === p.pos) continue;
      pawn.goal = p.pos;
      const forward = (p.pos - pawn.shown + 48) % 48;
      pawn.queue = [];
      if (reduced || forward === 0) {
        pawn.shown = p.pos;
        pawn.to = null;
        pawn.mesh.position.copy(pawnSpot(p, p.pos));
        pawn.blob.position.set(pawn.mesh.position.x, 0.02, pawn.mesh.position.z);
      } else if (forward <= 14) {
        for (let i = 1; i <= forward; i += 1) pawn.queue.push({ pos: (pawn.shown + i) % 48, jump: 0.42 });
      } else {
        pawn.queue.push({ pos: p.pos, jump: 5 }); // un vol ou un renvoi à la Douane : un grand saut
      }
    }

    if (v.dice && v.rollN !== lastRollN) {
      const initial = lastRollN === -1;
      lastRollN = v.rollN;
      dice.forEach((d, i) => {
        d.visible = true;
        d.rotation.set(...DIE_TOP[v.dice[i]]);
        d.position.y = DIE_Y;
      });
      if (!initial && !reduced) diceAnim = { t: 0, values: v.dice.slice() };
    }

    if (userUntil && performance.now() > userUntil) recenter();
    if (shadows || firstUpdate) renderer.shadowMap.needsUpdate = true;
    firstUpdate = false;
    wake();
  }
  renderer.shadowMap.needsUpdate = true;
  ro.observe(host);

  return {
    update,
    recenter() {
      recenter();
      wake();
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      scene.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [o.material].flat()) {
          m?.map?.dispose();
          m?.dispose();
        }
      });
      hitBoxes.forEach((h) => h.geometry.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
