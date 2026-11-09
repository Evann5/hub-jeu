// Garde-fou : une espace insécable est de la typographie de texte. Dans un dessin SVG ou une couleur, elle casse l'affichage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (['three', 'assets'].includes(name)) return [];
  return statSync(path).isDirectory() ? walk(path) : [path];
});

test('aucune espace insécable dans un tracé SVG, une couleur ou une transformation', () => {
  const dessin = /viewBox|<path|<circle|<rect|<svg|\bd: '|transform|rgba?\(|hsl\(|translate\(|rotate\(|points:|preserveAspectRatio/;
  const fautes = [];
  for (const file of [...walk('games'), ...walk('public/js')]) {
    if (!/\.js$/.test(file) || file.endsWith('.test.js')) continue;
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (dessin.test(line) && line.includes(' ')) fautes.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(fautes, []);
});
