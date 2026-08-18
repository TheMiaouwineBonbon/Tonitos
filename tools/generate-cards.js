// Ecrit les fichiers SVG de la page Collection.
// Le dessin lui-meme vit dans carte-gabarit.mjs, partage avec le jeu : une
// seule source de verite, sinon les cartes en partie et celles de la
// Collection finiraient par diverger.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "Images", "Cartes");
const lire = (fichier) => JSON.parse(fs.readFileSync(path.join(root, "data", fichier), "utf8"));

const ELEMENTS = lire("elements.json");
const cards = [
  ...lire("cards.json").map((card) => ({ ...card, kind: "creature" })),
  ...lire("lands.json"),
  ...lire("spells.json").map((card) => ({ ...card, kind: "spell" }))
];

// Les SVG vivent dans Images/Cartes : leurs references pointent donc vers
// le dossier parent.
function imageReference(relativePath) {
  return path
    .relative(outputDir, path.join(root, relativePath))
    .split(path.sep)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

(async () => {
  const { cardSvg } = await import("../carte-gabarit.mjs");

  fs.mkdirSync(outputDir, { recursive: true });
  for (const file of fs.readdirSync(outputDir)) {
    if (file.toLowerCase().endsWith(".svg")) fs.unlinkSync(path.join(outputDir, file));
  }

  for (const card of cards) {
    const fileName = `${card.name}.svg`.replace(/[<>:"/\|?*]/g, "-");
    const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + cardSvg(card, { elements: ELEMENTS, image: imageReference });
    fs.writeFileSync(path.join(outputDir, fileName), svg, "utf8");
  }

  console.log(`Cartes générées : ${cards.length}`);
})();
