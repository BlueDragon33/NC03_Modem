export const DEFAULT_MODEM_URL = "http://192.168.0.1";

export const LOGIN_POLICY = Object.freeze({
  usernameRequired: false,
  rememberPasswordDefault: true,
  persistCredentialOnlyAfterAuthenticated: true,
  reuseRememberedCredentialOnNextLaunch: true
});

export function normalizeModemAddress(value) {
  const raw = String(value ?? "").trim();
  const candidate = raw || DEFAULT_MODEM_URL;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(candidate) ? candidate : `http://${candidate}`;
  const url = new URL(withScheme);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Địa chỉ modem chỉ hỗ trợ HTTP/HTTPS.");
  }
  return url.origin;
}
