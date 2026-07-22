const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT || process.argv[2] || 4173);
const ROOM_CODE = "1234";
const rooms = new Map();

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8"
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
    if (String(body.code || "") !== ROOM_CODE) {
      sendJson(res, 403, { error: "Code de salon invalide. Pour l'instant, le code est 1234." });
      return true;
    }

    const room = getRoom(ROOM_CODE);
    const profile = normalizeProfile(body);
    let slot = findPlayerSlot(room, profile.id);

    if (!slot) {
      if (!room.players.player) slot = "player";
      else if (!room.players.enemy) slot = "enemy";
      else {
        sendJson(res, 409, { error: "Le salon 1234 a deja deux joueurs. Relance le serveur pour repartir d'une table vide." });
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
    const code = String(url.searchParams.get("code") || "");
    if (code !== ROOM_CODE) {
      sendJson(res, 403, { error: "Code de salon invalide." });
      return true;
    }

    const room = getRoom(ROOM_CODE);
    const playerId = String(url.searchParams.get("playerId") || "");
    const slot = findPlayerSlot(room, playerId);
    if (slot) room.players[slot].lastSeen = Date.now();
    sendJson(res, 200, { slot, room: publicRoom(room) });
    return true;
  }

  if (url.pathname === "/api/room/state" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (String(body.code || "") !== ROOM_CODE) {
      sendJson(res, 403, { error: "Code de salon invalide." });
      return true;
    }

    const room = getRoom(ROOM_CODE);
    const slot = findPlayerSlot(room, String(body.playerId || ""));
    if (!slot) {
      sendJson(res, 403, { error: "Joueur non reconnu dans le salon." });
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
    if (String(body.code || "") !== ROOM_CODE) {
      sendJson(res, 403, { error: "Code de salon invalide." });
      return true;
    }
    rooms.delete(ROOM_CODE);
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
  console.log("Salon multijoueur local: code 1234");
});
