// Le monde d'Escales : un plateau posé sur un fond uni, entier d'un seul coup d'œil. Chaque pays a sa couleur, son drapeau, son motif
// au sol et ses éléments ; un cadre de la couleur du joueur montre à qui appartient une ville.
// Pour rester fluide : le décor est fondu en une seule forme, les ombres sont calculées une fois, et rien n'est redessiné tant que rien ne bouge.
// Ce fichier ne connaît pas les règles : il reçoit l'état avec update(view) et signale les cases touchées avec onTile(pos).
import * as THREE from './three/three.module.js';
import { REGIONS, TILES } from './board.js';
import { buildMonument, buildSpecial, buildCharacter, buildProp, bake } from './monuments.js';
import { FLAGS, PATTERNS, PROPS_OF } from './countries.js';

// Les 10 couleurs des joueurs.
export const PAWN_COLORS = ['#E5213C', '#FF8A00', '#F5D000', '#16A34A', '#0891B2', '#2563EB', '#7C3AED', '#DB2777', '#92602F', '#475569'];

const WARM = '#FFF6E8';
const SLAB = '#1C4A42';
const INK = '#12151F';
const TILE_W = 2; // largeur d'une case le long du côté
const TILE_D = 3; // profondeur
const BASE_H = 0.1; // le socle blanc, ou le cadre du propriétaire
const PLATE_H = 0.16;
const HALF = (11 * TILE_W + 2 * TILE_D) / 2;
const BANNER_D = 1.8;
const DICE_Z = -7.15; // la piste des dés, en haut de la zone centrale
const BOTTOM_LIFT = 1.2; // les bandeaux du bas remontent : les monuments de la rangée du bas, debout devant eux, ne cachent plus leur nom
const PAWN_SCALE = 2.25;

const BOTTOM_CORNER_H = 1.7; // au-delà, ce qui est posé sur un coin du bas cacherait le nom de la ville juste derrière
const SPECIAL_COLOR = { start: '#7FD9A4', customs: '#9DB6F0', festival: '#F59BC4', control: '#F4A58E', escale: '#E3EAF3', telex: '#F6DE7E', tax: '#F3C66E', chantier: '#C9CED9' };
// Les monuments qui doivent impressionner sont un peu plus grands que les autres.
const HEROES = { eiffel: 1.04, colisee: 1.15, empire: 0.82, gratteCiel2: 0.88, tourTokyo: 0.95, gratteCiel: 0.95, mosquee: 0.92 };
// La couleur d'un pays sur ses cases : la même teinte, adoucie, pour que les monuments et les joueurs ressortent.
const softened = (hex, amount = 0.28) => new THREE.Color(hex).lerp(new THREE.Color(WARM), amount);

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
  // Rangée du bas (flip) : le texte reste côté caméra et le monument derrière, pour qu'il ne le cache jamais.
  if (pos === 24) return { x: corner, z: corner, rot: Math.PI, corner: true, flat: true, flip: true };
  if (pos < 36) return { x: -along(pos - 24), z: corner, rot: Math.PI, flat: true, flip: true };
  if (pos === 36) return { x: -corner, z: corner, rot: Math.PI, corner: true, flat: true, flip: true };
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
function fitModel(model, w, front, hero = 1, flip = false, maxH = Infinity) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const room = TILE_D / 2 + front + 0.35; // le monument peut déborder vers l'extérieur du plateau
  const scale = Math.min(hero * Math.min(1.1, room / Math.max(size.z, 0.01), (w - 0.2) / Math.max(size.x, 0.01)), maxH / Math.max(size.y, 0.01));
  model.scale.setScalar(scale);
  model.position.set(-((box.min.x + box.max.x) / 2) * scale, PLATE_H - box.min.y * scale, flip ? -front - box.min.z * scale : front - box.max.z * scale);
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
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false, ...opts }));
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
    let size = 78;
    do {
      c.font = `800 ${size}px "ES Barlow", system-ui, sans-serif`;
      size -= 2;
    } while (c.measureText(name).width > CW - 16 && size > 28);
    c.fillStyle = INK;
    c.fillText(name, cx, t.price ? cy - 34 : cy);
    if (t.price) {
      const label = `${t.price.toLocaleString('fr-FR')} €`;
      c.font = '700 56px "ES Barlow", system-ui, sans-serif';
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
    // Coins du haut : le monument de la case juste devant monte sur le côté extérieur, le nom se range côté centre pour rester visible.
    const topCorner = f.corner && !f.flip;
    const w = topCorner ? 1.55 : f.corner ? 2.5 : f.flat ? 1.68 : 1.42;
    const h = w / 2;
    const z = f.corner ? 0.82 : TILE_D / 2 - 0.2 - (f.flat ? h / 2 : w / 2 - 0.2);
    const center = new THREE.Vector3(topCorner ? -Math.sign(f.x) * 0.62 : 0, PLATE_H + 0.012, f.flip ? -z : z).applyMatrix4(placed(f.x, f.z, f.rot));
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
  if (side === 2) return { center: new THREE.Vector3(-off, 0, edge - BOTTOM_LIFT), U: new THREE.Vector3(1, 0, 0), V: new THREE.Vector3(0, 0, -1) };
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
    const tone = `#${softened(reg.color, 0.08).getHexString()}`;
    c.fillStyle = tone;
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.strokeStyle = 'rgba(255,255,255,0.36)';
    c.lineWidth = 3;
    PATTERNS[reg.id](c, W, H);
    // Le nom s'écrit à même la couleur du pays : le motif s'efface doucement derrière lui.
    c.font = '400 92px "ES Alfa", Georgia, serif';
    c.textBaseline = 'middle';
    const fw = 120;
    const fh = 80;
    const tw = c.measureText(reg.name).width;
    const total = fw + 26 + tw;
    const x0 = (W - total) / 2;
    const fade = c.createLinearGradient(x0 - 90, 0, x0 + total + 90, 0);
    const rgb = softened(reg.color, 0.08);
    const col = (a) => `rgba(${Math.round(new THREE.Color(rgb).convertLinearToSRGB().r * 255)},${Math.round(new THREE.Color(rgb).convertLinearToSRGB().g * 255)},${Math.round(new THREE.Color(rgb).convertLinearToSRGB().b * 255)},${a})`;
    fade.addColorStop(0, col(0));
    fade.addColorStop(0.1, col(1));
    fade.addColorStop(0.9, col(1));
    fade.addColorStop(1, col(0));
    c.fillStyle = fade;
    c.fillRect(x0 - 90, 0, total + 180, H);
    FLAGS[reg.id](c, x0, H / 2 - fh / 2, fw, fh);
    c.strokeStyle = 'rgba(18,21,31,0.55)';
    c.lineWidth = 3;
    c.strokeRect(x0, H / 2 - fh / 2, fw, fh);
    c.fillStyle = INK;
    c.fillText(reg.name, x0 + fw + 26, H / 2 + 5);
    c.restore();
    const { center, U, V } = bannerFrame(r);
    const n = REGIONS.length;
    pushQuad(pos, uv, center.clone().setY(0.012), U.clone().multiplyScalar(3.98), V.clone().multiplyScalar(BANNER_D / 2), [0, 1 - (r + 1) / n, 1, 1 - r / n]);
  });
  const m = flatMesh(pos, uv, canvas, { transparent: false });
  m.renderOrder = 0;
  return m;
}

// Le pied du mât de chaque pays, là où le drapeau ne cache aucun nom.
// En haut et en bas : sur le devant du bandeau, à droite de son nom. Sur les côtés : au bout du bandeau, dans l'espace libre juste derrière.
function flagFoot(r) {
  const side = Math.floor(r / 2);
  const { center, U } = bannerFrame(r);
  if (side === 0 || side === 2) return center.clone().addScaledVector(U, 2.68).setZ(center.z + 0.62);
  const north = center.z - 4.2;
  return new THREE.Vector3(side === 1 ? 9.6 : -10.45, 0, north);
}

// Le drapeau de chaque pays, sur son petit mât : une seule forme, légèrement ondulée.
function buildFlags() {
  const CW = 150;
  const CH = 100;
  const canvas = document.createElement('canvas');
  canvas.width = 4 * CW;
  canvas.height = 2 * CH;
  const c = canvas.getContext('2d');
  const pos = [];
  const uv = [];
  const SEG = 8;
  const along = []; // 0 au mât, 1 au bout : seul le bout du drapeau flotte
  const FW = 1.08;
  const FH = 0.72;
  REGIONS.forEach((reg, r) => {
    const col = r % 4;
    const row = Math.floor(r / 4);
    FLAGS[reg.id](c, col * CW, row * CH, CW, CH);
    const { x: px, z: pz } = flagFoot(r);
    for (let i = 0; i < SEG; i += 1) {
      const a = i / SEG;
      const b = (i + 1) / SEG;
      const P = (t, y) => [px + t * FW, 1.3 + y * FH, pz];
      const uvAt = (t, y) => [(col + t) / 4, 1 - (row + 1 - y) / 2];
      for (const [t, y] of [[a, 0], [b, 0], [b, 1], [a, 0], [b, 1], [a, 1]]) {
        pos.push(...P(t, y));
        uv.push(...uvAt(t, y));
        along.push(t);
      }
    }
  });
  const mesh = flatMesh(pos, uv, canvas, { side: THREE.DoubleSide, transparent: false, depthWrite: true });
  mesh.geometry.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
  const time = { value: 0 };
  mesh.material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `attribute float along;\nuniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      transformed.z += sin(along * 6.0 - uTime * 3.2 + position.x) * 0.13 * along;
      transformed.y += sin(along * 4.0 - uTime * 2.4) * 0.05 * along;`,
    );
  };
  mesh.userData.time = time;
  return mesh;
}

// Ce qui est gravé dans la dalle : le liseré doré, la piste ronde des dés et le nom du jeu.
function buildEngraving() {
  const SIZE = 2048;
  const WORLD = HALF * 2 + 1.5;
  const px = SIZE / WORLD;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const c = canvas.getContext('2d');
  const at = (u) => SIZE / 2 + u * px;
  const gold = '#C9A45C';
  // Le liseré autour du plateau, et un filet plus fin autour de la zone centrale.
  c.strokeStyle = gold;
  c.lineWidth = 5;
  c.beginPath();
  c.roundRect(at(-WORLD / 2 + 0.26), at(-WORLD / 2 + 0.26), (WORLD - 0.52) * px, (WORLD - 0.52) * px, 0.85 * px);
  c.stroke();
  const inner = HALF - TILE_D - BANNER_D - 0.32;
  c.globalAlpha = 0.55;
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(at(-inner), at(-inner), inner * 2 * px, (inner * 2 - BOTTOM_LIFT) * px, 0.7 * px);
  c.stroke();
  c.globalAlpha = 1;
  // La piste des dés
  const [dx, dz] = [at(0), at(DICE_Z)];
  c.fillStyle = '#143C35';
  c.beginPath();
  c.ellipse(dx, dz, 3 * px, 1.5 * px, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = gold;
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(dx, dz, 3 * px, 1.5 * px, 0, 0, Math.PI * 2);
  c.stroke();
  // Le nom du jeu, gravé ton sur ton en bas de la zone centrale
  c.font = `400 ${Math.round(1.5 * px)}px "ES Alfa", Georgia, serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.fillText('Escales', at(0) + 3, at(6.85) + 4);
  c.fillStyle = '#2C6256';
  c.fillText('Escales', at(0), at(6.85));
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.006;
  m.renderOrder = 0;
  return m;
}

// Un cube aux arêtes bien arrondies : chaque sommet est ramené sur une sphère aux coins.
function roundedCube(size, radius, seg = 7) {
  const geo = new THREE.BoxGeometry(size, size, size, seg, seg, seg);
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const inner = size / 2 - radius;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 1) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-inner, Math.min(inner, v.x)), Math.max(-inner, Math.min(inner, v.y)), Math.max(-inner, Math.min(inner, v.z)));
    v.sub(c).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
    v.multiplyScalar(radius).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return geo;
}

// Un dé en ivoire, aux points creusés : chaque face est dessinée avec un petit relief.
function makeDie() {
  const faces = [3, 4, 1, 6, 2, 5]; // +x, -x, +y, -y, +z, -z
  const dots = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
  const materials = faces.map((n) => {
    const S = 256;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const c = canvas.getContext('2d');
    c.fillStyle = '#F7F2E7';
    c.fillRect(0, 0, S, S);
    const R = n === 1 ? 40 : 24;
    for (const [x, y] of dots[n]) {
      const cx = S * 0.24 + x * S * 0.26;
      const cy = S * 0.24 + y * S * 0.26;
      // Le bord clair du creux, puis le fond sombre, éclairé d'un côté.
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath();
      c.arc(cx + 1.5, cy + 2.5, R + 3, 0, Math.PI * 2);
      c.fill();
      const g = c.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
      if (n === 1) {
        g.addColorStop(0, '#8F0F24');
        g.addColorStop(1, '#D42642');
      } else {
        g.addColorStop(0, '#06070C');
        g.addColorStop(1, '#2A2D3A');
      }
      c.fillStyle = g;
      c.beginPath();
      c.arc(cx, cy, R, 0, Math.PI * 2);
      c.fill();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.32, metalness: 0 });
  });
  return new THREE.Mesh(roundedCube(1.5, 0.3), materials);
}
// Rotation qui met la face voulue sur le dessus.
const DIE_TOP = { 1: [0, 0, 0], 2: [-Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 5: [Math.PI / 2, 0, 0], 6: [Math.PI, 0, 0] };
const DIE_Y = 0.75;

export function createWorld(host, { onTile, onHover, onStep, topInset = () => 70, rightInset = () => 0, onFit }) {
  const startDpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ antialias: startDpr < 2, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  let dpr = startDpr;
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // les ombres ne bougent presque jamais : on les recalcule seulement au besoin
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Le plateau en 3D : 48 cases, 8 pays de 4 villes, chacun avec son drapeau et son monument. La liste des villes est aussi dans le bouton Villes.');

  let firstUpdate = true;
  const reduced = reducedMotion();
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);

  // Une fin de journée : un soleil bas et chaud, des ombres longues et bleutées.
  scene.add(new THREE.HemisphereLight('#CFE6FF', '#7A8FA8', 1.75));
  const sun = new THREE.DirectionalLight('#FFDDB0', 2.9);
  sun.position.set(-14, 30, 12); // assez haut : la lumière reste chaude, et les ombres ne salissent plus les noms
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const b = HALF + 7;
  Object.assign(sun.shadow.camera, { left: -b, right: b, top: b, bottom: -b, near: 1, far: 100 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  sun.shadow.intensity = 0.72;
  scene.add(sun);

  // Le plateau : une grande dalle mate et épaisse, un objet posé là, sur un fond uni.
  const slab = new THREE.Mesh(plateGeometry(HALF * 2 + 1.5, HALF * 2 + 1.5, 0.7, 1.1), new THREE.MeshLambertMaterial({ color: SLAB }));
  slab.position.y = -0.7;
  slab.receiveShadow = true;
  scene.add(slab);

  // ——— Tout le décor en une seule forme : cases, monuments, éléments des pays, mâts ———
  const items = [];
  const baseGeo = { side: plateGeometry(TILE_W - 0.06, TILE_D - 0.06, BASE_H, 0.16), corner: plateGeometry(TILE_D - 0.06, TILE_D - 0.06, BASE_H, 0.16) };
  const hitBoxes = [];
  const parts = TILES.map((t) => {
    const f = tileFrame(t.pos);
    const w = f.corner ? TILE_D : TILE_W;
    const m = placed(f.x, f.z, f.rot);
    const base = paint(f.corner ? baseGeo.corner : baseGeo.side, WARM);
    const color = t.type === 'city' ? `#${softened(REGIONS[t.region].color).getHexString()}` : SPECIAL_COLOR[t.type];
    const plate = paint(plateGeometry(w - 0.34, TILE_D - 0.34, PLATE_H, 0.1), color);
    const front = f.corner ? 0.05 : f.flat ? 0.34 : -0.1;
    const model = t.type === 'city' ? buildMonument(t.model) : buildSpecial(t.type);
    model.rotation.y = -f.rot; // quel que soit le côté du plateau, le monument nous fait face
    fitModel(model, w, front, HEROES[t.model] ?? 1, f.flip, f.corner && f.flip ? BOTTOM_CORNER_H : Infinity);
    const top = new THREE.Box3().setFromObject(model).max.y;
    items.push({ object: base, matrix: m }, { object: plate, matrix: m }, { object: model, matrix: m, ao: PLATE_H });
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
    return { f, w, top, levels, level: 0, rim: null, fill: null, shade: null, badge: null, color: null };
  });

  REGIONS.forEach((reg, r) => {
    const { center, U } = bannerFrame(r);
    const spots = [-3.4, 3.5];
    PROPS_OF[reg.id].forEach((name, i) => {
      const p = center.clone().addScaledVector(U, spots[i]);
      items.push({ object: buildProp(name), matrix: placed(p.x, p.z, Math.atan2(U.x, U.z) + 1.1, 1.05), ao: 0 });
    });
    const pole = new THREE.Group();
    const steel = new THREE.MeshBasicMaterial({ color: '#E7EBF0' });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2.02, 6), steel);
    shaft.position.y = 1.01;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 5), new THREE.MeshBasicMaterial({ color: '#F2C14E' }));
    knob.position.y = 2.06;
    pole.add(shaft, knob);
    const p = flagFoot(r);
    items.push({ object: pole, matrix: placed(p.x, p.z) });
  });

  const world = new THREE.Mesh(bake(items, { fullColor: true }), new THREE.MeshLambertMaterial({ vertexColors: true }));
  world.castShadow = true;
  world.receiveShadow = true;
  world.frustumCulled = false;
  const flags = buildFlags();
  scene.add(world, buildEngraving(), buildBanners(), flags, buildPrint());

  // ——— À qui sont les villes ———
  const tints = new Map();
  const tint = (hex) => {
    if (!tints.has(hex)) tints.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
    return tints.get(hex);
  };
  const shadeMat = new THREE.MeshBasicMaterial({ color: '#39414F', transparent: true, opacity: 0.55, depthWrite: false });
  const rimGeo = { side: plateGeometry(TILE_W - 0.04, TILE_D - 0.04, BASE_H + 0.02, 0.16), corner: plateGeometry(TILE_D - 0.04, TILE_D - 0.04, BASE_H + 0.02, 0.16) };
  const shadeGeo = plateGeometry(TILE_W - 0.34, TILE_D - 0.34, 0.01, 0.1);
  const fillGeo = plateGeometry(TILE_W - 0.34, TILE_D - 0.34, 0.006, 0.1);
  // La case prend la couleur de son propriétaire, assez claire pour que le texte imprimé reste lisible.
  const ownedColor = (hex) => `#${new THREE.Color(hex).lerp(new THREE.Color('#FFFFFF'), 0.34).getHexString()}`;
  const levelGeo = new THREE.BoxGeometry(0.26, 1, 0.26);

  const shots = new Map();
  const PORTRAIT = {
    turn: 0.3,
    place(lens) {
      lens.position.set(0, 0.92, 1.95);
      lens.lookAt(0, 0.74, 0);
    },
  };
  // Le visage du propriétaire, posé sur la case : la couleur n'est pas le seul signe (daltonisme, et on reconnaît son personnage).
  const badgeGeo = new THREE.PlaneGeometry(0.74, 0.74);
  badgeGeo.rotateX(-Math.PI / 2);
  const badgeMats = new Map();
  const badgeMat = (seat) => {
    if (!badgeMats.has(seat)) {
      const image = snapshot(`p${seat}`, () => buildCharacter(seat, PAWN_COLORS[seat]), PORTRAIT);
      const c = document.createElement('canvas');
      c.width = image.width;
      c.height = image.height;
      const g = c.getContext('2d');
      g.fillStyle = PAWN_COLORS[seat];
      g.beginPath();
      g.arc(c.width / 2, c.height / 2, c.width / 2 - 2, 0, Math.PI * 2);
      g.fill();
      const face = document.createElement('canvas');
      face.width = image.width;
      face.height = image.height;
      face.getContext('2d').putImageData(image, 0, 0);
      g.save();
      g.beginPath();
      g.arc(c.width / 2, c.height / 2, c.width / 2 - 2, 0, Math.PI * 2);
      g.clip();
      g.drawImage(face, 0, 0);
      g.restore();
      g.lineWidth = 8;
      g.strokeStyle = '#FFFFFF';
      g.beginPath();
      g.arc(c.width / 2, c.height / 2, c.width / 2 - 5, 0, Math.PI * 2);
      g.stroke();
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      badgeMats.set(seat, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
    }
    return badgeMats.get(seat);
  };
  const setBadge = (part, seat) => {
    if (seat === null) {
      if (part.badge) scene.remove(part.badge);
      part.badge = null;
      return;
    }
    if (!part.badge) {
      part.badge = new THREE.Mesh(badgeGeo);
      // Juste au-dessus du texte, à droite : toujours visible, même devant un monument.
      const f = part.f;
      const inward = f.flat ? 0 : -Math.sign(f.x) * 0.62;
      part.badge.position.set(f.x + (f.flat ? 0.62 : inward + 0.34), PLATE_H + 0.03, f.z + (f.flat ? 0.34 : -0.62));
      part.badge.renderOrder = 4;
      scene.add(part.badge);
    }
    part.badge.material = badgeMat(seat);
  };

  const setOwner = (part, color, mortgaged, seat = null) => {
    if (part.color !== color) {
      part.color = color;
      if (color && !part.rim) {
        part.rim = new THREE.Mesh(part.f.corner ? rimGeo.corner : rimGeo.side, tint(color));
        part.rim.position.set(part.f.x, 0, part.f.z);
        part.rim.rotation.y = part.f.rot;
        scene.add(part.rim);
        if (!firstUpdate) celebrate(part.f.x, part.f.z, color, part.rim);
      } else if (color) {
        part.rim.material = tint(color);
      } else if (part.rim) {
        scene.remove(part.rim);
        part.rim = null;
      }
      if (color && !part.fill) {
        part.fill = new THREE.Mesh(fillGeo, tint(ownedColor(color)));
        part.fill.position.set(part.f.x, PLATE_H + 0.001, part.f.z);
        part.fill.rotation.y = part.f.rot;
        part.fill.receiveShadow = true;
        scene.add(part.fill);
      } else if (color) {
        part.fill.material = tint(ownedColor(color));
      } else if (part.fill) {
        scene.remove(part.fill);
        part.fill = null;
      }
      part.levels.children.forEach((m) => { if (color) m.material = tint(color); });
    }
    setBadge(part, seat);
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
  // Une petite fête : le cadre rebondit, des confettis partent de la case.
  const pops = [];
  const bursts = [];
  function celebrate(x, z, color, mesh) {
    if (mesh) pops.push({ mesh, t: 0 });
    if (reduced) return;
    const N = 46;
    const pos = new Float32Array(N * 3);
    const vel = [];
    for (let i = 0; i < N; i += 1) {
      pos.set([x, 0.6, z], i * 3);
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 3.5;
      vel.push([Math.cos(a) * s, 6 + Math.random() * 6, Math.sin(a) * s]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.32, toneMapped: false }));
    pts.frustumCulled = false;
    scene.add(pts);
    bursts.push({ pts, vel, t: 0 });
  }

  const LEVEL_SPOTS = [[-0.68, -1.15], [0.68, -1.15], [-0.68, -0.72], [0.68, -0.72]];
  const setLevels = (part, level, color) => {
    if (part.level === level) return false;
    part.level = level;
    part.levels.clear();
    for (let i = 0; i < level; i += 1) {
      const h = 0.42 + i * 0.16;
      const m = new THREE.Mesh(levelGeo, tint(color ?? '#FFFFFF'));
      m.scale.y = h;
      m.position.set(LEVEL_SPOTS[i][0], PLATE_H + h / 2, LEVEL_SPOTS[i][1] * (part.f.flip ? -1 : 1));
      m.castShadow = true;
      part.levels.add(m);
    }
    if (!firstUpdate && level > 0) pops.push({ mesh: part.rim, t: 0 });
    return true;
  };

  // ——— Le repère de la ville en jeu ———
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.95, 4), new THREE.MeshBasicMaterial({ color: '#FFC93C', toneMapped: false }));
  marker.rotation.x = Math.PI;
  marker.visible = false;
  scene.add(marker);
  let markerBase = 4;

  // ——— Le festival : un repère au-dessus de la ville ———
  const festivalMark = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 4), new THREE.MeshLambertMaterial({ color: '#FF2E93' }));
  festivalMark.rotation.x = Math.PI;
  festivalMark.visible = false;
  scene.add(festivalMark);

  // ——— Les personnages : ils marchent sur le sol, le long du bord intérieur, pour ne jamais cacher le texte ———
  const personMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const blobGeo = new THREE.CircleGeometry(0.4, 16);
  blobGeo.rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ color: '#05060A', transparent: true, opacity: 0.42, depthWrite: false });
  // Le joueur qui joue : une pastille lumineuse à ses pieds, et son nom en bulle au-dessus de sa tête.
  const ring = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const c = canvas.getContext('2d');
    const g = c.createRadialGradient(128, 128, 30, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,214,102,0.95)');
    g.addColorStop(0.62, 'rgba(255,201,60,0.55)');
    g.addColorStop(0.72, 'rgba(255,240,190,1)');
    g.addColorStop(0.8, 'rgba(255,201,60,0.6)');
    g.addColorStop(1, 'rgba(255,201,60,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.03;
    m.renderOrder = 3;
    scene.add(m);
    return m;
  })();
  const bubbleCanvas = document.createElement('canvas');
  bubbleCanvas.width = 512;
  bubbleCanvas.height = 148;
  const bubbleTexture = new THREE.CanvasTexture(bubbleCanvas);
  bubbleTexture.colorSpace = THREE.SRGBColorSpace;
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  bubble.renderOrder = 6;
  scene.add(bubble);
  let bubbleName = null;
  const drawBubble = (name, color) => {
    if (bubbleName === `${name}|${color}`) return;
    bubbleName = `${name}|${color}`;
    const c = bubbleCanvas.getContext('2d');
    c.clearRect(0, 0, 512, 148);
    let size = 70;
    do {
      c.font = `800 ${size}px "ES Barlow", system-ui, sans-serif`;
      size -= 2;
    } while (c.measureText(name).width > 430 && size > 28);
    const w = Math.min(500, c.measureText(name).width + 56);
    const x = 256 - w / 2;
    c.fillStyle = '#FFFDF8';
    c.beginPath();
    c.roundRect(x, 8, w, 100, 30);
    c.fill();
    c.beginPath();
    c.moveTo(232, 104);
    c.lineTo(280, 104);
    c.lineTo(256, 140);
    c.closePath();
    c.fill();
    c.fillStyle = color;
    c.fillRect(x + 24, 92, w - 48, 7);
    c.fillStyle = INK;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(name, 256, 54);
    bubbleTexture.needsUpdate = true;
  };
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
  const diceShadows = dice.map(() => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1.05, 20), blobMat);
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    scene.add(m);
    return m;
  });
  // Sur leur piste, en haut de la zone centrale.
  const placeDice = () => {
    dice[0].position.set(-1.15, DIE_Y, DICE_Z - 0.2);
    dice[1].position.set(1.15, DIE_Y, DICE_Z + 0.2);
    dice.forEach((d, i) => diceShadows[i].position.set(d.position.x + 0.28, 0.015, d.position.z - 0.12));
  };
  // Avant le premier lancer aussi, ils attendent sur leur piste.
  dice.forEach((d, i) => { d.rotation.set(...DIE_TOP[[3, 4][i]]); diceShadows[i].visible = true; scene.add(d); });
  let diceAnim = null;
  let lastRollN = -1;

  // ——— La caméra : une vue fixe, sans perspective. Le plateau reste un rectangle, toutes les cases ont la même taille ———
  const PITCH = 0.85; // l'inclinaison : assez plongeante pour tout lire, assez basse pour voir les monuments debout
  let size = { w: 0, h: 0 };
  camera.position.set(0, Math.sin(PITCH) * 150, Math.cos(PITCH) * 150);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);

  // Cadre tout le plateau dans la place libre de l'écran : sous les joueurs et au-dessus de la carte d'action sur téléphone.
  function computeFit() {
    const v = new THREE.Vector3();
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    const edge = HALF + 0.75;
    for (const x of [-edge, edge]) {
      for (const z of [-edge, edge]) {
        for (const y of [-0.7, z < 0 ? 3.4 : 1.5]) { // le haut des grands monuments du fond doit rester visible
          v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
          x0 = Math.min(x0, v.x);
          x1 = Math.max(x1, v.x);
          y0 = Math.min(y0, v.y);
          y1 = Math.max(y1, v.y);
        }
      }
    }
    const narrow = size.w < size.h;
    const top = narrow ? topInset() : 4;
    const bottom = narrow ? 150 : 4;
    const side = narrow ? 4 : 8;
    const right = narrow ? side : side + rightInset(); // sur ordinateur, la colonne des joueurs garde sa place à droite
    const scale = Math.min((size.w - side - right) / (x1 - x0), Math.max(60, size.h - top - bottom) / (y1 - y0));
    const midX = (x0 + x1) / 2;
    const midY = (y0 + y1) / 2;
    // Le milieu du plateau, en pixels depuis le haut. Sur téléphone, il se cale sous les joueurs : le vide éventuel reste en bas, derrière la carte d'action.
    const screenY = narrow ? top + ((y1 - y0) * scale) / 2 : (top + size.h - bottom) / 2;
    const screenX = (side + size.w - right) / 2;
    camera.left = midX - screenX / scale;
    camera.right = midX + (size.w - screenX) / scale;
    camera.top = midY + screenY / scale;
    camera.bottom = midY - (size.h - screenY) / scale;
    camera.updateProjectionMatrix();
    // L'interface se cale sur le plateau : le milieu de la zone centrale, et le bas de cette zone pour la ligne de ce qui vient de se passer.
    const onScreen = (z) => {
      v.set(0, 0, z).project(camera);
      return [((v.x + 1) / 2) * size.w, ((1 - v.y) / 2) * size.h];
    };
    onFit?.(onScreen(0.4), onScreen(5.1));
  }

  // ——— La boucle : elle ne tourne que quand quelque chose bouge ———
  let raf = 0;
  let last = 0;
  const quality = { frames: 0, total: 0, step: 0 };

  function lowerQuality() {
    quality.step += 1;
    if (quality.step === 1 && dpr > 1) {
      dpr = Math.max(1, dpr - 0.5);
      renderer.setPixelRatio(dpr);
      renderer.setSize(size.w, size.h, false);
    } else if (quality.step === 2) {
      sun.castShadow = false;
      scene.traverse((o) => { if (o.material && !Array.isArray(o.material)) o.material.needsUpdate = true; });
    } else if (quality.step === 3 && dpr > 0.75) {
      dpr = 0.75;
      renderer.setPixelRatio(dpr);
      renderer.setSize(size.w, size.h, false);
    }
  }

  let view = null;
  let lifeTimer = 0;
  const lifeOn = () => !reduced && quality.step < 2;

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
          onStep?.();
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
      const narrow = size.w < size.h;
      bubble.visible = !view.over;
      bubble.scale.set(narrow ? 6.4 : 4.2, narrow ? 1.85 : 1.21, 1);
      bubble.position.set(curPawn.mesh.position.x, curPawn.mesh.position.y + PAWN_SCALE * 1.2 + (narrow ? 1 : 0.65), curPawn.mesh.position.z);
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

    for (let i = pops.length - 1; i >= 0; i -= 1) {
      const p = pops[i];
      p.t = Math.min(1, p.t + dt / 0.42);
      const s = 1 + Math.sin(p.t * Math.PI) * 0.16 * (1 - p.t * 0.4);
      p.mesh?.scale.set(s, 1, s);
      busy = true;
      if (p.t >= 1) {
        p.mesh?.scale.set(1, 1, 1);
        pops.splice(i, 1);
      }
    }
    for (let i = bursts.length - 1; i >= 0; i -= 1) {
      const b2 = bursts[i];
      b2.t += dt;
      const attr = b2.pts.geometry.attributes.position;
      b2.vel.forEach((vl, n) => {
        vl[1] -= 16 * dt;
        attr.setXYZ(n, attr.getX(n) + vl[0] * dt, Math.max(0.02, attr.getY(n) + vl[1] * dt), attr.getZ(n) + vl[2] * dt);
      });
      attr.needsUpdate = true;
      busy = true;
      if (b2.t > 1.1) {
        scene.remove(b2.pts);
        b2.pts.geometry.dispose();
        b2.pts.material.dispose();
        bursts.splice(i, 1);
      }
    }

    // Le monde vit doucement : les drapeaux flottent, les bateaux avancent, le repère rebondit.
    if (lifeOn()) {
      const time = now / 1000;
      if (ring.visible) {
        const pulse = 1 + Math.sin(time * 3.4) * 0.07;
        ring.scale.set(pulse, pulse, 1);
      }
      if (marker.visible) {
        marker.position.y = markerBase + Math.abs(Math.sin(time * 3)) * 0.42;
        marker.rotation.y = time * 1.2;
      }
      flags.userData.time.value = time;
    }

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
    if (busy) wake();
    else if (lifeOn() && !lifeTimer) { // au repos, une image de temps en temps suffit : la machine reste tranquille
      lifeTimer = setTimeout(() => {
        lifeTimer = 0;
        wake();
      }, 45);
    }
  }
  function wake() {
    if (raf) return;
    if (!last || performance.now() - last > 100) last = performance.now() - 16;
    raf = requestAnimationFrame(tick);
  }

  // ——— Toucher une case, la survoler à la souris ———
  const raycaster = new THREE.Raycaster();
  const tileAt = (e) => {
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    return raycaster.intersectObjects(hitBoxes, false)[0]?.object.userData.pos ?? null;
  };
  let downAt = null;
  const onDown = (e) => { downAt = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    const start = downAt;
    downAt = null;
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) return;
    const pos = tileAt(e);
    if (pos !== null) onTile(pos);
  };
  // On regarde au plus toutes les 70 ms.
  let hoverAt = 0;
  const onMove = (e) => {
    if (!onHover || e.pointerType !== 'mouse') return;
    const now = performance.now();
    if (now - hoverAt < 70) return;
    hoverAt = now;
    const r = canvas.getBoundingClientRect();
    onHover(tileAt(e), e.clientX - r.left, e.clientY - r.top);
  };
  const onLeave = () => onHover?.(null);
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
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointerup', onUp);
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
    computeFit();
    placeDice();
    wake();
  });

  // ——— Mettre le monde à jour avec l'état de la partie ———
  let wasOver = false;
  function update(v) {
    view = v;
    let shadows = false;

    TILES.forEach((t) => {
      const part = parts[t.pos];
      const prop = v.props[t.pos];
      const owner = prop ? v.players.find((p) => p.id === prop.owner) : null;
      const color = owner ? PAWN_COLORS[owner.seat] : null;
      setOwner(part, color, Boolean(prop?.mortgaged), owner ? owner.seat : null);
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

    const playing = v.players[v.cur];
    if (playing && !v.over) drawBubble(playing.pseudo, PAWN_COLORS[playing.seat]);

    if (v.dice && v.rollN !== lastRollN) {
      const initial = lastRollN === -1;
      lastRollN = v.rollN;
      dice.forEach((d, i) => {
        d.visible = true;
        diceShadows[i].visible = true;
        d.rotation.set(...DIE_TOP[v.dice[i]]);
        d.position.y = DIE_Y;
      });
      if (!initial && !reduced) diceAnim = { t: 0, values: v.dice.slice() };
    }

    if (firstUpdate && size.w) computeFit(); // la place prise par les joueurs est connue maintenant
    // Le repère montre la ville à acheter.
    const at = !v.over && v.phase === 'buy' ? v.players[v.cur]?.pos : null;
    if (at === null || at === undefined) marker.visible = false;
    else {
      const f = tileFrame(at);
      marker.position.set(f.x, 0, f.z);
      markerBase = parts[at].top + 0.75;
      marker.position.y = markerBase;
      marker.visible = true;
    }
    if (v.over && !wasOver) {
      wasOver = true;
      dice.forEach((d, i) => { d.visible = false; diceShadows[i].visible = false; });
      for (const id of v.winners) { // le gagnant saute de joie
        const pawn = pawns.get(id);
        if (pawn && !reduced) for (let i = 0; i < 6; i += 1) pawn.queue.push({ pos: pawn.goal, jump: 0.9 });
      }
      if (!firstUpdate) for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9], [0, -7]]) celebrate(x, z, PAWN_COLORS[Math.floor(Math.random() * 10)]);
    }
    if (shadows || firstUpdate) renderer.shadowMap.needsUpdate = true;
    firstUpdate = false;
    wake();
  }
  renderer.shadowMap.needsUpdate = true;
  ro.observe(host);
  // Tout préparer dès le chargement : le premier lancer de dés ne doit pas faire saccader le jeu.
  renderer.compile(scene, camera);

  // ——— De petites images rendues une seule fois : le portrait d'un voyageur, le monument d'une ville ———
  function snapshot(key, build, frame) {
    if (shots.has(key)) return shots.get(key);
    const S = 192;
    const stage2 = new THREE.Scene();
    stage2.add(new THREE.HemisphereLight('#FFFFFF', '#BAC4D4', 1.9));
    const light = new THREE.DirectionalLight('#FFE9CF', 2.3);
    light.position.set(-3, 6, 5);
    stage2.add(light);
    const object = build();
    const mesh = new THREE.Mesh(bake([{ object }], { fullColor: true }), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.rotation.y = frame.turn ?? 0.45;
    stage2.add(mesh);
    const lens = new THREE.PerspectiveCamera(24, 1, 0.05, 100);
    frame.place(lens, mesh);
    const target = new THREE.WebGLRenderTarget(S, S, { samples: 4 });
    const clear = renderer.getClearAlpha();
    renderer.setClearAlpha(0);
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(stage2, lens);
    const raw = new Uint8Array(S * S * 4);
    renderer.readRenderTargetPixels(target, 0, 0, S, S, raw);
    renderer.setRenderTarget(null);
    renderer.setClearAlpha(clear);
    // Une cible de rendu reste en valeurs linéaires : on repasse en couleurs d'écran, et on remet l'image à l'endroit.
    const out = new ImageData(S, S);
    const gamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255;
    for (let y = 0; y < S; y += 1) {
      for (let x = 0; x < S; x += 1) {
        const from = ((S - 1 - y) * S + x) * 4;
        const to = (y * S + x) * 4;
        const a2 = raw[from + 3] / 255;
        for (let k = 0; k < 3; k += 1) out.data[to + k] = a2 ? gamma(raw[from + k] / 255 / a2) : 0;
        out.data[to + 3] = raw[from + 3];
      }
    }
    target.dispose();
    mesh.geometry.dispose();
    mesh.material.dispose();
    shots.set(key, out);
    return out;
  }

  return {
    update,
    // Le visage d'un voyageur, de près.
    portrait: (seat) => snapshot(`p${seat}`, () => buildCharacter(seat, PAWN_COLORS[seat]), PORTRAIT),
    // Le monument entier d'une ville.
    monument: (pos) => snapshot(`m${pos}`, () => (TILES[pos].type === 'city' ? buildMonument(TILES[pos].model) : buildSpecial(TILES[pos].type)), {
      turn: 0.55,
      place(lens, mesh) {
        const box = new THREE.Box3().setFromObject(mesh);
        const c = box.getCenter(new THREE.Vector3());
        const sz = box.getSize(new THREE.Vector3());
        const d = (Math.max(sz.x, sz.y, sz.z) * 1.12) / (2 * Math.tan(THREE.MathUtils.degToRad(12)));
        lens.position.set(c.x, c.y + d * 0.42, c.z + d * 0.91);
        lens.lookAt(c);
      },
    }),
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(lifeTimer);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerup', onUp);
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
