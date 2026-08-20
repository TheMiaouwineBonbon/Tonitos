// =====================================================================
// Spellaho - Lot « resilience » (19 cartes)
// ---------------------------------------------------------------------
// Toutes les creatures et tous les sorts coutent 1 ou 2, sauf Flamme
// Purificatrice qui coute 3 : c est elle qui donne Defenseur et regenere.
//
// Trois effets sont nouveaux et implementes dans game.js :
//   healMostWounded  soigne completement ta creature la plus blessee
//   evilRegeneration soigne tout ton camp, ton commandant perd 1 PV
//   purifyingFlame   donne Defenseur a ta creature la plus blessee et la
//                    regenere entierement
// Les quatre autres sorts reutilisent des effets deja en place.
//
// Le Noir n avait AUCUNE creature Defenseur : Mort Vivant au Bouclier
// comble ce trou, Defenseur des mers fait de meme pour le Bleu a bas cout.
// Les cinq terrains monocolores elargissent la base de mana de chaque
// couleur, la ou le constructeur de decks manquait de choix.
//
// Rejouable : une carte deja presente est mise a jour, jamais dupliquee.
//   node .\tools\ajouter-cartes-2026-08c.mjs
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

const PALETTE = {
  Blanc: { primary: "#c78135", secondary: "#f3d183", deep: "#2a160d" },
  Bleu: { primary: "#176b8c", secondary: "#67d3ff", deep: "#081d2a" },
  Noir: { primary: "#7f1524", secondary: "#d54454", deep: "#12080d" },
  Rouge: { primary: "#b34120", secondary: "#ffb45a", deep: "#2b0d08" },
  Vert: { primary: "#3f8a45", secondary: "#a9d778", deep: "#112513" }
};

const creatures = [
  {
    id: "defenseur-des-mers",
    name: "Défenseur des mers",
    subtitle: "Le dernier rempart du port",
    family: "Bleu",
    type: "Créature - Guerrier dragon",
    cost: 2,
    attack: 1,
    life: 4,
    keywords: ["Défenseur", "Garde"],
    abilityName: "Mur d'écailles",
    abilityText:
      "Défenseur : l'adversaire doit l'abattre avant de frapper quoi que ce soit d'autre. Il ne part jamais à l'attaque.",
    flavor: "La cité est tombée. Lui, non.",
    image: "Images/Défenseur des mers.png",
    palette: PALETTE.Bleu
  },
  {
    id: "mort-vivant-bouclier",
    name: "Mort Vivant au Bouclier",
    subtitle: "Garde qui a oublié de mourir",
    family: "Noir",
    type: "Créature - Zombie",
    cost: 2,
    attack: 1,
    life: 4,
    keywords: ["Défenseur", "Horde"],
    abilityName: "Garde obstinée",
    abilityText:
      "Défenseur : l'adversaire doit l'abattre avant de frapper quoi que ce soit d'autre. Il ne part jamais à l'attaque.",
    flavor: "On lui a donné un ordre il y a cent ans. Il le tient encore.",
    image: "Images/Mort Vivant au Bouclier.png",
    palette: PALETTE.Noir
  },
  {
    id: "parasite-renard",
    name: "Parasite Renard",
    subtitle: "La colonie apprend à courir",
    family: "Vert",
    type: "Créature - Parasite",
    cost: 2,
    attack: 2,
    life: 2,
    keywords: ["Parasite", "Célérité"],
    abilityName: "Course contaminée",
    abilityText: "Célérité : il attaque dès son arrivée, sans attendre un tour.",
    flavor: "Il garde la vitesse du renard. Le reste appartient à la ruche.",
    image: "Images/Parasite Renard.png",
    palette: PALETTE.Vert
  },
  {
    id: "petit-chevalier-aligator",
    name: "Petit Chevalier Aligator",
    subtitle: "Une épée deux fois trop lourde",
    family: "Blanc",
    type: "Créature - Chevalier",
    cost: 2,
    attack: 3,
    life: 1,
    keywords: ["Vaillance"],
    abilityName: "Trop grande lame",
    abilityText: "Il frappe fort et encaisse mal : une seule blessure suffit à l'arrêter.",
    flavor: "Personne n'a osé lui dire qu'elle était trop grande.",
    image: "Images/Petit Chevalier Aligator.png",
    palette: PALETTE.Blanc
  },
  {
    id: "petit-elementaire-obscur",
    name: "Petit élémentaire obscur",
    subtitle: "Une ombre qui a pris forme",
    family: "Noir",
    type: "Créature - Élémentaire",
    cost: 1,
    attack: 1,
    life: 2,
    keywords: ["Esprit"],
    abilityName: "Éclat d'ombre",
    abilityText: "Petite créature d'ombre : elle occupe le terrain dès le premier tour.",
    flavor: "Le noir se replie parfois sur lui-même, et il en reste ça.",
    image: "Images/Petit élémentaire obscur.png",
    palette: PALETTE.Noir
  },
  {
    id: "petit-elementaire-blanc",
    name: "Petit élémentaire blanc",
    subtitle: "Une lueur qui a pris forme",
    family: "Blanc",
    type: "Créature - Élémentaire",
    cost: 1,
    attack: 1,
    life: 2,
    keywords: ["Divin"],
    abilityName: "Éclat de lumière",
    abilityText: "Petite créature de lumière : elle occupe le terrain dès le premier tour.",
    flavor: "Il ne réchauffe pas. Il rassure, et c'est déjà beaucoup.",
    image: "Images/Petit élémentaire blanc.png",
    palette: PALETTE.Blanc
  },
  {
    id: "petit-chat-flammes",
    name: "Petit chat des flammes",
    subtitle: "Braise sur quatre pattes",
    family: "Rouge",
    type: "Créature - Élémentaire",
    cost: 1,
    attack: 2,
    life: 1,
    keywords: ["Célérité", "Feu"],
    abilityName: "Bond ardent",
    abilityText: "Célérité : il attaque dès son arrivée, sans attendre un tour.",
    flavor: "Il dort près du feu. Il est le feu.",
    image: "Images/Petit chat des flammes.png",
    palette: PALETTE.Rouge
  }
];

const sorts = [
  {
    id: "intervention-aldia",
    name: "Intervention d'Aldia",
    subtitle: "La main qui descend du ciel",
    family: "Blanc",
    type: "Rituel - Sort de jugement",
    cost: 2,
    effect: "weakenAllEnemies",
    slot: "defense",
    keywords: ["Divin", "Zone"],
    abilityName: "Verdict d'en haut",
    abilityText: "Chaque créature adverse perd 1 point de force, définitivement.",
    flavor: "Elle n'a pas frappé. Elle a seulement montré la ville du doigt.",
    image: "Images/Intervention d'Aldia.png",
    palette: PALETTE.Blanc
  },
  {
    id: "seconde-chance",
    deckCopies: 1,
    name: "Seconde Chance",
    subtitle: "Relevé au bord de la fin",
    family: "Blanc",
    type: "Rituel - Sort de résurrection",
    cost: 2,
    effect: "reanimateRandom",
    slot: "upgrade",
    keywords: ["Réanimation", "Grâce"],
    abilityName: "Souffle rendu",
    abilityText:
      "Une créature tirée au hasard dans ton cimetière revient en jeu. Tu ne choisis pas laquelle.",
    flavor: "La lumière ne demande pas si tu la mérites.",
    image: "Images/Seconde Chance.png",
    palette: PALETTE.Blanc
  },
  {
    id: "bulle-revigorante",
    name: "Bulle Revigorante",
    subtitle: "Un répit suspendu",
    family: "Bleu",
    type: "Rituel - Sort de soin",
    cost: 2,
    effect: "healMostWounded",
    slot: "defense",
    keywords: ["Soin", "Vague"],
    abilityName: "Cocon des profondeurs",
    abilityText: "Rends toutes ses blessures à ta créature la plus amochée : elle repart intacte.",
    flavor: "Le temps s'arrête à l'intérieur. Dehors, la bataille continue.",
    image: "Images/Bulle Revigorante.png",
    palette: PALETTE.Bleu
  },
  {
    id: "jamais-abandonner",
    name: "Jamais abandonner",
    subtitle: "Se relever sous la pluie",
    family: "Bleu",
    type: "Rituel - Sort de résurrection",
    cost: 2,
    effect: "reanimateRandom",
    slot: "upgrade",
    keywords: ["Réanimation", "Vague"],
    abilityName: "Deuxième souffle",
    abilityText:
      "Une créature tirée au hasard dans ton cimetière revient en jeu. Tu ne choisis pas laquelle.",
    flavor: "Il reste toujours un genou pour se relever.",
    image: "Images/Jamais abandonner.png",
    palette: PALETTE.Bleu
  },
  {
    id: "regeneration-du-mal",
    name: "Régénération du mal",
    subtitle: "Le prix de tenir debout",
    family: "Noir",
    type: "Rituel - Sort de pacte",
    cost: 2,
    effect: "evilRegeneration",
    slot: "defense",
    keywords: ["Soin", "Pacte"],
    abilityName: "Chair recousue",
    abilityText:
      "Referme toutes les blessures de tes créatures, puis prélève 1 point de vie à ton commandant.",
    flavor: "Rien ne se répare. Tout se déplace.",
    image: "Images/Régénération du mal.png",
    palette: PALETTE.Noir
  },
  {
    id: "flamme-purificatrice",
    name: "Flamme Purificatrice",
    subtitle: "Brûler pour tenir la ligne",
    family: "Rouge",
    type: "Rituel - Sort de purification",
    cost: 3,
    effect: "purifyingFlame",
    slot: "upgrade",
    deckCopies: 1,
    keywords: ["Feu", "Garde"],
    abilityName: "Braise protectrice",
    abilityText:
      "Régénère entièrement ta créature la plus blessée et lui donne Défenseur : l'adversaire devra l'abattre en premier.",
    flavor: "Le feu ne l'a pas consumé. Il l'a recuit.",
    image: "Images/Flamme Purificatrice.png",
    palette: PALETTE.Rouge
  },
  {
    id: "bain-de-soleil",
    name: "Bain de soleil",
    subtitle: "Une sieste qui répare tout",
    family: "Vert",
    type: "Rituel - Sort de croissance",
    cost: 2,
    effect: "toughTeam",
    slot: "defense",
    keywords: ["Croissance", "Nature"],
    abilityName: "Sève rechargée",
    abilityText: "Donne 2 points de vie à chacune de tes créatures, définitivement.",
    flavor: "Elle n'a rien fait de la journée. C'était le plan.",
    image: "Images/Bain de soleil.png",
    palette: PALETTE.Vert
  }
];

const terrains = [
  {
    id: "conseil-des-heros",
    kind: "land",
    name: "Conseil des Héros",
    subtitle: "La table où l'on décide",
    family: "Blanc",
    type: "Terrain - Salle du conseil",
    manaProduction: { mode: "choice", colors: ["Blanc"], amount: 1 },
    cost: 0,
    keywords: ["Terrain", "Mana blanc"],
    abilityName: "Source blanche",
    abilityText: "Joue un seul terrain par tour. Ce terrain produit 1 mana blanc.",
    flavor: "Sept sièges, sept avis, une seule guerre.",
    image: "Images/Terrain blanc - Conseil des Héros.png",
    palette: PALETTE.Blanc
  },
  {
    id: "trone-des-mers",
    kind: "land",
    name: "Trône des Mers",
    subtitle: "Le siège que nul n'occupe",
    family: "Bleu",
    type: "Terrain - Trône",
    manaProduction: { mode: "choice", colors: ["Bleu"], amount: 1 },
    cost: 0,
    keywords: ["Terrain", "Mana bleu"],
    abilityName: "Source bleue",
    abilityText: "Joue un seul terrain par tour. Ce terrain produit 1 mana bleu.",
    flavor: "La marée s'y assied deux fois par jour.",
    image: "Images/Terrain bleu - Trône des Mers.png",
    palette: PALETTE.Bleu
  },
  {
    id: "grotte-du-mal",
    kind: "land",
    name: "Grotte du mal",
    subtitle: "Ce qui respire au fond",
    family: "Noir",
    type: "Terrain - Grotte",
    manaProduction: { mode: "choice", colors: ["Noir"], amount: 1 },
    cost: 0,
    keywords: ["Terrain", "Mana noir"],
    abilityName: "Source noire",
    abilityText: "Joue un seul terrain par tour. Ce terrain produit 1 mana noir.",
    flavor: "On y entre en criant. On en sort en silence.",
    image: "Images/Terrain noir - Grotte du mal.png",
    palette: PALETTE.Noir
  },
  {
    id: "lac-ulgod",
    kind: "land",
    name: "Lac d'Ulgod",
    subtitle: "Une eau qui ne refroidit pas",
    family: "Rouge",
    type: "Terrain - Lac",
    manaProduction: { mode: "choice", colors: ["Rouge"], amount: 1 },
    cost: 0,
    keywords: ["Terrain", "Mana rouge"],
    abilityName: "Source rouge",
    abilityText: "Joue un seul terrain par tour. Ce terrain produit 1 mana rouge.",
    flavor: "Ulgod s'y mire. Le lac bout depuis.",
    image: "Images/Terrain rouge - Lac d'Ulgod.png",
    palette: PALETTE.Rouge
  },
  {
    id: "montagnes-merveilleuses",
    kind: "land",
    name: "Montagnes Merveilleuses",
    subtitle: "Les sommets que rien n'atteint",
    family: "Vert",
    type: "Terrain - Montagne",
    manaProduction: { mode: "choice", colors: ["Vert"], amount: 1 },
    cost: 0,
    keywords: ["Terrain", "Mana vert"],
    abilityName: "Source verte",
    abilityText: "Joue un seul terrain par tour. Ce terrain produit 1 mana vert.",
    flavor: "Rena y a posé le pied une fois. L'herbe s'en souvient.",
    image: "Images/Terrain vert - Montagnes Merveilleuses.png",
    palette: PALETTE.Vert
  }
];

// Fusion par identifiant : une carte deja presente est mise a jour, jamais
// dupliquee, et son numero de collection est conserve.
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
