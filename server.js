// Point d'entrée de Hubuno (fichier de démarrage à indiquer dans cPanel > Setup Node.js App).
import { createServer } from 'node:http';
import { join } from 'node:path';
import express from 'express';
import { config } from './src/config.js';
import { api } from './src/api.js';
import { attachRealtime } from './src/realtime.js';
import { purgeOldMessages } from './src/chat.js';
import { purgeOldMod } from './src/journal.js';
import { purgeExpiredSessions, classCode } from './src/auth.js';
import { loadGames, gamesDir } from './src/games.js';
import { purgeTables } from './src/play.js';
import { gzipped } from './src/gzip.js';

// Filet de sécurité : une erreur imprévue est écrite dans le journal, sans arrêter le serveur (et donc sans déconnecter toute la classe).
process.on('uncaughtException', (err) => console.error('Erreur non rattrapée :', err));
process.on('unhandledRejection', (reason) => console.error('Promesse rejetée non rattrapée :', reason));

await loadGames();

const app = express();
app.set('trust proxy', 1); // derrière le proxy d'O2Switch : vraie IP et HTTPS
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  });
  // HSTS seulement en HTTPS (le navigateur l'ignore en HTTP, et il bloquerait un test en local si on l'envoyait par erreur).
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
});

const router = express.Router();
// Les réponses de l'API sont personnelles : jamais gardées en cache (navigateur ou proxy).
router.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
}, api);
// maxAge 0 : le navigateur revérifie chaque fichier (un 304 ne coûte rien). Avec un cache, une mise à jour qui ajoute un export casserait
// le chargement chez qui garde l'ancien module, car les imports d'un module ne portent pas le ?v= de la page.
router.use(gzipped(join(config.root, 'public')), express.static(join(config.root, 'public'), { maxAge: 0 }));
// Fichiers des jeux pour le navigateur : client.js, style.css, client/ et assets/ seulement (jamais rules.js).
router.use('/games', (req, res, next) => (
  /^\/[a-z0-9-]+\/(client\.js|style\.css|(client|assets)\/[\w./-]+)$/.test(req.path) && !req.path.includes('..') ? next() : res.sendStatus(404)
), gzipped(gamesDir), express.static(gamesDir, { maxAge: 0, index: false, fallthrough: false }));
// Les écrans de l'appli passent par l'ancre (#/c/1) : toute autre adresse renvoie à l'accueil.
router.get('/{*rest}', (req, res) => res.redirect(`${config.basePath}/`));
if (config.basePath) {
  // « /hubuno » sans barre finale casserait les adresses relatives de la page.
  app.get(config.basePath, (req, res, next) => (req.path.endsWith('/') ? next() : res.redirect(`${config.basePath}/`)));
}
app.use(config.basePath || '/', router);

// Une adresse mal formée ou un fichier absent : jamais de trace technique, quel que soit le réglage de NODE_ENV.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  return res.status(status).type('text/plain').send(status === 404 ? 'Introuvable.' : status === 500 ? 'Erreur du serveur.' : 'Requête invalide.');
});

const server = createServer(app);
attachRealtime(server);

// Ménage : messages de plus d'un an et sessions expirées, au démarrage puis toutes les heures.
function housekeeping() {
  const removed = purgeOldMessages();
  if (removed) console.log(`Ménage : ${removed} message(s) de plus d'un an effacé(s).`);
  purgeExpiredSessions();
  purgeOldMod();
  const tablesRemoved = purgeTables();
  if (tablesRemoved) console.log(`Ménage : ${tablesRemoved} table(s) inactive(s) fermée(s).`);
}
housekeeping();
setInterval(housekeeping, 3600_000).unref();

server.listen(config.port, config.host, () => {
  console.log(`Hubuno écoute sur le port ${config.port}${config.basePath ? `, sous ${config.basePath}` : ''}.`);
  if (process.env.NODE_ENV === 'production' && !config.host) console.warn('HOST est vide : sans proxy devant, X-Forwarded-For permet de contourner les limites. Sur un VPS, mettre HOST=127.0.0.1.');
  if (process.env.NODE_ENV === 'production' && config.admins.length && !config.adminCode) console.warn('ADMIN_CODE est vide : le premier élève qui prend un pseudo de ADMINS devient admin.');
  if (!classCode()) console.warn('Aucun code de classe : réglez CLASS_CODE pour ouvrir les inscriptions.');
});
