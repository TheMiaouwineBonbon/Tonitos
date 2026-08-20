// =====================================================================
// Spellaho - Lot d equilibrage (10 cartes)
// ---------------------------------------------------------------------
// Chaque carte repond a un manque mesure sur le pool existant :
//
//  - Foret Oceanique, Volcan marin et Cathedrale de l unite : les trois
//    paires qui n avaient AUCUN terrain bicolore dedie recoivent enfin le
//    leur, respectivement Bleu/Vert, Rouge/Bleu et Blanc/Noir. Les six
//    paires du jeu sont desormais couvertes.
//  - Temple englouti : deuxieme bicolore Blanc/Bleu pour « Concile des
//    Marees », qui n en avait qu un contre trois au Pacte des Cendres.
//  - Chute : le Blanc n avait aucun retrait definitif, seulement du gel.
//  - Portail antique : double la densite de l archetype Robot antique,
//    qui ne disposait que du Generateur antique pour produire ses drones.
//  - Pierre de la cupidite : pioche INCOLORE, donc accessible aux six
//    paires. Le Rouge n avait aucun sort de pioche.
//  - Don des dieux : premier renfort d equipe incolore.
//  - Ninja des toits : creature noire a cout 3.
//  - Horreur des fosses : PREMIERE creature multicolore du jeu.
//
// Les effets employes sont deja implementes par le moteur : aucune regle
// nouvelle a coder. Le script est rejouable sans effet s il a deja tourne.
//   node .\tools\ajouter-cartes-2026-08b.mjs
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

// Les palettes restent celles de la famille, comme partout ailleurs.
const PALETTE = {
  Blanc: { primary: "#c78135", secondary: "#f3d183", deep: "#2a160d" },
  Bleu: { primary: "#176b8c", secondary: "#67d3ff", deep: "#081d2a" },
  Noir: { primary: "#7f1524", secondary: "#d54454", deep: "#12080d" },
  Rouge: { primary: "#b34120", secondary: "#ffb45a", deep: "#2b0d08" },
  Incolore: { primary: "#6c7683", secondary: "#c3d0dc", deep: "#141a20" },
  RougeNoir: { primary: "#b34120", secondary: "#d54454", deep: "#180809" }
};

const creatures = [
  {
    id: "ninja-toits",
    name: "Ninja des toits",
    subtitle: "Ombre au-dessus de la cité",
    family: "Noir",
    type: "Créature - Ninja",
    cost: 3,
    attack: 2,
    life: 2,
    keywords: ["Célérité", "Contact mortel"],
    abilityName: "Lame silencieuse",
    abilityText:
      "Célérité : il attaque dès son arrivée. Contact mortel : toute créature qu'il blesse est détruite.",
    flavor: "On ne le voit qu'une fois. Rarement deux.",
    image: "Images/Ninja des toits.png",
    palette: PALETTE.Noir
  },
  {
    id: "horreur-fosses",
    name: "Horreur des fosses",
    subtitle: "Ce qui dort sous les arènes",
    family: "Multicolore",
    colors: ["Rouge", "Noir"],
    type: "Créature légendaire - Horreur",
    cost: 6,
    manaCost: { Noir: 1, Rouge: 1, generic: 4 },
    attack: 7,
    life: 6,
    deckCopies: 1,
    keywords: ["Imposant", "Contact mortel"],
    abilityName: "Étreinte des profondeurs",
    abilityText:
      "Contact mortel : toute créature blessée par cette horreur est détruite, quelle que soit sa taille.",
    flavor: "Les armes plantées autour d'elle ont toutes eu un porteur.",
    image: "Images/Horreur des fosses.png",
    palette: PALETTE.RougeNoir
  }
];

const sorts = [
  {
    id: "chute",
    name: "Chute",
    subtitle: "Le vide sous les pas",
    family: "Blanc",
    type: "Rituel - Sort d'exil",
    cost: 3,
    effect: "destroyTappedOrWeakest",
    slot: "offense",
    keywords: ["Destruction", "Divin"],
    abilityName: "Précipice",
    abilityText:
      "Exile la créature adverse engagée la plus puissante, ou la plus faible si aucune n'est engagée.",
    flavor: "Il n'y eut pas de cri. Seulement l'absence.",
    image: "Images/Chute.png",
    palette: PALETTE.Blanc
  },
  {
    id: "portail-antique",
    name: "Portail antique",
    subtitle: "Seuil des machines endormies",
    family: "Incolore",
    type: "Artefact légendaire - Portail",
    cost: 4,
    deckCopies: 1,
    effect: "createAncientDrones",
    slot: "upgrade",
    keywords: ["Antique", "Robot antique"],
    abilityName: "Appel du réseau",
    abilityText: "Ouvre le passage : deux Drones antiques 1/1 franchissent le portail et te rejoignent.",
    flavor: "La porte ne s'ouvre que pour ceux qui savent encore compter.",
    image: "Images/Portail antique.png",
    palette: PALETTE.Incolore
  },
  {
    id: "pierre-cupidite",
    name: "Pierre de la cupidité",
    subtitle: "Le savoir contre le sang",
    family: "Incolore",
    type: "Artefact légendaire - Relique",
    cost: 4,
    deckCopies: 1,
    effect: "livreClaudia",
    slot: "draw",
    keywords: ["Artefact", "Savoir"],
    abilityName: "Prix du savoir",
    abilityText: "Pioche trois cartes, puis perds 2 points de vie : la pierre réclame toujours sa part.",
    flavor: "Elle donne tout. Elle reprend toujours un peu plus.",
    image: "Images/Pierre de la cupidité.png",
    palette: PALETTE.Incolore
  },
  {
    id: "don-des-dieux",
    name: "Don des dieux",
    subtitle: "L'anneau que tous convoitent",
    family: "Incolore",
    type: "Artefact légendaire - Amélioration",
    cost: 4,
    deckCopies: 1,
    effect: "buffTeamAttack1",
    slot: "upgrade",
    keywords: ["Artefact", "Bénédiction"],
    abilityName: "Faveur partagée",
    abilityText: "Donne 1 point de force à chacune de tes créatures en jeu, définitivement.",
    flavor: "Chaque peuple jure l'avoir forgé. Aucun ne sait le rendre.",
    image: "Images/Don des dieux.png",
    palette: PALETTE.Incolore
  }
];

const terrains = [
  {
    id: "foret-oceanique",
    kind: "land",
    name: "Forêt Océanique",
    subtitle: "Canopée noyée sous les vagues",
    family: "Bleu",
    type: "Terrain - Forêt",
    manaProduction: { mode: "choice", colors: ["Bleu", "Vert"], amount: 1 },
    cost: 0,
    entersTapped: true,
    keywords: ["Terrain", "Double source"],
    abilityName: "Frontière commune",
    abilityText:
      "Arrive engagé : il ne produit qu'au tour suivant. Il rend alors 1 mana bleu ou vert, au choix.",
    flavor: "La marée y monte jusque dans les branches.",
    image: "Images/Terrain Bleu-Vert - Forêt Océanique.png",
    palette: PALETTE.Bleu
  },
  {
    id: "temple-englouti",
    kind: "land",
    name: "Temple englouti",
    subtitle: "Sanctuaire rendu à la mer",
    family: "Blanc",
    type: "Terrain - Temple",
    manaProduction: { mode: "choice", colors: ["Blanc", "Bleu"], amount: 1 },
    cost: 0,
    entersTapped: true,
    keywords: ["Terrain", "Double source"],
    abilityName: "Frontière commune",
    abilityText:
      "Arrive engagé : il ne produit qu'au tour suivant. Il rend alors 1 mana blanc ou bleu, au choix.",
    flavor: "Ses prières continuent, plus lentes, sous l'eau.",
    image: "Images/Terrain Blanc-Bleu - Temple englouti.png",
    palette: PALETTE.Blanc
  },
  {
    id: "volcan-marin",
    kind: "land",
    name: "Volcan marin",
    subtitle: "Braise que la mer n'éteint pas",
    family: "Rouge",
    type: "Terrain - Volcan",
    manaProduction: { mode: "choice", colors: ["Rouge", "Bleu"], amount: 1 },
    cost: 0,
    entersTapped: true,
    keywords: ["Terrain", "Double source"],
    abilityName: "Frontière commune",
    abilityText:
      "Arrive engagé : il ne produit qu'au tour suivant. Il rend alors 1 mana rouge ou bleu, au choix.",
    flavor: "L'océan entier lui tombe dessus. Il brûle encore.",
    image: "Images/Terrain Rouge-Bleu - Volcan marin.png",
    palette: PALETTE.Rouge
  },
  {
    id: "cathedrale-unite",
    kind: "land",
    name: "Cathédrale de l'unité",
    subtitle: "Une nef pour deux dieux",
    family: "Blanc",
    type: "Terrain - Cathédrale",
    manaProduction: { mode: "choice", colors: ["Blanc", "Noir"], amount: 1 },
    cost: 0,
    entersTapped: true,
    keywords: ["Terrain", "Double source"],
    abilityName: "Frontière commune",
    abilityText:
      "Arrive engagé : il ne produit qu'au tour suivant. Il rend alors 1 mana blanc ou noir, au choix.",
    flavor: "La frontière passe au milieu de l'allée. Nul ne la franchit.",
    image: "Images/Terrain Blanc-Noir - Cathédrale de l'unité.png",
    palette: PALETTE.Blanc
  }
];

// Fusion par identifiant : une carte déjà présente est mise à jour, jamais
// dupliquée, et son numéro de collection est conservé. Le script reste donc
// rejouable, y compris après une correction d'équilibrage.
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
for (const carte of [...creatures, ...sorts, ...terrains]) {
  const homonyme = connues.find((autre) => autre.name === carte.name && autre.id !== carte.id);
  if (homonyme) throw new Error(`nom déjà porté par ${homonyme.id} : ${carte.name}`);
}

const fusionCreatures = fusionner(cards, creatures);
const fusionSorts = fusionner(spells, sorts);
const fusionTerrains = fusionner(lands, terrains);

const ecrire = (nom, valeur) => writeFile(chemin(nom), `${JSON.stringify(valeur, null, 2)}\n`, "utf8");
await ecrire("cards.json", fusionCreatures.liste);
await ecrire("spells.json", fusionSorts.liste);
await ecrire("lands.json", fusionTerrains.liste);

console.log(
  `créatures ${cards.length} -> ${fusionCreatures.liste.length} (+${fusionCreatures.inedites}), ` +
    `sorts ${spells.length} -> ${fusionSorts.liste.length} (+${fusionSorts.inedites}), ` +
    `terrains ${lands.length} -> ${fusionTerrains.liste.length} (+${fusionTerrains.inedites})`
);
