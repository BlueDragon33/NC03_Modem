# NC03 Guarded Write Engine v2 — WP06

Status: **IMPLEMENTED · REAL-HARDWARE REVERSIBLE ACCEPTANCE PENDING**

## Canonical engine

`src/modem/NC03GuardedWriteEngine.js` owns the transaction lifecycle for settings writes.

Transaction sequence:

`policy → confirmation → mapping preflight → concurrency read → write → post-condition → rollback/recovery → explicit final state`

## Result states

- `BLOCKED`
- `NO_CHANGE`
- `VERIFIED`
- `WRITE_REJECTED`
- `WRITE_TIMEOUT`
- `WRITE_TRANSPORT_ERROR`
- `CONCURRENCY_CONFLICT`
- `POSTCONDITION_FAILED_ROLLED_BACK`
- `ACCEPTANCE_ROLLBACK_VERIFIED`
- `FINAL_STATE_UNKNOWN`

A failed post-condition can never return success. If rollback cannot be verified, the engine reports `FINAL_STATE_UNKNOWN`.

## Long Life migration

Long Life Charging now uses the generic engine rather than one-off transaction control.

Normal Product UI writes remain fail-closed while `power.long-life` is not yet marked writable in the Canonical Settings Registry.

A separate reversible acceptance operation is available at:

`POST /api/nc03/write-acceptance/long-life-charging`

It requires explicit confirmation, runs in acceptance mode, attempts the inverse state, verifies it, then always restores and verifies the original state.

The Local Bridge now reads WRITE source scripts through its existing authenticated modem session. If the mapping preflight still returns HTTP 409, the JSON response includes a safe `code` and `payload.stage=MAPPING_PREFLIGHT` with source status counts and mapping flags. These counts exclude source text, cookies and credentials. The original device's 409 response body was not captured, so its exact cause remains unverified until a new hardware response is collected.

## Safety properties

- capability lock is enforced server-side;
- explicit confirmation is required;
- current readback is re-read before write to detect concurrent change;
- transport reject/timeout are explicit;
- post-condition mismatch triggers rollback;
- acceptance mode always attempts restoration of the original state;
- audit output excludes raw request payload and raw readback values.

## Remaining gate

Run one real reversible acceptance transaction on firmware `NC03_8.00.42`. PASS requires:
1. write accepted;
2. changed state readback verified;
3. rollback accepted;
4. original state readback verified;
5. final state `ORIGINAL_VERIFIED`.

Only after that evidence may `power.long-life` be promoted to writable/hardware-accepted.
