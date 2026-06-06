# Human Oversight

GradeAI is designed so that AI supports academic work but does not replace human responsibility.

## Core Rule

AI output is draft support. Lecturer judgement is the final academic decision.

That rule applies across:

- grading
- feedback release
- moderation
- integrity review
- risk review
- export review

## What Humans Must Approve

- rubric-led grading before student-visible release
- any feedback that will be visible to students
- moderation decisions and score adjustments
- academic integrity findings
- risk interventions that affect student support workflows
- export workflows that could reveal student data
- admin actions that affect user roles or access

## What AI May Do

- draft marks and feedback
- summarise evidence
- surface risk signals
- highlight integrity signals
- help staff prepare evidence packs
- speed up repetitive review tasks

## What AI Must Not Do

- set the final academic mark on its own
- release feedback directly to a student without review
- automatically punish a student based on risk score
- automatically decide misconduct
- silently create partial grades when a provider fails
- bypass role permissions or institution boundaries

## Oversight Controls In The Product

- lecturer review before grade release
- moderation workflows with explicit decisions
- export logging for evidence workflows
- audit logs for key academic and administrative actions
- institution-scoped data access
- demo/live separation for synthetic walkthroughs

## Human-in-the-Loop Evidence

Useful evidence pages and tests include:

- [`../src/test/submissionStage.test.ts`](../src/test/submissionStage.test.ts)
- [`../src/test/assessmentWorkflow.test.ts`](../src/test/assessmentWorkflow.test.ts)
- [`../src/test/moderationWorkflow.test.ts`](../src/test/moderationWorkflow.test.ts)
- [`../src/test/exportAuditEvents.test.ts`](../src/test/exportAuditEvents.test.ts)
- [`../src/test/accessControlSuite.test.ts`](../src/test/accessControlSuite.test.ts)

## Limits

The platform can make review easier, but it cannot remove academic responsibility from staff or institutional policy.

If an output is wrong, incomplete, or unclear, a human must review it before it is treated as an academic decision or evidence artifact.
