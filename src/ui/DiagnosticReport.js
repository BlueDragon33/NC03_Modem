const REPORT_SCHEMA = "nc03-diagnostic-report/v1";

function text(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function onOff(value) {
  const raw = String(value ?? "").toLowerCase();
  if (["enable","enabled","open","on","1","true","wps_enable"].includes(raw)) return "Bật";
  if (["disable","disabled","close","off","0","false","acl_disable","disablefilter"].includes(raw)) return "Tắt";
  return text(value);
}

function humanSignal(value) {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "great") return "Rất tốt";
  if (raw === "good") return "Tốt";
  if (raw === "normal" || raw === "fair") return "Trung bình";
  if (raw === "poor" || raw === "weak") return "Yếu";
  return text(value);
}

function humanNetwork(value) {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "nsa") return "5G NSA";
  if (raw === "sa") return "5G SA";
  if (raw === "lte") return "4G LTE";
  return raw ? raw.toUpperCase() : "—";
}

function safePercent(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? `${number}%` : "—";
}

function safeCount(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : "—";
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B","KB","MB","GB","TB"];
  let n = bytes;
  let index = 0;
  while (n >= 1024 && index < units.length - 1) { n /= 1024; index += 1; }
  return `${n >= 10 || index === 0 ? n.toFixed(0) : n.toFixed(1)} ${units[index]}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[char]));
}

function sectionRows(rows) {
  return rows.map(([label,value]) => `<div class="row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}

function freshnessLabel(value) {
  if (value === "LIVE READ") return "Dữ liệu trực tiếp";
  if (value === "LAST GOOD") return "Dữ liệu gần nhất";
  return "Không có dữ liệu";
}

function freshnessTone(value) {
  if (value === "LIVE READ") return "ok";
  if (value === "LAST GOOD") return "warn";
  return "muted";
}

export function buildDiagnosticReport({
  baseUrl,
  live,
  details,
  liveStale = false,
  detailsStale = false,
  lastLiveSuccessAt = null,
  lastDetailsSuccessAt = null,
  generatedAt = new Date().toISOString()
} = {}) {
  const status = live?.status ?? {};
  const battery = live?.battery ?? {};
  const signal = live?.signal ?? {};
  const wifi = details?.wifi ?? {};
  const power = details?.power ?? {};
  const usb = details?.usb ?? {};
  const security = details?.security ?? {};
  const firmware = details?.firmware ?? {};
  const inventory = details?.ruleInventory ?? {};
  const dataUsage = details?.dataUsage ?? {};
  const liveAvailable = Boolean(live);
  const detailsAvailable = Boolean(details);

  return Object.freeze({
    schema: REPORT_SCHEMA,
    generatedAt,
    source: Object.freeze({
      modemOrigin: text(baseUrl),
      liveFreshness: liveAvailable ? (liveStale ? "LAST GOOD" : "LIVE READ") : "UNAVAILABLE",
      detailsFreshness: detailsAvailable ? (detailsStale ? "LAST GOOD" : "LIVE READ") : "UNAVAILABLE",
      lastLiveSuccessAt,
      lastDetailsSuccessAt
    }),
    overview: Object.freeze({
      connected: !liveAvailable ? "Không có dữ liệu" : liveStale ? "Đang kết nối lại" : status.connected ? "Đã kết nối" : "Chưa kết nối",
      internetMode: text(status.internetMode),
      network: humanNetwork(signal.systemMode ?? status.network),
      carrier: text(status.carrier ?? signal.carrier),
      signal: humanSignal(signal.level ?? status.signalLevel),
      simStatus: text(status.simStatus),
      battery: safePercent(battery.percentage),
      charging: !liveAvailable || battery.charging === null || battery.charging === undefined ? "—" : battery.charging ? "Đang sạc" : "Không sạc"
    }),
    wifi: Object.freeze({
      enabled: wifi.enabled === true ? "Bật" : wifi.enabled === false ? "Tắt" : "—",
      accessPointCount: detailsAvailable && Array.isArray(wifi.aps) ? wifi.aps.length : "—",
      connectedClientCount: detailsAvailable && Array.isArray(details?.clients) ? details.clients.length : "—",
      workBand: text(wifi.workBand)
    }),
    usage: Object.freeze({
      current: formatBytes(dataUsage.statistics_data_used),
      today: formatBytes(dataUsage.statistics_day_data_used)
    }),
    connectivity: Object.freeze({
      ipPassthrough: onOff(usb.bridgeState),
      usbTethering: onOff(usb.tethering),
      usbSpeed: text(usb.speed),
      ethernet: text(usb.ethernetType)
    }),
    power: Object.freeze({
      longLifeCharging: onOff(power.device_charge_long_life),
      safeCharge: onOff(power.device_bat_safe_charge_switch),
      powerMode: text(power.device_power_saving_mode)
    }),
    security: Object.freeze({
      wps: onOff(security.wifi_wps_enable_state),
      wifiMacFilter: onOff(security.wifi_macfilter_mode),
      ipFilter: onOff(security.rt_ipfilter_type),
      dmz: onOff(security.rt_dmz_switch)
    }),
    rules: Object.freeze({
      dhcpReservations: safeCount(inventory.dhcpReservations),
      portForwardingRules: safeCount(inventory.portForwardingRules),
      ipv4PacketFilterRules: safeCount(inventory.ipv4PacketFilterRules),
      ipv6PacketFilterRules: safeCount(inventory.ipv6PacketFilterRules)
    }),
    firmware: Object.freeze({
      model: text(firmware.model),
      firmware: text(firmware.firmware),
      hardware: text(firmware.hardware),
      manufacturer: text(firmware.manufacturer),
      fotaStatus: text(firmware.fotaStatus)
    }),
    limitations: Object.freeze([
      "Báo cáo chỉ dùng dữ liệu read-only đã xác minh.",
      "Dấu “—” nghĩa là modem/snapshot chưa cung cấp dữ liệu; không được diễn giải thành giá trị 0 hoặc trạng thái Tắt.",
      "Không chứa mật khẩu Wi-Fi, credential modem, token/session, IMEI/serial, ICCID/EID/eSIM profile hoặc APN profile.",
      "RSRP/RSRQ/SINR không được hiển thị vì HAR hiện tại chưa cung cấp các chỉ số đó.",
      "AUTH và thao tác ghi vẫn khóa cho tới khi có capture thật và WRITE VERIFIED."
    ])
  });
}

export function renderDiagnosticReportMarkup(report) {
  const generated = new Date(report.generatedAt);
  const generatedLabel = Number.isNaN(generated.getTime()) ? text(report.generatedAt) : generated.toLocaleString("vi-VN");
  const liveAt = report.source.lastLiveSuccessAt ? new Date(report.source.lastLiveSuccessAt).toLocaleString("vi-VN") : "—";
  const detailsAt = report.source.lastDetailsSuccessAt ? new Date(report.source.lastDetailsSuccessAt).toLocaleString("vi-VN") : "—";
  const liveTone = freshnessTone(report.source.liveFreshness);
  const detailsTone = freshnessTone(report.source.detailsFreshness);
  const qualityTone = report.source.liveFreshness === "LIVE READ" && report.source.detailsFreshness === "LIVE READ"
    ? "ok"
    : report.source.liveFreshness === "UNAVAILABLE" && report.source.detailsFreshness === "UNAVAILABLE"
      ? "muted"
      : "warn";

  return `<header class="head"><div><span class="eyebrow">NC03 CONTROL CENTER · SAFE DIAGNOSTIC</span><h1>Báo cáo chẩn đoán NC03</h1><p>Snapshot read-only · có đánh dấu độ mới dữ liệu · loại bỏ dữ liệu nhạy cảm.</p></div><span class="badge ${liveTone}">${escapeHtml(freshnessLabel(report.source.liveFreshness))}</span></header>
<section class="quality ${qualityTone}">
<div><strong>Độ tin cậy dữ liệu</strong><span>Live: ${escapeHtml(freshnessLabel(report.source.liveFreshness))} · Cấu hình: ${escapeHtml(freshnessLabel(report.source.detailsFreshness))}</span></div>
<div class="quality-badges"><span class="badge ${liveTone}">LIVE</span><span class="badge ${detailsTone}">ADVANCED</span></div>
</section>
<section class="meta">
<div><span>Thời điểm tạo</span><strong>${escapeHtml(generatedLabel)}</strong></div>
<div><span>Địa chỉ modem</span><strong>${escapeHtml(report.source.modemOrigin)}</strong></div>
<div><span>Live gần nhất</span><strong>${escapeHtml(liveAt)}</strong></div>
<div><span>Advanced gần nhất</span><strong>${escapeHtml(detailsAt)}</strong></div>
<div><span>Trạng thái Live</span><strong>${escapeHtml(freshnessLabel(report.source.liveFreshness))}</strong></div>
<div><span>Trạng thái cấu hình</span><strong>${escapeHtml(freshnessLabel(report.source.detailsFreshness))}</strong></div>
</section>
<section class="section"><h2>01 · Tổng quan kết nối</h2><div class="grid">${sectionRows([
["Kết nối",report.overview.connected],["Mạng",report.overview.network],["Nhà mạng",report.overview.carrier],["Chất lượng sóng",report.overview.signal],["Pin",report.overview.battery],["Trạng thái sạc",report.overview.charging],["SIM",report.overview.simStatus],["Internet mode",report.overview.internetMode]
])}</div></section>
<section class="section"><h2>02 · Wi-Fi & sử dụng</h2><div class="grid">${sectionRows([
["Wi-Fi",report.wifi.enabled],["Số AP",report.wifi.accessPointCount],["Thiết bị đã ghi nhận",report.wifi.connectedClientCount],["Work band",report.wifi.workBand],["Dữ liệu hiện tại",report.usage.current],["Dữ liệu hôm nay",report.usage.today]
])}</div></section>
<section class="section"><h2>03 · Kết nối vật lý & nguồn</h2><div class="grid">${sectionRows([
["IP Passthrough",report.connectivity.ipPassthrough],["USB tethering",report.connectivity.usbTethering],["USB speed",report.connectivity.usbSpeed],["Ethernet",report.connectivity.ethernet],["Long Life Charging",report.power.longLifeCharging],["Safe charge",report.power.safeCharge],["Power mode",report.power.powerMode]
])}</div></section>
<section class="section"><h2>04 · Bảo mật & rule inventory</h2><div class="grid">${sectionRows([
["WPS",report.security.wps],["Wi-Fi MAC filter",report.security.wifiMacFilter],["IP filter",report.security.ipFilter],["DMZ",report.security.dmz],["DHCP reservations",report.rules.dhcpReservations],["Port forwarding",report.rules.portForwardingRules],["IPv4 packet filters",report.rules.ipv4PacketFilterRules],["IPv6 packet filters",report.rules.ipv6PacketFilterRules]
])}</div></section>
<section class="section"><h2>05 · Firmware</h2><div class="grid">${sectionRows([
["Model",report.firmware.model],["Firmware",report.firmware.firmware],["Hardware",report.firmware.hardware],["Manufacturer",report.firmware.manufacturer],["FOTA",report.firmware.fotaStatus]
])}</div></section>
<section class="section"><h2>06 · Giới hạn & an toàn dữ liệu</h2><ul class="limitations">${report.limitations.map((item)=>`<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
<footer class="foot"><span>${REPORT_SCHEMA}</span><span>NC03 Control Center · local-first · read-only diagnostic report</span></footer>`;
}

export { REPORT_SCHEMA };
