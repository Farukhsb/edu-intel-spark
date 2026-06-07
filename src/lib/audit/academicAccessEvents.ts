import { supabase } from "@/integrations/supabase/client";
import { log } from "@/lib/logger";
import type { Json, TablesInsert } from "@/integrations/supabase/types";

export type AcademicAccessEventType =
  | "submission_viewed"
  | "submission_file_opened"
  | "student_profile_viewed"
  | "integrity_evidence_viewed"
  | "moderation_evidence_viewed"
  | "grade_details_viewed";

type AcademicAccessEventInput = {
  actorId?: string | null;
  actorRole?: string | null;
  institutionId?: string | null;
  eventType: AcademicAccessEventType;
  resourceType: string;
  resourceId?: string | null;
  assignmentId?: string | null;
  submissionId?: string | null;
  moderationCaseId?: string | null;
  metadata?: Record<string, unknown>;
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

const sanitizeMetadata = (metadata?: Record<string, unknown>): Json => {
  if (!metadata) {
    return {};
  }

  const sanitized: Record<string, Json | undefined> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const normalized = toJsonValue(value);
    if (normalized !== undefined) {
      sanitized[key] = normalized;
    }
  }

  return sanitized;
};

export const logAcademicAccessEvent = async ({
  actorId,
  actorRole,
  institutionId,
  eventType,
  resourceType,
  resourceId,
  assignmentId,
  submissionId,
  moderationCaseId,
  metadata,
}: AcademicAccessEventInput) => {
  if (!actorId || !actorRole) {
    return;
  }

  const payload: TablesInsert<"academic_access_events"> = {
    actor_id: actorId,
    actor_role: actorRole,
    institution_id: institutionId ?? null,
    event_type: eventType,
    resource_type: resourceType,
    resource_id: resourceId ?? null,
    assignment_id: assignmentId ?? null,
    submission_id: submissionId ?? null,
    moderation_case_id: moderationCaseId ?? null,
    metadata: sanitizeMetadata(metadata),
  };

  try {
    if (typeof (supabase as { from?: unknown }).from !== "function") {
      return;
    }

    const table = supabase.from("academic_access_events");
    if (!table || typeof (table as { insert?: unknown }).insert !== "function") {
      return;
    }

    const { error } = await table.insert(payload);
    if (!error) {
      return;
    }

    log.warn("Failed to record academic access event", {
      eventType,
      resourceType,
      resourceId,
      submissionId,
      moderationCaseId,
      assignmentId,
      actorRole,
    });
  } catch (error) {
    log.warn("Failed to record academic access event", {
      eventType,
      resourceType,
      resourceId,
      submissionId,
      moderationCaseId,
      assignmentId,
      actorRole,
      error,
    });
  }
};
