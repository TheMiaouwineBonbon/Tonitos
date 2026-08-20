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
//
// Le cout et la production de mana ne sont pas recalcules ici : ils
// viennent du moteur, pour qu une carte ne puisse jamais afficher autre
// chose que ce que le paiement applique reellement.
// =====================================================================
import { landProductionTokens, manaCostTokens } from "./engine-core.mjs";

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
      return `<text x="${x}" y="${y + index * lineHeight}" font-family="${POLICE_CORPS}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`;
    })
    .join("\n  ");
}

export const G = {
  W: 744,
  H: 1038,
  marge: 24,
  // En-tete en TROIS zones franchement separees, avec des marges fixes :
  //   [ cout ]   [ ------- titre ------- ]   [ element ]
  // Les jetons de cout tenaient auparavant sur deux rangees serrees contre
  // le cartouche ; ils formaient un amas qui touchait le titre et se
  // deformait des qu il y avait trois jetons. Ils occupent maintenant une
  // rangee unique, dans un bloc qui leur est reserve.
  // EN-TETE : une seule barre continue, divisee en trois compartiments
  // alignes. Les gemmes flottaient auparavant a cote du cartouche, ce qui
  // donnait un haut de carte encombre ou tout se frolait. Ici les trois
  // roles - cout, titre, element - vivent dans la meme barre, chacun dans
  // sa case, avec des retraits fixes.
  entete: { x: 32, y: 46, w: 680, h: 104, r: 14 },
  cout: { x: 32, w: 168, rJeton: 17, ecart: 7 },
  cartouche: { x: 210, w: 380, y: 58, h: 80 },
  element: { x: 600, w: 112, r: 38 },

  type: { x: 96, w: 552, y: 162, h: 52 },
  // L illustration cede 42 px au panneau de texte (+10 % de police) et au
  // socle (stats doublees) : c est la seule bande qui peut donner de la
  // hauteur sans rien perdre, puisqu elle est cadree en « cover ».
  art: { x: 56, y: 226, w: 632, h: 390 },
  panneau: { x: 56, y: 628, w: 632, h: 260 },

  // SOCLE : meme principe que l en-tete, une barre unique. Les medaillons
  // debordaient du cadre par le bas ; ils tiennent maintenant entierement
  // dedans, quel que soit le type de carte.
  // Le logement d un medaillon mesure r + 9 : avec r = 40 il occupe 98 px
  // dans une barre de 100, donc il tient ENTIEREMENT dedans. Ce rayon
  // double la taille des chiffres d attaque et de vie (22 -> 45 px).
  socle: { x: 32, y: 900, w: 680, h: 100, r: 14 },
  medaillon: { r: 40, cy: 950, cxG: 96, cxD: 648 },
  medaillonCentral: { r: 36, cy: 950 },
  // Logo Terrain, dans le compartiment de cout.
  logoTerrain: { r: 40 }
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
  fond: "#140d0b",
  // Surlignage du numero de collection : le dore sur cadre clair devenait
  // illisible. Pastille noire, chiffres jaunes, lisibles sur les six teintes.
  noir: "#0b0a0c",
  jaune: "#ffd84a"
};

const centre = (zone) => zone.x + zone.w / 2;

// Milieu vertical de l en-tete et du socle : tout ce qui s y pose s aligne
// dessus, ce qui suffit a garantir un centrage regulier.
const AXE_ENTETE = () => G.entete.y + G.entete.h / 2;
const AXE_SOCLE = () => G.socle.y + G.socle.h / 2;

// Compartiment creuse dans une barre : fond sombre, lisere d or. C est lui
// qui donne a chaque information sa propre case, au lieu de la laisser
// flotter contre sa voisine.
function compartiment(x, y, w, h, rayon = 10) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rayon}" fill="${MATIERE.fond}" opacity="0.55"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rayon}" fill="none" stroke="${MATIERE.orSombre}" stroke-width="1.4" opacity="0.75"/>`;
}

// Barre pleine largeur, commune a l en-tete et au socle : meme matiere,
// meme rayon, meme lisere. C est ce qui harmonise le haut et le bas.
function barre(zone, matiere) {
  return `<rect x="${zone.x - 3}" y="${zone.y - 3}" width="${zone.w + 6}" height="${zone.h + 6}" rx="${zone.r + 3}" fill="${MATIERE.fond}" opacity="0.85"/>
  <rect x="${zone.x}" y="${zone.y}" width="${zone.w}" height="${zone.h}" rx="${zone.r}" fill="${matiere}"/>
  <rect x="${zone.x}" y="${zone.y}" width="${zone.w}" height="${zone.h}" rx="${zone.r}" fill="url(#creuxHaut)" opacity="0.22"/>
  <rect x="${zone.x + 3}" y="${zone.y + 3}" width="${zone.w - 6}" height="${zone.h - 6}" rx="${zone.r - 3}" fill="none" stroke="${MATIERE.or}" stroke-width="1.2" opacity="0.5"/>`;
}

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

// Largeur reelle des caracteres de Georgia gras, en em, mesuree dans le
// navigateur sur les 60 caracteres qu emploient les noms de cartes.
// Compter les caracteres ne suffisait pas : un « m » vaut quatre espaces et
// « Poisson mangeur d hommes » debordait de 37 px a 24 caracteres, la ou un
// nom de meme longueur en lettres etroites tenait largement.
const LARGEURS_TITRE = {
  " ": 0.254, "'": 0.269, ",": 0.328, "-": 0.379,
  A: 0.758, B: 0.757, C: 0.715, D: 0.834, E: 0.721, F: 0.671, G: 0.807, H: 0.913,
  I: 0.446, J: 0.595, K: 0.817, L: 0.686, M: 1.023, N: 0.839, O: 0.82, P: 0.701,
  Q: 0.82, R: 0.797, S: 0.649, T: 0.684, U: 0.833, V: 0.762, W: 1.126, X: 0.762,
  Y: 0.743, Z: 0.689,
  a: 0.596, b: 0.646, c: 0.531, d: 0.663, e: 0.572, f: 0.393, g: 0.577, h: 0.68,
  i: 0.354, j: 0.346, k: 0.632, l: 0.344, m: 1.016, n: 0.69, o: 0.636, p: 0.658,
  q: 0.648, r: 0.52, s: 0.513, t: 0.397, u: 0.677, v: 0.567, w: 0.869, x: 0.588,
  y: 0.562, z: 0.525,
  É: 0.721, à: 0.596, â: 0.596, ç: 0.531, è: 0.572, é: 0.572, ê: 0.572, î: 0.354,
  ô: 0.636, û: 0.677, œ: 0.938
};
const LARGEUR_CAR_PAR_DEFAUT = 0.626;

export function largeurTitre(nom, taille) {
  let em = 0;
  for (const caractere of String(nom)) em += LARGEURS_TITRE[caractere] ?? LARGEUR_CAR_PAR_DEFAUT;
  return em * taille;
}

// Paliers de taille, du confortable au serre. Le dernier n est atteint que
// par des noms extremes.
const PALIERS_TITRE = [40, 36, 32, 29, 26, 24, 22, 20, 18];

// Largeur utile du cartouche : la bordure interieure est a 4 px, on garde
// 12 px de respiration de chaque cote pour ne jamais toucher le filet.
export const LARGEUR_TITRE_MAX = G.cartouche.w - 24;

// Ajustement en trois temps, dans l ordre demande : taille normale, puis
// reduction progressive de la police, puis - seulement si le nom reste trop
// large au dernier palier - une legere compression horizontale via
// `textLength`. Le texte ne peut alors mathematiquement plus deborder, et
// il n est jamais tronque.
export function ajusterTitre(nom, largeurMax = LARGEUR_TITRE_MAX) {
  for (const taille of PALIERS_TITRE) {
    if (largeurTitre(nom, taille) <= largeurMax) return { taille, compression: null };
  }
  const taille = PALIERS_TITRE.at(-1);
  return { taille, compression: largeurMax };
}

// Conservee pour les outils qui l appellent encore.
export function tailleTitre(nom) {
  return ajusterTitre(nom).taille;
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
// `sertissage` regle l epaisseur du logement d or autour de la pierre : plein
// pour les grandes gemmes, mince pour les jetons de cout, qui doivent tenir
// cote a cote sans se toucher.
function gemme(cx, cy, r, teinte, teinteClaire, contenu, sertissage = 8) {
  const anneau = Math.max(2, Math.round(sertissage * 0.75));
  const filet = Math.max(1, Math.round(sertissage * 0.25));
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r + sertissage}" fill="${MATIERE.fond}" opacity="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="${r + anneau}" fill="url(#orBrosse)"/>
    <circle cx="${cx}" cy="${cy}" r="${r + filet}" fill="none" stroke="${MATIERE.orSombre}" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${teinte}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#pierre)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${teinteClaire}" stroke-width="2" opacity="0.75"/>
    <ellipse cx="${cx}" cy="${cy - r * 0.42}" rx="${r * 0.52}" ry="${r * 0.3}" fill="#ffffff" opacity="0.2"/>
    ${contenu}
  </g>`;
}

// --- Symboles de mana --------------------------------------------------
// Un jeton dessine = un mana a payer, ou un mana produit. Les teintes
// viennent de data/elements.json : la meme source sert au ruban d element,
// aux jetons de cout et a ceux de production. Le jeton generique porte son
// nombre, les jetons colores portent l icone de leur element.
const TEINTES_MANA_DEFAUT = { fond: "#b3ac9c", bord: "#e9e2ce", encre: "#2a251c" };

function teintesMana(ELEMENTS, famille) {
  return (ELEMENTS && ELEMENTS[famille] && ELEMENTS[famille].mana) || TEINTES_MANA_DEFAUT;
}

// Contenu d un jeton. L icone est inscrite dans le disque - cote = r x 1,35,
// soit moins que le cote du carre inscrit - ce qui evite tout detourage :
// un clipPath porterait un identifiant que le prefixage ne connait pas et
// deux cartes voisines finiraient par partager le meme.
function contenuJeton(jeton, cx, cy, r, ELEMENTS, image) {
  if (jeton.type === "generic") {
    const teintes = teintesMana(ELEMENTS, "Générique");
    const texte = String(jeton.amount);
    // Un nombre a deux chiffres ne doit pas deborder de sa pastille : la
    // taille suit le nombre de chiffres, et le texte reste centre.
    const taille = Math.round(r * (texte.length > 1 ? 0.95 : 1.3));
    return `<text x="${cx}" y="${cy + taille * 0.35}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${taille}" font-weight="700" fill="${teintes.encre}">${escapeXml(texte)}</text>`;
  }
  const icone = ELEMENTS && ELEMENTS[jeton.family] && ELEMENTS[jeton.family].icone;
  if (!icone) {
    const teintes = teintesMana(ELEMENTS, jeton.family);
    return `<text x="${cx}" y="${cy + r * 0.34}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(r * 0.9)}" font-weight="800" fill="${teintes.encre}">${escapeXml(jeton.family.slice(0, 1))}</text>`;
  }
  const cote = Math.round(r * 1.35);
  return `<image href="${image(icone)}" x="${cx - cote / 2}" y="${cy - cote / 2}" width="${cote}" height="${cote}" opacity="0.95"/>`;
}

// Sertissage mince pour les jetons : ils se rangent cote a cote sans que
// leurs logements ne se touchent.
const SERTI_JETON = 4;

function jetonMana(jeton, cx, cy, r, ELEMENTS, image) {
  const famille = jeton.type === "generic" ? "Générique" : jeton.family;
  const teintes = teintesMana(ELEMENTS, famille);
  return gemme(cx, cy, r, teintes.fond, teintes.bord, contenuJeton(jeton, cx, cy, r, ELEMENTS, image), SERTI_JETON);
}

// Largeur occupee par une rangee de jetons, sertissage et ecarts compris.
export function largeurRangeeMana(nombre, r, ecart) {
  if (nombre <= 0) return 0;
  return nombre * 2 * (r + SERTI_JETON) + (nombre - 1) * ecart;
}

// Rangee UNIQUE de jetons, a taille constante, centree sur (cx, cy).
// Une seule ligne, un seul rayon, un seul ecart : la mise en page ne depend
// plus du nombre de jetons, donc elle ne peut plus se deformer. `separateur`
// n est fourni que pour les terrains — « ou » pour une couleur au choix,
// « et » pour plusieurs manas produits ensemble.
function rangeeMana(jetons, cx, cy, r, ecart, ELEMENTS, image, separateur = null) {
  if (!jetons || jetons.length === 0) return "";
  const pas = 2 * (r + SERTI_JETON) + ecart;
  const depart = cx - (largeurRangeeMana(jetons.length, r, ecart) - 2 * (r + SERTI_JETON)) / 2;
  const sortie = [];
  for (const [index, jeton] of jetons.entries()) {
    const x = depart + index * pas;
    sortie.push(jetonMana(jeton, x, cy, r, ELEMENTS, image));
    if (separateur && index < jetons.length - 1) {
      const signe = separateur === "ou" ? "/" : "+";
      sortie.push(
        `<text x="${x + pas / 2}" y="${cy + r * 0.4}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(r * 1.1)}" font-weight="700" fill="${MATIERE.or}">${signe}</text>`
      );
    }
  }
  return sortie.join("\n  ");
}

// Hauteur d une plaque de mot-cle. Partagee entre le dessin des badges, le
// calcul du plan ET les verificateurs : si l un change sans les autres, les
// tags recommencent a toucher le filet.
export const HAUTEUR_BADGE = 36;

// Police du corps de carte. Elle n etait PAS declaree : le texte heritait
// du sans-serif de la page hote, donc un SVG ouvert seul - ou envoye a
// l imprimante - ne rendait pas comme dans le jeu. La declarer fige le
// rendu, et c est elle que mesure la table de largeurs ci-dessous.
export const POLICE_CORPS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

// Largeur reelle des caracteres du corps de carte, en em, mesuree dans le
// navigateur sur les caracteres qu emploient les textes de capacite.
// Couper au NOMBRE de caracteres obligeait a un budget prudent : les lignes
// ne remplissaient que 57 % de la largeur utile, ce qui ajoutait des lignes
// inutiles et poussait le texte sur les mots-cles.
const LARGEURS_CORPS = {
  " ": 0.274, "'": 0.23, "+": 0.684, ",": 0.217, "-": 0.4, ".": 0.217, "/": 0.39, ":": 0.217,
  "0": 0.539, "1": 0.539, "2": 0.539, "3": 0.539, "4": 0.539,
  "5": 0.539, "6": 0.539, "7": 0.539, "8": 0.539, "9": 0.539,
  A: 0.645, B: 0.573, C: 0.619, D: 0.701, E: 0.506, F: 0.488, G: 0.686, H: 0.71, I: 0.266,
  J: 0.357, K: 0.598, L: 0.471, M: 0.898, N: 0.748, O: 0.754, P: 0.56, Q: 0.754, R: 0.598,
  S: 0.531, T: 0.524, U: 0.71, V: 0.621, W: 0.95, X: 0.598, Y: 0.57, Z: 0.57,
  a: 0.509, b: 0.588, c: 0.462, d: 0.589, e: 0.523, f: 0.313, g: 0.589, h: 0.566, i: 0.242,
  j: 0.242, k: 0.497, l: 0.242, m: 0.861, n: 0.566, o: 0.586, p: 0.588, q: 0.589, r: 0.348,
  s: 0.424, t: 0.339, u: 0.566, v: 0.479, w: 0.76, x: 0.459, y: 0.484, z: 0.459,
  "À": 0.645, "É": 0.506, "à": 0.509, "â": 0.509, "ç": 0.462, "è": 0.523, "é": 0.523,
  "ê": 0.523, "î": 0.242, "ô": 0.586, "ù": 0.566, "û": 0.566, "œ": 0.928
};
const LARGEUR_CORPS_DEFAUT = 0.55;

export function largeurCorps(texte, taille) {
  let em = 0;
  for (const caractere of String(texte)) em += LARGEURS_CORPS[caractere] ?? LARGEUR_CORPS_DEFAUT;
  return em * taille;
}

// Largeur utile du panneau : le texte est pose a 28 px du bord gauche et
// doit s arreter 28 px avant le bord droit.
export const LARGEUR_CORPS_MAX = G.panneau.w - 56;

// Retour a la ligne MESURE : chaque ligne se remplit jusqu a la largeur
// reellement disponible, au lieu d un quota de caracteres prudent.
export function couperTexte(texte, taille, largeurMax = LARGEUR_CORPS_MAX, mesure = largeurCorps) {
  const mots = String(texte || "").split(/\s+/).filter(Boolean);
  const lignes = [];
  let ligne = "";
  for (const mot of mots) {
    const essai = ligne ? ligne + " " + mot : mot;
    if (ligne && mesure(essai, taille) > largeurMax) {
      lignes.push(ligne);
      ligne = mot;
    } else {
      ligne = essai;
    }
  }
  if (ligne) lignes.push(ligne);
  return lignes;
}

// Paliers de composition du texte de regle, du plus confortable au plus
// dense. Plus de quota de caracteres : la largeur est desormais MESUREE,
// donc chaque palier remplit reellement les 576 px utiles.
const PALIERS_CAPACITE = [
  { taille: 24, interligne: 32 },
  { taille: 22, interligne: 29 },
  { taille: 21, interligne: 26 },
  { taille: 19, interligne: 24 }
];

// Reperes verticaux du panneau, tous derives de la hauteur REELLE du texte.
const NOM_VERS_TEXTE = 34;   // ligne de base du nom -> premiere ligne de regle
const TEXTE_VERS_TAGS = 12;  // bas du texte -> haut des plaques
const TAGS_VERS_FILET = 12;  // bas des plaques -> filet de la citation
const DESCENTE = 0.28;       // part de la taille sous la ligne de base

// Hauteur occupee par le bloc de regle, du nom jusqu au filet.
function hauteurBloc(nbLignes, taille, interligne, aDesMotsCles) {
  const texte = NOM_VERS_TEXTE + Math.max(0, nbLignes - 1) * interligne + taille * DESCENTE;
  return texte + (aDesMotsCles ? TEXTE_VERS_TAGS + HAUTEUR_BADGE + TAGS_VERS_FILET : TAGS_VERS_FILET);
}

// Repartition verticale du panneau. La citation est ancree au bas, le filet
// juste au-dessus ; le bloc de regle occupe le reste. Les mots-cles sont
// places APRES le texte, jamais avant : c est la regle qui manquait.
function planPanneau(nbLignesTexte, taille, interligne, motsCles, nbLignesCitation) {
  const haut = G.panneau.y;
  const bas = G.panneau.y + G.panneau.h;
  const interligneCitation = 25;

  // La citation reste ancree au bas : sa derniere ligne s arrete toujours a
  // 16 px du bord, ce qui aligne le filet d une carte a l autre.
  const citation = bas - 16 - Math.max(0, nbLignesCitation - 1) * interligneCitation;
  const filet = citation - 26;

  const aDesMotsCles = Array.isArray(motsCles) && motsCles.length > 0;
  const bloc = hauteurBloc(nbLignesTexte, taille, interligne, aDesMotsCles);

  // Le bloc est centre dans la place libre, puis releve de 2 % de la hauteur
  // de carte : le descriptif respire au-dessus du filet au lieu de peser
  // vers le bas. Le max(0) garde les cartes chargees calees en haut.
  const RELEVE_DESCRIPTIF = Math.round(G.H * 0.02);
  const disponible = filet - (haut + 42);
  const nom = haut + 42 + Math.max(0, Math.round((disponible - bloc) / 2) - RELEVE_DESCRIPTIF);
  const texte = nom + NOM_VERS_TEXTE;
  const basTexte = texte + Math.max(0, nbLignesTexte - 1) * interligne + taille * DESCENTE;

  // Les tags s ancrent juste au-dessus du filet - meme hauteur d une carte a
  // l autre - MAIS jamais avant la fin du texte. C est un « max », la ou un
  // « min » remontait les plaques SOUS le texte sur les cartes chargees et
  // provoquait le chevauchement.
  const badges = Math.round(
    Math.max(basTexte + TEXTE_VERS_TAGS, filet - HAUTEUR_BADGE - TAGS_VERS_FILET)
  );

  return { nom: Math.round(nom), texte: Math.round(texte), badges, filet, citation, interligneCitation };
}

// Compose tout le panneau d une carte : lignes de regle au plus grand
// palier qui tient (largeur mesuree ET hauteur disponible, mots-cles et
// citation compris), citation, et plan vertical. Les verificateurs appellent
// la meme fonction que le dessin : impossible de controler autre chose que
// ce qui est reellement rendu.
export function composerPanneau(card) {
  const aDesMotsCles = Array.isArray(card.keywords) && card.keywords.length > 0;

  // Reduction declaree par la carte elle-meme (champ « texteEchelle » des
  // donnees, ex. 0.95 = -5 %). Le gabarit lit un reglage de donnees, il ne
  // connait aucune carte par son nom.
  const echelle = Math.min(1, Math.max(0.7, Number(card.texteEchelle) || 1));
  const paliers = PALIERS_CAPACITE.map((palier) => ({
    taille: Math.round(palier.taille * echelle * 10) / 10,
    interligne: Math.round(palier.interligne * echelle)
  }));

  // La citation se coupe a la meme largeur utile. En italique les glyphes
  // sont un peu plus etroits : on mesure a 98 % pour rester prudent.
  const tailleCitation = 21;
  const flavorBrut =
    card.art?.svgFlavor === false
      ? []
      : couperTexte(card.flavor, tailleCitation * 0.98, LARGEUR_CORPS_MAX, largeurTitre);
  const flavorLines = flavorBrut.slice(0, 2);

  const bas = G.panneau.y + G.panneau.h;
  const citation = bas - 16 - Math.max(0, flavorLines.length - 1) * 25;
  const filet = citation - 26;
  const disponible = filet - (G.panneau.y + 42);

  // Premier palier dont le texte tient EN LARGEUR (4 lignes au plus) et dont
  // le bloc complet - mots-cles inclus - tient EN HAUTEUR. La contrainte de
  // hauteur garantit a elle seule qu aucun chevauchement n est possible.
  let choix = paliers.at(-1);
  let lignes = couperTexte(card.abilityText, choix.taille);
  for (const palier of paliers) {
    const essai = couperTexte(card.abilityText, palier.taille);
    const tient = hauteurBloc(essai.length, palier.taille, palier.interligne, aDesMotsCles) <= disponible;
    if (essai.length <= 4 && tient) {
      choix = palier;
      lignes = essai;
      break;
    }
  }

  const tronque = lignes.length > 4 || flavorBrut.length > 2;
  const abilityLines = lignes.slice(0, 4);
  const plan = planPanneau(
    abilityLines.length, choix.taille, choix.interligne, card.keywords, flavorLines.length
  );
  return {
    abilityLines,
    taille: choix.taille,
    interligne: choix.interligne,
    flavorLines,
    tailleCitation,
    plan,
    tronque,
    police: POLICE_CORPS
  };
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
  const hauteur = HAUTEUR_BADGE;
  const limite = x + G.panneau.w - 56;
  let curseur = x;
  const sortie = [];
  for (const mot of (Array.isArray(mots) ? mots : []).slice(0, 4)) {
    const largeur = Math.min(240, 24 + String(mot).length * 12.8);
    if (curseur + largeur > limite) break;
    sortie.push(`<g>
    <rect x="${curseur}" y="${y}" width="${largeur}" height="${hauteur}" rx="8" fill="#f4e5c8"/>
    <rect x="${curseur}" y="${y}" width="${largeur}" height="${hauteur}" rx="8" fill="none" stroke="${teinte}" stroke-width="1.6" opacity="0.8"/>
    <rect x="${curseur + 2}" y="${y + 2}" width="${largeur - 4}" height="${hauteur - 4}" rx="6" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.55"/>
    <text x="${curseur + largeur / 2}" y="${y + 25}" text-anchor="middle" font-family="Arial, sans-serif" font-size="19" font-weight="700" fill="${MATIERE.encreDouce}">${escapeXml(mot)}</text>
  </g>`);
    curseur += largeur + 11;
  }
  return sortie.join("\n  ");
}

// Numero de collection, en bas de carte. Il etait dore et translucide sur
// un cadre lui-meme dore : illisible sur les teintes claires, et perdu au
// scan une fois la carte imprimee. Il est desormais pose sur une pastille
// noire, en jaune franc, avec la meme lisibilite sur les six couleurs.
// `remontee` est une fraction de la hauteur de carte, pas un nombre de
// pixels : le numero garde la meme place relative quelle que soit la
// definition du gabarit. A 2 % la pastille quitte le bord bas et vient se
// poser SUR la barre de pied, comme un onglet - elle est donc dessinee
// apres elle, et s'arrete au-dessus des medaillons d'attaque et de vie.
const NUMERO = {
  taille: 15,
  interlettre: 2,
  marge: 12,
  garde: 3,
  hauteur: 18,
  remontee: 0.02
};

function numeroCollection(numero) {
  const texte = String(numero ?? "");
  if (!texte) return "";

  const hauteur = NUMERO.hauteur;
  const y = G.H - NUMERO.garde - Math.round(G.H * NUMERO.remontee) - hauteur;

  // Georgia gras : la meme table de largeurs que les titres. L'interlettre
  // s'ajoute apres chaque glyphe, il compte donc dans la largeur du fond.
  const largeurTexte = largeurTitre(texte, NUMERO.taille) + NUMERO.interlettre * texte.length;
  const largeur = Math.round(largeurTexte + NUMERO.marge * 2);
  // Baseline centree dans la pastille : la hauteur d'oeil des chiffres
  // Georgia vaut environ 0,7 em, on descend donc d'une demi-hauteur d'oeil.
  const base = Math.round(y + hauteur / 2 + NUMERO.taille * 0.35);

  return `<g>
    <rect x="${Math.round((G.W - largeur) / 2)}" y="${y}" width="${largeur}" height="${hauteur}" rx="6" fill="${MATIERE.noir}"/>
    <text x="${G.W / 2}" y="${base}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${NUMERO.taille}" font-weight="700" letter-spacing="${NUMERO.interlettre}" fill="${MATIERE.jaune}">${escapeXml(texte)}</text>
  </g>`;
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
  // Chiffres volontairement plus grands que la piece ne le suggere : a
  // r = 40, un chiffre seul sort a 45 px, soit le double de l ancien rendu.
  // Deux chiffres tiennent dans la meme pastille : la taille s ajuste au
  // lieu de deborder, et la plaque sombre reste dans le medaillon.
  const taille = Math.round(r * (chiffre.length > 1 ? 0.86 : 1.12));
  const contour = Math.max(4, Math.round(taille * 0.14));
  // Logement : disque sombre creuse puis jonc d or, comme les gemmes du
  // haut. Sans lui, la piece illustree paraissait posee sur la carte au
  // lieu d y etre sertie, et se fondait dans le fond sombre du socle.
  const logement = `<circle cx="${cx}" cy="${cy}" r="${r + 9}" fill="${MATIERE.fond}" opacity="0.92"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="url(#orBrosse)"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="${MATIERE.fond}" opacity="0.55"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="none" stroke="${MATIERE.orSombre}" stroke-width="2"/>`;
  // Plaque sombre sous le chiffre : le contraste ne depend plus de la
  // teinte de l illustration qui se trouve dessous.
  const plaque = chiffre
    ? `<circle cx="${cxTexte}" cy="${cyTexte}" r="${Math.round(taille * 0.86)}" fill="#0d0907" opacity="${Math.max(0.5, piece.voile)}"/>`
    : "";
  const texte = chiffre
    ? `<text x="${cxTexte}" y="${cyTexte + taille * 0.35}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${taille}" font-weight="700" fill="#ffffff" stroke="#0a0705" stroke-width="${contour}" stroke-linejoin="round" paint-order="stroke">${escapeXml(chiffre)}</text>`
    : "";
  return `<g>
    ${logement}
    <image href="${image(piece.fichier)}" x="${cx - rayon}" y="${cy - rayon}" width="${rayon * 2}" height="${rayon * 2}"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="none" stroke="${MATIERE.or}" stroke-width="1.5" opacity="0.55"/>
    ${plaque}
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

function positionArt(valeur, repli = 0.5) {
  const texte = String(valeur ?? "").trim().toLowerCase();
  if (texte === "left" || texte === "top") return 0;
  if (texte === "center") return 0.5;
  if (texte === "right" || texte === "bottom") return 1;
  const resultat = texte.match(/^(-?\d+(?:\.\d+)?)%$/);
  if (!resultat) return repli;
  return Math.max(0, Math.min(1, Number(resultat[1]) / 100));
}

function arrondirSvg(valeur) {
  return Number(valeur.toFixed(3));
}

function geometrieIllustration(card, ajustement) {
  const dimensions = card.art?.dimensions;
  const largeurSource = Number(dimensions?.largeur ?? dimensions?.width);
  const hauteurSource = Number(dimensions?.hauteur ?? dimensions?.height);

  // Sans dimensions fiables, conserver strictement le comportement historique.
  if (!(largeurSource > 0) || !(hauteurSource > 0)) {
    return {
      x: G.art.x,
      y: G.art.y,
      largeur: G.art.w,
      hauteur: G.art.h,
      preserveAspectRatio: ajustement === "contain" ? "xMidYMid meet" : "xMidYMid slice"
    };
  }

  const echelle = ajustement === "contain"
    ? Math.min(G.art.w / largeurSource, G.art.h / hauteurSource)
    : Math.max(G.art.w / largeurSource, G.art.h / hauteurSource);
  const largeur = largeurSource * echelle;
  const hauteur = hauteurSource * echelle;
  const morceaux = String(card.art?.position || "50% 50%").trim().split(/\s+/);
  const positionX = positionArt(morceaux[0], 0.5);
  const positionY = positionArt(morceaux[1], 0.5);

  return {
    x: arrondirSvg(G.art.x + (G.art.w - largeur) * positionX),
    y: arrondirSvg(G.art.y + (G.art.h - hauteur) * positionY),
    largeur: arrondirSvg(largeur),
    hauteur: arrondirSvg(hauteur),
    preserveAspectRatio: "none"
  };
}

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
  const art = geometrieIllustration(card, artFit);

  // Composition unique du panneau : lignes, tailles et plan vertical
  // viennent de `composerPanneau`, la meme fonction que les verificateurs
  // mesurent. Le palier choisi garantit que texte, mots-cles et citation
  // tiennent ensemble, sans collision.
  const {
    abilityLines,
    taille: capaciteTaille,
    interligne: capaciteInterligne,
    flavorLines,
    tailleCitation,
    plan
  } = composerPanneau(card);
  // Cout d une carte, production d un terrain : deux lectures du meme
  // vocabulaire de jetons. Le separateur distingue « une couleur au choix »
  // de « plusieurs manas a la fois ».
  const titre = ajusterTitre(card.name);
  const production = isLand ? landProductionTokens(card) : null;
  const jetonsMana = isLand ? production.tokens : manaCostTokens(card);
  const separateurMana = isLand ? production.separator : null;

  // Identite de categorie : le terrain recoit un cadre de pierre batie, la
  // creature un cadre plus organique. Meme grille, matiere differente.
  const matiereCadre = isLand ? "url(#cadrePierre)" : "url(#cadreBois)";

  // Le socle d un terrain porte desormais ce qu il produit, entre le mot
  // SOURCE et le nom de sa couleur : le logo Terrain a pris la place du
  // chiffre en haut a gauche, il n a pas a se repeter ici.
  // SOCLE : une seule barre, comme l en-tete. Chaque type y pose ce qui le
  // concerne, et rien d autre. Le nom de l element n y figure plus : il est
  // deja porte par le symbole de l en-tete, le repeter en bas n apportait
  // rien et surchargeait les terrains.
  const socle = isLand
    ? rangeeMana(jetonsMana, centre(G.socle), AXE_SOCLE(), 24, 20, ELEMENTS, image, separateurMana)
    : isSpell
      ? medaillonIllustre(centre(G.socle), AXE_SOCLE(), G.medaillonCentral.r, MEDAILLONS.sort, "", image)
      : `${medaillonIllustre(G.medaillon.cxG, AXE_SOCLE(), G.medaillon.r, MEDAILLONS.attaque, card.attack, image)}
  ${medaillonIllustre(G.medaillon.cxD, AXE_SOCLE(), G.medaillon.r, MEDAILLONS.vie, card.life, image)}`;

  // COUT : rangee unique dans le compartiment de gauche. Un terrain n a pas
  // de cout, son compartiment porte le logo Terrain.
  const centreCout = G.cout.x + G.cout.w / 2;
  const blocCout = isLand
    ? medaillonIllustre(centreCout, AXE_ENTETE(), G.logoTerrain.r, MEDAILLONS.source, "", image)
    : jetonsMana.length > 0
      ? rangeeMana(jetonsMana, centreCout, AXE_ENTETE(), G.cout.rJeton, G.cout.ecart, ELEMENTS, image)
      : jetonMana({ type: "generic", amount: 0 }, centreCout, AXE_ENTETE(), G.cout.rJeton, ELEMENTS, image);

  // ELEMENT : le symbole seul, dans son compartiment. La grosse gemme qui
  // l entourait debordait de la barre et venait mordre sur le titre.
  const symboleElement = element?.icone
    ? `<image href="${image(element.icone)}" x="${centre(G.element) - G.element.r + 4}" y="${AXE_ENTETE() - G.element.r + 4}" width="${G.element.r * 2 - 8}" height="${G.element.r * 2 - 8}"/>`
    : `<text x="${centre(G.element)}" y="${AXE_ENTETE() + 7}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="#fff8e4">${escapeXml((element?.nom || card.family).slice(0, 7))}</text>`;

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
  </defs>

  <rect width="${G.W}" height="${G.H}" rx="22" fill="${MATIERE.fond}"/>
  <rect x="${G.marge - 12}" y="${G.marge - 12}" width="${G.W - (G.marge - 12) * 2}" height="${G.H - (G.marge - 12) * 2}" rx="18" fill="${matiereCadre}"/>
  <rect x="${G.marge - 12}" y="${G.marge - 12}" width="${G.W - (G.marge - 12) * 2}" height="${G.H - (G.marge - 12) * 2}" rx="18" fill="none" stroke="${MATIERE.or}" stroke-width="1.5" opacity="0.5"/>
  <rect x="${G.marge}" y="${G.marge}" width="${G.W - G.marge * 2}" height="${G.H - G.marge * 2}" rx="14" fill="none" stroke="${MATIERE.orSombre}" stroke-width="2" opacity="0.8"/>
  <rect x="${G.marge + 8}" y="${G.marge + 8}" width="${G.W - (G.marge + 8) * 2}" height="${G.H - (G.marge + 8) * 2}" rx="10" fill="#191110" opacity="0.5"/>

  ${barre(G.entete, "url(#orBrosse)")}
  ${compartiment(G.cout.x + 10, G.entete.y + 12, G.cout.w - 20, G.entete.h - 24, 11)}
  ${compartiment(G.element.x + 10, G.entete.y + 12, G.element.w - 20, G.entete.h - 24, 11)}
  <rect x="${G.cartouche.x}" y="${G.cartouche.y}" width="${G.cartouche.w}" height="${G.cartouche.h}" rx="8" fill="url(#parchemin)"/>
  <rect x="${G.cartouche.x}" y="${G.cartouche.y}" width="${G.cartouche.w}" height="${G.cartouche.h}" rx="8" fill="url(#creuxHaut)" opacity="0.28"/>
  <rect x="${G.cartouche.x + 4}" y="${G.cartouche.y + 4}" width="${G.cartouche.w - 8}" height="${G.cartouche.h - 8}" rx="5" fill="none" stroke="${teinteSombre}" stroke-width="1.5" opacity="0.45"/>
  <text x="${centre(G.cartouche)}" y="${G.cartouche.y + G.cartouche.h / 2 + titre.taille * 0.35}" text-anchor="middle" font-family="Georgia, 'Palatino Linotype', 'Book Antiqua', serif" font-size="${titre.taille}" font-weight="700" fill="${MATIERE.encre}"${titre.compression ? ` textLength="${titre.compression}" lengthAdjust="spacingAndGlyphs"` : ""}>${escapeXml(card.name)}</text>

  ${blocCout}
  ${symboleElement}

  <rect x="${G.type.x - 6}" y="${G.type.y - 4}" width="${G.type.w + 12}" height="${G.type.h + 8}" rx="9" fill="url(#orBrosse)" opacity="0.92"/>
  <rect x="${G.type.x}" y="${G.type.y}" width="${G.type.w}" height="${G.type.h}" rx="6" fill="url(#parchemin)"/>
  <rect x="${G.type.x}" y="${G.type.y}" width="${G.type.w}" height="${G.type.h}" rx="6" fill="url(#creuxHaut)" opacity="0.26"/>
  <text x="${centre(G.type)}" y="${G.type.y + G.type.h / 2 + tailleType(card.type) * 0.36}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${tailleType(card.type)}" font-weight="700" letter-spacing="0.8" fill="${MATIERE.encreDouce}">${escapeXml(String(card.type).toUpperCase())}</text>

  <rect x="${G.art.x - 10}" y="${G.art.y - 10}" width="${G.art.w + 20}" height="${G.art.h + 20}" rx="10" fill="${MATIERE.fond}" opacity="0.9"/>
  <rect x="${G.art.x - 6}" y="${G.art.y - 6}" width="${G.art.w + 12}" height="${G.art.h + 12}" rx="8" fill="url(#orBrosse)"/>
  <image href="${artHref}" x="${art.x}" y="${art.y}" width="${art.largeur}" height="${art.hauteur}" preserveAspectRatio="${art.preserveAspectRatio}" clip-path="url(#clipArt)"/>
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
  <text x="${G.panneau.x + 28}" y="${plan.nom}" font-family="Georgia, 'Times New Roman', serif" font-size="27" font-weight="700" fill="${teinteSombre}">${escapeXml(card.abilityName)}</text>
  ${textBlock(abilityLines, G.panneau.x + 28, plan.texte, capaciteTaille, MATIERE.encre, 400, capaciteInterligne)}
  ${badges(card.keywords, G.panneau.x + 28, plan.badges, teinteSombre)}
  <line x1="${G.panneau.x + 28}" y1="${plan.filet}" x2="${G.panneau.x + G.panneau.w - 28}" y2="${plan.filet}" stroke="${MATIERE.encreDouce}" stroke-width="1.2" opacity="0.3"/>
  ${flavorLines
    .map((ligne, index) => `<text x="${centre(G.panneau)}" y="${plan.citation + index * plan.interligneCitation}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${tailleCitation}" font-style="italic" fill="${MATIERE.encreDouce}">${escapeXml(ligne)}</text>`)
    .join("\n  ")}

  ${barre(G.socle, matiereCadre)}
  ${socle}
  <rect x="${G.marge + 8}" y="${G.H - G.marge - 10}" width="${G.W - (G.marge + 8) * 2}" height="10" rx="5" fill="${matiereCadre}"/>
  <rect x="${G.marge + 8}" y="${G.H - G.marge - 10}" width="${G.W - (G.marge + 8) * 2}" height="10" rx="5" fill="none" stroke="${MATIERE.orSombre}" stroke-width="1.5" opacity="0.9"/>
  <rect x="${G.marge + 14}" y="${G.H - G.marge - 9}" width="${G.W - (G.marge + 14) * 2}" height="2" rx="1" fill="${MATIERE.or}" opacity="0.55"/>
  ${numeroCollection(card.numero)}
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
  "clipArt"
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
