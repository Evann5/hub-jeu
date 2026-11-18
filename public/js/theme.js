// Thème clair ou sombre : « Auto » suit le réglage de l'appareil. Le choix reste dans ce navigateur (localStorage).
// La page porte data-theme="light" ou "dark" ; les couleurs du thème clair sont dans app.css (:root[data-theme='light']).
import { h } from './dom.js';

const KEY = 'hubuno:theme';
const MODES = [
  { key: 'auto', label: 'Auto', hint: 'Comme l’appareil' },
  { key: 'sombre', label: 'Sombre', hint: 'Fond presque noir' },
  { key: 'clair', label: 'Clair', hint: 'Fond blanc' },
];
const media = window.matchMedia?.('(prefers-color-scheme: light)');

function saved() {
  try {
    const v = localStorage.getItem(KEY);
    return MODES.some((m) => m.key === v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(mode = saved()) {
  const light = mode === 'clair' || (mode === 'auto' && Boolean(media?.matches));
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#F4F4F6' : '#08080A');
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', light ? 'light' : 'dark');
}

function setTheme(mode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // navigation privée : le thème vaut pour cette visite seulement
  }
  applyTheme(mode);
}

applyTheme();
media?.addEventListener?.('change', () => applyTheme());

// La carte « Apparence » du profil.
export function themeCard() {
  const row = h('div.seg.theme-seg', { role: 'radiogroup', 'aria-label': 'Thème' });
  const draw = () => {
    const cur = saved();
    row.replaceChildren(...MODES.map((m) => h('button', {
      type: 'button',
      role: 'radio',
      'aria-checked': String(m.key === cur),
      title: m.hint,
      onclick: () => {
        setTheme(m.key);
        draw();
      },
    }, m.label)));
  };
  draw();
  return h('section.card.card-panel', h('h2', 'Apparence'), h('p.card-text', 'Le thème de Hubuno sur cet appareil.'), row);
}
