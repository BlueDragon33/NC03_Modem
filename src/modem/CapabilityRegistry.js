export const CAPABILITY_STATUS = Object.freeze({
  VERIFIED: "VERIFIED",
  READ_ONLY: "READ ONLY",
  WRITE_VERIFIED: "WRITE VERIFIED",
  PARTIAL: "PARTIAL",
  UNKNOWN: "UNKNOWN",
  UNSAFE: "UNSAFE"
});

export const DEFAULT_CAPABILITIES = Object.freeze([
  "Login", "Status", "Battery", "Wi-Fi", "Clients", "Mobile Network",
  "Data Usage", "DHCP", "Firewall", "Reboot", "Bridge Mode", "Firmware"
].map((module) => ({ module, read: false, write: false, endpoint: "", method: "", auth: "", status: CAPABILITY_STATUS.UNKNOWN })));

export function canRead(capability) {
  return [CAPABILITY_STATUS.VERIFIED, CAPABILITY_STATUS.READ_ONLY, CAPABILITY_STATUS.WRITE_VERIFIED].includes(capability?.status);
}

export function canWrite(capability) {
  return capability?.status === CAPABILITY_STATUS.WRITE_VERIFIED;
}
