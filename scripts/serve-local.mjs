import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const sourceRoot = resolve(process.cwd());
const distRoot = join(sourceRoot, "dist");
const root = existsSync(join(distRoot, "index.html")) ? distRoot : sourceRoot;
const host = process.env.NC03_HOST || "127.0.0.1";
const port = Number(process.env.NC03_PORT || 3006);
const contractPath = existsSync(join(root, "control", "application-management.contract.json"))
  ? join(root, "control", "application-management.contract.json")
  : join(sourceRoot, "control", "application-management.contract.json");

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

function json(res, status, payload, headOnly = false) {
  res.writeHead(status, {
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    "x-content-type-options":"nosniff"
  });
  res.end(headOnly ? undefined : JSON.stringify(payload));
}

function sendFile(res, file, headOnly = false) {
  const headers = {
    "content-type": mime.get(extname(file).toLowerCase()) || "application/octet-stream",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  };
  res.writeHead(200, headers);
  if (headOnly) res.end();
  else createReadStream(file).pipe(res);
}

function contract() {
  return JSON.parse(readFileSync(contractPath, "utf8"));
}

const server = createServer((req, res) => {
  if (!req.url || !["GET","HEAD"].includes(req.method || "GET")) {
    res.writeHead(405, { "content-type":"text/plain; charset=utf-8" });
    res.end("Method Not Allowed");
    return;
  }

  const headOnly = req.method === "HEAD";
  const pathname = new URL(req.url, "http://127.0.0.1").pathname;

  if (pathname === "/_local/health") {
    json(res, 200, {
      ok:true,
      app:"nc03-control-center",
      applicationId:"nc03-modem",
      mode:"local",
      port,
      contractEndpoint:"/api/application-management/contract"
    }, headOnly);
    return;
  }

  if (pathname === "/api/application-management/contract") {
    json(res, 200, contract(), headOnly);
    return;
  }

  if (pathname === "/api/control/status") {
    json(res, 200, {
      ok:true,
      application:"nc03-modem",
      runtime:"local",
      contractConnected:true,
      remoteAdminReady:false,
      managementMode:"local-first",
      modemCredentialScope:"device-local",
      modemCommandProxy:false
    }, headOnly);
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

  sendFile(res, file, headOnly);
});

server.listen(port, host, () => {
  process.stdout.write(`NC03 Control Center local runtime: http://${host}:${port}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
