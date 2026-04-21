# GradeAI

**An academic intelligence platform for higher education assessment workflows.**

GradeAI helps universities manage the full assessment cycle in one connected system: assignment design, student submission, AI-assisted grading, integrity review, moderation, release, analytics, and student support. The platform is built around a simple principle: AI does the analytical heavy lifting, but lecturers keep control of every academic decision.

Live deployment:
- `https://edu-spark.pages.dev`

## What GradeAI Does

GradeAI is designed for real academic workflows rather than isolated AI demos. It brings together:
- assignment setup and rubric design
- structured AI-assisted grading
- lecturer review, approval, and release controls
- citation-aware academic integrity analysis
- moderation and audit trails
- cohort analytics and AI recommendations
- student risk tracking and interventions
- student-facing feedback, improvement planning, and AI tutoring

The result is a platform that saves time without turning marking into a black box.

## Who Uses It

### Lecturers
Lecturers create assignments, build rubrics, run AI grading, review results, investigate integrity concerns, manage moderation, release grades, and support students who need intervention.

### Students
Students submit work, view released grades and rubric-linked feedback, follow improvement plans, and use the Socratic AI tutor to better understand their performance.

### Programme leads, quality teams, and external examiners
Institutional users can review cohort trends, accreditation evidence, moderation records, audit history, and exportable assessment data.

## Lecturer Experience

### Overview Dashboard
The lecturer dashboard is organised around the assessment lifecycle and shows live data from the connected backend.

It includes:
- active assignment counts
- submissions awaiting review
- released grade counts
- recent activity snapshots
- quick access to assignments, moderation, analytics, and integrity review

### Assignments
Lecturers can create and manage assignments with:
- title, description, module code, due date, and maximum score
- weighted rubric criteria with names, descriptions, and percentages
- draft or published assignment state

Within an assignment, lecturers can:
- see all submissions with timestamps and workflow status
- open uploaded files using secure signed URLs
- batch-run AI grading
- batch-run integrity checks
- review, approve, and release results

### AI-Assisted Grading
AI grading is rubric-based and explainable. For each submission, the platform returns:
- an overall score
- detailed student-facing feedback
- criterion-by-criterion scoring
- evidence-backed grading metadata
- confidence indicators that help decide when human review is needed

The grading workflow is designed to support lecturer judgement, not replace it.

### Review, Approve, Release
Grades move through a controlled pipeline before students see them:

`submitted -> ai_grading -> ai_graded -> under_review / first_review -> approved -> released`

Moderated work can also move through:

`moderation_pending -> moderation_in_progress -> moderated / escalated`

This means:
- students do not see provisional AI output
- lecturers can edit marks and feedback before approval
- moderated grades remain under lecturer control
- nothing is auto-released

### Academic Integrity
Integrity analysis runs alongside grading and is designed as decision support rather than automated accusation.

The system currently supports:
- student-to-student similarity review within an assignment
- external-source style overlap analysis
- AI-writing suspicion scoring
- writing-baseline deviation checks
- persisted lecturer review history

Recent integrity improvements make the system more academically fair and easier to interpret:
- reference sections such as `References`, `Bibliography`, and `Works Cited` are excluded from overlap scoring
- quoted and cited material is identified and downweighted instead of being treated like uncited copying
- overlap is split into:
  - `total_overlap`
  - `cited_overlap`
  - `uncited_overlap`
  - `internal_peer_overlap`
  - `external_source_overlap`
- evidence is grouped for lecturers into uncited matches, cited material, peer matches, and external matches

PDF handling has also been improved:
- the extraction pipeline now pulls readable body text from PDF text operators rather than relying on raw printable binary fragments
- PDF artefacts such as object streams and metadata are stripped before scoring
- low-quality extraction is explicitly detected
- if a PDF is dominated by unreadable artefacts, the case is marked as **analysis limited** rather than being shown as a misleading normal low-risk result

### Moderation
Moderation extends the grading workflow without replacing it.

When current grading and integrity signals suggest a second review is needed, the platform can open a moderation case. Typical triggers include:
- low grading confidence
- integrity concerns
- borderline marks
- large gaps between AI and lecturer scores
- maths derivation or solver-signature concerns

The moderation workflow provides:
- a moderation queue/dashboard
- case status tracking
- first marker and moderator actions
- agreed score recording
- audit history for changes and decisions

Moderator actions include:
- agree
- adjust
- return
- escalate
- approve

### Cohort Analytics and AI Recommendations
GradeAI includes analytics views for lecturers and programme teams:
- grade distribution
- assignment comparison
- performance trends
- student risk clustering
- integrity signal monitoring

On top of those analytics, the platform now generates explainable, rule-based AI recommendations for lecturers. These are not black-box predictions. They are deterministic recommendations derived from real cohort data.

Recommendation categories include:
- performance
- trends
- rubric weakness
- student risk
- integrity alerts
- positive signals

Examples of recommendations:
- low cohort average
- high failure rate
- significant score drop between assignments
- weak rubric criterion
- high-risk student cluster
- integrity spike

Recommendations can be reviewed, dismissed, or turned into interventions, and their state is persisted across reloads.

### Student Risk and Interventions
The platform tracks student risk using explainable academic indicators rather than opaque machine learning scores.

Lecturers can:
- open student profiles
- record interventions
- set priorities and follow-up dates
- store notes and support actions
- create interventions directly from cohort recommendations

This gives departments a clear record of support activity, not just a risk number.

### Bulk Onboarding
Lecturers can upload a CSV to create a cohort of student accounts in one flow. The system:
- parses the CSV
- reviews the incoming records
- creates student accounts through a backend function
- provides a downloadable credentials file for distribution

This avoids manual account creation one student at a time.

## Student Experience

The student side of GradeAI is intentionally simpler.

### Submitting Work
Students can:
- see assignments that are currently open
- upload their work directly to secure storage
- submit once per assignment

### Viewing Grades
Once a lecturer releases a result, the student can view:
- the final score
- rubric-linked breakdowns
- lecturer-approved feedback

Students do not see provisional grades still under review.

### Explain My Grade
This feature gives students a guided explanation of their result through a Socratic AI tutor.

The tutor:
- is grounded in the student’s own submission and rubric
- asks guiding questions rather than giving direct answers
- does not generate model answers or rewrite work for the student

### Improvement Plan
Each student has a persisted improvement-plan view with trackable actions and progress across sessions.

## Institutional and Quality Features

GradeAI is designed to work within formal academic processes.

### Audit and Defensibility
The platform keeps an audit trail for meaningful actions such as:
- grading changes
- approval and release changes
- integrity review decisions
- moderation actions
- intervention records

This helps answer questions like:
- who changed the grade?
- what evidence was reviewed?
- why was a case escalated or cleared?

### Accreditation and External Examiner Workflows
Institutional views support:
- accreditation evidence review
- programme-level insight
- external examiner exports
- cross-module assessment reporting

## Screenshots

| Lecturer Dashboard | Overview Dashboard |
|---|---|
| ![Lecturer Dashboard](docs/screenshots/lecturer-dashboard-overview.jpg) | ![Overview Dashboard](docs/screenshots/overview-dashboard.jpg) |

| Cohort Analytics | Grade Distribution |
|---|---|
| ![Cohort Analytics](docs/screenshots/cohort-analytics-dashboard.jpg) | ![Grade Distribution](docs/screenshots/grade-distribution-analytics.jpg) |

| Predictive Risk Analytics | Student Improvement Plan |
|---|---|
| ![Predictive Risk Analytics](docs/screenshots/predictive-risk-analytics.jpg) | ![Student Improvement Plan](docs/screenshots/student-improvement-plan.jpg) |

| AI Grade Explanation |
|---|
| ![AI Grade Explanation](docs/screenshots/ai-grade-explanation.jpg) |

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
| Analytics | Recharts + PostHog |
| Export | jsPDF |
| Hosting | Cloudflare Pages |
| Version Control | GitHub |

## Important Edge Functions

Current backend workflows rely on Supabase Edge Functions such as:
- `grade-submission`
- `check-plagiarism`
- `explain-grade`
- `student-ai-tutor`
- `bulk-create-students`

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
  functions/          Edge functions for grading, integrity, and tutoring
  migrations/         Database migrations

public/
  Static assets
```

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

### 4. Build for production

```bash
npm run build
```

## Supabase Requirements

The main workflows expect the backend to provide, at minimum:
- `assignments`
- `submissions`
- `grades`
- `profiles`
- `user_roles`
- `student_interventions`
- `academic_integrity_reviews`
- `improvement_plan_progress`
- `communication_messages`
- `moderation_cases`
- `moderation_reviews`
- `grade_audit_log`
- `analytics_recommendations`
- `recommendation_actions`

The project also expects:
- a `submissions` storage bucket
- the required edge functions deployed to the same Supabase project

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

## Product Philosophy

Three principles shape the platform:
- lecturer oversight first
- explainability over magic
- institution-friendly workflows

GradeAI is built to accelerate repetitive academic work while keeping academic judgement, accountability, and final authority with educators.

## Notes

- Integrity analysis is decision support, not proof of misconduct.
- Strong writing alone is not treated as evidence of AI use.
- Properly cited material remains visible to lecturers but is treated differently from uncited overlap.
- Poor PDF extraction is surfaced as a limited analysis state rather than a false clean result.
- Moderation is additive to grading; it does not replace lecturer authority.

## License

Private project unless otherwise specified by the repository owner.
