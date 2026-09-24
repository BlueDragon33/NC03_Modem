# Phase status

## Phase 1 — FOUNDATION + NC03 DISCOVERY

Status: **READY FOR REAL HAR**

Completed:
- project architecture;
- NC03 Adapter interface;
- NC03Auth / NC03Api / NC03Session / NC03Parser / NC03Capabilities boundaries;
- credential/security architecture;
- HAR parser with redaction;
- capability matrix;
- Mock Mode with DEMO DATA label;
- Login Screen skeleton;
- Dashboard skeleton;
- Basic / Advanced Mode boundary;
- Advanced Developer Mode boundary;
- explicit connection-state model;
- PWA/offline shell;
- release gates.

External dependency before Phase 2:
- HAR captured from the real NC03 Web UI at the user's firmware version.

## Phase 2 — NC03 Web UI reverse engineering

Status: **BLOCKED BY MISSING REAL HAR**

Do not infer or hard-code endpoint names while this dependency is missing.
