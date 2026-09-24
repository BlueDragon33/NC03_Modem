import test from "node:test";
import assert from "node:assert/strict";
import { NC03Session, sanitizeSessionValue } from "../src/modem/NC03Session.js";
import { NC03Api } from "../src/modem/NC03Api.js";
import { NC03Auth } from "../src/modem/NC03Auth.js";
import { parseNC03Response } from "../src/modem/NC03Parser.js";
import { CAPABILITY_STATUS } from "../src/modem/CapabilityRegistry.js";
import { CONNECTION_STATE, connectionStateLabel } from "../src/modem/ConnectionState.js";
import { PRIMARY_NAV } from "../src/ui/NavigationModel.js";
import { DEFAULT_MODEM_URL, LOGIN_POLICY, normalizeModemAddress } from "../src/modem/LoginPolicy.js";

test("session never exposes sensitive values in sanitized output", () => {
  const session = new NC03Session().set({ token: "abc", csrf: "xyz", expiresAt: 123 });
  assert.deepEqual(session.sanitized(), { token: "****", csrf: "****", expiresAt: 123 });
  assert.deepEqual(sanitizeSessionValue({ session:"s", nested:{token:"t"}, safe:1 }), { session:"****", nested:{token:"****"}, safe:1 });
});

test("API refuses unverified routes and gates writes by operation, not HTTP method", async () => {
  const calls = [];
  const api = new NC03Api({ fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok:true }; } });
  assert.throws(() => api.registerVerifiedRoute("bad", { path:"/x", method:"POST", status:CAPABILITY_STATUS.UNKNOWN }));
  assert.throws(() => api.registerVerifiedRoute("unsafe-write", { path:"/write", method:"GET", operation:"write", status:CAPABILITY_STATUS.VERIFIED }));
  api.registerVerifiedRoute("read-via-post", { path:"/status", method:"POST", operation:"read", status:CAPABILITY_STATUS.VERIFIED });
  api.registerVerifiedRoute("verified-write", { path:"/wifi", method:"POST", operation:"write", status:CAPABILITY_STATUS.WRITE_VERIFIED });
  await api.request("read-via-post");
  await api.request("verified-write");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[1].init.method, "POST");
  await assert.rejects(api.request("missing"));
});

test("unsupported logout does not silently mutate local session", async () => {
  let cleared = 0;
  const auth = new NC03Auth({ session: { clear() { cleared += 1; } } });
  await assert.rejects(auth.logout());
  assert.equal(cleared, 0);
  auth.clearLocalSession();
  assert.equal(cleared, 1);
});

test("generic parser does not invent semantics", () => {
  assert.equal(parseNC03Response({contentType:"application/json",body:'{"a":1}'}).kind, "json");
  assert.equal(parseNC03Response({contentType:"text/plain",body:"ok"}).kind, "text");
});

test("connection states and primary navigation match source of truth", () => {
  assert.equal(connectionStateLabel(CONNECTION_STATE.SESSION_EXPIRED), "Session expired");
  assert.deepEqual(PRIMARY_NAV.map(x=>x.label), ["Home","Network","Wi-Fi","Devices","Settings"]);
});


test("login policy is password-only, remembers after success and normalizes configurable modem address", () => {
  assert.equal(LOGIN_POLICY.usernameRequired, false);
  assert.equal(LOGIN_POLICY.rememberPasswordDefault, true);
  assert.equal(LOGIN_POLICY.persistCredentialOnlyAfterAuthenticated, true);
  assert.equal(normalizeModemAddress("192.168.0.1"), DEFAULT_MODEM_URL);
  assert.equal(normalizeModemAddress("http://192.168.8.1/settings"), "http://192.168.8.1");
  assert.throws(() => normalizeModemAddress("ftp://192.168.0.1"));
});
