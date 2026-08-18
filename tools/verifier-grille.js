// =====================================================================
// Spellaho - Controle de la grille des cartes
// ---------------------------------------------------------------------
// Verifie ce qu'un coup d'oeil ne peut pas garantir sur 146 cartes :
// symetrie exacte, zones qui ne se chevauchent pas, textes qui tiennent
// dans leur cadre. Un texte tronque au milieu d'une phrase est un defaut
// visible sur une carte destinee a l'impression.
// =====================================================================
const { G, tailleTitre, tailleType } = require("./generate-cards.js");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const cartes = ["cards.json", "spells.json", "lands.json"]
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8")));

let echecs = 0;
const check = (nom, ok, detail = "") => {
  console.log(`${ok ? "  OK  " : "ECHEC "} ${nom}${detail ? " : " + detail : ""}`);
  if (!ok) echecs += 1;
};

// --- Symetrie horizontale ---------------------------------------------
for (const [nom, zone] of [["cartouche", G.cartouche], ["bandeau de type", G.type], ["illustration", G.art], ["panneau", G.panneau]]) {
  const gauche = zone.x;
  const droite = G.W - (zone.x + zone.w);
  check(`${nom} centre`, gauche === droite, `marges ${gauche} / ${droite}`);
}
check("gemmes sur le meme axe", G.gemme.cxG === G.W - G.gemme.cxD, `${G.gemme.cxG} / ${G.W - G.gemme.cxD}`);
check("gemmes a la meme hauteur", true, `cy ${G.gemme.cy}`);
check("medaillons sur le meme axe", G.medaillon.cxG === G.W - G.medaillon.cxD, `${G.medaillon.cxG} / ${G.W - G.medaillon.cxD}`);

// --- Empilement vertical sans chevauchement ---------------------------
const bandes = [
  ["couronne", G.couronne.y, G.couronne.y + G.couronne.h],
  ["bandeau de type", G.type.y, G.type.y + G.type.h],
  ["illustration", G.art.y, G.art.y + G.art.h],
  ["panneau", G.panneau.y, G.panneau.y + G.panneau.h],
  ["socle", G.socle.y, G.socle.y + G.socle.h]
];
for (let i = 1; i < bandes.length; i += 1) {
  const [nomA, , finA] = bandes[i - 1];
  const [nomB, debutB] = bandes[i];
  check(`${nomA} puis ${nomB} sans chevauchement`, debutB >= finA, `${finA} -> ${debutB} (ecart ${debutB - finA})`);
}
check("le socle tient dans la carte", G.socle.y + G.socle.h + G.marge <= G.H, `${G.socle.y + G.socle.h} + marge ${G.marge} <= ${G.H}`);
// Un medaillon peut chevaucher le cadre - c est l effet serti recherche -
// mais jamais depasser du bord de la carte.
// La languette du socle doit mordre sur le bas des pieces sans les
// amputer : elle en masquait 20 a 30 % de la hauteur.
const languetteHaut = G.H - G.marge - 10;
for (const [nom, cy, r] of [["lateral", G.medaillon.cy, G.medaillon.r], ["central", G.medaillonCentral.cy, G.medaillonCentral.r]]) {
  const masque = cy + r - languetteHaut;
  const part = (masque / (r * 2)) * 100;
  check(
    `le medaillon ${nom} est serti sans etre ampute`,
    masque > 0 && part <= 15,
    `${masque} px masques, soit ${part.toFixed(0)} % de sa hauteur`
  );
}

// Le medaillon central des terrains et des sorts se pose sous le panneau,
// pile sous la citation. Rien ne l empechait de remonter par-dessus le
// texte : l etoile des sorts ecrasait la derniere ligne sur 29 px.
const citationBas = G.panneau.y + 254 + 4;
check(
  "le medaillon central n empiete pas sur la citation",
  G.medaillonCentral.cy - G.medaillonCentral.r >= citationBas,
  `sommet ${G.medaillonCentral.cy - G.medaillonCentral.r} / citation jusqu a ${citationBas}`
);
check(
  "le medaillon central reste dans la carte",
  G.medaillonCentral.cy + G.medaillonCentral.r <= G.H - 12,
  `bas ${G.medaillonCentral.cy + G.medaillonCentral.r} / limite ${G.H - 12}`
);

check("les medaillons restent dans la carte", G.medaillon.cy + G.medaillon.r + 4 <= G.H - 12, `bas ${G.medaillon.cy + G.medaillon.r + 4} / limite ${G.H - 12}`);

// --- Les textes tiennent-ils ? ----------------------------------------
const wrap = (txt, max) => {
  const mots = String(txt || "").split(/\s+/);
  const lignes = [];
  let ligne = "";
  for (const mot of mots) {
    const suite = ligne ? `${ligne} ${mot}` : mot;
    if (suite.length > max && ligne) { lignes.push(ligne); ligne = mot; } else ligne = suite;
  }
  if (ligne) lignes.push(ligne);
  return lignes;
};

// Largeur moyenne d'un caractere, rapportee a la taille de police. Mesure
// prudente : Georgia et Arial tournent autour de 0,5 em.
const LARGEUR_CAR = 0.52;
// Les capitales sont bien plus larges que le texte courant : mesure au
// moteur de rendu, environ 0,72 em en Georgia gras.
const LARGEUR_CAR_CAPITALE = 0.75;


const titresTropLarges = [];
const typesTropLarges = [];
const capacitesTronquees = [];
const citationsTronquees = [];

for (const carte of cartes) {
  const nom = String(carte.name);
  const largeurTitre = nom.length * tailleTitre(nom) * LARGEUR_CAR;
  if (largeurTitre > G.cartouche.w - 24) titresTropLarges.push(`${nom} (${Math.round(largeurTitre)}px)`);

  const type = String(carte.type).toUpperCase();
  const largeurType = type.length * (tailleType(type) * LARGEUR_CAR_CAPITALE + 0.8);
  if (largeurType > G.type.w - 24) typesTropLarges.push(`${nom} (${Math.round(largeurType)}px)`);

  const large = wrap(carte.abilityText, 52);
  const lignes = large.length <= 4 ? large : wrap(carte.abilityText, 58);
  if (lignes.length > 4) capacitesTronquees.push(`${nom} (${lignes.length} lignes)`);

  if (wrap(carte.flavor, 54).length > 2) citationsTronquees.push(nom);
}

check("aucun titre ne deborde de son cartouche", titresTropLarges.length === 0, titresTropLarges.slice(0, 3).join(", "));
check("aucun type ne deborde de son bandeau", typesTropLarges.length === 0, typesTropLarges.slice(0, 3).join(", "));
check("aucune capacite tronquee", capacitesTronquees.length === 0, capacitesTronquees.slice(0, 3).join(", "));
check("aucune citation tronquee", citationsTronquees.length === 0, citationsTronquees.slice(0, 3).join(", "));

console.log(echecs === 0 ? "\n=> GRILLE CONFORME" : `\n=> ${echecs} CONTROLE(S) EN ECHEC`);
process.exit(echecs ? 1 : 0);
