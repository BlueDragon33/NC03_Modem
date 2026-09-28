import fs from "node:fs";
import path from "node:path";

const required = [
  "index.html", "app.js", "styles.css", "manifest.webmanifest", "sw.js", "icon.svg", "report.html", "report.css", "report.js",
  "src/modem/NC03Adapter.js", "src/modem/MockNC03Adapter.js", "src/modem/HarDiscovery.js",
  "src/modem/NC03Auth.js", "src/modem/NC03Api.js", "src/modem/NC03Session.js", "src/modem/NC03LocalCookieJar.js",
  "src/modem/NC03Parser.js", "src/modem/NC03Capabilities.js", "src/domain/NC03SettingsRegistry.js", "src/domain/NC03ReadModel.js", "src/application/NC03ControlClient.js", "src/modem/ConnectionState.js",
  "src/modem/NC03Firmware80042Profile.js", "src/modem/NC03Firmware80042Adapter.js", "src/modem/NC03Har2Profile.js", "src/modem/NC03SafeWriteRuntime.js", "src/modem/NC03GuardedWriteEngine.js", "src/modem/StockWebUiAudit.js", "src/modem/LocalBridgePolicy.js", "src/modem/LoginPolicy.js",
  "src/ui/NavigationModel.js", "src/ui/DiagnosticReport.js", "docs/API_DISCOVERY.md", "docs/AUTH_DISCOVERY.md", "docs/SECURITY.md", "docs/ARCHITECTURE.md",
  "docs/PHASE_STATUS.md", "docs/NC03-ARCHITECTURE-CONSOLIDATION.md", "control/nc03-architecture-boundaries.v1.json", "CHANGELOG.md", "scripts/offline.mjs", "scripts/analyze-har.mjs"
];

for (const file of required) {
  if (!fs.existsSync(path.resolve(file))) throw new Error(`Missing required file: ${file}`);
}

const app = fs.readFileSync("app.js","utf8");
if (!app.includes("function renderLogin()")) throw new Error("Login Screen skeleton is required in Phase 1.");
if (!app.includes("Advanced Developer Mode")) throw new Error("Developer Mode boundary is required.");
if (/fetch\s*\(\s*["']http:\/\/192\.168\.0\.1/.test(app)) throw new Error("UI must not call NC03 endpoint directly.");
console.log("CHECK PASS");
