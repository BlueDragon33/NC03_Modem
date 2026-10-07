import fs from "node:fs";

function fail(message) {
  console.error("[constitution-1.2] " + message);
  process.exitCode = 1;
}

const adoption = JSON.parse(
  fs.readFileSync(".blueprint/constitution-adoption.json", "utf8")
);
const budget = JSON.parse(
  fs.readFileSync("control/dependency-budget.json", "utf8")
);

if (adoption.policyVersion !== "1.2.0") fail("policyVersion must be 1.2.0");
if (!adoption.inheritedPillars.includes("operational-sovereignty-dependency-minimization")) {
  fail("operational sovereignty pillar missing");
}
if (budget.policyVersion !== "1.2.0") fail("dependency budget policyVersion mismatch");
if (budget.projectId !== adoption.projectId) fail("dependency budget projectId mismatch");
if (budget.posture !== "LOCAL_CORE") fail("NC03 must remain LOCAL_CORE");

const deps = new Map(budget.dependencies.map((item) => [item.id, item]));
const appManager = deps.get("application-management");
if (!appManager || appManager.class !== "OPTIONAL_SYNC") {
  fail("Application Management must remain optional for modem control");
}
const drive = deps.get("google-drive-or-equivalent");
if (!drive || drive.class !== "OPTIONAL_SYNC") {
  fail("Google Drive/equivalent may only be optional sync/archive");
}

const forbidden = new Set(budget.forbidden ?? []);
for (const id of [
  "cloud-required-modem-control",
  "drive-or-sheets-as-command-authority",
  "plaintext-modem-credentials-in-cloud",
  "remote-generic-shell-or-command-execution"
]) {
  if (!forbidden.has(id)) fail("missing forbidden dependency rule: " + id);
}

if (!process.exitCode) {
  console.log("[constitution-1.2] PASS NC03 local-control sovereignty + dependency budget");
}
