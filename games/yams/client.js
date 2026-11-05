// Yams côté navigateur : des dés géants sur dégradé pêche-fuchsia et une feuille de score en cartes arrondies.
// Le hub fournit api (docs/integration.md §8). Les lancers et le calcul des points se font sur le serveur : ici, on affiche la vue.

const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
const LOWER = ['brelan', 'carre', 'full', 'petite', 'grande', 'yams', 'chance'];
const INFO = {
  ones: ['Les 1', 'total des 1'], twos: ['Les 2', 'total des 2'], threes: ['Les 3', 'total des 3'],
  fours: ['Les 4', 'total des 4'], fives: ['Les 5', 'total des 5'], sixes: ['Les 6', 'total des 6'],
  brelan: ['Brelan', '3 identiques : total'], carre: ['Carré', '4 identiques : total'], full: ['Full', '3 + 2 : 25'],
  petite: ['Petite suite', '4 à la suite : 30'], grande: ['Grande suite', '5 à la suite : 40'], yams: ['Yams', '5 identiques : 50'],
  chance: ['Chance', 'total des dés'],
};
const BONUS_THRESHOLD = 63;
const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function mount(root, api) {
  const { h } = api;
  const me = api.me.id;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const tray = h('section.ym-tray', { 'aria-label': 'Plateau de dés' });
  const sheetBox = h('section.ym-sheetbox', { 'aria-label': 'Feuilles de score' });
  const page = h('div.ym', tray, sheetBox);
  root.append(page);

  let v = null;
  let held = [false, false, false, false, false]; // dés que je garde (local, pour mon tour)
  let chosen = null; // case sélectionnée, pas encore inscrite
  let turnKey = '';
  let rollKey = null; // pour n'animer les dés que quand un lancer vient d'avoir lieu
  let animate = false;
  let busy = false;
  let tick = 0;

  // Confettis de victoire : décor seulement, coupé par prefers-reduced-motion (et masqué en CSS).
  function confetti() {
    if (reduced) return;
    const colors = ['#ff3d8b', '#ffe34d', '#3df2b8', '#38c8ff', '#ff8a1f', '#9a5cff'];
    const box = h('div.ym-confetti', { 'aria-hidden': 'true' }, Array.from({ length: 40 }, (_, i) => {
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
  const isMyTurn = () => !v.over && v.turn === me;

  const die = (value, i, extra = '') => h(`span.ym-die.d${i}.v${value}${extra}`, { role: 'img', 'aria-label': `dé de valeur ${value}` },
    PIPS[value].map((c) => h(`i.c${c}`)));

  // ——— Actions ———

  function send(action) {
    if (busy) return;
    busy = true;
    renderAll();
    api.sendMove(action).catch(() => {}).finally(() => {
      busy = false;
      if (v) renderAll();
    });
  }

  const heldIdx = () => held.flatMap((x, i) => (x ? [i] : []));

  function roll() {
    chosen = null;
    send({ type: 'roll', keep: v.rolls > 0 ? heldIdx() : [] });
  }

  function score() {
    if (!chosen) return;
    send({ type: 'score', box: chosen });
  }

  // ——— Plateau ———

  function winText() {
    const names = v.winners.map((id) => (id === me ? 'Toi' : nm(id)));
    if (!names.length) return 'Personne ne gagne.';
    const best = v.totals[v.winners[0]].total;
    if (v.winners.length > 1) return `Égalité à ${best} points : ${names.join(' et ')}.`;
    return `${v.winners[0] === me ? 'Tu gagnes' : `${names[0]} gagne`} avec ${best} points !`;
  }

  function statusText() {
    if (v.over) return 'Partie terminée.';
    if (v.turn === me) {
      if (v.rolls === 0) return 'À toi : lance les dés';
      if (v.rolls < 3) return `Lancer ${v.rolls}/3 · touche les dés à garder`;
      return 'Choisis une case';
    }
    return `${nm(v.turn)} joue${v.rolls ? ` · lancer ${v.rolls}/3` : ''}`;
  }

  function lastText() {
    const l = v.last;
    if (!l) return null;
    const who = l.id === me ? 'Tu as' : `${nm(l.id)} a`;
    return `${who} inscrit ${l.points} point${l.points > 1 ? 's' : ''} : ${INFO[l.box][0].toLowerCase()}${l.extra ? ' (+100 de bonus)' : ''}${l.auto ? ' · temps écoulé' : ''}`;
  }

  function trayDice() {
    const mine = isMyTurn();
    const canHold = mine && v.rolls > 0 && v.rolls < 3 && !busy;
    const dice = v.dice.length ? v.dice : [0, 0, 0, 0, 0];
    return h('div.ym-dice', dice.map((val, i) => {
      if (!val) return h('div.ym-slot', h(`span.ym-die.d${i}.is-empty`, { 'aria-hidden': 'true' }));
      const rolling = animate && !reduced && v.rerolled.includes(i);
      const keep = mine && held[i] && v.rolls < 3;
      const face = die(val, i, `${rolling ? '.is-rolling' : ''}`);
      face.style.setProperty('--i', String(i));
      if (!canHold) return h(`div.ym-slot${keep ? '.is-held' : ''}`, face, h('span.ym-keep', ''));
      return h(`div.ym-slot${keep ? '.is-held' : ''}`,
        h('button.ym-hold', {
          type: 'button',
          dataset: { k: `die-${i}` },
          'aria-pressed': String(held[i]),
          'aria-label': `Dé ${i + 1} : ${val}, ${held[i] ? 'gardé' : 'pas gardé'}`,
          onclick: () => { held[i] = !held[i]; renderAll(`die-${i}`); },
        }, face),
        h('span.ym-keep', held[i] ? 'gardé' : ''));
    }));
  }

  function trayActions() {
    if (v.over) return h('div.ym-actions', h('p.ym-win', winText()));
    if (!isMyTurn()) return null;
    const keepAll = v.rolls > 0 && heldIdx().length === 5;
    const canRoll = v.rolls < 3 && !keepAll && !busy;
    const rollLabel = v.rolls === 0 ? 'Lancer les dés' : v.rolls < 3 ? `Relancer ${5 - heldIdx().length} dé${5 - heldIdx().length > 1 ? 's' : ''}` : 'Plus de lancer';
    const kids = [];
    if (chosen && v.preview && chosen in v.preview) {
      kids.push(h('button.ym-btn.ym-btn-ok', {
        type: 'button', dataset: { k: 'score' }, disabled: busy, onclick: score,
      }, `Inscrire ${v.preview[chosen]} : ${INFO[chosen][0].toLowerCase()}`));
    }
    if (v.rolls < 3) {
      kids.push(h(`button.ym-btn.ym-btn-roll${chosen ? '.is-second' : ''}`, {
        type: 'button', dataset: { k: 'roll' }, disabled: !canRoll, onclick: roll,
        title: keepAll ? 'Tu gardes les 5 dés : relâches-en un pour relancer.' : null,
      }, rollLabel));
    }
    if (!kids.length) kids.push(h('p.ym-hint', 'Choisis une case dans ta colonne'));
    return h('div.ym-actions', kids);
  }

  // Les joueurs et leur total, toujours sous les yeux (la feuille, elle, défile).
  function scoreChips() {
    return h(`div.ym-scores.n${v.players.length}`, { role: 'list', 'aria-label': 'Scores' }, v.players.map((id) => h(`div.ym-chip${v.turn === id && !v.over ? '.is-turn' : ''}${v.over && v.winners.includes(id) ? '.is-winner' : ''}${v.left.includes(id) ? '.is-left' : ''}`, { role: 'listitem' },
      api.token(api.user(id), { size: 's' }),
      h('span.ym-chipname', id === me ? 'Toi' : nm(id)),
      h('b', String(v.totals[id].total)))));
  }

  function renderTray() {
    tray.className = `ym-tray${isMyTurn() ? ' is-mine' : ''}${v.over ? ' is-over' : ''}`;
    if (v.over) {
      tray.replaceChildren(h('p.ym-status.sr-only', { 'aria-live': 'polite' }, statusText()), trayActions(), scoreChips());
      return;
    }
    tray.replaceChildren(
      h('div.ym-trayhead',
        h('p.ym-status', { 'aria-live': 'polite' }, statusText()),
        h('span.ym-timer', { dataset: { k: 'timer' } })),
      scoreChips(),
      trayDice(),
      ...[trayActions(), v.last ? h('p.ym-last', lastText()) : null].filter(Boolean));
    updateTimer();
  }

  // ——— Feuille de score ———

  // Une cellule de la feuille de `id` ; la colonne du joueur que je suis porte la classe is-me.
  function cell(id, box) {
    const td = cellFor(id, box);
    if (id === me) td.classList.add('is-me');
    return td;
  }

  function cellFor(id, box) {
    const val = v.sheets[id].boxes[box];
    const mineAndOpen = id === me && isMyTurn() && v.preview && box in v.preview && val === null;
    if (val !== null) return h('td.ym-val', h('span', String(val)));
    if (mineAndOpen) {
      const pts = v.preview[box];
      const on = chosen === box;
      return h('td.ym-pick', h(`button.ym-cell${on ? '.is-chosen' : ''}`, {
        type: 'button',
        dataset: { k: `box-${box}` },
        disabled: busy,
        'aria-pressed': String(on),
        'aria-label': `${INFO[box][0]} : ${pts === 0 ? 'barrer la case (0 point)' : `${pts} points possibles`}${on ? ', sélectionné' : ''}`,
        onclick: () => { chosen = on ? null : box; renderAll(`box-${box}`); },
      }, h('span', String(pts))));
    }
    return h('td.ym-blank', h('span.sr-only', 'vide'));
  }

  function row(box) {
    const [label, note] = INFO[box];
    const upperIdx = UPPER.indexOf(box);
    return h(`tr${box === 'brelan' ? '.ym-sep' : ''}`,
      h('th.ym-rowhead', { scope: 'row' },
        h('span.ym-label', upperIdx >= 0 ? die(upperIdx + 1, 0, '.mini') : null, label),
        h('small', note)),
      v.players.map((id) => cell(id, box)));
  }

  function renderSheet() {
    const cols = v.players;
    const head = h('tr',
      h('th.ym-corner', { scope: 'col' }, h('span.sr-only', 'Case')),
      cols.map((id) => h(`th.ym-colhead${v.turn === id && !v.over ? '.is-turn' : ''}${v.left.includes(id) ? '.is-left' : ''}${v.over && v.winners.includes(id) ? '.is-winner' : ''}`, { scope: 'col' },
        api.token(api.user(id), { size: 's' }),
        h('span.ym-colname', id === me ? 'Toi' : nm(id)),
        v.left.includes(id) ? h('small', 'parti') : null,
        v.over && v.winners.includes(id) ? h('small', 'gagne') : null)));
    const totalRow = (cls, label, fn) => h(`tr.${cls}`, h('th.ym-rowhead', { scope: 'row' }, h('span.ym-label', label)), cols.map((id) => fn(id)));
    const rows = [
      ...UPPER.map(row),
      totalRow('ym-sub', 'Total haut', (id) => h('td.ym-val', h('span', String(v.totals[id].upper)))),
      totalRow('ym-sub', `Bonus ${BONUS_THRESHOLD}+ : 35`, (id) => {
        const t = v.totals[id];
        return t.bonus ? h('td.ym-val', h('span', `+${t.bonus}`)) : h('td.ym-val.ym-faint', h('span', `${t.upper}/${BONUS_THRESHOLD}`));
      }),
      ...LOWER.map(row),
    ];
    if (v.options.extraYams) {
      rows.push(totalRow('ym-sub', 'Yams en plus', (id) => {
        const n = v.sheets[id].extraYams;
        return n ? h('td.ym-val', h('span', `+${n * 100}`)) : h('td.ym-val.ym-faint', h('span', '–'));
      }));
    }
    rows.push(totalRow('ym-total', 'Total', (id) => h(`td.ym-val${v.over && v.winners.includes(id) ? '.is-winner' : ''}`, h('span', String(v.totals[id].total)))));
    sheetBox.replaceChildren(h('h2.ym-title', 'Feuille de score'), h(`table.ym-sheet.cols-${cols.length}`,
      h('caption.sr-only', 'Feuille de score : une colonne par joueur'),
      h('thead', head),
      h('tbody', rows)));
  }

  function updateTimer() {
    const el = tray.querySelector('.ym-timer');
    if (!el || !v) return;
    if (!v.deadline || v.over) {
      el.textContent = '';
      el.classList.remove('is-low');
      return;
    }
    const left = v.deadline - api.now();
    el.textContent = mmss(left);
    el.classList.toggle('is-low', left < 15_000);
  }

  function renderAll(focusKey) {
    if (!v) return;
    const active = document.activeElement;
    const keep = focusKey || (page.contains(active) ? active.dataset?.k : null);
    const top = page.scrollTop;
    renderTray();
    renderSheet();
    page.scrollTop = top;
    if (keep && keep !== 'timer') {
      const target = page.querySelector(`[data-k="${keep}"]`);
      if (target && !target.disabled) target.focus({ preventScroll: true });
    }
  }

  api.onState((view) => {
    const first = v === null;
    const wasOver = Boolean(v && v.over);
    v = view;
    const key = `${v.turn}:${v.round}`;
    if (key !== turnKey) {
      turnKey = key;
      held = [false, false, false, false, false];
      chosen = null;
    }
    if (chosen && !(v.preview && chosen in v.preview)) chosen = null;
    const nextRollKey = `${key}:${v.rolls}`;
    animate = !first && rollKey !== null && nextRollKey !== rollKey && v.rolls > 0;
    rollKey = nextRollKey;
    renderAll();
    if (v.over && !first && !wasOver) {
      page.scrollTop = 0; // le vainqueur s'affiche en haut : on y remonte, sinon il reste hors de l'écran, sous la feuille
      confetti();
    }
    animate = false; // les rendus suivants (garder un dé, choisir une case) ne rejouent pas l'animation
  });

  tick = setInterval(updateTimer, 500);
  return () => clearInterval(tick);
}
