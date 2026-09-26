import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { NC03Firmware80042Adapter } from "../src/modem/NC03Firmware80042Adapter.js";
import { normalizeModemBaseUrl } from "../src/modem/LocalBridgePolicy.js";
import { buildConnectionDoctorReport } from "../src/modem/ConnectionDoctor.js";
import { buildAuthSourceEvidence } from "../src/modem/AuthSourceDiscovery.js";

const sourceRoot = resolve(process.cwd());
const distRoot = join(sourceRoot, "dist");
const packagePath = join(sourceRoot, "package.json");
const sourceContractPath = join(sourceRoot, "control", "application-management.contract.json");
const sourceVersion = JSON.parse(readFileSync(packagePath, "utf8")).version;
const distContractPath = join(distRoot, "control", "application-management.contract.json");

function distVersionMatchesSource() {
  if (!existsSync(join(distRoot, "index.html")) || !existsSync(distContractPath)) return false;
  try {
    const distContract = JSON.parse(readFileSync(distContractPath, "utf8"));
    return distContract?.application?.version === sourceVersion;
  } catch {
    return false;
  }
}

const usingDist = distVersionMatchesSource();
const root = usingDist ? distRoot : sourceRoot;
const host = process.env.NC03_HOST || "127.0.0.1";
const port = Number(process.env.NC03_PORT || 3006);
const contractPath = usingDist ? distContractPath : sourceContractPath;
const DEFAULT_MODEM_BASE_URL = "http://192.168.0.1";

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

async function readJsonBody(req, maxBytes = 4096) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > maxBytes) throw new Error("REQUEST_TOO_LARGE");
  }
  return raw ? JSON.parse(raw) : {};
}

function modemAdapter(baseUrl) {
  const fetchImpl = (url, init = {}) => fetch(url, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(3500)
  });
  return new NC03Firmware80042Adapter({ baseUrl, fetchImpl });
}

const AUTH_SOURCE_SEEDS = Object.freeze([
  "/",
  "/index.html",
  "/common/login.html",
  "/js/common.js",
  "/js/tools.js",
  "/js/md5.js",
  "/js/rebootreset.js",
  "/js/systemadmin.js"
]);

async function fetchStaticSource(baseUrl, path) {
  const url = new URL(path, baseUrl);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method:"GET",
      redirect:"manual",
      signal:AbortSignal.timeout(2200),
      headers:{ Accept:"text/html,application/javascript,text/javascript,*/*;q=0.5" }
    });
    const contentType = String(response.headers.get("content-type") || "");
    const diagnostic = {
      path:url.pathname,
      status:response.ok ? "HTTP_OK" : response.status >= 300 && response.status < 400 ? "REDIRECT" : "HTTP_ERROR",
      httpStatus:response.status,
      contentType:contentType.split(";")[0] || null,
      durationMs:Date.now() - startedAt
    };
    if (!response.ok) return { item:null, diagnostic };
    if (!/javascript|text\/(?:html|plain)|application\/x-javascript/i.test(contentType)) {
      return { item:null, diagnostic:{ ...diagnostic, status:"UNSUPPORTED_CONTENT" } };
    }
    const text = await response.text();
    return {
      item:{ path:url.pathname, source:text.slice(0, 524288) },
      diagnostic:{ ...diagnostic, bytes:Buffer.byteLength(text) }
    };
  } catch (error) {
    const name = String(error?.name || "");
    return {
      item:null,
      diagnostic:{
        path:url.pathname,
        status:name === "TimeoutError" || name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
        httpStatus:null,
        contentType:null,
        durationMs:Date.now() - startedAt
      }
    };
  }
}

async function authProbeBaseUrl(req) {
  if (req.method === "GET") {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    return normalizeModemBaseUrl(requestUrl.searchParams.get("baseUrl") || DEFAULT_MODEM_BASE_URL);
  }
  const body = await readJsonBody(req);
  return normalizeModemBaseUrl(body.baseUrl);
}

async function authSourceProbe(req, res) {
  try {
    const baseUrl = await authProbeBaseUrl(req);
    const sources = [];
    const diagnostics = [];
    const collect = async (paths) => {
      const results = await Promise.all(paths.map((path) => fetchStaticSource(baseUrl, path)));
      for (const result of results) {
        diagnostics.push(result.diagnostic);
        if (result.item && !sources.some((current) => current.path === result.item.path)) sources.push(result.item);
      }
    };

    await collect(AUTH_SOURCE_SEEDS);

    const firstPass = buildAuthSourceEvidence(sources);
    const loginPages = firstPass.loginPageCandidates
      .filter((path) => /^\/[A-Za-z0-9_./-]+\.html$/i.test(path))
      .filter((path) => !sources.some((item) => item.path === path))
      .slice(0, 6);

    if (loginPages.length) await collect(loginPages);

    const secondPass = buildAuthSourceEvidence(sources);
    const extraRefs = secondPass.discoveredScriptRefs
      .filter((path) => /^\/(?:js|lib)\/[A-Za-z0-9_./-]+\.js$/i.test(path))
      .filter((path) => !sources.some((item) => item.path === path))
      .slice(0, 24);

    if (extraRefs.length) await collect(extraRefs);

    const evidence = buildAuthSourceEvidence(sources);
    const summary = diagnostics.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    json(res, 200, {
      ok:true,
      payload:{
        baseUrl,
        evidence,
        diagnostics:{
          summary,
          items:diagnostics,
          sourceCount:sources.length
        }
      }
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "AUTH_SOURCE_PROBE_FAILED";
    const safeCode = /^[A-Z0-9_]+$/.test(code) ? code : "AUTH_SOURCE_PROBE_FAILED";
    json(res, 502, { ok:false, code:safeCode });
  }
}

async function modemDoctor(req, res) {
  try {
    const body = await readJsonBody(req);
    const baseUrl = normalizeModemBaseUrl(body.baseUrl);
    const adapter = modemAdapter(baseUrl);
    const login = await adapter.connect();
    if (!login.authenticated) {
      json(res, 200, {
        ok:true,
        payload:buildConnectionDoctorReport({
          baseUrl,
          bridgeOk:true,
          authenticated:false,
          errorCode:"AUTHENTICATION_REQUIRED"
        })
      });
      return;
    }

    const [live, firmware] = await Promise.all([
      adapter.getLiveSnapshot(),
      adapter.getFirmwareStatus()
    ]);

    json(res, 200, {
      ok:true,
      payload:buildConnectionDoctorReport({
        baseUrl,
        bridgeOk:true,
        authenticated:true,
        live,
        firmware
      })
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "NC03_READ_FAILED";
    const safeCode = /^[A-Z0-9_]+$/.test(code) ? code : "NC03_READ_FAILED";
    json(res, 200, {
      ok:true,
      payload:buildConnectionDoctorReport({
        baseUrl:null,
        bridgeOk:true,
        authenticated:false,
        errorCode:safeCode
      })
    });
  }
}

async function modemRead(req, res, operation) {
  try {
    const body = await readJsonBody(req);
    const baseUrl = normalizeModemBaseUrl(body.baseUrl);
    const adapter = modemAdapter(baseUrl);
    const login = await adapter.connect();
    if (!login.authenticated) {
      json(res, 401, { ok:false, authenticated:false, code:"AUTHENTICATION_REQUIRED" });
      return;
    }
    const payload = operation === "details"
      ? await adapter.getAdvancedSnapshot()
      : await adapter.getLiveSnapshot();
    json(res, 200, { ok:true, authenticated:true, baseUrl, payload });
  } catch (error) {
    const code = error instanceof Error ? error.message : "NC03_READ_FAILED";
    const safeCode = /^[A-Z0-9_]+$/.test(code) ? code : "NC03_READ_FAILED";
    json(res, 502, { ok:false, code:safeCode });
  }
}

const server = createServer(async (req, res) => {
  if (!req.url || !["GET","HEAD","POST"].includes(req.method || "GET")) {
    res.writeHead(405, { "content-type":"text/plain; charset=utf-8" });
    res.end("Method Not Allowed");
    return;
  }

  const headOnly = req.method === "HEAD";
  const pathname = new URL(req.url, "http://127.0.0.1").pathname;

  if (pathname === "/api/nc03/auth-source-probe") {
    if (!["GET","POST"].includes(req.method || "GET")) {
      json(res, 405, { ok:false, code:"METHOD_NOT_ALLOWED" }, headOnly);
      return;
    }
    await authSourceProbe(req, res);
    return;
  }

  if (pathname === "/api/nc03/doctor") {
    if (req.method !== "POST") {
      json(res, 405, { ok:false, code:"METHOD_NOT_ALLOWED" }, headOnly);
      return;
    }
    await modemDoctor(req, res);
    return;
  }

  if (pathname === "/api/nc03/snapshot" || pathname === "/api/nc03/details") {
    if (req.method !== "POST") {
      json(res, 405, { ok:false, code:"METHOD_NOT_ALLOWED" }, headOnly);
      return;
    }
    await modemRead(req, res, pathname.endsWith("/details") ? "details" : "snapshot");
    return;
  }

  if (req.method === "POST") {
    json(res, 405, { ok:false, code:"METHOD_NOT_ALLOWED" });
    return;
  }

  if (pathname === "/_local/health") {
    json(res, 200, {
      ok:true,
      app:"nc03-control-center",
      applicationId:"nc03-modem",
      mode:"local",
      port,
      version:sourceVersion,
      assetRoot:usingDist ? "dist" : "source",
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
  const rootLabel = usingDist ? "dist" : "source";
  process.stdout.write(`NC03 Control Center v${sourceVersion} local runtime: http://${host}:${port} [${rootLabel}]\n`);
  if (!usingDist && existsSync(join(distRoot, "index.html"))) process.stdout.write("NC03 notice: stale dist detected; serving current source instead. Run npm run build to refresh dist.\n");
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
