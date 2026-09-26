# Changelog

## 0.7.0 — Professional QA + diagnostic reporting

- Added a professional A4 diagnostic report with Print / Save PDF support.
- The report is privacy-safe by construction: it selects approved read-only fields and excludes modem credentials, tokens/sessions, Wi-Fi PSK, IMEI/serial, ICCID/EID/eSIM/APN data and raw rules.
- Home now labels stale data usage and client counts as last-known instead of implying they are current.
- Connected-device fallback wording changed from "Online" to "Đã ghi nhận" when the modem did not provide an explicit state/time.
- Remember-password UX no longer shows a disabled-but-checked checkbox before AUTH is verified.
- Battery values outside 0–100 are rejected instead of displayed as valid percentages.
- Desktop quick actions now use a balanced four-column layout; keyboard focus and 44px control targets are enforced.
- Added dedicated report privacy/XSS tests and expanded UX release gates.

## 0.6.3 — Final read-path hardening

- Keep stale/reconnecting state correct across navigation so Sidebar/Home/Network cannot falsely turn green from last-known data.
- Show the timestamp of the most recent successful live telemetry refresh.
- Track Advanced snapshot freshness separately and expose LIVE READ / LAST GOOD / retry behavior.
- Show a clear error when the Advanced snapshot has never loaded instead of silently rendering empty values.
- Keep Remember Password visibly disabled until the real NC03 authentication request is verified.
- Reject invalid manual modem addresses with an inline RFC1918 validation message instead of silently replacing the user's input.
- Synchronize release contract policies for these final read-path guarantees.

## 0.6.2 — Resilient last-known-good telemetry

- Preserve the last-known-good exact battery %, signal and network values across transient 10-second polling failures.
- Mark stale telemetry as reconnecting / last-known rather than falsely showing it as current.
- Keep connection state current while retaining the most recent safe telemetry values.
- Unify UI address validation, persisted preferences and Local Bridge origin policy around RFC1918 IPv4 only.
- Repair invalid/stale persisted modem origins automatically to the safe default.
- Cache LocalBridgePolicy in the PWA release artifact.

## 0.6.1 — Stable 10-second telemetry UX + safe inventory

- Stopped the 10-second telemetry loop from re-rendering the whole page; only live fields update in place.
- Polling pauses while the tab is hidden, avoids overlapping requests, and refreshes immediately when the tab becomes visible.
- Local Bridge now accepts RFC1918 IPv4 modem origins only and rejects loopback/public/hostname targets.
- Added read-only Mobile Data, SIM PIN protection, Cloud SIM auto-switch status.
- Added count-only DHCP reservation, port-forwarding, IPv4 packet-filter and IPv6 packet-filter inventory without mirroring raw IP/MAC/rule data.
- Changed PWA cache to stale-while-revalidate so published app updates replace stale cached assets.
- Corrected runtime/transport documentation and local launch instructions.

## 0.6.0 — HAR2 live telemetry + extended read-only modem coverage

- Added always-visible exact battery %, connection status, signal quality and 4G/5G/carrier strip.
- Added automatic 10-second refresh for live telemetry.
- Added safe Local Bridge endpoints `/api/nc03/snapshot` and `/api/nc03/details`.
- Expanded verified read-only coverage for network settings, SIM/eSIM metadata, four Wi-Fi APs, USB/Cradle, IP Passthrough, firewall/security state, NTP, power/display and firmware/FOTA.
- Kept RSRP/RSRQ/SINR absent because the new HAR does not expose those exact metrics.
- Explicitly excluded Wi-Fi PSK, IMEI/serial, ICCID/EID/eSIM and APN profile secrets from mirrored snapshots.
- Kept all write controls locked because this HAR contains no observed write transaction.

## 0.5.1 — Simplified password-only login policy

- Standardized login UX to configurable modem address + password only.
- Defaulted modem address to `http://192.168.0.1` while allowing another local address.
- Replaced separate Remember/Admin + Auto Login options with one `Ghi nhớ mật khẩu` preference, enabled by default.
- Enforced policy that a credential may only be persisted after successful modem authentication.
- Added modem-address normalization tests.

## 0.5.0 — First real NC03 HAR mapping

- Mapped observed read endpoints from a real NC03 firmware 8.00.42 HAR without committing the private raw capture.
- Confirmed exact battery percentage is available through `device_battery_percent`.
- Added firmware 8.00.42 route/capability profile and read-only adapter.
- Catalogued write endpoints discovered in vendor JavaScript as PARTIAL only; no write control was enabled.
- Added tests for exact battery parsing, status/client reads and fail-closed writes.
- Fixed README/phase formatting artifacts from v0.4.0.

## 0.4.0 — Pre-HAR discovery & credential vault

- Added encrypted local credential-vault foundation using AES-GCM with a non-extractable browser CryptoKey.
- Kept remember-admin and auto-login controls locked until the real NC03 auth/session flow is VERIFIED.
- Added heuristic HAR module hints for auth, battery, Wi-Fi, clients, mobile network, data usage, DHCP/LAN, bridge/router and system requests.
- Candidate hints never promote an endpoint to VERIFIED or WRITE VERIFIED.
- Added unit coverage for at-rest credential encryption and HAR hint/redaction behavior.

## 0.3.0 — Phase 1 finalization

- Separated API operation type from HTTP method so POST can be read-only and every write operation requires WRITE VERIFIED.
- Made unsupported logout fail-closed without silently clearing local session.
- Fixed Mock Mode connected-device count mismatch.
- Added PWA icon, manifest id/scope and a new offline cache version.
- Added OFFLINE PASS release gate against the verified dist artifact.
- Refreshed Phase status, architecture and discovery documentation.

## 0.2.0 — Phase 1 spec hardening

- Moved API Discovery out of primary navigation into Advanced Developer Mode.
- Restored the required five primary tabs: Home, Network, Wi-Fi, Devices, Settings.
- Added Basic / Advanced interface modes.
- Moved Mock Mode into Developer tooling and retained explicit DEMO DATA labeling.
- Added NC03Auth, NC03Api, NC03Session, NC03Parser, NC03Capabilities and connection-state boundaries.
- Added static contract, lint, integration, UX and security release gates.
- Added Phase status document.
- Kept all real modem write actions locked until WRITE VERIFIED.

## 0.1.0 — Foundation

- Initial PWA shell, NC03Adapter, HAR discovery, capability registry, mock adapter, login/dashboard skeleton and CI.
