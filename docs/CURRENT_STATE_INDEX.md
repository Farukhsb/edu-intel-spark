# GradeAI Current State Index

This is the fastest way to find the documents that describe the current working
state of the repo.

Use this page when you want the active operational and technical documents
without having to guess which older notes are still relevant.

## Start here

- [`README.md`](README.md): documentation landing page and review paths
- [`ARCHITECTURE.md`](ARCHITECTURE.md): current frontend, Supabase, and Edge Function structure
- [`SECURITY_MODEL.md`](SECURITY_MODEL.md): plain-English security model and boundaries
- [`AUTHORIZATION_REFERENCE.md`](AUTHORIZATION_REFERENCE.md): current workflow-to-table/RLS/function map
- [`MIGRATION_RISK_INDEX.md`](MIGRATION_RISK_INDEX.md): high-risk migration categories and what to re-check
- [`TESTING.md`](TESTING.md): current automated testing and security-check baseline
- [`OPERATIONAL_RUNBOOK.md`](OPERATIONAL_RUNBOOK.md): release, deployment, migration, and incident steps

## Deployment and provider docs

- [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md): deployment-specific setup
- [`AI_PROVIDER_AND_DEPLOYMENT_STRATEGY.md`](AI_PROVIDER_AND_DEPLOYMENT_STRATEGY.md): current AI provider position and deployment tradeoffs

## Product and governance docs

- [`TRUST_MODEL.md`](TRUST_MODEL.md): how AI stays inside a human-reviewed academic workflow
- [`ACADEMIC_COMPLIANCE_AND_AI_GOVERNANCE.md`](ACADEMIC_COMPLIANCE_AND_AI_GOVERNANCE.md): governance and institutional positioning
- [`USER_GUIDE.md`](USER_GUIDE.md): cross-role product walkthrough
- [`Lecturer-Guide.md`](Lecturer-Guide.md): lecturer workflow details

Current lecturer workflow also includes `Import Grades` on the lecturer overview page for CSV and image imports.

## QA and support checklists

- [`support/RELEASE_READINESS_CHECKLIST.md`](support/RELEASE_READINESS_CHECKLIST.md): pre-release checks
- [`support/TESTING_CHECKLIST.md`](support/TESTING_CHECKLIST.md): manual QA coverage
- [`support/LIVE_REGRESSION_CHECKLIST.md`](support/LIVE_REGRESSION_CHECKLIST.md): quick live smoke test
- [`support/LIVE_ROLE_BOUNDARY_SMOKE.md`](support/LIVE_ROLE_BOUNDARY_SMOKE.md): role-boundary verification

## Archive note

Documents under [`archive/`](archive/) are kept for history, audit trail, or
previous planning context. They should not be treated as the default source of
truth unless a current document explicitly points back to them.
