// Point d'entrée de Hubuno (fichier de démarrage à indiquer dans cPanel > Setup Node.js App).
import { createServer } from 'node:http';
import { join } from 'node:path';
import express from 'express';
import { config } from './src/config.js';
import { api } from './src/api.js';
import { attachRealtime } from './src/realtime.js';
import { purgeOldMessages } from './src/chat.js';
import { purgeExpiredSessions, classCode } from './src/auth.js';

const app = express();
app.set('trust proxy', 1); // derrière le proxy d'O2Switch : vraie IP et HTTPS
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  });
  next();
});

const router = express.Router();
router.use('/api', api);
router.use(express.static(join(config.root, 'public'), { maxAge: '1h' }));
// Les écrans de l'appli passent par l'ancre (#/c/1) : toute autre adresse renvoie à l'accueil.
router.get('/{*rest}', (req, res) => res.redirect(`${config.basePath}/`));
if (config.basePath) {
  // « /hubuno » sans barre finale casserait les adresses relatives de la page.
  app.get(config.basePath, (req, res, next) => (req.path.endsWith('/') ? next() : res.redirect(`${config.basePath}/`)));
}
app.use(config.basePath || '/', router);

const server = createServer(app);
attachRealtime(server);

// Ménage : messages de plus d'un an et sessions expirées, au démarrage puis toutes les heures.
function housekeeping() {
  const removed = purgeOldMessages();
  if (removed) console.log(`Ménage : ${removed} message(s) de plus d'un an effacé(s).`);
  purgeExpiredSessions();
}
housekeeping();
setInterval(housekeeping, 3600_000).unref();

server.listen(config.port, () => {
  console.log(`Hubuno écoute sur le port ${config.port}${config.basePath ? `, sous ${config.basePath}` : ''}.`);
  if (!classCode()) console.warn('Aucun code de classe : réglez CLASS_CODE pour ouvrir les inscriptions.');
});
