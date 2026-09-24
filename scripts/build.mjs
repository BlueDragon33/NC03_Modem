import fs from "node:fs";
import path from "node:path";

const out = path.resolve("dist");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of ["index.html","app.js","styles.css","manifest.webmanifest","sw.js"]) {
  fs.copyFileSync(path.resolve(file), path.join(out, file));
}
fs.cpSync(path.resolve("src"), path.join(out, "src"), { recursive: true });

console.log("BUILD PASS");
