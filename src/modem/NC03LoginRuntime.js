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
  if (!login) return { ready:false, code:"LOGIN_FUNCTION_NOT_FOUND" };

  const key = source.match(/\bloginKey\s*=\s*["']([^"']+)["']/)?.[1] ?? null;
  const endpoint = login.body.match(/["'](\/goform\/login)["']/)?.[1] ?? null;
  const usernameLiteral = login.body.match(
    /_obj\.username\s*=\s*hex_hmac_md5\s*\(\s*loginKey\s*,\s*["']([^"']+)["']\s*\)/i
  )?.[1] ?? null;
  const passwordHmac = /_obj\.password\s*=\s*hex_hmac_md5\s*\(\s*loginKey\s*,[\s\S]{0,500}?\.val\s*\(\s*\)\s*\)/i.test(login.body);
  const successBranch = /retcode\s*(?:===|==)\s*(?:0|g_resultSuccess)\b/i.test(login.body);
  const successZero = successBranch
    && (/\bg_resultSuccess\s*=\s*0\b/.test(supportText) || /retcode\s*(?:===|==)\s*0\b/.test(login.body));
  const genericFailure13 = /retcode\s*(?:===|==)\s*13\b/.test(login.body);

  if (!key || !endpoint || !usernameLiteral || !passwordHmac || !successZero) {
    return {
      ready:false,
      code:"LOGIN_RECIPE_INCOMPLETE",
      evidence:{
        loginKey:Boolean(key),
        endpoint:Boolean(endpoint),
        usernameLiteral:Boolean(usernameLiteral),
        passwordHmac,
        successZero,
        genericFailure13
      }
    };
  }

  return {
    ready:true,
    endpoint,
    key,
    usernameLiteral,
    passwordTransform:"HMAC-MD5",
    successCode:0,
    genericFailureCodes:genericFailure13 ? [13] : []
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
