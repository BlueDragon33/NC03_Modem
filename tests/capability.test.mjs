import test from "node:test";
import assert from "node:assert/strict";
import { CAPABILITY_STATUS, canRead, canWrite, DEFAULT_CAPABILITIES } from "../src/modem/CapabilityRegistry.js";

test("write requires WRITE VERIFIED", () => {
  assert.equal(canWrite({status:CAPABILITY_STATUS.WRITE_VERIFIED}), true);
  assert.equal(canWrite({status:CAPABILITY_STATUS.VERIFIED}), false);
  assert.equal(canWrite({status:CAPABILITY_STATUS.UNKNOWN}), false);
});

test("default matrix starts unknown", () => {
  assert.ok(DEFAULT_CAPABILITIES.length >= 12);
  assert.ok(DEFAULT_CAPABILITIES.every((row) => row.status === CAPABILITY_STATUS.UNKNOWN));
  assert.equal(canRead(DEFAULT_CAPABILITIES[0]), false);
});
