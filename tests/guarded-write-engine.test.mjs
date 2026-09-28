import test from "node:test";
import assert from "node:assert/strict";
import {
  GUARDED_WRITE_SCHEMA,
  WRITE_TRANSACTION_STATE,
  executeGuardedWriteTransaction
} from "../src/modem/NC03GuardedWriteEngine.js";

function plan(overrides={}) {
  return {
    ready:true,
    readbackKey:"device_charge_long_life",
    originalValue:"disable",
    originalEnabled:false,
    desiredEnabled:true,
    payload:{device_charge_long_life:"enable"},
    rollbackPayload:{device_charge_long_life:"disable"},
    ...overrides
  };
}

function callbacks({
  before="disable",
  write={ok:true,retcode:0},
  post={ok:true},
  rollback={ok:true,retcode:0},
  recovery={ok:true}
}={}) {
  return {
    readCurrent:async()=>({device_charge_long_life:before}),
    executeWrite:async()=>write,
    verifyDesired:async()=>post,
    executeRollback:async()=>rollback,
    verifyOriginal:async()=>recovery
  };
}

const policy={writable:true,requiresConfirmation:true,confirmed:true,dangerClass:"MEDIUM"};

test("verified write returns explicit desired final state", async () => {
  const result=await executeGuardedWriteTransaction({
    operationId:"power.long-life",
    desiredValue:true,
    plan:plan(),
    policy,
    ...callbacks()
  });
  assert.equal(result.schema,GUARDED_WRITE_SCHEMA);
  assert.equal(result.ok,true);
  assert.equal(result.state,WRITE_TRANSACTION_STATE.VERIFIED);
  assert.equal(result.finalState,"DESIRED_VERIFIED");
  assert.equal(result.audit.writeAttempted,true);
  assert.equal(result.audit.postconditionVerified,true);
});

test("capability remains fail-closed unless writable or acceptance mode", async () => {
  const result=await executeGuardedWriteTransaction({
    operationId:"power.long-life",
    desiredValue:true,
    plan:plan(),
    policy:{...policy,writable:false},
    ...callbacks()
  });
  assert.equal(result.state,WRITE_TRANSACTION_STATE.BLOCKED);
  assert.equal(result.code,"WRITE_CAPABILITY_LOCKED");
  assert.equal(result.audit.writeAttempted,false);
});

test("confirmation is required before a guarded write", async () => {
  const result=await executeGuardedWriteTransaction({
    operationId:"power.long-life",
    desiredValue:true,
    plan:plan(),
    policy:{...policy,confirmed:false},
    ...callbacks()
  });
  assert.equal(result.code,"WRITE_CONFIRMATION_REQUIRED");
  assert.equal(result.audit.writeAttempted,false);
});

test("idempotent desired state produces no write", async () => {
  let writes=0;
  const result=await executeGuardedWriteTransaction({
    operationId:"power.long-life",
    desiredValue:false,
    plan:plan({originalEnabled:false,desiredEnabled:false}),
    policy,
    readCurrent:async()=>({device_charge_long_life:"disable"}),
    executeWrite:async()=>{writes+=1;return {ok:true};},
    verifyDesired:async()=>({ok:true}),
    executeRollback:async()=>({ok:true}),
    verifyOriginal:async()=>({ok:true})
  });
  assert.equal(result.state,WRITE_TRANSACTION_STATE.NO_CHANGE);
  assert.equal(result.ok,true);
  assert.equal(writes,0);
});

test("concurrency guard blocks if readback changed after plan capture", async () => {
  let writes=0;
  const result=await executeGuardedWriteTransaction({
    operationId:"power.long-life",
    desiredValue:true,
    plan:plan(),
    policy,
    ...callbacks({before:"enable"}),
    executeWrite:async()=>{writes+=1;return {ok:true};}
  });
  assert.equal(result.state,WRITE_TRANSACTION_STATE.CONCURRENCY_CONFLICT);
  assert.equal(result.code,"WRITE_CONCURRENCY_CONFLICT");
  assert.equal(writes,0);
});

test("transport rejection never reports success", async () => {
  const result=await executeGuardedWriteTransaction({
    operationId:"power.long-life",
    desiredValue:true,
    plan:plan(),
    policy,
    ...callbacks({write:{ok:false,code:"WRITE_REJECTED",retcode:7}})
  });
  assert.equal(result.ok,false);
  assert.equal(result.state,WRITE_TRANSACTION_STATE.WRITE_REJECTED);
  assert.equal(result.retcode,7);
});

test("timeout is explicit and final state is unknown", async () => {
  const error=new Error("timeout");
  error.name="TimeoutError";
  const result=await executeGuardedWriteTransaction({
    operationId:"power.long-life",
    desiredValue:true,
    plan:plan(),
    policy,
    ...callbacks(),
    executeWrite:async()=>{throw error;}
  });
  assert.equal(result.state,WRITE_TRANSACTION_STATE.WRITE_TIMEOUT);
  assert.equal(result.code,"WRITE_TIMEOUT");
  assert.equal(result.finalState,"UNKNOWN");
});

test("postcondition failure rolls back and reports original state", async () => {
  const result=await executeGuardedWriteTransaction({
    operationId:"power.long-life",
    desiredValue:true,
    plan:plan(),
    policy,
    ...callbacks({post:{ok:false},rollback:{ok:true},recovery:{ok:true}})
  });
  assert.equal(result.ok,false);
  assert.equal(result.state,WRITE_TRANSACTION_STATE.POSTCONDITION_FAILED_ROLLED_BACK);
  assert.equal(result.finalState,"ORIGINAL_VERIFIED");
  assert.equal(result.audit.rollbackAttempted,true);
  assert.equal(result.audit.rollbackVerified,true);
});

test("failed rollback verification yields explicit unknown final state", async () => {
  const result=await executeGuardedWriteTransaction({
    operationId:"power.long-life",
    desiredValue:true,
    plan:plan(),
    policy,
    ...callbacks({post:{ok:false},rollback:{ok:true},recovery:{ok:false}})
  });
  assert.equal(result.ok,false);
  assert.equal(result.state,WRITE_TRANSACTION_STATE.FINAL_STATE_UNKNOWN);
  assert.equal(result.finalState,"UNKNOWN");
});

test("acceptance mode can exercise candidate then always restore original state", async () => {
  const result=await executeGuardedWriteTransaction({
    operationId:"power.long-life",
    desiredValue:true,
    plan:plan(),
    policy:{...policy,writable:false,acceptanceMode:true},
    alwaysRollback:true,
    ...callbacks()
  });
  assert.equal(result.ok,true);
  assert.equal(result.state,WRITE_TRANSACTION_STATE.ACCEPTANCE_ROLLBACK_VERIFIED);
  assert.equal(result.finalState,"ORIGINAL_VERIFIED");
  assert.equal(result.audit.rollbackVerified,true);
});

test("audit never contains raw payload or readback values", async () => {
  const result=await executeGuardedWriteTransaction({
    operationId:"power.long-life",
    desiredValue:true,
    plan:plan(),
    policy,
    ...callbacks()
  });
  const serialized=JSON.stringify(result.audit);
  for(const forbidden of ["device_charge_long_life","enable","disable","password","cookie","token"]) {
    assert.equal(serialized.toLowerCase().includes(forbidden),false,forbidden);
  }
});
