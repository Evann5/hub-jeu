// Nouveautés du 18/11/2026, sur un vrai serveur jetable : niveaux cachés aux membres, favoris, photo d'avatar,
// stats et succès tirés des parties terminées, suppression d'un compte par un admin (à la place du blocage).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { lancerServeur, inscrire, entrer, Client, jusque, ADMIN, MDP } from '../tests/aide-serveur.mjs';

let srv;
let n = 0;
const pseudo = (p = 'v2') => `${p}${Date.now().toString(36).slice(-4)}${(n++).toString(36)}`;
const ouverts = [];
const connecter = async (compte) => { const c = await new Client(srv, compte).ouvrir(); ouverts.push(c); return c; };
const compteAdmin = () => inscrire(srv, ADMIN, { admin: true }).catch(() => entrer(srv, ADMIN));
const etat = (c) => c.recus.find((r) => r.ev === 'state')?.data;
// Un petit JPEG valable pour le serveur : FF D8 FF au début, FF D9 à la fin.
const jpeg = () => `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(400, 7), Buffer.from([0xff, 0xd9])]).toString('base64')}`;

before(async () => { srv = await lancerServeur(); });
after(async () => { ouverts.forEach((c) => c.fermer()); await srv.arreter(); });

test('le niveau (admin) ne se voit que de l’équipe et de soi', async () => {
  const admin = await compteAdmin();
  const ca = await connecter(admin);
  const membre = await connecter(await inscrire(srv, pseudo()));
  await jusque(() => etat(ca) && etat(membre), 'états reçus');
  assert.equal(etat(ca).me.role, 'admin', 'on voit son propre niveau');
  assert.equal(etat(ca).users.find((u) => u.id === admin.id).role, 'admin', 'l’équipe voit les niveaux');
  assert.equal(etat(membre).users.find((u) => u.id === admin.id).role, 'membre', 'un membre ne voit pas qui est admin');
  // Un changement de profil de l'admin, diffusé : toujours « membre » pour les membres.
  await ca.appel('profile', { color: 'bleu', bio: 'admin discret' });
  await jusque(() => membre.recus.some((r) => r.ev === 'user' && r.data.id === admin.id && r.data.bio === 'admin discret'), 'profil diffusé');
  assert.equal(membre.recus.filter((r) => r.ev === 'user' && r.data.id === admin.id).at(-1).data.role, 'membre');
});

test('favoris : à soi seul, gardés, jeu inconnu refusé', async () => {
  const compte = await inscrire(srv, pseudo());
  const c = await connecter(compte);
  assert.deepEqual((await c.appel('favorite', { game: 'morpion', on: true })).favorites, ['morpion']);
  assert.deepEqual((await c.appel('favorite', { game: 'quiz', on: true })).favorites, ['morpion', 'quiz']);
  assert.deepEqual((await c.appel('favorite', { game: 'morpion', on: false })).favorites, ['quiz']);
  assert.equal((await c.appel('favorite', { game: 'pas-un-jeu', on: true })).ok, false);
  const again = await connecter(compte);
  await jusque(() => etat(again), 'état reçu');
  assert.deepEqual(etat(again).favorites, ['quiz'], 'retrouvés à la connexion suivante');
  assert.ok(!('favorites' in etat(again).users.find((u) => u.id === compte.id)), 'jamais dans le profil public');
});

test('photo d’avatar : envoyée, servie aux seuls connectés, refusée si ce n’est pas un JPEG, retirée', async () => {
  const compte = await inscrire(srv, pseudo());
  const c = await connecter(compte);
  assert.equal((await c.appel('profile:photo', { data: 'data:image/png;base64,AAAA' })).ok, false);
  assert.equal((await c.appel('profile:photo', { data: 'data:image/jpeg;base64,AAAAAAAA' })).ok, false, 'pas un vrai JPEG');
  assert.equal((await c.appel('profile', { color: 'bleu', bio: '', pic: 'photo' })).ok, false, 'pas de photo : on ne peut pas la choisir');
  assert.equal((await c.appel('profile:photo', { data: jpeg() })).ok, true);
  const moi = () => c.recus.filter((r) => r.ev === 'user' && r.data.id === compte.id).at(-1)?.data;
  await jusque(() => moi()?.pic === 'photo', 'la photo devient l’avatar');
  const url = `${srv.url}${moi().photo}`;
  assert.equal((await fetch(url, { headers: { cookie: compte.cookie } })).status, 200);
  assert.equal((await fetch(url)).status, 404, 'invisible sans être connecté');
  assert.equal((await c.appel('profile', { color: 'bleu', bio: '', pic: 'silhouette' })).ok, true);
  await jusque(() => moi()?.pic === 'silhouette' && moi()?.photo === null, 'silhouette choisie, la photo n’est plus montrée');
  assert.equal((await c.appel('profile:photo', { data: null })).ok, true);
  assert.equal((await fetch(url, { headers: { cookie: compte.cookie } })).status, 404, 'le fichier est effacé');
});

test('stats et succès : une partie à deux terminée compte une victoire et une défaite', async () => {
  const a = await inscrire(srv, pseudo('ga'));
  const b = await inscrire(srv, pseudo('gb'));
  const ca = await connecter(a);
  const cb = await connecter(b);
  const { id } = await ca.appel('table:create', { game: 'morpion' });
  await cb.appel('table:join', { id });
  await ca.appel('table:start', { id });
  assert.equal((await cb.appel('table:leave', { id })).ok, true); // b abandonne : a gagne
  await jusque(() => ca.recus.some((r) => r.ev === 'stats:changed'), 'les pages sont prévenues');
  const sa = (await ca.appel('stats:user', { userId: a.id }));
  assert.equal(sa.played, 1);
  assert.equal(sa.wins, 1);
  assert.equal(sa.badges.find((x) => x.id === 'premiere').earned, true);
  const sb = (await ca.appel('stats:user', { userId: b.id }));
  assert.equal(sb.wins, 0);
  assert.equal(sb.played, 1);
  const classe = await cb.appel('stats:class', {});
  assert.equal(classe.lastWins[0].userId, a.id);
  assert.equal(classe.lastWins[0].game, 'morpion');
  assert.ok(classe.weekGames >= 1);
});

test('supprimer un compte : réservé aux admins ; le compte disparaît et ne peut plus se connecter', async () => {
  const admin = await connecter(await compteAdmin());
  const cible = await inscrire(srv, pseudo('del'));
  const membre = await connecter(await inscrire(srv, pseudo()));
  const cc = await connecter(cible);
  assert.equal((await membre.appel('admin:deleteUser', { userId: cible.id })).ok, false, 'un membre ne supprime rien');
  assert.equal((await admin.appel('admin:deleteUser', { userId: cible.id })).ok, true);
  await jusque(() => cc.recus.some((r) => r.ev === 'kicked'), 'la personne est déconnectée');
  await jusque(() => membre.recus.some((r) => r.ev === 'user:removed' && r.data === cible.id), 'la classe le retire de sa liste');
  const r = await fetch(`${srv.url}api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pseudo: cible.pseudo, password: MDP }) });
  assert.notEqual(r.status, 200, 'plus de connexion possible');
});
