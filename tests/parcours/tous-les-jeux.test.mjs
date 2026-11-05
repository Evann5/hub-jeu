// Les 29 jeux (tous sauf Escales, 3D) : chacun ouvre sa table à plusieurs, se lance et se ferme sans erreur JavaScript.
// Long (environ 2 minutes) : ne tourne qu'avec TOUS_LES_JEUX=1. Pour un seul jeu : JEUX=morpion,dames.
// Limite du serveur : 6 créations de table par minute et par personne ; l'hôte change donc à chaque jeu parmi 6 comptes.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { monterSuite, jusque, aller, hashDe, RACINE } from './aide.mjs';

const ACTIF = process.env.TOUS_LES_JEUX === '1';
const S = monterSuite();
const JEUX_DIR = join(RACINE, 'games');
const filtre = process.env.JEUX?.split(',');
const jeux = readdirSync(JEUX_DIR).filter((g) => g !== 'escales' && (!filtre || filtre.includes(g))).sort();

S.it('chaque jeu s’ouvre à plusieurs, se lance et se ferme sans erreur JavaScript', async ({ ouvrir }) => {
  const N = 6;
  const joueurs = [];
  for (let i = 0; i < N; i++) joueurs.push(await ouvrir());
  const echecs = [];
  for (const [i, id] of jeux.entries()) {
    const meta = JSON.parse(readFileSync(join(JEUX_DIR, id, 'game.json'), 'utf8'));
    const besoin = Math.min(N, Math.max(meta.minPlayers || 2, 2));
    const tournants = [...joueurs.slice(i % N), ...joueurs.slice(0, i % N)].slice(0, besoin); // l'hôte change à chaque jeu
    const erreurs = [];
    const surConsole = (p) => (m) => { if (m.type() === 'error' && !/Refused to apply|401|favicon/.test(m.text())) erreurs.push(`${p.pseudo} console : ${m.text().slice(0, 140)}`); };
    const surErreur = (p) => (e) => erreurs.push(`${p.pseudo} page : ${e.message.slice(0, 140)}`);
    const branches = tournants.map((p) => [p, surConsole(p), surErreur(p)]);
    for (const [p, c, e] of branches) { p.page.on('console', c); p.page.on('pageerror', e); }
    p0: try {
      const h = tournants[0];
      await aller(h, '#/jouer');
      await h.page.locator('.game-card').filter({ has: h.page.getByRole('heading', { name: meta.name, exact: true }) }).getByRole('button', { name: /^Jouer/ }).click();
      await h.page.getByRole('dialog').getByRole('button', { name: 'Créer une partie' }).click();
      await h.page.locator('.lobby-card').waitFor();
      const adresse = await hashDe(h);
      for (const p of tournants.slice(1)) {
        await aller(p, adresse);
        await p.page.getByRole('button', { name: 'Rejoindre la partie' }).click();
      }
      await jusque(async () => (await h.page.locator('.lobby-seat:not(.empty)').count()) === besoin, `${besoin} joueurs au salon de ${id}`);
      const lancer = h.page.getByRole('button', { name: 'Lancer la partie' });
      if (!(await lancer.isEnabled())) { echecs.push(`${id} : lancement impossible à ${besoin} joueurs`); break p0; }
      await lancer.click();
      await h.page.locator('.game-stage').waitFor();
      // Le jeu est monté quand sa scène a du contenu et que ses images sont chargées.
      await jusque(() => h.page.evaluate(() => document.querySelector('.game-stage')?.children.length > 0 && [...document.images].every((im) => im.complete)), `la scène de ${id} est dessinée`, { delai: 20_000 });
      await h.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const [large, fenetre] = await h.page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      if (large > fenetre + 1) erreurs.push(`débordement horizontal ${large} > ${fenetre}`);
      await h.page.getByRole('button', { name: 'Fermer la partie' }).click();
      await h.page.getByRole('dialog').locator('.dlg-actions').getByRole('button', { name: 'Fermer la partie', exact: true }).click();
      await jusque(async () => (await hashDe(h)) === '#/jouer', `la table de ${id} est fermée`);
    } catch (e) {
      echecs.push(`${id} : ${e.message.split('\n')[0].slice(0, 160)}`);
    }
    for (const [p, c, e] of branches) { p.page.off('console', c); p.page.off('pageerror', e); }
    if (erreurs.length) echecs.push(`${id} : ${[...new Set(erreurs)].join(' ; ')}`);
    for (const p of joueurs) p.erreurs.length = 0;
  }
  if (echecs.length) throw new Error(`${echecs.length} jeu(x) en échec sur ${jeux.length} :\n- ${echecs.join('\n- ')}`);
}, { skip: ACTIF ? false : 'long : lancer avec TOUS_LES_JEUX=1', timeout: 600_000 });
