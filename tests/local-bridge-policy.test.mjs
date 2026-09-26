import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_NC03_ORIGIN, isPrivateLanIpv4, normalizeModemBaseUrl } from "../src/modem/LocalBridgePolicy.js";

test("local bridge accepts RFC1918 modem IPv4 origins", () => {
  assert.equal(normalizeModemBaseUrl("192.168.0.1"), DEFAULT_NC03_ORIGIN);
  assert.equal(normalizeModemBaseUrl("http://10.0.0.1"), "http://10.0.0.1");
  assert.equal(normalizeModemBaseUrl("https://172.16.0.1"), "https://172.16.0.1");
  assert.equal(isPrivateLanIpv4("172.31.255.254"), true);
});

test("local bridge rejects loopback, public, hostname and unexpected URL components", () => {
  for (const value of [
    "127.0.0.1",
    "localhost",
    "8.8.8.8",
    "http://192.168.0.1:8080",
    "http://user:pass@192.168.0.1",
    "http://192.168.0.1/admin",
    "ftp://192.168.0.1"
  ]) {
    assert.throws(() => normalizeModemBaseUrl(value), undefined, value);
  }
});


test("UI login normalization shares the Local Bridge private-LAN policy", async () => {
  const { normalizeModemAddress } = await import("../src/modem/LoginPolicy.js");
  assert.equal(normalizeModemAddress("192.168.8.1"), "http://192.168.8.1");
  for (const value of ["8.8.8.8", "localhost", "http://192.168.0.1:8080"]) {
    assert.throws(() => normalizeModemAddress(value), undefined, value);
  }
});
