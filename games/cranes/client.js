// Crânes et roses côté navigateur : fête des morts, papel picado et disques peints.
// L'état arrive de view() : mes disques sont connus, ceux des autres seulement une fois retournés.

const SVG = 'http://www.w3.org/2000/svg';

// Dessins des disques (constantes, jamais de données dans le HTML des SVG).
const ART = {
  back: '<circle cx="32" cy="32" r="29" fill="#0FA3B1" stroke="#03101F" stroke-width="4"/>'
    + '<circle cx="32" cy="32" r="21" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="1 6" stroke-linecap="round"/>'
    + '<path d="M32 14l4.2 13.8L50 32l-13.8 4.2L32 50l-4.2-13.8L14 32l13.8-4.2z" fill="#F6FF3D" stroke="#03101F" stroke-width="2.5" stroke-linejoin="round"/>'
    + '<ellipse cx="22" cy="15" rx="9" ry="4.5" transform="rotate(-30 22 15)" fill="#fff" opacity="0.4"/>',
  rose: '<circle cx="32" cy="32" r="29" fill="#F6FF3D" stroke="#03101F" stroke-width="4"/>'
    + '<path d="M13 44c4-8 10-6 12-2-4 4-9 6-12 2zM51 44c-4-8-10-6-12-2 4 4 9 6 12 2z" fill="#00E5C8" stroke="#03101F" stroke-width="2"/>'
    + '<g fill="#FF2E93" stroke="#03101F" stroke-width="2"><circle cx="32" cy="17" r="8"/><circle cx="46" cy="27" r="8"/><circle cx="41" cy="43" r="8"/><circle cx="23" cy="43" r="8"/><circle cx="18" cy="27" r="8"/></g>'
    + '<circle cx="32" cy="32" r="9" fill="#FF8A1F" stroke="#03101F" stroke-width="2"/><circle cx="29" cy="29" r="2.6" fill="#fff" opacity="0.8"/>',
  skull: '<circle cx="32" cy="32" r="29" fill="#00E5C8" stroke="#03101F" stroke-width="4"/>'
    + '<path d="M32 11c-10 0-16 6-16 15 0 5 2 8 5 10v8c0 2 1 3 3 3h16c2 0 3-1 3-3v-8c3-2 5-5 5-10 0-9-6-15-16-15z" fill="#fff" stroke="#03101F" stroke-width="2.5" stroke-linejoin="round"/>'
    + '<circle cx="24.5" cy="27" r="6" fill="#03101F"/><circle cx="39.5" cy="27" r="6" fill="#03101F"/>'
    + '<circle cx="24.5" cy="27" r="3" fill="#FF2E93"/><circle cx="39.5" cy="27" r="3" fill="#F6FF3D"/>'
    + '<path d="M32 33l-3.2 5h6.4z" fill="#03101F"/><path d="M25 45v5M32 45v5M39 45v5" stroke="#03101F" stroke-width="2.4" stroke-linecap="round"/>'
    + '<circle cx="32" cy="12" r="3.4" fill="#FF8A1F" stroke="#03101F" stroke-width="1.8"/><circle cx="23" cy="14" r="2.8" fill="#FF2E93" stroke="#03101F" stroke-width="1.8"/><circle cx="41" cy="14" r="2.8" fill="#FF2E93" stroke="#03101F" stroke-width="1.8"/>',
  star: '<path d="M32 4l7 20 21 1-17 12 6 21-17-12-17 12 6-21L4 25l21-1z" fill="currentColor" stroke="#03101F" stroke-width="4" stroke-linejoin="round" paint-order="stroke"/>',
};

function art(kind, cls = '') {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('aria-hidden', 'true');
  if (cls) svg.setAttribute('class', cls);
  svg.innerHTML = ART[kind];
  return svg;
}

const FLAGS = ['#FF2E93', '#F6FF3D', '#00E5C8', '#FF8A1F', '#5BF0FF', '#3D8BFF'];

export function mount(root, api) {
  const { h } = api;
  const el = h('div.cr');
  root.append(el);
  let v = null;
  let info = null;
  let bidDraft = 1;
  let lastDeadline = null;
  let span = 0; // durée totale de l'échéance en cours, pour la barre de temps
  let seen = null; // disques déjà affichés au dessin précédent : les nouveaux rebondissent
  let fresh = new Set();
  let confettiShown = false;

  const me = api.me.id;
  const name = (id) => (id === me ? 'Toi' : api.user(id).pseudo);
  const send = (action) => api.sendMove(action).catch(() => {});
  const canAct = () => info.turn.includes(me);
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

  // ——— Éléments ———

  const disc = (kind, label) => h('span.cr-disc', { role: 'img', 'aria-label': label }, art(kind));

  function flags() {
    return h('div.cr-flags', { 'aria-hidden': 'true' }, Array.from({ length: 16 }, (_, i) => h('i', { style: `--c:${FLAGS[i % FLAGS.length]};--d:${(i % 5) * -0.7}s` })));
  }

  function timer() {
    return h('div.cr-time', { 'aria-hidden': 'true' }, h('span.cr-clock'), h('div.cr-bar', h('i')));
  }

  function tick() {
    const box = el.querySelector('.cr-time');
    if (!box) return;
    const dl = v?.deadline;
    if (!dl) { box.hidden = true; return; }
    box.hidden = false;
    const left = Math.max(0, dl - api.now());
    const s = Math.ceil(left / 1000);
    box.querySelector('.cr-clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    box.querySelector('.cr-bar i').style.width = `${span ? Math.min(100, (left / span) * 100) : 0}%`;
    box.classList.toggle('is-low', s <= 10);
  }
  const clock = setInterval(tick, 250);

  // ——— Pile d'un joueur ———

  // Les disques sont rangés du dessus (à gauche) vers le dessous : on retourne de gauche à droite.
  function pile(id) {
    const items = v.piles[id];
    const n = items.length;
    const nextIdx = n - 1 - (v.piles[id].filter((d) => d.up).length); // indice du prochain disque à retourner
    const flipping = v.phase === 'flip' && canAct() && v.challenger === me;
    const ownDone = v.piles[me]?.every((d) => d.up);
    const canTake = flipping && id !== me ? ownDone && nextIdx >= 0 : flipping && id === me && nextIdx >= 0;
    const row = h('div.cr-pile', { 'aria-label': `Pile (${name(id)}) : ${plural(n, 'disque', 'disques')}` });
    if (!n) row.append(h('span.cr-empty', 'aucun disque posé'));
    for (let i = n - 1, z = n; i >= 0; i--, z--) {
      const d = items[i];
      const kind = d.k ?? 'back';
      const mine = id === me && !d.up;
      const label = d.up ? (d.k === 's' ? 'crâne retourné' : 'rose retournée') : mine ? `ton disque (${d.k === 's' ? 'crâne' : 'rose'}), caché aux autres` : 'disque face cachée';
      const face = kind === 's' ? 'skull' : kind === 'r' ? 'rose' : 'back';
      const wrap = canTake && i === nextIdx
        ? h('button.cr-disc.is-take', {
          type: 'button',
          dataset: { key: `flip-${id}` },
          style: `z-index:${z}`,
          'aria-label': id === me ? 'Retourner ta pile' : `Retourner le disque du dessus de la pile (${name(id)})`,
          onclick: () => send({ type: 'flip', target: id }),
        }, art(face))
        : h(`span.cr-disc${mine ? '.is-mine' : ''}${d.up ? '.is-up' : ''}`, { role: 'img', 'aria-label': label, style: `z-index:${z}` }, art(face));
      const key = `${id}:${i}:${d.up ? d.k : 'b'}`;
      fresh.add(key);
      if (seen && !seen.has(key)) wrap.classList.add('pop');
      row.append(wrap);
    }
    return row;
  }

  function mat(id) {
    const out = v.out.includes(id);
    const isActor = !out && info.turn.includes(id) && !['result', 'over'].includes(v.phase);
    const pips = h('span.cr-pips', { 'aria-label': `${v.score[id]} point${v.score[id] > 1 ? 's' : ''} sur 2` },
      [0, 1].map((i) => h(`i${i < v.score[id] ? '.on' : ''}`, art('star'))));
    const tags = [];
    if (v.challenger === id && ['flip'].includes(v.phase)) tags.push(h('span.cr-tag.is-hot', `Défi : ${v.bid.n}`));
    else if (v.bid && v.bid.by === id && v.phase === 'bid') tags.push(h('span.cr-tag.is-hot', `Enchère : ${v.bid.n}`));
    if (v.passed.includes(id) && v.phase === 'bid') tags.push(h('span.cr-tag', 'a passé'));
    if (out) tags.push(h('span.cr-tag.is-out', v.left.includes(id) ? 'a quitté' : 'éliminé'));
    if (v.phase === 'over' && v.winner === id) tags.push(h('span.cr-tag.is-win', 'gagne'));
    return h(`li.cr-mat${isActor ? '.is-turn' : ''}${out ? '.is-out' : ''}${id === me ? '.is-me' : ''}`,
      h('div.cr-who',
        api.token(api.user(id), { size: 's' }),
        h('div.cr-meta',
          h('span.cr-name', id === me ? `${api.user(id).pseudo} (toi)` : api.user(id).pseudo),
          isActor ? h('span.sr-only', ', à son tour') : null,
          h('div.cr-sub', pips,
            h('span.cr-count', { 'aria-label': plural(v.discs[id], 'disque en jeu', 'disques en jeu') }, out ? '–' : [h('b', String(v.discs[id])), art('back', 'cr-count-ico')])))),
      pile(id),
      tags.length ? h('div.cr-tags', tags) : null);
  }

  // ——— Bandeau d'état ———

  function banner() {
    const actor = v.actor;
    const cName = v.challenger ? name(v.challenger) : '';
        switch (v.phase) {
      case 'place1': {
        const done = v.order.filter((id) => !v.out.includes(id) && v.piles[id].length > 0).length;
        const all = v.order.filter((id) => !v.out.includes(id)).length;
        return actor === me
          ? ['À toi : pose un disque.', 'Rose ou crâne, face cachée.']
          : [`${name(actor)} pose son disque…`, `${done} sur ${all} ont posé.`];
      }
      case 'choose':
        return actor === me
          ? ['À toi : pose ou défie.', 'Ajoute un disque, ou parie combien de roses tu retournes.']
          : [`${name(actor)} réfléchit…`, `${plural(v.total, 'disque', 'disques')} sur la table.`];
      case 'bid':
        return actor === me
          ? [`Défi à ${v.bid.n} : surenchéris ou passe.`, `${v.bid.by === me ? 'Tu paries' : `${name(v.bid.by)} parie`} ${plural(v.bid.n, 'disque', 'disques')} sur ${v.total}.`]
          : [`${name(actor)} hésite…`, `${v.bid.by === me ? 'Tu paries' : `${name(v.bid.by)} parie`} ${plural(v.bid.n, 'disque', 'disques')} sur ${v.total}.`];
      case 'flip': {
        const own = v.piles[v.challenger].some((d) => !d.up);
        const left = v.bid.n - v.flipped;
        if (v.challenger === me) {
          return own
            ? ['Retourne ta propre pile.', `Touche ton disque du dessus. Il te faut ${plural(v.bid.n, 'rose', 'roses')} sans crâne.`]
            : [`Encore ${plural(left, 'rose', 'roses')} à trouver.`, 'Touche le disque du dessus de la pile d’un autre.'];
        }
        return [`${cName} tente de retourner ${plural(v.bid.n, 'disque', 'disques')}.`, `${v.flipped} sur ${v.bid.n} retournés. ${own ? `${cName} retourne d’abord sa pile.` : `${cName} choisit une pile…`}`];
      }
      case 'result': {
        const r = v.result;
        if (r.kind === 'success') return [`${cName} réussit son défi !`, `${r.challenger === me ? 'Tu marques' : 'Il marque'} un point (${v.score[r.challenger]} sur 2).`];
        const lost = v.lost ? ` Tu as perdu ${v.lost === 'skull' ? 'ton crâne' : 'une rose'}.` : ' Personne ne sait quel disque il perd.';
        const who = r.skullOwner === r.challenger ? (r.challenger === me ? 'ton propre crâne' : 'son propre crâne') : `le crâne posé par ${name(r.skullOwner)}`;
        return [`Crâne ! ${r.challenger === me ? 'Tu perds' : `${cName} perd`} un disque.`, `${r.challenger === me ? 'Tu es tombé' : `${cName} est tombé`} sur ${who}.${r.eliminated ? ` ${r.challenger === me ? 'Tu es éliminé.' : 'Il est éliminé.'}` : ''}${r.challenger === me ? lost : ''}`];
      }
      case 'over':
        return [v.winner === me ? 'Tu gagnes la partie !' : `${name(v.winner)} gagne la partie !`, 'Tous les disques sont retournés.'];
      default:
        return ['', ''];
    }
  }

  // ——— Zone d'action ———

  function handRow() {
    const hd = v.hand;
    const can = canAct() && ['place1', 'choose'].includes(v.phase);
    const roses = [];
    for (let i = 0; i < hd.roses; i++) roses.push(i);
    const btn = (kind, label, onclick, key) => h('button.cr-disc.cr-hand', {
      type: 'button', disabled: !can, 'aria-label': label, dataset: { key }, onclick,
    }, art(kind));
    return h('div.cr-hand-row',
      h('div.cr-hand', { role: 'group', 'aria-label': 'Ta main' },
        roses.map((i) => btn('rose', `Poser une rose (${hd.roses} en main)`, () => send({ type: 'place', disc: 'rose' }), `rose-${i}`)),
        hd.skull ? btn('skull', 'Poser le crâne', () => send({ type: 'place', disc: 'skull' }), 'skull') : null,
        !hd.roses && !hd.skull ? h('span.cr-empty', 'Tout est posé : lance un défi.') : null));
  }

  function bidPanel() {
    const min = (v.bid?.n ?? 0) + 1;
    const max = v.total;
    bidDraft = Math.min(max, Math.max(min, bidDraft));
    const set = (n) => { bidDraft = Math.min(max, Math.max(min, n)); render(); };
    return h('div.cr-bid',
      h('div.cr-stepper',
        h('button.cr-step', { type: 'button', disabled: bidDraft <= min, 'aria-label': 'Moins', dataset: { key: 'minus' }, onclick: () => set(bidDraft - 1) }, '−'),
        h('output', { 'aria-live': 'polite', 'aria-label': plural(bidDraft, 'disque', 'disques') }, String(bidDraft)),
        h('button.cr-step', { type: 'button', disabled: bidDraft >= max, 'aria-label': 'Plus', dataset: { key: 'plus' }, onclick: () => set(bidDraft + 1) }, '+')),
      h('button.cr-btn.is-main', { type: 'button', dataset: { key: 'bid' }, onclick: () => send({ type: 'bid', n: bidDraft }) },
        v.phase === 'choose' ? `Défier : ${plural(bidDraft, 'disque', 'disques')}` : `Monter à ${bidDraft}`),
      v.phase === 'bid' ? h('button.cr-btn.is-quiet', { type: 'button', dataset: { key: 'pass' }, onclick: () => send({ type: 'pass' }) }, 'Passer') : null);
  }

  function action() {
    if (v.me === null) return h('p.cr-note', 'Tu regardes la partie.');
    if (v.out.includes(me)) return h('p.cr-note', 'Tu es éliminé : tu regardes la fin de la partie.');
    if (v.phase === 'over') return null;
    if (v.phase === 'result') {
      const waiting = v.order.filter((id) => !v.out.includes(id) && !v.ready.includes(id)).length;
      return h('div.cr-next',
        v.ready.includes(me)
          ? h('p.cr-note', `En attente de ${plural(waiting, 'joueur', 'joueurs')}…`)
          : h('button.cr-btn.is-main', { type: 'button', dataset: { key: 'ready' }, onclick: () => send({ type: 'ready' }) }, 'Manche suivante'),
        h('p.cr-note', `${v.ready.length} prêt${v.ready.length > 1 ? 's' : ''} sur ${v.order.filter((id) => !v.out.includes(id)).length}`));
    }
    const parts = [];
    if (['place1', 'choose'].includes(v.phase) && v.hand) parts.push(handRow());
    if (canAct() && ['choose', 'bid'].includes(v.phase)) parts.push(bidPanel());
    return parts.length ? h(`div.cr-actions${canAct() ? '.is-mine' : ''}`, parts) : null;
  }

  // ——— Journal ———

  function line(e) {
    const n = (id) => api.user(id).pseudo;
    switch (e.t) {
      case 'place': return `${n(e.who)} pose un disque.`;
      case 'bid': return `${n(e.who)} parie ${e.n}.`;
      case 'pass': return `${n(e.who)} passe.`;
      case 'challenge': return `${n(e.who)} tient le défi : ${e.n}.`;
      case 'flip': return e.of === e.who ? `${n(e.who)} retourne ${e.disc === 's' ? 'son crâne' : 'une de ses roses'}.` : `${n(e.who)} retourne ${e.disc === 's' ? 'un crâne' : 'une rose'} chez ${n(e.of)}.`;
      case 'success': return `${n(e.who)} réussit son défi de ${e.n} : un point.`;
      case 'fail': return `Crâne ! ${n(e.who)} perd un disque (crâne posé par ${n(e.skullOwner)}).`;
      case 'out': return `${n(e.who)} est éliminé.`;
      case 'left': return `${n(e.who)} a quitté la partie.`;
      case 'cancel': return 'Manche annulée : un joueur est parti.';
      case 'win': return `${n(e.who)} gagne la partie.`;
      default: return '';
    }
  }

  function logBox() {
    const items = v.log.slice(-40).reverse();
    return h('details.cr-log', { open: false },
      h('summary', 'Historique'),
      h('ol', items.map((e) => h('li', line(e)))));
  }

  // Confettis pour la victoire (coupés par prefers-reduced-motion dans le CSS).
  function confetti() {
    const box = h('div.cr-confetti', { 'aria-hidden': 'true' }, Array.from({ length: 36 }, (_, i) => h('i', {
      style: `--x:${(i * 37) % 100}%;--c:${FLAGS[i % FLAGS.length]};--d:${(i % 9) * 0.12}s;--r:${(i * 53) % 360}deg`,
    })));
    root.append(box);
    setTimeout(() => box.remove(), 4500);
  }

  // ——— Dessin ———

  function render() {
    if (!v) return;
    const focus = document.activeElement?.closest?.('.cr') ? document.activeElement.dataset?.key : null;
    const opened = el.querySelector('.cr-log')?.open;
    const scroll = root.scrollTop;
    if (v.deadline !== lastDeadline) {
      lastDeadline = v.deadline;
      span = v.deadline ? Math.max(1000, v.deadline - api.now()) : 0;
    }
    const [title, sub] = banner();
    const mine = v.me !== null && !v.out.includes(me) && (v.phase === 'result' ? !v.ready.includes(me) : canAct() && v.phase !== 'over');
    const order = v.me !== null ? [...v.order.slice(v.order.indexOf(me)), ...v.order.slice(0, v.order.indexOf(me))] : v.order;
    el.replaceChildren(
      flags(),
      h('div.cr-in',
        h('header.cr-top',
          h('span.cr-round', `Manche ${v.round}`),
          h('span.cr-total', `${plural(v.total, 'disque', 'disques')} posé${v.total > 1 ? 's' : ''}`),
          timer()),
        h(`div.cr-banner${mine ? '.is-mine' : ''}`, { 'aria-live': 'polite' }, h('h2', title), h('p', sub)),
        h('ul.cr-mats', order.map(mat)),
        action(),
        logBox()));
    seen = fresh;
    fresh = new Set();
    if (v.phase === 'over' && v.winner !== null && !confettiShown) {
      confettiShown = true;
      if (api.seat < 0 || v.winner === api.me.id) confetti();
    }
    if (opened) el.querySelector('.cr-log').open = true;
    root.scrollTop = scroll;
    if (focus) el.querySelector(`[data-key="${focus}"]:not(:disabled)`)?.focus({ preventScroll: true });
    tick();
  }

  api.onState((view, i) => { v = view; info = i; render(); });

  return () => clearInterval(clock);
}
