import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const read=p=>JSON.parse(readFileSync(p,"utf8"));
const a=read(".blueprint/constitution-adoption.json"),b=read(".blueprint/dependency-budget.json"),e=read("docs/BLUEPRINT-13-B4-SOURCE-AUDIT.json");
const seven=["structural-capacity","architectural-longevity","product-elegance","premium-usability","long-term-durability","fortress-security-disaster-resilience","operational-sovereignty-dependency-minimization"];
test("B4 keeps ratified constitutional obligations without grant of Production",()=>{
 assert.equal(a.policyVersion,"1.3.0");assert.equal(a.projectId,"project:nc03-modem");
 assert.equal(a.blueprintLevel,"B4");assert.deepEqual(a.inheritedPillars,seven);
 assert.deepEqual(a.disabledPillars,[]);assert.deepEqual(a.constitutionalWaivers,[]);
 assert.equal(a.productionAuthority,"separate-explicit-release-gate");
 assert.equal(a.evidenceAuthority,"canonical-quality-gates");
});
test("source budget keeps local core and blocks unsafe third-party authority",()=>{
 assert.equal(b.policyVersion,a.policyVersion);assert.equal(b.projectId,a.projectId);
 assert.equal(b.posture,"LOCAL_CONTROL_CORE");
 assert.equal(b.complianceState,"MIGRATION_REQUIRED");assert.ok(b.migrationBlockers.length>=3);
 assert.equal(b.dependencies.find(d=>d.id==="local-modem-control")?.class,"LOCAL_CORE");
 for(const p of ["remote-generic-shell-or-arbitrary-command-execution","cloud-required-local-lan-administration","plaintext-modem-passwords-or-session-cookies-in-drive-or-sheets"])assert.ok(b.forbidden.includes(p),p);
 for(const d of b.dependencies)assert.ok(d.offlineBehavior&&d.exitPath,d.id);
});
test("NC03's local bridge budget is a separate authority, never normalized into cloud telemetry",()=>{
 const bridge=read("control/dependency-budget.json");
 assert.equal(bridge.policyVersion,"1.3.0");
 assert.equal(bridge.projectId,a.projectId);
 assert.equal(bridge.posture,"LOCAL_CORE");
 assert.equal(bridge.dependencies.find(x=>x.id==="physical-nc03-modem")?.class,"EXTERNAL_ESSENTIAL");
 assert.equal(bridge.canonicalAuthority.modemControl,"local-bridge-to-private-rfc1918-modem");
 assert.equal(bridge.dependencies.find(x=>x.id==="application-management")?.class,"OPTIONAL_SYNC");
 for(const ban of ["plaintext-modem-credentials-in-cloud","remote-generic-shell-or-command-execution","cloud-required-modem-control"])assert(bridge.forbidden.includes(ban));
 assert.match(bridge.releaseGate,/Constitution 1.3/);
});
test("source audit only; incomplete B4 runtime and review remain unverified",()=>{
 assert.equal(e.status,"MIGRATION_REQUIRED_SOURCE_CANDIDATE");
 assert.equal(e.projectId,a.projectId);
 assert.equal(e.policy.version,a.policyVersion);
 assert.equal(e.truth.migration,"MIGRATION_REQUIRED");
 assert.equal(e.truth.offlineRuntime,"UNVERIFIED");
 assert.equal(e.truth.productPass,false);
 assert.equal(e.truth.productionAuthorized,false);
 assert.equal(e.truth.newConstitutionRatification,false);
 assert.ok(e.unresolvedRuntimeQA.length>=3);
 for(const f of e.sourceFiles)assert.ok(existsSync(f),"missing source "+f);
});
