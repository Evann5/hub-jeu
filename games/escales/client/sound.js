// Les sons d'Escales, fabriqués à la volée (aucun fichier à charger). Le navigateur n'autorise le son qu'après un premier geste du joueur.
const KEY = 'escales-son';

export function createSound() {
  let ctx = null;
  let out = null; // la sortie commune : elle évite la saturation quand plusieurs sons se superposent
  let muted = false;
  try {
    muted = localStorage.getItem(KEY) === 'non';
  } catch { /* pas de stockage : le son reste actif */ }

  const unlock = () => {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
      out = ctx.createDynamicsCompressor();
      const master = ctx.createGain();
      master.gain.value = 2.6; // mesuré : sans ça, les sons plafonnent à 18 % du maximum, presque rien sur un haut-parleur de téléphone
      out.connect(master).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  };
  // Sur téléphone, le son ne se débloque qu'à la fin d'un geste : on écoute plusieurs événements.
  const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
  GESTURES.forEach((g) => document.addEventListener(g, unlock));

  const ready = () => ctx && !muted && ctx.state === 'running';

  const tone = (freq, at, dur, { type = 'sine', vol = 0.12, to = null } = {}) => {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  };

  const knock = (at, vol = 0.14, freq = 1800) => {
    const t = ctx.currentTime + at;
    const len = Math.floor(ctx.sampleRate * 0.035);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(out);
    src.start(t);
  };

  const play = (fn) => () => {
    if (ready()) fn();
  };

  return {
    dice: play(() => [0, 0.09, 0.17, 0.27, 0.4, 0.56].forEach((at, i) => { knock(at, 0.2 - i * 0.022, 1500 + i * 180); tone(240 - i * 12, at, 0.05, { vol: 0.05 }); })),
    step: play(() => knock(0, 0.16, 900)),
    buy: play(() => { tone(880, 0, 0.09, { type: 'triangle' }); tone(1320, 0.08, 0.22, { type: 'triangle' }); }),
    gain: play(() => { tone(1046, 0, 0.1, { vol: 0.07 }); tone(1568, 0.07, 0.2, { vol: 0.07 }); }),
    pay: play(() => tone(320, 0, 0.24, { type: 'triangle', vol: 0.2, to: 170 })),
    build: play(() => { knock(0, 0.32, 500); tone(180, 0, 0.2, { vol: 0.28, to: 90 }); knock(0.1, 0.22, 700); }),
    turn: play(() => { tone(587, 0, 0.12, { vol: 0.08 }); tone(784, 0.1, 0.2, { vol: 0.08 }); }),
    // Les pièces qui volent : une par pièce, au même rythme que l'animation.
    coins: play(() => [0, 0.07, 0.14, 0.21, 0.28, 0.35, 0.42].forEach((at, i) => { tone(2600 + (i % 3) * 700, 0.5 + at, 0.09, { vol: 0.035 }); tone(4100 + (i % 2) * 500, 0.5 + at, 0.05, { vol: 0.018 }); })),
    fail: play(() => [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.16, 0.34, { type: 'triangle', vol: 0.1 }))),
    win: play(() => {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.13, 0.4, { type: 'triangle', vol: 0.09 }));
      [1046, 1318, 1568].forEach((f) => tone(f, 0.56, 0.9, { type: 'triangle', vol: 0.05 })); // l'accord final, tenu
    }),
    isMuted: () => muted,
    toggle() {
      muted = !muted;
      try {
        localStorage.setItem(KEY, muted ? 'non' : 'oui');
      } catch { /* tant pis : le choix vaut pour cette partie */ }
      return muted;
    },
    destroy() {
      GESTURES.forEach((g) => document.removeEventListener(g, unlock));
      ctx?.close().catch(() => {});
    },
  };
}
