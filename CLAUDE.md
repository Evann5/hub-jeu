# Hubuno

Hub privé de jeux de société en ligne pour la classe de Minh (études sup, 20 à 40 étudiants majeurs), avec messagerie façon Discord. Projet perso, sans date, durée de vie d'au moins 2 ans. Brief : `docs/brief.md` ; historique des décisions : `docs/decisions.md` ; questions en attente : `docs/questions-ouvertes.md`.

## Où on en est (02/11/2026)
- Étape 1 (comptes, messagerie, présence, admin) et étape 2 (tables de jeu) construites.
- 30 jeux dans `games/`, chacun avec son univers visuel (registre : `docs/da/univers.md`) et ses tests de règles (`node --test games/*/rules.test.js`).
- Escales (`games/escales`, raisonnement dans `docs/escales.md`) : le grand jeu de plateau, en 3D, fait sur le Mac de Minh ; ses villes définitives et la validation du style sont en attente.
- Pas encore en ligne : Minh parle maintenant d'un VPS plutôt que d'O2Switch, à confirmer avant la mise en ligne (`docs/questions-ouvertes.md`, guide O2Switch `docs/mise-en-ligne.md`).

## Règles de chaque session
- **Pas d'agents** pour le hub : l'assistant principal le code lui-même, en utilisant les skills et les fiches des agents (design, développement, pièges connus) (demande de Minh, 23/10/2026). Exception du 29/10/2026 : des agents peuvent écrire de nouveaux jeux, chacun ne touchant qu'à son dossier de `games/`.
- Trois personnes : Minh (le hub), un élève qui écrit les jeux, un élève qui gère et paie O2Switch. Minh ne déploie pas lui-même.
- Une seule appli Node.js sur O2Switch (cPanel, Passenger), **une seule instance** : Express + Socket.IO, front en JS sans build, SQLite via `node:sqlite` (Node 22.13 ou plus). Aucune dépendance native.
- L'appli doit marcher à n'importe quelle adresse, sous-dossier compris : URL relatives côté client, `BASE_PATH` côté serveur.
- Comptes : code de classe + pseudo + mot de passe, aucun e-mail ; un admin réinitialise les mots de passe.
- Messagerie : salon général, canaux créés par les admins, messages privés, chat de table ; texte, emojis, réactions ; pas d'images ni de modification. Messages effacés après 1 an.
- Les jeux sont des dossiers dans `games/` qui suivent le guide de branchement ; le hub fournit tables, tours, spectateurs et reconnexion.
- Pas de nom ni de visuels de Monopoly. Captures pour le portfolio : pseudos inventés.
- Look : style « Néon » validé le 23/10/2026 (disposition Discord, presque noir, cartes de couleur vive, Unbounded + Figtree), téléphone et ordinateur. Captures de référence dans `docs/captures/`, démo vidéo dans `docs/demo/`.
- Navigation : écrans Accueil (#/), Jouer (#/jouer), Messages (#/messages, #/c/:id, #/dm/:id), Membres (#/membres), Profil (#/profil), Admin (#/admin). Un fichier par écran dans `public/js/views/`, l'état partagé dans `public/js/store.js`.
