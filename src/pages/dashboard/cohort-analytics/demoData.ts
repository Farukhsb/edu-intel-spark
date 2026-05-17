import type { AssignmentAnalytics, CohortRecommendation, GradeBand } from "./types";

export const EMPTY_GRADE_DIST: GradeBand[] = [
  { band: "1st (70+)", count: 0, fill: "hsl(152, 56%, 45%)" },
  { band: "2:1 (60-69)", count: 0, fill: "hsl(205, 80%, 55%)" },
  { band: "2:2 (50-59)", count: 0, fill: "hsl(38, 92%, 60%)" },
  { band: "3rd (40-49)", count: 0, fill: "hsl(280, 55%, 55%)" },
  { band: "Fail (<40)", count: 0, fill: "hsl(0, 72%, 55%)" },
];

export const DEMO_ASSIGNMENTS: AssignmentAnalytics[] = [
  {
    id: "demo-a1",
    title: "Algorithms Coursework",
    moduleCode: "CS205",
    avgScore: 63,
    failRate: 18,
    passRate: 82,
    gradedCount: 28,
    submissions: 30,
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
  {
    id: "demo-a2",
    title: "Dynamic Programming Test",
    moduleCode: "CS205",
    avgScore: 49,
    failRate: 37,
    passRate: 63,
    gradedCount: 30,
    submissions: 30,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
];

export const DEMO_RECOMMENDATIONS: CohortRecommendation[] = [
  {
    id: "demo:low_cohort_average",
    type: "performance",
    ruleCode: "low_cohort_average",
    title: "Low cohort average detected",
    summary: "The current cohort average is 44%, below the 45% threshold.",
    explanation: "Students are struggling across the cohort, not just in a narrow subgroup.",
    severity: "high",
    confidence: 0.96,
    recommendedActions: [
      "Review the weakest assignment and rubric areas.",
      "Run a short recap session before the next deadline.",
    ],
    evidence: {
      metrics: [
        { label: "Cohort average", value: "44%" },
        { label: "Graded submissions", value: "30" },
      ],
      assignmentId: "demo-a2",
      assignmentTitle: "Dynamic Programming Test",
    },
    status: "open",
    createdAt: new Date().toISOString(),
    assignmentId: "demo-a2",
  },
  {
    id: "demo:student_risk_cluster",
    type: "student risk",
    ruleCode: "high_risk_student_cluster",
    title: "High-risk student cluster detected",
    summary: "8 students are in the high or critical risk band.",
    explanation: "The existing trajectory-based risk engine is flagging a meaningful cluster size.",
    severity: "critical",
    confidence: 0.94,
    recommendedActions: [
      "Open the risk workflow and prioritise the highest-risk students.",
      "Create targeted check-ins for the affected students.",
    ],
    evidence: {
      metrics: [
        { label: "High-risk students", value: "8" },
        { label: "Risk share of flagged cohort", value: "22%" },
      ],
      affectedStudentIds: ["demo-student-1", "demo-student-2"],
      affectedStudentNames: ["Ada Lovelace", "Alan Turing"],
    },
    status: "open",
    createdAt: new Date().toISOString(),
  },
];
