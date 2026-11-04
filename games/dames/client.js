// Dames côté navigateur : l'affichage et les clics (voir docs/integration.md §8).
// Le serveur envoie avec le plateau la liste des coups possibles (view().moves : { path, taken }) : le client ne recalcule aucune règle,
// il guide la saisie (pièces jouables, cases d'arrivée, une rafle case par case) puis envoie le chemin complet { path }.

const SIZE = 10;
const SIDE = ['Blancs', 'Bleus'];
const QUIET_LIMIT = 50; // comme rules.js : 25 coups de dame par joueur

const samePrefix = (path, prefix) => prefix.every((v, i) => path[i] === v);
const samePath = (a, b) => a.length === b.length && samePrefix(a, b);

// Confettis de victoire : une poignée de petits rectangles qui tombent, retirés au bout de quelques secondes.
const CONFETTI = ['#FF5CB0', '#FFE23D', '#2F5BFF', '#1FE0CF', '#fff'];
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
  const cellName = (i) => `${'abcdefghij'[i % SIZE]}${SIZE - Math.floor(i / SIZE)}`;

  let state = null;
  let info = null;
  let sel = []; // chemin en cours de saisie : [départ, 1re arrivée, …]
  let busy = false; // un coup vient d'être envoyé, on attend la réponse du hub
  let flip = false; // le joueur des bleus voit le plateau à l'envers : ses pièces sont en bas
  let focusCell = 0;
  let lean = 1;
  let prevBoard = null;
  let animMove = null;
  let ticker = null;

  const squares = new Map(); // index de case -> élément (cases foncées seulement)
  const pieces = new Map(); // index de case -> pièce affichée
  const grid = h('div.d-grid', { role: 'grid', 'aria-label': 'Damier de 10 sur 10' });
  const files = h('div.d-files', { 'aria-hidden': 'true' });
  const ranks = h('div.d-ranks', { 'aria-hidden': 'true' });
  const frame = h('div.d-frame', files, ranks, grid);

  const players = h('div.d-players');
  const status = h('p.d-status', { 'aria-live': 'polite' });
  const note = h('p.d-note');
  const cancel = h('button.d-cancel', { type: 'button', hidden: true, onclick: () => reset() }, 'Annuler');
  const timerText = h('span.d-timer-text');
  const timerFill = h('span.d-timer-fill');
  const timer = h('div.d-timer', { hidden: true, 'aria-hidden': 'true' }, h('span.d-timer-bar', timerFill), timerText);

  root.append(h('div.d',
    players,
    h('div.d-statusrow', status, cancel, note, timer),
    h('div.d-boardwrap', frame)));

  const myTurn = () => Boolean(state && info && !info.over && !busy && info.turn.includes(api.me.id));
  const mySeat = () => (state ? state.players.indexOf(api.me.id) : -1);

  // (Re)construit les 100 cases dans l'ordre d'affichage ; appelé quand l'orientation change (au premier état).
  function build() {
    squares.clear();
    pieces.clear();
    const order = Array.from({ length: SIZE * SIZE }, (_, d) => (flip ? SIZE * SIZE - 1 - d : d));
    grid.replaceChildren(...order.map((i) => {
      const r = Math.floor(i / SIZE);
      const c = i % SIZE;
      if ((r + c) % 2 === 0) return h('div.d-sq.is-light', { 'aria-hidden': 'true' });
      const piece = h('span.d-piece', { hidden: true, 'aria-hidden': 'true' });
      const sq = h('button.d-sq.is-dark', {
        type: 'button', role: 'gridcell', tabindex: -1, dataset: { cell: i },
        onclick: () => onCell(i),
        onfocus: () => { focusCell = i; setTab(i); },
      }, piece, h('span.d-mark', { 'aria-hidden': 'true' }));
      squares.set(i, sq);
      pieces.set(i, piece);
      return sq;
    }));
    files.replaceChildren(...Array.from({ length: SIZE }, (_, k) => h('span', 'abcdefghij'[flip ? SIZE - 1 - k : k])));
    ranks.replaceChildren(...Array.from({ length: SIZE }, (_, k) => h('span', String(flip ? k + 1 : SIZE - k))));
    focusCell = [...squares.keys()][flip ? 0 : squares.size - 1];
    setTab(focusCell);
  }

  function setTab(i) {
    for (const [k, el] of squares) el.tabIndex = k === i ? 0 : -1;
  }

  function reset() {
    sel = [];
    render();
  }

  const moves = () => (state && myTurn() ? state.moves : []);
  const movable = () => new Set(moves().map((m) => m.path[0]));
  const targets = () => new Set(!sel.length ? [] : moves().filter((m) => m.path.length > sel.length && samePrefix(m.path, sel)).map((m) => m.path[sel.length]));

  function onCell(i) {
    if (!state || info.over || busy) return;
    if (!myTurn()) {
      if (info.isPlayer) api.toast("Ce n'est pas ton tour.");
      return;
    }
    const can = movable();
    if (!sel.length) {
      if (can.has(i)) {
        sel = [i];
        render();
      } else if (state.board[i] !== 0 && Math.sign(state.board[i]) === (mySeat() === 0 ? 1 : -1)) {
        api.toast(state.moves[0]?.taken.length ? 'Prise obligatoire : joue une des pièces cerclées de jaune.' : 'Cette pièce ne peut pas bouger.');
      }
      return;
    }
    if (sel.length === 1 && i === sel[0]) {
      reset();
      return;
    }
    if (sel.length === 1 && can.has(i) && !targets().has(i)) {
      sel = [i]; // on change de pièce
      render();
      return;
    }
    if (targets().has(i)) {
      sel = [...sel, i];
      if (state.moves.some((m) => samePath(m.path, sel))) {
        busy = true;
        render();
        api.sendMove({ path: sel }).catch(() => {}).finally(() => {
          busy = false;
          sel = [];
          if (state) render();
        });
      } else {
        render();
      }
      return;
    }
    api.toast(sel.length > 1 ? 'Continue ta prise : touche une case marquée d’un point.' : 'Choisis une case marquée d’un point, ou une autre pièce.');
  }

  // Clavier : flèches pour se déplacer de case foncée en case foncée, Entrée/Espace pour choisir, Échap pour annuler.
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sel.length) {
      reset();
      e.preventDefault();
      return;
    }
    const arrows = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    const d = arrows[e.key];
    if (!d || e.ctrlKey || e.metaKey || e.altKey || !e.target.closest?.('.d-sq')) return;
    // Sur l'écran, « haut » est toujours vers le haut : si le plateau est retourné, on inverse.
    const [dr, dc] = flip ? [-d[0], -d[1]] : d;
    let r = Math.floor(focusCell / SIZE);
    let c = focusCell % SIZE;
    if (dr === 0) {
      c += dc * 2;
      lean = d[1];
    } else {
      r += dr;
      const side = flip ? -lean : lean;
      c += (c + side >= 0 && c + side < SIZE ? side : -side);
    }
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || !squares.has(r * SIZE + c)) return;
    squares.get(r * SIZE + c).focus();
    e.preventDefault();
  });

  const nameOf = (id) => (id === api.me.id ? 'Tu' : api.user(id).pseudo);
  const verb = (id, one, two) => (id === api.me.id ? two : one);
  const count = (board, side) => board.filter((p) => p !== 0 && (p > 0 ? 0 : 1) === side).length;

  function statusText(s) {
    if (s.forfeit) return `${api.user(s.forfeit).pseudo} a abandonné. ${nameOf(s.winner)} ${verb(s.winner, 'gagne', 'gagnes')} !`;
    if (s.winner) return `${nameOf(s.winner)} ${verb(s.winner, 'gagne', 'gagnes')} : plus de coup possible pour l’adversaire.`;
    if (s.draw) return `Partie nulle : 25 coups de dame chacun, sans prise ni pion.`;
    const slow = s.last?.auto ? `${s.last.by === api.me.id ? "Tu n'as" : `${api.user(s.last.by).pseudo} n'a`} pas joué à temps : coup joué au hasard. ` : '';
    if (myTurn()) {
      const take = s.moves[0]?.taken.length || 0;
      if (sel.length > 1) return `${slow}Continue ta prise : touche la case suivante.`;
      if (sel.length === 1) return `${slow}Touche une case d’arrivée marquée d’un point.`;
      return `${slow}${take ? `À toi : prise obligatoire${take > 1 ? ` de ${take} pièces` : ''}.` : 'À toi : touche une pièce cerclée de jaune.'}`;
    }
    if (info.isPlayer) return `${slow}${api.user(s.players[s.turn]).pseudo} réfléchit…`;
    return `${slow}Au tour de ${api.user(s.players[s.turn]).pseudo}.`;
  }

  function renderPlayers(s) {
    players.replaceChildren(...s.players.map((id, seat) => {
      const turn = s.turn === seat && !info.over;
      const won = s.winner === id;
      const left = count(s.board, seat);
      return h(`div.d-player.s${seat}${turn ? '.is-turn' : ''}${won ? '.is-won' : ''}`,
        h('span.d-token', { 'aria-hidden': 'true' }),
        api.token(api.user(id), { size: 's' }),
        h('span.d-who', h('span.d-name', api.user(id).pseudo), h('span.d-side', `${SIDE[seat]}${won ? ' · gagne' : ''}`)),
        h('span.d-count', { 'aria-label': `${left} ${left > 1 ? 'pièces' : 'pièce'}` }, String(left)));
    }));
  }

  function render() {
    const s = state;
    if (!s) return;
    if (!prevBoard) animMove = null;
    else if (s.board.some((v, i) => v !== prevBoard[i])) animMove = s.last;
    prevBoard = s.board.slice();
    const can = movable();
    const next = targets();
    const takenNow = new Set();
    if (sel.length > 1) {
      const m = s.moves.find((mv) => samePrefix(mv.path, sel));
      if (m) m.taken.slice(0, sel.length - 1).forEach((t) => takenNow.add(t));
    }
    const ghostAt = sel.length > 1 ? sel[sel.length - 1] : -1;
    const last = new Set(animMove && !sel.length ? [animMove.path[0], animMove.path[animMove.path.length - 1]] : []);
    for (const [i, sq] of squares) {
      const v = s.board[i];
      const piece = pieces.get(i);
      const showGhost = i === ghostAt;
      const shown = v !== 0 || showGhost;
      piece.hidden = !shown;
      const kind = showGhost ? s.board[sel[0]] : v;
      piece.className = `d-piece ${kind > 0 ? 'w' : 'b'}${Math.abs(kind) === 2 ? ' king' : ''}${showGhost ? ' is-ghost' : ''}${takenNow.has(i) ? ' is-taken' : ''}${animMove && i === animMove.path[animMove.path.length - 1] && !sel.length ? ' is-landed' : ''}`;
      const isStart = sel[0] === i;
      sq.classList.toggle('is-movable', can.has(i) && !sel.length);
      sq.classList.toggle('is-selected', isStart);
      sq.classList.toggle('is-target', next.has(i));
      sq.classList.toggle('is-last', last.has(i));
      sq.classList.toggle('is-step', sel.indexOf(i) > 0);
      const step = sel.indexOf(i);
      sq.lastChild.textContent = step > 0 && step < sel.length ? String(step) : '';
      sq.setAttribute('aria-disabled', can.has(i) || next.has(i) || isStart ? 'false' : 'true');
      const what = v === 0 ? 'libre' : `${v > 0 ? 'blanc' : 'bleu'}${Math.abs(v) === 2 ? ', dame' : ', pion'}`;
      sq.setAttribute('aria-label', `${cellName(i)}, ${what}${next.has(i) ? ', arrivée possible' : can.has(i) && !sel.length ? ', peut jouer' : ''}${isStart ? ', sélectionné' : ''}`);
    }
    renderPlayers(s);
    status.textContent = statusText(s);
    const quiet = s.quiet >= 30 && !info.over ? `Nulle dans ${QUIET_LIMIT - s.quiet} coups si personne ne prend ni ne joue de pion.` : '';
    note.textContent = quiet;
    note.hidden = !quiet;
    cancel.hidden = !sel.length || busy;
    renderTimer();
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
    const wasBoard = state?.board;
    if (wasOver === false && i.over && s.winner && !s.forfeit) confetti(root, h);
    wasOver = i.over;
    state = s;
    info = i;
    const newFlip = mySeat() === 1;
    if (squares.size === 0 || newFlip !== flip) {
      flip = newFlip;
      build();
    }
    // Un état nouveau (coup joué, minuteur, abandon) annule la saisie en cours ; un simple rafraîchissement la garde.
    if (wasBoard && s.board.some((v, k) => v !== wasBoard[k])) sel = [];
    if (sel.length && !s.moves.some((m) => samePrefix(m.path, sel))) sel = [];
    render();
    clearInterval(ticker);
    ticker = s.timer && !info.over ? setInterval(renderTimer, 250) : null;
  });

  return () => clearInterval(ticker);
}
