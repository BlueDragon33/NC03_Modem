import { UnsupportedCapabilityError } from "./NC03Adapter.js";

export class NC03Auth {
  constructor({ session } = {}) {
    this.session = session;
  }

  supportsPersistentPassword() {
    return false;
  }

  clearLocalSession() {
    this.session?.clear?.();
  }

  async login() {
    throw new UnsupportedCapabilityError("login");
  }

  async logout() {
    throw new UnsupportedCapabilityError("logout");
  }
}
