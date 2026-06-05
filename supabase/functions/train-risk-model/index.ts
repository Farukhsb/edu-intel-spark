import { z } from "https://esm.sh/zod@3.23.8";

import { createAdminClient, HttpError, jsonError, requireAdmin } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import { applySharedRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";
import { buildRiskModelTrainingExamples, summarizeRiskModelTrainingExamples, trainRiskModelArtifact } from "../../../src/lib/riskModelPipeline.ts";
import { normalizeRiskModelArtifact, setRiskModelArtifact } from "../../../src/lib/riskModelRegistry.ts";

const TrainRequestSchema = z.object({
  version: z.string().trim().min(1).optional(),
  mode: z.enum(["single", "all"]).optional(),
});

type TrainResponse = {
  institutionId: string;
  version: string;
  status: "active";
  trainingExamples: number;
  trainAccuracy: number;
  testAccuracy: number;
  validationNll: number | null;
  validationConfidenceEce: number | null;
  featureCount: number;
};

type TrainBatchResponse = {
  mode: "all";
  status: "active";
  totalInstitutions: number;
  trainedInstitutions: number;
  skippedInstitutions: number;
  results: Array<
    | (TrainResponse & { source: string })
    | {
        institutionId: string;
        skipped: true;
        reason: string;
      }
  >;
};

const TRAIN_RISK_MODEL_SCHEDULER_HEADER = "x-train-risk-model-scheduler";
const TRAIN_RISK_MODEL_SCHEDULER_VALUE = "weekly";
const TRAIN_RISK_MODEL_SCHEDULER_SECRET_TABLE = "risk_model_training_settings";
const TRAIN_RISK_MODEL_SCHEDULER_SECRET_ROW_ID = 1;

async function getSchedulerSecret(supabaseAdmin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabaseAdmin
    .from(TRAIN_RISK_MODEL_SCHEDULER_SECRET_TABLE)
    .select("scheduler_secret, enabled")
    .eq("id", TRAIN_RISK_MODEL_SCHEDULER_SECRET_ROW_ID)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!data?.scheduler_secret) {
    throw new HttpError(500, "Risk model scheduler secret is not configured");
  }

  if (data.enabled === false) {
    throw new HttpError(403, "Scheduled risk model training is disabled");
  }

  return data.scheduler_secret as string;
}

function isSchedulerRequest(req: Request, schedulerSecret: string) {
  return req.headers.get("apikey") === schedulerSecret && req.headers.get(TRAIN_RISK_MODEL_SCHEDULER_HEADER) === TRAIN_RISK_MODEL_SCHEDULER_VALUE;
}

async function trainRiskModelForInstitution(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  institutionId: string,
  input: { version?: string; trainedBy?: string | null; source?: string },
): Promise<TrainResponse & { source: string }> {
  const { data: predictions, error: predictionsError } = await supabaseAdmin
    .from("student_risk_predictions")
    .select("id, student_id, prediction_date, model_version, risk_score, risk_band, details")
    .eq("institution_id", institutionId)
    .order("prediction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);

  if (predictionsError) {
    throw new HttpError(500, predictionsError.message);
  }

  const { data: outcomes, error: outcomesError } = await supabaseAdmin
    .from("student_risk_outcomes")
    .select("prediction_id, student_id, outcome_date, label_value, label_window_days")
    .eq("institution_id", institutionId)
    .order("outcome_date", { ascending: false })
    .limit(1000);

  if (outcomesError) {
    throw new HttpError(500, outcomesError.message);
  }

  const examples = buildRiskModelTrainingExamples({
    predictions: predictions ?? [],
    outcomes: outcomes ?? [],
  });

  if (examples.length === 0) {
    throw new HttpError(400, "No outcome-labeled risk examples were available for training.");
  }

  const artifact = trainRiskModelArtifact(examples);
  if (!artifact) {
    throw new HttpError(500, "Risk model training failed.");
  }

  const summary = summarizeRiskModelTrainingExamples(examples);
  const storedVersion = input.version ?? artifact.version;
  const storedArtifact = {
    ...artifact,
    version: storedVersion,
  };

  const { error: archiveError } = await supabaseAdmin
    .from("risk_model_registry")
    .update({ status: "archived" })
    .eq("institution_id", institutionId)
    .eq("status", "active")
    .neq("version", storedVersion);

  if (archiveError) {
    logWarn("Unable to archive previous active risk model versions", {
      function: "train-risk-model",
      institutionId,
    });
  }

  const { data: savedRow, error: saveError } = await supabaseAdmin
    .from("risk_model_registry")
    .upsert(
      {
        institution_id: institutionId,
        version: storedVersion,
        status: "active",
        source: input.source ?? "historical_outcomes",
        artifact: storedArtifact,
        metrics: storedArtifact.metrics ?? {},
        trained_by: input.trainedBy ?? null,
        trained_at: storedArtifact.trainedAt,
      },
      {
        onConflict: "institution_id,version",
      },
    )
    .select("artifact")
    .single();

  if (saveError || !savedRow) {
    throw new HttpError(500, saveError?.message || "Failed to persist trained risk model");
  }

  const activeArtifact = normalizeRiskModelArtifact(savedRow.artifact);
  setRiskModelArtifact(activeArtifact);

  return {
    institutionId,
    version: activeArtifact?.version ?? storedArtifact.version,
    status: "active",
    trainingExamples: summary.total,
    trainAccuracy: storedArtifact.metrics?.trainAccuracy ?? 0,
    testAccuracy: storedArtifact.metrics?.testAccuracy ?? 0,
    validationNll: storedArtifact.metrics?.validationNll ?? null,
    validationConfidenceEce: storedArtifact.metrics?.validationConfidenceEce ?? null,
    featureCount: summary.featureCount,
    source: input.source ?? "historical_outcomes",
  };
}

async function trainForAllInstitutions(supabaseAdmin: ReturnType<typeof createAdminClient>, input: { version?: string }) {
  const { data: institutions, error } = await supabaseAdmin
    .from("institutions")
    .select("id")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new HttpError(500, error.message);
  }

  const results: TrainBatchResponse["results"] = [];

  for (const institution of institutions ?? []) {
    try {
      const result = await trainRiskModelForInstitution(supabaseAdmin, institution.id, {
        version: input.version,
        source: "scheduled_historical_outcomes",
      });
      results.push(result);
    } catch (institutionError) {
      const reason = institutionError instanceof HttpError ? institutionError.message : institutionError instanceof Error ? institutionError.message : "Unknown training failure";
      results.push({
        institutionId: institution.id,
        skipped: true,
        reason,
      });
      logWarn("Scheduled risk model training skipped institution", {
        function: "train-risk-model",
        institutionId: institution.id,
        reason,
      });
    }
  }

  const trainedInstitutions = results.filter((row): row is TrainResponse & { source: string } => !("skipped" in row)).length;
  const skippedInstitutions = results.length - trainedInstitutions;

  return {
    mode: "all" as const,
    status: "active" as const,
    totalInstitutions: institutions?.length ?? 0,
    trainedInstitutions,
    skippedInstitutions,
    results,
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

    const supabaseAdmin = createAdminClient();
    const body = await req.json().catch(() => null);
    const parsed = TrainRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request format", details: parsed.error.issues }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const schedulerSecret = await getSchedulerSecret(supabaseAdmin);
    if (isSchedulerRequest(req, schedulerSecret)) {
      const result = await trainForAllInstitutions(supabaseAdmin, { version: parsed.data.version });

      logInfo("train-risk-model scheduled run completed", {
        function: "train-risk-model",
        ...result,
      });

      return new Response(JSON.stringify({ data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { supabase, user } = await requireAdmin(req);
    const rateLimit = await applySharedRateLimit(supabaseAdmin, req, {
      scope: "train-risk-model",
      limit: 2,
      windowMs: 60 * 60 * 1000,
      userId: user.id,
    });

    if (!rateLimit.allowed) {
      logWarn("Rate limit exceeded", { function: "train-risk-model", identifierType: rateLimit.identifierType });
      return createRateLimitResponse(corsHeaders, rateLimit.retryAfterSeconds);
    }

    const { data: actorProfile, error: actorProfileError } = await supabase
      .from("profiles")
      .select("id, institution_id")
      .eq("id", user.id)
      .maybeSingle();

    if (actorProfileError) {
      throw new HttpError(403, "Admin profile could not be resolved");
    }

    const institutionId = actorProfile?.institution_id ?? null;
    if (!institutionId) {
      throw new HttpError(403, "Admin institution could not be resolved");
    }

    const response = await trainRiskModelForInstitution(supabaseAdmin, institutionId, {
      version: parsed.data.version,
      trainedBy: user.id,
      source: "historical_outcomes",
    });

    logInfo("train-risk-model completed", {
      function: "train-risk-model",
      ...response,
    });

    return new Response(JSON.stringify({ data: response }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logError("train-risk-model error", error);
    return jsonError(error, corsHeaders);
  }
});
