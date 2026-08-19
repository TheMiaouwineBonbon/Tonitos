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
import { landProduces } from "./engine-core.mjs";

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
    theme: "défense, soins et renforts naturels"
  },
  {
    id: "rouge-noir",
    name: "Rouge / Noir - Pacte des Cendres",
    shortName: "Pacte des Cendres",
    colors: ["Rouge", "Noir"],
    theme: "dégâts rapides, drain de vie et destruction"
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
    name: "Blanc / Bleu - Concile des Marées",
    shortName: "Concile des Marées",
    colors: ["Blanc", "Bleu"],
    theme: "protection, pioche et contrôle des abysses"
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

// Les 60 cartes d un deck, dans l ordre de construction et SANS identifiant
// d instance : c est la liste de reference, celle qu on imprime.
// `catalogue` = { cards, lands, spells }, tel que le jeu les charge.
export function buildDeck(deckSpec, catalogue) {
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
