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
  assert.equal(report.status, "LOGIN_ENDPOINT_CANDIDATE_FOUND");
  assert.equal(report.safety.sourceCodeReturned, false);
  assert.equal(report.safety.productionLoginEnabled, false);
  assert.equal(report.safety.writeControlsEnabled, false);
  assert.doesNotMatch(JSON.stringify(report), /function loginNow\(\)\{return/);
});


test("discovers login page and resolves relative login script references", () => {
  const page = analyzeAuthVendorSource({
    path:"/common/login.html",
    source:'<script src="../js/login.js?r=123"></script>'
  });
  assert.deepEqual(page.scriptRefs, ["/js/login.js"]);
});

test("deep login source separates submit endpoints from status/logout endpoints", () => {
  const report = buildAuthSourceEvidence([
    {path:"/js/common.js",source:'var a="/action/logout"; var b="/goform/get_login_info";'},
    {path:"/js/login.js",source:'var loginKey="0123456789"; function submitLogin(){var postdata={}; postdata.password=hex_hmac_md5(loginKey,pwd); saveAjaxJsonData("/goform/login",JSON.stringify(postdata));'}
  ]);
  assert.deepEqual(report.authEndpoints.sort(), ["/action/logout","/goform/get_login_info","/goform/login"].sort());
  assert.deepEqual(report.loginSubmitEndpoints, ["/goform/login"]);
  assert.ok(report.candidateRequestFields.includes("password"));
  assert.equal(report.status, "LOGIN_SOURCE_CANDIDATE_READY");
  assert.equal(report.readyForRequestShapeMapping, true);
});

test("finds login page references observed in firmware source", () => {
  const result = analyzeAuthVendorSource({
    path:"/js/rebootreset.js",
    source:'window.location.replace("../common/login.html?r=1776398379");'
  });
  assert.deepEqual(result.loginPageCandidates, ["/common/login.html"]);
});
