import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const host = process.env.NC03_HOST || "127.0.0.1";
const port = Number(process.env.NC03_PORT || 3006);

const mime = new Map([
  [".html","text/html; charset=utf-8"],
  [".js","text/javascript; charset=utf-8"],
  [".css","text/css; charset=utf-8"],
  [".json","application/json; charset=utf-8"],
  [".webmanifest","application/manifest+json; charset=utf-8"],
  [".svg","image/svg+xml"],
  [".png","image/png"],
  [".jpg","image/jpeg"],
  [".jpeg","image/jpeg"],
  [".ico","image/x-icon"]
]);

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const rel = normalize(decoded).replace(/^([/\\])+/, "");
  const absolute = resolve(join(root, rel || "index.html"));
  if (!absolute.startsWith(root)) return null;
  return absolute;
}

function sendFile(res, file) {
  const headers = {
    "content-type": mime.get(extname(file).toLowerCase()) || "application/octet-stream",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  };
  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  if (!req.url || !["GET","HEAD"].includes(req.method || "GET")) {
    res.writeHead(405, { "content-type":"text/plain; charset=utf-8" });
    res.end("Method Not Allowed");
    return;
  }

  if (req.url === "/_local/health") {
    res.writeHead(200, { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" });
    res.end(JSON.stringify({ ok:true, app:"nc03-control-center", mode:"local", port }));
    return;
  }

  let file = safePath(req.url);
  if (!file) {
    res.writeHead(400, { "content-type":"text/plain; charset=utf-8" });
    res.end("Bad Request");
    return;
  }

  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file) || !statSync(file).isFile()) file = join(root, "index.html");

  if (req.method === "HEAD") {
    res.writeHead(200, {
      "content-type": mime.get(extname(file).toLowerCase()) || "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    });
    res.end();
    return;
  }

  sendFile(res, file);
});

server.listen(port, host, () => {
  process.stdout.write(`NC03 Control Center local runtime: http://${host}:${port}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
