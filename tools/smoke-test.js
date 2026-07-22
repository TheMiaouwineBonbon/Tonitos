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
  check("index.html contient Tonitos", html.includes("Tonitos"));
  check(
    "index.html référence les cinq zones des tapis",
    ["mat-side", "mat-zone--library", "mat-zone--graveyard", "mat-zone--field", "mat-zone--exile", "mat-zone--commander"]
      .every((className) => html.includes(className))
  );

  res = await fetch(`${base}/game.js`);
  const gameSource = await res.text();
  check("GET /game.js -> 200", res.status === 200);
  check("Identité réseau propre à chaque onglet", gameSource.includes('sessionStorage.getItem("tonitos-player-id")'));
  check("Secours WebRTC pour GitHub Pages", gameSource.includes("joinPeerRoom") && gameSource.includes("peerjs@1.5.5"));

  res = await fetch(`${base}/data/cards.json`);
  const cards = await res.json();
  check("cards.json = 30 créatures", Array.isArray(cards) && cards.length === 30);
  check("Golem de pierre = Vert", cards.find((c) => c.id === "golem-pierre")?.family === "Vert");
  check("Amrin = Rouge", cards.find((c) => c.id === "amrin")?.family === "Rouge");
  check("Roi des mers = Bleu", cards.find((c) => c.id === "roi-des-mers")?.family === "Bleu");
  check("Magicien exilé = Noir", cards.find((c) => c.id === "magiciens-exiles")?.family === "Noir");
  check("Fée = Vert", cards.find((c) => c.id === "fee")?.family === "Vert");
  check("Valerius = Noir", cards.find((c) => c.id === "valerius")?.family === "Noir");

  res = await fetch(`${base}/data/spells.json`);
  const spells = await res.json();
  const byColor = spells.reduce((acc, s) => ((acc[s.family] = (acc[s.family] || 0) + 1), acc), {});
  check("Au moins 4 sorts par couleur (hors incolore)", ["Blanc", "Bleu", "Noir", "Rouge", "Vert"].every((c) => byColor[c] >= 4));
  check("Bénédiction du Héros = Blanc", spells.find((s) => s.id === "benediction-du-heros")?.family === "Blanc");
  check("Vengeance d'Uldrid = Vert", spells.find((s) => s.id === "vengeance-uldrid")?.family === "Vert");

  res = await fetch(`${base}/data/lands.json`);
  const lands = await res.json();
  const allCards = [...cards, ...lands, ...spells];
  check("Toutes les illustrations existent", allCards.every((card) => fs.existsSync(path.join(__dirname, "..", card.image))));

  const deckColors = [
    ["Blanc", "Vert"],
    ["Rouge", "Noir"],
    ["Bleu", "Vert"],
    ["Noir", "Blanc"],
    ["Rouge", "Bleu"]
  ];
  check("Les 5 decks peuvent fournir 22 créatures et 14 sorts avec 4 copies max", deckColors.every((colors) => {
    const creaturePool = cards.filter((card) => colors.includes(card.family));
    const spellPool = spells.filter((card) => colors.includes(card.family) || card.family === "Incolore");
    return creaturePool.length * 4 >= 22 && spellPool.length * 4 >= 14;
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

  res = await fetch(`${base}/api/room/state`, json({ code: "1234", playerId: p1.playerId, state: { started: true, turn: 1, marker: "sync-ok" } }));
  const pub = await res.json();
  check("Publication de l'état -> version 1", res.status === 200 && pub.version === 1);

  res = await fetch(`${base}/api/room/state?code=1234&playerId=${encodeURIComponent(p2.playerId)}`);
  const st2 = await res.json();
  check("Le joueur 2 reçoit l'état synchronisé", st2.room.state?.marker === "sync-ok" && st2.room.version === 1);

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
