import assert from "node:assert/strict";
import { NC03Adapter } from "../src/modem/NC03Adapter.js";
import { NC03Api } from "../src/modem/NC03Api.js";
import { NC03Auth } from "../src/modem/NC03Auth.js";
import { NC03Session } from "../src/modem/NC03Session.js";
import { NC03Capabilities } from "../src/modem/NC03Capabilities.js";
import { PRIMARY_NAV } from "../src/ui/NavigationModel.js";

const expected = [
  "connect","login","logout","getDeviceInfo","getStatus","getBattery","getSignal","getNetworkInfo",
  "getWifiStatus","getConnectedClients","getDataUsage","setWifiSettings","setWifiPassword","setWifiBand",
  "setLongLifeCharging","setEcoMode","setNetworkMode","blockClient","unblockClient","reboot",
  "getDhcpSettings","setDhcpSettings","getBridgeStatus","setBridgeMode"
];
for (const method of expected) assert.equal(typeof NC03Adapter.prototype[method], "function", `Missing adapter method: ${method}`);
assert.equal(typeof NC03Api, "function");
assert.equal(typeof NC03Auth, "function");
assert.equal(typeof NC03Session, "function");
assert.equal(typeof NC03Capabilities, "function");
assert.equal(PRIMARY_NAV.length, 5);
console.log("TYPECHECK PASS");
