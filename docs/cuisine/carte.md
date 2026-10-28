# Carte de l'interrogatoire — Hub jeu

Mise à jour : 23/10/2026, après la manche 9. « M1 » = premier message, « R1 » à « R9 » = réponses des manches.
Sources lues : dossier vide (aucun `CLAUDE.md`, aucun `docs/`), cerveau (aucun projet ni décision lié). Seule source : le premier message de Minh du 23/10/2026 (« M1 »).

Légende : **réglé** (réponse, pourquoi, source) · **flou** (réponse vague ou non prouvée) · **inconnu** · **parqué** (qui répond, quand).

## Pourquoi
- Problème / objectif : **réglé** — un hub pour jouer en ligne entre camarades de classe et discuter (M1) ; projet perso, pas noté (R2).
- Mesure de réussite : **réglé** — au moins 15 inscrits et des parties chaque semaine, un mois après la mise en ligne (R8, confirmé au contre-interrogatoire).
- Si rien n'est fait : **réglé** — ne s'applique pas : projet de loisir, sans enjeu (R2).

## Pour qui
- Utilisateurs : **réglé** — une classe d'études supérieures, environ 20 à 40 personnes, tous majeurs (R1, R9).
- Appareils : **réglé** — ordinateur et téléphone (R3).
- Qui décide, qui paie : **réglé** — Minh décide pour le hub ; l'élève qui gère O2Switch paie déjà l'hébergement (R9).

## Quoi
- Les jeux : **réglé** (pour ce qui touche au hub) — en cours de création par un autre élève (R1) ; on joue en direct, tous en même temps (R1). Faits en Node (R2) ; le multijoueur est fourni par le hub, les jeux s'y branchent (R2). Un seul serveur Node pour tous les jeux (R3) ; règle de branchement écrite par l'assistant, avec guide et jeu d'exemple (R3). Le hub est le serveur, chaque jeu est un dossier déposé dans le dossier « jeux » de Hubuno par l'élève lui-même (R4, confirmé au contre-interrogatoire). Premier jeu : une sorte de Monopoly façon Rich Up (R8), donc tour par tour, environ 2 à 6 joueurs, des parties longues et la reconnexion à gérer. Les jeux suivants : **parqué** — l'élève des jeux les annonce au fil de l'eau ; pas de date.
- Messagerie : **réglé** — salon général, messages privés, canaux « et tout », façon Discord (R1). Canaux créés par les admins (R3) ; chat de la table pendant une partie (R4) ; texte, emojis et réactions, sans images ni modification (R4). Messages effacés après 1 an (R5).
- Comptes / connexion : **réglé** — code de classe pour s'inscrire, puis compte pseudo + mot de passe (R1). Mot de passe oublié : un admin le réinitialise, aucun e-mail demandé (R6).
- Fonctions du hub : **réglé** — liste des jeux, tables de jeu avec spectateurs, qui est en ligne, invitations à une partie, profil avec avatar emoji ou couleur et courte bio, messagerie, administration (R5). Pas de scores ni de classement (R5).
- Ordre et définition de « fini » : **réglé** — étape 1 : comptes, chat et présence en ligne, publiés sur O2Switch ; étape 2 : tables de jeu, avec un morpion d'exemple et le guide de branchement ; étape 3 : les jeux de l'élève (R8).

## Comment
- Hébergement : **réglé** — compte O2Switch existant (R1). À vérifier : si Node.js est activé dans le cPanel, et l'espace disponible.
- Stack : **réglé** — une seule appli Node.js : hub + messagerie + tables de jeu (R2, R4). À confirmer : Node activé dans le cPanel, et WebSockets possibles (sinon Socket.IO repasse en polling).
- Domaine / adresse : **réglé** — Minh et sa classe s'en occupent (R2) ; l'appli doit marcher à n'importe quelle adresse.
- Données stockées : **réglé** — pseudo, mot de passe haché, profil (avatar, bio), messages effacés après 1 an, aucun e-mail (R5, R6).
- Qui ajoute les jeux ensuite : **réglé** — l'autre élève, en suivant la règle de branchement (R3) ; Minh ne fait que le hub.
- Identité visuelle : **réglé** — sombre façon Discord : canaux à gauche, chat au centre, en ligne à droite (R6). Nom : **réglé** — « Hubuno » (R7).

## Règles
- Données personnelles : **réglé** — tous majeurs ; une page courte « Règles et données » acceptée à l'inscription, avec la suppression de son compte possible (R9).
- Modération : **réglé** — les admins suppriment les messages, rendent muet, bannissent et changent le code de classe (R4).
- Droits sur les jeux : **flou** — le premier jeu ressemble à Monopoly (R8). Les règles se reprennent librement, mais pas le nom ni les visuels : point important pour le portfolio.
- Accessibilité : **réglé** — pas d'obligation (projet privé entre étudiants) ; bonnes pratiques de base quand même (clavier, contrastes).

## Argent et temps
- Budget : **réglé** — 0 € : aucun service payant, O2Switch déjà payé par l'élève qui le gère (R9).
- Échéance : **réglé** — aucune, projet perso (R2).
- Disponibilité de Minh : **réglé** — l'assistant code ; Minh valide et teste (R2).
- Hors périmètre : **réglé** — les jeux eux-mêmes (sauf le morpion d'exemple), les scores et classements, les images dans le chat, les e-mails, le nom de domaine, l'administration d'O2Switch (R3 à R8).

## Après
- Qui gère les comptes et la modération : **réglé** — admins de départ : Minh et l'élève des jeux, qui peuvent en nommer d'autres (R5).
- Ajout de jeux futurs : **réglé** — l'élève des jeux, en suivant le guide de branchement (R3).
- Durée de vie : **réglé** — au moins 2 ans (R9) : code maintenable, sauvegarde de la base.

## Risques
- Messagerie entre élèves : **réglé** — modération par les admins et page de règles (R4, R9).
- Temps réel sur hébergement mutualisé : **flou** — jeux en direct demandés (R1) ; rien ne confirme que les WebSockets passent sur O2Switch (recherche du 23/10). Le plus risqué techniquement : **parqué** — l'élève qui gère O2Switch le teste lors de la mise en ligne de l'étape 1.
- Mise en ligne : **flou** — ce n'est pas Minh qui gère le serveur O2Switch, et il n'a jamais déployé d'appli Node (R6). Un autre élève gère O2Switch (R7) : c'est lui qui reçoit le guide de mise en ligne et le test des WebSockets.
- Hypothèse la plus dangereuse : **flou** — que le temps réel marche sur O2Switch. Autres dépendances : l'élève des jeux doit suivre le guide, et l'élève d'O2Switch doit mettre en ligne.

## Minh
- Contexte personnel : **réglé** — Minh est dans une classe d'études supérieures ; projet perso (R1, R2).
- Ce qu'il veut en retirer : **réglé** — que ça marche, sans cours de code, et le mettre dans son portfolio (R8).
- Préférences, refus : **réglé** — pas d'agents pour le hub, l'assistant principal le code lui-même (R2).
