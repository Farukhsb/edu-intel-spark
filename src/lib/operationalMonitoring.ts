export interface OperationalMonitoringModerationLike {
  status: string;
  createdAt: string;
  updatedAt: string;
  integrityRiskScore: number | null;
}

export interface OperationalMonitoringSubmissionLike {
  status: string;
}

export interface OperationalMonitoringWorkflowRunLike {
  id: string;
  status: "failed" | "running" | "succeeded";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  workflowName: string;
  provider: string;
  model: string | null;
  providerRetryCount: number;
  gradingPassCount: number | null;
  failureCategory: string | null;
  details?: Record<string, unknown> | null;
}

export interface OperationalMonitoringNotificationLike {
  deliveryStatus: string;
  createdAt: string;
  sentAt: string | null;
  lastError: string | null;
}

export interface OperationalHealthItem {
  label: string;
  statusLabel: string;
  tone: "healthy" | "warning" | "placeholder";
  detail: string;
  signalType: "live" | "inferred" | "placeholder";
}

export interface OperationalFailureCard {
  title: string;
  value: string;
  tone: "healthy" | "warning" | "placeholder";
  detail: string;
  action: string;
  signalType: "live" | "inferred" | "placeholder";
}

export interface OperationalAlertCard {
  title: string;
  value: string;
  threshold: string;
  tone: "healthy" | "warning" | "placeholder";
  detail: string;
  action: string;
  signalType: "live" | "inferred" | "placeholder";
}

export interface OperationalMonitoringSnapshot {
  healthItems: OperationalHealthItem[];
  failureCards: OperationalFailureCard[];
  alertCards: OperationalAlertCard[];
}

const DAY_MS = 1000 * 60 * 60 * 24;

const isOlderThanDays = (value: string | null | undefined, days: number, now: number) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  return now - timestamp > days * DAY_MS;
};

const getParentWorkflowRunId = (row: OperationalMonitoringWorkflowRunLike) => {
  const parentId = row.details?.parent_workflow_run_id;
  return typeof parentId === "string" && parentId.trim() ? parentId : null;
};

const isTerminalWorkflowRun = (row: OperationalMonitoringWorkflowRunLike) => row.status !== "running";

const collapseWorkflowRunPairs = (rows: OperationalMonitoringWorkflowRunLike[]) => {
  const terminalParentIds = new Set(
    rows
      .filter((row) => isTerminalWorkflowRun(row))
      .map((row) => getParentWorkflowRunId(row))
      .filter((parentId): parentId is string => Boolean(parentId)),
  );

  return rows.filter((row) => !terminalParentIds.has(row.id) || isTerminalWorkflowRun(row));
};

export const buildOperationalMonitoringSnapshot = ({
  workflowRunTelemetryAvailable,
  workflowRunRows,
  latestGradeRun,
  aiGradingFailures,
  moderationRows,
  submissions,
  workflowNotificationTelemetryAvailable,
  workflowNotificationRows,
  now = Date.now(),
}: {
  workflowRunTelemetryAvailable: boolean;
  workflowRunRows: OperationalMonitoringWorkflowRunLike[];
  latestGradeRun: string | null;
  aiGradingFailures: number | null;
  moderationRows: OperationalMonitoringModerationLike[];
  submissions: OperationalMonitoringSubmissionLike[];
  workflowNotificationTelemetryAvailable: boolean;
  workflowNotificationRows: OperationalMonitoringNotificationLike[];
  now?: number;
}): OperationalMonitoringSnapshot => {
  const workflowRows = collapseWorkflowRunPairs(workflowRunRows);
  const overdueModerationCount = moderationRows.filter((row) => {
    if (row.status === "moderated" || row.status === "resolved" || row.status === "released") {
      return false;
    }

    return isOlderThanDays(row.createdAt || row.updatedAt, 7, now);
  }).length;

  const releaseBacklogCount = submissions.filter((row) => row.status === "approved").length;
  const escalatedIntegrityCount = moderationRows.filter(
    (row) => row.status === "escalated" || (row.integrityRiskScore ?? 0) >= 70,
  ).length;
  const staleGradingRun = latestGradeRun ? isOlderThanDays(latestGradeRun, 1, now) : false;
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
  const latestWorkflowRunPassText = latestWorkflowRun?.gradingPassCount != null
    ? ` across ${latestWorkflowRun.gradingPassCount} grading pass${latestWorkflowRun.gradingPassCount === 1 ? "" : "es"}`
    : "";
  const latestWorkflowRunRetryText = latestWorkflowRun?.providerRetryCount
    ? ` with ${latestWorkflowRun.providerRetryCount} provider retry attempt${latestWorkflowRun.providerRetryCount === 1 ? "" : "s"}`
    : "";
  const workflowNotificationCounts = workflowNotificationRows.reduce(
    (counts, row) => {
      if (row.deliveryStatus === "sent") {
        counts.sent += 1;
      } else if (row.deliveryStatus === "failed") {
        counts.failed += 1;
      } else {
        counts.pending += 1;
      }

      return counts;
    },
    {
      sent: 0,
      failed: 0,
      pending: 0,
    },
  );
  const workflowNotificationActivity = workflowNotificationRows[0] ?? null;
  const latestGradeWorkflowRun = workflowRows.find((row) => row.workflowName === "grade-submission") ?? null;
  const staleGradingHeartbeat =
    workflowRunTelemetryAvailable && latestGradeWorkflowRun
      ? isOlderThanDays(latestGradeWorkflowRun.finishedAt ?? latestGradeWorkflowRun.startedAt, 1, now)
      : workflowRunTelemetryAvailable;
  const failedProviderCallCount = workflowRows.filter(
    (row) => row.workflowName === "grade-submission" && row.status === "failed",
  ).length;
  const failedEmailDeliveryCount = workflowNotificationRows.filter((row) => row.deliveryStatus === "failed").length;

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
      label: "Integrity workflow signal",
      statusLabel: moderationRows.length > 0 ? "Observed cases" : "No recent cases",
      tone: moderationRows.length > 0 ? (escalatedIntegrityCount > 0 ? "warning" : "healthy") : "placeholder",
      signalType: moderationRows.length > 0 ? "inferred" : "placeholder",
      detail:
        moderationRows.length > 0
          ? `${escalatedIntegrityCount} elevated integrity case(s) are currently visible to admin. This reflects observed case data, not a provider heartbeat.`
          : "No integrity or moderation case is currently visible in this snapshot, so provider health cannot be inferred from this page.",
    },
    {
      label: "Dashboard database read",
      statusLabel: "Read snapshot succeeded",
      tone: "healthy",
      signalType: "live",
      detail:
        "Profiles, assignments, submissions, and moderation tables loaded for this page refresh. This confirms dashboard reads, not full database health.",
    },
    {
      label: "Workflow notification delivery",
      statusLabel: workflowNotificationTelemetryAvailable
        ? workflowNotificationCounts.failed > 0
          ? `${workflowNotificationCounts.failed} failed`
          : workflowNotificationCounts.pending > 0
            ? `${workflowNotificationCounts.pending} pending`
            : `${workflowNotificationCounts.sent} sent`
        : "No provider telemetry",
      tone: workflowNotificationTelemetryAvailable
        ? workflowNotificationCounts.failed > 0
          ? "warning"
          : "healthy"
        : "placeholder",
      signalType: workflowNotificationTelemetryAvailable ? "live" : "placeholder",
      detail: workflowNotificationTelemetryAvailable
        ? workflowNotificationCounts.failed > 0
          ? `${workflowNotificationCounts.failed} failed delivery attempt(s), ${workflowNotificationCounts.pending} pending record(s), and ${workflowNotificationCounts.sent} sent record(s) are visible in the workflow notification log.`
          : workflowNotificationCounts.pending > 0
            ? `${workflowNotificationCounts.pending} workflow notification record(s) are still pending and ${workflowNotificationCounts.sent} have been sent.`
            : `${workflowNotificationCounts.sent} workflow notification record(s) are visible in the log${workflowNotificationActivity?.sentAt ? `, with the latest send at ${workflowNotificationActivity.sentAt}.` : "."}`
        : "Workflow notification delivery records are not yet exposed here, so this remains a placeholder signal.",
    },
    {
      label: "Latest visible workflow activity",
      statusLabel: latestGradeRun ? "Recorded" : "Not exposed",
      tone: latestGradeRun ? (staleGradingRun ? "warning" : "healthy") : "placeholder",
      signalType: latestGradeRun ? "inferred" : "placeholder",
      detail: latestGradeRun
        ? staleGradingRun
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
    {
      title: "Release backlog",
      value: String(releaseBacklogCount),
      tone: releaseBacklogCount > 0 ? "warning" : "healthy",
      signalType: "live",
      detail:
        releaseBacklogCount > 0
          ? `${releaseBacklogCount} approved submission(s) have not yet been released to students.`
          : "No approved submissions are currently waiting for release.",
      action: "Review lecturer release queues and confirm the expected student-facing timing.",
    },
    {
      title: "Overdue moderation",
      value: String(overdueModerationCount),
      tone: overdueModerationCount > 0 ? "warning" : "healthy",
      signalType: "live",
      detail:
        overdueModerationCount > 0
          ? `${overdueModerationCount} open moderation case(s) have been waiting for more than seven days.`
          : "No open moderation case is currently older than seven days.",
      action: "Escalate ageing moderation cases before release timing drifts further.",
    },
    {
      title: "Integrity escalations",
      value: String(escalatedIntegrityCount),
      tone: escalatedIntegrityCount > 0 ? "warning" : "healthy",
      signalType: "live",
      detail:
        escalatedIntegrityCount > 0
          ? `${escalatedIntegrityCount} moderation case(s) are escalated or already above the high-risk integrity threshold.`
          : "No escalated or high-risk integrity cases are currently visible.",
      action: "Prioritise the integrity queue and confirm owners are assigned.",
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
    {
      title: "Email delivery failures",
      value: String(failedEmailDeliveryCount),
      threshold: "Any failed workflow notification today",
      tone: workflowNotificationTelemetryAvailable
        ? failedEmailDeliveryCount > 0
          ? "warning"
          : "healthy"
        : "placeholder",
      signalType: workflowNotificationTelemetryAvailable ? "live" : "placeholder",
      detail: workflowNotificationTelemetryAvailable
        ? failedEmailDeliveryCount > 0
          ? `${failedEmailDeliveryCount} workflow notification delivery failure(s) were recorded today.`
          : "No workflow notification delivery failures were recorded today."
        : "Notification delivery telemetry is unavailable, so this threshold is not yet live.",
      action: "Check notification provider status and recent delivery attempts.",
    },
    {
      title: "Moderation backlog threshold",
      value: String(overdueModerationCount),
      threshold: "Any moderation case open more than 7 days",
      tone: overdueModerationCount > 0 ? "warning" : "healthy",
      signalType: "live",
      detail:
        overdueModerationCount > 0
          ? `${overdueModerationCount} moderation case(s) have crossed the seven day queue threshold.`
          : "No moderation case has crossed the seven day queue threshold.",
      action: "Escalate ageing moderation cases before release timing drifts further.",
    },
  ];

  return {
    healthItems,
    failureCards,
    alertCards,
  };
};
