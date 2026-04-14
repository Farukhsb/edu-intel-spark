# GradeAI — Academic Marking & Intelligence Platform

**AI-powered academic marking, student risk detection, integrity review, and intervention tracking for modern education teams.**

GradeAI is an EdTech platform designed to help lecturers, departments, and institutions manage the full assessment workflow — from assignment creation and submission handling to AI-assisted marking, academic integrity review, at-risk student identification, and targeted intervention tracking.

Built for universities and schools, GradeAI combines assessment automation with explainable academic analytics to make grading faster, support more consistent feedback, and help educators act earlier when students need support.

> Live deployment: [https://edu-intel-spark.pages.dev](https://edu-intel-spark.pages.dev)

---

## Vision

GradeAI exists to make assessment more intelligent, more scalable, and more human.

The platform is built around a simple idea:

- lecturers should spend less time on repetitive marking admin
- students should receive clearer and more actionable feedback
- institutions should be able to spot risk earlier and intervene more effectively

Rather than acting as a black-box grading tool, GradeAI is designed as an **academic workflow platform** — combining AI assistance with explainable scoring, lecturer oversight, and structured student support.

---

## Core Product Value

GradeAI brings together five major workflows in one platform:

### 1. AI-Assisted Marking
Lecturers can create assignments, define rubrics, receive AI-generated scores and feedback, review results, override where necessary, and release final grades.

### 2. Academic Intelligence
The platform aggregates grading, submission, and performance data into dashboards that highlight trends, workload, performance bands, and at-risk students.

### 3. Student Risk Detection
GradeAI identifies students who may require support using explainable, rule-based academic indicators such as submission rate, grade patterns, and completion consistency.

### 4. Academic Integrity Review
The system surfaces suspicious submissions and gives lecturers a structured way to inspect potential issues, review evidence, and make human decisions.

### 5. Intervention Tracking
Once a student is identified as at-risk, lecturers can record interventions, set follow-up dates, add notes, and track ongoing support actions.

---

## What the Platform Does

### Lecturer Workflow
- Create assignments with title, description, module code, due date, and max score
- Build weighted rubrics for structured assessment
- Upload or receive student submissions
- Run AI-assisted grading against assignment rubrics
- Review AI-generated breakdowns and feedback
- Approve and release final grades
- View recent submissions, performance summaries, and grade distributions
- Identify students who may need intervention
- Review academic integrity signals
- Track interventions and follow-up actions

### Student Workflow
- View released grades and feedback
- See criterion-level performance
- Use “Explain My Grade” support features
- Receive improvement guidance and next-step recommendations
- Track academic progress over time

### Institutional / Analytics Workflow
- Monitor submission and grading activity
- Review cohort-level performance patterns
- Inspect risk and support indicators
- Support moderation, reporting, and external review use cases
- Generate exports for academic and administrative workflows

---

## Current Product Areas

### Assignment Management
GradeAI supports a full assignment lifecycle:
- draft
- published
- closed

Lecturers can define the assessment structure and use rubrics to create a more consistent and transparent marking process.

### Submission Workflow
Student work moves through a structured pipeline:

`Submitted → AI Grading → AI Graded → Under Review → Approved → Released`

This makes the assessment process visible and manageable for both staff and students.

### Lecturer Dashboard
The lecturer overview is designed as an action dashboard, not just a reporting screen. It surfaces:
- active students
- submissions awaiting review
- grade distributions
- recent submission activity
- at-risk student signals
- links into the most important next actions

### At-Risk Detection
GradeAI uses an explainable rule-based scoring approach to identify students who may require support. Rather than using a black-box model too early, the system emphasises:
- clarity
- auditability
- trust
- easy interpretation by lecturers and institutions

### Intervention Tracking
A new intervention workflow is being introduced so lecturers can move from “insight” to “action.” This includes:
- intervention type
- notes
- priority
- follow-up date
- status tracking
- ongoing support history

### Academic Integrity
The integrity workflow is intended to support human review rather than automated accusation. It is being developed toward:
- flagged submission evidence
- review decisions
- distinction between AI-writing suspicion and similarity concerns
- lecturer review history

---

## Why the Risk Model Is Rule-Based

GradeAI currently uses a **rule-based academic risk model** rather than a machine learning model.

This is a deliberate product and engineering decision.

In early-stage academic systems, labelled student outcome data is often limited. Under those conditions, a deterministic, explainable model is often more appropriate than an undertrained predictive model.

The current approach focuses on interpretable indicators such as:
- submission behaviour
- academic performance
- performance consistency
- grade trend patterns

This makes the system:
- explainable
- auditable
- institution-friendly
- suitable for early-stage deployment and trust-building

As the platform matures and more historical data becomes available, the scoring engine can evolve toward more advanced predictive models.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui |
| Routing | React Router |
| Data / Backend | Supabase |
| Authentication | Supabase Auth |
| Storage | Supabase Storage |
| Server Logic | Supabase Edge Functions |
| Analytics | PostHog |
| Charts / Visualisation | Recharts |
| PDF / Export | jsPDF |
| Hosting | Cloudflare Pages |
| Version Control | GitHub |

---

## Project Structure

```text
src/
  components/         Reusable application components
  components/ui/      Shared UI primitives
  contexts/           App context providers
  hooks/              Custom hooks
  integrations/       Supabase client and generated types
  lib/                Utilities and shared logic
  pages/
    dashboard/        Lecturer and student dashboard pages

supabase/
  functions/          Edge functions for grading and analysis
  migrations/         Database migrations

public/
  Static assets
