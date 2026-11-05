# Hubuno — guide d'intégration

Pour la personne (et son assistant IA) qui reprend Hubuno pour le mettre en ligne ou y brancher des jeux. Dernière mise à jour : 29/10/2026.

## 1. Ce qu'est Hubuno

Un hub privé pour une classe d'études supérieures (20 à 40 personnes, toutes majeures) : jouer à des jeux de société en ligne et discuter, façon Discord. Projet perso, sans échéance, prévu pour durer au moins 2 ans. Trois personnes : Minh (le hub), un élève qui écrit les jeux, un élève qui gère et paie l'hébergement O2Switch.

État au 23/10/2026 :
- **Fait** (étape 1) : comptes, messagerie (canaux, messages privés, réactions, « est en train d'écrire », non-lus), présence en ligne, profils, modération, pages Accueil, Messages, Membres, Profil, Admin, et page Jouer qui annonce les tables.
- **Fait** (étape 2, 29/10/2026) : les tables de jeu (salon et réglages, invitations, places, tours, minuteurs, spectateurs, chat de table, abandon, revanche), le morpion d'exemple, Undercover et les jeux listés dans `games/`.
- **Ensuite** (étape 3) : les jeux de l'élève des jeux, le premier étant un jeu de plateau façon Rich Up (2 à 6 joueurs, dés, tour par tour, parties longues), branchés selon la section 8.

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
src/gzip.js            Fichiers compressés une fois, puis gardés en mémoire tant qu'ils ne changent pas
src/db.js              Base SQLite : schéma, canaux de départ, réglages, transaction()
src/options.js         Couleurs, avatars, réactions et limites (partagés avec le navigateur par /api/options)
src/auth.js            Mots de passe (scrypt), sessions (cookie httpOnly), validation, limite des essais de connexion
src/api.js             Routes HTTP : inscription, connexion, déconnexion, mot de passe, suppression du compte
src/chat.js            Messagerie sans Socket.IO : accès aux conversations, historique, réactions, non-lus, canaux, purge
src/realtime.js        Socket.IO : présence, envoi des messages, frappe, profil, actions admin
src/games.js           Catalogue des jeux : lit games/*/game.json et rules.js au démarrage
src/tables.js          Tables de jeu sans Socket.IO : salon, places, lancement, coups, minuteurs, revanche, ménage
src/play.js            Tables en direct : salles « t:<id> », vue de chaque joueur, minuteurs, invitations
games/<id>/            Un dossier par jeu (section 8)
public/index.html      Page unique
public/css/app.css     Tout le style (variables de couleur en haut du fichier)
public/js/app.js       Démarrage, connexion temps réel, barre de navigation, choix de l'écran selon l'ancre
public/js/store.js     État partagé (moi, membres, canaux, non-lus, conversations chargées) et petites aides
public/js/dom.js       h() pour créer des éléments, icônes SVG, avatars, notifications, dates
public/js/net.js       api() (HTTP), connect() et call() (Socket.IO avec réponse)
public/js/auth.js      Écrans de connexion, d'inscription et de mot de passe imposé
public/js/dialogs.js   Fenêtres : modal(), confirmDialog(), règles, fiche d'un membre avec outils admin, éditeur de canal
public/js/views/*.js   Un fichier par écran : home, games (Jouer), table (une table #/t/:id), messages, members, profile, admin
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
| `game_tables` | id, game, host_id, status (`lobby`, `playing`, `over`), seats (ids en JSON), left_ids (abandons), options et state (JSON), created_at, updated_at |

Le **scope** dit à quelle conversation appartient un message :
- `c:<id du canal>` pour un canal ;
- `dm:<petit id>:<grand id>` pour un message privé ;
- `t:<id de table>` pour le chat d'une table de jeu (ouvert aux joueurs et aux spectateurs ; effacé avec la table, sans pastilles de non-lus).

`chat.checkScope()` vérifie l'accès.

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
| `table:create` | `{ game }` | `{ id }` |
| `table:watch`, `table:unwatch` | `{ id }` | entrer ou sortir de la salle de la table (reçoit alors `table`) |
| `table:join`, `table:leave`, `table:start`, `table:restart`, `table:close` | `{ id }` | rejoindre, quitter ou abandonner, lancer, revanche, fermer |
| `table:options` | `{ id, options }` | réglages (hôte, dans le salon) |
| `table:kick` | `{ id, userId }` | retirer quelqu'un du salon (hôte) |
| `table:move` | `{ id, action }` | jouer un coup |
| `table:invite` | `{ id, userIds }` | `{ sent }` |
| `admin:deleteMessage`, `admin:mute`, `admin:ban`, `admin:bannedList`, `admin:resetPassword`, `admin:setRole`, `admin:getClassCode`, `admin:setClassCode`, `admin:createChannel`, `admin:updateChannel`, `admin:deleteChannel` | voir le code | réservés aux admins |

| Le serveur envoie | Quand |
|---|---|
| `state` | à chaque connexion ou reconnexion : moi, membres, canaux, messages privés, non-lus, en ligne |
| `presence` | liste des ids en ligne |
| `user`, `user:removed` | un profil change, un compte disparaît |
| `channels` | la liste des canaux change |
| `message`, `message:update`, `message:deleted` | messages et réactions |
| `typing`, `muted`, `kicked` | frappe, sourdine, déconnexion forcée |
| `tables` | la liste des tables change (résumés : jeu, hôte, places, statut, à qui le tour) |
| `table` | à la salle d'une table : `{ table, view, watchers, events, serverNow }`, avec la vue propre à chaque personne |
| `table:closed`, `invite` | une table fermée ; une invitation à rejoindre |

Salles Socket.IO : `membres` (tout le monde), `u:<id>` (chaque personne) et `t:<id>` (qui regarde une table). Pour un nouvel événement, suivre le modèle : `socket.on('nom', handler(socket, (données, moi) => { ... return {...}; }, { admin? }))`. `handler()` relit l'utilisateur, coupe les comptes bloqués et transforme les `ChatError` en message lisible.

## 6. Navigateur

- **Écrans** : `app.js` lit l'ancre et appelle `render(conteneur)` de l'écran voulu. Les adresses sont `#/`, `#/jouer`, `#/t/:id`, `#/messages`, `#/c/:id`, `#/dm/:id`, `#/membres`, `#/profil`, `#/admin`. Pour ajouter un écran : un fichier dans `public/js/views/`, une entrée dans `parseRoute()` et dans la table des écrans de `applyRoute()`, un lien dans `renderNav()`. Les écrans qui gardent des éléments en mémoire exportent `leave()`.
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

## 8. Brancher un jeu (contrat en place depuis le 29/10/2026)

Le hub fournit le multijoueur : tables, places, salon et réglages, tours, minuteurs, spectateurs, reconnexion, chat de table (scope `t:<id>`), invitations et revanche. Un jeu est un dossier de `games/`, détecté au démarrage du serveur (redémarrer après l'ajout d'un jeu). Le jeu d'exemple est `games/morpion/` : le lire d'abord.

```
games/<id>/            id : minuscules, chiffres et tirets
  game.json            fiche du jeu (ci-dessous)
  rules.js             côté serveur : les règles, pures (ni réseau, ni base, ni affichage)
  rules.test.js        tests des règles : node --test games/<id>/*.test.js
  client.js            côté navigateur : l'affichage et les clics
  style.css            facultatif, chargé automatiquement ; chaque sélecteur commence par .g-<id>
  client/, assets/     facultatifs : modules du client, polices, images, sons (servis tels quels)
```

Le navigateur ne reçoit que `client.js`, `style.css`, `client/` et `assets/`. `rules.js` et les autres fichiers (listes de mots…) restent sur le serveur.

### game.json

```json
{
  "name": "Morpion", "tagline": "Trois à la suite, en duel.", "description": "Une ou deux phrases.",
  "how": ["Règle en une phrase.", "…"],
  "minPlayers": 2, "maxPlayers": 2, "duration": "2 min",
  "emoji": "⭕", "family": "plateau", "color": "#C8F26B", "ink": "#0B0B0D", "order": 90,
  "options": [
    { "key": "rounds", "label": "Manches", "type": "number", "min": 1, "max": 10, "default": 3 },
    { "key": "jokers", "label": "Jokers", "help": "Petite explication", "type": "bool", "default": true },
    { "key": "speed", "label": "Rythme", "type": "choice", "default": 60,
      "choices": [{ "value": 30, "label": "30 s" }, { "value": 60, "label": "1 min" }] }
  ]
}
```

`color` et `ink` colorent la carte du jeu et son salon (texte `ink` sur fond `color`, contraste 4,5:1). `family` range le jeu dans un filtre de la page Jouer : `plateau` (plateau et dés), `cartes`, `bluff` ou `ambiance`. Le logo du jeu est `assets/logo.svg` : un pictogramme d'une seule couleur, formes pleines et épaisses, sur une grille `viewBox="0 0 64 64"`, sans texte ni image ; le hub le peint à l'encre `ink` sur la couleur `color`. Sans logo, le hub affiche `emoji`. `"featured": true` (facultatif, un seul jeu) en fait le jeu phare : grande carte en haut de la page Jouer. `"wide": true` (facultatif) donne toute la largeur au jeu pendant la partie : les joueurs et le chat passent dans un panneau qu'on ouvre d'un bouton. `order` range les jeux sur la page Jouer. `how` s'affiche dans « Comment on joue ? ». Les `options` sont réglées par l'hôte dans le salon ; le hub les borne et les passe à `setup()`.

### rules.js

```js
export function setup(players, options, ctx) { return state; }        // players : [{ id, pseudo }] dans l'ordre des places
export function move(state, playerId, action, ctx) { return { state }; } // ou throw new Error('Message en français pour le joueur')
export function view(state, playerId) { return publicState; }          // playerId null = spectateur : ne rien y mettre de secret
export function status(state) { return { turn, over, winners, deadline }; }
export function timeout(state, ctx) { return { state }; }              // facultatif : le minuteur est échu
export function leave(state, playerId, ctx) { return { state }; }      // facultatif : abandon en cours de partie
```

- `ctx` vaut `{ now, random }` : utiliser `ctx.now` pour l'heure et `ctx.random()` pour le hasard (les tests passent un hasard fixe). Jamais `Date.now()` ni `Math.random()` dans les règles.
- L'état doit tenir en JSON (pas de `Set`, de `Map` ni de `Date`) : il est enregistré en base après chaque changement. Ne jamais modifier l'état reçu : en renvoyer un nouveau.
- `status().label` (facultatif, en fin de partie) : le texte du bandeau de fin, quand le gagnant n'est pas un compte du hub (un robot, par exemple).
- `status().turn` : l'id du joueur qui doit jouer, une liste d'ids (coups simultanés : votes, réponses…) ou `null`. C'est lui qui allume « À toi de jouer ». `status().may` (facultatif) : d'autres ids qui peuvent aussi envoyer un coup sans que ce soit « leur tour » (dénoncer un oubli, cliquer « Prêt »…). Le hub refuse les coups de tous les autres.
- **`turn`, `winners` et `deadline` sont publics** : la liste des tables les montre à toute la classe. Rien de secret dedans (pas « les loups » ni « la voyante ») : un coup secret passe par `may`, qui ne quitte jamais le serveur. Le client sait ce qu'il peut faire par sa `view()`. `winners` : liste d'ids. `deadline` : horodatage en ms (calculé avec `ctx.now`) ; à l'échéance le hub appelle `timeout()`.
- Un coup refusé lève `new Error('…')` avec un message en français qui dit quoi faire ; le joueur le voit tel quel. Toute autre erreur est traitée comme un bug.
- `view()` cache les informations secrètes (cartes des autres, rôles, mot…). C'est la seule protection contre la triche : ce que `view()` renvoie arrive dans le navigateur.
- `view()` ne reçoit pas `ctx` : tout ce qui dépend de l'heure (indice dévoilé, fin de phase) doit être écrit dans l'état par `move()` ou `timeout()`. Pour plusieurs échéances, `deadline` vaut la prochaine.
- Les `events` renvoyés par `move()` partent à toute la salle (joueurs et spectateurs) : rien de secret dedans. Une information pour un seul joueur passe par `view()`.
- Le hub limite chaque personne à 40 coups par 5 secondes.
- Sans `leave()`, le bouton « Abandonner » répond que le jeu ne le permet pas. Avec, il faut que la partie continue (ou se termine) sans ce joueur, même si c'était son tour.

### client.js

```js
export function mount(root, api) {
  api.onState((view, info) => { /* redessiner */ });
  return () => { /* facultatif : ménage (minuteurs, écouteurs) */ };
}
```

| `api.` | Rôle |
|---|---|
| `onState(cb)` | `cb(view, info)` à chaque changement, et tout de suite avec l'état actuel. `info` : `{ status, turn, over, winners, deadline, events, watchers, isPlayer, hostId }` |
| `sendMove(action)` | Joue un coup ; promesse rejetée si refusé (le hub affiche déjà l'erreur : `.catch(() => {})` suffit) |
| `me`, `seat`, `players` | Moi (`{ id, pseudo, avatar, color }`), ma place (−1 pour un spectateur), les joueurs dans l'ordre des places |
| `user(id)`, `token(user, { size: 's' })` | Un membre, son avatar (élément DOM) |
| `now()` | L'heure du serveur, pour afficher un compte à rebours depuis `deadline` |
| `h(tag, props, ...enfants)` | Crée des éléments (`h('button.ma-classe', { onclick }, 'Texte')`), texte toujours inséré comme texte |
| `gateTurn()`, `showTurn()` | Facultatif, pour un jeu animé : après `gateTurn()`, le badge « À toi de jouer » ne change plus que quand le jeu appelle `showTurn()`, à la fin de son animation |
| `toast(texte)`, `openChat()`, `asset(chemin)` | Notification, ouvrir le chat (onglet sur téléphone), URL d'un fichier de `assets/` |

`root` occupe toute la zone de jeu (hauteur fixe, le jeu gère son défilement). Le hub affiche autour : l'en-tête, les joueurs, le chat, et une barre « Partie terminée » avec la revanche.

### Règles pour un jeu

- **Sécurité** : jamais de `innerHTML` avec des données, jamais d'`eval`. La Content-Security-Policy interdit les scripts et styles écrits dans le HTML et toute ressource externe : les polices et images sont dans `assets/` (polices sous licence libre, fichier de licence à côté). `element.style.x = …` est permis.
- **Aucun nom ni visuel de marque** : on reprend les règles, jamais le nom ni les images (pas de « Monopoly », « Uno », « Puissance 4 », « Pictionary »…).
- Textes en français, tutoiement. Lisible et jouable au doigt sur téléphone (390 px de large, cibles de 44 px), au clavier sur ordinateur.
- Chaque jeu peut avoir sa propre direction artistique, dans son `style.css`, sous `.g-<id>`.

## 9. Mise en ligne et mises à jour

Tout est dans `docs/mise-en-ligne.md` : cPanel, « Setup Node.js App », Node 22.13 ou plus, fichier de démarrage `server.js`, variables `CLASS_CODE`, `ADMINS` et `BASE_PATH`.

Pour une mise à jour, remplacer `src`, `public`, `games`, `server.js` et `package*.json`, puis « Run NPM Install » et « Restart ». **Ne jamais toucher à `data/`.**

Point encore ouvert : on ne sait pas si O2Switch laisse passer les WebSockets. Socket.IO se rabat de lui-même sur le long-polling. La page Admin indique quel mode est utilisé.

## 10. Vérifier après un changement

- Lancer en local, ouvrir deux navigateurs avec deux comptes, et vérifier :
  - les messages arrivent en direct ;
  - les pastilles de non-lus se mettent à jour ;
  - le téléphone fonctionne (outils de développement à 390 px de large) ;
  - aucune erreur dans la console.
- `node --check` sur les fichiers modifiés.
- Pour un écran : clavier (Tab, Entrée, Échap ferme les fenêtres), contraste, texte long (pseudo de 20 caractères, message de 2 000 caractères).
