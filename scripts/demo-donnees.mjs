// Données de la démo : une classe inventée (aucun pseudo ne désigne quelqu'un de réel), remplie avec les fonctions du projet
// (comptes, messages, réactions, tables de jeu) pour que les règles habituelles s'appliquent. Seules les dates sont ajustées
// à la main, pour étaler les messages sur plusieurs jours.
import { MDP_ADMIN, MDP_ELEVES } from './demo-garde.mjs';

// Chaque élève : pseudo, avatar, couleur (listes de src/options.js), bio. `bot` : connecté pendant la démo (voir demo.mjs).
export const ELEVES = [
  { pseudo: 'Lune.Verte', avatar: '🌙', color: 'vert', bio: 'Toujours partante pour un Quatre à la suite. Thé vert obligatoire.', jours: 20 },
  { pseudo: 'Pixel42', avatar: '🚀', color: 'bleu', bio: 'Je perds au Morpion mais je gagne au Yams. Ne me demandez pas comment.', bot: true, jours: 20 },
  { pseudo: 'Noisette', avatar: '🦊', color: 'orange', bio: 'Spécialiste d’Escales : je construis, vous échangez.', bot: true, jours: 19 },
  { pseudo: 'Mistral', avatar: '🦉', color: 'cyan', bio: 'Échecs le midi, révisions après (peut-être).', bot: true, jours: 19 },
  { pseudo: 'Kiwi.k', avatar: '🍀', color: 'jaune', bio: 'Je joue vite, je réfléchis après.', bot: true, jours: 18 },
  { pseudo: 'Cassiopée', avatar: '⭐', color: 'violet', bio: 'Quiz, blind test et culture inutile.', bot: true, jours: 18 },
  { pseudo: 'Barnabé', avatar: '🐢', color: 'vert', bio: 'Lent mais redoutable au Yams.', bot: true, jours: 17 },
  { pseudo: 'Pomelo', avatar: '🍩', color: 'rose', bio: 'Je ramène les gâteaux, vous ramenez les jeux.', bot: true, jours: 17 },
  { pseudo: 'Zozo', avatar: '🐸', color: 'cyan', bio: 'Loup-garou : oui, je mens très bien.', bot: true, jours: 16 },
  { pseudo: 'Tonton_Dés', avatar: '🎲', color: 'rouge', bio: 'Poker, belote et blagues de papa.', bot: true, jours: 16 },
  { pseudo: 'Capitaine_Biscotte', avatar: '🐙', color: 'orange', bio: 'Capitaine de la team Petits chevaux.', jours: 15 },
  { pseudo: 'Ludo-Lent', avatar: '🌵', color: 'jaune', bio: 'Je réfléchis. Encore. Un peu.', jours: 15 },
  { pseudo: 'Admin-Demo', avatar: '👑', color: 'violet', bio: 'Compte admin de la démo.', admin: true, jours: 21 },
];
export const PRINCIPAL = 'Lune.Verte';
export const MODO = 'Mistral';
// Rôles décoratifs : nom, couleur, membres (le premier rôle de la liste colore le pseudo).
export const ROLES = [
  ['Délégués', 'vert', ['Lune.Verte', 'Cassiopée']],
  ['Champions d’Escales', 'orange', ['Noisette']],
  ['Team Belote', 'bleu', ['Tonton_Dés', 'Pomelo', 'Cassiopée']],
];
export const ADMIN = 'Admin-Demo';

const jourA = (jours, hhmm) => {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};
const ilYa = (minutes) => Date.now() - minutes * 60_000;

// [pseudo, quand, texte, { emoji: [pseudos] }] ; dans l'ordre du temps pour chaque canal.
const CANAUX = {
  'général': [
    ['Pomelo', jourA(4, '08:52'), 'Bonjour la classe ! Quelqu’un a le planning de la semaine ? Je ne retrouve plus le mail.', { '👍': ['Mistral'] }],
    ['Mistral', jourA(4, '08:58'), 'Il est épinglé dans l’appli de l’école, onglet « Emploi du temps ». Jeudi on finit à 16 h.', { '🙏': [] }],
    ['Cassiopée', jourA(4, '09:03'), 'Merci Mistral. Et le DS de maths c’est bien jeudi matin ?', {}],
    ['Mistral', jourA(4, '09:05'), 'Oui, jeudi 8 h, salle 204.', { '😢': ['Pixel42', 'Ludo-Lent'] }],
    ['Pixel42', jourA(4, '12:41'), 'Si je rate le DS je me reconvertis en joueur pro de Yams.', { '😂': ['Zozo', 'Kiwi.k', 'Noisette'] }],
    ['Zozo', jourA(4, '12:44'), 'Carrière prometteuse. Je te prends comme sponsor.', {}],
    ['Barnabé', jourA(3, '18:20'), 'Ce site est super pratique pour jouer entre nous, merci à celui qui l’a monté 👏', { '👏': ['Pomelo', 'Lune.Verte', 'Cassiopée', 'Mistral'] }],
    ['Noisette', jourA(3, '18:27'), 'Mention spéciale à Escales : je n’ai jamais autant négocié pour une gare.', { '😂': ['Barnabé', 'Pixel42'] }],
    ['Kiwi.k', jourA(3, '20:10'), 'Quelqu’un a vu le message de l’école sur la sortie de février ? Il faut répondre avant vendredi.', {}],
    ['Pomelo', jourA(3, '20:15'), 'Oui, on s’inscrit via le formulaire du lien en bas du mail. Je le mets ici : https://fr.wikipedia.org/wiki/Les_Loups-garous_de_Thiercelieux (non, rien à voir, c’était pour la soirée jeux, mais regardez les règles 😄)', { '😂': ['Zozo', 'Lune.Verte'] }],
    ['Lune.Verte', jourA(3, '20:22'), 'Pomelo… 😂 Bref : pour la sortie, je confirme, j’y vais.', {}],
    ['Capitaine_Biscotte', jourA(2, '10:05'), 'Bonne nouvelle : le prof de physique est absent demain matin. On commence à 10 h.', { '🎲': ['Pixel42'], '🔥': ['Kiwi.k', 'Noisette', 'Zozo', 'Barnabé'] }],
    ['Ludo-Lent', jourA(2, '10:12'), 'Vraiment ? Je viens de vérifier, c’est confirmé sur l’appli. Je dors une heure de plus.', { '😂': ['Capitaine_Biscotte'] }],
    ['Tonton_Dés', jourA(2, '13:30'), 'Qui a oublié sa gourde dans l’amphi ? Il y en a une verte avec un autocollant de dé.', {}],
    ['Lune.Verte', jourA(2, '13:34'), 'C’est la mienne ! Merci Tonton, je passe la récupérer à 14 h.', { '👍': ['Tonton_Dés'] }],
    ['Cassiopée', jourA(1, '09:12'), 'Rappel : on apporte le compte rendu du TP de chimie demain. Une feuille par binôme.', { '👍': ['Mistral', 'Kiwi.k'] }],
    ['Zozo', jourA(1, '19:45'), 'Soirée Loup-garou samedi chez Pomelo ? Elle a promis des cookies.', { '🔥': ['Pomelo', 'Tonton_Dés', 'Barnabé'], '❤️': ['Pomelo'] }],
    ['Pomelo', jourA(1, '19:50'), 'Promesse tenue, j’en ai déjà fait trente. Il me faut juste des joueurs pour la partie.', { '👏': ['Zozo'] }],
    ['Noisette', ilYa(210), 'Qui est là ce soir ? Je lance une partie d’Escales vers 21 h, on peut être jusqu’à dix.', { '🎲': ['Mistral', 'Kiwi.k'] }],
    ['Barnabé', ilYa(150), 'Je suis partant ! Je finis mon exposé et je vous rejoins.', {}],
    ['Cassiopée', ilYa(95), 'Photo du tableau du cours de ce matin, si quelqu’un l’a ratée : je la pose dans #devoirs-et-revisions.', { '👍': ['Ludo-Lent', 'Capitaine_Biscotte'] }],
  ],
  'on-joue-quand': [
    ['Pixel42', jourA(4, '17:30'), 'Pause de 17 h à 18 h dans la salle commune : qui veut une partie rapide de Quatre à la suite ?', { '🎲': ['Lune.Verte', 'Kiwi.k'] }],
    ['Lune.Verte', jourA(4, '17:33'), 'Moi ! Je crée la table, rejoignez-moi.', {}],
    ['Kiwi.k', jourA(4, '18:05'), 'GG Lune, tu m’as eu en diagonale, je n’avais rien vu venir.', { '😂': ['Lune.Verte'] }],
    ['Tonton_Dés', jourA(3, '12:20'), 'Ce midi, belote à quatre dans le hall ? Il me manque un joueur.', {}],
    ['Capitaine_Biscotte', jourA(3, '12:25'), 'Je prends la quatrième place. Mais je ne coupe pas à pique, c’est ma règle.', { '😂': ['Tonton_Dés', 'Barnabé'] }],
    ['Mistral', jourA(2, '21:00'), 'Quelqu’un pour des échecs tard ce soir ? Parties de dix minutes, promis.', { '👍': ['Cassiopée'] }],
    ['Cassiopée', jourA(2, '21:04'), 'Je suis là dans cinq minutes, je finis mon thé.', {}],
    ['Noisette', jourA(1, '18:40'), 'Samedi après-midi, grosse partie d’Escales avec les nouveaux : qui veut apprendre ?', { '🔥': ['Pomelo', 'Lune.Verte', 'Zozo'] }],
    ['Lune.Verte', jourA(1, '18:44'), 'Moi je veux bien, mais j’ai besoin d’un tuto de deux minutes avant.', { '👍': ['Noisette'] }],
    ['Noisette', jourA(1, '18:46'), 'Tuto de deux minutes, c’est promis. Il y a même un petit écran d’aide dans le jeu.', { '❤️': ['Lune.Verte'] }],
    ['Zozo', ilYa(120), 'Pour le Loup-garou de samedi on est cinq, il en faut au moins six pour que ce soit drôle. Venez !', { '🎲': ['Pixel42', 'Tonton_Dés'] }],
    ['Pixel42', ilYa(70), 'Je me joins aux loups. Je joue le villageois innocent, évidemment.', { '😂': ['Zozo', 'Cassiopée'] }],
    ['Pomelo', ilYa(12), 'Je viens de créer une partie de Quatre à la suite. Qui me bat ? Le perdant ramène les cookies.', { '🔥': ['Kiwi.k'] }],
    ['Kiwi.k', ilYa(5), 'Challenge accepté, j’arrive dans une minute.', {}],
  ],
  'devoirs-et-revisions': [
    ['Mistral', jourA(4, '19:10'), 'Je partage mes fiches du chapitre 3 de maths, relues et corrigées : https://exemple.org/fiches-chapitre-3', { '🙏': [], '❤️': ['Cassiopée', 'Pixel42', 'Ludo-Lent'] }],
    ['Ludo-Lent', jourA(4, '19:32'), 'Tu me sauves la vie. Je ne comprenais rien à la question 4.', {}],
    ['Cassiopée', jourA(3, '16:40'), 'Question pour le DS : le théorème de la semaine dernière est au programme ou pas ?', {}],
    ['Mistral', jourA(3, '16:55'), 'Au programme, avec la démonstration. Le prof l’a répété trois fois.', { '👍': ['Cassiopée', 'Barnabé'] }],
    ['Kiwi.k', jourA(2, '20:20'), 'Quelqu’un veut qu’on révise ensemble en visio dimanche après-midi ?', { '👍': ['Lune.Verte', 'Ludo-Lent'] }],
    ['Cassiopée', ilYa(95), 'Photo du tableau de ce matin ajoutée dans le dossier partagé de la classe. Dites-moi si c’est lisible.', { '👏': ['Capitaine_Biscotte'] }],
  ],
  'bons-plans': [
    ['Barnabé', jourA(4, '12:15'), 'La boulangerie en face de l’école fait un menu étudiant à 5 €. Sandwich, boisson et dessert.', { '🔥': ['Pixel42', 'Pomelo'] }],
    ['Pomelo', jourA(3, '14:02'), 'Il y a une salle de travail calme et gratuite à la médiathèque, ouverte jusqu’à 20 h.', { '👍': ['Mistral', 'Cassiopée'] }],
    ['Tonton_Dés', jourA(2, '09:40'), 'Soldes sur les jeux de société à la boutique du centre-ville ce week-end. Vous êtes prévenus.', { '❤️': ['Zozo'], '😂': ['Pixel42'] }],
    ['Noisette', jourA(1, '11:00'), 'Le café de la rue piétonne laisse brancher les ordinateurs, et le wifi marche bien.', { '👍': ['Lune.Verte'] }],
  ],
  'off-topic': [
    ['Zozo', jourA(3, '22:10'), 'Question sérieuse : l’ananas sur la pizza, oui ou non ?', { '😮': ['Pomelo'], '😂': ['Pixel42', 'Kiwi.k'] }],
    ['Pomelo', jourA(3, '22:12'), 'Oui. Et je n’ai pas peur de le dire.', { '🔥': ['Zozo'] }],
    ['Mistral', jourA(3, '22:15'), 'Je démissionne de cette classe.', { '😂': ['Zozo', 'Pomelo', 'Lune.Verte'] }],
    ['Lune.Verte', jourA(1, '22:30'), 'Un chat gris est entré dans l’amphi cet après-midi et s’est assis au premier rang. Il avait l’air attentif.', { '😂': ['Kiwi.k', 'Barnabé', 'Noisette'], '❤️': ['Cassiopée'] }],
  ],
};
const SUJETS = {
  'devoirs-et-revisions': 'Fiches, questions de cours et entraide avant les DS',
  'bons-plans': 'Où manger, travailler et dépenser peu',
  'off-topic': 'Tout ce qui n’a rien à voir avec les cours',
};

// Messages privés : [expéditeur, destinataire, quand, texte]
const PRIVES = [
  ['Pixel42', 'Lune.Verte', jourA(2, '19:02'), 'Revanche au Morpion quand tu veux. Je jure que je ne ferai plus match nul.'],
  ['Lune.Verte', 'Pixel42', jourA(2, '19:06'), 'Marché conclu. Mais je reste sur mes croix, je les porte chance.'],
  ['Noisette', 'Lune.Verte', jourA(1, '18:50'), 'Pour samedi, j’ai prévu un mode d’emploi d’une page d’Escales, je te l’envoie avant.'],
  ['Lune.Verte', 'Noisette', jourA(1, '18:55'), 'Génial, merci ! Tu me gardes une place près de la fenêtre.'],
  ['Admin-Demo', 'Lune.Verte', jourA(1, '09:30'), 'Bienvenue ! N’hésite pas à me dire si quelque chose ne marche pas dans l’appli.'],
  ['Pomelo', 'Lune.Verte', ilYa(20), 'Tu viens battre Kiwi.k au Quatre à la suite ? Il se vante depuis ce matin.'],
];

// Parties : une liste de coups jouée avec les vraies règles. `coups` : [pseudo, action].
const tour = (...coups) => coups;
const PARTIES_FINIES = [
  { jeu: 'morpion', joueurs: ['Lune.Verte', 'Pixel42'], coups: tour(['Lune.Verte', { cell: 4 }], ['Pixel42', { cell: 0 }], ['Lune.Verte', { cell: 2 }], ['Pixel42', { cell: 3 }], ['Lune.Verte', { cell: 6 }]) },
  { jeu: 'morpion', joueurs: ['Pixel42', 'Lune.Verte'], coups: tour(['Pixel42', { cell: 4 }], ['Lune.Verte', { cell: 0 }], ['Pixel42', { cell: 2 }], ['Lune.Verte', { cell: 6 }], ['Pixel42', { cell: 3 }], ['Lune.Verte', { cell: 5 }], ['Pixel42', { cell: 7 }], ['Lune.Verte', { cell: 1 }], ['Pixel42', { cell: 8 }]) },
  { jeu: 'quatre', joueurs: ['Noisette', 'Lune.Verte'], coups: tour(['Noisette', { col: 3 }], ['Lune.Verte', { col: 0 }], ['Noisette', { col: 3 }], ['Lune.Verte', { col: 1 }], ['Noisette', { col: 3 }], ['Lune.Verte', { col: 0 }], ['Noisette', { col: 3 }]) },
  { jeu: 'echecs', joueurs: ['Mistral', 'Lune.Verte'], coups: [], abandon: 'Mistral' },
];
const PARTIES_EN_COURS = [
  { jeu: 'morpion', joueurs: ['Zozo', 'Lune.Verte'], coups: tour(['Zozo', { cell: 4 }], ['Lune.Verte', { cell: 0 }], ['Zozo', { cell: 8 }]) },
  { jeu: 'quatre', joueurs: ['Kiwi.k', 'Pomelo'], coups: tour(...[3, 2, 3, 4, 2, 4].map((col, i) => [i % 2 ? 'Pomelo' : 'Kiwi.k', { col }])) },
  { jeu: 'echecs', joueurs: ['Mistral', 'Cassiopée'], coups: [] },
  { jeu: 'yams', joueurs: ['Barnabé', 'Pixel42'], coups: [] },
  { jeu: 'belote', joueurs: ['Tonton_Dés', 'Capitaine_Biscotte', 'Ludo-Lent', 'Barnabé'], coups: [] },
];
const SALONS = [
  { jeu: 'escales', joueurs: ['Noisette', 'Mistral', 'Kiwi.k'] },
  { jeu: 'loup-garou', joueurs: ['Zozo', 'Pixel42', 'Tonton_Dés', 'Mistral', 'Noisette', 'Cassiopée'] },
  { jeu: 'quiz', joueurs: ['Cassiopée', 'Barnabé', 'Pomelo'] },
  { jeu: 'poker', joueurs: ['Tonton_Dés', 'Pixel42', 'Barnabé'] },
  { jeu: 'quatre', joueurs: ['Pomelo'] },
];

// Remplit la base vide. Renvoie un petit récapitulatif.
export async function remplirDemo() {
  const { db, setSetting } = await import('../src/db.js');
  const auth = await import('../src/auth.js');
  const chat = await import('../src/chat.js');
  const tables = await import('../src/tables.js');
  const { COLORS, AVATARS, LIMITS } = await import('../src/options.js');
  const ids = new Map();

  // Comptes : même chemin que l'inscription (pseudo vérifié, mot de passe vérifié et haché).
  for (const e of ELEVES) {
    const mdp = e.admin ? MDP_ADMIN : MDP_ELEVES;
    const erreur = auth.validatePseudo(e.pseudo) || auth.validatePassword(mdp, e.pseudo);
    if (erreur) throw new Error(`Compte de démo ${e.pseudo} refusé : ${erreur}`);
    if (!AVATARS.includes(e.avatar) || !Object.hasOwn(COLORS, e.color) || e.bio.length > LIMITS.bioMax) throw new Error(`Profil de démo ${e.pseudo} invalide.`);
    if (auth.pseudoTaken(e.pseudo)) throw new Error(`Pseudo de démo déjà pris : ${e.pseudo}`);
    const user = auth.createUser({ pseudo: e.pseudo, passHash: await auth.hashPassword(mdp) });
    if (e.admin && user.role !== 'admin') throw new Error('Le compte admin de démo n’a pas reçu le rôle admin (variable ADMINS).');
    // Même requête que l'écran Profil.
    db.prepare('UPDATE users SET avatar = ?, color = ?, bio = ?, created_at = ? WHERE id = ?').run(e.avatar, e.color, e.bio, jourA(e.jours, '10:00'), user.id);
    ids.set(e.pseudo, user.id);
  }
  const id = (pseudo) => {
    if (!ids.has(pseudo)) throw new Error(`Pseudo de démo inconnu : ${pseudo}`);
    return ids.get(pseudo);
  };

  // Un modérateur et des rôles colorés, pour montrer la liste des membres rangée par rôle. Mêmes fonctions que l'écran Admin.
  const roles = await import('../src/roles.js');
  db.prepare("UPDATE users SET role = 'modo' WHERE id = ?").run(id(MODO));
  for (const [nom, couleur, membres] of ROLES) {
    roles.createRole({ name: nom, color: couleur });
    const rid = roles.listRoles().find((r) => r.name === nom).id;
    for (const p of membres) roles.setUserRoles(id(p), [...auth.publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id(p))).roles, rid]);
  }

  // Canaux : « général » et « on-joue-quand » existent déjà, on ajoute les autres.
  for (const [name, topic] of Object.entries(SUJETS)) chat.createChannel({ name, topic });
  const canal = new Map(chat.listChannels().map((c) => [c.name, c.id]));

  // Messages : postMessage et toggleReaction ; seule la date est remplacée (le message le plus ancien d'abord).
  let nbMessages = 0;
  const date = db.prepare('UPDATE messages SET created_at = ? WHERE id = ?');
  const publier = (scope, auteur, quand, texte, reactions = {}) => {
    const m = chat.postMessage(scope, id(auteur), texte);
    date.run(quand, m.id);
    for (const [emoji, qui] of Object.entries(reactions)) for (const p of qui) chat.toggleReaction(m.id, id(p), emoji);
    nbMessages++;
  };
  for (const [nom, liste] of Object.entries(CANAUX)) {
    if (!canal.has(nom)) throw new Error(`Canal de démo introuvable : ${nom}`);
    for (const [auteur, quand, texte, reactions] of liste) publier(`c:${canal.get(nom)}`, auteur, quand, texte, reactions);
  }
  for (const [de, a, quand, texte] of PRIVES) publier(chat.dmScope(id(de), id(a)), de, quand, texte);

  // Tout le monde est à jour sur les canaux ; les derniers messages du jour restent « non lus » pour Lune.Verte (pastilles visibles),
  // en marquant lus ceux d'avant.
  for (const e of ELEVES) chat.markAllChannelsRead(id(e.pseudo));
  const nonLus = db.prepare("SELECT MIN(id) AS premier FROM messages WHERE scope = ? AND created_at >= ?");
  const lune = id(PRINCIPAL);
  for (const [nom, depuis] of [['général', ilYa(220)], ['on-joue-quand', ilYa(130)]]) {
    const { premier } = nonLus.get(`c:${canal.get(nom)}`, depuis);
    if (premier) db.prepare('UPDATE reads SET last_id = ? WHERE user_id = ? AND scope = ?').run(premier - 1, lune, `c:${canal.get(nom)}`);
  }

  // Parties : toujours avec les règles du jeu. Les parties terminées d'abord (elles remplissent « Tes dernières parties »).
  const creer = (p) => {
    const t = tables.createTable(p.jeu, id(p.joueurs[0]));
    for (const j of p.joueurs.slice(1)) tables.joinTable(t.id, id(j));
    return t;
  };
  const lancer = (p) => {
    const t = creer(p);
    tables.startTable(t.id, id(p.joueurs[0]));
    for (const [qui, action] of p.coups) tables.playMove(t.id, id(qui), action);
    return t;
  };
  for (const p of PARTIES_FINIES) {
    const t = lancer(p);
    if (p.abandon) tables.leaveTable(t.id, id(p.abandon));
    if (tables.getTable(t.id).status !== 'over') throw new Error(`La partie de démo (${p.jeu}) n'est pas terminée : vérifie ses coups.`);
  }
  for (const p of PARTIES_EN_COURS) {
    const t = lancer(p);
    if (tables.getTable(t.id).status !== 'playing') throw new Error(`La partie de démo (${p.jeu}) devrait être en cours.`);
  }
  for (const p of SALONS) creer(p);

  setSetting('demo', '1');
  return { comptes: ELEVES.length, messages: nbMessages, parties: PARTIES_FINIES.length + PARTIES_EN_COURS.length + SALONS.length };
}
