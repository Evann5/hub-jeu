// Parcours « coupure » : le serveur tombe pendant qu'on écrit. Le message reste « Pas envoyé », « Réessayer » ne le double pas.
import { monterSuite, jusque, ouvrirMessages, ecrire, messagesDe } from './aide.mjs';

const S = monterSuite();

S.it('message envoyé serveur coupé : « Pas envoyé », puis « Réessayer » une fois le serveur revenu, sans doublon', async ({ ouvrir }) => {
  const a = await ouvrir();
  const b = await ouvrir();
  await ouvrirMessages(a);
  await ouvrirMessages(b);
  await ecrire(a, `avant la coupure ${S.pseudo('')}`); // la conversation marche

  await S.serveur.couper();
  await a.page.locator('.conn-banner').waitFor({ state: 'visible', timeout: 30_000 });
  const texte = `coupée ${S.pseudo('')}`;
  await a.page.locator('.composer textarea').fill(texte);
  await a.page.locator('.composer button[type=submit]').click();
  await a.page.locator('.msg.pending .msg-body', { hasText: texte }).waitFor(); // d'abord « en cours d'envoi »
  // L'appli abandonne l'envoi au bout de 10 s (limite côté client) : le message reste visible, marqué « Pas envoyé ».
  await a.page.locator('.msg.failed .msg-fail', { hasText: 'Pas envoyé' }).waitFor({ timeout: 25_000 });
  await a.page.getByRole('button', { name: 'Réessayer' }).waitFor();

  await S.serveur.demarrer();
  await a.page.locator('.conn-banner').waitFor({ state: 'hidden', timeout: 40_000 });
  await b.page.locator('.conn-banner').waitFor({ state: 'hidden', timeout: 40_000 });
  const reessayer = a.page.getByRole('button', { name: 'Réessayer' });
  if (await reessayer.count()) await reessayer.click({ timeout: 2000 }).catch(() => {}); // il a pu partir tout seul à la reconnexion
  await jusque(async () => (await a.page.locator('.msg.failed, .msg.pending').count()) === 0, 'plus de message « Pas envoyé » ni en attente chez A', { delai: 20_000 });
  const copies = async (p) => (await messagesDe(p)).filter((t) => t === texte).length;
  await jusque(async () => (await copies(b)) >= 1, 'le message arrive chez B', { delai: 20_000 });
  // Laisse le temps à un éventuel doublon d'arriver : on attend un nouveau message de bout en bout (même file d'événements).
  await ecrire(a, `après la reprise ${S.pseudo('')}`);
  await jusque(async () => (await messagesDe(b)).some((t) => t.startsWith('après la reprise')), 'B reçoit le message suivant');
  for (const [nom, p] of [['A', a], ['B', b]]) {
    const n = await copies(p);
    if (n !== 1) throw new Error(`le message coupé apparaît ${n} fois chez ${nom} (attendu 1)`);
  }
  // Même chose après rechargement : le serveur n'a gardé qu'un exemplaire.
  await b.page.reload();
  await b.page.locator('.composer textarea').waitFor();
  await jusque(async () => (await messagesDe(b)).includes(texte), 'historique rechargé');
  if ((await copies(b)) !== 1) throw new Error(`après rechargement, ${await copies(b)} exemplaires en base`);
});
