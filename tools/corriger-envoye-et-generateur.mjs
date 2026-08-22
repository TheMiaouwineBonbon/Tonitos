// =====================================================================
// Spellaho - Envoye de Bhaal, Generateur antique, deck Rouge/Noir
// ---------------------------------------------------------------------
// L Envoye de Bhaal passe en 4/4 pour 2 tenebres et 1 incolore, et change
// de role : il n envoie plus de blessures aux heros, il affaiblit de 1/1
// les creatures adverses DEJA posees. Le moteur ne connait pas d aura
// permanente - toutes les capacites du jeu se declenchent a un instant
// precis - donc l effet joue a l arrivee, pas en continu.
//
// Le Generateur antique produit trois drones au lieu de deux. Il est
// desormais seul a en fabriquer, le Portail Universel ayant change d effet.
//
// Le deck Rouge/Noir echange le Magicien exile contre l Envoye.
//
//   node .\tools\corriger-envoye-et-generateur.mjs
// =====================================================================
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const journal = [];

// --- Envoye de Bhaal --------------------------------------------------
const cheminCartes = path.join(RACINE, "data", "cards.json");
const cartes = JSON.parse(await readFile(cheminCartes, "utf8"));
const envoye = cartes.find((carte) => carte.id === "envoye-bhaal");
if (!envoye) throw new Error("Envoyé de Bhaal introuvable.");

journal.push(
  `Envoyé de Bhaal : ${envoye.attack}/${envoye.life} coût ${envoye.cost} -> 4/4 coût 3 (2 noirs + 1 générique)`
);
envoye.cost = 3;
envoye.manaCost = { Noir: 2, generic: 1 };
envoye.attack = 4;
envoye.life = 4;
envoye.keywords = ["Contact mortel", "Pacte"];
envoye.abilityName = "Présage funeste";
envoye.abilityText =
  "Quand cette carte arrive, chaque créature adverse déjà en jeu perd 1 force et 1 point de vie.";
envoye.flavor = "Là où il pose le pied, les autres se tiennent un peu moins droit.";

// --- Generateur antique ----------------------------------------------
const cheminSorts = path.join(RACINE, "data", "spells.json");
const sorts = JSON.parse(await readFile(cheminSorts, "utf8"));
const generateur = sorts.find((carte) => carte.id === "generateur-antique");
if (!generateur) throw new Error("Générateur antique introuvable.");

journal.push("Générateur antique : 2 drones -> 3 drones");
generateur.abilityText =
  "Assemble trois Robot antique drone 1/1 et les envoie rejoindre le réseau.";

// --- Deck Rouge / Noir ------------------------------------------------
const cheminDecks = path.join(RACINE, "decks.mjs");
let source = await readFile(cheminDecks, "utf8");
const avant = source;
source = source.replace(
  /\{ id: "magiciens-exiles", copies: 1 \}/,
  '{ id: "envoye-bhaal", copies: 1 }'
);
if (source === avant) throw new Error("Entrée « magiciens-exiles » introuvable dans decks.mjs.");
journal.push("Pacte des Cendres : Magicien exilé -> Envoyé de Bhaal");

await writeFile(cheminCartes, `${JSON.stringify(cartes, null, 2)}\n`, "utf8");
await writeFile(cheminSorts, `${JSON.stringify(sorts, null, 2)}\n`, "utf8");
await writeFile(cheminDecks, source, "utf8");
console.log(journal.join("\n"));
