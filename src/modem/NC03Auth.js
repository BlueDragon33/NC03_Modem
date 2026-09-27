import { UnsupportedCapabilityError } from "./NC03Adapter.js";
import { executeNc03Login } from "./NC03LoginRuntime.js";

export class NC03Auth {
  constructor({ baseUrl = "http://192.168.0.1", fetchImpl = globalThis.fetch, session, recipe, transport } = {}) {
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
    this.session = session;
    this.recipe = recipe;
    this.transport = transport;
  }

  supportsPersistentPassword() {
    return Boolean(this.recipe?.ready && this.transport?.ready);
  }

  clearLocalSession() {
    this.session?.clear?.();
  }

  async login({ password } = {}) {
    if (!this.recipe?.ready || !this.transport?.ready) {
      throw new UnsupportedCapabilityError("login");
    }
    return executeNc03Login({
      baseUrl:this.baseUrl,
      password,
      recipe:this.recipe,
      transport:this.transport,
      fetchImpl:this.fetchImpl
    });
  }

  async logout() {
    throw new UnsupportedCapabilityError("logout");
  }
}
