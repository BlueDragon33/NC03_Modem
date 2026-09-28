import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { NC03Firmware80042Adapter } from "../src/modem/NC03Firmware80042Adapter.js";
import { normalizeModemBaseUrl } from "../src/modem/LocalBridgePolicy.js";
import { buildConnectionDoctorReport } from "../src/modem/ConnectionDoctor.js";
import { buildAuthSourceEvidence } from "../src/modem/AuthSourceDiscovery.js";
import { NC03_RUNTIME_PROTOCOL } from "../src/runtime/RuntimeProtocol.js";
import { discoverNc03LoginRecipe, discoverSaveAjaxTransport, executeNc03Login } from "../src/modem/NC03LoginRuntime.js";
import { createCookieAwareFetch } from "../src/modem/NC03LocalCookieJar.js";
import { buildWriteReadinessEvidence } from "../src/modem/WriteSourceDiscovery.js";
import { buildReversibleTogglePlan, executeJsonToggleWrite, executeRollback, readbackMatches } from "../src/modem/NC03SafeWriteRuntime.js";
import { executeGuardedWriteTransaction } from "../src/modem/NC03GuardedWriteEngine.js";
import { settingDefinition } from "../src/domain/NC03SettingsRegistry.js";
import { buildStockWebUiAudit, stockUiAuditDiscoveryPaths } from "../src/modem/StockWebUiAudit.js";
import { normalizeAdvancedSnapshot, normalizeLiveSnapshot } from "../src/domain/NC03ReadModel.js";

const sourceRoot = resolve(process.cwd());
const distRoot = join(sourceRoot, "dist");
const packagePath = join(sourceRoot, "package.json");
const sourceContractPath = join(sourceRoot, "control", "application-management.contract.json");
const sourceVersion = JSON.parse(readFileSync(packagePath, "utf8")).version;
const runtimeBootedAt = new Date().toISOString();
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

const modemSessions = new Map();

function modemSessionTransport(baseUrl) {
  const normalized = normalizeModemBaseUrl(baseUrl);
  let session = modemSessions.get(normalized);
  if (!session) {
    session = createCookieAwareFetch({
      fetchImpl:(url, init = {}) => fetch(url, {
        ...init,
        redirect:"manual",
        signal:init.signal ?? AbortSignal.timeout(5000)
      })
    });
    modemSessions.set(normalized, session);
  }
  return session;
}

function modemAdapter(baseUrl) {
  const session = modemSessionTransport(baseUrl);
  return new NC03Firmware80042Adapter({ baseUrl, fetchImpl:session.fetchImpl });
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

const WRITE_SOURCE_SEEDS = Object.freeze([
  "/index.html",
  "/common/settings.html",
  "/js/common.js",
  "/js/tools.js",
  "/js/systemadmin.js",
  "/js/power.js",
  "/js/battery.js",
  "/js/device.js",
  "/js/rebootreset.js",
  "/js/encryption.js"
]);

const STOCK_UI_SOURCE_SEEDS = Object.freeze([
  "/",
  "/index.html",
  "/common/login.html",
  "/common/settings.html",
  "/js/common.js",
  "/js/tools.js"
]);

async function fetchStaticSource(baseUrl, path, { fetchImpl = fetch } = {}) {
  const url = new URL(path, baseUrl);
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(url, {
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

async function stockUiAudit(req, res) {
  try {
    const baseUrl = await authProbeBaseUrl(req);
    const sources = [];
    const diagnostics = [];
    const session = modemSessionTransport(baseUrl);
    const collect = async (paths) => {
      const safePaths = [...new Set(paths)]
        .filter((path) => typeof path === "string")
        .filter((path) => /^\/[A-Za-z0-9_./-]+(?:\.html|\.js)?$/i.test(path))
        .filter((path) => !sources.some((item) => item.path === path));
      if (!safePaths.length) return;
      const results = await Promise.all(safePaths.map((path) => fetchStaticSource(baseUrl, path, { fetchImpl:session.fetchImpl })));
      for (const result of results) {
        diagnostics.push(result.diagnostic);
        if (result.item && !sources.some((item) => item.path === result.item.path)) sources.push(result.item);
      }
    };

    await collect(STOCK_UI_SOURCE_SEEDS);
    for (let pass = 0; pass < 3; pass += 1) {
      const current = buildStockWebUiAudit(sources);
      await collect(stockUiAuditDiscoveryPaths(current, { maxPages:96, maxScripts:160 }));
    }

    const audit = buildStockWebUiAudit(sources);
    const summary = diagnostics.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    const fetchedPaths = new Set(audit.sourcePaths ?? []);
    const missingPagePaths = (audit.pagePaths ?? []).filter((path) => !fetchedPaths.has(path));
    const protectedPageCount = (audit.sourcePaths ?? []).filter((path) => path.startsWith("/html/") || path.includes("settings")).length;
    const coverage = {
      status:missingPagePaths.length ? "PARTIAL" : protectedPageCount ? "AUTHENTICATED_SURFACE_CAPTURED" : "LOGIN_SURFACE_ONLY",
      sessionTransport:true,
      protectedPageCount,
      missingPagePaths,
      redirectCount:summary.REDIRECT ?? 0
    };

    json(res, 200, {
      ok:true,
      payload:{
        baseUrl,
        audit,
        coverage,
        runtime:{
          protocolId:NC03_RUNTIME_PROTOCOL.id,
          stockUiAuditSchema:NC03_RUNTIME_PROTOCOL.stockUiAuditSchema,
          sourceVersion,
          bootedAt:runtimeBootedAt
        },
        diagnostics:{
          summary,
          sourceCount:sources.length,
          items:diagnostics
        }
      }
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "STOCK_UI_AUDIT_FAILED";
    json(res, 502, { ok:false, code:/^[A-Z0-9_]+$/.test(code) ? code : "STOCK_UI_AUDIT_FAILED" });
  }
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
        runtime:{
          protocolId:NC03_RUNTIME_PROTOCOL.id,
          authEvidenceSchema:NC03_RUNTIME_PROTOCOL.authEvidenceSchema,
          authProbeTransport:NC03_RUNTIME_PROTOCOL.authProbeTransport,
          authLoginProtocol:NC03_RUNTIME_PROTOCOL.authLoginProtocol,
          writeReadinessProtocol:NC03_RUNTIME_PROTOCOL.writeReadinessProtocol,
          sourceVersion,
          bootedAt:runtimeBootedAt
        },
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


async function discoverLoginRuntime(baseUrl) {
  const paths = [
    "/common/login.html",
    "/js/login.js",
    "/js/tools.js",
    "/js/common.js",
    "/js/encryption.js",
    "/js/md5.js"
  ];
  const results = await Promise.all(paths.map((path) => fetchStaticSource(baseUrl, path)));
  const sources = results.map((result) => result.item).filter(Boolean);
  const diagnostics = results.map((result) => result.diagnostic);
  const loginSource = sources.find((item) => item.path === "/js/login.js")?.source ?? "";
  const recipe = discoverNc03LoginRecipe(loginSource, sources);
  const transport = discoverSaveAjaxTransport(sources);
  return { recipe, transport, diagnostics };
}

function publicLoginReadiness(runtime) {
  const recipe = runtime?.recipe ?? {};
  const transport = runtime?.transport ?? {};
  return {
    ready:Boolean(recipe.ready && transport.ready),
    recipe:{
      endpoint:recipe.endpoint ?? null,
      passwordTransform:recipe.passwordTransform ?? null,
      successCode:Number.isFinite(recipe.successCode) ? recipe.successCode : null,
      genericFailureCodes:Array.isArray(recipe.genericFailureCodes) ? recipe.genericFailureCodes : [],
      usernameHmac:Boolean(recipe.ready),
      passwordHmac:recipe.passwordTransform === "HMAC-MD5"
    },
    transport:{
      helper:transport.helper ?? null,
      method:transport.method ?? null,
      contentType:transport.contentType ?? null,
      rawStringBody:Boolean(transport.rawStringBody)
    },
    evidence:{
      loginFunction:Boolean(recipe.evidence?.loginFunction),
      loginKey:Boolean(recipe.evidence?.loginKey),
      endpoint:Boolean(recipe.evidence?.endpoint),
      usernameHmac:Boolean(recipe.evidence?.usernameHmac),
      usernameSourceReady:Boolean(recipe.evidence?.usernameLiteral),
      passwordHmac:Boolean(recipe.evidence?.passwordHmac),
      passwordInput:Boolean(recipe.evidence?.passwordInput),
      successZero:Boolean(recipe.evidence?.successZero),
      transport:Boolean(transport.ready)
    },
    diagnostics:{
      sourceCount:Array.isArray(runtime?.diagnostics)
        ? runtime.diagnostics.filter((item) => item?.status === "HTTP_OK").length
        : 0
    },
    code:recipe.ready ? (transport.ready ? "AUTH_READY" : transport.code) : recipe.code
  };
}

async function authReadiness(req, res) {
  try {
    const body = await readJsonBody(req);
    const baseUrl = normalizeModemBaseUrl(body.baseUrl);
    const runtime = await discoverLoginRuntime(baseUrl);
    json(res, 200, { ok:true, payload:publicLoginReadiness(runtime) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "AUTH_READINESS_FAILED";
    json(res, 502, { ok:false, code:/^[A-Z0-9_]+$/.test(code) ? code : "AUTH_READINESS_FAILED" });
  }
}

async function modemLogin(req, res) {
  try {
    const body = await readJsonBody(req, 8192);
    const baseUrl = normalizeModemBaseUrl(body.baseUrl);
    const password = typeof body.password === "string" ? body.password : "";
    if (!password) {
      json(res, 400, { ok:false, code:"PASSWORD_REQUIRED" });
      return;
    }

    const runtime = await discoverLoginRuntime(baseUrl);
    if (!runtime.recipe.ready || !runtime.transport.ready) {
      json(res, 409, { ok:false, code:runtime.recipe.code || runtime.transport.code || "AUTH_NOT_READY" });
      return;
    }

    const session = modemSessionTransport(baseUrl);
    session.jar.clear();
    const result = await executeNc03Login({
      baseUrl,
      password,
      recipe:runtime.recipe,
      transport:runtime.transport,
      fetchImpl:session.fetchImpl
    });

    if (!result.ok) {
      session.jar.clear();
      json(res, 401, { ok:false, code:result.code, retcode:result.retcode ?? null });
      return;
    }

    const verified = await modemAdapter(baseUrl).connect();
    if (!verified.authenticated) {
      session.jar.clear();
      json(res, 502, { ok:false, code:"AUTH_VERIFICATION_FAILED" });
      return;
    }

    json(res, 200, {
      ok:true,
      payload:{
        authenticated:true,
        retcode:result.retcode,
        firmware:verified.firmware ?? null
      }
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "LOGIN_FAILED";
    json(res, 502, { ok:false, code:/^[A-Z0-9_]+$/.test(code) ? code : "LOGIN_FAILED" });
  }
}


async function writeReadiness(req, res) {
  try {
    const body = req.method === "GET" ? {} : await readJsonBody(req);
    const baseUrl = normalizeModemBaseUrl(body.baseUrl || DEFAULT_MODEM_BASE_URL);
    const targetId = typeof body.targetId === "string" ? body.targetId : "long-life-charging";
    const adapter = modemAdapter(baseUrl);
    const login = await adapter.connect();
    if (!login.authenticated) {
      json(res, 401, { ok:false, code:"AUTHENTICATION_REQUIRED" });
      return;
    }

    const [power, sourceResults] = await Promise.all([
      adapter.getPowerSettings(),
      Promise.all(WRITE_SOURCE_SEEDS.map((path) => fetchStaticSource(baseUrl, path)))
    ]);
    const sources = sourceResults.map((result) => result.item).filter(Boolean);
    const diagnostics = sourceResults.map((result) => result.diagnostic);
    const evidence = buildWriteReadinessEvidence(sources, { targetId, currentState:power });

    json(res, 200, {
      ok:true,
      payload:{
        evidence,
        diagnostics:{
          sourceCount:sources.length,
          items:diagnostics,
          summary:diagnostics.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {})
        }
      }
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "WRITE_READINESS_FAILED";
    json(res, 502, { ok:false, code:/^[A-Z0-9_]+$/.test(code) ? code : "WRITE_READINESS_FAILED" });
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyPowerReadback(adapter, key, enabled) {
  for (const delay of [0, 250, 500, 900]) {
    if (delay) await wait(delay);
    const power = await adapter.getPowerSettings();
    if (readbackMatches(power?.[key], enabled)) {
      return { ok:true, power };
    }
  }
  return { ok:false, power:await adapter.getPowerSettings().catch(() => ({})) };
}

async function buildLongLifeWriteContext(baseUrl, desiredEnabled) {
  const adapter = modemAdapter(baseUrl);
  const [currentPower, sourceResults] = await Promise.all([
    adapter.getPowerSettings(),
    Promise.all(WRITE_SOURCE_SEEDS.map((path) => fetchStaticSource(baseUrl, path)))
  ]);
  const sources = sourceResults.map((result) => result.item).filter(Boolean);
  const evidence = buildWriteReadinessEvidence(sources, {
    targetId:"long-life-charging",
    currentState:currentPower
  });
  const plan = buildReversibleTogglePlan({
    evidence,
    currentState:currentPower,
    desiredEnabled
  });
  const transport = discoverSaveAjaxTransport(sources);
  const session = modemSessionTransport(baseUrl);
  return { adapter, currentPower, evidence, plan, transport, session };
}

function guardedWriteStatus(result) {
  if (result?.ok) return 200;
  if (["BLOCKED","CONCURRENCY_CONFLICT"].includes(result?.state)) return 409;
  return 502;
}

async function runLongLifeTransaction({
  baseUrl,
  desiredEnabled,
  confirmed,
  acceptanceMode = false,
  alwaysRollback = false
} = {}) {
  const context = await buildLongLifeWriteContext(baseUrl, desiredEnabled);
  const setting = settingDefinition("power.long-life");
  const result = await executeGuardedWriteTransaction({
    operationId:"power.long-life",
    desiredValue:desiredEnabled,
    plan:context.plan,
    policy:{
      writable:Boolean(setting?.capability?.writable),
      acceptanceMode,
      requiresConfirmation:true,
      confirmed:Boolean(confirmed),
      dangerClass:setting?.safety?.danger ?? "MEDIUM"
    },
    alwaysRollback,
    readCurrent:()=>context.adapter.getPowerSettings(),
    executeWrite:(plan)=>executeJsonToggleWrite({
      baseUrl,
      plan,
      transport:context.transport,
      fetchImpl:context.session.fetchImpl
    }),
    verifyDesired:(plan, desired)=>verifyPowerReadback(context.adapter, plan.readbackKey, desired),
    executeRollback:(plan)=>executeRollback({
      baseUrl,
      plan,
      transport:context.transport,
      fetchImpl:context.session.fetchImpl
    }),
    verifyOriginal:(plan)=>verifyPowerReadback(context.adapter, plan.readbackKey, plan.originalEnabled)
  });
  return {
    ...result,
    target:"long-life-charging",
    enabled:desiredEnabled
  };
}

async function writeLongLifeCharging(req, res) {
  try {
    const body = await readJsonBody(req);
    const baseUrl = normalizeModemBaseUrl(body.baseUrl || DEFAULT_MODEM_BASE_URL);
    const enabled = body.enabled;
    if (typeof enabled !== "boolean") {
      json(res, 400, { ok:false, code:"WRITE_VALUE_INVALID" });
      return;
    }

    const adapter = modemAdapter(baseUrl);
    const login = await adapter.connect();
    if (!login.authenticated) {
      json(res, 401, { ok:false, code:"AUTHENTICATION_REQUIRED" });
      return;
    }

    const result = await runLongLifeTransaction({
      baseUrl,
      desiredEnabled:enabled,
      confirmed:body.confirmed === true
    });

    json(res, guardedWriteStatus(result), result.ok
      ? { ok:true, payload:result }
      : { ok:false, code:result.code || result.state || "SETTINGS_WRITE_FAILED", payload:result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "SETTINGS_WRITE_FAILED";
    json(res, 502, { ok:false, code:/^[A-Z0-9_]+$/.test(code) ? code : "SETTINGS_WRITE_FAILED" });
  }
}

async function acceptLongLifeChargingWrite(req, res) {
  try {
    const body = await readJsonBody(req);
    const baseUrl = normalizeModemBaseUrl(body.baseUrl || DEFAULT_MODEM_BASE_URL);
    if (body.confirmed !== true) {
      json(res, 409, { ok:false, code:"WRITE_CONFIRMATION_REQUIRED" });
      return;
    }

    const adapter = modemAdapter(baseUrl);
    const login = await adapter.connect();
    if (!login.authenticated) {
      json(res, 401, { ok:false, code:"AUTHENTICATION_REQUIRED" });
      return;
    }

    const currentPower = await adapter.getPowerSettings();
    const sourceResults = await Promise.all(WRITE_SOURCE_SEEDS.map((path) => fetchStaticSource(baseUrl, path)));
    const sources = sourceResults.map((result) => result.item).filter(Boolean);
    const evidence = buildWriteReadinessEvidence(sources, {
      targetId:"long-life-charging",
      currentState:currentPower
    });
    const probePlan = buildReversibleTogglePlan({
      evidence,
      currentState:currentPower,
      desiredEnabled:true
    });
    if (!probePlan.ready) {
      json(res, 409, { ok:false, code:probePlan.code || "WRITE_MAPPING_INCOMPLETE" });
      return;
    }

    const desiredEnabled = !probePlan.originalEnabled;
    const result = await runLongLifeTransaction({
      baseUrl,
      desiredEnabled,
      confirmed:true,
      acceptanceMode:true,
      alwaysRollback:true
    });

    json(res, guardedWriteStatus(result), result.ok
      ? { ok:true, payload:{ ...result, acceptanceTest:true, originalRestored:result.finalState === "ORIGINAL_VERIFIED" } }
      : { ok:false, code:result.code || result.state || "WRITE_ACCEPTANCE_FAILED", payload:{ ...result, acceptanceTest:true } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "WRITE_ACCEPTANCE_FAILED";
    json(res, 502, { ok:false, code:/^[A-Z0-9_]+$/.test(code) ? code : "WRITE_ACCEPTANCE_FAILED" });
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

async function clearLocalModemSession(req, res) {
  try {
    const body = await readJsonBody(req);
    const baseUrl = normalizeModemBaseUrl(body.baseUrl || DEFAULT_MODEM_BASE_URL);
    const session = modemSessions.get(baseUrl);
    if (session?.jar) session.jar.clear();
    json(res, 200, { ok:true, payload:{ cleared:true, vendorLogoutAttempted:false } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "SESSION_CLEAR_FAILED";
    json(res, 502, { ok:false, code:/^[A-Z0-9_]+$/.test(code) ? code : "SESSION_CLEAR_FAILED" });
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
    const rawPayload = operation === "details"
      ? await adapter.getAdvancedSnapshot()
      : await adapter.getLiveSnapshot();
    const payload = operation === "details"
      ? normalizeAdvancedSnapshot(rawPayload)
      : normalizeLiveSnapshot(rawPayload);
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

  if (pathname === "/api/nc03/stock-ui-audit") {
    if (!["GET","POST"].includes(req.method || "GET")) {
      json(res, 405, { ok:false, code:"METHOD_NOT_ALLOWED" }, headOnly);
      return;
    }
    await stockUiAudit(req, res);
    return;
  }

  if (pathname === "/api/nc03/auth-source-probe") {
    if (!["GET","POST"].includes(req.method || "GET")) {
      json(res, 405, { ok:false, code:"METHOD_NOT_ALLOWED" }, headOnly);
      return;
    }
    await authSourceProbe(req, res);
    return;
  }

  if (pathname === "/api/nc03/auth-readiness") {
    if (req.method !== "POST") {
      json(res, 405, { ok:false, code:"METHOD_NOT_ALLOWED" }, headOnly);
      return;
    }
    await authReadiness(req, res);
    return;
  }

  if (pathname === "/api/nc03/login") {
    if (req.method !== "POST") {
      json(res, 405, { ok:false, code:"METHOD_NOT_ALLOWED" }, headOnly);
      return;
    }
    await modemLogin(req, res);
    return;
  }

  if (pathname === "/api/nc03/write-readiness") {
    if (!["GET","POST"].includes(req.method || "GET")) {
      json(res, 405, { ok:false, code:"METHOD_NOT_ALLOWED" }, headOnly);
      return;
    }
    await writeReadiness(req, res);
    return;
  }

  if (pathname === "/api/nc03/write-acceptance/long-life-charging") {
    if (req.method !== "POST") {
      json(res, 405, { ok:false, code:"METHOD_NOT_ALLOWED" }, headOnly);
      return;
    }
    await acceptLongLifeChargingWrite(req, res);
    return;
  }

  if (pathname === "/api/nc03/settings/long-life-charging") {
    if (req.method !== "POST") {
      json(res, 405, { ok:false, code:"METHOD_NOT_ALLOWED" }, headOnly);
      return;
    }
    await writeLongLifeCharging(req, res);
    return;
  }

  if (pathname === "/api/nc03/session/clear") {
    if (req.method !== "POST") {
      json(res, 405, { ok:false, code:"METHOD_NOT_ALLOWED" }, headOnly);
      return;
    }
    await clearLocalModemSession(req, res);
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
      runtimeProtocol:NC03_RUNTIME_PROTOCOL.id,
      authEvidenceSchema:NC03_RUNTIME_PROTOCOL.authEvidenceSchema,
      authProbeTransport:NC03_RUNTIME_PROTOCOL.authProbeTransport,
      authLoginProtocol:NC03_RUNTIME_PROTOCOL.authLoginProtocol,
      writeReadinessProtocol:NC03_RUNTIME_PROTOCOL.writeReadinessProtocol,
      settingsWriteProtocol:NC03_RUNTIME_PROTOCOL.settingsWriteProtocol,
      stockUiAuditSchema:NC03_RUNTIME_PROTOCOL.stockUiAuditSchema,
      readModelSchema:NC03_RUNTIME_PROTOCOL.readModelSchema,
      bootedAt:runtimeBootedAt,
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
