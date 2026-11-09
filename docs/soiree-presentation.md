# Soirée de présentation : la démo de Hubuno

Ce document est pour Minh. Il sert à deux choses : présenter Hubuno depuis ton Mac (parcours A), et l'essayer sur de vrais téléphones en Wi-Fi local (parcours B).

**Ce n'est pas la mise en ligne.** La démo tourne sur ton Mac, avec des données inventées (une classe imaginaire, des messages, des parties). Elle utilise son propre dossier, `data/demo/`. La vraie base (`data/hubuno.sqlite`) n'est jamais touchée. Les mots de passe de la démo sont connus de tous : elle refuse de démarrer en production.

## La commande

Dans le Terminal, dans le dossier du projet :

```
npm run demo
```

Au premier lancement, la démo se remplit toute seule (une dizaine de secondes). Ensuite, elle affiche un cadre avec :

- l'adresse à ouvrir **sur ton Mac** : `http://localhost:3000/` ;
- l'adresse à ouvrir **sur un téléphone du même Wi-Fi** : `http://192.168.x.x:3000/` (les chiffres changent selon le réseau) ;
- le code de classe de la démo : `classe-demo-2026` ;
- les comptes de démo et leur mot de passe.

À savoir : pendant que la démo tourne, n'importe qui sur le même Wi-Fi peut l'ouvrir, et ses mots de passe sont connus. C'est sans risque, puisque tout y est inventé, mais n'y mets rien de vrai et arrête-la après la présentation (Ctrl+C dans le Terminal).

Si le port 3000 est déjà pris, la démo prend le suivant (3001, 3002...) : l'adresse affichée est toujours la bonne. Pour choisir toi-même : `npm run demo -- --port 3100`.

Pour arrêter : `Ctrl + C` dans le Terminal. Tu peux relancer quand tu veux : rien n'est ajouté en double, les messages et les parties sont toujours là.

Pour repartir de zéro (par exemple si la démo a plus de trois jours) : `npm run demo -- --neuf`. Le Terminal te demande de taper « oui ». L'ancien dossier n'est pas supprimé : il est renommé `data/demo-ancien-` suivi de la date.

### Les comptes de démo

| Compte | Mot de passe | À quoi il sert |
| --- | --- | --- |
| `Lune.Verte` | `Demo-Classe-2026!` | L'élève avec qui tu présentes. Elle a des messages non lus, une partie où c'est à elle de jouer, et des parties terminées. |
| `Admin-Demo` | `Demo-Admin-2026!` | Le compte admin, pour montrer l'écran Admin. |
| Les 11 autres élèves | `Demo-Classe-2026!` | Pixel42, Noisette, Mistral, Kiwi.k, Cassiopée, Barnabé, Pomelo, Zozo, Tonton_Dés, Capitaine_Biscotte, Ludo-Lent. |

Neuf d'entre eux sont « en ligne » pendant que la démo tourne (le Terminal reste ouvert, ils sont connectés par un petit programme). Capitaine_Biscotte et Ludo-Lent sont hors ligne, pour montrer la différence.

Les parties en attente (Escales, Loups-garous, Quiz, Poker, Quatre à la suite) restent ouvertes tant que la démo tourne : en temps normal, Hubuno ferme un salon vide au bout de 5 minutes, mais ici un élève de la démo est assis à chaque table et la regarde.

## A. Présenter la démo depuis le Mac (5 minutes)

Avant : lance `npm run demo`, ouvre `http://localhost:3000/` (ou le port affiché) dans Chrome ou Safari, clique sur l'onglet « Se connecter » (la page s'ouvre sur « Créer un compte ») et connecte-toi avec `Lune.Verte`. Mets la fenêtre en grand.

1. **Accueil (30 secondes).** « Voici Hubuno : le hub de jeux de la classe. Ici, on voit tout de suite qui est en ligne, ce qu'on n'a pas lu, et si c'est à nous de jouer. » Montre la case « À toi de jouer » et la liste « Non lus ».
2. **Jouer (1 minute).** Clique sur Jouer. « Ici, il y a trente jeux. Les parties en attente à gauche, les parties en cours à droite. » Montre la carte d'Escales en haut : « Escales, c'est notre grand jeu de plateau en 3D. » Montre la ligne verte « Reprendre » : « Là, c'est à moi de jouer. »
3. **La fiche d'un jeu (30 secondes).** Descends jusqu'à la grille « Les jeux », en bas de page, et clique sur la carte « Quatre à la suite » (pas sur une ligne de « Parties en attente », qui te ferait rejoindre la partie). « Chaque jeu a sa fiche : les règles en quelques phrases, le nombre de joueurs, la durée. »
4. **Créer une partie (45 secondes).** Dans la fiche, clique sur « Créer une partie ». « Un clic, et la table est ouverte pour toute la classe. » Les règles se règlent ici si le jeu en propose.
5. **Inviter (30 secondes).** Dans la table, clique sur « Inviter », coche deux ou trois élèves en ligne (Pixel42, Pomelo), valide. « Ils reçoivent une notification avec un bouton Rejoindre. » Pas besoin d'attendre qu'ils viennent : ce sont des figurants.
6. **Escales (1 minute).** Retourne dans Jouer, clique sur « Rejoindre » sur la partie d'Escales de Noisette (3 joueurs sur 10). « Escales a son propre style, plus sombre, avec le globe. On choisit son pays dans le salon, l'hôte lance quand tout le monde est prêt. » Ne lance pas la partie : il faut des vrais joueurs pour en profiter (voir le parcours B).
7. **Messages (45 secondes).** Clique sur Messages. « Une messagerie comme Discord : un salon général, des canaux par sujet, des messages privés. » Ouvre #général, montre les réactions et le lien. Écris un message devant tout le monde, ajoute une réaction.
8. **Admin (30 secondes).** Déconnecte-toi (Profil, puis Se déconnecter) et reconnecte-toi avec `Admin-Demo`. Clique sur Admin : « L'admin donne le code de classe, crée les canaux et les rôles colorés, bloque ou met en sourdine, et réinitialise un mot de passe oublié. Pas d'adresse e-mail dans Hubuno : tout passe par l'admin. » Montre la section Rôles, puis Membres, rangé par rôle ; `Mistral` est modérateur : il peut mettre en sourdine et effacer un message, mais n'a pas l'écran Admin.

Si tu es en retard sur l'horaire, saute les étapes 3 et 5.

## B. Essayer sur de vrais téléphones en Wi-Fi local

**Ce qu'il faut :**

1. Le Mac et les téléphones sont sur **le même réseau Wi-Fi** (le même nom de réseau).
2. La démo tourne sur le Mac (`npm run demo`) et le Terminal reste ouvert.
3. Sur chaque téléphone, tape dans Safari ou Chrome l'adresse affichée dans le Terminal sous « Sur un téléphone connecté au MEME Wi-Fi ». Elle commence par `http://` (pas `https://`) et contient le numéro de port (par exemple `:3000`).
4. Chaque personne se connecte avec un compte de démo, ou crée le sien : onglet « Créer un compte », code de classe `classe-demo-2026`.

**Idée de test à plusieurs :** une personne ouvre la partie d'Escales ou de Quatre à la suite, les autres la rejoignent, puis on joue vraiment. C'est la partie qu'on n'a jamais essayée : de vrais téléphones, de vrais joueurs, les sons.

**Le pare-feu du Mac.** Sur ce Mac, il est désactivé : rien à faire. S'il est activé sur un autre Mac, macOS demande une fois : « Voulez-vous autoriser node à accepter les connexions entrantes ? » Réponds **Autoriser**. Pour vérifier : Réglages Système, Réseau, Pare-feu.

**Si le téléphone n'arrive pas à ouvrir la page :**

- Vérifie que le téléphone est sur le même Wi-Fi que le Mac (pas en 4G ou 5G : coupe les données mobiles).
- Recopie l'adresse exactement, avec `http://` et le port.
- Empêche le Mac de se mettre en veille : une veille coupe la démo. Au besoin, lance `caffeinate -d npm run demo` à la place de `npm run demo` (le Mac reste éveillé tant que la démo tourne).
- Coupe le VPN sur le Mac s'il y en a un, puis relance la démo.
- Wi-Fi d'école, d'hôtel ou « invités » : beaucoup de ces réseaux interdisent aux appareils de se voir entre eux. Dans ce cas, fais un **partage de connexion** depuis un téléphone, puis connecte le Mac et les autres téléphones à ce réseau, et relance la démo pour récupérer la nouvelle adresse.
- Le Terminal n'affiche aucune adresse Wi-Fi : le Mac n'est connecté à aucun réseau. Connecte-le, puis relance.
- Le pare-feu est activé et a refusé : Réglages Système, Réseau, Pare-feu, Options, ajoute `node` en « Autoriser les connexions entrantes ».
- Le port est occupé : la démo en choisit un autre et l'affiche. Utilise l'adresse du dernier cadre, pas celle d'hier.
- Dernier test : sur le Mac, ouvre l'adresse Wi-Fi (pas `localhost`). Si ça marche sur le Mac mais pas sur le téléphone, le problème vient du réseau ou du pare-feu, pas de Hubuno.

## Check-list avant de présenter

1. Le Mac est branché et la veille est désactivée (ou `caffeinate -d npm run demo`).
2. Le Mac est connecté au Wi-Fi de la soirée ; les téléphones aussi.
3. Au Terminal, dans le dossier du projet : `npm run demo`, et le cadre « MODE DEMO » s'affiche.
4. Si la démo a plus de trois jours : `npm run demo -- --neuf` (réponds « oui »).
5. Ouvre l'adresse `localhost` du cadre dans le navigateur, onglet « Se connecter », compte `Lune.Verte`.
6. Accueil : « 9 personnes sont en ligne » et des messages non lus s'affichent.
7. Jouer : des parties en attente et en cours, une ligne verte « Reprendre ».
8. Sur un téléphone : l'adresse Wi-Fi s'ouvre et la connexion marche.
9. Le son du Mac est réglé (les jeux ont des sons que personne n'a encore écoutés en vrai).
10. L'onglet de Hubuno est le seul ouvert sur l'écran partagé ; les notifications du Mac sont coupées.
