// Garde-fous de la démo (npm run demo) : jamais en production, jamais sur la vraie base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { problemeDemo, problemeBase, dossierDemo } from '../scripts/demo-garde.mjs';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');

test('la démo refuse NODE_ENV=production, quelle que soit la casse', () => {
  assert.match(problemeDemo({ env: { NODE_ENV: 'production' }, racine }), /NODE_ENV=production/);
  assert.match(problemeDemo({ env: { NODE_ENV: 'Production' }, racine }), /refuse/);
  assert.equal(problemeDemo({ env: { NODE_ENV: 'development' }, racine }), null);
  assert.equal(problemeDemo({ env: {}, racine }), null);
});

test('la démo refuse un DATA_DIR qui n’est pas data/demo (la vraie base en particulier)', () => {
  assert.match(problemeDemo({ env: { DATA_DIR: join(racine, 'data') }, racine }), /DATA_DIR/);
  assert.match(problemeDemo({ env: { DATA_DIR: join(racine, 'data', 'demo', '..') }, racine }), /DATA_DIR/);
  assert.match(problemeDemo({ env: { DATA_DIR: '/var/www/hubuno/data' }, racine }), /DATA_DIR/);
  assert.equal(problemeDemo({ env: { DATA_DIR: dossierDemo(racine) }, racine }), null);
});

test('la démo ne touche pas à une base qui a des comptes mais pas la marque « démo »', () => {
  assert.match(problemeBase({ nbComptes: 12, marque: undefined }), /ne viennent pas de la démo/);
  assert.match(problemeBase({ nbComptes: 1, marque: '0' }), /--neuf/);
  assert.equal(problemeBase({ nbComptes: 0, marque: undefined }), null); // dossier neuf : on remplit
  assert.equal(problemeBase({ nbComptes: 13, marque: '1' }), null); // démo existante : on relance
});

// Le vrai script, lancé pour de bon : il doit s'arrêter avant d'écrire quoi que ce soit.
function lancer(env) {
  const reelle = join(racine, 'data', 'hubuno.sqlite');
  const avant = existsSync(reelle) ? statSync(reelle).mtimeMs : null;
  const demoExistait = existsSync(dossierDemo(racine));
  const r = spawnSync(process.execPath, [join(racine, 'scripts', 'demo.mjs')], {
    cwd: racine, encoding: 'utf8', timeout: 15_000, env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
  });
  assert.equal(existsSync(dossierDemo(racine)), demoExistait, 'le script ne doit rien créer quand il refuse');
  if (avant !== null) assert.equal(statSync(reelle).mtimeMs, avant, 'la vraie base ne doit pas être touchée');
  return r;
}

test('npm run demo avec NODE_ENV=production : refus net, code 1, rien écrit', () => {
  const r = lancer({ NODE_ENV: 'production' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /DÉMO REFUSÉE/);
  assert.match(r.stderr, /production/);
});

test('npm run demo avec DATA_DIR vers la vraie base : refus net, code 1, rien écrit', () => {
  const r = lancer({ DATA_DIR: join(racine, 'data') });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /DÉMO REFUSÉE/);
});
