import fs from "node:fs";
import path from "node:path";

export const DEFAULT_ENV_FILES = [".env.local", ".env"];

export const normalizeFileStem = (fileName) =>
  String(fileName ?? "")
    .trim()
    .replace(/\.[^.]+$/, "")
    .toLowerCase();

export const buildFixtureSubmissionMap = (fixture) =>
  new Map(
    fixture.submissions.map((submission) => [submission.submission_id.toLowerCase(), submission]),
  );

export const matchFixtureSubmissionId = (fileName, fixtureMap) => {
  const stem = normalizeFileStem(fileName);
  if (!stem) return null;
  if (fixtureMap.has(stem)) return fixtureMap.get(stem).submission_id;

  const prefixMatch = [...fixtureMap.values()].find((submission) =>
    stem.startsWith(`${submission.submission_id.toLowerCase()}-`) ||
    stem.startsWith(`${submission.submission_id.toLowerCase()}_`),
  );

  return prefixMatch?.submission_id ?? null;
};

export const buildCapturedResults = ({ fixture, assignment, submissions, grades, runLabel }) => {
  const fixtureMap = buildFixtureSubmissionMap(fixture);
  const gradesBySubmissionId = new Map(grades.map((grade) => [grade.submission_id, grade]));
  const matchedByBenchmarkId = new Map();
  const unmatchedSubmissions = [];
  const duplicateMatches = [];

  for (const submission of submissions) {
    const benchmarkSubmissionId = matchFixtureSubmissionId(submission.file_name, fixtureMap);
    if (!benchmarkSubmissionId) {
      unmatchedSubmissions.push({
        submission_id: submission.id,
        file_name: submission.file_name,
        student_name: submission.student_name,
      });
      continue;
    }

    if (matchedByBenchmarkId.has(benchmarkSubmissionId)) {
      duplicateMatches.push({
        benchmark_submission_id: benchmarkSubmissionId,
        existing_submission_id: matchedByBenchmarkId.get(benchmarkSubmissionId).submission_id,
        duplicate_submission_id: submission.id,
        duplicate_file_name: submission.file_name,
      });
      continue;
    }

    const grade = gradesBySubmissionId.get(submission.id) ?? null;
    matchedByBenchmarkId.set(benchmarkSubmissionId, {
      submission_id: benchmarkSubmissionId,
      live_submission_id: submission.id,
      live_file_name: submission.file_name,
      live_student_name: submission.student_name ?? null,
      live_student_email: submission.student_email ?? null,
      live_status: submission.status,
      ai_score: grade?.ai_score ?? null,
      final_score: grade?.final_score ?? null,
      grading_confidence: grade?.grading_confidence ?? null,
      reviewed_at: grade?.reviewed_at ?? null,
      notes: "",
    });
  }

  const results = fixture.submissions.map((fixtureSubmission) => {
    return (
      matchedByBenchmarkId.get(fixtureSubmission.submission_id) ?? {
        submission_id: fixtureSubmission.submission_id,
        live_submission_id: null,
        live_file_name: null,
        live_student_name: null,
        live_student_email: null,
        live_status: null,
        ai_score: null,
        final_score: null,
        grading_confidence: null,
        reviewed_at: null,
        notes: "No matching live submission found. Use file names like benchmark-dbnorm-01.txt.",
      }
    );
  });

  return {
    run_label: runLabel,
    captured_at: new Date().toISOString(),
    assignment: {
      id: assignment.id,
      title: assignment.title,
      module_code: assignment.module_code,
      max_score: assignment.max_score,
      status: assignment.status,
    },
    summary: {
      fixture_rows: fixture.submissions.length,
      matched_rows: results.filter((row) => row.live_submission_id).length,
      unmatched_live_submissions: unmatchedSubmissions.length,
      duplicate_matches: duplicateMatches.length,
    },
    unmatched_live_submissions: unmatchedSubmissions,
    duplicate_matches: duplicateMatches,
    results,
  };
};

const parseSimpleEnv = (content) => {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
};

export const loadLocalEnv = (cwd = process.cwd(), envFiles = DEFAULT_ENV_FILES) => {
  const merged = {};
  for (const envFile of envFiles) {
    const envPath = path.resolve(cwd, envFile);
    if (!fs.existsSync(envPath)) continue;
    Object.assign(merged, parseSimpleEnv(fs.readFileSync(envPath, "utf8")));
  }
  return merged;
};
