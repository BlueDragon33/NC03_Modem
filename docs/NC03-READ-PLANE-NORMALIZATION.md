# NC03 Read Plane Normalization — WP05

Status: **IMPLEMENTED · REAL-HARDWARE POST-REFactor PARITY PENDING**

## Canonical contract

Local Bridge now converts firmware/vendor-specific read payloads into the versioned domain contract:

`nc03-read-model/v1`

Product UI and diagnostic reporting consume only normalized field names.

## Boundary

`Firmware Adapter raw fields → NC03ReadModel normalizer → Local Bridge API → NC03ControlClient → Product UI`

Vendor keys such as `mnet_*`, `rt_*`, `device_*`, `ntp_*` and `statistics_*` no longer cross into Product UI business logic.

## Read families

Normalized details provide:
- mobile;
- wifi;
- lan;
- connectivity;
- power;
- security;
- system;
- dataUsage;
- rules;
- clients;
- firmware;
- deviceState.

Live reads remain `status / battery / signal` under the same versioned schema.

## Freshness

Every read model carries `meta.freshness` with explicit FRESH/STALE semantics. Unknown vendor boolean tokens become `null`, never guessed true/false.

## Privacy

The normalizer is allow-list based. Current Wi-Fi PSK, modem credential/session, ICCID/EID, IMEI and APN profile secrets are not added to the domain contract.

## Remaining gate

Run the post-refactor branch against the real NC03 and verify that Home, Network, Wi-Fi, Devices and Settings still show the same real data as before. This is a parity confirmation only; no write operation is required in WP05.
