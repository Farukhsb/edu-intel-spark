import type { StudentTrajectory } from "@/lib/studentRisk";

export interface StudentAssignment {
  id: string;
  title: string;
  module_code: string | null;
  due_date: string | null;
  max_score: number;
}

export interface StudentSubmission {
  id: string;
  assignment_id: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  status: string;
  submitted_at: string;
}

export interface StudentGrade {
  submission_id: string;
  ai_score: number | null;
  final_score: number | null;
}

export interface StudentRiskLike {
  riskScore: number;
  riskLevel: "critical" | "high" | "moderate";
  flags: string[];
  recommendation: string;
}

export interface StudentInsightData {
  name: string;
  email: string | null;
  studentId: string;
  studentRecordId: string | null;
  modules: string[];
  averageGrade: number | null;
  latestGrade: number | null;
  riskScore: number | null;
  riskLevel: "critical" | "high" | "moderate" | "watch";
  reasons: string[];
  recommendation: string;
  missedAssignments: StudentAssignment[];
  submissions: StudentSubmission[];
  chart: Array<{ assessment: string; grade: number }>;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toNumericScore = (grade: StudentGrade) => Number(grade.final_score ?? grade.ai_score);

export const matchStudentSubmissions = ({
  submissions,
  studentId,
}: {
  submissions: StudentSubmission[];
  studentId: string;
}) =>
  submissions.filter((submission) => {
    const name = submission.student_name || "";
    return (
      submission.student_id === studentId ||
      submission.student_email === studentId ||
      name.toLowerCase() === studentId.toLowerCase() ||
      slugify(name) === slugify(studentId)
    );
  });

export const buildStudentInsightData = ({
  assignments,
  submissions,
  grades,
  decodedStudentId,
  studentRecordId,
  computeRisk,
}: {
  assignments: StudentAssignment[];
  submissions: StudentSubmission[];
  grades: StudentGrade[];
  decodedStudentId: string;
  studentRecordId: string | null;
  computeRisk: (trajectory: StudentTrajectory) => StudentRiskLike | null;
}): StudentInsightData | null => {
  const matchingSubmissions = matchStudentSubmissions({
    submissions,
    studentId: decodedStudentId,
  });
  if (matchingSubmissions.length === 0) {
    return null;
  }

  const gradeMap = new Map(
    grades
      .map((grade) => [grade.submission_id, toNumericScore(grade)] as const)
      .filter((entry) => !Number.isNaN(entry[1])),
  );
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const sortedSubmissions = [...matchingSubmissions].sort(
    (left, right) => new Date(left.submitted_at).getTime() - new Date(right.submitted_at).getTime(),
  );

  const trajectory: StudentTrajectory = {
    name:
      sortedSubmissions.find((submission) => submission.student_name)?.student_name ||
      sortedSubmissions[0].student_email ||
      "Student",
    email: sortedSubmissions.find((submission) => submission.student_email)?.student_email || null,
    studentId:
      sortedSubmissions.find((submission) => submission.student_id)?.student_id ||
      sortedSubmissions.find((submission) => submission.student_email)?.student_email ||
      decodedStudentId,
    scores: sortedSubmissions
      .map((submission) => {
        const score = gradeMap.get(submission.id);
        const assignment = assignmentMap.get(submission.assignment_id);
        if (score == null || !assignment) return null;
        return {
          score,
          date: submission.submitted_at,
          assignmentTitle: assignment.title,
        };
      })
      .filter((entry): entry is StudentTrajectory["scores"][number] => entry !== null),
  };

  const risk = computeRisk(trajectory);
  const scores = trajectory.scores.map((point) => point.score);
  const averageGrade =
    scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  const latestGrade = scores.length > 0 ? scores[scores.length - 1] : null;
  const matchedAssignmentIds = new Set(matchingSubmissions.map((submission) => submission.assignment_id));
  const missedAssignments = assignments.filter((assignment) => !matchedAssignmentIds.has(assignment.id));
  const chart = trajectory.scores.map((point) => ({
    assessment: point.assignmentTitle.length > 18 ? `${point.assignmentTitle.slice(0, 16)}...` : point.assignmentTitle,
    grade: point.score,
  }));

  const reasons = [...(risk?.flags || [])];
  if (missedAssignments.length > 0) {
    reasons.push(`${missedAssignments.length} assignment${missedAssignments.length === 1 ? "" : "s"} missing`);
  }
  if (reasons.length === 0) {
    reasons.push("Student is being monitored due to recent performance volatility.");
  }

  return {
    name: trajectory.name,
    email: trajectory.email,
    studentId: trajectory.studentId,
    studentRecordId,
    modules: Array.from(
      new Set(
        matchingSubmissions
          .map((submission) => assignmentMap.get(submission.assignment_id)?.module_code)
          .filter(Boolean) as string[],
      ),
    ),
    averageGrade,
    latestGrade,
    riskScore: risk?.riskScore ?? null,
    riskLevel: risk?.riskLevel ?? (averageGrade != null && averageGrade < 50 ? "watch" : "moderate"),
    reasons,
    recommendation:
      risk?.recommendation ||
      (missedAssignments.length > 0
        ? "Review the missing work with the student and agree a catch-up plan."
        : "Continue monitoring performance and reinforce the next study priorities."),
    missedAssignments,
    submissions: matchingSubmissions,
    chart,
  };
};
