// =====================================================================
// Spellaho - La ruche appelle « Parasite Larve »
// ---------------------------------------------------------------------
// Le Zombie parasite et la Reine Parasite parlaient d une « Larve
// parasite 1/1 » qui n existait nulle part au catalogue : le moteur en
// recopiait une a la main, avec l illustration du Parasite adulte.
// La carte « Parasite Larve » existe depuis le lot d aout : les deux
// textes la nomment desormais, comme le moteur.
//
//   node .\tools\corriger-ruche-parasite.mjs
// =====================================================================
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chemin = path.join(RACINE, "data", "cards.json");

const TEXTES = {
  "zombie-parasite":
    "Quand cette créature meurt, une Parasite Larve 1/1 éclot de sa dépouille et prend sa place.",
  "reine-parasite":
    "Quand cette carte arrive sur le champ de bataille, elle fait éclore jusqu'à deux Parasite Larve 1/1."
};

const cartes = JSON.parse(await readFile(chemin, "utf8"));

const larve = cartes.find((carte) => carte.id === "parasite-larve");
if (!larve) throw new Error("La carte « Parasite Larve » est absente du catalogue.");

const journal = [];
for (const carte of cartes) {
  const texte = TEXTES[carte.id];
  if (!texte || carte.abilityText === texte) continue;
  journal.push(`${carte.name} : « ${carte.abilityText} » -> « ${texte} »`);
  carte.abilityText = texte;
}

if (journal.length > 0) {
  await writeFile(chemin, `${JSON.stringify(cartes, null, 2)}\n`, "utf8");
}
console.log(journal.length > 0 ? journal.join("\n") : "Rien à corriger.");
