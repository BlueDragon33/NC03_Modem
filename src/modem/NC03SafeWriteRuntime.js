const TOGGLE_PAIRS = Object.freeze([
  ["enable","disable"],
  ["enabled","disabled"],
  ["on","off"],
  ["open","close"],
  ["true","false"],
  ["1","0"]
]);

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function knownPairFor(value) {
  const current = normalize(value);
  return TOGGLE_PAIRS.find((pair) => pair.includes(current)) ?? null;
}

function chooseReadback(readback = {}, keys = []) {
  for (const key of keys) {
    const value = readback?.[key];
    const pair = knownPairFor(value);
    if (pair) return { key, value:String(value), pair };
  }
  return null;
}

function choosePayloadField(fieldCandidates = [], readbackKey = "") {
  const safe = [...new Set(fieldCandidates.filter((field) => /^[A-Za-z_$][\w$]*$/.test(String(field))))];
  if (!safe.length) return null;
  if (safe.includes(readbackKey)) return readbackKey;

  const preferred = safe.filter((field) => /safe.*charge|charge.*safe|long.*life|life.*charge/i.test(field));
  if (preferred.length === 1) return preferred[0];
  if (safe.length === 1) return safe[0];
  return null;
}

export function buildReversibleTogglePlan({
  evidence,
  currentState = {},
  desiredEnabled
} = {}) {
  if (typeof desiredEnabled !== "boolean") {
    return { ready:false, code:"WRITE_VALUE_INVALID" };
  }
  if (!evidence?.target?.endpoint || evidence.endpointMapped !== true || evidence.requestShapeMapped !== true || evidence.transportMapped !== true) {
    return { ready:false, code:"WRITE_MAPPING_INCOMPLETE" };
  }

  const readback = chooseReadback(currentState, evidence.target.readbackKeys ?? []);
  if (!readback) return { ready:false, code:"WRITE_READBACK_UNMAPPED" };

  const payloadField = choosePayloadField(evidence.fieldCandidates ?? [], readback.key);
  if (!payloadField) return { ready:false, code:"WRITE_FIELD_AMBIGUOUS" };

  const [truthy, falsy] = readback.pair;
  const desiredValue = desiredEnabled ? truthy : falsy;
  const originalEnabled = normalize(readback.value) === truthy;

  return {
    ready:true,
    endpoint:evidence.target.endpoint,
    payloadField,
    desiredEnabled,
    desiredValue,
    originalEnabled,
    originalValue:readback.value,
    readbackKey:readback.key,
    payload:{ [payloadField]:desiredValue },
    rollbackPayload:{ [payloadField]:readback.value }
  };
}

export async function executeJsonToggleWrite({
  baseUrl,
  plan,
  transport,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!plan?.ready) throw new Error(plan?.code || "WRITE_PLAN_NOT_READY");
  if (!transport?.ready || transport.method !== "POST") throw new Error("WRITE_TRANSPORT_UNRESOLVED");
  if (typeof fetchImpl !== "function") throw new Error("WRITE_TRANSPORT_UNAVAILABLE");

  const response = await fetchImpl(new URL(plan.endpoint, baseUrl).toString(), {
    method:"POST",
    redirect:"manual",
    signal:AbortSignal.timeout(5000),
    headers:{
      Accept:"application/json, text/javascript, */*; q=0.01",
      "Content-Type":transport.contentType || "application/json; charset=UTF-8",
      "X-Requested-With":"XMLHttpRequest"
    },
    body:JSON.stringify(plan.payload)
  });
  const result = await response.json().catch(() => null);
  const retcode = Number(result?.retcode);
  if (!response.ok) return { ok:false, code:"WRITE_HTTP_ERROR", httpStatus:response.status, retcode:Number.isFinite(retcode) ? retcode : null };
  if (retcode !== 0) return { ok:false, code:"WRITE_REJECTED", retcode:Number.isFinite(retcode) ? retcode : null };
  return { ok:true, retcode };
}

export async function executeRollback({
  baseUrl,
  plan,
  transport,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!plan?.ready) return { ok:false, code:"ROLLBACK_PLAN_NOT_READY" };
  const rollbackPlan = { ...plan, payload:plan.rollbackPayload };
  return executeJsonToggleWrite({ baseUrl, plan:rollbackPlan, transport, fetchImpl });
}

export function readbackMatches(value, enabled) {
  const pair = knownPairFor(value);
  if (!pair) return false;
  return normalize(value) === (enabled ? pair[0] : pair[1]);
}
