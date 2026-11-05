# Tests de parcours

- **Lancer** : `npm run test:parcours` (Chromium) ou `MOTEUR=webkit npm run test:parcours` (Safari) ; les 29 jeux : `npm run test:parcours:tous` (environ 1 min, ou `TOUS_LES_JEUX=1`, `JEUX=morpion,dames` pour en choisir). Les tests de règles restent dans `npm test`.
- **Isolés** : chaque fichier `*.test.mjs` démarre son propre serveur (port libre, `DATA_DIR` temporaire, supprimé ensuite) ; `data/` et un serveur en marche ne sont jamais touchés. Chaque test crée ses comptes (`aide.mjs`).
- **Playwright** : celui du projet s'il est installé, sinon celui de `~/.claude/toolkit/outils/` (ou le dossier `PLAYWRIGHT_DIR`) ; aucun des deux, ou navigateur absent : les tests s'affichent « ignorés » avec la raison. Rien n'est installé par les tests.
- **Limites du serveur** à respecter si on ajoute un test : 60 inscriptions/h par adresse, 6 créations de table/min et par joueur, 5 messages par 5 s et par joueur, 200 échecs de connexion par adresse.
- **Un test rouge est un vrai signal** : pas d'attente fixe, tout se cale sur le DOM ; le test « coupure » coupe puis relance le serveur (`S.serveur.couper()` / `demarrer()`).
