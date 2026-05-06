import express from "express";
import multer from "multer";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

const app = express();

const port = Number(process.env.PORT || 8788);
const requestRoot = resolve(process.cwd(), "tmp");
const mossScriptPath = resolve(process.cwd(), "moss");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 50,
    fileSize: 2 * 1024 * 1024,
  },
});

function getEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : "";
}

function timingSafeMatch(actual, expected) {
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function sanitizeFileName(fileName, fallbackIndex) {
  const ext = extname(fileName || "") || ".txt";
  const stem = basename(fileName || `submission-${fallbackIndex}`, ext)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120) || `submission-${fallbackIndex}`;
  return `${stem}${ext}`;
}

function extractReportUrl(stdout) {
  const match = stdout.match(/https?:\/\/\S+/);
  return match ? match[0].trim() : null;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function stripHtml(value) {
  return decodeHtmlEntities(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeSavedFileKey(value) {
  return basename(String(value || "").trim().replace(/\\/g, "/"));
}

function similarityToSeverity(score) {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function parseLinkLabel(value) {
  const text = stripHtml(value);
  const similarityMatch = text.match(/\((\d+)%\)\s*$/);
  const similarity = similarityMatch ? Number(similarityMatch[1]) : null;
  const fileLabel = similarityMatch ? text.slice(0, similarityMatch.index).trim() : text;
  return {
    fileKey: normalizeSavedFileKey(fileLabel),
    similarity,
  };
}

async function fetchReportHtml(reportUrl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(reportUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`MOSS report fetch failed with status ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseMossFindings(reportUrl, reportHtml, descriptorMap) {
  const findings = [];
  const seenPairs = new Set();
  const rowMatches = reportHtml.matchAll(/<tr[^>]*>([\s\S]*?)(?=<tr\b|<\/table>)/gi);

  for (const rowMatch of rowMatches) {
    const rowHtml = rowMatch[1] || "";
    const linkMatches = [...rowHtml.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    if (linkMatches.length < 2) continue;

    const left = parseLinkLabel(linkMatches[0][2]);
    const right = parseLinkLabel(linkMatches[1][2]);
    const leftDescriptor = descriptorMap.get(left.fileKey);
    const rightDescriptor = descriptorMap.get(right.fileKey);
    if (!leftDescriptor || !rightDescriptor) continue;

    const pairKey = [leftDescriptor.submissionId, rightDescriptor.submissionId].sort().join("::");
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    const similarityScore = Math.max(left.similarity || 0, right.similarity || 0);
    if (!Number.isFinite(similarityScore) || similarityScore <= 0) continue;

    const linesMatchedMatch = stripHtml(rowHtml).match(/\b(\d+)\s*$/);
    const linesMatched = linesMatchedMatch ? Number(linesMatchedMatch[1]) : null;
    const matchPath = (() => {
      try {
        return new URL(linkMatches[0][1], reportUrl).toString();
      } catch {
        return linkMatches[0][1];
      }
    })();

    findings.push({
      submission_id: leftDescriptor.submissionId,
      compared_submission_id: rightDescriptor.submissionId,
      similarity_score: similarityScore,
      severity: similarityToSeverity(similarityScore),
      evidence_summary: `MOSS reported ${similarityScore}% similarity between ${leftDescriptor.studentName || left.fileKey} and ${rightDescriptor.studentName || right.fileKey}.`,
      matched_phrases: [],
      raw_metadata: {
        report_url: reportUrl,
        match_path: matchPath,
        lines_matched: linesMatched,
        left_file_name: left.fileKey,
        right_file_name: right.fileKey,
      },
      analysis_limited: false,
    });
  }

  return findings;
}

function spawnWithTimeout(command, args, timeoutMs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("MOSS request timed out"));
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
        const summary = stderr.trim() || stdout.trim() || `exit code ${code}`;
        reject(new Error(`MOSS failed: ${summary}`));
        return;
      }

      resolvePromise({ stdout, stderr });
    });
  });
}

async function createRequestDirectory() {
  await mkdir(requestRoot, { recursive: true });
  const requestId = `req-${randomUUID()}`;
  const requestDir = join(requestRoot, requestId);
  await mkdir(requestDir, { recursive: true });
  return requestDir;
}

async function saveUploadedFiles(requestDir, files) {
  const savedPaths = [];
  const descriptorMap = new Map();

  for (const [index, file] of files.entries()) {
    const safeName = sanitizeFileName(file.originalname, index + 1);
    const filePath = join(requestDir, safeName);
    await writeFile(filePath, file.buffer);
    savedPaths.push(filePath);
    descriptorMap.set(safeName, {
      submissionId: safeName,
      studentName: null,
      studentEmail: null,
    });
  }

  return { savedPaths, descriptorMap };
}

async function saveJsonSubmissions(requestDir, submissions) {
  const savedPaths = [];
  const descriptorMap = new Map();

  for (const [index, submission] of submissions.entries()) {
    const safeName = sanitizeFileName(submission.file_name, index + 1);
    const filePath = join(requestDir, safeName);
    await writeFile(filePath, String(submission.source_text || ""));
    savedPaths.push(filePath);
    descriptorMap.set(safeName, {
      submissionId: String(submission.submission_id || safeName),
      studentName: typeof submission.student_name === "string" ? submission.student_name.trim() || null : null,
      studentEmail: typeof submission.student_email === "string" ? submission.student_email.trim() || null : null,
    });
  }

  return { savedPaths, descriptorMap };
}

function readJsonSubmissions(body) {
  return Array.isArray(body?.submissions)
    ? body.submissions.filter((submission) =>
      submission &&
      typeof submission === "object" &&
      typeof submission.source_text === "string" &&
      submission.source_text.trim()
    )
    : [];
}

function isMultipartRequest(req) {
  return String(req.headers["content-type"] || "").toLowerCase().includes("multipart/form-data");
}

async function maybeParseMultipart(req, res) {
  if (!isMultipartRequest(req)) return;

  await new Promise((resolvePromise, reject) => {
    upload.array("files")(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolvePromise();
    });
  });
}

function requireApiKey(req, res, next) {
  const configuredSecret = getEnv("GRADEAI_API_SECRET");
  if (!configuredSecret) {
    res.status(500).json({ error: "Server is not configured" });
    return;
  }

  const incomingApiKey = String(req.header("x-api-key") || "");
  if (!incomingApiKey || !timingSafeMatch(incomingApiKey, configuredSecret)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

app.disable("x-powered-by");
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "gradeai-moss-runner",
  });
});

app.post("/run-moss", requireApiKey, async (req, res) => {
  const mossUserId = getEnv("MOSS_USER_ID");
  const timeoutMs = Number(getEnv("MOSS_RUNNER_TIMEOUT_MS") || 30000);
  const maxMatches = Number(getEnv("MOSS_MAX_MATCHES") || 10);

  if (!mossUserId) {
    res.status(500).json({ error: "Server is not configured" });
    return;
  }

  let requestDir = "";

  try {
    await maybeParseMultipart(req, res);

    const language = String(req.body?.language || "").trim();
    const comment = String(req.body?.comment || "GradeAI MOSS run").trim();
    const files = Array.isArray(req.files) ? req.files : [];
    const jsonSubmissions = readJsonSubmissions(req.body);

    if (!language) {
      res.status(400).json({ error: "language is required" });
      return;
    }

    if (files.length < 2 && jsonSubmissions.length < 2) {
      res.status(400).json({ error: "At least two files are required" });
      return;
    }

    requestDir = await createRequestDirectory();
    const { savedPaths, descriptorMap } = files.length > 0
      ? await saveUploadedFiles(requestDir, files)
      : await saveJsonSubmissions(requestDir, jsonSubmissions);

    const args = [
      mossScriptPath,
      "-l",
      language,
      "-m",
      String(maxMatches),
      "-c",
      comment,
      ...savedPaths,
    ];

    const { stdout } = await spawnWithTimeout("perl", args, timeoutMs);
    const reportUrl = extractReportUrl(stdout);

    if (!reportUrl) {
      throw new Error("MOSS completed without returning a report URL");
    }

    let findings = [];

    try {
      const reportHtml = await fetchReportHtml(reportUrl, timeoutMs);
      findings = parseMossFindings(reportUrl, reportHtml, descriptorMap);
    } catch (reportError) {
      console.warn("MOSS report parsing skipped", {
        message: reportError instanceof Error ? reportError.message : "Unknown error",
        reportUrl,
      });
    }

    res.json({
      reportUrl,
      report_url: reportUrl,
      fileCount: savedPaths.length,
      findings,
    });
  } catch (error) {
    console.error("MOSS runner request failed", {
      message: error instanceof Error ? error.message : "Unknown error",
      requestType: isMultipartRequest(req) ? "multipart" : "json",
    });
    res.status(502).json({ error: "MOSS request failed" });
  } finally {
    if (requestDir) {
      await rm(requestDir, { recursive: true, force: true });
    }
  }
});

app.listen(port, async () => {
  await mkdir(join(tmpdir(), "gradeai-moss-bootstrap"), { recursive: true }).catch(() => {});
  console.log(`MOSS runner listening on http://0.0.0.0:${port}`);
});
