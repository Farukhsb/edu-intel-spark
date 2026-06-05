import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import { normalizeRiskModelArtifact, setRiskModelArtifact } from "@/lib/riskModelRegistry";
import type { RiskModelArtifact } from "@/lib/riskModelArtifactTypes";

type RiskModelRegistryRow = Database["public"]["Tables"]["risk_model_registry"]["Row"];
type RiskModelRegistryInsert = Database["public"]["Tables"]["risk_model_registry"]["Insert"];

const RISK_MODEL_FIELDS = "id, institution_id, version, status, source, artifact, metrics, trained_at, trained_by, created_at, updated_at";

export const fetchActiveRiskModelArtifact = async (institutionId?: string | null) => {
  const query = supabase
    .from("risk_model_registry")
    .select(RISK_MODEL_FIELDS)
    .eq("status", "active")
    .order("trained_at", { ascending: false })
    .limit(1);

  const response = institutionId ? await query.eq("institution_id", institutionId).maybeSingle() : await query.maybeSingle();

  if (response.error) {
    throw response.error;
  }

  return {
    row: response.data as RiskModelRegistryRow | null,
    artifact: normalizeRiskModelArtifact(response.data?.artifact) ?? null,
  };
};

export const primeRiskModelArtifact = async (institutionId?: string | null) => {
  const { artifact } = await fetchActiveRiskModelArtifact(institutionId);
  return setRiskModelArtifact(artifact);
};

export const storeRiskModelArtifact = async (input: {
  institutionId: string;
  version: string;
  status?: "training" | "active" | "archived" | "failed";
  source?: string;
  artifact: RiskModelArtifact;
  metrics?: Record<string, unknown>;
  trainedBy?: string | null;
}) => {
  const payload: RiskModelRegistryInsert = {
    institution_id: input.institutionId,
    version: input.version,
    status: input.status ?? "active",
    source: input.source ?? "historical_outcomes",
    artifact: input.artifact as unknown as RiskModelRegistryInsert["artifact"],
    metrics: (input.metrics ?? {}) as RiskModelRegistryInsert["metrics"],
    trained_by: input.trainedBy ?? null,
    trained_at: input.artifact.trainedAt,
  };

  const { data, error } = await supabase
    .from("risk_model_registry")
    .upsert(payload, { onConflict: "institution_id,version" })
    .select(RISK_MODEL_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  return data as RiskModelRegistryRow;
};

export const triggerRiskModelTraining = async (input?: { version?: string }) => {
  const { data, error } = await supabase.functions.invoke("train-risk-model", {
    body: input ?? {},
  });

  if (error) {
    throw error;
  }

  return data as {
    data: {
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
  };
};
