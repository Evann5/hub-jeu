// Outils des tests du hub sans navigateur : un serveur jetable (DATA_DIR temporaire, port libre) et un client Socket.IO minimal
// qui parle le protocole à la main sur le paquet ws (déjà installé avec socket.io). Rien ici ne touche à data/.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CODE = 'test-classe-1234';
export const CODE_ADMIN = 'code-admin-test';
export const ADMIN = 'minhtest';
export const MDP = 'Tr3s-long-mdp-test!';
const WebSocket = createRequire(join(RACINE, 'rien.js'))('ws');
export const pause = (ms) => new Promise((r) => setTimeout(r, ms));

function portLibre() {
  return new Promise((ok, ko) => {
    const s = createServer();
    s.once('error', ko);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });
}

// Lance server.js sur une base jetable. dir : pour repartir d'une base préparée ; sinon un dossier temporaire, effacé par arreter().
export async function lancerServeur({ dir = null, env: extra = {} } = {}) {
  const srv = { dir: dir ?? mkdtempSync(join(tmpdir(), 'hubuno-test-')), journal: '', proc: null };
  const env = { ...process.env, HOST: '127.0.0.1', DATA_DIR: srv.dir, CLASS_CODE: CODE, ADMINS: ADMIN, ADMIN_CODE: CODE_ADMIN, ...extra };
  delete env.BASE_PATH;
  delete env.NODE_ENV;
  srv.demarrer = async () => {
    srv.port ??= await portLibre();
    srv.url = `http://127.0.0.1:${srv.port}/`;
    srv.journal = '';
    const proc = spawn(process.execPath, ['server.js'], { cwd: RACINE, env: { ...env, PORT: String(srv.port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    srv.proc = proc;
    proc.stdout.on('data', (d) => { srv.journal += d; });
    proc.stderr.on('data', (d) => { srv.journal += d; });
    const fin = Date.now() + 20_000;
    while (!/écoute sur le port/.test(srv.journal) && proc.exitCode === null && Date.now() < fin) await pause(25);
    if (!/écoute sur le port/.test(srv.journal)) throw new Error(`Le serveur n'a pas démarré :\n${srv.journal}`);
  };
  srv.couper = async () => {
    const proc = srv.proc;
    if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
    await new Promise((ok) => { proc.once('exit', ok); proc.kill('SIGKILL'); });
  };
  srv.arreter = async () => {
    await srv.couper();
    if (!dir) rmSync(srv.dir, { recursive: true, force: true });
  };
  process.on('exit', () => { try { srv.proc?.kill('SIGKILL'); } catch { /* déjà arrêté */ } });
  await srv.demarrer();
  return srv;
}

// Crée un compte par l'API ; rend son identifiant et son cookie de session.
export async function inscrire(srv, pseudo, { admin = false } = {}) {
  const r = await fetch(`${srv.url}api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ classCode: admin ? CODE_ADMIN : CODE, pseudo, password: MDP, acceptRules: true }),
  });
  if (!r.ok) throw new Error(`inscription de ${pseudo} : ${r.status} ${await r.text()}`);
  const { user } = await r.json();
  return { id: user.id, pseudo, cookie: r.headers.get('set-cookie').split(';')[0] };
}

// Se connecte à un compte qui existe déjà ; rend son identifiant et son cookie de session.
export async function entrer(srv, pseudo) {
  const r = await fetch(`${srv.url}api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pseudo, password: MDP }) });
  if (!r.ok) throw new Error(`connexion de ${pseudo} : ${r.status} ${await r.text()}`);
  const { user } = await r.json();
  return { id: user.id, pseudo, cookie: r.headers.get('set-cookie').split(';')[0] };
}

// Une connexion temps réel d'un compte. recus : tout ce que le serveur a envoyé, dans l'ordre ({ ev, data } ou { ack, data }).
export class Client {
  constructor(srv, compte) {
    this.srv = srv;
    this.compte = compte;
    this.recus = [];
    this.attentes = new Map();
    this.n = 0;
  }

  ouvrir() {
    return new Promise((ok, ko) => {
      const ws = new WebSocket(`${this.srv.url.replace('http', 'ws')}socket.io/?EIO=4&transport=websocket`, { headers: { Cookie: this.compte.cookie } });
      this.ws = ws;
      const delai = setTimeout(() => ko(new Error('connexion : délai dépassé')), 10_000);
      ws.on('message', (brut) => {
        if (this.sourd) return;
        const s = String(brut);
        if (s[0] === '0') ws.send('40');
        else if (s === '2') ws.send('3');
        else if (s.startsWith('40')) { clearTimeout(delai); ok(this); }
        else if (s.startsWith('44')) { clearTimeout(delai); ko(new Error(JSON.parse(s.slice(2)).message)); }
        else if (s.startsWith('43')) {
          const m = /^43(\d+)(.*)$/s.exec(s);
          const data = JSON.parse(m[2])[0];
          this.recus.push({ ack: Number(m[1]), data });
          this.attentes.get(Number(m[1]))?.(data);
          this.attentes.delete(Number(m[1]));
        } else if (s.startsWith('42')) {
          const [ev, data] = JSON.parse(s.slice(2));
          this.recus.push({ ev, data });
        }
      });
      ws.on('error', (e) => { clearTimeout(delai); ko(e); });
    });
  }

  // Envoie sans attendre : rend le numéro de la demande (pour retrouver son accusé dans recus).
  envoyer(ev, data = {}) {
    const id = this.n++;
    this.ws.send(`42${id}${JSON.stringify([ev, data])}`);
    return id;
  }

  // Envoie et attend la réponse du serveur ({ ok, … } ou { ok: false, error }).
  appel(ev, data = {}) {
    return new Promise((ok, ko) => {
      const id = this.envoyer(ev, data);
      const delai = setTimeout(() => ko(new Error(`${ev} : pas de réponse en 10 s`)), 10_000);
      this.attentes.set(id, (r) => { clearTimeout(delai); ok(r); });
    });
  }

  dernier(ev) { return this.recus.findLast((r) => r.ev === ev)?.data; }
  // Le wifi tombe : plus rien ne part ni n'arrive, et le serveur ne reçoit aucun signal de fermeture.
  devenirSourd() { this.sourd = true; this.ws._socket?.pause(); }
  fermer() { try { this.ws?.terminate(); } catch { /* déjà fermé */ } }
}

export async function jusque(condition, decrit, delai = 5000) {
  const fin = Date.now() + delai;
  for (;;) {
    const v = await condition();
    if (v) return v;
    if (Date.now() > fin) throw new Error(`Attendu : ${decrit}`);
    await pause(20);
  }
}
