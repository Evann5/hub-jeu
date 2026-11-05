// Catalogue des jeux : chaque dossier de games/ qui contient game.json et rules.js (voir docs/integration.md §8).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';

export const gamesDir = join(config.root, 'games');
export const games = new Map(); // id -> { id, name, ..., rules }

const ID_RE = /^[a-z0-9-]{2,30}$/;
// Familles de la page Jouer (champ family de game.json).
const FAMILIES = ['plateau', 'cartes', 'bluff', 'ambiance'];

// Réglages proposés à l'hôte d'une table, déclarés dans game.json :
// { key, label, type: 'number' | 'bool' | 'choice', default, min?, max?, choices?: [{ value, label }] }
function cleanOptionDefs(defs = []) {
  return defs.filter((d) => d && /^[a-zA-Z]\w{0,30}$/.test(d.key) && ['number', 'bool', 'choice', 'multi'].includes(d.type));
}

export async function loadGames() {
  if (!existsSync(gamesDir)) return;
  for (const id of readdirSync(gamesDir).sort()) {
    const dir = join(gamesDir, id);
    if (!ID_RE.test(id) || !existsSync(join(dir, 'game.json')) || !existsSync(join(dir, 'rules.js'))) continue;
    try {
      const meta = JSON.parse(readFileSync(join(dir, 'game.json'), 'utf8'));
      const rules = await import(pathToFileURL(join(dir, 'rules.js')).href);
      for (const fn of ['setup', 'move', 'view', 'status']) {
        if (typeof rules[fn] !== 'function') throw new Error(`rules.js n'exporte pas ${fn}()`);
      }
      const min = Number(meta.minPlayers) || 1;
      games.set(id, {
        id,
        name: String(meta.name || id),
        tagline: String(meta.tagline || ''),
        description: String(meta.description || ''),
        how: Array.isArray(meta.how) ? meta.how.map(String) : [], // règles en quelques phrases
        minPlayers: min,
        maxPlayers: Math.max(min, Number(meta.maxPlayers) || min),
        duration: String(meta.duration || ''),
        color: /^#[0-9a-f]{6}$/i.test(meta.color) ? meta.color : '#A98BFA',
        ink: /^#[0-9a-f]{6}$/i.test(meta.ink) ? meta.ink : '#0B0B0D',
        emoji: String(meta.emoji || '🎲'),
        logo: existsSync(join(dir, 'assets', 'logo.svg')), // pictogramme d'une couleur, affiché à la place de l'emoji
        family: FAMILIES.includes(meta.family) ? meta.family : 'ambiance',
        wide: meta.wide === true, // en partie, le jeu prend toute la largeur ; joueurs et chat passent dans un panneau
        featured: meta.featured === true, // le jeu phare : une grande carte en haut de la page Jouer
        style: existsSync(join(dir, 'style.css')),
        order: Number(meta.order) || 100,
        options: cleanOptionDefs(meta.options),
        rules,
      });
    } catch (err) {
      console.error(`Jeu « ${id} » ignoré : ${err.message}`);
    }
  }
  console.log(`Jeux chargés : ${[...games.keys()].join(', ') || 'aucun'}.`);
}

// Ce que le navigateur reçoit du catalogue (sans les règles).
export function catalog() {
  return [...games.values()]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'fr'))
    .map(({ rules, order, ...meta }) => meta);
}

// Réglages d'une table : on garde les clés connues, bornées, avec les valeurs par défaut.
export function cleanOptions(game, input = {}) {
  const out = {};
  for (const d of game.options) {
    const v = input[d.key];
    if (d.type === 'number') {
      const n = Math.round(Number(v));
      out[d.key] = Number.isFinite(n) ? Math.min(d.max ?? n, Math.max(d.min ?? n, n)) : d.default;
    } else if (d.type === 'multi') {
      const valid = new Set(d.choices.map((c) => c.value));
      out[d.key] = Array.isArray(v) ? [...new Set(v)].filter((x) => valid.has(x)).slice(0, d.max ?? d.choices.length) : d.default;
    } else if (d.type === 'bool') {
      out[d.key] = typeof v === 'boolean' ? v : Boolean(d.default);
    } else {
      out[d.key] = d.choices?.some((c) => c.value === v) ? v : d.default;
    }
  }
  return out;
}
