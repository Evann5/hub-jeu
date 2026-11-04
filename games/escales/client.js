// Escales côté navigateur : le monde en 3D (client/scene.js), et par-dessus l'interface : les joueurs, la carte du bas
// qui dit quoi faire, et les fenêtres (une ville, toutes les villes, proposer un échange). Les règles restent côté serveur (rules.js).
import { REGIONS, TILES, LEVEL_MULT, LEVEL_NAMES, MAX_LEVEL, ESCALE_RENTS, FLY_COST } from './client/board.js';
import { createWorld, PAWN_COLORS } from './client/scene.js';

const money = (n) => `${Number(n).toLocaleString('fr-FR')} €`;

const ABOUT = {
  start: 'Tu touches 200 € à chaque passage, 100 € de plus si ton patrimoine fait moins de la moitié de celui du premier.',
  customs: 'Simple visite si tu tombes dessus. Retenu ici : fais un double, paie 50 € ou présente un passe-douane. Au troisième échec, tu paies et tu avances.',
  festival: 'Choisis une de tes villes : son loyer double jusqu’à ton prochain tour.',
  control: 'Direction la Douane, sans passer par le Départ.',
  telex: 'Une dépêche au hasard : bonne ou mauvaise nouvelle.',
  tax: 'Impôts : 10 % de ton argent, 50 € au moins. Taxe de séjour : 100 €.',
  chantier: 'Si tu as la majorité d’une région, tu y construis un niveau à moitié prix.',
};

export function mount(root, api) {
  const { h } = api;
  let v = null;
  let info = null;
  let promptKey = null;
  let overlay = null; // { kind: 'city', pos } | { kind: 'cities' } | { kind: 'trade' }
  let draft = null;
  let world = null;
  let gone = false;

  const meId = api.me.id;
  const send = (action) => api.sendMove(action).catch(() => {});
  const nameOf = (id) => (id === meId ? 'Toi' : v.players.find((p) => p.id === id)?.pseudo ?? '?');
  const me = () => v.players.find((p) => p.id === meId);
  const myTurn = () => !v.over && v.players[v.cur].id === meId;

  // ——— Éléments fixes ———
  const stage = h('div.es-world');
  const players = h('div.es-players', { role: 'list', 'aria-label': 'Joueurs' });
  const news = h('p.es-news');
  const round = h('p.es-round');
  const prompt = h('div.es-prompt');
  const trades = h('div.es-trades');
  const tools = h('div.es-tools',
    h('button.es-link', { type: 'button', onclick: () => openOverlay({ kind: 'cities' }) }, 'Villes'),
    h('button.es-link', { type: 'button', onclick: () => openTrade() }, 'Échanger'),
    h('button.es-link', { type: 'button', onclick: () => world?.recenter() }, 'Recentrer'));
  const logBox = h('p.es-log', { 'aria-live': 'polite' });
  const timer = h('div.es-timer', h('i'));
  const dock = h('section.es-dock', timer, round, news, prompt, trades, logBox);
  const layer = h('div.es-layer');
  const loading = h('p.es-loading', 'Le plateau arrive…');
  root.append(h('div.es', stage, loading, players, tools, dock, layer));

  // ——— Le monde 3D. Les étiquettes des cases sont dessinées avec la police du jeu : on l'attend d'abord. ———
  Promise.all([document.fonts.load('800 40px "ES Figtree"'), document.fonts.load('600 30px "ES Figtree"')]).catch(() => {}).finally(() => {
    if (gone) return;
    try {
      world = createWorld(stage, { onTile: (pos) => openOverlay({ kind: 'city', pos }) });
      if (v) world.update(v);
      loading.remove();
    } catch (err) {
      loading.remove();
      console.error(err);
      stage.replaceChildren(h('p.es-no3d', 'Ton navigateur n’affiche pas la 3D. Tu peux quand même jouer avec la carte ci-dessous et le bouton Villes.'));
    }
  });

  function renderPlayers() {
    players.replaceChildren(...v.players.map((p) => {
      const dot = h('i.es-dot');
      dot.style.background = PAWN_COLORS[p.seat];
      const turn = !v.over && v.players[v.cur].id === p.id;
      return h(`div.es-chip${turn ? '.is-turn' : ''}${p.out ? '.is-out' : ''}`, { role: 'listitem' },
        dot,
        h('span.es-pseudo', p.id === meId ? 'Toi' : p.pseudo, p.bot ? h('small', ' robot') : null),
        h('span.es-cash', p.out ? 'Sorti' : money(p.cash)));
    }));
  }

  // ——— La carte du bas ———
  const cityCard = (pos) => {
    const t = TILES[pos];
    const el = h('button.es-mini', { type: 'button', onclick: () => openOverlay({ kind: 'city', pos }) },
      h('b', t.name),
      h('span', t.type === 'city' ? `${REGIONS[t.region].name}. ${t.fact}` : 'Une escale : de là, un vol pour une autre escale.'));
    if (t.type === 'city') el.style.setProperty('--r', REGIONS[t.region].color);
    return el;
  };
  const btn = (text, action, cls = '') => h(`button.es-btn${cls}`, { type: 'button', onclick: (e) => { e.currentTarget.disabled = true; send(action); } }, text);
  const say = (text) => h('p.es-say', text);

  function auctionPrompt() {
    const { pos, mine, eligible, hasBid } = v.auction;
    const t = TILES[pos];
    if (!eligible.includes(meId) || mine !== null) {
      return [say(mine !== null ? `Ta mise : ${mine ? money(mine) : 'tu passes'}. On attend les autres.` : `Enchères secrètes pour ${t.name}.`),
        cityCard(pos), say(`${hasBid.length} sur ${eligible.length} ont misé.`)];
    }
    const input = h('input.es-input', { type: 'number', min: 0, max: me().cash, step: 1, inputmode: 'numeric', value: String(Math.min(t.price, me().cash)), 'aria-label': 'Ta mise en euros' });
    const submit = (amount) => send({ type: 'bid', amount });
    return [say(`Enchères secrètes : combien pour ${t.name} ?`), cityCard(pos),
      h('form.es-bid', { noValidate: true, onsubmit: (e) => { e.preventDefault(); submit(Number(input.value) || 0); } },
        input, h('button.es-btn', { type: 'submit' }, 'Miser')),
      h('button.es-btn.is-ghost', { type: 'button', onclick: () => submit(0) }, 'Passer')];
  }

  function promptFor() {
    if (v.over) {
      const ranked = v.players.filter((p) => !p.out).sort((a, b) => b.worth - a.worth);
      return [h('p.es-big', v.winners.includes(meId) ? 'Tu gagnes !' : `${v.winners.map(nameOf).join(' et ') || 'Personne ne'} gagne !`),
        h('ol.es-rank', ranked.map((p) => h('li', h('span', p.pseudo), h('b', money(p.worth)))))];
    }
    if (v.phase === 'auction') return auctionPrompt();
    const p = v.players[v.cur];
    const t = TILES[p.pos];
    if (!myTurn()) {
      const doing = { roll: 'va lancer les dés', buy: `hésite devant ${t.name}`, fly: 'choisit sa destination', festival: 'organise un festival', chantier: 'lance un chantier', debt: `cherche ${money(v.debt?.amount ?? 0)}`, end: 'gère ses villes' };
      return [say(`${p.pseudo} ${doing[v.phase] ?? 'joue'}.`)];
    }
    const a = v.actions;
    switch (v.phase) {
      case 'roll':
        if (p.blocked) {
          return [say(`Tu es retenu à la Douane (essai ${p.blocked} sur 3).`),
            btn('Tenter un double', { type: 'roll' }),
            p.cash >= 50 ? btn('Payer 50 €', { type: 'payFine' }, '.is-ghost') : null,
            p.passes ? btn('Utiliser un passe-douane', { type: 'usePass' }, '.is-ghost') : null];
        }
        return [say(v.again ? 'Un double : tu rejoues !' : 'À toi de jouer.'), btn('Lancer les dés', { type: 'roll' })];
      case 'buy':
        return [cityCard(p.pos),
          p.cash >= t.price ? btn(`Acheter ${t.name} : ${money(t.price)}`, { type: 'buy' }) : say(`Il te manque ${money(t.price - p.cash)} pour ${t.name}.`),
          btn('Laisser aux enchères', { type: 'decline' }, '.is-ghost')];
      case 'fly':
        return [say(`Tu peux t’envoler pour ${money(FLY_COST)}, sans passer par le Départ.`),
          h('div.es-row', ...TILES.filter((x) => x.type === 'escale' && x.pos !== p.pos).map((x) => btn(x.name, { type: 'fly', pos: x.pos }, '.is-ghost.is-small'))),
          btn('Rester ici', { type: 'skip' })];
      case 'festival':
        return [say('Festival : quelle ville fait la fête ? Son loyer double jusqu’à ton prochain tour.'),
          h('div.es-row', ...a.festival.map((pos) => btn(TILES[pos].name, { type: 'festival', pos }, '.is-ghost.is-small'))),
          btn('Passer', { type: 'skip' }, '.is-ghost')];
      case 'chantier':
        return [say('Chantier : un niveau à moitié prix.'),
          h('div.es-row', ...a.chantier.map((pos) => btn(`${TILES[pos].name} (${money(Math.floor(v.costs[pos] / 2))})`, { type: 'chantier', pos }, '.is-ghost.is-small'))),
          btn('Passer', { type: 'skip' }, '.is-ghost')];
      case 'debt':
        return [say(`Tu dois ${money(v.debt.amount)} ${v.debt.why}. Vends ou mets en gage depuis « Villes », ou négocie avec un joueur.`),
          p.cash >= v.debt.amount ? btn(`Payer ${money(v.debt.amount)}`, { type: 'pay' }) : null,
          btn('Déclarer faillite', { type: 'bankrupt' }, '.is-danger')];
      case 'end':
        return [say('Construis si tu veux, puis termine ton tour.'), btn('Terminer mon tour', { type: 'endTurn' })];
      default:
        return [];
    }
  }

  function renderDock() {
    round.textContent = `${v.maxRounds ? `Tour ${Math.min(v.round, v.maxRounds)} sur ${v.maxRounds}` : `Tour ${v.round}`}${v.dice ? `, dés ${v.dice[0]} et ${v.dice[1]}` : ''}`;
    news.textContent = v.event?.text ?? '';
    news.hidden = !v.event || v.over;

    const key = JSON.stringify([v.phase, v.cur, v.rollN, v.over, v.auction?.pos, v.auction?.mine,
      v.phase === 'auction' && v.auction.mine !== null ? v.auction.hasBid.length : 0,
      v.phase === 'auction' ? 0 : me()?.cash, v.actions, v.debt?.amount]);
    if (key !== promptKey) {
      promptKey = key;
      prompt.replaceChildren(...promptFor().filter(Boolean));
    }

    trades.replaceChildren(...v.trades.filter((t) => t.to === meId || t.from === meId).map(tradeCard));
    tools.hidden = v.over;
    logBox.textContent = v.log.filter((l) => !l.text.startsWith('À la une')).at(-1)?.text ?? '';
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
    renderOverlay();
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
    const head = h('header.es-poster', h('h2', t.name), h('p', t.type === 'city' ? REGIONS[t.region].name : 'Escale'));
    if (t.type === 'city') head.style.setProperty('--r', REGIONS[t.region].color);
    const lines = t.type === 'city'
      ? [['Ville seule', t.rent], ['Majorité de la région', t.rent * 2], ['Région complète', t.rent * 3],
        ...LEVEL_MULT.slice(1).map((m, i) => [LEVEL_NAMES[i + 1], t.rent * m])]
      : ESCALE_RENTS.slice(1).map((r, i) => [`${i + 1} escale${i ? 's' : ''}`, r]);
    return shell(t.name, head,
      h('p.es-fact', t.fact ?? `Le propriétaire encaisse selon ses escales. De là, un vol pour une autre escale coûte ${money(FLY_COST)}.`),
      h('p', owner ? `${owner.id === meId ? 'À toi' : `À ${owner.pseudo}`}${prop.mortgaged ? ', en gage' : ''}. Loyer actuel : ${money(v.rents[pos] ?? 0)}.` : `Libre. Prix : ${money(t.price)}.`),
      prop?.level ? h('p', `Niveau : ${LEVEL_NAMES[prop.level]} (${prop.level} sur ${MAX_LEVEL}).`) : null,
      h('dl.es-rents', lines.map(([k, val]) => [h('dt', k), h('dd', money(val))])),
      t.build ? h('p.es-note', `Construire un niveau coûte ${money(v.costs[pos] ?? t.build)}. Il faut ${v.majority} villes de la région.`) : null,
      h('div.es-row',
        a.build.includes(pos) ? btn(`Construire (${money(v.costs[pos])})`, { type: 'build', pos }) : null,
        a.unmortgage.includes(pos) ? btn('Récupérer', { type: 'unmortgage', pos }) : null,
        a.sell.includes(pos) ? btn('Vendre un niveau', { type: 'sell', pos }, '.is-ghost') : null,
        a.mortgage.includes(pos) ? btn('Mettre en gage', { type: 'mortgage', pos }, '.is-ghost') : null));
  }

  function citiesSheet() {
    const row = (pos) => {
      const t = TILES[pos];
      const prop = v.props[pos];
      const owner = prop ? v.players.find((p) => p.id === prop.owner) : null;
      const el = h('button.es-line', { type: 'button', onclick: () => openOverlay({ kind: 'city', pos }) },
        h('b', t.name),
        h('span', owner ? `${owner.id === meId ? 'À toi' : owner.pseudo}${prop.mortgaged ? ', en gage' : `, loyer ${money(v.rents[pos] ?? 0)}`}${prop.level ? `, ${LEVEL_NAMES[prop.level]}` : ''}` : `Libre, ${money(t.price)}`));
      if (t.type === 'city') el.style.setProperty('--r', REGIONS[t.region].color);
      return h('li', el);
    };
    const mine = TILES.filter((t) => v.props[t.pos]?.owner === meId).map((t) => t.pos);
    return shell('Villes', h('h2', 'Villes'),
      me()?.passes ? h('p.es-note', `Tu as ${me().passes} passe-douane.`) : null,
      mine.length ? [h('h3', 'À toi'), h('ul.es-list', mine.map(row))] : null,
      REGIONS.map((r, i) => [h('h3', r.name), h('ul.es-list', TILES.filter((t) => t.region === i).map((t) => row(t.pos)))]),
      h('h3', 'Escales'), h('ul.es-list', TILES.filter((t) => t.type === 'escale').map((t) => row(t.pos))));
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
          },
        }, TILES[pos].name);
        if (TILES[pos].type === 'city') el.style.setProperty('--r', REGIONS[TILES[pos].region].color);
        return el;
      })) : h('p.es-note', 'Aucune ville échangeable.');
    };
    const giveCash = h('input.es-input', { type: 'number', min: 0, step: 1, value: '0', inputmode: 'numeric', 'aria-label': 'Argent que tu donnes' });
    const getCash = h('input.es-input', { type: 'number', min: 0, step: 1, value: '0', inputmode: 'numeric', 'aria-label': 'Argent que tu demandes' });
    return shell('Proposer un échange', h('h2', 'Proposer un échange'),
      h('div.es-picks', others.map((p) => h(`button.es-pick${p.id === draft.to ? '.is-on' : ''}`, {
        type: 'button',
        onclick: () => { draft.to = p.id; draft.get = new Set(); renderOverlay(); },
      }, p.pseudo))),
      h('h3', 'Tu donnes'), picker(meId, draft.give), h('label.es-field', 'Argent', giveCash),
      h('h3', `Tu demandes à ${nameOf(draft.to)}`), picker(draft.to, draft.get), h('label.es-field', 'Argent', getCash),
      h('div.es-row', h('button.es-btn', {
        type: 'button',
        onclick: () => {
          api.sendMove({ type: 'trade', to: draft.to, give: { cash: Number(giveCash.value) || 0, cities: [...draft.give] }, get: { cash: Number(getCash.value) || 0, cities: [...draft.get] } })
            .then(closeOverlay).catch(() => {});
        },
      }, 'Envoyer la proposition')));
  }

  function renderOverlay() {
    if (!overlay || !v) return;
    const scroll = layer.querySelector('.es-sheet')?.scrollTop ?? 0;
    const el = overlay.kind === 'city' ? citySheet(overlay.pos) : overlay.kind === 'cities' ? citiesSheet() : tradeSheet();
    layer.replaceChildren(el);
    const sheet = el.querySelector('.es-sheet');
    if (sheet) sheet.scrollTop = scroll;
    el.querySelector('.es-close')?.focus({ preventScroll: true });
  }

  const onKey = (e) => {
    if (e.key === 'Escape' && overlay) closeOverlay();
  };
  document.addEventListener('keydown', onKey);

  // ——— Minuteur ———
  const tick = setInterval(() => {
    if (!info?.deadline) {
      timer.hidden = true;
      return;
    }
    const total = v?.phase === 'auction' ? 20000 : (v?.timer || 60) * 1000;
    const left = Math.max(0, info.deadline - api.now());
    timer.hidden = false;
    timer.firstChild.style.width = `${Math.min(100, (left / total) * 100)}%`;
    timer.classList.toggle('is-low', left < 8000);
  }, 250);

  api.onState((view, st) => {
    v = view;
    info = st;
    world?.update(v);
    renderPlayers();
    renderDock();
    if (overlay && overlay.kind !== 'trade') renderOverlay();
  });

  return () => {
    gone = true;
    clearInterval(tick);
    document.removeEventListener('keydown', onKey);
    world?.destroy();
  };
}
