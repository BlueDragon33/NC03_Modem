import { DEFAULT_NC03_ORIGIN, normalizeModemBaseUrl } from "./LocalBridgePolicy.js";

const KEY = "nc03-control-center:preferences:v2";

const DEFAULTS = Object.freeze({
  baseUrl: DEFAULT_NC03_ORIGIN,
  demoMode: false,
  developerMode: false,
  uiMode: "basic",
  rememberPassword: true
});

function safeBaseUrl(value) {
  try {
    return normalizeModemBaseUrl(value);
  } catch {
    return DEFAULTS.baseUrl;
  }
}

export function loadPreferences(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      baseUrl: safeBaseUrl(parsed.baseUrl),
      demoMode: parsed.demoMode === true,
      developerMode: parsed.developerMode === true,
      uiMode: parsed.uiMode === "advanced" ? "advanced" : "basic",
      rememberPassword: parsed.rememberPassword !== false
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePreferences(preferences, storage = globalThis.localStorage) {
  const safe = {
    baseUrl: safeBaseUrl(preferences.baseUrl),
    demoMode: preferences.demoMode === true,
    developerMode: preferences.developerMode === true,
    uiMode: preferences.uiMode === "advanced" ? "advanced" : "basic",
    rememberPassword: preferences.rememberPassword !== false
  };
  storage?.setItem(KEY, JSON.stringify(safe));
  return safe;
}

export const SECURITY_NOTE = "Mật khẩu chỉ được lưu sau khi đăng nhập thành công, trong credential vault mã hóa cục bộ; không lưu vào localStorage/sessionStorage và không gửi lên cloud.";
