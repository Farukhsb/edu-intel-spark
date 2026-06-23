import type {
  OperationalAlertCard,
  OperationalFailureCard,
  OperationalHealthItem,
  OperationalMonitoringNotificationLike,
} from "@/lib/operationalMonitoringTypes";

export const buildNotificationMonitoringSignals = ({
  workflowNotificationTelemetryAvailable,
  workflowNotificationRows,
}: {
  workflowNotificationTelemetryAvailable: boolean;
  workflowNotificationRows: OperationalMonitoringNotificationLike[];
}) => {
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

  const healthItems: OperationalHealthItem[] = [
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
  ];

  const failureCards: OperationalFailureCard[] = [
    {
      title: "Email delivery failures",
      value: String(workflowNotificationCounts.failed),
      tone: workflowNotificationCounts.failed > 0 ? "warning" : "healthy",
      signalType: workflowNotificationTelemetryAvailable ? "live" : "placeholder",
      detail:
        workflowNotificationTelemetryAvailable
          ? workflowNotificationCounts.failed > 0
            ? `${workflowNotificationCounts.failed} workflow notification delivery failure(s) were recorded today.`
            : "No workflow notification delivery failures were recorded today."
          : "Notification delivery telemetry is unavailable, so this threshold is not yet live.",
      action: "Check notification provider status and recent delivery attempts.",
    },
  ];

  const alertCards: OperationalAlertCard[] = [
    {
      title: "Email delivery failures",
      value: String(workflowNotificationCounts.failed),
      threshold: "Any failed workflow notification today",
      tone: workflowNotificationTelemetryAvailable
        ? workflowNotificationCounts.failed > 0
          ? "warning"
          : "healthy"
        : "placeholder",
      signalType: workflowNotificationTelemetryAvailable ? "live" : "placeholder",
      detail: workflowNotificationTelemetryAvailable
        ? workflowNotificationCounts.failed > 0
          ? `${workflowNotificationCounts.failed} workflow notification delivery failure(s) were recorded today.`
          : "No workflow notification delivery failures were recorded today."
        : "Notification delivery telemetry is unavailable, so this threshold is not yet live.",
      action: "Check notification provider status and recent delivery attempts.",
    },
  ];

  return { healthItems, failureCards, alertCards };
};
