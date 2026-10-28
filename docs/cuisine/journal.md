# Journal de l'interrogatoire — Hub jeu

## 23/10/2026 — Ancrage
- Dossier vide, rien dans le cerveau. Seule source : le premier message de Minh (hub de jeux de société en ligne pour sa classe, sur O2Switch, avec messagerie).
- Carte créée : presque tout est inconnu.

## 23/10/2026 — Manche 1
Questions : la classe, l'état des jeux, le rythme de jeu, le compte O2Switch.
Réponses :
- Classe d'études supérieures, environ 20 à 40 personnes (majeurs en majorité).
- Les jeux sont en train d'être créés par un autre élève.
- On joue ensemble, en même temps (temps réel).
- Compte O2Switch existant, « pas besoin de domaine ».
- Message ajouté par Minh : connexion par code de classe + compte ; messagerie avec salon général, messages privés, canaux « et tout » (façon Discord).
Ce qui change : le hub doit accueillir des jeux faits par quelqu'un d'autre → il faut un contrat d'intégration clair avec cet élève. Le temps réel sur mutualisé devient le risque technique n° 1.

## 23/10/2026 — Manche 2
Questions : technologie des jeux, qui gère le multijoueur, adresse du hub, cadre et échéance.
Réponses :
- Les jeux de l'autre élève sont faits en Node.
- Le hub fournit le multijoueur (tables de jeu, envoi des coups) ; les jeux s'y branchent.
- Adresse : « on va faire de notre côté » → Minh et sa classe s'en chargent.
- Projet perso, sans date.
- Message ajouté par Minh : pas d'agents pour le hub, l'assistant principal le code lui-même.
Ce qui change : la stack penche vers Node.js (une seule appli Node sur O2Switch : hub + messagerie + tables de jeu). Pas d'échéance → on peut faire propre. Plus de missions d'agents prévues pour le hub.

## 23/10/2026 — Manche 3
Questions : forme des jeux en Node, règle de branchement, appareils, création des canaux.
Réponses :
- « C'est le même serveur Node pour chacun des jeux ; moi je m'occupe seulement de faire le hub. »
- Oui, l'assistant écrit la règle de branchement (guide + jeu d'exemple).
- Ordinateur et téléphone.
- Canaux créés par les admins seulement.
Ce qui change : un seul serveur Node pour tous les jeux. Point à confirmer : le hub vit-il dans ce même serveur (les jeux = modules du hub), ou à côté du serveur de l'autre élève ? (manche 4)

## 23/10/2026 — Manche 4
Questions : hub et jeux sur le même serveur, chat de partie, contenu des messages, modération.
Réponses :
- Oui, un seul serveur : le hub est le serveur, chaque jeu est un dossier branché dedans.
- Chat de la table pendant une partie : oui.
- Messages : texte + emojis, réactions. Pas d'images, pas de modification ni de suppression par l'auteur.
- Modération : les admins suppriment les messages, rendent muet, bannissent et changent le code de classe.
Ce qui change : architecture fixée (une appli Node). Pas d'envoi de fichiers → pas de stockage d'images.

## 23/10/2026 — Manche 5
Questions : fonctions du hub, spectateurs, durée de conservation des messages, admins de départ.
Réponses :
- Fonctions : qui est en ligne, inviter à une partie, profil + avatar (emoji ou couleur, courte bio). Pas de scores ni de classement.
- Spectateurs : oui.
- Messages effacés automatiquement après 1 an.
- Admins de départ : Minh + l'élève des jeux ; ils peuvent en nommer d'autres.
Ce qui change : pas de table de scores à prévoir.

## 23/10/2026 — Manche 6
Recherche avant la manche : O2Switch propose Node.js dans le cPanel (Passenger). Rien ne confirme que les WebSockets passent ; Passenger sur Apache ne les gérait pas dans sa vieille doc, et le repli de Socket.IO en long-polling demande une seule instance ou des sessions collantes. → Risque n° 1, à tester en ligne dès le début.
Questions : nom, look, mot de passe oublié, déploiement.
Réponses :
- Le hub a déjà un nom (pas encore donné → question ouverte suivante).
- Look sombre façon Discord.
- Mot de passe oublié : un admin le réinitialise ; aucun e-mail demandé.
- Minh n'a jamais déployé d'appli Node sur O2Switch, et ce n'est pas lui qui gère le serveur.
Ce qui change : pas d'e-mail du tout → données minimales (pseudo, mot de passe haché). Il faut savoir qui gère le serveur pour lui adresser le guide de mise en ligne et le test des WebSockets.

## 23/10/2026 — Manche 7 (réponses écrites)
- Nom du hub : « Hubuno ».
- Le serveur O2Switch est géré par un autre élève (un troisième, différent de celui des jeux).
Ce qui change : trois personnes → Minh (hub, avec l'assistant), l'élève des jeux, l'élève qui gère O2Switch. Le guide de mise en ligne et le test WebSockets s'adressent à ce dernier.

## 23/10/2026 — Manche 8
Questions : premiers jeux, priorité, mesure de réussite, ce que Minh veut en retirer.
Réponses :
- Premier jeu : « une sorte de Monopoly, comme Rich Up » (plateau, dés, tour par tour, 2 à 6 joueurs environ).
- Priorité : le chat d'abord (comptes + chat + en ligne, mis en ligne vite pour tester O2Switch), puis les tables de jeu avec un morpion d'exemple, puis les jeux de l'élève.
- Réussite : la classe l'utilise (chiffre proposé : 15 inscrits et des parties chaque semaine, un mois après la mise en ligne ; à confirmer).
- Pour Minh : que ça marche, et le mettre dans son portfolio.
Ce qui change : le hub doit gérer les tours de jeu et les états longs (une partie de Monopoly dure longtemps : il faut pouvoir se reconnecter). Le portfolio ajoute deux règles : ne pas reprendre le nom ni les visuels de Monopoly, et montrer des captures avec des pseudos inventés.

## 23/10/2026 — Manche 9
Questions : qui paie O2Switch, durée de vie, mineurs, page « Règles et données ».
Réponses :
- L'élève qui gère O2Switch le paie déjà ; Hubuno n'ajoute aucun coût.
- Durée de vie : au moins 2 ans.
- Tous majeurs.
- Oui à une page courte « Règles et données », acceptée à l'inscription, avec la suppression de son compte possible.
Ce qui change : 2 ans → code propre et maintenable (une personne doit pouvoir le reprendre), sauvegarde de la base à prévoir.

## 23/10/2026 — Contre-interrogatoire
- Un seul serveur : d'abord « il met les jeux sur O2 », puis, après précision, confirmé : il dépose chaque jeu dans le dossier « jeux » de Hubuno, qui le détecte.
- Comptes (code de classe, pseudo + mot de passe, pas d'e-mail, réinitialisation par un admin) : confirmé.
- Ordre (chat → tables + morpion → ses jeux) : confirmé.
- Réussite : 15 inscrits et des parties chaque semaine, un mois après la mise en ligne : confirmé.

## 23/10/2026 — Dernière question et lancement
- « Qu'est-ce que je ne t'ai pas demandé ? » → « rien, commence : le design, puis le chat ».
- Minh précise : utiliser les skills et fiches des agents, mais aucun agent.
- Interrogatoire clos. Brief, décisions, questions ouvertes et CLAUDE.md écrits.
- Étape 1 construite le même jour : design, comptes, chat, présence, administration. Testée dans Chrome (3 comptes, ordinateur et téléphone), dans Safari (accueil) et dans un sous-dossier.

## 23/10/2026 — Style
- Minh demande d'autres propositions : quatre styles montrés (Tapis, Bois, Cartes pop, Arcade).
- Minh envoie trois images de référence (tableaux de bord sombres aux grandes cartes colorées) : « ce côté néon et jeune ». Cinquième proposition « Néon ».
- Minh valide le Néon. Il devient le style unique ; les autres styles et leurs polices sont retirés.

## 23/10/2026 — Navigation et ergonomie
- Minh valide le design mais trouve l'ergonomie « pas folle » : il veut une barre de navigation, avec les skills ui-ux-pro-max, ui-styling, ui-demo, web-design-guidelines et frontend-design.
- Refonte : barre de navigation (rail / barre du bas), Accueil en tableau de bord, pages Membres, Profil et Admin, Messages en liste puis conversation sur téléphone, confirmations maison. Démo vidéo enregistrée.
