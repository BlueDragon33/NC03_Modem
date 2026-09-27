import test from "node:test";
import assert from "node:assert/strict";
import { buildWriteReadinessEvidence } from "../src/modem/WriteSourceDiscovery.js";
import { buildReversibleTogglePlan, executeJsonToggleWrite, executeRollback, readbackMatches } from "../src/modem/NC03SafeWriteRuntime.js";

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


test("builds a reversible toggle plan only from mapped endpoint, field and known readback values", () => {
  const evidence = {
    target:{ endpoint:"/action/device_set_battery_safe_charge", readbackKeys:["device_charge_long_life"] },
    endpointMapped:true,
    requestShapeMapped:true,
    transportMapped:true,
    fieldCandidates:["safe_charge"]
  };
  const plan = buildReversibleTogglePlan({
    evidence,
    currentState:{ device_charge_long_life:"disable" },
    desiredEnabled:true
  });
  assert.equal(plan.ready, true);
  assert.equal(plan.payloadField, "safe_charge");
  assert.deepEqual(plan.payload, { safe_charge:"enable" });
  assert.deepEqual(plan.rollbackPayload, { safe_charge:"disable" });
  assert.equal(plan.originalEnabled, false);
});

test("reversible toggle planner fails closed on ambiguous write fields", () => {
  const plan = buildReversibleTogglePlan({
    evidence:{
      target:{ endpoint:"/action/device_set_battery_safe_charge", readbackKeys:["device_charge_long_life"] },
      endpointMapped:true,
      requestShapeMapped:true,
      transportMapped:true,
      fieldCandidates:["first_field","second_field"]
    },
    currentState:{ device_charge_long_life:"enable" },
    desiredEnabled:false
  });
  assert.equal(plan.ready, false);
  assert.equal(plan.code, "WRITE_FIELD_AMBIGUOUS");
});

test("guarded toggle write requires retcode zero and supports explicit rollback", async () => {
  const calls = [];
  const fetchImpl = async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return { ok:true, status:200, json:async()=>({retcode:0}) };
  };
  const plan = {
    ready:true,
    endpoint:"/action/device_set_battery_safe_charge",
    payload:{ safe_charge:"enable" },
    rollbackPayload:{ safe_charge:"disable" }
  };
  const transport = { ready:true, method:"POST", contentType:"application/json; charset=UTF-8" };
  assert.equal((await executeJsonToggleWrite({baseUrl:"http://192.168.0.1",plan,transport,fetchImpl})).ok, true);
  assert.equal((await executeRollback({baseUrl:"http://192.168.0.1",plan,transport,fetchImpl})).ok, true);
  assert.deepEqual(calls, [{safe_charge:"enable"},{safe_charge:"disable"}]);
  assert.equal(readbackMatches("enable", true), true);
  assert.equal(readbackMatches("disable", false), true);
});
