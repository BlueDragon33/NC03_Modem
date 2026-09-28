import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  HAR2_CAPABILITY_OVERRIDES,
  LIVE_TELEMETRY_KEYS,
  SAFE_WIFI_KEYS,
  SENSITIVE_KEYS_NOT_MIRRORED
} from "../src/modem/NC03Har2Profile.js";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const applicationClient = fs.readFileSync(new URL("../src/application/NC03ControlClient.js", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../scripts/serve-local.mjs", import.meta.url), "utf8");

test("live battery, connection and signal poll every 10 seconds", () => {
  assert.match(app, /const LIVE_REFRESH_MS = 10_000/);
  assert.match(app, /setInterval\(\(\) => \{ pollLiveOnce\(\)/);
  assert.match(app, /function renderAlwaysOnStatus/);
  for (const label of ["PIN", "KẾT NỐI", "SÓNG", "MẠNG", "10 giây"]) assert.ok(app.includes(label));
});

test("local bridge exposes read-only snapshot and details endpoints", () => {
  assert.match(server, /\/api\/nc03\/snapshot/);
  assert.match(server, /\/api\/nc03\/details/);
  assert.match(server, /adapter\.getLiveSnapshot\(\)/);
  assert.match(server, /adapter\.getAdvancedSnapshot\(\)/);
  assert.match(server, /normalizeModemBaseUrl/);
  assert.match(server, /LocalBridgePolicy\.js/);
  assert.match(server, /AUTHENTICATION_REQUIRED/);
});

test("HAR2 safe telemetry never mirrors modem secrets", () => {
  assert.ok(LIVE_TELEMETRY_KEYS.includes("device_battery_percent"));
  assert.ok(LIVE_TELEMETRY_KEYS.includes("mnet_sig_level"));
  assert.ok(LIVE_TELEMETRY_KEYS.includes("dialup_dial_status"));
  assert.ok(SAFE_WIFI_KEYS.includes("wifi_ssid_3"));
  assert.ok(SAFE_WIFI_KEYS.includes("wifi_client_3"));
  const safe = [...LIVE_TELEMETRY_KEYS, ...SAFE_WIFI_KEYS].join("\n");
  for (const secret of ["xmg_wifi_psk", "device_imei", "device_sn", "mnet_sim_iccid", "esim_eid", "dialup_profile"]) {
    assert.equal(safe.includes(secret), false, `safe telemetry leaked ${secret}`);
  }
  assert.ok(SENSITIVE_KEYS_NOT_MIRRORED.includes("xmg_wifi_psk_*"));
});

test("new HAR modules are read-only rather than write-enabled", () => {
  for (const module of ["Network Settings", "SIM / eSIM", "USB / Cradle", "Firewall / Security", "Time / NTP", "Power / Display", "Bridge Mode"]) {
    const capability = HAR2_CAPABILITY_OVERRIDES.find((item) => item.module === module);
    assert.ok(capability, `missing capability ${module}`);
    assert.equal(capability.read, true);
    assert.equal(capability.write, false);
    assert.equal(capability.status, "READ ONLY");
  }
});


test("10 second polling updates live DOM in place and pauses while hidden", () => {
  assert.match(app, /function updateLiveTelemetryDom/);
  assert.match(app, /document\.hidden/);
  assert.match(app, /liveRefreshInFlight/);
  assert.match(app, /hadLive !== Boolean\(state\.live\) \|\| authNavigationChanged\) page\(\)/);
  assert.match(app, /updateLiveTelemetryDom\(\)/);
  assert.match(app, /visibilitychange/);
});

test("advanced UI exposes registry-backed safe mobile state and rule counts", () => {
  for (const id of ["mobile.data","mobile.sim-pin-protect","mobile.cloud-sim-auto","lan.ip-mac-bindings","lan.port-forwarding","lan.ipv4-filters","lan.ipv6-filters"]) {
    assert.ok(app.includes(id), id);
  }
  assert.match(app, /registryCapabilityNote/);
  assert.doesNotMatch(app, /wifi_wps_pin_value/);
  assert.doesNotMatch(app, /rt_dmz_ip/);
});


test("transient poll failure preserves last-known-good battery and signal instead of blanking telemetry", () => {
  assert.match(app, /liveStale:/);
  assert.match(app, /lastLiveSuccessAt:/);
  assert.match(app, /state\.liveStale = false/);
  assert.match(app, /state\.liveStale = Boolean\(state\.live\)/);
  assert.doesNotMatch(app, /catch \(error\) \{\s*state\.live = null;/);
  assert.match(app, /Dữ liệu gần nhất/);
  assert.match(app, /Đang kết nối lại/);
});

test("saved modem address uses the same RFC1918 policy as the Local Bridge", () => {
  const loginPolicy = fs.readFileSync(new URL("../src/modem/LoginPolicy.js", import.meta.url), "utf8");
  const preferences = fs.readFileSync(new URL("../src/modem/LocalPreferences.js", import.meta.url), "utf8");
  assert.match(loginPolicy, /normalizeModemBaseUrl/);
  assert.match(preferences, /normalizeModemBaseUrl/);
  assert.match(preferences, /safeBaseUrl/);
});


test("stale state survives navigation without falsely turning connection green", () => {
  assert.match(app, /Boolean\(\(t\?\.status\?\.connected && !state\.liveStale\) \|\| state\.demoMode\)/);
  assert.match(app, /const connected = Boolean\(t\?\.status\?\.connected\) && !state\.liveStale/);
  assert.match(app, /state\.liveStale && t \? "LAST GOOD"/);
});

test("freshness timestamps and advanced snapshot staleness are explicit", () => {
  assert.match(app, /function formatClock/);
  assert.match(app, /lastLiveSuccessAt/);
  assert.match(app, /lastDetailsSuccessAt/);
  assert.match(app, /detailsStale/);
  assert.match(app, /Dữ liệu cấu hình đang là bản gần nhất/);
  assert.match(app, /Chưa tải được cấu hình chi tiết/);
  assert.match(app, /retryDetails/);
});

test("login form accepts password immediately while persistence still requires verified success", () => {
  assert.match(app, /Ghi nhớ mật khẩu/);
  assert.match(app, /id="rememberPassword"/);
  assert.match(app, /id="loginPassword" type="password" autocomplete="current-password"/);
  assert.doesNotMatch(app, /id="loginPassword"[^>]*disabled/);
  assert.match(app, /rememberPassword"\)\?\.addEventListener\("change"/);
  assert.match(app, /credentialVault\.save/);
  assert.match(app, /state\.authReadiness\?\.ready/);
});

test("manual modem address errors are shown instead of silently resetting the address", () => {
  assert.match(app, /Địa chỉ không hợp lệ\. Chỉ dùng IP mạng nội bộ RFC1918/);
  assert.match(app, /state\.addressError/);
});


test("home makes stale Advanced data explicit instead of implying current clients or usage", () => {
  assert.match(app, /renderAuthNotice\(\)\}\s*\$\{renderDetailsNotice\(\)\}/);
  assert.match(app, /state\.detailsStale && details \? "Dữ liệu gần nhất"/);
  assert.match(app, /state\.detailsStale && details \? "Danh sách gần nhất"/);
  assert.match(app, /Snapshot hiện tại/);
  assert.doesNotMatch(app, /r\.onlineTime \?\? r\.state \?\? "Online"/);
});

test("settings exposes only privacy-safe local diagnostic reporting", () => {
  assert.match(app, /buildDiagnosticReport/);
  assert.match(app, /report\.html#/);
  assert.match(app, /openDiagnosticReport/);
  assert.match(app, /In \/ Lưu PDF/);
  assert.match(app, /Không spread toàn bộ payload modem/);
});


test("Connection Doctor stays local, read-only and exposes a dedicated endpoint", () => {
  assert.match(server, /\/api\/nc03\/doctor/);
  assert.match(server, /buildConnectionDoctorReport/);
  assert.match(app, /CONNECTION DOCTOR/);
  assert.match(app, /runConnectionDoctor/);
  assert.match(app, /không bật write/);
});


test("AUTH Source Probe is local-only evidence tooling and does not enable login or write", () => {
  assert.match(server, /\/api\/nc03\/auth-source-probe/);
  assert.match(server, /AUTH_SOURCE_SEEDS/);
  assert.match(server, /buildAuthSourceEvidence/);
  assert.match(app, /AUTH SOURCE PROBE/);
  assert.match(app, /SOURCE_CANDIDATE|Source candidate|source candidate/i);
  assert.match(app, /runAuthSourceProbe/);
});


test("application client rejects malformed success envelopes instead of silently returning undefined", () => {
  assert.match(applicationClient, /MALFORMED_LOCAL_RESPONSE/);
  assert.match(applicationClient, /hasOwnProperty\.call\(json, "payload"\)/);
});

test("AUTH Source Probe and Connection Doctor use the standard local API payload envelope", () => {
  assert.match(server, /payload:\{\s*baseUrl,\s*evidence,\s*runtime:\{[\s\S]*?diagnostics:/);
  assert.match(server, /payload:buildConnectionDoctorReport/);
});


test("AUTH deep probe seeds the observed firmware login page without logging the modem out", () => {
  assert.match(server, /"\/common\/login\.html"/);
  assert.match(server, /"\/js\/rebootreset\.js"/);
  assert.match(server, /loginPageCandidates/);
  assert.match(server, /discoveredScriptRefs/);
  assert.doesNotMatch(server, /fetch\([^\n]*\/action\/logout/);
});

test("AUTH source UI distinguishes login submit candidates from passive auth endpoints", () => {
  assert.match(app, /Login submit endpoint/);
  assert.match(app, /Supporting AUTH endpoints/);
  assert.match(app, /Request field candidates/);
  assert.match(app, /loginSubmitEndpoints/);
});


test("AUTH probe exposes bridge failures and per-path diagnostics instead of a generic silent error", () => {
  assert.match(app, /LOCAL_BRIDGE_UNREACHABLE/);
  assert.match(app, /controlClient\.health\(\)/);
  assert.match(app, /PROBE DIAGNOSTICS/);
  assert.match(server, /diagnostics:\{/);
  assert.match(server, /Promise\.all\(paths\.map/);
  assert.match(server, /TIMEOUT/);
  assert.match(server, /REDIRECT/);
});


test("AUTH source UI exposes endpoint-specific login callsite mapping", () => {
  assert.match(app, /callsite-grid/);
  assert.match(app, /Response signals/);
  assert.match(app, /transportHelper/);
  assert.match(app, /payloadVariable/);
  assert.match(app, /loginCallsites/);
});

test("AUTH source UI exposes sanitized argument and object shapes for real login calls", () => {
  assert.match(app, /Argument shape/);
  assert.match(app, /Object keys/);
  assert.match(app, /Transforms quanh call/);
  assert.match(app, /argumentShapes/);
  assert.match(app, /directObjectKeys/);
});


test("AUTH lab surfaces structural login trace and response-code mapping", () => {
  assert.match(app, /Payload structural trace/);
  assert.match(app, /RESPONSE CODE MAP/);
  assert.match(app, /responseCodeMap/);
  assert.match(app, /Đã tìm thấy endpoint · shape pending/);
});


test("AUTH lab exposes full-file payload origin and alias traces", () => {
  assert.match(app, /Payload origin trace · toàn file login\.js/);
  assert.match(app, /Payload aliases/);
  assert.match(app, /payloadOrigins/);
  assert.match(app, /payloadAliases/);
});


test("AUTH Source Probe keeps stale GET compatibility while the application client owns current POST transport", () => {
  assert.match(applicationClient, /getAuthSourceProbe\(baseUrl\)/);
  assert.match(applicationClient, /#postModem\("\/api\/nc03\/auth-source-probe"/);
  assert.match(server, /async function authProbeBaseUrl/);
  assert.match(server, /req\.method === "GET"/);
  assert.match(server, /DEFAULT_MODEM_BASE_URL = "http:\/\/192\.168\.0\.1"/);
  assert.match(server, /\["GET","POST"\]\.includes\(req\.method \|\| "GET"\)/);
  assert.doesNotMatch(app, /\/api\/nc03\/auth-source-probe/);
});


test("AUTH lab exposes request object dependency evidence before real login", () => {
  assert.match(app, /Request object dependency trace/);
  assert.match(app, /Login object fields \/ transforms/);
  assert.match(app, /dependencyOrigins/);
  assert.match(app, /dependencyFields/);
  assert.match(app, /authDependencyMapped/);
});


test("AUTH lab can display nested auth transforms from request-object fields", () => {
  assert.match(app, /authTransforms/);
  assert.match(app, /Nested AUTH transform/);
});


test("AUTH lab shows password dataflow and recipe status", () => {
  assert.match(app, /Password field dataflow/);
  assert.match(app, /Password recipe status/);
  assert.match(app, /passwordHmacConfirmed/);
  assert.match(app, /loginSuccessZeroObserved/);
  assert.match(app, /structure\.skeleton/);
});


test("application boundary refuses AUTH probe when Local Bridge runtime protocol/schema is stale", () => {
  assert.match(server, /NC03_RUNTIME_PROTOCOL/);
  assert.match(server, /runtimeProtocol:NC03_RUNTIME_PROTOCOL\.id/);
  assert.match(server, /authEvidenceSchema:NC03_RUNTIME_PROTOCOL\.authEvidenceSchema/);
  assert.match(server, /bootedAt:runtimeBootedAt/);
  assert.match(app, /LOCAL_BRIDGE_RESTART_REQUIRED/);
  assert.match(applicationClient, /#assertRuntime\(payload\)/);
  assert.match(applicationClient, /payload\?\.evidence\?\.schema !== this\.runtimeProtocol\.authEvidenceSchema/);
});


test("real login submit preflights runtime AUTH readiness without locking password entry", () => {
  assert.match(app, /authReadiness/);
  assert.match(app, /controlClient\.getAuthReadiness\(state\.baseUrl\)/);
  assert.match(app, /controlClient\.login\(state\.baseUrl, password\)/);
  assert.match(app, /id="loginPassword"/);
  assert.match(app, /CƠ CHẾ ĐĂNG NHẬP SẴN SÀNG/);
  assert.match(app, /if \(!state\.authReadiness\?\.ready\) \{/);
  assert.match(app, /await refreshAuthReadiness\(\{ render:false \}\)/);
  assert.match(app, /credentialVault\.save/);
  assert.match(applicationClient, /"\/api\/nc03\/auth-readiness"/);
  assert.match(applicationClient, /"\/api\/nc03\/login"/);
  assert.match(server, /async function authReadiness/);
  assert.match(server, /async function modemLogin/);
  assert.match(server, /AUTH_VERIFICATION_FAILED/);
});

test("runtime login bridge never returns firmware login key or username literal", () => {
  assert.match(server, /function publicLoginReadiness/);
  assert.doesNotMatch(server, /publicLoginReadiness[\s\S]{0,1800}usernameLiteral:/);
  assert.doesNotMatch(server, /publicLoginReadiness[\s\S]{0,1800}\bkey:/);
});


test("startup always renders Login first and never restores Demo automatically", () => {
  assert.match(app, /view: "login"/);
  assert.match(app, /demoMode: false/);
  assert.match(app, /async function bootstrapRuntime\(\)/);
  assert.match(app, /state\.view = "login";[\s\S]*state\.demoMode = false;[\s\S]*page\(\);/);
  assert.match(app, /await refreshAuthReadiness\(\{ render:false \}\);[\s\S]*await refreshLive\(\{ render:false \}\);/);
  assert.match(app, /Do not auto-enter Home from a detected modem session/);
  assert.match(app, /await bootstrapRuntime\(\);/);
});

test("session expiry takes priority over stale-data reconnect and rerenders login immediately", () => {
  assert.match(app, /CONNECTION_STATE\.SESSION_EXPIRED/);
  assert.match(app, /const hadVerifiedSession = Boolean\(state\.authSession\?\.hadAuthenticatedSession \|\| state\.lastLiveSuccessAt\)/);
  assert.match(app, /authSessionMachine\.protectedRequestFailed\(error\?\.code \|\| "NC03_READ_FAILED"\)/);
  assert.match(app, /const previousView = state\.view/);
  assert.match(app, /const previousConnectionState = state\.connectionState/);
  assert.match(app, /authNavigationChanged/);
  assert.match(app, /Xác thực lại NC03/);
});


test("Write Readiness Lab remains read-only and prepares a reversible safe-charge capture", () => {
  assert.match(app, /WRITE READINESS LAB/);
  assert.match(app, /Long Life Charging · reversible write plan/);
  assert.match(app, /controlClient\.getWriteReadiness\(state\.baseUrl\)/);
  assert.match(applicationClient, /"\/api\/nc03\/write-readiness"/);
  assert.match(app, /writeEnabled=false/);
  assert.match(app, /READY FOR REVERSIBLE HAR CAPTURE/);
  assert.match(server, /async function writeReadiness/);
  assert.match(server, /adapter\.getPowerSettings\(\)/);
  assert.match(server, /buildWriteReadinessEvidence/);
  assert.doesNotMatch(server, /adapter\.setLongLifeCharging\(/);
});


test("WRITE readiness is runtime-gated centrally and read-only GET/POST compatible", () => {
  assert.match(applicationClient, /writeReadinessProtocol !== protocol\.writeReadinessProtocol/);
  assert.match(app, /WRITE readiness endpoint không khớp runtime hiện tại/);
  assert.match(server, /writeReadinessProtocol:NC03_RUNTIME_PROTOCOL\.writeReadinessProtocol/);
  assert.match(server, /pathname === "\/api\/nc03\/write-readiness"/);
  assert.match(server, /\["GET","POST"\]\.includes\(req\.method \|\| "GET"\)/);
  assert.match(server, /body = req\.method === "GET" \? \{\} : await readJsonBody\(req\)/);
  assert.match(server, /body\.baseUrl \|\| DEFAULT_MODEM_BASE_URL/);
});


test("PWA upgrade self-heals an already-open stale frontend", () => {
  const worker = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(worker, /staleKeys = keys\.filter/);
  assert.match(worker, /self\.clients\.claim\(\)/);
  assert.match(worker, /self\.clients\.matchAll\(\{ type:"window", includeUncontrolled:true \}\)/);
  assert.match(worker, /client\.navigate\(client\.url\)/);
  assert.match(worker, /if \(!staleKeys\.length\) return/);
});


test("login uses the address currently typed in the login form", () => {
  assert.match(app, /const addressInput = document\.querySelector\("#loginBaseUrl"\)/);
  assert.match(app, /state\.baseUrl = normalizeModemAddress\(addressInput\?\.value \|\| state\.baseUrl\)/);
  assert.match(app, /persist\(\)/);
});


test("login readiness exposes missing runtime evidence without exposing login secrets", () => {
  assert.match(server, /evidence:\{/);
  assert.match(server, /usernameHmac:Boolean\(recipe\.evidence\?\.usernameHmac\)/);
  assert.match(server, /passwordInput:Boolean\(recipe\.evidence\?\.passwordInput\)/);
  assert.match(app, /Thiếu bằng chứng runtime/);
  assert.match(app, /username source/);
  assert.match(app, /password input/);
});


test("real login and post-login verification share one in-memory modem session transport", () => {
  assert.match(server, /const modemSessions = new Map\(\)/);
  assert.match(server, /createCookieAwareFetch/);
  assert.match(server, /const session = modemSessionTransport\(baseUrl\)/);
  assert.match(server, /fetchImpl:session\.fetchImpl/);
  assert.match(server, /const verified = await modemAdapter\(baseUrl\)\.connect\(\)/);
  assert.match(server, /session\.jar\.clear\(\)/);
});


test("Long Life guarded runtime remains implemented but UI authority is fail-closed by canonical registry", () => {
  assert.match(app, /canWriteSetting\("power\.long-life"\)/);
  assert.match(app, /Capability power\.long-life chưa WRITE VERIFIED/);
  assert.match(app, /toggleLongLifeChargingSwitch/);
  assert.match(server, /async function writeLongLifeCharging/);
  assert.match(server, /verifyPowerReadback/);
  assert.match(server, /executeRollback/);
  assert.match(server, /WRITE_POSTCONDITION_FAILED/);
  assert.match(server, /settingsWriteProtocol:NC03_RUNTIME_PROTOCOL\.settingsWriteProtocol/);
});


test("Settings Center mirrors stock Web UI groups while locked controls stay non-writing", () => {
  assert.match(app, /NC03 SETTINGS/);
  for (const group of ["mobile","wifi","lan","connectivity","power","security","system"]) {
    assert.ok(app.includes(`["${group}"`), group);
  }
  assert.match(app, /data-settings-section=/);
  assert.match(app, /data-write="locked"/);
  assert.match(app, /switch-control/);
  assert.match(app, /registryLockedText\("wifi\.password"/);
  assert.match(app, /Không đọc\/hiển thị PSK hiện tại/);
  assert.match(app, /toggleLongLifeChargingSwitch/);
  assert.match(app, /data-settings-ap/);
});


test("WP01 stock Web UI audit remains local, read-only and structure-only", () => {
  assert.match(server, /\/api\/nc03\/stock-ui-audit/);
  assert.match(server, /buildStockWebUiAudit/);
  assert.match(server, /stockUiAuditDiscoveryPaths/);
  assert.match(app, /STOCK WEB UI AUDIT · WP01/);
  assert.match(app, /Quét Web UI gốc/);
  assert.match(app, /STRUCTURE ONLY/);
  assert.match(app, /downloadStockUiAudit/);
  assert.match(applicationClient, /stockUiAuditSchema/);
  assert.doesNotMatch(app, /\/api\/nc03\/stock-ui-audit/);
  assert.doesNotMatch(server, /stockUiAudit[\s\S]{0,500}executeJsonToggleWrite/);
});


test("WP01 stock Web UI audit reuses authenticated modem session transport for protected stock UI pages", () => {
  assert.match(server, /const session = modemSessionTransport\(baseUrl\)/);
  assert.match(server, /fetchStaticSource\(baseUrl, path, \{ fetchImpl:session\.fetchImpl \}\)/);
  assert.match(server, /AUTHENTICATED_SURFACE_CAPTURED/);
  assert.match(server, /missingPagePaths/);
  assert.match(app, /AUTHENTICATED COVERAGE/);
  assert.match(app, /protected pages/);
});


test("Settings UI consumes canonical registry metadata and contains no vendor write route authority", () => {
  assert.match(app, /NC03_SETTINGS_REGISTRY/);
  assert.match(app, /settingDefinition/);
  assert.match(app, /registryLockedToggle/);
  assert.match(app, /registryCapabilityNote/);
  const start=app.indexOf("function renderSettingsMobile");
  const end=app.indexOf("function renderSettings()",start);
  const settingsBlock=app.slice(start,end);
  assert.doesNotMatch(settingsBlock,/\/action\//);
  assert.doesNotMatch(settingsBlock,/\/goform\//);
});


test("Product UI delegates Local Bridge transport to the application boundary", () => {
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  assert.doesNotMatch(app, /\/api\/nc03\//);
  assert.match(app, /new NC03ControlClient\(\)/);
  assert.match(applicationClient, /async health\(\)/);
  assert.match(applicationClient, /getSnapshot\(baseUrl\)/);
  assert.match(applicationClient, /getDetails\(baseUrl\)/);
  assert.match(applicationClient, /login\(baseUrl, password\)/);
});


test("WP04 PWA cache includes application-layer runtime modules", () => {
  assert.match(sw, /nc03-control-center-v39-auth-session-v083/);
  assert.match(sw, /src\/application\/NC03ControlClient\.js/);
  assert.match(sw, /src\/application\/NC03AuthSessionStateMachine\.js/);
  assert.match(sw, /src\/domain\/NC03SettingsRegistry\.js/);
});
