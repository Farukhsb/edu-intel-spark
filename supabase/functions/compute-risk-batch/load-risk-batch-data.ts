import { HttpError } from "../_shared/auth.ts";

import { getEngagementEmail, getNumericGrade } from "./helpers.ts";

export type StudentRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type EngagementEventRow = {
  occurred_at: string;
  metadata: Record<string, unknown> | null;
};

export type ScoredTrajectory = {
  name: string;
  email: string | null;
  studentId: string;
  scores: Array<{ score: number; date: string; assignmentTitle: string }>;
};

export type RiskBatchLoadResult = {
  students: StudentRow[];
  studentCount: number;
  batchGeneratedAt: string;
  modelVersion: string;
  assignmentById: Map<string, { title: string; dueDate: string | null }>;
  submissionsByStudentId: Map<
    string,
    Array<{
      assignment_id: string;
      submitted_at: string | null;
      status: string;
    }>
  >;
  engagementEventsByEmail: Map<string, EngagementEventRow[]>;
  scoredTrajectories: ScoredTrajectory[];
  totalAssignments: number;
};

type LoadRiskBatchDataInput = {
  supabaseAdmin: any;
  institutionId: string;
  snapshotDate: string;
  featureVersion: string;
  fallbackModelVersion: string;
};

export async function loadRiskBatchData({
  supabaseAdmin,
  institutionId,
  snapshotDate,
  featureVersion,
  fallbackModelVersion,
}: LoadRiskBatchDataInput): Promise<RiskBatchLoadResult> {
  const { data: studentRows, error: studentError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .eq("institution_id", institutionId)
    .eq("role", "student");

  if (studentError) {
    throw new HttpError(500, studentError.message);
  }

  const students = (studentRows ?? []) as StudentRow[];
  const studentIds = students.map((row) => row.id);
  const batchGeneratedAt = new Date().toISOString();
  const modelVersion = fallbackModelVersion;

  if (studentIds.length === 0) {
    return {
      students,
      studentCount: 0,
      batchGeneratedAt,
      modelVersion,
      assignmentById: new Map(),
      submissionsByStudentId: new Map(),
      engagementEventsByEmail: new Map(),
      scoredTrajectories: [],
      totalAssignments: 0,
    };
  }

  const { data: submissionRows, error: submissionError } = await supabaseAdmin
    .from("submissions")
    .select("id, assignment_id, student_id, student_name, student_email, submitted_at")
    .eq("institution_id", institutionId)
    .in("student_id", studentIds);

  if (submissionError) {
    throw new HttpError(500, submissionError.message);
  }

  const submissionIds = (submissionRows ?? []).map((row) => row.id);
  const assignmentIds = Array.from(new Set((submissionRows ?? []).map((row) => row.assignment_id)));

  const { data: gradeRows, error: gradeError } =
    submissionIds.length > 0
      ? await supabaseAdmin
        .from("grades")
        .select("submission_id, final_score, ai_score")
        .eq("institution_id", institutionId)
        .in("submission_id", submissionIds)
      : { data: [], error: null };

  if (gradeError) {
    throw new HttpError(500, gradeError.message);
  }

  const { data: assignmentRows, error: assignmentError } =
    assignmentIds.length > 0
      ? await supabaseAdmin
        .from("assignments")
        .select("id, title")
        .eq("institution_id", institutionId)
        .in("id", assignmentIds)
      : { data: [], error: null };

  if (assignmentError) {
    throw new HttpError(500, assignmentError.message);
  }

  const engagementWindowStart = new Date(snapshotDate);
  engagementWindowStart.setDate(engagementWindowStart.getDate() - 30);
  const { data: engagementRows, error: engagementError } = await supabaseAdmin
    .from("lms_engagement_events")
    .select("occurred_at, metadata")
    .eq("institution_id", institutionId)
    .gte("occurred_at", engagementWindowStart.toISOString())
    .order("occurred_at", { ascending: false });

  if (engagementError) {
    // The batch can still run without engagement signals.
  }

  const studentById = new Map(students.map((row) => [row.id, row] as const));
  const assignmentById = new Map(
    (assignmentRows ?? []).map((row) => [row.id, { title: row.title, dueDate: (row as { due_date?: string | null }).due_date ?? null }] as const),
  );
  const gradeBySubmissionId = new Map(
    (gradeRows ?? [])
      .map((row) => [row.submission_id, getNumericGrade(row)] as const)
      .filter((entry): entry is readonly [string, number] => entry[1] !== null)
      .map(([submissionId, score]) => [submissionId, score] as const),
  );

  const submissionsByStudentId = new Map<
    string,
    Array<{
      assignment_id: string;
      submitted_at: string | null;
      status: string;
    }>
  >();
  for (const submission of submissionRows ?? []) {
    const studentId = submission.student_id;
    if (!studentId) continue;

    const current = submissionsByStudentId.get(studentId) ?? [];
    current.push({
      assignment_id: submission.assignment_id,
      submitted_at: submission.submitted_at,
      status: String((submission as { status?: string }).status ?? "submitted"),
    });
    submissionsByStudentId.set(studentId, current);
  }

  const engagementEventsByEmail = new Map<string, EngagementEventRow[]>();
  for (const row of engagementRows ?? []) {
    const email = getEngagementEmail(row.metadata);
    if (!email) continue;

    const current = engagementEventsByEmail.get(email) ?? [];
    current.push({
      occurred_at: row.occurred_at,
      metadata: row.metadata,
    });
    engagementEventsByEmail.set(email, current);
  }

  const trajectories = new Map<string, ScoredTrajectory>();

  for (const student of students) {
    trajectories.set(student.id, {
      name: student.full_name || student.email || "Student",
      email: student.email || null,
      studentId: student.id,
      scores: [],
    });
  }

  for (const submission of submissionRows ?? []) {
    const studentId = submission.student_id;
    if (!studentId) continue;

    const score = gradeBySubmissionId.get(submission.id);
    if (score == null) continue;

    const profile = studentById.get(studentId);
    const existing = trajectories.get(studentId) ?? {
      name: profile?.full_name || submission.student_name || submission.student_email || "Student",
      email: profile?.email || submission.student_email || null,
      studentId,
      scores: [],
    };

    existing.scores.push({
      score,
      date: submission.submitted_at,
      assignmentTitle: assignmentById.get(submission.assignment_id)?.title || "Assignment",
    });
    trajectories.set(studentId, existing);
  }

  const scoredTrajectories = Array.from(trajectories.values()).map((trajectory) => ({
    ...trajectory,
    scores: [...trajectory.scores].sort(
      (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
    ),
  }));

  return {
    students,
    studentCount: students.length,
    batchGeneratedAt,
    modelVersion,
    assignmentById,
    submissionsByStudentId,
    engagementEventsByEmail,
    scoredTrajectories,
    totalAssignments: (assignmentRows ?? []).length,
  };
}
