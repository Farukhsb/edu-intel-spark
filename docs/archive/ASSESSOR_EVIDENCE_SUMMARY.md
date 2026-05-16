# GradeAI - Assessor Evidence Summary

## Project Overview

GradeAI is an academic intelligence platform designed primarily to help lecturers and institutions identify students who may need support earlier, before poor performance turns into repeated failure, disengagement, or withdrawal.

AI-assisted marking is included to generate structured assessment evidence, but the core purpose of the system is student support, early identification of risk, and intervention tracking.

The platform connects assignment workflows, feedback, analytics, and intervention records into one system so lecturers can move from assessment to action more easily.

Live deployment: `https://gradeai.pages.dev`

Repository: `github.com/Farukhsb/edu-intel-spark`

![Lecturer dashboard overview](screenshots/lecturer-dashboard-overview.jpg)

## Problem Addressed

A central issue in higher education is that struggling students are often identified too late.

Warning signs such as missed submissions, declining marks, weak rubric performance, or low engagement are often visible but spread across different systems or only reviewed after a student has already failed or disengaged.

At the same time, university marking is slow, repetitive, and difficult to audit at scale. This makes it harder for lecturers to connect assessment outcomes to timely student support.

## What I Built

I built and integrated a working full-stack prototype that brings together assessment workflows and student-support workflows in one system.

This includes:

- early identification of struggling students through risk indicators and analytics
- intervention tracking with notes, priority levels, and follow-up actions
- cohort analytics and explainable recommendations for lecturer review
- assignment creation and rubric-based assessment setup
- student submission handling and secure file access
- AI-assisted grading with structured feedback and criterion-level scoring
- lecturer review, override, approval, and release controls
- academic integrity review with cited and uncited overlap separation
- moderation workflows with case status, reviewer actions, and audit history
- student-facing feedback and improvement support

The system is not designed as a black-box auto-marker. AI-assisted marking is used to support structured analysis, while lecturers remain responsible for final academic judgement.

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

Assessment and student-support workflow:

```text
submission and engagement signals
  -> structured grading and feedback
  -> cohort analytics and risk indicators
  -> lecturer review
  -> intervention / follow-up
  -> progress tracking
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

- connecting assessment workflows to student-support workflows
- separating AI-generated output from lecturer-approved grades
- preventing students from seeing provisional AI results
- treating approval and release as separate workflow steps
- using moderation states to prevent premature sign-off
- recording grade changes, moderation decisions, and intervention actions for auditability
- using role-aware access patterns rather than a single generic dashboard

These choices make the system suitable for academic contexts where transparency, fairness, and early support matter.

## My Contribution

My contribution has been both product-facing and technical. I developed the platform from an initial prototype into a controlled full-stack application by making decisions across frontend structure, backend integration, workflow design, database-backed state, AI function boundaries, deployment, and documentation.

The project began as a rapid AI-assisted prototype, but I later moved it into a GitHub-controlled full-stack codebase and took responsibility for the architecture, Supabase backend, authentication, Edge Functions, AI workflow, testing, CI, documentation, and deployment decisions.

This included:

- designing the student-support and intervention model
- building lecturer, student, and admin workflows
- integrating Supabase authentication, database, storage, migrations, and Edge Functions
- connecting AI-assisted grading to analytics and intervention flows
- adding moderation and audit concepts to strengthen academic oversight
- improving documentation so the system can be reviewed by non-technical and technical readers

## Current State

GradeAI is best described as a working full-stack prototype with hardened core workflows. It is no longer only a UI concept, but it is also not being presented as a finished institutional platform.

The strongest areas are:

- early student support and intervention tracking
- coherent assessment workflow design
- human-in-the-loop AI grading
- lecturer approval and release controls
- moderation and audit direction
- integrity review improvements
- role-aware product structure
- clear technical documentation

The next stage is operational hardening, including broader live testing, stronger runtime validation, stricter TypeScript coverage, and expanded automated tests.

## Relevance

GradeAI shows applied technical ability in a practical digital technology context. It combines AI integration, software engineering, data-backed workflow design, and explainability in a domain where trust, oversight, and early intervention are essential.

The project demonstrates my ability to identify a real problem, design a system-level solution, build the technical platform, and iterate it toward a more robust implementation.
