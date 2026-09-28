export const SETTINGS_REGISTRY_SCHEMA = "nc03-settings-registry/v1";
export const SETTINGS_REGISTRY_VERSION = "1.0.0";

export const CAPABILITY_LIFECYCLE = Object.freeze({
  UNMAPPED:"UNMAPPED",
  READ_MAPPED:"READ_MAPPED",
  WRITE_CANDIDATE:"WRITE_CANDIDATE",
  WRITE_VERIFIED:"WRITE_VERIFIED",
  HARDWARE_ACCEPTED:"HARDWARE_ACCEPTED"
});

const RAW_SETTINGS = [
  {
    "id": "auth.login",
    "family": "system-time-firmware-admin",
    "operationClass": "AUTH",
    "ui": {
      "label": "Đăng nhập quản trị",
      "controlKind": "action",
      "stockPresence": "CONFIRMED_RUNTIME_HARDWARE",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "command",
      "validation": "COMMAND_POLICY"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "SECRET",
      "readbackPolicy": "SESSION_VERIFICATION",
      "recoveryPolicy": "REAUTHENTICATION_STATE_MACHINE"
    },
    "capability": {
      "lifecycle": "HARDWARE_ACCEPTED",
      "readable": true,
      "writable": true,
      "hardwareAccepted": true
    },
    "evidence": {
      "parityId": "auth.login",
      "stockPresence": "CONFIRMED_RUNTIME_HARDWARE",
      "readState": "VERIFIED",
      "writeState": "VERIFIED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "auth.session-status",
    "family": "system-time-firmware-admin",
    "operationClass": "AUTH",
    "ui": {
      "label": "Trạng thái phiên đăng nhập",
      "controlKind": "read",
      "stockPresence": "CONFIRMED_RUNTIME_HARDWARE",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "string",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "LOW",
      "privacy": "LOCAL_SENSITIVE",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "auth.session-status",
      "stockPresence": "CONFIRMED_RUNTIME_HARDWARE",
      "readState": "VERIFIED",
      "writeState": "NOT_APPLICABLE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "auth.logout",
    "family": "system-time-firmware-admin",
    "operationClass": "AUTH",
    "ui": {
      "label": "Đăng xuất",
      "controlKind": "action",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "command",
      "validation": "COMMAND_POLICY"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "LOCAL_SENSITIVE",
      "readbackPolicy": "SESSION_VERIFICATION",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "auth.logout",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "SOURCE_OBSERVED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "mobile.data",
    "family": "mobile-network",
    "operationClass": "SETTING",
    "ui": {
      "label": "Dữ liệu di động",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "mobile.data",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "mobile.roaming",
    "family": "mobile-network",
    "operationClass": "SETTING",
    "ui": {
      "label": "Roaming",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "mobile.roaming",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "mobile.sim-slot",
    "family": "mobile-network",
    "operationClass": "SETTING",
    "ui": {
      "label": "Khe SIM",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "LOCAL_SENSITIVE",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "mobile.sim-slot",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "mobile.sim-pin-protect",
    "family": "mobile-network",
    "operationClass": "SETTING",
    "ui": {
      "label": "Bảo vệ SIM PIN",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "SECRET",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "mobile.sim-pin-protect",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "mobile.cloud-sim-auto",
    "family": "mobile-network",
    "operationClass": "SETTING",
    "ui": {
      "label": "Cloud SIM tự động",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "LOCAL_SENSITIVE",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "mobile.cloud-sim-auto",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "mobile.cloud-sim-notification",
    "family": "mobile-network",
    "operationClass": "SETTING",
    "ui": {
      "label": "Thông báo Cloud SIM",
      "controlKind": "toggle",
      "stockPresence": "NOT_OBSERVED_AS_STOCK_CONTROL",
      "exposure": "INTERNAL_STATE"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "LOW",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "mobile.cloud-sim-notification",
      "stockPresence": "NOT_OBSERVED_AS_STOCK_CONTROL",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "mobile.acquisition-order",
    "family": "mobile-network",
    "operationClass": "SETTING",
    "ui": {
      "label": "Acquisition order",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "mobile.acquisition-order",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "mobile.scan-mode",
    "family": "mobile-network",
    "operationClass": "SETTING",
    "ui": {
      "label": "Scan mode",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "mobile.scan-mode",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "mobile.nr5g-mode",
    "family": "mobile-network",
    "operationClass": "SETTING",
    "ui": {
      "label": "Chế độ 5G",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "mobile.nr5g-mode",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "mobile.band",
    "family": "mobile-network",
    "operationClass": "SETTING",
    "ui": {
      "label": "Band",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "mobile.band",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "mobile.band-lock",
    "family": "mobile-network",
    "operationClass": "SETTING",
    "ui": {
      "label": "Band lock",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "mobile.band-lock",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "mobile.band-auto-unlock",
    "family": "mobile-network",
    "operationClass": "SETTING",
    "ui": {
      "label": "Tự mở khóa band",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "mobile.band-auto-unlock",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "mobile.apn-profiles",
    "family": "mobile-network",
    "operationClass": "COLLECTION",
    "ui": {
      "label": "APN / profile dữ liệu",
      "controlKind": "collection",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "collection",
      "validation": "TYPED_MODEL_REQUIRED"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "SECRET",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "mobile.apn-profiles",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "INTENTIONALLY_NOT_MIRRORED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "mobile.data-usage",
    "family": "mobile-network",
    "operationClass": "READ",
    "ui": {
      "label": "Thống kê dữ liệu",
      "controlKind": "read",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "string",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "mobile.data-usage",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "wifi.global-enable",
    "family": "wifi",
    "operationClass": "SETTING",
    "ui": {
      "label": "Bật/tắt Wi‑Fi tổng",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "wifi.global-enable",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "wifi.ap-enable",
    "family": "wifi",
    "operationClass": "SETTING",
    "ui": {
      "label": "Bật/tắt AP",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "wifi.ap-enable",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "wifi.ssid",
    "family": "wifi",
    "operationClass": "SETTING",
    "ui": {
      "label": "Tên Wi‑Fi (SSID)",
      "controlKind": "text",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "string",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "wifi.ssid",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "wifi.password",
    "family": "wifi",
    "operationClass": "SETTING",
    "ui": {
      "label": "Mật khẩu Wi‑Fi mới",
      "controlKind": "password",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "string",
      "format": "secret",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "SECRET",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "wifi.password",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "INTENTIONALLY_NOT_MIRRORED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "wifi.security-mode",
    "family": "wifi",
    "operationClass": "SETTING",
    "ui": {
      "label": "Chế độ bảo mật Wi‑Fi",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "wifi.security-mode",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "wifi.broadcast-ssid",
    "family": "wifi",
    "operationClass": "SETTING",
    "ui": {
      "label": "Phát SSID",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "wifi.broadcast-ssid",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "wifi.frequency",
    "family": "wifi",
    "operationClass": "SETTING",
    "ui": {
      "label": "Tần số / band AP",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "wifi.frequency",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "wifi.channel",
    "family": "wifi",
    "operationClass": "SETTING",
    "ui": {
      "label": "Kênh Wi‑Fi",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "wifi.channel",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "wifi.mode",
    "family": "wifi",
    "operationClass": "SETTING",
    "ui": {
      "label": "Chế độ Wi‑Fi",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "wifi.mode",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "wifi.standard",
    "family": "wifi",
    "operationClass": "SETTING",
    "ui": {
      "label": "Chuẩn 802.11",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "wifi.standard",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "wifi.bandwidth",
    "family": "wifi",
    "operationClass": "SETTING",
    "ui": {
      "label": "Bandwidth",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "wifi.bandwidth",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "wifi.max-clients",
    "family": "wifi",
    "operationClass": "SETTING",
    "ui": {
      "label": "Số client tối đa",
      "controlKind": "number",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "integer",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "wifi.max-clients",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "wifi.tx-power",
    "family": "wifi",
    "operationClass": "SETTING",
    "ui": {
      "label": "Công suất phát",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "BLOCK_WRITE_UNTIL_READBACK_MAPPED",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "wifi.tx-power",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "UNMAPPED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "wifi.privacy-separator",
    "family": "wifi",
    "operationClass": "SETTING",
    "ui": {
      "label": "Privacy / AP isolation",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "BLOCK_WRITE_UNTIL_READBACK_MAPPED",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "wifi.privacy-separator",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "UNMAPPED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "lan.dhcp-enable",
    "family": "lan-dhcp-routing",
    "operationClass": "SETTING",
    "ui": {
      "label": "DHCP Server",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "lan.dhcp-enable",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "lan.gateway",
    "family": "lan-dhcp-routing",
    "operationClass": "SETTING",
    "ui": {
      "label": "Gateway LAN",
      "controlKind": "ipv4",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "string",
      "format": "ipv4",
      "validation": "STRICT_FORMAT"
    },
    "safety": {
      "danger": "CRITICAL",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "RECOVERY_PROOF_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "lan.gateway",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "lan.subnet-mask",
    "family": "lan-dhcp-routing",
    "operationClass": "SETTING",
    "ui": {
      "label": "Subnet mask",
      "controlKind": "ipv4",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "string",
      "format": "ipv4",
      "validation": "STRICT_FORMAT"
    },
    "safety": {
      "danger": "CRITICAL",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "RECOVERY_PROOF_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "lan.subnet-mask",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "lan.dhcp-start",
    "family": "lan-dhcp-routing",
    "operationClass": "SETTING",
    "ui": {
      "label": "DHCP start",
      "controlKind": "ipv4",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "string",
      "format": "ipv4",
      "validation": "STRICT_FORMAT"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "lan.dhcp-start",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "lan.dhcp-end",
    "family": "lan-dhcp-routing",
    "operationClass": "SETTING",
    "ui": {
      "label": "DHCP end",
      "controlKind": "ipv4",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "string",
      "format": "ipv4",
      "validation": "STRICT_FORMAT"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "lan.dhcp-end",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "lan.lease-time",
    "family": "lan-dhcp-routing",
    "operationClass": "SETTING",
    "ui": {
      "label": "DHCP lease time",
      "controlKind": "duration",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "scalar",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "lan.lease-time",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "lan.dns-proxy",
    "family": "lan-dhcp-routing",
    "operationClass": "SETTING",
    "ui": {
      "label": "DNS proxy",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "lan.dns-proxy",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "lan.dns-address",
    "family": "lan-dhcp-routing",
    "operationClass": "SETTING",
    "ui": {
      "label": "DNS address",
      "controlKind": "text",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "string",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "lan.dns-address",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "lan.ip-mac-bindings",
    "family": "lan-dhcp-routing",
    "operationClass": "COLLECTION",
    "ui": {
      "label": "IP/MAC binding",
      "controlKind": "collection",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "collection",
      "validation": "TYPED_MODEL_REQUIRED"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "LOCAL_SENSITIVE",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "lan.ip-mac-bindings",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "COUNT_ONLY",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "lan.port-forwarding",
    "family": "lan-dhcp-routing",
    "operationClass": "COLLECTION",
    "ui": {
      "label": "Port forwarding",
      "controlKind": "collection",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "collection",
      "validation": "TYPED_MODEL_REQUIRED"
    },
    "safety": {
      "danger": "CRITICAL",
      "privacy": "LOCAL_SENSITIVE",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "lan.port-forwarding",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "COUNT_ONLY",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "lan.ipv4-filters",
    "family": "lan-dhcp-routing",
    "operationClass": "COLLECTION",
    "ui": {
      "label": "IPv4 packet filters",
      "controlKind": "collection",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "collection",
      "validation": "TYPED_MODEL_REQUIRED"
    },
    "safety": {
      "danger": "CRITICAL",
      "privacy": "LOCAL_SENSITIVE",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "lan.ipv4-filters",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "COUNT_ONLY",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "lan.ipv6-filters",
    "family": "lan-dhcp-routing",
    "operationClass": "COLLECTION",
    "ui": {
      "label": "IPv6 packet filters",
      "controlKind": "collection",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "collection",
      "validation": "TYPED_MODEL_REQUIRED"
    },
    "safety": {
      "danger": "CRITICAL",
      "privacy": "LOCAL_SENSITIVE",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "lan.ipv6-filters",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "COUNT_ONLY",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "connectivity.bridge-enable",
    "family": "usb-bridge-ethernet",
    "operationClass": "SETTING",
    "ui": {
      "label": "IP Passthrough / Bridge",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_PRIOR_EVIDENCE",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "CRITICAL",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "connectivity.bridge-enable",
      "stockPresence": "CONFIRMED_PRIOR_EVIDENCE",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "connectivity.bridge-lan-type",
    "family": "usb-bridge-ethernet",
    "operationClass": "SETTING",
    "ui": {
      "label": "Bridge LAN type",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_PRIOR_EVIDENCE",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "CRITICAL",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "connectivity.bridge-lan-type",
      "stockPresence": "CONFIRMED_PRIOR_EVIDENCE",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "connectivity.usb-tether",
    "family": "usb-bridge-ethernet",
    "operationClass": "SETTING",
    "ui": {
      "label": "USB tethering",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "connectivity.usb-tether",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "connectivity.usb-speed",
    "family": "usb-bridge-ethernet",
    "operationClass": "SETTING",
    "ui": {
      "label": "USB speed/type",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "connectivity.usb-speed",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "connectivity.ethernet-type",
    "family": "usb-bridge-ethernet",
    "operationClass": "SETTING",
    "ui": {
      "label": "Ethernet type",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "connectivity.ethernet-type",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "connectivity.cradle-screen-saver",
    "family": "usb-bridge-ethernet",
    "operationClass": "SETTING",
    "ui": {
      "label": "Cradle screen saver",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "LOW",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "connectivity.cradle-screen-saver",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "power.safe-charge",
    "family": "power-battery-display",
    "operationClass": "SETTING",
    "ui": {
      "label": "Safe Charge",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "power.safe-charge",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "power.long-life",
    "family": "power-battery-display",
    "operationClass": "SETTING",
    "ui": {
      "label": "Long Life Charging",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "power.long-life",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "GUARDED_PENDING_HARDWARE_ACCEPTANCE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "power.mode",
    "family": "power-battery-display",
    "operationClass": "SETTING",
    "ui": {
      "label": "Power saving mode",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "power.mode",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "power.auto-sleep-switch",
    "family": "power-battery-display",
    "operationClass": "SETTING",
    "ui": {
      "label": "Auto sleep",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "LOW",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "power.auto-sleep-switch",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "power.auto-sleep-timer",
    "family": "power-battery-display",
    "operationClass": "SETTING",
    "ui": {
      "label": "Auto sleep timer",
      "controlKind": "duration",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "scalar",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "LOW",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "power.auto-sleep-timer",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "power.ac-autostart",
    "family": "power-battery-display",
    "operationClass": "SETTING",
    "ui": {
      "label": "AC auto-start",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "power.ac-autostart",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "power.lcd-timeout",
    "family": "power-battery-display",
    "operationClass": "SETTING",
    "ui": {
      "label": "Tắt LCD sau",
      "controlKind": "duration",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "scalar",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "LOW",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "power.lcd-timeout",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "power.eco-display",
    "family": "power-battery-display",
    "operationClass": "SETTING",
    "ui": {
      "label": "Eco display",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "LOW",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "power.eco-display",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "power.pseudo-enable",
    "family": "power-battery-display",
    "operationClass": "SETTING",
    "ui": {
      "label": "Pseudo enable",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "LOW",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "power.pseudo-enable",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "security.wps-enable",
    "family": "security-wps-firewall-dmz",
    "operationClass": "SETTING",
    "ui": {
      "label": "WPS",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "security.wps-enable",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "security.wps-mode",
    "family": "security-wps-firewall-dmz",
    "operationClass": "SETTING",
    "ui": {
      "label": "WPS mode",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "security.wps-mode",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "security.wifi-mac-filter-mode",
    "family": "security-wps-firewall-dmz",
    "operationClass": "SETTING",
    "ui": {
      "label": "Wi‑Fi MAC filter",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "CRITICAL",
      "privacy": "LOCAL_SENSITIVE",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "RECOVERY_PROOF_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "security.wifi-mac-filter-mode",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "security.protection",
    "family": "security-wps-firewall-dmz",
    "operationClass": "SETTING",
    "ui": {
      "label": "Security protection",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "NORMAL",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "ROLLBACK_OR_KNOWN_RECOVERY_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "security.protection",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "security.mac-filter-type",
    "family": "security-wps-firewall-dmz",
    "operationClass": "SETTING",
    "ui": {
      "label": "MAC filter type",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "CRITICAL",
      "privacy": "LOCAL_SENSITIVE",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "security.mac-filter-type",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "security.ip-filter-type",
    "family": "security-wps-firewall-dmz",
    "operationClass": "SETTING",
    "ui": {
      "label": "IP filter type",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "CRITICAL",
      "privacy": "LOCAL_SENSITIVE",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "security.ip-filter-type",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "security.dmz-enable",
    "family": "security-wps-firewall-dmz",
    "operationClass": "SETTING",
    "ui": {
      "label": "DMZ",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "CRITICAL",
      "privacy": "LOCAL_SENSITIVE",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "security.dmz-enable",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "security.dmz-target",
    "family": "security-wps-firewall-dmz",
    "operationClass": "SETTING",
    "ui": {
      "label": "DMZ target IP",
      "controlKind": "ipv4",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "string",
      "format": "ipv4",
      "validation": "STRICT_FORMAT"
    },
    "safety": {
      "danger": "CRITICAL",
      "privacy": "LOCAL_SENSITIVE",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "security.dmz-target",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "INTENTIONALLY_NOT_MIRRORED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "system.ntp-enable",
    "family": "system-time-firmware-admin",
    "operationClass": "SETTING",
    "ui": {
      "label": "NTP",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "LOW",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "system.ntp-enable",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "system.nitz-enable",
    "family": "system-time-firmware-admin",
    "operationClass": "SETTING",
    "ui": {
      "label": "NITZ",
      "controlKind": "toggle",
      "stockPresence": "NOT_OBSERVED_AS_STOCK_CONTROL",
      "exposure": "INTERNAL_STATE"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "LOW",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "system.nitz-enable",
      "stockPresence": "NOT_OBSERVED_AS_STOCK_CONTROL",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "system.timezone",
    "family": "system-time-firmware-admin",
    "operationClass": "SETTING",
    "ui": {
      "label": "Timezone",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "LOW",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "system.timezone",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "system.time-format",
    "family": "system-time-firmware-admin",
    "operationClass": "SETTING",
    "ui": {
      "label": "Định dạng thời gian",
      "controlKind": "select",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "enum",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "LOW",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "system.time-format",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "system.daylight",
    "family": "system-time-firmware-admin",
    "operationClass": "SETTING",
    "ui": {
      "label": "Daylight saving",
      "controlKind": "toggle",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "boolean",
      "validation": "CANONICAL_BOOLEAN"
    },
    "safety": {
      "danger": "LOW",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "system.daylight",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "system.reboot",
    "family": "system-time-firmware-admin",
    "operationClass": "DANGEROUS_ACTION",
    "ui": {
      "label": "Khởi động lại modem",
      "controlKind": "dangerous-action",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "command",
      "validation": "COMMAND_POLICY"
    },
    "safety": {
      "danger": "CRITICAL",
      "privacy": "NORMAL",
      "readbackPolicy": "BLOCK_WRITE_UNTIL_READBACK_MAPPED",
      "recoveryPolicy": "RECOVERY_PROOF_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "system.reboot",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "NOT_APPLICABLE",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "system.admin-password",
    "family": "system-time-firmware-admin",
    "operationClass": "CREDENTIAL_ACTION",
    "ui": {
      "label": "Đổi mật khẩu quản trị",
      "controlKind": "password-action",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "command",
      "validation": "COMMAND_POLICY"
    },
    "safety": {
      "danger": "CRITICAL",
      "privacy": "SECRET",
      "readbackPolicy": "REQUIRED_BEFORE_AND_AFTER_WRITE",
      "recoveryPolicy": "RECOVERY_PROOF_REQUIRED_BEFORE_WRITE_VERIFIED"
    },
    "capability": {
      "lifecycle": "WRITE_CANDIDATE",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "system.admin-password",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "SOURCE_OBSERVED",
      "writeState": "CANDIDATE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "system.firmware-status",
    "family": "system-time-firmware-admin",
    "operationClass": "READ",
    "ui": {
      "label": "Firmware / FOTA status",
      "controlKind": "read",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "string",
      "validation": "PROFILE_CONSTRAINED"
    },
    "safety": {
      "danger": "MEDIUM",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "system.firmware-status",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "system.factory-reset",
    "family": "system-time-firmware-admin",
    "operationClass": "DANGEROUS_ACTION",
    "ui": {
      "label": "Khôi phục cài đặt gốc",
      "controlKind": "dangerous-action",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "command",
      "validation": "COMMAND_POLICY"
    },
    "safety": {
      "danger": "CRITICAL",
      "privacy": "NORMAL",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "UNMAPPED",
      "readable": false,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "system.factory-reset",
      "stockPresence": "CONFIRMED_NAVIGATION_SCREENSHOT",
      "readState": "UNMAPPED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "devices.connected-list",
    "family": "devices-clients",
    "operationClass": "COLLECTION",
    "ui": {
      "label": "Danh sách thiết bị kết nối",
      "controlKind": "collection",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "exposure": "STOCK_UI"
    },
    "valueSchema": {
      "type": "collection",
      "validation": "TYPED_MODEL_REQUIRED"
    },
    "safety": {
      "danger": "LOW",
      "privacy": "LOCAL_SENSITIVE",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "READ_MAPPED",
      "readable": true,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "devices.connected-list",
      "stockPresence": "CONFIRMED_HUMAN_SCREENSHOT",
      "readState": "READ_VERIFIED",
      "writeState": "NOT_APPLICABLE",
      "referenceFirmware": "NC03_8.00.42"
    }
  },
  {
    "id": "devices.client-admin",
    "family": "devices-clients",
    "operationClass": "ACTION_FAMILY",
    "ui": {
      "label": "Quản trị từng client (nếu Web UI có)",
      "controlKind": "action-family",
      "stockPresence": "NOT_OBSERVED_AS_STOCK_CONTROL",
      "exposure": "INTERNAL_STATE"
    },
    "valueSchema": {
      "type": "command",
      "validation": "COMMAND_POLICY"
    },
    "safety": {
      "danger": "HIGH",
      "privacy": "LOCAL_SENSITIVE",
      "readbackPolicy": "READ_ONLY_OR_UNMAPPED",
      "recoveryPolicy": "NOT_APPLICABLE"
    },
    "capability": {
      "lifecycle": "UNMAPPED",
      "readable": false,
      "writable": false,
      "hardwareAccepted": false
    },
    "evidence": {
      "parityId": "devices.client-admin",
      "stockPresence": "NOT_OBSERVED_AS_STOCK_CONTROL",
      "readState": "UNMAPPED",
      "writeState": "UNMAPPED",
      "referenceFirmware": "NC03_8.00.42"
    }
  }
];

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export const NC03_SETTINGS_REGISTRY = deepFreeze({
  schema:SETTINGS_REGISTRY_SCHEMA,
  version:SETTINGS_REGISTRY_VERSION,
  projectId:"project:nc03-modem",
  referenceFirmware:"NC03_8.00.42",
  sourceParityInventory:"evidence/stock-webui-parity.v1.json",
  entries:RAW_SETTINGS
});

const BY_ID = new Map(NC03_SETTINGS_REGISTRY.entries.map((entry)=>[entry.id,entry]));

export function settingDefinition(id) {
  return BY_ID.get(String(id ?? "")) ?? null;
}

export function settingsForFamily(family) {
  return NC03_SETTINGS_REGISTRY.entries.filter((entry)=>entry.family===family);
}

export function canReadSetting(id) {
  return Boolean(settingDefinition(id)?.capability?.readable);
}

export function canWriteSetting(id) {
  return Boolean(settingDefinition(id)?.capability?.writable);
}

export function lifecycleForSetting(id) {
  return settingDefinition(id)?.capability?.lifecycle ?? CAPABILITY_LIFECYCLE.UNMAPPED;
}
