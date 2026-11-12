Tu reprends Hubuno, le hub de jeux et de messagerie de ma classe. Ton travail : trouver ce qui doit encore être amélioré, puis l'améliorer, avec le niveau d'exigence d'un ingénieur senior qui livre à de vrais utilisateurs.

## Avant tout

1. Lis `CLAUDE.md`, `docs/brief.md`, `docs/decisions.md` (les lignes du 09/11/2026 surtout), `docs/questions-ouvertes.md` et `docs/integration.md`. Puis la carte du code (`overview`, puis `item` et `who_uses` avec `deep` avant de toucher un fichier partagé).
2. Demande-moi en une question si Hubuno est déjà en ligne sur l'O2Switch de mon ami et si les élèves l'utilisent. Ça change tout : si c'est en ligne, chaque poussée devient une mise à jour pour la classe, donc rien ne part sans que les tests soient verts. Toute modification de la base doit aussi passer sans perte sur une base existante.
3. Ne crois pas les résumés sur parole, les miens compris : vérifie dans le code et en lançant les tests (`npm test`, `npm run test:parcours`, avec `MOTEUR=webkit` aussi, `npm run test:parcours:tous`, `npm run test:parcours:tel`).

## Ce qu'on sait déjà qui reste à faire

- **Jamais joué par de vrais élèves, jamais testé sur un vrai téléphone, sons jamais écoutés.** La classe joue surtout sur ordinateur, côte à côte : l'ordinateur passe en premier, et le téléphone ne doit simplement pas casser.
- **Loups-garous** : les rôles ajoutés le 09/11 n'ont été couverts que par les tests de règles, jamais vus dans un navigateur. Ce sont la succession du Capitaine, l'Ancien, la victoire du Loup blanc et la Petite fille repérée. Ils doivent être joués en vrai, à plusieurs joueurs, par l'agent `joueur`. Le salon a 18 réglages, c'est trop long : propose mieux (des préréglages, par exemple). Il reste aussi des points de règle à me faire confirmer :
  - le Loup blanc s'ajoute aux loups au lieu d'en remplacer un ;
  - on peut voter pour soi à l'élection du Capitaine ;
  - la discussion des loups est limitée à 200 caractères.
- **Test instable** : « Escales fermée pendant qu'on regarde » échoue parfois sur WebKit, quand plusieurs scènes 3D tournent. Trouve la vraie cause, ne te contente pas d'allonger une attente.
- **Ménage** :
  - des espaces insécables ont pu être glissées dans du code JavaScript, hors des textes affichés ; vérifie et nettoie seulement le code, pas les textes français ;
  - la carte signale environ 32 éléments peut-être inutilisés et un cycle d'imports ;
  - des fichiers inutilisés attendent mon oui pour être supprimés, ils sont listés dans `docs/questions-ouvertes.md`, en plus de `games/escales/assets/monuments/volcanGoma.glb`, `docs/monuments-blender/volcanGoma.py` et `games/loup-garou/assets/fonts/unbounded.woff2`.
- **À vérifier** : l'écran Jouer s'ouvre-t-il défilé en bas au téléphone ?
- **Questions ouvertes** de `docs/questions-ouvertes.md` : pose-les-moi groupées, avec ta recommandation pour chacune, au lieu de les deviner.

## Ce que j'attends de toi

1. **D'abord un bilan court et classé**, par gravité puis par effet pour la classe. Il couvre la sécurité et la triche, ce qui peut planter ou perdre des données, la fluidité sur ordinateur, la clarté pour un joueur qui découvre un jeu, puis la finition. Pour chaque point : ce que tu as vu, la preuve et ce que tu proposes. Montre-le-moi avant de te lancer dans de gros changements. Les petites corrections évidentes, tu les fais directement.
2. **Ensuite tu corriges**, en commençant par le plus grave, avec un test qui empêche chaque bug corrigé de revenir.
3. **Agents** : tu peux lancer ceux dont tu as besoin sur ce projet (`joueur` pour jouer les jeux, `recetteur` pour le hub, `relecteur` avant de pousser, `securite`, `designer`). Lance-les en `sonnet` par défaut : tu coûtes déjà cher. Ils écrivent seulement dans des serveurs et des `DATA_DIR` jetables, jamais dans `data/`, et sans `name`.
4. **Ne pas casser ce qui marche** : le style Néon du hub, l'identité propre d'Escales, et le style « forêt de minuit » de Loups-garous restent. On améliore, on ne refait pas le look. Pas de nom ni de visuel de Monopoly ni de jeux du commerce. Escales ne fait rien de plus que les bases du genre.
5. **Contraintes techniques** :
   - une seule appli Node.js, en une seule instance, sur O2Switch (cPanel, Passenger) ;
   - aucune dépendance native ;
   - front sans build ;
   - URL relatives (l'appli doit marcher dans un sous-dossier) ;
   - le serveur ne relit les jeux qu'au démarrage.
6. **Committer, pousser et supprimer** : seulement après mon oui. Avant chaque poussée, toute la suite de tests doit être verte. Je te dis ensuite quand mon ami peut faire `git pull` puis *Restart*.
7. **À la fin** : ce qui est fait, avec les preuves, ce qui ne va pas encore et ce qui peut être amélioré, ta recommandation pour la suite, et les décisions qui m'attendent. Note les décisions dans `docs/decisions.md` et mets à jour « Où on en est » dans `CLAUDE.md`.

Je ne suis pas développeur : parle-moi simplement, en français.
