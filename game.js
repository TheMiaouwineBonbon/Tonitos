const COLORS = ["Blanc", "Bleu", "Noir", "Rouge", "Vert"];
const PHASES = {
  MAIN_1: "main1",
  COMBAT: "combat",
  BLOCK: "block",
  MAIN_2: "main2",
  OVER: "over"
};

const state = {
  cards: [],
  lands: [],
  spells: [],
  player: null,
  enemy: null,
  selectedBlockerId: null,
  currentTurn: "player",
  phase: PHASES.MAIN_1,
  turn: 1,
  log: [],
  detailContext: null,
  mode: "pve",
  playerDeckId: "blanc-vert",
  enemyDeckId: "rouge-noir",
  started: false,
  network: {
    enabled: false,
    code: "1234",
    playerId: sessionStorage.getItem("tonitos-player-id") || "",
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
  cardCountSummary: document.querySelector("#card-count-summary"),
  deckAudit: document.querySelector("#deck-audit"),
  boardStage: document.querySelector(".board-stage"),
  pileModal: document.querySelector("#pile-modal"),
  pileModalGrid: document.querySelector("#pile-modal-grid"),
  pileModalTitle: document.querySelector("#pile-modal-title"),
  pileModalEmpty: document.querySelector("#pile-modal-empty"),
  pileModalClose: document.querySelector("#pile-modal-close"),
  cardPreview: document.querySelector("#card-preview")
};

const MAX_BOARD = 7;
const STARTING_LIFE = 20;
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
  els.endTurn?.addEventListener("click", advancePhase);
  els.attackHero?.addEventListener("click", primaryCombatAction);
  els.clearLog?.addEventListener("click", () => {
    state.log = [];
    markOnlineDirty();
    render();
  });
  els.cardModalClose?.addEventListener("click", closeCardDetail);
  els.cardModalAction?.addEventListener("click", runDetailAction);
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
    if (!els.cardModal.hidden) closeCardDetail();
    else if (els.pileModal && !els.pileModal.hidden) closePileViewer();
  });
  window.addEventListener("resize", hideCardPreview);
  window.addEventListener("scroll", hideCardPreview, true);
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

  const selects = [els.playerAvatarSelect, els.enemyAvatarSelect].filter(Boolean);
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
  updateMenuSummary();
}

function openStartMenu() {
  if (!els.startMenu) return;
  els.startMenu.hidden = false;
  document.body.classList.add("menu-open");
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
  if (roomCodeControl) roomCodeControl.hidden = !isOnline;
  if (els.enemyNameInput) els.enemyNameInput.disabled = isOnline;
  if (els.enemyAvatarSelect) els.enemyAvatarSelect.disabled = isOnline;
  if (els.enemyDeckSelect) els.enemyDeckSelect.disabled = isOnline;
  updateAvatarPreviews();
  els.menuDeckSummary.innerHTML = `
    <strong>Format construit Tonitos</strong>
    <span>60 cartes exactes, 24 terrains et 4 exemplaires maximum par carte non-terrain.</span>
    <span>${escapeHtml(profileFromMenu("player").name)} : ${escapeHtml(playerDeck.shortName)} · ${playerComposition.creatures} créatures · ${playerComposition.spells} sorts.</span>
    <span>${enemyLabel} : ${escapeHtml(enemyDeck.shortName)} · ${enemyComposition.creatures} créatures · ${enemyComposition.spells} sorts.</span>
    <span>${isOnline ? `Salon en ligne : entre le code ${ONLINE_ROOM_CODE}, puis attends le second joueur.` : "Partie jouée sur cet écran."}</span>
  `;
  setOnlineStatus(isOnline ? "Code provisoire : 1234." : "");
}

function profileFromMenu(sideName) {
  const source = sideName === "player"
    ? {
        name: els.playerNameInput?.value,
        avatar: els.playerAvatarSelect?.value
      }
    : {
        name: els.enemyNameInput?.value,
        avatar: els.enemyAvatarSelect?.value
      };
  return normalizeClientProfile(sideName, source);
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
  return {
    name: String(profile.name || fallback.name).trim().slice(0, 24) || fallback.name,
    avatar: profile.avatar || fallback.avatar
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
  state.currentTurn = "player";
  state.phase = PHASES.MAIN_1;
  state.turn = 1;
  state.log = [];
  state.started = true;
  closeCardDetail();
  closeStartMenu();

  draw(state.player, STARTING_HAND);
  draw(state.enemy, STARTING_HAND);
  beginTurn(state.player, true);
  const modeLabel = state.mode === "online" ? "2 joueurs en ligne" : state.mode === "pvp" ? "2 joueurs local" : "1 joueur contre IA";
  logEvent(`Tonitos commence en mode ${modeLabel} : 20 points de vie, 7 cartes, un terrain par tour.`);
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
  sessionStorage.setItem("tonitos-player-id", payload.playerId);

  startOnlinePolling();
  handleOnlineRoom(payload.room);
}

async function joinPeerRoom(code) {
  const { default: Peer } = await import(PEERJS_MODULE_URL);
  const profile = profileFromMenu("player");
  const playerId = state.network.playerId || crypto.randomUUID();
  const hostId = `tonitos-${code}-host`;
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
  sessionStorage.setItem("tonitos-player-id", playerId);

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
  const playerId = options.keepIdentity ? state.network.playerId : sessionStorage.getItem("tonitos-player-id") || "";
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
    currentTurn: state.currentTurn,
    phase: state.phase,
    turn: state.turn,
    log: state.log,
    publishedBy: state.network.playerId,
    publishedAt: Date.now()
  };
}

function applyOnlineState(snapshot, version, room) {
  const network = { ...state.network, suppressPublish: true, version, dirty: false };
  state.mode = "online";
  state.started = Boolean(snapshot.started);
  state.playerDeckId = snapshot.playerDeckId || state.playerDeckId;
  state.enemyDeckId = snapshot.enemyDeckId || state.enemyDeckId;
  state.player = snapshot.player;
  state.enemy = snapshot.enemy;
  state.selectedBlockerId = snapshot.selectedBlockerId || null;
  state.currentTurn = snapshot.currentTurn || "player";
  state.phase = snapshot.phase || PHASES.MAIN_1;
  state.turn = snapshot.turn || 1;
  state.log = Array.isArray(snapshot.log) ? snapshot.log : [];
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
  if (state.phase === PHASES.BLOCK) return state.network.slot === getDefendingSide().side;
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
  const counts = new Map();
  const picks = [
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
    if (used < maxCopies) {
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
    if (used < maxCopies) {
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
    creature.blocking = null;
    creature.blockedBy = null;
  }
}

function draw(side, amount) {
  for (let i = 0; i < amount; i += 1) {
    const next = side.deck.shift();
    if (!next) {
      side.life -= 1;
      logEvent(`${side.side === "player" ? "Tu n'as" : "L'adversaire n'a"} plus de bibliotheque et perd 1 point de vie.`);
      continue;
    }
    side.hand.push(next);
  }
}

function playCardFromHand(side, uid) {
  if (!canActInMain(side)) return;
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
    logEvent(`${side.side === "player" ? "Tu as" : "L'adversaire a"} deja joue un terrain ce tour-ci.`);
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
  logEvent(`${side.side === "player" ? "Tu poses" : "L'adversaire pose"} ${land.name}.`);
  render();
}

function playCreature(side, cardIndex) {
  const card = side.hand[cardIndex];

  if (side.board.length >= MAX_BOARD) {
    logEvent("Le champ de bataille est plein.");
    render();
    return;
  }

  if (!canPay(side, card)) {
    logEvent(`Pas assez de mana degage pour lancer ${card.name}.`);
    render();
    return;
  }

  markOnlineDirty();
  payMana(side, card);
  side.hand.splice(cardIndex, 1);
  const unit = createUnit(card, side.side);
  side.board.push(unit);
  pushVisualEffect("summon", side.side, "Invocation");
  logEvent(`${side.side === "player" ? "Tu lances" : "L'adversaire lance"} ${unit.name}.`);
  triggerOnPlay(unit, side);
  cleanupBoards();
  checkVictory();
  render();
}

function playSpell(side, cardIndex) {
  const card = side.hand[cardIndex];

  if (!canPay(side, card)) {
    logEvent(`Pas assez de mana degage pour lancer ${card.name}.`);
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

function canActInMain(side) {
  return (
    state.currentTurn === side.side &&
    (state.phase === PHASES.MAIN_1 || state.phase === PHASES.MAIN_2)
  );
}

function canPay(side, card) {
  if (isLand(card)) return canActInMain(side) && !side.landPlayed;
  const untapped = side.lands.filter((land) => !land.tapped);
  const matching = card.family === "Incolore" || untapped.some((land) => land.family === card.family);
  return untapped.length >= card.cost && matching;
}

function payMana(side, card) {
  const landsToTap = [];
  const matching = side.lands.find((land) => !land.tapped && land.family === card.family);
  if (matching) landsToTap.push(matching);

  for (const land of side.lands) {
    if (landsToTap.length >= card.cost) break;
    if (!land.tapped && !landsToTap.includes(land)) landsToTap.push(land);
  }

  for (const land of landsToTap) {
    land.tapped = true;
  }
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
    abilityText: "Cette creature ne peut etre bloquee que par une creature avec le vol.",
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

  if (card.effect === "buffTeamAttack1") {
    for (const ally of side.board) ally.attack += 1;
    logEvent(`${card.name} donne +1 force à tes créatures.`);
  }

  if (card.effect === "drainHero2") {
    opponent.life -= 2;
    side.life = Math.min(STARTING_LIFE + 10, side.life + 2);
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
    side.life = Math.min(STARTING_LIFE + 10, side.life + 4);
    logEvent(`${card.name} rend 4 points de vie.`);
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
    logEvent(`${card.name} donne +1/+1 à tes créatures.`);
  }

  if (card.effect === "drawOneGainOne") {
    draw(side, 1);
    side.life = Math.min(STARTING_LIFE + 10, side.life + 1);
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
    logEvent(`${card.name} soigne ${healed} creature(s).`);
  }

  if (card.effect === "toughTeam") {
    buffTeam(side.board, 0, 2);
    pushVisualEffect("buff", side.side, "+0/+2");
    logEvent(`${card.name} donne +0/+2 à tes créatures.`);
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

  if (card.effect === "vengeanceUldrid") {
    for (const ally of side.board) ally.attack += 1;
    const target = strongestCreature(opponent.board);
    if (target) target.currentLife -= 3;
    pushVisualEffect("buff", side.side, "+1 force");
    if (target) pushVisualEffect("hit", opponent.side, "-3");
    logEvent(
      target
        ? `${card.name} renforce tes créatures et inflige 3 blessures à ${target.name}.`
        : `${card.name} donne +1 force à tes créatures.`
    );
  }
}

function triggerOnPlay(unit, side) {
  const opponent = side.side === "player" ? state.enemy : state.player;

  if (unit.id === "marinehote" && side.board.length < MAX_BOARD) {
    side.board.push(createToken(side.side));
    logEvent("Marinéhote crée un Familier ailé 1/1 avec le vol.");
  }

  if (unit.id === "familliers") {
    side.life = Math.min(STARTING_LIFE + 10, side.life + 2);
    logEvent("Les Familiers d'Elturel te font gagner 2 points de vie.");
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
      logEvent(`Terreur des mers Iguis engloutit ${targets.length} creature(s) dans la maree.`);
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
    side.life = Math.min(STARTING_LIFE + 10, side.life + 1);
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
    logEvent(`${unit.name} exhument un savoir interdit : ${side.side === "player" ? "tu pioches" : "l'adversaire pioche"} une carte.`);
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
      logEvent(`Ragast ravive les plaies et inflige 2 blessures à ${targets.length} creature(s) blessée(s).`);
    }
  }

  if (unit.id === "trios-heros") {
    const allies = side.board.filter((ally) => ally.uid !== unit.uid);
    buffTeam(allies, 1, 1);
    if (allies.length > 0) {
      logEvent("Le Trios des Héros donne +1/+1 à tes autres créatures.");
    }
  }

  if (unit.id === "aldia") {
    side.life = Math.min(STARTING_LIFE + 10, side.life + 4);
    logEvent("Aldia rend 4 points de vie.");
  }

  if (unit.id === "fee") {
    draw(side, 1);
    logEvent("La Fée rapporte un secret de la forêt : pioche une carte.");
  }

  if (unit.id === "protecteurs-nature") {
    const allies = side.board.filter((ally) => ally.uid !== unit.uid);
    buffTeam(allies, 0, 1);
    if (allies.length > 0) logEvent("Les Protécteurs de la nature donnent +0/+1 à tes autres créatures.");
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
    draw(side, 2);
    logEvent("Umi fait piocher deux cartes.");
  }

  if (unit.id === "ulgod") {
    opponent.life -= 3;
    logEvent("Ulgod inflige 3 blessures au héros adverse.");
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
      logEvent(`${side.side === "player" ? "Uldrid enracine" : "L'Uldrid adverse enracine"} ${land.name} depuis ${side.side === "player" ? "ton" : "son"} deck, engagé.`);
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
      logEvent("Noxis inflige 2 blessures aux creatures adverses.");
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

function advancePhase() {
  if (state.phase === PHASES.OVER || !isCurrentSideHuman()) return;
  markOnlineDirty();

  if (state.phase === PHASES.MAIN_1) {
    state.phase = PHASES.COMBAT;
    clearCombatFlags();
    logEvent(`Phase de combat : ${sideDisplayName(state.currentTurn)} sélectionne ses attaquants.`);
    render();
    return;
  }

  if (state.phase === PHASES.COMBAT) {
    state.phase = PHASES.MAIN_2;
    clearCombatFlags();
    logEvent("Deuxieme phase principale.");
    render();
    return;
  }

  if (state.phase === PHASES.MAIN_2) {
    endCurrentTurn();
  }
}

function primaryCombatAction() {
  if (state.phase === PHASES.COMBAT && isCurrentSideHuman()) {
    resolveAttackDeclaration();
    return;
  }

  if (state.phase === PHASES.BLOCK && isDefendingSideHuman()) {
    resolveBlockingCombat();
  }
}

function toggleAttacker(uid) {
  if (state.phase !== PHASES.COMBAT || !isCurrentSideHuman()) return;
  const attacker = getCurrentSide().board.find((unit) => unit.uid === uid);
  if (!attacker) return;

  if (!canAttack(attacker)) {
    logEvent(`${attacker.name} ne peut pas attaquer ce tour-ci.`);
    render();
    return;
  }

  markOnlineDirty();
  attacker.attacking = !attacker.attacking;
  render();
}

function resolveAttackDeclaration() {
  const attackingSide = getCurrentSide();
  const defendingSide = getDefendingSide();
  const attackers = attackingSide.board.filter((unit) => unit.attacking && canAttack(unit));
  markOnlineDirty();
  if (attackers.length === 0) {
    state.phase = PHASES.MAIN_2;
    logEvent("Aucun attaquant declare. Deuxieme phase principale.");
    render();
    return;
  }

  tapAttackers(attackers);
  pushVisualEffect("attack", attackingSide.side, `${attackers.length} attaque${attackers.length > 1 ? "s" : ""}`);
  if (state.mode === "pve" && defendingSide.side === "enemy") {
    aiDeclareBlockers(attackers, defendingSide);
    resolveCombatDamage(attackers, attackingSide, defendingSide);
    clearCombatFlags();
    cleanupBoards();
    checkVictory();
    if (state.phase !== PHASES.OVER) state.phase = PHASES.MAIN_2;
  } else {
    state.phase = PHASES.BLOCK;
    state.selectedBlockerId = null;
    logEvent(`${sideDisplayName(defendingSide.side)} choisit ses bloqueurs.`);
  }
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
  render();
}

function enemyTurn() {
  if (state.mode !== "pve") return;
  beginTurn(state.enemy);
  enemyPlayMainPhase();
  const attackers = chooseEnemyAttackers();

  if (attackers.length === 0) {
    finishEnemyTurn();
    return;
  }

  tapAttackers(attackers);
  state.phase = PHASES.BLOCK;
  logEvent(`L'adversaire declare ${attackers.length} attaquant(s). Choisis tes bloqueurs.`);
  render();
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
      .filter((card) => !isLand(card) && canPay(state.enemy, card) && (isSpell(card) || state.enemy.board.length < MAX_BOARD))
      .sort((a, b) => scoreAiPlay(b) - scoreAiPlay(a))[0];

    if (affordable) {
      const index = state.enemy.hand.findIndex((card) => card.uid === affordable.uid);
      if (isSpell(affordable)) playSpell(state.enemy, index);
      else playCreature(state.enemy, index);
      played = true;
    }
  }
}

function scoreAiPlay(card) {
  return card.cost * 10 + (card.attack || 0) + (isSpell(card) ? 8 : 0);
}

function chooseEnemyAttackers() {
  const attackers = state.enemy.board.filter(canAttack);
  for (const attacker of attackers) {
    attacker.attacking = true;
  }
  return attackers;
}

function selectBlocker(uid) {
  if (state.phase !== PHASES.BLOCK || !isDefendingSideHuman()) return;
  const blocker = getDefendingSide().board.find((unit) => unit.uid === uid);
  if (!blocker || blocker.tapped || blocker.blocking) return;
  markOnlineDirty();
  state.selectedBlockerId = state.selectedBlockerId === uid ? null : uid;
  render();
}

function assignBlocker(attackerUid) {
  if (state.phase !== PHASES.BLOCK || !isDefendingSideHuman() || !state.selectedBlockerId) return;
  const defender = getDefendingSide();
  const attackerSide = getCurrentSide();
  const blocker = defender.board.find((unit) => unit.uid === state.selectedBlockerId);
  const attacker = attackerSide.board.find((unit) => unit.uid === attackerUid && unit.attacking);
  if (!blocker || !attacker) return;

  if (!canBlock(attacker, blocker)) {
    logEvent(`${blocker.name} ne peut pas bloquer ${attacker.name}.`);
    render();
    return;
  }

  markOnlineDirty();
  for (const unit of defender.board) {
    if (unit.uid === blocker.uid) unit.blocking = attacker.uid;
  }
  attacker.blockedBy = blocker.uid;
  state.selectedBlockerId = null;
  logEvent(`${blocker.name} bloque ${attacker.name}.`);
  render();
}

function resolveBlockingCombat() {
  markOnlineDirty();
  const attackingSide = getCurrentSide();
  const defendingSide = getDefendingSide();
  const attackers = attackingSide.board.filter((unit) => unit.attacking);
  resolveCombatDamage(attackers, attackingSide, defendingSide);
  clearCombatFlags();
  cleanupBoards();
  checkVictory();
  if (state.phase !== PHASES.OVER) {
    if (state.mode === "pve" && attackingSide.side === "enemy") finishEnemyTurn();
    else state.phase = PHASES.MAIN_2;
  }
  render();
}

function finishEnemyTurn() {
  endCurrentTurn();
}

function aiDeclareBlockers(attackers, defenderSide) {
  const blockers = defenderSide.board.filter((unit) => !unit.tapped);
  for (const attacker of attackers) {
    const blocker = blockers
      .filter((candidate) => !candidate.blocking && canBlock(attacker, candidate))
      .sort((a, b) => Math.abs(a.currentLife - attacker.attack) - Math.abs(b.currentLife - attacker.attack))[0];

    if (blocker) {
      blocker.blocking = attacker.uid;
      attacker.blockedBy = blocker.uid;
      logEvent(`L'adversaire bloque ${attacker.name} avec ${blocker.name}.`);
    }
  }
}

function resolveCombatDamage(attackers, attackingSide, defendingSide) {
  for (const attacker of attackers) {
    if (!attackingSide.board.includes(attacker)) continue;
    const blockers = defendingSide.board.filter((unit) => unit.blocking === attacker.uid);

    if (blockers.length === 0) {
      defendingSide.life -= attacker.attack;
      gainLifeFromDamage(attacker, attackingSide, attacker.attack);
      pushVisualEffect("hit", defendingSide.side, `-${attacker.attack}`);
      logEvent(`${attacker.name} inflige ${attacker.attack} blessures au heros adverse.`);
      continue;
    }

    const blocker = blockers[0];
    blocker.currentLife -= attacker.attack;
    attacker.currentLife -= blocker.attack;
    if (attacker.attack > 0 && hasKeyword(attacker, "Contact mortel")) blocker.currentLife = 0;
    if (blocker.attack > 0 && hasKeyword(blocker, "Contact mortel")) attacker.currentLife = 0;
    gainLifeFromDamage(attacker, attackingSide, attacker.attack);
    gainLifeFromDamage(blocker, defendingSide, blocker.attack);
    pushVisualEffect("hit", defendingSide.side, `-${attacker.attack}`);
    pushVisualEffect("hit", attackingSide.side, `-${blocker.attack}`);
    logEvent(`${attacker.name} et ${blocker.name} s'infligent leurs blessures.`);
  }
}

function gainLifeFromDamage(unit, side, amount) {
  if (!hasKeyword(unit, "Lien de vie")) return;
  side.life = Math.min(STARTING_LIFE + 10, side.life + amount);
  logEvent(`${unit.name} te fait gagner ${amount} points de vie.`);
}

function tapAttackers(attackers) {
  for (const attacker of attackers) {
    if (!hasKeyword(attacker, "Vigilance")) attacker.tapped = true;
  }
}

function canAttack(unit) {
  return (
    !unit.tapped &&
    unit.currentLife > 0 &&
    !hasKeyword(unit, "Défenseur") &&
    (unit.createdTurn < state.turn || hasKeyword(unit, "Célérité"))
  );
}

function canBlock(attacker, blocker) {
  if (blocker.tapped || blocker.blocking) return false;
  if (hasKeyword(attacker, "Vol") && !hasKeyword(blocker, "Vol") && !hasKeyword(blocker, "Portée")) {
    return false;
  }
  return true;
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
  return isHumanSide(state.currentTurn);
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
      logEvent(`${unit.name} va ${unit.exiled ? "en exil" : "au cimetiere"}.`);
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

function checkVictory() {
  if (state.player.life <= 0) {
    state.phase = PHASES.OVER;
    logEvent(`${sideDisplayName("player")} tombe à 0 point de vie.`);
  }

  if (state.enemy.life <= 0) {
    state.phase = PHASES.OVER;
    logEvent(`${sideDisplayName("enemy")} tombe à 0 point de vie.`);
  }
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
  els.playerEnergy.textContent = `${availableMana(state.player)}/${state.player.lands.length}`;
  els.enemyEnergy.textContent = `${availableMana(state.enemy)}/${state.enemy.lands.length}`;
  els.playerDeck.textContent = state.player.deck.length;
  els.enemyDeck.textContent = state.enemy.deck.length;
  els.playerGraveyard.textContent = state.player.graveyard.length;
  els.enemyGraveyard.textContent = state.enemy.graveyard.length;
  els.playerExile.textContent = state.player.exile.length;
  els.enemyExile.textContent = state.enemy.exile.length;
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
  if (state.network.dirty) {
    state.network.dirty = false;
    scheduleOnlinePublish(true);
  }
}

function updateButtons() {
  els.attackHero.disabled = true;
  els.endTurn.disabled = state.phase === PHASES.OVER || !isCurrentSideHuman();
  els.endTurn.textContent = state.phase === PHASES.MAIN_2 ? "Fin du tour" : "Phase suivante";
  els.attackHero.textContent = "Declarer les attaquants";

  if (isCurrentSideHuman() && state.phase === PHASES.COMBAT) {
    els.attackHero.disabled = false;
    els.attackHero.textContent = "Declarer les attaquants";
  }

  if (isDefendingSideHuman() && state.phase === PHASES.BLOCK) {
    els.attackHero.disabled = false;
    els.attackHero.textContent = "Resoudre le combat";
    els.endTurn.disabled = true;
  }
}

function renderHand() {
  const side = getVisibleHandSide();
  els.playerHand.innerHTML = "";
  if (side.hand.length === 0) {
    els.playerHand.append(emptySlot("Main vide"));
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const card of side.hand) {
    const node = renderCard(card, { mode: "hand" });
    if (!isPlayableFromHand(side, card)) node.classList.add("is-unplayable");
    const control = node.querySelector(".card-content");
    control.addEventListener("click", () => openCardDetail(card, { zone: "hand", side: side.side }));
    fragment.append(node);
  }
  els.playerHand.append(fragment);
}

function isPlayableFromHand(side, card) {
  if (!canActInMain(side)) return false;
  if (isLand(card)) return !side.landPlayed;
  if (isSpell(card)) return canPay(side, card);
  return side.board.length < MAX_BOARD && canPay(side, card);
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
    if (unit.attacking) node.classList.add("is-attacking");
    if (unit.blocking) node.classList.add("is-blocking");
    if (unit.tapped) node.classList.add("is-exhausted");
    if (unit.stunTurns > 0) node.classList.add("is-frozen");
    if (unit.uid === state.selectedBlockerId) node.classList.add("is-selected");

    const control = node.querySelector(".card-content");
    control.addEventListener("click", () => openCardDetail(unit, { zone: "board", side: sideName }));
    fragment.append(node);
  }
  container.append(fragment);
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
      <img src="${encodeURI(card.image)}" alt="${escapeHtml(card.name)}" loading="${loading}" decoding="async" />
      <span class="family-ribbon">${escapeHtml(card.family)}</span>
    </div>
    <div class="card-scroll">
      <p class="card-ability"><strong>${escapeHtml(card.abilityName)}</strong> - ${escapeHtml(card.abilityText)}</p>
      <p class="card-keywords">${card.keywords.map((keyword) => `<span class="tag">${escapeHtml(keyword)}</span>`).join("")}</p>
    </div>
    <div class="card-stats">${statBlock}</div>
  `;
  article.append(wrapper);
  if (interactive) bindCardPreview(article, card);
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
  const gutter = 14;
  let left = anchorRect.right + gutter;
  if (left + previewRect.width > window.innerWidth - gutter) {
    left = anchorRect.left - previewRect.width - gutter;
  }
  left = Math.max(gutter, Math.min(left, window.innerWidth - previewRect.width - gutter));
  const centeredTop = anchorRect.top + anchorRect.height / 2 - previewRect.height / 2;
  const top = Math.max(gutter, Math.min(centeredTop, window.innerHeight - previewRect.height - gutter));
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
  node.innerHTML = `
    <span class="land-gem"></span>
    <span>${escapeHtml(land.name)}</span>
  `;
  return node;
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

    if (state.currentTurn === side.side && state.phase === PHASES.COMBAT && isCurrentSideHuman()) {
      return {
        label: unit.attacking ? "Retirer des attaquants" : "Déclarer attaquant",
        enabled: unit.attacking || canAttack(unit),
        run: () => toggleAttacker(unit.uid)
      };
    }

    if (state.phase === PHASES.BLOCK && getDefendingSide().side === side.side && isDefendingSideHuman()) {
      const selected = state.selectedBlockerId === unit.uid;
      return {
        label: selected ? "Annuler le bloqueur" : "Choisir comme bloqueur",
        enabled: selected || (!unit.tapped && !unit.blocking),
        run: () => selectBlocker(unit.uid)
      };
    }

    if (state.phase === PHASES.BLOCK && getCurrentSide().side === side.side && isDefendingSideHuman()) {
      const blocker = getDefendingSide().board.find((candidate) => candidate.uid === state.selectedBlockerId);
      const canAssign = Boolean(unit.attacking && blocker && canBlock(unit, blocker));
      return {
        label: "Bloquer cet attaquant",
        enabled: canAssign,
        run: () => assignBlocker(card.uid)
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

function phaseLabel() {
  if (state.phase === PHASES.OVER) return "Partie terminee";
  if (state.phase === PHASES.BLOCK) return `${sideDisplayName(getDefendingSide().side)} bloque`;
  if (state.currentTurn === "enemy" && state.mode === "pve") return "Tour adverse";
  if (state.phase === PHASES.MAIN_1) return "Phase principale 1";
  if (state.phase === PHASES.COMBAT) return "Combat";
  if (state.phase === PHASES.MAIN_2) return "Phase principale 2";
  return `Tour de ${sideDisplayName(state.currentTurn)}`;
}

function getActionHint() {
  if (state.phase === PHASES.OVER) return "La partie est terminee. Lance une nouvelle partie.";
  if (state.mode === "online" && !isLocalOnlineController()) {
    if (state.phase === PHASES.BLOCK) return `${sideDisplayName(getDefendingSide().side)} choisit ses bloqueurs sur son écran.`;
    return `${sideDisplayName(state.currentTurn)} joue sur son écran.`;
  }
  if (state.phase === PHASES.BLOCK && isDefendingSideHuman()) {
    if (state.selectedBlockerId) return "Clique un attaquant adverse pour assigner ton bloqueur.";
    return "Clique une creature degagee, puis un attaquant adverse pour bloquer.";
  }
  if (!isCurrentSideHuman()) return "L'adversaire joue son tour.";
  if (state.phase === PHASES.COMBAT) return "Clique tes creatures degagees pour les declarer attaquantes.";
  if (state.phase === PHASES.MAIN_2) return "Tu peux encore jouer un terrain ou des creatures avant de finir le tour.";
  return "Pose un terrain, puis lance tes creatures avec le mana de tes terrains.";
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
    ...state.cards.map((card) => card.image),
    ...state.lands.map((land) => land.image),
    ...state.spells.map((card) => card.image),
    "Images/Familliers.png",
    PLAYMATS.player,
    PLAYMATS.enemy
  ]);
  for (const url of urls) {
    const img = new Image();
    img.src = encodeURI(url);
  }
}

function getVisibleHandSide() {
  if (state.mode === "online") return getSide(state.network.slot || "player");
  if (state.mode === "pvp" && state.phase === PHASES.BLOCK) return getDefendingSide();
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

function label(side) {
  return sideDisplayName(side.side);
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
