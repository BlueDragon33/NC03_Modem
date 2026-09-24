import { NC03Adapter } from "./NC03Adapter.js";

const MOCK = Object.freeze({
  device: { model: "NC03", firmware: "DEMO", imei: "DEMO DATA" },
  status: { internet: "Connected", network: "5G SA", carrier: "Demo Carrier" },
  battery: { exactPercentage: true, percentage: 72, charging: true, longLife: true },
  signal: { quality: "Excellent", rsrp: -82, rsrq: -10, sinr: 19 },
  wifi: { enabled: true, ssid: "NC03-DEMO", bands: ["2.4 GHz", "5 GHz"], clients: 4 },
  clients: [
    { name: "iPhone 16 Pro", ip: "192.168.0.2", mac: "AA:BB:CC:DD:EE:01", state: "Online", band: "5 GHz" },
    { name: "Laptop", ip: "192.168.0.3", mac: "AA:BB:CC:DD:EE:02", state: "Online", band: "5 GHz" }
  ],
  data: { current: "12.8 GB", quota: "100 GB" }
});

export class MockNC03Adapter extends NC03Adapter {
  async connect() { return { connected: true, demo: true }; }
  async login() { return { authenticated: true, demo: true }; }
  async logout() { return { authenticated: false, demo: true }; }
  async getDeviceInfo() { return structuredClone(MOCK.device); }
  async getStatus() { return structuredClone(MOCK.status); }
  async getBattery() { return structuredClone(MOCK.battery); }
  async getSignal() { return structuredClone(MOCK.signal); }
  async getNetworkInfo() { return structuredClone(MOCK.status); }
  async getWifiStatus() { return structuredClone(MOCK.wifi); }
  async getConnectedClients() { return structuredClone(MOCK.clients); }
  async getDataUsage() { return structuredClone(MOCK.data); }
}
