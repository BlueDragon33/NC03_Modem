const DB_NAME = "nc03-control-center:vault";
const STORE_NAME = "secure";
const KEY_ID = "aes-key";
const CREDENTIAL_ID = "admin-credential";

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export class IndexedDbVaultStore {
  constructor({ indexedDBImpl = globalThis.indexedDB } = {}) {
    this.indexedDBImpl = indexedDBImpl;
    this.dbPromise = null;
  }

  supported() {
    return Boolean(this.indexedDBImpl?.open);
  }

  async db() {
    if (!this.supported()) throw new Error("IndexedDB không khả dụng.");
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = this.indexedDBImpl.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Không mở được credential vault."));
      });
    }
    return this.dbPromise;
  }

  async get(id) {
    const db = await this.db();
    return requestAsPromise(db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id));
  }

  async set(id, value) {
    const db = await this.db();
    await requestAsPromise(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value, id));
  }

  async delete(id) {
    const db = await this.db();
    await requestAsPromise(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id));
  }
}

export class SecureCredentialVault {
  constructor({ store = new IndexedDbVaultStore(), cryptoImpl = globalThis.crypto } = {}) {
    this.store = store;
    this.cryptoImpl = cryptoImpl;
  }

  supported() {
    return Boolean(this.cryptoImpl?.subtle && this.cryptoImpl?.getRandomValues && this.store?.get && this.store?.set);
  }

  async getOrCreateKey() {
    let key = await this.store.get(KEY_ID);
    if (key) return key;
    key = await this.cryptoImpl.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await this.store.set(KEY_ID, key);
    return key;
  }

  async save({ baseUrl, username = "", password }) {
    if (!this.supported()) throw new Error("Secure credential vault không khả dụng.");
    if (!password || typeof password !== "string") throw new Error("Mật khẩu admin không được để trống.");

    const key = await this.getOrCreateKey();
    const iv = this.cryptoImpl.getRandomValues(new Uint8Array(12));
    const payload = new TextEncoder().encode(JSON.stringify({
      baseUrl: String(baseUrl || "http://192.168.0.1"),
      username: String(username || ""),
      password
    }));
    const ciphertext = await this.cryptoImpl.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);

    await this.store.set(CREDENTIAL_ID, {
      version: 1,
      iv: Array.from(iv),
      ciphertext,
      updatedAt: new Date().toISOString()
    });
  }

  async load() {
    if (!this.supported()) return null;
    const record = await this.store.get(CREDENTIAL_ID);
    if (!record) return null;

    const key = await this.store.get(KEY_ID);
    if (!key) return null;

    try {
      const plain = await this.cryptoImpl.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(record.iv) },
        key,
        record.ciphertext
      );
      const parsed = JSON.parse(new TextDecoder().decode(plain));
      if (!parsed?.password) return null;
      return {
        baseUrl: String(parsed.baseUrl || "http://192.168.0.1"),
        username: String(parsed.username || ""),
        password: String(parsed.password)
      };
    } catch {
      return null;
    }
  }

  async clear() {
    await this.store.delete(CREDENTIAL_ID);
  }

  async reset() {
    await this.store.delete(CREDENTIAL_ID);
    await this.store.delete(KEY_ID);
  }
}

export const CREDENTIAL_VAULT_SECURITY_NOTE =
  "Credential được mã hóa AES-GCM bằng CryptoKey non-extractable lưu cục bộ. Đây là bảo vệ dữ liệu at-rest, không thay thế OS Keychain/Keystore và không chống được mã độc/XSS chạy cùng origin.";
