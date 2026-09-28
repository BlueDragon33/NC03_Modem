import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { NC03ControlClient, NC03ControlClientError } from "../src/application/NC03ControlClient.js";
import { NC03_RUNTIME_PROTOCOL } from "../src/runtime/RuntimeProtocol.js";

function response(body,{status=200}={}) {
  return {
    ok:status>=200 && status<300,
    status,
    async json(){ return body; }
  };
}

test("Product UI has no direct fetch or Local Bridge route authority", () => {
  const app=fs.readFileSync("app.js","utf8");
  assert.doesNotMatch(app,/\bfetch\s*\(/);
  assert.doesNotMatch(app,/\/api\/nc03\//);
  assert.match(app,/new NC03ControlClient\(\)/);
});

test("Application client is the single same-origin Local Bridge transport owner", () => {
  const source=fs.readFileSync("src/application/NC03ControlClient.js","utf8");
  for(const path of [
    "/_local/health",
    "/api/nc03/auth-readiness",
    "/api/nc03/login",
    "/api/nc03/stock-ui-audit",
    "/api/nc03/auth-source-probe",
    "/api/nc03/write-readiness",
    "/api/nc03/doctor",
    "/api/nc03/snapshot",
    "/api/nc03/details",
    "/api/nc03/settings/long-life-charging"
  ]) assert.ok(source.includes(path),path);
  assert.doesNotMatch(source,/http:\/\/192\.168\./);
  assert.doesNotMatch(source,/\/action\//);
  assert.doesNotMatch(source,/\/goform\//);
});

test("Application client rejects stale runtime protocol centrally", async () => {
  const fetchImpl=async()=>response({
    ok:true,
    app:"nc03-control-center",
    runtimeProtocol:"stale",
    authEvidenceSchema:NC03_RUNTIME_PROTOCOL.authEvidenceSchema,
    authLoginProtocol:NC03_RUNTIME_PROTOCOL.authLoginProtocol,
    writeReadinessProtocol:NC03_RUNTIME_PROTOCOL.writeReadinessProtocol,
    settingsWriteProtocol:NC03_RUNTIME_PROTOCOL.settingsWriteProtocol,
    stockUiAuditSchema:NC03_RUNTIME_PROTOCOL.stockUiAuditSchema
  });
  const client=new NC03ControlClient({fetchImpl});
  await assert.rejects(()=>client.health(),(error)=>error instanceof NC03ControlClientError && error.code==="LOCAL_BRIDGE_RESTART_REQUIRED");
});

test("Application client enforces standard payload envelope", async () => {
  const client=new NC03ControlClient({fetchImpl:async()=>response({ok:true})});
  await assert.rejects(()=>client.getSnapshot("http://192.168.0.1"),(error)=>error.code==="MALFORMED_LOCAL_RESPONSE");
});

test("Application client preserves bridge error payload for UI recovery decisions", async () => {
  const client=new NC03ControlClient({fetchImpl:async()=>response({
    ok:false,
    code:"WRITE_POSTCONDITION_FAILED",
    payload:{rollbackVerified:true}
  },{status:502})});
  await assert.rejects(
    ()=>client.setLongLifeCharging("http://192.168.0.1",true),
    (error)=>error.code==="WRITE_POSTCONDITION_FAILED" && error.payload?.rollbackVerified===true
  );
});

test("Application client validates successful login semantics", async () => {
  const client=new NC03ControlClient({fetchImpl:async()=>response({
    ok:true,
    payload:{authenticated:true}
  })});
  assert.equal((await client.login("http://192.168.0.1","local-secret")).authenticated,true);
});
