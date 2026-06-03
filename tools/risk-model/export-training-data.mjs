import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const outputDir = resolve(repoRoot, "tools/risk-model/generated");
const outputPath = resolve(outputDir, "risk-training-data.jsonl");

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const FEATURE_NAMES = [
  "scoreCount",
  "average",
  "last",
  "minimum",
  "maximum",
  "slope",
  "predictedNext",
  "stdDev",
  "recent3Avg",
  "earlyAvg",
  "firstLastDelta",
  "recentDelta",
  "below50Ratio",
  "below40Ratio",
];

function pickFeatureVector(details = {}, snapshot = {}) {
  const vector = details?.model_feature_vector ?? null;
  if (vector && typeof vector === "object") {
    return FEATURE_NAMES.map((name) => Number(vector[name] ?? 0));
  }

  const featureVector = snapshot?.features ?? details ?? {};
  return FEATURE_NAMES.map((name) => {
    const value = featureVector[name] ?? featureVector[`model_${name}`] ?? 0;
    return typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0;
  });
}

function toJsonLine(value) {
  return `${JSON.stringify(value)}\n`;
}

async function main() {
  const { data: outcomes, error: outcomesError } = await supabase
    .from("student_risk_outcomes")
    .select("id, student_id, institution_id, prediction_id, snapshot_id, source_grade_id, source_submission_id, outcome_date, label_window_days, label_value, outcome_status, outcome_source, notes, created_at")
    .order("outcome_date", { ascending: false })
    .limit(5000);

  if (outcomesError) {
    throw new Error(`Failed to fetch outcomes: ${outcomesError.message}`);
  }

  const predictionIds = [...new Set((outcomes ?? []).map((row) => row.prediction_id).filter(Boolean))];
  const snapshotIds = [...new Set((outcomes ?? []).map((row) => row.snapshot_id).filter(Boolean))];

  const [predictionsRes, snapshotsRes] = await Promise.all([
    predictionIds.length > 0
      ? supabase
          .from("student_risk_predictions")
          .select("id, snapshot_id, student_id, institution_id, prediction_date, model_version, risk_score, risk_band, reason_codes, explanation, details, created_at")
          .in("id", predictionIds)
      : Promise.resolve({ data: [], error: null }),
    snapshotIds.length > 0
      ? supabase
          .from("student_risk_snapshots")
          .select("id, student_id, institution_id, snapshot_date, feature_version, features, created_at")
          .in("id", snapshotIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (predictionsRes.error) {
    throw new Error(`Failed to fetch predictions: ${predictionsRes.error.message}`);
  }

  if (snapshotsRes.error) {
    throw new Error(`Failed to fetch snapshots: ${snapshotsRes.error.message}`);
  }

  const predictionById = new Map((predictionsRes.data ?? []).map((row) => [row.id, row]));
  const snapshotById = new Map((snapshotsRes.data ?? []).map((row) => [row.id, row]));

  const trainingRows = (outcomes ?? [])
    .map((outcome) => {
      const prediction = outcome.prediction_id ? predictionById.get(outcome.prediction_id) ?? null : null;
      const snapshot = outcome.snapshot_id ? snapshotById.get(outcome.snapshot_id) ?? null : null;
      const featureVector = pickFeatureVector(prediction?.details, snapshot);

      return {
        outcome_id: outcome.id,
        student_id: outcome.student_id,
        institution_id: outcome.institution_id,
        prediction_id: outcome.prediction_id,
        snapshot_id: outcome.snapshot_id,
        source_grade_id: outcome.source_grade_id,
        source_submission_id: outcome.source_submission_id,
        outcome_date: outcome.outcome_date,
        label_window_days: outcome.label_window_days,
        label_value: outcome.label_value,
        outcome_status: outcome.outcome_status,
        outcome_source: outcome.outcome_source,
        model_version: prediction?.model_version ?? null,
        prediction_date: prediction?.prediction_date ?? null,
        risk_band: prediction?.risk_band ?? null,
        risk_score: prediction?.risk_score ?? null,
        feature_version: snapshot?.feature_version ?? null,
        feature_vector: featureVector,
        reason_codes: prediction?.reason_codes ?? [],
        notes: outcome.notes ?? null,
      };
    })
    .filter((row) => row.feature_vector.some((value) => Number.isFinite(value)));

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, trainingRows.map(toJsonLine).join(""), "utf8");

  console.log(`Wrote ${trainingRows.length} labeled training rows to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
