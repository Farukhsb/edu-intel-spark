import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type RiskSnapshotRow = Database["public"]["Tables"]["student_risk_snapshots"]["Row"];
type RiskPredictionRow = Database["public"]["Tables"]["student_risk_predictions"]["Row"];
type RiskFeedbackRow = Database["public"]["Tables"]["risk_feedback"]["Row"];
type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name" | "email">;

const SNAPSHOT_FIELDS = "id, student_id, institution_id, snapshot_date, feature_version, features, created_at";
const PREDICTION_FIELDS =
  "id, snapshot_id, student_id, institution_id, prediction_date, model_version, risk_score, risk_band, reason_codes, explanation, details, created_at";
const FEEDBACK_FIELDS = "id, prediction_id, reviewer_id, institution_id, feedback_type, notes, created_at";
const PROFILE_FIELDS = "id, full_name, email";

export const fetchRiskIntelligenceDataset = async () => {
  const [snapshotsRes, predictionsRes, feedbackRes, profilesRes] = await Promise.all([
    supabase
      .from("student_risk_snapshots")
      .select(SNAPSHOT_FIELDS)
      .order("snapshot_date", { ascending: false })
      .limit(200),
    supabase
      .from("student_risk_predictions")
      .select(PREDICTION_FIELDS)
      .order("prediction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("risk_feedback")
      .select(FEEDBACK_FIELDS)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("profiles").select(PROFILE_FIELDS).order("created_at", { ascending: false }).limit(500),
  ]);

  if (snapshotsRes.error || predictionsRes.error || feedbackRes.error || profilesRes.error) {
    throw snapshotsRes.error || predictionsRes.error || feedbackRes.error || profilesRes.error;
  }

  return {
    snapshots: (snapshotsRes.data || []) as RiskSnapshotRow[],
    predictions: (predictionsRes.data || []) as RiskPredictionRow[],
    feedback: (feedbackRes.data || []) as RiskFeedbackRow[],
    profiles: (profilesRes.data || []) as ProfileRow[],
  };
};
