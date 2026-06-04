import { logError, logInfo, logWarn } from "../_shared/log.ts";
import { analyzeTextSimilarity } from "../_shared/providers/internal-text-similarity.ts";
import type { IntegrityProviderFinding } from "../_shared/integrity-provider.ts";
import { runMossSimilarityComparisons, type InternalSimilaritySubmission } from "../_shared/integrity-provider-runners.ts";
import { buildInternalComparisonPairs } from "./internal-comparison-pairs.ts";
import { fetchFileContent as sharedFetchFileContent } from "./extraction.ts";
import { toProviderSubmission, type SubmissionRow } from "./analysis.ts";

const MAX_INTERNAL_COMPARISON_SUBMISSIONS = 80;
const INTERNAL_SIMILARITY_MIN_WORDS = 50;

export async function runProviderIntegrityAnalysis(params: {
  shouldRunInternalProvider: boolean;
  shouldRunMossProvider: boolean;
  shouldSkipInternalSimilarityForCohortSize: boolean;
  requestedAssignmentId: string;
  comparisonSubmissions: SubmissionRow[];
  requestedSubmissionIdSet: Set<string>;
  contentMap: Map<string, Awaited<ReturnType<typeof sharedFetchFileContent>>>;
  supabaseAdmin: { storage: { from: (name: string) => { download: (path: string) => Promise<{ data: Blob | null; error: unknown }> } } };
  mossRunnerConfig: { runnerUrl: string; apiKey: string | null; timeoutMs: number } | null;
  warnings: string[];
}) {
  const internalFindings: IntegrityProviderFinding[] = [];
  const mossFindings: IntegrityProviderFinding[] = [];

  if (params.shouldSkipInternalSimilarityForCohortSize) {
    logWarn("internal_similarity_skipped_large_cohort", {
      assignmentId: params.requestedAssignmentId,
      submissionCount: params.comparisonSubmissions.length,
      maxSupportedSubmissions: MAX_INTERNAL_COMPARISON_SUBMISSIONS,
    });
    params.warnings.push(
      `Internal cohort similarity scanning was skipped because this assignment has ${params.comparisonSubmissions.length} submissions, exceeding the current safety limit of ${MAX_INTERNAL_COMPARISON_SUBMISSIONS}.`,
    );
  }

  if (
    params.shouldRunInternalProvider &&
    !params.shouldSkipInternalSimilarityForCohortSize &&
    params.requestedAssignmentId &&
    params.comparisonSubmissions.length >= 2
  ) {
    const comparableSubmissions = params.comparisonSubmissions
      .map((submission) => {
        const content = params.contentMap.get(submission.id);
        if (!content) return null;
        return content.success &&
          !content.extractionError &&
          (!content.extractionQuality || content.extractionQuality.isUsable) &&
          ["pdf", "docx", "txt"].includes(content.fileType) &&
          (content.plainText.trim().split(/\s+/).filter(Boolean).length >= INTERNAL_SIMILARITY_MIN_WORDS)
          ? { submission, content }
          : null;
      })
      .filter(
        (item): item is {
          submission: SubmissionRow;
          content: Awaited<ReturnType<typeof sharedFetchFileContent>>;
        } => Boolean(item),
      );

    logInfo("internal_similarity_started", {
      assignmentId: params.requestedAssignmentId,
      submissionCount: params.comparisonSubmissions.length,
      comparableSubmissionCount: comparableSubmissions.length,
    });

    const comparablePairs = buildInternalComparisonPairs(comparableSubmissions, params.requestedSubmissionIdSet);

    logInfo("internal_similarity_pairs_selected", {
      assignmentId: params.requestedAssignmentId,
      pairCount: comparablePairs.length,
    });

    for (const { left, right } of comparablePairs) {
      try {
        const pairwiseFinding = analyzeTextSimilarity(
          left.content.plainText,
          right.content.plainText,
          left.submission.id,
          right.submission.id,
          params.requestedAssignmentId,
        );
        internalFindings.push(pairwiseFinding);
      } catch (error) {
        logError("internal_similarity_pair_failed", error, {
          assignmentId: params.requestedAssignmentId,
          leftSubmissionId: left.submission.id,
          rightSubmissionId: right.submission.id,
        });
        params.warnings.push("A pairwise internal similarity comparison failed and was skipped.");
      }
    }

    logInfo("internal_similarity_completed", {
      assignmentId: params.requestedAssignmentId,
      submissionCount: params.comparisonSubmissions.length,
      comparableSubmissionCount: comparableSubmissions.length,
      pairCount: comparablePairs.length,
      findingCount: internalFindings.length,
    });
  }

  if (params.shouldRunMossProvider && params.shouldRunInternalProvider && params.requestedAssignmentId && params.comparisonSubmissions.length >= 2 && params.mossRunnerConfig) {
    const codeSourceCache = new Map<string, string | null>();
    const fetchCodeSubmissionSource = async (submission: InternalSimilaritySubmission) => {
      if (codeSourceCache.has(submission.id)) {
        return codeSourceCache.get(submission.id) ?? null;
      }

      const cachedContent = params.contentMap.get(submission.id);
      if (cachedContent?.success && !cachedContent.extractionError && cachedContent.plainText.trim()) {
        const sourceText = cachedContent.fullText?.trim() ? cachedContent.fullText : cachedContent.plainText;
        codeSourceCache.set(submission.id, sourceText);
        return sourceText;
      }

      const content = await sharedFetchFileContent(params.supabaseAdmin as never, submission);
      if (!content.success || content.extractionError || !content.plainText.trim()) {
        codeSourceCache.set(submission.id, null);
        return null;
      }

      const sourceText = content.fullText?.trim() ? content.fullText : content.plainText;
      codeSourceCache.set(submission.id, sourceText);
      return sourceText;
    };

    const providerSubmissions = params.comparisonSubmissions.map(toProviderSubmission);
    mossFindings.push(
      ...await runMossSimilarityComparisons({
        assignmentId: params.requestedAssignmentId,
        submissions: providerSubmissions,
        config: params.mossRunnerConfig,
        fetchCodeSubmissionSource,
        warnings: params.warnings,
      }),
    );
  }

  return { internalFindings, mossFindings };
}
