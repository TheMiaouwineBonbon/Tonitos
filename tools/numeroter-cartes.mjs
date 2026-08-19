// =====================================================================
// Spellaho - Numerotation de collection
// ---------------------------------------------------------------------
// Attribue a chaque carte un numero de collection « NNN/TTT », comme sur
// les cartes physiques : creatures d abord, puis sorts, puis terrains,
// dans l ordre des fichiers de donnees (l ordre de creation du jeu).
//
// Rejouable : ajouter des cartes puis relancer ce script renumerote tout,
// total compris. Le gabarit affiche le champ `numero` tel quel.
//   node .\tools\numeroter-cartes.mjs
// =====================================================================
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FICHIERS = ["cards.json", "spells.json", "lands.json"];

const listes = [];
let total = 0;
for (const nom of FICHIERS) {
  const cartes = JSON.parse(await readFile(path.join(RACINE, "data", nom), "utf8"));
  listes.push([nom, cartes]);
  total += cartes.length;
}

const largeur = String(total).length;
let numero = 0;
let changements = 0;
for (const [nom, cartes] of listes) {
  for (const carte of cartes) {
    numero += 1;
    const etiquette = `${String(numero).padStart(largeur, "0")}/${total}`;
    if (carte.numero !== etiquette) {
      carte.numero = etiquette;
      changements += 1;
    }
  }
  await writeFile(
    path.join(RACINE, "data", nom),
    JSON.stringify(cartes, null, 2) + "\n",
    "utf8"
  );
}

console.log(`${total} cartes numérotées (${changements} numéros écrits ou mis à jour)`);
