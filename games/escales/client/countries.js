// L'identité de chaque pays sur la carte : son drapeau, le motif de son bandeau au sol, et les petits éléments posés dessus.
// Pour un nouveau pays : ajouter une entrée avec le même id que dans REGIONS (board.js).

function star(c, x, y, r, points = 5, inner = 0.42) {
  c.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const d = i % 2 ? r * inner : r;
    c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  c.closePath();
}

const bandsV = (c, x, y, w, h, colors) => colors.forEach((col, i) => {
  c.fillStyle = col;
  c.fillRect(x + (i * w) / colors.length, y, w / colors.length + 0.5, h);
});

// Les drapeaux, dessinés dans le rectangle (x, y, w, h).
export const FLAGS = {
  maroc: (c, x, y, w, h) => {
    c.fillStyle = '#C1272D';
    c.fillRect(x, y, w, h);
    star(c, x + w / 2, y + h / 2, h * 0.3, 5, 0.38);
    c.strokeStyle = '#006233';
    c.lineWidth = Math.max(1.5, h * 0.05);
    c.stroke();
  },
  vietnam: (c, x, y, w, h) => {
    c.fillStyle = '#DA251D';
    c.fillRect(x, y, w, h);
    star(c, x + w / 2, y + h / 2, h * 0.32);
    c.fillStyle = '#FFCD00';
    c.fill();
  },
  portugal: (c, x, y, w, h) => {
    c.fillStyle = '#006600';
    c.fillRect(x, y, w * 0.4, h);
    c.fillStyle = '#E8112D';
    c.fillRect(x + w * 0.4, y, w * 0.6, h);
    c.fillStyle = '#FFCD00';
    c.beginPath();
    c.arc(x + w * 0.4, y + h / 2, h * 0.24, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#FFFFFF';
    c.fillRect(x + w * 0.4 - h * 0.11, y + h / 2 - h * 0.13, h * 0.22, h * 0.26);
    c.fillStyle = '#C8102E';
    c.fillRect(x + w * 0.4 - h * 0.06, y + h / 2 - h * 0.08, h * 0.12, h * 0.16);
  },
  mexique: (c, x, y, w, h) => {
    bandsV(c, x, y, w, h, ['#006847', '#FFFFFF', '#CE1126']);
    c.fillStyle = '#8C5A2B';
    c.beginPath();
    c.arc(x + w / 2, y + h / 2, h * 0.15, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#006847';
    c.lineWidth = Math.max(1, h * 0.03);
    c.beginPath();
    c.arc(x + w / 2, y + h / 2, h * 0.22, 0.3, Math.PI - 0.3);
    c.stroke();
  },
  italie: (c, x, y, w, h) => bandsV(c, x, y, w, h, ['#009246', '#FFFFFF', '#CE2B37']),
  japon: (c, x, y, w, h) => {
    c.fillStyle = '#FFFFFF';
    c.fillRect(x, y, w, h);
    c.fillStyle = '#BC002D';
    c.beginPath();
    c.arc(x + w / 2, y + h / 2, h * 0.3, 0, Math.PI * 2);
    c.fill();
  },
  france: (c, x, y, w, h) => bandsV(c, x, y, w, h, ['#0055A4', '#FFFFFF', '#EF4135']),
  usa: (c, x, y, w, h) => {
    for (let i = 0; i < 13; i += 1) {
      c.fillStyle = i % 2 ? '#FFFFFF' : '#B22234';
      c.fillRect(x, y + (i * h) / 13, w, h / 13 + 0.5);
    }
    c.fillStyle = '#3C3B6E';
    c.fillRect(x, y, w * 0.42, (h * 7) / 13);
    c.fillStyle = '#FFFFFF';
    for (let r = 0; r < 4; r += 1) for (let k = 0; k < 5; k += 1) {
      c.beginPath();
      c.arc(x + (w * 0.42 * (k + 0.75)) / 5.5 + (r % 2 ? w * 0.02 : 0), y + ((h * 7) / 13) * ((r + 0.6) / 4.2), Math.max(0.8, h * 0.022), 0, Math.PI * 2);
      c.fill();
    }
  },
};

// Le motif du bandeau au sol de chaque pays, sur la couleur du pays.
export const PATTERNS = {
  maroc: (c, w, h) => { // zellige : des étoiles à huit branches
    for (let y = 0; y < h + 40; y += 50) for (let x = (y / 50) % 2 ? 25 : 0; x < w + 40; x += 50) {
      star(c, x, y, 19, 8, 0.62);
      c.fill();
    }
  },
  vietnam: (c, w, h) => { // des lanternes rondes
    for (let y = 22; y < h; y += 56) for (let x = (y % 112 > 56 ? 30 : 0) + 18; x < w; x += 62) {
      c.beginPath();
      c.ellipse(x, y, 17, 20, 0, 0, Math.PI * 2);
      c.fill();
      c.fillRect(x - 1.5, y - 30, 3, 10);
    }
  },
  portugal: (c, w, h) => { // azulejos
    for (let y = 0; y < h; y += 58) for (let x = 0; x < w; x += 58) {
      c.save();
      c.translate(x + 29, y + 29);
      for (let i = 0; i < 4; i += 1) {
        c.rotate(Math.PI / 2);
        c.beginPath();
        c.ellipse(0, -14, 7, 13, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      c.strokeRect(x + 1, y + 1, 56, 56);
    }
  },
  mexique: (c, w, h) => { // papel picado
    for (const y of [0, h - 26]) for (let x = 0; x < w; x += 44) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 40, y);
      c.lineTo(x + 40, y + 16);
      c.lineTo(x + 20, y + 26);
      c.lineTo(x, y + 16);
      c.closePath();
      c.fill();
    }
    for (let y = 56; y < h - 40; y += 40) for (let x = (y % 80 ? 20 : 0); x < w; x += 40) {
      star(c, x, y, 8, 4, 0.4);
      c.fill();
    }
  },
  italie: (c, w, h) => { // des arcades
    for (let y = 0; y < h; y += 62) for (let x = 0; x < w; x += 54) {
      c.beginPath();
      c.moveTo(x + 8, y + 58);
      c.lineTo(x + 8, y + 28);
      c.arc(x + 27, y + 28, 19, Math.PI, 0);
      c.lineTo(x + 46, y + 58);
      c.closePath();
      c.fill();
    }
  },
  japon: (c, w, h) => { // des vagues en écailles
    c.lineWidth = 3;
    for (let y = -10; y < h + 30; y += 21) for (let x = (Math.round((y + 10) / 21) % 2 ? 28 : 0) - 28; x < w + 28; x += 56) {
      for (const r of [28, 19, 10]) {
        c.beginPath();
        c.arc(x, y + 28, r, Math.PI, 0);
        c.stroke();
      }
    }
  },
  france: (c, w, h) => { // des pavés en éventail
    c.lineWidth = 3;
    for (let y = 0; y < h + 34; y += 34) for (let x = (y % 68 ? 34 : 0); x < w + 34; x += 68) {
      c.beginPath();
      c.arc(x, y, 34, 0, Math.PI);
      c.stroke();
    }
  },
  usa: (c, w, h) => { // des étoiles et des bandes
    for (let y = 12; y < h; y += 44) for (let x = (y % 88 > 44 ? 40 : 0) + 20; x < w; x += 80) {
      star(c, x, y + 6, 14);
      c.fill();
    }
  },
};

// Les éléments posés sur le bandeau de chaque pays (voir PROPS dans monuments.js).
export const PROPS_OF = {
  maroc: ['palmier', 'tajine'],
  vietnam: ['bambou', 'lanternePied'],
  portugal: ['citronnier', 'sardine'],
  mexique: ['cactus', 'sombrero'],
  italie: ['cypres', 'vespa'],
  japon: ['cerisier', 'lanternePierre'],
  france: ['reverbere', 'kiosque'],
  usa: ['taxi', 'borne'],
};

// ——— Les pays en plus ———
const bandsH = (c, x, y, w, h, colors, parts = colors.map(() => 1)) => {
  const total = parts.reduce((a, b) => a + b, 0);
  let at = y;
  colors.forEach((col, i) => {
    const hh = (h * parts[i]) / total;
    c.fillStyle = col;
    c.fillRect(x, at, w, hh + 0.5);
    at += hh;
  });
};
const inRect = (c, x, y, w, h, draw) => {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  draw();
  c.restore();
};
const disc = (c, x, y, r, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
};
const crescent = (c, x, y, r, light, back) => {
  disc(c, x, y, r, light);
  disc(c, x + r * 0.28, y, r * 0.8, back);
};

Object.assign(FLAGS, {
  israel: (c, x, y, w, h) => {
    bandsH(c, x, y, w, h, ['#FFFFFF', '#0038B8', '#FFFFFF', '#0038B8', '#FFFFFF'], [1.5, 1.3, 5, 1.3, 1.5]);
    c.strokeStyle = '#0038B8';
    c.lineWidth = Math.max(1.2, h * 0.045);
    const r = h * 0.2;
    for (const turn of [-Math.PI / 2, Math.PI / 2]) {
      c.beginPath();
      for (let i = 0; i < 3; i += 1) c.lineTo(x + w / 2 + Math.cos(turn + (i * 2 * Math.PI) / 3) * r, y + h / 2 + Math.sin(turn + (i * 2 * Math.PI) / 3) * r);
      c.closePath();
      c.stroke();
    }
  },
  coreeNord: (c, x, y, w, h) => {
    bandsH(c, x, y, w, h, ['#024FA2', '#FFFFFF', '#ED1C27', '#FFFFFF', '#024FA2'], [4, 1, 14, 1, 4]);
    disc(c, x + w * 0.36, y + h / 2, h * 0.26, '#FFFFFF');
    star(c, x + w * 0.36, y + h / 2, h * 0.24);
    c.fillStyle = '#ED1C27';
    c.fill();
  },
  congo: (c, x, y, w, h) => {
    c.fillStyle = '#007FFF';
    c.fillRect(x, y, w, h);
    inRect(c, x, y, w, h, () => {
      for (const [col, half] of [['#F7D618', 0.2], ['#CE1021', 0.14]]) {
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(x - w * half, y + h);
        c.lineTo(x + w * (1 - half), y);
        c.lineTo(x + w * (1 + half), y);
        c.lineTo(x + w * half, y + h);
        c.closePath();
        c.fill();
      }
    });
    star(c, x + w * 0.17, y + h * 0.27, h * 0.2);
    c.fillStyle = '#F7D618';
    c.fill();
  },
  coreeSud: (c, x, y, w, h) => {
    c.fillStyle = '#FFFFFF';
    c.fillRect(x, y, w, h);
    const r = h * 0.24;
    const [cx, cy] = [x + w / 2, y + h / 2];
    c.fillStyle = '#CD2E3A';
    c.beginPath();
    c.arc(cx, cy, r, Math.PI, 0);
    c.fill();
    c.fillStyle = '#0047A0';
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI);
    c.fill();
    disc(c, cx - r / 2, cy, r / 2, '#CD2E3A');
    disc(c, cx + r / 2, cy, r / 2, '#0047A0');
    c.fillStyle = '#111111';
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      c.save();
      c.translate(cx + sx * w * 0.32, cy + sy * h * 0.31);
      c.rotate((sx * sy * Math.PI) / 5);
      for (let i = -1; i <= 1; i += 1) c.fillRect(-w * 0.055, i * h * 0.05 - h * 0.018, w * 0.11, h * 0.036);
      c.restore();
    }
  },
  chine: (c, x, y, w, h) => {
    c.fillStyle = '#DE2910';
    c.fillRect(x, y, w, h);
    c.fillStyle = '#FFDE00';
    star(c, x + w * 0.18, y + h * 0.28, h * 0.17);
    c.fill();
    for (const [px, py] of [[0.34, 0.12], [0.4, 0.23], [0.4, 0.37], [0.34, 0.47]]) {
      star(c, x + w * px, y + h * py, h * 0.055);
      c.fill();
    }
  },
  inde: (c, x, y, w, h) => {
    bandsH(c, x, y, w, h, ['#FF9933', '#FFFFFF', '#138808']);
    c.strokeStyle = '#000080';
    c.lineWidth = Math.max(1, h * 0.03);
    c.beginPath();
    c.arc(x + w / 2, y + h / 2, h * 0.12, 0, Math.PI * 2);
    c.stroke();
    disc(c, x + w / 2, y + h / 2, h * 0.03, '#000080');
  },
  thailande: (c, x, y, w, h) => bandsH(c, x, y, w, h, ['#A51931', '#F4F5F8', '#2D2A4A', '#F4F5F8', '#A51931'], [1, 1, 2, 1, 1]),
  turquie: (c, x, y, w, h) => {
    c.fillStyle = '#E30A17';
    c.fillRect(x, y, w, h);
    crescent(c, x + w * 0.38, y + h / 2, h * 0.25, '#FFFFFF', '#E30A17');
    star(c, x + w * 0.58, y + h / 2, h * 0.12);
    c.fillStyle = '#FFFFFF';
    c.fill();
  },
  egypte: (c, x, y, w, h) => {
    bandsH(c, x, y, w, h, ['#CE1126', '#FFFFFF', '#111111']);
    disc(c, x + w / 2, y + h / 2, h * 0.1, '#C09300');
  },
  algerie: (c, x, y, w, h) => {
    bandsV(c, x, y, w, h, ['#006233', '#FFFFFF']);
    crescent(c, x + w * 0.48, y + h / 2, h * 0.25, '#D21034', '#FFFFFF');
    star(c, x + w * 0.6, y + h / 2, h * 0.13);
    c.fillStyle = '#D21034';
    c.fill();
  },
  senegal: (c, x, y, w, h) => {
    bandsV(c, x, y, w, h, ['#00853F', '#FDEF42', '#E31B23']);
    star(c, x + w / 2, y + h / 2, h * 0.17);
    c.fillStyle = '#00853F';
    c.fill();
  },
  bresil: (c, x, y, w, h) => {
    c.fillStyle = '#009C3B';
    c.fillRect(x, y, w, h);
    c.fillStyle = '#FFDF00';
    c.beginPath();
    c.moveTo(x + w * 0.5, y + h * 0.1);
    c.lineTo(x + w * 0.93, y + h * 0.5);
    c.lineTo(x + w * 0.5, y + h * 0.9);
    c.lineTo(x + w * 0.07, y + h * 0.5);
    c.closePath();
    c.fill();
    disc(c, x + w / 2, y + h / 2, h * 0.2, '#002776');
  },
  argentine: (c, x, y, w, h) => {
    bandsH(c, x, y, w, h, ['#74ACDF', '#FFFFFF', '#74ACDF']);
    disc(c, x + w / 2, y + h / 2, h * 0.1, '#F6B40E');
  },
  espagne: (c, x, y, w, h) => bandsH(c, x, y, w, h, ['#AA151B', '#F1BF00', '#AA151B'], [1, 2, 1]),
  royaumeUni: (c, x, y, w, h) => {
    c.fillStyle = '#012169';
    c.fillRect(x, y, w, h);
    inRect(c, x, y, w, h, () => {
      for (const [col, lw] of [['#FFFFFF', h * 0.2], ['#C8102E', h * 0.08]]) {
        c.strokeStyle = col;
        c.lineWidth = lw;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + w, y + h);
        c.moveTo(x + w, y);
        c.lineTo(x, y + h);
        c.stroke();
      }
      for (const [col, t] of [['#FFFFFF', h * 0.34], ['#C8102E', h * 0.2]]) {
        c.fillStyle = col;
        c.fillRect(x + w / 2 - t / 2, y, t, h);
        c.fillRect(x, y + h / 2 - t / 2, w, t);
      }
    });
  },
  australie: (c, x, y, w, h) => {
    c.fillStyle = '#00247D';
    c.fillRect(x, y, w, h);
    FLAGS.royaumeUni(c, x, y, w * 0.5, h * 0.5);
    c.fillStyle = '#FFFFFF';
    star(c, x + w * 0.25, y + h * 0.75, h * 0.13, 7);
    c.fill();
    for (const [px, py] of [[0.75, 0.2], [0.62, 0.45], [0.88, 0.42], [0.75, 0.8]]) {
      star(c, x + w * px, y + h * py, h * 0.07, 7);
      c.fill();
    }
  },
});

// Les motifs des bandeaux : simples, à la couleur fournie par la scène.
const dots = (step, r) => (c, w, h) => {
  for (let y = 0; y < h + step; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < w + step; x += step) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
};
const stripes = (step, t) => (c, w, h) => {
  c.lineWidth = t;
  c.beginPath();
  for (let x = -h; x < w + h; x += step) {
    c.moveTo(x, h);
    c.lineTo(x + h, 0);
  }
  c.stroke();
};
const stars = (step, r, points = 5) => (c, w, h) => {
  for (let y = 0; y < h + step; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < w + step; x += step) {
    star(c, x, y, r, points);
    c.fill();
  }
};
const diamonds = (step, r) => (c, w, h) => {
  for (let y = 0; y < h + step; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < w + step; x += step) {
    c.beginPath();
    c.moveTo(x, y - r);
    c.lineTo(x + r, y);
    c.lineTo(x, y + r);
    c.lineTo(x - r, y);
    c.closePath();
    c.fill();
  }
};
Object.assign(PATTERNS, {
  israel: stars(58, 17, 6), coreeNord: stars(60, 15), congo: stripes(46, 10), coreeSud: dots(44, 11),
  chine: stars(56, 14), inde: diamonds(46, 13), thailande: diamonds(58, 17), turquie: stars(62, 12),
  egypte: diamonds(40, 11), algerie: stars(52, 13, 8), senegal: dots(52, 14), bresil: stripes(58, 14),
  argentine: dots(60, 18), espagne: stripes(40, 8), royaumeUni: diamonds(64, 20), australie: stars(50, 11, 7),
});
Object.assign(PROPS_OF, {
  israel: ['palmier', 'citronnier'], coreeNord: ['cypres', 'lanternePierre'], congo: ['palmier', 'bambou'], coreeSud: ['cerisier', 'lanternePierre'],
  chine: ['bambou', 'lanternePied'], inde: ['palmier', 'lanternePied'], thailande: ['bambou', 'lanternePied'], turquie: ['cypres', 'kiosque'],
  egypte: ['palmier', 'tajine'], algerie: ['palmier', 'tajine'], senegal: ['palmier', 'sardine'], bresil: ['palmier', 'citronnier'],
  argentine: ['cypres', 'borne'], espagne: ['citronnier', 'sardine'], royaumeUni: ['reverbere', 'kiosque'], australie: ['palmier', 'sardine'],
});
