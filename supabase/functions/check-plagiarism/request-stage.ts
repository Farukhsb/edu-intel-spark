import { getEnv } from "../_shared/env.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import { applySharedRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";
import { type StoredWritingProfile, assessExtractionQuality } from "../_shared/text-analysis.ts";
import { CheckPlagiarismRequestSchema, EXTRACTION_CONCURRENCY, HttpError, includeValidationDetails, LARGE_COHORT_WARNING_THRESHOLD, MAX_INTERNAL_COMPARISON_SUBMISSIONS, resolveIntegrityProviderMode, resolveMossRunnerConfig, INTERNAL_SIMILARITY_MIN_WORDS, type CheckPlagiarismHandlerDeps, type AdminSupabaseClient } from "./request.ts";
import { fetchFileContent, summarizeExtractionObservability } from "./extraction.ts";
import { mapWithConcurrency } from "./map-with-concurrency.ts";
import type { ProcessedSubmissionText, SubmissionRow } from "./analysis.ts";
import { preprocessSubmissionText, isRecoverablePersistenceError } from "./analysis.ts";
import { type MossRunnerConfig } from "../_shared/providers/moss.ts";

type PreparedCheckPlagiarismRun = {
  corsHeaders: Record<string, string>;
  startedAt: number;
  userSupabase: ReturnType<CheckPlagiarismHandlerDeps["requireLecturer"]> extends Promise<infer T> ? T extends { supabase: infer S } ? S : never : never;
  supabaseAdmin: AdminSupabaseClient;
  user: { id: string };
  assignment: { id: string; lecturer_id: string; title: string; description: string };
  requestedAssignmentId: string;
  requestedSubmissionIds: string[];
  requestedSubmissionIdSet: Set<string>;
  submissions: SubmissionRow[];
  comparisonSubmissions: SubmissionRow[];
  isSingleMode: boolean;
  warnings: string[];
  contentMap: Map<string, Awaited<ReturnType<typeof fetchFileContent>>>;
  processedContentMap: Map<string, ProcessedSubmissionText>;
  profileMap: Map<string, StoredWritingProfile>;
  gradeMap: Map<string, number>;
  submissionIdsByStudent: Map<string, string[]>;
  integrityModel: string;
  providerMode: ReturnType<typeof resolveIntegrityProviderMode>;
  shouldRunLegacy: boolean;
  shouldRunInternalProvider: boolean;
  mossRunnerConfig: MossRunnerConfig | null;
  shouldRunMossProvider: boolean;
  shouldSkipInternalSimilarityForCohortSize: boolean;
  extractionSubmissions: SubmissionRow[];
};

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function supportsInternalTextSimilarity(content: {
  plainText: string;
  fileType: string;
  success: boolean;
  extractionError: string | null;
  extractionQuality: ReturnType<typeof assessExtractionQuality> | null;
}) {
  if (!content.success || content.extractionError) return false;
  if (content.extractionQuality && !content.extractionQuality.isUsable) return false;
  if (!["pdf", "docx", "txt"].includes(content.fileType)) return false;
  return countWords(content.plainText) >= INTERNAL_SIMILARITY_MIN_WORDS;
}

export async function prepareCheckPlagiarismRun(
  req: Request,
  deps: CheckPlagiarismHandlerDeps,
  corsHeaders: Record<string, string>,
): Promise<PreparedCheckPlagiarismRun | Response> {
  const supabaseAdmin = deps.createAdminClient();
  const { supabase: userSupabase, user } = await deps.requireLecturer(req);
  const rateLimit = await applySharedRateLimit(supabaseAdmin, req, {
    scope: "check-plagiarism",
    limit: 5,
    windowMs: 60_000,
    userId: user.id,
  });
  if (!rateLimit.allowed) {
    logWarn("Rate limit exceeded", { function: "check-plagiarism", identifierType: rateLimit.identifierType });
    return createRateLimitResponse(corsHeaders, rateLimit.retryAfterSeconds);
  }

  const body = await req.json().catch(() => null);
  const rawBody = body && typeof body === "object" ? body as Record<string, unknown> : null;
  const normalizedSubmissionIds = Array.isArray(rawBody?.submissionIds)
    ? rawBody.submissionIds.filter((item): item is string => typeof item === "string")
    : Array.isArray(rawBody?.submissions)
      ? rawBody.submissions
          .map((submission) =>
            typeof submission === "string"
              ? submission
              : submission && typeof submission === "object" && typeof (submission as Record<string, unknown>).id === "string"
                ? (submission as Record<string, unknown>).id as string
                : null,
          )
          .filter((item): item is string => Boolean(item))
      : undefined;
  const parsedRequest = CheckPlagiarismRequestSchema.safeParse({
    submissionId: typeof rawBody?.submissionId === "string" ? rawBody.submissionId : undefined,
    submissionIds: normalizedSubmissionIds,
    assignmentId:
      typeof rawBody?.assignmentId === "string"
        ? rawBody.assignmentId
        : rawBody?.assignment && typeof rawBody.assignment === "object" && typeof (rawBody.assignment as Record<string, unknown>).id === "string"
          ? (rawBody.assignment as Record<string, unknown>).id
          : undefined,
  });

  if (!parsedRequest.success) {
    const hasAssignmentError = parsedRequest.error.issues.some((issue) => issue.path.includes("assignmentId"));
    return new Response(
      JSON.stringify({
        error: "Invalid request format",
        message: hasAssignmentError
          ? "Please provide the assignment that should be analyzed."
          : "Please provide a valid submission ID or list of submission IDs.",
        ...(includeValidationDetails ? { details: parsedRequest.error.issues } : {}),
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const integrityModel = getEnv("OPENAI_INTEGRITY_MODEL") || "gpt-4o-mini";
  const providerMode = resolveIntegrityProviderMode(rawBody);
  const shouldRunLegacy = providerMode === "llm_legacy";
  const shouldRunInternalProvider = providerMode === "internal_text_similarity" || providerMode === "both";
  const mossRunnerConfig = resolveMossRunnerConfig();
  const shouldRunMossProvider = Boolean(mossRunnerConfig);
  const requestedAssignmentId = parsedRequest.data.assignmentId ?? null;
  const requestedSubmissionIds = parsedRequest.data.submissionIds ?? (parsedRequest.data.submissionId ? [parsedRequest.data.submissionId] : []);

  if (!requestedAssignmentId) {
    return new Response(JSON.stringify({ flags: [], summary: "No submissions provided" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: assignment, error: assignmentError } = await userSupabase
    .from("assignments")
    .select("id, lecturer_id, title, description")
    .eq("id", requestedAssignmentId)
    .maybeSingle();

  if (assignmentError) {
    logError("check-plagiarism assignment query failed", assignmentError, {
      assignmentId: requestedAssignmentId,
      submissionCount: requestedSubmissionIds.length,
    });
    throw new Error("Failed to load assignment");
  }
  if (!assignment || assignment.lecturer_id !== user.id) {
    throw new HttpError(403, "You do not have access to this assignment");
  }

  let submissions: SubmissionRow[] = [];
  if (requestedSubmissionIds.length > 0) {
    const { data: requestedSubmissions, error: submissionsError } = await userSupabase
      .from("submissions")
      .select("id, assignment_id, student_id, student_name, student_email, file_name, file_url")
      .eq("assignment_id", requestedAssignmentId)
      .in("id", requestedSubmissionIds);

    if (submissionsError) {
      logError("check-plagiarism submissions query failed", submissionsError, {
        assignmentId: requestedAssignmentId,
        requestedSubmissionIds,
      });
      throw new Error("Failed to load submissions");
    }
    if (!requestedSubmissions || requestedSubmissions.length !== requestedSubmissionIds.length) {
      logWarn("check-plagiarism inaccessible_requested_submissions", {
        assignmentId: requestedAssignmentId,
        requestedSubmissionCount: requestedSubmissionIds.length,
        loadedSubmissionCount: requestedSubmissions?.length ?? 0,
      });
      throw new HttpError(403, "One or more submissions are not accessible");
    }

    submissions = requestedSubmissions;
  }

  const { data: assignmentSubmissions, error: assignmentSubmissionsError } = shouldRunInternalProvider || requestedSubmissionIds.length === 0
    ? await userSupabase
        .from("submissions")
        .select("id, assignment_id, student_id, student_name, student_email, file_name, file_url")
        .eq("assignment_id", requestedAssignmentId)
    : { data: submissions, error: null };

  if (assignmentSubmissionsError) {
    logError("check-plagiarism assignment-wide submissions query failed", assignmentSubmissionsError, {
      assignmentId: requestedAssignmentId,
    });
    throw new Error("Failed to load assignment submissions");
  }

  if (requestedSubmissionIds.length === 0) {
    submissions = assignmentSubmissions ?? [];
  }

  if (submissions.length === 0) {
    return new Response(JSON.stringify({ flags: [], summary: "No submissions provided" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const requestedSubmissionIdSet = new Set(
    requestedSubmissionIds.length > 0 ? requestedSubmissionIds : submissions.map((submission) => submission.id),
  );
  const comparisonSubmissions = assignmentSubmissions ?? submissions;
  const isSingleMode = submissions.length === 1;
  const warnings: string[] = [];
  if (comparisonSubmissions.length > LARGE_COHORT_WARNING_THRESHOLD) {
    logWarn("internal_similarity_large_cohort", {
      assignmentId: requestedAssignmentId,
      submissionCount: comparisonSubmissions.length,
      warningThreshold: LARGE_COHORT_WARNING_THRESHOLD,
    });
    warnings.push(
      `Large assignment cohort detected (${comparisonSubmissions.length} submissions). Integrity analysis may take longer than usual.`,
    );
  }

  const shouldSkipInternalSimilarityForCohortSize =
    shouldRunInternalProvider && comparisonSubmissions.length > MAX_INTERNAL_COMPARISON_SUBMISSIONS;
  const extractionSubmissions = shouldSkipInternalSimilarityForCohortSize ? submissions : comparisonSubmissions;

  const contentMap = new Map<string, Awaited<ReturnType<typeof fetchFileContent>>>();
  const processedContentMap = new Map<string, ProcessedSubmissionText>();
  logInfo("comparison_submission_extraction_started", {
    assignmentId: requestedAssignmentId,
    submissionCount: extractionSubmissions.length,
    cohortSubmissionCount: comparisonSubmissions.length,
    concurrency: EXTRACTION_CONCURRENCY,
  });

  const extractedComparisonContent = await mapWithConcurrency(
    extractionSubmissions,
    EXTRACTION_CONCURRENCY,
    async (sub) => ({
      submission: sub,
      content: await fetchFileContent(supabaseAdmin, sub),
    }),
  );

  for (const { submission: sub, content } of extractedComparisonContent) {
    contentMap.set(sub.id, content);
    const processed = preprocessSubmissionText(content.plainText);
    processed.extractionQuality = content.extractionQuality ?? undefined;
    processedContentMap.set(sub.id, processed);

    if (!requestedSubmissionIdSet.has(sub.id)) {
      continue;
    }

    if (!content.success && content.extractionError) {
      warnings.push(`${sub.file_name || sub.id}: ${content.extractionError}`);
    } else if (content.extractionWarning) {
      warnings.push(`${sub.file_name || sub.id}: ${content.extractionWarning}`);
    }

    if (content.fileType === "pdf" && content.extractionQuality && !content.extractionQuality.isUsable) {
      warnings.push(
        `Low-quality PDF extraction for ${sub.file_name || sub.id}: ${content.extractionQuality.reasons.join(" ")} Word count ${content.extractionQuality.wordCount}, quality ${content.extractionQuality.qualityScore}/100.`,
      );
    }
  }

  logInfo("comparison_submission_extraction_completed", {
    assignmentId: requestedAssignmentId,
    submissionCount: extractionSubmissions.length,
    cohortSubmissionCount: comparisonSubmissions.length,
    concurrency: EXTRACTION_CONCURRENCY,
  });
  logInfo(
    "comparison_submission_extraction_summary",
    {
      assignmentId: requestedAssignmentId,
      ...summarizeExtractionObservability({
        cohortSubmissionCount: comparisonSubmissions.length,
        extractedComparisonContent,
        requestedSubmissionIdSet,
      }),
    },
  );

  const studentIds = submissions.map((submission) => submission.student_id).filter((value): value is string => Boolean(value));
  const { data: profileRows, error: profileRowsError } = studentIds.length > 0
    ? await supabaseAdmin
        .from("student_writing_profiles")
        .select("*")
        .in("student_id", studentIds)
    : { data: [], error: null };

  if (profileRowsError) {
    if (isRecoverablePersistenceError(profileRowsError)) {
      logWarn("student_writing_profiles unavailable, continuing without baseline persistence", {
        function: "check-plagiarism",
      });
    } else {
      logError("student_writing_profiles query failed", profileRowsError, {
        function: "check-plagiarism",
        assignmentId: requestedAssignmentId,
      });
      warnings.push("Writing profile history could not be loaded, but analysis completed.");
    }
  }

  const profileMap = new Map<string, StoredWritingProfile>(
    ((profileRows || []) as Array<Record<string, unknown>>).map((row) => [
      String(row.student_id),
      {
        average_sentence_complexity: Number(row.average_sentence_complexity || 0),
        lexile_level: Number(row.lexile_level || 0),
        error_fingerprint: Array.isArray(row.error_fingerprint)
          ? row.error_fingerprint.filter((item): item is string => typeof item === "string")
          : [],
        vocabulary_breadth: Number(row.vocabulary_breadth || 0),
        word_count: Number((row.baseline_vector as Record<string, unknown> | null)?.word_count || 0),
        sentence_count: Number((row.baseline_vector as Record<string, unknown> | null)?.sentence_count || 0),
        average_words_per_sentence: Number(
          (row.baseline_vector as Record<string, unknown> | null)?.average_words_per_sentence || 0,
        ),
        sample_count: Number(row.sample_count || 0),
      },
    ]),
  );

  const { data: studentSubmissions } = studentIds.length > 0
    ? await supabaseAdmin.from("submissions").select("id, student_id").in("student_id", studentIds)
    : { data: [] };
  const allStudentSubmissionIds = (studentSubmissions || []).map((submission) => submission.id);
  const { data: gradeRows } = allStudentSubmissionIds.length > 0
    ? await supabaseAdmin.from("grades").select("submission_id, ai_score, final_score").in("submission_id", allStudentSubmissionIds)
    : { data: [] };
  const gradeMap = new Map<string, number>(
    (gradeRows || [])
      .filter((row) => row.final_score != null || row.ai_score != null)
      .map((row) => [row.submission_id, Number(row.final_score ?? row.ai_score)]),
  );

  const submissionIdsByStudent = new Map<string, string[]>();
  for (const row of studentSubmissions || []) {
    if (!row.student_id) continue;
    const list = submissionIdsByStudent.get(row.student_id) || [];
    list.push(row.id);
    submissionIdsByStudent.set(row.student_id, list);
  }

  return {
    corsHeaders,
    startedAt: Date.now(),
    userSupabase,
    supabaseAdmin,
    user,
    assignment,
    requestedAssignmentId,
    requestedSubmissionIds,
    requestedSubmissionIdSet,
    submissions,
    comparisonSubmissions,
    isSingleMode,
    warnings,
    contentMap,
    processedContentMap,
    profileMap,
    gradeMap,
    submissionIdsByStudent,
    integrityModel,
    providerMode,
    shouldRunLegacy,
    shouldRunInternalProvider,
    mossRunnerConfig,
    shouldRunMossProvider,
    shouldSkipInternalSimilarityForCohortSize,
    extractionSubmissions,
  };
}
