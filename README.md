# NC03 Control Center

Website-app/PWA quản trị modem **HYBRID Wi-Fi 5G NC03** theo hướng local-first.

## Nguyên tắc

**Discover → Map → Implement → Test → Fix → Verify → Release**

- Không tự bịa endpoint modem.
- Không sửa firmware NC03.
- UI không gọi endpoint modem trực tiếp; mọi giao tiếp production đi qua `NC03Adapter`.
- Read/write capability được gate độc lập với HTTP method.
- Không gửi mật khẩu/session/token modem lên cloud.
- Không lưu password plaintext.
- Mock Mode chỉ nằm trong Advanced Developer Mode và luôn gắn nhãn **DEMO DATA**.

## Phase 1 v0.4.0

Phase 1 foundation đã hoàn tất phần có thể làm mà **không cần HAR thật**:

- responsive PWA shell: desktop sidebar + mobile bottom navigation;
- 5 primary tabs: Home / Network / Wi-Fi / Devices / Settings;
- Basic Mode mặc định và Advanced Mode;
- Advanced Developer Mode riêng cho HAR Discovery / Mock;
- Dashboard + Login Screen skeleton fail-closed;
- `NC03Adapter`, `NC03Api`, `NC03Auth`, `NC03Session`, `NC03Parser`, `NC03Capabilities`;
- explicit connection states;
- capability matrix mặc định `UNKNOWN`;
- HAR Discovery local-only + credential redaction + heuristic module hints (candidate-only, không tự VERIFIED);\n- encrypted local credential vault foundation bằng AES-GCM + non-extractable CryptoKey;
- fail-closed write operation gate: chỉ `WRITE VERIFIED` mới đăng ký write route;
- PWA manifest, icon và offline cache shell;
- release gates: CHECK / BUILD / TYPECHECK / LINT / UNIT / INTEGRATION / UX / OFFLINE / SECURITY.

## Chạy local

Dùng bất kỳ static server nào tại root repo, ví dụ:

```bash
python -m http.server 4173
```

Sau đó mở `http://localhost:4173`.

## Kiểm tra

```bash
npm run verify
```

Không coi release là PASS nếu một gate trong pipeline thất bại.

## Phase 2

Dependency bắt buộc: **HAR thật của Web UI NC03 trên firmware đang sử dụng**.

Cần map lần lượt:

1. login / logout / session / CSRF;
2. status / firmware;
3. battery;
4. mobile network;
5. Wi-Fi;
6. connected clients;
7. data usage;
8. DHCP / reboot / bridge và các write operation khác.

Không có HAR thì production endpoint và write controls vẫn bị khóa.

## Publish

Mỗi push vào `main` tạo verified artifact `nc03-control-center-site` sau khi `npm run verify` PASS.

GitHub Pages chỉ deploy live khi repository đã bật **Settings → Pages → Build and deployment → GitHub Actions**. GitHub App hiện dùng để phát triển repo không có quyền Administration để tự bật Pages, nên workflow giữ verified artifact và skip live deploy thay vì báo release thành công giả.
