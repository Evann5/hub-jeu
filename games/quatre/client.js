// Quatre à la suite côté navigateur : l'affichage et les clics (voir docs/integration.md §8).
// Les règles restent sur le serveur : ici on dessine l'état reçu et on envoie { col }.

const COLS = 7;
const ROWS = 6;
const COLOR_NAMES = ['Rose', 'Turquoise'];

// Confettis de victoire : une poignée de petits rectangles qui tombent, retirés au bout de quelques secondes.
const CONFETTI = ['#FF5DAE', '#1FE0CF', '#FFE23D', '#FF8A3D', '#fff'];
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

  // Une colonne = un bouton qui contient les 6 jetons (calque du dessous) et la grille percée (calque du dessus, en CSS).
  const discs = []; // discs[cell] : le jeton posé (ou à poser) à cette case
  const ghosts = [];
  const cols = Array.from({ length: COLS }, (_, c) => {
    const layer = h('span.q-layer', { 'aria-hidden': 'true' });
    const ghost = h('span.q-disc.q-ghost', { hidden: true });
    ghosts.push(ghost);
    for (let r = 0; r < ROWS; r++) {
      const d = h('span.q-disc', { hidden: true });
      d.style.setProperty('--r', r);
      discs[r * COLS + c] = d;
      layer.append(d);
    }
    layer.append(ghost);
    return h('button.q-col', {
      type: 'button',
      tabindex: c === 3 ? 0 : -1,
      dataset: { col: c },
      onclick: () => play(c),
      onfocus: () => setFocus(c),
    }, layer);
  });

  const players = h('div.q-players');
  const status = h('p.q-status', { 'aria-live': 'polite' });
  const timerText = h('span.q-timer-text');
  const timerFill = h('span.q-timer-fill');
  const timer = h('div.q-timer', { hidden: true, 'aria-hidden': 'true' }, h('span.q-timer-bar', timerFill), timerText);
  const board = h('div.q-board', { role: 'group', 'aria-label': 'Grille : 7 colonnes de 6 places' }, cols);
  const stamp = h('div.q-stamp', { hidden: true, 'aria-hidden': 'true' });
  // Trait qui barre les jetons gagnants, dessiné par-dessus la grille (coordonnées en cases : 7 de large, 6 de haut).
  const svgNs = 'http://www.w3.org/2000/svg';
  const winSvg = document.createElementNS(svgNs, 'svg');
  winSvg.setAttribute('viewBox', `0 0 ${COLS} ${ROWS}`);
  winSvg.setAttribute('preserveAspectRatio', 'none');
  winSvg.setAttribute('class', 'q-winsvg');
  winSvg.setAttribute('aria-hidden', 'true');
  const winLines = ['q-wl-a', 'q-wl-b'].map((cls) => {
    const l = document.createElementNS(svgNs, 'line');
    l.setAttribute('class', cls);
    winSvg.append(l);
    return l;
  });
  board.append(winSvg);
  root.append(h('div.q', players, h('div.q-statusrow', status, timer), h('div.q-boardwrap', board, stamp)));

  let state = null;
  let info = null;
  let prev = null; // grille déjà dessinée, pour n'animer que le jeton nouveau
  let animCell = -1;
  let focusCol = 3;
  let ticker = null;

  const myIndex = () => state.players.indexOf(api.me.id);
  const myTurn = () => Boolean(state && info && !info.over && info.turn.includes(api.me.id));

  function setFocus(c) {
    focusCol = c;
    cols.forEach((b, i) => { b.tabIndex = i === c ? 0 : -1; });
  }

  function play(c) {
    if (!state || info.over) return;
    if (!myTurn()) {
      if (info.isPlayer) api.toast("Ce n'est pas ton tour.");
      return;
    }
    api.sendMove({ col: c }).catch(() => {});
  }

  // Clavier : flèches pour changer de colonne, chiffres 1 à 7 pour lâcher directement le jeton.
  root.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const c = Math.min(COLS - 1, Math.max(0, focusCol + (e.key === 'ArrowRight' ? 1 : -1)));
      setFocus(c);
      cols[c].focus();
      e.preventDefault();
    } else if (/^[1-7]$/.test(e.key) && e.target.closest?.('.q-col')) {
      const c = Number(e.key) - 1;
      setFocus(c);
      cols[c].focus();
      play(c);
      e.preventDefault();
    }
  });

  const nameOf = (id) => (id === api.me.id ? 'Tu' : api.user(id).pseudo);
  const verb = (id, one, two) => (id === api.me.id ? two : one);

  function statusText(s) {
    if (s.forfeit) return `${api.user(s.forfeit).pseudo} a abandonné. ${nameOf(s.winner)} ${verb(s.winner, 'gagne', 'gagnes')} !`;
    if (s.winner) return `${nameOf(s.winner)} ${verb(s.winner, 'gagne', 'gagnes')} : quatre à la suite !`;
    if (s.draw) return 'Grille pleine : match nul.';
    const slow = s.players[1 - s.turn];
    const late = s.last?.auto ? `${slow === api.me.id ? "Tu n'as" : `${api.user(slow).pseudo} n'a`} pas joué à temps : jeton posé au hasard. ` : '';
    if (myTurn()) return `${late}À toi : choisis une colonne.`;
    if (info.isPlayer) return `${late}${api.user(s.players[s.turn]).pseudo} réfléchit…`;
    return `${late}Au tour de ${api.user(s.players[s.turn]).pseudo}.`;
  }

  function renderPlayers(s) {
    players.replaceChildren(...s.players.map((id, seat) => {
      const turn = s.turn === seat && !info.over;
      const won = s.winner === id;
      return h(`div.q-player.p${seat}${turn ? '.is-turn' : ''}${won ? '.is-won' : ''}`,
        h('span.q-chip', { 'aria-hidden': 'true' }),
        api.token(api.user(id), { size: 's' }),
        h('span.q-who',
          h('span.q-name', api.user(id).pseudo),
          h('span.q-tag', `${COLOR_NAMES[seat]}${id === api.me.id ? ' · toi' : ''}`, won ? h('span.q-won', ' · gagne') : null)));
    }));
  }

  function renderBoard(s) {
    const mine = myIndex();
    const playable = myTurn();
    // Seul le jeton qui vient d'être posé tombe en animation (pas au chargement, ni quand l'état est renvoyé à l'identique).
    if (!prev) animCell = -1;
    else if (s.board.some((v, i) => v !== prev[i])) animCell = s.last ? s.last.cell : -1;
    s.board.forEach((v, i) => {
      const d = discs[i];
      d.hidden = v === null;
      d.className = `q-disc${v === null ? '' : ` d${v}`}${s.line?.includes(i) ? ' is-win' : ''}${i === animCell ? ' is-new' : ''}`;
    });
    const line = s.line;
    winSvg.style.display = line ? '' : 'none';
    if (line) {
      const [a, z] = [line[0], line[line.length - 1]];
      for (const l of winLines) {
        l.setAttribute('x1', (a % COLS) + 0.5);
        l.setAttribute('y1', Math.floor(a / COLS) + 0.5);
        l.setAttribute('x2', (z % COLS) + 0.5);
        l.setAttribute('y2', Math.floor(z / COLS) + 0.5);
      }
    }
    cols.forEach((b, c) => {
      let free = 0;
      let next = -1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (s.board[r * COLS + c] === null) {
          free++;
          if (next < 0) next = r;
        }
      }
      const ok = playable && free > 0;
      b.classList.toggle('is-open', ok);
      b.classList.toggle('is-full', free === 0);
      b.setAttribute('aria-disabled', ok ? 'false' : 'true');
      b.setAttribute('aria-label', `Colonne ${c + 1} : ${free === 0 ? 'pleine' : `${free} ${free > 1 ? 'places libres' : 'place libre'}`}`);
      const g = ghosts[c];
      g.hidden = !(ok && mine >= 0);
      if (!g.hidden) {
        g.className = `q-disc q-ghost d${mine}`;
        g.style.setProperty('--r', next);
      }
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
    if (wasOver === false && i.over && s.winner && !s.forfeit) confetti(root, h);
    wasOver = i.over;
    renderPlayers(s);
    renderBoard(s);
    status.textContent = statusText(s);
    stamp.hidden = !info.over;
    stamp.textContent = s.winner ? 'Gagné' : 'Nul';
    stamp.className = `q-stamp${s.winner ? ` p${s.players.indexOf(s.winner)}` : ''}`;
    renderTimer();
    clearInterval(ticker);
    ticker = s.timer && !info.over ? setInterval(renderTimer, 250) : null;
  });

  return () => clearInterval(ticker);
}
