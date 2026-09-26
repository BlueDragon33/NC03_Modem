function uniq(values) {
  return [...new Set(values)];
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^$()|[\]\\]/g, "\\$&");
}

function findMatchingBrace(text, openIndex) {
  let depth = 1;
  let quote = null;
  let escaped = false;
  for (let i = openIndex + 1; i < text.length; i += 1) {
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
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findContainingFunction(text, index) {
  const prefix = text.slice(0, index);
  const matches = [...prefix.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g)].reverse();
  for (const match of matches) {
    const open = (match.index ?? 0) + match[0].lastIndexOf("{");
    const close = findMatchingBrace(text, open);
    if (close > index) {
      return {
        name:match[1],
        params:match[2].split(",").map((part) => part.trim()).filter(Boolean),
        open,
        close,
        body:text.slice(open + 1, close)
      };
    }
  }
  return null;
}

function safeArgToken(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "empty";
  if (/^["']/.test(value)) return "literal:string";
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return "literal:number";
  if (/^(?:true|false)$/.test(value)) return "literal:boolean";
  if (/^(?:null|undefined)$/.test(value)) return "literal:nullish";
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(value)) return "identifier:" + value;
  const call = value.match(/^([A-Za-z_$][\w$]*)\s*\(/);
  if (call) return "call:" + call[1];
  if (value.includes("+")) return "concat-expression";
  return "expression";
}

function splitArgs(body) {
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
    if (ch === '"' || ch === "'") {
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

function objectKeys(expression) {
  const value = String(expression ?? "");
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  const keys = [];
  const body = value.slice(start + 1, end);
  for (const match of body.matchAll(/(?:^|,)\s*(?:["']([^"']+)["']|([A-Za-z_$][\w$]*))\s*:/g)) {
    keys.push(match[1] || match[2]);
  }
  return uniq(keys);
}

function expressionStructure(expression) {
  const value = String(expression ?? "").trim();
  const calls = [];
  for (const match of value.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(([^()]*)\)/g)) {
    const name = match[1];
    if (["if","for","while","switch","function"].includes(name)) continue;
    calls.push({
      name,
      args:splitArgs(match[2]).map(safeArgToken).slice(0, 6)
    });
  }

  const authTokens = [];
  for (const match of value.matchAll(/\b([A-Za-z_$][\w$]*(?:pass|passwd|password|pwd|user|username|login|auth|token)[A-Za-z0-9_$]*)\b/gi)) {
    authTokens.push(match[1]);
  }

  let shape = "expression";
  if (/^["']/.test(value)) shape = "literal:string";
  else if (/^-?\d+(?:\.\d+)?$/.test(value)) shape = "literal:number";
  else if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(value)) shape = "identifier";
  else if (/^[A-Za-z_$][\w$]*\s*\(/.test(value)) shape = "call";
  else if (objectKeys(value).length) shape = "object";
  else if (value.includes("+")) shape = "concat-expression";

  return {
    shape,
    objectKeys:objectKeys(value),
    calls:uniq(calls.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item)),
    authTokens:uniq(authTokens)
  };
}

function payloadTrace(functionInfo, payloadVariable) {
  if (!functionInfo || !payloadVariable) return [];
  const body = functionInfo.body;
  const escaped = escapeRegex(payloadVariable);
  const entries = [];

  const wholeAssign = new RegExp("(?:var|let|const)?\\s*" + escaped + "\\s*=\\s*([^;\\n]+)", "g");
  for (const match of body.matchAll(wholeAssign)) {
    entries.push({
      kind:"payload-assign",
      target:payloadVariable,
      structure:expressionStructure(match[1])
    });
  }

  const propertyPatterns = [
    new RegExp(escaped + "\\.([A-Za-z_$][\\w$]*)\\s*=\\s*([^;\\n]+)", "g"),
    new RegExp(escaped + "\\[[\"']([^\"']+)[\"']\\]\\s*=\\s*([^;\\n]+)", "g")
  ];
  for (const pattern of propertyPatterns) {
    for (const match of body.matchAll(pattern)) {
      entries.push({
        kind:"field-assign",
        target:payloadVariable + "." + match[1],
        structure:expressionStructure(match[2])
      });
    }
  }

  const calls = [];
  for (const match of body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(([^;]{0,1200}?)\)/g)) {
    if (!match[2].includes(payloadVariable)) continue;
    calls.push({
      kind:"payload-call",
      target:match[1],
      argShapes:splitArgs(match[2]).map(safeArgToken).slice(0, 8)
    });
  }

  return [
    ...entries,
    ...uniq(calls.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item))
  ];
}

export function traceLoginStructure({ source = "", endpointIndex = -1, payloadVariable = null } = {}) {
  const text = String(source ?? "");
  const functionInfo = endpointIndex >= 0 ? findContainingFunction(text, endpointIndex) : null;
  return {
    functionName:functionInfo?.name ?? null,
    functionParams:functionInfo?.params ?? [],
    payloadTrace:payloadTrace(functionInfo, payloadVariable)
  };
}

export function extractAuthNumericConstants(source = "") {
  const text = String(source ?? "");
  const constants = [];
  for (const match of text.matchAll(/\b(?:var|let|const)?\s*([A-Za-z_$][\w$]*(?:login|pass|passwd|password|pwd|auth|limit)[A-Za-z0-9_$]*)\s*=\s*(-?\d+)\b/gi)) {
    constants.push({ name:match[1], value:Number(match[2]) });
  }
  return uniq(constants.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item));
}
