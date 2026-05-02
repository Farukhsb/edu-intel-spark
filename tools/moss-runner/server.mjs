import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_PORT = 8788;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_MATCHES = 10;

const REQUIRED_ENV = ["MOSS_USER_ID", "MOSS_SCRIPT_PATH"];

function getConfig() {
  return {
    port: Number(process.env.PORT || DEFAULT_PORT),
    bearerToken: process.env.MOSS_RUNNER_BEARER_TOKEN?.trim() || null,
    mossUserId: process.env.MOSS_USER_ID?.trim() || "",
    mossScriptPath: process.env.MOSS_SCRIPT_PATH?.trim() || "",
    timeoutMs: Number(process.env.MOSS_RUNNER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    maxMatches: Number(process.env.MOSS_MAX_MATCHES || DEFAULT_MAX_MATCHES),
  };
}

function json(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function validateAuth(req, config) {
  if (!config.bearerToken) return null;
  const authHeader = req.headers.authorization || "";
  if (authHeader !== `Bearer ${config.bearerToken}`) {
    return json(401, { error: "Unauthorized" });
  }
  return null;
}

function ensureConfigured(config) {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    return json(500, {
      error: "MOSS runner is not configured",
      missing,
    });
  }
  return null;
}

function sanitizeFileName(fileName, submissionId) {
  const ext = extname(fileName || "") || ".txt";
  const stem = basename(fileName || submissionId, ext)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80) || submissionId;
  return `${stem}${ext}`;
}

function buildAssignmentComment(assignmentId, language) {
  return `gradeai:${assignmentId}:${language}`;
}

function parseSubmissionResultUrl(stdout, stderr) {
  const combined = `${stdout}\n${stderr}`;
  const match = combined.match(/https?:\/\/\S+/);
  return match ? match[0].trim() : null;
}

function parseMatchRows(indexHtml, submissionIds) {
  const anchors = [...indexHtml.matchAll(/<A HREF="([^"]+)">([\s\S]*?)<\/A>/gi)];
  const findings = [];

  for (const [, href, rawLabel] of anchors) {
    const label = rawLabel.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const matchedIds = submissionIds.filter((id) => label.includes(id));
    if (matchedIds.length < 2) continue;

    const percentages = [...label.matchAll(/\((\d+)%\)/g)].map((match) => Number(match[1]));
    const similarityScore = percentages.length > 0
      ? Math.max(...percentages.filter((value) => Number.isFinite(value)))
      : 0;

    findings.push({
      submission_id: matchedIds[0],
      compared_submission_id: matchedIds[1],
      similarity_score: similarityScore,
      severity: similarityScore >= 80 ? "high" : similarityScore >= 50 ? "medium" : "low",
      evidence_summary: `MOSS reported ${similarityScore}% overlap for these code submissions.`,
      matched_phrases: [],
      analysis_limited: false,
      raw_metadata: {
        match_path: href,
        match_label: label,
      },
    });
  }

  return findings;
}

async function fetchMossFindings(resultUrl, submissionIds, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(resultUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to load MOSS result page: ${response.status}`);
    }

    const indexHtml = await response.text();
    return parseMatchRows(indexHtml, submissionIds);
  } finally {
    clearTimeout(timeout);
  }
}

async function createSubmissionDirectories(rootDir, submissions) {
  const submissionIds = [];

  for (const submission of submissions) {
    const submissionId = String(submission.submission_id || "").trim();
    const fileName = sanitizeFileName(String(submission.file_name || ""), submissionId);
    const sourceText = String(submission.source_text || "");
    if (!submissionId || !sourceText.trim()) continue;

    const submissionDir = join(rootDir, submissionId);
    await mkdir(submissionDir, { recursive: true });
    await writeFile(join(submissionDir, fileName), sourceText, "utf8");
    submissionIds.push(submissionId);
  }

  return submissionIds;
}

async function runMossSubmission({ assignmentId, language, submissions, config }) {
  const tmpRoot = await mkdtemp(join(tmpdir(), "gradeai-moss-"));

  try {
    const submissionIds = await createSubmissionDirectories(tmpRoot, submissions);
    if (submissionIds.length < 2) {
      return {
        report_url: null,
        findings: [],
      };
    }

    const mossArgs = [
      resolve(config.mossScriptPath),
      "-l",
      language,
      "-d",
      "-m",
      String(config.maxMatches),
      "-c",
      buildAssignmentComment(assignmentId, language),
    ];

    for (const submissionId of submissionIds) {
      const submissionDir = join(tmpRoot, submissionId);
      const files = await readFileList(submissionDir);
      mossArgs.push(...files);
    }

    const { stdout, stderr } = await spawnWithTimeout("perl", mossArgs, config.timeoutMs, {
      MOSS_USER_ID: config.mossUserId,
      userid: config.mossUserId,
    });

    const resultUrl = parseSubmissionResultUrl(stdout, stderr);
    if (!resultUrl) {
      throw new Error("MOSS submission completed without a result URL");
    }

    const findings = await fetchMossFindings(resultUrl, submissionIds, config.timeoutMs);

    return {
      report_url: resultUrl,
      findings,
    };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

async function readFileList(dirPath) {
  const entries = await readDirRecursive(dirPath);
  return entries.filter((entry) => entry.type === "file").map((entry) => entry.path);
}

async function readDirRecursive(dirPath) {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dirPath, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const nextPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await readDirRecursive(nextPath)));
    } else if (entry.isFile()) {
      results.push({ path: nextPath, type: "file" });
    }
  }

  return results;
}

function spawnWithTimeout(command, args, timeoutMs, extraEnv = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      env: {
        ...process.env,
        ...extraEnv,
      },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`Process timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${stderr || stdout}`));
        return;
      }

      resolvePromise({ stdout, stderr });
    });
  });
}

const server = createServer(async (req, res) => {
  const config = getConfig();

  if (req.method === "OPTIONS") {
    const response = json(204, {});
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/moss") {
    const response = json(404, { error: "Not found" });
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(await response.text());
    return;
  }

  const configError = ensureConfigured(config) || validateAuth(req, config);
  if (configError) {
    res.writeHead(configError.status, Object.fromEntries(configError.headers.entries()));
    res.end(await configError.text());
    return;
  }

  try {
    const body = await readJsonBody(req);
    const assignmentId = String(body.assignment_id || "").trim();
    const language = String(body.language || "").trim();
    const submissions = Array.isArray(body.submissions) ? body.submissions : [];

    if (!assignmentId || !language || submissions.length < 2) {
      const response = json(400, {
        error: "assignment_id, language, and at least two submissions are required",
      });
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(await response.text());
      return;
    }

    const result = await runMossSubmission({
      assignmentId,
      language,
      submissions,
      config,
    });

    const response = json(200, result);
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(await response.text());
  } catch (error) {
    const response = json(500, {
      error: error instanceof Error ? error.message : "Unknown MOSS runner error",
    });
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(await response.text());
  }
});

server.listen(getConfig().port, () => {
  console.log(`MOSS runner listening on http://127.0.0.1:${getConfig().port}/moss`);
});
