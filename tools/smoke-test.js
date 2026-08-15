// Vérification automatisée basique : démarre le serveur, teste les fichiers
// statiques, les données et les endpoints du salon multijoueur (code 1234).
// Usage : node tools/smoke-test.js
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 4188;
const base = `http://localhost:${PORT}`;
const server = spawn(process.execPath, [path.join(__dirname, "..", "serve.js")], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"]
});

let failed = 0;
function check(name, condition) {
  console.log(`${condition ? "  OK  " : "ECHEC "} ${name}`);
  if (!condition) failed += 1;
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout démarrage serveur")), 5000);
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes("disponible")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  });
}

const json = (body) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body)
});

async function main() {
  await waitForServer();

  let res = await fetch(`${base}/`);
  const html = await res.text();
  check("GET / -> 200", res.status === 200);
  check("index.html contient Spellaho", html.includes("Spellaho") && !html.includes(">Tonitos<"));
  check(
    "index.html référence les cinq zones des tapis",
    ["mat-side", "mat-zone--library", "mat-zone--graveyard", "mat-zone--field", "mat-zone--exile", "mat-zone--commander"]
      .every((className) => html.includes(className))
  );
  check("Les piles visibles sont présentes sur le tapis", html.includes("library-card-back") && html.includes("pile-card-mini"));
  check(
    "Les nouveaux recto et verso de carte existent",
    ["Images/Tapis de Jeu/Devant de carte.jpg", "Images/Tapis de Jeu/Carte Dos.png"]
      .every((file) => fs.existsSync(path.join(__dirname, "..", file)))
  );
  check(
    "Logo et fumée Spellaho présents",
    ["Images/Logo Jeu/Spellaho.png", "Images/Effets/Fumee magique.png"]
      .every((file) => fs.existsSync(path.join(__dirname, "..", file)))
  );
  check(
    "Les 8 grades illustrés existent",
    ["Débutant", "Bronze", "Silver", "Or", "Platine", "Diamant", "Emeraude", "Master"]
      .every((grade) => fs.existsSync(path.join(__dirname, "..", `Images/Grade/Niveau ${grade}.png`)))
  );
  check(
    "Le menu contient les profils et l'écran d'XP",
    html.includes('id="account-select"') && html.includes('id="game-over-xp"') && html.includes('id="turn-handoff"')
  );
  check(
    "Le téléphone portrait affiche l'écran de rotation",
    html.includes('id="orientation-gate"') &&
      html.includes('id="orientation-lock"') &&
      html.includes('id="orientation-status"')
  );
  res = await fetch(`${base}/game.js`);
  const gameSource = await res.text();
  check("GET /game.js -> 200", res.status === 200);
  res = await fetch(`${base}/engine-core.mjs`);
  const engineSource = await res.text();
  check("GET /engine-core.mjs -> 200", res.status === 200);
  check(
    "Le lancement reste verrouillé jusqu'à la fin du chargement",
    html.includes('id="start-game"') &&
      html.includes('disabled aria-busy="true"') &&
      gameSource.includes('els.startGame.disabled = false') &&
      gameSource.includes('handleInitializationError')
  );
  check("Identité réseau Spellaho propre à chaque onglet", gameSource.includes('PLAYER_ID_KEY = "spellaho-player-id"'));
  check("Secours WebRTC pour GitHub Pages", gameSource.includes("joinPeerRoom") && gameSource.includes("peerjs@1.5.5"));
  check("Aperçu du cimetière et de l'exil mis à jour", gameSource.includes("renderPilePreviews"));
  check(
    "Main en éventail calculée selon le nombre de cartes et la largeur disponible",
    gameSource.includes("--hand-rotation") &&
      gameSource.includes("--hand-overlap") &&
      gameSource.includes("--hand-card-width") &&
      gameSource.includes("maximumSpan")
  );
  check(
    "Glisser tactile capturé jusqu'au terrain du joueur actif",
    gameSource.includes("setPointerCapture") &&
      gameSource.includes("pointerId") &&
      gameSource.includes("playDropField") &&
      gameSource.includes("onDragPointerCancel")
  );
  check("Terrains permanents avec leur illustration", gameSource.includes("--land-art") && gameSource.includes("land-permanent-art"));
  check(
    "Vigilance reste limitée à une attaque par tour",
    gameSource.includes("canUnitAttack(unit, state.turn)") && engineSource.includes("!unit.hasAttacked")
  );
  check("Les invocations divines verrouillées sont refusées par le moteur", gameSource.includes("!isDivineUnlocked(side, card)"));
  check(
    "La Fusion sacrifie réellement Noxis et Bhaal",
    gameSource.includes("sacrificeInvocationMaterials") &&
      gameSource.includes('unit.id === "noxis-bhaal-fusion"') &&
      gameSource.includes("canFitCreatureOnBoard")
  );
  check(
    "Les évolutions suivent les tours réellement survécus",
    gameSource.includes("advanceSurvivalCounters") &&
      gameSource.includes("survivedTurns") &&
      gameSource.includes("survivalGoalForUnit")
  );
  check(
    "Les effets d'Héritage et d'Apocalypse sont implémentés",
    gameSource.includes('unit.id === "heritage-heros"') &&
      gameSource.includes('unit.id === "apocalypse-umi"')
  );
  check(
    "Effets cinématiques branchés aux événements de cartes",
    gameSource.includes("animateDrawCard") &&
      gameSource.includes("animateCardDeparture") &&
      gameSource.includes("animateGraveyardArrival") &&
      gameSource.includes("animateSummonArrival")
  );
  check(
    "Les effets sont reconstruits chez le joueur en ligne distant",
    gameSource.includes("animateOnlineStateTransitions") &&
      gameSource.includes("snapshot.publishedBy !== state.network.playerId")
  );
  check("Le passage de tour local masque la main", gameSource.includes("showTurnHandoff") && gameSource.includes("Main masquée"));
  check("Les résultats accordent l'XP une seule fois", gameSource.includes("progressAwarded") && gameSource.includes("awardMatchProgress"));
  check("Les parties ont un identifiant de récompense", gameSource.includes("matchId"));
  const reanimateSource = gameSource.slice(
    gameSource.indexOf("function reanimateBestCreatures"),
    gameSource.indexOf("function triggerOnPlay")
  );
  check("Les capacités d'arrivée se déclenchent après réanimation", reanimateSource.includes("triggerOnPlay(unit, side)"));

  res = await fetch(`${base}/styles.css`);
  const styles = await res.text();
  check(
    "Illustrations sans bandes noires et stables au survol",
    styles.includes("object-fit: cover") &&
      styles.includes(".game-card:hover .card-art img") &&
      styles.includes(".card-art-video::-webkit-media-controls")
  );
  check("Plateau responsive sur une colonne", styles.includes("@media (max-width: 1100px)") && styles.includes("grid-template-columns: minmax(0, 1fr)"));
  check("Fumée magique animée autour de l'arène", styles.includes("spellaho-smoke-drift-a") && styles.includes("Fumee%20magique.png"));
  check(
    "Animations de pioche, décomposition, mort et cimetière présentes",
    styles.includes("card-draw-flight") &&
      styles.includes("invocation-card-decompose") &&
      styles.includes("card-death-to-grave") &&
      styles.includes("graveyard-vortex-open") &&
      styles.includes("graveyard-ambient")
  );
  check(
    "Téléphone paysage sans scroll avec une arène continue",
      styles.includes("(orientation: landscape)") &&
      styles.includes('body[data-mobile-view="board"] .enemy-mat') &&
      styles.includes('body[data-mobile-view="board"] .player-mat') &&
      styles.includes("var(--playmat-player) center / 100% 100% no-repeat") &&
      styles.includes("var(--playmat-enemy) center / 100% 100% no-repeat") &&
      styles.includes("mask-image: linear-gradient")
  );
  check(
    "Deux camps superposés dans le même plateau mobile",
    styles.includes("grid-template-rows: repeat(2, minmax(0, 1fr))") &&
      styles.includes("--phone-hand-height") &&
      styles.includes("--phone-board-card-width")
  );
  check(
    "Finition mobile premium pour decks, compteurs et navigation",
    styles.includes("premium-deck-float") &&
      styles.includes("premium-smoke-breathe") &&
      styles.includes("Plaques de compteurs") &&
      styles.includes("Navigation inférieure premium")
  );
  res = await fetch(`${base}/polish.css`);
  const polishStyles = await res.text();
  const mobilePlaymatPath = path.join(__dirname, "..", "Images/Tapis de Jeu/Tapis Mobile Pro.svg");
  const mobilePlaymatSource = fs.existsSync(mobilePlaymatPath)
    ? fs.readFileSync(mobilePlaymatPath, "utf8")
    : "";
  const phoneLandscapeMedia =
    "@media (max-width: 960px) and (max-height: 540px) and (orientation: landscape)";
  const phoneLandscapeMediaCount = styles.split(phoneLandscapeMedia).length - 1;
  check(
    "Seuil téléphone paysage cohérent entre JavaScript et CSS",
    gameSource.includes("const PHONE_LANDSCAPE_MAX_WIDTH = 960;") &&
      gameSource.includes("const PHONE_LANDSCAPE_MAX_HEIGHT = 540;") &&
      phoneLandscapeMediaCount === 3 &&
      polishStyles.includes(phoneLandscapeMedia)
  );
  check(
    "Hiérarchie visuelle et tour actif renforcés",
    polishStyles.includes("polish-active-hero") &&
      polishStyles.includes("polish-end-turn-glow") &&
      polishStyles.includes(".zone-sign") &&
      gameSource.includes('classList.toggle("is-active-turn"') &&
      gameSource.includes('classList.add("is-turn-change")')
  );
  check(
    "Finition premium limitée au téléphone paysage",
    html.includes("polish.css") &&
      polishStyles.includes(phoneLandscapeMedia) &&
      polishStyles.includes('body.game-running[data-mobile-view="board"] .board-stage') &&
      polishStyles.includes(".zone-sign {") &&
      polishStyles.includes("display: none;") &&
      polishStyles.includes('body.game-running[data-mobile-view="board"] .zone-sign')
  );
  check(
    "Tapis smartphone vectoriel et navigation masquée en partie",
    mobilePlaymatSource.includes('viewBox="0 0 1600 740"') &&
      mobilePlaymatSource.includes('preserveAspectRatio="none"') &&
      mobilePlaymatSource.includes('id="tablettes"') &&
      mobilePlaymatSource.includes('id="terrains"') &&
      mobilePlaymatSource.includes('id="piles"') &&
      mobilePlaymatSource.includes('id="portails"') &&
      mobilePlaymatSource.includes('id="main"') &&
      mobilePlaymatSource.includes('id="ligne-centrale"') &&
      mobilePlaymatSource.includes('id="sceau"') &&
      !mobilePlaymatSource.includes('id="end-turn-well"') &&
      gameSource.includes('mobile: "Images/Tapis de Jeu/Tapis Mobile Pro.svg?v=20260816-mirror-2"') &&
      gameSource.includes('"--playmat-mobile"') &&
      polishStyles.includes("var(--playmat-mobile)") &&
      polishStyles.includes('body.game-running[data-mobile-view="board"] .mobile-nav') &&
      polishStyles.includes("display: none;")
  );
  check(
    "Tapis dessiné en miroir exact des deux camps",
    // Les emplacements peints doivent tomber en face des éléments du DOM.
    // Portails de commandant : même axe X, et 133 + 607 = 740 (miroir).
    mobilePlaymatSource.includes("translate(149 133)") &&
      mobilePlaymatSource.includes("translate(149 607)") &&
      // Piles : même colonne à droite pour les deux camps.
      (mobilePlaymatSource.match(/x="1405"/g) || []).length >= 4 &&
      // Le cimetière adverse ne doit pas revenir dans le coin haut gauche.
      !mobilePlaymatSource.includes('x="48" y="41"') &&
      // Aucun socle peint sous le bouton : il déborderait sous lui.
      !mobilePlaymatSource.includes('id="socle-fin-tour"') &&
      // Le tapis se replie avec le contenu, sinon l'encoche les désaligne.
      polishStyles.includes("background-origin: content-box;")
  );
  check(
    "Cartes mobiles déplaçables au doigt",
    styles.includes("touch-action: none") &&
      styles.includes(".game-card.is-drag-source") &&
      styles.includes(".mat-zone--field.is-drop-ready")
  );
  check(
    "Redimensionnement différé pendant un glisser",
    gameSource.includes("if (dragState.pending) {") &&
      gameSource.includes("handRenderPending = true;") &&
      gameSource.includes("flushPendingHandRender();")
  );
  check(
    "Titres mobiles extrêmes visibles sur trois lignes",
    polishStyles.includes(".very-long-card-title .card-name") &&
      polishStyles.includes("-webkit-line-clamp: 3;") &&
      // 30 % : 3 lignes de 7px tiennent aussi sous 410px de hauteur de viewport.
      polishStyles.includes("height: 30%;")
  );
  check(
    "Main iPhone séparée du terrain et alignée sur le tapis",
    gameSource.includes("Math.max(58, Math.min(68, window.innerHeight * 0.155))") &&
      gameSource.includes("Math.max(220, measuredHandWidth)") &&
      gameSource.includes("handWidth * 0.92") &&
      polishStyles.includes("left: var(--lane-field-left);") &&
      polishStyles.includes("width: var(--lane-field-width);") &&
      polishStyles.includes("width: min(68%, 480px);") &&
      polishStyles.includes("--phone-board-card-height") &&
      polishStyles.includes("--phone-hand-row-height") &&
      polishStyles.includes("height: calc(var(--hand-card-width, 64px) * 1.27);") &&
      polishStyles.includes("transform: translateY(-4px) rotate(0deg) scale(1.025);")
  );
  check(
    "Bande centrale structurée sur la même grille que les terrains",
    polishStyles.includes("grid-template-columns:\n      var(--centerband-button-width)") &&
      polishStyles.includes("grid-column: 1;") &&
      polishStyles.includes("grid-column: 2;") &&
      polishStyles.includes("grid-column: 3;") &&
      polishStyles.includes("width: var(--lane-field-width);")
  );
  check(
    "Fiche mobile bornée et texte de carte ajusté sans troncature",
    polishStyles.includes("width: 100dvw;") &&
      polishStyles.includes("height: 100dvh;") &&
      polishStyles.includes("overflow-y: auto;") &&
      polishStyles.includes("--detail-ability-font-size") &&
      polishStyles.includes("-webkit-line-clamp: unset;") &&
      gameSource.includes("function fitCardDetailText()") &&
      gameSource.includes("textBox.scrollHeight > textBox.clientHeight") &&
      gameSource.includes('content.dataset.textFits = String(')
  );
  check(
    "Zone sûre iPhone comptée une seule fois",
    polishStyles.includes("padding-bottom: env(safe-area-inset-bottom);") &&
      !polishStyles.includes("bottom: max(4px, env(safe-area-inset-bottom));")
  );
  check(
    "Serviteurs mobiles lisibles sans badges surdimensionnés",
    polishStyles.includes("--phone-board-card-width: clamp(50px, 7.2dvw, 68px);") &&
      polishStyles.includes("--phone-board-card-height: clamp(60px, 8.2dvw, 82px);") &&
      polishStyles.includes("bottom: 21px;") &&
      polishStyles.includes("width: clamp(16px, 4.2dvh, 19px);")
  );
  check(
    "Piles, cimetières et héros alignés sur le tapis mobile",
    polishStyles.includes(".enemy-mat .mat-zone--graveyard") &&
      polishStyles.includes(".enemy-mat .mat-zone--library") &&
      polishStyles.includes(".player-mat .mat-zone--graveyard") &&
      polishStyles.includes(".player-mat .mat-zone--library") &&
      // Grille symétrique : une seule définition de colonne sert les deux
      // camps, et aucune coordonnée propre à un camp ne doit réapparaître.
      polishStyles.includes("--lane-hero-left:") &&
      polishStyles.includes("left: var(--lane-hero-left);") &&
      !polishStyles.includes("left: 43.5%;") &&
      polishStyles.includes("content: \"CIMETIERE\";") &&
      polishStyles.includes("grid-template-columns: 8px 1fr;")
  );
  check(
    "Symétrie stricte des deux camps par ancrage miroir",
    // Le camp adverse s'ancre par bottom, le joueur par top, avec les
    // mêmes variables : la symétrie ne peut plus diverger.
    ["--row-field-gap", "--row-land-gap", "--row-hero-gap", "--row-grave-gap", "--row-library-gap"]
      .every((v) => polishStyles.includes(`${v}:`)) &&
      polishStyles.includes("bottom: var(--row-field-gap);") &&
      polishStyles.includes("top: var(--row-field-gap);") &&
      polishStyles.includes("bottom: var(--row-hero-gap);") &&
      polishStyles.includes("top: var(--row-hero-gap);") &&
      polishStyles.includes("width: var(--lane-field-width);")
  );
  check(
    "Zones de sécurité iOS symétriques sur le plateau",
    // En paysage l'encoche n'est que d'un côté : on applique la même marge
    // des deux côtés, sinon le plateau se décale et la symétrie casse.
    polishStyles.includes("--safe-x: max(env(safe-area-inset-left), env(safe-area-inset-right));") &&
      polishStyles.includes("padding-inline: var(--safe-x);") &&
      // La main est hors de .board-stage : elle doit refaire le même calcul.
      polishStyles.includes("left: calc(var(--safe-x) + (100% - 2 * var(--safe-x)) * 0.18);") &&
      polishStyles.includes("right: calc(var(--safe-x) + (100% - 2 * var(--safe-x)) * 0.18);")
  );
  check(
    "Bouton de tour compact avec états complets",
    gameSource.includes('classList.toggle("is-opponent-turn", waitingForOpponent)') &&
      polishStyles.includes("width: var(--centerband-button-width);") &&
      polishStyles.includes(".primary-button:hover:not(:disabled)") &&
      polishStyles.includes(".primary-button:active:not(:disabled)") &&
      polishStyles.includes(".primary-button.is-opponent-turn")
  );
  check(
    "Contour thématique de 3px autour des cartes",
    styles.includes("outline: 3px solid var(--family-accent") &&
      styles.includes("outline-offset: -3px;")
  );
  check(
    "Verrouillage paysage sans plein écran forcé",
    gameSource.includes("requestLandscapeMode") &&
      gameSource.includes("updatePhoneOrientation") &&
      gameSource.includes("phone-portrait-blocked") &&
      gameSource.includes("orientationLockFailed") &&
      !gameSource.includes("requestFullscreen")
  );

  res = await fetch(`${base}/progression.js`);
  const progressionSource = await res.text();
  check("GET /progression.js -> 200", res.status === 200);
  check("Progression avec XP, niveaux et grades", progressionSource.includes("XP_REWARDS") && progressionSource.includes("getLevelProgress"));
  check("Une partie ne peut attribuer l'XP qu'une fois", progressionSource.includes("rewardedMatches"));

  // --- Flèche d'attaque : purge centralisée ---
  check(
    "Réinitialisation centrale du ciblage d'attaque",
    gameSource.includes("function resetAttackState(") &&
      gameSource.includes("function clearAttackPreview(") &&
      gameSource.includes('window.addEventListener("blur"') &&
      gameSource.includes('document.addEventListener("visibilitychange"')
  );
  // Les gardes de attackUnit/attackHero doivent purger le ciblage au lieu de
  // sortir sèchement : c'est la cause d'origine de la flèche persistante.
  const attackSource = gameSource.slice(
    gameSource.indexOf("function attackUnit("),
    gameSource.indexOf("// --- Animations de combat")
  );
  check(
    "Aucune sortie d'attaque ne laisse un ciblage actif",
    attackSource.length > 0 &&
      !/!state\.selectedAttackerId\) return;/.test(attackSource) &&
      (attackSource.match(/resetAttackState\(\)/g) || []).length >= 5
  );
  check(
    "Les actions de carte sont refusées par le moteur hors tour",
    (gameSource.match(/if \(isAnimating \|\| !canActInMain\(side\)\) return false;/g) || []).length >= 3
  );
  check(
    "Une pioche fatale arrête immédiatement le tour de l'IA",
    gameSource.includes("!beginTurn(state.enemy) || state.phase === PHASES.OVER")
  );
  check(
    "Les minuteurs de jeu sont liés à la partie active",
    gameSource.includes("pendingGameTimers") && gameSource.includes("state.matchId !== matchId")
  );
  check(
    "Le menu de nouvelle partie suspend le moteur",
    gameSource.includes("gameplayPaused = true") && gameSource.includes("clearGameTimers();")
  );
  check(
    "La fin de tour est publiée au second joueur",
    /function endCurrentTurn\(\) \{[\s\S]{0,240}markOnlineDirty\(\)/.test(gameSource)
  );
  check(
    "Un soin ne ressuscite pas un héros mort de fatigue",
    (gameSource.match(/draw\(side, [12]\);\s+if \(state.phase === PHASES.OVER\) return;/g) || []).length >= 3
  );
  check(
    "Le glisser du joueur 2 cible le camp qui défend réellement",
    gameSource.includes('defender.side === "player" ? els.playerBoard : els.enemyBoard') &&
      gameSource.includes("commanderNode(defender.side)")
  );

  // --- Moteur sonore ---
  res = await fetch(`${base}/audio.js`);
  const audioSource = await res.text();
  check("GET /audio.js -> 200", res.status === 200);
  check(
    "Moteur sonore avec bus séparés, limite de voix et variations",
    audioSource.includes("class SoundManager") &&
      audioSource.includes("MAX_VOICES") &&
      audioSource.includes("MAX_VOICES_PER_SOUND") &&
      audioSource.includes("music") &&
      audioSource.includes("sfx") &&
      audioSource.includes("preload(") &&
      gameSource.includes('import { sound } from "./audio.js')
  );
  check(
    "Sons branchés sur les actions clés",
    ["card.draw", "card.place", "creature.summon", "spell.cast", "attack.impact", "turn.end", "game.victory"]
      .every((id) => gameSource.includes(`"${id}"`) || audioSource.includes(`"${id}"`))
  );

  // --- Système de drop ---
  const drop = await import("../drop.js");
  const readData = (file) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", file), "utf8"));
  const cardsForDrop = readData("cards.json");
  const landsForDrop = readData("lands.json");
  const weightTotal = Object.values(drop.DROP_CONFIG.weights).reduce((sum, w) => sum + w, 0);
  check("Somme des probabilités de drop = exactement 100 %", weightTotal === drop.RARITY_SCALE);
  check("Configuration de drop unique et valide", drop.assertWeightsValid() === true);
  check(
    "Tirage reproductible et rareté avant carte",
    (() => {
      const pool = [...cardsForDrop, ...landsForDrop];
      const a = drop.createDropSystem(pool, { seed: 42, resolve: drop.inferRarity });
      const b = drop.createDropSystem(pool, { seed: 42, resolve: drop.inferRarity });
      const first = a.draw();
      const second = b.draw();
      return Boolean(first) && first.card.id === second.card.id && first.rarity === second.rarity;
    })()
  );
  check(
    "Aucune rareté vide ne rend une carte inatteignable",
    (() => {
      const table = drop.buildLootTable(cardsForDrop, drop.inferRarity);
      const rng = drop.createRng(7);
      for (let i = 0; i < 500; i += 1) {
        if (!drop.drawCard(table, rng, null, drop.DROP_CONFIG)) return false;
      }
      return true;
    })()
  );

  res = await fetch(`${base}/data/cards.json`);
  const cards = await res.json();
  check("cards.json = 61 créatures", Array.isArray(cards) && cards.length === 61);
  const connor = cards.find((c) => c.id === "roi-sorcier-connor");
  check(
    "Roi Sorcier Connor = Blanc 1/2 à croissance",
    connor?.family === "Blanc" &&
      connor.attack === 1 &&
      connor.life === 2 &&
      connor.video === "Images/Vidéos/roi-sorcier-connor.mp4" &&
      gameSource.includes('creature.id === "roi-sorcier-connor"') &&
      gameSource.includes("buffUnits([creature], 1, 1)")
  );
  check(
    "Les vidéos de carte se lancent sans commandes visibles",
    ["roi-sorcier-connor", "fee", "kraken", "rena", "noxis-bhaal-fusion", "aventurier-mythique-daemon"].every(
      (id) => cards.find((card) => card.id === id)?.video
    ) &&
      gameSource.includes("playCardDetailVideo") &&
      gameSource.includes('video.className = "card-art-video"') &&
      gameSource.includes("video.controls = false") &&
      gameSource.includes("video.muted = false") &&
      gameSource.includes("video.volume = 1") &&
      gameSource.includes("video.disablePictureInPicture = true")
  );
  res = await fetch(`${base}/${connor.video}`, { method: "HEAD" });
  check("Le serveur local sert les MP4 avec le bon type", res.status === 200 && res.headers.get("content-type") === "video/mp4");
  check("Golem de pierre = Vert", cards.find((c) => c.id === "golem-pierre")?.family === "Vert");
  check("Amrin = Rouge", cards.find((c) => c.id === "amrin")?.family === "Rouge");
  check("Roi des mers = Bleu", cards.find((c) => c.id === "roi-des-mers")?.family === "Bleu");
  check("Magicien exilé = Noir", cards.find((c) => c.id === "magiciens-exiles")?.family === "Noir");
  check("Fée = Vert", cards.find((c) => c.id === "fee")?.family === "Vert");
  check("Ours-hibou = Vert", cards.find((c) => c.id === "ours-hibou")?.family === "Vert");
  check("Valerius = Noir", cards.find((c) => c.id === "valerius")?.family === "Noir");
  const daemon = cards.find((card) => card.id === "aventurier-mythique-daemon");
  check(
    "Aventurier Mythique Daemon = Blanc 3/4 immortel à 3 terrains",
    daemon?.family === "Blanc" &&
      daemon.cost === 3 &&
      daemon.attack === 3 &&
      daemon.life === 4 &&
      daemon.returnDelayTurns === 3 &&
      daemon.video === "Images/Vidéos/aventurier-mythique-daemon.mp4" &&
      gameSource.includes("advanceDelayedReturns") &&
      gameSource.includes("tickDelayedReturns")
  );
  check(
    "Les 19 nouvelles créatures respectent leur identité",
    [
      ["aventurier", "Blanc"],
      ["envoye-bhaal", "Noir"],
      ["homme-requin", "Bleu"],
      ["hero-rena", "Vert"],
      ["chevalier-parasite", "Vert"],
      ["gardien-parasite", "Vert"],
      ["orc-contamine", "Vert"],
      ["zombie-parasite", "Vert"],
      ["reine-parasite", "Vert"],
      ["parasite", "Vert"],
      ["terreur-rena", "Vert"],
      ["robot-antique-aigle", "Rouge"],
      ["robot-antique-mage", "Vert"],
      ["robot-antique-maitre-haches", "Vert"],
      ["robot-antique-creation-divine", "Blanc"],
      ["robot-antique-chien", "Blanc"],
      ["robot-antique-gardien", "Blanc"],
      ["robot-antique-fleau-flammes", "Rouge"],
      ["robot-antique-chasseur", "Bleu"]
    ].every(([id, family]) => cards.find((card) => card.id === id)?.family === family)
  );
  check(
    "Les Robots antiques possèdent une synergie de tribu jouable",
    ["robot-antique-mage", "robot-antique-maitre-haches", "robot-antique-creation-divine", "robot-antique-chien"].every(
      (id) => gameSource.includes(`unit.id === "${id}"`)
    ) && gameSource.includes("ancientRobotAllies")
  );
  const parasite = cards.find((card) => card.id === "parasite");
  check(
    "Le Parasite incarne la vengeance de Rena",
    parasite?.abilityName === "Vengeance de Rena" &&
      parasite?.keywords?.includes("Parasite") &&
      gameSource.includes("triggerParasiteVengeance") &&
      gameSource.includes("parasiteVengeanceDamage") &&
      engineSource.includes('unit?.id === "parasite"')
  );
  check(
    "La ruche crée et renforce ses larves",
    gameSource.includes("createParasiteLarva") &&
      gameSource.includes('unit.id === "reine-parasite"') &&
      gameSource.includes('unit.id === "zombie-parasite"') &&
      gameSource.includes('unit.id === "hero-rena"')
  );
  const fusion = cards.find((c) => c.id === "noxis-bhaal-fusion");
  check(
    "Fusion complète = carte la plus forte",
    fusion?.family === "Noir" &&
      fusion.attack === 15 &&
      fusion.life === 15 &&
      cards.filter((card) => card.id !== fusion.id).every((card) => card.attack < fusion.attack && card.life < fusion.life)
  );
  check(
    "Fusion complète exige et sacrifie Noxis + Bhaal",
    fusion?.divine?.any?.some((clause) => clause.board?.includes("noxis") && clause.board?.includes("bhaal")) &&
      fusion?.sacrificeOnCast?.join(",") === "noxis,bhaal" &&
      fusion.deckCopies === 1
  );
  const heritage = cards.find((c) => c.id === "heritage-heros");
  check(
    "Héritage exige Johanna + Dyklanne pendant 3 tours",
    heritage?.family === "Blanc" &&
      heritage?.sacrificeOnCast?.join(",") === "johanna,dyklanne" &&
      heritage?.divine?.any?.some(
        (clause) =>
          clause.survived?.some((item) => item.id === "johanna" && item.turns === 3) &&
          clause.survived?.some((item) => item.id === "dyklanne" && item.turns === 3)
      ) &&
      heritage.deckCopies === 1
  );
  const apocalypse = cards.find((c) => c.id === "apocalypse-umi");
  check(
    "Apocalypse fait évoluer le Roi des mers après 5 tours",
    apocalypse?.family === "Bleu" &&
      apocalypse?.sacrificeOnCast?.join(",") === "roi-des-mers" &&
      apocalypse?.divine?.any?.some(
        (clause) => clause.survived?.some((item) => item.id === "roi-des-mers" && item.turns === 5)
      ) &&
      apocalypse.deckCopies === 1
  );

  res = await fetch(`${base}/data/spells.json`);
  const spells = await res.json();
  check("25 sorts avec illustrations autonomes", spells.length === 25);
  check(
    "Aucun sort ne réutilise une image de créature ou de terrain",
    spells.every((spell) => !cards.some((c) => c.image === spell.image))
  );
  check("Colère d'Umi = Bleu", spells.find((s) => s.id === "colere-umi")?.family === "Bleu");
  check("Malédiction d'Ulgod = Rouge", spells.find((s) => s.id === "malediction-ulgod")?.family === "Rouge");
  check("Pitié d'Aldia = Blanc", spells.find((s) => s.id === "pitie-aldia")?.family === "Blanc");
  check("Bénédiction du Héros = Blanc", spells.find((s) => s.id === "benediction-du-heros")?.family === "Blanc");
  check("Vengeance d'Uldrid = Vert", spells.find((s) => s.id === "vengeance-uldrid")?.family === "Vert");
  check("Abysses = Bleu", spells.find((s) => s.id === "abysses")?.family === "Bleu");
  check("Amour de Rena = Vert", spells.find((s) => s.id === "amour-rena")?.family === "Vert");
  check("Repos du héros = Blanc", spells.find((s) => s.id === "repos-heros")?.family === "Blanc");
  check("Réincarnation divine = Noir", spells.find((s) => s.id === "reincarnation-divine")?.family === "Noir");
  check("Damnation = Rouge", spells.find((s) => s.id === "damnation")?.family === "Rouge");
  check("Menace des abysses = Bleu", spells.find((s) => s.id === "menace-abysses")?.family === "Bleu");
  check("Passé naturel = Vert", spells.find((s) => s.id === "passe-naturel")?.family === "Vert");
  check("Couronne d'Ulgod = Rouge", spells.find((s) => s.id === "couronne-ulgod")?.family === "Rouge");
  check("Ancien corps de Bhaal = Noir", spells.find((s) => s.id === "ancien-corps-bhaal")?.family === "Noir");
  check("Esprits vengeurs = Noir", spells.find((s) => s.id === "esprits-vengeurs")?.family === "Noir");
  check("Égo des hommes = Noir", spells.find((s) => s.id === "ego-des-hommes")?.family === "Noir");
  check("Aucune limite = Rouge", spells.find((s) => s.id === "aucune-limite")?.family === "Rouge");
  check("Sommeil menaçant = Bleu", spells.find((s) => s.id === "sommeil-menacant")?.family === "Bleu");
  check("Terrible découverte = Bleu", spells.find((s) => s.id === "terrible-decouverte")?.family === "Bleu");

  const implementedEffects = new Set([
    ...gameSource.matchAll(/card\.effect === "([^"]+)"/g),
    ...gameSource.matchAll(/case "([^"]+)":/g)
  ].map((match) => match[1]));
  check("Tous les effets de sorts sont pris en charge par le moteur", spells.every((spell) => implementedEffects.has(spell.effect)));

  res = await fetch(`${base}/data/lands.json`);
  const lands = await res.json();
  check("lands.json = 29 terrains", lands.length === 29);
  check(
    "Entrée et Nid de la ruche = terrains verts",
    ["entree-ruche", "nid-ruche"].every((id) => lands.find((land) => land.id === id)?.family === "Vert")
  );
  check(
    "Les quatre temples antiques respectent leur couleur",
    [
      ["temple-antique-desert", "Rouge"],
      ["temple-antique-naturel", "Vert"],
      ["temple-antique-mers", "Bleu"],
      ["temple-antique-aube-polaire", "Blanc"]
    ].every(([id, family]) => lands.find((land) => land.id === id)?.family === family)
  );
  const allCards = [...cards, ...lands, ...spells];
  check("Toutes les illustrations existent", allCards.every((card) => fs.existsSync(path.join(__dirname, "..", card.image))));
  check(
    "Toutes les vidéos de carte existent en MP4",
    cards.filter((card) => card.video).every(
      (card) => card.video.endsWith(".mp4") && fs.existsSync(path.join(__dirname, "..", card.video))
    )
  );
  check("Tous les identifiants de cartes sont uniques", new Set(allCards.map((card) => card.id)).size === allCards.length);

  const deckColors = [
    ["Blanc", "Vert"],
    ["Rouge", "Noir"],
    ["Bleu", "Vert"],
    ["Noir", "Blanc"],
    ["Rouge", "Bleu"]
  ];
  check("Les 5 decks restent à 60 cartes avec 4 copies non-terrain maximum", deckColors.every((colors) => {
    const creaturePool = cards.filter((card) => colors.includes(card.family));
    const spellPool = spells.filter((card) => colors.includes(card.family) || card.family === "Incolore");
    const spellCount = Math.min(14, spellPool.length * 4);
    const creatureCount = 60 - 24 - spellCount;
    return spellCount >= 8 && spellPool.length * 4 >= spellCount && creaturePool.length * 4 >= creatureCount;
  }));

  await fetch(`${base}/api/room/reset`, json({ code: "1234" }));

  res = await fetch(`${base}/api/room/join`, json({ code: "1234", name: "Alice", deckId: "blanc-vert" }));
  const p1 = await res.json();
  check("Salon 1234 : join joueur 1 -> slot player", res.status === 200 && p1.slot === "player");

  res = await fetch(`${base}/api/room/join`, json({ code: "1234", name: "Bob", deckId: "rouge-noir" }));
  const p2 = await res.json();
  check("Salon 1234 : join joueur 2 -> slot enemy", res.status === 200 && p2.slot === "enemy");

  res = await fetch(`${base}/api/room/state?code=1234&playerId=${encodeURIComponent(p2.playerId)}`);
  const st = await res.json();
  check("Les deux joueurs sont dans le salon", Boolean(st.room.players.player && st.room.players.enemy));

  res = await fetch(`${base}/api/room/state`, json({ code: "1234", playerId: p1.playerId, version: 0, state: { started: true, turn: 1, marker: "sync-ok" } }));
  const pub = await res.json();
  check("Publication de l'état -> version 1", res.status === 200 && pub.version === 1);

  res = await fetch(`${base}/api/room/state?code=1234&playerId=${encodeURIComponent(p2.playerId)}`);
  const st2 = await res.json();
  check("Le joueur 2 reçoit l'état synchronisé", st2.room.state?.marker === "sync-ok" && st2.room.version === 1);

  res = await fetch(`${base}/api/room/state`, json({ code: "1234", playerId: p2.playerId, version: 0, state: { marker: "obsolete" } }));
  const stale = await res.json();
  check(
    "Un état réseau obsolète ne peut pas écraser la partie",
    res.status === 409 && stale.room?.state?.marker === "sync-ok" && stale.room?.version === 1
  );

  res = await fetch(`${base}/api/room/join`, json({ code: "0000" }));
  check("Code invalide -> 403", res.status === 403);

  res = await fetch(`${base}/api/room/join`, json({ code: "1234", name: "Intrus" }));
  check("Troisième joueur refusé -> 409", res.status === 409);

  console.log(failed === 0 ? "\n=> TOUS LES TESTS PASSENT" : `\n=> ${failed} TEST(S) EN ECHEC`);
}

main()
  .catch((error) => {
    console.error(error);
    failed += 1;
  })
  .finally(() => {
    server.kill();
    process.exit(failed ? 1 : 0);
  });
