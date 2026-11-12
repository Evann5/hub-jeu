# Mettre Hubuno en ligne sur O2Switch

Pour la personne qui gère le compte O2Switch. Compter environ 30 minutes la première fois, puis une minute par mise à jour.

Avec Claude pour se faire guider pas à pas : copier le texte de `docs/installation-avec-claude.md` dans une conversation avec Claude.

## Ce qu'il faut avant de commencer

- Un accès au cPanel O2Switch, avec le **Terminal** (cPanel > Avancé > Terminal, ou une connexion SSH).
- L'adresse choisie pour Hubuno : un sous-domaine (`jeux.votre-domaine.fr`, le plus simple) ou un sous-dossier (`votre-domaine.fr/hubuno`).
- De Minh, par message privé (jamais sur GitHub) :
  - le **code de la classe** : au moins 10 caractères, c'est la seule barrière à l'inscription ;
  - son **pseudo** d'admin ;
  - un **code admin**, différent du code de classe, connu de lui seul.
- L'accès au dépôt GitHub de Minh (`minh54500/hub-jeu`, privé) : l'étape 1 explique comment, avec une clé en lecture seule.

## 1. Récupérer le code depuis GitHub

Dans le Terminal du cPanel :

```sh
ssh-keygen -t ed25519 -f ~/.ssh/hubuno_github -N "" -C "o2switch-hubuno"
cat ~/.ssh/hubuno_github.pub
```

Envoyer à Minh la ligne affichée (elle commence par `ssh-ed25519`). Ce n'est pas un secret : c'est la partie publique de la clé.
**Minh** l'ajoute dans GitHub : son dépôt > *Settings* > *Deploy keys* > *Add deploy key*, un titre (« O2Switch »), la ligne collée, **sans** cocher *Allow write access*. Le serveur pourra lire le code, jamais le modifier.

Une fois la clé ajoutée par Minh :

```sh
printf 'Host github.com\n  HostName ssh.github.com\n  Port 443\n  User git\n  IdentityFile ~/.ssh/hubuno_github\n  IdentitiesOnly yes\n' >> ~/.ssh/config
chmod 600 ~/.ssh/config
git clone git@github.com:minh54500/hub-jeu.git ~/hubuno
ls ~/hubuno   # on doit voir server.js, package.json, src, public, games
```

La connexion passe par le port 443 de GitHub, ouvert partout. À la première connexion, `git` demande s'il faut faire confiance à `github.com` : répondre `yes`.
Le dossier `hubuno` est **à côté** de `public_html`, pas dedans : les données ne sont pas visibles sur le web.

*Sans Terminal* : sur GitHub, *Code* > *Download ZIP*, puis cPanel > Gestionnaire de fichiers, créer `hubuno` à côté de `public_html`, y charger le zip et l'extraire (on doit voir `server.js` directement dans `hubuno`). Ça marche, mais chaque mise à jour se fera aussi à la main.

## 2. Créer l'application Node.js

1. cPanel > **Setup Node.js App** > **Create Application**.
2. Remplir :
   - **Node.js version** : la plus récente proposée, **22.13 au minimum** (Hubuno utilise la base SQLite intégrée à Node). Si elle n'est pas proposée, prévenir Minh avant d'aller plus loin.
   - **Application mode** : Production.
   - **Application root** : `hubuno`.
   - **Application URL** : le sous-domaine ou le sous-dossier choisi.
   - **Application startup file** : `server.js`.
3. Dans **Environment variables**, ajouter :

| Nom | Valeur | À quoi ça sert |
|---|---|---|
| `CLASS_CODE` | le code de la classe | Sans lui, personne ne peut s'inscrire. Les admins peuvent le changer ensuite dans Hubuno. |
| `ADMINS` | le pseudo de Minh | Ce pseudo devient admin en créant son compte. |
| `ADMIN_CODE` | le code admin de Minh | Minh s'inscrit avec ce code à la place du code de classe. Grâce à lui, aucun élève ne peut prendre le pseudo de Minh, même s'il s'inscrit avant lui. |
| `BASE_PATH` | `/hubuno` | **Seulement** si Hubuno est dans un sous-dossier. Pour un sous-domaine, ne pas l'ajouter. |

4. **Create**, puis **Run NPM Install**, puis **Restart**.

## 3. Vérifier

1. Ouvrir l'adresse de Hubuno : l'écran de connexion doit s'afficher, avec le cadenas HTTPS. S'il n'y a pas de cadenas : cPanel > **SSL/TLS Status** > lancer AutoSSL pour ce domaine.
2. Minh crée son compte avec son pseudo et le **code admin**. Il doit voir l'écran **Admin** dans le menu. Le premier admin est le propriétaire du hub : aucun autre admin ne peut lui changer son mot de passe, son niveau ni le bloquer.
3. Dans **Admin**, la rubrique **Connexion en direct** indique :
   - « Connexion directe » : parfait.
   - « Connexion de secours » : Hubuno marche quand même, avec un peu plus de délai. Le dire à Minh.
4. Test à deux : deux téléphones connectés à deux comptes. Un message envoyé par l'un doit apparaître chez l'autre en une seconde environ.
5. Ensuite, tout se fait dans Hubuno : Minh nomme les modérateurs et les admins depuis la fiche d'un membre (écran Membres), crée les rôles colorés dans Admin, et donne l'adresse et le code à la classe avec « Copier le message pour la classe ». Le détail pour Minh : `docs/premiers-pas.md`.

## Si ça ne marche pas

- **Page d'erreur Passenger** : dans Setup Node.js App, vérifier la version de Node (22.13 ou plus), relancer **Run NPM Install**, puis **Restart**. Les erreurs sont écrites dans le fichier `stderr.log` du dossier `hubuno`.
- **`stderr.log` contient `ERR_REQUIRE_ASYNC_MODULE`** : le code sur le serveur date d'avant le 12/11/2026 (O2Switch charge `server.js` d'une façon que l'ancienne version refusait). Faire `cd ~/hubuno && git pull`, puis **Restart**.
- **`stderr.log` contient « Hubuno n'a pas pu démarrer »** : la raison est écrite juste après. Envoyer ces lignes à Minh.
- **« Les inscriptions ne sont pas encore ouvertes »** : la variable `CLASS_CODE` manque. L'ajouter, puis **Restart**.
- **`git clone` répond « Permission denied (publickey) »** : la clé n'est pas encore dans les *Deploy keys* du dépôt, ou `~/.ssh/config` n'a pas été écrit.
- **Des gens apparaissent hors ligne alors qu'ils sont connectés, ou des messages arrivent en double** : O2Switch fait sans doute tourner plusieurs copies de l'appli en même temps. Hubuno doit tourner en **une seule instance** : demander au support O2Switch de limiter l'application à une instance.

## Mettre à jour

Quand Minh a poussé une nouvelle version sur GitHub, dans le Terminal :

```sh
cd ~/hubuno && git pull
```

Puis cPanel > Setup Node.js App > Hubuno > **Run NPM Install** (seulement si `package.json` a changé) et **Restart**. Le serveur lit les règles des jeux au démarrage : le **Restart** est toujours nécessaire.

Les comptes et les messages ne bougent pas : ils sont dans `hubuno/data/`, que `git pull` ne touche jamais. Les élèves connectés voient « Hubuno a été mis à jour » avec un bouton pour recharger. De préférence hors des heures de cours.

Ce que voient les élèves pendant un **Restart** :
- le bandeau « Connexion perdue. Reconnexion en cours… » pendant quelques secondes, puis tout revient sans recharger la page ;
- les parties en cours ne sont pas perdues : chaque coup est enregistré, la partie reprend là où elle en était (un minuteur échu pendant l'arrêt se déclenche au redémarrage) ;
- un message envoyé pendant l'arrêt part tout seul à la reprise ; si l'arrêt dure plus de 10 secondes, il reste affiché « Pas envoyé », avec « Réessayer ».

Sur un hébergement mutualisé, l'appli peut être mise en veille quand personne ne s'en sert : si la première visite après une pause prend quelques secondes, c'est normal.

## Sauvegarder

Toutes les données tiennent dans `hubuno/data/` (fichiers `hubuno.sqlite*`, toujours les trois ensemble).

- **Hubuno se sauvegarde tout seul, une fois par jour** : `hubuno/data/sauvegardes/hubuno-AAAA-MM-JJ.sqlite`, les 7 derniers jours. Rien à faire.
- Les sauvegardes automatiques d'O2Switch (JetBackup) couvrent aussi tout le dossier.
- Avant une grosse mise à jour, une copie de plus ne coûte rien : `cp -r ~/hubuno/data ~/hubuno-data-$(date +%F)`.

La base grossit lentement : environ 50 Mo pour 400 000 messages, et les messages de plus d'un an s'effacent tout seuls. Avec les 7 sauvegardes, compter huit fois cette place.

## Restaurer une sauvegarde

À faire seulement si la base est perdue ou abîmée : tout ce qui a été écrit depuis la sauvegarde disparaît.

1. cPanel > Setup Node.js App > Hubuno > **Stop App** (l'appli ne doit pas tourner pendant la copie).
2. Dans le Terminal, regarder les sauvegardes disponibles, mettre la base actuelle de côté, puis remettre celle du jour voulu (ici le 12/11/2026) :

```sh
ls ~/hubuno/data/sauvegardes
mkdir ~/hubuno-base-abimee-$(date +%F)
mv ~/hubuno/data/hubuno.sqlite* ~/hubuno-base-abimee-$(date +%F)/
cp ~/hubuno/data/sauvegardes/hubuno-2026-11-12.sqlite ~/hubuno/data/hubuno.sqlite
```

La deuxième et la troisième ligne emportent les trois fichiers `hubuno.sqlite`, `hubuno.sqlite-wal` et `hubuno.sqlite-shm` : il ne faut laisser aucun des deux derniers à côté de la base restaurée.

3. **Start App**, puis ouvrir Hubuno et vérifier que les comptes et les messages sont là.

Depuis une copie du dossier entier (`~/hubuno-data-AAAA-MM-JJ`) ou depuis JetBackup (cPanel > JetBackup > File Backups) : même méthode, appli arrêtée, en remplaçant tout le dossier `hubuno/data`.

## Si le disque est plein

Hubuno continue de tourner et rien de ce qui était écrit n'est perdu, mais plus rien ne s'enregistre : les élèves lisent « Le serveur n'a plus de place pour enregistrer ». Faire de la place sur le compte O2Switch (cPanel > Utilisation du disque) ; Hubuno repart tout seul, sans Restart.
