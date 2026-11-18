// Stats de la classe et succès des profils, tirés des résultats des parties terminées (table game_results).
// Seules les parties à 2 joueurs ou plus comptent : une partie seul ne fait gagner ni série ni succès.
import { db } from './db.js';

const insert = db.prepare('INSERT OR IGNORE INTO game_results (table_id, round, game, user_id, won, players, at) VALUES (?, ?, ?, ?, ?, ?, ?)');

// Une partie vient de se terminer : une ligne par joueur (gagnant ou non). Rejouée deux fois, la même manche n'est comptée qu'une fois.
export function recordResults(t, winners) {
  const seats = t.seats.filter((id) => Number.isInteger(id));
  if (seats.length < 2) return false;
  const won = new Set(winners.filter((id) => Number.isInteger(id)));
  const at = Date.now();
  const round = t.startedAt ?? t.createdAt ?? 0;
  let added = 0;
  for (const id of seats) added += insert.run(t.id, round, t.game, id, won.has(id) ? 1 : 0, seats.length, at).changes;
  return added > 0;
}

export function forgetUser(userId) {
  db.prepare('DELETE FROM game_results WHERE user_id = ?').run(Number(userId));
}

// Les succès : un nom, une icône, ce qu'il faut faire, et où on en est (value / goal).
const BADGES = [
  { id: 'premiere', icon: '🏅', name: 'Première victoire', text: 'Gagner une partie', goal: 1, of: (s) => s.wins },
  { id: 'dix', icon: '🥉', name: 'Dix victoires', text: 'Gagner 10 parties', goal: 10, of: (s) => s.wins },
  { id: 'cinquante', icon: '🥈', name: 'Cinquante victoires', text: 'Gagner 50 parties', goal: 50, of: (s) => s.wins },
  { id: 'cent', icon: '🥇', name: 'Cent victoires', text: 'Gagner 100 parties', goal: 100, of: (s) => s.wins },
  { id: 'serie3', icon: '🔥', name: 'En série', text: 'Gagner 3 parties d’affilée', goal: 3, of: (s) => s.bestStreak },
  { id: 'serie5', icon: '⚡', name: 'Inarrêtable', text: 'Gagner 5 parties d’affilée', goal: 5, of: (s) => s.bestStreak },
  { id: 'serie10', icon: '👑', name: 'Légende', text: 'Gagner 10 parties d’affilée', goal: 10, of: (s) => s.bestStreak },
  { id: 'touche', icon: '🎯', name: 'Touche-à-tout', text: 'Gagner à 5 jeux différents', goal: 5, of: (s) => s.gamesWon },
  { id: 'collection', icon: '🧩', name: 'Collectionneur', text: 'Gagner à 10 jeux différents', goal: 10, of: (s) => s.gamesWon },
  { id: 'specialiste', icon: '⭐', name: 'Spécialiste', text: 'Gagner 10 fois au même jeu', goal: 10, of: (s) => s.bestGameWins },
  { id: 'habitue', icon: '🎲', name: 'Habitué', text: 'Jouer 25 parties', goal: 25, of: (s) => s.played },
  { id: 'pilier', icon: '🏛️', name: 'Pilier du hub', text: 'Jouer 100 parties', goal: 100, of: (s) => s.played },
];

// Une suite de résultats, du plus ancien au plus récent -> meilleure série et série en cours.
function streaks(list) {
  let best = 0;
  let run = 0;
  for (const r of list) {
    run = r.won ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { best, current: run };
}

export function userStats(userId) {
  const rows = db.prepare('SELECT game, won FROM game_results WHERE user_id = ? ORDER BY at, table_id').all(Number(userId));
  const perGame = new Map();
  for (const r of rows) {
    const g = perGame.get(r.game) ?? { game: r.game, played: 0, wins: 0 };
    g.played += 1;
    g.wins += r.won;
    perGame.set(r.game, g);
  }
  const { best, current } = streaks(rows);
  const games = [...perGame.values()].sort((a, b) => b.wins - a.wins || b.played - a.played);
  const s = {
    played: rows.length,
    wins: rows.reduce((n, r) => n + r.won, 0),
    bestStreak: best,
    streak: current,
    gamesWon: games.filter((g) => g.wins > 0).length,
    bestGameWins: games[0]?.wins ?? 0,
    topGames: games.slice(0, 3),
  };
  s.badges = BADGES.map((b) => {
    const value = b.of(s);
    return { id: b.id, icon: b.icon, name: b.name, text: b.text, goal: b.goal, value: Math.min(value, b.goal), earned: value >= b.goal };
  });
  return s;
}

const DAY = 86400_000;

// Le bandeau de la page Jouer : séries en cours, meilleurs gagnants du mois, dernières victoires, jeu de la semaine.
export function classStats(now = Date.now()) {
  const alive = 'user_id IN (SELECT id FROM users WHERE banned = 0)';
  // Séries en cours : les derniers résultats de chacun, du plus récent au plus ancien, jusqu'à la première défaite.
  const recent = db.prepare(`SELECT user_id, won FROM game_results WHERE ${alive} ORDER BY at DESC, table_id DESC LIMIT 5000`).all();
  const runs = new Map();
  const stopped = new Set();
  for (const r of recent) {
    if (stopped.has(r.user_id)) continue;
    if (r.won) runs.set(r.user_id, (runs.get(r.user_id) ?? 0) + 1);
    else stopped.add(r.user_id);
  }
  const streaks = [...runs].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([userId, n]) => ({ userId, streak: n }));
  const leaders = db.prepare(`SELECT user_id AS userId, SUM(won) AS wins, COUNT(*) AS played FROM game_results
    WHERE at >= ? AND ${alive} GROUP BY user_id HAVING wins > 0 ORDER BY wins DESC, played ASC LIMIT 5`).all(now - 30 * DAY);
  const lastWins = db.prepare(`SELECT user_id AS userId, game, at FROM game_results WHERE won = 1 AND ${alive} ORDER BY at DESC LIMIT 6`).all();
  const week = db.prepare('SELECT game, COUNT(DISTINCT table_id || \':\' || round) AS n FROM game_results WHERE at >= ? GROUP BY game ORDER BY n DESC LIMIT 1').get(now - 7 * DAY);
  const weekGames = db.prepare('SELECT COUNT(DISTINCT table_id || \':\' || round) AS n FROM game_results WHERE at >= ?').get(now - 7 * DAY).n;
  return { streaks, leaders, lastWins, topGame: week ? { game: week.game, n: week.n } : null, weekGames };
}
