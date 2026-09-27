# NC03 Control Center — Project Constitution

Status: **ENFORCED PROJECT LAW**

NC03 inherits `blueprint-os:universal-century-grade@1.1.0` at **B4 PLATFORM** and strengthens it with device-control laws.

## Authority order

`Universal Constitution → .blueprint canonical state → Work Package → contracts/registry → implementation → tests/evidence → prompt projection`

Chat history, screenshots, README prose and generated prompts cannot silently override canonical state.

## Root cause before patch

A symptom fix is invalid when it leaves the owning architectural defect intact.

Forbidden:
- duplicate runtime/version workarounds instead of one compatibility contract;
- repeated CSS overrides instead of design-system correction;
- screen-specific modem request code instead of capability/adapter/application ownership;
- catch-and-ignore to make UI look healthy;
- weakening tests to recover green CI;
- a second source of truth for the same setting/session/capability.

Emergency P0/P1 containment requires a regression test, removal trigger and follow-up ownership.

## Authority boundaries

- Browser UI owns interaction state only.
- Local Bridge owns modem network transport and in-memory session continuity.
- Credential Vault owns optional encrypted local credential persistence.
- Capability/settings registry owns whether a setting is readable/writable and why.
- Firmware profile owns vendor mapping.
- Application Management owns neither modem credentials nor modem command authority.

## Read law

Every read contract defines stable domain ID, source evidence, parser/normalizer, unavailable/error semantics, freshness semantics and privacy classification. Raw vendor fields are not product contracts.

## Write law

Every state-changing operation follows one shared lifecycle:

`CURRENT READBACK → PREFLIGHT → CONCURRENCY CHECK → WRITE → POST-CONDITION READBACK → RESULT`

Failure:

`FAILURE → ROLLBACK/RECOVERY → ROLLBACK READBACK → EXPLICIT FINAL STATE`

Family code may specialize mapping; it may not bypass the shared safety lifecycle.

## Stock Web UI parity law

Stock Web UI is an evidence/reference surface, not architecture authority.

Mirror verified jobs and semantics. Improve poor vendor UX. Do not copy insecure credential exposure, accidental coupling, ambiguous errors or duplicated navigation.

## Product quality law

Every user surface must have calm hierarchy, one design system, deliberate responsive composition, accessible focus/touch/contrast and first-class loading/error/session-expiry/offline/recovery states. “It works” is not commercial-quality acceptance.

## Durability and compatibility law

Frontend shell, Local Bridge runtime protocol, settings contract, firmware profile and Application Management contract are separately versioned boundaries. Compatibility failure is diagnosed, never hidden.

Firmware/profile expansion must not require rewriting canonical product meaning.

## Security and resilience law

Assume any UI surface, local process, provider or integration can fail. Minimize credential exposure, contain compromise, protect authoritative state, make dangerous operations explicit and recover to a known state.

## Sequential execution law

The current Blueprint defines exactly **18 prompt projections (00–17)**. One Work Package is ACTIVE at a time. Prompt N+1 starts only after Prompt N is COMPLETE with evidence.

If new evidence changes architecture, update canonical blueprint/work-package state first, then update affected prompts.
