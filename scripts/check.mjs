import fs from "node:fs";
import path from "node:path";

const required = [
  "index.html", "app.js", "styles.css", "manifest.webmanifest", "sw.js",
  "src/modem/NC03Adapter.js", "src/modem/MockNC03Adapter.js", "src/modem/HarDiscovery.js",
  "docs/API_DISCOVERY.md", "docs/SECURITY.md"
];

for (const file of required) {
  if (!fs.existsSync(path.resolve(file))) throw new Error(`Missing required file: ${file}`);
}

const files = required.filter((file) => file.endsWith(".js") || file.endsWith(".html")).map((file) => [file, fs.readFileSync(file,"utf8")]);
for (const [file, content] of files) {
  if (/console\.log\s*\(/.test(content)) throw new Error(`Debug console.log is not allowed: ${file}`);
  if (/adminPassword\s*=\s*["'][^"']+["']/.test(content)) throw new Error(`Hard-coded admin password detected: ${file}`);
}

console.log("CHECK PASS");
