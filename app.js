import { MockNC03Adapter } from "./src/modem/MockNC03Adapter.js";
import { DEFAULT_CAPABILITIES } from "./src/modem/CapabilityRegistry.js";
import { parseHar, summarizeCandidates } from "./src/modem/HarDiscovery.js";
import { loadPreferences, savePreferences, SECURITY_NOTE } from "./src/modem/LocalPreferences.js";
import { CONNECTION_STATE, connectionStateLabel } from "./src/modem/ConnectionState.js";
import { PRIMARY_NAV, UI_MODE } from "./src/ui/NavigationModel.js";

const app = document.querySelector("#app");
const prefs = loadPreferences();

let state = {
  view: prefs.demoMode ? "home" : "login",
  demoMode: prefs.demoMode,
  developerMode: prefs.developerMode,
  uiMode: prefs.uiMode,
  baseUrl: prefs.baseUrl,
  connectionState: CONNECTION_STATE.AUTHENTICATION_REQUIRED,
  harCandidates: [],
  harEntries: [],
  discoveryError: "",
  demo: null
};

function esc(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function persist() {
  savePreferences({
    baseUrl: state.baseUrl,
    demoMode: state.demoMode,
    developerMode: state.developerMode,
    uiMode: state.uiMode
  });
}

function statusPill(label, tone = "muted") {
  return `<span class="pill" data-tone="${tone}">${esc(label)}</span>`;
}

function currentConnectionLabel() {
  return state.demoMode ? "DEMO DATA" : connectionStateLabel(state.connectionState);
}

function renderSidebar() {
  const developerItem = state.developerMode
    ? `<span class="nav-divider">DEVELOPER</span><button data-nav="discovery" data-active="${state.view === "discovery"}"><span>API Discovery</span><small>Advanced Developer Mode</small></button>`
    : "";

  return `<aside class="sidebar">
    <div class="brand"><div class="brand-mark">N3</div><div><small>HYBRID Wi-Fi 5G</small><strong>NC03 Control Center</strong></div></div>
    <div class="connection-card">
      <div class="connection-row"><span class="dot" data-on="${state.demoMode}"></span><div><small>Trạng thái</small><strong>${esc(currentConnectionLabel())}</strong></div></div>
      <div class="connection-address">${esc(state.baseUrl)}</div>
    </div>
    <nav>
      ${PRIMARY_NAV.map(({ id, label }) => `<button data-nav="${id}" data-active="${state.view === id}"><span>${esc(label)}</span></button>`).join("")}
      ${developerItem}
    </nav>
    <div class="sidebar-foot"><strong>Phase 1 · Ready for HAR</strong><span>Write API đang khóa</span></div>
  </aside>`;
}

function renderTopbar(title, subtitle) {
  return `<header class="topbar"><div><small>NC03 / ${esc(title).toUpperCase()}</small><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
  <div class="top-actions">${statusPill(state.uiMode === UI_MODE.ADVANCED ? "ADVANCED" : "BASIC")}${state.demoMode ? statusPill("DEMO DATA", "warn") : statusPill("NO VERIFIED API")}</div></header>`;
}

function metric(label, value, note) {
  return `<article class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;
}

function renderLogin() {
  return `<section class="login-shell">
    <div class="login-card">
      <div class="login-brand"><div class="brand-mark">N3</div><div><small>HYBRID Wi-Fi 5G</small><strong>NC03 Control Center</strong></div></div>
      <div class="login-copy"><span class="eyebrow">LOCAL MODEM ACCESS</span><h1>Kết nối NC03</h1><p>Web-app chỉ đăng nhập trực tiếp với modem trong mạng LAN. Mật khẩu admin không được gửi tới Application Management hay cloud proxy.</p></div>
      <div class="login-form">
        <label>Địa chỉ modem<input id="loginBaseUrl" value="${esc(state.baseUrl)}" inputmode="url" autocomplete="url" /></label>
        <label>Mật khẩu admin<input type="password" disabled autocomplete="current-password" placeholder="Chờ Login endpoint VERIFIED" /></label>
      </div>
      <div class="login-options">
        <label><input type="checkbox" disabled /> Ghi nhớ đăng nhập modem · chờ secure credential flow</label>
        <label><input type="checkbox" disabled /> Tự động đăng nhập lần sau · chờ auth/session VERIFIED</label>
      </div>
      <div class="login-actions">
        <button id="saveLoginAddress" class="secondary-action">Lưu địa chỉ modem</button>
        <div class="locked-action"><strong>Đăng nhập thật đang khóa</strong><span>AUTH UNKNOWN</span></div>
      </div>
      <div class="write-lock"><strong>Authentication chưa được xác minh.</strong><span>Login chỉ được mở sau HAR thật xác định request, session/token/CSRF, expiry, logout và retry policy.</span></div>
      <div class="login-safe-actions"><button id="enterDemo">Mở Developer Demo</button></div>
    </div>
  </section>`;
}

function renderHome() {
  const d = state.demoMode ? state.demo : null;
  return `${renderTopbar("Tổng quan", "Thông tin quan trọng trước; cấu hình nâng cao ở đúng khu vực.")}
  <section class="hero-status">
    <div><span class="eyebrow">INTERNET</span><div class="hero-line"><span class="big-dot" data-on="${Boolean(d)}"></span><h2>${d ? esc(d.status.internet) : esc(connectionStateLabel(state.connectionState))}</h2></div><p>${d ? `${esc(d.status.network)} · ${esc(d.status.carrier)}` : "Chưa có request thật để xác minh trạng thái Internet của NC03."}</p></div>
    ${d ? `<div class="signal-bars" aria-label="Cường độ tín hiệu demo"><i></i><i></i><i></i><i></i><i></i></div>` : ""}
  </section>
  <section class="metrics-grid">
    ${metric("Mạng di động", d ? d.status.network : "—", d ? `RSRP ${d.signal.rsrp} dBm · DEMO DATA` : "Endpoint chưa xác minh")}
    ${metric("Pin", d ? `${d.battery.percentage}%` : "—", d ? "DEMO DATA · không đại diện modem thật" : "Không suy diễn % pin")}
    ${metric("Dữ liệu", d ? d.data.current : "—", d ? `${d.data.current} / ${d.data.quota} · DEMO DATA` : "Không bịa lịch sử dữ liệu")}
    ${metric("Thiết bị", d ? d.wifi.clients : "—", d ? `${d.wifi.clients} thiết bị mẫu` : "Client API chưa xác minh")}
  </section>
  <section class="panel"><div class="panel-head"><div><span>QUICK ACTIONS</span><h2>Đi tới khu vực</h2></div><p>Chỉ điều hướng. Không có write action modem khi endpoint chưa WRITE VERIFIED.</p></div>
    <div class="quick-grid">${[["wifi","Wi-Fi"],["devices","Thiết bị"],["network","Mạng di động"],["settings","Cài đặt"]].map(([id,label])=>`<button data-nav="${id}"><strong>${label}</strong><span>Mở khu vực</span></button>`).join("")}</div>
  </section>`;
}

function renderNetwork() {
  const d = state.demoMode ? state.demo : null;
  return `${renderTopbar("Mạng", "Chỉ hiển thị thông số radio mà NC03 thực sự cung cấp.")}
  <section class="panel"><div class="panel-head"><div><span>MOBILE NETWORK</span><h2>${d ? esc(d.status.network) : "Chưa có dữ liệu thật"}</h2></div>${d ? statusPill("DEMO DATA","warn") : statusPill("UNKNOWN")}</div>
    <div class="spec-grid"><div><span>Carrier</span><strong>${d ? esc(d.status.carrier) : "—"}</strong></div><div><span>RSRP</span><strong>${d ? `${d.signal.rsrp} dBm` : "—"}</strong></div><div><span>RSRQ</span><strong>${d ? `${d.signal.rsrq} dB` : "—"}</strong></div><div><span>SINR</span><strong>${d ? `${d.signal.sinr} dB` : "—"}</strong></div></div>
    ${state.uiMode === UI_MODE.ADVANCED ? `<div class="advanced-note"><strong>Advanced Mode</strong><span>Band, cell info, APN và network mode chỉ xuất hiện sau khi capability tương ứng được VERIFIED.</span></div>` : ""}
  </section>`;
}

function renderWifi() {
  const d = state.demoMode ? state.demo : null;
  return `${renderTopbar("Wi-Fi", "Đọc setting trước khi edit; không ghi đè trường không liên quan.")}
  <section class="panel"><div class="panel-head"><div><span>BASIC</span><h2>Wi-Fi</h2></div>${d ? statusPill("DEMO DATA","warn") : statusPill("WRITE LOCKED")}</div>
    <div class="form-grid"><label>SSID<input value="${d ? esc(d.wifi.ssid) : ""}" disabled placeholder="Chờ endpoint VERIFIED" /></label><label>Mật khẩu<input type="password" disabled placeholder="Không lưu plaintext" /></label></div>
    <div class="write-lock"><strong>Thao tác ghi đang khóa.</strong><span>setWifiSettings/setWifiPassword chỉ được bật sau HAR + request/response thật + regression test.</span></div>
    ${state.uiMode === UI_MODE.ADVANCED ? `<div class="advanced-note"><strong>Advanced Wi-Fi</strong><span>Channel, bandwidth, security, hidden SSID, transmit settings và WPS chưa hiện thành control vì API chưa xác minh.</span></div>` : ""}
  </section>`;
}

function renderDevices() {
  const rows = state.demoMode ? state.demo?.clients ?? [] : [];
  return `${renderTopbar("Thiết bị", "Danh sách client thật và block/unblock phải đi qua NC03Adapter.")}
  <section class="panel"><div class="panel-head"><div><span>CONNECTED CLIENTS</span><h2>${rows.length ? `${rows.length} thiết bị mẫu` : "Chưa có dữ liệu thật"}</h2></div>${rows.length ? statusPill("DEMO DATA","warn") : statusPill("UNKNOWN")}</div>
  <div class="device-list">${rows.length ? rows.map(r=>`<article><div class="device-icon">◆</div><div><strong>${esc(r.name)}</strong><span>${esc(r.ip)} · ${esc(r.band)}</span></div><div><span>${esc(r.mac)}</span><strong>${esc(r.state)}</strong></div></article>`).join("") : `<div class="empty">Client API chưa được xác minh. Không hiển thị thiết bị giả trong chế độ thường.</div>`}</div></section>`;
}

function capabilityRows() {
  return DEFAULT_CAPABILITIES.map(row => `<tr><td>${esc(row.module)}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td><span class="table-status">${esc(row.status)}</span></td></tr>`).join("");
}

function renderDiscovery() {
  if (!state.developerMode) return renderSettings();
  return `${renderTopbar("API Discovery", "Developer Mode: HAR chỉ được xử lý cục bộ và mọi credential phải được che.")}
  <section class="panel discovery-panel"><div class="panel-head"><div><span>ADVANCED DEVELOPER MODE</span><h2>Phân tích Web UI gốc NC03</h2></div>${statusPill(`${state.harEntries.length} request`)}</div>
    <div class="import-box"><input id="harInput" type="file" accept=".har,application/json"/><div><strong>Chọn file HAR từ DevTools</strong><span>File chỉ được đọc trong trình duyệt hiện tại. Không upload ra cloud.</span></div></div>
    ${state.discoveryError ? `<div class="inline-error">${esc(state.discoveryError)}</div>` : ""}
    ${state.harCandidates.length ? `<div class="candidate-list">${state.harCandidates.map(c=>`<article><span class="method">${esc(c.method)}</span><code>${esc(c.path)}</code><small>${c.count} lần · HTTP ${esc(c.statuses.join(", "))} · ~${c.avgMs} ms</small></article>`).join("")}</div>` : `<div class="empty">Chưa có HAR thật. Network → Fetch/XHR → Export HAR with content rồi nhập tại đây.</div>`}
  </section>
  <section class="panel"><div class="panel-head"><div><span>CAPABILITY MATRIX</span><h2>Trạng thái endpoint</h2></div><p>Chỉ VERIFIED / WRITE VERIFIED mới được dùng chính thức.</p></div><div class="table-wrap"><table><thead><tr><th>Module</th><th>Read</th><th>Write</th><th>Endpoint</th><th>Method</th><th>Auth</th><th>Status</th></tr></thead><tbody>${capabilityRows()}</tbody></table></div></section>`;
}

function renderSettings() {
  const developerPanel = state.developerMode ? `
    <section class="panel"><div class="panel-head"><div><span>ADVANCED DEVELOPER MODE</span><h2>Discovery & Mock</h2></div>${statusPill("LOCAL TOOLING","warn")}</div>
      <p class="body-copy">Developer Mode chỉ dùng reverse-engineering firmware, automated test và screenshot. DEMO DATA không được xem là dữ liệu modem thật.</p>
      <div class="settings-actions"><button id="openDiscovery">Mở API Discovery</button><label class="demo-switch"><input id="demoToggle" type="checkbox" ${state.demoMode ? "checked" : ""}/><span>Mock Mode · DEMO DATA</span></label></div>
    </section>` : "";

  return `${renderTopbar("Cài đặt", "Basic mặc định; Advanced và Developer được tách khỏi tác vụ phổ thông.")}
  <section class="panel"><div class="panel-head"><div><span>INTERFACE MODE</span><h2>Chế độ giao diện</h2></div>${statusPill(state.uiMode === UI_MODE.ADVANCED ? "ADVANCED" : "BASIC")}</div>
    <div class="mode-selector">
      <button data-ui-mode="basic" data-active="${state.uiMode === UI_MODE.BASIC}"><strong>Basic Mode</strong><span>Internet · Signal · Battery · Wi-Fi · Devices · Data</span></button>
      <button data-ui-mode="advanced" data-active="${state.uiMode === UI_MODE.ADVANCED}"><strong>Advanced Mode</strong><span>Chỉ hiện năng lực nâng cao khi capability đã xác minh</span></button>
    </div>
  </section>
  <section class="panel"><div class="panel-head"><div><span>MODEM CONNECTION</span><h2>Địa chỉ NC03</h2></div>${statusPill("LOCAL ONLY")}</div>
    <div class="form-grid"><label>Modem address<input id="baseUrl" value="${esc(state.baseUrl)}" inputmode="url" /></label><label>Admin password<input type="password" disabled placeholder="Chờ auth/session VERIFIED" /></label></div>
    <div class="settings-actions"><button id="saveBaseUrl">Lưu địa chỉ</button></div>
    <div class="security-note"><strong>Credential policy</strong><span>${esc(SECURITY_NOTE)}</span></div>
  </section>
  <section class="panel"><div class="panel-head"><div><span>DEVELOPER</span><h2>Advanced Developer Mode</h2></div>${statusPill(state.developerMode ? "ENABLED" : "OFF")}</div>
    <label class="developer-toggle"><input id="developerToggle" type="checkbox" ${state.developerMode ? "checked" : ""}/><span><strong>Bật công cụ reverse-engineering</strong><small>Hiện API Discovery và Mock Mode. Không bật API ghi.</small></span></label>
  </section>
  ${developerPanel}
  <section class="panel"><div class="panel-head"><div><span>WEB RUNTIME LIMIT</span><h2>HTTPS → modem HTTP</h2></div>${statusPill("ARCHITECTURE")}</div><p class="body-copy">Website host HTTPS có thể bị browser chặn khi gọi trực tiếp <code>http://192.168.0.1</code> vì mixed-content/CORS. Sau HAR thật, transport phải được xác minh là Direct LAN hoặc Local Bridge chạy trên thiết bị người dùng. Manager app không proxy credential modem.</p></section>`;
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

function bind() {
  document.querySelector("#saveLoginAddress")?.addEventListener("click", () => {
    const input = document.querySelector("#loginBaseUrl");
    if (!input) return;
    state.baseUrl = input.value.trim() || "http://192.168.0.1";
    persist();
    page();
  });

  document.querySelector("#enterDemo")?.addEventListener("click", async () => {
    const input = document.querySelector("#loginBaseUrl");
    if (input) state.baseUrl = input.value.trim() || "http://192.168.0.1";
    state.developerMode = true;
    state.demoMode = true;
    persist();
    await ensureDemo();
    state.view = "home";
    page();
  });

  document.querySelectorAll("[data-nav]").forEach((button) => button.addEventListener("click", () => {
    state.view = button.dataset.nav;
    page();
  }));

  document.querySelectorAll("[data-ui-mode]").forEach((button) => button.addEventListener("click", () => {
    state.uiMode = button.dataset.uiMode === "advanced" ? UI_MODE.ADVANCED : UI_MODE.BASIC;
    persist();
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
    page();
  });

  document.querySelector("#saveBaseUrl")?.addEventListener("click", () => {
    const input = document.querySelector("#baseUrl");
    if (!input) return;
    state.baseUrl = input.value.trim() || "http://192.168.0.1";
    persist();
    page();
  });

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
page();
