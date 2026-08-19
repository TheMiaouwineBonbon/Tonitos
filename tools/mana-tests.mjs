// =====================================================================
// Spellaho - Tests du systeme de mana
// ---------------------------------------------------------------------
// Verifie que le cout affiche, le cout declare dans les donnees et le
// paiement reellement accepte par le moteur disent la meme chose.
//
//   node .\tools\mana-tests.mjs
// =====================================================================
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MANA_COLORS,
  canPayCard,
  describeLandProduction,
  describeManaCost,
  landEnergy,
  landFamilies,
  landProduction,
  landProductionTokens,
  manaCostRecord,
  manaCostTokens,
  manaRequirements,
  paymentPlan,
  payCardCost
} from "../engine-core.mjs";

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

// --- Fabriques de test -------------------------------------------------
let compteur = 0;
const terrain = (colors, options = {}) => ({
  id: `t-${(compteur += 1)}`,
  uid: `t-${compteur}`,
  kind: "land",
  name: options.name || colors.join("/"),
  manaProduction: { mode: options.mode || "choice", colors, amount: options.amount || 1 },
  tapped: Boolean(options.tapped)
});

const carte = (manaCost, cost) => ({
  id: `c-${(compteur += 1)}`,
  kind: "creature",
  name: "Carte de test",
  family: "Multicolore",
  cost: cost ?? Object.values(manaCost).reduce((total, valeur) => total + valeur, 0),
  manaCost
});

const cote = (...lands) => ({ lands });
const nomsPlan = (plan) => (plan ? plan.map((land) => land.name).sort().join(" + ") : null);

const cards = await lire("cards.json");
const spells = await lire("spells.json");
const lands = await lire("lands.json");
const elements = await lire("elements.json");

// ======================================================================
section("Les huit scénarios de paiement demandés");
{
  // Test 1 : ⚪⚪① payé par ⚪ + ⚪ + 🔴  => jouable
  const cout = carte({ Blanc: 2, generic: 1 });
  verifier(
    canPayCard(cote(terrain(["Blanc"], { name: "B1" }), terrain(["Blanc"], { name: "B2" }), terrain(["Rouge"], { name: "R1" })), cout),
    "Test 1 — ⚪⚪① se paie avec Blanc + Blanc + Rouge"
  );

  // Test 2 : ⚪⚪① payé par ⚪ + 🔴 + 🔵  => refusé (un seul blanc)
  verifier(
    !canPayCard(cote(terrain(["Blanc"], { name: "B1" }), terrain(["Rouge"], { name: "R1" }), terrain(["Bleu"], { name: "U1" })), carte({ Blanc: 2, generic: 1 })),
    "Test 2 — ⚪⚪① est refusé avec un seul terrain blanc"
  );

  // Test 3 : ⚪⚪① payé par ⚪ + ⚪/🔵 + 🟢  => jouable, le bicolore rend Blanc
  const avecBicolore = cote(
    terrain(["Blanc"], { name: "Blanc" }),
    terrain(["Blanc", "Bleu"], { name: "Blanc/Bleu" }),
    terrain(["Vert"], { name: "Vert" })
  );
  const plan3 = paymentPlan(avecBicolore, carte({ Blanc: 2, generic: 1 }));
  verifier(Boolean(plan3), "Test 3 — ⚪⚪① se paie avec Blanc + Blanc/Bleu + Vert");
  verifier(
    nomsPlan(plan3) === "Blanc + Blanc/Bleu + Vert",
    "Test 3 — les trois terrains sont engagés, le bicolore fournissant le second blanc",
    String(nomsPlan(plan3))
  );

  // Test 4 : la règle énoncée est « un même terrain ne peut pas payer
  // simultanément Blanc ET Bleu ». Seul, un terrain ⚪/🔵 ne suffit donc pas.
  verifier(
    !canPayCard(cote(terrain(["Blanc", "Bleu"], { name: "Blanc/Bleu" })), carte({ Blanc: 1, Bleu: 1 })),
    "Test 4 — un terrain « au choix » ne paie pas Blanc ET Bleu à lui seul"
  );
  // En revanche, deux terrains fournissent bien deux mana de deux couleurs :
  // ⚪/🔵 rend Bleu pendant que le terrain blanc rend Blanc.
  const plan4 = paymentPlan(
    cote(terrain(["Blanc", "Bleu"], { name: "Blanc/Bleu" }), terrain(["Blanc"], { name: "Blanc" })),
    carte({ Blanc: 1, Bleu: 1 })
  );
  verifier(
    nomsPlan(plan4) === "Blanc + Blanc/Bleu",
    "Test 4 bis — ⚪/🔵 + ⚪ paie bien ⚪🔵 en engageant les deux terrains",
    String(nomsPlan(plan4))
  );

  // Test 5 : ⚪🔵 avec un terrain qui produit vraiment ⚪ + 🔵 => jouable
  verifier(
    canPayCard(cote(terrain(["Blanc", "Bleu"], { name: "Double source", mode: "all" })), carte({ Blanc: 1, Bleu: 1 })),
    "Test 5 — un terrain qui produit réellement deux manas paie ⚪🔵 seul"
  );

  // Test 6 : ③ avec n'importe quelles trois couleurs
  verifier(
    canPayCard(cote(terrain(["Rouge"]), terrain(["Vert"]), terrain(["Noir"])), carte({ generic: 3 })),
    "Test 6 — ③ accepte trois couleurs quelconques"
  );
  verifier(
    !canPayCard(cote(terrain(["Rouge"]), terrain(["Vert"])), carte({ generic: 3 })),
    "Test 6 bis — ③ reste refusé avec deux terrains seulement"
  );

  // Test 7 : le paiement préserve les terrains souples
  const plan7 = paymentPlan(
    cote(
      terrain(["Blanc"], { name: "Blanc A" }),
      terrain(["Blanc"], { name: "Blanc B" }),
      terrain(["Rouge"], { name: "Rouge" }),
      terrain(["Blanc", "Bleu"], { name: "Blanc/Bleu" })
    ),
    carte({ Blanc: 2, generic: 1 })
  );
  verifier(
    nomsPlan(plan7) === "Blanc A + Blanc B + Rouge",
    "Test 7 — le terrain Blanc/Bleu est conservé quand des mono-couleurs suffisent",
    String(nomsPlan(plan7))
  );

  const plan7bis = paymentPlan(
    cote(terrain(["Vert"], { name: "Vert" }), terrain(["Blanc", "Bleu", "Noir"], { name: "Prisme" })),
    carte({ generic: 1 })
  );
  verifier(nomsPlan(plan7bis) === "Vert", "Test 7 bis — un générique prend le terrain le moins souple", String(nomsPlan(plan7bis)));

  // Test 8 : jamais deux paiements pour une carte, jamais deux fois un terrain
  const main = cote(terrain(["Blanc"], { name: "B1" }), terrain(["Blanc"], { name: "B2" }), terrain(["Rouge"], { name: "R1" }));
  const cible = carte({ Blanc: 2, generic: 1 });
  const premier = payCardCost(main, cible);
  const second = payCardCost(main, cible);
  verifier(premier === true, "Test 8 — le premier paiement passe");
  verifier(second === false, "Test 8 — le second paiement immédiat est refusé");
  verifier(main.lands.filter((land) => land.tapped).length === 3, "Test 8 — exactement trois terrains sont engagés, aucun deux fois");
}

// ======================================================================
section("Terrains : production et vocabulaire");
{
  const simple = terrain(["Blanc"]);
  verifier(landEnergy(simple) === 1, "Un terrain simple produit 1 mana");
  verifier(landProductionTokens(simple).tokens.length === 1, "Il s'affiche avec un seul jeton");

  const capitale = terrain(["Blanc"], { amount: 2 });
  verifier(landEnergy(capitale) === 2, "Une capitale produit 2 mana");
  const jetonsCapitale = landProductionTokens(capitale);
  verifier(jetonsCapitale.tokens.length === 2 && jetonsCapitale.separator === "et", "Elle s'affiche ⚪ + ⚪ (les deux à la fois)");

  const choix = terrain(["Blanc", "Bleu"]);
  const jetonsChoix = landProductionTokens(choix);
  verifier(jetonsChoix.separator === "ou", "Un terrain bicolore s'affiche avec « ou »");
  verifier(landEnergy(choix) === 1, "Un terrain bicolore ne rend qu'un seul mana");

  const double = terrain(["Blanc", "Bleu"], { mode: "all" });
  verifier(landProductionTokens(double).separator === "et", "Un terrain à double production s'affiche avec « et »");
  verifier(landEnergy(double) === 2, "Il rend bien deux mana");
  verifier(/en même temps/.test(describeLandProduction(double)), "Sa description dit qu'il produit les deux à la fois");
  verifier(/au choix/.test(describeLandProduction(choix)), "Celle du bicolore dit « au choix »");
}

// ======================================================================
section("Compatibilité des anciennes données");
{
  const ancien = { id: "x", kind: "land", name: "Ancien", family: "Vert", energy: 1 };
  verifier(landFamilies(ancien).join() === "Vert", "Un terrain à l'ancien format garde sa couleur");
  verifier(landEnergy(ancien) === 1, "Et sa quantité de mana");
  const ancienneCapitale = { id: "y", kind: "land", name: "Capitale", families: ["Noir"], energy: 2 };
  verifier(landEnergy(ancienneCapitale) === 2, "Une capitale non migrée produit toujours 2 mana");
}

// ======================================================================
section("Cohérence données / moteur / affichage sur toutes les cartes");
{
  const toutes = [...cards.map((c) => ({ ...c, kind: "creature" })), ...spells.map((c) => ({ ...c, kind: "spell" }))];
  const incoherences = [];
  const sansDeclaration = [];

  for (const card of toutes) {
    const requirements = manaRequirements(card);
    const jetons = manaCostTokens(card);
    const totalJetons = jetons.reduce((total, jeton) => total + (jeton.type === "generic" ? jeton.amount : 1), 0);

    if (totalJetons !== requirements.total) {
      incoherences.push(`${card.id} : ${totalJetons} jetons pour ${requirements.total} mana`);
    }
    if (requirements.total !== Math.max(0, Math.trunc(card.cost))) {
      incoherences.push(`${card.id} : coût affiché ${requirements.total} vs cost ${card.cost}`);
    }
    for (const [family] of requirements.colored) {
      if (!MANA_COLORS.includes(family)) incoherences.push(`${card.id} : couleur inconnue ${family}`);
    }
    if (!card.manaCost) sansDeclaration.push(card.id);
    else {
      const attendu = manaCostRecord(card);
      const declare = { generic: 0, ...card.manaCost };
      for (const cle of new Set([...Object.keys(attendu), ...Object.keys(declare)])) {
        if ((attendu[cle] || 0) !== (declare[cle] || 0)) {
          incoherences.push(`${card.id} : ${cle} déclaré ${declare[cle] || 0}, appliqué ${attendu[cle] || 0}`);
        }
      }
    }
  }

  verifier(incoherences.length === 0, `Les ${toutes.length} cartes affichent le coût que le moteur applique`, incoherences.slice(0, 4).join(" | "));
  verifier(sansDeclaration.length === 0, "Chaque carte déclare son coût dans les données", `${sansDeclaration.length} sans manaCost : ${sansDeclaration.slice(0, 4).join(", ")}`);

  // Chaque carte doit être payable avec les terrains que son coût annonce.
  const impayables = [];
  for (const card of toutes) {
    const requirements = manaRequirements(card);
    const terrains = [];
    for (const [family, amount] of requirements.colored) {
      for (let i = 0; i < amount; i += 1) terrains.push(terrain([family]));
    }
    for (let i = 0; i < requirements.generic; i += 1) terrains.push(terrain(["Vert"]));
    if (!canPayCard(cote(...terrains), card)) impayables.push(card.id);
  }
  verifier(impayables.length === 0, "Chaque carte est réellement payable avec les terrains qu'elle exige", impayables.slice(0, 4).join(", "));
}

// ======================================================================
section("Cohérence des terrains du jeu");
{
  const incoherences = [];
  const sansDeclaration = [];
  for (const land of lands) {
    const production = landProduction(land);
    if (production.colors.length === 0) incoherences.push(`${land.id} : aucune couleur produite`);
    if (!land.manaProduction) sansDeclaration.push(land.id);
    // L'identité de couleur de la carte doit faire partie de ce qu'elle
    // produit, sinon le cadre et le symbole mentent sur son usage.
    if (land.family && land.family !== "Multicolore" && !production.colors.includes(land.family)) {
      incoherences.push(`${land.id} : identité ${land.family} absente de sa production ${production.colors.join("/")}`);
    }
    if (land.family === "Multicolore" && production.colors.length < 2) {
      incoherences.push(`${land.id} : annoncé multicolore mais ne produit qu'une couleur`);
    }
    if ("energy" in land || "families" in land) {
      incoherences.push(`${land.id} : conserve un ancien champ de production (energy/families)`);
    }
    const jetons = landProductionTokens(land);
    if (jetons.tokens.length === 0) incoherences.push(`${land.id} : rien à afficher`);
    // Le texte de la carte doit annoncer le même nombre de mana.
    const texte = String(land.abilityText || "");
    const annonce = texte.match(/(\d+)\s*mana/);
    if (annonce && Number(annonce[1]) !== landEnergy(land)) {
      incoherences.push(`${land.id} : le texte annonce ${annonce[1]} mana, le moteur en rend ${landEnergy(land)}`);
    }
    const auChoix = /au choix|de la couleur de ton choix|\bou\b/.test(texte);
    if (production.colors.length > 1 && production.mode === "choice" && !auChoix) {
      incoherences.push(`${land.id} : terrain multicolore dont le texte ne dit pas « au choix »`);
    }
  }
  verifier(incoherences.length === 0, `Les ${lands.length} terrains produisent ce que leur carte annonce`, incoherences.slice(0, 4).join(" | "));
  verifier(sansDeclaration.length === 0, "Chaque terrain déclare sa production dans les données", `${sansDeclaration.length} sans manaProduction`);
}

// ======================================================================
section("Symboles de mana disponibles pour l'affichage");
{
  const manquants = [...MANA_COLORS, "Générique"].filter((famille) => !elements[famille]?.mana?.fond);
  verifier(manquants.length === 0, "Chaque couleur de mana possède ses teintes d'affichage", manquants.join(", "));
  verifier(/2 manas blancs et 1 mana de n'importe quelle couleur/.test(describeManaCost(carte({ Blanc: 2, generic: 1 }))),
    "La phrase de la fiche décrit exactement le coût", describeManaCost(carte({ Blanc: 2, generic: 1 })));
}

// ======================================================================
console.log(`\n${resultats.reussis}/${resultats.total} vérifications passent.`);
if (resultats.echecs.length > 0) {
  console.log("\nÉchecs :");
  for (const echec of resultats.echecs) console.log(`  - ${echec}`);
  process.exit(1);
}
console.log("\n=> TOUS LES TESTS DE MANA PASSENT");
