// Six Savoirs côté navigateur : le plateau en roue (anneau, six rayons, le Centre) et, à côté, le panneau des joueurs,
// du dé et de la question. Les pions sont les têtes des personnages des joueurs (api.token). Chaque case porte ses
// coordonnées sur un plateau de 1000 × 1000 (rules.js).
const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const ICONS = { geo: '🌍', histoire: '🏛️', sciences: '🔬', divert: '🎬', sport: '⚽', lettres: '📚' };
const PANEL = 360; // largeur du panneau quand il est à côté du plateau

// Le fond du plateau : l'anneau et les rayons (dessin fixe, sans donnée de joueur).
function lines() {
  const el = document.createElement('div');
  el.className = 'sv-lines';
  el.setAttribute('aria-hidden', 'true');
  const spokes = Array.from({ length: 6 }, (_, k) => {
    const a = ((-90 + k * 60) * Math.PI) / 180;
    return `<line x1="500" y1="500" x2="${500 + 440 * Math.cos(a)}" y2="${500 + 440 * Math.sin(a)}"/>`;
  }).join('');
  el.innerHTML = `<svg viewBox="0 0 1000 1000"><circle cx="500" cy="500" r="485" class="rim"/><circle cx="500" cy="500" r="440"/>${spokes}</svg>`;
  return el;
}

export function mount(root, api) {
  const { h } = api;
  let v = null;
  let sending = false;
  const name = (id) => (id === api.me.id ? 'Toi' : api.user(id)?.pseudo ?? '?');
  // Dans le journal, toujours le pseudo (« Toi lance 3 » ne se dit pas).
  const withNames = (text) => text.replace(/#(\d+)/g, (_, id) => api.user(Number(id))?.pseudo ?? '?');

  const board = h('div.sv-board', { role: 'group', 'aria-label': 'Le plateau' });
  const bg = lines();
  const center = h('div.sv-center');
  const timer = h('div.sv-timer', h('i'));
  const frame = h('div.sv', board, center);
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
      h('header.sv-card-head', h('span', ICONS[q.cat]), v.catNames[q.cat],
        q.final ? h('b.sv-card-seal', 'Question finale') : BOARD_SEAL() ? h('b.sv-card-seal', 'Sceau en jeu') : null),
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
        verdict()) : null);
  }
  function verdict() {
    const a = v.answer;
    if (!a.right) return a.choice === null ? 'Temps écoulé.' : 'Raté !';
    if (v.winner !== null) return 'Bravo, question finale réussie !';
    if (a.gained) return `Bravo ! Sceau ${v.catNames[a.gained]} gagné.`;
    const sq = v.board[v.pos[v.cur]];
    if (sq.seal) return 'Bonne réponse : tu as déjà ce sceau, on rejoue !';
    return 'Bonne réponse : on rejoue ! (les sceaux se gagnent sur les grandes cases)';
  }
  // La question en cours se joue-t-elle sur un Sceau pas encore gagné ?
  const BOARD_SEAL = () => {
    const sq = v.board[v.pos[v.cur]];
    return v.phase === 'question' && sq.seal && !v.seals[v.cur].includes(sq.cat);
  };
  const ready = (id) => v.seals[id].length >= v.goal;
  // Ce qu'il reste à faire, en une ligne, pour le joueur dont c'est le tour.
  const hint = () => {
    const id = v.cur;
    if (ready(id)) return `${name(id)} ${id === api.me.id ? 'as' : 'a'} tous ses sceaux : direction le Centre pour la question finale !`;
    const need = v.goal - v.seals[id].length;
    return `Encore ${need} sceau${need > 1 ? 'x' : ''} : réponds juste sur une grande case ✦ de couleur.`;
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
      nodes.push(h('p.sv-wait', mine ? 'Choisis ta case parmi celles en surbrillance.' : `${name(v.cur)} choisit sa case…`));
    } else {
      nodes.push(questionCard(mine));
      if (!mine && v.phase === 'question') nodes.push(h('p.sv-wait', `${name(v.cur)} réfléchit…`));
    }
    if (v.phase !== 'over' && (v.phase === 'roll' || v.phase === 'move')) nodes.push(timer, h('p.sv-hint', hint()));
    nodes.push(h('ol.sv-log', [...v.log].slice(-3).reverse().map((l) => h('li', withNames(l.text)))));
    return nodes;
  }

  function squares() {
    const mine = v.cur === api.me.id && v.phase === 'move';
    return v.board.map((sq, i) => {
      const here = v.players.filter((id) => !v.left.includes(id) && v.pos[id] === i);
      const dest = v.phase === 'move' && v.dests.includes(i);
      const kind = sq.hub ? '.is-hub' : sq.seal ? '.is-seal' : sq.again ? '.is-again' : sq.spoke ? '.is-spoke' : '';
      const label = sq.hub ? 'Centre' : sq.again ? 'Rejoue' : `${v.catNames[sq.cat]}${sq.seal ? ' · Sceau' : ''}`;
      const props = {
        style: `left:${sq.x / 10}%;top:${sq.y / 10}%${sq.cat ? `;--c:var(--sv-${sq.cat})` : ''}`,
        title: label,
      };
      const content = [
        sq.seal ? h('span.sv-sq-icon', { 'aria-hidden': 'true' }, ICONS[sq.cat]) : null,
        sq.again ? h('span.sv-sq-icon', { 'aria-hidden': 'true' }, '↻') : null,
        here.length ? h('span.sv-pawns', here.map((id) => api.token(api.user(id), { size: 's' }))) : null,
      ];
      if (dest && mine) return h(`button.sv-sq${kind}.is-dest`, { ...props, type: 'button', 'aria-label': `Aller sur ${label}`, onclick: () => send({ type: 'move', to: i }) }, ...content);
      return h(`div.sv-sq${kind}${dest ? '.is-dest' : ''}`, props, ...content);
    });
  }

  function render() {
    board.replaceChildren(bg, ...squares());
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

  // Le plateau prend le plus grand carré possible : à côté du panneau sur un écran large, au-dessus sinon.
  const fit = () => {
    const pad = window.innerWidth < 600 ? 12 : 24;
    const w = root.clientWidth - pad;
    const hh = root.clientHeight - pad;
    const row = w - PANEL - 16 >= Math.min(hh, 420);
    frame.classList.toggle('is-row', row);
    const size = row ? Math.min(w - PANEL - 16, hh) : Math.min(w, 640, Math.max(hh * 0.7, 320));
    board.style.setProperty('--b', `${Math.max(260, Math.floor(size))}px`);
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
