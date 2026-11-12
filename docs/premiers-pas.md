# Premiers pas après la mise en ligne

Pour Minh, le jour où Hubuno est en ligne. Dix minutes, avant de donner l'adresse à la classe.

## 1. Ton compte

1. Ouvre l'adresse de Hubuno sur ton ordinateur.
2. **Créer un compte** : ton pseudo (celui que ton ami a mis dans `ADMINS`), un mot de passe d'au moins 10 caractères, et le **code admin** à la place du code de classe.
3. Tu dois voir **Admin** dans le menu. Tu es le propriétaire du hub : aucun autre admin ne peut te bloquer, te rétrograder ni changer ton mot de passe.

Si Hubuno répond « Ce pseudo est déjà pris » : quelqu'un s'est inscrit avant toi avec ton pseudo sans le code admin, ce qui n'est pas possible si `ADMIN_CODE` est bien réglé. Demande à ton ami de vérifier ses réglages.

## 2. Préparer le hub (Admin)

- **Code de la classe** : vérifie-le ; choisis-en un long, c'est la seule barrière à l'inscription.
- **Canaux** : « général » et « on-joue-quand » existent déjà. Crée un canal « equipe » en cochant **Réservé à l'équipe** pour parler avec tes modérateurs.
- **Rôles** (facultatif) : par exemple « Délégués » en vert. Le premier rôle d'un membre colore son pseudo et le range dans Membres.
- **État du serveur** : « Connexion directe », c'est parfait ; « Connexion de secours », ça marche quand même, avec un peu de retard. **Copies de l'appli** doit valoir 1 : si c'est plus (en dehors de la minute qui suit un redémarrage), préviens ton ami, il faut demander à O2Switch de limiter l'appli à une seule instance. **Sauvegardes** : une par jour, faite toute seule.

## 3. Ouvrir à la classe

1. Admin, **Copier le message pour la classe**, puis colle-le dans le groupe de la classe.
2. Quand des élèves sont inscrits : Membres, la carte d'un élève, puis
   - **Niveau** : Modérateur (sourdine, effacer un message, fermer une partie, sur les membres seulement) ou Admin (tout) ;
   - **Rôles** : cocher, c'est enregistré tout de suite.
3. Quand toute la classe a son compte : Admin, coupe **Inscriptions ouvertes**. Plus personne ne peut créer de compte ; tu rouvres le temps qu'un nouvel élève s'inscrive.

## Au quotidien

- **Mot de passe oublié** : Membres, la carte de l'élève, **Réinitialiser le mot de passe**. Donne-lui le mot de passe provisoire (il sert 24 heures) : il en choisira un nouveau en se connectant.
- **Qui a fait quoi** : Admin, **Journal de modération** (gardé un an).
- **Quelque chose a planté** : Admin, **Journal des erreurs**. Une ligne dit ce qui a planté, chez qui et dans quel jeu : copie-la à la personne qui s'occupe du code.
- **Un joueur est parti en pleine partie** : à côté de son nom, dans la colonne des joueurs, **Continuer sans** (après 2 minutes hors ligne).
- **En classe, sur ordinateur** : le rôle, le mot ou les cartes secrètes restent cachés ; on maintient le clic pour les voir. Chacun peut couper ce cache dans Profil, section « En classe ».
- **Une mise à jour** : tu demandes le changement, il est poussé sur GitHub, ton ami fait `git pull` puis **Restart** (de préférence hors cours). Les élèves connectés voient « Hubuno a été mis à jour » avec un bouton pour recharger.
