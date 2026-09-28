import test from "node:test";
import assert from "node:assert/strict";
import { CAPABILITY_STATUS, canRead, canWrite, DEFAULT_CAPABILITIES } from "../src/modem/CapabilityRegistry.js";

test("write requires WRITE VERIFIED", () => {
  assert.equal(canWrite({status:CAPABILITY_STATUS.WRITE_VERIFIED}), true);
  assert.equal(canWrite({status:CAPABILITY_STATUS.VERIFIED}), false);
  assert.equal(canWrite({status:CAPABILITY_STATUS.UNKNOWN}), false);
});

test("legacy capability matrix is a derived compatibility view of the canonical registry", () => {
  assert.ok(DEFAULT_CAPABILITIES.length >= 12);
  assert.ok(DEFAULT_CAPABILITIES.every((row)=>row.source==="NC03_SETTINGS_REGISTRY"));
  assert.ok(DEFAULT_CAPABILITIES.every((row)=>Array.isArray(row.ids) && row.ids.length>0));
  assert.equal(DEFAULT_CAPABILITIES.find((row)=>row.module==="Login")?.status,CAPABILITY_STATUS.WRITE_VERIFIED);
  assert.equal(DEFAULT_CAPABILITIES.find((row)=>row.module==="Wi-Fi")?.status,CAPABILITY_STATUS.PARTIAL);
  assert.equal(canRead(DEFAULT_CAPABILITIES.find((row)=>row.module==="Wi-Fi")),true);
});
