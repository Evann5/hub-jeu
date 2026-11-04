// Blackjack côté navigateur : synthwave pop. La banque en haut, les joueurs au milieu (toi en bas, en grand),
// tes boutons dessous. Les éléments sont reconstruits à chaque changement ; seules les cartes nouvelles s'animent.

const SUIT = ['♠', '♥', '♦', '♣'].map((s) => `${s}︎`);
const SUIT_NAME = ['pique', 'cœur', 'carreau', 'trèfle'];
const RANK_LABEL = { 11: 'V', 12: 'D', 13: 'R', 14: 'A' };
const RANK_NAME = { 2: 'deux', 3: 'trois', 4: 'quatre', 5: 'cinq', 6: 'six', 7: 'sept', 8: 'huit', 9: 'neuf', 10: 'dix', 11: 'valet', 12: 'dame', 13: 'roi', 14: 'as' };
const RESULT = { blackjack: 'Blackjack', win: 'Gagné', push: 'Égalité', lose: 'Perdu' };

const fmt = (n) => Number(n).toLocaleString('fr-FR');
const signed = (n) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '0');
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mount(root, api) {
  const { h } = api;
  let v = null;
  let prev = null;
  let betAmt = 10;
  let panelSig = '';
  let lastDeadline = null;
  let turnTotal = 1;
  const seen = new Set(); // cartes déjà affichées : elles ne s'animent plus

  const dealerEl = h('section.bj-dealer', { 'aria-label': 'La banque' });
  const seatsEl = h('section.bj-seats', { 'aria-label': 'Les joueurs' });
  const panel = h('div.bj-panel');
  const topEl = h('div.bj-top');
  const statusEl = h('p.bj-status', { 'aria-live': 'polite' });
  const meEl = h('section.bj-me', { 'aria-label': 'Ta main' });
  const table = h('div.bj-table', dealerEl, seatsEl);
  const el = h('div.bj', topEl, table, meEl, h('div.bj-bottom', statusEl, panel));
  root.append(el);

  // ——— Éléments ———

  function cardEl(c, key, size) {
    const fresh = key && !seen.has(key);
    if (key) seen.add(key);
    const node = h(`div.bj-card.${size}`);
    if (c === null) {
      node.classList.add('is-back');
      node.setAttribute('aria-label', 'Carte cachée de la banque');
      node.append(h('span.bj-pattern'));
    } else {
      const rank = (c % 13) + 2;
      const suit = Math.floor(c / 13);
      if (suit === 1 || suit === 2) node.classList.add('is-red');
      node.setAttribute('role', 'img');
      node.setAttribute('aria-label', `${RANK_NAME[rank]} de ${SUIT_NAME[suit]}`);
      if (rank === 10) node.classList.add('is-ten');
      node.append(h('span.bj-rk', RANK_LABEL[rank] || String(rank)), h('span.bj-st', SUIT[suit]), h('span.bj-big', { 'aria-hidden': 'true' }, SUIT[suit]));
    }
    if (fresh && !reduced()) node.classList.add('is-deal');
    return node;
  }

  function chipEl(amount) {
    const cls = amount >= 500 ? 'c3' : amount >= 100 ? 'c2' : amount >= 50 ? 'c1' : 'c0';
    return h(`span.bj-chip.${cls}`, { 'aria-hidden': 'true' });
  }

  function handEl(seat, hd, k, { mine, active }) {
    const size = mine ? 'lg' : 'sm';
    const key = (i) => `${v.round}-${seat.id}-${k}-${i}`;
    const badge = hd.result
      ? h(`span.bj-badge.r-${hd.forfeit ? 'lose' : hd.result}`, hd.forfeit ? 'Abandon' : `${RESULT[hd.result]} ${signed(hd.gain)}`)
      : hd.bust ? h('span.bj-badge.r-lose', 'Dépasse 21')
        : hd.natural ? h('span.bj-badge.r-blackjack', 'Blackjack !')
          : null;
    return h(`div.bj-hand${active ? '.is-active' : ''}${hd.result ? `.r-${hd.result}` : ''}`,
      h('div.bj-cards', hd.cards.map((c, i) => cardEl(c, key(i), size))),
      h('div.bj-meta',
        hd.cards.length ? h('span.bj-total', `${hd.total}${hd.soft ? ' souple' : ''}`) : null,
        hd.bet ? h('span.bj-bet', chipEl(hd.bet), fmt(hd.bet)) : null,
        hd.doubled ? h('span.bj-tag', 'Doublé') : null,
        badge));
  }

  function seatEl(seat) {
    const user = api.user(seat.id);
    const mine = seat.id === api.me.id;
    const turn = v.phase === 'play' && v.turn === seat.id;
    const waiting = v.phase === 'bet' && !seat.placed && !seat.out;
    const bits = [];
    if (seat.out) bits.push(seat.left ? 'Parti' : 'Éliminé');
    else if (v.phase === 'bet') bits.push(seat.placed ? 'A misé' : 'Mise…');
    const node = h(`article.bj-seat${mine ? '.is-me' : ''}${turn ? '.is-turn' : ''}${seat.out ? '.is-out' : ''}${waiting ? '.is-wait' : ''}`,
      { 'aria-label': `${user.pseudo}${mine ? ' (toi)' : ''}, ${fmt(seat.chips)} jetons${bits.length ? `, ${bits[0]}` : ''}` },
      h('header.bj-who',
        h('span.bj-av', { 'aria-hidden': 'true' }, user.avatar || '🙂'),
        h('span.bj-name', user.pseudo),
        h('b.bj-chips', fmt(seat.chips))),
      h('div.bj-hands', seat.hands.map((hd, k) => handEl(seat, hd, k, { mine, active: turn && seat.cur === k && !hd.done }))),
      bits.length ? h('span.bj-state', bits[0]) : null,
      h('div.bj-clock', h('i')));
    node.dataset.id = String(seat.id);
    return node;
  }

  // ——— Affichage ———

  function renderTop() {
    topEl.replaceChildren(
      h('span.bj-pill.is-pink', `Manche ${v.round} / ${v.rounds}`),
      h('span.bj-pill.is-cyan', `Sabot ${fmt(v.shoeLeft)}`),
    );
  }

  function renderDealer() {
    const d = v.dealer;
    const hiddenNow = d.cards.length > 0 && d.cards[1] === null;
    const flip = prev && prev.round === v.round && prev.hidden && !hiddenNow;
    const cards = d.cards.map((c, i) => {
      const node = cardEl(c, c === null ? null : `${v.round}-d-${i}`, 'lg');
      if (flip && i === 1 && !reduced()) node.classList.add('is-flip');
      return node;
    });
    let label = '';
    if (d.cards.length) label = hiddenNow ? `Montre ${d.shown === 11 ? 'un as' : d.shown}` : d.blackjack ? 'Blackjack !' : d.bust ? `Dépasse : ${d.value}` : `Total ${d.value}`;
    dealerEl.replaceChildren(
      h('div.bj-banque', h('span.bj-logo', 'Banque'),
        label ? h(`span.bj-total.is-dealer${d.bust ? '.is-bust' : ''}`, label) : null),
      h('div.bj-cards.is-dealer', d.cards.length ? cards : [h('div.bj-empty', { 'aria-hidden': 'true' }), h('div.bj-empty', { 'aria-hidden': 'true' })]),
    );
  }

  function renderSeats() {
    // Ta place est épinglée juste au-dessus de tes boutons : tes cartes restent visibles même si la table défile.
    const others = v.seats.filter((s) => s.id !== api.me.id);
    const mine = v.seats.filter((s) => s.id === api.me.id);
    seatsEl.dataset.count = String(others.length);
    seatsEl.hidden = !others.length;
    seatsEl.replaceChildren(...others.map(seatEl));
    meEl.hidden = !mine.length;
    meEl.replaceChildren(...mine.map(seatEl));
  }

  function renderStatus() {
    const meSeat = v.seats.find((s) => s.id === api.me.id);
    let text = '';
    if (v.phase === 'bet') {
      text = meSeat && !meSeat.placed && !meSeat.out ? 'Place ta mise.' : '';
    } else if (v.phase === 'play') {
      text = v.turn === api.me.id ? 'À toi de jouer.' : '';
    } else if (v.phase === 'result') {
      const d = meSeat?.delta || 0;
      text = !meSeat || meSeat.out && !meSeat.hands.length ? 'Manche terminée.' : d > 0 ? `Manche gagnée : ${signed(d)} jetons.` : d < 0 ? `Manche perdue : ${signed(d)} jetons.` : 'Manche à égalité : tu récupères ta mise.';
    } else text = '';
    statusEl.textContent = text;
  }

  function renderPanel(force = false) {
    const meSeat = v.seats.find((s) => s.id === api.me.id);
    const o = v.me;
    const sig = JSON.stringify([v.phase, v.round, v.turn, o, meSeat?.placed, meSeat?.out, meSeat?.chips, v.winners]);
    if (!force && sig === panelSig) return;
    panelSig = sig;
    panel.replaceChildren();
    const send = (action) => api.sendMove(action).catch(() => {});

    if (v.phase === 'over') {
      const first = v.winners.length ? v.winners.map((id) => api.user(id).pseudo).join(' et ') : null;
      panel.append(h('div.bj-final',
        h('p.bj-final-title', v.winners.includes(api.me.id) ? (v.solo ? 'Bien joué : tu repars avec plus !' : 'Tu es le plus riche !') : first ? `${first} ${v.winners.length > 1 ? 'gagnent' : 'gagne'}` : v.solo ? 'La banque gagne' : 'Partie terminée'),
        h('ol.bj-rank', v.ranking.map((id, i) => h(`li${id === api.me.id ? '.is-me' : ''}`,
          h('span.bj-pos', String(i + 1)), h('span.bj-pn', api.user(id).pseudo), h('b', fmt(v.seats.find((s) => s.id === id).chips)))))));
      return;
    }
    if (v.phase === 'result') {
      panel.append(h('p.bj-wait', 'Prochaine manche dans ', h('span.bj-next')));
      return;
    }
    if (!meSeat) {
      panel.append(h('p.bj-wait', 'Tu regardes la partie.'));
      return;
    }
    if (meSeat.out) {
      panel.append(h('p.bj-wait', meSeat.left ? 'Tu as quitté la partie.' : 'Tu n’as plus assez de jetons : tu regardes la fin.'));
      return;
    }
    if (v.phase === 'bet') {
      if (!o) {
        panel.append(h('p.bj-wait', 'Mise placée. En attente des autres joueurs…'));
        return;
      }
      betAmt = Math.min(Math.max(Math.round(betAmt / 10) * 10, o.minBet), o.maxBet);
      const input = h('input.bj-input', { type: 'number', inputMode: 'numeric', id: 'bj-amount', 'aria-label': 'Montant de la mise' });
      input.min = String(o.minBet);
      input.max = String(o.maxBet);
      input.step = '10';
      const go = h('button.bj-btn.is-go', { type: 'button' });
      const refresh = () => {
        input.value = String(betAmt);
        go.textContent = `Miser ${fmt(betAmt)}`;
      };
      const set = (n) => {
        const x = Math.round(Number(n) / 10) * 10;
        betAmt = Number.isFinite(x) ? Math.min(Math.max(x, o.minBet), o.maxBet) : o.minBet;
        refresh();
      };
      const add = (n) => set(betAmt + n);
      input.addEventListener('change', () => set(input.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          set(input.value);
          go.click();
        }
      });
      go.addEventListener('click', () => send({ type: 'bet', amount: betAmt }));
      const chipBtn = (n) => h(`button.bj-chipbtn.${n >= 500 ? 'c3' : n >= 100 ? 'c2' : n >= 50 ? 'c1' : 'c0'}`, { type: 'button', 'aria-label': `Ajouter ${n} jetons`, onclick: () => add(n) }, `+${n}`);
      panel.append(h('div.bj-betbox',
        h('div.bj-stepper',
          h('button.bj-step', { type: 'button', 'aria-label': 'Retirer 10 jetons', onclick: () => add(-10) }, '−'),
          h('label.bj-amountbox', h('span.bj-lbl', 'Ta mise'), input),
          h('button.bj-step', { type: 'button', 'aria-label': 'Ajouter 10 jetons', onclick: () => add(10) }, '+')),
        h('div.bj-chips-row', chipBtn(10), chipBtn(50), chipBtn(100), chipBtn(500),
          h('button.bj-chipbtn.is-all', { type: 'button', onclick: () => set(o.maxBet) }, 'Tapis')),
        go));
      refresh();
      return;
    }
    // Jeu
    if (!o) {
      panel.append(h('p.bj-wait', v.turn ? `${api.user(v.turn).pseudo} joue…` : 'La banque joue…'));
      return;
    }
    panel.append(h('div.bj-actions',
      h('button.bj-btn.is-hit', { type: 'button', onclick: () => send({ type: 'hit' }) }, 'Carte'),
      h('button.bj-btn.is-stand', { type: 'button', onclick: () => send({ type: 'stand' }) }, 'Rester'),
      h('button.bj-btn.is-double', { type: 'button', disabled: !o.canDouble, onclick: () => send({ type: 'double' }) }, 'Doubler'),
      h('button.bj-btn.is-split', { type: 'button', disabled: !o.canSplit, onclick: () => send({ type: 'split' }) }, 'Séparer')));
  }

  // Minuteur : barre sous le joueur actif, compte à rebours entre deux manches.
  function tick() {
    if (!v) return;
    const left = v.deadline ? Math.max(0, v.deadline - api.now()) : 0;
    el.querySelectorAll('.bj-clock i').forEach((bar) => {
      const seat = bar.closest('.bj-seat');
      const active = v.deadline && v.timer && ((v.phase === 'play' && v.turn === Number(seat.dataset.id)) || (v.phase === 'bet' && seat.classList.contains('is-wait')));
      bar.style.transform = active ? `scaleX(${Math.min(1, left / turnTotal)})` : 'scaleX(0)';
    });
    const next = el.querySelector('.bj-next');
    if (next) next.textContent = v.deadline ? `${Math.ceil(left / 1000)} s` : '';
  }
  const clock = setInterval(tick, 200);

  function confetti(count) {
    if (reduced()) return;
    const colors = ['#FF2FB9', '#19E3FF', '#B26BFF', '#FFE23A', '#FFFFFF'];
    const w = el.getBoundingClientRect().width;
    for (let i = 0; i < count; i++) {
      const bit = h('span.bj-confetti');
      bit.style.left = `${Math.random() * w}px`;
      bit.style.background = colors[i % colors.length];
      el.append(bit);
      bit.animate(
        [{ transform: 'translate(0, -20px) rotate(0deg)', opacity: 1 }, { transform: `translate(${(Math.random() - 0.5) * 140}px, ${el.getBoundingClientRect().height * 0.8}px) rotate(${Math.random() * 720}deg)`, opacity: 0.9 }],
        { duration: 1500 + Math.random() * 900, delay: Math.random() * 400, easing: 'cubic-bezier(0.3, 0.2, 0.6, 1)', fill: 'backwards' },
      ).finished.then(() => bit.remove(), () => bit.remove());
    }
  }

  function render() {
    if (!prev || prev.round !== v.round) {
      // Nouvelle manche : les cartes de l'ancienne n'ont plus de raison d'être mémorisées.
      if (prev && prev.round !== v.round) seen.clear();
    }
    renderTop();
    renderDealer();
    renderSeats();
    renderStatus();
    if (v.deadline !== lastDeadline) {
      lastDeadline = v.deadline;
      turnTotal = Math.max(1000, v.deadline ? v.deadline - api.now() : 1);
    }
    renderPanel();
    const meSeat = v.seats.find((s) => s.id === api.me.id);
    if (prev && prev.phase !== 'result' && prev.phase !== 'over' && (v.phase === 'result' || v.phase === 'over') && meSeat && meSeat.delta > 0) confetti(meSeat.hands.some((x) => x.result === 'blackjack') ? 60 : 30);
    if (prev && prev.phase !== 'over' && v.phase === 'over' && v.winners.includes(api.me.id)) confetti(70);
    tick();
  }

  const off = api.onState((view) => {
    v = view;
    render();
    prev = { round: v.round, phase: v.phase, hidden: v.dealer.cards.length > 0 && v.dealer.cards[1] === null };
  });

  return () => {
    clearInterval(clock);
    off();
  };
}
