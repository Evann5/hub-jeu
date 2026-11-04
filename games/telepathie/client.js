// Télépathie côté navigateur : un cosmos en verre dépoli sous des aurores boréales. Les cartes sont des bulles translucides dont
// la teinte va du turquoise (1) au pêche (100), en passant par le bleu, le lilas et le rose. Tout le monde pose sa plus petite carte quand il le sent ; pas de minuteur, pas de tour.

// Vraies icônes (SVG) à la place des caractères ♥ et ★ : même forme partout, quelle que soit la police.
const ICONS = {
  heart: 'M12 21.2 4.1 13.6C1.6 11.1 1.6 7.2 4 4.9c2.2-2.1 5.5-1.8 7.2.4l.8 1 .8-1c1.7-2.200 5-2.500 7.200-.4 2.400 2.300 2.400 6.200-.1 8.700Z',
  star: 'm12 2.600 2.900 6 6.500.9-4.700 4.600 1.100 6.500L12 17.500 6.200 20.600l1.100-6.500L2.600 9.500l6.500-.9Z',
};
function icon(kind) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICONS[kind]);
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

const hue = (card) => Math.round((170 + ((card - 1) / 99) * 220) % 360);

// Étoiles scintillantes du fond : positions fixes (aucun hasard à chaque affichage), qui pétillent à tour de rôle.
function buildSky(h) {
  let x = 12345;
  const rnd = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
  const stars = Array.from({ length: 34 }, (_, i) => h(`i.c${i % 4}`, {
    style: `left:${(rnd() * 100).toFixed(1)}%;top:${(rnd() * 100).toFixed(1)}%;--s:${Math.round(7 + rnd() * 12)}px;animation-delay:${(rnd() * 4).toFixed(1)}s;animation-duration:${(2.2 + rnd() * 2.5).toFixed(1)}s`,
  }));
  return h('div.tp-sky', { 'aria-hidden': 'true' }, h('div.tp-nebula'), stars);
}

// Confettis de victoire : de petites pastilles qui retombent une fois (rien si l'animation est réduite).
function confetti(h, host) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = h('div.tp-confetti', { 'aria-hidden': 'true' }, Array.from({ length: 36 }, (_, i) => h(`i.c${i % 5}`, {
    style: `left:${((i * 37) % 100) + 0.5}%;animation-delay:${((i * 53) % 90) / 100}s;--dx:${((i * 29) % 60) - 30}px`,
  })));
  host.append(layer);
  setTimeout(() => layer.remove(), 4200);
}

export function mount(root, api) {
  const { h } = api;
  const el = h('div.tp');
  const live = h('p.tp-sr', { role: 'status', 'aria-live': 'polite' });
  root.append(buildSky(h), el, live);
  let v = null;
  let info = null;
  let announced = -1; // dernier événement annoncé aux lecteurs d'écran
  let animated = -1; // dernier événement animé
  let celebrated = false; // les confettis ne tombent qu'une fois

  const name = (id) => api.user(id).pseudo;
  const isMe = (id) => id === api.me.id;
  const orb = (card, cls = '') => h(`span.tp-orb${cls}`, { style: `--hue:${hue(card)}` }, h('b', String(card)));
  const alive = () => v.players.filter((id) => !v.left.includes(id));
  const playing = () => info.isPlayer && !v.left.includes(api.me.id);

  function lostText(lost) {
    const byPlayer = new Map();
    for (const l of lost) byPlayer.set(l.id, [...(byPlayer.get(l.id) || []), l.card]);
    return [...byPlayer].map(([id, cards]) => `${isMe(id) ? 'toi' : name(id)} (${cards.join(', ')})`).join(', ');
  }

  function noticeText(n) {
    if (!n) return '';
    const poser = (id, card) => `${isMe(id) ? 'Tu as posé' : `${name(id)} a posé`} le ${card}`;
    switch (n.kind) {
      case 'start': return 'Respire. La partie commence en silence.';
      case 'play': return `${poser(n.by, n.card)}.`;
      case 'mistake': return `Erreur ! ${poser(n.by, n.card)}, mais il restait des cartes plus petites : ${lostText(n.lost)}. Elles sont défaussées, une vie en moins.`;
      case 'star-ask': return `${isMe(n.by) ? 'Tu proposes' : `${name(n.by)} propose`} une étoile filante.`;
      case 'star-no': return `${isMe(n.by) ? 'Tu as refusé' : `${name(n.by)} a refusé`} l’étoile filante.`;
      case 'star': return `Étoile filante : chacun défausse sa plus petite carte${n.cards.length ? ` (${n.cards.map((c) => `${isMe(c.id) ? 'toi' : name(c.id)} ${c.card}`).join(', ')})` : ''}.`;
      case 'left': return `${isMe(n.by) ? 'Tu as quitté' : `${name(n.by)} a quitté`} la partie.`;
      case 'cleared': return `${n.prev && n.prev.kind !== 'start' ? `${noticeText(n.prev)} ` : ''}Niveau ${n.level} réussi${n.bonus === 'star' ? ' : une étoile en plus' : n.bonus === 'life' ? ' : une vie en plus' : ''}.`;
      case 'won': return `${n.prev ? `${noticeText(n.prev)} ` : ''}Tous les niveaux sont réussis !`;
      case 'lost': return `${n.prev ? `${noticeText(n.prev)} ` : ''}${n.why === 'alone' ? 'Il ne reste plus assez de joueurs.' : 'Plus de vie.'}`;
      default: return '';
    }
  }

  function meter(label, filled, max, kind) {
    return h('div.tp-meter', { role: 'img', 'aria-label': `${label} : ${filled} sur ${max}` },
      h('span.tp-meter-label', label),
      h('span.tp-meter-icons', { 'aria-hidden': 'true' }, Array.from({ length: max }, (_, i) => h(`i.is-${kind}${i < filled ? '.is-on' : ''}`, icon(kind)))));
  }

  function header() {
    return h('header.tp-head',
      h('div.tp-level', h('small', 'Niveau'), h('b', `${v.level}`), h('span', `sur ${v.levels}`)),
      meter('Vies', v.lives, v.livesMax, 'heart'),
      meter('Étoiles', v.stars, v.starsMax, 'star'));
  }

  function crew() {
    return h('ul.tp-crew', { 'aria-label': 'Joueurs' }, v.players.map((id) => {
      const gone = v.left.includes(id);
      const n = v.counts[id];
      const ready = v.phase === 'focus' && v.ready.includes(id);
      return h(`li${isMe(id) ? '.is-me' : ''}${gone ? '.is-gone' : ''}${ready ? '.is-ready' : ''}`,
        h('span.tp-av', { 'aria-hidden': 'true' }, api.user(id).avatar),
        h('span.tp-pseudo', name(id)),
        gone ? h('small', 'parti')
          : v.phase === 'focus' ? h('small', ready ? 'prêt' : 'se concentre')
            : v.phase === 'play' ? h('span.tp-pips', { 'aria-label': `${n} carte${n > 1 ? 's' : ''} en main` }, Array.from({ length: n }, () => h('i')), n === 0 ? h('small', 'terminé') : null)
              : null);
    }));
  }

  function pileView(isNew) {
    const top = v.pile[v.pile.length - 1];
    const trail = v.pile.slice(0, -1).slice(-8);
    return h('section.tp-pile', { 'aria-label': 'Pile commune' },
      h('div.tp-halo'),
      top ? orb(top.card, `.tp-top${isNew ? '.is-new' : ''}`) : h('span.tp-orb.is-empty', { 'aria-label': 'Aucune carte posée' }, h('b', '0')),
      h('p.tp-pile-info', top ? `Posé par ${isMe(top.by) ? 'toi' : name(top.by)}` : 'Rien n’est posé : la pile attend la première carte.'),
      trail.length ? h('ol.tp-trail', { 'aria-label': 'Cartes déjà posées' }, trail.map((p) => h('li', orb(p.card, '.is-mini')))) : null);
  }

  function starBox() {
    if (!playing()) return null;
    const sv = v.starVote;
    if (sv) {
      const need = alive().length;
      if (sv.yes.includes(api.me.id)) {
        return h('div.tp-star.is-open', h('p', `Étoile filante proposée : ${sv.yes.length} accord${sv.yes.length > 1 ? 's' : ''} sur ${need}. ${isMe(sv.by) ? 'Tu attends les autres.' : 'Tu as accepté.'}`),
          h('button.tp-btn.is-ghost', { type: 'button', dataset: { k: 'no' }, onclick: () => api.sendMove({ type: 'star-no' }).catch(() => {}) }, isMe(sv.by) ? 'Annuler la proposition' : 'Finalement non'));
      }
      return h('div.tp-star.is-open',
        h('p', h('b', name(sv.by)), ' propose une étoile filante : chacun défausse sa plus petite carte, sans perdre de vie. Tout le monde doit être d’accord.'),
        h('div.tp-row',
          h('button.tp-btn', { type: 'button', dataset: { k: 'yes' }, onclick: () => api.sendMove({ type: 'star-yes' }).catch(() => {}) }, 'D’accord'),
          h('button.tp-btn.is-ghost', { type: 'button', dataset: { k: 'no' }, onclick: () => api.sendMove({ type: 'star-no' }).catch(() => {}) }, 'Non')));
    }
    return h('div.tp-star',
      h('button.tp-btn.is-ghost', {
        type: 'button', dataset: { k: 'star' }, disabled: v.stars <= 0,
        onclick: () => api.sendMove({ type: 'star' }).catch(() => {}),
      }, icon('star'), `Proposer une étoile filante${v.stars <= 0 ? ' (plus aucune)' : ''}`),
      h('small', 'Chacun défausse sa plus petite carte, si tout le monde est d’accord.'));
  }

  function handView() {
    if (!playing() || !v.hand) return h('p.tp-watch', info.isPlayer ? 'Tu as quitté la partie : tu la regardes.' : 'Tu regardes la partie.');
    if (!v.hand.length) return h('p.tp-watch', 'Tu as posé toutes tes cartes. Reste concentré : les autres jouent encore.');
    const [lowest, ...rest] = v.hand;
    const blocked = Boolean(v.starVote);
    return h('section.tp-hand', { 'aria-label': 'Ta main' },
      h('button.tp-card', {
        type: 'button', dataset: { k: 'play' }, disabled: blocked,
        'aria-label': `Poser la carte ${lowest}`,
        onclick: () => api.sendMove({ type: 'play', card: lowest }).catch(() => {}),
      }, orb(lowest, '.is-big'), h('span.tp-card-label', blocked ? 'Réponds à l’étoile' : 'Poser')),
      rest.length ? h('ul.tp-rest', { 'aria-label': 'Tes autres cartes, de la plus petite à la plus grande' }, rest.map((c) => h('li', orb(c, '.is-small')))) : null);
  }

  function screenPlay() {
    const isNew = v.notice.id !== animated && ['play', 'mistake', 'star'].includes(v.notice.kind);
    animated = v.notice.id;
    const text = noticeText(v.notice);
    const quiet = ['play', 'start', 'cleared'].includes(v.notice.kind);
    return [
      header(), crew(), pileView(isNew),
      quiet ? null : h(`p.tp-notice${v.notice.kind === 'mistake' ? '.is-bad' : ''}`, text),
      // Une proposition d'étoile passe avant la main : sur téléphone, elle doit rester visible sans défiler.
      ...(v.starVote ? [starBox(), handView()] : [handView(), starBox()]),
    ];
  }

  function screenFocus() {
    const first = v.level === 1;
    const prev = v.notice.kind === 'cleared' ? noticeText(v.notice) : null;
    const me = playing();
    const ready = v.ready.includes(api.me.id);
    return [
      header(), crew(),
      h('section.tp-focus',
        h('div.tp-breath', { 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
        h('h2', 'Concentration'),
        prev ? h('p.tp-notice', prev) : null,
        h('p', first ? 'Chacun va recevoir une carte.' : `Niveau ${v.level} : chacun va recevoir ${v.level} cartes.`),
        h('p.tp-silence', 'Respire. Dès que les cartes sont distribuées, plus un mot : pas de chat pendant le niveau.'),
        me && !ready
          ? h('button.tp-btn.is-main', { type: 'button', dataset: { k: 'ready' }, onclick: () => api.sendMove({ type: 'ready' }).catch(() => {}) }, 'Prêt')
          : h('p.tp-wait', me ? 'Tu es prêt. On attend les autres…' : 'Les joueurs se concentrent…')),
    ];
  }

  function screenOver() {
    const won = v.result === 'won';
    return [
      header(), crew(),
      h('section.tp-end',
        h('div.tp-planets', { 'aria-hidden': 'true' }, orb(12, '.is-big'), orb(55, '.is-big'), orb(88, '.is-big')),
        h('h2', won ? 'Vous êtes synchrones' : 'Le fil s’est rompu'),
        h('p', won ? `Les ${v.levels} niveaux sont réussis, sans un mot. Bravo à toute l’équipe.` : `Vous êtes arrivés au niveau ${v.level} sur ${v.levels}. La prochaine fois sera la bonne.`),
        h('p.tp-notice', noticeText(v.notice)),
        v.burned.length && !won ? h('p.tp-small', `Cartes défaussées à ce niveau : ${lostText(v.burned)}.`) : null),
    ];
  }

  function render() {
    // On garde le focus clavier sur le même bouton après chaque redessin.
    const focusKey = el.contains(document.activeElement) ? document.activeElement.dataset?.k : null;
    const screens = { focus: screenFocus, play: screenPlay, over: screenOver };
    el.replaceChildren(...screens[v.phase]().filter(Boolean));
    el.querySelector('.tp-star.is-open')?.scrollIntoView({ block: 'nearest' });
    if (focusKey) el.querySelector(`[data-k="${focusKey}"]:not(:disabled)`)?.focus({ preventScroll: true });
    if (v.phase === 'over' && v.result === 'won' && !celebrated) { celebrated = true; confetti(h, root); }
    if (v.notice.id !== announced) {
      announced = v.notice.id;
      live.textContent = noticeText(v.notice);
    }
  }

  const off = api.onState((view, i) => {
    v = view;
    info = i;
    render();
  });

  return () => off();
}
