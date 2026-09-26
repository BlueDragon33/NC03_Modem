import fs from "node:fs";
import path from "node:path";
import { buildHarEvidenceReport } from "../src/modem/HarDiscovery.js";

const args = process.argv.slice(2);
const harPath = args.find((arg) => !arg.startsWith("--"));
const hostArg = args.find((arg) => arg.startsWith("--host="));

if (!harPath) {
  process.stderr.write("Usage: npm run analyze:har -- <capture.har> [--host=192.168.0.1]\n");
  process.exitCode = 2;
} else {
  const fullPath = path.resolve(harPath);
  const modemHost = hostArg ? hostArg.slice("--host=".length).trim() : "192.168.0.1";
  const raw = fs.readFileSync(fullPath, "utf8");
  const har = JSON.parse(raw);
  const report = buildHarEvidenceReport(har, { modemHost });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
