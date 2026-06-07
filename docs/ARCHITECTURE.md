# Architecture

This document describes the system as it exists now. It reflects the current React frontend, Supabase backend, Edge Functions, RLS model, and the recent architecture-hardening work in this repository.

## Current Delivery Posture

GradeAI is best understood as an implemented controlled-pilot system:

- the core workflows are built and test-covered in this repository
- demo routes use synthetic data and are isolated from live academic data
- institution-scoped live data flows are present for the supported dashboards and exports
- some operational questions still require pilot validation rather than claiming full production readiness

This document is intentionally descriptive rather than promotional. If a workflow is only present in demo mode, only validated in tests, or still waiting on pilot evidence, it should be described that way here.

## System Overview

GradeAI is a Vite/React single-page application backed by Supabase.

Core platform responsibilities are split like this:

- React handles dashboard UI, routing, local interaction state, and feature composition
- Supabase Auth handles authentication and session management
- Postgres stores assignments, submissions, grades, moderation data, communications, and analytics-supporting records
- Supabase Storage stores uploaded student files
- Supabase Edge Functions handle AI-heavy or privileged backend workflows such as grading, explain-grade, integrity review, and bulk operations
- Document extraction stays inside Edge Functions, and unreadable PDFs can optionally fall back to a separately hosted Docling service when the backend secrets are configured

At a high level:

1. The browser loads the React app.
2. `AuthContext` restores the session and loads the active profile.
3. Most table reads and writes go directly from the frontend to Supabase under RLS.
4. Sensitive or compute-heavy operations go through Edge Functions.
5. The frontend updates workflow state and re-renders from the resulting database state.

There is no separate custom API server in this repository. The main backend logic lives in:

- `supabase/migrations`
- `supabase/functions`
- `src/lib`

### Live, Demo, and Pilot Status

| Area | Status | Notes |
|---|---|---|
| Live academic workflows | Implemented | Assignment, grading, moderation, student support, exports, and audit surfaces are in the codebase. |
| Demo workflows | Implemented | `Demo*` routes use synthetic data only and do not query live academic records. |
| Pilot validation | Ongoing | Cross-institution proof, deployment governance, and operational readiness still need institutional validation. |
| Production readiness | Not claimed | The repository should not be described as a finished institution-wide rollout. |

## Architectural Direction

The codebase is no longer best described as "large pages with mixed UI and business logic everywhere."

The current direction is:

- page files act as feature shells
- shared domain and workflow rules live in `src/lib`
- shared cross-table read services and dataset loaders live in `src/lib/data`
- page-local UI sections and dialogs live beside the page in page-specific subfolders
- Supabase remains the system of record and authorization boundary
- Edge Functions remain the place for AI orchestration and server-side validation

This is an intentional shift from the earlier frontend-heavy structure.

## Frontend Structure

The main frontend areas are:

- `src/pages/dashboard`: top-level dashboard routes
- `src/pages/dashboard/<feature>/`: page-scoped UI sections, dialogs, hooks, and types for larger pages
- `src/components`: shared components
- `src/components/ui`: lower-level shadcn/Radix UI primitives
- `src/contexts`: app-wide state, mainly auth
- `src/lib`: shared domain helpers, workflow helpers, and feature logic
- `src/lib/data`: shared read-service and dataset loaders grouped by domain
- `src/integrations/supabase`: Supabase client and generated types
- `src/test`: Vitest and Testing Library coverage

### Current Page-Folder Pattern

Large dashboard pages are now moving to a consistent structure:

- top-level page file for route wiring and feature orchestration
- feature subfolder for page-local presentation and supporting code

Current examples:

- `src/pages/dashboard/assignment-detail/`
- `src/pages/dashboard/assignments/`
- `src/pages/dashboard/academic-integrity/`
- `src/pages/dashboard/accreditation-dashboard/`
- `src/pages/dashboard/admin-dashboard/`
- `src/pages/dashboard/cohort-analytics/`
- `src/pages/dashboard/lecturer-overview/`
- `src/pages/dashboard/improvement-plan/`
- `src/pages/dashboard/moderation-dashboard/`
- `src/pages/dashboard/performance-trends/`
- `src/pages/dashboard/student-profile/`

This is one of the most important recent improvements. It gives the repo a repeatable structure instead of each large page evolving differently.

### Route and Layout Pattern

The app entry point is `src/App.tsx`. It sets up:

- `QueryClientProvider`
- `BrowserRouter`
- `AuthProvider`
- global error, toast, tooltip, and network-status wrappers

Protected dashboard routes use:

- `ProtectedRoute` for auth and demo-mode handling
- `RoleGate` for role-specific access
- `DashboardLayout` for the shared shell

## Domain Logic Layout

The main architectural improvement in the frontend is that workflow and feature rules are increasingly centralized in `src/lib`, while shared read choreography is increasingly centralized in `src/lib/data`.

Important examples:

- `assessmentWorkflow.ts`
  owns assessment status semantics, approval/release gating, and grade display rules
- `assignmentVisibility.ts`
  owns student-facing assignment visibility and submission availability rules
- `assignmentCatalog.ts`
  owns assignment list shaping, filtering, sorting, and overview stats
- `improvementPlan.ts`
  owns improvement-plan module building, recommendation generation, and progress shaping
- `performanceAnalytics.ts`
  owns cohort trend projection, grade-distribution projection, and risk-filtered lecturer analytics views
- `studentProfile.ts`
  owns student matching, risk-summary shaping, missed-work projection, and student profile view-model assembly
- `moderationWorkflow.ts`
  owns moderation queue assembly, action planning, and audit payload helpers
- `moderation.ts`
  owns moderation signal evaluation and reviewer-oriented moderation helpers
- `communications.ts`
  owns notification message shaping and communication queue helpers
- `data/*`
  owns shared academic, admin, cohort, integrity, moderation, and student dataset loaders

This means the app is less dependent on page-local heuristics than it was earlier.

## Page-Level Composition

Several larger pages now follow a clearer split between orchestration and presentation.

### Assignment Detail

`AssignmentDetail.tsx` now delegates heavily to:

- `assignment-detail/useAssignmentDetailData.ts`
- `assignment-detail/controllers/`
- `assignment-detail/state/`
- `assignment-detail/workflows/`
- `assignment-detail/ui/`
- `assignment-detail/domain/`
- `assignment-detail/screen-props/`
- `assignment-detail/types.ts`

That page used to carry fetch orchestration, display state, queue rendering, grading actions, and dialog rendering inline. It is now much closer to a route shell over feature-local modules.

### Assignments

`Assignments.tsx` now combines:

- shared catalog logic from `src/lib/assignmentCatalog.ts`
- page-local orchestration in `assignments/useAssignmentsController.ts`
- page-local rendering in `assignments/screen.tsx`
- page-local mutation helpers in `assignments/workflows.ts`

This keeps assignment filtering and summarization reusable while keeping orchestration and mutations out of the main page body.

### Improvement Plan

`ImprovementPlan.tsx` now combines:

- shared plan/recommendation logic from `src/lib/improvementPlan.ts`
- page-local sections in `improvement-plan/sections.tsx`

This is especially important because recommendation generation and plan shaping are now treated as domain behavior, not just JSX decisions.

### Moderation Dashboard

`ModerationDashboard.tsx` now combines:

- shared workflow logic from `src/lib/moderationWorkflow.ts`
- moderation signal helpers from `src/lib/moderation.ts`
- page-local queue state in `moderation-dashboard/state/`
- page-local action handling in `moderation-dashboard/workflows/`
- page-local UI composition in `moderation-dashboard/ui/`
- page-local controller and screen-props composition in `moderation-dashboard/controllers/` and `moderation-dashboard/screen-props/`

This keeps the moderation page aligned with the same architectural pattern as other larger dashboard flows.

### Other Normalized Dashboard Features

The same feature-shell pattern now applies beyond the original workflow-heavy pages:

- `admin-dashboard/` separates controller logic from section-level UI
- `lecturer-overview/` separates controller logic from section-level UI
- `academic-integrity/`, `cohort-analytics/`, and `accreditation-dashboard/` each use feature-local controller and screen splits

This matters because the dashboard surface is now materially more uniform instead of only one or two pages being well-structured.

### Performance Trends

`PerformanceTrends.tsx` now combines:

- shared cohort projection logic from `src/lib/performanceAnalytics.ts`
- page-local presentation sections in `performance-trends/sections.tsx`

This removes inline cohort shaping, grade-distribution assembly, and risk filtering from the page shell.

### Student Profile

`StudentProfile.tsx` now combines:

- shared student-support projection logic from `src/lib/studentProfile.ts`
- page-local presentation sections in `student-profile/sections.tsx`

This keeps student matching, missed-submission shaping, chart shaping, and support-summary projection out of the page body.

## Auth and Session Handling

`src/contexts/AuthContext.tsx` is the central auth layer. It:

- restores the Supabase session
- subscribes to auth state changes
- loads the matching `profiles` row
- exposes sign-in, sign-up, sign-out, and password reset helpers
- supports demo mode
- supports E2E auth overrides

Most frontend authorization decisions still use:

- `user`
- `profile`
- the resolved application role
- demo-mode state

But these should be treated as UI convenience layers. The real data boundary is RLS plus server-side validation in Edge Functions.

## Supabase and Backend Setup

### Database

Supabase Postgres is the system of record.

There is no ORM in the app. The frontend uses the Supabase JavaScript client directly. Business rules are enforced by a combination of:

- RLS policies
- SQL migrations and helper functions
- shared frontend workflow/domain modules
- Edge Function validation

### Storage

Student files are stored in the `submissions` storage bucket.

The `submissions` table stores file metadata and workflow status. The frontend creates signed URLs for access when needed.

### Edge Functions

Important Edge Functions include:

- `grade-submission`
- `check-plagiarism`
- `explain-grade`
- `bulk-create-students`
- `send-workflow-notification-email`

These functions are not just thin adapters. They perform important server-side checks and normalization, especially for:

- lecturer-only grading and integrity operations
- AI request validation
- response shape validation
- notification dispatch workflows

## Core Workflows

## Assignment Workflow

The assignment workflow is centered around:

- `Assignments`
- `AssignmentDetail`
- `assignmentCatalog.ts`
- `assignmentVisibility.ts`

Lecturers can:

- create assignments as drafts
- edit rubric and targeting metadata
- publish assignments
- close assignments

Students can:

- see only assignments visible to them
- submit only when the shared visibility/submission rules allow it

Recent hardening work moved overdue student visibility and submission availability into shared helpers rather than keeping those rules scattered in UI code.

## Grading Workflow

The grading workflow spans:

- `AssignmentDetail`
- `assessmentWorkflow.ts`
- `grade-submission`

Core statuses include:

- `submitted`
- `ai_grading`
- `ai_graded`
- `first_review`
- `moderation_pending`
- `moderation_in_progress`
- `moderated`
- `escalated`
- `under_review`
- `approved`
- `released`

Important current behavior:

- AI grading is an input, not the final academic decision
- lecturer review can override or confirm grading outcomes
- release to students is a separate step from approval
- student-visible grade information depends on release status

Display and action gating for these rules is increasingly centralized in `assessmentWorkflow.ts`.

## Moderation Workflow

Moderation is implemented through:

- `ModerationDashboard`
- `moderationWorkflow.ts`
- `moderation.ts`
- moderation-related migrations and RLS policies

The queue is built from related moderation records rather than a single prebuilt backend projection. `fetchModerationCaseViews` assembles:

- moderation cases
- submissions
- assignments
- grades
- profiles
- integrity reviews
- moderation reviews
- audit log entries

This is still a frontend-assembled view, but the rule logic for how moderation actions work is now shared in domain helpers rather than embedded in the page body.

## Integrity Workflow

Integrity review is handled by:

- `check-plagiarism`
- `academic_integrity_reviews`
- lecturer-facing dashboard and moderation surfaces

The integrity function:

- extracts and compares submission text
- evaluates overlap, writing-profile, and AI-writing signals
- returns structured flags and summary warnings

Those results remain review prompts, not automatic misconduct decisions.

## Explain Grade and Recommendation Surfaces

Two product areas depend heavily on trustworthy explanation logic:

- `explain-grade`
- `ImprovementPlan`

Recent hardening improved both:

- Explain Grade now uses more deterministic server-side context for weakness ranking and criterion comparisons
- Improvement Plan now uses shared domain logic and evidence-backed recommendation shaping where possible

These areas still depend on underlying data quality, but they are less heuristic and less page-local than before.

## Data Model Overview

The main working data model remains:

- `profiles`
- `user_roles`
- `assignments`
- `submissions`
- `grades`
- `academic_integrity_reviews`
- `moderation_cases`
- `moderation_reviews`
- `grade_audit_log`
- `communication_messages`
- `student_interventions`
- recommendation and analytics-supporting tables

Relationship shape:

- one lecturer owns many assignments
- one assignment has many submissions
- one submission belongs to one student and one assignment
- one submission can have one main grade row plus integrity and moderation records
- one moderation case can have many moderation reviews and many audit entries over time

## RLS and Permission Model

RLS remains the strongest authorization boundary in the product.

For the current workflow-to-policy map, use [`AUTHORIZATION_REFERENCE.md`](AUTHORIZATION_REFERENCE.md). That document is the fastest way to trace a page or workflow back to the tables, RPCs, Edge Functions, and latest policy source files it depends on.

The common access shape is:

- students access only their own records and released student-visible outcomes
- lecturers access assignments and related records they own or are explicitly participating in
- moderation access is granted to relevant moderation participants
- admins get oversight-oriented access rather than blanket write access to teaching workflows

Authorization still lives across three layers:

- frontend route and role guards
- database RLS
- Edge Function checks

The key point is that the frontend is not the final authority. Sensitive operations still depend on RLS and/or function-side validation.

## Deployment Setup

Frontend:

- Vite build output in `dist/`
- intended static deployment on Cloudflare Pages

Backend:

- Supabase for auth, database, storage, and Edge Functions

Operationally:

- frontend deployments depend on a fresh `dist/` built from the intended branch state
- database changes go through migrations
- Edge Functions deploy separately through the Supabase CLI

## Current Architectural State

The current architecture is stronger and more consistent than the earlier project shape.

Meaningful improvements now in place:

- repeated workflow rules extracted from pages into `src/lib`
- shared read/dataset loaders grouped under `src/lib/data/*`
- large dashboard pages increasingly follow a shared page-folder pattern
- page files are smaller and more clearly focused on orchestration
- major features now use clearer internal splits such as `controllers`, `state`, `workflows`, `ui`, `domain`, and `screen-props`
- recommendation and explanation logic is less ad hoc
- student visibility, assessment workflow, catalog logic, moderation logic, and improvement-plan logic are more centralized

What is still true:

- the app is still a frontend-driven orchestration layer over Supabase
- some admin and institutional analytics views are still better described as frontend projections over raw table reads than as backend-curated reporting endpoints
- AI-dependent surfaces still rely on the quality of stored grading feedback and structured context
- the repository documents a controlled pilot posture, not a formal institution-wide production certification

## Summary

Today, GradeAI is a React plus Supabase system with a clearer separation between:

- route-level pages
- shared domain/workflow modules
- page-scoped UI sections
- database-enforced access control
- Edge Function AI orchestration

It is no longer accurate to describe the codebase simply as “big pages with mixed logic.” The current structure is still evolving, but it now has a more consistent architecture direction and a stronger base for safe future work.
