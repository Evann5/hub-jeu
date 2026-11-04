// Espions côté navigateur : le dossier, la grille de fiches, l'indice du chef, les désignations des agents.
// Le hub fournit api (voir docs/integration.md §8). La clé n'arrive que chez les chefs : ici on affiche ce qu'on reçoit.

const TEAM = {
  red: { name: 'rouge', agency: 'Agence rouge', letter: 'R' },
  blue: { name: 'bleue', agency: 'Agence bleue', letter: 'B' },
};
const KIND_LABEL = { red: 'contact rouge', blue: 'contact bleu', neutral: 'passant', assassin: 'assassin' };
const KEY_GLYPH = { red: 'R', blue: 'B', neutral: '·', assassin: '✕' };

const ENDED = {
  stop: 's’est arrêtée à temps',
  max: 'a épuisé ses essais',
  neutral: 'est tombée sur un passant',
  enemy: 'a touché un contact adverse',
  assassin: 'a touché l’assassin !',
  timeout: 'a manqué de temps',
  skipped: 'n’a pas donné d’indice à temps',
};

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function mount(root, api) {
  const { h } = api;
  const name = (id) => api.user(id)?.pseudo ?? 'Quelqu’un';

  let view = null;
  let info = null;
  let sel = null; // carte choisie sur cet écran, pas encore envoyée
  let sigPrev = '';
  let clueWord = '';
  let clueNum = 1;

  // ——— Structure fixe ———
  const timeText = h('span.es-time');
  const timeBar = h('i');
  const timer = h('div.es-timer', { role: 'timer', 'aria-label': 'Temps restant', hidden: true }, timeText, h('span.es-bar', timeBar));
  const head = h('header.es-head');
  const score = h('div.es-score');
  const clueBox = h('div.es-clue-box');
  const folder = h('section.es-folder');
  const panel = h('div.es-side-panel');
  const log = h('section.es-log');
  const live = h('p.sr-only', { 'aria-live': 'polite' });
  const app = h('div.es', { tabindex: 0, role: 'region', 'aria-label': 'Partie d’Espions' }, h('div.es-wrap', head, score, clueBox, h('div.es-cols', folder, h('div.es-side', panel, log))), live);
  root.append(app);

  const clock = setInterval(tick, 500);
  function tick() {
    if (!view || !info?.deadline || view.phase === 'over' || view.phase === 'teams') {
      timer.hidden = true;
      return;
    }
    timer.hidden = false;
    const left = info.deadline - api.now();
    timeText.textContent = fmt(left);
    timeBar.style.transform = `scaleX(${view.span ? Math.min(1, Math.max(0, left / view.span)) : 0})`;
    timer.classList.toggle('is-low', left < 10_000);
  }

  const send = (action) => api.sendMove(action);
  const swallow = () => {};
  const btn = (label, onclick, { kind = 'primary', disabled = false, key } = {}) => h(`button.es-btn.${kind}`, {
    type: 'button', onclick, disabled, dataset: key ? { key } : undefined,
  }, label);

  const me = () => view.me;
  const isChef = () => me()?.role === 'chef';
  const canPick = () => view.phase === 'guess' && me() && me().role === 'agent' && me().team === view.active;
  const membersOf = (t) => view.players.filter((id) => view.team[id] === t && !view.gone.includes(id));
  const dossierNo = () => {
    const src = (view.cards ?? []).map((c) => c.word).join('') || view.players.join('');
    let n = 0;
    for (const ch of src) n = (n * 31 + ch.charCodeAt(0)) % 900;
    return String(100 + n);
  };

  // ——— Phase « équipes » ———
  function startIssue() {
    for (const t of ['red', 'blue']) {
      if (!view.lead[t]) return `Il manque un chef à l’${TEAM[t].agency.toLowerCase()} : quelqu’un doit se proposer.`;
      if (membersOf(t).length < 2) return `L’${TEAM[t].agency.toLowerCase()} a besoin d’au moins un agent en plus de son chef.`;
    }
    return null;
  }

  function roster(t) {
    const m = me();
    const mine = m?.team === t;
    const chefId = view.lead[t];
    return h(`article.es-roster.t-${t}${mine ? '.is-mine' : ''}`,
      h('h4', TEAM[t].agency, h('small', `${membersOf(t).length} agent${membersOf(t).length > 1 ? 's' : ''}`)),
      h('ul', membersOf(t).sort((a, b) => (b === chefId) - (a === chefId)).map((id) => h('li',
        api.token(api.user(id), { size: 's' }),
        h('span.es-name', name(id), id === m?.id ? h('span.es-me', 'toi') : null),
        id === chefId ? h('span.es-tag', 'Chef') : null))),
      !membersOf(t).length ? h('p.es-empty', 'Personne pour l’instant.') : null,
      m ? h('div.es-roster-actions',
        mine
          ? (chefId === m.id
            ? btn('Laisser la place de chef', () => send({ type: 'lead', on: false }).catch(swallow), { kind: 'ghost', key: 'unlead' })
            : btn(chefId ? 'Le chef est déjà pris' : 'Je me propose chef', () => send({ type: 'lead' }).catch(swallow), { disabled: Boolean(chefId), kind: 'ghost', key: 'lead' }))
          : btn(`Passer à l’${TEAM[t].agency.toLowerCase()}`, () => send({ type: 'team', team: t }).catch(swallow), { key: `join-${t}` })) : null);
  }

  function teamsView() {
    const issue = startIssue();
    const m = me();
    return [
      h('div.es-teams',
        h('h3', 'Répartition des agents'),
        h('p', 'Le chef connaît la clé, les agents la cherchent. Choisis ton agence.'),
        h('div.es-rosters', roster('red'), roster('blue')),
        m ? h('div.es-actions',
          btn('Répartir au hasard', () => send({ type: 'shuffle' }).catch(swallow), { kind: 'ghost', key: 'shuffle' }),
          btn('Commencer l’opération', () => send({ type: 'start' }).catch(swallow), { disabled: Boolean(issue), key: 'start' })) : h('p.es-empty', 'Tu regardes la partie.'),
        issue ? h('p.es-hint', issue) : h('p.es-hint.is-ok', 'Tout est prêt : n’importe qui peut lancer l’opération.')),
    ];
  }

  // ——— Grille ———
  function cardLabel(i, c) {
    const parts = [c.word];
    if (c.kind) parts.push(`retournée : ${KIND_LABEL[c.kind]}`);
    else if (view.key) parts.push(`dans la clé : ${KIND_LABEL[view.key[i]]}`);
    const pickers = Object.entries(view.picks).filter(([, p]) => p === i).map(([id]) => name(Number(id)));
    if (pickers.length) parts.push(`désignée par ${pickers.join(', ')}`);
    return parts.join(', ');
  }

  function card(i, c) {
    const selectable = canPick() && c.kind === null;
    const pickers = Object.entries(view.picks).filter(([, p]) => p === i).map(([id]) => Number(id));
    const mine = pickers.includes(me()?.id);
    const keyKind = view.key && !c.kind ? view.key[i] : null;
    const len = c.word.length;
    const cls = ['es-card', c.kind ? `is-${c.kind}` : '', keyKind ? `key-${keyKind}` : '', sel === i ? 'is-sel' : '', mine ? 'is-mine' : '', len >= 9 ? 'len-l' : len >= 7 ? 'len-m' : ''].filter(Boolean);
    return h('li', h(`button.${cls.join('.')}`, {
      type: 'button',
      disabled: !selectable,
      'aria-label': cardLabel(i, c),
      'aria-pressed': selectable ? String(sel === i || mine) : undefined,
      dataset: { key: `card-${i}` },
      onclick: () => {
        sel = sel === i ? null : i;
        render();
      },
    },
    h('span.es-word', c.word),
    keyKind ? h('span.es-glyph', { 'aria-hidden': 'true' }, KEY_GLYPH[keyKind]) : null,
    c.kind ? h('span.es-glyph.is-stamp', { 'aria-hidden': 'true' }, KEY_GLYPH[c.kind]) : null,
    pickers.length ? h('span.es-pickers', pickers.map((id) => api.token(api.user(id), { size: 's' }))) : null));
  }

  function board() {
    return [
      h('div.es-tab', { 'aria-hidden': 'true' }, h('span', `DOSSIER N° ${dossierNo()}`)),
      h('ul.es-board', { 'aria-label': 'Grille de 25 mots' }, view.cards.map((c, i) => card(i, c))),
      view.key && view.phase !== 'over'
        ? h('p.es-legend', h('b', 'Clé secrète'), ' : ne la montre à personne.')
        : null,
    ];
  }

  // ——— Panneau d'action ———
  let clueForm = null;
  function buildClueForm() {
    const input = h('input.es-input', {
      type: 'text', id: 'es-clue', maxLength: 24, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', value: clueWord,
      'aria-describedby': 'es-clue-help', oninput: (e) => { clueWord = e.target.value; },
    });
    const numbers = h('div.es-numbers', { role: 'radiogroup', 'aria-label': 'Nombre de mots' },
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => h('button.es-num', {
        type: 'button', role: 'radio', 'aria-checked': String(n === clueNum), 'aria-label': n === 0 ? 'Illimité' : String(n), dataset: { n },
        onclick: () => {
          clueNum = n;
          for (const b of numbers.children) b.setAttribute('aria-checked', String(Number(b.dataset.n) === clueNum));
        },
      }, n === 0 ? '∞' : String(n))));
    const form = h('form.es-form', {
      onsubmit: (e) => {
        e.preventDefault();
        send({ type: 'clue', word: clueWord, number: clueNum }).then(() => { clueWord = ''; input.value = ''; }, swallow);
      },
    },
    h('label', { for: 'es-clue' }, 'Ton indice'),
    input,
    h('p.es-hint', { id: 'es-clue-help' }, 'Un seul mot hors grille, puis combien de mots il évoque (∞ : sans limite).'),
    numbers,
    h('button.es-btn.primary', { type: 'submit', dataset: { key: 'send-clue' } }, 'Donner l’indice'));
    return form;
  }

  function triesText() {
    if (view.max === null) return 'Autant d’essais que tu veux.';
    const left = view.max - view.guesses;
    return `${left} essai${left > 1 ? 's' : ''} possible${left > 1 ? 's' : ''}.`;
  }

  function actionPanel() {
    const m = me();
    const A = view.active;
    if (view.phase === 'teams') return null;
    if (view.phase === 'over') return h('div.es-note', h('h3', 'Dossier classé'), h('p', 'La clé est dévoilée.'));
    if (view.phase === 'clue') {
      if (m && m.role === 'chef' && m.team === A) {
        clueForm ??= buildClueForm();
        return clueForm;
      }
      return null;
    }
    // phase guess
    if (canPick()) {
      const picked = sel !== null ? view.cards[sel]?.word : null;
      const myPick = view.picks[m.id];
      const mates = Object.entries(view.picks).map(([id, c]) => `${name(Number(id))} : ${c === -1 ? 's’arrêter' : view.cards[c].word}`);
      return h('div.es-note.is-pick',
        h('div.es-actions',
          btn(picked ? `Désigner ${picked}` : 'Touche un mot', () => {
            const card = sel;
            sel = null;
            send({ type: 'pick', card }).catch(swallow);
          }, { disabled: sel === null, key: 'confirm' }),
          view.guesses > 0 ? btn(myPick === -1 ? 'Tu veux t’arrêter' : 'S’arrêter ici', () => send({ type: 'pick', card: -1 }).catch(swallow), { kind: 'ghost', key: 'stop' }) : null,
          myPick !== undefined ? btn('Retirer mon choix', () => send({ type: 'pick', card: null }).catch(swallow), { kind: 'ghost', key: 'clear' }) : null),
        mates.length ? h('p.es-hint', `Choix de l’agence : ${mates.join(' · ')}.`) : null);
    }
    if (m && m.role === 'chef' && m.team === A) return h('div.es-note.is-quiet', h('h3', 'Tes agents cherchent'), h('p', 'Ne dis rien, pas de signe.'));
    return null;
  }

  // ——— Indice en cours, compteurs, journal ———
  function renderScore() {
    const teamBox = (t) => {
      const mem = membersOf(t).sort((a, b) => (b === view.lead[t]) - (a === view.lead[t]));
      return h(`div.es-count.t-${t}${view.active === t && view.phase !== 'over' && view.phase !== 'teams' ? '.is-active' : ''}`,
        h('b', { 'aria-label': `${view.left ? view.left[t] : 0} contacts à retrouver` }, view.left ? String(view.left[t]) : '–'),
        h('span.es-count-name', h('span.es-long', TEAM[t].agency), h('span.es-short', TEAM[t].name === 'rouge' ? 'Rouge' : 'Bleue'),
          h('small', view.left ? `à retrouver${view.first === t ? ' · commence' : ''}` : '')),
        h('span.es-crew', { 'aria-label': `Agents : ${mem.map(name).join(', ')}` }, mem.slice(0, 5).map((id) => h(`span.es-crew-one${id === view.lead[t] ? '.is-chef' : ''}`, { title: `${name(id)}${id === view.lead[t] ? ' (chef)' : ''}` }, api.token(api.user(id), { size: 's' }))),
          mem.length > 5 ? h('small', `+${mem.length - 5}`) : null));
    };
    score.replaceChildren(teamBox('red'), teamBox('blue'));
  }

  function renderClue() {
    if (view.phase === 'teams' || view.phase === 'over') {
      clueBox.replaceChildren();
      clueBox.hidden = true;
      return;
    }
    clueBox.hidden = false;
    const A = view.active;
    if (view.phase === 'clue') {
      clueBox.replaceChildren(h(`p.es-turn.t-${A}`, h('i.es-dot', { 'aria-hidden': 'true' }), `Le chef de l’${TEAM[A].agency.toLowerCase()} prépare un indice`));
      return;
    }
    const c = view.clue;
    const left = view.max === null ? null : view.max - view.guesses;
    clueBox.replaceChildren(h(`div.es-clue.t-${A}`,
      h('span.es-clue-label', `Indice de l’${TEAM[A].agency.toLowerCase()}`),
      h('span.es-clue-word', c.word),
      h('span.es-clue-num', { 'aria-label': c.number === 0 ? 'nombre illimité' : `nombre ${c.number}` }, c.number === 0 ? '∞' : String(c.number)),
      left === null ? null : h('span.es-tries', { 'aria-label': `${left} essai${left > 1 ? 's' : ''} possible${left > 1 ? 's' : ''}` }, Array.from({ length: view.max }, (_, i) => h(`i${i < left ? '.is-on' : ''}`)))));
  }

  function renderLog() {
    if (view.phase === 'teams') {
      log.replaceChildren();
      log.hidden = true;
      return;
    }
    log.hidden = false;
    const rows = [...view.log].reverse().map((e) => h(`li.t-${e.team}`,
      h('p.es-log-head', h('i.es-dot', { 'aria-hidden': 'true' }), h('b', TEAM[e.team].agency), e.word ? [' · ', h('span.es-hand', e.word), ` · ${e.number === 0 ? '∞' : e.number}`] : ' · pas d’indice'),
      e.guesses.length ? h('p.es-chips', e.guesses.map((g) => h(`span.es-chip.is-${g.kind}`, view.cards[g.card].word))) : null,
      e.ended ? h('p.es-log-end', `${e.ended === 'skipped' ? 'L’agence' : 'Elle'} ${ENDED[e.ended]}`) : null));
    log.replaceChildren(h('h3', 'Journal de l’opération'), rows.length ? h('ol', rows) : h('p.es-empty', 'Aucun indice pour l’instant.'));
  }

  function renderHead() {
    let kicker = 'Opération en cours';
    let title = `${TEAM[view.active]?.agency ?? ''}`;
    if (view.phase === 'teams') {
      kicker = 'Briefing';
      title = 'Formez vos agences';
    } else if (view.phase === 'over') {
      kicker = 'Dossier classé';
      title = view.winner.team ? `${TEAM[view.winner.team].agency} l’emporte` : 'Fin de partie';
    } else {
      title = view.phase === 'clue' ? 'Place à l’indice' : 'Place aux agents';
    }
    const m = me();
    head.replaceChildren(
      h('div.es-title', h('p.es-kicker', kicker), h('h2', title)),
      timer,
      m ? h(`p.es-badge.t-${m.team}`, h('small', m.role === 'chef' ? 'Tu es chef' : view.phase === 'teams' ? 'Ton agence' : 'Tu es agent'), TEAM[m.team].agency) : h('p.es-badge', 'Spectateur'));
  }

  function overBanner() {
    const w = view.winner;
    const reasons = {
      cards: `${TEAM[w.team].agency} a retrouvé tous ses contacts.`,
      assassin: `L’${TEAM[w.team === 'red' ? 'blue' : 'red'].agency.toLowerCase()} a touché l’assassin : elle perd.`,
      forfeit: `L’${TEAM[w.team === 'red' ? 'blue' : 'red'].agency.toLowerCase()} n’a plus assez d’agents : forfait.`,
    };
    const won = me() && me().team === w.team;
    return h(`div.es-banner.t-${w.team}`,
      h('p.es-stamp-big', !me() ? `${TEAM[w.team].agency} gagne` : won ? 'Mission accomplie' : 'Mission échouée'),
      h('p', reasons[w.reason]),
      null);
  }

  // ——— Rendu général ———
  function render() {
    if (!view) return;
    const focused = document.activeElement?.closest?.('[data-key]')?.dataset.key;
    const sig = `${view.phase}:${view.active}:${view.guesses}:${view.clue?.word ?? ''}`;
    if (sig !== sigPrev) {
      sigPrev = sig;
      sel = null;
      live.textContent = view.phase === 'teams' ? 'Formez vos agences.'
        : view.phase === 'over' ? `Fin de partie : ${TEAM[view.winner.team].agency} l’emporte.`
          : view.phase === 'clue' ? `${TEAM[view.active].agency} : le chef prépare un indice.`
            : `${TEAM[view.active].agency} : indice ${view.clue.word}, ${view.clue.number === 0 ? 'illimité' : view.clue.number}.`;
    }
    if (sel !== null && (view.phase !== 'guess' || view.cards[sel]?.kind)) sel = null;
    app.dataset.phase = view.phase;
    renderHead();
    score.hidden = view.phase === 'teams';
    renderScore();
    renderClue();
    if (view.phase === 'teams') {
      folder.className = 'es-folder is-plain';
      folder.replaceChildren(...teamsView());
      panel.replaceChildren();
    } else {
      folder.className = `es-folder${view.phase === 'over' ? ' is-over' : ''}`;
      folder.replaceChildren(...board().filter(Boolean));
      const next = view.phase === 'over' ? overBanner() : actionPanel();
      if (!(next === clueForm && panel.firstChild === clueForm)) panel.replaceChildren(...(next ? [next] : []));
      panel.hidden = !next;
    }
    renderLog();
    tick();
    if (focused) app.querySelector(`[data-key="${focused}"]:not(:disabled)`)?.focus({ preventScroll: true });
  }

  api.onState((v, i) => {
    view = v;
    info = i;
    render();
  });

  return () => {
    clearInterval(clock);
    root.replaceChildren();
  };
}
