// =====================================================================
// Spellaho - Impact stellaire, et l illustration du Largage d Ulgod
// ---------------------------------------------------------------------
// Explosion celeste garde son nom et celui de sa capacite. Seul l effet
// change : elle infligeait 2 blessures au commandant adverse, elle lance
// desormais une piece. Chaque face envoie une salve de 2 blessures sur
// TOUTES les creatures adverses, le premier pile arrete tout. L esperance
// est d une salve, mais l ecart est large : c est le pari qui fait la carte.
//
// Largage d Ulgod recoit l illustration Squelette.png. Ses dimensions sont
// relevees ici : sans elles, le gabarit ne saurait que centrer l image.
//
//   node .\tools\corriger-explosion-et-largage.mjs
// =====================================================================
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chemin = path.join(RACINE, "data", "spells.json");

async function mesurerPng(relatif) {
  const octets = await readFile(path.join(RACINE, relatif));
  if (!(octets[0] === 0x89 && octets[1] === 0x50)) throw new Error(`${relatif} n'est pas un PNG.`);
  return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20) };
}

const IMAGE_LARGAGE = "Images/Squelette.png";
const dimensions = await mesurerPng(IMAGE_LARGAGE);

const sorts = JSON.parse(await readFile(chemin, "utf8"));
const journal = [];

for (const carte of sorts) {
  if (carte.id === "explosion-celeste") {
    journal.push(`${carte.name} : effet ${carte.effect} -> impactStellaire`);
    carte.effect = "impactStellaire";
    carte.abilityText =
      "Lance une pièce. À chaque face, inflige 2 blessures à toutes les créatures adverses et relance. Le premier pile arrête tout.";
    carte.keywords = ["Feu", "Zone", "Hasard"];
  }

  if (carte.id === "largage-ulgod") {
    journal.push(`${carte.name} : illustration ${carte.image} -> ${IMAGE_LARGAGE}`);
    carte.image = IMAGE_LARGAGE;
    carte.art = { ...(carte.art || { fit: "cover", position: "50% 45%" }), dimensions };
  }
}

if (journal.length !== 2) throw new Error(`Cartes attendues introuvables : ${journal.length}/2`);

await writeFile(chemin, `${JSON.stringify(sorts, null, 2)}\n`, "utf8");
console.log(journal.join("\n"));
console.log(`illustration : ${dimensions.largeur}x${dimensions.hauteur}`);
