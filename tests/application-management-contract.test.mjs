import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const contract = JSON.parse(fs.readFileSync(new URL("../control/application-management.contract.json", import.meta.url), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const build = fs.readFileSync(new URL("../scripts/build.mjs", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../scripts/serve-local.mjs", import.meta.url), "utf8");

test("NC03 publishes a classification-only Application Management contract", () => {
  assert.equal(contract.schema, "application-management.contract/v1");
  assert.equal(contract.application.id, "nc03-modem");
  assert.equal(contract.application.category, "Kỹ thuật");
  assert.equal(contract.application.repository, "BlueDragon33/NC03_Modem");
  assert.equal(contract.policy.remoteAdminReady, false);
  assert.equal(contract.policy.modemSecretsInControlPlane, false);
  assert.equal(contract.policy.modemCommandsFromCloud, false);
  assert.equal(contract.capabilities.webLaunch, true);
  assert.equal(contract.capabilities.deviceRegistry, false);
});

test("verified Pages artifact includes the management contract", () => {
  assert.match(build, /fs\.cpSync\(path\.resolve\("control"\)/);
});


test("local runtime exposes live Application Management discovery and status endpoints", () => {
  assert.match(server, /\/api\/application-management\/contract/);
  assert.match(server, /\/api\/control\/status/);
  assert.match(server, /applicationId:"nc03-modem"/);
  assert.match(server, /contractConnected:true/);
  assert.match(server, /remoteAdminReady:false/);
  assert.match(server, /managementMode:"local-first"/);
  assert.match(server, /existsSync\(join\(distRoot, "index.html"\)\)/);
});


test("release contract stays synchronized with package version and resilient telemetry policy", () => {
  assert.equal(contract.application.version, pkg.version);
  assert.match(contract.application.version, /^\d+\.\d+\.\d+$/);
  assert.equal(contract.policy.lastKnownGoodTelemetry, true);
  assert.equal(contract.policy.staleTelemetryExplicitlyMarked, true);
  assert.equal(contract.policy.uiBridgeOriginPolicyUnified, true);
  assert.equal(contract.policy.lastSuccessfulTelemetryTimestamp, true);
  assert.equal(contract.policy.advancedSnapshotFreshnessExplicit, true);
  assert.equal(contract.policy.rememberPasswordRequiresVerifiedAuth, true);
  assert.equal(contract.policy.invalidManualModemAddressRejected, true);
  assert.equal(contract.policy.modemSecretsInControlPlane, false);
  assert.equal(contract.policy.modemCommandsFromCloud, false);
});


test("contract publishes the WRITE readiness runtime boundary without promoting live write", () => {
  assert.equal(contract.capabilities.writeReadinessLab, true);
  assert.equal(contract.capabilities.writeReadinessRuntimeProtocol, true);
  assert.equal(contract.endpoints.writeReadiness, "/api/nc03/write-readiness");
  assert.equal(contract.policy.writeReadinessReadOnly, true);
  assert.equal(contract.policy.writeReadinessNeverExecutesWrite, true);
  assert.equal(contract.policy.writeRequiresHarRollbackPostcondition, true);
});


test("contract publishes login-first authentication UX without weakening credential safety", () => {
  assert.equal(contract.capabilities.loginFirstScreen, true);
  assert.equal(contract.capabilities.passwordEntryBeforeAuthReadiness, true);
  assert.equal(contract.policy.loginScreenFirstOnLaunch, true);
  assert.equal(contract.policy.passwordEntryNotBlockedByReadiness, true);
  assert.equal(contract.policy.demoModeNeverAutoRestoredOnLaunch, true);
  assert.equal(contract.policy.credentialSavedOnlyAfterVerifiedLogin, true);
});


test("contract publishes runtime login indirection and privacy-safe readiness evidence", () => {
  assert.equal(contract.capabilities.runtimeLoginRecipeIndirection, true);
  assert.equal(contract.capabilities.authReadinessEvidence, true);
  assert.equal(contract.policy.authReadinessEvidenceNoSecrets, true);
  assert.equal(contract.policy.credentialSavedOnlyAfterVerifiedLogin, true);
});


test("contract publishes local modem session continuity without cloud credential ownership", () => {
  assert.equal(contract.capabilities.localModemSessionCookies, true);
  assert.equal(contract.policy.modemSessionCookiesMemoryOnly, true);
  assert.equal(contract.policy.loginVerificationSharesSessionTransport, true);
  assert.equal(contract.boundary.applicationManagementOwnsModemCredentials, false);
});


test("contract publishes guarded Long Life Charging write without promoting unrelated settings", () => {
  assert.equal(contract.capabilities.guardedSettingsWrite, true);
  assert.equal(contract.capabilities.longLifeChargingWrite, false);
  assert.equal(contract.capabilities.longLifeChargingWriteCandidate, true);
  assert.equal(contract.capabilities.reversibleWriteRollback, true);
  assert.equal(contract.endpoints.longLifeCharging, "/api/nc03/settings/long-life-charging");
  assert.equal(contract.policy.settingsWriteProtocol, "nc03-settings-write/v1");
  assert.equal(contract.policy.longLifeChargingWriteRequiresPreflight, true);
  assert.equal(contract.policy.longLifeChargingWriteRequiresReadback, true);
  assert.equal(contract.policy.longLifeChargingWriteAutoRollbackOnMismatch, true);
  assert.equal(contract.policy.otherSettingsRemainReadOnly, true);
});


test("contract publishes stock-WebUI-style settings navigation without broad write promotion", () => {
  assert.equal(contract.capabilities.webUiStyleSettingsCenter, true);
  assert.equal(contract.capabilities.settingsCategoryNavigation, true);
  assert.equal(contract.capabilities.wifiApProfileTabs, true);
  assert.equal(contract.policy.settingsLayoutMirrorsStockGroups, true);
  assert.equal(contract.policy.lockedSettingsRenderAsControls, true);
  assert.equal(contract.policy.lockedSettingsDoNotDispatchWrites, true);
  assert.equal(contract.policy.sensitiveWifiPskNeverPrefilled, true);
  assert.deepEqual(contract.policy.settingsCategories, ["mobile","wifi","lan","connectivity","power","security","system"]);
  assert.equal(contract.policy.otherSettingsRemainReadOnly, true);
});


test("contract publishes Constitution-bound canonical Blueprint governance", () => {
  assert.equal(contract.capabilities.canonicalBlueprintPromptSystem, true);
  assert.equal(contract.capabilities.strictSerialWorkPackages, true);
  assert.equal(contract.capabilities.constitutionBoundDevelopment, true);
  assert.equal(contract.policy.blueprintLevel, "B4");
  assert.equal(contract.policy.blueprintVersion, "1.0.0");
  assert.equal(contract.policy.promptProjectionCount, 18);
  assert.equal(contract.policy.promptExecutionMode, "strict-serial");
  assert.equal(contract.policy.canonicalProjectState, ".blueprint/*");
  assert.equal(contract.policy.promptProjectionIsSourceOfTruth, false);
  assert.equal(contract.policy.rootCauseBeforePatch, true);
  assert.equal(contract.policy.productionAuthoritySeparateFromMerge, true);
});


test("contract publishes privacy-safe stock Web UI audit without promoting it to human acceptance", () => {
  assert.equal(contract.capabilities.stockWebUiStructureAudit, true);
  assert.equal(contract.capabilities.stockWebUiAuditExport, true);
  assert.equal(contract.endpoints.stockWebUiAudit, "/api/nc03/stock-ui-audit");
  assert.equal(contract.policy.stockWebUiAuditSchema, "nc03-stock-webui-audit/v2");
  assert.equal(contract.policy.stockWebUiAuditLocalOnly, true);
  assert.equal(contract.policy.stockWebUiAuditStructureOnly, true);
  assert.equal(contract.policy.stockWebUiAuditNeverReturnsControlValues, true);
  assert.equal(contract.policy.stockWebUiAuditUsesAuthenticatedSession, true);
  assert.equal(contract.policy.stockWebUiAuditReportsCoverageGaps, true);
  assert.equal(contract.policy.stockWebUiAuditDoesNotReplaceHumanReview, true);
});


test("contract publishes canonical settings registry as write authority", () => {
  assert.equal(contract.capabilities.canonicalSettingsRegistry, true);
  assert.equal(contract.capabilities.settingsRegistryDrivenUi, true);
  assert.equal(contract.capabilities.vendorRoutesExcludedFromCanonicalIdentity, true);
  assert.equal(contract.policy.settingsRegistrySchema, "nc03-settings-registry/v1");
  assert.equal(contract.policy.settingsRegistryVersion, "1.0.0");
  assert.equal(contract.policy.settingsRegistryEntries, 77);
  assert.equal(contract.policy.writeAuthorityFromSettingsRegistry, true);
  assert.equal(contract.policy.vendorRoutesAreEvidenceNotIdentity, true);
  assert.equal(contract.policy.internalFirmwareStateNotPromotedToStockControl, true);
  assert.equal(contract.policy.longLifeChargingWriteAuthorized, false);
  assert.equal(contract.policy.longLifeChargingLifecycle, "WRITE_CANDIDATE");
});


test("contract publishes consolidated architecture ownership boundaries", () => {
  assert.equal(contract.capabilities.applicationBoundaryClient, true);
  assert.equal(contract.capabilities.uiDirectTransport, false);
  assert.equal(contract.capabilities.centralRuntimeCompatibilityGate, true);
  assert.equal(contract.capabilities.architectureBoundaryContract, true);
  assert.equal(contract.policy.architectureBoundarySchema, "nc03-architecture-boundaries/v1");
  assert.equal(contract.policy.productUiMayCallFetchDirectly, false);
  assert.equal(contract.policy.productUiMayOwnLocalApiRoutes, false);
  assert.equal(contract.policy.applicationClientOwnsLocalBridgeTransport, true);
  assert.equal(contract.policy.runtimeCompatibilityOwnedByApplicationClient, true);
  assert.equal(contract.policy.capabilityAuthority, "src/domain/NC03SettingsRegistry.js");
  assert.equal(contract.policy.modemSessionAuthority, "Local Bridge in-memory session");
  assert.equal(contract.policy.rememberedCredentialAuthority, "src/modem/SecureCredentialVault.js");
});


test("contract publishes deterministic auth session lifecycle", () => {
  assert.equal(contract.application.version, packageJson.version);
  assert.equal(contract.capabilities.deterministicAuthSessionStateMachine, true);
  assert.equal(contract.capabilities.localSessionInvalidation, true);
  assert.equal(contract.endpoints.sessionClear, "/api/nc03/session/clear");
  assert.equal(contract.policy.sessionCookiesMemoryOnly, true);
  assert.equal(contract.policy.sessionClearVendorLogoutAttempted, false);
  assert.equal(contract.policy.rememberedCredentialEncryptedLocalOnly, true);
  assert.equal(contract.policy.authSecretsExcludedFromStateMachine, true);
});


test("contract publishes normalized read-plane boundary", () => {
  assert.equal(contract.application.version, packageJson.version);
  assert.equal(contract.capabilities.versionedNormalizedReadModel, true);
  assert.equal(contract.capabilities.vendorFieldIsolationAtBridge, true);
  assert.equal(contract.policy.readModelSchema, "nc03-read-model/v1");
  assert.equal(contract.policy.readModelVersion, "1.0.0");
  assert.equal(contract.policy.productUiConsumesVendorFields, false);
  assert.equal(contract.policy.unknownBooleanReadValueBecomesNull, true);
  assert.equal(contract.policy.readFreshnessExplicit, true);
});
