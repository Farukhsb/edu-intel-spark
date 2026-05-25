# Institution Readiness Gap Analysis

## Current readiness
GradeAI already demonstrates several institution-facing foundations:
- rubric-based AI-assisted grading with lecturer review
- moderation and academic integrity workflow surfaces
- privacy notice and pilot-stage governance language
- institution-scoped schema and RLS work already present in the codebase
- linked Supabase project currently confirmed in `West EU (Ireland)`

## Remaining blockers
The main blockers to more serious institutional adoption are now:
- no published Terms of Service page
- no implemented admin erasure or anonymisation workflow
- no custom production domain configured
- multi-tenancy rollout needs formal review before further database changes are applied remotely
- pilot governance documentation needs to be made easier for IT and compliance reviewers to assess quickly

## Multi-tenancy requirement
Multi-tenancy remains a hard institutional requirement. The codebase already contains substantial institution-scoping work, but the database impact and rollout path still need review before additional remote migrations are applied. Institutions will expect clear isolation boundaries and a documented backfill and test plan.

## EU hosting / Supabase region check
The currently linked Supabase project is in:
- `West EU (Ireland)`

This removes one of the most immediate hosting-risk questions for pilot conversations. The project region should still be captured explicitly in governance documentation and deployment notes.

## Custom domain requirement
The public app still references `gradeai.pages.dev` in configuration, docs, and generated site metadata. That is acceptable for internal testing, but it weakens institutional confidence. A custom domain is not a code blocker, but it remains an adoption blocker for formal pilot conversations.

## Terms of Service
This phase adds a `/terms` page so institutions, lecturers, and students can see a clear pilot usage position, acceptable-use rules, data-handling expectations, and the decision-support boundary for AI outputs.

## GDPR erasure mechanism
The privacy notice already refers to deletion requests, but there is no production-safe admin workflow yet. The right next step is a reviewed delete/anonymise design and table dependency map, followed by a controlled admin-only implementation.

## Recommended next implementation order
1. publish clear legal and governance pages
2. capture hosting and custom-domain readiness notes
3. review the current multi-tenancy migration chain and rollout status
4. design the admin erasure/anonymisation workflow with audit logging
5. implement the erasure workflow in a separate reviewed phase
6. apply or extend multi-tenancy migrations only after database impact review
