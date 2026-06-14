import type { AdminDataAccessLogRow } from "../types";
import { humanizeToken } from "../utils";
import {
  getAccessLogActorName,
  getAccessLogMetadataSummary,
  getAccessLogRoleChangeSummary,
  type AcademicAccessSourceRow,
  type AdminAuditAccessSourceRow,
  type WorkflowAuditAccessSourceRow,
} from "./accessLog.helpers";

export const buildDataAccessLogRows = ({
  adminAuditRows,
  workflowAuditRows,
  academicAccessEvents,
  lecturerNameById,
}: {
  adminAuditRows: AdminAuditAccessSourceRow[];
  workflowAuditRows: WorkflowAuditAccessSourceRow[];
  academicAccessEvents: AcademicAccessSourceRow[];
  lecturerNameById: Map<string, string>;
}): AdminDataAccessLogRow[] => {
  const adminRows = adminAuditRows.map((row) => {
    const details =
      row.details && typeof row.details === "object" ? (row.details as Record<string, unknown>) : {};
    const actorName = getAccessLogActorName(row.actor_role, details);
    const { previousRole, updatedRole } = getAccessLogRoleChangeSummary(details);

    return {
      id: `admin-access-${row.id}`,
      timestamp: row.created_at,
      actor: actorName,
      actorRole: row.actor_role || "admin",
      action: humanizeToken(row.action_type),
      resourceType: row.target_user_name || row.target_user_email ? "User account" : "Admin event",
      resourceLabel: row.target_user_name || row.target_user_email || "Admin governance record",
      outcome: "Recorded",
      details:
        previousRole || updatedRole
          ? `${previousRole || "unknown"} -> ${updatedRole || "unknown"}${row.target_user_email ? ` | ${row.target_user_email}` : ""}`
          : "Using available admin audit events. Access-specific outcome fields are not yet recorded.",
      source: "admin" as const,
    };
  });

  const workflowRows = workflowAuditRows.map((row) => ({
    id: `workflow-access-${row.id}`,
    timestamp: row.created_at,
    actor: "Workflow",
    actorRole: "system",
    action: humanizeToken(String(row.event_type)),
    resourceType: row.moderation_case_id ? "Moderation case" : "Submission",
    resourceLabel: row.moderation_case_id || row.submission_id || "Workflow record",
    outcome: "Recorded",
    details: row.reason || "Using available workflow audit events.",
    source: "workflow" as const,
  }));

  const academicRows = academicAccessEvents.map((row) => ({
    id: `academic-access-${row.id}`,
    timestamp: row.created_at,
    actor: lecturerNameById.get(row.actor_id) || "Authenticated user",
    actorRole: row.actor_role,
    action: humanizeToken(row.event_type),
    resourceType: humanizeToken(row.resource_type),
    resourceLabel:
      row.moderation_case_id ||
      row.submission_id ||
      row.assignment_id ||
      row.resource_id ||
      "Academic evidence record",
    outcome: "Recorded",
    details: getAccessLogMetadataSummary(row.metadata, humanizeToken) || "Academic evidence access recorded.",
    source: "academic-access" as const,
  }));

  return [...academicRows, ...adminRows, ...workflowRows].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
};
