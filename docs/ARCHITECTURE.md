# Architecture

This document describes how the system works today based on the current React app, Supabase schema and policies, Edge Functions, and deployment configuration in this repository. It is meant to be practical rather than aspirational.

## System Overview

The application is a Vite/React single-page app that uses Supabase for most backend concerns:

- authentication through Supabase Auth
- relational data in Postgres
- file storage for uploaded submissions
- Edge Functions for AI grading, integrity checks, and related assistant features

At a high level, the request flow looks like this:

1. The browser loads the React app.
2. The app initializes Supabase, restores the auth session, and loads the user profile.
3. Most reads and writes go directly from the browser to Supabase tables, with row-level security acting as the main authorization boundary.
4. Heavy or privileged backend work is pushed into Supabase Edge Functions. Those functions call external AI services and then return structured results to the frontend.
5. The frontend writes workflow state changes back into Postgres and updates the UI from those results.

The system is frontend-driven. There is no separate custom API server in this repository. The main backend logic lives in:

- SQL migrations and RLS policies under `supabase/migrations`
- Supabase Edge Functions under `supabase/functions`
- frontend workflow helpers under `src/lib`

## Frontend Structure

The app entry point is `src/App.tsx`. It sets up:

- `QueryClientProvider` for TanStack Query
- `BrowserRouter` for routing
- `AuthProvider` for session and profile state
- global UI wrappers such as toasts, tooltips, network status, and an error boundary

Routing is still explicit rather than generated. The app uses route-level lazy loading for most non-trivial pages. The important route groups are:

- public routes: `/`, `/auth`, `/reset-password`, `/install`
- lecturer and student dashboard routes under `/dashboard`
- a catch-all `*` route for `NotFound`

### Route and Layout Pattern

Protected dashboard routes are wrapped through two layers:

- `ProtectedRoute` checks auth state, loading state, and the special demo mode
- `RoleGate` narrows access where a page is role-specific

Most dashboard pages then render inside `DashboardLayout`, which provides the shared shell and navigation.

### Main Frontend Areas

The frontend code is mostly organized as:

- `src/pages/dashboard`: feature pages such as assignments, moderation, analytics, student profile, and settings
- `src/components`: shared UI and feature components
- `src/components/ui`: the lower-level shadcn/Radix UI layer
- `src/contexts`: app-level state, mainly auth
- `src/lib`: workflow helpers, recommendation persistence, communications, interventions, and other domain logic
- `src/integrations/supabase`: the client and generated database types
- `src/test` and `tests/e2e`: integration and browser tests

### Auth and Session Handling

`src/contexts/AuthContext.tsx` is the central auth layer. It:

- restores the current Supabase session on startup
- subscribes to auth state changes
- loads the matching row from `profiles`
- exposes `signUp`, `signIn`, `signOut`, and password reset helpers
- supports a local demo mode for lecturer and student flows
- supports E2E auth overrides used by the test setup

In practice, most pages depend on the auth context for:

- the current `user`
- the application role (`lecturer` or `student`)
- profile metadata
- whether the app is running in demo mode

## Supabase and Backend Setup

### Client Configuration

The frontend Supabase client is created in `src/integrations/supabase/client.ts` using:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Session persistence is enabled in local storage, with token refresh turned on.

### Database

The application relies on Supabase Postgres as the primary system of record. The schema is managed through SQL migrations in `supabase/migrations`.

There is no ORM layer in the app. The frontend talks to tables directly through the Supabase JavaScript client, and most business rules are enforced by a mix of:

- workflow code in the frontend
- row-level security policies
- triggers and helper SQL functions in the database

### Storage

Student work is uploaded to the Supabase Storage bucket named `submissions`.

The frontend stores the file reference on the `submissions` table and later creates signed URLs when lecturers or students need to access the file.

### Edge Functions

The main Edge Functions configured in `supabase/config.toml` are:

- `grade-submission`
- `check-plagiarism`
- `explain-grade`
- `student-ai-tutor`
- `bulk-create-students`

In the checked-in config, these functions have `verify_jwt = false`. That does not mean they are open by default in practice, but it does mean the function code itself is responsible for checking the caller. For example, the grading and integrity functions use shared auth helpers and explicitly require a lecturer identity before doing work.

This is an important architectural point: some authorization lives in database RLS, but Edge Function access control also depends on the function implementation, not only on the Supabase platform toggle.

## Core Workflows

## Assignment Workflow

The assignment workflow is centered around the `Assignments` and `AssignmentDetail` pages.

### Lecturer side

Lecturers can:

- create assignments
- save them as `draft`
- publish them for students
- define rubric data that is later reused during grading

Assignments belong to a lecturer. In the current app, lecturers typically see only their own assignments, while students see published assignments.

### Student side

Students submit work through the assignment detail flow. A submission:

- is uploaded to Supabase Storage
- gets a row in `submissions`
- starts in the `submitted` state

The file path is later used by grading, integrity review, and download actions.

## Grading Workflow

The grading flow is split across the frontend and the `grade-submission` Edge Function.

### Status model

The current workflow helpers in `src/lib/assessmentWorkflow.ts` use these statuses:

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

Not every submission goes through every state, but these values drive the lecturer queue, moderation gating, approval logic, and student visibility.

### How grading works

1. A lecturer triggers grading from the assignment detail page.
2. The frontend marks the submission as `ai_grading`.
3. The app invokes `grade-submission`.
4. The function loads assignment context, downloads the submission file, prepares an AI prompt, and asks the model for a structured grading result.
5. The function returns normalized grading data such as score, feedback, rubric breakdown, confidence, and review reasons.
6. The frontend upserts the `grades` row and moves the submission to:
   - `ai_graded` when no lecturer review is required
   - `first_review` when human review is required

The final grade shown to users is not always the raw AI result. The helper `resolveFinalGradeValues` prefers moderated or lecturer-reviewed values when those exist.

### Approval and release

Approval and release are separate steps.

- `approved` means the lecturer has signed off on the grade
- `released` means the grade is visible to the student

The frontend blocks approval when moderation is still unresolved. Students only see released grades. This is enforced in the UI and reflected in the student grade page, which only exposes score and feedback when a submission has reached `released`.

## Moderation Workflow

The moderation flow is implemented mainly in:

- `src/pages/dashboard/ModerationDashboard.tsx`
- `src/lib/moderationWorkflow.ts`
- the moderation SQL migrations and policies

### Entry into moderation

After first review, the lecturer can send a case into moderation. The app creates or updates a row in `moderation_cases` and moves the submission into the moderation path.

Current moderation-related states are:

- `moderation_pending`
- `moderation_in_progress`
- `moderated`
- `escalated`

### Moderation queue assembly

The moderation dashboard does not read a single denormalized view from the database. Instead, `fetchModerationCaseViews` builds a combined view in the frontend by reading:

- `moderation_cases`
- related `submissions`
- `assignments`
- `grades`
- `profiles`
- `academic_integrity_reviews`
- `moderation_reviews`
- `grade_audit_log`

That assembled shape is what the UI uses to render queue cards, review history, audit history, and action controls.

### Moderation actions

`buildModerationActionPlan` produces the state changes for each moderation action:

- `agree`
- `adjust`
- `return`
- `escalate`
- `approve`

In broad terms:

- `agree` and `adjust` move the case to `moderated` and update final moderation values
- `return` sends the case back to `first_review`
- `escalate` marks the case and submission as `escalated`
- `approve` is the owner lecturer sign-off step that pushes the submission to `approved`

Non-approval actions also write a row to `moderation_reviews`. Grade changes are audited through `grade_audit_log`.

### Nullable fallback behavior

The moderation UI now explicitly handles incomplete related data. If a moderation case exists but the linked submission is missing, the queue card falls back to placeholder text and disables `Review case`. That behavior is covered by integration tests.

## Integrity Workflow

Integrity review is separate from moderation but can feed into it.

The `check-plagiarism` function:

- loads and normalizes submission text
- compares text overlap and writing profile signals
- classifies risk into similarity, AI-writing suspicion, baseline deviation, or mixed concerns
- returns structured flags and supporting evidence

Integrity decisions are stored in `academic_integrity_reviews`. Those rows are then pulled into lecturer pages and the moderation dashboard when relevant.

## Data Model Overview

The schema is broader than the core grading path, but the main working set today looks like this.

### Identity and ownership

- `profiles`: application-level user profile and role metadata

### Teaching and submissions

- `assignments`: lecturer-owned assessment definitions, including title, status, rubric, due date, and max score
- `submissions`: uploaded student work tied to an assignment and student, including workflow status and storage reference
- `grades`: AI, lecturer, and final grade data for a submission

### Review and moderation

- `academic_integrity_reviews`: integrity findings and lecturer decisions
- `moderation_cases`: the main moderation record for a submission
- `moderation_reviews`: reviewer actions and notes during moderation
- `grade_audit_log`: append-only audit trail for grade-related changes

### Communication and interventions

- `communication_messages`: queued lecturer-to-student communication records
- `student_interventions`: lecturer-created support or follow-up actions for students

### Analytics and recommendations

- `analytics_recommendations`: lecturer-facing recommendation records, optionally tied to an assignment
- `recommendation_actions`: actions taken on those recommendations

### Relationship sketch

The core relationships are roughly:

- one lecturer owns many assignments
- one assignment has many submissions
- one submission belongs to one student and one assignment
- one submission can have one grade row and may have integrity and moderation records
- one moderation case can have many moderation review entries
- one grade can generate many audit log entries over time

The app often joins this data client-side rather than relying on large SQL views or RPCs.

## RLS and Permission Model

Row-level security is a major part of the backend design. Most user-facing access rules are enforced there.

### General shape

The common pattern is:

- students can access their own submissions and released results
- lecturers can access rows tied to assignments they own
- moderation access is granted to the first marker, assigned moderator, and assignment owner, depending on the table

The project has been tightening these policies through follow-up migrations, especially around moderation, analytics, interventions, and audit visibility.

### Moderation permissions

The moderation tables are enabled for RLS and now support the real workflow roles more directly.

Based on the current moderation migrations:

- `moderation_cases` can be viewed and changed by the lecturer who owns the assignment and by lecturers participating in the moderation case
- `moderation_reviews` can be read by moderation participants and inserted by the acting reviewer
- `grade_audit_log` can be read by the changer, the assignment owner, and assigned moderators tied to the case

This matters because the moderation dashboard builds its own combined view. If any one of those tables is hidden by RLS, the dashboard degrades or actions stop working.

### Integrity, analytics, and intervention permissions

The `20260421101500_harden_permissions_rls_audit.sql` migration tightened several areas:

- academic integrity reviews are constrained to the lecturer who owns the related assignment
- analytics recommendations are constrained to the lecturer they belong to, with assignment ownership checks when an assignment is linked
- recommendation actions are constrained through the parent recommendation
- student interventions are constrained to the lecturer, with additional checks that tie the student back to that lecturer's assignments

There is also a small SQL function, `apply_recommendation_action`, which runs as `SECURITY INVOKER`. That means it still executes under the caller's RLS constraints instead of bypassing them.

### Where authorization lives

The current authorization model is spread across three places:

- `AuthContext` and route guards in the frontend
- RLS policies in Supabase
- role checks inside Edge Functions

The database is the strongest boundary for table access. The frontend should be treated as a convenience layer, not the authority.

## Deployment Setup

### Frontend build

The frontend is a standard Vite build:

- `npm run dev` for local development
- `npm run build` for production output
- output written to `dist/`

The Vite config uses manual chunking for some vendor groups such as React, router, Supabase, markdown, analytics, and Radix UI packages.

### Hosting

The repository and README point to a split deployment model:

- the React app is deployed as a static frontend, intended for Cloudflare Pages
- Supabase hosts the database, auth, storage, and Edge Functions

There is no checked-in Cloudflare deployment config such as a `wrangler.toml` in this repository, so the Pages project configuration appears to live outside source control. In practice, that means some deployment details are controlled in the hosting dashboard rather than the repo.

### Environment and operations

The frontend expects at least:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Database changes are applied through the Supabase migration chain. Edge Functions are deployed separately through the Supabase CLI.

## Practical Notes and Current Boundaries

- The app is frontend-heavy. A lot of orchestration still happens in page components, especially in `AssignmentDetail.tsx`.
- Business rules are split between UI code and SQL policy logic. That works, but it means workflow changes usually need coordinated updates in both places.
- The moderation dashboard relies on several separate table reads instead of a single backend projection. That keeps the backend simpler, but it makes the UI more sensitive to partial data and policy drift.
- Demo mode exists in the frontend and is useful for local UX flows, but it is not the same path as the real Supabase-backed application.
- Edge Function auth needs to be reviewed alongside function code, because the checked-in config disables JWT verification at the function gateway level.

## Summary

Today, this project is a React dashboard application with Supabase acting as the backend platform. Assignments, submissions, grades, moderation, integrity review, communications, and interventions are all stored in Postgres and protected mainly through RLS. AI-heavy work is handled in Edge Functions, while the frontend remains responsible for most workflow orchestration and page-level state transitions.
