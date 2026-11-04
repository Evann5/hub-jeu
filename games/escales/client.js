// Escales côté navigateur : le monde en 3D (client/scene.js), et par-dessus l'interface : les joueurs, toujours visibles ; au centre,
// seulement ce que tu as à décider, quand c'est à toi ; et les fenêtres qu'on ouvre soi-même. Les règles restent côté serveur (rules.js).
import { REGIONS, TILES, RULES, LEVEL_MULT, LEVEL_NAMES, MAX_LEVEL, ESCALE_RENTS, FLY_COST } from './client/board.js';
import { createWorld, PAWN_COLORS } from './client/scene.js';
import { FLAGS } from './client/countries.js';
import { createSound } from './client/sound.js';
import { loadSculpted } from './client/monuments.js';

const money = (n) => `${Number(n).toLocaleString('fr-FR')} €`;

const ABOUT = {
  start: 'Tu touches 200 € à chaque passage, 100 € de plus si ton patrimoine fait moins de la moitié de celui du premier.',
  customs: 'Simple visite si tu tombes dessus. Retenu ici : fais un double, paie 50 € ou présente un passe-douane. Au troisième échec, tu paies et tu avances.',
  festival: 'Choisis une de tes villes : son loyer double jusqu’à ton prochain tour.',
  control: 'Direction la Douane, sans passer par le Départ.',
  telex: 'Une dépêche au hasard : bonne ou mauvaise nouvelle.',
  tax: 'Impôts : 10 % de ton argent, 50 € au moins. Taxe de séjour : 100 €.',
  chantier: 'Si tu as assez de villes d’un pays, tu y construis un niveau à moitié prix.',
};

export function mount(root, api) {
  const { h } = api;
  let v = null;
  let info = null;
  let promptKey = null;
  let overlay = null; // { kind: 'city', pos } | { kind: 'cities' } | { kind: 'trade' } | { kind: 'player', id } | { kind: 'more' } | { kind: 'log' } | { kind: 'build' }
  let overlaySeen = null;
  let draft = null;
  let world = null;
  let gone = false;

  const meId = api.me.id;
  const sound = createSound();
  const before = { cash: new Map(), rollN: null, cur: null, owners: new Map(), levels: 0, over: false, logN: 0 };
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
    round,
    h('button.es-link', { type: 'button', onclick: () => openOverlay({ kind: 'cities' }) }, 'Villes'),
    tradeLink,
    h('button.es-link', { type: 'button', onclick: () => openOverlay({ kind: 'more' }) }, 'Plus'));
  const timer = h('div.es-timer', h('i'));
  const timing = h('div.es-timing', { hidden: true }, timer, clock);
  const action = h('section.es-action', { hidden: true }, timing, prompt);
  const flash = h('p.es-flash', { 'aria-live': 'polite' });
  const side = h('aside.es-side', players, tools, trades);
  const layer = h('div.es-layer');
  const loading = h('p.es-loading', 'Le plateau arrive…');
  const frame = h('div.es', stage, loading, tip, side, flash, action, layer);
  root.append(frame);

  // ——— Le monde 3D. Les étiquettes des cases sont dessinées avec la police du jeu : on l'attend d'abord. ———
  // Le texte est donné exprès : les accents vietnamiens sont dans un fichier à part, qui ne se charge que si on les demande.
  const tileText = TILES.map((t) => t.short ?? t.name).join('');
  const titleText = `${REGIONS.map((r) => r.name).join('')}Escales`;
  Promise.all([document.fonts.load('800 40px "ES Barlow"', tileText), document.fonts.load('700 30px "ES Barlow"', '0123456789 €'), document.fonts.load('400 60px "ES Alfa"', titleText), loadSculpted(api.asset)]).catch(() => {}).finally(() => {
    if (gone) return;
    try {
      world = createWorld(stage, {
        onStep: sound.step,
        onHover: showTip,
        onTile: (pos) => openOverlay({ kind: 'city', pos }),
        topInset: () => Math.max(players.getBoundingClientRect().bottom, tools.hidden ? 0 : tools.getBoundingClientRect().bottom) - stage.getBoundingClientRect().top + 6,
        rightInset: () => side.offsetWidth + 12,
        onFit: ([cx, cy], [, fy]) => {
          frame.style.setProperty('--cx', `${Math.round(cx)}px`);
          frame.style.setProperty('--cy', `${Math.round(cy)}px`);
          frame.style.setProperty('--fy', `${Math.round(fy)}px`);
        },
      });
      if (v) {
        world.update(v);
        renderPlayers(); // les portraits se préparent ici, au chargement, plutôt qu'en pleine partie
      }
      loading.remove();
    } catch (err) {
      loading.remove();
      console.error(err);
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
    if (t.price) {
      lines.push(h('span', owner
        ? `${owner.id === meId ? 'À toi' : `À ${owner.pseudo}`}${prop.mortgaged ? ', en gage' : `, loyer ${money(v.rents[pos] ?? 0)}`}`
        : `Libre, ${money(t.price)}`));
      if (prop?.level) lines.push(h('span', LEVEL_NAMES[prop.level]));
    }
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
    if (!d) return null;
    return h(`span.es-delta${d > 0 ? '.is-up' : '.is-down'}`, { 'aria-hidden': 'true' }, `${d > 0 ? '+' : ''}${d.toLocaleString('fr-FR')} €`);
  }

  // Chaque événement a son son.
  function playSounds() {
    if (before.rollN !== null && v.rollN !== before.rollN) sound.dice();
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
    // La réponse d'un robot à ton échange ne doit pas passer inaperçue.
    const myName = me()?.pseudo;
    if (myName) for (const l of v.log) {
      if (l.n > before.logN && before.logN && l.text.endsWith(`l'échange de ${myName}.`)) api.toast(l.text);
    }
    before.logN = v.log.at(-1)?.n ?? 0;
    if (v.over && !before.over) sound.win();
    before.over = v.over;
    before.rollN = v.rollN;
    before.cur = v.cur;
    before.owners = new Map(Object.entries(v.props).map(([pos, prop]) => [pos, prop.owner]));
    if (!before.owners.size) before.owners.set('-', 0);
  }

  function renderPlayers() {
    players.replaceChildren(...v.players.map((p) => {
      const dot = picture(world?.portrait(p.seat), '.es-face') ?? h('i.es-dot');
      const turn = !v.over && v.players[v.cur].id === p.id;
      const chip = h(`button.es-chip${turn ? '.is-turn' : ''}${p.out ? '.is-out' : ''}`, { type: 'button', style: `--p:${PAWN_COLORS[p.seat]}`, 'aria-label': `${p.id === meId ? 'Toi' : p.pseudo}${p.bot ? ', robot' : ''}, ${p.out ? 'sorti' : money(p.cash)}. Voir le détail`, onclick: () => openOverlay({ kind: 'player', id: p.id }) },
        dot,
        h('span.es-pseudo', p.id === meId ? 'Toi' : p.pseudo, p.bot ? h('small', ' robot') : null),
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
  // La ville à acheter : son monument, son nom, son pays, son loyer. Le reste est dans sa fiche, d'un clic.
  function offer(pos) {
    const t = TILES[pos];
    const isCity = t.type === 'city';
    const mine = isCity ? TILES.filter((x) => x.region === t.region && v.props[x.pos]?.owner === meId).length : 0;
    return h('button.es-offer', { type: 'button', 'aria-label': `Voir la fiche de ${t.name}`, onclick: () => openOverlay({ kind: 'city', pos }) },
      picture(world?.monument(pos), '.es-offer-pic'),
      h('span.es-offer-text',
        h('b', t.name),
        h('small', isCity ? flagOf(t.region) : null, isCity ? REGIONS[t.region].name : 'Escale'),
        h('span', `Loyer ${money(isCity ? t.rent : ESCALE_RENTS[1])}`),
        isCity && mine + 1 >= v.majority ? h('em', 'Avec celle-ci, tu pourras construire') : null));
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

  function promptFor() {
    if (v.over) {
      const ranked = [...v.players].sort((a, b) => Number(a.out) - Number(b.out) || b.worth - a.worth);
      const breakdown = (p) => {
        const owned = TILES.filter((t) => v.props[t.pos]?.owner === p.id);
        return `${money(p.cash)} + ${owned.length} ville${owned.length > 1 ? 's' : ''}`;
      };
      const STEP = [104, 76, 58];
      return [h('p.es-big', v.winners.includes(meId) ? 'Tu gagnes !' : `${v.winners.map(nameOf).join(' et ') || 'Personne ne'} ${v.winners.length > 1 ? 'gagnent' : 'gagne'} !`),
        h('div.es-podium', ranked.slice(0, 3).map((p, i) => {
          const bar = h('div.es-step', h('b', String(i + 1)));
          bar.style.height = `${STEP[i]}px`;
          bar.style.background = PAWN_COLORS[p.seat];
          return h('div.es-place', picture(world?.portrait(p.seat), '.es-podium-face'), h('b.es-place-name', p.id === meId ? 'Toi' : p.pseudo), h('span', money(p.worth)), h('small', breakdown(p)), bar);
        })),
        ranked.length > 3 ? h('ol.es-rank', { start: 4 }, ranked.slice(3).map((p) => h('li', h('span', p.id === meId ? 'Toi' : p.pseudo), h('b', p.out ? 'sorti' : money(p.worth))))) : null];
    }
    if (!myTurn()) return []; // ce n'est pas à toi : rien ne cache le plateau
    const p = v.players[v.cur];
    const t = TILES[p.pos];
    const a = v.actions;
    switch (v.phase) {
      case 'roll':
        if (p.blocked) {
          return [say(`Retenu à la Douane (essai ${p.blocked} sur 3).`),
            btn('Tenter un double', { type: 'roll' }),
            p.cash >= 50 ? btn('Payer 50 €', { type: 'payFine' }, '.is-ghost') : null,
            p.passes ? btn('Utiliser un passe-douane', { type: 'usePass' }, '.is-ghost') : null];
        }
        return [v.again ? say('Un double : tu rejoues !') : null, btn('Lancer les dés', { type: 'roll' }), buildLink()];
      case 'buy':
        return [offer(p.pos),
          h('div.es-choice',
            p.cash >= t.price ? btn(`Acheter ${money(t.price)}`, { type: 'buy' }) : say(`Il te manque ${money(t.price - p.cash)}.`),
            btn('Passer', { type: 'decline' }, '.is-ghost'))];
      case 'fly':
        return [say(`T’envoler pour ${money(FLY_COST)} ?`),
          h('div.es-row', ...TILES.filter((x) => x.type === 'escale' && x.pos !== p.pos).map((x) => btn(x.name, { type: 'fly', pos: x.pos }, '.is-ghost.is-small'))),
          btn('Rester ici', { type: 'skip' })];
      case 'festival':
        return [say('Festival : choisis une ville, son loyer double jusqu’à ton prochain tour.'),
          h('div.es-row', ...a.festival.map((pos) => btn(TILES[pos].name, { type: 'festival', pos }, '.is-ghost.is-small'))),
          btn('Passer', { type: 'skip' }, '.is-ghost')];
      case 'chantier':
        return [say('Chantier : un niveau à moitié prix.'),
          h('div.es-row', ...a.chantier.map((pos) => btn(`${TILES[pos].name} (${money(Math.floor(v.costs[pos] / 2))})`, { type: 'chantier', pos }, '.is-ghost.is-small'))),
          btn('Passer', { type: 'skip' }, '.is-ghost')];
      case 'debt':
        return [say(`Tu dois ${money(v.debt.amount)} ${v.debt.why}.`),
          p.cash >= v.debt.amount ? null : h('p.es-note', v.raisable >= v.debt.amount ? `Tu as ${money(p.cash)}. En vendant, tu peux réunir ${money(v.raisable)}.` : `Même en vendant tout, tu n'aurais que ${money(v.raisable ?? p.cash)}. Négocie avec un joueur, ou c'est la faillite.`),
          p.cash >= v.debt.amount ? btn(`Payer ${money(v.debt.amount)}`, { type: 'pay' })
            : v.raisable >= v.debt.amount ? btn('Vendre ce qu’il faut et payer', { type: 'raise' }) : null,
          confirmBankrupt ? btn('Oui, je déclare faillite', { type: 'bankrupt' }, '.is-danger')
            : h('button.es-btn.is-danger', { type: 'button', onclick: () => { confirmBankrupt = true; promptKey = null; renderAction(); } }, 'Déclarer faillite')];
      case 'end':
        return [btn('Terminer mon tour', { type: 'endTurn' }), buildLink()];
      default:
        return [];
    }
  }

  // Le journal parle des joueurs par leur pseudo : quand c'est de toi, il te dit « tu ».
  const VERBS = { paie: 'paies', achète: 'achètes', laisse: 'laisses', construit: 'construis', vend: 'vends', passe: 'passes', quitte: 'quittes', fait: 'fais', doit: 'dois', rachète: 'rachètes', propose: 'proposes', récupère: 'récupères', met: 'mets', présente: 'présentes', accepte: 'acceptes', refuse: 'refuses', retire: 'retires' };
  function spoken(text) {
    const name = me()?.pseudo;
    if (!name) return text;
    if (text.startsWith(`${name} est retenu`)) return text.replace(`${name} est retenu`, 'Tu es retenu');
    if (text.startsWith(`${name} s'envole`)) return text.replace(`${name} s'envole`, 'Tu t’envoles');
    const [verb] = text.slice(name.length + 1).split(' ');
    if (text.startsWith(`${name} `) && VERBS[verb]) return `Tu ${VERBS[verb]}${text.slice(name.length + 1 + verb.length)}`;
    return text.replaceAll(` à ${name} `, ' à toi ');
  }

  // Ce qui vient de se passer : une ligne, quelques secondes, puis plus rien.
  let flashN = null;
  let flashTimer = 0;
  function renderFlash(busy) {
    const last = v.log.at(-1);
    const fresh = flashN !== null && last && last.n > flashN;
    flashN = last?.n ?? 0;
    if (busy || v.over) {
      flash.classList.remove('is-on');
      return;
    }
    if (!fresh || / lance \d/.test(last.text)) return; // les dés se voient sur le plateau
    flash.textContent = spoken(last.text);
    flash.classList.add('is-on');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => flash.classList.remove('is-on'), 3000);
  }

  function renderAction() {
    round.textContent = v.maxRounds ? `Tour ${Math.min(v.round, v.maxRounds)}/${v.maxRounds}` : `Tour ${v.round}`;
    const about = v.phase === 'buy' ? TILES[v.players[v.cur].pos] : null;
    action.classList.toggle('has-city', about?.type === 'city');
    if (about?.type === 'city') action.style.setProperty('--r', REGIONS[about.region].color);
    const plain = myTurn() && ((v.phase === 'roll' && !v.players[v.cur].blocked) || v.phase === 'end'); // un simple bouton, sans carte autour
    action.classList.toggle('is-plain', plain);
    action.classList.toggle('is-over', v.over);

    const key = JSON.stringify([v.phase, v.cur, v.rollN, v.over, me()?.cash, me()?.blocked, me()?.passes, v.again, v.raisable, v.actions, v.debt?.amount]);
    if (v.phase !== 'debt') confirmBankrupt = false;
    if (key !== promptKey) {
      const moved = promptKey !== null && JSON.parse(promptKey)[0] + JSON.parse(promptKey)[1] !== v.phase + v.cur;
      promptKey = key;
      prompt.replaceChildren(...promptFor().filter(Boolean));
      action.hidden = !prompt.childElementCount;
      // Une nouvelle action arrive en glissant : on voit que quelque chose a changé.
      if (moved && !QUIET) {
        prompt.classList.remove('is-in');
        void prompt.offsetWidth;
        prompt.classList.add('is-in');
      }
    }

    trades.replaceChildren(...v.trades.filter((t) => t.to === meId || t.from === meId).map(tradeCard));
    tools.hidden = v.over;
    tradeLink.hidden = !me() || me().out; // un spectateur regarde, il n'échange pas
    renderFlash(!action.hidden && !plain);
  }

  function offerText(o) {
    const parts = o.cities.map((pos) => TILES[pos].name);
    if (o.cash) parts.push(money(o.cash));
    if (o.passes) parts.push(`${o.passes} passe-douane`);
    return parts.join(', ') || 'rien';
  }

  function tradeCard(t) {
    const incoming = t.to === meId;
    return h('div.es-trade',
      h('p', incoming ? `${nameOf(t.from)} te propose ${offerText(t.give)} contre ${offerText(t.get)}.` : `Tu proposes à ${nameOf(t.to)} : ${offerText(t.give)} contre ${offerText(t.get)}.`),
      h('div.es-row',
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
  }

  function shell(title, ...body) {
    return h('div.es-sheet-wrap', { onclick: (e) => { if (e.target === e.currentTarget) closeOverlay(); } },
      h('section.es-sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('button.es-close', { type: 'button', 'aria-label': 'Fermer', onclick: closeOverlay }, '×'),
        ...body));
  }

  function citySheet(pos) {
    const t = TILES[pos];
    if (t.type !== 'city' && t.type !== 'escale') {
      return shell(t.name, h('h2', t.name), h('p', ABOUT[t.type] ?? ''));
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
      h('p.es-fact', t.fact ?? `Le propriétaire encaisse selon ses escales. De là, un vol pour une autre escale coûte ${money(FLY_COST)}.`),
      t.type === 'city' ? standing(t) : null,
      h('p.es-owner', owner ? `${owner.id === meId ? 'À toi' : `À ${owner.pseudo}`}${prop.mortgaged ? ', en gage' : ''}. Loyer actuel : ${money(v.rents[pos] ?? 0)}.` : `Libre. Prix : ${money(t.price)}.`),
      prop?.level ? h('p', `Niveau : ${LEVEL_NAMES[prop.level]} (${prop.level} sur ${MAX_LEVEL}).`) : null,
      h('dl.es-rents', lines.map(([k, val], i) => [h(`dt${i === now ? '.is-now' : ''}`, k), h(`dd${i === now ? '.is-now' : ''}`, money(val))])),
      t.build ? h('p.es-note', `Construire un niveau coûte ${money(v.costs[pos] ?? t.build)}. Il faut ${v.majority} villes du pays.`) : null,
      h('div.es-row',
        a.build.includes(pos) ? btn(`Construire (${money(v.costs[pos])})`, { type: 'build', pos }) : null,
        a.unmortgage.includes(pos) ? btn('Récupérer', { type: 'unmortgage', pos }) : null,
        a.sell.includes(pos) ? btn('Vendre un niveau', { type: 'sell', pos }, '.is-ghost') : null,
        a.mortgage.includes(pos) ? btn('Mettre en gage', { type: 'mortgage', pos }, '.is-ghost') : null));
  }

  // Les villes, pays par pays : on voit d'un coup où l'on approche de la majorité. Les pays où l'on a le plus viennent d'abord.
  function citiesSheet() {
    const cell = (t) => {
      const prop = v.props[t.pos];
      const owner = prop ? v.players.find((p) => p.id === prop.owner) : null;
      const el = h('button.es-cell', { type: 'button', onclick: () => openOverlay({ kind: 'city', pos: t.pos }) },
        h('b', t.short ?? t.name),
        h('span', owner ? (prop.mortgaged ? 'en gage' : `loyer ${money(v.rents[t.pos] ?? 0)}`) : money(t.price)),
        h('small', owner ? (owner.id === meId ? 'à toi' : owner.pseudo) : 'libre'));
      if (t.type === 'city') el.style.setProperty('--r', REGIONS[t.region].color);
      if (owner) el.style.setProperty('--o', PAWN_COLORS[owner.seat]);
      return el;
    };
    const mineIn = (i) => TILES.filter((t) => t.region === i && v.props[t.pos]?.owner === meId).length;
    const order = REGIONS.map((_, i) => i).sort((a, b) => mineIn(b) - mineIn(a) || a - b);
    return shell('Villes', h('h2', 'Villes'),
      me()?.passes ? h('p.es-note', `Tu as ${me().passes} passe-douane.`) : null,
      order.map((i) => {
        const n = mineIn(i);
        return h('section.es-country',
          h('h3', flagOf(i), REGIONS[i].name, n ? h('small', `${n} sur 4${n >= v.majority ? ', tu peux construire' : ''}`) : null),
          h('div.es-cells', TILES.filter((t) => t.region === i).map(cell)));
      }),
      h('section.es-country', h('h3', 'Escales'), h('div.es-cells', TILES.filter((t) => t.type === 'escale').map(cell))));
  }

  // Un joueur : son argent, son patrimoine, ses villes, et de quoi lui proposer un échange.
  function playerSheet(id) {
    const p = v.players.find((x) => x.id === id);
    if (!p) return shell('Joueur', h('p', 'Ce joueur n’est plus là.'));
    const owned = TILES.filter((t) => v.props[t.pos]?.owner === id);
    const head = h('header.es-who-head', h('i.es-dot'), h('h2', p.id === meId ? 'Toi' : p.pseudo));
    head.style.setProperty('--p', PAWN_COLORS[p.seat]);
    return shell(p.pseudo, head,
      h('dl.es-rents', h('dt', 'Argent'), h('dd', money(p.cash)), h('dt', 'Patrimoine'), h('dd', money(p.worth)), h('dt', 'Villes et escales'), h('dd', String(owned.length)), p.passes ? [h('dt', 'Passe-douane'), h('dd', String(p.passes))] : null),
      owned.length ? h('ul.es-list', owned.map((t) => {
        const el = h('button.es-line', { type: 'button', onclick: () => openOverlay({ kind: 'city', pos: t.pos }) },
          h('b', t.name),
          h('span', v.props[t.pos].mortgaged ? 'en gage' : `loyer ${money(v.rents[t.pos] ?? 0)}`));
        if (t.type === 'city') el.style.setProperty('--r', REGIONS[t.region].color);
        return h('li', el);
      })) : h('p.es-note', 'Pas encore de ville.'),
      p.id !== meId && !p.out && !v.over && me() && !me().out ? h('div.es-row', h('button.es-btn', { type: 'button', onclick: () => {
        openTrade();
        draft.to = p.id;
        renderOverlay({ force: true });
      } }, `Proposer un échange à ${p.pseudo}`)) : null);
  }

  function moreSheet() {
    const soundBtn = h('button.es-btn.is-ghost.is-small', { type: 'button', onclick: (e) => { e.currentTarget.textContent = sound.toggle() ? 'Remettre le son' : 'Couper le son'; } }, sound.isMuted() ? 'Remettre le son' : 'Couper le son');
    return shell('Plus', h('h2', 'Plus'),
      h('div.es-row', soundBtn,
        h('button.es-btn.is-ghost.is-small', { type: 'button', onclick: () => openOverlay({ kind: 'log' }) }, 'Historique')),
      h('h3', 'Réglages de cette partie'),
      h('dl.es-rents', h('dt', 'Nombre de tours'), h('dd', v.maxRounds ? String(v.maxRounds) : 'Sans fin'), h('dt', 'Temps par action'), h('dd', v.timer ? `${v.timer} s` : 'Sans limite'), h('dt', 'Joueurs'), h('dd', String(v.players.length)), h('dt', 'Villes pour construire'), h('dd', `${v.majority} sur 4`)),
      h('h3', 'Les règles en bref'),
      h('ul.es-rules', RULES.map((r) => h('li', r))),
      h('p.es-note', 'À l’ordinateur : la barre d’espace lance les dés et termine ton tour. Touche une case pour voir sa fiche. Pour abandonner : le bouton est à côté de la liste des joueurs (onglet Chat sur téléphone).'));
  }

  // Construire : les villes possibles, un bouton par ville.
  function buildSheet() {
    const list = v.actions.build;
    return shell('Construire', h('h2', 'Construire'),
      list.length ? h('ul.es-list', list.map((pos) => {
        const t = TILES[pos];
        const row = h('div.es-buildline',
          h('span', h('b', t.short ?? t.name), h('small', LEVEL_NAMES[v.props[pos].level + 1])),
          btn(money(v.costs[pos]), { type: 'build', pos }, '.is-small'));
        row.style.setProperty('--r', REGIONS[t.region].color);
        return h('li', row);
      })) : h('p.es-note', 'Plus rien à construire pour l’instant.'));
  }

  function logSheet() {
    return shell('Historique', h('h2', 'Historique'), h('ol.es-history', [...v.log].reverse().map((l) => h('li', l.text))));
  }

  // L'échange a des champs de saisie : on ne le redessine pas à chaque changement d'état.
  function openTrade() {
    const others = v.players.filter((p) => !p.out && p.id !== meId);
    if (!others.length) return;
    draft = { to: others[0].id, give: new Set(), get: new Set() };
    openOverlay({ kind: 'trade' });
  }

  function tradeSheet() {
    const others = v.players.filter((p) => !p.out && p.id !== meId);
    let recapUpdate = () => {};
    const tradable = (id) => Object.keys(v.props).map(Number).filter((pos) => v.props[pos].owner === id && !v.props[pos].level);
    const picker = (id, set) => {
      const list = tradable(id);
      return list.length ? h('div.es-picks', list.map((pos) => {
        const el = h(`button.es-pick${set.has(pos) ? '.is-on' : ''}`, {
          type: 'button',
          'aria-pressed': String(set.has(pos)),
          onclick: () => {
            if (set.has(pos)) set.delete(pos);
            else set.add(pos);
            el.classList.toggle('is-on');
            el.setAttribute('aria-pressed', String(set.has(pos)));
            recapUpdate();
          },
        }, TILES[pos].name);
        if (TILES[pos].type === 'city') el.style.setProperty('--r', REGIONS[TILES[pos].region].color);
        return el;
      })) : h('p.es-note', 'Aucune ville échangeable.');
    };
    const giveCash = h('input.es-input', { type: 'number', min: 0, step: 1, value: '0', inputmode: 'numeric', 'aria-label': 'Argent que tu donnes' });
    const getCash = h('input.es-input', { type: 'number', min: 0, step: 1, value: '0', inputmode: 'numeric', 'aria-label': 'Argent que tu demandes' });
    const recap = h('p.es-recap', { 'aria-live': 'polite' });
    const offerLine = (set, cash) => [...[...set].map((pos) => TILES[pos].short ?? TILES[pos].name), Number(cash.value) > 0 ? money(Number(cash.value)) : null].filter(Boolean).join(' + ') || 'rien';
    const updateRecap = () => { recap.textContent = `Tu donnes ${offerLine(draft.give, giveCash)}. Tu reçois ${offerLine(draft.get, getCash)}.`; };
    giveCash.addEventListener('input', updateRecap);
    getCash.addEventListener('input', updateRecap);
    recapUpdate = updateRecap;
    updateRecap();
    return shell('Proposer un échange', h('h2', 'Proposer un échange'),
      h('div.es-picks', others.map((p) => h(`button.es-pick${p.id === draft.to ? '.is-on' : ''}`, {
        type: 'button',
        onclick: () => { draft.to = p.id; draft.get = new Set(); renderOverlay({ force: true }); },
      }, p.pseudo))),
      h('h3', 'Tu donnes'), picker(meId, draft.give), h('label.es-field', 'Argent', giveCash, h('span', '€')),
      h('h3', `Tu demandes à ${nameOf(draft.to)}`), picker(draft.to, draft.get), h('label.es-field', 'Argent', getCash, h('span', '€')),
      recap,
      h('div.es-row', h('button.es-btn', {
        type: 'button',
        onclick: () => {
          api.sendMove({ type: 'trade', to: draft.to, give: { cash: Number(giveCash.value) || 0, cities: [...draft.give] }, get: { cash: Number(getCash.value) || 0, cities: [...draft.get] } })
            .then(closeOverlay).catch(() => {});
        },
      }, 'Envoyer la proposition')));
  }

  // Pendant le tour des autres, on ne redessine une fenêtre que si son contenu change, et sans déplacer le focus du clavier.
  function renderOverlay({ force = false, focusClose = false } = {}) {
    if (!overlay || !v) return;
    const seen = JSON.stringify([overlay, v.props, v.rents, v.actions, v.costs, me()?.passes, overlay.kind === 'player' ? v.players : 0, overlay.kind === 'log' ? v.log.at(-1)?.n : 0]);
    if (!force && seen === overlaySeen) return;
    overlaySeen = seen;
    const scroll = layer.querySelector('.es-sheet')?.scrollTop ?? 0;
    const focusables = () => [...layer.querySelectorAll('button, input')];
    const focusedAt = focusables().indexOf(document.activeElement);
    const el = overlay.kind === 'city' ? citySheet(overlay.pos)
      : overlay.kind === 'cities' ? citiesSheet()
        : overlay.kind === 'player' ? playerSheet(overlay.id)
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
    if (e.key === 'Escape' && overlay) closeOverlay();
    // La barre d'espace lance l'action principale, sauf si on écrit quelque part ou qu'une fenêtre est ouverte.
    // Jamais pour un achat, une mise ou une vente : ce qui coûte de l'argent se décide à la main.
    if (e.code === 'Space' && !overlay && !e.repeat && v && myTurn() && ['roll', 'end'].includes(v.phase) && !/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName) && root.isConnected && root.offsetParent) {
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
    clock.textContent = left < 10500 ? `${Math.ceil(left / 1000)} s` : '';
  }, 250);

  api.onState((view, st) => {
    v = view;
    info = st;
    world?.update(v);
    playSounds();
    renderPlayers();
    before.cash = new Map(v.players.map((p) => [p.id, p.cash]));
    renderAction();
    if (overlay && overlay.kind !== 'trade') renderOverlay();
  });

  return () => {
    gone = true;
    clearInterval(tick);
    clearTimeout(flashTimer);
    document.removeEventListener('keydown', onKey);
    document.title = pageTitle;
    sound.destroy();
    world?.destroy();
  };
}
