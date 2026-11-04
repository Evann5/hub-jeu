# Mettre Hubuno en ligne sur O2Switch

Pour la personne qui gère le compte O2Switch. Compter environ 20 minutes la première fois.

## Ce qu'il faut avant de commencer

- Un accès au cPanel O2Switch.
- L'adresse choisie pour Hubuno : un sous-domaine (`jeux.votre-domaine.fr`) ou un sous-dossier (`votre-domaine.fr/hubuno`).
- Le code de la classe (choisi par Minh) et les pseudos des admins de départ (Minh et l'élève des jeux).

## 1. Envoyer les fichiers

1. Dans cPanel, ouvrir **Gestionnaire de fichiers**.
2. Créer un dossier `hubuno` **à côté** de `public_html`, pas dedans (les données ne doivent pas être visibles sur le web).
3. Entrer dans `hubuno`, cliquer sur **Charger** et envoyer `hubuno-a-mettre-en-ligne.zip`.
4. Revenir dans `hubuno`, clic droit sur le zip > **Extraire**. On doit voir `server.js`, `package.json` et les dossiers `src`, `public` et `games` directement dans `hubuno`. Supprimer ensuite le zip.

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
| `CLASS_CODE` | le code de la classe | Sans lui, personne ne peut s'inscrire. Les admins peuvent le changer ensuite dans Hubuno (10 caractères au moins pour un code choisi dans Hubuno ; choisis-en un long, car le code est la seule barrière à l'inscription). |
| `ADMINS` | `minh,pseudo-eleve-jeux` | Ces pseudos deviennent admins en créant leur compte. **Règle : Minh et l'élève des jeux créent leur compte avant que le code de la classe soit donné à qui que ce soit** (sinon un autre élève pourrait prendre leur pseudo et devenir admin à leur place). Minh s'inscrit en premier : le premier admin créé est le propriétaire du hub, et aucun autre admin ne peut lui changer son mot de passe, son rôle ni le bloquer. |
| `BASE_PATH` | `/hubuno` | **Seulement** si Hubuno est dans un sous-dossier. Pour un sous-domaine, ne pas l'ajouter. |

4. **Create**, puis **Run NPM Install**, puis **Restart**.

## 3. Vérifier

1. Ouvrir l'adresse de Hubuno : l'écran avec les piles de jetons doit s'afficher.
2. Minh crée son compte avec le code de la classe. Il doit voir l'icône de bouclier (administration) en haut à gauche.
3. Dans **Administration**, en bas, la rubrique **Connexion en direct** indique :
   - « WebSocket » : parfait.
   - « Long-polling » : Hubuno marche quand même, avec un peu plus de délai. Prévenir Minh : c'est la question encore ouverte sur O2Switch.
4. Test à deux : deux téléphones connectés à deux comptes. Un message envoyé par l'un doit apparaître chez l'autre en une seconde environ.

## Si ça ne marche pas

- **Page d'erreur Passenger** : dans Setup Node.js App, vérifier la version de Node (22.13 ou plus) et relancer **Run NPM Install**, puis **Restart**. Les erreurs sont écrites dans le fichier `stderr.log` du dossier `hubuno`.
- **« Les inscriptions ne sont pas encore ouvertes »** : la variable `CLASS_CODE` manque. L'ajouter, puis faire **Restart**.
- **Des gens apparaissent hors ligne alors qu'ils sont connectés, ou des messages arrivent en double** : O2Switch fait sans doute tourner plusieurs copies de l'appli en même temps. Hubuno doit tourner en **une seule instance** : demander au support O2Switch de limiter l'application à une instance.

## Mettre à jour

1. Remplacer les fichiers `src`, `public`, `games`, `server.js`, `package.json` et `package-lock.json`. **Ne jamais toucher au dossier `data`** : il contient les comptes et les messages.
2. **Run NPM Install** si `package.json` a changé, puis **Restart**.

## Sauvegarder

Toutes les données tiennent dans `hubuno/data/` (fichiers `hubuno.sqlite*`). Une copie de ce dossier une fois par mois suffit. Les sauvegardes automatiques d'O2Switch (JetBackup) le couvrent aussi.
