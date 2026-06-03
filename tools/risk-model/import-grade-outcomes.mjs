import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!supabaseUrl || (!serviceRoleKey && (!anonKey || !accessToken))) {
  console.error(
    "Missing SUPABASE_URL/VITE_SUPABASE_URL plus either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY and SUPABASE_ACCESS_TOKEN.",
  );
  process.exit(1);
}

const supabase = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

const LABEL_WINDOW_DAYS = 30;
const PASS_THRESHOLD = 40;
const MEDIUM_RISK_THRESHOLD = 50;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTime(value) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function pickGradeScore(grade) {
  return toNumber(grade.final_score) ?? toNumber(grade.lecturer_score) ?? toNumber(grade.ai_score);
}

function calculateScorePercent(score, maxScore) {
  if (!Number.isFinite(score)) return null;
  if (Number.isFinite(maxScore) && maxScore > 0) {
    return (score / maxScore) * 100;
  }
  return score;
}

function deriveOutcome(scorePercent) {
  if (!Number.isFinite(scorePercent)) {
    return null;
  }

  if (scorePercent < PASS_THRESHOLD) {
    return {
      outcomeStatus: "failed",
      labelValue: "high",
    };
  }

  return {
    outcomeStatus: "passed",
    labelValue: scorePercent < MEDIUM_RISK_THRESHOLD ? "medium" : "low",
  };
}

function selectLatestBefore(rows, targetTime, getTime) {
  if (!Array.isArray(rows) || rows.length === 0 || !Number.isFinite(targetTime)) {
    return rows?.[rows.length - 1] ?? null;
  }

  let selected = null;
  for (const row of rows) {
    const rowTime = getTime(row);
    if (!Number.isFinite(rowTime)) {
      continue;
    }

    if (rowTime <= targetTime) {
      selected = row;
      continue;
    }

    if (selected) {
      break;
    }
  }

  return selected ?? rows[rows.length - 1] ?? null;
}

async function fetchAllGrades() {
  const { data, error } = await supabase
    .from("grades")
    .select(
      "id, submission_id, final_score, lecturer_score, ai_score, created_at, reviewed_at, submission:submissions(id, student_id, institution_id, status, submitted_at, assignment_id)",
    )
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch grades: ${error.message}`);
  }

  return data ?? [];
}

async function fetchAssignments(assignmentIds) {
  if (assignmentIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("assignments")
    .select("id, max_score, lecturer_id, institution_id, title, module_code")
    .in("id", assignmentIds);

  if (error) {
    throw new Error(`Failed to fetch assignments: ${error.message}`);
  }

  return data ?? [];
}

async function fetchStudentSignals(studentIds) {
  if (studentIds.length === 0) {
    return { snapshots: [], predictions: [] };
  }

  const [snapshotsRes, predictionsRes] = await Promise.all([
    supabase
      .from("student_risk_snapshots")
      .select("id, student_id, institution_id, snapshot_date, feature_version, features, created_at")
      .in("student_id", studentIds)
      .order("snapshot_date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("student_risk_predictions")
      .select("id, snapshot_id, student_id, institution_id, prediction_date, model_version, risk_score, risk_band, reason_codes, explanation, details, created_at")
      .in("student_id", studentIds)
      .order("prediction_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (snapshotsRes.error) {
    throw new Error(`Failed to fetch snapshots: ${snapshotsRes.error.message}`);
  }

  if (predictionsRes.error) {
    throw new Error(`Failed to fetch predictions: ${predictionsRes.error.message}`);
  }

  return {
    snapshots: snapshotsRes.data ?? [],
    predictions: predictionsRes.data ?? [],
  };
}

async function main() {
  const grades = await fetchAllGrades();
  const releasedGrades = grades.filter((grade) => grade.submission?.status === "released");
  const relevantGrades = releasedGrades.filter((grade) => {
    const score = pickGradeScore(grade);
    return Number.isFinite(score);
  });

  const assignmentIds = [...new Set(relevantGrades.map((grade) => grade.submission?.assignment_id).filter(Boolean))];
  const studentIds = [...new Set(relevantGrades.map((grade) => grade.submission?.student_id).filter(Boolean))];

  const [assignments, signals] = await Promise.all([
    fetchAssignments(assignmentIds),
    fetchStudentSignals(studentIds),
  ]);

  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const snapshotsByStudent = new Map();
  for (const snapshot of signals.snapshots) {
    const key = `${snapshot.student_id}:${snapshot.institution_id}`;
    const current = snapshotsByStudent.get(key) ?? [];
    current.push(snapshot);
    snapshotsByStudent.set(key, current);
  }

  const predictionsByStudent = new Map();
  for (const prediction of signals.predictions) {
    const key = `${prediction.student_id}:${prediction.institution_id}`;
    const current = predictionsByStudent.get(key) ?? [];
    current.push(prediction);
    predictionsByStudent.set(key, current);
  }

  const outcomeRows = [];

  for (const grade of relevantGrades) {
    const submission = grade.submission;
    if (!submission?.student_id || !submission?.institution_id || !submission?.assignment_id) {
      continue;
    }

    const assignment = assignmentById.get(submission.assignment_id) ?? null;
    const score = pickGradeScore(grade);
    if (!Number.isFinite(score)) {
      continue;
    }

    const maxScore = toNumber(assignment?.max_score) ?? null;
    const scorePercent = calculateScorePercent(score, maxScore ?? undefined);
    const outcome = deriveOutcome(scorePercent);
    if (!outcome) {
      continue;
    }

    const outcomeTime = toTime(grade.reviewed_at ?? grade.created_at ?? submission.submitted_at) ?? Date.now();
    const key = `${submission.student_id}:${submission.institution_id}`;
    const studentSnapshots = snapshotsByStudent.get(key) ?? [];
    const studentPredictions = predictionsByStudent.get(key) ?? [];

    const snapshot =
      selectLatestBefore(studentSnapshots, outcomeTime, (row) => toTime(row.snapshot_date) ?? toTime(row.created_at) ?? null) ??
      null;
    const prediction =
      selectLatestBefore(studentPredictions, outcomeTime, (row) => toTime(row.prediction_date) ?? toTime(row.created_at) ?? null) ??
      null;

    outcomeRows.push({
      student_id: submission.student_id,
      institution_id: submission.institution_id,
      source_grade_id: grade.id,
      source_submission_id: submission.id,
      prediction_id: prediction?.id ?? null,
      snapshot_id: snapshot?.id ?? null,
      outcome_date: new Date(outcomeTime).toISOString().slice(0, 10),
      label_window_days: LABEL_WINDOW_DAYS,
      label_value: outcome.labelValue,
      outcome_status: outcome.outcomeStatus,
      outcome_source: "grade",
      notes: [
        `Auto-labeled from released grade${assignment?.title ? ` for ${assignment.title}` : ""}.`,
        `Final score ${score}${maxScore ? ` / ${maxScore}` : ""}${Number.isFinite(scorePercent) ? ` (${scorePercent.toFixed(1)}%)` : ""}.`,
      ].join(" "),
    });
  }

  if (outcomeRows.length === 0) {
    console.log("No released grade rows were available to import.");
    return;
  }

  const sourceGradeIds = outcomeRows.map((row) => row.source_grade_id).filter(Boolean);
  const { data: existingOutcomes, error: existingError } = sourceGradeIds.length > 0
    ? await supabase
        .from("student_risk_outcomes")
        .select("id, source_grade_id")
        .in("source_grade_id", sourceGradeIds)
    : { data: [], error: null };

  if (existingError) {
    throw new Error(`Failed to fetch existing risk outcomes: ${existingError.message}`);
  }

  const existingByGradeId = new Map((existingOutcomes ?? []).map((row) => [row.source_grade_id, row.id]));
  const inserts = outcomeRows.filter((row) => !existingByGradeId.has(row.source_grade_id));
  const updates = outcomeRows.filter((row) => existingByGradeId.has(row.source_grade_id));

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("student_risk_outcomes").insert(inserts);
    if (insertError) {
      throw new Error(`Failed to insert risk outcomes: ${insertError.message}`);
    }
  }

  for (const row of updates) {
    const id = existingByGradeId.get(row.source_grade_id);
    if (!id) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("student_risk_outcomes")
      .update({
        student_id: row.student_id,
        institution_id: row.institution_id,
        prediction_id: row.prediction_id,
        snapshot_id: row.snapshot_id,
        source_grade_id: row.source_grade_id,
        source_submission_id: row.source_submission_id,
        outcome_date: row.outcome_date,
        label_window_days: row.label_window_days,
        label_value: row.label_value,
        outcome_status: row.outcome_status,
        outcome_source: row.outcome_source,
        notes: row.notes,
      })
      .eq("id", id);

    if (updateError) {
      throw new Error(`Failed to update risk outcome ${id}: ${updateError.message}`);
    }
  }

  console.log(`Imported ${inserts.length} new grade-derived risk outcomes.`);
  console.log(`Updated ${updates.length} existing grade-derived risk outcomes.`);
  console.log(`Released grades considered: ${relevantGrades.length}`);
  console.log(`Skipped grades without traceable scores: ${releasedGrades.length - relevantGrades.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
