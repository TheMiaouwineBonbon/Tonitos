// =====================================================================
// Spellaho - Generateur de planches A4 pour impression physique
// ---------------------------------------------------------------------
// Aucune liste de cartes n est maintenue ici : les donnees viennent de
// data/*.json, le dessin de carte-gabarit.mjs et la composition des decks
// de decks.mjs - exactement les memes sources que le jeu. Ajouter une
// carte au jeu la rend imprimable sans toucher a ce fichier.
//
// Le SVG est INLINE et non charge via <img> : une image SVG est un
// document isole, qui n a pas le droit d aller chercher les illustrations
// externes. Inline, elles s affichent et restent vectorielles.
// =====================================================================
import { cardSvg } from "./carte-gabarit.mjs?v=20260820-couts-1";
import { DECKS, deckPrintList, getDeckSpec } from "./decks.mjs?v=20260821-constructeur-1";

const COLONNES = 3;
const LIGNES = 3;
const PAR_FEUILLE = COLONNES * LIGNES;
const DOS = "Images/Tapis de Jeu/Carte Dos.png";

const els = {
  selection: document.querySelector("#selection"),
  categorie: document.querySelector("#categorie"),
  exemplaires: document.querySelector("#exemplaires"),
  faces: document.querySelector("#faces"),
  retournement: document.querySelector("#retournement"),
  coupe: document.querySelector("#traits-coupe"),
  mire: document.querySelector("#mire"),
  generer: document.querySelector("#generer"),
  imprimer: document.querySelector("#imprimer"),
  test: document.querySelector("#feuille-test"),
  resume: document.querySelector("#resume"),
  planches: document.querySelector("#planches")
};

const catalogue = { cards: [], lands: [], spells: [], elements: {} };

// --- Chargement des donnees -------------------------------------------
async function chargerCatalogue() {
  const version = Date.now();
  const [cards, lands, spells, elements] = await Promise.all(
    ["cards", "lands", "spells", "elements"].map((nom) =>
      fetch(`./data/${nom}.json?v=${version}`, { cache: "no-store" }).then((r) => r.json())
    )
  );
  catalogue.cards = cards.map((c) => ({ ...c, kind: "creature" }));
  catalogue.lands = lands.map((c) => ({ ...c, kind: "land" }));
  catalogue.spells = spells.map((c) => ({ ...c, kind: "spell" }));
  catalogue.elements = elements;
}

const toutesLesCartes = () => [...catalogue.cards, ...catalogue.lands, ...catalogue.spells];

// --- Choix des cartes a imprimer --------------------------------------
// Renvoie une liste d entrees { card, copies }.
function listeAImprimer() {
  const choix = els.selection.value;
  const multiplicateur = Math.max(1, Number(els.exemplaires.value) || 1);

  let entrees;
  if (choix.startsWith("deck:")) {
    // La composition vient de decks.mjs : les quantites sont exactement
    // celles que le jeu distribue, 4 exemplaires compris.
    entrees = deckPrintList(getDeckSpec(choix.slice(5)), catalogue);
  } else {
    const categorie = els.categorie.value;
    const filtre = {
      toutes: () => toutesLesCartes(),
      creature: () => catalogue.cards,
      spell: () => catalogue.spells,
      land: () => catalogue.lands
    }[categorie] || (() => toutesLesCartes());
    entrees = filtre().map((card) => ({ card, copies: 1 }));
  }

  return entrees.map((entree) => ({ ...entree, copies: entree.copies * multiplicateur }));
}

// Developpe les quantites en une file de cartes, en gardant les
// exemplaires d une meme carte cote a cote : une planche entamee se
// remplit avant d en ouvrir une nouvelle, donc aucune feuille gaspillee.
function fileDeCartes(entrees) {
  const file = [];
  for (const { card, copies } of entrees) {
    for (let i = 0; i < copies; i += 1) file.push(card);
  }
  return file;
}

// --- Rendu d une carte -------------------------------------------------
const cacheSvg = new Map();

function svgDeCarte(card, indice) {
  const cle = `${card.id}`;
  if (!cacheSvg.has(cle)) {
    cacheSvg.set(
      cle,
      cardSvg(card, {
        elements: catalogue.elements,
        image: (chemin) => `./${encodeURI(chemin)}`,
        // Le prefixe rend les identifiants internes uniques : sans lui, les
        // degrades de la premiere carte repeindraient toutes les autres.
        prefixe: `im${String(card.id).replace(/[^a-z0-9]/gi, "")}`
      })
    );
  }
  // Chaque exemplaire a besoin de ses propres identifiants.
  return cacheSvg.get(cle).replaceAll(`im${String(card.id).replace(/[^a-z0-9]/gi, "")}-`, `im${indice}-`);
}

// --- Construction d une feuille ----------------------------------------
function creerFeuille(etiquette) {
  const feuille = document.createElement("section");
  feuille.className = "feuille";
  const titre = document.createElement("span");
  titre.className = "feuille-etiquette";
  titre.textContent = etiquette;
  feuille.append(titre);
  if (els.coupe.checked) feuille.append(...traitsDeCoupe());
  if (els.mire.checked) feuille.append(...mires());
  return feuille;
}

// Traits fins places DANS LES MARGES, alignes sur chaque bord de carte :
// ils guident la regle ou le massicot sans jamais traverser un visuel.
function traitsDeCoupe() {
  const traits = [];
  const MARGE_X = 10.5;
  const MARGE_Y = 16.5;
  const L = 63;
  const H = 88;
  const bordsX = Array.from({ length: COLONNES + 1 }, (_, i) => MARGE_X + i * L);
  const bordsY = Array.from({ length: LIGNES + 1 }, (_, i) => MARGE_Y + i * H);

  for (const x of bordsX) {
    for (const y of [MARGE_Y - 6, MARGE_Y + LIGNES * H + 1]) {
      const t = document.createElement("i");
      t.className = "coupe coupe--v";
      t.style.left = `${x}mm`;
      t.style.top = `${y}mm`;
      traits.push(t);
    }
  }
  for (const y of bordsY) {
    for (const x of [MARGE_X - 6, MARGE_X + COLONNES * L + 1]) {
      const t = document.createElement("i");
      t.className = "coupe coupe--h";
      t.style.left = `${x}mm`;
      t.style.top = `${y}mm`;
      traits.push(t);
    }
  }
  return traits;
}

// Deux mires opposees : si le recto et le verso se superposent, elles
// coincident. C est le controle a faire sur une feuille avant de lancer
// tout le jeu.
function mires() {
  const positions = [
    { left: "5mm", top: "5mm" },
    { left: "199mm", top: "287mm" }
  ];
  return positions.map((p) => {
    const m = document.createElement("i");
    m.className = "mire";
    m.style.left = p.left;
    m.style.top = p.top;
    return m;
  });
}

function creerGrille() {
  const grille = document.createElement("div");
  grille.className = "grille";
  return grille;
}

function caseCarte(card, indice) {
  const cellule = document.createElement("div");
  cellule.className = "case";
  cellule.innerHTML = svgDeCarte(card, indice);
  const svg = cellule.querySelector("svg");
  if (svg) {
    // Le SVG remplit la case sans deformation : `meet` centre le dessin et
    // laisse le fond sombre de la case combler le dixieme de millimetre
    // d ecart entre 744/1038 et 63/88.
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
  }
  return cellule;
}

function caseVide() {
  const cellule = document.createElement("div");
  cellule.className = "case case--vide";
  return cellule;
}

function caseDos() {
  const cellule = document.createElement("div");
  cellule.className = "case";
  const img = document.createElement("img");
  img.src = `./${encodeURI(DOS)}`;
  img.alt = "";
  cellule.append(img);
  return cellule;
}

// Position du verso selon le sens de retournement de la feuille.
//   bord long  : la feuille pivote autour de son axe vertical
//                -> les colonnes s inversent, les lignes non.
//   bord court : elle pivote autour de son axe horizontal
//                -> les lignes s inversent, les colonnes non.
function indiceVerso(index, mode) {
  const ligne = Math.floor(index / COLONNES);
  const colonne = index % COLONNES;
  if (mode === "court") return (LIGNES - 1 - ligne) * COLONNES + colonne;
  return ligne * COLONNES + (COLONNES - 1 - colonne);
}

// --- Generation complete ------------------------------------------------
function genererPlanches() {
  const entrees = listeAImprimer();
  const file = fileDeCartes(entrees);
  const feuilles = Math.ceil(file.length / PAR_FEUILLE);
  const faces = els.faces.value;
  const mode = els.retournement.value;

  els.planches.replaceChildren();
  const fragment = document.createDocumentFragment();

  for (let f = 0; f < feuilles; f += 1) {
    const lot = file.slice(f * PAR_FEUILLE, (f + 1) * PAR_FEUILLE);

    if (faces !== "verso") {
      const feuille = creerFeuille(`Recto ${f + 1}/${feuilles} — Spellaho — imprimer à 100 %`);
      const grille = creerGrille();
      for (let i = 0; i < PAR_FEUILLE; i += 1) {
        grille.append(lot[i] ? caseCarte(lot[i], f * PAR_FEUILLE + i) : caseVide());
      }
      feuille.append(grille);
      fragment.append(feuille);
    }

    if (faces !== "recto") {
      const feuille = creerFeuille(
        `Verso ${f + 1}/${feuilles} — retournement sur bord ${mode === "court" ? "court" : "long"}`
      );
      const grille = creerGrille();
      for (let i = 0; i < PAR_FEUILLE; i += 1) {
        const source = indiceVerso(i, mode);
        grille.append(lot[source] ? caseDos() : caseVide());
      }
      feuille.append(grille);
      fragment.append(feuille);
    }
  }

  els.planches.append(fragment);
  afficherResume(entrees, file, feuilles, faces);
}

function afficherResume(entrees, file, feuilles, faces) {
  const pages = faces === "recto+verso" ? feuilles * 2 : feuilles;
  const derniere = file.length % PAR_FEUILLE;
  els.resume.innerHTML = `
    <span>Cartes différentes : <strong>${entrees.length}</strong></span>
    <span>Total à imprimer : <strong>${file.length}</strong></span>
    <span>Cartes par feuille : <strong>${PAR_FEUILLE}</strong> (3 × 3)</span>
    <span>Feuilles A4 : <strong>${feuilles}</strong></span>
    <span>Pages envoyées : <strong>${pages}</strong></span>
    <span>Dernière feuille : <strong>${derniere === 0 ? PAR_FEUILLE : derniere}</strong> carte(s)</span>
  `;
}

// --- Feuille de test ----------------------------------------------------
// Une seule page : un carré de 100 × 100 mm à mesurer à la règle, une
// réglette centimétrique, et trois cartes réelles pour juger du rendu.
function genererFeuilleTest() {
  els.planches.replaceChildren();
  const feuille = creerFeuille("Feuille de contrôle — mesurer le carré : il doit faire 100 mm");

  const etalon = document.createElement("div");
  etalon.className = "etalon";
  etalon.innerHTML = "<span>100 mm × 100 mm<br>Si ce carré ne mesure pas 100 mm à la règle,<br>l'impression n'est pas à 100 % : décoche « Ajuster à la page ».</span>";
  feuille.append(etalon);

  for (let cm = 0; cm <= 10; cm += 1) {
    const trait = document.createElement("i");
    trait.className = "regle";
    trait.style.left = `${10.5 + cm * 10}mm`;
    trait.style.top = "117mm";
    feuille.append(trait);
  }

  const grille = creerGrille();
  grille.style.top = "125mm";
  const echantillon = [
    catalogue.cards.find((c) => c.name.includes("Poisson")) || catalogue.cards[0],
    catalogue.lands.find((c) => c.id === "ville-enneigee") || catalogue.lands[0],
    catalogue.spells[0]
  ];
  for (let i = 0; i < COLONNES; i += 1) {
    grille.append(echantillon[i] ? caseCarte(echantillon[i], 900 + i) : caseVide());
  }
  grille.style.gridTemplateRows = "88mm";
  feuille.append(grille);
  els.planches.append(feuille);

  els.resume.innerHTML = `
    <span>Feuille de <strong>contrôle d'échelle</strong></span>
    <span>Carré de référence : <strong>100 × 100 mm</strong></span>
    <span>Cartes témoins : <strong>3</strong> à 63 × 88 mm</span>
  `;
}

// --- Interface ----------------------------------------------------------
function remplirSelection() {
  const options = ['<optgroup label="Catalogue"><option value="catalogue">Toutes les cartes du jeu</option></optgroup>'];
  options.push(
    `<optgroup label="Decks complets">${DECKS.map(
      (d) => `<option value="deck:${d.id}">${d.shortName} (60 cartes)</option>`
    ).join("")}</optgroup>`
  );
  els.selection.innerHTML = options.join("");
}

function majEtatInterface() {
  const estDeck = els.selection.value.startsWith("deck:");
  els.categorie.disabled = estDeck;
  els.categorie.closest("label").style.opacity = estDeck ? 0.45 : 1;
  els.retournement.disabled = els.faces.value === "recto";
  els.retournement.closest("label").style.opacity = els.faces.value === "recto" ? 0.45 : 1;
}

async function init() {
  await chargerCatalogue();
  remplirSelection();
  majEtatInterface();
  for (const controle of [els.selection, els.categorie, els.faces]) {
    controle.addEventListener("change", majEtatInterface);
  }
  els.generer.addEventListener("click", genererPlanches);
  els.test.addEventListener("click", genererFeuilleTest);
  els.imprimer.addEventListener("click", () => window.print());
  genererFeuilleTest();
}

init().catch((error) => {
  els.resume.textContent = `Chargement impossible : ${error.message}`;
  console.error(error);
});

// Sonde de vérification automatisée : la page expose sa géométrie pour
// que les tests puissent la mesurer sans deviner.
globalThis.SpellahoImpression = Object.freeze({
  COLONNES,
  LIGNES,
  PAR_FEUILLE,
  indiceVerso,
  get cartes() { return toutesLesCartes().length; },
  genererPlanches,
  genererFeuilleTest
});
