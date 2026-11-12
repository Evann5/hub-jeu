// Les erreurs JavaScript de cette page remontent au serveur, où les admins les lisent (Admin › Journal des erreurs) :
// en classe, personne n'ouvre la console. Une seule fois par sorte d'erreur, dix au plus par page ouverte.
import { state } from './store.js';

const seen = new Set();
let sent = 0;

export function reportError(err, place = '') {
  try {
    if (err && typeof err === 'object' && 'status' in err) return; // refus ou coupure déjà expliqués à l'écran (NetError)
    const message = String(err?.message ?? err ?? '').slice(0, 300);
    const key = `${message}|${place}`;
    if (!message || seen.has(key) || sent >= 10 || !state.socket?.connected) return;
    seen.add(key);
    sent += 1;
    const line = String(err?.stack ?? '').split('\n').find((l) => /\.js/.test(l)) ?? '';
    const where = [place, line.replace(location.origin, '').trim(), location.hash].filter(Boolean).join(' · ').slice(0, 200);
    state.socket.emit('client:error', { message, place: where });
  } catch { /* signaler une erreur ne doit jamais en créer une autre */ }
}

window.addEventListener('error', (e) => reportError(e.error ?? e.message, e.filename ? `${e.filename.replace(location.origin, '')}:${e.lineno}` : ''));
window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'promesse'));
