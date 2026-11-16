// Le monde d'Escales : un plateau posé sur un fond uni, entier d'un seul coup d'œil. Chaque pays a sa couleur, son drapeau, son motif
// au sol et ses éléments ; un cadre de la couleur du joueur montre à qui appartient une ville.
// Pour rester fluide : le décor est fondu en une seule forme, les ombres sont calculées une fois, et rien n'est redessiné tant que rien ne bouge.
// Ce fichier ne connaît pas les règles : il reçoit l'état avec update(view) et signale les cases touchées avec onTile(pos).
// Le ?v= (révision de three) permet au serveur de garder ce fichier un an chez l'élève. Changer de version de three : changer ?v= ici, dans monuments.js et dans les deux imports de three.module.js.
import * as THREE from './three/three.module.js?v=r186';
import { REGIONS, TILES } from './board.js';
import { buildMonument, buildSpecial, buildCharacter, buildProp, bake } from './monuments.js';
import { FLAGS, PATTERNS, PROPS_OF } from './countries.js';

// Les 10 couleurs des joueurs.
export const PAWN_COLORS = ['#E5213C', '#FF8A00', '#F5D000', '#16A34A', '#0891B2', '#2563EB', '#7C3AED', '#DB2777', '#92602F', '#475569'];

const WARM = '#FFFFFF';
const cssColor = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; // les palettes sont dans app.css
const INK = '#12151F';
const TILE_W = 2; // largeur d'une case le long du côté
const TILE_D = 3; // profondeur
const BASE_H = 0.1; // le socle blanc, ou le cadre du propriétaire
const PLATE_H = 0.16;
const HALF = (11 * TILE_W + 2 * TILE_D) / 2;
const BANNER_D = 1.8;
const BANNER_H = 0.1; // les bandeaux sont des plaques en relief
const DICE_Z = -7.15; // la piste des dés, en haut de la zone centrale
const BOTTOM_LIFT = 1.2; // les bandeaux du bas remontent : les monuments de la rangée du bas, debout devant eux, ne cachent plus leur nom
const BANNER_PX = { w: 1024, h: 230, flagW: 120, flagH: 80, gap: 26 }; // l'image d'un bandeau, en pixels
const NAME_MARGIN = 0.06; // l'air laissé autour du nom d'un pays, sur le plateau
const PITCH = 0.85; // l'inclinaison de la caméra : assez plongeante pour tout lire, assez basse pour voir les monuments debout
const MONUMENTS_RISE_S = 0.7; // les monuments sortent de leur case en arrivant
const PAWN_SCALE = Math.min(window.innerWidth, window.innerHeight) < 520 ? 2 : 1.75; // tient sur sa case ; un peu plus grand sur téléphone, où tout est petit

const SIDE_BACK = 0.18;
const SIDE_H = 1.85; // sur les côtés, les cases se suivent de haut en bas : au-delà, les monuments se marchent dessus
const SIDE_HEROES = { eiffel: 3.1, empire: 2.6, gratteCiel2: 2.5 }; // sauf ceux qu'on doit reconnaître de loin
const BOTTOM_CORNER_H = 1.7; // au-delà, ce qui est posé sur un coin du bas cacherait le nom de la ville juste derrière
const SPECIAL_COLOR = { start: '#34D399', customs: '#60A5FA', festival: '#F472B6', control: '#FB7185', escale: '#CBD5E1', telex: '#FBBF24', tax: '#F59E0B', chantier: '#94A3B8' };
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
function fitModel(model, w, front, hero = 1, flip = false, maxH = Infinity, overflow = 0.35) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const room = TILE_D / 2 + front + overflow; // en haut et en bas, le monument peut déborder vers l'extérieur du plateau
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

// L'étiquette d'une case : sa place et sa taille, à plat sur la case.
function labelFrame(f) {
  const topCorner = f.corner && !f.flip; // coins du haut : le nom se range côté centre, le monument de la case devant monte côté extérieur
  const w = topCorner ? 1.55 : f.corner ? 2.5 : f.flat ? 1.68 : 1.42;
  const h = w / 2;
  const z = f.corner ? 0.82 : TILE_D / 2 - 0.2 - (f.flat ? h / 2 : w / 2 - 0.2);
  const center = new THREE.Vector3(topCorner ? -Math.sign(f.x) * 0.62 : 0, PLATE_H + 0.012, f.flip ? -z : z).applyMatrix4(placed(f.x, f.z, f.rot));
  return { w, h, center };
}

// Tous les textes des cases sur une seule image : le nom, le petit drapeau et le prix. Toujours lisibles depuis la caméra.
function buildPrint(focusU) {
  const COLS = 6;
  const ROWS = 8;
  const CW = 340;
  const CH = 170;
  // Sur téléphone, une case fait moins de 30 px : le prix y serait illisible, il reste dans la fiche, et le nom prend toute la place.
  const NAMES_ONLY = Math.min(window.innerWidth, window.innerHeight) < 520;
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CW;
  canvas.height = ROWS * CH;
  const c = canvas.getContext('2d');
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const pos = [];
  const uv = [];
  const tiles = [];
  for (const t of TILES) {
    const col = t.pos % COLS;
    const row = Math.floor(t.pos / COLS);
    const cx = col * CW + CW / 2;
    const cy = row * CH + CH / 2;
    const name = t.short ?? t.name;
    // L'étiquette crème : le nom et le prix se lisent quelle que soit la couleur de la case.
    const LW = CW - 26;
    const nameOnly = !t.price || NAMES_ONLY;
    const LH = t.price ? CH - 24 : 92;
    const lx = cx - LW / 2;
    c.fillStyle = '#FFFFFF';
    c.beginPath();
    c.roundRect(lx, cy - LH / 2, LW, LH, 20);
    c.fill();
    c.strokeStyle = 'rgba(18,21,31,0.2)';
    c.lineWidth = 2;
    c.stroke();
    // La couleur du pays, franche, sur l'étiquette de chaque ville : on reconnaît d'un coup d'œil à quel pays elle appartient.
    // À l'ordinateur, une bande en haut ; sur téléphone, où le nom prend toute l'étiquette, un cadre épais.
    const isCity = t.type === 'city';
    const banded = isCity && !NAMES_ONLY;
    const BAND = 34;
    if (isCity) {
      const tone = REGIONS[t.region].color;
      c.save();
      c.beginPath();
      c.roundRect(lx, cy - LH / 2, LW, LH, 20);
      c.clip();
      if (banded) {
        c.fillStyle = tone;
        c.fillRect(lx, cy - LH / 2, LW, BAND);
        c.fillStyle = 'rgba(18,21,31,0.25)';
        c.fillRect(lx, cy - LH / 2 + BAND - 3, LW, 3);
      } else {
        c.strokeStyle = tone;
        c.lineWidth = 28;
        c.stroke();
      }
      c.restore();
    }
    const fontAt = (px) => `800 ${px}px "ES Barlow", system-ui, sans-serif`;
    const fits = (text, px) => {
      c.font = fontAt(px);
      return c.measureText(text).width <= CW - (NAMES_ONLY ? (isCity ? 60 : 40) : 48);
    };
    let size = t.price && NAMES_ONLY ? 124 : banded ? 60 : 72;
    while (!fits(name, size) && size > 28) size -= 2;
    // Sur téléphone, un nom en deux mots passe sur deux lignes s'il y gagne en taille : « San / Francisco ».
    let lines = [name];
    if (t.price && NAMES_ONLY) {
      for (const at of [...name.matchAll(/[ -]/g)].map((m) => m.index)) {
        const pair = [name.slice(0, at + (name[at] === '-' ? 1 : 0)), name.slice(at + 1)];
        let px = 72;
        while (!(fits(pair[0], px) && fits(pair[1], px)) && px > 28) px -= 2;
        if (px > size) {
          size = px;
          lines = pair;
        }
      }
    }
    c.font = fontAt(size);
    c.fillStyle = INK;
    c.textAlign = 'center';
    if (lines.length === 2) {
      c.fillText(lines[0], cx, cy + 3 - size * 0.5);
      c.fillText(lines[1], cx, cy + 3 + size * 0.5);
    } else {
      c.fillText(name, cx, nameOnly ? cy + 3 : banded ? cy - 8 : cy - 32);
    }
    if (!nameOnly) {
      // Le prix à gauche : à droite, la place est gardée pour le visage du propriétaire.
      const label = `${t.price.toLocaleString('fr-FR').replace(/\u202f/g, '\u00a0')} €`;
      c.font = '700 50px "ES Barlow", system-ui, sans-serif';
      c.textAlign = 'left';
      let x = lx + 14;
      const rowY = banded ? cy + 24 : cy + 14; // sous la bande, la ligne du prix descend un peu
      if (isCity) {
        FLAGS[REGIONS[t.region].id](c, x, rowY, 63, 42);
        c.strokeStyle = 'rgba(18,21,31,0.55)';
        c.lineWidth = 2;
        c.strokeRect(x, rowY, 63, 42);
        x += 75;
      }
      c.fillStyle = INK;
      c.fillText(label, x, rowY + 23);
      c.textAlign = 'center';
    }
    const f = tileFrame(t.pos);
    const { w, h, center } = labelFrame(f);
    pushQuad(pos, uv, center, new THREE.Vector3(w / 2, 0, 0), new THREE.Vector3(0, 0, -h / 2), [col / COLS, 1 - (row + 1) / ROWS, (col + 1) / COLS, 1 - row / ROWS]);
    for (let n = 0; n < 6; n += 1) tiles.push(t.pos);
  }
  const m = flatMesh(pos, uv, canvas);
  m.geometry.setAttribute('tile', new THREE.Float32BufferAttribute(tiles, 1));
  m.material.onBeforeCompile = (shader) => {
    shader.uniforms.uLift = focusU.lift;
    shader.uniforms.uDim = focusU.dim;
    shader.vertexShader = `attribute float tile;\nuniform float uLift[49];\nuniform float uDim[49];\nvarying float vDim;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.y += uLift[int(tile)];
      vDim = uDim[int(tile)];`);
    shader.fragmentShader = `varying float vDim;\n${shader.fragmentShader}`.replace('#include <map_fragment>', '#include <map_fragment>\n      diffuseColor.rgb *= max(vDim, 0.6);');
  };
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

// La place du nom sur l'image du bandeau : les noms longs rétrécissent, le drapeau et les décors posés aux deux bouts restent libres.
// Laisse la police réglée sur la taille retenue.
function bannerTitle(c, name) {
  let titlePx = 98;
  do {
    c.font = `800 ${titlePx}px "ES Titres", system-ui, sans-serif`;
    titlePx -= 2;
  } while (c.measureText(name).width > BANNER_PX.w * 0.42 && titlePx > 50);
  c.textBaseline = 'middle';
  const m = c.measureText(name);
  const total = BANNER_PX.flagW + BANNER_PX.gap + m.width;
  return { total, x0: (BANNER_PX.w - total) / 2, descent: m.actualBoundingBoxDescent };
}

// Sur le plateau, la bande occupée par le drapeau et le nom d'un bandeau du bas : de x0 à x1, et son bord côté caméra (front).
function nameSpan(r) {
  const { total, x0, descent } = bannerTitle(document.createElement('canvas').getContext('2d'), REGIONS[r].name);
  const { center } = bannerFrame(r);
  const x = (px) => center.x - 3.98 + (px / BANNER_PX.w) * 7.96;
  return { x0: x(x0), x1: x(x0 + total), front: center.z - BANNER_D / 2 + ((BANNER_PX.h / 2 + 5 + descent) / BANNER_PX.h) * BANNER_D };
}

// Rangée du bas : vu depuis la caméra, un grand monument debout devant le bandeau de son pays peut mordre sur le nom écrit derrière.
// Il rapetisse alors juste ce qu'il faut, jamais sous 60 %, pour que le nom reste entier. fit(k) replace le monument à k fois sa taille.
function clearNames(model, matrix, fit, spans) {
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const one = new THREE.Matrix4();
  const slope = Math.tan(PITCH);
  const hides = () => {
    model.updateMatrixWorld(true);
    let hit = false;
    model.traverse((o) => {
      if (hit || !o.isMesh) return;
      const p = o.geometry.attributes.position;
      for (let n = 0; n < (o.isInstancedMesh ? o.count : 1) && !hit; n += 1) {
        if (o.isInstancedMesh) o.getMatrixAt(n, one);
        m.multiplyMatrices(matrix, o.matrixWorld);
        if (o.isInstancedMesh) m.multiply(one);
        for (let i = 0; i < p.count && !hit; i += 1) {
          v.fromBufferAttribute(p, i).applyMatrix4(m);
          const ground = v.z - (v.y - BANNER_H) / slope; // le point du sol que ce sommet cache, vu depuis la caméra
          hit = spans.some((s) => v.x > s.x0 - NAME_MARGIN && v.x < s.x1 + NAME_MARGIN && ground < s.front + NAME_MARGIN);
        }
      }
    });
    return hit;
  };
  if (!hides()) return;
  let [lo, hi] = [0.6, 1];
  for (let i = 0; i < 7; i += 1) {
    const k = (lo + hi) / 2;
    fit(k);
    if (hides()) hi = k;
    else lo = k;
  }
  fit(lo);
}

// Les bandeaux au sol : la couleur du pays, son motif, son drapeau et son nom.
function buildBanners() {
  const W = BANNER_PX.w;
  const H = BANNER_PX.h;
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
    const { total, x0 } = bannerTitle(c, reg.name);
    const fw = BANNER_PX.flagW;
    const fh = BANNER_PX.flagH;
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
    pushQuad(pos, uv, center.clone().setY(BANNER_H + 0.006), U.clone().multiplyScalar(3.98), V.clone().multiplyScalar(BANNER_D / 2), [0, 1 - (r + 1) / n, 1, 1 - r / n]);
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

// Ce qui est dessiné sur la dalle : la zone centrale et la piste des dés. Net et sans ornement.
function buildEngraving() {
  // Deux aplats aux bords nets : sur un écran de téléphone (plateau d'environ 800 pixels), 1024 donne la même image que 2048 pour quatre fois moins de mémoire.
  const SIZE = Math.min(innerWidth, innerHeight) * Math.min(devicePixelRatio || 1, 2) <= 900 ? 1024 : 2048;
  const WORLD = HALF * 2 + 1.5;
  const px = SIZE / WORLD;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const c = canvas.getContext('2d');
  const at = (u) => SIZE / 2 + u * px;
  const inner = HALF - TILE_D - BANNER_D - 0.32;
  c.fillStyle = cssColor('--es-zone', '#171B24');
  c.beginPath();
  c.roundRect(at(-inner), at(-inner), inner * 2 * px, (inner * 2 - BOTTOM_LIFT) * px, 0.7 * px);
  c.fill();
  c.fillStyle = cssColor('--es-tray', '#111418');
  c.beginPath();
  c.roundRect(at(-3.1), at(DICE_Z - 1.45), 6.2 * px, 2.9 * px, 1.45 * px);
  c.fill();
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.006;
  m.renderOrder = 0;
  return m;
}

// Une ombre douce sous la dalle : le plateau est posé sur la carte, il ne flotte pas.
function groundShadow() {
  const SIZE = 256;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const c = canvas.getContext('2d');
  c.shadowColor = 'rgba(0,0,0,0.75)'; // shadowBlur plutôt que filter : Safari ne connaît pas toujours filter sur un canvas
  c.shadowBlur = 24;
  c.fillStyle = 'rgba(0,0,0,0.6)';
  c.beginPath();
  c.roundRect(28, 30, SIZE - 56, SIZE - 52, 18);
  c.fill();
  const WORLD = HALF * 2 + 7;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.75;
  m.renderOrder = -1;
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

// lookOf(seat) : le personnage créé par le joueur assis à cette place (ou null : le voyageur de la place).
export function createWorld(host, { onTile, onHover, onStep, topInset = () => 70, rightInset = () => 0, onFit, onStill, lookOf = () => null }) {
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
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#3F3F5C', 1.9));
  const sun = new THREE.DirectionalLight('#FFF1DE', 2.9);
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
  const slab = new THREE.Mesh(plateGeometry(HALF * 2 + 1.5, HALF * 2 + 1.5, 0.7, 1.1), new THREE.MeshLambertMaterial({ color: cssColor('--es-slab', '#1F2430') }));
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
    const color = t.type === 'city' ? `#${softened(REGIONS[t.region].color, 0.1).getHexString()}` : SPECIAL_COLOR[t.type];
    const base = paint(f.corner ? baseGeo.corner : baseGeo.side, `#${new THREE.Color(color).multiplyScalar(0.62).getHexString()}`); // le socle, d'un ton plus foncé : la case a de l'épaisseur
    const plate = paint(plateGeometry(w - 0.34, TILE_D - 0.34, PLATE_H, 0.1), color);
    items.push({ object: base, matrix: m, tile: t.pos, lift: true }, { object: plate, matrix: m, tile: t.pos, lift: true });
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
    return { f, w, top: PLATE_H, levels, level: 0, rim: null, fill: null, shade: null, badge: null, color: null };
  });

  REGIONS.forEach((reg, r) => {
    const { center, U } = bannerFrame(r);
    const edge = new THREE.Color(reg.color).multiplyScalar(0.55);
    items.push({ object: paint(plateGeometry(8.06, BANNER_D + 0.1, BANNER_H, 0.17), `#${edge.getHexString()}`), matrix: placed(center.x, center.z, Math.abs(U.z) > 0.5 ? Math.PI / 2 : 0) });
    const spots = [-3.4, 3.5];
    PROPS_OF[reg.id].forEach((name, i) => {
      const p = center.clone().addScaledVector(U, spots[i]);
      // En haut du plateau, le décor passe devant les noms de la rangée du dessus : il reste petit.
      items.push({ object: buildProp(name), matrix: placed(p.x, p.z, Math.atan2(U.x, U.z) + 1.1, r < 2 ? 0.6 : 1.05).setPosition(p.x, BANNER_H, p.z), ao: BANNER_H });
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
  // Les monuments sont fondus en une seule forme : c'est le shader qui soulève ceux d'une case et qui assombrit les autres, sans redessiner plus.
  const focusU = { lift: { value: new Float32Array(49) }, dim: { value: new Float32Array(49).fill(1) } };
  const focusTo = { lift: new Float32Array(49), dim: new Float32Array(49).fill(1) };
  world.material.onBeforeCompile = (shader) => {
    shader.uniforms.uLift = focusU.lift;
    shader.uniforms.uDim = focusU.dim;
    shader.vertexShader = `attribute vec2 tileInfo;\nuniform float uLift[49];\nuniform float uDim[49];\nvarying float vDim;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      transformed.y += tileInfo.y * uLift[int(tileInfo.x)];
      vDim = uDim[int(tileInfo.x)];`,
    );
    shader.fragmentShader = `varying float vDim;\n${shader.fragmentShader}`.replace('#include <color_fragment>', '#include <color_fragment>\n      diffuseColor.rgb *= vDim;');
  };
  world.castShadow = true;
  world.receiveShadow = true;
  world.frustumCulled = false;
  const flags = buildFlags();
  scene.add(groundShadow(), world, buildEngraving(), buildBanners(), flags, buildPrint(focusU));

  // ——— Les monuments : une seconde forme, prête dès que les fichiers sculptés sont là (showMonuments) ———
  // Le plateau s'affiche sans les attendre ; ils sortent ensuite de leur case, d'un seul mouvement.
  const spans = REGIONS.map((reg, r) => r).filter((r) => Math.floor(r / 2) === 2).map(nameSpan);
  function monumentItems() {
    return TILES.map((t) => {
      const { f, w } = parts[t.pos];
      const m = placed(f.x, f.z, f.rot);
      const onSide = !f.corner && !f.flat;
      const front = f.corner ? 0.05 : f.flat ? 0.34 : 0.1;
      const model = t.type === 'city' ? buildMonument(t.model) : buildSpecial(t.type);
      model.rotation.y = -f.rot; // quel que soit le côté du plateau, le monument nous fait face
      const fit = (k) => {
        model.scale.setScalar(1);
        model.position.set(0, 0, 0);
        fitModel(model, w, front, (HEROES[t.model] ?? 1) * k, f.flip, f.corner && f.flip ? BOTTOM_CORNER_H : f.flat ? Infinity : t.type === 'chantier' ? 1.6 : SIDE_HEROES[t.model] ?? SIDE_H, onSide ? -0.03 : 0.35);
        if (onSide) model.position.x += f.rot < 0 ? -SIDE_BACK : SIDE_BACK; // reculé sur sa case : le pion se tient devant, sur la case
      };
      fit(1);
      if (f.flip && !f.corner) clearNames(model, m, fit, spans);
      parts[t.pos].top = new THREE.Box3().setFromObject(model).max.y;
      return { object: model, matrix: m, ao: PLATE_H, tile: t.pos, lift: true };
    });
  }
  let monuments = null;
  let rise = null; // l'arrivée des monuments : de 0 à 1

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
  const ownedColor = (hex) => `#${new THREE.Color(hex).lerp(new THREE.Color('#FFFFFF'), 0.1).getHexString()}`;
  // Une petite maison vue de face : un seul volume, le toit compris. Le dernier niveau est un immeuble.
  const buildingGeo = (w, wall, roof, d) => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(w / 2, wall);
    if (roof) shape.lineTo(0, wall + roof);
    else shape.lineTo(w / 2, wall);
    shape.lineTo(-w / 2, wall);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    geo.translate(0, 0, -d / 2);
    return geo;
  };
  const houseGeo = buildingGeo(0.28, 0.18, 0.15, 0.24);
  const towerGeo = buildingGeo(0.28, 0.46, 0, 0.24);

  const shots = new Map();
  const PORTRAIT = {
    turn: 0.3,
    place(lens) {
      lens.position.set(0, 0.92, 1.95);
      lens.lookAt(0, 0.74, 0);
    },
  };
  // Le visage du propriétaire, posé sur la case : la couleur n'est pas le seul signe (daltonisme, et on reconnaît son personnage).
  const badgeGeo = new THREE.PlaneGeometry(0.34, 0.34);
  badgeGeo.rotateX(-Math.PI / 2);
  const badgeMats = new Map();
  const badgeMat = (seat) => {
    if (!badgeMats.has(seat)) {
      // Une pastille à la couleur du joueur, avec son initiale : on la lit même en petit, et la couleur n'est pas le seul signe.
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const g = c.getContext('2d');
      const color = new THREE.Color(PAWN_COLORS[seat]);
      g.fillStyle = PAWN_COLORS[seat];
      g.beginPath();
      g.arc(64, 64, 60, 0, Math.PI * 2);
      g.fill();
      // Le visage du joueur (son personnage, ou le voyageur de sa place) dans le rond ; à défaut, son initiale.
      let face = null;
      try {
        const look = lookOf(seat);
        face = snapshot(`p${seat}${look ? JSON.stringify(look) : ''}`, () => buildCharacter(seat, PAWN_COLORS[seat], look), PORTRAIT);
      } catch { /* pas de portrait : l'initiale suffit */ }
      if (face) {
        const tmp = document.createElement('canvas');
        tmp.width = face.width;
        tmp.height = face.height;
        tmp.getContext('2d').putImageData(face, 0, 0);
        g.save();
        g.beginPath();
        g.arc(64, 64, 52, 0, Math.PI * 2);
        g.clip();
        g.fillStyle = '#FFFFFF';
        g.fill();
        g.drawImage(tmp, 4, 4, 120, 120);
        g.restore();
      } else {
        const name = view?.players.find((p) => p.seat === seat)?.pseudo ?? '?';
        g.fillStyle = 0.3 * color.r + 0.59 * color.g + 0.11 * color.b > 0.45 ? INK : '#FFFFFF';
        g.font = '800 84px "ES Barlow", system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(name.slice(0, 1).toUpperCase(), 64, 70);
      }
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
      // Dans le coin de l'étiquette, à droite du prix : il ne cache jamais le nom.
      const { w, h, center } = labelFrame(part.f);
      // Sur téléphone, le nom occupe toute l'étiquette : le visage se pose dans le coin, au-dessus, pour ne pas le cacher.
      const up = Math.min(window.innerWidth, window.innerHeight) < 520 ? h / 2 + 0.2 : 0.26 - h / 2;
      part.badge.position.set(center.x + w / 2 - 0.3, center.y + 0.012, center.z - up);
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
  const coins = [];
  const fades = [];
  // ——— Une sélection (un joueur, ou un pays) : ses cases montent comme des blocs à sa couleur, avec un halo au sol ; le reste s'efface ———
  let focusSpec = null;
  const focusGroup = new THREE.Group();
  scene.add(focusGroup);
  const blockGeo = plateGeometry(TILE_W - 0.06, TILE_D - 0.06, 1, 0.16);
  const capGeo = plateGeometry(TILE_W - 0.34, TILE_D - 0.34, 0.006, 0.1);
  const haloGeo = plateGeometry(TILE_W + 0.5, TILE_D + 0.5, 0.01, 0.3);
  function applyFocus() {
    for (const child of [...focusGroup.children]) {
      focusGroup.remove(child);
      child.material.dispose();
    }
    const player = focusSpec?.player !== undefined ? view?.players.find((p) => p.id === focusSpec.player) : null;
    const chosen = new Set(player ? Object.keys(view.props).map(Number).filter((pos) => view.props[pos].owner === player.id) : focusSpec?.tiles ?? []);
    const active = Boolean(player || focusSpec?.tiles);
    const color = player ? PAWN_COLORS[player.seat] : focusSpec?.color;
    parts.forEach((part, pos) => {
      const mine = chosen.has(pos);
      focusTo.lift[pos] = mine ? 1.25 : 0;
      focusTo.dim[pos] = active && !mine ? 0.34 : view?.over ? 0.5 : 1;
      const show = !active || mine || !player;
      for (const key of ['rim', 'fill', 'shade', 'badge']) if (part[key]) part[key].visible = show;
      part.levels.visible = show;
      if (!mine) return;
      const block = new THREE.Mesh(blockGeo, new THREE.MeshLambertMaterial({ color }));
      block.position.set(part.f.x, 0, part.f.z);
      block.rotation.y = part.f.rot;
      block.userData = { pos, kind: 'block' };
      const cap = new THREE.Mesh(capGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
      cap.position.set(part.f.x, PLATE_H + 0.002, part.f.z);
      cap.rotation.y = part.f.rot;
      cap.userData = { pos, kind: 'cap' };
      const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false }));
      halo.position.set(part.f.x, 0.03, part.f.z);
      halo.rotation.y = part.f.rot;
      halo.renderOrder = 1;
      halo.userData = { pos, kind: 'halo' };
      focusGroup.add(block, cap, halo);
    });
    wake();
  }
  const rising = [];
  // Un personnage réagit : il saute de joie en tournant, ou il baisse la tête.
  function react(id, kind, count = 1) {
    const pawn = pawns.get(id);
    if (reduced || !pawn || pawn.gone || pawn.to) return;
    pawn.react = { kind, t: 0, count };
    wake();
  }
  const coinGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.07, 14);
  const coinMat = new THREE.MeshLambertMaterial({ color: '#F2B632', emissive: '#7A5200' });
  // Des pièces volent de celui qui paie vers celui qui reçoit.
  function payCoins(fromId, toId) {
    const a = pawns.get(fromId);
    const b = pawns.get(toId);
    if (reduced || !a || !b) return;
    const lift = new THREE.Vector3(0, 1.2, 0);
    for (let i = 0; i < 7; i += 1) {
      const mesh = new THREE.Mesh(coinGeo, coinMat);
      mesh.visible = false;
      mesh.position.copy(a.mesh.position).add(lift);
      scene.add(mesh);
      coins.push({ mesh, t: -i * 0.07, from: a.mesh.position.clone().add(lift), to: b.mesh.position.clone().add(lift) });
    }
    wake();
  }
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

  // Les niveaux, juste au-dessus de l'étiquette et devant le monument : ils se voient, et ils ne cachent pas le nom.
  const levelSpot = (f, i) => {
    if (f.flat) return [(i - 1.5) * 0.34, f.flip ? -0.42 : 0.4];
    return [f.rot > 0 ? 0.42 : -0.42, 0.35 + i * 0.3];
  };
  const setLevels = (part, level, color) => {
    if (part.level === level) return false;
    part.level = level;
    part.levels.clear();
    for (let i = 0; i < level; i += 1) {
      const m = new THREE.Mesh(i === 3 ? towerGeo : houseGeo, tint(color ?? '#FFFFFF'));
      const [lx, lz] = levelSpot(part.f, i);
      m.position.set(lx, PLATE_H, lz);
      m.rotation.y = -part.f.rot; // comme les monuments, les maisons nous font face
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


  // ——— Les personnages : ils marchent sur le sol, le long du bord intérieur, pour ne jamais cacher le texte ———
  // Les pions se dessinent en dernier, sur une profondeur remise à zéro : un monument ne les coupe jamais et ils ne rentrent jamais dedans.
  const personMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true });
  const depthReset = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ transparent: true }));
  depthReset.frustumCulled = false;
  depthReset.renderOrder = 9;
  depthReset.onBeforeRender = (r) => { r.state.buffers.depth.setMask(true); r.clearDepth(); };
  scene.add(depthReset);
  const blobMat = new THREE.MeshBasicMaterial({ color: '#05060A', transparent: true, opacity: 0.42, depthWrite: false });
  // Chaque personnage a son socle, à sa couleur : on voit d'un coup sur quelle case il se tient.
  const SOCLE_Y = PLATE_H + 0.02;
  const SOCLE_SIZE = 1.05;
  const socleMat = (seat) => {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = '#FFFFFF';
    g.beginPath();
    g.arc(48, 48, 46, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = PAWN_COLORS[seat];
    g.beginPath();
    g.arc(48, 48, 37, 0, Math.PI * 2);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false });
  };
  const socleGeo = new THREE.PlaneGeometry(1, 1);
  socleGeo.rotateX(-Math.PI / 2);
  // La case de celui qui joue : elle monte un peu et s'encadre à sa couleur. Pendant la marche, elle suit ses pas.
  const frameGeometry = (w, d, t, r) => {
    const round = (path, x, y, ww, dd, rr) => {
      path.moveTo(x + rr, y);
      path.lineTo(x + ww - rr, y);
      path.quadraticCurveTo(x + ww, y, x + ww, y + rr);
      path.lineTo(x + ww, y + dd - rr);
      path.quadraticCurveTo(x + ww, y + dd, x + ww - rr, y + dd);
      path.lineTo(x + rr, y + dd);
      path.quadraticCurveTo(x, y + dd, x, y + dd - rr);
      path.lineTo(x, y + rr);
      path.quadraticCurveTo(x, y, x + rr, y);
      return path;
    };
    const shape = round(new THREE.Shape(), -w / 2, -d / 2, w, d, r);
    shape.holes.push(round(new THREE.Path(), -w / 2 + t, -d / 2 + t, w - t * 2, d - t * 2, Math.max(0.02, r - t)));
    const geo = new THREE.ShapeGeometry(shape, 6);
    geo.rotateX(-Math.PI / 2);
    return geo;
  };
  const hereGeo = { side: frameGeometry(TILE_W - 0.04, TILE_D - 0.04, 0.15, 0.17), corner: frameGeometry(TILE_D - 0.04, TILE_D - 0.04, 0.17, 0.2) };
  const hereFrame = new THREE.Mesh(hereGeo.side, new THREE.MeshBasicMaterial({ color: '#FFFFFF', depthWrite: false, toneMapped: false, transparent: true }));
  hereFrame.renderOrder = 3;
  hereFrame.visible = false;
  scene.add(hereFrame);
  const HERE_LIFT = 0.28;
  let hereTile = null;
  const bubbleCanvas = document.createElement('canvas');
  bubbleCanvas.width = 512;
  bubbleCanvas.height = 148;
  const bubbleTexture = new THREE.CanvasTexture(bubbleCanvas);
  bubbleTexture.colorSpace = THREE.SRGBColorSpace;
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  bubble.renderOrder = 12;
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
  const LEAN = -0.3; // un peu penché en arrière : vu d'en haut, le visage reste visible sous le chapeau

  // Qui se tient sur une case. Celui qui arrive n'y compte qu'une fois arrivé, sauf pour calculer sa propre place.
  const peopleOn = (pos, self) => [...pawns.values()]
    .filter((x) => !x.gone && x.goal === pos && (x === self || (!x.to && !x.queue.length)))
    .sort((a, b) => a.player.seat - b.player.seat);
  const CROWD_SCALE = [1, 1, 0.94, 0.88, 0.82, 0.74];
  const crowdScale = (n) => CROWD_SCALE[Math.min(n, 5)];
  function pawnSpot(p, pos) {
    const f = tileFrame(pos);
    const self = pawns.get(p.id);
    const list = peopleOn(pos, self);
    const n = list.includes(self) ? list.length : 1;
    const rank = Math.max(0, list.indexOf(self));
    // En un rang jusqu'à 4, en deux rangs au-delà, toujours centrés sur la case. Le second rang se tient derrière le premier, côté monument.
    const perRow = n <= 4 ? n : Math.ceil(n / 2);
    const row = n <= 4 ? 0 : rank >= perRow ? 1 : 0;
    const inRow = row ? n - perRow : perRow;
    const col = (row ? rank - perRow : rank) - (inRow - 1) / 2;
    if (f.corner) { // au milieu de la case d'angle, juste au-dessus de son nom
      const step = Math.min(0.62, 2.1 / Math.max(1, perRow - 1));
      const x = f.flip ? f.x : f.x + Math.sign(f.x) * 0.5;
      return new THREE.Vector3(x + col * step * (f.flip ? 1 : 0.75), 0, f.z + (f.flip ? -0.35 : -0.1) - row * 0.5);
    }
    if (f.flat) { // haut et bas du plateau : sur la case, juste au-dessus de l'étiquette
      const step = Math.min(0.6, 1.62 / Math.max(1, perRow - 1));
      return new THREE.Vector3(f.x + col * step, 0, f.z - 0.08 - row * 0.5);
    }
    // Côtés du plateau : juste à côté de l'étiquette, sur le devant de la case, avec le monument derrière.
    const step = Math.min(0.46, 1.08 / Math.max(1, perRow - 1));
    return new THREE.Vector3(f.x + Math.sign(f.x) * Math.max(0.44, 0.2 + perRow * 0.175) + col * step, 0, f.z + 0.62 - row * 0.5);
  }

  // ——— Le podium, à la fin de la partie : trois marches au milieu du plateau, et les trois premiers dessus ———
  const PODIUM = [[0, 2.1, '#E8B93C'], [-3.3, 1.35, '#CBD0D9'], [3.3, 0.85, '#C98A4B']];
  const PODIUM_Z = -3.6;
  function showPodium(v, instant) {
    const ranked = v.players.filter((p) => !p.out).sort((a, b) => b.worth - a.worth).slice(0, 3);
    const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 3.1, 11, 28, 1, true), new THREE.MeshBasicMaterial({ color: '#FFF4CC', transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    spot.position.set(0, 5.5, PODIUM_Z);
    scene.add(spot);
    focusTo.dim.fill(0.5);
    focusTo.dim[48] = 1;
    ranked.forEach((p, i) => {
      const [x, h, color] = PODIUM[i];
      const step = new THREE.Mesh(plateGeometry(2.9, 2.3, h, 0.18), new THREE.MeshLambertMaterial({ color }));
      step.position.set(x, 0, PODIUM_Z);
      step.castShadow = true;
      step.receiveShadow = true;
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#FFF8E8';
      g.beginPath();
      g.arc(64, 64, 60, 0, Math.PI * 2);
      g.fill();
      g.font = '800 88px "ES Titres", system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#14302B';
      g.fillText(String(i + 1), 64, 68);
      const size = Math.min(1.25, h * 0.84);
      const number = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, toneMapped: false, depthWrite: false }));
      number.position.set(0, h / 2, 1.16);
      step.add(number);
      scene.add(step);
      const pawn = pawns.get(p.id);
      if (!pawn) return;
      pawn.queue = [];
      pawn.to = null;
      pawn.goal = p.pos;
      pawn.react = null;
      pawn.blob.visible = false;
      pawn.mesh.scale.setScalar(2.9); // sur le podium, ils sont grands
      pawn.mesh.rotation.set(LEAN, FACING, 0);
      pawn.mesh.position.set(x, instant ? h : 0, PODIUM_Z + 0.1);
      pawn.standY = instant ? h : 0;
      if (instant || reduced) {
        pawn.standY = h;
        pawn.mesh.position.y = h;
      } else {
        step.scale.y = 0.001;
        rising.push({ step, pawn, h, id: p.id, first: i === 0, t: -(2 - i) * 0.3 });
      }
    });
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
    const bottom = narrow ? 70 : 4; // la carte d'action peut mordre un instant sur le bas : le plateau reste grand, même à 10 joueurs
    const side = narrow ? 4 : 8;
    const right = narrow ? side : side + rightInset(); // sur ordinateur, la colonne des joueurs garde sa place à droite
    const scale = Math.min((size.w - side - right) / (x1 - x0), Math.max(60, size.h - top - bottom) / (y1 - y0));
    const midX = (x0 + x1) / 2;
    const midY = (y0 + y1) / 2;
    // Le milieu du plateau, en pixels depuis le haut. Sur téléphone, il descend un peu sous les joueurs, sans passer sous la carte d'action.
    const boardH = (y1 - y0) * scale;
    const screenY = narrow ? top + boardH / 2 + Math.min(40, Math.max(0, (size.h - top - bottom - boardH) / 2)) : (top + size.h - bottom) / 2;
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
    onFit?.(onScreen(0.4), onScreen(2.75), onScreen(-1.1), onScreen(5.35), onScreen(DICE_Z + 1.45), onScreen(HALF + 1.15));
  }

  // ——— La boucle : elle ne tourne que quand quelque chose bouge ———
  let raf = 0;
  let last = 0;
  // Après CALM_MS sans rien de neuf (pas d'animation, pas de nouvel état, pas de geste), le plateau arrête de se redessiner :
  // l'image reste affichée telle quelle et la batterie respire. Le moindre événement (wake) relance la boucle.
  const CALM_MS = 8000;
  let calmAt = performance.now() + CALM_MS;
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
    } else if (quality.step === 3 && dpr > 1) { // jamais sous 1 : dans un jeu au tour par tour, un plateau illisible gêne plus qu'une image saccadée
      dpr = 1;
      renderer.setPixelRatio(dpr);
      renderer.setSize(size.w, size.h, false);
    }
  }

  let view = null;
  let lifeTimer = 0;
  const lifeOn = () => !reduced && quality.step < 2;

  let crowdMoving = true;
  let ringId = null;
  const walking = () => [...pawns.values()].some((pawn) => pawn.to || pawn.queue.length);
  let wasWalking = false;

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
        pawn.dur = step.jump > 2 ? 0.8 : 0.26; // assez lent pour suivre chaque case du regard
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
        pawn.blob.position.set(pawn.mesh.position.x, SOCLE_Y, pawn.mesh.position.z);
        pawn.mesh.position.y = Math.sin(pawn.t * Math.PI) * pawn.jump + focusU.lift.value[pawn.toPos] * pawn.t;
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
    // Ceux qui attendent se serrent quand la case se remplit, et reprennent leur place quand elle se vide.
    if (crowdMoving && view && !view.over) {
      crowdMoving = false;
      for (const pawn of pawns.values()) {
        if (pawn.gone || pawn.to || pawn.queue.length) continue;
        const target = pawnSpot(pawn.player, pawn.shown);
        const scale = PAWN_SCALE * crowdScale(peopleOn(pawn.shown, pawn).length);
        const k = 1 - Math.exp(-dt * 10);
        // Seuls x et z se rapprochent ici : comparer aussi la hauteur (relevée sur la case du joueur) gardait la boucle active en permanence.
        if ((pawn.mesh.position.x - target.x) ** 2 + (pawn.mesh.position.z - target.z) ** 2 > 0.0004 || Math.abs(pawn.mesh.scale.x - scale) > 0.002) {
          crowdMoving = true;
          busy = true;
          pawn.mesh.position.x += (target.x - pawn.mesh.position.x) * k;
          pawn.mesh.position.z += (target.z - pawn.mesh.position.z) * k;
          pawn.size = pawn.mesh.scale.x + (scale - pawn.mesh.scale.x) * k;
          pawn.mesh.scale.setScalar(pawn.size);
          pawn.blob.scale.setScalar((pawn.size / PAWN_SCALE) * SOCLE_SIZE);
          pawn.blob.position.set(pawn.mesh.position.x, SOCLE_Y, pawn.mesh.position.z);
        }
      }
      if (walking()) crowdMoving = true;
    }
    // L'anneau et la bulle restent sur celui qui marche, jusqu'à son arrivée.
    if (view && (ringId === null || !walking())) ringId = view.players[view.cur]?.id ?? null;
    const curPawn = view && pawns.get(ringId);
    const ringPlayer = view?.players.find((p) => p.id === ringId);
    if (ringPlayer && !view.over) drawBubble(ringPlayer.pseudo, PAWN_COLORS[ringPlayer.seat]);
    hereTile = curPawn && !view.over && !focusSpec ? (curPawn.to ? curPawn.toPos : curPawn.shown) : null;
    if (hereTile !== null) {
      const f = tileFrame(hereTile);
      hereFrame.geometry = f.corner ? hereGeo.corner : hereGeo.side;
      hereFrame.position.set(f.x, PLATE_H + 0.016 + focusU.lift.value[hereTile], f.z);
      hereFrame.rotation.y = f.rot;
      hereFrame.material.color.set(PAWN_COLORS[ringPlayer?.seat ?? 0]);
    }
    hereFrame.visible = hereTile !== null;
    if (curPawn) {
      const narrow = size.w < size.h;
      bubble.visible = !view.over;
      bubble.scale.set(narrow ? 6.4 : 4.2, narrow ? 1.85 : 1.21, 1);
      const reach = HALF + 0.6 - bubble.scale.x / 2; // la bulle reste à l'écran, même au bord du plateau
      bubble.position.set(Math.max(-reach, Math.min(reach, curPawn.mesh.position.x)), curPawn.mesh.position.y + PAWN_SCALE * 1.2 + (narrow ? 1 : 0.65), curPawn.mesh.position.z);
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
    // Les cases sélectionnées montent ; tout ce qui est posé dessus suit.
    {
      let moving = false;
      const k = reduced ? 1 : 1 - Math.exp(-dt * 9);
      for (let i = 0; i < 48; i += 1) {
        const target = focusTo.lift[i] + (i === hereTile ? HERE_LIFT : 0);
        focusU.lift.value[i] += (target - focusU.lift.value[i]) * k;
        focusU.dim.value[i] += (focusTo.dim[i] - focusU.dim.value[i]) * k;
        if (Math.abs(target - focusU.lift.value[i]) > 0.003 || Math.abs(focusTo.dim[i] - focusU.dim.value[i]) > 0.003) moving = true;
        const l = focusU.lift.value[i];
        const part = parts[i];
        for (const key of ['rim', 'fill', 'shade', 'badge']) {
          const o = part[key];
          if (o) {
            o.userData.y0 ??= o.position.y;
            o.position.y = o.userData.y0 + l;
          }
        }
        part.levels.position.y = l;
      }
      for (const o of focusGroup.children) {
        const l = focusU.lift.value[o.userData.pos];
        if (o.userData.kind === 'block') o.scale.y = Math.max(0.001, l + BASE_H);
        else if (o.userData.kind === 'cap') o.position.y = PLATE_H + 0.002 + l;
        else o.material.opacity = 0.6 + Math.sin(now / 300) * 0.25;
      }
      if (!view?.over) {
        for (const pawn of pawns.values()) {
          if (!pawn.to && !pawn.react && !pawn.gone) {
            const up = focusU.lift.value[pawn.shown] ?? 0;
            pawn.mesh.position.y = up;
            pawn.blob.position.y = SOCLE_Y + up;
          }
        }
      }
      if (moving && !reduced) busy = true;
    }
    for (const pawn of pawns.values()) {
      const r = pawn.react;
      if (!r) continue;
      busy = true;
      r.t += dt / (r.kind === 'joy' ? 0.7 : 0.8);
      const k = Math.min(1, r.t);
      if (r.kind === 'joy') {
        pawn.mesh.position.y = (pawn.standY ?? 0) + Math.abs(Math.sin(k * Math.PI * 2)) * 0.9;
        pawn.mesh.rotation.y = FACING + k * Math.PI * 2;
      } else {
        pawn.mesh.rotation.x = LEAN + Math.sin(k * Math.PI) * 0.8;
      }
      if (k >= 1) {
        pawn.mesh.position.y = pawn.standY ?? 0;
        pawn.mesh.rotation.x = LEAN;
        pawn.mesh.rotation.y = FACING;
        r.count -= 1;
        r.t = 0;
        if (r.count <= 0) pawn.react = null;
      }
    }
    for (let i = rising.length - 1; i >= 0; i -= 1) { // les marches du podium montent, le personnage avec elles
      const r = rising[i];
      r.t += dt / 0.6;
      const k = ease(Math.min(1, Math.max(0, r.t)));
      r.step.scale.y = Math.max(0.001, k);
      r.pawn.standY = r.h * k;
      r.pawn.mesh.position.y = r.pawn.standY;
      busy = true;
      if (r.t >= 1) {
        rising.splice(i, 1);
        renderer.shadowMap.needsUpdate = true;
        if (r.first) react(r.id, 'joy', 4);
      }
    }
    if (rise !== null) { // les monuments sortent de leur case, puis leurs ombres se posent
      rise = Math.min(1, rise + dt / MONUMENTS_RISE_S);
      const k = Math.max(0.001, 1 - (1 - rise) ** 3);
      monuments.scale.y = k;
      monuments.position.y = PLATE_H * (1 - k);
      busy = true;
      if (rise >= 1) {
        rise = null;
        monumentsShown();
      }
    }
    for (let i = fades.length - 1; i >= 0; i -= 1) { // la faillite : le pion rétrécit et tombe
      const f = fades[i];
      f.t += dt / 0.6;
      const scale = PAWN_SCALE * Math.max(0, 1 - f.t);
      f.pawn.mesh.scale.setScalar(scale);
      f.pawn.mesh.rotation.y += dt * 8;
      busy = true;
      if (f.t >= 1) {
        f.pawn.mesh.visible = false;
        fades.splice(i, 1);
      }
    }
    for (let i = coins.length - 1; i >= 0; i -= 1) {
      const c = coins[i];
      c.t += dt;
      const k = Math.min(1, Math.max(0, c.t / 0.6));
      c.mesh.visible = c.t > 0;
      c.mesh.position.lerpVectors(c.from, c.to, ease(k));
      c.mesh.position.y += Math.sin(k * Math.PI) * 3.2;
      c.mesh.rotation.x += dt * 9;
      busy = true;
      if (k >= 1) {
        scene.remove(c.mesh);
        coins.splice(i, 1);
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
      {
        if (view && !view.over) {
          for (const pawn of pawns.values()) { // celui qui joue respire, les autres restent droits
            if (!pawn.gone) pawn.mesh.scale.y = (pawn.size ?? PAWN_SCALE) * (pawn === curPawn && !pawn.to && !pawn.react ? 1 + Math.sin(time * 3.4) * 0.025 : 1);
          }
        }
      }
      if (marker.visible) {
        marker.position.y = markerBase + Math.abs(Math.sin(time * 3)) * 0.42;
        marker.rotation.y = time * 1.2;
      }
      flags.userData.time.value = time;
    }

    renderer.render(scene, camera);

    // Si la machine n'arrive pas à suivre, on baisse la qualité plutôt que de saccader.
    // Les pions viennent de s'arrêter : l'interface peut annoncer ce qui s'est passé.
    const moving = walking();
    if (wasWalking && !moving) onStill?.();
    wasWalking = moving;
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
    else if (lifeOn() && !lifeTimer && now < calmAt) { // au repos, une image de temps en temps suffit : la machine reste tranquille
      lifeTimer = setTimeout(() => {
        lifeTimer = 0;
        kick();
      }, 100); // 10 images par seconde au début du repos : les drapeaux flottent, puis plus rien (voir CALM_MS)
    }
  }
  function wake() {
    calmAt = performance.now() + CALM_MS;
    kick();
  }
  function kick() {
    if (raf) return;
    if (!last || performance.now() - last > 100) last = performance.now() - 16;
    raf = requestAnimationFrame(tick);
  }

  // ——— Toucher une case, la survoler à la souris ———
  const raycaster = new THREE.Raycaster();
  const tileAt = (e) => {
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    // Un clic sur une étiquette ouvre toujours sa case, même si la zone de clic d'un monument voisin passe devant.
    const { origin, direction } = raycaster.ray;
    const t = (PLATE_H - origin.y) / direction.y;
    const gx = origin.x + direction.x * t;
    const gz = origin.z + direction.z * t;
    const onLabel = parts.findIndex((part) => {
      const { w, h, center } = labelFrame(part.f);
      return Math.abs(gx - center.x) <= w / 2 && Math.abs(gz - center.z) <= h / 2;
    });
    if (onLabel >= 0) return onLabel;
    return raycaster.intersectObjects(hitBoxes, false)[0]?.object.userData.pos ?? null;
  };
  let downAt = null;
  const onDown = (e) => {
    downAt = { x: e.clientX, y: e.clientY };
    wake(); // un geste sur le plateau relance la vie douce du décor
  };
  // Sur « click » et pas « pointerup » : au doigt, le clic arrive juste après, et il refermerait la fiche qui vient de s'ouvrir sous lui.
  const onClick = (e) => {
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
  canvas.addEventListener('click', onClick);
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


    for (const p of v.players) {
      let pawn = pawns.get(p.id);
      if (!pawn) {
        // Chaque personnage est fondu en une seule forme, sa tenue à la couleur du joueur.
        const mesh = new THREE.Mesh(bake([{ object: buildCharacter(p.seat, PAWN_COLORS[p.seat], lookOf(p.seat)) }], { fullColor: true }), personMat);
        mesh.renderOrder = 10;
        mesh.scale.setScalar(PAWN_SCALE);
        mesh.rotation.set(LEAN, FACING, 0);
        const blob = new THREE.Mesh(socleGeo, socleMat(p.seat));
        blob.scale.setScalar(SOCLE_SIZE);
        blob.renderOrder = 2;
        scene.add(mesh, blob);
        pawn = { mesh, blob, shown: p.pos, goal: p.pos, queue: [], t: 0, from: null, to: null, player: p, turning: false };
        mesh.position.copy(pawnSpot(p, p.pos));
        blob.position.set(mesh.position.x, SOCLE_Y, mesh.position.z);
        pawns.set(p.id, pawn);
      }
      pawn.player = p;
      if (p.out && !pawn.gone) {
        pawn.gone = true;
        pawn.blob.visible = false;
        if (firstUpdate || reduced) pawn.mesh.visible = false;
        else fades.push({ pawn, t: 0 });
      }
      if (p.out) crowdMoving = true;
      if (p.out || pawn.goal === p.pos) continue;
      pawn.goal = p.pos;
      crowdMoving = true;
      const base = pawn.to ? pawn.toPos : pawn.shown; // relancé en pleine marche : on repart de la case qu'il est en train d'atteindre
      const forward = (p.pos - base + 48) % 48;
      pawn.queue = [];
      if (reduced || (forward === 0 && !pawn.to)) {
        pawn.shown = p.pos;
        pawn.to = null;
        pawn.mesh.position.copy(pawnSpot(p, p.pos));
        pawn.blob.position.set(pawn.mesh.position.x, SOCLE_Y, pawn.mesh.position.z);
      } else if (forward <= 14) {
        for (let i = 1; i <= forward; i += 1) pawn.queue.push({ pos: (base + i) % 48, jump: 0.42 });
      } else {
        pawn.queue.push({ pos: p.pos, jump: 5 }); // un renvoi à la Douane ou une carte : un grand saut
      }
    }


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
      showPodium(v, firstUpdate);
      if (!firstUpdate) for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9], [0, -7]]) celebrate(x, z, PAWN_COLORS[Math.floor(Math.random() * 10)]);
    }
    if (focusSpec) applyFocus();
    if (shadows || firstUpdate) renderer.shadowMap.needsUpdate = true;
    firstUpdate = false;
    wake();
  }
  renderer.shadowMap.needsUpdate = true;
  ro.observe(host);
  // Tout préparer dès le chargement : le premier lancer de dés ne doit pas faire saccader le jeu.
  renderer.compile(scene, camera);

  // Pose les monuments, une seule fois. rise : ils sortent doucement de leur case (jamais si l'animation est réduite).
  // Leur ombre attend qu'ils soient debout : calculée pendant la montée, elle serait celle des monuments entiers.
  function showMonuments(rising) {
    if (monuments) return;
    monuments = new THREE.Mesh(bake(monumentItems(), { fullColor: true }), world.material);
    monuments.receiveShadow = true;
    monuments.frustumCulled = false;
    scene.add(monuments);
    for (const key of shots.keys()) if (key.startsWith('m')) shots.delete(key); // une fiche ouverte avant leur arrivée montrait la version en code
    if (marker.visible && view) {
      markerBase = parts[view.players[view.cur].pos].top + 0.75;
      marker.position.y = markerBase;
    }
    if (rising && !reduced) {
      rise = 0;
      monuments.scale.y = 0.001;
      monuments.position.y = PLATE_H;
    } else monumentsShown();
    wake();
  }
  function monumentsShown() {
    monuments.castShadow = true;
    renderer.shadowMap.needsUpdate = true;
    host.dataset.monuments = 'ok'; // pour les tests : tout le plateau est là
  }

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
    showMonuments,
    walking,
    payCoins,
    react,
    // spec : { player: id }, { tiles: [positions], color }, ou null pour tout remettre.
    focus(spec) {
      focusSpec = spec;
      applyFocus();
    },
    // Le visage d'un voyageur, de près.
    portrait: (seat) => { const look = lookOf(seat); return snapshot(`p${seat}${look ? JSON.stringify(look) : ''}`, () => buildCharacter(seat, PAWN_COLORS[seat], look), PORTRAIT); },
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
      canvas.removeEventListener('click', onClick);
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
