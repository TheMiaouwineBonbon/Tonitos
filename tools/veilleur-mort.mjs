// =====================================================================
// Spellaho - Veilleur : detecte les fenetres ou un heros est mort sans
// que la partie s'arrete.
// ---------------------------------------------------------------------
// `checkVictory()` n'est appele qu'a des endroits precis. Rien, dans le
// moteur, n'empeche l'etat « PV <= 0 et partie en cours » d'exister ni de
// durer. Ce veilleur joue de vraies parties, surveille chaque ecriture de
// PV, et signale :
//   - toute fenetre ou un camp est a <= 0 PV alors que la phase n'est pas
//     terminee, une fois la pile d'appels revenue a la boucle d'evenements ;
//   - toute HAUSSE de PV survenant alors que le camp etait deja mort.
//
//   node .\tools\veilleur-mort.mjs [repetitions]
// =====================================================================
import { installerDom, attendre, horloge } from "./dom-stub.mjs";

installerDom({ timeScale: 0.02, instantAnimation: true });
await import("../game.js");
await attendre(200);

const { validateGameState } = await import("../engine-core.mjs");
const debug = globalThis.SpellahoDebug;
const jeu = () => debug.state;
const q = (s) => document.querySelector(s);
const els = {
  startGame: q("#start-game"), modeSelect: q("#mode-select"),
  playerDeck: q("#player-deck-select"), enemyDeck: q("#enemy-deck-select"),
  endTurn: q("#end-turn"), hand: q("#player-hand"), playerBoard: q("#player-board"),
  enemyBoard: q("#enemy-board"), cardModalAction: q("#card-modal-action")
};
const clic = (n) => (n && !n.disabled ? n.dispatchEvent({ type: "click" }) : false);
const REPETITIONS = Number(process.argv[2] || 3);

async function attendreQue(p, ms = 8000) {
  const d = Date.now();
  while (!p()) { if (Date.now() - d > ms * horloge.timeScale + 3000) return false; await attendre(40); }
  return true;
}

function pile() {
  return new Error().stack.split("\n").slice(3)
    .map((l) => l.trim().replace(/^at\s+/, ""))
    .map((l) => l.replace(/file:\/\/\/.*?([A-Za-z0-9_.-]+\.m?js):(\d+):\d+\)?$/, "$1:$2").replace(/\s*\(.*\)$/, ""))
    .filter((l) => l && !/^Object\.set|^node:|^async Promise/.test(l))
    .slice(0, 5).join(" < ");
}

const anomalies = [];
let contexteCourant = "";

function surveiller(cote, nom) {
  let valeur = cote.life;
  Object.defineProperty(cote, "life", {
    configurable: true, enumerable: true,
    get: () => valeur,
    set(nouvelle) {
      const etaitMort = valeur <= 0;
      if (etaitMort && nouvelle > valeur) {
        anomalies.push({
          type: "RESURRECTION",
          camp: nom, avant: valeur, apres: nouvelle,
          phase: jeu().phase, tour: jeu().turn, contexte: contexteCourant, pile: pile()
        });
      }
      if (!etaitMort && nouvelle <= 0) {
        // Mort constatee : on note l'instant, la verification differee dira
        // si le moteur a bien verrouille la partie.
        derniereMort = { camp: nom, valeur: nouvelle, phase: jeu().phase, tour: jeu().turn, pile: pile() };
      }
      valeur = nouvelle;
    }
  });
}
let derniereMort = null;

// Une fois la pile revenue a la boucle d'evenements, un camp a <= 0 PV
// alors que la partie continue est une anomalie. On interroge en meme temps
// l'invariant du moteur, qui pose la meme regle cote engine-core.
function controlerVerrou(quand) {
  const e = jeu();
  for (const [nom, cote] of [["player", e.player], ["enemy", e.enemy]]) {
    if (cote.life <= 0 && e.phase !== "over") {
      anomalies.push({
        type: "MORT NON VERROUILLEE",
        camp: nom, avant: cote.life, apres: cote.life,
        phase: e.phase, tour: e.turn, contexte: `${contexteCourant} / ${quand}`,
        pile: derniereMort?.pile || "(mort survenue hors instrumentation)"
      });
    }
  }
  const erreurs = validateGameState(e);
  if (erreurs.length > 0) {
    anomalies.push({
      type: "INVARIANT MOTEUR VIOLE",
      camp: "-", avant: e.player.life, apres: e.enemy.life,
      phase: e.phase, tour: e.turn, contexte: `${contexteCourant} / ${quand}`,
      pile: erreurs.join(" | ")
    });
  }
}

function jouerTout(limite = 14) {
  for (let i = 0; i < limite; i += 1) {
    const main = [...jeu().player.hand];
    const jouable = main.find((c) => els.hand.querySelector(`.game-card[data-uid="${c.uid}"]`)?.classList.contains("is-playable"));
    if (!jouable) break;
    const avant = jeu().player.hand.length;
    const n = els.hand.querySelector(`.game-card[data-uid="${jouable.uid}"]`);
    clic(n.querySelector(".card-content"));
    if (!els.cardModalAction.disabled) clic(els.cardModalAction);
    controlerVerrou("apres avoir joue une carte");
    if (jeu().player.hand.length === avant) break;
  }
}

async function attaquerTout() {
  for (let i = 0; i < 8; i += 1) {
    if (jeu().phase === "over") return;
    const att = jeu().player.board.find((u) => !u.hasAttacked && !u.tapped);
    if (!att) break;
    const n = els.playerBoard.querySelector(`.game-card[data-uid="${att.uid}"]`);
    if (!n) break;
    clic(n.querySelector(".card-content"));
    if (els.cardModalAction.disabled) break;
    clic(els.cardModalAction);
    await attendre(50);
    const cible = jeu().enemy.board[0];
    const cn = cible && els.enemyBoard.querySelector(`.game-card[data-uid="${cible.uid}"]`);
    if (cn) { clic(cn.querySelector(".card-content")); if (!els.cardModalAction.disabled) clic(els.cardModalAction); }
    await attendre(50);
    controlerVerrou("apres une attaque");
  }
}

const DECKS = ["blanc-vert", "rouge-noir", "bleu-vert", "noir-blanc", "rouge-bleu", "blanc-bleu"];
let parties = 0;
let terminees = 0;

for (let rep = 0; rep < REPETITIONS; rep += 1) {
  for (const dj of DECKS) {
    for (const de of DECKS) {
      if (dj === de) continue;
      contexteCourant = `${dj} contre ${de} (essai ${rep + 1})`;
      els.modeSelect.value = "pve";
      els.playerDeck.value = dj;
      els.enemyDeck.value = de;
      clic(els.startGame);
      await attendre(120);
      surveiller(jeu().player, "player");
      surveiller(jeu().enemy, "enemy");
      derniereMort = null;
      parties += 1;

      let tours = 0;
      while (jeu().phase !== "over" && tours < 30) {
        jouerTout();
        await attaquerTout();
        if (jeu().phase === "over") break;
        clic(els.endTurn);
        await attendreQue(() => jeu().currentTurn === "player" || jeu().phase === "over");
        await attendre(50);
        controlerVerrou("au debut du tour du joueur");
        tours += 1;
      }
      if (jeu().phase === "over") terminees += 1;
      controlerVerrou("en fin de partie");
    }
  }
  console.log(`  essai ${rep + 1} : ${parties} parties jouees, ${terminees} terminees, ${anomalies.length} anomalie(s)`);
}

console.log(`\n########## ${parties} parties, ${terminees} terminees ##########`);
if (anomalies.length === 0) {
  console.log("Aucune anomalie : aucun camp n'a survecu a 0 PV, aucune resurrection.");
} else {
  console.log(`${anomalies.length} ANOMALIE(S) :\n`);
  const parType = new Map();
  for (const a of anomalies) {
    const cle = `${a.type} | ${a.pile}`;
    const v = parType.get(cle) || { n: 0, exemple: a };
    v.n += 1; parType.set(cle, v);
  }
  for (const [cle, v] of [...parType].sort((x, y) => y[1].n - x[1].n)) {
    const a = v.exemple;
    console.log(`  ${v.n}x  ${a.type}`);
    console.log(`      LIFE ${a.camp}: ${a.avant} → ${a.apres} | phase=${a.phase} tour=${a.tour}`);
    console.log(`      contexte= ${a.contexte}`);
    console.log(`      stack= ${a.pile}\n`);
  }
}
process.exit(anomalies.length > 0 ? 1 : 0);
