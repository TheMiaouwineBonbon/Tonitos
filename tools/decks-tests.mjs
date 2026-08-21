// =====================================================================
// Spellaho - Invariants du constructeur de decks
// ---------------------------------------------------------------------
// Ces tests fixent ce que le constructeur automatique doit garantir. Ils
// sont nes de deux defauts reels, qui coexistaient sans que rien ne les
// signale :
//   - le departage des cartes de meme cout se faisait par ordre
//     ALPHABETIQUE, donc les memes cartes sortaient a chaque partie et
//     52 cartes du catalogue n apparaissaient jamais ;
//   - le tirage servait UN exemplaire par carte avant d en reprendre un
//     second, produisant des decks de 57 cartes differentes sur 60.
//
//   node .\tools\decks-tests.mjs
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DECKS,
  DECK_LANDS,
  DECK_SIZE,
  MAX_NONLAND_COPIES,
  buildDeck,
  cardFitsDeckColors,
  deckPrintList
} from "../decks.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lire = async (nom) => JSON.parse(await readFile(path.join(RACINE, "data", nom), "utf8"));

const catalogue = {
  cards: (await lire("cards.json")).map((carte) => ({ ...carte, kind: "creature" })),
  spells: (await lire("spells.json")).map((carte) => ({ ...carte, kind: "spell" })),
  lands: await lire("lands.json")
};

const decksAutomatiques = DECKS.filter((spec) => !spec.deckList);
const exemplaires = (deck) => {
  const compte = new Map();
  for (const carte of deck) compte.set(carte.id, (compte.get(carte.id) || 0) + 1);
  return compte;
};

test("chaque deck contient 60 cartes dont 24 terrains", () => {
  for (const spec of DECKS) {
    const deck = buildDeck(spec, catalogue);
    assert.equal(deck.length, DECK_SIZE, spec.shortName);
    assert.equal(deck.filter((carte) => carte.kind === "land").length, DECK_LANDS, spec.shortName);
  }
});

test("aucune carte ne depasse quatre exemplaires", () => {
  for (const spec of DECKS) {
    const compte = exemplaires(buildDeck(spec, catalogue));
    for (const [id, nombre] of compte) {
      assert.ok(nombre <= MAX_NONLAND_COPIES, `${spec.shortName} : ${id} en ${nombre} exemplaires`);
    }
  }
});

// Un terrain bicolore figure dans les listes des DEUX couleurs du deck. Avec
// un compteur par couleur, il etait pris quatre fois de chaque cote.
test("un terrain bicolore n est pas compte deux fois", () => {
  for (const spec of decksAutomatiques) {
    const deck = buildDeck(spec, catalogue);
    const compte = exemplaires(deck.filter((carte) => carte.kind === "land"));
    for (const [id, nombre] of compte) {
      assert.ok(nombre <= MAX_NONLAND_COPIES, `${spec.shortName} : terrain ${id} en ${nombre}`);
    }
  }
});

// Le coeur de la correction : un deck se joue sur des cartes qu on revoit.
// Les listes ecrites a la main tiennent en 19 a 27 cartes differentes.
test("les decks construits ne sont pas des listes singleton", () => {
  for (const spec of decksAutomatiques) {
    const distinctes = exemplaires(buildDeck(spec, catalogue)).size;
    assert.ok(
      distinctes <= 32,
      `${spec.shortName} : ${distinctes} cartes differentes sur ${DECK_SIZE}, le deck est disperse`
    );
  }
});

test("a graine egale, le deck est identique", () => {
  for (const spec of decksAutomatiques) {
    const premier = buildDeck(spec, catalogue).map((carte) => carte.id).join(",");
    const second = buildDeck(spec, catalogue).map((carte) => carte.id).join(",");
    assert.equal(premier, second, spec.shortName);
    // La liste imprimee depend du meme tirage : elle doit etre stable aussi.
    const impression = deckPrintList(spec, catalogue).map((entree) => entree.card.id).join(",");
    const impressionBis = deckPrintList(spec, catalogue).map((entree) => entree.card.id).join(",");
    assert.equal(impression, impressionBis, spec.shortName);
  }
});

test("une graine differente donne un deck different", () => {
  for (const spec of decksAutomatiques) {
    const parDefaut = buildDeck(spec, catalogue).map((carte) => carte.id).join(",");
    const autre = buildDeck(spec, catalogue, { seed: 1234 }).map((carte) => carte.id).join(",");
    assert.notEqual(parDefaut, autre, spec.shortName);
  }
});

// Le biais alphabetique se reconnait a ceci : quelle que soit la graine, ce
// sont toujours les memes cartes qui sortent.
test("le catalogue eligible n est plus fige sur une seule composition", () => {
  for (const spec of decksAutomatiques) {
    const uneSeule = new Set(buildDeck(spec, catalogue).map((carte) => carte.id));
    const surVingt = new Set();
    for (let graine = 0; graine < 20; graine += 1) {
      for (const carte of buildDeck(spec, catalogue, { seed: graine })) surVingt.add(carte.id);
    }
    assert.ok(
      surVingt.size > uneSeule.size * 1.5,
      `${spec.shortName} : ${surVingt.size} cartes atteintes sur 20 graines contre ${uneSeule.size} pour une seule`
    );
  }
});

test("toutes les cartes retenues respectent l identite du deck", () => {
  for (const spec of DECKS) {
    for (const carte of buildDeck(spec, catalogue)) {
      if (carte.kind === "land") continue;
      assert.ok(
        cardFitsDeckColors(carte, spec.colors),
        `${spec.shortName} : ${carte.name} hors identite ${spec.colors.join("/")}`
      );
    }
  }
});
