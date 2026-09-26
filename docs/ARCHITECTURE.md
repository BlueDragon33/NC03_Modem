# NC03 Control Center Architecture

## Boundary

NC03 Control Center là companion/control center local-first cho modem HYBRID Wi-Fi 5G NC03. Ứng dụng không sửa firmware và không đưa credential modem lên cloud.

```text
Browser UI
   ↓ same-origin
NC03 Local Bridge (127.0.0.1:3006 / 3010)
   ↓
NC03Firmware80042Adapter
   ↓
NC03Api verified read routes
   ↓
Private RFC1918 modem origin (default http://192.168.0.1)
```

Application Management chỉ quản lý lifecycle/contract và mở runtime NC03. Nó không nhận password, token, session hay raw modem configuration.

## Modules

- `NC03Adapter`: boundary bắt buộc giữa UI và modem.
- `NC03Api`: route registry; tách `read`/`write` khỏi HTTP method; write chỉ chạy khi `WRITE VERIFIED`.
- `NC03Firmware80042Adapter`: mapping firmware 8.00.42 đã được HAR xác minh.
- `LocalBridgePolicy`: chỉ cho phép modem origin IPv4 RFC1918, không cho loopback/public hostname.
- `SecureCredentialVault`: nền tảng lưu credential mã hóa cục bộ, chưa nối vào auth production khi login flow chưa VERIFIED.
- `HarDiscovery`: đọc HAR cục bộ và redaction secret.
- `MockNC03Adapter`: chỉ cho development/test và luôn mang nhãn DEMO DATA.

## Read transport

Production read-path dùng Local Bridge:

- `POST /api/nc03/snapshot`: snapshot gọn cho Pin/Kết nối/Sóng/Mạng, poll 10 giây;
- `POST /api/nc03/details`: snapshot Advanced chỉ tải khi cần;
- `GET /_local/health`: runtime health;
- `GET /api/application-management/contract`: contract cho App-Management.

UI không gửi raw endpoint modem trực tiếp.

## Authentication

HAR hiện có chỉ chứng minh trạng thái phiên đã đăng nhập, chưa có request nhập password. Vì vậy:

- không tự bịa login algorithm;
- không tự bật Remember Password/Auto Login production;
- khi modem yêu cầu auth, người dùng mở Web UI gốc để đăng nhập và Local Bridge tự thử lại.

## Security/data minimization

Không mirror vào dashboard: Wi-Fi PSK, IMEI/MEID/serial, ICCID/MSISDN, eSIM EID/profile, APN profile và raw rule inventory. Rule inventory chỉ trả số lượng.

## Polling

Live telemetry chạy mỗi 10 giây nhưng chỉ cập nhật các node live trong DOM. Không render lại toàn trang trừ khi trạng thái availability đổi. Polling dừng khi tab bị ẩn và không cho request chồng nhau.

## Release gate

Không merge/release nếu còn fake button, unknown write endpoint, plaintext credential, console error, broken responsive layout, stale PWA cache hoặc dangerous action thiếu confirmation.
