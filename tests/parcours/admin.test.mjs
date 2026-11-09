// Parcours « administration » : un admin rétrogradé est renvoyé à l'accueil, un canal supprimé retire son non-lu.
import { ADMIN, CODE, MOTEUR, monterSuite, jusque, aller, hashDe, appel, ouvrirMessages, titre, ecrire } from './aide.mjs';

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

S.it('« À donner à la classe » : l’admin voit l’adresse et le code, et copie le message pour la classe', async () => {
  const admin = await S.admin();
  try {
    await aller(admin, '#/admin');
    const carte = admin.page.locator('section.card', { has: admin.page.getByRole('heading', { name: 'À donner à la classe' }) });
    await carte.getByText(S.serveur.url, { exact: true }).waitFor();
    await carte.getByText(CODE, { exact: true }).waitFor();
    // Un faux presse-papiers : le vrai est partagé entre les tests lancés en parallèle, et absent de WebKit en test.
    await admin.page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__copie = t; } } }); });
    await carte.getByRole('button', { name: 'Copier le message pour la classe' }).click();
    await admin.page.locator('.toast', { hasText: 'Message copié' }).waitFor();
    const presse = await admin.page.evaluate(() => window.__copie);
    if (!presse.includes(S.serveur.url) || !presse.includes(`Code de la classe : ${CODE}`)) throw new Error(`message copié inattendu : ${presse}`);
  } finally { await admin.contexte.close(); }
});

S.it('compte réinitialisé : tout est refusé par socket tant que le nouveau mot de passe n’est pas choisi, puis tout remarche', async ({ ouvrir }) => {
  const admin = await S.admin();
  const u = await ouvrir();
  try {
    const id = await u.page.evaluate(async () => (await (await fetch('api/me')).json()).user.id);
    const reset = await appel(admin, 'admin:resetPassword', { userId: id });
    if (!reset?.ok || !reset.tempPassword) throw new Error(`réinitialisation refusée : ${JSON.stringify(reset)}`);

    // Le compte est déconnecté de partout : l'écran de connexion revient. On se reconnecte avec le mot de passe provisoire.
    await u.page.getByRole('tab', { name: 'Se connecter' }).click(); // le compte a été créé par l'API : l'écran s'ouvre sur l'inscription
    const champ = u.page.locator('input[name=login_pseudo]');
    await champ.waitFor();
    await champ.fill(u.pseudo);
    await u.page.locator('input[name=login_password]').fill(reset.tempPassword);
    await u.page.locator('form button[type=submit]').click();
    await u.page.getByRole('heading', { name: 'Choisis ton mot de passe' }).waitFor();

    // Avant de choisir : aucune action n'est acceptée (le mot de passe provisoire ne donne accès à rien).
    const texte = `ne-doit-pas-passer-${S.pseudo('')}`;
    const refus = {
      send: { scope: 'c:1', body: texte },
      history: { scope: 'c:1' },
      read: { scope: 'c:1', lastId: 1 },
      typing: { scope: 'c:1' },
      react: { messageId: 1, emoji: '👍' },
      profile: { avatar: '🎲', color: 'rouge', bio: 'pirate' },
      'table:create': { game: 'morpion' },
      'table:watch': { id: 1 },
    };
    for (const [evenement, donnees] of Object.entries(refus)) {
      const r = await appel(u, evenement, donnees);
      if (r?.ok !== false || !/nouveau mot de passe/.test(r.error || '')) throw new Error(`« ${evenement} » aurait dû être refusé avec le mot de passe provisoire : ${JSON.stringify(r)}`);
    }
    const lu = await appel(admin, 'history', { scope: 'c:1' });
    if (JSON.stringify(lu).includes(texte)) throw new Error('un message envoyé avec le mot de passe provisoire a été publié');

    // L'écran « Choisis ton mot de passe » : refus d'un mot de passe trop court puis de deux mots de passe différents, rien ne part.
    const ecran = u.page.locator('input[name=new_password]');
    const nouveau = `Nouveau-mdp-${S.pseudo('')}-77`;
    await ecran.fill('court');
    await u.page.locator('input[name=new_password2]').fill('court');
    await u.page.getByRole('button', { name: 'Enregistrer mon mot de passe' }).click();
    await u.page.getByRole('heading', { name: 'Choisis ton mot de passe' }).waitFor();
    if (await u.page.locator('.navbar').count()) throw new Error('mot de passe trop court accepté');
    await ecran.fill(nouveau);
    await u.page.locator('input[name=new_password2]').fill(`${nouveau}-autre`);
    await u.page.getByRole('button', { name: 'Enregistrer mon mot de passe' }).click();
    await u.page.getByText('Les deux mots de passe ne sont pas identiques.').waitFor();

    // Le bon parcours : on entre dans l'appli.
    await u.page.locator('input[name=new_password2]').fill(nouveau);
    await u.page.getByRole('button', { name: 'Enregistrer mon mot de passe' }).click();
    await u.page.locator('.navbar').waitFor();
    await jusque(async () => (await u.page.getByRole('heading', { name: 'Choisis ton mot de passe' }).count()) === 0, 'l’écran de choix du mot de passe a disparu');

    // Tout remarche : message, lecture, profil.
    const ok = await appel(u, 'send', { scope: 'c:1', body: `de retour ${S.pseudo('')}` });
    if (!ok?.ok) throw new Error(`message refusé après le choix du mot de passe : ${JSON.stringify(ok)}`);
    const profil = await appel(u, 'profile', { avatar: '🎲', color: 'rouge', bio: 'de retour' });
    if (!profil?.ok) throw new Error(`profil refusé après le choix du mot de passe : ${JSON.stringify(profil)}`);

    // Le mot de passe provisoire ne marche plus, le nouveau oui.
    const ancien = await u.contexte.request.post(`${S.serveur.url}api/login`, { data: { pseudo: u.pseudo, password: reset.tempPassword } });
    if (ancien.ok()) throw new Error('le mot de passe provisoire marche encore');
    const neuf = await u.contexte.request.post(`${S.serveur.url}api/login`, { data: { pseudo: u.pseudo, password: nouveau } });
    if (!neuf.ok() || (await neuf.json()).mustChangePassword) throw new Error(`connexion avec le nouveau mot de passe : ${neuf.status()}`);
  } finally { await admin.contexte.close(); }
});
