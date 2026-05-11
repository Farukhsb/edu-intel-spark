import type { NSSMetric, ProgrammeReport, QAAMetric, TEFIndicator } from "@/lib/accreditationMetrics";

export const DEMO_QAA_METRICS: QAAMetric[] = [
  {
    id: "criteria-transparency",
    category: "Assessment Design",
    metric: "Assessment Criteria Transparency",
    value: 100,
    target: 100,
    status: "met",
    detail: "4/4 demo assignments include published rubrics and marking criteria",
  },
  {
    id: "feedback-turnaround",
    category: "Feedback Quality",
    metric: "Feedback Turnaround (<=15 days)",
    value: 92,
    target: 90,
    status: "met",
    detail: "11/12 demo submissions were graded within 15 days (avg: 8 days)",
  },
  {
    id: "moderation",
    category: "Quality Assurance",
    metric: "Moderation Evidence",
    value: 83,
    target: 100,
    status: "at-risk",
    detail: "10/12 demo grades include lecturer review or moderation evidence",
  },
  {
    id: "pass-rate",
    category: "Student Outcomes",
    metric: "Module Pass Rate",
    value: 84,
    target: 75,
    status: "met",
    detail: "10/12 demo students achieved a passing mark",
  },
  {
    id: "completion",
    category: "Student Engagement",
    metric: "Assessment Completion Rate",
    value: 88,
    target: 85,
    status: "met",
    detail: "12 demo submissions across 4 assignments indicate strong participation",
  },
  {
    id: "grade-release",
    category: "Feedback Quality",
    metric: "Grade Release Rate",
    value: 75,
    target: 95,
    status: "below",
    detail: "9/12 demo grades have been released to students",
  },
  {
    id: "graded",
    category: "Quality Assurance",
    metric: "Graded Submissions",
    value: 100,
    target: 95,
    status: "met",
    detail: "All 12 demo submissions have grading records",
  },
  {
    id: "avg-score",
    category: "Student Outcomes",
    metric: "Average Assessment Score",
    value: 64,
    target: 55,
    status: "met",
    detail: "Mean score across the current demo grading sample",
  },
];

export const DEMO_NSS_METRICS: NSSMetric[] = [
  { question: "Assessment criteria are clear in advance", score: 91, benchmark: 78, trend: "+13%" },
  { question: "Feedback has been timely", score: 76, benchmark: 72, trend: "+4%" },
  { question: "Feedback has helped clarify things", score: 73, benchmark: 75, trend: "-2%" },
  { question: "The course is well organised", score: 82, benchmark: 77, trend: "+5%" },
  { question: "Assessment is fair", score: 84, benchmark: 80, trend: "+4%" },
  { question: "Overall satisfaction with quality", score: 79, benchmark: 80, trend: "-1%" },
];

export const DEMO_TEF_INDICATORS: TEFIndicator[] = [
  {
    name: "Teaching Quality",
    rating: "gold",
    score: 85,
    detail: "Rubric clarity and assignment design are consistently strong across the demo dataset.",
  },
  {
    name: "Student Outcomes",
    rating: "silver",
    score: 72,
    detail: "Pass rates are healthy, but the distribution shows scope to strengthen top-band performance.",
  },
  {
    name: "Assessment & Feedback",
    rating: "silver",
    score: 69,
    detail: "Feedback is timely overall, with moderation and release consistency as the main improvement area.",
  },
  {
    name: "Student Engagement",
    rating: "gold",
    score: 83,
    detail: "Submission and grading completion rates indicate strong student engagement in the sample workflow.",
  },
];

export const DEMO_FEEDBACK_TURNAROUND = { avg: 8, target: 15, compliant: 11, total: 12 };

export const DEMO_PROGRAMME_REPORTS: ProgrammeReport[] = [
  {
    code: "PPL502",
    submissions: 6,
    graded: 6,
    avg: 67,
    passRate: 100,
    firstClass: 33,
    twoOne: 50,
    twoTwo: 17,
    third: 0,
    fail: 0,
  },
  {
    code: "SOC411",
    submissions: 6,
    graded: 6,
    avg: 61,
    passRate: 67,
    firstClass: 17,
    twoOne: 33,
    twoTwo: 17,
    third: 0,
    fail: 33,
  },
];
