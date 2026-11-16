// « Reversi » côté navigateur : l'affichage et les clics (voir docs/integration.md §8).
// Le serveur envoie, avec le plateau, la liste des coups possibles (view().legal) : le client ne recalcule aucune règle.

const SIZE = 8;
const FILES = 'abcdefgh';
const SIDE = ['Fuchsia', 'Bleu nuit'];
const SIDE_ONE = ['fuchsia', 'bleu nuit'];

// Confettis de victoire : une poignée de petits rectangles qui tombent, retirés au bout de quelques secondes.
const CONFETTI = ['#FF2D95', '#6DF0C0', '#FFE23D', '#8FA2FF', '#fff'];
function confetti(root, h) {
  const box = h('div.fx-confetti', { 'aria-hidden': 'true' });
  for (let i = 0; i < 48; i++) {
    const p = h('span');
    p.style.cssText = `left:${Math.random() * 100}%;width:${7 + Math.random() * 7}px;height:${9 + Math.random() * 10}px;background:${CONFETTI[i % CONFETTI.length]};animation-delay:${Math.random() * 0.5}s;animation-duration:${1.8 + Math.random() * 1.4}s;--dx:${Math.round((Math.random() - 0.5) * 180)}px;--rot:${Math.round(Math.random() * 720)}deg`;
    box.append(p);
  }
  root.append(box);
  setTimeout(() => box.remove(), 4200);
}

export function mount(root, api) {
  const { h } = api;
  const cellName = (i) => `${FILES[i % SIZE]}${Math.floor(i / SIZE) + 1}`;

  // 64 cases. Une case = un bouton (une seule dans l'ordre de tabulation, les flèches font le reste) qui porte un pion à deux faces.
  const cells = [];
  const discs = [];
  const grid = h('div.r-grid', { role: 'grid', 'aria-label': 'Plateau de 8 sur 8' });
  for (let r = 0; r < SIZE; r++) {
    const row = h('div.r-row', { role: 'row' });
    for (let c = 0; c < SIZE; c++) {
      const i = r * SIZE + c;
      const disc = h('span.r-disc', { hidden: true, 'aria-hidden': 'true' }, h('i.r-face.f0'), h('i.r-face.f1'));
      const cell = h('button.r-cell', {
        type: 'button', role: 'gridcell', tabindex: -1,
        dataset: { cell: i },
        onclick: () => play(i),
        onfocus: () => setFocus(i),
      }, h('span.r-hint', { 'aria-hidden': 'true' }), disc);
      cells.push(cell);
      discs.push(disc);
      row.append(cell);
    }
    grid.append(row);
  }

  const scoreEls = [0, 1].map((seat) => ({
    box: h(`div.r-score.s${seat}`),
  }));
  const status = h('p.r-status', { 'aria-live': 'polite' });
  const timerText = h('span.r-timer-text');
  const timerFill = h('span.r-timer-fill');
  const timer = h('div.r-timer', { hidden: true, 'aria-hidden': 'true' }, h('span.r-timer-bar', timerFill), timerText);
  const frame = h('div.r-frame', grid);

  root.append(h('div.r',
    h('div.r-scores', scoreEls.map((s) => s.box)),
    h('div.r-statusrow', status, timer),
    h('div.r-boardwrap', frame)));

  let state = null;
  let info = null;
  let prev = null; // plateau déjà dessiné
  let animLast = null; // dernier coup à animer (pas au chargement, ni quand l'état est renvoyé à l'identique)
  let focusCell = 3 * SIZE + 3;
  let ticker = null;

  const myTurn = () => Boolean(state && info && !info.over && info.turn.includes(api.me.id));
  const mySeat = () => (state ? state.players.indexOf(api.me.id) : -1);

  function setFocus(i) {
    focusCell = i;
    cells.forEach((c, k) => { c.tabIndex = k === i ? 0 : -1; });
  }
  setFocus(focusCell);

  function play(i) {
    if (!state || info.over) return;
    if (!myTurn()) {
      if (info.isPlayer) api.toast("Ce n’est pas ton tour.");
      return;
    }
    if (state.board[i] !== null) return;
    api.sendMove({ cell: i }).catch(() => {});
  }

  // Flèches : déplacent le curseur sur le plateau ; Entrée ou Espace jouent la case.
  root.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (!d || e.ctrlKey || e.metaKey || e.altKey || !e.target.closest?.('.r-cell')) return;
    const r = Math.min(SIZE - 1, Math.max(0, Math.floor(focusCell / SIZE) + d[0]));
    const c = Math.min(SIZE - 1, Math.max(0, (focusCell % SIZE) + d[1]));
    setFocus(r * SIZE + c);
    cells[r * SIZE + c].focus();
    e.preventDefault();
  });

  const nameOf = (id) => (id === api.me.id ? 'Tu' : api.user(id).pseudo);
  const verb = (id, one, two) => (id === api.me.id ? two : one);

  function statusText(s) {
    const [b, w] = s.counts;
    if (s.forfeit) return `${api.user(s.forfeit).pseudo} a abandonné. ${nameOf(s.winner)} ${verb(s.winner, 'gagne', 'gagnes')} !`;
    if (s.over) {
      const score = `${Math.max(b, w)} à ${Math.min(b, w)}`;
      return s.winner ? `${nameOf(s.winner)} ${verb(s.winner, "l’emporte", "l’emportes")}, ${score}.` : `Égalité parfaite : ${b} partout.`;
    }
    const notes = [];
    if (s.passed) notes.push(s.passed === api.me.id ? "Tu n’as aucun coup possible : ton tour est passé." : `${api.user(s.passed).pseudo} n’a aucun coup possible : son tour est passé.`);
    if (s.last?.auto) notes.push(`${s.last.by === api.me.id ? 'Tu' : api.user(s.last.by).pseudo} ${s.last.by === api.me.id ? "n’as" : "n’a"} pas joué à temps : un coup a été joué au hasard.`);
    const tail = myTurn() ? 'À toi : pose un pion sur un point.' : info.isPlayer ? `${api.user(s.players[s.turn]).pseudo} réfléchit…` : `À ${api.user(s.players[s.turn]).pseudo} de jouer.`;
    return [...notes, tail].join(' ');
  }

  function renderScores(s) {
    scoreEls.forEach(({ box }, seat) => {
      const id = s.players[seat];
      const turn = s.turn === seat && !info.over;
      const won = s.winner === id;
      box.className = `r-score s${seat}${turn ? ' is-turn' : ''}${won ? ' is-won' : ''}`;
      box.replaceChildren(
        h('span.r-token', { 'aria-hidden': 'true' }),
        api.token(api.user(id), { size: 's' }),
        h('span.r-who', h('span.r-name', api.user(id).pseudo), h('span.r-side', `${SIDE[seat]}${id === api.me.id ? ' · toi' : ''}`, won ? h('span.r-won', ' · gagne') : null)),
        h('span.r-count', { 'aria-label': `${s.counts[seat]} pions` }, String(s.counts[seat])));
    });
  }

  function renderBoard(s) {
    if (!prev) animLast = null;
    else if (s.board.some((v, i) => v !== prev[i])) animLast = s.last;
    const flips = new Map((animLast?.flipped || []).map((i, k) => [i, k]));
    const legal = new Set(myTurn() ? s.legal : []);
    const mine = mySeat();
    s.board.forEach((v, i) => {
      const d = discs[i];
      d.hidden = v === null;
      const isPut = animLast && animLast.cell === i;
      const flip = flips.has(i);
      d.className = `r-disc${v === 1 ? ' is-white' : ''}${isPut ? ' is-put' : ''}${flip ? ` is-flip to${v}` : ''}`;
      if (flip) d.style.setProperty('--k', flips.get(i));
      const cell = cells[i];
      cell.classList.toggle('is-legal', legal.has(i));
      cell.classList.toggle('is-last', Boolean(animLast && animLast.cell === i));
      cell.dataset.me = legal.has(i) && mine >= 0 ? mine : '';
      cell.setAttribute('aria-disabled', legal.has(i) ? 'false' : 'true');
      cell.setAttribute('aria-label', `${cellName(i)}, ${v === null ? (legal.has(i) ? 'coup possible' : 'libre') : `pion ${SIDE_ONE[v]}`}`);
    });
    prev = s.board.slice();
  }

  function renderTimer() {
    if (!state || !state.timer || !info || info.over || !info.deadline) {
      timer.hidden = true;
      return;
    }
    const left = Math.max(0, info.deadline - api.now());
    timer.hidden = false;
    timerFill.style.width = `${Math.min(100, (left / (state.timer * 1000)) * 100)}%`;
    const sec = Math.ceil(left / 1000);
    timerText.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    timer.classList.toggle('is-low', left < 10_000);
  }

  let wasOver = null; // null tant qu'aucun état n'a été reçu : pas de confettis en rechargeant une partie finie
  api.onState((s, i) => {
    state = s;
    info = i;
    if (wasOver === false && i.over && s.winner && (s.winner === api.me.id || !i.isPlayer)) confetti(root, h); // le gagnant, même par abandon ; jamais celui qui perd
    wasOver = i.over;
    renderScores(s);
    renderBoard(s);
    status.textContent = statusText(s);
    renderTimer();
    clearInterval(ticker);
    ticker = s.timer && !info.over ? setInterval(renderTimer, 250) : null;
  });

  return () => clearInterval(ticker);
}
