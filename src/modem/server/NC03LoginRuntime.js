import { createHmac, randomInt as nodeRandomInt } from "node:crypto";

function escapeRegex(value) {
  return String(value).replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
}

function sourceByPath(sources, path) {
  return String((sources ?? []).find((item) => item?.path === path)?.source ?? "");
}

function requireValue(value, code) {
  if (!value) throw new Error(code);
  return value;
}

function lowByteBuffer(value) {
  const text = String(value ?? "");
  const out = Buffer.alloc(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

export function hmacMd5Compat(key, data) {
  return createHmac("md5", lowByteBuffer(key)).update(lowByteBuffer(data)).digest("hex");
}

function parseJsStringArray(source, variableName) {
  const escaped = escapeRegex(variableName);
  const match = String(source).match(new RegExp("\\b(?:var|let|const)\\s+" + escaped + "\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;", "m"));
  if (!match) throw new Error("AUTH_ENCRYPTION_ARRAY_MISSING");
  const values = [];
  const itemRe = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g;
  for (const item of match[1].matchAll(itemRe)) {
    const raw = item[1] ?? item[2] ?? "";
    values.push(raw.replace(/\\(["'\\])/g, "$1"));
  }
  if (values.length < 26) throw new Error("AUTH_ENCRYPTION_ARRAY_INVALID");
  return values;
}

function passwordType(value) {
  const str = String(value ?? "");
  if (!str) return "mixAll";
  const isnum = /^\d+$/.test(str);
  const islower = /^[a-z]+$/.test(str);
  const isupper = /^[A-Z]+$/.test(str);
  const isspec = /^\W/.test(str);
  const includeNum = /[0-9]/.test(str);
  const includeLower = /[a-z]/.test(str);
  const includeUpper = /[A-Z]/.test(str);
  const includeSpec = /\W/.test(str);

  if (isnum) return "number";
  if (islower) return "lower";
  if (isupper) return "upper";
  if (isspec) return "spec";
  const count = Number(includeNum) + Number(includeLower) + Number(includeUpper) + Number(includeSpec);
  if (count === 4 || count === 0 || includeSpec) return "mixAll";
  if (includeNum && includeLower && includeUpper) return "alphaNum";
  if (includeLower && includeUpper) return "alpha";
  if (includeUpper && includeNum) return "upperNum";
  if (includeLower && includeNum) return "lowerNum";
  return "mixAll";
}

function alphabetNameFor(value) {
  return {
    number:"g_s_pass_number",
    lower:"g_s_pass_lower",
    upper:"g_s_pass_upper",
    spec:"g_s_pass_spec",
    lowerNum:"g_s_pass_lower_num",
    upperNum:"g_s_pass_upper_num",
    alpha:"g_s_pass_alpha",
    alphaNum:"g_s_pass_alpha_number",
    mixAll:"g_s_pass_mix_all"
  }[passwordType(value)];
}

function swapChars(value, left, right) {
  if (!value.length || left === right) return value;
  const chars = [...value];
  const a = left % chars.length;
  const b = right % chars.length;
  const tmp = chars[a];
  chars[a] = chars[b];
  chars[b] = tmp;
  return chars.join("");
}

export function passwordEncodeCompat(password, secret, timestamp, timestampStart, encryptionSource, options = {}) {
  const randomIntImpl = options.randomIntImpl ?? ((min, max) => nodeRandomInt(min, max));
  const nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  const currentArray = parseJsStringArray(encryptionSource, alphabetNameFor(password));
  const count = randomIntImpl(1, 5);
  const randomIndexes = Array(count);
  let spliceStr = "";

  for (let i = count - 1; i >= 0; i -= 1) {
    const index = randomIntImpl(0, 256);
    if (!currentArray[index]) throw new Error("AUTH_ENCRYPTION_ARRAY_TOO_SHORT");
    spliceStr += currentArray[index];
    randomIndexes[i] = index.toString(16).padStart(2, "0");
  }

  let splicedPassword = spliceStr + String(password);
  const parsedSecret = Number.parseInt(String(secret), 16);
  if (!Number.isFinite(parsedSecret)) throw new Error("AUTH_PRIKEY_INVALID");

  for (let i = 0; i < 4; i += 1) {
    const target = ((parsedSecret >> (i * 8)) & 0xff) % splicedPassword.length;
    splicedPassword = swapChars(splicedPassword, target, i % splicedPassword.length);
  }

  const randomPrefix = randomIndexes.join("");
  const timeStamp = (Number.parseInt(String(timestamp), 16) + (nowSeconds() - Number(timestampStart))).toString(16);
  const message = randomPrefix + "x" + timeStamp + ":" + splicedPassword;
  let encoded = Buffer.from(message, "utf8").toString("base64");

  for (let i = 0; i < 4; i += 1) {
    const target = ((parsedSecret >> (i * 8)) & 0xff) % encoded.length;
    encoded = swapChars(encoded, target, i % encoded.length);
  }
  return encoded;
}

function extractFunctionBody(source, name) {
  const text = String(source ?? "");
  const startMatch = new RegExp("function\\s+" + escapeRegex(name) + "\\s*\\([^)]*\\)\\s*\\{").exec(text);
  if (!startMatch) return "";
  const open = startMatch.index + startMatch[0].lastIndexOf("{");
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
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return "";
}

function extractLoginKey(loginSource) {
  const generic = loginSource.match(/_obj\s*\[\s*val\.name\s*\]\s*=\s*hex_hmac_md5\s*\(\s*([A-Za-z_$][\w$]*)\s*,\s*val\.value\s*\)/);
  const explicitPassword = loginSource.match(/_obj\.password\s*=\s*hex_hmac_md5\s*\(\s*([A-Za-z_$][\w$]*)\s*,/);
  const explicitUsername = loginSource.match(/_obj\.username\s*=\s*hex_hmac_md5\s*\(\s*([A-Za-z_$][\w$]*)\s*,/);
  const variable = generic?.[1] || explicitPassword?.[1] || explicitUsername?.[1];
  if (!variable) throw new Error("AUTH_LOGIN_KEY_VARIABLE_MISSING");
  const literal = loginSource.match(new RegExp("\\b(?:var|let|const)\\s+" + escapeRegex(variable) + "\\s*=\\s*[\"']([^\"']+)[\"']"));
  if (!literal?.[1]) throw new Error("AUTH_LOGIN_KEY_LITERAL_MISSING");
  return { variable, value:literal[1] };
}

export function deriveVerifiedLoginRecipe(sources) {
  const loginSource = sourceByPath(sources, "/js/login.js");
  const toolsSource = sourceByPath(sources, "/js/tools.js");
  const encryptionSource = sourceByPath(sources, "/js/encryption.js");

  requireValue(loginSource, "AUTH_LOGIN_SOURCE_MISSING");
  requireValue(toolsSource, "AUTH_TOOLS_SOURCE_MISSING");
  requireValue(encryptionSource, "AUTH_ENCRYPTION_SOURCE_MISSING");

  const loginBody = requireValue(extractFunctionBody(loginSource, "login"), "AUTH_LOGIN_FUNCTION_MISSING");
  const helperBody = requireValue(extractFunctionBody(toolsSource, "saveAjaxJsonData"), "AUTH_TRANSPORT_HELPER_MISSING");
  const tokenBody = requireValue(extractFunctionBody(toolsSource, "getAjaxJsonTokeData"), "AUTH_TOKEN_HELPER_MISSING");

  const loginKey = extractLoginKey(loginSource);
  const hashesSerializedForm = /serializeArray\s*\(\)/.test(loginBody)
    && /_obj\s*\[\s*val\.name\s*\]\s*=\s*hex_hmac_md5\s*\(\s*[A-Za-z_$][\w$]*\s*,\s*val\.value\s*\)/.test(loginBody);
  const explicitUsernameHmac = /_obj\.username\s*=\s*hex_hmac_md5\s*\(/.test(loginBody);
  const explicitPasswordHmac = /_obj\.password\s*=\s*hex_hmac_md5\s*\(/.test(loginBody);
  const passwordEncode = /_obj\.password\s*=\s*password_encode\s*\(\s*_obj\.password\s*,/.test(loginBody);

  const transportVerified = /type\s*:\s*["']POST["']/i.test(helperBody)
    && /contentType\s*:\s*["']application\/json["']/i.test(helperBody)
    && /setRequestHeader\s*\(\s*["']X-Csrf-Token["']/.test(helperBody)
    && /data\s*:\s*data\b/.test(helperBody);
  const tokenVerified = /type\s*:\s*["']GET["']/i.test(tokenBody)
    && /getResponseHeader\s*\(\s*["']X-Csrf-Token["']/.test(tokenBody)
    && /\/goform\/x_csrf_token/.test(toolsSource);

  const loginInfoVerified = /\/goform\/get_login_info/.test(loginSource)
    && /obj\.priKey/.test(loginSource)
    && /\.split\s*\(\s*["']x["']\s*\)\s*\[\s*0\s*\]/.test(loginSource)
    && /\.split\s*\(\s*["']x["']\s*\)\s*\[\s*1\s*\]/.test(loginSource);
  const loginEndpointVerified = /saveAjaxJsonData\s*\(\s*["']\/goform\/login["']/.test(loginBody);
  const successZeroVerified = /g_resultSuccess\s*=\s*0\b/.test(loginSource)
    && /retcode\s*===\s*g_resultSuccess/.test(loginBody);
  const remainingTimesObserved = /reminingTimes/.test(loginBody);

  if (!(hashesSerializedForm || (explicitUsernameHmac && explicitPasswordHmac))) throw new Error("AUTH_HMAC_FORM_RECIPE_UNVERIFIED");
  if (!passwordEncode) throw new Error("AUTH_PASSWORD_ENCODE_UNVERIFIED");
  if (!transportVerified) throw new Error("AUTH_TRANSPORT_UNVERIFIED");
  if (!tokenVerified) throw new Error("AUTH_CSRF_FLOW_UNVERIFIED");
  if (!loginInfoVerified) throw new Error("AUTH_LOGIN_INFO_UNVERIFIED");
  if (!loginEndpointVerified) throw new Error("AUTH_LOGIN_ENDPOINT_UNVERIFIED");
  if (!successZeroVerified) throw new Error("AUTH_SUCCESS_SEMANTICS_UNVERIFIED");
  if (!/function\s+password_encode\s*\(/.test(encryptionSource)
      || !/Base64\.encode\s*\(/.test(encryptionSource)
      || !/time_stamp/.test(encryptionSource)) {
    throw new Error("AUTH_PASSWORD_CODEC_UNVERIFIED");
  }

  return {
    endpoint:"/goform/login",
    loginInfoEndpoint:"/goform/get_login_info",
    csrfEndpoint:"/goform/x_csrf_token",
    loginKey,
    hmac:{ username:true, password:true },
    passwordEncode:true,
    contentType:"application/json",
    method:"POST",
    successCode:0,
    remainingTimesObserved,
    encryptionSource
  };
}

async function parseJsonResponse(response, code) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(code);
  }
}

export async function performVerifiedLogin(options) {
  const {
    baseUrl,
    username,
    password,
    sources,
    fetchImpl,
    onToken
  } = options;
  const nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  const randomIntImpl = options.randomIntImpl ?? ((min, max) => nodeRandomInt(min, max));

  const recipe = deriveVerifiedLoginRecipe(sources);
  const user = String(username ?? "");
  const pass = String(password ?? "");
  if (user.length < 5 || user.length > 15) throw new Error("AUTH_USERNAME_LENGTH_INVALID");
  if (pass.length < 5 || pass.length > 36) throw new Error("AUTH_PASSWORD_LENGTH_INVALID");
  if (typeof fetchImpl !== "function") throw new Error("AUTH_TRANSPORT_UNAVAILABLE");

  const tokenResponse = await fetchImpl(new URL(recipe.csrfEndpoint, baseUrl).toString(), {
    method:"GET",
    redirect:"manual",
    headers:{ Accept:"application/json,*/*;q=0.5" }
  });
  if (!tokenResponse.ok) throw new Error("AUTH_CSRF_TOKEN_FETCH_FAILED");
  let token = tokenResponse.headers.get("x-csrf-token");
  if (!token) throw new Error("AUTH_CSRF_TOKEN_MISSING");
  onToken?.(token);

  const requestJson = async (path, body) => {
    const init = {
      method:"POST",
      redirect:"manual",
      headers:{
        Accept:"application/json",
        "Content-Type":"application/json",
        "X-Csrf-Token":token
      }
    };
    if (body !== undefined) init.body = body;
    const response = await fetchImpl(new URL(path, baseUrl).toString(), init);
    const nextToken = response.headers.get("x-csrf-token");
    if (nextToken) {
      token = nextToken;
      onToken?.(token);
    }
    if (!response.ok) {
      if (response.status === 403) throw new Error("AUTH_CSRF_REJECTED");
      throw new Error("AUTH_MODEM_HTTP_" + response.status);
    }
    return parseJsonResponse(response, "AUTH_MODEM_JSON_INVALID");
  };

  const info = await requestJson(recipe.loginInfoEndpoint);
  const loginInfoStart = nowSeconds();
  if (Number(info?.retcode) !== recipe.successCode || typeof info?.priKey !== "string") {
    throw new Error("AUTH_LOGIN_INFO_FAILED");
  }
  const parts = info.priKey.split("x");
  const secret = parts[0];
  const timestamp = parts[1];
  if (!secret || !timestamp) throw new Error("AUTH_PRIKEY_INVALID");

  const usernameHash = hmacMd5Compat(recipe.loginKey.value, user);
  const passwordHash = hmacMd5Compat(recipe.loginKey.value, pass);
  const encodedPassword = passwordEncodeCompat(
    passwordHash,
    secret,
    timestamp,
    loginInfoStart,
    recipe.encryptionSource,
    { randomIntImpl, nowSeconds }
  );
  const body = JSON.stringify({ username:usernameHash, password:encodedPassword });

  const result = await requestJson(recipe.endpoint, body);
  if (Number(result?.retcode) !== recipe.successCode) {
    return {
      authenticated:false,
      code:"LOGIN_FAILED",
      remainingTimes:Number.isFinite(Number(result?.reminingTimes)) ? Number(result.reminingTimes) : null
    };
  }

  const verified = await requestJson(recipe.loginInfoEndpoint);
  if (Number(verified?.retcode) !== recipe.successCode || Number(verified?.loginStatus) !== 1) {
    throw new Error("AUTH_POST_LOGIN_VERIFY_FAILED");
  }

  return {
    authenticated:true,
    loginUser:typeof verified?.loginUser === "string" && verified.loginUser ? verified.loginUser : user,
    remainingTimes:null,
    csrfToken:token,
    recipe:{
      endpoint:recipe.endpoint,
      contentType:recipe.contentType,
      method:recipe.method,
      hmacUsername:true,
      hmacPassword:true,
      passwordEncode:true,
      successCode:recipe.successCode
    }
  };
}
