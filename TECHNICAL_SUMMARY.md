# GradeAI - Academic Intelligence Platform

## 1. Problem

The core problem GradeAI addresses is that struggling students are often identified too late.

Missed submissions, declining marks, weak rubric performance, repeated feedback issues, and low engagement may already exist before a student fails, disengages, or withdraws. However, these signals are often scattered across different systems or only reviewed after the student has already reached crisis point.

Assessment is central to this problem because it produces some of the clearest evidence of student progress. At the same time, university marking is slow, repetitive, and difficult to audit at scale. Lecturers often have to manage large submission volumes, moderation requirements, academic integrity review, and feedback release under time pressure.

## 2. Solution

GradeAI is an academic intelligence platform designed primarily to help lecturers identify students who may need support earlier.

AI-assisted marking is included because structured assessment data makes it easier to understand where students are struggling. The platform connects marking, feedback, cohort analytics, risk indicators, intervention records, and student improvement support in one workflow.

The system supports:
- early student-support signals and intervention tracking
- cohort analytics and risk indicators
- rubric-based scoring
- evidence-backed feedback
- academic integrity flagging
- moderation support
- lecturer review before approval and release

The aim is not to replace academic judgement. It is to reduce repetitive work, improve consistency, make student progress easier to review, and help staff act before failure or dropout becomes the outcome.

## 3. Architecture

High-level flow:

```text
React frontend
  -> Supabase Auth / Database / Storage
  -> Supabase Edge Functions
  -> AI model layer
  -> validated outputs returned to lecturer workflow
```

Student-support flow:

```text
assessment and engagement signals
  -> cohort analytics and risk indicators
  -> lecturer review
  -> intervention note / follow-up action
  -> progress tracking over time
```

Assessment workflow:

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

- Student risk indicators and intervention records for early support before failure, withdrawal, or dropout
- Cohort analytics and rule-based recommendations for lecturers
- Structured grading pipeline rather than a single black-box score
- Criterion-level scoring with evidence and confidence signals
- Lecturer review and override before grades are released
- Moderation workflow with review states and audit history
- Integrity analysis that separates cited, uncited, internal, and external overlap
- Student-facing explanations and improvement support after release

## 5. Student Support and Retention

GradeAI is designed not simply to assess student work, but to turn assessment activity into earlier support.

The platform can surface warning signs such as missed submissions, declining marks, repeated weaknesses against rubric criteria, and patterns of low engagement. These signals are not treated as final judgements about a student. They are decision-support prompts for lecturers and support teams to review.

Lecturers can record intervention notes, assign priority levels, set follow-up dates, and track progress. This creates a clearer support history and helps institutions move from reactive support after failure to earlier, evidence-informed intervention.

AI-assisted marking supports this by creating structured, reviewable assessment evidence. It is one part of the wider student-support workflow, not the whole purpose of the product.

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
- student risk, intervention, and improvement-plan workflows
- cohort analytics and reporting views
- assignment and submission handling
- AI-assisted grading pipeline
- lecturer review, approval, and release controls
- academic integrity review flow
- moderation support and audit logic
- student feedback and explanation flows
- validation and safety improvements across Edge Function boundaries

I also moved the project beyond an initial prototype by connecting the frontend, Supabase backend, Edge Functions, authentication, storage, and deployment flow into one working application.

## 8. Current Impact

In its current state, GradeAI demonstrates practical value as a working full-stack prototype. It is designed to:
- help lecturers identify struggling students earlier and record interventions before failure, disengagement, or dropout occurs
- connect assessment evidence to student-support workflows
- reduce repetitive marking and review work
- improve consistency across rubric-based assessment
- make AI-assisted outputs easier for lecturers to inspect
- keep human approval in place before grades are released
- create a clearer audit trail for grading, moderation, integrity decisions, and support actions

The project is still being tested and hardened, but the core workflows now show how AI can support academic assessment and student support without removing academic oversight.
