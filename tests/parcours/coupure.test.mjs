// Parcours « coupure » : le message part pendant une panne. Trois cas :
//  1. le serveur est coupé plus de 10 s : « Pas envoyé », le message reste, « Réessayer » l'envoie une seule fois ;
//  2. l'accusé de réception se perd (le serveur a reçu le message) : il ne doit pas apparaître deux fois.
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { monterSuite, jusque, ouvrirMessages, ecrire, messagesDe, RACINE, aller, ouvrirTable, rejoindre } from './aide.mjs';

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
  if (await a.page.locator('.update-banner').count()) throw new Error('« Hubuno a été mis à jour » affiché alors que le code n’a pas changé');

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

S.it('mise à jour : après un redémarrage avec un autre code, la page propose de recharger, puis tout repart', async ({ ouvrir }) => {
  const a = await ouvrir(undefined, process.env.TELEPHONE ? { viewport: { width: 390, height: 844 }, tactile: true } : {}); // TELEPHONE=1 : écran de téléphone
  await aller(a, '#/c/1'); // le salon directement : au téléphone, « Messages » ouvre d'abord la liste
  await a.page.locator('.composer textarea').waitFor();
  const fichier = join(RACINE, 'public', 'zz-test-version.txt'); // un fichier de plus dans public/ : la version du code change
  await S.serveur.couper();
  writeFileSync(fichier, 'essai de mise à jour\n');
  try {
    await S.serveur.demarrer();
    const bandeau = a.page.locator('.update-banner');
    await bandeau.waitFor({ state: 'visible', timeout: 40_000 });
    if (!(await bandeau.textContent()).includes('Hubuno a été mis à jour')) throw new Error('texte du bandeau inattendu');
    if (process.env.CAPTURES) await a.page.screenshot({ path: join(process.env.CAPTURES, `mise-a-jour${process.env.TELEPHONE ? '-tel' : ''}.png`) });
    await bandeau.getByRole('button', { name: 'Plus tard' }).click();
    await bandeau.waitFor({ state: 'detached' });
    await a.page.reload();
    await a.page.locator('.composer textarea').waitFor();
    if (await a.page.locator('.update-banner').count()) throw new Error('le bandeau revient après le rechargement');
  } finally {
    rmSync(fichier, { force: true });
  }
});

// Le wifi saute dans la page (le serveur, lui, tourne toujours), puis revient quand le test le décide.
const couperWifi = (p) => p.page.evaluate(async () => {
  const { state } = await import('./js/store.js');
  window.__etats = 0;
  state.socket.on('state', () => { window.__etats += 1; });
  state.socket.io.reconnection(false);
  state.socket.io.engine.close();
});
async function retrouverWifi(p) {
  await p.page.evaluate(async () => {
    const { state } = await import('./js/store.js');
    state.socket.io.reconnection(true);
    state.socket.connect();
  });
  await jusque(() => p.page.evaluate(() => window.__etats >= 1), 'la page a retrouvé le serveur');
  await p.page.locator('.conn-banner').waitFor({ state: 'hidden' });
}

S.it('coupure de wifi dans la messagerie : le brouillon reste dans la zone d’écriture et les messages manqués arrivent', async ({ ouvrir }) => {
  const a = await ouvrir();
  const b = await ouvrir();
  await ouvrirMessages(a);
  await ouvrirMessages(b);
  await ecrire(b, `avant ${S.pseudo('')}`);
  const brouillon = 'Un long message que je suis en train d’écrire';
  await a.page.locator('.composer textarea').fill(brouillon);
  await a.page.evaluate(() => { document.querySelector('.composer textarea').__marque = 'même champ'; });
  await couperWifi(a);
  await a.page.locator('.conn-banner').waitFor({ state: 'visible' });
  const manque = `pendant la coupure ${S.pseudo('')}`;
  await ecrire(b, manque);
  await retrouverWifi(a);
  await jusque(async () => (await messagesDe(a)).includes(manque), 'le message envoyé pendant la coupure apparaît chez A');
  if ((await a.page.locator('.composer textarea').inputValue()) !== brouillon) throw new Error('le brouillon a été effacé par la reconnexion');
  if (!(await a.page.evaluate(() => document.querySelector('.composer textarea').__marque === 'même champ'))) throw new Error('la zone d’écriture a été reconstruite');
  if ((await copies(a, manque)) !== 1) throw new Error('le message manqué apparaît plusieurs fois');
});

S.it('coupure de wifi en pleine partie : le jeu n’est pas démonté, le coup joué pendant la coupure apparaît, le brouillon du chat reste', async ({ ouvrir }) => {
  const a = await ouvrir();
  const b = await ouvrir();
  const adresse = await ouvrirTable(a, 'Morpion');
  await rejoindre(b, adresse);
  await a.page.getByRole('button', { name: 'Lancer la partie' }).click();
  for (const p of [a, b]) await p.page.locator('.mp-board').waitFor();
  const aLaMain = (p) => p.page.locator('.table-head').textContent().then((t) => t.includes('À toi de jouer'));
  await jusque(async () => (await aLaMain(a)) || (await aLaMain(b)), 'quelqu’un a la main');
  if (await aLaMain(a)) { // A joue d'abord : pendant la coupure, ce sera à B
    await a.page.locator('.mp-cell').first().click();
    await jusque(() => aLaMain(b), 'la main passe à B');
  }
  const avant = await a.page.locator('.mp-cell.is-x, .mp-cell.is-o').count();
  await a.page.evaluate(() => { document.querySelector('.game-stage').__marque = 'même jeu'; });
  await a.page.locator('.tchat-form input').fill('je réfléchis');
  await couperWifi(a);
  await a.page.locator('.conn-banner').waitFor({ state: 'visible' });
  await b.page.locator('.mp-cell:not(.is-x):not(.is-o)').first().click();
  await b.page.locator('.tchat-form input').fill('à toi !');
  await b.page.locator('.tchat-form button').click();
  await retrouverWifi(a);
  await jusque(async () => (await a.page.locator('.mp-cell.is-x, .mp-cell.is-o').count()) === avant + 1, 'le coup joué pendant la coupure apparaît chez A');
  await jusque(() => aLaMain(a), 'A voit que c’est à lui');
  await a.page.locator('.tchat-msg', { hasText: 'à toi !' }).waitFor();
  if (!(await a.page.evaluate(() => document.querySelector('.game-stage')?.__marque === 'même jeu'))) throw new Error('le jeu a été démonté puis remonté par la reconnexion');
  if ((await a.page.locator('.tchat-form input').inputValue()) !== 'je réfléchis') throw new Error('le brouillon du chat de la partie a été effacé');
  // La partie continue normalement après la coupure.
  await a.page.locator('.mp-cell:not(.is-x):not(.is-o)').first().click();
  await jusque(async () => (await b.page.locator('.mp-cell.is-x, .mp-cell.is-o').count()) === avant + 2, 'le coup de A après la coupure arrive chez B');
});

S.it('mise à jour : une page qu’on ne regarde plus se recharge toute seule, sauf si un texte est commencé', async ({ ouvrir }) => {
  const libre = await ouvrir();
  const occupe = await ouvrir();
  for (const p of [libre, occupe]) {
    await aller(p, '#/c/1');
    await p.page.locator('.composer textarea').waitFor();
    await p.page.evaluate(() => { window.__avant = 'page d’avant la mise à jour'; });
  }
  await occupe.page.locator('.composer textarea').fill('un message commencé');
  const fichier = join(RACINE, 'public', 'zz-test-version.txt');
  await S.serveur.couper();
  writeFileSync(fichier, `essai de rechargement ${Date.now()}\n`);
  try {
    await S.serveur.demarrer();
    for (const p of [libre, occupe]) await p.page.locator('.update-banner').waitFor({ state: 'visible', timeout: 40_000 });
    // L'élève passe sur un autre onglet : la page n'est plus regardée.
    const cacher = (p) => p.page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await cacher(libre);
    await jusque(() => libre.page.evaluate(() => window.__avant === undefined && Boolean(document.querySelector('.navbar'))).catch(() => false), 'la page libre s’est rechargée toute seule');
    await libre.page.locator('.composer textarea').waitFor();
    if (await libre.page.locator('.update-banner').count()) throw new Error('le bandeau revient après le rechargement automatique');
    await cacher(occupe);
    await occupe.page.waitForTimeout(800);
    if (!(await occupe.page.evaluate(() => window.__avant))) throw new Error('la page a été rechargée alors qu’un message était commencé');
    if ((await occupe.page.locator('.composer textarea').inputValue()) !== 'un message commencé') throw new Error('le message commencé a été perdu');
  } finally {
    rmSync(fichier, { force: true });
  }
});
