# Hubuno — guide d'intégration

Pour la personne (et son assistant IA) qui reprend Hubuno pour le mettre en ligne ou y brancher des jeux. Dernière mise à jour : 23/10/2026.

## 1. Ce qu'est Hubuno

Un hub privé pour une classe d'études supérieures (20 à 40 personnes, toutes majeures) : jouer à des jeux de société en ligne et discuter, façon Discord. Projet perso, sans échéance, prévu pour durer au moins 2 ans. Trois personnes : Minh (le hub), un élève qui écrit les jeux, un élève qui gère et paie l'hébergement O2Switch.

État au 23/10/2026 :
- **Fait** (étape 1) : comptes, messagerie (canaux, messages privés, réactions, « est en train d'écrire », non-lus), présence en ligne, profils, modération, pages Accueil, Messages, Membres, Profil, Admin, et page Jouer qui annonce les tables.
- **À faire** (étape 2) : les tables de jeu fournies par le hub (créer une table, inviter, rejoindre, regarder, tour par tour, reconnexion), un morpion d'exemple et le branchement des jeux (section 8).
- **Ensuite** (étape 3) : les jeux de l'élève des jeux, le premier étant un jeu de plateau façon Rich Up (2 à 6 joueurs, dés, tour par tour, parties longues).

Le brief complet est dans `docs/brief.md`, l'historique des choix dans `docs/decisions.md`.

## 2. Règles à ne pas casser

1. **Une seule appli Node.js, une seule instance.** La présence en ligne et la limite d'envoi vivent en mémoire. Deux processus en parallèle donneraient des gens « hors ligne » à tort et des messages ratés.
2. **Aucune dépendance native.** O2Switch est un hébergement mutualisé : rien à compiler. La base passe par `node:sqlite`, intégré à Node 22.13 et plus. Seules dépendances : `express` et `socket.io`.
3. **Pas d'étape de build côté navigateur.** Du JavaScript en modules ES servi tel quel, pas de React, pas de bundler. On modifie un fichier, on recharge la page.
4. **L'appli marche à n'importe quelle adresse**, sous-dossier compris. Côté navigateur, toutes les URL sont relatives (`api/me`, `css/app.css`, jamais `/api/me`). Côté serveur, le préfixe vient de `BASE_PATH`. La navigation passe par l'ancre (`#/c/3`).
5. **Sécurité** :
   - tout texte venant d'un utilisateur passe par `textContent`, via la fonction `h()` : jamais de `innerHTML` avec des données ;
   - la Content-Security-Policy (`server.js`) interdit les scripts et styles en ligne ainsi que les ressources externes ;
   - les requêtes qui modifient quelque chose doivent venir de la même origine, en JSON ;
   - chaque événement Socket.IO revérifie l'utilisateur et ses droits.
6. **Données minimales** : pseudo, mot de passe haché (scrypt), avatar, couleur, bio, messages. Aucune adresse e-mail. Les messages sont effacés au bout d'un an.
7. **Le dossier `data/` contient la base** : il ne part jamais dans un zip ni dans git, et ne se remplace jamais lors d'une mise à jour.
8. **Textes en français**, tutoiement, ton simple. Les messages d'erreur disent quoi faire.

## 3. Lancer en local

```sh
npm install
CLASS_CODE=test1234 ADMINS=minh npm run dev   # Node 22.13 ou plus
```

Ouvrir http://localhost:3000, puis « Créer un compte » avec le code `test1234`. Le pseudo `minh` devient admin. Pour tester à plusieurs, ouvrir une fenêtre privée ou un autre navigateur. Un autre appareil sur le même réseau ouvre `http://<IP du Mac>:3000`.

Variables d'environnement (`src/config.js`) :

| Nom | Rôle |
|---|---|
| `CLASS_CODE` | Code de classe de départ, demandé à l'inscription. Les admins peuvent le changer ensuite (il est alors stocké dans la table `settings`). |
| `ADMINS` | Pseudos qui deviennent admins en créant leur compte, séparés par des virgules. |
| `BASE_PATH` | Sous-dossier de l'appli (`/hubuno`), vide pour un domaine ou sous-domaine. |
| `DATA_DIR` | Dossier de la base SQLite, `data/` par défaut. |
| `PORT` | Port d'écoute, fourni par O2Switch (Passenger). |

## 4. Organisation des fichiers

```
server.js              Point d'entrée : Express, en-têtes de sécurité, fichiers statiques, Socket.IO, ménage horaire
src/config.js          Lecture des variables d'environnement
src/db.js              Base SQLite : schéma, canaux de départ, réglages, transaction()
src/options.js         Couleurs, avatars, réactions et limites (partagés avec le navigateur par /api/options)
src/auth.js            Mots de passe (scrypt), sessions (cookie httpOnly), validation, limite des essais de connexion
src/api.js             Routes HTTP : inscription, connexion, déconnexion, mot de passe, suppression du compte
src/chat.js            Messagerie sans Socket.IO : accès aux conversations, historique, réactions, non-lus, canaux, purge
src/realtime.js        Socket.IO : présence, envoi des messages, frappe, profil, actions admin
public/index.html      Page unique
public/css/app.css     Tout le style (variables de couleur en haut du fichier)
public/js/app.js       Démarrage, connexion temps réel, barre de navigation, choix de l'écran selon l'ancre
public/js/store.js     État partagé (moi, membres, canaux, non-lus, conversations chargées) et petites aides
public/js/dom.js       h() pour créer des éléments, icônes SVG, avatars, notifications, dates
public/js/net.js       api() (HTTP), connect() et call() (Socket.IO avec réponse)
public/js/auth.js      Écrans de connexion, d'inscription et de mot de passe imposé
public/js/dialogs.js   Fenêtres : modal(), confirmDialog(), règles, fiche d'un membre avec outils admin, éditeur de canal
public/js/views/*.js   Un fichier par écran : home, games, messages, members, profile, admin
docs/                  Brief, décisions, mise en ligne, ce guide, captures, démo vidéo
```

## 5. Serveur

### Base de données (`src/db.js`)

| Table | Contenu |
|---|---|
| `users` | id, pseudo (unique, insensible à la casse), pass_hash, avatar, color, bio, role (`membre` ou `admin`), muted_until, banned, must_change_password, created_at |
| `sessions` | token_hash (SHA-256 du jeton du cookie), user_id, expires_at (60 jours) |
| `settings` | clé / valeur (`class_code`) |
| `channels` | id, name, topic, position, created_at |
| `messages` | id, scope, user_id, body, created_at |
| `reactions` | message_id, user_id, emoji |
| `reads` | user_id, scope, last_id (dernier message lu) |

Le **scope** dit à quelle conversation appartient un message :
- `c:<id du canal>` pour un canal ;
- `dm:<petit id>:<grand id>` pour un message privé ;
- `t:<id de table>` est réservé au chat d'une table de jeu (étape 2).

`chat.checkScope()` vérifie l'accès. C'est là qu'il faudra ajouter le cas `t:`.

Pour faire évoluer le schéma, utiliser `CREATE TABLE IF NOT EXISTS` pour une nouvelle table. Pour une colonne, ajouter un `ALTER TABLE` protégé par un test sur `PRAGMA table_info`. Ne jamais effacer une table existante : la base de production contient de vraies données.

### Routes HTTP (`src/api.js`, toutes sous `api/`)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `options` | Couleurs, avatars, réactions, limites |
| GET | `me` | Utilisateur connecté (401 sinon) |
| POST | `register` | `{ classCode, pseudo, password, acceptRules: true }` |
| POST | `login` | `{ pseudo, password }`, 10 échecs en 15 min bloquent |
| POST | `logout` | Ferme la session |
| POST | `password` | `{ current, password }` (`current` inutile si le mot de passe a été réinitialisé) |
| POST | `delete-account` | `{ password }` : efface le compte, ses messages, ses réactions |

### Événements Socket.IO (`src/realtime.js`)

Le client appelle `call(socket, 'événement', données)`. La réponse vaut `{ ok: true, ... }` ou `{ ok: false, error: 'message en français' }`.

| Le client envoie | Données | Réponse |
|---|---|---|
| `history` | `{ scope, before? }` | `{ messages, complete }` (pages de 50) |
| `send` | `{ scope, body }` | `{ message }` |
| `react` | `{ messageId, emoji }` | bascule la réaction |
| `read` | `{ scope, lastId }` | marque comme lu |
| `typing` | `{ scope }` | prévient les autres |
| `profile` | `{ avatar, color, bio }` | |
| `admin:deleteMessage`, `admin:mute`, `admin:ban`, `admin:bannedList`, `admin:resetPassword`, `admin:setRole`, `admin:getClassCode`, `admin:setClassCode`, `admin:createChannel`, `admin:updateChannel`, `admin:deleteChannel` | voir le code | réservés aux admins |

| Le serveur envoie | Quand |
|---|---|
| `state` | à chaque connexion ou reconnexion : moi, membres, canaux, messages privés, non-lus, en ligne |
| `presence` | liste des ids en ligne |
| `user`, `user:removed` | un profil change, un compte disparaît |
| `channels` | la liste des canaux change |
| `message`, `message:update`, `message:deleted` | messages et réactions |
| `typing`, `muted`, `kicked` | frappe, sourdine, déconnexion forcée |

Salles Socket.IO : `membres` (tout le monde) et `u:<id>` (chaque personne). Pour un nouvel événement, suivre le modèle : `socket.on('nom', handler(socket, (données, moi) => { ... return {...}; }, { admin? }))`. `handler()` relit l'utilisateur, coupe les comptes bloqués et transforme les `ChatError` en message lisible.

## 6. Navigateur

- **Écrans** : `app.js` lit l'ancre et appelle `render(conteneur)` de l'écran voulu. Les adresses sont `#/`, `#/jouer`, `#/messages`, `#/c/:id`, `#/dm/:id`, `#/membres`, `#/profil`, `#/admin`. Pour ajouter un écran : un fichier dans `public/js/views/`, une entrée dans `parseRoute()` et dans la table des écrans de `applyRoute()`, un lien dans `renderNav()`. Les écrans qui gardent des éléments en mémoire exportent `leave()`.
- **État** : tout passe par `store.js`. Les événements du serveur mettent l'état à jour même quand l'écran concerné est fermé.
- **Créer des éléments** : `h('button.btn', { type: 'button', onclick }, 'Texte')`. Le texte est toujours inséré comme texte, jamais comme HTML.
- **Fenêtres** : `modal(titre, ...contenu)` et `await confirmDialog(titre, texte, { confirmLabel, danger })`. Ne jamais utiliser `alert` ni `confirm`.
- **Formulaires** : `asyncForm(form, async () => {...})` désactive le bouton pendant l'envoi et affiche l'erreur sans effacer la saisie.

## 7. Style (« Néon », validé par Minh)

- Fond presque noir, grandes cartes arrondies (28–32 px) en violet `#A98BFA`, jaune `#F7C64B`, citron vert `#C8F26B` et orange `#F28B5E`, texte noir `#0B0B0D` sur les couleurs.
- Titres en **Unbounded**, texte en **Figtree**. Les deux polices sont hébergées dans `public/fonts/` (licence OFL) : jamais de Google Fonts, interdit par la CSP et par le RGPD.
- Boutons en pilule. L'action principale est en citron vert avec une légère lueur.
- Toutes les couleurs sont des variables en haut de `app.css` (`--bg-0` à `--bg-4`, `--ink`, `--accent`, `--violet`…). Ne pas écrire de couleur en dur dans un nouveau composant.
- Sur ordinateur, navigation par un rail à gauche. Sur téléphone (760 px et moins), par une barre en bas de 5 entrées au plus. Cibles tactiles de 44 px minimum, contrastes de 4,5:1 minimum.
- Captures de référence dans `docs/captures/`, démo dans `docs/demo/`.

## 8. Brancher un jeu (contrat prévu, construit à l'étape 2)

Décision du 23/10/2026 : **le hub fournit le multijoueur**, et chaque jeu est un dossier déposé dans `games/`, sans son propre serveur. Le contrat ci-dessous est la proposition à suivre. Il est à confirmer avec Minh quand l'étape 2 sera construite.

```
games/<id-du-jeu>/
  game.json     { "name": "…", "minPlayers": 2, "maxPlayers": 6, "description": "…" }
  rules.js      côté serveur : les règles, sans réseau ni base
  client.js     côté navigateur : l'affichage et les clics, sans réseau direct
  assets/       images et sons du jeu (servis sous games/<id>/assets/)
```

`rules.js` est un module ES pur que le hub appelle :

```js
export function setup(players, options) { return state; }      // players : [{ id, pseudo }], dans l'ordre des places
export function move(state, playerId, action) {                 // renvoie le nouvel état, ou lève une erreur en français
  return { state, events: [] };
}
export function view(state, playerId) { return publicState; }   // ce que voit ce joueur (cache les cartes des autres) ; playerId null = spectateur
export function status(state) { return { turn: playerId, over: false, winners: [] }; }
```

Ce que fait le hub :
- il crée la table, place les joueurs et accepte les spectateurs ;
- il vérifie que c'est bien le tour du joueur ;
- il appelle `move()`, enregistre l'état en base (une partie longue survit à un redémarrage) et envoie à chacun son `view()` ;
- il gère la reconnexion et le chat de la table (scope `t:<id>`).

Côté navigateur, `client.js` exporte `mount(élément, api)`. L'objet `api` donne `me`, `players`, `onState(callback)`, `sendMove(action)` et `leave()`.

Règles pour un jeu :
- **Aucun hasard dans `client.js`.** Les dés et le mélange se font dans `rules.js`, donc sur le serveur, sinon on peut tricher.
- **Aucun nom ni visuel de marque.** Pas de « Monopoly » : les règles se reprennent, pas le nom ni les images.
- Textes en français, lisible sur téléphone.

En attendant l'étape 2, un jeu peut déjà être écrit et testé seul en respectant ce découpage : `rules.js` se teste avec `node --test` sans navigateur.

## 9. Mise en ligne et mises à jour

Tout est dans `docs/mise-en-ligne.md` : cPanel, « Setup Node.js App », Node 22.13 ou plus, fichier de démarrage `server.js`, variables `CLASS_CODE`, `ADMINS` et `BASE_PATH`.

Pour une mise à jour, remplacer `src`, `public`, `server.js` et `package*.json`, puis « Run NPM Install » et « Restart ». **Ne jamais toucher à `data/`.**

Point encore ouvert : on ne sait pas si O2Switch laisse passer les WebSockets. Socket.IO se rabat de lui-même sur le long-polling. La page Admin indique quel mode est utilisé.

## 10. Vérifier après un changement

- Lancer en local, ouvrir deux navigateurs avec deux comptes, et vérifier :
  - les messages arrivent en direct ;
  - les pastilles de non-lus se mettent à jour ;
  - le téléphone fonctionne (outils de développement à 390 px de large) ;
  - aucune erreur dans la console.
- `node --check` sur les fichiers modifiés.
- Pour un écran : clavier (Tab, Entrée, Échap ferme les fenêtres), contraste, texte long (pseudo de 20 caractères, message de 2 000 caractères).
