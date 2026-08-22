// =====================================================================
// Spellaho - Portail Universel, et le deck de Daemon
// ---------------------------------------------------------------------
// Le Portail antique devient le Portail Universel. Il n invoque plus de
// drones : sa capacite « Resonnance » donne +2/+2 a tout ce que tu as
// DEJA pose. Sa citation suivait l ancien effet - « ceux qui savent
// encore compter » parlait des machines - elle change avec lui.
//
// Le Generateur antique reste, lui, la source des drones : les deux
// cartes ne font donc plus doublon.
//
//   node .\tools\corriger-portail-universel.mjs
// =====================================================================
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chemin = path.join(RACINE, "data", "spells.json");

const sorts = JSON.parse(await readFile(chemin, "utf8"));
const journal = [];

const portail = sorts.find((carte) => carte.id === "portail-antique");
if (!portail) throw new Error("Portail antique introuvable.");

journal.push(`${portail.name} -> Portail Universel`);
portail.name = "Portail Universel";
portail.subtitle = "Seuil où tout se répond";
portail.type = "Artefact légendaire - Portail";
portail.effect = "resonnance";
portail.abilityName = "Résonnance";
portail.abilityText =
  "Toutes les cartes que tu as déjà posées gagnent définitivement +2 force et +2 points de vie.";
portail.flavor = "Ce qui passe la porte n'en revient jamais tout à fait pareil.";
portail.keywords = ["Antique", "Résonnance"];

// --- Deck Héritage des Anciens ---------------------------------------
// Deux Bulle Revigorante cedent la place a deux Auto-reparation : le deck
// est entierement machine, un soin generique y valait moins qu une
// reparation qui remet TOUS les robots a neuf.
const decks = path.join(RACINE, "decks.mjs");
let source = await readFile(decks, "utf8");
const avant = source;
source = source.replace(
  /\{ id: "bulle-revigorante", copies: 2 \}/,
  '{ id: "auto-reparation", copies: 2 }'
);
if (source === avant) throw new Error("Entrée « bulle-revigorante » introuvable dans decks.mjs.");
journal.push("Héritage des Anciens : 2 Bulle Revigorante -> 2 Auto-réparation");

await writeFile(chemin, `${JSON.stringify(sorts, null, 2)}\n`, "utf8");
await writeFile(decks, source, "utf8");
console.log(journal.join("\n"));
