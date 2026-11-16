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
| `ADMIN_CODE` | Code à saisir à la place du code de classe pour créer un compte de `ADMINS` (indispensable en ligne, sinon le premier élève qui prend ce pseudo devient admin). |
| `BASE_PATH` | Sous-dossier où vit l'appli (`/hubuno`), vide pour un sous-domaine. |
| `DATA_DIR` | Dossier de la base (par défaut `data/`). |
| `PORT` | Port d'écoute (fourni par O2Switch). |

## Tests

```sh
npm test                    # règles des 30 jeux et hub sans navigateur (environ 15 s)
npm run test:parcours       # parcours dans un navigateur (Playwright requis, voir tests/parcours/README.md)
npm run test:parcours:tous  # les 29 jeux autres qu'Escales, ouverts et lancés dans un navigateur
```

## Mise en ligne

O2Switch : [docs/mise-en-ligne.md](docs/mise-en-ligne.md), ou guidé pas à pas avec Claude : [docs/installation-avec-claude.md](docs/installation-avec-claude.md).
