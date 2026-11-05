// Tables de jeu : salon, places, lancement, coups, minuteurs, fin et revanche. Ne connaît pas Socket.IO.
// Les tables vivent en mémoire et sont recopiées en base à chaque changement : une partie survit à un redémarrage.
import { db } from './db.js';
import { games, cleanOptions } from './games.js';
import { ChatError } from './chat.js';

const tables = new Map(); // id -> { id, game, hostId, status, seats, left, options, state, createdAt, updatedAt }
const MAX_OPEN_PER_HOST = 3;

const save = db.prepare(
  `INSERT INTO game_tables (id, game, host_id, status, seats, left_ids, options, state, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET host_id = excluded.host_id, status = excluded.status, seats = excluded.seats,
     left_ids = excluded.left_ids, options = excluded.options, state = excluded.state, updated_at = excluded.updated_at`,
);

export function loadTables() {
  for (const r of db.prepare('SELECT * FROM game_tables').all()) {
    if (!games.has(r.game)) continue; // jeu retiré du dossier games/ : la table attend son retour
    tables.set(r.id, {
      id: r.id,
      game: r.game,
      hostId: r.host_id,
      status: r.status,
      seats: JSON.parse(r.seats),
      left: JSON.parse(r.left_ids || '[]'),
      options: JSON.parse(r.options),
      state: r.state ? JSON.parse(r.state) : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  }
  return [...tables.values()];
}

function persist(t) {
  t.updatedAt = Date.now();
  save.run(t.id, t.game, t.hostId, t.status, JSON.stringify(t.seats), JSON.stringify(t.left), JSON.stringify(t.options),
    t.state === null ? null : JSON.stringify(t.state), t.createdAt, t.updatedAt);
}

function remove(t) {
  tables.delete(t.id);
  db.prepare('DELETE FROM game_tables WHERE id = ?').run(t.id);
  db.prepare('DELETE FROM messages WHERE scope = ?').run(`t:${t.id}`);
  db.prepare('DELETE FROM reads WHERE scope = ?').run(`t:${t.id}`);
}

export function getTable(id) {
  const t = tables.get(Number(id));
  if (!t) throw new ChatError("Cette table n'existe plus.");
  return t;
}

export const tableExists = (id) => tables.has(Number(id));
export const allTables = () => [...tables.values()];
const gameOf = (t) => games.get(t.game);
const ctx = () => ({ now: Date.now(), random: Math.random });

// Les règles lèvent une Error avec un message en français quand un coup est refusé ; le reste est un bug.
function runRules(fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof ChatError) throw err;
    if (err?.constructor === Error && err.message) throw new ChatError(err.message);
    console.error(err);
    throw new ChatError('Le jeu a rencontré une erreur. Réessaie, ou préviens un admin.');
  }
}

// Statut normalisé : à qui de jouer (liste d'ids), qui peut agir en plus (coups libres : dénoncer, « prêt »…),
// fin, gagnants, échéance du minuteur.
export function statusOf(t) {
  if (t.status === 'lobby' || !t.state) return { turn: [], may: [], over: false, winners: [], deadline: null };
  const s = gameOf(t).rules.status(t.state) || {};
  const list = (v) => (v === null || v === undefined ? [] : [].concat(v));
  const turn = list(s.turn);
  return {
    turn: s.over ? [] : turn,
    may: s.over ? [] : [...new Set([...turn, ...list(s.may)])],
    over: Boolean(s.over),
    winners: [].concat(s.winners || []),
    label: s.over && typeof s.label === 'string' ? s.label : null, // texte de fin fourni par le jeu (un gagnant qui n'est pas un compte)
    deadline: !s.over && Number.isFinite(s.deadline) ? s.deadline : null,
  };
}

export function summary(t) {
  // `may` reste sur le serveur : il peut dépendre de rôles secrets (les loups, la voyante…).
  const { turn, over, winners, label, deadline } = statusOf(t);
  return {
    id: t.id, game: t.game, hostId: t.hostId, status: t.status, seats: t.seats, left: t.left, kicked: t.kicked ?? [], options: t.options,
    turn, over, winners, label, deadline, createdAt: t.createdAt, updatedAt: t.updatedAt,
  };
}

// Ce que voit une personne : sa vue de joueur si elle est assise, sinon celle des spectateurs.
export function viewFor(t, userId) {
  if (!t.state) return null;
  const seated = t.seats.includes(userId);
  return runRules(() => gameOf(t).rules.view(t.state, seated ? userId : null));
}

function players(t) {
  const get = db.prepare('SELECT id, pseudo FROM users WHERE id = ?');
  return t.seats.map((id) => get.get(id) || { id, pseudo: 'Compte supprimé' });
}

function mustHost(t, userId) {
  if (t.hostId !== userId) throw new ChatError("Seul l'hôte de la table peut faire ça.");
}

function mustLobby(t) {
  if (t.status !== 'lobby') throw new ChatError('La partie a déjà commencé.');
}

// Applique le résultat d'un coup ou d'un minuteur, et passe la table en « terminée » si besoin.
function apply(t, result) {
  if (!result || typeof result !== 'object' || !('state' in result)) throw new ChatError('Le jeu a renvoyé un état invalide.');
  t.state = result.state;
  if (statusOf(t).over) t.status = 'over';
  persist(t);
  return result.events || [];
}

// ——— Actions ———

export function createTable(gameId, userId) {
  const game = games.get(gameId);
  if (!game) throw new ChatError('Jeu inconnu.');
  const open = [...tables.values()].filter((t) => t.hostId === userId && t.status !== 'over').length;
  if (open >= MAX_OPEN_PER_HOST) throw new ChatError(`Tu as déjà ${MAX_OPEN_PER_HOST} tables ouvertes : termines-en ou ferme-en une.`);
  const now = Date.now();
  const options = cleanOptions(game, {});
  const id = Number(db.prepare(
    `INSERT INTO game_tables (game, host_id, status, seats, options, state, created_at, updated_at)
     VALUES (?, ?, 'lobby', ?, ?, NULL, ?, ?)`,
  ).run(gameId, userId, JSON.stringify([userId]), JSON.stringify(options), now, now).lastInsertRowid);
  const t = { id, game: gameId, hostId: userId, status: 'lobby', seats: [userId], left: [], options, state: null, createdAt: now, updatedAt: now };
  tables.set(id, t);
  return t;
}

export function joinTable(id, userId) {
  const t = getTable(id);
  mustLobby(t);
  if (t.seats.includes(userId)) return t;
  if (t.kicked?.includes(userId)) throw new ChatError('L’hôte t’a retiré de cette table.');
  if (t.seats.length >= gameOf(t).maxPlayers) throw new ChatError('La table est complète. Tu peux regarder la partie.');
  t.seats.push(userId);
  persist(t);
  return t;
}

// Quitter : dans le salon on libère sa place ; en partie, on abandonne (si le jeu le permet).
// Renvoie null quand la table a disparu (plus personne).
export function leaveTable(id, userId) {
  const t = getTable(id);
  if (!t.seats.includes(userId)) return t;
  if (t.status === 'playing') {
    const { rules } = gameOf(t);
    if (t.left.includes(userId)) throw new ChatError('Tu as déjà quitté cette partie.');
    if (typeof rules.leave !== 'function') throw new ChatError('Ce jeu ne permet pas d’abandonner en cours de partie.');
    const result = runRules(() => rules.leave(t.state, userId, ctx()));
    t.left = [...t.left, userId];
    apply(t, result);
    return t;
  }
  t.seats = t.seats.filter((x) => x !== userId);
  t.left = t.left.filter((x) => x !== userId);
  if (!t.seats.length) {
    remove(t);
    return null;
  }
  if (t.hostId === userId) t.hostId = t.seats[0];
  persist(t);
  return t;
}

export function kickPlayer(id, userId, targetId) {
  const t = getTable(id);
  mustHost(t, userId);
  mustLobby(t);
  if (targetId === userId) throw new ChatError('Pour partir, utilise « Quitter la table ».');
  t.seats = t.seats.filter((x) => x !== targetId);
  t.kicked = [...(t.kicked ?? []), targetId]; // gardé en mémoire : le salon ne dure pas
  persist(t);
  return t;
}

export function setOptions(id, userId, options) {
  const t = getTable(id);
  mustHost(t, userId);
  mustLobby(t);
  t.options = cleanOptions(gameOf(t), { ...t.options, ...options });
  persist(t);
  return t;
}

export function startTable(id, userId) {
  const t = getTable(id);
  mustHost(t, userId);
  mustLobby(t);
  const game = gameOf(t);
  if (t.seats.length < game.minPlayers) {
    throw new ChatError(`Il faut au moins ${game.minPlayers} joueurs pour lancer ${game.name}.`);
  }
  const problem = game.rules.checkStart?.(players(t), t.options);
  if (problem) throw new ChatError(problem);
  t.state = runRules(() => game.rules.setup(players(t), t.options, ctx()));
  t.left = [];
  t.status = 'playing';
  if (statusOf(t).over) t.status = 'over';
  persist(t);
  return t;
}

export function playMove(id, userId, action) {
  const t = getTable(id);
  if (t.status !== 'playing') throw new ChatError(t.status === 'lobby' ? "La partie n'a pas commencé." : 'La partie est terminée.');
  if (!t.seats.includes(userId)) throw new ChatError('Tu regardes cette partie : seuls les joueurs jouent.');
  if (t.left.includes(userId)) throw new ChatError('Tu as quitté cette partie : tu la regardes maintenant.');
  if (!statusOf(t).may.includes(userId)) throw new ChatError("Ce n'est pas ton tour.");
  const events = apply(t, runRules(() => gameOf(t).rules.move(t.state, userId, action ?? {}, ctx())));
  return { table: t, events };
}

// Minuteur échu : le jeu décide (passer le tour, voter au hasard…). Sans timeout(), rien ne se passe.
export function runTimeout(id) {
  const t = tables.get(Number(id));
  if (!t || t.status !== 'playing') return null;
  const { rules } = gameOf(t);
  const { deadline } = statusOf(t);
  if (!deadline || deadline > Date.now() + 50 || typeof rules.timeout !== 'function') return null;
  const events = apply(t, runRules(() => rules.timeout(t.state, ctx())));
  return { table: t, events };
}

// Revanche : la table revient au salon avec les mêmes joueurs et réglages.
export function restartTable(id, userId) {
  const t = getTable(id);
  mustHost(t, userId);
  if (t.status !== 'over') throw new ChatError('La partie n’est pas terminée.');
  t.seats = t.seats.filter((id) => !t.left.includes(id));
  if (!t.seats.includes(t.hostId)) t.seats.unshift(t.hostId);
  t.left = [];
  t.status = 'lobby';
  t.state = null;
  persist(t);
  return t;
}

export function closeTable(id, user) {
  const t = getTable(id);
  if (t.hostId !== user.id && user.role !== 'admin') throw new ChatError("Seul l'hôte ou un admin peut fermer la table.");
  remove(t);
}

// Un compte supprimé ou bloqué libère ses places dans les salons. Un compte supprimé quitte aussi les parties en cours
// (par abandon, si le jeu le permet) et les parties terminées, et laisse son rôle d'hôte à un autre joueur.
export function dropUser(userId, { deleted = false } = {}) {
  const changed = [];
  for (const t of [...tables.values()]) {
    if (!t.seats.includes(userId) && t.hostId !== userId) continue;
    let table = t;
    let touched = false;
    if (t.seats.includes(userId)) {
      if (t.status === 'lobby') {
        table = leaveTable(t.id, userId);
        touched = true;
      } else if (deleted && t.status === 'playing') {
        try {
          table = leaveTable(t.id, userId);
          touched = true;
        } catch (err) {
          // Le jeu ne permet pas d'abandonner : la place reste, avec « Compte supprimé » (un vrai bogue est seulement journalisé).
          if (!(err instanceof ChatError)) console.error(err);
        }
      } else if (deleted && t.status === 'over') {
        touched = true;
        t.seats = t.seats.filter((x) => x !== userId);
        t.left = t.left.filter((x) => x !== userId);
        if (t.seats.length) persist(t);
        else {
          remove(t);
          table = null;
        }
      }
    }
    if (deleted && table && table.hostId === userId) {
      const next = table.seats.find((x) => x !== userId);
      if (next) {
        table.hostId = next;
        persist(table);
        touched = true;
      }
    }
    if (touched) changed.push({ id: t.id, table });
  }
  return changed;
}

// Ménage : salons inactifs depuis 12 h, parties terminées depuis 3 jours, parties abandonnées depuis 14 jours.
// Les parties terminées d'un hôte ne s'accumulent pas dans la liste de toute la classe : on garde les 5 dernières.
export function trimFinished(hostId) {
  const over = [...tables.values()].filter((t) => t.hostId === hostId && t.status === 'over').sort((a, b) => b.updatedAt - a.updatedAt);
  const removed = over.slice(5);
  removed.forEach(remove);
  return removed.map((t) => t.id);
}

export const lobbies = () => [...tables.values()].filter((t) => t.status === 'lobby');
export function dropLobby(t) {
  remove(t);
}

export function purgeStaleTables() {
  const now = Date.now();
  const limits = { lobby: 12 * 3600_000, over: 3 * 86400_000, playing: 14 * 86400_000 };
  const removed = [];
  for (const t of [...tables.values()]) {
    if (now - t.updatedAt > limits[t.status]) {
      remove(t);
      removed.push(t.id);
    }
  }
  return removed;
}
