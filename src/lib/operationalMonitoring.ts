export interface OperationalMonitoringModerationLike {
  status: string;
  createdAt: string;
  updatedAt: string;
  integrityRiskScore: number | null;
}

export interface OperationalMonitoringSubmissionLike {
  status: string;
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

export interface OperationalMonitoringSnapshot {
  healthItems: OperationalHealthItem[];
  failureCards: OperationalFailureCard[];
}

const DAY_MS = 1000 * 60 * 60 * 24;

const isOlderThanDays = (value: string | null | undefined, days: number, now: number) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  return now - timestamp > days * DAY_MS;
};

export const buildOperationalMonitoringSnapshot = ({
  latestGradeRun,
  aiGradingFailures,
  moderationRows,
  submissions,
  emailNotificationsVisible,
  emailNotificationsCount,
  now = Date.now(),
}: {
  latestGradeRun: string | null;
  aiGradingFailures: number | null;
  moderationRows: OperationalMonitoringModerationLike[];
  submissions: OperationalMonitoringSubmissionLike[];
  emailNotificationsVisible: boolean;
  emailNotificationsCount: number;
  now?: number;
}): OperationalMonitoringSnapshot => {
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

  const healthItems: OperationalHealthItem[] = [
    {
      label: "AI grading workflow signal",
      statusLabel: latestGradeRun ? (staleGradingRun ? "Signal is stale" : "Recent workflow activity") : "No provider telemetry",
      tone: latestGradeRun ? (staleGradingRun ? "warning" : "healthy") : "placeholder",
      signalType: latestGradeRun ? "inferred" : "placeholder",
      detail: latestGradeRun
        ? staleGradingRun
          ? "A grade row exists, but the latest visible grading activity is more than 24 hours old. Treat this as a stale signal, not a confirmed outage."
          : "Latest grading evidence is recent enough to suggest the grading workflow is still active. This remains an observed workflow signal, not a provider heartbeat."
        : "Admin can see platform workflow, but direct grading-run telemetry is not yet exposed here.",
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
      label: "Notification records",
      statusLabel: emailNotificationsVisible ? "Records visible" : "No provider telemetry",
      tone: emailNotificationsVisible ? "healthy" : "placeholder",
      signalType: emailNotificationsVisible ? "live" : "placeholder",
      detail: emailNotificationsVisible
        ? `${emailNotificationsCount} recent notification record(s) are visible from the communication log. This confirms records exist, not that delivery is enabled.`
        : "Notification enablement and delivery health are not yet directly observable from the admin dashboard.",
    },
    {
      label: "Latest visible grading activity",
      statusLabel: latestGradeRun ? "Recorded" : "Not exposed",
      tone: latestGradeRun ? (staleGradingRun ? "warning" : "healthy") : "placeholder",
      signalType: latestGradeRun ? "inferred" : "placeholder",
      detail: latestGradeRun
        ? staleGradingRun
          ? "A dedicated grading-run telemetry record would make stale grading signals easier to classify with confidence."
          : "Latest grade creation timestamp is being used as an inferred grading activity signal."
        : "A dedicated grading-run telemetry record would make this signal more reliable.",
    },
    {
      label: "Visible grading failures today",
      statusLabel: aiGradingFailures == null ? "Pending telemetry" : String(aiGradingFailures),
      tone: aiGradingFailures == null ? "placeholder" : aiGradingFailures > 0 ? "warning" : "healthy",
      signalType: aiGradingFailures == null ? "placeholder" : "live",
      detail:
        aiGradingFailures == null
          ? "Grading error telemetry is not readable in this snapshot, so a direct failure count is unavailable."
          : aiGradingFailures > 0
            ? `${aiGradingFailures} grading failure event(s) were recorded today.`
            : "No grading failure events were recorded today.",
    },
  ];

  const failureCards: OperationalFailureCard[] = [
    {
      title: "Grading failures today",
      value: aiGradingFailures == null ? "Pending telemetry" : String(aiGradingFailures),
      tone: aiGradingFailures == null ? "placeholder" : aiGradingFailures > 0 ? "warning" : "healthy",
      signalType: aiGradingFailures == null ? "placeholder" : "live",
      detail:
        aiGradingFailures == null
          ? "Direct grading error telemetry could not be read for this admin snapshot."
          : aiGradingFailures > 0
            ? "Recorded grading failures need triage before more lecturer retries stack up."
            : "No grading failure events were recorded in the current daily window.",
      action: "Check grading error events and the grade-submission function logs.",
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

  return {
    healthItems,
    failureCards,
  };
};
