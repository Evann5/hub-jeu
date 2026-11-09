// Parcours Escales, les moments rares qu'une partie normale met longtemps à atteindre : la Douane, une ville en gage,
// une dette impossible à payer et la faillite. La partie est préparée directement dans la base (serveur coupé),
// puis jouée à l'écran comme un vrai joueur. CAPTURES=dossier garde une image de chaque moment.
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { monterSuite, aller, jusque } from './aide.mjs';
import { CUSTOMS_POS, TILES } from '../../games/escales/client/board.js';

const S = monterSuite();
const capture = async (p, nom) => {
  if (process.env.CAPTURES) await p.page.screenshot({ path: join(process.env.CAPTURES, `escales-${nom}.png`) });
};

// Serveur coupé : on réécrit l'état de la partie, puis on redémarre ; la page se reconnecte seule.
async function preparer(id, monId, changer) {
  await S.serveur.couper();
  const db = new DatabaseSync(join(S.serveur.dir, 'hubuno.sqlite'));
  const s = JSON.parse(db.prepare('SELECT state FROM game_tables WHERE id = ?').get(id).state);
  const moi = s.players.find((p) => p.id === monId);
  s.cur = s.players.indexOf(moi);
  s.deadline = null; // pas de minuteur : rien ne joue à ma place pendant le test
  s.armedFor = null;
  s.again = false;
  s.dice = null;
  changer(s, moi);
  db.prepare('UPDATE game_tables SET state = ?, status = ? WHERE id = ?').run(JSON.stringify(s), 'playing', id);
  db.close();
  await S.serveur.demarrer();
}

S.it('Escales : Douane, ville en gage, dette impossible et faillite s’affichent et se jouent', async ({ ouvrir }) => {
  const h = await ouvrir(S.pseudo(), { viewport: { width: 390, height: 844 }, tactile: true });
  await aller(h, '#/jouer');
  await h.page.locator('.game-hero').getByRole('button', { name: 'Jouer à Escales' }).click();
  await h.page.getByRole('dialog').getByRole('button', { name: 'Créer une partie' }).click();
  await h.page.locator('.lobby-card').waitFor();
  const id = Number((await h.page.evaluate(() => location.hash)).match(/\d+/)[0]);
  await h.page.getByRole('button', { name: 'Lancer la partie' }).click();
  await h.page.locator('.es-world canvas').waitFor({ state: 'attached', timeout: 60_000 });
  const monId = await h.page.evaluate(() => fetch('api/me').then((r) => r.json()).then((r) => r.user.id));
  const action = h.page.locator('.es-action:not([hidden])');
  const villes = TILES.map((t, i) => (t.type === 'city' ? i : -1)).filter((i) => i >= 0);

  // 1. La Douane : « Tenter un double » ou « Payer 50 € » ; payer libère.
  await preparer(id, monId, (s, moi) => {
    s.phase = 'roll';
    moi.pos = CUSTOMS_POS;
    moi.blocked = 1;
    moi.cash = 900;
    s.props[villes[0]] = { owner: monId, level: 0, mortgaged: true };
    s.props[villes[1]] = { owner: monId, level: 0, mortgaged: false };
  });
  await action.getByText('Retenu à la Douane (essai 1 sur 3).').waitFor({ timeout: 40_000 });
  await action.getByRole('button', { name: 'Tenter un double' }).waitFor();
  await capture(h, '1-douane');
  await action.getByRole('button', { name: 'Payer 50 €' }).click();
  await jusque(async () => !(await action.getByText('Retenu à la Douane').count()), 'la Douane est passée après avoir payé', { delai: 15_000 });
  await capture(h, '2-douane-payee');

  // 2. Une dette qu'on ne peut pas payer, même en vendant tout : seule la faillite reste, avec une confirmation.
  await preparer(id, monId, (s, moi) => {
    s.phase = 'debt';
    moi.pos = villes[2];
    moi.blocked = 0;
    moi.cash = 20;
    s.debt = { amount: 4000, to: null, why: 'pour le test' };
  });
  await action.getByText(/Même en vendant tout/).waitFor({ timeout: 40_000 });
  await capture(h, '3-dette');
  await action.getByRole('button', { name: 'Déclarer faillite' }).click();
  await action.getByRole('button', { name: 'Oui, je déclare faillite' }).click();
  await jusque(async () => !(await action.getByRole('button', { name: /faillite/ }).count()), 'la faillite est jouée', { delai: 15_000 });
  await h.page.waitForTimeout(1500); // le message de faillite s'affiche
  await capture(h, '4-faillite');
  // Le seul humain est sorti : la partie se termine, les robots gagnent, et je figure en dernier, « sorti ».
  await h.page.getByText('Partie terminée').first().waitFor();
  const fin = await h.page.locator('.es').textContent();
  if (!/sorti/.test(fin)) throw new Error('fin de partie inattendue : ' + fin.slice(0, 200));
  if (/ et [^ ]+ et /.test(fin)) throw new Error('liste de noms « A et B et C » : ' + fin.slice(0, 200));
});
