const ENDPOINT_RE = /["'`](\/(?:action|goform)\/[A-Za-z0-9_./-]+)["'`]/g;
const SCRIPT_LITERAL_RE = /["'`]([^"'<>\s]+\.js(?:\?[^"'`]*)?)["'`]/g;
const SCRIPT_SRC_RE = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+\.js(?:\?[^"']*)?)["'][^>]*>/gi;
const LOGIN_PAGE_RE = /["'`]([^"'<>]*login\.html(?:\?[^"'`]*)?)["'`]/gi;
const LOGIN_FUNCTION_RE = /function\s+([A-Za-z_$][\w$]*login[\w$]*)\s*\(/gi;
const FIXED_LOGIN_KEY_RE = /\bloginKey\s*=\s*["']([^"']+)["']/i;
const AUTH_FIELD_RE = /(?:postdata|payload|params|data)\.([A-Za-z_$][\w$]*)\s*=|\b([A-Za-z_$][\w$]*(?:pass|passwd|password|pwd|user|username|login|auth|token)[A-Za-z0-9_$]*)\s*:/gi;
const PASSIVE_AUTH_ENDPOINT_RE = /(?:\/action\/logout$|\/goform\/get_login_info$|\/goform\/login_info$|\/goform\/get_system_status$)/i;

function uniq(values) {
  return [...new Set(values)];
}

function resolveLocalPath(raw, sourcePath = "/") {
  try {
    const base = new URL(sourcePath || "/", "http://nc03.local");
    const url = new URL(raw, base);
    if (url.origin !== "http://nc03.local") return "";
    return url.pathname;
  } catch {
    return "";
  }
}

export function analyzeAuthVendorSource({ path = "", source = "" } = {}) {
  const text = String(source ?? "");
  const endpoints = [];
  for (const match of text.matchAll(ENDPOINT_RE)) endpoints.push(match[1]);

  const scriptRefs = [];
  for (const re of [SCRIPT_SRC_RE, SCRIPT_LITERAL_RE]) {
    re.lastIndex = 0;
    for (const match of text.matchAll(re)) {
      const candidate = resolveLocalPath(match[1], path);
      if (/^\/(?:js|lib)\//i.test(candidate)) scriptRefs.push(candidate);
    }
  }

  const loginPageCandidates = [];
  LOGIN_PAGE_RE.lastIndex = 0;
  for (const match of text.matchAll(LOGIN_PAGE_RE)) {
    const candidate = resolveLocalPath(match[1], path);
    if (/\.html$/i.test(candidate)) loginPageCandidates.push(candidate);
  }

  const loginFunctions = [];
  LOGIN_FUNCTION_RE.lastIndex = 0;
  for (const match of text.matchAll(LOGIN_FUNCTION_RE)) loginFunctions.push(match[1]);

  const candidateRequestFields = [];
  AUTH_FIELD_RE.lastIndex = 0;
  for (const match of text.matchAll(AUTH_FIELD_RE)) {
    const field = match[1] || match[2];
    if (field && /pass|passwd|password|pwd|user|username|login|auth|token/i.test(field)) candidateRequestFields.push(field);
  }

  const fixedKey = text.match(FIXED_LOGIN_KEY_RE)?.[1] ?? null;
  const hmacMd5 = /hex_hmac_md5\s*\(/i.test(text);
  const md5 = /\bhex_md5\s*\(|\bmd5\s*\(/i.test(text);
  const passwordModify = endpoints.includes("/action/modify_password");

  const authEndpoints = uniq(endpoints.filter((endpoint) => /login|logout|password|passwd|auth|session/i.test(endpoint)));
  const loginSubmitEndpoints = authEndpoints.filter((endpoint) => /login|auth/i.test(endpoint) && !PASSIVE_AUTH_ENDPOINT_RE.test(endpoint));
  const evidence = [];
  if (fixedKey) evidence.push("fixed-login-key-literal");
  if (hmacMd5) evidence.push("hmac-md5-call");
  if (md5) evidence.push("md5-call");
  if (passwordModify) evidence.push("password-modify-endpoint");
  if (loginFunctions.length) evidence.push("login-function-name");
  if (authEndpoints.length) evidence.push("auth-endpoint-literal");
  if (loginSubmitEndpoints.length) evidence.push("login-submit-endpoint-candidate");
  if (loginPageCandidates.length) evidence.push("login-page-reference");
  if (candidateRequestFields.length) evidence.push("auth-request-field-name");

  return {
    path,
    authEndpoints,
    loginSubmitEndpoints:uniq(loginSubmitEndpoints),
    scriptRefs:uniq(scriptRefs),
    loginPageCandidates:uniq(loginPageCandidates),
    loginFunctions:uniq(loginFunctions),
    candidateRequestFields:uniq(candidateRequestFields),
    passwordCodec:{
      fixedLoginKeyPresent:Boolean(fixedKey),
      fixedLoginKey:fixedKey,
      hmacMd5,
      md5
    },
    evidence,
    verified:false,
    statusLabel:"SOURCE_CANDIDATE_ONLY"
  };
}

export function buildAuthSourceEvidence(sources = []) {
  const analyses = sources.map(analyzeAuthVendorSource);
  const authEndpoints = uniq(analyses.flatMap((item) => item.authEndpoints));
  const loginSubmitEndpoints = uniq(analyses.flatMap((item) => item.loginSubmitEndpoints));
  const scriptRefs = uniq(analyses.flatMap((item) => item.scriptRefs));
  const loginPageCandidates = uniq(analyses.flatMap((item) => item.loginPageCandidates));
  const loginFunctions = uniq(analyses.flatMap((item) => item.loginFunctions));
  const candidateRequestFields = uniq(analyses.flatMap((item) => item.candidateRequestFields));
  const fixedKeys = uniq(analyses.map((item) => item.passwordCodec.fixedLoginKey).filter(Boolean));
  const hmacMd5 = analyses.some((item) => item.passwordCodec.hmacMd5);

  let status = "INSUFFICIENT_SOURCE_EVIDENCE";
  if (loginSubmitEndpoints.length && candidateRequestFields.length && hmacMd5) status = "LOGIN_SOURCE_CANDIDATE_READY";
  else if (loginSubmitEndpoints.length) status = "LOGIN_ENDPOINT_CANDIDATE_FOUND";
  else if (authEndpoints.length || hmacMd5 || fixedKeys.length) status = "AUTH_SUPPORTING_EVIDENCE_ONLY";

  return {
    schema:"nc03-auth-source-evidence/v2",
    status,
    sourcesAnalyzed:analyses.map((item) => item.path),
    authEndpoints,
    loginSubmitEndpoints,
    loginPageCandidates,
    loginFunctions,
    candidateRequestFields,
    passwordCodec:{
      fixedLoginKeyPresent:fixedKeys.length > 0,
      fixedLoginKeys:fixedKeys,
      hmacMd5
    },
    discoveredScriptRefs:scriptRefs,
    readyForRequestShapeMapping:loginSubmitEndpoints.length > 0 && candidateRequestFields.length > 0,
    analyses,
    safety:{
      sourceCodeReturned:false,
      credentialsIncluded:false,
      sessionValuesIncluded:false,
      productionLoginEnabled:false,
      writeControlsEnabled:false
    }
  };
}
