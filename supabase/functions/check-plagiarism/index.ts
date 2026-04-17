import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";
import { createResponse, extractOutputText, getModel, parseJsonText } from "../_shared/openai.ts";
import {
  computeBaselineDeviation,
  computeWritingProfileMetrics,
  mergeWritingProfile,
  normalizeReadableText,
  type StoredWritingProfile,
  type WritingProfileMetrics,
} from "../_shared/text-analysis.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type IntegrityType = "similarity" | "ai-writing" | "baseline-deviation" | "mixed";

type IntegrityFlag = {
  student_a: string;
  student_b: string;
  submission_a_id: string;
  submission_b_id: string;
  similarity_score: number;
  ai_suspicion_score: number;
  baseline_deviation_score: number;
  total_risk_score: number;
  reason: string;
  evidence_summary: string;
  matched_excerpt: string;
  recommended_action: "clear" | "review" | "investigate";
  integrity_type: IntegrityType;
  severity: "low" | "medium" | "high";
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  file_name: string | null;
  file_url?: string;
};

function clampScore(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeSeverity(value: unknown): IntegrityFlag["severity"] {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function normalizeAction(value: unknown): IntegrityFlag["recommended_action"] {
  return value === "clear" || value === "review" || value === "investigate" ? value : "review";
}

function normalizeType(value: unknown): IntegrityType {
  return value === "similarity" || value === "ai-writing" || value === "baseline-deviation" || value === "mixed"
    ? value
    : "mixed";
}

function enforceScoreBand(score: number, min: number, max: number) {
  return Math.max(min, Math.min(max, score));
}

function normalizeScoresByContext(
  similarityScore: number,
  aiSuspicionScore: number,
  severity: IntegrityFlag["severity"],
  integrityType: IntegrityType,
  recommendedAction: IntegrityFlag["recommended_action"],
) {
  let normalizedSimilarity = similarityScore;
  let normalizedAi = aiSuspicionScore;

  if (integrityType === "similarity" || integrityType === "mixed") {
    if (severity === "high" || recommendedAction === "investigate") {
      normalizedSimilarity = enforceScoreBand(normalizedSimilarity, 75, 100);
    } else if (severity === "medium" || recommendedAction === "review") {
      normalizedSimilarity = enforceScoreBand(normalizedSimilarity, 45, 74);
    } else {
      normalizedSimilarity = enforceScoreBand(normalizedSimilarity, 0, 44);
    }
  }

  if (integrityType === "ai-writing" || integrityType === "mixed") {
    if (severity === "high" || recommendedAction === "investigate") {
      normalizedAi = enforceScoreBand(normalizedAi, 75, 100);
    } else if (severity === "medium" || recommendedAction === "review") {
      normalizedAi = enforceScoreBand(normalizedAi, 45, 74);
    } else {
      normalizedAi = enforceScoreBand(normalizedAi, 0, 44);
    }
  }

  return {
    similarity: normalizedSimilarity,
    ai: normalizedAi,
  };
}

function computeRisk(similarity: number, aiSuspicion: number, baselineDeviation: number) {
  return Math.round(similarity * 0.4 + aiSuspicion * 0.3 + baselineDeviation * 0.3);
}

function severityFromRisk(score: number): IntegrityFlag["severity"] {
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function actionFromRisk(score: number): IntegrityFlag["recommended_action"] {
  if (score >= 80) return "investigate";
  if (score >= 45) return "review";
  return "clear";
}

function decodePdfText(base64: string) {
  try {
    const binary = atob(base64);
    const printable = binary.match(/[\x20-\x7E]{4,}/g) || [];
    return normalizeReadableText(printable.join(" ").replace(/\s+/g, " "));
  } catch {
    return "";
  }
}

function isRecoverablePersistenceError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string; details?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "42703" ||
    candidate.code === "23514" ||
    candidate.message?.toLowerCase().includes("does not exist") === true ||
    candidate.message?.toLowerCase().includes("check constraint") === true
  );
}

async function fetchFileContent(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  sub: { file_url?: string; file_name?: string | null },
): Promise<{ llmContent: string; plainText: string; isPdf: boolean }> {
  if (!sub.file_url) return { llmContent: "", plainText: "", isPdf: false };
  try {
    const { data, error } = await supabaseAdmin.storage.from("submissions").download(sub.file_url);
    if (error || !data) return { llmContent: "", plainText: "", isPdf: false };

    const isPdf = data.type?.includes("pdf") || sub.file_name?.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      const buf = await data.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const llmContent = btoa(binary);
      return { llmContent, plainText: decodePdfText(llmContent), isPdf: true };
    }

    const text = await data.text();
    return { llmContent: text, plainText: normalizeReadableText(text), isPdf: false };
  } catch {
    return { llmContent: "", plainText: "", isPdf: false };
  }
}

function normalizeFlags(flags: unknown, submissions: SubmissionRow[]): IntegrityFlag[] {
  if (!Array.isArray(flags)) return [];

  return flags
    .map((flag) => {
      if (!flag || typeof flag !== "object") return null;
      const candidate = flag as Record<string, unknown>;
      const submissionAId = typeof candidate.submission_a_id === "string" ? candidate.submission_a_id : "";
      const submissionBId =
        typeof candidate.submission_b_id === "string" && candidate.submission_b_id
          ? candidate.submission_b_id
          : submissionAId;
      const submissionA = submissions.find((entry) => entry.id === submissionAId);
      const submissionB = submissions.find((entry) => entry.id === submissionBId);
      const severity = normalizeSeverity(candidate.severity);
      const recommendedAction = normalizeAction(candidate.recommended_action);
      const integrityType = normalizeType(candidate.integrity_type);
      const normalizedScores = normalizeScoresByContext(
        clampScore(candidate.similarity_score),
        clampScore(candidate.ai_suspicion_score),
        severity,
        integrityType,
        recommendedAction,
      );
      const baselineDeviationScore = clampScore(candidate.baseline_deviation_score);
      const totalRisk = computeRisk(normalizedScores.similarity, normalizedScores.ai, baselineDeviationScore);

      return {
        student_a:
          (typeof candidate.student_a === "string" && candidate.student_a.trim()) ||
          submissionA?.student_name ||
          submissionA?.student_email ||
          "Student A",
        student_b:
          (typeof candidate.student_b === "string" && candidate.student_b.trim()) ||
          submissionB?.student_name ||
          submissionB?.student_email ||
          (submissionAId === submissionBId ? "Writing profile" : "Student B"),
        submission_a_id: submissionAId,
        submission_b_id: submissionBId,
        similarity_score: normalizedScores.similarity,
        ai_suspicion_score: normalizedScores.ai,
        baseline_deviation_score: baselineDeviationScore,
        total_risk_score: totalRisk,
        reason:
          typeof candidate.reason === "string" && candidate.reason.trim()
            ? candidate.reason.trim()
            : "Potential integrity issue detected.",
        evidence_summary:
          typeof candidate.evidence_summary === "string" && candidate.evidence_summary.trim()
            ? candidate.evidence_summary.trim()
            : "Potential integrity issue detected.",
        matched_excerpt: typeof candidate.matched_excerpt === "string" ? candidate.matched_excerpt.trim() : "",
        recommended_action: recommendedAction,
        integrity_type: integrityType,
        severity: severityFromRisk(totalRisk),
      } satisfies IntegrityFlag;
    })
    .filter((flag): flag is IntegrityFlag => Boolean(flag))
    .filter(
      (flag) =>
        flag.similarity_score > 0 || flag.ai_suspicion_score > 0 || flag.baseline_deviation_score > 0 || flag.total_risk_score > 0,
    );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const integrityModel = getModel("OPENAI_INTEGRITY_MODEL", "gpt-5.4-mini");
    const { user } = await requireLecturer(req);
    const requestedAssignmentId = body?.assignmentId ?? null;
    const requestedSubmissionIds = Array.isArray(body?.submissionIds)
      ? body.submissionIds
      : Array.isArray(body?.submissions)
        ? body.submissions
            .map((submission: { id?: string } | string) => (typeof submission === "string" ? submission : submission?.id))
            .filter(Boolean)
        : [];

    if (!requestedAssignmentId || requestedSubmissionIds.length === 0) {
      return new Response(JSON.stringify({ flags: [], summary: "No submissions provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createAdminClient();
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("assignments")
      .select("id, lecturer_id, title, description")
      .eq("id", requestedAssignmentId)
      .maybeSingle();

    if (assignmentError) throw new Error("Failed to load assignment");
    if (!assignment || assignment.lecturer_id !== user.id) {
      throw new HttpError(403, "You do not have access to this assignment");
    }

    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from("submissions")
      .select("id, assignment_id, student_id, student_name, student_email, file_name, file_url")
      .eq("assignment_id", requestedAssignmentId)
      .in("id", requestedSubmissionIds);

    if (submissionsError) throw new Error("Failed to load submissions");
    if (!submissions || submissions.length !== requestedSubmissionIds.length) {
      throw new HttpError(403, "One or more submissions are not accessible");
    }

    const isSingleMode = submissions.length === 1;
    const contentMap = new Map<string, { llmContent: string; plainText: string; isPdf: boolean }>();
    for (const sub of submissions) {
      contentMap.set(sub.id, await fetchFileContent(supabaseAdmin, sub));
    }

    const studentIds = submissions.map((submission) => submission.student_id).filter((value): value is string => Boolean(value));
    const { data: profileRows, error: profileRowsError } = studentIds.length > 0
      ? await supabaseAdmin
          .from("student_writing_profiles")
          .select("*")
          .in("student_id", studentIds)
      : { data: [], error: null };

    if (profileRowsError) {
      if (isRecoverablePersistenceError(profileRowsError)) {
        console.warn("student_writing_profiles unavailable, continuing without baseline persistence:", profileRowsError);
      } else {
        throw profileRowsError;
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

    const systemPrompt = isSingleMode
      ? `You are an academic integrity detection assistant.

Your output is a risk indicator, never a verdict.

Assess AI-writing suspicion using multiple indicators:
- unnatural consistency
- generic phrasing
- shallow but polished analysis
- limited revision traces
- overly formulaic structure

Do not flag strong writing alone. Moderate or high risk requires multiple concerns.`
      : `You are an academic integrity analyst.

Compare submissions for suspicious similarity and independently assess AI-writing suspicion.

Rules:
- Similarity concerns must be based on substantive overlap in student-authored content.
- Ignore prompt text, boilerplate templates, file metadata, and PDF artefacts.
- AI-writing concerns must rely on multiple indicators rather than one stylistic feature.
- Never output a verdict, only a risk indicator with evidence.`;

    const userContent: Array<Record<string, string>> = [];

    if (isSingleMode) {
      const sub = submissions[0];
      const content = contentMap.get(sub.id) || { llmContent: "", plainText: "", isPdf: false };
      const preview = content.plainText.substring(0, 15000);

      userContent.push({
        type: "input_text",
        text: `Analyse this submission for AI-writing suspicion only.

Assignment: ${assignment.title}
Student: ${sub.student_name || sub.student_email || "Anonymous"}
File: ${sub.file_name || "submission"}

${content.isPdf ? "PDF is attached. Use it as the primary source." : `Content:\n${preview}`}

Return a structured flag only if there is a genuine concern. Otherwise return no flags.`,
      });

      if (content.isPdf && content.llmContent) {
        userContent.push({
          type: "input_file",
          filename: sub.file_name || "submission.pdf",
          file_data: `data:application/pdf;base64,${content.llmContent}`,
        });
      }
    } else {
      const summaries = submissions.map((submission) => {
        const content = contentMap.get(submission.id) || { llmContent: "", plainText: "", isPdf: false };
        if (content.isPdf) {
          return `${submission.student_name || submission.student_email || "Anonymous"} (submission id: ${submission.id}, PDF attached)`;
        }

        return `${submission.student_name || submission.student_email || "Anonymous"} (submission id: ${submission.id})\n${content.plainText.substring(0, 8000)}`;
      });

      userContent.push({
        type: "input_text",
        text: `Analyse these submissions for suspicious similarity and AI-writing indicators.

Assignment: ${assignment.title}

Submissions:
${summaries.join("\n\n---\n\n")}

Only flag real concerns. Return valid JSON only.`,
      });

      submissions.forEach((submission) => {
        const content = contentMap.get(submission.id) || { llmContent: "", plainText: "", isPdf: false };
        if (content.isPdf && content.llmContent) {
          userContent.push({
            type: "input_file",
            filename: submission.file_name || `${submission.id}.pdf`,
            file_data: `data:application/pdf;base64,${content.llmContent}`,
          });
        }
      });
    }

    const aiData = await createResponse({
      model: integrityModel,
      input: [
        { role: "developer", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: userContent },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "report_integrity_results",
          schema: {
            type: "object",
            properties: {
              flags: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    student_a: { type: "string" },
                    student_b: { type: "string" },
                    submission_a_id: { type: "string" },
                    submission_b_id: { type: "string" },
                    similarity_score: { type: "number" },
                    ai_suspicion_score: { type: "number" },
                    baseline_deviation_score: { type: "number" },
                    total_risk_score: { type: "number" },
                    reason: { type: "string" },
                    evidence_summary: { type: "string" },
                    matched_excerpt: { type: "string" },
                    recommended_action: { type: "string", enum: ["clear", "review", "investigate"] },
                    integrity_type: {
                      type: "string",
                      enum: ["similarity", "ai-writing", "baseline-deviation", "mixed"],
                    },
                    severity: { type: "string", enum: ["low", "medium", "high"] },
                  },
                  required: [
                    "student_a",
                    "student_b",
                    "submission_a_id",
                    "submission_b_id",
                    "similarity_score",
                    "ai_suspicion_score",
                    "baseline_deviation_score",
                    "total_risk_score",
                    "reason",
                    "evidence_summary",
                    "matched_excerpt",
                    "recommended_action",
                    "integrity_type",
                    "severity",
                  ],
                  additionalProperties: false,
                },
              },
              summary: { type: "string" },
            },
            required: ["flags", "summary"],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    });

    let parsedFlags: IntegrityFlag[] = [];
    let summary = "Analysis complete";
    try {
      const parsed = parseJsonText(extractOutputText(aiData));
      parsedFlags = normalizeFlags(parsed?.flags, submissions);
      summary = typeof parsed?.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : summary;
    } catch {
      parsedFlags = normalizeFlags(aiData?.output?.[0]?.content?.[0]?.json?.flags, submissions);
    }

    const similarityBySubmission = new Map<string, number>();
    const aiBySubmission = new Map<string, number>();
    for (const flag of parsedFlags) {
      similarityBySubmission.set(
        flag.submission_a_id,
        Math.max(flag.similarity_score, similarityBySubmission.get(flag.submission_a_id) || 0),
      );
      aiBySubmission.set(
        flag.submission_a_id,
        Math.max(flag.ai_suspicion_score, aiBySubmission.get(flag.submission_a_id) || 0),
      );
      if (flag.submission_b_id && flag.submission_b_id !== flag.submission_a_id) {
        similarityBySubmission.set(
          flag.submission_b_id,
          Math.max(flag.similarity_score, similarityBySubmission.get(flag.submission_b_id) || 0),
        );
      }
    }

    const syntheticFlags: IntegrityFlag[] = [];
    const profileUpserts: Array<Record<string, unknown>> = [];
    const snapshots = new Map<
      string,
      {
        totalScore: number;
        aiWritingScore: number;
        similarityScore: number;
        baselineDeviationScore: number;
        riskLevel: "high" | "medium" | "low";
        evidence: {
          aiWriting: Array<{ label: string; value: string; score: number }>;
          similarity: Array<{ label: string; value: string; score: number }>;
          baselineDeviation: Array<{ label: string; value: string; score: number }>;
        };
        flags: string[];
      }
    >();

    const ensureSnapshot = (submission: SubmissionRow) => {
      const existing = snapshots.get(submission.id);
      if (existing) return existing;
      const next = {
        totalScore: 0,
        aiWritingScore: 0,
        similarityScore: 0,
        baselineDeviationScore: 0,
        riskLevel: "low" as const,
        evidence: {
          aiWriting: [] as Array<{ label: string; value: string; score: number }>,
          similarity: [] as Array<{ label: string; value: string; score: number }>,
          baselineDeviation: [] as Array<{ label: string; value: string; score: number }>,
        },
        flags: [] as string[],
      };
      snapshots.set(submission.id, next);
      return next;
    };

    for (const submission of submissions) {
      const content = contentMap.get(submission.id) || { llmContent: "", plainText: "", isPdf: false };
      const metrics: WritingProfileMetrics = computeWritingProfileMetrics(content.plainText);
      const baseline = submission.student_id ? profileMap.get(submission.student_id) : null;
      const currentGrade = gradeMap.get(submission.id) ?? null;
      const previousAverage =
        submission.student_id && submissionIdsByStudent.has(submission.student_id)
          ? (() => {
              const previousScores = (submissionIdsByStudent.get(submission.student_id) || [])
                .filter((id) => id !== submission.id)
                .map((id) => gradeMap.get(id))
                .filter((score): score is number => typeof score === "number");
              return previousScores.length > 0
                ? previousScores.reduce((sum, score) => sum + score, 0) / previousScores.length
                : null;
            })()
          : null;

      const baselineDeviation = computeBaselineDeviation(baseline, metrics, {
        previousAverage,
        currentGrade,
      });
      const similarityScore = similarityBySubmission.get(submission.id) || 0;
      const aiScore = aiBySubmission.get(submission.id) || 0;
      const totalRiskScore = computeRisk(similarityScore, aiScore, baselineDeviation.score);
      const snapshot = ensureSnapshot(submission);
      snapshot.totalScore = Math.max(snapshot.totalScore, totalRiskScore);
      snapshot.aiWritingScore = Math.max(snapshot.aiWritingScore, aiScore);
      snapshot.similarityScore = Math.max(snapshot.similarityScore, similarityScore);
      snapshot.baselineDeviationScore = Math.max(snapshot.baselineDeviationScore, baselineDeviation.score);
      snapshot.riskLevel = severityFromRisk(snapshot.totalScore) === "high"
        ? "high"
        : severityFromRisk(snapshot.totalScore) === "medium"
          ? "medium"
          : "low";

      if (baselineDeviation.reasons.length > 0) {
        snapshot.evidence.baselineDeviation.push({
          label: "Writing profile deviation",
          value: baselineDeviation.reasons.join(" "),
          score: baselineDeviation.score,
        });
        snapshot.flags.push("baseline deviation");
      }

      if (submission.student_id && metrics.word_count >= 80 && totalRiskScore < 45) {
        const merged = mergeWritingProfile(baseline, metrics);
        profileUpserts.push({
          student_id: submission.student_id,
          average_sentence_complexity: merged.average_sentence_complexity,
          lexile_level: merged.lexile_level,
          error_fingerprint: merged.error_fingerprint,
          vocabulary_breadth: merged.vocabulary_breadth,
          sample_count: merged.sample_count,
          baseline_vector: {
            word_count: merged.word_count,
            sentence_count: merged.sentence_count,
            average_words_per_sentence: merged.average_words_per_sentence,
          },
        });
      }

      if (baselineDeviation.score >= 45) {
        syntheticFlags.push({
          student_a: submission.student_name || submission.student_email || "Student",
          student_b: "Writing baseline",
          submission_a_id: submission.id,
          submission_b_id: submission.id,
          similarity_score: similarityScore,
          ai_suspicion_score: aiScore,
          baseline_deviation_score: baselineDeviation.score,
          total_risk_score: totalRiskScore,
          reason: baselineDeviation.reasons[0] || "The submission deviates materially from the student's stored writing profile.",
          evidence_summary: baselineDeviation.reasons.join(" "),
          matched_excerpt: content.plainText.substring(0, 240),
          recommended_action: actionFromRisk(totalRiskScore),
          integrity_type: baselineDeviation.score > 0 && (similarityScore > 0 || aiScore > 0) ? "mixed" : "baseline-deviation",
          severity: severityFromRisk(totalRiskScore),
        });
      }
    }

    for (const flag of parsedFlags) {
      const submission = submissions.find((item) => item.id === flag.submission_a_id);
      if (!submission) continue;
      const snapshot = ensureSnapshot(submission);
      snapshot.totalScore = Math.max(snapshot.totalScore, flag.total_risk_score);
      snapshot.aiWritingScore = Math.max(snapshot.aiWritingScore, flag.ai_suspicion_score);
      snapshot.similarityScore = Math.max(snapshot.similarityScore, flag.similarity_score);
      snapshot.baselineDeviationScore = Math.max(snapshot.baselineDeviationScore, flag.baseline_deviation_score);
      snapshot.riskLevel = severityFromRisk(snapshot.totalScore) === "high"
        ? "high"
        : severityFromRisk(snapshot.totalScore) === "medium"
          ? "medium"
          : "low";

      if (flag.ai_suspicion_score > 0) {
        snapshot.evidence.aiWriting.push({
          label: "AI-writing risk",
          value: flag.evidence_summary || flag.reason,
          score: flag.ai_suspicion_score,
        });
        snapshot.flags.push("ai writing suspicion");
      }

      if (flag.similarity_score > 0) {
        snapshot.evidence.similarity.push({
          label: "Similarity overlap",
          value: flag.reason,
          score: flag.similarity_score,
        });
        snapshot.flags.push("similarity overlap");
      }
    }

    const allFlags = [...parsedFlags, ...syntheticFlags].filter((flag, index, array) => {
      return (
        array.findIndex(
          (item) =>
            item.submission_a_id === flag.submission_a_id &&
            item.submission_b_id === flag.submission_b_id &&
            item.reason === flag.reason,
        ) === index
      );
    });

    const { data: existingReviews, error: reviewsError } = await supabaseAdmin
      .from("academic_integrity_reviews")
      .select("submission_id, decision, lecturer_note, updated_at")
      .in("submission_id", submissions.map((submission) => submission.id))
      .eq("lecturer_id", user.id);

    if (reviewsError && !isRecoverablePersistenceError(reviewsError)) throw reviewsError;
    if (reviewsError) {
      console.warn("academic_integrity_reviews unavailable, continuing without persisted reviews:", reviewsError);
    }

    const existingReviewMap = new Map(
      ((existingReviews || []) as Array<Record<string, unknown>>).map((review) => [String(review.submission_id), review]),
    );

    const reviewUpserts = submissions
      .map((submission) => {
        const snapshot = snapshots.get(submission.id) || null;
        const existingReview = existingReviewMap.get(submission.id);
        if (!snapshot && !existingReview) return null;

        const notePayload = (() => {
          if (existingReview?.lecturer_note && typeof existingReview.lecturer_note === "string") {
            try {
              const parsed = JSON.parse(existingReview.lecturer_note);
              return {
                latestNote: typeof parsed.latestNote === "string" ? parsed.latestNote : "",
                history: Array.isArray(parsed.history) ? parsed.history : [],
              };
            } catch {
              return { latestNote: "", history: [] };
            }
          }
          return { latestNote: "", history: [] };
        })();

        return {
          submission_id: submission.id,
          lecturer_id: user.id,
          review_type:
            snapshot && snapshot.baselineDeviationScore > 0 && snapshot.aiWritingScore === 0 && snapshot.similarityScore === 0
              ? "baseline-deviation"
              : snapshot && snapshot.aiWritingScore > 0 && snapshot.similarityScore > 0
                ? "mixed"
                : snapshot && snapshot.aiWritingScore > 0
                  ? "ai-writing-suspicion"
                  : "similarity-plagiarism-suspicion",
          decision: String(existingReview?.decision || "pending"),
          evidence_summary: snapshot
            ? [
                ...snapshot.evidence.aiWriting.map((entry) => `${entry.label}: ${entry.value}`),
                ...snapshot.evidence.similarity.map((entry) => `${entry.label}: ${entry.value}`),
                ...snapshot.evidence.baselineDeviation.map((entry) => `${entry.label}: ${entry.value}`),
              ]
                .slice(0, 8)
                .join("\n\n") || null
            : null,
          lecturer_note: JSON.stringify({
            latestNote: notePayload.latestNote,
            history: notePayload.history,
            integritySnapshot: snapshot,
          }),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (reviewUpserts.length > 0) {
      const { error: persistError } = await supabaseAdmin
        .from("academic_integrity_reviews")
        .upsert(reviewUpserts, { onConflict: "submission_id,lecturer_id" });
      if (persistError && !isRecoverablePersistenceError(persistError)) throw persistError;
      if (persistError) {
        console.warn("Failed to persist academic integrity reviews, returning analysis without persistence:", persistError);
      }
    }

    if (profileUpserts.length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from("student_writing_profiles")
        .upsert(profileUpserts, { onConflict: "student_id" });
      if (profileError && !isRecoverablePersistenceError(profileError)) {
        throw profileError;
      }
      if (profileError) {
        console.error("Failed to update writing profiles:", profileError);
      }
    }

    const finalSummary =
      allFlags.length > 0
        ? `${summary} ${allFlags.length} submission(s) crossed one or more integrity risk thresholds.`
        : `${summary} No submissions crossed the current integrity thresholds.`;

    return new Response(JSON.stringify({ flags: allFlags, summary: finalSummary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-plagiarism error:", e);
    return jsonError(e, corsHeaders);
  }
});
