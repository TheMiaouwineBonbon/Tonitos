// =====================================================================
// Spellaho - Moteur sonore
// ---------------------------------------------------------------------
// Synthese procedurale Web Audio : aucun fichier externe n'est requis.
// Chaque entree du registre expose soit une recette procedurale, soit un
// chemin de fichier. Remplacer un son procedural par un vrai asset se fait
// en changeant `{ render: ... }` en `{ file: "Sons/attaque.ogg" }`, sans
// toucher au code appelant.
//
// API publique : sound.play(name, opts), sound.stop(name), sound.preload(),
// sound.setVolume(bus, valeur), sound.unlock().
// =====================================================================

const BUS_DEFAULTS = { master: 0.9, music: 0.32, sfx: 0.75 };
const MAX_VOICES = 14;           // voix simultanees toutes categories
const MAX_VOICES_PER_SOUND = 3;  // evite l'empilement du meme effet
const STORAGE_KEY = "spellaho-audio-prefs";

// --- Primitives de synthese -------------------------------------------

// Bruit blanc reutilise : un seul buffer sert toutes les recettes.
let sharedNoise = null;
function noiseBuffer(ctx) {
  if (sharedNoise) return sharedNoise;
  const frames = Math.floor(ctx.sampleRate * 1.2);
  sharedNoise = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = sharedNoise.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
  return sharedNoise;
}

// Enveloppe percussive : attaque courte puis decroissance exponentielle.
function shape(gainNode, ctx, start, { attack = 0.006, hold = 0, decay = 0.2, peak = 1 }) {
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, start);
  g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + attack);
  if (hold > 0) g.setValueAtTime(Math.max(peak, 0.0002), start + attack + hold);
  g.exponentialRampToValueAtTime(0.0001, start + attack + hold + decay);
  return start + attack + hold + decay;
}

// Oscillateur simple, avec balayage de hauteur optionnel.
function tone(ctx, dest, start, spec) {
  const { freq, type = "sine", dur = 0.2, gain = 0.3, sweepTo = null, detune = 0 } = spec;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, start);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(sweepTo, 1), start + dur);
  const end = shape(amp, ctx, start, { ...spec, decay: dur, peak: gain });
  osc.connect(amp).connect(dest);
  osc.start(start);
  osc.stop(end + 0.02);
  return end;
}

// Souffle filtre : sert pour le metal, la pierre, le cuir et la poussiere.
function noise(ctx, dest, start, spec) {
  const {
    dur = 0.2, gain = 0.3, filter = "bandpass",
    freq = 1200, q = 1.2, sweepTo = null
  } = spec;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.frequency.setValueAtTime(freq, start);
  biquad.Q.value = q;
  if (sweepTo) biquad.frequency.exponentialRampToValueAtTime(Math.max(sweepTo, 20), start + dur);
  const amp = ctx.createGain();
  const end = shape(amp, ctx, start, { ...spec, decay: dur, peak: gain });
  src.connect(biquad).connect(amp).connect(dest);
  src.start(start);
  src.stop(end + 0.02);
  return end;
}

// Suite de notes : arpeges de victoire, glas, cor de debut de tour.
function sequence(ctx, dest, start, notes) {
  let end = start;
  for (const note of notes) {
    const at = start + (note.at || 0);
    end = Math.max(end, tone(ctx, dest, at, note));
  }
  return end;
}

// --- Registre des sons -------------------------------------------------
// Timbres dark fantasy : metal, pierre, cuir, magie, energie sombre.
// Duree cible 150-350 ms pour ne pas ralentir le rythme de jeu.

export const SOUND_LIBRARY = {
  // Cartes et main
  "card.draw": { bus: "sfx", render: (c, d, t) =>
    noise(c, d, t, { dur: 0.17, gain: 0.16, filter: "highpass", freq: 900, sweepTo: 2600 }) },
  "card.appear": { bus: "sfx", render: (c, d, t) => {
    noise(c, d, t, { dur: 0.12, gain: 0.1, filter: "highpass", freq: 1400 });
    return tone(c, d, t + 0.02, { freq: 880, type: "triangle", dur: 0.12, gain: 0.06 });
  } },
  "card.select": { bus: "sfx", render: (c, d, t) => {
    noise(c, d, t, { dur: 0.05, gain: 0.12, filter: "bandpass", freq: 2200, q: 2 });
    return tone(c, d, t, { freq: 620, type: "triangle", dur: 0.09, gain: 0.09 });
  } },
  "card.deselect": { bus: "sfx", render: (c, d, t) =>
    tone(c, d, t, { freq: 460, type: "triangle", dur: 0.1, gain: 0.07, sweepTo: 300 }) },
  "card.move": { bus: "sfx", render: (c, d, t) =>
    noise(c, d, t, { dur: 0.1, gain: 0.07, filter: "bandpass", freq: 1600, q: 0.8 }) },
  "card.place": { bus: "sfx", render: (c, d, t) => {
    noise(c, d, t, { dur: 0.13, gain: 0.16, filter: "lowpass", freq: 900, sweepTo: 260 });
    return tone(c, d, t, { freq: 140, type: "sine", dur: 0.16, gain: 0.22, sweepTo: 80 });
  } },

  // Invocations et sorts
  "creature.summon": { bus: "sfx", render: (c, d, t) => {
    tone(c, d, t, { freq: 220, type: "sawtooth", dur: 0.34, gain: 0.1, sweepTo: 660 });
    tone(c, d, t + 0.04, { freq: 330, type: "sine", dur: 0.3, gain: 0.09, sweepTo: 990 });
    return noise(c, d, t, { dur: 0.32, gain: 0.09, filter: "bandpass", freq: 600, sweepTo: 3200, q: 0.7 });
  } },
  "spell.cast": { bus: "sfx", render: (c, d, t) => {
    tone(c, d, t, { freq: 520, type: "sawtooth", dur: 0.3, gain: 0.11, sweepTo: 130, detune: 8 });
    return noise(c, d, t, { dur: 0.3, gain: 0.1, filter: "bandpass", freq: 2400, sweepTo: 400, q: 1.4 });
  } },
  "effect.trigger": { bus: "sfx", render: (c, d, t) => {
    tone(c, d, t, { freq: 1046, type: "triangle", dur: 0.22, gain: 0.08 });
    return tone(c, d, t + 0.03, { freq: 1568, type: "sine", dur: 0.2, gain: 0.05 });
  } },

  // Combat
  "attack.creature": { bus: "sfx", render: (c, d, t) =>
    noise(c, d, t, { dur: 0.16, gain: 0.2, filter: "bandpass", freq: 3200, sweepTo: 1200, q: 1.6 }) },
  "attack.hero": { bus: "sfx", render: (c, d, t) => {
    noise(c, d, t, { dur: 0.2, gain: 0.22, filter: "bandpass", freq: 2600, sweepTo: 700, q: 1.4 });
    return tone(c, d, t + 0.03, { freq: 160, type: "sine", dur: 0.2, gain: 0.16, sweepTo: 70 });
  } },
  "attack.impact": { bus: "sfx", render: (c, d, t) => {
    noise(c, d, t, { dur: 0.14, gain: 0.24, filter: "lowpass", freq: 1800, sweepTo: 200 });
    return tone(c, d, t, { freq: 110, type: "sine", dur: 0.18, gain: 0.24, sweepTo: 55 });
  } },
  "damage.taken": { bus: "sfx", render: (c, d, t) =>
    tone(c, d, t, { freq: 95, type: "sawtooth", dur: 0.24, gain: 0.16, sweepTo: 48 }) },
  "creature.death": { bus: "sfx", render: (c, d, t) => {
    noise(c, d, t, { dur: 0.42, gain: 0.14, filter: "bandpass", freq: 1800, sweepTo: 160, q: 0.6 });
    return tone(c, d, t + 0.05, { freq: 180, type: "sawtooth", dur: 0.36, gain: 0.09, sweepTo: 60 });
  } },
  "hero.death": { bus: "sfx", render: (c, d, t) => sequence(c, d, t, [
    { at: 0, freq: 146, type: "sine", dur: 0.5, gain: 0.2 },
    { at: 0.12, freq: 110, type: "sine", dur: 0.6, gain: 0.18 },
    { at: 0.26, freq: 73, type: "sine", dur: 0.7, gain: 0.16 }
  ]) },

  // Vie et ressources
  "life.gain": { bus: "sfx", render: (c, d, t) =>
    tone(c, d, t, { freq: 392, type: "sine", dur: 0.26, gain: 0.1, sweepTo: 784 }) },
  "life.loss": { bus: "sfx", render: (c, d, t) =>
    tone(c, d, t, { freq: 392, type: "sine", dur: 0.26, gain: 0.1, sweepTo: 174 }) },
  "resource.gain": { bus: "sfx", render: (c, d, t) => {
    tone(c, d, t, { freq: 880, type: "triangle", dur: 0.16, gain: 0.08 });
    return tone(c, d, t + 0.04, { freq: 1320, type: "sine", dur: 0.14, gain: 0.05 });
  } },
  "resource.spend": { bus: "sfx", render: (c, d, t) =>
    tone(c, d, t, { freq: 660, type: "triangle", dur: 0.14, gain: 0.07, sweepTo: 330 }) },

  // Tours et fins de partie
  "turn.start": { bus: "sfx", render: (c, d, t) => sequence(c, d, t, [
    { at: 0, freq: 294, type: "sawtooth", dur: 0.3, gain: 0.09 },
    { at: 0.1, freq: 440, type: "sawtooth", dur: 0.32, gain: 0.08 }
  ]) },
  "turn.end": { bus: "sfx", render: (c, d, t) =>
    tone(c, d, t, { freq: 196, type: "sine", dur: 0.34, gain: 0.13, sweepTo: 130 }) },
  "game.victory": { bus: "sfx", render: (c, d, t) => sequence(c, d, t, [
    { at: 0, freq: 523, type: "triangle", dur: 0.34, gain: 0.12 },
    { at: 0.11, freq: 659, type: "triangle", dur: 0.34, gain: 0.12 },
    { at: 0.22, freq: 784, type: "triangle", dur: 0.44, gain: 0.13 },
    { at: 0.33, freq: 1046, type: "sine", dur: 0.5, gain: 0.1 }
  ]) },
  "game.defeat": { bus: "sfx", render: (c, d, t) => sequence(c, d, t, [
    { at: 0, freq: 415, type: "sawtooth", dur: 0.4, gain: 0.11 },
    { at: 0.14, freq: 311, type: "sawtooth", dur: 0.44, gain: 0.11 },
    { at: 0.3, freq: 207, type: "sine", dur: 0.6, gain: 0.13 }
  ]) },

  // Interface
  "ui.menuOpen": { bus: "sfx", render: (c, d, t) => {
    noise(c, d, t, { dur: 0.18, gain: 0.08, filter: "highpass", freq: 800, sweepTo: 2400 });
    return tone(c, d, t + 0.03, { freq: 587, type: "triangle", dur: 0.16, gain: 0.06 });
  } },
  "ui.menuClose": { bus: "sfx", render: (c, d, t) =>
    tone(c, d, t, { freq: 587, type: "triangle", dur: 0.15, gain: 0.06, sweepTo: 294 }) },
  // Refus : timbre mat et bas, sans agressivite.
  "ui.reject": { bus: "sfx", render: (c, d, t) => {
    noise(c, d, t, { dur: 0.1, gain: 0.09, filter: "lowpass", freq: 900, sweepTo: 260 });
    return tone(c, d, t, { freq: 196, type: "square", dur: 0.13, gain: 0.07, sweepTo: 130 });
  } },
  "reward.open": { bus: "sfx", render: (c, d, t) => {
    noise(c, d, t, { dur: 0.4, gain: 0.1, filter: "bandpass", freq: 900, sweepTo: 4200, q: 0.7 });
    return sequence(c, d, t, [
      { at: 0.02, freq: 659, type: "triangle", dur: 0.3, gain: 0.1 },
      { at: 0.13, freq: 988, type: "triangle", dur: 0.34, gain: 0.1 },
      { at: 0.24, freq: 1318, type: "sine", dur: 0.4, gain: 0.08 }
    ]);
  } }
};

// --- Gestionnaire ------------------------------------------------------

class SoundManager {
  constructor(library = SOUND_LIBRARY) {
    this.library = library;
    this.ctx = null;
    this.buses = {};
    this.volumes = { ...BUS_DEFAULTS, ...readStoredVolumes() };
    this.muted = false;
    this.active = new Map();   // nom -> nombre de voix en cours
    this.voices = 0;
    this.buffers = new Map();  // cache des sons charges depuis un fichier
    this.unlocked = false;
  }

  // Cree le contexte au premier geste : les navigateurs mobiles refusent
  // toute lecture avant une interaction.
  unlock() {
    if (this.unlocked) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    const master = this.ctx.createGain();
    master.gain.value = this.volumes.master;
    master.connect(this.ctx.destination);
    for (const name of ["music", "sfx"]) {
      const bus = this.ctx.createGain();
      bus.gain.value = this.volumes[name];
      bus.connect(master);
      this.buses[name] = bus;
    }
    this.buses.master = master;
    this.unlocked = true;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  setVolume(bus, value) {
    const clamped = Math.min(1, Math.max(0, Number(value) || 0));
    this.volumes[bus] = clamped;
    if (this.buses[bus]) this.buses[bus].gain.value = clamped;
    storeVolumes(this.volumes);
  }

  getVolume(bus) {
    return this.volumes[bus] ?? 0;
  }

  setMuted(flag) {
    this.muted = Boolean(flag);
    if (this.buses.master) this.buses.master.gain.value = this.muted ? 0 : this.volumes.master;
  }

  // Precharge les sons bases sur des fichiers. Les recettes procedurales
  // n'ont rien a charger : l'appel reste valide et ne coute rien.
  async preload(names = Object.keys(this.library)) {
    this.unlock();
    if (!this.ctx) return;
    const jobs = names
      .map((name) => [name, this.library[name]])
      .filter(([, entry]) => entry?.file && !this.buffers.has(entry.file))
      .map(async ([, entry]) => {
        try {
          const res = await fetch(entry.file);
          const raw = await res.arrayBuffer();
          this.buffers.set(entry.file, await this.ctx.decodeAudioData(raw));
        } catch {
          // Un asset manquant ne doit jamais casser la partie.
        }
      });
    await Promise.all(jobs);
  }

  // opts.pitch force la hauteur ; sinon variation aleatoire pour eviter
  // la repetition mecanique du meme effet.
  play(name, opts = {}) {
    const entry = this.library[name];
    if (!entry || this.muted) return false;
    this.unlock();
    if (!this.ctx || this.ctx.state === "closed") return false;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});

    const running = this.active.get(name) || 0;
    if (this.voices >= MAX_VOICES || running >= MAX_VOICES_PER_SOUND) return false;

    const bus = this.buses[entry.bus || "sfx"] || this.buses.sfx;
    const gain = this.ctx.createGain();
    gain.gain.value = opts.volume ?? 1;
    gain.connect(bus);

    const start = this.ctx.currentTime + 0.001;
    const detune = opts.pitch ?? (1 + (Math.random() * 2 - 1) * (entry.variation ?? 0.06));
    let end = start;

    if (entry.file && this.buffers.has(entry.file)) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers.get(entry.file);
      src.playbackRate.value = detune;
      src.connect(gain);
      src.start(start);
      end = start + src.buffer.duration / detune;
    } else if (typeof entry.render === "function") {
      // La variation de hauteur passe par un detune global du sous-graphe.
      const shifted = this.ctx.createGain();
      shifted.connect(gain);
      end = entry.render(this.ctx, shifted, start, detune) || start + 0.3;
    } else {
      return false;
    }

    this.voices += 1;
    this.active.set(name, running + 1);
    const release = () => {
      this.voices = Math.max(0, this.voices - 1);
      this.active.set(name, Math.max(0, (this.active.get(name) || 1) - 1));
      try { gain.disconnect(); } catch {}
    };
    window.setTimeout(release, Math.max(60, (end - start) * 1000 + 120));
    return true;
  }

  // Coupe net toutes les voix : changement de scene, retour au menu.
  stop() {
    if (!this.ctx) return;
    for (const name of ["music", "sfx"]) {
      const bus = this.buses[name];
      if (!bus) continue;
      bus.gain.setValueAtTime(0, this.ctx.currentTime);
      bus.gain.setTargetAtTime(this.volumes[name], this.ctx.currentTime + 0.05, 0.02);
    }
    this.active.clear();
    this.voices = 0;
  }
}

function readStoredVolumes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function storeVolumes(volumes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(volumes));
  } catch {
    // Mode navigation privee : on continue sans persistance.
  }
}

export const sound = new SoundManager();

// =====================================================================
// MUSIQUE
// ---------------------------------------------------------------------
// Les pistes sont lues via un element <audio>, pas via decodeAudioData :
// un morceau de 6 Mo occuperait environ 60 Mo une fois decode en memoire,
// alors que l'element streame progressivement.
// Chaque piste est un theme nomme du jeu ; la repartition menu/partie est
// declarative, et le choix se fait au hasard dans le lot concerne.
// =====================================================================

const DOSSIER_MUSIQUE = "Sons/Musiques";

export const MUSIC_TRACKS = [
  { id: "accueil", nom: "Accueil", scenes: ["menu"] },
  { id: "repos-merite", nom: "Repos mérité", scenes: ["menu"] },
  { id: "le-sanctuaire", nom: "Le sanctuaire", scenes: ["menu"] },
  { id: "monde-englouti", nom: "Monde englouti", scenes: ["menu", "game"] },
  { id: "amour-d-aldia", nom: "Amour d'Aldia", scenes: ["menu", "game"] },
  { id: "cite-aethran", nom: "Cité Aethran", scenes: ["game"] },
  { id: "balade-de-rena", nom: "Balade de Rena", scenes: ["game"] },
  { id: "elfe-theme", nom: "Elfe", scenes: ["game"] },
  { id: "argonien-theme", nom: "Argonien", scenes: ["game"] },
  { id: "tristesse-d-umi", nom: "Tristesse d'UMI", scenes: ["game"] },
  { id: "khajiit-theme", nom: "Khajiit", scenes: ["game"] },
  { id: "mystery", nom: "Mystery", scenes: ["game"] },
  { id: "danse-de-la-magicienne", nom: "Danse de la magicienne", scenes: ["game"] },
  { id: "marche-du-robot", nom: "Marche du robot", scenes: ["game"] },
  { id: "le-gardien", nom: "Le Gardien", scenes: ["game"] },
  { id: "parasite-theme", nom: "Parasite", scenes: ["game"] },
  { id: "secret-de-daemond", nom: "Secret de Daemond", scenes: ["game"] },
  { id: "ranch-des-chevaliers", nom: "Ranch des Chevaliers", scenes: ["game"] },
  { id: "marinehote-theme", nom: "Marinéhote", scenes: ["game"] },
  { id: "l-amour-du-guerrier", nom: "L'amour du Guerrier", scenes: ["game"] },
  { id: "le-chevalier-errant", nom: "Le Chevalier Errant", scenes: ["game"] },
  { id: "le-p-tit-robot", nom: "Le p'tit Robot", scenes: ["game"] },
  { id: "retour-du-hero", nom: "Retour du héros", scenes: ["game"] }
];

class MusicPlayer {
  constructor() {
    this.element = null;
    this.scene = null;
    this.piste = null;
    this.derniereId = null;
    this.fondu = null;
  }

  get volume() {
    return sound.getVolume("music") * sound.getVolume("master") * (sound.muted ? 0 : 1);
  }

  ensureElement() {
    if (this.element) return this.element;
    const el = new Audio();
    el.preload = "none";
    el.volume = 0;
    // Enchaînement : à la fin d'une piste, une autre du même lot démarre.
    el.addEventListener("ended", () => this.play(this.scene));
    // Un asset manquant ne doit jamais bloquer le jeu.
    el.addEventListener("error", () => { this.piste = null; });
    // Attaché au document : un Audio() détaché fonctionne, mais reste
    // invisible aux tests et aux outils de développement.
    el.id = "music-player";
    el.hidden = true;
    document.body.append(el);
    this.element = el;
    return el;
  }

  // Choisit une piste au hasard dans la scène, sans répéter la précédente.
  choisir(scene) {
    const lot = MUSIC_TRACKS.filter((t) => t.scenes.includes(scene));
    if (lot.length === 0) return null;
    const dispo = lot.length > 1 ? lot.filter((t) => t.id !== this.derniereId) : lot;
    return dispo[Math.floor(Math.random() * dispo.length)];
  }

  play(scene = "menu") {
    const piste = this.choisir(scene);
    if (!piste) return null;
    this.scene = scene;
    this.piste = piste;
    this.derniereId = piste.id;
    const el = this.ensureElement();
    el.src = `./${DOSSIER_MUSIQUE}/${piste.id}.mp3`;
    el.currentTime = 0;
    el.volume = 0;
    const lecture = el.play();
    // La lecture est refusée tant que l'utilisateur n'a pas interagi :
    // ce n'est pas une erreur, on retentera au premier geste.
    if (lecture?.catch) lecture.catch(() => {});
    this.fondreVers(this.volume, 900);
    return piste;
  }

  // Fondu par paliers : évite un démarrage brutal en pleine partie.
  fondreVers(cible, duree = 600) {
    const el = this.element;
    if (!el) return;
    window.clearInterval(this.fondu);
    const depart = el.volume;
    const pas = 40;
    let ecoule = 0;
    this.fondu = window.setInterval(() => {
      ecoule += pas;
      const k = Math.min(1, ecoule / duree);
      el.volume = Math.max(0, Math.min(1, depart + (cible - depart) * k));
      if (k >= 1) window.clearInterval(this.fondu);
    }, pas);
  }

  stop({ fondu = true } = {}) {
    const el = this.element;
    if (!el) return;
    if (!fondu) { el.pause(); return; }
    this.fondreVers(0, 500);
    window.setTimeout(() => el.pause(), 540);
  }

  // Rejoué quand les réglages de volume changent.
  refreshVolume() {
    if (this.element && !this.element.paused) this.fondreVers(this.volume, 200);
  }
}

export const music = new MusicPlayer();

// Le navigateur refuse la lecture avant un geste : on relance au premier.
for (const type of ["pointerdown", "keydown"]) {
  window.addEventListener(type, () => {
    if (music.element?.paused && music.piste) {
      music.element.play().catch(() => {});
      music.fondreVers(music.volume, 600);
    }
  }, { once: true, passive: true });
}

// Deverrouillage au premier geste, quel qu'il soit.
for (const type of ["pointerdown", "keydown"]) {
  window.addEventListener(type, () => sound.unlock(), { once: true, passive: true });
}
