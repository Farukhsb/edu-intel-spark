import type { InterventionEntry, StudentInterventionReadiness } from "@/lib/interventionsTypes";

export const isInterventionOverdue = (
  intervention: Pick<InterventionEntry, "status" | "followUpDate">,
  now = Date.now(),
) => {
  if (!["planned", "in_progress"].includes(intervention.status) || !intervention.followUpDate) {
    return false;
  }

  return new Date(intervention.followUpDate).getTime() < now;
};

export const getStudentInterventionReadiness = ({
  riskLevel,
  recommendation,
  missedAssignmentsCount,
  openInterventions,
  overdueInterventions,
  latestIntervention,
}: {
  riskLevel: string | null | undefined;
  recommendation: string;
  missedAssignmentsCount: number;
  openInterventions: number;
  overdueInterventions: number;
  latestIntervention: InterventionEntry | null;
}): StudentInterventionReadiness => {
  const urgentRisk = riskLevel === "critical" || riskLevel === "high";
  const pendingFollowUp =
    latestIntervention?.status === "planned" || latestIntervention?.status === "in_progress";

  return {
    postureLabel:
      overdueInterventions > 0
        ? "Follow-up overdue position"
        : urgentRisk && openInterventions === 0
          ? "Immediate intervention position"
          : pendingFollowUp || missedAssignmentsCount > 0
            ? "Active follow-up position"
            : "Stabilisation position",
    likelyChallenge:
      overdueInterventions > 0
        ? `${overdueInterventions} intervention follow-up date${overdueInterventions === 1 ? " is" : "s are"} overdue`
        : missedAssignmentsCount > 0
          ? `${missedAssignmentsCount} missed assignment${missedAssignmentsCount === 1 ? "" : "s"} still unresolved`
          : latestIntervention?.note || recommendation,
    bestNextAction:
      overdueInterventions > 0
        ? "Review overdue interventions, confirm progress, and either resolve or reschedule them"
        : openInterventions === 0
          ? "Log the first intervention and send a student support alert"
          : pendingFollowUp
            ? "Review the latest intervention and confirm follow-up progress"
            : "Close resolved actions or schedule the next support check-in",
  };
};
