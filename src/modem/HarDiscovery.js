const SENSITIVE_HEADER = /authorization|cookie|set-cookie|csrf|token|password|secret|session/i;
const SENSITIVE_QUERY = /password|passwd|pwd|token|session|sid|csrf|secret|auth/i;

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

export function sanitizeBody(text = "") {
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
  } catch {
    return SENSITIVE_QUERY.test(text) ? "[REDACTED BODY]" : text.slice(0, 500);
  }
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
      return {
        id: index + 1,
        method: String(request.method ?? "GET").toUpperCase(),
        url: redactUrl(request.url ?? ""),
        path: (() => { try { return new URL(request.url ?? "").pathname; } catch { return ""; } })(),
        requestHeaders: redactHeaders(request.headers),
        requestBody: sanitizeBody(request.postData?.text ?? ""),
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
    const current = grouped.get(key) ?? { method: item.method, path: item.path, count: 0, statuses: new Set(), avgMs: 0 };
    current.count += 1;
    current.statuses.add(item.status);
    current.avgMs += item.timeMs;
    grouped.set(key, current);
  }
  return [...grouped.values()].map((item) => ({
    method: item.method,
    path: item.path,
    count: item.count,
    statuses: [...item.statuses].sort((a, b) => a - b),
    avgMs: Math.round(item.avgMs / Math.max(item.count, 1))
  })).sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
}
