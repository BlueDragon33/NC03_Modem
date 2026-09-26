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
  assert.equal(report.status, "LOGIN_CALL_SHAPE_CANDIDATE_READY");
  assert.equal(report.readyForRequestShapeMapping, true);
});

test("finds login page references observed in firmware source", () => {
  const result = analyzeAuthVendorSource({
    path:"/js/rebootreset.js",
    source:'window.location.replace("../common/login.html?r=1776398379");'
  });
  assert.deepEqual(result.loginPageCandidates, ["/common/login.html"]);
});


test("get_login_limit stays passive while /goform/login gets its own callsite mapping", () => {
  const source = [
    'var loginKey="0123456789";',
    'function doLogin(){',
    '  var postdata={};',
    '  postdata.password=hex_hmac_md5(loginKey,password);',
    '  saveAjaxJsonData("/goform/login", JSON.stringify(postdata), function(obj){',
    '    if(obj.retcode===g_resultSuccess){}',
    '    else if(obj.retcode===g_loginPasswordError){}',
    '  });',
    '}',
    'getAjaxJsonData("/goform/get_login_limit", function(obj){});'
  ].join("\n");
  const report = buildAuthSourceEvidence([{path:"/js/login.js",source}]);
  assert.deepEqual(report.loginSubmitEndpoints, ["/goform/login"]);
  assert.deepEqual(report.loginFieldCandidates, ["password"]);
  assert.equal(report.loginCallsites.length, 1);
  assert.equal(report.loginCallsites[0].sourcePath, "/js/login.js");
  assert.equal(report.loginCallsites[0].functionName, "doLogin");
  assert.equal(report.loginCallsites[0].transportHelper, "saveAjaxJsonData");
  assert.equal(report.loginCallsites[0].payloadVariable, "postdata");
  assert.equal(report.loginCallsites[0].fields[0].transform, "hex_hmac_md5");
  assert.deepEqual(report.loginCallsites[0].fields[0].transformArgs, ["loginKey","password"]);
  assert.ok(report.loginCallsites[0].responseSignals.includes("g_resultSuccess"));
  assert.ok(report.loginCallsites[0].responseSignals.includes("g_loginPasswordError"));
  assert.equal(report.status, "LOGIN_CALL_SHAPE_CANDIDATE_READY");
  assert.equal(report.readyForRequestShapeMapping, true);
});


test("login call shape survives object-literal payloads and alternate helper argument order", () => {
  const source = [
    'var loginKey="0123456789";',
    'function doSubmit(){',
    '  saveAjaxJsonData({',
    '    password: hex_hmac_md5(loginKey,password),',
    '    remember: rememberFlag',
    '  }, "/goform/login", function(obj){',
    '    if(obj.retcode===g_resultSuccess){}',
    '  });',
    '}'
  ].join("\n");
  const report = buildAuthSourceEvidence([{path:"/js/login.js",source}]);
  assert.deepEqual(report.loginSubmitEndpoints, ["/goform/login"]);
  assert.equal(report.loginCallsites.length, 1);
  assert.equal(report.loginCallsites[0].transportHelper, "saveAjaxJsonData");
  assert.ok(report.loginCallsites[0].argumentShapes.some((shape) => shape.startsWith("object:{")));
  assert.ok(report.loginCallsites[0].directObjectKeys.includes("password"));
  assert.ok(report.loginCallsites[0].transforms.some((item) => item.name === "hex_hmac_md5"));
  assert.equal(report.readyForRequestShapeMapping, true);
  assert.equal(report.status, "LOGIN_CALL_SHAPE_CANDIDATE_READY");
});

test("call shape never returns raw literal values", () => {
  const secret = "SUPER_SECRET_PASSWORD";
  const report = buildAuthSourceEvidence([{
    path:"/js/login.js",
    source:'saveAjaxJsonData("/goform/login",{password:"' + secret + '"},function(obj){if(obj.retcode===0){}});'
  }]);
  assert.doesNotMatch(JSON.stringify(report), new RegExp(secret));
  assert.equal(report.safety.sourceCodeReturned, false);
});


test("structural trace follows payload construction inside the real login function", () => {
  const source = [
    'var g_loginPasswordError = 13;',
    'function login(){',
    '  var passwd = getValue();',
    '  var postdata = buildLoginPayload(passwd);',
    '  saveAjaxJsonData("/goform/login", postdata, function(obj){',
    '    if(obj.retcode===13){}',
    '    if(obj.retcode===g_resultSuccess){}',
    '  });',
    '}'
  ].join("\n");
  const report = buildAuthSourceEvidence([{path:"/js/login.js",source}]);
  const call = report.loginCallsites[0];
  assert.equal(call.functionName, "login");
  assert.ok(call.structuralTrace.some((entry) => entry.kind === "payload-assign" && entry.target === "postdata"));
  const assign = call.structuralTrace.find((entry) => entry.kind === "payload-assign");
  assert.ok(assign.structure.calls.some((item) => item.name === "buildLoginPayload"));
  assert.ok(assign.structure.authTokens.includes("passwd"));
  assert.equal(report.responseCodeMap["13"], "g_loginPasswordError");
});

test("structural trace never exposes string literal values", () => {
  const secret = "DO_NOT_LEAK_THIS";
  const source = [
    'function login(){',
    '  var postdata = makePayload("' + secret + '");',
    '  saveAjaxJsonData("/goform/login",postdata,function(){});',
    '}'
  ].join("\n");
  const report = buildAuthSourceEvidence([{path:"/js/login.js",source}]);
  assert.doesNotMatch(JSON.stringify(report), new RegExp(secret));
});


test("payload origin trace finds global construction outside login()", () => {
  const source = [
    'var g_resultPasswordError = 13;',
    'var postdata = buildLoginPayload(loginPass);',
    'postdata += appendAuthToken(authToken);',
    'function login(){',
    '  saveAjaxJsonData("/goform/login", postdata, function(obj){',
    '    if(obj.retcode===13){}',
    '    if(obj.retcode===g_resultSuccess){}',
    '  });',
    '}'
  ].join("\n");
  const report = buildAuthSourceEvidence([{path:"/js/login.js",source}]);
  const call = report.loginCallsites[0];
  assert.equal(call.functionName, "login");
  assert.ok(call.payloadOrigins.some((entry) => entry.scope === "global" && entry.kind === "payload-assign"));
  assert.ok(call.payloadOrigins.some((entry) => entry.scope === "global" && entry.kind === "payload-append"));
  const origin = call.payloadOrigins.find((entry) => entry.kind === "payload-assign");
  assert.ok(origin.structure.calls.some((item) => item.name === "buildLoginPayload"));
  assert.ok(origin.structure.authTokens.includes("loginPass"));
  assert.equal(report.responseCodeMap["13"], "g_resultPasswordError");
  assert.equal(report.status, "LOGIN_PAYLOAD_ORIGIN_FOUND");
  assert.equal(report.payloadOriginFound, true);
});

test("payload origin trace reports aliases without leaking literal values", () => {
  const secret = "NEVER_EXPOSE_THIS_VALUE";
  const source = [
    'var sourcePayload = makePayload("' + secret + '");',
    'var postdata = sourcePayload;',
    'var outbound = postdata;',
    'function login(){ saveAjaxJsonData("/goform/login",postdata,function(){}); }'
  ].join("\n");
  const report = buildAuthSourceEvidence([{path:"/js/login.js",source}]);
  const call = report.loginCallsites[0];
  assert.ok(call.payloadAliases.some((item) => item.alias === "sourcePayload" || item.alias === "outbound"));
  assert.doesNotMatch(JSON.stringify(report), new RegExp(secret));
  assert.equal(report.safety.sourceCodeReturned, false);
});


test("request object dependency trace follows JSON stringify object fields", () => {
  const source = [
    'var loginKey="fixture";',
    'var g_loginPasswordError=13;',
    'function login(){',
    '  var passwd=getInput();',
    '  var _obj=new Object();',
    '  _obj.password=hex_hmac_md5(loginKey,passwd);',
    '  _obj.async=true;',
    '  var postdata=JSON.stringify(_obj);',
    '  saveAjaxJsonData("/goform/login",postdata,function(obj){',
    '    if(obj.retcode===13){}',
    '    if(obj.retcode===g_resultSuccess){}',
    '  });',
    '}'
  ].join("\n");
  const report = buildAuthSourceEvidence([{path:"/js/login.js",source}]);
  const call = report.loginCallsites[0];
  assert.ok(call.dependencyVariables.includes("_obj"));
  assert.ok(call.dependencyFields.some((field) => field.field === "password"));
  const field = call.dependencyFields.find((item) => item.field === "password");
  assert.ok(field.structure.calls.some((item) => item.name === "hex_hmac_md5"));
  assert.equal(report.requestObjectMapped, true);
  assert.equal(report.authDependencyMapped, true);
  assert.equal(report.status, "LOGIN_REQUEST_OBJECT_CANDIDATE_READY");
  assert.equal(report.responseCodeMap["13"], "g_loginPasswordError");
});

test("response code map excludes unrelated source constants", () => {
  const source = [
    'var g_result_lcd_use=203;',
    'var g_curusernameerror=214;',
    'function login(){',
    '  var _obj={password:hex_hmac_md5(loginKey,passwd)};',
    '  var postdata=JSON.stringify(_obj);',
    '  saveAjaxJsonData("/goform/login",postdata,function(obj){',
    '    if(obj.retcode===13){}',
    '    if(obj.retcode===g_resultSuccess){}',
    '  });',
    '}'
  ].join("\n");
  const report = buildAuthSourceEvidence([{path:"/js/login.js",source}]);
  assert.equal(report.responseCodeMap["13"], "UNMAPPED");
  assert.equal(report.responseCodeMap["203"], undefined);
  assert.equal(report.responseCodeMap["214"], undefined);
});


test("nested-call trace preserves outer HMAC around password input val()", () => {
  const source = [
    'var loginKey="fixture";',
    'function login(){',
    '  var _obj=new Object();',
    '  _obj.username=hex_hmac_md5(loginKey,"fixture-user");',
    '  _obj.password=hex_hmac_md5(loginKey,$("#login_password").val());',
    '  var postdata=JSON.stringify(_obj);',
    '  saveAjaxJsonData("/goform/login",postdata,function(obj){',
    '    if(obj.retcode===0){}',
    '    if(obj.retcode===13){}',
    '  });',
    '}'
  ].join("\n");
  const report = buildAuthSourceEvidence([{path:"/js/login.js",source}]);
  const fields = report.loginCallsites[0].dependencyFields;
  const username = fields.find((field) => field.field === "username");
  const password = fields.find((field) => field.field === "password");
  assert.ok(username?.structure.authTransforms.some((item) => item.name === "hex_hmac_md5"));
  assert.ok(password?.structure.authTransforms.some((item) => item.name === "hex_hmac_md5"));
  assert.ok(password?.structure.calls.some((item) => item.name === "val"));
  assert.ok(password?.structure.calls.some((item) => item.name === "hex_hmac_md5" && item.depth === 0));
  assert.equal(report.authDependencyMapped, true);
  assert.equal(report.responseCodeMap["0"], "UNMAPPED");
  assert.equal(report.responseCodeMap["13"], "UNMAPPED");
});
