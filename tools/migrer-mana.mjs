// =====================================================================
// Spellaho - Migration des couts et des productions de mana
// ---------------------------------------------------------------------
// Ecrit dans les donnees ce que le moteur appliquait jusqu ici de facon
// implicite : le cout exact de chaque carte (part coloree + part
// generique) et la production exacte de chaque terrain. Aucun equilibrage
// n est touche, les valeurs sont celles que `manaRequirements` et
// `landProduction` calculaient deja.
//
//   node .\tools\migrer-mana.mjs          verifie et ecrit
//   node .\tools\migrer-mana.mjs --verif  verifie sans ecrire
// =====================================================================
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { landProduction, manaCostRecord, MANA_COLORS } from "../engine-core.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifSeule = process.argv.includes("--verif");

const chemin = (nom) => path.join(RACINE, "data", nom);
const lire = async (nom) => JSON.parse(await readFile(chemin(nom), "utf8"));
const ecrire = async (nom, valeur) => writeFile(chemin(nom), `${JSON.stringify(valeur, null, 2)}\n`, "utf8");

// Reinsere une cle a une position lisible sans bousculer le reste.
function inserer(objet, cle, valeur, apres) {
  const sortie = {};
  let pose = false;
  for (const [nom, contenu] of Object.entries(objet)) {
    if (nom === cle) continue;
    sortie[nom] = contenu;
    if (nom === apres) {
      sortie[cle] = valeur;
      pose = true;
    }
  }
  if (!pose) sortie[cle] = valeur;
  return sortie;
}

const rapport = { cartes: 0, sorts: 0, terrains: 0, ajouts: 0, corrections: [] };

async function migrerCartes(fichier, kind) {
  const cartes = await lire(fichier);
  const sortie = cartes.map((card) => {
    const attendu = manaCostRecord({ ...card, kind });
    if (card.manaCost) {
      const declare = { generic: 0, ...card.manaCost };
      for (const cle of new Set([...Object.keys(attendu), ...Object.keys(declare)])) {
        if ((attendu[cle] || 0) !== (declare[cle] || 0)) {
          rapport.corrections.push(`${card.id} : ${cle} ${declare[cle] || 0} -> ${attendu[cle] || 0}`);
        }
      }
    } else {
      rapport.ajouts += 1;
    }
    return inserer(card, "manaCost", attendu, "cost");
  });
  if (!verifSeule) await ecrire(fichier, sortie);
  return sortie.length;
}

async function migrerTerrains() {
  const terrains = await lire("lands.json");
  const sortie = terrains.map((land) => {
    const production = landProduction(land);
    const declaree = {
      mode: production.mode,
      colors: production.colors,
      amount: production.amount
    };
    if (!land.manaProduction) rapport.ajouts += 1;
    for (const couleur of production.colors) {
      if (!MANA_COLORS.includes(couleur)) rapport.corrections.push(`${land.id} : couleur inconnue ${couleur}`);
    }
    // `families` et `energy` decrivaient la meme chose que `manaProduction`,
    // en moins precis : deux sources de verite pour une seule regle. Seul
    // `family` reste, comme identite de couleur de la carte.
    const nettoye = { ...land };
    delete nettoye.families;
    delete nettoye.energy;
    return inserer(nettoye, "manaProduction", declaree, "type");
  });
  if (!verifSeule) await ecrire("lands.json", sortie);
  return sortie.length;
}

rapport.cartes = await migrerCartes("cards.json", "creature");
rapport.sorts = await migrerCartes("spells.json", "spell");
rapport.terrains = await migrerTerrains();

console.log(`Cartes  : ${rapport.cartes}`);
console.log(`Sorts   : ${rapport.sorts}`);
console.log(`Terrains: ${rapport.terrains}`);
console.log(`Déclarations ajoutées : ${rapport.ajouts}`);
if (rapport.corrections.length > 0) {
  console.log(`Incohérences corrigées (${rapport.corrections.length}) :`);
  for (const ligne of rapport.corrections) console.log(`  - ${ligne}`);
} else {
  console.log("Aucune incohérence entre les données existantes et le moteur.");
}
console.log(verifSeule ? "(vérification seule, rien n'a été écrit)" : "Données mises à jour.");
