const SENSITIVE_HEADER = /authorization|cookie|set-cookie|csrf|token|password|secret|session/i;
const SENSITIVE_QUERY = /password|passwd|pwd|token|session|sid|csrf|secret|auth/i;
const AUTH_FIELD = /password|passwd|pwd|login|auth|session|token|csrf|challenge/i;
const WRITE_PATH = /(?:^|\/)(?:[^/]*_set_[^/]*|set|save|apply|reboot|restart|clear|update|schedule)(?:\/|$)|\/(?:reboot|restart)$/i;

const CANDIDATE_RULES = Object.freeze([
  ["auth", /login|logout|auth|signin|session|csrf|challenge/],
  ["battery", /battery|power|charge|charging|eco/],
  ["wifi", /wifi|wlan|ssid|wireless|wps/],
  ["clients", /client|station|sta_list|connected.?device|device.?list/],
  ["mobile-network", /signal|rsrp|rsrq|sinr|cell|band|network.?mode|carrier|wan|lte|5g|nr5g/],
  ["data-usage", /traffic|usage|quota|data.?counter|statistics|statistic/],
  ["dhcp-lan", /dhcp|lan.?ip|lease|subnet/],
  ["bridge-router", /bridge|router.?mode|nat.?mode/],
  ["system", /reboot|restart|firmware|software.?version|device.?info|status/]
]);

function contentType(headers = []) {
  return String(headers.find((header) => String(header?.name ?? "").toLowerCase() === "content-type")?.value ?? "");
}

function collectJsonFields(value, prefix = "", fields = new Set(), depth = 0) {
  if (!value || typeof value !== "object" || depth > 4) return fields;
  for (const [key, child] of Object.entries(value)) {
    const field = prefix ? `${prefix}.${key}` : key;
    fields.add(field);
    if (child && typeof child === "object") collectJsonFields(child, field, fields, depth + 1);
    if (fields.size >= 80) break;
  }
  return fields;
}

export function describeBody(text = "", mimeType = "") {
  if (!text) return { kind:"empty", fields:[] };
  try {
    const parsed = JSON.parse(text);
    return { kind:"json", fields:[...collectJsonFields(parsed)].sort() };
  } catch {}

  const looksForm = /application\/x-www-form-urlencoded/i.test(mimeType) || /(?:^|&)[^=&\s]+=[^&]*/.test(text);
  if (looksForm) {
    try {
      const params = new URLSearchParams(text);
      const fields = [...new Set([...params.keys()].map(String))].sort();
      if (fields.length) return { kind:"form", fields };
    } catch {}
  }

  return { kind:SENSITIVE_QUERY.test(text) ? "redacted-text" : "text", fields:[] };
}

export function redactHeaders(headers = []) {
  return headers.map((header) => ({
    name: String(header?.name ?? ""),
    value: SENSITIVE_HEADER.test(String(header?.name ?? "")) ? "****" : String(header?.value ?? "")
  }));
}

export function redactUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    for (const [key] of url.searchParams) {
      if (SENSITIVE_QUERY.test(key)) url.searchParams.set(key, "****");
    }
    return url.toString();
  } catch {
    return String(rawUrl ?? "");
  }
}

export function sanitizeBody(text = "", mimeType = "") {
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    const scrub = (value) => {
      if (Array.isArray(value)) return value.map(scrub);
      if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, SENSITIVE_QUERY.test(key) ? "****" : scrub(child)]));
      }
      return value;
    };
    return JSON.stringify(scrub(parsed));
  } catch {}

  const looksForm = /application\/x-www-form-urlencoded/i.test(mimeType) || /(?:^|&)[^=&\s]+=[^&]*/.test(text);
  if (looksForm) {
    try {
      const params = new URLSearchParams(text);
      let found = false;
      for (const [key] of params) {
        found = true;
        if (SENSITIVE_QUERY.test(key)) params.set(key, "****");
      }
      if (found) return params.toString().slice(0, 500);
    } catch {}
  }

  return SENSITIVE_QUERY.test(text) ? "[REDACTED BODY]" : text.slice(0, 500);
}

export function classifyHarCandidate({ url = "", path = "", requestBody = "" } = {}) {
  const source = `${url} ${path} ${requestBody}`.toLowerCase();
  return CANDIDATE_RULES.filter(([, pattern]) => pattern.test(source)).map(([name]) => name);
}

export function parseHar(har, { modemHost = "192.168.0.1" } = {}) {
  const entries = Array.isArray(har?.log?.entries) ? har.log.entries : [];
  return entries
    .filter((entry) => {
      try { return new URL(entry?.request?.url ?? "").hostname === modemHost; }
      catch { return false; }
    })
    .map((entry, index) => {
      const request = entry.request ?? {};
      const response = entry.response ?? {};
      const rawUrl = request.url ?? "";
      const rawBody = request.postData?.text ?? "";
      const responseBody = response.content?.text ?? "";
      const path = (() => { try { return new URL(rawUrl).pathname; } catch { return ""; } })();
      const requestMime = request.postData?.mimeType || contentType(request.headers);
      const responseMime = response.content?.mimeType || contentType(response.headers);
      const requestDescription = describeBody(rawBody, requestMime);
      const responseDescription = describeBody(responseBody, responseMime);
      const requestHeaderNames = (request.headers ?? []).map((header) => String(header?.name ?? "").toLowerCase());
      const responseHeaderNames = (response.headers ?? []).map((header) => String(header?.name ?? "").toLowerCase());
      return {
        id: index + 1,
        method: String(request.method ?? "GET").toUpperCase(),
        url: redactUrl(rawUrl),
        path,
        requestHeaders: redactHeaders(request.headers),
        requestBody: sanitizeBody(rawBody, requestMime),
        requestBodyKind: requestDescription.kind,
        requestFields: requestDescription.fields,
        responseBodyKind: responseDescription.kind,
        responseFields: responseDescription.fields,
        requestContentType: String(requestMime || ""),
        responseContentType: String(responseMime || ""),
        requestHasAuthorization: requestHeaderNames.includes("authorization"),
        requestHasCookie: requestHeaderNames.includes("cookie"),
        responseSetsCookie: responseHeaderNames.includes("set-cookie"),
        responseRedirect: [301,302,303,307,308].includes(Number(response.status ?? 0)),
        hints: classifyHarCandidate({ url: rawUrl, path, requestBody: rawBody }),
        status: Number(response.status ?? 0),
        mimeType: String(response.content?.mimeType ?? ""),
        responseSize: Number(response.content?.size ?? 0),
        timeMs: Number(entry.time ?? 0)
      };
    });
}

export function summarizeCandidates(entries) {
  const grouped = new Map();
  for (const item of entries) {
    const key = `${item.method} ${item.path}`;
    const current = grouped.get(key) ?? {
      method: item.method,
      path: item.path,
      count: 0,
      statuses: new Set(),
      hints: new Set(),
      avgMs: 0
    };
    current.count += 1;
    current.statuses.add(item.status);
    for (const hint of item.hints ?? []) current.hints.add(hint);
    current.avgMs += item.timeMs;
    grouped.set(key, current);
  }
  return [...grouped.values()].map((item) => ({
    method: item.method,
    path: item.path,
    count: item.count,
    statuses: [...item.statuses].sort((a, b) => a - b),
    hints: [...item.hints].sort(),
    avgMs: Math.round(item.avgMs / Math.max(item.count, 1))
  })).sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
}

export function summarizeAuthCandidates(entries) {
  return entries.map((item) => {
    const reasons = [];
    if ((item.hints ?? []).includes("auth")) reasons.push("auth-path-or-body-hint");
    if ((item.requestFields ?? []).some((field) => AUTH_FIELD.test(field))) reasons.push("auth-field-name");
    if (item.requestHasAuthorization) reasons.push("authorization-header-present");
    if (item.responseSetsCookie) reasons.push("set-cookie-present");
    if (item.responseRedirect) reasons.push("redirect-response");
    if (item.status >= 200 && item.status < 400) reasons.push("http-success-range");
    return {
      id:item.id,
      method:item.method,
      path:item.path,
      status:item.status,
      requestBodyKind:item.requestBodyKind,
      requestFields:item.requestFields ?? [],
      responseBodyKind:item.responseBodyKind,
      responseFields:item.responseFields ?? [],
      evidence:reasons,
      verified:false,
      statusLabel:"CANDIDATE_ONLY"
    };
  }).filter((item) => item.evidence.some((reason) => reason !== "http-success-range") && (
    item.evidence.includes("auth-path-or-body-hint") ||
    item.evidence.includes("auth-field-name") ||
    item.evidence.includes("authorization-header-present") ||
    item.evidence.includes("set-cookie-present")
  ));
}

export function summarizeWriteCandidates(entries) {
  return entries
    .filter((item) => item.method !== "GET" && WRITE_PATH.test(item.path))
    .map((item) => ({
      id:item.id,
      method:item.method,
      path:item.path,
      status:item.status,
      hints:item.hints ?? [],
      requestBodyKind:item.requestBodyKind,
      requestFields:item.requestFields ?? [],
      verified:false,
      statusLabel:"CANDIDATE_ONLY"
    }));
}

export function buildHarEvidenceReport(har, { modemHost = "192.168.0.1" } = {}) {
  const entries = parseHar(har, { modemHost });
  return {
    schema:"nc03-har-evidence/v1",
    modemHost,
    entryCount:entries.length,
    candidates:summarizeCandidates(entries),
    authCandidates:summarizeAuthCandidates(entries),
    writeCandidates:summarizeWriteCandidates(entries),
    safety:{
      secretsRedacted:true,
      candidatesAreNotVerified:true,
      writeControlsMayBeEnabledFromThisReport:false
    }
  };
}
