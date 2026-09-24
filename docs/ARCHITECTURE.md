# NC03 Control Center Architecture

## Boundary

NC03 Control Center là companion/control center local-first cho modem HYBRID Wi-Fi 5G NC03. Ứng dụng không sửa firmware và không đưa credential modem lên cloud.

```text
NC03 Control Center UI
        ↓
NC03Adapter
        ↓
Auth / Session / CSRF
        ↓
Verified NC03 Internal API
        ↓
http://192.168.0.1
```

## Modules

- `NC03Adapter`: ranh giới bắt buộc giữa UI và modem.\n- `NC03Api`: registry/request boundary; phân loại `read`/`write` độc lập với HTTP method và chỉ nhận write route khi `WRITE VERIFIED`.\n- `NC03Auth`: auth boundary fail-closed; local session clear là thao tác riêng, không giả vờ logout server.\n- `NC03Session`: session state + sanitized view.\n- `NC03Parser`: parser generic, không tự gán semantics chưa xác minh.\n- `NC03Capabilities` / `CapabilityRegistry`: firmware/capability boundary, production write chỉ mở khi `WRITE VERIFIED`.\n- `MockNC03Adapter`: chỉ dùng UI development/test/screenshot và phải gắn DEMO DATA.\n- `HarDiscovery`: đọc HAR cục bộ, lọc request tới modem, redaction credential.\n- `LocalPreferences`: chỉ lưu cấu hình không nhạy cảm như modem address, UI Mode và Developer/Mock Mode.

## Authentication

Phase 1 chỉ dựng Login Screen skeleton. Password, Remember Login và Auto Login vẫn bị khóa cho tới khi HAR thật xác minh:

1. request đăng nhập;
2. token/cookie/session/CSRF;
3. expiry;
4. logout;
5. retry/backoff;
6. firmware compatibility.

Không lưu password trong localStorage/sessionStorage.

## Web transport

GitHub Pages/ChatGPT Site là HTTPS trong khi NC03 Web UI thường là HTTP LAN. Browser có thể chặn mixed-content hoặc CORS.

Phase 2 phải xác minh transport thật:

- Direct LAN transport nếu firmware/browser cho phép; hoặc
- Local Bridge transport chạy trên chính thiết bị người dùng.

Application Management không được làm cloud proxy cho credential/session modem.

## Manager integration

Application Management quản lý lifecycle/capability/release của ứng dụng NC03. Nó không sở hữu password, token, session hay modem configuration.

## Release gate

Không merge/release nếu còn fake button, unknown write endpoint, plaintext credential, console error, broken responsive layout hoặc dangerous action thiếu confirmation. Pipeline Phase 1 còn kiểm tra offline artifact/PWA shell trước khi publish.
