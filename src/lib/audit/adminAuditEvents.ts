import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import { log } from "@/lib/logger";

type AdminAuditEventInput = {
  actorId?: string | null;
  actorRole?: string | null;
  institutionId?: string | null;
  actionType: string;
  targetUserId?: string | null;
  targetUserName?: string | null;
  targetUserEmail?: string | null;
  details?: Record<string, unknown>;
};

const toJsonValue = (value: unknown): Json | undefined => {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => toJsonValue(item))
      .filter((item): item is Json => item !== undefined);
  }
  if (typeof value === "object") {
    const nested: Record<string, Json | undefined> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      const normalized = toJsonValue(nestedValue);
      if (normalized !== undefined) {
        nested[key] = normalized;
      }
    }
    return nested;
  }

  return String(value);
};

const sanitizeDetails = (details?: Record<string, unknown>): Json => {
  if (!details) {
    return {};
  }

  const sanitized: Record<string, Json | undefined> = {};
  for (const [key, value] of Object.entries(details)) {
    const normalized = toJsonValue(value);
    if (normalized !== undefined) {
      sanitized[key] = normalized;
    }
  }

  return sanitized;
};

export const logAdminAuditEvent = async ({
  actorId,
  actorRole,
  institutionId,
  actionType,
  targetUserId,
  targetUserName,
  targetUserEmail,
  details,
}: AdminAuditEventInput) => {
  if (!actorId || !actorRole) {
    return;
  }

  const payload: TablesInsert<"admin_audit_log"> = {
    actor_id: actorId,
    actor_role: actorRole,
    institution_id: institutionId ?? null,
    action_type: actionType,
    target_user_id: targetUserId ?? null,
    target_user_name: targetUserName ?? null,
    target_user_email: targetUserEmail ?? null,
    details: sanitizeDetails(details),
  };

  try {
    if (typeof (supabase as { from?: unknown }).from !== "function") {
      return;
    }

    const table = supabase.from("admin_audit_log");
    if (!table || typeof (table as { insert?: unknown }).insert !== "function") {
      return;
    }

    const { error } = await table.insert(payload);
    if (!error) {
      return;
    }

    log.warn("Failed to record admin audit event", {
      actionType,
      targetUserId,
      actorRole,
    });
  } catch (error) {
    log.warn("Failed to record admin audit event", {
      actionType,
      targetUserId,
      actorRole,
      error,
    });
  }
};
