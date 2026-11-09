// Parcours « équipe » : le canal réservé aux modos et aux admins, le journal de modération, les mentions « @pseudo ».
import { join } from 'node:path';
import { monterSuite, aller, appel, jusque, ecrire } from './aide.mjs';

const S = monterSuite();
// TELEPHONE=1 : écran de téléphone ; CAPTURES=dossier : une image des écrans touchés.
const VUE = process.env.TELEPHONE ? { viewport: { width: 390, height: 844 }, tactile: true } : {};
const capture = async (p, nom) => {
  if (process.env.CAPTURES) await p.page.screenshot({ path: join(process.env.CAPTURES, `equipe-${nom}${process.env.TELEPHONE ? '-tel' : ''}.png`) });
};
const monId = (p) => p.page.evaluate(() => fetch('api/me').then((r) => r.json()).then((r) => r.user.id));
const canaux = (p) => p.page.locator('.conv-item .label').allTextContents();

S.it('canal d’équipe : invisible et fermé pour un membre, il apparaît quand il devient modo, et le journal le note', async ({ ouvrir }) => {
  const admin = await S.admin(VUE);
  const m = await ouvrir(undefined, VUE);
  try {
    const mId = await monId(m);
    const cree = await appel(admin, 'admin:createChannel', { name: 'equipe', topic: 'Entre nous', staffOnly: true });
    if (!cree.ok) throw new Error(`création : ${JSON.stringify(cree)}`);
    await aller(admin, '#/messages');
    await jusque(async () => (await canaux(admin)).includes('equipe'), 'l’admin voit #equipe');
    await capture(admin, '1-canaux');
    const id = Number((await admin.page.locator('.conv-item', { hasText: 'equipe' }).getAttribute('href')).slice('#/c/'.length));

    // Le membre ne le voit pas et ne peut ni le lire ni y écrire.
    await aller(m, '#/messages');
    await m.page.locator('.conv-item').first().waitFor();
    if ((await canaux(m)).includes('equipe')) throw new Error('un membre ne doit pas voir #equipe');
    for (const [ev, data] of [['history', { scope: `c:${id}` }], ['send', { scope: `c:${id}`, body: 'intrus' }]]) {
      const r = await appel(m, ev, data);
      if (r.ok) throw new Error(`un membre ne doit pas pouvoir ${ev} dans #equipe`);
    }

    // Nommé modo : le canal apparaît sans recharger ; rétrogradé : il disparaît.
    await appel(admin, 'admin:setRole', { userId: mId, role: 'modo' });
    await jusque(async () => (await canaux(m)).includes('equipe'), 'le nouveau modo voit #equipe sans recharger');
    const ecrit = await appel(m, 'send', { scope: `c:${id}`, body: 'le modo écrit dans l’équipe' });
    if (!ecrit.ok) throw new Error(`le modo doit pouvoir écrire : ${JSON.stringify(ecrit)}`);
    await appel(admin, 'admin:setRole', { userId: mId, role: 'membre' });
    await jusque(async () => !(await canaux(m)).includes('equipe'), '#equipe disparaît chez le membre rétrogradé');

    // Le journal.
    await aller(admin, '#/admin');
    const journal = admin.page.locator('.mod-log');
    await jusque(async () => (await journal.textContent()).includes('a changé le niveau de'), 'le journal note les changements de niveau');
    await journal.scrollIntoViewIfNeeded();
    await capture(admin, '2-journal');
    const texte = await journal.textContent();
    for (const attendu of ['a créé le canal', 'Modérateur', 'Membre', m.pseudo]) if (!texte.includes(attendu)) throw new Error(`le journal devrait citer « ${attendu} » : ${texte.slice(0, 300)}`);
    const refus = await appel(m, 'admin:modLog', {});
    if (refus.ok) throw new Error('un membre ne doit pas lire le journal');
  } finally {
    await admin.contexte.close().catch(() => {});
  }
});

S.it('mentions : « @ » propose les pseudos, le message ressort chez la personne citée, qui est prévenue ailleurs', async ({ ouvrir }) => {
  const a = await ouvrir(undefined, VUE);
  const b = await ouvrir(undefined, VUE);
  await aller(a, '#/c/1');
  const zone = a.page.locator('.composer textarea');
  await zone.waitFor();

  // Suggestions : « @ » + le début du pseudo, Entrée insère.
  await zone.pressSequentially(`coucou @${b.pseudo.slice(0, 4)}`);
  const choix = a.page.locator('.mention-picks li', { hasText: b.pseudo });
  await choix.waitFor();
  await capture(a, '3-suggestions');
  await zone.press('Enter');
  await jusque(async () => (await zone.inputValue()) === `coucou @${b.pseudo} `, 'le pseudo est complété');
  if (await a.page.locator('.mention-picks').isVisible()) throw new Error('la liste doit se fermer après le choix');

  // B est ailleurs (Membres) : une notification avec un lien.
  await aller(b, '#/membres');
  await b.page.locator('.member-card').first().waitFor();
  await zone.pressSequentially('tu viens jouer ?');
  await a.page.locator('.composer button[type=submit]').click(); // au téléphone, Entrée va à la ligne
  const notif = b.page.locator('.toast', { hasText: 'te mentionne dans #général' });
  await notif.waitFor();
  await notif.getByRole('link', { name: 'Voir' }).click();
  const msg = b.page.locator('.msg.is-mention', { hasText: 'tu viens jouer' });
  await msg.waitFor();
  if (!(await msg.locator('.mention.is-me').count())) throw new Error('la mention doit être surlignée');
  await capture(b, '4-mention');

  // Une adresse e-mail n'est pas une mention, et un pseudo inconnu n'est pas surligné.
  await ecrire(a, `écris à prof@${b.pseudo}.fr ou @personne-inconnue`);
  const dernier = b.page.locator('.msg', { hasText: 'écris à prof@' });
  await dernier.waitFor();
  if (await dernier.locator('.mention').count()) throw new Error('ni une adresse e-mail ni un pseudo inconnu ne sont des mentions');
});
