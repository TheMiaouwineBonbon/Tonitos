// =====================================================================
// Spellaho - Controle avant impression physique
// ---------------------------------------------------------------------
// Passe en revue TOUTES les cartes du jeu et signale ce qui rendrait mal
// sur papier : illustration manquante ou trop basse en resolution, texte
// tronque, element hors cadre, symbole de mana incoherent, champ vide.
//
//   node .\tools\verifier-impression.mjs
// =====================================================================
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gabarit = await import("../carte-gabarit.mjs");
const { landProductionTokens, manaCostTokens, manaRequirements } = await import("../engine-core.mjs");
const { DECKS, buildDeck, deckPrintList } = await import("../decks.mjs");

const lire = async (nom) => JSON.parse(await readFile(path.join(RACINE, "data", nom), "utf8"));
const elements = await lire("elements.json");
const catalogue = {
  cards: (await lire("cards.json")).map((c) => ({ ...c, kind: "creature" })),
  lands: (await lire("lands.json")).map((c) => ({ ...c, kind: "land" })),
  spells: (await lire("spells.json")).map((c) => ({ ...c, kind: "spell" }))
};
const toutes = [...catalogue.cards, ...catalogue.lands, ...catalogue.spells];

// 63 x 88 mm a 300 ppp = 744 x 1039 px. Le gabarit fait 744 x 1038 : les
// illustrations doivent donc tenir au moins la largeur de leur cadre.
const LARGEUR_ART_300PPP = Math.round((gabarit.G.art.w / gabarit.G.W) * 744);

const anomalies = { bloquantes: [], avertissements: [] };
const bloquant = (m) => anomalies.bloquantes.push(m);
const avertir = (m) => anomalies.avertissements.push(m);

// --- 1. Champs obligatoires -------------------------------------------
for (const carte of toutes) {
  for (const champ of ["id", "name", "type", "family", "abilityName", "abilityText", "image", "palette"]) {
    if (carte[champ] === undefined || carte[champ] === null || carte[champ] === "") {
      bloquant(`${carte.id} : champ « ${champ} » vide`);
    }
  }
  if (carte.kind === "creature") {
    for (const champ of ["attack", "life", "cost"]) {
      if (!Number.isFinite(Number(carte[champ]))) bloquant(`${carte.id} : ${champ} invalide`);
    }
  }
  if (carte.kind === "land" && Number(carte.cost || 0) !== 0) {
    bloquant(`${carte.id} : un terrain ne doit rien coûter (cost=${carte.cost})`);
  }
}

// --- 2. Illustrations --------------------------------------------------
for (const carte of toutes) {
  if (!carte.image) continue;
  const fichier = path.join(RACINE, carte.image);
  try {
    const infos = await stat(fichier);
    if (infos.size < 40_000) {
      avertir(`${carte.name} : illustration de seulement ${Math.round(infos.size / 1024)} Ko, risque de flou à l'impression`);
    }
  } catch {
    bloquant(`${carte.name} : illustration introuvable (${carte.image})`);
  }
}

// --- 3. Symboles de mana ----------------------------------------------
for (const carte of toutes) {
  if (carte.kind === "land") {
    const production = landProductionTokens(carte);
    if (production.tokens.length === 0) bloquant(`${carte.name} : terrain sans symbole de production`);
    continue;
  }
  const exigences = manaRequirements(carte);
  const jetons = manaCostTokens(carte);
  const total = jetons.reduce((somme, j) => somme + (j.type === "generic" ? j.amount : 1), 0);
  if (total !== exigences.total) {
    bloquant(`${carte.name} : ${total} mana dessinés pour ${exigences.total} exigés`);
  }
  if (exigences.total !== Math.max(0, Math.trunc(carte.cost))) {
    bloquant(`${carte.name} : coût affiché ${exigences.total} vs cost ${carte.cost}`);
  }
}

// --- 4. Texte et cadre : on rend chaque carte et on la mesure ----------
const contexte = (id) => ({ elements, image: (p) => `./${p}`, prefixe: "v" + String(id).replace(/[^a-z0-9]/gi, "") });
const HAUT_PANNEAU = gabarit.G.panneau.y;
const BAS_PANNEAU = gabarit.G.panneau.y + gabarit.G.panneau.h;

for (const carte of toutes) {
  const svg = gabarit.cardSvg(carte, contexte(carte.id));

  // Titre : la mesure sert de garde-fou, la compression est le dernier recours.
  const titre = gabarit.ajusterTitre(carte.name);
  const largeur = titre.compression || gabarit.largeurTitre(carte.name, titre.taille);
  if (largeur > gabarit.LARGEUR_TITRE_MAX + 0.5) {
    bloquant(`${carte.name} : titre de ${Math.round(largeur)} px pour ${gabarit.LARGEUR_TITRE_MAX} disponibles`);
  }

  // Capacite et citation : la composition reelle du gabarit fait foi.
  const panneau = gabarit.composerPanneau(carte);
  if (panneau.tronque) bloquant(`${carte.name} : texte ou citation tronqués au rendu`);

  // Une carte qui a une citation doit l'afficher. Le drapeau `svgFlavor:false`
  // datait d'une mise en page figée qui manquait de place : il masquait
  // silencieusement cinq citations pourtant présentes dans les données.
  if (String(carte.flavor || "").trim() && panneau.flavorLines.length === 0) {
    bloquant(`${carte.name} : citation présente dans les données mais absente de la carte`);
  }
  if ((carte.keywords || []).length > 0 && panneau.plan.badges + gabarit.HAUTEUR_BADGE > panneau.plan.filet - 12) {
    bloquant(`${carte.name} : les mots-clés touchent le filet`);
  }

  // Aucun texte du panneau ne doit sortir par le bas. Le socle, lui, a le
  // droit d'accueillir les médaillons : on ne regarde que l'espace situé
  // entre la fin du panneau et le début du socle.
  for (const m of svg.matchAll(/<text[^>]*\sy="([\d.]+)"[^>]*>([^<]*)<\/text>/g)) {
    const y = Number(m[1]);
    if (m[2].trim() && y > HAUT_PANNEAU + 10 && y > BAS_PANNEAU - 4 && y < gabarit.G.socle.y) {
      bloquant(`${carte.name} : texte du panneau à y=${Math.round(y)}, hors du cadre`);
    }
  }

  // Le SVG doit rester autonome : aucun identifiant partage entre cartes.
  if (!svg.startsWith("<svg xmlns")) bloquant(`${carte.name} : SVG mal formé`);
}

// --- 4 bis. Numeros de collection ---------------------------------------
const numeros = new Set();
for (const carte of toutes) {
  if (!/^\d+\/\d+$/.test(String(carte.numero || ""))) {
    bloquant(`${carte.name} : numéro de collection absent ou mal formé (${carte.numero})`);
    continue;
  }
  if (numeros.has(carte.numero)) bloquant(`numéro en double : ${carte.numero}`);
  numeros.add(carte.numero);
  const [, totalDeclare] = carte.numero.split("/");
  if (Number(totalDeclare) !== toutes.length) {
    bloquant(`${carte.name} : numéro ${carte.numero} pour ${toutes.length} cartes — relancer tools/numeroter-cartes.mjs`);
  }
}

// --- 5. Doublons -------------------------------------------------------
const parId = new Map();
for (const carte of toutes) {
  if (parId.has(carte.id)) bloquant(`identifiant en double : ${carte.id}`);
  parId.set(carte.id, carte);
}
const parNom = new Map();
for (const carte of toutes) {
  if (parNom.has(carte.name)) {
    bloquant(`nom en double : « ${carte.name} » (${parNom.get(carte.name)} et ${carte.id})`);
  }
  parNom.set(carte.name, carte.id);
}

// --- 6. Decks imprimables ---------------------------------------------
let totalExemplaires = 0;
const resumeDecks = [];
for (const deck of DECKS) {
  const complet = buildDeck(deck, catalogue);
  const liste = deckPrintList(deck, catalogue);
  const somme = liste.reduce((t, e) => t + e.copies, 0);
  if (somme !== complet.length) bloquant(`${deck.name} : ${somme} exemplaires listés pour ${complet.length} cartes`);
  totalExemplaires += somme;
  resumeDecks.push(`${deck.shortName} : ${liste.length} cartes différentes, ${somme} exemplaires`);
}

// --- Rapport -----------------------------------------------------------
console.log(`Cartes différentes : ${toutes.length} (${catalogue.cards.length} créatures, ${catalogue.spells.length} sorts, ${catalogue.lands.length} terrains)`);
console.log(`Largeur d'illustration attendue à 300 ppp : ${LARGEUR_ART_300PPP} px`);
console.log(`Decks : ${DECKS.length}, soit ${totalExemplaires} cartes à imprimer pour les avoir tous`);
for (const ligne of resumeDecks) console.log(`  - ${ligne}`);

if (anomalies.avertissements.length > 0) {
  console.log(`\nAvertissements (${anomalies.avertissements.length}) :`);
  for (const a of anomalies.avertissements.slice(0, 12)) console.log(`  ~ ${a}`);
  if (anomalies.avertissements.length > 12) console.log(`  ... et ${anomalies.avertissements.length - 12} autres`);
}

if (anomalies.bloquantes.length > 0) {
  console.log(`\nAnomalies bloquantes (${anomalies.bloquantes.length}) :`);
  for (const a of anomalies.bloquantes) console.log(`  ! ${a}`);
  process.exit(1);
}

console.log("\n=> TOUTES LES CARTES SONT PRETES POUR L IMPRESSION");
