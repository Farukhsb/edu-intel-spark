import { getE2EAuthenticatedUserId } from "@/lib/e2eAuth";
import { log } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import {
  COMMUNICATION_MESSAGE_SELECT,
  CommunicationMessageLegacyRowSchema,
  CommunicationMessageRowSchema,
  DraftCommunicationMessage,
  LEGACY_COMMUNICATION_MESSAGE_SELECT,
  type CommunicationDispatchResult,
  normalizeLegacyMessage,
  normalizeMessage,
} from "@/lib/communicationsHelpers";
import { buildCommunicationMessageFingerprint } from "@/lib/communicationsFingerprint";
import {
  emitCommunicationsUpdated,
  findExistingCommunicationMessage,
  normalizeExistingMessages,
} from "@/lib/communicationsMessageShared";
import { isMissingNotificationStateColumnError, toSafeSupabaseErrorContext } from "@/lib/communicationsHelpers";

export const dispatchCommunicationMessage = async (
  message: DraftCommunicationMessage,
): Promise<CommunicationDispatchResult> => {
  const e2eUserId = getE2EAuthenticatedUserId();
  const userId = e2eUserId ?? (await supabase.auth.getUser()).data.user?.id ?? null;

  if (!userId) {
    return {
      ok: false,
      status: "unauthenticated",
      message: null,
    };
  }

  const fingerprint = buildCommunicationMessageFingerprint(message);
  const existingResult = await findExistingCommunicationMessage(message);

  if (!existingResult.error && existingResult.data.length > 0) {
    const normalizedExistingMessages = normalizeExistingMessages(existingResult);
    const matched = normalizedExistingMessages.find(
      (existingMessage) => buildCommunicationMessageFingerprint(existingMessage) === fingerprint,
    );

    if (matched) {
      return {
        ok: true,
        status: "duplicate",
        message: matched,
      };
    }
  }

  const { data, error } = await supabase
    .from("communication_messages")
    .insert({
      sender_id: userId,
      category: message.category,
      recipient_name: message.recipientName,
      recipient_email: message.recipientEmail,
      recipient_id: message.recipientId ?? null,
      subject: message.subject,
      body: message.body,
      related_student_id: message.relatedStudentId ?? null,
      related_assignment_id: message.relatedAssignmentId ?? null,
    })
    .select(COMMUNICATION_MESSAGE_SELECT)
    .single();

  if (isMissingNotificationStateColumnError(error)) {
    log.warn("Communication messages state columns missing; retrying legacy notification insert", {
      category: message.category,
      recipientId: message.recipientId ?? null,
      ...toSafeSupabaseErrorContext(error),
    });

    const legacyResult = await supabase
      .from("communication_messages")
      .insert({
        sender_id: userId,
        category: message.category,
        recipient_name: message.recipientName,
        recipient_email: message.recipientEmail,
        recipient_id: message.recipientId ?? null,
        subject: message.subject,
        body: message.body,
        related_student_id: message.relatedStudentId ?? null,
        related_assignment_id: message.relatedAssignmentId ?? null,
      })
      .select(LEGACY_COMMUNICATION_MESSAGE_SELECT)
      .single();

    const parsedLegacyMessage = CommunicationMessageLegacyRowSchema.safeParse(legacyResult.data);
    if (!legacyResult.error && parsedLegacyMessage.success) {
      emitCommunicationsUpdated();

      return {
        ok: true,
        status: "created",
        message: normalizeLegacyMessage(parsedLegacyMessage.data),
      };
    }

    log.error("Failed to save communication message after legacy retry", legacyResult.error, {
      category: message.category,
      recipientId: message.recipientId ?? null,
      hasRecipientEmail: Boolean(message.recipientEmail),
      relatedAssignmentId: message.relatedAssignmentId ?? null,
      relatedStudentId: message.relatedStudentId ?? null,
      ...toSafeSupabaseErrorContext(legacyResult.error),
    });
    return {
      ok: false,
      status: "failed",
      message: null,
    };
  }

  if (error || !data) {
    log.error("Failed to save communication message", error, {
      category: message.category,
      recipientId: message.recipientId ?? null,
      hasRecipientEmail: Boolean(message.recipientEmail),
      relatedAssignmentId: message.relatedAssignmentId ?? null,
      relatedStudentId: message.relatedStudentId ?? null,
      ...toSafeSupabaseErrorContext(error),
    });
    return {
      ok: false,
      status: "failed",
      message: null,
    };
  }

  const parsedInsertedMessage = CommunicationMessageRowSchema.safeParse(data);

  if (!parsedInsertedMessage.success) {
    log.error("Communication message insert returned an unexpected row shape", parsedInsertedMessage.error, {
      category: message.category,
      recipientId: message.recipientId ?? null,
      hasRecipientEmail: Boolean(message.recipientEmail),
      relatedAssignmentId: message.relatedAssignmentId ?? null,
      relatedStudentId: message.relatedStudentId ?? null,
    });
    return {
      ok: false,
      status: "failed",
      message: null,
    };
  }

  emitCommunicationsUpdated();

  return {
    ok: true,
    status: "created",
    message: normalizeMessage(parsedInsertedMessage.data),
  };
};

export const queueCommunicationMessage = async (message: DraftCommunicationMessage) => {
  const result = await dispatchCommunicationMessage(message);
  return result.message;
};
