import { UnsupportedCapabilityError } from "./NC03Adapter.js";

export class NC03Auth {
  constructor({ baseUrl = "http://192.168.0.1", session, recipe, transport, loginExecutor } = {}) {
    this.baseUrl = baseUrl;
    this.session = session;
    this.recipe = recipe;
    this.transport = transport;
    this.loginExecutor = loginExecutor;
  }

  supportsPersistentPassword() {
    return Boolean(this.recipe?.ready && this.transport?.ready && typeof this.loginExecutor === "function");
  }

  clearLocalSession() {
    this.session?.clear?.();
  }

  async login({ password } = {}) {
    if (!this.supportsPersistentPassword()) {
      throw new UnsupportedCapabilityError("login");
    }
    return this.loginExecutor({
      baseUrl:this.baseUrl,
      password,
      recipe:this.recipe,
      transport:this.transport
    });
  }

  async logout() {
    throw new UnsupportedCapabilityError("logout");
  }
}
