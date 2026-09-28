import test from "node:test";
import assert from "node:assert/strict";
import { createCookieAwareFetch } from "../src/modem/NC03LocalCookieJar.js";
import { collectWriteSourceEvidence, fetchStaticSource } from "../src/modem/NC03WriteSourceCollection.js";

test("WRITE source discovery reads protected vendor scripts through the modem session", async () => {
  const paths = [];
  const session = createCookieAwareFetch({
    fetchImpl:async (url, init) => {
      const path = new URL(url).pathname;
      paths.push(path);
      const cookie = new Headers(init.headers).get("cookie");
      if (path === "/login") {
        return new Response("ok", {headers:{"set-cookie":"SessionID=fixture-secret; Path=/"}});
      }
      if (cookie !== "SessionID=fixture-secret") {
        return new Response("", {status:302,headers:{location:"/login"}});
      }
      return new Response('function setSafeCharge(){saveAjaxJsonData("/action/device_set_battery_safe_charge",{safe_charge:"enable"},function(){});}', {
        headers:{"content-type":"application/javascript"}
      });
    }
  });
  const unauthenticated = await collectWriteSourceEvidence({
    baseUrl:"http://192.168.0.1", paths:["/js/power.js"], fetchImpl:session.fetchImpl
  });
  assert.deepEqual(unauthenticated.sources, []);
  assert.equal(unauthenticated.summary.REDIRECT, 1);

  await session.fetchImpl("http://192.168.0.1/login");
  const authenticated = await collectWriteSourceEvidence({
    baseUrl:"http://192.168.0.1", paths:["/js/power.js"], fetchImpl:session.fetchImpl
  });
  assert.deepEqual(paths, ["/js/power.js", "/login", "/js/power.js"]);
  assert.equal(authenticated.summary.HTTP_OK, 1);
  assert.equal(authenticated.sources[0].path, "/js/power.js");
  assert.match(authenticated.sources[0].source, /device_set_battery_safe_charge/);
  assert.doesNotMatch(JSON.stringify(authenticated.diagnostics), /fixture-secret/);
});

test("source read timeout returns a path-only diagnostic without raw transport errors", async () => {
  const timeout = new Error("secret modem cookie and password");
  timeout.name = "TimeoutError";
  const result = await fetchStaticSource("http://192.168.0.1", "/js/power.js", {
    fetchImpl:async () => { throw timeout; }
  });
  assert.equal(result.item, null);
  assert.equal(result.diagnostic.status, "TIMEOUT");
  assert.equal(result.diagnostic.path, "/js/power.js");
  assert.doesNotMatch(JSON.stringify(result.diagnostic), /cookie|password/i);
});
