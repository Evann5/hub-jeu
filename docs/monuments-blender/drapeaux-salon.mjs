// Les drapeaux du salon, dessinés par le code du jeu : les mêmes que sur le plateau, et lisibles partout, Windows compris (les emojis de drapeaux n'y existent pas).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const pw = createRequire('/Users/bui/.claude/toolkit/outils/')('playwright');
const ROOT = '/Users/bui/Hub jeu/games/escales/';
const b = await pw.chromium.launch({ channel: 'chromium' });
const page = await b.newPage();
await page.route('**/*', (r) => r.fulfill({ body: '<!doctype html><title>x</title>', contentType: 'text/html' }));
await page.goto('http://drapeaux.local/');
const code = readFileSync(`${ROOT}client/countries.js`, 'utf8');
const ids = JSON.parse(readFileSync(`${ROOT}game.json`, 'utf8')).options.find((o) => o.key === 'countries').choices.map((c) => c.value);
const out = await page.evaluate(async ([src, list]) => {
  const { FLAGS } = await import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  const res = {};
  for (const id of list) {
    const c = document.createElement('canvas');
    c.width = 72; c.height = 48;
    const g = c.getContext('2d');
    FLAGS[id](g, 0, 0, 72, 48);
    res[id] = c.toDataURL('image/png').split(',')[1];
  }
  return res;
}, [code, ids]);
for (const [id, data] of Object.entries(out)) writeFileSync(`${ROOT}assets/flags/${id}.png`, Buffer.from(data, 'base64'));
console.log(Object.keys(out).length, 'drapeaux');
await b.close();
