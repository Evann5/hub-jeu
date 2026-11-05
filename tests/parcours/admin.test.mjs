// Parcours « administration » : un admin rétrogradé est renvoyé à l'accueil, un canal supprimé retire son non-lu.
import { ADMIN, monterSuite, jusque, aller, hashDe, appel, ouvrirMessages, titre, ecrire } from './aide.mjs';

const S = monterSuite();

S.it('admin rétrogradé pendant qu’il regarde Administration : renvoyé à l’accueil', async ({ ouvrir }) => {
  const proprietaire = await ouvrir(ADMIN, { admin: true });
  const u = await ouvrir();
  const id = await u.page.evaluate(async () => (await (await fetch('api/me')).json()).user.id);
  const promu = await appel(proprietaire, 'admin:setRole', { userId: id, role: 'admin' });
  if (!promu?.ok) throw new Error(`promotion refusée : ${JSON.stringify(promu)}`);
  await aller(u, '#/admin');
  await u.page.locator('.view-admin').waitFor();
  const retire = await appel(proprietaire, 'admin:setRole', { userId: id, role: 'membre' });
  if (!retire?.ok) throw new Error(`rétrogradation refusée : ${JSON.stringify(retire)}`);
  await jusque(async () => (await hashDe(u)) === '#/' && (await u.page.locator('.view-admin').count()) === 0, 'retour à l’accueil après la rétrogradation');
});

S.it('un membre qui n’est pas admin ne peut ni créer ni supprimer un canal', async ({ ouvrir }) => {
  const u = await ouvrir();
  const r = await appel(u, 'admin:createChannel', { name: `pirate-${S.pseudo('')}`, topic: '' });
  if (r?.ok !== false) throw new Error(`création de canal par un membre : ${JSON.stringify(r)}`);
});

S.it('canal supprimé : son non-lu disparaît du titre et de la pastille', async ({ ouvrir }) => {
  const admin = await S.admin();
  const u = await ouvrir();
  try {
    const nom = `essai-${S.pseudo('').slice(-6)}`;
    const cree = await appel(admin, 'admin:createChannel', { name: nom, topic: '' });
    if (!cree?.ok) throw new Error(`création du canal : ${JSON.stringify(cree)}`);
    await ouvrirMessages(admin);
    const lien = admin.page.locator('a.conv-item', { hasText: nom });
    await lien.waitFor();
    const idCanal = Number((await lien.getAttribute('href')).split('/').pop());
    await aller(admin, '#/membres');
    await admin.page.locator('.member-grid').waitFor();
    const envoi = await appel(u, 'send', { scope: `c:${idCanal}`, body: 'non lu pour l’admin' });
    if (!envoi?.ok) throw new Error(`envoi : ${JSON.stringify(envoi)}`);
    await jusque(async () => /^\(1\) /.test(await titre(admin)), 'l’admin a 1 non-lu');
    const supprime = await appel(admin, 'admin:deleteChannel', { id: idCanal });
    if (!supprime?.ok) throw new Error(`suppression : ${JSON.stringify(supprime)}`);
    await jusque(async () => !/^\(/.test(await titre(admin)), 'le non-lu du canal supprimé est retiré');
  } finally { await admin.contexte.close(); }
});
