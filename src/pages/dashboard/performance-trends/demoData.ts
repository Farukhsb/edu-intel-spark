import type { StudentTrajectory } from "@/lib/studentRisk";

export type DemoAssessmentTrend = {
  module: string;
  name: string;
  avgGrade: number;
  participation: number;
};

export type DemoTrajectory = StudentTrajectory & {
  module: string;
};

export const DEMO_ASSESSMENT_TRENDS: DemoAssessmentTrend[] = [
  { module: "CS301", name: "Sorting Report Draft", avgGrade: 68, participation: 94 },
  { module: "CS301", name: "Algorithm Benchmark Reflection", avgGrade: 63, participation: 91 },
  { module: "CS220", name: "Normalisation Case Study", avgGrade: 57, participation: 89 },
  { module: "CS220", name: "Schema Redesign Memo", avgGrade: 61, participation: 86 },
];

export const DEMO_GRADE_SCORES: Array<{ module: string; score: number }> = [
  { module: "CS301", score: 81 },
  { module: "CS301", score: 76 },
  { module: "CS301", score: 74 },
  { module: "CS301", score: 69 },
  { module: "CS301", score: 66 },
  { module: "CS301", score: 58 },
  { module: "CS301", score: 45 },
  { module: "CS301", score: 34 },
  { module: "CS220", score: 72 },
  { module: "CS220", score: 64 },
  { module: "CS220", score: 59 },
  { module: "CS220", score: 56 },
  { module: "CS220", score: 48 },
  { module: "CS220", score: 41 },
  { module: "CS220", score: 38 },
  { module: "CS220", score: 29 },
];

export const DEMO_TRAJECTORIES: DemoTrajectory[] = [
  {
    module: "CS301",
    name: "Mariam Okeke",
    email: "mariam.okeke@example.edu",
    studentId: "demo-risk-1",
    scores: [
      { score: 49, date: "2026-01-20T09:00:00.000Z", assignmentTitle: "Sorting Lab Checkpoint" },
      { score: 37, date: "2026-02-18T09:00:00.000Z", assignmentTitle: "Algorithm Reflection" },
      { score: 26, date: "2026-03-22T09:00:00.000Z", assignmentTitle: "Benchmark Planning Memo" },
    ],
  },
  {
    module: "CS301",
    name: "Oliver Grant",
    email: "oliver.grant@example.edu",
    studentId: "demo-risk-2",
    scores: [
      { score: 62, date: "2026-01-20T09:00:00.000Z", assignmentTitle: "Sorting Lab Checkpoint" },
      { score: 48, date: "2026-02-18T09:00:00.000Z", assignmentTitle: "Algorithm Reflection" },
      { score: 34, date: "2026-03-22T09:00:00.000Z", assignmentTitle: "Benchmark Planning Memo" },
    ],
  },
  {
    module: "CS220",
    name: "Fatima Bello",
    email: "fatima.bello@example.edu",
    studentId: "demo-risk-3",
    scores: [
      { score: 71, date: "2026-01-16T09:00:00.000Z", assignmentTitle: "ER Model Exercise" },
      { score: 55, date: "2026-02-14T09:00:00.000Z", assignmentTitle: "Functional Dependency Quiz" },
      { score: 38, date: "2026-03-12T09:00:00.000Z", assignmentTitle: "Normalisation Case Study" },
    ],
  },
  {
    module: "CS220",
    name: "Samuel Hart",
    email: "samuel.hart@example.edu",
    studentId: "demo-risk-4",
    scores: [
      { score: 52, date: "2026-01-16T09:00:00.000Z", assignmentTitle: "ER Model Exercise" },
      { score: 47, date: "2026-02-14T09:00:00.000Z", assignmentTitle: "Functional Dependency Quiz" },
      { score: 43, date: "2026-03-12T09:00:00.000Z", assignmentTitle: "Normalisation Case Study" },
    ],
  },
];
