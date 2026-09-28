import { MockNC03Adapter } from "./src/modem/MockNC03Adapter.js";
import { buildHarEvidenceReport, parseHar, summarizeCandidates } from "./src/modem/HarDiscovery.js";
import { loadPreferences, savePreferences, SECURITY_NOTE } from "./src/modem/LocalPreferences.js";
import { CONNECTION_STATE, connectionStateLabel } from "./src/modem/ConnectionState.js";
import { PRIMARY_NAV, UI_MODE } from "./src/ui/NavigationModel.js";
import { normalizeModemAddress } from "./src/modem/LoginPolicy.js";
import { buildDiagnosticReport } from "./src/ui/DiagnosticReport.js";
import { SecureCredentialVault } from "./src/modem/SecureCredentialVault.js";
import { NC03ControlClient } from "./src/application/NC03ControlClient.js";
import { NC03AuthSessionStateMachine } from "./src/application/NC03AuthSessionStateMachine.js";
import { DEFAULT_CAPABILITIES } from "./src/modem/CapabilityRegistry.js";
import { NC03_SETTINGS_REGISTRY, canWriteSetting, lifecycleForSetting, settingDefinition } from "./src/domain/NC03SettingsRegistry.js";

const app = document.querySelector("#app");
const prefs = loadPreferences();
const LIVE_REFRESH_MS = 10_000;
let liveTimer = null;
let liveRefreshInFlight = false;
const credentialVault = new SecureCredentialVault();
const controlClient = new NC03ControlClient();
const authSessionMachine = new NC03AuthSessionStateMachine();
let vaultCredential = null;
let vaultHydrated = false;

let state = {
  view: "login",
  demoMode: false,
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
  stockUiAudit: null,
  stockUiAuditError: "",
  stockUiAuditLoading: false,
  writeReadiness: null,
  writeReadinessError: "",
  writeReadinessLoading: false,
  settingsWriteLoading: false,
  settingsWriteError: "",
  settingsWriteResult: null,
  settingsSection: "wifi",
  settingsApIndex: 0,
  authReadiness: null,
  authReadinessError: "",
  authSession: authSessionMachine.snapshot(),
  loginLoading: false,
  loginError: "",
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

function toggleBoolean(value) {
  const raw = String(value ?? "").toLowerCase();
  if (["enable","enabled","open","on","1","true"].includes(raw)) return true;
  if (["disable","disabled","close","off","0","false"].includes(raw)) return false;
  return null;
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
  const ready = state.authReadiness?.ready === true;
  const readinessEvidence = state.authReadiness?.evidence ?? {};
  const missingReadiness = [
    ["login function", readinessEvidence.loginFunction],
    ["loginKey", readinessEvidence.loginKey],
    ["endpoint", readinessEvidence.endpoint],
    ["username HMAC", readinessEvidence.usernameHmac],
    ["username source", readinessEvidence.usernameSourceReady],
    ["password HMAC", readinessEvidence.passwordHmac],
    ["password input", readinessEvidence.passwordInput],
    ["success=0", readinessEvidence.successZero],
    ["transport", readinessEvidence.transport]
  ].filter(([, ok]) => ok === false).map(([label]) => label);
  const readinessText = ready
    ? `AUTH READY · ${esc(state.authReadiness.recipe?.passwordTransform ?? "verified recipe")} · ${esc(state.authReadiness.transport?.method ?? "POST")}`
    : missingReadiness.length
      ? `Thiếu bằng chứng runtime: ${esc(missingReadiness.join(", "))}. Có thể bấm Đăng nhập để app kiểm tra lại.`
      : esc(state.authReadinessError || state.authReadiness?.code || "Đang xác minh AUTH recipe/transport từ firmware local.");
  const sessionExpired = state.connectionState === CONNECTION_STATE.SESSION_EXPIRED;
  const loginIntro = sessionExpired
    ? "Phiên đăng nhập modem đã hết hạn. Xác thực lại để tiếp tục dữ liệu live."
    : "Recipe đăng nhập được Local Bridge đọc trực tiếp từ firmware local. Password không gửi lên cloud.";
  return `<section class="login-shell">
    <div class="login-card">
      <div class="login-brand"><div class="brand-mark">N3</div><div><small>HYBRID Wi-Fi 5G</small><strong>NC03 Control Center</strong></div></div>
      <div class="login-copy"><span class="eyebrow">LOCAL MODEM ACCESS</span><h1>${sessionExpired ? "Xác thực lại NC03" : "Đăng nhập NC03"}</h1><p>${esc(loginIntro)}</p></div>
      ${renderAlwaysOnStatus()}
      <div class="login-form">
        <label>Địa chỉ modem<input id="loginBaseUrl" value="${esc(state.baseUrl)}" inputmode="url" autocomplete="url" placeholder="192.168.0.1" /></label>
        <label>Mật khẩu<input id="loginPassword" type="password" autocomplete="current-password" placeholder="Nhập mật khẩu quản trị modem" /></label>
      </div>
      <div class="login-options">
        <label class="remember-option"><input id="rememberPassword" type="checkbox" ${state.rememberPassword ? "checked" : ""} /><span><strong>Ghi nhớ mật khẩu</strong><small>Mã hóa cục bộ AES-GCM, chỉ lưu sau khi đăng nhập thành công.</small></span></label>
      </div>
      <div class="auth-readiness" data-ready="${ready}"><strong>${ready ? "CƠ CHẾ ĐĂNG NHẬP SẴN SÀNG · AUTH VERIFIED" : "ĐANG KIỂM TRA CƠ CHẾ ĐĂNG NHẬP"}</strong><span>${readinessText}</span></div>
      ${state.addressError ? `<div class="inline-error">${esc(state.addressError)}</div>` : ""}
      ${state.loginError ? `<div class="inline-error">${esc(state.loginError)}</div>` : ""}
      <div class="login-actions">
        <button id="saveLoginAddress" class="secondary-action">Lưu địa chỉ</button>
        <button id="loginSubmit" ${state.loginLoading ? "disabled" : ""}>${state.loginLoading ? "Đang đăng nhập…" : "Đăng nhập"}</button>
        <button id="openStockUi">Mở Web UI gốc</button>
      </div>
      <div class="write-lock"><strong>AUTH có gate riêng; WRITE vẫn khóa.</strong><span>Đăng nhập thành công chỉ mở session đọc. Mọi thao tác ghi modem vẫn yêu cầu WRITE VERIFIED riêng.</span></div>
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
  const dataUsed = state.demoMode ? details?.data?.current : formatBytes(details?.dataUsage?.totalBytes);
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
  const n = state.details?.mobile ?? {};
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
      <div><span>Acquisition</span><strong>${esc(n.acquisitionOrder ?? "—")}</strong></div>
      <div><span>5G config</span><strong>${esc(n.nr5gMode ?? "—")}</strong></div>
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
  return DEFAULT_CAPABILITIES.map((row) => `<tr><td>${esc(row.module)}</td><td>${row.read ? "✓" : "—"}</td><td>${row.write ? "✓" : "—"}</td><td><code>canonical registry</code></td><td>—</td><td>local</td><td><span class="table-status">${esc(row.status)}</span></td></tr>`).join("");
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
  const stockAudit = state.stockUiAudit?.audit ?? null;
  const stockAuditCoverage = state.stockUiAudit?.coverage ?? null;
  const stockAuditDiagnostics = state.stockUiAudit?.diagnostics ?? null;
  const sourceTone = sourceEvidence?.status === "LOGIN_SOURCE_CANDIDATE_READY" ? "ok" : sourceEvidence ? "warn" : "muted";
  const writeReadiness = state.writeReadiness?.evidence ?? null;
  const writeDiagnostics = state.writeReadiness?.diagnostics ?? null;
  const writeReadinessTone = writeReadiness?.captureReady ? "warn" : writeReadiness ? "muted" : "muted";
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

  <section class="panel evidence-panel stock-ui-audit-panel">
    <div class="panel-head"><div><span>STOCK WEB UI AUDIT · WP01</span><h2>Quét cấu trúc Web UI gốc trực tiếp từ modem</h2></div>${statusPill(stockAuditCoverage?.status ?? (state.stockUiAuditLoading ? "ĐANG QUÉT" : "CHƯA CHẠY"), stockAuditCoverage?.status === "AUTHENTICATED_SURFACE_CAPTURED" ? "ok" : stockAudit ? "warn" : "muted")}</div>
    <p class="body-copy">Local Bridge chỉ đọc HTML/JS tĩnh của modem và trả về cấu trúc đã rút gọn: page path, script path, control id/name, navigation hint và action route. Không trả value của input, password, PSK, cookie hay session.</p>
    ${state.stockUiAuditError ? `<div class="inline-error">${esc(state.stockUiAuditError)}</div>` : ""}
    ${stockAudit ? `
      <div class="evidence-summary">
        <div><span>Trang phát hiện</span><strong>${stockAudit.summary?.pageCount ?? 0}</strong><small>HTML path / navigation candidate</small></div>
        <div><span>Controls</span><strong>${stockAudit.summary?.controlCount ?? 0}</strong><small>${stockAudit.summary?.uniqueControlKeyCount ?? 0} key duy nhất</small></div>
        <div><span>Action routes</span><strong>${stockAudit.summary?.actionRouteCount ?? 0}</strong><small>/action + /goform</small></div>
        <div><span>Privacy</span><strong>STRUCTURE ONLY</strong><small>No control values</small></div>
      </div>
      <div class="capture-quality" data-ready="${stockAuditCoverage?.status === "AUTHENTICATED_SURFACE_CAPTURED"}">
        <div><span>AUTHENTICATED COVERAGE</span><strong>${esc(stockAuditCoverage?.status ?? "UNKNOWN")}</strong><small>Session transport: ${stockAuditCoverage?.sessionTransport ? "yes" : "no"} · protected pages: ${stockAuditCoverage?.protectedPageCount ?? 0} · redirects: ${stockAuditCoverage?.redirectCount ?? 0}</small></div>
        ${stockAuditCoverage?.missingPagePaths?.length ? `<ol>${stockAuditCoverage.missingPagePaths.map((path)=>`<li>Chưa đọc được: ${esc(path)}</li>`).join("")}</ol>` : ""}
      </div>
      <div class="source-evidence-grid">
        <article><span>Page paths</span><code>${esc(stockAudit.pagePaths?.join("\n") || "chưa thấy")}</code></article>
        <article><span>Navigation candidates</span><code>${esc((stockAudit.navigation ?? []).slice(0,80).map((item)=>`${item.path}${item.label ? ` · ${item.label}` : ""}`).join("\n") || "chưa thấy")}</code></article>
        <article><span>Action routes</span><code>${esc(stockAudit.actionRoutes?.join("\n") || "chưa thấy")}</code></article>
        <article><span>Control IDs / names</span><code>${esc((stockAudit.controls ?? []).slice(0,160).map((item)=>`${item.sourcePath} · ${item.tag}/${item.type} · ${item.id || item.name || item.i18n || item.labelHint || "unnamed"}${item.sensitive ? " · SENSITIVE-NAME" : ""}`).join("\n") || "chưa thấy")}</code></article>
      </div>
      ${stockAuditDiagnostics ? `<div class="probe-diagnostics"><div><span>AUDIT DIAGNOSTICS</span><strong>${stockAuditDiagnostics.sourceCount ?? 0} source đọc được</strong><small>${esc(Object.entries(stockAuditDiagnostics.summary ?? {}).map(([k,v])=>`${k}: ${v}`).join(" · ") || "—")}</small></div></div>` : ""}
      <div class="evidence-actions"><button id="downloadStockUiAudit">Xuất stock-ui-audit.json</button></div>
    ` : `<div class="empty">Bấm quét để tự động thu thập cấu trúc Web UI gốc trên modem thật. Kết quả giúp giảm số ảnh cần đối chiếu thủ công, nhưng không tự thay thế Human Review của WP01.</div>`}
    <div class="evidence-actions"><button id="runStockUiAudit" ${state.stockUiAuditLoading ? "disabled" : ""}>${state.stockUiAuditLoading ? "Đang quét…" : "Quét Web UI gốc"}</button></div>
    <div class="advanced-note"><strong>WP01 gate</strong><span>Kết quả này là evidence tự động. Human Review vẫn phải xác nhận các trang/control động mà source tĩnh không thể chứng minh.</span></div>
  </section>

  <section class="panel evidence-panel auth-source-panel">
    <div class="panel-head"><div><span>AUTH SOURCE PROBE</span><h2>Đọc dấu vết đăng nhập từ JS của modem</h2></div>${statusPill(sourceEvidence?.status ?? (state.authSourceLoading ? "ĐANG QUÉT" : "CHƯA CHẠY"), sourceTone)}</div>
    <p class="body-copy">Probe chỉ đọc các tài nguyên tĩnh local đã được HAR chứng minh tồn tại hoặc được chính HTML modem tham chiếu. Raw source không rời Local Bridge; UI chỉ nhận evidence đã rút gọn.</p>
    ${state.authSourceError ? `<div class="inline-error">${esc(state.authSourceError)}</div>` : ""}
    ${sourceEvidence ? `
      <div class="evidence-summary">
        <div><span>Source đã đọc</span><strong>${sourceEvidence.sourcesAnalyzed?.length ?? 0}</strong><small>Local modem only</small></div>
        <div><span>Login submit</span><strong>${sourceEvidence.loginSubmitEndpoints?.length ?? 0}</strong><small>${sourceEvidence.authDependencyMapped ? "Đã map object + AUTH transform" : sourceEvidence.requestObjectMapped ? "Đã map request object" : sourceEvidence.readyForRequestShapeMapping ? "Có request-shape candidate" : sourceEvidence.payloadOriginFound ? "Đã thấy nguồn payload · field pending" : sourceEvidence.loginSubmitEndpoints?.length ? "Đã tìm thấy endpoint · shape pending" : "Chưa tìm thấy endpoint"}</small></div>
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
          <div class="call-shape-block"><span>Payload origin trace · toàn file login.js</span><code>${esc((call.payloadOrigins ?? []).map((entry)=>{
            if (entry.kind === "payload-call") return `${entry.scope} · ${entry.kind} · ${entry.target} · ${entry.argShapes?.join(", ") || "—"}`;
            const structure = entry.structure ?? {};
            const calls = structure.calls?.map((item)=>`${item.name}(${item.args?.join(", ") || ""})`).join(", ");
            return `${entry.scope} · ${entry.kind} · ${entry.target} · ${structure.shape ?? "—"}${structure.objectKeys?.length ? ` · keys:${structure.objectKeys.join(",")}` : ""}${calls ? ` · calls:${calls}` : ""}${structure.authTokens?.length ? ` · auth:${structure.authTokens.join(",")}` : ""}${structure.identifiers?.length ? ` · ids:${structure.identifiers.join(",")}` : ""}`;
          }).join("\n") || "chưa tìm thấy nguồn tạo payload trong file")}</code></div>
          <div class="call-shape-block"><span>Payload aliases</span><code>${esc((call.payloadAliases ?? []).map((item)=>`${item.scope} · ${item.relation} · ${item.alias}`).join("\n") || "không có alias quan sát được")}</code></div>
          <div class="call-shape-block"><span>Request object dependency trace</span><code>${esc((call.dependencyOrigins ?? []).map((entry)=>{
            if (entry.kind === "payload-call") return `depth:${entry.depth} · ${entry.scope} · ${entry.dependencyVariable} ← ${entry.parentVariable} · call:${entry.target} · ${entry.argShapes?.join(", ") || "—"}`;
            const structure = entry.structure ?? {};
            const calls = structure.calls?.map((item)=>`${item.name}(${item.args?.join(", ") || ""})`).join(", ");
            return `depth:${entry.depth} · ${entry.scope} · ${entry.target} · ${structure.shape ?? "—"}${structure.objectKeys?.length ? ` · keys:${structure.objectKeys.join(",")}` : ""}${calls ? ` · calls:${calls}` : ""}${structure.authTokens?.length ? ` · auth:${structure.authTokens.join(",")}` : ""}`;
          }).join("\n") || "chưa tìm thấy object đứng sau payload")}</code></div>
          <div class="call-shape-block"><span>Login object fields / transforms</span><code>${esc((call.dependencyFields ?? []).map((field)=>{
            const structure = field.structure ?? {};
            const calls = structure.calls?.map((item)=>`${item.name}[${item.depth ?? 0}](${item.args?.join(", ") || ""})`).join(", ");
            const nestedAuth = structure.authTransforms?.map((item)=>`${item.name}[${item.depth ?? 0}](${item.args?.join(", ") || ""})`).join(", ");
            return `${field.object}.${field.field} ← ${structure.shape ?? "—"}${structure.skeleton ? ` · skeleton:${structure.skeleton}` : ""}${calls ? ` · calls:${calls}` : ""}${nestedAuth ? ` · Nested AUTH transform:${nestedAuth}` : ""}${structure.authTokens?.length ? ` · auth:${structure.authTokens.join(",")}` : ""}`;
          }).join("\n") || "chưa tách được field của request object")}</code></div>
          <div class="call-shape-block"><span>Password field dataflow</span><code>${esc((call.dependencyFields ?? []).filter((field)=>/pass|passwd|password|pwd/i.test(field.field)).flatMap((field)=>(field.referenceFlow ?? []).map((flow)=>{
            const calls = flow.calls?.map((item)=>`${item.name}[${item.depth ?? 0}](${item.args?.join(", ") || ""})`).join(", ");
            return `${field.object}.${field.field} · ${flow.role} · ${flow.scope} · ${flow.skeleton}${calls ? ` · calls:${calls}` : ""}`;
          })).join("\n") || "chưa có dataflow riêng cho password")}</code></div>
          <div class="call-shape-block"><span>Password recipe status</span><code>${esc([
            `field evidence: ${sourceEvidence.passwordFieldEvidence?.length ?? 0}`,
            `input call observed: ${sourceEvidence.passwordInputCallObserved ? "yes" : "no"}`,
            `password HMAC confirmed: ${sourceEvidence.passwordHmacConfirmed ? "yes" : "no"}`,
            `login success=0 confirmed: ${sourceEvidence.loginSuccessZeroObserved ? "yes" : "no"}`
          ].join("\n"))}</code></div>
          <small>Dependency variables: ${esc(call.dependencyVariables?.join(", ") || "chưa thấy")} · Response signals: ${esc(call.responseSignals?.map((signal)=>sourceEvidence.responseCodeMap?.[signal] ? `${signal} → ${sourceEvidence.responseCodeMap[signal]}` : signal).join(", ") || "chưa thấy")}</small>
        </article>`).join("") : `<div class="empty">Chưa có login call-site đủ rõ.</div>`}
      </div>
      ${Object.keys(sourceEvidence.responseCodeMap ?? {}).length ? `<div class="response-code-map"><span>RESPONSE CODE MAP</span><code>${esc(Object.entries(sourceEvidence.responseCodeMap).map(([code,name])=>`${code} → ${name}`).join("\n"))}</code></div>` : ""}
    ` : `<div class="empty">Chạy probe khi máy đang kết nối NC03 để lấy evidence trực tiếp từ firmware local.</div>`}
    <div class="evidence-actions"><button id="runAuthSourceProbe" ${state.authSourceLoading ? "disabled" : ""}>${state.authSourceLoading ? "Đang quét…" : "Quét AUTH source trên modem"}</button></div>
    <div class="advanced-note"><strong>Fail-closed</strong><span>Probe đang truy từ postdata → request object → field/codec. Chỉ khi field password/transform và success/failure semantics khớp nhau mới mở NC03Auth.login() và ô Password thật.</span></div>
  </section>

  <section class="panel evidence-panel write-readiness-panel">
    <div class="panel-head"><div><span>WRITE READINESS LAB</span><h2>Long Life Charging · reversible write plan</h2></div>${statusPill(writeReadiness?.status ?? (state.writeReadinessLoading ? "ĐANG QUÉT" : "CHƯA CHẠY"), writeReadinessTone)}</div>
    <p class="body-copy">Chỉ đọc vendor JS + trạng thái power hiện tại để chuẩn bị capture write đầu tiên. Probe này không gọi endpoint ghi và không tự bật control.</p>
    ${state.writeReadinessError ? `<div class="inline-error">${esc(state.writeReadinessError)}</div>` : ""}
    ${writeReadiness ? `
      <div class="evidence-summary">
        <div><span>Endpoint</span><strong>${writeReadiness.endpointMapped ? "MAPPED" : "PENDING"}</strong><small>${esc(writeReadiness.target?.endpoint ?? "—")}</small></div>
        <div><span>Request shape</span><strong>${writeReadiness.requestShapeMapped ? "MAPPED" : "PENDING"}</strong><small>${writeReadiness.fieldCandidates?.length ?? 0} field candidate</small></div>
        <div><span>Readback</span><strong>${writeReadiness.currentReadbackPresent ? "READY" : "PENDING"}</strong><small>Trạng thái trước write</small></div>
        <div><span>WRITE gate</span><strong>LOCKED</strong><small>writeEnabled=false</small></div>
      </div>
      <div class="write-readiness-grid">
        <article><span>Transport helper</span><code>${esc(writeReadiness.transportHelpers?.join("\n") || "chưa map")}</code></article>
        <article><span>Request fields</span><code>${esc(writeReadiness.fieldCandidates?.join("\n") || "chưa map")}</code></article>
        <article><span>Safe value candidates</span><code>${esc(writeReadiness.safeLiteralCandidates?.join("\n") || "chưa đủ evidence")}</code></article>
        <article><span>Current readback</span><code>${esc(Object.entries(writeReadiness.currentReadback ?? {}).map(([key,value])=>`${key} = ${value ?? "—"}`).join("\n") || "chưa đọc được")}</code></article>
      </div>
      <div class="write-gate-summary" data-ready="${writeReadiness.captureReady}">
        <strong>${writeReadiness.captureReady ? "READY FOR REVERSIBLE HAR CAPTURE" : "SOURCE EVIDENCE INCOMPLETE"}</strong>
        <span>Rollback ready: ${writeReadiness.rollbackReady ? "yes" : "no"} · Live write: LOCKED</span>
      </div>
      ${writeReadiness.callsites?.length ? `<div class="callsite-grid">${writeReadiness.callsites.map((call)=>`<article>
        <div class="callsite-head"><strong>${esc(call.endpoint)}</strong><span>${esc(call.sourcePath)}</span></div>
        <dl>
          <div><dt>Function</dt><dd>${esc(call.functionName ?? "—")}</dd></div>
          <div><dt>Transport</dt><dd>${esc(call.transportHelper ?? "—")}</dd></div>
          <div><dt>Payload</dt><dd>${esc(call.payloadVariables?.join(", ") || "—")}</dd></div>
        </dl>
        <div class="call-shape-block"><span>Argument shape</span><code>${esc(call.argumentShapes?.join("\n") || "chưa tách được")}</code></div>
        <div class="call-shape-block"><span>Fields</span><code>${esc(call.fields?.map((field)=>`${field.variable}.${field.field} ← ${field.skeleton}`).join("\n") || call.directObjectKeys?.join("\n") || "chưa tách được")}</code></div>
      </article>`).join("")}</div>` : ""}
      ${writeDiagnostics ? `<div class="probe-diagnostics"><div><span>WRITE PROBE DIAGNOSTICS</span><strong>${writeDiagnostics.sourceCount ?? 0} source</strong><small>${esc(Object.entries(writeDiagnostics.summary ?? {}).map(([k,v])=>`${k}: ${v}`).join(" · ") || "—")}</small></div></div>` : ""}
      ${writeReadiness.guidance?.length ? `<ol class="write-guidance">${writeReadiness.guidance.map((step)=>`<li>${esc(step)}</li>`).join("")}</ol>` : ""}
    ` : `<div class="empty">Đăng nhập modem trước, sau đó chạy probe để lập reversible write plan.</div>`}
    <div class="evidence-actions"><button id="runWriteReadiness" ${state.writeReadinessLoading ? "disabled" : ""}>${state.writeReadinessLoading ? "Đang quét…" : "Quét WRITE readiness"}</button></div>
    <div class="advanced-note"><strong>Không thực thi write</strong><span>Endpoint vẫn PARTIAL. Chỉ HAR write thật + rollback + post-condition mới được nâng lên WRITE VERIFIED.</span></div>
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

function settingLabel(id) {
  return settingDefinition(id)?.ui?.label ?? id;
}

function settingLifecycleText(id) {
  return lifecycleForSetting(id).replaceAll("_", " ");
}

function registryCapabilityNote(ids) {
  const rows=ids.map((id)=>settingDefinition(id)).filter(Boolean);
  const summary=rows.map((entry)=>`${entry.ui.label}: ${settingLifecycleText(entry.id)}`).join(" · ");
  return `<div class="webui-route-note canonical-registry-note"><strong>Canonical capability registry</strong><span>${esc(summary || "Chưa có setting canonical trong nhóm này.")}</span></div>`;
}

function registryLockedText(id, value, note = "") {
  return lockedTextSetting(settingLabel(id), value, note || `Capability: ${settingLifecycleText(id)}`);
}

function registryLockedSelect(id, value, options = [], note = "") {
  return lockedSelectSetting(settingLabel(id), value, options, note || `Capability: ${settingLifecycleText(id)}`);
}

function registryLockedToggle(id, value, note = "") {
  return lockedToggleSetting(settingLabel(id), value, note || `Capability: ${settingLifecycleText(id)}`);
}

function lockedTextSetting(label, value, note = "Chưa mở WRITE cho mục này") {
  return `<label class="webui-field" data-write="locked"><span>${esc(label)}</span><input value="${esc(value ?? "")}" disabled /><small>${esc(note)}</small></label>`;
}

function lockedSelectSetting(label, value, options = [], note = "Chưa mở WRITE cho mục này") {
  const current = String(value ?? "");
  const rows = [...new Set([current, ...options.map(String)].filter(Boolean))];
  return `<label class="webui-field" data-write="locked"><span>${esc(label)}</span><select disabled>${rows.length ? rows.map((item)=>`<option ${item === current ? "selected" : ""}>${esc(item)}</option>`).join("") : `<option>—</option>`}</select><small>${esc(note)}</small></label>`;
}

function lockedToggleSetting(label, value, note = "Chưa mở WRITE cho mục này") {
  const enabled = toggleBoolean(value);
  return `<div class="webui-toggle-row" data-write="locked"><div><strong>${esc(label)}</strong><span>${esc(note)}</span></div><label class="switch-control"><input type="checkbox" ${enabled === true ? "checked" : ""} disabled /><i></i></label></div>`;
}

function webuiSectionHeader(eyebrow, title, description, status = "READ ONLY", tone = "muted") {
  return `<div class="webui-section-head"><div><span>${esc(eyebrow)}</span><h2>${esc(title)}</h2><p>${esc(description)}</p></div>${statusPill(status, tone)}</div>`;
}

function renderConnectionDoctor() {
  const report = state.doctor;
  const tone = report?.status === "OK" ? "ok" : report ? "warn" : "muted";
  return `<section class="webui-settings-card doctor-panel">${webuiSectionHeader("CONNECTION DOCTOR", "Chẩn đoán kết nối NC03", "Kiểm tra Local Bridge → modem → phiên đăng nhập → firmware/profile → live read.", report?.status ?? "CHƯA KIỂM TRA", tone)}
    ${report ? `<div class="doctor-summary"><strong>${esc(report.message)}</strong><small>${esc(formatClock(report.checkedAt) || "—")} · ${esc(report.baseUrl ?? state.baseUrl)}</small></div>
      <div class="doctor-checks">${(report.checks ?? []).map((check)=>`<article data-ok="${check.ok}"><span>${check.ok ? "✓" : "!"}</span><div><strong>${esc(check.label)}</strong><small>${esc(check.detail)}</small></div></article>`).join("")}</div>` : `<div class="empty">Chưa có kết quả chẩn đoán.</div>`}
    ${state.doctorError ? `<div class="inline-error">${esc(state.doctorError)}</div>` : ""}
    <div class="settings-actions"><button id="runConnectionDoctor">Chạy chẩn đoán</button>${report?.status === "AUTH_REQUIRED" ? `<button id="openStockUi">Mở Web UI gốc để đăng nhập</button>` : ""}</div>
    <div class="advanced-note"><strong>Read-only safety</strong><span>Connection Doctor không bật write, không lưu mật khẩu và không xuất token/cookie/session.</span></div>
  </section>`;
}

function renderSettingsMobile(d) {
  const mobile = d.mobile ?? {};
  const ids=["mobile.data","mobile.roaming","mobile.sim-pin-protect","mobile.cloud-sim-auto","mobile.sim-slot","mobile.acquisition-order","mobile.nr5g-mode","mobile.band","mobile.band-lock"];
  return `<section class="webui-settings-card">
    ${webuiSectionHeader("MOBILE NETWORK", "Mạng di động", "Các control stock-facing lấy tên và capability từ Canonical Settings Registry.", "REGISTRY DRIVEN", "ok")}
    <div class="webui-toggle-list">
      ${registryLockedToggle("mobile.data", mobile.dataEnabled)}
      ${registryLockedToggle("mobile.roaming", mobile.roamingEnabled)}
      ${registryLockedToggle("mobile.sim-pin-protect", mobile.pinProtectionEnabled)}
      ${registryLockedToggle("mobile.cloud-sim-auto", mobile.cloudSimAutoSwitchEnabled)}
    </div>
    <div class="webui-form-grid">
      ${registryLockedSelect("mobile.sim-slot", mobile.simSlot)}
      ${registryLockedSelect("mobile.acquisition-order", mobile.acquisitionOrder)}
      ${registryLockedSelect("mobile.nr5g-mode", mobile.nr5gMode)}
      ${registryLockedSelect("mobile.band", mobile.band)}
      ${registryLockedSelect("mobile.band-lock", mobile.band_lock_type)}
    </div>
    ${registryCapabilityNote(ids)}
  </section>`;
}

function renderSettingsWifi(d) {
  const wifi = d.wifi ?? {};
  const aps = wifi.aps ?? [];
  const activeAp = aps.find((ap)=>ap.index === state.settingsApIndex) ?? aps[0] ?? null;
  if (activeAp) state.settingsApIndex = activeAp.index;
  const ids=["wifi.global-enable","wifi.ap-enable","wifi.ssid","wifi.password","wifi.security-mode","wifi.broadcast-ssid","wifi.frequency","wifi.channel","wifi.standard","wifi.bandwidth","wifi.max-clients"];
  return `<section class="webui-settings-card">
    ${webuiSectionHeader("WI-FI", "Wi-Fi", "Tên control và capability lifecycle lấy từ Canonical Settings Registry; vendor route không còn là authority của UI.", "REGISTRY DRIVEN", "ok")}
    <div class="webui-toggle-list">
      ${registryLockedToggle("wifi.global-enable", wifi.workStatus ?? (wifi.enabled ? "enable" : "disable"))}
    </div>
    <div class="webui-ap-tabs">${aps.length ? aps.map((ap)=>`<button type="button" data-settings-ap="${ap.index}" data-active="${ap.index === activeAp?.index}">AP ${ap.index + 1}<small>${esc(ap.ssid || "Không tên")}</small></button>`).join("") : `<span>Chưa tải được profile AP.</span>`}</div>
    ${activeAp ? `<div class="webui-ap-panel">
      <div class="webui-form-grid">
        ${registryLockedText("wifi.ssid", activeAp.ssid)}
        ${registryLockedText("wifi.password", "", "Không đọc/hiển thị PSK hiện tại; chỉ nhập giá trị mới khi capability WRITE được xác minh.")}
        ${registryLockedSelect("wifi.security-mode", activeAp.security)}
        ${registryLockedSelect("wifi.frequency", activeAp.frequency)}
        ${registryLockedSelect("wifi.channel", activeAp.channel)}
        ${registryLockedSelect("wifi.standard", activeAp.mode)}
        ${registryLockedSelect("wifi.bandwidth", activeAp.bandwidth)}
        ${registryLockedText("wifi.max-clients", activeAp.maxClients)}
      </div>
      <div class="webui-toggle-list compact">
        ${registryLockedToggle("wifi.ap-enable", activeAp.state)}
        ${registryLockedToggle("wifi.broadcast-ssid", activeAp.broadcast)}
      </div>
    </div>` : `<div class="empty">Không có cấu hình Wi-Fi để hiển thị.</div>`}
    ${registryCapabilityNote(ids)}
  </section>`;
}

function renderSettingsLan(d) {
  const dhcp = d.lan ?? {};
  const rules = d.rules ?? {};
  const ids=["lan.dhcp-enable","lan.gateway","lan.subnet-mask","lan.dhcp-start","lan.dhcp-end","lan.lease-time","lan.dns-address","lan.ip-mac-bindings","lan.port-forwarding","lan.ipv4-filters","lan.ipv6-filters"];
  return `<section class="webui-settings-card">
    ${webuiSectionHeader("LAN / DHCP", "LAN & DHCP", "Các setting chính lấy metadata/capability từ Registry; rule collections chỉ hiển thị inventory an toàn.", "REGISTRY DRIVEN", "ok")}
    <div class="webui-toggle-list">${registryLockedToggle("lan.dhcp-enable", dhcp.dhcpEnabled)}</div>
    <div class="webui-form-grid">
      ${registryLockedText("lan.gateway", dhcp.gateway)}
      ${registryLockedText("lan.subnet-mask", dhcp.subnetMask)}
      ${registryLockedText("lan.dhcp-start", dhcp.dhcpStart)}
      ${registryLockedText("lan.dhcp-end", dhcp.dhcpEnd)}
      ${registryLockedText("lan.lease-time", dhcp.leaseSeconds)}
      ${registryLockedText("lan.dns-address", dhcp.dnsAddress)}
    </div>
    <div class="webui-mini-stats">
      ${settingCard(settingLabel("lan.ip-mac-bindings"), rules.dhcpReservations)}
      ${settingCard(settingLabel("lan.port-forwarding"), rules.portForwarding)}
      ${settingCard(settingLabel("lan.ipv4-filters"), rules.ipv4PacketFilters)}
      ${settingCard(settingLabel("lan.ipv6-filters"), rules.ipv6PacketFilters)}
    </div>
    ${registryCapabilityNote(ids)}
  </section>`;
}

function renderSettingsConnectivity(d) {
  const usb = d.connectivity ?? {};
  const ids=["connectivity.bridge-enable","connectivity.bridge-lan-type","connectivity.usb-tether","connectivity.usb-speed","connectivity.ethernet-type","connectivity.cradle-screen-saver"];
  return `<section class="webui-settings-card">
    ${webuiSectionHeader("CONNECTIVITY", "USB / Bridge / Ethernet", "Capability state đến từ Registry; UI không suy luận endpoint từ tên setting.", "REGISTRY DRIVEN", "ok")}
    <div class="webui-toggle-list">
      ${registryLockedToggle("connectivity.bridge-enable", usb.bridgeEnabled)}
      ${registryLockedToggle("connectivity.usb-tether", usb.usbTethering)}
    </div>
    <div class="webui-form-grid">
      ${registryLockedSelect("connectivity.bridge-lan-type", usb.bridgeLanType)}
      ${registryLockedSelect("connectivity.usb-speed", usb.usbSpeed)}
      ${registryLockedSelect("connectivity.ethernet-type", usb.ethernetType)}
      ${registryLockedSelect("connectivity.cradle-screen-saver", usb.cradleScreenSaver)}
    </div>
    ${registryCapabilityNote(ids)}
  </section>`;
}

function renderSettingsPower(d) {
  const power = d.power ?? {};
  const longLife = power.longLifeCharging;
  const longLifeWritable = canWriteSetting("power.long-life");
  const ids=["power.long-life","power.safe-charge","power.ac-autostart","power.eco-display","power.mode","power.auto-sleep-timer","power.lcd-timeout"];
  return `<section class="webui-settings-card power-settings-panel">
    ${webuiSectionHeader("POWER", "Pin / nguồn / màn hình", "WRITE authority đến từ Canonical Settings Registry. Guarded runtime không tự động đồng nghĩa WRITE VERIFIED.", longLifeWritable ? "WRITE VERIFIED" : "WRITE LOCKED", longLifeWritable ? "ok" : "warn")}
    <div class="webui-toggle-list">
      <div class="webui-toggle-row" data-write="${longLifeWritable ? "verified" : "locked"}"><div><strong>${esc(settingLabel("power.long-life"))}</strong><span>Capability: ${esc(settingLifecycleText("power.long-life"))}. Chỉ mở thao tác khi Registry cho phép WRITE.</span></div><label class="switch-control ${longLifeWritable ? "guarded" : ""}"><input id="toggleLongLifeChargingSwitch" type="checkbox" ${longLife === true ? "checked" : ""} ${state.settingsWriteLoading || longLife === null || !longLifeWritable ? "disabled" : ""}/><i></i></label></div>
      ${registryLockedToggle("power.safe-charge", power.safeChargeEnabled)}
      ${registryLockedToggle("power.ac-autostart", power.acAutoStartEnabled)}
      ${registryLockedToggle("power.eco-display", power.ecoDisplayEnabled)}
    </div>
    <div class="webui-form-grid">
      ${registryLockedSelect("power.mode", power.mode)}
      ${registryLockedText("power.auto-sleep-timer", power.autoSleepTimer)}
      ${registryLockedText("power.lcd-timeout", power.lcdTimeout)}
    </div>
    ${state.settingsWriteError ? `<div class="inline-error">${esc(state.settingsWriteError)}</div>` : ""}
    ${state.settingsWriteResult ? `<div class="write-success"><strong>Đã xác minh trên modem</strong><span>${state.settingsWriteResult.changed === false ? "Trạng thái đã đúng từ trước." : "Modem đã nhận lệnh và readback khớp."}</span></div>` : ""}
    ${registryCapabilityNote(ids)}
  </section>`;
}

function renderSettingsSecurity(d) {
  const security = d.security ?? {};
  const ids=["security.wps-enable","security.wps-mode","security.wifi-mac-filter-mode","security.protection","security.mac-filter-type","security.ip-filter-type","security.dmz-enable"];
  return `<section class="webui-settings-card">
    ${webuiSectionHeader("SECURITY", "Bảo mật / WPS / Firewall", "Danger/privacy/capability lifecycle lấy từ Registry; tất cả write chưa verified đều fail-closed.", "REGISTRY DRIVEN", "ok")}
    <div class="webui-toggle-list">
      ${registryLockedToggle("security.wps-enable", security.wpsEnabled)}
      ${registryLockedToggle("security.protection", security.protectionEnabled)}
      ${registryLockedToggle("security.dmz-enable", security.dmzEnabled)}
    </div>
    <div class="webui-form-grid">
      ${registryLockedSelect("security.wps-mode", security.wpsMode)}
      ${registryLockedSelect("security.wifi-mac-filter-mode", security.wifiMacFilterMode)}
      ${registryLockedSelect("security.mac-filter-type", security.macFilterType)}
      ${registryLockedSelect("security.ip-filter-type", security.ipFilterType)}
    </div>
    ${registryCapabilityNote(ids)}
  </section>`;
}

function renderSettingsSystem(d) {
  const time = d.system ?? {};
  const firmware = d.firmware ?? {};
  const ids=["system.ntp-enable","system.timezone","system.time-format","system.daylight","system.firmware-status","system.admin-password","system.reboot","system.factory-reset"];
  const developerPanel = `<div class="webui-subcard">
    <div class="webui-subcard-head"><div><strong>Developer Tools</strong><span>HAR Evidence Lab, AUTH/WRITE mapping và Mock Mode.</span></div>${statusPill(state.developerMode ? "ENABLED" : "OFF", state.developerMode ? "warn" : "muted")}</div>
    <label class="developer-toggle"><input id="developerToggle" type="checkbox" ${state.developerMode ? "checked" : ""}/><span><strong>Bật Advanced Developer Mode</strong><small>Chỉ dành cho reverse-engineering local.</small></span></label>
    <div class="settings-actions"><button id="openDiscovery" ${state.developerMode ? "" : "disabled"}>${state.developerMode ? "Mở HAR Evidence Lab" : "Bật Developer Mode để mở Lab"}</button>${state.developerMode ? `<label class="demo-switch"><input id="demoToggle" type="checkbox" ${state.demoMode ? "checked" : ""}/><span>Mock Mode</span></label>` : ""}</div>
  </div>`;

  return `<section class="webui-settings-card">
    ${webuiSectionHeader("SYSTEM", "Hệ thống / Thời gian / Firmware", "Các control stock-facing dùng Registry; internal state không được tự động nâng thành setting.", "REGISTRY DRIVEN", "ok")}
    <div class="webui-form-grid">
      ${registryLockedSelect("system.ntp-enable", time.ntpEnabled)}
      ${registryLockedText("system.timezone", time.timezone)}
      ${registryLockedSelect("system.time-format", time.timeFormat)}
      ${registryLockedToggle("system.daylight", time.daylightEnabled)}
      ${registryLockedText("system.firmware-status", firmware.firmware, "Thông tin firmware đọc được từ modem.")}
      ${registryLockedText("system.firmware-status", firmware.fotaStatus, "Trạng thái FOTA thuộc cùng capability firmware-status ở WP02.")}
    </div>
    ${registryCapabilityNote(ids)}
    <div class="webui-subcard">
      <div class="webui-subcard-head"><div><strong>NC03 Local Bridge</strong><span>Địa chỉ modem và thao tác đồng bộ.</span></div>${statusPill("LOCAL ONLY")}</div>
      <div class="form-grid"><label>Địa chỉ modem<input id="baseUrl" value="${esc(state.baseUrl)}" inputmode="url" placeholder="192.168.0.1" /></label><label>Tự làm mới<strong>10 giây/lần</strong></label></div>
      ${state.addressError ? `<div class="inline-error">${esc(state.addressError)}</div>` : ""}
      <div class="settings-actions"><button id="saveBaseUrl">Lưu địa chỉ</button><button id="refreshNow">Cập nhật ngay</button><button id="openStockUi">Mở Web UI gốc</button></div>
    </div>
    ${renderConnectionDoctor()}
    <div class="webui-subcard report-panel">
      <div class="webui-subcard-head"><div><strong>Báo cáo chẩn đoán</strong><span>Xuất snapshot an toàn, không chứa password/token/session/IMEI/ICCID. Không spread toàn bộ payload modem vào báo cáo.</span></div>${statusPill(state.live || state.details ? "READY" : "WAITING", state.live || state.details ? "ok" : "muted")}</div>
      <div class="settings-actions"><button id="openDiagnosticReport" ${state.demoMode || state.live || state.details ? "" : "disabled"}>Mở báo cáo · In / Lưu PDF</button></div>
    </div>
    <div class="webui-subcard">
      <div class="webui-subcard-head"><div><strong>Chế độ giao diện</strong><span>Ảnh hưởng mức chi tiết ở các màn hình khác.</span></div>${statusPill(state.uiMode === UI_MODE.ADVANCED ? "ADVANCED" : "BASIC")}</div>
      <div class="mode-selector"><button data-ui-mode="basic" data-active="${state.uiMode === UI_MODE.BASIC}"><strong>Basic Mode</strong><span>Gọn, ưu tiên thông tin chính</span></button><button data-ui-mode="advanced" data-active="${state.uiMode === UI_MODE.ADVANCED}"><strong>Advanced Mode</strong><span>Hiện toàn bộ thông số đã đọc</span></button></div>
    </div>
    ${developerPanel}
  </section>`;
}

function renderSettings() {
  const d = state.details ?? {};
  const sections = [
    ["mobile","Mạng di động","SIM · 4G/5G"],
    ["wifi","Wi-Fi","SSID · kênh"],
    ["lan","LAN / DHCP","IP · lease"],
    ["connectivity","USB / Bridge","Tether · passthrough"],
    ["power","Pin / Nguồn","Sạc · màn hình"],
    ["security","Bảo mật","WPS · filter"],
    ["system","Hệ thống","NTP · firmware"]
  ];
  const selected = sections.some(([id])=>id === state.settingsSection) ? state.settingsSection : "wifi";
  const verifiedSettingWrites = NC03_SETTINGS_REGISTRY.entries.filter((entry)=>entry.operationClass==="SETTING" && entry.capability.writable).length;
  const body = selected === "mobile" ? renderSettingsMobile(d)
    : selected === "wifi" ? renderSettingsWifi(d)
    : selected === "lan" ? renderSettingsLan(d)
    : selected === "connectivity" ? renderSettingsConnectivity(d)
    : selected === "power" ? renderSettingsPower(d)
    : selected === "security" ? renderSettingsSecurity(d)
    : renderSettingsSystem(d);

  return `${renderTopbar("Cài đặt", "Settings Center tổ chức theo nhóm giống Web UI gốc; dữ liệu hiện tại lấy trực tiếp từ modem, WRITE mở dần theo từng setting đã xác minh.")}
    ${renderDetailsNotice()}
    <section class="webui-settings-shell">
      <aside class="webui-settings-nav">
        <div class="webui-settings-nav-head"><span>NC03 SETTINGS</span><strong>Quản trị modem</strong><small>Firmware 8.00.42</small></div>
        <nav>${sections.map(([id,label,meta])=>`<button data-settings-section="${id}" data-active="${selected === id}"><strong>${esc(label)}</strong><span>${esc(meta)}</span></button>`).join("")}</nav>
        <div class="webui-settings-coverage"><span>WRITE coverage</span><strong>${verifiedSettingWrites} verified</strong><small>Registry là authority</small></div>
      </aside>
      <div class="webui-settings-content">
        <div class="webui-settings-toolbar"><div><span>Trạng thái</span><strong>${state.detailsStale ? "Dữ liệu gần nhất" : state.details ? "Đồng bộ với modem" : "Đang chờ modem"}</strong></div><div><span>WRITE policy</span><strong>Fail-closed</strong></div><button id="refreshNow">↻ Đồng bộ</button><button id="openStockUi">Mở Web UI gốc</button></div>
        ${body}
      </div>
    </section>`;
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

async function writeLongLifeCharging(enabled) {
  if (!canWriteSetting("power.long-life")) {
    state.settingsWriteError = "Capability power.long-life chưa WRITE VERIFIED trong Canonical Settings Registry.";
    page();
    return;
  }
  if (state.demoMode || state.settingsWriteLoading || typeof enabled !== "boolean") return;
  const action = enabled ? "bật" : "tắt";
  if (!window.confirm(`Xác nhận ${action} Long Life Charging trên modem NC03? App sẽ kiểm tra readback sau lệnh và tự rollback nếu trạng thái không khớp.`)) return;

  state.settingsWriteLoading = true;
  state.settingsWriteError = "";
  state.settingsWriteResult = null;
  page();

  try {
    await controlClient.health();
    state.settingsWriteResult = await controlClient.setLongLifeCharging(state.baseUrl, enabled);
    await refreshDetails({ render:false });
    await refreshLive({ render:false });
  } catch (error) {
    state.authSession = authSessionMachine.loginFailed(error?.code || "LOGIN_FAILED");
    const labels = {
      WRITE_MAPPING_INCOMPLETE:"Firmware hiện tại chưa map đủ request để ghi an toàn.",
      WRITE_READBACK_UNMAPPED:"Không xác định được trạng thái gốc để tạo rollback.",
      WRITE_FIELD_AMBIGUOUS:"Có nhiều field write ứng viên; app từ chối đoán.",
      WRITE_TRANSPORT_UNRESOLVED:"Chưa xác minh được transport ghi của firmware.",
      WRITE_REJECTED:"Modem từ chối lệnh thay đổi.",
      WRITE_POSTCONDITION_FAILED:error?.payload?.rollbackVerified
        ? "Thay đổi không đạt post-condition; app đã rollback và xác minh trạng thái cũ."
        : "Thay đổi không đạt post-condition. Rollback chưa xác minh được; hãy kiểm tra Web UI gốc.",
      AUTHENTICATION_REQUIRED:"Phiên đăng nhập modem đã hết hạn. Hãy đăng nhập lại.",
      LOCAL_BRIDGE_RESTART_REQUIRED:"Local Bridge đang chạy bản cũ. Hãy restart runtime."
    };
    state.settingsWriteError = labels[error?.code] || error?.code || "SETTINGS_WRITE_FAILED";
  } finally {
    state.settingsWriteLoading = false;
    page();
  }
}

async function refreshAuthReadiness({ render = true } = {}) {
  if (state.demoMode) return;
  try {
    await controlClient.health();
    state.authReadiness = await controlClient.getAuthReadiness(state.baseUrl);
    state.authReadinessError = "";
    state.authSession = state.authReadiness?.ready
      ? authSessionMachine.readinessReady()
      : authSessionMachine.readinessFailed(state.authReadiness?.code || "AUTH_NOT_READY");
    if (state.authReadiness?.ready && state.rememberPassword && !vaultHydrated) {
      vaultHydrated = true;
      vaultCredential = await credentialVault.load().catch(() => null);
      if (vaultCredential?.baseUrl && vaultCredential.baseUrl !== state.baseUrl) vaultCredential = null;
    }
  } catch (error) {
    state.authReadiness = null;
    state.authReadinessError = error?.code || "AUTH_READINESS_FAILED";
    state.authSession = authSessionMachine.readinessFailed(state.authReadinessError);
  }
  if (render) page();
}

async function submitLogin() {
  if (state.loginLoading) return;

  const addressInput = document.querySelector("#loginBaseUrl");
  const passwordInput = document.querySelector("#loginPassword");
  const password = passwordInput?.value ?? "";

  try {
    state.baseUrl = normalizeModemAddress(addressInput?.value || state.baseUrl);
    state.addressError = "";
    persist();
  } catch {
    state.addressError = "Địa chỉ không hợp lệ. Chỉ dùng IP mạng nội bộ RFC1918, ví dụ 192.168.0.1.";
    page();
    return;
  }

  if (!password) {
    state.loginError = "Hãy nhập mật khẩu quản trị modem.";
    page();
    return;
  }

  state.loginLoading = true;
  state.loginError = "";
  state.authSession = authSessionMachine.beginLogin();
  const submitButton = document.querySelector("#loginSubmit");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Đang đăng nhập…";
  }

  try {
    if (!state.authReadiness?.ready) {
      await refreshAuthReadiness({ render:false });
      if (!state.authReadiness?.ready) {
        throw codedError(state.authReadinessError || state.authReadiness?.code || "AUTH_NOT_READY");
      }
    }

    await controlClient.login(state.baseUrl, password);
    state.authSession = authSessionMachine.loginSucceeded();

    if (state.rememberPassword) {
      await credentialVault.save({ baseUrl:state.baseUrl, password });
      vaultCredential = { baseUrl:state.baseUrl, password };
    } else {
      await credentialVault.clear().catch(() => {});
      vaultCredential = null;
    }

    state.connectionState = CONNECTION_STATE.CONNECTED;
    state.view = "home";
    state.loginError = "";
    await refreshAll();
  } catch (error) {
    const labels = {
      LOGIN_REJECTED:"Mật khẩu không được modem chấp nhận.",
      AUTH_VERIFICATION_FAILED:"Modem trả success nhưng session chưa xác minh được.",
      LOGIN_TRANSPORT_UNRESOLVED:"Chưa xác minh được transport saveAjaxJsonData của firmware.",
      LOGIN_RECIPE_INCOMPLETE:"Cơ chế đăng nhập runtime chưa map đủ. Xem dòng 'Thiếu bằng chứng runtime' phía trên; app không gửi password khi recipe chưa đủ.",
      PASSWORD_REQUIRED:"Hãy nhập mật khẩu quản trị modem.",
      AUTH_NOT_READY:"Chưa xác minh được cơ chế đăng nhập của modem. Hãy kiểm tra kết nối tới NC03 rồi thử lại.",
      AUTH_READINESS_FAILED:"Không kiểm tra được cơ chế đăng nhập của modem.",
      LOCAL_BRIDGE_UNREACHABLE:"Local Bridge không phản hồi. Hãy chạy lại NC03 local runtime.",
      LOCAL_BRIDGE_RESTART_REQUIRED:"Local Bridge đang chạy bản cũ. Hãy restart runtime rồi thử lại."
    };
    state.loginError = labels[error?.code] || error?.code || "LOGIN_FAILED";
  } finally {
    state.loginLoading = false;
    page();
    if (state.view === "login") {
      const restoredPassword = document.querySelector("#loginPassword");
      if (restoredPassword) restoredPassword.value = password;
    }
  }
}

async function runStockUiAudit() {
  if (!state.developerMode || state.stockUiAuditLoading) return;
  state.stockUiAuditLoading = true;
  state.stockUiAuditError = "";
  page();
  try {
    await controlClient.health();
    state.stockUiAudit = await controlClient.getStockUiAudit(state.baseUrl);
  } catch (error) {
    state.stockUiAudit = null;
    const labels = {
      LOCAL_BRIDGE_UNREACHABLE:"Local Bridge không phản hồi.",
      LOCAL_BRIDGE_RESTART_REQUIRED:"Stock UI Audit mới nhưng Local Bridge đang chạy runtime/schema cũ. Hãy restart NC03 runtime.",
      METHOD_NOT_ALLOWED:"Stock UI Audit endpoint không khớp runtime hiện tại.",
      STOCK_UI_AUDIT_FAILED:"Không quét được cấu trúc Web UI gốc từ modem local."
    };
    state.stockUiAuditError = labels[error?.code] || error?.code || "STOCK_UI_AUDIT_FAILED";
  } finally {
    state.stockUiAuditLoading = false;
    page();
  }
}

async function runAuthSourceProbe() {
  if (!state.developerMode || state.authSourceLoading) return;
  state.authSourceLoading = true;
  state.authSourceError = "";
  page();
  try {
    await controlClient.health();
    state.authSourceEvidence = await controlClient.getAuthSourceProbe(state.baseUrl);
    state.authSourceError = "";
  } catch (error) {
    state.authSourceEvidence = null;
    const code = error?.code || "AUTH_SOURCE_PROBE_FAILED";
    const labels = {
      LOCAL_BRIDGE_UNREACHABLE:"LOCAL_BRIDGE_UNREACHABLE — server local không còn phản hồi.",
      LOCAL_BRIDGE_HEALTH_FAILED:"LOCAL_BRIDGE_HEALTH_FAILED — port hiện tại không phải NC03 Control Center.",
      LOCAL_BRIDGE_RESTART_REQUIRED:"LOCAL_BRIDGE_RESTART_REQUIRED — giao diện mới nhưng Local Bridge vẫn đang chạy code/schema cũ trong RAM. Dừng process NC03 và khởi động lại runtime.",
      MALFORMED_LOCAL_RESPONSE:"MALFORMED_LOCAL_RESPONSE — response local sai contract.",
      AUTH_SOURCE_PROBE_FAILED:"AUTH_SOURCE_PROBE_FAILED — probe phía server gặp lỗi.",
      METHOD_NOT_ALLOWED:"METHOD_NOT_ALLOWED — frontend và Local Bridge đang lệch phiên bản hoặc đang mở nhầm runtime. Tải lại sau khi runtime được cập nhật."
    };
    state.authSourceError = labels[code] || code;
  } finally {
    state.authSourceLoading = false;
    page();
  }
}

async function runWriteReadiness() {
  if (!state.developerMode || state.writeReadinessLoading) return;
  state.writeReadinessLoading = true;
  state.writeReadinessError = "";
  page();
  try {
    await controlClient.health();
    state.writeReadiness = await controlClient.getWriteReadiness(state.baseUrl);
    state.writeReadinessError = "";
  } catch (error) {
    state.writeReadiness = null;
    const labels = {
      AUTHENTICATION_REQUIRED:"Cần đăng nhập NC03 trước khi lập reversible write plan.",
      LOCAL_BRIDGE_UNREACHABLE:"Local Bridge không phản hồi.",
      LOCAL_BRIDGE_RESTART_REQUIRED:"WRITE Lab mới nhưng Local Bridge đang chạy runtime cũ. Hãy restart NC03 runtime sau khi cập nhật repo.",
      METHOD_NOT_ALLOWED:"WRITE readiness endpoint không khớp runtime hiện tại. Hãy cập nhật/restart NC03 Local Bridge.",
      WRITE_READINESS_FAILED:"Không phân tích được WRITE readiness từ firmware local."
    };
    state.writeReadinessError = labels[error?.code] || error?.code || "WRITE_READINESS_FAILED";
  } finally {
    state.writeReadinessLoading = false;
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
    state.doctor = await controlClient.getDoctor(state.baseUrl);
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
    state.live = await controlClient.getSnapshot(state.baseUrl);
    state.liveStale = false;
    state.lastLiveSuccessAt = state.live?.refreshedAt ?? new Date().toISOString();
    state.connectionState = CONNECTION_STATE.CONNECTED;
    state.liveError = "";
  } catch (error) {
    const authRequired = error?.code === "AUTHENTICATION_REQUIRED";
    const hadVerifiedSession = Boolean(state.authSession?.hadAuthenticatedSession || state.lastLiveSuccessAt);
    state.authSession = authSessionMachine.protectedRequestFailed(error?.code || "NC03_READ_FAILED");
    state.liveStale = Boolean(state.live);
    state.liveError = authRequired
      ? hadVerifiedSession
        ? "Phiên đăng nhập modem đã hết hạn. Hãy xác thực lại."
        : "Modem yêu cầu đăng nhập. NC03 Control Center đang xác minh AUTH recipe để mở form Password."
      : "Không kết nối được NC03 qua Local Bridge.";
    state.connectionState = authRequired
      ? hadVerifiedSession
        ? CONNECTION_STATE.SESSION_EXPIRED
        : CONNECTION_STATE.AUTHENTICATION_REQUIRED
      : state.liveStale
        ? CONNECTION_STATE.RECONNECTING
        : CONNECTION_STATE.NC03_UNAVAILABLE;
    if (authRequired) {
      await refreshAuthReadiness({ render:false });
      state.view = "login";
    }
  }
  if (render) page();
}

async function refreshDetails({ render = true } = {}) {
  if (state.demoMode) return;
  try {
    state.details = await controlClient.getDetails(state.baseUrl);
    state.detailsStale = false;
    state.lastDetailsSuccessAt = state.details?.meta?.capturedAt ?? new Date().toISOString();
    state.detailsError = "";
  } catch (error) {
    state.detailsStale = Boolean(state.details);
    state.detailsError = error?.code || "NC03_DETAILS_UNAVAILABLE";
    state.authSession = authSessionMachine.protectedRequestFailed(error?.code || "NC03_DETAILS_UNAVAILABLE");
    if (error?.code === "AUTHENTICATION_REQUIRED") {
      state.view = "login";
      await refreshAuthReadiness({ render:false });
    }
  }
  if (render) page();
}

async function pollLiveOnce() {
  if (state.demoMode || document.hidden || liveRefreshInFlight) return;
  liveRefreshInFlight = true;
  const hadLive = Boolean(state.live);
  const wasStale = state.liveStale;
  const previousView = state.view;
  const previousConnectionState = state.connectionState;
  try {
    await refreshLive({ render:false });
    const authNavigationChanged = previousView !== state.view || previousConnectionState !== state.connectionState;
    if (hadLive !== Boolean(state.live) || authNavigationChanged) page();
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
      totalBytes: state.demo?.data?.current ?? null,
      dailyBytes: state.demo?.data?.today ?? null
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
    vaultHydrated = false;
    vaultCredential = null;
    await refreshAuthReadiness({ render:false });
    await refreshAll();
  });

  const loginPasswordInput = document.querySelector("#loginPassword");
  if (loginPasswordInput && vaultCredential?.password && state.rememberPassword) {
    loginPasswordInput.value = vaultCredential.password;
  }
  document.querySelector("#rememberPassword")?.addEventListener("change", (event) => {
    state.rememberPassword = event.currentTarget.checked;
    persist();
    if (!state.rememberPassword) {
      credentialVault.clear().catch(() => {});
      vaultCredential = null;
    }
  });
  document.querySelector("#loginSubmit")?.addEventListener("click", submitLogin);
  document.querySelector("#loginPassword")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitLogin();
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

  document.querySelectorAll("[data-settings-section]").forEach((button) => button.addEventListener("click", async () => {
    state.settingsSection = button.dataset.settingsSection || "wifi";
    if (!state.demoMode) await refreshDetails({ render:false });
    page();
  }));

  document.querySelectorAll("[data-settings-ap]").forEach((button) => button.addEventListener("click", () => {
    state.settingsApIndex = Number(button.dataset.settingsAp) || 0;
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
      state.stockUiAudit = null;
      state.stockUiAuditError = "";
      state.stockUiAuditLoading = false;
      state.writeReadiness = null;
      state.writeReadinessError = "";
      state.writeReadinessLoading = false;
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

  document.querySelector("#runStockUiAudit")?.addEventListener("click", runStockUiAudit);
  document.querySelector("#runAuthSourceProbe")?.addEventListener("click", runAuthSourceProbe);
  document.querySelector("#runWriteReadiness")?.addEventListener("click", runWriteReadiness);
  document.querySelector("#toggleLongLifeCharging")?.addEventListener("click", (event) => {
    writeLongLifeCharging(event.currentTarget.dataset.next === "true");
  });
  document.querySelector("#toggleLongLifeChargingSwitch")?.addEventListener("change", (event) => {
    const desired = event.currentTarget.checked;
    event.currentTarget.checked = !desired;
    writeLongLifeCharging(desired);
  });
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

  document.querySelector("#downloadStockUiAudit")?.addEventListener("click", () => {
    if (!state.stockUiAudit?.audit || !state.developerMode) return;
    const artifact = {
      schema:state.stockUiAudit.audit.schema,
      capturedAt:new Date().toISOString(),
      modemBaseUrl:state.baseUrl,
      audit:state.stockUiAudit.audit,
      coverage:state.stockUiAudit.coverage ?? null,
      diagnostics:{
        summary:state.stockUiAudit.diagnostics?.summary ?? {},
        sourceCount:state.stockUiAudit.diagnostics?.sourceCount ?? 0
      }
    };
    const blob = new Blob([JSON.stringify(artifact, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nc03-stock-ui-audit.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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

async function bootstrapRuntime() {
  state.authSession = authSessionMachine.beginBootstrap();
  // Login-first UX: every fresh launch starts at the NC03 login screen.
  // A previously persisted Developer Demo must never bypass modem authentication.
  state.view = "login";
  state.demoMode = false;
  persist();
  page();

  await refreshAuthReadiness({ render:false });
  await refreshLive({ render:false });

  if (state.connectionState === CONNECTION_STATE.CONNECTED && state.live) {
    await refreshDetails({ render:false });
  }

  // Do not auto-enter Home from a detected modem session. The user explicitly
  // enters NC03 Control Center by submitting the login form (or choosing Demo).
  state.view = "login";
  page();
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")
    .then((registration) => registration.update())
    .catch(() => {});
}
await bootstrapRuntime();
startLivePolling();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) pollLiveOnce().catch(() => {});
});
