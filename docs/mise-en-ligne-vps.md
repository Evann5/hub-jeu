# Mettre Hubuno en ligne sur un VPS

Pour l'ami de Minh qui gère le VPS. Compter 30 minutes. Écrit pour Debian ou Ubuntu avec nginx. **Pas encore essayé sur un vrai VPS.** Ce qui a été essayé en local le 05/11/2026 : l'installation à partir des seuls fichiers listés ici, le passage par un proxy (HTTPS, cookie, limites par adresse, simulés par en-têtes, sans vrai nginx), un arrêt brutal en pleine partie, la sauvegarde, et 40 clients sur 10 tables (2 ms par coup en médiane, 24 ms au pire, 100 Mo de mémoire).

## Ce qu'il faut

- Node.js 22.13 ou plus, à cause de la base SQLite intégrée à Node. Aucun module natif à compiler.
- Un sous-domaine qui pointe vers le VPS, par exemple `jeux.exemple.fr`, de préférence à un sous-dossier.
- 200 Mo de mémoire libre et 100 Mo de disque suffisent pour une classe.
- De Minh : le code de classe (10 caractères au moins, c'est la seule barrière à l'inscription), son pseudo d'admin et un code admin, différent du code de classe.

## 1. Les fichiers

Dans `/opt/hubuno`, avec un utilisateur dédié qui n'a pas de droits d'administrateur :

```sh
sudo adduser --system --group --home /opt/hubuno hubuno
sudo -u hubuno git clone <adresse du dépôt> /opt/hubuno/app   # ou envoyer server.js, package.json, package-lock.json, src, public et games
cd /opt/hubuno/app && sudo -u hubuno npm install --omit=dev
sudo -u hubuno mkdir -p /opt/hubuno/data /opt/hubuno/sauvegardes
```

Les données restent hors du dossier de l'appli : une mise à jour ne peut pas les toucher.

## 2. Le service

`/etc/hubuno.env`, lisible seulement par root (`chmod 600`) :

```
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DATA_DIR=/opt/hubuno/data
CLASS_CODE=le-code-de-la-classe
ADMINS=pseudo-de-minh
ADMIN_CODE=un-code-connu-de-minh-seul
```

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
journalctl -u hubuno -n 20   # doit dire « Hubuno écoute sur le port 3000 »
```

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
        proxy_set_header Host $host;
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

**À ne pas oublier :**

- Hubuno fait confiance à un seul proxy devant lui. `X-Forwarded-For` doit donc être remplacé par nginx, comme ci-dessus, et `HOST=127.0.0.1` empêche d'atteindre l'appli sans lui. Sinon, les limites d'essais de mot de passe se contournent.
- Hubuno compresse déjà ses fichiers et pose ses en-têtes de sécurité. Rien à régler dans nginx, et pas de `add_header` qui les écraserait.
- Sur un port non standard, remplacer `$host` par `$http_host` : le contrôle d'origine du temps réel compare l'hôte avec son port.
- Avec un autre proxy devant nginx (Cloudflare…), toute la classe aurait la même adresse : le dire à Minh avant, il y a un réglage à changer (`trust proxy` dans `server.js`).
- Dans un sous-dossier, ajouter `BASE_PATH=/hubuno` dans `/etc/hubuno.env` et `location /hubuno/` dans nginx, avec `proxy_pass http://127.0.0.1:3000;` sans barre finale.

## 4. Les premiers comptes

Minh crée son compte avec son pseudo et le **code admin** à la place du code de classe. Grâce à ce code, aucun élève ne peut prendre un pseudo de `ADMINS`, même avant lui. Le dernier admin ne peut pas supprimer son compte.

## 5. L'essai avant d'inviter la classe

1. Une partie à plusieurs depuis des connexions différentes (Wi-Fi et 4G). Dans **Admin**, le temps réel doit passer en WebSocket.
2. `sudo systemctl restart hubuno` en pleine partie : les comptes et la partie doivent revenir.
3. Partie à 10 joueurs sur de vrais téléphones, dont un iPhone.
4. Test de sécurité (agent `securite`) sur la vraie adresse : ce sera la première fois que Hubuno est public.

Une classe entière partage souvent la même adresse sur le Wi-Fi de l'école. Limites par adresse : 60 inscriptions par heure, 200 échecs de connexion et 40 mauvais codes de classe (15 minutes). Redémarrer le service les remet à zéro.

## 6. Sauvegarder

`/etc/cron.d/hubuno` : une copie propre chaque nuit, gardée 14 jours.

```
15 4 * * * hubuno /usr/bin/node --no-warnings --input-type=module -e "import { DatabaseSync } from 'node:sqlite'; new DatabaseSync('/opt/hubuno/data/hubuno.sqlite').exec(\"VACUUM INTO '/opt/hubuno/sauvegardes/hubuno-\" + new Date().toISOString().slice(0, 10) + \".sqlite'\")" && find /opt/hubuno/sauvegardes -name '*.sqlite' -mtime +14 -delete
```

Pour restaurer : arrêter le service, remplacer `data/hubuno.sqlite` par la copie, supprimer `hubuno.sqlite-wal` et `hubuno.sqlite-shm`, relancer.

## 7. Mettre à jour

```sh
cd /opt/hubuno/app && sudo -u hubuno git pull && sudo -u hubuno npm install --omit=dev
sudo systemctl restart hubuno
```

Le serveur lit `rules.js` et `game.json` au démarrage : il faut toujours le redémarrer. Les parties en cours reprennent, et les joueurs se reconnectent seuls.
