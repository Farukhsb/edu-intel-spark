import { z } from "npm:zod";

export type GradeImportMethod = "csv" | "image";

export type GradeImportRubricItem = {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  weight: number;
  normalizedScore: number;
  raw: Record<string, string>;
};

export type GradeImportSourceRow = {
  rowNumber: number;
  studentName: string;
  studentEmail: string | null;
  score: number;
  maxScore: number;
  submissionDate: string | null;
  notes: string | null;
  rubricBreakdown: GradeImportRubricItem[];
  raw: Record<string, string>;
};

export type GradeImportIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type SubmissionCandidate = {
  id: string;
  student_name: string | null;
  student_email: string | null;
  submitted_at: string;
  status?: string;
  file_name?: string;
  file_url?: string;
};

export type GradeImportPreviewRow = GradeImportSourceRow & {
  normalizedScore: number;
  matchedSubmissionId: string | null;
  submissionAction: "match" | "create";
  accepted: boolean;
  issues: GradeImportIssue[];
};

export type GradeImportPreviewSummary = {
  rowsProcessed: number;
  rowsAccepted: number;
  rowsRejected: number;
  matchedExistingSubmissions: number;
  createdSyntheticSubmissions: number;
  rowsWithWarnings: number;
};

export type GradeImportPreview = {
  rows: GradeImportPreviewRow[];
  summary: GradeImportPreviewSummary;
};

const GradeImportSourceRowSchema = z.object({
  studentName: z.string().trim().default(""),
  studentEmail: z.string().trim().email("Invalid student email").nullable().optional(),
  score: z.number().finite().nonnegative(),
  maxScore: z.number().finite().positive(),
  submissionDate: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

const EMAIL_KEYS = ["student_email", "email", "e-mail", "student mail", "learner email"];
const NAME_KEYS = ["student_name", "name", "student", "learner", "full_name", "full name"];
const SCORE_KEYS = ["score", "grade", "mark", "awarded_score", "obtained_score"];
const MAX_SCORE_KEYS = ["max_score", "maximum_score", "max", "total", "total_score"];
const DATE_KEYS = ["submission_date", "submitted_at", "date", "timestamp"];
const NOTE_KEYS = ["notes", "note", "feedback", "comment", "remarks"];
const RUBRIC_PREFIXES = ["rubric", "criterion"];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

function normalizeName(value: string | null | undefined) {
  const trimmed = value?.trim().replace(/\s+/g, " ") ?? "";
  return trimmed || null;
}

function parseNumericValue(value: string | null | undefined) {
  const cleaned = (value ?? "").trim().replace(/[,%$]/g, "");
  if (!cleaned) return null;
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

function isRubricHeader(header: string) {
  return RUBRIC_PREFIXES.some((prefix) =>
    header === prefix || header.startsWith(`${prefix}_`) || header.startsWith(`${prefix}-`)
  );
}

function parseDelimitedText(text: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        currentCell += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function findHeaderIndex(headers: string[], candidates: string[]) {
  for (const candidate of candidates) {
    const index = headers.indexOf(candidate);
    if (index >= 0) return index;
  }
  return -1;
}

function makeStableRowKey(row: { studentName: string; studentEmail: string | null }) {
  return row.studentEmail ? `email:${row.studentEmail}` : `name:${normalizeName(row.studentName)?.toLowerCase() ?? ""}`;
}

function parseRubricBreakdown(raw: Record<string, string>, fallbackMaxScore: number): GradeImportRubricItem[] {
  const rubricItems = new Map<string, GradeImportRubricItem>();
  const suffixes: Array<{ suffix: string; field: "label" | "score" | "weight" | "max_score" }> = [
    { suffix: "_max_score", field: "max_score" },
    { suffix: "_maxscore", field: "max_score" },
    { suffix: "_weight", field: "weight" },
    { suffix: "_score", field: "score" },
    { suffix: "_name", field: "label" },
    { suffix: "_label", field: "label" },
  ];

  for (const [header, value] of Object.entries(raw)) {
    const normalizedHeader = normalizeHeader(header);
    if (!isRubricHeader(normalizedHeader)) continue;

    const prefixMatch = RUBRIC_PREFIXES.find((prefix) =>
      normalizedHeader === prefix || normalizedHeader.startsWith(`${prefix}_`) || normalizedHeader.startsWith(`${prefix}-`)
    );
    if (!prefixMatch) continue;

    const remainder = normalizedHeader.slice(prefixMatch.length).replace(/^[_-]+/, "");
    if (!remainder) continue;

    let field: "label" | "score" | "weight" | "max_score" = "label";
    let key = remainder;
    for (const candidate of suffixes) {
      if (remainder === candidate.suffix.slice(1)) {
        field = candidate.field;
        key = `criterion_${rubricItems.size + 1}`;
        break;
      }
      if (remainder.endsWith(candidate.suffix)) {
        field = candidate.field;
        key = remainder.slice(0, -candidate.suffix.length).replace(/^[_-]+/, "");
        break;
      }
    }
    if (!key) {
      key = `criterion_${rubricItems.size + 1}`;
    }

    const existing = rubricItems.get(key) ?? {
      key,
      label: "",
      score: Number.NaN,
      maxScore: fallbackMaxScore,
      weight: 1,
      normalizedScore: Number.NaN,
      raw: {},
    };

    existing.raw[header] = value;

    if (field === "label") {
      existing.label = value.trim();
    } else if (field === "score") {
      const score = parseNumericValue(value);
      if (score != null) existing.score = score;
    } else if (field === "weight") {
      const weight = parseNumericValue(value);
      if (weight != null && weight >= 0) existing.weight = weight;
    } else if (field === "max_score") {
      const maxScore = parseNumericValue(value);
      if (maxScore != null && maxScore > 0) existing.maxScore = maxScore;
    }

    rubricItems.set(key, existing);
  }

  return Array.from(rubricItems.values())
    .map((item, index) => {
      const label = item.label.trim() || item.key.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
      const maxScore = Number.isFinite(item.maxScore) && item.maxScore > 0 ? item.maxScore : fallbackMaxScore;
      const score = Number.isFinite(item.score) ? item.score : Number.NaN;
      const normalizedScore = Number.isFinite(score) && maxScore > 0
        ? Math.round(((score / maxScore) * 100) * 100) / 100
        : Number.NaN;

      return {
        ...item,
        key: item.key || `criterion_${index + 1}`,
        label,
        maxScore,
        normalizedScore,
      };
    })
    .filter((item) => item.label.length > 0 || Number.isFinite(item.score) || Number.isFinite(item.weight));
}

export function calculateWeightedRubricScore(
  rubricBreakdown: GradeImportRubricItem[],
  assignmentMaxScore: number,
) {
  if (!Array.isArray(rubricBreakdown) || rubricBreakdown.length === 0) {
    return null;
  }

  const usableItems = rubricBreakdown.filter((item) =>
    Number.isFinite(item.score) &&
    Number.isFinite(item.maxScore) &&
    item.maxScore > 0 &&
    Number.isFinite(item.weight) &&
    item.weight >= 0,
  );

  if (usableItems.length === 0) {
    return null;
  }

  const totalWeight = usableItems.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  const normalizedPercent = usableItems.reduce((sum, item) => {
    const itemPercent = (item.score / item.maxScore) * 100;
    return sum + (itemPercent * item.weight);
  }, 0) / totalWeight;

  const scaled = (normalizedPercent / 100) * assignmentMaxScore;
  return Math.round(scaled * 100) / 100;
}

export function parseGradeImportCsv(text: string, fallbackMaxScore: number) {
  const rows = parseDelimitedText(text);
  if (rows.length === 0) return [];

  const headers = rows[0].map(normalizeHeader);
  const nameIdx = findHeaderIndex(headers, NAME_KEYS);
  const emailIdx = findHeaderIndex(headers, EMAIL_KEYS);
  const scoreIdx = findHeaderIndex(headers, SCORE_KEYS);
  const maxScoreIdx = findHeaderIndex(headers, MAX_SCORE_KEYS);
  const dateIdx = findHeaderIndex(headers, DATE_KEYS);
  const notesIdx = findHeaderIndex(headers, NOTE_KEYS);

  return rows.slice(1).map<GradeImportSourceRow>((cols, index) => {
    const studentName = normalizeName(nameIdx >= 0 ? cols[nameIdx] : "") ?? "";
    const studentEmail = normalizeEmail(emailIdx >= 0 ? cols[emailIdx] : null);
    const rawScore = scoreIdx >= 0 ? cols[scoreIdx] : "";
    const rawMaxScore = maxScoreIdx >= 0 ? cols[maxScoreIdx] : "";
    const score = parseNumericValue(rawScore) ?? Number.NaN;
    const maxScore = parseNumericValue(rawMaxScore) ?? fallbackMaxScore;
    const submissionDate = normalizeName(dateIdx >= 0 ? cols[dateIdx] : null);
    const notes = normalizeName(notesIdx >= 0 ? cols[notesIdx] : null);

    const raw: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      raw[headers[i]] = cols[i] ?? "";
    }
    const rubricBreakdown = parseRubricBreakdown(raw, fallbackMaxScore);

    return {
      rowNumber: index + 2,
      studentName,
      studentEmail,
      score,
      maxScore,
      submissionDate,
      notes,
      rubricBreakdown,
      raw,
    };
  });
}

function buildIssue(code: string, message: string, severity: "error" | "warning") {
  return { code, message, severity };
}

function matchSubmission(
  row: GradeImportSourceRow,
  submissions: SubmissionCandidate[],
) {
  const emailMatches = row.studentEmail
    ? submissions.filter((submission) => normalizeEmail(submission.student_email) === row.studentEmail)
    : [];
  if (emailMatches.length === 1) {
    return { submissionId: emailMatches[0].id, strategy: "match" as const };
  }
  if (emailMatches.length > 1) {
    return { submissionId: null, strategy: "create" as const };
  }

  const normalizedName = normalizeName(row.studentName)?.toLowerCase() ?? "";
  const nameMatches = normalizedName
    ? submissions.filter((submission) => normalizeName(submission.student_name)?.toLowerCase() === normalizedName)
    : [];
  if (nameMatches.length === 1) {
    return { submissionId: nameMatches[0].id, strategy: "match" as const };
  }

  return { submissionId: null, strategy: "create" as const };
}

export function normalizeImportedScore(
  score: number,
  rowMaxScore: number,
  assignmentMaxScore: number,
) {
  if (!Number.isFinite(score) || !Number.isFinite(rowMaxScore) || rowMaxScore <= 0) {
    return null;
  }

  const normalized = (score / rowMaxScore) * assignmentMaxScore;
  return Math.round(normalized * 100) / 100;
}

export function buildGradeImportPreview(params: {
  rows: GradeImportSourceRow[];
  submissions: SubmissionCandidate[];
  assignmentMaxScore: number;
  allowSyntheticSubmissions?: boolean;
}) {
  const seenKeys = new Set<string>();
  const previewRows: GradeImportPreviewRow[] = [];
  const allowSyntheticSubmissions = params.allowSyntheticSubmissions ?? true;

  for (const row of params.rows) {
    const issues: GradeImportIssue[] = [];
    const validation = GradeImportSourceRowSchema.safeParse(row);
    const weightedRubricScore = calculateWeightedRubricScore(row.rubricBreakdown, params.assignmentMaxScore);
    const hasRubricEvidence = row.rubricBreakdown.length > 0 && weightedRubricScore != null;

    if (!row.studentName.trim()) {
      issues.push(buildIssue("missing_name", "Missing student name", "error"));
    }
    if (!row.studentEmail && !row.studentName.trim()) {
      issues.push(buildIssue("missing_identity", "Missing student name or email", "error"));
    }
    if (!Number.isFinite(row.score) && !hasRubricEvidence) {
      issues.push(buildIssue("invalid_score", "Score is missing or invalid", "error"));
    }
    if (!Number.isFinite(row.maxScore) || row.maxScore <= 0) {
      issues.push(buildIssue("invalid_max_score", "Max score is missing or invalid", "warning"));
    }
    if (!validation.success) {
      for (const issue of validation.error.issues) {
        if (issue.path[0] === "studentEmail" && !row.studentEmail) continue;
        if (issue.path[0] === "submissionDate" && !row.submissionDate) continue;
        if (issue.path[0] === "notes" && !row.notes) continue;
        issues.push(buildIssue(`validation_${issue.code}`, issue.message, "error"));
      }
    }

    const duplicateKey = makeStableRowKey(row);
    if (duplicateKey && seenKeys.has(duplicateKey)) {
      issues.push(buildIssue("duplicate_row", "Duplicate student appears more than once in the file", "error"));
    }
    seenKeys.add(duplicateKey);

    const normalizedScore = hasRubricEvidence
      ? weightedRubricScore
      : normalizeImportedScore(row.score, row.maxScore, params.assignmentMaxScore);
    if (normalizedScore == null) {
      issues.push(buildIssue("score_normalization_failed", "Score could not be normalized", "error"));
    }

    if (normalizedScore != null) {
      if (normalizedScore < 0 || normalizedScore > params.assignmentMaxScore) {
        issues.push(buildIssue("score_out_of_range", "Score is outside the assignment max score", "error"));
      }
    }
    if (row.rubricBreakdown.length > 0 && weightedRubricScore == null) {
      issues.push(buildIssue("rubric_weighting_failed", "Rubric column scores could not be weighted", "error"));
    }

    const match = matchSubmission(row, params.submissions);
    if (match.strategy === "create" && !allowSyntheticSubmissions) {
      issues.push(buildIssue("missing_submission_match", "No existing submission matched this row", "error"));
    }
    if (!row.studentEmail && !normalizeName(row.studentName)) {
      issues.push(buildIssue("missing_identity", "Missing student name or email", "error"));
    }

    previewRows.push({
      ...row,
      normalizedScore: normalizedScore ?? 0,
      matchedSubmissionId: match.submissionId,
      submissionAction: match.strategy,
      accepted: issues.every((issue) => issue.severity !== "error") && normalizedScore != null,
      issues,
    });
  }

  const summary = previewRows.reduce<GradeImportPreviewSummary>(
    (accumulator, row) => {
      accumulator.rowsProcessed++;
      if (row.accepted) {
        accumulator.rowsAccepted++;
        if (row.submissionAction === "match") {
          accumulator.matchedExistingSubmissions++;
        } else {
          accumulator.createdSyntheticSubmissions++;
        }
      } else {
        accumulator.rowsRejected++;
      }
      if (row.issues.some((issue) => issue.severity === "warning")) {
        accumulator.rowsWithWarnings++;
      }
      return accumulator;
    },
    {
      rowsProcessed: 0,
      rowsAccepted: 0,
      rowsRejected: 0,
      matchedExistingSubmissions: 0,
      createdSyntheticSubmissions: 0,
      rowsWithWarnings: 0,
    },
  );

  return { rows: previewRows, summary };
}

export function buildSyntheticSubmissionFileUrl(importId: string, rowNumber: number) {
  return `grade-imports/${importId}/synthetic-submission-${rowNumber}.txt`;
}

export function buildImportedGradePayload(params: {
  importId: string;
  row: GradeImportPreviewRow;
  submissionId: string;
  lecturerId: string;
  sourceFileName: string | null;
  sourceFileHash: string;
  importMethod: GradeImportMethod;
  existingGrade?: {
    ai_score: number | null;
    ai_feedback: string | null;
    ai_breakdown: unknown;
    grading_confidence?: number | null;
    grading_metadata?: Record<string, unknown> | null;
    grade_source?: string | null;
    source_metadata?: Record<string, unknown> | null;
  } | null;
}) {
  const now = new Date().toISOString();
  const importMetadata = {
    import_id: params.importId,
    import_method: params.importMethod,
    source_file_name: params.sourceFileName,
    source_file_hash: params.sourceFileHash,
    row_number: params.row.rowNumber,
    student_name: params.row.studentName,
    student_email: params.row.studentEmail,
    original_score: params.row.score,
    original_max_score: params.row.maxScore,
    normalized_score: params.row.normalizedScore,
    submission_action: params.row.submissionAction,
    matched_submission_id: params.row.matchedSubmissionId,
    notes: params.row.notes,
    rubric_breakdown: params.row.rubricBreakdown,
  };

  const existingGrade = params.existingGrade ?? null;
  const mergedMetadata = {
    ...(existingGrade?.grading_metadata ?? {}),
    ...importMetadata,
    source: "lecturer_uploaded",
  };

  return {
    submission_id: params.submissionId,
    ai_score: existingGrade?.ai_score ?? null,
    ai_feedback: existingGrade?.ai_feedback ?? null,
    ai_breakdown: existingGrade?.ai_breakdown ?? null,
    lecturer_score: params.row.normalizedScore,
    lecturer_feedback: params.row.notes ?? null,
    final_score: params.row.normalizedScore,
    final_feedback: params.row.notes ?? null,
    reviewed_by: params.lecturerId,
    reviewed_at: now,
    grade_source: "lecturer_uploaded",
    source_metadata: importMetadata,
    grading_metadata: mergedMetadata,
    grading_confidence: existingGrade?.grading_confidence ?? null,
  };
}

export function summarizeRejectedRows(rows: GradeImportPreviewRow[]) {
  return rows
    .filter((row) => !row.accepted)
    .map((row) => ({
      rowNumber: row.rowNumber,
      studentName: row.studentName,
      studentEmail: row.studentEmail,
      issues: row.issues,
    }));
}

export function gradeImportPreviewSchema() {
  return z.object({
    rowsProcessed: z.number().int().nonnegative(),
    rowsAccepted: z.number().int().nonnegative(),
    rowsRejected: z.number().int().nonnegative(),
    matchedExistingSubmissions: z.number().int().nonnegative(),
    createdSyntheticSubmissions: z.number().int().nonnegative(),
    rowsWithWarnings: z.number().int().nonnegative(),
  });
}
