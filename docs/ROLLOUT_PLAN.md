# GradeAI Rollout Plan

## Purpose

GradeAI should not be presented as ready for immediate institution-wide deployment after a short build period.

A staged rollout is needed because the platform handles assessment workflows, student submissions, grades, feedback, academic integrity signals, moderation, and student support records.

The aim of this plan is to scale the product responsibly, with enough time to validate stability, security, usability, and academic fairness.

## Rollout Principle

GradeAI should grow through controlled pilots before any wider institutional use.

The priority is:

```text
safety before scale
validation before expansion
lecturer confidence before institutional rollout
```

## Stage 1: Internal Validation

This stage is for technical and workflow testing before external use.

Focus areas:
- confirm assignment, submission, grading, review, approval, and release workflows
- confirm academic integrity checks work as expected
- confirm early support signals use softer lecturer-review language
- confirm role boundaries between students, lecturers, moderators, and admins
- confirm build, deployment, and monitoring work correctly
- remove temporary test/debug code before deployment

Expected output:
- stable local and deployed builds
- no known critical workflow failures
- Sentry error monitoring configured safely
- core documentation updated

## Stage 2: Small Lecturer Pilot

This should involve a very small number of trusted users, such as 1-2 lecturers or reviewers.

Focus areas:
- test whether the grading workflow feels clear
- check whether AI-assisted feedback is useful but still reviewable
- confirm lecturers understand that AI output is not final
- collect feedback on academic integrity results
- collect feedback on support signals and intervention wording
- monitor errors using Sentry

Expected output:
- lecturer feedback notes
- bug list and fixes
- review of confusing or high-risk UI language
- confirmation that the workflow can be followed without developer help

## Stage 3: Module-Level Pilot

This stage tests GradeAI in a limited academic setting, such as one module or one controlled cohort.

Focus areas:
- test real submission and grading volume at a small scale
- review how lecturers use moderation and release controls
- check student-facing feedback and improvement plans
- validate whether early support signals are helpful and not overly judgmental
- check performance and reliability under real usage

Expected output:
- pilot feedback from lecturers and students
- list of operational issues
- review of support and integrity workflows
- updated test cases for issues discovered during the pilot

## Stage 4: Review and Hardening

This stage turns pilot feedback into product improvements.

Focus areas:
- fix bugs found during pilot use
- strengthen tests around student visibility and grade release
- review Supabase RLS policies and role boundaries
- check Edge Function logging and permissions
- refine documentation for lecturers and assessors
- review data residency and data handling expectations

Expected output:
- stronger test coverage for critical paths
- security model reviewed against actual pilot behaviour
- clearer operational notes
- improved lecturer and student guidance

## Stage 5: Wider Departmental Pilot

This stage can involve more users, but still should not be treated as full institutional deployment.

Focus areas:
- test across more than one module or teaching context
- monitor error rates and recurring issues
- review admin oversight and reporting needs
- check support workflows across different student profiles
- confirm moderation remains manageable as usage grows

Expected output:
- reliability data
- known limitations list
- support process notes
- decision on whether the product is ready for institutional review

## Stage 6: Institutional Readiness Review

This stage should happen before any broad rollout.

Focus areas:
- security review
- data protection review
- data residency review
- accessibility review
- monitoring and incident response review
- test coverage review
- academic policy alignment

Expected output:
- institutional readiness decision
- documented risks and mitigations
- agreed support and escalation process
- final go/no-go decision for wider rollout

## What Should Not Happen

GradeAI should not be positioned as ready for full institutional-scale deployment simply because the application builds and core features work.

A 25-day build period may be enough to create a strong prototype or pilot-ready system, but it is too early to claim institution-wide readiness.

Institutional use requires evidence that the system is stable, secure, understandable, and fair under real academic conditions.

## Monitoring During Rollout

Sentry should be used to monitor frontend errors and identify broken workflows quickly.

Monitoring should remain privacy-safe:
- do not collect student submissions
- do not collect private lecturer notes
- do not collect unnecessary personal data
- keep default PII collection disabled
- review any error context before adding it to Sentry

## Success Criteria

A rollout stage should only progress when:
- core workflows are stable
- serious errors are fixed
- role boundaries are working
- lecturers understand the workflow
- students only see approved and released content
- support signals remain explainable and human-reviewed
- monitoring and documentation are up to date

## Summary

GradeAI should scale gradually.

The responsible path is to validate the product with small, controlled pilots before wider use. This protects students, supports lecturers, and gives the project stronger evidence for future institutional adoption.