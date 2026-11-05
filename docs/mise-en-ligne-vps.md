# Mettre Hubuno en ligne sur un VPS

Pour l'ami de Minh qui gère le VPS. Compter 45 minutes. Écrit pour Ubuntu 24.04 (ou Debian 12) avec nginx. **Pas encore essayé sur un vrai VPS.**

Ce qui a été répété le 05/11/2026, dans Docker sur un Mac, en suivant ce guide commande par commande : Ubuntu 24.04 neuf avec un vrai systemd, Node 22, nginx, HTTPS avec un certificat auto-signé, l'installation par `git clone` puis une mise à jour par `git pull`, le temps réel, deux comptes qui s'écrivent, une partie d'Escales, le sous-dossier, les limites par adresse, le redémarrage, un `kill -9`, la sauvegarde et la restauration.
**Pas essayé :** Let's Encrypt (`certbot`), un vrai nom de domaine, le pare-feu du VPS, Debian 12, de vrais téléphones.

## Ce qu'il faut

- Un VPS Ubuntu 24.04 ou Debian 12, avec un accès `sudo`. 200 Mo de mémoire libre et 100 Mo de disque suffisent pour une classe.
- Un sous-domaine qui pointe vers le VPS (enregistrement DNS de type A), par exemple `jeux.exemple.fr`, de préférence à un sous-dossier. Le DNS doit déjà répondre avant l'étape 3.
- Les ports 80 et 443 ouverts dans le pare-feu du VPS (80 sert à `certbot` et à la redirection vers HTTPS). Ne **pas** ouvrir le 3000.
- De Minh : le code de classe (10 caractères au moins, c'est la seule barrière à l'inscription), son pseudo d'admin et un code admin, différent du code de classe.

Les paquets, à installer d'abord. Le `nodejs` d'Ubuntu et de Debian est trop vieux (version 18 ou 20) : il faut Node.js **22.13 ou plus** (base SQLite intégrée à Node, aucun module natif à compiler), donc le dépôt NodeSource :

```sh
sudo apt update && sudo apt install -y curl ca-certificates git cron nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # doit afficher v22.13 ou plus ; npm est livré avec
```

## 1. Les fichiers

Dans `/opt/hubuno`, avec un utilisateur dédié qui n'a pas de droits d'administrateur :

```sh
sudo adduser --system --group --home /opt/hubuno hubuno
sudo -u hubuno git clone <adresse du dépôt> /opt/hubuno/app   # ou envoyer server.js, package.json, package-lock.json, src, public et games
cd /opt/hubuno/app && sudo -u hubuno npm install --omit=dev
sudo -u hubuno mkdir -p /opt/hubuno/data /opt/hubuno/sauvegardes
sudo chmod 700 /opt/hubuno/data /opt/hubuno/sauvegardes
```

Si le dépôt est privé, l'utilisateur `hubuno` n'a pas de clé : cloner avec son propre compte, puis `sudo chown -R hubuno:hubuno /opt/hubuno/app`.
Les données restent hors du dossier de l'appli : une mise à jour ne peut pas les toucher.

## 2. Le service

`/etc/hubuno.env`, lisible seulement par root (`sudo chmod 600 /etc/hubuno.env`) :

```
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DATA_DIR=/opt/hubuno/data
CLASS_CODE=le-code-de-la-classe
ADMINS=pseudo-de-minh
ADMIN_CODE=un-code-connu-de-minh-seul
```

(Les trois dernières valeurs sont des exemples : mettre celles de Minh.)

`/etc/systemd/system/hubuno.service` :

```ini
[Unit]
Description=Hubuno
After=network.target

[Service]
User=hubuno
WorkingDirectory=/opt/hubuno/app
EnvironmentFile=/etc/hubuno.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/hubuno/data /opt/hubuno/sauvegardes

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload && sudo systemctl enable --now hubuno
sleep 5; journalctl -u hubuno -n 20 --no-pager   # doit dire « Hubuno écoute sur le port 3000 »
```

Normal : l'avertissement « SQLite is an experimental feature » (sans gravité). Pas normal : un message « HOST est vide » ou « ADMIN_CODE est vide » (une ligne manque dans `/etc/hubuno.env`).

**Une seule instance** : les parties sont gardées en mémoire. Pas de `cluster`, pas de plusieurs processus. Si `node` n'est pas dans `/usr/bin`, adapter `ExecStart` (`which node`).

## 3. nginx et HTTPS

`/etc/nginx/sites-available/hubuno`, avec le vrai nom de domaine :

```nginx
server {
    listen 80;
    server_name jeux.exemple.fr;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Le temps réel : sans ces lignes, les parties se coupent.
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

```sh
sudo ln -s /etc/nginx/sites-available/hubuno /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d jeux.exemple.fr   # HTTPS obligatoire : le cookie de session n'est envoyé qu'en HTTPS
```

`certbot` ajoute lui-même le bloc `listen 443 ssl` et la redirection de 80 vers 443, et renouvelle le certificat tout seul (`systemctl list-timers | grep certbot`). Il ne faut rien y retoucher.

**À ne pas oublier :**

- Hubuno fait confiance à un seul proxy devant lui. `X-Forwarded-For` doit donc être remplacé par nginx (`$remote_addr`, comme ci-dessus, **pas** `$proxy_add_x_forwarded_for`), et `HOST=127.0.0.1` empêche d'atteindre l'appli sans lui. Sinon, les limites d'essais de mot de passe se contournent.
- Hubuno compresse déjà ses fichiers et pose ses en-têtes de sécurité. Rien à régler dans nginx, et pas de `add_header` qui les écraserait.
- Garder `$http_host` (et pas `$host`) : avec `$host`, un envoi de formulaire depuis une adresse avec un port (`:8443`) est refusé. Sans effet sur les ports 80 et 443.
- Avec un autre proxy devant nginx (Cloudflare…), toute la classe aurait la même adresse : le dire à Minh avant, il y a un réglage à changer (`trust proxy` dans `server.js`).
- Dans un sous-dossier, ajouter `BASE_PATH=/hubuno` dans `/etc/hubuno.env` et remplacer `location /` par `location /hubuno/` dans nginx, avec `proxy_pass http://127.0.0.1:3000;` sans barre finale. Puis `sudo systemctl restart hubuno`. Les cookies, le temps réel et les jeux marchent alors sous `/hubuno/`.
- Juste après un redémarrage de Hubuno, nginx répond « 502 » pendant quelques secondes : c'est le temps que le serveur charge les jeux.

## 4. Les premiers comptes

Minh crée son compte avec son pseudo et le **code admin** à la place du code de classe. Grâce à ce code, aucun élève ne peut prendre un pseudo de `ADMINS`, même avant lui. Le dernier admin ne peut pas supprimer son compte.

## 5. L'essai avant d'inviter la classe

1. Une partie à plusieurs depuis des connexions différentes (Wi-Fi et 4G). Dans **Admin**, la rubrique « Connexion en direct » doit afficher « Connexion directe » (elle démarre parfois en secours, puis change toute seule en une seconde ou deux).
2. `sudo systemctl restart hubuno` en pleine partie : les comptes et la partie doivent revenir, sans recharger la page.
3. Partie à 10 joueurs sur de vrais téléphones, dont un iPhone.
4. Test de sécurité (agent `securite`) sur la vraie adresse : ce sera la première fois que Hubuno est public.

Une classe entière partage souvent la même adresse sur le Wi-Fi de l'école. Limites par adresse : 60 inscriptions par heure, 200 échecs de connexion et 40 mauvais codes de classe (15 minutes). Redémarrer le service les remet à zéro.

## 6. Sauvegarder

`/etc/cron.d/hubuno` (lisible par tous mais modifiable par root seul : `sudo chmod 644`) : une copie propre chaque nuit, gardée 14 jours. Une seule ligne :

```
15 4 * * * hubuno /usr/bin/node --no-warnings --input-type=module -e "import { DatabaseSync } from 'node:sqlite'; new DatabaseSync('/opt/hubuno/data/hubuno.sqlite').exec(\"VACUUM INTO '/opt/hubuno/sauvegardes/hubuno-\" + new Date().toISOString().slice(0, 16).replace(':', '') + \".sqlite'\")" && find /opt/hubuno/sauvegardes -name '*.sqlite' -mtime +14 -delete
```

Les copies s'appellent `hubuno-2026-11-05T0415.sqlite` (heure UTC). Pour l'essayer tout de suite, remplacer provisoirement `15 4` par `* *`, attendre une minute, vérifier avec `sudo ls -la /opt/hubuno/sauvegardes`, puis remettre `15 4`. Si une copie n'apparaît pas, `sudo journalctl -t CRON -n 5` (il n'y a pas de courrier pour afficher l'erreur).

Pour restaurer (le serveur ne peut pas lire la copie en route : il faut l'arrêter) :

```sh
sudo systemctl stop hubuno
sudo cp /opt/hubuno/sauvegardes/hubuno-AAAA-MM-JJTHHMM.sqlite /opt/hubuno/data/hubuno.sqlite
sudo rm -f /opt/hubuno/data/hubuno.sqlite-wal /opt/hubuno/data/hubuno.sqlite-shm
sudo chown hubuno:hubuno /opt/hubuno/data/hubuno.sqlite
sudo systemctl start hubuno
```

Les comptes et les messages reviennent tels qu'ils étaient à la date de la copie ; ceux créés depuis sont perdus. Garder aussi une copie du dossier `sauvegardes` hors du VPS (le VPS qui tombe emporte les deux).

## 7. Mettre à jour

```sh
cd /opt/hubuno/app && sudo -u hubuno git pull && sudo -u hubuno npm install --omit=dev
sudo systemctl restart hubuno
```

Le serveur lit `rules.js` et `game.json` au démarrage : il faut toujours le redémarrer. Les parties en cours reprennent, et les joueurs se reconnectent seuls.

## Comment vérifier que ça marche

1. **HTTPS et en-têtes** : `curl -sI https://jeux.exemple.fr | head -20` doit donner `HTTP/1.1 200`, `Strict-Transport-Security` et `Content-Security-Policy`. `curl -sI http://jeux.exemple.fr | head -1` doit donner un `301`.
2. **Le port 3000 n'est pas ouvert** : `sudo ss -tlnp | grep 3000` ne montre que `127.0.0.1:3000` ; depuis un autre ordinateur, `curl -m 5 http://ADRESSE-DU-VPS:3000` doit échouer.
3. **Le site** : ouvrir `https://jeux.exemple.fr`, créer un compte avec le code de classe, écrire un message depuis deux navigateurs (deux comptes) et le voir arriver chez l'autre. Avec le compte admin, ouvrir une table d'**Escales** et la lancer : le plateau 3D doit s'afficher.
4. **Le service tient** : `sudo kill -9 $(systemctl show -p MainPID --value hubuno)` ; au bout de 3 secondes `systemctl is-active hubuno` doit redire `active`, et la page se reconnecte seule. Un `sudo systemctl restart hubuno` ne perd ni les comptes ni les messages.
5. **La sauvegarde** : voir l'essai de l'étape 6, un fichier `.sqlite` doit apparaître dans `/opt/hubuno/sauvegardes`. Et `sudo -u nobody cat /etc/hubuno.env` doit répondre « Permission denied ».

## Si ça ne marche pas

- **Page blanche ou « 502 Bad Gateway »** : `sudo systemctl status hubuno` et `journalctl -u hubuno -n 50 --no-pager`. Hubuno est arrêté, ou vient de démarrer (attendre 10 secondes), ou `PORT` dans `/etc/hubuno.env` n'est pas celui de `proxy_pass`.
- **Le service démarre puis s'arrête** : presque toujours un Node trop vieux (`node -v`, il faut 22.13 ou plus) ou un `ExecStart` qui ne trouve pas `node` (`which node`).
- **« Connexion de secours » reste affichée dans Admin, ou les parties se coupent** : les lignes `Upgrade` et `Connection` manquent dans nginx, ou un autre proxy (Cloudflare, pare-feu) coupe les WebSocket. Dans le navigateur : outils de développement, Réseau, filtre « WS », une ligne `socket.io` doit rester ouverte.
- **« Requête refusée » à l'inscription ou à la connexion** : `proxy_set_header Host $http_host;` manque ou a été remplacé par `$host`, ou l'adresse tapée n'est pas celle de `server_name`.
- **« Trop d'essais » ou « trop d'inscriptions » pour toute la classe** : nginx ne remplace pas `X-Forwarded-For` (ou un autre proxy se trouve devant). Vérifier la ligne `proxy_set_header X-Forwarded-For $remote_addr;`, puis `sudo systemctl restart hubuno` remet les compteurs à zéro.
- **Impossible de créer un compte** : le code de classe est faux, ou `CLASS_CODE` est vide (le journal dit « Aucun code de classe »).
- **`certbot` échoue** : le DNS ne pointe pas encore vers le VPS, ou le port 80 est fermé dans le pare-feu.
- **Après une restauration, une erreur de base « readonly » dans le journal** : `sudo chown hubuno:hubuno /opt/hubuno/data/hubuno.sqlite*`, puis redémarrer.
- **Besoin d'annuler** : `sudo systemctl disable --now hubuno` arrête Hubuno ; les données restent dans `/opt/hubuno/data`.
