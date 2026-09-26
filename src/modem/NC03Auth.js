import { UnsupportedCapabilityError } from "./NC03Adapter.js";

export class NC03Auth {
  constructor({
    baseUrl = "http://192.168.0.1",
    fetchImpl = globalThis.fetch,
    session
  } = {}) {
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
    this.session = session;
  }

  supportsPersistentPassword() {
    return false;
  }

  clearLocalSession() {
    this.session?.clear?.();
  }

  async login({ username, password } = {}) {
    if (typeof this.fetchImpl !== "function") throw new Error("LOCAL_BRIDGE_UNAVAILABLE");
    const response = await this.fetchImpl("/api/nc03/login", {
      method:"POST",
      cache:"no-store",
      headers:{ "content-type":"application/json" },
      body:JSON.stringify({
        baseUrl:this.baseUrl,
        username:String(username ?? ""),
        password:String(password ?? "")
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok !== true) {
      const error = new Error(body?.code || "AUTH_LOGIN_FAILED");
      error.code = body?.code || "AUTH_LOGIN_FAILED";
      if (body?.remainingTimes !== undefined) error.remainingTimes = body.remainingTimes;
      throw error;
    }
    if (!body?.payload?.authenticated) {
      const error = new Error(body?.payload?.code || "LOGIN_FAILED");
      error.code = body?.payload?.code || "LOGIN_FAILED";
      error.remainingTimes = body?.payload?.remainingTimes ?? null;
      throw error;
    }
    return body.payload;
  }

  async logout() {
    throw new UnsupportedCapabilityError("logout");
  }
}
