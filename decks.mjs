// =====================================================================
// Spellaho - Construction des decks
// ---------------------------------------------------------------------
// Module pur : ni DOM ni etat global. La composition d un deck est une
// fonction deterministe du catalogue de cartes et de la paire de couleurs
// choisie - le tri se fait par cout puis par nom, aucun hasard n intervient.
// Seul l ORDRE de pioche est melange, plus tard, par `game.js`.
//
// Le jeu ET la page d impression appellent ce module : il n existe donc
// qu une seule definition des decks, impossible de les voir diverger.
// =====================================================================
import { landProduces, manaRequirements, normalizedCost } from "./engine-core.mjs";

export const DECK_SIZE = 60;
export const DECK_LANDS = 24;
export const DECK_SPELLS = 14;
export const MAX_NONLAND_COPIES = 4;

export const DECKS = [
  {
    id: "blanc-vert",
    name: "Blanc / Vert - Serment de la Canopée",
    shortName: "Serment de la Canopée",
    colors: ["Blanc", "Vert"],
    theme: "défense, soins et renforts naturels",
    // Liste construite volontairement : contrairement aux decks historiques,
    // Blanc/Vert n'est jamais rempli par l'ordre alphabétique du catalogue.
    deckList: {
      lands: [
        { id: "chateau-bordeciel", copies: 4 },
        { id: "monde-au-dessus", copies: 3 },
        { id: "sanctuaire-merveilleux", copies: 3 },
        { id: "sentier-uldrid", copies: 4 },
        { id: "paradis-uldrid", copies: 3 },
        { id: "temple-antique-naturel", copies: 3 },
        { id: "champ-deux-couronnes", copies: 2 },
        { id: "royaume-paisible", copies: 2 }
      ],
      creatures: [
        { id: "chevalier-froussard", copies: 4 },
        { id: "guerrier-lapin", copies: 2 },
        { id: "robot-antique-drone", copies: 1 },
        { id: "fee", copies: 3 },
        { id: "dyklanne", copies: 1 },
        { id: "protecteurs-nature", copies: 3 },
        { id: "marinehote", copies: 1 },
        { id: "centaure", copies: 1 },
        { id: "ours-hibou", copies: 2 },
        { id: "johanna", copies: 1 },
        { id: "trios-heros", copies: 1 },
        { id: "uldrid", copies: 1 },
        { id: "terreur-rena", copies: 1 }
      ],
      spells: [
        { id: "eclair-divin", copies: 3 },
        { id: "pierre-norne", copies: 3 },
        { id: "chute", copies: 3 },
        { id: "benediction-du-heros", copies: 2 },
        { id: "vengeance-uldrid", copies: 2 },
        { id: "generateur-antique", copies: 1 }
      ]
    }
  },
  {
    id: "rouge-noir",
    name: "Rouge / Noir - Pacte des Cendres",
    shortName: "Pacte des Cendres",
    colors: ["Rouge", "Noir"],
    theme: "dégâts rapides, drain de vie et destruction",
    // Même cahier des charges que le deck Blanc/Vert définitif : 24 terrains,
    // 22 créatures, 14 sorts et une courbe volontairement concentrée à 1-3.
    deckList: {
      lands: [
        { id: "cimetiere", copies: 4 },
        { id: "royaume-noxis", copies: 4 },
        { id: "lac-ulgod", copies: 4 },
        { id: "volcan-rouge", copies: 4 },
        { id: "capitale-madorr", copies: 2 },
        { id: "temple-antique-desert", copies: 2 },
        { id: "empire-bhaal", copies: 2 },
        { id: "forge-du-mal", copies: 2 }
      ],
      creatures: [
        { id: "animal-bhaal", copies: 4 },
        { id: "petit-elementaire-feu", copies: 3 },
        { id: "petit-elementaire-obscur", copies: 3 },
        { id: "gardien-enflamme", copies: 3 },
        { id: "diablotins", copies: 2 },
        { id: "mort-vivant-bouclier", copies: 2 },
        { id: "magiciens-exiles", copies: 1 },
        { id: "comte-thaelion", copies: 1 },
        { id: "diplomate-aethran", copies: 1 },
        { id: "noxis", copies: 1 },
        { id: "bhaal", copies: 1, allowDivine: true }
      ],
      spells: [
        { id: "largage-ulgod", copies: 4 },
        { id: "pacte-maudit", copies: 3 },
        { id: "assassinat", copies: 2 },
        { id: "explosion-celeste", copies: 2 },
        { id: "piege-obscur", copies: 2 },
        { id: "flamme-purificatrice", copies: 1 }
      ]
    },
    // Réserve divine : ces invocations ne font pas partie des 60 cartes.
    extraCards: ["noxis-bhaal-fusion"]
  },
  {
    id: "bleu-vert",
    name: "Bleu / Vert - Marées Sauvages",
    shortName: "Marées Sauvages",
    colors: ["Bleu", "Vert"],
    theme: "pioche, gel et grosses créatures"
  },
  {
    id: "noir-blanc",
    name: "Noir / Blanc - Jugement des Ombres",
    shortName: "Jugement des Ombres",
    colors: ["Noir", "Blanc"],
    theme: "contrôle, lien de vie et troupes tenaces"
  },
  {
    id: "rouge-bleu",
    name: "Rouge / Bleu - Tempête de Braise",
    shortName: "Tempête de Braise",
    colors: ["Rouge", "Bleu"],
    theme: "tempo, dégâts directs et pioche"
  },
  {
    id: "blanc-bleu",
    name: "Blanc / Bleu - Héritage des Anciens",
    shortName: "Héritage des Anciens",
    colors: ["Blanc", "Bleu"],
    theme: "Robots antiques, protection et savoir de Daemon",
    deckList: {
      lands: [
        { id: "chateau-bordeciel", copies: 4 },
        { id: "monde-au-dessus", copies: 4 },
        { id: "temple-antique-aube-polaire", copies: 4 },
        { id: "temple-antique-mers", copies: 4 },
        { id: "ile-marees", copies: 4 },
        { id: "oceania-cite-sous-marine", copies: 4 }
      ],
      creatures: [
        { id: "robot-antique-petit-compagnon", copies: 4 },
        { id: "robot-antique-chien", copies: 4 },
        { id: "robot-antique-argonien", copies: 4 },
        { id: "robot-antique-gardien", copies: 3 },
        { id: "robot-antique-chasseur", copies: 3 },
        { id: "robot-saccageur", copies: 2 },
        { id: "aventurier-mythique-daemon", copies: 1 },
        { id: "robot-antique-creation-divine", copies: 1 }
      ],
      spells: [
        { id: "tir-robot", copies: 4 },
        { id: "bouclier-antique", copies: 4 },
        { id: "generateur-antique", copies: 2 },
        { id: "terrible-decouverte", copies: 2 },
        { id: "bulle-revigorante", copies: 2 }
      ]
    }
  }
];

export function getDeckSpec(id) {
  return DECKS.find((deck) => deck.id === id) || DECKS[0];
}

export function cardFitsDeckColors(card, colors) {
  if (card.family === "Incolore") return true;
  const identity = Array.isArray(card.colors) && card.colors.length > 0 ? card.colors : [card.family];
  return identity.every((family) => colors.includes(family));
}

export function getDeckComposition(deckSpec, catalogue) {
  if (deckSpec.deckList) {
    const total = (section) => section.reduce((sum, entry) => sum + Number(entry.copies || 0), 0);
    return {
      lands: total(deckSpec.deckList.lands),
      creatures: total(deckSpec.deckList.creatures),
      spells: total(deckSpec.deckList.spells)
    };
  }
  const spellPool = catalogue.spells.filter((card) => cardFitsDeckColors(card, deckSpec.colors));
  const spells = Math.min(DECK_SPELLS, spellPool.length * MAX_NONLAND_COPIES);
  return {
    lands: DECK_LANDS,
    creatures: DECK_SIZE - DECK_LANDS - spells,
    spells
  };
}

export function countCopies(cards) {
  const counts = new Map();
  for (const card of cards) {
    counts.set(card.id, (counts.get(card.id) || 0) + 1);
  }
  return counts;
}

function tirer(pool, count, maxCopies, existing, strict) {
  const picks = [];
  const sorted = [...pool].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, "fr"));
  let guard = 0;

  while (picks.length < count && sorted.length > 0 && guard < count * sorted.length * 8) {
    const card = sorted[guard % sorted.length];
    const used = existing.get(card.id) || 0;
    const cardLimit = Math.min(maxCopies, Number(card.deckCopies) || maxCopies);
    if (used < cardLimit) {
      picks.push(card);
      existing.set(card.id, used + 1);
    }
    guard += 1;
  }

  if (strict && picks.length < count) {
    throw new Error(`Pas assez de cartes pour construire le deck (${count} demandées).`);
  }
  return picks;
}

export function pickCopies(pool, count, maxCopies, existing = new Map()) {
  return tirer(pool, count, maxCopies, existing, true);
}

export function pickCopiesSoft(pool, count, maxCopies, existing = new Map()) {
  return tirer(pool, count, maxCopies, existing, false);
}

export function fillToCount(current, pool, count, maxCopies) {
  if (current.length >= count) return current.slice(0, count);
  return [...current, ...pickCopies(pool, count - current.length, maxCopies, countCopies(current))];
}

export function pickCreatures(pool, count) {
  const signatureCards = pool.filter((card) => Number(card.deckCopies) === 1);
  const counts = countCopies(signatureCards);
  const picks = [
    ...signatureCards,
    ...pickCopiesSoft(pool.filter((card) => card.cost <= 2), 8, MAX_NONLAND_COPIES, counts),
    ...pickCopiesSoft(pool.filter((card) => card.cost === 3), 6, MAX_NONLAND_COPIES, counts),
    ...pickCopiesSoft(pool.filter((card) => card.cost >= 4 && card.cost <= 5), 6, MAX_NONLAND_COPIES, counts),
    ...pickCopiesSoft(pool.filter((card) => card.cost >= 6), 2, MAX_NONLAND_COPIES, counts)
  ];
  return fillToCount(picks, pool, count, MAX_NONLAND_COPIES);
}

export function pickSpells(pool, count) {
  const signatureCards = pool.filter((card) => Number(card.deckCopies) === 1);
  const signatureIds = new Set(signatureCards.map((card) => card.id));
  const interactive = pool.filter(
    (card) => !signatureIds.has(card.id) && (card.slot === "offense" || card.slot === "defense")
  );
  const utility = pool.filter(
    (card) => !signatureIds.has(card.id) && (card.slot === "draw" || card.slot === "upgrade")
  );
  const signatureInteractive = signatureCards.filter(
    (card) => card.slot === "offense" || card.slot === "defense"
  ).length;
  const signatureUtility = signatureCards.length - signatureInteractive;
  const counts = countCopies(signatureCards);
  const picks = [
    ...signatureCards,
    ...pickCopiesSoft(interactive, Math.max(0, 10 - signatureInteractive), MAX_NONLAND_COPIES, counts),
    ...pickCopiesSoft(utility, Math.max(0, 4 - signatureUtility), MAX_NONLAND_COPIES, counts)
  ];
  return fillToCount(picks, pool, count, MAX_NONLAND_COPIES);
}

function normalizedType(card) {
  return String(card?.type || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isLegendaryCard(card) {
  const type = normalizedType(card);
  return type.includes("legendaire") || type.includes("divine");
}

function expandExplicitSection(deckSpec, sectionName, pool, expectedCount) {
  const entries = deckSpec.deckList?.[sectionName] || [];
  const catalogueById = new Map(pool.map((card) => [card.id, card]));
  const seen = new Set();
  const cards = [];

  for (const entry of entries) {
    if (seen.has(entry.id)) throw new Error(`${deckSpec.name} répète ${entry.id} dans sa liste ${sectionName}.`);
    seen.add(entry.id);

    const card = catalogueById.get(entry.id);
    if (!card) throw new Error(`${deckSpec.name} référence une carte absente : ${entry.id}.`);
    if (!cardFitsDeckColors(card, deckSpec.colors)) {
      throw new Error(`${card.name} n'appartient pas à l'identité ${deckSpec.colors.join("/")}.`);
    }

    const copies = Math.max(0, Math.trunc(Number(entry.copies) || 0));
    if (sectionName !== "lands") {
      if (card.divine && entry.allowDivine !== true) {
        throw new Error(`${card.name} est une invocation conditionnelle et ne peut pas être mise dans le deck.`);
      }
      const cardLimit = isLegendaryCard(card)
        ? 1
        : Math.min(MAX_NONLAND_COPIES, Number(card.deckCopies) || MAX_NONLAND_COPIES);
      if (copies > cardLimit) throw new Error(`${card.name} dépasse sa limite de ${cardLimit} exemplaire(s).`);

      const requirements = manaRequirements(card);
      if (!requirements || requirements.total !== normalizedCost(card)) {
        throw new Error(`${card.name} possède un coût incohérent avec le moteur de mana.`);
      }
    }

    for (let copy = 0; copy < copies; copy += 1) cards.push(card);
  }

  if (cards.length !== expectedCount) {
    throw new Error(`${deckSpec.name} exige ${expectedCount} ${sectionName}, mais sa liste en contient ${cards.length}.`);
  }
  return cards;
}

function buildExplicitDeck(deckSpec, catalogue) {
  return [
    ...expandExplicitSection(deckSpec, "lands", catalogue.lands, DECK_LANDS),
    ...expandExplicitSection(deckSpec, "creatures", catalogue.cards, DECK_SIZE - DECK_LANDS - DECK_SPELLS),
    ...expandExplicitSection(deckSpec, "spells", catalogue.spells, DECK_SPELLS)
  ];
}

// Les invocations spéciales sont conservées hors du deck construit. Elles ne
// modifient donc ni les 60 cartes, ni les compteurs de bibliothèque.
export function buildExtraCards(deckSpec, catalogue) {
  const ids = deckSpec.extraCards || [];
  const catalogueById = new Map(
    [...catalogue.cards, ...catalogue.spells].map((card) => [card.id, card])
  );
  const seen = new Set();

  return ids.map((id) => {
    if (seen.has(id)) throw new Error(`${deckSpec.name} répète l'invocation spéciale ${id}.`);
    seen.add(id);
    const card = catalogueById.get(id);
    if (!card) throw new Error(`${deckSpec.name} référence une invocation absente : ${id}.`);
    if (!card.divine) throw new Error(`${card.name} doit être une invocation conditionnelle.`);
    if (!cardFitsDeckColors(card, deckSpec.colors)) {
      throw new Error(`${card.name} n'appartient pas à l'identité ${deckSpec.colors.join("/")}.`);
    }
    return card;
  });
}

// Les 60 cartes d un deck, dans l ordre de construction et SANS identifiant
// d instance : c est la liste de reference, celle qu on imprime.
// `catalogue` = { cards, lands, spells }, tel que le jeu les charge.
export function buildDeck(deckSpec, catalogue) {
  if (deckSpec.deckList) return buildExplicitDeck(deckSpec, catalogue);

  const landsProducing = (color) => catalogue.lands.filter((land) => landProduces(land, color));
  const lands = [
    ...pickCopies(landsProducing(deckSpec.colors[0]), DECK_LANDS / 2, Infinity),
    ...pickCopies(landsProducing(deckSpec.colors[1]), DECK_LANDS / 2, Infinity)
  ];
  const creaturePool = catalogue.cards.filter((card) => cardFitsDeckColors(card, deckSpec.colors));
  const spellPool = catalogue.spells.filter((card) => cardFitsDeckColors(card, deckSpec.colors));
  const composition = getDeckComposition(deckSpec, catalogue);
  const deck = [
    ...lands,
    ...pickCreatures(creaturePool, composition.creatures),
    ...pickSpells(spellPool, composition.spells)
  ];

  if (deck.length !== DECK_SIZE) {
    throw new Error(`${deckSpec.name} doit contenir ${DECK_SIZE} cartes, mais contient ${deck.length}.`);
  }
  return deck;
}

// Liste imprimable : une entree par carte DIFFERENTE, avec son nombre
// d exemplaires. C est ce que la page d impression multiplie.
export function deckPrintList(deckSpec, catalogue) {
  const deck = buildDeck(deckSpec, catalogue);
  const parId = new Map();
  for (const carte of deck) {
    const entree = parId.get(carte.id);
    if (entree) entree.copies += 1;
    else parId.set(carte.id, { card: carte, copies: 1 });
  }
  return [...parId.values()];
}
