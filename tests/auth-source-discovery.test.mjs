import test from "node:test";
import assert from "node:assert/strict";
import { analyzeAuthVendorSource, buildAuthSourceEvidence } from "../src/modem/AuthSourceDiscovery.js";

test("extracts AUTH source candidates without marking them verified", () => {
  const source = `
    var loginKey = "0123456789";
    function do_login(){ return hex_hmac_md5(loginKey, password); }
    saveAjaxJsonData("/action/login", "{}");
    saveAjaxJsonData("/action/modify_password", "{}");
  `;
  const result = analyzeAuthVendorSource({path:"/js/login.js",source});
  assert.deepEqual(result.authEndpoints.sort(), ["/action/login","/action/modify_password"].sort());
  assert.ok(result.loginFunctions.includes("do_login"));
  assert.equal(result.passwordCodec.fixedLoginKey, "0123456789");
  assert.equal(result.passwordCodec.hmacMd5, true);
  assert.equal(result.verified, false);
  assert.equal(result.statusLabel, "SOURCE_CANDIDATE_ONLY");
});

test("build report returns structural evidence only and never raw source", () => {
  const report = buildAuthSourceEvidence([
    {path:"/js/common.js",source:'var loginKey="0123456789"; function loginNow(){return hex_hmac_md5(loginKey,pwd)}; var p="/goform/login";'}
  ]);
  assert.equal(report.status, "AUTH_SOURCE_CANDIDATE_READY");
  assert.equal(report.safety.sourceCodeReturned, false);
  assert.equal(report.safety.productionLoginEnabled, false);
  assert.equal(report.safety.writeControlsEnabled, false);
  assert.doesNotMatch(JSON.stringify(report), /function loginNow\(\)\{return/);
});
