# GradeAI - Assessor Evidence Summary

## Project Overview

GradeAI is a full-stack AI-assisted academic assessment platform built to support university marking workflows without removing lecturer control.

The platform helps lecturers manage the assessment lifecycle from assignment setup through submission handling, AI-assisted grading, integrity review, moderation, approval, release, and cohort-level reflection.

The core principle is simple: AI supports the structured analytical work, while academic judgement remains with the lecturer.

Live deployment: `https://gradeai.pages.dev`

Repository: `github.com/Farukhsb/edu-intel-spark`

![Lecturer dashboard overview](screenshots/lecturer-dashboard-overview.jpg)

## Problem Addressed

University marking is often slow, repetitive, and difficult to audit at scale. Lecturers have to balance large submission volumes, rubric-based grading, moderation requirements, academic integrity review, and timely feedback release.

In many assessment workflows, the final mark is visible, but the reasoning, review path, moderation history, and integrity context behind that mark are harder to inspect.

GradeAI was built to make this process more structured, explainable, and reviewable.

## What I Built

I built and integrated a working full-stack prototype that brings together:

- assignment creation and rubric-based assessment setup
- student submission handling and secure file access
- AI-assisted grading with criterion-level scoring and feedback
- lecturer review, override, approval, and release controls
- academic integrity review with cited and uncited overlap separation
- moderation workflows with case status, reviewer actions, and audit history
- student-facing feedback and grade explanation flows
- cohort analytics and rule-based recommendations for lecturers
- role-based lecturer, student, and admin workflows

The system is not designed as a black-box auto-marker. It is designed as a decision-support tool where lecturers remain responsible for final academic judgement.

## Product Evidence

The screenshots below show the current product rather than mockups.

### Lecturer analytics and cohort insight

![Cohort analytics dashboard](screenshots/cohort-analytics-dashboard.jpg)

![Grade distribution analytics](screenshots/grade-distribution-analytics.jpg)

### Student-facing support and explainability

![Student improvement plan](screenshots/student-improvement-plan.jpg)

![AI grade explanation](screenshots/ai-grade-explanation.jpg)

## Technical Architecture

The current architecture combines a React frontend with Supabase backend services and AI-enabled Edge Functions.

```text
React + Vite frontend
  -> Supabase Auth
  -> Supabase Postgres / RLS
  -> Supabase Storage
  -> Supabase Edge Functions
  -> OpenAI API
  -> lecturer review and release workflow
```

Key technical components include:

- React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, and Radix UI for the frontend
- Supabase Auth for user authentication
- Postgres with row-level security for role-aware data access
- Supabase Storage for uploaded submissions
- Supabase Edge Functions for grading, integrity checks, and explanation flows
- OpenAI API integration for AI-assisted analysis
- Cloudflare Pages for frontend deployment
- Vitest, Testing Library, and Playwright for automated testing

## Why It Is Technically Meaningful

GradeAI demonstrates more than a simple AI prompt interface. The project includes workflow design, data modelling, access control, auditability, and human-in-the-loop decision logic.

The most important technical design choices are:

- separating AI-generated output from lecturer-approved grades
- preventing students from seeing provisional AI results
- treating approval and release as separate workflow steps
- using moderation states to prevent premature sign-off
- recording grade changes and moderation decisions for auditability
- separating cited, uncited, internal, and external overlap in integrity review
- using role-aware access patterns rather than a single generic dashboard

These choices make the system more suitable for academic assessment contexts where transparency, fairness, and reviewability matter.

## My Contribution

My contribution has been both product-facing and technical. I developed the platform from an initial prototype into a controlled full-stack application by making decisions across frontend structure, backend integration, workflow design, database-backed state, AI function boundaries, deployment, and documentation.

This included:

- designing the assessment lifecycle and grading state model
- building lecturer, student, and admin workflows
- integrating Supabase authentication, database, storage, migrations, and Edge Functions
- connecting AI-assisted grading and integrity workflows to lecturer review screens
- adding moderation and audit concepts to strengthen academic oversight
- improving documentation so the system can be reviewed by non-technical and technical readers

## Current State

GradeAI is best described as a working full-stack prototype with hardened core workflows. It is no longer only a UI concept, but it is also not being presented as a finished institutional platform.

The strongest areas are:

- coherent assessment workflow design
- human-in-the-loop AI grading
- lecturer approval and release controls
- moderation and audit direction
- integrity review improvements
- role-aware product structure
- clear technical documentation

The next stage is operational hardening, including broader live testing, stronger runtime validation, stricter TypeScript coverage, and expanded automated tests.

## Relevance

GradeAI shows applied technical ability in a practical digital technology context. It combines AI integration, software engineering, data-backed workflow design, and explainability in a domain where trust and oversight are essential.

The project demonstrates my ability to identify a real workflow problem, design a product response, build the technical system, document the architecture, and continue improving it toward a more robust implementation.
