// =====================================================================
// Spellaho - Correction des sous-types de terrain
// ---------------------------------------------------------------------
// Les sous-types etaient deduits mecaniquement de la couleur de mana :
// tout terrain blanc etait une « Plaine », tout terrain noir un
// « Marais », etc. « Manoir Dracul » se retrouvait marais et « Le monde
// d au dessus », une cite celeste flottante, plaine. Les sous-titres
// suivaient la meme mecanique.
//
// Le type geographique et la couleur de mana sont deux informations
// distinctes : ce script leur redonne chacun leur sens, sans toucher a
// la couleur produite ni a l equilibrage.
//
//   node .\tools\corriger-types-terrains.mjs
// =====================================================================
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chemin = path.join(RACINE, "data", "lands.json");

// Lieu reellement represente par le nom et l illustration de chaque carte.
const CORRECTIONS = {
  "chateau-bordeciel": { type: "Terrain - Château", subtitle: "Bastion des serments" },
  "chateau-luxurieux": { type: "Terrain - Château", subtitle: "Palais des jardins dorés" },
  "monde-au-dessus": { type: "Terrain - Cité céleste", subtitle: "Ville suspendue aux nuages" },
  "monde-celeste-azure": { type: "Terrain - Cité céleste", subtitle: "Archipel d'azur" },
  "oceania-cite-sous-marine": { type: "Terrain - Cité engloutie", subtitle: "Capitale des abysses" },
  "ruines-sous-marine": { type: "Terrain - Ruines", subtitle: "Vestiges noyés" },
  "lac-bleu": { type: "Terrain - Lac", subtitle: "Miroir silencieux" },
  "tempete-bleue": { type: "Terrain - Haute mer", subtitle: "Tempête des vents chargés" },
  "cimetiere": { type: "Terrain - Cimetière", subtitle: "Champ des voix basses" },
  "lac-putride": { type: "Terrain - Lac", subtitle: "Eaux stagnantes" },
  "manoir-dracul": { type: "Terrain - Manoir", subtitle: "Demeure de sang froid" },
  "laboratoire-noir": { type: "Terrain - Laboratoire", subtitle: "Alchimie maudite" },
  "royaume-noxis": { type: "Terrain - Royaume", subtitle: "Trône sanglant" },
  "village-demoniaque": { type: "Terrain - Village", subtitle: "Hameau des pactes mineurs" },
  "forge-elfique-volcanique": { type: "Terrain - Forge", subtitle: "Enclume des braises" },
  "volcan-infinie": { type: "Terrain - Volcan", subtitle: "Cratère sans sommeil" },
  "riviere-toukamon": { type: "Terrain - Rivière", subtitle: "Eaux brûlantes" },
  "volcan-rouge": { type: "Terrain - Volcan", subtitle: "Bouche ouverte" },
  "paradis-uldrid": { type: "Terrain - Forêt", subtitle: "Sylve primordiale" },
  "riviere-manhil": { type: "Terrain - Rivière", subtitle: "Courant vif" },
  "sentier-uldrid": { type: "Terrain - Sentier", subtitle: "Chemin des pas oubliés" },
  "champ-coquelicots": { type: "Terrain - Champ", subtitle: "Étendue fleurie" },
  "prairie-verte": { type: "Terrain - Prairie", subtitle: "Herbes claires" },
  "entree-ruche": { type: "Terrain - Ruche", subtitle: "Seuil contaminé" },
  "nid-ruche": { type: "Terrain - Ruche", subtitle: "Cœur de la colonie" },
  "temple-antique-desert": { type: "Terrain - Temple antique", subtitle: "Mécanismes enfouis" },
  "temple-antique-naturel": { type: "Terrain - Temple antique", subtitle: "Jardins mécaniques" },
  "temple-antique-mers": { type: "Terrain - Temple antique", subtitle: "Sanctuaire englouti" },
  "temple-antique-aube-polaire": { type: "Terrain - Temple antique", subtitle: "Sanctuaire boréal" },
  "village-cache": { type: "Terrain - Village", subtitle: "Refuge sous la canopée" },
  "royaume-paisible": { type: "Terrain - Royaume", subtitle: "Marche sans guerre" }
};

const terrains = JSON.parse(await readFile(chemin, "utf8"));
const journal = [];

const sortie = terrains.map((land) => {
  const correction = CORRECTIONS[land.id];
  if (!correction) return land;
  if (land.type !== correction.type || land.subtitle !== correction.subtitle) {
    journal.push(`${land.name} : « ${land.type} » -> « ${correction.type} »`);
  }
  return { ...land, type: correction.type, subtitle: correction.subtitle };
});

await writeFile(chemin, `${JSON.stringify(sortie, null, 2)}\n`, "utf8");

console.log(`Terrains relus : ${terrains.length}`);
console.log(`Sous-types corrigés : ${journal.length}`);
for (const ligne of journal) console.log(`  - ${ligne}`);
