import { CAPABILITY_STATUS } from "./CapabilityRegistry.js";

export {
  CONNECTIVITY_KEYS,
  FIRMWARE_STATUS_KEYS,
  LIVE_TELEMETRY_KEYS,
  NETWORK_SETTINGS_KEYS,
  POWER_SETTINGS_KEYS,
  SECURITY_STATUS_KEYS,
  SENSITIVE_KEYS_NOT_MIRRORED,
  TIME_SETTINGS_KEYS,
  WIFI_KEYS as SAFE_WIFI_KEYS
} from "./NC03Firmware80042Profile.js";

export const HAR2_CAPABILITY_OVERRIDES = Object.freeze([
  ["Status", "live telemetry"],
  ["Battery", "exact percentage"],
  ["Wi-Fi", "up to four AP profiles without PSK"],
  ["Mobile Network", "qualitative signal + 4G/5G mode"],
  ["Network Settings", "acquisition/scan/5G config"],
  ["SIM / eSIM", "slot/status metadata; identifiers withheld"],
  ["Data Usage", "day/month counters"],
  ["DHCP", "IPv4 read"],
  ["USB / Cradle", "USB tether/speed + cradle state"],
  ["Firewall / Security", "WPS/filter/DMZ state"],
  ["Time / NTP", "sync/timezone state"],
  ["Power / Display", "charging/power/display state"],
  ["Bridge Mode", "IP passthrough state"],
  ["Firmware / FOTA", "firmware/update state"]
].map(([module, evidence]) => Object.freeze({
  module,
  read: true,
  write: false,
  endpoint: "/action/get_mgdb_params",
  method: "POST",
  auth: "active modem login required",
  evidence,
  status: CAPABILITY_STATUS.READ_ONLY
})));
