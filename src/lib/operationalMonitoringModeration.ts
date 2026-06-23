import type {
  OperationalAlertCard,
  OperationalFailureCard,
  OperationalHealthItem,
  OperationalMonitoringModerationLike,
  OperationalMonitoringSubmissionLike,
} from "@/lib/operationalMonitoringTypes";
import { isOlderThanDays } from "@/lib/operationalMonitoringShared";

export const buildModerationMonitoringSignals = ({
  moderationRows,
  submissions,
  now,
}: {
  moderationRows: OperationalMonitoringModerationLike[];
  submissions: OperationalMonitoringSubmissionLike[];
  now: number;
}) => {
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

  const healthItems: OperationalHealthItem[] = [
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
  ];

  const failureCards: OperationalFailureCard[] = [
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

  return { healthItems, failureCards, alertCards };
};
