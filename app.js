import { MockNC03Adapter } from "./src/modem/MockNC03Adapter.js";
import { NC03_80042_CAPABILITIES } from "./src/modem/NC03Firmware80042Profile.js";
import { HAR2_CAPABILITY_OVERRIDES } from "./src/modem/NC03Har2Profile.js";
import { buildHarEvidenceReport, parseHar, summarizeCandidates } from "./src/modem/HarDiscovery.js";
import { loadPreferences, savePreferences, SECURITY_NOTE } from "./src/modem/LocalPreferences.js";
import { CONNECTION_STATE, connectionStateLabel } from "./src/modem/ConnectionState.js";
import { PRIMARY_NAV, UI_MODE } from "./src/ui/NavigationModel.js";
import { normalizeModemAddress } from "./src/modem/LoginPolicy.js";
import { buildDiagnosticReport } from "./src/ui/DiagnosticReport.js";

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
  harEvidence: null,
  harFileName: "",
  discoveryError: "",
  doctor: null,
  doctorError: "",
  authSourceEvidence: null,
  authSourceError: "",
  authSourceLoading: false,
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
    ? `<span class="nav-divider">DEVELOPER</span><button data-nav="discovery" data-active="${state.view === "discovery"}"><span>HAR Evidence Lab</span><small>Advanced Developer Mode</small></button>`
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
  if (state.demoMode) return "";
  if (state.detailsError && !state.details) {
    return `<section class="inline-live-error">
      <div><strong>Chưa tải được cấu hình chi tiết</strong><span>Telemetry pin/sóng vẫn hoạt động độc lập. Có thể thử lại snapshot cấu hình.</span></div>
      <button id="retryDetails">Tải lại cấu hình</button>
    </section>`;
  }
  if (!state.detailsStale || !state.details) return "";
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
      <div class="login-options"><div class="locked-option"><strong>Ghi nhớ mật khẩu</strong><span>Chưa hoạt động · sẽ bật mặc định sau khi AUTH VERIFIED.</span></div></div>
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
  ${renderDetailsNotice()}
  <section class="hero-status">
    <div><span class="eyebrow">INTERNET</span><div class="hero-line"><span class="big-dot" data-live-hero-dot data-on="${connected}"></span><h2 data-live-hero-connection>${state.liveStale && t ? "Đang kết nối lại" : connected ? "Đang kết nối" : "Chưa kết nối"}</h2></div><p data-live-hero-summary>${t ? `${esc(humanNetwork(network))} · ${esc(t.status?.carrier ?? t.signal?.carrier ?? "—")} · SIM ${esc(t.status?.simStatus ?? "—")}` : "Đang chờ dữ liệu thật từ NC03."}</p></div>
    <span data-live-hero-signal>${renderSignalBars(signal)}</span>
  </section>
  <section class="metrics-grid">
    <article class="metric"><span>Pin</span><strong data-live-home-battery>${t?.battery?.percentage === null || t?.battery?.percentage === undefined ? "—%" : `${esc(t.battery.percentage)}%`}</strong><small data-live-home-battery-note>${state.liveStale && t ? "Dữ liệu gần nhất · % đã đọc" : t?.battery?.charging ? "Đang sạc · % chính xác" : "Phần trăm pin chính xác"}</small></article>
    <article class="metric"><span>Sóng</span><strong data-live-home-signal>${esc(humanSignal(signal))}</strong><small data-live-home-network>${esc(humanNetwork(network))} · ${esc(t?.status?.carrier ?? t?.signal?.carrier ?? "—")}</small></article>
    ${metric("Dữ liệu", dataUsed ?? "—", state.demoMode ? "DEMO DATA" : state.detailsStale && details ? "Dữ liệu gần nhất" : "Bộ đếm modem")}
    ${metric("Thiết bị", clientCount ?? "—", clientCount === undefined ? "Chưa tải danh sách" : state.detailsStale && details ? "Danh sách gần nhất" : "Snapshot hiện tại")}
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
  <div class="device-list">${rows.length ? rows.map(r=>`<article><div class="device-icon">◆</div><div><strong>${esc(r.name || "Thiết bị")}</strong><span>${esc(r.ip ?? "—")} · ${esc(r.ssid ?? r.band ?? r.type ?? "—")}</span></div><div><span>${esc(r.mac ?? "—")}</span><strong>${esc(r.onlineTime ?? r.state ?? "Đã ghi nhận")}</strong></div></article>`).join("") : `<div class="empty">Không có client hoặc danh sách chưa tải.</div>`}</div></section>`;
}

function capabilityRows() {
  const merged = new Map(NC03_80042_CAPABILITIES.map((row) => [row.module, row]));
  for (const row of HAR2_CAPABILITY_OVERRIDES) merged.set(row.module, row);
  return [...merged.values()].map(row => `<tr><td>${esc(row.module)}</td><td>${row.read ? "✓" : "—"}</td><td>${row.write ? "✓" : "—"}</td><td><code>${esc(row.endpoint)}</code></td><td>${esc(row.method)}</td><td>${esc(row.auth)}</td><td><span class="table-status">${esc(row.status)}</span></td></tr>`).join("");
}

function renderEvidenceList(items, emptyText, tone = "muted") {
  if (!items?.length) return `<div class="evidence-empty">${esc(emptyText)}</div>`;
  return `<div class="evidence-list">${items.map((item) => `
    <article>
      <div class="evidence-route"><span class="method">${esc(item.method)}</span><code>${esc(item.path)}</code><span class="pill" data-tone="${tone}">${esc(item.statusLabel ?? "CANDIDATE_ONLY")}</span></div>
      <div class="evidence-meta">
        <span>HTTP ${esc(item.status ?? "—")}</span>
        <span>${esc(item.requestBodyKind ?? "empty")}</span>
        ${item.candidateKind ? `<span>${esc(item.candidateKind)}</span>` : ""}
        ${item.requestFields?.length ? `<span>${esc(item.requestFields.slice(0, 8).join(", "))}${item.requestFields.length > 8 ? "…" : ""}</span>` : ""}
      </div>
      ${item.evidence?.length ? `<small>${esc(item.evidence.join(" · "))}</small>` : ""}
    </article>`).join("")}</div>`;
}

function renderDiscovery() {
  if (!state.developerMode) return renderSettings();
  const evidence = state.harEvidence;
  const authCandidates = evidence?.authCandidates ?? [];
  const writeCandidates = evidence?.writeCandidates ?? [];
  const quality = evidence?.captureQuality ?? null;
  const authReady = quality?.readyForAuthMapping === true;
  const writeReady = quality?.readyForWriteMapping === true;
  const sourceEvidence = state.authSourceEvidence?.evidence ?? null;
  const sourceDiagnostics = state.authSourceEvidence?.diagnostics ?? null;
  const sourceTone = sourceEvidence?.status === "LOGIN_SOURCE_CANDIDATE_READY" ? "ok" : sourceEvidence ? "warn" : "muted";
  return `${renderTopbar("HAR Evidence Lab", "Advanced Developer Mode: phân tích HAR ngay trên thiết bị, không upload credential lên cloud.")}
  <section class="panel discovery-panel">
    <div class="panel-head"><div><span>LOCAL HAR ANALYZER</span><h2>Phân tích Web UI gốc NC03</h2></div>${statusPill(evidence ? `${evidence.entryCount} request` : "CHỜ HAR", evidence ? "ok" : "muted")}</div>
    <div class="har-privacy-banner"><strong>Riêng tư theo mặc định</strong><span>HAR được đọc trong trình duyệt hiện tại. Evidence report chỉ giữ cấu trúc request/response, tên field và dấu hiệu xác thực; không giữ mật khẩu, token, cookie hay session value.</span></div>
    <div class="import-box"><input id="harInput" type="file" accept=".har,application/json"/><div><strong>Chọn file HAR từ DevTools</strong><span>${state.harFileName ? `Đang phân tích: ${esc(state.harFileName)}` : "Ưu tiên capture riêng một lần đăng nhập để xác minh AUTH."}</span></div></div>
    ${state.discoveryError ? `<div class="inline-error">${esc(state.discoveryError)}</div>` : ""}
    ${evidence ? `
      <div class="capture-quality" data-ready="${authReady}">
        <div><span>CHẤT LƯỢNG CAPTURE</span><strong>${esc(quality?.authCaptureStatus ?? "UNKNOWN")}</strong><small>${esc(quality?.authMessage ?? "Chưa đánh giá được HAR.")}</small></div>
        <div class="capture-flags">
          <span data-ok="${authReady}">AUTH mapping: ${authReady ? "có candidate" : "chưa đủ"}</span>
          <span data-ok="${writeReady}">WRITE mapping: ${writeReady ? "có candidate" : "chưa có"}</span>
          ${quality?.pagePaths?.length ? `<span>Trang: ${esc(quality.pagePaths.join(", "))}</span>` : ""}
        </div>
        ${quality?.guidance?.length ? `<ol>${quality.guidance.map((step)=>`<li>${esc(step)}</li>`).join("")}</ol>` : ""}
      </div>
      <div class="evidence-summary">
        <div><span>Request modem</span><strong>${evidence.entryCount}</strong><small>Host tự nhận diện: ${esc(evidence.modemHost)}</small></div>
        <div><span>AUTH candidates</span><strong>${authCandidates.length}</strong><small>${quality?.loginTransactionCandidateCount ?? 0} login · ${quality?.authStatusProbeCount ?? 0} probe</small></div>
        <div><span>WRITE candidates</span><strong>${writeCandidates.length}</strong><small>${esc(quality?.writeCaptureStatus ?? "UNKNOWN")}</small></div>
        <div><span>Safety gate</span><strong>LOCKED</strong><small>Không tự bật control</small></div>
      </div>
      <div class="evidence-actions"><button id="downloadHarEvidence">Xuất evidence.json</button><button id="clearHarEvidence" class="secondary-action">Xóa phiên phân tích</button></div>
    ` : ""}
  </section>

  <section class="panel evidence-panel auth-source-panel">
    <div class="panel-head"><div><span>AUTH SOURCE PROBE</span><h2>Đọc dấu vết đăng nhập từ JS của modem</h2></div>${statusPill(sourceEvidence?.status ?? (state.authSourceLoading ? "ĐANG QUÉT" : "CHƯA CHẠY"), sourceTone)}</div>
    <p class="body-copy">Probe chỉ đọc các tài nguyên tĩnh local đã được HAR chứng minh tồn tại hoặc được chính HTML modem tham chiếu. Raw source không rời Local Bridge; UI chỉ nhận evidence đã rút gọn.</p>
    ${state.authSourceError ? `<div class="inline-error">${esc(state.authSourceError)}</div>` : ""}
    ${sourceEvidence ? `
      <div class="evidence-summary">
        <div><span>Source đã đọc</span><strong>${sourceEvidence.sourcesAnalyzed?.length ?? 0}</strong><small>Local modem only</small></div>
        <div><span>Login submit</span><strong>${sourceEvidence.loginSubmitEndpoints?.length ?? 0}</strong><small>${sourceEvidence.readyForRequestShapeMapping ? "Có request-shape candidate" : sourceEvidence.loginSubmitEndpoints?.length ? "Đã tìm thấy endpoint · shape pending" : "Chưa tìm thấy endpoint"}</small></div>
        <div><span>Login page</span><strong>${sourceEvidence.loginPageCandidates?.length ?? 0}</strong><small>Static page candidate</small></div>
        <div><span>Password codec</span><strong>${sourceEvidence.passwordCodec?.hmacMd5 ? "HMAC-MD5" : sourceEvidence.passwordCodec?.fixedLoginKeyPresent ? "KEY FOUND" : "—"}</strong><small>${sourceEvidence.passwordCodec?.fixedLoginKeyPresent ? "Có fixed loginKey trong source" : "Chưa thấy fixed loginKey"}</small></div>
      </div>
      ${sourceDiagnostics ? `<div class="probe-diagnostics">
        <div><span>PROBE DIAGNOSTICS</span><strong>${sourceDiagnostics.sourceCount ?? 0} source đọc được</strong><small>${esc(Object.entries(sourceDiagnostics.summary ?? {}).map(([k,v])=>`${k}: ${v}`).join(" · ") || "Không có thống kê")}</small></div>
        <div class="probe-diagnostic-list">${(sourceDiagnostics.items ?? []).map((item)=>`<code>${esc(item.path)} · ${esc(item.status)}${item.httpStatus ? ` ${item.httpStatus}` : ""} · ${item.durationMs ?? 0} ms</code>`).join("")}</div>
      </div>` : ""}
      <div class="source-evidence-grid">
        <article><span>Login submit endpoint</span><code>${sourceEvidence.loginSubmitEndpoints?.length ? esc(sourceEvidence.loginSubmitEndpoints.join("\n")) : "Chưa tìm thấy"}</code></article>
        <article><span>Login page candidates</span><code>${sourceEvidence.loginPageCandidates?.length ? esc(sourceEvidence.loginPageCandidates.join("\n")) : "Chưa tìm thấy"}</code></article>
        <article><span>Request field candidates</span><code>${sourceEvidence.candidateRequestFields?.length ? esc(sourceEvidence.candidateRequestFields.join("\n")) : "Chưa tìm thấy"}</code></article>
        <article><span>Supporting AUTH endpoints</span><code>${sourceEvidence.authEndpoints?.length ? esc(sourceEvidence.authEndpoints.join("\n")) : "Chưa tìm thấy"}</code></article>
        <article><span>Login functions</span><code>${sourceEvidence.loginFunctions?.length ? esc(sourceEvidence.loginFunctions.join("\n")) : "Chưa tìm thấy"}</code></article>
        <article><span>Codec evidence</span><code>${esc([
          sourceEvidence.passwordCodec?.fixedLoginKeyPresent ? "fixed loginKey literal" : "",
          sourceEvidence.passwordCodec?.hmacMd5 ? "hex_hmac_md5(...)" : ""
        ].filter(Boolean).join("\n") || "Chưa đủ evidence")}</code></article>
      </div>
      <div class="callsite-grid">
        ${(sourceEvidence.loginCallsites ?? []).length ? sourceEvidence.loginCallsites.map((call)=>`<article>
          <div class="callsite-head"><strong>${esc(call.endpoint)}</strong><span>${esc(call.sourcePath)}</span></div>
          <dl>
            <div><dt>Function</dt><dd>${esc(call.functionName ?? "—")}</dd></div>
            <div><dt>Transport</dt><dd>${esc(call.transportHelper ?? "—")}</dd></div>
            <div><dt>Payload</dt><dd>${esc(call.payloadVariable ?? call.payloadVariables?.join(", ") ?? "—")}</dd></div>
          </dl>
          <div class="call-shape-block"><span>Argument shape</span><code>${esc(call.argumentShapes?.join("\n") || "chưa tách được")}</code></div>
          <div class="call-shape-block"><span>Object keys</span><code>${esc([
            ...(call.directObjectKeys ?? []),
            ...Object.entries(call.objectKeys ?? {}).flatMap(([name,keys])=>keys.map((key)=>`${name}.${key}`))
          ].join("\n") || "chưa thấy")}</code></div>
          <div class="call-shape-block"><span>Field / transform</span><code>${call.fields?.length ? esc(call.fields.map((field)=>`${field.field} ← ${field.transform}${field.transformArgs?.length ? `(${field.transformArgs.join(", ")})` : ""}`).join("\n")) : "chưa tách được assignment"}</code></div>
          <div class="call-shape-block"><span>Transforms quanh call</span><code>${esc(call.transforms?.map((item)=>`${item.name}(${item.args?.join(", ") ?? ""})`).join("\n") || "chưa thấy")}</code></div>
          <div class="call-shape-block"><span>Payload structural trace</span><code>${esc((call.structuralTrace ?? []).map((entry)=>{
            if (entry.kind === "payload-call") return `${entry.kind} · ${entry.target} · ${entry.argShapes?.join(", ") || "—"}`;
            const structure = entry.structure ?? {};
            const calls = structure.calls?.map((item)=>`${item.name}(${item.args?.join(", ") || ""})`).join(", ");
            return `${entry.kind} · ${entry.target} · ${structure.shape ?? "—"}${structure.objectKeys?.length ? ` · keys:${structure.objectKeys.join(",")}` : ""}${calls ? ` · calls:${calls}` : ""}${structure.authTokens?.length ? ` · auth:${structure.authTokens.join(",")}` : ""}`;
          }).join("\n") || "chưa tách được")}</code></div>
          <small>Response signals: ${esc(call.responseSignals?.map((signal)=>sourceEvidence.responseCodeMap?.[signal] ? `${signal} → ${sourceEvidence.responseCodeMap[signal]}` : signal).join(", ") || "chưa thấy")}</small>
        </article>`).join("") : `<div class="empty">Chưa có login call-site đủ rõ.</div>`}
      </div>
      ${Object.keys(sourceEvidence.responseCodeMap ?? {}).length ? `<div class="response-code-map"><span>RESPONSE CODE MAP</span><code>${esc(Object.entries(sourceEvidence.responseCodeMap).map(([code,name])=>`${code} → ${name}`).join("\n"))}</code></div>` : ""}
    ` : `<div class="empty">Chạy probe khi máy đang kết nối NC03 để lấy evidence trực tiếp từ firmware local.</div>`}
    <div class="evidence-actions"><button id="runAuthSourceProbe" ${state.authSourceLoading ? "disabled" : ""}>${state.authSourceLoading ? "Đang quét…" : "Quét AUTH source trên modem"}</button></div>
    <div class="advanced-note"><strong>Fail-closed</strong><span>Source candidate không tự bật NC03Auth.login(). Vẫn cần request/response semantics thật trước AUTH VERIFIED.</span></div>
  </section>

  ${evidence ? `
  <section class="panel evidence-panel"><div class="panel-head"><div><span>AUTH EVIDENCE</span><h2>Ứng viên đăng nhập / session</h2></div>${statusPill(authCandidates.length ? "CANDIDATE ONLY" : "NO CANDIDATE", authCandidates.length ? "warn" : "muted")}</div>
    <p class="body-copy">Các dòng dưới chỉ là bằng chứng cấu trúc. Chỉ khi đối chiếu request thật + response success/failure mới được nâng AUTH lên VERIFIED.</p>
    ${renderEvidenceList(authCandidates, "HAR này chưa có dấu hiệu login/session đủ rõ.", "warn")}
  </section>

  <section class="panel evidence-panel"><div class="panel-head"><div><span>WRITE EVIDENCE</span><h2>Ứng viên thao tác ghi</h2></div>${statusPill(writeCandidates.length ? "CANDIDATE ONLY" : "NO WRITE", writeCandidates.length ? "warn" : "muted")}</div>
    <p class="body-copy">POST không đồng nghĩa với write. Chỉ endpoint có dấu hiệu thao tác ghi mới được liệt kê, và vẫn cần rollback + post-condition trước WRITE VERIFIED.</p>
    ${renderEvidenceList(writeCandidates, "HAR này chưa chứa write-like transaction.", "warn")}
  </section>

  <section class="panel"><div class="panel-head"><div><span>REQUEST MAP</span><h2>Nhóm endpoint quan sát được</h2></div><p>Đã redaction trước khi hiển thị.</p></div>
    ${state.harCandidates.length ? `<div class="candidate-list">${state.harCandidates.map(c=>`<article><span class="method">${esc(c.method)}</span><code>${esc(c.path)}</code><small>${c.count} lần · HTTP ${esc(c.statuses.join(", "))} · ~${c.avgMs} ms${c.hints?.length ? ` · gợi ý: ${esc(c.hints.join(", "))}` : ""}</small></article>`).join("")}</div>` : `<div class="empty">Không có endpoint phù hợp host modem.</div>`}
  </section>` : `<section class="panel"><div class="empty">Chọn một file HAR để bắt đầu. File không rời khỏi trình duyệt.</div></section>`}

  <section class="panel"><div class="panel-head"><div><span>CAPABILITY MATRIX</span><h2>Firmware 8.00.42</h2></div><p>Write chỉ bật khi WRITE VERIFIED.</p></div><div class="table-wrap"><table><thead><tr><th>Module</th><th>Read</th><th>Write</th><th>Endpoint</th><th>Method</th><th>Auth</th><th>Status</th></tr></thead><tbody>${capabilityRows()}</tbody></table></div></section>`;
}

function settingCard(label, value) {
  return `<div><span>${esc(label)}</span><strong>${esc(value ?? "—")}</strong></div>`;
}


function renderConnectionDoctor() {
  const report = state.doctor;
  const tone = report?.status === "OK" ? "ok" : report ? "warn" : "muted";
  return `<section class="panel doctor-panel"><div class="panel-head"><div><span>CONNECTION DOCTOR</span><h2>Chẩn đoán kết nối NC03</h2></div>${statusPill(report?.status ?? "CHƯA KIỂM TRA", tone)}</div>
    <p class="body-copy">Kiểm tra Local Bridge → modem → phiên đăng nhập → firmware/profile → live read mà không gửi credential hoặc session lên cloud.</p>
    ${report ? `<div class="doctor-summary"><strong>${esc(report.message)}</strong><small>${esc(formatClock(report.checkedAt) || "—")} · ${esc(report.baseUrl ?? state.baseUrl)}</small></div>
      <div class="doctor-checks">${(report.checks ?? []).map((check)=>`<article data-ok="${check.ok}"><span>${check.ok ? "✓" : "!"}</span><div><strong>${esc(check.label)}</strong><small>${esc(check.detail)}</small></div></article>`).join("")}</div>` : `<div class="empty">Chưa có kết quả chẩn đoán.</div>`}
    ${state.doctorError ? `<div class="inline-error">${esc(state.doctorError)}</div>` : ""}
    <div class="settings-actions"><button id="runConnectionDoctor">Chạy chẩn đoán</button>${report?.status === "AUTH_REQUIRED" ? `<button id="openStockUi">Mở Web UI gốc để đăng nhập</button>` : ""}</div>
    <div class="advanced-note"><strong>Read-only safety</strong><span>Connection Doctor không bật write, không lưu mật khẩu và không xuất token/cookie/session.</span></div>
  </section>`;
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
  const developerPanel = `
    <section class="panel developer-tools-panel">
      <div class="panel-head"><div><span>DEVELOPER TOOLS</span><h2>HAR Evidence Lab</h2></div>${statusPill(state.developerMode ? "ENABLED" : "OFF", state.developerMode ? "warn" : "muted")}</div>
      <p class="body-copy">Công cụ phân tích HAR, AUTH Source Probe và Mock Mode. Không bật API ghi.</p>
      <label class="developer-toggle"><input id="developerToggle" type="checkbox" ${state.developerMode ? "checked" : ""}/><span><strong>Bật Advanced Developer Mode</strong><small>Cho phép mở HAR Evidence Lab và các công cụ reverse-engineering local.</small></span></label>
      <div class="settings-actions">
        <button id="openDiscovery" ${state.developerMode ? "" : "disabled"}>${state.developerMode ? "Mở HAR Evidence Lab" : "Bật Developer Mode để mở Lab"}</button>
        ${state.developerMode ? `<label class="demo-switch"><input id="demoToggle" type="checkbox" ${state.demoMode ? "checked" : ""}/><span>Mock Mode · DEMO DATA</span></label>` : ""}
      </div>
    </section>`;

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
  ${developerPanel}
  <section class="panel"><div class="panel-head"><div><span>MODEM CONNECTION</span><h2>Địa chỉ NC03</h2></div>${statusPill("LOCAL ONLY")}</div>
    <div class="form-grid"><label>Địa chỉ modem<input id="baseUrl" value="${esc(state.baseUrl)}" inputmode="url" placeholder="192.168.0.1" /></label><label>Tự làm mới<strong>10 giây/lần</strong></label></div>
    ${state.addressError ? `<div class="inline-error">${esc(state.addressError)}</div>` : ""}
    <div class="settings-actions"><button id="saveBaseUrl">Lưu địa chỉ</button><button id="refreshNow">Cập nhật ngay</button><button id="openStockUi">Mở Web UI gốc</button></div>
    <div class="security-note"><strong>Credential policy</strong><span>${esc(SECURITY_NOTE)}</span></div>
  </section>
  ${advanced}
  ${renderConnectionDoctor()}
  <section class="panel report-panel"><div class="panel-head"><div><span>DIAGNOSTIC REPORT</span><h2>Báo cáo chẩn đoán an toàn</h2></div>${statusPill(state.live || state.details ? "READY" : "WAITING", state.live || state.details ? "ok" : "muted")}</div>
    <p class="body-copy">Tạo bản báo cáo A4 gọn, chuyên nghiệp từ snapshot read-only hiện có. Báo cáo không chứa password, token/session, IMEI/serial, ICCID/EID/eSIM profile, APN profile hoặc raw rule.</p>
    <div class="report-preview-grid">
      <div><span>Live telemetry</span><strong>${esc(state.demoMode ? "DEMO DATA" : state.liveStale && state.live ? "LAST GOOD" : state.live ? "LIVE READ" : "UNAVAILABLE")}</strong></div>
      <div><span>Advanced snapshot</span><strong>${esc(detailsFreshnessLabel())}</strong></div>
      <div><span>Live gần nhất</span><strong>${esc(formatClock(state.lastLiveSuccessAt) || "—")}</strong></div>
      <div><span>Advanced gần nhất</span><strong>${esc(formatClock(state.lastDetailsSuccessAt) || "—")}</strong></div>
    </div>
    <div class="settings-actions"><button id="openDiagnosticReport" ${state.demoMode || state.live || state.details ? "" : "disabled"}>Mở báo cáo · In / Lưu PDF</button></div>
    <div class="advanced-note"><strong>Privacy-first</strong><span>Chỉ xuất trường đã chọn rõ ràng. Không spread toàn bộ payload modem vào báo cáo.</span></div>
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

function codedError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function localHealth() {
  try {
    const response = await fetch("/_local/health", {
      cache:"no-store",
      signal:AbortSignal.timeout(2500)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok !== true || payload.app !== "nc03-control-center") {
      throw codedError("LOCAL_BRIDGE_HEALTH_FAILED");
    }
    return payload;
  } catch (error) {
    if (error?.code) throw error;
    throw codedError("LOCAL_BRIDGE_UNREACHABLE");
  }
}

async function localRead(path) {
  let response;
  try {
    response = await fetch(path, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type":"application/json" },
      body: JSON.stringify({ baseUrl: state.baseUrl }),
      signal:AbortSignal.timeout(12000)
    });
  } catch {
    throw codedError("LOCAL_BRIDGE_UNREACHABLE");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) {
    throw codedError(payload.code || `HTTP_${response.status}`);
  }
  if (!Object.prototype.hasOwnProperty.call(payload, "payload")) {
    throw codedError("MALFORMED_LOCAL_RESPONSE");
  }
  return payload.payload;
}

async function runAuthSourceProbe() {
  if (!state.developerMode || state.authSourceLoading) return;
  state.authSourceLoading = true;
  state.authSourceError = "";
  page();
  try {
    await localHealth();
    state.authSourceEvidence = await localRead("/api/nc03/auth-source-probe");
    state.authSourceError = "";
  } catch (error) {
    state.authSourceEvidence = null;
    const code = error?.code || "AUTH_SOURCE_PROBE_FAILED";
    const labels = {
      LOCAL_BRIDGE_UNREACHABLE:"LOCAL_BRIDGE_UNREACHABLE — server local không còn phản hồi.",
      LOCAL_BRIDGE_HEALTH_FAILED:"LOCAL_BRIDGE_HEALTH_FAILED — port hiện tại không phải NC03 Control Center.",
      MALFORMED_LOCAL_RESPONSE:"MALFORMED_LOCAL_RESPONSE — response local sai contract.",
      AUTH_SOURCE_PROBE_FAILED:"AUTH_SOURCE_PROBE_FAILED — probe phía server gặp lỗi."
    };
    state.authSourceError = labels[code] || code;
  } finally {
    state.authSourceLoading = false;
    page();
  }
}

async function runConnectionDoctor() {
  if (state.demoMode) {
    state.doctor = {
      status:"OK",
      message:"Mock Mode đang hoạt động; đây không phải kết quả từ modem thật.",
      checkedAt:new Date().toISOString(),
      baseUrl:state.baseUrl,
      checks:[{id:"demo",label:"Mock Mode",ok:true,detail:"DEMO DATA"}]
    };
    state.doctorError = "";
    page();
    return;
  }
  try {
    state.doctor = await localRead("/api/nc03/doctor");
    state.doctorError = "";
  } catch (error) {
    state.doctor = null;
    state.doctorError = error?.code || "Không chạy được Connection Doctor.";
  }
  page();
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

function openDiagnosticReport() {
  const live = currentTelemetry();
  const details = state.demoMode ? {
    wifi: state.demo?.wifi ?? null,
    clients: state.demo?.clients ?? [],
    dataUsage: {
      statistics_data_used: state.demo?.data?.current ?? null,
      statistics_day_data_used: state.demo?.data?.today ?? null
    }
  } : state.details;

  const report = buildDiagnosticReport({
    baseUrl: state.baseUrl,
    live,
    details,
    liveStale: state.demoMode ? false : state.liveStale,
    detailsStale: state.demoMode ? false : state.detailsStale,
    lastLiveSuccessAt: state.demoMode ? null : state.lastLiveSuccessAt,
    lastDetailsSuccessAt: state.demoMode ? null : state.lastDetailsSuccessAt
  });
  const encoded = encodeURIComponent(JSON.stringify(report));
  const reportWindow = window.open(`./report.html#${encoded}`, "_blank", "noopener,noreferrer");
  if (!reportWindow) {
    state.detailsError = "Trình duyệt đang chặn cửa sổ báo cáo. Hãy cho phép popup cho NC03 Control Center.";
    page();
  }
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
      state.harEvidence = null;
      state.harFileName = "";
      state.discoveryError = "";
      state.authSourceEvidence = null;
      state.authSourceError = "";
      state.authSourceLoading = false;
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

  document.querySelector("#runAuthSourceProbe")?.addEventListener("click", runAuthSourceProbe);
  document.querySelector("#runConnectionDoctor")?.addEventListener("click", runConnectionDoctor);
  document.querySelector("#openDiagnosticReport")?.addEventListener("click", openDiagnosticReport);
  document.querySelector("#refreshNow")?.addEventListener("click", refreshAll);
  document.querySelector("#retryLive")?.addEventListener("click", refreshAll);
  document.querySelector("#retryDetails")?.addEventListener("click", async () => { await refreshDetails(); });
  document.querySelectorAll("#openStockUi").forEach((button)=>button.addEventListener("click", () => window.open(state.baseUrl, "_blank", "noopener,noreferrer")));

  document.querySelector("#harInput")?.addEventListener("change", async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file || !state.developerMode) return;
    try {
      const har = JSON.parse(await file.text());
      state.harEvidence = buildHarEvidenceReport(har);
      state.harEntries = parseHar(har, { modemHost:state.harEvidence.modemHost });
      state.harCandidates = summarizeCandidates(state.harEntries);
      state.harFileName = file.name;
      state.discoveryError = "";
    } catch (error) {
      state.harEntries = [];
      state.harCandidates = [];
      state.harEvidence = null;
      state.harFileName = "";
      state.discoveryError = `Không đọc được HAR: ${error instanceof Error ? error.message : "Dữ liệu không hợp lệ"}`;
    }
    page();
  });

  document.querySelector("#downloadHarEvidence")?.addEventListener("click", () => {
    if (!state.harEvidence || !state.developerMode) return;
    const blob = new Blob([JSON.stringify(state.harEvidence, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nc03-evidence.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  });

  document.querySelector("#clearHarEvidence")?.addEventListener("click", () => {
    state.harEntries = [];
    state.harCandidates = [];
    state.harEvidence = null;
    state.harFileName = "";
    state.discoveryError = "";
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
