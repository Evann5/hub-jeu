# Hubuno

Hub privé de jeux de société en ligne pour une classe d'études supérieures (20 à 40 étudiants majeurs), avec une messagerie façon Discord. Le hub est fait par Minh. Ce dossier sert à le mettre en ligne sur O2Switch et à y brancher les jeux.

**Lis d'abord `CONTEXTE.md`** (le projet, qui fait quoi, où on en est), **puis `docs/integration.md`** : architecture, fichiers, base de données, événements temps réel, style, contrat des jeux, mise en ligne. Contexte et choix : `docs/brief.md` et `docs/decisions.md`. Mise en ligne pas à pas : `docs/mise-en-ligne.md`.

## Règles de chaque session

- Réponds en français. Les textes de l'interface sont en français, au tutoiement.
- **Une seule appli Node.js, une seule instance**, sur O2Switch (cPanel, Passenger) : Express + Socket.IO, base SQLite intégrée à Node (`node:sqlite`, Node 22.13 ou plus). **Aucune dépendance native**, aucune étape de build côté navigateur.
- URL relatives partout dans le navigateur, `BASE_PATH` côté serveur : l'appli doit marcher dans un sous-dossier.
- Texte des utilisateurs : toujours via `h()` (`textContent`), jamais `innerHTML`. Ne pas affaiblir la Content-Security-Policy de `server.js` sans raison écrite.
- Chaque nouvel événement Socket.IO passe par `handler()` dans `src/realtime.js` et vérifie les droits.
- Ne jamais supprimer ni remplacer le dossier `data/` (la base de production). Faire évoluer le schéma en ajoutant, jamais en effaçant.
- Style « Néon » validé : utilise les variables de `public/css/app.css`, les composants existants (`.card`, `.btn`, `modal()`, `confirmDialog()`) et les polices hébergées. Pas de Google Fonts, pas de couleur en dur.
- Les jeux suivent le contrat de `docs/integration.md` §8 : un dossier par jeu dans `games/`, règles côté serveur dans `rules.js`, affichage dans `client.js`, hasard toujours côté serveur. Pas de nom ni de visuel de marque (pas de « Monopoly »).
- Avant de modifier le hub lui-même (autre chose qu'un jeu ou la mise en ligne), préviens Minh : il en est le responsable.
- Après un changement : lancer en local (`CLASS_CODE=test1234 ADMINS=minh npm run dev`), tester à deux navigateurs, vérifier la console.
