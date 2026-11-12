// Parcours « ce qu'on attend de moi » : invitation qui laisse une trace, « À toi de jouer » visible depuis un autre écran,
// adversaire hors ligne, non-lus partagés entre deux onglets du même compte.
import { monterSuite, jusque, aller, ouvrirMessages, ouvrirTable, rejoindre, ecrire, titre } from './aide.mjs';

const S = monterSuite();

S.it('invitation : la notification ne recouvre pas la zone d’écriture, et la partie reste marquée « Invité par » sur Jouer', async ({ ouvrir }) => {
  const hote = await ouvrir();
  const invite = await ouvrir();
  await ouvrirMessages(invite);
  await invite.page.locator('.composer textarea').fill('Un brouillon en cours');
  await ouvrirTable(hote, 'Morpion');
  await hote.page.getByRole('button', { name: 'Inviter' }).click();
  await hote.page.getByRole('dialog').locator('.invite-row', { hasText: invite.pseudo }).click();
  await hote.page.getByRole('dialog').getByRole('button', { name: 'Inviter' }).click();
  const toast = invite.page.locator('.toast', { hasText: 't’invite à jouer' });
  await toast.waitFor();
  const [t, c] = await Promise.all([toast.boundingBox(), invite.page.locator('.composer-wrap').boundingBox()]);
  if (t.y + t.height > c.y) throw new Error(`la notification (bas à ${Math.round(t.y + t.height)} px) recouvre la zone d’écriture (haut à ${Math.round(c.y)} px)`);
  await invite.page.locator('.composer textarea').click(); // le champ reste cliquable
  // La notification passe ; sur Jouer, la partie dit qui a invité et vient avant celles des autres.
  await toast.locator('.toast-close').click();
  await aller(invite, '#/jouer');
  const ligne = invite.page.locator('.table-row.is-invited');
  await ligne.waitFor();
  if (!(await ligne.textContent()).includes(`Invité par ${hote.pseudo}`)) throw new Error('la ligne de la partie ne dit pas qui a invité');
  await ligne.click(); // « Rejoindre » assoit directement
  await invite.page.locator('.lobby-seat:not(.empty)').nth(1).waitFor();
  await aller(invite, '#/jouer');
  await invite.page.locator('.table-row').first().waitFor();
  if (await invite.page.locator('.table-row.is-invited').count()) throw new Error('une fois assis, la partie ne doit plus être marquée comme une invitation');
});

S.it('« À toi de jouer » dans le titre de l’onglet depuis un autre écran ; un adversaire parti est signalé hors ligne', async ({ ouvrir }) => {
  const a = await ouvrir();
  const b = await ouvrir();
  const adresse = await ouvrirTable(a, 'Morpion');
  await rejoindre(b, adresse);
  await a.page.getByRole('button', { name: 'Lancer la partie' }).click();
  for (const p of [a, b]) await p.page.locator('.mp-board').waitFor();
  const aLaMain = (p) => p.page.locator('.table-head').textContent().then((t) => t.includes('À toi de jouer'));
  await jusque(async () => (await aLaMain(a)) || (await aLaMain(b)), 'quelqu’un a la main');
  const [joueur, autre] = (await aLaMain(a)) ? [a, b] : [b, a];
  // L'autre part lire les messages ; le joueur joue : c'est maintenant à l'autre, qui le voit dans le titre de son onglet.
  await ouvrirMessages(autre);
  if ((await titre(autre)).includes('À toi de jouer')) throw new Error('le titre annonce un tour qui n’est pas le sien');
  await joueur.page.locator('.mp-cell').first().click();
  await jusque(async () => (await titre(autre)).includes('À toi de jouer'), 'le titre de l’onglet annonce « À toi de jouer »');
  // L'autre ferme son onglet sans jouer : le joueur voit qu'il est hors ligne, pas qu'il « réfléchit ».
  await autre.page.close();
  await jusque(async () => (await joueur.page.locator('.table-head').textContent()).includes(`${autre.pseudo} est hors ligne`), 'l’en-tête de la partie signale l’adversaire hors ligne');
});

S.it('deux onglets du même compte : lire dans l’un retire la pastille de l’autre', async ({ ouvrir }) => {
  const a = await ouvrir();
  const b = await ouvrir();
  const b2 = await b.contexte.newPage();
  await b2.goto(S.serveur.url);
  await b2.locator('.navbar').waitFor();
  await aller(b, '#/membres');
  await ouvrirMessages(a);
  await ecrire(a, `Pour les deux onglets ${S.pseudo('')}`);
  await jusque(async () => /^\(1\) /.test(await titre(b)) && /^\(1\) /.test(await b2.title()), 'les deux onglets annoncent 1 non-lu');
  await aller(b, '#/c/1');
  await jusque(async () => !/^\(/.test(await titre(b)), 'le premier onglet a lu');
  await jusque(async () => !/^\(/.test(await b2.title()), 'la pastille part aussi dans le second onglet');
});
