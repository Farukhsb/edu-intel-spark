import type { AdminDataAccessLogRow } from "../types";
import { humanizeToken } from "../utils";

type AdminAuditAccessSourceRow = {
  id: string;
  created_at: string;
  action_type: string;
  actor_role: string | null;
  target_user_name: string | null;
  target_user_email: string | null;
  details: unknown;
};

type WorkflowAuditAccessSourceRow = {
  id: string;
  created_at: string;
  event_type: string;
  submission_id: string | null;
  moderation_case_id: string | null;
  reason: string | null;
};

type AcademicAccessSourceRow = {
  id: string;
  created_at: string;
  actor_id: string;
  actor_role: string;
  event_type: string;
  resource_type: string;
  resource_id: string | null;
  assignment_id: string | null;
  submission_id: string | null;
  moderation_case_id: string | null;
  metadata: unknown;
};

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
    const actorName =
      typeof details.actor_name === "string" && details.actor_name.trim().length > 0
        ? details.actor_name
        : row.actor_role === "admin"
          ? "Admin"
          : "System";
    const previousRole =
      typeof details.previous_role === "string" && details.previous_role.trim().length > 0
        ? details.previous_role
        : null;
    const updatedRole =
      typeof details.updated_role === "string" && details.updated_role.trim().length > 0
        ? details.updated_role
        : null;

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

  const academicRows = academicAccessEvents.map((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
    const metadataSummary = Object.entries(metadata)
      .map(([key, value]) => `${humanizeToken(key)}: ${String(value)}`)
      .slice(0, 3)
      .join(" | ");

    return {
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
      details: metadataSummary || "Academic evidence access recorded.",
      source: "academic-access" as const,
    };
  });

  return [...academicRows, ...adminRows, ...workflowRows].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
};
