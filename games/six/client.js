// Six cornes côté navigateur : rangées, main, scores et l'animation des cartes (révélation, puis glissement vers les rangées).
// Le hub fournit api (voir docs/integration.md §8) ; les règles et ce que chacun voit sont dans rules.js.
// L'écran garde sa propre copie de ce qui est affiché (rangées et scores) pour pouvoir rejouer un tour pas à pas.

const SVG_NS = 'http://www.w3.org/2000/svg';
const ROW_MAX = 5;
// Une couleur pastel vive par place autour de la table.
const PASTEL = ['#ff8fc7', '#7fd6ff', '#ffe95c', '#8cf0ae', '#c7a8ff', '#ffb27a', '#74efe0', '#ff9aa2', '#c4f55e', '#ffc2ec'];

// Mêmes valeurs que rules.js : 1 tête, 2 (multiples de 5), 3 (multiples de 10), 5 (doubles), 7 (le 55).
function bulls(card) {
  if (card === 55) return 7;
  if (card % 11 === 0) return 5;
  if (card % 10 === 0) return 3;
  if (card % 5 === 0) return 2;
  return 1;
}
const rowBulls = (row) => row.reduce((sum, c) => sum + bulls(c), 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mount(root, api) {
  const { h } = api;
  api.gateTurn(); // le bandeau de fin attend la dernière animation

  // ——— Pictogramme : une tête de bœuf à cornes ———
  function horn() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'sx-horn');
    svg.setAttribute('aria-hidden', 'true');
    const add = (tag, attrs) => {
      const el = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      svg.append(el);
    };
    // Une petite vache bonbon : cornes citron, oreilles roses, museau rose, yeux ronds.
    add('path', { d: 'M5.4 9.2C3.2 7.6 3 4.6 4.6 3.2c1.6 1 3.2 2.8 3.8 4.8Z', class: 'sx-h-horn' });
    add('path', { d: 'M18.6 9.2c2.2-1.6 2.4-4.6.8-6-1.6 1-3.2 2.8-3.8 4.8Z', class: 'sx-h-horn' });
    add('ellipse', { cx: 3.6, cy: 13, rx: 2.6, ry: 1.7, class: 'sx-h-ear', transform: 'rotate(-25 3.6 13)' });
    add('ellipse', { cx: 20.4, cy: 13, rx: 2.6, ry: 1.7, class: 'sx-h-ear', transform: 'rotate(25 20.4 13)' });
    add('circle', { cx: 12, cy: 12.6, r: 8.2, class: 'sx-h-face' });
    add('ellipse', { cx: 12, cy: 16.9, rx: 4.6, ry: 3.1, class: 'sx-h-snout' });
    add('circle', { cx: 10.4, cy: 16.9, r: 0.7, class: 'sx-h-dot' });
    add('circle', { cx: 13.6, cy: 16.9, r: 0.7, class: 'sx-h-dot' });
    add('circle', { cx: 8.9, cy: 11.6, r: 1.25, class: 'sx-h-dot' });
    add('circle', { cx: 15.1, cy: 11.6, r: 1.25, class: 'sx-h-dot' });
    return svg;
  }

  // Une carte : numéro, couleur selon la valeur, petites cornes en bas.
  function card(n, extra = '') {
    const b = bulls(n);
    const icons = b <= 3 ? Array.from({ length: b }, horn) : [horn(), h('span.sx-x', `×${b}`)];
    return h(`div.sx-card.b${b}${extra}`, { dataset: { card: String(n) } },
      h('span.sx-corner', String(n)),
      h('span.sx-num', String(n)),
      h('span.sx-horns', { 'aria-hidden': 'true' }, icons));
  }
  const backCard = (extra = '') => h(`div.sx-card.is-back${extra}`, { 'aria-hidden': 'true' }, h('span.sx-back-mark'));

  // ——— Éléments fixes ———
  let view = null;
  let shown = null; // ce que l'écran affiche : { rows, heads }
  let selected = null;
  let lastSeq = null;
  let busy = false;
  const jobs = [];
  const label = (id) => api.user(id).pseudo;
  const seatOf = (id) => view.players.indexOf(id);

  const status = h('p.sx-status', { 'aria-live': 'polite' });
  const roundChip = h('span.sx-chip');
  const timerEl = h('span.sx-timer', { hidden: true, role: 'timer' });
  const board = h('div.sx-score');
  const lanes = Array.from({ length: 4 }, (_, r) => h('button.sx-lane', { type: 'button', dataset: { row: String(r) }, onclick: () => pickRow(r) }));
  const strip = h('div.sx-strip', { 'aria-label': 'Cartes de ce tour' });
  const stripNote = h('p.sx-strip-note', { 'aria-live': 'polite' });
  const log = h('p.sx-log', { 'aria-live': 'polite' });
  const hand = h('div.sx-hand', { role: 'group', 'aria-label': 'Ta main' });
  const bar = h('div.sx-bar');
  const wrap = h('div.sx',
    h('div.sx-top', status, h('div.sx-top-chips', roundChip, timerEl)),
    board,
    h('div.sx-field', h('div.sx-lanes', lanes), h('div.sx-table', strip, stripNote)),
    log,
    h('div.sx-handbox', hand, bar));
  root.append(wrap);

  // ——— Actions ———
  const myTurnToChoose = () => view && view.seat >= 0 && view.phase === 'choose' && !view.picked[view.seat] && !view.left[view.seat] && view.hand?.length > 0;
  const myRowChoice = () => view && view.seat >= 0 && view.phase === 'row' && view.pending?.seat === view.seat;

  function playCard(n) {
    if (!myTurnToChoose() || busy) return;
    selected = null;
    api.sendMove({ type: 'pick', card: n }).catch(() => {});
  }
  function pickRow(r) {
    if (!myRowChoice() || busy) return;
    api.sendMove({ type: 'row', row: r }).catch(() => {});
  }
  function selectCard(n) {
    if (!myTurnToChoose() || busy) return;
    if (selected === n) return playCard(n);
    selected = n;
    paintHand();
  }

  // ——— Dessin statique ———
  function paintScore(heads) {
    board.replaceChildren(...view.players.map((id, seat) => {
      const left = view.left[seat];
      const picked = view.phase === 'choose' && view.picked[seat];
      const over = view.phase === 'over';
      const win = over && view.winners.includes(id);
      const pct = Math.min(100, Math.round((heads[seat] / view.target) * 100));
      return h(`div.sx-pl${left ? '.is-left' : ''}${picked ? '.is-picked' : ''}${win ? '.is-win' : ''}${id === api.me.id ? '.is-me' : ''}`,
        { dataset: { seat: String(seat) }, style: `--pc:${PASTEL[seat % PASTEL.length]}`, 'aria-label': `${label(id)} : ${heads[seat]} tête${heads[seat] > 1 ? 's' : ''}${left ? ', parti' : picked ? ', a posé sa carte' : ''}` },
        api.token(api.user(id), { size: 's' }),
        h('span.sx-pl-name', label(id)),
        h('span.sx-pl-heads', horn(), h('b', String(heads[seat]))),
        h('span.sx-pl-state', { 'aria-hidden': 'true' }, left ? 'parti' : win ? '★' : picked ? '✓' : ''),
        h('span.sx-pl-bar', { style: `--p:${pct}%`, 'aria-hidden': 'true' }));
    }));
  }

  function paintLane(r, cards, extra = '') {
    const lane = lanes[r];
    const sum = rowBulls(cards);
    lane.className = `sx-lane${extra}`;
    const clickable = myRowChoice() && !busy;
    lane.disabled = !clickable;
    lane.setAttribute('aria-label', `Rangée ${r + 1} : ${cards.join(', ')} ; ${sum} tête${sum > 1 ? 's' : ''}${clickable ? '. Ramasser cette rangée' : ''}`);
    lane.replaceChildren(
      h('span.sx-lane-n', { 'aria-hidden': 'true' }, String(r + 1)),
      h('span.sx-slots', Array.from({ length: ROW_MAX }, (_, i) => (cards[i] !== undefined
        ? h('span.sx-slot.is-full', card(cards[i], i === ROW_MAX - 1 ? '.is-last' : ''))
        : h('span.sx-slot', i === ROW_MAX - 1 ? h('span.sx-warn', { 'aria-hidden': 'true' }, '6e') : null)))),
      h('span.sx-lane-sum', { 'aria-hidden': 'true' }, horn(), h('b', String(sum))));
  }

  function paintRows(rows) {
    rows.forEach((cards, r) => paintLane(r, cards, myRowChoice() && !busy ? ' is-choice' : ''));
  }

  function paintStrip(items, { pending = true } = {}) {
    strip.replaceChildren(...items.map((q) => {
      const isPending = pending && view.pending && q.seat === view.pending.seat && q.card === view.pending.card;
      return h(`div.sx-play${isPending ? '.is-pending' : ''}`, { dataset: { card: String(q.card) } },
        card(q.card),
        h('span.sx-play-who', label(view.players[q.seat])));
    }));
  }

  // Au choix : une carte dos par joueur qui a posé la sienne, un emplacement vide sinon.
  function paintTable() {
    if (view.phase === 'choose') {
      strip.replaceChildren(...view.players.map((id, seat) => (view.left[seat] ? null
        : h(`div.sx-play${view.picked[seat] ? '.is-down' : '.is-wait'}`,
          view.picked[seat] ? backCard() : h('div.sx-card.is-empty'),
          h('span.sx-play-who', label(id))))).filter(Boolean));
      stripNote.textContent = '';
    } else if (view.phase === 'row') {
      paintStrip(view.queue);
      stripNote.textContent = view.pending.seat === view.seat
        ? `Ton ${view.pending.card} est plus petit que toutes les fins de rangée : touche la rangée que tu ramasses.`
        : `${label(view.players[view.pending.seat])} doit choisir une rangée à ramasser avec son ${view.pending.card}…`;
    } else {
      strip.replaceChildren();
      stripNote.textContent = '';
    }
  }

  function paintHand() {
    const can = myTurnToChoose() && !busy;
    const cards = view.hand || [];
    hand.replaceChildren(...cards.map((n) => {
      const btn = h(`button.sx-pick${selected === n ? '.is-selected' : ''}`, {
        type: 'button', disabled: !can, 'aria-pressed': selected === n ? 'true' : 'false',
        'aria-label': `Carte ${n}, ${bulls(n)} tête${bulls(n) > 1 ? 's' : ''}${selected === n ? ', sélectionnée : touche encore pour la poser' : ''}`,
        onclick: () => selectCard(n),
      }, card(n));
      return btn;
    }));
    hand.hidden = view.seat < 0 || cards.length === 0;
    if (view.seat >= 0 && view.phase === 'choose' && !view.left[view.seat]) {
      if (can) {
        bar.replaceChildren(
          h('button.sx-go', { type: 'button', disabled: selected === null, onclick: () => selected !== null && playCard(selected) },
            selected === null ? 'Choisis une carte' : `Poser le ${selected}`));
      } else {
        bar.replaceChildren(h('p.sx-wait', view.picked[view.seat] ? 'Carte posée : on attend les autres…' : ''));
      }
    } else {
      bar.replaceChildren();
    }
  }

  function statusText() {
    const names = (ids) => ids.map(label).join(', ');
    if (view.phase === 'over') {
      if (view.forfeit && view.winners.length === 1 && view.winners[0] === api.me.id) return 'Les autres ont quitté la partie : tu gagnes !';
      const w = view.winners;
      const best = Math.min(...view.players.map((id, s) => (view.left[s] ? Infinity : view.heads[s])));
      if (w.includes(api.me.id)) return w.length > 1 ? `Égalité en tête avec ${best} tête${best > 1 ? 's' : ''} : bravo !` : `Tu gagnes avec seulement ${best} tête${best > 1 ? 's' : ''} !`;
      return `${names(w)} ${w.length > 1 ? 'gagnent' : 'gagne'} avec ${best} tête${best > 1 ? 's' : ''}.`;
    }
    if (view.seat < 0) return view.phase === 'row' ? `${label(view.players[view.pending.seat])} choisit une rangée…` : 'Les joueurs choisissent leur carte…';
    if (view.left[view.seat]) return 'Tu as quitté la partie.';
    if (view.phase === 'row') return view.pending.seat === view.seat ? 'Ta carte est trop petite : choisis une rangée à ramasser.' : `${label(view.players[view.pending.seat])} choisit une rangée…`;
    if (view.picked[view.seat]) {
      const waiting = view.players.filter((id, s) => !view.left[s] && !view.picked[s]);
      return waiting.length ? `Carte posée. On attend ${names(waiting)}.` : 'Carte posée.';
    }
    return 'Choisis une carte, tous jouent ensemble. Le moins de têtes gagne.';
  }

  function logText(step) {
    if (!step || !step.plays.length) return '';
    return step.plays.map((p) => {
      const who = label(view.players[p.seat]);
      return p.took
        ? `${who} pose le ${p.card} et ramasse la rangée ${p.row + 1} (+${p.gain})`
        : `${who} pose le ${p.card} (rangée ${p.row + 1})`;
    }).join(' · ');
  }

  function paintMeta() {
    status.textContent = statusText();
    // The hub banner already says the game is over: no duplicate chip.
    roundChip.hidden = view.phase === 'over';
    roundChip.textContent = view.phase === 'over' ? '' : `Manche ${view.round} · tour ${view.turnNo}/10 · fin à ${view.target} têtes`;
    paintTimer();
  }

  // Confettis à la fin de la partie (décor seulement, coupé si l'animation est réduite).
  let confettiDone = false;
  function confetti() {
    if (reduceMotion() || confettiDone) return;
    confettiDone = true;
    const colors = ['#ff5fb5', '#ffe95c', '#7fd6ff', '#8cf0ae', '#8f5bff', '#ffaa4d'];
    const box = h('div.sx-confetti', { 'aria-hidden': 'true' }, Array.from({ length: 44 }, (_, i) => h('i', {
      style: `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random() * 0.8}s;animation-duration:${2 + Math.random() * 1.6}s;--r:${Math.round(Math.random() * 720 - 360)}deg`,
    })));
    root.append(box);
    setTimeout(() => box.remove(), 4800);
  }

  function renderStatic() {
    shown = { rows: view.rows.map((r) => [...r]), heads: [...view.heads] };
    paintMeta();
    paintScore(shown.heads);
    paintRows(shown.rows);
    paintTable();
    paintHand();
    log.textContent = logText(view.step);
    wrap.dataset.phase = view.phase;
    if (view.phase === 'over' && (api.seat < 0 || view.winners.includes(api.me.id))) confetti(); // pas de fête pour ceux qui perdent
    else confettiDone = false;
  }

  // ——— Animation d'un pas : révélation, puis chaque carte glisse vers sa rangée ———
  async function animate(v) {
    const step = v.step;
    const n = step.plays.length;
    const per = jobs.length ? 200 : n > 6 ? 480 : 720; // en retard sur le serveur : on rattrape vite
    // Départ : les rangées et les scores d'avant ce pas.
    const gains = view.players.map(() => 0);
    step.plays.forEach((p) => { gains[p.seat] += p.gain; });
    shown = { rows: step.rowsBefore.map((r) => [...r]), heads: v.heads.map((x, i) => x - gains[i]) };
    paintMeta();
    paintScore(shown.heads);
    paintRows(shown.rows);
    selected = null;
    paintHand();
    const items = [...step.plays.map((p) => ({ seat: p.seat, card: p.card })), ...v.queue];
    paintStrip(items, { pending: false });
    stripNote.textContent = '';
    log.textContent = '';
    if (step.revealed) {
      // Les cartes se retournent l'une après l'autre.
      const els = [...strip.querySelectorAll('.sx-play')];
      els.forEach((el) => el.classList.add('is-flip'));
      els.forEach((el, i) => { el.style.animationDelay = `${i * 70}ms`; });
      await sleep(Math.min(1500, 450 + els.length * 90));
      els.forEach((el) => { el.style.animationDelay = ''; });
    }
    const stripItems = () => [...strip.querySelectorAll('.sx-play')];
    for (let i = 0; i < n; i += 1) {
      const p = step.plays[i];
      const src = stripItems()[0]; // les cartes sont posées dans l'ordre : toujours la première de la file
      const srcCard = src?.querySelector('.sx-card');
      const lane = lanes[p.row];
      if (p.took) {
        lane.classList.add('is-taking');
        await sleep(jobs.length ? 150 : 520);
        shown.heads[p.seat] += p.gain;
        paintScore(shown.heads);
        const chip = board.querySelector(`[data-seat="${p.seat}"]`);
        chip?.classList.add('is-bump');
        setTimeout(() => chip?.classList.remove('is-bump'), 700);
        shown.rows[p.row] = [];
      }
      shown.rows[p.row] = [...shown.rows[p.row], p.card];
      paintLane(p.row, shown.rows[p.row], '');
      const landed = lane.querySelector('.sx-slot:nth-child(' + (shown.rows[p.row].length) + ') .sx-card');
      const rect = srcCard?.getBoundingClientRect();
      src?.remove();
      if (landed && rect) {
        const b = landed.getBoundingClientRect();
        landed.animate([
          { transform: `translate(${rect.left - b.left}px, ${rect.top - b.top}px) scale(${rect.width / b.width})`, zIndex: 20 },
          { transform: 'none', zIndex: 20 },
        ], { duration: per, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
      await sleep(per + (p.took ? 120 : 0));
    }
  }

  async function pump() {
    if (busy) return;
    busy = true;
    try {
      while (jobs.length) {
        // Plus d'un pas d'avance : les pas intermédiaires sont sautés, l'écran ne prend jamais plus d'un pas de retard.
        if (jobs.length > 2) jobs.splice(0, jobs.length - 2);
        const v = jobs.shift();
        view = v;
        await animate(v);
      }
    } catch (err) {
      console.error(err);
    }
    busy = false;
    view = latest;
    renderStatic();
    api.showTurn();
  }

  let latest = null;
  const tick = setInterval(() => view && paintTimer(), 250);

  function paintTimer() {
    const on = view && view.phase !== 'over' && view.deadline;
    timerEl.hidden = !on;
    if (!on) return;
    const left = Math.max(0, Math.ceil((view.deadline - api.now()) / 1000));
    timerEl.textContent = `${left} s`;
    timerEl.classList.toggle('is-low', left <= 10);
    timerEl.setAttribute('aria-label', `${left} secondes pour jouer`);
  }

  api.onState((v) => {
    latest = v;
    const first = lastSeq === null;
    const fresh = !first && v.step.seq > lastSeq && v.step.plays.length > 0 && v.step.rowsBefore;
    lastSeq = v.step.seq;
    if (first) selected = null;
    if (fresh && !reduceMotion()) {
      jobs.push(v);
      pump();
      return;
    }
    if (busy) return; // l'écran se mettra à jour à la fin de l'animation
    view = v;
    // Une carte sélectionnée qui n'est plus dans la main (nouveau tour) est oubliée.
    if (selected !== null && !(v.hand || []).includes(selected)) selected = null;
    renderStatic();
    api.showTurn();
  });

  return () => {
    clearInterval(tick);
    jobs.length = 0;
  };
}
