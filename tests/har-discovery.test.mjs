import test from "node:test";
import assert from "node:assert/strict";
import { assessHarCaptureQuality, buildHarEvidenceReport, classifyHarCandidate, describeBody, detectHarModemHost, parseHar, redactHeaders, redactUrl, sanitizeBody, summarizeAuthCandidates, summarizeCandidates, summarizeWriteCandidates } from "../src/modem/HarDiscovery.js";

test("redacts sensitive headers and query", () => {
  assert.equal(redactHeaders([{name:"Cookie",value:"sid=123"}])[0].value, "****");
  assert.ok(redactUrl("http://192.168.0.1/api?token=abc&mode=5g").includes("token=****"));
  assert.match(redactUrl("http://192.168.0.1/api?token=abc&mode=5g"), /mode=5g/);
});

test("redacts JSON request body", () => {
  const safe = sanitizeBody(JSON.stringify({username:"admin",password:"123456",nested:{session:"xyz"}}));
  assert.equal(JSON.parse(safe).password, "****");
  assert.equal(JSON.parse(safe).nested.session, "****");
});

test("redacts form credentials while preserving field names for evidence mapping", () => {
  const safe = sanitizeBody("password=secret&mode=admin", "application/x-www-form-urlencoded");
  assert.equal(new URLSearchParams(safe).get("password"), "****");
  assert.deepEqual(describeBody("password=secret&mode=admin", "application/x-www-form-urlencoded"), {kind:"form",fields:["mode","password"]});
});

test("classifies likely modules without marking anything verified", () => {
  assert.deepEqual(classifyHarCandidate({path:"/api/battery/status"}), ["battery","system"]);
  assert.deepEqual(classifyHarCandidate({path:"/goform",requestBody:"goformId=LOGIN&password=secret"}), ["auth"]);
  assert.ok(classifyHarCandidate({path:"/api/wlan/clients"}).includes("wifi"));
  assert.ok(classifyHarCandidate({path:"/api/wlan/clients"}).includes("clients"));
});

test("parses only modem host, redacts secrets and summarizes candidate hints", () => {
  const har = {log:{entries:[
    {request:{method:"POST",url:"http://192.168.0.1/api/login?token=abc",headers:[{name:"Cookie",value:"sid=123"}],postData:{text:'{"password":"123456"}'}},response:{status:200,content:{mimeType:"application/json",size:5}},time:10},
    {request:{method:"GET",url:"http://192.168.0.1/api/status",headers:[]},response:{status:200,content:{mimeType:"application/json",size:5}},time:20},
    {request:{method:"GET",url:"https://example.com/x",headers:[]},response:{status:200,content:{}},time:1}
  ]}};
  const entries = parseHar(har);
  assert.equal(entries.length, 2);
  assert.ok(entries[0].url.includes("token=****"));
  assert.equal(JSON.parse(entries[0].requestBody).password, "****");
  assert.ok(entries[0].hints.includes("auth"));
  const candidates = summarizeCandidates(entries);
  assert.equal(candidates.length, 2);
  assert.ok(candidates.some(x => x.hints.includes("auth")));
});

test("auth evidence report exposes structure but never verifies or leaks credential values", () => {
  const har = {log:{entries:[{
    request:{method:"POST",url:"http://192.168.0.1/goform/login",headers:[{name:"Content-Type",value:"application/x-www-form-urlencoded"}],postData:{mimeType:"application/x-www-form-urlencoded",text:"password=super-secret&remember=1"}},
    response:{status:200,headers:[{name:"Set-Cookie",value:"sid=private"}],content:{mimeType:"application/json",text:'{"retcode":0,"session":"hidden"}',size:30}},time:12
  }]}};
  const entries = parseHar(har);
  const auth = summarizeAuthCandidates(entries);
  assert.equal(auth.length, 1);
  assert.equal(auth[0].verified, false);
  assert.ok(auth[0].requestFields.includes("password"));
  const report = buildHarEvidenceReport(har);
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /super-secret|sid=private|hidden/);
  assert.equal(report.safety.writeControlsMayBeEnabledFromThisReport, false);
});

test("write-like endpoints are candidates only and POST read endpoints are not misclassified", () => {
  const entries = parseHar({log:{entries:[
    {request:{method:"POST",url:"http://192.168.0.1/action/get_mgdb_params",headers:[],postData:{text:'{"keys":["device_battery_percent"]}'}},response:{status:200,content:{mimeType:"application/json",text:'{"retcode":0}'}},time:5},
    {request:{method:"POST",url:"http://192.168.0.1/action/device_set_battery_safe_charge",headers:[],postData:{text:'{"enable":"1"}'}},response:{status:200,content:{mimeType:"application/json",text:'{"retcode":0}'}},time:8}
  ]}});
  const writes = summarizeWriteCandidates(entries);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, "/action/device_set_battery_safe_charge");
  assert.equal(writes[0].verified, false);
});


test("detects the dominant RFC1918 modem host from HAR instead of trusting the filename", () => {
  const har = {log:{entries:[
    {request:{url:"http://192.168.0.1/a"}},
    {request:{url:"http://192.168.0.1/b"}},
    {request:{url:"http://192.168.0.2/c"}},
    {request:{url:"https://example.com/x"}}
  ]}};
  assert.equal(detectHarModemHost(har), "192.168.0.1");
});

test("capture quality distinguishes authenticated-session-only HAR from a real login transaction", () => {
  const har = {log:{
    pages:[{title:"http://192.168.0.1/html/settings.html?r=1"}],
    entries:[
      {
        request:{method:"POST",url:"http://192.168.0.1/goform/get_login_info",headers:[]},
        response:{status:200,headers:[],content:{mimeType:"application/json",text:'{"loginStatus":1,"loginUser":"private","login_ipaddr":"192.168.0.9"}'}},
        time:4
      },
      {
        request:{method:"POST",url:"http://192.168.0.1/action/get_mgdb_params",headers:[],postData:{mimeType:"application/json",text:'{"keys":["device_battery_percent"]}'}},
        response:{status:200,headers:[],content:{mimeType:"application/json",text:'{"retcode":0,"data":{"device_battery_percent":"90"}}'}},
        time:5
      }
    ]
  }};
  const quality = assessHarCaptureQuality(har);
  assert.equal(quality.authCaptureStatus, "AUTHENTICATED_SESSION_ONLY");
  assert.equal(quality.authenticatedStateObserved, true);
  assert.equal(quality.readyForAuthMapping, false);
  assert.equal(quality.writeCaptureStatus, "NO_WRITE_TRANSACTION");
  assert.deepEqual(quality.pagePaths, ["/html/settings.html"]);
  const report = buildHarEvidenceReport(har);
  assert.equal(report.schema, "nc03-har-evidence/v2");
  assert.equal(report.modemHost, "192.168.0.1");
  assert.equal(report.captureQuality.authCaptureStatus, "AUTHENTICATED_SESSION_ONLY");
  assert.doesNotMatch(JSON.stringify(report), /private|192\.168\.0\.9/);
});

test("capture quality promotes only credential-bearing login as an AUTH mapping candidate", () => {
  const har = {log:{entries:[{
    request:{method:"POST",url:"http://192.168.8.1/goform/login",headers:[{name:"Content-Type",value:"application/x-www-form-urlencoded"}],postData:{mimeType:"application/x-www-form-urlencoded",text:"password=secret"}},
    response:{status:200,headers:[],content:{mimeType:"application/json",text:'{"retcode":0}'}},
    time:10
  }]}};
  const quality = assessHarCaptureQuality(har);
  assert.equal(quality.authCaptureStatus, "LOGIN_TRANSACTION_CANDIDATE_FOUND");
  assert.equal(quality.readyForAuthMapping, true);
  assert.equal(quality.loginTransactionCandidateCount, 1);
});
