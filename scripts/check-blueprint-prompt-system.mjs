import fs from "node:fs";
import assert from "node:assert/strict";

const adoption=JSON.parse(fs.readFileSync(".blueprint/constitution-adoption.json","utf8"));
const profile=JSON.parse(fs.readFileSync(".blueprint/project-profile.json","utf8"));
const blueprint=JSON.parse(fs.readFileSync(".blueprint/blueprint.json","utf8"));
const plan=JSON.parse(fs.readFileSync(".blueprint/work-packages.json","utf8"));

assert.equal(adoption.policyId,"blueprint-os:universal-century-grade");
assert.equal(adoption.policyVersion,"1.2.0");
assert.equal(adoption.projectId,"project:nc03-modem");
assert.equal(adoption.projectId,profile.projectId);
assert.equal(adoption.blueprintLevel,"B4");
assert.equal(profile.blueprintLevel,"B4");
assert.equal(blueprint.blueprintLevel,"B4");
assert.deepEqual(adoption.disabledPillars,[]);
assert.deepEqual(adoption.constitutionalWaivers,[]);
assert.equal(adoption.inheritedPillars.length,7);
assert.ok(adoption.inheritedPillars.includes("operational-sovereignty-dependency-minimization"));

assert.equal(plan.executionMode,"strict-serial");
assert.equal(plan.workPackages.length,18);

const ids=new Set();
for(let i=0;i<plan.workPackages.length;i+=1){
  const wp=plan.workPackages[i];
  assert.equal(wp.sequence,i);
  assert.match(wp.id,/^NC03-WP\d{2}$/);
  assert.ok(!ids.has(wp.id),`duplicate work package ${wp.id}`);
  ids.add(wp.id);

  if(i===0) assert.deepEqual(wp.dependsOn,[]);
  else assert.deepEqual(wp.dependsOn,[plan.workPackages[i-1].id],`${wp.id} serial dependency drift`);

  assert.ok(fs.existsSync(wp.prompt),`missing prompt ${wp.prompt}`);
  const prompt=fs.readFileSync(wp.prompt,"utf8");
  assert.ok(prompt.includes(`# ${wp.id} — ${wp.title}`),`prompt title drift ${wp.id}`);
  assert.ok(prompt.includes("Blueprint: `project:nc03-modem / 1.0.0 / B4`"),`prompt blueprint drift ${wp.id}`);
  assert.ok(prompt.includes("## Acceptance gates"),`acceptance section missing ${wp.id}`);
  assert.ok(prompt.includes("## Anti-patch rules"),`anti-patch section missing ${wp.id}`);
}

const promptFiles=fs.readdirSync("prompts").filter((name)=>/^\d{2}-wp\d{2}\.md$/.test(name));
assert.equal(promptFiles.length,18,"canonical prompt count drift");
assert.equal(plan.workPackages.filter((wp)=>wp.status==="ACTIVE").length,1,"strict-serial plan requires one ACTIVE package");

for(const wp of plan.workPackages){
  for(const dep of wp.dependsOn) assert.ok(ids.has(dep),`unknown dependency ${dep}`);
}

for(const file of [
  "docs/NC03-REQUIREMENTS-BASELINE.md",
  "docs/NC03-PROJECT-CONSTITUTION.md",
  "docs/NC03-ARCHITECTURE-BLUEPRINT.md",
  "docs/NC03-PROMPT-EXECUTION-PROTOCOL.md",
  "prompts/README.md"
]){
  assert.ok(fs.existsSync(file),`missing canonical document ${file}`);
}

console.log("BLUEPRINT PROMPT SYSTEM PASS");
