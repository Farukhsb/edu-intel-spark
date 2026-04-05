# GradeAI — Academic Insights Hub

**AI-Powered Academic Marking & Intelligence Platform**

GradeAI is a full-stack, production-ready EdTech platform that uses Claude AI to automate academic marking, detect academic integrity issues, and help students improve their grades through Socratic AI coaching. Built for universities and secondary schools.

> Live demo: [edu-intel-spark.lovable.app](https://edu-intel-spark.lovable.app)

---

## 🌟 Vision

To bridge the gap between education and technology — making assessment fairer, faster, and more personalised. GradeAI gives lecturers AI-assisted marking they can trust, and gives students the feedback they need to genuinely improve.

---

## ✅ What's Built & Working

### Core Platform
- **Firebase Authentication** — Email/password sign-up & sign-in with role selection (lecturer / student)
- **Role-Based Access Control** — Separate dashboards and permissions for lecturers and students
- **Real-time Updates** — Firestore onSnapshot listeners for live data across all pages
- **PWA Support** — Installable as a Progressive Web App on desktop and mobile

### AI-Powered Features (Powered by Claude)
- **AI Marking Engine** — Grades student submissions against lecturer-uploaded rubrics with detailed criterion-by-criterion breakdowns
- **Grading Workflow** — Full state-based pipeline: `submitted → ai_grading → ai_graded → under_review → approved → released`
- **Lecturer Grade Review** — Lecturers can override AI scores and feedback before releasing to students
- **Plagiarism & Integrity Detection** — AI-powered similarity and AI-content analysis across submissions
- **Explain My Grade (AI Chat)** — Streaming chat assistant that explains grades with actionable improvement tips
- **Socratic Improvement Coach** — AI guides students to improve using questions, not just answers

### Assignment Management
- **Assignment Creation** — Lecturers create and publish assignments with rubrics, due dates, and module codes
- **Rubric Builder** — Weighted marking criteria builder for structured, consistent grading
- **File Upload** — Student submissions and bulk lecturer uploads via Firebase Storage
- **Grade Release** — Batch approve and release grades to students

### Analytics & Insights
- **Lecturer Dashboard** — KPI cards, grade distribution charts, recent submissions, at-risk student counts
- **Student Grades View** — Personal grade cards with UK degree classification (1st, 2:1, 2:2, 3rd) and percentage breakdowns
- **Cohort Analytics** — Performance trends, grade distributions, learning outcomes, AI recommendations
- **Performance Trends** — Assessment timeline, engagement heatmap, at-risk student list
- **Institutional Insights** — Department comparisons, low-performing assessments, accreditation readiness (NSS, employment rates)
- **Academic Integrity Dashboard** — AI-content detection scores, flagged submission overview
- **Improvement Plan** — Student task checklists with AI-curated recommended resources
- **PostHog Analytics** — User identification and event tracking

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Firebase Firestore |
| Authentication | Firebase Auth |
| File Storage | Firebase Storage |
| AI Engine | Anthropic Claude (claude-sonnet) |
| Analytics | PostHog |
| Hosting | Lovable (lovable.app) |
| Version Control | GitHub |

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

**Phase 3 — Pilot Ready** 🔄 In Progress
- Connect all analytics pages to live Firestore data
- Password reset flow
- Email notifications for submissions and grade releases
- Bulk student upload via CSV
- Firestore security rules ✅ Done
- Landing page and demo mode for investors

**Phase 4 — Scale**
- Firebase Cloud Functions
- Predictive at-risk detection models
- LMS integrations (Moodle, Canvas, Blackboard)
- Multi-institution support

---

## 📂 Project Structure

```
/src
  /components       # Reusable UI components including RubricBuilder
  /pages            # All dashboard pages (lecturer + student views)
  /lib              # Firebase config and utility functions
  /hooks            # Custom React hooks
/supabase           # Legacy (migrated to Firebase)
/public             # Static assets
```

---

## 🔐 Security

- Firestore Security Rules enforce role-based data access
- Students can only access their own submissions and grades
- Lecturers have read access to all submissions within their modules
- All AI processing happens server-side via edge functions
- No student data is stored beyond what is necessary for the platform

---

## 👨‍💻 Built By

Faruk Abdullahi — founder of GradeAI, applying for the UK Global Talent Visa (Tech Nation — Digital Technology).

This project demonstrates exceptional technical ability in AI product development, full-stack engineering, and EdTech innovation.

---

## 📄 Licence

MIT — see [LICENSE](LICENSE) for details.
