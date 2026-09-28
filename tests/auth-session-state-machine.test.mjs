import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_SESSION_STATE,
  NC03AuthSessionStateMachine,
  authSessionUiState
} from "../src/application/NC03AuthSessionStateMachine.js";

test("fresh auth lifecycle is deterministic from bootstrap to authenticated", () => {
  const machine=new NC03AuthSessionStateMachine();
  assert.equal(machine.snapshot().state,AUTH_SESSION_STATE.BOOTSTRAPPING);
  assert.equal(machine.readinessReady().state,AUTH_SESSION_STATE.READY_TO_LOGIN);
  assert.equal(machine.beginLogin().state,AUTH_SESSION_STATE.AUTHENTICATING);
  const authenticated=machine.loginSucceeded("2026-09-28T00:00:00.000Z");
  assert.equal(authenticated.state,AUTH_SESSION_STATE.AUTHENTICATED);
  assert.equal(authenticated.hadAuthenticatedSession,true);
  assert.equal(authSessionUiState(authenticated).authenticated,true);
});

test("wrong password returns to login-ready without fabricating a session", () => {
  const machine=new NC03AuthSessionStateMachine();
  machine.readinessReady();
  machine.beginLogin();
  const state=machine.loginFailed("LOGIN_REJECTED");
  assert.equal(state.state,AUTH_SESSION_STATE.READY_TO_LOGIN);
  assert.equal(state.hadAuthenticatedSession,false);
  assert.equal(state.lastErrorCode,"LOGIN_REJECTED");
});

test("expired authenticated session deterministically requires re-authentication", () => {
  const machine=new NC03AuthSessionStateMachine();
  machine.readinessReady();
  machine.beginLogin();
  machine.loginSucceeded();
  const expired=machine.protectedRequestFailed("AUTHENTICATION_REQUIRED","2026-09-28T01:00:00.000Z");
  assert.equal(expired.state,AUTH_SESSION_STATE.REAUTH_REQUIRED);
  assert.equal(expired.hadAuthenticatedSession,true);
  assert.equal(authSessionUiState(expired).requiresLogin,true);
});

test("stale Local Bridge is distinct from auth rejection", () => {
  const machine=new NC03AuthSessionStateMachine();
  const state=machine.readinessFailed("LOCAL_BRIDGE_RESTART_REQUIRED");
  assert.equal(state.state,AUTH_SESSION_STATE.BRIDGE_RESTART_REQUIRED);
  assert.equal(authSessionUiState(state).requiresBridgeRestart,true);
});

test("local logout clears authenticated-session authority", () => {
  const machine=new NC03AuthSessionStateMachine();
  machine.readinessReady();
  machine.beginLogin();
  machine.loginSucceeded();
  const state=machine.logoutLocal();
  assert.equal(state.state,AUTH_SESSION_STATE.LOGGED_OUT);
  assert.equal(state.hadAuthenticatedSession,false);
  assert.equal(state.authenticatedAt,null);
});

test("state snapshot never contains credentials, cookie or token values", () => {
  const machine=new NC03AuthSessionStateMachine();
  machine.readinessReady();
  machine.beginLogin();
  machine.loginSucceeded();
  const serialized=JSON.stringify(machine.snapshot());
  for(const secret of ["password","cookie","token","sessionid"]) assert.equal(serialized.toLowerCase().includes(secret),false);
});
