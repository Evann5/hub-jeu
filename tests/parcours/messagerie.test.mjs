// Parcours « messagerie » à plusieurs comptes : messages, réactions, non-lus, repère, bouton « Nouveaux messages »,
// conversations forgées, focus au clavier, flèche Retour sur téléphone.
// Limite du serveur à respecter : 5 messages par 5 s et par personne (les tests restent en dessous, ou répartissent sur plusieurs comptes).
import { monterSuite, jusque, aller, hashDe, appel, ecrire, messagesDe, ouvrirMessages, titre } from './aide.mjs';

const S = monterSuite();
const unique = (m) => `${m} ${S.pseudo('')}`;

S.it('messages : deux comptes se parlent dans le salon, les messages d’une même personne sont groupés et annoncés', async ({ ouvrir }) => {
  const a = await ouvrir();
  const b = await ouvrir();
  await ouvrirMessages(a);
  await ouvrirMessages(b);
  const un = unique('Premier'); const deux = unique('Deuxième');
  await ecrire(a, un);
  await ecrire(a, deux);
  await jusque(async () => (await messagesDe(b)).includes(deux), 'les deux messages arrivent chez B');
  const messages = b.page.locator('.msg', { hasText: deux });
  if (await messages.evaluate((el) => el.classList.contains('first'))) throw new Error('le deuxième message devrait être groupé avec le premier');
  await jusque(async () => (await b.page.locator('#annonces').textContent()).includes(deux), 'le message est annoncé aux lecteurs d’écran');
});

S.it('réactions : on réagit, l’autre compte voit le compteur, on la retire', async ({ ouvrir }) => {
  const a = await ouvrir();
  const b = await ouvrir();
  await ouvrirMessages(a);
  await ouvrirMessages(b);
  const texte = unique('Réagis');
  await ecrire(a, texte);
  const chezB = b.page.locator('.msg', { hasText: texte });
  await chezB.waitFor();
  await chezB.hover();
  await chezB.getByRole('button', { name: 'Réagir', exact: false }).first().click();
  await b.page.locator('.picker button').first().click();
  const chezA = a.page.locator('.msg', { hasText: texte }).locator('.reaction');
  await jusque(async () => (await chezA.count()) === 1 && (await chezA.textContent()).includes('1'), 'A voit la réaction avec le compteur 1');
  if ((await chezA.getAttribute('aria-pressed')) !== 'false') throw new Error('A n’a pas réagi lui-même');
  const reaction = chezB.locator('.reaction');
  await jusque(async () => (await reaction.getAttribute('aria-pressed')) === 'true', 'B voit sa réaction marquée comme la sienne');
  await reaction.click(); // un second appui la retire
  await jusque(async () => (await chezA.count()) === 0, 'la réaction disparaît chez A');
});

S.it('non-lus : pastille et titre comptent les messages reçus, le repère « Nouveaux messages » les précède, tout se vide à la lecture', async ({ ouvrir }) => {
  const a = await ouvrir();
  const b = await ouvrir();
  await aller(a, '#/membres');
  await a.page.locator('.member-grid').waitFor();
  await ouvrirMessages(b);
  const m1 = unique('Non lu un'); const m2 = unique('Non lu deux');
  await ecrire(b, m1);
  await ecrire(b, m2);
  await jusque(async () => /^\(2\) /.test(await titre(a)), 'le titre de A annonce 2 non lus');
  await jusque(async () => (await a.page.locator('.navbar .nav-badge').first().textContent()) === '2', 'la pastille de la navigation affiche 2');

  await aller(a, '#/messages');
  await a.page.locator('.new-line').waitFor();
  const suivant = await a.page.locator('.new-line + .msg .msg-body').textContent();
  if (suivant !== m1) throw new Error(`le repère devrait précéder « ${m1} », il précède « ${suivant} »`);
  if ((await a.page.locator('.new-line').textContent()) !== 'Nouveaux messages') throw new Error('texte du repère');
  await jusque(async () => !/^\(/.test(await titre(a)), 'les non-lus sont remis à zéro à la lecture');
  if (await a.page.locator('.conv-item.has-unread').count() !== 0) throw new Error('un canal reste marqué non lu');
});

S.it('lecture plus haut : le bouton « Nouveaux messages » apparaît, ramène en bas et disparaît', async ({ ouvrir }) => {
  const a = await ouvrir();
  const c = await ouvrir();
  const lecteur = await ouvrir();
  await ouvrirMessages(a);
  await ouvrirMessages(c);
  await ouvrirMessages(lecteur);
  // Trois messages d'un compte, deux d'un autre : sous la limite de 5 messages par 5 s pour chacun.
  for (const [p, m] of [[a, 'Long un'], [c, 'Long deux'], [a, 'Long trois'], [c, 'Long quatre'], [a, 'Long cinq']]) {
    const marque = `${m} ${S.pseudo('')}`;
    await ecrire(p, `${marque}\n${'ligne\n'.repeat(12)}`, marque);
  }
  await jusque(async () => (await messagesDe(lecteur)).filter((t) => t.startsWith('Long ')).length === 5, 'le lecteur a reçu les cinq messages');
  await lecteur.page.evaluate(() => { document.querySelector('.messages').scrollTop = 0; });
  await jusque(() => lecteur.page.evaluate(() => document.querySelector('.messages').scrollTop === 0), 'le lecteur est en haut');
  const nouveau = unique('Nouveau pendant la lecture');
  await ecrire(a, nouveau);
  await lecteur.page.locator('.jump-new').waitFor({ state: 'visible' });
  await lecteur.page.locator('.jump-new').click();
  await lecteur.page.locator('.jump-new').waitFor({ state: 'hidden' });
  await jusque(() => lecteur.page.evaluate(() => { const m = document.querySelector('.messages'); return m.scrollHeight - m.scrollTop - m.clientHeight < 80; }), 'la liste est revenue en bas');
});

S.it('adresse de conversation forgée : le serveur la refuse et aucun non-lu fantôme n’apparaît', async ({ ouvrir }) => {
  const a = await ouvrir();
  const b = await ouvrir();
  await aller(a, '#/membres');
  await a.page.locator('.member-grid').waitFor();
  for (const scope of ['c:01', 'c:1:99', 'dm:1', 'c:99999', 't:99999']) {
    const r = await appel(b, 'send', { scope, body: 'fantôme' });
    if (r?.ok !== false || !r.error) throw new Error(`${scope} aurait dû être refusé : ${JSON.stringify(r)}`);
  }
  // Un vrai message sert de repère : si les refus avaient laissé des non-lus, A en compterait plus d'un.
  await ouvrirMessages(b);
  await ecrire(b, unique('Vrai message'));
  await jusque(async () => /^\(1\) /.test(await titre(a)), 'A compte exactement 1 non-lu');
  // Une adresse d'écran inventée ne casse rien (l'erreur JavaScript éventuelle fait échouer le test).
  await aller(a, '#/c/99999');
  await jusque(async () => (await a.page.locator('.navbar').count()) === 1 && !(await hashDe(a)).startsWith('#/c/99999'), 'un canal inconnu renvoie vers un écran valide');
});

S.it('focus au clavier : un message qui arrive ne le fait pas sauter, ni ne ferme le menu des réactions', async ({ ouvrir }) => {
  const a = await ouvrir();
  const b = await ouvrir();
  await ouvrirMessages(a);
  await ouvrirMessages(b);
  await ecrire(a, unique('Premier'));
  await jusque(async () => (await b.page.locator('.msg').count()) >= 1, 'B voit un message');
  const dernier = b.page.locator('.msg').last();
  await dernier.locator('.msg-tools button').first().focus();
  const suivant = unique('Pendant le focus');
  await ecrire(a, suivant);
  await jusque(async () => (await messagesDe(b)).includes(suivant), 'le message arrive chez B');
  if (!(await b.page.evaluate(() => document.activeElement.closest('.msg-tools') !== null))) throw new Error('le focus a quitté les outils du message');

  // Le menu des réactions reste ouvert à l'arrivée d'un message ; Échap rend le focus au bouton.
  await b.page.keyboard.press('Enter');
  await b.page.locator('.picker').waitFor();
  const encore = unique('Pendant le menu');
  await ecrire(a, encore);
  await jusque(async () => (await messagesDe(b)).includes(encore), 'le deuxième message arrive chez B');
  if (await b.page.locator('.picker').count() !== 1) throw new Error('le menu des réactions s’est fermé');
  await b.page.keyboard.press('Escape');
  await b.page.locator('.picker').waitFor({ state: 'detached' });
  if (!(await b.page.evaluate(() => document.activeElement.closest('.msg-tools') !== null))) throw new Error('Échap n’a pas rendu le focus au bouton Réagir');

  // La navigation au clavier garde aussi son focus quand un message arrive.
  await b.page.locator('a[href="#/membres"]').first().focus();
  const dernierMot = unique('Pendant la navigation');
  await ecrire(a, dernierMot);
  await jusque(async () => (await messagesDe(b)).includes(dernierMot), 'le troisième message arrive chez B');
  if ((await b.page.evaluate(() => document.activeElement.getAttribute?.('href'))) !== '#/membres') throw new Error('le focus a quitté la navigation');
});

for (const [nom, viewport] of [['portrait', { width: 390, height: 844 }], ['paysage', { width: 844, height: 390 }]]) {
  S.it(`flèche Retour d’une conversation (téléphone en ${nom}) : retour à la liste, et le Retour du navigateur ne la rouvre pas`, async ({ ouvrir }) => {
    const p = await ouvrir(S.pseudo(), { viewport, tactile: true });
    await aller(p, '#/');
    await jusque(async () => (await hashDe(p)) === '#/', 'accueil');
    await aller(p, '#/messages');
    await p.page.locator('.conv-item').first().waitFor();
    await p.page.locator('.conv-item').first().click();
    await p.page.locator('.composer textarea').waitFor();
    await p.page.locator('.back').click();
    await jusque(async () => (await hashDe(p)) === '#/messages', 'la flèche ramène à la liste');
    await p.page.goBack();
    await jusque(async () => !(await hashDe(p)).startsWith('#/c/'), 'Retour ne rouvre pas la conversation');
  });
}
