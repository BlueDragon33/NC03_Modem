# Security architecture

- Không commit mật khẩu admin NC03.
- Không gửi credential modem lên cloud/Application Management.
- Không lưu mật khẩu trong `localStorage`/`sessionStorage`.
- Không log request body chứa credential.
- Discovery UI phải redaction cookie, authorization, CSRF, token, password và session.
- Manager app chỉ quản trị lifecycle/capability/release của ứng dụng NC03; không đóng vai trò proxy tới modem.

## Local Bridge boundary

Production read transport dùng Local Bridge chạy trên thiết bị người dùng. Bridge chỉ chấp nhận modem origin là IPv4 RFC1918 (`10/8`, `172.16/12`, `192.168/16`), protocol HTTP/HTTPS và port mặc định 80/443. Loopback, localhost, public IP, hostname, credential-in-URL, query/hash/path bất thường và port khác đều bị từ chối.

Không dùng cloud proxy để né giới hạn trình duyệt vì việc đó sẽ đưa credential/session modem ra khỏi thiết bị người dùng.


## Encrypted local credential vault

The browser implementation may store the NC03 admin credential encrypted with AES-GCM and a non-extractable CryptoKey in IndexedDB. The password is never written to localStorage/sessionStorage and is never sent to cloud services.

This protects credential data at rest, but it is not equivalent to an OS Keychain/Keystore and cannot protect against malicious code/XSS executing under the same application origin. Therefore remember-admin and auto-login remain disabled until the real NC03 authentication flow is verified and the transport is approved.


## Password-only login policy

- Default modem address is `http://192.168.0.1`, but the user can change it.
- NC03 Control Center does not ask for a username unless future firmware proves one is required.
- The remember-password preference defaults to enabled for this single-user local companion workflow.
- A password must never be persisted before the modem confirms a successful login.
- Remembered credentials stay in the encrypted local credential vault and are never copied to localStorage/sessionStorage or cloud services.
- The UI does not expose a separate Auto Login checkbox; reuse of a remembered credential is an implementation detail after AUTH is verified.


## Data minimization

Advanced snapshot không mirror Wi-Fi PSK, IMEI/MEID/serial, ICCID/MSISDN, eSIM EID/profile, APN profile, WPS PIN, DMZ IP hoặc raw forwarding/filter/MAC-binding rules. Với rule inventory chỉ trả count.
