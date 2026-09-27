import test from "node:test";
import assert from "node:assert/strict";
import { buildWriteReadinessEvidence } from "../src/modem/WriteSourceDiscovery.js";

const SOURCE = [
  'function setSafeCharge(){',
  '  var postdata={};',
  '  postdata.safe_charge=$("#safe_charge").val();',
  '  saveAjaxJsonData("/action/device_set_battery_safe_charge",postdata,function(obj){',
  '    if(obj.retcode===0){}',
  '  });',
  '}'
].join("\n");

test("maps the low-risk safe-charge write candidate without enabling write", () => {
  const report = buildWriteReadinessEvidence(
    [{path:"/js/systemadmin.js",source:SOURCE}],
    {currentState:{device_bat_safe_charge_switch:"enable",device_charge_long_life:"1"}}
  );
  assert.equal(report.target.endpoint, "/action/device_set_battery_safe_charge");
  assert.equal(report.endpointMapped, true);
  assert.equal(report.requestShapeMapped, true);
  assert.equal(report.transportMapped, true);
  assert.equal(report.currentReadbackPresent, true);
  assert.equal(report.captureReady, true);
  assert.equal(report.status, "CAPTURE_REQUIRED");
  assert.equal(report.writeEnabled, false);
  assert.equal(report.rollbackReady, false);
  assert.ok(report.fieldCandidates.includes("safe_charge"));
  assert.ok(report.transportHelpers.includes("saveAjaxJsonData"));
  assert.equal(report.safety.writeExecuted, false);
});

test("requires current readback before a reversible capture is considered ready", () => {
  const report = buildWriteReadinessEvidence(
    [{path:"/js/systemadmin.js",source:SOURCE}],
    {currentState:{}}
  );
  assert.equal(report.currentReadbackPresent, false);
  assert.equal(report.captureReady, false);
  assert.equal(report.status, "SOURCE_EVIDENCE_INCOMPLETE");
  assert.equal(report.rollbackPlan.ready, false);
});

test("redacts unrelated string literals while preserving safe toggle candidates only", () => {
  const secret = "DO_NOT_EXPOSE";
  const source = [
    'function setSafeCharge(){',
    '  var postdata={};',
    '  postdata.safe_charge="enable";',
    '  postdata.note="' + secret + '";',
    '  saveAjaxJsonData("/action/device_set_battery_safe_charge",postdata,function(){});',
    '}'
  ].join("\n");
  const report = buildWriteReadinessEvidence(
    [{path:"/js/systemadmin.js",source}],
    {currentState:{device_bat_safe_charge_switch:"disable"}}
  );
  assert.ok(report.safeLiteralCandidates.includes("enable"));
  assert.doesNotMatch(JSON.stringify(report), new RegExp(secret));
  assert.equal(report.safety.rawSourceReturned, false);
});
