import test from "node:test";
import assert from "node:assert/strict";
import {
  NC03_READ_MODEL_SCHEMA,
  normalizeAdvancedSnapshot,
  normalizeLiveSnapshot,
  markReadModelStale,
  isReadModel
} from "../src/domain/NC03ReadModel.js";

test("advanced read model removes vendor field names from product contract", () => {
  const model=normalizeAdvancedSnapshot({
    refreshedAt:"2026-09-28T10:00:00.000Z",
    networkSettings:{
      dialup_roamswitch:"enable",
      mnet_acqorder:"nr5g",
      mnet_nr5g_config_mode:"nsa",
      mnet_band:"78",
      mnet_band_lock_type:"auto"
    },
    mobileService:{
      mobileData:"enable",
      simSlot:"sim",
      simStatus:"ready",
      pinProtection:"disable",
      cloudSimAutoSwitch:"enable"
    },
    dhcp:{
      rt_dhcp_v4_switch:"enable",
      rt_dhcp_v4_gw:"192.168.0.1",
      rt_dhcp_v4_mask:"255.255.255.0",
      rt_dhcp_v4_start:"192.168.0.2",
      rt_dhcp_v4_end:"192.168.0.254",
      rt_dhcp_lease_time:"86400"
    },
    power:{
      device_charge_long_life:"enable",
      device_bat_safe_charge_switch:"disable"
    },
    security:{
      wifi_wps_enable_state:"disable",
      rt_dmz_switch:"disable"
    },
    time:{
      ntp_enable_state:"enable",
      ntp_timezone:"Asia/Tokyo",
      ntp_format:"24H"
    },
    dataUsage:{
      statistics_data_used:"1024",
      statistics_day_data_used:"512"
    },
    ruleInventory:{
      dhcpReservations:1,
      portForwardingRules:2,
      ipv4PacketFilterRules:3,
      ipv6PacketFilterRules:4
    },
    wifi:{enabled:true,aps:[{index:0,ssid:"NC03",state:"enable",clients:"3"}]},
    clients:[{name:"Phone",ip:"192.168.0.2",mac:"AA:BB",uptime:"10"}],
    usb:{tethering:"enable",bridgeState:"disable"},
    firmware:{model:"NC03",firmware:"NC03_8.00.42"},
    deviceState:{uptime:100}
  });

  assert.equal(model.schema,NC03_READ_MODEL_SCHEMA);
  assert.equal(model.kind,"DETAILS");
  assert.equal(model.mobile.dataEnabled,true);
  assert.equal(model.mobile.roamingEnabled,true);
  assert.equal(model.mobile.acquisitionOrder,"nr5g");
  assert.equal(model.lan.dhcpEnabled,true);
  assert.equal(model.lan.leaseSeconds,86400);
  assert.equal(model.power.longLifeCharging,true);
  assert.equal(model.security.wpsEnabled,false);
  assert.equal(model.system.timezone,"Asia/Tokyo");
  assert.equal(model.dataUsage.totalBytes,1024);
  assert.equal(model.rules.portForwarding,2);
  assert.equal(model.clients[0].uptimeSeconds,10);

  const serialized=JSON.stringify(model);
  for(const vendor of ["mnet_acqorder","rt_dhcp_v4_gw","device_charge_long_life","wifi_wps_enable_state","statistics_data_used"]) {
    assert.equal(serialized.includes(vendor),false,vendor);
  }
});

test("live read model is versioned and freshness is explicit", () => {
  const model=normalizeLiveSnapshot({
    refreshedAt:"2026-09-28T10:00:00.000Z",
    refreshIntervalSeconds:10,
    status:{connected:true},
    battery:{percentage:70},
    signal:{level:"great"}
  });
  assert.equal(model.kind,"LIVE");
  assert.equal(model.meta.freshness.state,"FRESH");
  const stale=markReadModelStale(model,"POLL_FAILED");
  assert.equal(stale.meta.freshness.state,"STALE");
  assert.equal(stale.meta.freshness.staleReason,"POLL_FAILED");
  assert.equal(isReadModel(model,"LIVE"),true);
});

test("unknown boolean tokens remain null rather than invented", () => {
  const model=normalizeAdvancedSnapshot({
    mobileService:{mobileData:"mystery"},
    dhcp:{rt_dhcp_v4_switch:"unknown"},
    power:{device_charge_long_life:"maybe"}
  });
  assert.equal(model.mobile.dataEnabled,null);
  assert.equal(model.lan.dhcpEnabled,null);
  assert.equal(model.power.longLifeCharging,null);
});
