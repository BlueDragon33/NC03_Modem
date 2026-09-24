import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { SecureCredentialVault } from "../src/modem/SecureCredentialVault.js";

class MemoryStore {
  constructor() { this.map = new Map(); }
  async get(key) { return this.map.get(key); }
  async set(key, value) { this.map.set(key, value); }
  async delete(key) { this.map.delete(key); }
}

test("credential vault encrypts admin login at rest and can clear it", async () => {
  const store = new MemoryStore();
  const vault = new SecureCredentialVault({ store, cryptoImpl:webcrypto });
  await vault.save({baseUrl:"http://192.168.0.1",username:"admin",password:"top-secret"});
  const record = await store.get("admin-credential");
  assert.ok(record?.ciphertext);
  assert.doesNotMatch(JSON.stringify(record), /top-secret/);
  assert.deepEqual(await vault.load(), {baseUrl:"http://192.168.0.1",username:"admin",password:"top-secret"});
  await vault.clear();
  assert.equal(await vault.load(), null);
});

test("credential vault fails closed without a password", async () => {
  const vault = new SecureCredentialVault({ store:new MemoryStore(), cryptoImpl:webcrypto });
  await assert.rejects(vault.save({baseUrl:"http://192.168.0.1",password:""}));
});
