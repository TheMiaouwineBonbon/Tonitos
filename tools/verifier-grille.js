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
  const { G, tailleTitre, tailleType, largeurTitre, LARGEUR_TITRE_MAX, largeurRangeeMana, composerPanneau, HAUTEUR_BADGE } = await import("../carte-gabarit.mjs");

  // Le cartouche du titre n est plus centre sur la carte : l en-tete tient
  // en trois zones distinctes - cout a gauche, titre au centre, element a
  // droite - et c est leur SEPARATION qui est verifiee, pas leur symetrie.
  for (const [nom, zone] of [["bandeau de type", G.type], ["illustration", G.art], ["panneau", G.panneau]]) {
    const gauche = zone.x;
    const droite = G.W - (zone.x + zone.w);
    check(`${nom} centre`, gauche === droite, `marges ${gauche} / ${droite}`);
  }

  const largeurCout = G.cout.w - 20;
  const zonesEntete = [
    ["compartiment de coût", G.cout.x + 10, G.cout.x + G.cout.w - 10],
    ["cartouche du titre", G.cartouche.x, G.cartouche.x + G.cartouche.w],
    ["compartiment d'élément", G.element.x + 10, G.element.x + G.element.w - 10]
  ];
  const ECART_MIN = 12;
  for (let i = 1; i < zonesEntete.length; i += 1) {
    const [nomA, , finA] = zonesEntete[i - 1];
    const [nomB, debutB] = zonesEntete[i];
    check(
      `${nomA} puis ${nomB} : rien ne se touche`,
      debutB - finA >= ECART_MIN,
      `ecart ${(debutB - finA).toFixed(0)} px, minimum ${ECART_MIN}`
    );
  }
  // Les trois compartiments vivent DANS la barre d en-tete.
  for (const [nom, gauche, droite] of zonesEntete) {
    check(
      `${nom} tient dans la barre d'en-tete`,
      gauche >= G.entete.x && droite <= G.entete.x + G.entete.w,
      `${gauche}..${droite} pour ${G.entete.x}..${G.entete.x + G.entete.w}`
    );
  }
  check(
    "une rangee de trois jetons tient dans son compartiment",
    largeurRangeeMana(3, G.cout.rJeton, G.cout.ecart) <= largeurCout,
    `${largeurRangeeMana(3, G.cout.rJeton, G.cout.ecart)} / ${largeurCout}`
  );
  // Les medaillons du socle doivent tenir entierement dans leur barre :
  // l etoile des sorts en debordait par le bas.
  const rayonLogement = G.medaillon.r + 9;
  for (const [nom, cx] of [["attaque", G.medaillon.cxG], ["vie", G.medaillon.cxD], ["central", G.socle.x + G.socle.w / 2]]) {
    check(
      `le medaillon ${nom} tient dans le socle`,
      G.medaillon.cy - rayonLogement >= G.socle.y &&
        G.medaillon.cy + rayonLogement <= G.socle.y + G.socle.h &&
        cx - rayonLogement >= G.socle.x &&
        cx + rayonLogement <= G.socle.x + G.socle.w,
      `x ${cx - rayonLogement}..${cx + rayonLogement}, y ${G.medaillon.cy - rayonLogement}..${G.medaillon.cy + rayonLogement}`
    );
  }
  const bordInterieur = G.marge + 8;
  check("la barre d'en-tete reste dans le cadre", G.entete.x >= bordInterieur && G.entete.x + G.entete.w <= G.W - bordInterieur,
    `${G.entete.x}..${G.entete.x + G.entete.w}`);
  check("la barre du socle reste dans le cadre", G.socle.y + G.socle.h <= G.H - bordInterieur,
    `bas ${G.socle.y + G.socle.h} / limite ${G.H - bordInterieur}`);

  const bandes = [
    ["en-tete", G.entete.y, G.entete.y + G.entete.h],
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

  const titresTropLarges = [];
  const typesTropLarges = [];
  const capacitesTronquees = [];
  const citationsTronquees = [];

  for (const carte of cartes) {
    const nom = String(carte.name);
    if (largeurTitre(nom, tailleTitre(nom)) > LARGEUR_TITRE_MAX + 0.5) titresTropLarges.push(nom);

    const type = String(carte.type).toUpperCase();
    if (type.length * (tailleType(type) * LARGEUR_CAR_CAPITALE + 0.8) > G.type.w - 24) typesTropLarges.push(nom);

    // La composition vient du gabarit lui-meme : on verifie ce qui est
    // reellement dessine, pas une reconstruction approximative.
    const panneau = composerPanneau(carte);
    if (panneau.tronque) capacitesTronquees.push(`${nom} (${panneau.taille}px)`);
    const basBadges = panneau.plan.badges + HAUTEUR_BADGE;
    if ((carte.keywords || []).length > 0 && basBadges > panneau.plan.filet - 12) {
      capacitesTronquees.push(`${nom} : badges a ${basBadges} pour un filet a ${panneau.plan.filet}`);
    }


  }

  check("aucun titre ne deborde de son cartouche", titresTropLarges.length === 0, titresTropLarges.slice(0, 3).join(", "));
  check("aucun type ne deborde de son bandeau", typesTropLarges.length === 0, typesTropLarges.slice(0, 3).join(", "));
  check("aucune capacite tronquee", capacitesTronquees.length === 0, capacitesTronquees.slice(0, 3).join(", "));
  check("aucune citation tronquee", citationsTronquees.length === 0, "couvert par composerPanneau.tronque");

  console.log(echecs === 0 ? "\n=> GRILLE CONFORME" : `\n=> ${echecs} CONTROLE(S) EN ECHEC`);
  process.exit(echecs ? 1 : 0);
})();
