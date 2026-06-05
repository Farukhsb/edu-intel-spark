import { z } from "https://esm.sh/zod@3.23.8";

import { createAdminClient, HttpError, jsonError, requireAdmin } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import { applySharedRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";
import { scoreStudentRisk } from "../../../src/lib/riskModel.ts";
import {
  evaluateStudentRisk,
  type StudentTrajectory,
} from "../../../src/lib/studentRisk.ts";
import {
  evaluateCompositeStudentRisk,
  type StudentRiskCompositeEvaluation,
} from "../../../src/lib/studentRiskComposite.ts";

type BatchRequest = {
  featureVersion?: string;
  snapshotDate?: string;
};

type BatchResponse = {
  snapshotDate: string;
  featureVersion: string;
  modelVersion: string;
  institutionId: string;
  studentCount: number;
  snapshotCount: number;
  predictionCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
};

type EngagementEventRow = {
  occurred_at: string;
  metadata: Record<string, unknown> | null;
};

type StudentSubmissionSummary = {
  submittedAssignments: number;
  lateSubmissions: number;
};

const BatchRequestSchema = z.object({
  featureVersion: z.string().trim().min(1).optional(),
  snapshotDate: z.string().trim().min(1).optional(),
});

const DEFAULT_FEATURE_VERSION = "v1";

function getNumericGrade(scoreRow: { final_score: number | null; ai_score: number | null }) {
  const score = scoreRow.final_score ?? scoreRow.ai_score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function getEngagementEmail(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;

  const keys = ["email", "user_email", "student_email"];
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase();
    }
  }

  return null;
}

function buildStudentSubmissionSummary(
  studentId: string,
  submissionRows: Array<{
    assignment_id: string;
    submitted_at: string | null;
    status: string;
  }>,
  assignmentById: Map<string, { dueDate: string | null }>,
) {
  const submittedAssignments = new Set<string>();
  let lateSubmissions = 0;

  for (const submission of submissionRows) {
    submittedAssignments.add(submission.assignment_id);
    const dueDate = assignmentById.get(submission.assignment_id)?.dueDate ?? null;
    if (dueDate && submission.submitted_at) {
      const submittedAt = new Date(submission.submitted_at).getTime();
      const dueAt = new Date(dueDate).getTime();
      if (Number.isFinite(submittedAt) && Number.isFinite(dueAt) && submittedAt > dueAt) {
        lateSubmissions += 1;
      }
    } else if (submission.status === "late") {
      lateSubmissions += 1;
    }
  }

  return {
    studentId,
    submittedAssignments: submittedAssignments.size,
    lateSubmissions,
  } satisfies StudentSubmissionSummary;
}

function buildEngagementSummary(
  email: string | null,
  eventsByEmail: Map<string, EngagementEventRow[]>,
  snapshotDate: string,
) {
  if (!email) {
    return {
      eventCount: 0,
      lastEventAt: null,
    };
  }

  const normalizedEmail = email.toLowerCase();
  const events = eventsByEmail.get(normalizedEmail) ?? [];
  const lastEventAt = events[0]?.occurred_at ?? null;

  return {
    eventCount: events.length,
    lastEventAt: lastEventAt ?? snapshotDate,
  };
}

function buildRiskDetails(evaluation: NonNullable<ReturnType<typeof evaluateStudentRisk>>, options: {
  composite: StudentRiskCompositeEvaluation | null;
  snapshotDate: string;
  featureVersion: string;
  submissionCount: number;
  scoreCount: number;
  firstSubmissionAt: string | null;
  lastSubmissionAt: string | null;
  modelVersion: string;
  modelSource: "ml" | "heuristic";
  modelConfidence: number | null;
  modelRiskScore: number;
  modelRiskBand: string;
  modelNeedsReview: boolean | null;
  modelReviewReasons: string[] | null;
  modelProbabilityByBand: Record<string, number> | null;
  modelFeatureVector: Record<string, number> | null;
  engagementEventCount: number;
  engagementLastEventAt: string | null;
  totalAssignments: number;
  submittedAssignments: number;
  lateSubmissions: number;
}) {
  const composite = options.composite;
  return {
    snapshot_date: options.snapshotDate,
    feature_version: options.featureVersion,
    submission_count: options.submissionCount,
    score_count: options.scoreCount,
    first_submission_at: options.firstSubmissionAt,
    last_submission_at: options.lastSubmissionAt,
    risk_score: composite?.rawRiskScore ?? evaluation.rawRiskScore,
    risk_band: composite?.riskBand ?? evaluation.riskBand,
    reason_codes: composite?.reasonCodes ?? evaluation.reasonCodes,
    flags: composite?.flags ?? evaluation.flags,
    avg_grade: evaluation.avgGrade,
    last_grade: evaluation.lastGrade,
    predicted_next: evaluation.predictedNext,
    trend: evaluation.trend,
    recommendation: composite
      ? `${evaluation.recommendation} Composite risk blends academic, engagement, and submission patterns.`
      : evaluation.recommendation,
    explanation: composite?.explanation ?? evaluation.explanation,
    sparkline: evaluation.sparkline,
    academic_risk_score: evaluation.rawRiskScore,
    engagement_event_count: options.engagementEventCount,
    engagement_last_event_at: options.engagementLastEventAt,
    non_submission_total_assignments: options.totalAssignments,
    non_submission_submitted_assignments: options.submittedAssignments,
    non_submission_late_submissions: options.lateSubmissions,
    composite_risk_score: composite?.rawRiskScore ?? evaluation.rawRiskScore,
    composite_risk_band: composite?.riskBand ?? evaluation.riskBand,
    composite_reason_codes: composite?.reasonCodes ?? evaluation.reasonCodes,
    composite_component_scores: composite?.componentScores ?? {
      academic: evaluation.rawRiskScore,
      engagement: null,
      nonSubmission: null,
    },
    model_version: options.modelVersion,
    model_source: options.modelSource,
    model_confidence: options.modelConfidence,
    model_risk_score: options.modelRiskScore,
    model_risk_band: options.modelRiskBand,
    model_needs_review: options.modelNeedsReview,
    model_review_reasons: options.modelReviewReasons,
    model_probability_by_band: options.modelProbabilityByBand,
    model_feature_vector: options.modelFeatureVector,
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    const { supabase, user } = await requireAdmin(req);
    const supabaseAdmin = createAdminClient();
    const rateLimit = await applySharedRateLimit(supabaseAdmin, req, {
      scope: "compute-risk-batch",
      limit: 5,
      windowMs: 60_000,
      userId: user.id,
    });

    if (!rateLimit.allowed) {
      logWarn("Rate limit exceeded", { function: "compute-risk-batch", identifierType: rateLimit.identifierType });
      return createRateLimitResponse(corsHeaders, rateLimit.retryAfterSeconds);
    }

    const body = await req.json().catch(() => null);
    const parsed = BatchRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request format",
          details: parsed.error.issues,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const requestData: BatchRequest = parsed.data;
    const featureVersion = requestData.featureVersion ?? DEFAULT_FEATURE_VERSION;
    const snapshotDate = requestData.snapshotDate ?? new Date().toISOString().slice(0, 10);
    const fallbackModelVersion = `heuristic-risk-${featureVersion}`;

    const { data: actorProfile, error: actorProfileError } = await supabase
      .from("profiles")
      .select("id, institution_id, institutions:institution_id (slug)")
      .eq("id", user.id)
      .maybeSingle();

    if (actorProfileError) {
      throw new HttpError(403, "Admin profile could not be resolved");
    }

    const institutionId = actorProfile?.institution_id ?? null;
    if (!institutionId) {
      throw new HttpError(403, "Admin institution could not be resolved");
    }

    const { data: studentRows, error: studentError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("institution_id", institutionId)
      .eq("role", "student");

    if (studentError) {
      throw new HttpError(500, studentError.message);
    }

    const studentIds = (studentRows ?? []).map((row) => row.id);
    if (studentIds.length === 0) {
      const response: BatchResponse = {
        snapshotDate,
        featureVersion,
        modelVersion,
        institutionId,
        studentCount: 0,
        snapshotCount: 0,
        predictionCount: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0,
      };

      return new Response(JSON.stringify({ data: response }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const { data: gradeRows, error: gradeError } = submissionIds.length > 0
      ? await supabaseAdmin
        .from("grades")
        .select("submission_id, final_score, ai_score")
        .in("submission_id", submissionIds)
      : { data: [], error: null };

    if (gradeError) {
      throw new HttpError(500, gradeError.message);
    }

    const { data: assignmentRows, error: assignmentError } = assignmentIds.length > 0
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
      logWarn("LMS engagement events are unavailable; continuing without engagement signals", {
        function: "compute-risk-batch",
        institutionId,
      });
    }

    const studentById = new Map((studentRows ?? []).map((row) => [row.id, row]));
    const assignmentById = new Map((assignmentRows ?? []).map((row) => [row.id, { title: row.title, dueDate: (row as { due_date?: string | null }).due_date ?? null }]));
    const gradeBySubmissionId = new Map(
      (gradeRows ?? [])
        .map((row) => [row.submission_id, getNumericGrade(row)] as const)
        .filter((entry): entry is readonly [string, number] => entry[1] !== null)
        .map(([submissionId, score]) => [submissionId, score] as const),
    );

    const submissionsByStudentId = new Map<string, Array<{
      assignment_id: string;
      submitted_at: string | null;
      status: string;
    }>>();
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

    const trajectories = new Map<string, StudentTrajectory>();
    for (const student of studentRows ?? []) {
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

    let snapshotCount = 0;
    let predictionCount = 0;
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let lowRiskCount = 0;

    for (const trajectory of scoredTrajectories) {
      const evaluation = trajectory.scores.length > 0 ? evaluateStudentRisk(trajectory) : null;
      const modelPrediction = evaluation ? scoreStudentRisk(trajectory) : null;
      const modelVersion = modelPrediction?.modelVersion ?? fallbackModelVersion;
      const studentSubmissionRows = submissionsByStudentId.get(trajectory.studentId) ?? [];
      const submissionSummary = buildStudentSubmissionSummary(
        trajectory.studentId,
        studentSubmissionRows,
        assignmentById,
      );
      const engagementSummary = buildEngagementSummary(
        trajectory.email,
        engagementEventsByEmail,
        snapshotDate,
      );
      const composite = evaluateCompositeStudentRisk({
        academicEvaluation: evaluation,
        engagement: engagementSummary,
        submissions: {
          totalAssignments: (assignmentRows ?? []).length,
          submittedAssignments: submissionSummary.submittedAssignments,
          lateSubmissions: submissionSummary.lateSubmissions,
        },
        referenceDate: `${snapshotDate}T23:59:59.999Z`,
      });

      if (!composite && !evaluation) continue;

      const academicRiskScore = evaluation?.rawRiskScore ?? 0;
      const compositeRiskScore = composite?.rawRiskScore ?? academicRiskScore;
      const riskScore = Number((compositeRiskScore / 100).toFixed(4));
      const riskBand = composite?.riskBand ?? evaluation?.riskBand ?? "low";

      const submissionCount = trajectory.scores.length;
      const firstSubmissionAt = trajectory.scores[0]?.date ?? null;
      const lastSubmissionAt = trajectory.scores[trajectory.scores.length - 1]?.date ?? null;
      const snapshotFeatures = buildRiskDetails(evaluation ?? {
        name: trajectory.name,
        email: trajectory.email,
        studentId: trajectory.studentId,
        rawRiskScore: academicRiskScore,
        riskBand,
        avgGrade: 0,
        lastGrade: 0,
        trend: "stable-low",
        flags: [],
        reasonCodes: ["baseline_monitoring"],
        sparkline: [],
        recommendation: "Monitor engagement and submission activity.",
        predictedNext: 0,
        explanation: "No graded academic history was available.",
      }, {
        composite,
        snapshotDate,
        featureVersion,
        submissionCount,
        scoreCount: submissionCount,
        firstSubmissionAt,
        lastSubmissionAt,
        modelVersion,
        modelSource: modelPrediction ? "ml" : "heuristic",
        modelConfidence: modelPrediction?.confidence ?? null,
        modelRiskScore: modelPrediction?.riskScore ?? academicRiskScore,
        modelRiskBand: modelPrediction?.riskBand ?? riskBand,
        modelNeedsReview: modelPrediction?.needsReview ?? null,
        modelReviewReasons: modelPrediction?.reviewReasons ?? null,
        modelProbabilityByBand: modelPrediction?.probabilityByBand ?? null,
        modelFeatureVector: modelPrediction?.featureVector ?? null,
        engagementEventCount: engagementSummary.eventCount,
        engagementLastEventAt: engagementSummary.lastEventAt,
        totalAssignments: (assignmentRows ?? []).length,
        submittedAssignments: submissionSummary.submittedAssignments,
        lateSubmissions: submissionSummary.lateSubmissions,
      });

      const { data: snapshotRow, error: snapshotError } = await supabaseAdmin
        .from("student_risk_snapshots")
        .upsert(
          {
            student_id: trajectory.studentId,
            institution_id: institutionId,
            snapshot_date: snapshotDate,
            feature_version: featureVersion,
            features: snapshotFeatures,
          },
          {
            onConflict: "student_id,snapshot_date,feature_version",
          },
        )
        .select("id, student_id, institution_id, snapshot_date, feature_version")
        .single();

      if (snapshotError || !snapshotRow) {
        throw new HttpError(500, snapshotError?.message || "Failed to persist risk snapshot");
      }

      const { error: predictionError } = await supabaseAdmin
        .from("student_risk_predictions")
        .upsert(
          {
            snapshot_id: snapshotRow.id,
            student_id: trajectory.studentId,
            institution_id: institutionId,
            prediction_date: snapshotDate,
            model_version: modelVersion,
            risk_score: riskScore,
            risk_band: riskBand,
            reason_codes: composite?.reasonCodes ?? evaluation?.reasonCodes ?? ["baseline_monitoring"],
            explanation: composite?.explanation ?? evaluation?.explanation ?? "Risk score computed from engagement and submission patterns.",
            details: {
              ...snapshotFeatures,
              risk_band: riskBand,
              risk_score: riskScore,
              raw_risk_score: composite?.rawRiskScore ?? academicRiskScore,
              academic_risk_score: academicRiskScore,
              engagement_event_count: engagementSummary.eventCount,
              engagement_last_event_at: engagementSummary.lastEventAt,
              submitted_assignments: submissionSummary.submittedAssignments,
              late_submissions: submissionSummary.lateSubmissions,
              total_assignments: (assignmentRows ?? []).length,
              model_needs_review: modelPrediction?.needsReview ?? null,
              model_review_reasons: modelPrediction?.reviewReasons ?? null,
              composite_reason_codes: composite?.reasonCodes ?? null,
              composite_component_scores: composite?.componentScores ?? null,
            },
          },
          {
            onConflict: "snapshot_id,model_version",
          },
        );

      if (predictionError) {
        throw new HttpError(500, predictionError.message);
      }

      snapshotCount += 1;
      predictionCount += 1;
      if (riskBand === "high") {
        highRiskCount += 1;
      } else if (riskBand === "medium") {
        mediumRiskCount += 1;
      } else {
        lowRiskCount += 1;
      }
    }

    const response: BatchResponse = {
      snapshotDate,
      featureVersion,
      modelVersion,
      institutionId,
      studentCount: scoredTrajectories.length,
      snapshotCount,
      predictionCount,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
    };

    logInfo("compute-risk-batch completed", {
      function: "compute-risk-batch",
      ...response,
    });

    return new Response(JSON.stringify({ data: response }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logError("compute-risk-batch error", error);
    return jsonError(error, corsHeaders);
  }
});
