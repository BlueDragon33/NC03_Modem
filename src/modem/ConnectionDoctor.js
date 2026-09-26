export const DOCTOR_STATUS = Object.freeze({
  OK: "OK",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  FIRMWARE_UNVERIFIED: "FIRMWARE_UNVERIFIED",
  MODEM_UNREACHABLE: "MODEM_UNREACHABLE",
  BRIDGE_ERROR: "BRIDGE_ERROR"
});

export function buildConnectionDoctorReport({
  baseUrl,
  bridgeOk = true,
  authenticated = false,
  live = null,
  firmware = null,
  errorCode = ""
} = {}) {
  const checks = [
    { id:"bridge", label:"Local Bridge", ok:Boolean(bridgeOk), detail:bridgeOk ? "Sẵn sàng" : "Không sẵn sàng" },
    { id:"modem", label:"NC03", ok:Boolean(live || authenticated), detail:live || authenticated ? "Có phản hồi" : "Chưa xác nhận" },
    { id:"auth", label:"Phiên đăng nhập", ok:Boolean(authenticated), detail:authenticated ? "Đã đăng nhập" : "Cần đăng nhập Web UI gốc" }
  ];

  if (firmware) {
    checks.push({
      id:"firmware",
      label:"Firmware",
      ok:firmware.profile === "NC03_8.00.42",
      detail:firmware.profile === "NC03_8.00.42" ? firmware.firmware ?? "NC03_8.00.42" : firmware.firmware ?? "Chưa xác minh"
    });
  }

  let status = DOCTOR_STATUS.OK;
  let message = "Đường đọc local hoạt động bình thường.";

  if (!bridgeOk) {
    status = DOCTOR_STATUS.BRIDGE_ERROR;
    message = "Local Bridge chưa sẵn sàng.";
  } else if (errorCode === "AUTHENTICATION_REQUIRED" || !authenticated) {
    status = DOCTOR_STATUS.AUTH_REQUIRED;
    message = "Modem phản hồi nhưng cần đăng nhập Web UI gốc.";
  } else if (errorCode) {
    status = DOCTOR_STATUS.MODEM_UNREACHABLE;
    message = "Không đọc được NC03 qua Local Bridge.";
  } else if (firmware && firmware.profile !== "NC03_8.00.42") {
    status = DOCTOR_STATUS.FIRMWARE_UNVERIFIED;
    message = "Modem phản hồi nhưng firmware chưa nằm trong profile đã xác minh.";
  }

  return {
    schema:"nc03-connection-doctor/v1",
    baseUrl,
    status,
    message,
    checkedAt:new Date().toISOString(),
    checks,
    safety:{
      readOnly:true,
      includesCredentials:false,
      includesSessionValues:false,
      enablesWriteControls:false
    }
  };
}
