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
  assert.match(app, /hadLive !== Boolean\(state\.live\)\) page\(\)/);
  assert.match(app, /updateLiveTelemetryDom\(\)/);
  assert.match(app, /visibilitychange/);
});

test("advanced UI exposes only safe mobile state and rule counts", () => {
  for (const label of ["Mobile Data", "SIM PIN protect", "Cloud SIM auto-switch", "DHCP reservations", "Port forwarding", "IPv4 packet filters", "IPv6 packet filters"]) {
    assert.ok(app.includes(label), label);
  }
  assert.ok(app.includes("Chỉ thống kê số lượng"));
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

test("remember-password UX cannot look enabled before real auth is verified", () => {
  assert.match(app, /Ghi nhớ mật khẩu/);
  assert.match(app, /Chưa hoạt động · sẽ bật mặc định sau khi AUTH VERIFIED/);
  assert.doesNotMatch(app, /id="rememberPassword"/);
  assert.doesNotMatch(app, /rememberPassword"\)\?\.addEventListener\("change"/);
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


test("local helper rejects malformed success envelopes instead of silently returning undefined", () => {
  assert.match(app, /MALFORMED_LOCAL_RESPONSE/);
  assert.match(app, /hasOwnProperty\.call\(payload, "payload"\)/);
});

test("AUTH Source Probe and Connection Doctor use the standard local API payload envelope", () => {
  assert.match(server, /payload:\{\s*baseUrl,\s*evidence,\s*diagnostics:/);
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
  assert.match(app, /localHealth\(\)/);
  assert.match(app, /PROBE DIAGNOSTICS/);
  assert.match(server, /diagnostics:\{/);
  assert.match(server, /Promise\.all\(paths\.map/);
  assert.match(server, /TIMEOUT/);
  assert.match(server, /REDIRECT/);
});
