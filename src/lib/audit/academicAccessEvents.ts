import { supabase } from "@/integrations/supabase/client";
import { log } from "@/lib/logger";
import type { TablesInsert } from "@/integrations/supabase/types";

export type AcademicAccessEventType =
  | "submission_viewed"
  | "submission_file_opened"
  | "integrity_evidence_viewed"
  | "moderation_evidence_viewed"
  | "grade_details_viewed";

type AcademicAccessEventInput = {
  actorId?: string | null;
  actorRole?: string | null;
  eventType: AcademicAccessEventType;
  resourceType: string;
  resourceId?: string | null;
  assignmentId?: string | null;
  submissionId?: string | null;
  moderationCaseId?: string | null;
  metadata?: Record<string, unknown>;
};

const sanitizeMetadata = (metadata?: Record<string, unknown>) => {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );
};

export const logAcademicAccessEvent = async ({
  actorId,
  actorRole,
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
