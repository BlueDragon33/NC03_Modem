const ENDPOINT_RE = /["'](\/(?:action|goform)\/[A-Za-z0-9_./-]+)["']/g;
const SCRIPT_LITERAL_RE = /["']([^"'<>\s]+\.js(?:\?[^"']*)?)["']/g;
const SCRIPT_SRC_RE = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+\.js(?:\?[^"']*)?)["'][^>]*>/gi;
const LOGIN_PAGE_RE = /["']([^"'<>]*login\.html(?:\?[^"']*)?)["']/gi;
const LOGIN_FUNCTION_RE = /function\s+([A-Za-z_$][\w$]*login[\w$]*)\s*\(/gi;
const FIXED_LOGIN_KEY_RE = /\bloginKey\s*=\s*["']([^"']+)["']/i;
const AUTH_FIELD_RE = /(?:postdata|payload|params|data)\.([A-Za-z_$][\w$]*)\s*=|\b([A-Za-z_$][\w$]*(?:pass|passwd|password|pwd|user|username|login|auth|token)[A-Za-z0-9_$]*)\s*:/gi;
const PASSIVE_AUTH_ENDPOINT_RE = /(?:\/action\/logout$|\/goform\/get_login_info$|\/goform\/login_info$|\/goform\/get_login_limit$|\/goform\/get_system_status$)/i;
const REQUEST_HELPER_RE = /([A-Za-z_$][\w$]*(?:AjaxJsonData|ajaxJsonData|AjaxData|ajaxData))\s*\(/g;

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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^$()|[\]\\]/g, "\\$&");
}

function functionContext(text, index) {
  const prefix = text.slice(Math.max(0, index - 5000), index);
  const matches = [...prefix.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g)];
  return matches.at(-1)?.[1] ?? null;
}

function extractPayloadVariable(afterEndpoint) {
  const match = afterEndpoint.match(/^[,\s]*(?:JSON\.stringify\s*\(\s*)?([A-Za-z_$][\w$]*)/);
  if (!match) return null;
  const candidate = match[1];
  return ["function","true","false","null","undefined"].includes(candidate) ? null : candidate;
}

function fieldAssignments(around, payloadVariable) {
  if (!payloadVariable) return [];
  const escaped = escapeRegex(payloadVariable);
  const assignments = [];
  const patterns = [
    new RegExp(escaped + "\\.([A-Za-z_$][\\w$]*)\\s*=\\s*([^;\\n]+)", "g"),
    new RegExp(escaped + "\\[[\"']([^\"']+)[\"']\\]\\s*=\\s*([^;\\n]+)", "g")
  ];

  for (const pattern of patterns) {
    for (const match of around.matchAll(pattern)) {
      const expression = match[2].trim();
      const codec = expression.match(/\b(hex_hmac_md5|hex_md5|md5)\s*\(([^)]*)\)/i);
      assignments.push({
        field:match[1],
        transform:codec?.[1] ?? "direct",
        transformArgs:codec ? codec[2].split(",").map((part) => part.trim()).filter(Boolean).slice(0, 3) : []
      });
    }
  }

  return uniq(assignments.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item));
}

function endpointCallsite(text, path, endpoint, index) {
  const before = text.slice(Math.max(0, index - 3500), index);
  const after = text.slice(index, Math.min(text.length, index + 3500));
  const around = before + after;

  REQUEST_HELPER_RE.lastIndex = 0;
  const helperMatches = [...before.matchAll(REQUEST_HELPER_RE)];
  const transportHelper = helperMatches.at(-1)?.[1] ?? null;
  const afterEndpoint = after.slice(endpoint.length + 2, 700);
  const payloadVariable = extractPayloadVariable(afterEndpoint);
  const fields = fieldAssignments(around, payloadVariable);
  const responseSignals = [];

  for (const match of around.matchAll(/(?:retcode|code|status)\s*(?:===|==)\s*([A-Za-z_$][\w$]*|-?\d+)/g)) {
    responseSignals.push(match[1]);
  }

  return {
    sourcePath:path,
    endpoint,
    functionName:functionContext(text, index),
    transportHelper,
    payloadVariable,
    fields,
    responseSignals:uniq(responseSignals),
    hasHmacMd5:/hex_hmac_md5\s*\(/i.test(around),
    statusLabel:"SOURCE_CALLSITE_CANDIDATE"
  };
}

function collectEndpointCallsites(text, path) {
  const callsites = [];
  ENDPOINT_RE.lastIndex = 0;
  for (const match of text.matchAll(ENDPOINT_RE)) {
    callsites.push(endpointCallsite(text, path, match[1], match.index ?? 0));
  }
  return callsites;
}

export function analyzeAuthVendorSource({ path = "", source = "" } = {}) {
  const text = String(source ?? "");
  const endpoints = [];
  ENDPOINT_RE.lastIndex = 0;
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
  const endpointCallsites = collectEndpointCallsites(text, path);

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
    endpointCallsites,
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
  const endpointCallsites = analyses.flatMap((item) => item.endpointCallsites);
  const loginCallsites = endpointCallsites.filter((item) => loginSubmitEndpoints.includes(item.endpoint));
  const loginFieldCandidates = uniq(loginCallsites.flatMap((item) => item.fields.map((field) => field.field)));
  const fixedKeys = uniq(analyses.map((item) => item.passwordCodec.fixedLoginKey).filter(Boolean));
  const hmacMd5 = analyses.some((item) => item.passwordCodec.hmacMd5);

  let status = "INSUFFICIENT_SOURCE_EVIDENCE";
  if (loginCallsites.some((item) => item.fields.length && item.hasHmacMd5)) status = "LOGIN_CALLSITE_CANDIDATE_READY";
  else if (loginSubmitEndpoints.length && candidateRequestFields.length && hmacMd5) status = "LOGIN_SOURCE_CANDIDATE_READY";
  else if (loginSubmitEndpoints.length) status = "LOGIN_ENDPOINT_CANDIDATE_FOUND";
  else if (authEndpoints.length || hmacMd5 || fixedKeys.length) status = "AUTH_SUPPORTING_EVIDENCE_ONLY";

  return {
    schema:"nc03-auth-source-evidence/v3",
    status,
    sourcesAnalyzed:analyses.map((item) => item.path),
    authEndpoints,
    loginSubmitEndpoints,
    loginPageCandidates,
    loginFunctions,
    candidateRequestFields,
    loginFieldCandidates,
    loginCallsites,
    passwordCodec:{
      fixedLoginKeyPresent:fixedKeys.length > 0,
      fixedLoginKeys:fixedKeys,
      hmacMd5
    },
    discoveredScriptRefs:scriptRefs,
    readyForRequestShapeMapping:loginCallsites.some((item) => item.fields.length > 0),
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
