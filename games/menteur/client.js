// Menteur côté navigateur : pirates cartoon, gobelets colorés, annonces.
// Le hub fournit api (docs/integration.md §8). Les règles et les dés secrets restent sur le serveur : ici, on ne fait qu'afficher la vue.

const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const FACES = [1, 2, 3, 4, 5, 6];
const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function mount(root, api) {
  const { h } = api;
  const me = api.me.id;
  const page = h('div.mt');
  root.append(page);

  let v = null; // la vue envoyée par le serveur
  let seenRound = 0; // pour ne lancer l'animation des dés qu'à l'arrivée d'une nouvelle manche
  let seenPhase = null;
  let pick = { key: '', qty: 1, face: 2 }; // l'annonce en cours de préparation
  let armed = null; // « liar » ou « exact » : un premier appui demande confirmation
  let armTimer = 0;
  let busy = false;
  let tick = 0;
  let liftFrame = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Confettis de victoire : décor seulement, coupé par prefers-reduced-motion (et masqué en CSS).
  function confetti() {
    if (reduced) return;
    const colors = ['#ff3d8b', '#ffe34d', '#37efba', '#3b82ff', '#ff9a1f', '#8b5cff'];
    const box = h('div.mt-confetti', { 'aria-hidden': 'true' }, Array.from({ length: 40 }, (_, i) => {
      const el = h('i');
      el.style.setProperty('--x', `${Math.round(Math.random() * 100)}%`);
      el.style.setProperty('--d', `${Math.round(Math.random() * 700)}ms`);
      el.style.setProperty('--r', `${Math.round(360 + Math.random() * 540)}deg`);
      el.style.setProperty('--c', colors[i % colors.length]);
      return el;
    }));
    root.append(box);
    setTimeout(() => box.remove(), 4200);
  }

  const nm = (id) => api.user(id).pseudo;
  // « Tu perds » / « Léa perd » : sujet et verbe accordés selon que c'est moi ou non.
  const who = (id, second, third) => `${id === me ? 'Tu' : nm(id)} ${id === me ? second : third}`;
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

  // ——— Briques ———

  const die = (value, extra = '') => h(`span.mt-die.v${value}${extra}`, { role: 'img', 'aria-label': `dé de valeur ${value}` },
    PIPS[value].map((c) => h(`i.c${c}`)));

  const bidLabel = (b) => h('span.mt-bidlabel', h('b', String(b.qty)), ' × ', die(b.face, '.mini'), h('span.sr-only', `, des ${b.face}`));

  const isOut = (id) => !(v.counts[id] > 0);
  const aliveIds = () => v.players.filter((id) => !isOut(id));
  const bidding = () => v.phase === 'bid';
  const myTurn = () => bidding() && v.turn === me;
  const iAmAlive = () => v.players.includes(me) && !isOut(me);

  function send(action) {
    if (busy) return;
    busy = true;
    disarm();
    renderDock();
    api.sendMove(action).catch(() => {}).finally(() => {
      busy = false;
      if (v) renderDock();
    });
  }

  function disarm() {
    armed = null;
    clearTimeout(armTimer);
  }

  function arm(kind) {
    if (armed === kind) {
      send({ type: kind });
      return;
    }
    armed = kind;
    clearTimeout(armTimer);
    armTimer = setTimeout(() => {
      armed = null;
      if (v) renderDock();
    }, 4000);
    renderDock('call-' + kind);
  }

  // ——— Annonce en préparation ———

  // À chaque nouvelle annonce ou manche, on repart d'une proposition raisonnable : la valeur de l'annonce, ou celle qu'on a le plus.
  function syncPick() {
    const key = `${v.round}:${v.history.length}`;
    if (pick.key === key) {
      pick.qty = Math.min(Math.max(pick.qty, v.minQty[pick.face - 1]), Math.max(v.total, 1));
      return;
    }
    let face = v.bid ? v.bid.face : 0;
    if (!face) {
      const c = {};
      for (const d of v.mine || []) c[d] = (c[d] || 0) + 1;
      face = Number(Object.keys(c).sort((a, b) => c[b] - c[a] || b - a)[0]) || 2;
    }
    if (v.minQty[face - 1] > v.total) face = FACES.find((f) => v.minQty[f - 1] <= v.total) || face;
    pick = { key, face, qty: v.minQty[face - 1] };
  }

  const canBid = () => pick.qty >= v.minQty[pick.face - 1] && pick.qty <= v.total;

  function setFace(f) {
    pick.face = f;
    pick.qty = Math.max(pick.qty, v.minQty[f - 1]);
    renderDock(`face-${f}`);
  }

  // ——— Dessin ———

  function seat(id) {
    const out = isOut(id);
    const left = v.left.includes(id);
    const reveal = v.reveal;
    const showDice = reveal && reveal.dice[id];
    const bid = bidding() && v.bid && v.bid.id === id ? v.bid : null;
    const hit = (d) => reveal && (d === reveal.face || (reveal.face !== 1 && d === 1));
    const lostDie = reveal && reveal.changed && reveal.changed.id === id;
    const cls = ['mt-seat', id === me && 'is-me', out && 'is-out', bidding() && v.turn === id && 'is-turn', bid && 'is-bidder', lostDie && 'is-hit'].filter(Boolean).join('.');
    const dice = showDice ? v.reveal.dice[id].map((d) => die(d, hit(d) ? '.is-hit' : '.is-miss')) : [];
    return h(`li.${cls}`,
      h('div.mt-nameplate', api.token(api.user(id), { size: 's' }), h('span.mt-name', nm(id))),
      h('div.mt-stage',
        id === me ? h('span.mt-tag', 'toi') : null,
        showDice ? h('div.mt-under', dice) : null,
        out ? null : h('div.mt-cup', { 'aria-hidden': 'true', dataset: { up: showDice ? '1' : '' } })),
      h('p.mt-seatfoot',
        out ? h('span.mt-gone', left ? 'parti' : '☠︎ éliminé')
          : h('span.mt-count', plural(v.counts[id], 'dé', 'dés'), ' ',
            lostDie && reveal.changed.delta < 0 ? h('b.mt-delta.neg', '−1') : null,
            lostDie && reveal.changed.delta > 0 ? h('b.mt-delta.pos', '+1') : null),
        bid ? h('span.mt-lastbid', bidLabel(bid)) : null,
        bidding() && v.turn === id ? h('span.mt-turn', 'parle') : null,
        v.phase === 'over' && v.winner === id ? h('span.mt-turn', 'gagne') : null,
        v.phase === 'reveal' && !out && v.ready.includes(id) ? h('span.mt-ready', 'prêt') : null));
  }

  function board() {
    if (v.phase !== 'bid') return h('section.mt-board', verdict());
    const last = v.bid;
    const history = v.history.slice().reverse();
    return h('section.mt-board', { 'aria-label': 'Annonces de la manche' },
      h('div.mt-plaque',
        last
          ? [h('p.mt-plaque-big', h('b', String(last.qty)), h('span', ' × '), die(last.face)),
            h('p.mt-plaque-by', `annoncé par ${last.id === me ? 'toi' : nm(last.id)}${last.auto ? ' (temps écoulé)' : ''}`)]
          : [h('p.mt-plaque-none', 'Aucune annonce'),
            h('p.mt-plaque-by', v.turn === me ? 'À toi d’ouvrir la manche.' : `${nm(v.turn)} ouvre la manche.`)]),
      history.length > 1
        ? h('ol.mt-history', { 'aria-label': 'Annonces précédentes' }, history.slice(1).map((b) => h('li', h('span', b.id === me ? 'Toi' : nm(b.id)), bidLabel(b))))
        : null);
  }

  // Le résumé de la manche qui vient de finir.
  function verdict() {
    const r = v.reveal;
    if (!r) return null;
    const shout = r.kind === 'liar' ? '« Menteur ! »' : '« Tout pile ! »';
    const c = r.changed;
    let result;
    if (r.kind === 'liar') result = r.success ? 'L’annonce était juste.' : 'L’annonce était fausse.';
    else result = r.success ? 'C’est exact, au dé près !' : 'Ce n’est pas exact.';
    let fate = '';
    if (c) fate = c.delta > 0 ? who(c.id, 'regagnes un dé', 'regagne un dé') : who(c.id, 'perds un dé', 'perd un dé');
    else if (r.kind === 'exact' && r.success) fate = `${who(r.caller, 'as', 'a')} déjà tous ses dés`;
    return h('div.mt-verdict', { 'aria-live': 'polite' },
      h('p.mt-v1', who(r.caller, 'dis', 'dit'), ' ', h('b.mt-shout', shout), ` sur ${r.bidder === me ? 'ton annonce' : 'l’annonce de ' + nm(r.bidder)} : `, bidLabel({ qty: r.qty, face: r.face })),
      h('p.mt-v2', `Sur la table : ${plural(r.count, 'dé', 'dés')} de ${r.face}${r.face === 1 ? ' (seuls les 1 comptent).' : ', jokers compris.'}`),
      h(`p.mt-v3.${r.success ? 'ok' : 'ko'}`, result, ' ', fate ? h('b', `${fate}.`) : null, r.eliminated ? ` ${who(c.id, 'sors', 'sort')} de la partie.` : null),
      v.phase === 'over' && v.winner !== null ? h('p.mt-winner', `${v.winner === me ? 'Tu remportes' : nm(v.winner) + ' remporte'} la partie !`) : null);
  }

  const dock = h('div.mt-dock');

  function myDice() {
    if (!(v.phase === 'bid' && v.mine)) return null;
    const fresh = !reduced && seenRound !== v.round;
    return h('div.mt-hand',
      h('p.mt-handlabel', 'Tes dés', h('span.mt-long', ' sous ton gobelet')),
      h('div.mt-hand-dice', v.mine.map((d, i) => {
        const el = die(d, fresh ? '.is-rolling' : '');
        el.style.setProperty('--i', String(i));
        return el;
      })));
  }

  function renderDock(focusKey) {
    if (!v) return;
    const active = document.activeElement;
    const keep = focusKey || (dock.contains(active) ? active.dataset.k : null);
    const parts = [];
    if (iAmAlive() && v.phase === 'bid') parts.push(myDice());
    if (myTurn()) parts.push(builder());
    else if (v.phase === 'bid') {
      parts.push(h('p.mt-wait', { 'aria-live': 'polite' }, iAmAlive() ? `${nm(v.turn)} réfléchit…` : `${nm(v.turn)} réfléchit… Tu regardes la partie.`));
    } else if (v.phase === 'reveal') {
      const n = aliveIds().length;
      if (iAmAlive()) {
        parts.push(h('button.mt-btn.mt-btn-next', {
          type: 'button',
          dataset: { k: 'next' },
          disabled: busy || v.ready.includes(me),
          onclick: () => send({ type: 'next' }),
        }, v.ready.includes(me) ? `En attente des autres (${v.ready.length}/${n})` : 'Manche suivante'));
      } else {
        parts.push(h('p.mt-wait', `Manche suivante dans un instant… (${v.ready.length}/${n} prêts)`));
      }
    }
    dock.className = `mt-dock${parts.filter(Boolean).length ? '' : ' is-empty'}`;
    dock.replaceChildren(...parts.filter(Boolean));
    if (keep) {
      const target = dock.querySelector(`[data-k="${keep}"]`);
      if (target && !target.disabled) target.focus({ preventScroll: true });
    }
  }

  function builder() {
    syncPick();
    const min = v.minQty[pick.face - 1];
    const possible = FACES.some((f) => v.minQty[f - 1] <= v.total);
    const ok = canBid();
    const hint = !possible ? 'Plus aucune annonce possible : il faut dire « Menteur ! ».'
      : pick.qty < min ? `Minimum : ${plural(min, 'dé', 'dés')} de ${pick.face}.`
        : pick.face === 1 ? 'Les 1 comptent seuls (pas de jokers).' : '';
    const faces = FACES.map((f) => h('button.mt-face', {
      type: 'button',
      dataset: { k: `face-${f}` },
      'aria-pressed': String(pick.face === f),
      'aria-label': `Des ${f}`,
      disabled: busy || v.minQty[f - 1] > v.total,
      onclick: () => setFace(f),
    }, die(f)));
    const calls = v.bid ? h('div.mt-calls',
      h(`button.mt-btn.mt-btn-liar${armed === 'liar' ? '.is-armed' : ''}`, { type: 'button', dataset: { k: 'call-liar' }, disabled: busy, onclick: () => arm('liar') },
        armed === 'liar' ? 'Sûr ? Touche encore' : 'Menteur !'),
      v.options.exact ? h(`button.mt-btn.mt-btn-exact${armed === 'exact' ? '.is-armed' : ''}`, { type: 'button', dataset: { k: 'call-exact' }, disabled: busy, onclick: () => arm('exact') },
        armed === 'exact' ? 'Sûr ? Touche encore' : ['Tout pile', h('small.mt-btn-note', 'annonce exacte au dé près')]) : null) : null;
    return h('div.mt-builder',
      h('div.mt-faces', { role: 'group', 'aria-label': 'Valeur annoncée' }, faces),
      h('div.mt-bidrow',
        h('div.mt-qty', { role: 'group', 'aria-label': 'Nombre de dés' },
          h('button.mt-step', { type: 'button', dataset: { k: 'qty-minus' }, 'aria-label': 'Un dé de moins', disabled: busy || pick.qty <= min, onclick: () => { pick.qty -= 1; renderDock('qty-minus'); } }, '−'),
          h('output.mt-qty-val', { 'aria-live': 'polite', 'aria-label': 'Nombre de dés annoncés' }, String(pick.qty)),
          h('button.mt-step', { type: 'button', dataset: { k: 'qty-plus' }, 'aria-label': 'Un dé de plus', disabled: busy || pick.qty >= v.total, onclick: () => { pick.qty += 1; renderDock('qty-plus'); } }, '+')),
        h('button.mt-btn.mt-btn-bid', { type: 'button', dataset: { k: 'bid' }, disabled: busy || !ok, onclick: () => ok && send({ type: 'bid', qty: pick.qty, face: pick.face }) },
          'Annoncer ', bidLabel({ qty: pick.qty, face: pick.face }))),
      hint ? h('p.mt-hint', { 'aria-live': 'polite' }, hint) : null,
      calls);
  }

  function bar() {
    const over = v.phase === 'over';
    return h('header.mt-bar',
      h('span.mt-round', over ? 'Partie finie' : `Manche ${v.round}`),
      h('span.mt-total', plural(v.total, 'dé', 'dés'), h('span.mt-long', ' en jeu')),
      h('span.mt-paco', die(1, '.mini'), ' = jokers', h('span.sr-only', ' : les 1 sont des jokers')),
      h('span.mt-timer', { dataset: { k: 'timer' } }));
  }

  function updateTimer() {
    const el = page.querySelector('.mt-timer');
    if (!el || !v) return;
    if (!v.deadline || v.phase === 'over') {
      el.textContent = '';
      el.classList.remove('is-low');
      return;
    }
    const left = v.deadline - api.now();
    el.textContent = `${v.phase === 'reveal' ? 'Suite ' : ''}${mmss(left)}`;
    el.classList.toggle('is-low', left < 10_000 && v.phase === 'bid');
  }

  function render() {
    cancelAnimationFrame(liftFrame);
    const newRound = v.phase === 'bid' && seenRound !== v.round;
    const justRevealed = v.phase !== 'bid' && seenPhase === 'bid';
    page.className = `mt phase-${v.phase}`;
    const top = page.querySelector('.mt-scroll')?.scrollTop || 0;
    const seats = h('ul.mt-seats', { 'aria-label': 'Joueurs' }, v.players.map(seat));
    page.replaceChildren(
      bar(),
      h('div.mt-scroll', board(), seats),
      dock);
    renderDock();
    updateTimer();
    // Les gobelets se soulèvent après le premier dessin, pour que la transition se voie.
    const cups = [...page.querySelectorAll('.mt-cup[data-up="1"]')];
    if (cups.length) {
      if (justRevealed && !reduced) liftFrame = requestAnimationFrame(() => requestAnimationFrame(() => cups.forEach((c) => c.classList.add('is-up'))));
      else cups.forEach((c) => c.classList.add('is-up', 'no-anim'));
    }
    const scroller = page.querySelector('.mt-scroll');
    if (scroller) scroller.scrollTop = newRound ? 0 : top;
    if (v.phase === 'over' && seenPhase !== null && seenPhase !== 'over' && (api.seat < 0 || v.winner === api.me.id)) confetti();
    if (v.phase === 'bid') seenRound = v.round;
    seenPhase = v.phase;
  }

  api.onState((view) => {
    v = view;
    disarm();
    render();
  });

  tick = setInterval(updateTimer, 500);
  return () => {
    clearInterval(tick);
    clearTimeout(armTimer);
    cancelAnimationFrame(liftFrame);
  };
}
