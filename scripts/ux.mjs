import fs from "node:fs";
import assert from "node:assert/strict";
import { PRIMARY_NAV } from "../src/ui/NavigationModel.js";

assert.deepEqual(PRIMARY_NAV.map((item) => item.id), ["home","network","wifi","devices","settings"]);
const app = fs.readFileSync("app.js", "utf8");
assert.ok(app.includes("Advanced Developer Mode"));
assert.ok(!app.includes('["discovery","API Discovery"]'), "Discovery must not be a normal quick action.");
const css = fs.readFileSync("styles.css", "utf8");
assert.ok(css.includes(".mobile-nav"));
assert.ok(css.includes("min-height:44px"), "Interactive controls must keep a 44px touch target.");
assert.ok(css.includes("button:focus-visible"), "Keyboard focus must remain visible.");
assert.ok(css.includes("repeat(4,minmax(0,1fr))"), "Desktop quick actions should use four balanced columns.");
assert.ok(app.includes("Báo cáo chẩn đoán an toàn"), "Settings must expose the safe diagnostic report.");
assert.ok(app.includes("HAR Evidence Lab"), "Developer Mode must expose the local HAR Evidence Lab.");
assert.ok(app.includes("AUTH EVIDENCE"), "HAR Evidence Lab must split authentication evidence.");
assert.ok(app.includes("WRITE EVIDENCE"), "HAR Evidence Lab must split write evidence.");
assert.ok(app.includes("downloadHarEvidence"), "Sanitized evidence export must remain available.");
assert.ok(app.includes("CHẤT LƯỢNG CAPTURE"), "HAR lab must explain whether a capture is usable for AUTH mapping.");
assert.ok(app.includes("AUTHENTICATED_SESSION_ONLY") || app.includes("authCaptureStatus"), "HAR lab must surface capture quality status.");
assert.ok(app.includes("không upload credential lên cloud"), "Local privacy boundary must be explicit.");
assert.ok(app.includes("Snapshot hiện tại"), "Fresh client counts must use snapshot wording instead of implying a persistent online state.");
console.log("UX PASS");

assert.ok(css.includes(".evidence-summary"), "HAR evidence summary layout is required.");
assert.ok(css.includes(".har-privacy-banner"), "HAR privacy warning must remain visible.");

assert.ok(css.includes(".capture-quality"), "Capture-quality guidance layout is required.");

assert.ok(app.includes("CONNECTION DOCTOR"), "Settings must expose Connection Doctor.");
assert.ok(css.includes(".doctor-checks"), "Connection Doctor responsive layout is required.");

assert.ok(app.includes("AUTH SOURCE PROBE"), "Developer Lab must expose AUTH Source Probe.");
assert.ok(app.includes("runAuthSourceProbe"), "AUTH Source Probe action is required.");
assert.ok(css.includes(".source-evidence-grid"), "AUTH source evidence must have responsive layout.");

assert.ok(app.indexOf("DEVELOPER TOOLS") < app.indexOf("MODEM CONNECTION"), "Developer tools must be prominent near the top of Settings.");
assert.ok(app.includes("Bật Developer Mode để mở Lab"), "HAR Lab entry must remain visible even before Developer Mode is enabled.");

assert.ok(app.includes("Login submit endpoint"), "AUTH Source Probe must surface login-submit candidates separately.");
assert.ok(app.includes("Request field candidates"), "AUTH Source Probe must surface structural request fields.");

assert.ok(app.includes("PROBE DIAGNOSTICS"), "AUTH probe must show safe per-path diagnostics.");
assert.ok(css.includes(".probe-diagnostics"), "AUTH probe diagnostics need a readable layout.");

assert.ok(app.includes("callsite-grid"), "AUTH lab must render endpoint-specific callsite evidence.");
assert.ok(css.includes(".callsite-grid"), "Login callsite evidence needs responsive layout.");

assert.ok(app.includes("Argument shape"), "Login call evidence must expose sanitized argument shape.");
assert.ok(app.includes("Transforms quanh call"), "Login call evidence must expose codec transforms.");
assert.ok(css.includes(".call-shape-block"), "Call-shape evidence needs readable structure.");

assert.ok(app.includes("Payload structural trace"), "AUTH lab must show payload structural trace.");
assert.ok(app.includes("RESPONSE CODE MAP"), "AUTH lab must show response-code symbol mapping when available.");
assert.ok(css.includes(".response-code-map"), "Response-code evidence needs readable layout.");

assert.ok(app.includes("Payload origin trace · toàn file login.js"), "AUTH lab must surface payload origins beyond the login() body.");
assert.ok(app.includes("Payload aliases"), "AUTH lab must surface payload aliases.");

assert.ok(app.includes("Request object dependency trace"), "AUTH lab must trace the object serialized into postdata.");
assert.ok(app.includes("Login object fields / transforms"), "AUTH lab must show request-object field transforms.");
assert.ok(app.includes("authDependencyMapped"), "AUTH lab must expose the request-object AUTH mapping state.");

assert.ok(app.includes("Nested AUTH transform"), "AUTH lab must surface outer HMAC/MD5 transforms around nested input calls.");

assert.ok(app.includes("Password field dataflow"), "AUTH lab must surface password field dataflow.");
assert.ok(app.includes("Password recipe status"), "AUTH lab must show password recipe readiness.");

assert.ok(app.includes("LOCAL_BRIDGE_RESTART_REQUIRED"), "AUTH lab must diagnose stale Local Bridge process state.");
