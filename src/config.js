// Réglages lus dans les variables d'environnement (cPanel > Setup Node.js App > Environment variables).
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// « /hubuno » quand l'appli vit dans un sous-dossier, « » à la racine d'un domaine.
const basePath = (process.env.BASE_PATH || '').replace(/\/+$/, '').replace(/^(?!\/)(.)/, '/$1');

export const config = {
  root,
  port: Number(process.env.PORT) || 3000,
  // Sur un VPS derrière nginx : 127.0.0.1, pour que personne n'atteigne l'appli sans passer par lui. Vide : toutes les adresses.
  host: process.env.HOST || undefined,
  basePath,
  dataDir: process.env.DATA_DIR || join(root, 'data'),
  // Code de classe de départ ; un admin peut le changer ensuite depuis Hubuno.
  classCode: process.env.CLASS_CODE || '',
  // Pseudos qui deviennent admins à l'inscription, séparés par des virgules.
  admins: (process.env.ADMINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  messageRetentionDays: 365,
  sessionDays: 60,
};
