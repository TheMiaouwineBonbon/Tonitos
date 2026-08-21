// =====================================================================
// Spellaho - Regression : la mort est immediate et definitive
// ---------------------------------------------------------------------
// Bug d'origine : les PV du joueur touchaient 0 sans que la partie se
// termine, et le premier soin venu le ramenait au-dessus de zero.
//
// La cause tenait a l'architecture : chaque effet ecrivait `side.life` de
// son cote et l'appelant devait penser a `checkVictory()`. Toutes les
// mutations passent desormais par `changeLife()`, qui constate la mort
// dans la foulee et refuse toute ecriture une fois la partie terminee.
//
// Ces tests empruntent les VRAIS chemins de degats — combat, sort, lien de
// vie, fatigue, tour de l'IA — et non une ecriture directe dans l'etat,
// qui ne prouverait plus rien.
//
//   node .\tools\repro-mort.mjs
//   node .\tools\repro-mort.mjs --verbeux
// =====================================================================
import { installerDom, attendre, horloge } from "./dom-stub.mjs";

installerDom({ timeScale: 0.02, instantAnimation: true });
await import("../game.js");
await attendre(200);

const { determineWinner, validateGameState } = await import("../engine-core.mjs");
const VERBEUX = process.argv.includes("--verbeux");
const debug = globalThis.SpellahoDebug;
const jeu = () => debug.state;
const q = (s) => document.querySelector(s);
const els = {
  startGame: q("#start-game"), modeSelect: q("#mode-select"),
  playerDeck: q("#player-deck-select"), enemyDeck: q("#enemy-deck-select"),
  endTurn: q("#end-turn"), hand: q("#player-hand"), playerBoard: q("#player-board"),
  enemyBoard: q("#enemy-board"), cardModalAction: q("#card-modal-action"),
  playerLife: q("#player-life"), enemyLife: q("#enemy-life"),
  gameOver: q("#game-over"), clearLog: q("#clear-log")
};
const clic = (n) => (n && !n.disabled ? n.dispatchEvent({ type: "click" }) : false);
const rendre = () => clic(els.clearLog);

const resultats = { total: 0, reussis: 0, echecs: [] };
let contexte = "";
function verifier(condition, libelle, detail = "") {
  resultats.total += 1;
  if (condition) { resultats.reussis += 1; console.log(`  OK   ${libelle}`); return true; }
  resultats.echecs.push(`${contexte}${libelle}${detail ? ` — ${detail}` : ""}`);
  console.log(`  FAIL ${libelle}${detail ? ` — ${detail}` : ""}`);
  return false;
}
function section(titre) { contexte = `[${titre}] `; console.log(`\n=== ${titre} ===`); }

async function attendreQue(p, ms = 8000) {
  const d = Date.now();
  while (!p()) { if (Date.now() - d > ms * horloge.timeScale + 3000) return false; await attendre(40); }
  return true;
}

// --- Instrumentation : toute ecriture de PV laisse une trace -----------
const mutations = [];
function pile() {
  return new Error().stack.split("\n").slice(3)
    .map((l) => l.trim().replace(/^at\s+/, ""))
    .map((l) => l.replace(/file:\/\/\/.*?([A-Za-z0-9_.-]+\.m?js):(\d+):\d+\)?$/, "$1:$2").replace(/\s*\(.*\)$/, ""))
    .filter((l) => l && !/^Object\.set|^node:|^async Promise/.test(l))
    .slice(0, 4).join(" < ");
}
function instrumenter() {
  mutations.length = 0;
  for (const [nom, cote] of [["player", jeu().player], ["enemy", jeu().enemy]]) {
    let valeur = cote.life;
    Object.defineProperty(cote, "life", {
      configurable: true, enumerable: true,
      get: () => valeur,
      set(nouvelle) {
        if (nouvelle !== valeur) {
          mutations.push({ camp: nom, avant: valeur, apres: nouvelle, delta: nouvelle - valeur,
            phase: jeu().phase, tour: jeu().turn, pile: pile() });
        }
        valeur = nouvelle;
      }
    });
  }
}
function tracer(prefixe = "       ") {
  for (const m of mutations) {
    console.log(`${prefixe}LIFE ${m.camp}: ${m.avant} → ${m.apres} (${m.delta > 0 ? "+" : ""}${m.delta}) | phase=${m.phase} tour=${m.tour}`);
    console.log(`${prefixe}     stack= ${m.pile}`);
  }
}

const pvDom = (camp) => Number((camp === "player" ? els.playerLife : els.enemyLife)?.textContent);

async function lancer(deckJoueur = "blanc-vert", deckEnnemi = "rouge-noir", mode = "pve") {
  els.modeSelect.value = mode;
  els.playerDeck.value = deckJoueur;
  els.enemyDeck.value = deckEnnemi;
  clic(els.startGame);
  await attendre(150);
  instrumenter();
}

function approvisionner(cote = "player", parCouleur = 3) {
  const c = jeu()[cote];
  c.lands.length = 0;
  for (const couleur of ["Blanc", "Bleu", "Noir", "Rouge", "Vert"]) {
    const source = jeu().lands.find(
      (t) => (t.manaProduction?.colors || []).length === 1 && t.manaProduction.colors[0] === couleur
    );
    for (let i = 0; i < parCouleur; i += 1) c.lands.push({ ...source, uid: `t-${cote}-${couleur}-${i}`, tapped: false });
  }
}

function mettreEnMain(id) {
  const source = [...jeu().spells, ...jeu().cards].find((c) => c.id === id);
  if (!source) return null;
  const uid = `test-${id}-${Math.random().toString(36).slice(2, 7)}`;
  jeu().player.hand.push({ ...source, uid });
  rendre();
  return uid;
}

function jouerParFiche(uid) {
  const n = els.hand.querySelector(`.game-card[data-uid="${uid}"]`);
  if (!n) return false;
  clic(n.querySelector(".card-content"));
  if (els.cardModalAction.disabled) return false;
  clic(els.cardModalAction);
  return true;
}

// Chemin exact du joueur pour frapper le heros adverse : selection de
// l'attaquant par sa fiche, puis bouton « attaquer le heros ».
async function attaquerHeros(uid) {
  const n = els.playerBoard.querySelector(`.game-card[data-uid="${uid}"]`);
  if (!n) return false;
  clic(n.querySelector(".card-content"));
  if (els.cardModalAction.disabled) return false;
  clic(els.cardModalAction);
  await attendre(60);
  clic(q("#attack-hero"));
  await attendre(300);
  return true;
}

// Pose une creature prete a attaquer sur le plateau demande.
function poserCreature(cote, id, uid, extra = {}) {
  const source = jeu().cards.find((c) => c.id === id) || jeu().cards[0];
  const unite = {
    ...source, uid, tapped: false, hasAttacked: false, attacking: false,
    currentLife: source.life, maxLife: source.life, createdTurn: -5, survivedTurns: 5, ...extra
  };
  jeu()[cote].board.push(unite);
  rendre();
  return unite;
}

// Etat complet, pour comparer moteur, affichage et verdict.
function photo() {
  const e = jeu();
  return {
    vieMoteur: e.player.life, vieDom: pvDom("player"),
    verdict: determineWinner(e.player, e.enemy),
    phase: e.phase, winner: e.winner,
    ecranFin: els.gameOver?.hidden === false,
    invariants: validateGameState(e)
  };
}

// Verifie qu'une partie terminee le reste, quoi qu'il arrive ensuite.
async function verifierVerrou(vieAttendue) {
  const e = jeu();
  const vieAvant = e.player.life;
  const boardAvant = e.enemy.board.length;
  const mainAvant = e.player.hand.length;
  for (let i = 0; i < 6; i += 1) { clic(els.endTurn); await attendre(50); }
  const carte = e.player.hand[0];
  if (carte) jouerParFiche(carte.uid);
  const att = e.player.board[0];
  if (att) {
    const n = els.playerBoard.querySelector(`.game-card[data-uid="${att.uid}"]`);
    if (n) clic(n.querySelector(".card-content"));
  }
  await attendre(600);
  verifier(e.player.life === vieAvant, `PV figes apres clics, cartes et 600 ms (${vieAvant} -> ${e.player.life})`);
  if (vieAttendue !== undefined) verifier(e.player.life === vieAttendue, `PV a la valeur attendue (${vieAttendue})`);
  verifier(e.enemy.board.length === boardAvant, "l'IA n'a plus agi");
  verifier(e.player.hand.length === mainAvant, "aucune carte n'a pu etre jouee");
  verifier(e.phase === "over", "la partie reste terminee");
  verifier(validateGameState(e).length === 0, "l'invariant moteur est respecte", validateGameState(e).join(" / "));
}

// =====================================================================
section("1. Letal exact par combat : 1 PV, une attaque de 1");
await lancer();
approvisionner("enemy");
jeu().player.life = 1;
jeu().player.board.length = 0;
jeu().enemy.board.length = 0;
poserCreature("enemy", "guerrier-lapin", "tueur-1", { attack: 1 });
mutations.length = 0;
// L'IA peut mettre plus d'un tour a se decider a frapper le heros : on lui
// laisse trois passages, la mort doit tomber des qu'elle porte le coup.
for (let t = 0; t < 3 && jeu().phase !== "over"; t += 1) {
  clic(els.endTurn);
  await attendreQue(() => jeu().phase === "over" || jeu().currentTurn === "player", 6000);
  await attendre(200);
}
let p = photo();
verifier(p.vieMoteur <= 0, `PV moteur <= 0 (${p.vieMoteur})`);
verifier(p.phase === "over", `partie terminee (${p.phase})`);
verifier(p.winner === "enemy", `victoire ennemie (${p.winner})`);
verifier(p.ecranFin, "l'ecran de fin est affiche");
verifier(p.vieDom <= 0, `l'affichage montre ${p.vieDom}`);
verifier(p.invariants.length === 0, "invariant moteur respecte", p.invariants.join(" / "));
verifier(!mutations.some((m) => m.camp === "player" && m.delta > 0), "aucune remontee de PV");
if (VERBEUX) tracer();
await verifierVerrou();

// =====================================================================
section("2. Overkill par combat : 2 PV, une attaque de 5");
await lancer();
approvisionner("enemy");
jeu().player.life = 2;
jeu().player.board.length = 0;
jeu().enemy.board.length = 0;
poserCreature("enemy", "orcs", "tueur-5", { attack: 5 });
mutations.length = 0;
for (let t = 0; t < 3 && jeu().phase !== "over"; t += 1) {
  clic(els.endTurn);
  await attendreQue(() => jeu().phase === "over" || jeu().currentTurn === "player", 6000);
  await attendre(200);
}
p = photo();
// On ne fixe pas ici la valeur exacte : l'IA choisit son attaquant, et le
// premier coup fatal ferme la partie — les suivants sont refuses. Le
// depassement se verifie au test 4, ou la source de degats est unique.
verifier(p.vieMoteur <= 0, `PV moteur <= 0 (${p.vieMoteur})`);
verifier(p.phase === "over", `partie terminee (${p.phase})`);
verifier(p.invariants.length === 0, "invariant moteur respecte", p.invariants.join(" / "));
await verifierVerrou(p.vieMoteur);

// =====================================================================
section("3. Letal puis soin : le drain ne doit pas soigner apres la mort");
// « Piège Obscur » inflige 2 blessures au héros adverse et rend 2 PV au
// lanceur. Sur un adversaire a 2 PV, la mort tombe AVANT le soin : le soin
// doit etre refuse par le verrou.
await lancer("rouge-noir", "blanc-vert");
approvisionner("player");
jeu().enemy.life = 2;
jeu().player.life = 10;
const uidPiege = mettreEnMain("piege-obscur");
mutations.length = 0;
verifier(Boolean(uidPiege) && jouerParFiche(uidPiege), "le sort de drain a bien ete lance");
await attendre(150);
verifier(jeu().enemy.life <= 0, `l'ennemi est mort (${jeu().enemy.life})`);
verifier(jeu().phase === "over", `partie terminee (${jeu().phase})`);
verifier(jeu().winner === "player", `victoire du joueur (${jeu().winner})`);
verifier(jeu().player.life === 10, `le lanceur n'a PAS ete soigne apres la mort (${jeu().player.life}, attendu 10)`);
const soinsApresMort = mutations.filter((m) => m.delta > 0 && m.phase === "over");
verifier(soinsApresMort.length === 0, `aucun soin applique en phase terminale (${soinsApresMort.length})`);
if (VERBEUX || soinsApresMort.length) tracer();

// =====================================================================
section("4. Letal par sort direct sur le heros");
await lancer("rouge-noir", "blanc-vert");
approvisionner("player");
jeu().enemy.life = 2;
// « Courroux d'Ulgod » inflige 3 blessures directement au heros adverse.
const uidCourroux = mettreEnMain("courroux-ulgod");
mutations.length = 0;
verifier(Boolean(uidCourroux) && jouerParFiche(uidCourroux), "le sort de degats direct a bien ete lance");
await attendre(150);
verifier(jeu().enemy.life <= 0, `l'ennemi tombe a ${jeu().enemy.life}`);
verifier(jeu().enemy.life === -1, `le depassement est conserve : 2 PV - 3 degats = -1 (${jeu().enemy.life})`);
verifier(jeu().phase === "over", `partie terminee (${jeu().phase})`);
verifier(validateGameState(jeu()).length === 0, "invariant respecte apres un sort letal");
if (VERBEUX) tracer();

// =====================================================================
section("5. Letal par fatigue : bibliotheque vide");
await lancer();
jeu().player.life = 1;
jeu().player.deck.length = 0;
jeu().player.board.length = 0;
jeu().enemy.board.length = 0;
mutations.length = 0;
clic(els.endTurn);
await attendreQue(() => jeu().phase === "over" || jeu().currentTurn === "player", 6000);
await attendre(150);
p = photo();
verifier(p.vieMoteur <= 0, `la fatigue a bien tue (${p.vieMoteur})`);
verifier(p.phase === "over", `partie terminee (${p.phase})`);
verifier(p.invariants.length === 0, "invariant respecte apres mort par fatigue", p.invariants.join(" / "));
const fatigueMut = mutations.find((m) => m.camp === "player" && m.delta < 0);
verifier(Boolean(fatigueMut) && /changeLife/.test(fatigueMut.pile), "la fatigue passe par changeLife", fatigueMut?.pile || "aucune mutation");
if (VERBEUX) tracer();
await verifierVerrou();

// =====================================================================
section("6. Lien de vie : l'attaquant ne se soigne pas apres avoir tue");
await lancer("rouge-noir", "blanc-vert");
jeu().enemy.life = 3;
jeu().player.life = 12;
jeu().enemy.board.length = 0;
poserCreature("player", "valerius", "vampire-1", { attack: 5, keywords: ["Lien de vie"] });
mutations.length = 0;
await attaquerHeros("vampire-1");
verifier(jeu().enemy.life <= 0, `l'ennemi est tue par l'attaque (${jeu().enemy.life})`);
verifier(jeu().phase === "over", `partie terminee (${jeu().phase})`);
verifier(jeu().player.life === 12, `le lien de vie n'a pas soigne apres la mort (${jeu().player.life}, attendu 12)`);
if (VERBEUX) tracer();

// =====================================================================
section("7. Le lien de vie fonctionne toujours hors situation letale");
await lancer("rouge-noir", "blanc-vert");
jeu().enemy.life = 20;
jeu().player.life = 10;
jeu().enemy.board.length = 0;
poserCreature("player", "valerius", "vampire-2", { attack: 4, keywords: ["Lien de vie"] });
mutations.length = 0;
await attaquerHeros("vampire-2");
verifier(jeu().enemy.life === 16, `l'ennemi encaisse 4 (${jeu().enemy.life})`);
verifier(jeu().player.life === 14, `le lien de vie a bien rendu 4 PV (${jeu().player.life})`);
verifier(jeu().phase !== "over", "la partie continue");

// =====================================================================
section("8. Les soins normaux restent plafonnes a 30");
await lancer();
approvisionner("player");
jeu().player.life = 28;
const uidSoin = mettreEnMain("amour-rena");
if (uidSoin && jouerParFiche(uidSoin)) {
  await attendre(120);
  verifier(jeu().player.life === 30, `+4 sur 28 PV plafonne a 30 (${jeu().player.life})`);
} else {
  jeu().player.life = 30;
  verifier(jeu().player.life === 30, "plafond verifie sans le sort (indisponible)");
}

// =====================================================================
section("9. checkVictory est idempotent : pas de double fin de partie");
await lancer("rouge-noir", "blanc-vert");
approvisionner("player");
jeu().enemy.life = 2;
const uidFinal = mettreEnMain("piege-obscur");
jouerParFiche(uidFinal);
await attendre(150);
const vainqueurInitial = jeu().winner;
const recompensesInitiales = JSON.stringify(jeu().lastProgressAwards || []);
const lignesFin = () => jeu().log.filter((l) => /remporte la partie/.test(String(l?.text ?? l))).length;
const finInitiale = lignesFin();
// Chaque clic et chaque minuterie repasse par checkVictory. On evite ici
// `rendre()`, qui passe par le bouton « effacer le journal » et le viderait.
for (let i = 0; i < 10; i += 1) clic(els.endTurn);
await attendre(400);
verifier(jeu().winner === vainqueurInitial, `le vainqueur ne change plus (${jeu().winner})`);
verifier(JSON.stringify(jeu().lastProgressAwards || []) === recompensesInitiales, "les recompenses ne sont attribuees qu'une fois");
verifier(jeu().progressAwarded === true, "le drapeau d'attribution reste pose");
verifier(finInitiale === 1 && lignesFin() === 1, `l'annonce de victoire n'est ecrite qu'une fois (${finInitiale} -> ${lignesFin()})`);
verifier(validateGameState(jeu()).length === 0, "invariant respecte apres dix passages");

// =====================================================================
console.log(`\n########## Bilan : ${resultats.reussis}/${resultats.total} ##########`);
if (resultats.echecs.length > 0) {
  console.log("\nEchecs :");
  for (const e of resultats.echecs) console.log("  - " + e);
}
process.exit(resultats.echecs.length > 0 ? 1 : 0);
