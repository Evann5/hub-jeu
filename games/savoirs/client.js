// Six Savoirs côté navigateur : le circuit de 30 cases autour d'un panneau central (joueurs et sceaux, dé, question).
// Les pions sont les têtes des personnages des joueurs (api.token). Le circuit fait 9 cases de large et 8 de haut.
const COLS = 9;
const ROWS = 8;
const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const ICONS = { geo: '🌍', histoire: '🏛️', sciences: '🔬', divert: '🎬', sport: '⚽', lettres: '📚' };

// Case i du circuit -> [colonne, rangée] (1-indexées), dans le sens des aiguilles d'une montre depuis le coin en haut à gauche.
function cell(i) {
  if (i < COLS) return [i + 1, 1];
  if (i < COLS + ROWS - 2) return [COLS, i - COLS + 2];
  if (i < 2 * COLS + ROWS - 2) return [COLS - (i - (COLS + ROWS - 2)), ROWS];
  return [1, ROWS - (i - (2 * COLS + ROWS - 2)) - 1];
}

export function mount(root, api) {
  const { h } = api;
  let v = null;
  let sending = false;
  const name = (id) => (id === api.me.id ? 'Toi' : api.user(id)?.pseudo ?? '?');
  // Dans le journal, toujours le pseudo (« Toi lance 3 » ne se dit pas).
  const withNames = (text) => text.replace(/#(\d+)/g, (_, id) => api.user(Number(id))?.pseudo ?? '?');

  const board = h('div.sv-board', { role: 'grid', 'aria-label': 'Le circuit' });
  const center = h('div.sv-center');
  const timer = h('div.sv-timer', h('i'));
  const frame = h('div.sv', board);
  board.append(center);
  root.append(frame);

  const send = (action) => {
    if (sending) return;
    sending = true;
    api.sendMove(action).catch(() => {}).finally(() => { sending = false; });
  };

  const seal = (cat, on) => h(`span.sv-seal${on ? '.is-on' : ''}`, { style: `--c:var(--sv-${cat})`, title: v.catNames[cat] });

  function players() {
    return h('div.sv-players', v.players.map((id) => {
      const out = v.left.includes(id);
      return h(`div.sv-player${v.cur === id && v.phase !== 'over' ? '.is-turn' : ''}${out ? '.is-out' : ''}${v.winner === id ? '.is-winner' : ''}`,
        api.token(api.user(id), { size: 's' }),
        h('span.sv-pname', name(id)),
        h('span.sv-seals', { 'aria-label': `${v.seals[id].length} sceaux sur ${v.goal}` }, v.cats.map((c) => seal(c, v.seals[id].includes(c)))));
    }));
  }

  function questionCard(mine) {
    const q = v.question;
    const reveal = v.phase === 'reveal' || v.phase === 'over';
    return h('section.sv-card', { style: `--c:var(--sv-${q.cat})` },
      h('header.sv-card-head', h('span', ICONS[q.cat]), v.catNames[q.cat], BOARD_SEAL() ? h('b.sv-card-seal', 'Sceau en jeu') : null),
      h('p.sv-q', q.q),
      h('div.sv-choices', q.choices.map((c, i) => {
        const right = reveal && i === q.correct;
        const wrong = reveal && v.answer && v.answer.choice === i && !v.answer.right;
        return h(`button.sv-choice${right ? '.is-right' : ''}${wrong ? '.is-wrong' : ''}`, {
          type: 'button',
          disabled: !mine || reveal,
          onclick: () => send({ type: 'answer', choice: i }),
        }, h('b', 'ABCD'[i]), c);
      })),
      v.phase === 'question' ? timer : null,
      reveal && v.answer ? h(`p.sv-verdict${v.answer.right ? '.is-right' : '.is-wrong'}`,
        v.answer.right ? (v.answer.gained ? `Bravo ! Sceau ${v.catNames[v.answer.gained]} gagné.` : 'Bonne réponse : on rejoue !') : v.answer.choice === null ? 'Temps écoulé.' : 'Raté !') : null);
  }
  // La question en cours se joue-t-elle sur un Sceau pas encore gagné ?
  const BOARD_SEAL = () => {
    const sq = v.board[v.pos[v.cur]];
    return v.phase === 'question' && sq.seal && !v.seals[v.cur].includes(sq.cat);
  };

  function centerPanel() {
    const mine = v.cur === api.me.id && v.phase !== 'over';
    const nodes = [h('h2.sv-title', 'Six Savoirs', h('small', `${v.goal === 6 ? 'Les 6' : v.goal} sceaux pour gagner`)), players()];
    if (v.phase === 'over') {
      nodes.push(h('p.sv-big', v.winner !== null ? `${name(v.winner)} ${v.winner === api.me.id ? 'gagnes' : 'gagne'} la partie !` : 'Partie terminée.'));
    } else if (v.phase === 'roll') {
      nodes.push(h('div.sv-die', { 'aria-hidden': 'true' }, DIE[v.die ?? 0] || '🎲'));
      nodes.push(mine ? h('button.sv-btn', { type: 'button', onclick: () => send({ type: 'roll' }) }, v.streak ? 'Rejoue : lance le dé' : 'Lance le dé')
        : h('p.sv-wait', `${name(v.cur)} lance le dé…`));
    } else if (v.phase === 'move') {
      nodes.push(h('div.sv-die.is-rolled', { 'aria-label': `Dé : ${v.die}` }, DIE[v.die]));
      nodes.push(h('p.sv-wait', mine ? 'Choisis ta case : avance ou recule (cases en surbrillance).' : `${name(v.cur)} choisit sa case…`));
    } else {
      nodes.push(questionCard(mine));
      if (!mine && v.phase === 'question') nodes.push(h('p.sv-wait', `${name(v.cur)} réfléchit…`));
    }
    if (v.phase !== 'over' && (v.phase === 'roll' || v.phase === 'move')) nodes.push(timer);
    nodes.push(h('ol.sv-log', [...v.log].slice(-3).reverse().map((l) => h('li', withNames(l.text)))));
    return nodes;
  }

  function squares() {
    const mine = v.cur === api.me.id && v.phase === 'move';
    return v.board.map((sq, i) => {
      const [col, row] = cell(i);
      const here = v.players.filter((id) => !v.left.includes(id) && v.pos[id] === i);
      const dest = v.phase === 'move' && v.dests.includes(i);
      const props = {
        role: 'gridcell',
        style: `grid-column:${col};grid-row:${row};--c:var(--sv-${sq.cat})`,
        title: `${v.catNames[sq.cat]}${sq.seal ? ' · Sceau' : ''}`,
      };
      const content = [
        sq.seal ? h('span.sv-sq-seal', { 'aria-hidden': 'true' }, ICONS[sq.cat]) : null,
        here.length ? h('span.sv-pawns', here.map((id) => api.token(api.user(id), { size: 's' }))) : null,
      ];
      if (dest && mine) return h(`button.sv-sq.is-dest${sq.seal ? '.is-seal' : ''}`, { ...props, type: 'button', 'aria-label': `Aller sur ${props.title}`, onclick: () => send({ type: 'move', to: i }) }, ...content);
      return h(`div.sv-sq${sq.seal ? '.is-seal' : ''}${dest ? '.is-dest' : ''}`, props, ...content);
    });
  }

  function render() {
    board.replaceChildren(...squares(), center);
    center.replaceChildren(...centerPanel());
    tick();
  }

  // La barre du chrono se vide jusqu'à l'échéance.
  function tick() {
    if (!v?.deadline) return;
    const total = v.phase === 'question' ? v.time : v.phase === 'move' ? 20_000 : 30_000;
    const left = Math.max(0, v.deadline - api.now());
    timer.firstChild.style.width = `${Math.min(100, (left / total) * 100)}%`;
    timer.classList.toggle('is-low', left < 5000);
  }
  const clock = setInterval(tick, 200);

  // La taille d'une case : le plus grand carré qui fait tenir 9 × 8 cases dans la place disponible (92 px au plus).
  const fit = () => {
    const gap = window.innerWidth < 600 ? 2 : 4;
    const pad = window.innerWidth < 600 ? 12 : 24;
    const w = (root.clientWidth - pad - gap * (COLS - 1)) / COLS;
    const hh = (root.clientHeight - pad - gap * (ROWS - 1)) / ROWS;
    board.style.setProperty('--cell', `${Math.max(28, Math.floor(Math.min(w, hh, 92)))}px`);
  };
  const sizer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  sizer?.observe(root);
  fit();

  // Après la révélation, celui qui a joué passe à la suite d'un clic (sinon le minuteur s'en charge).
  const onKey = (e) => {
    if (!v || v.cur !== api.me.id) return;
    if (e.key === ' ' && v.phase === 'roll' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); send({ type: 'roll' }); }
    if (v.phase === 'question' && /^[abcd1234]$/i.test(e.key) && !(e.target instanceof HTMLInputElement)) {
      const i = 'abcd'.includes(e.key.toLowerCase()) ? 'abcd'.indexOf(e.key.toLowerCase()) : Number(e.key) - 1;
      send({ type: 'answer', choice: i });
    }
  };
  document.addEventListener('keydown', onKey);

  api.onState((view) => {
    v = view;
    render();
  });

  return () => {
    clearInterval(clock);
    sizer?.disconnect();
    document.removeEventListener('keydown', onKey);
  };
}
