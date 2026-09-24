import { MockNC03Adapter } from "./src/modem/MockNC03Adapter.js";
import { DEFAULT_CAPABILITIES } from "./src/modem/CapabilityRegistry.js";
import { parseHar, summarizeCandidates } from "./src/modem/HarDiscovery.js";
import { loadPreferences, savePreferences, SECURITY_NOTE } from "./src/modem/LocalPreferences.js";

const app = document.querySelector("#app");
const prefs = loadPreferences();
let state = {
  view: "home",
  demoMode: prefs.demoMode,
  baseUrl: prefs.baseUrl,
  harCandidates: [],
  harEntries: [],
  demo: null
};

const navItems = [
  ["home", "Tổng quan"],
  ["network", "Mạng"],
  ["wifi", "Wi-Fi"],
  ["devices", "Thiết bị"],
  ["discovery", "Discovery"],
  ["settings", "Cài đặt"]
];

function esc(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function statusPill(label, tone = "muted") { return `<span class="pill" data-tone="${tone}">${esc(label)}</span>`; }

function renderSidebar() {
  return `<aside class="sidebar">
    <div class="brand"><div class="brand-mark">N3</div><div><small>HYBRID Wi-Fi 5G</small><strong>NC03 Control Center</strong></div></div>
    <div class="connection-card">
      <div class="connection-row"><span class="dot" data-on="${state.demoMode}"></span><div><small>Trạng thái</small><strong>${state.demoMode ? "Demo Mode" : "Chờ API thật"}</strong></div></div>
      <div class="connection-address">${esc(state.baseUrl)}</div>
    </div>
    <nav>${navItems.map(([id,label]) => `<button data-nav="${id}" data-active="${state.view === id}"><span>${label}</span></button>`).join("")}</nav>
    <div class="sidebar-foot"><strong>Phase 1 · Foundation</strong><span>Write API đang khóa</span></div>
  </aside>`;
}

function renderTopbar(title, subtitle) {
  return `<header class="topbar"><div><small>NC03 / ${esc(title).toUpperCase()}</small><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
  <div class="top-actions"><label class="demo-switch"><input id="demoToggle" type="checkbox" ${state.demoMode ? "checked" : ""}/><span>Demo data</span></label>${state.demoMode ? statusPill("DEMO DATA", "warn") : statusPill("NO VERIFIED API", "muted")}</div></header>`;
}

function metric(label, value, note, tone="") {
  return `<article class="metric" data-tone="${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;
}

function renderHome() {
  const d = state.demo;
  const has = state.demoMode && d;
  return `${renderTopbar("Tổng quan", "Thông tin quan trọng trước, cấu hình nâng cao để đúng chỗ của nó.")}
  <section class="hero-status">
    <div><span class="eyebrow">INTERNET</span><div class="hero-line"><span class="big-dot" data-on="${has}"></span><h2>${has ? esc(d.status.internet) : "Chưa kết nối dữ liệu thật"}</h2></div><p>${has ? `${esc(d.status.network)} · ${esc(d.status.carrier)}` : "Hãy nhập HAR thật ở Discovery để bắt đầu map API NC03."}</p></div>
    <div class="signal-bars" aria-label="signal"><i></i><i></i><i></i><i></i><i></i></div>
  </section>
  <section class="metrics-grid">
    ${metric("Mạng di động", has ? d.status.network : "—", has ? `RSRP ${d.signal.rsrp} dBm` : "Chưa xác minh endpoint", has ? "ok" : "")}
    ${metric("Pin", has ? `${d.battery.percentage}%` : "—", has ? (d.battery.charging ? "Đang sạc · Long-life ON" : "Không sạc") : "Không suy diễn % pin", has ? "ok" : "")}
    ${metric("Dữ liệu", has ? d.data.current : "—", has ? `${d.data.current} / ${d.data.quota}` : "Chưa có lịch sử thật", "")}
    ${metric("Thiết bị", has ? d.wifi.clients : "—", has ? `${d.wifi.clients} thiết bị đang kết nối` : "Chưa xác minh client API", "")}
  </section>
  <section class="panel"><div class="panel-head"><div><span>QUICK ACTIONS</span><h2>Đi tới tác vụ</h2></div><p>Các thao tác ghi modem chỉ xuất hiện sau khi endpoint WRITE VERIFIED.</p></div>
    <div class="quick-grid">${[["wifi","Wi-Fi"],["devices","Thiết bị"],["network","Mạng di động"],["discovery","API Discovery"],["settings","Bảo mật"]].map(([id,label])=>`<button data-nav="${id}"><strong>${label}</strong><span>Mở khu vực</span></button>`).join("")}</div>
  </section>`;
}

function renderNetwork() {
  const d = state.demoMode ? state.demo : null;
  return `${renderTopbar("Mạng", "Thông số radio chỉ hiển thị khi modem thực sự cung cấp.")}
  <section class="panel"><div class="panel-head"><div><span>MOBILE NETWORK</span><h2>${d ? esc(d.status.network) : "Chưa có dữ liệu"}</h2></div>${d ? statusPill("DEMO DATA","warn") : statusPill("UNKNOWN")}</div>
    <div class="spec-grid"><div><span>Carrier</span><strong>${d ? esc(d.status.carrier) : "—"}</strong></div><div><span>RSRP</span><strong>${d ? `${d.signal.rsrp} dBm` : "—"}</strong></div><div><span>RSRQ</span><strong>${d ? `${d.signal.rsrq} dB` : "—"}</strong></div><div><span>SINR</span><strong>${d ? `${d.signal.sinr} dB` : "—"}</strong></div></div>
  </section>`;
}

function renderWifi() {
  const d = state.demoMode ? state.demo : null;
  return `${renderTopbar("Wi-Fi", "Đọc setting trước, sửa đúng trường cần sửa, không ghi đè cấu hình vô can.")}
  <section class="panel"><div class="panel-head"><div><span>BASIC</span><h2>Wi-Fi</h2></div>${d ? statusPill("DEMO DATA","warn") : statusPill("WRITE LOCKED")}</div>
    <div class="form-grid"><label>SSID<input value="${d ? esc(d.wifi.ssid) : ""}" disabled placeholder="Chờ endpoint VERIFIED" /></label><label>Mật khẩu<input type="password" disabled placeholder="Không lưu plaintext" /></label></div>
    <div class="write-lock"><strong>Thao tác ghi đang khóa.</strong><span>setWifiSettings/setWifiPassword chỉ được bật sau HAR + request/response thật + regression test.</span></div>
  </section>`;
}

function renderDevices() {
  const rows = state.demoMode ? state.demo?.clients ?? [] : [];
  return `${renderTopbar("Thiết bị", "Danh sách client, trạng thái và quyền block/unblock sẽ đi qua NC03Adapter.")}
  <section class="panel"><div class="panel-head"><div><span>CONNECTED CLIENTS</span><h2>${rows.length ? `${rows.length} thiết bị mẫu` : "Chưa có dữ liệu thật"}</h2></div>${rows.length ? statusPill("DEMO DATA","warn") : statusPill("UNKNOWN")}</div>
  <div class="device-list">${rows.length ? rows.map(r=>`<article><div class="device-icon">◆</div><div><strong>${esc(r.name)}</strong><span>${esc(r.ip)} · ${esc(r.band)}</span></div><div><span>${esc(r.mac)}</span><strong>${esc(r.state)}</strong></div></article>`).join("") : `<div class="empty">Import HAR hoặc kết nối adapter thật để lấy danh sách thiết bị.</div>`}</div></section>`;
}

function capabilityRows() {
  return DEFAULT_CAPABILITIES.map(row => `<tr><td>${esc(row.module)}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td><span class="table-status">${esc(row.status)}</span></td></tr>`).join("");
}

function renderDiscovery() {
  return `${renderTopbar("API Discovery", "Phân tích HAR cục bộ, tự che token/cookie/password và không upload ra ngoài.")}
  <section class="panel discovery-panel"><div class="panel-head"><div><span>HAR IMPORT</span><h2>Phân tích Web UI gốc NC03</h2></div>${statusPill(`${state.harEntries.length} request`)}</div>
    <div class="import-box"><input id="harInput" type="file" accept=".har,application/json"/><div><strong>Chọn file HAR từ DevTools</strong><span>File chỉ được đọc trong trình duyệt hiện tại. Không gửi lên cloud.</span></div></div>
    ${state.harCandidates.length ? `<div class="candidate-list">${state.harCandidates.map(c=>`<article><span class="method">${esc(c.method)}</span><code>${esc(c.path)}</code><small>${c.count} lần · HTTP ${esc(c.statuses.join(", "))} · ~${c.avgMs} ms</small></article>`).join("")}</div>` : `<div class="empty">Chưa có HAR. Network → Fetch/XHR → Export HAR rồi nhập tại đây.</div>`}
  </section>
  <section class="panel"><div class="panel-head"><div><span>CAPABILITY MATRIX</span><h2>Trạng thái endpoint</h2></div><p>Chỉ VERIFIED / WRITE VERIFIED mới được dùng chính thức.</p></div><div class="table-wrap"><table><thead><tr><th>Module</th><th>Read</th><th>Write</th><th>Endpoint</th><th>Method</th><th>Auth</th><th>Status</th></tr></thead><tbody>${capabilityRows()}</tbody></table></div></section>`;
}

function renderSettings() {
  return `${renderTopbar("Cài đặt", "Bảo mật credential và môi trường kết nối.")}
  <section class="panel"><div class="panel-head"><div><span>MODEM CONNECTION</span><h2>Địa chỉ NC03</h2></div>${statusPill("LOCAL ONLY")}</div>
    <div class="form-grid"><label>Modem address<input id="baseUrl" value="${esc(state.baseUrl)}" inputmode="url" /></label><label>Admin password<input type="password" disabled placeholder="Mở khóa sau khi auth VERIFIED" /></label></div>
    <div class="settings-actions"><button id="saveBaseUrl">Lưu địa chỉ</button><button disabled>Đăng nhập</button></div>
    <div class="security-note"><strong>Credential policy</strong><span>${esc(SECURITY_NOTE)}</span></div>
  </section>
  <section class="panel"><div class="panel-head"><div><span>WEB RUNTIME LIMIT</span><h2>HTTPS → modem HTTP</h2></div>${statusPill("ARCHITECTURE")}</div><p class="body-copy">Website được host HTTPS có thể bị trình duyệt chặn khi gọi trực tiếp <code>http://192.168.0.1</code> vì mixed-content/CORS. Phase 2 sẽ xác minh firmware và chọn một trong hai đường: Direct LAN khi browser cho phép, hoặc Local Bridge chạy trên máy người dùng. Manager app tuyệt đối không proxy credential modem qua cloud.</p></section>`;
}

function page() {
  const content = state.view === "network" ? renderNetwork() : state.view === "wifi" ? renderWifi() : state.view === "devices" ? renderDevices() : state.view === "discovery" ? renderDiscovery() : state.view === "settings" ? renderSettings() : renderHome();
  app.innerHTML = `<div class="shell">${renderSidebar()}<main class="main">${content}</main><nav class="mobile-nav">${navItems.slice(0,5).map(([id,label])=>`<button data-nav="${id}" data-active="${state.view===id}">${label}</button>`).join("")}</nav></div>`;
  bind();
}

async function ensureDemo() {
  if (!state.demoMode) { state.demo = null; return; }
  const adapter = new MockNC03Adapter({ baseUrl: state.baseUrl });
  state.demo = {
    status: await adapter.getStatus(), battery: await adapter.getBattery(), signal: await adapter.getSignal(),
    wifi: await adapter.getWifiStatus(), clients: await adapter.getConnectedClients(), data: await adapter.getDataUsage()
  };
}

function bind() {
  document.querySelectorAll("[data-nav]").forEach((button) => button.addEventListener("click", () => {
    state.view = button.dataset.nav;
    page();
  }));
  document.querySelector("#demoToggle")?.addEventListener("change", async (event) => {
    state.demoMode = event.currentTarget.checked;
    savePreferences({ baseUrl: state.baseUrl, demoMode: state.demoMode });
    await ensureDemo();
    page();
  });
  document.querySelector("#saveBaseUrl")?.addEventListener("click", () => {
    const input = document.querySelector("#baseUrl");
    if (!input) return;
    state.baseUrl = input.value.trim() || "http://192.168.0.1";
    savePreferences({ baseUrl: state.baseUrl, demoMode: state.demoMode });
    page();
  });
  document.querySelector("#harInput")?.addEventListener("change", async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const har = JSON.parse(await file.text());
      state.harEntries = parseHar(har, { modemHost: new URL(state.baseUrl).hostname });
      state.harCandidates = summarizeCandidates(state.harEntries);
    } catch (error) {
      state.harEntries = [];
      state.harCandidates = [];
      alert(`Không đọc được HAR: ${error instanceof Error ? error.message : "Dữ liệu không hợp lệ"}`);
    }
    page();
  });
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
await ensureDemo();
page();
