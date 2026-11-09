// Parcours « rôles », façon Discord : un admin crée un rôle coloré et le donne ; la liste des membres se range par rôle ;
// un modérateur peut mettre un membre en sourdine et effacer ses messages, mais rien de plus.
import { join } from 'node:path';
import { monterSuite, aller, appel, jusque, ecrire } from './aide.mjs';

const S = monterSuite();
// TELEPHONE=1 : écran de téléphone ; CAPTURES=dossier : une image de chaque écran touché.
const VUE = process.env.TELEPHONE ? { viewport: { width: 390, height: 844 }, tactile: true } : {};
const capture = async (p, nom) => {
  if (process.env.CAPTURES) await p.page.screenshot({ path: join(process.env.CAPTURES, `roles-${nom}${process.env.TELEPHONE ? '-tel' : ''}.png`) });
};
// Le salon général directement : sur téléphone, « Messages » ouvre d'abord la liste des conversations.
const ouvrirSalon = async (p) => {
  const id = await p.page.evaluate(() => document.querySelector('a[href^="#/c/"]')?.getAttribute('href') ?? '#/c/1');
  await aller(p, id.startsWith('#/c/') ? id : '#/c/1');
  await p.page.locator('.composer textarea').waitFor();
};
const monId = (p) => p.page.evaluate(() => fetch('api/me').then((r) => r.json()).then((r) => r.user.id));

S.it('rôles : un admin crée « Délégués », le donne, la liste des membres se range, puis il le supprime', async ({ ouvrir }) => {
  const admin = await S.admin(VUE);
  const m = await ouvrir(undefined, VUE);
  try {

  await aller(admin, '#/admin');
  await admin.page.locator('section', { has: admin.page.getByRole('heading', { name: 'Rôles' }) }).getByRole('button', { name: 'Créer' }).click();
  const dlg = admin.page.getByRole('dialog');
  await dlg.getByLabel('Nom du rôle').fill('Délégués');
  await dlg.getByRole('button', { name: 'vert' }).click();
  await dlg.getByRole('button', { name: 'Créer le rôle' }).click();
  await dlg.waitFor({ state: 'detached' });

  // La fiche du membre : la case « Délégués » s'enregistre aussitôt.
  await aller(admin, '#/membres');
  await admin.page.locator('.member-card', { hasText: m.pseudo }).click();
  await admin.page.getByRole('dialog').getByLabel('Délégués').check();
  await admin.page.getByRole('dialog').getByLabel('Délégués').scrollIntoViewIfNeeded();
  await capture(admin, '1-fiche-admin');
  await admin.page.keyboard.press('Escape');
  await admin.page.getByRole('dialog').waitFor({ state: 'detached' });
  await aller(m, '#/membres');
  await m.page.locator('.member-group-title', { hasText: 'Délégués' }).waitFor();
  const groupe = m.page.locator('.member-group', { has: m.page.locator('.member-group-title', { hasText: 'Délégués' }) });
  await jusque(async () => (await groupe.locator('.member-card').count()) === 1, 'un seul membre dans « Délégués »');
  const couleur = await groupe.locator('.member-name').first().evaluate((el) => getComputedStyle(el).color);
  await capture(m, '2-membres');
  if (couleur !== 'rgb(61, 190, 122)') throw new Error(`le pseudo devrait prendre le vert du rôle, il est ${couleur}`);

  // Supprimé : le groupe disparaît chez tout le monde.
  await aller(admin, '#/admin');
  await admin.page.getByRole('heading', { name: 'Rôles' }).scrollIntoViewIfNeeded();
  await capture(admin, '3-admin');
  await admin.page.getByRole('button', { name: 'Modifier « Délégués »' }).click();
  await admin.page.getByRole('dialog').getByRole('button', { name: 'Supprimer le rôle' }).click();
  await admin.page.getByRole('dialog', { name: /Supprimer le rôle/ }).getByRole('button', { name: 'Supprimer' }).click();
  await jusque(async () => (await m.page.locator('.member-group-title').count()) === 0, 'plus aucun groupe de rôle chez le membre');
  } finally {
    await admin.contexte.close().catch(() => {});
  }
});

S.it('modérateur : sourdine et suppression sur un membre, rien sur un admin, aucun outil d’admin', async ({ ouvrir }) => {
  const admin = await S.admin(VUE);
  const modo = await ouvrir(undefined, VUE);
  const m = await ouvrir(undefined, VUE);
  try {
    const [adminId, modoId, mId] = [await monId(admin), await monId(modo), await monId(m)];
    const r = await appel(admin, 'admin:setRole', { userId: modoId, role: 'modo' });
    if (!r.ok) throw new Error(`nommer modo : ${JSON.stringify(r)}`);
    await modo.page.reload();
    await modo.page.locator('.navbar').waitFor();

    // Dans la fiche d'un membre : seulement la sourdine.
    await aller(modo, '#/membres');
    await modo.page.locator('.member-card', { hasText: m.pseudo }).click();
    const fiche = modo.page.getByRole('dialog');
    await fiche.getByRole('heading', { name: 'Outils de modération' }).waitFor();
    await capture(modo, '4-fiche-modo');
    for (const interdit of ['Bloquer le compte', 'Réinitialiser le mot de passe', 'Changer le niveau']) {
      if (await fiche.getByRole('button', { name: interdit }).count()) throw new Error(`un modo ne doit pas voir « ${interdit} »`);
    }
    await modo.page.keyboard.press('Escape');
    await fiche.waitFor({ state: 'detached' });
    if (await modo.page.locator('.nav-admin').count()) throw new Error('un modo ne doit pas voir l’écran Admin');

    // Ce que le serveur accepte, et ce qu'il refuse.
    const sourdine = await appel(modo, 'admin:mute', { userId: mId, minutes: 10 });
    if (!sourdine.ok) throw new Error(`sourdine d'un membre refusée : ${JSON.stringify(sourdine)}`);
    await appel(modo, 'admin:mute', { userId: mId, minutes: 0 });
    const surAdmin = await appel(modo, 'admin:mute', { userId: adminId, minutes: 10 });
    if (surAdmin.ok || !/membres|propriétaire/.test(surAdmin.error)) throw new Error(`un modo ne doit pas toucher un admin : ${JSON.stringify(surAdmin)}`);
    for (const [ev, data] of [['admin:setRole', { userId: mId, role: 'admin' }], ['admin:ban', { userId: mId, banned: true }], ['admin:createRole', { name: 'Pirate', color: 'rouge' }], ['admin:resetPassword', { userId: mId }]]) {
      const res = await appel(modo, ev, data);
      if (res.ok || res.error !== 'Réservé aux admins.') throw new Error(`${ev} devrait être réservé aux admins : ${JSON.stringify(res)}`);
    }

    // Hors de portée : le message d'un admin, un message privé, la partie d'un admin.
    const salon = await appel(admin, 'send', { scope: 'c:1', body: 'message de l’admin' });
    const prive = await appel(m, 'send', { scope: `dm:${Math.min(adminId, mId)}:${Math.max(adminId, mId)}`, body: 'message privé' });
    if (!salon.ok || !prive.ok) throw new Error(`envoi de préparation raté : ${JSON.stringify([salon, prive])}`);
    for (const [quoi, msgId] of [['le message d’un admin', salon.message.id], ['un message privé', prive.message.id]]) {
      const res = await appel(modo, 'admin:deleteMessage', { id: msgId });
      if (res.ok) throw new Error(`un modo ne doit pas effacer ${quoi}`);
    }
    const partie = await appel(admin, 'table:create', { game: 'morpion' });
    const fermer = await appel(modo, 'table:close', { id: partie.id });
    if (!partie.id || fermer.ok) throw new Error(`un modo ne doit pas fermer la partie d’un admin : ${JSON.stringify([partie, fermer])}`);

    // Effacer un message d'un membre.
    await ouvrirSalon(m);
    await ecrire(m, 'message à effacer par le modo');
    await ouvrirSalon(modo);
    const msg = modo.page.locator('.msg', { hasText: 'message à effacer par le modo' });
    await msg.waitFor();
    if (process.env.TELEPHONE) await msg.click(); // au doigt, on touche le message pour voir ses outils
    else await msg.hover();
    await msg.getByRole('button', { name: /Supprimer le message/ }).click();
    await modo.page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
    await jusque(async () => (await m.page.locator('.msg', { hasText: 'message à effacer par le modo' }).count()) === 0, 'le message disparaît chez le membre');
  } finally {
    await admin.contexte.close().catch(() => {});
  }
});
