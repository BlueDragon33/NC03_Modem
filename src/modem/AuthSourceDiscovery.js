import { extractAuthNumericConstants, traceLoginStructure } from "./LoginStructuralTrace.js";

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


function findContainingCall(text, endpointIndex) {
  const start = Math.max(0, endpointIndex - 900);
  const before = text.slice(start, endpointIndex);
  for (let pos = before.length - 1; pos >= 0; pos -= 1) {
    if (before[pos] !== "(") continue;
    const prefix = before.slice(Math.max(0, pos - 120), pos);
    const helper = prefix.match(/([A-Za-z_$][\w$]*)\s*$/)?.[1] ?? null;
    if (!helper) continue;
    let depth = 1;
    let quote = null;
    let escape = false;
    for (let i = start + pos + 1; i < Math.min(text.length, endpointIndex + 5000); i += 1) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (quote) {
        if (ch === "\\") { escape = true; continue; }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "\`") { quote = ch; continue; }
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          const openIndex = start + pos;
          if (openIndex < endpointIndex && endpointIndex < i) {
            return { helper, open:openIndex, close:i, body:text.slice(openIndex + 1, i) };
          }
          break;
        }
      }
    }
  }
  return null;
}

function splitTopLevelArgs(body) {
  const args = [];
  let start = 0;
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let quote = null;
  let escape = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (escape) { escape = false; continue; }
    if (quote) {
      if (ch === "\\") { escape = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "\`") { quote = ch; continue; }
    if (ch === "(") paren += 1;
    else if (ch === ")") paren -= 1;
    else if (ch === "{") brace += 1;
    else if (ch === "}") brace -= 1;
    else if (ch === "[") bracket += 1;
    else if (ch === "]") bracket -= 1;
    else if (ch === "," && paren === 0 && brace === 0 && bracket === 0) {
      args.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = body.slice(start).trim();
  if (last) args.push(last);
  return args;
}

function objectLiteralKeys(expression) {
  const trimmed = String(expression ?? "").trim();
  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceStart < 0 || braceEnd <= braceStart) return [];
  const body = trimmed.slice(braceStart + 1, braceEnd);
  const keys = [];
  for (const match of body.matchAll(/(?:^|,)\s*(?:["']([^"']+)["']|([A-Za-z_$][\w$]*))\s*:/g)) {
    keys.push(match[1] || match[2]);
  }
  return uniq(keys);
}

function argumentShape(expression, endpoint) {
  const value = String(expression ?? "").trim();
  if (!value) return "empty";
  if (value.includes(endpoint)) return "endpoint";
  if (/^(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/.test(value)) return "callback";
  const json = value.match(/^JSON\.stringify\s*\(\s*([A-Za-z_$][\w$]*)/);
  if (json) return "json-stringify:" + json[1];
  const call = value.match(/^([A-Za-z_$][\w$]*)\s*\(/);
  if (call) return "call:" + call[1];
  if (/^[A-Za-z_$][\w$]*$/.test(value)) return "identifier:" + value;
  const keys = objectLiteralKeys(value);
  if (keys.length) return "object:{" + keys.join(",") + "}";
  if (/^["']/.test(value)) return "literal:string";
  if (/^\d+$/.test(value)) return "literal:number";
  return "expression";
}

function inferredPayloadVariables(args, endpoint) {
  const vars = [];
  for (const arg of args) {
    if (arg.includes(endpoint)) continue;
    const json = arg.match(/JSON\.stringify\s*\(\s*([A-Za-z_$][\w$]*)/);
    if (json) vars.push(json[1]);
    else if (/^[A-Za-z_$][\w$]*$/.test(arg) && !/^(?:true|false|null|undefined)$/.test(arg)) vars.push(arg);
  }
  return uniq(vars);
}

function nearbyObjectKeys(text, variables, startIndex) {
  const prefix = text.slice(Math.max(0, startIndex - 5000), startIndex + 300);
  const out = {};
  for (const variable of variables) {
    const escaped = escapeRegex(variable);
    const assign = new RegExp("(?:var|let|const)?\\s*" + escaped + "\\s*=\\s*\\{([\\s\\S]{0,1800}?)\\}", "g");
    const keys = [];
    for (const match of prefix.matchAll(assign)) {
      for (const key of match[1].matchAll(/(?:^|,)\s*(?:["']([^"']+)["']|([A-Za-z_$][\w$]*))\s*:/g)) keys.push(key[1] || key[2]);
    }
    if (keys.length) out[variable] = uniq(keys);
  }
  return out;
}

function endpointCallsite(text, path, endpoint, index) {
  const before = text.slice(Math.max(0, index - 5000), index);
  const after = text.slice(index, Math.min(text.length, index + 5000));
  const around = before + after;
  const containingCall = findContainingCall(text, index);
  const callArgs = containingCall ? splitTopLevelArgs(containingCall.body) : [];
  const argumentShapes = callArgs.map((arg) => argumentShape(arg, endpoint));
  const payloadVariables = inferredPayloadVariables(callArgs, endpoint);
  const objectKeys = nearbyObjectKeys(text, payloadVariables, containingCall?.open ?? index);

  REQUEST_HELPER_RE.lastIndex = 0;
  const helperMatches = [...before.matchAll(REQUEST_HELPER_RE)];
  const fallbackHelper = helperMatches.at(-1)?.[1] ?? null;
  const transportHelper = containingCall?.helper ?? fallbackHelper;

  let payloadVariable = payloadVariables.find((name) => {
    const keys = objectKeys[name] ?? [];
    return keys.length > 0 || fieldAssignments(around, name).length > 0;
  }) ?? payloadVariables[0] ?? null;

  let fields = fieldAssignments(around, payloadVariable);
  if (!fields.length && payloadVariable && objectKeys[payloadVariable]?.length) {
    fields = objectKeys[payloadVariable].map((field) => ({ field, transform:"unknown", transformArgs:[] }));
  }

  const directObjectArg = callArgs.find((arg) => objectLiteralKeys(arg).length > 0);
  const directObjectKeys = directObjectArg ? objectLiteralKeys(directObjectArg) : [];

  const transforms = [];
  const callBody = containingCall?.body ?? around;
  for (const match of callBody.matchAll(/\b(hex_hmac_md5|hex_md5|md5)\s*\(([^)]*)\)/gi)) {
    transforms.push({
      name:match[1],
      args:match[2].split(",").map((part) => part.trim()).filter(Boolean).slice(0, 4)
    });
  }

  const structural = traceLoginStructure({ source:text, endpointIndex:index, payloadVariable });

  const responseSignals = [];
  for (const match of around.matchAll(/(?:retcode|code|status)\s*(?:===|==)\s*([A-Za-z_$][\w$]*|-?\d+)/g)) {
    responseSignals.push(match[1]);
  }

  return {
    sourcePath:path,
    endpoint,
    functionName:structural.functionName ?? functionContext(text, index),
    functionParams:structural.functionParams,
    transportHelper,
    payloadVariable,
    payloadVariables,
    argumentShapes,
    objectKeys,
    directObjectKeys,
    fields,
    transforms:uniq(transforms.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item)),
    structuralTrace:structural.payloadTrace,
    payloadOrigins:structural.payloadOrigins,
    payloadAliases:structural.aliases,
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
  const numericAuthConstants = extractAuthNumericConstants(text);
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
    numericAuthConstants,
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
  const numericAuthConstants = uniq(analyses.flatMap((item) => item.numericAuthConstants).map((item) => JSON.stringify(item))).map((item) => JSON.parse(item));
  const loginCallsites = endpointCallsites.filter((item) => loginSubmitEndpoints.includes(item.endpoint));
  const loginFieldCandidates = uniq(loginCallsites.flatMap((item) => [
    ...item.fields.map((field) => field.field),
    ...item.directObjectKeys,
    ...Object.values(item.objectKeys ?? {}).flat()
  ]));
  const hasRequestShape = (item) => item.fields.length > 0 || item.directObjectKeys.length > 0 || Object.values(item.objectKeys ?? {}).some((keys) => keys.length > 0) || item.argumentShapes.some((shape) => shape.startsWith("json-stringify:") || shape.startsWith("object:{"));
  const hasPayloadOrigin = (item) => (item.payloadOrigins ?? []).some((entry) => ["payload-assign","payload-append","field-assign","field-append","payload-call"].includes(entry.kind));
  const responseCodeMap = Object.fromEntries(numericAuthConstants.map((item) => [String(item.value), item.name]));
  const fixedKeys = uniq(analyses.map((item) => item.passwordCodec.fixedLoginKey).filter(Boolean));
  const hmacMd5 = analyses.some((item) => item.passwordCodec.hmacMd5);

  let status = "INSUFFICIENT_SOURCE_EVIDENCE";
  if (loginCallsites.some((item) => hasRequestShape(item) && item.hasHmacMd5)) status = "LOGIN_CALL_SHAPE_CANDIDATE_READY";
  else if (loginCallsites.some(hasPayloadOrigin)) status = "LOGIN_PAYLOAD_ORIGIN_FOUND";
  else if (loginSubmitEndpoints.length && candidateRequestFields.length && hmacMd5) status = "LOGIN_SOURCE_CANDIDATE_READY";
  else if (loginSubmitEndpoints.length) status = "LOGIN_ENDPOINT_CANDIDATE_FOUND";
  else if (authEndpoints.length || hmacMd5 || fixedKeys.length) status = "AUTH_SUPPORTING_EVIDENCE_ONLY";

  return {
    schema:"nc03-auth-source-evidence/v6",
    status,
    sourcesAnalyzed:analyses.map((item) => item.path),
    authEndpoints,
    loginSubmitEndpoints,
    loginPageCandidates,
    loginFunctions,
    candidateRequestFields,
    loginFieldCandidates,
    loginCallsites,
    numericAuthConstants,
    responseCodeMap,
    passwordCodec:{
      fixedLoginKeyPresent:fixedKeys.length > 0,
      fixedLoginKeys:fixedKeys,
      hmacMd5
    },
    discoveredScriptRefs:scriptRefs,
    readyForRequestShapeMapping:loginCallsites.some(hasRequestShape),
    payloadOriginFound:loginCallsites.some(hasPayloadOrigin),
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
