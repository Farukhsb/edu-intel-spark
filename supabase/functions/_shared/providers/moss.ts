import type { IntegrityProviderFinding, IntegritySeverity } from "../integrity-provider.ts";
import { mapSimilarityScoreToSeverity } from "../integrity-provider.ts";

const MOSS_LANGUAGE_BY_EXTENSION: Record<string, string> = {
  c: "c",
  cc: "cc",
  cpp: "cc",
  cs: "csharp",
  cxx: "cc",
  f90: "fortran",
  h: "c",
  hh: "cc",
  hpp: "cc",
  hs: "haskell",
  java: "java",
  js: "javascript",
  lisp: "lisp",
  m: "matlab",
  ml: "ml",
  pas: "pascal",
  pl: "perl",
  py: "python",
  scm: "scheme",
  spice: "spice",
  tcl: "tcl",
  ts: "javascript",
  v: "verilog",
  vb: "visualbasic",
  vhd: "vhdl",
};

export type MossComparableSubmission = {
  submissionId: string;
  fileName: string | null;
  sourceText: string;
  studentName: string | null;
  studentEmail: string | null;
  language: string;
};

export type MossRunnerConfig = {
  runnerUrl: string;
  apiKey?: string | null;
  timeoutMs: number;
};

type MossRunnerRequest = {
  assignment_id: string;
  language: string;
  submissions: Array<{
    submission_id: string;
    file_name: string | null;
    student_name: string | null;
    student_email: string | null;
    source_text: string;
  }>;
};

type MossRunnerFinding = {
  submission_id?: unknown;
  compared_submission_id?: unknown;
  similarity_score?: unknown;
  severity?: unknown;
  evidence_summary?: unknown;
  matched_phrases?: unknown;
  raw_metadata?: unknown;
  analysis_limited?: unknown;
};

function extractReportUrl(rawResponse: Record<string, unknown>) {
  if (typeof rawResponse.report_url === "string" && rawResponse.report_url.trim()) {
    return rawResponse.report_url.trim();
  }

  if (typeof rawResponse.reportUrl === "string" && rawResponse.reportUrl.trim()) {
    return rawResponse.reportUrl.trim();
  }

  return undefined;
}

function getFileExtension(fileName: string | null | undefined) {
  const normalized = fileName?.trim().toLowerCase() ?? "";
  if (!normalized.includes(".")) return "";
  return normalized.split(".").pop() ?? "";
}

function normalizeSeverity(value: unknown, similarityScore: number): IntegritySeverity {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : mapSimilarityScoreToSeverity(similarityScore);
}

function normalizeMatchedPhrases(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
    : [];
}

export function detectMossLanguage(fileName: string | null | undefined) {
  const extension = getFileExtension(fileName);
  if (!extension) return null;
  const language = MOSS_LANGUAGE_BY_EXTENSION[extension];
  return language || null;
}

export function groupMossComparableSubmissions(submissions: MossComparableSubmission[]) {
  const grouped = new Map<string, MossComparableSubmission[]>();

  for (const submission of submissions) {
    if (!submission.language || !submission.sourceText.trim()) continue;
    const existing = grouped.get(submission.language) ?? [];
    existing.push(submission);
    grouped.set(submission.language, existing);
  }

  return Array.from(grouped.entries())
    .map(([language, comparableSubmissions]) => ({ language, comparableSubmissions }))
    .filter((group) => group.comparableSubmissions.length >= 2);
}

export async function runMossSimilarityJob(params: {
  config: MossRunnerConfig;
  assignmentId: string;
  language: string;
  submissions: MossComparableSubmission[];
}): Promise<IntegrityProviderFinding[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.config.timeoutMs);

  try {
    const requestBody: MossRunnerRequest = {
      assignment_id: params.assignmentId,
      language: params.language,
      submissions: params.submissions.map((submission) => ({
        submission_id: submission.submissionId,
        file_name: submission.fileName,
        student_name: submission.studentName,
        student_email: submission.studentEmail,
        source_text: submission.sourceText,
      })),
    };

    const response = await fetch(params.config.runnerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(params.config.apiKey
          ? { "x-api-key": params.config.apiKey }
          : {}),
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`MOSS runner request failed with status ${response.status}`);
    }

    const rawResponse = await response.json() as Record<string, unknown>;
    const reportUrl = extractReportUrl(rawResponse);
    const rawFindings = Array.isArray(rawResponse.findings) ? rawResponse.findings : [];

    return rawFindings
      .map((entry) => {
        const finding = entry as MossRunnerFinding;
        const submissionId = typeof finding.submission_id === "string" ? finding.submission_id : "";
        const comparedSubmissionId =
          typeof finding.compared_submission_id === "string" ? finding.compared_submission_id : "";
        const similarityScore = Number(finding.similarity_score ?? 0);
        const evidenceSummary =
          typeof finding.evidence_summary === "string" && finding.evidence_summary.trim()
            ? finding.evidence_summary.trim()
            : `MOSS reported code similarity in ${params.language} submissions.`;

        if (
          !submissionId ||
          !comparedSubmissionId ||
          submissionId === comparedSubmissionId ||
          !Number.isFinite(similarityScore)
        ) {
          return null;
        }

        return {
          provider: "moss",
          assignment_id: params.assignmentId,
          submission_id: submissionId,
          compared_submission_id: comparedSubmissionId,
          similarity_score: similarityScore,
          severity: normalizeSeverity(finding.severity, similarityScore),
          evidence_summary: evidenceSummary,
          matched_phrases: normalizeMatchedPhrases(finding.matched_phrases),
          raw_metadata: {
            language: params.language,
            report_url: reportUrl,
            ...(finding.raw_metadata && typeof finding.raw_metadata === "object"
              ? finding.raw_metadata as Record<string, unknown>
              : {}),
          },
          analysis_limited: Boolean(finding.analysis_limited),
        } satisfies IntegrityProviderFinding;
      })
      .filter((finding): finding is IntegrityProviderFinding => Boolean(finding));
  } finally {
    clearTimeout(timeout);
  }
}
