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
  { module:"Login", read:true, write:false, endpoint:"/goform/get_login_info", method:"POST", auth:"login transaction not captured", status:CAPABILITY_STATUS.PARTIAL },
  { module:"Status", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Battery", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Wi-Fi", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Clients", read:true, write:false, endpoint:"/action/router_get_hosts_info", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Mobile Network", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Network Settings", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"SIM / eSIM", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"sensitive identifiers intentionally not mirrored", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Data Usage", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"DHCP", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"USB / Cradle", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Firewall / Security", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Time / NTP", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Power / Display", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Reboot", read:false, write:false, endpoint:"/action/reboot", method:"GET?", auth:"active modem login required", status:CAPABILITY_STATUS.PARTIAL },
  { module:"Bridge Mode", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"read state verified; write not verified", status:CAPABILITY_STATUS.READ_ONLY },
  { module:"Firmware / FOTA", read:true, write:false, endpoint:"/action/get_mgdb_params", method:"POST", auth:"active modem login required", status:CAPABILITY_STATUS.READ_ONLY }
].map(Object.freeze));

export const LIVE_TELEMETRY_KEYS = Object.freeze([
  "fota_curr_istatus",
  "wifi_work_status",
  "mnet_sim_status",
  "rt_internet_mode",
  "mnet_sig_level",
  "mnet_roam_status",
  "mnet_operator_name",
  "mnet_sysmode",
  "dialup_dial_status",
  "device_battery_charge_status",
  "device_battery_level",
  "device_battery_percent",
  "device_battery_percent_display",
  "device_bat_safe_charge_switch",
  "device_charge_long_life",
  "device_power_saving_mode",
  "mnet_sim_slot",
  "mnet_com_mode",
  "mnet_uq_state",
  "dialup_roamswitch",
  "rt_wwan_conn_info",
  "rt_eth_conn_info"
]);

export const STATUS_KEYS = Object.freeze([
  "mnet_sim_status",
  "rt_internet_mode",
  "mnet_sig_level",
  "mnet_roam_status",
  "mnet_operator_name",
  "mnet_sysmode",
  "dialup_dial_status",
  "wifi_work_status",
  "rt_wwan_conn_info",
  "rt_eth_conn_info"
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
  "wifi_if_6g_supported",
  "wifi_5g_sub_freq",
  "wifi_total_switch",
  ...[0,1,2,3].flatMap((index) => [
    `wifi_ssid_${index}`,
    `wifi_security_${index}`,
    `wifi_broadcast_ssid_${index}`,
    `wifi_freq_${index}`,
    `wifi_mode_${index}`,
    `wifi_channel_${index}`,
    `wifi_80211_mode_${index}`,
    `wifi_state_${index}`,
    `wifi_client_${index}`,
    `wifi_bandwidth_${index}`,
    `wifi_max_client_${index}`
  ])
]);

export const NETWORK_SETTINGS_KEYS = Object.freeze([
  "mnet_sim_slot",
  "mnet_com_mode",
  "mnet_uq_state",
  "dialup_roamswitch",
  "mnet_acqorder",
  "mnet_scan_mode",
  "mnet_nr5g_config_mode",
  "mnet_band",
  "mnet_band_lock_type",
  "mnet_band_auto_unlock_switch"
]);

export const CONNECTIVITY_KEYS = Object.freeze([
  "rt_ip_passthrough_switch",
  "rt_ip_passthrough_lan_type",
  "device_usb_tethering_status",
  "device_usb_speed_type",
  "rt_eth_type",
  "lcd_plinth_screen_saver_sw"
]);

export const SECURITY_STATUS_KEYS = Object.freeze([
  "wifi_wps_enable_state",
  "wifi_wps_mode",
  "wifi_macfilter_mode",
  "rt_security_protection_switch",
  "rt_macfilter_type",
  "rt_ipfilter_type",
  "rt_dmz_switch"
]);

export const POWER_SETTINGS_KEYS = Object.freeze([
  "device_bat_safe_charge_switch",
  "device_charge_long_life",
  "device_power_saving_mode",
  "device_as_timer",
  "device_as_switch",
  "device_ac_autostart",
  "device_turnoff_lcd_time",
  "lcd_eco_display_time_state",
  "device_pseudo_enable"
]);

export const TIME_SETTINGS_KEYS = Object.freeze([
  "ntp_current_time",
  "ntp_enable_state",
  "ntp_nitz_enable_state",
  "ntp_sync_state",
  "ntp_timezone",
  "ntp_format",
  "ntp_last_success",
  "ntp_daylight_state"
]);

export const FIRMWARE_STATUS_KEYS = Object.freeze([
  "device_product_name",
  "device_software_version",
  "device_hardware_version",
  "device_manufacturer",
  "fota_curr_istatus",
  "fota_retcode"
]);

export const DATA_USAGE_KEYS = Object.freeze([
  "statistics_data_used",
  "statistics_data_used_r",
  "statistics_data_limit",
  "statistics_data_limit_unit",
  "statistics_billing_day",
  "statistics_day_data_used",
  "statistics_day_data_used_r",
  "statistics_day_limit",
  "statistics_day_limit_unit",
  "statistics_time_mode"
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

export const SENSITIVE_KEYS_NOT_MIRRORED = Object.freeze([
  "xmg_wifi_psk_*",
  "device_imei",
  "device_meid",
  "device_sn",
  "mnet_sim_iccid",
  "mnet_sim_msisdn",
  "esim_eid",
  "esim_profile_*",
  "dialup_profile_*"
]);

export function registerNC0380042ReadRoutes(api) {
  for (const [name, route] of Object.entries(NC03_80042_READ_ROUTES)) {
    api.registerVerifiedRoute(name, route);
  }
  return api;
}
