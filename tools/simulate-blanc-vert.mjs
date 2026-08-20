import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canPayCard,
  landEnergy,
  landProduction,
  manaRequirements,
  payCardCost
} from "../engine-core.mjs";
import {
  buildDeck,
  cardFitsDeckColors,
  getDeckSpec,
  isLegendaryCard,
  MAX_NONLAND_COPIES
} from "../decks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, "data", file), "utf8"));
const catalogue = {
  cards: readJson("cards.json").map((card) => ({ ...card, kind: "creature" })),
  spells: readJson("spells.json").map((card) => ({ ...card, kind: "spell" })),
  lands: readJson("lands.json").map((card) => ({ ...card, kind: "land" }))
};
const deckSpec = getDeckSpec("blanc-vert");
const referenceDeck = buildDeck(deckSpec, catalogue);
const games = Math.max(20_000, Math.trunc(Number(process.argv[2]) || 20_000));
const seed = Math.trunc(Number(process.argv[3]) || 0x5e11a40) >>> 0;
const turnsToSimulate = 12;

function randomFactory(initialSeed) {
  let value = initialSeed >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

function shuffle(list, random) {
  const result = list.map((card) => ({ ...card }));
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function countById(cards) {
  const counts = new Map();
  for (const card of cards) counts.set(card.id, (counts.get(card.id) || 0) + 1);
  return counts;
}

function validateDeck(deck) {
  const errors = [];
  const sections = {
    land: deck.filter((card) => card.kind === "land"),
    creature: deck.filter((card) => card.kind === "creature"),
    spell: deck.filter((card) => card.kind === "spell")
  };
  if (deck.length !== 60) errors.push(`taille ${deck.length}/60`);
  if (sections.land.length !== 24) errors.push(`terrains ${sections.land.length}/24`);
  if (sections.creature.length !== 22) errors.push(`créatures ${sections.creature.length}/22`);
  if (sections.spell.length !== 14) errors.push(`sorts ${sections.spell.length}/14`);

  for (const [id, copies] of countById([...sections.creature, ...sections.spell])) {
    const card = deck.find((entry) => entry.id === id);
    const limit = isLegendaryCard(card)
      ? 1
      : Math.min(MAX_NONLAND_COPIES, Number(card.deckCopies) || MAX_NONLAND_COPIES);
    if (copies > limit) errors.push(`${card.name}: ${copies}/${limit} exemplaires`);
  }

  for (const card of deck) {
    if (!cardFitsDeckColors(card, deckSpec.colors)) errors.push(`${card.name}: identité illégale`);
    if (card.kind !== "land" && card.divine) errors.push(`${card.name}: invocation conditionnelle dans le deck`);
    if (card.kind !== "land" && manaRequirements(card)?.total !== Number(card.cost)) {
      errors.push(`${card.name}: coût moteur ${manaRequirements(card)?.total} / cost ${card.cost}`);
    }
  }
  if (!deckSpec.deckList) errors.push("la sélection Blanc/Vert n'est pas une liste explicite");
  if (errors.length > 0) throw new Error(`Deck Blanc/Vert invalide:\n- ${errors.join("\n- ")}`);
  return sections;
}

function draw(side, amount) {
  for (let index = 0; index < amount && side.deck.length > 0; index += 1) {
    side.hand.push(side.deck.shift());
  }
}

function availableEnergy(lands) {
  return lands.filter((land) => !land.tapped).reduce((sum, land) => sum + landEnergy(land), 0);
}

function coloredDemand(card, color) {
  return manaRequirements(card)?.colored.find(([family]) => family === color)?.[1] || 0;
}

function landScore(candidate, hand, lands) {
  const placed = { ...candidate, tapped: Boolean(candidate.entersTapped) };
  const trialSide = { lands: [...lands, placed] };
  const nonlands = hand.filter((card) => card.kind !== "land" && !card.divine);
  const playable = nonlands.filter((card) => canPayCard(trialSide, card));
  const highestPlayable = playable.reduce((max, card) => Math.max(max, Number(card.cost) || 0), 0);
  const production = landProduction(candidate);
  const unmetDemand = production.colors.reduce(
    (score, color) =>
      score + nonlands.reduce((sum, card) => sum + coloredDemand(card, color), 0),
    0
  );
  const flexibility = production.colors.filter((color) => deckSpec.colors.includes(color)).length;

  return (
    playable.length * 1000 +
    highestPlayable * 80 +
    unmetDemand * 4 +
    flexibility * 6 +
    landEnergy(candidate) * 3 -
    (candidate.entersTapped ? 30 : 0)
  );
}

function chooseLandIndex(hand, lands) {
  return hand
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.kind === "land")
    .map(({ card, index }) => ({ index, score: landScore(card, hand, lands) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.index ?? -1;
}

function drawAmount(card) {
  if (card.id === "fee") return 1;
  if (["drawOneGainOne", "restHero"].includes(card.effect)) return 1;
  if (["drawTwo", "naturalMemory", "cursedPact"].includes(card.effect)) return 2;
  if (["drawThree", "livreClaudia"].includes(card.effect)) return 3;
  return 0;
}

function playPriority(card) {
  return drawAmount(card) * 1000 + Number(card.cost || 0) * 20 + (card.kind === "creature" ? 2 : 0);
}

function pullGreenLand(side) {
  let index = side.deck.findIndex((card) => card.kind === "land" && card.family === "Vert");
  if (index < 0) index = side.deck.findIndex((card) => card.kind === "land");
  if (index < 0) return;
  const [land] = side.deck.splice(index, 1);
  side.lands.push({ ...land, tapped: true });
}

function playAffordableCards(side) {
  let played = 0;
  let guard = 0;
  while (guard < 40) {
    guard += 1;
    const choice = side.hand
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card.kind !== "land" && !card.divine && canPayCard(side, card))
      .sort((a, b) => playPriority(b.card) - playPriority(a.card) || a.index - b.index)[0];
    if (!choice || !payCardCost(side, choice.card)) break;
    const [card] = side.hand.splice(choice.index, 1);
    played += 1;
    draw(side, drawAmount(card));
    if (card.id === "uldrid") pullGreenLand(side);
  }
  return played;
}

function temporarilyDeadCards(side) {
  return side.hand.filter((card) => card.kind !== "land" && !canPayCard(side, card)).length;
}

function losesTurnToColor(side) {
  const energy = availableEnergy(side.lands);
  const nonlands = side.hand.filter((card) => card.kind !== "land" && !card.divine);
  if (nonlands.some((card) => canPayCard(side, card))) return false;
  return nonlands.some((card) => {
    const requirements = manaRequirements(card);
    return requirements && requirements.total <= energy && !canPayCard(side, card);
  });
}

function simulate(deck, gameCount, initialSeed) {
  const random = randomFactory(initialSeed);
  const metrics = {
    openingLands: new Map(),
    actionByTurn: Array(turnsToSimulate).fill(0),
    playedByTurn: Array(turnsToSimulate).fill(0),
    landsByTurn: Array(turnsToSimulate).fill(0),
    silentTurns: 0,
    totalPlayed: 0,
    firstPlayTurn: 0,
    gamesWithPlay: 0,
    manaScrew: 0,
    colorBlock: 0,
    colorBlockedTurns: 0,
    unusedMana: 0,
    deadCardsTurn5: 0,
    deadCardsTurn12: 0
  };

  for (let game = 0; game < gameCount; game += 1) {
    const side = { deck: shuffle(deck, random), hand: [], lands: [] };
    draw(side, 7);
    const openingLands = side.hand.filter((card) => card.kind === "land").length;
    metrics.openingLands.set(openingLands, (metrics.openingLands.get(openingLands) || 0) + 1);
    let firstPlay = 0;
    let colorBlocked = false;
    let energyTurn5 = 0;
    let landsTurn3 = 0;

    for (let turn = 1; turn <= turnsToSimulate; turn += 1) {
      for (const land of side.lands) land.tapped = false;
      if (turn > 1) draw(side, 1);

      const landIndex = chooseLandIndex(side.hand, side.lands);
      if (landIndex >= 0) {
        const [land] = side.hand.splice(landIndex, 1);
        side.lands.push({ ...land, tapped: Boolean(land.entersTapped) });
      }
      metrics.landsByTurn[turn - 1] += side.lands.length;
      if (turn === 3) landsTurn3 = side.lands.length;
      if (turn === 5) energyTurn5 = side.lands.reduce((sum, land) => sum + landEnergy(land), 0);
      if (turn <= 5 && losesTurnToColor(side)) {
        colorBlocked = true;
        metrics.colorBlockedTurns += 1;
      }
      if (turn === 5) metrics.deadCardsTurn5 += temporarilyDeadCards(side);

      const played = playAffordableCards(side);
      metrics.playedByTurn[turn - 1] += played;
      metrics.totalPlayed += played;
      if (played > 0) {
        metrics.actionByTurn[turn - 1] += 1;
        if (firstPlay === 0) firstPlay = turn;
      } else {
        metrics.silentTurns += 1;
      }
      metrics.unusedMana += availableEnergy(side.lands);
    }

    for (const land of side.lands) land.tapped = false;
    metrics.deadCardsTurn12 += temporarilyDeadCards(side);
    if (firstPlay > 0) {
      metrics.gamesWithPlay += 1;
      metrics.firstPlayTurn += firstPlay;
    }
    // Screw conventionnel : moins de deux poses dans les trois premiers tours,
    // ou moins de trois manas potentiels au tour 5.
    if ((openingLands < 2 && landsTurn3 < 2) || energyTurn5 < 3) metrics.manaScrew += 1;
    if (colorBlocked) metrics.colorBlock += 1;
  }

  return {
    openingLands: Object.fromEntries([...metrics.openingLands].sort((a, b) => a[0] - b[0]).map(([key, value]) => [key, value / gameCount * 100])),
    actionByTurn: metrics.actionByTurn.map((value) => value / gameCount * 100),
    playedByTurn: metrics.playedByTurn.map((value) => value / gameCount),
    landsByTurn: metrics.landsByTurn.map((value) => value / gameCount),
    silentTurns: metrics.silentTurns / gameCount,
    totalPlayed: metrics.totalPlayed / gameCount,
    firstPlayTurn: metrics.firstPlayTurn / Math.max(1, metrics.gamesWithPlay),
    manaScrew: metrics.manaScrew / gameCount * 100,
    colorBlock: metrics.colorBlock / gameCount * 100,
    colorBlockedTurns: metrics.colorBlockedTurns / gameCount / 5 * 100,
    unusedMana: metrics.unusedMana / gameCount / turnsToSimulate,
    deadCardsTurn5: metrics.deadCardsTurn5 / gameCount,
    deadCardsTurn12: metrics.deadCardsTurn12 / gameCount
  };
}

function summarize(sections, result) {
  const nonlands = [...sections.creature, ...sections.spell];
  const curve = [1, 2, 3, 4, 5].map((cost) => ({
    cost,
    creatures: sections.creature.filter((card) => card.cost === cost).length,
    spells: sections.spell.filter((card) => card.cost === cost).length
  }));
  curve.push({
    cost: "6+",
    creatures: sections.creature.filter((card) => card.cost >= 6).length,
    spells: sections.spell.filter((card) => card.cost >= 6).length
  });
  const averageCost = nonlands.reduce((sum, card) => sum + card.cost, 0) / nonlands.length;
  const landGroups = { white: 0, green: 0, dual: 0, utility: 0 };
  for (const land of sections.land) {
    const production = landProduction(land);
    if (production.amount > 1 || production.colors.length > 2) landGroups.utility += 1;
    else if (production.colors.includes("Blanc") && production.colors.includes("Vert")) landGroups.dual += 1;
    else if (production.colors.length === 1 && production.colors[0] === "Blanc") landGroups.white += 1;
    else if (production.colors.length === 1 && production.colors[0] === "Vert") landGroups.green += 1;
    else landGroups.utility += 1;
  }
  const whiteSources = sections.land.filter((land) => landProduction(land).colors.includes("Blanc")).length;
  const greenSources = sections.land.filter((land) => landProduction(land).colors.includes("Vert")).length;
  const counts = countById(nonlands);
  const diversity = { references: counts.size, x4: 0, x3: 0, x2: 0, x1: 0 };
  for (const copies of counts.values()) diversity[`x${copies}`] += 1;

  console.log(`Deck Blanc/Vert valide : 60 cartes, 24 terrains, 22 créatures, 14 sorts.`);
  console.log(`Simulations : ${games.toLocaleString("fr-FR")} | graine : ${seed}`);
  console.log("\nCourbe (créatures / sorts / total)");
  for (const row of curve) console.log(`${String(row.cost).padStart(2)} : ${row.creatures} / ${row.spells} / ${row.creatures + row.spells}`);
  console.log(`Coût moyen non-terrain : ${averageCost.toFixed(3)}`);
  console.log(`\nManabase : ${JSON.stringify(landGroups)} | sources Blanc ${whiteSources} | sources Vert ${greenSources}`);
  console.log(`Diversité : ${JSON.stringify(diversity)}`);
  console.log("\nRésultats");
  console.log(`Main initiale, terrains : ${Object.entries(result.openingLands).map(([count, percent]) => `${count}=${percent.toFixed(2)}%`).join(" | ")}`);
  for (let turn = 1; turn <= 5; turn += 1) {
    console.log(`T${turn} : action ${result.actionByTurn[turn - 1].toFixed(2)}% | cartes ${result.playedByTurn[turn - 1].toFixed(3)} | terrains ${result.landsByTurn[turn - 1].toFixed(3)}`);
  }
  console.log(`Première carte, tour moyen : ${result.firstPlayTurn.toFixed(3)}`);
  console.log(`Tours muets /12 : ${result.silentTurns.toFixed(3)}`);
  console.log(`Cartes jouées /12 : ${result.totalPlayed.toFixed(3)}`);
  console.log(`Mana screw : ${result.manaScrew.toFixed(2)}%`);
  console.log(`Parties touchées par un blocage couleur T1-T5 : ${result.colorBlock.toFixed(2)}%`);
  console.log(`Tours T1-T5 perdus uniquement sur la couleur : ${result.colorBlockedTurns.toFixed(2)}%`);
  console.log(`Mana inutilisé moyen par tour : ${result.unusedMana.toFixed(3)}`);
  console.log(`Cartes temporairement mortes : T5 ${result.deadCardsTurn5.toFixed(3)} | T12 ${result.deadCardsTurn12.toFixed(3)}`);
}

const sections = validateDeck(referenceDeck);
summarize(sections, simulate(referenceDeck, games, seed));
