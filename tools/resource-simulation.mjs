import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cards = JSON.parse(fs.readFileSync(path.join(root, "data", "cards.json"), "utf8")).map((card) => ({ ...card, kind: "creature" }));
const spells = JSON.parse(fs.readFileSync(path.join(root, "data", "spells.json"), "utf8")).map((card) => ({ ...card, kind: "spell" }));
const lands = JSON.parse(fs.readFileSync(path.join(root, "data", "lands.json"), "utf8"));
const decks = [
  ["Blanc / Vert", ["Blanc", "Vert"]],
  ["Rouge / Noir", ["Rouge", "Noir"]],
  ["Bleu / Vert", ["Bleu", "Vert"]],
  ["Noir / Blanc", ["Noir", "Blanc"]],
  ["Rouge / Bleu", ["Rouge", "Bleu"]]
];

function countsOf(list) {
  const counts = new Map();
  for (const card of list) counts.set(card.id, (counts.get(card.id) || 0) + 1);
  return counts;
}

function pickCopies(pool, count, limit, existing = new Map()) {
  const sorted = [...pool].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, "fr"));
  const picks = [];
  let guard = 0;
  while (picks.length < count && sorted.length > 0 && guard < count * sorted.length * 8) {
    const card = sorted[guard % sorted.length];
    const used = existing.get(card.id) || 0;
    const cardLimit = Math.min(limit, Number(card.deckCopies) || limit);
    if (used < cardLimit) {
      picks.push(card);
      existing.set(card.id, used + 1);
    }
    guard += 1;
  }
  if (picks.length < count) throw new Error(`Pool insuffisant: ${picks.length}/${count}`);
  return picks;
}

function pickSoft(pool, count, limit, existing) {
  if (pool.length === 0) return [];
  const available = pool.reduce(
    (total, card) => total + Math.max(0, Math.min(limit, Number(card.deckCopies) || limit) - (existing.get(card.id) || 0)),
    0
  );
  return pickCopies(pool, Math.min(count, available), limit, existing);
}

function fillToCount(current, pool, count, limit) {
  if (current.length >= count) return current.slice(0, count);
  return [...current, ...pickCopies(pool, count - current.length, limit, countsOf(current))];
}

function buildDeck(colors) {
  const landCards = [
    ...pickCopies(lands.filter((land) => land.family === colors[0]), 12, Infinity),
    ...pickCopies(lands.filter((land) => land.family === colors[1]), 12, Infinity)
  ];
  const creaturePool = cards.filter((card) => colors.includes(card.family));
  const spellPool = spells.filter((card) => colors.includes(card.family) || card.family === "Incolore");
  const signatures = creaturePool.filter((card) => Number(card.deckCopies) === 1);
  const creatureCounts = countsOf(signatures);
  const creaturePicks = [
    ...signatures,
    ...pickSoft(creaturePool.filter((card) => card.cost <= 2), 8, 4, creatureCounts),
    ...pickSoft(creaturePool.filter((card) => card.cost === 3), 6, 4, creatureCounts),
    ...pickSoft(creaturePool.filter((card) => card.cost >= 4 && card.cost <= 5), 6, 4, creatureCounts),
    ...pickSoft(creaturePool.filter((card) => card.cost >= 6), 2, 4, creatureCounts)
  ];
  const spellCounts = new Map();
  const spellPicks = [
    ...pickSoft(spellPool.filter((card) => card.slot === "offense" || card.slot === "defense"), 10, 4, spellCounts),
    ...pickSoft(spellPool.filter((card) => card.slot === "draw" || card.slot === "upgrade"), 4, 4, spellCounts)
  ];
  return [
    ...landCards,
    ...fillToCount(creaturePicks, creaturePool, 22, 4),
    ...fillToCount(spellPicks, spellPool, 14, 4)
  ];
}

function randomFactory(seed) {
  let value = seed >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

function shuffle(list, random) {
  const result = [...list];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function availableMana(playedLands) {
  const mana = new Map();
  for (const land of playedLands) mana.set(land.family, (mana.get(land.family) || 0) + 1);
  return mana;
}

function canAfford(card, mana) {
  if (card.divine) return false;
  const cost = Math.max(0, Number(card.cost) || 0);
  if (card.family === "Incolore") return [...mana.values()].reduce((sum, amount) => sum + amount, 0) >= cost;
  return (mana.get(card.family) || 0) >= cost;
}

function spend(card, mana) {
  let remaining = Math.max(0, Number(card.cost) || 0);
  if (card.family !== "Incolore") {
    mana.set(card.family, (mana.get(card.family) || 0) - remaining);
    return;
  }
  for (const [family, amount] of mana) {
    const used = Math.min(amount, remaining);
    mana.set(family, amount - used);
    remaining -= used;
    if (remaining === 0) return;
  }
}

function chooseLand(hand, playedLands) {
  const candidates = hand.map((card, index) => ({ card, index })).filter(({ card }) => card.kind === "land");
  if (candidates.length === 0) return -1;
  return candidates
    .map(({ card, index }) => {
      const mana = availableMana([...playedLands, card]);
      const playable = hand.filter((entry) => entry.kind !== "land" && canAfford(entry, mana));
      return { index, score: playable.length * 100 + playable.reduce((sum, entry) => sum + entry.cost, 0) };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)[0].index;
}

function simulate(deck, games, seed) {
  const random = randomFactory(seed);
  const turns = Array.from({ length: 10 }, () => ({ noLand: 0, noPlay: 0, played: 0 }));
  for (let game = 0; game < games; game += 1) {
    const library = shuffle(deck, random);
    const hand = library.splice(0, 7);
    const playedLands = [];
    for (let turn = 1; turn <= 10; turn += 1) {
      if (turn > 1 && library.length > 0) hand.push(library.shift());
      const landIndex = chooseLand(hand, playedLands);
      if (landIndex >= 0) playedLands.push(hand.splice(landIndex, 1)[0]);
      else turns[turn - 1].noLand += 1;

      const mana = availableMana(playedLands);
      let playedThisTurn = 0;
      while (true) {
        const playable = hand
          .map((card, index) => ({ card, index }))
          .filter(({ card }) => card.kind !== "land" && canAfford(card, mana))
          .sort((a, b) => b.card.cost - a.card.cost)[0];
        if (!playable) break;
        spend(playable.card, mana);
        hand.splice(playable.index, 1);
        playedThisTurn += 1;
      }
      if (playedThisTurn === 0) turns[turn - 1].noPlay += 1;
      else turns[turn - 1].played += playedThisTurn;
    }
  }
  return turns.map((turn) => ({
    noLand: (turn.noLand / games) * 100,
    noPlay: (turn.noPlay / games) * 100,
    averagePlayed: turn.played / games
  }));
}

const games = Number(process.argv[2] || 10_000);
for (const [name, colors] of decks) {
  const result = simulate(buildDeck(colors), games, 0x51e11a + name.length);
  console.log(`\n${name} (${games} parties)`);
  console.log("Tour | sans terrain | sans carte jouée | cartes jouées");
  result.forEach((turn, index) => {
    console.log(
      `${String(index + 1).padStart(4)} | ${turn.noLand.toFixed(1).padStart(11)}% | ${turn.noPlay.toFixed(1).padStart(16)}% | ${turn.averagePlayed.toFixed(2)}`
    );
  });
}
