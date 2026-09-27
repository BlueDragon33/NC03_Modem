# NC03 Prompt Execution Protocol

Status: **ENFORCED**

## Purpose

Rapid discovery in v0.7.x produced valuable evidence but also symptom-level iteration. From Blueprint v1.0 onward, prompts are controlled Work Package projections.

## Prompt count

Current plan contains exactly **18 prompts, 00 through 17**.

Do not create Prompt 18 merely because Prompt 17 finishes. New Work Packages exist only for a real capability, defect, migration, dependency or constitutional gap.

## Execution cycle

1. Read Constitution adoption, Project Constitution, Project Profile, Blueprint and Work Package graph.
2. Verify all dependencies are COMPLETE.
3. Audit/reproduce current state before editing.
4. Implement only owned scope.
5. Run tests and required real/human evidence.
6. Fix root causes.
7. Update canonical state once.
8. Mark COMPLETE only with evidence.
9. Activate only the next dependent prompt.

## Defect classification

- inside current ownership → repair now;
- contradiction in lower layer → stop and reopen owning lower Work Package;
- future-scope issue → record; do not patch ahead;
- P0/P1 emergency → minimal containment + regression + removal trigger.

## Merge/release discipline

`branch → implementation → tests → PR → exact-head CI → evidence/review → merge`

Merge is not Production deployment. Hardware acceptance and Production authorization remain separate.
