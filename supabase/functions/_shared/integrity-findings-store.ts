import type { IntegrityProviderFinding } from "./integrity-provider.ts";
import { buildIntegrityFindingInsert } from "./integrity-provider.ts";
import { logError, logInfo } from "./log.ts";

const INTEGRITY_FINDINGS_CONFLICT_TARGET =
  "provider,assignment_id,submission_id,compared_submission_id";

type UpsertIntegrityFindingsParams = {
  supabaseAdmin: {
    from: (table: "integrity_findings") => {
      upsert: (
        values: ReturnType<typeof buildIntegrityFindingInsert>[],
        options: { onConflict: string },
      ) => Promise<{ error: unknown }>;
    };
  };
  assignmentId: string;
  findings: IntegrityProviderFinding[];
  providerLabel: string;
  startLogMessage: string;
  successLogMessage: string;
  errorLogMessage: string;
  warningMessage: string;
  warnings: string[];
  requireComparedSubmissionId?: boolean;
};

export async function upsertIntegrityFindings(params: UpsertIntegrityFindingsParams) {
  const {
    supabaseAdmin,
    assignmentId,
    findings,
    providerLabel,
    startLogMessage,
    successLogMessage,
    errorLogMessage,
    warningMessage,
    warnings,
    requireComparedSubmissionId = false,
  } = params;

  if (findings.length === 0) return;

  try {
    logInfo(startLogMessage, {
      assignmentId,
      provider: providerLabel,
      findingCount: findings.length,
    });

    const findingInserts = findings
      .filter((finding) =>
        Boolean(finding.assignment_id) &&
        Boolean(finding.submission_id) &&
        (!requireComparedSubmissionId || Boolean(finding.compared_submission_id)) &&
        Number.isFinite(Number(finding.similarity_score))
      )
      .map(buildIntegrityFindingInsert);

    if (findingInserts.length === 0) return;

    const { error } = await supabaseAdmin
      .from("integrity_findings")
      .upsert(findingInserts, {
        onConflict: INTEGRITY_FINDINGS_CONFLICT_TARGET,
      });

    if (error) {
      logError(errorLogMessage, error, {
        assignmentId,
        provider: providerLabel,
        findingCount: findingInserts.length,
      });
      warnings.push(warningMessage);
      return;
    }

    logInfo(successLogMessage, {
      assignmentId,
      provider: providerLabel,
      findingCount: findingInserts.length,
    });
  } catch (error) {
    logError(errorLogMessage, error, {
      assignmentId,
      provider: providerLabel,
      findingCount: findings.length,
    });
    warnings.push(warningMessage);
  }
}
