const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT || process.argv[2] || 4173);
// N'importe quel code a quatre chiffres ouvre son propre salon : un code
// unique partage par tout le monde faisait entrer en collision deux parties
// simultanees, chacune ecrasant l'etat de l'autre.
const ROOM_CODE_PATTERN = /^\d{4}$/;
// Un salon oublie n'a aucune raison de rester en memoire.
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
// Au-dela de ce silence, la place d'un joueur est rendue : sans cela, un
// onglet ferme condamnait le salon a rester plein jusqu'au redemarrage.
const SLOT_TIMEOUT_MS = 60 * 1000;
const rooms = new Map();

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg"
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error("Payload trop volumineux"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function normalizeProfile(body) {
  return {
    id: String(body.playerId || crypto.randomUUID()),
    name: String(body.name || "Joueur").trim().slice(0, 24) || "Joueur",
    avatar: String(body.avatar || "Images/Marinéhote de Elturel.png"),
    deckId: String(body.deckId || "blanc-vert"),
    connectedAt: Date.now(),
    lastSeen: Date.now()
  };
}

// Renvoie le code s'il est valide, sinon null : la validation du format
// remplace la comparaison a un code unique.
function normalizeCode(value) {
  const code = String(value || "").trim();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

function purgeRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.updatedAt > ROOM_TTL_MS) rooms.delete(code);
  }
}

function getRoom(code) {
  if (!rooms.has(code)) {
    rooms.set(code, {
      code,
      players: {},
      state: null,
      version: 0,
      updatedAt: Date.now()
    });
  }
  return rooms.get(code);
}

// Libere les places dont le joueur ne donne plus signe de vie, pour qu'il
// puisse revenir depuis un onglet neuf sans etre refuse par son propre salon.
function releaseStaleSlots(room) {
  const now = Date.now();
  for (const [slot, player] of Object.entries(room.players)) {
    if (player && now - (player.lastSeen || 0) > SLOT_TIMEOUT_MS) delete room.players[slot];
  }
}

function publicRoom(room) {
  return {
    code: room.code,
    version: room.version,
    players: room.players,
    state: room.state,
    updatedAt: room.updatedAt
  };
}

function findPlayerSlot(room, playerId) {
  return Object.entries(room.players).find(([, player]) => player && player.id === playerId)?.[0] || null;
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/room/join" && req.method === "POST") {
    const body = await readJsonBody(req);
    const code = normalizeCode(body.code);
    if (!code) {
      sendJson(res, 403, { error: "Code de salon invalide : il faut quatre chiffres." });
      return true;
    }

    purgeRooms();
    const room = getRoom(code);
    const profile = normalizeProfile(body);
    let slot = findPlayerSlot(room, profile.id);

    if (!slot) {
      releaseStaleSlots(room);
      if (!room.players.player) slot = "player";
      else if (!room.players.enemy) slot = "enemy";
      else {
        sendJson(res, 409, { error: `Le salon ${code} a deja deux joueurs. Choisis un autre code a quatre chiffres.` });
        return true;
      }
    }

    room.players[slot] = { ...profile, slot, lastSeen: Date.now() };
    room.updatedAt = Date.now();

    sendJson(res, 200, {
      playerId: room.players[slot].id,
      slot,
      room: publicRoom(room)
    });
    return true;
  }

  if (url.pathname === "/api/room/state" && req.method === "GET") {
    const code = normalizeCode(url.searchParams.get("code"));
    if (!code) {
      sendJson(res, 403, { error: "Code de salon invalide." });
      return true;
    }

    const room = getRoom(code);
    const playerId = String(url.searchParams.get("playerId") || "");
    const slot = findPlayerSlot(room, playerId);
    if (slot) room.players[slot].lastSeen = Date.now();
    sendJson(res, 200, { slot, room: publicRoom(room) });
    return true;
  }

  if (url.pathname === "/api/room/state" && req.method === "POST") {
    const body = await readJsonBody(req);
    const code = normalizeCode(body.code);
    if (!code) {
      sendJson(res, 403, { error: "Code de salon invalide." });
      return true;
    }

    const room = getRoom(code);
    const slot = findPlayerSlot(room, String(body.playerId || ""));
    if (!slot) {
      sendJson(res, 403, { error: "Joueur non reconnu dans le salon." });
      return true;
    }

    const clientVersion = Number(body.version);
    if (Number.isFinite(clientVersion) && clientVersion !== room.version) {
      sendJson(res, 409, {
        error: "État obsolète : la partie a déjà avancé.",
        version: room.version,
        room: publicRoom(room)
      });
      return true;
    }

    room.players[slot].lastSeen = Date.now();
    room.state = body.state || null;
    room.version += 1;
    room.updatedAt = Date.now();
    sendJson(res, 200, { version: room.version, room: publicRoom(room) });
    return true;
  }

  if (url.pathname === "/api/room/reset" && req.method === "POST") {
    const body = await readJsonBody(req);
    const code = normalizeCode(body.code);
    if (!code) {
      sendJson(res, 403, { error: "Code de salon invalide." });
      return true;
    }
    rooms.delete(code);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url);
      if (handled) return;
      sendJson(res, 404, { error: "API introuvable" });
      return;
    }

    const rawPath = decodeURIComponent(url.pathname);
    const requested = rawPath === "/" ? "/index.html" : rawPath;
    const filePath = path.normalize(path.join(root, requested));

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Fichier introuvable");
        return;
      }

      res.writeHead(200, {
        "content-type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store"
      });
      res.end(data);
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Erreur serveur" });
  }
});

server.listen(port, () => {
  console.log(`Jeu disponible sur http://localhost:${port}`);
  console.log("Salon multijoueur local: choisis n'importe quel code a quatre chiffres");
});
