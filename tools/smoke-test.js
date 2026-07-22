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

  res = await fetch(`${base}/game.js`);
  const gameSource = await res.text();
  check("GET /game.js -> 200", res.status === 200);
  check("Identité réseau Spellaho propre à chaque onglet", gameSource.includes('PLAYER_ID_KEY = "spellaho-player-id"'));
  check("Secours WebRTC pour GitHub Pages", gameSource.includes("joinPeerRoom") && gameSource.includes("peerjs@1.5.5"));
  check("Aperçu du cimetière et de l'exil mis à jour", gameSource.includes("renderPilePreviews"));
  check("Main en éventail calculée selon le nombre de cartes", gameSource.includes("--hand-rotation") && gameSource.includes("--hand-overlap"));
  check("Terrains permanents avec leur illustration", gameSource.includes("--land-art") && gameSource.includes("land-permanent-art"));

  res = await fetch(`${base}/styles.css`);
  const styles = await res.text();
  check("Illustrations stables au survol", styles.includes("object-fit: contain") && styles.includes(".game-card:hover .card-art img"));
  check("Plateau responsive sur une colonne", styles.includes("@media (max-width: 1100px)") && styles.includes("grid-template-columns: minmax(0, 1fr)"));
  check("Fumée magique animée autour de l'arène", styles.includes("spellaho-smoke-drift-a") && styles.includes("Fumee%20magique.png"));

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
  check("6 sorts avec illustrations autonomes", spells.length === 6);
  check(
    "Aucun sort ne réutilise une image de créature ou de terrain",
    spells.every((spell) => spell.image.startsWith("Images/Sort - ") || spell.image === "Images/Artefact - Pierre de Norne.PNG")
  );
  check("Colère d'Umi = Bleu", spells.find((s) => s.id === "colere-umi")?.family === "Bleu");
  check("Malédiction d'Ulgod = Rouge", spells.find((s) => s.id === "malediction-ulgod")?.family === "Rouge");
  check("Pitié d'Aldia = Blanc", spells.find((s) => s.id === "pitie-aldia")?.family === "Blanc");
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
