// Parcours « tables de jeu » avec le Morpion (2 joueurs, rapide) : fiche, salon, invitation, exclusion, partie, abandon, fermeture.
// Limite du serveur : 6 créations de table par minute et par personne : chaque test crée ses propres comptes.
import { monterSuite, jusque, aller, hashDe, ouvrirTable, rejoindre } from './aide.mjs';

const S = monterSuite();
const confirmer = (p, bouton) => p.page.getByRole('dialog').locator('.dlg-actions').getByRole('button', { name: bouton, exact: true }).click();

S.it('fiche de jeu : la carte ouvre une fiche, « Annuler » ne crée rien, « Créer une partie » mène au salon', async ({ ouvrir }) => {
  const h = await ouvrir();
  await aller(h, '#/jouer');
  const carte = h.page.locator('.game-card').filter({ has: h.page.getByRole('heading', { name: 'Morpion', exact: true }) });
  await carte.getByRole('button', { name: 'Jouer à Morpion' }).click();
  const fiche = h.page.getByRole('dialog');
  await fiche.getByRole('heading', { name: 'Morpion' }).waitFor();
  await fiche.getByText('2 joueurs').waitFor();
  await fiche.getByRole('button', { name: 'Annuler' }).click();
  await fiche.waitFor({ state: 'hidden' });
  await carte.getByRole('heading', { name: 'Morpion', exact: true }).click(); // toute la carte ouvre la fiche, pas seulement le bouton
  await fiche.getByRole('button', { name: 'Annuler' }).click();
  await fiche.waitFor({ state: 'hidden' });
  if ((await hashDe(h)) !== '#/jouer') throw new Error('Annuler a changé d’écran');
  if (await h.page.locator('a.table-row').count() !== 0) throw new Error('une table a été créée sans le demander');

  const adresse = await ouvrirTable(h, 'Morpion');
  if (!/^#\/t\/\d+$/.test(adresse)) throw new Error(`adresse de la table : ${adresse}`);
  await h.page.locator('.lobby-seat', { hasText: h.pseudo }).waitFor();

  // Le jeu phare a aussi sa fiche.
  await aller(h, '#/jouer');
  await h.page.locator('.game-hero').getByRole('button', { name: /^Jouer à/ }).click();
  await h.page.getByRole('dialog').getByRole('button', { name: 'Créer une partie' }).waitFor();
});

S.it('salon à deux : Inviter est le bouton principal tant qu’on est seul, puis Lancer ; l’invitation arrive en notification', async ({ ouvrir }) => {
  const h = await ouvrir();
  const g = await ouvrir();
  const tiers = await ouvrir();
  const adresse = await ouvrirTable(h, 'Morpion');
  const principal = h.page.locator('.lobby-card .btn-dark');
  await jusque(async () => (await principal.first().textContent()).includes('Inviter'), 'Inviter est le bouton principal');
  if (!(await h.page.getByRole('button', { name: 'Lancer la partie' }).isDisabled())) throw new Error('Lancer devrait être grisé à un seul joueur');
  if (await h.page.locator('.table-players .seat-list').count() !== 0) throw new Error('la liste des joueurs est dupliquée hors du salon');

  await h.page.locator('.lobby-card').getByRole('button', { name: 'Inviter' }).click();
  await h.page.getByRole('dialog').locator('.invite-row', { hasText: tiers.pseudo }).locator('input').check();
  await h.page.getByRole('dialog').getByRole('button', { name: 'Inviter', exact: true }).click();
  await tiers.page.locator('.toast', { hasText: 't’invite à jouer' }).waitFor();

  await rejoindre(g, adresse);
  await jusque(async () => (await principal.first().textContent()).includes('Lancer'), 'Lancer devient le bouton principal à deux');
  if (await h.page.getByRole('button', { name: 'Lancer la partie' }).isDisabled()) throw new Error('Lancer reste grisé à deux');
  // L'invité ne peut pas lancer.
  if (await g.page.getByRole('button', { name: 'Lancer la partie' }).count() !== 0) throw new Error('l’invité voit Lancer');
});

S.it('exclusion : l’hôte retire un joueur, qui revient sur Jouer et ne peut plus rejoindre', async ({ ouvrir }) => {
  const h = await ouvrir();
  const g = await ouvrir();
  const adresse = await ouvrirTable(h, 'Morpion');
  await rejoindre(g, adresse);
  await h.page.getByRole('button', { name: `Retirer ${g.pseudo}` }).click();
  await jusque(async () => (await hashDe(g)) === '#/jouer', 'l’exclu est renvoyé sur Jouer');
  await aller(g, adresse);
  await g.page.locator('.lobby-card').waitFor();
  await g.page.locator('.lobby-note', { hasText: 't’a retiré de cette partie' }).waitFor();
  if (await g.page.getByRole('button', { name: 'Rejoindre la partie' }).count() !== 0) throw new Error('l’exclu peut encore rejoindre');
});

S.it('partie : rejoindre, lancer, jouer un coup, abandonner, bandeau de fin chez les deux', async ({ ouvrir }) => {
  const h = await ouvrir();
  const g = await ouvrir();
  const adresse = await ouvrirTable(h, 'Morpion');
  await rejoindre(g, adresse);
  await h.page.getByRole('button', { name: 'Lancer la partie' }).click();
  for (const p of [h, g]) await p.page.locator('.mp-board').waitFor();

  // Un coup, par celui dont c'est le tour.
  const tour = await jusque(async () => {
    for (const p of [h, g]) if ((await p.page.locator('.table-head').textContent()).includes('À toi de jouer')) return p;
    return null;
  }, 'quelqu’un a la main');
  const autre = tour === h ? g : h;
  await tour.page.locator('.mp-cell').first().click();
  await jusque(async () => (await autre.page.locator('.mp-cell.is-x, .mp-cell.is-o').count()) === 1, 'le coup apparaît chez l’adversaire');

  // L'hôte abandonne : confirmation, puis l'autre gagne.
  await h.page.getByRole('button', { name: 'Abandonner' }).click();
  await confirmer(h, 'Abandonner');
  for (const p of [h, g]) await p.page.locator('.endbar').getByText('Partie terminée').waitFor();
  await g.page.locator('.endbar').getByText(/Tu gagnes|Gagnant/).waitFor();
  await h.page.locator('.endbar').getByRole('button', { name: 'Revanche' }).waitFor();
  await g.page.locator('.endbar').getByRole('link', { name: 'Retour aux jeux' }).click();
  await jusque(async () => (await hashDe(g)) === '#/jouer', 'Retour aux jeux ramène sur Jouer');
});

S.it('table fermée pendant qu’on regarde : le jeu est démonté, retour sur Jouer, le titre est restauré', async ({ ouvrir }) => {
  const h = await ouvrir();
  const g = await ouvrir();
  const adresse = await ouvrirTable(h, 'Morpion');
  await rejoindre(g, adresse);
  await h.page.getByRole('button', { name: 'Lancer la partie' }).click();
  for (const p of [h, g]) await p.page.locator('.mp-board').waitFor();
  const avant = await g.page.title();
  await h.page.getByRole('button', { name: 'Fermer la partie' }).click();
  await confirmer(h, 'Fermer la partie');
  await jusque(async () => (await hashDe(g)) === '#/jouer' && (await g.page.locator('.mp-board').count()) === 0, 'le jeu est retiré de la page de l’autre joueur');
  await g.page.locator('.toast', { hasText: 'La partie a été fermée.' }).waitFor();
  const apres = await g.page.title();
  if (apres === avant || !apres.startsWith('Jouer')) throw new Error(`titre non restauré : « ${avant} » puis « ${apres} »`);
  await aller(g, adresse); // l'ancienne adresse ne rouvre rien
  await jusque(async () => (await g.page.locator('.mp-board').count()) === 0, 'la table fermée ne rouvre pas le jeu');
});

// Parcours en un clic : « Rejoindre » d'une ligne de la liste, d'une fiche ou d'une invitation assoit directement le joueur (wantJoin).
S.it('rejoindre en un clic : depuis la liste, depuis la fiche du jeu et depuis une invitation, sans passer par « Rejoindre la partie »', async ({ ouvrir }) => {
  const h = await ouvrir();
  const [g1, g2, g3] = [await ouvrir(), await ouvrir(), await ouvrir()];
  const adresse = await ouvrirTable(h, 'Menteur'); // 2 à 8 joueurs : de la place pour les trois
  const assis = async (p) => {
    await p.page.locator('.lobby-card').waitFor();
    await p.page.locator('.lobby-seat', { hasText: p.pseudo }).waitFor();
    if (await p.page.getByRole('button', { name: 'Rejoindre la partie' }).count() !== 0) throw new Error(`${p.pseudo} voit encore « Rejoindre la partie » alors qu'il a cliqué sur Rejoindre`);
  };

  // 1. La ligne de la liste « Parties en attente ».
  await aller(g1, '#/jouer');
  const ligne = g1.page.locator('a.table-row', { hasText: `Partie de ${h.pseudo}` });
  await ligne.getByText('Rejoindre', { exact: true }).waitFor();
  await ligne.click();
  await assis(g1);

  // 2. La fiche du jeu : la partie qui attend est listée avec « Rejoindre ».
  await aller(g2, '#/jouer');
  await g2.page.locator('.game-card').filter({ has: g2.page.getByRole('heading', { name: 'Menteur', exact: true }) }).getByRole('button', { name: 'Jouer à Menteur' }).click();
  await g2.page.getByRole('dialog').locator('a.game-sheet-table', { hasText: 'Rejoindre' }).click();
  await assis(g2);

  // 3. L'invitation reçue en notification.
  await h.page.locator('.lobby-card').getByRole('button', { name: 'Inviter' }).click();
  await h.page.getByRole('dialog').locator('.invite-row', { hasText: g3.pseudo }).locator('input').check();
  await h.page.getByRole('dialog').getByRole('button', { name: 'Inviter', exact: true }).click();
  await g3.page.locator('.toast .toast-link', { hasText: 'Rejoindre' }).click();
  await assis(g3);
  void adresse;

  // Le salon montre bien les quatre joueurs chez l'hôte.
  await jusque(async () => (await h.page.locator('.lobby-seat:not(.empty)').count()) === 4, 'quatre joueurs assis');
});

// Suit les écouteurs posés par le code d'Escales sur window, document et body (reconnus à leur pile d'appel) : ce sont eux qui survivent à une fermeture oubliée.
const SUIVRE_ECOUTEURS_ESCALES = () => {
  window.__ecouteursEscales = [];
  const ajouter = EventTarget.prototype.addEventListener;
  const retirer = EventTarget.prototype.removeEventListener;
  const capture = (o) => (typeof o === 'boolean' ? o : Boolean(o?.capture));
  EventTarget.prototype.addEventListener = function (type, fn, o) {
    const global = this === window || this === document || this === document.documentElement || this === document.body; // les écouteurs d'un bouton retiré de la page partent avec lui
    if (global && /games\/escales/.test(new Error().stack || '')) window.__ecouteursEscales.push({ cible: this, type, fn, capture: capture(o) });
    return ajouter.call(this, type, fn, o);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, o) {
    window.__ecouteursEscales = window.__ecouteursEscales.filter((e) => !(e.cible === this && e.type === type && e.fn === fn && e.capture === capture(o)));
    return retirer.call(this, type, fn, o);
  };
};

S.it('Escales fermée pendant qu’on regarde : le canvas 3D disparaît, le titre revient à Jouer et plus aucun écouteur d’Escales ne reste', async ({ ouvrir }) => {
  const h = await ouvrir();
  const g = await ouvrir(S.pseudo(), { init: SUIVRE_ECOUTEURS_ESCALES });
  await aller(h, '#/jouer');
  await h.page.locator('.game-hero').getByRole('button', { name: 'Jouer à Escales' }).click();
  await h.page.getByRole('dialog').getByRole('button', { name: 'Créer une partie' }).click();
  await h.page.locator('.lobby-card').waitFor();
  const adresse = await hashDe(h);
  await h.page.getByRole('button', { name: 'Lancer la partie' }).click();
  await h.page.locator('.es-world canvas').waitFor({ state: 'attached', timeout: 60_000 });
  await aller(g, adresse); // g regarde, sans s'asseoir
  await g.page.locator('.es-world canvas').waitFor({ state: 'attached', timeout: 60_000 });
  const enJeu = await g.page.evaluate(() => window.__ecouteursEscales.length);
  if (enJeu < 1) throw new Error('aucun écouteur d’Escales détecté pendant la partie : le test ne prouverait rien');
  if ((await g.page.title()).startsWith('Jouer')) throw new Error('le titre de l’onglet n’annonce pas la partie');

  const chat = h.page.getByRole('tab', { name: 'Chat' }); // l'onglet Chat porte les actions de la partie quand la 3D occupe la place
  if (await chat.count()) await chat.click();
  await h.page.getByRole('button', { name: 'Fermer la partie' }).click();
  await confirmer(h, 'Fermer la partie');
  await jusque(async () => (await hashDe(g)) === '#/jouer' && (await g.page.locator('.es-world canvas').count()) === 0, 'le canvas 3D est retiré de la page du spectateur', { delai: 20_000 });
  await jusque(async () => (await g.page.title()).startsWith('Jouer'), 'le titre de l’onglet redevient celui de Jouer');
  const restants = await g.page.evaluate(() => window.__ecouteursEscales.map((e) => `${e.cible?.nodeName ?? e.cible?.constructor?.name}:${e.type}`));
  if (restants.length) throw new Error(`${restants.length} écouteur(s) d’Escales encore actif(s) : ${restants.join(', ')}`);
});
