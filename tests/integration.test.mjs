import test from "node:test";
import assert from "node:assert/strict";
import { MockNC03Adapter } from "../src/modem/MockNC03Adapter.js";
import { NC03Adapter, UnsupportedCapabilityError } from "../src/modem/NC03Adapter.js";

test("mock flow supports connect/login/read for UI development only", async () => {
  const adapter = new MockNC03Adapter();
  assert.equal((await adapter.connect()).demo, true);
  assert.equal((await adapter.login()).authenticated, true);
  assert.equal((await adapter.getStatus()).internet, "Connected");
  assert.equal((await adapter.getBattery()).exactPercentage, true);
  const wifi = await adapter.getWifiStatus();
  const clients = await adapter.getConnectedClients();
  assert.equal(wifi.clients, clients.length);
});

test("real adapter blocks unknown write capability", async () => {
  const adapter = new NC03Adapter();
  await assert.rejects(adapter.setWifiPassword("x"), UnsupportedCapabilityError);
  await assert.rejects(adapter.reboot(), UnsupportedCapabilityError);
});
