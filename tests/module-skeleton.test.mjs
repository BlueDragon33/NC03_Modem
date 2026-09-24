import test from "node:test";
import assert from "node:assert/strict";
import { NC03Session, sanitizeSessionValue } from "../src/modem/NC03Session.js";
import { NC03Api } from "../src/modem/NC03Api.js";
import { parseNC03Response } from "../src/modem/NC03Parser.js";
import { CAPABILITY_STATUS } from "../src/modem/CapabilityRegistry.js";
import { CONNECTION_STATE, connectionStateLabel } from "../src/modem/ConnectionState.js";
import { PRIMARY_NAV } from "../src/ui/NavigationModel.js";

test("session never exposes sensitive values in sanitized output", () => {
  const session = new NC03Session().set({ token: "abc", csrf: "xyz", expiresAt: 123 });
  assert.deepEqual(session.sanitized(), { token: "****", csrf: "****", expiresAt: 123 });
  assert.deepEqual(sanitizeSessionValue({ session:"s", nested:{token:"t"}, safe:1 }), { session:"****", nested:{token:"****"}, safe:1 });
});

test("API refuses unverified routes", async () => {
  const api = new NC03Api({ fetchImpl: async () => ({ ok:true }) });
  assert.throws(() => api.registerVerifiedRoute("bad", { path:"/x", method:"POST", status:CAPABILITY_STATUS.UNKNOWN }));
  await assert.rejects(api.request("missing"));
});

test("generic parser does not invent semantics", () => {
  assert.equal(parseNC03Response({contentType:"application/json",body:'{"a":1}'}).kind, "json");
  assert.equal(parseNC03Response({contentType:"text/plain",body:"ok"}).kind, "text");
});

test("connection states and primary navigation match source of truth", () => {
  assert.equal(connectionStateLabel(CONNECTION_STATE.SESSION_EXPIRED), "Session expired");
  assert.deepEqual(PRIMARY_NAV.map(x=>x.label), ["Home","Network","Wi-Fi","Devices","Settings"]);
});
