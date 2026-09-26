const ENDPOINT_RE = /["'`](\/(?:action|goform)\/[A-Za-z0-9_./-]+)["'`]/g;
const SCRIPT_RE = /["'`](\/[^"'\`?#]+\.js(?:\?[^"'\`]*)?)["'`]/g;
const LOGIN_FUNCTION_RE = /function\s+([A-Za-z_$][\w$]*login[\w$]*)\s*\(/gi;
const FIXED_LOGIN_KEY_RE = /\bloginKey\s*=\s*["']([^"']+)["']/i;

function uniq(values) {
  return [...new Set(values)];
}

function safePath(raw) {
  try {
    const url = new URL(raw, "http://nc03.local");
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
  for (const match of text.matchAll(SCRIPT_RE)) {
    const candidate = safePath(match[1]);
    if (candidate.startsWith("/js/") || candidate.startsWith("/lib/")) scriptRefs.push(candidate);
  }

  const loginFunctions = [];
  for (const match of text.matchAll(LOGIN_FUNCTION_RE)) loginFunctions.push(match[1]);

  const fixedKey = text.match(FIXED_LOGIN_KEY_RE)?.[1] ?? null;
  const hmacMd5 = /hex_hmac_md5\s*\(/i.test(text);
  const md5 = /\bhex_md5\s*\(|\bmd5\s*\(/i.test(text);
  const passwordModify = endpoints.includes("/action/modify_password");

  const authEndpoints = uniq(endpoints.filter((endpoint) => /login|logout|password|passwd|auth|session/i.test(endpoint)));
  const evidence = [];
  if (fixedKey) evidence.push("fixed-login-key-literal");
  if (hmacMd5) evidence.push("hmac-md5-call");
  if (md5) evidence.push("md5-call");
  if (passwordModify) evidence.push("password-modify-endpoint");
  if (loginFunctions.length) evidence.push("login-function-name");
  if (authEndpoints.length) evidence.push("auth-endpoint-literal");

  return {
    path,
    authEndpoints,
    scriptRefs:uniq(scriptRefs),
    loginFunctions:uniq(loginFunctions),
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
  const scriptRefs = uniq(analyses.flatMap((item) => item.scriptRefs));
  const loginFunctions = uniq(analyses.flatMap((item) => item.loginFunctions));
  const fixedKeys = uniq(analyses.map((item) => item.passwordCodec.fixedLoginKey).filter(Boolean));
  const hmacMd5 = analyses.some((item) => item.passwordCodec.hmacMd5);

  let status = "INSUFFICIENT_SOURCE_EVIDENCE";
  if (authEndpoints.length && hmacMd5) status = "AUTH_SOURCE_CANDIDATE_READY";
  else if (authEndpoints.length) status = "AUTH_ENDPOINT_CANDIDATE_FOUND";
  else if (hmacMd5 || fixedKeys.length) status = "PASSWORD_CODEC_CANDIDATE_FOUND";

  return {
    schema:"nc03-auth-source-evidence/v1",
    status,
    sourcesAnalyzed:analyses.map((item) => item.path),
    authEndpoints,
    loginFunctions,
    passwordCodec:{
      fixedLoginKeyPresent:fixedKeys.length > 0,
      fixedLoginKeys,
      hmacMd5
    },
    discoveredScriptRefs:scriptRefs,
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
