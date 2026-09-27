import { createHmac } from "node:crypto";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
}

function findFunctionBody(source, name) {
  const text = String(source ?? "");
  const escapedName = escapeRegex(name);
  const patterns = [
    new RegExp("function\\s+" + escapedName + "\\s*\\(([^)]*)\\)\\s*\\{"),
    new RegExp("(?:var\\s+)?" + escapedName + "\\s*=\\s*function\\s*\\(([^)]*)\\)\\s*\\{")
  ];
  const match = patterns.map((pattern) => pattern.exec(text)).find(Boolean);
  if (!match) return null;

  const open = (match.index ?? 0) + match[0].lastIndexOf("{");
  let depth = 1;
  let quote = null;
  let escaped = false;

  for (let i = open + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          params:match[1].split(",").map((value) => value.trim()).filter(Boolean),
          body:text.slice(open + 1, i)
        };
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
  let escaped = false;

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
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

function extractCallArgs(expression, callName) {
  const text = String(expression ?? "");
  const re = new RegExp("\\b" + escapeRegex(callName) + "\\s*\\(", "i");
  const match = re.exec(text);
  if (!match) return null;

  const open = (match.index ?? 0) + match[0].lastIndexOf("(");
  let depth = 1;
  let quote = null;
  let escaped = false;

  for (let i = open + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return splitTopLevelArgs(text.slice(open + 1, i));
    }
  }
  return null;
}

function collectStaticStrings(text) {
  const values = new Map();
  const re = /(?:^|[;{}\n])\s*(?:(?:var|let|const)\s+)?([A-Za-z_$][\w$]*)\s*=\s*(["'])([^"'\r\n]*)\2\s*(?=;|\n|$)/g;
  for (const match of String(text ?? "").matchAll(re)) values.set(match[1], match[3]);
  return values;
}

function resolveStaticString(expression, staticStrings) {
  const value = String(expression ?? "").trim();
  const literal = value.match(/^(["'])([^"'\r\n]*)\1$/);
  if (literal) return literal[2];
  if (/^[A-Za-z_$][\w$]*$/.test(value)) return staticStrings.get(value) ?? null;
  return null;
}

function extractAssignmentExpression(text, name) {
  const escaped = escapeRegex(name);
  const patterns = [
    new RegExp("(?:^|[;{}\\n])\\s*(?:(?:var|let|const)\\s+)?" + escaped + "\\s*=\\s*([^;\\n]+)", "m"),
    new RegExp("\\b" + escaped + "\\s*=\\s*([^;\\n]+)", "m")
  ];
  return patterns.map((pattern) => pattern.exec(String(text ?? ""))?.[1]?.trim()).find(Boolean) ?? null;
}

function extractFieldExpression(body, field) {
  const escaped = escapeRegex(field);
  const patterns = [
    new RegExp("\\b[A-Za-z_$][\\w$]*\\." + escaped + "\\s*=\\s*([^;\\n]+)", "i"),
    new RegExp("\\b[A-Za-z_$][\\w$]*\\[\\s*[\"']" + escaped + "[\"']\\s*\\]\\s*=\\s*([^;\\n]+)", "i")
  ];
  return patterns.map((pattern) => pattern.exec(String(body ?? ""))?.[1]?.trim()).find(Boolean) ?? null;
}

function isInputExpression(expression, scopeText, depth = 0) {
  if (depth > 4) return false;
  const value = String(expression ?? "").trim();
  if (!value) return false;
  if (/\.val\s*\(\s*\)|\.value\b|\b(?:getValue|getInput)\s*\(/i.test(value)) return true;
  if (!/^[A-Za-z_$][\w$]*$/.test(value)) return false;
  const assigned = extractAssignmentExpression(scopeText, value);
  return assigned ? isInputExpression(assigned, scopeText, depth + 1) : false;
}

function endpointFromLoginBody(body, staticStrings) {
  const direct = String(body ?? "").match(/["'](\/goform\/login)["']/)?.[1] ?? null;
  if (direct) return direct;

  const helper = /\bsaveAjaxJsonData\s*\(([^\n;]+)/i.exec(String(body ?? ""));
  if (!helper) return null;
  const args = splitTopLevelArgs(helper[1]);
  for (const arg of args.slice(0, 2)) {
    const resolved = resolveStaticString(arg, staticStrings);
    if (resolved === "/goform/login") return resolved;
  }
  return null;
}

function hmacMd5(key, value) {
  return createHmac("md5", String(key)).update(String(value)).digest("hex");
}

export function discoverNc03LoginRecipe(loginSource = "", supportingSources = []) {
  const source = String(loginSource ?? "");
  const supportText = [
    source,
    ...supportingSources.map((item) => String(item?.source ?? item ?? ""))
  ].join("\n");

  const login = findFunctionBody(source, "login");
  if (!login) return { ready:false, code:"LOGIN_FUNCTION_NOT_FOUND", evidence:{ loginFunction:false } };

  const staticStrings = collectStaticStrings(supportText);
  const usernameExpression = extractFieldExpression(login.body, "username");
  const passwordExpression = extractFieldExpression(login.body, "password");
  const usernameHmacArgs = extractCallArgs(usernameExpression, "hex_hmac_md5");
  const passwordHmacArgs = extractCallArgs(passwordExpression, "hex_hmac_md5");

  const keyExpression = usernameHmacArgs?.[0] ?? passwordHmacArgs?.[0] ?? "loginKey";
  const key = resolveStaticString(keyExpression, staticStrings)
    ?? staticStrings.get("loginKey")
    ?? null;

  const endpoint = endpointFromLoginBody(login.body, staticStrings);
  const usernameLiteral = usernameHmacArgs?.length >= 2
    ? resolveStaticString(usernameHmacArgs[1], staticStrings)
    : null;
  const usernameHmac = Boolean(usernameHmacArgs?.length >= 2 && key);
  const passwordHmac = Boolean(passwordHmacArgs?.length >= 2 && key);
  const passwordInput = Boolean(passwordHmacArgs?.length >= 2
    && isInputExpression(passwordHmacArgs[1], login.body + "\n" + supportText));

  const successBranch = /retcode\s*(?:===|==)\s*(?:0|g_resultSuccess)\b/i.test(login.body);
  const successZero = successBranch
    && (/\bg_resultSuccess\s*=\s*0\b/.test(supportText) || /retcode\s*(?:===|==)\s*0\b/.test(login.body));
  const genericFailure13 = /retcode\s*(?:===|==)\s*13\b/.test(login.body)
    || (/\bg_[A-Za-z0-9_$]*(?:password|login)[A-Za-z0-9_$]*\s*=\s*13\b/i.test(supportText)
      && /retcode\s*(?:===|==)\s*g_[A-Za-z0-9_$]*(?:password|login)[A-Za-z0-9_$]*\b/i.test(login.body));

  const evidence = {
    loginFunction:true,
    loginKey:Boolean(key),
    endpoint:Boolean(endpoint),
    usernameHmac,
    usernameLiteral:Boolean(usernameLiteral),
    passwordHmac,
    passwordInput,
    successZero,
    genericFailure13
  };

  if (!key || !endpoint || !usernameLiteral || !usernameHmac || !passwordHmac || !passwordInput || !successZero) {
    return {
      ready:false,
      code:"LOGIN_RECIPE_INCOMPLETE",
      evidence
    };
  }

  return {
    ready:true,
    endpoint,
    key,
    usernameLiteral,
    passwordTransform:"HMAC-MD5",
    successCode:0,
    genericFailureCodes:genericFailure13 ? [13] : [],
    evidence
  };
}

export function discoverSaveAjaxTransport(sources = []) {
  for (const source of sources) {
    const fn = findFunctionBody(source?.source ?? source ?? "", "saveAjaxJsonData");
    if (!fn) continue;

    const body = fn.body;
    const method = body.match(/(?:type|method)\s*:\s*["'](GET|POST)["']/i)?.[1]?.toUpperCase() ?? null;
    const contentType = body.match(/contentType\s*:\s*["']([^"']+)["']/i)?.[1] ?? null;
    const dataParam = fn.params[1] ?? null;
    const dataForwarded = dataParam
      ? new RegExp("\\bdata\\s*:\\s*" + escapeRegex(dataParam) + "\\b").test(body)
      : false;

    if (method && dataForwarded) {
      return {
        ready:true,
        helper:"saveAjaxJsonData",
        method,
        contentType:contentType || "application/x-www-form-urlencoded; charset=UTF-8",
        rawStringBody:true
      };
    }
  }

  return { ready:false, code:"LOGIN_TRANSPORT_UNRESOLVED" };
}

export function buildNc03LoginPayload(recipe, password) {
  if (!recipe?.ready) throw new Error("LOGIN_RECIPE_UNRESOLVED");
  if (typeof password !== "string" || !password) throw new Error("PASSWORD_REQUIRED");

  return JSON.stringify({
    username:hmacMd5(recipe.key, recipe.usernameLiteral),
    password:hmacMd5(recipe.key, password)
  });
}

export async function executeNc03Login({
  baseUrl,
  password,
  recipe,
  transport,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!recipe?.ready) throw new Error("LOGIN_RECIPE_UNRESOLVED");
  if (!transport?.ready) throw new Error("LOGIN_TRANSPORT_UNRESOLVED");
  if (typeof fetchImpl !== "function") throw new Error("LOGIN_TRANSPORT_UNAVAILABLE");

  const payload = buildNc03LoginPayload(recipe, password);
  const response = await fetchImpl(new URL(recipe.endpoint, baseUrl).toString(), {
    method:transport.method,
    redirect:"manual",
    signal:AbortSignal.timeout(5000),
    headers:{
      Accept:"application/json, text/javascript, */*; q=0.01",
      "Content-Type":transport.contentType,
      "X-Requested-With":"XMLHttpRequest"
    },
    body:transport.method === "GET" ? undefined : payload
  });

  const result = await response.json().catch(() => null);
  const retcode = Number(result?.retcode);

  if (!response.ok) {
    return {
      ok:false,
      code:"LOGIN_HTTP_ERROR",
      httpStatus:response.status,
      retcode:Number.isFinite(retcode) ? retcode : null
    };
  }
  if (retcode === recipe.successCode) return { ok:true, retcode };

  return {
    ok:false,
    code:"LOGIN_REJECTED",
    retcode:Number.isFinite(retcode) ? retcode : null
  };
}
