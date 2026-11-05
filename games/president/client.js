// Président côté navigateur : l'affichage et les clics. Le hub fournit api (voir docs/integration.md §8).
// Rien n'est décidé ici : le serveur dit quelles valeurs on peut poser, si on peut passer, qui joue.

const NS = 'http://www.w3.org/2000/svg';
const SUIT_NAMES = { S: 'pique', H: 'cœur', D: 'carreau', C: 'trèfle' };
const SUIT_PATHS = {
  H: 'M12 21.3C4.2 14.8 2 11.4 2 7.9 2 5.1 4.2 3 6.9 3c2.1 0 4 1.2 5.1 3.2C13.1 4.2 15 3 17.1 3 19.8 3 22 5.1 22 7.9c0 3.5-2.2 6.9-10 13.4Z',
  D: 'M12 1.8 20.6 12 12 22.2 3.4 12Z',
  S: 'M12 1.6C12 1.6 3 8.9 3 14.2c0 2.9 2.2 4.6 4.6 4.6 1.6 0 2.9-.7 3.7-1.9-.1 2.5-1 4.2-2.9 5.6h7.2c-1.9-1.4-2.8-3.1-2.9-5.6.8 1.2 2.1 1.9 3.7 1.9 2.4 0 4.6-1.7 4.6-4.6C21 8.9 12 1.6 12 1.6Z',
  C: 'M12 2.1a4.4 4.4 0 0 0-3.5 7 4.4 4.4 0 1 0 2.7 7.8c-.1 2.4-1 4.1-2.9 5.5h7.4c-1.9-1.4-2.8-3.1-2.9-5.5a4.4 4.4 0 1 0 2.7-7.8A4.4 4.4 0 0 0 12 2.1Z',
};
const isRed = (code) => code.endsWith('H') || code.endsWith('D');
const rankText = (code) => code.slice(0, -1);
const suitOf = (code) => code.slice(-1);

const RANK_ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const RANK_ONE = { J: 'un valet', Q: 'une dame', K: 'un roi', A: 'un as' };
const RANK_PLURAL = { J: 'valets', Q: 'dames', K: 'rois', A: 'as' };
const RANK_NAME = { J: 'valet', Q: 'dame', K: 'roi', A: 'as' };
const oneOf = (r) => RANK_ONE[r] || `un ${r}`;
const manyOf = (r) => RANK_PLURAL[r] || r;
const cardLabel = (code) => `${RANK_NAME[rankText(code)] || rankText(code)} de ${SUIT_NAMES[suitOf(code)]}`;

// Positions des symboles au centre d'une carte (x : 0 à 2 = gauche, centre, droite ; y : fraction de la hauteur).
const COLS = [0.28, 0.5, 0.72];
const ROWS3 = [0.15, 0.5, 0.85];
const ROWS4 = [0.15, 0.383, 0.617, 0.85];
const PIPS = {
  2: [[1, 0.15], [1, 0.85]],
  3: [[1, 0.15], [1, 0.5], [1, 0.85]],
  4: [[0, 0.15], [2, 0.15], [0, 0.85], [2, 0.85]],
  5: [[0, 0.15], [2, 0.15], [1, 0.5], [0, 0.85], [2, 0.85]],
  6: ROWS3.flatMap((y) => [[0, y], [2, y]]),
  7: [...ROWS3.flatMap((y) => [[0, y], [2, y]]), [1, 0.325]],
  8: [...ROWS3.flatMap((y) => [[0, y], [2, y]]), [1, 0.325], [1, 0.675]],
  9: [...ROWS4.flatMap((y) => [[0, y], [2, y]]), [1, 0.5]],
  10: [...ROWS4.flatMap((y) => [[0, y], [2, y]]), [1, 0.266], [1, 0.734]],
};

function suitSvg(suit, cls) {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('class', cls);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', SUIT_PATHS[suit]);
  path.setAttribute('fill', 'currentColor');
  el.append(path);
  return el;
}

// Couronne sticker : jaune, gros contour.
function crown(cls = 'pr-crown') {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '0 0 32 26');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('class', cls);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M3.5 21.5 2 7.5l7 5.5L16 3l7 10 7-5.5-1.5 14Z');
  path.setAttribute('fill', '#FFE94A');
  path.setAttribute('stroke', '#14062F');
  path.setAttribute('stroke-width', '2.6');
  path.setAttribute('stroke-linejoin', 'round');
  el.append(path);
  return el;
}

// Confettis qui tombent (décor, coupé avec prefers-reduced-motion).
function confetti(h, n = 22) {
  const colors = ['#FF3EA5', '#2EE6D6', '#FFE94A', '#7B3CFF', '#FF8A3D'];
  return h('div.pr-confetti', { 'aria-hidden': 'true' }, Array.from({ length: n }, (_, i) =>
    h('i', { style: `--x:${(i * 37) % 100}%;--d:${2.6 + (i % 5) * 0.5}s;--w:${-(i % 7) * 0.45}s;--c:${colors[i % colors.length]}` })));
}

// Couronne ou étoile des figures (J, Q, K).
const COURT_ICONS = {
  K: 'M3 18.5 2 7l5.5 4.5L12 4l4.5 7.5L22 7l-1 11.5Z M3.5 21h17',
  Q: 'M3 18.5 2.5 9l4.5 4 5-8 5 8 4.5-4L21 18.5Z M3.5 21h17 M12 2.2h.01',
  J: 'M12 2.5l2.6 6.2 6.6.5-5 4.4 1.6 6.5L12 16.5l-5.8 3.6 1.6-6.5-5-4.4 6.6-.5Z',
};
function courtIcon(rank) {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('class', 'pr-court-i');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', COURT_ICONS[rank]);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  el.append(path);
  return el;
}

export function mount(root, api) {
  const { h } = api;
  let view = null;
  let selected = []; // cartes choisies, prêtes à être posées (ou données)
  let busy = false;
  let seenSeq = -1;
  let fresh = false;
  const clock = { deadline: null, from: 0 };

  const you = (id) => id === api.me.id;
  const sub = (id, a, b) => (you(id) ? `Tu ${a}` : `${api.user(id).pseudo} ${b}`);
  const poss = (id) => (you(id) ? 'ton' : 'son');

  // ——— Cartes ———

  function face(code, tag = 'div', props = {}) {
    const rank = rankText(code);
    const suit = suitOf(code);
    const corner = (cls) => h(`span.pr-corner.${cls}`, { 'aria-hidden': 'true' }, h('b', rank), suitSvg(suit, 'pr-suit'));
    let center;
    if (PIPS[rank]) {
      center = h('span.pr-pips', { 'aria-hidden': 'true' }, PIPS[rank].map(([col, y]) => {
        const s = suitSvg(suit, `pr-pip${y > 0.5 ? ' is-flip' : ''}`);
        s.style.left = `${COLS[col] * 100}%`;
        s.style.top = `${y * 100}%`;
        return s;
      }));
    } else if (rank === 'A') {
      center = h('span.pr-pips', { 'aria-hidden': 'true' }, suitSvg(suit, 'pr-ace'));
    } else {
      center = h('span.pr-pips.is-court', { 'aria-hidden': 'true' },
        h('span.pr-court',
          suitSvg(suit, 'pr-court-s.top'),
          courtIcon(rank),
          h('span.pr-court-l', rank),
          suitSvg(suit, 'pr-court-s.bot')));
    }
    return h(`${tag}.pr-card.${isRed(code) ? 'red' : 'black'}`,
      { ...props, 'aria-label': cardLabel(code) },
      corner('tl'), corner('br'), center);
  }

  // ——— Textes ———

  function playText(cards) {
    const r = rankText(cards[0]);
    if (cards.length === 1) return oneOf(r);
    const word = { 2: 'une paire de', 3: 'un brelan de', 4: 'un carré de' }[cards.length];
    return `${word} ${manyOf(r)}`;
  }

  function describe(e) {
    switch (e.k) {
      case 'play': return `${sub(e.by, 'poses', 'pose')} ${playText(e.cards)}${e.equal ? ' (valeur égale)' : ''}.`;
      case 'skip': return `${sub(e.target, 'sautes', 'saute')} ${poss(e.target)} tour.`;
      case 'pass': return `${sub(e.by, 'passes', 'passe')}.`;
      case 'clear': return `Le pli est ramassé : ${you(e.next) ? 'tu rouvres' : e.next ? `${api.user(e.next).pseudo} ouvre` : 'à suivre'}.`;
      case 'two': return 'La plus forte carte ! Elle ramasse le pli.';
      case 'revolution': return e.on ? `${sub(e.by, 'poses', 'pose')} un carré : révolution, l'ordre s'inverse !` : `${sub(e.by, 'poses', 'pose')} un carré : contre-révolution, l'ordre revient.`;
      case 'out': return `${sub(e.by, 'as', 'a')} fini ses cartes : ${e.pos + 1}${e.pos === 0 ? 're' : 'e'} place.`;
      case 'exchange': return `${sub(e.pauvre, 'donnes', 'donne')} ${e.cards.map(cardLabel).join(' et ')} à ${you(e.president) ? 'toi' : api.user(e.president).pseudo}.`;
      case 'given': return `${sub(e.by, 'as', 'a')} rendu 2 cartes à ${you(e.to) ? 'toi' : api.user(e.to).pseudo}.`;
      case 'timeout': return `${sub(e.by, 'as', 'a')} trop tardé.`;
      case 'left': return `${sub(e.by, 'abandonnes', 'abandonne')} la partie.`;
      case 'round': return 'Manche terminée.';
      default: return '';
    }
  }

  // ——— Éléments fixes ———

  const els = {
    round: h('span.pr-round'),
    clockBar: h('span.pr-clock-bar'),
    clockText: h('span.pr-clock-text'),
    seats: h('ul.pr-seats', { 'aria-label': 'Joueurs' }),
    felt: h('div.pr-felt'),
    say: h('p.pr-say', { role: 'status' }),
    old: h('ul.pr-old', { 'aria-hidden': 'true' }),
    actions: h('div.pr-actions'),
    hand: h('div.pr-hand', { role: 'group', 'aria-label': 'Ta main' }),
    overlay: h('div.pr-overlay', { hidden: true }),
  };
  const countdown = h('span.pr-countdown');
  root.append(h('div.pr',
    h('div.pr-head', els.round, h('div.pr-clock', { hidden: true }, h('span.pr-clock-track', els.clockBar), els.clockText)),
    els.seats,
    els.felt,
    h('div.pr-news', els.say, els.old),
    els.actions,
    els.hand,
    els.overlay));

  // ——— Dessin ———

  function renderSeats() {
    const ids = view.players;
    const mine = ids.indexOf(api.me.id);
    const ordered = mine < 0 ? ids : [...ids.slice(mine + 1), ...ids.slice(0, mine), ids[mine]];
    const showPts = view.rounds > 1;
    els.seats.replaceChildren(...ordered.map((id) => {
      const n = view.counts[id];
      const out = view.out.includes(id);
      const done = view.finished.indexOf(id);
      const turn = view.turn === id;
      const role = view.roles[id];
      const cls = ['pr-seat', turn && 'is-turn', (out || done >= 0) && 'is-done', you(id) && 'is-me'].filter(Boolean).join('.');
      return h(`li.${cls}`,
        api.token(api.user(id), { size: 's' }),
        h('span.pr-seat-main',
          h('span.pr-seat-name', you(id) ? 'Toi' : api.user(id).pseudo),
          role ? h('span.pr-role', role === 'Président' ? crown() : null, role) : null),
        showPts ? h('span.pr-pts', String(view.scores[id] || 0), h('small', ' pt'), h('span.sr-only', `${(view.scores[id] || 0) > 1 ? ' points' : ' point'} au total`)) : null,
        out ? h('span.pr-tag', 'parti')
          : done >= 0 ? h('span.pr-tag.gold', `${done + 1}${done === 0 ? 'er' : 'e'}`)
            : you(id) ? null
              : h('span.pr-seat-n', h('span.pr-mini', { 'aria-hidden': 'true' }), `${n}`, h('span.sr-only', ` carte${n > 1 ? 's' : ''}`)),
        view.passed.includes(id) ? h('span.pr-tag', 'passe') : null,
        turn ? h('span.sr-only', ', à son tour') : null);
    }));
  }

  function renderFelt() {
    const parts = [];
    if (view.phase === 'exchange') {
      const ex = view.exchange;
      parts.push(h('div.pr-exchange',
        h('p.pr-ex-title', 'Échange de cartes'),
        h('p', `${sub(ex.pauvre, 'donnes', 'donne')} ${you(ex.pauvre) ? 'tes' : 'ses'} 2 meilleures cartes à ${you(ex.president) ? 'toi' : api.user(ex.president).pseudo} :`),
        h('div.pr-ex-cards', ex.received.map((c) => face(c))),
        ex.vice ? h('p.pr-ex-vice', `Vice-pauvre et Vice-président échangent une carte (${api.user(ex.vice.vpauvre).pseudo} ↔ ${api.user(ex.vice.vp).pseudo}).`) : null));
    } else if (view.pli) {
      const stack = view.stack.slice(-2);
      const prev = stack.map((cards, i) => h('div.pr-play.is-old', { style: `--o:${stack.length - i}` }, cards.map((c) => face(c))));
      const cur = h(`div.pr-play.is-top${fresh ? '.is-new' : ''}`, view.pli.cards.map((c) => face(c)));
      cur.dataset.count = String(view.pli.count);
      parts.push(h('div.pr-pli', ...prev, cur,
        h('p.pr-pli-cap', `${sub(view.pli.by, 'as posé', 'a posé')} ${playText(view.pli.cards)}`)));
    } else {
      parts.push(h('div.pr-empty',
        h('p.pr-empty-t', view.phase === 'between' || view.phase === 'over' ? 'Fin de manche' : 'Table vide'),
        view.turn ? h('p', `${you(view.turn) ? 'Tu ouvres' : `${api.user(view.turn).pseudo} ouvre`}.`) : null));
    }
    els.felt.replaceChildren(...parts);
  }

  function renderNews() {
    const myTurn = view.turn === api.me.id;
    let text = '';
    if (api.seat < 0) text = `Tu regardes la partie.${view.turn ? ` ${api.user(view.turn).pseudo} joue.` : ''}`;
    else if (view.phase === 'over') text = 'Partie terminée.';
    else if (view.phase === 'between') text = 'Manche terminée.';
    else if (view.phase === 'exchange') {
      text = you(view.exchange.president)
        ? 'Tu es Président ! Choisis 2 cartes à rendre au Pauvre (les cartes dorées viennent de lui).'
        : `${api.user(view.exchange.president).pseudo} choisit 2 cartes à rendre au Pauvre.`;
    } else if (myTurn) {
      if (view.pli) {
        text = view.playable.length
          ? `À toi : ${view.pli.count} carte${view.pli.count > 1 ? 's' : ''} de ${manyOf(RANK_ORDER[view.pli.rank])} ou ${view.revolution ? 'plus faible' : 'plus fort'}.`
          : 'Tu ne peux rien poser : passe.';
      } else text = 'À toi d\'ouvrir : 1 à 4 cartes de même valeur.';
    } else if (view.turn) text = `${api.user(view.turn).pseudo} réfléchit…`;
    if (view.revolution && view.phase === 'play') text = `Révolution ! L'ordre est inversé : le 3 est la plus forte. ${text}`;
    els.say.textContent = text;
    root.classList.toggle('is-revolution', Boolean(view.revolution) && view.phase === 'play');
    const recent = view.log.filter((e) => e.k !== 'play').slice(-1).map(describe).filter(Boolean);
    els.old.replaceChildren(...recent.map((t, i) => h('li', { class: i === 0 ? 'is-latest' : '' }, t)));
  }

  function validSelection() {
    if (view.phase === 'exchange') return selected.length === 2;
    if (!selected.length) return false;
    return view.pli ? selected.length === view.pli.count : selected.length >= 1 && selected.length <= 4;
  }

  function renderActions() {
    const buttons = [];
    const myTurn = view.turn === api.me.id;
    const giving = view.phase === 'exchange' && api.seat >= 0 && you(view.exchange.president) && !view.exchange.done;
    if (giving) {
      buttons.push(h('button.pr-btn.go', {
        type: 'button',
        disabled: !validSelection(),
        onclick: () => send({ type: 'give', cards: selected }),
      }, validSelection() ? 'Donner ces 2 cartes' : `Choisis 2 cartes (${selected.length}/2)`));
    }
    if (myTurn) {
      const n = selected.length;
      buttons.push(h('button.pr-btn.go', {
        type: 'button',
        disabled: !validSelection(),
        onclick: () => send({ type: 'play', cards: selected }),
      }, n ? `Poser ${n} carte${n > 1 ? 's' : ''}` : 'Poser'));
      if (view.canPass) buttons.push(h('button.pr-btn', { type: 'button', onclick: () => send({ type: 'pass' }) }, 'Passer'));
    }
    els.actions.replaceChildren(...buttons);
    els.actions.hidden = !buttons.length;
  }

  function renderHand() {
    const myTurn = view.turn === api.me.id;
    const giving = view.phase === 'exchange' && api.seat >= 0 && you(view.exchange.president) && !view.exchange.done;
    selected = selected.filter((c) => view.hand.includes(c));
    const received = giving ? view.exchange.received : [];
    const cards = view.hand.map((code, i) => {
      const r = rankText(code);
      const ok = giving || (myTurn && view.playable.includes(r));
      const el = face(code, 'button', {
        type: 'button',
        'aria-pressed': String(selected.includes(code)),
        'aria-disabled': String(!ok),
        onclick: () => touch(code),
      });
      el.classList.add('pr-h');
      if (ok) el.classList.add('is-ok');
      else if (myTurn) el.classList.add('is-no');
      if (selected.includes(code)) el.classList.add('is-selected');
      if (received.includes(code)) el.classList.add('is-received');
      el.style.zIndex = String(i + 1);
      return el;
    });
    els.hand.hidden = api.seat < 0 || !view.hand.length;
    layoutHand(cards);
  }

  // Les cartes se chevauchent juste assez pour tenir sur une rangée ; si elles deviendraient trop étroites
  // pour le doigt (17 cartes à trois joueurs sur téléphone), on les range sur deux rangées.
  function layoutHand(cards) {
    const n = cards.length;
    const cw = parseFloat(getComputedStyle(els.hand).getPropertyValue('--cw')) || 64;
    const avail = Math.max(0, els.hand.clientWidth - 16);
    const stepFor = (len) => (len > 1 ? Math.min(cw * 0.62, (avail - cw) / (len - 1)) : 0);
    const two = n > 9 && stepFor(n) < 26;
    const rows = two ? [cards.slice(0, Math.ceil(n / 2)), cards.slice(Math.ceil(n / 2))] : [cards];
    els.hand.classList.toggle('is-two', two);
    els.hand.replaceChildren(...rows.map((row) => {
      const fan = h('div.pr-fan', ...row);
      fan.style.setProperty('--step', `${Math.max(14, stepFor(row.length)).toFixed(1)}px`);
      return fan;
    }));
  }

  function renderOverlay() {
    const res = view.result;
    if ((view.phase !== 'between' && view.phase !== 'over') || !res) {
      els.overlay.hidden = true;
      els.overlay.replaceChildren();
      return;
    }
    const over = view.phase === 'over';
    const rows = res.order.map((id, i) => h(`li.pr-rank${i === 0 ? '.is-first' : ''}`,
      h('span.pr-rank-pos', String(i + 1)),
      api.token(api.user(id), { size: 's' }),
      h('span.pr-rank-name', api.user(id).pseudo, h('small', res.titles[id] === 'Président' ? crown() : null, res.titles[id])),
      h('span.pr-rank-gain', `+${res.gains[id]}`),
      h('b.pr-rank-pts', String(view.scores[id] || 0), h('span.sr-only', (view.scores[id] || 0) > 1 ? ' points' : ' point'))));
    let foot = null;
    if (over) {
      const names = view.winners.map((id) => api.user(id).pseudo).join(' et ');
      const best = Math.max(...res.order.map((id) => view.scores[id] || 0));
      const tie = res.order.filter((id) => (view.scores[id] || 0) === best).length > 1;
      foot = h('div.pr-end',
        h('p.pr-final', view.winners.length === 1 && you(view.winners[0]) ? 'Tu gagnes la partie !' : `${names} gagne la partie !`),
        tie ? h('p.pr-hint', 'Égalité de points : départage sur la dernière manche.') : null);
    } else if (api.seat >= 0) {
      foot = h('div.pr-next',
        h('button.pr-btn.go', { type: 'button', onclick: () => send({ type: 'next' }) }, 'Manche suivante'),
        h('p', 'Elle démarre toute seule dans ', countdown, ' s.'));
    }
    els.overlay.hidden = false;
    els.overlay.replaceChildren(h('section.pr-panel', { 'aria-label': 'Résultat de la manche' },
      api.seat < 0 || (over ? view.winners.includes(api.me.id) : you(res.order[0])) ? confetti(h) : null,
      crown('pr-crown big'),
      h('h2', over ? 'Partie terminée' : `Manche ${view.round} sur ${view.rounds}`),
      h('p.pr-panel-line', `${sub(res.order[0], 'es', 'est')} Président${view.phase === 'over' ? ' de la dernière manche' : ''}.`),
      h('ol.pr-ranks', rows),
      h('p.pr-hint', 'Points de la manche, puis total.'),
      foot));
  }

  function render() {
    if (!view) return;
    const seq = view.log.at(-1)?.n ?? 0;
    fresh = seenSeq !== -1 && seq !== seenSeq;
    seenSeq = seq;
    els.round.textContent = view.rounds > 1 ? `Manche ${view.round} sur ${view.rounds}` : 'Une manche';
    renderSeats();
    renderFelt();
    renderNews();
    renderActions();
    renderHand();
    renderOverlay();
    if (view.deadline !== clock.deadline) {
      clock.deadline = view.deadline;
      clock.from = api.now();
    }
    updateClock();
  }

  function updateClock() {
    if (!view) return;
    const box = els.clockBar.closest('.pr-clock');
    if (!view.deadline || view.phase === 'over') {
      box.hidden = true;
      countdown.textContent = '';
      return;
    }
    const left = Math.max(0, view.deadline - api.now());
    const total = Math.max(1, view.deadline - clock.from);
    box.hidden = view.phase === 'between';
    els.clockBar.style.transform = `scaleX(${Math.min(1, left / total)})`;
    els.clockText.textContent = `${Math.ceil(left / 1000)} s`;
    box.classList.toggle('is-low', left < 6000);
    countdown.textContent = String(Math.ceil(left / 1000));
  }

  // ——— Actions du joueur ———

  function send(action) {
    if (busy) return;
    busy = true;
    selected = [];
    api.sendMove(action).catch(() => { busy = false; render(); });
  }

  function touch(code) {
    if (api.seat < 0) return;
    const giving = view.phase === 'exchange' && you(view.exchange.president) && !view.exchange.done;
    if (giving) {
      selected = selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code].slice(-2);
      render();
      return;
    }
    if (view.turn !== api.me.id) {
      api.toast("Ce n'est pas encore ton tour.");
      return;
    }
    const r = rankText(code);
    if (!view.playable.includes(r)) {
      api.toast(view.pli
        ? `Il faut ${view.pli.count} carte${view.pli.count > 1 ? 's' : ''} de ${manyOf(RANK_ORDER[view.pli.rank])} ou ${view.revolution ? 'plus faible' : 'plus fort'}.`
        : 'Cette carte ne peut pas être posée.');
      return;
    }
    const sameRank = view.hand.filter((c) => rankText(c) === r);
    if (view.pli) {
      // Le nombre de cartes est imposé : on prend celle touchée et ses sœurs.
      const group = [code, ...sameRank.filter((c) => c !== code)].slice(0, view.pli.count);
      selected = selected.includes(code) && selected.length === group.length ? [] : group;
    } else if (selected.length && rankText(selected[0]) !== r) {
      selected = [code];
    } else if (selected.includes(code)) {
      selected = selected.filter((c) => c !== code);
    } else {
      selected = [...selected, code].slice(0, 4);
    }
    render();
    els.hand.querySelector('.is-selected')?.focus();
  }

  const off = api.onState((v) => {
    busy = false;
    view = v;
    render();
  });
  const tick = setInterval(updateClock, 250);
  let lastW = 0;
  const resize = new ResizeObserver(() => { const w = els.hand.clientWidth; if (view && w !== lastW) { lastW = w; renderHand(); } });
  resize.observe(els.hand);

  return () => {
    clearInterval(tick);
    resize.disconnect();
    off();
  };
}
