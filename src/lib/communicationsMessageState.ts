import { log } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import {
  COMMUNICATION_MESSAGE_CLEARED_ONLY_SELECT,
  COMMUNICATION_MESSAGE_READ_ONLY_SELECT,
  COMMUNICATION_MESSAGE_SELECT,
  CommunicationMessageClearedOnlyRowSchema,
  CommunicationMessageReadOnlyRowSchema,
  CommunicationMessageRowSchema,
  getNotificationStateColumnAvailability,
  isMissingNotificationStateColumnError,
  normalizeClearedOnlyMessage,
  normalizeMessage,
  normalizeReadOnlyMessage,
  toSafeSupabaseErrorContext,
} from "@/lib/communicationsHelpers";
import { emitCommunicationsUpdated } from "@/lib/communicationsMessageShared";

const updateCommunicationMessageReadState = async (id: string, read: boolean) => {
  const { data, error } = await supabase
    .from("communication_messages")
    .update({ read })
    .eq("id", id)
    .select(COMMUNICATION_MESSAGE_SELECT)
    .single();

  if (isMissingNotificationStateColumnError(error)) {
    const { missingRead, missingCleared } = getNotificationStateColumnAvailability(error);

    if (missingCleared && !missingRead) {
      const fallbackResult = await supabase
        .from("communication_messages")
        .update({ read })
        .eq("id", id)
        .select(COMMUNICATION_MESSAGE_READ_ONLY_SELECT)
        .single();

      if (!fallbackResult.error && fallbackResult.data) {
        emitCommunicationsUpdated();

        const parsedRow = CommunicationMessageReadOnlyRowSchema.safeParse(fallbackResult.data);
        return parsedRow.success ? normalizeReadOnlyMessage(parsedRow.data) : null;
      }

      log.error("Failed to update communication message read state after compatibility retry", fallbackResult.error, {
        communicationMessageId: id,
        read,
        ...toSafeSupabaseErrorContext(fallbackResult.error),
      });
      return null;
    }
  }

  if (error || !data) {
    log.error("Failed to update communication message read state", error, {
      communicationMessageId: id,
      read,
      ...toSafeSupabaseErrorContext(error),
    });
    return null;
  }

  emitCommunicationsUpdated();

  const parsedRow = CommunicationMessageRowSchema.safeParse(data);
  return parsedRow.success ? normalizeMessage(parsedRow.data) : null;
};

export const markCommunicationMessageRead = async (id: string) => {
  return updateCommunicationMessageReadState(id, true);
};

export const clearCommunicationMessage = async (id: string) => {
  const { data, error } = await supabase
    .from("communication_messages")
    .update({ cleared: true })
    .eq("id", id)
    .select(COMMUNICATION_MESSAGE_SELECT)
    .single();

  if (isMissingNotificationStateColumnError(error)) {
    const { missingRead, missingCleared } = getNotificationStateColumnAvailability(error);

    if (missingRead && !missingCleared) {
      const fallbackResult = await supabase
        .from("communication_messages")
        .update({ cleared: true })
        .eq("id", id)
        .select(COMMUNICATION_MESSAGE_CLEARED_ONLY_SELECT)
        .single();

      if (!fallbackResult.error && fallbackResult.data) {
        emitCommunicationsUpdated();

        const parsedRow = CommunicationMessageClearedOnlyRowSchema.safeParse(fallbackResult.data);
        return parsedRow.success ? normalizeClearedOnlyMessage(parsedRow.data) : null;
      }

      log.error("Failed to clear communication message after compatibility retry", fallbackResult.error, {
        communicationMessageId: id,
        ...toSafeSupabaseErrorContext(fallbackResult.error),
      });
      return null;
    }
  }

  if (error || !data) {
    log.error("Failed to clear communication message", error, {
      communicationMessageId: id,
      ...toSafeSupabaseErrorContext(error),
    });
    return null;
  }

  emitCommunicationsUpdated();

  const parsedRow = CommunicationMessageRowSchema.safeParse(data);
  return parsedRow.success ? normalizeMessage(parsedRow.data) : null;
};
