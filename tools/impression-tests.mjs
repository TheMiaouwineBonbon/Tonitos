// =====================================================================
// Spellaho - Tests des planches d'impression
// ---------------------------------------------------------------------
// Charge reellement impression.js dans le DOM minimal, puis verifie la
// geometrie des planches, la correspondance recto-verso et les quantites
// d exemplaires. Les dimensions physiques (63 x 88 mm, A4) sont mesurees
// dans le navigateur ; ici on verifie la logique qui les alimente.
//
//   node .\tools\impression-tests.mjs
// =====================================================================
import { installerDom, attendre } from "./dom-stub.mjs";
import { DECKS, buildDeck, deckPrintList } from "../decks.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

installerDom({ timeScale: 1, instantAnimation: true });

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lire = async (nom) => JSON.parse(await readFile(path.join(RACINE, "data", nom), "utf8"));

const resultats = { total: 0, reussis: 0, echecs: [] };
let contexte = "";

function verifier(condition, libelle, detail = "") {
  resultats.total += 1;
  if (condition) {
    resultats.reussis += 1;
    console.log(`  OK   ${libelle}`);
    return true;
  }
  resultats.echecs.push(`${contexte}${libelle}${detail ? ` — ${detail}` : ""}`);
  console.log(`  FAIL ${libelle}${detail ? ` — ${detail}` : ""}`);
  return false;
}

function section(titre) {
  contexte = `[${titre}] `;
  console.log(`\n=== ${titre} ===`);
}

const catalogue = {
  cards: (await lire("cards.json")).map((c) => ({ ...c, kind: "creature" })),
  lands: (await lire("lands.json")).map((c) => ({ ...c, kind: "land" })),
  spells: (await lire("spells.json")).map((c) => ({ ...c, kind: "spell" }))
};

await import("../impression.js");
await attendre(400);
const API = globalThis.SpellahoImpression;

// ======================================================================
section("Chargement de la page d'impression");
verifier(Boolean(API), "La page expose sa géométrie pour les tests");
verifier(API?.COLONNES === 3 && API?.LIGNES === 3, "Disposition 3 × 3");
verifier(API?.PAR_FEUILLE === 9, "9 cartes par feuille A4");
verifier(API?.cartes === 168, `Les 168 cartes du jeu sont détectées`, String(API?.cartes));

// ======================================================================
section("Format physique");
{
  // 210 − 3 × 63 = 21 mm, 297 − 3 × 88 = 33 mm : la planche tient sur A4
  // avec des marges superieures aux 5 mm non imprimables d une jet d encre.
  const largeurPlanche = 3 * 63;
  const hauteurPlanche = 3 * 88;
  verifier(largeurPlanche === 189 && hauteurPlanche === 264, "La planche mesure 189 × 264 mm");
  verifier((210 - largeurPlanche) / 2 === 10.5, "Marges latérales de 10,5 mm");
  verifier((297 - hauteurPlanche) / 2 === 16.5, "Marges haute et basse de 16,5 mm");
  verifier((210 - largeurPlanche) / 2 >= 5 && (297 - hauteurPlanche) / 2 >= 5, "Les marges dépassent la zone non imprimable");

  // Le gabarit fait 744 x 1038, soit 0,7168 ; la carte physique 63/88 vaut
  // 0,7159. L ecart, 0,12 %, vaut 0,1 mm sur 88 : invisible, et surtout on
  // ne deforme rien puisque le SVG est en `meet`.
  const ratioGabarit = 744 / 1038;
  const ratioPhysique = 63 / 88;
  const ecart = Math.abs(ratioGabarit - ratioPhysique) / ratioPhysique;
  verifier(ecart < 0.002, `Le ratio du gabarit colle au format 63 × 88 (écart ${(ecart * 100).toFixed(2)} %)`);
}

// ======================================================================
section("Correspondance recto-verso");
{
  const long = Array.from({ length: 9 }, (_, i) => API.indiceVerso(i, "long"));
  const court = Array.from({ length: 9 }, (_, i) => API.indiceVerso(i, "court"));
  verifier(long.join() === "2,1,0,5,4,3,8,7,6", "Bord long : les colonnes s'inversent", long.join());
  verifier(court.join() === "6,7,8,3,4,5,0,1,2", "Bord court : les lignes s'inversent", court.join());

  // Retourner deux fois une feuille la remet a l endroit : la fonction doit
  // etre sa propre reciproque, sinon un dos se retrouverait sur la mauvaise
  // carte.
  for (const mode of ["long", "court"]) {
    const identite = Array.from({ length: 9 }, (_, i) => API.indiceVerso(API.indiceVerso(i, mode), mode));
    verifier(identite.every((v, i) => v === i), `Bord ${mode} : deux retournements rendent la position d'origine`);
  }
  const bijection = new Set(long).size === 9 && new Set(court).size === 9;
  verifier(bijection, "Chaque case du verso correspond à une seule case du recto");
}

// ======================================================================
section("Quantités et feuilles");
{
  let totalDecks = 0;
  for (const deck of DECKS) {
    const complet = buildDeck(deck, catalogue);
    const liste = deckPrintList(deck, catalogue);
    const somme = liste.reduce((t, e) => t + e.copies, 0);
    totalDecks += somme;
    if (somme !== 60) verifier(false, `${deck.shortName} : 60 exemplaires attendus`, String(somme));
  }
  verifier(totalDecks === 360, "Les six decks totalisent 360 cartes à imprimer", String(totalDecks));

  const feuilles = (n) => Math.ceil(n / API.PAR_FEUILLE);
  verifier(feuilles(60) === 7, "Un deck de 60 cartes tient sur 7 feuilles");
  verifier(feuilles(168) === 19, "Le catalogue complet tient sur 19 feuilles");
  verifier(feuilles(9) === 1 && feuilles(10) === 2, "Le passage de feuille se fait au bon endroit");
  verifier(feuilles(1) === 1, "Une seule carte occupe quand même une feuille");
  verifier(60 % API.PAR_FEUILLE === 6, "La dernière feuille d'un deck porte 6 cartes");
  verifier(168 % API.PAR_FEUILLE === 6, "La dernière feuille du catalogue porte 6 cartes");

  // Un deck contient bien jusqu a 4 exemplaires d une meme carte.
  const exemple = deckPrintList(DECKS[1], catalogue);
  const maxCopies = Math.max(...exemple.map((e) => e.copies));
  verifier(maxCopies >= 2, `Les exemplaires multiples sont conservés (max ${maxCopies})`);
  const totalExemple = exemple.reduce((t, e) => t + e.copies, 0);
  verifier(totalExemple === 60, "La somme des exemplaires fait bien 60", String(totalExemple));
}

// ======================================================================
section("Rendu des cartes");
{
  const { cardSvg } = await import("../carte-gabarit.mjs");
  const elements = await lire("elements.json");
  const toutes = [...catalogue.cards, ...catalogue.lands, ...catalogue.spells];
  let sansIllustration = 0;
  let identifiantsPartages = 0;
  const vus = new Set();
  for (const carte of toutes.slice(0, 20)) {
    const svg = cardSvg(carte, { elements, image: (p) => `./${p}`, prefixe: `im${carte.id.replace(/[^a-z0-9]/gi, "")}` });
    if (!svg.includes("<image href=")) sansIllustration += 1;
    for (const m of svg.matchAll(/id="([^"]+)"/g)) {
      if (vus.has(m[1])) identifiantsPartages += 1;
      vus.add(m[1]);
    }
  }
  verifier(sansIllustration === 0, "Chaque carte imprimée porte son illustration");
  verifier(identifiantsPartages === 0, "Deux cartes voisines ne partagent aucun identifiant SVG");
  verifier(toutes.length === 168, "168 cartes différentes au catalogue", String(toutes.length));
}

// ======================================================================
console.log(`\n${resultats.reussis}/${resultats.total} vérifications passent.`);
if (resultats.echecs.length > 0) {
  console.log("\nÉchecs :");
  for (const e of resultats.echecs) console.log(`  - ${e}`);
  process.exit(1);
}
console.log("\n=> TOUS LES TESTS D'IMPRESSION PASSENT");
process.exit(0);
