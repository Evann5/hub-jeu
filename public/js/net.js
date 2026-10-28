// Échanges avec le serveur : appels HTTP (comptes) et connexion temps réel (messagerie).

export class NetError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, body) {
  let res;
  try {
    res = await fetch(`api/${path}`, body === undefined
      ? { credentials: 'same-origin' }
      : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new NetError('Pas de connexion au serveur. Vérifie ton réseau et réessaie.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new NetError(data.error || 'Erreur du serveur, réessaie dans un instant.', res.status);
  return data;
}

// Socket.IO vit sous le même dossier que la page (marche aussi dans un sous-dossier).
export function connect() {
  const base = location.pathname.replace(/[^/]*$/, '');
  // eslint-disable-next-line no-undef
  return io({ path: `${base}socket.io`, withCredentials: true });
}

// Envoie un événement et attend la réponse du serveur ; rejette avec le message d'erreur en français.
export function call(socket, event, payload = {}, timeout = 10_000) {
  return new Promise((resolve, reject) => {
    socket.timeout(timeout).emit(event, payload, (err, res) => {
      if (err) return reject(new NetError("Le serveur ne répond pas. Réessaie dans un instant.", 0));
      if (!res?.ok) return reject(new NetError(res?.error || 'Erreur du serveur.', 400));
      resolve(res);
    });
  });
}
