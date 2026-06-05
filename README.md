# GradeAI

[![CI](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml/badge.svg)](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml)

GradeAI helps institutions identify students at risk of disengagement or underperformance early, so tutors and academic leads can intervene sooner. It works alongside existing systems and uses machine learning to monitor grades, submissions, and engagement over time.

The aim is to improve retention, support student success, and provide evidence for effective intervention. GradeAI is not a replacement for the LMS or a black-box decision system. Academic judgement stays with educators.

## At a Glance

- connects assignments, submissions, grading, integrity, moderation, and intervention records
- supports AI-assisted grading, but keeps approval and release with the lecturer
- monitors grade, submission, and engagement patterns to flag risk early
- gives tutors, course leaders, and heads of department a cohort view
- records interventions and exports evidence for institutional reporting

AI output is not treated as the final academic decision. Students only see feedback after educator review and release.

## Demo Mode

GradeAI includes a synthetic demo mode for reviewer walkthroughs and product evaluation. It uses fabricated assignments, rubrics, submissions, grades, integrity examples, and feedback, and keeps demo paths isolated from real Supabase academic data.

## Key Product Areas

### Educator workspace

Educators can identify students who may be struggling, review why they were flagged, create assignments, run AI-assisted grading and integrity checks, edit marks and feedback, manage moderation cases, and record intervention or follow-up actions.

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
