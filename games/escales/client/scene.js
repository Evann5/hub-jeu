// Le monde d'Escales : une maquette blanche sur un sol uni. La couleur n'apparaît que pour dire quelque chose : une ville achetée
// prend la couleur de son propriétaire, un petit trait donne sa région, chaque pion a sa couleur.
// Pour rester fluide : une seule forme par case, ombres calculées une fois, et rien n'est redessiné tant que rien ne bouge.
// Ce fichier ne connaît pas les règles : il reçoit l'état avec update(view) et signale les cases touchées avec onTile(pos).
import * as THREE from './three/three.module.js';
import { REGIONS, TILES } from './board.js';
import { buildMonument, buildSpecial, buildCharacter, bake } from './monuments.js';

// Les 10 couleurs des joueurs : assez claires pour que le texte noir imprimé sur les cases reste lisible.
export const PAWN_COLORS = ['#FF5A5F', '#FF9F1C', '#FFD21F', '#3DD27E', '#19C8BC', '#4DA8FF', '#8F7FFF', '#FF6FC0', '#C49A6C', '#9AA5B8'];

const FIELD = '#E3E7ED';
const INK = '#12151F';
const TILE_W = 2; // largeur d'une case le long du côté
const TILE_D = 3; // profondeur
const PLATE_H = 0.16;
const HALF = (11 * TILE_W + 2 * TILE_D) / 2;
const FOV = 22; // un angle serré : presque une vue de maquette, sans déformation
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const FRONT_LINE = 0.2; // l'avant des monuments ; devant, le texte imprimé reste libre

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// Centre de chaque case et rotation pour que son avant regarde le centre du plateau.
function tileFrame(pos) {
  const corner = HALF - TILE_D / 2;
  const along = (i) => -HALF + TILE_D + TILE_W * (i - 0.5);
  if (pos === 0) return { x: -corner, z: -corner, rot: 0, corner: true };
  if (pos < 12) return { x: along(pos), z: -corner, rot: 0 };
  if (pos === 12) return { x: corner, z: -corner, rot: -Math.PI / 2, corner: true };
  if (pos < 24) return { x: corner, z: along(pos - 12), rot: -Math.PI / 2 };
  if (pos === 24) return { x: corner, z: corner, rot: Math.PI, corner: true };
  if (pos < 36) return { x: -along(pos - 24), z: corner, rot: Math.PI };
  if (pos === 36) return { x: -corner, z: corner, rot: Math.PI / 2, corner: true };
  return { x: -corner, z: -along(pos - 36), rot: Math.PI / 2 };
}

const frameMatrix = (f) => new THREE.Matrix4().compose(new THREE.Vector3(f.x, 0, f.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.rot), new THREE.Vector3(1, 1, 1));

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

// Le monument est mis à l'échelle de sa case, aligné sur la ligne avant.
function fitModel(model, w, top) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const room = TILE_D / 2 + FRONT_LINE - 0.14;
  const scale = Math.min(1, room / Math.max(size.z, 0.01), (w - 0.3) / Math.max(size.x, 0.01));
  model.scale.setScalar(scale);
  model.position.set(-((box.min.x + box.max.x) / 2) * scale, top - box.min.y * scale, FRONT_LINE - box.max.z * scale);
}

// Tous les textes des cases sur une seule image, posée sur le plateau en une seule forme.
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
  const v = new THREE.Vector3();
  for (const t of TILES) {
    const col = t.pos % COLS;
    const row = Math.floor(t.pos / COLS);
    const cx = col * CW + CW / 2;
    const cy = row * CH + CH / 2;
    let size = 58;
    do {
      c.font = `800 ${size}px "ES Figtree", system-ui, sans-serif`;
      size -= 2;
    } while (c.measureText(t.name).width > CW - 24 && size > 26);
    c.fillStyle = INK;
    c.fillText(t.name, cx, t.price ? cy - 26 : cy);
    if (t.price) {
      c.font = '600 44px "ES Figtree", system-ui, sans-serif';
      c.fillStyle = '#3F4656';
      c.fillText(`${t.price.toLocaleString('fr-FR')} €`, cx, cy + 34);
    }
    const f = tileFrame(t.pos);
    const m = frameMatrix(f);
    const w = f.corner ? 2.5 : 1.68;
    const h = w / 2;
    const z = TILE_D / 2 - 0.3 - h / 2;
    const y = PLATE_H + 0.012;
    const corners = [[-w / 2, z - h / 2], [w / 2, z - h / 2], [w / 2, z + h / 2], [-w / 2, z + h / 2]];
    const u0 = col / COLS;
    const u1 = (col + 1) / COLS;
    const v0 = 1 - (row + 1) / ROWS;
    const v1 = 1 - row / ROWS;
    const uvs = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]];
    for (const i of [0, 3, 2, 0, 2, 1]) {
      v.set(corners[i][0], y, corners[i][1]).applyMatrix4(m);
      pos.push(v.x, v.y, v.z);
      uv.push(uvs[i][0], uvs[i][1]);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
  mesh.renderOrder = 1;
  return mesh;
}

// Le petit trait de couleur de la région, le long du bord intérieur de chaque ville : une seule forme.
function buildStrips() {
  const pos = [];
  const col = [];
  const v = new THREE.Vector3();
  const color = new THREE.Color();
  const box = new THREE.BoxGeometry(TILE_W - 0.52, 0.012, 0.12).toNonIndexed();
  const p = box.attributes.position;
  for (const t of TILES) {
    if (t.type !== 'city') continue;
    const m = frameMatrix(tileFrame(t.pos));
    color.set(REGIONS[t.region].color);
    for (let i = 0; i < p.count; i += 1) {
      v.fromBufferAttribute(p, i);
      v.y += PLATE_H + 0.008;
      v.z += TILE_D / 2 - 0.2;
      v.applyMatrix4(m);
      pos.push(v.x, v.y, v.z);
      col.push(color.r, color.g, color.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
}

function floorWord() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const c = canvas.getContext('2d');
  c.font = '800 170px "ES Figtree", system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#CBD2DC';
  c.fillText('Escales', 512, 128);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, 0.01, -3.2);
  return m;
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
    c.fillStyle = INK;
    for (const [x, y] of dots[n]) {
      c.beginPath();
      c.arc(22 + x * 26, 22 + y * 26, 8.5, 0, Math.PI * 2);
      c.fill();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshLambertMaterial({ map: t });
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), materials);
  m.castShadow = false;
  return m;
}
// Rotation qui met la face voulue sur le dessus.
const DIE_TOP = { 1: [0, 0, 0], 2: [Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 5: [-Math.PI / 2, 0, 0], 6: [Math.PI, 0, 0] };

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
  canvas.setAttribute('aria-label', 'Le plateau en 3D : une maquette carrée de 48 cases, avec un monument par ville. La liste des villes est aussi dans le bouton Villes.');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FIELD);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 5, 600);

  scene.add(new THREE.HemisphereLight('#FFFFFF', '#BAC4D4', 2.1));
  const sun = new THREE.DirectionalLight('#FFFFFF', 1.35);
  sun.position.set(-16, 34, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const b = HALF + 4;
  Object.assign(sun.shadow.camera, { left: -b, right: b, top: b, bottom: -b, near: 1, far: 90 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun);

  // Le sol : la couleur du fond, qui ne reçoit que les ombres.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.ShadowMaterial({ color: '#2A3244', opacity: 0.2 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground, floorWord(), buildStrips(), buildPrint());

  // ——— Les cases : une seule forme par case, teintée par son propriétaire ———
  const tints = new Map();
  const tint = (hex) => {
    if (!tints.has(hex)) tints.set(hex, new THREE.MeshLambertMaterial({ color: hex, vertexColors: true }));
    return tints.get(hex);
  };
  const paleOf = (hex) => `#${new THREE.Color(hex).lerp(new THREE.Color('#FFFFFF'), 0.62).getHexString()}`;
  const WHITE = '#FFFFFF';
  const levelGeo = new THREE.BoxGeometry(0.2, 1, 0.2);
  const hitBoxes = [];

  const parts = TILES.map((t) => {
    const f = tileFrame(t.pos);
    const w = f.corner ? TILE_D : TILE_W;
    const plate = new THREE.Mesh(plateGeometry(w - 0.14, TILE_D - 0.14, PLATE_H, 0.14), new THREE.MeshBasicMaterial({ color: '#FFFFFF' }));
    const model = t.type === 'city' ? buildMonument(t.model) : buildSpecial(t.type);
    fitModel(model, w, PLATE_H);
    const geo = bake([{ object: plate, tone: 1 }, { object: model }]);
    plate.geometry.dispose();
    const mesh = new THREE.Mesh(geo, tint(WHITE));
    mesh.position.set(f.x, 0, f.z);
    mesh.rotation.y = f.rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
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
    return { mesh, levels, level: 0, color: WHITE };
  });

  const setLevels = (part, level, color) => {
    if (part.level === level) return false;
    part.level = level;
    part.levels.clear();
    for (let i = 0; i < level; i += 1) {
      const h = 0.14 + i * 0.09;
      const m = new THREE.Mesh(levelGeo, tint(color));
      m.scale.y = h;
      m.position.set(-0.62 + i * 0.26, PLATE_H + h / 2, FRONT_LINE + 0.1);
      m.castShadow = true;
      part.levels.add(m);
    }
    return true;
  };

  // ——— Le festival : un repère au-dessus de la ville ———
  const festivalMark = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 4), new THREE.MeshBasicMaterial({ color: INK }));
  festivalMark.rotation.x = Math.PI;
  festivalMark.visible = false;
  scene.add(festivalMark);

  // ——— Les pions : ils marchent sur le sol, le long du bord intérieur, pour ne jamais cacher le texte ———
  const PAWN_SCALE = 1.3;
  const personMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const blobGeo = new THREE.CircleGeometry(0.34, 16);
  blobGeo.rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ color: '#2A3244', transparent: true, opacity: 0.16, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.6, 32), new THREE.MeshBasicMaterial({ color: INK }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.015;
  scene.add(ring);
  const pawns = new Map();

  // Vue de trois quarts, face à la caméra qui regarde ce côté du plateau.
  const pawnFacing = (pos) => tileFrame(pos).rot + 0.4;

  function pawnSpot(p, pos) {
    const f = tileFrame(pos);
    const i = p.seat;
    const ox = ((i % 5) - 2) * 0.48;
    const oz = TILE_D / 2 + 0.55 + (i >= 5 ? 0.86 : 0);
    if (f.corner) { // sur un coin, le sol libre est en diagonale, vers le centre du plateau
      const d = TILE_D / 2 + 0.55 + (i >= 5 ? 0.45 : 0);
      const [sx, sz] = [-Math.sign(f.x), -Math.sign(f.z)];
      return new THREE.Vector3(f.x + sx * d + sx * ox * 0.7, 0, f.z + sz * d - sz * ox * 0.7);
    }
    const c = Math.cos(f.rot);
    const s = Math.sin(f.rot);
    return new THREE.Vector3(f.x + ox * c + oz * s, 0, f.z - ox * s + oz * c);
  }

  // ——— Les dés ———
  const dice = [makeDie(), makeDie()];
  dice[0].position.set(-0.95, 0.6, 0.6);
  dice[1].position.set(0.95, 0.6, 0.3);
  dice.forEach((d) => { d.visible = false; scene.add(d); });
  let diceAnim = null;
  let lastRollN = -1;

  // ——— La caméra ———
  const cam = { yaw: 0, pitch: 0.86, dist: 100, target: new THREE.Vector3(), wantYaw: 0, wantPitch: 0.86, wantDist: 100, wantTarget: new THREE.Vector3() };
  let snap = true;
  let overview = false;
  let userUntil = 0;
  let size = { w: 0, h: 0 };

  // La distance pour voir une largeur donnée du monde, quel que soit l'écran.
  const distFor = (span) => {
    const aspect = size.w / Math.max(1, size.h);
    return (aspect < 1.25 ? span / (2 * TAN * Math.max(aspect, 0.4)) : (span * 0.72) / (2 * TAN));
  };

  function aimAt(pos) {
    const f = tileFrame(pos);
    const side = pos < 12 ? 0 : pos < 24 ? 1 : pos < 36 ? 2 : 3;
    // La caméra se place côté centre du plateau et regarde le côté du pion : les monuments nous font face.
    const yaw = [0, -Math.PI / 2, Math.PI, Math.PI / 2][side];
    let d = yaw - cam.wantYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    cam.wantYaw += d;
    cam.wantTarget.set(f.x * 0.84, 0.7, f.z * 0.84);
    cam.wantDist = distFor(size.w < size.h ? 12 : 19);
  }
  function showAll() {
    cam.wantTarget.set(0, 0, 0);
    cam.wantDist = distFor(HALF * 2 + 7);
  }

  // ——— La boucle : elle ne tourne que quand quelque chose bouge ———
  let raf = 0;
  let last = 0;
  let quality = { frames: 0, total: 0, step: 0 };
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
      scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    } else if (quality.step === 3 && dpr > 0.75) {
      dpr = 0.75;
      renderer.setPixelRatio(dpr);
      renderer.setSize(size.w, size.h, false);
    }
  }

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
        pawn.blob.position.set(pawn.mesh.position.x, 0.012, pawn.mesh.position.z);
        pawn.mesh.position.y = Math.sin(pawn.t * Math.PI) * pawn.jump;
        pawn.mesh.rotation.y = pawn.fromRot + (pawn.toRot - pawn.fromRot) * ease(pawn.t);
        if (pawn.t >= 1) {
          pawn.shown = pawn.toPos;
          pawn.to = null;
          if (!pawn.queue.length) pawn.turning = pawnFacing(pawn.toPos);
        }
      } else if (pawn.turning !== null && pawn.turning !== undefined) {
        let d = pawn.turning - pawn.mesh.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        if (Math.abs(d) < 0.01) {
          pawn.mesh.rotation.y = pawn.turning;
          pawn.turning = null;
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
        d.position.y = 0.6 + Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k) * 2.4;
      });
      if (k >= 1) diceAnim = null;
    }

    const k = snap || reduced ? 1 : 1 - Math.exp(-dt * 3);
    snap = false;
    cam.yaw += (cam.wantYaw - cam.yaw) * k;
    cam.pitch += (cam.wantPitch - cam.pitch) * k;
    cam.dist += (cam.wantDist - cam.dist) * k;
    cam.target.lerp(cam.wantTarget, k);
    if (Math.abs(cam.wantYaw - cam.yaw) > 0.0006 || Math.abs(cam.wantPitch - cam.pitch) > 0.0006 || Math.abs(cam.wantDist - cam.dist) > 0.03 || cam.target.distanceTo(cam.wantTarget) > 0.006) busy = true;
    else {
      cam.yaw = cam.wantYaw;
      cam.pitch = cam.wantPitch;
      cam.dist = cam.wantDist;
      cam.target.copy(cam.wantTarget);
    }
    camera.position.set(
      cam.target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
      cam.target.y + Math.sin(cam.pitch) * cam.dist,
      cam.target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
    );
    camera.lookAt(cam.target);
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
  const limitDist = (d) => Math.min(distFor(HALF * 2 + 26), Math.max(distFor(9), d));
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
      userUntil = performance.now() + 15000;
      wake();
    } else if (moved > 6) {
      cam.wantYaw -= dx * 0.006;
      cam.wantPitch = Math.min(1.35, Math.max(0.5, cam.wantPitch + dy * 0.003));
      userUntil = performance.now() + 15000;
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
    userUntil = performance.now() + 15000;
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
    // Sur téléphone, la carte du bas cache l'écran : on remonte l'image pour garder le jeu visible.
    if (w < h) camera.setViewOffset(w, h, 0, h * 0.13, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    if (view) aim(view);
    else showAll();
    wake();
  });

  // ——— Mettre le monde à jour avec l'état de la partie ———
  let view = null;

  function aim(v) {
    const cur = v.players[v.cur];
    if (overview || v.over || !cur) showAll();
    else if (performance.now() > userUntil) aimAt(cur.pos);
  }

  function update(v) {
    view = v;
    let shadows = false;

    TILES.forEach((t) => {
      const part = parts[t.pos];
      const prop = v.props[t.pos];
      const owner = prop ? v.players.find((p) => p.id === prop.owner) : null;
      const base = owner ? PAWN_COLORS[owner.seat] : WHITE;
      const color = prop?.mortgaged ? paleOf(base) : base;
      if (part.color !== color) {
        part.color = color;
        part.mesh.material = tint(color);
        part.levels.children.forEach((m) => { m.material = tint(color); });
      }
      if (setLevels(part, prop?.level ?? 0, color)) shadows = true;
    });

    if (v.festival) {
      const f = tileFrame(v.festival.pos);
      festivalMark.position.set(f.x, 3.4, f.z);
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
        const blob = new THREE.Mesh(blobGeo, blobMat);
        scene.add(mesh, blob);
        pawn = { mesh, blob, shown: p.pos, goal: p.pos, queue: [], t: 0, from: null, to: null, player: p };
        mesh.position.copy(pawnSpot(p, p.pos));
        mesh.rotation.y = pawnFacing(p.pos);
        blob.position.set(mesh.position.x, 0.012, mesh.position.z);
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
        pawn.mesh.rotation.y = pawnFacing(p.pos);
        pawn.blob.position.set(pawn.mesh.position.x, 0.012, pawn.mesh.position.z);
      } else if (forward <= 14) {
        for (let i = 1; i <= forward; i += 1) pawn.queue.push({ pos: (pawn.shown + i) % 48, jump: 0.42 });
      } else {
        pawn.queue.push({ pos: p.pos, jump: 5 }); // un vol ou un renvoi à la Douane : un grand saut
      }
    }

    if (v.dice && v.rollN !== lastRollN) {
      const first = lastRollN === -1;
      lastRollN = v.rollN;
      dice.forEach((d, i) => {
        d.visible = true;
        d.rotation.set(...DIE_TOP[v.dice[i]]);
        d.position.y = 0.6;
      });
      if (!first && !reduced) diceAnim = { t: 0, values: v.dice.slice() };
    }

    aim(v);
    if (shadows || first) renderer.shadowMap.needsUpdate = true;
    first = false;
    wake();
  }
  let first = true;
  renderer.shadowMap.needsUpdate = true;
  ro.observe(host);

  function setOverview(on) {
    overview = on;
    userUntil = 0;
    if (view) aim(view);
    else showAll();
    wake();
  }

  return {
    update,
    setOverview,
    isOverview: () => overview,
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
