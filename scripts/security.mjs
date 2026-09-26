import fs from "node:fs";
import assert from "node:assert/strict";
import { redactHeaders, redactUrl, sanitizeBody } from "../src/modem/HarDiscovery.js";

const runtime = ["app.js", "report.js", "src/ui/DiagnosticReport.js", ...fs.readdirSync("src/modem").filter((f)=>f.endsWith(".js")).map((f)=>`src/modem/${f}`)];
for (const file of runtime) {
  const content = fs.readFileSync(file, "utf8");
  assert.ok(!/(?:localStorage|sessionStorage)\.(?:setItem|getItem)\([^\n)]*(?:password|token|session)/i.test(content), `Sensitive storage API pattern in ${file}`);
  assert.ok(!/Authorization:\s*Bearer\s+[A-Za-z0-9._-]{8,}/i.test(content), `Hard-coded bearer token in ${file}`);
}
assert.equal(redactHeaders([{name:"Authorization",value:"Bearer abc"}])[0].value, "****");
assert.match(redactUrl("http://192.168.0.1/?token=secret"), /token=\*\*\*\*/);
assert.equal(JSON.parse(sanitizeBody('{"password":"secret"}')).password, "****");
console.log("SECURITY PASS");

const reportJs = fs.readFileSync("report.js", "utf8");
const reportHtml = fs.readFileSync("report.html", "utf8");
assert.doesNotMatch(reportJs, /innerHTML\s*=\s*.*message/);
assert.doesNotMatch(reportHtml, /onclick=|onload=|onerror=/i);
assert.match(reportHtml, /Content-Security-Policy/);

const serveLocal = fs.readFileSync("scripts/serve-local.mjs", "utf8");
assert.match(serveLocal, /normalizeModemBaseUrl\(body\.baseUrl\)/, "AUTH source probe must stay behind RFC1918 modem-origin policy.");
assert.match(serveLocal, /sourceCodeReturned:false|sourceCodeReturned/, "AUTH source report must explicitly avoid raw source output.");
