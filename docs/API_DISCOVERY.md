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


## HAR2 — expanded real capture

Capture mới của cùng firmware `NC03_8.00.42` có 234 request và xác nhận lại read transport:

- `POST /action/get_mgdb_params` xuất hiện lặp lại cho telemetry và hầu hết trang cấu hình;
- `POST /action/router_get_hosts_info` dùng cho connected clients;
- `POST /action/get_device_state` dùng cho runtime CPU/RAM/uptime.

### Telemetry nền

Nhóm field lặp lại nhiều lần gồm:

- `device_battery_percent`, `device_battery_charge_status`, `device_battery_level`;
- `dialup_dial_status`, `rt_wwan_conn_info`, `rt_internet_mode`;
- `mnet_sig_level`, `mnet_operator_name`, `mnet_sysmode`, `mnet_sim_status`;
- `wifi_work_status`.

Vì đây là nhóm đọc lặp theo nền của Web UI gốc, NC03 Control Center dùng một snapshot gọn để poll mỗi **10 giây**.

`mnet_sig_level` là mức chất lượng định tính. HAR2 không có `RSRP`, `RSRQ`, `SINR` hoặc `RSSI`, vì vậy app không dựng số dBm/dB giả.

### Nhóm read-only mới đã xác minh

- Network mode / scan / 5G config / band-lock state;
- SIM slot/status và eSIM capability metadata;
- DHCP + static binding inventory;
- USB tethering/speed, cradle/Ethernet, IP Passthrough;
- tối đa bốn Wi-Fi AP, channel/security/bandwidth/client counters;
- WPS, Wi-Fi MAC filter, router MAC/IP filter, DMZ và packet-filter state;
- SNTP/NITZ/timezone/sync state;
- firmware/FOTA;
- power, charging, auto-sleep/display settings;
- monthly/daily data usage settings.

### Secret boundary

HAR có một số trường nhạy cảm nhưng production snapshot **không mirror**:

- Wi-Fi PSK;
- IMEI/MEID/serial;
- SIM ICCID/MSISDN;
- eSIM EID/profile;
- APN/profile records.

### Write evidence

HAR2 không chứa request write thực tế tới modem. Các endpoint write chỉ thấy trong vendor JavaScript vẫn giữ `PARTIAL`, không nâng lên `WRITE VERIFIED`.


## HAR2 follow-up — safe inventory

Rà lại toàn bộ 234 request xác nhận thêm các key read-only an toàn:

- `dialup_dataswitch` — Mobile Data state;
- `mnet_sim_pin_protect`, `mnet_sim_pin_rtimes` — SIM PIN protection/remaining tries;
- `mnet_uc_switch_enable`, `mnet_uc_switch_notification`, `mnet_uc_switch_nosrv_time`, `mnet_uc_switch_duration` — Cloud SIM auto-switch page state;
- `rt_ip_mac_bind_0..31`, `rt_port_forward_0..31`, `rt_obj_value_info_v4_lan_0..49`, `rt_obj_value_info_v6_lan_0..49` — inventory nguồn.

Production adapter **không trả raw inventory**. Nó chỉ đếm entry không rỗng để UI hiển thị số DHCP reservation / port-forward / IPv4 filter / IPv6 filter.

HAR2 vẫn không có write transaction thực tế và vẫn không có RSRP/RSRQ/SINR/RSSI.
