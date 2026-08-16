import test from "node:test";
import assert from "node:assert/strict";
import {
  buffUnits,
  canPayCard,
  canTakeMainAction,
  canUnitAttack,
  determineWinner,
  drawFromDeck,
  makeTurnStartKey,
  parasiteVengeanceDamage,
  partitionDeadUnits,
  payCardCost,
  resolveCreatureCombat,
  selectHighestCostCards,
  tickDelayedReturns,
  unitHasKeyword,
  validateGameState
} from "../engine-core.mjs";

function makeCards(count, prefix = "card") {
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, uid: `${prefix}-uid-${index}` }));
}

function makeSide(name = "player") {
  return {
    side: name,
    life: 20,
    deck: [],
    hand: [],
    board: [],
    lands: [],
    graveyard: [],
    exile: []
  };
}

function makeUnit(overrides = {}) {
  return {
    id: "soldat",
    uid: `unit-${Math.random()}`,
    attack: 2,
    maxLife: 3,
    currentLife: 3,
    createdTurn: 1,
    tapped: false,
    hasAttacked: false,
    keywords: [],
    ...overrides
  };
}

test("une partie de 60 cartes ouvre avec 7 cartes et 53 en bibliothèque", () => {
  const side = makeSide();
  side.deck = makeCards(60);
  const events = drawFromDeck(side, 7);
  assert.equal(events.length, 7);
  assert.equal(side.hand.length, 7);
  assert.equal(side.deck.length, 53);
  assert.equal(side.life, 20);
});

test("une bibliothèque vide inflige la fatigue sans ajouter de valeur invalide", () => {
  const side = makeSide();
  const events = drawFromDeck(side, 3);
  assert.deepEqual(events.map((event) => event.type), ["fatigue", "fatigue", "fatigue"]);
  assert.equal(side.life, 17);
  assert.equal(side.hand.length, 0);
});

test("la main actuelle accepte une pioche volumineuse sans perdre ni dupliquer de carte", () => {
  const side = makeSide();
  side.deck = makeCards(25);
  drawFromDeck(side, 25);
  assert.equal(side.hand.length, 25);
  assert.equal(new Set(side.hand.map((card) => card.uid)).size, 25);
});

test("La vérité sélectionne les deux cartes les plus coûteuses de façon déterministe", () => {
  const hand = [
    { id: "faible", uid: "u-1", cost: 1 },
    { id: "zeta", uid: "u-2", cost: 7 },
    { id: "alpha", uid: "u-3", cost: 7 },
    { id: "moyenne", uid: "u-4", cost: 4 }
  ];
  assert.deepEqual(
    selectHighestCostCards(hand, 2).map((card) => card.id),
    ["alpha", "zeta"]
  );
  assert.equal(hand.length, 4);
});

test("le moteur refuse les actions principales hors tour, pendant la relève ou après la partie", () => {
  assert.equal(canTakeMainAction({ currentTurn: "player", phase: "main1", handoffPending: false }, "player"), true);
  assert.equal(canTakeMainAction({ currentTurn: "enemy", phase: "main1", handoffPending: false }, "player"), false);
  assert.equal(canTakeMainAction({ currentTurn: "player", phase: "main1", handoffPending: true }, "player"), false);
  assert.equal(canTakeMainAction({ currentTurn: "player", phase: "over", handoffPending: false }, "player"), false);
});

test("le mana coloré, incolore et le coût zéro sont résolus sans paiement partiel", () => {
  const side = makeSide();
  side.lands = [
    { family: "Blanc", tapped: false },
    { family: "Blanc", tapped: false },
    { family: "Vert", tapped: false }
  ];
  assert.equal(canPayCard(side, { family: "Blanc", cost: 2 }), true);
  assert.equal(payCardCost(side, { family: "Blanc", cost: 2 }), true);
  assert.equal(side.lands.filter((land) => land.tapped).length, 2);
  assert.equal(payCardCost(side, { family: "Vert", cost: 2 }), false);
  assert.equal(side.lands[2].tapped, false);
  assert.equal(payCardCost(side, { family: "Rouge", cost: 0 }), true);
  assert.equal(canPayCard(side, { family: "Incolore", cost: 1 }), true);
});

test("le spam de paiement ne peut engager les mêmes terrains deux fois", () => {
  const side = makeSide();
  side.lands = [{ family: "Bleu", tapped: false }, { family: "Bleu", tapped: false }];
  const card = { family: "Bleu", cost: 2 };
  assert.equal(payCardCost(side, card), true);
  assert.equal(payCardCost(side, card), false);
  assert.equal(side.lands.filter((land) => land.tapped).length, 2);
});

test("un sort multicolore réserve ses couleurs puis paie le coût générique", () => {
  const card = {
    family: "Multicolore",
    cost: 5,
    manaCost: { Blanc: 1, Noir: 1, generic: 3 }
  };
  const valid = makeSide();
  valid.lands = [
    { family: "Blanc", tapped: false },
    { family: "Noir", tapped: false },
    { family: "Vert", tapped: false },
    { family: "Bleu", tapped: false },
    { family: "Blanc", tapped: false }
  ];
  assert.equal(canPayCard(valid, card), true);
  assert.equal(payCardCost(valid, card), true);
  assert.equal(valid.lands.every((land) => land.tapped), true);

  const invalid = makeSide();
  invalid.lands = Array.from({ length: 5 }, () => ({ family: "Blanc", tapped: false }));
  assert.equal(canPayCard(invalid, card), false);
  assert.equal(payCardCost(invalid, card), false);
  assert.equal(invalid.lands.every((land) => !land.tapped), true);
});

test("le mal d'invocation, Célérité, Défenseur et l'attaque déjà consommée sont cohérents", () => {
  assert.equal(canUnitAttack(makeUnit({ createdTurn: 3 }), 3), false);
  assert.equal(canUnitAttack(makeUnit({ createdTurn: 3, keywords: ["Célérité"] }), 3), true);
  assert.equal(canUnitAttack(makeUnit({ createdTurn: 1, keywords: ["Défenseur"] }), 3), false);
  assert.equal(canUnitAttack(makeUnit({ createdTurn: 1, hasAttacked: true }), 3), false);
  assert.equal(canUnitAttack(makeUnit({ createdTurn: 1, tapped: true }), 3), false);
  assert.equal(unitHasKeyword(makeUnit({ keywords: undefined }), "Vol"), false);
});

test("deux créatures peuvent mourir simultanément", () => {
  const attacker = makeUnit({ attack: 3, currentLife: 2, maxLife: 2 });
  const target = makeUnit({ attack: 2, currentLife: 3 });
  const result = resolveCreatureCombat(attacker, target);
  assert.equal(result.attackerDied, true);
  assert.equal(result.targetDied, true);
  assert.equal(attacker.currentLife, 0);
  assert.equal(target.currentLife, 0);
});

test("Contact mortel exige au moins un dégât et les statistiques négatives ne soignent pas", () => {
  const attacker = makeUnit({ attack: 1, keywords: ["Contact mortel"] });
  const target = makeUnit({ attack: -5, currentLife: 99, maxLife: 99 });
  const result = resolveCreatureCombat(attacker, target);
  assert.equal(result.targetDied, true);
  assert.equal(result.retaliationDamage, 0);
  assert.equal(attacker.currentLife, 3);
});

test("les morts sont séparées du plateau en une seule passe", () => {
  const alive = makeUnit({ uid: "alive", currentLife: 1 });
  const deadA = makeUnit({ uid: "dead-a", currentLife: 0 });
  const deadB = makeUnit({ uid: "dead-b", currentLife: -8 });
  const result = partitionDeadUnits([deadA, alive, deadB]);
  assert.deepEqual(result.living.map((unit) => unit.uid), ["alive"]);
  assert.deepEqual(result.dead.map((unit) => unit.uid), ["dead-a", "dead-b"]);
});

test("Daemon revient au troisième tour de son propriétaire", () => {
  const daemon = { id: "aventurier-mythique-daemon", uid: "daemon-grave", returnInTurns: 3 };
  const ordinary = { id: "soldat", uid: "soldat-grave", returnInTurns: null };
  const graveyard = [daemon, ordinary];
  assert.deepEqual(tickDelayedReturns(graveyard), []);
  assert.equal(daemon.returnInTurns, 2);
  assert.deepEqual(tickDelayedReturns(graveyard), []);
  assert.equal(daemon.returnInTurns, 1);
  assert.deepEqual(tickDelayedReturns(graveyard).map((card) => card.id), ["aventurier-mythique-daemon"]);
  assert.equal(daemon.returnInTurns, 0);
  assert.deepEqual(tickDelayedReturns(graveyard).map((card) => card.id), ["aventurier-mythique-daemon"]);
  assert.equal(ordinary.returnInTurns, null);
});

test("chaque Parasite présent au déclenchement applique sa propre vengeance", () => {
  const board = [
    makeUnit({ id: "parasite", currentLife: 1 }),
    makeUnit({ id: "parasite", currentLife: 4 }),
    makeUnit({ id: "parasite", currentLife: 0 }),
    makeUnit({ id: "autre" })
  ];
  assert.equal(parasiteVengeanceDamage(board), 6);
});

test("les buffs permanents restent finis même avec de très grandes valeurs", () => {
  const connor = makeUnit({ attack: 1, maxLife: 2, currentLife: 2 });
  for (let turn = 0; turn < 10_000; turn += 1) buffUnits([connor], 1, 1);
  assert.deepEqual([connor.attack, connor.maxLife, connor.currentLife], [10_001, 10_002, 10_002]);
  assert.equal([connor.attack, connor.maxLife, connor.currentLife].every(Number.isFinite), true);
});

test("une clé de début de tour empêche Connor de recevoir deux fois le même trigger", () => {
  const connor = makeUnit({ attack: 1, maxLife: 2, currentLife: 2 });
  const applied = new Set();
  const start = (match, turn, side) => {
    const key = makeTurnStartKey(match, turn, side);
    if (applied.has(key)) return false;
    applied.add(key);
    buffUnits([connor], 1, 1);
    return true;
  };
  assert.equal(start("partie-a", 2, "player"), true);
  assert.equal(start("partie-a", 2, "player"), false);
  assert.equal(start("partie-a", 3, "player"), true);
  assert.equal(connor.attack, 3);
});

test("la victoire, la défaite et l'égalité sont déterministes", () => {
  assert.equal(determineWinner({ life: 1 }, { life: 1 }), null);
  assert.equal(determineWinner({ life: 0 }, { life: 5 }), "enemy");
  assert.equal(determineWinner({ life: 5 }, { life: -2 }), "player");
  assert.equal(determineWinner({ life: 0 }, { life: 0 }), "draw");
});

test("le validateur détecte NaN, plateau plein et UID dupliqué", () => {
  const player = makeSide("player");
  const enemy = makeSide("enemy");
  player.board = Array.from({ length: 8 }, (_, index) => makeUnit({ uid: `p-${index}` }));
  enemy.hand.push({ id: "copie", uid: "p-0" });
  enemy.life = Number.NaN;
  const errors = validateGameState({ player, enemy });
  assert.equal(errors.some((error) => error.includes("8/7")), true);
  assert.equal(errors.some((error) => error.includes("UID dupliqué")), true);
  assert.equal(errors.some((error) => error.includes("points de vie invalides")), true);
});
