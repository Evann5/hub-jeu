// Le personnage d'un membre, dessiné avec le même code 3D que les pions d'Escales : ce qu'on voit dans le profil est ce que les autres voient en partie.
// three et les personnages ne se chargent qu'à la première image demandée (la page d'accueil n'en a pas besoin).
// Les images sont gardées : un même personnage n'est dessiné qu'une fois.
import { state } from './store.js';
import { colorOf } from './dom.js';

const SIZE = 320;
const shots = new Map();
let kit = null;

async function load() {
  kit ??= (async () => {
    // Mêmes adresses que dans Escales (le ?v= compris) : three n'est chargé qu'une fois, même si une partie est ouverte ensuite.
    const THREE = await import('../games/escales/client/three/three.module.js?v=r186');
    const { buildCharacter, bake } = await import('../games/escales/client/monuments.js');
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#FFFFFF', '#BAC4D4', 1.9));
    const light = new THREE.DirectionalLight('#FFE9CF', 2.3);
    light.position.set(-3, 6, 5);
    scene.add(light);
    const lens = new THREE.PerspectiveCamera(24, 1, 0.05, 100);
    lens.position.set(0, 0.7, 2.75); // en pied, chapeau compris, sans trop de vide autour
    lens.lookAt(0, 0.56, 0);
    return { THREE, buildCharacter, bake, renderer, scene, lens };
  })();
  return kit;
}

// Les couleurs du personnage en hex, à partir de ce qui est enregistré ({ style, skin, hair }).
export function lookOf(character) {
  const o = state.options?.character;
  if (!character || !o) return null;
  return { style: character.style, skin: o.skins[character.skin], hair: o.hairs[character.hair] };
}

// Une image (data URL) du personnage en pied, la tenue à la couleur du membre. null si le navigateur ne sait pas dessiner en 3D.
export async function characterImage(character, color) {
  const look = lookOf(character);
  if (!look) return null;
  const tint = colorOf(color) || '#4C8DF6';
  const key = JSON.stringify([look, tint]);
  if (shots.has(key)) return shots.get(key);
  try {
    const { THREE, buildCharacter, bake, renderer, scene, lens } = await load();
    const mesh = new THREE.Mesh(bake([{ object: buildCharacter(0, tint, look) }], { fullColor: true }), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.rotation.y = 0.35;
    scene.add(mesh);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, lens);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    shots.set(key, url);
    return url;
  } catch (err) {
    console.error(err);
    return null;
  }
}

// Une image prête à poser dans la page ; elle se remplit dès que le dessin est prêt.
export function characterPicture(character, color, cls = 'character-pic') {
  const img = document.createElement('img');
  img.className = cls;
  img.alt = '';
  img.decoding = 'async';
  characterImage(character, color).then((url) => {
    if (url) img.src = url;
    else img.hidden = true;
  });
  return img;
}
