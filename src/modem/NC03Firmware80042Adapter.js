import { NC03Adapter } from "./NC03Adapter.js";
import { NC03Api } from "./NC03Api.js";
import {
  BATTERY_KEYS,
  DATA_USAGE_KEYS,
  DHCP_KEYS,
  NC03_FIRMWARE_80042,
  STATUS_KEYS,
  registerNC0380042ReadRoutes
} from "./NC03Firmware80042Profile.js";
import {
  CONNECTIVITY_KEYS,
  FIRMWARE_STATUS_KEYS,
  LIVE_TELEMETRY_KEYS,
  NETWORK_SETTINGS_KEYS,
  POWER_SETTINGS_KEYS,
  SAFE_WIFI_KEYS,
  SECURITY_STATUS_KEYS,
  TIME_SETTINGS_KEYS
} from "./NC03Har2Profile.js";

const JSON_HEADERS = Object.freeze({
  Accept: "application/json",
  "Content-Type": "application/json",
  "X-Requested-With": "XMLHttpRequest"
});

function successful(payload) {
  return typeof payload?.retcode !== "number" || payload.retcode === 0;
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function connectionState(value) {
  return typeof value === "string" && value ? value.split(",")[0] : null;
}

function batteryFrom(data) {
  const percentage = numeric(data.device_battery_percent);
  return {
    exactPercentage: percentage !== null,
    percentage,
    level: numeric(data.device_battery_level),
    charging: data.device_battery_charge_status === "charging",
    chargeStatus: data.device_battery_charge_status ?? null,
    percentDisplay: data.device_battery_percent_display ?? null,
    safeCharge: data.device_bat_safe_charge_switch ?? null,
    longLife: data.device_charge_long_life ?? null,
    powerMode: data.device_power_saving_mode ?? null
  };
}

function statusFrom(data) {
  const wanState = connectionState(data.rt_wwan_conn_info);
  const ethernetState = connectionState(data.rt_eth_conn_info);
  return {
    connected: data.dialup_dial_status === "connected" || wanState === "connected",
    internet: data.dialup_dial_status ?? null,
    internetMode: data.rt_internet_mode ?? null,
    network: data.mnet_sysmode ?? null,
    carrier: data.mnet_operator_name ?? null,
    signalLevel: data.mnet_sig_level ?? null,
    simStatus: data.mnet_sim_status ?? null,
    simSlot: data.mnet_sim_slot ?? null,
    communicationMode: data.mnet_com_mode ?? null,
    uqState: data.mnet_uq_state ?? null,
    roaming: data.mnet_roam_status ?? null,
    roamingSwitch: data.dialup_roamswitch ?? null,
    wifi: data.wifi_work_status ?? null,
    wanState,
    ethernetState,
    firmwareUpdate: data.fota_curr_istatus ?? null
  };
}

function signalFrom(data) {
  return {
    level: data.mnet_sig_level ?? null,
    systemMode: data.mnet_sysmode ?? null,
    carrier: data.mnet_operator_name ?? null,
    exactRadioMetrics: false
  };
}

export class NC03Firmware80042Adapter extends NC03Adapter {
  constructor({ baseUrl = "http://192.168.0.1", fetchImpl = globalThis.fetch } = {}) {
    super({ baseUrl });
    this.api = registerNC0380042ReadRoutes(new NC03Api({ baseUrl, fetchImpl }));
  }

  async requestJson(name, body = null) {
    const init = { headers: { ...JSON_HEADERS } };
    if (body !== null) init.body = JSON.stringify(body);
    const response = await this.api.request(name, init);
    if (response?.ok === false) throw new Error(`NC03 HTTP error: ${response.status ?? "unknown"}`);
    const payload = await response.json();
    if (!successful(payload)) throw new Error(`NC03 retcode: ${payload?.retcode}`);
    return payload;
  }

  async getParams(keys) {
    if (!Array.isArray(keys) || keys.length === 0) throw new Error("NC03 parameter keys are required.");
    const payload = await this.requestJson("getParams", { keys });
    return payload?.data ?? {};
  }

  async connect() {
    const payload = await this.requestJson("loginInfo");
    return {
      connected: true,
      authenticated: Number(payload?.loginStatus) === 1,
      role: payload?.loginRole ?? null,
      alias: payload?.loginAlias ?? null
    };
  }

  async getLiveSnapshot() {
    const data = await this.getParams(LIVE_TELEMETRY_KEYS);
    return {
      refreshedAt: new Date().toISOString(),
      refreshIntervalSeconds: 10,
      status: statusFrom(data),
      battery: batteryFrom(data),
      signal: signalFrom(data)
    };
  }

  async getDeviceInfo() {
    const data = await this.getParams(FIRMWARE_STATUS_KEYS);
    return {
      model: data.device_product_name ?? null,
      firmware: data.device_software_version ?? null,
      hardware: data.device_hardware_version ?? null,
      manufacturer: data.device_manufacturer ?? null,
      fotaStatus: data.fota_curr_istatus ?? null,
      profile: data.device_software_version === NC03_FIRMWARE_80042 ? NC03_FIRMWARE_80042 : "unverified-firmware"
    };
  }

  async getStatus() {
    return statusFrom(await this.getParams(STATUS_KEYS));
  }

  async getBattery() {
    return batteryFrom(await this.getParams(BATTERY_KEYS));
  }

  async getSignal() {
    return signalFrom(await this.getParams(["mnet_sig_level", "mnet_sysmode", "mnet_operator_name"]));
  }

  async getNetworkInfo() {
    return this.getStatus();
  }

  async getWifiStatus() {
    const data = await this.getParams(WIFI_KEYS);
    const aps = [0, 1].map((index) => ({
      index,
      ssid: data[`wifi_ssid_${index}`] ?? null,
      frequency: data[`wifi_freq_${index}`] ?? null,
      mode: data[`wifi_mode_${index}`] ?? null,
      state: data[`wifi_state_${index}`] ?? null,
      clients: numeric(data[`wifi_client_${index}`])
    })).filter((ap) => ap.ssid || ap.state);
    return {
      enabled: data.wifi_work_status === "open",
      workStatus: data.wifi_work_status ?? null,
      workBand: data.wifi_work_band ?? null,
      aps
    };
  }

  async getConnectedClients() {
    const payload = await this.requestJson("hostsInfo");
    const list = Array.isArray(payload?.data?.rt_hosts_list) ? payload.data.rt_hosts_list : [];
    return list.map((item) => ({
      name: item.rt_hosts_hostname ?? null,
      ip: item.rt_hosts_ip ?? null,
      mac: item.rt_hosts_mac ?? null,
      type: item.rt_hosts_type ?? null,
      apIndex: item.rt_hosts_wifi_ap_index ?? null,
      ssid: item.rt_hosts_ssid ?? null,
      uptime: numeric(item.rt_hosts_uptime),
      onlineTime: item.rt_hosts_online_time ?? null,
      leaseTime: numeric(item.rt_hosts_lease_time)
    }));
  }

  async getDataUsage() {
    return { ...(await this.getParams(DATA_USAGE_KEYS)) };
  }

  async getDhcpSettings() {
    return { ...(await this.getParams(DHCP_KEYS)) };
  }

  async getDeviceState() {
    const payload = await this.requestJson("deviceState");
    return {
      uptime: numeric(payload.uptime),
      totalRam: numeric(payload.totalram),
      usedRam: numeric(payload.usageram),
      freeRam: numeric(payload.freeram),
      cpuUsage: numeric(payload.cpuusage),
      processes: numeric(payload.procs)
    };
  }
}
