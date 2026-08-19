// =====================================================================
// Spellaho - DOM minimal pour executer le jeu sous Node
// ---------------------------------------------------------------------
// Le smoke test historique lit le source sans jamais l'executer : un
// module qui plante au chargement y passait au vert. Ce stub fournit
// juste ce que `game.js` touche (document, window, stockage, audio,
// fetch local) afin de faire tourner une vraie partie hors navigateur.
//
// Ce n'est pas un navigateur : les mesures geometriques renvoient zero,
// donc les animations qui dependent d'un rectangle se coupent d'elles-
// memes. Deux reglages pilotent le reste :
//   options.timeScale        compresse les delais (0.02 = 50x plus vite)
//   options.instantAnimation declenche `animationend` immediatement
// =====================================================================
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// `pointeurFin` simule un vrai curseur : le jeu s'en sert pour choisir entre
// le chemin PC (clic = fiche de carte) et le chemin tactile (clic = action).
export const horloge = { timeScale: 0.02, instantAnimation: true, pointeurFin: true };

// --- Selecteurs : sous-ensemble suffisant pour le jeu ------------------
// Gere « a b », « .a.b », « #id », « tag » et « [attr="v"] », plus les listes.
function analyseSelecteur(selecteur) {
  return String(selecteur)
    .split(",")
    .map((partie) => partie.trim().split(/\s+/).filter(Boolean).map(analyseSimple))
    .filter((chaine) => chaine.length > 0);
}

function analyseSimple(brut) {
  const test = { tag: null, classes: [], id: null, attrs: [] };
  const jetons = brut.match(/(^[a-zA-Z][\w-]*)|(\.[\w-]+)|(#[\w-]+)|(\[[^\]]+\])/g) || [];
  for (const jeton of jetons) {
    if (jeton.startsWith(".")) test.classes.push(jeton.slice(1));
    else if (jeton.startsWith("#")) test.id = jeton.slice(1);
    else if (jeton.startsWith("[")) {
      const corps = jeton.slice(1, -1);
      const separateur = corps.indexOf("=");
      const nom = separateur < 0 ? corps : corps.slice(0, separateur);
      const valeur = separateur < 0 ? null : corps.slice(separateur + 1).replace(/^["']|["']$/g, "");
      test.attrs.push([nom.trim(), valeur]);
    } else test.tag = jeton.toLowerCase();
  }
  return test;
}

function correspond(noeud, test) {
  if (test.tag && noeud.tagName.toLowerCase() !== test.tag) return false;
  if (test.id && noeud.id !== test.id) return false;
  for (const classe of test.classes) if (!noeud.classList.contains(classe)) return false;
  for (const [nom, valeur] of test.attrs) {
    const actuelle = noeud.getAttribute(nom);
    if (actuelle === null) return false;
    if (valeur !== null && String(actuelle) !== valeur) return false;
  }
  return true;
}

class Classes {
  constructor() { this.set = new Set(); }
  add(...noms) { for (const nom of noms) if (nom) this.set.add(nom); }
  remove(...noms) { for (const nom of noms) this.set.delete(nom); }
  contains(nom) { return this.set.has(nom); }
  toggle(nom, force) {
    const veut = force === undefined ? !this.set.has(nom) : Boolean(force);
    if (veut) this.set.add(nom); else this.set.delete(nom);
    return veut;
  }
  get value() { return [...this.set].join(" "); }
}

class Style {
  setProperty(nom, valeur) { this[nom] = valeur; }
  removeProperty(nom) { delete this[nom]; }
  getPropertyValue(nom) { return this[nom] ?? ""; }
}

let compteurNoeud = 0;

export class NoeudStub {
  constructor(tagName = "div") {
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.classList = new Classes();
    this.style = new Style();
    this.dataset = {};
    this.attributes = {};
    this.listeners = new Map();
    this.textContent = "";
    this.innerHTMLBrut = "";
    this.hidden = false;
    this.disabled = false;
    this.id = "";
    this.type = "";
    this.value = "";
    this.title = "";
    this.ordre = compteurNoeud += 1;
  }

  get className() { return this.classList.value; }
  set className(valeur) {
    this.classList = new Classes();
    for (const nom of String(valeur).split(/\s+/)) this.classList.add(nom);
  }

  get innerHTML() { return this.innerHTMLBrut; }
  set innerHTML(valeur) {
    this.innerHTMLBrut = String(valeur);
    for (const enfant of this.children) enfant.parentNode = null;
    this.children = [];
  }

  get firstElementChild() { return this.children[0] || null; }
  get lastElementChild() { return this.children.at(-1) || null; }
  get offsetWidth() { return 0; }
  get offsetHeight() { return 0; }
  get clientWidth() { return 0; }
  get clientHeight() { return 0; }
  get scrollHeight() { return 0; }

  append(...noeuds) {
    for (const noeud of noeuds) {
      if (noeud == null || typeof noeud === "string") continue;
      if (noeud instanceof FragmentStub) { this.append(...noeud.children.splice(0)); continue; }
      noeud.parentNode?.removeChild?.(noeud);
      noeud.parentNode = this;
      this.children.push(noeud);
    }
  }
  appendChild(noeud) { this.append(noeud); return noeud; }
  removeChild(noeud) {
    const index = this.children.indexOf(noeud);
    if (index >= 0) this.children.splice(index, 1);
    noeud.parentNode = null;
    return noeud;
  }
  remove() { this.parentNode?.removeChild(this); }
  replaceChildren(...noeuds) {
    for (const enfant of this.children) enfant.parentNode = null;
    this.children = [];
    this.append(...noeuds);
  }

  descendants() {
    const sortie = [];
    const pile = [...this.children];
    while (pile.length > 0) {
      const noeud = pile.shift();
      sortie.push(noeud);
      pile.unshift(...noeud.children);
    }
    return sortie;
  }

  chaineCorrespond(noeud, chaine) {
    if (!correspond(noeud, chaine.at(-1))) return false;
    let parent = noeud.parentNode;
    for (let i = chaine.length - 2; i >= 0; i -= 1) {
      let trouve = false;
      while (parent) {
        if (correspond(parent, chaine[i])) { trouve = true; parent = parent.parentNode; break; }
        parent = parent.parentNode;
      }
      if (!trouve) return false;
    }
    return true;
  }

  querySelectorAll(selecteur) {
    const chaines = analyseSelecteur(selecteur);
    return this.descendants().filter((noeud) => chaines.some((chaine) => this.chaineCorrespond(noeud, chaine)));
  }

  querySelector(selecteur) { return this.querySelectorAll(selecteur)[0] || null; }

  matches(selecteur) {
    return analyseSelecteur(selecteur).some((chaine) => correspond(this, chaine.at(-1)));
  }

  closest(selecteur) {
    let noeud = this;
    while (noeud) {
      if (noeud.matches?.(selecteur)) return noeud;
      noeud = noeud.parentNode;
    }
    return null;
  }

  setAttribute(nom, valeur) {
    this.attributes[nom] = String(valeur);
    if (nom === "id") this.id = String(valeur);
    if (nom === "class") this.className = valeur;
  }
  getAttribute(nom) {
    if (nom === "class") return this.className;
    if (nom === "id") return this.id || this.attributes.id || null;
    if (nom.startsWith("data-")) {
      const cle = nom.slice(5).replace(/-([a-z])/g, (_, lettre) => lettre.toUpperCase());
      if (this.dataset[cle] !== undefined) return String(this.dataset[cle]);
    }
    return this.attributes[nom] ?? null;
  }
  removeAttribute(nom) { delete this.attributes[nom]; }
  hasAttribute(nom) { return this.getAttribute(nom) !== null; }

  addEventListener(type, handler, options = {}) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push({ handler, options });
    // Aucune animation CSS ici : on la declare finie tout de suite, sinon
    // toute la chaine d'attaque resterait bloquee sur `isAnimating`.
    if (type === "animationend" && horloge.instantAnimation) {
      queueMicrotask(() => handler({ type: "animationend", target: this }));
    }
  }
  removeEventListener(type, handler) {
    const liste = this.listeners.get(type);
    if (!liste) return;
    const index = liste.findIndex((entree) => entree.handler === handler);
    if (index >= 0) liste.splice(index, 1);
  }
  dispatchEvent(evenement) {
    const type = evenement?.type;
    const liste = [...(this.listeners.get(type) || [])];
    const complet = { bubbles: true, cancelable: true, target: this, preventDefault() {}, stopPropagation() {}, ...evenement };
    for (const { handler, options } of liste) {
      handler.call(this, complet);
      if (options?.once) this.removeEventListener(type, handler);
    }
    return true;
  }

  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }; }
  cloneNode() {
    const copie = new NoeudStub(this.tagName);
    copie.className = this.className;
    copie.dataset = { ...this.dataset };
    copie.textContent = this.textContent;
    return copie;
  }
  focus() {}
  blur() {}
  scrollIntoView() {}
  // Les fiches de carte posent un <video> : sans ces methodes, ouvrir la
  // fiche d'une carte animee ferait planter le test.
  play() { return Promise.resolve(); }
  pause() {}
  load() {}
  setPointerCapture() {}
  releasePointerCapture() {}
  hasPointerCapture() { return false; }
}

class FragmentStub extends NoeudStub {
  constructor() { super("#fragment"); }
}

// --- Installation des globales ----------------------------------------
export function installerDom(options = {}) {
  Object.assign(horloge, options);
  const cache = new Map();
  const racine = new NoeudStub("html");
  const body = new NoeudStub("body");
  racine.append(body);

  const document = {
    documentElement: racine,
    body,
    hidden: false,
    listeners: new Map(),
    createElement: (tag) => new NoeudStub(tag),
    createElementNS: (_ns, tag) => new NoeudStub(tag),
    createDocumentFragment: () => new FragmentStub(),
    // Un selecteur inconnu rend toujours le meme noeud : les references
    // captees au chargement de `game.js` restent stables ensuite.
    querySelector(selecteur) {
      const vivant = body.querySelector(selecteur);
      if (vivant) return vivant;
      if (!cache.has(selecteur)) {
        const noeud = new NoeudStub("div");
        if (selecteur.startsWith("#")) noeud.id = selecteur.slice(1);
        for (const classe of selecteur.match(/\.[\w-]+/g) || []) noeud.classList.add(classe.slice(1));
        cache.set(selecteur, noeud);
      }
      return cache.get(selecteur);
    },
    querySelectorAll(selecteur) { return body.querySelectorAll(selecteur); },
    addEventListener(type, handler, options) { NoeudStub.prototype.addEventListener.call(this, type, handler, options); },
    removeEventListener(type, handler) { NoeudStub.prototype.removeEventListener.call(this, type, handler); },
    dispatchEvent(evenement) { return NoeudStub.prototype.dispatchEvent.call(this, evenement); }
  };

  const stockage = () => {
    const donnees = new Map();
    return {
      getItem: (cle) => (donnees.has(cle) ? donnees.get(cle) : null),
      setItem: (cle, valeur) => donnees.set(cle, String(valeur)),
      removeItem: (cle) => donnees.delete(cle),
      clear: () => donnees.clear()
    };
  };

  const vraiSetTimeout = globalThis.setTimeout;
  const vraiClearTimeout = globalThis.clearTimeout;
  const vraiSetInterval = globalThis.setInterval;
  const vraiClearInterval = globalThis.clearInterval;

  const planifier = (callback, delai = 0, ...args) =>
    vraiSetTimeout(callback, Math.max(0, Math.round(Number(delai) * horloge.timeScale)), ...args);

  const fenetre = {
    document,
    innerWidth: 1440,
    innerHeight: 900,
    devicePixelRatio: 1,
    localStorage: stockage(),
    sessionStorage: stockage(),
    // Effets reduits : les cinematiques se coupent, les tests restent nets.
    matchMedia: (requete) => ({
      matches: /prefers-reduced-motion/.test(requete)
        || (horloge.pointeurFin && /hover:\s*hover/.test(requete)),
      media: requete,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}
    }),
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    requestAnimationFrame: (callback) => planifier(() => callback(Date.now()), 16),
    cancelAnimationFrame: (id) => vraiClearTimeout(id),
    setTimeout: planifier,
    clearTimeout: (id) => vraiClearTimeout(id),
    setInterval: (callback, delai) => vraiSetInterval(callback, Math.max(4, Math.round(Number(delai) * horloge.timeScale))),
    clearInterval: (id) => vraiClearInterval(id),
    addEventListener(type, handler, options) { NoeudStub.prototype.addEventListener.call(this, type, handler, options); },
    removeEventListener(type, handler) { NoeudStub.prototype.removeEventListener.call(this, type, handler); },
    dispatchEvent(evenement) { return NoeudStub.prototype.dispatchEvent.call(this, evenement); },
    listeners: new Map()
  };

  class ImageStub { constructor() { this.src = ""; } }
  // Un <audio> peut etre insere dans le document : il doit donc se comporter
  // comme un noeud, sinon le parcours du DOM bute dessus.
  class AudioStub extends NoeudStub {
    constructor() { super("audio"); this.volume = 1; this.loop = false; this.currentTime = 0; this.src = ""; }
    play() { return Promise.resolve(); }
    pause() {}
  }

  // Node 24 expose deja `navigator` en lecture seule : `Object.assign`
  // echouerait, il faut redefinir la propriete.
  const poser = (cible, valeurs) => {
    for (const [nom, valeur] of Object.entries(valeurs)) {
      Object.defineProperty(cible, nom, { value: valeur, writable: true, configurable: true, enumerable: true });
    }
  };

  poser(globalThis, {
    window: fenetre,
    document,
    localStorage: fenetre.localStorage,
    sessionStorage: fenetre.sessionStorage,
    navigator: { vibrate() {}, userAgent: "node-spellaho", language: "fr-FR" },
    screen: { orientation: { type: "landscape-primary", angle: 0, addEventListener() {} }, width: 1440, height: 900 },
    location: { search: "", href: "http://localhost/", origin: "http://localhost" },
    matchMedia: fenetre.matchMedia,
    getComputedStyle: fenetre.getComputedStyle,
    requestAnimationFrame: fenetre.requestAnimationFrame,
    cancelAnimationFrame: fenetre.cancelAnimationFrame,
    Image: ImageStub,
    Audio: AudioStub,
    Element: NoeudStub,
    setTimeout: planifier,
    clearTimeout: fenetre.clearTimeout,
    setInterval: fenetre.setInterval,
    clearInterval: fenetre.clearInterval
  });
  globalThis.window.window = globalThis.window;

  // Les fichiers de donnees sont lus sur disque : aucun serveur requis.
  globalThis.fetch = async (url) => {
    const chemin = path.join(RACINE, decodeURIComponent(String(url).split("?")[0].replace(/^\.\//, "")));
    const contenu = await readFile(chemin, "utf8");
    return { ok: true, status: 200, json: async () => JSON.parse(contenu), text: async () => contenu };
  };

  return { document, window: fenetre, body };
}

export const attendre = (ms = 0) =>
  new Promise((resolve) => globalThis.setTimeout(resolve, Math.round(ms / horloge.timeScale)));
