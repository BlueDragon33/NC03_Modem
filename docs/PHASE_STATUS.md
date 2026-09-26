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
