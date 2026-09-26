import { MockNC03Adapter } from "./src/modem/MockNC03Adapter.js";
import { NC03_80042_CAPABILITIES } from "./src/modem/NC03Firmware80042Profile.js";
import { HAR2_CAPABILITY_OVERRIDES } from "./src/modem/NC03Har2Profile.js";
import { parseHar, summarizeCandidates } from "./src/modem/HarDiscovery.js";
import { loadPreferences, savePreferences, SECURITY_NOTE } from "./src/modem/LocalPreferences.js";
import { CONNECTION_STATE, connectionStateLabel } from "./src/modem/ConnectionState.js";
import { PRIMARY_NAV, UI_MODE } from "./src/ui/NavigationModel.js";
import { DEFAULT_MODEM_URL, normalizeModemAddress } from "./src/modem/LoginPolicy.js";

const app = document.querySelector("#app");
const prefs = loadPreferences();
const LIVE_REFRESH_MS = 10_000;
let liveTimer = null;
let liveRefreshInFlight = false;

let state = {
  view: "home",
  demoMode: prefs.demoMode,
  developerMode: prefs.developerMode,
  uiMode: prefs.uiMode,
  baseUrl: prefs.baseUrl,
  rememberPassword: prefs.rememberPassword,
  connectionState: CONNECTION_STATE.RECONNECTING,
  live: null,
  liveStale: false,
  lastLiveSuccessAt: null,
  details: null,
  detailsStale: false,
  lastDetailsSuccessAt: null,
  liveError: "",
  detailsError: "",
  addressError: "",
  harCandidates: [],
  harEntries: [],
  discoveryError: "",
  demo: null
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function persist() {
  savePreferences({
    baseUrl: state.baseUrl,
    demoMode: state.demoMode,
    developerMode: state.developerMode,
    uiMode: state.uiMode,
    rememberPassword: state.rememberPassword
  });
}

function statusPill(label, tone = "muted") {
  return `<span class="pill" data-tone="${tone}">${esc(label)}</span>`;
}

function currentTelemetry() {
  if (state.demoMode && state.demo) {
    return { status: state.demo.status, battery: state.demo.battery, signal: state.demo.signal, refreshedAt: null };
  }
  return state.live;
}

function currentConnectionLabel() {
  if (state.demoMode) return "DEMO DATA";
  if (state.liveStale && state.live) return "Đang kết nối lại";
  const live = currentTelemetry();
  if (live?.status?.connected) return "Đã kết nối";
  return connectionStateLabel(state.connectionState);
}

function formatClock(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
}

function liveFreshnessLabel() {
  if (state.demoMode) return "DEMO";
  const clock = formatClock(state.lastLiveSuccessAt);
  if (state.liveStale && state.live) return clock ? `Gần nhất ${clock}` : "Dữ liệu gần nhất";
  if (state.live) return clock ? `Cập nhật ${clock}` : "Vừa cập nhật";
  return "Đang chờ";
}

function detailsFreshnessLabel() {
  if (state.demoMode) return "DEMO DATA";
  if (state.detailsStale && state.details) return "LAST GOOD";
  return state.details ? "LIVE READ" : "WAITING";
}

function humanSignal(value) {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "great") return "Rất tốt";
  if (raw === "good") return "Tốt";
  if (raw === "normal" || raw === "fair") return "Trung bình";
  if (raw === "poor" || raw === "weak") return "Yếu";
  return raw ? raw : "—";
}

function signalBars(value) {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "great") return 5;
  if (raw === "good") return 4;
  if (raw === "normal" || raw === "fair") return 3;
  if (raw === "poor" || raw === "weak") return 1;
  return 0;
}

function humanNetwork(value) {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "nsa") return "5G NSA";
  if (raw === "sa") return "5G SA";
  if (raw === "lte") return "4G LTE";
  return raw ? raw.toUpperCase() : "—";
}

function onOff(value) {
  const raw = String(value ?? "").toLowerCase();
  if (["enable","enabled","open","on","1","true","wps_enable"].includes(raw)) return "Bật";
  if (["disable","disabled","close","off","0","false","acl_disable","disablefilter"].includes(raw)) return "Tắt";
  return value ?? "—";
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

function renderSignalBars(value) {
  const active = signalBars(value);
  return `<span class="mini-signal" aria-label="Sóng ${esc(humanSignal(value))}">${[1,2,3,4,5].map((n)=>`<i data-on="${n <= active}"></i>`).join("")}</span>`;
}

function renderAlwaysOnStatus() {
  const t = currentTelemetry();
  const battery = t?.battery?.percentage;
  const connected = Boolean(t?.status?.connected) && !state.liveStale;
  const signal = t?.signal?.level ?? t?.status?.signalLevel;
  const network = t?.signal?.systemMode ?? t?.status?.network;
  return `<div class="live-strip" data-stale="${state.liveStale}">
    <div class="live-chip battery-chip"><span>PIN</span><strong data-live-battery>${battery === null || battery === undefined ? "—%" : `${esc(battery)}%`}</strong><small data-live-battery-note>${state.liveStale && t ? "Dữ liệu gần nhất" : t?.battery?.charging ? "Đang sạc" : "Pin thực"}</small></div>
    <div class="live-chip"><span>KẾT NỐI</span><strong data-live-connection data-good="${connected}">${state.liveStale && t ? "Đang kết nối lại" : connected ? "Đã kết nối" : "Chưa kết nối"}</strong><small data-live-internet-mode>${esc(t?.status?.internetMode ?? "—")}</small></div>
    <div class="live-chip"><span>SÓNG</span><strong data-live-signal>${esc(humanSignal(signal))}</strong><small data-live-signal-bars>${renderSignalBars(signal)}</small></div>
    <div class="live-chip"><span>MẠNG</span><strong data-live-network>${esc(humanNetwork(network))}</strong><small data-live-carrier>${esc(t?.status?.carrier ?? t?.signal?.carrier ?? "—")}</small></div>
    <div class="live-chip refresh-chip"><span>CẬP NHẬT</span><strong>10 giây</strong><small data-live-refresh-state>${esc(liveFreshnessLabel())}</small></div>
  </div>`;
}

function renderSidebar() {
  const developerItem = state.developerMode
    ? `<span class="nav-divider">DEVELOPER</span><button data-nav="discovery" data-active="${state.view === "discovery"}"><span>API Discovery</span><small>Advanced Developer Mode</small></button>`
    : "";

  const t = currentTelemetry();
  return `<aside class="sidebar">
    <div class="brand"><div class="brand-mark">N3</div><div><small>HYBRID Wi-Fi 5G</small><strong>NC03 Control Center</strong></div></div>
    <div class="connection-card">
      <div class="connection-row"><span class="dot" data-live-dot data-on="${Boolean((t?.status?.connected && !state.liveStale) || state.demoMode)}"></span><div><small>Trạng thái</small><strong data-live-sidebar-connection>${esc(currentConnectionLabel())}</strong></div></div>
      <div class="sidebar-live"><strong data-live-sidebar-battery>${t?.battery?.percentage ?? "—"}%</strong><span>Pin</span><strong data-live-sidebar-signal>${esc(humanSignal(t?.signal?.level ?? t?.status?.signalLevel))}</strong><span>Sóng</span></div>
      <div class="connection-address">${esc(state.baseUrl)}</div>
    </div>
    <nav>
      ${PRIMARY_NAV.map(({ id, label }) => `<button data-nav="${id}" data-active="${state.view === id}"><span>${esc(label)}</span></button>`).join("")}
      ${developerItem}
    </nav>
    <div class="sidebar-foot"><strong>HAR2 · Live telemetry</strong><span>Đọc 10 giây/lần · Write vẫn khóa</span></div>
  </aside>`;
}

function renderTopbar(title, subtitle) {
  const liveTone = state.demoMode ? "warn" : state.live && !state.liveStale ? "ok" : "warn";
  const liveLabel = state.demoMode ? "DEMO DATA" : state.liveStale && state.live ? "LAST GOOD" : state.live ? "LIVE READ" : "LOCAL BRIDGE";
  return `<header class="topbar"><div><small>NC03 / ${esc(title).toUpperCase()}</small><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
  <div class="top-actions">${statusPill(state.uiMode === UI_MODE.ADVANCED ? "ADVANCED" : "BASIC")}<span class="pill" data-live-top-status data-tone="${liveTone}">${esc(liveLabel)}</span></div></header>
  ${renderAlwaysOnStatus()}`;
}

function metric(label, value, note) {
  return `<article class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => { node.textContent = String(value); });
}

function updateLiveTelemetryDom() {
  if (state.demoMode) return;
  const t = currentTelemetry();
  const battery = t?.battery?.percentage;
  const connected = Boolean(t?.status?.connected) && !state.liveStale;
  const signal = t?.signal?.level ?? t?.status?.signalLevel;
  const network = t?.signal?.systemMode ?? t?.status?.network;
  const carrier = t?.status?.carrier ?? t?.signal?.carrier ?? "—";
  const batteryText = battery === null || battery === undefined ? "—%" : `${battery}%`;
  const connectionText = state.liveStale && t ? "Đang kết nối lại" : connected ? "Đã kết nối" : "Chưa kết nối";
  const signalText = humanSignal(signal);
  const networkText = humanNetwork(network);

  setText("[data-live-battery]", batteryText);
  setText("[data-live-battery-note]", state.liveStale && t ? "Dữ liệu gần nhất" : t?.battery?.charging ? "Đang sạc" : "Pin thực");
  setText("[data-live-connection]", connectionText);
  setText("[data-live-internet-mode]", t?.status?.internetMode ?? "—");
  setText("[data-live-signal]", signalText);
  setText("[data-live-network]", networkText);
  setText("[data-live-carrier]", carrier);
  setText("[data-live-refresh-state]", liveFreshnessLabel());
  setText("[data-live-sidebar-connection]", currentConnectionLabel());
  setText("[data-live-sidebar-battery]", batteryText);
  setText("[data-live-sidebar-signal]", signalText);
  setText("[data-live-hero-connection]", connectionText);
  setText("[data-live-hero-summary]", t ? `${networkText} · ${carrier} · SIM ${t.status?.simStatus ?? "—"}` : "Đang chờ dữ liệu thật từ NC03.");
  setText("[data-live-home-battery]", batteryText);
  setText("[data-live-home-battery-note]", state.liveStale && t ? "Dữ liệu gần nhất · % đã đọc" : t?.battery?.charging ? "Đang sạc · % chính xác" : "Phần trăm pin chính xác");
  setText("[data-live-home-signal]", signalText);
  setText("[data-live-home-network]", `${networkText} · ${carrier}`);

  document.querySelectorAll("[data-live-connection]").forEach((node) => node.dataset.good = String(connected));
  document.querySelectorAll(".live-strip").forEach((node) => node.dataset.stale = String(state.liveStale));
  document.querySelectorAll("[data-live-dot], [data-live-hero-dot]").forEach((node) => node.dataset.on = String(connected));
  document.querySelectorAll("[data-live-signal-bars], [data-live-hero-signal]").forEach((node) => { node.innerHTML = renderSignalBars(signal); });
}

function renderAuthNotice() {
  if (state.demoMode) return "";
  if (state.liveStale && state.live) {
    return `<section class="inline-live-error">
      <div><strong>Đang kết nối lại NC03</strong><span>${esc(state.liveError || "Đang giữ dữ liệu gần nhất trong lúc thử lại.")}</span></div>
      <button id="openStockUi">Mở Web UI gốc</button>
      <button id="retryLive">Thử lại</button>
    </section>`;
  }
  if (state.live) return "";
  return `<section class="inline-live-error">
    <div><strong>Chưa đọc được NC03</strong><span>${esc(state.liveError || "NC03 chưa phản hồi qua local bridge.")}</span></div>
    <button id="openStockUi">Mở Web UI gốc</button>
    <button id="retryLive">Thử lại</button>
  </section>`;
}

function renderDetailsNotice() {
  if (state.demoMode || !state.detailsStale || !state.details) return "";
  const clock = formatClock(state.lastDetailsSuccessAt);
  return `<section class="inline-live-error">
    <div><strong>Dữ liệu cấu hình đang là bản gần nhất</strong><span>Không refresh được snapshot chi tiết${clock ? ` từ ${esc(clock)}` : ""}. Telemetry pin/sóng vẫn có vòng cập nhật riêng.</span></div>
    <button id="retryDetails">Tải lại cấu hình</button>
  </section>`;
}

function renderLogin() {
  return `<section class="login-shell">
    <div class="login-card">
      <div class="login-brand"><div class="brand-mark">N3</div><div><small>HYBRID Wi-Fi 5G</small><strong>NC03 Control Center</strong></div></div>
      <div class="login-copy"><span class="eyebrow">LOCAL MODEM ACCESS</span><h1>Kết nối NC03</h1><p>Địa chỉ modem có thể thay đổi. HAR mới vẫn chưa chứa request nhập mật khẩu, nên app không tự bịa thuật toán đăng nhập.</p></div>
      ${renderAlwaysOnStatus()}
      <div class="login-form">
        <label>Địa chỉ modem<input id="loginBaseUrl" value="${esc(state.baseUrl)}" inputmode="url" autocomplete="url" placeholder="192.168.0.1" /></label>
        <label>Mật khẩu<input id="loginPassword" type="password" disabled autocomplete="current-password" placeholder="Sẽ mở sau khi AUTH request được xác minh" /></label>
      </div>
      <div class="login-options"><label><input id="rememberPassword" type="checkbox" ${state.rememberPassword ? "checked" : ""} disabled /> Ghi nhớ mật khẩu trên thiết bị này · sẽ bật sau AUTH VERIFIED</label></div>
      ${state.addressError ? `<div class="inline-error">${esc(state.addressError)}</div>` : ""}
      <div class="login-actions"><button id="saveLoginAddress" class="secondary-action">Lưu địa chỉ</button><button id="openStockUi">Mở Web UI gốc</button></div>
      <div class="write-lock"><strong>Read path đã hoạt động qua Local Bridge.</strong><span>Sau khi bạn đăng nhập Web UI gốc, app tự kiểm tra lại mỗi 10 giây. Write API vẫn khóa.</span></div>
      <div class="login-safe-actions"><button id="enterDemo">Mở Developer Demo</button></div>
    </div>
  </section>`;
}

function renderHome() {
  const t = currentTelemetry();
  const details = state.demoMode ? state.demo : state.details;
  const connected = Boolean(t?.status?.connected) && !state.liveStale;
  const signal = t?.signal?.level ?? t?.status?.signalLevel;
  const network = t?.signal?.systemMode ?? t?.status?.network;
  const clientCount = state.demoMode ? details?.wifi?.clients : details?.clients?.length;
  const dataUsed = state.demoMode ? details?.data?.current : formatBytes(details?.dataUsage?.statistics_data_used);
  return `${renderTopbar("Tổng quan", "Pin, kết nối và sóng luôn hiển thị; dữ liệu live tự cập nhật mỗi 10 giây.")}
  ${renderAuthNotice()}
  <section class="hero-status">
    <div><span class="eyebrow">INTERNET</span><div class="hero-line"><span class="big-dot" data-live-hero-dot data-on="${connected}"></span><h2 data-live-hero-connection>${state.liveStale && t ? "Đang kết nối lại" : connected ? "Đang kết nối" : "Chưa kết nối"}</h2></div><p data-live-hero-summary>${t ? `${esc(humanNetwork(network))} · ${esc(t.status?.carrier ?? t.signal?.carrier ?? "—")} · SIM ${esc(t.status?.simStatus ?? "—")}` : "Đang chờ dữ liệu thật từ NC03."}</p></div>
    <span data-live-hero-signal>${renderSignalBars(signal)}</span>
  </section>
  <section class="metrics-grid">
    <article class="metric"><span>Pin</span><strong data-live-home-battery>${t?.battery?.percentage === null || t?.battery?.percentage === undefined ? "—%" : `${esc(t.battery.percentage)}%`}</strong><small data-live-home-battery-note>${state.liveStale && t ? "Dữ liệu gần nhất · % đã đọc" : t?.battery?.charging ? "Đang sạc · % chính xác" : "Phần trăm pin chính xác"}</small></article>
    <article class="metric"><span>Sóng</span><strong data-live-home-signal>${esc(humanSignal(signal))}</strong><small data-live-home-network>${esc(humanNetwork(network))} · ${esc(t?.status?.carrier ?? t?.signal?.carrier ?? "—")}</small></article>
    ${metric("Dữ liệu", dataUsed ?? "—", state.demoMode ? "DEMO DATA" : "Bộ đếm modem")}
    ${metric("Thiết bị", clientCount ?? "—", clientCount === undefined ? "Chưa tải danh sách" : "Đang kết nối")}
  </section>
  <section class="panel"><div class="panel-head"><div><span>QUICK ACTIONS</span><h2>Đi tới khu vực</h2></div><p>Read path đã nối thật; thao tác ghi vẫn fail-closed cho tới khi WRITE VERIFIED.</p></div>
    <div class="quick-grid">${[["network","Mạng di động"],["wifi","Wi-Fi"],["devices","Thiết bị"],["settings","Cài đặt"]].map(([id,label])=>`<button data-nav="${id}"><strong>${label}</strong><span>Mở khu vực</span></button>`).join("")}</div>
  </section>`;
}

function renderNetwork() {
  const t = currentTelemetry();
  const n = state.details?.networkSettings ?? {};
  const signal = t?.signal?.level ?? t?.status?.signalLevel;
  return `${renderTopbar("Mạng", "HAR mới xác minh trạng thái 4G/5G, nhà mạng, sóng định tính, SIM và cấu hình network mode.")}
  ${renderAuthNotice()}
  ${renderDetailsNotice()}
  <section class="panel"><div class="panel-head"><div><span>MOBILE NETWORK</span><h2>${esc(humanNetwork(t?.signal?.systemMode ?? t?.status?.network))}</h2></div>${statusPill(state.liveStale && t ? "LAST GOOD" : t?.status?.connected ? "CONNECTED" : "OFFLINE", state.liveStale && t ? "warn" : t?.status?.connected ? "ok" : "warn")}</div>
    <div class="spec-grid">
      <div><span>Nhà mạng</span><strong>${esc(t?.status?.carrier ?? t?.signal?.carrier ?? "—")}</strong></div>
      <div><span>Chất lượng sóng</span><strong>${esc(humanSignal(signal))}</strong></div>
      <div><span>SIM</span><strong>${esc(t?.status?.simStatus ?? "—")}</strong></div>
      <div><span>WAN</span><strong>${esc(t?.status?.wanState ?? t?.status?.internet ?? "—")}</strong></div>
      <div><span>Internet mode</span><strong>${esc(t?.status?.internetMode ?? "—")}</strong></div>
      <div><span>Roaming</span><strong>${esc(t?.status?.roaming ?? "—")}</strong></div>
      <div><span>Acquisition</span><strong>${esc(n.mnet_acqorder ?? "—")}</strong></div>
      <div><span>5G config</span><strong>${esc(n.mnet_nr5g_config_mode ?? "—")}</strong></div>
    </div>
    <div class="advanced-note"><strong>Không bịa RSRP / RSRQ / SINR</strong><span>HAR mới chỉ xác nhận <code>mnet_sig_level</code> dạng định tính. App hiển thị đúng dữ liệu modem cung cấp thay vì dựng số dBm giả.</span></div>
  </section>`;
}

function renderWifi() {
  const wifi = state.demoMode ? state.demo?.wifi : state.details?.wifi;
  const aps = wifi?.aps ?? [];
  return `${renderTopbar("Wi-Fi", "HAR mới xác nhận tối đa 4 profile AP. PSK/mật khẩu Wi-Fi không được mirror vào dashboard.")}
  ${renderAuthNotice()}
  ${renderDetailsNotice()}
  <section class="panel"><div class="panel-head"><div><span>WI-FI STATUS</span><h2>${wifi?.enabled ? "Đang bật" : wifi ? "Đang tắt" : "Chưa có dữ liệu"}</h2></div>${statusPill(detailsFreshnessLabel(), state.detailsStale ? "warn" : "muted")}</div>
    <div class="wifi-ap-grid">${aps.length ? aps.map((ap)=>`<article class="wifi-ap-card"><div><span>AP ${ap.index + 1}</span><strong>${esc(ap.ssid || "Không tên")}</strong></div><dl><dt>Trạng thái</dt><dd>${esc(ap.state ?? "—")}</dd><dt>Tần số</dt><dd>${esc(ap.frequency ?? "—")}</dd><dt>Thiết bị</dt><dd>${esc(ap.clients ?? "—")}</dd>${state.uiMode === UI_MODE.ADVANCED ? `<dt>Kênh</dt><dd>${esc(ap.channel ?? "—")}</dd><dt>Bảo mật</dt><dd>${esc(ap.security ?? "—")}</dd><dt>Bandwidth</dt><dd>${esc(ap.bandwidth ?? "—")}</dd>` : ""}</dl></article>`).join("") : `<div class="empty">Chưa tải được cấu hình Wi-Fi từ modem.</div>`}</div>
    <div class="write-lock"><strong>Write vẫn khóa.</strong><span>HAR này chỉ xác minh read. Không gửi lệnh đổi SSID/password/channel nếu chưa có request write thật.</span></div>
  </section>`;
}

function renderDevices() {
  const rows = state.demoMode ? state.demo?.clients ?? [] : state.details?.clients ?? [];
  return `${renderTopbar("Thiết bị", "Danh sách client dùng endpoint thật router_get_hosts_info.")}
  ${renderAuthNotice()}
  ${renderDetailsNotice()}
  <section class="panel"><div class="panel-head"><div><span>CONNECTED CLIENTS</span><h2>${rows.length ? `${rows.length} thiết bị` : "Chưa có thiết bị"}</h2></div>${statusPill(detailsFreshnessLabel(), state.detailsStale ? "warn" : "muted")}</div>
  <div class="device-list">${rows.length ? rows.map(r=>`<article><div class="device-icon">◆</div><div><strong>${esc(r.name || "Thiết bị")}</strong><span>${esc(r.ip ?? "—")} · ${esc(r.ssid ?? r.band ?? r.type ?? "—")}</span></div><div><span>${esc(r.mac ?? "—")}</span><strong>${esc(r.onlineTime ?? r.state ?? "Online")}</strong></div></article>`).join("") : `<div class="empty">Không có client hoặc danh sách chưa tải.</div>`}</div></section>`;
}

function capabilityRows() {
  const merged = new Map(NC03_80042_CAPABILITIES.map((row) => [row.module, row]));
  for (const row of HAR2_CAPABILITY_OVERRIDES) merged.set(row.module, row);
  return [...merged.values()].map(row => `<tr><td>${esc(row.module)}</td><td>${row.read ? "✓" : "—"}</td><td>${row.write ? "✓" : "—"}</td><td><code>${esc(row.endpoint)}</code></td><td>${esc(row.method)}</td><td>${esc(row.auth)}</td><td><span class="table-status">${esc(row.status)}</span></td></tr>`).join("");
}

function renderDiscovery() {
  if (!state.developerMode) return renderSettings();
  return `${renderTopbar("API Discovery", "Developer Mode: HAR chỉ xử lý cục bộ và credential phải được che.")}
  <section class="panel discovery-panel"><div class="panel-head"><div><span>ADVANCED DEVELOPER MODE</span><h2>Phân tích Web UI gốc NC03</h2></div>${statusPill(`${state.harEntries.length} request`)}</div>
    <div class="import-box"><input id="harInput" type="file" accept=".har,application/json"/><div><strong>Chọn file HAR từ DevTools</strong><span>File chỉ đọc trong trình duyệt hiện tại. Không upload ra cloud.</span></div></div>
    ${state.discoveryError ? `<div class="inline-error">${esc(state.discoveryError)}</div>` : ""}
    ${state.harCandidates.length ? `<div class="candidate-list">${state.harCandidates.map(c=>`<article><span class="method">${esc(c.method)}</span><code>${esc(c.path)}</code><small>${c.count} lần · HTTP ${esc(c.statuses.join(", "))} · ~${c.avgMs} ms${c.hints?.length ? ` · gợi ý: ${esc(c.hints.join(", "))}` : ""}</small></article>`).join("")}</div>` : `<div class="empty">Chưa nhập HAR vào Developer Mode.</div>`}
  </section>
  <section class="panel"><div class="panel-head"><div><span>CAPABILITY MATRIX</span><h2>HAR mới đã mở rộng read-only</h2></div><p>Write chỉ bật khi WRITE VERIFIED.</p></div><div class="table-wrap"><table><thead><tr><th>Module</th><th>Read</th><th>Write</th><th>Endpoint</th><th>Method</th><th>Auth</th><th>Status</th></tr></thead><tbody>${capabilityRows()}</tbody></table></div></section>`;
}

function settingCard(label, value) {
  return `<div><span>${esc(label)}</span><strong>${esc(value ?? "—")}</strong></div>`;
}

function renderSettings() {
  const d = state.details ?? {};
  const usb = d.usb ?? {};
  const power = d.power ?? {};
  const security = d.security ?? {};
  const time = d.time ?? {};
  const firmware = d.firmware ?? {};
  const mobileService = d.mobileService ?? {};
  const ruleInventory = d.ruleInventory ?? {};
  const developerPanel = state.developerMode ? `
    <section class="panel"><div class="panel-head"><div><span>ADVANCED DEVELOPER MODE</span><h2>Discovery & Mock</h2></div>${statusPill("LOCAL TOOLING","warn")}</div>
      <div class="settings-actions"><button id="openDiscovery">Mở API Discovery</button><label class="demo-switch"><input id="demoToggle" type="checkbox" ${state.demoMode ? "checked" : ""}/><span>Mock Mode · DEMO DATA</span></label></div>
    </section>` : "";

  const advanced = state.uiMode === UI_MODE.ADVANCED ? `
  <section class="panel"><div class="panel-head"><div><span>HAR2 · MOBILE SERVICE</span><h2>SIM / dữ liệu / Cloud SIM</h2></div>${statusPill("READ ONLY")}</div>
    <div class="spec-grid">${settingCard("Mobile Data", onOff(mobileService.mobileData))}${settingCard("SIM PIN protect", onOff(mobileService.pinProtection))}${settingCard("PIN tries còn lại", mobileService.pinRemainingTries)}${settingCard("Cloud SIM auto-switch", onOff(mobileService.cloudSimAutoSwitch))}${settingCard("Cloud SIM notification", onOff(mobileService.cloudSimNotification))}${settingCard("No-service threshold", mobileService.cloudSimNoServiceMinutes === null || mobileService.cloudSimNoServiceMinutes === undefined ? "—" : `${mobileService.cloudSimNoServiceMinutes} phút`)}</div>
  </section>
  <section class="panel"><div class="panel-head"><div><span>HAR2 · CONNECTIVITY</span><h2>USB / Bridge / Ethernet</h2></div>${statusPill("READ ONLY")}</div>
    <div class="spec-grid">${settingCard("IP Passthrough", onOff(usb.bridgeState))}${settingCard("USB tether", onOff(usb.tethering))}${settingCard("USB speed", usb.speed)}${settingCard("Ethernet", usb.ethernetType)}</div>
  </section>
  <section class="panel"><div class="panel-head"><div><span>HAR2 · POWER</span><h2>Pin / nguồn / màn hình</h2></div>${statusPill("READ ONLY")}</div>
    <div class="spec-grid">${settingCard("Long Life Charging", onOff(power.device_charge_long_life))}${settingCard("Safe charge", onOff(power.device_bat_safe_charge_switch))}${settingCard("Power mode", power.device_power_saving_mode)}${settingCard("Tắt LCD", power.device_turnoff_lcd_time ? `${power.device_turnoff_lcd_time} phút` : "—")}</div>
  </section>
  <section class="panel"><div class="panel-head"><div><span>HAR2 · SECURITY</span><h2>WPS / Filter / DMZ</h2></div>${statusPill("READ ONLY")}</div>
    <div class="spec-grid">${settingCard("WPS", onOff(security.wifi_wps_enable_state))}${settingCard("Wi-Fi MAC filter", onOff(security.wifi_macfilter_mode))}${settingCard("IP filter", onOff(security.rt_ipfilter_type))}${settingCard("DMZ", onOff(security.rt_dmz_switch))}</div>
  </section>
  <section class="panel"><div class="panel-head"><div><span>HAR2 · RULE INVENTORY</span><h2>Rule đã cấu hình</h2></div>${statusPill("COUNT ONLY")}</div>
    <div class="spec-grid">${settingCard("DHCP reservations", ruleInventory.dhcpReservations)}${settingCard("Port forwarding", ruleInventory.portForwardingRules)}${settingCard("IPv4 packet filters", ruleInventory.ipv4PacketFilterRules)}${settingCard("IPv6 packet filters", ruleInventory.ipv6PacketFilterRules)}</div>
    <div class="advanced-note"><strong>Chỉ thống kê số lượng</strong><span>App không mirror raw IP/MAC/port/filter rule từ modem sang dashboard.</span></div>
  </section>
  <section class="panel"><div class="panel-head"><div><span>HAR2 · SYSTEM</span><h2>Thời gian / Firmware</h2></div>${statusPill("READ ONLY")}</div>
    <div class="spec-grid">${settingCard("NTP", onOff(time.ntp_enable_state))}${settingCard("NTP sync", time.ntp_sync_state)}${settingCard("Firmware", firmware.firmware)}${settingCard("FOTA", firmware.fotaStatus)}</div>
    <div class="advanced-note"><strong>Dữ liệu nhạy cảm không mirror</strong><span>HAR có PSK Wi-Fi, IMEI/serial, ICCID/EID/eSIM profile và APN profile. App cố ý không đưa các trường đó vào snapshot/UI.</span></div>
  </section>` : "";

  return `${renderTopbar("Cài đặt", "Basic gọn; Advanced hiển thị các nhóm read-only mới được HAR xác minh.")}
  ${renderDetailsNotice()}
  <section class="panel"><div class="panel-head"><div><span>INTERFACE MODE</span><h2>Chế độ giao diện</h2></div>${statusPill(state.uiMode === UI_MODE.ADVANCED ? "ADVANCED" : "BASIC")}</div>
    <div class="mode-selector"><button data-ui-mode="basic" data-active="${state.uiMode === UI_MODE.BASIC}"><strong>Basic Mode</strong><span>Pin · Internet · Sóng · Wi-Fi · Devices</span></button><button data-ui-mode="advanced" data-active="${state.uiMode === UI_MODE.ADVANCED}"><strong>Advanced Mode</strong><span>Network · USB · Bridge · Security · NTP · Power · FOTA</span></button></div>
  </section>
  <section class="panel"><div class="panel-head"><div><span>MODEM CONNECTION</span><h2>Địa chỉ NC03</h2></div>${statusPill("LOCAL ONLY")}</div>
    <div class="form-grid"><label>Địa chỉ modem<input id="baseUrl" value="${esc(state.baseUrl)}" inputmode="url" placeholder="192.168.0.1" /></label><label>Tự làm mới<strong>10 giây/lần</strong></label></div>
    ${state.addressError ? `<div class="inline-error">${esc(state.addressError)}</div>` : ""}
    <div class="settings-actions"><button id="saveBaseUrl">Lưu địa chỉ</button><button id="refreshNow">Cập nhật ngay</button><button id="openStockUi">Mở Web UI gốc</button></div>
    <div class="security-note"><strong>Credential policy</strong><span>${esc(SECURITY_NOTE)}</span></div>
  </section>
  ${advanced}
  <section class="panel"><div class="panel-head"><div><span>DEVELOPER</span><h2>Advanced Developer Mode</h2></div>${statusPill(state.developerMode ? "ENABLED" : "OFF")}</div>
    <label class="developer-toggle"><input id="developerToggle" type="checkbox" ${state.developerMode ? "checked" : ""}/><span><strong>Bật công cụ reverse-engineering</strong><small>Hiện API Discovery và Mock Mode. Không bật API ghi.</small></span></label>
  </section>
  ${developerPanel}`;
}

function page() {
  if (state.view === "discovery" && !state.developerMode) state.view = "settings";
  const content = state.view === "login" ? renderLogin() : state.view === "network" ? renderNetwork() : state.view === "wifi" ? renderWifi() : state.view === "devices" ? renderDevices() : state.view === "discovery" ? renderDiscovery() : state.view === "settings" ? renderSettings() : renderHome();
  if (state.view === "login") app.innerHTML = content;
  else app.innerHTML = `<div class="shell">${renderSidebar()}<main class="main">${content}</main><nav class="mobile-nav">${PRIMARY_NAV.map(({id,label})=>`<button data-nav="${id}" data-active="${state.view===id}">${esc(label)}</button>`).join("")}</nav></div>`;
  bind();
}

async function ensureDemo() {
  if (!state.demoMode) { state.demo = null; return; }
  const adapter = new MockNC03Adapter({ baseUrl: state.baseUrl });
  state.demo = {
    status: await adapter.getStatus(),
    battery: await adapter.getBattery(),
    signal: await adapter.getSignal(),
    wifi: await adapter.getWifiStatus(),
    clients: await adapter.getConnectedClients(),
    data: await adapter.getDataUsage()
  };
}

async function localRead(path) {
  const response = await fetch(path, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type":"application/json" },
    body: JSON.stringify({ baseUrl: state.baseUrl })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) {
    const error = new Error(payload.code || `HTTP_${response.status}`);
    error.code = payload.code || "";
    throw error;
  }
  return payload.payload;
}

async function refreshLive({ render = true } = {}) {
  if (state.demoMode) return;
  try {
    state.live = await localRead("/api/nc03/snapshot");
    state.liveStale = false;
    state.lastLiveSuccessAt = state.live?.refreshedAt ?? new Date().toISOString();
    state.connectionState = CONNECTION_STATE.CONNECTED;
    state.liveError = "";
  } catch (error) {
    state.liveStale = Boolean(state.live);
    state.liveError = error?.code === "AUTHENTICATION_REQUIRED"
      ? "Modem yêu cầu đăng nhập. Mở Web UI gốc, đăng nhập một lần; app sẽ tự thử lại sau tối đa 10 giây."
      : "Không kết nối được NC03 qua Local Bridge.";
    state.connectionState = state.liveStale
      ? CONNECTION_STATE.RECONNECTING
      : error?.code === "AUTHENTICATION_REQUIRED"
        ? CONNECTION_STATE.AUTHENTICATION_REQUIRED
        : CONNECTION_STATE.NC03_UNAVAILABLE;
  }
  if (render) page();
}

async function refreshDetails({ render = true } = {}) {
  if (state.demoMode) return;
  try {
    state.details = await localRead("/api/nc03/details");
    state.detailsStale = false;
    state.lastDetailsSuccessAt = state.details?.refreshedAt ?? new Date().toISOString();
    state.detailsError = "";
  } catch (error) {
    state.detailsStale = Boolean(state.details);
    state.detailsError = error?.code || "NC03_DETAILS_UNAVAILABLE";
  }
  if (render) page();
}

async function pollLiveOnce() {
  if (state.demoMode || document.hidden || liveRefreshInFlight) return;
  liveRefreshInFlight = true;
  const hadLive = Boolean(state.live);
  const wasStale = state.liveStale;
  try {
    await refreshLive({ render:false });
    if (hadLive !== Boolean(state.live)) page();
    else {
      updateLiveTelemetryDom();
      if (wasStale !== state.liveStale) {
        const topStatus = document.querySelector("[data-live-top-status]");
        if (topStatus) {
          topStatus.textContent = state.liveStale ? "LAST GOOD" : "LIVE READ";
          topStatus.dataset.tone = state.liveStale ? "warn" : "ok";
        }
      }
    }
  } finally {
    liveRefreshInFlight = false;
  }
}

function startLivePolling() {
  if (liveTimer) clearInterval(liveTimer);
  liveTimer = setInterval(() => { pollLiveOnce().catch(() => {}); }, LIVE_REFRESH_MS);
}

async function refreshAll() {
  await refreshLive({ render:false });
  if (state.live) await refreshDetails({ render:false });
  page();
}

function bind() {
  document.querySelector("#saveLoginAddress")?.addEventListener("click", async () => {
    const input = document.querySelector("#loginBaseUrl");
    if (!input) return;
    try {
      state.baseUrl = normalizeModemAddress(input.value);
      state.addressError = "";
    } catch {
      state.addressError = "Địa chỉ không hợp lệ. Chỉ dùng IP mạng nội bộ RFC1918, ví dụ 192.168.0.1.";
      page();
      return;
    }
    persist();
    await refreshAll();
  });

  document.querySelector("#enterDemo")?.addEventListener("click", async () => {
    state.developerMode = true;
    state.demoMode = true;
    persist();
    await ensureDemo();
    state.view = "home";
    page();
  });

  document.querySelectorAll("[data-nav]").forEach((button) => button.addEventListener("click", async () => {
    state.view = button.dataset.nav;
    if (!state.demoMode && ["network","wifi","devices","settings"].includes(state.view)) await refreshDetails({ render:false });
    page();
  }));

  document.querySelectorAll("[data-ui-mode]").forEach((button) => button.addEventListener("click", async () => {
    state.uiMode = button.dataset.uiMode === "advanced" ? UI_MODE.ADVANCED : UI_MODE.BASIC;
    persist();
    if (!state.demoMode && state.uiMode === UI_MODE.ADVANCED) await refreshDetails({ render:false });
    page();
  }));

  document.querySelector("#developerToggle")?.addEventListener("change", async (event) => {
    state.developerMode = event.currentTarget.checked;
    if (!state.developerMode) {
      state.demoMode = false;
      state.harCandidates = [];
      state.harEntries = [];
      state.discoveryError = "";
      await ensureDemo();
      await refreshAll();
    }
    persist();
    page();
  });

  document.querySelector("#openDiscovery")?.addEventListener("click", () => {
    if (!state.developerMode) return;
    state.view = "discovery";
    page();
  });

  document.querySelector("#demoToggle")?.addEventListener("change", async (event) => {
    if (!state.developerMode) return;
    state.demoMode = event.currentTarget.checked;
    persist();
    await ensureDemo();
    if (!state.demoMode) await refreshAll();
    else page();
  });

  document.querySelector("#saveBaseUrl")?.addEventListener("click", async () => {
    const input = document.querySelector("#baseUrl");
    if (!input) return;
    try {
      state.baseUrl = normalizeModemAddress(input.value);
      state.addressError = "";
    } catch {
      state.addressError = "Địa chỉ không hợp lệ. Chỉ dùng IP mạng nội bộ RFC1918, ví dụ 192.168.0.1.";
      page();
      return;
    }
    state.live = null;
    state.liveStale = false;
    state.lastLiveSuccessAt = null;
    state.details = null;
    state.detailsStale = false;
    state.lastDetailsSuccessAt = null;
    persist();
    await refreshAll();
  });

  document.querySelector("#refreshNow")?.addEventListener("click", refreshAll);
  document.querySelector("#retryLive")?.addEventListener("click", refreshAll);
  document.querySelector("#retryDetails")?.addEventListener("click", async () => { await refreshDetails(); });
  document.querySelectorAll("#openStockUi").forEach((button)=>button.addEventListener("click", () => window.open(state.baseUrl, "_blank", "noopener,noreferrer")));

  document.querySelector("#harInput")?.addEventListener("change", async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file || !state.developerMode) return;
    try {
      const har = JSON.parse(await file.text());
      state.harEntries = parseHar(har, { modemHost: new URL(state.baseUrl).hostname });
      state.harCandidates = summarizeCandidates(state.harEntries);
      state.discoveryError = "";
    } catch (error) {
      state.harEntries = [];
      state.harCandidates = [];
      state.discoveryError = `Không đọc được HAR: ${error instanceof Error ? error.message : "Dữ liệu không hợp lệ"}`;
    }
    page();
  });
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
await ensureDemo();
if (!state.demoMode) await refreshAll();
else page();
startLivePolling();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) pollLiveOnce().catch(() => {});
});
