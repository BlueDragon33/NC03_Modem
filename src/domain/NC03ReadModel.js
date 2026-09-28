export const NC03_READ_MODEL_SCHEMA = "nc03-read-model/v1";
export const NC03_READ_MODEL_VERSION = "1.0.0";

function present(value) {
  return value !== undefined && value !== null && value !== "";
}

function boolToken(value, truthy = [], falsy = []) {
  if (typeof value === "boolean") return value;
  const normalized=String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (truthy.includes(normalized)) return true;
  if (falsy.includes(normalized)) return false;
  return null;
}

function numberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined || value === "") return null;
  const parsed=Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function copyObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function freshness(capturedAt) {
  return {
    state:"FRESH",
    capturedAt:capturedAt ?? null,
    staleReason:null
  };
}

export function markReadModelStale(model, reason = "LAST_KNOWN_GOOD") {
  if (!model || typeof model !== "object") return model;
  return {
    ...model,
    meta:{
      ...(model.meta ?? {}),
      freshness:{
        state:"STALE",
        capturedAt:model.meta?.freshness?.capturedAt ?? model.meta?.capturedAt ?? null,
        staleReason:reason
      }
    }
  };
}

export function normalizeLiveSnapshot(raw = {}) {
  const capturedAt=raw.refreshedAt ?? new Date().toISOString();
  return {
    schema:NC03_READ_MODEL_SCHEMA,
    version:NC03_READ_MODEL_VERSION,
    kind:"LIVE",
    meta:{
      capturedAt,
      refreshIntervalSeconds:numberOrNull(raw.refreshIntervalSeconds) ?? 10,
      freshness:freshness(capturedAt)
    },
    status:copyObject(raw.status),
    battery:copyObject(raw.battery),
    signal:copyObject(raw.signal)
  };
}

export function normalizeAdvancedSnapshot(raw = {}) {
  const capturedAt=raw.refreshedAt ?? new Date().toISOString();
  const network=copyObject(raw.networkSettings);
  const mobile=copyObject(raw.mobileService);
  const dhcp=copyObject(raw.dhcp);
  const usb=copyObject(raw.usb);
  const power=copyObject(raw.power);
  const security=copyObject(raw.security);
  const time=copyObject(raw.time);
  const usage=copyObject(raw.dataUsage);

  return {
    schema:NC03_READ_MODEL_SCHEMA,
    version:NC03_READ_MODEL_VERSION,
    kind:"DETAILS",
    meta:{
      capturedAt,
      freshness:freshness(capturedAt),
      privacy:"ALLOWLISTED_NORMALIZED_FIELDS"
    },
    mobile:{
      dataEnabled:boolToken(mobile.mobileData,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      roamingEnabled:boolToken(network.dialup_roamswitch,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      simSlot:mobile.simSlot ?? null,
      simStatus:mobile.simStatus ?? null,
      pinProtectionEnabled:boolToken(mobile.pinProtection,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      pinRemainingTries:numberOrNull(mobile.pinRemainingTries),
      cloudSimAutoSwitchEnabled:boolToken(mobile.cloudSimAutoSwitch,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      cloudSimNotificationEnabled:boolToken(mobile.cloudSimNotification,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      cloudSimNoServiceMinutes:numberOrNull(mobile.cloudSimNoServiceMinutes),
      cloudSimDuration:mobile.cloudSimDuration ?? null,
      acquisitionOrder:network.mnet_acqorder ?? null,
      scanMode:network.mnet_scan_mode ?? null,
      nr5gMode:network.mnet_nr5g_config_mode ?? null,
      band:network.mnet_band ?? null,
      bandLockType:network.mnet_band_lock_type ?? null,
      bandAutoUnlockEnabled:boolToken(network.mnet_band_auto_unlock_switch,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"])
    },
    wifi:raw.wifi && typeof raw.wifi === "object" ? {
      enabled:raw.wifi.enabled ?? null,
      workStatus:raw.wifi.workStatus ?? null,
      workBand:raw.wifi.workBand ?? null,
      supports6G:raw.wifi.supports6G ?? null,
      sub5G:raw.wifi.sub5G ?? null,
      totalSwitch:raw.wifi.totalSwitch ?? null,
      aps:Array.isArray(raw.wifi.aps) ? raw.wifi.aps.map((ap)=>({
        index:numberOrNull(ap.index),
        ssid:ap.ssid ?? null,
        security:ap.security ?? null,
        broadcast:ap.broadcast ?? null,
        frequency:ap.frequency ?? null,
        mode:ap.mode ?? null,
        channel:ap.channel ?? null,
        standard:ap.standard ?? null,
        state:ap.state ?? null,
        clients:numberOrNull(ap.clients),
        bandwidth:ap.bandwidth ?? null,
        maxClients:numberOrNull(ap.maxClients)
      })) : []
    } : { enabled:null, aps:[] },
    lan:{
      dhcpEnabled:boolToken(dhcp.rt_dhcp_v4_switch,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      gateway:dhcp.rt_dhcp_v4_gw ?? null,
      subnetMask:dhcp.rt_dhcp_v4_mask ?? null,
      dhcpStart:dhcp.rt_dhcp_v4_start ?? null,
      dhcpEnd:dhcp.rt_dhcp_v4_end ?? null,
      leaseSeconds:numberOrNull(dhcp.rt_dhcp_lease_time),
      dnsProxyEnabled:boolToken(dhcp.rt_dhcp_dns_proxy,["enable","enabled","open","on","1","true","auto"],["disable","disabled","close","closed","off","0","false","manual"]),
      dnsAddress:dhcp.rt_dhcp_dns_addr ?? null
    },
    connectivity:{
      usbTethering:usb.tethering ?? null,
      usbSpeed:usb.speed ?? null,
      ethernetType:usb.ethernetType ?? null,
      bridgeEnabled:boolToken(usb.bridgeState,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      bridgeState:usb.bridgeState ?? null,
      bridgeLanType:usb.bridgeLanType ?? null,
      cradleScreenSaver:usb.cradleScreenSaver ?? null
    },
    power:{
      longLifeCharging:boolToken(power.device_charge_long_life,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      safeChargeEnabled:boolToken(power.device_bat_safe_charge_switch,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      mode:power.device_power_saving_mode ?? null,
      autoSleepEnabled:boolToken(power.device_as_switch,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      autoSleepTimer:power.device_as_timer ?? null,
      lcdTimeout:power.device_turnoff_lcd_time ?? null,
      acAutoStartEnabled:boolToken(power.device_ac_autostart,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      ecoDisplayEnabled:boolToken(power.lcd_eco_display_time_state,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      pseudoEnabled:boolToken(power.device_pseudo_enable,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"])
    },
    security:{
      wpsEnabled:boolToken(security.wifi_wps_enable_state,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      wpsMode:security.wifi_wps_mode ?? null,
      wifiMacFilterMode:security.wifi_macfilter_mode ?? null,
      protectionEnabled:boolToken(security.rt_security_protection_switch,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      macFilterType:security.rt_macfilter_type ?? null,
      ipFilterType:security.rt_ipfilter_type ?? null,
      dmzEnabled:boolToken(security.rt_dmz_switch,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"])
    },
    system:{
      ntpEnabled:boolToken(time.ntp_enable_state,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      nitzEnabled:boolToken(time.ntp_nitz_enable_state,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"]),
      timezone:time.ntp_timezone ?? null,
      timeFormat:time.ntp_format ?? null,
      daylightEnabled:boolToken(time.ntp_daylight_state,["enable","enabled","open","on","1","true"],["disable","disabled","close","closed","off","0","false"])
    },
    dataUsage:{
      totalBytes:numberOrNull(usage.statistics_data_used),
      dailyBytes:numberOrNull(usage.statistics_day_data_used),
      limitBytes:numberOrNull(usage.statistics_data_limit),
      billingDay:numberOrNull(usage.statistics_billing_day),
      dailyLimitBytes:numberOrNull(usage.statistics_day_limit),
      timeMode:usage.statistics_time_mode ?? null
    },
    rules:{
      dhcpReservations:numberOrNull(raw.ruleInventory?.dhcpReservations) ?? 0,
      portForwarding:numberOrNull(raw.ruleInventory?.portForwardingRules) ?? 0,
      ipv4PacketFilters:numberOrNull(raw.ruleInventory?.ipv4PacketFilterRules) ?? 0,
      ipv6PacketFilters:numberOrNull(raw.ruleInventory?.ipv6PacketFilterRules) ?? 0
    },
    clients:Array.isArray(raw.clients) ? raw.clients.map((client)=>({
      name:client.name ?? null,
      ip:client.ip ?? null,
      mac:client.mac ?? null,
      type:client.type ?? null,
      apIndex:numberOrNull(client.apIndex),
      ssid:client.ssid ?? null,
      uptimeSeconds:numberOrNull(client.uptime),
      onlineTime:client.onlineTime ?? null,
      leaseSeconds:numberOrNull(client.leaseTime)
    })) : [],
    firmware:copyObject(raw.firmware),
    deviceState:copyObject(raw.deviceState)
  };
}

export function isReadModel(value, kind = null) {
  if (!value || value.schema !== NC03_READ_MODEL_SCHEMA || value.version !== NC03_READ_MODEL_VERSION) return false;
  return kind ? value.kind === kind : true;
}
