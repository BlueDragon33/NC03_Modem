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

export const SAFE_WIFI_KEYS = Object.freeze([
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
