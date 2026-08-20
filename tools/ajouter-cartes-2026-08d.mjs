// =====================================================================
// Spellaho - Ultime Vengeur (1 carte)
// ---------------------------------------------------------------------
// Pendant bleu de Flamme Purificatrice : meme effet `purifyingFlame`
// (Defenseur + regeneration complete), mais a 2 manas au lieu de 3.
//
// A savoir : « Tempete de Braise » est la seule paire Rouge/Bleu du jeu,
// donc le seul deck a pouvoir jouer les deux. Dans celui-la, Ultime
// Vengeur domine Flamme Purificatrice, qui fait la meme chose pour un
// mana de plus. Partout ailleurs les deux cartes ne se croisent jamais.
//
// Slot « defense » et non « upgrade » : le quota utilitaire de
// pickSpells est deja pris par les artefacts signature, la carte n y
// entrerait jamais. En defense elle concourt sur les 10 places
// interactives, ou elle a sa chance sans etre forcee.
//
// Rejouable : la carte est mise a jour si elle existe deja.
//   node .\tools\ajouter-cartes-2026-08d.mjs
// =====================================================================
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chemin = (nom) => path.join(RACINE, "data", nom);
const lire = async (nom) => JSON.parse(await readFile(chemin(nom), "utf8"));

const cards = await lire("cards.json");
const spells = await lire("spells.json");
const lands = await lire("lands.json");

const sorts = [
  {
    id: "ultime-vengeur",
    name: "Ultime Vengeur",
    subtitle: "Le dernier debout sur l'épave",
    family: "Bleu",
    type: "Rituel - Sort de vengeance",
    cost: 2,
    effect: "purifyingFlame",
    slot: "defense",
    keywords: ["Vengeance", "Garde"],
    abilityName: "Serment de l'orage",
    abilityText:
      "Régénère entièrement ta créature la plus blessée et lui donne Défenseur : l'adversaire devra l'abattre en premier.",
    flavor: "Ils ont brûlé sa flotte. Ils auraient dû le brûler, lui.",
    image: "Images/Ultime Vengeur.png",
    palette: { primary: "#176b8c", secondary: "#67d3ff", deep: "#081d2a" }
  }
];

function fusionner(existantes, ajouts) {
  const connues = new Set(existantes.map((carte) => carte.id));
  const liste = existantes.map((carte) => {
    const remplacement = ajouts.find((ajout) => ajout.id === carte.id);
    return remplacement ? { ...remplacement, numero: carte.numero } : carte;
  });
  const inedites = ajouts.filter((ajout) => !connues.has(ajout.id));
  return { liste: [...liste, ...inedites], inedites: inedites.length };
}

const connues = [...cards, ...spells, ...lands];
for (const carte of sorts) {
  const homonyme = connues.find((autre) => autre.name === carte.name && autre.id !== carte.id);
  if (homonyme) throw new Error(`nom déjà porté par ${homonyme.id} : ${carte.name}`);
}

const fusion = fusionner(spells, sorts);
await writeFile(chemin("spells.json"), `${JSON.stringify(fusion.liste, null, 2)}\n`, "utf8");

console.log(`sorts ${spells.length} -> ${fusion.liste.length} (+${fusion.inedites})`);
