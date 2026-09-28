# NC03 Architecture Consolidation — WP03

Status: **IMPLEMENTATION BASELINE**

WP03 consolidates the v0.7.x/v0.8.x working behavior into explicit ownership boundaries so future prompts extend the system instead of adding screen-specific patches.

## Dependency direction

`Product UI → Application Client / Use-Cases → Domain Registry → Firmware Adapter/Profile → Local Bridge → Physical Modem`

No layer may reach around the layer immediately below it for convenience.

## Ownership ledger

| Area / module | Decision | Canonical owner | Reason |
|---|---|---|---|
| `app.js` direct `fetch()` to Local Bridge | **RETIRE** | `src/application/NC03ControlClient.js` | UI should express user intent, not own transport/envelope/runtime compatibility. |
| `localHealth()` / `localRead()` in `app.js` | **RETIRE** | `NC03ControlClient` | One Local Bridge transport/error contract. |
| Runtime protocol/schema validation in UI | **MOVE** | `NC03ControlClient` + `RuntimeProtocol.js` | Avoid duplicated stale-runtime checks. |
| Login UI state / messages | **KEEP** | Product UI | Presentation and user interaction belong to UI. |
| Login Local Bridge request | **MOVE** | `NC03ControlClient.login()` | Application boundary owns request/response contract. |
| Snapshot/details/doctor/audit/probe requests | **MOVE** | `NC03ControlClient` | Named application operations replace arbitrary route calls. |
| Optional remembered admin credential | **KEEP** | `SecureCredentialVault.js` | Explicit encrypted local persistence boundary. |
| Modem session cookie jar | **KEEP** | Local Bridge / `NC03LocalCookieJar.js` | Session never belongs to browser UI/control plane. |
| Capability/write authority | **KEEP** | `NC03SettingsRegistry.js` | Established in WP02 as one canonical truth. |
| Legacy module capability matrix | **KEEP AS DERIVED VIEW** | `CapabilityRegistry.js` derived from Registry | Compatibility without a second truth. |
| Firmware 8.00.42 route/field mapping | **KEEP** | firmware profile/adapter/discovery modules | Vendor semantics stay outside domain/UI. |
| Firmware capability overlays rendered directly by UI | **RETIRE** | canonical registry compatibility view | Product UI must not merge firmware/HAR capability truth itself. |
| Guarded Long Life implementation | **KEEP AS CANDIDATE** | Local Bridge/write runtime | Later WP06 will rewrite into generic transaction engine. |
| Monolithic write error wording in UI | **KEEP TEMPORARILY** | Product UI | Presentation wording remains UI-owned; normalized error taxonomy can move during WP04/WP06. |
| Read normalization currently returned by adapter/details | **KEEP TEMPORARILY** | Firmware adapter | WP05 owns full read-domain normalization. |

## Stable authority boundaries

- **Product UI** owns rendering, form state, confirmations and user-facing messages.
- **Application layer** owns Local Bridge endpoint selection, envelope validation, timeout/error transport and runtime compatibility checks.
- **Domain Registry** owns stable setting/action identity, capability lifecycle, safety/privacy metadata and write authorization state.
- **Firmware profile/adapter** owns vendor endpoint/field/codec semantics.
- **Local Bridge** owns physical modem transport, RFC1918 policy and in-memory modem session.
- **Credential Vault** owns optional encrypted local credential persistence.
- **Application Management** remains metadata/control-plane only.

## Removed patch paths

WP03 removes the two generic UI transport helpers `localHealth()` and `localRead()` and all direct `fetch()` use from `app.js`.

The developer capability table no longer merges firmware-profile and HAR2 overlays in the browser. It uses the registry-derived compatibility view, while raw firmware/HAR evidence remains available in the Developer Lab.

## Deferred by ownership

- Auth/session state-machine refinement → WP04.
- Full read-domain normalization → WP05.
- Generic guarded write transaction engine → WP06.
- Family-specific writes → WP07–WP14.
- Final design-system refactor → WP15.

Deferral is deliberate ownership, not technical debt hiding.
