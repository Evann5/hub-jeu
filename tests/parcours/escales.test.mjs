// Parcours Escales, avec 3 robots : les lignes du milieu du plateau se lisent une par une, et le journal dit « tu » au bon endroit.
import { monterSuite, aller } from './aide.mjs';

const S = monterSuite();

const NOTER_LES_LIGNES = () => {
  window.__lignes = [];
  new MutationObserver(() => {
    const el = document.querySelector('.es-flash.is-on');
    const t = el?.textContent;
    if (t && window.__lignes.at(-1) !== t) window.__lignes.push(t);
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
};

S.it('Escales : les messages des robots se lisent chacun leur tour, sans jamais parler des dés', async ({ ouvrir }) => {
  const h = await ouvrir(S.pseudo(), { init: NOTER_LES_LIGNES });
  await aller(h, '#/jouer');
  await h.page.getByRole('button', { name: 'Jouer à Escales' }).click();
  await h.page.getByRole('dialog').getByRole('button', { name: 'Créer une partie' }).click();
  await h.page.locator('.lobby-card').waitFor();
  await h.page.getByRole('button', { name: 'Lancer la partie' }).click();
  await h.page.locator('.es-world canvas').waitFor({ state: 'attached', timeout: 60_000 });

  // Joue quelques tours : tout bouton de décision prudent, jusqu'à avoir vu assez de lignes.
  const fin = Date.now() + 75_000;
  let lignes = [];
  while (Date.now() < fin) {
    lignes = await h.page.evaluate(() => window.__lignes);
    if (lignes.length >= 6) break;
    const action = h.page.locator('.es-action:not([hidden])').getByRole('button', { name: /^(Lancer les dés|Un double|Laisser|Passer|Terminer mon tour|Tenter un double|Payer)/ }).first();
    if (await action.count()) await action.click({ timeout: 1000 }).catch(() => {});
    await h.page.waitForTimeout(300);
  }
  if (lignes.length < 6) throw new Error(`trop peu de lignes lues : ${JSON.stringify(lignes)} ; action à l’écran : ${JSON.stringify((await h.page.locator(".es-action").innerText().catch(() => "")).slice(0, 300))}`);
  const des = lignes.filter((t) => / lance \d|Tu lances/.test(t));
  if (des.length) throw new Error(`les dés ne doivent pas s'afficher en ligne : ${JSON.stringify(des)}`);
  const pseudo = lignes.filter((t) => t.startsWith(`${h.pseudo} `));
  if (pseudo.length) throw new Error(`une ligne sur moi doit dire « tu » : ${JSON.stringify(pseudo)}`);
  if (h.erreurs.length) throw new Error(`erreurs JavaScript : ${h.erreurs.join(' ; ')}`);
});
