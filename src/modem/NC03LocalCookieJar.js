function splitSetCookieHeader(raw = "") {
  const value = String(raw ?? "");
  if (!value) return [];
  const out = [];
  let start = 0;
  let inExpires = false;
  for (let i = 0; i < value.length; i += 1) {
    const lower = value.slice(i, i + 8).toLowerCase();
    if (lower === "expires=") inExpires = true;
    const ch = value[i];
    if (inExpires && ch === ";") inExpires = false;
    if (ch === "," && !inExpires) {
      const rest = value.slice(i + 1);
      if (/^\s*[^=;,\s]+\s*=/.test(rest)) {
        out.push(value.slice(start, i).trim());
        start = i + 1;
      }
    }
  }
  out.push(value.slice(start).trim());
  return out.filter(Boolean);
}

function setCookieValues(headers) {
  if (!headers) return [];
  if (typeof headers.getSetCookie === "function") {
    const values = headers.getSetCookie();
    if (Array.isArray(values)) return values.filter(Boolean);
  }
  const raw = typeof headers.get === "function" ? headers.get("set-cookie") : null;
  return splitSetCookieHeader(raw);
}

function parseCookie(setCookie) {
  const parts = String(setCookie ?? "").split(";").map((part) => part.trim()).filter(Boolean);
  const pair = parts.shift() ?? "";
  const equals = pair.indexOf("=");
  if (equals <= 0) return null;

  const name = pair.slice(0, equals).trim();
  const value = pair.slice(equals + 1).trim();
  if (!name) return null;

  const attributes = new Map();
  for (const part of parts) {
    const index = part.indexOf("=");
    const key = (index >= 0 ? part.slice(0, index) : part).trim().toLowerCase();
    const attrValue = index >= 0 ? part.slice(index + 1).trim() : "";
    attributes.set(key, attrValue);
  }

  const maxAge = Number(attributes.get("max-age"));
  const expires = attributes.get("expires");
  const expiredByAge = attributes.has("max-age") && Number.isFinite(maxAge) && maxAge <= 0;
  const expiresAt = expires ? Date.parse(expires) : NaN;
  const expiredByDate = Number.isFinite(expiresAt) && expiresAt <= Date.now();

  return { name, value, expired: value === "" || expiredByAge || expiredByDate };
}

export class NC03LocalCookieJar {
  constructor() {
    this.cookies = new Map();
  }

  clear() {
    this.cookies.clear();
  }

  absorb(headers) {
    for (const header of setCookieValues(headers)) {
      const parsed = parseCookie(header);
      if (!parsed) continue;
      if (parsed.expired) this.cookies.delete(parsed.name);
      else this.cookies.set(parsed.name, parsed.value);
    }
  }

  header() {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  get size() {
    return this.cookies.size;
  }
}

export function createCookieAwareFetch({ fetchImpl = globalThis.fetch, jar = new NC03LocalCookieJar() } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("LOGIN_TRANSPORT_UNAVAILABLE");

  const wrappedFetch = async (url, init = {}) => {
    const headers = new Headers(init.headers ?? {});
    const cookie = jar.header();
    if (cookie && !headers.has("cookie")) headers.set("cookie", cookie);

    const response = await fetchImpl(url, { ...init, headers });
    jar.absorb(response?.headers);
    return response;
  };

  return { fetchImpl:wrappedFetch, jar };
}
