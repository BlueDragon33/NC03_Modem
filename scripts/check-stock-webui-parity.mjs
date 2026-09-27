import fs from "node:fs";
import assert from "node:assert/strict";

const inv=JSON.parse(fs.readFileSync("evidence/stock-webui-parity.v1.json","utf8"));
const expectedFamilies=[
  "mobile-network","wifi","lan-dhcp-routing","usb-bridge-ethernet",
  "power-battery-display","security-wps-firewall-dmz",
  "system-time-firmware-admin","devices-clients"
];
const allowedRead=new Set([
  "VERIFIED","READ_VERIFIED","SOURCE_OBSERVED","INTENTIONALLY_NOT_MIRRORED",
  "COUNT_ONLY","UNMAPPED","NOT_APPLICABLE"
]);
const allowedWrite=new Set([
  "VERIFIED","CANDIDATE","GUARDED_PENDING_HARDWARE_ACCEPTANCE",
  "UNMAPPED","NOT_APPLICABLE"
]);
const allowedDanger=new Set(["LOW","MEDIUM","HIGH","CRITICAL"]);
const allowedPrivacy=new Set(["NORMAL","LOCAL_SENSITIVE","SECRET"]);

assert.equal(inv.schemaVersion,"1.0.0");
assert.equal(inv.inventoryId,"nc03-stock-webui-parity");
assert.equal(inv.projectId,"project:nc03-modem");
assert.equal(inv.referenceFirmware,"NC03_8.00.42");
assert.equal(inv.workPackage,"NC03-WP01");
assert.equal(inv.humanReview.required,true);
assert.equal(inv.humanReview.requiredForCompletion,true);
assert.equal(inv.humanReview.state,"PENDING");

assert.deepEqual(inv.families,expectedFamilies);
assert.ok(Array.isArray(inv.rows) && inv.rows.length >= 70,"inventory unexpectedly small");

const ids=new Set();
const familyCounts=new Map(expectedFamilies.map((f)=>[f,0]));
for(const row of inv.rows){
  assert.match(row.id,/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/,`invalid id ${row.id}`);
  assert.ok(!ids.has(row.id),`duplicate row ${row.id}`);
  ids.add(row.id);
  assert.ok(expectedFamilies.includes(row.family),`unknown family ${row.family}`);
  familyCounts.set(row.family,familyCounts.get(row.family)+1);
  assert.equal(row.stockUiPresence,"PENDING_HUMAN_CONFIRMATION");
  assert.ok(allowedRead.has(row.readEvidence?.state),`bad read state ${row.id}`);
  assert.ok(allowedWrite.has(row.writeEvidence?.state),`bad write state ${row.id}`);
  assert.ok(allowedDanger.has(row.danger),`bad danger ${row.id}`);
  assert.ok(allowedPrivacy.has(row.privacy),`bad privacy ${row.id}`);

  if(row.writeEvidence?.state==="VERIFIED" || row.writeEvidence?.state==="CANDIDATE" || row.writeEvidence?.state==="GUARDED_PENDING_HARDWARE_ACCEPTANCE"){
    assert.ok(row.writeEvidence.route || row.writeEvidence.routes,`write evidence missing route ${row.id}`);
  }
  const readKeys=[
    ...(Array.isArray(row.readEvidence?.keys) ? row.readEvidence.keys : []),
    row.readEvidence?.keyTemplate ?? ""
  ].join(" ").toLowerCase();
  for(const forbidden of ["wifi_psk","password","passwd","sim_pin_value","iccid","imei","meid","esim_eid"]){
    assert.equal(readKeys.includes(forbidden),false,`secret-bearing read key leaked into inventory: ${row.id} / ${forbidden}`);
  }
}
for(const [family,count] of familyCounts) assert.ok(count>0,`empty family ${family}`);

for(const required of [
  "auth.login","wifi.password","lan.gateway","connectivity.bridge-enable",
  "power.long-life","security.dmz-enable","system.reboot","devices.connected-list"
]) assert.ok(ids.has(required),`missing sentinel row ${required}`);

assert.ok(inv.knownWriteRoutes.includes("/action/wifi_set_ap_params"));
assert.ok(inv.knownWriteRoutes.includes("/action/router_set_dhcp_params"));
assert.ok(inv.knownWriteRoutes.includes("/action/reboot"));
assert.ok(inv.unresolved.some((x)=>/Human confirmation/.test(x)));
assert.ok(fs.existsSync("docs/NC03-STOCK-WEBUI-PARITY.md"));

console.log(`WP01 STOCK WEB UI INVENTORY PASS · ${inv.rows.length} rows · human review pending`);
