# Changelog

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
