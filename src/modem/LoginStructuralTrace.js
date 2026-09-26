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

function stripStringLiterals(value) {
  const text = String(value ?? "");
  let out = "";
  let quote = null;
  let escaped = false;
  for (const ch of text) {
    if (escaped) {
      escaped = false;
      if (!quote) out += ch;
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
      out += " literal ";
      continue;
    }
    out += ch;
  }
  return out;
}


function findMatchingParen(text, openIndex) {
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
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function collectCallTree(expression, depth = 0) {
  const text = String(expression ?? "");
  const calls = [];
  let quote = null;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
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

    if (!/[A-Za-z_$]/.test(ch)) continue;
    let end = i + 1;
    while (end < text.length && /[\w$]/.test(text[end])) end += 1;
    const name = text.slice(i, end);
    let cursor = end;
    while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
    if (text[cursor] !== "(") {
      i = end - 1;
      continue;
    }

    const close = findMatchingParen(text, cursor);
    if (close < 0) {
      i = end - 1;
      continue;
    }

    if (!["if","for","while","switch","function"].includes(name)) {
      const body = text.slice(cursor + 1, close);
      const args = splitArgs(body);
      calls.push({
        name,
        depth,
        args:args.map(safeArgToken).slice(0, 8)
      });
      for (const arg of args) calls.push(...collectCallTree(arg, depth + 1));
    }

    i = close;
  }

  return calls;
}

function authTransforms(calls = []) {
  return calls
    .filter((call) => /^(?:hex_hmac_md5|hex_md5|md5)$/i.test(call.name))
    .map((call) => ({
      name:call.name,
      depth:call.depth,
      args:call.args
    }));
}


function expressionSkeleton(expression) {
  const text = String(expression ?? "");
  let out = "";
  let quote = null;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
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
      if (ch === quote) {
        quote = null;
        out += "<string>";
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\d/.test(ch)) {
      out += "<number>";
      while (i + 1 < text.length && /[\d.]/.test(text[i + 1])) i += 1;
      continue;
    }
    out += ch;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, 500);
}

function statementBounds(text, index) {
  let start = index;
  let end = index;
  while (start > 0 && !/[;\n{}]/.test(text[start - 1])) start -= 1;
  while (end < text.length && !/[;\n{}]/.test(text[end])) end += 1;
  return { start, end };
}

function collectFieldReferenceFlow(text, objectName, fieldName) {
  const escapedObject = escapeRegex(objectName);
  const escapedField = escapeRegex(fieldName);
  const refRe = new RegExp("\\b" + escapedObject + "(?:\\." + escapedField + "|\\[[\"']" + escapedField + "[\"']\\])\\b", "g");
  const entries = [];
  for (const match of text.matchAll(refRe)) {
    const bounds = statementBounds(text, match.index ?? 0);
    const statement = text.slice(bounds.start, bounds.end).trim();
    if (!statement) continue;

    let role = "reference";
    const before = statement.slice(0, Math.max(0, (match.index ?? 0) - bounds.start));
    const after = statement.slice(Math.max(0, (match.index ?? 0) - bounds.start) + match[0].length);
    if (/^\s*(?:\+=|=)/.test(after)) role = "assignment-target";
    else if (/\breturn\s*$/.test(before)) role = "return-value";
    else if (/\([^)]*$/.test(before)) role = "call-argument";
    else if (/=\s*$/.test(before)) role = "assignment-source";

    entries.push({
      scope:scopeLabel(text, match.index ?? 0),
      role,
      skeleton:expressionSkeleton(statement),
      calls:collectCallTree(statement).map((item) => ({
        name:item.name,
        depth:item.depth,
        args:item.args
      })).slice(0, 20)
    });
  }

  const seen = new Set();
  return entries.filter((entry) => {
    const key = JSON.stringify(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 40);
}

function expressionStructure(expression) {
  const value = String(expression ?? "").trim();
  const identifierSource = stripStringLiterals(value);
  const calls = collectCallTree(value);

  const authTokens = [];
  for (const match of identifierSource.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
    if (/pass|passwd|password|pwd|user|username|login|auth|token|key/i.test(match[1])) authTokens.push(match[1]);
  }

  const identifiers = [];
  for (const match of identifierSource.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
    if (!["var","let","const","true","false","null","undefined","return","new","function","literal"].includes(match[1])) identifiers.push(match[1]);
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
    authTransforms:authTransforms(calls),
    skeleton:expressionSkeleton(value),
    authTokens:uniq(authTokens),
    identifiers:uniq(identifiers).slice(0, 20)
  };
}

function scopeLabel(text, index) {
  const info = findContainingFunction(text, index);
  return info?.name ? "function:" + info.name : "global";
}

function collectPayloadOrigins(text, payloadVariable) {
  if (!payloadVariable) return [];
  const escaped = escapeRegex(payloadVariable);
  const entries = [];

  const whole = new RegExp("(?:\\b(?:var|let|const)\\s+)?\\b" + escaped + "\\s*(\\+=|=)\\s*([^;\\n]+)", "g");
  for (const match of text.matchAll(whole)) {
    const structure = expressionStructure(match[2]);
    const literalFields = [];
    const expression = String(match[2] ?? "").trim();
    const braceStart = expression.indexOf("{");
    const braceEnd = expression.lastIndexOf("}");
    if (braceStart >= 0 && braceEnd > braceStart) {
      for (const part of splitArgs(expression.slice(braceStart + 1, braceEnd))) {
        const fieldMatch = part.match(/^\s*(?:["']([^"']+)["']|([A-Za-z_$][\w$]*))\s*:\s*([\s\S]+)$/);
        if (!fieldMatch) continue;
        literalFields.push({
          field:fieldMatch[1] || fieldMatch[2],
          structure:expressionStructure(fieldMatch[3])
        });
      }
    }
    entries.push({
      kind:match[1] === "+=" ? "payload-append" : "payload-assign",
      target:payloadVariable,
      scope:scopeLabel(text, match.index ?? 0),
      structure:{ ...structure, objectFields:literalFields }
    });
  }

  const propertyPatterns = [
    new RegExp("\\b" + escaped + "\\.([A-Za-z_$][\\w$]*)\\s*(\\+=|=)\\s*([^;\\n]+)", "g"),
    new RegExp("\\b" + escaped + "\\[[\"']([^\"']+)[\"']\\]\\s*(\\+=|=)\\s*([^;\\n]+)", "g")
  ];
  for (const pattern of propertyPatterns) {
    for (const match of text.matchAll(pattern)) {
      entries.push({
        kind:match[2] === "+=" ? "field-append" : "field-assign",
        target:payloadVariable + "." + match[1],
        scope:scopeLabel(text, match.index ?? 0),
        structure:expressionStructure(match[3])
      });
    }
  }

  for (const match of text.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(([^;]{0,1800}?)\)/g)) {
    if (!match[2].includes(payloadVariable)) continue;
    entries.push({
      kind:"payload-call",
      target:match[1],
      scope:scopeLabel(text, match.index ?? 0),
      argShapes:splitArgs(match[2]).map(safeArgToken).slice(0, 10)
    });
  }

  const seen = new Set();
  const deduped = [];
  for (const entry of entries) {
    const key = JSON.stringify(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }
  return deduped.slice(0, 80);
}

function collectAliases(text, payloadVariable) {
  if (!payloadVariable) return [];
  const escaped = escapeRegex(payloadVariable);
  const aliases = [];

  for (const match of text.matchAll(new RegExp("\\b([A-Za-z_$][\\w$]*)\\s*=\\s*" + escaped + "\\s*(?=;|\\n|$)", "g"))) {
    if (match[1] !== payloadVariable) aliases.push({ alias:match[1], relation:"from-payload", scope:scopeLabel(text, match.index ?? 0) });
  }
  for (const match of text.matchAll(new RegExp("\\b" + escaped + "\\s*=\\s*([A-Za-z_$][\\w$]*)\\s*(?=;|\\n|$)", "g"))) {
    if (match[1] !== payloadVariable) aliases.push({ alias:match[1], relation:"to-payload", scope:scopeLabel(text, match.index ?? 0) });
  }

  return uniq(aliases.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item)).slice(0, 30);
}


const DEPENDENCY_NOISE = new Set([
  "JSON","stringify","parse","Object","Array","String","Number","Boolean","Math","Date",
  "console","window","document","function","callback","undefined","null","true","false"
]);

function assignmentExists(text, variable) {
  const escaped = escapeRegex(variable);
  return new RegExp("(?:\\b(?:var|let|const)\\s+)?\\b" + escaped + "\\s*(?:\\+=|=)|\\b" + escaped + "(?:\\.[A-Za-z_$][\\w$]*|\\[[\"'][^\"']+[\"']\\])\\s*(?:\\+=|=)").test(text);
}

function dependencyCandidatesFromEntries(entries, payloadVariable) {
  const values = [];
  for (const entry of entries) {
    for (const id of entry.structure?.identifiers ?? []) values.push(id);
    for (const call of entry.structure?.calls ?? []) {
      for (const arg of call.args ?? []) {
        const match = String(arg).match(/^identifier:([A-Za-z_$][\w$]*)$/);
        if (match) values.push(match[1]);
      }
    }
  }
  return uniq(values.filter((value) =>
    value !== payloadVariable
    && !DEPENDENCY_NOISE.has(value)
    && !/^(?:saveAjaxJsonData|ajaxGetJsonData|ajaxGetJsonDataGoform)$/i.test(value)
  ));
}

function tracePayloadDependencies(text, functionInfo, payloadVariable) {
  if (!payloadVariable) return { variables:[], origins:[] };
  const payloadEntries = collectPayloadOrigins(text, payloadVariable)
    .filter((entry) => !functionInfo?.name || entry.scope === "function:" + functionInfo.name || entry.scope === "global");
  const roots = dependencyCandidatesFromEntries(payloadEntries, payloadVariable)
    .filter((name) => assignmentExists(text, name));

  const queue = roots.map((name) => ({ name, depth:0, parent:payloadVariable }));
  const seen = new Set();
  const origins = [];
  const variables = [];

  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current.name) || current.depth > 2) continue;
    seen.add(current.name);
    variables.push(current.name);

    const entries = collectPayloadOrigins(text, current.name)
      .filter((entry) => !functionInfo?.name || entry.scope === "function:" + functionInfo.name || entry.scope === "global")
      .map((entry) => ({
        ...entry,
        dependencyVariable:current.name,
        parentVariable:current.parent,
        depth:current.depth
      }));
    origins.push(...entries);

    const next = dependencyCandidatesFromEntries(entries, current.name)
      .filter((name) => assignmentExists(text, name));
    for (const name of next) queue.push({ name, depth:current.depth + 1, parent:current.name });
  }

  return {
    variables:uniq(variables).slice(0, 30),
    origins:origins.slice(0, 120)
  };
}

function dependencyFields(origins) {
  const fields = [];
  for (const entry of origins) {
    const property = String(entry.target ?? "").match(/^[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)$/)?.[1];
    if (property) {
      fields.push({
        object:entry.dependencyVariable,
        field:property,
        kind:entry.kind,
        structure:entry.structure
      });
    }
    for (const item of entry.structure?.objectFields ?? []) {
      fields.push({
        object:entry.dependencyVariable,
        field:item.field,
        kind:"object-field",
        structure:item.structure
      });
    }
  }
  const seen = new Set();
  return fields.filter((item) => {
    const key = JSON.stringify([item.object,item.field,item.kind,item.structure]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 80);
}

export function traceLoginStructure({ source = "", endpointIndex = -1, payloadVariable = null } = {}) {
  const text = String(source ?? "");
  const functionInfo = endpointIndex >= 0 ? findContainingFunction(text, endpointIndex) : null;
  const dependencies = tracePayloadDependencies(text, functionInfo, payloadVariable);
  const fields = dependencyFields(dependencies.origins).map((field) => ({
    ...field,
    referenceFlow:collectFieldReferenceFlow(text, field.object, field.field)
  }));
  return {
    functionName:functionInfo?.name ?? null,
    functionParams:functionInfo?.params ?? [],
    payloadTrace:collectPayloadOrigins(functionInfo?.body ?? "", payloadVariable).map((entry) => ({
      ...entry,
      scope:functionInfo?.name ? "function:" + functionInfo.name : entry.scope
    })),
    payloadOrigins:collectPayloadOrigins(text, payloadVariable),
    aliases:collectAliases(text, payloadVariable),
    dependencyVariables:dependencies.variables,
    dependencyOrigins:dependencies.origins,
    dependencyFields:fields
  };
}

export function extractAuthNumericConstants(source = "") {
  const text = String(source ?? "");
  const constants = [];
  for (const match of text.matchAll(/\b(?:var|let|const)?\s*([A-Za-z_$][\w$]*)\s*=\s*(-?\d+)\b/g)) {
    const name = match[1];
    if (!/(?:^g_(?:result|error|login|auth)|result|error|fail|success|login|pass|passwd|password|pwd|auth|limit)/i.test(name)) continue;
    constants.push({ name, value:Number(match[2]) });
  }
  return uniq(constants.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item)).slice(0, 120);
}
