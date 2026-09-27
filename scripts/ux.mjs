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
assert.ok(app.includes("Báo cáo chẩn đoán"), "Settings must expose the safe diagnostic report.");
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

assert.ok(app.includes("NC03 SETTINGS"), "Settings must use the modem-style Settings Center shell.");
assert.ok(app.includes('["wifi","Wi-Fi"'), "Settings must expose a Wi-Fi category like the stock Web UI.");
assert.ok(app.includes('["lan","LAN / DHCP"'), "Settings must expose a LAN/DHCP category like the stock Web UI.");
assert.ok(app.includes('["power","Pin / Nguồn"'), "Settings must expose a Power category like the stock Web UI.");
assert.ok(app.includes("Bật Developer Mode để mở Lab"), "HAR Lab entry must remain visible from the System settings category.");

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

assert.ok(app.includes("AUTH VERIFIED"), "Login UI must visibly show the verified AUTH gate.");
assert.ok(app.includes('id="loginSubmit"'), "Verified AUTH must expose a real login action.");
assert.ok(app.includes("Mã hóa cục bộ AES-GCM"), "Remember-password UX must disclose local encrypted storage.");
assert.ok(css.includes(".auth-readiness"), "AUTH readiness state needs visible styling.");
assert.ok(css.includes(".remember-option"), "Remember-password control needs explicit styling.");

assert.ok(app.includes("AUTH VERIFIED"), "Login UI must visibly show the verified AUTH gate.");
assert.ok(app.includes('id="loginSubmit"'), "Verified AUTH must expose a real login action.");
assert.ok(css.includes(".auth-readiness"), "AUTH readiness state needs visible styling.");
assert.ok(css.includes(".remember-option"), "Remember option needs explicit styling.");

assert.ok(app.includes("bootstrapRuntime"), "App startup must perform the AUTH/runtime handshake before settling the first screen.");
assert.ok(app.includes("Xác thực lại NC03"), "Expired modem sessions need an explicit re-authentication UX.");

assert.ok(app.includes("WRITE READINESS LAB"), "Developer evidence workflow must expose reversible write planning.");
assert.ok(app.includes("Live write: LOCKED"), "Write Readiness Lab must visibly keep live writes locked.");

assert.ok(app.includes("WRITE readiness endpoint không khớp runtime hiện tại"), "WRITE Lab must diagnose stale/mismatched local runtime explicitly.");


assert.ok(css.includes(".webui-settings-shell"), "WebUI-style settings shell layout is required.");
assert.ok(css.includes(".webui-settings-nav"), "Settings category navigation must be responsive.");
assert.ok(css.includes(".switch-control"), "Settings toggles must look and behave like modem controls.");
assert.ok(app.includes("WRITE coverage"), "Settings must disclose guarded-write coverage instead of implying every field is writable.");
assert.ok(app.includes("Không đọc/hiển thị PSK hiện tại"), "Wi-Fi settings must never prefill the current PSK.");
