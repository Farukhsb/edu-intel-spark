import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { CohortRecommendation, RecommendationStatus } from "@/lib/cohortRecommendations";

export type PersistedRecommendationRow = Tables<"analytics_recommendations">;
type RecommendationRowInsert = TablesInsert<"analytics_recommendations">;
type RecommendationActionInsert = TablesInsert<"recommendation_actions">;
type RecommendationActionType = RecommendationActionInsert["action_type"];

const normalizeStatus = (value: string | null | undefined): RecommendationStatus => {
  if (value === "reviewed" || value === "dismissed" || value === "actioned") {
    return value;
  }

  return "open";
};

const toRecommendationRow = (
  lecturerId: string,
  recommendation: CohortRecommendation,
  persisted?: PersistedRecommendationRow
): RecommendationRowInsert => ({
  id: recommendation.id,
  lecturer_id: lecturerId,
  assignment_id: recommendation.assignmentId ?? null,
  type: recommendation.type,
  rule_code: recommendation.ruleCode,
  title: recommendation.title,
  summary: recommendation.summary,
  explanation: recommendation.explanation,
  severity: recommendation.severity,
  confidence: recommendation.confidence,
  recommended_actions: recommendation.recommendedActions,
  evidence: recommendation.evidence,
  status: normalizeStatus(persisted?.status),
  created_at: persisted?.created_at ?? recommendation.createdAt,
});

const mapPersistedRowsById = (rows: PersistedRecommendationRow[]) =>
  Object.fromEntries(rows.map((row) => [row.id, row] as const));

export async function fetchPersistedRecommendations(lecturerId: string) {
  const { data, error } = await supabase
    .from("analytics_recommendations")
    .select("*")
    .eq("lecturer_id", lecturerId);

  if (error) throw error;

  return (data || []) as PersistedRecommendationRow[];
}

export async function upsertGeneratedRecommendations(
  lecturerId: string,
  generatedRecommendations: CohortRecommendation[],
  persistedRows: PersistedRecommendationRow[]
) {
  if (generatedRecommendations.length === 0) return;

  const persistedById = mapPersistedRowsById(persistedRows);
  const rows = generatedRecommendations.map((recommendation) =>
    toRecommendationRow(lecturerId, recommendation, persistedById[recommendation.id])
  );

  const { error } = await supabase.from("analytics_recommendations").upsert(rows, { onConflict: "id" });

  if (error) throw error;
}

export function mergePersistedRecommendationState(
  generatedRecommendations: CohortRecommendation[],
  persistedRows: PersistedRecommendationRow[]
) {
  const persistedById = mapPersistedRowsById(persistedRows);

  return generatedRecommendations.map((recommendation) => {
    const persisted = persistedById[recommendation.id];
    if (!persisted) return recommendation;

    return {
      ...recommendation,
      status: normalizeStatus(persisted.status),
      createdAt: persisted.created_at || recommendation.createdAt,
    };
  });
}

export async function persistRecommendationAction(params: {
  lecturerId: string;
  recommendation: CohortRecommendation;
  actionType: RecommendationActionType;
  nextStatus: RecommendationStatus;
}) {
  const { recommendation, actionType, nextStatus } = params;

  const { error } = await supabase.rpc("apply_recommendation_action", {
    p_recommendation_id: recommendation.id,
    p_action_type: actionType,
    p_payload: {
      ruleCode: recommendation.ruleCode,
      assignmentId: recommendation.assignmentId ?? null,
      evidence: recommendation.evidence,
      nextStatus,
    },
  });

  if (error) throw error;
}
