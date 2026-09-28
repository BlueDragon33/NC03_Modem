const SAFE_PATH = /^\/[A-Za-z0-9_./-]+(?:\.html|\.js)?$/i;
const ACTION_ROUTE = /\/(?:action|goform)\/[A-Za-z0-9_./-]+/g;
const HTML_REF = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
const SCRIPT_REF = /\b(?:src|href)\s*=\s*["']([^"'#?]+\.js(?:\?[^"']*)?)["']/gi;
const CONTROL_TAG = /<(input|select|textarea|button)\b([^>]*)>/gi;
const NAV_ANCHOR = /<a\b([^>]*)\bhref\s*=\s*["']([^"']+\.html(?:#[^"']*)?)["']([^>]*)>([\s\S]*?)<\/a>/gi;

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function stripTags(value) {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function safeLabel(value) {
  const text = stripTags(value);
  if (!text || text.length > 120) return null;
  if (/[\r\n]/.test(text)) return null;
  if (/^[A-Fa-f0-9:.-]{12,}$/.test(text)) return null;
  return text;
}

function attr(attrs, name) {
  const re = new RegExp("\\b" + name + "\\s*=\\s*([\"'])(.*?)\\1", "i");
  return re.exec(String(attrs ?? ""))?.[2] ?? null;
}

function normalizeRef(ref, sourcePath = "/") {
  const raw = String(ref ?? "").trim();
  if (!raw || /^https?:\/\//i.test(raw) || raw.startsWith("//") || raw.startsWith("javascript:")) return null;
  try {
    const url = new URL(raw, "http://nc03.local" + (sourcePath.startsWith("/") ? sourcePath : "/" + sourcePath));
    const path = url.pathname;
    return SAFE_PATH.test(path) ? path : null;
  } catch {
    return null;
  }
}

function extractRefs(source, sourcePath) {
  const html = [];
  const scripts = [];
  for (const match of String(source ?? "").matchAll(HTML_REF)) {
    const path = normalizeRef(match[1], sourcePath);
    if (path && (path.endsWith(".html") || path === "/")) html.push(path);
  }
  for (const match of String(source ?? "").matchAll(SCRIPT_REF)) {
    const path = normalizeRef(match[1], sourcePath);
    if (path && path.endsWith(".js")) scripts.push(path);
  }
  return { pageRefs:unique(html), scriptRefs:unique(scripts) };
}

function extractControls(source, sourcePath) {
  const controls = [];
  for (const match of String(source ?? "").matchAll(CONTROL_TAG)) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] ?? "";
    const id = attr(attrs, "id");
    const name = attr(attrs, "name");
    const type = tag === "input" ? (attr(attrs, "type") || "text").toLowerCase() : tag;
    const i18n = attr(attrs, "data-i18n") || attr(attrs, "lang-id") || attr(attrs, "i18n");
    const placeholder = safeLabel(attr(attrs, "placeholder"));
    const title = safeLabel(attr(attrs, "title"));
    if (!id && !name && !i18n && !placeholder && !title) continue;
    controls.push({
      sourcePath,
      tag,
      type,
      id:id || null,
      name:name || null,
      i18n:i18n || null,
      labelHint:title || placeholder || null,
      sensitive:/pass|psk|pin|secret|token|cookie|session/i.test([id,name,i18n,placeholder,title].filter(Boolean).join(" "))
    });
  }
  return controls;
}

function extractNavigation(source, sourcePath) {
  const rows = [];
  for (const match of String(source ?? "").matchAll(NAV_ANCHOR)) {
    const path = normalizeRef(match[2], sourcePath);
    if (!path) continue;
    const label = safeLabel(match[4]);
    rows.push({ sourcePath, path, label:label || null });
  }
  return rows;
}

function sourceKind(path) {
  if (String(path).endsWith(".html") || path === "/") return "html";
  if (String(path).endsWith(".js")) return "javascript";
  return "text";
}

export function buildStockWebUiAudit(sources = []) {
  const sourceRows = [];
  const allPages = [];
  const allScripts = [];
  const allRoutes = [];
  const allControls = [];
  const allNavigation = [];

  for (const item of sources) {
    const path = String(item?.path ?? "");
    const source = String(item?.source ?? "");
    if (!path || !source) continue;
    const refs = extractRefs(source, path);
    const routes = unique(source.match(ACTION_ROUTE) ?? []);
    const controls = sourceKind(path) === "html" ? extractControls(source, path) : [];
    const navigation = sourceKind(path) === "html" ? extractNavigation(source, path) : [];

    sourceRows.push({
      path,
      kind:sourceKind(path),
      pageRefCount:refs.pageRefs.length,
      scriptRefCount:refs.scriptRefs.length,
      actionRouteCount:routes.length,
      controlCount:controls.length
    });
    allPages.push(...refs.pageRefs);
    allScripts.push(...refs.scriptRefs);
    allRoutes.push(...routes);
    allControls.push(...controls);
    allNavigation.push(...navigation);
  }

  const sourcePaths = unique(sourceRows.map((row) => row.path));
  const pagePaths = unique([
    ...sourcePaths.filter((path) => path === "/" || path.endsWith(".html")),
    ...allPages
  ]).sort();
  const scriptPaths = unique([
    ...sourcePaths.filter((path) => path.endsWith(".js")),
    ...allScripts
  ]).sort();
  const actionRoutes = unique(allRoutes).sort();
  const controlKeys = unique(allControls.map((item) => item.id || item.name || item.i18n || item.labelHint));
  const sensitiveControlCount = allControls.filter((item) => item.sensitive).length;

  return {
    schema:"nc03-stock-webui-audit/v2",
    privacy:"STRUCTURE_ONLY_NO_CONTROL_VALUES",
    sourcePaths,
    sourceRows,
    pagePaths,
    scriptPaths,
    actionRoutes,
    navigation:allNavigation,
    controls:allControls,
    summary:{
      sourceCount:sourceRows.length,
      pageCount:pagePaths.length,
      scriptCount:scriptPaths.length,
      actionRouteCount:actionRoutes.length,
      controlCount:allControls.length,
      uniqueControlKeyCount:controlKeys.length,
      sensitiveControlCount
    }
  };
}

export function stockUiAuditDiscoveryPaths(audit, { maxPages = 48, maxScripts = 96 } = {}) {
  const pages = (audit?.pagePaths ?? [])
    .filter((path) => path === "/" || path.endsWith(".html"))
    .filter((path) => SAFE_PATH.test(path))
    .slice(0, maxPages);
  const scripts = (audit?.scriptPaths ?? [])
    .filter((path) => path.endsWith(".js"))
    .filter((path) => SAFE_PATH.test(path))
    .slice(0, maxScripts);
  return unique([...pages, ...scripts]);
}
