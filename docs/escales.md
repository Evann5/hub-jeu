# Escales : le raisonnement du jeu

Le jeu phare de Hubuno, de 2 à 10 joueurs : un jeu d'achat de villes, du même genre que Monopoly ou Rich Up, avec son propre nom, son plateau et ses règles. Toute la carte se voit d'un coup d'œil, en 3D : chaque pays a sa couleur, son drapeau et ses éléments, chaque ville son monument. L'étiquette de la ville porte la pastille de son propriétaire ; cliquer sur un joueur soulève ses villes dans sa couleur. On peut jouer seul : des robots complètent la table.

## Le constat de départ

Ce qu'on reproche le plus au genre, et ce qu'Escales fait à la place :

| Le problème | Ce qu'Escales fait |
|---|---|
| Les parties durent des heures | Un nombre de tours fixé (20 par défaut) : à la fin, le plus gros patrimoine gagne |
| On passe son temps à regarder les autres | Échanges à tout moment, temps limité par action, tour passé tout seul quand il n'y a rien à faire |
| Les premiers éliminés s'ennuient | Le décompte final arrive avant que tout le monde soit ruiné |
| Un joueur prend de l'avance et c'est plié | Un nombre de tours limité : la partie s'arrête avant que tout soit joué d'avance |
| Personne n'obtient une série complète, et la partie stagne | On construit dès la majorité d'une région (3 villes sur 4) |

Sources du constat : [richup.io](https://richup.itch.io/richupio), [Monopoly: The Game That Board Gamers Love to Hate](https://brandonthegamedev.com/?p=161), [What's Wrong With Monopoly?](https://danq.me/2013/04/03).

## La carte

48 cases sur un anneau : 32 villes en 8 régions de 4, de la moins chère à la plus chère, 4 escales, 4 Télex, 2 taxes, 2 chantiers et 4 coins (Départ, Douane, Festival, Contrôle).

**Pour changer les villes** : tout est dans `games/escales/client/board.js`, dans `REGIONS`. Chaque ville a un nom, une phrase et un monument (`model`). Les monuments et les éléments des pays sont dans `client/monuments.js`. Le drapeau, le motif au sol et les éléments de chaque pays sont dans `client/countries.js`.

## Les règles

- **Tour** : on lance deux dés. Un passage au Départ rapporte 200 €. Un double fait rejouer ; le troisième à la suite envoie à la Douane.
- **Ville libre** : on l'achète ou on passe. Si on passe, elle reste libre pour le suivant.
- **Loyer** : 10 % du prix. Majorité de la région : × 2. Région complète : × 3.
- **Construire** : il faut la majorité d'une région (3 villes sur 4, ou 2 à 2 ou 3 joueurs). Quatre niveaux : Quartier × 5, Quartier animé × 13, Tours × 26, Skyline × 40 ; 25 % de plus si la région est complète. Revente à moitié prix.
- **Escales** : loyer de 25, 50, 100 ou 200 € selon le nombre possédé.
- **Festival** : on gagne 100 €. **Chantier** : on paie 50 €.
- **Télex** : une carte au hasard parmi 14, bonne ou mauvaise.
- **Douane** : pour sortir, un double ou 50 €. Au troisième échec, on paie et on avance.
- **Échanges** : à tout moment, villes et argent ; une ville avec des constructions ne s'échange pas.
- **Dettes** : on vend, on met en gage (moitié du prix, rachat à 110 %) ou on négocie. Sinon, c'est la faillite : le créancier récupère tout.
- **Absent** : à la fin du temps, le jeu joue à sa place, au plus prudent. En cas d'abandon, ses villes retournent à la banque.

## Ce qu'ont montré les parties de robots

Moyennes sur 200 parties par nombre de joueurs, en 20 tours, avec les règles actuelles (mesure du 05/11/2026, script d'essai non conservé dans le projet). Ce sont des robots : à confirmer par de vraies parties, surtout pour la durée.

| Joueurs | 1re construction | Parties sans construction | Parties avec une faillite | Écart entre le 1er et le 2e | Lancers de dés |
|---|---|---|---|---|---|
| 2 | tour 4 | 0 % | 10 % | × 1,95 | 46 |
| 3 | tour 2,5 | 0 % | 50 % | × 2,1 | 61 |
| 4 | tour 8,5 | 4 % | 14 % | × 1,5 | 92 |
| 6 | tour 8 | 2 % | 33 % | × 1,7 | 133 |
| 8 | tour 7,5 | 3 % | 44 % | × 1,85 | 168 |
| 10 | tour 7,5 | 10 % | 48 % | × 1,9 | 207 |

À partir de 4 joueurs, on construit vers le tour 8, car réunir 3 villes sur 4 d'un pays prend du temps (règle gardée à la demande de Minh). Les faillites deviennent courantes à partir de 6 joueurs. À 3 joueurs, 2 villes suffisent : on construit très tôt et une partie sur deux connaît une faillite, c'est le réglage à regarder en premier si de vraies parties semblent trop brutales.

Niveau des robots (200 parties par style, 4 joueurs, 20 tours) : un joueur simulé qui ne négocie pas contre 3 robots gagne 15 à 16 % des parties, qu'il achète tout ou joue prudent. Les robots ne sont donc pas trop faibles. Trois réglages plus agressifs n'y changent presque rien (14 à 15 %) : ils ne sont pas retenus. À revoir avec de vraies parties, où les joueurs négocient.

## Les monuments sculptés

Les monuments et les cases spéciales sont sculptés dans Blender (`assets/monuments/*.glb`, sources dans `docs/monuments-blender/`, à relancer avec `run.sh`). Chaque fichier : une seule forme, des couleurs de sommets, moins de 6 000 triangles et 200 Ko. Si un fichier ne charge pas, le monument écrit en code (`client/monuments.js`) reprend sa place.

## Les personnages

Chaque place a son voyageur, dans `CAST` (`client/monuments.js`) : pilote, routard, touriste, marin, hôtesse, cycliste, exploratrice, surfeur, cheffe, grand-père. Même corps pour tous ; la tenue prend la couleur du joueur. Ils marchent sur le sol, le long du bord intérieur du plateau, pour ne jamais cacher le texte des cases.

## Ce qui reste à faire

- Écouter les sons : ils n'ont jamais été entendus par personne d'autre que le programme qui les fabrique.
- Une vraie partie, en ligne, sur de vrais téléphones.

## Pour que ça reste fluide

- Une seule forme par case : les pièces d'un monument sont fondues ensemble (`bake()` dans `client/monuments.js`). Ne jamais ajouter d'objets 3D séparés sur le plateau.
- Les ombres sont calculées une fois, puis seulement quand une construction change. Les pions ont une simple tache d'ombre.
- Au repos, seuls les drapeaux bougent, à 10 images par seconde au lieu de 60.
- Three.js est minifié (le jeu pèse environ 2,3 Mo sans compression). Si on le met à jour, repasser la version neuve par esbuild.
- Si une machine n'arrive pas à suivre, la qualité baisse toute seule (résolution, puis ombres).
