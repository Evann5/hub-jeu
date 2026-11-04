# Escales : le raisonnement du jeu

Le jeu phare de Hubuno, de 2 à 10 joueurs : un jeu d'achat de villes, du même genre que Monopoly ou Rich Up, avec son propre nom, son plateau et ses règles. Toute la carte se voit d'un coup d'œil, en 3D : chaque pays a sa couleur, son drapeau et ses éléments, chaque ville son monument. Un cadre de la couleur du joueur montre à qui elle appartient. On peut jouer seul : des robots complètent la table.

## Le constat de départ

Ce qu'on reproche le plus au genre, et ce qu'Escales fait à la place :

| Le problème | Ce qu'Escales fait |
|---|---|
| Les parties durent des heures | Un nombre de tours fixé (20 par défaut) : à la fin, le plus gros patrimoine gagne |
| On passe son temps à regarder les autres | Échanges à tout moment, temps limité par action, tour passé tout seul quand il n'y a rien à faire |
| Les premiers éliminés s'ennuient | Le décompte final arrive avant que tout le monde soit ruiné |
| Un joueur prend de l'avance et c'est plié | Prime de 100 € au Départ pour qui a moins de la moitié du patrimoine du premier ; l'actualité change les loyers à chaque tour |
| Personne n'obtient une série complète, et la partie stagne | On construit dès la majorité d'une région (3 villes sur 4) |

Sources du constat : [richup.io](https://richup.itch.io/richupio), [Monopoly: The Game That Board Gamers Love to Hate](https://brandonthegamedev.com/?p=161), [What's Wrong With Monopoly?](https://danq.me/2013/04/03).

## La carte

48 cases sur un anneau : 32 villes en 8 régions de 4, de la moins chère à la plus chère, 4 escales, 4 Télex, 2 taxes, 2 chantiers et 4 coins (Départ, Douane, Festival, Contrôle).

**Pour changer les villes** : tout est dans `games/escales/client/board.js`, dans `REGIONS`. Chaque ville a un nom, une phrase et un monument (`model`). Les monuments et les éléments des pays sont dans `client/monuments.js`. Le drapeau, le motif au sol et les éléments de chaque pays sont dans `client/countries.js`.

## Les règles

- **Tour** : on lance deux dés. Un double fait rejouer ; le troisième à la suite envoie à la Douane.
- **Ville libre** : on l'achète ou on passe. Si on passe, elle reste libre pour le suivant.
- **Loyer** : 10 % du prix. Majorité de la région : × 2. Région complète : × 3.
- **Construire** : il faut la majorité d'une région (3 villes sur 4, ou 2 à 2 ou 3 joueurs). Quatre niveaux : Quartier × 4, Quartier animé × 10, Tours × 22, Skyline × 32 ; 25 % de plus si la région est complète. Revente à moitié prix.
- **Escales** : loyer de 25, 50, 100 ou 200 € selon le nombre possédé.
- **Festival** : on gagne 100 €. **Chantier** : on paie 50 €.
- **Télex** : une carte au hasard parmi 14, bonne ou mauvaise.
- **Douane** : pour sortir, un double ou 50 €. Au troisième échec, on paie et on avance.
- **Échanges** : à tout moment, villes et argent ; une ville avec des constructions ne s'échange pas.
- **Dettes** : on vend, on met en gage (moitié du prix, rachat à 110 %) ou on négocie. Sinon, c'est la faillite : le créancier récupère tout.
- **Absent** : à la fin du temps, le jeu joue à sa place, au plus prudent. En cas d'abandon, ses villes retournent à la banque.

## Ce qu'ont montré les parties de robots

Moyennes sur 40 parties par nombre de joueurs, en 20 tours, avec des robots qui achètent, échangent et construisent. Ce sont des robots : à confirmer par de vraies parties, surtout pour la durée.

| Joueurs | 1re construction | 1re faillite | Faillites | Écart entre le 1er et le 2e |
|---|---|---|---|---|
| 2 | tour 4 | tour 18 (rare) | 0,1 | × 1,5 |
| 4 | tour 6 | tour 16 | 0,3 | × 1,5 |
| 6 | tour 4 | tour 15 | 1,4 | × 2 |
| 10 | tour 3 | tour 12 | 5,3 | × 2,6 |

À 10 joueurs, la moitié de la table est éliminée à la fin de la partie, et l'écart est grand. C'est le point à surveiller lors des premières vraies parties.

## Les monuments sculptés

La tour Eiffel, le Colisée et le Golden Gate sont sculptés dans Blender (`assets/monuments/*.glb`, sources dans `docs/monuments-blender/`, à relancer avec `run.sh`). Chaque fichier : une seule forme, des couleurs de sommets, moins de 6 000 triangles et 200 Ko. Les autres monuments sont encore écrits en code (`client/monuments.js`) ; si un fichier ne charge pas, le monument en code reprend sa place.

## Les personnages

Chaque place a son voyageur, dans `CAST` (`client/monuments.js`) : pilote, routard, touriste, marin, hôtesse, cycliste, exploratrice, surfeur, cheffe, grand-père. Même corps pour tous ; la tenue prend la couleur du joueur. Ils marchent sur le sol, le long du bord intérieur du plateau, pour ne jamais cacher le texte des cases.

## Ce qui reste à faire

- Les villes définitives de Minh.
- Valider le style de la maquette 3D, puis soigner monument par monument.
- Sons, confettis de victoire, animations d'achat.
- Three.js pèse 2 Mo : à compresser au moment de la mise en ligne (gzip sur le VPS).

## Pour que ça reste fluide

- Une seule forme par case : les pièces d'un monument sont fondues ensemble (`bake()` dans `client/monuments.js`). Ne jamais ajouter d'objets 3D séparés sur le plateau.
- Les ombres sont calculées une fois, puis seulement quand une construction change. Les pions ont une simple tache d'ombre.
- Rien n'est redessiné quand rien ne bouge : pas de décor animé en continu.
- Si une machine n'arrive pas à suivre, la qualité baisse toute seule (résolution, puis ombres).
