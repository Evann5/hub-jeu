// Petits outils d'affichage : création d'éléments, icônes, jetons, notifications, dates.

// h('button.btn', { onclick }, 'Texte') ; le texte passe toujours par textContent (pas d'injection HTML).
export function h(tag, props, ...children) {
  const [head, ...classes] = tag.split('.');
  const [name, id] = head.split('#');
  const el = document.createElement(name || 'div');
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) {
      el.addEventListener(k.slice(2), v);
      el.hasHandler = true; // changedOnly() ne garde un tel élément que s'il est identique
    }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style') el.style.cssText = v;
    else if (k in el && !k.includes('-') && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const PATHS = {
  hash: 'M5 9h14M4 15h14M10 3 8 21M16 3l-2 18',
  dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M8.5 8.5h.01 M15.5 8.5h.01 M12 12h.01 M8.5 15.5h.01 M15.5 15.5h.01',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  send: 'M22 2 11 13 M22 2l-7 20-4-9-9-4 20-7Z',
  smile: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M8 14s1.5 2 4 2 4-2 4-2 M9 9h.01 M15 9h.01',
  trash: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  plus: 'M12 5v14M5 12h14',
  x: 'M18 6 6 18M6 6l12 12',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  pencil: 'M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z',
  back: 'M15 18l-6-6 6-6',
  up: 'M18 15l-6-6-6 6',
  down: 'M6 9l6 6 6-6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z M21 21l-4.3-4.3',
  star: 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8Z',
  'star-fill': 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8Z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z M12 1v2 M12 21v2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M1 12h2 M21 12h2 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  trophy: 'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0Z M17 5h3v2a3 3 0 0 1-3 3 M7 5H4v2a3 3 0 0 0 3 3',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  open: 'M7 17 17 7 M8 7h9v9',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
};

// Logo d'un jeu : games/<id>/assets/logo.svg en masque, peint à l'encre du jeu (--g-ink). Sinon son emoji.
export function gameLogo(g) {
  if (!g.logo) return h('span.game-logo.is-emoji', { 'aria-hidden': 'true' }, g.emoji);
  const url = new URL(`games/${g.id}/assets/logo.svg`, document.baseURI).href;
  return h('span.game-logo', { 'aria-hidden': 'true', style: `--logo:url("${url}")` });
}

export function icon(name, label) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  if (name === 'star-fill') svg.setAttribute('fill', 'currentColor');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', PATHS[name]);
  svg.append(path);
  return svg;
}

let colors = {};
export function setColors(c) {
  colors = c;
}

export const colorOf = (name) => colors[name] || '#6B7F78';

// Petite étiquette à côté du pseudo de l'équipe : « admin » ou « modo ».
export const staffTag = (u) => (u?.role === 'admin' ? h('span.tag-admin', 'admin') : u?.role === 'modo' ? h('span.tag-admin.tag-modo', 'modo') : null);

// Jeton (avatar) : la photo, la tête du personnage (sur sa couleur) ou la silhouette, et un point vert s'il est en ligne.
// personnage -> data URL déjà dessinée, pour poser l'image tout de suite au prochain affichage.
// Gardées aussi dans le navigateur (localStorage) : à la visite suivante, les têtes s'affichent sans charger three ni rien redessiner.
// Changer HEADS_KEY quand le dessin des personnages change, pour repartir de zéro.
const HEADS_KEY = 'hubuno:tetes:1';
const HEADS_MAX = 120;
const heads = (() => {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(HEADS_KEY) || '{}')));
  } catch {
    return new Map();
  }
})();
let saveHeadsTimer = null;
function keepHead(key, url) {
  heads.set(key, url);
  while (heads.size > HEADS_MAX) heads.delete(heads.keys().next().value);
  clearTimeout(saveHeadsTimer);
  saveHeadsTimer = setTimeout(() => {
    try {
      localStorage.setItem(HEADS_KEY, JSON.stringify(Object.fromEntries(heads)));
    } catch {
      // stockage plein ou interdit (navigation privée) : on redessinera à la prochaine visite
    }
  }, 1000);
}
// Ce que montre l'avatar : la photo envoyée, la tête du personnage, ou la silhouette par défaut (comme sur les réseaux sociaux).
// user.pic vient du serveur ; un objet sans pic (ancien, ou dessiné par un jeu) : le personnage s'il existe, sinon la silhouette.
export function picOf(user) {
  if (user?.pic === 'photo' && user.photo) return 'photo';
  if (user?.pic === 'silhouette') return 'silhouette';
  return user?.character ? 'personnage' : 'silhouette';
}
const SILHOUETTE = 'img/silhouette.svg';

export function token(user, { size = '', online = false } = {}) {
  const pic = picOf(user);
  const el = h(`span.token${size ? `.token-${size}` : ''}${online ? '.is-online' : ''}.has-head${pic === 'silhouette' ? '.is-silhouette' : ''}`,
    { style: `--c:${colorOf(user?.color)}`, 'aria-hidden': 'true' });
  const put = (url) => el.append(h('img', { src: url, alt: '', decoding: 'async' }));
  if (pic === 'photo') put(user.photo);
  else if (pic === 'silhouette') put(SILHOUETTE);
  else {
    const key = JSON.stringify(user.character);
    if (heads.has(key)) put(heads.get(key));
    else {
      // Chargé à la demande : la page n'attend pas three pour s'afficher ; la silhouette tient la place pendant le dessin.
      const wait = h('img.is-wait', { src: SILHOUETTE, alt: '' });
      el.append(wait);
      import('./character.js').then((m) => m.characterImage(user.character, { head: true })).then((url) => {
        if (!url) return;
        keepHead(key, url);
        wait.remove();
        put(url);
      }).catch(() => {});
    }
  }
  return el;
}

// Un même message envoyé plusieurs fois reste affiché une seule fois, et dure un peu plus.
const activeToasts = new Map();

export function toast(text, { error = false, ms = 3500, action = false } = {}) {
  const same = typeof text === 'string' ? activeToasts.get(text) : null;
  if (same) {
    clearTimeout(same.timer);
    same.timer = setTimeout(same.end, ms);
    return same.el;
  }
  const el = h(`div.toast${error ? '.error' : ''}${action ? '.has-action' : ''}`, text);
  if (action) el.append(h('button.toast-close', { type: 'button', onclick: () => el.remove() }, icon('x', 'Fermer')));
  const box = document.getElementById('toasts');
  // Sur une table, le message se pose juste sous l'en-tête : il ne cache ni le titre ni « À toi de jouer ».
  const head = document.querySelector('.view-table .table-head');
  if (head) box.style.setProperty('--toast-top', `${Math.round(head.getBoundingClientRect().bottom) + 8}px`);
  else box.style.removeProperty('--toast-top');
  // Dans une conversation, il se pose au-dessus de la zone d'écriture : le brouillon reste visible et cliquable.
  const composer = document.querySelector('.view-messages.has-conv .composer-wrap');
  if (composer) box.style.setProperty('--toast-bottom', `${Math.round(window.innerHeight - composer.getBoundingClientRect().top) + 8}px`);
  else box.style.removeProperty('--toast-bottom');
  box.append(el);
  const end = () => {
    el.remove();
    if (typeof text === 'string') activeToasts.delete(text);
  };
  const timer = setTimeout(end, ms);
  if (typeof text === 'string') activeToasts.set(text, { el, end, timer });
  return el;
}

// Annonce un événement aux lecteurs d'écran, une seule fois (le reste de la page n'est pas lu en direct).
export function announce(text) {
  const box = document.getElementById('annonces');
  if (!box) return;
  box.textContent = '';
  setTimeout(() => { box.textContent = text; }, 50);
}

// Ce qui permet de retrouver un élément après qu'on a redessiné son écran.
export function focusKey(el) {
  const owner = el.closest('[data-id]')?.dataset.id ?? '';
  return `${owner}|${el.dataset.key ?? el.getAttribute('href') ?? el.getAttribute('title') ?? el.getAttribute('aria-label') ?? el.textContent}`;
}

export function findByKey(zone, key) {
  return [...zone.querySelectorAll('a, button, input, select, textarea, [tabindex]')].find((x) => !x.disabled && focusKey(x) === key);
}

// Redessine une zone sans perdre la place de la personne qui navigue au clavier.
export function keepFocus(zone, redraw) {
  const active = document.activeElement;
  const key = active && active !== zone && zone.contains(active) ? focusKey(active) : null;
  redraw();
  if (key !== null && !active.isConnected) findByKey(zone, key)?.focus({ preventScroll: true });
}

// Redessiner sans tout remplacer : changedOnly(zone).replaceChildren(...) s'emploie comme zone.replaceChildren(...), mais garde en place
// les éléments qui n'ont pas changé (même balise, mêmes attributs, même contenu). Pourquoi : un bouton remplacé entre l'appui et le
// relâchement de la souris perd son clic. Avec un écran redessiné à chaque message ou à chaque coup, « le bouton ne répond pas ».
// - deep : jusqu'où descendre dans un élément dont seul le contenu a changé (0 : on le remplace en entier) ;
// - un élément qui porte un gestionnaire (onclick…) n'est jamais gardé à moitié : identique, il reste ; sinon il est remplacé avec son gestionnaire.
function patch(zone, next, deep) {
  const old = [...zone.childNodes];
  next.forEach((n, i) => {
    const o = old[i];
    if (!o) zone.append(n);
    else if (o.isEqualNode(n)) return;
    else if (deep > 0 && o.nodeType === 1 && n.nodeType === 1 && !o.hasHandler && !n.hasHandler && o.cloneNode(false).isEqualNode(n.cloneNode(false))) patch(o, [...n.childNodes], deep - 1);
    else o.replaceWith(n);
  });
  old.slice(next.length).forEach((o) => o.remove());
}

export function changedOnly(zone, deep = 6) {
  return {
    replaceChildren(...children) {
      const next = children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false).map((c) => (c instanceof Node ? c : document.createTextNode(String(c))));
      keepFocus(zone, () => patch(zone, next, deep));
    },
  };
}

// Un groupe de choix (radios, onglets) : un seul arrêt de tabulation, puis les flèches, comme son rôle le promet.
export function arrowKeys(group) {
  const items = () => [...group.querySelectorAll('[role=radio], [role=tab]')];
  for (const x of items()) x.tabIndex = x.getAttribute('aria-checked') === 'true' || x.getAttribute('aria-selected') === 'true' ? 0 : -1;
  if (group.dataset.arrows) return group;
  group.dataset.arrows = '1';
  group.hasHandler = true;
  group.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const list = items().filter((x) => !x.disabled);
    const i = list.indexOf(document.activeElement);
    if (!step || i < 0) return;
    e.preventDefault();
    const next = list[(i + step + list.length) % list.length];
    next.focus();
    next.click();
  });
  return group;
}

const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const dayYearFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export const timeOf = (ts) => timeFmt.format(ts);

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(ts) {
  const now = new Date();
  const key = dayKey(ts);
  if (key === dayKey(now)) return "Aujourd’hui";
  if (key === dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return 'Hier';
  const label = new Date(ts).getFullYear() === now.getFullYear() ? dayFmt.format(ts) : dayYearFmt.format(ts);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function stamp(ts) {
  const key = dayKey(ts);
  if (key === dayKey(new Date())) return `aujourd’hui à ${timeOf(ts)}`;
  return `${dayLabel(ts).toLowerCase()} à ${timeOf(ts)}`;
}

// Texte d'un message : les adresses web deviennent des liens, le reste reste du texte.
const URL_RE = /\bhttps?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]'»]/g;
// Mentions « @pseudo » : surlignées si le pseudo existe (findUser rend { pseudo, me } ou null), en plus des liens.
const MENTION_RE = /@([\p{L}\p{N}_.-]{3,20})/gu;
function withMentions(text, findUser) {
  if (!findUser || !text.includes('@')) return [text];
  const out = [];
  let last = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    if (m.index > 0 && /[\p{L}\p{N}]/u.test(text[m.index - 1])) continue; // une adresse e-mail, pas une mention
    let name = m[1];
    let u = findUser(name);
    while (!u && /[._-]$/.test(name)) { // « @Lune.Verte. » : le point final n'est pas dans le pseudo
      name = name.slice(0, -1);
      u = findUser(name);
    }
    if (!u) continue;
    out.push(text.slice(last, m.index), h(`span.mention${u.me ? '.is-me' : ''}`, `@${u.pseudo}`));
    last = m.index + 1 + name.length;
  }
  out.push(text.slice(last));
  return out;
}

export function richText(text, findUser = null) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    out.push(...withMentions(text.slice(last, m.index), findUser));
    out.push(h('a', { href: m[0], target: '_blank', rel: 'noopener noreferrer nofollow' }, m[0]));
    last = m.index + m[0].length;
  }
  out.push(...withMentions(text.slice(last), findUser));
  return out;
}

// Le texte mentionne-t-il ce pseudo (« @pseudo », pas au milieu d'un mot ou d'une adresse e-mail) ?
export function mentions(text, pseudo) {
  const escaped = pseudo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Le pseudo s'arrête là : ni lettre, chiffre, tiret, ni un point suivi d'une suite (« @lea » n'est pas « @lea.m »).
  return new RegExp(`(^|[^\\p{L}\\p{N}])@${escaped}(?![\\p{L}\\p{N}_-]|\\.[\\p{L}\\p{N}_-])`, 'iu').test(text);
}

// « de Tom », « d’Anna » : le pseudo est choisi par la personne, l'élision aussi doit suivre.
export const de = (pseudo) => (/^[aàâeéèêëiîïoôöuùûüy]/i.test(pseudo) ? `d’${pseudo}` : `de ${pseudo}`);

const plural = new Intl.PluralRules('fr-FR');
export function count(n, one, many) {
  return `${n} ${plural.select(n) === 'one' ? one : many}`;
}
