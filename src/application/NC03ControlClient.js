import { NC03_RUNTIME_PROTOCOL } from "../runtime/RuntimeProtocol.js";

export class NC03ControlClientError extends Error {
  constructor(code, { status = null, payload = null, cause = null } = {}) {
    super(code);
    this.name = "NC03ControlClientError";
    this.code = code;
    this.status = status;
    this.payload = payload;
    this.cause = cause;
  }
}

function codedError(code, options) {
  return new NC03ControlClientError(code, options);
}

export class NC03ControlClient {
  constructor({ fetchImpl = globalThis.fetch, runtimeProtocol = NC03_RUNTIME_PROTOCOL } = {}) {
    if (typeof fetchImpl !== "function") throw codedError("LOCAL_BRIDGE_UNAVAILABLE");
    this.fetchImpl = fetchImpl;
    this.runtimeProtocol = runtimeProtocol;
  }

  async #json(path, { method = "POST", body, timeout = 12000 } = {}) {
    let response;
    try {
      response = await this.fetchImpl(path, {
        method,
        cache:"no-store",
        ...(body === undefined ? {} : {
          headers:{ "content-type":"application/json" },
          body:JSON.stringify(body)
        }),
        signal:AbortSignal.timeout(timeout)
      });
    } catch (cause) {
      throw codedError("LOCAL_BRIDGE_UNREACHABLE", { cause });
    }

    const json = await response.json().catch(() => ({}));
    if (!response.ok || json?.ok !== true) {
      throw codedError(json?.code || `HTTP_${response.status}`, {
        status:response.status,
        payload:json?.payload ?? null
      });
    }
    return json;
  }

  #assertRuntime(payload) {
    const protocol=this.runtimeProtocol;
    if (payload?.runtimeProtocol !== protocol.id
      || payload?.authEvidenceSchema !== protocol.authEvidenceSchema
      || payload?.authLoginProtocol !== protocol.authLoginProtocol
      || payload?.writeReadinessProtocol !== protocol.writeReadinessProtocol
      || payload?.settingsWriteProtocol !== protocol.settingsWriteProtocol
      || payload?.stockUiAuditSchema !== protocol.stockUiAuditSchema) {
      throw codedError("LOCAL_BRIDGE_RESTART_REQUIRED");
    }
  }

  async health() {
    const json=await this.#json("/_local/health", { method:"GET", timeout:2500 });
    if (json.app !== "nc03-control-center") throw codedError("LOCAL_BRIDGE_HEALTH_FAILED");
    this.#assertRuntime(json);
    return json;
  }

  async #postModem(path, baseUrl, extra = {}, timeout = 12000) {
    const json=await this.#json(path, {
      body:{ baseUrl, ...extra },
      timeout
    });
    if (!Object.prototype.hasOwnProperty.call(json, "payload")) {
      throw codedError("MALFORMED_LOCAL_RESPONSE");
    }
    return json.payload;
  }

  getAuthReadiness(baseUrl) {
    return this.#postModem("/api/nc03/auth-readiness", baseUrl);
  }

  async login(baseUrl, password) {
    const payload=await this.#postModem("/api/nc03/login", baseUrl, { password });
    if (payload?.authenticated !== true) throw codedError("AUTH_VERIFICATION_FAILED", { payload });
    return payload;
  }

  getStockUiAudit(baseUrl) {
    return this.#postModem("/api/nc03/stock-ui-audit", baseUrl).then((payload)=>{
      if (payload?.runtime?.protocolId !== this.runtimeProtocol.id
        || payload?.runtime?.stockUiAuditSchema !== this.runtimeProtocol.stockUiAuditSchema
        || payload?.audit?.schema !== this.runtimeProtocol.stockUiAuditSchema) {
        throw codedError("LOCAL_BRIDGE_RESTART_REQUIRED");
      }
      return payload;
    });
  }

  getAuthSourceProbe(baseUrl) {
    return this.#postModem("/api/nc03/auth-source-probe", baseUrl).then((payload)=>{
      if (payload?.runtime?.protocolId !== this.runtimeProtocol.id
        || payload?.evidence?.schema !== this.runtimeProtocol.authEvidenceSchema) {
        throw codedError("LOCAL_BRIDGE_RESTART_REQUIRED");
      }
      return payload;
    });
  }

  getWriteReadiness(baseUrl) {
    return this.#postModem("/api/nc03/write-readiness", baseUrl);
  }

  getDoctor(baseUrl) {
    return this.#postModem("/api/nc03/doctor", baseUrl);
  }

  getSnapshot(baseUrl) {
    return this.#postModem("/api/nc03/snapshot", baseUrl);
  }

  getDetails(baseUrl) {
    return this.#postModem("/api/nc03/details", baseUrl);
  }

  setLongLifeCharging(baseUrl, enabled) {
    return this.#postModem("/api/nc03/settings/long-life-charging", baseUrl, { enabled }, 20000);
  }
}
