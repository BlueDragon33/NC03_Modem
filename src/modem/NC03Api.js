import { CAPABILITY_STATUS } from "./CapabilityRegistry.js";
import { UnsupportedCapabilityError } from "./NC03Adapter.js";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export class NC03Api {
  constructor({ baseUrl = "http://192.168.0.1", fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
    this.routes = new Map();
  }

  registerVerifiedRoute(name, route) {
    const status = route?.status;
    if (![CAPABILITY_STATUS.VERIFIED, CAPABILITY_STATUS.READ_ONLY, CAPABILITY_STATUS.WRITE_VERIFIED].includes(status)) {
      throw new Error("Chỉ route VERIFIED/READ ONLY/WRITE VERIFIED mới được đăng ký.");
    }
    const method = String(route.method ?? "GET").toUpperCase();
    if (!ALLOWED_METHODS.has(method)) throw new Error("HTTP method không hợp lệ.");
    if (!String(route.path ?? "").startsWith("/")) throw new Error("Route phải là path tương đối bắt đầu bằng /.");
    this.routes.set(name, { ...route, method });
  }

  route(name) {
    return this.routes.get(name) ?? null;
  }

  async request(name, init = {}) {
    const route = this.route(name);
    if (!route) throw new UnsupportedCapabilityError(name);
    if (route.status !== CAPABILITY_STATUS.WRITE_VERIFIED && route.method !== "GET" && route.status !== CAPABILITY_STATUS.VERIFIED) {
      throw new UnsupportedCapabilityError(name);
    }
    if (typeof this.fetchImpl !== "function") throw new Error("Fetch transport chưa sẵn sàng.");
    return this.fetchImpl(new URL(route.path, this.baseUrl).toString(), { ...init, method: route.method });
  }
}
