// =====================================================================
// Spellaho - Ajout du lot de cartes d aout 2026 (22 cartes)
// ---------------------------------------------------------------------
// Creatures a cout 1-2 pensees pour completer les combos existants :
// « Parasite » (renforce par le Hero de Rena, ruche) et « Robot antique »
// (compte dans le reseau des robots via le mot-cle). Sorts a cout 2 sur
// des effets deja pris en charge par le moteur. 11 terrains dont deux
// bicolores et trois grandes sources.
//
// Rejouable : ne fait rien si les cartes sont deja presentes.
//   node .\tools\ajouter-cartes-2026-08.mjs
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

const pal = (liste, id) => liste.find((x) => x.id === id).palette;
const PAL = {
  Blanc: pal(cards, "marinehote"),
  Vert: pal(cards, "fee"),
  Noir: pal(cards, "magiciens-exiles"),
  Bleu: pal(cards, "roi-des-mers"),
  Rouge: pal(cards, "amrin"),
  Incolore: pal(cards, "robot-saccageur"),
  BlancVert: pal(lands, "royaume-paisible"),
  RougeNoir: pal(lands, "empire-bhaal")
};

const creatures = [
  {
    id: "parasite-larve", name: "Parasite Larve", subtitle: "Première mue de la ruche",
    family: "Vert", type: "Créature - Parasite", cost: 1, attack: 1, life: 1,
    keywords: ["Parasite"], abilityName: "Sang de la colonie",
    abilityText: "Parasite : la ruche la compte parmi les siens, et le Héro de Rena renforce chacun d'eux.",
    flavor: "Petite, affamée, déjà fidèle.", image: "Images/Parasite Larve.png", palette: PAL.Vert
  },
  {
    id: "robot-antique-drone", name: "Robot antique drone", subtitle: "Éclaireur du réseau oublié",
    family: "Incolore", type: "Créature - Robot antique", cost: 1, attack: 1, life: 1,
    keywords: ["Robot antique"], abilityName: "Signal du réseau",
    abilityText: "Robot antique : les autres Robots antiques le reconnaissent et l'ajoutent à leurs calculs.",
    flavor: "Il ne dort jamais ; il attend.", image: "Images/Robot antique drone.png", palette: PAL.Incolore
  },
  {
    id: "archer-squelette", name: "Archer Squelette", subtitle: "Sentinelle des ossuaires",
    family: "Noir", type: "Créature - Squelette", cost: 2, attack: 2, life: 1,
    keywords: ["Portée"], abilityName: "Volée d'outre-tombe",
    abilityText: "Ses flèches sifflent par-dessus la mêlée, comme au premier jour de sa mort.",
    flavor: "Son carquois ne se vide plus depuis des siècles.", image: "Images/Archer Squelette.png", palette: PAL.Noir
  },
  {
    id: "guerrier-squelette", name: "Guerrier Squelette", subtitle: "Piquier sans serment",
    family: "Noir", type: "Créature - Squelette", cost: 1, attack: 1, life: 2,
    keywords: [], abilityName: "Os et discipline",
    abilityText: "Il tient la ligne sans peur, sans faim et sans solde.",
    flavor: "La mort n'a pas interrompu son service.", image: "Images/Guerrier Squelette.png", palette: PAL.Noir
  },
  {
    id: "guerrier-lapin", name: "Guerrier Lapin", subtitle: "Éclaireur des terriers",
    family: "Vert", type: "Créature - Bête", cost: 1, attack: 1, life: 1,
    keywords: ["Célérité"], abilityName: "Bond de bataille",
    abilityText: "Célérité : il peut attaquer dès le tour où il arrive.",
    flavor: "Le premier au combat, le premier au dîner.", image: "Images/Guerrier Lapin.png", palette: PAL.Vert
  },
  {
    id: "petit-elementaire-eau", name: "Petit élémentaire d'eau", subtitle: "Goutte du grand courant",
    family: "Bleu", type: "Créature - Élémentaire", cost: 1, attack: 1, life: 2,
    keywords: [], abilityName: "Ressac",
    abilityText: "Chaque vague qui le traverse le reforme aussitôt.",
    flavor: "Umi compte chacune de ses gouttes.", image: "Images/Petit élémentaire d'eau.png", palette: PAL.Bleu
  },
  {
    id: "petit-elementaire-feu", name: "Petit élémentaire de Feu", subtitle: "Étincelle des forges",
    family: "Rouge", type: "Créature - Élémentaire", cost: 1, attack: 2, life: 1,
    keywords: [], abilityName: "Crépitement",
    abilityText: "Il brûle vite, fort, et sans le moindre regret.",
    flavor: "Née d'une forge, morte cent fois, jamais éteinte.", image: "Images/Petit élémentaire de Feu.png", palette: PAL.Rouge
  }
];

const sorts = [
  {
    id: "eclair-divin", name: "Éclair divin", subtitle: "Jugement tombé du ciel",
    family: "Blanc", type: "Rituel - Sort de lumière", cost: 2, effect: "freezeStrongest", slot: "defense",
    abilityName: "Foudre du jugement",
    abilityText: "Engage la créature adverse la plus puissante : elle ne se dégagera pas au prochain tour.",
    flavor: "Le ciel a rendu son verdict avant les hommes.", image: "Images/Éclair divin.png", palette: PAL.Blanc
  },
  {
    id: "tornade-umi", name: "Tornade d'UMI", subtitle: "Colonne des mers levées",
    family: "Bleu", type: "Rituel - Sort de contrôle", cost: 2, effect: "weakenAllEnemies", slot: "defense",
    abilityName: "Vents dispersants",
    abilityText: "Toutes les créatures adverses perdent 1 point de force.",
    flavor: "On ne combat pas au centre d'une tornade.", image: "Images/Tornade d'UMI.png", palette: PAL.Bleu
  },
  {
    id: "piege-obscur", name: "Piège Obscur", subtitle: "Morsure préparée dans l'ombre",
    family: "Noir", type: "Rituel - Sort de drain", cost: 2, effect: "drainHero2", slot: "offense",
    abilityName: "Mâchoires du néant",
    abilityText: "Inflige 2 blessures au héros adverse et te rend 2 points de vie.",
    flavor: "Le piège était tendu depuis ta naissance.", image: "Images/Piège Obscur.png", palette: PAL.Noir
  },
  {
    id: "explosion-celeste", name: "Explosion céleste", subtitle: "Chute d'un fragment d'étoile",
    family: "Rouge", type: "Rituel - Sort de dégâts", cost: 2, effect: "damageHero2", slot: "offense",
    abilityName: "Impact stellaire",
    abilityText: "Inflige 2 blessures au héros adverse.",
    flavor: "Le ciel aussi sait perdre patience.", image: "Images/Explosion céleste.png", palette: PAL.Rouge
  }
];

const prodMono = (couleur) => ({ mode: "choice", colors: [couleur], amount: 1 });
const prodDouble = (couleur) => ({ mode: "choice", colors: [couleur], amount: 2 });

const terrains = [
  {
    id: "sanctuaire-merveilleux", name: "Sanctuaire Merveilleux", subtitle: "Refuge des lumières douces",
    family: "Blanc", type: "Terrain - Sanctuaire", manaProduction: prodMono("Blanc"), cost: 0,
    keywords: ["Terrain", "Mana blanc"], abilityName: "Source blanche",
    abilityText: "Joue un seul terrain par tour. Ce terrain produit 1 mana blanc.",
    flavor: "On y entre armé, on en ressort apaisé.",
    image: "Images/Terrain blanc - Sanctuaire Merveilleux.png", palette: PAL.Blanc
  },
  {
    id: "temple-anormal", name: "Temple anormal", subtitle: "Géométrie qui n'obéit plus",
    family: "Blanc", type: "Terrain - Temple", manaProduction: prodDouble("Blanc"), cost: 0,
    entersTapped: true, keywords: ["Terrain", "Grande source", "Mana blanc"], abilityName: "Grande source",
    abilityText: "Arrive engagé : il ne produit qu'au tour suivant. Il rend alors 2 mana blanc.",
    flavor: "Ses murs prient plus fort que ses fidèles.",
    image: "Images/Terrain blanc - Temple anormal.png", palette: PAL.Blanc
  },
  {
    id: "ile-marees", name: "Île des marées", subtitle: "Terre qui respire avec la mer",
    family: "Bleu", type: "Terrain - Île", manaProduction: prodMono("Bleu"), cost: 0,
    keywords: ["Terrain", "Mana bleu"], abilityName: "Source bleue",
    abilityText: "Joue un seul terrain par tour. Ce terrain produit 1 mana bleu.",
    flavor: "Deux fois par jour, la mer vient la compter.",
    image: "Images/Terrain bleu - Île des marées.png", palette: PAL.Bleu
  },
  {
    id: "port-gronnak", name: "Port de Gronnak", subtitle: "Quais de la capitale immergée",
    family: "Bleu", type: "Terrain - Port", manaProduction: prodMono("Bleu"), cost: 0,
    keywords: ["Terrain", "Mana bleu"], abilityName: "Source bleue",
    abilityText: "Joue un seul terrain par tour. Ce terrain produit 1 mana bleu.",
    flavor: "Les navires y accostent par-dessous.",
    image: "Images/Terrain bleu - Port de Gronnak.png", palette: PAL.Bleu
  },
  {
    id: "muraille-nazeroth", name: "Muraille Noire de Nazeroth", subtitle: "Rempart qui regarde ses assiégeants",
    family: "Noir", type: "Terrain - Muraille", manaProduction: prodMono("Noir"), cost: 0,
    keywords: ["Terrain", "Mana noir"], abilityName: "Source noire",
    abilityText: "Joue un seul terrain par tour. Ce terrain produit 1 mana noir.",
    flavor: "Nul ne sait si elle protège la ville ou l'enferme.",
    image: "Images/Terrain Noir - Muraille Noire de Nazeroth.png", palette: PAL.Noir
  },
  {
    id: "portail-autre-monde", name: "Portail vers l'autre monde", subtitle: "Seuil qui ne se referme plus",
    family: "Noir", type: "Terrain - Portail", manaProduction: prodDouble("Noir"), cost: 0,
    entersTapped: true, keywords: ["Terrain", "Grande source", "Mana noir"], abilityName: "Grande source",
    abilityText: "Arrive engagé : il ne produit qu'au tour suivant. Il rend alors 2 mana noir.",
    flavor: "Ce qui en sort n'est jamais ce qui y est entré.",
    image: "Images/Terrain Noir - Portail vers l'autre monde.png", palette: PAL.Noir
  },
  {
    id: "avant-poste-desertique", name: "Avant-poste désertique", subtitle: "Garnison des sables brûlants",
    family: "Rouge", type: "Terrain - Avant-poste", manaProduction: prodMono("Rouge"), cost: 0,
    keywords: ["Terrain", "Mana rouge"], abilityName: "Source rouge",
    abilityText: "Joue un seul terrain par tour. Ce terrain produit 1 mana rouge.",
    flavor: "Le désert attaque plus souvent que l'ennemi.",
    image: "Images/Terrain rouge - Avant-poste désertique.png", palette: PAL.Rouge
  },
  {
    id: "premier-arbre", name: "Premier arbre", subtitle: "Racine de toutes les forêts",
    family: "Vert", type: "Terrain - Arbre", manaProduction: prodMono("Vert"), cost: 0,
    keywords: ["Terrain", "Mana vert"], abilityName: "Source verte",
    abilityText: "Joue un seul terrain par tour. Ce terrain produit 1 mana vert.",
    flavor: "Les druides jurent qu'il se souvient de la première aube.",
    image: "Images/Terrain vert - Premier arbre.png", palette: PAL.Vert
  },
  {
    id: "jardin-sureleve", name: "Jardin surélevé", subtitle: "Terrasses au-dessus des nuages",
    family: "Vert", type: "Terrain - Jardin", manaProduction: prodDouble("Vert"), cost: 0,
    entersTapped: true, keywords: ["Terrain", "Grande source", "Mana vert"], abilityName: "Grande source",
    abilityText: "Arrive engagé : il ne produit qu'au tour suivant. Il rend alors 2 mana vert.",
    flavor: "Chaque étage nourrit celui du dessous.",
    image: "Images/Terrain vert - Jardin surélevé.png", palette: PAL.Vert
  },
  {
    id: "champ-deux-couronnes", name: "Champ des deux couronnes", subtitle: "Frontière labourée en commun",
    family: "Blanc", type: "Terrain - Champ",
    manaProduction: { mode: "choice", colors: ["Blanc", "Vert"], amount: 1 }, cost: 0,
    entersTapped: true, keywords: ["Terrain", "Double source"], abilityName: "Frontière commune",
    abilityText: "Arrive engagé : il ne produit qu'au tour suivant. Il rend alors 1 mana blanc ou vert, au choix.",
    flavor: "Deux royaumes, une seule moisson.",
    image: "Images/Terrain Blanc-Vert - Champ des deux couronnes.png", palette: PAL.BlancVert
  },
  {
    id: "forge-du-mal", name: "Forge du mal", subtitle: "Enclume des armes interdites",
    family: "Rouge", type: "Terrain - Forge",
    manaProduction: { mode: "choice", colors: ["Rouge", "Noir"], amount: 1 }, cost: 0,
    entersTapped: true, keywords: ["Terrain", "Double source"], abilityName: "Frontière commune",
    abilityText: "Arrive engagé : il ne produit qu'au tour suivant. Il rend alors 1 mana rouge ou noir, au choix.",
    flavor: "On n'y forge rien qui serve à labourer.",
    image: "Images/Terrain Rouge-Noir - Forge du mal.png", palette: PAL.RougeNoir
  }
];

for (const terrain of terrains) terrain.kind = "land";

const tousIds = new Set([...cards, ...spells, ...lands].map((x) => x.id));
const tousNoms = new Set([...cards, ...spells, ...lands].map((x) => x.name));
const nouvellesCreatures = creatures.filter((c) => !tousIds.has(c.id));
const nouveauxSorts = sorts.filter((c) => !tousIds.has(c.id));
const nouveauxTerrains = terrains.filter((c) => !tousIds.has(c.id));
for (const carte of [...nouvellesCreatures, ...nouveauxSorts, ...nouveauxTerrains]) {
  if (tousNoms.has(carte.name)) throw new Error(`nom en double : ${carte.name}`);
}

await writeFile(chemin("cards.json"), JSON.stringify([...cards, ...nouvellesCreatures], null, 2) + "\n");
await writeFile(chemin("spells.json"), JSON.stringify([...spells, ...nouveauxSorts], null, 2) + "\n");
await writeFile(chemin("lands.json"), JSON.stringify([...lands, ...nouveauxTerrains], null, 2) + "\n");
console.log(`ajouté : ${nouvellesCreatures.length} créatures, ${nouveauxSorts.length} sorts, ${nouveauxTerrains.length} terrains`);
