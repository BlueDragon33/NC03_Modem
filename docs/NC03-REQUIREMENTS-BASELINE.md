# NC03 Control Center — Requirements Baseline

Status: **CANONICAL PRODUCT BASELINE v1.0**

## Mission

Build a modern local-first Website-App/PWA that can replace the stock HYBRID Wi-Fi 5G NC03 Web UI for normal administration while leaving modem firmware untouched.

This is not merely a telemetry dashboard. It must eventually provide the settings/actions genuinely supported by the stock Web UI, but only after each operation is mapped and verified against real firmware behavior.

## Required experience

- Login to NC03 before entering administration.
- Optional remembered admin credential only in encrypted local storage after verified authentication.
- Read current modem state with explicit freshness/error semantics.
- Professional modem-administration information architecture.
- Settings changes flow back to the real modem with explicit result/recovery.
- Local-first installable PWA.
- Deliberate desktop, tablet/iPad and mobile UX.
- Application Management integration without moving modem credential/session authority to that control plane.

## Functional parity target

1. Mobile network / SIM / APN / band / roaming.
2. Wi-Fi / AP profiles / SSID / security / channel / bandwidth / client limit.
3. LAN / DHCP / routing / reservations and supported rules.
4. USB / Bridge / IP Passthrough / Ethernet.
5. Power / battery / charging / display / sleep.
6. Security / WPS / MAC-IP filter / firewall / DMZ.
7. System / time / firmware / admin / reboot-reset operations.
8. Devices / connected-client administration where the stock UI actually supports it.

“Parity” means evidence-backed user jobs and semantics, not labels copied from the vendor interface.

## Safety/privacy baseline

- No endpoint, request field, result code or rollback behavior is invented.
- Raw private HAR is never committed.
- Password/session/cookie/current Wi-Fi PSK/IMEI/ICCID/EID are not mirrored into ordinary UI state.
- Dangerous actions have stronger confirmation and recovery rules than normal toggles.
- A setting is writable only through the canonical guarded-write engine after capability evidence permits it.
- Production mutation is never inferred from green CI or a merged PR.

## Engineering reset

Starting with Blueprint v1.0:
- every normal code change belongs to a Work Package;
- no new symptom-driven `Phase 2AA/AB/...` sequence;
- systemic defects are repaired at the owning layer;
- README is not a patch diary;
- prompts are execution projections, not source-of-truth;
- Prompt N+1 cannot start until Prompt N has gate evidence.
