import { z } from "https://esm.sh/zod@3.23.8";

import { createAdminClient, HttpError, jsonError, requireAdmin } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import { applySharedRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";
import {
  evaluateStudentRisk,
  type StudentTrajectory,
} from "../../../src/lib/studentRisk.ts";

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

const BatchRequestSchema = z.object({
  featureVersion: z.string().trim().min(1).optional(),
  snapshotDate: z.string().trim().min(1).optional(),
});

const DEFAULT_FEATURE_VERSION = "v1";

function getNumericGrade(scoreRow: { final_score: number | null; ai_score: number | null }) {
  const score = scoreRow.final_score ?? scoreRow.ai_score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function mapRiskBand(rawRiskScore: number) {
  if (rawRiskScore >= 70) return "high";
  if (rawRiskScore >= 45) return "medium";
  return "low";
}

function buildRiskDetails(evaluation: NonNullable<ReturnType<typeof evaluateStudentRisk>>, options: {
  snapshotDate: string;
  featureVersion: string;
  submissionCount: number;
  scoreCount: number;
  firstSubmissionAt: string | null;
  lastSubmissionAt: string | null;
}) {
  return {
    snapshot_date: options.snapshotDate,
    feature_version: options.featureVersion,
    submission_count: options.submissionCount,
    score_count: options.scoreCount,
    first_submission_at: options.firstSubmissionAt,
    last_submission_at: options.lastSubmissionAt,
    risk_score: evaluation.rawRiskScore,
    risk_band: evaluation.riskBand,
    reason_codes: evaluation.reasonCodes,
    flags: evaluation.flags,
    avg_grade: evaluation.avgGrade,
    last_grade: evaluation.lastGrade,
    predicted_next: evaluation.predictedNext,
    trend: evaluation.trend,
    recommendation: evaluation.recommendation,
    explanation: evaluation.explanation,
    sparkline: evaluation.sparkline,
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
    const modelVersion = `heuristic-risk-${featureVersion}`;

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

    const studentById = new Map((studentRows ?? []).map((row) => [row.id, row]));
    const assignmentById = new Map((assignmentRows ?? []).map((row) => [row.id, row.title]));
    const gradeBySubmissionId = new Map(
      (gradeRows ?? [])
        .map((row) => [row.submission_id, getNumericGrade(row)] as const)
        .filter((entry): entry is readonly [string, number] => entry[1] !== null)
        .map(([submissionId, score]) => [submissionId, score] as const),
    );

    const trajectories = new Map<string, StudentTrajectory>();
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
        assignmentTitle: assignmentById.get(submission.assignment_id) || "Assignment",
      });
      trajectories.set(studentId, existing);
    }

    const scoredTrajectories = Array.from(trajectories.values())
      .map((trajectory) => ({
        ...trajectory,
        scores: [...trajectory.scores].sort(
          (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
        ),
      }))
      .filter((trajectory) => trajectory.scores.length > 0);

    let snapshotCount = 0;
    let predictionCount = 0;
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let lowRiskCount = 0;

    for (const trajectory of scoredTrajectories) {
      const evaluation = evaluateStudentRisk(trajectory);
      if (!evaluation) continue;

      const submissionCount = trajectory.scores.length;
      const firstSubmissionAt = trajectory.scores[0]?.date ?? null;
      const lastSubmissionAt = trajectory.scores[trajectory.scores.length - 1]?.date ?? null;
      const snapshotFeatures = buildRiskDetails(evaluation, {
        snapshotDate,
        featureVersion,
        submissionCount,
        scoreCount: submissionCount,
        firstSubmissionAt,
        lastSubmissionAt,
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

      const riskScore = Number((evaluation.rawRiskScore / 100).toFixed(4));
      const riskBand = mapRiskBand(evaluation.rawRiskScore);

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
            reason_codes: evaluation.reasonCodes,
            explanation: evaluation.explanation,
            details: {
              ...snapshotFeatures,
              risk_band: riskBand,
              risk_score: riskScore,
              raw_risk_score: evaluation.rawRiskScore,
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
