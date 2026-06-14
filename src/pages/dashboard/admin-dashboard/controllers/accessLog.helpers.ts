export type AdminAuditAccessSourceRow = {
  id: string;
  created_at: string;
  action_type: string;
  actor_role: string | null;
  target_user_name: string | null;
  target_user_email: string | null;
  details: unknown;
};

export type WorkflowAuditAccessSourceRow = {
  id: string;
  created_at: string;
  event_type: string;
  submission_id: string | null;
  moderation_case_id: string | null;
  reason: string | null;
};

export type AcademicAccessSourceRow = {
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

export const getAccessLogActorName = (actorRole: string | null, details: Record<string, unknown>) =>
  typeof details.actor_name === "string" && details.actor_name.trim().length > 0
    ? details.actor_name
    : actorRole === "admin"
      ? "Admin"
      : "System";

export const getAccessLogRoleChangeSummary = (details: Record<string, unknown>) => {
  const previousRole =
    typeof details.previous_role === "string" && details.previous_role.trim().length > 0
      ? details.previous_role
      : null;
  const updatedRole =
    typeof details.updated_role === "string" && details.updated_role.trim().length > 0
      ? details.updated_role
      : null;

  return { previousRole, updatedRole };
};

export const getAccessLogMetadataSummary = (metadata: unknown, humanizeToken: (value: string) => string) => {
  const normalized = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  return Object.entries(normalized)
    .map(([key, value]) => `${humanizeToken(key)}: ${String(value)}`)
    .slice(0, 3)
    .join(" | ");
};
