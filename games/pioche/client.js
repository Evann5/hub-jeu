// Pioche ! côté navigateur : l'affichage et les clics. Le hub fournit api (voir docs/integration.md §8).
// Rien n'est calculé ici : le serveur dit quelles cartes sont jouables, qui peut piocher, annoncer ou dénoncer.

const NS = 'http://www.w3.org/2000/svg';
const COLOR_NAMES = { R: 'Rose', J: 'Jaune', V: 'Vert', B: 'Bleu' };
const COLORS = ['R', 'J', 'V', 'B'];

// Une forme par couleur : la couleur n'est jamais seule à porter l'information.
const SHAPES = {
  R: 'M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Z',
  J: 'M12 2.2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3l-6.1 3.5 1.4-6.8-5.1-4.7 6.9-.8Z',
  V: 'M12 3.4 21.4 20H2.6Z',
  B: 'M4.5 4.5h15v15h-15Z',
};
const GLYPHS = {
  X: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z M6 6l12 12',
  I: 'M4 8.5h13l-3.2-3.2 M20 15.5H7l3.2 3.2',
};

function svg(d, cls, { stroke = false } = {}) {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('class', cls);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d);
  if (stroke) {
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2.8');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
  } else {
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linejoin', 'round');
  }
  el.append(path);
  return el;
}

const shape = (c, cls = 'pi-shape') => svg(SHAPES[c], `${cls} s-${c}`);

// Les quatre formes réunies : le joker.
function jokerMark(cls) {
  const wrap = document.createElementNS(NS, 'svg');
  wrap.setAttribute('viewBox', '0 0 48 48');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.setAttribute('class', cls);
  COLORS.forEach((c, i) => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${(i % 2) * 24} ${Math.floor(i / 2) * 24})`);
    g.setAttribute('class', `s-${c}`);
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', SHAPES[c]);
    p.setAttribute('fill', 'currentColor');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-linejoin', 'round');
    g.append(p);
    wrap.append(g);
  });
  return wrap;
}

export function cardName(code) {
  if (code === 'WC') return 'Joker couleur';
  if (code === 'WF') return 'Joker +4';
  const v = code.slice(1);
  return `${COLOR_NAMES[code[0]]} ${v === 'X' ? 'passe' : v === 'I' ? 'sens inverse' : v}`;
}

export function mount(root, api) {
  const { h } = api;
  let view = null;
  let selected = null; // carte touchée une première fois (deuxième touche = la jouer)
  let picking = null; // joker en attente du choix de couleur
  let busy = false;
  let seenSeq = -1;
  let fresh = false; // une nouvelle carte vient d'arriver sur la défausse
  const clock = { deadline: null, from: 0 };

  const you = (id) => id === api.me.id;
  const name = (id) => (you(id) ? 'Toi' : api.user(id).pseudo);
  const sub = (id, a, b) => (you(id) ? `Tu ${a}` : `${api.user(id).pseudo} ${b}`);
  const poss = (id) => (you(id) ? 'ton' : 'son');
  const obj = (id) => (you(id) ? 'toi' : api.user(id).pseudo);

  // ——— Pièces de décor ———

  // Une carte (ou son dos). `tag` : 'button' pour la main, 'div' ailleurs.
  function face(code, tag = 'div', props = {}) {
    const wild = code[0] === 'W';
    const c = wild ? 'W' : code[0];
    const v = code.slice(1);
    const label = (cls) => {
      if (wild) return v === 'F' ? h('span', { class: cls }, '+4') : jokerMark(`${cls} pi-joker`);
      if (v === 'X') return svg(GLYPHS.X, `${cls} pi-glyph`, { stroke: true });
      if (v === 'I') return svg(GLYPHS.I, `${cls} pi-glyph`, { stroke: true });
      return h('span', { class: cls }, v);
    };
    return h(`${tag}.pi-card.c-${c}.v-${wild ? 'wild' : v === '+2' ? 'plus2' : v === 'X' ? 'skip' : v === 'I' ? 'rev' : 'num'}`,
      { ...props, 'aria-label': cardName(code) },
      h('span.pi-idx', { 'aria-hidden': 'true' }, label('pi-idx-v'), wild ? null : shape(c, 'pi-idx-s')),
      h('span.pi-spot', { 'aria-hidden': 'true' }, wild && v === 'F' ? jokerMark('pi-big pi-joker small') : null),
      wild && v === 'F' ? h('span.pi-big.pi-big-f', { 'aria-hidden': 'true' }, '+4') : label('pi-big'),
      wild ? h('span.pi-wild-tag', { 'aria-hidden': 'true' }, 'JOKER') : null,
      wild ? null : shape(c, 'pi-mark'));
  }

  function back(count) {
    return h('span.pi-card.pi-back', { 'aria-hidden': 'true' },
      h('span.pi-back-label', 'Pioche', h('b', '!')),
      count === undefined ? null : h('span.pi-count', String(count)));
  }

  // ——— Textes ———

  function describe(e) {
    switch (e.k) {
      case 'play': {
        let t = `${sub(e.by, 'poses', 'pose')} ${cardName(e.card)}`;
        if (e.card[0] === 'W') t += `, couleur demandée : ${COLOR_NAMES[e.color].toLowerCase()}`;
        if (e.draw) t += ` — ${sub(e.draw.to, 'pioches', 'pioche')} ${e.draw.n} carte${e.draw.n > 1 ? 's' : ''} et ${you(e.draw.to) ? 'passes' : 'passe'} ${poss(e.draw.to)} tour`;
        if (e.skipped) t += ` — ${sub(e.skipped, 'passes', 'passe')} ${poss(e.skipped)} tour`;
        if (e.reversed) t += ' — le sens change';
        if (e.stack) t += ` — cumul : +${e.stack}`;
        return `${t}.`;
      }
      case 'draw': return `${sub(e.by, 'pioches', 'pioche')} une carte.`;
      case 'stack': return `${sub(e.by, 'pioches', 'pioche')} tout le cumul : ${e.n} cartes !`;
      case 'pass': return `${sub(e.by, 'passes', 'passe')}.`;
      case 'call': return `${sub(e.by, 'annonces', 'annonce')} « Dernière ! »`;
      case 'accuse': return `${sub(e.by, 'dénonces', 'dénonce')} ${obj(e.target)} : ${sub(e.target, 'pioches', 'pioche')} ${e.n} cartes.`;
      case 'timeout': return `${sub(e.by, 'as', 'a')} trop tardé${e.n ? ` : ${you(e.by) ? 'tu pioches' : 'pioche'} ${e.n > 1 ? `${e.n} cartes` : 'une carte'}` : ''}.`;
      case 'left': return `${sub(e.by, 'abandonnes', 'abandonne')} la partie.`;
      case 'round': return `${sub(e.by, 'as gagné', 'a gagné')} la manche (+${e.gain} points).`;
      case 'deal': return `Manche ${e.round} : nouvelle donne.`;
      default: return '';
    }
  }

  // ——— Éléments fixes ———

  const els = {
    clockBar: h('span.pi-clock-bar'),
    clockText: h('span.pi-clock-text'),
    round: h('span.pi-round'),
    say: h('p.pi-say', { role: 'status' }),
    old: h('ul.pi-old', { 'aria-hidden': 'true' }),
    opps: h('ul.pi-opps', { 'aria-label': 'Joueurs' }),
    table: h('div.pi-table'),
    actions: h('div.pi-actions'),
    hand: h('div.pi-hand', { role: 'group', 'aria-label': 'Ta main' }),
    overlay: h('div.pi-overlay', { hidden: true }),
  };
  const countdown = h('span.pi-countdown');
  root.append(h('div.pi',
    h('div.pi-head',
      els.round,
      h('div.pi-clock', { hidden: true }, h('span.pi-clock-track', els.clockBar), els.clockText)),
    els.opps,
    els.table,
    h('div.pi-news', els.say, els.old),
    els.actions,
    els.hand,
    els.overlay));

  // ——— Dessin ———

  function nextSeatId() {
    // Qui jouera après la personne dont c'est le tour (selon le sens), pour l'étiquette « suivant ».
    const ids = view.players;
    const at = ids.indexOf(view.turn);
    if (at < 0) return null;
    for (let k = 1; k <= ids.length; k++) {
      const id = ids[(at + view.dir * k + ids.length * k) % ids.length];
      if (!view.out.includes(id)) return id;
    }
    return null;
  }

  function renderOpps() {
    const ids = view.players;
    const mine = ids.indexOf(api.me.id);
    // Les autres, à partir de celui qui est après moi autour de la table.
    const ordered = mine < 0 ? ids : [...ids.slice(mine + 1), ...ids.slice(0, mine)];
    const next = nextSeatId();
    els.opps.replaceChildren(...ordered.map((id) => {
      const n = view.counts[id];
      const out = view.out.includes(id);
      const turn = view.turn === id;
      const last = !out && n === 1;
      const danger = view.pending === id;
      const cls = ['pi-opp', turn && 'is-turn', out && 'is-out', danger && 'is-danger'].filter(Boolean).join('.');
      return h(`li.${cls}`,
        api.token(api.user(id), { size: 's' }),
        h('span.pi-opp-name', api.user(id).pseudo),
        out ? h('span.pi-tag', 'parti')
          : h('span.pi-opp-n', { title: `${n} carte${n > 1 ? 's' : ''}` },
            h('span.pi-mini', { 'aria-hidden': 'true' }), `${n}`, h('span.sr-only', ` carte${n > 1 ? 's' : ''}`)),
        last && view.called.includes(id) ? h('span.pi-tag.ok', 'Dernière !') : null,
        danger ? h('span.pi-tag.bad', 'Pas annoncé !') : null,
        turn ? h('span.sr-only', ', à son tour') : null,
        !turn && next === id && view.phase !== 'between' ? h('span.pi-tag.soft', 'suivant') : null);
    }));
  }

  function renderTable() {
    const top = view.top;
    const color = view.color;
    const revDir = view.dir === -1;
    const drawBtn = h('button.pi-pile', {
      type: 'button',
      disabled: !view.canDraw,
      'aria-label': view.stack ? `Piocher les ${view.stack} cartes du cumul` : `Piocher une carte (${view.drawCount} restantes)`,
      onclick: () => send({ type: 'draw' }),
    }, back(view.drawCount), view.canDraw ? h('span.pi-pile-hint', view.stack ? `Piocher ${view.stack}` : 'Piocher') : null);
    const topEl = face(top, 'div');
    topEl.classList.add('pi-top');
    if (fresh) topEl.classList.add('is-new');
    topEl.style.setProperty('--tilt', `${((view.log.at(-1)?.n || 0) % 5 - 2) * 2}deg`);
    els.table.replaceChildren(
      drawBtn,
      h('div.pi-discard', topEl,
        h(`div.pi-dir${revDir ? '.is-rev' : ''}`, { title: revDir ? 'Le sens est inversé' : 'Sens normal' },
          svg('M20 12a8 8 0 1 1-2.6-5.9 M20 4v5h-5', 'pi-dir-i', { stroke: true }),
          h('span.sr-only', revDir ? 'Sens inversé' : 'Sens normal')),
        h(`div.pi-want.c-${color}`, h('span.sr-only', 'Couleur demandée : '), shape(color, 'pi-want-s'), COLOR_NAMES[color])));
  }

  function renderNews() {
    const last = view.log.at(-1);
    let text;
    if (view.phase === 'over') text = 'Partie terminée.';
    else if (view.phase === 'between') text = 'Manche terminée.';
    else if (view.canAccuse) text = `${name(view.pending)} n'a pas annoncé « Dernière ! » : dénonce vite !`;
    else if (view.pending === api.me.id) text = 'Il te reste une carte : clique « Dernière ! » vite !';
    else if (picking) text = 'Choisis la couleur que tu demandes.';
    else if (view.turn === api.me.id && view.stack) {
      text = view.playable.length
        ? `Cumul de +${view.stack} sur toi : renchéris avec ${view.stackKind === 'F' ? 'un +4' : 'un +2 ou un +4'}, ou pioche les ${view.stack} cartes.`
        : `Cumul de +${view.stack} : rien pour renchérir, pioche les ${view.stack} cartes.`;
    } else if (view.turn && view.stack) text = `${api.user(view.turn).pseudo} doit renchérir ou piocher ${view.stack} cartes…`;
    else if (view.turn === api.me.id) {
      text = view.drawn ? `Tu as pioché ${cardName(view.drawn)} : joue-la ou passe.`
        : view.playable.length ? 'À toi de jouer.'
          : 'Aucune carte ne va : pioche !';
    } else if (view.turn) text = `${api.user(view.turn).pseudo} réfléchit…`;
    else text = '';
    if (!api.me || api.seat < 0) text = `Tu regardes la partie. ${view.turn ? `${api.user(view.turn).pseudo} joue.` : ''}`;
    els.say.textContent = text;
    // Les derniers événements, du plus récent au plus ancien (lecture seule, sans annonce vocale).
    const recent = view.log.slice(-4).reverse().map((e) => describe(e)).filter(Boolean);
    els.old.replaceChildren(...recent.map((t, i) => h('li', { class: i === 0 ? 'is-latest' : '' }, t)));
  }

  function renderActions() {
    const buttons = [];
    if (view.canAccuse) {
      buttons.push(h('button.pi-btn.bad', { type: 'button', onclick: () => send({ type: 'accuse' }) }, `Dénoncer ${name(view.pending)} !`));
    }
    if (view.canCall) {
      const urgent = view.pending === api.me.id;
      buttons.push(h(`button.pi-btn.call${urgent ? '.is-urgent' : ''}`, { type: 'button', onclick: () => send({ type: 'call' }) }, 'Dernière !'));
    }
    if (view.canPass) buttons.push(h('button.pi-btn', { type: 'button', onclick: () => send({ type: 'pass' }) }, 'Passer'));
    if (selected && view.playable.includes(selected) && !picking) {
      buttons.push(h('button.pi-btn.go', { type: 'button', onclick: () => playCard(selected) }, `Jouer ${cardName(selected)}`));
    }
    els.actions.replaceChildren(...buttons);
    els.actions.hidden = !buttons.length;
  }

  function renderHand() {
    if (selected && !view.hand.includes(selected)) selected = null;
    const myTurn = view.turn === api.me.id;
    els.hand.replaceChildren(...view.hand.map((code, i) => {
      const ok = view.playable.includes(code);
      const el = face(code, 'button', {
        type: 'button',
        'aria-pressed': String(code === selected),
        'aria-disabled': String(!ok),
        onclick: () => touch(code),
      });
      el.classList.add('pi-h');
      if (ok) el.classList.add('is-ok');
      else if (myTurn) el.classList.add('is-no');
      if (code === selected) el.classList.add('is-selected');
      if (view.drawn === code) el.classList.add('is-drawn');
      el.style.zIndex = String(i + 1);
      return el;
    }));
    els.hand.hidden = api.seat < 0 || !view.hand.length;
  }

  // Choix de la couleur après un joker.
  function renderPicker() {
    if (!picking) return null;
    const pick = (c) => {
      const card = picking;
      picking = null;
      send({ type: 'play', card, color: c });
    };
    const box = h('div.pi-picker', { role: 'dialog', 'aria-modal': 'false', 'aria-label': 'Choisis la couleur demandée' },
      h('p', 'Quelle couleur demandes-tu ?'),
      h('div.pi-picker-row', COLORS.map((c) => h(`button.pi-color.c-${c}`, { type: 'button', onclick: () => pick(c) },
        shape(c, 'pi-color-s'), COLOR_NAMES[c]))),
      h('button.pi-btn.ghost', { type: 'button', onclick: () => { picking = null; render(); } }, 'Annuler'));
    box.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { picking = null; render(); }
    });
    return box;
  }

  function renderOverlay() {
    const rr = view.roundResult;
    if ((view.phase !== 'between' && view.phase !== 'over') || !rr) {
      els.overlay.hidden = true;
      els.overlay.replaceChildren();
      return;
    }
    const over = view.phase === 'over';
    const rows = [...view.players].sort((a, b) => (view.scores[b] || 0) - (view.scores[a] || 0))
      .map((id, i) => h(`li.pi-score${view.winners.includes(id) ? '.is-win' : ''}`,
        h('span.pi-score-rank', String(i + 1)),
        api.token(api.user(id), { size: 's' }),
        h('span.pi-score-name', api.user(id).pseudo, view.out.includes(id) ? h('small', ' (parti)') : null),
        id === rr.winner ? h('span.pi-score-gain', `+${rr.gain}`) : null,
        h('b.pi-score-pts', String(view.scores[id] || 0), h('span.sr-only', ' points'))));
    const pts = `${rr.gain} point${rr.gain > 1 ? 's' : ''}`;
    const winnerLine = view.rounds === 1 && over
      ? `${sub(rr.winner, 'as gagné', 'a gagné')} : ${pts} restaient dans les mains des autres.`
      : `${sub(rr.winner, 'as vidé ta', 'a vidé sa')} main : +${pts}.`;
    let actions = null;
    if (over) {
      const names = view.winners.map((id) => api.user(id).pseudo).join(' et ');
      // One-round game: the line above already names the winner.
      actions = view.rounds === 1 ? null : h('p.pi-final', view.winners.length === 1 && you(view.winners[0]) ? 'Tu gagnes la partie !' : `${names} gagne${view.winners.length > 1 ? 'nt' : ''} la partie !`);
    } else if (api.seat >= 0) {
      actions = h('div.pi-next',
        h('button.pi-btn.go', { type: 'button', onclick: () => send({ type: 'next' }) }, 'Manche suivante'),
        h('p', 'Elle démarre toute seule dans ', countdown, ' s.'));
    }
    els.overlay.hidden = false;
    els.overlay.replaceChildren(h('section.pi-panel', { 'aria-label': 'Résultat de la manche' },
      h('h2', over ? 'Partie terminée' : `Manche ${view.round} sur ${view.rounds}`),
      h('p.pi-panel-line', winnerLine),
      h('ol.pi-scores', rows),
      actions));
  }

  function render() {
    if (!view) return;
    if (picking && !view.playable.includes(picking)) picking = null;
    const seq = view.log.at(-1)?.n ?? 0;
    fresh = seenSeq !== -1 && seq !== seenSeq && view.log.at(-1)?.k === 'play';
    seenSeq = seq;
    els.round.textContent = view.rounds > 1 ? `Manche ${view.round} sur ${view.rounds}` : 'Une manche';
    renderOpps();
    renderTable();
    renderNews();
    renderActions();
    renderHand();
    const picker = renderPicker();
    if (picker) {
      els.actions.hidden = false;
      els.actions.append(picker);
      picker.querySelector('button')?.focus();
    }
    renderOverlay();
    // Le compte à rebours repart quand l'échéance change.
    if (view.deadline !== clock.deadline) {
      clock.deadline = view.deadline;
      clock.from = api.now();
    }
    updateClock();
  }

  function updateClock() {
    if (!view) return;
    const box = els.clockBar.closest('.pi-clock');
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
    selected = null;
    api.sendMove(action).catch(() => { busy = false; render(); });
  }

  function playCard(code) {
    if (code[0] === 'W') {
      picking = code;
      render();
    } else {
      send({ type: 'play', card: code });
    }
  }

  function touch(code) {
    if (api.seat < 0 || picking) return;
    if (view.turn !== api.me.id) {
      api.toast("Ce n'est pas encore ton tour.");
      return;
    }
    if (!view.playable.includes(code)) {
      api.toast(view.drawn ? 'Joue la carte que tu viens de piocher, ou passe.' : 'Cette carte ne va pas : même couleur, même valeur, ou un joker.');
      return;
    }
    if (selected === code) playCard(code);
    else {
      selected = code;
      render();
      els.hand.querySelector('.is-selected')?.focus();
    }
  }

  const off = api.onState((v) => {
    busy = false;
    view = v;
    render();
  });
  const tick = setInterval(updateClock, 250);

  return () => {
    clearInterval(tick);
    off();
  };
}
