// Petits chevaux côté navigateur : un manège de fête foraine fluo. Le circuit est une couronne de 56 ampoules,
// les échelles montent vers le toit du manège, les chevaux sont des pions bonbon numérotés (forme différente par couleur).
// Le dé est lancé par le serveur ; le joueur choisit son cheval avec les gros boutons ou en touchant le pion.

const NS = 'http://www.w3.org/2000/svg';
const VB = 640;
const C = VB / 2;
const RING = 262; // rayon du circuit
const RUNG = 32; // écart entre les barreaux de l'échelle
const LAP = 56;
const TOP = 62;

const COLORS = [
  { name: 'rose', fill: '#FF2E93', dark: '#A80F5E' },
  { name: 'jaune', fill: '#FFD400', dark: '#9A7F00' },
  { name: 'turquoise', fill: '#00D8C6', dark: '#007A70' },
  { name: 'orange', fill: '#FF7A00', dark: '#9A4500' },
];
const INK = '#1A0B3B';

const svgEl = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...kids.flat().filter(Boolean));
  return el;
};

// Forme du pion selon la couleur : rond, carré, hexagone, losange (on ne dépend pas que de la couleur).
function tokenShape(color, r) {
  switch (color) {
    case 1: return svgEl('rect', { x: -r + 2, y: -r + 2, width: 2 * r - 4, height: 2 * r - 4, rx: 7 });
    case 2: return svgEl('polygon', { points: [0, 1, 2, 3, 4, 5].map((i) => `${(r + 1) * Math.cos((i * Math.PI) / 3 + Math.PI / 6)},${(r + 1) * Math.sin((i * Math.PI) / 3 + Math.PI / 6)}`).join(' ') });
    case 3: return svgEl('rect', { x: -r + 3, y: -r + 3, width: 2 * r - 6, height: 2 * r - 6, rx: 5, transform: 'rotate(45)' });
    default: return svgEl('circle', { r });
  }
}

// Petite tête de cheval pour les boutons et les cartes.
function horseIcon() {
  const s = svgEl('svg', { viewBox: '0 0 24 24', class: 'pc-horse', 'aria-hidden': 'true', focusable: 'false' },
    svgEl('path', { d: 'M5 21c0-4 2-6 4-8-2 0-4-1-5.5-3C2.5 8.5 3.5 7 5 6l1-3 2.5 1.7C13 4 17 6 18.5 10c1 3 .5 7 .5 11z', fill: 'currentColor' }),
    svgEl('circle', { cx: 8.6, cy: 7.4, r: 0.9, fill: '#fff' }));
  return s;
}

export function mount(root, api) {
  const { h } = api;
  let v = null;
  let info = null;
  let preview = null; // cheval dont on survole le bouton : sa destination est mise en avant
  let lastRolls = -1;
  let celebrated = false;

  // ——— Éléments fixes ———
  const board = svgEl('svg', { class: 'pc-svg', viewBox: `0 0 ${VB} ${VB}`, role: 'img', 'aria-label': 'Plateau du manège : un circuit de 56 cases, quatre écuries dans les coins, quatre échelles vers le centre.' });
  const gTrack = svgEl('g');
  const gTargets = svgEl('g');
  const gTokens = svgEl('g');
  board.append(gTrack, gTargets, gTokens);

  const statusEl = h('p.pc-status', { 'aria-live': 'polite' });
  const logEl = h('p.pc-log', { 'aria-live': 'polite' });
  const dieEl = h('div.pc-die', { role: 'img', 'aria-label': 'Dé' }, Array.from({ length: 9 }, () => h('span')));
  const dieWho = h('small');
  const actionEl = h('div.pc-action');
  const timerBar = h('i');
  const timerEl = h('div.pc-timer', { hidden: true }, timerBar);
  const playersEl = h('ul.pc-players');
  const stage = h('div.pc-stage',
    h('div.pc-garland', { 'aria-hidden': 'true' }),
    h('div.pc-boardcol', h('div.pc-boardwrap', board)),
    h('div.pc-side',
      playersEl,
      h('div.pc-controls',
        timerEl,
        statusEl,
        h('div.pc-row', h('div.pc-diebox', dieEl, dieWho), actionEl),
        logEl)));
  const pc = h('div.pc', stage);
  root.append(pc);

  // ——— Géométrie ———
  const rotation = () => (v && v.you !== null && v.you >= 0 ? 90 * v.colors[v.you] : 0);
  const angle = (abs) => 90 + (abs - 55) * (360 / LAP) - rotation();
  const pt = (deg, r) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)];
  const ladderAngle = (color) => angle((14 * color + 55) % LAP);
  const stableCenter = (color) => pt(90 + 90 * color + 45 - rotation(), 352);
  const absOf = (color, p) => (14 * color + p - 1) % LAP;

  function position(seat, horse) {
    const color = v.colors[seat];
    const p = v.pos[seat][horse];
    if (p === 0) {
      const [cx, cy] = stableCenter(color);
      return { x: cx + (horse % 2 ? 20 : -20), y: cy + (horse < 2 ? -20 : 20), scale: 1 };
    }
    if (p <= LAP) {
      const [x, y] = pt(angle(absOf(color, p)), RING);
      return { x, y, scale: 1 };
    }
    const a = ladderAngle(color);
    const k = p - LAP;
    const [x, y] = pt(a, RING - RUNG * k);
    if (p < TOP) return { x, y, scale: 1 };
    // arrivés : alignés sur le dernier barreau
    const done = v.pos[seat].slice(0, horse + 1).filter((q) => q === TOP).length - 1;
    const rad = ((a + 90) * Math.PI) / 180;
    const off = (done - 1.5) * 15;
    return { x: x + off * Math.cos(rad), y: y + off * Math.sin(rad), scale: 0.72 };
  }

  // ——— Décor (redessiné seulement si l'orientation change) ———
  let drawnRot = null;
  function drawTrack() {
    const rot = rotation();
    if (drawnRot === rot) return;
    drawnRot = rot;
    gTrack.replaceChildren();
    // Deux aplats plutôt qu'un dégradé SVG, que WebKit dessinait en noir.
    gTrack.append(svgEl('circle', { cx: C, cy: C, r: RING + 30, fill: '#2A0F7A', stroke: INK, 'stroke-width': 6 }));
    gTrack.append(svgEl('circle', { cx: C, cy: C - 8, r: RING - 40, fill: '#5A27D9' }));
    gTrack.append(svgEl('circle', { cx: C, cy: C, r: RING, fill: 'none', stroke: '#1B0A52', 'stroke-width': 44 }));
    // guirlande d'ampoules autour du manège
    for (let i = 0; i < 56; i++) {
      const [x, y] = pt(angle(i), RING + 40);
      gTrack.append(svgEl('circle', { cx: x, cy: y, r: 4.6, class: `pc-bulb b${i % 4}` }));
    }
    // échelles : une bande de la couleur et 6 barreaux numérotés
    v.colors.forEach((color) => {
      const col = COLORS[color];
      const a = ladderAngle(color);
      const [x1, y1] = pt(a, RING - 12);
      const [x2, y2] = pt(a, RING - RUNG * 6);
      gTrack.append(svgEl('line', { x1, y1, x2, y2, stroke: col.fill, 'stroke-width': 30, 'stroke-linecap': 'round', opacity: 0.3 }));
      for (let k = 1; k <= 6; k++) {
        const [x, y] = pt(a, RING - RUNG * k);
        gTrack.append(svgEl('circle', { cx: x, cy: y, r: 13, fill: '#1B0A52', stroke: col.fill, 'stroke-width': 3 }));
        gTrack.append(svgEl('text', { x, y: y + 5, 'text-anchor': 'middle', class: 'pc-rung', fill: '#fff' }, k === 6 ? '★' : String(k)));
      }
    });
    // les 56 ampoules du circuit
    for (let abs = 0; abs < LAP; abs++) {
      const [x, y] = pt(angle(abs), RING);
      const startColor = [0, 1, 2, 3].find((c) => 14 * c === abs && v.colors.includes(c));
      gTrack.append(svgEl('circle', { cx: x, cy: y, r: startColor !== undefined ? 13 : 9, class: 'pc-square', fill: startColor !== undefined ? COLORS[startColor].fill : '#F4EDFF', stroke: startColor !== undefined ? INK : 'none', 'stroke-width': 3 }));
    }
    // toit du manège au centre : quatre quartiers de couleur
    const wedges = [0, 1, 2, 3].map((color) => {
      const mid = ladderAngle(color);
      const a0 = ((mid - 45) * Math.PI) / 180;
      const a1 = ((mid + 45) * Math.PI) / 180;
      const r = 46;
      const d = `M${C} ${C} L${C + r * Math.cos(a0)} ${C + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${C + r * Math.cos(a1)} ${C + r * Math.sin(a1)} Z`;
      return svgEl('path', { d, fill: COLORS[color].fill, stroke: INK, 'stroke-width': 3 });
    });
    gTrack.append(...wedges, svgEl('circle', { cx: C, cy: C, r: 12, fill: '#fff', stroke: INK, 'stroke-width': 3 }));
    // écuries dans les coins
    v.colors.forEach((color) => {
      const [x, y] = stableCenter(color);
      gTrack.append(svgEl('circle', { cx: x, cy: y, r: 54, fill: COLORS[color].fill, stroke: INK, 'stroke-width': 5 }));
      gTrack.append(svgEl('circle', { cx: x, cy: y, r: 44, fill: 'rgba(26,11,59,0.28)' }));
      for (const [dx, dy] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) gTrack.append(svgEl('circle', { cx: x + dx, cy: y + dy, r: 17, fill: 'rgba(255,255,255,0.22)' }));
    });
  }

  // ——— Pions ———
  const tokens = new Map(); // "seat-horse" -> { g, body, num }
  function tokenFor(seat, horse) {
    const key = `${seat}-${horse}`;
    if (tokens.has(key)) return tokens.get(key);
    const color = v.colors[seat];
    const col = COLORS[color];
    const body = svgEl('g', { class: 'pc-tok-body' },
      svgEl('g', { transform: 'translate(0 3)', opacity: 0.35 }, tokenShape(color, 17)),
      svgEl('g', { fill: col.fill, stroke: INK, 'stroke-width': 3.4, 'stroke-linejoin': 'round' }, tokenShape(color, 17)),
      svgEl('ellipse', { cx: -5, cy: -8, rx: 6, ry: 3, fill: '#fff', opacity: 0.6, transform: 'rotate(-30 -5 -8)' }),
      svgEl('text', { y: 6.5, 'text-anchor': 'middle', class: 'pc-num', fill: INK }, String(horse + 1)));
    const ring = svgEl('circle', { r: 25, class: 'pc-pulse', fill: 'none' });
    const g = svgEl('g', { class: 'pc-tok' }, ring, body);
    g.addEventListener('click', () => choose(horse, seat));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        choose(horse, seat);
      }
    });
    gTokens.append(g);
    const rec = { g, body };
    tokens.set(key, rec);
    return rec;
  }

  function renderTokens() {
    const mine = canChoose();
    const choices = new Set(mine ? v.choices.map((c) => c.horse) : []);
    const moved = v.last && v.last.horse !== null ? `${v.last.seat}-${v.last.horse}` : null;
    const hit = v.last?.captured ? `${v.last.captured.seat}-${v.last.captured.horse}` : null;
    const seen = new Set();
    v.players.forEach((id, seat) => {
      for (let horse = 0; horse < 4; horse++) {
        const key = `${seat}-${horse}`;
        const rec = tokenFor(seat, horse);
        seen.add(key);
        const gone = v.left.includes(id);
        rec.g.style.display = gone ? 'none' : '';
        if (gone) continue;
        const { x, y, scale } = position(seat, horse);
        rec.g.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale})`;
        const choosable = seat === v.you && choices.has(horse);
        rec.g.classList.toggle('is-choice', choosable);
        rec.g.classList.toggle('is-preview', choosable && preview === horse);
        rec.g.classList.toggle('is-done', v.pos[seat][horse] === TOP);
        rec.g.classList.toggle('is-last', key === moved && !choosable && v.phase !== 'over'); // anneau citron : le cheval qui vient de jouer
        if (choosable && !rec.raised) {
          gTokens.append(rec.g); // au premier plan, une seule fois (déplacer un nœud casse sa transition)
          rec.raised = true;
        }
        if (!choosable) rec.raised = false;
        if (choosable) {
          rec.g.setAttribute('tabindex', '0');
          rec.g.setAttribute('role', 'button');
        } else {
          rec.g.removeAttribute('tabindex');
          rec.g.removeAttribute('role');
        }
        rec.g.setAttribute('aria-label', tokenLabel(seat, horse, choosable));
        rec.g.setAttribute('aria-hidden', choosable ? 'false' : 'true');
        rec.body.classList.toggle('is-moved', key === moved && v.rolls !== lastRolls);
        rec.body.classList.toggle('is-hit', key === hit && v.rolls !== lastRolls);
      }
    });
    for (const [key, rec] of tokens) if (!seen.has(key)) rec.g.remove();
  }

  function tokenLabel(seat, horse, choosable) {
    const p = v.pos[seat][horse];
    const where = p === 0 ? 'à l’écurie' : p === TOP ? 'arrivé' : p > LAP ? `sur l’échelle, barreau ${p - LAP}` : `sur le circuit, case ${p}`;
    return `Cheval ${horse + 1} ${COLORS[v.colors[seat]].name} de ${api.user(v.players[seat]).pseudo}, ${where}${choosable ? ', touche pour le jouer' : ''}`;
  }

  function renderTargets() {
    gTargets.replaceChildren();
    if (!canChoose()) return;
    for (const c of v.choices) {
      const color = v.colors[v.you];
      let x;
      let y;
      if (c.to <= LAP) [x, y] = pt(angle(absOf(color, c.to)), RING);
      else [x, y] = pt(ladderAngle(color), RING - RUNG * (c.to - LAP));
      gTargets.append(svgEl('circle', { cx: x, cy: y, r: c.capture ? 22 : 19, class: `pc-target${preview === c.horse ? ' is-on' : ''}${c.capture ? ' is-hit' : ''}` }));
    }
  }

  // ——— Actions ———
  const mySeatActive = () => v && v.you !== null && v.you >= 0 && !v.left.includes(v.players[v.you]);
  const myTurn = () => mySeatActive() && v.phase !== 'over' && v.turn === v.you;
  const canChoose = () => myTurn() && v.phase === 'choose';
  let busy = false;

  async function send(action) {
    if (busy) return;
    busy = true;
    try {
      await api.sendMove(action);
    } catch {
      /* le hub affiche l'erreur */
    } finally {
      busy = false;
      preview = null;
      if (v) render();
    }
  }

  function choose(horse, seat) {
    if (seat !== v.you || !canChoose() || !v.choices.some((c) => c.horse === horse)) return;
    send({ type: 'move', horse });
  }

  // ——— Textes ———
  const name = (seat) => (seat === v.you ? 'Tu' : api.user(v.players[seat]).pseudo);

  function describeLast() {
    const l = v.last;
    if (!l) return '';
    const who = l.seat === v.you ? 'Tu as' : `${api.user(v.players[l.seat]).pseudo} a`;
    if (l.horse === null) {
      if (v.phase === 'choose' && v.turn === l.seat) return `${who} fait ${l.die}.`;
      return `${who} fait ${l.die} : aucun coup possible.`;
    }
    let text = `${who} fait ${l.die} : `;
    text += l.from === 0 ? `le cheval ${l.horse + 1} sort de l’écurie` : l.to === TOP ? `le cheval ${l.horse + 1} arrive en haut de l’échelle` : `le cheval ${l.horse + 1} avance`;
    if (l.captured) text += `, et prend le cheval ${l.captured.horse + 1} de ${api.user(v.players[l.captured.seat]).pseudo}`;
    text += '.';
    if (l.die === 6 && v.phase !== 'over') text += ` ${l.seat === v.you ? 'Tu rejoues' : 'Il rejoue'} !`;
    return text;
  }

  function statusText() {
    if (v.phase === 'over') {
      const w = v.players.indexOf(v.winner);
      const home = v.pos[w].every((p) => p === TOP);
      if (w === v.you) return home ? 'Tu gagnes ! Tes quatre chevaux sont en haut.' : 'Tu gagnes : les autres ont quitté la partie.';
      return home ? `${api.user(v.winner).pseudo} gagne : ses quatre chevaux sont en haut.` : `${api.user(v.winner).pseudo} gagne : les autres ont quitté la partie.`;
    }
    if (!info?.isPlayer || v.you === null || v.you < 0) return `${api.user(v.players[v.turn]).pseudo} ${v.phase === 'choose' ? 'choisit un cheval' : 'lance le dé'}…`;
    if (v.left.includes(v.players[v.you])) return 'Tu as quitté la partie : tu regardes.';
    if (myTurn()) {
      if (v.phase === 'choose') return `Tu as fait ${v.die} : choisis ton cheval.`;
      return v.tries > 1 ? `À toi : sors un cheval avec un 6 (${v.tries} essais)` : 'À toi : lance le dé !';
    }
    return `${api.user(v.players[v.turn]).pseudo} ${v.phase === 'choose' ? 'choisit un cheval' : 'lance le dé'}…`;
  }

  function choiceText(c) {
    if (c.from === 0) return 'sort de l’écurie';
    if (c.to === TOP) return 'monte tout en haut';
    if (c.to > LAP) return `monte au barreau ${c.to - LAP}`;
    return `avance de ${v.die}`;
  }

  function renderPlayers() {
    playersEl.replaceChildren(...v.players.map((id, seat) => {
      const left = v.left.includes(id);
      const rows = v.pos[seat];
      const home = rows.filter((p) => p === TOP).length;
      const stable = rows.filter((p) => p === 0).length;
      const turn = !left && v.phase !== 'over' && v.turn === seat;
      return h(`li.pc-player${turn ? '.is-turn' : ''}${left ? '.is-left' : ''}`,
        h('span.pc-chip', { style: `--c:${COLORS[v.colors[seat]].fill}`, 'aria-hidden': 'true' },
          svgEl('svg', { viewBox: '-20 -20 40 40', width: 26, height: 26 }, svgEl('g', { fill: COLORS[v.colors[seat]].fill, stroke: INK, 'stroke-width': 3.4, 'stroke-linejoin': 'round' }, tokenShape(v.colors[seat], 15)))),
        api.token(api.user(id), { size: 's' }),
        h('span.pc-pname', h('b', api.user(id).pseudo, seat === v.you ? h('span.pc-you', ' (toi)') : null),
          h('small', left ? 'a quitté la partie' : `${COLORS[v.colors[seat]].name} · ${stable} à l’écurie`)),
        left ? null : h('b.pc-score', { title: `${home} cheval${home > 1 ? 'x' : ''} arrivé${home > 1 ? 's' : ''} sur 4` }, `${home}/4`),
        turn ? h('span.pc-turn', seat === v.you ? 'à toi' : 'joue') : null);
    }));
  }

  function renderControls() {
    const last = v.last;
    const shown = v.phase === 'choose' ? v.die : last?.die ?? null;
    dieEl.dataset.face = shown ? String(shown) : '0';
    dieEl.setAttribute('aria-label', shown ? `Dé : ${shown}` : 'Dé : pas encore lancé');
    dieWho.textContent = last ? (last.seat === v.you ? 'ton dernier lancer' : `lancer de ${api.user(v.players[last.seat]).pseudo}`) : '';
    if (v.rolls !== lastRolls) {
      dieEl.classList.remove('is-rolling');
      void dieEl.offsetWidth;
      if (lastRolls !== -1 || v.rolls > 0) dieEl.classList.add('is-rolling');
    }
    if (canChoose()) {
      actionEl.replaceChildren(...v.choices.map((c) => h('button.pc-choice', {
        type: 'button',
        onclick: () => send({ type: 'move', horse: c.horse }),
        onmouseenter: () => { preview = c.horse; renderTargets(); renderTokens(); },
        onmouseleave: () => { preview = null; renderTargets(); renderTokens(); },
        onfocus: () => { preview = c.horse; renderTargets(); renderTokens(); },
        onblur: () => { preview = null; renderTargets(); renderTokens(); },
      },
      svgEl('svg', { viewBox: '-20 -20 40 40', width: 34, height: 34, 'aria-hidden': 'true' },
        svgEl('g', { fill: COLORS[v.colors[v.you]].fill, stroke: INK, 'stroke-width': 3.4, 'stroke-linejoin': 'round' }, tokenShape(v.colors[v.you], 16)),
        svgEl('text', { y: 6, 'text-anchor': 'middle', class: 'pc-num', fill: INK }, String(c.horse + 1))),
      h('span', h('b', `Cheval ${c.horse + 1}`), h('small', choiceText(c) + (c.capture ? ` · prend un cheval de ${api.user(v.players[c.capture.seat]).pseudo}` : ''))))));
    } else if (myTurn() && v.phase === 'roll') {
      actionEl.replaceChildren(h('button.pc-roll', { type: 'button', onclick: () => send({ type: 'roll' }) }, horseIcon(), 'Lancer le dé'));
    } else {
      actionEl.replaceChildren();
    }
    renderTimer();
  }

  function renderTimer() {
    const on = Boolean(v.deadline) && v.phase !== 'over';
    timerEl.hidden = !on;
    if (!on) return;
    const left = Math.max(0, v.deadline - api.now());
    timerBar.style.transform = `scaleX(${Math.min(1, left / (v.timer * 1000))})`;
    timerEl.classList.toggle('is-low', left < 8000);
    timerEl.setAttribute('aria-label', `Temps restant : ${Math.ceil(left / 1000)} secondes`);
  }
  const clock = setInterval(() => { if (v) renderTimer(); }, 200);

  function confetti() {
    celebrated = true;
    const cols = ['#FF2E93', '#FFD400', '#00D8C6', '#FF7A00', '#7B3CFF', '#fff'];
    const layer = h('div.pc-confetti', { 'aria-hidden': 'true' }, Array.from({ length: 40 }, (_, i) => h('i', {
      style: `left:${(i * 89) % 100}%;background:${cols[i % cols.length]};animation-delay:${((i * 47) % 80) / 100}s;animation-duration:${2 + ((i * 29) % 14) / 10}s`,
    })));
    root.append(layer);
    setTimeout(() => layer.remove(), 4500);
  }

  function render() {
    drawTrack();
    renderTargets();
    renderTokens();
    renderPlayers();
    renderControls();
    statusEl.textContent = statusText();
    statusEl.classList.toggle('is-mine', myTurn());
    statusEl.classList.toggle('is-over', v.phase === 'over');
    logEl.textContent = describeLast();
    lastRolls = v.rolls;
    if (v.phase === 'over' && v.winner === api.me.id && !celebrated) confetti();
    if (v.phase !== 'over') celebrated = false;
  }

  const off = api.onState((view, i) => {
    v = view;
    info = i;
    preview = null;
    render();
  });

  return () => {
    clearInterval(clock);
    off();
  };
}
