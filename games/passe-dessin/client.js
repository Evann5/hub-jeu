// Passe-Dessin côté navigateur : un carnet à spirale sur fond rose. À chaque étape, une page à remplir (écrire, dessiner ou
// décrire) ; à la fin, l'album des chaînes, page après page.
// Les dessins restent dans le navigateur jusqu'à « J'ai fini » (ou la fin du temps) : personne ne les voit avant l'album.
// Coordonnées des traits : x et y de 0 à 1000 (la feuille garde ses proportions 4:3).
import { IDEAS } from './client/idees.js';

const COLORS = ['#1B1B1F', '#FFFFFF', '#E53935', '#FF8A00', '#FFD21F', '#3CC46B', '#0FA3A3', '#2F7BFF', '#7C4DFF', '#FF5FA2', '#8D5A3B', '#9AA0A6'];
const COLOR_NAMES = ['Noir', 'Blanc', 'Rouge', 'Orange', 'Jaune', 'Vert', 'Turquoise', 'Bleu', 'Violet', 'Rose', 'Marron', 'Gris'];
const WIDTHS = [5, 12, 24, 48];
const WIDTH_NAMES = ['très fin', 'fin', 'moyen', 'gros'];
const ERASER = 1.6;
const PAPER = '#FFFFFF';
const ASPECT = 0.75;
const MIN_STEP = 3;
const MAX_POINTS_PER_STROKE = 480;
const MAX_POINTS_TOTAL = 3900; // un peu sous la limite du serveur (4000)
const TEXT_MAX = 80;
const AUTO_SEND_MS = 600; // la copie part toute seule juste avant la fin du temps
const PATHS = {
  pen: 'M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
  eraser: 'm7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21 M22 21H7 M5 11l9 9',
  undo: 'M9 14 4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  trash: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M8.5 8.5h.01 M15.5 8.5h.01 M12 12h.01 M8.5 15.5h.01 M15.5 15.5h.01',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z',
  check: 'M20 6 9 17l-5-5',
  next: 'M5 12h14 M13 6l6 6-6 6',
};

function ico(name) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
  svg.classList.add('pd-ico');
  const d = document.createElementNS(NS, 'path');
  d.setAttribute('d', PATHS[name]);
  svg.append(d);
  return svg;
}

// Dessine des traits sur un contexte 2D de largeur W (la hauteur suit les 4:3).
function paintStrokes(g, strokes, W, H) {
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);
  for (const s of strokes) {
    const k = W / 1000;
    const color = s.c < 0 ? PAPER : COLORS[s.c];
    const w = WIDTHS[s.w] * (s.c < 0 ? ERASER : 1) * k;
    const n = s.p.length / 2;
    if (!n) continue;
    const X = (i) => s.p[2 * i] * k;
    const Y = (i) => (s.p[2 * i + 1] * H) / 1000;
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (n === 1) {
      g.beginPath();
      g.arc(X(0), Y(0), w / 2, 0, Math.PI * 2);
      g.fill();
      continue;
    }
    g.beginPath();
    g.moveTo(X(0), Y(0));
    for (let i = 1; i < n - 1; i++) g.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
    g.lineTo(X(n - 1), Y(n - 1));
    g.stroke();
  }
}

// Un dessin fini, en image fixe (album, dessin à décrire).
function staticDrawing(h, strokes, label) {
  const c = h('canvas.pd-pic', { role: 'img', 'aria-label': label });
  c.width = 800;
  c.height = 600;
  paintStrokes(c.getContext('2d'), strokes, 800, 600);
  return c;
}

const pointsOf = (strokes) => strokes.reduce((n, s) => n + s.p.length / 2, 0);

export function mount(root, api) {
  const { h } = api;
  const name = (id) => (id === api.me.id ? 'Toi' : api.user(id)?.pseudo ?? '?');
  const pseudo = (id) => api.user(id)?.pseudo ?? '?';
  let v = null;
  let stageKey = null;
  let autoSent = false;
  let busy = false;
  const pics = new Map(); // « chaîne:page » -> image déjà dessinée (l'album se redessine à chaque cœur)

  // ——— Le carnet ———
  const title = h('h2.pd-title');
  const sub = h('p.pd-sub');
  const bar = h('div.pd-timebar', { role: 'timer', 'aria-label': 'Temps restant' }, h('i'));
  const secs = h('span.pd-secs');
  const head = h('header.pd-head', h('div.pd-head-text', title, sub), secs);
  const progress = h('ol.pd-progress', { 'aria-label': 'Qui a fini' });
  const stage = h('section.pd-stage');
  const book = h('div.pd-book', head, bar, stage, progress);
  const live = h('p.pd-sr', { 'aria-live': 'polite' });
  root.append(h('div.pd', book), live);

  const send = (action) => {
    if (busy) return Promise.resolve();
    busy = true;
    return api.sendMove(action).catch(() => {}).finally(() => { busy = false; });
  };

  // ——— Écrire (phrase de départ ou description d'un dessin) ———
  const textInput = h('input.pd-input', {
    type: 'text', maxLength: TEXT_MAX, autocomplete: 'off', spellcheck: true, enterKeyHint: 'done', 'aria-label': 'Ta phrase',
    oninput: () => { count.textContent = `${textInput.value.length}/${TEXT_MAX}`; },
  });
  const count = h('span.pd-count', `0/${TEXT_MAX}`);
  const textForm = h('form.pd-write', {
    onsubmit: (e) => {
      e.preventDefault();
      const text = textInput.value.trim();
      if (!text) { textInput.focus(); return; }
      send({ type: 'submit', text });
    },
  }, h('div.pd-field', textInput, count));

  // ——— Dessiner ———
  let strokes = [];
  let local = null;
  let tool = { color: 0, width: 1, eraser: false };
  const canvas = h('canvas.pd-canvas', { role: 'img', 'aria-label': 'Ta feuille de dessin' });
  const g = canvas.getContext('2d');
  const sheet = h('div.pd-sheet', canvas);
  const repaint = () => {
    if (!canvas.width) return;
    paintStrokes(g, local ? [...strokes, local] : strokes, canvas.width, canvas.height);
  };
  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(sheet.clientWidth * dpr);
    const hh = Math.round(w * ASPECT);
    if (w && (canvas.width !== w || canvas.height !== hh)) {
      canvas.width = w;
      canvas.height = hh;
    }
    repaint();
  };
  const resizer = new ResizeObserver(fit);
  resizer.observe(sheet);
  const canDraw = () => v?.phase === 'play' && v.task?.kind === 'draw' && !v.sent;
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    return [Math.min(1000, Math.max(0, ((e.clientX - r.left) / r.width) * 1000)), Math.min(1000, Math.max(0, ((e.clientY - r.top) / r.height) * 1000))];
  };
  const full = () => pointsOf(strokes) + (local ? local.p.length / 2 : 0) >= MAX_POINTS_TOTAL;
  function addPoint([x, y]) {
    const p = local.p;
    const n = p.length;
    if (n >= 2 && Math.hypot(x - p[n - 2], (y - p[n - 1]) * ASPECT) < MIN_STEP) return;
    if (full()) return;
    p.push(Math.round(x), Math.round(y));
    if (p.length / 2 >= MAX_POINTS_PER_STROKE) { // trait très long : on le coupe en deux traits qui se touchent
      strokes.push(local);
      local = { c: local.c, w: local.w, p: [Math.round(x), Math.round(y)], pointer: local.pointer };
    }
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (!canDraw() || local || e.button > 0) return;
    if (full()) { api.toast('La feuille est pleine : efface un peu ou valide ton dessin.'); return; }
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    local = { c: tool.eraser ? -1 : tool.color, w: tool.width, p: [], pointer: e.pointerId };
    addPoint(at(e));
    repaint();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!local || e.pointerId !== local.pointer) return;
    e.preventDefault();
    for (const ev of e.getCoalescedEvents?.().length ? e.getCoalescedEvents() : [e]) addPoint(at(ev));
    repaint();
  });
  const finish = (e) => {
    if (!local || e.pointerId !== local.pointer) return;
    const s = local;
    local = null;
    if (s.p.length >= 2) strokes.push({ c: s.c, w: s.w, p: s.p });
    repaint();
    markTools();
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const colorBtns = COLORS.map((c, i) => h('button.pd-color', {
    type: 'button', role: 'radio', 'aria-label': COLOR_NAMES[i], title: COLOR_NAMES[i], style: `--sw:${c}`,
    onclick: () => { tool = { ...tool, color: i, eraser: false }; markTools(); },
  }));
  const widthBtns = WIDTHS.map((w, i) => h('button.pd-width', {
    type: 'button', role: 'radio', 'aria-label': `Trait ${WIDTH_NAMES[i]}`, title: `Trait ${WIDTH_NAMES[i]}`,
    onclick: () => { tool = { ...tool, width: i }; markTools(); },
  }, h('span', { style: `--d:${Math.max(4, Math.round(w / 2))}px` })));
  const penBtn = h('button.pd-tool', { type: 'button', 'aria-label': 'Crayon', title: 'Crayon', onclick: () => { tool = { ...tool, eraser: false }; markTools(); } }, ico('pen'));
  const eraserBtn = h('button.pd-tool', { type: 'button', 'aria-label': 'Gomme', title: 'Gomme', onclick: () => { tool = { ...tool, eraser: true }; markTools(); } }, ico('eraser'));
  const undoBtn = h('button.pd-tool', { type: 'button', 'aria-label': 'Annuler le dernier trait', title: 'Annuler (Ctrl+Z)', onclick: () => { strokes.pop(); repaint(); markTools(); } }, ico('undo'));
  const clearBtn = h('button.pd-tool', {
    type: 'button', 'aria-label': 'Tout effacer', title: 'Tout effacer',
    onclick: () => { if (strokes.length) { strokes = []; repaint(); markTools(); } },
  }, ico('trash'));
  function markTools() {
    colorBtns.forEach((b, i) => b.setAttribute('aria-checked', String(!tool.eraser && tool.color === i)));
    widthBtns.forEach((b, i) => b.setAttribute('aria-checked', String(tool.width === i)));
    penBtn.setAttribute('aria-pressed', String(!tool.eraser));
    eraserBtn.setAttribute('aria-pressed', String(tool.eraser));
    undoBtn.disabled = !strokes.length;
    clearBtn.disabled = !strokes.length;
    drawDone.disabled = !strokes.length;
  }
  const drawDone = h('button.pd-btn', { type: 'button', onclick: () => strokes.length && send({ type: 'submit', strokes: strokes.map(({ c, w, p }) => ({ c, w, p })) }) }, ico('check'), 'J’ai fini');
  const tools = h('div.pd-tools',
    h('div.pd-colors', { role: 'radiogroup', 'aria-label': 'Couleur' }, colorBtns),
    h('div.pd-tools-row',
      h('div.pd-widths', { role: 'radiogroup', 'aria-label': 'Épaisseur' }, widthBtns),
      h('div.pd-actions', penBtn, eraserBtn, undoBtn, clearBtn)));
  const onKey = (e) => {
    if (!canDraw()) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); strokes.pop(); repaint(); markTools(); }
  };
  document.addEventListener('keydown', onKey);

  // ——— Pendant les étapes ———
  const taskTitle = (t) => (t.kind === 'draw' ? 'Dessine cette phrase' : t.kind === 'guess' ? 'Qu’est-ce que c’est ?' : t.restart ? 'Écris une nouvelle phrase' : 'Écris une phrase');
  function playStage() {
    const t = v.task;
    if (!t) {
      return [h('div.pd-wait', h('p.pd-big', 'Les joueurs remplissent leur page…'), h('p', 'Tu regardes : l’album s’ouvrira à la fin, pour tout le monde.'))];
    }
    if (v.sent) {
      const waiting = v.players.filter((id) => !v.left.includes(id) && !v.done.includes(id));
      return [h('div.pd-wait',
        h('p.pd-big', 'C’est envoyé !'),
        h('p', waiting.length ? `On attend ${waiting.map(pseudo).join(', ')}.` : 'L’étape suivante arrive…'),
        h('button.pd-btn.pd-btn-ghost', { type: 'button', onclick: () => send({ type: 'edit' }) }, 'Modifier ma page'))];
    }
    if (t.kind === 'draw') {
      return [
        h('div.pd-prompt', h('small', `Phrase de ${name(t.prompt.by)}`), h('p', t.prompt.text)),
        sheet,
        tools,
        h('div.pd-row-end', drawDone),
      ];
    }
    textInput.placeholder = t.kind === 'guess' ? 'Décris le dessin en une phrase' : 'Ex. : Un chat qui fait du ski';
    textInput.setAttribute('aria-label', t.kind === 'guess' ? 'Ce que tu vois sur le dessin' : 'Ta phrase à faire dessiner');
    const nodes = [];
    if (t.kind === 'guess') nodes.push(h('div.pd-guess', h('small', `Dessin de ${name(t.prompt.by)}`), staticDrawing(h, t.prompt.strokes, `Le dessin de ${pseudo(t.prompt.by)}`)));
    else nodes.push(h('p.pd-lead', t.restart ? 'Cette chaîne est vide : lance-la avec une phrase.' : 'Une phrase un peu folle, que ton voisin va devoir dessiner.'));
    nodes.push(textForm, h('div.pd-row-end',
      t.kind === 'write' ? h('button.pd-btn.pd-btn-ghost', {
        type: 'button',
        onclick: () => {
          textInput.value = IDEAS[Math.floor(Math.random() * IDEAS.length)];
          count.textContent = `${textInput.value.length}/${TEXT_MAX}`;
          textInput.focus();
        },
      }, ico('dice'), 'Une idée') : null,
      h('button.pd-btn', { type: 'button', onclick: () => textForm.requestSubmit() }, ico('check'), 'Valider')));
    return nodes;
  }

  // ——— L'album ———
  const picOf = (ci, e) => {
    const key = `${ci}:${e.i}`;
    if (!pics.has(key)) pics.set(key, staticDrawing(h, e.strokes, `Dessin de ${pseudo(e.by)}`));
    return pics.get(key);
  };
  const canLike = () => v.phase === 'album' && v.players.includes(api.me.id) && !v.left.includes(api.me.id);
  // « Léa a dessiné », « Tu as vu »…
  const did = (e) => {
    const verb = e.kind === 'drawing' ? 'dessiné' : e.i === 0 ? 'écrit' : 'vu';
    return e.by === api.me.id ? `Tu as ${verb}` : `${pseudo(e.by)} a ${verb}`;
  };
  function page(ci, e, fresh) {
    const like = e.by !== api.me.id && canLike()
      ? h(`button.pd-like${e.liked ? '.is-on' : ''}`, {
        type: 'button', 'aria-pressed': String(e.liked), 'aria-label': e.liked ? 'Retirer mon cœur' : 'Mettre un cœur',
        onclick: () => send({ type: 'like', chain: ci, entry: e.i }),
      }, ico('heart'), e.likes ? String(e.likes) : null)
      : e.likes ? h('span.pd-like.is-static', ico('heart'), String(e.likes)) : null;
    return h(`li.pd-page.is-${e.kind}${fresh ? '.is-fresh' : ''}`,
      h('div.pd-page-by', api.token(api.user(e.by), { size: 's' }), h('span', did(e)), like),
      e.kind === 'drawing' ? h('div.pd-page-pic', picOf(ci, e)) : h('p.pd-page-text', e.text));
  }
  let browse = 0; // chaîne regardée une fois l'album fini
  function albumStage() {
    const over = v.phase === 'over';
    const ci = over ? browse : v.album.chain;
    const chain = v.chains[ci];
    const isHost = v.host === api.me.id;
    const nodes = [];
    if (over) {
      const tabs = v.chains.map((c, i) => (c.total ? h('button.pd-chip', {
        type: 'button', role: 'tab', 'aria-selected': String(i === ci),
        onclick: () => { browse = i; render(); },
      }, api.token(api.user(c.owner), { size: 's' }), pseudo(c.owner)) : null));
      nodes.push(h('div.pd-chips', { role: 'tablist', 'aria-label': 'Les chaînes' }, tabs));
      nodes.push(favorites());
    }
    nodes.push(h('h3.pd-chain-title', chain.owner === api.me.id ? 'Ta chaîne' : `La chaîne de ${pseudo(chain.owner)}`, h('small', `${chain.entries.length}/${chain.total}`)));
    nodes.push(h('ol.pd-pages', chain.entries.map((e, k) => page(ci, e, !over && k === chain.entries.length - 1))));
    if (!over) {
      const last = chain.entries.length >= chain.total;
      const moreChains = v.chains.some((c, i) => i > ci && c.total);
      const label = !last ? 'Page suivante' : moreChains ? 'Chaîne suivante' : 'Fermer l’album';
      nodes.push(h('div.pd-row-end', isHost
        ? h('button.pd-btn', { type: 'button', onclick: () => send({ type: 'next' }) }, label, ico('next'))
        : h('p.pd-muted', `${pseudo(v.host)} tourne les pages de l’album.`)));
    }
    return nodes;
  }
  // Les pages qui ont reçu le plus de cœurs.
  function favorites() {
    const all = v.chains.flatMap((c, ci) => c.entries.map((e) => ({ ci, e }))).filter((x) => x.e.likes > 0).sort((a, b) => b.e.likes - a.e.likes).slice(0, 3);
    if (!all.length) return null;
    return h('section.pd-favs', h('h3', 'Coups de cœur'), h('ol.pd-fav-list', all.map(({ ci, e }) => h('li',
      h('button.pd-fav', { type: 'button', onclick: () => { browse = ci; render(); } },
        e.kind === 'drawing' ? h('span.pd-fav-pic', staticDrawing(h, e.strokes, `Dessin de ${pseudo(e.by)}`)) : h('span.pd-fav-text', e.text),
        h('small', `${pseudo(e.by)} · ${e.likes} ♥`))))));
  }

  // ——— Dessin de l'écran ———
  function render() {
    if (!v) return;
    const playing = v.phase === 'play';
    book.classList.toggle('is-album', !playing);
    if (playing) {
      const t = v.task;
      title.textContent = t ? taskTitle(t) : 'Ça dessine…';
      sub.textContent = `Étape ${v.step + 1} sur ${v.steps}`;
    } else if (v.phase === 'album') {
      title.textContent = 'L’album';
      sub.textContent = 'Ce que chaque phrase est devenue.';
    } else {
      title.textContent = 'L’album complet';
      sub.textContent = 'Toutes les chaînes, à relire.';
    }
    bar.hidden = !playing;
    secs.hidden = !playing;
    progress.hidden = !playing;
    if (playing) {
      progress.replaceChildren(...v.players.filter((id) => !v.left.includes(id)).map((id) => h(`li${v.done.includes(id) ? '.is-done' : ''}`, { title: `${pseudo(id)}${v.done.includes(id) ? ' a fini' : ' n’a pas fini'}` },
        api.token(api.user(id), { size: 's' }), v.done.includes(id) ? h('span.pd-tick', ico('check')) : null)));
    }
    // La page à remplir n'est refaite qu'en changeant d'étape ou en envoyant : le dessin et le texte en cours restent.
    const key = playing ? `play:${v.step}:${v.task?.kind}:${Boolean(v.sent)}` : `album:${v.phase}:${JSON.stringify(v.album)}:${browse}:${v.chains.map((c) => c.entries.map((e) => `${e.likes}${e.liked ? 'x' : ''}`).join(',')).join('|')}`;
    if (key === stageKey) return;
    const stepChanged = !stageKey || stageKey.split(':').slice(0, 2).join(':') !== key.split(':').slice(0, 2).join(':');
    stageKey = key;
    if (playing && stepChanged) {
      // Nouvelle étape : page blanche.
      strokes = [];
      local = null;
      textInput.value = '';
      count.textContent = `0/${TEXT_MAX}`;
      autoSent = false;
      live.textContent = v.task ? `${taskTitle(v.task)}, étape ${v.step + 1} sur ${v.steps}.` : '';
    }
    if (playing && !v.sent && v.task && stepChanged === false && v.task.kind !== 'draw' && !textInput.value && lastSent?.text) textInput.value = lastSent.text;
    if (playing && !v.sent && v.task?.kind === 'draw' && !strokes.length && lastSent?.strokes) strokes = lastSent.strokes.map((s) => ({ ...s, p: [...s.p] }));
    lastSent = v.sent;
    stage.replaceChildren(...(playing ? playStage() : albumStage()).filter(Boolean));
    if (playing && v.task?.kind === 'draw' && !v.sent) {
      markTools();
      requestAnimationFrame(fit);
    }
    if (playing && v.task && v.task.kind !== 'draw' && !v.sent) textInput.focus({ preventScroll: true });
    if (!playing) stage.querySelector('.pd-page.is-fresh')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  let lastSent = null; // ma dernière copie envoyée : « Modifier » la remet sur la page

  // Le chrono, et l'envoi automatique de la page juste avant la fin.
  function tick() {
    if (!v || v.phase !== 'play') return;
    const total = (v.task?.kind === 'draw' ? v.options.drawSec : v.options.writeSec) * 1000;
    const left = Math.max(0, v.stepEnds - api.now());
    bar.firstChild.style.width = `${Math.min(100, (left / total) * 100)}%`;
    bar.classList.toggle('is-low', left < 10_000);
    secs.textContent = `${Math.ceil(left / 1000)} s`;
    if (v.task && !v.sent && !autoSent && left <= AUTO_SEND_MS) {
      autoSent = true;
      if (v.task.kind === 'draw') api.sendMove({ type: 'submit', auto: true, strokes: strokes.map(({ c, w, p }) => ({ c, w, p })) }).catch(() => {});
      else api.sendMove({ type: 'submit', auto: true, text: textInput.value.trim().slice(0, TEXT_MAX) }).catch(() => {});
    }
  }
  const clock = setInterval(tick, 200);

  api.onState((view) => {
    v = view;
    render();
    tick();
  });

  return () => {
    clearInterval(clock);
    resizer.disconnect();
    document.removeEventListener('keydown', onKey);
  };
}
