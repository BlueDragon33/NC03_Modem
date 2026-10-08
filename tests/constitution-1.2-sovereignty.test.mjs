import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=p=>fs.readFileSync(p,"utf8");
const json=p=>JSON.parse(read(p));

test("Constitution 1.2 keeps NC03 control local and cloud providers non-authoritative",()=>{
  const adoption=json(".blueprint/constitution-adoption.json");
  const budget=json("docs/DEPENDENCY_BUDGET.json");
  const constitution=read("docs/NC03-PROJECT-CONSTITUTION.md");
  const security=read("docs/SECURITY.md");

  assert.equal(adoption.policyVersion,"1.2.0");
  assert.ok(adoption.inheritedPillars.includes("operational-sovereignty-dependency-minimization"));
  assert.deepEqual(adoption.disabledPillars,[]);
  assert.deepEqual(adoption.constitutionalWaivers,[]);

  assert.equal(budget.constitutionPolicy,"blueprint-os:universal-century-grade@1.2.0");
  const byId=new Map(budget.dependencies.map(item=>[item.id,item]));
  assert.equal(byId.get("local-bridge")?.runtimeClass,"LOCAL_CORE");
  assert.equal(byId.get("credential-vault")?.runtimeClass,"LOCAL_CORE");
  assert.equal(byId.get("google-drive")?.runtimeClass,"OPTIONAL_SYNC");
  assert.equal(byId.get("google-sheets")?.runtimeClass,"OPTIONAL_SYNC");
  assert.equal(byId.get("google-apps-script")?.runtimeClass,"OPTIONAL_SYNC");
  assert.match(byId.get("google-drive")?.canonicalState ?? "",/forbidden/i);
  assert.match(byId.get("google-sheets")?.canonicalState ?? "",/forbidden/i);
  assert.match(byId.get("google-apps-script")?.dataBoundary ?? "",/never proxy modem commands/i);

  for(const required of [
    "NC03 admin password",
    "modem cookies or session identifiers",
    "authorization headers",
    "CSRF tokens",
    "bearer/session tokens",
    "Wi-Fi PSK",
    "WPS PIN",
    "modem command authority in Drive/Sheets/Apps Script"
  ]) assert.ok(budget.forbiddenRemoteData.includes(required),required);

  assert.match(constitution,/Live modem command transport remains local\/on-device/);
  assert.match(security,/must never receive modem passwords, cookies, authorization\/CSRF\/bearer\/session tokens/);
});
