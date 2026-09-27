function uniq(values) {
  return [...new Set(values)];
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
}

function findContainingCall(text, endpointIndex) {
  const start = Math.max(0, endpointIndex - 1200);
  const before = text.slice(start, endpointIndex);
  for (let pos = before.length - 1; pos >= 0; pos -= 1) {
    if (before[pos] !== "(") continue;
    const prefix = before.slice(Math.max(0, pos - 140), pos);
    const helper = prefix.match(/([A-Za-z_$][\w$]*)\s*$/)?.[1] ?? null;
    if (!helper) continue;

    let depth = 1;
    let quote = null;
    let escaped = false;
    for (let i = start + pos + 1; i < Math.min(text.length, endpointIndex + 6000); i += 1) {
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
      if (ch === '"' || ch === "'" || ch === "\`") {
        quote = ch;
        continue;
      }
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          const open = start + pos;
          if (open < endpointIndex && endpointIndex < i) {
            return { helper, open, close:i, body:text.slice(open + 1, i) };
          }
          break;
        }
      }
    }
  }
  return null;
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
    if (ch === '"' || ch === "'" || ch === "\`") {
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

function findContainingFunction(text, index) {
  const prefix = text.slice(0, index);
  const matches = [...prefix.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g)].reverse();
  for (const match of matches) {
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
      if (ch === '"' || ch === "'" || ch === "\`") {
        quote = ch;
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          if (i > index) return { name:match[1], open, close:i, body:text.slice(open + 1, i) };
          break;
        }
      }
    }
  }
  return null;
}

function objectKeys(expression) {
  const value = String(expression ?? "");
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  const keys = [];
  for (const match of value.slice(start + 1, end).matchAll(/(?:^|,)\s*(?:["']([^"']+)["']|([A-Za-z_$][\w$]*))\s*:/g)) {
    keys.push(match[1] || match[2]);
  }
  return uniq(keys);
}

function argumentShape(value, endpoint) {
  const expression = String(value ?? "").trim();
  if (!expression) return "empty";
  if (expression.includes(endpoint)) return "endpoint";
  if (/^(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/.test(expression)) return "callback";
  const json = expression.match(/^JSON\.stringify\s*\(\s*([A-Za-z_$][\w$]*)/);
  if (json) return "json-stringify:" + json[1];
  if (/^[A-Za-z_$][\w$]*$/.test(expression)) return "identifier:" + expression;
  const keys = objectKeys(expression);
  if (keys.length) return "object:{" + keys.join(",") + "}";
  if (/^["']/.test(expression)) return "literal:string";
  if (/^-?\d+(?:\.\d+)?$/.test(expression)) return "literal:number";
  return "expression";
}

function safeLiteralCandidates(expression) {
  const out = [];
  for (const match of String(expression ?? "").matchAll(/["']([^"']+)["']/g)) {
    const value = match[1];
    if (/^(?:enable|disable|enabled|disabled|open|close|on|off|true|false|0|1)$/i.test(value)) out.push(value);
  }
  for (const match of String(expression ?? "").matchAll(/\b(?:true|false|0|1)\b/g)) out.push(match[0]);
  return uniq(out);
}

function redactedSkeleton(expression) {
  return String(expression ?? "")
    .replace(/["'][^"']*["']/g, "<string>")
    .replace(/\b\d{2,}\b/g, "<number>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function payloadVariables(args, endpoint) {
  const out = [];
  for (const arg of args) {
    if (arg.includes(endpoint)) continue;
    const json = arg.match(/JSON\.stringify\s*\(\s*([A-Za-z_$][\w$]*)/);
    if (json) out.push(json[1]);
    else if (/^[A-Za-z_$][\w$]*$/.test(arg) && !/^(?:true|false|null|undefined)$/.test(arg)) out.push(arg);
  }
  return uniq(out);
}

function fieldAssignments(text, variable) {
  if (!variable) return [];
  const escaped = escapeRegex(variable);
  const entries = [];
  const patterns = [
    new RegExp("\\b" + escaped + "\\.([A-Za-z_$][\\w$]*)\\s*=\\s*([^;\\n]+)", "g"),
    new RegExp("\\b" + escaped + "\\[[\"']([^\"']+)[\"']\\]\\s*=\\s*([^;\\n]+)", "g")
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      entries.push({
        field:match[1],
        skeleton:redactedSkeleton(match[2]),
        safeLiteralCandidates:safeLiteralCandidates(match[2])
      });
    }
  }

  const objectAssign = new RegExp("(?:var|let|const)?\\s*" + escaped + "\\s*=\\s*(\\{[\\s\\S]{0,1800}?\\})", "g");
  for (const match of text.matchAll(objectAssign)) {
    const body = match[1].slice(1, -1);
    for (const part of splitArgs(body)) {
      const field = part.match(/^\s*(?:["']([^"']+)["']|([A-Za-z_$][\w$]*))\s*:\s*([\s\S]+)$/);
      if (!field) continue;
      entries.push({
        field:field[1] || field[2],
        skeleton:redactedSkeleton(field[3]),
        safeLiteralCandidates:safeLiteralCandidates(field[3])
      });
    }
  }

  const seen = new Set();
  return entries.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const WRITE_READINESS_TARGETS = Object.freeze({
  longLifeCharging:Object.freeze({
    id:"long-life-charging",
    label:"Long Life Charging",
    endpoint:"/action/device_set_battery_safe_charge",
    readbackKeys:Object.freeze(["device_bat_safe_charge_switch","device_charge_long_life"])
  })
});

export function buildWriteReadinessEvidence(sources = [], {
  targetId = "long-life-charging",
  currentState = {}
} = {}) {
  const target = Object.values(WRITE_READINESS_TARGETS).find((item) => item.id === targetId)
    ?? WRITE_READINESS_TARGETS.longLifeCharging;
  const callsites = [];

  for (const item of sources) {
    const text = String(item?.source ?? "");
    let index = text.indexOf(target.endpoint);
    while (index >= 0) {
      const containingCall = findContainingCall(text, index);
      const args = containingCall ? splitArgs(containingCall.body) : [];
      const variables = payloadVariables(args, target.endpoint);
      const functionInfo = findContainingFunction(text, index);
      const around = functionInfo?.body ?? text.slice(Math.max(0, index - 5000), Math.min(text.length, index + 5000));
      const fields = variables.flatMap((variable) => fieldAssignments(around, variable).map((field) => ({ variable, ...field })));
      const directObjectArg = args.find((arg) => objectKeys(arg).length);
      const directObjectKeys = directObjectArg ? objectKeys(directObjectArg) : [];

      callsites.push({
        sourcePath:item.path,
        endpoint:target.endpoint,
        functionName:functionInfo?.name ?? null,
        transportHelper:containingCall?.helper ?? null,
        payloadVariables:variables,
        argumentShapes:args.map((arg) => argumentShape(arg, target.endpoint)),
        directObjectKeys,
        fields,
        safeLiteralCandidates:uniq([
          ...fields.flatMap((field) => field.safeLiteralCandidates),
          ...safeLiteralCandidates(containingCall?.body ?? "")
        ])
      });

      index = text.indexOf(target.endpoint, index + target.endpoint.length);
    }
  }

  const fieldCandidates = uniq(callsites.flatMap((call) => [
    ...call.directObjectKeys,
    ...call.fields.map((field) => field.field)
  ]));
  const transportHelpers = uniq(callsites.map((call) => call.transportHelper).filter(Boolean));
  const currentReadback = Object.fromEntries(target.readbackKeys.map((key) => [key, currentState?.[key] ?? null]));
  const currentReadbackPresent = Object.values(currentReadback).some((value) => value !== null && value !== undefined && value !== "");
  const endpointMapped = callsites.length > 0;
  const requestShapeMapped = fieldCandidates.length > 0;
  const transportMapped = transportHelpers.length > 0;
  const captureReady = endpointMapped && requestShapeMapped && transportMapped && currentReadbackPresent;

  return {
    schema:"nc03-write-readiness/v1",
    target:{
      id:target.id,
      label:target.label,
      endpoint:target.endpoint,
      readbackKeys:[...target.readbackKeys]
    },
    status:captureReady ? "CAPTURE_REQUIRED" : "SOURCE_EVIDENCE_INCOMPLETE",
    endpointMapped,
    requestShapeMapped,
    transportMapped,
    currentReadbackPresent,
    captureReady,
    rollbackReady:false,
    writeEnabled:false,
    candidateOnly:true,
    callsites,
    fieldCandidates,
    transportHelpers,
    safeLiteralCandidates:uniq(callsites.flatMap((call) => call.safeLiteralCandidates)),
    currentReadback,
    rollbackPlan:{
      originalStateCaptured:currentReadbackPresent,
      inverseValueMapped:false,
      postConditionMapped:false,
      ready:false
    },
    guidance:captureReady ? [
      "Mở Web UI gốc và bắt đầu HAR chỉ cho thao tác Long Life Charging.",
      "Đổi trạng thái đúng một lần, chờ UI/modem xác nhận.",
      "Đổi ngay về trạng thái ban đầu để rollback.",
      "Xuất HAR rồi phân tích; không bật write từ source candidate."
    ] : [
      "Chưa đủ endpoint/request-shape/transport/readback để capture write an toàn.",
      "Không thực thi write từ source candidate."
    ],
    safety:{
      rawSourceReturned:false,
      credentialReturned:false,
      writeExecuted:false,
      writeControlsMayBeEnabled:false
    }
  };
}
