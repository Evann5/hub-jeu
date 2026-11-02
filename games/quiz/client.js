// Quiz côté navigateur : plateau de jeu télé pop. Quatre grandes tuiles de couleur, un chrono en barre,
// la bonne réponse révélée avec le nombre de joueurs par réponse, puis le podium.

const LETTERS = ['A', 'B', 'C', 'D'];

export function mount(root, api) {
  const { h } = api;
  const el = h('div.qz');
  root.append(el);
  let v = null;
  let info = null;

  const fmtPts = (n) => n.toLocaleString('fr-FR');

  function tick() {
    const bar = el.querySelector('.qz-timer i');
    const num = el.querySelector('.qz-sec');
    if (!v?.deadline) return;
    const left = Math.max(0, v.deadline - api.now());
    if (bar) bar.style.transform = `scaleX(${Math.min(1, left / v.time)})`;
    if (num) num.textContent = String(Math.ceil(left / 1000));
  }
  const clock = setInterval(tick, 100);

  function scoreboard({ big = false } = {}) {
    const rows = v.ranking.filter((id) => !v.left.includes(id)).slice(0, big ? 20 : 6);
    return h(`ol.qz-board${big ? '.is-big' : ''}`, rows.map((id, i) => h(`li${id === api.me.id ? '.is-me' : ''}`,
      h('span.qz-rank', String(i + 1)),
      h('span.qz-av', { 'aria-hidden': 'true' }, api.user(id).avatar),
      h('span.qz-pseudo', api.user(id).pseudo),
      v.gained[id] ? h('span.qz-plus', `+${fmtPts(v.gained[id])}`) : null,
      h('b', fmtPts(v.scores[id] || 0)))));
  }

  function screenReady() {
    return h('div.qz-center',
      h('p.qz-kicker', `${v.total} questions`),
      h('h2.qz-big', 'Prêts\u202f?'),
      h('p.qz-sub', 'Touche la bonne réponse le plus vite possible.'),
      h('span.qz-sec.qz-count'));
  }

  function screenQuestion() {
    const q = v.question;
    const reveal = v.phase === 'reveal';
    const canAnswer = !reveal && info.turn.includes(api.me.id);
    const answeredCount = v.answered.length;
    const tiles = q.choices.map((text, i) => {
      const isRight = reveal && v.correct === i;
      const isMine = v.mine === i;
      const cls = `.qz-tile.c${i}${reveal ? (isRight ? '.is-right' : '.is-wrong') : ''}${isMine ? '.is-mine' : ''}`;
      return h(`button${cls}`, {
        type: 'button',
        disabled: !canAnswer,
        'aria-pressed': String(isMine),
        onclick: () => api.sendMove({ type: 'answer', choice: i }).catch(() => {}),
      },
      h('span.qz-letter', LETTERS[i]),
      h('span.qz-text', text),
      reveal ? h('span.qz-n', { 'aria-label': `${v.counts[i]} réponse(s)` }, String(v.counts[i])) : isMine ? h('span.qz-n', '✓') : null);
    });
    let status;
    if (reveal) {
      const g = v.gained[api.me.id];
      status = v.mine === null && info.isPlayer ? 'Pas de réponse cette fois.'
        : g ? `Bonne réponse ! +${fmtPts(g)} points` : info.isPlayer ? 'Raté !' : 'Voici la bonne réponse.';
    } else {
      status = v.mine !== null ? `Réponse enregistrée. ${answeredCount} sur ${v.players.length - v.left.length} ont répondu.`
        : info.isPlayer ? 'Choisis ta réponse.' : 'Les joueurs répondent…';
    }
    return [
      h('div.qz-head',
        h('span.qz-chip', `Question ${v.index + 1} / ${v.total}`),
        h('span.qz-theme', q.theme),
        reveal ? null : h('span.qz-sec')),
      reveal ? h('div.qz-timer.is-done') : h('div.qz-timer', h('i')),
      h('h2.qz-q', q.q),
      h('div.qz-tiles', tiles),
      h(`p.qz-status${reveal && v.gained[api.me.id] ? '.is-good' : ''}`, { 'aria-live': 'polite' }, status),
    ];
  }

  function screenOver() {
    const rank = v.ranking.filter((id) => !v.left.includes(id));
    const podium = [rank[1], rank[0], rank[2]].map((id, i) => (id === undefined ? h('div.qz-step.is-empty') : h(`div.qz-step.p${[2, 1, 3][i]}`,
      h('span.qz-av.is-big', api.user(id).avatar),
      h('b', api.user(id).pseudo),
      h('span', `${fmtPts(v.scores[id])} pts`),
      h('div.qz-block', String([2, 1, 3][i])))));
    return h('div.qz-over',
      h('p.qz-kicker', 'Fin du quiz'),
      h('h2.qz-big.qz-winner', rank[0] !== undefined && v.scores[rank[0]] > 0
        ? (rank[0] === api.me.id ? 'Tu gagnes\u202f!' : `${api.user(rank[0]).pseudo} gagne\u202f!`)
        : 'Personne n’a marqué'),
      h('div.qz-podium', podium),
      scoreboard({ big: true }));
  }

  function render() {
    let main;
    if (v.phase === 'ready') main = [screenReady()];
    else if (v.phase === 'over') main = [screenOver()];
    else main = screenQuestion();
    el.replaceChildren(h('div.qz-stage', h('div.qz-main', main), v.phase === 'over' ? null : h('aside.qz-side', h('h3', 'Classement'), scoreboard())));
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
