import { CAPABILITY_STATUS } from "./CapabilityRegistry.js";

export const NC03_FIRMWARE_80042 = "NC03_8.00.42";

export const NC03_80042_READ_ROUTES = Object.freeze({
  loginInfo: Object.freeze({
    path: "/goform/get_login_info",
    method: "POST",
    operation: "read",
    status: CAPABILITY_STATUS.READ_ONLY,
    evidence: "real-har"
  }),
  getParams: Object.freeze({
    path: "/action/get_mgdb_params",
    method: "POST",
    operation: "read",
    status: CAPABILITY_STATUS.READ_ONLY,
    evidence: "real-har"
  }),
  hostsInfo: Object.freeze({
    path: "/action/router_get_hosts_info",
    method: "POST",
    operation: "read",
    status: CAPABILITY_STATUS.READ_ONLY,
    evidence: "real-har"
  }),
  deviceState: Object.freeze({
    path: "/action/get_device_state",
    method: "POST",
    operation: "read",
    status: CAPABILITY_STATUS.READ_ONLY,
    evidence: "real-har"
  })
});

export const NC03_80042_DISCOVERED_WRITES = Object.freeze([
  ["/action/device_set_battery_safe_charge", "battery", "vendor-js"],
  ["/action/device_set_power_saving_mode", "battery", "vendor-js"],
  ["/action/device_set_autosleep", "battery", "vendor-js"],
  ["/action/device_set_turnoff_lcd_time", "battery", "vendor-js"],
  ["/action/device_set_ac_autostart", "battery", "vendor-js"],
  ["/action/lcd_set_eco_display_time_state", "battery", "vendor-js"],
  ["/action/wifi_set_ap_params", "wifi", "vendor-js"],
  ["/action/wifi_set_ap_txpower", "wifi", "vendor-js"],
  ["/action/wifi_set_basic_params", "wifi", "vendor-js"],
  ["/action/router_set_privacy_separator_params", "wifi", "vendor-js"],
  ["/action/wifi_set_wps_status", "wps", "vendor-js"],
  ["/action/wifi_set_macfilter_params", "wifi", "vendor-js"],
  ["/action/router_set_security_protection", "security", "vendor-js"],
  ["/action/router_set_dhcp_params", "dhcp", "vendor-js"],
  ["/action/router_set_ip_mac_bind_params", "dhcp", "vendor-js"],
  ["/action/reboot", "system", "vendor-js-get-helper"],
  ["/action/device_set_usb_tethering", "usb", "vendor-js"],
  ["/action/device_set_usb_speed_type", "usb", "vendor-js"],
  ["/action/statistics_set_dsflow", "data-usage", "vendor-js"],
  ["/action/statistics_clear_dsflow", "data-usage", "vendor-js"],
  ["/goform/schedule_process", "batch-write", "vendor-js"]
].map(([path, module, evidence]) => Object.freeze({
  path,
  module,
  evidence,
  status: CAPABILITY_STATUS.PARTIAL
})));

export const NC03_80042_CAPABILITIES = Object.freeze([
  { module:"Login", read:true, write:false, endpoint:"/goform/get_login_info", method:"POST", auth:"login flow not captured", status:CAPABILITY_STATUS.PARTIAL },
  { module:"Status", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Battery", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Wi-Fi", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Clients", read:true, write:false, endpoint:"/action/router_get_hosts_info", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Mobile Network", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Data Usage", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"DHCP", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Firewall", read:false, write:false, endpoint:"", method:"", auth:"", status:CAPABILITY_STATUS.UNKNOWN },
  { module:"Reboot", read:false, write:false, endpoint:"/action/reboot", method:"GET?", auth:"active modem login required", status:CAPABILITY_STATUS.PARTIAL },
  { module:"Bridge Mode", read:false, write:false, endpoint:"rt_ip_passthrough_switch", method:"mgdb key", auth:"semantics not yet verified", status:CAPABILITY_STATUS.PARTIAL },
  { module:"Firmware", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY }
].map(Object.freeze));

export const STATUS_KEYS = Object.freeze([
  "mnet_sim_status",
  "rt_internet_mode",
  "mnet_sig_level",
  "mnet_roam_status",
  "mnet_operator_name",
  "mnet_sysmode",
  "dialup_dial_status",
  "wifi_work_status"
]);

export const BATTERY_KEYS = Object.freeze([
  "device_battery_charge_status",
  "device_battery_level",
  "device_battery_percent",
  "device_battery_percent_display",
  "device_bat_safe_charge_switch",
  "device_charge_long_life",
  "device_power_saving_mode"
]);

export const WIFI_KEYS = Object.freeze([
  "wifi_work_status",
  "wifi_work_band",
  "wifi_ssid_0",
  "wifi_freq_0",
  "wifi_mode_0",
  "wifi_state_0",
  "wifi_client_0",
  "wifi_ssid_1",
  "wifi_freq_1",
  "wifi_mode_1",
  "wifi_state_1",
  "wifi_client_1"
]);

export const DATA_USAGE_KEYS = Object.freeze([
  "statistics_data_used",
  "statistics_data_used_r",
  "statistics_data_limit",
  "statistics_data_limit_unit",
  "statistics_day_data_used",
  "statistics_day_data_used_r",
  "statistics_day_limit",
  "statistics_day_limit_unit"
]);

export const DHCP_KEYS = Object.freeze([
  "rt_dhcp_v4_switch",
  "rt_dhcp_v4_gw",
  "rt_dhcp_v4_mask",
  "rt_dhcp_v4_start",
  "rt_dhcp_v4_end",
  "rt_dhcp_lease_time",
  "rt_dhcp_dns_proxy",
  "rt_dhcp_dns_addr"
]);

export function registerNC0380042ReadRoutes(api) {
  for (const [name, route] of Object.entries(NC03_80042_READ_ROUTES)) {
    api.registerVerifiedRoute(name, route);
  }
  return api;
}
