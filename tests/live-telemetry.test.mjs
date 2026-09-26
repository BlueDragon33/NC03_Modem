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
  assert.match(app, /setInterval\(\(\) => \{ refreshLive\(\)/);
  assert.match(app, /function renderAlwaysOnStatus/);
  for (const label of ["PIN", "KẾT NỐI", "SÓNG", "MẠNG", "10 giây"]) assert.ok(app.includes(label));
});

test("local bridge exposes read-only snapshot and details endpoints", () => {
  assert.match(server, /\/api\/nc03\/snapshot/);
  assert.match(server, /\/api\/nc03\/details/);
  assert.match(server, /adapter\.getLiveSnapshot\(\)/);
  assert.match(server, /adapter\.getAdvancedSnapshot\(\)/);
  assert.match(server, /isPrivateIpv4/);
  assert.match(server, /MODEM_ORIGIN_NOT_PRIVATE/);
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
