import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { TikTokLiveClient, EventType } from "piratetok-live-js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 10000);
const USERNAME = (process.env.TIKTOK_USERNAME || "085.game.players")
  .replace(/^@/, "")
  .trim();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".ico": "image/x-icon"
};

const clients = new Set();
let liveStatus = "connecting";

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = path.resolve(ROOT, relative);

  if (!file.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end("Acesso negado");
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      res.end("Arquivo não encontrado: " + relative);
      return;
    }

    res.writeHead(200, {
      "Content-Type": mime[path.extname(file).toLowerCase()] ||
        "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: "/game" });

function broadcast(message) {
  const payload = JSON.stringify(message);

  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

wss.on("connection", ws => {
  clients.add(ws);
  ws.send(JSON.stringify({
    type: "status",
    status: liveStatus,
    username: USERNAME
  }));

  ws.on("close", () => clients.delete(ws));

  // O navegador não pode forçar gols nem simular presentes.
  ws.on("message", () => {});
});

function getUser(data) {
  const u = data?.user || {};
  return {
    username: String(u.uniqueId || u.unique_id || u.nickname || "torcedor")
      .replace(/^@/, ""),
    nickname: u.nickname || u.uniqueId || "Torcedor",
    avatar: u.profilePicture?.url?.[0] ||
      u.profilePictureUrl ||
      u.avatarUrl ||
      u.profile_picture_url ||
      ""
  };
}

function getGiftId(data) {
  const g = data?.gift || data?.giftDetails || {};
  return Number(g.id ?? g.giftId ?? data?.giftId ?? data?.gift_id ?? 0);
}

function getGiftName(data) {
  const g = data?.gift || data?.giftDetails || {};
  return String(g.name || data?.giftName || "Presente");
}

function connectTikTok() {
  const client = new TikTokLiveClient(USERNAME);

  client.on(EventType.like, data => {
    const user = getUser(data);

    // O evento "like" pode conter um total acumulado.
    // O jogo usa apenas o incremento individual recebido.
    const count = Number(data?.count ?? data?.likeCount ?? 1);
    if (count > 0) {
      broadcast({
        type: "like",
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        amount: Math.min(count, 500)
      });
    }
  });

  client.on(EventType.gift, data => {
    const user = getUser(data);
    const giftId = getGiftId(data);
    const gift = data?.gift || data?.giftDetails || {};

    const repeatCount = Number(data?.repeatCount ?? data?.repeat_count ?? 1);
    const isCombo = Boolean(gift?.gift_type === 1);
    const isFinal = data?.repeatEnd === true ||
      data?.repeat_end === true ||
      data?.isFinal === true ||
      !isCombo;

    // Presentes em combo só são contabilizados quando finalizam.
    if (!isFinal) return;

    broadcast({
      type: "gift",
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      giftId,
      giftName: getGiftName(data),
      repeatCount: Math.max(1, repeatCount),
      image: gift?.image?.url_list?.[0] ||
        gift?.image?.urlList?.[0] ||
        gift?.imageUrl ||
        ""
    });
  });

  client.on(EventType.connected, () => {
    liveStatus = "connected";
    broadcast({ type: "status", status: liveStatus, username: USERNAME });
    console.log("TikTok conectado:", USERNAME);
  });

  client.on(EventType.disconnected, data => {
    liveStatus = "disconnected";
    broadcast({
      type: "status",
      status: liveStatus,
      message: String(data?.reason || "Conexão encerrada")
    });
  });

  client.on(EventType.error, error => {
    console.error("Erro TikTok:", error);
  });

  liveStatus = "connecting";

  Promise.resolve(client.connect()).catch(error => {
    liveStatus = "error";
    console.error("Falha ao conectar ao TikTok:", error);
    broadcast({
      type: "status",
      status: liveStatus,
      message: error?.message || "Não foi possível conectar"
    });
  });
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Futebol de Botão disponível na porta ${PORT}`);
  console.log(`LIVE configurada: @${USERNAME}`);
  connectTikTok();
});
