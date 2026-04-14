# GradeAI

**AI-powered academic marking, integrity review, student risk detection, and intervention tracking for higher education workflows.**

GradeAI is an EdTech platform for managing the full assessment lifecycle:
- assignment creation and rubric design
- student submission handling
- AI-assisted grading with lecturer oversight
- academic integrity review
- student risk detection and intervention tracking

The product is designed as an academic workflow system rather than a black-box grading tool. It combines automation with human review, explainable scoring, and institution-friendly controls.

Live deployment:
- `https://edu-spark.pages.dev`

## Screenshots

![Overview Dashboard](docs/screenshots/overview-dashboard.jpg)

## Product Scope

### Lecturer Workflow
- Create assignments with title, description, module code, due date, and max score
- Build weighted rubrics for structured marking
- Receive student submissions
- Bulk-upload submissions when needed
- Run AI grading against rubric criteria
- Review, edit, approve, and release grades
- Run academic integrity checks on submissions
- Review flagged cases in an integrity queue
- Track at-risk students and log interventions

### Student Workflow
- Sign up and sign in with Supabase Auth
- Submit assignments
- View released grades and rubric breakdowns
- Read AI-generated feedback
- Use improvement-plan and grade-explanation features

### Integrity Workflow
- Compare student submissions within an assignment for substantive similarity
- Analyse single submissions for AI-writing suspicion
- Distinguish between similarity concerns and AI-writing concerns
- Surface evidence for lecturer review rather than making automatic accusations

### Risk and Support Workflow
- Identify at-risk students using explainable academic indicators
- Record interventions with follow-up dates, notes, and status
- Send student-facing support notifications and follow-up reminders
- Support lecturer review of student progress and support actions

## Core Features

### AI-Assisted Marking
GradeAI grades against lecturer-defined rubrics. The grading flow returns:
- overall score
- detailed feedback
- per-criterion breakdown

The backend normalizes grading output so the rubric breakdown remains consistent with the final score.

### Academic Integrity Review
The integrity flow supports:
- student-to-student similarity checking within an assignment
- AI-writing suspicion scoring
- evidence summaries
- lecturer review decisions saved to the backend

The platform is designed to support academic review, not automated misconduct decisions.

### Lecturer Review Pipeline
Submission statuses move through a structured workflow:

`submitted -> ai_grading -> ai_graded -> under_review -> approved -> released`

This keeps the assessment process visible and manageable for lecturers and students.

### Student Risk Detection
The current risk model is rule-based and explainable. It focuses on:
- submission behaviour
- performance consistency
- grade trends
- intervention needs

This approach is easier to audit and trust in an academic environment than an early, weak predictive model.

### Notifications and Progress Tracking
The platform also includes:
- backend-persisted communication messages for alerts, follow-ups, feedback summaries, and grade-release notes
- student improvement-plan task tracking stored in Supabase
- persisted integrity review history for lecturer decisions

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui |
| Routing | React Router |
| Backend | Supabase |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Server Logic | Supabase Edge Functions |
| Analytics | PostHog |
| Charts | Recharts |
| Export | jsPDF |
| Hosting | Cloudflare Pages |
| Version Control | GitHub |

## Project Structure

```text
src/
  components/         Reusable application components
  components/ui/      Shared UI primitives
  contexts/           App context providers
  hooks/              Custom hooks
  integrations/       Supabase client and generated types
  lib/                Shared logic and utilities
  pages/
    dashboard/        Lecturer and student dashboard pages

supabase/
  functions/          Edge functions for grading and integrity analysis
  migrations/         Database migrations

public/
  Static assets
```

## Important Edge Functions

Current backend logic relies on Supabase Edge Functions such as:
- `grade-submission`
- `check-plagiarism`
- `explain-grade`
- `student-ai-tutor`
- `bulk-create-students`

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create or update `.env` with your Supabase project values:

```env
VITE_SUPABASE_PROJECT_ID="your_project_ref"
VITE_SUPABASE_PUBLISHABLE_KEY="your_publishable_key"
VITE_SUPABASE_URL="https://your_project_ref.supabase.co"
```

Do not commit `.env`.

### 3. Start the app

```bash
npm run dev
```

### 4. Production build

```bash
npm run build
```

## Supabase Requirements

The main workflows expect these tables to exist:
- `assignments`
- `submissions`
- `grades`
- `profiles`
- `user_roles`
- `student_interventions`
- `academic_integrity_reviews`
- `improvement_plan_progress`
- `communication_messages`

The app also expects:
- a `submissions` storage bucket
- deployed edge functions in the same Supabase project

## Required Function Secrets

Set these in Supabase Edge Function secrets:
- `OPENAI_API_KEY`
- `OPENAI_GRADING_MODEL`
- `OPENAI_INTEGRITY_MODEL`
- `OPENAI_CHAT_MODEL`

Typical model values:

```text
gpt-5.4-mini
```

## Current Status

The platform currently supports the core end-to-end flow:
- student submission
- lecturer visibility of submissions
- AI grading against rubric criteria
- integrity checking among submissions in an assignment
- lecturer review, approval, and release
- intervention logging
- student-facing support notifications
- persisted improvement-plan progress

Recent improvements include:
- signed URL handling for submission file access
- stronger rubric-consistent AI grading
- richer integrity evidence and scoring
- real integrity results in the review queue
- improved PDF handling for similarity review
- backend persistence for integrity reviews, improvement progress, and communication messages

## Product Philosophy

GradeAI is intentionally built around:
- lecturer oversight
- explainability
- structured academic workflows
- institution-friendly review processes

It is designed to accelerate grading and surface meaningful signals, while keeping final academic judgement with human educators.

## Notes

- Integrity analysis is decision support, not proof of misconduct.
- Strong writing alone is not treated as evidence of AI use.
- Similarity review is strongest when student-authored content is readable and comparable.

## License

Private project unless otherwise specified by the repository owner.
