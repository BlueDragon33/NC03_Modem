import test from "node:test";
import assert from "node:assert/strict";
import { parseHar, redactHeaders, redactUrl, sanitizeBody, summarizeCandidates } from "../src/modem/HarDiscovery.js";

test("redacts sensitive headers and query", () => {
  assert.equal(redactHeaders([{name:"Cookie",value:"sid=123"}])[0].value, "****");
  assert.match(redactUrl("http://192.168.0.1/api?token=abc&mode=5g"), /token=\*\*\*\*/);
  assert.match(redactUrl("http://192.168.0.1/api?token=abc&mode=5g"), /mode=5g/);
});

test("redacts JSON request body", () => {
  const safe = sanitizeBody(JSON.stringify({username:"admin",password:"123456",nested:{session:"xyz"}}));
  assert.equal(JSON.parse(safe).password, "****");
  assert.equal(JSON.parse(safe).nested.session, "****");
});

test("parses only modem host and summarizes candidates", () => {
  const har = {log:{entries:[
    {request:{method:"GET",url:"http://192.168.0.1/api/status",headers:[]},response:{status:200,content:{mimeType:"application/json",size:5}},time:10},
    {request:{method:"GET",url:"http://192.168.0.1/api/status",headers:[]},response:{status:200,content:{mimeType:"application/json",size:5}},time:20},
    {request:{method:"GET",url:"https://example.com/x",headers:[]},response:{status:200,content:{}},time:1}
  ]}};
  const entries = parseHar(har);
  assert.equal(entries.length, 2);
  const candidates = summarizeCandidates(entries);
  assert.equal(candidates[0].count, 2);
  assert.equal(candidates[0].path, "/api/status");
  assert.equal(candidates[0].avgMs, 15);
});
