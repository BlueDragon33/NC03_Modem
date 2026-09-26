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

## Phase 2 · v0.6.0 — HAR2 Live Telemetry

HAR mới của firmware **NC03_8.00.42** đã mở rộng read-path thật:

- % pin chính xác luôn hiển thị trên mọi màn hình;
- trạng thái Internet/WAN, 4G/5G, nhà mạng và chất lượng sóng định tính luôn hiển thị;
- telemetry trên tự động cập nhật **10 giây/lần**;
- Local Bridge `/api/nc03/snapshot` giải quyết đường đọc modem từ website local mà không đưa password lên cloud;
- Advanced read snapshot thêm network settings, 4 Wi-Fi AP, clients, data usage, DHCP, USB/Cradle, IP Passthrough, security/filter/DMZ, NTP, power/display, firmware/FOTA;
- PSK Wi-Fi, IMEI/serial, ICCID/EID/eSIM profile và APN profile cố ý không mirror vào dashboard;
- HAR mới vẫn không chứa write request thực tế, vì vậy mọi write action tiếp tục fail-closed.

App Management dùng runtime local NC03 và Universal Contract, nhưng không sở hữu modem credential/session.

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

1. map request đăng nhập password-only của firmware;
2. nối credential vault vào kết quả đăng nhập thành công;
3. test Direct LAN transport;
4. nếu bị browser chặn, triển khai Local Bridge;
5. capture từng write operation ít rủi ro để nâng từ PARTIAL → WRITE VERIFIED.

## Publish

Mỗi push vào `main` tạo verified artifact `nc03-control-center-site` sau khi `npm run verify` PASS.

GitHub Pages chỉ deploy live khi repository đã bật **Settings → Pages → Build and deployment → GitHub Actions**.
