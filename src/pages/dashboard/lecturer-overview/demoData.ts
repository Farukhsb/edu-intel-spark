import type {
  LecturerOverviewAtRiskSummary,
  LecturerOverviewPipelineStage,
  LecturerOverviewRecentSubmission,
  LecturerOverviewStats,
} from "./types";

export const DEMO_STATS: LecturerOverviewStats = {
  totalSubmissions: 42,
  gradedCount: 35,
  pendingCount: 7,
  avgScore: 64.3,
  avgScoreScale: 100,
  activeStudents: 28,
  assignmentCount: 5,
  onTarget: 22,
  atRisk: 6,
};

export const DEMO_RECENT: LecturerOverviewRecentSubmission[] = [
  {
    id: "d1",
    assignment_id: "demo-assignment-1",
    student_name: "Alice Johnson",
    file_name: "trees.py",
    status: "released",
    submitted_at: new Date(Date.now() - 86400000).toISOString(),
    assignment_title: "Data Structures",
    score: 78,
    max_score: 100,
    grade_source: "lecturer_reviewed",
    workflowHref: "/demo/dashboard/assignments/demo-assignment-1?source=queue&focus=released-results",
    workflowLabel: "Continue workflow",
  },
  {
    id: "d2",
    assignment_id: "demo-assignment-2",
    student_name: "Bob Smith",
    file_name: "essay.pdf",
    status: "ai_graded",
    submitted_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    assignment_title: "Algorithms",
    score: 55,
    max_score: 100,
    grade_source: "ai_graded",
    workflowHref: "/demo/dashboard/assignments/demo-assignment-2?source=notification&focus=ai-results",
    workflowLabel: "Review submission",
  },
  {
    id: "d3",
    assignment_id: "demo-assignment-3",
    student_name: "Carol White",
    file_name: "report.docx",
    status: "submitted",
    submitted_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    assignment_title: "Database Design",
    score: null,
    max_score: 100,
    grade_source: null,
    workflowHref: "/demo/dashboard/assignments/demo-assignment-3?source=notification&focus=submission-review",
    workflowLabel: "Review submission",
  },
];

export const DEMO_PIPELINE: LecturerOverviewPipelineStage[] = [
  { label: "Submitted", count: 0, detail: "Waiting to enter marking." },
  { label: "AI Graded", count: 1, detail: "Ready for lecturer review." },
  { label: "Under Review", count: 1, detail: "Review, moderation, or approval in progress." },
  { label: "Released", count: 1, detail: "Visible to students." },
];

export const DEMO_TOP_AT_RISK: LecturerOverviewAtRiskSummary[] = [
  {
    studentId: "demo-student-2",
    name: "Grace Mensah",
    riskLevel: "critical",
    riskScore: 78,
    signal: "Critical risk - average below 40% and recent decline",
  },
  {
    studentId: "demo-student-4",
    name: "Daniel Okafor",
    riskLevel: "high",
    riskScore: 56,
    signal: "High risk - expected next outcome below threshold",
  },
  {
    studentId: "demo-student-7",
    name: "Riley Brooks",
    riskLevel: "moderate",
    riskScore: 32,
    signal: "Moderate risk - only one low graded submission so far",
  },
];

export const DEMO_ASSIGNMENTS = [
  { id: "demo-assignment-1", title: "Data Structures", max_score: 100 },
  { id: "demo-assignment-2", title: "Algorithms", max_score: 100 },
  { id: "demo-assignment-3", title: "Database Design", max_score: 100 },
  { id: "demo-assignment-4", title: "Software Architecture", max_score: 100 },
  { id: "demo-assignment-5", title: "Research Methods", max_score: 100 },
];

