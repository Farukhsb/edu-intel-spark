import { supabase } from "@/integrations/supabase/client";
import { getE2EAuthenticatedUserId } from "@/lib/e2eAuth";
import { log } from "@/lib/logger";

export type CommunicationCategory =
  | "feedback-summary"
  | "at-risk-alert"
  | "grade-released"
  | "intervention-follow-up"
  | "submission-received"
  | "ai-grading-ready"
  | "integrity-check-ready";

export interface CommunicationMessage {
  id: string;
  createdAt: string;
  read: boolean;
  category: CommunicationCategory;
  recipientName: string;
  recipientEmail: string | null;
  recipientId?: string;
  subject: string;
  body: string;
  relatedStudentId?: string;
  relatedAssignmentId?: string;
}

export type DraftCommunicationMessage = Omit<CommunicationMessage, "id" | "createdAt" | "read">;

interface CommunicationMessageRow {
  id: string;
  created_at: string;
  read: boolean | null;
  category: CommunicationCategory;
  recipient_name: string;
  recipient_email: string | null;
  recipient_id: string | null;
  subject: string;
  body: string;
  related_student_id: string | null;
  related_assignment_id: string | null;
}

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const COMMUNICATION_MESSAGE_SELECT =
  "id, created_at, read, category, recipient_name, recipient_email, recipient_id, subject, body, related_student_id, related_assignment_id";

const LEGACY_COMMUNICATION_MESSAGE_SELECT =
  "id, created_at, category, recipient_name, recipient_email, recipient_id, subject, body, related_student_id, related_assignment_id";

const toSafeSupabaseErrorContext = (error: SupabaseLikeError | null | undefined) => ({
  errorCode: error?.code ?? null,
  errorMessage: error?.message ?? null,
  errorDetails: error?.details ?? null,
  errorHint: error?.hint ?? null,
});

const isMissingReadColumnError = (error: SupabaseLikeError | null | undefined) => {
  const text = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return error?.code === "42703" && text.includes("read");
};

const normalizeMessage = (message: CommunicationMessageRow): CommunicationMessage => ({
  id: message.id,
  createdAt: message.created_at,
  read: Boolean(message.read),
  category: message.category,
  recipientName: message.recipient_name,
  recipientEmail: message.recipient_email,
  recipientId: message.recipient_id || undefined,
  subject: message.subject,
  body: message.body,
  relatedStudentId: message.related_student_id || undefined,
  relatedAssignmentId: message.related_assignment_id || undefined,
});

const normalizeLegacyMessage = (
  message: Omit<CommunicationMessageRow, "read">,
): CommunicationMessage => ({
  id: message.id,
  createdAt: message.created_at,
  read: false,
  category: message.category,
  recipientName: message.recipient_name,
  recipientEmail: message.recipient_email,
  recipientId: message.recipient_id || undefined,
  subject: message.subject,
  body: message.body,
  relatedStudentId: message.related_student_id || undefined,
  relatedAssignmentId: message.related_assignment_id || undefined,
});

export const queueCommunicationMessage = async (
  message: DraftCommunicationMessage
) => {
  const e2eUserId = getE2EAuthenticatedUserId();
  const userId =
    e2eUserId ??
    (
      await supabase.auth.getUser()
    ).data.user?.id ??
    null;

  if (!userId) {
    return null;
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

  if (isMissingReadColumnError(error)) {
    log.warn("Communication messages read column missing; retrying legacy notification insert", {
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

    if (!legacyResult.error && legacyResult.data) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("gradeai:communications-updated"));
      }

      return normalizeLegacyMessage(
        legacyResult.data as Omit<CommunicationMessageRow, "read">,
      );
    }

    log.error("Failed to save communication message after legacy retry", legacyResult.error, {
      category: message.category,
      recipientId: message.recipientId ?? null,
      hasRecipientEmail: Boolean(message.recipientEmail),
      relatedAssignmentId: message.relatedAssignmentId ?? null,
      relatedStudentId: message.relatedStudentId ?? null,
      ...toSafeSupabaseErrorContext(legacyResult.error),
    });
    return null;
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
    return null;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gradeai:communications-updated"));
  }

  return normalizeMessage(data as CommunicationMessageRow);
};

export const markCommunicationMessageRead = async (id: string) => {
  return updateCommunicationMessageReadState(id, true);
};

export const markCommunicationMessageUnread = async (id: string) => {
  return updateCommunicationMessageReadState(id, false);
};

const updateCommunicationMessageReadState = async (id: string, read: boolean) => {
  const { data, error } = await supabase
    .from("communication_messages")
    .update({ read })
    .eq("id", id)
    .select(COMMUNICATION_MESSAGE_SELECT)
    .single();

  if (error || !data) {
    log.error("Failed to update communication message read state", error, {
      communicationMessageId: id,
      read,
      ...toSafeSupabaseErrorContext(error),
    });
    return null;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gradeai:communications-updated"));
  }

  return normalizeMessage(data as CommunicationMessageRow);
};

export const buildSubmissionReceivedNotification = (input: {
  lecturerId: string;
  assignmentId: string;
  assignmentTitle: string;
  studentName: string;
}): DraftCommunicationMessage => ({
  category: "submission-received",
  recipientName: "Lecturer",
  recipientEmail: null,
  recipientId: input.lecturerId,
  subject: "New submission received",
  body: `${input.studentName} submitted ${input.assignmentTitle}`,
  relatedAssignmentId: input.assignmentId,
});

export const buildAIGradingReadyNotification = (input: {
  lecturerId: string;
  assignmentId: string;
  assignmentTitle: string;
}): DraftCommunicationMessage => ({
  category: "ai-grading-ready",
  recipientName: "Lecturer",
  recipientEmail: null,
  recipientId: input.lecturerId,
  subject: "AI grading ready",
  body: `AI grading is ready for ${input.assignmentTitle}`,
  relatedAssignmentId: input.assignmentId,
});

export const buildIntegrityCheckReadyNotification = (input: {
  lecturerId: string;
  assignmentId: string;
  assignmentTitle: string;
}): DraftCommunicationMessage => ({
  category: "integrity-check-ready",
  recipientName: "Lecturer",
  recipientEmail: null,
  recipientId: input.lecturerId,
  subject: "Integrity check ready",
  body: `Integrity review is ready for ${input.assignmentTitle}`,
  relatedAssignmentId: input.assignmentId,
});

export const buildGradeReleasedNotification = (input: {
  studentName: string;
  studentEmail: string | null;
  studentId?: string;
  assignmentId: string;
  assignmentTitle: string;
}): DraftCommunicationMessage => ({
  category: "grade-released",
  recipientName: input.studentName,
  recipientEmail: input.studentEmail,
  recipientId: input.studentId,
  subject: "Feedback released",
  body: `Your feedback for ${input.assignmentTitle} is now available`,
  relatedAssignmentId: input.assignmentId,
  relatedStudentId: input.studentId,
});

export const getVisibleCommunicationMessages = (
  messages: CommunicationMessage[],
  options: {
    userId?: string | null;
    email?: string | null;
    fullName?: string | null;
  }
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
    if (
      options.userId &&
      [message.recipientId, message.relatedStudentId].some((value) => value && value === options.userId)
    ) {
      return true;
    }

    if (
      normalizedEmail &&
      [message.recipientEmail, message.recipientId, message.relatedStudentId].some(
        (value) => value?.trim().toLowerCase() === normalizedEmail
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
  const { data, error } = await supabase
    .from("communication_messages")
    .select(COMMUNICATION_MESSAGE_SELECT)
    .order("created_at", { ascending: false })
    .limit(50);

  if (isMissingReadColumnError(error)) {
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
      (((legacyResult.data || []) as Array<Omit<CommunicationMessageRow, "read">>).map(
        normalizeLegacyMessage,
      )),
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
    ((data || []) as CommunicationMessageRow[]).map(normalizeMessage),
    options
  ).slice(0, 6);
};
