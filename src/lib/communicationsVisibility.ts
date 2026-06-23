import { supabase } from "@/integrations/supabase/client";
import { log } from "@/lib/logger";
import {
  COMMUNICATION_MESSAGE_CLEARED_ONLY_SELECT,
  COMMUNICATION_MESSAGE_READ_ONLY_SELECT,
  COMMUNICATION_MESSAGE_SELECT,
  CommunicationMessageClearedOnlyRowSchema,
  CommunicationMessageLegacyRowSchema,
  CommunicationMessageReadOnlyRowSchema,
  CommunicationMessageRowSchema,
  getNotificationStateColumnAvailability,
  isMissingNotificationStateColumnError,
  normalizeClearedOnlyMessage,
  normalizeLegacyMessage,
  normalizeMessage,
  normalizeReadOnlyMessage,
  parseCommunicationMessageRows,
  toSafeSupabaseErrorContext,
  LEGACY_COMMUNICATION_MESSAGE_SELECT,
  type CommunicationMessage,
} from "@/lib/communicationsHelpers";

export const getVisibleCommunicationMessages = (
  messages: CommunicationMessage[],
  options: {
    userId?: string | null;
    email?: string | null;
    fullName?: string | null;
  },
) => {
  const normalizedEmail = options.email?.trim().toLowerCase() ?? null;
  const normalizedName = options.fullName?.trim().toLowerCase() ?? null;
  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return messages.filter((message) => {
    if (message.cleared) {
      return false;
    }

    if (
      options.userId &&
      [message.recipientId, message.relatedStudentId].some((value) => value && value === options.userId)
    ) {
      return true;
    }

    if (
      normalizedEmail &&
      [message.recipientEmail, message.recipientId, message.relatedStudentId].some(
        (value) => value?.trim().toLowerCase() === normalizedEmail,
      )
    ) {
      return true;
    }

    if (
      normalizedName &&
      [message.recipientName, message.recipientId, message.relatedStudentId].some((value) => {
        if (!value) return false;
        const candidate = value.trim().toLowerCase();
        return candidate === normalizedName || slugify(candidate) === slugify(normalizedName);
      })
    ) {
      return true;
    }

    return false;
  });
};

export const loadVisibleCommunicationMessages = async (options: {
  userId?: string | null;
  email?: string | null;
  fullName?: string | null;
}) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return [];
  }

  const { data, error } = await supabase
    .from("communication_messages")
    .select(COMMUNICATION_MESSAGE_SELECT)
    .order("created_at", { ascending: false })
    .limit(50);

  if (isMissingNotificationStateColumnError(error)) {
    const { missingRead, missingCleared } = getNotificationStateColumnAvailability(error);

    if (missingRead && !missingCleared) {
      const clearedOnlyResult = await supabase
        .from("communication_messages")
        .select(COMMUNICATION_MESSAGE_CLEARED_ONLY_SELECT)
        .order("created_at", { ascending: false })
        .limit(50);

      if (clearedOnlyResult.error) {
        log.error("Failed to load communication messages after cleared-only retry", clearedOnlyResult.error, {
          ...toSafeSupabaseErrorContext(clearedOnlyResult.error),
        });
        return [];
      }

      return getVisibleCommunicationMessages(
        parseCommunicationMessageRows(clearedOnlyResult.data, CommunicationMessageClearedOnlyRowSchema).map(
          normalizeClearedOnlyMessage,
        ),
        options,
      ).slice(0, 6);
    }

    if (missingCleared && !missingRead) {
      const readOnlyResult = await supabase
        .from("communication_messages")
        .select(COMMUNICATION_MESSAGE_READ_ONLY_SELECT)
        .order("created_at", { ascending: false })
        .limit(50);

      if (readOnlyResult.error) {
        log.error("Failed to load communication messages after read-only retry", readOnlyResult.error, {
          ...toSafeSupabaseErrorContext(readOnlyResult.error),
        });
        return [];
      }

      return getVisibleCommunicationMessages(
        parseCommunicationMessageRows(readOnlyResult.data, CommunicationMessageReadOnlyRowSchema).map(
          normalizeReadOnlyMessage,
        ),
        options,
      ).slice(0, 6);
    }

    const legacyResult = await supabase
      .from("communication_messages")
      .select(LEGACY_COMMUNICATION_MESSAGE_SELECT)
      .order("created_at", { ascending: false })
      .limit(50);

    if (legacyResult.error) {
      log.error("Failed to load communication messages after legacy retry", legacyResult.error, {
        ...toSafeSupabaseErrorContext(legacyResult.error),
      });
      return [];
    }

    return getVisibleCommunicationMessages(
      parseCommunicationMessageRows(legacyResult.data, CommunicationMessageLegacyRowSchema).map(normalizeLegacyMessage),
      options,
    ).slice(0, 6);
  }

  if (error) {
    log.error("Failed to load communication messages", error, {
      ...toSafeSupabaseErrorContext(error),
    });
    return [];
  }

  return getVisibleCommunicationMessages(
    parseCommunicationMessageRows(data, CommunicationMessageRowSchema).map(normalizeMessage),
    options,
  ).slice(0, 6);
};
