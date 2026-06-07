# GradeAI Documentation

This folder contains the main docs for GradeAI.

Use them for:

- technical review
- security and governance review
- workflow and evidence review

## Start Here

### 0. Current State Index

**File:** [`CURRENT_STATE_INDEX.md`](CURRENT_STATE_INDEX.md)

Start here if you want the active technical, security, and testing docs without sorting through older material.

### 1. Assessor Evidence Summary

There is no single canonical `ASSESSOR_EVIDENCE_SUMMARY.md` file in this branch. Start with:

- [`../README.md`](../README.md)
- [`PILOT_STATUS.md`](PILOT_STATUS.md)
- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`SECURITY_MODEL.md`](SECURITY_MODEL.md)
- [`MODEL_EVALUATION.md`](MODEL_EVALUATION.md)

### 2. Technical Architecture

**File:** [`ARCHITECTURE.md`](ARCHITECTURE.md)

Use this to understand the app structure, backend boundary, authentication, database design, Edge Functions, and AI workflow boundaries.

### 3. Trust Model

**File:** [`TRUST_MODEL.md`](TRUST_MODEL.md)

Use this to understand how AI output stays inside a human-reviewed academic workflow.

### 4. Security Model

**File:** [`SECURITY_MODEL.md`](SECURITY_MODEL.md)

Use this to understand authentication, role boundaries, data access, row-level security, and sensitive-data handling.

### 5. Pilot Status

**File:** [`PILOT_STATUS.md`](PILOT_STATUS.md)

Use this to understand what is implemented, what is demo-only, what is under pilot validation, and what is not production-ready.

### 6. Model Evaluation

**File:** [`MODEL_EVALUATION.md`](MODEL_EVALUATION.md)

Use this to understand how the grading and risk models are evaluated and what limits are documented.

### 7. Academic Compliance and AI Governance

**File:** [`ACADEMIC_COMPLIANCE_AND_AI_GOVERNANCE.md`](ACADEMIC_COMPLIANCE_AND_AI_GOVERNANCE.md)

Use this for the project's governance position on student data, lecturer control, AI-assisted assessment, and pilot-stage rollout.

### 8. Authorization Reference

**File:** [`AUTHORIZATION_REFERENCE.md`](AUTHORIZATION_REFERENCE.md)

Use this when you need the route from a workflow to the tables, RPCs, Edge Functions, and RLS policies it depends on.

### 9. Operational Runbook

**File:** [`OPERATIONAL_RUNBOOK.md`](OPERATIONAL_RUNBOOK.md)

Use this for deployment, migration, release, incident, and troubleshooting.

## User and Workflow Documentation

### User Guide

**File:** [`USER_GUIDE.md`](USER_GUIDE.md)

Use this for a first-time walkthrough across lecturer, student, moderator, and admin roles.

### Lecturer Guide

**File:** [`Lecturer-Guide.md`](Lecturer-Guide.md)

Explains the lecturer-facing workflow: access, assignment setup, marking, integrity review, approval, release, analytics, and student support.

## Support and QA

### Release Readiness Checklist

**File:** [`RELEASE_READINESS_CHECKLIST.md`](support/RELEASE_READINESS_CHECKLIST.md)

Provides a pre-release checklist for database state, Edge Functions, role boundaries, testing, deployment readiness, and academic workflows.

### Testing Checklist

**File:** [`TESTING_CHECKLIST.md`](support/TESTING_CHECKLIST.md)

Manual QA checklist for lecturer, student, and admin flows.

### Test Coverage Strategy

**File:** [`TEST_COVERAGE_STRATEGY.md`](support/TEST_COVERAGE_STRATEGY.md)

Explains the testing approach and how coverage expands across high-risk workflows.

### Live Role Boundary Smoke Test

**File:** [`LIVE_ROLE_BOUNDARY_SMOKE.md`](support/LIVE_ROLE_BOUNDARY_SMOKE.md)

Documents role-boundary checks used to confirm that users only see what they are allowed to see.

### Live Regression Checklist

**File:** [`LIVE_REGRESSION_CHECKLIST.md`](support/LIVE_REGRESSION_CHECKLIST.md)

Use this for a short cross-role smoke test after workflow, grading, notification, or architecture changes.

### Load Testing

**File:** [`LOAD_TESTING.md`](support/LOAD_TESTING.md)

Explains the lightweight load-testing approach used for pilot-stage checks.

## Assessor and Evidence-Facing Material

Use the top-level README and the pilot-status docs as the evidence-facing summary. The most useful supporting files are:

- [`../README.md`](../README.md)
- [`PILOT_STATUS.md`](PILOT_STATUS.md)
- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`SECURITY_MODEL.md`](SECURITY_MODEL.md)
- [`MODEL_EVALUATION.md`](MODEL_EVALUATION.md)
- [`screenshots/`](screenshots/)

## Screenshots

**Folder:** [`screenshots/`](screenshots/)

Contains visual evidence of the working product. Use screenshots alongside the product and technical docs.

## Suggested Review Path

For a technical reviewer, read:

1. [`../README.md`](../README.md)
2. [`PILOT_STATUS.md`](PILOT_STATUS.md)
3. [`ARCHITECTURE.md`](ARCHITECTURE.md)
4. [`SECURITY_MODEL.md`](SECURITY_MODEL.md)
5. [`AUTHORIZATION_REFERENCE.md`](AUTHORIZATION_REFERENCE.md)
6. [`MODEL_EVALUATION.md`](MODEL_EVALUATION.md)
7. [`OPERATIONAL_RUNBOOK.md`](OPERATIONAL_RUNBOOK.md)
8. [`TESTING.md`](TESTING.md)
9. [`support/TESTING_CHECKLIST.md`](support/TESTING_CHECKLIST.md)

For a non-technical reviewer or assessor, start with:

1. [`../README.md`](../README.md)
2. [`PILOT_STATUS.md`](PILOT_STATUS.md)
3. [`Lecturer-Guide.md`](Lecturer-Guide.md)
4. [`ACADEMIC_COMPLIANCE_AND_AI_GOVERNANCE.md`](ACADEMIC_COMPLIANCE_AND_AI_GOVERNANCE.md)
5. [`screenshots/`](screenshots/)

## What This Documentation Shows

- a working full-stack academic workflow project
- role-based access and data governance
- human-reviewed AI support
- security and trust boundaries
- test and release discipline

GradeAI is a controlled-pilot project, not a finished institution-wide platform.
