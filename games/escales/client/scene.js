// Le monde d'Escales en 3D : une île-plateau dans la mer, des monuments sur les cases, des pions qui sautent, une caméra qui suit.
// Ce fichier ne connaît pas les règles : il reçoit l'état avec update(view) et signale les cases touchées avec onTile(pos).
import * as THREE from './three/three.module.js';
import { REGIONS, TILES } from './board.js';
import { buildMonument, buildSpecial, mat } from './monuments.js';

export const PAWN_COLORS = ['#FFFFFF', '#FFD400', '#FF3D8B', '#00D5C0', '#FF7A1A', '#9B5CFF', '#2F7BFF', '#22C55E', '#E5213C', '#14162B'];

const TILE_W = 2; // largeur d'une case le long du côté
const TILE_D = 3; // profondeur
const HALF = (11 * TILE_W + 2 * TILE_D) / 2;
const REDUCED = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Centre de chaque case et rotation pour que l'avant du monument regarde le centre du plateau.
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

function roundedPlate(w, d, h, r) {
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
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 5 });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// L'étiquette d'une case : le nom et le prix ou le loyer, dessinés sur une petite image.
function makeLabel() {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 112;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(1.9, 0.665, 1);
  sprite.renderOrder = 2;
  let last = '';
  sprite.userData.draw = (name, sub, tint) => {
    const key = `${name}|${sub}|${tint}`;
    if (key === last) return;
    last = key;
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, 320, 112);
    c.fillStyle = 'rgba(255,255,255,0.96)';
    c.beginPath();
    c.roundRect(4, 4, 312, 104, 24);
    c.fill();
    if (tint) {
      c.fillStyle = tint;
      c.beginPath();
      c.roundRect(4, 4, 18, 104, [24, 0, 0, 24]);
      c.fill();
    }
    c.fillStyle = '#0B1026';
    let size = 40;
    do {
      c.font = `800 ${size}px "ES Figtree", system-ui, sans-serif`;
      size -= 2;
    } while (c.measureText(name).width > 276 && size > 20);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(name, 166, sub ? 40 : 56);
    if (sub) {
      c.font = '700 30px "ES Figtree", system-ui, sans-serif';
      c.fillStyle = '#3B4470';
      c.fillText(sub, 166, 80);
    }
    texture.needsUpdate = true;
  };
  return sprite;
}

function makePawn(color) {
  const pts = [[0, 0], [0.34, 0], [0.34, 0.08], [0.2, 0.16], [0.13, 0.5], [0.2, 0.56], [0.1, 0.62]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05 }));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), body.material);
  head.position.y = 0.74;
  body.castShadow = true;
  head.castShadow = true;
  g.add(body, head);
  return g;
}

// Un dé : chaque face est une petite image avec ses points.
function makeDie() {
  const faces = [3, 4, 1, 6, 2, 5]; // +x, -x, +y, -y, +z, -z
  const dots = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
  const mats2 = faces.map((n) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const c = canvas.getContext('2d');
    c.fillStyle = '#FFFFFF';
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = n === 1 ? '#E5213C' : '#0B1026';
    for (const [x, y] of dots[n]) {
      c.beginPath();
      c.arc(28 + x * 36, 28 + y * 36, n === 1 ? 20 : 12, 0, Math.PI * 2);
      c.fill();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 });
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), mats2);
  m.castShadow = true;
  return m;
}
// Rotation qui met la face voulue sur le dessus.
const DIE_TOP = {
  1: [0, 0, 0],
  2: [Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
  5: [-Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0],
};

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function createWorld(host, { onTile }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Le plateau en 3D : une île carrée de 48 cases, avec un monument par ville. La liste des villes est aussi dans le bouton Villes.');

  const SKY = new THREE.Color('#8FE3F7');
  const scene = new THREE.Scene();
  scene.background = SKY;
  scene.fog = new THREE.Fog(SKY, 62, 130);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 300);

  scene.add(new THREE.HemisphereLight('#FFFFFF', '#5BB7C9', 1.5));
  const sun = new THREE.DirectionalLight('#FFF3D6', 2.6);
  sun.position.set(-18, 34, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const b = HALF + 6;
  Object.assign(sun.shadow.camera, { left: -b, right: b, top: b, bottom: -b, near: 1, far: 90 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.shadow.intensity = 0.62;
  sun.shadow.radius = 5;
  scene.add(sun);

  // La mer, le socle de l'île, le lagon au centre
  const sea = new THREE.Mesh(new THREE.CircleGeometry(220, 48), mat('#18BFD2', { roughness: 0.45, flatShading: false }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.9;
  sea.receiveShadow = true;
  scene.add(sea);
  const land = new THREE.Mesh(roundedPlate(HALF * 2 + 1, HALF * 2 + 1, 0.9, 1.6), mat('#F6DE9E'));
  land.position.y = -0.9;
  land.receiveShadow = true;
  land.castShadow = true;
  scene.add(land);
  const inner = HALF * 2 - TILE_D * 2 - 0.5;
  const lagoon = new THREE.Mesh(roundedPlate(inner, inner, 0.06, 2.2), mat('#22D3DF', { flatShading: false, roughness: 0.35 }));
  lagoon.position.y = 0.03;
  lagoon.receiveShadow = true;
  scene.add(lagoon);

  // Au centre : deux îlots, des palmiers
  const decor = new THREE.Group();
  const palm = (x, z, s = 1) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.13 * s, 1.5 * s, 6), mat('#8A5A36'));
    trunk.position.set(x, 0.75 * s + 0.36, z);
    trunk.castShadow = true;
    decor.add(trunk);
    for (let i = 0; i < 5; i += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16 * s, 1 * s, 4), mat(i % 2 ? '#22B573' : '#17A05F'));
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 0.42 * s, 1.5 * s + 0.36, z + Math.sin(a) * 0.42 * s);
      leaf.rotation.set(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25);
      leaf.castShadow = true;
      decor.add(leaf);
    }
  };
  for (const [x, z, r] of [[-6.2, -5.4, 2.1], [6.4, 5.6, 2.6], [6.6, -6.2, 1.2]]) {
    const isle = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r, 0.3, 14), mat('#F6DE9E'));
    isle.position.set(x, 0.24, z);
    isle.receiveShadow = true;
    isle.castShadow = true;
    decor.add(isle);
  }
  palm(-6.6, -5.6, 1.1); palm(-5.4, -4.9, 0.8); palm(6.9, 5.2, 1.2); palm(5.6, 6.3, 0.9); palm(6.3, 4.4, 0.7);
  scene.add(decor);

  // Un petit voilier et un avion qui tournent, des nuages
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 1), mat('#FFFFFF'));
  hull.position.y = 0.05;
  const sail = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.15, 3), mat('#FF3D8B'));
  sail.position.y = 0.7;
  sail.scale.x = 0.2;
  hull.castShadow = true;
  sail.castShadow = true;
  boat.add(hull, sail);
  scene.add(boat);

  const plane = new THREE.Group();
  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.3, 4, 10), mat('#FFFFFF', { flatShading: false }));
  fus.rotation.x = Math.PI / 2;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.42), mat('#E5213C'));
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.3), mat('#E5213C'));
  tail.position.set(0, 0.26, -0.72);
  const tailW = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.04, 0.24), mat('#E5213C'));
  tailW.position.set(0, 0.05, -0.72);
  for (const m of [fus, wing, tail, tailW]) m.castShadow = true;
  plane.add(fus, wing, tail, tailW);
  scene.add(plane);

  const clouds = [];
  for (let i = 0; i < 7; i += 1) {
    const c = new THREE.Group();
    for (let j = 0; j < 4; j += 1) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + (j % 3) * 0.4, 1), mat('#FFFFFF', { roughness: 1 }));
      puff.position.set(j * 1.1 - 1.6, (j % 2) * 0.32, (j % 2) * 0.4);
      puff.scale.y = 0.65;
      puff.castShadow = i % 2 === 0;
      c.add(puff);
    }
    c.position.set((i - 3) * 13, 9 + (i % 3) * 2.4, ((i * 17) % 60) - 30);
    clouds.push(c);
    scene.add(c);
  }

  // ——— Les cases ———
  const plates = [];
  const parts = TILES.map((t) => {
    const f = tileFrame(t.pos);
    const g = new THREE.Group();
    g.position.set(f.x, 0, f.z);
    g.rotation.y = f.rot;
    const w = f.corner ? TILE_D : TILE_W;
    const color = t.type === 'city' ? REGIONS[t.region].color
      : { start: '#22C55E', customs: '#5B7FE0', festival: '#FF5C9E', control: '#FF6B4A', escale: '#EDF2FA', telex: '#FFF3BF', tax: '#FFE08A', chantier: '#D8DCE6' }[t.type];
    const rim = new THREE.Mesh(roundedPlate(w - 0.1, TILE_D - 0.1, 0.1, 0.22), mat('#FFFFFF'));
    rim.position.y = 0;
    rim.receiveShadow = true;
    const plate = new THREE.Mesh(roundedPlate(w - 0.26, TILE_D - 0.26, 0.2, 0.18), mat(color));
    plate.position.y = 0.05;
    plate.receiveShadow = true;
    plate.castShadow = true;
    plate.userData.pos = t.pos;
    plates.push(plate, rim);
    rim.userData.pos = t.pos;
    g.add(rim, plate);
    const top = 0.32;
    const model = t.type === 'city' ? buildMonument(t.model) : buildSpecial(t.type);
    model.position.set(0, top, f.corner ? 0 : -0.42);
    if (t.type !== 'city' && !f.corner) model.scale.setScalar(0.92);
    g.add(model);
    const label = makeLabel();
    label.position.set(0, 0.86, f.corner ? 1.1 : 1.08);
    g.add(label);
    // Le drapeau du propriétaire, caché tant que la ville est libre
    const flag = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.05, 6), mat('#22242E'));
    pole.position.y = 0.52;
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.3, 0.02), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.6 }));
    cloth.position.set(0.26, 0.88, 0);
    pole.castShadow = true;
    cloth.castShadow = true;
    flag.add(pole, cloth);
    flag.position.set(w / 2 - 0.3, top, TILE_D / 2 - 0.45);
    flag.visible = false;
    g.add(flag);
    const levels = new THREE.Group();
    levels.position.set(-w / 2 + 0.34, top, 0.72);
    g.add(levels);
    scene.add(g);
    return { g, plate, rim, label, flag, cloth, levels, level: 0, festival: null, model };
  });

  function setLevels(p, level) {
    if (p.level === level) return;
    p.level = level;
    p.levels.clear();
    for (let i = 0; i < level; i += 1) {
      const h = 0.28 + i * 0.26;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.26, h, 0.26), mat(['#FFFFFF', '#FFE08A', '#FFB02E', '#FF3D8B'][i]));
      m.position.set(0, h / 2, -i * 0.3);
      m.castShadow = true;
      p.levels.add(m);
    }
  }

  // ——— Les pions et les dés ———
  const pawns = new Map();
  const dice = [makeDie(), makeDie()];
  dice[0].position.set(-1, 1.1, 0.3);
  dice[1].position.set(1, 1.1, -0.3);
  dice.forEach((d) => { d.visible = false; scene.add(d); });
  let diceAnim = null;
  let lastRollN = -1;

  const seatOffset = (seat, count) => {
    if (count <= 1) return [0, 0.45];
    const a = (seat / 10) * Math.PI * 2;
    return [Math.cos(a) * 0.55, 0.45 + Math.sin(a) * 0.45];
  };

  function pawnSpot(p, pos, count) {
    const f = tileFrame(pos);
    const [ox, oz] = seatOffset(p.seat, count);
    const c = Math.cos(f.rot);
    const s = Math.sin(f.rot);
    return new THREE.Vector3(f.x + ox * c + oz * s, 0.32, f.z - ox * s + oz * c);
  }

  // ——— La caméra : autour du centre, ou près du pion qui joue ———
  const cam = { yaw: 0, pitch: 0.92, dist: 56, target: new THREE.Vector3(), wantYaw: 0, wantDist: 56, wantTarget: new THREE.Vector3(), follow: false };
  let userUntil = 0;
  let overview = false;
  let size = { w: 1, h: 1 };

  const baseDist = () => {
    const portrait = size.h / Math.max(1, size.w);
    return 50 + Math.max(0, portrait - 0.9) * 42;
  };

  function aimAt(pos) {
    const f = tileFrame(pos);
    const side = pos < 12 ? 0 : pos < 24 ? 1 : pos < 36 ? 2 : 3;
    // La caméra tourne pour regarder le côté du pion depuis le centre du plateau : son monument vient devant nous.
    const yaw = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][side];
    let d = yaw - cam.wantYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    cam.wantYaw += d;
    cam.wantTarget.set(f.x * 0.8, 0.8, f.z * 0.8);
    cam.wantDist = size.w < size.h ? 34 : 28;
  }

  function showAll() {
    cam.wantTarget.set(0, 0, 0);
    cam.wantDist = baseDist();
  }

  // ——— Toucher, glisser, zoomer ———
  const pointers = new Map();
  let moved = 0;
  let pinch = 0;
  const raycaster = new THREE.Raycaster();
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
      const [a, b2] = [...pointers.values()];
      const gap = Math.hypot(a.x - b2.x, a.y - b2.y);
      if (pinch) cam.wantDist = Math.min(90, Math.max(14, cam.wantDist * (pinch / gap)));
      pinch = gap;
      userUntil = performance.now() + 15000;
    } else if (moved > 6) {
      cam.wantYaw -= dx * 0.006;
      cam.pitch = Math.min(1.35, Math.max(0.45, cam.pitch + dy * 0.003));
      userUntil = performance.now() + 15000;
    }
  };
  const onUp = (e) => {
    pointers.delete(e.pointerId);
    if (moved > 6) return;
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = raycaster.intersectObjects(plates, false)[0];
    if (hit) onTile(hit.object.userData.pos);
  };
  const onWheel = (e) => {
    e.preventDefault();
    cam.wantDist = Math.min(90, Math.max(14, cam.wantDist * (1 + Math.sign(e.deltaY) * 0.08)));
    userUntil = performance.now() + 15000;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const ro = new ResizeObserver(() => {
    size = { w: host.clientWidth || 1, h: host.clientHeight || 1 };
    renderer.setSize(size.w, size.h, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = size.w / size.h;
    // Sur téléphone, la carte du bas cache l'écran : on remonte l'image pour garder le pion visible.
    if (size.w < size.h) camera.setViewOffset(size.w, size.h, 0, size.h * 0.16, size.w, size.h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    if (overview || !cam.follow) showAll();
  });
  ro.observe(host);

  // ——— Mettre le monde à jour avec l'état de la partie ———
  let view = null;
  function update(v) {
    view = v;
    const counts = new Map();
    for (const p of v.players) if (!p.out) counts.set(p.pos, (counts.get(p.pos) || 0) + 1);

    TILES.forEach((t) => {
      const part = parts[t.pos];
      const prop = v.props[t.pos];
      const owner = prop ? v.players.find((p) => p.id === prop.owner) : null;
      part.flag.visible = Boolean(owner);
      if (owner) part.cloth.material.color.set(PAWN_COLORS[owner.seat]);
      part.rim.material = owner ? mat(PAWN_COLORS[owner.seat]) : mat('#FFFFFF');
      part.g.position.y = prop?.mortgaged ? -0.14 : 0;
      setLevels(part, prop?.level ?? 0);
      const sub = t.price
        ? (prop ? (prop.mortgaged ? 'en gage' : `${(v.rents[t.pos] ?? 0).toLocaleString('fr-FR')} €`) : `${t.price.toLocaleString('fr-FR')} €`)
        : '';
      part.label.userData.draw(t.name, sub, owner ? PAWN_COLORS[owner.seat] : null);

      const fest = v.festival?.pos === t.pos;
      if (fest && !part.festival) {
        const balloons = new THREE.Group();
        ['#FF3D8B', '#FFD400', '#00D5C0'].forEach((c, i) => {
          const ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), mat(c, { flatShading: false }));
          ball.position.set((i - 1) * 0.45, 2.6 + i * 0.25, 0);
          balloons.add(ball);
        });
        part.g.add(balloons);
        part.festival = balloons;
      } else if (!fest && part.festival) {
        part.g.remove(part.festival);
        part.festival = null;
      }
    });

    for (const p of v.players) {
      let pawn = pawns.get(p.id);
      if (!pawn) {
        const mesh = makePawn(PAWN_COLORS[p.seat]);
        scene.add(mesh);
        pawn = { mesh, shown: p.pos, queue: [], t: 0, from: null, to: null };
        pawn.mesh.position.copy(pawnSpot(p, p.pos, counts.get(p.pos) || 1));
        pawns.set(p.id, pawn);
      }
      pawn.mesh.visible = !p.out;
      if (p.out) continue;
      if (pawn.goal !== p.pos) {
        pawn.goal = p.pos;
        const forward = (p.pos - pawn.shown + 48) % 48;
        pawn.queue = [];
        if (REDUCED() || forward === 0) {
          pawn.shown = p.pos;
          pawn.mesh.position.copy(pawnSpot(p, p.pos, counts.get(p.pos) || 1));
        } else if (forward <= 14) {
          for (let i = 1; i <= forward; i += 1) pawn.queue.push({ pos: (pawn.shown + i) % 48, jump: 0.75 });
        } else {
          pawn.queue.push({ pos: p.pos, jump: 7 }); // un vol ou un renvoi à la Douane : un grand saut
        }
      } else if (!pawn.queue.length && !pawn.to) {
        pawn.mesh.position.lerp(pawnSpot(p, p.pos, counts.get(p.pos) || 1), 0.4);
      }
      pawn.player = p;
    }

    if (v.dice && v.rollN !== lastRollN) {
      const first = lastRollN === -1;
      lastRollN = v.rollN;
      dice.forEach((d, i) => {
        d.visible = true;
        d.rotation.set(...DIE_TOP[v.dice[i]]);
      });
      if (!first && !REDUCED()) diceAnim = { t: 0, values: v.dice.slice() };
    }

    const cur = v.players[v.cur];
    if (performance.now() > userUntil && !v.over && cur && !overview) {
      cam.follow = true;
      aimAt(cur.pos);
    } else if (v.over) {
      cam.follow = false;
      showAll();
    }
  }

  function setOverview(on) {
    overview = on;
    userUntil = 0;
    if (on) {
      cam.follow = false;
      showAll();
    } else if (view) update(view);
  }

  // ——— La boucle ———
  let last = performance.now();
  let raf = 0;
  const reduced = REDUCED();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // Pions
    for (const pawn of pawns.values()) {
      if (!pawn.to && pawn.queue.length) {
        const step = pawn.queue.shift();
        pawn.from = pawn.mesh.position.clone();
        const count = 1;
        pawn.to = pawnSpot(pawn.player, step.pos, count);
        pawn.toPos = step.pos;
        pawn.jump = step.jump;
        pawn.t = 0;
        pawn.dur = step.jump > 2 ? 0.9 : 0.17;
      }
      if (pawn.to) {
        pawn.t = Math.min(1, pawn.t + dt / pawn.dur);
        const e = ease(pawn.t);
        pawn.mesh.position.lerpVectors(pawn.from, pawn.to, e);
        pawn.mesh.position.y += Math.sin(pawn.t * Math.PI) * pawn.jump;
        const squash = 1 - Math.sin(pawn.t * Math.PI) * 0.12;
        pawn.mesh.scale.set(1 / squash, squash, 1 / squash);
        if (pawn.t >= 1) {
          pawn.shown = pawn.toPos;
          pawn.to = null;
          pawn.mesh.scale.set(1, 1, 1);
        }
      }
    }

    // Dés
    if (diceAnim) {
      diceAnim.t += dt / 0.9;
      const k = Math.min(1, diceAnim.t);
      dice.forEach((d, i) => {
        const [x, y, z] = DIE_TOP[diceAnim.values[i]];
        const spin = (1 - ease(k)) * 16;
        d.rotation.set(x + spin, y + spin * 0.7, z + spin * 0.45);
        d.position.y = 1.1 + Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k) * 3.2;
      });
      if (k >= 1) diceAnim = null;
    }

    // Décor
    if (!reduced) {
      const time = now / 1000;
      boat.position.set(Math.cos(time * 0.13) * 3.6, 0.15, Math.sin(time * 0.13) * 3.6 + 0.4);
      boat.rotation.y = -time * 0.13;
      const a = time * 0.16;
      plane.position.set(Math.cos(a) * 22, 11 + Math.sin(time * 0.5) * 0.6, Math.sin(a) * 22);
      plane.rotation.set(0, -a, 0);
      plane.rotateZ(-0.3);
      for (const [i, c] of clouds.entries()) {
        c.position.x += dt * (0.25 + (i % 3) * 0.12);
        if (c.position.x > 55) c.position.x = -55;
      }
    } else {
      boat.position.set(3.4, 0.15, 2);
      plane.position.set(-16, 11, -10);
    }

    // De près, l'avion et les nuages passeraient devant la caméra : ils sont réservés à la vue d'ensemble.
    const far = cam.dist > 42;
    plane.visible = far;
    for (const c of clouds) c.visible = far;

    // Caméra
    const k = 1 - Math.exp(-dt * (reduced ? 40 : 2.6));
    cam.yaw += (cam.wantYaw - cam.yaw) * k;
    cam.dist += (cam.wantDist - cam.dist) * k;
    cam.target.lerp(cam.wantTarget, k);
    camera.position.set(
      cam.target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
      cam.target.y + Math.sin(cam.pitch) * cam.dist,
      cam.target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
    );
    camera.lookAt(cam.target);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

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
      renderer.dispose();
      canvas.remove();
    },
  };
}
