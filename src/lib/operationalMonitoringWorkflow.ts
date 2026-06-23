import type {
  OperationalAlertCard,
  OperationalFailureCard,
  OperationalHealthItem,
  OperationalMonitoringWorkflowRunLike,
} from "@/lib/operationalMonitoringTypes";
import { collapseWorkflowRunPairs, isOlderThanDays } from "@/lib/operationalMonitoringShared";

export const buildWorkflowMonitoringSignals = ({
  workflowRunTelemetryAvailable,
  workflowRunRows,
  latestGradeRun,
  aiGradingFailures,
  now,
}: {
  workflowRunTelemetryAvailable: boolean;
  workflowRunRows: OperationalMonitoringWorkflowRunLike[];
  latestGradeRun: string | null;
  aiGradingFailures: number | null;
  now: number;
}) => {
  const workflowRows = collapseWorkflowRunPairs(workflowRunRows);
  const workflowRunCounts = workflowRows.reduce(
    (counts, row) => {
      if (row.status === "running") {
        counts.running += 1;
      } else if (row.status === "failed") {
        counts.failed += 1;
      } else {
        counts.succeeded += 1;
      }

      return counts;
    },
    {
      running: 0,
      failed: 0,
      succeeded: 0,
    },
  );
  const latestWorkflowRun = workflowRows[0] ?? null;
  const staleWorkflowRun = latestWorkflowRun
    ? isOlderThanDays(latestWorkflowRun.finishedAt ?? latestWorkflowRun.startedAt, 1, now)
    : false;
  const latestWorkflowRunPassText =
    latestWorkflowRun?.gradingPassCount != null
      ? ` across ${latestWorkflowRun.gradingPassCount} grading pass${latestWorkflowRun.gradingPassCount === 1 ? "" : "es"}`
      : "";
  const latestWorkflowRunRetryText = latestWorkflowRun?.providerRetryCount
    ? ` with ${latestWorkflowRun.providerRetryCount} provider retry attempt${latestWorkflowRun.providerRetryCount === 1 ? "" : "s"}`
    : "";
  const latestGradeWorkflowRun = workflowRows.find((row) => row.workflowName === "grade-submission") ?? null;
  const staleGradingHeartbeat =
    workflowRunTelemetryAvailable && latestGradeWorkflowRun
      ? isOlderThanDays(latestGradeWorkflowRun.finishedAt ?? latestGradeWorkflowRun.startedAt, 1, now)
      : workflowRunTelemetryAvailable;
  const failedProviderCallCount = workflowRows.filter(
    (row) => row.workflowName === "grade-submission" && row.status === "failed",
  ).length;

  const healthItems: OperationalHealthItem[] = [
    {
      label: "AI grading workflow signal",
      statusLabel: workflowRunTelemetryAvailable
        ? workflowRunCounts.failed > 0
          ? `${workflowRunCounts.failed} failed run${workflowRunCounts.failed === 1 ? "" : "s"}`
          : workflowRunCounts.running > 0
            ? `${workflowRunCounts.running} running`
            : workflowRunCounts.succeeded > 0
              ? `${workflowRunCounts.succeeded} succeeded`
              : "No runs today"
        : "No provider telemetry",
      tone: workflowRunTelemetryAvailable
        ? workflowRunCounts.failed > 0 || (latestWorkflowRun ? latestWorkflowRun.status === "running" && staleWorkflowRun : false)
          ? "warning"
          : "healthy"
        : "placeholder",
      signalType: workflowRunTelemetryAvailable ? "live" : "placeholder",
      detail: workflowRunTelemetryAvailable
        ? latestWorkflowRun
          ? latestWorkflowRun.status === "failed"
            ? `Latest ${latestWorkflowRun.workflowName} run failed on ${latestWorkflowRun.provider}${latestWorkflowRun.model ? ` / ${latestWorkflowRun.model}` : ""}${latestWorkflowRun.durationMs != null ? ` after ${(latestWorkflowRun.durationMs / 1000).toFixed(1)}s` : ""}${latestWorkflowRunPassText}${latestWorkflowRunRetryText}${latestWorkflowRun.failureCategory ? `. Failure category: ${latestWorkflowRun.failureCategory}.` : "."}`
            : latestWorkflowRun.status === "running"
              ? `Latest ${latestWorkflowRun.workflowName} run is still running on ${latestWorkflowRun.provider}${latestWorkflowRun.model ? ` / ${latestWorkflowRun.model}` : ""}${latestWorkflowRun.startedAt ? `; started at ${latestWorkflowRun.startedAt}.` : "."}`
              : `Latest ${latestWorkflowRun.workflowName} run succeeded on ${latestWorkflowRun.provider}${latestWorkflowRun.model ? ` / ${latestWorkflowRun.model}` : ""}${latestWorkflowRun.durationMs != null ? ` in ${(latestWorkflowRun.durationMs / 1000).toFixed(1)}s` : ""}${latestWorkflowRunPassText}${latestWorkflowRunRetryText}.`
          : "Workflow run telemetry is visible, but no run records were captured for the current window."
        : "Workflow run telemetry is not yet exposed here, so this remains a placeholder signal.",
    },
    {
      label: "Latest visible workflow activity",
      statusLabel: latestGradeRun ? "Recorded" : "Not exposed",
      tone: latestGradeRun ? (isOlderThanDays(latestGradeRun, 1, now) ? "warning" : "healthy") : "placeholder",
      signalType: latestGradeRun ? "inferred" : "placeholder",
      detail: latestGradeRun
        ? staleGradingHeartbeat
          ? "A dedicated workflow-run telemetry record would make stale workflow signals easier to classify with confidence."
          : "Latest grade creation timestamp is being used as an inferred workflow activity signal."
        : "A dedicated workflow-run telemetry record would make this signal more reliable.",
    },
    {
      label: "Visible workflow failures today",
      statusLabel: aiGradingFailures == null ? "Pending telemetry" : String(aiGradingFailures),
      tone: aiGradingFailures == null ? "placeholder" : aiGradingFailures > 0 ? "warning" : "healthy",
      signalType: aiGradingFailures == null ? "placeholder" : "live",
      detail:
        aiGradingFailures == null
          ? "Workflow error telemetry is not readable in this snapshot, so a direct failure count is unavailable."
          : aiGradingFailures > 0
            ? `${aiGradingFailures} workflow failure event(s) were recorded today.`
            : "No workflow failure events were recorded today.",
    },
  ];

  const failureCards: OperationalFailureCard[] = [
    {
      title: "Workflow failures today",
      value: aiGradingFailures == null ? "Pending telemetry" : String(aiGradingFailures),
      tone: aiGradingFailures == null ? "placeholder" : aiGradingFailures > 0 ? "warning" : "healthy",
      signalType: aiGradingFailures == null ? "placeholder" : "live",
      detail:
        aiGradingFailures == null
          ? "Direct workflow error telemetry could not be read for this admin snapshot."
          : aiGradingFailures > 0
            ? "Recorded workflow failures need triage before more lecturer retries stack up."
            : "No workflow failure events were recorded in the current daily window.",
      action: "Check workflow error events and the grade-submission function logs.",
    },
  ];

  const alertCards: OperationalAlertCard[] = [
    {
      title: "Stale workflow heartbeat",
      value: staleGradingHeartbeat ? "1" : "0",
      threshold: "No grade-submission run within 24 hours",
      tone: workflowRunTelemetryAvailable ? (staleGradingHeartbeat ? "warning" : "healthy") : "placeholder",
      signalType: workflowRunTelemetryAvailable ? "live" : "placeholder",
      detail: workflowRunTelemetryAvailable
        ? staleGradingHeartbeat
          ? "The latest visible grade-submission run is older than the 24 hour threshold, so the workflow pipeline should be checked."
          : "At least one grade-submission run has been observed within the last 24 hours."
        : "Workflow run telemetry is not yet available here, so the stale-run threshold cannot be evaluated.",
      action: "Inspect the latest grade-submission runs and confirm the provider is still processing work.",
    },
    {
      title: "Failed provider calls",
      value: String(failedProviderCallCount),
      threshold: "Any failed grade-submission run today",
      tone: workflowRunTelemetryAvailable ? (failedProviderCallCount > 0 ? "warning" : "healthy") : "placeholder",
      signalType: workflowRunTelemetryAvailable ? "live" : "placeholder",
      detail: workflowRunTelemetryAvailable
        ? failedProviderCallCount > 0
          ? `${failedProviderCallCount} grade-submission provider call(s) failed in the current window.`
          : "No failed grade-submission provider calls were recorded in the current window."
        : "Provider-call telemetry is unavailable, so this threshold is not yet live.",
      action: "Review provider logs and retry policy for grade-submission failures.",
    },
  ];

  return { healthItems, failureCards, alertCards };
};
