import type { createAdminClient, requireLecturer } from "../_shared/auth.ts";
import { logError } from "../_shared/log.ts";
import { buildInternalSimilarityFlagCandidates } from "../_shared/internal-similarity-flags.ts";
import type { InternalSimilaritySubmission } from "../_shared/integrity-provider-runners.ts";
import { prepareCheckPlagiarismRun } from "./request-stage.ts";
import { createIntegrityResponseWithRetry as sharedCreateIntegrityResponseWithRetry } from "./response.ts";
import { normalizeFlags as sharedNormalizeFlags, mergeIntegrityFlags as sharedMergeIntegrityFlags } from "./flags.ts";
import { finalizeCheckPlagiarismRun } from "./persistence-stage.ts";
import { runLegacyIntegrityAnalysis } from "./legacy-analysis.ts";
import { runProviderIntegrityAnalysis } from "./provider-analysis.ts";

type CheckPlagiarismHandlerDeps = {
  createAdminClient: typeof createAdminClient;
  requireLecturer: typeof requireLecturer;
  jsonError: (error: unknown, corsHeaders: Record<string, string>) => Response;
  getCorsHeaders: (req: Request) => Record<string, string> | null;
  createCorsForbiddenResponse: () => Response;
  createIntegrityResponseWithRetry?: (body: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
};

export function createCheckPlagiarismHandler(deps: CheckPlagiarismHandlerDeps) {
  const requestIntegrityResponse = deps.createIntegrityResponseWithRetry ?? sharedCreateIntegrityResponseWithRetry;

  return async (req: Request) => {
    const corsHeaders = deps.getCorsHeaders(req);
    if (!corsHeaders) return deps.createCorsForbiddenResponse();
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      const prepared = await prepareCheckPlagiarismRun(req, deps, corsHeaders);
      if (prepared instanceof Response) return prepared;

      const {
        startedAt,
        supabaseAdmin,
        user,
        assignment,
        requestedAssignmentId,
        requestedSubmissionIdSet,
        submissions,
        comparisonSubmissions,
        warnings,
        contentMap,
        processedContentMap,
        profileMap,
        gradeMap,
        submissionIdsByStudent,
        integrityModel,
        shouldRunLegacy,
        shouldRunInternalProvider,
        shouldRunMossProvider,
        mossRunnerConfig,
        shouldSkipInternalSimilarityForCohortSize,
      } = prepared;

      const legacyResult = shouldRunLegacy
        ? await runLegacyIntegrityAnalysis({
            isSingleMode: prepared.isSingleMode,
            assignmentTitle: assignment.title,
            submissions,
            contentMap,
            processedContentMap,
            integrityModel,
            requestIntegrityResponse,
            warnings,
          })
        : { parsedFlags: [], summary: "Analysis complete" };

      const providerResult =
        shouldRunInternalProvider || shouldRunMossProvider
          ? await runProviderIntegrityAnalysis({
              shouldRunInternalProvider,
              shouldRunMossProvider,
              shouldSkipInternalSimilarityForCohortSize,
              requestedAssignmentId,
              comparisonSubmissions,
              requestedSubmissionIdSet,
              contentMap,
              supabaseAdmin,
              mossRunnerConfig,
              warnings,
            })
          : { internalFindings: [], mossFindings: [] };

      const providerFindings = [...providerResult.internalFindings, ...providerResult.mossFindings];
      const internalFlags = sharedNormalizeFlags(
        buildInternalSimilarityFlagCandidates({
          findings: providerFindings,
          requestedSubmissionIds: requestedSubmissionIdSet,
          submissions: comparisonSubmissions as InternalSimilaritySubmission[],
        }),
        comparisonSubmissions,
        processedContentMap,
      );
      const mergedFlags = sharedMergeIntegrityFlags([...legacyResult.parsedFlags, ...internalFlags]);

      return finalizeCheckPlagiarismRun({
        supabaseAdmin,
        user,
        requestedAssignmentId,
        submissions,
        comparisonSubmissions,
        contentMap,
        processedContentMap,
        profileMap,
        gradeMap,
        submissionIdsByStudent,
        mergedFlags,
        internalFindings: providerResult.internalFindings,
        mossFindings: providerResult.mossFindings,
        warnings,
        startedAt,
        summary: legacyResult.summary,
        corsHeaders,
      });
    } catch (error) {
      logError("check-plagiarism error", error);
      return deps.jsonError(error, corsHeaders);
    }
  };
}
