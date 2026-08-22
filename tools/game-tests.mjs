// =====================================================================
// Spellaho - Tests de comportement du moteur reel
// ---------------------------------------------------------------------
// `tools/smoke-test.js` verifie les donnees et les fichiers ; il ne fait
// jamais tourner `game.js`. Ici on charge le vrai module dans le DOM
// minimal de `tools/dom-stub.mjs`, puis on joue de vraies parties en
// passant par les memes chemins que l'interface (bouton Fin du tour,
// fiche de carte, bouton d'action). Un plantage au chargement, une regle
// violee ou un tour bloque font echouer le test.
//
//   node .\tools\game-tests.mjs
// =====================================================================
import { installerDom, attendre, horloge } from "./dom-stub.mjs";

installerDom({ timeScale: 0.02, instantAnimation: true });

const resultats = { total: 0, reussis: 0, echecs: [] };
let contexteCourant = "";

function verifier(condition, libelle, detail = "") {
  resultats.total += 1;
  if (condition) {
    resultats.reussis += 1;
    console.log(`  OK   ${libelle}`);
    return true;
  }
  resultats.echecs.push(`${contexteCourant}${libelle}${detail ? ` — ${detail}` : ""}`);
  console.log(`  FAIL ${libelle}${detail ? ` — ${detail}` : ""}`);
  return false;
}

function section(titre) {
  contexteCourant = `[${titre}] `;
  console.log(`\n=== ${titre} ===`);
}

// --- Chargement du jeu -------------------------------------------------
const erreursConsole = [];
const consoleErreurOrigine = console.error;
console.error = (...args) => { erreursConsole.push(args.map(String).join(" ")); consoleErreurOrigine(...args); };

await import("../game.js");
await attendre(200);

const debug = globalThis.SpellahoDebug;
const jeu = () => debug.state;

// --- Pilotage par l'interface ------------------------------------------
const els = {
  startMenu: document.querySelector("#start-menu"),
  startGame: document.querySelector("#start-game"),
  modeSelect: document.querySelector("#mode-select"),
  playerDeck: document.querySelector("#player-deck-select"),
  enemyDeck: document.querySelector("#enemy-deck-select"),
  endTurn: document.querySelector("#end-turn"),
  newGame: document.querySelector("#new-game"),
  hand: document.querySelector("#player-hand"),
  playerBoard: document.querySelector("#player-board"),
  enemyBoard: document.querySelector("#enemy-board"),
  cardModal: document.querySelector("#card-modal"),
  cardModalAction: document.querySelector("#card-modal-action"),
  cardModalClose: document.querySelector("#card-modal-close"),
  gameOver: document.querySelector("#game-over"),
  rematch: document.querySelector("#game-over-rematch"),
  clearLog: document.querySelector("#clear-log"),
  turnHandoffConfirm: document.querySelector("#turn-handoff-confirm")
};

// Certains scénarios installent une situation directement dans l'état. Vider
// le journal est la seule commande de l'interface qui redessine tout le
// plateau sans rien changer aux règles : elle sert donc de rafraîchissement.
const rendre = () => els.clearLog.dispatchEvent({ type: "click" });

// Un bouton desactive n'emet pas de clic dans un navigateur : le stub doit
// se comporter pareil, sinon les tests declencheraient des actions
// impossibles a la souris.
const clic = (noeud) => (noeud && !noeud.disabled ? noeud.dispatchEvent({ type: "click" }) : false);

// Attente conditionnelle : plus fiable qu'un delai fixe, l'IA enchainant
// ses attaques par une suite de minuteries.
async function attendreQue(predicat, limiteMs = 6000) {
  const debut = Date.now();
  while (!predicat()) {
    if (Date.now() - debut > limiteMs * horloge.timeScale + 2000) return false;
    await attendre(40);
  }
  return true;
}

const attendreTourDuJoueur = () => attendreQue(() => jeu().currentTurn === "player" || jeu().phase === "over");

async function lancerPartie(mode = "pve", options = {}) {
  els.modeSelect.value = mode;
  els.playerDeck.value = options.playerDeckId || "blanc-vert";
  els.enemyDeck.value = options.enemyDeckId || "rouge-noir";
  clic(els.startGame);
  await attendre(120);
}

function carteDeMain(uid) {
  return els.hand.querySelector(`.game-card[data-uid="${uid}"]`);
}

// Chemin exact du joueur sur PC : clic sur la carte (fiche), puis clic sur
// le bouton d'action de la fiche.
function jouerParFiche(uid) {
  const noeud = carteDeMain(uid);
  if (!noeud) return { ouverte: false, active: false };
  clic(noeud.querySelector(".card-content"));
  const active = !els.cardModalAction.disabled;
  if (active) clic(els.cardModalAction);
  return { ouverte: true, active };
}

function noeudPlateau(uid, cote = "player") {
  const conteneur = cote === "player" ? els.playerBoard : els.enemyBoard;
  return conteneur.querySelector(`.game-card[data-uid="${uid}"]`);
}

function selectionnerAttaquant(uid) {
  const noeud = noeudPlateau(uid, "player");
  if (!noeud) return false;
  clic(noeud.querySelector(".card-content"));
  if (els.cardModalAction.disabled) return false;
  clic(els.cardModalAction);
  return true;
}

async function attaquerCreature(uidCible) {
  const noeud = noeudPlateau(uidCible, "enemy");
  if (!noeud) return false;
  clic(noeud.querySelector(".card-content"));
  if (els.cardModalAction.disabled) return false;
  clic(els.cardModalAction);
  await attendre(60);
  return true;
}

// Joue tout ce qui est jouable dans la main du joueur, terrain compris.
function jouerToutCeQuiEstPossible(limite = 12) {
  let joues = 0;
  for (let tour = 0; tour < limite; tour += 1) {
    const main = [...jeu().player.hand];
    const jouable = main.find((carte) => carteDeMain(carte.uid)?.classList.contains("is-playable"));
    if (!jouable) break;
    const avant = jeu().player.hand.length;
    jouerParFiche(jouable.uid);
    if (jeu().player.hand.length === avant) break;
    joues += 1;
  }
  return joues;
}

// ======================================================================
section("Chargement du module");
verifier(Boolean(debug), "SpellahoDebug est installé");
verifier(erreursConsole.length === 0, "Aucune erreur console au chargement", erreursConsole[0] || "");
verifier(jeu()?.cards?.length > 0, `Les cartes sont chargées (${jeu()?.cards?.length || 0})`);
verifier(els.startMenu.hidden === false, "Le menu de lancement s'ouvre");

// ======================================================================
section("Démarrage d'une partie contre l'IA");
await lancerPartie("pve");
let etat = jeu();
verifier(etat.started === true, "La partie est démarrée");
verifier(etat.currentTurn === "player", "Le joueur commence");
verifier(etat.turn === 1, "Le compteur de tour vaut 1");
verifier(etat.player.hand.length === 7 && etat.enemy.hand.length === 7, "Chaque camp pioche 7 cartes", `${etat.player.hand.length}/${etat.enemy.hand.length}`);
verifier(etat.player.deck.length === 53 && etat.enemy.deck.length === 53, "Les bibliothèques tombent à 53 cartes", `${etat.player.deck.length}/${etat.enemy.deck.length}`);
verifier(etat.player.life === 20 && etat.enemy.life === 20, "20 points de vie de chaque côté");
verifier(els.startMenu.hidden === true, "Le menu se referme au lancement");
verifier(debug.validate().length === 0, "L'état de départ est valide", debug.validate().join(" / "));

// ======================================================================
section("Réserve divine Noir/Rouge");
{
  const cote = jeu().enemy;
  const fusionId = "noxis-bhaal-fusion";
  verifier(cote.invocations?.length === 1 && cote.invocations[0].card.id === fusionId, "La Fusion est placée dans la réserve divine");
  verifier(!cote.deck.some((c) => c.id === fusionId) && !cote.hand.some((c) => c.id === fusionId), "La Fusion ne compte pas dans les 60 cartes et ne rejoint pas la main au départ");

  const uniteDivine = (id) => {
    const carte = jeu().cards.find((c) => c.id === id);
    return {
      ...carte,
      uid: `test-${id}`,
      owner: "enemy",
      maxLife: carte.life,
      currentLife: carte.life,
      tapped: false,
      stunTurns: 0,
      createdTurn: 0,
      survivedTurns: 0,
      hasAttacked: false
    };
  };
  cote.board.push(uniteDivine("noxis"), uniteDivine("bhaal"));
  const mainAvant = cote.hand.length;
  rendre();
  verifier(cote.hand.length === mainAvant + 1 && cote.hand.some((c) => c.id === fusionId), "Noxis et Bhaal débloquent la Fusion dans la main");
  rendre();
  verifier(cote.hand.filter((c) => c.id === fusionId).length === 1, "La Fusion n'est accordée qu'une seule fois");

  cote.board = cote.board.filter((unit) => !["test-noxis", "test-bhaal"].includes(unit.uid));
  cote.hand = cote.hand.filter((card) => card.id !== fusionId);
  cote.invocations[0].granted = false;
  rendre();
}

// ======================================================================
section("Règles du tour");
{
  // Le mélange peut servir une main sans terrain : le scénario porte sur la
  // règle du terrain par tour, pas sur la chance de la pioche.
  if (!jeu().player.hand.some((c) => c.kind === "land")) {
    jeu().player.hand.push({ ...jeu().lands[0], uid: "terrain-garanti" });
    rendre();
  }
  const avantMain = jeu().player.hand.length;
  const posee = jouerParFiche(jeu().player.hand.find((c) => c.kind === "land").uid);
  verifier(posee.active, "Le premier terrain est jouable");
  verifier(jeu().player.hand.length === avantMain - 1, "Le terrain quitte la main");
  verifier(jeu().player.lands.length === 1, "Le terrain arrive en jeu");
  verifier(jeu().player.landPlayed === true, "Le terrain du tour est marqué comme posé");

  const second = jeu().player.hand.find((c) => c.kind === "land");
  if (second) {
    const tentative = jouerParFiche(second.uid);
    verifier(tentative.active === false, "Un deuxième terrain est refusé dans le même tour");
    verifier(jeu().player.lands.length === 1, "Aucun second terrain ne s'ajoute");
  }
}

// ======================================================================
section("Actions hors tour et spam de clics");
{
  const avantTerrains = jeu().player.lands.length;
  const tourAvant = jeu().turn;
  // Spam immédiat : 25 clics d'affilée ne doivent finir qu'un seul tour.
  for (let i = 0; i < 25; i += 1) clic(els.endTurn);
  verifier(jeu().currentTurn === "enemy", "Un seul « Fin du tour » est pris en compte malgré 25 clics");
  verifier(jeu().turn === tourAvant, "Le spam de clics ne saute pas de tours", `${tourAvant} -> ${jeu().turn}`);
  verifier(els.endTurn.disabled === true, "Le bouton « Fin du tour » se verrouille hors du tour du joueur");

  // Le tour est à l'IA : plus aucune action du joueur ne doit passer.
  const carteHorsTour = jeu().player.hand.find((c) => c.kind === "land");
  if (carteHorsTour) jouerParFiche(carteHorsTour.uid);
  verifier(jeu().player.lands.length === avantTerrains, "Aucun terrain ne se pose pendant le tour adverse");

  await attendreTourDuJoueur();
  verifier(jeu().currentTurn === "player", "La main revient au joueur après le tour de l'IA");
  verifier(jeu().turn === tourAvant + 1, "Le compteur de tour avance d'exactement un", `${tourAvant} -> ${jeu().turn}`);
  verifier(debug.validate().length === 0, "L'état reste valide après un aller-retour de tour", debug.validate().join(" / "));
}

// ======================================================================
section("Mana et paiement");
{
  const etatJeu = jeu();
  const cote = etatJeu.player;
  // On construit une situation nette : trois terrains verts dégagés.
  cote.lands.length = 0;
  const terrainVert = etatJeu.lands.find((l) => l.family === "Vert" && !l.entersTapped);
  for (let i = 0; i < 3; i += 1) cote.lands.push({ ...terrainVert, uid: `test-vert-${i}`, tapped: false });
  const creature = etatJeu.cards.find((c) => c.family === "Vert" && c.cost === 3 && !c.divine);
  cote.hand.push({ ...creature, uid: "test-creature-verte" });
  cote.landPlayed = true;

  clic(els.endTurn);
  await attendreTourDuJoueur(); // repasse au joueur, terrains dégagés
  const rendu = jouerParFiche("test-creature-verte");
  verifier(rendu.active, "Une créature verte à 3 se lance avec 3 terrains verts");
  const engages = jeu().player.lands.filter((l) => l.tapped).length;
  verifier(engages === 3, "Exactement 3 terrains sont engagés", String(engages));

  const seconde = { ...creature, uid: "test-creature-verte-2" };
  jeu().player.hand.push(seconde);
  const refus = jouerParFiche("test-creature-verte-2");
  verifier(refus.active === false, "Une seconde copie est refusée : les terrains sont déjà engagés");
  verifier(jeu().player.lands.filter((l) => l.tapped).length === 3, "Aucun terrain n'est engagé deux fois");
}

// ======================================================================
section("Combat : mal d'invocation, attaque, riposte");
{
  const attaquant = jeu().player.board.at(-1);
  verifier(Boolean(attaquant), "Une créature est bien sur le champ de bataille");
  verifier(selectionnerAttaquant(attaquant.uid) === false, "Une créature fraîchement invoquée ne peut pas attaquer (mal d'invocation)");

  // Passage de tour pour lever le mal d'invocation. Le champ adverse est
  // vidé pour que le test porte sur l'attaque, pas sur les aléas de l'IA.
  clic(els.endTurn);
  await attendreTourDuJoueur();
  jeu().enemy.board.length = 0;
  if (!jeu().player.board.some((u) => u.uid === attaquant.uid)) {
    jeu().player.board.push({ ...attaquant, tapped: false, hasAttacked: false, createdTurn: 0, currentLife: attaquant.maxLife });
  }
  rendre();
  const pret = jeu().player.board.find((u) => u.uid === attaquant.uid);
  verifier(selectionnerAttaquant(pret.uid), "La créature peut attaquer au tour suivant");

  const vieAvant = jeu().enemy.life;
  const boutonHero = document.querySelector("#attack-hero");
  verifier(boutonHero.disabled === false, "Le bouton « Frapper le commandant » s'active avec un attaquant choisi");
  clic(boutonHero);
  await attendre(200);
  verifier(jeu().enemy.life === vieAvant - pret.attack, "Le commandant adverse encaisse exactement la force de l'attaquant", `${vieAvant} -> ${jeu().enemy.life} (force ${pret.attack})`);
  const apres = jeu().player.board.find((u) => u.uid === pret.uid);
  verifier(Boolean(apres?.hasAttacked), "L'attaquant est marqué comme ayant agi");
  verifier(selectionnerAttaquant(pret.uid) === false, "Une créature ne peut pas attaquer deux fois dans le tour");
  const vieApres = jeu().enemy.life;
  clic(boutonHero);
  await attendre(200);
  verifier(jeu().enemy.life === vieApres, "Le spam du bouton d'attaque n'inflige pas de dégâts supplémentaires");
}

// ======================================================================
section("Défenseur (Provocation) et Célérité");
{
  const etatJeu = jeu();
  const defenseur = etatJeu.cards.find((c) => (c.keywords || []).some((k) => /d[ée]fenseur/i.test(k)));
  const celerite = etatJeu.cards.find((c) => (c.keywords || []).some((k) => /c[ée]l[ée]rit[ée]/i.test(k)));
  etatJeu.enemy.board.length = 0;
  etatJeu.enemy.board.push({
    ...defenseur, uid: "test-defenseur", owner: "enemy", maxLife: defenseur.life,
    currentLife: defenseur.life, tapped: false, stunTurns: 0, createdTurn: 0, survivedTurns: 0, hasAttacked: false
  });
  const cible = etatJeu.enemy.board[0];
  // Célérité seule, sans Vol : le Vol ignore la Provocation et fausserait
  // le test de protection du commandant.
  etatJeu.player.board.length = 0;
  etatJeu.player.board.push({
    ...celerite, keywords: ["Célérité"], uid: "test-celerite", owner: "player", maxLife: celerite.life,
    currentLife: celerite.life, tapped: false, stunTurns: 0, createdTurn: etatJeu.turn, survivedTurns: 0, hasAttacked: false
  });
  const rapide = etatJeu.player.board.at(-1);
  rendre();

  verifier(selectionnerAttaquant(rapide.uid), "Célérité permet d'attaquer dès le tour d'arrivée");
  const boutonHero = document.querySelector("#attack-hero");
  verifier(boutonHero.disabled === true, "Une Provocation adverse verrouille l'attaque du commandant");
  const vieHeros = jeu().enemy.life;
  clic(boutonHero);
  await attendre(120);
  verifier(jeu().enemy.life === vieHeros, "Le commandant protégé ne perd aucun point de vie");

  const vieDefenseur = cible.currentLife;
  await attaquerCreature(cible.uid);
  const defenseurApres = jeu().enemy.board[0];
  verifier(
    !defenseurApres || defenseurApres.currentLife === vieDefenseur - rapide.attack,
    "La Provocation encaisse bien l'attaque",
    `${vieDefenseur} -> ${defenseurApres?.currentLife ?? "détruit"}`
  );
  verifier(
    !defenseurApres || noeudPlateau(cible.uid, "enemy")?.querySelector(".card-content")?.innerHTML.includes(`>${defenseurApres.currentLife}<`),
    "La carte blessée est bien redessinée avec ses nouveaux points de vie"
  );
  const riposte = jeu().player.board.find((u) => u.uid === rapide.uid);
  verifier(
    !riposte || riposte.currentLife === rapide.maxLife - cible.attack,
    "L'attaquant encaisse la riposte de sa cible",
    `${rapide.maxLife} -> ${riposte?.currentLife ?? "détruit"} (riposte ${cible.attack})`
  );

  // Le Vol, lui, doit franchir la Provocation.
  jeu().player.board.length = 0;
  jeu().player.board.push({
    ...celerite, keywords: ["Célérité", "Vol"], uid: "test-vol", owner: "player", maxLife: celerite.life,
    currentLife: celerite.life, tapped: false, stunTurns: 0, createdTurn: jeu().turn, survivedTurns: 0, hasAttacked: false
  });
  const voltigeur = jeu().player.board.at(-1);
  rendre();
  verifier(selectionnerAttaquant(voltigeur.uid), "Une créature volante est sélectionnable");
  const vieAvantVol = jeu().enemy.life;
  const boutonHeroVol = document.querySelector("#attack-hero");
  verifier(boutonHeroVol.disabled === false, "Le Vol ignore la Provocation et rouvre le commandant");
  clic(boutonHeroVol);
  await attendre(150);
  verifier(jeu().enemy.life === vieAvantVol - voltigeur.attack, "Le voltigeur frappe le commandant malgré la Provocation", `${vieAvantVol} -> ${jeu().enemy.life}`);
}

// ======================================================================
section("Contact mortel, Lien de vie et morts simultanées");
{
  await lancerPartie("pve");
  const etatJeu = jeu();
  const gabarit = etatJeu.cards[0];
  const unite = (options) => ({
    ...gabarit, ...options, maxLife: options.life, currentLife: options.life,
    tapped: false, stunTurns: 0, createdTurn: 0, survivedTurns: 0, hasAttacked: false, keywords: options.keywords || []
  });

  etatJeu.player.board.length = 0;
  etatJeu.enemy.board.length = 0;
  etatJeu.player.board.push(unite({ uid: "mortel", owner: "player", name: "Test mortel", attack: 1, life: 9, keywords: ["Contact mortel"] }));
  etatJeu.enemy.board.push(unite({ uid: "colosse", owner: "enemy", name: "Test colosse", attack: 1, life: 9 }));
  rendre();
  selectionnerAttaquant("mortel");
  await attaquerCreature("colosse");
  verifier(jeu().enemy.board.length === 0, "Contact mortel détruit une cible bien plus grosse");
  verifier(jeu().enemy.graveyard.some((c) => c.name === "Test colosse"), "La cible tuée rejoint le cimetière");

  // Échange mortel des deux côtés.
  jeu().player.board.length = 0;
  jeu().enemy.board.length = 0;
  jeu().player.board.push(unite({ uid: "kamikaze-a", owner: "player", name: "Test A", attack: 5, life: 2 }));
  jeu().enemy.board.push(unite({ uid: "kamikaze-b", owner: "enemy", name: "Test B", attack: 5, life: 2 }));
  rendre();
  selectionnerAttaquant("kamikaze-a");
  await attaquerCreature("kamikaze-b");
  verifier(jeu().player.board.length === 0 && jeu().enemy.board.length === 0, "Deux créatures qui s'entretuent partent ensemble");
  verifier(debug.validate().length === 0, "L'état reste valide après un échange mortel");

  // Lien de vie sur l'attaque du commandant.
  jeu().player.board.length = 0;
  jeu().player.life = 10;
  jeu().player.board.push(unite({ uid: "vampire", owner: "player", name: "Test vampire", attack: 4, life: 4, keywords: ["Lien de vie"] }));
  rendre();
  selectionnerAttaquant("vampire");
  clic(document.querySelector("#attack-hero"));
  await attendre(150);
  verifier(jeu().player.life === 14, "Le Lien de vie rend autant de vie que de dégâts infligés", String(jeu().player.life));

  // Le plafond de vie tient.
  jeu().player.life = 29;
  jeu().player.board[0].hasAttacked = false;
  jeu().player.board[0].tapped = false;
  rendre();
  selectionnerAttaquant("vampire");
  clic(document.querySelector("#attack-hero"));
  await attendre(150);
  verifier(jeu().player.life === 30, "La vie reste plafonnée à 30", String(jeu().player.life));
}

// ======================================================================
section("Champ de bataille plein");
{
  await lancerPartie("pve");
  const etatJeu = jeu();
  const gabarit = etatJeu.cards[0];
  etatJeu.player.board.length = 0;
  for (let i = 0; i < 7; i += 1) {
    etatJeu.player.board.push({
      ...gabarit, uid: `plein-${i}`, owner: "player", maxLife: gabarit.life, currentLife: gabarit.life,
      tapped: false, stunTurns: 0, createdTurn: 0, survivedTurns: 0, hasAttacked: false
    });
  }
  const creature = etatJeu.cards.find((c) => c.cost <= 2 && !c.divine);
  etatJeu.player.hand.push({ ...creature, uid: "test-plateau-plein" });
  etatJeu.player.lands.length = 0;
  const terrain = etatJeu.lands.find((l) => l.family === creature.family && !l.entersTapped);
  for (let i = 0; i < 6; i += 1) etatJeu.player.lands.push({ ...terrain, uid: `terrain-plein-${i}`, tapped: false });
  rendre();

  const tentative = jouerParFiche("test-plateau-plein");
  verifier(tentative.active === false, "Une invocation est refusée quand les 7 places sont prises");
  verifier(jeu().player.board.length === 7, "Le champ de bataille ne dépasse jamais 7 créatures", String(jeu().player.board.length));
  verifier(debug.validate().length === 0, "L'état reste valide avec un champ plein");
}

// ======================================================================
section("Fatigue et fin de partie");
{
  await lancerPartie("pve");
  const etatJeu = jeu();
  etatJeu.player.deck.length = 0;
  etatJeu.player.life = 3;
  const vieDepart = etatJeu.player.life;
  clic(els.endTurn);
  await attendre(1200);
  verifier(jeu().player.life < vieDepart, "Piocher sans bibliothèque coûte des points de vie", `${vieDepart} -> ${jeu().player.life}`);

  // On force la mort par fatigue au tour suivant.
  jeu().player.life = 1;
  const tourFatigue = jeu().turn;
  for (let i = 0; i < 6 && jeu().phase !== "over"; i += 1) {
    if (jeu().currentTurn === "player") clic(els.endTurn);
    await attendre(1200);
  }
  verifier(jeu().phase === "over", "La fatigue finit par tuer le joueur", `tour ${tourFatigue} -> ${jeu().turn}, vie ${jeu().player.life}`);
  verifier(jeu().winner === "enemy", "L'adversaire est déclaré vainqueur", String(jeu().winner));
  verifier(els.gameOver.hidden === false, "L'écran de fin de partie s'affiche");

  // Plus aucune action ne doit passer après la mort.
  const vieAdverse = jeu().enemy.life;
  const terrainsAvant = jeu().player.lands.length;
  const carte = jeu().player.hand.find((c) => c.kind === "land");
  if (carte) jouerParFiche(carte.uid);
  clic(els.endTurn);
  await attendre(400);
  verifier(jeu().phase === "over", "La partie reste terminée malgré de nouveaux clics");
  verifier(jeu().player.lands.length === terrainsAvant, "Aucune carte ne se joue après la fin");
  verifier(jeu().enemy.life === vieAdverse, "Aucun dégât n'est appliqué après la fin");
}

// ======================================================================
section("Revanche et nouvelle partie");
{
  const matchPrecedent = jeu().matchId;
  clic(els.rematch);
  await attendre(200);
  verifier(jeu().matchId !== matchPrecedent, "La revanche ouvre une nouvelle partie");
  verifier(jeu().phase === "main1" && jeu().winner === null, "La revanche repart d'un état propre");
  verifier(jeu().player.life === 20 && jeu().enemy.life === 20, "Les points de vie sont remis à 20");
  verifier(jeu().turn === 1 && jeu().currentTurn === "player", "La revanche recommence au tour 1 du joueur");
  verifier(els.gameOver.hidden === true, "L'écran de fin se referme");
  verifier(debug.validate().length === 0, "L'état de la revanche est valide", debug.validate().join(" / "));

  // Retour au menu puis relance : aucun timer de l'ancienne partie ne doit agir.
  clic(els.newGame);
  await attendre(100);
  verifier(els.startMenu.hidden === false, "Le retour au menu affiche l'écran de lancement");
  const vieGelee = jeu().enemy.life;
  await attendre(1500);
  verifier(jeu().enemy.life === vieGelee, "Aucune action ne se poursuit pendant que le menu est ouvert");
}

// ======================================================================
section("Grosse main et rendu");
{
  await lancerPartie("pve");
  const etatJeu = jeu();
  for (let i = 0; i < 25; i += 1) etatJeu.player.hand.push({ ...etatJeu.lands[0], uid: `main-large-${i}` });
  clic(els.endTurn); await attendre(900);
  const cartesRendues = els.hand.querySelectorAll(".game-card").length;
  verifier(cartesRendues === jeu().player.hand.length, "Toutes les cartes d'une grosse main sont rendues", `${cartesRendues}/${jeu().player.hand.length}`);
  verifier(debug.validate().length === 0, "Une main de 30+ cartes ne casse pas l'état");
}

// ======================================================================
section("Animations interrompues et minuteries");
{
  // Timings réels : on veut pouvoir intervenir pendant la charge d'attaque.
  const echelle = horloge.timeScale;
  horloge.timeScale = 1;
  horloge.instantAnimation = false;

  // 1. Une attaque de l'IA rendue caduque en plein vol ne doit pas figer le tour.
  await lancerPartie("pve");
  const etatJeu = jeu();
  const gabarit = etatJeu.cards[0];
  etatJeu.enemy.board.push({
    ...gabarit, uid: "ia-attaquant", owner: "enemy", name: "Test IA", attack: 2,
    maxLife: 5, currentLife: 5, tapped: false, stunTurns: 0, createdTurn: 0, survivedTurns: 0, hasAttacked: false, keywords: []
  });
  clic(els.endTurn);
  // On attend que l'IA choisisse son attaquant, puis on le retire du plateau
  // avant la résolution : c'est le cas « attaque périmée ».
  const aCible = await attendreQue(() => jeu().selectedAttackerId === "ia-attaquant" || jeu().currentTurn === "player", 4000);
  if (aCible && jeu().selectedAttackerId === "ia-attaquant") {
    jeu().enemy.board = jeu().enemy.board.filter((u) => u.uid !== "ia-attaquant");
  }
  const rendu = await attendreQue(() => jeu().currentTurn === "player" || jeu().phase === "over", 6000);
  verifier(rendu, "Une attaque de l'IA annulée en vol ne bloque pas la partie");

  // 2. Retour au menu pendant une charge d'attaque : la partie suivante joue.
  horloge.timeScale = echelle;
  horloge.instantAnimation = true;
  await lancerPartie("pve");
  jeu().player.board.push({
    ...gabarit, uid: "attaquant-interrompu", owner: "player", attack: 2,
    maxLife: 5, currentLife: 5, tapped: false, stunTurns: 0, createdTurn: 0, survivedTurns: 0, hasAttacked: false, keywords: []
  });
  rendre();
  selectionnerAttaquant("attaquant-interrompu");
  clic(document.querySelector("#attack-hero"));
  clic(els.newGame);
  await attendre(200);
  await lancerPartie("pve");
  // Le mélange peut ne servir aucun terrain : le scénario porte sur la
  // relance après animation, pas sur la chance de la pioche.
  if (!jeu().player.hand.some((c) => c.kind === "land")) {
    jeu().player.hand.push({ ...jeu().lands[0], uid: "terrain-relance" });
    rendre();
  }
  const terrain = jeu().player.hand.find((c) => c.kind === "land");
  const relance = terrain ? jouerParFiche(terrain.uid) : { active: false };
  verifier(relance.active, "Une partie relancée après une attaque interrompue reste jouable");
  verifier(jeu().player.lands.length === 1, "La carte se pose bien dans la nouvelle partie");
}

// ======================================================================
section("L'IA ne joue plus après sa mort");
{
  await lancerPartie("pve");
  jeu().enemy.life = 1;
  jeu().player.board.push({
    ...jeu().cards[0], uid: "tueur", owner: "player", attack: 5,
    maxLife: 5, currentLife: 5, tapped: false, stunTurns: 0, createdTurn: 0, survivedTurns: 0, hasAttacked: false, keywords: []
  });
  rendre();
  selectionnerAttaquant("tueur");
  clic(document.querySelector("#attack-hero"));
  await attendre(200);
  verifier(jeu().phase === "over" && jeu().winner === "player", "Le joueur gagne en abattant le commandant adverse");
  const empreinte = JSON.stringify({
    main: jeu().enemy.hand.length, plateau: jeu().enemy.board.length,
    terrains: jeu().enemy.lands.length, vie: jeu().player.life, tour: jeu().turn
  });
  await attendre(4000);
  const apres = JSON.stringify({
    main: jeu().enemy.hand.length, plateau: jeu().enemy.board.length,
    terrains: jeu().enemy.lands.length, vie: jeu().player.life, tour: jeu().turn
  });
  verifier(empreinte === apres, "Aucune action de l'IA ne se déclenche après la fin de partie", `${empreinte} != ${apres}`);
}

// ======================================================================
section("Chemin tactile (téléphone)");
{
  horloge.pointeurFin = false;
  await lancerPartie("pve");
  const gabarit = jeu().cards[0];
  jeu().player.board.push({
    ...gabarit, uid: "tactile", owner: "player", attack: 3,
    maxLife: 4, currentLife: 4, tapped: false, stunTurns: 0, createdTurn: 0, survivedTurns: 0, hasAttacked: false, keywords: []
  });
  jeu().enemy.board.length = 0;
  jeu().enemy.board.push({
    ...gabarit, uid: "tactile-cible", owner: "enemy", attack: 1,
    maxLife: 9, currentLife: 9, tapped: false, stunTurns: 0, createdTurn: 0, survivedTurns: 0, hasAttacked: false, keywords: []
  });
  rendre();
  // Sur tactile, un simple appui sélectionne l'attaquant sans passer par la fiche.
  clic(noeudPlateau("tactile", "player").querySelector(".card-content"));
  verifier(jeu().selectedAttackerId === "tactile", "Un appui sélectionne directement l'attaquant sur mobile");
  clic(noeudPlateau("tactile-cible", "enemy").querySelector(".card-content"));
  await attendre(150);
  verifier(jeu().enemy.board[0].currentLife === 6, "Un second appui résout l'attaque sur mobile", String(jeu().enemy.board[0]?.currentLife));
  verifier(jeu().selectedAttackerId === null, "Le ciblage se purge après l'attaque");

  // Une créature prête à attaquer se sélectionne d'un appui ; l'appui long
  // reste alors le seul chemin vers sa fiche agrandie.
  const pointe = (noeud, type, options = {}) =>
    noeud.dispatchEvent({ type, pointerType: "touch", pointerId: 5, button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: 10, clientY: 10, ...options });
  const controleTactile = noeudPlateau("tactile", "player")?.querySelector(".card-content");
  if (controleTactile) {
    pointe(controleTactile, "pointerdown");
    await attendre(700);
    verifier(els.cardModal.hidden === false, "Un appui long ouvre la fiche d'une créature prête sur mobile");
    verifier(jeu().selectedAttackerId === null, "L'appui long ne sélectionne pas la créature comme attaquante");
    pointe(controleTactile, "pointerup");
    clic(controleTactile);
    verifier(els.cardModal.hidden === false, "Le relâchement ne referme pas la fiche");
    clic(els.cardModalClose);
    await attendre(80);

    // Un appui bref garde son rôle : choisir l'attaquant. La créature a déjà
    // frappé plus haut dans ce scénario, on la redégage d'abord.
    const prete = jeu().player.board.find((unit) => unit.uid === "tactile");
    prete.hasAttacked = false;
    prete.tapped = false;
    rendre();
    const controleFrais = noeudPlateau("tactile", "player").querySelector(".card-content");
    pointe(controleFrais, "pointerdown");
    // Les minuteries du jeu sont compressées par `timeScale`, pas `attendre` :
    // un appui « bref » doit donc rester sous le seuil compressé, sinon il
    // déclencherait l'appui long.
    await attendre(500 * horloge.timeScale * 0.4);
    pointe(controleFrais, "pointerup");
    clic(controleFrais);
    verifier(jeu().selectedAttackerId === "tactile", "Un appui bref sélectionne toujours l'attaquant");
  }

  // Vues mobiles : chaque bouton doit mener à une vue existante.
  for (const vue of ["cards", "rules", "log", "board"]) {
    const bouton = document.querySelector(`[data-mobile-view="${vue}"]`);
    if (bouton) { bouton.dataset.mobileView = vue; clic(bouton); }
  }
  horloge.pointeurFin = true;
}

// ======================================================================
section("Parties complètes contre l'IA");
{
  const PARTIES = 12;
  let terminees = 0;
  let bloquees = 0;
  let etatsInvalides = 0;
  const decks = ["blanc-vert", "rouge-noir", "bleu-vert", "noir-blanc", "rouge-bleu", "blanc-bleu"];

  for (let partie = 0; partie < PARTIES; partie += 1) {
    await lancerPartie("pve", {
      playerDeckId: decks[partie % decks.length],
      enemyDeckId: decks[(partie + 3) % decks.length]
    });
    let garde = 0;
    while (jeu().phase !== "over" && garde < 220) {
      garde += 1;
      if (jeu().currentTurn === "player") {
        jouerToutCeQuiEstPossible();
        // Attaque avec tout ce qui est prêt.
        for (const unite of [...jeu().player.board]) {
          if (jeu().phase === "over") break;
          if (!selectionnerAttaquant(unite.uid)) continue;
          const cible = jeu().enemy.board.find((u) => u.currentLife > 0);
          const boutonHero = document.querySelector("#attack-hero");
          if (!boutonHero.disabled) { clic(boutonHero); await attendre(80); }
          else if (cible) { await attaquerCreature(cible.uid); }
          else { break; }
        }
        if (debug.validate().length > 0) etatsInvalides += 1;
        clic(els.endTurn);
      }
      await attendre(500);
      if (jeu().currentTurn === "enemy" && jeu().phase !== "over") await attendre(1500);
    }
    if (jeu().phase === "over") terminees += 1; else bloquees += 1;
  }

  verifier(terminees === PARTIES, `Les ${PARTIES} parties contre l'IA vont jusqu'au bout`, `${terminees} terminées, ${bloquees} bloquées`);
  verifier(etatsInvalides === 0, "Aucun état invalide pendant les parties", `${etatsInvalides} détections`);
}

// ======================================================================
section("Fuzz : clics aléatoires, y compris illégaux");
{
  // Générateur reproductible : un échec doit pouvoir être rejoué.
  let graine = 20260818;
  const alea = () => {
    graine = (graine * 1664525 + 1013904223) % 4294967296;
    return graine / 4294967296;
  };
  const piocherDans = (liste) => liste[Math.floor(alea() * liste.length)];
  // Clic « brutal » : ignore l'état désactivé du bouton, comme un tap
  // parasite ou un double événement tactile le ferait.
  const clicBrutal = (noeud) => noeud?.dispatchEvent({ type: "click" });

  const PARTIES = 8;
  let anomalies = [];
  let blocages = 0;

  for (let partie = 0; partie < PARTIES && anomalies.length === 0; partie += 1) {
    await lancerPartie(alea() < 0.5 ? "pve" : "pvp");
    for (let pas = 0; pas < 260 && jeu().phase !== "over"; pas += 1) {
      const cibles = [
        () => { const c = piocherDans(els.hand.querySelectorAll(".game-card")); if (c) { clicBrutal(c.querySelector(".card-content")); clicBrutal(els.cardModalAction); } },
        () => { const c = piocherDans(els.playerBoard.querySelectorAll(".game-card")); if (c) { clicBrutal(c.querySelector(".card-content")); clicBrutal(els.cardModalAction); } },
        () => { const c = piocherDans(els.enemyBoard.querySelectorAll(".game-card")); if (c) { clicBrutal(c.querySelector(".card-content")); clicBrutal(els.cardModalAction); } },
        () => clicBrutal(document.querySelector("#attack-hero")),
        () => clicBrutal(els.endTurn),
        () => clicBrutal(els.turnHandoffConfirm),
        () => clicBrutal(els.clearLog)
      ];
      piocherDans(cibles)();
      await attendre(alea() < 0.25 ? 400 : 20);

      const etatJeu = jeu();
      const erreurs = debug.validate();
      if (erreurs.length > 0) anomalies.push(`partie ${partie}, pas ${pas} : ${erreurs.join(" / ")}`);
      for (const cote of ["player", "enemy"]) {
        if (etatJeu[cote].life > 30) anomalies.push(`partie ${partie} : ${cote} dépasse 30 PV (${etatJeu[cote].life})`);
        if (etatJeu[cote].board.length > 7) anomalies.push(`partie ${partie} : ${cote} a ${etatJeu[cote].board.length} créatures`);
        if (etatJeu[cote].lands.filter((l) => l.tapped).length > etatJeu[cote].lands.length) {
          anomalies.push(`partie ${partie} : ${cote} engage plus de terrains qu'il n'en possède`);
        }
      }
      if (etatJeu.phase === "over" && etatJeu.winner === null) anomalies.push(`partie ${partie} : partie finie sans vainqueur`);
      if (anomalies.length > 0) break;
    }
    // La partie doit rester jouable : quelques « Fin du tour » propres
    // doivent encore faire avancer le compteur de tours.
    if (jeu().phase !== "over") {
      const tourAvant = jeu().turn;
      for (let i = 0; i < 8 && jeu().turn === tourAvant && jeu().phase !== "over"; i += 1) {
        clic(els.turnHandoffConfirm);
        clic(els.endTurn);
        await attendre(1200);
      }
      if (jeu().turn === tourAvant && jeu().phase !== "over") blocages += 1;
    }
  }

  verifier(anomalies.length === 0, `Le fuzz de ${PARTIES} parties ne produit aucun état impossible`, anomalies.slice(0, 3).join(" | "));
  verifier(blocages === 0, "Aucune partie ne reste bloquée après un flot de clics aléatoires", `${blocages} blocage(s)`);
}

// ======================================================================
// Les quatre effets du lot « resilience » ne sont jamais garantis par une
// main aleatoire : on installe donc l'etat exact que chacun doit traiter,
// puis on lance le sort par le meme chemin que le joueur.
section("Sorts de résilience");
{
  const sortParId = (id) => jeu().spells.find((carte) => carte.id === id);

  // Deux terrains non engages par couleur : le lot contient des sorts blancs,
  // bleus, noirs, rouges et verts, et le deck de test n'en couvre que deux.
  function approvisionner(parCouleur = 2) {
    jeu().player.lands.length = 0;
    for (const couleur of ["Blanc", "Bleu", "Noir", "Rouge", "Vert"]) {
      const source = jeu().lands.find(
        (terrain) => (terrain.manaProduction?.colors || []).length === 1
          && terrain.manaProduction.colors[0] === couleur
      );
      for (let i = 0; i < parCouleur; i += 1) {
        jeu().player.lands.push({ ...source, uid: `terrain-${couleur}-${i}`, tapped: false });
      }
    }
  }

  function mettreEnMain(id) {
    const source = sortParId(id);
    if (!source) return null;
    const uid = `sort-test-${id}`;
    jeu().player.hand.push({ ...source, uid });
    rendre();
    return uid;
  }

  // --- Soin ciblé -----------------------------------------------------
  await lancerPartie("pve");
  approvisionner();
  jeu().player.board.length = 0;
  jeu().player.board.push(
    { ...jeu().cards[0], uid: "blessee", owner: "player", maxLife: 6, currentLife: 1, attack: 2, tapped: false, keywords: [] },
    { ...jeu().cards[0], uid: "intacte", owner: "player", maxLife: 4, currentLife: 4, attack: 2, tapped: false, keywords: [] }
  );
  rendre();
  const uidBulle = mettreEnMain("bulle-revigorante");
  const bulle = jouerParFiche(uidBulle);
  const soignee = jeu().player.board.find((u) => u.uid === "blessee");
  verifier(bulle.active, "Bulle Revigorante est jouable avec du mana de chaque couleur");
  verifier(soignee?.currentLife === 6, "Bulle Revigorante rend toutes ses blessures à la créature la plus amochée", `${soignee?.currentLife}/6`);

  // --- Défenseur + régénération ---------------------------------------
  await lancerPartie("pve");
  approvisionner();
  jeu().player.board.length = 0;
  jeu().player.board.push({
    ...jeu().cards[0], uid: "a-purifier", owner: "player",
    maxLife: 5, currentLife: 2, attack: 3, tapped: false, keywords: ["Célérité"]
  });
  rendre();
  const uidFlamme = mettreEnMain("flamme-purificatrice");
  const flamme = jouerParFiche(uidFlamme);
  const purifiee = jeu().player.board.find((u) => u.uid === "a-purifier");
  verifier(flamme.active, "Flamme Purificatrice est jouable");
  verifier(purifiee?.currentLife === 5, "Flamme Purificatrice régénère entièrement sa cible", `${purifiee?.currentLife}/5`);
  verifier(
    (purifiee?.keywords || []).includes("Défenseur"),
    "Flamme Purificatrice ajoute Défenseur",
    (purifiee?.keywords || []).join(", ")
  );
  verifier(
    (purifiee?.keywords || []).filter((k) => k === "Défenseur").length === 1,
    "Défenseur n'est pas ajouté deux fois"
  );

  // --- Le pendant bleu à 2 manas fait exactement la même chose ---------
  await lancerPartie("pve");
  approvisionner();
  jeu().player.board.length = 0;
  jeu().player.board.push({
    ...jeu().cards[0], uid: "a-venger", owner: "player",
    maxLife: 5, currentLife: 1, attack: 2, tapped: false, keywords: []
  });
  rendre();
  const uidVengeur = mettreEnMain("ultime-vengeur");
  const vengeur = jouerParFiche(uidVengeur);
  const vengee = jeu().player.board.find((u) => u.uid === "a-venger");
  verifier(vengeur.active, "Ultime Vengeur est jouable pour 2 manas bleus");
  verifier(vengee?.currentLife === 5, "Ultime Vengeur régénère entièrement sa cible", `${vengee?.currentLife}/5`);
  verifier((vengee?.keywords || []).includes("Défenseur"), "Ultime Vengeur ajoute Défenseur");

  // --- Régénération noire : soigne tout, coûte 1 PV --------------------
  await lancerPartie("pve");
  approvisionner();
  jeu().player.board.length = 0;
  jeu().player.board.push(
    { ...jeu().cards[0], uid: "r1", owner: "player", maxLife: 4, currentLife: 1, attack: 1, tapped: false, keywords: [] },
    { ...jeu().cards[0], uid: "r2", owner: "player", maxLife: 3, currentLife: 2, attack: 1, tapped: false, keywords: [] }
  );
  const vieAvant = jeu().player.life;
  rendre();
  const uidRegen = mettreEnMain("regeneration-du-mal");
  jouerParFiche(uidRegen);
  const tousSoignes = jeu().player.board.every((u) => u.currentLife === u.maxLife);
  verifier(tousSoignes, "Régénération du mal referme toutes les blessures du camp");
  verifier(jeu().player.life === vieAvant - 1, "Régénération du mal coûte 1 point de vie au commandant", `${vieAvant} -> ${jeu().player.life}`);

  // --- Réanimation aléatoire ------------------------------------------
  await lancerPartie("pve");
  approvisionner();
  jeu().player.board.length = 0;
  jeu().player.graveyard.length = 0;
  const enterres = jeu().cards.slice(0, 3);
  for (const [index, carte] of enterres.entries()) {
    jeu().player.graveyard.push({ ...carte, kind: "creature", uid: `tombe-${index}` });
  }
  rendre();
  const uidSeconde = mettreEnMain("seconde-chance");
  const seconde = jouerParFiche(uidSeconde);
  verifier(seconde.active, "Seconde Chance est jouable quand le cimetière contient une créature");
  // La créature ramenée peut déclencher son effet d'arrivée et créer un jeton :
  // on ne compte donc que les unités issues d'une vraie carte.
  const ramenees = jeu().player.board.filter((u) => !u.token).length;
  verifier(ramenees === 1, "Seconde Chance ramène exactement une créature", `${ramenees}`);
  // Le sort lancé rejoint lui aussi le cimetière : on ne compte que les créatures.
  const creaturesEnterrees = jeu().player.graveyard.filter((e) => e.kind === "creature").length;
  verifier(creaturesEnterrees === 2, "La créature ramenée quitte le cimetière", `${creaturesEnterrees}`);
  verifier(
    jeu().player.board.some((unite) => !unite.token && enterres.some((carte) => carte.id === unite.id)),
    "La créature ramenée vient bien du cimetière"
  );

  // Cimetière vide : le sort ne doit rien casser.
  await lancerPartie("pve");
  approvisionner();
  jeu().player.board.length = 0;
  jeu().player.graveyard.length = 0;
  rendre();
  const uidJamais = mettreEnMain("jamais-abandonner");
  jouerParFiche(uidJamais);
  verifier(jeu().player.board.length === 0, "Jamais abandonner sur cimetière vide ne pose aucune créature");
  verifier(debug.validate().length === 0, "L'état reste valide après un sort de réanimation sans cible", debug.validate().join(" / "));

  // --- Arsenal des Robots antiques -----------------------------------
  await lancerPartie("pve", { playerDeckId: "blanc-bleu" });
  approvisionner();
  jeu().player.board.length = 0;
  jeu().enemy.board.length = 0;
  const compagnon = jeu().cards.find((carte) => carte.id === "robot-antique-petit-compagnon");
  const cible = jeu().cards.find((carte) => carte.id === "robot-antique-gardien");
  jeu().player.board.push({
    ...compagnon,
    uid: "robot-tireur",
    owner: "player",
    maxLife: compagnon.life,
    currentLife: compagnon.life,
    tapped: false
  });
  jeu().enemy.board.push({
    ...cible,
    uid: "cible-tir-antique",
    owner: "enemy",
    maxLife: 8,
    currentLife: 8,
    attack: 6,
    tapped: false
  });
  const vieAdverseAvantTir = jeu().enemy.life;
  rendre();
  const tir = jouerParFiche(mettreEnMain("tir-robot"));
  const cibleApresTir = jeu().enemy.board.find((unite) => unite.uid === "cible-tir-antique");
  verifier(tir.active, "Tir de robot est jouable avec un Robot antique en réseau");
  verifier(cibleApresTir?.currentLife === 5, "Tir de robot inflige 3 blessures à la créature la plus puissante", `${cibleApresTir?.currentLife}/8`);
  verifier(jeu().enemy.life === vieAdverseAvantTir - 1, "Tir de robot inflige aussi 1 blessure au héros adverse");

  await lancerPartie("pve", { playerDeckId: "blanc-bleu" });
  approvisionner();
  jeu().player.board.length = 0;
  jeu().player.board.push({
    ...compagnon,
    uid: "robot-protege",
    owner: "player",
    maxLife: compagnon.life,
    currentLife: compagnon.life,
    keywords: ["Robot antique"],
    tapped: false
  });
  rendre();
  const bouclier = jouerParFiche(mettreEnMain("bouclier-antique"));
  const protege = jeu().player.board.find((unite) => unite.uid === "robot-protege");
  verifier(bouclier.active, "Bouclier antique est jouable sur un Robot antique");
  verifier(protege?.maxLife === compagnon.life + 2 && protege?.currentLife === compagnon.life + 2, "Bouclier antique donne définitivement +0/+2");
  verifier((protege?.keywords || []).includes("Vigilance"), "Bouclier antique ajoute Vigilance");
}

// ======================================================================
// Les jetons doivent avoir LEUR illustration, pas celle du sort qui les
// invoque : deux squelettes affichaient l'image du Largage.
section("Squelettes d'Ulgod");
{
  await lancerPartie("pve");
  jeu().player.lands.length = 0;
  for (let i = 0; i < 4; i += 1) {
    const terrain = jeu().lands.find(
      (t) => (t.manaProduction?.colors || [])[0] === "Rouge" && t.manaProduction.colors.length === 1
    );
    jeu().player.lands.push({ ...terrain, uid: `terrain-largage-${i}`, tapped: false });
  }
  jeu().player.board.length = 0;
  const largage = jeu().spells.find((s) => s.id === "largage-ulgod");
  jeu().player.hand.push({ ...largage, uid: "sort-largage" });
  rendre();
  const lance = jouerParFiche("sort-largage");
  const squelettes = jeu().player.board.filter((u) => u.id === "squelette-ulgod");
  verifier(lance.active, "Largage d'Ulgod est jouable");
  verifier(squelettes.length === 2, "Il crée bien deux Squelettes d'Ulgod", `${squelettes.length}`);
  verifier(
    squelettes.every((u) => u.image === "Images/Squelette.png"),
    "Les squelettes portent leur propre illustration",
    squelettes.map((u) => u.image).join(" / ")
  );
  verifier(
    squelettes.every((u) => u.attack === 1 && u.maxLife === 1),
    "Ils sortent en 1/1",
    squelettes.map((u) => `${u.attack}/${u.maxLife}`).join(" ")
  );
  // Le sort, lui, garde son propre fond.
  verifier(
    largage.image === "Images/Largage d'Ulgod.png",
    "Le sort conserve son illustration d'origine",
    largage.image
  );
}

// ======================================================================
// Impact stellaire relance tant que la piece fait face. On remplace le
// tirage le temps du scenario : sans cela le test dependrait du hasard.
section("Impact stellaire");
{
  const hasardOrigine = Math.random;
  const piper = (suite) => {
    let index = 0;
    Math.random = () => (index < suite.length ? suite[index++] : 0.99);
  };

  async function lancerImpact(suite) {
    await lancerPartie("pve");
    jeu().player.lands.length = 0;
    for (let i = 0; i < 4; i += 1) {
      const terrain = jeu().lands.find(
        (t) => (t.manaProduction?.colors || [])[0] === "Rouge" && t.manaProduction.colors.length === 1
      );
      jeu().player.lands.push({ ...terrain, uid: `terrain-impact-${i}`, tapped: false });
    }
    const cible = jeu().cards[0];
    jeu().enemy.board.length = 0;
    jeu().enemy.board.push(
      { ...cible, uid: "cible-a", owner: "enemy", maxLife: 12, currentLife: 12, attack: 1, tapped: false },
      { ...cible, uid: "cible-b", owner: "enemy", maxLife: 12, currentLife: 12, attack: 1, tapped: false }
    );
    const sort = jeu().spells.find((s) => s.id === "explosion-celeste");
    jeu().player.hand.push({ ...sort, uid: "sort-impact" });
    rendre();
    piper(suite);
    const lance = jouerParFiche("sort-impact");
    Math.random = hasardOrigine;
    return { lance, plateau: jeu().enemy.board };
  }

  // 0.4 = face, 0.9 = pile. Deux faces puis pile -> deux salves de 2.
  const deuxFaces = await lancerImpact([0.4, 0.4, 0.9]);
  verifier(deuxFaces.lance.active, "Explosion céleste est jouable");
  verifier(
    deuxFaces.plateau.every((u) => u.currentLife === 8),
    "Deux faces infligent 4 blessures à TOUTES les créatures adverses",
    deuxFaces.plateau.map((u) => u.currentLife).join(" / ")
  );

  // Pile du premier coup : aucune blessure.
  const pileDirect = await lancerImpact([0.9]);
  verifier(
    pileDirect.plateau.every((u) => u.currentLife === 12),
    "Un pile immédiat ne fait aucune blessure",
    pileDirect.plateau.map((u) => u.currentLife).join(" / ")
  );
  verifier(debug.validate().length === 0, "L'état reste valide après l'impact", debug.validate().join(" / "));
  Math.random = hasardOrigine;
}

// ======================================================================
// Auto-reparation ne remet en etat QUE les Robots antiques : une creature
// de chair blessee a cote doit rester blessee.
section("Auto-réparation");
{
  await lancerPartie("pve");
  jeu().player.lands.length = 0;
  for (let i = 0; i < 4; i += 1) {
    const terrain = jeu().lands.find((t) => (t.manaProduction?.colors || []).length === 1);
    jeu().player.lands.push({ ...terrain, uid: `terrain-repar-${i}`, tapped: false });
  }
  const robot = jeu().cards.find((c) => (c.keywords || []).includes("Robot antique"));
  const chair = jeu().cards.find((c) => !(c.keywords || []).includes("Robot antique"));
  jeu().player.board.length = 0;
  jeu().player.board.push(
    { ...robot, uid: "robot-abime", owner: "player", maxLife: 6, currentLife: 2, attack: 2, tapped: false },
    { ...chair, uid: "chair-blessee", owner: "player", maxLife: 5, currentLife: 1, attack: 2, tapped: false }
  );
  const sortSource = jeu().spells.find((s) => s.id === "auto-reparation");
  jeu().player.hand.push({ ...sortSource, uid: "sort-reparation" });
  rendre();
  const lance = jouerParFiche("sort-reparation");
  const machine = jeu().player.board.find((u) => u.uid === "robot-abime");
  const vivant = jeu().player.board.find((u) => u.uid === "chair-blessee");
  verifier(lance.active, "Auto-réparation est jouable pour 2 manas");
  verifier(machine?.currentLife === 6, "Le Robot antique retrouve tous ses points de vie", `${machine?.currentLife}/6`);
  verifier(vivant?.currentLife === 1, "La créature de chair n'est PAS soignée", `${vivant?.currentLife}/5`);
  verifier(debug.validate().length === 0, "L'état reste valide après la réparation", debug.validate().join(" / "));
}

// ======================================================================
// La ruche doit faire eclore la VRAIE carte Parasite Larve, pas un jeton
// recopie a la main : c'est ce qui lui donne son illustration et son
// numero de collection.
section("Éclosion de la ruche");
{
  const carteParId = (id) => jeu().cards.find((carte) => carte.id === id);

  await lancerPartie("pve");
  jeu().player.board.length = 0;
  jeu().player.board.push({
    ...carteParId("zombie-parasite"), uid: "zombie-mourant", owner: "player",
    maxLife: 2, currentLife: 0, attack: 2, tapped: false
  });
  // Le ramassage des morts suit une action, pas la fin du tour : on lance
  // un sort sans effet sur notre camp pour la déclencher.
  jeu().player.lands.length = 0;
  for (const couleur of ["Blanc", "Blanc", "Blanc"]) {
    const source = jeu().lands.find(
      (t) => (t.manaProduction?.colors || []).length === 1 && t.manaProduction.colors[0] === couleur
    );
    jeu().player.lands.push({ ...source, uid: `terrain-ruche-${jeu().player.lands.length}`, tapped: false });
  }
  jeu().player.hand.push({ ...jeu().spells.find((s) => s.id === "intervention-aldia"), uid: "sort-declencheur" });
  rendre();
  jouerParFiche("sort-declencheur");
  await attendre(120);
  const eclose = jeu().player.board.find((u) => u.id === "parasite-larve");
  verifier(Boolean(eclose), "Le Zombie parasité fait éclore une Parasite Larve à sa mort");
  verifier(eclose?.name === "Parasite Larve", "La créature éclose porte le nom de la carte", eclose?.name);
  verifier(
    eclose?.image === carteParId("parasite-larve")?.image,
    "Elle porte l'illustration de la carte Parasite Larve",
    eclose?.image
  );
  verifier(eclose?.attack === 1 && eclose?.maxLife === 1, "Elle sort en 1/1", `${eclose?.attack}/${eclose?.maxLife}`);

  // La Reine en pond deux, de la meme carte.
  await lancerPartie("pve");
  jeu().player.board.length = 0;
  jeu().player.hand.push({ ...carteParId("reine-parasite"), uid: "reine-test" });
  jeu().player.lands.length = 0;
  for (let i = 0; i < 8; i += 1) {
    const source = jeu().lands.find((t) => (t.manaProduction?.colors || [])[0] === "Vert");
    jeu().player.lands.push({ ...source, uid: `terrain-reine-${i}`, tapped: false });
  }
  rendre();
  const reine = jouerParFiche("reine-test");
  const larves = jeu().player.board.filter((u) => u.id === "parasite-larve");
  verifier(reine.active, "La Reine Parasite est jouable avec 8 terrains verts");
  verifier(larves.length === 2, "La Reine Parasite fait éclore deux Parasite Larve", `${larves.length}`);
  verifier(debug.validate().length === 0, "L'état reste valide après l'éclosion", debug.validate().join(" / "));
}

// ======================================================================
section("Mode local à deux joueurs");
{
  await lancerPartie("pvp");
  verifier(jeu().mode === "pvp", "Le mode local démarre");
  verifier(jeu().currentTurn === "player", "Joueur 1 commence");
  clic(els.endTurn);
  await attendre(120);
  verifier(jeu().handoffPending === true, "Le passage d'écran est demandé entre les deux joueurs");
  verifier(jeu().currentTurn === "enemy", "Le tour appartient à Joueur 2");
  const carte = jeu().enemy.hand.find((c) => c.kind === "land");
  const bloquee = carte ? carteDeMain(carte.uid) : null;
  verifier(bloquee === null, "La main reste masquée tant que l'écran n'est pas passé");
  clic(els.turnHandoffConfirm);
  await attendre(80);
  verifier(jeu().handoffPending === false, "La confirmation rend la main à Joueur 2");
  verifier(els.hand.querySelectorAll(".game-card").length === jeu().enemy.hand.length, "La main de Joueur 2 s'affiche après confirmation");
}

// ======================================================================
section("Erreurs console");
verifier(erreursConsole.length === 0, "Aucune erreur console sur l'ensemble des scénarios", erreursConsole.slice(0, 3).join(" | "));

// ======================================================================
console.log(`\n${resultats.reussis}/${resultats.total} vérifications passent.`);
if (resultats.echecs.length > 0) {
  console.log("\nÉchecs :");
  for (const echec of resultats.echecs) console.log(`  - ${echec}`);
  process.exitCode = 1;
} else {
  console.log("\n=> TOUS LES TESTS DE COMPORTEMENT PASSENT");
}
process.exit(resultats.echecs.length > 0 ? 1 : 0);
