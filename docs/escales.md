# Escales : le raisonnement du jeu

Le grand jeu de plateau de Hubuno, de 2 à 10 joueurs : un jeu d'achat de villes, du même genre que Monopoly ou Rich Up, avec son propre nom, son plateau et ses règles. Le plateau est une maquette en 3D : chaque ville a son monument.

## Le constat de départ

Ce qu'on reproche le plus au genre, et ce qu'Escales fait à la place :

| Le problème | Ce qu'Escales fait |
|---|---|
| Les parties durent des heures | Un nombre de tours fixé (20 par défaut) : à la fin, le plus gros patrimoine gagne |
| On passe son temps à regarder les autres | Enchères secrètes où tout le monde mise en même temps, échanges à tout moment, temps limité par action, tour passé tout seul quand il n'y a rien à faire |
| Les premiers éliminés s'ennuient | Le décompte final arrive avant que tout le monde soit ruiné |
| Un joueur prend de l'avance et c'est plié | Prime de 100 € au Départ pour qui a moins de la moitié du patrimoine du premier ; l'actualité change les loyers à chaque tour |
| Personne n'obtient une série complète, et la partie stagne | On construit dès la majorité d'une région (3 villes sur 4) |
| Enchères longues à plusieurs | 20 secondes, mises secrètes, une seule mise par personne |

Sources du constat : [richup.io](https://richup.itch.io/richupio), [Monopoly: The Game That Board Gamers Love to Hate](https://brandonthegamedev.com/?p=161), [What's Wrong With Monopoly?](https://danq.me/2013/04/03).

## La carte

48 cases sur un anneau : 32 villes en 8 régions de 4, de la moins chère à la plus chère, 4 escales, 4 Télex, 2 taxes, 2 chantiers et 4 coins (Départ, Douane, Festival, Contrôle).

**Pour changer les villes** : tout est dans `games/escales/client/board.js`, dans `REGIONS`. Chaque ville a un nom, une phrase et un monument (`model`). Les monuments sont dans `games/escales/client/monuments.js`.

## Les règles

- **Tour** : on lance deux dés. Un double fait rejouer ; le troisième à la suite envoie à la Douane.
- **Ville libre** : on l'achète, ou elle part aux enchères secrètes (20 s). Le plus offrant gagne ; à égalité, le premier qui a misé.
- **Loyer** : 10 % du prix. Majorité de la région : × 2. Région complète : × 3.
- **Construire** : il faut la majorité d'une région (3 villes sur 4, ou 2 à 2 ou 3 joueurs). Quatre niveaux : Quartier × 4, Quartier animé × 10, Tours × 22, Skyline × 32 ; 25 % de plus si la région est complète. Revente à moitié prix.
- **Escales** : loyer de 25, 50, 100 ou 200 € selon le nombre possédé. Après s'y être arrêté, on peut s'envoler vers une autre escale pour 50 €.
- **Festival** : on choisit une de ses villes, son loyer double jusqu'à son prochain tour. **Chantier** : un niveau à moitié prix.
- **À la une** : à chaque tour, une région au hasard connaît la haute saison (loyers × 1,5), une grève (loyers ÷ 2) ou des subventions (constructions à moitié prix).
- **Télex** : une carte au hasard parmi 14, bonne ou mauvaise.
- **Douane** : pour sortir, un double, 50 € ou un passe-douane. Au troisième échec, on paie et on avance.
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

## Ce qui reste à faire

- Les villes définitives de Minh.
- Valider le style de la maquette 3D, puis soigner monument par monument.
- Sons, confettis de victoire, animations d'achat.
- Three.js pèse 2 Mo : à compresser au moment de la mise en ligne.
