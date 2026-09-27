# NC03 — Stock Web UI Parity Inventory

Status: **AUTOMATED EVIDENCE MAPPED · HUMAN REVIEW REQUIRED**  
Work Package: **NC03-WP01**  
Reference firmware: **NC03_8.00.42**

## Purpose

This is the first canonical inventory of the stock modem administration surface. It is intentionally separated from the replacement UI so future implementation follows verified modem behavior rather than labels or screen assumptions.

Automated repository evidence currently maps **77** setting/action definitions across all eight canonical families.

A row being present here does **not** mean its stock-Web-UI placement has been human-confirmed, and a WRITE candidate is not WRITE VERIFIED.

## Evidence states

- **VERIFIED / READ_VERIFIED** — behavior already supported by real HAR/source/live-hardware evidence.
- **SOURCE_OBSERVED** — vendor source shows the concept/route, but UX/transaction semantics are not fully verified.
- **CANDIDATE** — a state-changing route was discovered but request shape/readback/rollback is not complete.
- **GUARDED_PENDING_HARDWARE_ACCEPTANCE** — guarded implementation exists, but the exact real-hardware acceptance gate is still pending.
- **COUNT_ONLY** — current privacy-safe implementation exposes only the number of rules.
- **INTENTIONALLY_NOT_MIRRORED** — sensitive values are deliberately excluded.
- **UNMAPPED** — no claim is made.

## Human review required before WP01 can PASS

On the real stock Web UI, review each page from top to bottom and confirm:

1. every navigation page/section exists in this inventory;
2. every visible setting/control/action appears once;
3. labels/grouping are close enough to identify the same user job;
4. any missing setting is added as **UNMAPPED** rather than guessed;
5. destructive actions are explicitly marked;
6. screenshots/HAR do not expose passwords, current Wi‑Fi PSK, session/cookie, IMEI, ICCID/EID or other sensitive identifiers.

The safest review input is a set of screenshots of each stock settings page with secret values hidden/blurred.


## Hệ thống / Thời gian / Firmware / Admin

| ID | Setting / action | Kind | Read evidence | Write evidence | Danger | Privacy |
|---|---|---|---|---|---|---|
| `auth.login` | Đăng nhập quản trị | action | VERIFIED | VERIFIED | MEDIUM | SECRET |
| `auth.session-status` | Trạng thái phiên đăng nhập | read | VERIFIED | NOT_APPLICABLE | LOW | LOCAL_SENSITIVE |
| `auth.logout` | Đăng xuất | action | SOURCE_OBSERVED | CANDIDATE | MEDIUM | LOCAL_SENSITIVE |
| `system.ntp-enable` | NTP | toggle | READ_VERIFIED | UNMAPPED | LOW | NORMAL |
| `system.nitz-enable` | NITZ | toggle | READ_VERIFIED | UNMAPPED | LOW | NORMAL |
| `system.timezone` | Timezone | select | READ_VERIFIED | UNMAPPED | LOW | NORMAL |
| `system.time-format` | Định dạng thời gian | select | READ_VERIFIED | UNMAPPED | LOW | NORMAL |
| `system.daylight` | Daylight saving | toggle | READ_VERIFIED | UNMAPPED | LOW | NORMAL |
| `system.reboot` | Khởi động lại modem | dangerous-action | NOT_APPLICABLE | CANDIDATE | CRITICAL | NORMAL |
| `system.admin-password` | Đổi mật khẩu quản trị | password-action | SOURCE_OBSERVED | CANDIDATE | CRITICAL | SECRET |
| `system.firmware-status` | Firmware / FOTA status | read | READ_VERIFIED | UNMAPPED | MEDIUM | NORMAL |
| `system.factory-reset` | Khôi phục cài đặt gốc | dangerous-action | UNMAPPED | UNMAPPED | CRITICAL | NORMAL |

## Mạng di động / SIM / APN / Band

| ID | Setting / action | Kind | Read evidence | Write evidence | Danger | Privacy |
|---|---|---|---|---|---|---|
| `mobile.data` | Dữ liệu di động | toggle | READ_VERIFIED | UNMAPPED | MEDIUM | NORMAL |
| `mobile.roaming` | Roaming | toggle | READ_VERIFIED | UNMAPPED | HIGH | NORMAL |
| `mobile.sim-slot` | Khe SIM | select | READ_VERIFIED | UNMAPPED | HIGH | LOCAL_SENSITIVE |
| `mobile.sim-pin-protect` | Bảo vệ SIM PIN | toggle | READ_VERIFIED | UNMAPPED | HIGH | SECRET |
| `mobile.cloud-sim-auto` | Cloud SIM tự động | toggle | READ_VERIFIED | UNMAPPED | HIGH | LOCAL_SENSITIVE |
| `mobile.cloud-sim-notification` | Thông báo Cloud SIM | toggle | READ_VERIFIED | UNMAPPED | LOW | NORMAL |
| `mobile.acquisition-order` | Acquisition order | select | READ_VERIFIED | UNMAPPED | HIGH | NORMAL |
| `mobile.scan-mode` | Scan mode | select | READ_VERIFIED | UNMAPPED | HIGH | NORMAL |
| `mobile.nr5g-mode` | Chế độ 5G | select | READ_VERIFIED | UNMAPPED | HIGH | NORMAL |
| `mobile.band` | Band | select | READ_VERIFIED | UNMAPPED | HIGH | NORMAL |
| `mobile.band-lock` | Band lock | select | READ_VERIFIED | UNMAPPED | HIGH | NORMAL |
| `mobile.band-auto-unlock` | Tự mở khóa band | toggle | READ_VERIFIED | UNMAPPED | HIGH | NORMAL |
| `mobile.apn-profiles` | APN / profile dữ liệu | collection | INTENTIONALLY_NOT_MIRRORED | UNMAPPED | HIGH | SECRET |
| `mobile.data-usage` | Thống kê dữ liệu | read | READ_VERIFIED | CANDIDATE | MEDIUM | NORMAL |

## Wi‑Fi / AP

| ID | Setting / action | Kind | Read evidence | Write evidence | Danger | Privacy |
|---|---|---|---|---|---|---|
| `wifi.global-enable` | Bật/tắt Wi‑Fi tổng | toggle | READ_VERIFIED | CANDIDATE | HIGH | NORMAL |
| `wifi.ap-enable` | Bật/tắt AP | toggle | READ_VERIFIED | CANDIDATE | HIGH | NORMAL |
| `wifi.ssid` | Tên Wi‑Fi (SSID) | text | READ_VERIFIED | CANDIDATE | HIGH | NORMAL |
| `wifi.password` | Mật khẩu Wi‑Fi mới | password | INTENTIONALLY_NOT_MIRRORED | CANDIDATE | HIGH | SECRET |
| `wifi.security-mode` | Chế độ bảo mật Wi‑Fi | select | READ_VERIFIED | CANDIDATE | HIGH | NORMAL |
| `wifi.broadcast-ssid` | Phát SSID | toggle | READ_VERIFIED | CANDIDATE | MEDIUM | NORMAL |
| `wifi.frequency` | Tần số / band AP | select | READ_VERIFIED | CANDIDATE | HIGH | NORMAL |
| `wifi.channel` | Kênh Wi‑Fi | select | READ_VERIFIED | CANDIDATE | MEDIUM | NORMAL |
| `wifi.mode` | Chế độ Wi‑Fi | select | READ_VERIFIED | CANDIDATE | MEDIUM | NORMAL |
| `wifi.standard` | Chuẩn 802.11 | select | READ_VERIFIED | CANDIDATE | MEDIUM | NORMAL |
| `wifi.bandwidth` | Bandwidth | select | READ_VERIFIED | CANDIDATE | MEDIUM | NORMAL |
| `wifi.max-clients` | Số client tối đa | number | READ_VERIFIED | CANDIDATE | MEDIUM | NORMAL |
| `wifi.tx-power` | Công suất phát | select | UNMAPPED | CANDIDATE | MEDIUM | NORMAL |
| `wifi.privacy-separator` | Privacy / AP isolation | toggle | UNMAPPED | CANDIDATE | MEDIUM | NORMAL |

## LAN / DHCP / Routing

| ID | Setting / action | Kind | Read evidence | Write evidence | Danger | Privacy |
|---|---|---|---|---|---|---|
| `lan.dhcp-enable` | DHCP Server | toggle | READ_VERIFIED | CANDIDATE | HIGH | NORMAL |
| `lan.gateway` | Gateway LAN | ipv4 | READ_VERIFIED | CANDIDATE | CRITICAL | NORMAL |
| `lan.subnet-mask` | Subnet mask | ipv4 | READ_VERIFIED | CANDIDATE | CRITICAL | NORMAL |
| `lan.dhcp-start` | DHCP start | ipv4 | READ_VERIFIED | CANDIDATE | HIGH | NORMAL |
| `lan.dhcp-end` | DHCP end | ipv4 | READ_VERIFIED | CANDIDATE | HIGH | NORMAL |
| `lan.lease-time` | DHCP lease time | duration | READ_VERIFIED | CANDIDATE | MEDIUM | NORMAL |
| `lan.dns-proxy` | DNS proxy | toggle | READ_VERIFIED | CANDIDATE | MEDIUM | NORMAL |
| `lan.dns-address` | DNS address | text | READ_VERIFIED | CANDIDATE | MEDIUM | NORMAL |
| `lan.ip-mac-bindings` | IP/MAC binding | collection | COUNT_ONLY | CANDIDATE | HIGH | LOCAL_SENSITIVE |
| `lan.port-forwarding` | Port forwarding | collection | COUNT_ONLY | UNMAPPED | CRITICAL | LOCAL_SENSITIVE |
| `lan.ipv4-filters` | IPv4 packet filters | collection | COUNT_ONLY | UNMAPPED | CRITICAL | LOCAL_SENSITIVE |
| `lan.ipv6-filters` | IPv6 packet filters | collection | COUNT_ONLY | UNMAPPED | CRITICAL | LOCAL_SENSITIVE |

## USB / Bridge / Ethernet

| ID | Setting / action | Kind | Read evidence | Write evidence | Danger | Privacy |
|---|---|---|---|---|---|---|
| `connectivity.bridge-enable` | IP Passthrough / Bridge | toggle | READ_VERIFIED | UNMAPPED | CRITICAL | NORMAL |
| `connectivity.bridge-lan-type` | Bridge LAN type | select | READ_VERIFIED | UNMAPPED | CRITICAL | NORMAL |
| `connectivity.usb-tether` | USB tethering | toggle | READ_VERIFIED | CANDIDATE | HIGH | NORMAL |
| `connectivity.usb-speed` | USB speed/type | select | READ_VERIFIED | CANDIDATE | MEDIUM | NORMAL |
| `connectivity.ethernet-type` | Ethernet type | select | READ_VERIFIED | UNMAPPED | HIGH | NORMAL |
| `connectivity.cradle-screen-saver` | Cradle screen saver | toggle | READ_VERIFIED | UNMAPPED | LOW | NORMAL |

## Pin / Nguồn / Màn hình

| ID | Setting / action | Kind | Read evidence | Write evidence | Danger | Privacy |
|---|---|---|---|---|---|---|
| `power.safe-charge` | Safe Charge | toggle | READ_VERIFIED | CANDIDATE | MEDIUM | NORMAL |
| `power.long-life` | Long Life Charging | toggle | READ_VERIFIED | GUARDED_PENDING_HARDWARE_ACCEPTANCE | MEDIUM | NORMAL |
| `power.mode` | Power saving mode | select | READ_VERIFIED | CANDIDATE | MEDIUM | NORMAL |
| `power.auto-sleep-switch` | Auto sleep | toggle | READ_VERIFIED | CANDIDATE | LOW | NORMAL |
| `power.auto-sleep-timer` | Auto sleep timer | duration | READ_VERIFIED | CANDIDATE | LOW | NORMAL |
| `power.ac-autostart` | AC auto-start | toggle | READ_VERIFIED | CANDIDATE | MEDIUM | NORMAL |
| `power.lcd-timeout` | Tắt LCD sau | duration | READ_VERIFIED | CANDIDATE | LOW | NORMAL |
| `power.eco-display` | Eco display | toggle | READ_VERIFIED | CANDIDATE | LOW | NORMAL |
| `power.pseudo-enable` | Pseudo enable | toggle | READ_VERIFIED | UNMAPPED | LOW | NORMAL |

## Bảo mật / WPS / Firewall / DMZ

| ID | Setting / action | Kind | Read evidence | Write evidence | Danger | Privacy |
|---|---|---|---|---|---|---|
| `security.wps-enable` | WPS | toggle | READ_VERIFIED | CANDIDATE | HIGH | NORMAL |
| `security.wps-mode` | WPS mode | select | READ_VERIFIED | CANDIDATE | HIGH | NORMAL |
| `security.wifi-mac-filter-mode` | Wi‑Fi MAC filter | select | READ_VERIFIED | CANDIDATE | CRITICAL | LOCAL_SENSITIVE |
| `security.protection` | Security protection | toggle | READ_VERIFIED | CANDIDATE | HIGH | NORMAL |
| `security.mac-filter-type` | MAC filter type | select | READ_VERIFIED | UNMAPPED | CRITICAL | LOCAL_SENSITIVE |
| `security.ip-filter-type` | IP filter type | select | READ_VERIFIED | UNMAPPED | CRITICAL | LOCAL_SENSITIVE |
| `security.dmz-enable` | DMZ | toggle | READ_VERIFIED | UNMAPPED | CRITICAL | LOCAL_SENSITIVE |
| `security.dmz-target` | DMZ target IP | ipv4 | INTENTIONALLY_NOT_MIRRORED | UNMAPPED | CRITICAL | LOCAL_SENSITIVE |

## Thiết bị / Client

| ID | Setting / action | Kind | Read evidence | Write evidence | Danger | Privacy |
|---|---|---|---|---|---|---|
| `devices.connected-list` | Danh sách thiết bị kết nối | collection | READ_VERIFIED | NOT_APPLICABLE | LOW | LOCAL_SENSITIVE |
| `devices.client-admin` | Quản trị từng client (nếu Web UI có) | action-family | UNMAPPED | UNMAPPED | HIGH | LOCAL_SENSITIVE |

## Current blockers

- Human confirmation of exact stock Web UI page/navigation structure.
- Human confirmation of controls not represented by current HAR/source/read-key evidence.
- Exact stock UI placement/labeling of APN/eSIM/client administration/factory reset/FOTA actions.
- Write request shapes and rollback semantics for all candidates except the existing guarded Long Life experiment.
- Independent semantics of Safe Charge versus Long Life Charging.

## Completion rule

WP01 remains **ACTIVE** until a human comparison against the real NC03_8.00.42 stock Web UI confirms coverage. Automated evidence can prepare the inventory, but it cannot self-approve this acceptance gate.

After human confirmation, the inventory is corrected once, exact-revision CI is rerun, WP01 may become COMPLETE, and only then may **NC03-WP02 — Canonical settings and capability registry** become ACTIVE.
