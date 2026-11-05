// Undercover côté navigateur, DA « Code » : une couleur plein écran par phase, la carte à jouer comme signature.
// Le mot n'est écrit dans la page que pendant qu'on maintient la carte (personne ne le lit par-dessus l'épaule).

const PHASES = { word: 'Ton mot', clues: 'Indices', debate: 'Débat', vote: 'Vote', verdict: 'Verdict', white: 'Dernière chance', over: 'Fin de partie' };
const ROLE = { civil: 'Civil', under: 'Undercover', white: 'Mr. White' };
const SVG = 'http://www.w3.org/2000/svg';

function eye(off = false) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M2 12c3-6 17-6 20 0-3 6-17 6-20 0z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.3" fill="currentColor"/>'
    + (off ? '<path d="M4 4l16 16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' : '');
  return svg;
}

// Largeur d'un caractère en « em » dans Syne 800 (mesurée) : sert à ajuster la taille du mot pour que
// le plus long mot de l'expression tienne sur une ligne, jamais coupé en plein milieu.
const EM = { a: 1.04, b: 1.08, c: 0.97, d: 1.08, e: 0.97, f: 0.65, g: 0.93, h: 0.99, i: 0.34, j: 0.34, k: 0.92, l: 0.34, m: 1.63, n: 0.98, o: 1, p: 1.04, q: 1.08, r: 0.54, s: 0.82, t: 0.61, u: 0.98, v: 0.9, w: 1.44, x: 0.96, y: 0.91, z: 0.88, '’': 0.28, '-': 0.57 };
const ACCENT = { à: 'a', â: 'a', ä: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', î: 'i', ï: 'i', ô: 'o', ö: 'o', ù: 'u', û: 'u', ü: 'u', ç: 'c', œ: 'o', æ: 'a' };
export function wordEm(word) {
  const w = (c) => {
    const low = c.toLowerCase();
    const base = EM[low] ?? EM[ACCENT[low]];
    if (base === undefined) return 1.3;
    return c === low ? base : base * 1.25; // capitals are wider
  };
  let best = 0;
  for (const token of String(word).split(/ +|(?<=-)/)) best = Math.max(best, [...token].reduce((n, c) => n + w(c), 0));
  return Math.max(4, Math.round(best * 1.05 * 100) / 100); // 5 % of margin for rounding and rendering differences
}

function arrow() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M5 12h13M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>';
  return svg;
}

export function mount(root, api) {
  const { h } = api;
  const el = h('div.uc');
  root.append(el);
  let v = null;
  let info = null;
  let draft = ''; // indice ou mot en cours de saisie, gardé entre deux rafraîchissements
  let picked = null; // vote choisi, pas encore confirmé

  const name = (id) => api.user(id).pseudo;
  const me = () => v.me;
  const canAct = () => info.turn.includes(api.me.id);
  const send = (action) => api.sendMove(action).catch(() => {});

  // ——— Petits éléments ———

  const av = (id) => h('span.uc-av', { 'aria-hidden': 'true' }, api.user(id).avatar);

  function timer() {
    return h('span.uc-time', { dataset: { deadline: String(v.deadline || '') } });
  }

  function tick() {
    for (const t of el.querySelectorAll('.uc-time')) {
      const left = Math.max(0, Math.ceil((Number(t.dataset.deadline) - api.now()) / 1000));
      t.textContent = t.dataset.deadline ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '';
      t.classList.toggle('is-low', left <= 10);
    }
  }
  const clock = setInterval(tick, 250);

  function bar(right) {
    const label = v.phase === 'over' ? 'Fin de partie' : v.phase === 'white' ? 'Mr. White démasqué' : `Manche ${v.round} · ${PHASES[v.phase]}`;
    return h('div.uc-bar', h('span', label), right ?? timer());
  }

  // La carte : dos bleu à motif d'yeux ; on la maintient pour voir son mot.
  function holdCard({ small = false } = {}) {
    const m = me();
    const face = h('div.uc-face');
    const card = h(`button.uc-card.uc-back${small ? '.is-small' : ''}`, { type: 'button', 'aria-label': 'Maintiens pour voir ton mot' },
      h('span.uc-logo', eye()));
    const show = (e) => {
      e.preventDefault();
      card.className = `uc-card${small ? ' is-small' : ''}${m.white ? ' role-white' : ''}`;
      if (!m.white) card.style.setProperty('--n', String(wordEm(m.word)));
      face.replaceChildren(
        h('span.uc-corner.tl', m.white ? 'W' : eye(true)),
        m.white
          ? h('div', h('div.uc-word.uc-q', '?'), h('div.uc-white-note', 'Tu es Mr. White'))
          : h('span.uc-word', m.word),
        h('span.uc-corner.br', m.white ? 'W' : eye(true)));
      card.replaceChildren(face);
    };
    const hide = () => {
      card.className = `uc-card uc-back${small ? ' is-small' : ''}`;
      card.style.removeProperty('--n');
      card.replaceChildren(h('span.uc-logo', eye()));
    };
    card.addEventListener('pointerdown', show);
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) card.addEventListener(ev, hide);
    card.addEventListener('keydown', (e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && show(e));
    card.addEventListener('keyup', hide);
    card.addEventListener('contextmenu', (e) => e.preventDefault());
    return card;
  }

  function roleCard(id, role, word) {
    return h(`div.uc-card.is-reveal.role-${role}`,
      h('span.uc-corner.tl', ROLE[role][0]),
      h('div.uc-face',
        h('div',
          h('div.uc-avatar-big', api.user(id).avatar),
          h('div.uc-role', ROLE[role]),
          h('div.uc-role-sub', role === 'white' ? 'Aucun mot' : `Son mot : ${word}`))),
      h('span.uc-corner.br', ROLE[role][0]));
  }

  function dots(done, total) {
    return h('span.uc-count', { 'aria-label': `${done} sur ${total}` }, Array.from({ length: total }, (_, i) => h(`i${i < done ? '.on' : ''}`)));
  }

  function input(placeholder, onSubmit, { label = placeholder, dark = false } = {}) {
    const field = h('input', { type: 'text', value: draft, placeholder, 'aria-label': label, maxlength: 40, autocomplete: 'off', enterkeyhint: 'send', oninput: (e) => { draft = e.target.value; } });
    const form = h(`form.uc-input${dark ? '.is-dark' : ''}`, field, h('button.uc-send', { type: 'submit', 'aria-label': 'Envoyer' }, arrow()));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = field.value.trim();
      if (!text) return;
      try {
        await api.sendMove(onSubmit(text));
        draft = '';
      } catch {
        field.focus();
      }
    });
    setTimeout(() => matchMedia('(hover: hover)').matches && field.focus({ preventScroll: true }));
    return form;
  }

  const btn = (label, onclick, kind = '') => h(`button.uc-btn${kind}`, { type: 'button', onclick }, label);

  // Indices d'un joueur, toutes manches.
  const cluesOf = (id) => v.clues.filter((c) => c.id === id);
  const clueText = (c) => (c ? c.text ?? '—' : '');

  function chips(onDark = false) {
    return h(`div.uc-chips${onDark ? '.on-dark' : ''}`, v.order.filter((id) => !v.left.includes(id) || cluesOf(id).length).map((id) => {
      const list = cluesOf(id).map(clueText);
      if (!list.length) return null;
      return h(`span${v.out.includes(id) ? '.is-out' : ''}`, h('em', name(id)), list.join(' · '));
    }));
  }

  function note(text) {
    return h('p.uc-note', text);
  }

  // ——— Écrans ———

  function screenWord() {
    const m = me();
    const nodes = [bar(), h('h2.uc-title', m ? (m.white ? 'Carte blanche' : 'Ta carte est arrivée') : 'Distribution des cartes')];
    if (m) {
      nodes.push(holdCard());
      nodes.push(h('div.uc-grow'));
      if (v.ready.includes(api.me.id)) nodes.push(h('div.uc-wait', 'C’est noté. En attente des autres', dots(v.ready.length, v.alive.length)));
      else nodes.push(btn(m.white ? 'J’ai compris' : 'C’est mémorisé', () => send({ type: 'ready' })));
      nodes.push(note(m.white ? 'Tu n’as aucun mot : écoute les indices et bluffe.' : 'Maintiens la carte pour la retourner. Civil ou Undercover ? Ta carte ne le dit pas.'));
    } else {
      nodes.push(h('div.uc-card.uc-back.is-deco', h('span.uc-logo', eye())), h('div.uc-grow'), note('Chaque joueur découvre sa carte en secret.'));
    }
    return nodes;
  }

  function playerRows(render) {
    return h('div.uc-rows', v.order.map((id) => render(id)).filter(Boolean));
  }

  function screenClues() {
    const mine = v.current === api.me.id;
    const rows = playerRows((id) => {
      if (v.out.includes(id)) return null;
      const c = v.clues.find((x) => x.round === v.round && x.id === id);
      const isCur = v.current === id;
      return h(`div.uc-r${id === api.me.id ? '.is-me' : ''}${isCur ? '.is-cur' : ''}${!c && !isCur ? '.is-wait' : ''}`,
        av(id), h('span.uc-name', name(id)),
        c ? h('span.uc-chip', clueText(c)) : isCur ? h('span.uc-tag', id === api.me.id ? 'À toi' : 'Réfléchit…') : h('span'));
    });
    // À mon tour, la saisie vient juste sous le titre : sur un petit téléphone elle resterait sinon hors de l'écran.
    const nodes = [bar(), h('h2.uc-title', mine ? 'Ton indice' : 'Tour des indices')];
    if (mine && me() && !me().out) nodes.push(h('div.uc-mine', input('Ton indice', (text) => ({ type: 'clue', text }), { label: 'Ton indice' }), note('Un mot ou une courte expression, jamais ton mot.')));
    nodes.push(rows);
    if (v.round > 1) nodes.push(h('p.uc-sub', 'Les indices des manches précédentes :'), chips());
    nodes.push(h('div.uc-grow'));
    if (me() && !me().out) nodes.push(h('div.uc-peek', h('span', 'Ton mot'), holdCard({ small: true })));
    return nodes;
  }

  function screenDebate() {
    const m = me();
    const nodes = [bar(), h('h2.uc-title', 'Débat'), h('p.uc-sub', 'Qui a un indice suspect ? Discutez dans le chat de la table.'), chips()];
    nodes.push(h('div.uc-grow'));
    nodes.push(btn('Ouvrir le chat', () => api.openChat(), '.is-dark.uc-chat-btn'));
    if (m && !m.out) {
      const ready = v.ready.includes(api.me.id);
      nodes.push(h('div.uc-ready',
        ready ? h('span.uc-wait', 'Prêt à voter') : btn('Prêt à voter', () => send({ type: 'ready' }), '.is-line'),
        dots(v.ready.length, v.alive.length)));
    } else {
      nodes.push(h('div.uc-ready', h('span.uc-wait', 'Prêts à voter'), dots(v.ready.length, v.alive.length)));
    }
    nodes.push(note('Le vote commence à la fin du chrono, ou dès que tout le monde est prêt.'));
    return nodes;
  }

  function screenVote() {
    const m = me();
    const pool = v.candidates || v.alive;
    const voting = m && !m.out && m.voted === null;
    if (!voting) picked = null;
    const rows = playerRows((id) => {
      if (!pool.includes(id)) return null;
      const clue = cluesOf(id).map(clueText).join(' · ');
      const chosen = (m?.voted ?? picked) === id;
      const props = voting && id !== api.me.id
        ? { type: 'button', 'aria-pressed': String(chosen), onclick: () => { picked = id; render(); } }
        : { type: 'button', disabled: true };
      return h(`button.uc-r.is-pick${chosen ? '.is-sel' : ''}${id === api.me.id ? '.is-self' : ''}`, props,
        av(id), h('span.uc-name', name(id), clue ? h('small', ` · ${clue}`) : null),
        chosen ? h('em', m?.voted ? 'Ton vote' : 'Choisi') : h('span'));
    });
    const nodes = [bar(), h('h2.uc-title', v.candidates ? 'Égalité : on revote' : 'Qui est l’intrus ?')];
    if (v.candidates) nodes.push(h('p.uc-sub', `Second vote entre ${v.candidates.map(name).join(' et ')}. En cas de nouvelle égalité, tirage au sort.`));
    nodes.push(rows, note(`${v.voted.length} sur ${v.alive.length} ont voté.`), h('div.uc-grow'));
    if (voting) {
      const b = btn(picked ? `Voter contre ${name(picked)}` : 'Choisis un joueur', () => picked && send({ type: 'vote', target: picked }));
      b.disabled = !picked;
      nodes.push(b);
    } else if (m?.voted) {
      nodes.push(h('div.uc-wait', 'Vote enregistré. En attente des autres.'));
    }
    return nodes;
  }

  function tally() {
    const rows = v.verdict?.tally || [];
    const max = Math.max(1, ...rows.map((r) => r.n));
    return h('div.uc-tally', rows.map((r) => h('div', h('span', name(r.id)), h('i', h('b', { style: `width:${(r.n / max) * 100}%` })), h('span', String(r.n)))));
  }

  function screenVerdict() {
    const vd = v.verdict;
    const nodes = [bar()];
    if (v.whiteGuess && !v.whiteGuess.right && vd?.role === 'white' && vd.round === v.round) {
      nodes.push(h('h2.uc-title', 'Raté pour Mr. White'),
        h('p.uc-sub', v.whiteGuess.text ? `${name(v.whiteGuess.id)} a proposé « ${v.whiteGuess.text} ». Ce n’était pas ça : la partie continue.` : `${name(v.whiteGuess.id)} n’a rien proposé à temps. La partie continue.`));
    } else if (!vd || vd.id === null) {
      nodes.push(h('h2.uc-title', 'Personne n’est éliminé'), h('p.uc-sub', 'Aucun vote : on repart pour une manche.'));
    } else {
      const how = vd.by === 'départ' ? `${name(vd.id)} a quitté la partie` : vd.by === 'tirage' ? `Le sort désigne ${name(vd.id)}` : `Le vote désigne ${name(vd.id)}`;
      nodes.push(h('h2.uc-title', how), roleCard(vd.id, vd.role, v.revealedWords[vd.id]), tally());
    }
    nodes.push(h('div.uc-grow'));
    if (me() && !me().out) {
      nodes.push(v.ready.includes(api.me.id)
        ? h('div.uc-ready', h('span.uc-wait', 'En attente des autres'), dots(v.ready.length, v.alive.length))
        : btn('Manche suivante', () => send({ type: 'ready' })));
    }
    return nodes;
  }

  function screenWhite() {
    const vd = v.verdict;
    const mine = vd.id === api.me.id;
    const nodes = [bar(), h('h2.uc-title', mine ? 'Ta dernière chance' : 'Dernière chance'),
      h('p.uc-sub', mine ? 'Tu es démasqué. Devine le mot des civils et tu gagnes seul.' : `${name(vd.id)} était Mr. White. S’il devine le mot des civils, il gagne seul.`),
      chips(true),
      h('div.uc-card.role-white.is-small.is-tilt', h('div.uc-face', h('span.uc-word.uc-q', '?'))),
      h('div.uc-grow')];
    if (mine) nodes.push(input('Le mot des civils', (text) => ({ type: 'guess', text })), note('Une seule tentative.'));
    else nodes.push(h('div.uc-wait', `${name(vd.id)} réfléchit…`));
    return nodes;
  }

  function screenOver() {
    const r = v.result;
    const title = r.winner === 'civil' ? 'Les civils gagnent' : r.winner === 'white' ? 'Mr. White gagne seul' : 'Les intrus gagnent';
    const roster = h('div.uc-rows.uc-roster', v.order.map((id) => h(`div.uc-r${v.out.includes(id) ? '.is-out' : ''}`,
      av(id), h('span.uc-name', name(id), r.winners.includes(id) ? h('small', ' · gagne') : null),
      h(`span.uc-rc.${v.roles[id]}`, ROLE[v.roles[id]]))));
    return [
      bar(h('span', `${v.round} manche${v.round > 1 ? 's' : ''}`)),
      h('h2.uc-title.uc-winners', title),
      r.winner === 'white' ? h('p.uc-sub', `${name(v.whiteGuess.id)} a trouvé « ${v.words.civil} ».`) : null,
      h('div.uc-words', h('span.w-civil', `Civils : ${v.words.civil}`), h('span.w-under', `Undercover : ${v.words.under}`)),
      roster,
    ].filter(Boolean);
  }

  const SCREENS = { word: screenWord, clues: screenClues, debate: screenDebate, vote: screenVote, verdict: screenVerdict, white: screenWhite, over: screenOver };

  function render() {
    if (!v) return;
    const phaseClass = v.phase === 'over' ? `ph-over-${v.result.winner}` : `ph-${v.phase}`;
    root.className = root.className.replace(/\bph-[\w-]+/g, '').trim();
    root.classList.add(phaseClass);
    const out = me()?.out && v.phase !== 'over' ? h('p.uc-out', 'Tu es éliminé : regarde la suite, et n’aide personne !') : null;
    const spectator = !me() && v.phase !== 'over' ? h('p.uc-out', 'Tu regardes la partie : les mots restent secrets jusqu’à la fin.') : null;
    el.replaceChildren(h('div.uc-screen', out, spectator, ...SCREENS[v.phase]()));
    tick();
  }

  let lastPhase = null;
  const off = api.onState((view, i) => {
    if (view.phase !== lastPhase) {
      draft = '';
      picked = null;
      lastPhase = view.phase;
    }
    v = view;
    info = i;
    render();
  });

  return () => {
    clearInterval(clock);
    off();
    root.className = root.className.replace(/\bph-[\w-]+/g, '').trim();
  };
}
