const KEY = "nc03-control-center:preferences:v1";

export function loadPreferences(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return { baseUrl: "http://192.168.0.1", demoMode: false };
    const parsed = JSON.parse(raw);
    return {
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "http://192.168.0.1",
      demoMode: parsed.demoMode === true
    };
  } catch {
    return { baseUrl: "http://192.168.0.1", demoMode: false };
  }
}

export function savePreferences(preferences, storage = globalThis.localStorage) {
  const safe = { baseUrl: preferences.baseUrl, demoMode: preferences.demoMode === true };
  storage?.setItem(KEY, JSON.stringify(safe));
  return safe;
}

export const SECURITY_NOTE = "Không lưu admin password trong localStorage/sessionStorage. Credential storage chỉ được triển khai sau khi xác minh auth flow.";
