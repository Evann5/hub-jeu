// Démarrage comme sur O2Switch : Passenger charge server.js avec require(), pas avec import.
// Un « await » au premier niveau de server.js ferait échouer ce chargement (ERR_REQUIRE_ASYNC_MODULE) : l'appli ne démarrerait pas.
// La base utilisée est un dossier temporaire (DATA_DIR) : jamais celle du hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');

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

test('server.js démarre quand il est chargé par require(), comme le fait Passenger', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'hubuno-demarrage-'));
  const port = await portLibre();
  const env = { ...process.env, DATA_DIR: dataDir, PORT: String(port), HOST: '127.0.0.1', CLASS_CODE: 'test-classe-1234' };
  delete env.BASE_PATH;
  delete env.NODE_ENV;
  const proc = spawn(process.execPath, ['-e', "require('./server.js')"], { cwd: racine, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = '';
  proc.stdout.on('data', (d) => { journal += d; });
  proc.stderr.on('data', (d) => { journal += d; });
  try {
    const fin = Date.now() + 20_000;
    while (!/écoute sur le port/.test(journal) && proc.exitCode === null && Date.now() < fin) await new Promise((r) => setTimeout(r, 50));
    assert.match(journal, /écoute sur le port/, `le serveur n'a pas démarré :\n${journal}`);
    const page = await fetch(`http://127.0.0.1:${port}/api/options`);
    assert.equal(page.status, 200);
  } finally {
    await new Promise((ok) => { if (proc.exitCode !== null) return ok(); proc.once('exit', ok); proc.kill('SIGKILL'); });
    rmSync(dataDir, { recursive: true, force: true });
  }
});
