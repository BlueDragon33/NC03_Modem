import test from "node:test";
import assert from "node:assert/strict";
import {
  discoverNc03LoginRecipe,
  discoverSaveAjaxTransport,
  buildNc03LoginPayload,
  executeNc03Login
} from "../src/modem/NC03LoginRuntime.js";
import { createCookieAwareFetch, NC03LocalCookieJar } from "../src/modem/NC03LocalCookieJar.js";

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


test("discovers indirection used by vendor login source without requiring a direct literal in the field assignment", () => {
  const loginSource = [
    'var g_resultSuccess=0;',
    'var fixedUser="admin";',
    'function login(){',
    '  var passwordInput=$("#login_password").val();',
    '  var _obj=new Object();',
    '  _obj.username=hex_hmac_md5(loginKey,fixedUser);',
    '  _obj.password=hex_hmac_md5(loginKey,passwordInput);',
    '  var postdata=JSON.stringify(_obj);',
    '  saveAjaxJsonData("/goform/login",postdata,function(obj){',
    '    if(obj.retcode===g_resultSuccess){}',
    '    if(obj.retcode===13){}',
    '  });',
    '}'
  ].join("\n");
  const support = [{path:"/js/common.js",source:'var loginKey="fixture-key";'}];

  const recipe = discoverNc03LoginRecipe(loginSource, support);
  assert.equal(recipe.ready, true);
  assert.equal(recipe.endpoint, "/goform/login");
  assert.equal(recipe.usernameLiteral, "admin");
  assert.equal(recipe.passwordTransform, "HMAC-MD5");
  assert.equal(recipe.evidence.passwordInput, true);
});

test("incomplete runtime recipe reports privacy-safe evidence flags instead of leaking values", () => {
  const source = [
    'function login(){',
    '  var _obj=new Object();',
    '  _obj.password=hex_hmac_md5(loginKey,$("#login_password").val());',
    '  saveAjaxJsonData("/goform/login",JSON.stringify(_obj),function(obj){if(obj.retcode===0){}});',
    '}'
  ].join("\n");
  const recipe = discoverNc03LoginRecipe(source);
  assert.equal(recipe.ready, false);
  assert.equal(recipe.code, "LOGIN_RECIPE_INCOMPLETE");
  assert.equal(recipe.evidence.endpoint, true);
  assert.equal(recipe.evidence.passwordHmac, false);
  assert.equal(recipe.evidence.usernameLiteral, false);
  assert.doesNotMatch(JSON.stringify(recipe.evidence), /fixture|admin|password-value/i);
});


test("local bridge cookie transport replays modem session cookie after login", async () => {
  const calls = [];
  const baseFetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const headers = new Headers();
    calls.push({ path, cookie:init.headers instanceof Headers ? init.headers.get("cookie") : null });

    if (path === "/goform/login") {
      headers.append("set-cookie", "SessionID=fixture-session; Path=/; HttpOnly");
      return { ok:true, status:200, headers, json:async()=>({retcode:0}) };
    }

    if (path === "/goform/get_login_info") {
      return {
        ok:true,
        status:200,
        headers,
        json:async()=>({retcode:0, loginStatus:init.headers.get("cookie") === "SessionID=fixture-session" ? 1 : 0})
      };
    }

    throw new Error("Unexpected path");
  };

  const session = createCookieAwareFetch({ fetchImpl:baseFetch });
  const recipe = discoverNc03LoginRecipe(LOGIN_SOURCE);
  const transport = discoverSaveAjaxTransport([TOOL_SOURCE]);

  const login = await executeNc03Login({
    baseUrl:"http://192.168.0.1",
    password:"fixture-password",
    recipe,
    transport,
    fetchImpl:session.fetchImpl
  });
  assert.equal(login.ok, true);
  assert.equal(session.jar.size, 1);

  const verify = await session.fetchImpl("http://192.168.0.1/goform/get_login_info", {
    method:"POST",
    headers:{ Accept:"application/json" }
  });
  assert.equal((await verify.json()).loginStatus, 1);
  assert.equal(calls.at(-1).cookie, "SessionID=fixture-session");
});

test("cookie jar stays memory-only and drops expired modem cookies", () => {
  const jar = new NC03LocalCookieJar();
  const headers = new Headers();
  headers.append("set-cookie", "SessionID=one; Path=/");
  jar.absorb(headers);
  assert.equal(jar.header(), "SessionID=one");

  const expired = new Headers();
  expired.append("set-cookie", "SessionID=; Max-Age=0; Path=/");
  jar.absorb(expired);
  assert.equal(jar.header(), "");
  assert.equal(jar.size, 0);
});
