// =====================================================================
// Spellaho - Gabarit de carte, partage par le jeu et le generateur
// ---------------------------------------------------------------------
// Module ES pur : ni fs ni path, pour que le navigateur puisse le
// charger. tools/generate-cards.js s en sert pour ecrire les fichiers de
// la Collection, game.js pour dessiner les cartes en partie avec les
// statistiques du moment - une creature buffee ou blessee doit afficher
// ses valeurs reelles, pas celles de sa fiche.
//
// Les deux appelants fournissent leur propre resolution de chemin
// d image : relative au dossier des cartes pour le generateur, a la
// racine du site pour le jeu.
// =====================================================================
export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function wrapText(text, maxChars) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function textBlock(lines, x, y, size, fill, weight = 500, lineHeight = 26) {
  return lines
    .map((line, index) => {
      return `<text x="${x}" y="${y + index * lineHeight}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`;
    })
    .join("\n  ");
}

export const G = {
  W: 744,
  H: 1038,
  marge: 24,
  couronne: { y: 40, h: 116 },
  gemme: { r: 44, cy: 98, cxG: 100, cxD: 644 },
  cartouche: { x: 160, w: 424, y: 58, h: 80 },
  type: { x: 96, w: 552, y: 168, h: 52 },
  art: { x: 56, y: 232, w: 632, h: 432 },
  panneau: { x: 56, y: 680, w: 632, h: 262 },
  socle: { y: 946, h: 62 },
  // Les medaillons mordent volontairement sur le bas du panneau : c est ce
  // chevauchement qui les fait paraitre sertis dans le cadre plutot que
  // poses dessus. Leur bord bas reste a 12 px du bord de carte.
  medaillon: { r: 53, cy: 966, cxG: 112, cxD: 632 },
  // Terrains et sorts posent leur piece au centre, sous la citation : son
  // sommet doit rester sous la derniere ligne de texte, son bas dans la
  // carte. Les 84 px libres sous le panneau n autorisent pas plus.
  medaillonCentral: { r: 37, cy: 977 }
};

// Teintes de matiere. La couleur elementaire ne sert qu'aux details -
// contours, gemmes, filets - jamais en aplat sur toute la carte.
const MATIERE = {
  encre: "#1d120c",
  encreDouce: "#4a3524",
  parcheminHaut: "#fbf1dc",
  parcheminBas: "#e4cfa8",
  or: "#e8c477",
  orSombre: "#8a6526",
  fond: "#140d0b"
};

const centre = (zone) => zone.x + zone.w / 2;

// Le titre doit tenir dans son cartouche sans jamais deborder : la taille
// descend par paliers selon la longueur reelle du nom.
// Emprise de l illustration dans la carte, en pourcentages : le jeu y
// superpose la video des cartes animees sans avoir a redire ou elle est.
export const RAYON_CARTE = { x: (22 / 744) * 100, y: (22 / 1038) * 100 };

export const ZONE_ART = {
  gauche: (G.art.x / G.W) * 100,
  haut: (G.art.y / G.H) * 100,
  largeur: (G.art.w / G.W) * 100,
  hauteur: (G.art.h / G.H) * 100
};

export function tailleTitre(nom) {
  const n = String(nom).length;
  if (n <= 14) return 40;
  if (n <= 18) return 35;
  if (n <= 24) return 30;
  if (n <= 30) return 26;
  return 22;
}

// Paliers cales sur la largeur reelle des capitales, verifiee au moteur de
// rendu : n x (taille x 0,75 + interlettre) doit rester sous la largeur
// utile du bandeau.
export function tailleType(texte) {
  const n = String(texte).length;
  if (n <= 28) return 24;
  if (n <= 32) return 20;
  if (n <= 36) return 18;
  if (n <= 40) return 16;
  if (n <= 44) return 14;
  return 13;
}

// Gemme sertie : logement sombre, jonc d'or, biseau, pierre, reflet. Les
// couches successives lui donnent l'air enchassee dans le cadre plutot que
// posee dessus. Structure identique a gauche et a droite.
function gemme(cx, cy, r, teinte, teinteClaire, contenu) {
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r + 8}" fill="${MATIERE.fond}" opacity="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="url(#orBrosse)"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="none" stroke="${MATIERE.orSombre}" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${teinte}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#pierre)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${teinteClaire}" stroke-width="2" opacity="0.75"/>
    <ellipse cx="${cx}" cy="${cy - r * 0.42}" rx="${r * 0.52}" ry="${r * 0.3}" fill="#ffffff" opacity="0.2"/>
    ${contenu}
  </g>`;
}

// Ornement d'angle repris aux quatre coins de l'illustration : deux traits
// et un point. Discret, mais il enleve l'aspect rectangle a bordure.
function equerre(x, y, sx, sy, teinte) {
  return `<g transform="translate(${x} ${y}) scale(${sx} ${sy})" fill="none" stroke="${teinte}" stroke-width="3" opacity="0.9">
    <path d="M0 24 L0 6 Q0 0 6 0 L24 0"/>
    <path d="M7 32 L7 13 Q7 7 13 7 L32 7" opacity="0.5"/>
    <circle cx="14" cy="14" r="2.5" fill="${teinte}" stroke="none"/>
  </g>`;
}

// Badge de mot-cle : petite plaque gravee, volontairement plus sobre que
// le texte de capacite qu'elle accompagne.
function badges(mots, x, y, teinte) {
  const hauteur = 30;
  const limite = x + G.panneau.w - 56;
  let curseur = x;
  const sortie = [];
  for (const mot of (Array.isArray(mots) ? mots : []).slice(0, 4)) {
    const largeur = Math.min(200, 20 + String(mot).length * 10.5);
    if (curseur + largeur > limite) break;
    sortie.push(`<g>
    <rect x="${curseur}" y="${y}" width="${largeur}" height="${hauteur}" rx="7" fill="#f4e5c8"/>
    <rect x="${curseur}" y="${y}" width="${largeur}" height="${hauteur}" rx="7" fill="none" stroke="${teinte}" stroke-width="1.6" opacity="0.8"/>
    <rect x="${curseur + 2}" y="${y + 2}" width="${largeur - 4}" height="${hauteur - 4}" rx="5" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.55"/>
    <text x="${curseur + largeur / 2}" y="${y + 20}" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="${MATIERE.encreDouce}">${escapeXml(mot)}</text>
  </g>`);
    curseur += largeur + 10;
  }
  return sortie.join("\n  ");
}

// Medaillon du socle : meme construction que les gemmes du haut, avec un
// symbole qui dit sa fonction sans qu'on ait a lire le chiffre.
function medaillonIllustre(cx, cy, r, piece, valeur, image) {
  const chiffre = String(valeur ?? "");
  const rayon = Math.round(r * (piece.echelle || 1));
  // Le chiffre vise le centre MESURE de la zone d accueil, pas le centre
  // geometrique de l image : le disque de l attaque est decale a droite,
  // et la masse du coeur se tient 11 % plus haut que le milieu.
  const cxTexte = cx + ((piece.centre.x - 50) / 100) * rayon * 2;
  const cyTexte = cy + ((piece.centre.y - 50) / 100) * rayon * 2;
  const taille = Math.round(r * 0.94);
  const contour = Math.max(5, Math.round(taille * 0.18));
  const voile = chiffre
    ? `<circle cx="${cxTexte}" cy="${cyTexte}" r="${Math.round(taille * 0.92)}" fill="url(#voileChiffre)" opacity="${piece.voile}"/>`
    : "";
  const texte = chiffre
    ? `<text x="${cxTexte}" y="${cyTexte + taille * 0.35}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${taille}" font-weight="700" fill="#ffffff" stroke="#0a0705" stroke-width="${contour}" stroke-linejoin="round" paint-order="stroke">${escapeXml(chiffre)}</text>`
    : "";
  return `<g>
    <image href="${image(piece.fichier)}" x="${cx - rayon}" y="${cy - rayon}" width="${rayon * 2}" height="${rayon * 2}"/>
    ${voile}
    ${texte}
  </g>`;
}

// Centres mesures sur les pieces elles-memes, en pourcentage de leur cote.
// `echelle` egalise les silhouettes : a taille egale, le coeur couvrait
// 1,10 fois la surface visible de l attaque, d ou son air plus massif.
// `voile` fonce le fond juste sous le chiffre. Il est indispensable sur
// l or clair de l attaque, ou du blanc seul tombait a 1,7:1 de contraste,
// et reste discret sur le rouge sombre du coeur.
const MEDAILLONS = {
  attaque: { fichier: "Images/Medaillons/Attaque.png", centre: { x: 55.7, y: 46.3 }, echelle: 1, voile: 0.55 },
  vie: { fichier: "Images/Medaillons/Coeur.png", centre: { x: 49.9, y: 38.5 }, echelle: 0.95, voile: 0.52 },
  source: { fichier: "Images/Medaillons/Terrain.png", centre: { x: 49.9, y: 47.9 }, echelle: 1, voile: 0.4 },
  sort: { fichier: "Images/Medaillons/Sort.png", centre: { x: 49.8, y: 50.3 }, echelle: 1, voile: 0 }
};

const SYMBOLE_ATTAQUE = `<path d="M-11 6 L0 -14 L11 6 L6 6 L0 -4 L-6 6 Z" fill="#ffe0ae"/>`;
const SYMBOLE_VIE = `<path d="M0 8 C-12 -2 -10 -13 -4 -13 C-1 -13 0 -11 0 -9 C0 -11 1 -13 4 -13 C10 -13 12 -2 0 8 Z" fill="#ffd5cb"/>`;
const SYMBOLE_MANA = `<path d="M0 -13 C7 -5 11 0 11 4 A11 11 0 0 1 -11 4 C-11 0 -7 -5 0 -13 Z" fill="#e8f2ff"/>`;
const SYMBOLE_SORT = `<path d="M0 -14 L3.6 -4.4 L14 -4.4 L5.6 2 L9 12 L0 6 L-9 12 L-5.6 2 L-14 -4.4 L-3.6 -4.4 Z" fill="#ffeec4"/>`;

function dessinerCarte(card, contexte) {
  const { elements: ELEMENTS, image } = contexte;
  const isLand = card.kind === "land";
  const isSpell = card.kind === "spell";
  const element = ELEMENTS[card.family];
  const teinte = card.palette.primary;
  const teinteClaire = card.palette.secondary;
  const teinteSombre = card.palette.deep;

  const artHref = image(card.image);
  // Remplir le cadre est la regle ; contain reste possible au cas par cas
  // pour une illustration qu'un recadrage mutilerait.
  const artFit = card.art?.svgFit || card.art?.fit || "cover";
  const artAspectRatio = artFit === "contain" ? "xMidYMid meet" : "xMidYMid slice";

  const corpsLarge = wrapText(card.abilityText, 52);
  const capaciteTaille = corpsLarge.length <= 4 ? 20 : 18;
  const abilityLines = (capaciteTaille === 20 ? corpsLarge : wrapText(card.abilityText, 58)).slice(0, 4);
  const capaciteInterligne = capaciteTaille === 20 ? 27 : 24;
  const flavorLines = card.art?.svgFlavor === false ? [] : wrapText(card.flavor, 54).slice(0, 2);
  const topValue = isLand ? card.energy || 1 : card.cost;

  // Identite de categorie : le terrain recoit un cadre de pierre batie, la
  // creature un cadre plus organique. Meme grille, matiere differente.
  const matiereCadre = isLand ? "url(#cadrePierre)" : "url(#cadreBois)";

  const socle = isLand
    ? `${medaillonIllustre(centre(G.panneau), G.medaillonCentral.cy, G.medaillonCentral.r, MEDAILLONS.source, topValue, image)}
  <text x="${G.medaillon.cxG}" y="${G.medaillonCentral.cy + 6}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="17" font-weight="700" letter-spacing="2" fill="${MATIERE.or}" opacity="0.9">SOURCE</text>
  <text x="${G.medaillon.cxD}" y="${G.medaillonCentral.cy + 6}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="17" font-weight="700" letter-spacing="2" fill="${MATIERE.or}" opacity="0.9">${escapeXml((element?.nom || card.family).toUpperCase().slice(0, 9))}</text>`
    : isSpell
      ? `${medaillonIllustre(centre(G.panneau), G.medaillonCentral.cy, G.medaillonCentral.r, MEDAILLONS.sort, "", image)}
  <text x="${G.medaillon.cxG}" y="${G.medaillonCentral.cy + 6}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="17" font-weight="700" letter-spacing="2" fill="${MATIERE.or}" opacity="0.9">RITUEL</text>
  <text x="${G.medaillon.cxD}" y="${G.medaillonCentral.cy + 6}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="17" font-weight="700" letter-spacing="2" fill="${MATIERE.or}" opacity="0.9">${escapeXml((element?.nom || card.family).toUpperCase().slice(0, 9))}</text>`
      : `${medaillonIllustre(G.medaillon.cxG, G.medaillon.cy, G.medaillon.r, MEDAILLONS.attaque, card.attack, image)}
  ${medaillonIllustre(G.medaillon.cxD, G.medaillon.cy, G.medaillon.r, MEDAILLONS.vie, card.life, image)}
  <text x="${centre(G.panneau)}" y="${G.medaillonCentral.cy + 6}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="17" font-weight="700" letter-spacing="3" fill="${MATIERE.or}" opacity="0.85">${escapeXml((element?.nom || card.family).toUpperCase().slice(0, 10))}</text>`;

  const contenuGemmeCout = `<text x="${G.gemme.cxG}" y="${G.gemme.cy + 15}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="42" font-weight="700" fill="#fff8e4">${escapeXml(String(topValue))}</text>`;
  const contenuGemmeElement = element?.icone
    ? `<image href="${image(element.icone)}" x="${G.gemme.cxD - G.gemme.r + 3}" y="${G.gemme.cy - G.gemme.r + 3}" width="${G.gemme.r * 2 - 6}" height="${G.gemme.r * 2 - 6}" clip-path="url(#clipElement)"/>`
    : `<text x="${G.gemme.cxD}" y="${G.gemme.cy + 8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="800" fill="#fff8e4">${escapeXml((element?.nom || card.family).slice(0, 7))}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${G.W}" height="${G.H}" viewBox="0 0 ${G.W} ${G.H}" role="img" aria-label="${escapeXml(card.name)}">
  <defs>
    <linearGradient id="cadreBois" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="${teinteClaire}" stop-opacity="0.55"/>
      <stop offset="18%" stop-color="${teinte}"/>
      <stop offset="55%" stop-color="${teinteSombre}"/>
      <stop offset="100%" stop-color="${teinte}" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="cadrePierre" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0%" stop-color="#8d8377"/>
      <stop offset="24%" stop-color="${teinte}"/>
      <stop offset="62%" stop-color="${teinteSombre}"/>
      <stop offset="100%" stop-color="#6d6459"/>
    </linearGradient>
    <linearGradient id="orBrosse" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#f6dfa6"/>
      <stop offset="45%" stop-color="${MATIERE.or}"/>
      <stop offset="100%" stop-color="${MATIERE.orSombre}"/>
    </linearGradient>
    <linearGradient id="parchemin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${MATIERE.parcheminHaut}"/>
      <stop offset="100%" stop-color="${MATIERE.parcheminBas}"/>
    </linearGradient>
    <radialGradient id="pierre" cx="0.35" cy="0.28" r="0.85">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.4"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.5"/>
    </radialGradient>
    <radialGradient id="voileChiffre">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.95"/>
      <stop offset="62%" stop-color="#000000" stop-opacity="0.82"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="creuxHaut" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.4"/>
      <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="clipArt"><rect x="${G.art.x}" y="${G.art.y}" width="${G.art.w}" height="${G.art.h}" rx="6"/></clipPath>
    <clipPath id="clipElement"><circle cx="${G.gemme.cxD}" cy="${G.gemme.cy}" r="${G.gemme.r - 3}"/></clipPath>
  </defs>

  <rect width="${G.W}" height="${G.H}" rx="22" fill="${MATIERE.fond}"/>
  <rect x="${G.marge - 12}" y="${G.marge - 12}" width="${G.W - (G.marge - 12) * 2}" height="${G.H - (G.marge - 12) * 2}" rx="18" fill="${matiereCadre}"/>
  <rect x="${G.marge - 12}" y="${G.marge - 12}" width="${G.W - (G.marge - 12) * 2}" height="${G.H - (G.marge - 12) * 2}" rx="18" fill="none" stroke="${MATIERE.or}" stroke-width="1.5" opacity="0.5"/>
  <rect x="${G.marge}" y="${G.marge}" width="${G.W - G.marge * 2}" height="${G.H - G.marge * 2}" rx="14" fill="none" stroke="${MATIERE.orSombre}" stroke-width="2" opacity="0.8"/>
  <rect x="${G.marge + 8}" y="${G.marge + 8}" width="${G.W - (G.marge + 8) * 2}" height="${G.H - (G.marge + 8) * 2}" rx="10" fill="#191110" opacity="0.5"/>

  <rect x="${G.gemme.cxG}" y="${G.couronne.y + 20}" width="${G.gemme.cxD - G.gemme.cxG}" height="${G.couronne.h - 48}" fill="url(#orBrosse)" opacity="0.28"/>
  <rect x="${G.cartouche.x - 14}" y="${G.cartouche.y - 8}" width="${G.cartouche.w + 28}" height="${G.cartouche.h + 16}" rx="12" fill="${MATIERE.fond}" opacity="0.85"/>
  <rect x="${G.cartouche.x - 10}" y="${G.cartouche.y - 4}" width="${G.cartouche.w + 20}" height="${G.cartouche.h + 8}" rx="10" fill="url(#orBrosse)"/>
  <rect x="${G.cartouche.x}" y="${G.cartouche.y}" width="${G.cartouche.w}" height="${G.cartouche.h}" rx="7" fill="url(#parchemin)"/>
  <rect x="${G.cartouche.x}" y="${G.cartouche.y}" width="${G.cartouche.w}" height="${G.cartouche.h}" rx="7" fill="url(#creuxHaut)" opacity="0.3"/>
  <rect x="${G.cartouche.x + 4}" y="${G.cartouche.y + 4}" width="${G.cartouche.w - 8}" height="${G.cartouche.h - 8}" rx="5" fill="none" stroke="${teinteSombre}" stroke-width="1.5" opacity="0.45"/>
  <text x="${centre(G.cartouche)}" y="${G.cartouche.y + G.cartouche.h / 2 + tailleTitre(card.name) * 0.35}" text-anchor="middle" font-family="Georgia, 'Palatino Linotype', 'Book Antiqua', serif" font-size="${tailleTitre(card.name)}" font-weight="700" fill="${MATIERE.encre}">${escapeXml(card.name)}</text>

  ${gemme(G.gemme.cxG, G.gemme.cy, G.gemme.r, teinteSombre, teinteClaire, contenuGemmeCout)}
  ${gemme(G.gemme.cxD, G.gemme.cy, G.gemme.r, teinteSombre, teinteClaire, contenuGemmeElement)}

  <rect x="${G.type.x - 6}" y="${G.type.y - 4}" width="${G.type.w + 12}" height="${G.type.h + 8}" rx="9" fill="url(#orBrosse)" opacity="0.92"/>
  <rect x="${G.type.x}" y="${G.type.y}" width="${G.type.w}" height="${G.type.h}" rx="6" fill="url(#parchemin)"/>
  <rect x="${G.type.x}" y="${G.type.y}" width="${G.type.w}" height="${G.type.h}" rx="6" fill="url(#creuxHaut)" opacity="0.26"/>
  <text x="${centre(G.type)}" y="${G.type.y + G.type.h / 2 + tailleType(card.type) * 0.36}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${tailleType(card.type)}" font-weight="700" letter-spacing="0.8" fill="${MATIERE.encreDouce}">${escapeXml(String(card.type).toUpperCase())}</text>

  <rect x="${G.art.x - 10}" y="${G.art.y - 10}" width="${G.art.w + 20}" height="${G.art.h + 20}" rx="10" fill="${MATIERE.fond}" opacity="0.9"/>
  <rect x="${G.art.x - 6}" y="${G.art.y - 6}" width="${G.art.w + 12}" height="${G.art.h + 12}" rx="8" fill="url(#orBrosse)"/>
  <image href="${artHref}" x="${G.art.x}" y="${G.art.y}" width="${G.art.w}" height="${G.art.h}" preserveAspectRatio="${artAspectRatio}" clip-path="url(#clipArt)"/>
  <rect x="${G.art.x}" y="${G.art.y}" width="${G.art.w}" height="${G.art.h}" rx="6" fill="none" stroke="#000000" stroke-width="6" opacity="0.26"/>
  <rect x="${G.art.x}" y="${G.art.y}" width="${G.art.w}" height="${G.art.h}" rx="6" fill="none" stroke="${teinteClaire}" stroke-width="2" opacity="0.85"/>
  ${equerre(G.art.x + 7, G.art.y + 7, 1, 1, MATIERE.or)}
  ${equerre(G.art.x + G.art.w - 7, G.art.y + 7, -1, 1, MATIERE.or)}
  ${equerre(G.art.x + 7, G.art.y + G.art.h - 7, 1, -1, MATIERE.or)}
  ${equerre(G.art.x + G.art.w - 7, G.art.y + G.art.h - 7, -1, -1, MATIERE.or)}

  <rect x="${G.panneau.x - 6}" y="${G.panneau.y - 6}" width="${G.panneau.w + 12}" height="${G.panneau.h + 12}" rx="10" fill="url(#orBrosse)" opacity="0.92"/>
  <rect x="${G.panneau.x}" y="${G.panneau.y}" width="${G.panneau.w}" height="${G.panneau.h}" rx="7" fill="url(#parchemin)"/>
  <rect x="${G.panneau.x}" y="${G.panneau.y}" width="${G.panneau.w}" height="${G.panneau.h}" rx="7" fill="url(#creuxHaut)" opacity="0.24"/>
  <rect x="${G.panneau.x + 5}" y="${G.panneau.y + 5}" width="${G.panneau.w - 10}" height="${G.panneau.h - 10}" rx="5" fill="none" stroke="${teinteSombre}" stroke-width="1.4" opacity="0.4"/>
  <text x="${G.panneau.x + 28}" y="${G.panneau.y + 42}" font-family="Georgia, 'Times New Roman', serif" font-size="25" font-weight="700" fill="${teinteSombre}">${escapeXml(card.abilityName)}</text>
  ${textBlock(abilityLines, G.panneau.x + 28, G.panneau.y + 80, capaciteTaille, MATIERE.encre, 400, capaciteInterligne)}
  ${badges(card.keywords, G.panneau.x + 28, G.panneau.y + 174, teinteSombre)}
  <line x1="${G.panneau.x + 28}" y1="${G.panneau.y + 216}" x2="${G.panneau.x + G.panneau.w - 28}" y2="${G.panneau.y + 216}" stroke="${MATIERE.encreDouce}" stroke-width="1.2" opacity="0.3"/>
  <text x="${centre(G.panneau)}" y="${G.panneau.y + 234}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="17" font-style="italic" fill="${MATIERE.encreDouce}">${escapeXml(flavorLines[0] || "")}</text>
  <text x="${centre(G.panneau)}" y="${G.panneau.y + 254}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="17" font-style="italic" fill="${MATIERE.encreDouce}">${escapeXml(flavorLines[1] || "")}</text>

  <rect x="${G.art.x}" y="${G.socle.y}" width="${G.art.w}" height="${G.socle.h}" rx="8" fill="url(#orBrosse)" opacity="0.2"/>
  ${socle}
  <rect x="${G.marge + 8}" y="${G.H - G.marge - 10}" width="${G.W - (G.marge + 8) * 2}" height="10" rx="5" fill="${matiereCadre}"/>
  <rect x="${G.marge + 8}" y="${G.H - G.marge - 10}" width="${G.W - (G.marge + 8) * 2}" height="10" rx="5" fill="none" stroke="${MATIERE.orSombre}" stroke-width="1.5" opacity="0.9"/>
  <rect x="${G.marge + 14}" y="${G.H - G.marge - 9}" width="${G.W - (G.marge + 14) * 2}" height="2" rx="1" fill="${MATIERE.or}" opacity="0.55"/>
</svg>`;
}

// Tous les identifiants declares dans <defs>. Ils doivent etre uniques
// dans le document des lors que plusieurs cartes y coexistent.
const IDENTIFIANTS_INTERNES = [
  "cadreBois",
  "cadrePierre",
  "orBrosse",
  "parchemin",
  "pierre",
  "voileChiffre",
  "creuxHaut",
  "clipArt",
  "clipElement"
];

// `prefixe` rend les identifiants propres a une instance. La Collection
// s en passe - chaque SVG y est un document separe - mais le jeu les
// injecte cote a cote dans une meme page.
export function cardSvg(card, contexte) {
  const svg = dessinerCarte(card, contexte);
  const prefixe = contexte && contexte.prefixe;
  if (!prefixe) return svg;
  let sortie = svg;
  for (const nom of IDENTIFIANTS_INTERNES) {
    sortie = sortie.split(`id="${nom}"`).join(`id="${prefixe}-${nom}"`);
    sortie = sortie.split(`url(#${nom})`).join(`url(#${prefixe}-${nom})`);
  }
  return sortie;
}

export { IDENTIFIANTS_INTERNES };
