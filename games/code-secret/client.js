// Code secret côté navigateur : composer son code, chercher celui de l'autre sur un plateau de pions.
// Le hub fournit api (voir docs/integration.md §8) ; les règles et ce que chacun voit sont dans rules.js.

// Les pions : une couleur ET une forme, pour ne pas dépendre de la couleur seule.
const COLORS = [
  { name: 'rouge', hex: '#E5382B', sym: '#fff' },
  { name: 'bleu', hex: '#2C6BDB', sym: '#fff' },
  { name: 'jaune', hex: '#F6C51B', sym: '#3a2a00' },
  { name: 'vert', hex: '#2E9E55', sym: '#fff' },
  { name: 'orange', hex: '#F2831C', sym: '#3a1c00' },
  { name: 'violet', hex: '#8446C2', sym: '#fff' },
  { name: 'rose', hex: '#F27DB0', sym: '#4a0d28' },
  { name: 'turquoise', hex: '#22BDB3', sym: '#06302d' },
];

export function mount(root, api) {
  const { h } = api;

  let view = null;
  let draft = [];
  let active = 0;
  let notice = '';
  let roundKey = '';
  let seen = [0, 0]; // essais déjà vus de chaque joueur, pour animer les nouveaux
  let animateFrom = [Infinity, Infinity];

  const iPlay = () => view.seat >= 0;
  const me = () => view.seat;
  const oppSeat = () => (iPlay() ? 1 - view.seat : 1);
  const pseudo = (seat) => api.user(view.players[seat]).pseudo;

  const status = h('p.cs-status', { 'aria-live': 'polite' });
  const timerEl = h('span.cs-timer', { hidden: true, role: 'timer' });
  const secretBar = h('div.cs-secret');
  const stage = h('div.cs-stage');
  const dock = h('div.cs-dock');
  // La molette du coffre : un cran de plus à chaque manche.
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs) => {
    const el = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };
  const dialSvg = svg('svg', { viewBox: '0 0 64 64', class: 'cs-dial-svg' });
  dialSvg.append(svg('circle', { cx: 32, cy: 32, r: 30, class: 'cs-dial-ring' }), svg('circle', { cx: 32, cy: 32, r: 21, class: 'cs-dial-face' }));
  for (let i = 0; i < 40; i += 1) {
    const a = (i / 40) * Math.PI * 2;
    const long = i % 5 === 0;
    const r1 = 26.5;
    const r2 = long ? 22.5 : 24.5;
    dialSvg.append(svg('line', { x1: 32 + Math.sin(a) * r1, y1: 32 - Math.cos(a) * r1, x2: 32 + Math.sin(a) * r2, y2: 32 - Math.cos(a) * r2, class: long ? 'cs-dial-tick is-long' : 'cs-dial-tick' }));
  }
  const dial = h('span.cs-dial', { 'aria-hidden': 'true' }, dialSvg);
  const wrap = h('div.cs',
    h('header.cs-lid',
      h('div.cs-lid-row', dial, h('h2.cs-logo', 'Code ', h('em', 'secret')), timerEl)),
    status, secretBar, stage, dock);
  root.append(wrap);

  // ——— Dessin d'un pion, d'une rangée d'indications ———
  const peg = (c, extra = '') => h(`span.cs-peg${extra}`, { style: `--c:${COLORS[c].hex};--sym:${COLORS[c].sym}`, dataset: { shape: String(c) }, role: 'img', 'aria-label': COLORS[c].name });
  const hole = () => h('span.cs-hole');

  function feedback(black, white, holes) {
    const pegs = [];
    for (let i = 0; i < holes; i += 1) {
      pegs.push(h(`i.cs-fb-peg${i < black ? '.is-placed' : i < black + white ? '.is-misplaced' : ''}`, { style: `--i:${i}` }));
    }
    return h('span.cs-fb', {
      style: `--cols:${holes === 5 ? 3 : 2}`, role: 'img',
      'aria-label': `${black} bien placé${black > 1 ? 's' : ''}, ${white} mal placé${white > 1 ? 's' : ''}`,
    }, pegs);
  }

  const codeLabel = (code) => code.map((c) => COLORS[c].name).join(', ');

  // ——— Le plateau d'un joueur : ses essais contre le code de l'autre ———
  function board(seat) {
    const mineBoard = iPlay() && seat === me();
    const guesses = view.guesses[seat];
    const rows = [];
    for (let i = 0; i < view.maxTries; i += 1) {
      const g = guesses[i];
      const cls = ['cs-row'];
      let body;
      let fb = h('span.cs-fb', { 'aria-hidden': 'true', style: `--cols:${view.holes === 5 ? 3 : 2}` }, Array.from({ length: view.holes }, () => h('i.cs-fb-peg')));
      let label = `Essai ${i + 1}, vide`;
      if (g) {
        body = g.code.map((c) => peg(c));
        fb = feedback(g.black, g.white, view.holes);
        label = `Essai ${i + 1} : ${codeLabel(g.code)}. ${g.black} bien placé${g.black > 1 ? 's' : ''}, ${g.white} mal placé${g.white > 1 ? 's' : ''}`;
        if (i >= animateFrom[seat]) cls.push('is-new');
        if (g.black === view.holes) cls.push('is-found');
      } else if (i === guesses.length && view.phase === 'guessing') {
        cls.push('is-current');
        if (mineBoard) {
          const locked = view.myPending;
          const code = locked || draft;
          body = Array.from({ length: view.holes }, (_, k) => {
            const c = code[k];
            if (locked) return c === null || c === undefined ? hole() : peg(c, '.is-locked');
            return h(`button.cs-slot${k === active ? '.is-active' : ''}${c === null || c === undefined ? '' : '.is-filled'}`, {
              type: 'button', dataset: { k: `slot${k}` },
              'aria-label': `Trou ${k + 1} sur ${view.holes} : ${c === null || c === undefined ? 'vide' : COLORS[c].name}${k === active ? ', sélectionné' : ''}`,
              onclick: () => {
                if (k === active && draft[k] !== null) draft[k] = null;
                active = k;
                notice = '';
                paintAll();
              },
            }, c === null || c === undefined ? null : peg(c));
          });
          label = locked ? `Essai ${i + 1} joué, en attente de ${pseudo(oppSeat())}` : `Essai ${i + 1} en cours`;
        } else {
          const played = view.guessed[seat];
          body = Array.from({ length: view.holes }, () => (played ? h('span.cs-hole.is-covered') : hole()));
          label = played ? `Essai ${i + 1} : ${pseudo(seat)} a joué` : `Essai ${i + 1} : ${pseudo(seat)} réfléchit`;
        }
      }
      body ||= Array.from({ length: view.holes }, () => hole());
      rows.push(h(`div.${cls.join('.')}`, { role: 'group', 'aria-label': label, style: `--n:${i}` }, h('span.cs-num', { 'aria-hidden': 'true' }, String(i + 1)), h('span.cs-pegs', body), fb));
    }
    const name = iPlay() ? (mineBoard ? 'Mes essais' : `Essais de ${pseudo(seat)}`) : `Essais de ${pseudo(seat)}`;
    const sub = mineBoard ? `Tu cherches le code de ${pseudo(1 - seat)}` : `${pseudo(seat)} cherche le code de ${pseudo(1 - seat)}`;
    return h(`section.cs-board${mineBoard ? '.is-mine' : ''}`,
      h('div.cs-board-head', h('h3', name), h('p', sub)),
      h('div.cs-rows', rows),
      h('p.cs-legend', h('i.cs-fb-peg.is-placed'), ' couleur bien placée', h('i.cs-fb-peg.is-misplaced'), ' bonne couleur, mal placée'));
  }

  // ——— La zone de saisie : palette et boutons ———
  function rack() {
    const used = new Set(draft.filter((c) => c !== null));
    const complete = draft.every((c) => c !== null);
    const palette = Array.from({ length: view.colors }, (_, c) => {
      const blocked = !view.doubles && used.has(c) && draft[active] !== c;
      return h('button.cs-pick', {
        type: 'button', dataset: { k: `c${c}` }, 'aria-disabled': blocked ? 'true' : 'false',
        'aria-label': `${COLORS[c].name}${blocked ? ', déjà utilisé' : ''}, touche ${c + 1}`,
        onclick: () => choose(c),
      }, peg(c), h('span.cs-pick-n', { 'aria-hidden': 'true' }, String(c + 1)));
    });
    const coding = view.phase === 'coding';
    return h('div.cs-rack',
      h('div.cs-palette', { role: 'group', 'aria-label': 'Couleurs' }, palette),
      h('div.cs-actions',
        h('button.cs-btn.cs-btn-quiet', { type: 'button', dataset: { k: 'clear' }, onclick: clearDraft, disabled: !draft.some((c) => c !== null) }, 'Effacer'),
        h('button.cs-btn.cs-btn-go', { type: 'button', dataset: { k: 'go' }, onclick: submit, disabled: !complete }, coding ? 'Enregistrer mon code' : 'Valider mon essai')),
      notice ? h('p.cs-notice', { role: 'alert' }, notice) : null,
    );
  }

  function choose(c) {
    if (!view || !iPlay()) return;
    const waiting = view.phase === 'coding' ? view.codeSet[me()] : view.phase === 'guessing' ? view.myPending : true;
    if (waiting) return;
    if (!view.doubles && draft.some((x, k) => x === c && k !== active)) {
      notice = 'Les doublons sont interdits dans cette partie : choisis une autre couleur.';
      return paintAll();
    }
    draft[active] = c;
    notice = '';
    const next = draft.findIndex((x, k) => x === null && k > active);
    active = next >= 0 ? next : draft.findIndex((x) => x === null) >= 0 ? draft.findIndex((x) => x === null) : active;
    paintAll();
  }

  function clearDraft() {
    draft = Array(view.holes).fill(null);
    active = 0;
    notice = '';
    paintAll();
  }

  function submit() {
    if (!draft.every((c) => c !== null)) return;
    const type = view.phase === 'coding' ? 'code' : 'guess';
    api.sendMove({ type, code: draft }).catch(() => {});
  }

  const onKey = (e) => {
    if (!view || !iPlay() || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = Number(e.key);
    if (n >= 1 && n <= view.colors) {
      choose(n - 1);
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const last = [...draft.keys()].reverse().find((k) => draft[k] !== null);
      if (last !== undefined) {
        draft[last] = null;
        active = last;
        paintAll();
      }
    }
  };
  document.addEventListener('keydown', onKey);

  // ——— Textes ———
  function statusText() {
    const opp = iPlay() ? pseudo(oppSeat()) : '';
    if (view.phase === 'over') {
      if (view.forfeit) return view.forfeit === api.me.id ? 'Tu as abandonné la partie.' : `${opp} a abandonné : tu gagnes !`;
      const n = (seat) => view.guesses[seat].length;
      if (!iPlay()) return view.winners.length === 1 ? `${api.user(view.winners[0]).pseudo} gagne !` : view.winners.length === 2 ? 'Égalité : les deux ont trouvé à la même manche.' : 'Personne n’a trouvé : égalité.';
      if (view.winners.length === 2) return `Égalité : vous avez trouvé le code à la même manche (en ${n(me())} essais) !`;
      if (view.winners.length === 0) return `Personne n’a trouvé le code en ${view.maxTries} essais : égalité.`;
      return view.winners[0] === api.me.id ? `Gagné ! Tu as trouvé le code en ${n(me())} essai${n(me()) > 1 ? 's' : ''}.` : `Perdu : ${opp} a trouvé le code en ${n(oppSeat())} essai${n(oppSeat()) > 1 ? 's' : ''}.`;
    }
    if (!iPlay()) return view.phase === 'coding' ? `${pseudo(0)} et ${pseudo(1)} composent leur code…` : `Manche ${view.guesses[0].length + 1} : ${pseudo(0)} et ${pseudo(1)} cherchent…`;
    if (view.phase === 'coding') {
      return view.codeSet[me()] ? `Code enregistré. ${opp} compose encore le sien…` : `Compose le code que ${opp} devra trouver : ${view.holes} couleurs${view.doubles ? '' : ' différentes'}.`;
    }
    const round = view.guesses[me()].length + 1;
    if (view.myPending) return `Essai ${round} joué. On attend ${opp}…`;
    return `Essai ${round} sur ${view.maxTries} : cherche le code de ${opp}.`;
  }

  // ——— Dessin complet ———
  function paintAll() {
    if (!view) return;
    wrap.dataset.phase = view.phase;
    status.textContent = statusText();
    dialSvg.style.transform = `rotate(${(view.guesses[0].length + (view.phase === 'coding' ? 0 : 1)) * 27}deg)`;
    wrap.style.setProperty('--holes', String(view.holes));

    // Mon code, bien visible pour moi seul.
    const mySecret = iPlay() ? view.myCode : null;
    if (mySecret) {
      secretBar.hidden = false;
      secretBar.replaceChildren(
        h('span.cs-secret-label', 'Ton code secret'),
        h('span.cs-secret-pegs', { role: 'img', 'aria-label': `Ton code : ${codeLabel(mySecret)}` }, mySecret.map((c) => peg(c))),
      );
    } else {
      secretBar.hidden = true;
      secretBar.replaceChildren();
    }

    const had = document.activeElement?.closest?.('.cs-dock, .cs-stage') ? document.activeElement.dataset.k : null;

    if (view.phase === 'coding') {
      stage.replaceChildren(codingPanel());
      dock.replaceChildren();
      dock.hidden = true;
    } else {
      const boards = iPlay() ? [board(me()), board(oppSeat())] : [board(0), board(1)];
      const parts = view.phase === 'over' && view.secrets ? [reveal(), h('div.cs-boards', boards)] : [h('div.cs-boards', boards)];
      stage.replaceChildren(...parts);
      const canPlay = iPlay() && view.phase === 'guessing' && !view.myPending;
      dock.hidden = !canPlay;
      dock.replaceChildren(...(canPlay ? [rack()] : []));
    }
    if (had) wrap.querySelector(`[data-k="${had}"]`)?.focus();
    paintTimer();
  }

  function codingPanel() {
    if (!iPlay()) return h('div.cs-panel', h('p.cs-lead', 'Les joueurs composent leur code en secret.'));
    if (view.codeSet[me()]) {
      return h('div.cs-panel', h('p.cs-lead', `${pseudo(oppSeat())} ${view.codeSet[oppSeat()] ? 'a fini' : 'compose encore son code'}.`));
    }
    const slots = Array.from({ length: view.holes }, (_, k) => {
      const c = draft[k];
      return h(`button.cs-slot.cs-slot-big${k === active ? '.is-active' : ''}${c === null ? '' : '.is-filled'}`, {
        type: 'button', dataset: { k: `slot${k}` },
        'aria-label': `Trou ${k + 1} sur ${view.holes} : ${c === null ? 'vide' : COLORS[c].name}${k === active ? ', sélectionné' : ''}`,
        onclick: () => {
          if (k === active && draft[k] !== null) draft[k] = null;
          active = k;
          notice = '';
          paintAll();
        },
      }, c === null ? null : peg(c));
    });
    return h('div.cs-panel',
      h('p.cs-lead', `Choisis ${view.holes} couleurs${view.doubles ? ' (les doublons sont permis)' : ' différentes'}. ${pseudo(oppSeat())} ne les verra pas.`),
      h('div.cs-slots', slots),
      rack());
  }

  function reveal() {
    const item = (seat) => h('div.cs-reveal-item',
      h('span', iPlay() && seat === me() ? 'Ton code' : `Code de ${pseudo(seat)}`),
      h('span.cs-secret-pegs', { role: 'img', 'aria-label': codeLabel(view.secrets[seat]) }, view.secrets[seat].map((c) => peg(c))));
    return h('div.cs-reveal', h('h3', 'Les codes'), item(0), item(1));
  }

  function paintTimer() {
    const on = view && view.phase !== 'over' && view.deadline;
    timerEl.hidden = !on;
    if (!on) return;
    const left = Math.max(0, Math.ceil((view.deadline - api.now()) / 1000));
    timerEl.textContent = left >= 60 ? `${Math.floor(left / 60)} min ${String(left % 60).padStart(2, '0')}` : `${left} s`;
    timerEl.classList.toggle('is-low', left <= 10);
    timerEl.setAttribute('aria-label', `${left} secondes restantes`);
  }
  const tick = setInterval(paintTimer, 250);

  // Confettis quand on gagne (décor seulement, coupé si l'animation est réduite).
  let confettiDone = false;
  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || confettiDone) return;
    confettiDone = true;
    const colors = ['#ff4fa8', '#ffe74a', '#2ee6d6', '#8f5bff', '#ff9a3c', '#8cff6a'];
    const box = h('div.cs-confetti', { 'aria-hidden': 'true' }, Array.from({ length: 44 }, (_, i) => h('i', {
      style: `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random() * 0.8}s;animation-duration:${2 + Math.random() * 1.6}s;--r:${Math.round(Math.random() * 720 - 360)}deg`,
    })));
    root.append(box);
    setTimeout(() => box.remove(), 4800);
  }

  api.onState((v) => {
    const first = view === null;
    view = v;
    // Nouvelle manche, nouvelle phase ou nouvelle partie : on repart d'un brouillon vide.
    const key = `${v.phase}:${v.guesses[0].length}:${v.guesses[1].length}:${v.holes}`;
    if (key !== roundKey || draft.length !== v.holes) {
      roundKey = key;
      draft = Array(v.holes).fill(null);
      active = 0;
      notice = '';
    }
    // Les essais arrivés depuis le dernier état s'animent (pas ceux d'une reconnexion).
    animateFrom = first ? [Infinity, Infinity] : [seen[0], seen[1]];
    seen = [v.guesses[0].length, v.guesses[1].length];
    paintAll();
    if (v.phase === 'over' && v.winners.includes(api.me.id)) confetti();
    else if (v.phase !== 'over') confettiDone = false;
    // La rangée en cours reste visible sur téléphone.
    wrap.querySelector('.cs-board.is-mine .cs-row.is-current')?.scrollIntoView({ block: 'nearest' });
  });

  return () => {
    clearInterval(tick);
    document.removeEventListener('keydown', onKey);
  };
}
