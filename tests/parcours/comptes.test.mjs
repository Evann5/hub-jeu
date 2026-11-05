// Parcours « comptes » : inscription, pseudos sosies, connexion, session gardée, changement de mot de passe.
import { monterSuite, jusque, aller, CODE, ADMIN, CODE_ADMIN, MDP } from './aide.mjs';

const S = monterSuite();
const post = (p, chemin, data) => p.contexte.request.post(`${S.serveur.url}api/${chemin}`, { data });
const inscription = (p, pseudo, extra = {}) => post(p, 'register', { classCode: CODE, pseudo, password: MDP, acceptRules: true, ...extra });

S.it('inscription : le formulaire crée le compte et ouvre l’accueil', async () => {
  const ctx = await S.nav.newContext({ baseURL: S.serveur.url });
  try {
    const page = await ctx.newPage();
    await page.goto(S.serveur.url);
    await page.getByRole('tab', { name: 'Créer un compte' }).click();
    const pseudo = S.pseudo('zzi');
    await page.getByLabel('Code de la classe').fill(CODE);
    await page.getByRole('textbox', { name: /^Pseudo/ }).fill(pseudo);
    await page.getByLabel(/^Mot de passe/).fill(MDP);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await page.locator('.navbar').waitFor();
    await jusque(async () => (await page.title()).includes('Accueil'), 'titre « Accueil · Hubuno »');
    const me = await page.evaluate(async () => (await (await fetch('api/me')).json()).user.pseudo);
    if (me !== pseudo) throw new Error(`connecté en tant que ${me}`);
  } finally { await ctx.close(); }
});

S.it('inscription : mauvais code de classe et règles non cochées sont refusés avec un message', async ({ ouvrir }) => {
  const p = await ouvrir(S.pseudo(), { page: false });
  const mauvais = await inscription(p, S.pseudo(), { classCode: 'pas-le-bon-code' });
  if (mauvais.status() !== 400) throw new Error(`mauvais code : ${mauvais.status()}`);
  if (!(await mauvais.json()).error.includes('code de classe')) throw new Error('message du mauvais code');
  const regles = await inscription(p, S.pseudo(), { acceptRules: false });
  if (regles.status() !== 400) throw new Error(`règles non acceptées : ${regles.status()}`);
});

S.it('inscription : un pseudo sosie d’un pseudo existant est refusé, au formulaire comme à l’API', async ({ ouvrir }) => {
  await ouvrir(ADMIN, { admin: true, page: false }); // le pseudo à imiter existe
  const p = await ouvrir(S.pseudo(), { page: false });
  const base = S.pseudo('zzs');
  const ok = await inscription(p, base);
  if (ok.status() !== 201) throw new Error(`inscription de départ : ${ok.status()}`);
  const q = await ouvrir(S.pseudo(), { page: false });
  for (const [pseudo, attendu, nom] of [
    [ADMIN, 409, 'le même pseudo'], ['mlnhtest', 409, 'l devant n'], ['m1nhtest', 409, 'chiffre 1 pour i'], ['MINHTEST', 409, 'casse'],
    [base.replace('zzs', 'ZZS'), 409, 'majuscules'], [`ｚｚｑ${S.pseudo('')}`, 400, 'lettres pleine chasse'],
  ]) {
    const r = await inscription(q, pseudo);
    if (r.status() !== attendu) throw new Error(`${nom} (${pseudo}) : ${r.status()} au lieu de ${attendu}`);
  }
  const accent = await inscription(q, `Trần${S.pseudo('')}`.slice(0, 20));
  if (accent.status() !== 201) throw new Error(`pseudo accentué : ${accent.status()}`);

  // Au formulaire : le message est visible.
  const ctx = await S.nav.newContext();
  try {
    const page = await ctx.newPage();
    await page.goto(S.serveur.url);
    await page.getByRole('tab', { name: 'Créer un compte' }).click();
    await page.getByLabel('Code de la classe').fill(CODE);
    await page.getByRole('textbox', { name: /^Pseudo/ }).fill('mlnhtest');
    await page.getByLabel(/^Mot de passe/).fill(MDP);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await page.getByText('Ce pseudo est déjà pris.').waitFor();
  } finally { await ctx.close(); }
});

S.it('inscription : un pseudo d’admin est réservé à qui donne le code admin', async ({ ouvrir }) => {
  const p = await ouvrir(S.pseudo(), { page: false });
  const r = await inscription(p, ADMIN); // code de classe seul, pseudo réservé
  if (r.status() !== 409) throw new Error(`pseudo d’admin avec le code de classe : ${r.status()}`);
  const ok = await inscription(p, ADMIN, { classCode: CODE_ADMIN });
  if (![201, 409].includes(ok.status())) throw new Error(`avec le code admin : ${ok.status()}`);
});

S.it('connexion : la session reste ouverte après rechargement, puis déconnexion et reconnexion au formulaire', async ({ ouvrir }) => {
  const p = await ouvrir(S.pseudo());
  await p.page.reload();
  await p.page.locator('.navbar').waitFor();
  // Un autre « lancement du navigateur » avec le même cookie.
  const etat = await p.contexte.storageState();
  const ctx2 = await S.nav.newContext({ storageState: etat });
  try {
    const page2 = await ctx2.newPage();
    await page2.goto(S.serveur.url);
    await page2.locator('.navbar').waitFor();
  } finally { await ctx2.close(); }

  await aller(p, '#/profil');
  await p.page.getByRole('button', { name: 'Se déconnecter' }).click();
  // Sur un appareil qui n'a jamais ouvert de session par le formulaire, l'écran propose d'abord l'inscription.
  await p.page.getByRole('tab', { name: 'Se connecter' }).click();
  await p.page.getByRole('textbox', { name: /^Pseudo/ }).fill(p.pseudo);
  await p.page.getByLabel(/^Mot de passe/).fill('mauvais-mot-de-passe-1');
  await p.page.getByRole('button', { name: 'Se connecter' }).click();
  await p.page.getByText('Pseudo ou mot de passe incorrect.').waitFor();
  await p.page.getByLabel(/^Mot de passe/).fill(MDP);
  await p.page.getByRole('button', { name: 'Se connecter' }).click();
  await p.page.locator('.navbar').waitFor();
});

S.it('mot de passe : le changer ne déconnecte pas cet appareil, mais déconnecte les autres', async ({ ouvrir }) => {
  const p = await ouvrir(S.pseudo());
  const ctx2 = await S.nav.newContext();
  try {
    const page2 = await ctx2.newPage();
    await page2.goto(S.serveur.url);
    await page2.evaluate(async ([pseudo, mdp]) => {
      await fetch('api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pseudo, password: mdp }) });
    }, [p.pseudo, MDP]);
    await page2.reload();
    await page2.locator('.navbar').waitFor();

    await aller(p, '#/profil');
    await p.page.getByLabel('Mot de passe actuel').fill(MDP);
    await p.page.getByLabel('Nouveau mot de passe').fill('Autre-mdp-long-98!');
    await p.page.getByRole('button', { name: 'Changer le mot de passe' }).click();
    await p.page.getByText('Mot de passe changé.').waitFor();
    if (await p.page.locator('.navbar').count() !== 1) throw new Error('cet appareil a été déconnecté');
    await p.page.reload();
    await p.page.locator('.navbar').waitFor(); // la session tient toujours après rechargement

    await jusque(async () => (await page2.locator('main.auth').count()) === 1, 'l’autre appareil est renvoyé à la connexion');
  } finally { await ctx2.close(); }
});
