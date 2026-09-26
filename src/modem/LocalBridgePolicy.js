export const DEFAULT_NC03_ORIGIN = "http://192.168.0.1";

export function isPrivateLanIpv4(hostname) {
  const parts = String(hostname ?? "").split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return parts[0] === 192 && parts[1] === 168;
}

export function normalizeModemBaseUrl(value) {
  const raw = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_NC03_ORIGIN;
  const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`);

  if (!["http:", "https:"].includes(url.protocol)) throw new Error("MODEM_SCHEME_NOT_ALLOWED");
  if (!isPrivateLanIpv4(url.hostname)) throw new Error("MODEM_ORIGIN_NOT_PRIVATE_LAN");
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== "/")) {
    throw new Error("MODEM_ORIGIN_INVALID");
  }
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("MODEM_PORT_NOT_ALLOWED");

  return url.origin;
}
