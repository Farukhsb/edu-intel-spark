export type AssignmentPublishTargetingStatus = "ready" | "missing" | "lookup_failed";
export type AssignmentPublishRecipientStatus = "loaded" | "no_recipients" | "failed" | "skipped";
export type AssignmentPublishBellStatus = "sent" | "failed" | "skipped";
export type AssignmentPublishEmailStatus = "sent" | "duplicate" | "failed" | "invalid" | "skipped";

export interface AssignmentPublishWorkflowSummary {
  targetingStatus: AssignmentPublishTargetingStatus;
  recipientStatus: AssignmentPublishRecipientStatus;
  bellStatus: AssignmentPublishBellStatus;
  emailStatus: AssignmentPublishEmailStatus;
}

export const summarizeAssignmentPublishWorkflow = (
  summary: AssignmentPublishWorkflowSummary,
) => {
  const warnings: string[] = [];

  if (summary.targetingStatus === "lookup_failed") {
    warnings.push("Publish targeting could not be fully verified");
  } else if (summary.targetingStatus === "missing") {
    warnings.push("No target cohorts or departments were stored, so student notifications were skipped");
  }

  if (summary.recipientStatus === "failed") {
    warnings.push("Student recipients could not be loaded for in-app notifications");
  } else if (summary.recipientStatus === "no_recipients") {
    warnings.push("No matching students were found for in-app publish notifications");
  }

  if (summary.bellStatus === "failed") {
    warnings.push("In-app student notifications were not saved");
  }

  if (summary.emailStatus === "failed" || summary.emailStatus === "invalid") {
    warnings.push("Publish email notifications were not sent");
  }

  return {
    ok: warnings.length === 0,
    warnings,
  };
};
