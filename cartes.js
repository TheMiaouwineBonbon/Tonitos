// Le coût et la production affichés dans la fiche viennent du moteur, pas
// d'une lecture directe des données : la Collection dit donc exactement ce
// que le jeu applique.
import { describeLandProduction, describeManaCost } from "./engine-core.mjs?v=20260821-mort-1";

const DATA_URLS = ["cards", "lands", "spells"];
const CATEGORY_LABELS = {
  all: "Toutes les cartes",
  creature: "Créatures",
  spell: "Sorts",
  land: "Terrains"
};
const FALLBACK_ACCENT = "#d3ad63";

const state = {
  cards: [],
  category: "all",
  family: "all",
  query: "",
  sort: "name-asc",
  activeCard: null,
  previousFocus: null
};

const elements = {
  grid: document.querySelector("#card-grid"),
  loading: document.querySelector("#collection-loading"),
  error: document.querySelector("#collection-error"),
  empty: document.querySelector("#collection-empty"),
  search: document.querySelector("#card-search"),
  clearSearch: document.querySelector("#clear-search"),
  sort: document.querySelector("#card-sort"),
  resultsCount: document.querySelector("#results-count"),
  activeFilters: document.querySelector("#active-filters"),
  headerTotal: document.querySelector("#header-total"),
  collectionTotal: document.querySelector("#collection-total"),
  headerReset: document.querySelector("#header-reset"),
  emptyReset: document.querySelector("#empty-reset"),
  retryLoad: document.querySelector("#retry-load"),
  categoryButtons: [...document.querySelectorAll("[data-category]")],
  familyButtons: [...document.querySelectorAll("[data-family]")],
  pageRegions: [document.querySelector(".collection-header"), document.querySelector(".collection-main")],
  modal: document.querySelector("#collection-modal"),
  modalPanel: document.querySelector(".collection-modal-panel"),
  modalVisual: document.querySelector(".collection-modal-visual"),
  modalClose: document.querySelector("#modal-close"),
  modalImage: document.querySelector("#modal-card-image"),
  modalEyebrow: document.querySelector("#modal-eyebrow"),
  modalTitle: document.querySelector("#modal-title"),
  modalSubtitle: document.querySelector("#modal-subtitle"),
  modalFacts: document.querySelector("#modal-facts"),
  modalAbilityName: document.querySelector("#modal-ability-name"),
  modalAbilityText: document.querySelector("#modal-ability-text"),
  modalKeywords: document.querySelector("#modal-keywords"),
  modalFlavor: document.querySelector("#modal-flavor"),
  modalDownload: document.querySelector("#modal-download")
};

const svgCards = new WeakMap();
const SVG_ASSET_VERSION = "20260822-portail-1";

const svgObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const object = entry.target;
      loadCardSvg(object, svgCards.get(object));
      svgObserver.unobserve(object);
    }
  }, { rootMargin: "600px 0px" })
  : null;

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

function svgFileName(name) {
  return `${name}.svg`.replace(/[<>:"/\\|?*]/g, "-");
}

function svgUrl(card) {
  return `./Images/Cartes/${encodeURIComponent(svgFileName(card.name))}?v=${SVG_ASSET_VERSION}`;
}

function sourceImageUrl(card) {
  return new URL(card.image, document.baseURI).href;
}

function cacheBustedUrl(url) {
  const freshUrl = new URL(url, document.baseURI);
  freshUrl.searchParams.set("retry", Date.now());
  return freshUrl.href;
}

async function resolveSvgUrl(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (response.ok) return url;

  const retryUrl = cacheBustedUrl(url);
  const retryResponse = await fetch(retryUrl, { cache: "reload" });
  if (!retryResponse.ok) {
    throw new Error(`SVG indisponible (${retryResponse.status})`);
  }
  return retryUrl;
}

function safeAccent(value) {
  return /^#[\da-f]{3,8}$/i.test(value || "") ? value : FALLBACK_ACCENT;
}

function categoryFromIndex(index) {
  if (index === 0) return "creature";
  if (index === 1) return "land";
  return "spell";
}

function categorySingular(category) {
  if (category === "creature") return "Créature";
  if (category === "land") return "Terrain";
  return "Sort";
}

function normalizeCard(card, category) {
  return {
    ...card,
    category,
    searchText: normalizeText([
      card.name,
      card.subtitle,
      card.family,
      card.type,
      card.abilityName,
      card.abilityText,
      ...(card.keywords || [])
    ].join(" "))
  };
}

async function fetchCollection() {
  const version = Date.now();
  const responses = await Promise.all(
    DATA_URLS.map((name) => fetch(`./data/${name}.json?v=${version}`, { cache: "no-store" }))
  );
  const failed = responses.find((response) => !response.ok);
  if (failed) throw new Error(`Chargement impossible (${failed.status})`);
  const groups = await Promise.all(responses.map((response) => response.json()));
  return groups.flatMap((group, index) => group.map((card) => normalizeCard(card, categoryFromIndex(index))));
}

function compareCards(a, b) {
  const byName = a.name.localeCompare(b.name, "fr", { sensitivity: "base", numeric: true });
  const byType = a.type.localeCompare(b.type, "fr", { sensitivity: "base" });
  const byCost = Number(a.cost || 0) - Number(b.cost || 0);
  switch (state.sort) {
    case "name-desc": return -byName;
    case "cost-asc": return byCost || byName;
    case "cost-desc": return -byCost || byName;
    case "type-asc": return byType || byName;
    default: return byName;
  }
}

function filteredCards() {
  const normalizedQuery = normalizeText(state.query.trim());
  return state.cards
    .filter((card) => state.category === "all" || card.category === state.category)
    .filter(
      (card) =>
        state.family === "all" ||
        card.family === state.family ||
        (Array.isArray(card.colors) && card.colors.includes(state.family))
    )
    .filter((card) => !normalizedQuery || card.searchText.includes(normalizedQuery))
    .sort(compareCards);
}

function cardCostLabel(card) {
  return card.category === "land" ? "M" : String(card.cost ?? 0);
}

function finishCardLoading(object, broken = false) {
  const article = object.closest(".collection-card");
  if (!article) return;
  article.classList.remove("is-loading");
  article.classList.toggle("is-broken", broken);
  article.removeAttribute("aria-busy");
}

function showCardImageFallback(object, card) {
  const article = object.closest(".collection-card");
  if (!article || !object.isConnected || article.classList.contains("is-fallback") || !card?.image) return;

  const fallback = document.createElement("img");
  fallback.className = "collection-card-fallback";
  fallback.alt = `Illustration de ${card.name}`;
  fallback.decoding = "async";
  fallback.addEventListener("load", () => {
    article.classList.remove("is-loading", "is-broken");
    article.classList.add("is-fallback");
    article.removeAttribute("aria-busy");
  });
  fallback.addEventListener("error", () => finishCardLoading(fallback, true));
  object.replaceWith(fallback);
  fallback.src = sourceImageUrl(card);
}

async function loadCardSvg(object, card) {
  const url = object.dataset.src;
  if (!url) return;
  delete object.dataset.src;
  try {
    const resolvedUrl = await resolveSvgUrl(url);
    if (!object.isConnected) return;
    object.data = resolvedUrl;
  } catch (error) {
    console.warn("Impossible de charger une carte SVG", url, error);
    showCardImageFallback(object, card);
  }
}

function createCardTile(card, index) {
  const article = document.createElement("article");
  article.className = "collection-card is-loading";
  article.dataset.cardId = card.id;
  article.setAttribute("aria-busy", "true");
  article.style.setProperty("--card-accent", safeAccent(card.palette?.secondary));
  article.style.animationDelay = `${Math.min(index, 10) * 12}ms`;

  const art = document.createElement("span");
  art.className = "collection-card-art";
  const svg = document.createElement("object");
  svg.type = "image/svg+xml";
  svg.tabIndex = -1;
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Carte ${card.name}`);
  svgCards.set(svg, card);
  svg.addEventListener("load", () => finishCardLoading(svg));
  svg.addEventListener("error", () => showCardImageFallback(svg, card));
  if (svgObserver) {
    svg.dataset.src = svgUrl(card);
    svgObserver.observe(svg);
  } else {
    svg.dataset.src = svgUrl(card);
    loadCardSvg(svg, card);
  }
  art.append(svg);

  const meta = document.createElement("span");
  meta.className = "collection-card-meta";
  const name = document.createElement("span");
  name.className = "collection-card-name";
  name.textContent = card.name;
  name.title = card.name;
  const cost = document.createElement("span");
  cost.className = "collection-card-cost";
  cost.textContent = cardCostLabel(card);
  // Un terrain ne coûte rien : sa pastille annonce ce qu'il produit, dans les
  // mêmes termes que le moteur, jamais un coût.
  cost.classList.toggle("is-land", card.category === "land");
  cost.title = card.category === "land" ? describeLandProduction(card) : describeManaCost(card);
  const type = document.createElement("span");
  type.className = "collection-card-type";
  type.textContent = `${card.family} · ${card.type}`;
  type.title = type.textContent;

  meta.append(name, cost, type);
  const button = document.createElement("button");
  button.className = "collection-card-open";
  button.type = "button";
  button.setAttribute("aria-label", `Voir ${card.name}`);
  button.addEventListener("click", () => openModal(card, button));
  article.append(art, meta, button);
  return article;
}

function activeFilterText() {
  const parts = [];
  if (state.category !== "all") parts.push(CATEGORY_LABELS[state.category]);
  if (state.family !== "all") parts.push(state.family);
  if (state.query.trim()) parts.push(`« ${state.query.trim()} »`);
  return parts.length ? parts.join(" · ") : "Toutes les cartes";
}

function updatePressedState(buttons, value, attribute) {
  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.dataset[attribute] === value));
  }
}

function renderCollection() {
  const visibleCards = filteredCards();
  svgObserver?.disconnect();
  const fragment = document.createDocumentFragment();
  visibleCards.forEach((card, index) => fragment.append(createCardTile(card, index)));
  elements.grid.replaceChildren(fragment);

  const visible = visibleCards.length;
  const total = state.cards.length;
  const plural = visible !== 1;
  elements.resultsCount.textContent = `${visible} carte${plural ? "s" : ""} affichée${plural ? "s" : ""} sur ${total}`;
  elements.activeFilters.textContent = activeFilterText();
  elements.empty.hidden = visible !== 0;
  elements.grid.hidden = visible === 0;
  elements.clearSearch.hidden = state.query.length === 0;
  updatePressedState(elements.categoryButtons, state.category, "category");
  updatePressedState(elements.familyButtons, state.family, "family");
}

function resetFilters() {
  state.category = "all";
  state.family = "all";
  state.query = "";
  state.sort = "name-asc";
  elements.search.value = "";
  elements.sort.value = "name-asc";
  renderCollection();
}

function addModalFact(label, value) {
  if (value === undefined || value === null || value === "") return;
  const wrapper = document.createElement("div");
  wrapper.className = "collection-modal-fact";
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;
  wrapper.append(term, description);
  elements.modalFacts.append(wrapper);
}

function populateModal(card) {
  const url = svgUrl(card);
  elements.modalPanel.style.setProperty("--modal-accent", safeAccent(card.palette?.secondary));
  elements.modalVisual.classList.add("is-loading");
  elements.modalVisual.classList.remove("is-broken");
  const image = document.createElement("object");
  image.id = "modal-card-image";
  image.type = "image/svg+xml";
  image.tabIndex = -1;
  image.setAttribute("role", "img");
  image.setAttribute("aria-label", `Carte ${card.name}`);
  image.addEventListener("load", () => {
    if (elements.modalImage !== image) return;
    elements.modalVisual.classList.remove("is-loading", "is-broken");
    image.classList.add("is-loaded");
  });
  image.addEventListener("error", () => {
    if (elements.modalImage !== image) return;
    showModalImageFallback(image, card);
  });
  elements.modalImage.replaceWith(image);
  elements.modalImage = image;
  resolveSvgUrl(url)
    .then((resolvedUrl) => {
      if (elements.modalImage === image) image.data = resolvedUrl;
    })
    .catch((error) => {
      console.warn("Impossible de charger l'aperçu SVG", url, error);
      showModalImageFallback(image, card);
    });
  elements.modalEyebrow.textContent = `${categorySingular(card.category)} · ${card.family}`;
  elements.modalTitle.textContent = card.name;
  elements.modalSubtitle.textContent = card.subtitle || "";
  elements.modalFacts.replaceChildren();
  addModalFact("Type", card.type);
  addModalFact(
    card.category === "land" ? "Production" : "Coût en mana",
    card.category === "land" ? describeLandProduction(card) : describeManaCost(card)
  );
  if (card.category === "creature") {
    addModalFact("Attaque", card.attack);
    addModalFact("Vie", card.life);
  }
  elements.modalAbilityName.textContent = card.abilityName || "";
  elements.modalAbilityText.textContent = card.abilityText || "";
  elements.modalKeywords.replaceChildren();
  for (const keyword of card.keywords || []) {
    const chip = document.createElement("span");
    chip.textContent = keyword;
    elements.modalKeywords.append(chip);
  }
  elements.modalKeywords.hidden = !card.keywords?.length;
  elements.modalFlavor.textContent = card.flavor || "";
  elements.modalFlavor.hidden = !card.flavor;
  elements.modalDownload.href = url;
  elements.modalDownload.download = svgFileName(card.name);
}

function showModalImageFallback(image, card) {
  if (elements.modalImage !== image || !image.isConnected || !card?.image) return;

  const fallback = document.createElement("img");
  fallback.id = "modal-card-image";
  fallback.className = "collection-modal-fallback";
  fallback.alt = `Illustration de ${card.name}`;
  fallback.decoding = "async";
  fallback.addEventListener("load", () => {
    if (elements.modalImage !== fallback) return;
    elements.modalVisual.classList.remove("is-loading", "is-broken");
    fallback.classList.add("is-loaded");
  });
  fallback.addEventListener("error", () => {
    if (elements.modalImage !== fallback) return;
    elements.modalVisual.classList.remove("is-loading");
    elements.modalVisual.classList.add("is-broken");
    fallback.classList.add("is-broken");
  });
  image.replaceWith(fallback);
  elements.modalImage = fallback;
  fallback.src = sourceImageUrl(card);
}

function openModal(card, trigger) {
  state.activeCard = card;
  state.previousFocus = trigger || document.activeElement;
  populateModal(card);
  elements.modal.hidden = false;
  elements.modal.setAttribute("aria-hidden", "false");
  for (const region of elements.pageRegions) {
    region.setAttribute("inert", "");
    region.setAttribute("aria-hidden", "true");
  }
  document.body.classList.add("collection-modal-open");
  requestAnimationFrame(() => {
    elements.modal.classList.add("is-open");
    elements.modalClose.focus();
  });
}

function closeModal() {
  if (elements.modal.hidden) return;
  elements.modal.classList.remove("is-open");
  elements.modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("collection-modal-open");
  window.setTimeout(() => {
    elements.modal.hidden = true;
    elements.modalImage.removeAttribute("data");
    elements.modalImage.setAttribute("aria-label", "");
    elements.modalImage.classList.remove("is-loaded", "is-broken");
    elements.modalVisual.classList.remove("is-loading", "is-broken");
    for (const region of elements.pageRegions) {
      region.removeAttribute("inert");
      region.removeAttribute("aria-hidden");
    }
    state.previousFocus?.focus?.();
    state.activeCard = null;
  }, 190);
}

function trapModalFocus(event) {
  if (event.key !== "Tab" || elements.modal.hidden) return;
  const focusable = [...elements.modalPanel.querySelectorAll("button, a[href]")]
    .filter((element) => !element.hasAttribute("disabled"));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function bindEvents() {
  elements.search.addEventListener("input", (event) => {
    state.query = event.currentTarget.value;
    renderCollection();
  });
  elements.clearSearch.addEventListener("click", () => {
    state.query = "";
    elements.search.value = "";
    elements.search.focus();
    renderCollection();
  });
  elements.sort.addEventListener("change", (event) => {
    state.sort = event.currentTarget.value;
    renderCollection();
  });
  for (const button of elements.categoryButtons) {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      renderCollection();
    });
  }
  for (const button of elements.familyButtons) {
    button.addEventListener("click", () => {
      state.family = button.dataset.family;
      renderCollection();
    });
  }
  elements.headerReset.addEventListener("click", resetFilters);
  elements.emptyReset.addEventListener("click", resetFilters);
  elements.retryLoad.addEventListener("click", loadCollection);
  elements.modalClose.addEventListener("click", closeModal);
  elements.modal.querySelector("[data-close-modal]").addEventListener("click", closeModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.modal.hidden) closeModal();
    trapModalFocus(event);
  });
}

async function loadCollection() {
  elements.loading.hidden = false;
  elements.error.hidden = true;
  elements.empty.hidden = true;
  elements.grid.hidden = true;
  try {
    state.cards = await fetchCollection();
    elements.headerTotal.textContent = state.cards.length;
    elements.collectionTotal.textContent = `${state.cards.length} cartes disponibles`;
    elements.loading.hidden = true;
    renderCollection();
  } catch (error) {
    console.error("Impossible de charger la collection Spellaho", error);
    elements.loading.hidden = true;
    elements.error.hidden = false;
    elements.resultsCount.textContent = "Collection indisponible";
    elements.activeFilters.textContent = "";
  }
}

bindEvents();
loadCollection();
