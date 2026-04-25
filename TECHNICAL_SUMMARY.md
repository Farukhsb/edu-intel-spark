# GradeAI - Academic Intelligence Platform

## 1. Problem

University marking is slow, repetitive, and difficult to audit at scale.

Lecturers often have to manage large submission volumes, rubric-based grading, moderation requirements, academic integrity review, and student feedback release under time pressure. In many existing workflows, the final mark is visible, but the reasoning and review path behind it are much harder to inspect.

## 2. Solution

GradeAI is an AI-assisted assessment platform that supports marking while keeping lecturer control at the centre of the workflow.

The system supports:
- rubric-based scoring
- evidence-backed feedback
- academic integrity flagging
- moderation support
- lecturer review before approval and release

The aim is not to replace academic judgement. It is to reduce repetitive work, improve consistency, and make the assessment process easier to review.

## 3. Architecture

High-level flow:

```text
React frontend
  -> Supabase Auth / Database / Storage
  -> Supabase Edge Functions
  -> AI model layer
  -> validated results returned to lecturer workflow
```

Operational flow:

```text
submission upload
  -> document extraction
  -> rubric-based grading request
  -> backend validation and fairness checks
  -> lecturer review
  -> approval
  -> release
```

The frontend manages the user experience and workflow state, while Supabase provides authentication, database storage, file storage, row-level security, and server-side Edge Functions for AI-assisted tasks.

## 4. Key Technical Features

- Structured grading pipeline rather than a single black-box score
- Criterion-level scoring with evidence and confidence signals
- Lecturer review and override before grades are released
- Moderation workflow with review states and audit history
- Integrity analysis that separates cited, uncited, internal, and external overlap
- Student-facing explanations and improvement support after release
- Cohort analytics and rule-based recommendations for lecturers

## 5. Technical Stack

- Frontend: React, TypeScript, Vite
- UI: Tailwind CSS, shadcn/ui, Radix UI
- Backend platform: Supabase
- Database: Postgres with row-level security
- Storage: Supabase Storage
- Server logic: Supabase Edge Functions
- AI integration: OpenAI API
- Hosting: Cloudflare Pages
- Testing: Vitest, Testing Library, Playwright

## 6. My Contribution

I built and integrated the main application workflow, including:
- assignment and submission handling
- AI-assisted grading pipeline
- lecturer review, approval, and release controls
- academic integrity review flow
- moderation support and audit logic
- student feedback and explanation flows
- cohort analytics and reporting views
- validation and safety improvements across Edge Function boundaries

I also moved the project beyond an initial prototype by connecting the frontend, Supabase backend, Edge Functions, authentication, storage, and deployment flow into one working application.

## 7. Current Impact

In its current state, GradeAI demonstrates practical value as a working full-stack prototype. It is designed to:
- reduce repetitive marking and review work
- improve consistency across rubric-based assessment
- make AI-assisted outputs easier for lecturers to inspect
- keep human approval in place before grades are released
- create a clearer audit trail for grading, moderation, and integrity decisions

The project is still being tested and hardened, but the core workflows now show how AI can support academic assessment without removing academic oversight.
