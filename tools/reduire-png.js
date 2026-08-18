// =====================================================================
// Spellaho - Reduction de PNG et masque circulaire
// ---------------------------------------------------------------------
// Node pur, via zlib : le projet n'ajoute aucune dependance d'image.
// Ne gere que le format des sources fournies - RGBA 8 bits, non entrelace.
//
// Usage : node tools/reduire-png.js <source> <destination> <taille> [rayon]
//   rayon : masque circulaire en fraction de la demi-largeur (0 = aucun).
//           Les icones de type arrivent sur un fond peint qu'il faut
//           effacer, sinon la carte porte un carre beige.
// =====================================================================
const fs = require("fs");
const zlib = require("zlib");

const TABLE_CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = TABLE_CRC[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Chaque ligne PNG porte son type de filtre en tete : on reconstruit les
// octets d'origine. 4 canaux 8 bits, donc le pixel de gauche est a -4.
function defiltrer(brut, largeur, hauteur) {
  const parLigne = largeur * 4;
  const sortie = Buffer.alloc(parLigne * hauteur);
  let source = 0;
  for (let y = 0; y < hauteur; y += 1) {
    const filtre = brut[source];
    source += 1;
    const debut = y * parLigne;
    const precedent = debut - parLigne;
    for (let x = 0; x < parLigne; x += 1) {
      const val = brut[source + x];
      const a = x >= 4 ? sortie[debut + x - 4] : 0;
      const b = y > 0 ? sortie[precedent + x] : 0;
      const c = x >= 4 && y > 0 ? sortie[precedent + x - 4] : 0;
      let resultat;
      if (filtre === 0) resultat = val;
      else if (filtre === 1) resultat = val + a;
      else if (filtre === 2) resultat = val + b;
      else if (filtre === 3) resultat = val + ((a + b) >> 1);
      else if (filtre === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        resultat = val + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(`filtre PNG inconnu : ${filtre}`);
      sortie[debut + x] = resultat & 0xff;
    }
    source += parLigne;
  }
  return sortie;
}

function lirePng(chemin) {
  const buffer = fs.readFileSync(chemin);
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("signature PNG absente");
  const largeur = buffer.readUInt32BE(16);
  const hauteur = buffer.readUInt32BE(20);
  const profondeur = buffer[24];
  const couleur = buffer[25];
  const entrelace = buffer[28];
  if (profondeur !== 8 || couleur !== 6 || entrelace !== 0) {
    throw new Error(`format non gere : profondeur ${profondeur}, couleur ${couleur}, entrelace ${entrelace}`);
  }
  const morceaux = [];
  let offset = 8;
  while (offset < buffer.length) {
    const taille = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") morceaux.push(buffer.subarray(offset + 8, offset + 8 + taille));
    if (type === "IEND") break;
    offset += 12 + taille;
  }
  return { largeur, hauteur, pixels: defiltrer(zlib.inflateSync(Buffer.concat(morceaux)), largeur, hauteur) };
}

// Moyenne par bloc, sur des couleurs premultipliees : sans cela les pixels
// transparents tirent la moyenne vers leur couleur et laissent un halo.
function reduire(image, cible) {
  const { largeur, hauteur, pixels } = image;
  const sortie = Buffer.alloc(cible * cible * 4);
  const cote = Math.max(largeur, hauteur);
  const margeX = (cote - largeur) / 2;
  const margeY = (cote - hauteur) / 2;
  for (let y = 0; y < cible; y += 1) {
    for (let x = 0; x < cible; x += 1) {
      const x0 = Math.floor((x * cote) / cible - margeX);
      const x1 = Math.ceil(((x + 1) * cote) / cible - margeX);
      const y0 = Math.floor((y * cote) / cible - margeY);
      const y1 = Math.ceil(((y + 1) * cote) / cible - margeY);
      let r = 0; let v = 0; let b = 0; let a = 0; let n = 0;
      for (let sy = Math.max(0, y0); sy < Math.min(hauteur, y1); sy += 1) {
        for (let sx = Math.max(0, x0); sx < Math.min(largeur, x1); sx += 1) {
          const i = (sy * largeur + sx) * 4;
          const alpha = pixels[i + 3] / 255;
          r += pixels[i] * alpha; v += pixels[i + 1] * alpha; b += pixels[i + 2] * alpha;
          a += pixels[i + 3]; n += 1;
        }
      }
      const o = (y * cible + x) * 4;
      if (n === 0) continue;
      const alphaMoyen = a / n;
      const facteur = alphaMoyen > 0 ? 255 / alphaMoyen : 0;
      sortie[o] = Math.min(255, Math.round((r / n) * facteur));
      sortie[o + 1] = Math.min(255, Math.round((v / n) * facteur));
      sortie[o + 2] = Math.min(255, Math.round((b / n) * facteur));
      sortie[o + 3] = Math.round(alphaMoyen);
    }
  }
  return { largeur: cible, hauteur: cible, pixels: sortie };
}

// Masque circulaire a bord adouci sur 3 % du rayon : le disque reste net,
// le fond peint des coins disparait.
function masquerCercle(image, rayonRelatif) {
  const { largeur, hauteur, pixels } = image;
  const cx = (largeur - 1) / 2;
  const cy = (hauteur - 1) / 2;
  const rayon = (Math.min(largeur, hauteur) / 2) * rayonRelatif;
  const fondu = Math.max(1, rayon * 0.03);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      let k = 1;
      if (d > rayon) k = Math.max(0, 1 - (d - rayon) / fondu);
      if (k < 1) {
        const i = (y * largeur + x) * 4;
        pixels[i + 3] = Math.round(pixels[i + 3] * k);
      }
    }
  }
  return image;
}

function ecrirePng(chemin, image) {
  const { largeur, hauteur, pixels } = image;
  const parLigne = largeur * 4;
  const brut = Buffer.alloc((parLigne + 1) * hauteur);
  for (let y = 0; y < hauteur; y += 1) {
    brut[y * (parLigne + 1)] = 0;
    pixels.copy(brut, y * (parLigne + 1) + 1, y * parLigne, (y + 1) * parLigne);
  }
  const morceau = (type, data) => {
    const taille = Buffer.alloc(4);
    taille.writeUInt32BE(data.length);
    const corps = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const controle = Buffer.alloc(4);
    controle.writeUInt32BE(crc32(corps));
    return Buffer.concat([taille, corps, controle]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(chemin, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau("IHDR", ihdr),
    morceau("IDAT", zlib.deflateSync(brut, { level: 9 })),
    morceau("IEND", Buffer.alloc(0))
  ]));
}

module.exports = { lirePng, reduire, masquerCercle, ecrirePng };

if (require.main === module) {
  const [source, destination, taille, rayon] = process.argv.slice(2);
  if (!source || !destination) {
    console.error("Usage : node tools/reduire-png.js <source> <destination> <taille> [rayon]");
    process.exit(1);
  }
  let image = reduire(lirePng(source), Number(taille) || 256);
  const r = rayon === undefined ? 0 : Number(rayon);
  if (r > 0) image = masquerCercle(image, r);
  ecrirePng(destination, image);
  const avant = fs.statSync(source).size;
  const apres = fs.statSync(destination).size;
  console.log(`${destination} : ${(avant / 1024).toFixed(0)} Ko -> ${(apres / 1024).toFixed(1)} Ko`);
}
