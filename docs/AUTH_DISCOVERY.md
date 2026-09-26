# NC03 Auth / Write Evidence Capture

Mục tiêu của công cụ này là **rút ngắn Phase 2B mà không đoán endpoint hoặc thuật toán đăng nhập**.

## Chạy cục bộ

Sau khi export HAR từ Web UI gốc của modem:

```bash
npm run analyze:har -- capture.har
```

Nếu modem dùng IP RFC1918 khác:

```bash
npm run analyze:har -- capture.har --host=192.168.1.1
```

Công cụ chỉ in **evidence report đã khử bí mật** ra stdout. Có thể lưu lại bằng redirect của shell:

```bash
npm run analyze:har -- capture.har > nc03-evidence.json
```

## Report chứa gì

- method + path;
- HTTP status;
- loại request/response body: JSON, form, text hoặc empty;
- **tên field** trong body, không giữ giá trị mật khẩu/token/session;
- dấu hiệu có Authorization/Cookie/Set-Cookie/redirect;
- auth candidates;
- write-like candidates.

## Report không làm gì

- không tự xác nhận endpoint là AUTH VERIFIED;
- không tự xác nhận write endpoint là WRITE VERIFIED;
- không lưu credential;
- không gửi HAR hoặc credential lên cloud;
- không bật nút ghi cấu hình trong production.

Mọi candidate đều có `verified:false` và `statusLabel:CANDIDATE_ONLY`.

## Capture nên làm tiếp

### A. Login transaction

1. Kết nối trực tiếp Wi-Fi NC03.
2. Mở DevTools → Network.
3. Bật Preserve log.
4. Logout khỏi Web UI gốc nếu đang đăng nhập.
5. Xóa Network log.
6. Nhập mật khẩu và đăng nhập **một lần**.
7. Export HAR with content.
8. Chạy analyzer ở máy local.

Mục tiêu là xác định chính xác request đăng nhập, body shape, response semantics và session behavior.

### B. Write operation ít rủi ro

Chỉ sau khi AUTH đã map được:

1. chọn một setting có thể rollback ngay, ưu tiên Long Life Charging;
2. capture trước → đổi setting → xác nhận → đổi lại trạng thái ban đầu;
3. export HAR riêng;
4. analyzer chỉ đánh dấu candidate; người phát triển vẫn phải map payload + rollback + post-condition trước khi nâng lên WRITE VERIFIED.

## Nguyên tắc release

Không merge code bật login/write thật nếu chưa có:

- request thật;
- response thật;
- success/failure semantics;
- rollback test cho write;
- regression test;
- fail-closed behavior khi firmware khác hoặc response bất thường.


## Evidence từ HAR mới: password codec candidate

HAR mới chứa source tĩnh của trang System Admin. Trong source này firmware định nghĩa một fixed `loginKey` và dùng:

`hex_hmac_md5(loginKey, currentPassword)`

cho trường mật khẩu hiện tại trước khi gọi `/action/modify_password`.

Đây là **SOURCE CANDIDATE**, không phải bằng chứng đủ để kết luận login dùng cùng payload/endpoint. v0.7.6 thêm AUTH Source Probe để đọc trực tiếp `common.js`, `tools.js`, `md5.js` và các script được landing HTML tham chiếu, sau đó chỉ trả structural evidence.

Nếu probe tìm được endpoint/login function phù hợp, bước tiếp theo là đối chiếu request shape và success/failure semantics trước khi nâng AUTH VERIFIED.
