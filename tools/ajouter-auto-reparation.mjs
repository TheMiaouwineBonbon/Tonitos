// =====================================================================
// Spellaho - Auto-reparation (1 carte)
// ---------------------------------------------------------------------
// Troisieme sort de l archetype Robot antique, apres Tir de robot et
// Bouclier antique, dont il reprend le cout et la palette.
//
// L effet `ancientRobotRepair` est implemente dans game.js : il remet a
// neuf les seuls Robots antiques - ni les allies de chair, ni Daemon. C est
// cette condition qui le paye a 2 manas, la ou un soin d equipe sans
// condition en coute 4.
//
// Rejouable : la carte est mise a jour si elle existe deja.
//   node .\tools\ajouter-auto-reparation.mjs
// =====================================================================
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chemin = (nom) => path.join(RACINE, "data", nom);
const lire = async (nom) => JSON.parse(await readFile(chemin(nom), "utf8"));

// Dimensions reelles de l illustration : le gabarit en a besoin pour cadrer
// autrement qu au centre, comme le fait `object-position` en partie.
async function mesurerPng(relatif) {
  const octets = await readFile(path.join(RACINE, relatif));
  if (!(octets[0] === 0x89 && octets[1] === 0x50)) throw new Error(`${relatif} n'est pas un PNG.`);
  return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20) };
}

const IMAGE = "Images/Auto-réparation.png";

const carte = {
  id: "auto-reparation",
  kind: "spell",
  name: "Auto-réparation",
  subtitle: "La carapace se recompose",
  family: "Incolore",
  type: "Rituel - Maintenance antique",
  cost: 2,
  manaCost: { generic: 2 },
  effect: "ancientRobotRepair",
  slot: "defense",
  keywords: ["Robot antique", "Soin", "Antique"],
  abilityName: "Remise en état",
  abilityText: "Tous tes Robots antiques retrouvent d'un coup l'intégralité de leurs points de vie.",
  flavor: "Elle ne guérit pas. Elle se souvient de sa forme, et y revient.",
  image: IMAGE,
  palette: { primary: "#475569", secondary: "#60a5fa", deep: "#0f172a" },
  art: { fit: "cover", position: "50% 50%", dimensions: await mesurerPng(IMAGE) }
};

const cards = await lire("cards.json");
const spells = await lire("spells.json");
const lands = await lire("lands.json");

const homonyme = [...cards, ...spells, ...lands].find(
  (autre) => autre.name === carte.name && autre.id !== carte.id
);
if (homonyme) throw new Error(`nom déjà porté par ${homonyme.id} : ${carte.name}`);

const connue = spells.some((autre) => autre.id === carte.id);
const liste = connue
  ? spells.map((autre) => (autre.id === carte.id ? { ...carte, numero: autre.numero } : autre))
  : [...spells, carte];

await writeFile(chemin("spells.json"), `${JSON.stringify(liste, null, 2)}\n`, "utf8");
console.log(`sorts ${spells.length} -> ${liste.length} (${connue ? "mise à jour" : "ajout"})`);
console.log(`illustration : ${carte.art.dimensions.largeur}x${carte.art.dimensions.hauteur}`);
