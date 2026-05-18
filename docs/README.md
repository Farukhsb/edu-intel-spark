# GradeAI Documentation

This folder contains the main documentation for GradeAI, an AI-assisted academic workflow platform for assessment, feedback, integrity review, moderation, analytics, and early student support.

The docs are organised for three kinds of readers:

- someone reviewing the technical architecture
- someone checking whether the product has been built with academic risk in mind
- someone trying to understand how the lecturer workflow works in practice

## Start Here

### 1. Assessor Evidence Summary

**File:** [`ASSESSOR_EVIDENCE_SUMMARY.md`](ASSESSOR_EVIDENCE_SUMMARY.md)

Start here if you want the clearest evidence-facing summary of the product, the problem, the technical work, and the current stage of the project.

### 2. Technical Architecture

**File:** [`ARCHITECTURE.md`](ARCHITECTURE.md)

Use this to understand the frontend, backend, authentication, Supabase integration, database design, Edge Functions, and AI workflow boundaries.

### 3. Trust Model

**File:** [`TRUST_MODEL.md`](TRUST_MODEL.md)

Use this to understand how GradeAI keeps AI output inside a human-reviewed academic workflow rather than treating it as the final decision.

### 4. Security Model

**File:** [`SECURITY_MODEL.md`](SECURITY_MODEL.md)

Use this to understand authentication, role boundaries, data access, row-level security, and protection of sensitive academic information.

### 5. Academic Compliance and AI Governance

### 5. Authorization Reference

**File:** [`AUTHORIZATION_REFERENCE.md`](AUTHORIZATION_REFERENCE.md)

Use this when you need the fastest route from a critical workflow to the exact tables, RPCs, Edge Functions, and current RLS policies it depends on.

This is the most audit-friendly map of the current authorization surface.

### 6. Production Hardening Summary

Use this to understand the main adoption concerns around student data, lecturer control, academic integrity, AI use, and institutional review.

## User and Workflow Documentation

### User Guide

**File:** [`USER_GUIDE.md`](USER_GUIDE.md)

Use this for a practical first-time walkthrough of the platform across lecturer, student, moderator, and admin roles.

It includes a worked assignment-creation example with a sample rubric so new users can understand how GradeAI is meant to be used in practice.

### Lecturer Guide

**File:** [`Lecturer-Guide.md`](Lecturer-Guide.md)

Explains the lecturer-facing workflow, including invite-based access, assignment setup, marking, integrity review, approval, release, analytics, and student support.

## Support and QA

### Release Readiness Checklist

**File:** [`RELEASE_READINESS_CHECKLIST.md`](support/RELEASE_READINESS_CHECKLIST.md)

Provides a practical pre-release checklist for database state, Edge Functions, role boundaries, testing, deployment readiness, and high-trust academic workflows.

### Testing Checklist

**File:** [`TESTING_CHECKLIST.md`](support/TESTING_CHECKLIST.md)

Manual QA checklist covering important user flows across lecturer, student, and admin roles.

### Test Coverage Strategy

**File:** [`TEST_COVERAGE_STRATEGY.md`](support/TEST_COVERAGE_STRATEGY.md)

Explains the testing approach and how the project should expand coverage across high-risk workflows.

### Live Role Boundary Smoke Test

**File:** [`LIVE_ROLE_BOUNDARY_SMOKE.md`](support/LIVE_ROLE_BOUNDARY_SMOKE.md)

Documents role-boundary checks used to confirm that users only see what they are allowed to see.

This is important evidence for security and trust review.

### Live Regression Checklist

**File:** [`LIVE_REGRESSION_CHECKLIST.md`](support/LIVE_REGRESSION_CHECKLIST.md)

Use this for a short cross-role smoke test after workflow, grading, notification, or architecture changes.

It is intentionally shorter than the full testing checklist and more practical for quick demo or pilot validation.

### Load Testing

**File:** [`LOAD_TESTING.md`](support/LOAD_TESTING.md)

Explains the lightweight load-testing approach used for pilot-stage checks and where the supporting tooling lives.

## Assessor and Evidence-Facing Material

### Assessor Evidence Summary

**File:** [`ASSESSOR_EVIDENCE_SUMMARY.md`](ASSESSOR_EVIDENCE_SUMMARY.md)

A concise evidence-facing summary for reviewers. It explains what GradeAI is, the problem it addresses, what was built, the technical architecture, product evidence, and personal contribution.

## Screenshots

**Folder:** [`screenshots/`](screenshots/)

Contains visual evidence of the working product. Screenshots should be used alongside the product and technical documents to show that the system is implemented, not just described.

## Suggested Review Path

For a technical reviewer, read the documents in this order:

1. [`ASSESSOR_EVIDENCE_SUMMARY.md`](ASSESSOR_EVIDENCE_SUMMARY.md)
2. [`ARCHITECTURE.md`](ARCHITECTURE.md)
3. [`TRUST_MODEL.md`](TRUST_MODEL.md)
4. [`SECURITY_MODEL.md`](SECURITY_MODEL.md)
5. [`AUTHORIZATION_REFERENCE.md`](AUTHORIZATION_REFERENCE.md)
6. [`GRADEAI_PRODUCTION_HARDENING_SUMMARY.md`](GRADEAI_PRODUCTION_HARDENING_SUMMARY.md)
7. [`TESTING_CHECKLIST.md`](support/TESTING_CHECKLIST.md)
8. [`ASSESSOR_EVIDENCE_SUMMARY.md`](ASSESSOR_EVIDENCE_SUMMARY.md)

For a non-technical reviewer or assessor, start with:

1. [`ASSESSOR_EVIDENCE_SUMMARY.md`](ASSESSOR_EVIDENCE_SUMMARY.md)
2. [`Lecturer-Guide.md`](Lecturer-Guide.md)
3. [`ACADEMIC_COMPLIANCE_AND_AI_GOVERNANCE.md`](ACADEMIC_COMPLIANCE_AND_AI_GOVERNANCE.md)
4. [`screenshots/`](screenshots/)

## What This Documentation Is Intended To Show

The documentation is intended to demonstrate:

- full-stack product development ability
- academic workflow design
- React, TypeScript, Supabase, Edge Function, and AI integration experience
- role-based access and data governance thinking
- human-in-the-loop AI design
- security and trust-boundary awareness
- testing and release-readiness discipline
- responsible product judgement in a sensitive academic context

GradeAI should be understood as a working full-stack academic technology project in a controlled pilot stage, not as a finished institution-wide platform.
