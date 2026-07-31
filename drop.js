// =====================================================================
// Spellaho - Systeme de rarete et de drop
// ---------------------------------------------------------------------
// SOURCE UNIQUE des probabilites. Aucun taux ne doit etre redefini
// ailleurs dans le projet : tout passe par DROP_CONFIG.
//
// Principe directeur : la rarete est tiree AVANT la carte. La carte est
// ensuite choisie uniformement parmi celles de cette rarete. Une rarete
// qui contient 30 cartes n'est donc pas plus probable qu'une rarete qui
// n'en contient que 3 - c'est le defaut classique des tables de butin
// qui tirent directement dans un pool global.
//
// Les poids sont des ENTIERS sur une base de 10 000 : la somme est
// verifiee exactement, sans erreur d'arrondi flottant.
// =====================================================================

export const RARITY_SCALE = 10000;

export const RARITIES = {
  commune: { id: "commune", label: "Commune", rank: 0, color: "#a8aeb3" },
  peuCommune: { id: "peuCommune", label: "Peu commune", rank: 1, color: "#69b977" },
  rare: { id: "rare", label: "Rare", rank: 2, color: "#61bce8" },
  epique: { id: "epique", label: "Épique", rank: 3, color: "#9d6cbd" },
  legendaire: { id: "legendaire", label: "Légendaire", rank: 4, color: "#e2b75e" }
};

export const DROP_CONFIG = {
  // Poids sur 10 000. Justification de la repartition :
  //  - commune 60 %   : majoritaire, ~3 cartes sur 5 par booster ;
  //  - peuCommune 25 %: apparait a chaque booster ou presque ;
  //  - rare 10 %      : environ une carte sur deux boosters ;
  //  - epique 4 %     : une carte toutes les 5 boosters ;
  //  - legendaire 1 % : une carte tous les 20 boosters, reste un evenement.
  weights: {
    commune: 6000,
    peuCommune: 2500,
    rare: 1000,
    epique: 400,
    legendaire: 100
  },

  booster: {
    size: 5,
    // Un emplacement garanti "peuCommune ou mieux" : evite le booster
    // integralement commun, tres punitif en ressenti. Ce plancher modifie
    // les taux effectifs par rapport aux taux bruts - voir la simulation.
    guaranteedFloor: { slot: 4, minRank: 1 }
  },

  // Filets de securite. Desactivables sans toucher au reste du systeme.
  //
  // Calibrage : un pity doit rester un filet, pas une source. Le seuil est
  // choisi tres au-dela de l'esperance du tirage naturel, sinon il gonfle
  // le taux effectif. Avec E[intervalle] = (1-(1-p)^N)/p :
  //  - legendaire p=1 %, N=250  -> 1.09 % effectif (+0.09 pt) ;
  //    a N=100 on obtenait 1.58 % effectif, soit +58 % : inacceptable.
  //  - rare+ p=15 %, N=25       -> 15.3 % effectif (+0.3 pt).
  pity: {
    enabled: true,
    // Apres N tirages sans rare ou mieux, le tirage suivant est force.
    rareAfter: 25,
    // Apres N tirages sans legendaire, le tirage suivant est force.
    legendaryAfter: 250
  }
};

// --- Verification d'integrite -----------------------------------------

// Appelee au chargement : une somme fausse est une erreur de config, pas
// une situation a rattraper silencieusement en cours de partie.
export function assertWeightsValid(config = DROP_CONFIG) {
  const entries = Object.entries(config.weights);
  const unknown = entries.filter(([id]) => !RARITIES[id]).map(([id]) => id);
  if (unknown.length > 0) {
    throw new Error(`Rarete inconnue dans DROP_CONFIG.weights : ${unknown.join(", ")}`);
  }
  const missing = Object.keys(RARITIES).filter((id) => !(id in config.weights));
  if (missing.length > 0) {
    throw new Error(`Rarete sans poids : ${missing.join(", ")}`);
  }
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total !== RARITY_SCALE) {
    throw new Error(`Somme des poids = ${total}, attendu ${RARITY_SCALE} (soit 100 %).`);
  }
  return true;
}

assertWeightsValid();

// Probabilites theoriques exactes, en pourcentage.
export function theoreticalRates(config = DROP_CONFIG) {
  const rates = {};
  for (const [id, weight] of Object.entries(config.weights)) {
    rates[id] = (weight / RARITY_SCALE) * 100;
  }
  return rates;
}

// --- Generateur pseudo-aleatoire reproductible ------------------------

// mulberry32 : rapide, deterministe a graine egale, suffisant pour du
// butin. Permet de rejouer exactement une simulation.
export function createRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Tirage ------------------------------------------------------------

export function createPityState() {
  return { sinceRare: 0, sinceLegendary: 0 };
}

// Tirage brut d'une rarete, sans pity ni plancher.
function rollRawRarity(rng, config) {
  const roll = Math.floor(rng() * RARITY_SCALE);
  let cursor = 0;
  for (const [id, weight] of Object.entries(config.weights)) {
    cursor += weight;
    if (roll < cursor) return id;
  }
  // Inatteignable si assertWeightsValid passe ; filet defensif.
  return "commune";
}

// Re-tirage contraint a un rang minimal, en respectant les poids relatifs
// des raretes eligibles (on ne force pas systematiquement la plus basse).
function rollAtLeast(rng, config, minRank) {
  const eligible = Object.entries(config.weights).filter(
    ([id]) => RARITIES[id].rank >= minRank
  );
  const total = eligible.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return "commune";
  const roll = Math.floor(rng() * total);
  let cursor = 0;
  for (const [id, weight] of eligible) {
    cursor += weight;
    if (roll < cursor) return id;
  }
  return eligible[eligible.length - 1][0];
}

// Tirage complet : pity, puis plancher eventuel, puis tirage brut.
export function rollRarity(rng, pity = null, config = DROP_CONFIG, { minRank = 0 } = {}) {
  let rarityId;

  if (pity && config.pity.enabled && pity.sinceLegendary + 1 >= config.pity.legendaryAfter) {
    rarityId = "legendaire";
  } else if (pity && config.pity.enabled && pity.sinceRare + 1 >= config.pity.rareAfter) {
    rarityId = rollAtLeast(rng, config, Math.max(2, minRank));
  } else if (minRank > 0) {
    rarityId = rollAtLeast(rng, config, minRank);
  } else {
    rarityId = rollRawRarity(rng, config);
  }

  if (pity) {
    const rank = RARITIES[rarityId].rank;
    pity.sinceRare = rank >= 2 ? 0 : pity.sinceRare + 1;
    pity.sinceLegendary = rank >= 4 ? 0 : pity.sinceLegendary + 1;
  }
  return rarityId;
}

// --- Derivation de rarete ---------------------------------------------

// Les donnees de cartes actuelles n'ont pas de champ `rarity`. Plutot que
// de les modifier, on derive une rarete depuis ce qui existe deja. Le jour
// ou un champ `rarity` sera ajoute aux JSON, il suffira de passer un autre
// `resolve` a buildLootTable : cette fonction devient alors le repli.
// Les seuils de cout sont regles pour que l'effectif de chaque rarete
// DECROISSE avec son rang. Sans cela, une carte "rare" individuelle
// sortirait plus souvent qu'une commune : 10 % partages entre 7 cartes
// battent 60 % partages entre 53. Le nombre de cartes doit suivre la
// hierarchie, sinon la rarete percue s'inverse.
export function inferRarity(card) {
  const copies = card.deckCopies ?? 4;
  if (card.divine && copies === 1) return "legendaire";
  if (card.divine) return "epique";
  if (copies === 1) return "epique";
  const cost = Number(card.cost) || 0;
  if (cost >= 5) return "rare";
  if (cost >= 3) return "peuCommune";
  return "commune";
}

// --- Tables de butin ---------------------------------------------------

// Regroupe un pool de cartes par rarete. `resolve` permet de brancher
// n'importe quel champ source (card.rarity, card.tier, ...) sans imposer
// de format aux donnees existantes.
export function buildLootTable(cards, resolve = (card) => card.rarity) {
  const table = {};
  for (const id of Object.keys(RARITIES)) table[id] = [];
  for (const card of cards) {
    const id = resolve(card);
    if (table[id]) table[id].push(card);
  }
  return table;
}

// Raretes reellement pourvues : on ne tire jamais dans un seau vide.
function availableRarities(table) {
  return Object.keys(table).filter((id) => table[id].length > 0);
}

// Tire une carte : rarete d'abord, carte ensuite, uniformement.
export function drawCard(table, rng, pity = null, config = DROP_CONFIG, options = {}) {
  const available = availableRarities(table);
  if (available.length === 0) return null;

  let rarityId = rollRarity(rng, pity, config, options);
  // Rarete vide : on retombe sur la rarete pourvue la plus proche vers le
  // bas, puis vers le haut. Aucune carte ne devient inatteignable.
  if (!table[rarityId] || table[rarityId].length === 0) {
    const wanted = RARITIES[rarityId].rank;
    const sorted = available
      .slice()
      .sort((a, b) =>
        Math.abs(RARITIES[a].rank - wanted) - Math.abs(RARITIES[b].rank - wanted) ||
        RARITIES[a].rank - RARITIES[b].rank);
    rarityId = sorted[0];
  }
  const pool = table[rarityId];
  const card = pool[Math.floor(rng() * pool.length)];
  return { card, rarity: rarityId };
}

// Ouvre un booster complet en appliquant le plancher garanti.
export function openBooster(table, rng, pity = null, config = DROP_CONFIG) {
  const { size, guaranteedFloor } = config.booster;
  const results = [];
  for (let slot = 0; slot < size; slot += 1) {
    const minRank = guaranteedFloor && slot === guaranteedFloor.slot ? guaranteedFloor.minRank : 0;
    const drawn = drawCard(table, rng, pity, config, { minRank });
    if (drawn) results.push(drawn);
  }
  return results;
}

// Fabrique un systeme pret a l'emploi : etat de pity encapsule.
export function createDropSystem(cards, { seed, resolve, config = DROP_CONFIG } = {}) {
  const table = buildLootTable(cards, resolve);
  const rng = createRng(seed);
  const pity = createPityState();
  return {
    table,
    pity,
    config,
    draw: () => drawCard(table, rng, pity, config),
    openBooster: () => openBooster(table, rng, pity, config),
    rates: () => theoreticalRates(config)
  };
}
