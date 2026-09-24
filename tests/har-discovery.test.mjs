import test from "node:test";
import assert from "node:assert/strict";
import { classifyHarCandidate, parseHar, redactHeaders, redactUrl, sanitizeBody, summarizeCandidates } from "../src/modem/HarDiscovery.js";

test("redacts sensitive headers and query", () => {
  assert.equal(redactHeaders([{name:"Cookie",value:"sid=123"}])[0].value, "****");
  assert.match(redactUrl("http://192.168.0.1/api?token=abc&mode=5g"), /token=****/);
  assert.match(redactUrl("http://192.168.0.1/api?token=abc&mode=5g"), /mode=5g/);
});

test("redacts JSON request body", () => {
  const safe = sanitizeBody(JSON.stringify({username:"admin",password:"123456",nested:{session:"xyz"}}));
  assert.equal(JSON.parse(safe).password, "****");
  assert.equal(JSON.parse(safe).nested.session, "****");
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
  assert.match(entries[0].url, /token=****/);
  assert.equal(JSON.parse(entries[0].requestBody).password, "****");
  assert.ok(entries[0].hints.includes("auth"));
  const candidates = summarizeCandidates(entries);
  assert.equal(candidates.length, 2);
  assert.ok(candidates.some(x => x.hints.includes("auth")));
});
