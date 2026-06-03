import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type RiskSnapshotRow = Database["public"]["Tables"]["student_risk_snapshots"]["Row"];
type RiskPredictionRow = Database["public"]["Tables"]["student_risk_predictions"]["Row"];
type RiskFeedbackRow = Database["public"]["Tables"]["risk_feedback"]["Row"];
type RiskOutcomeRow = Database["public"]["Tables"]["student_risk_outcomes"]["Row"];
type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name" | "email">;
type RiskFeedbackInsert = Database["public"]["Tables"]["risk_feedback"]["Insert"];
type RiskOutcomeInsert = Database["public"]["Tables"]["student_risk_outcomes"]["Insert"];

const SNAPSHOT_FIELDS = "id, student_id, institution_id, snapshot_date, feature_version, features, created_at";
const PREDICTION_FIELDS =
  "id, snapshot_id, student_id, institution_id, prediction_date, model_version, risk_score, risk_band, reason_codes, explanation, details, created_at";
const FEEDBACK_FIELDS = "id, prediction_id, reviewer_id, institution_id, feedback_type, notes, created_at";
const OUTCOME_FIELDS =
  "id, student_id, institution_id, prediction_id, snapshot_id, source_grade_id, source_submission_id, outcome_date, label_window_days, label_value, outcome_status, outcome_source, notes, created_at";
const PROFILE_FIELDS = "id, full_name, email";

export const fetchRiskIntelligenceDataset = async () => {
  const [snapshotsRes, predictionsRes, feedbackRes, outcomesRes, profilesRes] = await Promise.all([
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
    supabase
      .from("student_risk_outcomes")
      .select(OUTCOME_FIELDS)
      .order("outcome_date", { ascending: false })
      .limit(200),
    supabase.from("profiles").select(PROFILE_FIELDS).order("created_at", { ascending: false }).limit(500),
  ]);

  if (snapshotsRes.error || predictionsRes.error || feedbackRes.error || outcomesRes.error || profilesRes.error) {
    throw snapshotsRes.error || predictionsRes.error || feedbackRes.error || outcomesRes.error || profilesRes.error;
  }

  return {
    snapshots: (snapshotsRes.data || []) as RiskSnapshotRow[],
    predictions: (predictionsRes.data || []) as RiskPredictionRow[],
    feedback: (feedbackRes.data || []) as RiskFeedbackRow[],
    outcomes: (outcomesRes.data || []) as RiskOutcomeRow[],
    profiles: (profilesRes.data || []) as ProfileRow[],
  };
};

export const submitRiskFeedback = async (input: {
  predictionId: string;
  reviewerId: string;
  institutionId: string;
  feedbackType: "useful" | "false_alarm" | "student_recovered" | "intervention_sent" | "other";
  notes?: string | null;
}) => {
  const payload: RiskFeedbackInsert = {
    prediction_id: input.predictionId,
    reviewer_id: input.reviewerId,
    institution_id: input.institutionId,
    feedback_type: input.feedbackType,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from("risk_feedback")
    .insert(payload)
    .select(FEEDBACK_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  return data as RiskFeedbackRow;
};

export const submitRiskOutcome = async (input: {
  studentId: string;
  institutionId: string;
  predictionId?: string | null;
  snapshotId?: string | null;
  sourceGradeId?: string | null;
  sourceSubmissionId?: string | null;
  outcomeDate?: string | null;
  labelWindowDays?: number;
  labelValue: "low" | "medium" | "high";
  outcomeStatus: "passed" | "at_risk" | "failed" | "withdrawn" | "incomplete";
  outcomeSource: "manual" | "grade" | "import" | "system";
  notes?: string | null;
}) => {
  const payload: RiskOutcomeInsert = {
    student_id: input.studentId,
    institution_id: input.institutionId,
    prediction_id: input.predictionId ?? null,
    snapshot_id: input.snapshotId ?? null,
    source_grade_id: input.sourceGradeId ?? null,
    source_submission_id: input.sourceSubmissionId ?? null,
    outcome_date: input.outcomeDate ?? new Date().toISOString().slice(0, 10),
    label_window_days: input.labelWindowDays ?? 30,
    label_value: input.labelValue,
    outcome_status: input.outcomeStatus,
    outcome_source: input.outcomeSource,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from("student_risk_outcomes")
    .insert(payload)
    .select(OUTCOME_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  return data as RiskOutcomeRow;
};
