// Même longueur d'onde côté navigateur : un studio de stream. Fond nuit, néons cyan et fuchsia, un cadran fluo en SVG
// que l'on manipule au doigt ou au clavier, une aiguille qui rebondit. Le cadran n'est jamais détruit entre deux
// affichages (sinon un glissement en cours serait coupé) : seuls ses attributs changent.

const NS = 'http://www.w3.org/2000/svg';
const W = 400;
const H = 232;
const CX = 200;
const CY = 208;
const R = 176;
const TEAM_NAMES = ['Fuchsia', 'Turquoise'];
const ZONE_COLORS = { 4: '#FF3DCB', 3: '#F6FF4D', 2: '#2EE6F6' };

const svg = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
};
const point = (deg, r) => [CX - r * Math.cos((deg * Math.PI) / 180), CY - r * Math.sin((deg * Math.PI) / 180)];
const wedge = (a, b, r) => {
  const [x1, y1] = point(Math.max(0, a), r);
  const [x2, y2] = point(Math.min(180, b), r);
  return `M${CX} ${CY} L${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
};

const ICONS = {
  lock: 'M7 10V8a5 5 0 0 1 10 0v2h1.5A1.5 1.5 0 0 1 20 11.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5v-8A1.5 1.5 0 0 1 5.5 10Zm2.5 0h5V8a2.5 2.5 0 0 0-5 0Z',
  left: 'M14.5 5 7 12l7.5 7 1.8-1.9L10.8 12l5.5-5.1Z',
  right: 'M9.5 5 17 12l-7.5 7-1.8-1.9 5.5-5.1-5.5-5.1Z',
};
const icon = (name) => svg('svg', { viewBox: '0 0 24 24', class: `on-ico is-${name}`, 'aria-hidden': 'true', focusable: 'false' }, svg('path', { d: ICONS[name] }));

function confetti(h, host, palette) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = h('div.on-confetti', { 'aria-hidden': 'true' }, Array.from({ length: 36 }, (_, i) => h(`i.c${i % palette}`, {
    style: `left:${((i * 37) % 100) + 0.5}%;animation-delay:${((i * 53) % 90) / 100}s;--dx:${((i * 29) % 60) - 30}px`,
  })));
  host.append(layer);
  setTimeout(() => layer.remove(), 4200);
}

export function mount(root, api) {
  const { h } = api;
  let v = null;
  let info = null;
  let announced = '';
  let celebrated = '';
  // Aiguille affichée en local pendant un glissement (puis un instant après, le temps que le serveur confirme).
  let localNeedle = null;
  let localUntil = 0;
  let dragging = false;
  let sendTimer = null;
  let pending = null;
  let lastSent = 0;
  let lastStamp = '';

  const name = (id) => api.user(id).pseudo;
  const isMe = (id) => id === api.me.id;
  const seated = () => info.isPlayer && !v.left.includes(api.me.id);
  const teamName = (t) => TEAM_NAMES[t];
  const myTeam = () => (v.mode === 'teams' ? v.teams[api.me.id] : null);

  // ——— Le cadran (construit une seule fois) ———
  const ticks = [];
  for (let d = 0; d <= 180; d += 5) {
    const long = d % 15 === 0;
    const [x1, y1] = point(d, R - (long ? 24 : 15));
    const [x2, y2] = point(d, R - 6);
    ticks.push(svg('line', { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1), class: long ? 'on-tick is-long' : 'on-tick' }));
  }
  const zone = svg('g', { class: 'on-zone' }, ...[2, 3, 4].map((p) => svg('path', { class: `on-wedge w${p}`, fill: ZONE_COLORS[p] })));
  const needle = svg('g', { class: 'on-needle' },
    svg('line', { x1: CX, y1: CY, x2: CX, y2: CY - R + 10, class: 'on-needle-line' }),
    svg('circle', { cx: CX, cy: CY - R + 10, r: 9, class: 'on-needle-tip' }));
  const dialSvg = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'on-svg', 'aria-hidden': 'true', focusable: 'false' },
    svg('defs', {},
      svg('linearGradient', { id: 'on-rim', x1: '0', y1: '0', x2: '1', y2: '0' },
        svg('stop', { offset: '0', 'stop-color': '#2EE6F6' }), svg('stop', { offset: '0.5', 'stop-color': '#B14DFF' }), svg('stop', { offset: '1', 'stop-color': '#FF3DCB' }))),
    svg('path', { d: `M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY} Z`, class: 'on-plate' }),
    zone,
    ...ticks,
    svg('path', { d: `M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY}`, class: 'on-rim', stroke: 'url(#on-rim)' }),
    needle,
    svg('circle', { cx: CX, cy: CY, r: 15, class: 'on-hub' }));
  const endL = h('span.on-end.is-left');
  const endR = h('span.on-end.is-right');
  const dial = h('div.on-dial', { role: 'slider', 'aria-valuemin': '0', 'aria-valuemax': '180', tabindex: '-1' }, dialSvg);

  const shownNeedle = () => (localNeedle !== null && Date.now() < localUntil ? localNeedle : v.needle);
  const canAim = () => v && v.phase === 'guess' && seated() && v.guessers.includes(api.me.id);

  // En classe, sur ordinateur : la zone secrète du meneur reste cachée tant qu'il ne maintient pas « Voir la zone ».
  let peek = false;
  const stopPeek = () => { if (peek) { peek = false; drawDial(); } };
  window.addEventListener('pointerup', stopPeek);
  window.addEventListener('blur', stopPeek);
  const peekButton = () => h('button.on-btn.on-peek', {
    type: 'button',
    onpointerdown: (e) => { e.preventDefault(); peek = true; drawDial(); },
    onkeydown: (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); peek = true; drawDial(); } },
    onkeyup: stopPeek,
    onblur: stopPeek,
  }, 'Maintiens pour voir la zone');

  function drawDial() {
    if (!v) return;
    const showNeedle = ['guess', 'bet', 'reveal'].includes(v.phase);
    const n = shownNeedle();
    needle.style.transform = `rotate(${n - 90}deg)`;
    needle.classList.toggle('is-hidden', !showNeedle);
    needle.classList.toggle('is-locked', v.phase === 'guess' && v.locks.length > 0 && v.locks.length === v.guessers.length);
    dial.classList.toggle('is-active', canAim());
    dial.classList.toggle('is-drag', dragging);
    // Zone cible : meneur pendant la manche, tout le monde à la révélation.
    const t = v.secret;
    const masked = t !== null && !['reveal', 'over'].includes(v.phase) && api.hidesSecrets?.() && !peek;
    zone.classList.toggle('is-hidden', t === null || masked);
    if (t !== null) {
      const zs = v.zones;
      [...zone.children].forEach((p, i) => {
        const half = zs[2 - i].half;
        p.setAttribute('d', wedge(t - half, t + half, R - 2));
      });
    }
    dial.setAttribute('aria-valuenow', String(n));
    dial.setAttribute('aria-valuetext', `Aiguille à ${n} degrés sur 180, entre « ${v.pair[0]} » et « ${v.pair[1]} »`);
    dial.setAttribute('aria-label', `Cadran entre ${v.pair[0]} et ${v.pair[1]}`);
    dial.setAttribute('aria-readonly', canAim() ? 'false' : 'true');
    dial.tabIndex = canAim() ? 0 : -1;
    endL.textContent = v.pair[0];
    endR.textContent = v.pair[1];
  }

  function flush() {
    sendTimer = null;
    if (pending === null) return;
    const angle = pending;
    pending = null;
    lastSent = Date.now();
    api.sendMove({ type: 'aim', angle }).catch(() => { localNeedle = null; drawDial(); });
  }
  function aim(angle) {
    const a = Math.max(0, Math.min(180, Math.round(angle)));
    localNeedle = a;
    localUntil = Date.now() + 900;
    drawDial();
    pending = a;
    if (!sendTimer) sendTimer = setTimeout(flush, Math.max(0, 110 - (Date.now() - lastSent)));
  }
  function angleFrom(e) {
    const r = dialSvg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    let a = (Math.atan2(CY - y, CX - x) * 180) / Math.PI;
    if (a < 0) a = CX - x >= 0 ? 0 : 180; // sous la ligne de base : on colle à l'extrémité la plus proche
    return a;
  }
  dial.addEventListener('pointerdown', (e) => {
    if (!canAim()) return;
    dragging = true;
    dial.setPointerCapture(e.pointerId);
    aim(angleFrom(e));
    e.preventDefault();
  });
  dial.addEventListener('pointermove', (e) => { if (dragging) aim(angleFrom(e)); });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (sendTimer) { clearTimeout(sendTimer); flush(); }
    drawDial();
    if (v) render(); // un état reçu pendant le glissement attendait
  };
  dial.addEventListener('pointerup', endDrag);
  dial.addEventListener('pointercancel', endDrag);
  dial.addEventListener('keydown', (e) => {
    if (!canAim()) return;
    const big = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown';
    const step = big ? 5 : 1;
    const n = shownNeedle();
    const keys = { ArrowLeft: n - step, ArrowDown: n - step, PageDown: n - 5, ArrowRight: n + step, ArrowUp: n + step, PageUp: n + 5, Home: 0, End: 180 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    aim(keys[e.key]);
  });

  // ——— Le reste : régions redessinées à chaque état ———
  const live = h('p.on-sr', { role: 'status', 'aria-live': 'polite' });
  const top = h('div.on-top');
  const bottom = h('div.on-bottom');
  const act = h('div.on-act');
  const clueInput = h('input', { type: 'text', maxlength: 60, autocomplete: 'off', spellcheck: false, 'aria-label': 'Ton indice', placeholder: 'Ton indice, sans chiffre…' });
  const stage = h('div.on-stage', dial, h('div.on-ends', endL, endR));
  const board = h('div.on-board', top, stage, bottom);
  const el = h('div.on', board, act);
  root.append(el, live);

  function tick() {
    for (const t of el.querySelectorAll('.on-time')) {
      if (!v.deadline) { t.textContent = ''; continue; }
      const left = Math.max(0, Math.ceil((v.deadline - api.now()) / 1000));
      t.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      t.classList.toggle('is-low', left <= 10);
    }
  }
  const clock = setInterval(tick, 250);
  const send = (action) => api.sendMove(action).catch(() => {});

  function scoreboard() {
    if (v.mode === 'coop') {
      const pct = Math.min(100, Math.round((v.scores[0] / v.target) * 100));
      return h('div.on-coop', { role: 'img', 'aria-label': `Score ${v.scores[0]} sur ${v.target}, manche ${Math.min(v.round + 1, v.maxRounds)} sur ${v.maxRounds}` },
        h('div.on-coop-row', h('b', `${v.scores[0]} / ${v.target} points`), h('span', `Manche ${Math.min(v.round + 1, v.maxRounds)} / ${v.maxRounds}`)),
        h('div.on-bar', h('i', { style: `width:${pct}%` })));
    }
    const members = (t) => v.players.filter((id) => v.teams[id] === t && !v.left.includes(id));
    return h('div.on-teams', [0, 1].map((t) => h(`div.on-team.t${t}${v.playing === t && v.phase !== 'over' ? '.is-playing' : ''}${myTeam() === t ? '.is-mine' : ''}`,
      h('span.on-team-name', teamName(t), myTeam() === t ? h('small', 'ton équipe') : null),
      h('b.on-team-score', { 'aria-label': `${v.scores[t]} point${v.scores[t] > 1 ? 's' : ''}` }, String(v.scores[t])),
      h('span.on-team-members', members(t).map((id) => `${isMe(id) ? 'toi' : name(id)}`).join(', ')))));
  }

  function topRegion() {
    const who = v.mode === 'teams' ? ` · ${teamName(v.playing)}` : '';
    const lead = isMe(v.leader) ? 'toi' : name(v.leader);
    const bits = [h('div.on-bar-top', h('span.on-chip', v.phase === 'over' ? 'Fin de partie' : `Manche ${v.round + 1}${who}`),
      v.phase === 'over' ? null : v.mode === 'teams' ? h('span.on-chip.is-goal', `Premier à ${v.target}`) : h('span.on-chip.is-live', 'En direct'), h('span.on-time', { 'aria-label': 'Temps restant' })), scoreboard()];
    if (v.mode === 'coop' && v.wantedTeams) bits.push(h('p.on-hint', 'Moins de 4 joueurs : on joue tous ensemble.'));
    if (v.phase !== 'over') {
      if (v.clue) bits.push(h('blockquote.on-clue', h('span.on-clue-label', isMe(v.leader) ? 'Ton indice' : `Indice donné par ${lead}`), v.clue));
      else bits.push(h('p.on-lead', h('span', 'Meneur'), ' ', h('b', lead)));
    }
    return bits;
  }

  function lockRow() {
    return h('ul.on-locks', { 'aria-label': 'Verrous' }, v.guessers.map((id) => h(`li${v.locks.includes(id) ? '.is-on' : ''}`,
      v.locks.includes(id) ? icon('lock') : h('i.on-wait', { 'aria-hidden': 'true' }), isMe(id) ? 'toi' : name(id), h('span.on-sr', v.locks.includes(id) ? ' a verrouillé' : ' n’a pas verrouillé'))));
  }

  // Le texte court va dans `say`, ce qui se touche dans `ctl` (collé en bas de l'écran).
  function bottomRegion() {
    const me = api.me.id;
    const say = [];
    const ctl = [];
    if (v.phase === 'clue') {
      if (isMe(v.leader) && seated()) {
        const form = h('form.on-form', h('label.on-sr', { for: 'on-clue' }, 'Ton indice'), clueInput, h('button.on-btn', { type: 'submit' }, 'Envoyer l’indice'));
        clueInput.id = 'on-clue';
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          try { await api.sendMove({ type: 'clue', text: clueInput.value }); clueInput.value = ''; } catch { /* message déjà affiché */ }
        });
        if (api.hidesSecrets?.()) ctl.push(peekButton());
        say.push(h('p.on-say', 'Toi seul vois la zone. Indice sans chiffre.'),
          h('ul.on-legend', { 'aria-label': 'Points' }, [4, 3, 2].map((p) => h(`li.p${p}`, h('i'), `${p} points`))));
        ctl.push(form);
      } else say.push(h('p.on-say', `${isMe(v.leader) ? 'Tu es' : `${name(v.leader)} est`} le meneur et cherche un indice.`));
    } else if (v.phase === 'guess') {
      const locked = v.locks.includes(me);
      if (canAim()) {
        say.push(h('p.on-say', v.locks.length ? 'Bouger l’aiguille efface les verrous.' : 'Glisse l’aiguille (ou ← →), puis verrouille.'), lockRow());
        ctl.push(h('button.on-btn', { type: 'button', dataset: { k: 'lock' }, 'aria-pressed': String(locked), onclick: () => send({ type: 'lock', on: !locked }) }, locked ? 'Déverrouiller' : 'Verrouiller l’aiguille'));
      } else {
        const mineTeam = v.mode === 'coop' || myTeam() === v.playing;
        say.push(h('p.on-say', seated() ? (isMe(v.leader) ? 'Ton équipe place l’aiguille. Ne dis rien !' : mineTeam ? 'Ton équipe place l’aiguille…' : 'L’autre équipe place l’aiguille. Tu parieras ensuite.') : 'Les joueurs placent l’aiguille.'), lockRow());
      }
    } else if (v.phase === 'bet') {
      if (seated() && v.bettors.includes(me)) {
        if (v.myBet) say.push(h('p.on-say', `Pari enregistré : ${v.myBet === 'L' ? 'plus à gauche' : 'plus à droite'}. On attend les autres…`));
        else {
          say.push(h('p.on-say', 'La zone est-elle plus à gauche ou plus à droite de l’aiguille ?'));
          ctl.push(h('div.on-row',
            h('button.on-btn.is-left', { type: 'button', dataset: { k: 'betL' }, onclick: () => send({ type: 'bet', side: 'L' }) }, icon('left'), 'À gauche'),
            h('button.on-btn.is-right', { type: 'button', dataset: { k: 'betR' }, onclick: () => send({ type: 'bet', side: 'R' }) }, 'À droite', icon('right'))));
        }
      } else say.push(h('p.on-say', `Aiguille verrouillée. L’équipe ${teamName(1 - v.playing)} parie… (${v.voted.length} / ${v.bettors.length})`));
    } else if (v.phase === 'reveal') {
      const r = v.result;
      if (r.voided) say.push(h('p.on-pts.is-zero', 'Manche annulée'), h('p.on-say', 'Pas d’indice du meneur : aucun point.'));
      else {
        say.push(h(`p.on-pts.is-p${r.points}`, r.points ? `+${r.points} point${r.points > 1 ? 's' : ''}` : 'Raté'));
        if (v.mode === 'teams') {
          const side = r.betSide === 'L' ? 'à gauche' : r.betSide === 'R' ? 'à droite' : null;
          const other = teamName(1 - r.team);
          say.push(h('p.on-say', side ? `${other} a parié ${side} : ${r.betPoints ? '+1 point, bien vu !' : r.points === 4 ? 'inutile, plein centre.' : 'raté.'}` : `${other} n’a pas parié : pas de point.`));
        }
      }
      if (v.bets && Object.keys(v.bets).length) {
        say.push(h('ul.on-bets', Object.entries(v.bets).map(([id, b]) => h('li', `${isMe(Number(id)) ? 'Toi' : name(Number(id))} : ${b === 'L' ? 'gauche' : 'droite'}`))));
      }
      const host = v.players.find((id) => !v.left.includes(id)); // l'hôte lance la suite
      if (seated() && isMe(host)) ctl.push(h('button.on-btn', { type: 'button', dataset: { k: 'next' }, onclick: () => send({ type: 'next' }) }, 'Manche suivante'));
      else if (host) say.push(h('p.on-say', `${name(host)} lance la manche suivante.`));
    } else {
      const winners = v.mode === 'coop' ? (v.scores[0] >= v.target ? 'Mission réussie !' : 'Pas assez de points cette fois…')
        : v.scores[0] === v.scores[1] ? 'Égalité parfaite !' : `${teamName(v.scores[0] > v.scores[1] ? 0 : 1)} gagne !`;
      say.push(h('p.on-pts.is-p4', winners),
        h('ol.on-recap', v.history.map((e, i) => h('li', h('b', `${i + 1}.`), ` ${e.pair[0]} ↔ ${e.pair[1]} `, h('small', e.voided ? 'annulée' : `« ${e.clue} » : ${e.points} pt${e.points > 1 ? 's' : ''}`)))));
    }
    return { say, ctl };
  }

  function render() {
    if (dragging) return; // pas de redessin pendant un glissement : il reprend à la fin
    const focus = document.activeElement;
    const focusKey = el.contains(focus) ? (focus === dial ? '#dial' : focus === clueInput ? '#clue' : focus.dataset?.k || null) : null;
    top.replaceChildren(...topRegion());
    const { say, ctl } = bottomRegion();
    bottom.replaceChildren(...say);
    act.replaceChildren(...ctl);
    const stamp = `${v.round}-${v.phase}`;
    if (stamp !== lastStamp) { lastStamp = stamp; board.scrollTop = 0; }
    stage.hidden = v.phase === 'over'; // le récapitulatif prend la place du cadran
    drawDial();
    if (focusKey) {
      const target = focusKey === '#dial' ? dial : focusKey === '#clue' ? clueInput : el.querySelector(`[data-k="${focusKey}"]:not(:disabled)`);
      target?.focus({ preventScroll: true });
    } else if (v.phase === 'clue' && isMe(v.leader) && seated() && matchMedia('(hover: hover)').matches && !document.querySelector('.table-chat :focus')) {
      clueInput.focus({ preventScroll: true });
    }
    const party = v.phase === 'reveal' && v.result.points === 4 ? `r${v.round}` : v.phase === 'over' && (v.mode === 'teams' || v.scores[0] >= v.target) ? 'over' : '';
    if (party && party !== celebrated) { celebrated = party; confetti(h, root, 4); }
    const text = liveText();
    if (text !== announced) { announced = text; live.textContent = text; }
    tick();
  }

  function liveText() {
    if (v.phase === 'clue') return isMe(v.leader) ? 'Tu es le meneur : donne un indice.' : `${name(v.leader)} cherche un indice.`;
    if (v.phase === 'guess') return canAim() ? `Indice : ${v.clue}. Place l’aiguille puis verrouille.` : `Indice : ${v.clue}. L’aiguille se règle.`;
    if (v.phase === 'bet') return 'Aiguille verrouillée. Pari : gauche ou droite ?';
    if (v.phase === 'reveal') return v.result.voided ? 'Manche annulée.' : v.result.points ? `${v.result.points} points.` : 'Raté, aucun point.';
    return 'Fin de partie.';
  }

  const off = api.onState((view, i) => {
    v = view;
    info = i;
    if (localNeedle !== null && v.needle === localNeedle) localNeedle = null;
    render();
  });

  return () => {
    clearInterval(clock);
    clearTimeout(sendTimer);
    window.removeEventListener('pointerup', stopPeek);
    window.removeEventListener('blur', stopPeek);
    off();
  };
}
