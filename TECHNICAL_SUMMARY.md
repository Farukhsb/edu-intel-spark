# GradeAI - Academic Intelligence Platform

## 1. Problem

University marking is slow, inconsistent, and hard to audit at scale.

Lecturers often have to balance large submission volumes, rubric-based grading, moderation requirements, academic integrity review, and student feedback release under time pressure. In many workflows, the final mark is visible, but the process behind it is not.

## 2. Solution

GradeAI is an AI-assisted assessment platform that supports marking without removing lecturer control.

The system helps with:
- rubric-based scoring
- evidence-backed feedback
- integrity flagging
- moderation support
- lecturer review before approval and release

The goal is not to replace academic judgement. The goal is to reduce repetitive work and make the grading process more consistent and easier to inspect.

## 3. Architecture

High-level flow:

```text
React frontend
  -> Supabase Auth / Database / Storage
  -> Edge Functions
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

## 4. Key Innovations

- Structured grading pipeline rather than a single black-box score
- Criterion-level scoring with evidence and confidence signals
- Fairness validation and recalibration when score and feedback conflict
- Deterministic caching for unchanged grading inputs
- Integrity analysis that separates structural overlap from meaningful content similarity
- Lecturer override, moderation support, and audit history

## 5. Technical Stack

- Frontend: React, TypeScript, Vite
- Backend platform: Supabase
- Database: Postgres
- Storage: Supabase Storage
- Server logic: Supabase Edge Functions
- AI integration: OpenAI API
- Testing: Vitest, Testing Library, Playwright

## 6. My Contribution

Built and integrated the main application workflow, including:
- assignment and submission handling
- AI grading pipeline
- fairness and consistency controls
- plagiarism and integrity review flow
- lecturer review and moderation support
- validation and safety improvements across Edge Function boundaries
- frontend dashboard and reporting flows

## 7. Impact

Even in its current state, the platform shows practical value:
- reduces lecturer marking workload
- improves grading consistency
- makes AI-generated decisions easier to explain
- keeps a human approval step before grades are released
- creates a clearer audit trail for review, moderation, and integrity decisions
