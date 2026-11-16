// Bataille navale côté navigateur : le placement de la flotte, la grille de tir, le compte à rebours.
// Le hub fournit api (voir docs/integration.md §8) ; les règles et ce que chacun voit sont dans rules.js.

const SIZE = 10;
const LETTERS = 'ABCDEFGHIJ';
const FLEET = [5, 4, 3, 3, 2];
const NAMES = { 5: 'le porte-avions', 4: 'le croiseur', 3: 'un sous-marin', 2: 'le patrouilleur' };

const cellName = (i) => `${LETTERS[i % SIZE]}${Math.floor(i / SIZE) + 1}`;
const cellsOf = (s) => Array.from({ length: s.size }, (_, i) => (s.h ? s.r * SIZE + s.c + i : (s.r + i) * SIZE + s.c));

// Les bateaux coulés (leurs tailles) à partir d'une liste de tirs.
const sunkSizes = (shots) => shots.filter((s) => s.result === 'sunk').map((s) => s.ship.size);

// Bateaux encore à flot : la flotte moins les tailles coulées (chaque taille ne compte qu'une fois).
function afloat(sunk) {
  const left = [...sunk];
  return FLEET.map((size) => {
    const k = left.indexOf(size);
    if (k >= 0) left.splice(k, 1);
    return { size, sunk: k >= 0 };
  });
}

export function mount(root, api) {
  const { h } = api;

  // ——— Une grille de 10 × 10 : boutons, étiquettes, navigation aux flèches ———
  function makeBoard(label, onPick, onOver) {
    const cells = [];
    const rows = [];
    let focus = 0;
    const head = h('div.bn-axis.bn-axis-top', { 'aria-hidden': 'true' }, h('span'), ...Array.from(LETTERS, (l) => h('span', l)));
    for (let r = 0; r < SIZE; r += 1) {
      const row = [h('span.bn-axis-left', { 'aria-hidden': 'true' }, String(r + 1))];
      for (let c = 0; c < SIZE; c += 1) {
        const i = r * SIZE + c;
        const btn = h('button.bn-cell', {
          type: 'button', role: 'gridcell', tabindex: i === 0 ? 0 : -1,
          onclick: () => onPick(i),
          onpointerenter: () => onOver?.(i),
          onfocus: () => { focus = i; onOver?.(i); },
          onkeydown: (e) => {
            const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: SIZE, ArrowUp: -SIZE }[e.key];
            if (!d) return;
            const col = i % SIZE;
            if ((e.key === 'ArrowRight' && col === SIZE - 1) || (e.key === 'ArrowLeft' && col === 0)) return;
            const n = i + d;
            if (n < 0 || n >= SIZE * SIZE) return;
            e.preventDefault();
            cells[focus].tabIndex = -1;
            focus = n;
            cells[n].tabIndex = 0;
            cells[n].focus();
          },
        });
        cells.push(btn);
        row.push(btn);
      }
      rows.push(h('div.bn-row', { role: 'row' }, row));
    }
    const grid = h('div.bn-grid', { role: 'grid', 'aria-label': label, onpointerleave: () => onOver?.(null) }, rows);
    const el = h('div.bn-board', head, grid);
    return { el, grid, cells };
  }

  // ——— État local ———
  let view = null;
  let draft = Array(FLEET.length).fill(null); // un emplacement par bateau de la flotte : null ou { size, r, c, h }
  let selected = 0; // emplacement en cours de pose
  let horizontal = true;
  let syncedKey = '[]';
  let hover = null;
  let notice = '';
  let lastReport = '';

  const target = makeBoard('Grille ennemie : choisis une case pour tirer', (i) => fireAt(i));
  const mine = makeBoard('Ta flotte', (i) => clickMine(i), (i) => { hover = i; paintMine(); });
  const status = h('p.bn-status', { 'aria-live': 'polite' });
  const timerEl = h('span.bn-timer', { hidden: true, role: 'timer' });
  const report = h('p.bn-report', { 'aria-live': 'polite' });
  const targetPane = h('section.bn-pane.bn-pane-target', h('h2.bn-title', 'Radar ennemi'), target.el, h('div.bn-fleet.bn-fleet-target'));
  const minePane = h('section.bn-pane.bn-pane-mine', h('h2.bn-title', 'Ma flotte'), (api.peek ?? ((x) => x))(mine.el, { label: 'ta flotte' }), h('div.bn-fleet.bn-fleet-mine'));
  const dock = h('div.bn-dock');
  const boards = h('div.bn-boards', targetPane, minePane);
  const wrap = h('div.bn', h('div.bn-top', status, timerEl), report, boards, dock);
  root.append(wrap);

  // ——— Actions ———
  const mySeat = () => view.seat;
  const iPlay = () => view.seat >= 0;

  function fireAt(i) {
    if (!iPlay() || view.phase !== 'firing' || view.turn !== mySeat()) return;
    if (view.shots[mySeat()].some((s) => s.cell === i)) {
      api.toast('Tu as déjà tiré sur cette case.');
      return;
    }
    api.sendMove({ type: 'fire', cell: i }).catch(() => {});
  }

  // Cases d'un bateau posé avec son premier carré en « i », ramené dans la grille s'il dépasse.
  function shipAt(i, size) {
    let r = Math.floor(i / SIZE);
    let c = i % SIZE;
    if (horizontal) c = Math.min(c, SIZE - size);
    else r = Math.min(r, SIZE - size);
    return { size, r, c, h: horizontal };
  }
  const occupied = (except = -1) => new Set(draft.flatMap((s, k) => (s && k !== except ? cellsOf(s) : [])));

  function clickMine(i) {
    if (!iPlay() || view.phase !== 'placing' || view.ready[mySeat()]) return;
    const owner = draft.findIndex((s) => s && cellsOf(s).includes(i));
    if (owner >= 0) {
      // Toucher un bateau posé le reprend en main.
      horizontal = draft[owner].h;
      draft[owner] = null;
      selected = owner;
      notice = '';
      return paint();
    }
    if (selected < 0 || draft[selected]) return;
    const ship = shipAt(i, FLEET[selected]);
    if (cellsOf(ship).some((x) => occupied().has(x))) {
      notice = 'Deux bateaux ne peuvent pas se chevaucher : essaie une autre case.';
      return paint();
    }
    draft[selected] = ship;
    notice = '';
    selected = draft.findIndex((s) => !s);
    paint();
  }

  const rotate = () => {
    horizontal = !horizontal;
    paint();
  };
  const clear = () => {
    draft = Array(FLEET.length).fill(null);
    selected = 0;
    notice = '';
    paint();
  };
  const randomize = () => api.sendMove({ type: 'random' }).catch(() => {});
  const confirm = () => {
    if (draft.some((s) => !s)) return;
    api.sendMove({ type: 'ready', ships: draft }).catch(() => {});
  };

  const onKey = (e) => {
    if ((e.key === 'r' || e.key === 'R') && view?.phase === 'placing' && iPlay() && !view.ready[mySeat()] && !/INPUT|TEXTAREA/.test(e.target.tagName)) {
      rotate();
    }
  };
  document.addEventListener('keydown', onKey);

  // Reprend la flotte tirée au hasard par le serveur (ou déjà validée) dans le brouillon.
  function adoptFleet(fleet) {
    const key = JSON.stringify(fleet);
    if (key === syncedKey) return;
    syncedKey = key;
    if (!fleet.length) return;
    draft = Array(FLEET.length).fill(null);
    for (const ship of fleet) {
      const k = draft.findIndex((s, idx) => !s && FLEET[idx] === ship.size);
      if (k >= 0) draft[k] = { size: ship.size, r: ship.r, c: ship.c, h: ship.h };
    }
    selected = -1;
    notice = '';
  }

  // ——— Dessin ———
  function paintMine() {
    const placing = view.phase === 'placing' && iPlay() && !view.ready[mySeat()];
    const states = Array.from({ length: SIZE * SIZE }, () => ({ classes: [], label: 'eau' }));
    const mark = (i, cls, label) => {
      states[i].classes.push(cls);
      if (label) states[i].label = label;
    };
    // Moi : le brouillon pendant la pose, puis ma flotte validée. Spectateur : rien avant la fin de la partie.
    const shipsToShow = iPlay() ? (placing ? draft.filter(Boolean) : (view.fleet || [])) : (view.fleets ? view.fleets[0] : []);
    for (const ship of shipsToShow) {
      const cs = cellsOf(ship);
      cs.forEach((x, k) => {
        mark(x, 'is-ship', 'ton bateau');
        states[x].classes.push(ship.h ? 'ship-h' : 'ship-v', `ship-c${ship.size}`);
        if (k === Math.floor(cs.length / 2)) states[x].classes.push('ship-mid');
        if (k === 0) states[x].classes.push('ship-first');
        if (k === cs.length - 1) states[x].classes.push('ship-last');
      });
    }
    // Les tirs de l'adversaire sur ma grille (pour un spectateur : ceux de la place 2 sur la place 1).
    const incoming = view.shots[iPlay() ? 1 - mySeat() : 1];
    for (const s of incoming) {
      if (s.result === 'miss') mark(s.cell, 'is-miss', 'à l’eau');
      else if (s.result === 'hit') mark(s.cell, 'is-hit', 'touché');
      else {
        s.ship.cells.forEach((x) => mark(x, 'is-sunk', 'coulé'));
      }
    }
    if (view.last && incoming.length && view.last.by === (iPlay() ? 1 - mySeat() : 1)) {
      const last = view.last.cell;
      states[last].classes.push('is-last');
    }
    // Aperçu pendant la pose.
    if (placing && selected >= 0 && !draft[selected] && hover !== null) {
      const ship = shipAt(hover, FLEET[selected]);
      const cs = cellsOf(ship);
      const bad = cs.some((x) => occupied().has(x));
      cs.forEach((x) => states[x].classes.push(bad ? 'is-ghost-bad' : 'is-ghost'));
    }
    mine.cells.forEach((btn, i) => {
      btn.className = `bn-cell ${states[i].classes.join(' ')}`;
      const name = cellName(i);
      btn.setAttribute('aria-label', `${name}, ${states[i].label}`);
      btn.disabled = false;
      btn.setAttribute('aria-disabled', placing ? 'false' : 'true');
      btn.dataset.cell = name;
    });
  }

  function paintTarget() {
    const myTurn = iPlay() && view.phase === 'firing' && view.turn === mySeat();
    const outgoing = view.shots[iPlay() ? mySeat() : 0];
    const states = Array.from({ length: SIZE * SIZE }, () => ({ classes: [], label: 'inconnu' }));
    // En fin de partie, la flotte adverse est révélée.
    const revealed = view.fleets ? view.fleets[iPlay() ? 1 - mySeat() : 1] : [];
    for (const ship of revealed) {
      const cs = cellsOf(ship);
      cs.forEach((x, k) => {
        states[x].classes.push('is-ship', 'is-revealed', ship.h ? 'ship-h' : 'ship-v', `ship-c${ship.size}`);
        if (k === Math.floor(cs.length / 2)) states[x].classes.push('ship-mid');
        if (k === 0) states[x].classes.push('ship-first');
        if (k === cs.length - 1) states[x].classes.push('ship-last');
        states[x].label = 'bateau ennemi';
      });
    }
    for (const s of outgoing) {
      if (s.result === 'miss') {
        states[s.cell].classes.push('is-miss');
        states[s.cell].label = 'à l’eau';
      } else if (s.result === 'hit') {
        states[s.cell].classes.push('is-hit');
        states[s.cell].label = 'touché';
      } else {
        s.ship.cells.forEach((x) => {
          states[x].classes.push('is-sunk');
          states[x].label = 'coulé';
        });
      }
    }
    if (view.last && view.last.by === (iPlay() ? mySeat() : 0)) states[view.last.cell].classes.push('is-last');
    target.cells.forEach((btn, i) => {
      const shot = outgoing.some((s) => s.cell === i) || states[i].label === 'coulé';
      btn.className = `bn-cell ${states[i].classes.join(' ')}${myTurn && !shot ? ' is-aim' : ''}`;
      btn.setAttribute('aria-label', `${cellName(i)}, ${states[i].label}${myTurn && !shot ? ', tirer' : ''}`);
      btn.setAttribute('aria-disabled', myTurn && !shot ? 'false' : 'true');
      btn.dataset.cell = cellName(i);
    });
    target.el.classList.toggle('is-live', myTurn);
  }

  function paintFleet(el, shots, who) {
    const items = afloat(sunkSizes(shots));
    el.replaceChildren(
      h('span.bn-fleet-label', who),
      ...items.map((s) => h(`span.bn-pips.c${s.size}${s.sunk ? '.is-sunk' : ''}`, { title: `${s.size} cases${s.sunk ? ', coulé' : ''}`, role: 'img', 'aria-label': `bateau de ${s.size} cases${s.sunk ? ', coulé' : ', à flot'}` },
        ...Array.from({ length: s.size }, () => h('i')))),
    );
  }

  function describeShot(last) {
    if (!last) return '';
    const mineShot = iPlay() && last.by === mySeat();
    const who = !iPlay() ? api.user(view.players[last.by]).pseudo : mineShot ? 'Tu' : api.user(view.players[last.by]).pseudo;
    const verb = !iPlay() || !mineShot ? 'tire' : 'tires';
    const res = last.result === 'miss' ? 'à l’eau' : last.result === 'hit' ? 'touché !' : `coulé ! (${NAMES[last.size] || `un bateau de ${last.size} cases`})`;
    return `${who} ${verb} en ${cellName(last.cell)} : ${res}`;
  }

  function paintDock() {
    const placing = view.phase === 'placing' && iPlay() && !view.ready[mySeat()];
    if (!placing) {
      dock.replaceChildren();
      dock.hidden = true;
      return;
    }
    dock.hidden = false;
    const chips = FLEET.map((size, k) => {
      const placed = Boolean(draft[k]);
      return h(`button.bn-ship.c${size}${k === selected ? '.is-selected' : ''}${placed ? '.is-placed' : ''}`, {
        type: 'button',
        dataset: { k: `ship${k}` },
        'aria-pressed': k === selected ? 'true' : 'false',
        'aria-label': `Bateau de ${size} cases${placed ? ', posé : reprendre' : ''}`,
        onclick: () => {
          if (draft[k]) {
            horizontal = draft[k].h;
            draft[k] = null;
          }
          selected = k;
          notice = '';
          paint();
        },
      }, h('span.bn-ship-body', ...Array.from({ length: size }, () => h('i'))), h('span.bn-ship-n', `${size}`));
    });
    const complete = draft.every(Boolean);
    const had = document.activeElement?.closest?.('.bn-dock') ? document.activeElement.dataset.k : null;
    dock.replaceChildren(
      h('div.bn-ships', { role: 'group', 'aria-label': 'Tes bateaux' }, chips),
      h('div.bn-actions',
        h('button.bn-btn', { type: 'button', dataset: { k: 'rotate' }, onclick: rotate, 'aria-label': `Pivoter (actuellement ${horizontal ? 'horizontal' : 'vertical'}), touche R` },
          h(`span.bn-btn-ic.ic-rotate${horizontal ? '' : '.is-v'}`, { 'aria-hidden': 'true' }), 'Pivoter'),
        h('button.bn-btn', { type: 'button', dataset: { k: 'random' }, onclick: randomize, 'aria-label': 'Placer la flotte au hasard' }, h('span.bn-btn-ic.ic-dice', { 'aria-hidden': 'true' }), 'Au hasard'),
        h('button.bn-btn.bn-btn-quiet', { type: 'button', dataset: { k: 'clear' }, onclick: clear, disabled: !draft.some(Boolean) }, 'Tout retirer'),
        h('button.bn-btn.bn-btn-go', { type: 'button', dataset: { k: 'go' }, onclick: confirm, disabled: !complete }, 'Prêt'),
      ),
      ...(notice ? [h('p.bn-notice', { role: 'alert' }, notice)] : []),
    );
    if (had) dock.querySelector(`[data-k="${had}"]`)?.focus();
  }

  function paintStatus() {
    const opp = iPlay() ? api.user(view.players[1 - mySeat()]) : null;
    const name = (seat) => api.user(view.players[seat]).pseudo;
    let text;
    let tone = '';
    if (view.phase === 'over') {
      if (!iPlay()) text = view.winner ? `${api.user(view.winner).pseudo} gagne la bataille !` : 'Partie terminée.';
      else if (view.forfeit) text = view.forfeit === api.me.id ? 'Tu as abandonné.' : `${opp.pseudo} a abandonné : tu gagnes !`;
      else text = view.winner === api.me.id ? 'Victoire ! La flotte ennemie est au fond.' : 'Défaite… ta flotte est coulée.';
      tone = view.winner === api.me.id ? 'win' : 'lose';
    } else if (view.phase === 'placing') {
      if (!iPlay()) text = `${name(0)} et ${name(1)} placent leur flotte…`;
      else if (view.ready[mySeat()]) text = `Flotte prête. ${opp.pseudo} ${view.ready[1 - mySeat()] ? 'est prêt' : 'place encore ses bateaux'}…`;
      else if (view.fleet?.length && draft.every(Boolean) && selected < 0) text = 'Ta flotte est en place : déplace un bateau si tu veux, puis appuie sur « Prêt ».';
      else if (selected >= 0) text = `Pose ${NAMES[FLEET[selected]] || 'un bateau'} (${FLEET[selected]} cases) : touche la grille. ${horizontal ? 'À l’horizontale' : 'À la verticale'}.`;
      else text = 'Ta flotte est en place : appuie sur « Prêt ».';
      if (iPlay() && !view.ready[mySeat()] && view.ready[1 - mySeat()]) text += ` ${opp.pseudo} t’attend.`;
    } else if (!iPlay()) {
      text = `${name(view.turn)} tire…`;
    } else {
      text = view.turn === mySeat() ? 'À toi de tirer : touche une case du radar ennemi.' : `${opp.pseudo} prend sa visée…`;
      tone = view.turn === mySeat() ? 'turn' : '';
    }
    status.textContent = text;
    status.dataset.tone = tone;
    const rep = view.phase === 'placing' ? '' : describeShot(view.last);
    if (rep !== lastReport) {
      lastReport = rep;
      report.textContent = rep;
      report.dataset.result = view.last?.result || '';
      report.classList.remove('is-new');
      void report.offsetWidth;
      report.classList.add('is-new');
    }
  }

  function paint() {
    if (!view) return;
    const placing = view.phase === 'placing';
    wrap.dataset.phase = view.phase;
    wrap.dataset.role = iPlay() ? 'player' : 'watch';
    targetPane.hidden = placing && iPlay();
    const showMine = iPlay() || view.phase !== 'placing';
    minePane.hidden = !showMine;
    if (!iPlay()) {
      targetPane.querySelector('.bn-title').textContent = `Eaux : ${api.user(view.players[1]).pseudo}`;
      minePane.querySelector('.bn-title').textContent = `Eaux : ${api.user(view.players[0]).pseudo}`;
      // Le spectateur voit chaque flotte attaquée par l'autre joueur.
    } else {
      targetPane.querySelector('.bn-title').textContent = `Radar ennemi · ${api.user(view.players[1 - mySeat()]).pseudo}`;
      minePane.querySelector('.bn-title').textContent = 'Ma flotte';
    }
    paintStatus();
    paintTarget();
    paintMine();
    paintDock();
    paintTimer();
    const shotsOnMe = view.shots[iPlay() ? 1 - mySeat() : 1];
    const shotsByMe = view.shots[iPlay() ? mySeat() : 0];
    boards.querySelectorAll('.bn-fleet').forEach((f) => { f.hidden = placing; });
    paintFleet(targetPane.querySelector('.bn-fleet'), shotsByMe, 'Flotte ennemie');
    paintFleet(minePane.querySelector('.bn-fleet'), shotsOnMe, 'Ma flotte');
    targetPane.querySelector('.bn-fleet-label').textContent = iPlay() ? 'Flotte ennemie' : `Flotte : ${api.user(view.players[1]).pseudo}`;
    minePane.querySelector('.bn-fleet-label').textContent = iPlay() ? 'Ma flotte' : `Flotte : ${api.user(view.players[0]).pseudo}`;
  }

  // ——— Compte à rebours ———
  function paintTimer() {
    const on = view.phase === 'firing' && view.deadline;
    timerEl.hidden = !on;
    if (!on) return;
    const left = Math.max(0, Math.ceil((view.deadline - api.now()) / 1000));
    timerEl.textContent = `${left} s`;
    timerEl.classList.toggle('is-low', left <= 5);
    timerEl.setAttribute('aria-label', `${left} secondes pour tirer`);
  }
  const tick = setInterval(() => view && paintTimer(), 250);

  // Confettis quand la partie se termine (décor seulement, coupé si l'animation est réduite).
  let confettiDone = false;
  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || confettiDone) return;
    confettiDone = true;
    const colors = ['#ff4fa8', '#ffe74a', '#2ee6d6', '#8f5bff', '#ff9a3c', '#8cff6a'];
    const box = h('div.bn-confetti', { 'aria-hidden': 'true' }, Array.from({ length: 44 }, (_, i) => h('i', {
      style: `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random() * 0.8}s;animation-duration:${2 + Math.random() * 1.6}s;--r:${Math.round(Math.random() * 720 - 360)}deg`,
    })));
    root.append(box);
    setTimeout(() => box.remove(), 4800);
  }

  api.onState((v) => {
    view = v;
    if (iPlay()) adoptFleet(v.fleet || []);
    paint();
    if (v.phase === 'over' && v.winner === api.me.id) confetti();
    else if (v.phase !== 'over') confettiDone = false;
  });

  return () => {
    clearInterval(tick);
    document.removeEventListener('keydown', onKey);
  };
}
