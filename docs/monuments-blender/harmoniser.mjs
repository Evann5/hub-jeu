// Aligne les couleurs d'un monument sur celles des monuments d'origine : herbe, eau et sable moins vifs. Sans effet sur un fichier déjà harmonisé.
// Usage : node harmoniser.mjs fichier.glb ...   À relancer après chaque nouvelle construction d'un monument.
import { readFileSync, writeFileSync } from 'node:fs';

// Écarts mesurés le 05/11/2026 entre les 64 nouveaux monuments et les 32 d'origine. [début, fin de teinte, saturation ×, luminosité ×]
const BANDS = [
  [70, 165, 0.75, 1],    // herbe
  [165, 230, 0.76, 0.92], // eau
  [28, 60, 0.82, 0.94],  // sable, pierre claire
];
const toS = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const toL = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
function adjust([r, g, b]) {
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn; const s = mx ? d / mx : 0;
  if (s < 0.12) return [r, g, b];
  let h = 0;
  if (mx === r) h = ((g - b) / d + 6) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  h *= 60;
  const band = BANDS.find(([a, z]) => h >= a && h < z);
  if (!band) return [r, g, b];
  const s2 = s * band[2]; const v2 = mx * band[3];
  const c = v2 * s2; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = v2 - c;
  const [a1, b1, c1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [a1 + m, b1 + m, c1 + m];
}
for (const file of process.argv.slice(2)) {
  const b = readFileSync(file);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen));
  if (json.asset.extras?.harmonise) { console.log('déjà fait', file); continue; }
  const bin = Buffer.from(b.subarray(20 + jsonLen + 8));
  const acc = json.accessors[json.meshes[0].primitives[0].attributes.COLOR_0];
  const view = json.bufferViews[acc.bufferView];
  if (acc.componentType !== 5123) throw new Error(`${file} : format de couleur inattendu`);
  const size = acc.type === 'VEC4' ? 4 : 3;
  const stride = view.byteStride || 2 * size;
  const off = (view.byteOffset || 0) + (acc.byteOffset || 0);
  for (let i = 0; i < acc.count; i += 1) {
    const p = off + i * stride;
    const c = [0, 2, 4].map((k) => toS(bin.readUInt16LE(p + k) / 65535));
    adjust(c).forEach((v, k) => bin.writeUInt16LE(Math.round(toL(Math.min(1, Math.max(0, v))) * 65535), p + k * 2));
  }
  json.asset.extras = { ...json.asset.extras, harmonise: true };
  let text = JSON.stringify(json);
  while (Buffer.byteLength(text) % 4) text += ' ';
  const head = Buffer.alloc(20);
  head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + Buffer.byteLength(text) + 8 + bin.length, 8); head.writeUInt32LE(Buffer.byteLength(text), 12); head.write('JSON', 16);
  const binHead = Buffer.alloc(8); binHead.writeUInt32LE(bin.length, 0); binHead.write('BIN\0', 4);
  writeFileSync(file, Buffer.concat([head, Buffer.from(text), binHead, bin]));
}
