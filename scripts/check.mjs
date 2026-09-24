import fs from "node:fs";
import path from "node:path";

const required = [
  "index.html", "app.js", "styles.css", "manifest.webmanifest", "sw.js",
  "src/modem/NC03Adapter.js", "src/modem/MockNC03Adapter.js", "src/modem/HarDiscovery.js",
  "docs/API_DISCOVERY.md", "docs/SECURITY.md", "docs/ARCHITECTURE.md"
];

for (const file of required) {
  if (!fs.existsSync(path.resolve(file))) throw new Error(`Missing required file: ${file}`);
}

const files = required.filter((file) => file.endsWith(".js") || file.endsWith(".html")).map((file) => [file, fs.readFileSync(file,"utf8")]);
for (const [file, content] of files) {
  if (/console\.log\s*\(/.test(content)) throw new Error(`Debug console.log is not allowed: ${file}`);
  if (/adminPassword\s*=\s*["'][^"']+["']/.test(content)) throw new Error(`Hard-coded admin password detected: ${file}`);
}
const app = fs.readFileSync("app.js","utf8");
if (!app.includes("function renderLogin()")) throw new Error("Login Screen skeleton is required in Phase 1.");
if (/fetch\s*\(\s*["']http:\/\/192\.168\.0\.1/.test(app)) throw new Error("UI must not call NC03 endpoint directly.");
console.log("CHECK PASS");
