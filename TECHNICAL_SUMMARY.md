# GradeAI - Academic Intelligence Platform

## 1. Problem

University marking is slow, repetitive, and difficult to audit at scale.

Lecturers often have to manage large submission volumes, rubric-based grading, moderation requirements, academic integrity review, and student feedback release under time pressure. In many existing workflows, the final mark is visible, but the reasoning and review path behind it are much harder to inspect.

A second problem is that struggling students are often identified too late. Missed submissions, declining marks, weak rubric performance, and repeated feedback issues may already exist before a student fails, disengages, or withdraws, but those signals are often scattered across systems.

## 2. Solution

GradeAI is an AI-assisted assessment platform that supports marking while keeping lecturer control at the centre of the workflow.

The system supports:
- rubric-based scoring
- evidence-backed feedback
- academic integrity flagging
- moderation support
- lecturer review before approval and release
- early student-support signals and intervention tracking

The aim is not to replace academic judgement. It is to reduce repetitive work, improve consistency, make the assessment process easier to review, and help staff identify students who may need support before failure or dropout becomes the outcome.

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

Student-support flow:

```text
assessment and engagement signals
  -> cohort analytics and risk indicators
  -> lecturer review
  -> intervention note / follow-up action
  -> progress tracking over time
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
- Student risk indicators and intervention records for early support before failure, withdrawal, or dropout

## 5. Student Support and Retention

GradeAI is designed not only to assess student work, but also to help institutions support students earlier.

The platform can surface warning signs such as missed submissions, declining marks, repeated weaknesses against rubric criteria, and patterns of low engagement. These signals are not treated as final judgements about a student. They are decision-support prompts for lecturers and support teams to review.

Lecturers can record intervention notes, assign priority levels, set follow-up dates, and track progress. This creates a clearer support history and helps institutions move from reactive support after failure to earlier, evidence-informed intervention.

## 6. Technical Stack

- Frontend: React, TypeScript, Vite
- UI: Tailwind CSS, shadcn/ui, Radix UI
- Backend platform: Supabase
- Database: Postgres with row-level security
- Storage: Supabase Storage
- Server logic: Supabase Edge Functions
- AI integration: OpenAI API
- Hosting: Cloudflare Pages
- Testing: Vitest, Testing Library, Playwright

## 7. My Contribution

I built and integrated the main application workflow, including:
- assignment and submission handling
- AI-assisted grading pipeline
- lecturer review, approval, and release controls
- academic integrity review flow
- moderation support and audit logic
- student feedback and explanation flows
- cohort analytics and reporting views
- student risk, intervention, and improvement-plan workflows
- validation and safety improvements across Edge Function boundaries

I also moved the project beyond an initial prototype by connecting the frontend, Supabase backend, Edge Functions, authentication, storage, and deployment flow into one working application.

## 8. Current Impact

In its current state, GradeAI demonstrates practical value as a working full-stack prototype. It is designed to:
- reduce repetitive marking and review work
- improve consistency across rubric-based assessment
- make AI-assisted outputs easier for lecturers to inspect
- keep human approval in place before grades are released
- create a clearer audit trail for grading, moderation, and integrity decisions
- help lecturers identify struggling students earlier and record interventions before failure, disengagement, or dropout occurs

The project is still being tested and hardened, but the core workflows now show how AI can support academic assessment and student support without removing academic oversight.
