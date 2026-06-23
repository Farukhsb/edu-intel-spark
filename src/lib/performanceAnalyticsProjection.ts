import type { AtRiskStudent, StudentTrajectory } from "@/lib/studentRisk";
import { mapRiskModelPredictionToAtRiskStudent, scoreStudentRisk } from "@/lib/riskModel";

import { buildGradeDistribution } from "@/lib/performanceAnalyticsShared";
import type {
  AssessmentTrendEntry,
  PerformanceAssignmentLike,
  PerformanceGradeLike,
  PerformanceProjection,
  PerformanceSubmissionLike,
} from "@/lib/performanceAnalyticsTypes";

const toNumericScore = (grade: PerformanceGradeLike) => Number(grade.final_score ?? grade.ai_score);

export const buildPerformanceProjection = ({
  assignments,
  submissions,
  grades,
  moduleFilter,
  computeRisk,
}: {
  assignments: PerformanceAssignmentLike[];
  submissions: PerformanceSubmissionLike[];
  grades: PerformanceGradeLike[];
  moduleFilter: string;
  computeRisk?: (trajectory: StudentTrajectory) => AtRiskStudent | null;
}): PerformanceProjection => {
  const modules = Array.from(
    new Set(assignments.map((assignment) => assignment.module_code).filter(Boolean) as string[]),
  );

  const filteredAssignments =
    moduleFilter === "all"
      ? assignments
      : assignments.filter((assignment) => assignment.module_code === moduleFilter);
  const filteredAssignmentIds = new Set(filteredAssignments.map((assignment) => assignment.id));
  const filteredSubmissions = submissions.filter((submission) => filteredAssignmentIds.has(submission.assignment_id));
  const filteredSubmissionIds = new Set(filteredSubmissions.map((submission) => submission.id));
  const filteredGrades = grades.filter((grade) => filteredSubmissionIds.has(grade.submission_id));

  const assignmentMap = new Map(filteredAssignments.map((assignment) => [assignment.id, assignment]));
  const gradeBySubmission: Record<string, number> = {};
  for (const grade of filteredGrades) {
    const score = toNumericScore(grade);
    if (!Number.isNaN(score)) {
      gradeBySubmission[grade.submission_id] = score;
    }
  }

  const orderedSubmissionRecords: Array<{
    assignment: PerformanceAssignmentLike;
    submission: PerformanceSubmissionLike;
    score: number | undefined;
  }> = [];

  for (const submission of filteredSubmissions) {
    const assignment = assignmentMap.get(submission.assignment_id);
    if (!assignment) continue;

    orderedSubmissionRecords.push({
      assignment,
      submission,
      score: gradeBySubmission[submission.id],
    });
  }

  orderedSubmissionRecords.sort(
    (left, right) =>
      new Date(left.submission.submitted_at).getTime() - new Date(right.submission.submitted_at).getTime(),
  );

  const perAssignment: Record<string, { scores: number[]; totalSubs: number }> = {};
  const trajectories: Record<string, StudentTrajectory> = {};
  const allScores: number[] = [];

  orderedSubmissionRecords.forEach(({ assignment, submission, score }) => {
    if (!perAssignment[assignment.title]) {
      perAssignment[assignment.title] = { scores: [], totalSubs: 0 };
    }

    perAssignment[assignment.title].totalSubs++;

    if (score != null) {
      perAssignment[assignment.title].scores.push(score);
      allScores.push(score);
    }

    const key = submission.student_id || submission.student_email || submission.student_name || "unknown";
    if (!trajectories[key]) {
      trajectories[key] = {
        name: submission.student_name || submission.student_email || "Unknown Student",
        email: submission.student_email,
        studentId: key,
        scores: [],
      };
    }

    if (score != null) {
      trajectories[key].scores.push({
        score,
        date: submission.submitted_at,
        assignmentTitle: assignment.title,
      });
    }
  });

  const assessmentTrends: AssessmentTrendEntry[] = Object.entries(perAssignment).map(([name, data]) => ({
    name,
    avgGrade:
      data.scores.length > 0
        ? Math.round(data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length)
        : 0,
    participation:
      filteredSubmissions.length > 0 ? Math.round((data.totalSubs / filteredSubmissions.length) * 100) : 0,
  }));

  const scoreAtRiskStudent =
    computeRisk ?? ((trajectory: StudentTrajectory) =>
      mapRiskModelPredictionToAtRiskStudent(trajectory, scoreStudentRisk(trajectory)));

  const atRiskStudents = Object.values(trajectories)
    .map((trajectory) => scoreAtRiskStudent(trajectory))
    .filter((student): student is AtRiskStudent => student !== null)
    .sort((left, right) => right.riskScore - left.riskScore);

  return {
    modules,
    assessmentTrends,
    gradeDist: buildGradeDistribution(allScores),
    atRiskStudents,
  };
};
