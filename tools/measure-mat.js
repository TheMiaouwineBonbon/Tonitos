// Outil ponctuel : décode un PNG (truecolor 8 bits) sans dépendance et détecte
// les rectangles sombres (zones cartes) du tapis pour caler les zones du plateau.
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

function decodePng(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("Pas un PNG");
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error("bitDepth non gere: " + bitDepth);
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : null;
  if (!channels) throw new Error("colorType non gere: " + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const rawVal = raw[rowStart + x];
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      let val;
      if (filter === 0) val = rawVal;
      else if (filter === 1) val = rawVal + a;
      else if (filter === 2) val = rawVal + b;
      else if (filter === 3) val = rawVal + ((a + b) >> 1);
      else if (filter === 4) val = rawVal + paeth(a, b, c);
      else throw new Error("filtre inconnu " + filter);
      out[y * stride + x] = val & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

function luminance(img, x, y) {
  const i = (y * img.width + x) * img.channels;
  return 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
}

// Détecte les bornes d'une région sombre en balayant depuis un point de départ.
function darkExtent(img, cx, cy, threshold) {
  let left = cx;
  while (left > 0 && luminance(img, left - 1, cy) < threshold) left--;
  let right = cx;
  while (right < img.width - 1 && luminance(img, right + 1, cy) < threshold) right++;
  let top = cy;
  while (top > 0 && luminance(img, cx, top - 1) < threshold) top--;
  let bottom = cy;
  while (bottom < img.height - 1 && luminance(img, cx, bottom + 1) < threshold) bottom++;
  return { left, right, top, bottom };
}

function isGold(img, x, y) {
  const i = (y * img.width + x) * img.channels;
  const r = img.data[i];
  const g = img.data[i + 1];
  const b = img.data[i + 2];
  return r > 135 && g > 95 && b < 130 && r > b + 35;
}

// Trouve le cadre doré englobant en partant du centre de la zone : on balaye
// vers l'extérieur jusqu'à rencontrer une ligne dorée dans les deux sens.
function goldFrame(img, cx, cy) {
  const scanTo = (dir, axis) => {
    let x = cx;
    let y = cy;
    for (let step = 0; step < Math.max(img.width, img.height); step++) {
      if (axis === "x") x = cx + dir * step;
      else y = cy + dir * step;
      if (x < 1 || y < 1 || x >= img.width - 1 || y >= img.height - 1) break;
      if (isGold(img, x, y)) return axis === "x" ? x : y;
    }
    return axis === "x" ? (dir < 0 ? 0 : img.width - 1) : dir < 0 ? 0 : img.height - 1;
  };
  return {
    left: scanTo(-1, "x"),
    right: scanTo(1, "x"),
    top: scanTo(-1, "y"),
    bottom: scanTo(1, "y")
  };
}

const file = path.join(__dirname, "..", "Images", "Tapis de Jeu", "Tapis de jeu Joueur.png");
const img = decodePng(file);
console.log("Dimensions:", img.width, "x", img.height, "channels", img.channels);
const W = img.width;
const H = img.height;

// Points de sondage au centre de chaque zone dessinée (le champ évite le cercle).
const probes = {
  bibliotheque: [0.16, 0.38],
  cimetiere: [0.16, 0.72],
  exil: [0.84, 0.38],
  commandant: [0.84, 0.72],
  champ: [0.5, 0.62]
};

const pct = (v, total) => ((v / total) * 100).toFixed(2);

// Cadre central : balayages dirigés depuis l'extérieur vers l'intérieur, sur des
// lignes qui évitent les cadres d'angle, l'ornement du haut et le texte central.
function scanForGold(fromX, fromY, dx, dy) {
  let x = fromX;
  let y = fromY;
  for (let step = 0; step < Math.max(W, H); step++) {
    x = fromX + dx * step;
    y = fromY + dy * step;
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return dx ? x : y;
    if (isGold(img, Math.round(x), Math.round(y))) return dx ? x : y;
  }
  return dx ? x : y;
}
const champ = {
  top: scanForGold(W * 0.5, H * 0.13, 0, 1),
  bottom: scanForGold(W * 0.5, H * 0.9, 0, -1),
  left: scanForGold(W * 0.255, H * 0.5, 1, 0),
  right: scanForGold(W * 0.755, H * 0.5, -1, 0)
};
console.log(
  `champ (dirige)   px L${Math.round(champ.left)} R${Math.round(champ.right)} ` +
    `T${Math.round(champ.top)} B${Math.round(champ.bottom)}  => left:${pct(champ.left, W)}% ` +
    `top:${pct(champ.top, H)}% width:${pct(champ.right - champ.left, W)}% height:${pct(champ.bottom - champ.top, H)}%`
);

for (const [name, [px, py]] of Object.entries(probes)) {
  if (name === "champ") continue;
  const cx = Math.round(px * W);
  const cy = Math.round(py * H);
  const d = darkExtent(img, cx, cy, 70);
  console.log(
    `${name.padEnd(13)} sombre  px L${d.left} R${d.right} T${d.top} B${d.bottom}  ` +
      `=> left:${pct(d.left, W)}% top:${pct(d.top, H)}% ` +
      `width:${pct(d.right - d.left, W)}% height:${pct(d.bottom - d.top, H)}%`
  );
}
