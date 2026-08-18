// =====================================================================
// Spellaho - Tests du rendu des cartes
// ---------------------------------------------------------------------
// Verifie ce qui casse silencieusement quand le jeu et la Collection
// partagent un meme gabarit SVG : identifiants qui se marchent dessus,
// statistiques figees a celles de la fiche, cache qui reconstruit tout.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cardSvg, G, ZONE_ART, RAYON_CARTE, IDENTIFIANTS_INTERNES } from "../carte-gabarit.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lire = (f) => JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8"));
const ELEMENTS = lire("elements.json");
const contexte = (prefixe) => ({ elements: ELEMENTS, image: (p) => `./${p}`, prefixe });

const creature = {
  uid: "player-unit-essai-1", id: "essai", name: "Bete d essai", kind: "creature", family: "Vert",
  type: "Créature - Essai", cost: 3, attack: 2, life: 4, keywords: ["Lien de vie"],
  abilityName: "Capacite", abilityText: "Un texte de capacite.", flavor: "Une citation.",
  image: "Images/x.png", palette: { primary: "#3f8a45", secondary: "#a9d778", deep: "#112513" }
};
const terrain = { ...creature, uid: "u2", kind: "land", type: "Terrain - Plaine", family: "Blanc", energy: 1, palette: { primary: "#c78135", secondary: "#f3d183", deep: "#2a160d" } };
const sort = { ...creature, uid: "u3", kind: "spell", type: "Rituel - Essai", family: "Bleu", palette: { primary: "#176b8c", secondary: "#67d3ff", deep: "#081d2a" } };

// Reproduit la strategie de cache du jeu, pour la tester hors navigateur.
function creerRenderer() {
  const cache = new Map();
  const stats = { generes: 0, touches: 0 };
  const cle = (c) => {
    const vie = c.currentLife === undefined ? c.life : c.currentLife;
    return [c.uid || c.id, c.kind, c.cost, c.attack, vie, c.maxLife, c.energy, (c.keywords || []).join(",")].join("|");
  };
  return {
    stats,
    rendre(carte) {
      const k = cle(carte);
      if (cache.has(k)) { stats.touches += 1; return cache.get(k); }
      stats.generes += 1;
      const vie = carte.currentLife === undefined ? carte.life : carte.currentLife;
      const svg = cardSvg({ ...carte, life: vie }, contexte(`sp${String(carte.uid).replace(/[^a-z0-9]/gi, "")}`));
      cache.set(k, svg);
      return svg;
    }
  };
}

test("chaque categorie est rendue par le gabarit SVG", () => {
  for (const [nom, carte] of [["creature", creature], ["terrain", terrain], ["sort", sort]]) {
    const svg = cardSvg(carte, contexte("t"));
    assert.match(svg, /^<svg xmlns/, `${nom} : pas un SVG`);
    assert.match(svg, new RegExp(`viewBox="0 0 ${G.W} ${G.H}"`), `${nom} : viewBox inattendu`);
    assert.ok(svg.includes(carte.name), `${nom} : titre absent`);
    assert.ok(svg.includes(String(carte.type).toUpperCase()), `${nom} : bandeau de type absent`);
  }
});

test("les statistiques affichees sont celles de l etat, pas de la fiche", () => {
  // Independant de la taille de police : elle suit le rayon des medaillons.
  const chiffres = (svg) => [...svg.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map((m) => m[1]);
  const fiche = chiffres(cardSvg(creature, contexte("a")));
  assert.deepEqual(fiche, ["3", "2", "4"], "la fiche doit afficher 2/4");

  // Une creature blessee puis buffee : 2/4 -> 5/2.
  const modifiee = { ...creature, attack: 5, life: 2 };
  assert.deepEqual(chiffres(cardSvg(modifiee, contexte("b"))), ["3", "5", "2"]);
});

test("le rendu du jeu suit currentLife plutot que la vie de base", () => {
  const renderer = creerRenderer();
  const svg = renderer.rendre({ ...creature, life: 4, currentLife: 1 });
  const chiffres = [...svg.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map((m) => m[1]);
  assert.deepEqual(chiffres, ["3", "2", "1"], "une creature blessee doit afficher 1 point de vie");
});

test("un etat inchange ne declenche aucune regeneration", () => {
  const renderer = creerRenderer();
  for (let i = 0; i < 10; i += 1) renderer.rendre(creature);
  assert.equal(renderer.stats.generes, 1, "un seul rendu attendu");
  assert.equal(renderer.stats.touches, 9);
});

test("un degat ne recalcule que la carte touchee", () => {
  const renderer = creerRenderer();
  const table = Array.from({ length: 12 }, (_, i) => ({ ...creature, uid: `u${i}` }));
  for (const c of table) renderer.rendre(c);
  assert.equal(renderer.stats.generes, 12, "premier rendu de la table");

  // Une seule creature perd un point de vie, puis toute la table est rendue.
  table[5] = { ...table[5], currentLife: 3 };
  const avant = renderer.stats.generes;
  for (const c of table) renderer.rendre(c);
  assert.equal(renderer.stats.generes - avant, 1, "une seule carte doit etre reconstruite");
});

test("vingt cartes affichees ensemble n ont aucun identifiant en commun", () => {
  const vus = new Map();
  for (let i = 0; i < 20; i += 1) {
    const svg = cardSvg({ ...creature, uid: `carte-${i}` }, contexte(`sp${i}`));
    for (const [, id] of svg.matchAll(/id="([^"]+)"/g)) {
      const proprietaire = vus.get(id);
      assert.equal(proprietaire, undefined, `identifiant ${id} partage entre la carte ${proprietaire} et ${i}`);
      vus.set(id, i);
    }
  }
  assert.equal(vus.size, 20 * IDENTIFIANTS_INTERNES.length, "chaque carte doit declarer sa propre serie");
});

test("toutes les references internes pointent vers les identifiants prefixes", () => {
  const svg = cardSvg(creature, contexte("carteX"));
  const references = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(references.length > 0, "aucune reference trouvee");
  for (const ref of references) {
    assert.ok(ref.startsWith("carteX-"), `reference non prefixee : ${ref}`);
    assert.ok(svg.includes(`id="${ref}"`), `reference orpheline : ${ref}`);
  }
});

test("la zone d illustration et le rayon viennent de la grille", () => {
  assert.equal(ZONE_ART.gauche.toFixed(2), ((G.art.x / G.W) * 100).toFixed(2));
  assert.equal(ZONE_ART.hauteur.toFixed(2), ((G.art.h / G.H) * 100).toFixed(2));
  assert.ok(RAYON_CARTE.x > 0 && RAYON_CARTE.y > 0, "rayon de carte non defini");
});

test("les cartes reelles passent toutes le gabarit sans erreur", () => {
  const cartes = [
    ...lire("cards.json").map((c) => ({ ...c, kind: "creature" })),
    ...lire("lands.json"),
    ...lire("spells.json").map((c) => ({ ...c, kind: "spell" }))
  ];
  let rendus = 0;
  for (const carte of cartes) {
    const svg = cardSvg(carte, contexte("x"));
    assert.ok(svg.length > 2000, `${carte.name} : SVG anormalement court`);
    assert.ok(!svg.includes("undefined"), `${carte.name} : valeur manquante dans le SVG`);
    rendus += 1;
  }
  assert.equal(rendus, cartes.length);
});
