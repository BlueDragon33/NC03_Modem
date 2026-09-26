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

## Phase 2 · v0.7.17 — Login Request-Object Dependency Trace

Read-path của firmware **NC03_8.00.42** đã hoàn thiện theo bằng chứng hiện có, và dự án có thêm công cụ local để rút ngắn bước map AUTH/write mà không đoán API. Local API envelope đã được chuẩn hóa để AUTH Source Probe/Connection Doctor không còn trả kết quả rỗng do lệch response shape:

- % pin chính xác luôn hiển thị trên mọi màn hình;
- trạng thái Internet/WAN, 4G/5G, nhà mạng và chất lượng sóng định tính luôn hiển thị;
- telemetry trên tự động cập nhật **10 giây/lần**, chỉ cập nhật DOM tại chỗ để không làm mất focus/vị trí cuộn;
- nếu một lần poll bị lỗi tạm thời, app **giữ % pin/sóng/mạng gần nhất** và đánh dấu `Đang kết nối lại / Dữ liệu gần nhất`, không làm các chỉ số nhảy về `—`;
- trạng thái stale vẫn đúng khi chuyển tab; sidebar/Home/Network không được phép tự hiện xanh lại chỉ vì đang giữ snapshot cũ;
- thanh live hiển thị **giờ cập nhật thành công gần nhất**; Advanced snapshot cũng có trạng thái `LIVE READ / LAST GOOD / WAITING` và nút tải lại khi lỗi;
- Local Bridge `/api/nc03/snapshot` giải quyết đường đọc modem từ website local mà không đưa password lên cloud;
- Advanced read snapshot thêm network settings, Mobile Data, SIM PIN state, Cloud SIM auto-switch, 4 Wi-Fi AP, clients, data usage, DHCP, USB/Cradle, IP Passthrough, security/filter/DMZ, NTP, power/display, firmware/FOTA và **chỉ số lượng** DHCP reservation/port-forward/packet-filter rule;
- PSK Wi-Fi, IMEI/serial, ICCID/EID/eSIM profile và APN profile cố ý không mirror vào dashboard;
- HAR hiện có vẫn không chứa write request thực tế, vì vậy mọi write action tiếp tục fail-closed;
- Home không còn gọi client/data cũ là dữ liệu hiện tại khi Advanced snapshot đã stale;
- giá trị pin ngoài miền 0–100 bị từ chối thay vì hiển thị như phần trăm hợp lệ;
- Settings có **Báo cáo chẩn đoán an toàn** dạng A4, có thể In/Lưu PDF, chỉ xuất các trường read-only được chọn rõ ràng và loại trừ credential/secret/identifier nhạy cảm;
- báo cáo phân biệt rõ **0** với **không có dữ liệu (`—`)**, hiển thị riêng độ mới của Live/Advanced snapshot, chuẩn hóa 4G/5G và chất lượng sóng sang nhãn dễ đọc;
- HAR analyzer nhận diện JSON/form login, chỉ giữ **tên field và metadata bằng chứng**, redaction mật khẩu/token/session/cookie, và mọi auth/write finding đều giữ `CANDIDATE_ONLY`;
- **HAR Evidence Lab** nằm ngay trong Advanced Developer Mode: chọn HAR local, tách AUTH/WRITE evidence, xem request map, xóa phiên phân tích và xuất `nc03-evidence.json` đã khử bí mật mà không upload file lên cloud;
- **Capture Quality Guard** tự phát hiện modem host trong HAR, phân biệt `get_login_info` status probe với login transaction thật, và cảnh báo `AUTHENTICATED_SESSION_ONLY` khi HAR bắt đầu sau lúc đã đăng nhập;
- **Connection Doctor** trong Settings chẩn đoán Local Bridge → modem → phiên đăng nhập → firmware/profile → live read, hoàn toàn read-only và không đưa credential/session vào kết quả;
- **AUTH Source Probe** đọc cục bộ các static JS/HTML của modem đã được HAR chứng minh tồn tại, trích endpoint/function/password-codec candidate nhưng không trả raw source và không tự bật production login;
- **login-page deep probe** đọc trực tiếp `/common/login.html`, lần theo script tương đối và tách login-submit candidate khỏi logout/status endpoint;
- **AUTH probe diagnostics** kiểm tra Local Bridge trước khi quét và hiển thị trạng thái từng đường dẫn mà không lộ raw source;
- **login callsite mapping** cô lập `/goform/login` trong `/js/login.js`, tách helper/payload/field/codec/response symbols theo đúng call-site.
- **Developer Tools luôn hiện rõ trong Settings**, HAR Evidence Lab không còn bị giấu ở cuối trang.
- **AUTH Source Probe tương thích runtime/PWA lệch phiên bản**: current UI dùng POST, Local Bridge vẫn chấp nhận GET legacy read-only để không còn `METHOD_NOT_ALLOWED` sau cập nhật.
- **PWA shell dùng network-first + cache fallback**, nên khi Local Bridge đã lên bản mới thì `app.js`/module cũng ưu tiên lấy bản mới thay vì trả cache cũ trước.
- **Request object dependency trace** lần ngược `postdata = JSON.stringify(_obj)` sang chính `_obj`, field assignments và codec của từng field mà không trả literal/password.
- **Response code map** chỉ giữ mã/symbol thực sự xuất hiện trong nhánh response của login, loại các constant không liên quan trong cùng `login.js`.

App Management dùng runtime local NC03 và Universal Contract, nhưng không sở hữu modem credential/session. Trước AUTH VERIFIED, giao diện chỉ hiển thị `Ghi nhớ mật khẩu` như một policy đang khóa — không dùng checkbox có dấu tích gây hiểu nhầm rằng credential đã được lưu.

## Chạy local

Local runtime tự phát hiện `dist/` cũ: nếu version trong `dist/control/application-management.contract.json` không khớp `package.json`, app tự phục vụ source hiện tại thay vì âm thầm chạy bản cũ.


```bash
npm run serve:local
```

Mặc định mở `http://127.0.0.1:3006`. Khi chạy từ Application Management bằng `npm run run:all`, NC03 dùng `http://127.0.0.1:3010`.

Local Bridge hiện là transport local production cho read-path. Bridge và UI dùng chung một policy: chỉ nhận modem origin là **IPv4 RFC1918** (`10/8`, `172.16/12`, `192.168/16`), không nhận localhost/loopback/public host. Giá trị lưu cũ không hợp lệ tự trở về `192.168.0.1`. Direct browser → modem vẫn là tùy chọn nghiên cứu, không phải đường chính.

## Phân tích HAR cục bộ

Sau khi export HAR từ Web UI gốc:

```bash
npm run analyze:har -- capture.har
```

Nếu modem dùng IP khác:

```bash
npm run analyze:har -- capture.har --host=192.168.1.1
```

Report chỉ chứa evidence đã khử bí mật. Xem quy trình chi tiết tại `docs/AUTH_DISCOVERY.md`.

## Kiểm tra

```bash
npm run verify
```

Không coi release là PASS nếu một gate trong pipeline thất bại.

## Bước tiếp theo

Ưu tiên Phase 2B theo đúng evidence gate:

1. capture **login transaction** thật của firmware;
2. chạy `npm run analyze:har -- <file.har>` để tạo evidence report an toàn;
3. map request/response/session semantics vào `NC03Auth`;
4. chỉ sau AUTH VERIFIED mới nối credential vault vào kết quả đăng nhập thành công;
5. capture một write operation ít rủi ro kèm rollback để nâng từng capability từ PARTIAL → WRITE VERIFIED.

## Publish

Mỗi push vào `main` tạo verified artifact `nc03-control-center-site` sau khi `npm run verify` PASS.

GitHub Pages chỉ deploy live khi repository đã bật **Settings → Pages → Build and deployment → GitHub Actions**.
