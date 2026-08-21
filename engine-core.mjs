export function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizedCost(card) {
  return Math.max(0, Math.trunc(finiteNumber(card?.cost)));
}

// Part du coût qui doit être payée dans la couleur de la carte. Au-delà,
// n'importe quel terrain convient. Sans ce plafond, une carte de coût 5
// exigeait 5 terrains de sa propre couleur, soit 20 % d'un deck bicolore
// à 12+12 terrains : mesuré sur 20 000 parties par deck, la moitié des
// tours se passait sans jouer une seule carte et les cartes à 6 ou plus
// ne sortaient jamais.
export const MAX_COLORED_PIPS = 2;

// Les cinq couleurs payables. « Incolore » et « Multicolore » désignent
// l'identité d'une carte, jamais une couleur de mana.
export const MANA_COLORS = ["Blanc", "Bleu", "Noir", "Rouge", "Vert"];

// Coût d'une carte, sous la forme utilisée partout ailleurs :
//   colored : [[couleur, nombre], ...] mana qui exige cette couleur
//   generic : mana payable avec n'importe quelle couleur
//   total   : somme des deux, c'est-à-dire le nombre de mana à dépenser
// C'est LA fonction de référence : données, moteur de paiement, rendu de la
// carte, fiche détaillée et messages d'erreur en dérivent tous. Aucune autre
// ne doit recalculer un coût.
export function manaRequirements(card) {
  if (!card) return null;

  if (card.manaCost && typeof card.manaCost === "object") {
    const colored = MANA_COLORS.map((family) => [
      family,
      Math.max(0, Math.trunc(finiteNumber(card.manaCost[family])))
    ]).filter(([, amount]) => amount > 0);
    const coloredTotal = colored.reduce((total, [, amount]) => total + amount, 0);
    const declaredGeneric = Math.max(0, Math.trunc(finiteNumber(card.manaCost.generic)));
    // `cost` reste la valeur d'équilibrage : le coût déclaré ne peut pas
    // rendre une carte moins chère que son coût total annoncé.
    const generic = Math.max(declaredGeneric, normalizedCost(card) - coloredTotal);

    return { colored, generic, total: coloredTotal + generic };
  }

  // Cartes sans exigence déclarée : le plafond leur tient lieu de règle.
  const total = normalizedCost(card);
  if (!card.family || !MANA_COLORS.includes(card.family)) return { colored: [], generic: total, total };
  const coloredAmount = Math.min(MAX_COLORED_PIPS, total);
  return {
    colored: coloredAmount > 0 ? [[card.family, coloredAmount]] : [],
    generic: total - coloredAmount,
    total
  };
}

// Coût déclaré tel qu'il devrait figurer dans les données, pour vérifier que
// `data/*.json` dit exactement ce que le moteur applique.
export function manaCostRecord(card) {
  const requirements = manaRequirements(card);
  if (!requirements) return null;
  const record = {};
  for (const [family, amount] of requirements.colored) record[family] = amount;
  record.generic = requirements.generic;
  return record;
}

// Jetons à dessiner, dans l'ordre de lecture : les couleurs obligatoires
// puis, s'il en reste, un seul jeton générique portant son nombre.
// Exemple : 2 Blanc + 1 générique -> [Blanc][Blanc][1]
export function manaCostTokens(card) {
  const requirements = manaRequirements(card);
  if (!requirements) return [];
  const tokens = [];
  for (const [family, amount] of requirements.colored) {
    for (let index = 0; index < amount; index += 1) tokens.push({ type: "color", family });
  }
  if (requirements.generic > 0) tokens.push({ type: "generic", amount: requirements.generic });
  return tokens;
}

// Phrase de la fiche détaillée. Elle décrit la même règle que le paiement.
export function describeManaCost(card) {
  const requirements = manaRequirements(card);
  if (!requirements) return "";
  if (requirements.total === 0) return "Gratuit : aucun mana à dépenser.";
  const parts = requirements.colored.map(
    ([family, amount]) =>
      `${amount} mana${amount > 1 ? "s" : ""} ${family.toLowerCase()}${amount > 1 ? "s" : ""}`
  );
  if (requirements.generic > 0) {
    parts.push(
      `${requirements.generic} mana${requirements.generic > 1 ? "s" : ""} de n'importe quelle couleur`
    );
  }
  return `Nécessite ${parts.join(" et ")}.`;
}

// --- Production des terrains -----------------------------------------
// `manaProduction` décrit ce qu'un terrain rend quand on l'engage :
//   mode "choice" : `amount` mana, tous de UNE couleur choisie dans `colors`
//   mode "all"    : un mana de CHAQUE couleur de `colors`, simultanément
// Les anciens champs `family` / `families` / `energy` restent lus en repli
// pour qu'aucune donnée non migrée ne change de comportement.
export function landProduction(land) {
  const declared = land?.manaProduction;
  if (declared && typeof declared === "object") {
    const colors = (Array.isArray(declared.colors) ? declared.colors : []).filter((color) =>
      MANA_COLORS.includes(color)
    );
    if (colors.length > 0) {
      const mode = declared.mode === "all" ? "all" : "choice";
      const amount =
        mode === "all" ? colors.length : Math.max(1, Math.trunc(finiteNumber(declared.amount, 1)));
      return { mode, colors, amount };
    }
  }

  const heritees = Array.isArray(land?.families) && land.families.length > 0
    ? land.families
    : land?.family
      ? [land.family]
      : [];
  const colors = heritees.filter((color) => MANA_COLORS.includes(color));
  return { mode: "choice", colors, amount: Math.max(1, Math.trunc(finiteNumber(land?.energy, 1))) };
}

// Couleurs qu'un terrain sait produire.
export function landFamilies(land) {
  return landProduction(land).colors;
}

export function landProduces(land, family) {
  return landProduction(land).colors.includes(family);
}

// Quantité totale de mana rendue par un terrain engagé.
export function landEnergy(land) {
  const production = landProduction(land);
  return production.mode === "all" ? production.colors.length : production.amount;
}

// Jetons de production, avec le séparateur qui dit la règle :
//   "ou"  -> une seule de ces couleurs, au choix
//   "et"  -> toutes ces couleurs à la fois
export function landProductionTokens(land) {
  const { mode, colors, amount } = landProduction(land);
  if (colors.length === 0) return { separator: "et", tokens: [] };
  if (mode === "all") {
    return { separator: "et", tokens: colors.map((family) => ({ type: "color", family })) };
  }
  if (colors.length === 1) {
    return {
      separator: "et",
      tokens: Array.from({ length: amount }, () => ({ type: "color", family: colors[0] }))
    };
  }
  // Au-delà de deux couleurs, aligner un jeton par couleur déborderait du
  // cadre et ne se lirait plus : le prisme dit « une couleur au choix »,
  // et le texte de la carte énumère lesquelles.
  if (colors.length > 2) {
    return { separator: "ou", tokens: [{ type: "color", family: "Multicolore" }], colors, amount };
  }
  return { separator: "ou", tokens: colors.map((family) => ({ type: "color", family })), colors, amount };
}

export function describeLandProduction(land) {
  const { mode, colors, amount } = landProduction(land);
  if (colors.length === 0) return "Ce terrain ne produit aucun mana.";
  const noms = colors.map((color) => color.toLowerCase());
  if (mode === "all") {
    return `Engagé, il produit en même temps 1 mana ${noms.join(" et 1 mana ")}.`;
  }
  if (colors.length === 1) {
    return amount > 1
      ? `Engagé, il produit ${amount} manas ${noms[0]}s, tous en même temps.`
      : `Engagé, il produit 1 mana ${noms[0]}.`;
  }
  const liste = `${noms.slice(0, -1).join(", ")} ou ${noms.at(-1)}`;
  return `Engagé, il produit ${amount} mana${amount > 1 ? "s" : ""} d'une seule couleur, au choix : ${liste}.`;
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

// `onFatigue` permet à l'appelant d'appliquer lui-même la perte de vie, pour
// la faire passer par son point de mutation unique. Sans lui, la fatigue
// écrivait directement dans `side.life` : la mort par bibliothèque vide
// échappait alors au constat de fin de partie.
export function drawFromDeck(side, amount, { fatigueDamage = 1, onFatigue = null } = {}) {
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
      if (typeof onFatigue === "function") onFatigue(damage);
      else side.life -= damage;
      events.push({ type: "fatigue", damage });
    }
  }

  return events;
}

export function selectHighestCostCards(cards, amount = 2) {
  const count = Math.max(0, Math.trunc(finiteNumber(amount)));
  return [...(Array.isArray(cards) ? cards : [])]
    .sort(
      (a, b) =>
        normalizedCost(b) - normalizedCost(a) ||
        String(a?.id || "").localeCompare(String(b?.id || "")) ||
        String(a?.uid || "").localeCompare(String(b?.uid || ""))
    )
    .slice(0, count);
}

// Tous les terrains non engagés comptent : seule une part plafonnée du coût
// exige la couleur de la carte, le reste se paie avec n'importe lequel.
export function untappedLandsForCard(side) {
  const lands = Array.isArray(side?.lands) ? side.lands : [];
  return lands.filter((land) => !land?.tapped);
}

// Souplesse d'un terrain : plus il est capable de choses, plus on cherche à
// le garder dégagé. On dépense donc en priorité les terrains les moins
// polyvalents, puis les plus petits producteurs — inutile de brûler une
// capitale à 2 mana pour un coût de 1.
function souplesse(land) {
  const production = landProduction(land);
  return production.colors.length * 10 + landEnergy(land);
}

// Répartit le coût sur les terrains dégagés et renvoie ceux à engager, ou
// `null` si la carte n'est pas payable.
//
// Règles appliquées, dans cet ordre :
//   1. les couleurs obligatoires sont servies avant le générique ;
//   2. un terrain « au choix » ne rend qu'UNE couleur, même s'il en propose
//      plusieurs : il ne peut pas payer Blanc ET Bleu à lui seul ;
//   3. les terrains mono-couleur passent avant les terrains souples ;
//   4. le reste du coût est payé par les terrains restants ;
//   5. on n'engage jamais plus de terrains que nécessaire — la recherche
//      démarre au nombre minimal et ne s'élargit qu'en cas d'échec.
export function paymentPlan(side, card) {
  const requirements = manaRequirements(card);
  if (!requirements) return null;
  if (requirements.total === 0) return [];

  // Ordre de dépense : le premier terrain de la liste est celui qu'on
  // sacrifie le plus volontiers.
  const candidats = untappedLandsForCard(side)
    .map((land) => ({ land, production: landProduction(land), energie: landEnergy(land) }))
    .sort((a, b) => souplesse(a.land) - souplesse(b.land));

  const disponible = candidats.reduce((total, entree) => total + entree.energie, 0);
  if (disponible < requirements.total) return null;

  // Reste à couvrir. Le générique accepte n'importe quelle couleur, il est
  // donc traité comme un seau à part rempli par les surplus.
  const besoins = new Map(requirements.colored);

  // Ce qu'un terrain engagé peut apporter, selon la couleur choisie.
  const apports = (entree) => {
    const { mode, colors } = entree.production;
    if (mode === "all") return [colors.map((family) => [family, 1])];
    return colors.map((family) => [[family, entree.energie]]);
  };

  let noeuds = 0;
  const LIMITE_NOEUDS = 40000;

  // Recherche en profondeur bornée à `plafond` terrains. Comme les candidats
  // sont triés du moins souple au plus souple et qu'on essaie « engager »
  // avant « laisser », la première solution trouvée est aussi celle qui
  // préserve le mieux les terrains polyvalents.
  const chercher = (index, restants, generique, plafond, retenus) => {
    if (noeuds > LIMITE_NOEUDS) return null;
    noeuds += 1;
    let manqueColore = 0;
    for (const valeur of restants.values()) manqueColore += valeur;
    if (manqueColore === 0 && generique <= 0) return retenus;
    if (retenus.length >= plafond) return null;
    if (index >= candidats.length) return null;

    // Élagage : ce qui reste ne suffira jamais.
    let reste = 0;
    for (let i = index; i < candidats.length; i += 1) reste += candidats[i].energie;
    if (reste < manqueColore + Math.max(0, generique)) return null;

    const entree = candidats[index];
    for (const apport of apports(entree)) {
      const suivants = new Map(restants);
      let surplus = 0;
      let utile = false;
      for (const [family, quantite] of apport) {
        const besoin = suivants.get(family) || 0;
        const pris = Math.min(besoin, quantite);
        if (pris > 0) {
          utile = true;
          if (besoin - pris === 0) suivants.delete(family);
          else suivants.set(family, besoin - pris);
        }
        surplus += quantite - pris;
      }
      if (surplus > 0 && generique > 0) utile = true;
      if (!utile) continue;
      const solution = chercher(index + 1, suivants, generique - surplus, plafond, [...retenus, entree.land]);
      if (solution) return solution;
    }

    return chercher(index + 1, restants, generique, plafond, retenus);
  };

  // On commence par le nombre minimal de terrains théoriquement suffisant.
  const plafondMin = Math.max(1, Math.ceil(requirements.total / Math.max(1, candidats[0]?.energie || 1)));
  for (let plafond = plafondMin; plafond <= candidats.length; plafond += 1) {
    noeuds = 0;
    const solution = chercher(0, new Map(besoins), requirements.generic, plafond, []);
    if (solution) return solution;
  }
  return null;
}

export function canPayCard(side, card) {
  return paymentPlan(side, card) !== null;
}

export function payCardCost(side, card) {
  const lands = paymentPlan(side, card);
  if (!lands) return false;
  for (const land of lands) land.tapped = true;
  return true;
}

// Terrains qui seront engagés, pour l'annoncer au joueur avant qu'il joue.
export function describePaymentPlan(side, card) {
  const lands = paymentPlan(side, card);
  if (!lands) return "";
  if (lands.length === 0) return "Aucun terrain à engager.";
  return `Engagera : ${lands.map((land) => land.name).join(", ")}.`;
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

  // Invariant central : un héros à 0 point de vie ou moins ferme la partie.
  // Tant que la phase n'est pas terminale, le jeu accepterait encore une
  // action, une pioche ou un soin — et le mort reviendrait à la vie.
  const winner = determineWinner(game.player, game.enemy);
  if (winner && game.phase !== "over") {
    errors.push(
      `Un héros est à ${winner === "enemy" ? finiteNumber(game.player?.life) : finiteNumber(game.enemy?.life)} PV mais la partie est en phase "${game.phase}" au lieu de "over".`
    );
  }

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
