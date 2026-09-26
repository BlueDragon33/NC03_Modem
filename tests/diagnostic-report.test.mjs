import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { buildDiagnosticReport, renderDiagnosticReportMarkup, REPORT_SCHEMA } from "../src/ui/DiagnosticReport.js";

test("diagnostic report exposes only selected safe fields", () => {
  const report = buildDiagnosticReport({
    baseUrl:"http://192.168.0.1",
    live:{
      status:{ connected:true, internetMode:"mobile", network:"nsa", carrier:"Carrier", signalLevel:"great", simStatus:"ready" },
      battery:{ percentage:72, charging:false },
      signal:{ systemMode:"nsa", carrier:"Carrier", level:"great" }
    },
    details:{
      wifi:{ enabled:true, workBand:"dual", aps:[{ssid:"Home"}], xmg_wifi_psk_0:"SECRET-PSK" },
      clients:[{name:"Phone",mac:"AA:BB"}],
      dataUsage:{statistics_data_used:1024,statistics_day_data_used:2048},
      firmware:{model:"NC03",firmware:"NC03_8.00.42",hardware:"HW",manufacturer:"Vendor",fotaStatus:"idle",device_imei:"SECRET-IMEI"},
      security:{wifi_wps_enable_state:"disable",wifi_macfilter_mode:"disable",rt_ipfilter_type:"disable",rt_dmz_switch:"disable",rt_dmz_ip:"192.168.0.9"},
      ruleInventory:{dhcpReservations:1,portForwardingRules:2,ipv4PacketFilterRules:3,ipv6PacketFilterRules:4},
      power:{device_charge_long_life:"enable",device_bat_safe_charge_switch:"enable",device_power_saving_mode:"normal"},
      usb:{bridgeState:"disable",tethering:"disable",speed:"usb3",ethernetType:"none"},
      token:"SECRET-TOKEN",
      password:"SECRET-PASSWORD",
      mnet_sim_iccid:"SECRET-ICCID",
      esim_eid:"SECRET-EID",
      dialup_profile_0:"SECRET-APN"
    },
    lastLiveSuccessAt:"2026-09-26T07:00:00.000Z",
    lastDetailsSuccessAt:"2026-09-26T07:00:05.000Z"
  });

  assert.equal(report.schema, REPORT_SCHEMA);
  assert.equal(report.overview.battery, "72%");
  assert.equal(report.wifi.accessPointCount, 1);
  assert.equal(report.wifi.connectedClientCount, 1);
  const serialized = JSON.stringify(report);
  for (const secret of ["SECRET-PSK","SECRET-IMEI","SECRET-TOKEN","SECRET-PASSWORD","SECRET-ICCID","SECRET-EID","SECRET-APN","192.168.0.9"]) {
    assert.equal(serialized.includes(secret), false, `report leaked ${secret}`);
  }
});

test("diagnostic report marks stale snapshots and renders a professional printable layout", () => {
  const report = buildDiagnosticReport({
    baseUrl:"http://192.168.0.1",
    live:{status:{connected:true},battery:{percentage:51},signal:{level:"good",systemMode:"lte"}},
    details:{wifi:{aps:[]},clients:[]},
    liveStale:true,
    detailsStale:true,
    generatedAt:"2026-09-26T07:00:00.000Z"
  });
  assert.equal(report.source.liveFreshness, "LAST GOOD");
  assert.equal(report.source.detailsFreshness, "LAST GOOD");
  assert.equal(report.overview.connected, "Đang kết nối lại");

  const html = renderDiagnosticReportMarkup(report);
  const css = fs.readFileSync(new URL("../report.css", import.meta.url), "utf8");
  const page = fs.readFileSync(new URL("../report.html", import.meta.url), "utf8");
  assert.match(html, /Báo cáo chẩn đoán NC03/);
  assert.match(css, /@page\{size:A4/);
  assert.match(page, /In \/ Lưu PDF/);
  assert.match(html, /Snapshot read-only/);
  assert.match(html, /LAST GOOD/);
});

test("diagnostic report escapes modem-provided text", () => {
  const report = buildDiagnosticReport({
    live:{status:{carrier:'<script>alert("x")</script>'},battery:{},signal:{}},
    details:{wifi:{aps:[]},clients:[],firmware:{model:'<img src=x onerror=alert(1)>'}}
  });
  const html = renderDiagnosticReportMarkup(report);
  assert.equal(html.includes('<script>alert("x")</script>'), false);
  assert.equal(html.includes('<img src=x onerror=alert(1)>'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
});


test("report page uses same-origin external assets and fragment-only payload transport", () => {
  const page = fs.readFileSync(new URL("../report.html", import.meta.url), "utf8");
  const script = fs.readFileSync(new URL("../report.js", import.meta.url), "utf8");
  assert.match(page, /Content-Security-Policy/);
  assert.match(page, /\.\/report\.css/);
  assert.match(page, /\.\/report\.js/);
  assert.doesNotMatch(page, /onclick=|onload=|onerror=/i);
  assert.match(script, /location\.hash/);
  assert.match(script, /history\.replaceState/);
  assert.doesNotMatch(script, /fetch\(/);
});


test("diagnostic report never converts missing snapshot data into false zero/offline facts", () => {
  const report = buildDiagnosticReport({ baseUrl:"http://192.168.0.1" });
  assert.equal(report.overview.connected, "Không có dữ liệu");
  assert.equal(report.overview.battery, "—");
  assert.equal(report.overview.charging, "—");
  assert.equal(report.wifi.accessPointCount, "—");
  assert.equal(report.wifi.connectedClientCount, "—");
  assert.equal(report.rules.dhcpReservations, "—");
  assert.equal(report.rules.portForwardingRules, "—");
});

test("diagnostic report localizes network/signal and rejects invalid report percentages", () => {
  const report = buildDiagnosticReport({
    live:{status:{connected:true},battery:{percentage:135,charging:false},signal:{level:"great",systemMode:"nsa"}},
    details:{wifi:{aps:[]},clients:[],ruleInventory:{dhcpReservations:0,portForwardingRules:0,ipv4PacketFilterRules:0,ipv6PacketFilterRules:0}}
  });
  assert.equal(report.overview.network, "5G NSA");
  assert.equal(report.overview.signal, "Rất tốt");
  assert.equal(report.overview.battery, "—");
  assert.equal(report.rules.dhcpReservations, 0);
  assert.equal(report.wifi.connectedClientCount, 0);
});

test("printable report exposes both live and advanced freshness with professional print safeguards", () => {
  const report = buildDiagnosticReport({
    live:{status:{connected:true},battery:{percentage:80},signal:{level:"good",systemMode:"lte"}},
    details:{wifi:{aps:[]},clients:[]},
    liveStale:false,
    detailsStale:true
  });
  const html = renderDiagnosticReportMarkup(report);
  const css = fs.readFileSync(new URL("../report.css", import.meta.url), "utf8");
  assert.match(html, /Độ tin cậy dữ liệu/);
  assert.match(html, /Trạng thái Live/);
  assert.match(html, /Trạng thái cấu hình/);
  assert.match(html, /Dữ liệu gần nhất/);
  assert.match(css, /print-color-adjust:exact/);
  assert.match(css, /grid-template-columns:repeat\(3,1fr\)/);
});
