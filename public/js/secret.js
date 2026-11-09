// Le cache « mains autour de l'écran » : en classe, sur ordinateur, ce qu'un voisin ne doit pas voir (ton rôle, ton mot,
// tes cartes secrètes) reste masqué ; on maintient le clic (ou Espace) pour le voir, et il se recache dès qu'on lâche.
// Sur téléphone, rien n'est caché : on éloigne l'écran. Réglable dans Profil (« Cacher mes secrets sur cet ordinateur »).
import { h, icon } from './dom.js';

const KEY = 'hubuno.cacher';
let holding = false; // le clic est maintenu : un écran redessiné pendant ce temps reste visible

export const isDesktop = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function hideSecrets() {
  try {
    return localStorage.getItem(KEY) !== 'non';
  } catch {
    return true;
  }
}

export function setHideSecrets(on) {
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, 'non');
  } catch { /* navigateur sans stockage : on garde le réglage par défaut */ }
}

function release() {
  holding = false;
  for (const box of document.querySelectorAll('.secret-box.is-shown')) box.classList.remove('is-shown');
}
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);
window.addEventListener('blur', release);
document.addEventListener('visibilitychange', release);

// Entoure un affichage secret (sans bouton à l'intérieur : un clic maintenu ne peut pas aussi cliquer dedans).
// `label` complète « Maintiens le clic pour voir … » : « ton rôle », « ton mot », « tes cartes »…
export function secret(content, { label = 'ton secret' } = {}) {
  if (!isDesktop() || !hideSecrets()) return content;
  const box = h('div.secret-box', {
    tabindex: '0',
    role: 'button',
    'aria-label': `Maintiens le clic ou Espace pour voir ${label}`,
  },
  h('div.secret-content', content),
  h('div.secret-cover', { 'aria-hidden': 'true' }, icon('eye'), h('span', `Maintiens le clic pour voir ${label}`)));
  if (holding) box.classList.add('is-shown');
  box.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); // pas de sélection de texte pendant qu'on maintient
    holding = true;
    box.classList.add('is-shown');
  });
  box.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      holding = true;
      box.classList.add('is-shown');
    }
  });
  box.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') release();
  });
  box.addEventListener('blur', release);
  return box;
}
