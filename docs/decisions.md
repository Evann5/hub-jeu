# Décisions — Hubuno

| Date | Décision | Pourquoi | Écarté |
|---|---|---|---|
| 23/10/2026 | Nom : Hubuno | Choix de Minh | — |
| 23/10/2026 | Code de classe + compte pseudo / mot de passe | Les inconnus n'entrent pas | Pseudo seul |
| 23/10/2026 | Pas d'e-mail ; un admin réinitialise le mot de passe | Moins de données, pas d'envoi d'e-mails à configurer | Lien par e-mail |
| 23/10/2026 | Messagerie façon Discord : salon général, canaux, messages privés, chat de table | Demande de Minh | — |
| 23/10/2026 | Canaux créés par les admins seulement | Éviter des dizaines de canaux vides | Tout le monde crée |
| 23/10/2026 | Texte, emojis et réactions ; pas d'images ni de modification | Choix de Minh | Images, modifier/supprimer |
| 23/10/2026 | Admins : suppression, muet, bannissement, code de classe | Pouvoir agir si quelqu'un dérape | Aucune modération |
| 23/10/2026 | Messages effacés après 1 an | Moins de données personnelles qui traînent | Garder tout, 30 jours |
| 23/10/2026 | Admins de départ : Minh et l'élève des jeux | Choix de Minh | Minh seul |
| 23/10/2026 | En ligne, invitations, profil avatar + bio ; pas de scores | Choix de Minh | Classement |
| 23/10/2026 | Spectateurs autorisés | Choix de Minh | — |
| 23/10/2026 | Une seule appli Node : hub + chat + tables ; les jeux sont des dossiers déposés dans Hubuno | Les jeux sont en Node ; un seul compte et un seul chat | Deux serveurs séparés |
| 23/10/2026 | Le hub fournit le multijoueur ; guide de branchement + morpion d'exemple | Une seule façon de faire pour tous les jeux | S'adapter à chaque jeu |
| 23/10/2026 | Look sombre façon Discord, téléphone et ordinateur | Tout le monde connaît déjà | Ludique, clair |
| 23/10/2026 | Ordre : design + chat, puis tables, puis jeux | Tester le direct sur O2Switch au plus tôt | Tout d'un coup |
| 23/10/2026 | Réussite : 15 inscrits et des parties chaque semaine, un mois après la mise en ligne | Chiffre proposé et confirmé | — |
| 23/10/2026 | Page courte « Règles et données » à l'inscription | Minimum quand on stocke des messages | Pas de page |
| 23/10/2026 | Le code est fait par l'assistant principal, sans agents | Demande de Minh | Agents |
| 23/10/2026 | Express + Socket.IO, JS sans build, SQLite intégré à Node (`node:sqlite`) | Rien à compiler sur O2Switch, une seule appli, facile à reprendre pendant 2 ans | MySQL, React |
| 23/10/2026 | Design : tapis de jeu vert sombre, avatars en jetons colorés avec emoji, actions couleur laiton, police Bricolage Grotesque hébergée sur le serveur | Disposition Discord demandée, avec une identité de table de jeu | Gris Discord |
| 23/10/2026 | Skills et fiches des agents utilisés, mais aucun agent lancé | Demande de Minh | — |
| 23/10/2026 | Style définitif « Néon » : presque noir, grandes cartes arrondies violet, jaune, citron vert et orange, texte noir sur couleur, titres en Unbounded, texte en Figtree, boutons pilule citron vert avec lueur, accueil en mosaïque de cartes | Choisi par Minh d'après ses images de référence (« néon et jeune ») | Tapis de jeu, Bois, Cartes pop, Arcade |
| 23/10/2026 | Navigation : rail à gauche sur ordinateur, barre en bas sur téléphone (Accueil, Jouer, Messages, Membres, Profil ; Admin en plus sur ordinateur) ; Accueil en tableau de bord ; Membres, Profil et Admin en pages ; sur téléphone, liste des conversations puis conversation plein écran ; confirmations au style de Hubuno | Minh trouvait l'ergonomie « pas folle » et voulait une barre de navigation ; audit ui-ux-pro-max et Web Interface Guidelines | Volets cachés ☰ / 👥, réglages en fenêtre |
| 23/10/2026 | Premier jeu : Undercover, de 3 à 12 joueurs, civils + Undercover + Mr. White, indices écrits dans le jeu, débat dans le chat de la table puis vote, minuteurs | Choix de Minh, en attendant les jeux de l'autre élève ; sert à construire les tables de jeu (étape 2) | Indices à l'oral, sans Mr. White, 20 joueurs |
| 23/10/2026 | DA d'Undercover « Dossier secret » dans l'univers Néon : carte-dossier à onglet qu'on maintient pour lire son mot, tampons pour révéler les rôles, rôles en couleur (civil citron vert, Undercover orange, Mr. White blanc, dossier jaune), maquettes dans `docs/da/undercover.html` | Choisie par Minh ; colle au nom du jeu | Bal masqué, plateau télé |
| 23/10/2026 | Undercover a sa propre DA, distincte du hub : « Dossier papier » (chemise kraft, feuilles, machine à écrire Courier Prime, titres au pochoir Big Shoulders Stencil, notes manuscrites Caveat, polaroïds au trombone, mot caché sous un trait de feutre noir, suspect entouré au feutre rouge, tampons rouge / vert / stylo bleu), maquettes dans `docs/da/undercover.html` | Minh veut que le jeu ne ressemble pas au hub | DA Néon du hub (`docs/da/undercover-neon-ecartee.html`), film noir, terminal |
| 23/10/2026 | DA d'Undercover retravaillée « fait main » : titres au gros feutre (Permanent Marker), texte manuscrit lisible (Kalam), pseudos au stylo (Caveat), contours au crayon tremblés avec ombre dure, scotch déchiré, punaises, mot caché sous des coups de feutre noir opaques, cercle rouge du vote, coches, croix, bâtons de comptage, surligneur, papier d'écolier ; tous les dessins en SVG dans le code. En jeu, le mot ne sera envoyé à l'écran que pendant l'appui | Minh veut un vrai côté fait main | Version papier « propre » (machine à écrire dominante) |
| 23/10/2026 | DA d'Undercover : piste « Code », jeu de cartes moderne. Une couleur plein écran par phase (salon blanc cassé, mot cobalt #2E4BFF, indices sarcelle #007A66, débat ambre #F5A000 avec texte noir, vote rouge #D62D1F, verdict noir), une couleur par rôle (civil cobalt, Undercover rouge, Mr. White carte blanche « ? »), carte à jouer signature (dos bleu à motif d'yeux, retournée en maintenant), titres Syne, texte Inter Tight ; maquettes dans `docs/da/undercover.html` | Minh a trouvé la version fait main « moche » et a choisi la piste C parmi trois | Fait main, Classified (thriller), Mission Pop (`docs/da/undercover-pistes-abc.html`) |
