// Garde-fous de la démo : elle utilise des mots de passe connus de tous, donc elle ne doit jamais tourner en production
// ni toucher à la vraie base. Fonctions sans effet de bord, testées dans src/demo.test.js.
import { join, resolve } from 'node:path';

export const CODE_CLASSE = 'classe-demo-2026';
export const MDP_ADMIN = 'Demo-Admin-2026!';
export const MDP_ELEVES = 'Demo-Classe-2026!';

// Le seul dossier de données que la démo a le droit d'utiliser.
export const dossierDemo = (racine) => join(racine, 'data', 'demo');

// Renvoie le message (en français) qui explique pourquoi la démo ne doit pas démarrer, ou null si tout va bien.
export function problemeDemo({ env, racine }) {
  if (String(env.NODE_ENV || '').toLowerCase() === 'production') {
    return 'La démo utilise des mots de passe connus de tous : elle refuse de tourner avec NODE_ENV=production. Pour la vraie mise en ligne, utilise « npm start ».';
  }
  const demande = env.DATA_DIR;
  if (demande && resolve(demande) !== dossierDemo(racine)) {
    return `La démo n'écrit que dans ${dossierDemo(racine)}. DATA_DIR vaut « ${demande} » : retire cette variable (ou « unset DATA_DIR ») puis relance.`;
  }
  return null;
}

// Une base qui a déjà des comptes mais pas la marque « démo » n'est pas une base de démo : on n'y touche pas.
export function problemeBase({ nbComptes, marque }) {
  if (nbComptes > 0 && marque !== '1') {
    return 'Le dossier data/demo contient des comptes qui ne viennent pas de la démo : je ne touche pas à cette base. Relance avec « npm run demo -- --neuf » (l\'ancien dossier est gardé, renommé).';
  }
  return null;
}
