import { supabase } from "@/integrations/supabase/client";
import type { DraftCommunicationMessage } from "@/lib/communicationsHelpers";
import {
  COMMUNICATION_MESSAGE_CLEARED_ONLY_SELECT,
  COMMUNICATION_MESSAGE_READ_ONLY_SELECT,
  COMMUNICATION_MESSAGE_SELECT,
  CommunicationMessageClearedOnlyRowSchema,
  CommunicationMessageLegacyRowSchema,
  CommunicationMessageReadOnlyRowSchema,
  CommunicationMessageRowSchema,
  LEGACY_COMMUNICATION_MESSAGE_SELECT,
  getNotificationStateColumnAvailability,
  isMissingNotificationStateColumnError,
  normalizeClearedOnlyMessage,
  normalizeLegacyMessage,
  normalizeMessage,
  normalizeReadOnlyMessage,
  parseCommunicationMessageRows,
  type CommunicationMessageClearedOnlyRow,
  type CommunicationMessageLegacyRow,
  type CommunicationMessageReadOnlyRow,
  type CommunicationMessageRow,
} from "@/lib/communicationsHelpers";

export const emitCommunicationsUpdated = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gradeai:communications-updated"));
  }
};

export type ExistingCommunicationMessageResult =
  | { mode: "full"; data: CommunicationMessageRow[]; error: unknown }
  | { mode: "cleared-only"; data: CommunicationMessageClearedOnlyRow[]; error: unknown }
  | { mode: "read-only"; data: CommunicationMessageReadOnlyRow[]; error: unknown }
  | { mode: "legacy"; data: CommunicationMessageLegacyRow[]; error: unknown };

export const findExistingCommunicationMessage = async (
  message: DraftCommunicationMessage,
): Promise<ExistingCommunicationMessageResult> => {
  const recipientId = message.recipientId ?? null;
  const recipientEmail = message.recipientEmail ?? null;
  const relatedAssignmentId = message.relatedAssignmentId ?? null;
  const relatedStudentId = message.relatedStudentId ?? null;

  const fetchWithSelect = async (selectClause: string) => {
    let query = supabase
      .from("communication_messages")
      .select(selectClause)
      .eq("category", message.category)
      .eq("subject", message.subject)
      .eq("body", message.body);

    if (recipientId) {
      query = query.eq("recipient_id", recipientId);
    } else {
      query = query.is("recipient_id", null);
    }

    if (recipientEmail) {
      query = query.eq("recipient_email", recipientEmail);
    } else {
      query = query.is("recipient_email", null);
    }

    if (relatedAssignmentId) {
      query = query.eq("related_assignment_id", relatedAssignmentId);
    } else {
      query = query.is("related_assignment_id", null);
    }

    if (relatedStudentId) {
      query = query.eq("related_student_id", relatedStudentId);
    } else {
      query = query.is("related_student_id", null);
    }

    return query.limit(10);
  };

  const { data, error } = await fetchWithSelect(COMMUNICATION_MESSAGE_SELECT);

  if (isMissingNotificationStateColumnError(error)) {
    const { missingRead, missingCleared } = getNotificationStateColumnAvailability(error);

    if (missingRead && !missingCleared) {
      const fallbackResult = await fetchWithSelect(COMMUNICATION_MESSAGE_CLEARED_ONLY_SELECT);
      return {
        data: parseCommunicationMessageRows(fallbackResult.data, CommunicationMessageClearedOnlyRowSchema),
        error: fallbackResult.error,
        mode: "cleared-only" as const,
      };
    }

    if (missingCleared && !missingRead) {
      const fallbackResult = await fetchWithSelect(COMMUNICATION_MESSAGE_READ_ONLY_SELECT);
      return {
        data: parseCommunicationMessageRows(fallbackResult.data, CommunicationMessageReadOnlyRowSchema),
        error: fallbackResult.error,
        mode: "read-only" as const,
      };
    }

    const fallbackResult = await fetchWithSelect(LEGACY_COMMUNICATION_MESSAGE_SELECT);
    return {
      data: parseCommunicationMessageRows(fallbackResult.data, CommunicationMessageLegacyRowSchema),
      error: fallbackResult.error,
      mode: "legacy" as const,
    };
  }

  return {
    data: parseCommunicationMessageRows(data, CommunicationMessageRowSchema),
    error,
    mode: "full" as const,
  };
};

export const normalizeExistingMessages = (result: Awaited<ReturnType<typeof findExistingCommunicationMessage>>) => {
  if (result.mode === "full") {
    return result.data.map((item) => normalizeMessage(item));
  }

  if (result.mode === "cleared-only") {
    return result.data.map((item) => normalizeClearedOnlyMessage(item));
  }

  if (result.mode === "read-only") {
    return result.data.map((item) => normalizeReadOnlyMessage(item));
  }

  return result.data.map((item) => normalizeLegacyMessage(item));
};
