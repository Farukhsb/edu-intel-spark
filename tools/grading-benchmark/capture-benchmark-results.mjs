import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  buildCapturedResults,
  loadLocalEnv,
} from "./capture-benchmark-lib.mjs";
import { loadFixture } from "./score-benchmark-lib.mjs";

const args = process.argv.slice(2);

const readArg = (name) => {
  const prefixed = args.find((arg) => arg.startsWith(`${name}=`));
  if (prefixed) return prefixed.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

if (args.includes("--help")) {
  console.log(`GradeAI grading benchmark capture

Usage:
  node tools/grading-benchmark/capture-benchmark-results.mjs [--assignment-id <uuid>] [--output path]

Required environment:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY

Optional environment:
  GRADE_BENCHMARK_RUN_LABEL

Notes:
  - This script reads live submission and grade rows for one assignment.
  - It maps them back to the benchmark fixture by submission file name.
  - Name uploaded files after the fixture IDs, for example benchmark-dbnorm-01.txt.
  - If --assignment-id is omitted, the script will try to find the benchmark assignment by title and module code.
`);
  process.exit(0);
}

const assignmentId = readArg("--assignment-id");
const outputPath =
  readArg("--output") ??
  path.resolve("benchmarks", "grading-benchmark-results.run.json");

const mergedEnv = {
  ...loadLocalEnv(),
  ...process.env,
};

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  GRADE_BENCHMARK_RUN_LABEL: z.string().min(1).optional(),
}).superRefine((value, ctx) => {
  if (!value.SUPABASE_SERVICE_ROLE_KEY && !value.SUPABASE_SECRET_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SUPABASE_SERVICE_ROLE_KEY"],
      message: "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is required",
    });
  }
});

const parsedEnv = EnvSchema.safeParse(mergedEnv);
if (!parsedEnv.success) {
  console.error("Invalid grading benchmark capture environment:");
  for (const issue of parsedEnv.error.issues) {
    console.error(`- ${issue.path.join(".") || "env"}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsedEnv.data;
const fixture = loadFixture();
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
const supabase = createClient(env.SUPABASE_URL, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const findAssignment = async () => {
  if (assignmentId) {
    return await supabase
      .from("assignments")
      .select("id,title,module_code,max_score,status")
      .eq("id", assignmentId)
      .maybeSingle();
  }

  const fixtureTitle = fixture.assignment.title;
  const fixtureModuleCode = fixture.assignment.module_code;

  const { data, error } = await supabase
    .from("assignments")
    .select("id,title,module_code,max_score,status")
    .eq("title", fixtureTitle)
    .eq("module_code", fixtureModuleCode)
    .order("created_at", { ascending: false })
    .limit(2);

  if (error) return { data: null, error };
  if (!data || data.length === 0) return { data: null, error: null };
  if (data.length > 1) {
    console.error(
      `Multiple assignments matched ${fixtureTitle} (${fixtureModuleCode}). Re-run with --assignment-id.`,
    );
    process.exit(1);
  }

  return { data: data[0], error: null };
};

const { data: assignment, error: assignmentError } = await findAssignment();

if (assignmentError) {
  console.error(`Failed to load assignment: ${assignmentError.message}`);
  process.exit(1);
}

if (!assignment) {
  if (assignmentId) {
    console.error(`Assignment not found: ${assignmentId}`);
  } else {
    console.error(
      `Benchmark assignment not found for ${fixture.assignment.title} (${fixture.assignment.module_code})`,
    );
  }
  process.exit(1);
}

const { data: submissions, error: submissionsError } = await supabase
  .from("submissions")
  .select("id,file_name,student_name,student_email,status")
  .eq("assignment_id", assignmentId)
  .order("submitted_at", { ascending: true });

if (submissionsError) {
  console.error(`Failed to load submissions: ${submissionsError.message}`);
  process.exit(1);
}

const submissionIds = (submissions ?? []).map((submission) => submission.id);

const { data: grades, error: gradesError } =
  submissionIds.length === 0
    ? { data: [], error: null }
    : await supabase
        .from("grades")
        .select("submission_id,ai_score,final_score,grading_confidence,reviewed_at")
        .in("submission_id", submissionIds);

if (gradesError) {
  console.error(`Failed to load grades: ${gradesError.message}`);
  process.exit(1);
}

const runLabel =
  env.GRADE_BENCHMARK_RUN_LABEL ??
  `benchmark-capture-${new Date().toISOString().slice(0, 10)}`;

const captured = buildCapturedResults({
  fixture,
  assignment,
  submissions: submissions ?? [],
  grades: grades ?? [],
  runLabel,
});

fs.writeFileSync(outputPath, `${JSON.stringify(captured, null, 2)}\n`, "utf8");

console.log(`Captured benchmark results to ${outputPath}`);
console.log(`- Matched rows: ${captured.summary.matched_rows}/${captured.summary.fixture_rows}`);
console.log(`- Unmatched live submissions: ${captured.summary.unmatched_live_submissions}`);
console.log(`- Duplicate matches: ${captured.summary.duplicate_matches}`);

if (captured.summary.matched_rows === 0) {
  console.log("");
  console.log("No benchmark rows matched. Upload files named like benchmark-dbnorm-01.txt.");
}
