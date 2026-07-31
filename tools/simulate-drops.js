// Simulation statistique du systeme de drop.
// Usage : node tools/simulate-drops.js [nombre_de_tirages]
// Compare les taux theoriques de DROP_CONFIG aux taux reellement obtenus,
// mesure l'ecart, les doublons et l'effet du plancher garanti des boosters.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DROP_CONFIG,
  RARITIES,
  buildLootTable,
  createPityState,
  createRng,
  drawCard,
  inferRarity,
  openBooster,
  theoreticalRates
} from "../drop.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const DRAWS = Math.max(100000, Number(process.argv[2]) || 100000);
const SEED = 20260730;

const load = (file) => JSON.parse(readFileSync(join(root, "data", file), "utf8"));
const cards = [...load("cards.json"), ...load("spells.json"), ...load("lands.json")];

const table = buildLootTable(cards, inferRarity);
const theoretical = theoreticalRates();

const pad = (value, width) => String(value).padStart(width);
const padEnd = (value, width) => String(value).padEnd(width);
const pct = (value) => `${value.toFixed(3)} %`;

// --- 1. Inventaire du pool --------------------------------------------

console.log(`\nPool : ${cards.length} cartes distinctes\n`);
console.log(`${padEnd("Rarete", 14)}${pad("Poids", 7)}${pad("Theorique", 12)}${pad("Cartes", 8)}`);
console.log("-".repeat(41));
for (const id of Object.keys(RARITIES)) {
  console.log(
    padEnd(RARITIES[id].label, 14) +
    pad(DROP_CONFIG.weights[id], 7) +
    pad(pct(theoretical[id]), 12) +
    pad(table[id].length, 8)
  );
}
const empty = Object.keys(RARITIES).filter((id) => table[id].length === 0);
if (empty.length > 0) {
  console.log(`\nRaretes sans carte (redirigees vers la plus proche) : ${empty.join(", ")}`);
}

// --- 2. Tirages unitaires ---------------------------------------------

const rng = createRng(SEED);
const pity = createPityState();
const observed = Object.fromEntries(Object.keys(RARITIES).map((id) => [id, 0]));
const cardCounts = new Map();

for (let i = 0; i < DRAWS; i += 1) {
  const drawn = drawCard(table, rng, pity, DROP_CONFIG);
  if (!drawn) continue;
  observed[drawn.rarity] += 1;
  cardCounts.set(drawn.card.id, (cardCounts.get(drawn.card.id) || 0) + 1);
}

console.log(`\n\nTirages unitaires : ${DRAWS.toLocaleString("fr-FR")} (pity actif)\n`);
console.log(
  `${padEnd("Rarete", 14)}${pad("Theorique", 12)}${pad("Observe", 12)}${pad("Ecart", 10)}`
);
console.log("-".repeat(48));

let chiSquare = 0;
for (const id of Object.keys(RARITIES)) {
  const expected = (DROP_CONFIG.weights[id] / 10000) * DRAWS;
  const got = observed[id];
  const gotPct = (got / DRAWS) * 100;
  const delta = gotPct - theoretical[id];
  if (expected > 0) chiSquare += ((got - expected) ** 2) / expected;
  console.log(
    padEnd(RARITIES[id].label, 14) +
    pad(pct(theoretical[id]), 12) +
    pad(pct(gotPct), 12) +
    pad(`${delta >= 0 ? "+" : ""}${delta.toFixed(3)}`, 10)
  );
}

// 4 degres de liberte : seuil critique 9.488 a 5 %, 13.277 a 1 %.
console.log(`\nChi2 = ${chiSquare.toFixed(2)} (4 ddl ; seuil 5 % = 9.488)`);
console.log(
  chiSquare < 9.488
    ? "Ecart compatible avec le hasard : les taux observes suivent la configuration."
    : "Ecart significatif : le pity et le plancher deplacent volontairement la distribution."
);

// --- 2 bis. Controle sans pity ----------------------------------------
// Isole le moteur de tirage : sans filet, les taux doivent coller aux
// poids configures. Tout ecart significatif ici serait un vrai bug.

const pureRng = createRng(SEED + 7);
const pure = Object.fromEntries(Object.keys(RARITIES).map((id) => [id, 0]));
for (let i = 0; i < DRAWS; i += 1) {
  const drawn = drawCard(table, pureRng, null, DROP_CONFIG);
  if (drawn) pure[drawn.rarity] += 1;
}
let pureChi = 0;
for (const id of Object.keys(RARITIES)) {
  const expected = (DROP_CONFIG.weights[id] / 10000) * DRAWS;
  if (expected > 0) pureChi += ((pure[id] - expected) ** 2) / expected;
}
console.log(`\nControle sans pity : chi2 = ${pureChi.toFixed(2)} (seuil 5 % = 9.488) -> ${pureChi < 9.488 ? "CONFORME" : "ANOMALIE"}`);
for (const id of Object.keys(RARITIES)) {
  console.log(`  ${padEnd(RARITIES[id].label, 14)}${pad(pct((pure[id] / DRAWS) * 100), 12)}`);
}

// --- 3. Couverture et doublons ----------------------------------------

const seen = cardCounts.size;
console.log(`\nCouverture : ${seen}/${cards.length} cartes obtenues au moins une fois`);
const never = cards.filter((card) => !cardCounts.has(card.id));
if (never.length > 0) {
  console.log(`ALERTE : ${never.length} carte(s) jamais obtenue(s) -> ${never.slice(0, 5).map((c) => c.id).join(", ")}`);
} else {
  console.log("Aucune carte impossible a obtenir.");
}

const counts = [...cardCounts.values()].sort((a, b) => b - a);
const mean = counts.reduce((sum, n) => sum + n, 0) / counts.length;
console.log(`Tirages par carte : moyenne ${mean.toFixed(1)}, max ${counts[0]}, min ${counts[counts.length - 1]}`);

// Une carte d'une rarete superieure doit toujours etre PLUS difficile a
// obtenir individuellement. Sans ce controle, un pool desequilibre inverse
// la rarete percue sans que les taux par rarete ne bougent.
console.log("\nFrequence moyenne d'UNE carte donnee, par rarete :");
let previous = Infinity;
let monotone = true;
for (const id of Object.keys(RARITIES)) {
  const size = table[id].length;
  if (size === 0) continue;
  const perCard = observed[id] / size;
  if (perCard > previous) monotone = false;
  previous = perCard;
  console.log(`  ${padEnd(RARITIES[id].label, 14)}${pad(perCard.toFixed(1), 9)} tirages  (${size} cartes)`);
}
console.log(monotone
  ? "Decroissance respectee : plus la rarete est haute, plus la carte est dure a obtenir."
  : "ALERTE : inversion de rarete percue, le pool est mal reparti.");

// --- 4. Boosters -------------------------------------------------------

const boosterRng = createRng(SEED + 1);
const boosterPity = createPityState();
const boosters = Math.floor(DRAWS / DROP_CONFIG.booster.size);
const boosterRarity = Object.fromEntries(Object.keys(RARITIES).map((id) => [id, 0]));
let duplicateTotal = 0;
let boostersWithLegendary = 0;

for (let i = 0; i < boosters; i += 1) {
  const pack = openBooster(table, boosterRng, boosterPity, DROP_CONFIG);
  const ids = new Set();
  for (const { card, rarity } of pack) {
    boosterRarity[rarity] += 1;
    if (ids.has(card.id)) duplicateTotal += 1;
    ids.add(card.id);
  }
  if (pack.some((entry) => RARITIES[entry.rarity].rank >= 4)) boostersWithLegendary += 1;
}

const boosterCards = boosters * DROP_CONFIG.booster.size;
console.log(`\n\nBoosters : ${boosters.toLocaleString("fr-FR")} ouverts (${DROP_CONFIG.booster.size} cartes, plancher slot ${DROP_CONFIG.booster.guaranteedFloor.slot})\n`);
console.log(`${padEnd("Rarete", 14)}${pad("Brut", 12)}${pad("Effectif", 12)}${pad("Ecart", 10)}`);
console.log("-".repeat(48));
for (const id of Object.keys(RARITIES)) {
  const effective = (boosterRarity[id] / boosterCards) * 100;
  const delta = effective - theoretical[id];
  console.log(
    padEnd(RARITIES[id].label, 14) +
    pad(pct(theoretical[id]), 12) +
    pad(pct(effective), 12) +
    pad(`${delta >= 0 ? "+" : ""}${delta.toFixed(3)}`, 10)
  );
}

console.log(`\nDoublons internes : ${(duplicateTotal / boosters).toFixed(3)} par booster`);
console.log(`Boosters contenant une legendaire : ${((boostersWithLegendary / boosters) * 100).toFixed(2)} %`);
console.log(`Soit une legendaire tous les ${(boosters / Math.max(1, boostersWithLegendary)).toFixed(1)} boosters\n`);
