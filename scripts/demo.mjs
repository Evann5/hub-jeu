// Démo de Hubuno : « npm run demo ». Démarre l'appli dans data/demo/ (jamais la vraie base), la remplit au premier lancement,
// écoute sur toutes les interfaces (téléphones du même Wi-Fi) et affiche les adresses et les comptes de démo.
//   npm run demo                  démarre (port 3000, ou le premier libre juste après)
//   npm run demo -- --port 3100   choisit le port (PORT=3100 marche aussi)
//   npm run demo -- --neuf        repart de zéro, après confirmation (l'ancien dossier est renommé, pas supprimé)
import { createServer } from 'node:net';
import { networkInterfaces } from 'node:os';
import { existsSync, renameSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODE_CLASSE, MDP_ADMIN, MDP_ELEVES, dossierDemo, problemeDemo, problemeBase } from './demo-garde.mjs';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const fin = (message, code = 1) => {
  console.error(`\n${message}\n`);
  process.exit(code);
};

if (args.includes('--aide') || args.includes('--help')) {
  console.log('Démo de Hubuno (données inventées, jamais la vraie base).\n  npm run demo                 démarre\n  npm run demo -- --port 3100  choisit le port\n  npm run demo -- --neuf       repart de zéro (après confirmation ; l\'ancien dossier est renommé)');
  process.exit(0);
}

// 1. Garde-fous, avant toute écriture.
const refus = problemeDemo({ env: process.env, racine });
if (refus) fin(`DÉMO REFUSÉE. ${refus}`);

const dataDir = dossierDemo(racine);

// 2. --neuf : on met l'ancien dossier de côté (jamais de suppression), après un oui tapé au clavier.
if (args.includes('--neuf')) {
  if (existsSync(dataDir)) {
    const reponse = await new Promise((ok) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.once('close', () => ok(''));
      rl.question('Repartir de zéro ? L\'ancien dossier de démo sera renommé (rien n\'est supprimé). Tape « oui » pour confirmer : ', (r) => { ok(r); rl.close(); });
    });
    if (!/^(oui|o|yes|y)$/i.test(reponse.trim())) fin('Rien n\'a été changé. La démo n\'a pas démarré.', 0);
    const horodatage = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const ancien = `${dataDir}-ancien-${horodatage}`;
    renameSync(dataDir, ancien);
    console.log(`Ancien dossier gardé : ${ancien}`);
  } else {
    console.log('Pas de démo existante : une nouvelle va être créée.');
  }
}

// 3. Port : celui demandé (--port ou PORT), sinon 3000 puis le premier libre juste après.
const optPort = args.indexOf('--port');
const demande = optPort >= 0 ? args[optPort + 1] : process.env.PORT;
if (demande !== undefined && !(Number.isInteger(Number(demande)) && Number(demande) > 0 && Number(demande) < 65536)) fin(`Port invalide : « ${demande} ».`);
const estLibre = (port) => new Promise((ok) => {
  const s = createServer();
  s.once('error', () => ok(false));
  s.listen(port, () => s.close(() => ok(true))); // sans adresse, comme le serveur : toutes les interfaces
});
let port;
if (demande) {
  port = Number(demande);
  if (!(await estLibre(port))) fin(`Le port ${port} est déjà pris. Choisis-en un autre : npm run demo -- --port ${port + 1}`);
} else {
  for (port = 3000; port < 3020 && !(await estLibre(port)); port++);
  if (port >= 3020) fin('Aucun port libre entre 3000 et 3019. Ferme un autre serveur, ou choisis un port : npm run demo -- --port 4000');
}

// 4. Réglages de la démo, posés avant de charger l'appli (elle les lit au chargement).
for (const k of ['BASE_PATH', 'HOST', 'ADMIN_CODE']) delete process.env[k];
Object.assign(process.env, { DATA_DIR: dataDir, PORT: String(port), CLASS_CODE: CODE_CLASSE, ADMINS: 'admin-demo' });

const { db, getSetting } = await import('../src/db.js');
const { loadGames } = await import('../src/games.js');
await loadGames();
const donnees = await import('./demo-donnees.mjs');

const nbComptes = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
const probleme = problemeBase({ nbComptes, marque: getSetting('demo') });
if (probleme) fin(`DÉMO REFUSÉE. ${probleme}`);
if (nbComptes === 0) {
  process.stdout.write('Premier lancement : je remplis la démo (comptes, messages, parties)… ');
  const r = await donnees.remplirDemo();
  console.log(`fait (${r.comptes} comptes, ${r.messages} messages, ${r.parties} parties).`);
} else {
  // Relance : les parties gardent leur place (le ménage du hub ferme les salons de plus de 12 h) et rien n'est ajouté en double.
  db.prepare('UPDATE game_tables SET updated_at = ?').run(Date.now());
}

// 5. Démarrage de l'appli, dans ce même processus.
await import('../server.js');
const base = `http://127.0.0.1:${port}`;
for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${base}/api/options`)).ok) break;
  } catch { /* pas encore prêt */ }
  if (i > 100) fin('Le serveur n\'a pas démarré en 10 secondes.');
  await new Promise((r) => setTimeout(r, 100));
}

// 6. Présence : quelques élèves sont « connectés » (ils apparaissent en ligne), et leurs salons de jeu restent ouverts.
// Le hub ferme un salon que personne ne regarde depuis 5 minutes ; ici, un élève assis à la table le regarde, comme un vrai joueur.
const tables = await import('../src/tables.js');
const { getUser } = await import('../src/auth.js');
const pseudoDe = (id) => getUser(id)?.pseudo;
const bots = new Map();

async function seConnecter(pseudo) {
  const r = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ pseudo, password: MDP_ELEVES }),
  });
  if (!r.ok) throw new Error(`connexion de ${pseudo} : ${r.status}`);
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

function ouvrirPresence(pseudo, cookie) {
  const bot = { pseudo, ws: null, ouvert: false, regarde: new Set() };
  const ouvrir = () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`, { headers: { Cookie: cookie, Origin: base } });
    bot.ws = ws;
    ws.addEventListener('message', (e) => {
      const m = String(e.data);
      if (m === '2') ws.send('3'); // le serveur demande « tu es là ? »
      else if (m.startsWith('0')) ws.send('40'); // engine.io ouvert : on entre dans l'espace principal
      else if (m.startsWith('40')) { // connecté
        bot.ouvert = true;
        for (const id of bot.regarde) ws.send(`42["table:watch",{"id":${id}}]`);
      }
    });
    ws.addEventListener('close', () => {
      bot.ouvert = false;
      if (!bot.arret) setTimeout(ouvrir, 3000).unref();
    });
    ws.addEventListener('error', () => {});
  };
  bot.regarder = (id) => {
    bot.regarde.add(id);
    if (bot.ouvert) bot.ws.send(`42["table:watch",{"id":${id}}]`);
  };
  ouvrir();
  return bot;
}

const enLigne = donnees.ELEVES.filter((e) => e.bot).map((e) => e.pseudo);
for (const pseudo of enLigne) bots.set(pseudo, ouvrirPresence(pseudo, await seConnecter(pseudo)));
for (const t of tables.lobbies()) {
  const gardien = t.seats.map(pseudoDe).find((p) => bots.has(p));
  if (gardien) bots.get(gardien).regarder(t.id);
}
// Laisse une seconde aux connexions pour s'établir avant d'annoncer que tout est prêt.
await new Promise((r) => setTimeout(r, 1000));

// 7. Adresses.
function adressesWifi() {
  const out = [];
  for (const [nom, liste] of Object.entries(networkInterfaces())) {
    for (const a of liste || []) {
      if (a.family !== 'IPv4' || a.internal || a.address.startsWith('169.254.')) continue;
      out.push({ nom, ip: a.address });
    }
  }
  // Wi-Fi ou câble (en0, en1…) : les autres interfaces sont des tunnels (VPN, AirDrop…) que les téléphones ne joignent pas.
  // en0 est d'ordinaire le Wi-Fi d'un Mac ; on le met en tête.
  const reels = out.filter((w) => /^en\d+$/.test(w.nom));
  return (reels.length ? reels : out).sort((x, y) => (y.nom === 'en0') - (x.nom === 'en0'));
}
const wifi = adressesWifi();
const ligne = '='.repeat(66);
const eleves = donnees.ELEVES.filter((e) => !e.admin);
console.log(`
${ligne}
  HUBUNO - MODE DEMO  (ce n'est PAS la mise en ligne)
  Données inventées dans data/demo/. La vraie base n'est jamais touchée.
${ligne}

  Sur ce Mac, ouvre :
      http://localhost:${port}/

  Sur un téléphone connecté au MEME Wi-Fi, ouvre :${wifi.length ? '' : '\n      (aucune adresse Wi-Fi trouvée : connecte le Mac à un réseau)'}${wifi.map((w, i) => `\n      http://${w.ip}:${port}/${i === 0 ? '' : `   (autre réseau : ${w.nom})`}`).join('')}

  Code de classe (pour créer un compte)  :  ${CODE_CLASSE}

  Compte admin       :  Admin-Demo   /  ${MDP_ADMIN}
  Élève principale   :  ${donnees.PRINCIPAL}   /  ${MDP_ELEVES}
  Modérateur         :  ${donnees.MODO}   /  ${MDP_ELEVES}   (rôles colorés : voir Membres)
  Autres élèves      :  ${eleves.slice(1).map((e) => e.pseudo).join(', ')}
                        (tous avec le mot de passe  ${MDP_ELEVES})
  Déjà connectés     :  ${enLigne.join(', ')}

  Pour arrêter : Ctrl+C.   Pour repartir de zéro : npm run demo -- --neuf
${ligne}
`);

process.on('SIGINT', () => {
  for (const b of bots.values()) { b.arret = true; b.ws?.close(); }
  console.log('\nDémo arrêtée. À la prochaine !');
  process.exit(0);
});
process.on('SIGTERM', () => process.emit('SIGINT'));
