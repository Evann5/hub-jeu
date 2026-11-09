// Un seul mot côté navigateur : un mur bleu électrique couvert de post-it fluo, tenus par des punaises colorées.
// Le mot mystère est un grand post-it ; les indices sont de petits post-it légèrement penchés.

const COLORS = ['yellow', 'pink', 'green', 'blue', 'orange'];
const REASONS = { doublon: 'Doublon : annulé', invalide: 'Trop proche du mot : annulé', vote: 'Annulé par vote' };

// Confettis : une pluie de pastilles, une seule fois (rien si l'animation est réduite).
function confetti(h, host) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = h('div.us-confetti', { 'aria-hidden': 'true' }, Array.from({ length: 36 }, (_, i) => h(`i.${COLORS[i % 5]}`, {
    style: `left:${((i * 37) % 100) + 0.5}%;animation-delay:${((i * 53) % 90) / 100}s;--dx:${((i * 29) % 60) - 30}px`,
  })));
  host.append(layer);
  setTimeout(() => layer.remove(), 4200);
}

export function mount(root, api) {
  const { h } = api;
  const el = h('div.us');
  const live = h('p.us-sr', { role: 'status', 'aria-live': 'polite' });
  root.append(el, live);
  let v = null;
  let info = null;
  let announced = '';
  let celebrated = '';

  const name = (id) => api.user(id).pseudo;
  const isMe = (id) => id === api.me.id;
  const seated = () => info.isPlayer && !v.left.includes(api.me.id);
  const amActive = () => seated() && v.active === api.me.id;
  const writers = () => v.players.filter((id) => id !== v.active && !v.left.includes(id));
  const tilt = (i) => `--tilt:${(((i * 7) % 5) - 2) * 1.3}deg`;
  const color = (i) => COLORS[i % COLORS.length];

  // Les champs de saisie restent les mêmes d'un affichage à l'autre : on ne perd ni le texte ni le curseur.
  const clueInput = h('input', { type: 'text', maxlength: 24, autocomplete: 'off', autocapitalize: 'none', spellcheck: false, 'aria-label': 'Ton indice, un seul mot', placeholder: 'Un seul mot…' });
  const guessInput = h('input', { type: 'text', maxlength: 40, autocomplete: 'off', autocapitalize: 'none', spellcheck: false, 'aria-label': 'Ta proposition', placeholder: 'Le mot mystère est…' });

  function tick() {
    for (const t of el.querySelectorAll('.us-time')) {
      if (!v.deadline) { t.textContent = ''; continue; }
      const left = Math.max(0, Math.ceil((v.deadline - api.now()) / 1000));
      t.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      t.classList.toggle('is-low', left <= 10);
    }
  }
  const clock = setInterval(tick, 250);

  const send = (action) => api.sendMove(action).catch(() => {});

  function head(label) {
    return h('header.us-head',
      h('span.us-tag', `Manche ${Math.min(v.round + 1, v.rounds)} / ${v.rounds}`),
      h('span.us-label', label),
      h('span.us-score', `Score ${v.score}`),
      h('span.us-time', { 'aria-label': 'Temps restant' }));
  }

  const note = (text, i, extra = '') => h(`div.us-note.${color(i)}${extra}`, { style: tilt(i) }, h('i.us-pin', { 'aria-hidden': 'true' }), h('span', text));

  function progress(done, verb) {
    const people = writers();
    return h('ul.us-who', { 'aria-label': `${done.length} sur ${people.length} ${verb}` }, people.map((id) => h(`li${done.includes(id) ? '.is-done' : ''}`,
      api.token(api.user(id), { size: 's' }), h('span.us-name', name(id)), h('i.us-mark', { 'aria-hidden': 'true' }), h('span.us-sr', done.includes(id) ? 'fait' : 'en attente'))));
  }

  function screenPick() {
    if (amActive()) {
      return [head('À toi de deviner'),
        h('section.us-card', h('h2', 'Choisis un numéro de 1 à 5'),
          h('p', 'Tu ne verras pas le mot : les autres joueurs le verront.'),
          h('div.us-picks', Array.from({ length: v.choices }, (_, i) => h(`button.us-pick.${color(i)}`, {
            type: 'button', style: tilt(i), dataset: { k: `pick${i}` }, onclick: () => send({ type: 'pick', n: i + 1 }), 'aria-label': `Numéro ${i + 1}`,
          }, h('i.us-pin', { 'aria-hidden': 'true' }), String(i + 1))))),
      ];
    }
    return [head(`${name(v.active)} devine`),
      h('section.us-card', h('h2', `${isMe(v.active) ? 'Tu' : name(v.active)} ${isMe(v.active) ? 'choisis' : 'choisit'} un numéro`),
        null,
        h('div.us-picks.is-idle', Array.from({ length: v.choices }, (_, i) => note('?', i))))];
  }

  function clueForm() {
    if (v.mine !== null) return note(v.mine, 0, '.is-mine');
    const form = h('form.us-form', h('label.us-sr', { for: 'us-clue' }, 'Ton indice'), clueInput, h('button.us-btn', { type: 'submit' }, 'Envoyer mon indice'));
    clueInput.id = 'us-clue';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api.sendMove({ type: 'clue', text: clueInput.value });
        clueInput.value = '';
      } catch { /* message déjà affiché par le hub, le texte reste */ }
    });
    return form;
  }

  function wordCard() {
    // En classe, sur ordinateur : caché tant qu'on ne maintient pas le clic (celui qui devine est souvent assis à côté).
    return api.secret(h('section.us-word', h('i.us-pin', { 'aria-hidden': 'true' }), h('small', 'Le mot mystère'), h('b', v.word)), { label: 'le mot mystère' });
  }

  function screenWrite() {
    if (amActive()) {
      return [head('Les autres écrivent'), h('section.us-card', h('h2', 'Les autres écrivent leur indice'), progress(v.wrote, 'ont écrit'))];
    }
    if (!seated()) return [head(`${name(v.active)} devine`), h('section.us-card', h('h2', 'Les indices s’écrivent…'), progress(v.wrote, 'ont écrit'))];
    return [head(`Aide ${name(v.active)}`), wordCard(),
      h('section.us-card',
        v.mine === null ? h('h2', 'Écris ton indice') : h('h2', 'Ton indice est collé'),
        v.mine === null ? h('p', 'Pas le mot lui-même, ni un mot de sa famille.') : null,
        clueForm(), progress(v.wrote, 'ont écrit'))];
  }

  function screenReview() {
    if (!v.review) {
      return [head(amActive() ? 'Les autres trient' : `${name(v.active)} devine`),
        h('section.us-card', h('h2', 'Tri des indices'), h('p', `${v.clueCount} indice${v.clueCount > 1 ? 's' : ''} en cours d’examen.`), progress(v.done, 'ont validé'))];
    }
    const mineDone = v.done.includes(api.me.id);
    const notes = v.review.map((c, i) => {
      const me = isMe(c.by);
      const voted = c.votes.includes(api.me.id);
      return h(`li.us-clue.${color(i)}${c.cancelled ? '.is-cancelled' : ''}`, { style: tilt(i) },
        h('i.us-pin', { 'aria-hidden': 'true' }),
        h('b.us-text', c.text),
        h('small', me ? 'ton indice' : name(c.by)),
        c.auto ? h('small.us-why', REASONS[c.auto]) : c.cancelled ? h('small.us-why', REASONS.vote) : null,
        !c.auto && !me ? h('button.us-mini', {
          type: 'button', disabled: mineDone, 'aria-pressed': String(voted), dataset: { k: `cancel${c.by}` },
          'aria-label': `${voted ? 'Retirer ton vote contre' : 'Annuler'} l’indice écrit par ${name(c.by)}`,
          onclick: () => send({ type: 'cancel', target: c.by }),
        }, voted ? 'Retirer mon vote' : 'Annuler', h('span', ` ${c.votes.length}/${c.need}`)) : (!c.auto && c.votes.length ? h('small', `${c.votes.length}/${c.need} veulent l’annuler`) : null));
    });
    return [head('Trier les indices'), wordCard(),
      h('section.us-card', h('h2', 'Garde les bons indices'),
        h('p', 'Doublons et indices trop proches : déjà annulés. Pour en écarter un autre, il faut plus de la moitié des voix.'),
        h('ul.us-clues', notes),
        mineDone ? h('p.us-wait', 'Tu as validé. On attend les autres…') : h('button.us-btn', { type: 'button', dataset: { k: 'done' }, onclick: () => send({ type: 'done' }) }, 'C’est bon pour moi'),
        progress(v.done, 'ont validé'))];
  }

  function guessForm() {
    const form = h('form.us-form', h('label.us-sr', { for: 'us-guess' }, 'Ta proposition'), guessInput,
      h('button.us-btn', { type: 'submit' }, 'Je propose'),
      h('button.us-btn.is-line', { type: 'button', dataset: { k: 'pass' }, onclick: () => send({ type: 'pass' }) }, 'Je passe'));
    guessInput.id = 'us-guess';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api.sendMove({ type: 'guess', text: guessInput.value });
        guessInput.value = '';
      } catch { /* message déjà affiché */ }
    });
    return form;
  }

  function screenGuess() {
    if (amActive()) {
      const clues = v.final.map((t, i) => h(`li.us-clue.${color(i)}`, { style: tilt(i) }, h('i.us-pin', { 'aria-hidden': 'true' }), h('b.us-text', t)));
      return [head('À toi de deviner'),
        h('section.us-card', h('h2', clues.length ? 'Quel est le mot mystère ?' : 'Aucun indice n’a survécu'),
          clues.length ? h('ul.us-clues', clues) : null, guessForm())];
    }
    const clues = (v.finalBy || []).map((c, i) => h(`li.us-clue.${color(i)}`, { style: tilt(i) }, h('i.us-pin', { 'aria-hidden': 'true' }), h('b.us-text', c.text), h('small', isMe(c.by) ? 'ton indice' : name(c.by))));
    return [head(`${name(v.active)} devine`), v.word ? wordCard() : null,
      h('section.us-card', h('h2', `${name(v.active)} réfléchit…`), !clues.length ? h('p', 'Aucun indice n’a survécu.') : null, clues.length ? h('ul.us-clues', clues) : null)];
  }

  function trail() {
    return h('ol.us-trail', { 'aria-label': 'Résultats des manches' }, Array.from({ length: v.rounds }, (_, i) => {
      const e = v.history[i];
      const cls = !e ? 'is-todo' : e.outcome === 'win' ? 'is-win' : e.outcome === 'miss' ? 'is-miss' : 'is-pass';
      const text = !e ? 'à venir' : e.outcome === 'win' ? 'trouvé' : e.outcome === 'miss' ? 'raté' : e.outcome === 'pass' ? 'passé' : 'manche annulée';
      return h(`li.${cls}`, { 'aria-label': `Manche ${i + 1} : ${text}` }, h('i'));
    }));
  }

  function resultClues(entry) {
    return h('ul.us-clues', entry.clues.map((c, i) => h(`li.us-clue.${color(i)}${c.cancelled ? '.is-cancelled' : ''}`, { style: tilt(i) },
      h('i.us-pin', { 'aria-hidden': 'true' }),
      h('b.us-text', c.text),
      h('small', isMe(c.by) ? 'ton indice' : name(c.by)),
      c.cancelled ? h('small.us-why', REASONS[c.cancelled]) : null)));
  }

  function screenResult() {
    const e = v.last;
    const who = isMe(e.active) ? 'Tu' : name(e.active);
    const verdict = e.outcome === 'win' ? { cls: 'win', big: 'Trouvé !', text: `${who} ${isMe(e.active) ? 'as' : 'a'} deviné « ${e.guess} ». Un point pour l’équipe.` }
      : e.outcome === 'miss' ? { cls: 'miss', big: 'Raté', text: `${who} ${isMe(e.active) ? 'as' : 'a'} proposé « ${e.guess} ».` }
        : e.outcome === 'pass' ? { cls: 'pass', big: 'Passé', text: `${who} ${isMe(e.active) ? 'as' : 'a'} passé.` }
          : { cls: 'pass', big: 'Manche annulée', text: `${who} ${isMe(e.active) ? 'as' : 'a'} quitté la partie en cours de manche.` };
    return [head('Résultat'),
      h(`section.us-card.us-verdict.is-${verdict.cls}`,
        h('h2', verdict.big),
        e.word ? h('p', 'Le mot était ', h('b.us-reveal', e.word), '.') : null,
        h('p', verdict.text),
        e.clues.length ? resultClues(e) : null,
        trail(),
        seated() ? h('button.us-btn', { type: 'button', dataset: { k: 'next' }, onclick: () => send({ type: 'next' }) }, v.round + 1 < v.rounds ? 'Manche suivante' : 'Voir le score') : null)];
  }

  function verdictFor() {
    const r = v.score / v.rounds;
    if (v.score === v.rounds) return 'Score parfait ! Vous lisez dans les pensées.';
    if (r >= 0.9) return 'Incroyable : presque sans faute.';
    if (r >= 0.8) return 'Génial, vous êtes très synchrones.';
    if (r >= 0.65) return 'Très bien joué.';
    if (r >= 0.5) return 'Pas mal du tout !';
    if (r >= 0.3) return 'Dans la moyenne : encore un peu d’entraînement.';
    return 'Pas facile aujourd’hui. On refait une partie ?';
  }

  function screenOver() {
    return [head('Fin de partie'),
      h('section.us-card.us-verdict',
        h('h2', `${v.score} sur ${v.rounds}`),
        h('p', verdictFor()),
        trail(),
        h('ul.us-recap', v.history.map((e, i) => h('li', h('b', `${i + 1}.`), ' ', e.word ?? '—', ' ',
          h('small', e.outcome === 'win' ? `trouvé par ${name(e.active)}` : e.outcome === 'miss' ? `raté (« ${e.guess} »)` : e.outcome === 'pass' ? 'passé' : 'annulée')))))];
  }

  function liveText() {
    if (v.phase === 'pick') return `Manche ${v.round + 1}. ${name(v.active)} choisit un numéro.`;
    if (v.phase === 'write') return amActive() ? 'Les autres écrivent leurs indices.' : seated() ? `Le mot mystère est ${v.word}. Écris un indice d’un seul mot.` : 'Les joueurs écrivent leurs indices.';
    if (v.phase === 'review') return v.review ? 'Trie les indices : tu peux en annuler par vote.' : 'Les autres trient les indices.';
    if (v.phase === 'guess') return amActive() ? 'À toi de deviner le mot mystère.' : `${name(v.active)} réfléchit.`;
    if (v.phase === 'result') return v.last.outcome === 'win' ? 'Trouvé !' : v.last.outcome === 'miss' ? 'Raté.' : 'Manche terminée.';
    return `Fin de partie : ${v.score} sur ${v.rounds}.`;
  }

  function render() {
    const focus = document.activeElement;
    const focusKey = el.contains(focus) ? (focus.dataset?.k || (focus === clueInput ? '#clue' : focus === guessInput ? '#guess' : null)) : null;
    const screens = { pick: screenPick, write: screenWrite, review: screenReview, guess: screenGuess, result: screenResult, over: screenOver };
    el.replaceChildren(h('div.us-board', ...screens[v.phase]().filter(Boolean)));
    if (focusKey) {
      const target = focusKey === '#clue' ? clueInput : focusKey === '#guess' ? guessInput : el.querySelector(`[data-k="${focusKey}"]:not(:disabled)`);
      if (target && el.contains(target)) target.focus({ preventScroll: true });
    } else if (matchMedia('(hover: hover)').matches) {
      // Sur ordinateur, le champ à remplir prend le focus tout seul (pas sur téléphone : le clavier cacherait l'écran).
      const field = v.phase === 'write' && seated() && !amActive() && v.mine === null ? clueInput : v.phase === 'guess' && amActive() ? guessInput : null;
      if (field && el.contains(field) && !document.querySelector('.table-chat :focus')) field.focus({ preventScroll: true });
    }
    const party = v.phase === 'result' && v.last.outcome === 'win' ? `r${v.round}` : v.phase === 'over' && v.score * 2 >= v.rounds ? 'over' : '';
    if (party && party !== celebrated) { celebrated = party; confetti(h, root); }
    const text = liveText();
    const key = `${v.round}|${v.phase}|${text}`;
    if (key !== announced) { announced = key; live.textContent = text; }
    tick();
  }

  const off = api.onState((view, i) => {
    v = view;
    info = i;
    render();
  });

  return () => {
    clearInterval(clock);
    off();
  };
}
