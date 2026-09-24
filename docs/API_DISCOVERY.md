# NC03 API Discovery

## Mục tiêu

Không tự bịa endpoint. Mọi endpoint modem phải đi qua chu trình:

**Discover → Map → Implement → Test → Fix → Verify**

## Real HAR — NC03 firmware 8.00.42

Một HAR thật từ NC03 firmware `NC03_8.00.42` đã được phân tích cục bộ. HAR gốc **không được commit** vì chứa thông tin mạng/thiết bị riêng.

Endpoint đọc đã quan sát trực tiếp với HTTP 200 + JSON hợp lệ:

| Purpose | Endpoint | Method | Evidence |
|---|---|---:|---|
| Login status probe | `/goform/get_login_info` | POST | real HAR |
| Parameter database | `/action/get_mgdb_params` | POST | real HAR |
| Connected clients | `/action/router_get_hosts_info` | POST | real HAR |
| Device runtime state | `/action/get_device_state` | POST | real HAR |

`/action/get_mgdb_params` nhận body JSON dạng:

```json
{"keys":["device_software_version","device_battery_percent"]}
```

Response dùng `{"retcode":0,"data":{...}}`.

### Battery proof

Firmware trả trực tiếp các field:

- `device_battery_percent`
- `device_battery_level`
- `device_battery_charge_status`
- `device_battery_percent_display`
- `device_bat_safe_charge_switch`
- `device_charge_long_life`
- `device_power_saving_mode`

Vì vậy NC03 Control Center có thể hiển thị **% pin chính xác** khi read transport hoạt động. Không cần suy diễn từ số vạch pin.

### Session/auth observation

HAR đã ghi lại một phiên **đã đăng nhập**. Không thấy Cookie, Set-Cookie hoặc Authorization header trong các request đã quan sát. `get_login_info` trả login status/role và địa chỉ client, nhưng HAR này **không chứa request đăng nhập ban đầu**, vì vậy không được suy luận login algorithm hay tự động bật credential login.

Cần một capture riêng của **login page assets / login transaction** để xác minh auth flow.

### Transport observation

Web UI gốc là same-origin tại `http://192.168.0.1`. Response quan sát có `X-Frame-Options: SAMEORIGIN`; HAR same-origin không chứng minh CORS cho origin khác. Vì vậy Direct LAN PWA vẫn phải test riêng. Local Bridge vẫn là fallback thiết kế.

## Write endpoints discovered from vendor JavaScript

Các endpoint ghi dưới đây xuất hiện trong JavaScript do chính modem phục vụ, nhưng chưa được thao tác trong HAR này nên chỉ là **PARTIAL**, không phải WRITE VERIFIED:

- battery/power: `device_set_battery_safe_charge`, `device_set_power_saving_mode`, `device_set_autosleep`, `device_set_turnoff_lcd_time`, `device_set_ac_autostart`;
- Wi-Fi: `wifi_set_ap_params`, `wifi_set_ap_txpower`, `wifi_set_basic_params`, `router_set_privacy_separator_params`;
- WPS/MAC filter/security;
- DHCP + static MAC/IP binding;
- reboot;
- USB tethering/speed;
- data usage quota/reset;
- `/goform/schedule_process` cho batch operation.

Không bật bất kỳ control ghi production nào chỉ dựa trên JavaScript tĩnh.

## Capability matrix — firmware 8.00.42

| Module | Read | Write | Evidence | Status |
|---|---:|---:|---|---|
| Login | status probe only | No | real HAR; login request missing | PARTIAL |
| Status | Yes | No | get_mgdb_params | READ ONLY |
| Battery | Yes, exact % | No | get_mgdb_params | READ ONLY |
| Wi-Fi | Yes | discovered only | HAR + vendor JS | READ ONLY |
| Clients | Yes | No | router_get_hosts_info | READ ONLY |
| Mobile Network | qualitative | No | get_mgdb_params | READ ONLY |
| Data Usage | Yes | discovered only | HAR + vendor JS | READ ONLY |
| DHCP | Yes | discovered only | HAR + vendor JS | READ ONLY |
| Firewall | Not mapped | Not mapped | — | UNKNOWN |
| Reboot | — | discovered only | vendor JS | PARTIAL |
| Bridge Mode | raw key observed | Not verified | semantics pending | PARTIAL |
| Firmware | Yes | No | get_mgdb_params | READ ONLY |

## Thu HAR bổ sung

1. Kết nối trực tiếp Wi-Fi NC03.
2. Mở Web UI gốc tại `http://192.168.0.1`.
3. DevTools → Network → Fetch/XHR.
4. Mỗi capture chỉ thực hiện một nhóm thao tác.
5. Export HAR with content.
6. Không commit HAR thô vào repo public.

Capture tiếp theo ưu tiên:
- login page/assets trước khi nhập mật khẩu;
- login transaction với credential dùng tạm thời hoặc đã redaction;
- một thao tác write ít rủi ro như đổi Long Life Charging rồi đổi lại;
- trang Mobile Network có RSRP/RSRQ/SINR nếu firmware hiển thị.
