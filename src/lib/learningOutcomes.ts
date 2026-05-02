import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";

export const ASSIGNMENT_FIELDS = "id, title, module_code";
export const GRADE_FIELDS = "submission_id, ai_score, final_score, ai_breakdown";
export const SUBMISSION_FIELDS = "id, assignment_id, student_id, student_name, student_email, submitted_at";

export interface AssignmentOption {
  id: string;
  title: string;
  moduleCode: string | null;
}

export interface OutcomeRow {
  criterion: string;
  avgScore: number;
  maxScore: number;
  pct: number;
  status: "above" | "approaching" | "below";
}

export interface StudentTrajectory {
  name: string;
  scores: number[];
  trend: "improving" | "declining" | "stable";
}

type AssignmentRow = Pick<Tables<"assignments">, "id" | "title" | "module_code">;
type SubmissionRow = Pick<
  Tables<"submissions">,
  "id" | "assignment_id" | "student_id" | "student_name" | "student_email" | "submitted_at"
>;
type GradeRow = Pick<Tables<"grades">, "submission_id" | "ai_score" | "final_score" | "ai_breakdown">;

interface CriterionAggregate {
  total: number;
  max: number;
  count: number;
}

interface LearningOutcomesSnapshot {
  outcomes: OutcomeRow[];
  trajectories: StudentTrajectory[];
}

const toAssignmentOption = (assignment: AssignmentRow): AssignmentOption => ({
  id: assignment.id,
  title: assignment.title,
  moduleCode: assignment.module_code || null,
});

const toStudentLabel = (submission: SubmissionRow) =>
  submission.student_name || submission.student_email || submission.student_id || "Student";

const toNumericScore = (grade: GradeRow) => {
  const score = grade.final_score ?? grade.ai_score;
  return score == null ? null : Number(score);
};

const normalizeCriterionBreakdown = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      criterion:
        typeof item.criterion === "string"
          ? item.criterion
          : typeof item.name === "string"
            ? item.name
            : "Unknown",
      score: typeof item.score === "number" ? item.score : 0,
      maxScore:
        typeof item.max_score === "number"
          ? item.max_score
          : typeof item.maxScore === "number"
            ? item.maxScore
            : 10,
    }));
};

export const buildLearningOutcomesSnapshot = ({
  submissions,
  grades,
  selectedAssignment,
}: {
  submissions: SubmissionRow[];
  grades: GradeRow[];
  selectedAssignment: string;
}): LearningOutcomesSnapshot => {
  const submissionsById = new Map(submissions.map((submission) => [submission.id, submission]));
  const criterionScores: Record<string, CriterionAggregate> = {};
  const studentScores: Record<string, Array<{ score: number; submittedAt: string | null }>> = {};

  grades.forEach((grade) => {
    const submission = submissionsById.get(grade.submission_id);
    if (!submission) return;
    if (selectedAssignment !== "all" && submission.assignment_id !== selectedAssignment) return;

    const score = toNumericScore(grade);
    if (score != null && !Number.isNaN(score)) {
      const studentKey = toStudentLabel(submission);
      if (!studentScores[studentKey]) {
        studentScores[studentKey] = [];
      }
      studentScores[studentKey].push({
        score,
        submittedAt: submission.submitted_at,
      });
    }

    normalizeCriterionBreakdown(grade.ai_breakdown).forEach((entry) => {
      if (!criterionScores[entry.criterion]) {
        criterionScores[entry.criterion] = { total: 0, max: 0, count: 0 };
      }

      criterionScores[entry.criterion].total += entry.score;
      criterionScores[entry.criterion].max += entry.maxScore;
      criterionScores[entry.criterion].count++;
    });
  });

  const outcomes = Object.entries(criterionScores).map(([criterion, aggregate]) => {
    const avgScore = aggregate.count > 0 ? Math.round((aggregate.total / aggregate.count) * 10) / 10 : 0;
    const maxScore = aggregate.count > 0 ? Math.round((aggregate.max / aggregate.count) * 10) / 10 : 10;
    const pct = maxScore > 0 ? Math.round((avgScore / maxScore) * 100) : 0;

    return {
      criterion,
      avgScore,
      maxScore,
      pct,
      status: pct >= 70 ? "above" : pct >= 50 ? "approaching" : "below",
    } satisfies OutcomeRow;
  });

  const trajectories = Object.entries(studentScores)
    .map(([name, entries]) => ({
      name,
      scores: [...entries]
        .sort((left, right) => {
          const leftTime = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
          const rightTime = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
          return leftTime - rightTime;
        })
        .map((entry) => entry.score),
    }))
    .filter((student) => student.scores.length >= 2)
    .slice(0, 8)
    .map((student) => {
      const last = student.scores[student.scores.length - 1];
      const prev = student.scores[student.scores.length - 2];

      return {
        ...student,
        trend: last > prev + 3 ? "improving" : last < prev - 3 ? "declining" : "stable",
      } satisfies StudentTrajectory;
    });

  return { outcomes, trajectories };
};

export const loadLearningOutcomesData = async ({
  supabase,
  lecturerId,
  selectedAssignment,
}: {
  supabase: SupabaseClient<Database>;
  lecturerId: string;
  selectedAssignment: string;
}) => {
  const { data: assignmentsData, error: assignmentsError } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_FIELDS)
    .eq("lecturer_id", lecturerId);

  if (assignmentsError) {
    throw assignmentsError;
  }

  const assignments = (assignmentsData || []).map(toAssignmentOption);
  if (assignments.length === 0) {
    return {
      assignments,
      outcomes: [],
      trajectories: [],
    };
  }

  const assignmentIds = assignments.map((assignment) => assignment.id);
  const { data: submissionsData, error: submissionsError } = await supabase
    .from("submissions")
    .select(SUBMISSION_FIELDS)
    .in("assignment_id", assignmentIds);

  if (submissionsError) {
    throw submissionsError;
  }

  const submissions = (submissionsData || []) as SubmissionRow[];
  if (submissions.length === 0) {
    return {
      assignments,
      outcomes: [],
      trajectories: [],
    };
  }

  const submissionIds = submissions.map((submission) => submission.id);
  const { data: gradesData, error: gradesError } = await supabase
    .from("grades")
    .select(GRADE_FIELDS)
    .in("submission_id", submissionIds);

  if (gradesError) {
    throw gradesError;
  }

  const snapshot = buildLearningOutcomesSnapshot({
    submissions,
    grades: (gradesData || []) as GradeRow[],
    selectedAssignment,
  });

  return {
    assignments,
    ...snapshot,
  };
};
