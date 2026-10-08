import http from "http";
import fs from "fs";
import path from "path";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 10000;
const ROOT = process.cwd();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg"
};

const server = http.createServer((req, res) => {
  try {
    let reqPath = decodeURIComponent((req.url || "/").split("?")[0]);

    if (reqPath === "/") {
      reqPath = "/index.html";
    }

    const filePath = path.resolve(ROOT, "." + reqPath);

    // Proteção contra acesso fora da pasta do projeto
    if (
      !filePath.startsWith(ROOT + path.sep) &&
      filePath !== ROOT
    ) {
      res.writeHead(403, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      return res.end("Forbidden");
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        const status = err.code === "ENOENT" ? 404 : 500;

        res.writeHead(status, {
          "Content-Type": "text/plain; charset=utf-8"
        });

        return res.end(
          status === 404
            ? "Arquivo não encontrado"
            : "Erro interno do servidor"
        );
      }

      const extension = path.extname(filePath).toLowerCase();

      res.writeHead(200, {
        "Content-Type":
          mime[extension] || "application/octet-stream",
        "Cache-Control": "no-cache"
      });

      res.end(data);
    });

  } catch (error) {
    console.error("Erro HTTP:", error);

    res.writeHead(500, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Erro interno do servidor");
  }
});

// WebSocket para comunicação do jogo
const wss = new WebSocketServer({
  server,
  path: "/game"
});

const clients = new Set();

wss.on("connection", (ws) => {
  console.log("Jogador conectado ao WebSocket.");

  clients.add(ws);

  ws.send(
    JSON.stringify({
      type: "connected",
      message: "Conectado ao Futebol de Botão LIVE"
    })
  );

  ws.on("message", (raw) => {
    let message;

    try {
      message = JSON.parse(raw.toString());
    } catch (error) {
      console.log("Mensagem inválida recebida.");
      return;
    }

    console.log("Evento recebido:", message);

    // Envia o evento para todos os jogadores conectados
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(JSON.stringify(message));
      }
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("Jogador desconectado.");
  });

  ws.on("error", (error) => {
    console.error("Erro WebSocket:", error);
    clients.delete(ws);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("======================================");
  console.log(" FUTEBOL DE BOTÃO — TIKTOK LIVE");
  console.log("======================================");
  console.log(`Servidor iniciado na porta ${PORT}`);
  console.log(`WebSocket: /game`);
});
