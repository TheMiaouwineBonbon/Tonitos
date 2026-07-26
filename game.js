import {
  awardAccount,
  createAccount,
  getAccount,
  getActiveAccountId,
  getGrade,
  getLevelProgress,
  loadAccounts,
  setActiveAccountId,
  updateAccount
} from "./progression.js?v=20260726-1";

const COLORS = ["Blanc", "Bleu", "Noir", "Rouge", "Vert"];
const PHASES = {
  MAIN_1: "main1",
  COMBAT: "combat",
  BLOCK: "block",
  MAIN_2: "main2",
  OVER: "over"
};
const PLAYER_ID_KEY = "spellaho-player-id";
const LEGACY_PLAYER_ID_KEY = "tonitos-player-id";
const storedPlayerId = sessionStorage.getItem(PLAYER_ID_KEY) || sessionStorage.getItem(LEGACY_PLAYER_ID_KEY) || "";
if (storedPlayerId && !sessionStorage.getItem(PLAYER_ID_KEY)) {
  sessionStorage.setItem(PLAYER_ID_KEY, storedPlayerId);
}

const state = {
  cards: [],
  lands: [],
  spells: [],
  player: null,
  enemy: null,
  selectedBlockerId: null,
  selectedAttackerId: null,
  currentTurn: "player",
  phase: PHASES.MAIN_1,
  turn: 1,
  matchId: "",
  winner: null,
  log: [],
  detailContext: null,
  activeAccountId: getActiveAccountId(),
  enemyAccountId: "",
  progressAwarded: false,
  lastProgressAwards: [],
  handoffPending: false,
  mobileView: "board",
  mode: "pve",
  playerDeckId: "blanc-vert",
  enemyDeckId: "rouge-noir",
  started: false,
  network: {
    enabled: false,
    code: "1234",
    playerId: storedPlayerId,
    slot: null,
    version: 0,
    transport: null,
    pollTimer: null,
    publishTimer: null,
    peer: null,
    connection: null,
    peerRoom: null,
    suppressPublish: false,
    pending: false,
    dirty: false
  }
};

const els = {
  playerLife: document.querySelector("#player-life"),
  enemyLife: document.querySelector("#enemy-life"),
  playerEnergy: document.querySelector("#player-energy"),
  enemyEnergy: document.querySelector("#enemy-energy"),
  playerDeck: document.querySelector("#player-deck"),
  enemyDeck: document.querySelector("#enemy-deck"),
  playerGraveyard: document.querySelector("#player-graveyard"),
  enemyGraveyard: document.querySelector("#enemy-graveyard"),
  playerExile: document.querySelector("#player-exile"),
  enemyExile: document.querySelector("#enemy-exile"),
  playerLandsCount: document.querySelector("#player-lands-count"),
  enemyLandsCount: document.querySelector("#enemy-lands-count"),
  playerName: document.querySelector("#player-name"),
  enemyName: document.querySelector("#enemy-name"),
  playerCaption: document.querySelector("#player-caption"),
  enemyCaption: document.querySelector("#enemy-caption"),
  playerHero: document.querySelector(".player-hero"),
  enemyHero: document.querySelector(".enemy-hero"),
  handCount: document.querySelector("#hand-count"),
  handTitle: document.querySelector("#hand-title"),
  turnPill: document.querySelector("#turn-pill"),
  playerHand: document.querySelector("#player-hand"),
  playerBoard: document.querySelector("#player-board"),
  enemyBoard: document.querySelector("#enemy-board"),
  effectLayer: document.querySelector("#effect-layer"),
  playerLands: document.querySelector("#player-lands"),
  enemyLands: document.querySelector("#enemy-lands"),
  gallery: document.querySelector("#card-gallery"),
  log: document.querySelector("#combat-log"),
  actionHint: document.querySelector("#action-hint"),
  newGame: document.querySelector("#new-game"),
  endTurn: document.querySelector("#end-turn"),
  attackHero: document.querySelector("#attack-hero"),
  clearLog: document.querySelector("#clear-log"),
  cardModal: document.querySelector("#card-modal"),
  cardModalCard: document.querySelector("#card-modal-card"),
  cardModalClose: document.querySelector("#card-modal-close"),
  cardModalAction: document.querySelector("#card-modal-action"),
  cardModalFamily: document.querySelector("#card-modal-family"),
  cardModalTitle: document.querySelector("#card-modal-title"),
  cardModalType: document.querySelector("#card-modal-type"),
  cardModalStats: document.querySelector("#card-modal-stats"),
  cardModalAbility: document.querySelector("#card-modal-ability"),
  cardModalFlavor: document.querySelector("#card-modal-flavor"),
  startMenu: document.querySelector("#start-menu"),
  startGame: document.querySelector("#start-game"),
  modeSelect: document.querySelector("#mode-select"),
  playerNameInput: document.querySelector("#player-name-input"),
  enemyNameInput: document.querySelector("#enemy-name-input"),
  playerAvatarSelect: document.querySelector("#player-avatar-select"),
  enemyAvatarSelect: document.querySelector("#enemy-avatar-select"),
  playerAvatarPreview: document.querySelector("#player-avatar-preview"),
  enemyAvatarPreview: document.querySelector("#enemy-avatar-preview"),
  playerDeckSelect: document.querySelector("#player-deck-select"),
  enemyDeckSelect: document.querySelector("#enemy-deck-select"),
  roomCodeInput: document.querySelector("#room-code-input"),
  menuDeckSummary: document.querySelector("#menu-deck-summary"),
  onlineStatus: document.querySelector("#online-status"),
  accountSelect: document.querySelector("#account-select"),
  accountCreateToggle: document.querySelector("#account-create-toggle"),
  accountSave: document.querySelector("#account-save"),
  accountCreateForm: document.querySelector("#account-create-form"),
  accountNameInput: document.querySelector("#account-name-input"),
  accountAvatarSelect: document.querySelector("#account-avatar-select"),
  accountCreateCancel: document.querySelector("#account-create-cancel"),
  accountSummary: document.querySelector("#account-summary"),
  accountGradeImage: document.querySelector("#account-grade-image"),
  enemyAccountControl: document.querySelector("#enemy-account-control"),
  enemyAccountSelect: document.querySelector("#enemy-account-select"),
  topbarAccount: document.querySelector("#topbar-account"),
  topbarGradeImage: document.querySelector("#topbar-grade-image"),
  topbarAccountName: document.querySelector("#topbar-account-name"),
  topbarAccountLevel: document.querySelector("#topbar-account-level"),
  cardCountSummary: document.querySelector("#card-count-summary"),
  deckAudit: document.querySelector("#deck-audit"),
  boardStage: document.querySelector(".board-stage"),
  pileModal: document.querySelector("#pile-modal"),
  pileModalGrid: document.querySelector("#pile-modal-grid"),
  pileModalTitle: document.querySelector("#pile-modal-title"),
  pileModalEmpty: document.querySelector("#pile-modal-empty"),
  pileModalClose: document.querySelector("#pile-modal-close"),
  cardPreview: document.querySelector("#card-preview"),
  gameOver: document.querySelector("#game-over"),
  gameOverTitle: document.querySelector("#game-over-title"),
  gameOverText: document.querySelector("#game-over-text"),
  gameOverXp: document.querySelector("#game-over-xp"),
  gameOverRematch: document.querySelector("#game-over-rematch"),
  gameOverMenu: document.querySelector("#game-over-menu"),
  turnHandoff: document.querySelector("#turn-handoff"),
  turnHandoffTitle: document.querySelector("#turn-handoff-title"),
  turnHandoffText: document.querySelector("#turn-handoff-text"),
  turnHandoffAvatar: document.querySelector("#turn-handoff-avatar"),
  turnHandoffConfirm: document.querySelector("#turn-handoff-confirm"),
  mobileViewButtons: [...document.querySelectorAll("[data-mobile-view]")]
};

const MAX_BOARD = 7;
const STARTING_LIFE = 20;
const MAX_LIFE = 30;
const STARTING_HAND = 7;
const DECK_SIZE = 60;
const DECK_LANDS = 24;
const DECK_SPELLS = 14;
const MAX_NONLAND_COPIES = 4;
const ONLINE_ROOM_CODE = "1234";
const ONLINE_POLL_MS = 1000;
const PEERJS_MODULE_URL = "https://cdn.jsdelivr.net/npm/peerjs@1.5.5/+esm";
const PLAYMATS = {
  player: "Images/Tapis de Jeu/Tapis de jeu Joueur.png",
  enemy: "Images/Tapis de Jeu/Taps de jeu Adversaire.png"
};
const DEFAULT_PROFILES = {
  player: {
    name: "Joueur 1",
    avatar: "Images/Marinéhote de Elturel.png"
  },
  enemy: {
    name: "Joueur 2",
    avatar: "Images/Noxis Drathis_sans_watermark.jpg"
  }
};
const DECKS = [
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
  }
];

init();

async function init() {
  if (!els.startMenu) return;
  const dataVersion = Date.now();
  const [cardsResponse, landsResponse, spellsResponse] = await Promise.all([
    fetch(`./data/cards.json?v=${dataVersion}`, { cache: "no-store" }),
    fetch(`./data/lands.json?v=${dataVersion}`, { cache: "no-store" }),
    fetch(`./data/spells.json?v=${dataVersion}`, { cache: "no-store" })
  ]);
  state.cards = (await cardsResponse.json()).map((card) => ({ ...card, kind: "creature" }));
  state.lands = await landsResponse.json();
  state.spells = (await spellsResponse.json()).map((card) => ({ ...card, kind: "spell" }));
  preloadImages();
  applyPlaymats();
  populateDeckMenu();
  populateAvatarMenu();
  initializeAccounts();
  renderGallery();
  renderDeckAudit();
  bindEvents();
  openStartMenu();
}

function applyPlaymats() {
  if (!els.boardStage) return;
  els.boardStage.style.setProperty("--playmat-player", cssUrl(PLAYMATS.player));
  els.boardStage.style.setProperty("--playmat-enemy", cssUrl(PLAYMATS.enemy));
}

function bindEvents() {
  els.newGame?.addEventListener("click", openStartMenu);
  els.startGame?.addEventListener("click", startGameFromMenu);
  els.modeSelect?.addEventListener("change", updateMenuSummary);
  els.playerDeckSelect?.addEventListener("change", updateMenuSummary);
  els.enemyDeckSelect?.addEventListener("change", updateMenuSummary);
  els.playerNameInput?.addEventListener("input", updateMenuSummary);
  els.enemyNameInput?.addEventListener("input", updateMenuSummary);
  els.playerAvatarSelect?.addEventListener("change", updateMenuSummary);
  els.enemyAvatarSelect?.addEventListener("change", updateMenuSummary);
  els.roomCodeInput?.addEventListener("input", updateMenuSummary);
  els.accountSelect?.addEventListener("change", selectActiveAccount);
  els.accountCreateToggle?.addEventListener("click", toggleAccountCreation);
  els.accountCreateCancel?.addEventListener("click", closeAccountCreation);
  els.accountCreateForm?.addEventListener("submit", createAccountFromMenu);
  els.accountSave?.addEventListener("click", saveActiveAccount);
  els.enemyAccountSelect?.addEventListener("change", selectEnemyAccount);
  els.endTurn?.addEventListener("click", advancePhase);
  els.attackHero?.addEventListener("click", attackHero);
  // Le commandant adverse est une cible cliquable quand un attaquant est choisi.
  els.enemyHero?.querySelector(".mat-zone--commander")?.addEventListener("click", () => {
    if (state.selectedAttackerId) attackHero();
  });
  els.clearLog?.addEventListener("click", () => {
    state.log = [];
    markOnlineDirty();
    render();
  });
  els.cardModalClose?.addEventListener("click", closeCardDetail);
  els.cardModalAction?.addEventListener("click", runDetailAction);
  els.gameOverRematch?.addEventListener("click", rematch);
  els.turnHandoffConfirm?.addEventListener("click", confirmTurnHandoff);
  for (const button of els.mobileViewButtons) {
    button.addEventListener("click", () => setMobileView(button.dataset.mobileView));
  }
  els.gameOverMenu?.addEventListener("click", () => {
    if (els.gameOver) els.gameOver.hidden = true;
    openStartMenu();
  });
  els.cardModal?.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-card-modal]")) closeCardDetail();
  });

  for (const button of document.querySelectorAll("[data-pile]")) {
    button.addEventListener("click", () => {
      const [sideName, zone] = button.dataset.pile.split(":");
      openPileViewer(sideName, zone);
    });
  }
  if (els.pileModalClose) els.pileModalClose.addEventListener("click", closePileViewer);
  if (els.pileModal) {
    els.pileModal.addEventListener("click", (event) => {
      if (event.target.matches("[data-close-pile-modal]")) closePileViewer();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (els.cardModal && !els.cardModal.hidden) closeCardDetail();
    else if (els.pileModal && !els.pileModal.hidden) closePileViewer();
  });
  window.addEventListener("resize", hideCardPreview);
  window.addEventListener("scroll", hideCardPreview, true);
  window.addEventListener("pointermove", onDragPointerMove);
  window.addEventListener("pointerup", onDragPointerUp);
  window.addEventListener("pointercancel", () => resetDrag());
}

function populateDeckMenu() {
  const selects = [els.playerDeckSelect, els.enemyDeckSelect].filter(Boolean);
  if (selects.length === 0) return;
  for (const select of selects) {
    select.innerHTML = "";
    for (const deck of DECKS) {
      const option = document.createElement("option");
      option.value = deck.id;
      option.textContent = deck.name;
      select.append(option);
    }
  }
  if (els.playerDeckSelect) els.playerDeckSelect.value = state.playerDeckId;
  if (els.enemyDeckSelect) els.enemyDeckSelect.value = state.enemyDeckId;
  updateMenuSummary();
}

function populateAvatarMenu() {
  const avatarCards = state.cards
    .filter((card) => card.image)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const selects = [els.playerAvatarSelect, els.enemyAvatarSelect, els.accountAvatarSelect].filter(Boolean);
  if (selects.length === 0) return;
  for (const select of selects) {
    select.innerHTML = "";
    for (const card of avatarCards) {
      const option = document.createElement("option");
      option.value = card.image;
      option.textContent = card.name;
      select.append(option);
    }
  }

  if (els.playerAvatarSelect) els.playerAvatarSelect.value = DEFAULT_PROFILES.player.avatar;
  if (els.enemyAvatarSelect) els.enemyAvatarSelect.value = DEFAULT_PROFILES.enemy.avatar;
  if (els.accountAvatarSelect) els.accountAvatarSelect.value = DEFAULT_PROFILES.player.avatar;
  updateMenuSummary();
}

function initializeAccounts() {
  const accounts = loadAccounts();
  if (state.activeAccountId && !accounts.some((account) => account.id === state.activeAccountId)) {
    state.activeAccountId = "";
    setActiveAccountId("");
  }
  refreshAccountMenus();
  if (state.activeAccountId) applyAccountToSide("player", state.activeAccountId);
  renderAccountSummary();
  renderTopbarAccount();
  setMobileView("board");
}

function refreshAccountMenus() {
  const accounts = loadAccounts();
  if (els.accountSelect) {
    els.accountSelect.innerHTML = '<option value="">Jouer sans profil</option>';
    for (const account of accounts) {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = `${account.name} · niveau ${account.level}`;
      els.accountSelect.append(option);
    }
    els.accountSelect.value = state.activeAccountId;
  }
  if (els.enemyAccountSelect) {
    els.enemyAccountSelect.innerHTML = '<option value="">Invité local</option>';
    for (const account of accounts) {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = `${account.name} · niveau ${account.level}`;
      els.enemyAccountSelect.append(option);
    }
    els.enemyAccountSelect.value = state.enemyAccountId;
  }
}

function selectActiveAccount() {
  state.activeAccountId = els.accountSelect?.value || "";
  setActiveAccountId(state.activeAccountId);
  if (state.activeAccountId) applyAccountToSide("player", state.activeAccountId);
  renderAccountSummary();
  renderTopbarAccount();
  updateMenuSummary();
}

function selectEnemyAccount() {
  state.enemyAccountId = els.enemyAccountSelect?.value || "";
  if (state.enemyAccountId) applyAccountToSide("enemy", state.enemyAccountId);
  updateMenuSummary();
}

function applyAccountToSide(sideName, accountId) {
  const account = getAccount(accountId);
  if (!account) return;
  const nameInput = sideName === "player" ? els.playerNameInput : els.enemyNameInput;
  const avatarSelect = sideName === "player" ? els.playerAvatarSelect : els.enemyAvatarSelect;
  if (nameInput) nameInput.value = account.name;
  if (avatarSelect && [...avatarSelect.options].some((option) => option.value === account.avatar)) {
    avatarSelect.value = account.avatar;
  }
  updateAvatarPreviews();
}

function toggleAccountCreation() {
  if (!els.accountCreateForm) return;
  els.accountCreateForm.hidden = !els.accountCreateForm.hidden;
  if (!els.accountCreateForm.hidden) {
    els.accountNameInput?.focus();
    if (els.accountAvatarSelect && els.playerAvatarSelect) {
      els.accountAvatarSelect.value = els.playerAvatarSelect.value;
    }
  }
}

function closeAccountCreation() {
  if (els.accountCreateForm) els.accountCreateForm.hidden = true;
}

function createAccountFromMenu(event) {
  event.preventDefault();
  const account = createAccount({
    name: els.accountNameInput?.value,
    avatar: els.accountAvatarSelect?.value || DEFAULT_PROFILES.player.avatar
  });
  state.activeAccountId = account.id;
  refreshAccountMenus();
  applyAccountToSide("player", account.id);
  closeAccountCreation();
  els.accountCreateForm?.reset();
  if (els.accountAvatarSelect) els.accountAvatarSelect.value = DEFAULT_PROFILES.player.avatar;
  renderAccountSummary();
  renderTopbarAccount();
  updateMenuSummary();
}

function saveActiveAccount() {
  if (!state.activeAccountId) {
    toggleAccountCreation();
    return;
  }
  updateAccount(state.activeAccountId, {
    name: els.playerNameInput?.value,
    avatar: els.playerAvatarSelect?.value
  });
  refreshAccountMenus();
  renderAccountSummary();
  renderTopbarAccount();
  updateMenuSummary();
}

function renderAccountSummary() {
  if (!els.accountSummary || !els.accountGradeImage) return;
  const account = getAccount(state.activeAccountId);
  if (!account) {
    els.accountSummary.innerHTML = "<span>Profil invité · progression non enregistrée</span>";
    els.accountGradeImage.src = "./Images/Grade/Niveau Débutant.png";
    els.accountGradeImage.alt = "Grade Débutant";
    if (els.accountSave) els.accountSave.disabled = true;
    return;
  }
  const progress = getLevelProgress(account.xp);
  const grade = getGrade(account.level);
  els.accountGradeImage.src = `./${grade.image}`;
  els.accountGradeImage.alt = `Grade ${grade.name}`;
  els.accountSummary.innerHTML = `
    <div class="account-summary-line">
      <strong>${escapeHtml(grade.name)} · niveau ${account.level}</strong>
      <span>${account.wins} V · ${account.losses} D · ${account.draws} N</span>
    </div>
    <div class="xp-track" role="progressbar" aria-label="Progression d'expérience" aria-valuemin="0" aria-valuemax="${progress.nextXp || 1}" aria-valuenow="${progress.currentXp}">
      <span style="width:${progress.percent}%"></span>
    </div>
    <small>${progress.nextXp ? `${progress.currentXp} / ${progress.nextXp} XP` : "Niveau maximum"}</small>
  `;
  if (els.accountSave) els.accountSave.disabled = false;
}

function renderTopbarAccount() {
  if (!els.topbarAccount) return;
  const account = getAccount(state.activeAccountId);
  els.topbarAccount.hidden = !account;
  if (!account) return;
  const grade = getGrade(account.level);
  els.topbarGradeImage.src = `./${grade.image}`;
  els.topbarGradeImage.alt = grade.name;
  els.topbarAccountName.textContent = account.name;
  els.topbarAccountLevel.textContent = `Niveau ${account.level} · ${grade.name}`;
}

function setMobileView(view = "board") {
  state.mobileView = ["board", "cards", "rules", "log"].includes(view) ? view : "board";
  document.body.dataset.mobileView = state.mobileView;
  for (const button of els.mobileViewButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.mobileView === state.mobileView));
  }
  hideCardPreview();
}

function openStartMenu() {
  if (!els.startMenu) return;
  els.startMenu.hidden = false;
  document.body.classList.add("menu-open");
  state.handoffPending = false;
  document.body.classList.remove("handoff-open");
  if (els.turnHandoff) els.turnHandoff.hidden = true;
  refreshAccountMenus();
  renderAccountSummary();
  updateMenuSummary();
}

function closeStartMenu() {
  if (!els.startMenu) return;
  els.startMenu.hidden = true;
  document.body.classList.remove("menu-open");
}

async function startGameFromMenu() {
  if (els.modeSelect.value === "online") {
    await joinOnlineRoom();
    return;
  }

  stopOnlineSync();
  newGame({
    mode: els.modeSelect.value,
    playerDeckId: els.playerDeckSelect.value,
    enemyDeckId: els.enemyDeckSelect.value,
    playerProfile: profileFromMenu("player"),
    enemyProfile: profileFromMenu("enemy")
  });
}

function updateMenuSummary() {
  if (!els.modeSelect || !els.playerDeckSelect || !els.enemyDeckSelect || !els.menuDeckSummary) return;
  const playerDeck = getDeckSpec(els.playerDeckSelect.value);
  const enemyDeck = getDeckSpec(els.enemyDeckSelect.value);
  const mode = els.modeSelect.value;
  const enemyLabel = mode === "pvp" || mode === "online" ? "Joueur 2" : "Adversaire IA";
  const isOnline = mode === "online";
  const playerComposition = getDeckComposition(playerDeck);
  const enemyComposition = getDeckComposition(enemyDeck);
  const roomCodeControl = els.roomCodeInput?.closest("label");
  if (els.enemyAccountControl) els.enemyAccountControl.hidden = mode !== "pvp";
  if (roomCodeControl) roomCodeControl.hidden = !isOnline;
  if (els.enemyNameInput) els.enemyNameInput.disabled = isOnline;
  if (els.enemyAvatarSelect) els.enemyAvatarSelect.disabled = isOnline;
  if (els.enemyDeckSelect) els.enemyDeckSelect.disabled = isOnline;
  updateAvatarPreviews();
  els.menuDeckSummary.innerHTML = `
    <strong>Format construit Spellaho</strong>
    <span>60 cartes exactes, 24 terrains et 4 exemplaires maximum par carte non-terrain.</span>
    <span>${escapeHtml(profileFromMenu("player").name)} : ${escapeHtml(playerDeck.shortName)} · ${playerComposition.creatures} créatures · ${playerComposition.spells} sorts.</span>
    <span>${enemyLabel} : ${escapeHtml(enemyDeck.shortName)} · ${enemyComposition.creatures} créatures · ${enemyComposition.spells} sorts.</span>
    <span>${isOnline ? `Salon en ligne : entre le code ${ONLINE_ROOM_CODE}, puis attends le second joueur.` : "Partie jouée sur cet écran."}</span>
  `;
  setOnlineStatus(isOnline ? "Code provisoire : 1234." : "");
}

function profileFromMenu(sideName) {
  const accountId = sideName === "player" ? state.activeAccountId : state.enemyAccountId;
  const source = sideName === "player"
    ? {
        name: els.playerNameInput?.value,
        avatar: els.playerAvatarSelect?.value
      }
    : {
        name: els.enemyNameInput?.value,
        avatar: els.enemyAvatarSelect?.value
      };
  return normalizeClientProfile(sideName, { ...source, accountId });
}

function updateAvatarPreviews() {
  if (els.playerAvatarPreview) {
    els.playerAvatarPreview.style.backgroundImage = cssUrl(profileFromMenu("player").avatar);
  }
  if (els.enemyAvatarPreview) {
    els.enemyAvatarPreview.style.backgroundImage = cssUrl(profileFromMenu("enemy").avatar);
  }
}

function normalizeClientProfile(sideName, profile = {}) {
  const fallback = DEFAULT_PROFILES[sideName];
  const account = profile.accountId ? getAccount(profile.accountId) : null;
  const level = account?.level || Math.max(1, Number(profile.level) || 1);
  const grade = getGrade(level);
  return {
    name: String(profile.name || fallback.name).trim().slice(0, 24) || fallback.name,
    avatar: profile.avatar || fallback.avatar,
    accountId: String(profile.accountId || ""),
    level,
    grade: grade.name
  };
}

function newGame(config = {}) {
  state.mode = config.mode || state.mode || "pve";
  state.playerDeckId = config.playerDeckId || state.playerDeckId || "blanc-vert";
  state.enemyDeckId = config.enemyDeckId || state.enemyDeckId || "rouge-noir";
  if (!config.preserveNetwork && state.mode !== "online") stopOnlineSync();
  state.player = createSide("player", getDeckSpec(state.playerDeckId), config.playerProfile);
  state.enemy = createSide("enemy", getDeckSpec(state.enemyDeckId), config.enemyProfile);
  state.selectedBlockerId = null;
  state.selectedAttackerId = null;
  state.currentTurn = "player";
  state.phase = PHASES.MAIN_1;
  state.turn = 1;
  state.matchId = config.matchId || crypto.randomUUID();
  state.winner = null;
  state.log = [];
  state.progressAwarded = false;
  state.lastProgressAwards = [];
  state.handoffPending = false;
  state.started = true;
  closeCardDetail();
  closeStartMenu();
  setMobileView("board");

  draw(state.player, STARTING_HAND);
  draw(state.enemy, STARTING_HAND);
  beginTurn(state.player, true);
  const modeLabel = state.mode === "online" ? "2 joueurs en ligne" : state.mode === "pvp" ? "2 joueurs local" : "1 joueur contre IA";
  logEvent(`Spellaho commence en mode ${modeLabel} : 20 points de vie, 7 cartes, un terrain par tour.`);
  render();
}

function createSide(side, deckSpec, profile = {}) {
  return {
    side,
    deckSpec,
    profile: normalizeClientProfile(side, profile),
    life: STARTING_LIFE,
    deck: shuffle(makeDeck(side, deckSpec)),
    hand: [],
    board: [],
    lands: [],
    graveyard: [],
    exile: [],
    landPlayed: false
  };
}

async function joinOnlineRoom() {
  const code = els.roomCodeInput.value.trim();
  if (code !== ONLINE_ROOM_CODE) {
    setOnlineStatus("Code invalide : utilise 1234 pour l'instant.", true);
    return;
  }

  stopOnlineSync({ keepIdentity: true });
  els.startGame.disabled = true;
  setOnlineStatus("Connexion au salon 1234...");

  try {
    await joinServerRoom(code);
  } catch (serverError) {
    try {
      setOnlineStatus("Serveur local indisponible. Connexion directe entre joueurs...");
      await joinPeerRoom(code);
    } catch (peerError) {
      setOnlineStatus(peerError.message || serverError.message || "Connexion impossible", true);
    }
  } finally {
    els.startGame.disabled = false;
  }
}

async function joinServerRoom(code) {
  const profile = profileFromMenu("player");
  const response = await fetch("./api/room/join", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code,
      playerId: state.network.playerId,
      name: profile.name,
      avatar: profile.avatar,
      deckId: els.playerDeckSelect.value
    })
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("API locale indisponible");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Connexion impossible");

  state.network.enabled = true;
  state.network.transport = "server";
  state.network.code = code;
  state.network.playerId = payload.playerId;
  state.network.slot = payload.slot;
  state.network.version = payload.room.version || 0;
  state.network.pending = false;
  sessionStorage.setItem(PLAYER_ID_KEY, payload.playerId);

  startOnlinePolling();
  handleOnlineRoom(payload.room);
}

async function joinPeerRoom(code) {
  const { default: Peer } = await import(PEERJS_MODULE_URL);
  const profile = profileFromMenu("player");
  const playerId = state.network.playerId || crypto.randomUUID();
  const hostId = `spellaho-${code}-host`;
  const peerOptions = { debug: 0 };

  state.network.enabled = true;
  state.network.transport = "peer";
  state.network.code = code;
  state.network.playerId = playerId;
  state.network.version = 0;
  state.network.peerRoom = {
    code,
    version: 0,
    players: {},
    state: null
  };
  sessionStorage.setItem(PLAYER_ID_KEY, playerId);

  try {
    const hostPeer = new Peer(hostId, peerOptions);
    await waitForPeerOpen(hostPeer);
    state.network.peer = hostPeer;
    state.network.slot = "player";
    state.network.peerRoom.players.player = peerProfile("player", profile, els.playerDeckSelect.value, playerId);
    hostPeer.on("connection", acceptPeerGuest);
    hostPeer.on("error", handlePeerError);
    setOnlineStatus("Salon direct 1234 créé. En attente du second joueur...");
  } catch (error) {
    if (error.type !== "unavailable-id") throw error;
    const guestPeer = new Peer(peerOptions);
    await waitForPeerOpen(guestPeer);
    state.network.peer = guestPeer;
    state.network.slot = "enemy";
    guestPeer.on("error", handlePeerError);
    const connection = guestPeer.connect(hostId, {
      reliable: true,
      metadata: {
        playerId,
        profile,
        deckId: els.playerDeckSelect.value
      }
    });
    attachPeerConnection(connection, "guest");
    setOnlineStatus("Connexion directe au salon 1234...");
  }
}

function waitForPeerOpen(peer) {
  return new Promise((resolve, reject) => {
    const onOpen = () => {
      peer.off("error", onError);
      resolve();
    };
    const onError = (error) => {
      peer.off("open", onOpen);
      try {
        peer.destroy();
      } catch {}
      reject(error);
    };
    peer.once("open", onOpen);
    peer.once("error", onError);
  });
}

function peerProfile(slot, profile, deckId, playerId) {
  return {
    id: playerId,
    slot,
    name: profile.name,
    avatar: profile.avatar,
    deckId
  };
}

function acceptPeerGuest(connection) {
  if (state.network.connection?.open) {
    connection.on("open", () => {
      connection.send({ type: "error", message: "Le salon 1234 a déjà deux joueurs." });
      connection.close();
    });
    return;
  }
  attachPeerConnection(connection, "host");
}

function attachPeerConnection(connection, role) {
  state.network.connection = connection;
  connection.on("open", () => {
    if (role === "guest") {
      connection.send({
        type: "join",
        playerId: state.network.playerId,
        profile: profileFromMenu("player"),
        deckId: els.playerDeckSelect.value
      });
    } else {
      registerPeerGuest(connection.metadata || {});
    }
  });
  connection.on("data", handlePeerMessage);
  connection.on("close", () => {
    state.network.connection = null;
    setOnlineStatus("Le second joueur s'est déconnecté. Tu peux recréer ou rejoindre le salon.", true);
  });
  connection.on("error", handlePeerError);
}

function registerPeerGuest(message) {
  if (state.network.slot !== "player") return;
  const profile = normalizeClientProfile("enemy", message.profile || {});
  const playerId = message.playerId || crypto.randomUUID();
  state.network.peerRoom.players.enemy = peerProfile("enemy", profile, message.deckId || "rouge-noir", playerId);
  const room = state.network.peerRoom;
  if (state.started) {
    syncProfilesFromRoom(room);
    render();
    publishOnlineState();
    return;
  }
  startOnlineGameFromRoom(room);
}

function handlePeerMessage(message) {
  if (!message || typeof message !== "object") return;
  if (message.type === "error") {
    setOnlineStatus(message.message || "Connexion directe refusée", true);
    return;
  }
  if (message.type === "join") {
    registerPeerGuest(message);
    return;
  }
  if (message.type === "snapshot" && message.state && message.version > state.network.version) {
    state.network.peerRoom = message.room || state.network.peerRoom;
    applyOnlineState(message.state, message.version, state.network.peerRoom);
    setOnlineStatus(`Salon direct 1234 synchronisé. Tu contrôles ${sideDisplayName(state.network.slot)}.`);
  }
}

function handlePeerError(error) {
  setOnlineStatus(error?.message || "Connexion directe interrompue", true);
}

function startOnlinePolling() {
  if (state.network.pollTimer) clearInterval(state.network.pollTimer);
  state.network.pollTimer = setInterval(pollOnlineRoom, ONLINE_POLL_MS);
}

function stopOnlineSync(options = {}) {
  if (state.network.pollTimer) clearInterval(state.network.pollTimer);
  if (state.network.publishTimer) clearTimeout(state.network.publishTimer);
  try {
    state.network.connection?.close();
    state.network.peer?.destroy();
  } catch {}
  const playerId = options.keepIdentity ? state.network.playerId : sessionStorage.getItem(PLAYER_ID_KEY) || "";
  state.network = {
    enabled: false,
    code: ONLINE_ROOM_CODE,
    playerId,
    slot: null,
    version: 0,
    transport: null,
    pollTimer: null,
    publishTimer: null,
    peer: null,
    connection: null,
    peerRoom: null,
    suppressPublish: false,
    pending: false,
    dirty: false
  };
}

async function pollOnlineRoom() {
  if (!state.network.enabled || state.network.transport !== "server") return;

  try {
    const response = await fetch(`./api/room/state?code=${encodeURIComponent(state.network.code)}&playerId=${encodeURIComponent(state.network.playerId)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Synchronisation impossible");
    if (payload.slot) state.network.slot = payload.slot;
    handleOnlineRoom(payload.room);
  } catch (error) {
    setOnlineStatus(error.message || "Synchronisation perdue", true);
  }
}

function handleOnlineRoom(room) {
  if (!room) return;
  const hasBothPlayers = Boolean(room.players?.player && room.players?.enemy);
  const playerNames = [
    room.players?.player?.name || "Joueur 1",
    room.players?.enemy?.name || "Joueur 2"
  ];

  if (!hasBothPlayers) {
    setOnlineStatus(`${playerNames[0]} est dans le salon 1234. En attente du second joueur...`);
    return;
  }

  setOnlineStatus(`Salon 1234 connecté : ${playerNames[0]} contre ${playerNames[1]}.`);

  if (room.state && (!state.started || room.version > state.network.version)) {
    applyOnlineState(room.state, room.version, room);
    return;
  }

  if (state.started) {
    if (syncProfilesFromRoom(room)) render();
    return;
  }

  if (state.network.slot === "player") {
    startOnlineGameFromRoom(room);
  } else {
    setOnlineStatus("Les deux joueurs sont connectés. Attente de la préparation par le joueur 1...");
  }
}

function startOnlineGameFromRoom(room) {
  const playerProfile = profileFromRoom(room, "player");
  const enemyProfile = profileFromRoom(room, "enemy");
  newGame({
    mode: "online",
    playerDeckId: room.players.player.deckId || "blanc-vert",
    enemyDeckId: room.players.enemy.deckId || "rouge-noir",
    playerProfile,
    enemyProfile,
    preserveNetwork: true
  });
  logEvent(`Salon 1234 synchronisé : ${playerProfile.name} affronte ${enemyProfile.name}.`);
  publishOnlineState();
}

function profileFromRoom(room, sideName) {
  const player = room.players?.[sideName] || {};
  return normalizeClientProfile(sideName, {
    name: player.name,
    avatar: player.avatar
  });
}

function syncProfilesFromRoom(room) {
  if (!state.player || !state.enemy || !room?.players) return false;
  const nextPlayer = profileFromRoom(room, "player");
  const nextEnemy = profileFromRoom(room, "enemy");
  const changed =
    state.player.profile?.name !== nextPlayer.name ||
    state.player.profile?.avatar !== nextPlayer.avatar ||
    state.enemy.profile?.name !== nextEnemy.name ||
    state.enemy.profile?.avatar !== nextEnemy.avatar;
  state.player.profile = nextPlayer;
  state.enemy.profile = nextEnemy;
  return changed;
}

function serializeGameState() {
  return {
    started: state.started,
    mode: "online",
    playerDeckId: state.playerDeckId,
    enemyDeckId: state.enemyDeckId,
    player: state.player,
    enemy: state.enemy,
    selectedBlockerId: state.selectedBlockerId,
    selectedAttackerId: state.selectedAttackerId,
    currentTurn: state.currentTurn,
    phase: state.phase,
    turn: state.turn,
    matchId: state.matchId,
    winner: state.winner,
    log: state.log,
    publishedBy: state.network.playerId,
    publishedAt: Date.now()
  };
}

function applyOnlineState(snapshot, version, room) {
  const network = { ...state.network, suppressPublish: true, version, dirty: false };
  const incomingMatchId = snapshot.matchId || "";
  if (incomingMatchId && incomingMatchId !== state.matchId) {
    state.progressAwarded = false;
    state.lastProgressAwards = [];
  }
  state.mode = "online";
  state.started = Boolean(snapshot.started);
  state.playerDeckId = snapshot.playerDeckId || state.playerDeckId;
  state.enemyDeckId = snapshot.enemyDeckId || state.enemyDeckId;
  state.player = snapshot.player;
  state.enemy = snapshot.enemy;
  state.selectedBlockerId = snapshot.selectedBlockerId || null;
  state.selectedAttackerId = snapshot.selectedAttackerId || null;
  state.currentTurn = snapshot.currentTurn || "player";
  state.phase = snapshot.phase || PHASES.MAIN_1;
  state.turn = snapshot.turn || 1;
  state.matchId = incomingMatchId || state.matchId || crypto.randomUUID();
  state.winner = snapshot.winner || null;
  state.log = Array.isArray(snapshot.log) ? snapshot.log : [];
  state.handoffPending = false;
  state.network = network;
  syncProfilesFromRoom(room);
  closeCardDetail();
  closeStartMenu();
  render();
  state.network.suppressPublish = false;
}

function markOnlineDirty() {
  if (!state.network.enabled || state.network.suppressPublish || !state.started) return;
  if (!isLocalOnlineController()) return;
  state.network.dirty = true;
}

function scheduleOnlinePublish(force = false) {
  if (!state.network.enabled || state.network.suppressPublish || !state.started) return;
  if (!force && !isLocalOnlineController()) return;
  if (state.network.publishTimer) clearTimeout(state.network.publishTimer);
  state.network.publishTimer = setTimeout(publishOnlineState, 140);
}

async function publishOnlineState() {
  if (!state.network.enabled || state.network.suppressPublish || !state.started) return;
  if (state.network.transport === "peer") {
    const connection = state.network.connection;
    if (!connection?.open) {
      state.network.dirty = true;
      setOnlineStatus("Connexion directe en attente...", true);
      return;
    }
    state.network.version += 1;
    const snapshot = serializeGameState();
    state.network.peerRoom.version = state.network.version;
    state.network.peerRoom.state = snapshot;
    connection.send({
      type: "snapshot",
      version: state.network.version,
      state: snapshot,
      room: state.network.peerRoom
    });
    setOnlineStatus(`Salon direct 1234 synchronisé. Tu contrôles ${sideDisplayName(state.network.slot)}.`);
    return;
  }
  if (state.network.pending) {
    state.network.dirty = true;
    return;
  }
  state.network.pending = true;

  try {
    const response = await fetch("./api/room/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: state.network.code,
        playerId: state.network.playerId,
        state: serializeGameState()
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Publication impossible");
    state.network.version = payload.version || state.network.version;
    setOnlineStatus(`Salon 1234 synchronisé. Tu contrôles ${sideDisplayName(state.network.slot)}.`);
  } catch (error) {
    setOnlineStatus(error.message || "Publication impossible", true);
  } finally {
    state.network.pending = false;
    if (state.network.dirty) {
      state.network.dirty = false;
      scheduleOnlinePublish(true);
    }
  }
}

function setOnlineStatus(message, isError = false) {
  if (!els.onlineStatus) return;
  els.onlineStatus.textContent = message || "";
  els.onlineStatus.hidden = !message;
  els.onlineStatus.classList.toggle("is-error", Boolean(isError));
}

function isLocalOnlineController() {
  if (state.mode !== "online") return true;
  if (!state.network.slot) return false;
  return state.network.slot === state.currentTurn;
}

function getDeckSpec(id) {
  return DECKS.find((deck) => deck.id === id) || DECKS[0];
}

function getDeckComposition(deckSpec) {
  const spellPool = state.spells.filter((card) => deckSpec.colors.includes(card.family) || card.family === "Incolore");
  const spells = Math.min(DECK_SPELLS, spellPool.length * MAX_NONLAND_COPIES);
  return {
    lands: DECK_LANDS,
    creatures: DECK_SIZE - DECK_LANDS - spells,
    spells
  };
}

function makeDeck(side, deckSpec) {
  const lands = [
    ...pickCopies(state.lands.filter((land) => land.family === deckSpec.colors[0]), DECK_LANDS / 2, Infinity),
    ...pickCopies(state.lands.filter((land) => land.family === deckSpec.colors[1]), DECK_LANDS / 2, Infinity)
  ];
  const creaturePool = state.cards.filter((card) => deckSpec.colors.includes(card.family));
  const spellPool = state.spells.filter((card) => deckSpec.colors.includes(card.family) || card.family === "Incolore");
  const composition = getDeckComposition(deckSpec);
  const creatures = pickCreatures(creaturePool, composition.creatures);
  const spells = pickSpells(spellPool, composition.spells);
  const deck = [...lands, ...creatures, ...spells];

  if (deck.length !== DECK_SIZE) {
    throw new Error(`${deckSpec.name} doit contenir ${DECK_SIZE} cartes, mais contient ${deck.length}.`);
  }

  return deck.map((card, index) => withUid(card, side, index));
}

function pickCreatures(pool, count) {
  const signatureCards = pool
    .filter((card) => Number(card.deckCopies) === 1)
    .map((card) => card);
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

function pickSpells(pool, count) {
  const interactive = pool.filter((card) => card.slot === "offense" || card.slot === "defense");
  const utility = pool.filter((card) => card.slot === "draw" || card.slot === "upgrade");
  const counts = new Map();
  const picks = [
    ...pickCopiesSoft(interactive, 10, MAX_NONLAND_COPIES, counts),
    ...pickCopiesSoft(utility, 4, MAX_NONLAND_COPIES, counts)
  ];
  return fillToCount(picks, pool, count, MAX_NONLAND_COPIES);
}

function fillToCount(current, pool, count, maxCopies) {
  if (current.length >= count) return current.slice(0, count);
  return [...current, ...pickCopies(pool, count - current.length, maxCopies, countCopies(current))];
}

function pickCopies(pool, count, maxCopies, existing = new Map()) {
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

  if (picks.length < count) {
    throw new Error(`Pas assez de cartes pour construire le deck (${count} demandées).`);
  }
  return picks;
}

function pickCopiesSoft(pool, count, maxCopies, existing = new Map()) {
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

  return picks;
}

function countCopies(cards) {
  const counts = new Map();
  for (const card of cards) {
    counts.set(card.id, (counts.get(card.id) || 0) + 1);
  }
  return counts;
}

function withUid(card, side, copy) {
  return {
    ...card,
    uid: `${side}-${card.id}-${copy}-${crypto.randomUUID()}`
  };
}

function shuffle(cards) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function beginTurn(side, firstTurn = false) {
  state.currentTurn = side.side;
  state.phase = PHASES.MAIN_1;
  side.landPlayed = false;
  untapPermanents(side);

  if (!firstTurn) draw(side, 1);

  logEvent(`${sideDisplayName(side.side)} commence son tour. Phase principale : pose un terrain ou lance une carte.`);
}

function untapPermanents(side) {
  for (const land of side.lands) {
    land.tapped = false;
  }

  for (const creature of side.board) {
    if (creature.stunTurns > 0) {
      creature.stunTurns -= 1;
      creature.tapped = true;
    } else {
      creature.tapped = false;
    }
    creature.attacking = false;
    creature.hasAttacked = false;
    creature.blocking = null;
    creature.blockedBy = null;
  }
}

function draw(side, amount) {
  for (let i = 0; i < amount; i += 1) {
    const next = side.deck.shift();
    if (!next) {
      side.life -= 1;
      logEvent(`${sideDisplayName(side.side)} n'a plus de cartes en bibliothèque et perd 1 point de vie.`);
      continue;
    }
    side.hand.push(next);
  }
  checkVictory();
}

function playCardFromHand(side, uid) {
  if (isAnimating || !canActInMain(side)) return;
  if (state.mode === "online" && state.network.slot !== side.side) return;
  const cardIndex = side.hand.findIndex((card) => card.uid === uid);
  if (cardIndex < 0) return;

  const card = side.hand[cardIndex];
  if (isLand(card)) {
    playLand(side, cardIndex);
    return;
  }

  if (isSpell(card)) {
    playSpell(side, cardIndex);
    return;
  }

  playCreature(side, cardIndex);
}

function playLand(side, cardIndex) {
  const land = side.hand[cardIndex];
  if (side.landPlayed) {
    logEvent(`${sideDisplayName(side.side)} a déjà joué un terrain ce tour-ci.`);
    render();
    return;
  }

  markOnlineDirty();
  side.hand.splice(cardIndex, 1);
  side.lands.push({
    ...land,
    tapped: false,
    enteredTurn: state.turn
  });
  side.landPlayed = true;
  logEvent(`${sideDisplayName(side.side)} pose ${land.name}.`);
  render();
}

function playCreature(side, cardIndex) {
  const card = side.hand[cardIndex];

  if (!isDivineUnlocked(side, card)) {
    logEvent(`${card.name} reste verrouillé : sa condition d'invocation divine n'est pas remplie.`);
    render();
    return;
  }

  if (!canFitCreatureOnBoard(side, card)) {
    logEvent("Le champ de bataille est plein.");
    render();
    return;
  }

  if (!canPay(side, card)) {
    logEvent(`Il manque ${manaShortfall(side, card)} terrain(s) ${card.family.toLowerCase()} dégagé(s) pour lancer ${card.name}.`);
    render();
    return;
  }

  markOnlineDirty();
  payMana(side, card);
  side.hand.splice(cardIndex, 1);
  sacrificeInvocationMaterials(side, card);
  const unit = createUnit(card, side.side);
  side.board.push(unit);
  pushVisualEffect("summon", side.side, "Invocation");
  logEvent(`${sideDisplayName(side.side)} lance ${unit.name}.`);
  triggerOnPlay(unit, side);
  cleanupBoards();
  checkVictory();
  render();
}

function invocationMaterialUnits(side, card) {
  const available = [...side.board];
  const units = [];
  for (const id of card.sacrificeOnCast || []) {
    const index = available.findIndex((unit) => unit.id === id && unit.currentLife > 0);
    if (index < 0) return [];
    units.push(available[index]);
    available.splice(index, 1);
  }
  return units;
}

function canFitCreatureOnBoard(side, card) {
  const materials = invocationMaterialUnits(side, card);
  const required = card.sacrificeOnCast?.length || 0;
  const removed = materials.length === required ? materials.length : 0;
  return side.board.length - removed < MAX_BOARD;
}

function sacrificeInvocationMaterials(side, card) {
  if (!card.sacrificeOnCast?.length) return;
  const materials = invocationMaterialUnits(side, card);
  if (materials.length !== card.sacrificeOnCast.length) return;
  for (const unit of materials) unit.currentLife = 0;
  logEvent(`${materials.map((unit) => unit.name).join(" et ")} sont sacrifiés pour accomplir la fusion.`);
  cleanupBoards();
}

function playSpell(side, cardIndex) {
  const card = side.hand[cardIndex];

  if (!canPay(side, card)) {
    logEvent(`Il manque ${manaShortfall(side, card)} terrain(s) ${card.family.toLowerCase()} dégagé(s) pour lancer ${card.name}.`);
    render();
    return;
  }

  markOnlineDirty();
  payMana(side, card);
  side.hand.splice(cardIndex, 1);
  side.graveyard.push({ ...card, uid: `${side.side}-grave-${card.id}-${crypto.randomUUID()}` });
  pushVisualEffect("spell", side.side, "Sort");
  logEvent(`${sideDisplayName(side.side)} lance ${card.name}.`);
  applySpellEffect(card, side);
  cleanupBoards();
  checkVictory();
  render();
}

// Style Hearthstone : pendant tout ton tour tu peux poser des cartes.
function canActInMain(side) {
  return !state.handoffPending && state.currentTurn === side.side && state.phase !== PHASES.OVER;
}

// Mana coloré : une carte d'une couleur exige autant de terrains DE CETTE
// COULEUR que son coût. Seules les cartes incolores acceptent n'importe quel
// terrain.
function untappedLandsFor(side, card) {
  const untapped = side.lands.filter((land) => !land.tapped);
  if (card.family === "Incolore") return untapped;
  return untapped.filter((land) => land.family === card.family);
}

function canPay(side, card) {
  if (isLand(card)) return canActInMain(side) && !side.landPlayed;
  return untappedLandsFor(side, card).length >= card.cost;
}

function payMana(side, card) {
  const landsToTap = untappedLandsFor(side, card).slice(0, card.cost);
  for (const land of landsToTap) {
    land.tapped = true;
  }
}

// Mana disponible dans la couleur de la carte (pour les messages d'aide).
function manaShortfall(side, card) {
  return Math.max(0, card.cost - untappedLandsFor(side, card).length);
}

function createUnit(card, owner) {
  return {
    ...card,
    owner,
    uid: `${owner}-unit-${card.id}-${crypto.randomUUID()}`,
    maxLife: card.life,
    currentLife: card.life,
    tapped: false,
    stunTurns: 0,
    createdTurn: state.turn,
    attacking: false,
    blocking: null,
    blockedBy: null,
    token: false
  };
}

function createToken(owner) {
  const source = state.cards.find((card) => card.id === "marinehote");
  const familiarImage = "Images/Familliers.png";
  return {
    id: "familier-aile",
    kind: "creature",
    uid: `${owner}-token-${crypto.randomUUID()}`,
    owner,
    name: "Familier ailé",
    subtitle: "Invocation loyale",
    family: "Aube",
    type: "Creature - Familier",
    cost: 0,
    attack: 1,
    life: 1,
    maxLife: 1,
    currentLife: 1,
    keywords: ["Vol"],
    abilityName: "Ailes gardiennes",
    abilityText: "Cette créature ne peut être bloquée que par une créature avec le vol ou la portée.",
    flavor: "",
    image: familiarImage,
    palette: source.palette,
    tapped: false,
    stunTurns: 0,
    createdTurn: state.turn,
    attacking: false,
    blocking: null,
    blockedBy: null,
    token: true
  };
}

function createZombie(owner) {
  const source = state.cards.find((card) => card.id === "morts-vivants");
  return {
    id: "zombie-ressuscite",
    kind: "creature",
    uid: `${owner}-zombie-${crypto.randomUUID()}`,
    owner,
    name: "Zombie ressuscité",
    subtitle: "Serviteur de tombe",
    family: "Noir",
    type: "Créature - Zombie",
    cost: 0,
    attack: 1,
    life: 1,
    maxLife: 1,
    currentLife: 1,
    keywords: ["Horde"],
    abilityName: "Chair relevée",
    abilityText: "Jeton créé par Morts vivants.",
    flavor: "",
    image: "Images/Morts vivants.PNG",
    palette: source.palette,
    tapped: false,
    stunTurns: 0,
    createdTurn: state.turn,
    attacking: false,
    blocking: null,
    blockedBy: null,
    token: true
  };
}

function createGuardian(owner) {
  const source = state.cards.find((card) => card.id === "protecteurs-nature");
  return {
    id: "gardien-nature",
    kind: "creature",
    uid: `${owner}-guardian-${crypto.randomUUID()}`,
    owner,
    name: "Gardien de la nature",
    subtitle: "Renfort appelé",
    family: "Vert",
    type: "Créature - Gardien",
    cost: 0,
    attack: 2,
    life: 2,
    maxLife: 2,
    currentLife: 2,
    keywords: ["Portée"],
    abilityName: "Garde vivante",
    abilityText: "Jeton créé par Appel de la meute.",
    flavor: "",
    image: "Images/Protécteurs de la nature.PNG",
    palette: source.palette,
    tapped: false,
    stunTurns: 0,
    createdTurn: state.turn,
    attacking: false,
    blocking: null,
    blockedBy: null,
    token: true
  };
}

function applySpellEffect(card, side) {
  const opponent = getOpponent(side);

  if (card.effect === "dealHero3") {
    opponent.life -= 3;
    logEvent(`${card.name} inflige 3 blessures au héros adverse.`);
  }

  if (card.effect === "dealAllEnemies2") {
    for (const target of opponent.board) target.currentLife -= 2;
    logEvent(`${card.name} inflige 2 blessures à toutes les créatures adverses.`);
  }

  if (card.effect === "dealAllEnemies3") {
    for (const target of opponent.board) target.currentLife -= 3;
    logEvent(`${card.name} inflige 3 blessures à toutes les créatures adverses.`);
  }

  if (card.effect === "buffTeamAttack1") {
    for (const ally of side.board) ally.attack += 1;
    logEvent(`${card.name} donne +1 force aux créatures alliées.`);
  }

  if (card.effect === "drainHero2") {
    opponent.life -= 2;
    side.life = Math.min(MAX_LIFE, side.life + 2);
    logEvent(`${card.name} draine 2 points de vie.`);
  }

  if (card.effect === "destroyStrongest") {
    const target = strongestCreature(opponent.board);
    if (target) {
      target.currentLife = 0;
      logEvent(`${card.name} détruit ${target.name}.`);
    }
  }

  if (card.effect === "createTwoZombies") {
    let created = 0;
    while (created < 2 && side.board.length < MAX_BOARD) {
      side.board.push(createZombie(side.side));
      created += 1;
    }
    if (created > 0) logEvent(`${card.name} crée ${created} Zombie(s) 1/1.`);
  }

  if (card.effect === "freezeStrongest") {
    const target = strongestCreature(opponent.board);
    freezeCreature(target);
    if (target) logEvent(`${card.name} engage ${target.name}.`);
  }

  if (card.effect === "drawTwo") {
    draw(side, 2);
    logEvent(`${card.name} fait piocher deux cartes.`);
  }

  if (card.effect === "freezeTwo") {
    const targets = [...opponent.board].filter((unit) => !unit.tapped).sort((a, b) => b.attack - a.attack).slice(0, 2);
    for (const target of targets) freezeCreature(target);
    if (targets.length > 0) logEvent(`${card.name} engage ${targets.length} créature(s) adverse(s).`);
  }

  if (card.effect === "gainLife4") {
    side.life = Math.min(MAX_LIFE, side.life + 4);
    logEvent(`${card.name} rend 4 points de vie.`);
  }

  if (card.effect === "restHero") {
    side.life = Math.min(MAX_LIFE, side.life + 3);
    draw(side, 1);
    pushVisualEffect("buff", side.side, "Repos");
    logEvent(`${card.name} rend 3 points de vie et fait piocher une carte.`);
  }

  if (card.effect === "destroyTappedOrWeakest") {
    const target =
      [...opponent.board].filter((unit) => unit.tapped).sort((a, b) => b.attack - a.attack)[0] ||
      [...opponent.board].sort((a, b) => a.currentLife - b.currentLife || a.attack - b.attack)[0];
    if (target) {
      target.exiled = true;
      target.currentLife = 0;
      logEvent(`${card.name} exile ${target.name}.`);
    }
  }

  if (card.effect === "createGuardian" && side.board.length < MAX_BOARD) {
    side.board.push(createGuardian(side.side));
    logEvent(`${card.name} crée un Gardien 2/2 avec portée.`);
  }

  if (card.effect === "buffTeam1") {
    buffTeam(side.board, 1, 1);
    logEvent(`${card.name} donne +1/+1 aux créatures alliées.`);
  }

  if (card.effect === "drawOneGainOne") {
    draw(side, 1);
    side.life = Math.min(MAX_LIFE, side.life + 1);
    logEvent(`${card.name} fait piocher une carte et rend 1 point de vie.`);
  }

  if (card.effect === "restoreTeam") {
    let healed = 0;
    for (const ally of side.board) {
      if (ally.currentLife < ally.maxLife) {
        ally.currentLife = ally.maxLife;
        healed += 1;
      }
    }
    pushVisualEffect("buff", side.side, "Soin");
    logEvent(`${card.name} soigne ${healed} créature(s).`);
  }

  if (card.effect === "toughTeam") {
    buffTeam(side.board, 0, 2);
    pushVisualEffect("buff", side.side, "+0/+2");
    logEvent(`${card.name} donne +0/+2 aux créatures alliées.`);
  }

  if (card.effect === "damageHero2") {
    opponent.life -= 2;
    pushVisualEffect("hit", opponent.side, "-2");
    logEvent(`${card.name} inflige 2 blessures au héros adverse.`);
  }

  if (card.effect === "weakenAllEnemies") {
    for (const target of opponent.board) {
      target.attack = Math.max(0, target.attack - 1);
    }
    if (opponent.board.length > 0) {
      pushVisualEffect("freeze", opponent.side, "-1 force");
      logEvent(`${card.name} affaiblit ${opponent.board.length} créature(s) adverse(s).`);
    }
  }

  if (card.effect === "freezeAll") {
    for (const target of opponent.board) freezeCreature(target);
    if (opponent.board.length > 0) {
      pushVisualEffect("freeze", opponent.side, "Gel");
      logEvent(`${card.name} engage toutes les créatures adverses.`);
    }
  }

  if (card.effect === "abyssThreat") {
    for (const target of opponent.board) {
      freezeCreature(target);
      target.attack = Math.max(0, target.attack - 1);
    }
    if (opponent.board.length > 0) {
      pushVisualEffect("freeze", opponent.side, "Terreur");
      logEvent(`${card.name} engage et affaiblit toutes les créatures adverses.`);
    }
  }

  if (card.effect === "naturalMemory") {
    draw(side, 2);
    side.life = Math.min(MAX_LIFE, side.life + 2);
    pushVisualEffect("buff", side.side, "+2 vie");
    logEvent(`${card.name} fait piocher deux cartes et rend 2 points de vie.`);
  }

  if (card.effect === "crownUlgod") {
    for (const ally of side.board) ally.attack += 1;
    opponent.life -= 2;
    pushVisualEffect("buff", side.side, "+1 force");
    pushVisualEffect("hit", opponent.side, "-2");
    logEvent(`${card.name} renforce tes créatures et inflige 2 blessures au héros adverse.`);
  }

  if (card.effect === "bhaalVessel") {
    side.life -= 2;
    const returned = reanimateBestCreatures(side, 1);
    pushVisualEffect("hit", side.side, "-2");
    if (returned.length > 0) {
      pushVisualEffect("summon", side.side, "Réanimation");
      logEvent(`${card.name} réclame 2 points de vie et ramène ${returned[0].name}.`);
    } else {
      logEvent(`${card.name} réclame 2 points de vie, mais le cimetière ne répond pas.`);
    }
  }

  if (card.effect === "vengefulSpirits") {
    for (const target of opponent.board) target.currentLife -= 2;
    opponent.life -= 2;
    side.life = Math.min(MAX_LIFE, side.life + 2);
    pushVisualEffect("hit", opponent.side, "-2");
    pushVisualEffect("buff", side.side, "+2 vie");
    logEvent(`${card.name} frappe toutes les créatures adverses et draine 2 points de vie.`);
  }

  if (card.effect === "vengeanceUldrid") {
    for (const ally of side.board) ally.attack += 1;
    const target = strongestCreature(opponent.board);
    if (target) target.currentLife -= 3;
    pushVisualEffect("buff", side.side, "+1 force");
    if (target) pushVisualEffect("hit", opponent.side, "-3");
    logEvent(
      target
        ? `${card.name} renforce les créatures alliées et inflige 3 blessures à ${target.name}.`
        : `${card.name} donne +1 force aux créatures alliées.`
    );
  }

  if (card.effect === "reanimate" || card.effect === "reanimateTwo") {
    const amount = card.effect === "reanimateTwo" ? 2 : 1;
    const returned = reanimateBestCreatures(side, amount);
    if (returned.length === 0) {
      const reason = side.board.length >= MAX_BOARD ? "le champ de bataille est plein" : "aucune créature n'attend au cimetière";
      logEvent(`${card.name} échoue : ${reason}.`);
      return;
    }
    pushVisualEffect("summon", side.side, "Réanimation");
    logEvent(`${card.name} ramène ${returned.map((unit) => unit.name).join(" et ")} d'entre les morts.`);
  }
}

function reanimateBestCreatures(side, amount) {
  const returned = [];
  while (returned.length < amount && side.board.length < MAX_BOARD) {
    const buried = (side.graveyard || []).filter((entry) => entry.kind === "creature");
    if (buried.length === 0) break;
    const best = [...buried].sort(
      (a, b) => (b.cost || 0) - (a.cost || 0) || (b.attack || 0) - (a.attack || 0)
    )[0];
    const index = side.graveyard.indexOf(best);
    if (index >= 0) side.graveyard.splice(index, 1);
    const source = state.cards.find((entry) => entry.id === best.id) || best;
    const unit = createUnit(source, side.side);
    side.board.push(unit);
    returned.push(unit);
    triggerOnPlay(unit, side);
  }
  return returned;
}

function triggerOnPlay(unit, side) {
  const opponent = side.side === "player" ? state.enemy : state.player;

  if (unit.id === "marinehote" && side.board.length < MAX_BOARD) {
    side.board.push(createToken(side.side));
    logEvent("Marinéhote crée un Familier ailé 1/1 avec le vol.");
  }

  if (unit.id === "familliers") {
    side.life = Math.min(MAX_LIFE, side.life + 2);
    logEvent(`Les Familiers d'Elturel font gagner 2 points de vie à ${sideDisplayName(side.side)}.`);
  }

  if (unit.id === "bebe-dragon") {
    opponent.life -= 1;
    logEvent("Bébé Dragon souffle une étincelle et inflige 1 blessure au héros adverse.");
  }

  if (unit.id === "johanna") {
    const target = [...opponent.board].sort((a, b) => b.attack - a.attack)[0];
    if (target) {
      target.tapped = true;
      target.stunTurns = 1;
      logEvent(`Johanna engage ${target.name}, qui ne se dégagera pas au prochain tour.`);
    }
  }

  if (unit.id === "terreur-mers-iguis") {
    const targets = opponent.board
      .filter((enemy) => !enemy.tapped)
      .sort((a, b) => b.attack - a.attack)
      .slice(0, 2);
    for (const target of targets) {
      target.tapped = true;
      target.stunTurns = Math.max(target.stunTurns, 1);
    }
    if (targets.length > 0) {
      logEvent(`Terreur des mers Iguis engloutit ${targets.length} créature(s) dans la marée.`);
    }
  }

  if (unit.id === "amrin") {
    const target = [...opponent.board].sort((a, b) => a.currentLife - b.currentLife || a.attack - b.attack)[0];
    if (target) {
      target.currentLife = 0;
      logEvent(`Amrin réclame un tribut : ${target.name} est détruit.`);
    }
  }

  if (unit.id === "chevalier-sans-espoir") {
    opponent.life -= 1;
    side.life = Math.min(MAX_LIFE, side.life + 1);
    logEvent(`${unit.name} draine 1 point de vie au héros adverse.`);
  }

  if (unit.id === "nilith") {
    const target = [...opponent.board].sort((a, b) => b.attack - a.attack || b.currentLife - a.currentLife)[0];
    if (target) {
      target.currentLife = 0;
      logEvent(`Nilith enveloppe ${target.name} dans le Néant.`);
    }
  }

  if (unit.id === "diablotins") {
    opponent.life -= 1;
    logEvent("Les Diablotins lancent leurs petites flammes et infligent 1 blessure au héros adverse.");
  }

  if (unit.id === "magiciens-exiles") {
    draw(side, 1);
    logEvent(`${unit.name} exhume un savoir interdit : ${sideDisplayName(side.side)} pioche une carte.`);
  }

  if (unit.id === "morts-vivants" && side.board.length < MAX_BOARD) {
    side.board.push(createZombie(side.side));
    logEvent("Les Morts vivants relèvent un Zombie 1/1.");
  }

  if (unit.id === "roi-des-mers") {
    const target = [...opponent.board].sort((a, b) => b.attack - a.attack || b.currentLife - a.currentLife)[0];
    if (target) {
      target.tapped = true;
      target.stunTurns = Math.max(target.stunTurns, 1);
      logEvent(`Le Roi des mers submerge ${target.name}, qui ne se dégagera pas au prochain tour.`);
    }
  }

  if (unit.id === "ragast") {
    const targets = opponent.board.filter((enemy) => enemy.currentLife < enemy.maxLife);
    for (const target of targets) {
      target.currentLife -= 2;
    }
    if (targets.length > 0) {
      logEvent(`Ragast ravive les plaies et inflige 2 blessures à ${targets.length} créature(s) blessée(s).`);
    }
  }

  if (unit.id === "trios-heros") {
    const allies = side.board.filter((ally) => ally.uid !== unit.uid);
    buffTeam(allies, 1, 1);
    if (allies.length > 0) {
      logEvent("Le Trios des Héros donne +1/+1 aux autres créatures alliées.");
    }
  }

  if (unit.id === "aldia") {
    side.life = Math.min(MAX_LIFE, side.life + 6);
    const allies = side.board.filter((ally) => ally.uid !== unit.uid);
    buffTeam(allies, 1, 1);
    pushVisualEffect("buff", side.side, "Aurore");
    logEvent("Aldia rend 6 points de vie et donne +1/+1 aux autres créatures.");
  }

  if (unit.id === "fee") {
    draw(side, 1);
    logEvent(`La Fée rapporte un secret de la forêt : ${sideDisplayName(side.side)} pioche une carte.`);
  }

  if (unit.id === "protecteurs-nature") {
    const allies = side.board.filter((ally) => ally.uid !== unit.uid);
    buffTeam(allies, 0, 1);
    if (allies.length > 0) logEvent("Les Protécteurs de la nature donnent +0/+1 aux autres créatures alliées.");
  }

  if (unit.id === "kraken") {
    for (const target of opponent.board) freezeCreature(target);
    if (opponent.board.length > 0) logEvent("Le Kraken engage toutes les créatures adverses.");
  }

  if (unit.id === "pirates") {
    draw(side, 1);
    side.life -= 1;
    logEvent("Les Pirates pillent une carte, puis leur audace coûte 1 point de vie.");
  }

  if (unit.id === "umi") {
    draw(side, 3);
    logEvent("Umi fait piocher trois cartes.");
  }

  if (unit.id === "ulgod") {
    opponent.life -= 5;
    pushVisualEffect("hit", opponent.side, "-5");
    logEvent("Ulgod inflige 5 blessures au héros adverse.");
  }

  if (unit.id === "zombie-villageois") {
    opponent.life -= 1;
    logEvent("Le Zombie villageois griffe le héros adverse pour 1 point de vie.");
  }

  if (unit.id === "uldrid") {
    const land = pullLandFromDeck(side, "Vert");
    if (land) {
      land.tapped = true;
      land.enteredTurn = state.turn;
      side.lands.push(land);
      logEvent(`Uldrid enracine ${land.name} depuis le deck de ${sideDisplayName(side.side)}, engagé.`);
    }
  }

  if (unit.id === "noxis") {
    const before = opponent.board.length;
    for (const enemy of opponent.board) {
      enemy.currentLife -= 2;
    }
    cleanupBoards();
    const deaths = before - opponent.board.length;
    if (deaths > 0) {
      logEvent(`Noxis inflige 2 blessures partout et grandit avec ${deaths} mort(s).`);
    } else {
      logEvent("Noxis inflige 2 blessures aux créatures adverses.");
    }
  }

  if (unit.id === "rena") {
    const allies = side.board.filter((ally) => ally.uid !== unit.uid);
    buffTeam(allies, 2, 2);
    side.life = Math.min(MAX_LIFE, side.life + 5);
    pushVisualEffect("buff", side.side, "+2/+2");
    logEvent(`Rena éveille la canopée : +2/+2 aux autres créatures et 5 points de vie pour ${sideDisplayName(side.side)}.`);
  }

  if (unit.id === "bhaal") {
    const target = strongestCreature(opponent.board);
    if (target) {
      target.currentLife = 0;
      logEvent(`Bhaal fauche ${target.name}.`);
    }
    opponent.life -= 3;
    pushVisualEffect("hit", opponent.side, "-3");
    logEvent("Bhaal inflige 3 blessures au héros adverse.");
  }

  if (unit.id === "noxis-bhaal-fusion") {
    const destroyed = opponent.board.length;
    for (const enemy of opponent.board) enemy.currentLife = 0;
    opponent.life -= 5;
    pushVisualEffect("hit", opponent.side, "-5");
    pushVisualEffect("summon", side.side, "Apothéose");
    logEvent(
      `${unit.name} détruit ${destroyed} créature(s) adverse(s) et inflige 5 blessures au héros adverse.`
    );
  }

  if (unit.id === "chevalier-froussard") {
    side.life = Math.min(MAX_LIFE, side.life + 2);
    logEvent(`Le Chevalier Froussard se met à l'abri : ${sideDisplayName(side.side)} gagne 2 points de vie.`);
  }

  if (unit.id === "tigre-zombie") {
    for (const enemy of opponent.board) enemy.currentLife -= 1;
    if (opponent.board.length > 0) {
      pushVisualEffect("hit", opponent.side, "-1");
      logEvent(`Le Tigre Zombie griffe ${opponent.board.length} créature(s) adverse(s).`);
    }
  }

  if (unit.id === "homme-flammes") {
    const target = [...opponent.board].sort((a, b) => a.currentLife - b.currentLife || a.attack - b.attack)[0];
    if (target) {
      target.currentLife -= 2;
      pushVisualEffect("hit", opponent.side, "-2");
      logEvent(`L'Homme des flammes brûle ${target.name} pour 2 blessures.`);
    }
  }

  checkVictory();
}

function pullLandFromDeck(side, preferredFamily) {
  let index = side.deck.findIndex((card) => isLand(card) && card.family === preferredFamily);
  if (index < 0) index = side.deck.findIndex((card) => isLand(card));
  if (index < 0) return null;
  const [land] = side.deck.splice(index, 1);
  return land;
}

// Combat façon Hearthstone : pas de phase de combat séparée ni de bloqueurs.
// Pendant ton tour tu poses tes cartes et tu attaques librement : tu cliques une
// créature prête (surbrillance verte) puis sa cible (créature adverse ou commandant).
function advancePhase() {
  if (isAnimating || state.phase === PHASES.OVER || !isCurrentSideHuman()) return;
  endCurrentTurn();
}

// Une créature « Défenseur » agit comme une Provocation : elle doit être frappée
// en premier. Le vol permet de l'ignorer.
function hasTaunt(unit) {
  return hasKeyword(unit, "Défenseur");
}

function tauntGuards(side) {
  return side.board.filter((unit) => hasTaunt(unit) && unit.currentLife > 0);
}

function canTargetUnit(attacker, target, defendingSide) {
  if (!target || target.currentLife <= 0) return false;
  const guards = tauntGuards(defendingSide);
  if (guards.length === 0 || hasKeyword(attacker, "Vol")) return true;
  return guards.includes(target);
}

function canTargetHero(attacker, defendingSide) {
  const guards = tauntGuards(defendingSide);
  return guards.length === 0 || hasKeyword(attacker, "Vol");
}

function selectAttacker(uid) {
  if (isAnimating || state.phase === PHASES.OVER || !isCurrentSideHuman()) return;
  const attacker = getCurrentSide().board.find((unit) => unit.uid === uid);
  if (!attacker) return;

  if (!canAttack(attacker)) {
    const reason = attacker.tapped || attacker.stunTurns > 0
      ? "a déjà agi ou est engagée."
      : hasTaunt(attacker)
        ? "a Défenseur : elle protège mais n'attaque pas."
        : "a le mal d'invocation 💤 : elle pourra attaquer au prochain tour.";
    logEvent(`${attacker.name} ${reason}`);
    render();
    return;
  }

  markOnlineDirty();
  state.selectedAttackerId = state.selectedAttackerId === uid ? null : uid;
  render();
}

function attackUnit(targetUid) {
  if (isAnimating || state.phase === PHASES.OVER || !isCurrentSideHuman() || !state.selectedAttackerId) return;
  const attackingSide = getCurrentSide();
  const defendingSide = getDefendingSide();
  const attacker = attackingSide.board.find((unit) => unit.uid === state.selectedAttackerId);
  const target = defendingSide.board.find((unit) => unit.uid === targetUid);
  if (!attacker || !target) return;

  if (!canTargetUnit(attacker, target, defendingSide)) {
    logEvent(`${target.name} est protégé : frappe d'abord une créature avec Défenseur.`);
    render();
    return;
  }

  markOnlineDirty();
  const attackerNode = boardCardNode(attacker.uid, attackingSide.side);
  const targetRect = boardCardNode(target.uid, defendingSide.side)?.getBoundingClientRect();
  playLunge(attackerNode, targetRect, () => {
    flashImpact(defendingSide.side);
    resolveSingleAttack(attacker, target, attackingSide, defendingSide);
  });
}

function attackHero() {
  if (isAnimating || state.phase === PHASES.OVER || !isCurrentSideHuman() || !state.selectedAttackerId) return;
  const attackingSide = getCurrentSide();
  const defendingSide = getDefendingSide();
  const attacker = attackingSide.board.find((unit) => unit.uid === state.selectedAttackerId);
  if (!attacker) return;

  if (!canTargetHero(attacker, defendingSide)) {
    logEvent(`${sideDisplayName(defendingSide.side)} est protégé par une créature avec Défenseur.`);
    render();
    return;
  }

  markOnlineDirty();
  const attackerNode = boardCardNode(attacker.uid, attackingSide.side);
  const targetRect = commanderNode(defendingSide.side)?.getBoundingClientRect();
  playLunge(attackerNode, targetRect, () => {
    flashImpact(defendingSide.side);
    resolveSingleAttack(attacker, null, attackingSide, defendingSide);
  });
}

// --- Animations de combat (charge de l'attaquant + secousse d'impact) ---
let isAnimating = false;

function boardCardNode(uid, sideName) {
  const container = sideName === "player" ? els.playerBoard : els.enemyBoard;
  return container?.querySelector(`.game-card[data-uid="${cssAttr(uid)}"]`) || null;
}

function commanderNode(sideName) {
  return document.querySelector(`.${sideName}-mat .mat-zone--commander`);
}

function playLunge(attackerNode, targetRect, done) {
  if (!attackerNode || !targetRect) { done(); return; }
  const a = attackerNode.getBoundingClientRect();
  const dx = targetRect.left + targetRect.width / 2 - (a.left + a.width / 2);
  const dy = targetRect.top + targetRect.height / 2 - (a.top + a.height / 2);
  isAnimating = true;
  attackerNode.style.setProperty("--lunge-x", `${Math.round(dx * 0.6)}px`);
  attackerNode.style.setProperty("--lunge-y", `${Math.round(dy * 0.6)}px`);
  attackerNode.classList.add("is-lunging");
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    isAnimating = false;
    done();
  };
  attackerNode.addEventListener("animationend", finish, { once: true });
  setTimeout(finish, 380);
}

function flashImpact(sideName) {
  const mat = document.querySelector(`.${sideName}-mat`);
  if (!mat) return;
  mat.classList.remove("is-hit-shake");
  void mat.offsetWidth;
  mat.classList.add("is-hit-shake");
  setTimeout(() => mat.classList.remove("is-hit-shake"), 360);
}

// Résolution immédiate d'une attaque : l'attaquant frappe, la cible riposte.
function resolveSingleAttack(attacker, target, attackingSide, defendingSide) {
  if (!hasKeyword(attacker, "Vigilance")) attacker.tapped = true;
  attacker.hasAttacked = true;
  state.selectedAttackerId = null;

  if (!target) {
    defendingSide.life -= attacker.attack;
    gainLifeFromDamage(attacker, attackingSide, attacker.attack);
    pushVisualEffect("attack", attackingSide.side, "Assaut");
    pushVisualEffect("hit", defendingSide.side, `-${attacker.attack}`);
    logEvent(`${attacker.name} frappe ${sideDisplayName(defendingSide.side)} pour ${attacker.attack} blessure(s).`);
  } else {
    target.currentLife -= attacker.attack;
    if (attacker.attack > 0 && hasKeyword(attacker, "Contact mortel")) target.currentLife = 0;
    attacker.currentLife -= target.attack;
    if (target.attack > 0 && hasKeyword(target, "Contact mortel")) attacker.currentLife = 0;
    gainLifeFromDamage(attacker, attackingSide, attacker.attack);
    gainLifeFromDamage(target, defendingSide, target.attack);
    pushVisualEffect("hit", defendingSide.side, `-${attacker.attack}`);
    if (target.attack > 0) pushVisualEffect("hit", attackingSide.side, `-${target.attack}`);
    logEvent(`${attacker.name} attaque ${target.name} : ${attacker.attack} contre ${target.attack}.`);
  }

  cleanupBoards();
  checkVictory();
  render();
}

function endCurrentTurn() {
  const nextSide = getDefendingSide();
  clearCombatFlags();
  if (state.currentTurn === "enemy") state.turn += 1;

  if (state.mode === "pve" && nextSide.side === "enemy") {
    state.currentTurn = "enemy";
    state.phase = PHASES.MAIN_1;
    render();
    setTimeout(enemyTurn, 450);
    return;
  }

  beginTurn(nextSide);
  if (state.mode === "pvp") showTurnHandoff(nextSide);
  render();
}

function showTurnHandoff(nextSide) {
  state.handoffPending = true;
  document.body.classList.add("handoff-open");
  if (!els.turnHandoff) return;
  els.turnHandoff.hidden = false;
  els.turnHandoffTitle.textContent = `À ${sideDisplayName(nextSide.side)}`;
  els.turnHandoffText.textContent = `Passe l'écran à ${sideDisplayName(nextSide.side)}, puis commence le tour quand la main est cachée.`;
  els.turnHandoffAvatar.style.backgroundImage = cssUrl(nextSide.profile?.avatar);
  setTimeout(() => els.turnHandoffConfirm?.focus(), 0);
}

function confirmTurnHandoff() {
  state.handoffPending = false;
  document.body.classList.remove("handoff-open");
  if (els.turnHandoff) els.turnHandoff.hidden = true;
  render();
}

function enemyTurn() {
  if (state.mode !== "pve") return;
  beginTurn(state.enemy);
  enemyPlayMainPhase();
  render();
  setTimeout(enemyAttackStep, 350);
}

// L'IA attaque une créature à la fois, avec animation, puis enchaîne — comme
// un vrai tour Hearthstone. Échanges favorables privilégiés, provocations gérées.
function enemyAttackStep() {
  if (state.phase === PHASES.OVER) {
    render();
    return;
  }
  const me = state.enemy;
  const foe = state.player;
  const attacker = me.board.find((unit) => canAttack(unit));
  if (!attacker) {
    finishEnemyTurn();
    return;
  }

  const guards = tauntGuards(foe);
  const ignoresTaunt = hasKeyword(attacker, "Vol");
  const targets = guards.length > 0 && !ignoresTaunt ? guards : foe.board;
  const kills = (t) => attacker.attack >= t.currentLife || hasKeyword(attacker, "Contact mortel");
  const survives = (t) => t.attack < attacker.currentLife && !hasKeyword(t, "Contact mortel");
  const lethalTrade = targets.find((t) => kills(t) && survives(t)) || targets.find(kills);
  const canHitHero = guards.length === 0 || ignoresTaunt;

  let target;
  if (canHitHero && attacker.attack >= foe.life) target = null;
  else if (lethalTrade) target = lethalTrade;
  else if (canHitHero) target = null;
  else target = [...targets].sort((a, b) => a.currentLife - b.currentLife)[0] || null;

  // Rien à frapper (bloqué par une provocation sans cible atteignable).
  if (target === null && !canHitHero) {
    finishEnemyTurn();
    return;
  }

  state.selectedAttackerId = attacker.uid;
  render();
  const attackerNode = boardCardNode(attacker.uid, "enemy");
  const targetRect = (target ? boardCardNode(target.uid, "player") : commanderNode("player"))?.getBoundingClientRect();
  playLunge(attackerNode, targetRect, () => {
    flashImpact("player");
    resolveSingleAttack(attacker, target, me, foe);
    setTimeout(enemyAttackStep, 280);
  });
}

function enemyPlayMainPhase() {
  enemyPlayLand();
  enemyPlaySpells();
}

function enemyPlayLand() {
  if (state.enemy.landPlayed) return;
  const neededFamilies = state.enemy.hand
    .filter((card) => !isLand(card))
    .sort((a, b) => b.cost - a.cost)
    .map((card) => card.family);
  let index = state.enemy.hand.findIndex((card) => isLand(card) && neededFamilies.includes(card.family));
  if (index < 0) index = state.enemy.hand.findIndex((card) => isLand(card));
  if (index >= 0) {
    playLand(state.enemy, index);
  }
}

function enemyPlaySpells() {
  let played = true;
  while (played) {
    played = false;
    const affordable = state.enemy.hand
      .filter(
        (card) =>
          !isLand(card) &&
          canPay(state.enemy, card) &&
          (isSpell(card)
            ? isSpellWorthCasting(card, state.enemy, state.player)
            : canFitCreatureOnBoard(state.enemy, card) && isDivineUnlocked(state.enemy, card))
      )
      .sort((a, b) => scoreAiPlay(b) - scoreAiPlay(a))[0];

    if (affordable) {
      const index = state.enemy.hand.findIndex((card) => card.uid === affordable.uid);
      if (isSpell(affordable)) playSpell(state.enemy, index);
      else playCreature(state.enemy, index);
      played = true;
    }
  }
}

// Évite que l'IA gaspille un sort sans aucune cible ni effet utile.
function isSpellWorthCasting(card, side, opponent) {
  switch (card.effect) {
    case "dealAllEnemies2":
    case "dealAllEnemies3":
    case "weakenAllEnemies":
    case "freezeAll":
    case "abyssThreat":
      return opponent.board.length > 0;
    case "freezeStrongest":
    case "freezeTwo":
      return opponent.board.some((unit) => !unit.tapped);
    case "destroyStrongest":
    case "destroyTappedOrWeakest":
      return opponent.board.length > 0;
    case "restoreTeam":
      return side.board.some((unit) => unit.currentLife < unit.maxLife);
    case "buffTeam1":
    case "buffTeamAttack1":
    case "toughTeam":
    case "vengeanceUldrid":
    case "crownUlgod":
      return side.board.length > 0;
    case "createTwoZombies":
    case "createGuardian":
      return side.board.length < MAX_BOARD;
    case "reanimate":
    case "reanimateTwo":
    case "bhaalVessel":
      return (
        side.board.length < MAX_BOARD &&
        (side.graveyard || []).some((entry) => entry.kind === "creature")
      );
    case "naturalMemory":
      return side.deck.length > 0 || side.life < MAX_LIFE;
    case "vengefulSpirits":
      return opponent.board.length > 0 || opponent.life > 0;
    case "gainLife4":
      return side.life <= MAX_LIFE - 4;
    case "restHero":
      return side.life < MAX_LIFE || side.deck.length > 0;
    default:
      return true;
  }
}

function scoreAiPlay(card) {
  if (card.id === "noxis-bhaal-fusion") return 1000;
  return card.cost * 10 + (card.attack || 0) + (isSpell(card) ? 8 : 0);
}

function finishEnemyTurn() {
  endCurrentTurn();
}

function gainLifeFromDamage(unit, side, amount) {
  if (amount <= 0 || !hasKeyword(unit, "Lien de vie")) return;
  side.life = Math.min(MAX_LIFE, side.life + amount);
  logEvent(`${sideDisplayName(side.side)} gagne ${amount} point${amount > 1 ? "s" : ""} de vie grâce à ${unit.name}.`);
}

function canAttack(unit) {
  return (
    !unit.tapped &&
    !unit.hasAttacked &&
    unit.currentLife > 0 &&
    !hasKeyword(unit, "Défenseur") &&
    (unit.createdTurn < state.turn || hasKeyword(unit, "Célérité"))
  );
}

function getSide(sideName) {
  return sideName === "player" ? state.player : state.enemy;
}

function getOpponent(side) {
  return side.side === "player" ? state.enemy : state.player;
}

function getCurrentSide() {
  return getSide(state.currentTurn);
}

function getDefendingSide() {
  return getOpponent(getCurrentSide());
}

function isHumanSide(sideName) {
  if (state.mode === "online") return state.network.slot === sideName;
  return state.mode === "pvp" || sideName === "player";
}

function isCurrentSideHuman() {
  return !state.handoffPending && isHumanSide(state.currentTurn);
}

function isDefendingSideHuman() {
  return isHumanSide(getDefendingSide().side);
}

function strongestCreature(board) {
  return [...board].sort((a, b) => b.attack - a.attack || b.currentLife - a.currentLife)[0] || null;
}

function freezeCreature(unit) {
  if (!unit) return;
  unit.tapped = true;
  unit.stunTurns = Math.max(unit.stunTurns, 1);
}

function buffTeam(units, attack, life) {
  for (const unit of units) {
    unit.attack += attack;
    unit.maxLife += life;
    unit.currentLife += life;
  }
}

function cleanupBoards() {
  const allBefore = [...state.player.board, ...state.enemy.board];

  for (const side of [state.player, state.enemy]) {
    const dead = side.board.filter((unit) => unit.currentLife <= 0);
    side.board = side.board.filter((unit) => unit.currentLife > 0);
    for (const unit of dead) {
      const destination = unit.exiled ? side.exile : side.graveyard;
      destination.push({
        ...unit,
        attacking: false,
        blocking: null,
        blockedBy: null,
        tapped: false,
        uid: `${side.side}-${unit.exiled ? "exile" : "grave"}-${unit.id}-${crypto.randomUUID()}`
      });
      pushVisualEffect(unit.exiled ? "exile" : "death", side.side, unit.exiled ? "Exil" : "Cimetière");
      logEvent(`${unit.name} va ${unit.exiled ? "en exil" : "au cimetière"}.`);
    }
  }

  const deaths = allBefore.filter((unit) => unit.currentLife <= 0).length;
  if (deaths > 0) {
    for (const noxis of [...state.player.board, ...state.enemy.board].filter((unit) => unit.id === "noxis")) {
      noxis.attack += deaths;
    }
  }
}

function clearCombatFlags() {
  state.selectedBlockerId = null;
  state.selectedAttackerId = null;
  for (const unit of [...state.player.board, ...state.enemy.board]) {
    unit.attacking = false;
    unit.blocking = null;
    unit.blockedBy = null;
  }
}

function hasKeyword(unit, keyword) {
  const wanted = keywordKey(keyword);
  return unit.keywords.some((candidate) => keywordKey(candidate) === wanted);
}

function keywordKey(keyword) {
  return String(keyword)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isLand(card) {
  return card.kind === "land";
}

function isSpell(card) {
  return card.kind === "spell";
}

function isCreature(card) {
  return card.kind === "creature";
}

/* ---------------------------------------------------------------------- */
/* Invocations divines : certains dieux ne peuvent être lancés que si une  */
/* condition de légende est remplie. La condition est décrite dans les     */
/* données (champ `divine`) sous forme de clauses combinées en OU.         */
/*   board    : toutes ces cartes doivent être sur ton champ de bataille   */
/*   boardAny : au moins une de ces cartes sur ton champ de bataille       */
/*   cast     : ces sorts doivent avoir été lancés (doublons = N copies)   */
/*   died     : au moins une de ces créatures doit être morte              */
/* ---------------------------------------------------------------------- */
function fallenCards(side) {
  return [...(side.graveyard || []), ...(side.exile || [])];
}

function divineClauseMet(side, clause) {
  const board = side.board || [];
  const fallen = fallenCards(side);

  if (clause.board && !clause.board.every((id) => board.some((unit) => unit.id === id))) return false;
  if (clause.boardAny && !clause.boardAny.some((id) => board.some((unit) => unit.id === id))) return false;

  if (clause.cast) {
    const needed = new Map();
    for (const id of clause.cast) needed.set(id, (needed.get(id) || 0) + 1);
    for (const [id, count] of needed) {
      const done = fallen.filter((card) => card.id === id && card.kind === "spell").length;
      if (done < count) return false;
    }
  }

  if (clause.died && !clause.died.some((id) => fallen.some((card) => card.id === id && card.kind === "creature"))) {
    return false;
  }
  return true;
}

function isDivineUnlocked(side, card) {
  if (!card?.divine?.any?.length) return true;
  return card.divine.any.some((clause) => divineClauseMet(side, clause));
}

// Détail lisible de la condition, pour la fiche de carte.
function describeDivineClause(side, clause) {
  const board = side.board || [];
  const fallen = fallenCards(side);
  const parts = [];
  const label = (id) =>
    state.cards.find((c) => c.id === id)?.name || state.spells.find((c) => c.id === id)?.name || id;

  for (const id of clause.board || []) {
    parts.push({ text: label(id), done: board.some((u) => u.id === id) });
  }
  if (clause.boardAny?.length) {
    parts.push({
      text: clause.boardAny.map(label).join(" ou "),
      done: clause.boardAny.some((id) => board.some((u) => u.id === id))
    });
  }
  if (clause.cast?.length) {
    const needed = new Map();
    for (const id of clause.cast) needed.set(id, (needed.get(id) || 0) + 1);
    for (const [id, count] of needed) {
      const done = fallen.filter((c) => c.id === id && c.kind === "spell").length;
      parts.push({
        text: count > 1 ? `${label(id)} ×${count} lancé(s) (${Math.min(done, count)}/${count})` : `${label(id)} lancé`,
        done: done >= count
      });
    }
  }
  if (clause.died?.length) {
    parts.push({
      text: `${clause.died.map(label).join(" ou ")} tombé au combat`,
      done: clause.died.some((id) => fallen.some((c) => c.id === id && c.kind === "creature"))
    });
  }
  return parts;
}

function checkVictory() {
  if (state.phase === PHASES.OVER || !state.player || !state.enemy) return;
  const playerDead = state.player.life <= 0;
  const enemyDead = state.enemy.life <= 0;
  if (!playerDead && !enemyDead) return;

  state.phase = PHASES.OVER;
  state.winner = playerDead && enemyDead ? "draw" : playerDead ? "enemy" : "player";
  if (state.winner === "draw") {
    logEvent("Les deux héros tombent en même temps : égalité !");
  } else {
    const loser = state.winner === "player" ? "enemy" : "player";
    logEvent(`${sideDisplayName(loser)} tombe à 0 point de vie. ${sideDisplayName(state.winner)} remporte la partie !`);
  }
  awardMatchProgress();
}

function awardMatchProgress() {
  if (state.progressAwarded || state.phase !== PHASES.OVER) return;
  state.progressAwarded = true;
  state.lastProgressAwards = [];

  const entries = [];
  if (state.mode === "online") {
    if (state.activeAccountId && state.network.slot) {
      entries.push({ accountId: state.activeAccountId, side: state.network.slot });
    }
  } else {
    if (state.activeAccountId) entries.push({ accountId: state.activeAccountId, side: "player" });
    if (state.mode === "pvp" && state.enemyAccountId && state.enemyAccountId !== state.activeAccountId) {
      entries.push({ accountId: state.enemyAccountId, side: "enemy" });
    }
  }

  for (const entry of entries) {
    const result = state.winner === "draw" ? "draw" : state.winner === entry.side ? "win" : "loss";
    const award = awardAccount(entry.accountId, result, state.matchId);
    if (award) state.lastProgressAwards.push({ ...award, side: entry.side });
  }
  refreshAccountMenus();
  renderAccountSummary();
  renderTopbarAccount();
}

function render() {
  if (!state.started) return;
  state.player.profile = normalizeClientProfile("player", state.player.profile);
  state.enemy.profile = normalizeClientProfile("enemy", state.enemy.profile);
  state.player.graveyard ||= [];
  state.enemy.graveyard ||= [];
  state.player.exile ||= [];
  state.enemy.exile ||= [];
  const handSide = getVisibleHandSide();
  els.playerName.textContent = sideDisplayName("player");
  els.enemyName.textContent = sideDisplayName("enemy");
  els.playerCaption.textContent = `${state.player.deckSpec.shortName} - ${state.player.deckSpec.theme}.`;
  els.enemyCaption.textContent = `${state.enemy.deckSpec.shortName} - ${state.enemy.deckSpec.theme}.`;
  els.playerHero.style.setProperty("--hero-avatar", cssUrl(state.player.profile?.avatar));
  els.enemyHero.style.setProperty("--hero-avatar", cssUrl(state.enemy.profile?.avatar));
  els.playerLife.textContent = Math.max(0, state.player.life);
  els.enemyLife.textContent = Math.max(0, state.enemy.life);
  els.playerEnergy.textContent = describeManaPool(state.player);
  els.enemyEnergy.textContent = describeManaPool(state.enemy);
  els.playerDeck.textContent = state.player.deck.length;
  els.enemyDeck.textContent = state.enemy.deck.length;
  els.playerGraveyard.textContent = state.player.graveyard.length;
  els.enemyGraveyard.textContent = state.enemy.graveyard.length;
  els.playerExile.textContent = state.player.exile.length;
  els.enemyExile.textContent = state.enemy.exile.length;
  renderPilePreviews();
  els.playerLandsCount.textContent = state.player.lands.length;
  els.enemyLandsCount.textContent = state.enemy.lands.length;
  els.handTitle.textContent = `Main - ${sideDisplayName(handSide.side)}`;
  els.handCount.textContent = `${handSide.hand.length} carte${handSide.hand.length > 1 ? "s" : ""}`;
  els.turnPill.textContent = phaseLabel();
  els.actionHint.textContent = getActionHint();

  updateButtons();
  renderHand();
  renderLands(els.playerLands, state.player.lands, "player");
  renderLands(els.enemyLands, state.enemy.lands, "enemy");
  renderBoard(els.playerBoard, state.player.board, "player");
  renderBoard(els.enemyBoard, state.enemy.board, "enemy");
  renderLog();
  updateGameOver();
  if (state.network.dirty) {
    state.network.dirty = false;
    scheduleOnlinePublish(true);
  }
}

function renderPilePreviews() {
  for (const zone of document.querySelectorAll("[data-pile]")) {
    const [sideName, pileName] = zone.dataset.pile.split(":");
    const pile = state[sideName]?.[pileName] || [];
    const card = pile.at(-1);
    const preview = zone.querySelector(".pile-card-mini");
    const art = preview?.querySelector(".pile-card-mini-art");
    if (!preview || !art) continue;
    preview.hidden = !card;
    art.style.setProperty("--pile-card-art", card ? cssUrl(card.image) : "none");
  }
}

function updateGameOver() {
  if (!els.gameOver) return;
  const over = state.started && state.phase === PHASES.OVER;
  els.gameOver.hidden = !over;
  if (!over) return;
  awardMatchProgress();

  const localSlot = state.mode === "online" ? state.network.slot : state.mode === "pve" ? "player" : null;
  let title;
  let text;
  if (state.winner === "draw" || !state.winner) {
    title = "Égalité";
    text = "Les deux héros tombent en même temps.";
  } else {
    const winnerName = sideDisplayName(state.winner);
    const loserName = sideDisplayName(state.winner === "player" ? "enemy" : "player");
    if (localSlot) {
      title = state.winner === localSlot ? "Victoire !" : "Défaite...";
    } else {
      title = `Victoire de ${winnerName}`;
    }
    text = `${winnerName} triomphe de ${loserName} au tour ${state.turn}.`;
  }
  els.gameOverTitle.textContent = title;
  els.gameOverText.textContent = text;
  if (els.gameOverXp) {
    if (state.lastProgressAwards.length === 0) {
      els.gameOverXp.innerHTML = '<p class="game-over-guest">Crée un profil pour enregistrer ton XP et ton grade.</p>';
    } else {
      els.gameOverXp.innerHTML = state.lastProgressAwards
        .map((award) => {
          const resultLabel = award.result === "win" ? "Victoire" : award.result === "loss" ? "Défaite" : "Égalité";
          const levelNotice = award.leveledUp ? `<strong>Niveau ${award.account.level} atteint</strong>` : "";
          const gradeNotice = award.gradeChanged ? `<strong>Nouveau grade : ${escapeHtml(award.grade.name)}</strong>` : "";
          return `
            <article class="game-over-xp-row">
              <img src="./${escapeHtml(award.grade.image)}" alt="${escapeHtml(award.grade.name)}" />
              <div>
                <span>${escapeHtml(award.account.name)} · ${resultLabel}</span>
                <strong>+${award.xpEarned} XP</strong>
                ${levelNotice}${gradeNotice}
              </div>
            </article>
          `;
        })
        .join("");
    }
  }
}

function rematch() {
  if (!state.started) return;
  const config = {
    mode: state.mode,
    playerDeckId: state.playerDeckId,
    enemyDeckId: state.enemyDeckId,
    playerProfile: state.player?.profile,
    enemyProfile: state.enemy?.profile,
    preserveNetwork: state.mode === "online"
  };
  if (state.mode === "online" && !state.network.enabled) {
    openStartMenu();
    return;
  }
  newGame(config);
  logEvent("Revanche lancée !");
  if (state.mode === "online") publishOnlineState();
  render();
}

function updateButtons() {
  const playing = state.phase !== PHASES.OVER && isCurrentSideHuman();
  els.endTurn.disabled = !playing;
  els.endTurn.textContent = "Fin du tour";

  // Le bouton rouge frappe directement le commandant avec l'attaquant choisi.
  const attacker = state.selectedAttackerId
    ? getCurrentSide().board.find((unit) => unit.uid === state.selectedAttackerId)
    : null;
  const heroReachable = Boolean(attacker && canTargetHero(attacker, getDefendingSide()));
  document.body.classList.toggle("targeting", Boolean(attacker) && playing && heroReachable);
  els.attackHero.disabled = !playing || !heroReachable;
  els.attackHero.textContent = attacker
    ? heroReachable
      ? `Frapper le commandant 🗡`
      : "Commandant protégé"
    : "Choisis une créature";
}

function renderHand() {
  const side = getVisibleHandSide();
  els.playerHand.innerHTML = "";
  if (state.handoffPending) {
    els.playerHand.append(emptySlot("Main masquée"));
    return;
  }
  if (side.hand.length === 0) {
    els.playerHand.append(emptySlot("Main vide"));
    return;
  }

  const fragment = document.createDocumentFragment();
  const handCenter = (side.hand.length - 1) / 2;
  const overlap = side.hand.length > 9 ? -30 : side.hand.length > 7 ? -20 : -7;
  for (const [index, card] of side.hand.entries()) {
    const node = renderCard(card, { mode: "hand" });
    const offset = index - handCenter;
    node.style.setProperty("--hand-rotation", `${offset * 2.2}deg`);
    node.style.setProperty("--hand-drop", `${Math.pow(Math.abs(offset), 1.45) * 2.6}px`);
    node.style.setProperty("--hand-layer", `${20 + index}`);
    node.style.setProperty("--hand-overlap", `${overlap}px`);
    // Surbrillance des cartes réellement jouables maintenant.
    if (isPlayableFromHand(side, card)) node.classList.add("is-playable");
    else node.classList.add("is-unplayable");
    // Dieu dont l'invocation n'est pas encore débloquée.
    if (card.divine && !isDivineUnlocked(side, card)) {
      node.classList.add("is-divine-locked");
      node.dataset.divineDifficulty = String(card.divine.difficulty || 1);
    }
    const control = node.querySelector(".card-content");
    control.addEventListener("click", () => openCardDetail(card, { zone: "hand", side: side.side }));
    if (side.side === state.currentTurn && isCurrentSideHuman()) attachPlayDrag(node, card, side);
    fragment.append(node);
  }
  els.playerHand.append(fragment);
}

function isPlayableFromHand(side, card) {
  if (!canActInMain(side)) return false;
  if (isLand(card)) return !side.landPlayed;
  if (isSpell(card)) return canPay(side, card);
  if (!isDivineUnlocked(side, card)) return false;
  return canFitCreatureOnBoard(side, card) && canPay(side, card);
}

function renderLands(container, lands, sideName) {
  container.innerHTML = "";
  if (lands.length === 0) {
    container.append(emptySlot("Aucun terrain"));
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const land of lands) {
    const node = renderLandPermanent(land);
    if (land.tapped) node.classList.add("is-tapped");
    node.addEventListener("click", () => openCardDetail(land, { zone: `${sideName}-lands` }));
    fragment.append(node);
  }
  container.append(fragment);
}

function renderBoard(container, board, sideName) {
  container.innerHTML = "";
  if (board.length === 0) {
    container.append(emptySlot(sideName === "player" ? "Ton champ de bataille" : "Champ adverse"));
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const unit of board) {
    const node = renderCard(unit, { mode: "board", side: sideName });
    node.dataset.uid = unit.uid;
    if (unit.attacking) node.classList.add("is-attacking");
    if (unit.blocking) node.classList.add("is-blocking");
    if (unit.tapped) node.classList.add("is-exhausted");
    if (unit.stunTurns > 0) node.classList.add("is-frozen");
    if (unit.uid === state.selectedBlockerId) node.classList.add("is-selected");

    // Repères de combat : surbrillance des créatures prêtes à attaquer et
    // marqueur « mal d'invocation » pour celles qui ne peuvent pas encore.
    // Repères de combat Hearthstone : créatures prêtes, attaquant sélectionné,
    // cibles légales et provocations adverses.
    const myTurn = isCurrentSideHuman() && state.currentTurn === sideName && state.phase !== PHASES.OVER;
    if (myTurn && canAttack(unit)) node.classList.add("can-attack");
    if (unit.uid === state.selectedAttackerId) node.classList.add("is-attacking");

    const selected = state.selectedAttackerId
      ? getCurrentSide().board.find((entry) => entry.uid === state.selectedAttackerId)
      : null;
    if (selected && sideName !== state.currentTurn && isCurrentSideHuman()) {
      if (canTargetUnit(selected, unit, getDefendingSide())) node.classList.add("is-target");
      else node.classList.add("is-protected");
    }

    const summoningSick =
      sideName === state.currentTurn &&
      !unit.tapped &&
      unit.stunTurns === 0 &&
      unit.createdTurn >= state.turn &&
      !hasKeyword(unit, "Célérité") &&
      !hasTaunt(unit);
    if (summoningSick) node.classList.add("is-summoning-sick");
    if (hasTaunt(unit)) node.classList.add("is-defender");

    const control = node.querySelector(".card-content");
    control.addEventListener("click", () => handleBoardCardClick(unit, sideName));
    if (myTurn && canAttack(unit)) attachAttackDrag(node, unit);
    fragment.append(node);
  }
  container.append(fragment);
}

// Clic sur une créature du plateau (style Hearthstone) :
// - une de tes créatures prêtes => on la sélectionne comme attaquante ;
// - une créature adverse, quand un attaquant est sélectionné => attaque immédiate ;
// - sinon => fiche détaillée de la carte.
function handleBoardCardClick(unit, sideName) {
  const myTurn = isCurrentSideHuman() && state.phase !== PHASES.OVER;

  if (myTurn && sideName === state.currentTurn) {
    if (canAttack(unit) || unit.uid === state.selectedAttackerId) {
      selectAttacker(unit.uid);
      return;
    }
  }

  if (myTurn && sideName !== state.currentTurn && state.selectedAttackerId) {
    attackUnit(unit.uid);
    return;
  }

  openCardDetail(unit, { zone: "board", side: sideName });
}

/* ===================================================================== */
/* Glisser-déposer (souris/tactile) façon Hearthstone.                    */
/*  - Carte de la main -> lâchée sur le champ de bataille = on la joue.    */
/*  - Créature prête -> lâchée sur une cible = attaque avec flèche visée.  */
/* Le clic reste actif : un simple clic (sans déplacement) ouvre la fiche. */
/* ===================================================================== */
const dragState = {
  pending: false,
  active: false,
  mode: null, // "play" | "attack"
  node: null,
  card: null,
  side: null,
  uid: null,
  startX: 0,
  startY: 0,
  ghost: null,
  suppressClick: false
};

function attachPlayDrag(node, card, side) {
  node.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.pointerType === "mouse" && event.buttons !== 1) return;
    if (!isPlayableFromHand(side, card)) return;
    beginDragCandidate(event, { mode: "play", node, card, side });
  });
}

function attachAttackDrag(node, unit) {
  node.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (!(isCurrentSideHuman() && state.phase !== PHASES.OVER && canAttack(unit))) return;
    beginDragCandidate(event, { mode: "attack", node, uid: unit.uid });
  });
}

function beginDragCandidate(event, spec) {
  dragState.pending = true;
  dragState.active = false;
  dragState.mode = spec.mode;
  dragState.node = spec.node;
  dragState.card = spec.card || null;
  dragState.side = spec.side || null;
  dragState.uid = spec.uid || null;
  dragState.startX = event.clientX;
  dragState.startY = event.clientY;
  dragState.suppressClick = false;
}

function onDragPointerMove(event) {
  if (!dragState.pending) return;
  if (!dragState.active) {
    const moved = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (moved < 9) return;
    activateDrag(event);
  }
  updateDrag(event);
}

function activateDrag(event) {
  dragState.active = true;
  dragState.suppressClick = true;
  document.body.classList.add("is-dragging");
  ensureDragLayer();
  if (dragState.node.setPointerCapture) {
    try { dragState.node.setPointerCapture(event.pointerId); } catch {}
  }

  if (dragState.mode === "play") {
    const rect = dragState.node.getBoundingClientRect();
    const ghost = dragState.node.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    dragLayerEl.append(ghost);
    dragState.ghost = ghost;
    dragState.node.classList.add("is-drag-source");
  } else {
    dragArrowEl.hidden = false;
    dragState.node.classList.add("is-attacking");
  }
}

function updateDrag(event) {
  if (dragState.mode === "play") {
    if (dragState.ghost) {
      dragState.ghost.style.left = `${event.clientX}px`;
      dragState.ghost.style.top = `${event.clientY}px`;
    }
    const overField = isOverPlayField(event.clientX, event.clientY);
    els.playerBoard?.closest(".mat-zone--field")?.classList.toggle("is-drop-target", overField);
  } else {
    const rect = dragState.node.getBoundingClientRect();
    drawAimArrow(rect.left + rect.width / 2, rect.top + rect.height / 2, event.clientX, event.clientY);
    highlightAttackTarget(event.clientX, event.clientY);
  }
}

function onDragPointerUp(event) {
  if (!dragState.pending) return;
  const wasActive = dragState.active;
  if (wasActive) {
    if (dragState.mode === "play") finishPlayDrag(event);
    else finishAttackDrag(event);
  }
  resetDrag();
  if (dragState.suppressClick) {
    // Empêche le clic « fiche » de suivre un vrai glisser.
    const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
    document.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 0);
  }
}

function finishPlayDrag(event) {
  if (isOverPlayField(event.clientX, event.clientY) && dragState.card && dragState.side) {
    playCardFromHand(dragState.side, dragState.card.uid);
  }
}

function finishAttackDrag(event) {
  const target = attackTargetAt(event.clientX, event.clientY);
  const attackerUid = dragState.uid;
  if (!target) {
    render();
    return;
  }
  state.selectedAttackerId = attackerUid;
  if (target.type === "hero") attackHero();
  else attackUnit(target.uid);
}

function resetDrag() {
  if (dragState.ghost) dragState.ghost.remove();
  dragState.node?.classList.remove("is-drag-source");
  document.body.classList.remove("is-dragging");
  els.playerBoard?.closest(".mat-zone--field")?.classList.remove("is-drop-target");
  clearAttackTargetHighlight();
  if (dragArrowEl) dragArrowEl.hidden = true;
  dragState.pending = false;
  dragState.active = false;
  dragState.mode = null;
  dragState.node = null;
  dragState.card = null;
  dragState.side = null;
  dragState.uid = null;
  dragState.ghost = null;
}

function isOverPlayField(x, y) {
  const field = els.playerBoard?.closest(".mat-zone--field") || els.playerBoard;
  if (!field) return false;
  const r = field.getBoundingClientRect();
  const pad = 30;
  return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
}

// Cible d'attaque sous le pointeur : créature adverse valide ou commandant.
function attackTargetAt(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const attacker = getCurrentSide().board.find((u) => u.uid === dragState.uid);
  if (!attacker) return null;
  const defender = getDefendingSide();

  const enemyCard = el.closest("#enemy-board .game-card, #player-board .game-card");
  if (enemyCard && els.enemyBoard.contains(enemyCard)) {
    const unit = defender.board.find((u) => u.uid === enemyCard.dataset.uid);
    if (unit && canTargetUnit(attacker, unit, defender)) return { type: "unit", uid: unit.uid };
    return null;
  }
  if (el.closest(".enemy-mat .mat-zone--commander") && canTargetHero(attacker, defender)) {
    return { type: "hero" };
  }
  return null;
}

function highlightAttackTarget(x, y) {
  clearAttackTargetHighlight();
  const target = attackTargetAt(x, y);
  if (!target) return;
  if (target.type === "hero") {
    els.enemyHero?.querySelector(".mat-zone--commander")?.classList.add("is-drop-target");
  } else {
    const node = els.enemyBoard.querySelector(`.game-card[data-uid="${cssAttr(target.uid)}"]`);
    node?.classList.add("is-drop-hit");
  }
}

function clearAttackTargetHighlight() {
  els.enemyHero?.querySelector(".mat-zone--commander")?.classList.remove("is-drop-target");
  for (const n of document.querySelectorAll(".game-card.is-drop-hit")) n.classList.remove("is-drop-hit");
}

function cssAttr(value) {
  return String(value).replace(/["\\]/g, "\\$&");
}

/* --- Calque de glisser : fantôme de carte + flèche de visée --- */
let dragLayerEl = null;
let dragArrowEl = null;
function ensureDragLayer() {
  if (dragLayerEl) return;
  dragLayerEl = document.createElement("div");
  dragLayerEl.className = "drag-layer";
  dragArrowEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  dragArrowEl.setAttribute("class", "drag-arrow");
  dragArrowEl.hidden = true;
  dragArrowEl.innerHTML = `
    <defs>
      <marker id="aim-head" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#ff5a4d" />
      </marker>
    </defs>
    <path class="drag-arrow-line" marker-end="url(#aim-head)" />`;
  dragLayerEl.append(dragArrowEl);
  document.body.append(dragLayerEl);
}

function drawAimArrow(x1, y1, x2, y2) {
  if (!dragArrowEl) return;
  const path = dragArrowEl.querySelector(".drag-arrow-line");
  const midX = (x1 + x2) / 2;
  const midY = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.12 - 30;
  path.setAttribute("d", `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`);
}

function renderGallery() {
  els.gallery.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (const card of [...state.cards, ...state.lands, ...state.spells]) {
    const node = renderCard(card, { mode: "gallery" });
    const control = node.querySelector(".card-content");
    control.addEventListener("click", () => openCardDetail(card, { zone: "gallery" }));
    control.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCardDetail(card, { zone: "gallery" });
      }
    });
    fragment.append(node);
  }
  els.gallery.append(fragment);
  if (els.cardCountSummary) {
    els.cardCountSummary.textContent = `${state.cards.length} créatures · ${state.lands.length} terrains · ${state.spells.length} sorts`;
  }
}

const AUDIT_MIN_CREATURES = 6;
const AUDIT_MIN_SPELLS = 4;
const FAMILY_DOT = {
  Blanc: "#f4e3b6",
  Bleu: "#69d0f2",
  Noir: "#b389c9",
  Rouge: "#ff8a5a",
  Vert: "#a9d778"
};

function computeColorBalance() {
  return COLORS.map((color) => {
    const creatures = state.cards.filter((card) => card.family === color).length;
    const spells = state.spells.filter((card) => card.family === color).length;
    const lands = state.lands.filter((card) => card.family === color).length;
    return {
      color,
      creatures,
      spells,
      lands,
      missingCreatures: Math.max(0, AUDIT_MIN_CREATURES - creatures),
      missingSpells: Math.max(0, AUDIT_MIN_SPELLS - spells)
    };
  });
}

function renderDeckAudit() {
  if (!els.deckAudit) return;
  const balance = computeColorBalance();
  const neutralSpells = state.spells.filter((card) => card.family === "Incolore").length;

  const rows = balance
    .map((row) => {
      const gaps = [];
      if (row.missingCreatures > 0) gaps.push(`${row.missingCreatures} créature(s)`);
      if (row.missingSpells > 0) gaps.push(`${row.missingSpells} sort(s)`);
      const verdict = gaps.length
        ? `<span class="audit-need">manque ${gaps.join(" + ")}</span>`
        : `<span class="audit-ok">équilibré</span>`;
      return `
        <div class="audit-row">
          <span class="audit-dot" style="--dot:${FAMILY_DOT[row.color]}"></span>
          <span class="audit-color">${escapeHtml(row.color)}</span>
          <span class="audit-counts">${row.creatures} cr. · ${row.spells} sr. · ${row.lands} terr.</span>
          ${verdict}
        </div>
      `;
    })
    .join("");

  els.deckAudit.innerHTML = `
    <p class="audit-head">Base mono-couleur visée : au moins ${AUDIT_MIN_CREATURES} créatures et ${AUDIT_MIN_SPELLS} sorts uniques par couleur (terrains comptés à part).</p>
    ${rows}
    <p class="audit-foot">Sorts incolores polyvalents jouables dans tous les decks : ${neutralSpells}.</p>
  `;
}

// Recadrage optionnel par carte (champ `art` dans les données) : certaines
// illustrations larges sont mieux en `cover` avec une position de sujet précise.
function artImgStyle(card) {
  const art = card.art;
  if (!art) return "";
  const styles = [];
  if (art.fit) styles.push(`object-fit:${art.fit}`);
  if (art.position) styles.push(`object-position:${art.position}`);
  if (styles.length === 0) return "";
  return ` style="${styles.join(";")}"`;
}

function renderCard(card, options = {}) {
  const article = document.createElement("article");
  article.className = options.mode === "gallery" ? "gallery-card" : "game-card";
  article.dataset.cardId = card.id;
  article.dataset.cardKind = card.kind;
  article.dataset.cardFamily = card.family;
  if (options.mode === "board") article.classList.add("compact");
  if (options.mode === "detail") article.classList.add("detail-card");
  if (isLand(card)) article.classList.add("land-card");
  if (isSpell(card)) article.classList.add("spell-card");
  article.style.setProperty("--tone", card.palette.primary);
  article.style.setProperty("--tone-2", card.palette.secondary);
  article.style.setProperty("--tone-deep", card.palette.deep);

  const interactive = options.mode !== "detail";
  const wrapper = document.createElement(interactive ? "button" : "div");
  if (wrapper.tagName === "BUTTON") {
    wrapper.type = "button";
    wrapper.setAttribute("aria-label", card.name);
  }
  if (options.mode === "gallery") {
    wrapper.setAttribute("aria-label", `Voir ${card.name}`);
  }
  wrapper.className = "card-content";

  const topBadge = isLand(card) ? "1" : card.cost;
  const lifeText = card.currentLife === undefined ? card.life : card.currentLife;
  const loading = options.mode === "hand" || options.mode === "detail" ? "eager" : "lazy";
  const statBlock = isLand(card)
    ? `<span class="stat-badge mana-stat">M</span>`
    : isSpell(card)
      ? `<span class="stat-badge spell-stat">S</span>`
      : `<span class="stat-badge attack-stat">${card.attack}</span><span class="stat-badge life-stat">${lifeText}</span>`;

  wrapper.innerHTML = `
    <div class="card-frame-top">
      <span class="cost-badge">${topBadge}</span>
      <div class="card-title-lockup">
        <h3 class="card-name">${escapeHtml(card.name)}</h3>
        <p class="card-type">${escapeHtml(card.type)}</p>
      </div>
    </div>
    <div class="card-art">
      <img src="${encodeURI(card.image)}" alt="${escapeHtml(card.name)}" loading="${loading}" decoding="async"${artImgStyle(card)} />
    </div>
    <span class="family-ribbon">${escapeHtml(card.family)}</span>
    <div class="card-scroll">
      <p class="card-ability"><strong>${escapeHtml(card.abilityName)}</strong> - ${escapeHtml(card.abilityText)}</p>
      <p class="card-keywords">${card.keywords.map((keyword) => `<span class="tag">${escapeHtml(keyword)}</span>`).join("")}</p>
    </div>
    <div class="card-stats">${statBlock}</div>
  `;
  article.append(wrapper);
  if (interactive && options.mode !== "hand") bindCardPreview(article, card);
  return article;
}

function bindCardPreview(article, card) {
  if (!els.cardPreview || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const show = () => showCardPreview(card, article);
  article.addEventListener("mouseenter", show);
  article.addEventListener("mouseleave", hideCardPreview);
  article.addEventListener("focusin", show);
  article.addEventListener("focusout", hideCardPreview);
}

function showCardPreview(card, anchor) {
  if (!els.cardPreview || !anchor) return;
  els.cardPreview.replaceChildren(renderCard(card, { mode: "detail" }));
  els.cardPreview.hidden = false;
  els.cardPreview.setAttribute("aria-hidden", "false");

  const anchorRect = anchor.getBoundingClientRect();
  const previewRect = els.cardPreview.getBoundingClientRect();
  const gutter = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Horizontal : à droite de la carte si possible, sinon à gauche.
  let left = anchorRect.right + gutter;
  if (left + previewRect.width > vw - gutter) {
    left = anchorRect.left - previewRect.width - gutter;
  }
  // Si aucun des deux côtés ne tient (carte large / petit écran), on centre
  // horizontalement sur la carte.
  if (left < gutter) {
    left = anchorRect.left + anchorRect.width / 2 - previewRect.width / 2;
  }
  left = Math.max(gutter, Math.min(left, vw - previewRect.width - gutter));

  // Vertical : on aligne le centre de l'aperçu sur celui de la carte, borné à
  // l'écran. L'aperçu reste ainsi collé à la carte plutôt que de sauter au centre.
  let top = anchorRect.top + anchorRect.height / 2 - previewRect.height / 2;
  top = Math.max(gutter, Math.min(top, vh - previewRect.height - gutter));

  els.cardPreview.style.left = `${left}px`;
  els.cardPreview.style.top = `${top}px`;
}

function hideCardPreview() {
  if (!els.cardPreview) return;
  els.cardPreview.hidden = true;
  els.cardPreview.setAttribute("aria-hidden", "true");
  els.cardPreview.replaceChildren();
}

function renderLandPermanent(land) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = "land-permanent";
  node.setAttribute("aria-label", `Voir ${land.name}`);
  node.style.setProperty("--tone", land.palette.primary);
  node.style.setProperty("--tone-2", land.palette.secondary);
  node.style.setProperty("--tone-deep", land.palette.deep);
  node.style.setProperty("--land-art", cssUrl(land.image));
  node.innerHTML = `
    <span class="land-permanent-art" aria-hidden="true"></span>
    <span class="land-gem"></span>
    <span class="land-name">${escapeHtml(land.name)}</span>
  `;
  return node;
}

// Panneau « Invocation divine » dans la fiche : condition + progression.
function renderDivinePanel(card, context) {
  let panel = document.querySelector("#divine-panel");
  if (!card.divine) {
    if (panel) panel.hidden = true;
    return;
  }
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "divine-panel";
    panel.className = "divine-panel";
    els.cardModalFlavor.after(panel);
  }
  panel.hidden = false;

  const side = state.started ? getSide(context?.side || getVisibleHandSide().side) : null;
  const unlocked = side ? isDivineUnlocked(side, card) : false;
  const stars = "★".repeat(card.divine.difficulty || 1) + "☆".repeat(5 - (card.divine.difficulty || 1));

  const clauses = (card.divine.any || [])
    .map((clause, index) => {
      const parts = side ? describeDivineClause(side, clause) : [];
      const items = parts
        .map((part) => `<li class="${part.done ? "is-done" : "is-todo"}">${part.done ? "✔" : "✖"} ${escapeHtml(part.text)}</li>`)
        .join("");
      const label = (card.divine.any.length > 1 ? `Voie ${index + 1}` : "Condition");
      return `<div class="divine-clause"><strong>${label}</strong><ul>${items}</ul></div>`;
    })
    .join('<p class="divine-or">— ou —</p>');

  panel.innerHTML = `
    <p class="divine-head">
      <span class="divine-title">🔱 Invocation divine</span>
      <span class="divine-stars" title="Difficulté">${stars}</span>
      <span class="divine-state ${unlocked ? "is-unlocked" : "is-locked"}">${unlocked ? "Débloquée" : "Verrouillée"}</span>
    </p>
    <p class="divine-text">${escapeHtml(card.divine.text || "")}</p>
    ${side ? clauses : ""}
  `;
}

function openCardDetail(card, context) {
  if (!els.cardModal) return;
  hideCardPreview();
  state.detailContext = { card, context };

  els.cardModalCard.innerHTML = "";
  els.cardModalCard.append(renderCard(card, { mode: "detail" }));
  els.cardModalFamily.textContent = `${card.family} - ${isLand(card) ? "Terrain" : isSpell(card) ? "Sort" : "Créature"}`;
  els.cardModalTitle.textContent = card.name;
  els.cardModalType.textContent = card.type;
  els.cardModalStats.textContent = describeCardStats(card);
  els.cardModalAbility.textContent = `${card.abilityName} - ${card.abilityText}`;
  els.cardModalFlavor.textContent = card.flavor || "";
  els.cardModalFlavor.hidden = !card.flavor;
  renderDivinePanel(card, context);

  const action = getDetailAction(card, context);
  els.cardModalAction.textContent = action.label;
  els.cardModalAction.disabled = !action.enabled;

  els.cardModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeCardDetail() {
  state.detailContext = null;
  if (!els.cardModal) return;
  els.cardModal.hidden = true;
  els.cardModalCard.innerHTML = "";
  if (!els.pileModal || els.pileModal.hidden) document.body.classList.remove("modal-open");
}

function openPileViewer(sideName, zone) {
  if (!els.pileModal || !state.started) return;
  const side = getSide(sideName);
  if (!side) return;
  const cards = zone === "exile" ? side.exile || [] : side.graveyard || [];
  els.pileModalTitle.textContent = `${zone === "exile" ? "Exil / Annexe" : "Cimetière"} — ${sideDisplayName(sideName)}`;
  els.pileModalGrid.innerHTML = "";
  els.pileModalEmpty.hidden = cards.length > 0;
  const fragment = document.createDocumentFragment();
  for (const card of cards) {
    const node = renderCard(card, { mode: "gallery" });
    const control = node.querySelector(".card-content");
    control.addEventListener("click", () => openCardDetail(card, { zone: "pile" }));
    fragment.append(node);
  }
  els.pileModalGrid.append(fragment);
  els.pileModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closePileViewer() {
  if (!els.pileModal) return;
  els.pileModal.hidden = true;
  els.pileModalGrid.innerHTML = "";
  if (els.cardModal.hidden) document.body.classList.remove("modal-open");
}

function runDetailAction() {
  if (!state.detailContext) return;
  const { card, context } = state.detailContext;
  const action = getDetailAction(card, context);
  if (!action.enabled || !action.run) return;

  closeCardDetail();
  action.run();
}

function getDetailAction(card, context) {
  const idle = { label: "Lecture seulement", enabled: false, run: null };
  if (!context) return idle;

  if (context.zone === "hand") {
    const side = getSide(context.side);
    const handCard = side.hand.find((candidate) => candidate.uid === card.uid);
    if (!handCard) return { label: "Carte déjà jouée", enabled: false, run: null };
    return {
      label: isLand(handCard) ? "Poser ce terrain" : "Lancer cette carte",
      enabled: isPlayableFromHand(side, handCard),
      run: () => playCardFromHand(side, handCard.uid)
    };
  }

  if (context.zone === "board") {
    const side = getSide(context.side);
    const unit = side.board.find((candidate) => candidate.uid === card.uid);
    if (!unit) return { label: "Carte absente du plateau", enabled: false, run: null };

    // Ton côté : choisir la créature comme attaquante.
    if (state.currentTurn === side.side && isCurrentSideHuman() && state.phase !== PHASES.OVER) {
      const selected = state.selectedAttackerId === unit.uid;
      return {
        label: selected ? "Annuler l'attaque" : "Attaquer avec cette créature",
        enabled: selected || canAttack(unit),
        run: () => selectAttacker(unit.uid)
      };
    }

    // Côté adverse : cible d'un attaquant déjà sélectionné.
    if (state.selectedAttackerId && isCurrentSideHuman() && state.phase !== PHASES.OVER) {
      const attacker = getCurrentSide().board.find((candidate) => candidate.uid === state.selectedAttackerId);
      const reachable = Boolean(attacker && canTargetUnit(attacker, unit, getDefendingSide()));
      return {
        label: reachable ? "Frapper cette créature" : "Protégée par une Provocation",
        enabled: reachable,
        run: () => attackUnit(unit.uid)
      };
    }
  }

  return idle;
}

function describeCardStats(card) {
  if (isLand(card)) {
    return `Terrain ${card.family} - produit ${card.energy || 1} mana ${card.family.toLowerCase()}.`;
  }

  if (isSpell(card)) {
    return `Coût ${card.cost} - ${card.type}`;
  }

  const lifeText = card.currentLife === undefined ? card.life : `${card.currentLife}/${card.maxLife}`;
  return `Coût ${card.cost} - Force ${card.attack} - Vie ${lifeText}`;
}

function availableMana(side) {
  return side.lands.filter((land) => !land.tapped).length;
}

// Mana disponible détaillé par couleur, ex. « 2V 1B » : indispensable depuis
// que chaque carte exige des terrains de sa propre couleur.
const MANA_INITIALS = { Blanc: "B", Bleu: "U", Noir: "N", Rouge: "R", Vert: "V" };

function describeManaPool(side) {
  const free = side.lands.filter((land) => !land.tapped);
  if (side.lands.length === 0) return "0";
  const counts = new Map();
  for (const land of free) counts.set(land.family, (counts.get(land.family) || 0) + 1);
  if (counts.size === 0) return `0/${side.lands.length}`;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([family, n]) => `${n}${MANA_INITIALS[family] || family[0]}`)
    .join(" ");
}

function phaseLabel() {
  if (state.phase === PHASES.OVER) return "Partie terminée";
  if (state.currentTurn === "enemy" && state.mode === "pve") return `Tour ${state.turn} · Tour adverse`;
  return `Tour ${state.turn} · ${sideDisplayName(state.currentTurn)}`;
}

function getActionHint() {
  if (state.phase === PHASES.OVER) return "La partie est terminée. Lance une nouvelle partie.";
  if (state.handoffPending) return "La main reste masquée jusqu'au début du prochain tour.";
  if (state.mode === "online" && !isLocalOnlineController()) {
    return `${sideDisplayName(state.currentTurn)} joue sur son écran.`;
  }
  if (!isCurrentSideHuman()) return "L'adversaire joue son tour.";

  const me = getCurrentSide();
  const foe = getDefendingSide();
  const attacker = state.selectedAttackerId
    ? me.board.find((unit) => unit.uid === state.selectedAttackerId)
    : null;

  if (attacker) {
    const guards = tauntGuards(foe);
    if (guards.length > 0 && !hasKeyword(attacker, "Vol")) {
      return `${attacker.name} est prête : frappe une créature avec Défenseur 🛡 (elles protègent le commandant).`;
    }
    return `${attacker.name} est prête : clique une créature adverse ou le commandant pour frapper.`;
  }

  const ready = me.board.filter((unit) => canAttack(unit));
  const playable = me.hand.filter((card) => isPlayableFromHand(me, card)).length;
  if (ready.length > 0) {
    return `Clique une créature en surbrillance verte ⚔ (${ready.length} prête${ready.length > 1 ? "s" : ""}) pour attaquer, puis sa cible.`;
  }
  if (playable > 0) {
    return `${playable} carte(s) jouable(s) en surbrillance dans ta main. Pose un terrain, puis lance tes cartes.`;
  }
  return "Rien de jouable : clique « Fin du tour ».";
}

function renderLog() {
  els.log.innerHTML = "";
  const entries = state.log.slice(-14).reverse();
  for (const entry of entries) {
    const li = document.createElement("li");
    li.textContent = entry;
    els.log.append(li);
  }
}

function emptySlot(text) {
  const div = document.createElement("div");
  div.className = "empty-slot";
  div.textContent = text;
  return div;
}

function logEvent(message) {
  state.log.push(message);
  if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
}

function pushVisualEffect(type, sideName, text) {
  if (!els.effectLayer) return;
  const node = document.createElement("div");
  node.className = `effect-pop ${type} ${sideName}`;
  node.textContent = text;
  els.effectLayer.append(node);
  window.setTimeout(() => node.remove(), 950);
}

function preloadImages() {
  const urls = new Set([
    PLAYMATS.player,
    PLAYMATS.enemy,
    DEFAULT_PROFILES.player.avatar,
    DEFAULT_PROFILES.enemy.avatar,
    "Images/Tapis de Jeu/Carte Dos.png",
    "Images/Tapis de Jeu/Devant de carte.jpg",
    "Images/Logo Jeu/Spellaho.png"
  ]);
  for (const url of urls) {
    const img = new Image();
    img.src = encodeURI(url);
  }
}

function getVisibleHandSide() {
  if (state.mode === "online") return getSide(state.network.slot || "player");
  if (state.mode === "pvp") return getCurrentSide();
  return state.player;
}

function sideDisplayName(sideName) {
  const side = sideName === "player" ? state.player : state.enemy;
  if (side?.profile?.name) return side.profile.name;
  if (state.mode === "online") return sideName === "player" ? "Joueur 1" : "Joueur 2";
  if (state.mode === "pvp") return sideName === "player" ? "Joueur 1" : "Joueur 2";
  return sideName === "player" ? "Joueur" : "Adversaire";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cssUrl(value) {
  return `url("${encodeURI(String(value || "").replaceAll('"', "").replaceAll("\\", "/"))}")`;
}
