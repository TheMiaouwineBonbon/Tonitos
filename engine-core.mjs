export function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizedCost(card) {
  return Math.max(0, Math.trunc(finiteNumber(card?.cost)));
}

export function canTakeMainAction(game, sideName) {
  return Boolean(
    game &&
      sideName &&
      !game.handoffPending &&
      game.phase !== "over" &&
      game.currentTurn === sideName
  );
}

export function drawFromDeck(side, amount, { fatigueDamage = 1 } = {}) {
  if (!side || !Array.isArray(side.deck) || !Array.isArray(side.hand)) {
    throw new TypeError("La pioche exige un côté avec un deck et une main.");
  }

  const events = [];
  const count = Math.max(0, Math.trunc(finiteNumber(amount)));
  const damage = Math.max(0, finiteNumber(fatigueDamage, 1));
  side.life = finiteNumber(side.life);

  for (let index = 0; index < count; index += 1) {
    const card = side.deck.shift();
    if (card) {
      side.hand.push(card);
      events.push({ type: "draw", card });
    } else {
      side.life -= damage;
      events.push({ type: "fatigue", damage });
    }
  }

  return events;
}

export function untappedLandsForCard(side, card) {
  const lands = Array.isArray(side?.lands) ? side.lands : [];
  const untapped = lands.filter((land) => !land?.tapped);
  if (card?.family === "Incolore") return untapped;
  return untapped.filter((land) => land?.family === card?.family);
}

export function canPayCard(side, card) {
  return untappedLandsForCard(side, card).length >= normalizedCost(card);
}

export function payCardCost(side, card) {
  const cost = normalizedCost(card);
  const lands = untappedLandsForCard(side, card);
  if (lands.length < cost) return false;
  for (const land of lands.slice(0, cost)) land.tapped = true;
  return true;
}

export function keywordKey(keyword) {
  return String(keyword || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function unitHasKeyword(unit, keyword) {
  const wanted = keywordKey(keyword);
  return Boolean(
    wanted &&
      Array.isArray(unit?.keywords) &&
      unit.keywords.some((candidate) => keywordKey(candidate) === wanted)
  );
}

export function canUnitAttack(unit, turn) {
  return Boolean(
    unit &&
      !unit.tapped &&
      !unit.hasAttacked &&
      finiteNumber(unit.currentLife) > 0 &&
      !unitHasKeyword(unit, "Défenseur") &&
      (finiteNumber(unit.createdTurn, -1) < finiteNumber(turn) || unitHasKeyword(unit, "Célérité"))
  );
}

export function buffUnits(units, attack, life) {
  const attackGain = finiteNumber(attack);
  const lifeGain = finiteNumber(life);
  for (const unit of Array.isArray(units) ? units : []) {
    unit.attack = finiteNumber(unit.attack) + attackGain;
    unit.maxLife = finiteNumber(unit.maxLife) + lifeGain;
    unit.currentLife = finiteNumber(unit.currentLife) + lifeGain;
  }
}

export function resolveCreatureCombat(attacker, target) {
  if (!attacker || !target) throw new TypeError("Le combat exige un attaquant et une cible.");
  const attackDamage = Math.max(0, finiteNumber(attacker.attack));
  const retaliationDamage = Math.max(0, finiteNumber(target.attack));

  target.currentLife = finiteNumber(target.currentLife) - attackDamage;
  attacker.currentLife = finiteNumber(attacker.currentLife) - retaliationDamage;
  if (attackDamage > 0 && unitHasKeyword(attacker, "Contact mortel")) target.currentLife = 0;
  if (retaliationDamage > 0 && unitHasKeyword(target, "Contact mortel")) attacker.currentLife = 0;

  return {
    attackDamage,
    retaliationDamage,
    attackerDied: attacker.currentLife <= 0,
    targetDied: target.currentLife <= 0
  };
}

export function partitionDeadUnits(board) {
  const living = [];
  const dead = [];
  for (const unit of Array.isArray(board) ? board : []) {
    (finiteNumber(unit?.currentLife) <= 0 ? dead : living).push(unit);
  }
  return { living, dead };
}

export function tickDelayedReturns(graveyard) {
  const ready = [];
  for (const card of Array.isArray(graveyard) ? graveyard : []) {
    if (card?.returnInTurns === null || card?.returnInTurns === undefined || card?.returnInTurns === "") continue;
    const remaining = Number(card?.returnInTurns);
    if (!Number.isFinite(remaining) || remaining < 0) continue;
    card.returnInTurns = Math.max(0, Math.trunc(remaining) - 1);
    if (card.returnInTurns === 0) ready.push(card);
  }
  return ready;
}

export function parasiteVengeanceDamage(board, damagePerParasite = 2) {
  const count = (Array.isArray(board) ? board : []).filter(
    (unit) => unit?.id === "parasite"
  ).length;
  return count * Math.max(0, finiteNumber(damagePerParasite, 2));
}

export function determineWinner(player, enemy) {
  const playerDead = finiteNumber(player?.life) <= 0;
  const enemyDead = finiteNumber(enemy?.life) <= 0;
  if (!playerDead && !enemyDead) return null;
  if (playerDead && enemyDead) return "draw";
  return playerDead ? "enemy" : "player";
}

export function makeTurnStartKey(matchId, turn, sideName) {
  return `${String(matchId || "none")}:${Math.max(0, Math.trunc(finiteNumber(turn)))}:${String(sideName || "none")}`;
}

export function validateGameState(game, { maxBoard = 7 } = {}) {
  const errors = [];
  if (!game || typeof game !== "object") return ["Etat de jeu absent."];

  const seen = new Set();
  for (const sideName of ["player", "enemy"]) {
    const side = game[sideName];
    if (!side) {
      errors.push(`${sideName}: côté absent.`);
      continue;
    }
    if (!Number.isFinite(Number(side.life))) errors.push(`${sideName}: points de vie invalides.`);
    for (const zone of ["deck", "hand", "board", "lands", "graveyard", "exile"]) {
      if (!Array.isArray(side[zone])) {
        errors.push(`${sideName}.${zone}: zone invalide.`);
        continue;
      }
      if (zone === "board" && side[zone].length > maxBoard) {
        errors.push(`${sideName}.board: ${side[zone].length}/${maxBoard} créatures.`);
      }
      for (const card of side[zone]) {
        if (!card || typeof card !== "object") {
          errors.push(`${sideName}.${zone}: carte invalide.`);
          continue;
        }
        if (card.uid) {
          if (seen.has(card.uid)) errors.push(`UID dupliqué: ${card.uid}.`);
          seen.add(card.uid);
        }
        if (zone === "board") {
          for (const stat of ["attack", "maxLife", "currentLife"]) {
            if (!Number.isFinite(Number(card[stat]))) errors.push(`${card.id || card.uid}.${stat}: valeur invalide.`);
          }
        }
      }
    }
  }
  return errors;
}
