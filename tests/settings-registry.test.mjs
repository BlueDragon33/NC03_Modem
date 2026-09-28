import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CAPABILITY_LIFECYCLE,
  NC03_SETTINGS_REGISTRY,
  SETTINGS_REGISTRY_SCHEMA,
  SETTINGS_REGISTRY_VERSION,
  canReadSetting,
  canWriteSetting,
  lifecycleForSetting,
  settingDefinition,
  settingsForFamily
} from "../src/domain/NC03SettingsRegistry.js";

const parity=JSON.parse(fs.readFileSync("evidence/stock-webui-parity.v1.json","utf8"));

test("canonical registry schema/version are stable", () => {
  assert.equal(SETTINGS_REGISTRY_SCHEMA,"nc03-settings-registry/v1");
  assert.equal(SETTINGS_REGISTRY_VERSION,"1.0.0");
  assert.equal(NC03_SETTINGS_REGISTRY.schema,SETTINGS_REGISTRY_SCHEMA);
  assert.equal(NC03_SETTINGS_REGISTRY.version,SETTINGS_REGISTRY_VERSION);
  assert.equal(NC03_SETTINGS_REGISTRY.projectId,"project:nc03-modem");
});

test("every parity row maps exactly once to one canonical setting/action id", () => {
  const parityIds=parity.rows.map((row)=>row.id).sort();
  const registryIds=NC03_SETTINGS_REGISTRY.entries.map((entry)=>entry.id).sort();
  assert.equal(new Set(registryIds).size,registryIds.length,"duplicate registry id");
  assert.deepEqual(registryIds,parityIds);
  for(const id of parityIds) assert.equal(settingDefinition(id)?.evidence?.parityId,id);
});

test("registry does not use vendor routes or raw field keys as canonical identity", () => {
  const source=fs.readFileSync("src/domain/NC03SettingsRegistry.js","utf8");
  assert.doesNotMatch(source,/\/action\//);
  assert.doesNotMatch(source,/\/goform\//);
  assert.doesNotMatch(source,/wifi_ssid_|rt_dhcp_|mnet_|device_/);
});

test("WRITE_VERIFIED and HARDWARE_ACCEPTED require verified evidence and recovery policy", () => {
  for(const entry of NC03_SETTINGS_REGISTRY.entries){
    const stage=entry.capability.lifecycle;
    if([CAPABILITY_LIFECYCLE.WRITE_VERIFIED,CAPABILITY_LIFECYCLE.HARDWARE_ACCEPTED].includes(stage)){
      assert.equal(entry.evidence.writeState,"VERIFIED",entry.id);
      assert.equal(entry.capability.writable,true,entry.id);
      assert.notEqual(entry.safety.readbackPolicy,"BLOCK_WRITE_UNTIL_READBACK_MAPPED",entry.id);
      assert.notEqual(entry.safety.recoveryPolicy,"NOT_APPLICABLE",entry.id);
    } else {
      assert.equal(entry.capability.writable,false,entry.id);
    }
  }
});

test("read and write helpers follow lifecycle, not UI labels", () => {
  assert.equal(lifecycleForSetting("auth.login"),CAPABILITY_LIFECYCLE.HARDWARE_ACCEPTED);
  assert.equal(canReadSetting("auth.login"),true);
  assert.equal(canWriteSetting("auth.login"),true);
  assert.equal(lifecycleForSetting("power.long-life"),CAPABILITY_LIFECYCLE.WRITE_CANDIDATE);
  assert.equal(canWriteSetting("power.long-life"),false);
  assert.equal(canReadSetting("power.long-life"),true);
  assert.equal(lifecycleForSetting("devices.client-admin"),CAPABILITY_LIFECYCLE.UNMAPPED);
  assert.equal(canReadSetting("devices.client-admin"),false);
});

test("internal firmware states remain explicit instead of masquerading as stock controls", () => {
  for(const id of ["mobile.cloud-sim-notification","system.nitz-enable","devices.client-admin"]){
    const entry=settingDefinition(id);
    assert.equal(entry.ui.stockPresence,"NOT_OBSERVED_AS_STOCK_CONTROL");
    assert.equal(entry.ui.exposure,"INTERNAL_STATE");
  }
});

test("family lookup covers all eight canonical families", () => {
  for(const family of parity.families){
    const entries=settingsForFamily(family);
    assert.ok(entries.length>0,family);
    assert.ok(entries.every((entry)=>entry.family===family));
  }
});
