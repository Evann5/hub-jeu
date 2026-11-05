// Outils communs des tests de parcours : serveur jetable, navigateur, comptes, attentes sur le DOM.
// Rien ici ne touche à data/ ni à un serveur en marche : chaque fichier de test lance le sien, sur un port libre, avec un DATA_DIR temporaire.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { before, after } from 'node:test';

export const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CODE = 'test-classe-1234';
export const CODE_ADMIN = 'code-admin-test';
export const ADMIN = 'minhtest';
export const MDP = 'Tr3s-long-mdp-test!';
export const MOTEUR = process.env.MOTEUR === 'webkit' ? 'webkit' : 'chromium';

// ——— Playwright : celui du projet s'il y en a un, sinon celui de la boîte à outils de Minh ———
function chargerPlaywright() {
  const dossiers = [RACINE, process.env.PLAYWRIGHT_DIR, join(homedir(), '.claude/toolkit/outils')].filter(Boolean);
  for (const d of dossiers) {
    try {
      return createRequire(join(d, 'rien.js'))('playwright');
    } catch { /* pas ici */ }
  }
  return null;
}
export const pw = chargerPlaywright();
export const SAUT = pw ? false : 'Playwright est introuvable (ni dans le projet, ni dans ~/.claude/toolkit/outils, ni dans PLAYWRIGHT_DIR) : tests de parcours ignorés.';

// ——— Serveur jetable ———
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

export async function lancerServeur(extra = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'hubuno-parcours-'));
  const srv = { dir, port: null, proc: null, journal: '' };
  const env = { ...process.env, HOST: '127.0.0.1', DATA_DIR: dir, CLASS_CODE: CODE, ADMINS: ADMIN, ADMIN_CODE: CODE_ADMIN, ...extra };
  delete env.BASE_PATH;
  delete env.NODE_ENV;
  srv.demarrer = async () => {
    srv.port ??= await portLibre();
    srv.url = `http://127.0.0.1:${srv.port}/`;
    const proc = spawn(process.execPath, ['server.js'], { cwd: RACINE, env: { ...env, PORT: String(srv.port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    srv.proc = proc;
    proc.stdout.on('data', (d) => { srv.journal += d; });
    proc.stderr.on('data', (d) => { srv.journal += d; });
    await new Promise((ok, ko) => {
      const t = setTimeout(() => ko(new Error(`Le serveur n'a pas démarré en 20 s :\n${srv.journal}`)), 20_000);
      const verifier = () => { if (/écoute sur le port/.test(srv.journal)) { clearTimeout(t); ok(); } };
      proc.stdout.on('data', verifier);
      proc.once('exit', (code) => { clearTimeout(t); ko(new Error(`Le serveur s'est arrêté (code ${code}) :\n${srv.journal}`)); });
    });
  };
  srv.couper = async () => {
    const proc = srv.proc;
    if (!proc || proc.exitCode !== null) return;
    await new Promise((ok) => { proc.once('exit', ok); proc.kill('SIGKILL'); }); // coupure brutale, comme une panne
    srv.proc = null;
  };
  srv.relancer = async () => { await srv.couper(); await srv.demarrer(); };
  srv.arreter = async () => {
    await srv.couper();
    await rm(dir, { recursive: true, force: true });
  };
  process.on('exit', () => { try { srv.proc?.kill('SIGKILL'); } catch { /* déjà arrêté */ } });
  await srv.demarrer();
  return srv;
}

// ——— Attente sur un état réel (le DOM, une réponse), jamais un délai fixe ———
export async function jusque(condition, decrit, { delai = 10_000 } = {}) {
  const fin = Date.now() + delai;
  let dernier;
  for (;;) {
    try {
      dernier = await condition();
      if (dernier) return dernier;
    } catch (e) { dernier = e.message; }
    if (Date.now() > fin) throw new Error(`Attendu : ${decrit} (dernière valeur : ${JSON.stringify(dernier)})`);
    await new Promise((r) => setTimeout(r, 40));
  }
}

// ——— Une suite : un serveur, un navigateur, des tests qui se marquent « ignorés » si Playwright manque ———
export function monterSuite({ env = {} } = {}) {
  const S = { raison: SAUT || null, serveur: null, nav: null, contextes: [], n: 0 };

  before(async () => {
    if (S.raison) return;
    try {
      S.nav = await pw[MOTEUR].launch(MOTEUR === 'chromium' ? { channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } : {}); // le GPU sert à Escales (WebGL)
    } catch (e) {
      S.raison = `Le navigateur ${MOTEUR} ne se lance pas (${e.message.split('\n')[0]}). Installe-le avec « npx playwright install ${MOTEUR} » : tests ignorés.`;
      return;
    }
    S.serveur = await lancerServeur(env);
  });
  after(async () => {
    await S.nav?.close().catch(() => {});
    await S.serveur?.arreter().catch(() => {});
  });

  S.pseudo = (prefixe = 'zz') => `${prefixe}${Date.now().toString(36).slice(-4)}${(S.n++).toString(36)}`.slice(0, 20);

  // Ouvre un navigateur « personne » : compte créé par l'API (admin : le code admin remplace le code de classe), page sur l'accueil.
  S.ouvrir = async (pseudo = S.pseudo(), { admin = false, viewport = { width: 1280, height: 800 }, tactile = false, page: avecPage = true, init = null } = {}) => {
    const contexte = await S.nav.newContext({
      viewport, baseURL: S.serveur.url,
      ...(tactile ? { hasTouch: true, isMobile: MOTEUR !== 'webkit', deviceScaleFactor: 2 } : {}),
    });
    if (init) await contexte.addInitScript(init);
    const p = { contexte, pseudo, erreurs: [] };
    let r = await contexte.request.post(`${S.serveur.url}api/register`, { data: { classCode: admin ? CODE_ADMIN : CODE, pseudo, password: MDP, acceptRules: true } });
    if (!r.ok() && admin) r = await contexte.request.post(`${S.serveur.url}api/login`, { data: { pseudo, password: MDP } });
    if (!r.ok()) throw new Error(`compte ${pseudo} : ${r.status()} ${await r.text()}`);
    if (avecPage) {
      p.page = await contexte.newPage();
      p.page.on('pageerror', (e) => p.erreurs.push(e.message));
      await p.page.goto(S.serveur.url);
      await p.page.locator('.navbar').waitFor();
    }
    return p;
  };
  S.admin = (opts) => S.ouvrir(ADMIN, { admin: true, ...opts });
  S.contextesOuverts = () => S.contextes;

  // Un test : saute proprement si Playwright ou le navigateur manque.
  S.it = (nom, fn, options = {}) => test(nom, { skip: SAUT || false, timeout: 120_000, ...options }, async (t) => {
    if (S.raison) return t.skip(S.raison);
    const ouverts = [];
    const ouvrir = async (...a) => { const p = await S.ouvrir(...a); ouverts.push(p); return p; };
    try {
      await fn({ ouvrir, S, t });
      for (const p of ouverts) assert(p.erreurs.length === 0, `erreur JavaScript chez ${p.pseudo} : ${p.erreurs.join(' | ').slice(0, 300)}`);
    } finally {
      for (const p of ouverts) await p.contexte.close().catch(() => {});
    }
  });
  return S;
}

function assert(ok, msg) {
  if (!ok) throw new Error(msg);
}

// ——— Gestes courants ———
export const aller = (p, hash) => p.page.evaluate((h) => { location.hash = h; }, hash);
export const hashDe = (p) => p.page.evaluate(() => location.hash);

// Appelle un événement Socket.IO depuis la page (comme le ferait un client forgé) et rend la réponse du serveur.
export const appel = (p, evenement, donnees) => p.page.evaluate(([ev, d]) => new Promise((res) => {
  const s = window.io({ path: new URL('socket.io', document.baseURI).pathname });
  s.on('connect', () => s.emit(ev, d, (r) => { s.close(); res(r ?? 'sans-reponse'); }));
  setTimeout(() => { s.close(); res('delai'); }, 5000);
}), [evenement, donnees]);

// Écrit un message dans la conversation ouverte et attend qu'il soit confirmé par le serveur.
export async function ecrire(p, texte, marqueur = texte) {
  await p.page.locator('.composer textarea').fill(texte);
  await p.page.locator('.composer button[type=submit]').click();
  await p.page.locator('.msg:not(.pending) .msg-body', { hasText: marqueur }).first().waitFor();
}

export const messagesDe = (p) => p.page.locator('.msg-body').allTextContents();
export const titre = (p) => p.page.title();

export async function ouvrirMessages(p) {
  await aller(p, '#/messages');
  await p.page.locator('.composer textarea').waitFor();
}

// Ouvre la fiche d'un jeu depuis Jouer puis « Créer une partie » ; rend l'adresse de la table.
export async function ouvrirTable(p, nomDuJeu) {
  await aller(p, '#/jouer');
  await p.page.locator('.game-card').filter({ has: p.page.getByRole('heading', { name: nomDuJeu, exact: true }) }).getByRole('button', { name: /^Jouer/ }).click();
  await p.page.getByRole('dialog').getByRole('button', { name: 'Créer une partie' }).click();
  await p.page.locator('.lobby-card').waitFor();
  return hashDe(p);
}

export async function rejoindre(p, adresse) {
  await aller(p, adresse);
  await p.page.getByRole('button', { name: 'Rejoindre la partie' }).click();
  await p.page.locator('.lobby-seat:not(.empty)').nth(1).waitFor();
}
