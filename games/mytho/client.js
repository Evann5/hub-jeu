// Mytho côté navigateur : bulles de BD pop. Le mot en gros sticker, les définitions en bulles numérotées ;
// à la révélation, un tampon « Vrai » et le nom de chaque mytho.

export function mount(root, api) {
  const { h } = api;
  const el = h('div.my');
  root.append(el);
  let v = null;
  let info = null;
  let draft = '';
  let lastKey = '';

  const pseudo = (id) => api.user(id).pseudo;
  const isPlayer = () => info.isPlayer && !v.left.includes(api.me.id);

  function tick() {
    for (const t of el.querySelectorAll('.my-time')) {
      const left = Math.max(0, Math.ceil((v.deadline - api.now()) / 1000));
      t.textContent = v.deadline ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '';
      t.classList.toggle('is-low', left <= 10);
    }
  }
  const clock = setInterval(tick, 250);

  const head = (label) => h('div.my-head', h('span', `Manche ${v.round + 1} sur ${v.rounds}`), h('span', label), h('span.my-time'));
  const entry = (small) => h(`div.my-entry${small ? '.is-small' : ''}`, h('h2.my-word', v.word));

  // Les joueurs et leur score, toujours là ; la pastille dit qui a fini l'étape en cours (écrit, voté) ou ce qu'il vient de gagner.
  function roster(done) {
    const people = v.players.filter((id) => !v.left.includes(id));
    const label = v.phase === 'write' ? 'ont écrit' : v.phase === 'vote' ? 'ont voté' : '';
    return h('ul.my-roster', { 'aria-label': label ? `${done.length} sur ${people.length} ${label}` : 'Scores' }, people.map((id) => {
      const gain = v.phase === 'reveal' ? v.gained[id] : 0;
      return h(`li${done && done.includes(id) ? '.is-done' : ''}${id === api.me.id ? '.is-me' : ''}`,
        h('span.my-av', api.user(id).avatar), h('span.my-name', pseudo(id)),
        h('b', String(v.scores[id] || 0)), gain ? h('em', `+${gain}`) : null);
    }));
  }

  function screenWrite() {
    const nodes = [head('Invente'), roster(v.written), entry()];
    if (isPlayer() && v.mine === null) {
      const area = h('textarea', {
        rows: 3, maxlength: 160, placeholder: 'Ta définition, crédible comme un dictionnaire…', 'aria-label': 'Ta fausse définition',
        value: draft, oninput: (e) => { draft = e.target.value; },
      });
      const send = h('button.my-btn', { type: 'submit', disabled: !draft.trim() }, 'Proposer ma définition');
      area.addEventListener('input', () => { send.disabled = !area.value.trim(); });
      const form = h('form.my-form', area, send);
      area.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          form.requestSubmit();
        }
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await api.sendMove({ type: 'define', text: area.value });
          draft = '';
        } catch { /* message déjà affiché */ }
      });
      nodes.push(form);
      setTimeout(() => matchMedia('(hover: hover)').matches && area.focus({ preventScroll: true }));
    } else if (v.mine) {
      nodes.push(h('blockquote.my-mine', h('span', 'Ta définition'), v.mine));
    }
    return nodes;
  }

  function screenVote() {
    const canVote = isPlayer() && v.myVote === null;
    const list = h('ol.my-senses', v.options.map((o) => h('li',
      h(`button.my-sense${o.mine ? '.is-mine' : ''}${v.myVote === o.index ? '.is-voted' : ''}`, {
        type: 'button',
        disabled: !canVote || o.mine,
        onclick: () => api.sendMove({ type: 'vote', option: o.index }).catch(() => {}),
      }, h('b', `${o.index + 1}.`), h('span', o.text), o.mine ? h('small', 'la tienne') : v.myVote === o.index ? h('small', 'ton vote') : null))));
    return [head('Vote'), roster(v.voted), entry(true),
      h('p.my-ask', canVote ? 'Laquelle est la vraie ?' : v.myVote !== null ? 'Vote enregistré. On attend les autres.' : 'Les joueurs cherchent la vraie…'),
      list];
  }

  function screenReveal() {
    // La vraie définition passe en premier : c'est elle qu'on attend.
    const opts = [...v.options].sort((a, b) => (b.by === 'vrai') - (a.by === 'vrai'));
    const list = h('ol.my-senses.is-reveal', opts.map((o) => {
      const truth = o.by === 'vrai';
      const votes = o.voters.length ? `${o.voters.length} vote${o.voters.length > 1 ? 's' : ''} : ${o.voters.map(pseudo).join(', ')}` : 'aucun vote';
      return h(`li.${truth ? 'is-truth' : 'is-fake'}`,
        h('div.my-sense',
          h('b', `${o.index + 1}`),
          h('div.my-body', h('span.my-text', o.text), h('p.my-by', truth ? 'La vraie définition · ' : h('i', `${pseudo(o.by)} · `), votes)),
          truth ? h('span.my-stamp', 'Vrai') : null));
    }));
    const g = v.gained[api.me.id];
    const last = v.round + 1 >= v.rounds;
    return [head('Révélation'), roster(null), entry(true),
      info.isPlayer ? h(`p.my-gain${g ? '.is-good' : ''}`, g ? `+${g} points pour toi` : 'Aucun point cette manche') : null, list,
      isPlayer() ? h('div.my-foot', h('button.my-btn', { type: 'button', onclick: () => api.sendMove({ type: 'next' }).catch(() => {}) }, last ? 'Voir le classement' : 'Mot suivant')) : null];
  }

  function scores() {
    const rank = [...v.players].filter((id) => !v.left.includes(id)).sort((a, b) => v.scores[b] - v.scores[a]);
    const top = Math.max(...rank.map((id) => v.scores[id]));
    return h('ol.my-scores', rank.map((id) => h(`li${id === api.me.id ? '.is-me' : ''}${v.scores[id] === top ? '.is-top' : ''}`,
      h('span.my-av', api.user(id).avatar), h('span.my-name', pseudo(id)), h('b', String(v.scores[id])))));
  }

  function screenOver() {
    const rank = v.players.filter((id) => !v.left.includes(id));
    const top = Math.max(...rank.map((id) => v.scores[id]));
    const winners = rank.filter((id) => v.scores[id] === top).map(pseudo);
    return [h('div.my-head', h('span', 'Fin de partie'), h('span', `${v.rounds} mots`), h('span.my-time')),
      h(`div.my-entry${winners.length > 1 ? '.is-small' : ''}`, h('h2.my-word', winners.join(' & ')), h('span.my-gram', winners.length > 1 ? 'se partagent la victoire' : 'est le plus grand mytho')),
      scores()];
  }

  function render() {
    const screens = { write: screenWrite, vote: screenVote, reveal: screenReveal, over: screenOver };
    el.replaceChildren(h('article.my-page', ...screens[v.phase]().filter(Boolean)));
    tick();
  }

  const off = api.onState((view, i) => {
    const key = `${view.round}-${view.phase}`;
    if (key !== lastKey && view.phase !== 'write') draft = '';
    lastKey = key;
    v = view;
    info = i;
    render();
  });

  return () => {
    clearInterval(clock);
    off();
  };
}
