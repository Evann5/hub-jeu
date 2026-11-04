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
  maroc: ['palmier', 'tajine', 'palmier'],
  vietnam: ['bambou', 'lanternePied', 'bambou'],
  portugal: ['citronnier', 'sardine', 'citronnier'],
  mexique: ['cactus', 'sombrero', 'cactus'],
  italie: ['cypres', 'vespa', 'cypres'],
  japon: ['cerisier', 'lanternePierre', 'cerisier'],
  france: ['reverbere', 'kiosque', 'reverbere'],
  usa: ['taxi', 'borne', 'taxi'],
};
