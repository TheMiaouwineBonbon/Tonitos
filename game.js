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
import { sound, music } from "./audio.js?v=20260817-musique-2";
import {
  buffUnits,
  canPayCard,
  canTakeMainAction,
  canUnitAttack,
  determineWinner,
  drawFromDeck,
  finiteNumber,
  keywordKey as normalizeKeyword,
  landEnergy,
  landFamilies,
  landProduces,
  makeTurnStartKey,
  manaRequirements,
  parasiteVengeanceDamage,
  partitionDeadUnits,
  payCardCost,
  resolveCreatureCombat,
  selectHighestCostCards,
  tickDelayedReturns,
  unitHasKeyword,
  untappedLandsForCard,
  validateGameState
} from "./engine-core.mjs?v=20260817-mana-1";
import { debugCheckpoint, debugEvent, installDebugApi } from "./game-debug.mjs?v=20260815-debug-1";

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
const PHONE_LANDSCAPE_MAX_WIDTH = 960;
const PHONE_LANDSCAPE_MAX_HEIGHT = 540;
// Le code n'est plus imposé : chaque partie ouvre le salon de son choix,
// sans quoi deux tables simultanées s'écrasaient mutuellement.
// Déclarés ici parce que `state` s'en sert dès sa construction, plus bas.
const DEFAULT_ROOM_CODE = "1234";
const ROOM_CODE_PATTERN = /^\d{4}$/;
const storedPlayerId = sessionStorage.getItem(PLAYER_ID_KEY) || sessionStorage.getItem(LEGACY_PLAYER_ID_KEY) || "";
if (storedPlayerId && !sessionStorage.getItem(PLAYER_ID_KEY)) {
  sessionStorage.setItem(PLAYER_ID_KEY, storedPlayerId);
}

const state = {
  cards: [],
  lands: [],
  spells: [],
  elements: {},
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
    code: DEFAULT_ROOM_CODE,
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
    dirty: false,
    // Sondages ratés d'affilée, et verrou pendant une reconnexion.
    failures: 0,
    rejoining: false
  }
};

installDebugApi(() => state);

const pendingGameTimers = new Set();
let lastTurnStartKey = "";
let gameplayPaused = true;

function scheduleGameTask(callback, delay, matchId = state.matchId) {
  const timer = window.setTimeout(() => {
    pendingGameTimers.delete(timer);
    if (gameplayPaused || (matchId && state.matchId !== matchId)) return;
    callback();
  }, delay);
  pendingGameTimers.add(timer);
  return timer;
}

function clearGameTimers() {
  for (const timer of pendingGameTimers) window.clearTimeout(timer);
  pendingGameTimers.clear();
}

const els = {
  orientationGate: document.querySelector("#orientation-gate"),
  orientationLock: document.querySelector("#orientation-lock"),
  orientationStatus: document.querySelector("#orientation-status"),
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
  enemyHand: document.querySelector("#enemy-hand"),
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
  onlineBanner: document.querySelector("#online-banner"),
  onlineBannerText: document.querySelector("#online-banner-text"),
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
const ONLINE_POLL_MS = 1000;
// Trois sondages ratés d'affilée valent mieux qu'un seul pour distinguer une
// coupure réelle d'un simple hoquet réseau.
const ONLINE_REJOIN_AFTER_FAILURES = 3;
// Laisse au pair le temps de se réinstaller avant de retenter la liaison.
const PEER_RECONNECT_MS = 2000;
const PEERJS_MODULE_URL = "https://cdn.jsdelivr.net/npm/peerjs@1.5.5/+esm";
const PLAYMATS = {
  player: "Images/Tapis de Jeu/Tapis de jeu Joueur.png",
  enemy: "Images/Tapis de Jeu/Taps de jeu Adversaire.png",
  mobile: "Images/Tapis de Jeu/Tapis Mobile Pro.svg?v=20260817-rond-1"
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
  },
  {
    id: "blanc-bleu",
    name: "Blanc / Bleu - Concile des Marées",
    shortName: "Concile des Marées",
    colors: ["Blanc", "Bleu"],
    theme: "protection, pioche et contrôle des abysses"
  }
];

init().catch(handleInitializationError);

async function init() {
  if (!els.startMenu) return;
  const dataVersion = Date.now();
  const [cardsResponse, landsResponse, spellsResponse, elementsResponse] = await Promise.all([
    fetch(`./data/cards.json?v=${dataVersion}`, { cache: "no-store" }),
    fetch(`./data/lands.json?v=${dataVersion}`, { cache: "no-store" }),
    fetch(`./data/spells.json?v=${dataVersion}`, { cache: "no-store" }),
    fetch(`./data/elements.json?v=${dataVersion}`, { cache: "no-store" })
  ]);
  state.cards = (await cardsResponse.json()).map((card) => ({ ...card, kind: "creature" }));
  state.lands = await landsResponse.json();
  state.spells = (await spellsResponse.json()).map((card) => ({ ...card, kind: "spell" }));
  state.elements = await elementsResponse.json();
  preloadImages();
  applyPlaymats();
  populateDeckMenu();
  populateAvatarMenu();
  initializeAccounts();
  renderGallery();
  renderDeckAudit();
  bindEvents();
  els.startGame.disabled = false;
  els.startGame.removeAttribute("aria-busy");
  els.startGame.textContent = "Lancer Spellaho";
  updatePhoneOrientation();
  openStartMenu();
}

function handleInitializationError(error) {
  console.error("Impossible d'initialiser Spellaho.", error);
  if (!els.startGame) return;
  els.startGame.disabled = true;
  els.startGame.removeAttribute("aria-busy");
  els.startGame.textContent = "Chargement impossible";
}

function applyPlaymats() {
  if (!els.boardStage) return;
  els.boardStage.style.setProperty("--playmat-player", cssUrl(PLAYMATS.player));
  els.boardStage.style.setProperty("--playmat-enemy", cssUrl(PLAYMATS.enemy));
  els.boardStage.style.setProperty("--playmat-mobile", cssUrl(PLAYMATS.mobile));
}

function bindEvents() {
  els.orientationLock?.addEventListener("click", requestLandscapeMode);
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
  // Le commandant qui défend est cliquable, quel que soit le camp contrôlé.
  for (const [sideName, hero] of [["player", els.playerHero], ["enemy", els.enemyHero]]) {
    hero?.querySelector(".mat-zone--commander")?.addEventListener("click", () => {
      if (state.selectedAttackerId && getDefendingSide()?.side === sideName) attackHero();
    });
  }
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
  window.addEventListener("resize", () => {
    hideCardPreview();
    updatePhoneOrientation();
    scheduleCardDetailFit();
    if (!state.started) return;
    if (dragState.pending) {
      handRenderPending = true;
      return;
    }
    renderHand();
  });
  const handleOrientationChange = () => {
    hideCardPreview();
    const shouldRefreshHand = state.started && (dragState.pending || handRenderPending);
    if (dragState.pending) resetDrag();
    updatePhoneOrientation();
    if (shouldRefreshHand) {
      handRenderPending = false;
      renderHand();
    }
    scheduleCardDetailFit();
  };
  window.addEventListener("orientationchange", handleOrientationChange);
  screen.orientation?.addEventListener?.("change", handleOrientationChange);
  window.addEventListener("scroll", hideCardPreview, true);
  window.addEventListener("pointermove", onDragPointerMove, { passive: false });
  // iOS peut produire un clic synthétique juste après pointerup. La flèche est
  // donc masquée en phase de capture, avant toute résolution ou tout clic.
  window.addEventListener("pointerup", hideAttackArrowVisual, { capture: true });
  window.addEventListener("pointercancel", hideAttackArrowVisual, { capture: true });
  window.addEventListener("touchend", hideAttackArrowVisual, { capture: true, passive: true });
  window.addEventListener("touchcancel", hideAttackArrowVisual, { capture: true, passive: true });
  window.addEventListener("pointerup", onDragPointerUp);
  window.addEventListener("pointercancel", onDragPointerCancel);
  // Perte de focus / passage en arrière-plan : le pointerup n'arrive pas
  // toujours sur mobile, donc on purge le ciblage nous-mêmes.
  window.addEventListener("blur", () => resetAttackState());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) resetAttackState();
  });
}

function isPhoneViewport() {
  return (
    Math.min(window.innerWidth, window.innerHeight) <= PHONE_LANDSCAPE_MAX_HEIGHT &&
    Math.max(window.innerWidth, window.innerHeight) <= PHONE_LANDSCAPE_MAX_WIDTH
  );
}

function isPhoneLandscape() {
  return window.matchMedia(
    `(max-width: ${PHONE_LANDSCAPE_MAX_WIDTH}px) and ` +
    `(max-height: ${PHONE_LANDSCAPE_MAX_HEIGHT}px) and (orientation: landscape)`
  ).matches;
}

let orientationLockFailed = false;

function updatePhoneOrientation() {
  const blocked = isPhoneViewport() && window.innerHeight > window.innerWidth;
  const canLock = typeof screen.orientation?.lock === "function";
  document.body.classList.toggle("phone-portrait-blocked", blocked);
  document.body.classList.toggle("orientation-lock-unavailable", isPhoneViewport() && !canLock);
  els.orientationGate?.setAttribute("aria-hidden", String(!blocked));
  if (els.orientationLock) els.orientationLock.hidden = !canLock;
  if (els.orientationStatus) els.orientationStatus.hidden = canLock && !orientationLockFailed;
}

async function requestLandscapeMode() {
  if (!isPhoneViewport()) return;
  orientationLockFailed = false;
  try {
    if (typeof screen.orientation?.lock !== "function") {
      throw new Error("Orientation lock unavailable");
    }
    await screen.orientation.lock("landscape");
  } catch {
    orientationLockFailed = true;
    if (els.orientationStatus) {
      els.orientationStatus.hidden = false;
      els.orientationStatus.textContent = "Tourne physiquement ton téléphone vers la gauche ou la droite.";
    }
  }
  updatePhoneOrientation();
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
  gameplayPaused = true;
  clearGameTimers();
  isAnimating = false;
  clearAttackPreview();
  els.startMenu.hidden = false;
  document.body.classList.add("menu-open");
  document.body.classList.remove("game-running");
  state.handoffPending = false;
  document.body.classList.remove("handoff-open");
  if (els.turnHandoff) els.turnHandoff.hidden = true;
  refreshAccountMenus();
  renderAccountSummary();
  updateMenuSummary();
  // Ambiance du menu : un thème calme, tiré au hasard.
  music.play("menu");
}

function closeStartMenu() {
  if (!els.startMenu) return;
  els.startMenu.hidden = true;
  document.body.classList.remove("menu-open");
  document.body.classList.toggle("game-running", state.started);
  if (state.started) {
    gameplayPaused = false;
    // La partie commence : on bascule sur le lot de thèmes de duel.
    music.play("game");
  }
}

async function startGameFromMenu() {
  await requestLandscapeMode();
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
    <span>${isOnline ? "Salon en ligne : choisis un code à quatre chiffres et donne-le à ton adversaire." : "Partie jouée sur cet écran."}</span>
  `;
  setOnlineStatus(isOnline ? "Vous devez entrer le même code tous les deux." : "");
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
  clearGameTimers();
  isAnimating = false;
  lastTurnStartKey = "";
  gameplayPaused = false;
  clearCinematicEffects();
  clearEnemyFlights();
  // Nouvelle partie ou retour au menu : aucun ciblage ne doit survivre.
  clearAttackPreview();
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

  draw(state.player, STARTING_HAND, { animate: false });
  draw(state.enemy, STARTING_HAND, { animate: false });
  beginTurn(state.player, true);
  const modeLabel = state.mode === "online" ? "2 joueurs en ligne" : state.mode === "pvp" ? "2 joueurs local" : "1 joueur contre IA";
  logEvent(`Spellaho commence en mode ${modeLabel} : 20 points de vie, 7 cartes, un terrain par tour.`);
  debugEvent("GAME_START", { matchId: state.matchId, mode: state.mode });
  debugCheckpoint(state, "newGame");
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
  if (!ROOM_CODE_PATTERN.test(code)) {
    setOnlineStatus("Code invalide : choisis quatre chiffres, et donne-les à ton adversaire.", true);
    return;
  }

  stopOnlineSync({ keepIdentity: true });
  els.startGame.disabled = true;
  setOnlineStatus(`Connexion au salon ${code}...`);

  try {
    await joinServerRoom(code);
  } catch (serverError) {
    try {
      setOnlineStatus("Serveur local indisponible. Connexion directe entre joueurs...");
      await joinPeerRoom(code);
    } catch (peerError) {
      setOnlineStatus(messageReseau(peerError, messageReseau(serverError, "Connexion impossible")), true);
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
  state.network.failures = 0;
  sessionStorage.setItem(PLAYER_ID_KEY, payload.playerId);

  startOnlinePolling();
  handleOnlineRoom(payload.room);
}

// Identité publique de l'hôte sur le service de rendez-vous : c'est elle qui
// fait office de salon quand aucun serveur n'est joignable.
function peerHostId(code) {
  return `spellaho-${code}-host`;
}

async function joinPeerRoom(code) {
  const { default: Peer } = await import(PEERJS_MODULE_URL);
  const profile = profileFromMenu("player");
  const playerId = state.network.playerId || crypto.randomUUID();
  const hostId = peerHostId(code);
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
    setOnlineStatus(`Salon direct ${code} créé. En attente du second joueur...`);
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
    setOnlineStatus(`Connexion directe au salon ${code}...`);
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
      connection.send({ type: "error", message: `Le salon ${state.network.code} a déjà deux joueurs.` });
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
    setOnlineStatus("Le second joueur s'est déconnecté.", true);
    // Seul l'invité peut reprendre l'initiative : l'hôte, lui, se contente
    // d'accepter la prochaine connexion entrante.
    if (role === "guest") planifierReconnexionPeer();
  });
  connection.on("error", handlePeerError);
}

let reconnexionPeerTimer = null;

function planifierReconnexionPeer() {
  window.clearTimeout(reconnexionPeerTimer);
  if (!state.network.enabled || state.network.transport !== "peer") return;
  reconnexionPeerTimer = window.setTimeout(() => {
    const peer = state.network.peer;
    if (!peer || peer.destroyed || state.network.connection?.open) return;
    setOnlineStatus(`Reconnexion au salon direct ${state.network.code}...`, true);
    const connection = peer.connect(peerHostId(state.network.code), {
      reliable: true,
      metadata: {
        playerId: state.network.playerId,
        profile: profileFromMenu("player"),
        deckId: els.playerDeckSelect.value
      }
    });
    attachPeerConnection(connection, "guest");
    // Une tentative ratée ne ferme pas toujours la connexion : on replanifie
    // pour ne pas rester bloqué sur un lien mort.
    planifierReconnexionPeer();
  }, PEER_RECONNECT_MS);
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
  noterContactOnline();
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
    setOnlineStatus(`Salon direct ${state.network.code} synchronisé. Tu contrôles ${sideDisplayName(state.network.slot)}.`);
  }
}

function handlePeerError(error) {
  setOnlineStatus(error?.message || "Connexion directe interrompue", true);
}

function startOnlinePolling() {
  surveillerLiaisonOnline();
  if (state.network.pollTimer) clearInterval(state.network.pollTimer);
  state.network.pollTimer = setInterval(pollOnlineRoom, ONLINE_POLL_MS);
}

function stopOnlineSync(options = {}) {
  window.clearInterval(veilleOnlineTimer);
  window.clearTimeout(reconnexionPeerTimer);
  if (els.onlineBanner) els.onlineBanner.hidden = true;
  if (state.network.pollTimer) clearInterval(state.network.pollTimer);
  if (state.network.publishTimer) clearTimeout(state.network.publishTimer);
  try {
    state.network.connection?.close();
    state.network.peer?.destroy();
  } catch {}
  const playerId = options.keepIdentity ? state.network.playerId : sessionStorage.getItem(PLAYER_ID_KEY) || "";
  state.network = {
    enabled: false,
    code: DEFAULT_ROOM_CODE,
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
    dirty: false,
    failures: 0,
    rejoining: false
  };
}

async function pollOnlineRoom() {
  if (!state.network.enabled || state.network.transport !== "server" || state.network.rejoining) return;

  try {
    const response = await fetch(`./api/room/state?code=${encodeURIComponent(state.network.code)}&playerId=${encodeURIComponent(state.network.playerId)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Synchronisation impossible");
    // Le serveur répond mais ne nous connaît plus : il a redémarré, ou notre
    // place a été rendue après un long silence. Sonder plus longtemps un
    // salon où l'on n'est plus inscrit ne mène nulle part.
    if (!payload.slot && state.network.slot) {
      await rejoindreSalonOnline("Place perdue dans le salon");
      return;
    }
    if (payload.slot) state.network.slot = payload.slot;
    state.network.failures = 0;
    handleOnlineRoom(payload.room);
  } catch (error) {
    state.network.failures = (state.network.failures || 0) + 1;
    const raison = messageReseau(error, "Synchronisation perdue");
    if (state.network.failures >= ONLINE_REJOIN_AFTER_FAILURES) {
      await rejoindreSalonOnline(raison);
      return;
    }
    setOnlineStatus(`${raison} — nouvelle tentative...`, true);
  }
}

// « Failed to fetch » et ses variantes viennent du navigateur, en anglais :
// le joueur n'a pas à les lire au milieu d'une partie.
function messageReseau(error, secours = "Liaison interrompue") {
  const brut = String(error?.message || "").trim();
  if (!brut) return secours;
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(brut)) {
    return "Serveur injoignable";
  }
  return brut;
}

// Reprise de liaison : on refait un join complet en gardant la même
// identité. Le serveur rend sa place au joueur s'il l'a encore, et lui en
// attribue une neuve s'il a redémarré entre-temps.
async function rejoindreSalonOnline(raison = "") {
  if (state.network.rejoining) return;
  state.network.rejoining = true;
  setOnlineStatus(`${raison ? `${raison} : ` : ""}reconnexion au salon ${state.network.code}...`, true);
  try {
    await joinServerRoom(state.network.code);
    state.network.failures = 0;
    setOnlineStatus(`Reconnecté au salon ${state.network.code}.`);
  } catch (error) {
    setOnlineStatus(`Reconnexion impossible : ${messageReseau(error).toLowerCase()}`, true);
  } finally {
    state.network.rejoining = false;
  }
}

function handleOnlineRoom(room) {
  noterContactOnline();
  if (!room) return;
  const hasBothPlayers = Boolean(room.players?.player && room.players?.enemy);
  const playerNames = [
    room.players?.player?.name || "Joueur 1",
    room.players?.enemy?.name || "Joueur 2"
  ];

  if (!hasBothPlayers) {
    setOnlineStatus(`${playerNames[0]} est dans le salon ${state.network.code}. En attente du second joueur...`);
    return;
  }

  setOnlineStatus(`Salon ${state.network.code} connecté : ${playerNames[0]} contre ${playerNames[1]}.`);

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
  logEvent(`Salon ${state.network.code} synchronisé : ${playerProfile.name} affronte ${enemyProfile.name}.`);
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
  noterContactOnline();
  const snapshotErrors = validateGameState(snapshot);
  if (snapshotErrors.length > 0) {
    debugEvent("ONLINE_STATE_REJECTED", { version, errors: snapshotErrors });
    setOnlineStatus("État distant invalide ignoré. Nouvelle synchronisation en attente...", true);
    return false;
  }
  const network = { ...state.network, suppressPublish: true, version, dirty: false };
  const incomingMatchId = snapshot.matchId || "";
  const remoteArrivals =
    state.started &&
    incomingMatchId === state.matchId &&
    snapshot.publishedBy !== state.network.playerId
      ? animateOnlineStateTransitions(snapshot)
      : [];
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
  // L'état distant fait autorité : on purge le ciblage local avant de l'appliquer.
  clearAttackPreview();
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
  for (const unit of remoteArrivals) {
    animateSummonArrival(unit, Boolean(unit.sacrificeOnCast?.length));
  }
  state.network.suppressPublish = false;
  debugCheckpoint(state, "applyOnlineState");
  return true;
}

function animateOnlineStateTransitions(snapshot) {
  const arrivals = [];

  for (const sideName of ["player", "enemy"]) {
    const before = state[sideName];
    const after = snapshot[sideName];
    if (!before || !after) continue;

    const drawn = Math.max(0, (before.deck?.length || 0) - (after.deck?.length || 0));
    for (let i = 0; i < drawn; i += 1) {
      animateDrawCard(sideName, after.hand?.at(-(i + 1)), i * 110);
    }

    const beforeBoard = before.board || [];
    const afterBoard = after.board || [];
    const newUnits = afterBoard.filter((unit) => !beforeBoard.some((entry) => entry.uid === unit.uid));
    arrivals.push(...newUnits);

    const addedGraveyard = (after.graveyard || []).slice(before.graveyard?.length || 0);
    const addedExile = (after.exile || []).slice(before.exile?.length || 0);
    const removedUnits = beforeBoard.filter((unit) => !afterBoard.some((entry) => entry.uid === unit.uid));
    let creatureGraveyardArrivals = 0;

    for (const unit of removedUnits) {
      const evolved = newUnits.some((candidate) => candidate.sacrificeOnCast?.includes(unit.id));
      const exiled = addedExile.some((entry) => entry.id === unit.id);
      animateCardDeparture(unit, sideName, evolved ? "decompose" : exiled ? "exile" : "death");
      if (!exiled) {
        creatureGraveyardArrivals += 1;
        animateGraveyardArrival(sideName, unit, evolved ? 520 : 620);
      }
    }

    const additionalGraveyardCards = Math.max(0, addedGraveyard.length - creatureGraveyardArrivals);
    for (let i = 0; i < additionalGraveyardCards; i += 1) {
      animateGraveyardArrival(sideName, addedGraveyard.at(-(i + 1)), 180 + i * 100);
    }
  }

  return arrivals;
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
    setOnlineStatus(`Salon direct ${state.network.code} synchronisé. Tu contrôles ${sideDisplayName(state.network.slot)}.`);
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
        version: state.network.version,
        state: serializeGameState()
      })
    });
    const payload = await response.json();
    if (response.status === 409 && payload.room?.state) {
      applyOnlineState(payload.room.state, payload.room.version, payload.room);
      setOnlineStatus("Une action plus récente a été conservée.", true);
      return;
    }
    // Le serveur a oublié notre inscription : republier n'aboutira jamais
    // tant qu'on n'a pas repris une place dans le salon.
    if (response.status === 403) {
      await rejoindreSalonOnline("Place perdue dans le salon");
      return;
    }
    if (!response.ok) throw new Error(payload.error || "Publication impossible");
    state.network.version = payload.version || state.network.version;
    setOnlineStatus(`Salon ${state.network.code} synchronisé. Tu contrôles ${sideDisplayName(state.network.slot)}.`);
  } catch (error) {
    setOnlineStatus(messageReseau(error, "Publication impossible"), true);
  } finally {
    state.network.pending = false;
    if (state.network.dirty) {
      state.network.dirty = false;
      scheduleOnlinePublish(true);
    }
  }
}

function setOnlineStatus(message, isError = false) {
  if (els.onlineStatus) {
    els.onlineStatus.textContent = message || "";
    els.onlineStatus.hidden = !message;
    els.onlineStatus.classList.toggle("is-error", Boolean(isError));
  }
  // Le message du menu disparaît avec lui : on le redonne en partie, sans
  // quoi une déconnexion de l'adversaire passe totalement inaperçue.
  updateOnlineBanner(message, isError);
}

// Bandeau réseau de la partie. Il ne s'affiche qu'en ligne, et se replie
// tout seul quand la liaison est saine pour ne pas encombrer le plateau.
let onlineBannerTimer = null;

function updateOnlineBanner(message, isError = false) {
  const banner = els.onlineBanner;
  if (!banner) return;
  const enLigne = state.mode === "online" && state.started;
  if (!enLigne || !message) {
    banner.hidden = true;
    return;
  }
  els.onlineBannerText.textContent = message;
  banner.hidden = false;
  banner.classList.toggle("is-error", Boolean(isError));
  window.clearTimeout(onlineBannerTimer);
  // Une erreur reste affichée ; une information s'efface après lecture.
  if (!isError) onlineBannerTimer = window.setTimeout(() => { banner.hidden = true; }, 4000);
}

// Silence prolongé du camp adverse : en direct comme en salon, aucun
// signal ne distinguait « il réfléchit » de « il a fermé son onglet ».
const ONLINE_SILENCE_MS = 8000;
let dernierContactOnline = 0;
let veilleOnlineTimer = null;

function noterContactOnline() {
  dernierContactOnline = Date.now();
}

function surveillerLiaisonOnline() {
  window.clearInterval(veilleOnlineTimer);
  if (state.mode !== "online") return;
  noterContactOnline();
  veilleOnlineTimer = window.setInterval(() => {
    if (state.mode !== "online" || !state.started) return;
    const silence = Date.now() - dernierContactOnline;
    if (silence > ONLINE_SILENCE_MS) {
      updateOnlineBanner(
        `Aucune nouvelle de ${sideDisplayName(state.network.slot === "player" ? "enemy" : "player")} depuis ${Math.round(silence / 1000)} s.`,
        true
      );
    }
  }, 2000);
}

function isLocalOnlineController() {
  if (state.mode !== "online") return true;
  if (!state.network.slot) return false;
  return state.network.slot === state.currentTurn;
}

function getDeckSpec(id) {
  return DECKS.find((deck) => deck.id === id) || DECKS[0];
}

function cardFitsDeckColors(card, colors) {
  if (card.family === "Incolore") return true;
  const identity = Array.isArray(card.colors) && card.colors.length > 0 ? card.colors : [card.family];
  return identity.every((family) => colors.includes(family));
}

function getDeckComposition(deckSpec) {
  const spellPool = state.spells.filter((card) => cardFitsDeckColors(card, deckSpec.colors));
  const spells = Math.min(DECK_SPELLS, spellPool.length * MAX_NONLAND_COPIES);
  return {
    lands: DECK_LANDS,
    creatures: DECK_SIZE - DECK_LANDS - spells,
    spells
  };
}

function makeDeck(side, deckSpec) {
  // Un terrain entre dans le deck dès qu'il sait produire l'une de ses deux
  // couleurs : les bicolores et le Royaume Céleste seraient sinon exclus,
  // puisque leur `family` ne décrit qu'une partie de ce qu'ils rendent.
  const landsProducing = (color) => state.lands.filter((land) => landProduces(land, color));
  const lands = [
    ...pickCopies(landsProducing(deckSpec.colors[0]), DECK_LANDS / 2, Infinity),
    ...pickCopies(landsProducing(deckSpec.colors[1]), DECK_LANDS / 2, Infinity)
  ];
  // cardFitsDeckColors accepte l'incolore, ce que la comparaison de famille
  // refusait : sans cela, aucune créature incolore ne rejoindrait un deck.
  const creaturePool = state.cards.filter((card) => cardFitsDeckColors(card, deckSpec.colors));
  const spellPool = state.spells.filter((card) => cardFitsDeckColors(card, deckSpec.colors));
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
  if (!side || state.phase === PHASES.OVER) return false;
  const turnKey = makeTurnStartKey(state.matchId, state.turn, side.side);
  if (turnKey === lastTurnStartKey) {
    debugEvent("TURN_START_REJECTED", { reason: "duplicate", turnKey });
    return false;
  }
  lastTurnStartKey = turnKey;
  state.currentTurn = side.side;
  state.phase = PHASES.MAIN_1;
  side.landPlayed = false;
  debugEvent("TURN_START", { side: side.side, turn: state.turn, firstTurn });
  advanceSurvivalCounters(side);
  untapPermanents(side);
  advanceDelayedReturns(side);

  if (!firstTurn) draw(side, 1);

  if (state.phase === PHASES.OVER) return false;

  logEvent(`${sideDisplayName(side.side)} commence son tour. Phase principale : pose un terrain ou lance une carte.`);
  debugCheckpoint(state, "beginTurn");
  return true;
}

function advanceSurvivalCounters(side) {
  for (const creature of side.board) {
    creature.survivedTurns = Math.max(0, Number(creature.survivedTurns) || 0) + 1;
    if (creature.id === "roi-sorcier-connor") {
      buffUnits([creature], 1, 1);
      pushVisualEffect("buff", side.side, "Connor +1/+1");
      logEvent(`La foi grandissante renforce ${creature.name} : +1/+1.`);
      debugEvent("BUFF", { source: creature.id, target: creature.uid, attack: 1, life: 1, permanent: true });
    }
  }
}

function advanceDelayedReturns(side) {
  const ready = tickDelayedReturns(side.graveyard);
  for (const buried of ready) {
    if (side.board.length >= MAX_BOARD) {
      if (!buried.returnBlockedNotified) {
        buried.returnBlockedNotified = true;
        logEvent(`${buried.name} a terminé son errance, mais attend une place sur le champ de bataille.`);
      }
      continue;
    }

    const index = side.graveyard.findIndex((entry) => entry.uid === buried.uid);
    if (index < 0) continue;
    side.graveyard.splice(index, 1);
    const source = state.cards.find((entry) => entry.id === buried.id) || buried;
    const unit = createUnit(source, side.side);
    side.board.push(unit);
    triggerOnPlay(unit, side);
    cleanupBoards();
    pushVisualEffect("summon", side.side, "Retour éternel");
    logEvent(`${unit.name} revient de sa malédiction après trois tours.`);
    debugEvent("EFFECT_TRIGGERED", { source: unit.id, trigger: "delayedReturn", controller: side.side });
    scheduleGameTask(() => animateSummonArrival(unit, false), 80);
  }
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

function draw(side, amount, options = {}) {
  const events = drawFromDeck(side, amount);
  let drawIndex = 0;
  for (const event of events) {
    if (event.type === "fatigue") {
      logEvent(`${sideDisplayName(side.side)} n'a plus de cartes en bibliothèque et perd 1 point de vie.`);
      debugEvent("DAMAGE", { source: "fatigue", target: side.side, amount: event.damage });
      continue;
    }
    if (options.animate !== false) animateDrawCard(side.side, event.card, drawIndex * 110);
    debugEvent("DRAW", { side: side.side, cardId: event.card.id, uid: event.card.uid });
    drawIndex += 1;
  }
  checkVictory();
  return events;
}

function playCardFromHand(side, uid) {
  if (isAnimating || !canActInMain(side)) return;
  if (state.mode === "online" && state.network.slot !== side.side) return;
  const cardIndex = side.hand.findIndex((card) => card.uid === uid);
  if (cardIndex < 0) return;

  const card = side.hand[cardIndex];
  // Timbre distinct selon la nature de la carte posee.
  sound.play(isLand(card) ? "card.place" : isSpell(card) ? "spell.cast" : "creature.summon");
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
  if (isAnimating || !canActInMain(side)) return false;
  const land = side.hand[cardIndex];
  if (!land || !isLand(land)) return false;
  if (side.side === "enemy") animateEnemyPlay(els.enemyLands, land);
  if (side.landPlayed) {
    logEvent(`${sideDisplayName(side.side)} a déjà joué un terrain ce tour-ci.`);
    render();
    return false;
  }

  markOnlineDirty();
  side.hand.splice(cardIndex, 1);
  side.lands.push({
    ...land,
    // Les terrains puissants arrivent engagés : ils ne produisent qu'au tour
    // suivant, sans quoi une capitale à 2 mana ferait sauter une étape de
    // développement dès le tour où on la pose.
    tapped: Boolean(land.entersTapped),
    enteredTurn: state.turn
  });
  side.landPlayed = true;
  logEvent(
    land.entersTapped
      ? `${sideDisplayName(side.side)} pose ${land.name}, qui s'éveillera au prochain tour.`
      : `${sideDisplayName(side.side)} pose ${land.name}.`
  );
  debugEvent("CARD_PLAYED", { side: side.side, cardId: land.id, uid: land.uid, kind: "land" });
  debugCheckpoint(state, "playLand");
  render();
  return true;
}

function playCreature(side, cardIndex) {
  if (isAnimating || !canActInMain(side)) return false;
  const card = side.hand[cardIndex];
  if (!card || !isCreature(card)) return false;
  if (side.side === "enemy") animateEnemyPlay(els.enemyBoard, card);

  if (!isDivineUnlocked(side, card)) {
    logEvent(`${card.name} reste verrouillé : sa condition d'invocation divine n'est pas remplie.`);
    render();
    return false;
  }

  if (!canFitCreatureOnBoard(side, card)) {
    logEvent("Le champ de bataille est plein.");
    render();
    return false;
  }

  if (!canPay(side, card)) {
    rejectCardAction(card.uid, manaPaymentError(side, card, ` pour lancer ${card.name}`));
    render();
    return false;
  }

  markOnlineDirty();
  if (!payMana(side, card)) return false;
  side.hand.splice(cardIndex, 1);
  sacrificeInvocationMaterials(side, card);
  const unit = createUnit(card, side.side);
  side.board.push(unit);
  pushVisualEffect("summon", side.side, "Invocation");
  logEvent(`${sideDisplayName(side.side)} lance ${unit.name}.`);
  debugEvent("CARD_PLAYED", { side: side.side, cardId: card.id, uid: unit.uid, kind: "creature" });
  triggerOnPlay(unit, side);
  cleanupBoards();
  checkVictory();
  render();
  animateSummonArrival(unit, Boolean(card.sacrificeOnCast?.length));
  debugCheckpoint(state, "playCreature");
  return true;
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
  for (const unit of materials) {
    unit.invocationSacrifice = true;
    animateCardDeparture(unit, side.side, "decompose");
    unit.currentLife = 0;
  }
  const subject = materials.map((unit) => unit.name).join(" et ");
  logEvent(
    `${subject} ${materials.length > 1 ? "sont sacrifiés" : "est sacrifié"} pour invoquer ${card.name}.`
  );
  cleanupBoards();
}

function playSpell(side, cardIndex) {
  if (isAnimating || !canActInMain(side)) return false;
  const card = side.hand[cardIndex];
  if (!card || !isSpell(card)) return false;
  if (side.side === "enemy") animateEnemyPlay(els.enemyBoard, card);

  if (!canPay(side, card)) {
    rejectCardAction(card.uid, manaPaymentError(side, card, ` pour lancer ${card.name}`));
    render();
    return false;
  }

  markOnlineDirty();
  if (!payMana(side, card)) return false;
  side.hand.splice(cardIndex, 1);
  side.graveyard.push({ ...card, uid: `${side.side}-grave-${card.id}-${crypto.randomUUID()}` });
  animateGraveyardArrival(side.side, card, 180);
  pushVisualEffect("spell", side.side, "Sort");
  logEvent(`${sideDisplayName(side.side)} lance ${card.name}.`);
  debugEvent("CARD_PLAYED", { side: side.side, cardId: card.id, uid: card.uid, kind: "spell" });
  applySpellEffect(card, side);
  cleanupBoards();
  checkVictory();
  render();
  debugCheckpoint(state, "playSpell");
  return true;
}

// Style Hearthstone : pendant tout ton tour tu peux poser des cartes.
function canActInMain(side) {
  return !gameplayPaused && Boolean(side) && canTakeMainAction(state, side.side);
}

// Tous les terrains dégagés sont mobilisables : la couleur ne contraint plus
// que la part plafonnée du coût, pas son total.
function untappedLandsFor(side) {
  return untappedLandsForCard(side);
}

function canPay(side, card) {
  if (isLand(card)) return canActInMain(side) && !side.landPlayed;
  return canPayCard(side, card);
}

function payMana(side, card) {
  return payCardCost(side, card);
}

// Ce qui manque pour payer. Depuis le plafond de mana coloré, une carte peut
// buter soit sur le total de mana, soit sur la seule part de couleur : on
// retient le blocage le plus fort. Le compte porte sur l'énergie produite,
// pas sur le nombre de terrains, depuis que les capitales en rendent deux.
function manaShortfall(side, card) {
  const requirements = manaRequirements(card);
  if (!requirements) return 0;
  const untapped = untappedLandsFor(side, card);
  const energie = (filtre) => untapped.filter(filtre).reduce((total, land) => total + landEnergy(land), 0);
  let manque = requirements.total - energie(() => true);
  for (const [family, amount] of requirements.colored) {
    manque = Math.max(manque, amount - energie((land) => landProduces(land, family)));
  }
  return Math.max(0, manque);
}

// Le message énonce la règle complète — « il faut 2 vert + 3 libres » — pour
// que le joueur voie que le reste du coût accepte n'importe quel terrain.
function manaPaymentError(side, card, suffix = "") {
  const requirements = manaRequirements(card);
  if (!requirements) return `Mana insuffisant${suffix}.`;
  const parts = requirements.colored.map(([family, amount]) => `${amount} ${family.toLowerCase()}`);
  if (requirements.generic > 0) {
    parts.push(`${requirements.generic} libre${requirements.generic > 1 ? "s" : ""}`);
  }
  if (parts.length === 0) return `Mana insuffisant${suffix}.`;
  return `Mana insuffisant${suffix} : il faut ${parts.join(" + ")}.`;
}

function createUnit(card, owner) {
  return {
    ...card,
    owner,
    uid: `${owner}-unit-${card.id}-${crypto.randomUUID()}`,
    maxLife: card.life,
    currentLife: card.life,
    survivedTurns: 0,
    returnInTurns: null,
    returnBlockedNotified: false,
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

function createAncientDrone(owner) {
  const source = state.spells.find((card) => card.id === "generateur-antique");
  return {
    id: "drone-antique",
    kind: "creature",
    uid: `${owner}-ancient-drone-${crypto.randomUUID()}`,
    owner,
    name: "Drone antique",
    subtitle: "Serviteur de la chaîne d'assemblage",
    family: "Incolore",
    type: "Créature-artefact - Robot antique Drone",
    cost: 0,
    attack: 1,
    life: 1,
    maxLife: 1,
    currentLife: 1,
    keywords: ["Robot antique"],
    abilityName: "Protocole auxiliaire",
    abilityText: "Jeton créé par le Générateur antique.",
    flavor: "",
    image: "Images/Artefact Générateur antique.jpg",
    palette: source?.palette || {
      primary: "#4f6672",
      secondary: "#54cfff",
      deep: "#07131b"
    },
    tapped: false,
    stunTurns: 0,
    createdTurn: state.turn,
    attacking: false,
    blocking: null,
    blockedBy: null,
    token: true
  };
}

function createParasiteLarva(owner) {
  const source = state.cards.find((card) => card.id === "parasite");
  return {
    id: "larve-parasite",
    kind: "creature",
    uid: `${owner}-parasite-larva-${crypto.randomUUID()}`,
    owner,
    name: "Larve parasite",
    subtitle: "Progéniture de la ruche",
    family: "Vert",
    type: "Créature - Larve Parasite",
    cost: 0,
    attack: 1,
    life: 1,
    maxLife: 1,
    currentLife: 1,
    keywords: ["Parasite"],
    abilityName: "Éclosion",
    abilityText: "Jeton créé par la ruche de Rena.",
    flavor: "",
    image: "Images/Parasite.PNG",
    palette: source?.palette || {
      primary: "#4e6a35",
      secondary: "#c1d77d",
      deep: "#0f170b"
    },
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
  debugEvent("EFFECT_TRIGGERED", { source: card.id, effect: card.effect, controller: side.side });

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

  if (card.effect === "tridentUmi") {
    for (const target of opponent.board) target.currentLife -= 3;
    opponent.life -= 2;
    pushVisualEffect("hit", opponent.side, "-2");
    logEvent(`${card.name} inflige 3 blessures à toutes les créatures adverses et 2 au commandant adverse.`);
  }

  // Fléau symétrique : il emporte aussi les créatures de celui qui le lance.
  if (card.effect === "desolation") {
    const emportees = side.board.length + opponent.board.length;
    for (const unit of [...side.board, ...opponent.board]) unit.currentLife = 0;
    pushVisualEffect("hit", opponent.side, "Ruine");
    logEvent(
      emportees > 0
        ? `${card.name} ne laisse rien debout : ${emportees} créature(s) détruite(s), des deux camps.`
        : `${card.name} balaie un champ de bataille déjà vide.`
    );
  }

  if (card.effect === "livreClaudia") {
    draw(side, 3);
    side.life -= 2;
    pushVisualEffect("hit", side.side, "-2");
    logEvent(`${card.name} livre trois pages de savoir et réclame 2 points de vie.`);
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

  if (card.effect === "hubrisFall") {
    const creatures = opponent.board.length;
    const target = strongestCreature(opponent.board);
    if (target) target.currentLife = 0;
    opponent.life -= creatures;
    if (creatures > 0) pushVisualEffect("hit", opponent.side, `-${creatures}`);
    logEvent(
      target
        ? `${card.name} détruit ${target.name} et inflige ${creatures} blessure(s) au héros adverse.`
        : `${card.name} ne trouve aucun orgueil à abattre.`
    );
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

  if (card.effect === "drawThree") {
    draw(side, 3);
    logEvent(`${card.name} fait piocher trois cartes.`);
  }

  if (card.effect === "timelessRivalry") {
    const ally = strongestCreature(side.board);
    const enemy = strongestCreature(opponent.board);
    if (!ally || !enemy) {
      logEvent(`${card.name} ne trouve pas deux rivaux à opposer.`);
    } else {
      resolveCreatureCombat(ally, enemy);
      pushVisualEffect("hit", side.side, "Duel");
      pushVisualEffect("hit", opponent.side, "Duel");
      const survivors = [ally, enemy].filter((unit) => unit.currentLife > 0);
      buffTeam(survivors, 2, 2);
      logEvent(
        `${ally.name} et ${enemy.name} s'affrontent${survivors.length > 0 ? "; chaque survivant gagne +2/+2" : " et tombent ensemble"}.`
      );
    }
  }

  if (card.effect === "unbearableTruth") {
    const discarded = selectHighestCostCards(opponent.hand, 2);

    for (const [index, discardedCard] of discarded.entries()) {
      const handIndex = opponent.hand.findIndex((entry) => entry.uid === discardedCard.uid);
      if (handIndex < 0) continue;
      const [removed] = opponent.hand.splice(handIndex, 1);
      opponent.graveyard.push({
        ...removed,
        uid: `${opponent.side}-grave-${removed.id}-${crypto.randomUUID()}`
      });
      animateGraveyardArrival(opponent.side, removed, 220 + index * 120);
    }

    opponent.life -= 2;
    pushVisualEffect("hit", opponent.side, "-2");
    logEvent(
      discarded.length > 0
        ? `${card.name} révèle l'insoutenable : ${discarded.map((entry) => entry.name).join(" et ")} sont défaussées, puis le héros adverse perd 2 points de vie.`
        : `${card.name} ne trouve aucune pensée à briser, mais inflige 2 blessures au héros adverse.`
    );
  }

  if (card.effect === "cursedPact") {
    side.life -= 1;
    pushVisualEffect("hit", side.side, "-1");
    draw(side, 2);
    logEvent(`${card.name} réclame 1 point de vie et fait piocher deux cartes.`);
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

  if (card.effect === "createAncientDrones") {
    let created = 0;
    while (created < 2 && side.board.length < MAX_BOARD) {
      side.board.push(createAncientDrone(side.side));
      created += 1;
    }
    if (created > 0) {
      pushVisualEffect("summon", side.side, `${created} drone${created > 1 ? "s" : ""}`);
      logEvent(`${card.name} crée ${created} Drone${created > 1 ? "s" : ""} antique${created > 1 ? "s" : ""} 1/1.`);
    }
  }

  if (card.effect === "buffTeam1") {
    buffTeam(side.board, 1, 1);
    logEvent(`${card.name} donne +1/+1 aux créatures alliées.`);
  }

  if (card.effect === "limitlessAssault") {
    const targets = [...side.board]
      .sort((a, b) => b.attack - a.attack || b.currentLife - a.currentLife)
      .slice(0, 2);
    for (const target of targets) target.attack += 2;
    if (targets.length > 0) {
      pushVisualEffect("buff", side.side, "+2 force");
      logEvent(`${card.name} donne +2 force à ${targets.map((target) => target.name).join(" et ")}.`);
    }
  }

  if (card.effect === "drawOneGainOne") {
    draw(side, 1);
    if (state.phase === PHASES.OVER) return;
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
    if (state.phase === PHASES.OVER) return;
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
  debugEvent("EFFECT_TRIGGERED", { source: unit.id, trigger: "onPlay", controller: side.side });

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
    if (state.phase === PHASES.OVER) return;
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

  if (unit.id === "heritage-heros") {
    const allies = side.board.filter((ally) => ally.uid !== unit.uid);
    buffTeam(allies, 2, 2);
    side.life = Math.min(MAX_LIFE, side.life + 6);
    pushVisualEffect("buff", side.side, "Héritage");
    logEvent(
      `${unit.name} rend 6 points de vie et donne +2/+2 à ${allies.length} autre(s) créature(s) alliée(s).`
    );
  }

  if (unit.id === "apocalypse-umi") {
    for (const target of opponent.board) freezeCreature(target);
    opponent.life -= 5;
    pushVisualEffect("freeze", opponent.side, "Déluge");
    pushVisualEffect("hit", opponent.side, "-5");
    logEvent(
      `${unit.name} engage ${opponent.board.length} créature(s) adverse(s) et inflige 5 blessures au héros adverse.`
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

  if (unit.id === "aventurier") {
    side.life = Math.min(MAX_LIFE, side.life + 2);
    pushVisualEffect("buff", side.side, "+2 vie");
    logEvent(`L'Aventurier apporte des soins : ${sideDisplayName(side.side)} gagne 2 points de vie.`);
  }

  if (unit.id === "envoye-bhaal") {
    opponent.life -= 2;
    side.life -= 1;
    pushVisualEffect("hit", opponent.side, "-2");
    logEvent("L'Envoyé de Bhaal inflige 2 blessures au héros adverse et réclame 1 point de vie à son maître.");
  }

  if (unit.id === "homme-requin") {
    const target = strongestCreature(opponent.board);
    if (target) {
      freezeCreature(target);
      pushVisualEffect("freeze", opponent.side, "Chasse");
      logEvent(`L'Homme Requin traque ${target.name}, qui ne se dégagera pas au prochain tour.`);
    }
  }

  if (unit.id === "hero-rena") {
    const parasites = side.board.filter((ally) => ally.uid !== unit.uid && hasKeyword(ally, "Parasite"));
    buffTeam(parasites, 1, 1);
    if (parasites.length > 0) {
      pushVisualEffect("buff", side.side, "Ruche +1/+1");
      logEvent(`Le Héro de Rena renforce ${parasites.length} créature(s) Parasite de +1/+1.`);
    }
  }

  if (unit.id === "orc-contamine") {
    const target = [...opponent.board].sort((a, b) => a.currentLife - b.currentLife || a.attack - b.attack)[0];
    if (target) {
      target.currentLife -= 1;
      pushVisualEffect("hit", opponent.side, "-1");
      logEvent(`L'Orc contaminé percute ${target.name} pour 1 blessure.`);
    }
  }

  if (unit.id === "reine-parasite") {
    let larvae = 0;
    while (side.board.length < MAX_BOARD && larvae < 2) {
      side.board.push(createParasiteLarva(side.side));
      larvae += 1;
    }
    if (larvae > 0) {
      pushVisualEffect("summon", side.side, `${larvae} larve${larvae > 1 ? "s" : ""}`);
      logEvent(`La Reine Parasite fait éclore ${larvae} Larve${larvae > 1 ? "s" : ""} parasite${larvae > 1 ? "s" : ""}.`);
    }
  }

  if (unit.id === "terreur-rena") {
    for (const enemy of opponent.board) enemy.currentLife -= 3;
    if (opponent.board.length > 0) {
      pushVisualEffect("hit", opponent.side, "-3");
      logEvent(`La Terreur de Rena inflige 3 blessures à ${opponent.board.length} créature(s) adverse(s).`);
    }
  }

  if (unit.id === "robot-antique-mage") {
    const allies = ancientRobotAllies(side, unit.uid);
    if (allies.length > 0) {
      draw(side, 1);
      logEvent(`${unit.name} consulte la mémoire de ${allies[0].name} : une carte est piochée.`);
    }
  }

  if (unit.id === "robot-antique-maitre-haches") {
    const allies = ancientRobotAllies(side, unit.uid);
    for (const ally of allies) ally.attack += 1;
    if (allies.length > 0) {
      pushVisualEffect("buff", side.side, "Robots +1 force");
      logEvent(`${unit.name} donne +1 force à ${allies.length} autre(s) Robot(s) antique(s).`);
    }
  }

  if (unit.id === "robot-antique-creation-divine") {
    const allies = ancientRobotAllies(side, unit.uid);
    buffTeam(allies, 1, 1);
    side.life = Math.min(MAX_LIFE, side.life + 3);
    pushVisualEffect("buff", side.side, "Commandement divin");
    logEvent(`${unit.name} renforce ${allies.length} autre(s) Robot(s) antique(s) et rend 3 points de vie.`);
  }

  if (unit.id === "robot-antique-chien") {
    const allies = ancientRobotAllies(side, unit.uid);
    if (allies.length > 0) {
      side.life = Math.min(MAX_LIFE, side.life + 2);
      pushVisualEffect("buff", side.side, "+2 vie");
      logEvent(`${unit.name} reconnaît un ancien allié et rend 2 points de vie.`);
    }
  }

  if (unit.id === "robot-antique-fleau-flammes") {
    for (const enemy of opponent.board) enemy.currentLife -= 2;
    if (opponent.board.length > 0) {
      pushVisualEffect("hit", opponent.side, "-2");
      logEvent(`${unit.name} inflige 2 blessures à ${opponent.board.length} créature(s) adverse(s).`);
    }
  }

  if (unit.id === "robot-antique-chasseur") {
    const target = strongestCreature(opponent.board);
    if (target) {
      freezeCreature(target);
      pushVisualEffect("freeze", opponent.side, "Traque glacée");
      logEvent(`${unit.name} verrouille ${target.name}, qui ne se dégagera pas au prochain tour.`);
    }
  }

  if (unit.id === "robot-antique-petit-compagnon") {
    const target = strongestCreature(ancientRobotAllies(side, unit.uid));
    if (target) {
      buffTeam([target], 0, 1);
      side.life = Math.min(MAX_LIFE, side.life + 1);
      pushVisualEffect("buff", side.side, "+0/+1");
      logEvent(`${unit.name} encourage ${target.name}, qui gagne +0/+1, et rend 1 point de vie.`);
    }
  }

  if (unit.id === "robot-antique-argonien") {
    const allies = ancientRobotAllies(side, unit.uid);
    const target = strongestCreature(opponent.board);
    if (allies.length > 0 && target) {
      freezeCreature(target);
      pushVisualEffect("freeze", opponent.side, "Marée calculée");
      logEvent(`${unit.name} engage ${target.name} grâce aux calculs de son réseau antique.`);
    }
  }

  if (unit.id === "robot-antique-khajiit") {
    const allies = ancientRobotAllies(side, unit.uid);
    buffTeam(allies, 0, 1);
    if (allies.length > 0) {
      pushVisualEffect("buff", side.side, "Robots +0/+1");
      logEvent(`${unit.name} donne +0/+1 à ${allies.length} autre(s) Robot(s) antique(s).`);
    }
  }

  if (unit.id === "mage-supreme-claudia") {
    draw(side, 2);
    logEvent(`${unit.name} ouvre les archives célestes : deux cartes sont piochées.`);
  }

  if (unit.id === "mage-supreme-dominica") {
    opponent.life -= 2;
    side.life = Math.min(MAX_LIFE, side.life + 2);
    pushVisualEffect("hit", opponent.side, "-2");
    pushVisualEffect("buff", side.side, "+2 vie");
    logEvent(`${unit.name} draine 2 points de vie au héros adverse.`);
  }

  if (unit.id === "comte-thaelion") {
    const alliedAethran = side.board.some(
      (ally) => ally.uid !== unit.uid && ally.id === "diplomate-aethran" && ally.currentLife > 0
    );
    if (alliedAethran) {
      opponent.life -= 2;
      pushVisualEffect("hit", opponent.side, "-2");
      logEvent(`${unit.name} honore le pacte d'Aethran et inflige 2 blessures au héros adverse.`);
    }
  }

  if (unit.id === "diplomate-aethran") {
    opponent.life -= 1;
    pushVisualEffect("hit", opponent.side, "-1");
    const alliedThaelion = side.board.some(
      (ally) => ally.uid !== unit.uid && ally.id === "comte-thaelion" && ally.currentLife > 0
    );
    if (alliedThaelion) {
      const [discarded] = selectHighestCostCards(opponent.hand, 1);
      const handIndex = discarded
        ? opponent.hand.findIndex((entry) => entry.uid === discarded.uid)
        : -1;
      if (handIndex >= 0) {
        const [removed] = opponent.hand.splice(handIndex, 1);
        opponent.graveyard.push({
          ...removed,
          uid: `${opponent.side}-grave-${removed.id}-${crypto.randomUUID()}`
        });
        animateGraveyardArrival(opponent.side, removed, 220);
        logEvent(`${unit.name} coûte 1 point de vie au héros adverse et lui fait défausser ${removed.name}.`);
      } else {
        logEvent(`${unit.name} coûte 1 point de vie au héros adverse, mais sa main est vide.`);
      }
    } else {
      logEvent(`${unit.name} soutire 1 point de vie au héros adverse.`);
    }
  }

  checkVictory();
}

function ancientRobotAllies(side, excludedUid = null) {
  return side.board.filter((unit) => unit.uid !== excludedUid && hasKeyword(unit, "Robot antique"));
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
  if (gameplayPaused || isAnimating || state.phase === PHASES.OVER || !isCurrentSideHuman()) return;
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
  if (gameplayPaused || isAnimating || state.phase === PHASES.OVER || !isCurrentSideHuman()) return;
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
  const wasSelected = state.selectedAttackerId === uid;
  state.selectedAttackerId = wasSelected ? null : uid;
  debugEvent("TARGET_SELECTED", { attacker: wasSelected ? null : uid, kind: "attacker" });
  sound.play(wasSelected ? "card.deselect" : "card.select");
  render();
}

function attackUnit(targetUid) {
  // Toute sortie anticipée doit purger le ciblage, sinon la flèche et la
  // surbrillance survivent à une attaque qui n'a jamais eu lieu.
  if (gameplayPaused || isAnimating || state.phase === PHASES.OVER || !isCurrentSideHuman() || !state.selectedAttackerId) {
    resetAttackState();
    return;
  }
  const attackingSide = getCurrentSide();
  const defendingSide = getDefendingSide();
  const attacker = attackingSide.board.find((unit) => unit.uid === state.selectedAttackerId);
  const target = defendingSide.board.find((unit) => unit.uid === targetUid);
  if (!attacker || !target) {
    resetAttackState();
    return;
  }

  if (!canAttack(attacker)) {
    debugEvent("ATTACK_REJECTED", { reason: "attacker-not-ready", attacker: attacker.uid });
    resetAttackState();
    return;
  }

  if (!canTargetUnit(attacker, target, defendingSide)) {
    logEvent(`${target.name} est protégé : frappe d'abord une créature avec Défenseur.`);
    resetAttackState();
    return;
  }

  markOnlineDirty();
  const attackerNode = boardCardNode(attacker.uid, attackingSide.side);
  const targetRect = boardCardNode(target.uid, defendingSide.side)?.getBoundingClientRect();
  // La visee tactile doit disparaitre des que l'attaque est acceptee, sans
  // attendre la fin de l'animation de charge.
  clearAttackPreview();
  playLunge(attackerNode, targetRect, () => {
    flashImpact(defendingSide.side);
    resolveSingleAttack(attacker, target, attackingSide, defendingSide);
  });
}

function attackHero() {
  // Mêmes garanties de purge que attackUnit : aucune sortie sans nettoyage.
  if (gameplayPaused || isAnimating || state.phase === PHASES.OVER || !isCurrentSideHuman() || !state.selectedAttackerId) {
    resetAttackState();
    return;
  }
  const attackingSide = getCurrentSide();
  const defendingSide = getDefendingSide();
  const attacker = attackingSide.board.find((unit) => unit.uid === state.selectedAttackerId);
  if (!attacker) {
    resetAttackState();
    return;
  }

  if (!canAttack(attacker)) {
    debugEvent("ATTACK_REJECTED", { reason: "attacker-not-ready", attacker: attacker.uid });
    resetAttackState();
    return;
  }

  if (!canTargetHero(attacker, defendingSide)) {
    logEvent(`${sideDisplayName(defendingSide.side)} est protégé par une créature avec Défenseur.`);
    resetAttackState();
    return;
  }

  markOnlineDirty();
  const attackerNode = boardCardNode(attacker.uid, attackingSide.side);
  const targetRect = commanderNode(defendingSide.side)?.getBoundingClientRect();
  clearAttackPreview();
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
  const matchId = state.matchId;
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
    if (gameplayPaused || state.matchId !== matchId) return;
    isAnimating = false;
    done();
  };
  attackerNode.addEventListener("animationend", finish, { once: true });
  scheduleGameTask(finish, 380, matchId);
}

function flashImpact(sideName) {
  sound.play("attack.impact");
  const mat = document.querySelector(`.${sideName}-mat`);
  if (!mat) return;
  mat.classList.remove("is-hit-shake");
  void mat.offsetWidth;
  mat.classList.add("is-hit-shake");
  setTimeout(() => mat.classList.remove("is-hit-shake"), 360);
}

// Résolution immédiate d'une attaque : l'attaquant frappe, la cible riposte.
function resolveSingleAttack(attacker, target, attackingSide, defendingSide) {
  if (
    state.phase === PHASES.OVER ||
    state.currentTurn !== attackingSide.side ||
    !attackingSide.board.some((unit) => unit.uid === attacker?.uid) ||
    !canAttack(attacker) ||
    (target && !defendingSide.board.some((unit) => unit.uid === target.uid)) ||
    (target && !canTargetUnit(attacker, target, defendingSide)) ||
    (!target && !canTargetHero(attacker, defendingSide))
  ) {
    debugEvent("ATTACK_REJECTED", { reason: "stale-resolution", attacker: attacker?.uid, target: target?.uid });
    resetAttackState();
    return false;
  }
  if (!hasKeyword(attacker, "Vigilance")) attacker.tapped = true;
  attacker.hasAttacked = true;
  // Attaque résolue : le ciblage disparaît avant même l'application des dégâts.
  clearAttackPreview();
  state.selectedAttackerId = null;

  if (!target) {
    const damage = Math.max(0, finiteNumber(attacker.attack));
    defendingSide.life -= damage;
    gainLifeFromDamage(attacker, attackingSide, damage);
    pushVisualEffect("attack", attackingSide.side, "Assaut");
    pushVisualEffect("hit", defendingSide.side, `-${damage}`);
    logEvent(`${attacker.name} frappe ${sideDisplayName(defendingSide.side)} pour ${damage} blessure(s).`);
    debugEvent("DAMAGE", { source: attacker.uid, target: defendingSide.side, amount: damage });
  } else {
    const combat = resolveCreatureCombat(attacker, target);
    gainLifeFromDamage(attacker, attackingSide, combat.attackDamage);
    gainLifeFromDamage(target, defendingSide, combat.retaliationDamage);
    pushVisualEffect("hit", defendingSide.side, `-${combat.attackDamage}`);
    if (combat.retaliationDamage > 0) pushVisualEffect("hit", attackingSide.side, `-${combat.retaliationDamage}`);
    logEvent(`${attacker.name} attaque ${target.name} : ${combat.attackDamage} contre ${combat.retaliationDamage}.`);
    debugEvent("DAMAGE", { source: attacker.uid, target: target.uid, amount: combat.attackDamage });
    debugEvent("DAMAGE", { source: target.uid, target: attacker.uid, amount: combat.retaliationDamage });
  }

  debugEvent("ATTACK", { attacker: attacker.uid, target: target?.uid || defendingSide.side });

  triggerParasiteVengeance(attacker, defendingSide);
  cleanupBoards();
  checkVictory();
  render();
  debugCheckpoint(state, "resolveSingleAttack");
  return true;
}

function triggerParasiteVengeance(attacker, defendingSide) {
  if (!attacker || attacker.currentLife <= 0) return;
  const damage = parasiteVengeanceDamage(defendingSide.board);
  if (damage <= 0) return;

  attacker.currentLife -= damage;
  pushVisualEffect("hit", attacker.owner, `-${damage}`);
  logEvent(`La vengeance de Rena frappe ${attacker.name} pour ${damage} blessures.`);
  debugEvent("EFFECT_TRIGGERED", { source: "parasite", target: attacker.uid, damage });
}

function endCurrentTurn() {
  if (gameplayPaused || state.phase === PHASES.OVER || state.handoffPending) return false;
  markOnlineDirty();
  const endingSide = state.currentTurn;
  const nextSide = getDefendingSide();
  sound.play("turn.end");
  clearCombatFlags();
  if (state.currentTurn === "enemy") state.turn += 1;
  debugEvent("TURN_END", { side: endingSide, turn: state.turn });

  if (state.mode === "pve" && nextSide.side === "enemy") {
    state.currentTurn = "enemy";
    state.phase = PHASES.MAIN_1;
    render();
    scheduleGameTask(enemyTurn, 450);
    return true;
  }

  const started = beginTurn(nextSide);
  if (started && state.mode === "pvp" && state.phase !== PHASES.OVER) showTurnHandoff(nextSide);
  render();
  return started;
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
  if (gameplayPaused || state.mode !== "pve" || state.currentTurn !== "enemy" || state.phase === PHASES.OVER) return;
  if (!beginTurn(state.enemy) || state.phase === PHASES.OVER) {
    render();
    return;
  }
  enemyPlayMainPhase();
  render();
  if (state.phase !== PHASES.OVER) scheduleGameTask(enemyAttackStep, 350);
}

// L'IA attaque une créature à la fois, avec animation, puis enchaîne — comme
// un vrai tour Hearthstone. Échanges favorables privilégiés, provocations gérées.
function enemyAttackStep() {
  if (gameplayPaused || state.mode !== "pve" || state.currentTurn !== "enemy" || state.phase === PHASES.OVER) {
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
    const resolved = resolveSingleAttack(attacker, target, me, foe);
    if (resolved && state.phase !== PHASES.OVER) scheduleGameTask(enemyAttackStep, 280);
  });
}

function enemyPlayMainPhase() {
  if (state.phase === PHASES.OVER || state.currentTurn !== "enemy") return;
  enemyPlayLand();
  if (state.phase === PHASES.OVER) return;
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
  let guard = 0;
  while (played && state.phase !== PHASES.OVER && state.currentTurn === "enemy" && guard < 80) {
    guard += 1;
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
      played = isSpell(affordable)
        ? playSpell(state.enemy, index)
        : playCreature(state.enemy, index);
    }
  }
  if (guard >= 80) debugEvent("AI_LOOP_GUARD", { hand: state.enemy.hand.length });
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
    case "hubrisFall":
      return opponent.board.length > 0;
    case "tridentUmi":
      // Utile même sans créature en face : il touche aussi le commandant.
      return true;
    // Fléau symétrique : ne vaut le coup que si l'adversaire y perd plus.
    case "desolation":
      return opponent.board.length > side.board.length;
    case "livreClaudia":
      return side.deck.length > 0 && side.life > 2;
    case "timelessRivalry":
      return side.board.length > 0 && opponent.board.length > 0;
    case "unbearableTruth":
      return opponent.hand.length > 0 || opponent.life > 0;
    case "cursedPact":
      return side.deck.length > 0 && side.life > 1;
    case "restoreTeam":
      return side.board.some((unit) => unit.currentLife < unit.maxLife);
    case "buffTeam1":
    case "buffTeamAttack1":
    case "toughTeam":
    case "vengeanceUldrid":
    case "crownUlgod":
    case "limitlessAssault":
      return side.board.length > 0;
    case "createTwoZombies":
    case "createGuardian":
    case "createAncientDrones":
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
    case "drawTwo":
    case "drawThree":
      return side.deck.length > 0;
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
  if (card.id === "apocalypse-umi") return 900;
  if (card.id === "heritage-heros") return 800;
  return card.cost * 10 + (card.attack || 0) + (isSpell(card) ? 8 : 0);
}

function finishEnemyTurn() {
  if (state.mode !== "pve" || state.currentTurn !== "enemy" || state.phase === PHASES.OVER) return;
  endCurrentTurn();
}

function gainLifeFromDamage(unit, side, amount) {
  if (amount <= 0 || !hasKeyword(unit, "Lien de vie")) return;
  side.life = Math.min(MAX_LIFE, side.life + amount);
  debugEvent("HEAL", { source: unit.uid, target: side.side, amount });
  logEvent(`${sideDisplayName(side.side)} gagne ${amount} point${amount > 1 ? "s" : ""} de vie grâce à ${unit.name}.`);
}

function canAttack(unit) {
  return canUnitAttack(unit, state.turn);
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
  buffUnits(units, attack, life);
  if (units.length > 0) {
    debugEvent("BUFF", { targets: units.map((unit) => unit.uid), attack, life, permanent: true });
  }
}

function cleanupBoards() {
  const allBefore = [...state.player.board, ...state.enemy.board];

  for (const side of [state.player, state.enemy]) {
    const { living, dead } = partitionDeadUnits(side.board);
    if (dead.length > 0) sound.play("creature.death");
    side.board = living;
    for (const unit of dead) {
      const destination = unit.exiled ? side.exile : side.graveyard;
      if (!unit.invocationSacrifice) {
        animateCardDeparture(unit, side.side, unit.exiled ? "exile" : "death");
      }
      if (!unit.exiled) {
        animateGraveyardArrival(side.side, unit, unit.invocationSacrifice ? 520 : 620);
      }
      destination.push({
        ...unit,
        invocationSacrifice: false,
        returnInTurns: !unit.exiled && Number.isFinite(Number(unit.returnDelayTurns))
          ? Math.max(1, Math.trunc(Number(unit.returnDelayTurns)))
          : null,
        returnBlockedNotified: false,
        attacking: false,
        blocking: null,
        blockedBy: null,
        tapped: false,
        uid: `${side.side}-${unit.exiled ? "exile" : "grave"}-${unit.id}-${crypto.randomUUID()}`
      });
      pushVisualEffect(unit.exiled ? "exile" : "death", side.side, unit.exiled ? "Exil" : "Cimetière");
      logEvent(`${unit.name} va ${unit.exiled ? "en exil" : "au cimetière"}.`);
      if (!unit.exiled && Number.isFinite(Number(unit.returnDelayTurns))) {
        logEvent(`${unit.name} reviendra après ${Math.max(1, Math.trunc(Number(unit.returnDelayTurns)))} de ses tours.`);
      }
      debugEvent("DEATH", { side: side.side, cardId: unit.id, uid: unit.uid, exiled: Boolean(unit.exiled) });
      debugEvent(unit.exiled ? "CARD_TO_EXILE" : "CARD_TO_GRAVEYARD", { side: side.side, cardId: unit.id });

      if (unit.id === "zombie-parasite" && !unit.exiled && side.board.length < MAX_BOARD) {
        side.board.push(createParasiteLarva(side.side));
        pushVisualEffect("summon", side.side, "Éclosion");
        logEvent("Le Zombie parasité éclot et laisse une Larve parasite 1/1.");
      }
    }
  }

  // L'attaquant sélectionné a pu mourir ou quitter le plateau : le ciblage suit.
  if (
    state.selectedAttackerId &&
    ![...state.player.board, ...state.enemy.board].some((unit) => unit.uid === state.selectedAttackerId)
  ) {
    resetAttackState({ rerender: false });
  }

  const deaths = allBefore.filter((unit) => unit.currentLife <= 0).length;
  if (deaths > 0) {
    for (const noxis of [...state.player.board, ...state.enemy.board].filter((unit) => unit.id === "noxis")) {
      noxis.attack += deaths;
    }
  }
}

function clearCombatFlags() {
  // Un changement de tour doit toujours effacer un ciblage en cours.
  clearAttackPreview();
  state.selectedBlockerId = null;
  state.selectedAttackerId = null;
  for (const unit of [...state.player.board, ...state.enemy.board]) {
    unit.attacking = false;
    unit.blocking = null;
    unit.blockedBy = null;
  }
}

function hasKeyword(unit, keyword) {
  return unitHasKeyword(unit, keyword);
}

function keywordKey(keyword) {
  return normalizeKeyword(keyword);
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
/*   survived : ces créatures doivent être en jeu depuis N tours du joueur */
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

  if (clause.survived) {
    for (const requirement of clause.survived) {
      const ready = board.some(
        (unit) =>
          unit.id === requirement.id &&
          unit.currentLife > 0 &&
          (Number(unit.survivedTurns) || 0) >= requirement.turns
      );
      if (!ready) return false;
    }
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
  for (const requirement of clause.survived || []) {
    const unit = board
      .filter((entry) => entry.id === requirement.id && entry.currentLife > 0)
      .sort((a, b) => (Number(b.survivedTurns) || 0) - (Number(a.survivedTurns) || 0))[0];
    const progress = Math.min(Number(unit?.survivedTurns) || 0, requirement.turns);
    parts.push({
      text: `${label(requirement.id)} en jeu depuis ${progress}/${requirement.turns} tours`,
      done: progress >= requirement.turns
    });
  }
  return parts;
}

function checkVictory() {
  if (state.phase === PHASES.OVER || !state.player || !state.enemy) return;
  const winner = determineWinner(state.player, state.enemy);
  if (!winner) return;

  state.phase = PHASES.OVER;
  state.winner = winner;
  clearGameTimers();
  isAnimating = false;
  sound.play("hero.death");
  const soundWinner = state.winner;
  scheduleGameTask(() => sound.play(soundWinner === "player" ? "game.victory" : "game.defeat"), 320);
  if (state.winner === "draw") {
    logEvent("Les deux héros tombent en même temps : égalité !");
  } else {
    const loser = state.winner === "player" ? "enemy" : "player";
    logEvent(`${sideDisplayName(loser)} tombe à 0 point de vie. ${sideDisplayName(state.winner)} remporte la partie !`);
  }
  debugEvent("GAME_OVER", { winner: state.winner, turn: state.turn });
  debugCheckpoint(state, "checkVictory");
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
  const nextTurnLabel = phaseLabel();
  if (els.turnPill.textContent !== nextTurnLabel) {
    els.turnPill.textContent = nextTurnLabel;
    els.turnPill.classList.remove("is-turn-change");
    void els.turnPill.offsetWidth;
    els.turnPill.classList.add("is-turn-change");
  }
  els.actionHint.textContent = getActionHint();

  const playerCommander = commanderNode("player");
  const enemyCommander = commanderNode("enemy");
  playerCommander?.classList.toggle("is-active-turn", state.currentTurn === "player" && state.phase !== PHASES.OVER);
  enemyCommander?.classList.toggle("is-active-turn", state.currentTurn === "enemy" && state.phase !== PHASES.OVER);

  updateButtons();
  renderHand();
  renderLands(els.playerLands, state.player.lands, "player");
  renderLands(els.enemyLands, state.enemy.lands, "enemy");
  renderEnemyHand();
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
    zone.classList.toggle("has-cards", pile.length > 0);
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
  // Une carte adverse encore en vol signifie que l'action précédente n'est
  // pas terminée à l'écran : rendre la main au joueur maintenant lui ferait
  // jouer par-dessus une animation qu'il n'a pas fini de lire.
  const foePlaying = enemyFlights.size > 0;
  const playing = state.phase !== PHASES.OVER && isCurrentSideHuman() && !foePlaying;
  const waitingForOpponent = state.phase !== PHASES.OVER && !playing;
  els.endTurn.disabled = !playing;
  els.endTurn.classList.toggle("is-opponent-turn", waitingForOpponent);
  els.endTurn.textContent = waitingForOpponent ? "Tour adverse" : "Fin du tour";

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
  const mobileLandscape = isPhoneLandscape();
  const measuredHandWidth = els.playerHand.clientWidth || window.innerWidth;
  const handWidth = mobileLandscape
    ? Math.max(220, measuredHandWidth)
    : Math.max(320, measuredHandWidth);
  // Cartes de main agrandies de 7 % : les trois bornes suivent le même
  // facteur pour que le gain soit constant à toutes les hauteurs d'écran
  // (58 -> 62, 68 -> 73, 0.155 -> 0.166).
  const cardWidth = mobileLandscape
    ? Math.max(62, Math.min(73, window.innerHeight * 0.166))
    : 160;
  const maximumSpan = mobileLandscape ? handWidth * 0.92 : handWidth - 48;
  const naturalSpan = cardWidth * side.hand.length;
  const overlap = side.hand.length > 1
    ? Math.max(-cardWidth * (mobileLandscape ? 0.72 : 0.55), Math.min(0, (maximumSpan - naturalSpan) / (side.hand.length - 1)))
    : 0;
  const maximumRotation = mobileLandscape
    ? Math.min(3, 1.2 + side.hand.length * 0.25)
    : Math.min(8, 2.5 + side.hand.length * 0.65);
  const maximumDrop = mobileLandscape ? 2 : Math.min(9, 4 + side.hand.length * 0.45);
  for (const [index, card] of side.hand.entries()) {
    const node = renderCard(card, { mode: "hand" });
    const offset = index - handCenter;
    const normalizedOffset = handCenter === 0 ? 0 : offset / handCenter;
    node.style.setProperty("--hand-card-width", `${cardWidth}px`);
    node.style.setProperty("--hand-rotation", `${normalizedOffset * maximumRotation}deg`);
    node.style.setProperty("--hand-drop", `${Math.pow(Math.abs(normalizedOffset), 1.65) * maximumDrop}px`);
    node.style.setProperty("--hand-layer", `${50 + Math.round(handCenter - Math.abs(offset))}`);
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

// Main adverse : uniquement des dos de cartes. Le joueur voit qu'une main
// existe et combien elle compte, jamais son contenu. Le compte est plafonné
// pour que l'éventail reste lisible sur un écran de téléphone.
function renderEnemyHand() {
  if (!els.enemyHand) return;
  const foe = state.enemy;
  const total = foe?.hand?.length || 0;
  const affichees = Math.min(total, 7);
  // On ne compte que les dos : le badge de surplus ne doit pas fausser
  // la comparaison, sinon l'éventail se reconstruit à chaque rendu.
  const existantes = els.enemyHand.querySelectorAll(".enemy-hand-card").length;
  if (existantes === affichees) return; // évite de reconstruire à chaque rendu

  els.enemyHand.innerHTML = "";
  const centre = (affichees - 1) / 2;
  for (let i = 0; i < affichees; i += 1) {
    const dos = document.createElement("span");
    dos.className = "enemy-hand-card";
    const offset = centre === 0 ? 0 : (i - centre) / centre;
    dos.style.setProperty("--foe-card-rotation", `${offset * 7}deg`);
    dos.style.setProperty("--foe-card-drop", `${Math.pow(Math.abs(offset), 1.7) * 5}px`);
    dos.style.setProperty("--foe-card-index", String(i));
    els.enemyHand.append(dos);
  }
  els.enemyHand.dataset.count = String(total);
  // Au-delà du plafond d'affichage, un badge dit combien de cartes ne sont
  // pas représentées : le joueur ne doit pas croire qu'il en reste sept.
  if (total > affichees) {
    const surplus = document.createElement("span");
    surplus.className = "enemy-hand-overflow";
    surplus.textContent = `+${total - affichees}`;
    els.enemyHand.append(surplus);
  }

  // Le dernier dos arrivé s'installe brièvement : la main adverse réagit
  // visiblement à la pioche au lieu de changer silencieusement de taille.
  if (affichees > existantes && !prefersReducedEffects()) {
    const arrivee = els.enemyHand.lastElementChild;
    arrivee?.classList.add("is-arriving");
    window.setTimeout(() => arrivee?.classList.remove("is-arriving"), 420);
  }
}

// L'adversaire joue : le dos de carte quitte sa main, traverse le plateau
// et se pose. Sans cela la carte apparaît d'un coup, ce qui empêche de
// comprendre ce qui vient de se passer.
function animateEnemyPlay(destination, card = null, delay = 0) {
  if (!els.enemyHand || prefersReducedEffects()) return;
  const source = els.enemyHand.lastElementChild;
  const cible = validEffectRect(destination) || validEffectRect(els.enemyBoard);
  const depart = validEffectRect(source) || validEffectRect(els.enemyHand);
  if (!cible || !depart || !els.effectLayer) return;

  // Le dos quitte VRAIMENT l'éventail : sans cela la carte serait visible
  // à deux endroits pendant tout son vol, ce qui casse l'illusion.
  source?.remove();

  const vol = document.createElement("span");
  vol.className = "enemy-hand-card is-flying";
  vol.style.left = `${depart.left}px`;
  vol.style.top = `${depart.top}px`;
  vol.style.width = `${depart.width}px`;
  vol.style.height = `${depart.height}px`;
  vol.style.setProperty("--foe-fly-x", `${cible.left + cible.width / 2 - depart.left - depart.width / 2}px`);
  vol.style.setProperty("--foe-fly-y", `${cible.top + cible.height / 2 - depart.top - depart.height / 2}px`);
  vol.style.animationDelay = `${delay}ms`;
  // Deux faces : le dos reste visible jusqu'au retournement, près de la
  // destination. La face n'est jamais révélée au départ.
  const dos = document.createElement("span");
  dos.className = "foe-side foe-side--back";
  const face = document.createElement("span");
  face.className = "foe-side foe-side--front";
  if (card?.image) face.style.setProperty("--foe-art", cssUrl(card.image));
  vol.append(dos, face);
  els.effectLayer.append(vol);
  enemyFlights.add(vol);
  window.setTimeout(() => {
    vol.remove();
    enemyFlights.delete(vol);
    // Le contrôle ne revient qu'une fois la dernière carte posée.
    if (enemyFlights.size === 0 && state.started) updateButtons();
  }, 560 + delay);
}

// Toute carte adverse encore en vol, pour pouvoir les purger sur reset.
const enemyFlights = new Set();

function clearEnemyFlights() {
  for (const vol of enemyFlights) vol.remove();
  enemyFlights.clear();
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
    const survivalGoal = survivalGoalForUnit(unit);
    if (survivalGoal > 0) {
      const timer = document.createElement("span");
      const progress = Math.min(Number(unit.survivedTurns) || 0, survivalGoal);
      timer.className = `evolution-timer${progress >= survivalGoal ? " is-ready" : ""}`;
      timer.textContent = `⏳ ${progress}/${survivalGoal}`;
      timer.title = progress >= survivalGoal ? "Évolution débloquée" : "Tours survécus";
      node.append(timer);
    }
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

function survivalGoalForUnit(unit) {
  let goal = 0;
  for (const card of state.cards) {
    for (const clause of card.divine?.any || []) {
      for (const requirement of clause.survived || []) {
        if (requirement.id === unit.id) goal = Math.max(goal, Number(requirement.turns) || 0);
      }
    }
  }
  return goal;
}

// Clic sur une créature du plateau (style Hearthstone) :
// - une de tes créatures prêtes => on la sélectionne comme attaquante ;
// - une créature adverse, quand un attaquant est sélectionné => attaque immédiate ;
// - sinon => fiche détaillée de la carte.
function handleBoardCardClick(unit, sideName) {
  const myTurn = isCurrentSideHuman() && state.phase !== PHASES.OVER;

  // Sur PC, un clic simple sert toujours à inspecter la carte. L'attaque se
  // fait par glisser-déposer ou depuis le bouton d'action de la fiche.
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    if (myTurn && sideName !== state.currentTurn && state.selectedAttackerId) {
      attackUnit(unit.uid);
      return;
    }
    openCardDetail(unit, { zone: "board", side: sideName });
    return;
  }

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
  pointerId: null,
  pointerType: "",
  ghost: null,
  suppressClick: false
};
let handRenderPending = false;

// Raison courte et actionnable d'un refus, affichée au joueur.
function unplayableReason(side, card) {
  if (!canActInMain(side)) return "Ce n'est pas le moment de jouer cette carte.";
  if (isLand(card)) return "Tu as déjà posé un terrain ce tour.";
  if (card.divine && !isDivineUnlocked(side, card)) {
    return `${card.name} exige encore ses conditions d'invocation.`;
  }
  if (!canPay(side, card)) {
    return manaPaymentError(side, card);
  }
  if (!isSpell(card) && !canFitCreatureOnBoard(side, card)) return "Ton terrain est déjà plein.";
  return "Cette carte ne peut pas être jouée maintenant.";
}

function attachPlayDrag(node, card, side) {
  node.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.pointerType === "mouse" && event.buttons !== 1) return;
    if (!isPlayableFromHand(side, card)) {
      // Une carte injouable ne doit pas rester muette. Le refus n'apparaît
      // qu'au premier vrai geste de jeu : un simple tap continue d'ouvrir
      // la fiche sans déclencher d'alerte.
      const seuil = event.pointerType === "touch" ? 5 : 9;
      const startX = event.clientX;
      const startY = event.clientY;
      const cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
      };
      const onMove = (move) => {
        if (Math.hypot(move.clientX - startX, move.clientY - startY) < seuil) return;
        cleanup();
        rejectCardAction(node, unplayableReason(side, card));
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", cleanup);
      window.addEventListener("pointercancel", cleanup);
      return;
    }
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
  if (dragState.pending) resetDrag();
  dragState.pending = true;
  dragState.active = false;
  dragState.mode = spec.mode;
  dragState.node = spec.node;
  dragState.card = spec.card || null;
  dragState.side = spec.side || null;
  dragState.uid = spec.uid || null;
  dragState.startX = event.clientX;
  dragState.startY = event.clientY;
  dragState.pointerId = event.pointerId;
  dragState.pointerType = event.pointerType || "";
  dragState.suppressClick = false;
  if (spec.node.setPointerCapture) {
    try {
      spec.node.setPointerCapture(event.pointerId);
    } catch {}
  }
}

function onDragPointerMove(event) {
  if (!dragState.pending || event.pointerId !== dragState.pointerId) return;
  if (event.cancelable) event.preventDefault();
  if (!dragState.active) {
    const moved = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    const threshold = dragState.pointerType === "touch" ? 5 : 9;
    if (moved < threshold) return;
    activateDrag(event);
  }
  updateDrag(event);
}

function activateDrag(event) {
  dragState.active = true;
  dragState.suppressClick = true;
  document.body.classList.add("is-dragging");
  ensureDragLayer();

  if (dragState.mode === "play") {
    const rect = dragState.node.getBoundingClientRect();
    const ghost = dragState.node.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    dragLayerEl.append(ghost);
    dragState.ghost = ghost;
    dragState.node.classList.add("is-drag-source");
    playDropField()?.classList.add("is-drop-ready");
    navigator.vibrate?.(12);
  } else {
    setDragArrowVisible(true);
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
    playDropField()?.classList.toggle("is-drop-target", overField);
  } else {
    const rect = dragState.node.getBoundingClientRect();
    drawAimArrow(rect.left + rect.width / 2, rect.top + rect.height / 2, event.clientX, event.clientY);
    highlightAttackTarget(event.clientX, event.clientY);
  }
}

function onDragPointerUp(event) {
  hideAttackArrowVisual();
  if (!dragState.pending || event.pointerId !== dragState.pointerId) return;
  const wasActive = dragState.active;
  const suppressClick = dragState.suppressClick;
  if (wasActive) {
    if (dragState.mode === "play") finishPlayDrag(event);
    else finishAttackDrag(event);
  }
  resetDrag();
  flushPendingHandRender();
  if (suppressClick) {
    // Empêche le clic « fiche » de suivre un vrai glisser.
    const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
    document.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 0);
  }
}

function onDragPointerCancel(event) {
  hideAttackArrowVisual();
  if (!dragState.pending || event.pointerId !== dragState.pointerId) return;
  resetDrag();
  flushPendingHandRender();
}

function finishPlayDrag(event) {
  if (isOverPlayField(event.clientX, event.clientY) && dragState.card && dragState.side) {
    navigator.vibrate?.(22);
    playCardFromHand(dragState.side, dragState.card.uid);
  }
}

function finishAttackDrag(event) {
  const target = attackTargetAt(event.clientX, event.clientY);
  const attackerUid = dragState.uid;
  // Relâchement hors d'une cible valide : on annule tout le ciblage.
  if (!target) {
    resetAttackState();
    return;
  }
  state.selectedAttackerId = attackerUid;
  if (target.type === "hero") attackHero();
  else attackUnit(target.uid);
}

function resetDrag() {
  if (dragState.node?.hasPointerCapture?.(dragState.pointerId)) {
    try {
      dragState.node.releasePointerCapture(dragState.pointerId);
    } catch {}
  }
  if (dragState.ghost) dragState.ghost.remove();
  dragState.node?.classList.remove("is-drag-source", "is-attacking");
  document.body.classList.remove("is-dragging");
  els.playerBoard?.closest(".mat-zone--field")?.classList.remove("is-drop-target");
  els.playerBoard?.closest(".mat-zone--field")?.classList.remove("is-drop-ready");
  els.enemyBoard?.closest(".mat-zone--field")?.classList.remove("is-drop-target");
  els.enemyBoard?.closest(".mat-zone--field")?.classList.remove("is-drop-ready");
  clearAttackTargetHighlight();
  setDragArrowVisible(false);
  dragState.pending = false;
  dragState.active = false;
  dragState.mode = null;
  dragState.node = null;
  dragState.card = null;
  dragState.side = null;
  dragState.uid = null;
  dragState.pointerId = null;
  dragState.pointerType = "";
  dragState.ghost = null;
  dragState.suppressClick = false;
  discardDragLayer();
}

// Nettoyage purement visuel du ciblage : flèche, surbrillances, capture de
// pointeur. Ne touche pas à l'état logique, donc appelable pendant un rendu.
// Refus d'action : le joueur doit comprendre POURQUOI rien ne se passe.
// Secousse courte sur la carte concernée + teinte d'erreur + son, plutôt
// qu'un échec silencieux ou une boîte de dialogue bloquante.
// `cible` accepte le nœud directement (cas du glisser, où on l'a déjà) ou
// un uid (cas des refus levés depuis le moteur). Les cartes en main ne
// portent pas de data-uid, d'où la recherche par uid qui échouait seule.
function rejectCardAction(cible, message) {
  const node = cible instanceof Element
    ? cible
    : els.playerHand?.querySelector(`.game-card[data-uid="${cssAttr(cible)}"]`);
  if (node && !prefersReducedEffects()) {
    node.classList.remove("is-rejected");
    void node.offsetWidth;
    node.classList.add("is-rejected");
    window.setTimeout(() => node.classList.remove("is-rejected"), 420);
  }
  sound.play("ui.reject");
  navigator.vibrate?.(18);
  if (message) logEvent(message);
}

function clearAttackPreview() {
  setDragArrowVisible(false);
  clearAttackTargetHighlight();
  resetDrag();
}

// Point d'entrée unique pour annuler un ciblage, quelle qu'en soit la raison.
// Tout chemin qui interrompt une attaque doit passer par ici.
function resetAttackState({ rerender = true } = {}) {
  clearAttackPreview();
  if (!state.selectedAttackerId) return;
  state.selectedAttackerId = null;
  for (const unit of [...(state.player?.board || []), ...(state.enemy?.board || [])]) {
    unit.attacking = false;
  }
  if (rerender) render();
}

function flushPendingHandRender() {
  if (!handRenderPending || dragState.pending || !state.started) return;
  handRenderPending = false;
  renderHand();
}

function playDropField() {
  const board = dragState.side?.side === "enemy" ? els.enemyBoard : els.playerBoard;
  return board?.closest(".mat-zone--field") || board || null;
}

function isOverPlayField(x, y) {
  const field = playDropField();
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
  const defendingBoard = defender.side === "player" ? els.playerBoard : els.enemyBoard;
  const defendingCommander = commanderNode(defender.side);

  const enemyCard = el.closest("#enemy-board .game-card, #player-board .game-card");
  if (enemyCard && defendingBoard?.contains(enemyCard)) {
    const unit = defender.board.find((u) => u.uid === enemyCard.dataset.uid);
    if (unit && canTargetUnit(attacker, unit, defender)) return { type: "unit", uid: unit.uid };
    return null;
  }
  if (defendingCommander?.contains(el) && canTargetHero(attacker, defender)) {
    return { type: "hero" };
  }
  return null;
}

function highlightAttackTarget(x, y) {
  clearAttackTargetHighlight();
  const target = attackTargetAt(x, y);
  if (!target) return;
  if (target.type === "hero") {
    commanderNode(getDefendingSide().side)?.classList.add("is-drop-target");
  } else {
    const board = getDefendingSide().side === "player" ? els.playerBoard : els.enemyBoard;
    const node = board?.querySelector(`.game-card[data-uid="${cssAttr(target.uid)}"]`);
    node?.classList.add("is-drop-hit");
  }
}

function clearAttackTargetHighlight() {
  commanderNode("player")?.classList.remove("is-drop-target");
  commanderNode("enemy")?.classList.remove("is-drop-target");
  for (const n of document.querySelectorAll(".game-card.is-drop-hit")) n.classList.remove("is-drop-hit");
}

function cssAttr(value) {
  return String(value).replace(/["\\]/g, "\\$&");
}

/* --- Calque de glisser : fantôme de carte + flèche de visée --- */
let dragLayerEl = null;
let dragArrowEl = null;

function setDragArrowVisible(visible) {
  if (!dragArrowEl) return;
  dragArrowEl.hidden = !visible;
  dragArrowEl.classList.toggle("is-visible", visible);
  if (!visible) dragArrowEl.querySelector(".drag-arrow-line")?.removeAttribute("d");
}

function hideAttackArrowVisual() {
  setDragArrowVisible(false);
}

function discardDragLayer() {
  dragLayerEl?.remove();
  dragLayerEl = null;
  dragArrowEl = null;
}

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

// La galerie complète est passée dans cartes.html : on ne rend plus ici
// qu'un décompte. Construire 128 cartes et autant d'illustrations dans le
// panneau latéral coûtait cher pour un contenu qui doublonnait la page
// Collection. Le bloc est conservé, mais réduit à son résumé.
function renderGallery() {
  if (els.gallery) els.gallery.innerHTML = "";
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

// Le cadre d'illustration doit toujours être rempli. Le champ `art.position`
// permet de conserver le sujet principal lors du recadrage.
function artImgStyle(card) {
  const art = card.art;
  if (!art?.position) return "";
  return ` style="object-position:${art.position}"`;
}

// Medaillon d'element : l'icone remplace le nom de couleur ecrit en toutes
// lettres, illisible sur telephone. Le libelle reste accessible aux
// lecteurs d'ecran, et une famille sans icone - Multicolore - garde son
// texte.
function elementRibbon(card) {
  const element = state.elements?.[card.family];
  if (!element?.icone) {
    return `<span class="family-ribbon">${escapeHtml(element?.nom || card.family)}</span>`;
  }
  return `<span class="family-ribbon family-ribbon--element" title="${escapeHtml(element.nom)}">` +
    `<img src="${encodeURI(element.icone)}" alt="${escapeHtml(element.nom)}" loading="lazy" decoding="async" />` +
    `</span>`;
}

function renderCard(card, options = {}) {
  const article = document.createElement("article");
  article.className = options.mode === "gallery" ? "gallery-card" : "game-card";
  if (card.name.length > 16) article.classList.add("long-card-title");
  if (card.name.length > 22) article.classList.add("very-long-card-title");
  article.dataset.cardId = card.id;
  article.dataset.cardKind = card.kind;
  article.dataset.cardFamily = card.family;
  // Le CSS s'en sert pour remplir le cadre par defaut, et ne contenir
  // l'illustration que sur les cartes qui le demandent.
  article.dataset.artFit = card.art?.fit || card.art?.svgFit || "cover";
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
    ${elementRibbon(card)}
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
  sound.play("ui.menuOpen");
  hideCardPreview();
  state.detailContext = { card, context };

  els.cardModalCard.innerHTML = "";
  const detailCard = renderCard(card, { mode: "detail" });
  els.cardModalCard.append(detailCard);
  playCardDetailVideo(card, detailCard);
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
  scheduleCardDetailFit();
}

let cardDetailFitFrame = 0;

function scheduleCardDetailFit() {
  if (!els.cardModal || els.cardModal.hidden) return;
  cancelAnimationFrame(cardDetailFitFrame);
  cardDetailFitFrame = requestAnimationFrame(fitCardDetailText);
}

// La carte conserve son ratio et son cadre. Sur les écrans bas, seules les
// tailles typographiques internes sont ajustées, selon le débordement réel.
// Cela évite les corrections propres à chaque modèle de téléphone.
function fitCardDetailText() {
  cardDetailFitFrame = 0;
  if (!els.cardModal || els.cardModal.hidden) return;

  const content = els.cardModalCard?.querySelector(".card-content");
  const titleBox = content?.querySelector(".card-title-lockup");
  const title = content?.querySelector(".card-name");
  const textBox = content?.querySelector(".card-scroll");
  if (!content || !titleBox || !title || !textBox) return;

  content.style.removeProperty("--detail-title-font-size");
  content.style.removeProperty("--detail-ability-font-size");
  content.style.removeProperty("--detail-tag-font-size");

  const cardWidth = content.getBoundingClientRect().width;
  let titleSize = Math.min(16, Math.max(8, cardWidth * 0.062));
  let abilitySize = Math.min(12, Math.max(7, cardWidth * 0.041));
  let tagSize = Math.min(9, Math.max(6, cardWidth * 0.031));

  const applySizes = () => {
    content.style.setProperty("--detail-title-font-size", `${titleSize.toFixed(2)}px`);
    content.style.setProperty("--detail-ability-font-size", `${abilitySize.toFixed(2)}px`);
    content.style.setProperty("--detail-tag-font-size", `${tagSize.toFixed(2)}px`);
  };

  applySizes();
  while (title.scrollHeight > titleBox.clientHeight + 0.5 && titleSize > 7) {
    titleSize -= 0.4;
    applySizes();
  }

  let attempts = 0;
  while (textBox.scrollHeight > textBox.clientHeight + 0.5 && attempts < 18) {
    abilitySize = Math.max(5.8, abilitySize - 0.35);
    tagSize = Math.max(5.2, tagSize - 0.2);
    applySizes();
    attempts += 1;
  }

  content.dataset.textFits = String(
    title.scrollHeight <= titleBox.clientHeight + 0.5 &&
    textBox.scrollHeight <= textBox.clientHeight + 0.5
  );
}

function playCardDetailVideo(card, detailCard) {
  if (!card.video || !detailCard) return;
  const art = detailCard.querySelector(".card-art");
  if (!art) return;

  const video = document.createElement("video");
  video.className = "card-art-video";
  video.src = encodeURI(card.video);
  video.poster = encodeURI(card.image);
  video.preload = "metadata";
  video.playsInline = true;
  video.controls = false;
  video.muted = false;
  video.volume = 1;
  video.disablePictureInPicture = true;
  video.disableRemotePlayback = true;
  video.tabIndex = -1;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("disablepictureinpicture", "");
  video.setAttribute("disableremoteplayback", "");
  video.setAttribute("aria-hidden", "true");
  video.addEventListener("ended", () => {
    video.classList.add("is-finished");
  }, { once: true });
  video.addEventListener("error", () => {
    detailCard.classList.remove("has-card-video");
    video.remove();
  }, { once: true });

  detailCard.classList.add("has-card-video");
  art.append(video);

  const playback = video.play();
  playback?.catch(() => {
    video.muted = true;
    video.play().catch(() => {});
  });
}

function closeCardDetail() {
  state.detailContext = null;
  if (!els.cardModal) return;
  cancelAnimationFrame(cardDetailFitFrame);
  cardDetailFitFrame = 0;
  if (!els.cardModal.hidden) sound.play("ui.menuClose");
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
    if (card.returnInTurns !== null && card.returnInTurns !== undefined && Number.isFinite(Number(card.returnInTurns))) {
      const timer = document.createElement("span");
      timer.className = "delayed-return-timer";
      timer.textContent = Number(card.returnInTurns) > 0
        ? `Retour dans ${card.returnInTurns} tour${Number(card.returnInTurns) > 1 ? "s" : ""}`
        : "Retour prêt";
      node.append(timer);
    }
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
    const familles = landFamilies(card);
    const couleurs = familles.map((famille) => famille.toLowerCase());
    // Un terrain à plusieurs couleurs n'en rend qu'une : « au choix » évite
    // de laisser croire qu'il produit un mana de chacune.
    const production = couleurs.length > 1
      ? `${couleurs.slice(0, -1).join(", ")} ou ${couleurs.at(-1)}, au choix`
      : couleurs[0] || "incolore";
    const quantite = landEnergy(card);
    const arrivee = card.entersTapped ? " Arrive engagé." : "";
    return `Terrain - produit ${quantite} mana ${production}.${arrivee}`;
  }

  if (isSpell(card)) {
    return `Coût ${card.cost} - ${card.type}`;
  }

  const lifeText = card.currentLife === undefined ? card.life : `${card.currentLife}/${card.maxLife}`;
  return `Coût ${card.cost} - Force ${card.attack} - Vie ${lifeText}`;
}

function availableMana(side) {
  return side.lands.filter((land) => !land.tapped).reduce((total, land) => total + landEnergy(land), 0);
}

// Mana disponible détaillé par couleur, ex. « 2V 1B » : indispensable depuis
// que chaque carte exige des terrains de sa propre couleur.
const MANA_INITIALS = { Blanc: "B", Bleu: "U", Noir: "N", Rouge: "R", Vert: "V" };

// Un terrain polyvalent est compté à part — « 1BU » — parce qu'il ne rend
// qu'un mana au choix : l'afficher dans les deux couleurs ferait croire à
// deux mana disponibles.
function manaLabel(land) {
  return landFamilies(land).map((family) => MANA_INITIALS[family] || family[0]).join("");
}

function describeManaPool(side) {
  const free = side.lands.filter((land) => !land.tapped);
  if (side.lands.length === 0) return "0";
  const counts = new Map();
  for (const land of free) {
    const key = manaLabel(land);
    counts.set(key, (counts.get(key) || 0) + landEnergy(land));
  }
  if (counts.size === 0) return `0/${side.lands.length}`;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, n]) => `${n}${label}`)
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
  // Le journal a ete retire du panneau lateral : sans garde, chaque rendu
  // leverait une erreur et interromprait la partie.
  if (!els.log) return;
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

function prefersReducedEffects() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ensureCinematicFxLayer() {
  let layer = document.querySelector("#cinematic-fx-layer");
  if (layer) return layer;
  layer = document.createElement("div");
  layer.id = "cinematic-fx-layer";
  layer.className = "cinematic-fx-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);
  return layer;
}

function clearCinematicEffects() {
  document.querySelector("#cinematic-fx-layer")?.replaceChildren();
  for (const zone of document.querySelectorAll(".is-drawing-card, .is-graveyard-active")) {
    zone.classList.remove("is-drawing-card", "is-graveyard-active");
  }
}

function matZone(sideName, zoneName) {
  return document.querySelector(`.${sideName}-mat .mat-zone--${zoneName}`);
}

function validEffectRect(node) {
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

function animateDrawCard(sideName, card, delay = 0) {
  // Le son de pioche reste joue meme si les effets visuels sont reduits.
  if (state.started) window.setTimeout(() => sound.play("card.draw"), delay);
  if (!state.started || prefersReducedEffects()) return;
  const library = matZone(sideName, "library");
  const source = validEffectRect(library);
  if (!source) return;

  const visibleHand = getVisibleHandSide()?.side === sideName;
  // La main adverse existe désormais à l'écran : la carte piochée la
  // rejoint réellement, au lieu de se perdre vers le portrait.
  const foeHand = sideName === "enemy" && els.enemyHand?.children.length ? els.enemyHand : null;
  const fallbackTarget = foeHand
    || matZone(sideName, "commander")
    || document.querySelector(`.${sideName}-mat`);
  const target = validEffectRect(visibleHand ? els.playerHand : fallbackTarget);
  if (!target) return;

  const width = Math.max(34, Math.min(68, source.width * 0.42));
  const height = width * 1.46;
  const fromX = source.left + source.width / 2 - width / 2;
  const fromY = source.top + source.height * 0.42 - height / 2;
  const toX = target.left + target.width / 2 - width / 2;
  const toY = visibleHand
    ? target.top + Math.min(28, target.height * 0.22)
    : foeHand
      ? target.top + target.height / 2 - height / 2
      : target.top + target.height * 0.3 - height / 2;

  const flight = document.createElement("div");
  flight.className = `draw-card-flight ${sideName}`;
  flight.title = card?.name || "Carte piochée";
  flight.style.width = `${width}px`;
  flight.style.height = `${height}px`;
  flight.style.setProperty("--draw-from-x", `${fromX}px`);
  flight.style.setProperty("--draw-from-y", `${fromY}px`);
  flight.style.setProperty("--draw-to-x", `${toX}px`);
  flight.style.setProperty("--draw-to-y", `${toY}px`);
  flight.style.setProperty("--draw-delay", `${delay}ms`);
  ensureCinematicFxLayer().append(flight);

  window.setTimeout(() => {
    library.classList.remove("is-drawing-card");
    void library.offsetWidth;
    library.classList.add("is-drawing-card");
  }, delay);
  window.setTimeout(() => library.classList.remove("is-drawing-card"), delay + 780);
  window.setTimeout(() => flight.remove(), delay + 1050);

  // Le compteur du deck réagit au moment où la carte le quitte réellement,
  // et non au prochain rendu : sans cela le chiffre baisse avant que la
  // carte n'ait bougé, ou longtemps après qu'elle soit arrivée.
  const compteur = library.querySelector(".mat-zone-count");
  if (compteur) {
    window.setTimeout(() => {
      compteur.classList.remove("is-counting");
      void compteur.offsetWidth;
      compteur.classList.add("is-counting");
    }, delay + 120);
    window.setTimeout(() => compteur.classList.remove("is-counting"), delay + 560);
  }
}

function animateCardDeparture(unit, sideName, mode) {
  if (prefersReducedEffects()) return;
  const sourceNode = boardCardNode(unit.uid, sideName);
  const source = validEffectRect(sourceNode);
  if (!source) return;

  const destinationName = mode === "exile" ? "exile" : "graveyard";
  const destination = validEffectRect(matZone(sideName, destinationName));
  const dx = destination ? destination.left + destination.width / 2 - (source.left + source.width / 2) : 0;
  const dy = destination ? destination.top + destination.height / 2 - (source.top + source.height / 2) : 0;
  const copy = sourceNode.cloneNode(true);
  copy.className = `cinematic-card-copy compact is-${mode}`;
  copy.removeAttribute("data-uid");
  copy.querySelector(".evolution-timer")?.remove();
  copy.style.left = `${source.left}px`;
  copy.style.top = `${source.top}px`;
  copy.style.width = `${source.width}px`;
  copy.style.height = `${source.height}px`;
  copy.style.setProperty("--departure-x", `${dx}px`);
  copy.style.setProperty("--departure-y", `${dy}px`);
  ensureCinematicFxLayer().append(copy);

  spawnCardParticles(source, mode, unit.palette?.secondary);
  window.setTimeout(() => copy.remove(), mode === "decompose" ? 1150 : 1000);
}

function spawnCardParticles(rect, mode, color) {
  const layer = ensureCinematicFxLayer();
  const count = mode === "decompose" ? 22 : 14;
  const tone = color || (mode === "death" ? "#a697c4" : "#f2d17a");

  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + (i % 3) * 0.19;
    const distance = Math.max(rect.width, rect.height) * (0.28 + (i % 5) * 0.075);
    const particle = document.createElement("i");
    particle.className = `card-fx-particle is-${mode}`;
    particle.style.left = `${rect.left + rect.width * (0.25 + ((i * 37) % 50) / 100)}px`;
    particle.style.top = `${rect.top + rect.height * (0.2 + ((i * 23) % 60) / 100)}px`;
    particle.style.setProperty("--particle-x", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--particle-y", `${Math.sin(angle) * distance - (mode === "decompose" ? 30 : 0)}px`);
    particle.style.setProperty("--particle-delay", `${(i % 6) * 28}ms`);
    particle.style.setProperty("--particle-tone", tone);
    layer.append(particle);
    window.setTimeout(() => particle.remove(), 1250);
  }
}

function animateGraveyardArrival(sideName, card, delay = 0) {
  if (prefersReducedEffects()) return;
  window.setTimeout(() => {
    const graveyard = matZone(sideName, "graveyard");
    const rect = validEffectRect(graveyard);
    if (!rect) return;

    graveyard.classList.remove("is-graveyard-active");
    void graveyard.offsetWidth;
    graveyard.classList.add("is-graveyard-active");

    const vortex = document.createElement("div");
    vortex.className = `graveyard-vortex ${sideName}`;
    vortex.title = `${card?.name || "Une carte"} rejoint le cimetière`;
    vortex.style.left = `${rect.left + rect.width / 2}px`;
    vortex.style.top = `${rect.top + rect.height / 2}px`;
    vortex.style.width = `${Math.max(54, rect.width * 0.78)}px`;
    vortex.style.height = `${Math.max(54, rect.height * 0.58)}px`;
    ensureCinematicFxLayer().append(vortex);

    window.setTimeout(() => graveyard.classList.remove("is-graveyard-active"), 900);
    window.setTimeout(() => vortex.remove(), 1050);
  }, delay);
}

function animateSummonArrival(unit, isInvocation) {
  if (prefersReducedEffects()) return;
  window.requestAnimationFrame(() => {
    const node = boardCardNode(unit.uid, unit.owner);
    if (!node) return;
    node.classList.add(isInvocation ? "is-divine-arrival" : "is-summon-arrival");
    window.setTimeout(
      () => node.classList.remove("is-divine-arrival", "is-summon-arrival"),
      isInvocation ? 1250 : 750
    );
  });
}

function preloadImages() {
  const urls = new Set([
    PLAYMATS.player,
    PLAYMATS.enemy,
    PLAYMATS.mobile,
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
