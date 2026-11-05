// Parcours « coupure » : le message part pendant une panne. Trois cas :
//  1. le serveur est coupé plus de 10 s : « Pas envoyé », le message reste, « Réessayer » l'envoie une seule fois ;
//  2. l'accusé de réception se perd (le serveur a reçu le message) : il ne doit pas apparaître deux fois.
import { monterSuite, jusque, ouvrirMessages, ecrire, messagesDe } from './aide.mjs';

const S = monterSuite();
const copies = async (p, texte) => (await messagesDe(p)).filter((t) => t === texte).length;
async function ecrireSansAttendre(p, texte) {
  await p.page.locator('.composer textarea').fill(texte);
  await p.page.locator('.composer button[type=submit]').click();
}
// Un message de plus de bout en bout : tout ce qui devait arriver avant lui est arrivé (même file d'événements).
async function synchroniser(a, b) {
  const repere = `repère ${S.pseudo('')}`;
  await ecrire(a, repere);
  await jusque(async () => (await messagesDe(b)).includes(repere), 'B reçoit le message repère');
}

S.it('serveur coupé plus de 10 s : « Pas envoyé » reste affiché, « Réessayer » l’envoie une seule fois', async ({ ouvrir }) => {
  const a = await ouvrir();
  const b = await ouvrir();
  await ouvrirMessages(a);
  await ouvrirMessages(b);
  await ecrire(a, `avant la coupure ${S.pseudo('')}`);

  await S.serveur.couper();
  await a.page.locator('.conn-banner').waitFor({ state: 'visible', timeout: 30_000 });
  const texte = `coupée ${S.pseudo('')}`;
  await ecrireSansAttendre(a, texte);
  await a.page.locator('.msg.pending .msg-body', { hasText: texte }).waitFor();
  await a.page.locator('.msg.failed .msg-fail', { hasText: 'Pas envoyé' }).waitFor({ timeout: 25_000 }); // l'appli abandonne après 10 s

  await S.serveur.demarrer();
  await a.page.locator('.conn-banner').waitFor({ state: 'hidden', timeout: 40_000 });
  await b.page.locator('.conn-banner').waitFor({ state: 'hidden', timeout: 40_000 });
  // Le message reste visible, marqué « Pas envoyé », et n'a pas atteint B.
  const echec = a.page.locator('.msg.failed', { hasText: texte });
  if (await echec.count() !== 1) throw new Error('le message « Pas envoyé » a disparu à la reconnexion');
  if (await copies(b, texte) !== 0) throw new Error('B a reçu un message que le serveur n’avait jamais eu');

  await echec.getByRole('button', { name: 'Réessayer' }).click();
  await jusque(async () => (await copies(b, texte)) === 1, 'B reçoit le message réessayé');
  await synchroniser(a, b);
  await jusque(async () => (await a.page.locator('.msg.failed, .msg.pending').count()) === 0, 'plus aucun message « Pas envoyé » ni en attente chez A');
  for (const [nom, p] of [['A', a], ['B', b]]) {
    const n = await copies(p, texte);
    if (n !== 1) throw new Error(`le message réessayé apparaît ${n} fois chez ${nom} (attendu 1)`);
  }
  await b.page.reload();
  await b.page.locator('.composer textarea').waitFor();
  await jusque(async () => (await messagesDe(b)).includes(texte), 'historique rechargé');
  if ((await copies(b, texte)) !== 1) throw new Error(`après rechargement, ${await copies(b, texte)} exemplaires`);
});

// Dans la page : les accusés de réception Socket.IO (trames « 43<id>[… ») sont jetés tant que window.__perdreAcks est vrai.
// Le serveur reçoit et diffuse le message, mais l'expéditeur ne reçoit jamais l'accusé : au bout de 10 s l'appli le croit perdu.
const PERDRE_LES_ACCUSES = () => {
  window.__acksPerdus = 0;
  const Original = window.WebSocket;
  const ignore = (e) => window.__perdreAcks && typeof e.data === 'string' && /^43\d+\[/.test(e.data) && ++window.__acksPerdus;
  function Faux(...args) {
    const ws = new Original(...args);
    const ajouter = ws.addEventListener.bind(ws);
    ws.addEventListener = (type, fn, o) => (type === 'message' ? ajouter(type, (e) => { if (!ignore(e)) fn(e); }, o) : ajouter(type, fn, o));
    Object.defineProperty(ws, 'onmessage', { set(fn) { ajouter('message', (e) => { if (!ignore(e)) fn(e); }); }, configurable: true });
    return ws;
  }
  Faux.prototype = Original.prototype;
  for (const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) Faux[k] = Original[k];
  window.WebSocket = Faux;
};

S.it('accusé perdu : le serveur a reçu le message mais l’expéditeur n’a pas l’accusé ; il n’apparaît qu’une fois, sans « Pas envoyé »', async ({ ouvrir }) => {
  const a = await ouvrir(S.pseudo(), { init: PERDRE_LES_ACCUSES });
  const b = await ouvrir();
  await ouvrirMessages(a);
  await ouvrirMessages(b);
  await ecrire(a, `avant la perte ${S.pseudo('')}`); // la connexion temps réel est établie
  await a.page.evaluate(() => { window.__perdreAcks = true; });
  const texte = `accusé perdu ${S.pseudo('')}`;
  await ecrireSansAttendre(a, texte);
  await jusque(async () => (await copies(b, texte)) === 1, 'B reçoit le message');
  // L'appli attend 10 s l'accusé, puis affiche une erreur : c'est le signe que l'accusé a bien été perdu.
  await a.page.locator('.toast.error').waitFor({ timeout: 25_000 });
  const perdus = await a.page.evaluate(() => window.__acksPerdus);
  if (!perdus) throw new Error('aucun accusé n’a été jeté : la situation n’a pas pu être reproduite (connexion pas en WebSocket ?)');
  await a.page.evaluate(() => { window.__perdreAcks = false; });
  await synchroniser(a, b);
  for (const [nom, p] of [['A', a], ['B', b]]) {
    const n = await copies(p, texte);
    if (n !== 1) throw new Error(`le message apparaît ${n} fois chez ${nom} (attendu 1)`);
  }
  if (await a.page.locator('.msg.failed, .msg.pending').count() !== 0) throw new Error('un message « Pas envoyé » traîne chez A alors que le serveur l’a bien reçu');
});
