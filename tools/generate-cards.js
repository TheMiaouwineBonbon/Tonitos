const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const cardsPath = path.join(root, "data", "cards.json");
const landsPath = path.join(root, "data", "lands.json");
const spellsPath = path.join(root, "data", "spells.json");
const outputDir = path.join(root, "Images", "Cartes");

const cards = [
  ...JSON.parse(fs.readFileSync(cardsPath, "utf8")).map((card) => ({ ...card, kind: "creature" })),
  ...JSON.parse(fs.readFileSync(landsPath, "utf8")),
  ...JSON.parse(fs.readFileSync(spellsPath, "utf8")).map((card) => ({ ...card, kind: "spell" }))
];
fs.mkdirSync(outputDir, { recursive: true });
for (const file of fs.readdirSync(outputDir)) {
  if (file.toLowerCase().endsWith(".svg")) {
    fs.unlinkSync(path.join(outputDir, file));
  }
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrapText(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function textBlock(lines, x, y, size, fill, weight = 500, lineHeight = 26) {
  return lines
    .map((line, index) => {
      return `<text x="${x}" y="${y + index * lineHeight}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`;
    })
    .join("\n");
}

function imageReference(relativePath) {
  const imagePath = path.join(root, relativePath);
  const fromCardFolder = path.relative(outputDir, imagePath);
  return fromCardFolder
    .split(path.sep)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function cardSvg(card) {
  const w = 744;
  const h = 1038;
  const artHref = imageReference(card.image);
  const abilityLines = wrapText(card.abilityText, 48).slice(0, 4);
  const flavorLines = wrapText(card.flavor, 50).slice(0, 2);
  const keywords = card.keywords.join(" • ");
  const isLand = card.kind === "land";
  const isSpell = card.kind === "spell";
  const topValue = isLand ? card.energy : card.cost;
  const statText = isLand ? "Mana" : isSpell ? "Sort" : `${card.attack} / ${card.life}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${card.palette.secondary}"/>
      <stop offset="42%" stop-color="${card.palette.primary}"/>
      <stop offset="100%" stop-color="${card.palette.deep}"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff8e6"/>
      <stop offset="100%" stop-color="#d7c3a0"/>
    </linearGradient>
    <clipPath id="artClip">
      <rect x="48" y="118" width="648" height="486" rx="8"/>
    </clipPath>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
  </defs>

  <rect width="${w}" height="${h}" rx="18" fill="#100c0a"/>
  <rect x="20" y="20" width="704" height="998" rx="14" fill="url(#frame)" filter="url(#softShadow)"/>
  <rect x="34" y="34" width="676" height="970" rx="10" fill="#1a1110" opacity="0.92"/>

  <rect x="48" y="48" width="648" height="54" rx="8" fill="#f7ead0"/>
  <text x="70" y="84" font-family="Georgia, 'Times New Roman', serif" font-size="32" font-weight="700" fill="#20120e">${escapeXml(card.name)}</text>
  <circle cx="660" cy="75" r="34" fill="${card.palette.deep}" stroke="${card.palette.secondary}" stroke-width="5"/>
  <text x="660" y="87" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#fff7df">${topValue}</text>

  <image href="${artHref}" x="48" y="118" width="648" height="486" preserveAspectRatio="xMidYMid meet" clip-path="url(#artClip)"/>
  <rect x="48" y="118" width="648" height="486" rx="8" fill="none" stroke="${card.palette.secondary}" stroke-width="4"/>

  <rect x="48" y="622" width="648" height="48" rx="8" fill="#f3e1bf"/>
  <text x="70" y="654" font-family="Arial, sans-serif" font-size="23" font-weight="700" fill="#24130d">${escapeXml(card.type)}</text>

  <rect x="48" y="688" width="648" height="212" rx="8" fill="url(#panel)" stroke="#4a2b1a" stroke-width="3"/>
  <text x="70" y="728" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="#21130e">${escapeXml(card.abilityName)}</text>
  <text x="70" y="760" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${card.palette.primary}">${escapeXml(keywords)}</text>
  ${textBlock(abilityLines, 70, 802, 21, "#241812", 500, 27)}
  <line x1="70" y1="872" x2="674" y2="872" stroke="#8f7250" stroke-width="2" opacity="0.65"/>
  <text x="70" y="902" font-family="Georgia, 'Times New Roman', serif" font-size="18" font-style="italic" fill="#4c3628">${escapeXml(flavorLines[0] || "")}</text>
  <text x="70" y="928" font-family="Georgia, 'Times New Roman', serif" font-size="18" font-style="italic" fill="#4c3628">${escapeXml(flavorLines[1] || "")}</text>

  <rect x="48" y="920" width="228" height="58" rx="8" fill="${card.palette.deep}" stroke="${card.palette.secondary}" stroke-width="4"/>
  <text x="70" y="957" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="#fff4d2">${escapeXml(card.family)}</text>

  <rect x="538" y="912" width="158" height="76" rx="8" fill="#f9ead0" stroke="${card.palette.deep}" stroke-width="5"/>
  <text x="616" y="962" text-anchor="middle" font-family="Arial, sans-serif" font-size="${isLand || isSpell ? 30 : 38}" font-weight="900" fill="#20120e">${statText}</text>
</svg>`;
}

for (const card of cards) {
  const fileName = `${card.name}.svg`.replace(/[<>:"/\\|?*]/g, "-");
  fs.writeFileSync(path.join(outputDir, fileName), cardSvg(card), "utf8");
}

console.log(`Cartes générées : ${cards.length}`);
