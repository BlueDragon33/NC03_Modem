const KEY = "nc03-control-center:preferences:v2";

const DEFAULTS = Object.freeze({
  baseUrl: "http://192.168.0.1",
  demoMode: false,
  developerMode: false,
  uiMode: "basic",
  rememberPassword: true
});

export function loadPreferences(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : DEFAULTS.baseUrl,
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
    baseUrl: typeof preferences.baseUrl === "string" ? preferences.baseUrl : DEFAULTS.baseUrl,
    demoMode: preferences.demoMode === true,
    developerMode: preferences.developerMode === true,
    uiMode: preferences.uiMode === "advanced" ? "advanced" : "basic",
    rememberPassword: preferences.rememberPassword !== false
  };
  storage?.setItem(KEY, JSON.stringify(safe));
  return safe;
}

export const SECURITY_NOTE = "Mật khẩu chỉ được lưu sau khi đăng nhập thành công, trong credential vault mã hóa cục bộ; không lưu vào localStorage/sessionStorage và không gửi lên cloud.";
