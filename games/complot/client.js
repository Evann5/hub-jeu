// Complot côté navigateur : dark fantasy de jeu vidéo, cartes de personnages illustrées à plat, violet profond et or lumineux.
// view() donne mes cartes, les cartes retournées de tous et le journal ; jamais les cartes cachées des autres.

const SVG = 'http://www.w3.org/2000/svg';

const CHARS = {
  doge: { name: 'Le Doge', the: 'le Doge', power: 'Taxe : +3 pièces', block: 'Contre l’aide étrangère' },
  lame: { name: 'La Lame', the: 'la Lame', power: 'Assassinat : −3 pièces', block: '' },
  courtisane: { name: 'La Courtisane', the: 'la Courtisane', power: '', block: 'Contre l’assassinat' },
  condottiere: { name: 'Le Condottiere', the: 'le Condottiere', power: 'Vol : 2 pièces', block: 'Contre le vol' },
  emissaire: { name: 'L’Émissaire', the: 'l’Émissaire', power: 'Échange de cartes', block: 'Contre le vol' },
};

const ACTS = [
  { type: 'income', label: 'Revenu', sub: '+1 pièce' },
  { type: 'aid', label: 'Aide étrangère', sub: '+2 pièces, le Doge peut la contrer' },
  { type: 'tax', label: 'Taxe', sub: '+3 pièces', claim: 'doge' },
  { type: 'steal', label: 'Vol', sub: '+2 pièces volées', claim: 'condottiere', target: true },
  { type: 'exchange', label: 'Échange', sub: 'pioche et garde', claim: 'emissaire' },
  { type: 'assassinate', label: 'Assassinat', sub: '−3 pièces, une influence', claim: 'lame', target: true, cost: 3 },
  { type: 'coup', label: 'Coup d’État', sub: '−7 pièces, une influence', target: true, cost: 7 },
];
const ACT_NAME = { income: 'le Revenu', aid: 'l’Aide étrangère', tax: 'la Taxe', steal: 'le Vol', exchange: 'l’Échange', assassinate: 'l’Assassinat', coup: 'le Coup d’État' };

// Illustrations à plat : un buste et un accessoire par personnage (constantes, aucune donnée dedans).
const FACE = '<ellipse cx="60" cy="74" rx="19" ry="22" fill="#F2C9A5"/><circle cx="53" cy="73" r="2.2" fill="#1A0F33"/><circle cx="67" cy="73" r="2.2" fill="#1A0F33"/><path d="M54 84q6 5 12 0" fill="none" stroke="#1A0F33" stroke-width="2" stroke-linecap="round"/>';
const ART = {
  doge: '<circle cx="60" cy="70" r="52" fill="#FFC83D" opacity="0.18"/>'
    + '<path d="M8 152c0-34 24-50 52-50s52 16 52 50z" fill="#E0245E"/><path d="M36 104l24 26 24-26" fill="none" stroke="#FFC83D" stroke-width="6" stroke-linejoin="round"/>'
    + '<rect x="52" y="92" width="16" height="14" fill="#E0AB86"/>' + FACE
    + '<path d="M41 80c1 24 37 24 38 0-6 10-32 10-38 0z" fill="#F4F0FF"/>'
    + '<path d="M40 62c0-22 12-34 28-46 6 14 12 28 12 46z" fill="#FFC83D"/><rect x="38" y="58" width="44" height="10" rx="5" fill="#FF9F1C"/>'
    + '<circle cx="60" cy="63" r="3.5" fill="#E0245E"/>',
  lame: '<circle cx="60" cy="70" r="52" fill="#FF3B6B" opacity="0.16"/>'
    + '<path d="M8 152c0-34 24-48 52-48s52 14 52 48z" fill="#2A1A55"/>'
    + '<path d="M26 108C18 56 38 24 60 24s42 32 34 84z" fill="#171034"/>'
    + '<ellipse cx="60" cy="72" rx="20" ry="24" fill="#07030F"/>'
    + '<path d="M47 70l10 3-10 3z" fill="#FF3B6B"/><path d="M73 70l-10 3 10 3z" fill="#FF3B6B"/>'
    + '<path d="M96 132l12-52 8 52z" fill="#E9E6FF"/><rect x="92" y="130" width="28" height="7" rx="3" fill="#FFC83D"/><rect x="102" y="137" width="8" height="14" rx="3" fill="#FF3B6B"/>',
  courtisane: '<circle cx="60" cy="70" r="52" fill="#FF5FD2" opacity="0.18"/>'
    + '<path d="M8 152c0-34 24-50 52-50s52 16 52 50z" fill="#B0208F"/><path d="M30 112q30 18 60 0" fill="none" stroke="#FFC83D" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 9"/>'
    + '<rect x="52" y="92" width="16" height="14" fill="#E0AB86"/>'
    + '<ellipse cx="60" cy="50" rx="30" ry="24" fill="#FF5FD2"/><circle cx="36" cy="40" r="9" fill="#FF5FD2"/><circle cx="84" cy="40" r="9" fill="#FF5FD2"/>'
    + FACE
    + '<path d="M40 66c4-12 36-12 40 0-8-4-32-4-40 0z" fill="#FF5FD2"/><circle cx="60" cy="30" r="5" fill="#FFC83D"/>'
    + '<path d="M82 144l14-40a34 34 0 0 1 22 40z" fill="#FFC83D"/><path d="M96 104l-8 40M104 108l-4 36M112 114l-2 30" stroke="#B0208F" stroke-width="1.6"/>',
  condottiere: '<circle cx="60" cy="70" r="52" fill="#5C7CFF" opacity="0.2"/>'
    + '<path d="M8 152c0-34 24-50 52-50s52 16 52 50z" fill="#5C7CFF"/><path d="M14 124q12-18 28-14l-6 22zM106 124q-12-18-28-14l6 22z" fill="#9DB0FF"/>'
    + '<rect x="52" y="92" width="16" height="14" fill="#E0AB86"/>' + FACE
    + '<path d="M38 70C34 30 86 30 82 70l-8-4H46z" fill="#9DB0FF"/><rect x="56" y="48" width="8" height="24" fill="#5C7CFF"/>'
    + '<path d="M60 34C46 8 80 2 90 28c-8-6-18-4-30 6z" fill="#FF3B6B"/>'
    + '<circle cx="30" cy="132" r="4" fill="#FFC83D"/><circle cx="90" cy="132" r="4" fill="#FFC83D"/>',
  emissaire: '<circle cx="60" cy="70" r="52" fill="#19D3B0" opacity="0.18"/>'
    + '<path d="M8 152c0-34 24-50 52-50s52 16 52 50z" fill="#0E8F7B"/><path d="M60 104v48" stroke="#19D3B0" stroke-width="5"/>'
    + '<rect x="52" y="92" width="16" height="14" fill="#E0AB86"/>' + FACE
    + '<path d="M36 64c2-24 46-24 48 0z" fill="#19D3B0"/><ellipse cx="60" cy="42" rx="26" ry="9" fill="#19D3B0"/><path d="M82 40c10-8 16-22 14-30-10 6-16 16-18 28z" fill="#FFC83D"/>'
    + '<rect x="80" y="108" width="30" height="38" rx="7" fill="#F4F0FF" transform="rotate(12 95 127)"/>'
    + '<path d="M86 118h18M85 126h18M84 134h12" stroke="#7A5CFF" stroke-width="2.4" stroke-linecap="round" transform="rotate(12 95 127)"/>'
    + '<path d="M100 144l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z" fill="#FFC83D"/>',
  back: '<circle cx="60" cy="75" r="40" fill="#8A4DFF" opacity="0.25"/>'
    + '<path d="M60 20l12 26 28-4-18 22 18 22-28-4-12 26-12-26-28 4 18-22-18-22 28 4z" fill="none" stroke="#FFC83D" stroke-width="3" stroke-linejoin="round"/>'
    + '<path d="M36 92l8-24 16 14 16-14 8 24z" fill="#FFC83D"/><circle cx="36" cy="64" r="4" fill="#FFC83D"/><circle cx="84" cy="64" r="4" fill="#FFC83D"/><circle cx="60" cy="56" r="4" fill="#FFC83D"/>',
};
const SKIN = { doge: ['#6B1FD6', '#2A0C5E'], lame: ['#3A1F7A', '#120A2A'], courtisane: ['#8A2BB0', '#35104F'], condottiere: ['#2E48C9', '#14185A'], emissaire: ['#0F8C86', '#0B2F4A'], back: ['#3B1790', '#150838'] };
const CONFETTI = ['#FFC83D', '#8A4DFF', '#FF5FD2', '#19D3B0', '#5C7CFF'];

function art(kind) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 120 150');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.innerHTML = ART[kind];
  return svg;
}

function coinIcon() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<circle cx="12" cy="12" r="10" fill="#FFC83D" stroke="#B26A00" stroke-width="2"/><circle cx="12" cy="12" r="6" fill="none" stroke="#FF9F1C" stroke-width="2"/>';
  return svg;
}

export function mount(root, api) {
  const { h } = api;
  const el = h('div.cp');
  root.append(el);
  let v = null;
  let info = null;
  let picking = null; // action à cible en attente du choix de la cible
  let sel = new Set(); // cartes retenues pour l'échange
  let selTurn = -1;
  let span = 0;
  let lastDeadline = null;
  let confettiShown = false;

  const me = api.me.id;
  const pseudo = (id) => api.user(id).pseudo;
  const name = (id) => (id === me ? 'Toi' : pseudo(id));
  const canAct = () => info.turn.includes(me);
  const send = (action) => api.sendMove(action).catch(() => {});
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  const alive = (id) => v.p[id].alive;

  // ——— Cartes ———

  // Une carte de personnage : face visible (c connu) ou dos. size : lg (mes cartes), sm (adversaires).
  function card(c, { size = 'lg', up = false, shown = false, onclick, selected = false, label, key } = {}) {
    const kind = c ?? 'back';
    const [c1, c2] = SKIN[kind];
    const tag = onclick ? 'button' : 'div';
    const node = h(`${tag}.cp-card.is-${size}${kind === 'back' ? '.is-back' : ''}${up ? '.is-dead' : ''}${shown ? '.is-shown' : ''}${selected ? '.is-selected' : ''}`, {
      type: onclick ? 'button' : null,
      style: `--c1:${c1};--c2:${c2}`,
      onclick,
      role: onclick ? null : 'img',
      'aria-label': label,
      'aria-pressed': key?.startsWith('sel-') ? String(selected) : null,
      dataset: key ? { key } : null,
    }, art(kind),
    kind !== 'back' && size === 'lg' ? h('span.cp-card-name', CHARS[kind].name) : null,
    kind !== 'back' && size === 'lg' ? h('span.cp-card-power', CHARS[kind].power || CHARS[kind].block) : null,
    kind !== 'back' && size === 'sm' ? h('span.cp-card-mini', CHARS[kind].name.replace(/^(Le |La |L’)/, '')) : null,
    up ? h('span.cp-card-lost', 'perdue') : null);
    return node;
  }

  function coins(n) {
    return h('span.cp-coins', { 'aria-label': plural(n, 'pièce', 'pièces') }, coinIcon(), h('b', String(n)));
  }

  // ——— Minuteur ———

  function timer() {
    return h('div.cp-time', { 'aria-hidden': 'true' }, h('span.cp-clock'), h('div.cp-bar', h('i')));
  }
  function tick() {
    const box = el.querySelector('.cp-time');
    if (!box) return;
    if (!v?.deadline) { box.hidden = true; return; }
    box.hidden = false;
    const left = Math.max(0, v.deadline - api.now());
    const s = Math.ceil(left / 1000);
    box.querySelector('.cp-clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    box.querySelector('.cp-bar i').style.width = `${span ? Math.min(100, (left / span) * 100) : 0}%`;
    box.classList.toggle('is-low', s <= 5);
  }
  const clock = setInterval(tick, 250);

  // ——— Adversaires ———

  function seat(id) {
    const q = v.p[id];
    const waiting = v.win && v.win.who.includes(id) && !v.win.passed.includes(id) && ['challenge', 'block', 'blockChallenge'].includes(v.phase);
    const isActor = v.phase === 'action' && v.actor === id;
    const losing = v.phase === 'lose' && v.lose.player === id;
    const target = v.act?.target === id;
    const tags = [];
    if (!q.alive) tags.push(h('span.cp-tag.is-out', q.left ? 'a quitté' : 'éliminé'));
    if (isActor) tags.push(h('span.cp-tag.is-hot', 'joue'));
    if (waiting) tags.push(h('span.cp-tag.is-wait', 'réagit'));
    if (losing) tags.push(h('span.cp-tag.is-hot', 'choisit sa perte'));
    if (target && v.phase !== 'action') tags.push(h('span.cp-tag.is-target', 'cible'));
    if (v.block?.by === id) tags.push(h('span.cp-tag.is-block', `contre : ${CHARS[v.block.char].name}`));
    if (v.phase === 'over' && v.winner === id) tags.push(h('span.cp-tag.is-win', 'gagne'));
    return h(`li.cp-seat${isActor || losing ? '.is-turn' : ''}${waiting ? '.is-wait' : ''}${!q.alive ? '.is-out' : ''}${target && v.phase !== 'action' ? '.is-target' : ''}`,
      h('div.cp-seat-top', api.token(api.user(id), { size: 's' }), h('span.cp-name', pseudo(id)), coins(q.coins)),
      h('div.cp-seat-cards', q.cards.length
        ? q.cards.map((c, i) => card(c.c, { size: 'sm', up: c.up, shown: v.phase === 'over' && !c.up && c.c !== null, label: c.up ? `Influence perdue : ${CHARS[c.c].name}` : `Carte cachée ${i + 1}` }))
        : h('span.cp-gone', 'plus de cartes')),
      tags.length ? h('div.cp-tags', tags) : null);
  }

  // ——— Bandeau et scène ———

  function actionText(a) {
    const t = a.target !== null && a.target !== undefined ? ` sur ${name(a.target)}` : '';
    return `${ACT_NAME[a.type]}${t}`;
  }

  // Pourquoi une influence est perdue : le doute qui a tranché, ou l'attaque reçue.
  function loseWhy() {
    const e = v.log[v.log.length - 1];
    if (!e) return '';
    if (e.t === 'reveal') {
      const who = e.who === me ? 'Tu' : pseudo(e.who);
      const had = e.who === me ? 'avais' : 'avait';
      return e.ok ? `${who} ${had} bien ${CHARS[e.char].the} : le doute était faux.` : `${who} n${e.who === me ? '’avais' : '’avait'} pas ${CHARS[e.char].the} : bluff découvert.`;
    }
    if (e.t === 'declare' && (e.action === 'coup' || e.action === 'assassinate')) return `${pseudo(e.by)} utilise ${ACT_NAME[e.action]}.`;
    return '';
  }

  function banner() {
    const a = v.act;
    const waitNames = v.win ? v.win.who.filter((id) => !v.win.passed.includes(id)).map(pseudo) : [];
    switch (v.phase) {
      case 'action':
        if (v.actor === me) return v.mustCoup ? ['À toi : coup d’État obligatoire.', 'Tu as 10 pièces ou plus.'] : ['À toi de jouer.', 'Choisis une action. Tu peux bluffer.'];
        return [`${pseudo(v.actor)} choisit son action…`, 'Tu pourras réagir si elle te vise ou te semble fausse.'];
      case 'challenge': {
        const claim = CHARS[a.claim].the;
        return canAct()
          ? [`${name(a.by) === 'Toi' ? 'Tu' : pseudo(a.by)} annonce ${claim}.`, 'Tu le crois ? Mets en doute, ou laisse passer.']
          : [`${a.by === me ? 'Tu annonces' : `${pseudo(a.by)} annonce`} ${claim}.`, `En attente de : ${waitNames.join(', ') || '…'}`];
      }
      case 'block':
        return canAct()
          ? [`${pseudo(a.by)} tente ${actionText(a)}.`, 'Tu peux contrer, ou laisser passer.']
          : [`${a.by === me ? 'Ton action peut être contrée' : `${pseudo(a.by)} tente ${actionText(a)}`}.`, `En attente de : ${waitNames.join(', ') || '…'}`];
      case 'blockChallenge':
        return canAct()
          ? [`${pseudo(v.block.by)} contre avec ${CHARS[v.block.char].the}.`, 'Il bluffe peut-être : mets en doute, ou laisse passer.']
          : [`${name(v.block.by) === 'Toi' ? 'Tu contres' : `${pseudo(v.block.by)} contre`} avec ${CHARS[v.block.char].the}.`, `En attente de : ${waitNames.join(', ') || '…'}`];
      case 'lose': {
        const why = loseWhy();
        return v.lose.player === me
          ? ['Tu perds une influence.', `${why} Touche la carte que tu abandonnes.`.trim()]
          : [`${pseudo(v.lose.player)} perd une influence…`, why || 'Il choisit la carte à retourner.'];
      }
      case 'exchange':
        return v.actor === me || a.by === me
          ? ['Échange : choisis tes cartes.', `Retiens ${plural(v.exch?.keep ?? 0, 'carte', 'cartes')} parmi ${v.exch?.options.length ?? 0}.`]
          : [`${pseudo(a.by)} regarde la pioche…`, 'Il échange des cartes.'];
      case 'over':
        return [v.winner === me ? 'Tu règnes sur la cour !' : `${pseudo(v.winner)} règne sur la cour !`, 'Dernier courtisan encore influent.'];
      default:
        return ['', ''];
    }
  }

  // ——— Actions ———

  function actionPanel() {
    const q = v.p[me];
    if (v.me === null) return h('p.cp-note', 'Tu regardes la partie.');
    if (!q.alive) return h('p.cp-note', 'Tu es éliminé : tu regardes la fin de la partie.');
    if (v.phase === 'over' || !canAct()) return null;
    const a = v.act;

    if (v.phase === 'action') {
      if (picking) {
        const def = ACTS.find((x) => x.type === picking);
        const targets = v.order.filter((id) => id !== me && alive(id) && !(picking === 'steal' && v.p[id].coins === 0));
        return h('div.cp-panel',
          h('p.cp-label', `${def.label} : choisis une cible`),
          h('div.cp-targets', targets.map((id) => h('button.cp-target', {
            type: 'button', dataset: { key: `t-${id}` },
            onclick: () => { picking = null; send({ type: def.type, target: id }); },
          }, api.token(api.user(id), { size: 's' }), h('span', pseudo(id)), coins(v.p[id].coins)))),
          h('button.cp-btn.is-ghost', { type: 'button', onclick: () => { picking = null; render(); } }, 'Annuler'));
      }
      return h('div.cp-panel', { role: 'group', 'aria-label': 'Ton action' },
        h('div.cp-acts', ACTS.map((d) => {
          const noCoins = q.coins < (d.cost ?? 0);
          const forced = v.mustCoup && d.type !== 'coup';
          const noTarget = d.target && !v.order.some((id) => id !== me && alive(id) && !(d.type === 'steal' && v.p[id].coins === 0));
          const disabled = noCoins || forced || noTarget;
          const why = forced ? 'Coup d’État obligatoire' : noCoins ? `Il te faut ${d.cost} pièces` : noTarget ? 'Personne à viser' : d.sub;
          return h(`button.cp-act${d.claim ? '.is-claim' : ''}`, {
            type: 'button', disabled, dataset: { key: `a-${d.type}` },
            style: d.claim ? `--c1:${SKIN[d.claim][0]}` : null,
            onclick: () => (d.target ? ((picking = d.type), render()) : send({ type: d.type })),
          },
          d.claim ? h('span.cp-act-face', { 'aria-hidden': 'true', style: `--c1:${SKIN[d.claim][0]};--c2:${SKIN[d.claim][1]}` }, art(d.claim)) : h('span.cp-act-face.is-free', { 'aria-hidden': 'true' }, coinIcon()),
          h('span.cp-act-name', d.label),
          h('span.cp-act-sub', why),
          d.claim ? h('span.cp-act-claim', `avec ${CHARS[d.claim].the}`) : h('span.cp-act-claim.is-free', 'sans bluff'));
        })));
    }

    if (v.phase === 'challenge' || v.phase === 'blockChallenge') {
      return h('div.cp-panel.cp-react',
        h('button.cp-btn.is-danger', { type: 'button', dataset: { key: 'challenge' }, onclick: () => send({ type: 'challenge' }) }, 'Mettre en doute'),
        h('button.cp-btn.is-ghost', { type: 'button', dataset: { key: 'pass' }, onclick: () => send({ type: 'pass' }) }, 'Laisser passer'));
    }

    if (v.phase === 'block') {
      const chars = a.type === 'steal' ? ['condottiere', 'emissaire'] : a.type === 'assassinate' ? ['courtisane'] : ['doge'];
      return h('div.cp-panel.cp-react',
        chars.map((c) => h('button.cp-btn.is-main', { type: 'button', dataset: { key: `b-${c}` }, onclick: () => send({ type: 'block', char: c }) }, `Contrer avec ${CHARS[c].the}`)),
        h('button.cp-btn.is-ghost', { type: 'button', dataset: { key: 'pass' }, onclick: () => send({ type: 'pass' }) }, 'Laisser passer'));
    }

    if (v.phase === 'lose') {
      return h('p.cp-note', 'Touche une de tes cartes cachées pour la perdre.');
    }

    if (v.phase === 'exchange' && v.exch) {
      const ok = sel.size === v.exch.keep;
      return h('div.cp-panel',
        h('p.cp-label', `Garde ${plural(v.exch.keep, 'carte', 'cartes')} (${sel.size}/${v.exch.keep})`),
        h('div.cp-options', v.exch.options.map((c, i) => card(c, {
          size: 'lg', selected: sel.has(i), key: `sel-${i}`,
          label: `${CHARS[c].name}${sel.has(i) ? ', retenue' : ''}`,
          onclick: () => {
            if (sel.has(i)) sel.delete(i);
            else if (sel.size < v.exch.keep) sel.add(i);
            render();
          },
        }))),
        h('button.cp-btn.is-main', { type: 'button', disabled: !ok, dataset: { key: 'keep' }, onclick: () => send({ type: 'keep', keep: [...sel].sort((x, y) => x - y) }) }, 'Garder ces cartes'));
    }
    return null;
  }

  // ——— Mes cartes ———

  function myCards() {
    if (v.me === null) return null;
    const q = v.p[me];
    const losing = v.phase === 'lose' && v.lose.player === me;
    return h('section.cp-mine', { 'aria-label': 'Tes cartes' },
      h('div.cp-mine-top', h('h3', 'Tes influences'), coins(q.coins)),
      // En classe, sur ordinateur : cachées tant qu'on ne maintient pas le clic, sauf quand il faut en choisir une à perdre.
      losing ? h('div.cp-mine-cards', q.cards.map((c, i) => (!c.up
        ? card(c.c, { size: 'lg', key: `lose-${i}`, label: `Perdre ${CHARS[c.c].name}`, onclick: () => send({ type: 'lose', card: i }) })
        : card(c.c, { size: 'lg', up: c.up, label: `${CHARS[c.c].name}, perdue` }))))
        : v.phase === 'over' || q.cards.every((c) => c.up) // fin de partie ou éliminé : plus rien à cacher
          ? h('div.cp-mine-cards', q.cards.map((c) => card(c.c, { size: 'lg', up: c.up, label: c.up ? `${CHARS[c.c].name}, perdue` : CHARS[c.c].name })))
          : api.secret(h('div.cp-mine-cards', q.cards.map((c) => card(c.c, { size: 'lg', up: c.up, label: c.up ? `${CHARS[c.c].name}, perdue` : CHARS[c.c].name }))), { label: 'tes influences' }));
  }

  // ——— Journal ———

  function line(e) {
    const n = pseudo;
    switch (e.t) {
      case 'start': return `${n(e.who)} ouvre le bal.`;
      case 'declare': return `${n(e.by)} tente ${ACT_NAME[e.action]}${e.target !== null && e.target !== undefined ? ` sur ${n(e.target)}` : ''}.`;
      case 'challenge': return `${n(e.by)} met en doute ${e.kind === 'block' ? 'le contre de' : 'l’annonce de'} ${n(e.on)} (${CHARS[e.char].the}).`;
      case 'reveal': return e.ok ? `${n(e.who)} montre ${CHARS[e.char].the} : le doute était faux. La carte est remélangée.` : `${n(e.who)} n’avait pas ${CHARS[e.char].the} : c’était un bluff !`;
      case 'block': return `${n(e.by)} contre avec ${CHARS[e.char].the}.`;
      case 'blocked': return `L’action est contrée par ${n(e.by)}.`;
      case 'lose': return `${n(e.who)} perd une influence : ${CHARS[e.char].name}.`;
      case 'out': return `${n(e.who)} est éliminé.`;
      case 'gain': return `${n(e.who)} gagne ${plural(e.n, 'pièce', 'pièces')}.`;
      case 'stole': return `${n(e.who)} prend ${plural(e.n, 'pièce', 'pièces')} à ${n(e.target)}.`;
      case 'exchanged': return `${n(e.who)} échange ses cartes avec la pioche.`;
      case 'left': return `${n(e.who)} a quitté la partie.`;
      case 'win': return `${n(e.who)} gagne la partie.`;
      default: return '';
    }
  }

  function logBox(open) {
    return h('details.cp-log', { open },
      h('summary', 'Journal de la cour'),
      h('ol', v.log.slice(-40).reverse().map((e) => h('li', line(e)))));
  }

  function scene() {
    const a = v.act;
    if (!a || v.phase === 'over' || v.phase === 'action') return null;
    const claim = a.claim ? CHARS[a.claim] : null;
    return h('div.cp-scene',
      h('span.cp-scene-who', pseudo(a.by)),
      h('span.cp-scene-act', ACT_NAME[a.type].replace(/^(le |la |l’)/, (m) => m[0].toUpperCase() + m.slice(1))),
      a.target !== null && a.target !== undefined ? h('span.cp-scene-target', `→ ${pseudo(a.target)}`) : null,
      claim ? h('span.cp-scene-claim', `annonce ${claim.the}`) : null,
      v.block ? h('span.cp-scene-block', `contré par ${pseudo(v.block.by)} (${CHARS[v.block.char].the})`) : null);
  }

  function confetti() {
    const box = h('div.cp-confetti', { 'aria-hidden': 'true' }, Array.from({ length: 36 }, (_, i) => h('i', {
      style: `--x:${(i * 37) % 100}%;--c:${CONFETTI[i % CONFETTI.length]};--d:${(i % 9) * 0.12}s;--r:${(i * 53) % 360}deg`,
    })));
    root.append(box);
    setTimeout(() => box.remove(), 4500);
  }

  // ——— Dessin ———

  function render() {
    if (!v) return;
    const focus = document.activeElement?.closest?.('.cp') ? document.activeElement.dataset?.key : null;
    const opened = el.querySelector('.cp-log') ? el.querySelector('.cp-log').open : matchMedia('(min-width: 700px)').matches;
    const scroll = root.scrollTop;
    if (v.deadline !== lastDeadline) {
      lastDeadline = v.deadline;
      span = v.deadline ? Math.max(1000, v.deadline - api.now()) : 0;
    }
    if (!(v.phase === 'action' && v.actor === me && canAct())) picking = null;
    if (selTurn !== `${v.turnNo}-${v.phase}`) { sel = new Set(); selTurn = `${v.turnNo}-${v.phase}`; }
    const [title, sub] = banner();
    const choosingCard = v.me !== null && v.phase === 'lose' && v.lose.player === me;
    const others = v.me !== null ? [...v.order.slice(v.order.indexOf(me) + 1), ...v.order.slice(0, v.order.indexOf(me))] : v.order;
    el.replaceChildren(h('div.cp-in',
      h('header.cp-top',
        h('span.cp-turn', `Tour ${v.turnNo}`),
        h('span.cp-deck', `Pioche : ${v.deckCount}`),
        timer()),
      h('div.cp-banner', { 'aria-live': 'polite' }, h('h2', title), h('p', sub)),
      scene(),
      // Ce que je dois faire passe avant tout : sur téléphone, le panneau d'action reste sur le premier écran.
      actionPanel(),
      choosingCard ? myCards() : null,
      h('ul.cp-seats', others.map(seat)),
      choosingCard ? null : myCards(),
      logBox(opened)));
    if (v.phase === 'over' && v.winner !== null && !confettiShown) {
      confettiShown = true;
      if (api.seat < 0 || v.winner === api.me.id) confetti();
    }
    root.scrollTop = scroll;
    if (focus) el.querySelector(`[data-key="${focus}"]:not(:disabled)`)?.focus({ preventScroll: true });
    tick();
  }

  api.onState((view, i) => { v = view; info = i; render(); });

  return () => clearInterval(clock);
}
