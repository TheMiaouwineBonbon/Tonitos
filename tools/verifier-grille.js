// =====================================================================
// Spellaho - Controle de la grille des cartes
// ---------------------------------------------------------------------
// Verifie ce qu un coup d oeil ne peut pas garantir sur 146 cartes :
// symetrie exacte, zones qui ne se chevauchent pas, textes qui tiennent
// dans leur cadre. Un texte tronque au milieu d une phrase, ou un symbole
// ampute par le socle, sont des defauts visibles a l impression.
// =====================================================================
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

// Largeur moyenne d un caractere, rapportee a la taille de police. Les
// capitales sont bien plus larges que le texte courant : mesure au moteur
// de rendu, environ 0,75 em en Georgia gras contre 0,52.
const LARGEUR_CAR = 0.52;
const LARGEUR_CAR_CAPITALE = 0.75;

(async () => {
  const { G, tailleTitre, tailleType } = await import("../carte-gabarit.mjs");

  for (const [nom, zone] of [["cartouche", G.cartouche], ["bandeau de type", G.type], ["illustration", G.art], ["panneau", G.panneau]]) {
    const gauche = zone.x;
    const droite = G.W - (zone.x + zone.w);
    check(`${nom} centre`, gauche === droite, `marges ${gauche} / ${droite}`);
  }
  check("gemmes sur le meme axe", G.gemme.cxG === G.W - G.gemme.cxD, `${G.gemme.cxG} / ${G.W - G.gemme.cxD}`);
  check("medaillons sur le meme axe", G.medaillon.cxG === G.W - G.medaillon.cxD, `${G.medaillon.cxG} / ${G.W - G.medaillon.cxD}`);

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

  // La languette du socle doit mordre sur le bas des pieces sans les
  // amputer : elle en masquait 20 a 30 % de la hauteur.
  const languetteHaut = G.H - G.marge - 10;
  for (const [nom, cy, r] of [["lateral", G.medaillon.cy, G.medaillon.r], ["central", G.medaillonCentral.cy, G.medaillonCentral.r]]) {
    const masque = cy + r - languetteHaut;
    const part = (masque / (r * 2)) * 100;
    check(`le medaillon ${nom} est serti sans etre ampute`, masque > 0 && part <= 15, `${masque} px masques, soit ${part.toFixed(0)} % de sa hauteur`);
  }

  // Le medaillon central se pose sous le panneau, pile sous la citation.
  // Rien ne l empechait de remonter par-dessus le texte.
  const citationBas = G.panneau.y + 254 + 4;
  check("le medaillon central n empiete pas sur la citation",
    G.medaillonCentral.cy - G.medaillonCentral.r >= citationBas,
    `sommet ${G.medaillonCentral.cy - G.medaillonCentral.r} / citation jusqu a ${citationBas}`);
  check("les medaillons restent dans la carte",
    G.medaillon.cy + G.medaillon.r <= G.H - 12,
    `bas ${G.medaillon.cy + G.medaillon.r} / limite ${G.H - 12}`);

  const titresTropLarges = [];
  const typesTropLarges = [];
  const capacitesTronquees = [];
  const citationsTronquees = [];

  for (const carte of cartes) {
    const nom = String(carte.name);
    if (nom.length * tailleTitre(nom) * LARGEUR_CAR > G.cartouche.w - 24) titresTropLarges.push(nom);

    const type = String(carte.type).toUpperCase();
    if (type.length * (tailleType(type) * LARGEUR_CAR_CAPITALE + 0.8) > G.type.w - 24) typesTropLarges.push(nom);

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
})();
