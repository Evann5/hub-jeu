// Le personnage d'un membre, dessiné avec le même code 3D que les pions d'Escales : ce qu'on voit dans le profil est ce que les autres voient en partie.
// Deux cadrages : en pied (profil, fiche d'un membre) et la tête seule (l'avatar, partout dans le hub).
// three et les personnages ne se chargent qu'à la première image demandée. Chaque image n'est dessinée qu'une fois.
import { state } from './store.js';

const SIZE = { body: 320, head: 128 };
const shots = new Map();
let kit = null;

async function load() {
  kit ??= (async () => {
    // Mêmes adresses que dans Escales (le ?v= compris) : three n'est chargé qu'une fois, même si une partie est ouverte ensuite.
    const THREE = await import('../games/escales/client/three/three.module.js?v=r186');
    const { buildCharacter, bake } = await import('../games/escales/client/monuments.js');
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#FFFFFF', '#BAC4D4', 1.9));
    const light = new THREE.DirectionalLight('#FFE9CF', 2.3);
    light.position.set(-3, 6, 5);
    scene.add(light);
    const lens = new THREE.PerspectiveCamera(24, 1, 0.05, 100);
    return { THREE, buildCharacter, bake, renderer, scene, lens };
  })();
  return kit;
}

// Les couleurs du personnage en hex, prêtes pour le dessin 3D (les jeux reçoivent la même chose par api.character).
export function lookOf(character) {
  const o = state.options?.character;
  if (!character || !o || character.v !== 2) return null;
  return {
    ...character,
    skin: o.skins[character.skin],
    hair: o.hairs[character.hair],
    top: o.clothes[character.top],
    bottom: o.clothes[character.bottom],
    shoes: o.clothes[character.shoes] ?? o.clothes.noir,
  };
}

// Une image (data URL) du personnage. head : la tête seule (avatar) ; turn : l'angle, en radians. null si le navigateur ne sait pas dessiner en 3D.
export async function characterImage(character, { head = false, turn = 0.35 } = {}) {
  const look = lookOf(character);
  if (!look) return null;
  const key = JSON.stringify([look, head, Math.round(turn * 100)]);
  if (shots.has(key)) return shots.get(key);
  try {
    const { THREE, buildCharacter, bake, renderer, scene, lens } = await load();
    const size = head ? SIZE.head : SIZE.body;
    renderer.setSize(size, size, false);
    if (head) {
      lens.position.set(0, 0.86, 1.45); // la tête et le haut du chapeau, bien centrés dans un rond
      lens.lookAt(0, 0.8, 0);
    } else {
      lens.position.set(0, 0.7, 2.85); // en pied, chapeau et planche de surf compris
      lens.lookAt(0, 0.58, 0);
    }
    const mesh = new THREE.Mesh(bake([{ object: buildCharacter(0, look.top, look) }], { fullColor: true }), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.rotation.y = head ? 0.2 : turn;
    scene.add(mesh);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, lens);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    if (shots.size > 300) shots.clear(); // les angles du créateur s'accumulent : on repart à zéro de temps en temps
    shots.set(key, url);
    return url;
  } catch (err) {
    console.error(err);
    return null;
  }
}

// Une image prête à poser dans la page ; elle se remplit dès que le dessin est prêt (ou se cache si la 3D n'est pas disponible).
export function characterPicture(character, cls = 'character-pic', options = {}) {
  const img = document.createElement('img');
  img.className = cls;
  img.alt = '';
  img.decoding = 'async';
  characterImage(character, options).then((url) => {
    if (url) img.src = url;
    else img.hidden = true;
  });
  return img;
}
