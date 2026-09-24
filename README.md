# NC03 Control Center

Website-app/PWA quản trị modem **HYBRID Wi-Fi 5G NC03** theo hướng local-first.

## Nguyên tắc

**Discover → Map → Implement → Test → Fix → Verify → Release**

- Không tự bịa endpoint modem.
- Không sửa firmware NC03.
- UI không gọi endpoint modem trực tiếp; mọi giao tiếp production đi qua `NC03Adapter`.
- Không gửi mật khẩu/session/token modem lên cloud.
- Không lưu password plaintext.
- Mock Mode luôn gắn nhãn **DEMO DATA**.

## Phase 1 hiện có

- PWA responsive: desktop sidebar, mobile bottom navigation.
- Dashboard skeleton.
- Mock Mode phục vụ UI/test/screenshot.
- `NC03Adapter` abstraction.
- Capability matrix mặc định `UNKNOWN`.
- HAR Discovery chạy cục bộ và redaction credential.
- Security architecture cho Web/PWA và Local Bridge.
- Unit tests cho HAR parser và capability gate.

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

## Bước tiếp theo

Cần HAR thật của Web UI NC03 để map login/session/status/battery/Wi-Fi/client/network. Không có HAR thì write API vẫn bị khóa.
