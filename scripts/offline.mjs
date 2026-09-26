import fs from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";

const requiredDist = [
  "index.html",
  "app.js",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  "icon.svg",
  "report.html",
  "report.css",
  "report.js",
  "src/modem/NC03Adapter.js",
  "src/modem/HarDiscovery.js",
  "src/ui/NavigationModel.js"
];

for (const file of requiredDist) {
  assert.ok(fs.existsSync(path.join("dist", file)), `Offline artifact missing: ${file}`);
}

const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
assert.equal(manifest.id, "./");
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
assert.equal(manifest.display, "standalone");
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, "PWA manifest needs an app icon.");
assert.equal(manifest.icons[0].src, "./icon.svg");

const sw = fs.readFileSync("sw.js", "utf8");
for (const asset of ["./index.html","./app.js","./styles.css","./manifest.webmanifest","./icon.svg","./report.html","./report.css","./report.js","./src/ui/DiagnosticReport.js"]) {
  assert.ok(sw.includes(`"${asset}"`), `Service worker cache is missing ${asset}`);
}
assert.match(sw, /caches\.open\(CACHE\)/);
assert.match(sw, /caches\.match\(event\.request\)/);
assert.match(sw, /const response = await fetch\(event\.request, \{ cache:"no-store" \}\)/);
assert.match(sw, /await cache\.put\(event\.request, response\.clone\(\)\)/);
assert.match(sw, /const cached = await cache\.match\(event\.request\)/);
assert.match(sw, /return cached \|\| new Response\("Offline"/);
assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);

const app = fs.readFileSync("app.js", "utf8");
assert.match(app, /serviceWorker\.register\("\.\/sw\.js"\)/);
assert.match(app, /registration\.update\(\)/);

const report = fs.readFileSync("report.html", "utf8");
assert.match(report, /Content-Security-Policy/);
assert.match(report, /\.\/report\.css/);
assert.match(report, /\.\/report\.js/);

const index = fs.readFileSync("index.html", "utf8");
assert.match(index, /rel="manifest"/);
assert.match(index, /rel="icon"/);

console.log("OFFLINE PASS");
