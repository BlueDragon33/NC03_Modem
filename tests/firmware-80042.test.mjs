import test from "node:test";
import assert from "node:assert/strict";
import { NC03Firmware80042Adapter } from "../src/modem/NC03Firmware80042Adapter.js";
import {
  NC03_80042_DISCOVERED_WRITES,
  NC03_80042_READ_ROUTES,
  NC03_FIRMWARE_80042
} from "../src/modem/NC03Firmware80042Profile.js";

function response(payload) {
  return { ok:true, status:200, async json() { return payload; } };
}

function makeFetch() {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const path = new URL(url).pathname;
    calls.push({ path, init });
    if (path === "/goform/get_login_info") {
      return response({ retcode:0, loginStatus:1, loginRole:2, loginAlias:"user" });
    }
    if (path === "/action/router_get_hosts_info") {
      return response({ retcode:0, data:{ rt_hosts_list:[
        { rt_hosts_hostname:"Phone", rt_hosts_ip:"192.168.0.2", rt_hosts_mac:"AA:BB:CC:DD:EE:FF", rt_hosts_type:"wifi", rt_hosts_wifi_ap_index:0 }
      ] } });
    }
    if (path === "/action/get_device_state") {
      return response({ retcode:0, uptime:100, totalram:1000, usageram:400, freeram:600, cpuusage:9, procs:100 });
    }
    if (path === "/action/get_mgdb_params") {
      const body = JSON.parse(init.body);
      const data = {};
      const values = {
        device_product_name:"NC03",
        device_software_version:NC03_FIRMWARE_80042,
        device_battery_percent:"39",
        device_battery_level:"2",
        device_battery_charge_status:"charging",
        device_battery_percent_display:"false",
        device_bat_safe_charge_switch:"enable",
        device_charge_long_life:"enable",
        device_power_saving_mode:"normal",
        dialup_dial_status:"connected",
        mnet_sysmode:"nsa",
        mnet_operator_name:"Carrier",
        mnet_sig_level:"great",
        mnet_sim_status:"ready",
        wifi_work_status:"open"
      };
      for (const key of body.keys) if (key in values) data[key] = values[key];
      return response({ retcode:0, data });
    }
    throw new Error(`Unexpected test path: ${path}`);
  };
  return { fetchImpl, calls };
}

test("real HAR profile registers only observed read routes", () => {
  assert.equal(NC03_80042_READ_ROUTES.getParams.path, "/action/get_mgdb_params");
  assert.equal(NC03_80042_READ_ROUTES.hostsInfo.method, "POST");
  assert.ok(NC03_80042_DISCOVERED_WRITES.some((route) => route.path === "/action/wifi_set_ap_params"));
  assert.ok(NC03_80042_DISCOVERED_WRITES.every((route) => route.status === "PARTIAL"));
});

test("firmware adapter reads exact battery percentage without inventing values", async () => {
  const { fetchImpl } = makeFetch();
  const adapter = new NC03Firmware80042Adapter({ fetchImpl });
  const battery = await adapter.getBattery();
  assert.equal(battery.exactPercentage, true);
  assert.equal(battery.percentage, 39);
  assert.equal(battery.charging, true);
  assert.equal(battery.percentDisplay, "false");
});

test("firmware adapter exposes one-request live telemetry for 10 second polling", async () => {
  const { fetchImpl, calls } = makeFetch();
  const adapter = new NC03Firmware80042Adapter({ fetchImpl });
  const before = calls.length;
  const snapshot = await adapter.getLiveSnapshot();
  assert.equal(calls.length - before, 1);
  assert.equal(snapshot.refreshIntervalSeconds, 10);
  assert.equal(snapshot.battery.percentage, 39);
  assert.equal(snapshot.status.connected, true);
  assert.equal(snapshot.signal.level, "great");
  assert.equal(snapshot.signal.exactRadioMetrics, false);
});

test("firmware adapter reads status, device info and client list", async () => {
  const { fetchImpl, calls } = makeFetch();
  const adapter = new NC03Firmware80042Adapter({ fetchImpl });
  assert.equal((await adapter.connect()).authenticated, true);
  assert.equal((await adapter.getDeviceInfo()).firmware, NC03_FIRMWARE_80042);
  assert.equal((await adapter.getStatus()).network, "nsa");
  assert.equal((await adapter.getConnectedClients()).length, 1);
  assert.ok(calls.every((call) => call.init.headers["X-Requested-With"] === "XMLHttpRequest"));
});

test("write methods remain fail-closed despite vendor JS discovery", async () => {
  const { fetchImpl } = makeFetch();
  const adapter = new NC03Firmware80042Adapter({ fetchImpl });
  await assert.rejects(adapter.setWifiPassword("new-value"));
  await assert.rejects(adapter.reboot());
});
