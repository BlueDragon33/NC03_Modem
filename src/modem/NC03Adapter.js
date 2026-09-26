export class UnsupportedCapabilityError extends Error {
  constructor(capability) {
    super(`NC03 capability chưa được xác minh: ${capability}`);
    this.name = "UnsupportedCapabilityError";
    this.capability = capability;
  }
}

export class NC03Adapter {
  constructor({ baseUrl = "http://192.168.0.1" } = {}) {
    this.baseUrl = baseUrl;
  }

  async connect() { throw new UnsupportedCapabilityError("connect"); }
  async login() { throw new UnsupportedCapabilityError("login"); }
  async logout() { throw new UnsupportedCapabilityError("logout"); }
  async getDeviceInfo() { throw new UnsupportedCapabilityError("getDeviceInfo"); }
  async getLiveSnapshot() { throw new UnsupportedCapabilityError("getLiveSnapshot"); }
  async getStatus() { throw new UnsupportedCapabilityError("getStatus"); }
  async getBattery() { throw new UnsupportedCapabilityError("getBattery"); }
  async getSignal() { throw new UnsupportedCapabilityError("getSignal"); }
  async getNetworkInfo() { throw new UnsupportedCapabilityError("getNetworkInfo"); }
  async getNetworkSettings() { throw new UnsupportedCapabilityError("getNetworkSettings"); }
  async getMobileServiceStatus() { throw new UnsupportedCapabilityError("getMobileServiceStatus"); }
  async getRuleInventory() { throw new UnsupportedCapabilityError("getRuleInventory"); }
  async getWifiStatus() { throw new UnsupportedCapabilityError("getWifiStatus"); }
  async getConnectedClients() { throw new UnsupportedCapabilityError("getConnectedClients"); }
  async getDataUsage() { throw new UnsupportedCapabilityError("getDataUsage"); }
  async getUsbStatus() { throw new UnsupportedCapabilityError("getUsbStatus"); }
  async getPowerSettings() { throw new UnsupportedCapabilityError("getPowerSettings"); }
  async getSecurityStatus() { throw new UnsupportedCapabilityError("getSecurityStatus"); }
  async getTimeSettings() { throw new UnsupportedCapabilityError("getTimeSettings"); }
  async getFirmwareStatus() { throw new UnsupportedCapabilityError("getFirmwareStatus"); }
  async getAdvancedSnapshot() { throw new UnsupportedCapabilityError("getAdvancedSnapshot"); }
  async setWifiSettings() { throw new UnsupportedCapabilityError("setWifiSettings"); }
  async setWifiPassword() { throw new UnsupportedCapabilityError("setWifiPassword"); }
  async setWifiBand() { throw new UnsupportedCapabilityError("setWifiBand"); }
  async setLongLifeCharging() { throw new UnsupportedCapabilityError("setLongLifeCharging"); }
  async setEcoMode() { throw new UnsupportedCapabilityError("setEcoMode"); }
  async setNetworkMode() { throw new UnsupportedCapabilityError("setNetworkMode"); }
  async blockClient() { throw new UnsupportedCapabilityError("blockClient"); }
  async unblockClient() { throw new UnsupportedCapabilityError("unblockClient"); }
  async reboot() { throw new UnsupportedCapabilityError("reboot"); }
  async getDhcpSettings() { throw new UnsupportedCapabilityError("getDhcpSettings"); }
  async setDhcpSettings() { throw new UnsupportedCapabilityError("setDhcpSettings"); }
  async getBridgeStatus() { throw new UnsupportedCapabilityError("getBridgeStatus"); }
  async setBridgeMode() { throw new UnsupportedCapabilityError("setBridgeMode"); }
}
