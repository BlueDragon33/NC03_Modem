# NC03 Canonical Settings & Capability Registry

Status: **WP02 implementation baseline · schema v1**

The canonical registry lives in `src/domain/NC03SettingsRegistry.js` and is the authoritative setting/action model for product UI capability state.

## Authority

Stable product identity is the canonical ID, for example:

- `wifi.ssid`
- `lan.dhcp-enable`
- `connectivity.bridge-enable`
- `power.long-life`
- `security.dmz-enable`
- `system.reboot`

Vendor endpoints and vendor field names are **evidence/profile mapping**, never durable product identity.

## Lifecycle

`UNMAPPED → READ_MAPPED → WRITE_CANDIDATE → WRITE_VERIFIED → HARDWARE_ACCEPTED`

Rules:

- `UNMAPPED`: no usable product contract yet.
- `READ_MAPPED`: read semantics are mapped.
- `WRITE_CANDIDATE`: write evidence exists but the setting is not authorized for UI mutation.
- `WRITE_VERIFIED`: request/readback/recovery evidence is complete enough for guarded product write.
- `HARDWARE_ACCEPTED`: the operation has real-device acceptance evidence.

The UI must use `capability.writable`; implementation existence alone does not authorize a write.

## Current v1 inventory

- 77 canonical entries, exactly matching the WP01 parity inventory.
- 74 stock-facing entries.
- 3 internal firmware-state entries.
- 33 `READ_MAPPED`.
- 41 `WRITE_CANDIDATE`.
- 2 `UNMAPPED`.
- 1 `HARDWARE_ACCEPTED` (`auth.login`).
- 0 ordinary settings are currently `WRITE_VERIFIED`.

The existing Long Life Charging runtime endpoint remains implemented as evidence, but `power.long-life` is intentionally `WRITE_CANDIDATE` until the later write-engine/hardware gates prove it.

## UI ownership

Settings UI now gets label/capability lifecycle from the canonical registry and does not display vendor write routes as setting authority.

Internal states not observed in the stock UI are not promoted into ordinary settings controls.

## Compatibility

`src/modem/CapabilityRegistry.js` remains as a legacy module-level compatibility view, but it is generated from the canonical registry rather than maintaining a second capability truth.

## Evidence

- source inventory: `evidence/stock-webui-parity.v1.json`
- mapping report: `evidence/wp02-settings-registry-mapping.v1.json`
- schema: `control/nc03-settings-registry.schema.json`
- automated invariants: `tests/settings-registry.test.mjs`
