import { createAdminClient, HttpError, jsonError, requireAdmin } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import { applySharedRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";
import { normalizeRiskModelArtifact, setRiskModelArtifact } from "../../../src/lib/riskModelRegistry.ts";

import {
  BatchRequestSchema,
  type BatchResponse,
  DEFAULT_FEATURE_VERSION,
} from "./helpers.ts";
import { loadRiskBatchData } from "./load-risk-batch-data.ts";
import { persistRiskBatchStudents } from "./persist-risk-batch.ts";

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

    const requestData = parsed.data;
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

    const { data: riskModelRows, error: riskModelError } = await supabaseAdmin
      .from("risk_model_registry")
      .select("artifact, version, trained_at, status")
      .eq("institution_id", institutionId)
      .eq("status", "active")
      .order("trained_at", { ascending: false })
      .limit(1);

    if (riskModelError) {
      logWarn("Risk model registry is unavailable; falling back to bootstrap artifact", {
        function: "compute-risk-batch",
        institutionId,
      });
    } else {
      const activeArtifact = normalizeRiskModelArtifact(riskModelRows?.[0]?.artifact);
      if (activeArtifact) {
        setRiskModelArtifact(activeArtifact);
      }
    }

    const loaded = await loadRiskBatchData({
      supabaseAdmin,
      institutionId,
      snapshotDate,
      featureVersion,
      fallbackModelVersion,
    });

    if (loaded.studentCount === 0) {
      const response: BatchResponse = {
        snapshotDate,
        featureVersion,
        modelVersion: loaded.modelVersion,
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

    const {
      snapshotCount,
      predictionCount,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
    } = await persistRiskBatchStudents({
      supabaseAdmin,
      institutionId,
      snapshotDate,
      featureVersion,
      loaded,
    });

    const response: BatchResponse = {
      snapshotDate,
      featureVersion,
      modelVersion: loaded.modelVersion,
      institutionId,
      studentCount: loaded.scoredTrajectories.length,
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
