// Les sons d'Escales, fabriqués à la volée (aucun fichier à charger). Le navigateur n'autorise le son qu'après un premier geste du joueur.
const KEY = 'escales-son';

export function createSound() {
  let ctx = null;
  let muted = false;
  try {
    muted = localStorage.getItem(KEY) === 'non';
  } catch { /* pas de stockage : le son reste actif */ }

  const unlock = () => {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  };
  document.addEventListener('pointerdown', unlock);

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
    o.connect(g).connect(ctx.destination);
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
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
  };

  const play = (fn) => () => {
    if (ready()) fn();
  };

  return {
    dice: play(() => [0, 0.09, 0.17, 0.27, 0.4, 0.56].forEach((at, i) => knock(at, 0.2 - i * 0.022, 1500 + i * 180))),
    step: play(() => knock(0, 0.05, 900)),
    buy: play(() => { tone(880, 0, 0.09, { type: 'triangle' }); tone(1320, 0.08, 0.22, { type: 'triangle' }); }),
    gain: play(() => { tone(1046, 0, 0.1, { vol: 0.07 }); tone(1568, 0.07, 0.2, { vol: 0.07 }); }),
    pay: play(() => tone(320, 0, 0.2, { type: 'triangle', vol: 0.1, to: 170 })),
    build: play(() => { knock(0, 0.18, 500); tone(180, 0, 0.14, { vol: 0.14, to: 90 }); knock(0.1, 0.12, 700); }),
    turn: play(() => { tone(587, 0, 0.12, { vol: 0.08 }); tone(784, 0.1, 0.2, { vol: 0.08 }); }),
    bid: play(() => tone(660, 0, 0.1, { type: 'square', vol: 0.03 })),
    win: play(() => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.13, 0.4, { type: 'triangle', vol: 0.1 }))),
    isMuted: () => muted,
    toggle() {
      muted = !muted;
      try {
        localStorage.setItem(KEY, muted ? 'non' : 'oui');
      } catch { /* tant pis : le choix vaut pour cette partie */ }
      return muted;
    },
    destroy() {
      document.removeEventListener('pointerdown', unlock);
      ctx?.close().catch(() => {});
    },
  };
}
