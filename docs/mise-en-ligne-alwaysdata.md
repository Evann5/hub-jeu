# Mettre Hubuno en ligne gratuitement sur alwaysdata

Pour Minh, avec l'aide de Claude. C'est une première version : personne n'a encore fait ces étapes sur un vrai compte, les libellés de l'interface sont à confirmer à l'écran.

## Pourquoi cette solution

Hubuno a besoin d'un serveur Node.js allumé en permanence, du temps réel et d'un disque qui garde le fichier des comptes. L'offre gratuite d'alwaysdata annonce 1 Go de disque, 256 Mo de mémoire et ¼ de processeur, pour un usage personnel.

## À vérifier à l'inscription

- La mention « 30 days free » de la page des tarifs : l'offre reste-t-elle gratuite après 30 jours ?
- Une carte bancaire est-elle demandée ?

## Les étapes

1. Créer le compte et choisir l'offre gratuite. Le nom du compte donne l'adresse : `nom.alwaysdata.net`.
2. Dans **Environment > Node.js**, choisir une version de Node 22.13 ou plus.
3. Envoyer dans `/home/nom/hubuno/` : `server.js`, `package.json`, `package-lock.json` et les dossiers `src`, `public` et `games`.
4. Dans ce dossier, lancer `npm install --omit=dev`.
5. Dans **Web > Sites**, créer un site de type **Node.js** :
   - **Commande** : `node /home/nom/hubuno/server.js`
   - **Idle time** : `0`, pour que l'appli ne s'arrête pas et que les connexions restent ouvertes.
   - **Variables d'environnement** : `CLASS_CODE` (le code de la classe ; long, 10 caractères au moins, car c'est la seule barrière à l'inscription) et `ADMINS` (par exemple `minh,pseudo-eleve-jeux`).
   - **Règle à respecter** : Minh et l'élève des jeux créent leur compte **avant** que le code de la classe soit donné à qui que ce soit. Sinon un autre élève pourrait prendre leur pseudo et devenir admin à leur place. Minh s'inscrit en premier : le premier admin créé est le propriétaire du hub, et aucun autre admin ne peut lui changer son mot de passe, son rôle ni le bloquer.

Rien à régler pour l'adresse d'écoute : Hubuno écoute déjà sur `::` et le port donné par `PORT`, comme le demande alwaysdata. `BASE_PATH` reste vide, l'appli est à la racine.

## L'essai avant d'inviter la classe

1. Une partie à plusieurs, depuis des connexions différentes (Wi-Fi et 4G). Dans **Administration > Connexion en direct**, on doit lire « WebSocket ».
2. Redémarrer le site : les comptes doivent toujours être là.
3. Laisser tourner une nuit : le matin, la page doit répondre tout de suite.
4. Partie à 10 joueurs : surveiller la mémoire dans l'administration d'alwaysdata.
5. Test de sécurité (agent `securite`) : ce sera la première fois que Hubuno est public.

Si un de ces points échoue, le plan B est O2Switch (`docs/mise-en-ligne.md`).

## Mettre à jour et sauvegarder

- Remplacer `src`, `public`, `games`, `server.js`, `package.json` et `package-lock.json`, puis redémarrer le site. **Ne jamais toucher au dossier `data`** : il contient les comptes et les messages.
- Les données tiennent dans `hubuno/data/`. alwaysdata annonce 3 jours de sauvegardes sur cette offre : garder aussi une copie de ce dossier une fois par mois.
