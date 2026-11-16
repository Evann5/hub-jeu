// Le personnage du profil et la modération des profils (renommer, effacer la bio ou le personnage), sur un vrai serveur jetable.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { lancerServeur, inscrire, entrer, Client, jusque, ADMIN } from '../tests/aide-serveur.mjs';

let srv;
let n = 0;
const pseudo = (p = 'pf') => `${p}${Date.now().toString(36).slice(-4)}${(n++).toString(36)}`;
const ouverts = [];
const connecter = async (compte) => { const c = await new Client(srv, compte).ouvrir(); ouverts.push(c); return c; };
const compteAdmin = () => inscrire(srv, ADMIN, { admin: true }).catch(() => entrer(srv, ADMIN));
const profil = { avatar: '🎲', color: 'bleu', bio: '' };

before(async () => { srv = await lancerServeur(); });
after(async () => { ouverts.forEach((c) => c.fermer()); await srv.arreter(); });

test('personnage : enregistré s’il est valable, refusé sinon, gardé quand on ne l’envoie pas, retiré avec null', async () => {
  const compte = await inscrire(srv, pseudo());
  const c = await connecter(compte);
  const moi = () => c.recus.filter((r) => r.ev === 'user' && r.data.id === compte.id).at(-1)?.data;

  const perso = { v: 2, skin: 2, hair: 'roux', hairStyle: 'tresse', hat: 'bonnet', glasses: 'rondes', beard: 'aucune', accessory: 'guitare', legs: 'jupe', top: 'menthe', bottom: 'noir', topStyle: 'sweat', shoes: 'rouge', eyes: 'clin', mouth: 'langue', cheeks: 'rosees' };
  assert.equal((await c.appel('profile', { ...profil, character: perso })).ok, true);
  await jusque(() => moi()?.character?.hair === 'roux', 'le personnage diffusé aux membres');
  assert.deepEqual(moi().character, perso);

  // Un autre compte pour les essais refusés : le profil se change 5 fois par minute au plus.
  const essais = await connecter(await inscrire(srv, pseudo()));
  for (const faux of [{ ...perso, hat: 'casque à pointe' }, { ...perso, skin: -1 }, { ...perso, hair: 'vert fluo' }, { ...perso, top: '#FF0000' }, { ...perso, eyes: 'laser' }]) {
    const r = await essais.appel('profile', { ...profil, character: faux });
    assert.equal(r.ok, false, `refusé : ${JSON.stringify(faux)}`);
  }

  const debut = c.recus.length;
  assert.equal((await c.appel('profile', { ...profil, bio: 'salut' })).ok, true);
  await jusque(() => c.recus.slice(debut).some((r) => r.ev === 'user' && r.data.id === compte.id), 'profil diffusé');
  assert.deepEqual(moi().character, perso, 'sans personnage envoyé, celui d’avant reste');

  assert.equal((await c.appel('profile', { ...profil, character: null })).ok, true);
  await jusque(() => moi()?.character === null, 'personnage retiré');
});

test('un ancien personnage (une tenue parmi 10) devient un personnage pièce par pièce', async () => {
  const { cleanCharacter, readCharacter } = await import('./options.js');
  const marin = cleanCharacter({ style: 3, skin: 2, hair: 'gris' });
  assert.equal(marin.v, 2);
  assert.equal(marin.hat, 'bonnet');
  assert.equal(marin.beard, 'courte');
  assert.equal(marin.hair, 'gris');
  assert.deepEqual(readCharacter(JSON.stringify({ style: 9, skin: 0, hair: 'noir' })), { ...cleanCharacter({ style: 9, skin: 0, hair: 'noir' }) });
  assert.equal(cleanCharacter({ style: 42, skin: 0, hair: 'noir' }), null);
});

test('renommer : l’équipe seulement, avec les règles de l’inscription, et noté au journal', async () => {
  const admin = await connecter(await compteAdmin());
  const cible = await inscrire(srv, pseudo('cible'));
  const autre = await inscrire(srv, pseudo('autre'));
  const cibleC = await connecter(cible);
  const membre = await connecter(autre);

  assert.equal((await membre.appel('admin:rename', { userId: cible.id, pseudo: pseudo('vole') })).ok, false, 'un membre ne renomme personne');
  for (const mauvais of ['a', 'pas de espace', 'x'.repeat(40), autre.pseudo, autre.pseudo.toUpperCase(), 'admin', ADMIN]) {
    const r = await admin.appel('admin:rename', { userId: cible.id, pseudo: mauvais });
    assert.equal(r.ok, false, `refusé : ${mauvais}`);
  }

  const nouveau = pseudo('neuf');
  const r = await admin.appel('admin:rename', { userId: cible.id, pseudo: nouveau });
  assert.equal(r.ok, true, JSON.stringify(r));
  await jusque(() => cibleC.recus.some((x) => x.ev === 'renamed' && x.data === nouveau), 'la personne renommée est prévenue');
  await jusque(() => membre.recus.some((x) => x.ev === 'user' && x.data.id === cible.id && x.data.pseudo === nouveau), 'tout le monde voit le nouveau pseudo');
  await assert.doesNotReject(entrer(srv, nouveau), 'elle se connecte avec son nouveau pseudo');

  const { entries } = await admin.appel('admin:modLog');
  assert.ok(entries.some((e) => e.action === 'a renommé' && e.detail === `en ${nouveau}`), 'le renommage est au journal');
  assert.equal((await admin.appel('admin:rename', { userId: (await entrer(srv, ADMIN)).id, pseudo: pseudo() })).ok, false, 'on ne se renomme pas soi-même par là');
});

test('un modérateur renomme un membre, mais pas un autre modérateur ni un admin', async () => {
  const admin = await connecter(await compteAdmin());
  const modo = await inscrire(srv, pseudo('modo'));
  const modo2 = await inscrire(srv, pseudo('modob'));
  const membre = await inscrire(srv, pseudo('mb'));
  for (const u of [modo, modo2]) assert.equal((await admin.appel('admin:setRole', { userId: u.id, role: 'modo' })).ok, true);
  const m = await connecter(modo);
  assert.equal((await m.appel('admin:rename', { userId: membre.id, pseudo: pseudo('ok') })).ok, true);
  assert.equal((await m.appel('admin:rename', { userId: modo2.id, pseudo: pseudo('non') })).ok, false);
  assert.equal((await m.appel('admin:clearProfile', { userId: modo2.id, part: 'bio' })).ok, false);
});

test('effacer la bio ou le personnage d’un membre', async () => {
  const admin = await connecter(await compteAdmin());
  const compte = await inscrire(srv, pseudo());
  const c = await connecter(compte);
  assert.equal((await c.appel('profile', { ...profil, bio: 'une bio pas sympa', character: { style: 0, skin: 0, hair: 'noir' } })).ok, true);
  const vu = () => admin.recus.filter((r) => r.ev === 'user' && r.data.id === compte.id).at(-1)?.data;
  await jusque(() => vu()?.bio === 'une bio pas sympa', 'bio diffusée');

  assert.equal((await c.appel('admin:clearProfile', { userId: compte.id, part: 'bio' })).ok, false, 'un membre n’efface rien');
  assert.equal((await admin.appel('admin:clearProfile', { userId: compte.id, part: 'mot de passe' })).ok, false, 'seulement la bio ou le personnage');
  assert.equal((await admin.appel('admin:clearProfile', { userId: compte.id, part: 'bio' })).ok, true);
  await jusque(() => vu()?.bio === '', 'bio effacée');
  assert.ok(vu().character, 'le personnage reste');
  assert.equal((await admin.appel('admin:clearProfile', { userId: compte.id, part: 'character' })).ok, true);
  await jusque(() => vu()?.character === null, 'personnage effacé');
});
