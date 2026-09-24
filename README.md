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
- Không commit HAR thô chứa thông tin riêng.
- Mock Mode chỉ nằm trong Advanced Developer Mode và luôn gắn nhãn **DEMO DATA**.

## Phase 2A v0.5.0

Đã phân tích HAR thật của firmware **NC03_8.00.42** và triển khai read-path profile:

- `/goform/get_login_info` — login status probe;
- `/action/get_mgdb_params` — status / battery / Wi-Fi / network / usage / DHCP / firmware;
- `/action/router_get_hosts_info` — connected clients;
- `/action/get_device_state` — CPU/RAM/uptime;
- xác nhận modem trả `device_battery_percent` dạng số nên app có thể hiện % pin chính xác;
- thêm `NC03Firmware80042Adapter` và profile firmware;
- write endpoints chỉ được catalogued từ vendor JavaScript và vẫn khóa tới khi WRITE VERIFIED;
- encrypted local credential vault vẫn chờ login flow VERIFIED trước khi bật Remember Admin/Auto Login.

## Chạy local

```bash
python -m http.server 4173
```

Sau đó mở `http://localhost:4173`.

Lưu ý: Web UI gốc chạy same-origin trên modem. Direct PWA → `192.168.0.1` còn phải xác minh CORS/Local Network Access. Local Bridge là fallback nếu browser chặn.

## Kiểm tra

```bash
npm run verify
```

Không coi release là PASS nếu một gate trong pipeline thất bại.

## Bước tiếp theo

Ưu tiên Phase 2B:

1. capture login page/assets và login transaction an toàn;
2. xác minh auth/session;
3. test Direct LAN transport;
4. nếu bị browser chặn, triển khai Local Bridge;
5. capture từng write operation ít rủi ro để nâng từ PARTIAL → WRITE VERIFIED.

## Publish

Mỗi push vào `main` tạo verified artifact `nc03-control-center-site` sau khi `npm run verify` PASS.

GitHub Pages chỉ deploy live khi repository đã bật **Settings → Pages → Build and deployment → GitHub Actions**.
