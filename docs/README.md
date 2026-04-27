# GradeAI Documentation

This folder contains the main documentation for GradeAI, an AI-assisted academic workflow platform for assessment, feedback, integrity review, moderation, analytics, and early student support.

The documentation is organised so technical reviewers, assessors, and contributors can quickly understand what the system does, how it works, and why the engineering decisions matter.

## Start Here

### 1. Project Overview

**File:** [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md)

Use this first if you want the clearest summary of the product, problem, workflow, contribution, limitations, future work, and impact.

It explains GradeAI as a workflow-first academic technology system rather than a simple AI marking demo.

### 2. Technical Architecture

**File:** [`ARCHITECTURE.md`](ARCHITECTURE.md)

Use this to understand the technical structure of the application, including the frontend, backend, authentication, Supabase integration, database design, Edge Functions, and AI workflow boundaries.

This is one of the most important documents for assessing technical ability.

### 3. Trust Model

**File:** [`TRUST_MODEL.md`](TRUST_MODEL.md)

Use this to understand how GradeAI keeps AI output under academic control.

The system is designed around human-in-the-loop decision making, lecturer review, release controls, moderation, auditability, and clear boundaries between AI support and final academic judgement.

### 4. Security Model

**File:** [`SECURITY_MODEL.md`](SECURITY_MODEL.md)

Use this to understand how GradeAI approaches authentication, role boundaries, data access, row-level security, and protection of sensitive academic information.

This matters because the platform handles student submissions, grades, feedback, academic integrity signals, and intervention records.

### 5. Production Hardening Summary

**File:** [`GRADEAI_PRODUCTION_HARDENING_SUMMARY.md`](GRADEAI_PRODUCTION_HARDENING_SUMMARY.md)

Use this to review the recent engineering hardening work around AI/API response validation, student visibility boundaries, rate limiting, structured logging, environment validation, type safety, and test coverage.

This document is especially useful for showing that the project goes beyond a prototype and includes responsible engineering decisions.

## User and Workflow Documentation

### Lecturer Guide

**File:** [`Lecturer-Guide.md`](Lecturer-Guide.md)

Explains the lecturer-facing workflow and how staff move through assignment setup, marking, integrity review, approval, release, analytics, and student support.

### Release Readiness Checklist

**File:** [`RELEASE_READINESS_CHECKLIST.md`](RELEASE_READINESS_CHECKLIST.md)

Provides a practical pre-release checklist for checking database state, Edge Functions, role boundaries, testing, deployment readiness, and high-trust academic workflows.

## Testing and Quality Evidence

### Testing Checklist

**File:** [`TESTING_CHECKLIST.md`](TESTING_CHECKLIST.md)

Manual QA checklist covering important user flows across lecturer, student, and admin roles.

### Test Coverage Strategy

**File:** [`TEST_COVERAGE_STRATEGY.md`](TEST_COVERAGE_STRATEGY.md)

Explains the testing approach and how the project should expand coverage across high-risk workflows.

### Live Role Boundary Smoke Test

**File:** [`LIVE_ROLE_BOUNDARY_SMOKE.md`](LIVE_ROLE_BOUNDARY_SMOKE.md)

Documents role-boundary checks used to confirm that users only see what they are allowed to see.

This is important evidence for security and trust review.

## Role, Data, and Migration Notes

### Role Model Alignment

**File:** [`ROLE_MODEL_ALIGNMENT.md`](ROLE_MODEL_ALIGNMENT.md)

Explains the role model used across the application and how lecturer, student, moderator, and admin responsibilities are separated.

### Migration Baseline

**File:** [`MIGRATION_BASELINE.md`](MIGRATION_BASELINE.md)

Records the database migration baseline and helps reviewers understand the database evolution of the project.

## Assessor and Evidence-Facing Material

### Assessor Evidence Summary

**File:** [`ASSESSOR_EVIDENCE_SUMMARY.md`](ASSESSOR_EVIDENCE_SUMMARY.md)

A concise evidence-facing summary for reviewers. It explains what GradeAI is, the problem it addresses, what was built, the technical architecture, product evidence, and personal contribution.

### GTV Evidence Summary: Production Hardening

**File:** [`GTV_EVIDENCE_SUMMARY_GRADEAI_HARDENING.md`](GTV_EVIDENCE_SUMMARY_GRADEAI_HARDENING.md)

A Global Talent evidence-oriented summary focused on the production-hardening work completed on GradeAI.

This document is useful for explaining technical ability, responsible AI integration, and engineering judgement in an evidence pack.

### Presentation Script

**File:** [`PRESENTATION_SCRIPT.md`](PRESENTATION_SCRIPT.md)

A supporting script for explaining the project verbally to reviewers, assessors, or technical contacts.

## Screenshots

**Folder:** [`screenshots/`](screenshots/)

Contains visual evidence of the working product. Screenshots should be used alongside the product and technical documents to show that the system is implemented, not just described.

## Suggested Review Path

For a technical reviewer, read the documents in this order:

1. [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md)
2. [`ARCHITECTURE.md`](ARCHITECTURE.md)
3. [`TRUST_MODEL.md`](TRUST_MODEL.md)
4. [`SECURITY_MODEL.md`](SECURITY_MODEL.md)
5. [`GRADEAI_PRODUCTION_HARDENING_SUMMARY.md`](GRADEAI_PRODUCTION_HARDENING_SUMMARY.md)
6. [`TESTING_CHECKLIST.md`](TESTING_CHECKLIST.md)
7. [`ASSESSOR_EVIDENCE_SUMMARY.md`](ASSESSOR_EVIDENCE_SUMMARY.md)

For a non-technical reviewer or assessor, start with:

1. [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md)
2. [`Lecturer-Guide.md`](Lecturer-Guide.md)
3. [`ASSESSOR_EVIDENCE_SUMMARY.md`](ASSESSOR_EVIDENCE_SUMMARY.md)
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

GradeAI should be understood as a working full-stack academic technology prototype with hardened core workflows, not as a finished institution-wide platform.
