# NC03 API Discovery

## Mục tiêu

Không tự bịa endpoint. Mọi endpoint modem phải đi qua chu trình:

**Discover → Map → Implement → Test → Fix → Verify**

## Thu HAR

1. Kết nối trực tiếp Wi-Fi NC03.
2. Mở Web UI gốc tại `http://192.168.0.1`.
3. DevTools → Network → Fetch/XHR.
4. Thực hiện đúng một tác vụ trên Web UI gốc.
5. Export HAR with content.
6. Trong NC03 Control Center: **Settings → Advanced Developer Mode → API Discovery** rồi import HAR.

HAR parser của dự án chạy tại trình duyệt và tự redaction cookie/token/session/password trước khi hiển thị.

## Capability matrix

| Module | Read | Write | Endpoint | Method | Auth | Status |
|---|---|---|---|---|---|---|
| Login | | | | | | UNKNOWN |
| Status | | | | | | UNKNOWN |
| Battery | | | | | | UNKNOWN |
| Wi-Fi | | | | | | UNKNOWN |
| Clients | | | | | | UNKNOWN |
| Mobile Network | | | | | | UNKNOWN |
| Data Usage | | | | | | UNKNOWN |
| DHCP | | | | | | UNKNOWN |
| Firewall | | | | | | UNKNOWN |
| Reboot | | | | | | UNKNOWN |
| Bridge Mode | | | | | | UNKNOWN |
| Firmware | | | | | | UNKNOWN |

Read endpoint chỉ được dùng khi capability đã được xác minh. Mọi operation ghi phải có status `WRITE VERIFIED`; không suy luận quyền ghi chỉ từ GET/POST/PUT/DELETE.
