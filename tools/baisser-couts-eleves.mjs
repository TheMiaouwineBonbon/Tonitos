// =====================================================================
// Spellaho - Un mana de moins au-dessus de 4
// ---------------------------------------------------------------------
// Toute carte qui coute PLUS de 4 manas en coute un de moins. Les cartes
// a 4 ou moins ne bougent pas, les terrains non plus (ils sont a 0).
//
// Le cout colore suit : `manaCost` declare son detail, et `manaRequirements`
// retient le PLUS GRAND entre le generique declare et ce qu'exige `cost`.
// Baisser `cost` sans toucher au generique declare ne changerait donc rien
// pour les trois cartes multicolores. On decremente les deux.
//
// Le script est rejouable au sens ou il ne s applique qu une fois : apres
// son passage, une carte a 5 est devenue une carte a 4, et 4 n est plus
// « plus de 4 ». Le relancer redescendrait cependant les cartes restees
// au-dessus de 4 - ne le lancer qu une fois par palier voulu.
//
//   node .\tools\baisser-couts-eleves.mjs          applique
//   node .\tools\baisser-couts-eleves.mjs --verif  liste sans ecrire
// =====================================================================
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifSeule = process.argv.includes("--verif");
const chemin = (nom) => path.join(RACINE, "data", nom);
const lire = async (nom) => JSON.parse(await readFile(chemin(nom), "utf8"));

const SEUIL = 4;

function baisser(carte) {
  if (!(carte.cost > SEUIL)) return null;
  const avant = { cost: carte.cost, manaCost: carte.manaCost && { ...carte.manaCost } };
  carte.cost -= 1;

  if (carte.manaCost && typeof carte.manaCost === "object") {
    const generique = Math.max(0, Math.trunc(Number(carte.manaCost.generic) || 0));
    if (generique > 0) {
      carte.manaCost = { ...carte.manaCost, generic: generique - 1 };
    } else {
      // Aucun generique a rogner : c est la part coloree qui doit ceder,
      // sinon le cout declare depasserait le cout d equilibrage.
      const couleur = Object.keys(carte.manaCost).find(
        (cle) => cle !== "generic" && carte.manaCost[cle] > 0
      );
      if (couleur) carte.manaCost = { ...carte.manaCost, [couleur]: carte.manaCost[couleur] - 1 };
    }
  }
  return { nom: carte.name, avant, apres: { cost: carte.cost, manaCost: carte.manaCost } };
}

const journal = [];
for (const fichier of ["cards.json", "spells.json"]) {
  const cartes = await lire(fichier);
  for (const carte of cartes) {
    const trace = baisser(carte);
    if (trace) journal.push(trace);
  }
  if (!verifSeule) await writeFile(chemin(fichier), `${JSON.stringify(cartes, null, 2)}\n`, "utf8");
}

for (const t of journal) {
  const detail = t.avant.manaCost
    ? ` (${JSON.stringify(t.avant.manaCost)} -> ${JSON.stringify(t.apres.manaCost)})`
    : "";
  console.log(`  ${t.nom.padEnd(32)} ${t.avant.cost} -> ${t.apres.cost}${detail}`);
}
console.log(`\n${journal.length} carte(s) allegee(s) d'un mana${verifSeule ? " (verification seule)" : ""}.`);
