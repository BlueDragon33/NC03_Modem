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
  assert.match(app, /else updateLiveTelemetryDom\(\)/);
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
