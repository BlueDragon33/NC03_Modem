# Phase status

## Phase 1 — FOUNDATION + NC03 DISCOVERY

Status: **COMPLETE**

Completed:
- project architecture;
- NC03 Adapter interface;
- NC03Auth / NC03Api / NC03Session / NC03Parser / NC03Capabilities boundaries;
- explicit read/write operation gate independent from HTTP method;
- fail-closed auth/session behavior;
- encrypted local credential vault foundation;
- HAR parser with redaction and candidate-only module hints;
- Mock Mode with DEMO DATA label;
- Login Screen / Dashboard skeleton;
- Basic / Advanced / Developer Mode boundaries;
- PWA/offline shell;
- CHECK / BUILD / TYPECHECK / LINT / UNIT / INTEGRATION / UX / OFFLINE / SECURITY gates.

## Phase 2A — REAL HAR MAPPING / firmware 8.00.42

Status: **READ PATH MAPPED**

Completed:
- real HAR analyzed without committing private raw capture;
- firmware identified as `NC03_8.00.42`;
- verified read routes for login status, MGDB parameters, connected clients and device runtime state;
- exact battery percentage capability confirmed;
- read-only firmware adapter implemented;
- vendor JavaScript write endpoints catalogued as PARTIAL only;
- regression tests prevent discovered writes from being accidentally enabled.

Still required before production **write** control:
- actual login transaction/auth algorithm;
- write-operation capture and rollback tests;
- detailed radio metrics capture if a future firmware/page exposes them.

## Phase 2B — AUTH + TRANSPORT

Status: **TRANSPORT COMPLETE / AUTH EVIDENCE PENDING**

Completed:
- Local Bridge read transport is implemented and integrated with Application Management;
- bridge origin policy is restricted to RFC1918 IPv4 modem addresses;
- browser no longer needs to call modem HTTP directly for production reads.

Pending:
- actual password login request/session semantics.

Do not enable remember-admin, auto-login or write controls until AUTH is VERIFIED.

## Phase 2C — HAR2 LIVE TELEMETRY

Status: **COMPLETE**

Completed:
- exact battery percentage promoted to always-visible UI;
- Internet connection + qualitative signal + 4G/5G/carrier always-visible UI;
- 10-second live polling;
- safe local read bridge with private-origin validation;
- extended read-only Advanced snapshot from HAR2;
- 4-AP Wi-Fi read support;
- explicit secret-field exclusion;
- no fabricated RSRP/RSRQ/SINR;
- write endpoints remain fail-closed.

Next write milestone still requires an actual write HAR capture with rollback.

## Phase 2D — LIVE UX + SAFE INVENTORY

Status: **COMPLETE**

Completed:
- 10-second polling updates only live fields and preserves scroll/focus;
- polling pauses in hidden tabs and prevents overlapping refreshes;
- Mobile Data / SIM PIN / Cloud SIM auto-switch read state;
- count-only DHCP reservation / port-forward / IPv4+IPv6 packet-filter inventory;
- Local Bridge blocks loopback/public/hostname targets;
- PWA stale-while-revalidate cache prevents stale published UI.

## Phase 2E — RESILIENT LIVE TELEMETRY

Status: **IMPLEMENTED**

Completed:
- transient 10-second poll failures keep the last-known-good battery/signal/network values visible instead of replacing them with dashes;
- stale telemetry is explicitly marked as reconnecting / last-known data;
- a successful poll clears stale state immediately;
- UI modem-address validation and persisted preferences now use the exact same RFC1918-only policy as the Local Bridge;
- stale or invalid saved modem origins are automatically normalized back to the safe default;
- PWA cache includes the shared LocalBridgePolicy module.

## Phase 2F — FINAL READ-PATH HARDENING

Status: **COMPLETE**

Completed:
- last-known-good telemetry remains visibly stale after navigation; no false green connection indicator;
- latest successful telemetry timestamp is visible;
- Advanced snapshot has an independent freshness/error state and explicit retry path;
- password-memory control is disabled until real authentication is verified;
- invalid manual modem addresses are rejected with an explicit RFC1918 validation message;
- no new write capability was inferred or enabled.

Read-path implementation is now complete for the evidence currently available. Remaining AUTH/write work is externally evidence-gated and must not be guessed.

## Phase 2G — PROFESSIONAL QA + DIAGNOSTIC REPORT

Status: **COMPLETE**

Completed:
- professional tester pass over stale/fresh semantics, navigation persistence, invalid input and device-status wording;
- Home explicitly marks stale Advanced client/data metrics;
- impossible battery percentages are rejected;
- remember-password UI cannot visually imply that a credential was saved before AUTH verification;
- responsive quick actions use a balanced 4/2/1 layout;
- keyboard focus visibility and 44 px interactive targets are enforced;
- privacy-safe A4 diagnostic report added with Print / Save PDF;
- report output is allow-list based and covered against secret leakage and HTML injection.

No modem write capability was enabled. AUTH/write remain externally evidence-gated.

## Phase 2H — AUTH/WRITE EVIDENCE DISCOVERY TOOLING

Status: **TOOLING COMPLETE / REAL AUTH CAPTURE REQUIRED**

Completed:
- local-only HAR analyzer CLI;
- JSON and form-urlencoded body shape detection;
- request/response field-name extraction without retaining secret values;
- Authorization/Cookie/Set-Cookie/redirect evidence flags without retaining header values;
- auth candidates remain `CANDIDATE_ONLY`;
- write-like candidates remain `CANDIDATE_ONLY`;
- POST read routes are not promoted to write based on method alone;
- regression tests prevent credential/session leakage into evidence reports;
- capture and rollback workflow documented.

External evidence still required:
- one clean login transaction HAR;
- one low-risk write transaction with rollback after AUTH is mapped.

No production login or write control is enabled by this phase.


## Phase 2I — IN-APP HAR EVIDENCE LAB

Status: **IMPLEMENTED**

Completed:
- Advanced Developer Mode now contains a dedicated local HAR Evidence Lab;
- HAR selection and analysis stay inside the current browser session;
- AUTH candidates and WRITE candidates are presented in separate evidence surfaces;
- candidate status remains explicitly `CANDIDATE_ONLY`;
- sanitized evidence JSON can be exported without raw password/token/cookie/session values;
- current analysis state can be cleared without affecting modem runtime state;
- responsive UX covers desktop, tablet and mobile;
- UX release gates protect privacy messaging, evidence split and export controls.

Still externally evidence-gated:
- real login transaction capture;
- real low-risk write transaction with rollback.

No AUTH or WRITE capability is promoted by this UI.


## Phase 2J — HAR CAPTURE QUALITY GUARD

Status: **IMPLEMENTED**

Completed:
- modem host auto-detection from RFC1918 HAR traffic;
- auth-status probes separated from login-transaction candidates;
- authenticated-session-only captures explicitly detected;
- capture page paths included without query/secret values;
- in-app recapture guidance added when AUTH evidence is insufficient;
- CLI and browser analyzer use the same capture-quality report;
- regression tests cover the observed settings-page / already-authenticated pattern.

Current external gate:
- a HAR captured from **logout → one successful login** is still required before implementing `NC03Auth.login()`.

No credential persistence or write operation was enabled.


## Phase 2K — CONNECTION DOCTOR

Status: **IMPLEMENTED**

Completed:
- local read-only `POST /api/nc03/doctor`;
- Local Bridge → modem → authentication → firmware/profile → live-read diagnostic chain;
- explicit `AUTH_REQUIRED`, `FIRMWARE_UNVERIFIED`, `MODEM_UNREACHABLE` and `OK` states;
- Settings UI with one-click diagnosis and direct Web UI login action when auth is required;
- no credential, token, cookie or session values in the report;
- no write capability promotion;
- responsive and regression-tested diagnostic UX.

AUTH and write remain evidence-gated.


## Phase 2L — AUTH SOURCE PROBE

Status: **IMPLEMENTED**

Observed from the latest modem HAR:
- capture contains 234 post-navigation requests from the settings UI;
- no Cookie, Authorization or Set-Cookie is present in the captured settings traffic;
- `/js/systemadmin.js` contains a fixed `loginKey` literal and calls `hex_hmac_md5(loginKey, currentPassword)` before `/action/modify_password`;
- this proves an HMAC-MD5 password transform exists in firmware, but does not prove the login endpoint uses the identical transform.

Implemented:
- local-only static source probe through the RFC1918 bridge;
- source seed discovery for common/tools/md5 and modem HTML;
- structural extraction of auth endpoint literals, login function names and password codec evidence;
- raw vendor source is not returned to the browser or Application Management;
- all source findings remain `SOURCE_CANDIDATE_ONLY`.

Current AUTH gate:
- exact login endpoint + request shape + success/failure semantics still require source/transaction confirmation before `NC03Auth.login()` can be enabled.


## Phase 2M — LOCAL RUNTIME VERSION COHERENCE

Status: **IMPLEMENTED**

Completed:
- detect stale `dist` by comparing its management contract version with source `package.json`;
- serve current source automatically when `dist` is stale;
- keep contract and static asset root on the same version boundary;
- expose runtime `version` and `assetRoot` in `/_local/health`;
- startup banner makes the active version/root explicit.

This prevents an old built artifact such as 0.6.1 from masking current source such as 0.7.6+ during local development.


## Phase 2N — DEVELOPER LAB DISCOVERABILITY

Status: **IMPLEMENTED**

Completed:
- Developer Tools moved near the top of Settings;
- HAR Evidence Lab entry remains visible even when Developer Mode is disabled;
- disabled state explains the required action instead of hiding the feature;
- enabling Developer Mode immediately exposes the active Lab action and sidebar shortcut;
- UX gate protects this discoverability order.

No AUTH/write safety boundary changed.


## Phase 2O — LOCAL API ENVELOPE CONSISTENCY

Status: **IMPLEMENTED**

Completed:
- AUTH Source Probe now returns the standard local `payload` envelope;
- Connection Doctor now uses the same envelope;
- browser local client rejects malformed successful responses with `MALFORMED_LOCAL_RESPONSE`;
- regression tests prevent silent `undefined` results.

This fixes the observed case where clicking **Quét AUTH source trên modem** produced no visible result even though the endpoint returned successfully.


## Phase 2P — LOGIN-PAGE DEEP AUTH PROBE

Status: **IMPLEMENTED**

New evidence from the previously supplied HAR:
- vendor `rebootreset.js` explicitly redirects to `../common/login.html` after reboot;
- the existing source probe had been classifying `/action/logout` and `/goform/get_login_info` as generic AUTH endpoints, but neither is a login-submit endpoint.

Implemented:
- direct read-only seed for `/common/login.html`;
- evidence-backed seeds for `rebootreset.js` and `systemadmin.js`;
- relative script-reference resolution from the login page;
- recursive static script discovery without calling logout or other state-changing endpoints;
- explicit `loginSubmitEndpoints`, `loginPageCandidates` and `candidateRequestFields`;
- passive auth/status endpoints no longer make AUTH appear ready.

Current gate:
- if the login page/source exposes a submit endpoint + request fields, those remain SOURCE_CANDIDATE_ONLY until success/failure response semantics are verified.


## Phase 2Q — AUTH PROBE DIAGNOSTICS

Status: **IMPLEMENTED**

Completed:
- local runtime health preflight before AUTH probing;
- explicit `LOCAL_BRIDGE_UNREACHABLE` / `LOCAL_BRIDGE_HEALTH_FAILED` client states;
- parallel bounded static-source reads;
- safe per-path status for HTTP OK, redirect, HTTP error, unsupported content, timeout and network error;
- no raw source, credential or session values in diagnostic output.
