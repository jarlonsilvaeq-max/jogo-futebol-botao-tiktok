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
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg"
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (reqPath === "/") reqPath = "/index.html";

  const filePath = path.resolve(ROOT, "." + reqPath);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      return res.end(err.code === "ENOENT" ? "Not found" : "Server error");
    }

    res.writeHead(200, {
      "Content-Type": mime[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: "/game" });
const clients = new Set();

wss.on("connection", ws => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: "connected" }));

  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    for (const client of clients) {
      if (client.readyState === 1) client.send(JSON.stringify(msg));
    }
  });

  ws.on("close", () => clients.delete(ws));
});

server.listen(PORT, () => {
  console.log(`Futebol de Botão LIVE rodando na porta ${PORT}`);
});
