# Hubuno

Hub privé de jeux de société en ligne pour la classe, avec une messagerie façon Discord : canaux, messages privés, réactions, présence en ligne et outils de modération.

## Lancer sur son ordinateur

```sh
npm install
CLASS_CODE=test1234 ADMINS=minh npm run dev
```

Puis ouvrir http://localhost:3000. Il faut Node 22.13 ou plus récent.

## Organisation

- `server.js` : point d'entrée (serveur web + temps réel).
- `src/` : comptes (`auth.js`), routes HTTP (`api.js`), messagerie (`chat.js`), temps réel Socket.IO (`realtime.js`), base SQLite (`db.js`), réglages (`config.js`).
- `public/` : l'interface, en JavaScript sans étape de build.
- `data/` : la base de données (créée au premier lancement, jamais versionnée).
- `docs/` : brief, décisions, questions ouvertes, guide de mise en ligne.

## Variables d'environnement

| Nom | Rôle |
|---|---|
| `CLASS_CODE` | Code de classe de départ, à saisir pour s'inscrire. |
| `ADMINS` | Pseudos qui deviennent admins à l'inscription, séparés par des virgules. |
| `BASE_PATH` | Sous-dossier où vit l'appli (`/hubuno`), vide pour un sous-domaine. |
| `DATA_DIR` | Dossier de la base (par défaut `data/`). |
| `PORT` | Port d'écoute (fourni par O2Switch). |

Mise en ligne : [docs/mise-en-ligne.md](docs/mise-en-ligne.md).
