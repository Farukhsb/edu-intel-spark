# GradeAI — Academic Insights Hub

**AI-Powered Academic Marking & Intelligence Platform**

GradeAI is a full-stack, production-ready EdTech platform that uses AI to automate academic marking, detect academic integrity issues, and help students improve their grades through Socratic AI coaching. Built for universities and secondary schools.

> Live demo: [edu-intel-spark.lovable.app](https://edu-intel-spark.lovable.app)

---

## 🌟 Vision

To bridge the gap between education and technology — making assessment fairer, faster, and more personalised. GradeAI gives lecturers AI-assisted marking they can trust, and gives students the feedback they need to genuinely improve.

---

## ✅ What's Built & Working

### 🔐 Authentication & User Management
- **Firebase Authentication** — Email/password sign-up & sign-in with role selection (lecturer / student)
- **Role-Based Access Control** — Separate dashboards and permissions for lecturers and students
- **Bulk Student Upload** — CSV import to create multiple student accounts at once with validation and error reporting
- **User Profiles** — Role-based profiles with avatar support
- **PWA Support** — Installable as a Progressive Web App on desktop and mobile

### 📝 Assignment Management
- **Assignment Creation** — Lecturers create and publish assignments with title, description, module code, due date, and max score
- **Rubric Builder** — Weighted marking criteria builder for structured, consistent grading
- **Assignment Lifecycle** — Draft → Published → Closed status management
- **File Attachments** — Attach reference materials to assignments

### 📤 Submission Handling
- **Single File Upload** — Students or lecturers upload submissions (PDF, DOCX, TXT, code files)
- **Bulk Upload Submissions** — Upload multiple student PDFs/documents at once for batch processing
- **Student Mapping** — Student name and email tracked per submission
- **Submission Pipeline** — Visual status tracking: `Submitted → AI Grading → AI Graded → Under Review → Approved → Released`

### 🤖 AI-Powered Grading
- **AI Marking Engine** — Grades submissions against rubric criteria with detailed criterion-by-criterion score breakdowns
- **AI Feedback Generation** — Detailed written feedback per submission
- **Batch AI Grading** — Select multiple submissions and grade them all at once
- **Timeout Indicator** — Shows estimated time remaining during AI grading so lecturers know it's still working
- **Real-time Updates** — Firestore onSnapshot listeners for live data across all pages

### 👨‍🏫 Lecturer Review Workflow
- **Review Dialog** — Adjust AI-generated score, edit or rewrite feedback before finalising
- **Approve** — Finalise the grade (keeps AI score if unchanged, or uses lecturer override)
- **Release** — Send final grades to students with a single click
- **Score Consistency** — Always displays the most recent grade record across all views

### 🔍 Plagiarism & Academic Integrity
- **AI-Content Detection** — Checks for AI-generated writing patterns (works on single submissions)
- **Similarity Checking** — Cross-submission comparison (works with 1+ submissions)
- **Academic Integrity Dashboard** — Overview of flagged submissions and integrity scores

### 📊 Analytics & Insights
- **Lecturer Overview Dashboard** — KPI cards, grade distribution charts, recent submissions, at-risk student counts
- **Student Grades View** — Personal grade cards with UK degree classification (1st, 2:1, 2:2, 3rd) and percentage breakdowns
- **Cohort Analytics** — Performance trends, grade distributions, learning outcomes, AI recommendations
- **Performance Trends** — Assessment timeline, engagement heatmap, at-risk student list
- **Institutional Insights** — Department comparisons, low-performing assessments, accreditation readiness (NSS, employment rates)
- **Learning Outcomes** — Alignment with educational objectives
- **Student Profile** — Individual student performance view

### 🧠 Student Support
- **Explain My Grade (AI Chat)** — Streaming chat assistant that explains grades with actionable improvement tips
- **Socratic Improvement Coach** — AI guides students to improve using questions, not just answers
- **Improvement Plan** — Student task checklists with AI-curated recommended resources

---
## 🧠 Engineering Decisions

### Why rule-based at-risk scoring instead of machine learning?

In the early stages of the platform, the available dataset is relatively small and lacks sufficiently labelled outcomes. Under these conditions, a deterministic, rule-based model provides more reliable and stable performance than an undertrained machine learning model.

The current scoring system uses a weighted formula based on:
- Submission rate  
- Grade trend  
- Average performance  
- Completion consistency  

This approach was deliberately chosen because it is:
- **Fully interpretable** — educators can clearly understand why a student is flagged  
- **Auditable** — important for academic accountability and institutional trust  
- **Deterministic** — ensures consistent outputs without model variance  

### Scalability Path

The system is designed with modularity in mind. As the platform scales and accumulates labelled data (e.g. pass/fail outcomes, intervention effectiveness), the scoring engine can be replaced with a supervised learning model.

This allows a smooth transition from:
> Rule-based system → Data-driven ML model

without requiring a redesign of the surrounding architecture.

### Design Principle

The platform prioritises **explainability over complexity** in its early stages, ensuring that all outputs can be trusted and validated by non-technical stakeholders before introducing more complex models.


---


## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite 5 |
| Styling | Tailwind CSS v3 + shadcn/ui |
| Database | Supabase Supastore |
| Authentication | Firebase Auth |
| File Storage | Supabase Storage + Firebase Storage |
| AI Engine | Anthropic Claude (via Supabase Edge Functions) |
| Backend Functions | Supabase Edge Functions |
| Analytics | PostHog |
| Hosting | Cloudflare |
| Version Control | GitHub |

---

## 📂 Project Structure

```
/src
  /components       # Reusable UI components (RubricBuilder, BulkStudentUpload, NetworkStatus, etc.)
  /components/ui    # shadcn/ui design system components
  /contexts         # React context providers (AuthContext)
  /hooks            # Custom React hooks
  /integrations     # Supabase client and types
  /lib              # Firebase config, PostHog, utilities
  /pages            # Route pages
    /dashboard      # All dashboard pages (lecturer + student views)
/supabase
  /functions        # Edge functions (grade-submission, check-plagiarism, explain-grade)
/public             # Static assets
```

---

## 🚀 Roadmap

**Phase 1 — Prototype** ✅ Complete
- Market analysis and requirement definition
- Interactive prototype with simulated data

**Phase 2 — Production Build** ✅ Complete
- Firebase backend integration
- Real AI marking with Claude
- Role-based authentication
- Full grading workflow
- Lecturer review, approve, and release pipeline
- Bulk student onboarding via CSV

**Phase 3 — Pilot Ready** 🔄 In Progress
- Connect all analytics pages to live Firestore data
- Password reset flow
- Email notifications for submissions and grade releases
- Landing page and demo mode for investors

**Phase 4 — Scale**
- Firebase Cloud Functions
- Predictive at-risk detection models
- LMS integrations (Moodle, Canvas, Blackboard)
- Multi-institution support

---

## 🔐 Security

- Firestore Security Rules enforce role-based data access
- Students can only access their own submissions and grades
- Lecturers have read access to all submissions within their modules
- Supabase RLS policies protect database tables with row-level security
- All AI processing happens server-side via edge functions
- No student data is stored beyond what is necessary for the platform

---

## 👨‍💻 Built By

This project showcases an AI-augmented technical workflow, where I served as the Lead Architect and Product Engineer. I managed the full-stack development, cloud orchestration (Firebase/Supabase), and the design of the proprietary Socratic feedback logic.

---

## 📄 Licence

MIT — see [LICENSE](LICENSE) for details.
