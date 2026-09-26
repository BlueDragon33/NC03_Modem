import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const contract = JSON.parse(fs.readFileSync(new URL("../control/application-management.contract.json", import.meta.url), "utf8"));
const build = fs.readFileSync(new URL("../scripts/build.mjs", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../scripts/serve-local.mjs", import.meta.url), "utf8");

test("NC03 publishes a classification-only Application Management contract", () => {
  assert.equal(contract.schema, "application-management.contract/v1");
  assert.equal(contract.application.id, "nc03-modem");
  assert.equal(contract.application.category, "Kỹ thuật");
  assert.equal(contract.application.repository, "BlueDragon33/NC03_Modem");
  assert.equal(contract.policy.remoteAdminReady, false);
  assert.equal(contract.policy.modemSecretsInControlPlane, false);
  assert.equal(contract.policy.modemCommandsFromCloud, false);
  assert.equal(contract.capabilities.webLaunch, true);
  assert.equal(contract.capabilities.deviceRegistry, false);
});

test("verified Pages artifact includes the management contract", () => {
  assert.match(build, /fs\.cpSync\(path\.resolve\("control"\)/);
});


test("local runtime exposes live Application Management discovery and status endpoints", () => {
  assert.match(server, /\/api\/application-management\/contract/);
  assert.match(server, /\/api\/control\/status/);
  assert.match(server, /applicationId:"nc03-modem"/);
  assert.match(server, /contractConnected:true/);
  assert.match(server, /remoteAdminReady:false/);
  assert.match(server, /managementMode:"local-first"/);
  assert.match(server, /existsSync\(join\(distRoot, "index.html"\)\)/);
});


test("v0.6.2 contract advertises resilient live telemetry without changing modem credential boundary", () => {
  assert.equal(contract.application.version, "0.6.2");
  assert.equal(contract.policy.lastKnownGoodTelemetry, true);
  assert.equal(contract.policy.staleTelemetryExplicitlyMarked, true);
  assert.equal(contract.policy.uiBridgeOriginPolicyUnified, true);
  assert.equal(contract.policy.modemSecretsInControlPlane, false);
  assert.equal(contract.policy.modemCommandsFromCloud, false);
});
