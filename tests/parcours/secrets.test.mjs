// Parcours « secrets en classe » : sur ordinateur, les influences de Complot restent cachées tant qu'on ne maintient pas
// le clic, et se recachent quand on lâche ; le réglage du Profil les laisse visibles ; sur téléphone, rien n'est caché.
import { monterSuite, aller, jusque, ouvrirTable, rejoindre } from './aide.mjs';

const S = monterSuite();

async function partieDeComplot(ouvrir, vue = {}) {
  const a = await ouvrir(undefined, vue);
  const b = await ouvrir(undefined, vue);
  const adresse = await ouvrirTable(a, 'Complot');
  await rejoindre(b, adresse);
  await a.page.getByRole('button', { name: 'Lancer la partie' }).click();
  await a.page.locator('.cp-mine').waitFor();
  return a;
}
const contenuVisible = (p) => p.page.locator('.cp-mine .secret-content').evaluate((el) => getComputedStyle(el).visibility === 'visible');

S.it('ordinateur : maintenir le clic montre les influences, lâcher les recache', async ({ ouvrir }) => {
  const a = await partieDeComplot(ouvrir);
  const boite = a.page.locator('.cp-mine .secret-box');
  await boite.waitFor();
  if (await contenuVisible(a)) throw new Error('les influences doivent être cachées au départ');
  await boite.hover(); // la souris sur la boîte, telle qu'elle est maintenant (la page a pu bouger)
  await a.page.mouse.down();
  await jusque(() => contenuVisible(a), 'les influences se montrent pendant le clic maintenu');
  await a.page.mouse.up();
  await jusque(async () => !(await contenuVisible(a)), 'les influences se recachent au relâchement');

  // Le réglage du Profil : « Cacher mes secrets » décoché, plus de cache.
  await aller(a, '#/profil');
  await a.page.getByRole('checkbox', { name: /Cacher mon rôle/ }).uncheck();
  await a.page.goBack();
  await a.page.locator('.cp-mine').waitFor();
  await jusque(async () => (await a.page.locator('.cp-mine .secret-box').count()) === 0, 'plus de cache une fois le réglage décoché');
});

S.it('téléphone : rien n’est caché', async ({ ouvrir }) => {
  const a = await partieDeComplot(ouvrir, { viewport: { width: 390, height: 844 }, tactile: true });
  if (await a.page.locator('.secret-box').count()) throw new Error('sur téléphone, les influences ne doivent pas être cachées');
});
