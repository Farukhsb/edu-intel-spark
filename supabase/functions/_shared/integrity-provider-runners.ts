import { logError, logInfo, logWarn } from "./log.ts";
import type { IntegrityProviderFinding } from "./integrity-provider.ts";
import { analyzeTextSimilarity } from "./providers/internal-text-similarity.ts";
import {
  detectMossLanguage,
  groupMossComparableSubmissions,
  runMossSimilarityJob,
  type MossComparableSubmission,
  type MossRunnerConfig,
} from "./providers/moss.ts";

export interface InternalSimilaritySubmission {
  id: string;
  assignment_id: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  file_name: string | null;
  file_url?: string;
}

export interface InternalSimilarityContent {
  plainText: string;
  fileType: string;
  success: boolean;
  extractionError: string | null;
}

export async function runInternalSimilarityComparisons({
  assignmentId,
  submissions,
  contentMap,
  supportsInternalTextSimilarity,
  warnings,
}: {
  assignmentId: string;
  submissions: InternalSimilaritySubmission[];
  contentMap: Map<string, InternalSimilarityContent>;
  supportsInternalTextSimilarity: (content: InternalSimilarityContent) => boolean;
  warnings: string[];
}) {
  const findings: IntegrityProviderFinding[] = [];
  const comparableSubmissions = submissions
    .map((submission) => {
      const content = contentMap.get(submission.id);
      if (!content) return null;
      return supportsInternalTextSimilarity(content)
        ? {
          submission,
          content,
        }
        : null;
    })
    .filter(
      (
        item,
      ): item is {
        submission: InternalSimilaritySubmission;
        content: InternalSimilarityContent;
      } => Boolean(item),
    );

  logInfo("internal_similarity_started", {
    assignmentId,
    submissionCount: submissions.length,
    comparableSubmissionCount: comparableSubmissions.length,
  });

  for (let leftIndex = 0; leftIndex < comparableSubmissions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < comparableSubmissions.length; rightIndex += 1) {
      try {
        const left = comparableSubmissions[leftIndex];
        const right = comparableSubmissions[rightIndex];
        const pairwiseFinding = analyzeTextSimilarity(
          left.content.plainText,
          right.content.plainText,
          left.submission.id,
          right.submission.id,
          assignmentId,
        );
        findings.push(pairwiseFinding);
      } catch (error) {
        logError("internal_similarity_pair_failed", error, {
          assignmentId,
          leftSubmissionId: comparableSubmissions[leftIndex]?.submission.id ?? null,
          rightSubmissionId: comparableSubmissions[rightIndex]?.submission.id ?? null,
        });
        warnings.push("A pairwise internal similarity comparison failed and was skipped.");
      }
    }
  }

  logInfo("internal_similarity_completed", {
    assignmentId,
    submissionCount: submissions.length,
    comparableSubmissionCount: comparableSubmissions.length,
    findingCount: findings.length,
  });

  return findings;
}

export async function runMossSimilarityComparisons({
  assignmentId,
  submissions,
  config,
  fetchCodeSubmissionSource,
  warnings,
}: {
  assignmentId: string;
  submissions: InternalSimilaritySubmission[];
  config: MossRunnerConfig;
  fetchCodeSubmissionSource: (submission: InternalSimilaritySubmission) => Promise<string | null>;
  warnings: string[];
}) {
  const findings: IntegrityProviderFinding[] = [];
  const mossComparableSubmissions: MossComparableSubmission[] = [];

  for (const submission of submissions) {
    const language = detectMossLanguage(submission.file_name || submission.file_url || null);
    if (!language) continue;

    const sourceText = await fetchCodeSubmissionSource(submission);
    if (!sourceText) {
      logWarn("moss_source_unavailable", {
        assignmentId,
        submissionId: submission.id,
        fileName: submission.file_name || null,
      });
      continue;
    }

    mossComparableSubmissions.push({
      submissionId: submission.id,
      fileName: submission.file_name || null,
      sourceText,
      studentName: submission.student_name || null,
      studentEmail: submission.student_email || null,
      language,
    });
  }

  const mossGroups = groupMossComparableSubmissions(mossComparableSubmissions);

  logInfo("moss_similarity_started", {
    assignmentId,
    submissionCount: submissions.length,
    comparableSubmissionCount: mossComparableSubmissions.length,
    languageGroupCount: mossGroups.length,
  });

  for (const group of mossGroups) {
    try {
      const groupFindings = await runMossSimilarityJob({
        config,
        assignmentId,
        language: group.language,
        submissions: group.comparableSubmissions,
      });
      findings.push(...groupFindings);
    } catch (error) {
      logError("moss_similarity_failed", error, {
        assignmentId,
        language: group.language,
        comparableSubmissionCount: group.comparableSubmissions.length,
      });
      warnings.push("MOSS code similarity analysis was unavailable, but existing plagiarism analysis completed.");
    }
  }

  logInfo("moss_similarity_completed", {
    assignmentId,
    submissionCount: submissions.length,
    comparableSubmissionCount: mossComparableSubmissions.length,
    languageGroupCount: mossGroups.length,
    findingCount: findings.length,
  });

  return findings;
}
