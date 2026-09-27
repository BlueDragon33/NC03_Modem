import test from "node:test";
import assert from "node:assert/strict";
import {
  discoverNc03LoginRecipe,
  discoverSaveAjaxTransport,
  buildNc03LoginPayload,
  executeNc03Login
} from "../src/modem/NC03LoginRuntime.js";

const LOGIN_SOURCE = [
  'var loginKey="fixture-key";',
  'var g_resultSuccess=0;',
  'function login(){',
  '  var _obj=new Object();',
  '  _obj.username=hex_hmac_md5(loginKey,"fixture-user");',
  '  _obj.password=hex_hmac_md5(loginKey,$("#login_password").val());',
  '  var postdata=JSON.stringify(_obj);',
  '  saveAjaxJsonData("/goform/login",postdata,function(obj){',
  '    if(obj.retcode===g_resultSuccess){}',
  '    if(obj.retcode===13){}',
  '  },{async:true});',
  '}'
].join("\n");

const TOOL_SOURCE = [
  'function saveAjaxJsonData(url,data,callback,options){',
  '  $.ajax({url:url,type:"POST",contentType:"application/json; charset=UTF-8",data:data,success:callback});',
  '}'
].join("\n");

test("discovers the live login recipe without exposing it to UI contracts", () => {
  const recipe = discoverNc03LoginRecipe(LOGIN_SOURCE);
  assert.equal(recipe.ready, true);
  assert.equal(recipe.endpoint, "/goform/login");
  assert.equal(recipe.passwordTransform, "HMAC-MD5");
  assert.equal(recipe.successCode, 0);
  assert.deepEqual(recipe.genericFailureCodes, [13]);
});

test("discovers saveAjaxJsonData transport from vendor helper source", () => {
  const transport = discoverSaveAjaxTransport([{path:"/js/tools.js",source:TOOL_SOURCE}]);
  assert.equal(transport.ready, true);
  assert.equal(transport.method, "POST");
  assert.equal(transport.contentType, "application/json; charset=UTF-8");
});

test("builds HMAC login payload without plaintext password", () => {
  const recipe = discoverNc03LoginRecipe(LOGIN_SOURCE);
  const payload = buildNc03LoginPayload(recipe, "fixture-password");
  assert.doesNotMatch(payload, /fixture-password/);
  const parsed = JSON.parse(payload);
  assert.match(parsed.username, /^[a-f0-9]{32}$/);
  assert.match(parsed.password, /^[a-f0-9]{32}$/);
});

test("treats retcode 13 as generic rejection and 0 as success", async () => {
  const recipe = discoverNc03LoginRecipe(LOGIN_SOURCE);
  const transport = discoverSaveAjaxTransport([TOOL_SOURCE]);
  const rejected = await executeNc03Login({
    baseUrl:"http://192.168.0.1",
    password:"fixture-password",
    recipe,
    transport,
    fetchImpl:async ()=>({ ok:true, status:200, json:async()=>({retcode:13}) })
  });
  assert.deepEqual(rejected, { ok:false, code:"LOGIN_REJECTED", retcode:13 });

  const accepted = await executeNc03Login({
    baseUrl:"http://192.168.0.1",
    password:"fixture-password",
    recipe,
    transport,
    fetchImpl:async ()=>({ ok:true, status:200, json:async()=>({retcode:0}) })
  });
  assert.deepEqual(accepted, { ok:true, retcode:0 });
});

test("fails closed when recipe or transport is incomplete", () => {
  assert.equal(discoverNc03LoginRecipe('function login(){}').ready, false);
  assert.equal(discoverSaveAjaxTransport(['function saveAjaxJsonData(){}']).ready, false);
});
