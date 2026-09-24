# Security architecture

- Không commit mật khẩu admin NC03.
- Không gửi credential modem lên cloud/Application Management.
- Không lưu mật khẩu trong `localStorage`/`sessionStorage`.
- Không log request body chứa credential.
- Discovery UI phải redaction cookie, authorization, CSRF, token, password và session.
- Manager app chỉ quản trị lifecycle/capability/release của ứng dụng NC03; không đóng vai trò proxy tới modem.

## Web/PWA constraint

Một site HTTPS có thể không gọi được trực tiếp `http://192.168.0.1` do mixed-content và CORS. Sau khi có HAR/firmware thật, dự án sẽ xác minh một trong hai transport:

1. **Direct LAN transport** nếu browser/firmware cho phép.
2. **Local Bridge transport** chạy cục bộ trên thiết bị người dùng, giữ credential tại máy và giao tiếp với modem trong LAN.

Không dùng cloud proxy để né giới hạn trình duyệt vì việc đó sẽ đưa credential/session modem ra khỏi thiết bị người dùng.


## Encrypted local credential vault

The browser implementation may store the NC03 admin credential encrypted with AES-GCM and a non-extractable CryptoKey in IndexedDB. The password is never written to localStorage/sessionStorage and is never sent to cloud services.

This protects credential data at rest, but it is not equivalent to an OS Keychain/Keystore and cannot protect against malicious code/XSS executing under the same application origin. Therefore remember-admin and auto-login remain disabled until the real NC03 authentication flow is verified and the transport is approved.
