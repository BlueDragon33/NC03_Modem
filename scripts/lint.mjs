import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".js") || entry.name.endsWith(".html") ? [full] : [];
  });
}

const files = ["app.js", "index.html", ...walk("src")];
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  if (/console\.(log|debug|info)\s*\(/.test(content)) throw new Error(`Debug console call in runtime source: ${file}`);
  if (/fetch\s*\(\s*["']http:\/\/192\.168\.0\.1/.test(content)) throw new Error(`Direct NC03 fetch outside adapter boundary: ${file}`);
  if (/password\s*[:=]\s*["'][^"'*]{3,}["']/i.test(content)) throw new Error(`Possible plaintext password in source: ${file}`);
}
console.log("LINT PASS");
