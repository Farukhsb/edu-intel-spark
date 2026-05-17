import { z } from "zod";

const EnvSchema = z.object({
  VITE_APP_URL: z.string().url().optional(),
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  LOAD_TEST_LECTURER_JWT: z.string().min(1).optional(),
  LOAD_TEST_MODERATOR_JWT: z.string().min(1).optional(),
  LOAD_TEST_STUDENT_JWT: z.string().min(1).optional(),
  LOAD_TEST_CONCURRENCY: z.coerce.number().int().positive().default(5),
  LOAD_TEST_ITERATIONS: z.coerce.number().int().positive().default(12),
  LOAD_TEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
});

const printUsage = () => {
  console.log(`GradeAI load test

Usage:
  npm run test:load

Required env:
  VITE_SUPABASE_URL
  VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY

Optional env:
  VITE_APP_URL
  LOAD_TEST_LECTURER_JWT
  LOAD_TEST_MODERATOR_JWT
  LOAD_TEST_STUDENT_JWT
  LOAD_TEST_CONCURRENCY
  LOAD_TEST_ITERATIONS
  LOAD_TEST_TIMEOUT_MS

Notes:
  - Default scenarios are read-heavy and avoid high-cost AI/integrity writes.
  - Authenticated scenarios only run when the matching JWT is provided.
  - Use real non-production or carefully scoped pilot accounts when targeting live data.
`);
};

if (process.argv.includes("--help")) {
  printUsage();
  process.exit(0);
}

const parsedEnv = EnvSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error("Invalid load-test environment:");
  for (const issue of parsedEnv.error.issues) {
    console.error(`- ${issue.path.join(".") || "env"}: ${issue.message}`);
  }
  console.error("");
  printUsage();
  process.exit(1);
}

const env = parsedEnv.data;
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY;

if (!publishableKey) {
  console.error("Missing VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const buildHeaders = (jwt) => ({
  apikey: publishableKey,
  Authorization: jwt ? `Bearer ${jwt}` : `Bearer ${publishableKey}`,
});

const withTimeout = async (request, timeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await request(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const percentile = (values, target) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * target) - 1);
  return sorted[index];
};

const round = (value) => Math.round(value * 100) / 100;

const summarize = (samples) => {
  const durations = samples.map((sample) => sample.durationMs);
  const successes = samples.filter((sample) => sample.ok).length;
  const failures = samples.length - successes;
  const average = durations.reduce((sum, value) => sum + value, 0) / Math.max(durations.length, 1);

  return {
    requests: samples.length,
    successes,
    failures,
    errorRate: round((failures / Math.max(samples.length, 1)) * 100),
    avgMs: round(average),
    p95Ms: round(percentile(durations, 0.95)),
    maxMs: round(Math.max(...durations, 0)),
  };
};

const runScenario = async ({ name, request, iterations, concurrency }) => {
  const samples = [];
  let cursor = 0;

  const worker = async () => {
    while (cursor < iterations) {
      const iteration = cursor;
      cursor += 1;

      const startedAt = performance.now();

      try {
        const response = await request();
        samples.push({
          ok: response.ok,
          durationMs: performance.now() - startedAt,
          status: response.status,
        });
      } catch (error) {
        samples.push({
          ok: false,
          durationMs: performance.now() - startedAt,
          status: error?.name === "AbortError" ? "timeout" : "error",
        });
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return {
    name,
    ...summarize(samples),
  };
};

const createScenario = ({ name, url, jwt, timeoutMs }) => ({
  name,
  request: async () =>
    withTimeout(
      (signal) =>
        fetch(url, {
          method: "GET",
          headers: buildHeaders(jwt),
          signal,
        }),
      timeoutMs,
    ),
});

const scenarios = [];

if (env.VITE_APP_URL) {
  scenarios.push({
    name: "frontend-home",
    request: async () =>
      withTimeout(
        (signal) =>
          fetch(env.VITE_APP_URL, {
            method: "GET",
            signal,
          }),
        env.LOAD_TEST_TIMEOUT_MS,
      ),
  });
}

if (env.LOAD_TEST_LECTURER_JWT) {
  scenarios.push(
    createScenario({
      name: "lecturer-assignments",
      url: `${env.VITE_SUPABASE_URL}/rest/v1/assignments?select=id,title,status,created_at&order=created_at.desc&limit=25`,
      jwt: env.LOAD_TEST_LECTURER_JWT,
      timeoutMs: env.LOAD_TEST_TIMEOUT_MS,
    }),
    createScenario({
      name: "lecturer-submissions",
      url: `${env.VITE_SUPABASE_URL}/rest/v1/submissions?select=id,assignment_id,status,submitted_at,file_name&order=submitted_at.desc&limit=25`,
      jwt: env.LOAD_TEST_LECTURER_JWT,
      timeoutMs: env.LOAD_TEST_TIMEOUT_MS,
    }),
  );
}

if (env.LOAD_TEST_MODERATOR_JWT) {
  scenarios.push(
    createScenario({
      name: "moderator-cases",
      url: `${env.VITE_SUPABASE_URL}/rest/v1/moderation_cases?select=id,status,updated_at,integrity_risk_score,confidence_score&order=updated_at.desc&limit=25`,
      jwt: env.LOAD_TEST_MODERATOR_JWT,
      timeoutMs: env.LOAD_TEST_TIMEOUT_MS,
    }),
  );
}

if (env.LOAD_TEST_STUDENT_JWT) {
  scenarios.push(
    createScenario({
      name: "student-grades",
      url: `${env.VITE_SUPABASE_URL}/rest/v1/grades?select=submission_id,final_score,created_at&order=created_at.desc&limit=25`,
      jwt: env.LOAD_TEST_STUDENT_JWT,
      timeoutMs: env.LOAD_TEST_TIMEOUT_MS,
    }),
  );
}

if (scenarios.length === 0) {
  console.error("No runnable scenarios found. Provide VITE_APP_URL and/or one or more LOAD_TEST_*_JWT values.");
  process.exit(1);
}

console.log(`Running ${scenarios.length} load scenario(s) with concurrency=${env.LOAD_TEST_CONCURRENCY}, iterations=${env.LOAD_TEST_ITERATIONS}`);
console.log("");

const results = [];
for (const scenario of scenarios) {
  const result = await runScenario({
    name: scenario.name,
    request: scenario.request,
    iterations: env.LOAD_TEST_ITERATIONS,
    concurrency: env.LOAD_TEST_CONCURRENCY,
  });
  results.push(result);
}

for (const result of results) {
  console.log(`${result.name}`);
  console.log(`  requests: ${result.requests}`);
  console.log(`  successes: ${result.successes}`);
  console.log(`  failures: ${result.failures}`);
  console.log(`  error rate: ${result.errorRate}%`);
  console.log(`  avg: ${result.avgMs}ms`);
  console.log(`  p95: ${result.p95Ms}ms`);
  console.log(`  max: ${result.maxMs}ms`);
  console.log("");
}

const hasFailure = results.some((result) => result.failures > 0);
if (hasFailure) {
  process.exit(1);
}
