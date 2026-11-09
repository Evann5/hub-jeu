// Loups-garous côté navigateur : le village, la carte de rôle, les actions de nuit, le débat et le vote.
// Le hub fournit api (voir docs/integration.md §8). Tout ce qui est secret arrive déjà filtré par view() : ici on affiche.

import { ROLES, medal, scene } from './client/art.js';

const CAUSE = {
  night: 'mort dans la nuit',
  vote: 'éliminé par le village',
  shot: 'abattu par le Chasseur',
  love: 'mort de chagrin',
  left: 'a quitté la partie',
};

// Le ciel suit la partie : nuit, plein jour pour le débat, crépuscule pour le vote.
const TONES = { night: 'night', witch: 'night', hunter: 'day', debate: 'day', vote: 'dusk' };

const heart = (label) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'lg-heart');
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); } else svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M12 21C5 15.5 2.5 12 2.5 8.4 2.5 5.6 4.6 3.6 7.1 3.6c1.9 0 3.7 1 4.9 2.8 1.2-1.8 3-2.8 4.9-2.8 2.5 0 4.6 2 4.6 4.8C21.5 12 19 15.5 12 21z" fill="currentColor"/>';
  return svg;
};

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function mount(root, api) {
  const { h } = api;
  const name = (id) => api.user(id)?.pseudo ?? 'Quelqu’un';
  const roleName = (r) => ROLES[r]?.name ?? '?';
  const join = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} et ${names.at(-1)}`);

  let view = null;
  let info = null;
  let sel = []; // sélection en cours (cible d'un pouvoir)
  let phaseKey = '';
  let journalOpen = matchMedia('(min-width: 700px)').matches;
  let cardOpen = false;
  let cardFirst = false;

  // ——— Structure fixe ———
  const sky = h('div.lg-sky', { 'aria-hidden': 'true' }, h('div.lg-stars'), h('div.lg-orb', h('i')), scene());
  const live = h('p.sr-only', { 'aria-live': 'polite' });
  const head = h('header.lg-head');
  const body = h('div.lg-body');
  const scroll = h('div.lg-scroll', head, body);
  const overlay = h('div.lg-overlay', { hidden: true });
  const app = h('div.lg', { dataset: { tone: 'night' } }, sky, scroll, overlay, live);
  root.append(app);

  const timeText = h('span.lg-time');
  const timeBar = h('i');
  const timer = h('div.lg-timer', { role: 'timer', 'aria-label': 'Temps restant' }, timeText, h('span.lg-bar', timeBar));

  function tick() {
    if (!info?.deadline || !view || view.phase === 'over') {
      timer.hidden = true;
      return;
    }
    timer.hidden = false;
    const left = info.deadline - api.now();
    timeText.textContent = fmt(left);
    const ratio = view.span ? Math.min(1, Math.max(0, left / view.span)) : 0;
    timeBar.style.transform = `scaleX(${ratio})`;
    timer.classList.toggle('is-low', left < 10_000);
  }
  const clock = setInterval(tick, 500);

  // ——— Aides d'affichage ———
  const send = (action) => api.sendMove(action).catch(() => {});
  const btn = (label, onclick, { kind = 'primary', disabled = false, key } = {}) => h(`button.lg-btn.${kind}`, {
    type: 'button', onclick, disabled, dataset: key ? { key } : undefined,
  }, label);

  const deadById = () => new Map(view.dead.map((d) => [d.id, d]));
  const isAlive = (id) => !view.dead.some((d) => d.id === id);
  const living = () => view.players.filter(isAlive);

  function who(id, { role = true } = {}) {
    const r = view.roles[id];
    return h('span.lg-who', h('b', name(id)), role && r ? h('span.lg-role-tag', { style: `--rc:${ROLES[r].color}` }, roleName(r)) : null);
  }

  // ——— Actions possibles selon la phase ———
  // Renvoie null ou { max, confirm, pick(id) } : max = nombre de cibles, confirm = faut-il un bouton pour valider.
  function targeting() {
    const me = view.me;
    if (me && view.phase === 'hunter' && view.hunter === me.id) return { max: 1, ok: isAlive };
    if (!me || !me.alive) return null;
    const others = (id) => isAlive(id) && id !== me.id;
    if (view.phase === 'night') {
      if (me.role === 'cupid' && !me.acted) return { max: 2, ok: isAlive };
      if (me.role === 'seer' && !me.acted) return { max: 1, ok: others };
      if (me.role === 'wolf') return { max: 1, ok: (id) => isAlive(id) && view.roles[id] !== 'wolf', instant: (id) => send({ type: 'wolf', target: id }) };
    }
    if (view.phase === 'witch' && me.role === 'witch' && view.witch && !view.witch.done && view.witch.death) return { max: 1, ok: others };
    if (view.phase === 'vote') return { max: 1, ok: others, instant: (id) => send({ type: 'vote', target: id }) };
    return null;
  }

  function pickSeat(id, tgt) {
    if (tgt.instant) {
      tgt.instant(id);
      return;
    }
    if (sel.includes(id)) sel = sel.filter((x) => x !== id);
    else sel = tgt.max === 1 ? [id] : [...sel, id].slice(-tgt.max);
    render();
  }

  // ——— Le village (liste des joueurs) ———
  function seat(id, tgt) {
    const d = deadById().get(id);
    const r = view.roles[id];
    const isMe = view.me?.id === id;
    const ok = Boolean(tgt && tgt.ok(id));
    const picked = sel.includes(id);
    const myVote = view.phase === 'vote' && view.me?.vote === id;
    const wolfVoters = view.wolfVotes ? Object.entries(view.wolfVotes).filter(([, t]) => t === id).map(([w]) => Number(w)) : [];
    const myWolfVote = view.me?.role === 'wolf' && view.wolfVotes?.[view.me.id] === id;
    const seenRole = view.seen?.filter((x) => x.target === id).at(-1)?.role;
    const lover = view.lovers?.includes(id);
    const sub = [];
    const hides = api.hidesSecrets?.(); // en classe, sur ordinateur : les rôles connus des vivants ne s'affichent pas dans la liste
    if (d) sub.push(h('span.lg-sub', `${roleName(d.role)} · ${CAUSE[d.cause] ?? ''}`.replace(/ · $/, '')));
    else if (r && !hides) sub.push(h('span.lg-sub', roleName(r)));
    if (seenRole && !d && !hides) sub.push(h('span.lg-sub', `Vu : ${roleName(seenRole)}`));
    if (wolfVoters.length) sub.push(h('span.lg-sub.is-wolf', `Visé par ${join(wolfVoters.map(name))}`));
    const inner = [
      d ? h('span.lg-seat-medal', medal(d.role, 34)) : api.token(api.user(id), { size: 's' }),
      h('span.lg-seat-text',
        h('span.lg-seat-name', name(id), isMe ? h('span.lg-me', 'toi') : null, lover ? heart('amoureux') : null),
        ...sub),
    ];
    const cls = `lg-seat${d ? ' is-dead' : ''}${picked || myVote || myWolfVote ? ' is-picked' : ''}${ok ? ' is-target' : ''}${isMe ? ' is-me' : ''}`;
    if (!ok) return h('li', h(`div.${cls.split(' ').join('.')}`, inner));
    const verb = view.phase === 'vote' ? 'Voter contre' : view.phase === 'night' && view.me.role === 'wolf' ? 'Dévorer' : 'Choisir';
    return h('li', h(`button.${cls.split(' ').join('.')}`, {
      type: 'button',
      'aria-pressed': String(picked || myVote || myWolfVote),
      'aria-label': `${verb} ${name(id)}`,
      dataset: { key: `seat-${id}` },
      onclick: () => pickSeat(id, tgt),
    }, inner));
  }

  function village(tgt) {
    return h('section.lg-box.lg-village', { 'aria-label': 'Le village' },
      h('h3', 'Le village ', h('small', `${view.aliveCount} en vie sur ${view.players.length}`)),
      h('ul.lg-seats', view.players.map((id) => seat(id, tgt))));
  }

  // ——— Journal ———
  function logLine(e) {
    const rolesOf = (ids) => ids.map((id) => who(id));
    if (e.k === 'dawn') {
      return h('li', h('b', `Nuit ${e.n} · `), e.dead.length
        ? ['Retrouvé', e.dead.length > 1 ? 's' : '', ' mort', e.dead.length > 1 ? 's' : '', ' : ', ...rolesOf(e.dead).flatMap((w, i) => (i ? [', ', w] : [w]))]
        : 'personne n’est mort.');
    }
    if (e.k === 'shot') {
      return h('li', h('b', `Chasseur · `), who(e.hunter, { role: false }), ' a tiré sur ', who(e.target), e.dead.length > 1 ? ' (et son amoureux le suit).' : '.');
    }
    if (e.k === 'vote') {
      const count = e.out === null ? 0 : e.ballots.filter(([, t]) => t === e.out).length;
      return h('li', h('b', `Jour ${e.n} · `), e.out === null ? 'égalité ou aucun vote : personne n’est éliminé.' : [who(e.out), ` est éliminé (${count} voix).`],
        e.ballots.length ? h('small.lg-ballots', e.ballots.map(([from, to]) => `${name(from)} → ${to === null ? 'blanc' : name(to)}`).join(' · ')) : null);
    }
    if (e.k === 'left') return h('li', h('b', 'Départ · '), `${name(e.id)} a quitté la partie.`);
    return null;
  }

  function journal() {
    const d = h('details.lg-box.lg-journal', { open: journalOpen, ontoggle: (ev) => { journalOpen = ev.target.open; } },
      h('summary', 'Journal du village'),
      view.log.length ? h('ol.lg-log', [...view.log].reverse().map(logLine)) : h('p.lg-muted', 'Rien à signaler pour l’instant.'));
    return d;
  }

  // ——— Les panneaux d'action ———
  // Ce que tout le village sait déjà (rien de secret : view.dead et view.aliveCount sont publics).
  // On ne le raccourcit jamais selon les rôles vivants, ce qui révélerait qui est en vie.
  const knownFacts = () => h('dl.lg-facts',
    h('div', h('dt', 'Nuit'), h('dd', `n° ${view.n}`)),
    h('div', h('dt', 'En vie'), h('dd', `${view.aliveCount} sur ${view.players.length}`)),
    h('div.lg-facts-dead', h('dt', 'Morts connus'), h('dd', view.dead.length
      ? join(view.dead.map((d) => `${name(d.id)} (${roleName(d.role)})`))
      : 'personne pour l’instant')));

  const sleepPanel = (text) => h('section.lg-panel.is-sleep',
    h('div.lg-zzz', { 'aria-hidden': 'true' }, h('span', 'z'), h('span', 'z'), h('span', 'z')),
    h('h3', 'Le village dort'), h('p', text), knownFacts());

  const recap = () => {
    const last = view.log.at(-1);
    if (view.phase !== 'night' || !last || last.k === 'dawn') return null;
    const e = last.k === 'shot' ? view.log.findLast((x) => x.k === 'vote') : last;
    if (!e || e.k !== 'vote') return null;
    return h('p.lg-recap', 'Hier, ', e.out === null ? 'le village n’a éliminé personne.' : [h('b', name(e.out)), ` (${roleName(view.roles[e.out])}) a été éliminé par le village.`]);
  };

  function nightPanel() {
    const me = view.me;
    const r = recap();
    if (!me) return [r, sleepPanel('La nuit est tombée. Tu regardes la partie : les rôles ne sont pas visibles.')];
    if (!me.alive) return [r, godPanel()];
    if (me.role === 'cupid' && !me.acted) {
      const [a, b] = sel;
      return [r, h('section.lg-panel',
        h('h3', 'Cupidon, unis deux cœurs'),
        h('p', 'Choisis deux personnes (tu peux te choisir toi-même). Si l’une meurt, l’autre la suit.'),
        h('p.lg-chosen', a ? h('b', name(a)) : '…', heart(), b ? h('b', name(b)) : '…'),
        btn('Les unir', () => { send({ type: 'love', targets: sel }); sel = []; }, { disabled: sel.length !== 2, key: 'confirm' }))];
    }
    if (me.role === 'cupid' && view.n === 1) { // Cupidon n'agit que la première nuit : ensuite il dort comme tout le monde
      const [a, b] = view.lovers ?? [];
      return [r, sleepPanel(`C’est fait : ${a ? name(a) : '?'} et ${b ? name(b) : '?'} sont unis pour la vie. Retourne dormir.`)];
    }
    if (me.role === 'seer' && !me.acted) {
      return [r, h('section.lg-panel',
        h('h3', 'Voyante, qui sondes-tu ?'),
        h('p', 'Choisis quelqu’un : tu verras son vrai rôle.'),
        btn(sel[0] ? `Sonder ${name(sel[0])}` : 'Choisis un joueur', () => { send({ type: 'peek', target: sel[0] }); sel = []; }, { disabled: !sel[0], key: 'confirm' }))];
    }
    if (me.role === 'seer') {
      const last = view.seen.at(-1);
      return [r, h('section.lg-panel.lg-vision',
        h('h3', 'Ta vision'),
        last ? h('div.lg-vision-row', medal(last.role, 56), h('p', h('b', name(last.target)), ' est ', h('b', roleName(last.role)), '.')) : null,
        h('p.lg-muted', 'Garde ça pour toi… ou pas. Retourne dormir.'))];
    }
    if (me.role === 'wolf') {
      const mates = (view.wolves ?? []).filter((id) => id !== me.id);
      const wolves = view.wolves ?? [];
      const votes = wolves.map((w) => {
        const t = view.wolfVotes?.[w];
        return h('li', h('b', name(w)), t === undefined ? h('span.lg-muted', ' n’a pas voté') : [' → ', h('b', name(t))]);
      });
      const targets = wolves.map((w) => view.wolfVotes?.[w]);
      const agreed = targets.every((t) => t !== undefined) && new Set(targets).size === 1;
      return [r, h('section.lg-panel',
        h('h3', 'Loup-garou, choisis ta proie'),
        h('p', mates.length ? `Ta meute : ${join(mates.map(name))}. Toute la meute doit choisir la même victime.` : 'Tu es le seul loup : touche ta victime dans le village.'),
        h('ul.lg-votes', votes),
        h('p.lg-muted', agreed ? 'Vous êtes d’accord : la nuit avance.' : 'Tu peux changer d’avis jusqu’à la fin du temps.'))];
    }
    return [r, sleepPanel('Tout le monde ferme les yeux. Les rôles de la nuit agissent en secret… attends le lever du jour.')];
  }

  function witchPanel() {
    const me = view.me;
    if (me?.alive && me.role === 'witch' && view.witch && !view.witch.done) {
      const w = view.witch;
      return [h('section.lg-panel',
        h('h3', 'Sorcière, tes potions'),
        h('p', w.victim === null ? 'Les loups n’ont désigné personne cette nuit.' : [h('b', name(w.victim)), ' est la victime des loups.']),
        h('div.lg-actions',
          w.victim !== null && w.life && !w.saved ? btn(`Sauver ${name(w.victim)}`, () => send({ type: 'save' }), { key: 'save' }) : null,
          w.death && w.poisoned === null ? btn(sel[0] ? `Empoisonner ${name(sel[0])}` : 'Poison : choisis quelqu’un', () => { send({ type: 'poison', target: sel[0] }); sel = []; }, { disabled: !sel[0], kind: 'danger', key: 'poison' }) : null,
          btn('Passer ma nuit', () => send({ type: 'pass' }), { kind: 'ghost', key: 'pass' })),
        h('p.lg-muted', `Potion de vie : ${w.life ? 'disponible' : 'utilisée'} · Potion de mort : ${w.death ? 'disponible' : 'utilisée'}`),
        w.saved ? h('p.lg-chosen', 'Tu as sauvé la victime.') : null)];
    }
    if (!view.me?.alive && view.witch) return [godPanel()];
    return [sleepPanel('La nuit touche à sa fin. Garde les yeux fermés encore un instant…')];
  }

  function godPanel() {
    const lines = [];
    if (view.phase === 'night' && view.wolves) {
      lines.push(h('li', 'Loups : ', join(view.wolves.map(name)), view.wolves.every((w) => view.wolfVotes?.[w] === undefined) ? '' : [' — ', ...view.wolves.map((w) => (view.wolfVotes?.[w] !== undefined ? `${name(w)} → ${name(view.wolfVotes[w])} ` : ''))]));
    }
    if (view.witch) lines.push(h('li', `Sorcière : potion de vie ${view.witch.life ? 'disponible' : 'utilisée'}, potion de mort ${view.witch.death ? 'disponible' : 'utilisée'}${view.witch.victim !== null ? `, victime visée : ${name(view.witch.victim)}` : ''}.`));
    if (view.lovers) lines.push(h('li', 'Amoureux : ', h('b', name(view.lovers[0])), ' et ', h('b', name(view.lovers[1])), '.'));
    return h('section.lg-panel.is-god',
      h('h3', 'Tu es mort'),
      h('p', 'Tu regardes la partie et tu vois tous les rôles. Garde le secret : ne dis rien aux vivants.'),
      lines.length ? h('ul.lg-god', lines) : null);
  }

  function dawnBlock() {
    const dawn = view.log.findLast((e) => e.k === 'dawn' && e.n === view.n);
    if (!dawn) return null;
    const shots = view.log.slice(view.log.lastIndexOf(dawn) + 1).filter((e) => e.k === 'shot' && e.n === view.n);
    const dead = dawn.dead;
    return h('div.lg-dawn',
      h('p.lg-dawn-title', dead.length ? `Cette nuit, ${dead.length > 1 ? `${dead.length} personnes sont mortes` : 'une personne est morte'}.` : 'Cette nuit, personne n’est mort.'),
      dead.length ? h('ul.lg-dawn-list', dead.map((id) => h('li', medal(view.roles[id], 40), who(id)))) : null,
      ...shots.map((e) => h('p.lg-dawn-shot', who(e.hunter, { role: false }), ' tire une dernière fois sur ', who(e.target), '.')));
  }

  function deadDayPanel() {
    const d = deadById().get(view.me.id);
    const wolves = (view.players.filter((id) => view.roles[id] === 'wolf' && isAlive(id)));
    return h('section.lg-panel.is-god',
      h('h3', 'Tu es mort'),
      h('p', `${d ? `Tu es ${CAUSE[d.cause] ?? 'mort'}`.replace('Tu es mort dans', 'Tu es mort dans').replace('Tu es a quitté la partie', 'Tu as quitté la partie') : 'Tu as quitté la partie'}. Tu vois tous les rôles : ne dis rien aux vivants.`),
      wolves.length ? h('p.lg-muted', `Loups encore en vie : ${join(wolves.map(name))}.`) : null,
      view.phase === 'debate' ? h('div.lg-actions', btn('Ouvrir le chat', () => api.openChat(), { kind: 'ghost', key: 'chat' })) : null,
      view.phase === 'debate'
        ? h('p.lg-muted', `${view.ready} sur ${view.aliveCount} prêts à voter.`)
        : h('p.lg-muted', `${view.voted} sur ${view.aliveCount} ont voté.`));
  }

  function debatePanel() {
    const me = view.me;
    const can = me?.alive;
    if (me && !can) return [deadDayPanel()];
    return [h('section.lg-panel',
      h('h3', 'Le village se réveille'),
      dawnBlock(),
      can ? h('p', 'Qui se comporte bizarrement ? On en parle dans le chat de la partie.') : null,
      h('div.lg-actions',
        btn('Ouvrir le chat', () => api.openChat(), { kind: 'ghost', key: 'chat' }),
        can ? btn(me.ready ? 'Prêt, on attend les autres' : 'Je suis prêt à voter', () => send({ type: 'ready' }), { disabled: me.ready, key: 'ready' }) : null),
      h('p.lg-muted', `${view.ready} sur ${view.aliveCount} prêts. Le vote commence quand tout le monde l’est.`),
      null)];
  }

  function votePanel() {
    const me = view.me;
    const mine = me?.vote;
    if (me && !me.alive) return [deadDayPanel()];
    return [h('section.lg-panel',
      h('h3', 'Le vote du village'),
      me?.alive
        ? h('p', mine === undefined ? 'Touche le joueur que tu soupçonnes. Tu peux changer d’avis.' : mine === null ? 'Tu as voté blanc.' : ['Tu votes contre ', h('b', name(mine)), '.'])
        : h('p', 'Le village vote. Tu es mort ou tu regardes : ta voix ne compte pas.'),
      me?.alive ? h('div.lg-actions', btn('Voter blanc', () => send({ type: 'vote', target: null }), { kind: 'ghost', key: 'blank' })) : null,
      h('p.lg-muted', `${view.voted} sur ${view.aliveCount} ont voté. Égalité : personne n’est éliminé.`))];
  }

  function hunterPanel() {
    const me = view.me;
    if (me && view.hunter === me.id) {
      return [h('section.lg-panel',
        h('h3', 'Dernier tir du Chasseur'),
        h('p', 'Tu es mort, mais pas encore tout à fait : emporte quelqu’un avec toi.'),
        h('div.lg-actions',
          btn(sel[0] ? `Tirer sur ${name(sel[0])}` : 'Choisis ta cible', () => { send({ type: 'shoot', target: sel[0] }); sel = []; }, { disabled: !sel[0], kind: 'danger', key: 'shoot' }),
          btn('Ne pas tirer', () => send({ type: 'pass' }), { kind: 'ghost', key: 'pass' })))];
    }
    return [h('section.lg-panel', h('h3', 'Le Chasseur vise…'), h('p', [h('b', name(view.hunter)), ' est mort, mais il a encore une cartouche.']))];
  }

  // Confettis de victoire : de la décoration, coupée avec prefers-reduced-motion (voir le CSS).
  function confetti() {
    const colors = ['#FFE14D', '#FF4D7A', '#2FE0B0', '#A978FF', '#FFA63D', '#5CC8FF'];
    return h('div.lg-confetti', { 'aria-hidden': 'true' }, Array.from({ length: 36 }, (_, i) => h('i', {
      style: `--x:${(i * 29) % 100}%;--d:${(i % 7) * 0.25}s;--t:${2.6 + (i % 5) * 0.4}s;--c:${colors[i % colors.length]};--r:${(i * 47) % 360}deg`,
    })));
  }

  function overPanel() {
    const w = view.winner;
    const meWon = view.me && w.ids.includes(view.me.id);
    const titles = { village: 'Le village a gagné !', wolves: 'Les loups ont gagné !', lovers: 'Les amoureux gagnent !', none: 'Personne ne survit…' };
    const subs = {
      village: 'Tous les loups sont tombés. Le jour se lève sur un village sauvé.',
      wolves: 'Les loups sont maintenant aussi nombreux que les autres. La nuit leur appartient.',
      lovers: 'Un loup et un villageois, unis contre tous : ils restent seuls, ensemble.',
      none: 'Le village est désert.',
    };
    const byRole = ['wolf', 'seer', 'witch', 'hunter', 'cupid', 'villager'];
    const order = [...view.players].sort((a, b) => byRole.indexOf(view.roles[a]) - byRole.indexOf(view.roles[b]));
    return [h('section.lg-panel.is-over',
      !view.me || meWon ? confetti() : null,
      h('h3', titles[w.side]),
      h('p', subs[w.side]),
      view.me ? h('p.lg-result', meWon ? 'Tu fais partie des gagnants.' : 'Tu as perdu cette fois.') : null,
      h('ul.lg-reveal', order.map((id) => h('li', { class: `${w.ids.includes(id) ? 'is-win' : ''}${isAlive(id) ? '' : ' is-dead'}` },
        medal(view.roles[id], 40),
        h('span.lg-reveal-text', h('b', name(id), view.lovers?.includes(id) ? heart('amoureux') : null), h('span', roleName(view.roles[id]))),
        w.ids.includes(id) ? h('span.lg-win-tag', 'Gagnant') : null))))];
  }

  function panel() {
    switch (view.phase) {
      case 'night': return nightPanel();
      case 'witch': return witchPanel();
      case 'hunter': return hunterPanel();
      case 'debate': return debatePanel();
      case 'vote': return votePanel();
      default: return overPanel();
    }
  }

  // ——— En-tête ———
  function headInfo() {
    const n = view.n;
    switch (view.phase) {
      case 'night': return { kicker: `Nuit ${n}`, title: 'La nuit tombe' };
      case 'witch': return { kicker: `Nuit ${n}`, title: 'La nuit s’achève' };
      case 'hunter': return { kicker: `Jour ${n}`, title: 'Le Chasseur tire' };
      case 'debate': return { kicker: `Jour ${n}`, title: 'Le débat' };
      case 'vote': return { kicker: `Jour ${n}`, title: 'Le vote' };
      default: return { kicker: 'Fin de partie', title: { village: 'Victoire du village', wolves: 'Victoire des loups', lovers: 'Victoire des amoureux', none: 'Personne ne gagne' }[view.winner.side] };
    }
  }

  function renderHead() {
    const { kicker, title } = headInfo();
    const me = view.me;
    head.replaceChildren(
      h('div.lg-title', h('p.lg-kicker', kicker), h('h2', title)),
      timer,
      me && api.hidesSecrets?.() ? h('button.lg-chip', { type: 'button', onclick: () => openCard(false), 'aria-label': 'Voir ma carte', dataset: { key: 'chip' } },
        h('span', h('small', me.alive ? 'Ta carte' : 'Ta carte (mort)'), 'Voir')) // le rôle n'est pas écrit : un voisin le lirait
        : me ? h('button.lg-chip', { type: 'button', onclick: () => openCard(false), 'aria-label': `Ma carte : ${roleName(me.role)}`, dataset: { key: 'chip' } },
          medal(me.role, 36), h('span', h('small', me.alive ? 'Ta carte' : 'Ta carte (mort)'), roleName(me.role))) : h('p.lg-chip.is-watch', 'Spectateur'),
    );
  }

  // ——— Carte de rôle (révélation au début, puis à la demande) ———
  function openCard(first) {
    cardOpen = true;
    cardFirst = first;
    renderOverlay();
  }

  function closeCard(auto = false) {
    if (cardFirst && view?.me) try { sessionStorage.setItem(cardKey(), '1'); } catch { /* stockage indisponible : la carte se réaffichera */ }
    cardOpen = false;
    renderOverlay();
    if (!auto) app.querySelector('[data-key="chip"]')?.focus(); // fermée toute seule : on ne vole pas le focus
  }

  const seenCard = () => { try { return Boolean(sessionStorage.getItem(cardKey())); } catch { return false; } };
  const cardKey = () => `lg-card:${view.me.id}:${view.players.join('.')}:${view.me.role}`;

  function renderOverlay() {
    if (!cardOpen || !view?.me) {
      overlay.hidden = true;
      overlay.replaceChildren();
      return;
    }
    const r = ROLES[view.me.role];
    const plural = { wolf: 'Loups-garous', villager: 'Villageois' };
    const comp = Object.entries(view.comp).map(([k, v]) => `${v} ${v > 1 && plural[k] ? plural[k] : ROLES[k].name}`);
    overlay.hidden = false;
    overlay.replaceChildren(h('div.lg-card-wrap', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ta carte' },
      api.secret([ // en classe, sur ordinateur : la carte reste cachée tant qu'on ne maintient pas le clic
        h('article.lg-card', { style: `--rc:${r.color}` },
          h('p.lg-card-kicker', cardFirst ? 'Tu es…' : 'Ta carte'),
          h('div.lg-card-art', medal(view.me.role, 168)),
          h('h3', r.name),
          h('p.lg-card-line', r.line),
          h('p.lg-card-team', `Tu joues pour ${r.team}.`)),
        view.me.role === 'wolf' && view.wolves?.length > 1 ? h('p.lg-card-note', `Ta meute : ${join(view.wolves.filter((x) => x !== view.me.id).map(name))}.`) : null,
      ], { label: 'ton rôle' }),
      h('p.lg-card-note', `Dans ce village : ${join(comp)}.`),
      h('button.lg-btn.primary', { type: 'button', onclick: () => closeCard(), dataset: { key: 'card-ok' } }, cardFirst ? 'J’ai compris' : 'Fermer')));
    overlay.querySelector('[data-key="card-ok"]').focus();
  }

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCard();
    if (e.key === 'Tab') {
      e.preventDefault();
      overlay.querySelector('[data-key="card-ok"]')?.focus();
    }
  });

  // ——— Rendu général ———
  function render() {
    if (!view) return;
    const focused = document.activeElement?.closest?.('[data-key]')?.dataset.key;
    const key = `${view.phase}:${view.n}:${view.hunter ?? ''}`;
    const fresh = key !== phaseKey;
    if (fresh) {
      phaseKey = key;
      sel = [];
      if (cardOpen) closeCard(true); // la phase change (ex. nuit 1 -> Sorcière) : la carte ne doit pas recouvrir l'écran suivant
      const { kicker, title } = headInfo();
      const dawn = view.phase === 'debate' ? view.log.findLast((e) => e.k === 'dawn' && e.n === view.n) : null;
      live.textContent = `${kicker} : ${title}.${dawn ? (dawn.dead.length ? ` Morts : ${join(dawn.dead.map((id) => `${name(id)}, ${roleName(view.roles[id])}`))}.` : ' Personne n’est mort.') : ''}`;
    }
    let tone = TONES[view.phase];
    if (!tone) tone = { village: 'day', wolves: 'blood', lovers: 'dusk', none: 'night' }[view.winner.side];
    app.dataset.tone = tone;
    app.dataset.moon = String(Math.min(view.n, 4)); // la lune grossit de nuit en nuit, pleine à la 4e
    const tgt = targeting();
    renderHead();
    body.className = `lg-body${fresh ? ' is-fresh' : ''}`;
    body.replaceChildren(
      h('div.lg-main', ...panel().filter(Boolean)),
      h('div.lg-side', village(tgt), journal()));
    body.classList.toggle('is-pick-first', Boolean(tgt?.instant));
    tick();
    if (!cardOpen && view.me && view.phase === 'night' && view.n === 1 && !seenCard()) openCard(true);
    else if (cardOpen) renderOverlay();
    if (focused && !cardOpen) app.querySelector(`[data-key="${focused}"]`)?.focus({ preventScroll: true });
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
