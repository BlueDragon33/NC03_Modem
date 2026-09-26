import { DEFAULT_NC03_ORIGIN, normalizeModemBaseUrl } from "./LocalBridgePolicy.js";

export const DEFAULT_MODEM_URL = DEFAULT_NC03_ORIGIN;

export const LOGIN_POLICY = Object.freeze({
  usernameRequired: false,
  rememberPasswordDefault: true,
  persistCredentialOnlyAfterAuthenticated: true,
  reuseRememberedCredentialOnNextLaunch: true
});

export function normalizeModemAddress(value) {
  return normalizeModemBaseUrl(value);
}
