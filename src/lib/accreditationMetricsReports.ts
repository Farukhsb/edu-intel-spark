import type { AssignmentLike } from "@/lib/accreditationMetricsShared";
import type { ProgrammeReport } from "@/lib/accreditationMetricsTypes";
import { ensureNumber, resolveGradeScore } from "@/lib/accreditationMetricsShared";

export const deriveProgrammeReports = ({
  assignments,
  submissions,
  grades,
}: {
  assignments: AssignmentLike[];
  submissions: Array<Pick<{ id: string; assignment_id: string }, "id" | "assignment_id">>;
  grades: Array<Pick<{ submission_id: string; ai_score: number | null; final_score: number | null; lecturer_score?: number | null }, "submission_id" | "ai_score" | "final_score" | "lecturer_score">>;
}): ProgrammeReport[] => {
  const gradeBySubmission: Record<string, number> = {};
  grades.forEach((grade) => {
    gradeBySubmission[grade.submission_id] = ensureNumber(resolveGradeScore(grade));
  });

  const modules: Record<string, { title: string; scores: number[]; submissions: number }> = {};
  assignments.forEach((assignment) => {
    const key = assignment.module_code || "Unassigned";
    if (!modules[key]) modules[key] = { title: assignment.title || "Assignment", scores: [], submissions: 0 };
  });

  submissions.forEach((submission) => {
    const assignment = assignments.find((candidate) => candidate.id === submission.assignment_id);
    if (!assignment) return;
    const key = assignment.module_code || "Unassigned";
    modules[key].submissions += 1;
    if (submission.id in gradeBySubmission) {
      modules[key].scores.push(gradeBySubmission[submission.id]);
    }
  });

  return Object.entries(modules).map(([code, data]) => {
    const avg = data.scores.length > 0 ? Math.round(data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length) : 0;
    const passRate = data.scores.length > 0 ? Math.round((data.scores.filter((score) => score >= 40).length / data.scores.length) * 100) : 0;
    const firstClass = data.scores.length > 0 ? Math.round((data.scores.filter((score) => score >= 70).length / data.scores.length) * 100) : 0;
    const twoOne = data.scores.length > 0 ? Math.round((data.scores.filter((score) => score >= 60 && score < 70).length / data.scores.length) * 100) : 0;
    const twoTwo = data.scores.length > 0 ? Math.round((data.scores.filter((score) => score >= 50 && score < 60).length / data.scores.length) * 100) : 0;
    const third = data.scores.length > 0 ? Math.round((data.scores.filter((score) => score >= 40 && score < 50).length / data.scores.length) * 100) : 0;
    const fail = data.scores.length > 0 ? Math.round((data.scores.filter((score) => score < 40).length / data.scores.length) * 100) : 0;

    return {
      code,
      submissions: data.submissions,
      graded: data.scores.length,
      avg,
      passRate,
      firstClass,
      twoOne,
      twoTwo,
      third,
      fail,
    };
  });
};
