import type { ExistingGradeRecordWithMeta, FingerprintGradeCluster } from "./grading-support.ts";
import {
  blindSubmissionText,
  buildGradingInputHash,
  chooseCanonicalFingerprintGrade,
  computeContentFingerprint,
  GRADING_PROMPT_VERSION,
} from "./grading-support.ts";
import type { RubricCriterion } from "./prompting.ts";
import type {
  AssignmentForGrading,
  FetchSubmissionContentForGrading,
  SubmissionForGrading,
} from "./types.ts";

type QueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => unknown;
      in: (column: string, values: string[]) => unknown;
      maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
    };
  };
};

export function normalizeRubricForAssignment(assignment: AssignmentForGrading) {
  const rubric = Array.isArray(assignment.rubric) ? (assignment.rubric as RubricCriterion[]) : [];
  const normalizedRubric: RubricCriterion[] =
    rubric.length > 0
      ? rubric.map((criterion, index) => ({
          criterion: criterion.criterion || `Criterion ${index + 1}`,
          weight: Number(criterion.weight) || 0,
          description: criterion.description || "",
        }))
      : [
          {
            criterion: "Overall quality",
            weight: assignment.max_score,
            description: "Holistic quality, correctness, and completeness.",
          },
        ];

  const rubricText = normalizedRubric
    .map((criterion) => `- ${criterion.criterion} (${criterion.weight} pts): ${criterion.description || ""}`)
    .join("\n");

  return { normalizedRubric, rubricText };
}

export async function loadAssignmentForGrading(client: QueryClient, assignmentId: string) {
  const response = await client
    .from("assignments")
    .select("id, lecturer_id, title, description, module_code, max_score, rubric")
    .eq("id", assignmentId)
    .maybeSingle();

  return {
    data: response.data as AssignmentForGrading | null,
    error: response.error,
  };
}

export async function loadRequestedSubmissionsForGrading(
  client: QueryClient,
  assignmentId: string,
  submissionIds: string[],
) {
  const response = await client
    .from("submissions")
    .select("id, assignment_id, student_name, student_email, file_name, file_url")
    .eq("assignment_id", assignmentId)
    .in("id", submissionIds) as { data: unknown; error: unknown };

  return {
    data: (response.data as SubmissionForGrading[] | null) ?? [],
    error: response.error,
  };
}

export async function loadAssignmentSubmissionRows(client: QueryClient, assignmentId: string) {
  const response = await client
    .from("submissions")
    .select("id, file_url, file_name, student_name, student_email")
    .eq("assignment_id", assignmentId) as { data: unknown; error: unknown };

  const rows = (response.data as SubmissionForGrading[] | null) ?? [];
  return {
    data: rows,
    error: response.error,
    assignmentSubmissionIds: rows.map((row) => row.id).filter(Boolean),
    assignmentSubmissionsById: new Map(rows.map((row) => [row.id, row])),
  };
}

export async function loadExistingGradesForGrading(
  client: QueryClient,
  submissionIds: string[],
) {
  const response = await client
    .from("grades")
    .select("id, submission_id, ai_score, ai_feedback, ai_breakdown, grading_confidence, grading_metadata, created_at")
    .in("submission_id", submissionIds) as { data: unknown; error: unknown };

  const gradeRows = (response.data as ExistingGradeRecordWithMeta[] | null) ?? [];
  return {
    data: gradeRows,
    error: response.error,
    existingGradesBySubmission: new Map(gradeRows.map((grade) => [grade.submission_id, grade])),
  };
}

export async function buildExistingGradesByFingerprint(params: {
  assignment: AssignmentForGrading;
  existingGradeRows: ExistingGradeRecordWithMeta[];
  assignmentSubmissionsById: Map<string, SubmissionForGrading>;
  normalizedRubric: RubricCriterion[];
  fetchSubmissionContent: FetchSubmissionContentForGrading;
}) {
  const gradesByFingerprint = new Map<string, ExistingGradeRecordWithMeta[]>();
  for (const grade of params.existingGradeRows) {
    const fingerprint = typeof grade.grading_metadata?.content_fingerprint === "string"
      ? grade.grading_metadata.content_fingerprint
      : "";
    if (!fingerprint) continue;
    const current = gradesByFingerprint.get(fingerprint) || [];
    current.push(grade);
    gradesByFingerprint.set(fingerprint, current);
  }

  const gradesMissingFingerprint = params.existingGradeRows.filter((grade) => {
    const fingerprint = typeof grade.grading_metadata?.content_fingerprint === "string"
      ? grade.grading_metadata.content_fingerprint
      : "";
    return !fingerprint;
  });

  for (const grade of gradesMissingFingerprint) {
    const submission = params.assignmentSubmissionsById.get(grade.submission_id);
    if (!submission?.file_url) continue;
    try {
      const { extractedText } = await params.fetchSubmissionContent({
        file_url: submission.file_url,
        file_name: submission.file_name ?? null,
      });
      const blindedText = blindSubmissionText({
        text: extractedText,
        studentName: submission.student_name,
        studentEmail: submission.student_email,
        fileName: submission.file_name,
      });
      const fingerprint = computeContentFingerprint(params.assignment.id, blindedText);
      const gradingInputHash = await buildGradingInputHash({
        submissionText: blindedText,
        rubric: params.normalizedRubric,
        assignmentInstructions: `${params.assignment.title}\n${params.assignment.description || ""}`,
        maxScore: params.assignment.max_score,
      });
      const current = gradesByFingerprint.get(fingerprint) || [];
      current.push({
        ...grade,
        grading_metadata: {
          ...(grade.grading_metadata || {}),
          content_fingerprint: fingerprint,
          grading_input_hash: gradingInputHash,
          grading_prompt_version: GRADING_PROMPT_VERSION,
          blind_grading_applied: true,
        },
      });
      gradesByFingerprint.set(fingerprint, current);
    } catch {
      // Skip backfill for unreadable historical submissions; they will fall back to fresh grading.
    }
  }

  const existingGradesByFingerprint = new Map<string, FingerprintGradeCluster>();
  for (const [fingerprint, grades] of gradesByFingerprint.entries()) {
    const cluster = chooseCanonicalFingerprintGrade(
      grades.map((grade) => ({
        ...grade,
        grading_metadata: {
          ...(grade.grading_metadata || {}),
          content_fingerprint: fingerprint,
        },
      })),
    );
    if (cluster) {
      existingGradesByFingerprint.set(fingerprint, cluster);
    }
  }

  return existingGradesByFingerprint;
}
