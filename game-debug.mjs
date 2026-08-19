import { validateGameState } from "./engine-core.mjs";

const entries = [];
const MAX_ENTRIES = 300;
let enabled = readInitialState();
let stateReader = null;

function readInitialState() {
  try {
    return new URLSearchParams(globalThis.location?.search || "").has("debug") ||
      globalThis.localStorage?.getItem("spellaho-debug") === "1";
  } catch {
    return false;
  }
}

function clonePayload(payload) {
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return { value: String(payload) };
  }
}

export function debugEvent(type, payload = {}) {
  if (!enabled) return;
  const entry = {
    at: new Date().toISOString(),
    type: String(type),
    payload: clonePayload(payload)
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  console.debug(`[Spellaho] ${entry.type}`, entry.payload);
}

export function debugCheckpoint(game, context = "STATE") {
  if (!enabled || !game?.player || !game?.enemy) return [];
  const errors = validateGameState(game);
  if (errors.length > 0) debugEvent("STATE_INVALID", { context, errors });
  return errors;
}

export function installDebugApi(reader) {
  stateReader = typeof reader === "function" ? reader : null;
  globalThis.SpellahoDebug = Object.freeze({
    enable() {
      enabled = true;
      try { globalThis.localStorage?.setItem("spellaho-debug", "1"); } catch {}
      debugEvent("DEBUG_ENABLED");
    },
    disable() {
      enabled = false;
      try { globalThis.localStorage?.removeItem("spellaho-debug"); } catch {}
    },
    clear() {
      entries.length = 0;
    },
    get events() {
      return entries.map((entry) => clonePayload(entry));
    },
    validate() {
      return stateReader ? validateGameState(stateReader()) : ["Etat non raccordé."];
    },
    // Lecture seule de l'état courant. Sert aux vérifications automatisées
    // (tools/game-tests.mjs) et à l'inspection depuis la console : sans elle,
    // aucun test ne peut affirmer ce que le moteur a réellement fait.
    get state() {
      return stateReader ? stateReader() : null;
    }
  });
}
