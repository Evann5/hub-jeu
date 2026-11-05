# Hubuno

Hub privé de jeux de société en ligne pour la classe de Minh (études sup, 20 à 40 étudiants majeurs), avec messagerie façon Discord. Projet perso, sans date, durée de vie d'au moins 2 ans. Brief : `docs/brief.md` ; historique des décisions : `docs/decisions.md` ; questions en attente : `docs/questions-ouvertes.md`.

## Où on en est (05/11/2026)
- Étape 1 (comptes, messagerie, présence, admin) et étape 2 (tables de jeu) construites.
- 30 jeux dans `games/`, chacun avec son univers visuel (registre : `docs/da/univers.md`) et ses tests de règles (`node --test games/*/rules.test.js`).
- Escales (`games/escales`, raisonnement dans `docs/escales.md`) : le grand jeu de plateau, en 3D, avec sa propre identité (palette Ardoise, sombre et moderne, bouton jaune, grand globe plat en bas à droite derrière le plateau ; Baloo 2 + Barlow Semi Condensed), différente du hub ; ses villes définitives restent à choisir.
- 05/11/2026 : les 30 jeux et le hub ont eu une passe de finition et une recette indépendante (Chromium et WebKit, téléphone et ordinateur). Jamais testés sur un vrai téléphone ni avec de vrais joueurs ; sons jamais écoutés.
- Pas encore en ligne : Minh attend d'aller en cours pour pousser sur le VPS de son pote (`docs/mise-en-ligne-vps.md`, pas encore essayé sur un vrai VPS). Solutions de repli : alwaysdata (`docs/mise-en-ligne-alwaysdata.md`), O2Switch (`docs/mise-en-ligne.md`).

## Règles de chaque session
- **Agents autorisés** : depuis le 04/11/2026, l'assistant lance tous les agents dont il a besoin sur ce projet, sans redemander (Minh : « lance tous les agents dont tu as besoin à partir de maintenant »). Publier, committer et supprimer restent à l'assistant principal, après le oui de Minh.
- Trois personnes : Minh (le hub), un élève qui écrit les jeux, un élève qui gère et paie O2Switch. Minh ne déploie pas lui-même.
- Une seule appli Node.js sur O2Switch (cPanel, Passenger), **une seule instance** : Express + Socket.IO, front en JS sans build, SQLite via `node:sqlite` (Node 22.13 ou plus). Aucune dépendance native.
- L'appli doit marcher à n'importe quelle adresse, sous-dossier compris : URL relatives côté client, `BASE_PATH` côté serveur.
- Comptes : code de classe + pseudo + mot de passe, aucun e-mail ; un admin réinitialise les mots de passe.
- Messagerie : salon général, canaux créés par les admins, messages privés, chat de table ; texte, emojis, réactions ; pas d'images ni de modification. Messages effacés après 1 an.
- Le serveur charge `rules.js` et `game.json` au démarrage : après les avoir modifiés, le redémarrer, recharger la page ne suffit pas.
- Escales, fonctionnalités : Minh (04/11/2026) ne veut rien de plus que ce que fait Rich Up ; on s'en tient aux bases du genre, sans en copier le look. Sur le reste, on améliore l'interface et le visuel.
- Les jeux sont des dossiers dans `games/` qui suivent le guide de branchement ; le hub fournit tables, tours, spectateurs et reconnexion.
- Pas de nom ni de visuels de Monopoly. Captures pour le portfolio : pseudos inventés.
- Look : style « Néon » validé le 23/10/2026 (disposition Discord, presque noir, cartes de couleur vive, Unbounded + Figtree), téléphone et ordinateur. Captures de référence dans `docs/captures/`, démo vidéo dans `docs/demo/`.
- Navigation : écrans Accueil (#/), Jouer (#/jouer), Messages (#/messages, #/c/:id, #/dm/:id), Membres (#/membres), Profil (#/profil), Admin (#/admin). Un fichier par écran dans `public/js/views/`, l'état partagé dans `public/js/store.js`.
