import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveVerifiedLoginRecipe,
  hmacMd5Compat,
  performVerifiedLogin
} from "../src/modem/server/NC03LoginRuntime.js";
import { NC03Auth } from "../src/modem/NC03Auth.js";

function fixtureSources() {
  const lowerNum = Array.from({ length:256 }, (_, i) => JSON.stringify("abcdefghijklmnopqrstuvwxyz0123456789"[i % 36])).join(",");
  return [
    {
      path:"/js/login.js",
      source:[
        'var g_resultSuccess = 0;',
        'var key = "fixture-key";',
        'var g_priKey;',
        'var g_timestamp;',
        'var g_timestamp_start;',
        'function getLoginInfo(){',
        '  getAjaxJsonData("/goform/get_login_info", function(obj){',
        '    if(obj.retcode === g_resultSuccess){',
        '      var prikey = obj.priKey;',
        '      g_priKey = prikey.split("x")[0];',
        '      g_timestamp = prikey.split("x")[1];',
        '    }',
        '  });',
        '}',
        'function login(){',
        '  var data = $(".login-input").serializeArray();',
        '  var _obj = {};',
        '  var postdata;',
        '  $.each(data, function(index, val){',
        '    _obj[val.name] = hex_hmac_md5(key,val.value);',
        '  });',
        '  _obj.password = password_encode(_obj.password,g_priKey,g_timestamp,g_timestamp_start);',
        '  postdata = JSON.stringify(_obj);',
        '  saveAjaxJsonData("/goform/login", postdata, function(obj){',
        '    if(obj.retcode === g_resultSuccess){}',
        '  });',
        '}'
      ].join("\n")
    },
    {
      path:"/js/tools.js",
      source:[
        'function getAjaxJsonTokeData(urlstr){',
        '  $.ajax({ type:"GET", url:urlstr, complete:function(xhr){ xhr.getResponseHeader("X-Csrf-Token"); } });',
        '}',
        'function getxCsrfTokens(){ getAjaxJsonTokeData("/goform/x_csrf_token"); }',
        'function saveAjaxJsonData(url, data, callback, options){',
        '  $.ajax({',
        '    url:url, data:data, type:"POST", dataType:"json", contentType:"application/json",',
        '    beforeSend:function(XMLHttpRequest){ XMLHttpRequest.setRequestHeader("X-Csrf-Token", localStorage.getItem("XCsrfToken")); }',
        '  });',
        '}'
      ].join("\n")
    },
    {
      path:"/js/encryption.js",
      source:[
        'var g_s_pass_lower_num = [' + lowerNum + '];',
        'function password_encode(password,secret,timestamp,timestamp_start){',
        '  var time_stamp = timestamp;',
        '  return Base64.encode(password + time_stamp);',
        '}'
      ].join("\n")
    }
  ];
}

test("verified login recipe requires the observed POST JSON + CSRF + challenge chain", () => {
  const recipe = deriveVerifiedLoginRecipe(fixtureSources());
  assert.equal(recipe.endpoint, "/goform/login");
  assert.equal(recipe.loginInfoEndpoint, "/goform/get_login_info");
  assert.equal(recipe.csrfEndpoint, "/goform/x_csrf_token");
  assert.equal(recipe.loginKey.value, "fixture-key");
  assert.equal(recipe.method, "POST");
  assert.equal(recipe.contentType, "application/json");
  assert.equal(recipe.successCode, 0);
  assert.equal(recipe.hmac.username, true);
  assert.equal(recipe.hmac.password, true);
  assert.equal(recipe.passwordEncode, true);
});

test("HMAC helper matches deterministic MD5-HMAC output", () => {
  assert.equal(hmacMd5Compat("key", "admin"), "39dd2866323318c80ca7e10dca74d141");
});

test("real local login sends only transformed credentials and verifies loginStatus", async () => {
  const calls = [];
  const responses = [
    new Response("", { status:200, headers:{ "X-Csrf-Token":"token-1" } }),
    new Response(JSON.stringify({ retcode:0, priKey:"01020304x10" }), { status:200, headers:{ "X-Csrf-Token":"token-2" } }),
    new Response(JSON.stringify({ retcode:0 }), { status:200, headers:{ "X-Csrf-Token":"token-3" } }),
    new Response(JSON.stringify({ retcode:0, loginStatus:1, loginUser:"admin" }), { status:200, headers:{ "X-Csrf-Token":"token-4" } })
  ];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const response = responses.shift();
    assert.ok(response, "unexpected extra modem request");
    return response;
  };
  const tokens = [];
  const randomValues = [2, 12, 34];
  const result = await performVerifiedLogin({
    baseUrl:"http://192.168.0.1",
    username:"admin",
    password:"12345",
    sources:fixtureSources(),
    fetchImpl,
    onToken:(value) => tokens.push(value),
    nowSeconds:() => 100,
    randomIntImpl:() => randomValues.shift()
  });

  assert.equal(result.authenticated, true);
  assert.equal(result.loginUser, "admin");
  assert.equal(calls.length, 4);
  assert.equal(new URL(calls[0].url).pathname, "/goform/x_csrf_token");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(new URL(calls[1].url).pathname, "/goform/get_login_info");
  assert.equal(new URL(calls[2].url).pathname, "/goform/login");
  assert.equal(calls[2].init.method, "POST");
  assert.equal(calls[2].init.headers["Content-Type"], "application/json");
  assert.equal(calls[2].init.headers["X-Csrf-Token"], "token-2");

  const body = JSON.parse(calls[2].init.body);
  assert.equal(body.username, hmacMd5Compat("fixture-key", "admin"));
  assert.notEqual(body.password, "12345");
  assert.notEqual(body.password, hmacMd5Compat("fixture-key", "12345"));
  assert.equal(tokens.at(-1), "token-4");
});

test("failed modem login exposes remaining attempts without claiming authentication", async () => {
  const responses = [
    new Response("", { status:200, headers:{ "X-Csrf-Token":"token-1" } }),
    new Response(JSON.stringify({ retcode:0, priKey:"01020304x10" }), { status:200, headers:{ "X-Csrf-Token":"token-2" } }),
    new Response(JSON.stringify({ retcode:13, reminingTimes:2 }), { status:200, headers:{ "X-Csrf-Token":"token-3" } })
  ];
  const result = await performVerifiedLogin({
    baseUrl:"http://192.168.0.1",
    username:"admin",
    password:"12345",
    sources:fixtureSources(),
    fetchImpl:async () => responses.shift(),
    nowSeconds:() => 100,
    randomIntImpl:() => 1
  });
  assert.equal(result.authenticated, false);
  assert.equal(result.code, "LOGIN_FAILED");
  assert.equal(result.remainingTimes, 2);
});

test("browser NC03Auth posts credentials only to the local bridge", async () => {
  let captured;
  const auth = new NC03Auth({
    baseUrl:"http://192.168.0.1",
    fetchImpl:async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({
        ok:true,
        payload:{ authenticated:true, loginUser:"admin" }
      }), { status:200, headers:{ "content-type":"application/json" } });
    }
  });
  const result = await auth.login({ username:"admin", password:"12345" });
  assert.equal(captured.url, "/api/nc03/login");
  assert.equal(captured.init.method, "POST");
  assert.deepEqual(JSON.parse(captured.init.body), {
    baseUrl:"http://192.168.0.1",
    username:"admin",
    password:"12345"
  });
  assert.equal(result.authenticated, true);
});
