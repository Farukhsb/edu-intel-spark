# GradeAI

[![CI](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml/badge.svg)](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml)

GradeAI helps institutions identify students at risk of disengagement or underperformance early, so tutors and academic leads can intervene sooner. It works alongside existing systems and uses machine learning to monitor grades, submissions, and engagement over time.

The aim is to improve retention, support student progress, and provide evidence for effective intervention. GradeAI is not a replacement for the LMS or a black-box decision system. Academic judgement stays with educators.

## At a Glance

- monitors grade, submission, and engagement patterns to flag risk early
- gives tutors, course leaders, and heads of department a cohort view
- records interventions and exports evidence for institutional reporting
- keeps AI-assisted grading available where institutions want it, without making it the product focus

AI output is not treated as the final academic decision. Students only see feedback after educator review and release.

## Demo Mode

GradeAI includes a synthetic demo mode for reviewer walkthroughs and product evaluation. It uses fabricated assignments, rubrics, submissions, grades, integrity examples, and feedback, and keeps demo paths isolated from real Supabase academic data.

## Key Product Areas

### Staff workspace

Tutors and academic leads can identify students who may be struggling, review why they were flagged, manage follow-up actions, and record intervention evidence.

### Synthetic test view

Learners can submit work for open assignments, view released grades, and read educator-approved feedback in the demo and live test surface.

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
