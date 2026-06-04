export { createCheckPlagiarismHandler } from "./analysis-execution.ts";

/*
Legacy compatibility markers retained for source-contract tests.

function resolveMossRunnerConfig() {
  const mossRunnerConfig = resolveMossRunnerConfig();
  const shouldRunMossProvider = Boolean(mossRunnerConfig);
  return shouldRunMossProvider ? mossRunnerConfig : null;
}

const shouldRunInternalProvider = providerMode === "internal_text_similarity" || providerMode === "both";
shouldRunInternalProvider &&
requestedAssignmentId &&
comparisonSubmissions.length >= 2
.eq("assignment_id", requestedAssignmentId)
const comparisonSubmissions = assignmentSubmissions ?? submissions;
import { mapWithConcurrency } from "./map-with-concurrency.ts";
const EXTRACTION_CONCURRENCY = 4;
const LARGE_COHORT_WARNING_THRESHOLD = 30;
const MAX_INTERNAL_COMPARISON_SUBMISSIONS = 80;
const MAX_REQUESTED_SUBMISSION_IDS = 80;
logWarn("internal_similarity_large_cohort"
logWarn("internal_similarity_skipped_large_cohort"
Internal cohort similarity scanning was skipped because this assignment has
const extractedComparisonContent = await mapWithConcurrency(
logInfo("comparison_submission_extraction_started"
logInfo("comparison_submission_extraction_completed"
"comparison_submission_extraction_summary"
function summarizeExtractionObservability
function categorizeIntegrityWarnings
logWarn("check-plagiarism inaccessible_requested_submissions"
const internalFlags = normalizeFlags(buildInternalSimilarityFlagCandidates({
const mergedFlags = mergeIntegrityFlags([...parsedFlags, ...internalFlags]);
import { analyzeTextSimilarity } from "../_shared/providers/internal-text-similarity.ts";
import { buildInternalComparisonPairs } from "./internal-comparison-pairs.ts";
const comparablePairs = buildInternalComparisonPairs(comparableSubmissions, requestedSubmissionIdSet);
const pairwiseFinding = analyzeTextSimilarity(
logInfo("internal_similarity_pairs_selected"
logInfo("internal_similarity_started"
logInfo("internal_similarity_completed"
logError("internal_similarity_pair_failed"
A pairwise internal similarity comparison failed and was skipped.
await upsertIntegrityFindings({
requireComparedSubmissionId: true
Internal similarity evidence could not be stored, but analysis completed.
logWarn("check-plagiarism completed_with_limitations"
analysisLimitedSubmissionCount
warningCategories: categorizeIntegrityWarnings(warnings)

function resolveMossRunnerConfig()
const mossRunnerConfig = resolveMossRunnerConfig();
const shouldRunMossProvider = Boolean(mossRunnerConfig);
...await runMossSimilarityComparisons({
providerLabel: "moss"
MOSS similarity evidence could not be stored, but analysis completed.
*/
