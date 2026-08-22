// =====================================================================
// Spellaho - Les jetons deviennent des cartes
// ---------------------------------------------------------------------
// Quatre creatures sont fabriquees en cours de partie sans exister nulle
// part au catalogue : impossible de les voir dans la Collection, et
// surtout impossible de les IMPRIMER. Sur une table, il faut pourtant
// bien poser quelque chose quand Largage d Ulgod sort deux squelettes.
//
// Elles vivent dans data/tokens.json, a part :
//   - leur numerotation est la leur (J1/4 a J4/4), donc les 204 cartes
//     du set gardent les numeros deja imprimes ;
//   - le constructeur de decks ne les voit pas, puisqu il ne recoit que
//     { cards, spells, lands }. Aucun deck ne peut donc en contenir.
//
// Les valeurs sont celles que game.js appliquait deja, a une exception :
// le Familier aile appartenait a une famille « Aube » qui n existe pas
// dans elements.json. Il rejoint le Blanc, celui de Marinehote qui
// l invoque.
//
//   node .\tools\creer-jetons.mjs
// =====================================================================
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chemin = (nom) => path.join(RACINE, "data", nom);

async function mesurer(relatif) {
  try {
    const octets = await readFile(path.join(RACINE, relatif));
    if (octets[0] === 0x89 && octets[1] === 0x50) {
      return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20) };
    }
    let curseur = 2;
    while (curseur + 9 < octets.length) {
      if (octets[curseur] !== 0xff) {
        curseur += 1;
        continue;
      }
      const marqueur = octets[curseur + 1];
      if (marqueur >= 0xc0 && marqueur <= 0xcf && marqueur !== 0xc4 && marqueur !== 0xc8 && marqueur !== 0xcc) {
        return { hauteur: octets.readUInt16BE(curseur + 5), largeur: octets.readUInt16BE(curseur + 7) };
      }
      curseur += 2 + octets.readUInt16BE(curseur + 2);
    }
  } catch {
    /* illustration absente : le gabarit centrera, comme avant. */
  }
  return null;
}

const definitions = [
  {
    id: "squelette-ulgod",
    name: "Squelette d'Ulgod",
    subtitle: "Renfort tombé des enfers",
    family: "Rouge",
    type: "Jeton - Squelette",
    attack: 1,
    life: 1,
    keywords: ["Horde", "Jeton"],
    abilityName: "Légion larguée",
    abilityText: "Créé par Largage d'Ulgod. Deux squelettes tombent d'un coup.",
    flavor: "Ulgod ne compte pas ses morts. Il les relance.",
    image: "Images/Squelette.png",
    palette: { primary: "#b34120", secondary: "#ffb45a", deep: "#2b0d08" }
  },
  {
    id: "familier-aile",
    name: "Familier ailé",
    subtitle: "Invocation loyale",
    family: "Blanc",
    type: "Jeton - Familier",
    attack: 1,
    life: 1,
    keywords: ["Vol", "Jeton"],
    abilityName: "Ailes gardiennes",
    abilityText: "Créé par Marinéhote de Elturel. Vol : seules les créatures avec vol ou portée l'arrêtent.",
    flavor: "Il ne quitte jamais l'épaule qui l'a appelé.",
    image: "Images/Familliers.png",
    palette: { primary: "#c78135", secondary: "#f3d183", deep: "#2a160d" }
  },
  {
    id: "zombie-ressuscite",
    name: "Zombie ressuscité",
    subtitle: "Serviteur de tombe",
    family: "Noir",
    type: "Jeton - Zombie",
    attack: 1,
    life: 1,
    keywords: ["Horde", "Jeton"],
    abilityName: "Chair relevée",
    abilityText: "Créé par Morts vivants. Il se relève sans qu'on lui demande rien.",
    flavor: "La tombe s'est ouverte de l'intérieur.",
    image: "Images/Morts vivants.PNG",
    palette: { primary: "#566048", secondary: "#a4b37c", deep: "#151a12" }
  },
  {
    id: "gardien-nature",
    name: "Gardien de la nature",
    subtitle: "Renfort appelé",
    family: "Vert",
    type: "Jeton - Gardien",
    attack: 2,
    life: 2,
    keywords: ["Portée", "Jeton"],
    abilityName: "Garde vivante",
    abilityText: "Créé par le Sceptre de Rena. Portée : il intercepte aussi les créatures avec le vol.",
    flavor: "La forêt ne délègue qu'à ceux qui savent attendre.",
    image: "Images/Protécteurs de la nature.PNG",
    palette: { primary: "#3f8a45", secondary: "#a9d778", deep: "#112513" }
  }
];

const jetons = [];
for (const [index, brut] of definitions.entries()) {
  const dimensions = await mesurer(brut.image);
  jetons.push({
    ...brut,
    kind: "creature",
    // Un jeton n'est jamais paye : il arrive par une autre carte.
    cost: 0,
    manaCost: { generic: 0 },
    token: true,
    art: { fit: "cover", position: "50% 45%", ...(dimensions ? { dimensions } : {}) },
    numero: `J${index + 1}/${definitions.length}`
  });
}

// Aucun jeton ne doit porter le nom ou l identifiant d une carte du set.
const set = [
  ...JSON.parse(await readFile(chemin("cards.json"), "utf8")),
  ...JSON.parse(await readFile(chemin("spells.json"), "utf8")),
  ...JSON.parse(await readFile(chemin("lands.json"), "utf8"))
];
for (const jeton of jetons) {
  const collision = set.find((carte) => carte.id === jeton.id || carte.name === jeton.name);
  if (collision) throw new Error(`${jeton.name} entre en conflit avec ${collision.id} du set.`);
}

await writeFile(chemin("tokens.json"), `${JSON.stringify(jetons, null, 2)}\n`, "utf8");
for (const jeton of jetons) {
  console.log(`  ${jeton.numero}  ${jeton.name.padEnd(22)} ${jeton.attack}/${jeton.life}  ${jeton.image}`);
}
