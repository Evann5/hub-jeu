# Installer Hubuno avec l'aide de Claude

Pour la personne qui gère O2Switch. Copie **tout le texte sous la ligne** dans une nouvelle conversation avec Claude (claude.ai ou l'appli). Claude te guide ensuite étape par étape : tu fais ce qu'il dit, tu lui colles ce que l'écran affiche, ou tu lui envoies une capture.

---

Tu vas m'aider à installer une application web sur mon hébergement O2Switch (cPanel mutualisé, pas un VPS). Guide-moi **une seule étape à la fois** : donne-moi l'action ou la commande, attends que je te colle le résultat ou que je t'envoie une capture, vérifie-le, puis passe à l'étape suivante. Je ne suis pas développeur : dis-moi précisément où cliquer et quoi copier. Si un résultat ne correspond pas à ce qui est attendu, on règle le problème avant d'aller plus loin.

## L'application

- **Hubuno** : un hub privé de jeux et de messagerie pour la classe de mon ami Minh (20 à 40 étudiants).
- **Technique** : une appli Node.js. Le serveur Express et Socket.IO tourne en temps réel, avec le fichier de démarrage `server.js` à la racine. La base est SQLite, intégrée à Node (`node:sqlite`). Il n'y a aucune étape de build et aucune dépendance native à compiler.
- **Version de Node** : il faut **la 22.13 ou plus** (le `package.json` déclare `"engines": {"node": ">=22.13"}`). En dessous, l'appli ne démarre pas, parce que `node:sqlite` n'y existe pas sans option.
- **Code** : sur GitHub, dépôt **privé** `minh54500/hub-jeu`, branche `main`, adresse `git@github.com:minh54500/hub-jeu.git`. J'y accède avec une **clé de déploiement en lecture seule** que Minh ajoute de son côté.
- **Données** : comptes et messages dans `hubuno/data/` (fichiers `hubuno.sqlite*`), créé au premier démarrage. Ce dossier n'est pas dans Git, et `git pull` n'y touche jamais.
- **Une seule instance** : l'appli garde en mémoire qui est connecté et les parties en cours. Elle ne doit jamais tourner en plusieurs copies en parallèle.

## Règles à respecter

1. Le dossier de l'appli est `~/hubuno`, **à côté** de `public_html`, jamais dedans.
2. Les trois valeurs secrètes (code de classe, pseudo admin, code admin) viennent de Minh par message privé. Je les tape **directement dans cPanel**. Ne me demande jamais de les écrire dans cette conversation ni dans un fichier, et si je t'envoie une capture des variables d'environnement, rappelle-moi de masquer les valeurs.
3. On ne modifie aucun fichier du code. Si quelque chose ne marche pas à cause du code, on s'arrête, et je préviens Minh avec le message d'erreur exact.
4. On ne supprime jamais `~/hubuno/data/`.
5. Toujours en mode **Production**.

## Les étapes

### Étape 0 : vérifier la version de Node

cPanel > **Setup Node.js App** > **Create Application** : regarder la liste **Node.js version** sans rien créer. Je te dis les versions proposées.
- S'il y a une version **22.13 ou plus** (22.x récente, 24.x…), c'est bon : on note la plus récente et on continue.
- Sinon, on **s'arrête** : je préviens Minh, et on demande au support O2Switch s'ils proposent Node 22.13 ou plus.

### Étape 1 : la clé de déploiement

Ouvrir le **Terminal** du cPanel (cPanel > Avancé > Terminal ; pas besoin de configurer SSH pour ça). Puis :

```sh
ssh-keygen -t ed25519 -f ~/.ssh/hubuno_github -N "" -C "o2switch-hubuno"
cat ~/.ssh/hubuno_github.pub
```

J'envoie à Minh la ligne qui commence par `ssh-ed25519`. Ce n'est pas un secret : c'est la partie publique de la clé.
Minh l'ajoute dans GitHub (dépôt > Settings > Deploy keys > Add deploy key, **sans** cocher « Allow write access »). J'attends qu'il me dise que c'est fait.

### Étape 2 : relier la clé à GitHub et tester

```sh
printf 'Host github.com\n  HostName ssh.github.com\n  Port 443\n  User git\n  IdentityFile ~/.ssh/hubuno_github\n  IdentitiesOnly yes\n' >> ~/.ssh/config
chmod 600 ~/.ssh/config
ssh -T git@github.com
```

Ce réglage passe par le port 443, qui n'est jamais bloqué, au lieu du port 22. À la question « Are you sure you want to continue connecting », répondre `yes`.
- **Attendu** : `Hi minh54500/hub-jeu! You've successfully authenticated, but GitHub does not provide shell access.`
- **`Permission denied (publickey)`** : la clé n'est pas encore dans les Deploy keys, ou `~/.ssh/config` contient un ancien bloc `Host github.com` qui passe avant le nôtre (`cat ~/.ssh/config` pour vérifier).

### Étape 3 : récupérer le code

```sh
git clone git@github.com:minh54500/hub-jeu.git ~/hubuno
ls ~/hubuno
```

**Attendu** : on voit entre autres `server.js`, `package.json`, `src`, `public`, `games`. Il ne doit **pas** y avoir de dossier `node_modules`, car l'outil Node d'O2Switch le crée lui-même à l'étape 4.

### Étape 4 : créer l'application dans cPanel

cPanel > **Setup Node.js App** > **Create Application** :
- **Node.js version** : la plus récente notée à l'étape 0 (22.13 au minimum).
- **Application mode** : Production.
- **Application root** : `hubuno`.
- **Application URL** : l'adresse choisie, un sous-domaine de préférence (`jeux.mon-domaine.fr`). Le sous-domaine doit déjà exister dans cPanel > Domaines.
- **Application startup file** : `server.js`.

Dans **Environment variables** (bouton « Add variable »), ajouter :

| Nom | Valeur |
|---|---|
| `CLASS_CODE` | le code de la classe donné par Minh (10 caractères ou plus) |
| `ADMINS` | le pseudo de Minh |
| `ADMIN_CODE` | le code admin de Minh, différent du code de classe |
| `BASE_PATH` | **seulement** si l'appli est dans un sous-dossier (`/hubuno`) ; ne pas l'ajouter pour un sous-domaine |

Ne pas ajouter `PORT` : O2Switch le fournit lui-même.

Puis **Create**, ensuite **Run NPM Install** (attendre la fin), puis **Restart**.

### Étape 5 : vérifier

1. J'ouvre l'adresse dans un navigateur : l'écran de connexion de Hubuno doit s'afficher, avec le cadenas HTTPS. S'il n'y a pas de cadenas : cPanel > **SSL/TLS Status** > « Run AutoSSL » pour ce domaine, puis attendre quelques minutes.
2. Je dis à Minh que c'est en ligne. Il crée son compte avec son pseudo et le **code admin** à la place du code de classe, puis il doit voir l'écran **Admin**.
3. Minh regarde dans **Admin** la carte **État du serveur** :
   - **Copies de l'appli** doit valoir 1 (juste après un Restart, 2 pendant une minute, c'est normal). Si ça reste à 2 ou plus, on demande au support O2Switch de limiter l'appli à une seule instance.
   - « Connexion directe », c'est parfait. « Connexion de secours » marche aussi, avec un peu de délai : on le note, sans rien changer.
4. Test à deux appareils : un message envoyé de l'un doit apparaître sur l'autre en une seconde environ.

C'est terminé. Dis-moi de garder cette conversation pour les mises à jour.

## Si ça ne marche pas

Commence toujours par lire les journaux :

```sh
tail -n 50 ~/hubuno/stderr.log
```

- **Page d'erreur Passenger, ou « Incomplete response received from application »** : lire `stderr.log`.
  - `Cannot find module 'express'` (ou un autre module) : relancer **Run NPM Install**, puis **Restart**.
  - `ERR_REQUIRE_ASYNC_MODULE` : le code récupéré date d'avant le 12/11/2026. `cd ~/hubuno && git pull`, puis Restart.
  - « Hubuno n'a pas pu démarrer » : la raison est écrite juste après ; on s'arrête et j'envoie ces lignes à Minh.
  - `No such built-in module: node:sqlite` : la version de Node choisie est trop ancienne. Choisir 22.13 ou plus dans l'appli, puis Run NPM Install et Restart.
- **« Run NPM Install » refuse parce qu'un dossier `node_modules` existe déjà dans `hubuno`** : le supprimer (`rm -rf ~/hubuno/node_modules`, jamais `data`), puis relancer Run NPM Install.
- **« Les inscriptions ne sont pas encore ouvertes »** : `CLASS_CODE` manque ou est vide. Le corriger, puis **Restart**.
- **Page blanche ou styles cassés dans un sous-dossier** : vérifier que `BASE_PATH` vaut exactement le sous-dossier de l'Application URL, avec la barre au début et sans barre à la fin (`/hubuno`), puis Restart.
- **Gens affichés hors ligne alors qu'ils sont connectés, ou messages en double** : l'appli tourne sans doute en plusieurs copies. Demander au support O2Switch de limiter cette application Node à **une seule instance**.
- **Pour lancer `node` ou `npm` à la main dans le Terminal** : copier d'abord la commande `source /home/…/nodevenv/hubuno/…/bin/activate && cd /home/…/hubuno`, affichée en haut de la page de l'appli dans Setup Node.js App. `node -v` doit alors afficher la bonne version.

Si rien de tout ça ne règle le problème : on s'arrête, et j'envoie à Minh les 50 dernières lignes de `stderr.log`, après les avoir relues pour qu'il n'y ait aucun mot de passe ni code dedans.

## Plus tard : mettre à jour

Quand Minh me dit qu'une nouvelle version est sur GitHub :

```sh
cd ~/hubuno && git pull
```

Puis cPanel > Setup Node.js App > l'appli > **Run NPM Install** (seulement si `package.json` a changé), et **Restart** (toujours : le serveur relit les jeux au démarrage). De préférence hors des heures de cours. Les élèves connectés voient « Hubuno a été mis à jour » avec un bouton pour recharger.

Pendant le Restart, les élèves connectés voient « Connexion perdue. Reconnexion en cours… » quelques secondes ; les parties en cours sont enregistrées à chaque coup et reprennent toutes seules.

Si `git pull` refuse à cause de « local changes » : ne rien forcer, me coller le message. Personne n'est censé modifier les fichiers sur le serveur.

## Sauvegarder et restaurer

Hubuno se sauvegarde tout seul une fois par jour dans `~/hubuno/data/sauvegardes/` (7 jours gardés), et les sauvegardes d'O2Switch (JetBackup) couvrent tout le dossier. Avant une grosse mise à jour, une copie de plus : `cp -r ~/hubuno/data ~/hubuno-data-$(date +%F)`.

Pour revenir à une sauvegarde (tout ce qui a été écrit depuis disparaît), suivre pas à pas « Restaurer une sauvegarde » dans `~/hubuno/docs/mise-en-ligne.md` : appli arrêtée (**Stop App**), les trois fichiers `hubuno.sqlite*` mis de côté, la sauvegarde copiée à la place de `hubuno.sqlite`, puis **Start App**. Ne jamais copier par-dessus une base pendant que l'appli tourne.
