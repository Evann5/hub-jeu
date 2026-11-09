// Croquis côté navigateur : une appli de dessin pop (fond bleu ciel, gros pinceaux, palette bonbon).
// Le dessinateur trace sur un canvas (pointeur : souris, doigt, stylet) ; chaque trait fini part au serveur,
// qui le renvoie à tout le monde dans la vue. Les devineurs tapent leurs propositions dans le jeu.
// Coordonnées normalisées : x et y de 0 à 1000 (le canvas garde ses proportions 4:3 et s'adapte à l'écran).

const COLORS = ['#231651', '#9C5B2E', '#FF3B30', '#FF8A1F', '#FFD60A', '#22D98B', '#18C8FF', '#2F6BFF', '#8B3DFF', '#FF3D9A'];
const COLOR_NAMES = ['Nuit', 'Chocolat', 'Rouge', 'Orange', 'Citron', 'Menthe', 'Turquoise', 'Bleu roi', 'Violet', 'Fuchsia'];
const WIDTHS = [8, 18, 38]; // épaisseur du trait, en unités de 0 à 1000 sur la largeur : de gros pinceaux
const WIDTH_NAMES = ['fin', 'moyen', 'gros'];
const ERASER_FACTOR = 1.8; // la gomme est plus large que le pinceau du même réglage
const PAPER = '#FFFFFF';
const ASPECT = 0.75; // hauteur / largeur
const MIN_STEP = 3; // on ignore les points plus proches que ça (en unités), pour des traits légers
const CHUNK = 300; // un trait trop long est envoyé en plusieurs morceaux (limite du serveur : 400 points)
const CHOOSE_MS = 20_000;
const REVEAL_MS = 7_000;
const ICONS = {
  Gomme: 'm7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21 M22 21H7 M5 11l9 9',
  Annuler: 'M9 14 4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  'Tout effacer': 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
};

function ico(path) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
  svg.classList.add('cr-ico');
  const d = document.createElementNS(NS, 'path');
  d.setAttribute('d', path);
  svg.append(d);
  return svg;
}

export function mount(root, api) {
  const { h } = api;
  const name = (id) => (id === api.me.id ? 'Toi' : api.user(id).pseudo);
  const spectator = api.seat < 0;

  let view = null;
  let info = null;
  let tool = { color: 0, width: 1, eraser: false };
  let local = null; // le trait en cours de tracé { c, w, p: [x, y, …] }
  let pending = []; // traits envoyés dont la vue du serveur ne contient pas encore la trace { stroke, acked }
  let phaseKey = null;
  let overlayKey = null;
  let confettiDone = false;

  // ——— Éléments fixes ———

  const canvas = h('canvas.cr-canvas', { role: 'img', 'aria-label': 'Le dessin en cours' });
  const g = canvas.getContext('2d');
  const overlay = h('div.cr-overlay', { hidden: true });
  const reveal = h('div.cr-reveal', { hidden: true, 'aria-live': 'polite' });
  const sheet = h('div.cr-sheet', canvas, overlay);
  const sheetBox = h('div.cr-sheetbox', sheet, reveal);

  const roundLabel = h('p.cr-round');
  const wordBox = h('div.cr-word');
  const secs = h('span.cr-secs', '–');
  const timer = h('div.cr-timer', { role: 'timer', 'aria-label': 'Temps restant' }, h('span.cr-ring', h('span.cr-ring-in', secs)));
  const bar = h('header.cr-bar', h('div.cr-left', roundLabel), wordBox, timer);

  const tools = h('div.cr-tools', { hidden: true });
  const guessMsg = h('p.cr-guess-msg', { 'aria-live': 'polite' });
  const guessInput = h('input.cr-guess-input', {
    type: 'text', id: 'cr-guess', maxLength: 40, autocomplete: 'off', autocapitalize: 'off', spellcheck: false,
    enterKeyHint: 'send', placeholder: 'Ta proposition…', 'aria-label': 'Ta proposition',
  });
  const guessBtn = h('button.cr-guess-btn', { type: 'submit' }, 'Proposer');
  const guessForm = h('form.cr-guess', { hidden: true, onsubmit: onGuess }, guessInput, guessBtn);
  const guessBox = h('div.cr-guess-box', guessMsg, guessForm);

  const players = h('ol.cr-players', { 'aria-label': 'Joueurs' });
  const feed = h('ul.cr-feed', { role: 'log', 'aria-label': 'Propositions' });
  const feedBox = h('div.cr-feed-box', h('h3.cr-feed-title', 'Propositions'), feed);
  const side = h('aside.cr-side', players, feedBox);
  const stage = h('section.cr-stage', sheetBox, tools, guessBox);
  const final = h('section.cr-final', { hidden: true });
  const main = h('div.cr-main', stage, final, side);
  const live = h('p.cr-sr', { 'aria-live': 'polite' });
  const cr = h('div.cr', bar, main);
  root.append(cr, live);

  // ——— Dessin ———

  function paint() {
    const W = canvas.width;
    const H = canvas.height;
    if (!W) return;
    g.fillStyle = PAPER;
    g.fillRect(0, 0, W, H);
    for (const s of view?.strokes || []) drawStroke(s, W, H);
    for (const p of pending) drawStroke(p.stroke, W, H);
    if (local) drawStroke(local, W, H);
  }

  function drawStroke(s, W, H) {
    const k = W / 1000;
    const color = s.c < 0 ? PAPER : COLORS[s.c];
    const w = WIDTHS[s.w] * (s.c < 0 ? ERASER_FACTOR : 1) * k;
    const n = s.p.length / 2;
    if (!n) return;
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
      return;
    }
    g.beginPath();
    g.moveTo(X(0), Y(0));
    for (let i = 1; i < n - 1; i++) g.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
    g.lineTo(X(n - 1), Y(n - 1));
    g.stroke();
  }

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(sheet.clientWidth * dpr);
    const hgt = Math.round(w * ASPECT);
    if (w && (canvas.width !== w || canvas.height !== hgt)) {
      canvas.width = w;
      canvas.height = hgt;
    }
    paint();
  }
  const resizer = new ResizeObserver(fit);
  resizer.observe(sheet);

  const canDraw = () => view?.phase === 'drawing' && view.drawer === api.me.id && !spectator;

  function point(e) {
    const r = canvas.getBoundingClientRect();
    return [
      Math.min(1000, Math.max(0, ((e.clientX - r.left) / r.width) * 1000)),
      Math.min(1000, Math.max(0, ((e.clientY - r.top) / r.height) * 1000)),
    ];
  }

  function addPoint([x, y]) {
    const p = local.p;
    const n = p.length;
    if (n >= 2 && Math.hypot(x - p[n - 2], (y - p[n - 1]) * ASPECT) < MIN_STEP) return;
    p.push(x, y);
    if (p.length / 2 >= CHUNK) {
      const last = [x, y];
      send(local);
      local = { c: local.c, w: local.w, p: last, pointer: local.pointer };
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!canDraw() || local || e.button > 0) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    local = { c: tool.eraser ? -1 : tool.color, w: tool.width, p: [], pointer: e.pointerId };
    addPoint(point(e));
    paint();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!local || e.pointerId !== local.pointer) return;
    e.preventDefault();
    for (const ev of e.getCoalescedEvents?.().length ? e.getCoalescedEvents() : [e]) addPoint(point(ev));
    paint();
  });
  const finish = (e) => {
    if (!local || e.pointerId !== local.pointer) return;
    if (e.type === 'pointerup' && local.p.length < 4) addPoint(point(e)); // un simple clic : un point
    const s = local;
    local = null;
    if (s.p.length >= 2) send(s);
    paint();
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function send(s) {
    const stroke = { c: s.c, w: s.w, p: s.p.map((v) => Math.round(v)) };
    const item = { stroke, acked: false };
    pending.push(item);
    api.sendMove({ type: 'stroke', ...stroke }).then(() => { item.acked = true; }).catch(() => {
      pending = pending.filter((x) => x !== item);
      paint();
    });
  }

  // ——— Outils du dessinateur ———

  function buildTools() {
    const colorButtons = COLORS.map((c, i) => h('button.cr-color', {
      type: 'button', role: 'radio', 'aria-label': COLOR_NAMES[i], title: COLOR_NAMES[i],
      onclick: () => { tool = { ...tool, color: i, eraser: false }; markTools(); },
    }, h('span.cr-dot', { style: `background:${c}` })));
    const widthButtons = WIDTHS.map((w, i) => h('button.cr-width', {
      type: 'button', role: 'radio', 'aria-label': `Trait ${WIDTH_NAMES[i]}`, title: `Trait ${WIDTH_NAMES[i]}`,
      onclick: () => { tool = { ...tool, width: i }; markTools(); },
    }, h('span.cr-nib', { style: `--s:${6 + i * 7}px` })));
    // Sur téléphone, ces trois boutons ne montrent que leur icône ; le libellé reste lu par les lecteurs d'écran.
    const labelled = (label) => [ico(ICONS[label]), h('span.cr-lbl', label)];
    const eraser = h('button.cr-btn', {
      type: 'button', 'aria-pressed': 'false',
      onclick: () => { tool = { ...tool, eraser: !tool.eraser }; markTools(); },
    }, labelled('Gomme'));
    const undo = h('button.cr-btn', { type: 'button', onclick: () => api.sendMove({ type: 'undo' }).catch(() => {}) }, labelled('Annuler'));
    const clear = h('button.cr-btn', { type: 'button', onclick: () => api.sendMove({ type: 'clear' }).catch(() => {}) }, labelled('Tout effacer'));
    tools.replaceChildren(
      h('div.cr-palette', { role: 'radiogroup', 'aria-label': 'Couleur du crayon' }, colorButtons),
      h('div.cr-row',
        h('div.cr-widths', { role: 'radiogroup', 'aria-label': 'Épaisseur du trait' }, widthButtons),
        eraser, undo, clear));
    tools.refs = { colorButtons, widthButtons, eraser };
    markTools();
  }

  function markTools() {
    const r = tools.refs;
    if (!r) return;
    r.colorButtons.forEach((b, i) => {
      const on = !tool.eraser && tool.color === i;
      b.setAttribute('aria-checked', String(on));
      b.classList.toggle('is-on', on);
    });
    r.widthButtons.forEach((b, i) => {
      b.setAttribute('aria-checked', String(tool.width === i));
      b.classList.toggle('is-on', tool.width === i);
    });
    r.eraser.setAttribute('aria-pressed', String(tool.eraser));
    r.eraser.classList.toggle('is-on', tool.eraser);
    canvas.style.cursor = tool.eraser ? 'cell' : 'crosshair';
  }
  buildTools();

  // ——— Propositions ———

  async function onGuess(e) {
    e.preventDefault();
    const text = guessInput.value.trim();
    if (!text) return;
    guessInput.value = '';
    guessInput.focus();
    api.sendMove({ type: 'guess', text }).catch(() => {
      if (!guessInput.value) guessInput.value = text; // refusé : on ne perd pas ce qui était tapé
    });
  }

  // Confettis de victoire (rien du tout si l'utilisateur préfère moins de mouvement).
  function confetti() {
    if (confettiDone || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    confettiDone = true;
    const colors = ['#FFD60A', '#FF3D9A', '#22D98B', '#8B3DFF', '#FF8A1F', '#18C8FF'];
    const box = h('div.cr-confetti', { 'aria-hidden': 'true' });
    for (let i = 0; i < 44; i++) {
      const bit = h('span');
      bit.style.setProperty('--x', `${Math.round(Math.random() * 100)}%`);
      bit.style.setProperty('--c', colors[i % colors.length]);
      bit.style.setProperty('--d', `${(Math.random() * 1.6).toFixed(2)}s`);
      bit.style.setProperty('--r', `${Math.round(Math.random() * 360)}deg`);
      box.append(bit);
    }
    final.append(box);
  }

  // ——— Mise à jour de l'écran ———

  function renderWord() {
    const v = view;
    if (v.phase === 'choosing') {
      wordBox.replaceChildren(h('span.cr-word-label', v.drawer === api.me.id ? 'Choisis un mot à dessiner' : `${name(v.drawer)} choisit un mot…`));
    } else if (v.phase === 'drawing' && v.word) {
      wordBox.replaceChildren(h('span.cr-word-label', 'Dessine'), h('strong.cr-word-plain', v.word));
    } else if (v.phase === 'drawing') {
      wordBox.replaceChildren(
        h('span.cr-word-label', 'Mot à deviner'),
        h('span.cr-mask', { role: 'img', 'aria-label': `Mot de ${v.length} caractères : ${v.mask.map((c) => (c === '_' ? 'lettre cachée' : c)).join(' ')}` },
          maskWords(v.mask).map((word) => h('span.cr-w', { 'aria-hidden': 'true' },
            word.map((c) => h(`span.cr-cell${c === '_' ? '' : '.is-shown'}`, c === '_' ? '' : c.toUpperCase()))))));
    } else if (v.phase === 'reveal') {
      wordBox.replaceChildren(h('span.cr-word-label', 'Le mot était'), h('strong.cr-word-plain', v.word));
    } else {
      wordBox.replaceChildren(h('span.cr-word-label', 'Partie terminée'));
    }
  }

  // Les lettres d'un même mot restent groupées : on ne coupe une ligne qu'entre deux mots.
  function maskWords(mask) {
    const words = [[]];
    for (const c of mask) {
      if (c === ' ') words.push([]);
      else words[words.length - 1].push(c);
    }
    return words.filter((w) => w.length);
  }

  function renderOverlay() {
    const v = view;
    const key = `${v.phase}:${v.turn}:${Boolean(v.choices)}`;
    if (key === overlayKey) return; // l'écran de choix garde son focus tant que rien ne change
    overlayKey = key;
    if (v.phase === 'choosing') {
      overlay.hidden = false;
      if (v.choices) {
        overlay.replaceChildren(
          h('p.cr-overlay-title', 'À toi de dessiner !'),
          h('p.cr-overlay-sub', 'Choisis un mot. Si tu ne choisis pas à temps, le premier mot sera pris.'),
          h('div.cr-choices', v.choices.map((w, i) => h(`button.cr-choice.c${i}`, {
            type: 'button',
            onclick: () => api.sendMove({ type: 'choose', index: i }).catch(() => {}),
          }, w))));
        overlay.querySelector('.cr-choice')?.focus({ preventScroll: true });
      } else {
        overlay.replaceChildren(
          h('p.cr-overlay-title', `${name(v.drawer)} prépare son dessin`),
          h('p.cr-overlay-sub', 'Prépare-toi à deviner !'));
      }
    } else {
      overlay.hidden = true;
      overlay.replaceChildren();
    }
    if (v.phase === 'reveal') {
      const gains = v.players.filter((id) => (v.gained[id] || 0) > 0).sort((a, b) => v.gained[b] - v.gained[a]);
      reveal.hidden = false;
      reveal.replaceChildren(
        gains.length
          ? h('ul.cr-gains', gains.map((id) => h('li', api.token(api.user(id), { size: 's' }), h('span', name(id)), h('b', `+${v.gained[id]}`))))
          : h('p.cr-reveal-none', 'Personne n’a trouvé… dommage !'));
    } else {
      reveal.hidden = true;
      reveal.replaceChildren();
    }
  }

  function renderPlayers() {
    const v = view;
    const list = v.players.map((id, seat) => ({ id, seat, score: v.scores[id] || 0, gone: v.left.includes(id) }))
      .sort((a, b) => b.score - a.score || a.seat - b.seat);
    players.replaceChildren(...list.map((p) => {
      const isDrawer = p.id === v.drawer && v.phase !== 'over';
      const found = v.phase !== 'over' && v.found.includes(p.id);
      const tag = isDrawer ? 'dessine' : found ? 'a trouvé' : p.gone ? 'parti' : '';
      return h(`li.cr-player${isDrawer ? '.is-drawer' : ''}${found ? '.is-found' : ''}${p.gone ? '.is-gone' : ''}`,
        api.token(api.user(p.id), { size: 's' }),
        h('span.cr-player-name', name(p.id), tag ? h('small', tag) : null),
        h('span.cr-score', { 'aria-label': `${p.score} point${p.score > 1 ? 's' : ''}` }, String(p.score)));
    }));
  }

  function renderFeed() {
    const v = view;
    const stick = feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 30;
    feed.replaceChildren(...(v.feed || []).map((e) => {
      if (e.kind === 'found') return h('li.cr-feed-found', `★ ${e.id === api.me.id ? 'Tu as trouvé' : `${api.user(e.id).pseudo} a trouvé`} !`);
      return h(`li.cr-feed-${e.kind}`, h('b', `${name(e.id)} : `), e.text, e.kind === 'close' ? h('em', ' (presque !)') : null);
    }));
    if (stick) feed.scrollTop = feed.scrollHeight;
  }

  function renderGuess() {
    const v = view;
    const isDrawer = v.drawer === api.me.id;
    const found = v.found.includes(api.me.id);
    const playing = v.phase === 'drawing';
    const canGuess = playing && !isDrawer && !found && !spectator;
    guessBox.hidden = isDrawer || v.phase === 'over';
    guessForm.hidden = !canGuess;
    guessInput.disabled = !canGuess;
    guessBtn.disabled = !canGuess;
    let msg = '';
    const mine = (v.feed || []).filter((e) => e.id === api.me.id);
    if (spectator) msg = 'Tu regardes la partie.';
    else if (v.phase === 'choosing') msg = isDrawer ? '' : 'Le dessin commence bientôt.';
    else if (found) msg = 'Bien joué, tu as trouvé ! Attends les autres.';
    else if (mine.length && mine[mine.length - 1].kind === 'close') msg = 'Presque ! Tu es tout près…';
    guessMsg.textContent = msg;
    guessMsg.classList.toggle('is-close', msg.startsWith('Presque'));
    guessMsg.classList.toggle('is-found', found);
    guessInput.placeholder = canGuess ? 'Ta proposition…' : '';
  }

  function renderFinal() {
    const v = view;
    const win = new Set(info.winners);
    const list = v.players.map((id, seat) => ({ id, seat, score: v.scores[id] || 0, gone: v.left.includes(id) }))
      .sort((a, b) => b.score - a.score || a.seat - b.seat);
    final.hidden = false;
    final.replaceChildren(
      h('h2.cr-final-title', 'Le classement'),
      h('ol.cr-podium', list.map((p, i) => h(`li${win.has(p.id) ? '.is-winner' : ''}`,
        h('span.cr-podium-rank', String(i + 1)),
        api.token(api.user(p.id), { size: 's' }),
        h('span.cr-podium-name', name(p.id), p.gone ? ' (parti)' : '', win.has(p.id) ? h('span.cr-medal', 'Champion !') : null),
        h('b.cr-podium-score', `${p.score} pts`)))));
    if (win.has(api.me.id)) confetti();
  }

  function renderAll() {
    const v = view;
    roundLabel.textContent = `Dessin ${Math.min(v.turn, v.totalTurns)} sur ${v.totalTurns}`;
    bar.hidden = v.phase === 'over';
    renderWord();
    renderOverlay();
    renderPlayers();
    renderFeed();
    renderGuess();
    const drawer = v.phase === 'drawing' && v.drawer === api.me.id && !spectator;
    tools.hidden = !drawer;
    cr.classList.toggle('is-drawing', drawer);
    for (const b of tools.querySelectorAll('button')) b.disabled = !drawer;
    canvas.classList.toggle('is-drawable', drawer);
    canvas.setAttribute('aria-label', drawer ? `Ta feuille de dessin : ${v.word}` : 'Le dessin en cours');
    const showMain = v.phase !== 'over';
    timer.hidden = !showMain;
    feedBox.hidden = !showMain;
    sheet.hidden = !showMain;
    stage.hidden = !showMain;
    final.hidden = showMain;
    side.hidden = !showMain;
    if (!showMain) renderFinal();
    const k = `${v.phase}:${v.turn}`;
    if (k !== phaseKey) {
      phaseKey = k;
      local = null;
      pending = [];
      if (v.phase === 'choosing') {
        live.textContent = v.drawer === api.me.id ? 'À toi de dessiner : choisis un mot.' : `${name(v.drawer)} choisit un mot.`;
      } else if (v.phase === 'drawing') {
        live.textContent = v.drawer === api.me.id ? `Dessine : ${v.word}.` : `${name(v.drawer)} dessine. À toi de deviner !`;
      } else if (v.phase === 'reveal') {
        live.textContent = `Le mot était ${v.word}.`;
      }
      // Sur ordinateur, le champ est prêt à taper ; sur téléphone on laisse le clavier fermé tant qu'on n'a pas touché le champ.
      if (v.phase === 'drawing' && !spectator && v.drawer !== api.me.id && window.matchMedia('(pointer: fine)').matches) guessInput.focus({ preventScroll: true });
    }
    // Les traits que le serveur vient de confirmer ne sont plus « en attente ».
    pending = pending.filter((p) => !p.acked);
    fit();
  }

  // ——— Horloge : un crayon qui se taille ———

  function tick() {
    if (!view || !info) return;
    const target = view.phase === 'choosing' ? view.chooseUntil : view.phase === 'drawing' ? view.endsAt : view.phase === 'reveal' ? view.revealUntil : null;
    if (!target) {
      secs.textContent = '';
      return;
    }
    const total = view.phase === 'choosing' ? CHOOSE_MS : view.phase === 'drawing' ? view.options.seconds * 1000 : REVEAL_MS;
    const left = Math.max(0, target - api.now());
    secs.textContent = `${Math.ceil(left / 1000)} s`;
    timer.style.setProperty('--left', String(Math.max(0, Math.min(1, left / total))));
    timer.classList.toggle('is-low', view.phase === 'drawing' && left <= 10_000);
  }
  const clock = setInterval(tick, 250);

  api.onState((v, i) => {
    view = v;
    info = i;
    renderAll();
    tick();
  });

  return () => {
    clearInterval(clock);
    resizer.disconnect();
  };
}
