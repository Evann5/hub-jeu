// Petit Bac côté navigateur : un mur de post-it fluo, des stickers et un chrono en bombe cartoon.
// Trois écrans : la saisie (writing), la correction (review) et le bulletin final (over).
// Les champs de saisie et les boutons de contestation sont construits une fois par manche et mis à jour sur place :
// ils gardent donc le focus, le clavier du téléphone et le texte en cours quand une nouvelle vue arrive.

const DRAFT_DELAY = 1500; // le brouillon part 1,5 s après la dernière frappe
const REVIEW_MS = 90_000; // doit rester égal à REVIEW_MS de rules.js (sert seulement à dessiner la barre)

const ARTICLES = ['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd'];
const plain = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim();

// Même idée que checkAnswer() des règles : 'empty', 'letter' (mauvaise lettre) ou 'ok'. Le serveur a le dernier mot.
function fits(text, letter) {
  const w = plain(text).split(' ').filter(Boolean);
  if (!w.length) return 'empty';
  const l = letter.toLowerCase();
  let rest = w;
  while (rest.length > 1 && ARTICLES.includes(rest[0])) rest = rest.slice(1);
  return w.join('').startsWith(l) || rest.join('').startsWith(l) ? 'ok' : 'letter';
}

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Indice de défilement : tant qu'il reste du contenu caché à gauche ou à droite de la rangée, elle porte `has-prev` / `has-next` (le dégradé est dans style.css).
function scrollHint(box) {
  const update = () => {
    box.classList.toggle('has-prev', box.scrollLeft > 1);
    box.classList.toggle('has-next', box.scrollWidth - box.clientWidth - box.scrollLeft > 1);
  };
  box.addEventListener('scroll', update, { passive: true });
  if (typeof ResizeObserver === 'function') new ResizeObserver(update).observe(box);
  if (typeof MutationObserver === 'function') new MutationObserver(update).observe(box, { childList: true, subtree: true, characterData: true });
  return box;
}

export function mount(root, api) {
  const { h } = api;
  const pb = h('div.pb');
  const live = h('p.pb-sr', { 'aria-live': 'polite' }); // annonces pour les lecteurs d'écran
  root.append(pb, live);

  let key = null; // « phase:manche » de l'écran construit
  let ui = null; // les éléments de l'écran courant
  let current = { view: null, info: null };
  let local = []; // mes réponses telles que tapées
  let dirty = false;
  let draftTimer = null;
  let finalFlushed = false;

  const name = (id) => (id === api.me.id ? 'Toi' : api.user(id).pseudo);
  const spectator = () => api.seat < 0;

  // ——— Brouillon ———

  function flush() {
    clearTimeout(draftTimer);
    draftTimer = null;
    if (!dirty || current.view?.phase !== 'writing' || spectator()) return;
    dirty = false;
    api.sendMove({ type: 'draft', answers: local.slice() }).catch(() => { dirty = true; });
  }

  function touch() {
    dirty = true;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(flush, DRAFT_DELAY);
  }

  const onHide = () => { if (document.hidden) flush(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);

  // ——— Horloge ———

  function tick() {
    if (!ui?.clock || !current.info) return;
    const { deadline } = current.info;
    if (!deadline) return;
    const left = deadline - api.now();
    ui.clock.textContent = mmss(left);
    const total = current.view.phase === 'review' ? REVIEW_MS : current.view.options.seconds * 1000;
    ui.bar.style.setProperty('--left', `${Math.max(0, Math.min(1, left / total))}`);
    ui.clockBox.classList.toggle('is-low', left <= 10_000);
    // Dernier envoi juste avant la fin, pour ne rien perdre si le chrono tombe pendant qu'on écrit.
    if (current.view.phase === 'writing' && left <= 700 && !finalFlushed) {
      finalFlushed = true;
      flush();
    }
  }
  const clock = setInterval(tick, 250);

  // Le chrono : une bombe cartoon. La mèche raccourcit avec le temps (--left de 1 à 0), l'étincelle la suit.
  function bomb() {
    const clock = h('span.pb-time', '--:--');
    const bar = h('span.pb-fuse', { 'aria-hidden': 'true' }, h('span.pb-spark'));
    const clockBox = h('div.pb-clock', { role: 'timer', 'aria-label': 'Temps restant' }, h('span.pb-bomb', bar, clock));
    return { clock, bar: clockBox, clockBox };
  }

  // L'en-tête collant : manche, lettre, annonce du Stop, chrono, puis la rangée des joueurs (toujours visible).
  function top(ui, strip) {
    return h('header.pb-top',
      h('div.pb-top-row',
        h('div.pb-title', ui.head, ui.letter),
        ui.callout,
        ui.clockBox),
      scrollHint(strip));
  }

  // Confettis de victoire (rien du tout si l'utilisateur préfère moins de mouvement).
  function confetti(into) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#FFE53B', '#FF3D9A', '#2EE6C5', '#7B5CFF', '#FF8A1F', '#3DA5FF'];
    const box = h('div.pb-confetti', { 'aria-hidden': 'true' });
    for (let i = 0; i < 44; i++) {
      const bit = h('span');
      bit.style.setProperty('--x', `${Math.round(Math.random() * 100)}%`);
      bit.style.setProperty('--c', colors[i % colors.length]);
      bit.style.setProperty('--d', `${(Math.random() * 1.6).toFixed(2)}s`);
      bit.style.setProperty('--r', `${Math.round(Math.random() * 360)}deg`);
      box.append(bit);
    }
    into.append(box);
  }

  // ——— Écran de saisie ———

  function buildWriting(view) {
    finalFlushed = false;
    const player = !spectator();
    local = view.mine ? view.mine.slice() : view.categories.map(() => '');
    dirty = false;
    const inputs = view.categories.map((cat, i) => {
      const input = h('input.pb-input', {
        id: `pb-${i}`,
        type: 'text',
        value: local[i] || '',
        maxLength: 40,
        autocomplete: 'off',
        autocapitalize: 'sentences',
        spellcheck: false,
        enterKeyHint: i === view.categories.length - 1 ? 'done' : 'next',
        placeholder: `${view.letter}…`,
        disabled: !player,
        oninput: () => { local[i] = input.value; touch(); if (ui?.alert) ui.alert.textContent = ''; updateFilled(); },
        onblur: flush,
        onkeydown: (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          (inputs[i + 1] || input).focus();
          if (!inputs[i + 1]) input.blur();
        },
      });
      return input;
    });
    const rows = view.categories.map((cat, i) => h(`li.pb-row.n${i % 6}`,
      h('span.pb-num', `${i + 1}`),
      h('label.pb-cat', { for: `pb-${i}` }, cat),
      inputs[i]));
    const { clock, bar, clockBox } = bomb();
    const alert = h('p.pb-alert', { 'aria-live': 'assertive' });
    const note = h('p.pb-note', { id: 'pb-stop-note' }, 'Tout est rempli ? Les autres n’auront que 10 secondes.');
    const stop = h('button.pb-stop', {
      type: 'button',
      onclick: onStop,
    }, 'Stop !');
    const mates = h('ul.pb-strip', { 'aria-label': 'Où en sont les autres' });
    ui = {
      kind: 'writing', inputs, clock, bar, clockBox, alert, note, stop, mates,
      callout: h('p.pb-callout', { role: 'status' }),
      head: h('p.pb-round'), letter: h('div.pb-letter', { role: 'img' }, h('span')),
    };
    pb.replaceChildren(
      top(ui, mates),
      alert,
      h('ol.pb-sheet', rows),
      player ? h('div.pb-actions', stop, note) : h('p.pb-note', 'Tu regardes la partie : les réponses restent cachées jusqu’à la fin de la manche.'));
    pb.scrollTop = 0;
    if (player && !('ontouchstart' in window)) inputs[0].focus({ preventScroll: true });
    live.textContent = `Manche ${view.round} sur ${view.rounds}. La lettre est ${view.letter}.`;
  }

  function firstProblem(view) {
    for (let i = 0; i < view.categories.length; i++) {
      const check = fits(local[i], view.letter);
      if (check === 'empty') return { i, text: `Il te manque encore : « ${view.categories[i]} ».` };
      if (check === 'letter') return { i, text: `« ${local[i].trim()} » ne commence pas par ${view.letter}.` };
    }
    return null;
  }

  function onStop() {
    const view = current.view;
    const problem = firstProblem(view);
    if (problem) {
      ui.alert.textContent = problem.text;
      ui.inputs[problem.i].focus();
      return;
    }
    ui.alert.textContent = '';
    clearTimeout(draftTimer);
    dirty = false;
    api.sendMove({ type: 'stop', answers: local.slice() }).catch(() => { dirty = true; });
  }

  function updateFilled() {
    if (ui?.kind !== 'writing') return;
    const ready = !firstProblem(current.view);
    ui.stop.classList.toggle('is-ready', ready);
    ui.stop.setAttribute('aria-describedby', 'pb-stop-note');
  }

  function updateWriting(view, info) {
    ui.head.textContent = `Manche ${view.round} / ${view.rounds}`;
    ui.letter.firstChild.textContent = view.letter;
    ui.letter.setAttribute('aria-label', `Lettre ${view.letter}`);
    ui.mates.replaceChildren(...view.players.filter((id) => !view.left.includes(id)).map((id) => {
      const n = view.progress[id] || 0;
      const done = n >= view.categories.length;
      return h(`li.pb-mate${done ? '.is-done' : ''}`,
        api.token(api.user(id), { size: 's' }),
        h('span.pb-mate-name', name(id)),
        h('span.pb-mate-n', { 'aria-label': done ? 'a tout rempli' : `${n} cases sur ${view.categories.length}` }, done ? h('span.pb-check', { 'aria-hidden': 'true' }) : `${n}/${view.categories.length}`));
    }));
    if (view.stopBy) {
      const who = view.stopBy === api.me.id ? 'Tu as' : `${name(view.stopBy)} a`;
      ui.callout.textContent = view.stopBy === api.me.id ? 'Tu as crié Stop !' : `${name(view.stopBy)} : Stop !`;
      ui.callout.classList.add('is-on');
      ui.note.hidden = true;
      ui.stop.disabled = true;
      if (ui.lastStop !== view.stopBy) live.textContent = `${who} crié stop. Dix secondes.`;
      ui.lastStop = view.stopBy;
    } else {
      ui.callout.textContent = '';
      ui.callout.classList.remove('is-on');
      ui.note.hidden = false;
      ui.stop.disabled = false;
    }
    updateFilled();
    // Reconnexion : si le serveur a des réponses que je n'ai pas encore tapées (autre appareil), je les reprends.
    if (view.mine && !dirty) {
      view.mine.forEach((text, i) => {
        if (text && !local[i] && document.activeElement !== ui.inputs[i]) {
          local[i] = text;
          ui.inputs[i].value = text;
        }
      });
    }
  }

  // ——— Écran de correction ———

  const REASONS = { empty: 'rien', letter: 'mauvaise lettre', refused: 'refusée', duplicate: 'doublon', unique: 'unique' };

  function buildReview(view) {
    const player = !spectator();
    const cells = new Map();
    const sections = view.categories.map((cat, ci) => {
      const rows = view.grid[ci].map((c) => {
        const ans = h('span.pb-ans');
        const why = h('span.pb-why');
        const pts = h('span.pb-pts');
        const count = h('span.pb-count');
        let btn = null;
        if (player && c.id !== api.me.id) {
          btn = h('button.pb-contest', {
            type: 'button',
            'aria-pressed': 'false',
            onclick: () => api.sendMove({ type: 'contest', cat: ci, target: c.id }).catch(() => {}),
          }, h('span.pb-contest-label', 'Contester'), count);
        }
        const row = h('li.pb-line',
          h('span.pb-who', api.token(api.user(c.id), { size: 's' }), h('span.pb-who-name', name(c.id))),
          h('span.pb-text', ans, why),
          h('span.pb-side', btn, pts));
        cells.set(`${ci}:${c.id}`, { row, ans, why, pts, btn, count, ci, id: c.id });
        return row;
      });
      return h(`section.pb-cat-block.n${ci % 6}`, { 'aria-labelledby': `pb-h-${ci}` },
        h('h3.pb-cat-title', { id: `pb-h-${ci}` }, h('span.pb-num', `${ci + 1}`), cat),
        h('ul.pb-lines', rows));
    });
    const { clock, bar, clockBox } = bomb();
    const ready = h('button.pb-ready', { type: 'button', onclick: () => api.sendMove({ type: 'ready' }).catch(() => {}) }, 'J’ai fini');
    ui = {
      kind: 'review', cells, clock, bar, clockBox, ready,
      callout: null,
      head: h('p.pb-round'), letter: h('div.pb-letter', { role: 'img' }, h('span')),
      board: h('ol.pb-strip', { 'aria-label': 'Classement' }),
    };
    pb.replaceChildren(
      top(ui, ui.board),
      h('div.pb-correction', sections),
      h('footer.pb-foot', player ? ready : h('p.pb-note', 'Tu regardes la partie.')));
    pb.scrollTop = 0;
    live.textContent = `Manche ${view.round} terminée. À toi de vérifier les réponses.`;
  }

  function updateReview(view, info) {
    ui.head.textContent = `Manche ${view.round} / ${view.rounds}`;
    ui.letter.firstChild.textContent = view.letter;
    ui.letter.setAttribute('aria-label', `Lettre ${view.letter}`);
    for (let ci = 0; ci < view.grid.length; ci++) {
      for (const c of view.grid[ci]) {
        const cell = ui.cells.get(`${ci}:${c.id}`);
        if (!cell) continue;
        cell.row.className = `pb-line is-${c.state}${c.id === api.me.id ? ' is-mine' : ''}`;
        cell.ans.textContent = c.text || '—';
        cell.why.textContent = c.state === 'unique' ? '' : REASONS[c.state];
        cell.pts.textContent = c.state === 'empty' ? '' : c.points ? `+${c.points}` : '0';
        cell.pts.setAttribute('aria-label', `${c.points} points`);
        if (cell.btn) {
          const contestable = c.state !== 'empty' && c.state !== 'letter';
          cell.btn.hidden = !contestable;
          cell.btn.setAttribute('aria-pressed', String(c.mine));
          cell.btn.setAttribute('aria-label', `${c.mine ? 'Retirer ma contestation de' : 'Contester'} la réponse de ${api.user(c.id).pseudo} : ${c.text}. ${c.votes} sur ${c.need} nécessaires.`);
          cell.btn.classList.toggle('is-on', c.mine);
          cell.btn.firstChild.textContent = c.mine ? 'Contestée' : 'Contester';
          cell.count.textContent = c.votes ? `${c.votes} sur ${c.need} nécessaires` : '';
        }
      }
    }
    const order = view.players.filter((id) => !view.left.includes(id))
      .map((id) => ({ id, total: view.scores[id] || 0, gain: view.roundPoints[id] || 0 }))
      .sort((a, b) => b.total + b.gain - (a.total + a.gain));
    ui.board.replaceChildren(...order.map((p) => h('li.pb-mate',
      { 'aria-label': `${name(p.id)} : ${p.total + p.gain} points, dont ${p.gain} gagnés à cette manche` },
      api.token(api.user(p.id), { size: 's' }),
      h('span.pb-mate-name', name(p.id)),
      h('span.pb-mate-n', `${p.total + p.gain}`),
      h('span.pb-mate-gain', `+${p.gain}`))));
    const iAmReady = !info.turn.includes(api.me.id);
    ui.ready.disabled = iAmReady;
    ui.ready.textContent = iAmReady
      ? `En attente des autres (${view.ready.length}/${order.length})`
      : view.round >= view.rounds ? 'J’ai fini : voir le classement' : 'J’ai fini : manche suivante';
  }

  // ——— Classement final ———

  function buildOver(view, info) {
    ui = { kind: 'over' };
    const order = view.players.map((id) => ({ id, total: view.scores[id] || 0, gone: view.left.includes(id) }))
      .sort((a, b) => b.total - a.total);
    const win = new Set(info.winners);
    pb.replaceChildren(
      h('ol.pb-report', order.map((p, i) => h(`li.pb-report-row${win.has(p.id) ? '.is-winner' : ''}`,
        h('span.pb-report-rank', `${i + 1}`),
        api.token(api.user(p.id), { size: 's' }),
        h('span.pb-report-name', name(p.id), p.gone ? ' (parti)' : ''),
        win.has(p.id) ? h('span.pb-badge', 'Champion !') : null,
        h('span.pb-report-total', `${p.total} pts`)))),
      h('h3.pb-history-title', 'Manche par manche'),
      h('ul.pb-history', view.history.map((r) => h('li',
        h('span.pb-history-letter', r.letter),
        h('span.pb-history-pts', order.filter((p) => r.points[p.id] !== undefined)
          .map((p) => h('span', name(p.id), ' ', h('b', `+${r.points[p.id]}`))))))));
    pb.scrollTop = 0;
    if (win.has(api.me.id)) confetti(pb);
    live.textContent = 'Partie terminée.';
  }

  // ——— Branchement ———

  api.onState((view, info) => {
    current = { view, info };
    const k = `${view.phase}:${view.round}:${spectator() ? 's' : 'p'}`;
    if (k !== key) {
      if (ui?.kind === 'writing') flush();
      key = k;
      if (view.phase === 'writing') buildWriting(view);
      else if (view.phase === 'review') buildReview(view);
      else buildOver(view, info);
    }
    if (view.phase === 'writing') updateWriting(view, info);
    else if (view.phase === 'review') updateReview(view, info);
    tick();
  });

  return () => {
    clearInterval(clock);
    clearTimeout(draftTimer);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flush);
  };
}
