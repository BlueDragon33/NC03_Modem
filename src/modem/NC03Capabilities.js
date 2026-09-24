import { CAPABILITY_STATUS, DEFAULT_CAPABILITIES, canRead, canWrite } from "./CapabilityRegistry.js";

export { CAPABILITY_STATUS, DEFAULT_CAPABILITIES, canRead, canWrite };

export class NC03Capabilities {
  constructor(rows = DEFAULT_CAPABILITIES) {
    this.rows = rows.map((row) => ({ ...row }));
    this.firmware = null;
  }

  setFirmware(firmware) {
    this.firmware = firmware ? String(firmware) : null;
  }

  get(module) {
    return this.rows.find((row) => row.module === module) ?? null;
  }

  supportsRead(module) {
    return canRead(this.get(module));
  }

  supportsWrite(module) {
    return canWrite(this.get(module));
  }
}
