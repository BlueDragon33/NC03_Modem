export const GUARDED_WRITE_SCHEMA = "nc03-guarded-write/v2";

export const WRITE_TRANSACTION_STATE = Object.freeze({
  BLOCKED:"BLOCKED",
  NO_CHANGE:"NO_CHANGE",
  VERIFIED:"VERIFIED",
  WRITE_REJECTED:"WRITE_REJECTED",
  WRITE_TIMEOUT:"WRITE_TIMEOUT",
  WRITE_TRANSPORT_ERROR:"WRITE_TRANSPORT_ERROR",
  CONCURRENCY_CONFLICT:"CONCURRENCY_CONFLICT",
  POSTCONDITION_FAILED_ROLLED_BACK:"POSTCONDITION_FAILED_ROLLED_BACK",
  ACCEPTANCE_ROLLBACK_VERIFIED:"ACCEPTANCE_ROLLBACK_VERIFIED",
  FINAL_STATE_UNKNOWN:"FINAL_STATE_UNKNOWN"
});

function safeCode(error, fallback = "WRITE_TRANSPORT_ERROR") {
  const code=String(error?.code || error?.message || "");
  if (/^[A-Z0-9_]+$/.test(code)) return code;
  const name=String(error?.name || "");
  if (name === "TimeoutError" || name === "AbortError") return "WRITE_TIMEOUT";
  return fallback;
}

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function auditBase(operationId, policy) {
  return {
    schema:GUARDED_WRITE_SCHEMA,
    operationId:String(operationId || "unknown"),
    dangerClass:String(policy?.dangerClass || "UNKNOWN"),
    acceptanceMode:Boolean(policy?.acceptanceMode),
    confirmationRequired:Boolean(policy?.requiresConfirmation),
    confirmationSatisfied:Boolean(policy?.confirmed),
    capabilityWritable:Boolean(policy?.writable),
    mappingReady:false,
    concurrencyChecked:false,
    writeAttempted:false,
    writeAccepted:false,
    postconditionVerified:false,
    rollbackAttempted:false,
    rollbackAccepted:false,
    rollbackVerified:false
  };
}

function result({ ok=false, state, code=null, changed=false, verified=false, finalState="UNKNOWN", audit, extra={} }) {
  return Object.freeze({
    ok,
    schema:GUARDED_WRITE_SCHEMA,
    state,
    code,
    changed,
    verified,
    finalState,
    audit:Object.freeze({ ...audit }),
    ...extra
  });
}

async function verifyRollback({ plan, executeRollback, verifyOriginal, audit }) {
  audit.rollbackAttempted=true;
  let rollback;
  try {
    rollback=await executeRollback(plan);
  } catch (error) {
    return result({
      state:WRITE_TRANSACTION_STATE.FINAL_STATE_UNKNOWN,
      code:safeCode(error,"ROLLBACK_TRANSPORT_ERROR"),
      changed:true,
      verified:false,
      finalState:"UNKNOWN",
      audit
    });
  }

  audit.rollbackAccepted=Boolean(rollback?.ok);
  if (!rollback?.ok) {
    return result({
      state:WRITE_TRANSACTION_STATE.FINAL_STATE_UNKNOWN,
      code:rollback?.code || "ROLLBACK_REJECTED",
      changed:true,
      verified:false,
      finalState:"UNKNOWN",
      audit
    });
  }

  try {
    const verify=await verifyOriginal(plan);
    audit.rollbackVerified=Boolean(verify?.ok);
    if (!verify?.ok) {
      return result({
        state:WRITE_TRANSACTION_STATE.FINAL_STATE_UNKNOWN,
        code:"ROLLBACK_POSTCONDITION_FAILED",
        changed:true,
        verified:false,
        finalState:"UNKNOWN",
        audit
      });
    }
  } catch (error) {
    return result({
      state:WRITE_TRANSACTION_STATE.FINAL_STATE_UNKNOWN,
      code:safeCode(error,"ROLLBACK_VERIFY_FAILED"),
      changed:true,
      verified:false,
      finalState:"UNKNOWN",
      audit
    });
  }

  return null;
}

export async function executeGuardedWriteTransaction({
  operationId,
  desiredValue,
  plan,
  policy = {},
  readCurrent,
  executeWrite,
  verifyDesired,
  executeRollback,
  verifyOriginal,
  alwaysRollback = false
} = {}) {
  const normalizedPolicy={
    writable:Boolean(policy.writable),
    acceptanceMode:Boolean(policy.acceptanceMode),
    requiresConfirmation:policy.requiresConfirmation !== false,
    confirmed:Boolean(policy.confirmed),
    dangerClass:policy.dangerClass || "UNKNOWN"
  };
  const audit=auditBase(operationId,normalizedPolicy);

  if (!operationId || !plan) {
    return result({state:WRITE_TRANSACTION_STATE.BLOCKED,code:"WRITE_PLAN_NOT_READY",audit});
  }
  if (!normalizedPolicy.writable && !normalizedPolicy.acceptanceMode) {
    return result({state:WRITE_TRANSACTION_STATE.BLOCKED,code:"WRITE_CAPABILITY_LOCKED",audit});
  }
  if (normalizedPolicy.requiresConfirmation && !normalizedPolicy.confirmed) {
    return result({state:WRITE_TRANSACTION_STATE.BLOCKED,code:"WRITE_CONFIRMATION_REQUIRED",audit});
  }
  if (plan.ready !== true) {
    return result({state:WRITE_TRANSACTION_STATE.BLOCKED,code:plan.code || "WRITE_PLAN_NOT_READY",audit});
  }

  audit.mappingReady=true;

  if (!alwaysRollback && Object.prototype.hasOwnProperty.call(plan,"originalEnabled") && plan.originalEnabled === desiredValue) {
    return result({
      ok:true,
      state:WRITE_TRANSACTION_STATE.NO_CHANGE,
      code:"ALREADY_IN_REQUESTED_STATE",
      changed:false,
      verified:true,
      finalState:"DESIRED_VERIFIED",
      audit
    });
  }

  if (typeof readCurrent !== "function" || typeof executeWrite !== "function"
    || typeof verifyDesired !== "function" || typeof executeRollback !== "function"
    || typeof verifyOriginal !== "function") {
    return result({state:WRITE_TRANSACTION_STATE.BLOCKED,code:"WRITE_ENGINE_CALLBACK_INCOMPLETE",audit});
  }

  let before;
  try {
    before=await readCurrent();
    audit.concurrencyChecked=true;
  } catch (error) {
    return result({
      state:WRITE_TRANSACTION_STATE.WRITE_TRANSPORT_ERROR,
      code:safeCode(error,"WRITE_PREFLIGHT_READ_FAILED"),
      audit
    });
  }

  const currentValue=before?.[plan.readbackKey];
  if (normalized(currentValue) !== normalized(plan.originalValue)) {
    return result({
      state:WRITE_TRANSACTION_STATE.CONCURRENCY_CONFLICT,
      code:"WRITE_CONCURRENCY_CONFLICT",
      finalState:"UNCHANGED_BY_ENGINE",
      audit
    });
  }

  audit.writeAttempted=true;
  let write;
  try {
    write=await executeWrite(plan);
  } catch (error) {
    const code=safeCode(error);
    return result({
      state:code === "WRITE_TIMEOUT" ? WRITE_TRANSACTION_STATE.WRITE_TIMEOUT : WRITE_TRANSACTION_STATE.WRITE_TRANSPORT_ERROR,
      code,
      finalState:"UNKNOWN",
      audit
    });
  }

  audit.writeAccepted=Boolean(write?.ok);
  if (!write?.ok) {
    return result({
      state:WRITE_TRANSACTION_STATE.WRITE_REJECTED,
      code:write?.code || "WRITE_REJECTED",
      finalState:"UNCHANGED_OR_REJECTED",
      audit,
      extra:{retcode:Number.isFinite(write?.retcode) ? write.retcode : null}
    });
  }

  let post;
  try {
    post=await verifyDesired(plan,desiredValue);
  } catch (error) {
    const rollbackResult=await verifyRollback({plan,executeRollback,verifyOriginal,audit});
    if (rollbackResult) return rollbackResult;
    return result({
      state:WRITE_TRANSACTION_STATE.POSTCONDITION_FAILED_ROLLED_BACK,
      code:safeCode(error,"WRITE_POSTCONDITION_READ_FAILED"),
      changed:false,
      verified:false,
      finalState:"ORIGINAL_VERIFIED",
      audit
    });
  }

  audit.postconditionVerified=Boolean(post?.ok);
  if (!post?.ok) {
    const rollbackResult=await verifyRollback({plan,executeRollback,verifyOriginal,audit});
    if (rollbackResult) return rollbackResult;
    return result({
      state:WRITE_TRANSACTION_STATE.POSTCONDITION_FAILED_ROLLED_BACK,
      code:"WRITE_POSTCONDITION_FAILED",
      changed:false,
      verified:false,
      finalState:"ORIGINAL_VERIFIED",
      audit
    });
  }

  if (alwaysRollback) {
    const rollbackResult=await verifyRollback({plan,executeRollback,verifyOriginal,audit});
    if (rollbackResult) return rollbackResult;
    return result({
      ok:true,
      state:WRITE_TRANSACTION_STATE.ACCEPTANCE_ROLLBACK_VERIFIED,
      code:null,
      changed:false,
      verified:true,
      finalState:"ORIGINAL_VERIFIED",
      audit
    });
  }

  return result({
    ok:true,
    state:WRITE_TRANSACTION_STATE.VERIFIED,
    changed:true,
    verified:true,
    finalState:"DESIRED_VERIFIED",
    audit
  });
}
