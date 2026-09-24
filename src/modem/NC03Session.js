const SENSITIVE_KEYS = /password|token|session|cookie|csrf|authorization|secret/i;

export class NC03Session {
  constructor() { this.clear(); }

  set({ token = null, csrf = null, expiresAt = null } = {}) {
    this.token = token;
    this.csrf = csrf;
    this.expiresAt = expiresAt;
    return this;
  }

  isExpired(now = Date.now()) {
    if (!this.expiresAt) return false;
    const expires = typeof this.expiresAt === "number" ? this.expiresAt : Date.parse(this.expiresAt);
    return Number.isFinite(expires) ? now >= expires : true;
  }

  clear() {
    this.token = null;
    this.csrf = null;
    this.expiresAt = null;
  }

  sanitized() {
    return { token: this.token ? "****" : null, csrf: this.csrf ? "****" : null, expiresAt: this.expiresAt ?? null };
  }
}

export function sanitizeSessionValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeSessionValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, SENSITIVE_KEYS.test(key) ? "****" : sanitizeSessionValue(child)]));
  }
  return value;
}
