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
  const entry = () => h('div.my-entry', h('h2.my-word', v.word), h('span.my-gram', 'Mot rare : invente sa définition'));

  function screenWrite() {
    const nodes = [head('Invente'), entry()];
    if (isPlayer() && v.mine === null) {
      const area = h('textarea', {
        rows: 3, maxlength: 160, placeholder: 'Ta fausse définition, la plus crédible possible…', 'aria-label': 'Ta fausse définition',
        value: draft, oninput: (e) => { draft = e.target.value; },
      });
      const form = h('form.my-form', area, h('button.my-btn', { type: 'submit' }, 'Proposer ma définition'));
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
      nodes.push(form, h('p.my-tip', 'Astuce : imite le ton d’un dictionnaire. Une définition courte et précise piège mieux.'));
      setTimeout(() => matchMedia('(hover: hover)').matches && area.focus({ preventScroll: true }));
    } else if (v.mine) {
      nodes.push(h('blockquote.my-mine', h('span', 'Ta définition'), v.mine));
    }
    nodes.push(waiting(v.written, 'ont écrit'));
    return nodes;
  }

  function waiting(done, verb) {
    const people = v.players.filter((id) => !v.left.includes(id));
    return h('ul.my-waiting', { 'aria-label': `${done.length} sur ${people.length} ${verb}` }, people.map((id) => h(`li${done.includes(id) ? '.is-done' : ''}`,
      h('span.my-av', api.user(id).avatar), h('span', pseudo(id)))));
  }

  function screenVote() {
    const canVote = isPlayer() && v.myVote === null;
    const list = h('ol.my-senses', v.options.map((o) => h('li',
      h(`button.my-sense${o.mine ? '.is-mine' : ''}${v.myVote === o.index ? '.is-voted' : ''}`, {
        type: 'button',
        disabled: !canVote || o.mine,
        onclick: () => api.sendMove({ type: 'vote', option: o.index }).catch(() => {}),
      }, h('b', `${o.index + 1}.`), h('span', o.text), o.mine ? h('small', 'la tienne') : v.myVote === o.index ? h('small', 'ton vote') : null))));
    return [head('Vote'), entry(),
      h('p.my-ask', canVote ? 'Laquelle est la vraie ? Touche ta réponse.' : v.myVote !== null ? 'Vote enregistré.' : 'Les joueurs cherchent la vraie définition…'),
      list, waiting(v.voted, 'ont voté')];
  }

  function screenReveal() {
    const list = h('ol.my-senses.is-reveal', v.options.map((o) => {
      const truth = o.by === 'vrai';
      return h(`li.${truth ? 'is-truth' : 'is-fake'}`,
        h('div.my-sense',
          h('b', `${o.index + 1}.`),
          h('span', o.text),
          truth ? h('span.my-stamp', 'Vrai') : null),
        h('p.my-by',
          truth ? 'La vraie définition' : h('i', `Inventée par ${pseudo(o.by)}`),
          o.voters.length ? ` · ${o.voters.length > 1 ? 'votes' : 'vote'} : ${o.voters.map(pseudo).join(', ')}` : ' · aucun vote'));
    }));
    const g = v.gained[api.me.id];
    return [head('Révélation'), entry(), info.isPlayer ? h(`p.my-gain${g ? '.is-good' : ''}`, g ? `+${g} points pour toi` : 'Aucun point cette manche.') : null, list,
      scores(), isPlayer() ? h('button.my-btn.is-line', { type: 'button', onclick: () => api.sendMove({ type: 'next' }).catch(() => {}) }, v.round + 1 < v.rounds ? 'Mot suivant' : 'Voir le classement') : null];
  }

  function scores() {
    const rank = [...v.players].filter((id) => !v.left.includes(id)).sort((a, b) => v.scores[b] - v.scores[a]);
    return h('ol.my-scores', rank.map((id) => h(`li${id === api.me.id ? '.is-me' : ''}`,
      h('span.my-av', api.user(id).avatar), h('span.my-name', pseudo(id)),
      v.gained[id] ? h('em', `+${v.gained[id]}`) : null, h('b', String(v.scores[id])))));
  }

  function screenOver() {
    return [h('div.my-head', h('span', 'Fin de partie'), h('span', `${v.rounds} mots`), h('span')),
      h('div.my-entry', h('h2.my-word', 'Classement'), h('span.my-gram', 'Les plus grands mythos')),
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
