import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";
import { createResponse, extractOutputText, getModel, parseJsonText } from "../_shared/openai.ts";
import { classifyAssignmentType, type AssignmentType } from "../_shared/text-analysis.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CONFIDENCE_THRESHOLD = 0.7;

type RubricCriterion = {
  criterion: string;
  weight: number;
  description?: string;
};

type GradeBreakdownItem = {
  criterion: string;
  score: number;
  max_score: number;
  comment: string;
  evidence_snippet: string;
  confidence_score: number;
  review_required: boolean;
  error_type?: "arithmetic_slip" | "conceptual_flaw" | "none";
};

type MathAnalysis = {
  symbolic_extraction: string[];
  derivation_checks: Array<{
    step_label: string;
    status: "valid" | "unclear" | "invalid";
    rationale: string;
  }>;
  error_classification: "arithmetic_slip" | "conceptual_flaw" | "none";
  solver_signals: string[];
};

function clampScore(value: unknown, maxScore: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(maxScore, Number(numeric.toFixed(2))));
}

function clampConfidence(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, Number(numeric.toFixed(2))));
}

function normalizeEvidence(value: unknown) {
  if (typeof value !== "string") return "No supporting quote extracted.";
  const text = value.trim();
  if (!text) return "No supporting quote extracted.";
  return text.slice(0, 280);
}

function normalizeComment(value: unknown) {
  if (typeof value !== "string") return "No criterion-specific comment provided.";
  const text = value.trim();
  return text || "No criterion-specific comment provided.";
}

function normalizeErrorType(value: unknown): GradeBreakdownItem["error_type"] {
  return value === "arithmetic_slip" || value === "conceptual_flaw" || value === "none" ? value : "none";
}

function normalizeBreakdown(raw: unknown, rubric: RubricCriterion[]) {
  const provided = Array.isArray(raw) ? raw : [];
  const byCriterion = new Map(
    provided
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const breakdown = item as Record<string, unknown>;
        const criterion = typeof breakdown.criterion === "string" ? breakdown.criterion.trim() : "";
        return [criterion.toLowerCase(), breakdown] as const;
      }),
  );

  const breakdown: GradeBreakdownItem[] = rubric.map((criterion) => {
    const matched = byCriterion.get(criterion.criterion.toLowerCase());
    const maxScore = criterion.weight;
    const score = clampScore(matched?.score, maxScore);
    const confidence = clampConfidence(matched?.confidence_score);
    const reviewRequired =
      typeof matched?.review_required === "boolean" ? matched.review_required : confidence < CONFIDENCE_THRESHOLD;

    return {
      criterion: criterion.criterion,
      score,
      max_score: maxScore,
      comment: normalizeComment(matched?.comment),
      evidence_snippet: normalizeEvidence(matched?.evidence_snippet),
      confidence_score: confidence,
      review_required: reviewRequired,
      error_type: normalizeErrorType(matched?.error_type),
    };
  });

  const total = Number(breakdown.reduce((sum, item) => sum + item.score, 0).toFixed(2));
  const averageConfidence =
    breakdown.length > 0
      ? Number(
          (
            breakdown.reduce((sum, item) => sum + item.confidence_score * item.max_score, 0) /
            Math.max(1, breakdown.reduce((sum, item) => sum + item.max_score, 0))
          ).toFixed(3),
        )
      : 0;

  const reviewReasons = breakdown
    .filter((item) => item.review_required)
    .map((item) => `${item.criterion} confidence ${item.confidence_score}`);

  return { breakdown, total, averageConfidence, reviewReasons };
}

function normalizeMathAnalysis(raw: unknown): MathAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const derivationChecks = Array.isArray(candidate.derivation_checks)
    ? candidate.derivation_checks
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const entry = item as Record<string, unknown>;
          const status = entry.status === "valid" || entry.status === "unclear" || entry.status === "invalid"
            ? entry.status
            : "unclear";
          return {
            step_label: typeof entry.step_label === "string" ? entry.step_label.trim() || "Step" : "Step",
            status,
            rationale: typeof entry.rationale === "string" ? entry.rationale.trim() : "",
          };
        })
    : [];

  const symbolicExtraction = Array.isArray(candidate.symbolic_extraction)
    ? candidate.symbolic_extraction.filter((item): item is string => typeof item === "string").slice(0, 12)
    : [];

  const solverSignals = Array.isArray(candidate.solver_signals)
    ? candidate.solver_signals.filter((item): item is string => typeof item === "string").slice(0, 8)
    : [];

  return {
    symbolic_extraction: symbolicExtraction,
    derivation_checks: derivationChecks,
    error_classification:
      candidate.error_classification === "arithmetic_slip" ||
      candidate.error_classification === "conceptual_flaw" ||
      candidate.error_classification === "none"
        ? candidate.error_classification
        : "none",
    solver_signals: solverSignals,
  };
}

function normalizeOverallScore(value: unknown, maxScore: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return clampScore(numeric, maxScore);
}

async function fetchSubmissionContent(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  sub: { file_url: string; file_name: string | null },
) {
  const { data: fileData, error: dlError } = await supabaseAdmin.storage
    .from("submissions")
    .download(sub.file_url);

  if (dlError || !fileData) {
    throw new Error("Failed to download file");
  }

  const isPdf = sub.file_name?.toLowerCase().endsWith(".pdf") || fileData.type?.includes("pdf");
  if (isPdf) {
    const arrayBuf = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return { isPdf: true, content: btoa(binary) };
  }

  return { isPdf: false, content: await fileData.text() };
}

function buildSystemPrompt(assignmentType: AssignmentType, rubricLength: number, maxScore: number) {
  const baseRules = `You are a university grading engine operating in a deterministic rubric pipeline.

Rules:
- First classify the submission style already provided as AssignmentType and stay within that marking mode.
- Evaluate each rubric criterion in isolation.
- Return exactly ${rubricLength} criterion rows in the same order as the rubric.
- Every criterion row must contain:
  - criterion
  - score
  - max_score
  - comment
  - evidence_snippet
  - confidence_score from 0.0 to 1.0
  - review_required
- The evidence_snippet must quote or closely excerpt the student's submission, not the rubric.
- The sum of criterion scores must equal the final score.
- Never omit evidence even when the score is low.
- If confidence is below ${CONFIDENCE_THRESHOLD}, set review_required to true.
- Output valid JSON only.`;

  if (assignmentType === "Mathematics" || assignmentType === "Problem Solving") {
    return `${baseRules}

You are in MATHEMATICS / LOGIC-CHECKER mode.

Maths-specific rules:
- Prioritise symbolic correctness, derivation validity, and whether each step follows from the previous one.
- Distinguish arithmetic slips from conceptual flaws.
- Apply carry-forward credit for arithmetic slips when later reasoning remains coherent.
- Flag solver-like behaviour when there are impossible leaps, notation mismatches, or correct final answers without adequate working.
- Include a math_analysis object with:
  - symbolic_extraction: array of key expressions or equations you identified
  - derivation_checks: array of step checks with step_label, status, rationale
  - error_classification: arithmetic_slip | conceptual_flaw | none
  - solver_signals: array of suspicious solver-signature observations
- For each criterion, set error_type to arithmetic_slip, conceptual_flaw, or none.
- Do not judge mathematical work mainly by prose style.
- Final score is out of ${maxScore}.`;
  }

  const specialization =
    assignmentType === "Code"
      ? "Focus on correctness, completeness, structure, and whether the code or explanation matches the requirement."
      : assignmentType === "Reflective"
        ? "Focus on authentic reflection, specificity, self-awareness, and application of learning."
        : assignmentType === "Report"
          ? "Focus on structure, evidence, analysis, and professional communication."
          : "Focus on argument quality, evidence, relevance, and conceptual understanding.";

  return `${baseRules}

You are in ${assignmentType.toUpperCase()} mode.
${specialization}
- Final score is out of ${maxScore}.`;
}

function buildResponseSchema(rubricLength: number, includeMathAnalysis: boolean) {
  const schema: Record<string, unknown> = {
    type: "object",
    properties: {
      assignment_type: { type: "string" },
      score: { type: "number" },
      feedback: { type: "string" },
      grading_confidence: { type: "number" },
      requires_lecturer_review: { type: "boolean" },
      review_reasons: {
        type: "array",
        items: { type: "string" },
      },
      breakdown: {
        type: "array",
        minItems: rubricLength,
        maxItems: rubricLength,
        items: {
          type: "object",
          properties: {
            criterion: { type: "string" },
            score: { type: "number" },
            max_score: { type: "number" },
            comment: { type: "string" },
            evidence_snippet: { type: "string" },
            confidence_score: { type: "number" },
            review_required: { type: "boolean" },
            error_type: {
              type: "string",
              enum: ["arithmetic_slip", "conceptual_flaw", "none"],
            },
          },
          required: [
            "criterion",
            "score",
            "max_score",
            "comment",
            "evidence_snippet",
            "confidence_score",
            "review_required",
            "error_type",
          ],
          additionalProperties: false,
        },
      },
    },
    required: [
      "assignment_type",
      "score",
      "feedback",
      "grading_confidence",
      "requires_lecturer_review",
      "review_reasons",
      "breakdown",
    ],
    additionalProperties: false,
  };

  if (includeMathAnalysis) {
    (schema.properties as Record<string, unknown>).math_analysis = {
      type: "object",
      properties: {
        symbolic_extraction: { type: "array", items: { type: "string" } },
        derivation_checks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              step_label: { type: "string" },
              status: { type: "string", enum: ["valid", "unclear", "invalid"] },
              rationale: { type: "string" },
            },
            required: ["step_label", "status", "rationale"],
            additionalProperties: false,
          },
        },
        error_classification: {
          type: "string",
          enum: ["arithmetic_slip", "conceptual_flaw", "none"],
        },
        solver_signals: { type: "array", items: { type: "string" } },
      },
      required: ["symbolic_extraction", "derivation_checks", "error_classification", "solver_signals"],
      additionalProperties: false,
    };
    (schema.required as string[]).push("math_analysis");
  }

  return schema;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const gradingModel = getModel("OPENAI_GRADING_MODEL", "gpt-5.4-mini");

    const { user } = await requireLecturer(req);
    const requestedAssignmentId = body?.assignmentId ?? body?.assignment?.id ?? null;
    const requestedSubmissionIds = Array.isArray(body?.submissions)
      ? body.submissions
          .map((submission: { id?: string } | string) => typeof submission === "string" ? submission : submission?.id)
          .filter(Boolean)
      : [];

    if (!requestedAssignmentId || requestedSubmissionIds.length === 0) {
      throw new HttpError(400, "Missing assignment or submissions data");
    }

    const supabaseAdmin = createAdminClient();
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("assignments")
      .select("id, lecturer_id, title, description, module_code, max_score, rubric")
      .eq("id", requestedAssignmentId)
      .maybeSingle();

    if (assignmentError) throw new Error("Failed to load assignment");
    if (!assignment || assignment.lecturer_id !== user.id) {
      throw new HttpError(403, "You do not have access to this assignment");
    }

    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from("submissions")
      .select("id, assignment_id, student_name, student_email, file_name, file_url")
      .eq("assignment_id", requestedAssignmentId)
      .in("id", requestedSubmissionIds);

    if (submissionsError) throw new Error("Failed to load submissions");
    if (!submissions || submissions.length !== requestedSubmissionIds.length) {
      throw new HttpError(403, "One or more submissions are not accessible");
    }

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

    const results: Array<Record<string, unknown>> = [];

    for (const sub of submissions) {
      try {
        const { isPdf, content } = await fetchSubmissionContent(supabaseAdmin, sub);
        const textPreview = isPdf ? "" : content.substring(0, 18000);
        const assignmentType = classifyAssignmentType({
          title: assignment.title,
          description: assignment.description,
          rubricText,
          fileName: sub.file_name,
          text: textPreview,
        });
        const isMathMode = assignmentType === "Mathematics" || assignmentType === "Problem Solving";

        const systemPrompt = buildSystemPrompt(assignmentType, normalizedRubric.length, assignment.max_score);
        const prompt = `AssignmentType: ${assignmentType}

Assignment title: ${assignment.title}
Assignment description: ${assignment.description || "N/A"}
Module: ${assignment.module_code || "N/A"}
Maximum score: ${assignment.max_score}

Rubric:
${rubricText}

Student: ${sub.student_name || sub.student_email || "Anonymous"}
File: ${sub.file_name || "submission"}

Evaluate criterion-by-criterion. Do not award a score unless supported by the submission evidence.
If evidence is weak or ambiguous, reduce confidence and require lecturer review.
${isPdf ? "The student's PDF submission is attached below." : `Submission text:\n${textPreview}`}

Return valid JSON only.`;

        const responseInput = [
          { role: "developer", content: [{ type: "input_text", text: systemPrompt }] },
          {
            role: "user",
            content: isPdf
              ? [
                  { type: "input_text", text: prompt },
                  {
                    type: "input_file",
                    filename: sub.file_name || "submission.pdf",
                    file_data: `data:application/pdf;base64,${content}`,
                  },
                ]
              : [{ type: "input_text", text: prompt }],
          },
        ];

        const aiData = await createResponse({
          model: gradingModel,
          input: responseInput,
          text: {
            format: {
              type: "json_schema",
              name: "submit_grade",
              schema: buildResponseSchema(normalizedRubric.length, isMathMode),
              strict: true,
            },
          },
        });

        let gradeResult: Record<string, unknown> | null = null;
        try {
          gradeResult = parseJsonText(extractOutputText(aiData));
        } catch {
          gradeResult = aiData?.output?.[0]?.content?.[0]?.json ?? aiData?.output_parsed ?? null;
        }

        if (!gradeResult) throw new Error("Failed to parse AI response");

        const normalized = normalizeBreakdown(gradeResult.breakdown, normalizedRubric);
        const modelScore = normalizeOverallScore(gradeResult.score, assignment.max_score);
        const scoreAdjusted = modelScore != null && Math.abs(modelScore - normalized.total) > 1;
        const modelFeedback =
          typeof gradeResult.feedback === "string" && gradeResult.feedback.trim()
            ? gradeResult.feedback.trim()
            : "No detailed feedback was returned.";
        const gradingConfidence = clampConfidence(gradeResult.grading_confidence || normalized.averageConfidence);
        const reviewReasons = Array.isArray(gradeResult.review_reasons)
          ? gradeResult.review_reasons.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          : [];
        const mathAnalysis = normalizeMathAnalysis(gradeResult.math_analysis);

        if (mathAnalysis?.solver_signals.length) {
          reviewReasons.push(...mathAnalysis.solver_signals.map((signal) => `Solver signal: ${signal}`));
        }

        reviewReasons.push(...normalized.reviewReasons);

        const requiresLecturerReview =
          Boolean(gradeResult.requires_lecturer_review) ||
          gradingConfidence < CONFIDENCE_THRESHOLD ||
          normalized.breakdown.some((item) => item.review_required) ||
          Boolean(mathAnalysis?.solver_signals.length);

        const feedbackParts = [modelFeedback];
        if (scoreAdjusted) {
          feedbackParts.push("Final score was normalised to match the rubric breakdown total.");
        }
        if (requiresLecturerReview && reviewReasons.length > 0) {
          feedbackParts.push(`Lecturer review recommended: ${Array.from(new Set(reviewReasons)).join("; ")}`);
        }

        results.push({
          submissionId: sub.id,
          score: normalized.total,
          feedback: feedbackParts.join("\n\n"),
          breakdown: normalized.breakdown,
          assignmentType,
          gradingConfidence,
          requiresLecturerReview,
          reviewReasons: Array.from(new Set(reviewReasons)),
          gradingMetadata: {
            rubric_validated: true,
            confidence_threshold: CONFIDENCE_THRESHOLD,
            math_analysis: mathAnalysis,
          },
          rubricValidated: true,
          success: true,
        });
      } catch (gradeErr) {
        console.error("Grading error for", sub.id, gradeErr);
        results.push({ submissionId: sub.id, error: String(gradeErr), success: false });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("grade-submission error:", e);
    return jsonError(e, corsHeaders);
  }
});
