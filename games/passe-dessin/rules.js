// Passe-Dessin : le téléphone arabe en dessins. Chacun écrit une phrase ; elle passe au voisin, qui la dessine ; le suivant
// décrit le dessin sans voir la phrase ; le suivant dessine cette description… À la fin, on découvre ensemble chaque chaîne,
// de la phrase de départ au dernier mot, dans l'album. Pas de points : on rit, on met des cœurs.
// Les règles sont pures : l'heure vient de ctx.now, jamais de Date.now().
//
// Une partie = des étapes jouées en même temps par tout le monde. Il y a une chaîne par joueur (celle qu'il commence).
// À l'étape k, le joueur de la place i travaille sur la chaîne (i − k) mod n : chacun touche chaque chaîne une seule fois.
// Ce qu'on fait dépend de la dernière entrée de la chaîne : une phrase -> on la dessine ; un dessin -> on le décrit.
// Phases : « play » (les étapes), « album » (l'hôte dévoile les chaînes une entrée après l'autre), « over ».

export const TEXT_MAX = 80;
export const PALETTE_SIZE = 12;
export const WIDTHS = 4;
export const MAX_STROKES = 400;
export const MAX_POINTS_PER_STROKE = 500;
export const MAX_POINTS_TOTAL = 4000;
export const GRACE_MS = 3000; // le navigateur envoie son brouillon à l'heure dite ; le serveur attend un peu avant de passer à la suite
export const ALBUM_MS = 25_000; // l'hôte qui ne clique pas : l'album avance tout seul
export const LIKE_MAX = 300; // cœurs au plus dans une partie (garde-fou : chaque cœur renvoie l'album à tout le monde)

const active = (s) => s.players.filter((id) => !s.left.includes(id));
const seatOf = (s, id) => s.players.indexOf(id);
const chainAt = (s, id, step) => ((seatOf(s, id) - step) % s.players.length + s.players.length) % s.players.length;
const playerAt = (s, chain, step) => s.players[(chain + step) % s.players.length];
const lastReal = (chain) => [...chain.entries].reverse().find((e) => e.kind !== 'skip') ?? null;

// Ce que le joueur doit faire sur une chaîne : écrire la phrase de départ, dessiner une phrase, ou décrire un dessin.
function taskOf(chain) {
  const last = lastReal(chain);
  if (!last) return 'write';
  return last.kind === 'text' ? 'draw' : 'guess';
}

function stepLength(s, step) {
  if (step === 0) return s.options.writeSec * 1000;
  // Une étape où au moins une personne dessine dure le temps d'un dessin.
  const drawing = s.chains.some((c) => taskOf(c) === 'draw');
  return (drawing ? s.options.drawSec : s.options.writeSec) * 1000;
}

const pickChoice = (value, allowed, fallback) => (allowed.includes(Number(value)) ? Number(value) : fallback);

export function setup(players, options, ctx) {
  const ids = players.map((p) => p.id);
  const opts = {
    writeSec: pickChoice(options.writeSec, [30, 45, 60, 90], 45),
    drawSec: pickChoice(options.drawSec, [60, 90, 120, 180], 90),
    steps: pickChoice(options.steps, [0, 4, 6, 8], 0),
  };
  const steps = opts.steps ? Math.min(opts.steps, ids.length) : ids.length;
  const s = {
    players: ids,
    left: [],
    options: opts,
    steps,
    phase: 'play',
    step: 0,
    stepEnds: 0,
    chains: ids.map((owner) => ({ owner, entries: [] })),
    done: [], // qui a rendu sa copie à l'étape en cours
    pending: {}, // id -> entrée rendue (mise dans la chaîne à la fin de l'étape : on peut encore la modifier)
    album: { chain: 0, shown: 0 },
    albumAt: 0,
    likes: {}, // « chaîne:entrée » -> ids
    likeCount: 0,
  };
  return { ...s, stepEnds: ctx.now + stepLength(s, 0) };
}

// ——— Les copies ———

function cleanStrokes(raw) {
  if (!Array.isArray(raw)) throw new Error('Dessin invalide.');
  if (raw.length > MAX_STROKES) throw new Error('Trop de traits : simplifie un peu ton dessin.');
  let total = 0;
  const out = raw.map((st) => {
    const c = Number(st?.c);
    const w = Number(st?.w);
    if (!Number.isInteger(c) || c < -1 || c >= PALETTE_SIZE) throw new Error('Couleur inconnue.');
    if (!Number.isInteger(w) || w < 0 || w >= WIDTHS) throw new Error('Épaisseur inconnue.');
    const p = st?.p;
    if (!Array.isArray(p) || p.length < 2 || p.length % 2 !== 0) throw new Error('Trait invalide.');
    if (p.length > MAX_POINTS_PER_STROKE * 2) throw new Error('Trait trop long : lève le crayon plus souvent.');
    total += p.length / 2;
    return {
      c,
      w,
      p: p.map((v) => {
        const n = Number(v);
        if (!Number.isFinite(n)) throw new Error('Trait invalide.');
        return Math.min(1000, Math.max(0, Math.round(n)));
      }),
    };
  });
  if (total > MAX_POINTS_TOTAL) throw new Error('Dessin trop chargé : simplifie un peu (moins de petits traits).');
  return out;
}

function cleanText(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (text.length > TEXT_MAX) throw new Error(`${TEXT_MAX} caractères au plus.`);
  return text;
}

// La copie d'un joueur pour l'étape en cours. auto : envoyée par le navigateur à la fin du temps (vide = rien rendu).
function entryFrom(s, id, action) {
  const task = taskOf(s.chains[chainAt(s, id, s.step)]);
  if (task === 'draw') {
    const strokes = cleanStrokes(action.strokes);
    if (!strokes.length && !action.auto) throw new Error('Dessine quelque chose avant de valider.');
    return strokes.length ? { by: id, kind: 'drawing', strokes } : { by: id, kind: 'skip' };
  }
  const text = cleanText(action.text);
  if (!text && !action.auto) throw new Error(task === 'guess' ? 'Écris ce que tu vois sur le dessin.' : 'Écris une phrase à faire dessiner.');
  return text ? { by: id, kind: 'text', text } : { by: id, kind: 'skip' };
}

// Fin d'une étape : les copies vont dans leur chaîne (une copie manquante = une case passée), puis étape suivante ou album.
function closeStep(s, ctx) {
  const chains = s.chains.map((c) => ({ ...c, entries: [...c.entries] }));
  for (let ci = 0; ci < chains.length; ci++) {
    const id = playerAt(s, ci, s.step);
    chains[ci].entries.push(s.pending[id] ?? { by: id, kind: 'skip' });
  }
  const next = { ...s, chains, done: [], pending: {} };
  if (s.step + 1 >= s.steps) return startAlbum(next, ctx);
  return beginStep({ ...next, step: s.step + 1 }, ctx);
}

// Une étape commence : ceux qui sont partis passent leur tour d'office.
function beginStep(s, ctx) {
  const t = { ...s, stepEnds: ctx.now + stepLength(s, s.step) };
  const gone = s.players.filter((id) => s.left.includes(id));
  return maybeClose({ ...t, done: [...new Set([...t.done, ...gone])] }, ctx);
}

const maybeClose = (s, ctx) => (active(s).every((id) => s.done.includes(id)) ? closeStep(s, ctx) : s);

const visible = (chain) => chain.entries.map((e, i) => ({ ...e, i })).filter((e) => e.kind !== 'skip');

function startAlbum(s, ctx) {
  const first = s.chains.findIndex((c) => visible(c).length);
  if (first < 0) return { ...s, phase: 'over', albumAt: 0 };
  return { ...s, phase: 'album', album: { chain: first, shown: 1 }, albumAt: ctx.now + ALBUM_MS };
}

const host = (s) => active(s)[0] ?? null;

// L'album avance d'une entrée ; au bout d'une chaîne, on passe à la suivante (qui a quelque chose à montrer) ; à la fin, c'est fini.
function albumNext(s, ctx) {
  const { chain, shown } = s.album;
  if (shown < visible(s.chains[chain]).length) return { ...s, album: { chain, shown: shown + 1 }, albumAt: ctx.now + ALBUM_MS };
  const next = s.chains.findIndex((c, i) => i > chain && visible(c).length);
  if (next < 0) return { ...s, phase: 'over', albumAt: 0 };
  return { ...s, album: { chain: next, shown: 1 }, albumAt: ctx.now + ALBUM_MS };
}

// ——— Les coups ———
// { type: 'submit', text }            écrire la phrase de départ, ou décrire le dessin reçu
// { type: 'submit', strokes }         dessiner la phrase reçue (traits : couleur 0..11 ou −1 gomme, épaisseur 0..3, points 0..1000)
//   auto: true                        envoyé par le navigateur à la fin du temps : une copie vide est acceptée (case passée)
// { type: 'edit' }                    reprendre sa copie tant que l'étape n'est pas finie
// { type: 'next' }                    album : l'hôte dévoile la suite
// { type: 'like', chain, entry }      album : un cœur sur une entrée (ou l'enlever)
export function move(s, playerId, action, ctx) {
  if (s.phase === 'over') throw new Error('La partie est terminée.');
  if (!s.players.includes(playerId) || s.left.includes(playerId)) throw new Error('Tu ne joues pas dans cette partie.');
  const type = action?.type;
  if (s.phase === 'play') {
    if (type === 'submit') {
      if (s.done.includes(playerId)) throw new Error('C’est déjà envoyé : clique sur « Modifier » pour changer.');
      const entry = entryFrom(s, playerId, action);
      return { state: maybeClose({ ...s, done: [...s.done, playerId], pending: { ...s.pending, [playerId]: entry } }, ctx) };
    }
    if (type === 'edit') {
      if (!s.done.includes(playerId)) return { state: s };
      const pending = { ...s.pending };
      delete pending[playerId];
      return { state: { ...s, done: s.done.filter((id) => id !== playerId), pending } };
    }
    throw new Error('Termine d’abord ton étape.');
  }
  // album
  if (type === 'next') {
    if (playerId !== host(s)) throw new Error('C’est l’hôte qui fait défiler l’album.');
    return { state: albumNext(s, ctx) };
  }
  if (type === 'like') {
    const chain = Number(action.chain);
    const entry = Number(action.entry);
    const c = s.chains[chain];
    const e = c?.entries[entry];
    if (!e || e.kind === 'skip' || !isShown(s, chain, entry)) throw new Error('Cette page n’est pas encore dévoilée.');
    if (e.by === playerId) throw new Error('Pas de cœur pour soi-même !');
    const key = `${chain}:${entry}`;
    const list = s.likes[key] ?? [];
    const on = !list.includes(playerId);
    if (on && s.likeCount >= LIKE_MAX) throw new Error('Assez de cœurs pour cette partie !');
    return {
      state: {
        ...s,
        likes: { ...s.likes, [key]: on ? [...list, playerId] : list.filter((id) => id !== playerId) },
        likeCount: s.likeCount + (on ? 1 : 0),
      },
    };
  }
  throw new Error('Coup inconnu.');
}

// Une entrée est-elle déjà dévoilée dans l'album ?
function isShown(s, chain, entry) {
  if (s.phase === 'over') return true;
  if (s.phase !== 'album') return false;
  if (chain < s.album.chain) return true;
  if (chain > s.album.chain) return false;
  return visible(s.chains[chain]).slice(0, s.album.shown).some((e) => e.i === entry);
}

export function timeout(s, ctx) {
  if (s.phase === 'play') return { state: closeStep(s, ctx) };
  if (s.phase === 'album') return { state: albumNext(s, ctx) };
  return { state: s };
}

// Abandon : la copie en cours devient une case passée ; les étapes suivantes le sautent. Moins de deux joueurs : on file à l'album.
export function leave(s, playerId, ctx) {
  if (s.phase === 'over' || s.left.includes(playerId) || !s.players.includes(playerId)) return { state: s };
  let t = { ...s, left: [...s.left, playerId] };
  if (t.phase === 'play') {
    if (active(t).length < 2) {
      // On arrête les étapes : ce qui est rendu reste, le reste est passé.
      const chains = t.chains.map((c, ci) => ({ ...c, entries: [...c.entries, t.pending[playerAt(t, ci, t.step)] ?? { by: playerAt(t, ci, t.step), kind: 'skip' }] }));
      return { state: startAlbum({ ...t, chains, done: [], pending: {} }, ctx) };
    }
    const pending = { ...t.pending };
    delete pending[playerId];
    t = { ...t, pending, done: [...new Set([...t.done, playerId])] };
    return { state: maybeClose(t, ctx) };
  }
  if (!active(t).length) return { state: { ...t, phase: 'over' } };
  return { state: t };
}

export function status(s) {
  if (s.phase === 'over') return { turn: null, over: true, winners: [], deadline: null, label: 'Toutes les chaînes sont dévoilées.' };
  if (s.phase === 'album') {
    const h = host(s);
    return { turn: h === null ? [] : [h], may: active(s).filter((id) => id !== h), over: false, winners: [], deadline: s.albumAt };
  }
  const waiting = active(s).filter((id) => !s.done.includes(id));
  return { turn: waiting, may: active(s).filter((id) => s.done.includes(id)), over: false, winners: [], deadline: s.stepEnds + GRACE_MS };
}

// ——— Ce que voit chaque personne ———
// Pendant les étapes : seulement ce qu'on a reçu à faire (la dernière entrée de sa chaîne), et qui a fini. Jamais les autres chaînes.
// Pendant l'album : les entrées déjà dévoilées. À la fin : tout.
export function view(s, playerId) {
  const out = {
    phase: s.phase,
    players: s.players,
    left: s.left,
    options: s.options,
    step: s.step,
    steps: s.steps,
    done: s.done,
  };
  if (s.phase === 'play') {
    out.stepEnds = s.stepEnds;
    const mine = s.players.includes(playerId) && !s.left.includes(playerId);
    if (mine) {
      const chain = s.chains[chainAt(s, playerId, s.step)];
      const task = taskOf(chain);
      const last = lastReal(chain);
      out.task = {
        kind: task,
        prompt: task === 'draw' ? { text: last.text, by: last.by } : task === 'guess' ? { strokes: last.strokes, by: last.by } : null,
        restart: task === 'write' && s.step > 0, // la chaîne n'a rien gardé (tout le monde est parti avant) : on repart d'une phrase
      };
      out.sent = s.pending[playerId] ?? null; // ma copie déjà rendue (pour « Modifier »)
    }
    return out;
  }
  const likesFor = (ci, ei) => s.likes[`${ci}:${ei}`] ?? [];
  out.host = host(s);
  out.album = s.phase === 'album' ? s.album : null;
  out.albumAt = s.phase === 'album' ? s.albumAt : null;
  out.chains = s.chains.map((c, ci) => ({
    owner: c.owner,
    total: visible(c).length,
    entries: visible(c).filter((e) => isShown(s, ci, e.i)).map((e) => ({
      i: e.i,
      by: e.by,
      kind: e.kind,
      text: e.text,
      strokes: e.strokes,
      likes: likesFor(ci, e.i).length,
      liked: likesFor(ci, e.i).includes(playerId),
    })),
  }));
  return out;
}
