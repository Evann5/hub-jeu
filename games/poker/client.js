// Poker côté navigateur : un salon de casino de la Riviera, années 60. Un tapis émeraude ovale, les joueurs autour
// (toi toujours en bas), le tableau et le pot au centre, et sous le tapis tes cartes et tes boutons.
// Les éléments sont créés une fois puis mis à jour : les animations (cartes, jetons) ne se rejouent donc pas à tort.

const SUIT = ['♠', '♥', '♦', '♣'].map((s) => `${s}︎`);
const SUIT_NAME = ['pique', 'cœur', 'carreau', 'trèfle'];
const RANK_LABEL = { 11: 'V', 12: 'D', 13: 'R', 14: 'A' };
const RANK_NAME = { 2: 'deux', 3: 'trois', 4: 'quatre', 5: 'cinq', 6: 'six', 7: 'sept', 8: 'huit', 9: 'neuf', 10: 'dix', 11: 'valet', 12: 'dame', 13: 'roi', 14: 'as' };
const DENOMS = [[1000, 'd5'], [500, 'd4'], [100, 'd3'], [50, 'd2'], [10, 'd1'], [1, 'd0']];
const ACTION_LABEL = { check: 'Parole', call: 'Suit', raise: 'Relance', bet: 'Mise', allin: 'Tapis', fold: 'Couché' };

const fmt = (n) => Number(n).toLocaleString('fr-FR');
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mount(root, api) {
  const { h } = api;
  let v = null;
  let prev = null;
  let built = false;
  let raiseOpen = false;
  let raiseTo = 0;
  let raiseKey = '';
  let turnTotal = 1;
  let lastDeadline = null;

  const seats = []; // { el, pos, betEl, betPos, parts }
  const cardLabel = (c) => `${RANK_NAME[(c % 13) + 2]} de ${SUIT_NAME[Math.floor(c / 13)]}`;
  const name = (id) => (id === api.me.id ? 'Toi' : api.user(id).pseudo);

  // ——— Éléments de base ———

  // Une carte persistante : undefined = pas de carte, null = dos, nombre = face visible.
  function cardSlot(extra = '') {
    const el = h(`div.pk-card.is-empty${extra ? `.${extra}` : ''}`);
    el._c = undefined;
    return el;
  }
  function setCard(el, c, delay = null) {
    if (el._c === c) return false;
    const fresh = el._c === undefined || (c !== undefined && typeof c !== typeof el._c);
    el._c = c;
    el.classList.toggle('is-empty', c === undefined);
    el.classList.toggle('is-back', c === null);
    el.classList.remove('is-red', 'is-hit', 'is-dim');
    if (c === undefined) {
      el.replaceChildren();
      el.removeAttribute('aria-label');
      return false;
    }
    if (c === null) {
      el.replaceChildren(h('span.pk-pattern'));
      el.setAttribute('aria-label', 'Carte cachée');
    } else {
      const rank = (c % 13) + 2;
      const suit = Math.floor(c / 13);
      el.classList.toggle('is-red', suit === 1 || suit === 2);
      el.replaceChildren(h('span.pk-rk', RANK_LABEL[rank] || String(rank)), h('span.pk-st', SUIT[suit]), h('span.pk-big', { 'aria-hidden': 'true' }, SUIT[suit]));
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', cardLabel(c));
    }
    if (delay !== null && fresh && !reduced()) {
      el.classList.remove('is-deal');
      void el.offsetWidth;
      el.style.animationDelay = `${delay}ms`;
      el.classList.add('is-deal');
    }
    return true;
  }

  // Un jeton dessiné en CSS ; la couleur dépend de la valeur.
  function chip(amount) {
    const d = DENOMS.find(([n]) => amount >= n) || DENOMS[DENOMS.length - 1];
    return h(`span.pk-chip.${d[1]}`, { 'aria-hidden': 'true' });
  }
  // Une pile de jetons pour un montant : au plus 4 colonnes de 5 jetons.
  function chipStack(amount) {
    const cols = [];
    let rest = amount;
    for (const [n, cls] of DENOMS) {
      const count = Math.floor(rest / n);
      if (count > 0 && cols.length < 4) cols.push(h('span.pk-col', Array.from({ length: Math.min(count, 5) }, () => h(`span.pk-chip.${cls}`))));
      rest -= count * n;
    }
    return h('span.pk-stack', { 'aria-hidden': 'true' }, cols);
  }

  // ——— Squelette ———

  const topInfo = h('div.pk-info');
  const potStack = h('div.pk-potchips');
  const potLabel = h('div.pk-potlabel');
  const potEl = h('div.pk-pot', potStack, potLabel);
  const board = Array.from({ length: 5 }, () => cardSlot('md'));
  const boardEl = h('div.pk-board', { role: 'group', 'aria-label': 'Tableau' }, board);
  const resultEl = h('div.pk-result', { hidden: true });
  const center = h('div.pk-center', potEl, boardEl, resultEl);
  const rim = h('div.pk-rim');
  const felt = h('div.pk-felt', rim, center);
  const myCards = [cardSlot('lg'), cardSlot('lg')];
  const handEl = h('div.pk-hand', { role: 'group', 'aria-label': 'Tes cartes' }, myCards);
  const statusEl = h('p.pk-status', { 'aria-live': 'polite' });
  const actionsEl = h('div.pk-actions');
  const raiseEl = h('div.pk-raise', { hidden: true });
  const panel = h('div.pk-panel', handEl, h('div.pk-ctrl', statusEl, actionsEl), raiseEl);
  // Aide-mémoire « Mains » : l'ordre des combinaisons, ouvert à la demande et refermé d'un tap ailleurs (jamais permanent).
  const HANDS = [
    ['Quinte flush', '5 cartes qui se suivent, de la même couleur'],
    ['Carré', '4 cartes du même rang'],
    ['Full', 'un brelan et une paire'],
    ['Couleur', '5 cartes de la même couleur'],
    ['Quinte', '5 cartes qui se suivent'],
    ['Brelan', '3 cartes du même rang'],
    ['Double paire', 'deux paires différentes'],
    ['Paire', '2 cartes du même rang'],
    ['Carte haute', 'rien de tout ça : la carte la plus haute'],
  ];
  const handsPanel = h('div.pk-hands', { id: 'pk-hands', hidden: true, role: 'region', 'aria-label': 'Ordre des combinaisons' },
    h('p.pk-hands-title', 'De la plus forte à la plus faible'),
    h('ol', HANDS.map(([name, desc]) => h('li', h('b', name), h('span', desc)))));
  const setHands = (open) => {
    handsPanel.hidden = !open;
    handsBtn.setAttribute('aria-expanded', String(open));
  };
  const handsBtn = h('button.pk-handsbtn', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'pk-hands', onclick: () => setHands(handsPanel.hidden) }, 'Mains');
  const outsideHands = (e) => { if (!handsPanel.hidden && !handsPanel.contains(e.target) && !handsBtn.contains(e.target)) setHands(false); };
  const escHands = (e) => { if (e.key === 'Escape' && !handsPanel.hidden) { setHands(false); handsBtn.focus(); } };
  document.addEventListener('pointerdown', outsideHands);
  document.addEventListener('keydown', escHands);
  const el = h('div.pk', h('div.pk-top', topInfo, handsPanel), felt, panel);
  root.append(el);

  function build() {
    built = true;
    const n = v.seats.length;
    const myIdx = v.seats.findIndex((s) => s.id === api.me.id);
    const narrow = (root.clientWidth || 400) < 420; // téléphone : joueurs un peu plus rentrés pour laisser de la place aux noms
    const many = n >= 7;
    el.classList.toggle('is-mid', n >= 4);
    el.classList.toggle('is-many', many);
    const rx = narrow ? (n <= 3 ? 37 : many ? 39 : 41) : n <= 3 ? 38 : 40;
    const ry = n <= 3 ? 44 : 41;
    v.seats.forEach((s, i) => {
      const r = (i - Math.max(myIdx, 0) + n) % n;
      const a = ((90 + (r * 360) / n) * Math.PI) / 180;
      const pos = { x: 50 + rx * Math.cos(a), y: 50 + ry * Math.sin(a) };
      // La mise se pose juste à côté de la plaque, côté centre (décalage en px pour ne jamais passer dessous).
      const betPos = { x: pos.x + (50 - pos.x) * 0.34, y: pos.y + (46 - pos.y) * 0.34 }; // repère approximatif des vols de jetons
      const ux = -Math.cos(a);
      const uy = -Math.sin(a);
      const hole = [cardSlot('sm'), cardSlot('sm')];
      const av = h('span.pk-av', { 'aria-hidden': 'true' });
      const nm = h('span.pk-name');
      const stack = h('span.pk-chips');
      const tag = h('span.pk-tag');
      const disc = h('span.pk-disc', { hidden: true }, 'D');
      const blind = h('span.pk-blind', { hidden: true });
      const clock = h('i');
      const plaque = h('div.pk-plaque', h('div.pk-who', av, nm), stack, h('div.pk-clock', clock));
      const seatEl = h('div.pk-seat', { role: 'group' }, h('div.pk-hole', hole), plaque, tag, disc, blind);
      seatEl.style.left = `${pos.x}%`;
      seatEl.style.top = `${pos.y}%`;
      const betEl = h('div.pk-bet', { hidden: true });
      // À 7 joueurs ou plus sur téléphone, les sièges de côté posent leur mise au-dessus d'eux : vers le centre, elle mordrait sur les cartes du tableau.
      const lateral = many && narrow && Math.abs(ux) > 0.8;
      betEl.style.left = lateral ? `calc(${pos.x}% + ${ux.toFixed(3)} * var(--sw) * 0.42)` : `calc(${pos.x}% + ${ux.toFixed(3)} * (var(--sw) / 2 + var(--bo)))`;
      betEl.style.top = lateral ? `calc(${pos.y}% - var(--bvu) * 1.35)` : `calc(${pos.y}% + ${uy.toFixed(3)} * ${uy > 0 ? 'var(--bvd)' : i === myIdx && many && narrow ? 'var(--bvu) * 1.25' : 'var(--bvu)'})`;
      felt.append(seatEl, betEl);
      seats.push({ el: seatEl, pos, betEl, betPos, hole, av, nm, stack, tag, disc, blind, clock, isMe: i === myIdx });
    });
  }

  // ——— Vols de jetons ———

  const pct = (p) => {
    const r = felt.getBoundingClientRect();
    return { x: (p.x / 100) * r.width, y: (p.y / 100) * r.height };
  };
  const potPos = () => {
    const r = felt.getBoundingClientRect();
    const p = potEl.getBoundingClientRect();
    return { x: p.left + p.width / 2 - r.left, y: p.top + p.height / 2 - r.top };
  };
  function fly(from, to, amount, delay = 0) {
    if (reduced() || !from || !to) return;
    const ghost = h('span.pk-ghost', chip(amount));
    ghost.style.left = `${from.x}px`;
    ghost.style.top = `${from.y}px`;
    felt.append(ghost);
    const anim = ghost.animate(
      [{ transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(0.85)`, opacity: 0.2 }],
      { duration: 620, delay, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'backwards' },
    );
    anim.finished.then(() => ghost.remove(), () => ghost.remove());
  }

  // ——— Affichage ———

  function resultLines() {
    const sd = v.showdown;
    if (!sd) return null;
    const winnersOf = (list) => list.map(name).join(' et ');
    let side = 0;
    return sd.pots.map((pot, i) => {
      let label = 'Pot';
      if (pot.refund) label = 'Mise non suivie';
      else if (sd.pots.length > 1) label = side++ === 0 ? 'Pot principal' : `Pot secondaire ${side - 1}`;
      void i;
      const how = sd.byFold ? 'tout le monde s’est couché' : pot.refund ? 'rendue' : sd.hands[pot.winners[0]]?.name || '';
      const part = pot.winners.length > 1 ? ` (${fmt(Math.floor(pot.amount / pot.winners.length))} chacun)` : '';
      return h('li', h('span.pk-rl', label), h('b', winnersOf(pot.winners)), h('span.pk-ra', `${fmt(pot.amount)}${part}`), h('em', how));
    });
  }

  function headline() {
    const sd = v.showdown;
    if (!sd) return '';
    const main = sd.pots.find((p) => !p.refund) || sd.pots[0];
    if (!main) return '';
    const names = main.winners.map(name);
    const me = main.winners.includes(api.me.id);
    if (names.length > 1) return `${names.join(' et ')} se partagent le pot`;
    return me ? 'Tu remportes le pot' : `${names[0]} remporte le pot`;
  }

  function renderSeats() {
    const sd = v.showdown;
    const result = v.phase !== 'hand';
    const hit = new Set();
    if (sd && !sd.byFold) {
      const winners = new Set(sd.pots.flatMap((p) => p.winners));
      for (const id of winners) for (const c of sd.hands[id]?.best || []) hit.add(c);
    }
    v.seats.forEach((s, i) => {
      const ui = seats[i];
      const user = api.user(s.id);
      const gain = sd?.gains?.[s.id] || 0;
      ui.av.textContent = user.avatar || '🙂';
      ui.nm.textContent = user.pseudo;
      ui.stack.textContent = s.out ? '0' : fmt(s.chips);
      const turn = v.phase === 'hand' && v.toAct === s.id;
      ui.el.classList.toggle('is-turn', turn);
      ui.el.classList.toggle('is-folded', s.folded);
      ui.el.classList.toggle('is-out', s.out);
      ui.el.classList.toggle('is-allin', s.allIn && s.inHand);
      ui.el.classList.toggle('is-me', ui.isMe);
      ui.el.classList.toggle('is-winner', result && gain > 0);
      let label = '';
      if (s.out) label = s.left ? 'Parti' : 'Éliminé';
      else if (result && gain > 0) label = `+${fmt(gain)}`;
      else if (s.folded) label = 'Couché';
      else if (s.allIn) label = 'Tapis';
      else if (v.phase === 'hand' && s.last && ACTION_LABEL[s.last.t]) label = ACTION_LABEL[s.last.t];
      ui.tag.textContent = label;
      ui.tag.hidden = !label;
      ui.el.setAttribute('aria-label', `${user.pseudo}${s.id === api.me.id ? ' (toi)' : ''}, ${s.out ? 'éliminé' : `${fmt(s.chips)} jetons`}${label ? `, ${label}` : ''}`);
      ui.disc.hidden = !(i === v.button && v.phase !== 'over' && !s.out);
      const sb = i === v.sbSeat;
      const bb = i === v.bbSeat;
      ui.blind.hidden = !(sb || bb) || s.out || v.phase === 'over';
      ui.blind.textContent = bb ? 'GB' : 'PB';
      ui.blind.title = bb ? 'Grosse blinde' : 'Petite blinde';
      // Cartes des adversaires (les tiennes sont en bas).
      const delay = (i % 4) * 90;
      if (ui.isMe || !s.inHand) {
        ui.hole.forEach((slot) => setCard(slot, undefined));
      } else {
        ui.hole.forEach((slot, k) => {
          setCard(slot, s.cards ? s.cards[k] : null, delay + k * 70);
          if (typeof slot._c === 'number') {
            slot.classList.toggle('is-hit', hit.has(slot._c));
            slot.classList.toggle('is-dim', hit.size > 0 && !hit.has(slot._c));
          }
        });
      }
      // Mise devant le joueur
      if (s.bet > 0) {
        ui.betEl.replaceChildren(chip(s.bet), h('b', fmt(s.bet)));
        ui.betEl.hidden = false;
      } else ui.betEl.hidden = true;
    });
  }

  function renderBoard() {
    const sd = v.showdown;
    const hit = new Set();
    if (sd && !sd.byFold) for (const id of new Set(sd.pots.flatMap((p) => p.winners))) for (const c of sd.hands[id]?.best || []) hit.add(c);
    const fresh = prev && prev.handNo === v.handNo ? prev.board : 0;
    board.forEach((slot, i) => {
      const c = v.board[i];
      setCard(slot, c, c === undefined ? null : Math.max(0, i - fresh) * 130);
      if (c !== undefined) {
        slot.classList.toggle('is-hit', hit.has(c));
        slot.classList.toggle('is-dim', hit.size > 0 && !hit.has(c));
      }
    });
    const bets = v.seats.reduce((n, s) => n + s.bet, 0);
    const collected = Math.max(0, v.pot - bets);
    const showPot = v.phase === 'hand' ? collected : 0;
    potStack.replaceChildren(showPot > 0 ? chipStack(showPot) : '');
    // Blindes posées mais rien encore au pot : on montre la somme des mises plutôt que « Pot vide ».
    const openBets = v.phase === 'hand' && showPot === 0 ? bets : 0;
    potLabel.textContent = showPot > 0 ? `Pot ${fmt(showPot)}` : openBets > 0 ? `Mises : ${fmt(openBets)}` : v.phase === 'result' ? '' : 'Pot vide';
    potEl.classList.toggle('is-empty', showPot === 0);
    potEl.hidden = v.phase !== 'hand' && showPot === 0;
    if (v.phase === 'hand') {
      resultEl.hidden = true;
      resultEl.replaceChildren();
    } else if (sd) {
      resultEl.hidden = false;
      resultEl.replaceChildren(h('p.pk-win', headline()), h('ul.pk-rows', resultLines()));
    }
  }

  function renderMine() {
    const s = v.seats.find((x) => x.id === api.me.id);
    const mine = s?.cards || [];
    const delayBase = prev && prev.handNo === v.handNo ? null : 200;
    myCards.forEach((slot, k) => {
      const c = mine[k];
      setCard(slot, c, delayBase === null ? null : delayBase + k * 120);
      slot.classList.toggle('is-folded', Boolean(s?.folded));
      if (typeof c === 'number' && v.showdown && !v.showdown.byFold) {
        const hit = new Set(v.showdown.pots.flatMap((p) => p.winners).flatMap((id) => v.showdown.hands[id]?.best || []));
        slot.classList.toggle('is-hit', hit.has(c));
        slot.classList.toggle('is-dim', hit.size > 0 && !hit.has(c));
      }
    });
    handEl.hidden = !s || !mine.length;
  }

  function renderTop() {
    const blinds = `Blindes ${fmt(v.sb)} / ${fmt(v.bb)}`;
    const next = v.nextBlinds ? ` · ${fmt(v.nextBlinds.sb)} / ${fmt(v.nextBlinds.bb)} dans ${v.handsToLevel} main${v.handsToLevel > 1 ? 's' : ''}` : '';
    const streets = { preflop: 'Avant le flop', flop: 'Flop', turn: 'Turn', river: 'River' };
    const hadFocus = document.activeElement === handsBtn;
    topInfo.replaceChildren(
      h('span.pk-hno', `Main ${v.handNo}`),
      h('span.pk-blinds', blinds + next),
      ...(v.phase === 'hand' ? [h('span.pk-street', streets[v.street])] : []),
      handsBtn, // le bouton « Mains » suit les pastilles, à la ligne si elles ne tiennent pas
    );
    if (hadFocus) handsBtn.focus({ preventScroll: true }); // replaceChildren fait perdre le focus au clavier
  }

  // Panneau d'actions
  let actionsSig = '';
  function renderActions(force = false) {
    const meSeat = v.seats.find((s) => s.id === api.me.id);
    const o = v.me;
    // On ne reconstruit les boutons que si quelque chose a changé pour toi (un spectateur qui arrive ne doit pas
    // faire perdre le curseur en plein geste).
    const sig = JSON.stringify([v.phase, v.handNo, v.street, v.toAct, o, v.currentBet, v.pot, meSeat?.chips, meSeat?.folded, meSeat?.out, meSeat?.allIn, v.winner, v.showdown?.gains, v.deadline && v.phase !== 'hand' ? 1 : 0]);
    if (!force && sig === actionsSig) return;
    actionsSig = sig;
    actionsEl.replaceChildren();
    raiseEl.replaceChildren();
    raiseEl.hidden = true;
    if (v.phase === 'over') {
      raiseOpen = false;
      statusEl.textContent = '';
      const winner = v.winner;
      actionsEl.append(h('div.pk-final',
        h('p.pk-final-title', winner === api.me.id ? 'Tu remportes la partie !' : winner ? `${api.user(winner).pseudo} remporte la partie` : 'Partie terminée'),
        h('ol.pk-rank', v.ranking.map((id, i) => h(`li${id === api.me.id ? '.is-me' : ''}`,
          h('span.pk-pos', String(i + 1)), h('span.pk-pn', api.user(id).pseudo), h('b', fmt(v.seats.find((s) => s.id === id).chips)))))));
      return;
    }
    if (v.phase === 'result') {
      raiseOpen = false;
      statusEl.textContent = `Main terminée. ${headline()}.`;
      actionsEl.append(h('p.pk-wait', 'Prochaine main dans ', h('span.pk-next')));
      return;
    }
    if (!meSeat) {
      statusEl.textContent = v.toAct ? `${api.user(v.toAct).pseudo} doit parler.` : '';
      actionsEl.append(h('p.pk-wait', 'Tu regardes la partie.'));
      return;
    }
    if (meSeat.out) {
      statusEl.textContent = '';
      actionsEl.append(h('p.pk-wait', meSeat.left ? 'Tu as quitté la partie.' : 'Tu es éliminé : tu regardes la fin de la partie.'));
      return;
    }
    if (!o) {
      raiseOpen = false;
      statusEl.textContent = meSeat.folded ? `Tu t’es couché. ${v.toAct ? `${api.user(v.toAct).pseudo} doit parler.` : ''}`
        : meSeat.allIn ? 'Tu es à tapis : plus qu’à attendre les cartes.' : v.toAct ? `${api.user(v.toAct).pseudo} doit parler.` : '';
      if (meSeat.folded) actionsEl.append(h('p.pk-wait', 'Attends la prochaine main.'));
      return;
    }

    // C'est à moi
    const key = `${v.handNo}-${v.street}-${v.currentBet}-${o.minTo}`;
    if (key !== raiseKey) {
      raiseKey = key;
      raiseTo = o.minTo;
      raiseOpen = false;
    }
    raiseTo = Math.min(Math.max(raiseTo, o.minTo), o.maxTo);
    statusEl.textContent = o.canCheck ? 'À toi de parler.' : `À toi de parler : ${fmt(o.toCall)} à suivre.`;

    const send = (action) => api.sendMove(action).catch(() => {});
    const callAll = o.toCall >= meSeat.chips;
    const fold = h('button.pk-btn.is-fold', { type: 'button', onclick: () => send({ type: 'fold' }) }, 'Se coucher');
    const call = o.canCheck
      ? h('button.pk-btn.is-call', { type: 'button', onclick: () => send({ type: 'check' }) }, 'Parole')
      : h('button.pk-btn.is-call', { type: 'button', onclick: () => send({ type: 'call' }) }, callAll ? `Tapis ${fmt(o.toCall)}` : `Suivre ${fmt(o.toCall)}`);
    const verb = v.currentBet === 0 ? 'Miser' : 'Relancer';
    const raise = o.canRaise
      ? h('button.pk-btn.is-raise', { type: 'button', 'aria-expanded': String(raiseOpen), 'aria-controls': 'pk-raise', onclick: () => { raiseOpen = !raiseOpen; renderActions(true); } }, raiseOpen ? 'Annuler' : verb)
      : null;
    actionsEl.append(fold, call, raise);
    if (!raiseOpen || !o.canRaise) return;

    // Curseur, boutons rapides et confirmation
    raiseEl.id = 'pk-raise';
    raiseEl.hidden = false;
    const potNow = v.pot;
    const quick = (frac) => Math.round(v.currentBet + frac * (potNow + o.toCall));
    const slider = h('input.pk-slider', { type: 'range', 'aria-label': 'Montant de la relance' });
    const number = h('input.pk-num', { type: 'number', inputMode: 'numeric', 'aria-label': 'Montant exact' });
    slider.min = String(o.minTo);
    slider.max = String(o.maxTo);
    slider.step = '1';
    number.min = String(o.minTo);
    number.max = String(o.maxTo);
    const confirm = h('button.pk-btn.is-go', { type: 'button' });
    const refresh = () => {
      slider.value = String(raiseTo);
      number.value = String(raiseTo);
      const all = raiseTo >= o.maxTo;
      confirm.textContent = all ? `Tapis ${fmt(o.maxTo)}` : `${verb} à ${fmt(raiseTo)}`;
      slider.setAttribute('aria-valuetext', `${fmt(raiseTo)} jetons`);
      const pctFill = o.maxTo > o.minTo ? ((raiseTo - o.minTo) / (o.maxTo - o.minTo)) * 100 : 100;
      slider.style.setProperty('--fill', `${pctFill}%`);
    };
    const setTo = (n) => {
      const x = Math.round(Number(n));
      raiseTo = Number.isFinite(x) ? Math.min(Math.max(x, o.minTo), o.maxTo) : o.minTo;
      refresh();
    };
    slider.addEventListener('input', () => setTo(slider.value));
    number.addEventListener('input', () => {
      const x = Math.round(Number(number.value));
      if (Number.isFinite(x) && x > 0) {
        raiseTo = Math.min(Math.max(x, o.minTo), o.maxTo);
        slider.value = String(raiseTo);
        confirm.textContent = raiseTo >= o.maxTo ? `Tapis ${fmt(o.maxTo)}` : `${verb} à ${fmt(raiseTo)}`;
      }
    });
    number.addEventListener('change', () => setTo(number.value));
    number.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        setTo(number.value);
        confirm.click();
      }
    });
    confirm.addEventListener('click', () => send(raiseTo >= o.maxTo ? { type: 'allin' } : { type: 'raise', to: raiseTo }));
    const quickBtn = (label, to, title) => h('button.pk-q', { type: 'button', title, onclick: () => setTo(to) }, label);
    raiseEl.append(
      h('div.pk-quick', quickBtn('Min', o.minTo, 'Relance minimale'), quickBtn('½ pot', quick(0.5), 'La moitié du pot'), quickBtn('Pot', quick(1), 'Le pot'), quickBtn('Tapis', o.maxTo, 'Tous tes jetons')),
      h('div.pk-amount', slider, number),
      confirm,
    );
    refresh();
  }

  // Minuteurs : barre du joueur qui doit parler, et compte à rebours entre deux mains.
  function tick() {
    if (!v) return;
    const left = v.deadline ? Math.max(0, v.deadline - api.now()) : 0;
    if (v.phase === 'hand') {
      v.seats.forEach((s, i) => {
        const active = v.toAct === s.id && v.deadline;
        seats[i].clock.style.transform = active ? `scaleX(${Math.min(1, left / turnTotal)})` : 'scaleX(0)';
        seats[i].el.classList.toggle('is-late', Boolean(active) && left < 6000);
      });
    } else {
      seats.forEach((ui) => { ui.clock.style.transform = 'scaleX(0)'; });
    }
    const next = el.querySelector('.pk-next');
    if (next) next.textContent = v.deadline ? `${Math.ceil(left / 1000)} s` : '';
  }
  const clock = setInterval(tick, 200);

  // Animations de jetons d'après le changement d'état
  function animate() {
    if (!prev || prev.handNo !== v.handNo) return;
    v.seats.forEach((s, i) => {
      const before = prev.bets[i] || 0;
      if (s.bet > before) fly(pct(seats[i].pos), pct(seats[i].betPos), s.bet - before);
      else if (before > 0 && s.bet === 0) fly(pct(seats[i].betPos), potPos(), before, 80);
    });
    if (v.phase !== 'hand' && prev.phase === 'hand' && v.showdown) {
      Object.entries(v.showdown.gains).forEach(([id, g], k) => {
        const i = v.seats.findIndex((s) => s.id === Number(id));
        if (g > 0 && i !== -1) fly(potPos(), pct(seats[i].pos), g, 700 + k * 120);
      });
    }
  }

  // Confettis : une pluie de petits rectangles de couleur quand tu gagnes.
  function confetti(count) {
    if (reduced()) return;
    const colors = ['#FF3DAE', '#19E3FF', '#FFE23A', '#3DFFB0', '#FF9F1C', '#FFFFFF'];
    const w = felt.getBoundingClientRect().width;
    for (let i = 0; i < count; i++) {
      const bit = h('span.pk-confetti');
      bit.style.left = `${Math.random() * w}px`;
      bit.style.background = colors[i % colors.length];
      felt.append(bit);
      const dx = (Math.random() - 0.5) * 120;
      const fall = felt.getBoundingClientRect().height * (0.7 + Math.random() * 0.3);
      bit.animate(
        [{ transform: 'translate(0, -20px) rotate(0deg)', opacity: 1 }, { transform: `translate(${dx}px, ${fall}px) rotate(${Math.random() * 720}deg)`, opacity: 0.9 }],
        { duration: 1400 + Math.random() * 900, delay: Math.random() * 400, easing: 'cubic-bezier(0.3, 0.2, 0.6, 1)', fill: 'backwards' },
      ).finished.then(() => bit.remove(), () => bit.remove());
    }
  }

  function render() {
    if (!built) build();
    el.classList.toggle('is-over', v.phase === 'over');
    renderTop();
    renderSeats();
    renderBoard();
    renderMine();
    if (v.deadline !== lastDeadline) {
      lastDeadline = v.deadline;
      turnTotal = Math.max(1000, v.deadline ? v.deadline - api.now() : 1);
    }
    renderActions();
    animate();
    if (prev && prev.phase === 'hand' && v.phase !== 'hand' && v.showdown?.gains?.[api.me.id] > 0) confetti(26);
    if (prev && prev.phase !== 'over' && v.phase === 'over' && v.winner === api.me.id) confetti(70);
    tick();
  }

  const off = api.onState((view) => {
    v = view;
    render();
    prev = { handNo: v.handNo, phase: v.phase, board: v.board.length, bets: v.seats.map((s) => s.bet) };
  });

  return () => {
    clearInterval(clock);
    document.removeEventListener('pointerdown', outsideHands);
    document.removeEventListener('keydown', escHands);
    off();
  };
}
