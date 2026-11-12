Tu reprends **Hubuno**, le hub privé de jeux de société et de messagerie façon Discord de ma classe : 20 à 40 étudiants, 30 jeux. Je ne suis pas développeur. Parle-moi simplement, en français.

## Ta mission

Faire passer **le hub** du stade « ça marche dans les tests » au stade « ça tient une vraie classe pendant deux ans ». Le hub, c'est :
- les comptes et l'inscription ;
- la messagerie et la présence ;
- les parties (salon, tours, spectateurs, reconnexion) ;
- la modération, l'admin, les notifications ;
- les mises à jour sur O2Switch.

Les règles de chaque jeu ne sont pas ta mission : un petit réglage dans un jeu se fera plus tard, dans une session moins chère. Tu t'intéresses aux jeux seulement par ce que le hub leur fournit à tous (`docs/integration.md`).

Je préfère dix problèmes profonds réglés à fond plutôt que cinquante retouches. Cherche ce que les relectures précédentes n'ont pas vu : elles ont regardé fichier par fichier, toi regarde le système entier.

**L'usage réel** : 30 élèves assis côte à côte, chacun sur son ordinateur, qui s'inscrivent, discutent et enchaînent des parties. Le téléphone passe après : il doit seulement ne rien casser. Le son est presque jamais allumé. Personne ne l'a encore utilisé en vrai.

## 1. Comprendre, sans rien modifier

- **La carte du code** : `overview`, puis `item`, `who_uses` (avec `deep` avant de toucher un fichier partagé) et `search`. Lis-la avant d'ouvrir des fichiers.
- **Les documents** :
  - `CLAUDE.md` ;
  - `docs/brief.md` ;
  - `docs/decisions.md` ;
  - `docs/questions-ouvertes.md` ;
  - `docs/integration.md` ;
  - `docs/mise-en-ligne.md` ;
  - la fiche `~/.claude/toolkit/fiches/pieges-connus.md`, section par section (`grep -n '^## '` d'abord).
- **Les tests** : lance toute la suite pour avoir un point de départ chiffré :

  ```
  npm test
  npm run test:parcours
  MOTEUR=webkit npm run test:parcours
  npm run test:parcours:tous
  ```

  Garde les chiffres exacts. Ne crois aucun résumé sur parole, les miens compris : vérifie dans le code et par l'exécution.
- **Ma question** : pose-la-moi avant d'aller plus loin. Hubuno est-il déjà en ligne sur l'O2Switch de mon ami, et la classe l'utilise-t-elle ? Si oui, chaque poussée devient une mise à jour pour de vrais élèves, et la base existante doit passer chaque changement sans perte.

## 2. Ausculter le hub en profondeur

Pour chaque axe : ce qui peut arriver en vrai, et la preuve, par un test, une simulation ou un scénario rejoué. Pas d'impression.

1. **Temps réel et état partagé** :
   - deux onglets du même élève ;
   - une coupure wifi de 30 secondes, puis le retour ;
   - un onglet en veille une heure ;
   - le serveur redémarré pendant une partie ou une mise à jour ;
   - une partie dont l'hôte part ;
   - un message envoyé pendant une reconnexion ;
   - des messages dans le désordre ou en double.

   Le serveur reste-t-il la seule source de vérité ? Le navigateur retombe-t-il toujours sur un état juste, sans recharger ?
2. **Une vraie soirée simulée** : 30 à 40 comptes, plusieurs parties en même temps, des spectateurs, le chat actif, des déconnexions au hasard. Mesure la mémoire, le temps de réponse et les erreurs, et vérifie qu'après deux heures plus rien ne traîne : les écouteurs, les minuteurs, les parties fantômes, les présences fausses.
3. **Sécurité et triche**, par un élève qui sait ouvrir la console. Peut-il :
   - usurper un compte ;
   - jouer ou écrire à la place d'un autre ;
   - lire une donnée cachée dans ce que le serveur envoie, à lui ou aux spectateurs ;
   - contourner une sourdine, un blocage ou un niveau ;
   - remplir la base ou geler le serveur ;
   - glisser du HTML ;
   - deviner le code de classe ?
4. **Données et durée** :
   - les migrations au démarrage sur une base existante ;
   - un arrêt brutal en pleine écriture ;
   - la croissance sur deux ans (messages effacés après un an, journaux, index) ;
   - la sauvegarde et la restauration ;
   - ce qui se passe si le disque d'O2Switch est plein.
5. **Mise en ligne et mise à jour sur O2Switch** :
   - Passenger peut redémarrer l'appli quand il veut ;
   - le sous-dossier avec `BASE_PATH` ;
   - le bandeau « Hubuno a été mis à jour » ;
   - la connexion de secours si les WebSockets ne passent pas ;
   - ce qui arrive aux parties en cours pendant un *Restart*.

   Relis `docs/mise-en-ligne.md` et `docs/installation-avec-claude.md` comme quelqu'un qui ne connaît rien, et corrige-les.
6. **Expérience sur ordinateur** :
   - le premier passage d'un élève, de l'inscription à sa première partie ;
   - trouver une partie et inviter quelqu'un ;
   - suivre la discussion, les mentions et les non-lus ;
   - comprendre ce qu'on attend de lui.

   Repère où il hésite, ce qui est lent, les états vides, les erreurs, le clavier, et le contraste avec le style Néon.
7. **Performance** : le poids et le temps du premier affichage, et le passage d'un écran à l'autre. Si un affichage est complètement recalculé à chaque événement, la page gèle-t-elle avec 40 élèves et beaucoup de messages ?
8. **Qualité du code**, pour que quelqu'un d'autre puisse le reprendre :
   - la carte signale environ 32 éléments peut-être inutilisés et un cycle d'imports ;
   - il y a peut-être du code dupliqué entre le hub et les jeux ;
   - des espaces insécables ont pu être glissées dans du code JavaScript, hors des textes affichés ; nettoie seulement le code, jamais les textes français ;
   - un test échoue parfois sur WebKit (« Escales fermée pendant qu'on regarde ») : il peut cacher une vraie fuite au démontage d'une partie, trouve la cause.

## 3. Le bilan, puis tu t'arrêtes

Donne-moi un bilan d'une page au plus, classé en trois niveaux :

1. **Bloquant** : un plantage, une perte de données, de la triche, un secret visible, un élève coincé.
2. **Gênant** : c'est lent, pas clair, ou fragile.
3. **Finition**.

Chaque point contient :
- ce que tu as vu ;
- la preuve ;
- la correction proposée et sa taille (petite, moyenne, grosse).

**Attends mon oui** avant les changements moyens et gros. Les petites corrections évidentes et sans risque, fais-les et liste-les.

Les questions de `docs/questions-ouvertes.md` qui concernent le hub : pose-les-moi groupées, avec ta recommandation pour chacune.

## 4. Corriger

- Du plus grave au moins grave. Pour chaque bug corrigé, ajoute un test qui échouait avant et passe après.
- Après chaque lot : la suite complète (Chromium et WebKit), et un coup d'œil à l'écran sur ordinateur.
- Les serveurs de test tournent toujours avec un `DATA_DIR` jetable dans ton dossier temporaire, jamais avec `data/`, qui est la vraie base. Ne laisse aucun serveur tourner en fond à la fin.

## Agents

Ils sont autorisés sans me redemander :
- `securite`, pour la triche et les failles ;
- `recetteur`, pour les parcours du hub ;
- `relecteur`, avant de pousser ;
- `designer`, si un écran est confus.

Lance-les **en `sonnet`** (tu coûtes environ 2,5 fois Opus), sans `name`, avec une mission précise : le but, les fichiers, ce qui reste intact, le serveur jetable et la forme du rapport. Garde pour toi le raisonnement difficile (l'architecture, le temps réel, la cause des bugs) et vérifie toi-même leurs conclusions importantes.

## Ce qu'on ne touche pas

- **Les looks** : le style Néon du hub et l'identité propre de chaque jeu. On améliore, on ne refait pas. Pas de nom ni de visuel de Monopoly ou d'un jeu du commerce.
- **La technique** :
  - une seule appli Node.js, en une seule instance, sur O2Switch (cPanel, Passenger, Node 22.13 ou plus, `node:sqlite`) ;
  - Express et Socket.IO ;
  - aucune dépendance native ;
  - front sans build ;
  - URL relatives et `BASE_PATH` ;
  - le serveur ne relit les jeux qu'au démarrage.
- **Les textes de l'utilisateur** passent toujours par `textContent`, et on n'affaiblit pas la Content-Security-Policy. Chaque événement Socket.IO passe par `handler()` et vérifie les droits.
- **La base** : on ajoute, on n'efface jamais une colonne ni une table.
- **Le contrat des jeux** (`docs/integration.md`) : on l'étend sans casser les 30 jeux.
- **Committer, pousser et supprimer un fichier** : seulement après mon oui.

## À la fin

1. **Ce qui est fait**, avec les chiffres des tests avant et après.
2. **Ce qui ne va pas encore** et ce qui pourrait être amélioré, avec ta recommandation.
3. **Les décisions qui m'attendent**, chacune avec ton conseil.
4. **La liste des petits réglages de jeux** que tu as croisés, pour une session moins chère.
5. **Si je dois pousser** : le message de commit proposé, et ce que mon ami fait ensuite (`git pull`, puis *Restart* dans cPanel, hors des heures de cours).

Note les décisions dans `docs/decisions.md`, les questions dans `docs/questions-ouvertes.md`, et mets à jour « Où on en est » dans `CLAUDE.md`.
