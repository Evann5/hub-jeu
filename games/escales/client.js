// Escales côté navigateur : le monde en 3D (client/scene.js), et par-dessus l'interface : les joueurs, toujours visibles ; au centre,
// seulement ce que tu as à décider, quand c'est à toi ; et les fenêtres qu'on ouvre soi-même. Les règles restent côté serveur (rules.js).
import { REGIONS, TILES, RULES, LEVEL_MULT, LEVEL_NAMES, MAX_LEVEL, ESCALE_RENTS, mortgageValue, unmortgageCost } from './client/board.js';
import { createWorld, PAWN_COLORS } from './client/scene.js';
import { FLAGS } from './client/countries.js';
import { createSound } from './client/sound.js';
import { loadSculpted } from './client/monuments.js';

const money = (n) => `${Number(n).toLocaleString('fr-FR')} €`;

const ABOUT = {
  start: 'Tu touches 200 € à chaque passage.',
  customs: 'Simple visite si tu tombes dessus. Retenu ici : fais un double ou paie 50 €. Au troisième échec, tu paies et tu avances.',
  festival: 'Tu gagnes 100 €.',
  control: 'Direction la Douane, sans passer par le Départ.',
  telex: 'Une dépêche au hasard : bonne ou mauvaise nouvelle.',
  tax: 'Impôts : 10 % de ton argent, 50 € au moins. Taxe de séjour : 100 €.',
  chantier: 'Tu paies 50 € de travaux.',
};

export function mount(root, api) {
  const { h } = api;
  let v = null;
  let info = null;
  let promptKey = null;
  let focusId = null; // le joueur dont les villes ressortent sur le plateau
  let overlay = null; // { kind: 'city', pos } | { kind: 'cities' } | { kind: 'trade' } | { kind: 'more' } | { kind: 'log' } | { kind: 'build' }
  let overlaySeen = null;
  let draft = null;
  let world = null;
  let gone = false;

  const meId = api.me.id;
  const sound = createSound();
  const before = { cash: new Map(), rollN: null, cur: null, owners: new Map(), levels: 0, over: false };
  const pageTitle = document.title;
  let confirmBankrupt = false;
  const nameOf = (id) => (id === meId ? 'Toi' : v.players.find((p) => p.id === id)?.pseudo ?? '?');
  const me = () => v.players.find((p) => p.id === meId);
  const myTurn = () => !v.over && v.players[v.cur].id === meId;

  // ——— Éléments fixes ———
  const stage = h('div.es-world');
  const players = h('div.es-players', { role: 'list', 'aria-label': 'Joueurs' });
  const round = h('span.es-round');
  const clock = h('span.es-clock', { 'aria-live': 'off' });
  const tip = h('div.es-tip', { hidden: true, 'aria-hidden': 'true' });
  const prompt = h('div.es-prompt');
  const trades = h('div.es-trades');
  const tradeLink = h('button.es-link', { type: 'button', onclick: () => openTrade() }, 'Échanger');
  const tools = h('div.es-tools',
    h('button.es-link', { type: 'button', onclick: () => openOverlay({ kind: 'cities' }) }, 'Villes'),
    tradeLink,
    h('button.es-link', { type: 'button', onclick: () => openOverlay({ kind: 'more' }) }, 'Plus'));
  const timer = h('div.es-timer', h('i'));
  const timing = h('div.es-timing', { hidden: true }, timer, clock);
  const action = h('section.es-action', { hidden: true }, timing, prompt);
  const flash = h('p.es-flash', { 'aria-live': 'polite' });
  const focusCard = h('section.es-focus', { hidden: true });
  const side = h('aside.es-side', h('div.es-panel', round, players), tools, trades, focusCard);
  const layer = h('div.es-layer');
  const loading = h('p.es-loading', 'Le plateau arrive…');
  const turnBox = h('div.es-turn', { hidden: true, 'aria-hidden': 'true' }); // le bandeau du hub et la liste des joueurs le disent déjà aux lecteurs d'écran
  // Sur téléphone, sous le plateau : où en est la partie, et le rappel que les cases se touchent.
  const under = h('p.es-under');
  const frame = h('div.es', stage, loading, tip, turnBox, under, side, flash, action, layer);
  api.gateTurn();
  root.append(frame);

  // ——— Le monde 3D. Les étiquettes des cases sont dessinées avec la police du jeu : on l'attend d'abord. ———
  // Le texte est donné exprès : les accents vietnamiens sont dans un fichier à part, qui ne se charge que si on les demande.
  const tileText = TILES.map((t) => t.short ?? t.name).join('');
  const titleText = `${REGIONS.map((r) => r.name).join('')}Escales`;
  Promise.all([document.fonts.load('800 40px "ES Barlow"', tileText), document.fonts.load('700 30px "ES Barlow"', '0123456789 €'), document.fonts.load('800 60px "ES Titres"', titleText), loadSculpted(api.asset)]).catch(() => {}).finally(() => {
    if (gone) return;
    try {
      world = createWorld(stage, {
        onStep: sound.step,
        onHover: showTip,
        onStill: () => { if (uiTimer) applyUI(); },
        onTile: (pos) => {
          openOverlay({ kind: 'city', pos });
          // Toucher une ville : les autres villes de son pays montent avec elle.
          const t = TILES[pos];
          if (t.type === 'city') world.focus({ tiles: TILES.filter((x) => x.region === t.region).map((x) => x.pos), color: REGIONS[t.region].color });
          else if (t.type === 'escale') world.focus({ tiles: TILES.filter((x) => x.type === 'escale').map((x) => x.pos), color: '#CBD5E1' });
        },
        topInset: () => Math.max(6, Math.max(players.getBoundingClientRect().bottom, tools.hidden || getComputedStyle(tools).position === 'fixed' ? 0 : tools.getBoundingClientRect().bottom) - stage.getBoundingClientRect().top + 6), // jamais négatif : à la fin de partie, le panneau disparaît sur téléphone
        rightInset: () => side.offsetWidth + 12,
        onFit: ([cx, cy], [, fy], [, oy], [, by], [, dy], [, uy]) => {
          frame.style.setProperty('--uy', `${Math.round(uy)}px`);
          // À mi-chemin entre les dés et la ligne de ce qui vient de se passer ; quand la place manque, collé sous les dés : le message peut prendre deux lignes.
          frame.style.setProperty('--ty', `${Math.round(fy - dy < 140 ? dy + 23 : (dy + fy) / 2)}px`);
          frame.style.setProperty('--tspan', `${Math.round(fy - dy)}px`);
          turnBox.classList.toggle('is-row', fy - dy < 140);
          turnBox.classList.toggle('is-tiny', fy - dy < 52);
          frame.style.setProperty('--by', `${Math.round(by)}px`);
          frame.style.setProperty('--oy', `${Math.round(oy)}px`);
          frame.style.setProperty('--cx', `${Math.round(cx)}px`);
          frame.style.setProperty('--cy', `${Math.round(cy)}px`);
          frame.style.setProperty('--fy', `${Math.round(fy)}px`);
        },
      });
      if (v) {
        world.update(v);
        renderPlayers(true); // les portraits se préparent ici, au chargement, plutôt qu'en pleine partie
        promptKey = null;
        shownTrades = null;
        renderAction();
        renderFocus();
      }
      boardReady = true;
      if (v) renderAction();
      loading.remove();
    } catch (err) {
      loading.remove();
      console.error(err);
      boardReady = true; // sans 3D, on joue quand même avec les boutons
      if (v) renderAction();
      stage.replaceChildren(h('p.es-no3d', 'Ton navigateur n’affiche pas la 3D. Tu peux quand même jouer avec les boutons et la liste des villes.'));
    }
  });

  // Une petite image rendue une fois par le monde 3D.
  function picture(image, cls = '') {
    if (!image) return null;
    const c = h(`canvas${cls}`, { width: image.width, height: image.height, 'aria-hidden': 'true' });
    c.getContext('2d').putImageData(image, 0, 0);
    return c;
  }

  // Au survol d'une case : qui la possède et ce qu'elle coûte.
  function showTip(pos, x, y) {
    if (pos === null || !v) {
      tip.hidden = true;
      return;
    }
    const t = TILES[pos];
    const prop = v.props[pos];
    const owner = prop ? v.players.find((p) => p.id === prop.owner) : null;
    const lines = [h('b', t.name)];
    const here = v.players.filter((p) => !p.out && p.pos === pos).map((p) => (p.id === meId ? 'Toi' : p.pseudo));
    if (t.price) {
      lines.push(h('span', owner
        ? `${owner.id === meId ? 'À toi' : `À ${owner.pseudo}`}${prop.mortgaged ? ', en gage' : `, loyer ${money(v.rents[pos] ?? 0)}`}`
        : `Libre, ${money(t.price)}`));
      if (prop?.level) lines.push(h('span', LEVEL_NAMES[prop.level]));
    }
    if (here.length) lines.push(h('span', `Ici : ${here.join(', ')}`));
    tip.replaceChildren(...lines);
    tip.style.borderColor = owner ? PAWN_COLORS[owner.seat] : 'transparent';
    tip.style.transform = `translate(${Math.round(x + 14)}px, ${Math.round(y + 14)}px)`;
    tip.hidden = false;
  }

  // L'argent défile jusqu'à sa nouvelle valeur plutôt que de sauter.
  const QUIET = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function numberOf(p) {
    const el = h('span.es-num');
    const target = v.over ? p.worth : p.cash;
    const old = before.cash.get(p.id);
    if (p.out) {
      el.textContent = 'Sorti';
    } else if (v.over || QUIET || old === undefined || old === target) {
      el.textContent = money(target);
    } else {
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / 550);
        const eased = 1 - (1 - t) ** 3;
        el.textContent = money(Math.round(old + (target - old) * eased));
        if (t < 1 && el.isConnected) requestAnimationFrame(step);
        else el.textContent = money(target);
      };
      el.textContent = money(old);
      requestAnimationFrame(step);
    }
    return el;
  }

  // L'argent qui bouge se voit : un petit montant s'envole à côté du joueur.
  function deltaOf(p) {
    const old = before.cash.get(p.id);
    const d = old === undefined ? 0 : p.cash - old;
    if (!d || v.over || p.out) return null;
    return h(`span.es-delta${d > 0 ? '.is-up' : '.is-down'}`, { 'aria-hidden': 'true' }, `${d > 0 ? '+' : ''}${d.toLocaleString('fr-FR')} €`);
  }

  // Chaque événement a son son.
  function playSounds() {
    const myOld = before.cash.get(meId);
    const mine = me();
    if (mine && myOld !== undefined && mine.cash !== myOld) (mine.cash > myOld ? sound.gain : sound.pay)();
    let levels = 0;
    for (const [pos, prop] of Object.entries(v.props)) {
      levels += prop.level;
      if (before.owners.size && before.owners.get(pos) !== prop.owner) sound.buy();
    }
    if (before.owners.size && levels > before.levels) sound.build();
    before.levels = levels;
    if (before.cur !== null && before.cur !== v.cur && v.players[v.cur].id === meId && !v.over) {
      sound.turn();
      navigator.vibrate?.(70); // sur téléphone, on sent que c'est à soi
    }
    document.title = !v.over && document.hidden && myTurn() ? `À toi ! ${pageTitle}` : pageTitle;
    const outNow = v.players.filter((p) => p.out).length;
    if (before.out !== undefined && outNow > before.out && !v.over) sound.fail();
    before.out = outNow;
    if (v.over && !before.over) sound.win();
    before.over = v.over;
    before.cur = v.cur;
    before.owners = new Map(Object.entries(v.props).map(([pos, prop]) => [pos, prop.owner]));
    if (!before.owners.size) before.owners.set('-', 0);
  }

  const citiesOf = (id) => {
    const n = Object.values(v.props).filter((prop) => prop.owner === id).length;
    return n ? `${n} ville${n > 1 ? 's' : ''}` : '';
  };

  let playersKey = null;
  let hoverOff = null; // le joueur qu'on vient de désélectionner : tant que la souris reste dessus, le survol ne le rallume pas
  function renderPlayers(force = false) {
    const key = JSON.stringify([v.players.map((p) => [p.id, p.cash, p.worth, p.out]), v.cur, v.over, focusId, Boolean(world), Object.values(v.props).map((x) => x.owner)]);
    if (!force && key === playersKey) return;
    playersKey = key;
    players.replaceChildren(...v.players.map((p) => {
      const dot = picture(world?.portrait(p.seat), '.es-face') ?? h('i.es-dot');
      const turn = !v.over && v.players[v.cur].id === p.id;
      const chip = h(`button.es-chip${turn ? '.is-turn' : ''}${p.out ? '.is-out' : ''}${focusId === p.id ? '.is-focus' : ''}`, { type: 'button', style: `--p:${PAWN_COLORS[p.seat]};--pi:${[1, 2].includes(p.seat) ? '#16142E' : '#FFFFFF'}`, 'aria-pressed': String(focusId === p.id), 'aria-label': `${p.id === meId ? 'Toi' : p.pseudo}${p.bot ? ', robot' : ''}, ${p.out ? 'sorti' : money(p.cash)}. Voir ses villes sur le plateau`, onclick: () => { hoverOff = focusId === p.id ? p.id : null; setFocus(focusId === p.id ? null : p.id); },
        // À la souris, survoler un joueur suffit pour voir ses villes ; le clic garde la sélection.
        onmouseenter: () => { if (focusId === null && !overlay && hoverOff !== p.id) world?.focus({ player: p.id }); },
        onmouseleave: () => { hoverOff = null; if (!overlay) restoreFocus(); } },
        dot,
        h('span.es-pseudo', p.id === meId ? 'Toi' : p.pseudo, h('small', citiesOf(p.id))),
        h('span.es-cash', numberOf(p), deltaOf(p)));
      return h('div', { role: 'listitem' }, chip);
    }));
    root.style.setProperty('--rows', String(Math.ceil(v.players.length / 2)));
  }

  // ——— Au centre : ce que tu as à décider ———
  const flagOf = (region) => {
    const c = h('canvas.es-flag', { width: 90, height: 60, 'aria-hidden': 'true' });
    FLAGS[REGIONS[region].id](c.getContext('2d'), 0, 0, 90, 60);
    return c;
  };
  // La ville à acheter : son monument, son nom, son loyer, où tu en es dans ce pays et ce qu'il te restera. Le reste est dans sa fiche, d'un clic.
  function offer(pos) {
    const t = TILES[pos];
    const isCity = t.type === 'city';
    const group = TILES.filter((x) => (isCity ? x.region === t.region : x.type === 'escale'));
    const mine = group.filter((x) => v.props[x.pos]?.owner === meId).length;
    const pips = group.map((x) => {
      const owner = v.props[x.pos] ? v.players.find((p) => p.id === v.props[x.pos].owner) : null;
      const pip = h(`i${x.pos === pos ? '.is-this' : ''}`);
      if (owner) pip.style.background = PAWN_COLORS[owner.seat];
      return pip;
    });
    const missing = v.majority - mine - 1;
    const goal = !isCity ? `Tu en as ${mine} sur 4`
      : missing <= 0 ? 'Avec celle-ci, tu peux construire'
        : `Encore ${missing} ville${missing > 1 ? 's' : ''} après celle-ci pour construire`;
    const left = me().cash - t.price;
    return h('button.es-offer', { type: 'button', 'aria-label': `Voir la fiche de ${t.name}`, onclick: () => openOverlay({ kind: 'city', pos }) },
      picture(world?.monument(pos), '.es-offer-pic'),
      h('span.es-offer-text',
        h('span.es-stamp', { 'aria-hidden': 'true' }, 'À vendre'),
        h('b', t.name),
        h('small', isCity ? flagOf(t.region) : null, isCity ? REGIONS[t.region].name : 'Escale'),
        h('span', isCity ? `Loyer ${money(t.rent)}, ${money(t.rent * 2)} avec ${v.majority} villes du pays` : `Loyer ${money(ESCALE_RENTS[1])}, plus avec d'autres escales`),
        h('span.es-pips-line', { 'aria-hidden': 'true' }, pips),
        h(isCity && missing <= 0 ? 'em' : 'small.es-offer-goal', goal),
        left >= 0 ? h(`small.es-offer-goal${left < 150 ? '.is-low' : ''}`, left < 150 ? `Il ne te restera que ${money(left)} : attention aux loyers` : `Il te restera ${money(left)}`) : null));
  }

  // Où en est le pays : à qui sont ses villes, et ce qu'il te manque pour y construire.
  function standing(t) {
    if (t.type !== 'city') {
      const n = TILES.filter((x) => x.type === 'escale' && v.props[x.pos]?.owner === meId).length;
      return h('span.es-standing', `Loyer de base 25 €. Tu as ${n} escale${n > 1 ? 's' : ''} sur 4.`);
    }
    const group = TILES.filter((x) => x.region === t.region);
    const mine = group.filter((x) => v.props[x.pos]?.owner === meId).length;
    const pips = group.map((x) => {
      const owner = v.props[x.pos] ? v.players.find((p) => p.id === v.props[x.pos].owner) : null;
      const pip = h(`i${x.pos === t.pos ? '.is-this' : ''}`);
      if (owner) pip.style.background = PAWN_COLORS[owner.seat];
      return pip;
    });
    const missing = v.majority - mine;
    const note = v.props[t.pos] ? `Tu as ${mine} ville${mine > 1 ? 's' : ''} sur 4` : missing <= 1 ? 'Avec celle-ci, tu pourras construire' : `Il te faudrait ${missing} villes pour construire`;
    return h('span.es-standing', h('span.es-pips-line', { 'aria-hidden': 'true' }, pips), `Loyer ${money(t.rent)}. ${note}.`);
  }

  const btn = (text, move, cls = '') => h(`button.es-btn${cls}`, {
    type: 'button',
    onclick: (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      api.sendMove(move).catch(() => { b.disabled = false; }); // refusé ou coupé : on peut réessayer
    },
  }, text);
  const say = (text) => h('p.es-say', text);
  const buildLink = () => (v.actions.build.length ? h('button.es-btn.is-ghost', { type: 'button', onclick: () => openOverlay({ kind: 'build' }) }, 'Construire') : null);

  // Avant de réunir l'argent : ce qui sera vendu ou mis en gage, ville par ville.
  function debtNote(p) {
    const plan = v.debtPlan ?? [];
    const line = (x) => {
      const t = TILES[x.pos];
      const name = t.short ?? t.name;
      const got = Math.floor((x.levels * (t.build || 0)) / 2) + (x.mortgage ? mortgageValue(t) : 0);
      const what = [x.levels ? `${x.levels} niveau${x.levels > 1 ? 'x' : ''} vendu${x.levels > 1 ? 's' : ''}` : null, x.mortgage ? 'mise en gage' : null].filter(Boolean).join(', ');
      return h('li', h('b', name), ` : ${what} (+${money(got)})`);
    };
    return h('div.es-debtplan',
      h('p.es-note', `Tu as ${money(p.cash)}. « Réunir l'argent » fera ceci :`),
      h('ul', plan.map(line)),
      h('p.es-note', 'Une ville en gage ne rapporte plus de loyer. Tu peux aussi choisir toi-même dans Villes.'));
  }

  function promptFor() {
    if (v.over) {
      // Le podium est sur le plateau, en 3D : ici, le classement de tout le monde.
      const ranked = [...v.players].sort((a, b) => Number(a.out) - Number(b.out) || b.worth - a.worth);
      const breakdown = (p) => {
        const n = TILES.filter((t) => v.props[t.pos]?.owner === p.id).length;
        const built = TILES.reduce((sum, t) => sum + (v.props[t.pos]?.owner === p.id ? v.props[t.pos].level : 0), 0);
        return `${money(p.cash)} + ${n} ville${n > 1 ? 's' : ''}${built ? ` + ${built} niveau${built > 1 ? 'x' : ''}` : ''}`;
      };
      return [h('p.es-big', v.winners.includes(meId) ? 'Tu gagnes !' : v.winners.length > 3 ? `${v.winners.length} joueurs à égalité !` : `${v.winners.map(nameOf).join(' et ') || 'Personne ne'} ${v.winners.length > 1 ? 'gagnent' : 'gagne'} !`),
        h(`ol.es-rank${ranked.length > 6 ? '.is-long' : ''}`, { style: `--rank-rows:${Math.ceil(ranked.length / 2)}` }, ranked.map((p, i) => h('li', { style: `--p:${PAWN_COLORS[p.seat]}` },
          h('b.es-rank-n', String(i + 1)),
          picture(world?.portrait(p.seat), '.es-face'),
          h('span.es-rank-name', h('b', p.id === meId ? 'Toi' : p.pseudo), h('small', p.out ? 'sorti' : breakdown(p))),
          h('b.es-rank-worth', p.out ? '—' : money(p.worth)))))];
    }
    if (!myTurn()) return []; // ce n'est pas à toi : rien ne cache le plateau
    const p = v.players[v.cur];
    const t = TILES[p.pos];
    switch (v.phase) {
      case 'roll':
        if (p.blocked) {
          return [say(`Retenu à la Douane (essai ${p.blocked} sur 3).`),
            h('p.es-note', 'Un double te libère. Au 3e essai raté, tu paies 50 € et tu avances.'),
            btn('Tenter un double', { type: 'roll' }),
            p.cash >= 50 ? btn('Payer 50 €', { type: 'payFine' }, '.is-ghost') : null];
        }
        return [btn(v.again ? 'Un double ! Relance les dés' : 'Lancer les dés', { type: 'roll' }), buildLink()];
      case 'buy':
        return [offer(p.pos),
          h('div.es-choice',
            p.cash >= t.price ? btn(`Acheter ${money(t.price)}`, { type: 'buy' }) : say(`Il te manque ${money(t.price - p.cash)}.`),
            btn('Passer', { type: 'decline' }, '.is-ghost'))];
      case 'debt':
        return [say(`Tu dois ${money(v.debt.amount)} ${v.debt.why}.`),
          p.cash >= v.debt.amount ? null : v.raisable >= v.debt.amount ? debtNote(p) : h('p.es-note', `Même en vendant tout, tu n'aurais que ${money(v.raisable ?? p.cash)}. Négocie avec un joueur, ou c'est la faillite.`),
          p.cash >= v.debt.amount ? btn(`Payer ${money(v.debt.amount)}`, { type: 'pay' })
            : v.raisable >= v.debt.amount ? btn('Réunir l’argent et payer', { type: 'raise' }) : null,
          confirmBankrupt ? btn('Oui, je déclare faillite', { type: 'bankrupt' }, '.is-danger')
            : h('button.es-btn.is-danger', { type: 'button', onclick: () => { confirmBankrupt = true; promptKey = null; renderAction(); } }, 'Déclarer faillite')];
      case 'end':
        return [btn('Terminer mon tour', { type: 'endTurn' }), buildLink()];
      default:
        return [];
    }
  }

  // Le journal parle des joueurs par leur pseudo : quand c'est de toi, il te dit « tu ».
  const VERBS = { gagne: 'gagnes', paie: 'paies', achète: 'achètes', laisse: 'laisses', construit: 'construis', vend: 'vends', passe: 'passes', quitte: 'quittes', fait: 'fais', doit: 'dois', rachète: 'rachètes', propose: 'proposes', récupère: 'récupères', met: 'mets', accepte: 'acceptes', refuse: 'refuses', retire: 'retires' };
  // full : dans l'historique, la carte du Télex reste en entier, entre guillemets puisqu'elle s'adresse à celui qui la tire.
  function spoken(text, full = false) {
    const name = me()?.pseudo;
    const telex = text.match(/^Télex pour (.+?) : (.*)$/);
    if (telex) {
      if (telex[1] === name) return `Télex : ${telex[2]}`;
      return full ? `Télex pour ${telex[1]} : « ${telex[2]} »` : `Télex pour ${telex[1]}.`;
    }
    if (!name) return text;
    if (text.endsWith(' concluent un échange.')) {
      const pair = text.slice(0, -' concluent un échange.'.length);
      if (pair.startsWith(`${name} et `)) return `Tu conclus un échange avec ${pair.slice(name.length + 4)}.`;
      if (pair.endsWith(` et ${name}`)) return `Tu conclus un échange avec ${pair.slice(0, -(name.length + 4))}.`;
    }
    if (text.endsWith(`l'échange de ${name}.`)) return text.replace(`l'échange de ${name}`, 'ton échange');
    if (text.startsWith(`${name} est retenu`)) return text.replace(`${name} est retenu`, 'Tu es retenu');
    const [verb] = text.slice(name.length + 1).split(' ');
    if (text.startsWith(`${name} `) && VERBS[verb]) return `Tu ${VERBS[verb]}${text.slice(name.length + 1 + verb.length)}`;
    return text.replaceAll(` à ${name} `, ' à toi ').replaceAll(` à ${name}.`, ' à toi.');
  }

  // Ce qui vient de se passer : une ligne, quelques secondes, puis plus rien.
  let flashN = null;
  let flashTimer = 0;
  let hinted = false;
  function renderFlash(busy) {
    if (!hinted && !busy && !v.over && window.matchMedia('(hover: none)').matches) { // sur écran tactile, une fois : les noms sont petits, la fiche est à un toucher
      hinted = true;
      flash.textContent = 'Touche une case pour voir sa fiche.';
      flash.classList.add('is-on');
      flashTimer = setTimeout(() => flash.classList.remove('is-on'), 3500);
      flashN = v.log.at(-1)?.n ?? 0;
      return;
    }
    const last = v.log.at(-1);
    const fresh = flashN !== null && last && last.n > flashN;
    flashN = last?.n ?? 0;
    if (announce && !v.over) {
      flash.textContent = announce;
      announce = null;
      flash.classList.add('is-on', 'is-big');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => flash.classList.remove('is-on', 'is-big'), 4000);
      return;
    }
    // Une fiche à décider cache la ligne, sauf pour la réponse à un échange : elle ne doit pas passer inaperçue.
    if (v.over || (busy && !(fresh && /échange/i.test(last.text)))) {
      flash.classList.remove('is-on');
      return;
    }
    if (!fresh || / lance \d/.test(last.text)) return; // les dés se voient sur le plateau
    flash.textContent = spoken(last.text);
    // Un gros loyer, c'est le moment fort de la partie : il se voit, et il reste plus longtemps.
    const paid = last.text.match(/ paie ([\d\s\u202f]+) €/);
    const huge = paid && Number(paid[1].replace(/\D/g, '')) >= 300 && / à /.test(last.text);
    flash.classList.add('is-on');
    flash.classList.toggle('is-big', Boolean(huge));
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => flash.classList.remove('is-on', 'is-big'), huge ? 5500 : 3000);
  }

  // Au milieu du plateau : le voyageur dont c'est le tour, en grand.
  let turnKey = null;
  let boardReady = false;
  const whereIs = (p) => {
    const t = TILES[p.pos];
    return t.type === 'city' ? `à ${t.name}` : `sur ${t.name}`;
  };
  function renderTurn(covered) {
    const p = v.players[v.cur];
    // Sur ordinateur, une fiche à décider prend le milieu du plateau ; sur téléphone, elle est en bas et le milieu reste libre.
    turnBox.hidden = v.over || (covered && !window.matchMedia('(max-width: 760px)').matches) || !p || !world;
    if (turnBox.hidden) return;
    const key = p.id;
    const mine = p.id === meId;
    const where = mine ? `Tu es ${whereIs(p)}` : whereIs(p);
    if (key === turnKey && turnBox.childElementCount) {
      const line = turnBox.querySelector('small');
      if (line) line.textContent = where;
      return;
    }
    const fresh = turnKey !== null;
    turnKey = key;
    turnBox.style.setProperty('--p', PAWN_COLORS[p.seat]);
    turnBox.replaceChildren(picture(world.portrait(p.seat), '.es-face') ?? h('i.es-dot'), h('p', h('b', mine ? 'À toi !' : p.pseudo), h('small', where)));
    if (fresh && !QUIET) {
      turnBox.classList.remove('is-in');
      void turnBox.offsetWidth;
      turnBox.classList.add('is-in');
    }
  }

  let lastAnnounced = false;
  let announce = null;
  let shownTrades = null;
  function renderAction() {
    round.textContent = v.maxRounds ? `Tour ${Math.min(v.round, v.maxRounds)}/${v.maxRounds}` : `Tour ${v.round}`;
    const lastRound = Boolean(v.maxRounds) && v.round >= v.maxRounds && !v.over;
    round.classList.toggle('is-last', lastRound);
    under.classList.toggle('is-last', lastRound);
    under.hidden = v.over;
    under.textContent = `${lastRound ? 'Dernier tour !' : round.textContent} · Touche une case pour sa fiche`;
    if (lastRound && !lastAnnounced) {
      lastAnnounced = true;
      announce = 'Dernier tour !';
    }
    const plain = myTurn() && ((v.phase === 'roll' && !v.players[v.cur].blocked) || v.phase === 'end'); // un simple bouton, sans carte autour
    action.classList.toggle('is-plain', plain);
    action.classList.toggle('is-over', v.over);
    frame.classList.toggle('is-over', v.over);

    const key = JSON.stringify([v.phase, v.cur, v.rollN, v.over, me()?.cash, me()?.blocked, v.again, v.raisable, v.actions, v.debt?.amount]);
    if (v.phase !== 'debt') confirmBankrupt = false;
    if (key !== promptKey) {
      const moved = promptKey !== null && JSON.parse(promptKey)[0] + JSON.parse(promptKey)[1] !== v.phase + v.cur;
      promptKey = key;
      prompt.replaceChildren(...promptFor().filter(Boolean));
      // Une nouvelle action arrive en glissant : on voit que quelque chose a changé.
      if (moved && !QUIET) {
        prompt.classList.remove('is-in');
        void prompt.offsetWidth;
        prompt.classList.add('is-in');
      }
    }

    action.hidden = !prompt.childElementCount || !boardReady; // pas de bouton tant que le plateau n'est pas là
    // Sur téléphone, les outils se posent juste au-dessus de la carte d'action, quelle que soit sa hauteur.
    frame.style.setProperty('--act-h', `${action.hidden ? 0 : action.offsetHeight}px`);
    // Quand la carte d'action est haute, les outils remontent : la ligne sous le plateau s'efface plutôt que de passer derrière eux.
    under.hidden = v.over;
    if (!under.hidden && getComputedStyle(under).display !== 'none' && under.getBoundingClientRect().bottom > tools.getBoundingClientRect().top - 2) under.hidden = true;
    frame.classList.toggle('is-buying', v.phase === 'buy' && myTurn());
    renderTurn(!action.hidden && !plain);

    renderTrades();
    tools.hidden = v.over;
    tradeLink.hidden = !me() || me().out; // un spectateur regarde, il n'échange pas
    renderFlash(!action.hidden && !plain);
  }

  // Les échanges n'attendent pas le pion : retirer ou recevoir une proposition se voit tout de suite.
  function renderTrades() {
    const mineTrades = v.trades.filter((t) => t.to === meId || t.from === meId);
    const tradesKey = JSON.stringify(mineTrades);
    if (tradesKey === shownTrades) return; // recréer les boutons pendant un clic le ferait échouer
    shownTrades = tradesKey;
    trades.replaceChildren(...mineTrades.map(tradeCard));
  }

  function offerText(o) {
    const parts = o.cities.map((pos) => `${TILES[pos].short ?? TILES[pos].name}${TILES[pos].price ? ` (${money(TILES[pos].price)})` : ''}`);
    if (o.cash) parts.push(money(o.cash));
    return parts.join(' + ') || 'rien';
  }

  // Ce que l'échange change : qui pourrait construire ensuite.
  function tradeNote(iGet, iGive, other) {
    const after = (id, plus, minus) => (region) => TILES.filter((x) => x.region === region && x.type === 'city' && ((v.props[x.pos]?.owner === id && !minus.includes(x.pos)) || plus.includes(x.pos))).length;
    const unlocks = (cities, count, before) => [...new Set(cities.filter((pos) => TILES[pos].type === 'city').map((pos) => TILES[pos].region))].filter((r) => count(r) >= v.majority && before(r) < v.majority).map((r) => REGIONS[r].name);
    const lines = [];
    const none = after(meId, [], []);
    const mine = unlocks(iGet, after(meId, iGet, iGive), none);
    const theirs = unlocks(iGive, after(other.id, iGive, iGet), after(other.id, [], []));
    if (mine.length) lines.push(`Tu pourrais construire : ${mine.join(', ')}.`);
    if (theirs.length) lines.push(`${other.pseudo} pourrait construire : ${theirs.join(', ')}.`);
    return lines.length ? h('p.es-trade-note', lines.join(' ')) : null;
  }

  function tradeCard(t) {
    const incoming = t.to === meId;
    const other = v.players.find((p) => p.id === (incoming ? t.from : t.to));
    return h('div.es-trade', { style: `--p:${PAWN_COLORS[other.seat]}` },
      h('p.es-trade-who', picture(world?.portrait(other.seat), '.es-face'), incoming ? `${other.pseudo} te propose un échange` : `En attente de ${other.pseudo}`),
      h('dl.es-trade-sum',
        h('dt', 'Tu reçois'), h('dd', offerText(incoming ? t.give : t.get)),
        h('dt', 'Tu donnes'), h('dd', offerText(incoming ? t.get : t.give))),
      tradeNote(incoming ? t.give.cities : t.get.cities, incoming ? t.get.cities : t.give.cities, other),
      h('div.es-choice',
        incoming ? btn('Accepter', { type: 'tradeAccept', id: t.id }, '.is-small') : null,
        btn(incoming ? 'Refuser' : 'Retirer', { type: 'tradeReject', id: t.id }, '.is-ghost.is-small')));
  }

  // ——— Fenêtres ———
  function openOverlay(next) {
    overlay = next;
    renderOverlay({ force: true, focusClose: true });
  }
  function closeOverlay() {
    overlay = null;
    draft = null;
    layer.replaceChildren();
    restoreFocus();
  }
  const restoreFocus = () => world?.focus(focusId === null ? null : { player: focusId });

  function shell(title, ...body) {
    return h('div.es-sheet-wrap', { onclick: (e) => { if (e.target === e.currentTarget) closeOverlay(); } },
      h('section.es-sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('button.es-close', { type: 'button', 'aria-label': 'Fermer', onclick: closeOverlay }, '×'),
        ...body));
  }

  // Qui se tient sur cette case : quand ils sont nombreux, la fiche le dit en toutes lettres.
  const whoHere = (pos) => {
    const here = v.players.filter((p) => !p.out && p.pos === pos);
    return here.length ? h('p.es-here', h('small', 'Ici'), here.map((p) => h('span', picture(world?.portrait(p.seat), '.es-face'), p.id === meId ? 'Toi' : p.pseudo))) : null;
  };
  function citySheet(pos) {
    const t = TILES[pos];
    if (t.type !== 'city' && t.type !== 'escale') {
      return shell(t.name, h('h2', t.name), h('p', ABOUT[t.type] ?? ''), whoHere(pos));
    }
    const prop = v.props[pos];
    const owner = prop ? v.players.find((p) => p.id === prop.owner) : null;
    const a = v.actions;
    const head = h('header.es-poster',
      picture(world?.monument(pos), '.es-thumb'),
      h('div.es-poster-text',
        h('h2', t.name),
        h('p', t.type === 'city' ? flagOf(t.region) : null, t.type === 'city' ? REGIONS[t.region].name : 'Escale')));
    if (t.type === 'city') head.style.setProperty('--r', REGIONS[t.region].color);
    const lines = t.type === 'city'
      ? [['Ville seule', t.rent], [`${v.majority} villes du pays`, t.rent * 2], ['Pays complet', t.rent * 3],
        ...LEVEL_MULT.slice(1).map((m, i) => [LEVEL_NAMES[i + 1], t.rent * m])]
      : ESCALE_RENTS.slice(1).map((r, i) => [`${i + 1} escale${i ? 's' : ''}`, r]);
    // La ligne qui s'applique en ce moment est mise en avant.
    let now = -1;
    if (prop && t.type === 'city') {
      const count = TILES.filter((x) => x.region === t.region && v.props[x.pos]?.owner === prop.owner).length;
      now = prop.level ? 2 + prop.level : count === 4 ? 2 : count >= v.majority ? 1 : 0;
    } else if (prop) {
      now = TILES.filter((x) => x.type === 'escale' && v.props[x.pos]?.owner === prop.owner).length - 1;
    }
    return shell(t.name, head,
      h('p.es-fact', t.fact ?? 'Le propriétaire encaisse selon le nombre d’escales qu’il possède.'),
      whoHere(pos),
      t.type === 'city' ? standing(t) : null,
      h('p.es-owner', owner ? `${owner.id === meId ? 'À toi' : `À ${owner.pseudo}`}${prop.mortgaged ? ', en gage' : ''}. Loyer actuel : ${money(v.rents[pos] ?? 0)}.` : `Libre. Prix : ${money(t.price)}.`),
      prop?.level ? h('p', `Niveau : ${LEVEL_NAMES[prop.level]} (${prop.level} sur ${MAX_LEVEL}).`) : null,
      h('dl.es-rents', lines.map(([k, val], i) => [h(`dt${i === now ? '.is-now' : ''}`, k), h(`dd${i === now ? '.is-now' : ''}`, money(val))])),
      t.build ? h('p.es-note', `Construire un niveau coûte ${money(v.costs[pos] ?? t.build)}. Il faut ${v.majority} villes du pays.`) : null,
      h('div.es-row',
        a.build.includes(pos) ? btn(`Construire (${money(v.costs[pos])})`, { type: 'build', pos }) : null,
        a.unmortgage.includes(pos) ? btn(`Récupérer (${money(unmortgageCost(t))})`, { type: 'unmortgage', pos }) : null,
        a.sell.includes(pos) ? btn('Vendre un niveau', { type: 'sell', pos }, '.is-ghost') : null,
        a.mortgage.includes(pos) ? btn(`Mettre en gage (+${money(mortgageValue(t))})`, { type: 'mortgage', pos }, '.is-ghost') : null),
      a.mortgage.includes(pos) ? h('p.es-note', `En gage : plus de loyer, et ${money(unmortgageCost(t))} pour la récupérer.`) : null);
  }

  // Les villes, pays par pays : on voit d'un coup où l'on approche de la majorité. Les pays où l'on a le plus viennent d'abord.
  function citiesSheet() {
    const cell = (t) => {
      const prop = v.props[t.pos];
      const owner = prop ? v.players.find((p) => p.id === prop.owner) : null;
      const el = h('button.es-cell', { type: 'button', onclick: () => openOverlay({ kind: 'city', pos: t.pos }) },
        h('b', t.short ?? t.name),
        h('span', owner ? (prop.mortgaged ? 'en gage' : `loyer ${money(v.rents[t.pos] ?? 0)}`) : money(t.price)),
        h('small', owner ? picture(world?.portrait(owner.seat), '.es-miniface') : null, owner ? (owner.id === meId ? 'à toi' : owner.pseudo) : 'libre'));
      if (t.type === 'city') el.style.setProperty('--r', REGIONS[t.region].color);
      return el;
    };
    const mineIn = (i) => TILES.filter((t) => t.region === i && v.props[t.pos]?.owner === meId).length;
    const order = REGIONS.map((_, i) => i).sort((a, b) => mineIn(b) - mineIn(a) || a - b);
    return shell('Villes', h('h2', 'Villes'),
      order.map((i) => {
        const n = mineIn(i);
        const free = TILES.some((t) => t.region === i && v.props[t.pos]?.owner === meId && !v.props[t.pos].mortgaged);
        return h('section.es-country',
          h('h3', flagOf(i), REGIONS[i].name, n ? h('small', `${n} sur 4${n >= v.majority && free ? ', tu peux construire' : ''}`) : null),
          h('div.es-cells', TILES.filter((t) => t.region === i).map(cell)));
      }),
      h('section.es-country', h('h3', 'Escales'), h('div.es-cells', TILES.filter((t) => t.type === 'escale').map(cell))));
  }

  // Un joueur sélectionné : ses villes ressortent sur le plateau, et une petite carte résume ce qu'il a, sans rien cacher.
  function setFocus(id) {
    focusId = id;
    restoreFocus();
    renderPlayers();
    renderFocus();
  }

  function renderFocus() {
    const p = focusId === null ? null : v.players.find((x) => x.id === focusId);
    focusCard.hidden = !p;
    if (!p) return;
    const owned = TILES.filter((t) => v.props[t.pos]?.owner === p.id);
    focusCard.style.setProperty('--p', PAWN_COLORS[p.seat]);
    focusCard.replaceChildren(...[
      h('header.es-focus-head',
        picture(world?.portrait(p.seat), '.es-face'),
        h('span', h('b', p.id === meId ? 'Toi' : p.pseudo), h('small', p.out ? 'Sorti de la partie' : `Patrimoine ${money(p.worth)}`)),
        h('button.es-focus-close', { type: 'button', 'aria-label': 'Fermer', onclick: () => setFocus(null) }, '×')),
      owned.length ? h('ul.es-focus-list', owned.map((t) => h('li', h('button', { type: 'button', onclick: () => openOverlay({ kind: 'city', pos: t.pos }) },
        t.type === 'city' ? flagOf(t.region) : null,
        h('span', t.short ?? t.name),
        h('small', v.props[t.pos].mortgaged ? 'en gage' : money(v.rents[t.pos] ?? 0))))))
        : p.out ? null : h('p.es-note', 'Pas encore de ville.'),
      p.id !== meId && !p.out && !v.over && me() && !me().out ? h('button.es-btn.is-small', { type: 'button', onclick: () => {
        openTrade();
        if (draft) {
          draft.to = p.id;
          renderOverlay({ force: true });
        }
      } }, `Échanger avec ${p.pseudo}`) : null].filter(Boolean));
  }

  function moreSheet() {
    const soundBtn = h('button.es-btn.is-ghost.is-small', { type: 'button', onclick: (e) => { e.currentTarget.textContent = sound.toggle() ? 'Remettre le son' : 'Couper le son'; } }, sound.isMuted() ? 'Remettre le son' : 'Couper le son');
    return shell('Plus', h('h2', 'Plus'),
      h('div.es-row', soundBtn,
        h('button.es-btn.is-ghost.is-small', { type: 'button', onclick: () => openOverlay({ kind: 'log' }) }, 'Historique')),
      h('h3', 'Réglages de cette partie'),
      h('dl.es-rents', h('dt', 'Tour'), h('dd', v.maxRounds ? `${Math.min(v.round, v.maxRounds)} sur ${v.maxRounds}` : String(v.round)), h('dt', 'Temps par action'), h('dd', v.timer ? `${v.timer} s` : 'Sans limite'), h('dt', 'Joueurs'), h('dd', String(v.players.length)), h('dt', 'Villes pour construire'), h('dd', `${v.majority} sur 4`)),
      h('h3', 'Les règles en bref'),
      h('ul.es-rules', RULES.map((r) => h('li', r))),
      h('p.es-note', 'À l’ordinateur : la barre d’espace lance les dés et termine ton tour. Touche une case pour voir sa fiche, et un joueur pour voir ses villes. Pour abandonner : le bouton est à côté de la liste des joueurs (onglet Chat sur téléphone).'));
  }

  // Construire : les villes possibles, un bouton par ville.
  const nextRent = (pos) => {
    const t = TILES[pos];
    const all = TILES.filter((x) => x.region === t.region && v.props[x.pos]?.owner === v.props[pos].owner).length === 4;
    return Math.round(t.rent * LEVEL_MULT[v.props[pos].level + 1] * (all ? 1.25 : 1));
  };
  function buildSheet() {
    const list = v.actions.build;
    return shell('Construire', h('h2', 'Construire'),
      list.length ? h('ul.es-list', list.map((pos) => {
        const t = TILES[pos];
        return h('li.es-buildline',
          flagOf(t.region),
          h('span', h('b', t.short ?? t.name), h('small', `${LEVEL_NAMES[v.props[pos].level]} → ${LEVEL_NAMES[v.props[pos].level + 1]}`), h('small', `Loyer ${money(v.rents[pos] ?? t.rent)} → ${money(nextRent(pos))}`)),
          btn(`Construire ${money(v.costs[pos])}`, { type: 'build', pos }, '.is-small'));
      })) : h('p.es-note', 'Plus rien à construire pour l’instant.'));
  }

  function logSheet() {
    return shell('Historique', h('h2', 'Historique'), h('ol.es-history', [...v.log].reverse().map((l) => h('li', spoken(l.text, true)))));
  }

  // L'échange a des jauges : on ne le redessine pas à chaque changement d'état. Seules les jauges et les listes se remettent à jour, sans perdre ce qui est saisi.
  let tradeLive = null;
  function openTrade() {
    const others = v.players.filter((p) => !p.out && p.id !== meId);
    if (!others.length) return;
    draft = { to: others[0].id, give: new Set(), get: new Set(), giveCash: 0, getCash: 0 };
    openOverlay({ kind: 'trade' });
  }

  // L'argent se règle avec une jauge, de 0 à tout ce que le joueur possède.
  function moneyGauge(label, max, value, onChange) {
    let top = Math.floor(max / 10) * 10;
    const shown = h('output.es-gauge-value');
    const input = h('input.es-gauge', { type: 'range', min: 0, max: top, step: 10, 'aria-label': label });
    input.value = String(Math.min(value, top));
    const paint = () => {
      const n = Number(input.value);
      shown.textContent = money(n);
      input.style.setProperty('--fill', `${top ? (n / top) * 100 : 0}%`);
    };
    // L'argent du joueur a changé : le maximum suit, et une somme devenue trop grande redescend.
    const setMax = (next) => {
      const asked = Number(input.value); // à lire avant : le navigateur ramène la valeur au nouveau maximum, sans rien signaler
      top = Math.floor(next / 10) * 10;
      input.max = String(top);
      if (asked > top) {
        input.value = String(top);
        onChange(top);
      }
      paint();
    };
    input.addEventListener('input', () => {
      paint();
      onChange(Number(input.value));
    });
    paint();
    return Object.assign(h('div.es-gauge-row', h('div.es-gauge-head', h('span', 'Argent'), shown), input), { setMax });
  }

  function tradeSheet() {
    const others = v.players.filter((p) => !p.out && p.id !== meId);
    const target = () => others.find((p) => p.id === draft.to) ?? others[0];
    const send = h('button.es-btn.is-send', { type: 'button' }, 'Proposer l’échange');
    const recap = h('p.es-recap', { 'aria-live': 'polite' });
    const line = (set, cash) => [...[...set].map((pos) => TILES[pos].short ?? TILES[pos].name), cash > 0 ? money(cash) : null].filter(Boolean).join(' + ') || 'rien';
    const update = () => {
      recap.replaceChildren(h('span', h('small', 'Tu donnes'), h('b', line(draft.give, draft.giveCash))), h('span', h('small', 'Tu reçois'), h('b', line(draft.get, draft.getCash))));
      send.disabled = !draft.give.size && !draft.get.size && !draft.giveCash && !draft.getCash;
    };
    const picker = (id, set) => {
      const list = Object.keys(v.props).map(Number).filter((pos) => v.props[pos].owner === id && !v.props[pos].level);
      if (!list.length) return h('p.es-note', 'Aucune ville à échanger.');
      return h('div.es-picks', list.map((pos) => {
        const t = TILES[pos];
        const el = h(`button.es-pick${set.has(pos) ? '.is-on' : ''}`, {
          type: 'button',
          'aria-pressed': String(set.has(pos)),
          onclick: () => {
            if (set.has(pos)) set.delete(pos);
            else set.add(pos);
            el.classList.toggle('is-on');
            el.setAttribute('aria-pressed', String(set.has(pos)));
            update();
          },
        }, t.type === 'city' ? flagOf(t.region) : null, t.short ?? t.name);
        return el;
      }));
    };
    const live = [];
    const column = (p, title, set, cash, onCash) => {
      const wallet = h('small', money(p.cash));
      let list = picker(p.id, set);
      let listKey = null;
      const gauge = moneyGauge(`Argent : ${title}`, p.cash, cash, (n) => { onCash(n); update(); });
      const keyOf = () => Object.keys(v.props).map(Number).filter((pos) => v.props[pos].owner === p.id && !v.props[pos].level).join();
      listKey = keyOf();
      live.push(() => {
        const now = v.players.find((x) => x.id === p.id);
        if (!now) return;
        wallet.textContent = money(now.cash);
        gauge.setMax(now.cash);
        const key = keyOf();
        if (key === listKey) return;
        listKey = key;
        for (const pos of [...set]) if (v.props[pos]?.owner !== p.id || v.props[pos]?.level) set.delete(pos);
        const next = picker(p.id, set);
        list.replaceWith(next);
        list = next;
        update();
      });
      return h('section.es-tcol', { style: `--p:${PAWN_COLORS[p.seat]}` }, h('header.es-tcol-head', picture(world?.portrait(p.seat), '.es-face'), h('b', title), wallet), list, gauge);
    };
    send.addEventListener('click', () => {
      send.disabled = true;
      api.sendMove({ type: 'trade', to: target().id, give: { cash: draft.giveCash, cities: [...draft.give] }, get: { cash: draft.getCash, cities: [...draft.get] } })
        .then(closeOverlay).catch(() => { send.disabled = false; });
    });
    update();
    const el = shell('Échanger', h('h2', 'Échanger'),
      others.length > 1 ? h('div.es-whos', { role: 'group', 'aria-label': 'Avec qui échanger' }, others.map((p) => {
        const who = h(`button.es-whom${p.id === target().id ? '.is-on' : ''}`, {
          type: 'button',
          'aria-pressed': String(p.id === target().id),
          onclick: () => { draft.to = p.id; draft.get = new Set(); draft.getCash = 0; renderOverlay({ force: true }); },
        }, picture(world?.portrait(p.seat), '.es-face'), p.pseudo);
        who.style.setProperty('--p', PAWN_COLORS[p.seat]);
        return who;
      })) : null,
      h('div.es-tcols',
        column(me(), 'Tu donnes', draft.give, draft.giveCash, (n) => { draft.giveCash = n; }),
        column(target(), `${target().pseudo} donne`, draft.get, draft.getCash, (n) => { draft.getCash = n; })),
      h('footer.es-tfoot', recap, send));
    el.firstChild.classList.add('is-trade');
    tradeLive = () => {
      if (target().out || !others.some((p) => p.id === draft.to)) return;
      live.forEach((fn) => fn());
    };
    return el;
  }

  // Pendant le tour des autres, on ne redessine une fenêtre que si son contenu change, et sans déplacer le focus du clavier.
  function renderOverlay({ force = false, focusClose = false } = {}) {
    if (!overlay || !v) return;
    const seen = JSON.stringify([overlay, v.props, v.rents, v.actions, v.costs, overlay.kind === 'log' ? v.log.at(-1)?.n : 0]);
    if (!force && seen === overlaySeen) return;
    overlaySeen = seen;
    const scroll = layer.querySelector('.es-sheet')?.scrollTop ?? 0;
    const focusables = () => [...layer.querySelectorAll('button, input')];
    const focusedAt = focusables().indexOf(document.activeElement);
    const el = overlay.kind === 'city' ? citySheet(overlay.pos)
      : overlay.kind === 'cities' ? citiesSheet()
          : overlay.kind === 'more' ? moreSheet()
            : overlay.kind === 'log' ? logSheet()
              : overlay.kind === 'build' ? buildSheet()
              : tradeSheet();
    layer.replaceChildren(el);
    const sheet = el.querySelector('.es-sheet');
    if (sheet) sheet.scrollTop = scroll;
    if (focusClose) el.querySelector('.es-close')?.focus({ preventScroll: true });
    else if (focusedAt >= 0) (focusables()[focusedAt] ?? el.querySelector('.es-close'))?.focus({ preventScroll: true });
  }

  const onKey = (e) => {
    if (e.key === 'Escape') {
      if (overlay) closeOverlay();
      else if (focusId !== null) setFocus(null);
    }
    // La barre d'espace lance l'action principale, sauf si on écrit quelque part ou qu'une fenêtre est ouverte.
    // Jamais pour un achat, une mise ou une vente : ce qui coûte de l'argent se décide à la main.
    if (e.code === 'Space' && !overlay && !action.hidden && !e.repeat && v && myTurn() && ['roll', 'end'].includes(v.phase) && !/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName) && root.isConnected && root.offsetParent) {
      const main = prompt.querySelector('.es-btn:not(.is-ghost):not(.is-danger):not(:disabled)');
      if (main) {
        e.preventDefault();
        main.click();
      }
    }
  };
  document.addEventListener('keydown', onKey);

  // ——— Minuteur ———
  const tick = setInterval(() => {
    // Seul ton propre temps s'affiche.
    const running = info?.deadline && v && myTurn();
    timing.hidden = !running;
    if (!running) {
      clock.textContent = '';
      return;
    }
    const total = (v.timer || 60) * 1000;
    const left = Math.max(0, info.deadline - api.now());
    timer.firstChild.style.width = `${Math.min(100, (left / total) * 100)}%`;
    timer.classList.toggle('is-low', left < 8000);
    clock.textContent = left < 10500 ? `${Math.ceil(left / 1000)} s, puis le jeu joue pour toi` : '';
  }, 250);

  // L'interface annonce ce qui s'est passé quand le pion est arrivé, pas avant.
  let uiTimer = 0;
  function applyUI() {
    clearTimeout(uiTimer);
    uiTimer = 0;
    // Un joueur en paie un autre : on voit l'argent passer.
    const moved = v.players.map((p) => [p.id, p.cash - (before.cash.get(p.id) ?? p.cash)]).filter(([, d]) => d);
    if (moved.length === 2 && moved[0][1] + moved[1][1] === 0) {
      const [payer, payee] = moved[0][1] < 0 ? moved : [moved[1], moved[0]];
      world?.payCoins(payer[0], payee[0]);
      sound.coins();
      world?.react(payer[0], 'sad');
      world?.react(payee[0], 'joy');
    }
    // Un achat : celui qui vient de s'offrir une ville est content.
    for (const [pos, prop] of Object.entries(v.props)) {
      if (before.owners.size && before.owners.get(pos) !== prop.owner && !(moved.length === 2 && moved[0][1] + moved[1][1] === 0)) world?.react(prop.owner, 'joy');
    }
    playSounds();
    renderPlayers();
    before.cash = new Map(v.players.map((p) => [p.id, p.cash]));
    renderAction();
    renderFocus();
    api.showTurn();
    if (overlay?.kind === 'trade') tradeLive?.();
    else if (overlay) renderOverlay();
  }

  api.onState((view, st) => {
    if (before.rollN !== null && view.rollN !== before.rollN) sound.dice();
    before.rollN = view.rollN;
    v = view;
    info = st;
    world?.update(v);
    renderTrades();
    if (world?.walking() && !v.over) {
      action.hidden = true; // le bouton sur lequel on vient de cliquer s'en va tout de suite
      const line = turnBox.querySelector('small');
      if (line) line.textContent = 'avance…';
      if (!uiTimer) uiTimer = setTimeout(applyUI, 5000); // au cas où l'animation ne tourne pas (onglet caché, écran du chat)
      return;
    }
    applyUI();
  });

  return () => {
    gone = true;
    clearInterval(tick);
    clearTimeout(flashTimer);
    clearTimeout(uiTimer);
    document.removeEventListener('keydown', onKey);
    document.title = pageTitle;
    sound.destroy();
    world?.destroy();
  };
}
