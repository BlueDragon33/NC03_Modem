export const AUTH_SESSION_STATE = Object.freeze({
  BOOTSTRAPPING:"BOOTSTRAPPING",
  READY_TO_LOGIN:"READY_TO_LOGIN",
  AUTHENTICATING:"AUTHENTICATING",
  AUTHENTICATED:"AUTHENTICATED",
  REAUTH_REQUIRED:"REAUTH_REQUIRED",
  BRIDGE_UNAVAILABLE:"BRIDGE_UNAVAILABLE",
  BRIDGE_RESTART_REQUIRED:"BRIDGE_RESTART_REQUIRED",
  AUTH_UNAVAILABLE:"AUTH_UNAVAILABLE",
  LOGGED_OUT:"LOGGED_OUT"
});

const BRIDGE_CODES = new Set([
  "LOCAL_BRIDGE_UNREACHABLE",
  "LOCAL_BRIDGE_HEALTH_FAILED"
]);

const STALE_CODES = new Set([
  "LOCAL_BRIDGE_RESTART_REQUIRED",
  "METHOD_NOT_ALLOWED"
]);

const AUTH_REJECT_CODES = new Set([
  "LOGIN_REJECTED",
  "AUTH_VERIFICATION_FAILED",
  "PASSWORD_REQUIRED",
  "AUTH_NOT_READY",
  "AUTH_READINESS_FAILED",
  "LOGIN_TRANSPORT_UNRESOLVED",
  "LOGIN_RECIPE_INCOMPLETE"
]);

export class NC03AuthSessionStateMachine {
  constructor() {
    this.reset();
  }

  reset() {
    this.state = AUTH_SESSION_STATE.BOOTSTRAPPING;
    this.lastErrorCode = null;
    this.authenticatedAt = null;
    this.sessionLostAt = null;
    this.readinessVerified = false;
    this.hadAuthenticatedSession = false;
    return this.snapshot();
  }

  beginBootstrap() {
    this.state = AUTH_SESSION_STATE.BOOTSTRAPPING;
    this.lastErrorCode = null;
    return this.snapshot();
  }

  readinessReady() {
    this.readinessVerified = true;
    if (this.state !== AUTH_SESSION_STATE.AUTHENTICATED) {
      this.state = this.hadAuthenticatedSession
        ? AUTH_SESSION_STATE.REAUTH_REQUIRED
        : AUTH_SESSION_STATE.READY_TO_LOGIN;
    }
    this.lastErrorCode = null;
    return this.snapshot();
  }

  readinessFailed(code = "AUTH_READINESS_FAILED") {
    this.readinessVerified = false;
    this.lastErrorCode = String(code);
    if (BRIDGE_CODES.has(code)) this.state = AUTH_SESSION_STATE.BRIDGE_UNAVAILABLE;
    else if (STALE_CODES.has(code)) this.state = AUTH_SESSION_STATE.BRIDGE_RESTART_REQUIRED;
    else this.state = AUTH_SESSION_STATE.AUTH_UNAVAILABLE;
    return this.snapshot();
  }

  beginLogin() {
    this.state = AUTH_SESSION_STATE.AUTHENTICATING;
    this.lastErrorCode = null;
    return this.snapshot();
  }

  loginSucceeded(at = new Date().toISOString()) {
    this.state = AUTH_SESSION_STATE.AUTHENTICATED;
    this.authenticatedAt = at;
    this.sessionLostAt = null;
    this.lastErrorCode = null;
    this.readinessVerified = true;
    this.hadAuthenticatedSession = true;
    return this.snapshot();
  }

  loginFailed(code = "LOGIN_FAILED") {
    this.lastErrorCode = String(code);
    if (BRIDGE_CODES.has(code)) this.state = AUTH_SESSION_STATE.BRIDGE_UNAVAILABLE;
    else if (STALE_CODES.has(code)) this.state = AUTH_SESSION_STATE.BRIDGE_RESTART_REQUIRED;
    else if (AUTH_REJECT_CODES.has(code)) {
      this.state = this.hadAuthenticatedSession
        ? AUTH_SESSION_STATE.REAUTH_REQUIRED
        : AUTH_SESSION_STATE.READY_TO_LOGIN;
    } else {
      this.state = AUTH_SESSION_STATE.AUTH_UNAVAILABLE;
    }
    return this.snapshot();
  }

  protectedRequestSucceeded() {
    if (this.state === AUTH_SESSION_STATE.AUTHENTICATED) return this.snapshot();
    return this.snapshot();
  }

  protectedRequestFailed(code, at = new Date().toISOString()) {
    this.lastErrorCode = String(code ?? "NC03_READ_FAILED");
    if (code === "AUTHENTICATION_REQUIRED") {
      this.sessionLostAt = at;
      this.state = this.hadAuthenticatedSession
        ? AUTH_SESSION_STATE.REAUTH_REQUIRED
        : AUTH_SESSION_STATE.READY_TO_LOGIN;
    } else if (BRIDGE_CODES.has(code)) {
      this.state = AUTH_SESSION_STATE.BRIDGE_UNAVAILABLE;
    } else if (STALE_CODES.has(code)) {
      this.state = AUTH_SESSION_STATE.BRIDGE_RESTART_REQUIRED;
    }
    return this.snapshot();
  }

  logoutLocal() {
    this.state = AUTH_SESSION_STATE.LOGGED_OUT;
    this.lastErrorCode = null;
    this.sessionLostAt = new Date().toISOString();
    this.hadAuthenticatedSession = false;
    this.authenticatedAt = null;
    return this.snapshot();
  }

  snapshot() {
    return Object.freeze({
      state:this.state,
      readinessVerified:this.readinessVerified,
      hadAuthenticatedSession:this.hadAuthenticatedSession,
      authenticatedAt:this.authenticatedAt,
      sessionLostAt:this.sessionLostAt,
      lastErrorCode:this.lastErrorCode
    });
  }
}

export function authSessionUiState(snapshot) {
  const state = snapshot?.state ?? AUTH_SESSION_STATE.BOOTSTRAPPING;
  return Object.freeze({
    authenticated:state === AUTH_SESSION_STATE.AUTHENTICATED,
    canSubmitLogin:[
      AUTH_SESSION_STATE.READY_TO_LOGIN,
      AUTH_SESSION_STATE.REAUTH_REQUIRED,
      AUTH_SESSION_STATE.LOGGED_OUT
    ].includes(state),
    requiresLogin:[
      AUTH_SESSION_STATE.READY_TO_LOGIN,
      AUTH_SESSION_STATE.REAUTH_REQUIRED,
      AUTH_SESSION_STATE.LOGGED_OUT
    ].includes(state),
    requiresBridgeRestart:state === AUTH_SESSION_STATE.BRIDGE_RESTART_REQUIRED,
    bridgeUnavailable:state === AUTH_SESSION_STATE.BRIDGE_UNAVAILABLE
  });
}
