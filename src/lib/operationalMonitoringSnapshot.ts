import { buildModerationMonitoringSignals } from "@/lib/operationalMonitoringModeration";
import { buildNotificationMonitoringSignals } from "@/lib/operationalMonitoringNotifications";
import { buildWorkflowMonitoringSignals } from "@/lib/operationalMonitoringWorkflow";
import type {
  OperationalAlertCard,
  OperationalFailureCard,
  OperationalHealthItem,
  OperationalMonitoringModerationLike,
  OperationalMonitoringNotificationLike,
  OperationalMonitoringSnapshot,
  OperationalMonitoringSubmissionLike,
  OperationalMonitoringWorkflowRunLike,
} from "@/lib/operationalMonitoringTypes";

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
  const workflowSignals = buildWorkflowMonitoringSignals({
    workflowRunTelemetryAvailable,
    workflowRunRows,
    latestGradeRun,
    aiGradingFailures,
    now,
  });
  const moderationSignals = buildModerationMonitoringSignals({
    moderationRows,
    submissions,
    now,
  });
  const notificationSignals = buildNotificationMonitoringSignals({
    workflowNotificationTelemetryAvailable,
    workflowNotificationRows,
  });

  const healthItems: OperationalHealthItem[] = [
    ...workflowSignals.healthItems,
    ...moderationSignals.healthItems,
    ...notificationSignals.healthItems,
  ];

  const failureCards: OperationalFailureCard[] = [
    ...workflowSignals.failureCards,
    ...moderationSignals.failureCards,
    ...notificationSignals.failureCards,
  ];

  const alertCards: OperationalAlertCard[] = [
    ...workflowSignals.alertCards,
    ...moderationSignals.alertCards,
    ...notificationSignals.alertCards,
  ];

  return {
    healthItems,
    failureCards,
    alertCards,
  };
};
