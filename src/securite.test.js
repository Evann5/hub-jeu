// Tests des garde-fous de sécurité qui se vérifient sans navigateur : node --test src/securite.test.js
// La base utilisée est un dossier temporaire (DATA_DIR) : jamais celle du hub.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLimiter, createEventLimiter, sameOrigin, safeEqual, passwordProblem } from './securite.js';

const dataDir = mkdtempSync(join(tmpdir(), 'hubuno-secu-'));
process.env.DATA_DIR = dataDir;
process.env.ADMINS = 'chef,second,trần';
after(() => rmSync(dataDir, { recursive: true, force: true }));

const MIN = 60_000;

// ——— Limiteur par clé ———

test('limiteur : bloque au-delà du maximum puis laisse passer quand la fenêtre est finie', () => {
  const l = createLimiter({ max: 3, windowMs: 15 * MIN });
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) {
    assert.equal(l.blocked('a', t0 + i), false);
    l.hit('a', t0 + i);
  }
  assert.equal(l.blocked('a', t0 + 10), true);
  assert.equal(l.blocked('b', t0 + 10), false, 'une autre clé n’est pas touchée');
  assert.equal(l.blocked('a', t0 + 15 * MIN - 1), true, 'une milliseconde avant la fin de la fenêtre');
  assert.equal(l.blocked('a', t0 + 15 * MIN), false, 'fenêtre terminée');
});

test('limiteur : undo rend un essai, clear remet à zéro', () => {
  const l = createLimiter({ max: 2, windowMs: MIN });
  l.hit('a', 0); l.hit('a', 1);
  assert.equal(l.blocked('a', 2), true);
  l.undo('a', 3);
  assert.equal(l.blocked('a', 4), false);
  l.hit('a', 5);
  l.clear('a');
  assert.equal(l.size, 0);
});

test('limiteur : la table est plafonnée à 10 000 entrées, nettoyée, puis les nouvelles clés sont refusées', () => {
  const l = createLimiter({ max: 10, windowMs: 15 * MIN, cap: 10_000 });
  for (let i = 0; i < 20_000; i++) l.hit(`ip${i}`, 1000);
  assert.equal(l.size, 10_000, 'jamais plus que le plafond');
  assert.equal(l.blocked('nouvelle-cle', 1001), true, 'table pleine : 429 pour une clé nouvelle');
  assert.equal(l.blocked('ip0', 1001), false, 'une clé déjà connue reste traitée normalement');
  // Une fois les entrées périmées, le nettoyage libère la place.
  assert.equal(l.blocked('nouvelle-cle', 1000 + 15 * MIN + 1), false);
  assert.equal(l.size, 0);
});

// ——— Limiteur d'événements ———

test('limiteur d’événements : 60 par 5 secondes, puis de nouveau permis', () => {
  const l = createEventLimiter(60, 5000);
  let refused = 0;
  for (let i = 0; i < 70; i++) if (l.hit('u1', 1000 + i)) refused++;
  assert.equal(refused, 10);
  assert.equal(l.hit('u2', 1100), false, 'par personne');
  assert.equal(l.hit('u1', 1000 + 5000 + 70), false, 'après la fenêtre');
});

test('limiteur d’événements : un rythme normal ne l’atteint jamais', () => {
  const l = createEventLimiter(60, 5000);
  // Une personne qui fait 5 actions par seconde pendant une minute (bien plus qu’une partie normale).
  for (let t = 0; t < 60_000; t += 200) assert.equal(l.hit('u', t), false);
});

// ——— Origine, comparaison ———

test('origine : illisible ou étrangère refusée sans exception', () => {
  assert.equal(sameOrigin(undefined, 'hub.test'), true);
  assert.equal(sameOrigin('https://hub.test', 'hub.test'), true);
  assert.equal(sameOrigin('https://autre.test', 'hub.test'), false);
  for (const bad of ['null', 'http://[::bad', 'chrome-extension://abc', '%', ' ']) {
    assert.doesNotThrow(() => sameOrigin(bad, 'hub.test'));
    assert.equal(sameOrigin(bad, 'hub.test'), false, bad);
  }
});

test('comparaison en temps constant', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
});

// ——— Mots de passe ———

test('mots de passe : 10 caractères au moins, motdepasse1 reste accepté', () => {
  assert.match(passwordProblem('abcd12345', 'zoe'), /au moins 10 caractères/);
  assert.equal(passwordProblem('motdepasse1', 'zoe'), null);
  assert.equal(passwordProblem('Motdepasse123', 'zoe'), null);
  assert.equal(passwordProblem('phrase longue et originale', 'zoe'), null);
});

test('mots de passe : refus d’un seul caractère répété, du pseudo, des plus courants', () => {
  assert.match(passwordProblem('aaaaaaaaaaaa', 'zoe'), /un seul caractère/);
  assert.match(passwordProblem('1111111111', 'zoe'), /un seul caractère/);
  assert.match(passwordProblem('xxMarcelinxx', 'Marcelin'), /pseudo/);
  assert.match(passwordProblem('MARCELIN-2026', 'marcelin'), /pseudo/);
  assert.match(passwordProblem('azertyuiop', 'zoe'), /courants/);
  assert.match(passwordProblem('Password123', 'zoe'), /courants/);
  assert.match(passwordProblem('1234567890', 'zoe'), /courants/);
});

test('mots de passe : trop long refusé', () => {
  assert.match(passwordProblem('a1'.repeat(70), 'zoe'), /trop long/);
  assert.equal(passwordProblem('a1'.repeat(64), 'zoe'), null);
});

// ——— Comptes (base temporaire) ———

const auth = await import('./auth.js');
const { db } = await import('./db.js');
const chat = await import('./chat.js');

test('cookie mal encodé : pas d’exception, pas de session', () => {
  assert.equal(auth.readCookie('hubuno_session=%', auth.COOKIE), null);
  assert.equal(auth.readCookie('hubuno_session=%E0%A4%A', auth.COOKIE), null);
  assert.equal(auth.readCookie('a=1; hubuno_session=abc%20def', auth.COOKIE), 'abc def');
  assert.equal(auth.readCookie(undefined, auth.COOKIE), null);
});

test('hachage asynchrone : bon mot de passe accepté, mauvais refusé, pseudo inconnu refusé sans erreur', async () => {
  const hash = await auth.hashPassword('motdepasse1');
  assert.match(hash, /^scrypt\$/);
  assert.equal(await auth.checkPassword('motdepasse1', hash), true);
  assert.equal(await auth.checkPassword('motdepasse2', hash), false);
  assert.equal(await auth.checkPassword('motdepasse1', undefined), false, 'pseudo inconnu : faux haché, toujours « non »');
  assert.equal(await auth.checkPassword('motdepasse1', 'pas-un-hache'), false);
});

test('hachage : beaucoup de calculs à la fois aboutissent tous (limités à 2 en parallèle)', async () => {
  const hash = await auth.hashPassword('parallele-1');
  const results = await Promise.all(Array.from({ length: 12 }, () => auth.checkPassword('parallele-1', hash)));
  assert.deepEqual(results, Array(12).fill(true));
});

test('le calcul ne bloque pas la boucle principale', async () => {
  const hash = await auth.hashPassword('boucle-libre');
  let ticks = 0;
  const timer = setInterval(() => ticks++, 5);
  await Promise.all(Array.from({ length: 6 }, () => auth.checkPassword('boucle-libre', hash)));
  clearInterval(timer);
  assert.ok(ticks >= 5, `la boucle a continué de tourner (${ticks} battements)`);
});

test('connexion : clé coupée à 40 caractères, 10 échecs par pseudo puis un essai par minute, 500 par adresse', () => {
  const longA = `${'x'.repeat(40)}AAAA`;
  for (let i = 0; i < 10; i++) auth.recordAttempt('1.1.1.1', `${'x'.repeat(40)}${i}`); // pseudos différents après 40 caractères
  const t0 = Date.now();
  assert.equal(auth.tooManyFailures('1.1.1.1', longA, t0), false, 'bloqué : un essai par minute reste permis');
  assert.equal(auth.tooManyFailures('1.1.1.1', longA, t0 + 1000), true, 'même clé une fois coupée');
  assert.equal(auth.tooManyFailures('1.1.1.1', longA, t0 + 61_000), false, 'une minute plus tard');
  assert.equal(auth.tooManyFailures('1.1.1.2', longA), false, 'autre adresse');
  for (let i = 0; i < 29; i++) auth.recordAttempt('2.2.2.2', `pseudo${i}`);
  assert.equal(auth.tooManyFailures('2.2.2.2', 'encore-un-autre'), false, 'un élève seul ne bloque pas la classe');
  for (let i = 29; i < 500; i++) auth.recordAttempt('2.2.2.2', `pseudo${i}`);
  assert.equal(auth.tooManyFailures('2.2.2.2', 'encore-un-autre'), true, 'compteur par adresse seule');
  auth.recordSuccess('3.3.3.3', 'zoe');
  assert.equal(auth.tooManyFailures('3.3.3.3', 'zoe'), false);
});

test('inscription : 40 mauvais codes par adresse, puis refus', () => {
  for (let i = 0; i < 40; i++) {
    assert.equal(auth.badCodeBlocked('4.4.4.4'), false);
    auth.recordBadCode('4.4.4.4');
  }
  assert.equal(auth.badCodeBlocked('4.4.4.4'), true);
  assert.equal(auth.badCodeBlocked('4.4.4.5'), false);
  for (let i = 0; i < 60; i++) auth.recordSignup('5.5.5.5');
  assert.equal(auth.signupBlocked('5.5.5.5'), true);
  auth.refundSignup('5.5.5.5');
  assert.equal(auth.signupBlocked('5.5.5.5'), false);
});

test('code de classe : comparaison sans casse ni espaces autour', () => {
  assert.equal(auth.codeMatches(' TEST1234 ', 'test1234'), true);
  assert.equal(auth.codeMatches('test1235', 'test1234'), false);
  assert.equal(auth.codeMatches('', 'test1234'), false);
});

test('mot de passe d’un compte : validatePassword utilise le minimum de 10 et le pseudo', () => {
  assert.match(auth.validatePassword('abcd12345', 'zoe'), /10 caractères/);
  assert.equal(auth.validatePassword('motdepasse1', 'zoe'), null);
  assert.match(auth.validatePassword('zoe-et-zoe-2026', 'zoe-et-zoe'), /pseudo/);
});

test('propriétaire : le premier admin créé, quel que soit l’ordre des inscriptions', async () => {
  const passHash = await auth.hashPassword('motdepasse1');
  assert.equal(auth.ownerId(), null, 'pas d’admin au départ');
  auth.createUser({ pseudo: 'eleve', passHash });
  const second = auth.createUser({ pseudo: 'second', passHash }); // dans ADMINS : admin, mais pas le premier
  const chef = auth.createUser({ pseudo: 'Chef', passHash });
  assert.equal(second.role, 'admin');
  assert.equal(chef.role, 'admin');
  assert.equal(auth.ownerId(), second.id, 'le premier admin créé est le propriétaire');
});

test('identifiants : un compte supprimé ne redonne jamais son numéro', async () => {
  const passHash = await auth.hashPassword('motdepasse1');
  const a = auth.createUser({ pseudo: 'passager1', passHash });
  db.prepare('DELETE FROM users WHERE id = ?').run(a.id);
  const b = auth.createUser({ pseudo: 'passager2', passHash });
  assert.ok(b.id > a.id, `${b.id} doit être plus grand que ${a.id}`);
});

test('suppression d’un compte : messages privés et lectures effacés, ceux des autres conservés', async () => {
  const passHash = await auth.hashPassword('motdepasse1');
  const u = auth.createUser({ pseudo: 'partant', passHash });
  const v = auth.createUser({ pseudo: 'reste', passHash });
  const w = auth.createUser({ pseudo: 'autre', passHash });
  const dmUV = chat.dmScope(u.id, v.id);
  const dmVW = chat.dmScope(v.id, w.id);
  chat.postMessage(dmUV, u.id, 'privé de u');
  chat.postMessage(dmUV, v.id, 'privé de v à u');
  chat.postMessage(dmVW, v.id, 'privé de v à w');
  chat.markRead(u.id, dmUV, 1);
  chat.markRead(v.id, dmUV, 2);
  chat.markRead(v.id, dmVW, 3);
  chat.deleteUserData(u.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  const count = (sql, ...a) => db.prepare(sql).get(...a).n;
  assert.equal(count('SELECT COUNT(*) n FROM messages WHERE scope = ?', dmUV), 0);
  assert.equal(count('SELECT COUNT(*) n FROM reads WHERE scope = ?', dmUV), 0);
  assert.equal(count('SELECT COUNT(*) n FROM messages WHERE scope = ?', dmVW), 1, 'la conversation des autres reste');
  assert.equal(count('SELECT COUNT(*) n FROM reads WHERE scope = ?', dmVW), 1);
});

test('conversation : un scope qui n’est pas du texte est refusé proprement', () => {
  for (const bad of [['c:1'], { a: 1 }, 12, null, undefined]) {
    assert.throws(() => chat.checkScope(bad, 1), chat.ChatError);
  }
});

test('conversation : une seule écriture par conversation', () => {
  const me = auth.createUser({ pseudo: 'scope-a', passHash: 'x' }).id;
  const other = auth.createUser({ pseudo: 'scope-b', passHash: 'x' }).id;
  const channel = chat.listChannels()[0].id;
  assert.doesNotThrow(() => chat.checkScope(`c:${channel}`, me));
  assert.doesNotThrow(() => chat.checkScope(`dm:${Math.min(me, other)}:${Math.max(me, other)}`, me));
  for (const bad of [`c:0${channel}`, `c:${channel}:99`, `dm:0${Math.min(me, other)}:${Math.max(me, other)}`, `t:007`, 'c:99999999999999999999']) {
    assert.throws(() => chat.checkScope(bad, me), chat.ChatError, bad);
  }
});

test('pseudos : accents acceptés, lettres qui en imitent une autre refusées', () => {
  for (const ok of ['Élodie', 'Trần', 'Zoé_02', 'a.b-c']) assert.equal(auth.validatePseudo(ok), null, ok);
  for (const bad of ['ｚｚ-a', 'zɑ-a', 'мinh', 'zz a', 'ᴀbc']) assert.notEqual(auth.validatePseudo(bad), null, bad);
});

test('pseudos : un sosie d’un membre ou d’un admin est considéré comme pris', () => {
  auth.createUser({ pseudo: 'Olivia', passHash: 'x' });
  for (const taken of ['olivia', 'OLIVIA', 'Ólivia', '0livia', 'O1ivia', 'Oiivia']) assert.equal(auth.pseudoTaken(taken), true, taken);
  assert.equal(auth.pseudoTaken('Olivier'), false);
  assert.equal(auth.pseudoTaken('sec0nd'), true); // le sosie d'un admin (ADMINS), même pas encore inscrit
  for (const sosie of ['se.cond', 'sec_ond', 'sec-ond']) assert.equal(auth.pseudoTaken(sosie), true, sosie);
  assert.equal(auth.pseudoTaken('O-l-i-v-i-a'), true);
  assert.equal(auth.pseudoTaken('Trần'), false); // un admin au pseudo accentué peut s'inscrire
  assert.equal(auth.pseudoTaken('Tràn'), true); // pas son sosie
});
