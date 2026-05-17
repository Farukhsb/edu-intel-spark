import type { Tables } from "@/integrations/supabase/types";

export type ModuleStat = {
  module: string;
  students: number;
  avgGrade: number;
  passRate: number;
};

export type LowPerformingAssessment = {
  id: string;
  name: string;
  avgGrade: number;
  passRate: number;
  students: number;
  issue: string;
};

export type AccreditationMetric = {
  metric: string;
  value: number;
  target: number;
  status: "met" | "at-risk" | "below";
};

export type InstitutionalReportingReadiness = {
  posture: "strong" | "watch" | "risk";
  postureLabel: string;
  likelyChallenge: string;
  bestNextReport: string;
};

export const EMPTY_ACCREDITATION: AccreditationMetric[] = [
  { metric: "Module Pass Rate (Avg)", value: 0, target: 75, status: "below" },
  { metric: "Graded Submissions", value: 0, target: 95, status: "below" },
  { metric: "Average Score", value: 0, target: 60, status: "below" },
  { metric: "Assessment Completion Rate", value: 0, target: 90, status: "below" },
];

type AssignmentRow = Pick<Tables<"assignments">, "id" | "title" | "module_code">;
type SubmissionRow = Pick<Tables<"submissions">, "id" | "assignment_id">;
type GradeRow = Pick<Tables<"grades">, "submission_id" | "ai_score" | "final_score" | "lecturer_score">;
type ProfileRow = Pick<Tables<"profiles">, "id" | "role">;

export const getMetricStatus = (value: number, target: number): AccreditationMetric["status"] => {
  if (value >= target) return "met";
  if (value >= Math.max(target - 10, 0)) return "at-risk";
  return "below";
};

export const buildInstitutionalInsightsSnapshot = ({
  assignments,
  submissions,
  grades,
  profiles,
}: {
  assignments: AssignmentRow[];
  submissions: SubmissionRow[];
  grades: GradeRow[];
  profiles: ProfileRow[];
}) => {
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));

  const scores = grades
    .map((grade) => Number(grade.final_score ?? grade.lecturer_score ?? grade.ai_score))
    .filter((score) => Number.isFinite(score));

  const gradeBySubmission: Record<string, number> = {};
  grades.forEach((grade) => {
    const score = Number(grade.final_score ?? grade.lecturer_score ?? grade.ai_score);
    if (Number.isFinite(score)) {
      gradeBySubmission[grade.submission_id] = score;
    }
  });

  const assignmentScores: Record<string, { title: string; scores: number[]; students: number }> = {};
  assignments.forEach((assignment) => {
    assignmentScores[assignment.id] = { title: assignment.title, scores: [], students: 0 };
  });

  submissions.forEach((submission) => {
    const stats = assignmentScores[submission.assignment_id];
    if (!stats) return;

    stats.students += 1;
    const score = gradeBySubmission[submission.id];
    if (Number.isFinite(score)) {
      stats.scores.push(score);
    }
  });

  const lowPerforming = Object.values(assignmentScores)
    .filter((assignment) => assignment.scores.length > 0)
    .map((assignment) => {
      const average = assignment.scores.reduce((sum, score) => sum + score, 0) / assignment.scores.length;
      return {
        id: assignments.find((row) => row.title === assignment.title)?.id ?? assignment.title,
        name: assignment.title,
        avgGrade: Math.round(average),
        passRate: Math.round((assignment.scores.filter((score) => score >= 40).length / assignment.scores.length) * 100),
        students: assignment.students,
        issue: average < 50 ? "Low average - review needed" : "Moderate performance",
      } satisfies LowPerformingAssessment;
    })
    .sort((left, right) => left.avgGrade - right.avgGrade)
    .slice(0, 5);

  const moduleGroups: Record<string, number[]> = {};
  submissions.forEach((submission) => {
    const assignment = assignmentById.get(submission.assignment_id);
    const key = assignment?.module_code?.trim() || assignment?.title?.trim() || "Unassigned module";
    const score = gradeBySubmission[submission.id];

    if (!moduleGroups[key]) {
      moduleGroups[key] = [];
    }

    if (Number.isFinite(score)) {
      moduleGroups[key].push(score);
    }
  });

  const moduleStats = Object.entries(moduleGroups)
    .filter(([, moduleScores]) => moduleScores.length > 0)
    .map(([moduleCode, moduleScores]) => ({
      module: moduleCode,
      students: moduleScores.length,
      avgGrade: Math.round(moduleScores.reduce((sum, score) => sum + score, 0) / moduleScores.length),
      passRate: Math.round((moduleScores.filter((score) => score >= 40).length / moduleScores.length) * 100),
    } satisfies ModuleStat))
    .sort((left, right) => right.passRate - left.passRate);

  const studentCount = profiles.filter((profile) => profile.role === "student").length;
  const passRate = scores.length > 0 ? Math.round((scores.filter((score) => score >= 40).length / scores.length) * 100) : 0;
  const gradedPct = submissions.length > 0 ? Math.min(Math.round((grades.length / submissions.length) * 100), 100) : 0;
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const completionRate =
    submissions.length > 0 && assignments.length > 0 && studentCount > 0
      ? Math.min(Math.round((submissions.length / (assignments.length * studentCount)) * 100), 100)
      : 0;

  const accreditation = [
    { metric: "Module Pass Rate (Avg)", value: passRate, target: 75, status: getMetricStatus(passRate, 75) },
    { metric: "Graded Submissions", value: gradedPct, target: 95, status: getMetricStatus(gradedPct, 95) },
    { metric: "Average Score", value: avgScore, target: 60, status: getMetricStatus(avgScore, 60) },
    { metric: "Assessment Completion Rate", value: completionRate, target: 90, status: getMetricStatus(completionRate, 90) },
  ] satisfies AccreditationMetric[];

  return {
    moduleStats,
    lowPerforming,
    accreditation,
    hasRealData: assignments.length > 0 || submissions.length > 0 || grades.length > 0,
  };
};

export const getInstitutionalReportingReadiness = ({
  accreditation,
  lowPerforming,
}: {
  accreditation: AccreditationMetric[];
  lowPerforming: LowPerformingAssessment[];
}): InstitutionalReportingReadiness => {
  const weakestAccreditationMetric = [...accreditation].sort((left, right) => left.value - right.value)[0];
  const belowCount = accreditation.filter((metric) => metric.status === "below").length;
  const atRiskCount = accreditation.filter((metric) => metric.status === "at-risk").length;
  const metCount = accreditation.filter((metric) => metric.status === "met").length;

  const posture =
    belowCount > 0 ? "risk" : atRiskCount > 0 ? "watch" : metCount > 0 ? "strong" : "risk";

  return {
    posture,
    postureLabel:
      posture === "strong"
        ? "Strong reporting position"
        : posture === "watch"
          ? "Watch list position"
          : "Evidence risk position",
    likelyChallenge: weakestAccreditationMetric?.metric || "No readiness signal yet",
    bestNextReport:
      belowCount > 0 || atRiskCount > 0
        ? "Accreditation compliance review"
        : lowPerforming.length > 0
          ? "Institutional performance snapshot"
          : "No report priority yet",
  };
};
