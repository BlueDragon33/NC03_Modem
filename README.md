# NC03 Control Center

Website-app/PWA quản trị modem **HYBRID Wi-Fi 5G NC03** theo hướng **local-first**, mục tiêu thay thế trải nghiệm Web UI gốc bằng giao diện hiện đại nhưng vẫn giữ đúng chức năng quản trị thực tế của modem.

## Current baseline

- Release line: **v0.8.0**
- Blueprint: **1.0.0**
- Classification: **B4 PLATFORM**
- Universal Constitution: **blueprint-os:universal-century-grade@1.1.0**
- Reference firmware: **NC03_8.00.42**
- Execution mode: **strict serial Work Packages**
- Active Work Package: **NC03-WP03 — Architecture consolidation**
- Prompt projections: **18 prompts, 00–17**

The previous v0.7.x line remains valuable historical evidence, but it is no longer the planning model.

## Product mission

NC03 Control Center is not a telemetry-only dashboard.

The target product must:
- login to the real modem;
- read current modem state reliably;
- expose the settings/jobs genuinely supported by the stock Web UI;
- apply verified settings back to the modem;
- validate post-condition and recover/rollback when appropriate;
- remain local-first and installable as a PWA;
- work deliberately on desktop, tablet/iPad and phone;
- integrate with Application Management without transferring modem credential/session authority.

Canonical requirements: `docs/NC03-REQUIREMENTS-BASELINE.md`.

## Engineering law

Development now follows:

`CONSTITUTION → PROJECT PROFILE → BLUEPRINT → WORK PACKAGE → PROMPT PROJECTION → IMPLEMENT → TEST → GATE → EVIDENCE → NEXT PACKAGE`

Prime rules:
- **Root cause before patch.**
- **Contracts before components.**
- **Canonical state before prompt projection.**
- **One source of truth per concept.**
- **Do not invent modem endpoints or request semantics.**
- **Do not start Prompt N+1 before Prompt N is COMPLETE with evidence.**
- **Green CI is necessary, not sufficient for product PASS.**

Project law: `docs/NC03-PROJECT-CONSTITUTION.md`.

## Canonical source of truth

- `.blueprint/constitution-adoption.json` — Universal Constitution adoption.
- `.blueprint/project-profile.json` — project identity, constraints and intent.
- `.blueprint/blueprint.json` — target architecture and required gates.
- `.blueprint/work-packages.json` — canonical execution graph and status.
- `docs/NC03-ARCHITECTURE-BLUEPRINT.md` — readable architecture projection.
- `docs/NC03-PROMPT-EXECUTION-PROTOCOL.md` — prompt execution law.
- `prompts/README.md` — ordered prompt index.

Prompt files are execution projections only; they never outrank `.blueprint/*`.

## Canonical Settings Registry

WP02 established `nc03-settings-registry/v1` with 77 stable setting/action IDs. UI capability state now comes from this registry; vendor routes/field names remain firmware evidence only. Ordinary settings are fail-closed until their lifecycle reaches `WRITE_VERIFIED`.

## Architecture direction

Stable dependency direction:

`Product UI → Application Use-Cases → Canonical Settings/Capability Registry → Domain Contracts → Firmware Adapter/Profile → Local Bridge → Physical Modem`

The UI must not contain raw modem transport/write logic.

Firmware-specific endpoint/field semantics live in profiles/adapters so future firmware support does not require duplicating the product.

## Current verified baseline from v0.7.x

The existing implementation already provides useful evidence to preserve during consolidation:
- login-first NC03 authentication;
- runtime login recipe discovery for firmware 8.00.42;
- in-memory modem session continuity;
- optional encrypted local credential vault;
- live/read snapshot path through Local Bridge;
- privacy-safe HAR/source analysis tools;
- PWA/runtime version coherence protections;
- modem-style Settings Center;
- first guarded Long Life Charging write path;
- Application Management local-first contract.

These are **baseline behaviors to audit and migrate**, not permission to keep every existing implementation path unchanged.

## Planned execution sequence

The canonical plan contains exactly 18 Work Packages:

00. Constitution / anti-patch baseline  
01. Stock Web UI parity inventory  
02. Canonical settings & capability registry  
03. Architecture consolidation  
04. Authentication/session lifecycle  
05. Read-plane normalization  
06. Guarded write engine v2  
07. Wi-Fi parity  
08. LAN/DHCP/routing parity  
09. USB/Bridge/Ethernet parity  
10. Power/battery/display parity  
11. Security/WPS/firewall/DMZ parity  
12. Mobile network/SIM/APN/band parity  
13. System/time/firmware/admin operations  
14. Device/client administration parity  
15. Product UX/design-system acceptance  
16. Reliability/security/ecosystem integration  
17. Real-hardware acceptance & release evidence

See `prompts/README.md`.

## Local run

PowerShell:

```powershell
npm.cmd run serve:local
```

Default standalone runtime:

`http://127.0.0.1:3006`

When launched by Application Management, the configured local runtime may use another port such as `3010`; always use the address printed by the runtime.

## Verification

```powershell
npm.cmd run verify
```

The verification chain includes the canonical Blueprint/prompt drift check.

Universal Constitution compliance also runs through the repository workflow backed by Software-Blueprint-Hub.

## Privacy and trust boundaries

- Modem password/session/cookie are never sent to cloud control planes.
- Current Wi-Fi PSK is not mirrored into ordinary app state.
- Raw private HAR is not committed.
- Local Bridge owns modem transport/session continuity.
- Application Management is metadata/control-plane integration only.
- Production release remains a separate explicit decision.

## Historical development record

The detailed v0.7.x discovery/fix chronology remains in `docs/PHASE_STATUS.md` as **legacy evidence history**.

Do not extend that history with new symptom-numbered phases. New work belongs to canonical Work Packages.
