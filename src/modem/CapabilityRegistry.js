import {
  CAPABILITY_LIFECYCLE,
  NC03_SETTINGS_REGISTRY,
  canReadSetting,
  canWriteSetting
} from "../domain/NC03SettingsRegistry.js";

export const CAPABILITY_STATUS = Object.freeze({
  VERIFIED: "VERIFIED",
  READ_ONLY: "READ ONLY",
  WRITE_VERIFIED: "WRITE VERIFIED",
  PARTIAL: "PARTIAL",
  UNKNOWN: "UNKNOWN",
  UNSAFE: "UNSAFE"
});

const LEGACY_MODULES = Object.freeze([
  ["Login", ["auth.login"]],
  ["Status", ["auth.session-status", "system.firmware-status"]],
  ["Battery", ["power.safe-charge", "power.long-life", "power.mode", "power.auto-sleep-switch", "power.auto-sleep-timer", "power.ac-autostart", "power.lcd-timeout", "power.eco-display", "power.pseudo-enable"]],
  ["Wi-Fi", NC03_SETTINGS_REGISTRY.entries.filter((entry)=>entry.family==="wifi").map((entry)=>entry.id)],
  ["Clients", ["devices.connected-list", "devices.client-admin"]],
  ["Mobile Network", NC03_SETTINGS_REGISTRY.entries.filter((entry)=>entry.family==="mobile-network").map((entry)=>entry.id)],
  ["Data Usage", ["mobile.data-usage"]],
  ["DHCP", NC03_SETTINGS_REGISTRY.entries.filter((entry)=>entry.id.startsWith("lan.dhcp") || entry.id==="lan.gateway" || entry.id==="lan.subnet-mask" || entry.id==="lan.dns-proxy" || entry.id==="lan.dns-address").map((entry)=>entry.id)],
  ["Firewall", NC03_SETTINGS_REGISTRY.entries.filter((entry)=>entry.family==="security-wps-firewall-dmz").map((entry)=>entry.id)],
  ["Reboot", ["system.reboot"]],
  ["Bridge Mode", ["connectivity.bridge-enable", "connectivity.bridge-lan-type"]],
  ["Firmware", ["system.firmware-status"]]
]);

function lifecycleRank(lifecycle) {
  return {
    [CAPABILITY_LIFECYCLE.UNMAPPED]:0,
    [CAPABILITY_LIFECYCLE.READ_MAPPED]:1,
    [CAPABILITY_LIFECYCLE.WRITE_CANDIDATE]:2,
    [CAPABILITY_LIFECYCLE.WRITE_VERIFIED]:3,
    [CAPABILITY_LIFECYCLE.HARDWARE_ACCEPTED]:4
  }[lifecycle] ?? 0;
}

function moduleStatus(ids) {
  const entries=ids
    .map((id)=>NC03_SETTINGS_REGISTRY.entries.find((entry)=>entry.id===id))
    .filter(Boolean);
  const maxLifecycle=entries.reduce((best,entry)=>lifecycleRank(entry.capability.lifecycle)>lifecycleRank(best)?entry.capability.lifecycle:best,CAPABILITY_LIFECYCLE.UNMAPPED);
  if(entries.some((entry)=>canWriteSetting(entry.id))) return CAPABILITY_STATUS.WRITE_VERIFIED;
  if(maxLifecycle===CAPABILITY_LIFECYCLE.WRITE_CANDIDATE) return CAPABILITY_STATUS.PARTIAL;
  if(entries.some((entry)=>canReadSetting(entry.id))) return CAPABILITY_STATUS.READ_ONLY;
  return CAPABILITY_STATUS.UNKNOWN;
}

export const DEFAULT_CAPABILITIES = Object.freeze(LEGACY_MODULES.map(([module, ids]) => Object.freeze({
  module,
  ids:Object.freeze([...ids]),
  read:ids.some((id)=>canReadSetting(id)),
  write:ids.some((id)=>canWriteSetting(id)),
  endpoint:"",
  method:"",
  auth:"",
  status:moduleStatus(ids),
  source:"NC03_SETTINGS_REGISTRY"
})));

export function canRead(capability) {
  return [CAPABILITY_STATUS.VERIFIED, CAPABILITY_STATUS.READ_ONLY, CAPABILITY_STATUS.WRITE_VERIFIED, CAPABILITY_STATUS.PARTIAL].includes(capability?.status);
}

export function canWrite(capability) {
  return capability?.status === CAPABILITY_STATUS.WRITE_VERIFIED;
}
