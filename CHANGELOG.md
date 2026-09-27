# Changelog

## 0.7.30 — WebUI-style Settings Center

- Rebuilt the Settings page around the same functional groups users expect from the stock modem Web UI: Mobile Network, Wi-Fi, LAN/DHCP, USB/Bridge, Power, Security, and System.
- Added an internal settings navigation rail on desktop and horizontally scrollable category tabs on smaller screens.
- Wi-Fi now has interactive AP profile tabs and form-style fields for SSID, security, frequency, channel, standard, bandwidth, max clients, AP state and SSID broadcast.
- LAN/DHCP, mobile-network, connectivity, security, power and system data are now presented as real form controls instead of passive read-only stat cards.
- Controls without a verified write path deliberately render disabled while still showing the current modem value and the discovered vendor route family.
- Long Life Charging remains the only active guarded write control; its preflight/readback/rollback behavior is unchanged.
- Current Wi-Fi PSK is never mirrored or prefilled. The password field intentionally stays blank until a verified change-password flow is implemented.
- Settings now disclose write coverage explicitly instead of making the whole page appear writable.
- Removed the duplicated Developer Tools panel from the old Settings layout.

## 0.7.29 — First guarded modem setting write

- The Settings page is no longer completely read-only: the battery Safe Charge / Long Life path now has the first guarded write control.
- The Local Bridge preflights the firmware write endpoint, request shape, transport and current readback before sending any state-changing request.
- The write uses the already-authenticated in-memory modem session from v0.7.28.
- After the modem accepts the request, the bridge polls the verified power readback and only reports success when the requested state is observed.
- If the post-condition does not match, the bridge automatically sends the inverse/original value and verifies rollback.
- Ambiguous fields, unknown toggle encodings, missing readback or unresolved transport fail closed instead of guessing.
- Wi-Fi, DHCP, Bridge, Security and the remaining settings stay read-only until their own request + post-condition + rollback mapping is implemented.

## 0.7.28 — Local modem session continuity

- Fixed the live `AUTH_VERIFICATION_FAILED` path where the modem returned login success but the following `get_login_info` verification was sent without the modem session cookie.
- Added an in-memory cookie jar owned only by the Local Bridge.
- The login POST, post-login verification, and later read-only modem requests now share the same local modem session transport.
- Session cookies are never returned to the browser, never written to disk, and are cleared before a new login attempt and after failed authentication/verification.
- No WRITE capability is enabled by this change.

## 0.7.27 — Runtime login recipe resolver

- Fixed the real-device `LOGIN_RECIPE_INCOMPLETE` path shown after v0.7.26 login-first UX.
- The runtime parser no longer requires username HMAC input to be a string literal directly inside `_obj.username = ...`; it can resolve safe static indirection such as a fixed username variable.
- `loginKey` may now be resolved from the supporting firmware sources used by the login runtime instead of only from `login.js`.
- Password HMAC detection now follows a simple input alias (for example a variable assigned from `.val()`) instead of requiring the input call to be nested directly inside the HMAC call.
- Runtime discovery now includes the login page and MD5 helper source alongside login/tools/common/encryption.
- `/api/nc03/auth-readiness` returns only boolean readiness evidence so the UI can show which gate is missing without exposing loginKey, username literal, password, token, cookie or raw firmware source.
- Login remains fail-closed when any required recipe element is genuinely missing; WRITE remains independently locked.

## 0.7.26 — Login-first authentication UX

- Every fresh NC03 Control Center launch now renders the NC03 login screen first.
- Password input is always editable; AUTH readiness no longer disables the password field or blocks the user from typing.
- Clicking Login preflights the firmware AUTH recipe/transport and only then sends the credential to the local login bridge.
- The modem address typed on the login screen is normalized and used directly for the login attempt, so the user no longer has to press a separate Save button first.
- Persisted Developer Demo mode is cleared on launch and can no longer bypass the login screen after a reload.
- An already-detected modem session no longer auto-navigates to Home during bootstrap; entering the real app is an explicit login action.
- Credential persistence still happens only after verified login success; WRITE remains independently locked.

## 0.7.25 — PWA stale-tab self-heal

- Fixed the remaining upgrade path behind the screenshot where an already-open v0.7.23/v0.7.24 tab could keep executing stale `app.js` and display raw `METHOD_NOT_ALLOWED` even after a newer service worker had downloaded.
- The v0.7.25 service worker now removes the previous NC03 shell cache, claims clients, and reloads open NC03 windows once when an older shell was actually replaced.
- This recovery works even when the currently running page itself is old and therefore has no new frontend-side update listener yet.
- First install does not force an extra reload because the navigation step only runs when an older NC03 cache existed.
- Runtime/write safety is unchanged: WRITE readiness stays read-only and live WRITE remains fail-closed.

## 0.7.24 — WRITE readiness runtime gate

- Fixed a frontend/backend skew where the v0.7.23 WRITE Readiness UI could run against an older v0.7.22 Local Bridge because both still advertised runtime protocol v3.
- Runtime protocol is now `nc03-local-runtime/v4`.
- Added dedicated `nc03-write-readiness/v1` identity in health/runtime metadata.
- Frontend refuses WRITE readiness calls when the Local Bridge does not advertise the matching WRITE protocol.
- Read-only WRITE readiness probe accepts GET/POST for compatibility; production UI continues to use POST.
- `METHOD_NOT_ALLOWED` now explains that the Local Bridge is stale/mismatched instead of looking like a modem write rejection.
- Live WRITE remains locked; this change only fixes the evidence/readiness transport.


## 0.7.23 — Reversible Write Readiness Lab

- Added a read-only Write Readiness Lab for the first low-risk target: Long Life Charging / battery safe charge.
- Maps vendor-JS evidence for `/action/device_set_battery_safe_charge` without registering or calling the write route.
- Extracts transport helper, request-field candidates and safe toggle-like literal candidates with source/literal redaction.
- Reads the current battery-safe-charge state using the already verified read-only power snapshot.
- Builds an explicit reversible-capture checklist and keeps `writeEnabled=false`, `rollbackReady=false` until a real write HAR + rollback + post-condition are captured.
- Added `POST /api/nc03/write-readiness`; endpoint performs only static-source reads and verified power-state reads.
- WRITE remains fail-closed.


## 0.7.22 — AUTH startup and session lifecycle

- Added an explicit startup handshake: runtime/schema gate → AUTH readiness → live session probe → first stable screen.
- AUTH-required modems always route to the Login screen, even when the recipe is not ready yet; password controls remain disabled until AUTH READY.
- A previously verified session that later returns AUTHENTICATION_REQUIRED is classified as SESSION_EXPIRED instead of generic reconnecting.
- Live polling now rerenders immediately when AUTH changes the active view or connection state, so an expired session opens re-authentication without waiting for another full render.
- Login UI distinguishes first login from session re-authentication.
- Added SecureCredentialVault.js to the PWA offline shell so the remember-password flow does not break when the shell is running from cache.
- WRITE capabilities remain independently fail-closed.


## 0.7.21 — Runtime-gated modem login

- Promoted firmware 8.00.42 AUTH from source discovery to a real login flow after live evidence confirmed the request field, input path, HMAC-MD5 transform and success code 0.
- Added runtime discovery for the login recipe and the vendor `saveAjaxJsonData` transport.
- Added `/api/nc03/auth-readiness` and `/api/nc03/login`.
- The Local Bridge performs the transform locally and verifies the resulting modem session before reporting success.
- Unknown retcode 13 remains a generic rejection; no unsupported meaning is invented.
- Login controls remain locked unless recipe and transport are both resolved.
- Local encrypted remember-login storage is written only after verified success.
- Runtime protocol bumped to `nc03-local-runtime/v3`; WRITE capabilities remain independently locked.


## 0.7.21 — Verified real modem login

- Promoted firmware 8.00.42 AUTH from source discovery to a runtime-gated real login flow after live evidence confirmed request-object field evidence, password input, HMAC-MD5 and success retcode 0.
- Added `NC03LoginRuntime`: reads the login recipe and `saveAjaxJsonData` transport from local firmware source at runtime; login key and username literal never leave the Local Bridge.
- Added `POST /api/nc03/auth-readiness` and `POST /api/nc03/login`.
- The login endpoint hashes username/password locally, submits `/goform/login`, then verifies the resulting modem session before reporting success.
- Unknown retcode 13 remains a generic `LOGIN_REJECTED`; no unsupported semantic label is invented.
- Password input and Login button only unlock when recipe + transport are both runtime-verified.
- Remember-password now uses the existing AES-GCM local credential vault and persists only after verified login success.
- Runtime protocol bumped to `nc03-local-runtime/v3` so a v0.7.21 frontend cannot silently talk to an older Local Bridge.
- WRITE capabilities remain independently locked behind WRITE VERIFIED.


## 0.7.20 — Runtime schema gate

- Added a shared immutable runtime protocol descriptor used by both browser UI and Local Bridge.
- `/_local/health` now reports runtime protocol, AUTH evidence schema, probe transport and process boot timestamp from the code loaded at process start.
- AUTH Source Probe responses include the same runtime identity metadata.
- The UI blocks AUTH probing with `LOCAL_BRIDGE_RESTART_REQUIRED` when a new frontend is being served by an older in-memory Local Bridge.
- Prevents misleading default evidence such as `field evidence: 0` caused by frontend/backend schema drift.
- Production login/write remain fail-closed.


## 0.7.19 — Password field dataflow

- Adds redacted expression skeletons for login request fields so operators/call structure remain visible while literals are removed.
- Traces every observed reference to the password field inside login.js, including later helper calls.
- Separates “password input observed”, “password HMAC confirmed”, and “login success=0 confirmed” instead of treating any loginKey token as proof of hashing.
- Adds Password field dataflow and Password recipe status to the AUTH Lab.
- Production password login remains locked until the final password recipe is evidenced.


## 0.7.18 — Nested login transform tracing

- Replaced the flat login-expression regex with a balanced nested-call parser.
- Preserves outer transforms such as `hex_hmac_md5(loginKey, $(...).val())` instead of reporting only the inner `val()`.
- Adds call depth and dedicated **Nested AUTH transform** evidence for each login request-object field.
- Keeps literal values redacted while preserving structural argument types.
- This release is intended to confirm the exact transform applied to the real `_obj.password` field before production password login is enabled.
- Production `NC03Auth.login()` remains fail-closed until the live probe confirms the password transform and response semantics.


## 0.7.17 — Login request-object dependency tracing

- Follows the confirmed `postdata = JSON.stringify(_obj)` chain back into the request object serialized by the real firmware login flow.
- Traces request-object assignments, property assignments and helper calls up to two dependency levels without returning literal values.
- Surfaces per-field transform evidence so a password-like field can be tied to `hex_hmac_md5` / MD5 or other observed transforms before production login is enabled.
- Adds dedicated **Request object dependency trace** and **Login object fields / transforms** panels to the AUTH Lab.
- Response-code mapping is now limited to symbols/numeric values actually observed in the login response branch, avoiding unrelated constants from the same source file.
- Production password login remains locked until field/transform and success/failure semantics are coherent.


## 0.7.16 — AUTH probe cache/runtime compatibility

- Fixed `METHOD_NOT_ALLOWED` when a stale PWA frontend still calls AUTH Source Probe with legacy GET semantics while the Local Bridge has already been upgraded.
- `/api/nc03/auth-source-probe` now accepts the current POST transport and a read-only legacy GET compatibility path; GET falls back to the safe default RFC1918 modem origin when an older client sends no body.
- Switched the PWA shell from stale-while-revalidate to network-first with cache fallback so `app.js`/module updates are not silently one release behind.
- The browser explicitly asks the Service Worker registration to update after load.
- `METHOD_NOT_ALLOWED` is now diagnosed as frontend/Local-Bridge version drift or wrong runtime instead of being shown as an unexplained raw code.
- Authentication and every write operation remain fail-closed; this compatibility change only affects local read-only AUTH evidence tooling.


## 0.7.15 — Login payload-origin tracing

- Extended login payload tracing from the body of `login()` to the entire `/js/login.js` source.
- Finds global/local assignments, `+=` appends, property mutations and calls that reference the identified `postdata` payload variable.
- Adds sanitized payload-alias tracing so indirection such as `other = postdata` or `postdata = other` becomes visible without exposing literal values.
- Expands numeric AUTH/result constant extraction to include `g_result*`, `g_error*`, success/failure and related symbols.
- AUTH Lab now shows **Payload origin trace · toàn file login.js** and **Payload aliases**.
- Distinguishes “payload origin found” from a fully mapped request shape.
- Production authentication remains fail-closed until the exact request construction and response semantics are verified.


## 0.7.14 — Login structural trace

- Added a dedicated privacy-safe structural tracer for the real `login()` function.
- Traces how the identified payload variable is constructed before `/goform/login` without returning raw source or literal values.
- Reports payload assignments, field assignments, related payload calls, call names and auth-related symbol names.
- Added numeric AUTH constant extraction so response codes such as `13` can be mapped back to symbolic firmware names when present.
- AUTH Lab now shows **Payload structural trace** and **Response code map**.
- Clarified the login status label so an identified endpoint is no longer shown as “no submit candidate”.
- Production authentication remains fail-closed until request shape and success/failure semantics are coherent.


## 0.7.13 — Login call-shape tracing

- Extended `/goform/login` analysis beyond simple `payload.field = value` assignments.
- Detects the containing request call even when the endpoint is not the first argument.
- Splits top-level call arguments and reports only sanitized argument shapes.
- Detects object-literal keys, nearby object variables and `JSON.stringify(variable)` payloads.
- Traces nearby `hex_hmac_md5` / MD5 transforms without returning raw source or literal values.
- AUTH Lab now shows argument shape, object keys, field transforms and callback response signals for the login call.
- Keeps `NC03Auth.login()` fail-closed until the structural result is confirmed.


## 0.7.12 — Login callsite mapping

- Isolated `/goform/login` from passive `/goform/get_login_limit`.
- Added endpoint-specific callsite extraction from vendor JavaScript.
- Maps source file, containing function, request helper, payload variable and payload-field assignments.
- Detects per-field transforms such as `hex_hmac_md5(...)` and keeps only variable names/structure, never values.
- Extracts structural response signals such as symbolic `retcode` constants around the login callback.
- AUTH Lab now renders login callsites separately so change-password fields from `systemadmin.js` cannot masquerade as login payload fields.
- Production login remains fail-closed until the mapped callsite is confirmed against success/failure semantics.


## 0.7.11 — AUTH probe diagnostics

- Added Local Bridge health preflight before AUTH Source Probe.
- Browser fetch/network failures now report `LOCAL_BRIDGE_UNREACHABLE` instead of a generic message.
- Static source reads run in parallel with a shorter per-path timeout.
- Probe returns privacy-safe per-path diagnostics: HTTP status, redirect/timeout/network status, content type, duration and byte count.
- Raw source, credentials and session values remain excluded from diagnostics.


## 0.7.10 — Login-page deep AUTH probe

- Added evidence-backed `/common/login.html` probing without logging the modem out.
- Added relative `<script src="../...">` discovery so login-page JavaScript can be followed safely.
- Added vendor-source login-page reference extraction.
- Separated true login-submit endpoint candidates from passive `logout` / `get_login_info` endpoints.
- Added structural AUTH request-field extraction without retaining values.
- AUTH Source Probe now shows login page, login-submit endpoint and request-field candidates separately.
- Existing HMAC-MD5 / fixed-login-key evidence remains candidate-only until request/response semantics are confirmed.
- No credential persistence or write capability was enabled.


## 0.7.9 — Local API envelope fix

- Fixed AUTH Source Probe returning a valid response shape that the shared local client silently discarded.
- Fixed the same response-envelope mismatch in Connection Doctor.
- Standardized local success responses as `{ ok:true, payload:... }`.
- Added a malformed-response guard so future contract drift fails visibly instead of rendering an empty result.
- Added regression tests for AUTH Source Probe and Connection Doctor envelopes.


## 0.7.8 — Developer Lab discoverability

- Moved Developer Tools near the top of Settings instead of hiding them after long diagnostic/configuration sections.
- HAR Evidence Lab entry is now always visible in Settings.
- When Developer Mode is off, the disabled button explains exactly what to enable.
- Enabling Developer Mode immediately activates the HAR Evidence Lab button and keeps the sidebar shortcut.
- Added a UX gate preventing Developer Tools from drifting back below Modem Connection.


## 0.7.7 — Local runtime version coherence

- Fixed local runtime serving stale `dist/` assets and contract after source had been updated.
- `serve:local` now uses `dist` only when its contract version matches `package.json`.
- When stale `dist` is detected, runtime automatically serves current source instead of silently exposing an older app.
- `/_local/health` now reports runtime version and asset root.
- Startup banner includes version + active asset root and prints a stale-dist notice when applicable.


## 0.7.6 — AUTH Source Probe

- Added a local-only source probe for modem static HTML/JavaScript.
- Seeds include evidence-backed `/js/common.js`, `/js/tools.js` and `/js/md5.js`, plus local landing HTML for script discovery.
- Source is analyzed inside the Local Bridge and is never returned raw to the browser.
- Extracts AUTH endpoint literals, login-function names, fixed `loginKey` literals and HMAC-MD5/MD5 usage as candidate evidence only.
- HAR evidence from the latest capture confirms the settings-admin source contains a fixed login key and HMAC-MD5 use for the current-password verification path.
- Production `NC03Auth.login()`, credential persistence and write controls remain fail-closed.


## 0.7.5 — Connection Doctor

- Added a dedicated local read-only Connection Doctor endpoint and Settings panel.
- Diagnoses Local Bridge availability, modem response, auth requirement, verified firmware profile and live read readiness.
- AUTH_REQUIRED is reported without inventing a login flow.
- Firmware mismatch is surfaced as FIRMWARE_UNVERIFIED instead of silently trusting an unknown profile.
- Diagnostic output explicitly excludes credentials/session values and never enables write controls.
- Added responsive UX and regression coverage.


## 0.7.4 — HAR Capture Quality Guard

- Added automatic RFC1918 modem-host detection from HAR traffic.
- Added capture-quality classification for real login candidates, auth-status probes and already-authenticated sessions.
- `get_login_info` without credential input is now explicitly treated as a status probe, never as a login transaction.
- Added `AUTHENTICATED_SESSION_ONLY` detection when a HAR starts after login and contains no credential request.
- Added in-app recapture guidance for logout → clear Network → Preserve log → single login → export HAR.
- Added CLI host auto-detection and evidence schema v2 capture-quality metadata.
- Added regression coverage based on the observed settings-page capture pattern.
- Kept AUTH persistence and all write controls fail-closed.


## 0.7.3 — In-app HAR Evidence Lab

- Rebuilt Advanced Developer Mode discovery as a dedicated HAR Evidence Lab.
- HAR files are analyzed entirely in the current browser session and are never uploaded by the feature.
- Added separate AUTH evidence and WRITE evidence panels with explicit `CANDIDATE_ONLY` status.
- Added request-map summary, modem-host count, privacy/safety gate summary and responsive layouts.
- Added sanitized `nc03-evidence.json` export plus one-click clearing of the current analysis session.
- Preserved fail-closed behavior: evidence inspection never enables login persistence or modem write controls.
- Added UX regression gates for privacy messaging, AUTH/WRITE separation and evidence export.


## 0.7.2 — Privacy-safe AUTH/write evidence discovery

- Added a local-only `npm run analyze:har -- <capture.har>` workflow for the next NC03 auth/write capture.
- HAR parsing now understands JSON and form-urlencoded request bodies while redacting credential/token/session values.
- Evidence reports expose only structural metadata such as field names, body shape, status codes and cookie/auth-header presence.
- Added explicit auth candidate summaries without promoting them to AUTH VERIFIED.
- Added write-like candidate summaries while keeping every finding `CANDIDATE_ONLY` and `verified:false`.
- Prevented POST read routes such as `get_mgdb_params` from being misclassified as write solely because they use POST.
- Added regression tests proving raw credentials/session values do not appear in the generated evidence report.
- Added a capture/rollback workflow document for the remaining Phase 2B evidence gate.
- Application Management contract now advertises the local evidence analyzer while keeping remote admin and modem command proxy disabled.

## 0.7.1 — QA data quality + professional reporting

- Fixed a reporting logic bug where unavailable AP/client/rule counts could be rendered as zero.
- Reports now distinguish missing data (`—`) from real zero values and from disabled/off states.
- Added independent Live and Advanced freshness/status presentation plus last-success timestamps.
- Localized radio values such as NSA/LTE and qualitative signal levels for human-readable reports.
- Added defensive battery percentage validation inside the report layer.
- Improved A4 print fidelity with exact print colors and a denser three-column metadata block.
- Expanded report regression tests for missing-data truthfulness, stale data, XSS/privacy and printable layout.

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
