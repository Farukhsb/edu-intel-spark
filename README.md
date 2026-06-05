# GradeAI

[![CI](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml/badge.svg)](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml)

GradeAI is an academic risk intelligence platform for higher education and wider education settings. It helps lecturers, teachers, tutors, and institutions surface academic risk earlier by turning assessment activity, grading signals, integrity review, moderation, feedback release, cohort analytics, and intervention workflows into one connected picture.

The platform is built on a simple premise: academic risk is easier to understand when assessment, feedback, integrity signals, and support actions are connected instead of scattered across separate tools. AI helps prepare evidence, summaries, and draft grading output, while academic judgement stays firmly with educators.

GradeAI is not a black-box auto-grading tool. It is designed to help educators see problems earlier, understand what is driving them, and act with more confidence through reviewable, evidence-led workflows.

## Core Loop

```text
student submits work
  -> assessment signals are extracted
  -> academic risk is identified
  -> lecturer reviews the evidence
  -> intervention or moderation action is taken
  -> student progress is tracked over time
```

This is the product loop GradeAI is built around: assessment evidence becomes risk intelligence, and risk intelligence becomes timely educator-led action.

## Why This Exists

Struggling students are often identified too late. The warning signs may already be there: missed submissions, falling marks, repeated weaknesses against rubric criteria, poor completion patterns, or low engagement. In many institutions, those signals sit across different systems and are only reviewed after a student has already failed, disengaged, or withdrawn.

Assessment is central to this problem because it creates some of the clearest evidence of student progress. But marking, feedback, moderation, academic integrity review, analytics, and intervention records are often disconnected.

GradeAI brings these parts together. The aim is not to automate academic judgement. The aim is to give educators clearer evidence and a more connected workflow for earlier support.

## Where GradeAI Fits

GradeAI is built for education workflows where assessment, feedback, moderation, integrity, analytics, and intervention need to sit in one place. It can be used in universities, colleges, training providers, and other settings with similar workflows.

The main idea is simple: keep the institution in control of the data, keep academic judgement with staff, and make the evidence easier to act on.

## What GradeAI Does

### What GradeAI does

- connects assignments, submissions, grading, integrity, moderation, and intervention records
- supports AI-assisted grading, but keeps approval and release with the lecturer
- imports existing grades from CSV or image on the lecturer overview page
- links imported grades back to assignments so analytics update from the same data
- gives admins reporting views for oversight, accreditation, and external examiner export

### Workflow notifications

- in-app workflow notifications
- backend email notification infrastructure exists for assignment, submission, and grade-release events
- live app flows are currently bell-first, with workflow email dispatch disabled until sender and provider setup are intentionally re-enabled

### Academic risk scoring

GradeAI includes a lightweight risk-scoring model that looks at a student's recent assessment pattern rather than relying on one mark. It returns a simple risk band: `low`, `medium`, or `high`, alongside a confidence score and review reasons when the pattern is uncertain.

The current model is a bootstrap version trained on synthetic benchmark data. It is useful for demos, product testing, and showing how the risk workflow works. For real institutional use, it should be checked, calibrated, or retrained using the institution's own historical assessment data.

The risk score is decision support only. It is not a final decision about a student, and staff remain responsible for reviewing the evidence before taking action.

## How The Workflow Fits Together

```text
submission
  -> assessment evidence
  -> document extraction
  -> AI-assisted grading
  -> integrity and confidence signals
  -> educator review
  -> moderation if required
  -> approval
  -> release
  -> student explanation and feedback
  -> analytics and academic risk intelligence
  -> intervention / follow-up
```

AI output is not treated as the final academic decision. Students only see feedback after it has passed through the educator review and release workflow.

Weak or unreadable PDFs fail closed during the live pilot so they do not produce misleading grades. A separate Docling-based extraction service has been evaluated for future asynchronous PDF processing, but it is not enabled as a synchronous grading dependency in the live pilot.

## Platform Preview

### Lecturer overview

![Lecturer dashboard overview](docs/screenshots/lecturer-dashboard-overview.jpg)

### Analytics and insight

![Cohort analytics dashboard](docs/screenshots/cohort-analytics-dashboard.jpg)

![Grade distribution analytics](docs/screenshots/grade-distribution-analytics.jpg)

### Student support and explainability

![Student improvement plan](docs/screenshots/student-improvement-plan.jpg)

![AI grade explanation](docs/screenshots/ai-grade-explanation.jpg)

## Demo Mode

GradeAI includes a synthetic demo mode for reviewer walkthroughs and product evaluation.

Demo mode:

- uses fabricated assignments, rubrics, submissions, grades, integrity examples, and feedback
- does not rely on live academic records for demo assignment-set workflows
- keeps demo assignment, submission, grading, and feedback paths isolated from real Supabase academic data

Reusable synthetic assignment sets are used to demonstrate assignment briefs, rubric setup, AI-facing grading context, sample feedback, integrity review, and moderation examples.

For real lecturers or teachers, sample assignment templates can prefill the assignment form, but they do not auto-create submissions, grades, integrity cases, or moderation records.

## Key Product Areas

### Educator workspace

Educators can identify students who may be struggling, review why a student or assessment has been flagged, create assignments, run AI-assisted grading and integrity checks, edit marks and feedback, manage moderation cases, and record intervention or follow-up actions.

### Student workspace

Students can submit work for open assignments, view released grades, read educator-approved feedback, use support tools to understand their performance, and track improvement-plan progress.

### Institutional workflows

GradeAI also supports admin oversight, accreditation-style reporting, external examiner export workflows, moderation history, audit trails, and cohort-level performance insight.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui, Radix UI, lucide-react |
| Backend | Supabase |
| Auth | Supabase Auth |
| Database | Postgres with Row-Level Security |
| Storage | Supabase Storage |
| Server logic | Supabase Edge Functions |
| Charts | Recharts |
| Product analytics | PostHog |
| Error monitoring | Sentry |
| Hosting | Cloudflare Pages |
| Testing | Vitest, Testing Library, Playwright |
| CI | GitHub Actions |
