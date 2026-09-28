# NC03 Authentication & Session Lifecycle — WP04

Status: **IMPLEMENTED · REAL-HARDWARE EXPIRY/RESTART ACCEPTANCE PENDING**

## Canonical state machine

`BOOTSTRAPPING → READY_TO_LOGIN → AUTHENTICATING → AUTHENTICATED`

Recovery states:
- `REAUTH_REQUIRED` — a previously authenticated session receives `AUTHENTICATION_REQUIRED`;
- `BRIDGE_UNAVAILABLE` — Local Bridge cannot be reached;
- `BRIDGE_RESTART_REQUIRED` — frontend/runtime protocol mismatch;
- `AUTH_UNAVAILABLE` — login recipe/readiness cannot be verified;
- `LOGGED_OUT` — local bridge session authority explicitly cleared.

The canonical implementation is `src/application/NC03AuthSessionStateMachine.js`.

## Ownership

- Product UI renders auth state and messages.
- `NC03ControlClient` owns Local Bridge auth requests and runtime envelopes.
- Local Bridge owns the modem cookie jar in memory.
- `SecureCredentialVault` owns optional encrypted remembered credentials.
- The auth state machine never stores password, cookie, token or session identifiers.
- Vendor logout remains **unverified**; WP04 does not invent or call it.

## Local logout

`POST /api/nc03/session/clear` clears only the Local Bridge in-memory cookie jar for the normalized modem origin.

Response explicitly records `vendorLogoutAttempted:false`.

This provides deterministic local logout/invalidation without claiming firmware logout behavior that has not been verified.

## Recovery semantics

- Wrong password → returns to login-ready state without a fabricated session.
- Session expiry → `REAUTH_REQUIRED` and UI returns to Login.
- Stale runtime → `BRIDGE_RESTART_REQUIRED`, distinct from password rejection.
- Runtime restart naturally loses the in-memory cookie jar; the next protected read must produce the re-authentication path.
- Remembered credentials remain opt-in and encrypted locally; they may prefill login but never grant session authority by themselves.

## Hardware acceptance still required

Existing real hardware evidence already proves successful NC03 login and session-cookie continuity.

Before WP04 can close, perform one real-device recovery drill:
1. log in successfully;
2. restart the NC03 Local Bridge process (or otherwise invalidate its in-memory cookie jar);
3. refresh/poll a protected read;
4. confirm the UI returns to Login / re-authentication instead of pretending the old session is valid;
5. log in again successfully.

No password or session value should be shared in evidence.
