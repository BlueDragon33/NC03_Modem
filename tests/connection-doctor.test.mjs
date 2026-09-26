import test from "node:test";
import assert from "node:assert/strict";
import { buildConnectionDoctorReport, DOCTOR_STATUS } from "../src/modem/ConnectionDoctor.js";

test("doctor reports healthy verified read path without secrets", () => {
  const report = buildConnectionDoctorReport({
    baseUrl:"http://192.168.0.1",
    bridgeOk:true,
    authenticated:true,
    live:{status:{connected:true}},
    firmware:{firmware:"NC03_8.00.42",profile:"NC03_8.00.42"}
  });
  assert.equal(report.status, DOCTOR_STATUS.OK);
  assert.equal(report.safety.readOnly, true);
  assert.equal(report.safety.includesCredentials, false);
  assert.equal(report.safety.enablesWriteControls, false);
});

test("doctor distinguishes auth requirement and unverified firmware", () => {
  const auth = buildConnectionDoctorReport({baseUrl:"http://192.168.0.1",bridgeOk:true,authenticated:false,errorCode:"AUTHENTICATION_REQUIRED"});
  assert.equal(auth.status, DOCTOR_STATUS.AUTH_REQUIRED);
  const fw = buildConnectionDoctorReport({baseUrl:"http://192.168.0.1",bridgeOk:true,authenticated:true,live:{},firmware:{firmware:"NC03_9.x",profile:"unverified-firmware"}});
  assert.equal(fw.status, DOCTOR_STATUS.FIRMWARE_UNVERIFIED);
});
