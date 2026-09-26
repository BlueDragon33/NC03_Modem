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

## Phase 2 · v0.6.2 — Resilient Live Telemetry

HAR mới của firmware **NC03_8.00.42** đã mở rộng read-path thật:

- % pin chính xác luôn hiển thị trên mọi màn hình;
- trạng thái Internet/WAN, 4G/5G, nhà mạng và chất lượng sóng định tính luôn hiển thị;
- telemetry trên tự động cập nhật **10 giây/lần**, chỉ cập nhật DOM tại chỗ để không làm mất focus/vị trí cuộn;
- nếu một lần poll bị lỗi tạm thời, app **giữ % pin/sóng/mạng gần nhất** và đánh dấu `Đang kết nối lại / Dữ liệu gần nhất`, không làm các chỉ số nhảy về `—`;
- Local Bridge `/api/nc03/snapshot` giải quyết đường đọc modem từ website local mà không đưa password lên cloud;
- Advanced read snapshot thêm network settings, Mobile Data, SIM PIN state, Cloud SIM auto-switch, 4 Wi-Fi AP, clients, data usage, DHCP, USB/Cradle, IP Passthrough, security/filter/DMZ, NTP, power/display, firmware/FOTA và **chỉ số lượng** DHCP reservation/port-forward/packet-filter rule;
- PSK Wi-Fi, IMEI/serial, ICCID/EID/eSIM profile và APN profile cố ý không mirror vào dashboard;
- HAR mới vẫn không chứa write request thực tế, vì vậy mọi write action tiếp tục fail-closed.

App Management dùng runtime local NC03 và Universal Contract, nhưng không sở hữu modem credential/session.

## Chạy local

```bash
npm run serve:local
```

Mặc định mở `http://127.0.0.1:3006`. Khi chạy từ Application Management bằng `npm run run:all`, NC03 dùng `http://127.0.0.1:3010`.

Local Bridge hiện là transport local production cho read-path. Bridge và UI dùng chung một policy: chỉ nhận modem origin là **IPv4 RFC1918** (`10/8`, `172.16/12`, `192.168/16`), không nhận localhost/loopback/public host. Giá trị lưu cũ không hợp lệ tự trở về `192.168.0.1`. Direct browser → modem vẫn là tùy chọn nghiên cứu, không phải đường chính.

## Kiểm tra

```bash
npm run verify
```

Không coi release là PASS nếu một gate trong pipeline thất bại.

## Bước tiếp theo

Ưu tiên Phase 2B:

1. map request đăng nhập password-only của firmware;
2. nối credential vault vào kết quả đăng nhập thành công;
3. capture từng write operation ít rủi ro để nâng từ PARTIAL → WRITE VERIFIED;
4. chỉ nghiên cứu Direct LAN transport nếu nó mang lại lợi ích rõ hơn Local Bridge hiện tại.

## Publish

Mỗi push vào `main` tạo verified artifact `nc03-control-center-site` sau khi `npm run verify` PASS.

GitHub Pages chỉ deploy live khi repository đã bật **Settings → Pages → Build and deployment → GitHub Actions**.
