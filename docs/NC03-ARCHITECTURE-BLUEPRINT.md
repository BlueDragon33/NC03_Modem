# NC03 Control Center — Architecture Blueprint

Status: **TARGET ARCHITECTURE v1.0 · B4 PLATFORM**

## Stable layers

1. Product UI — information architecture, form state, feedback, accessibility; no raw modem calls.
2. Application Use-Cases — Login, Refresh Snapshot, Apply Setting, Dangerous Operation, Diagnostic Export.
3. Canonical Settings & Capability Registry — stable IDs, types, validation, sensitivity, read/write evidence, UI metadata.
4. NC03 Domain Contracts — versioned read models, typed commands, normalized results/errors.
5. Firmware Adapters / Profiles — NC03_8.00.42 mapping and future profile compatibility.
6. Local Bridge — RFC1918 policy, session jar, transport, runtime identity, diagnostics.
7. Physical Modem — final authority for actual device state.

## Write transaction abstraction

Every family plugs into one transaction engine:
- capability preflight;
- current readback capture;
- expected value/revision guard where firmware permits;
- request serialization;
- success interpretation;
- post-condition polling;
- rollback/recovery;
- final readback;
- privacy-safe audit result.

UI never owns rollback logic.

## Capability lifecycle

`UNMAPPED → READ_MAPPED → WRITE_CANDIDATE → WRITE_VERIFIED → HARDWARE_ACCEPTED`

Only evidence can move lifecycle state.

## B4 platform rule

Canonical settings/domain contracts stay firmware-neutral where practical. Firmware-specific endpoint/field semantics live in versioned profiles/adapters. Adding a future NC03 firmware profile must not require duplicating the whole product UI.

## Canonical source files

- `.blueprint/constitution-adoption.json` — universal law adoption.
- `.blueprint/project-profile.json` — identity, constraints and product intent.
- `.blueprint/blueprint.json` — architecture/modules/gates.
- `.blueprint/work-packages.json` — execution graph/status.
- setting/capability registry from WP02 — item-level truth.
- prompt files — projections only.

## Migration from v0.7.x

Existing working behavior is evidence to preserve, not architecture to preserve blindly.

WP01–WP03 classify paths:
- **KEEP** — fits target ownership.
- **MOVE** — correct behavior, wrong owner.
- **REWRITE** — coupled/duplicated behavior.
- **RETIRE** — patch/obsolete compatibility path.

No broad settings expansion before this migration baseline is reviewed.
