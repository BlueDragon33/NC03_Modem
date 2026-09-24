import { UnsupportedCapabilityError } from "./NC03Adapter.js";

export class NC03Auth {
  constructor({ session } = {}) {
    this.session = session;
  }

  supportsPersistentPassword() {
    return false;
  }

  async login() {
    throw new UnsupportedCapabilityError("login");
  }

  async logout() {
    this.session?.clear?.();
    throw new UnsupportedCapabilityError("logout");
  }
}
