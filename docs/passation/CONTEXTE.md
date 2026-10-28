# Hubuno — le contexte

À lire en premier, par toi et par ton assistant Claude. Rédigé le 23/10/2026 pour Minh, qui fait le hub.

## Le projet en deux phrases

Hubuno est le site privé de notre classe pour jouer ensemble à des jeux de société en ligne et discuter, façon Discord. C'est un projet perso, pour s'amuser, sans date limite, pensé pour durer au moins deux ans.

## Qui fait quoi

| Qui | Rôle |
|---|---|
| **Minh** | Le hub : comptes, messagerie, navigation, design, et bientôt les tables de jeu. Il décide pour tout ce qui touche au hub. |
| **L'élève des jeux** | Les jeux eux-mêmes, en Node, branchés dans le hub. Le premier est un jeu de plateau façon Rich Up (2 à 6 joueurs, dés, tour par tour). Admin de Hubuno avec Minh. |
| **L'élève O2Switch** | Il héberge Hubuno sur son compte O2Switch, qu'il paie déjà. Il le met en ligne et fait les mises à jour. |

## Ce qui a été décidé

Tout est dans `docs/decisions.md`. L'essentiel :
- **Pour qui** : la classe, de 20 à 40 personnes, toutes majeures, sur téléphone et sur ordinateur.
- **Inscription** : avec le code de la classe, puis pseudo et mot de passe. Pas d'e-mail. Un mot de passe oublié est remis à zéro par un admin.
- **Messagerie** : un salon général, des canaux créés par les admins, des messages privés, et plus tard un chat par partie. Texte, emojis et réactions, sans images. Les messages s'effacent au bout d'un an.
- **Modération** : les admins peuvent supprimer un message, mettre quelqu'un en sourdine, bloquer un compte et changer le code de la classe.
- **Jeux** : **le hub fournit le multijoueur**, c'est-à-dire les tables, les tours, les spectateurs et la reconnexion. Chaque jeu est un dossier déposé dans Hubuno, sans son propre serveur. Tout tourne dans **une seule appli Node** sur O2Switch.
- **Style** : « Néon », choisi par Minh. Fond presque noir, grandes cartes arrondies violet, jaune, citron vert et orange, police Unbounded. Navigation par un rail à gauche sur ordinateur et une barre en bas sur téléphone.
- **Réussite** : au moins 15 inscrits et des parties chaque semaine, un mois après la mise en ligne.

## Où on en est

- **Étape 1, faite** : comptes, messagerie complète, présence en ligne, profils, modération, et les pages Accueil, Messages, Membres, Profil et Admin. Tout est testé sur ordinateur, tablette et téléphone. Captures dans `docs/captures/`, vidéo de démo dans `docs/demo/`.
- **Étape 2, à faire par Minh** : les tables de jeu dans le hub, un morpion d'exemple, et le branchement réel des jeux.
- **Étape 3** : les jeux de l'élève des jeux, branchés selon le contrat de `docs/integration.md` §8.

## Ce qu'on attend de toi

**Si tu héberges (élève O2Switch)** : suis `docs/mise-en-ligne.md`, environ 20 minutes. Il te faut :
- le code de la classe, donné par Minh ;
- les pseudos des admins ;
- l'adresse choisie.

Une fois en ligne, dis à Minh ce qu'affiche la page Admin dans « Connexion en direct » (« WebSocket » ou « Long-polling »). C'est la dernière inconnue technique.

**Si tu fais les jeux** : écris tes jeux au format de `docs/integration.md` §8. Les règles vont dans `rules.js` et se testent sans navigateur, l'affichage va dans `client.js`. Ne construis pas ton propre système de tables ou de serveur : c'est le rôle du hub, à l'étape 2. Pas de nom ni de visuel de marque (pas de « Monopoly »).

**Dans les deux cas** : ne touche pas au cœur du hub sans en parler à Minh. Ne remplace jamais le dossier `data/` en ligne, il contient les comptes et les messages.

## Où trouver quoi

| Fichier | Contenu |
|---|---|
| `CLAUDE.md` | Les règles que ton Claude doit suivre à chaque session |
| `docs/integration.md` | Le manuel technique complet : architecture, fichiers, base, échanges en direct, style, contrat des jeux |
| `docs/mise-en-ligne.md` | La mise en ligne sur O2Switch, pas à pas |
| `docs/brief.md` | Le cahier des charges (en anglais, pour les assistants IA) |
| `docs/decisions.md` | Chaque décision, avec sa raison et ce qui a été écarté |
| `docs/questions-ouvertes.md` | Ce qui reste à trancher, et qui tranche |
| `docs/interrogatoire/` | Le compte rendu complet des questions posées à Minh et de ses réponses |
| `docs/captures/`, `docs/demo/` | À quoi ressemble Hubuno aujourd'hui |
