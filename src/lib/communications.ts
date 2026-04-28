import { supabase } from "@/integrations/supabase/client";
import { getE2EAuthenticatedUserId } from "@/lib/e2eAuth";
import { log } from "@/lib/logger";
import { z } from "zod";

export type CommunicationCategory =
  | "feedback-summary"
  | "at-risk-alert"
  | "grade-released"
  | "intervention-follow-up"
  | "submission-received"
  | "ai-grading-ready"
  | "integrity-check-ready"
  | "assignment-published";

export interface CommunicationMessage {
  id: string;
  createdAt: string;
  cleared: boolean;
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

export type DraftCommunicationMessage = Omit<
  CommunicationMessage,
  "id" | "createdAt" | "cleared" | "read"
>;

interface CommunicationMessageRow {
  id: string;
  created_at: string;
  cleared: boolean | null;
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

type CommunicationMessageLegacyRow = Omit<CommunicationMessageRow, "read" | "cleared">;
type CommunicationMessageClearedOnlyRow = Omit<CommunicationMessageRow, "read">;
type CommunicationMessageReadOnlyRow = Omit<CommunicationMessageRow, "cleared">;

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const COMMUNICATION_MESSAGE_SELECT =
  "id, created_at, cleared, read, category, recipient_name, recipient_email, recipient_id, subject, body, related_student_id, related_assignment_id";

const COMMUNICATION_MESSAGE_CLEARED_ONLY_SELECT =
  "id, created_at, cleared, category, recipient_name, recipient_email, recipient_id, subject, body, related_student_id, related_assignment_id";

const COMMUNICATION_MESSAGE_READ_ONLY_SELECT =
  "id, created_at, read, category, recipient_name, recipient_email, recipient_id, subject, body, related_student_id, related_assignment_id";

const LEGACY_COMMUNICATION_MESSAGE_SELECT =
  "id, created_at, category, recipient_name, recipient_email, recipient_id, subject, body, related_student_id, related_assignment_id";

const toSafeSupabaseErrorContext = (error: SupabaseLikeError | null | undefined) => ({
  errorCode: error?.code ?? null,
  errorMessage: error?.message ?? null,
  errorDetails: error?.details ?? null,
  errorHint: error?.hint ?? null,
});

const getNotificationStateColumnAvailability = (error: SupabaseLikeError | null | undefined) => {
  const text = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    missingRead: error?.code === "42703" && text.includes("read"),
    missingCleared: error?.code === "42703" && text.includes("cleared"),
  };
};

const isMissingNotificationStateColumnError = (error: SupabaseLikeError | null | undefined) => {
  const { missingRead, missingCleared } = getNotificationStateColumnAvailability(error);
  return missingRead || missingCleared;
};

const normalizeMessage = (message: CommunicationMessageRow): CommunicationMessage => ({
  id: message.id,
  createdAt: message.created_at,
  cleared: Boolean(message.cleared),
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
  message: CommunicationMessageLegacyRow,
): CommunicationMessage => ({
  id: message.id,
  createdAt: message.created_at,
  cleared: false,
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

const normalizeClearedOnlyMessage = (
  message: CommunicationMessageClearedOnlyRow,
): CommunicationMessage => ({
  id: message.id,
  createdAt: message.created_at,
  cleared: Boolean(message.cleared),
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

const normalizeReadOnlyMessage = (
  message: CommunicationMessageReadOnlyRow,
): CommunicationMessage => ({
  id: message.id,
  createdAt: message.created_at,
  cleared: false,
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

    if (!legacyResult.error && legacyResult.data) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("gradeai:communications-updated"));
      }

      return normalizeLegacyMessage(
        legacyResult.data as CommunicationMessageLegacyRow,
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
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("gradeai:communications-updated"));
        }

        return normalizeClearedOnlyMessage(
          fallbackResult.data as CommunicationMessageClearedOnlyRow,
        );
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

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gradeai:communications-updated"));
  }

  return normalizeMessage(data as CommunicationMessageRow);
};

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
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("gradeai:communications-updated"));
        }

        return normalizeReadOnlyMessage(
          fallbackResult.data as CommunicationMessageReadOnlyRow,
        );
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

export const buildAssignmentPublishedNotification = (input: {
  studentName: string;
  studentEmail: string | null;
  studentId?: string;
  assignmentId: string;
  assignmentTitle: string;
}): DraftCommunicationMessage => ({
  category: "assignment-published",
  recipientName: input.studentName,
  recipientEmail: input.studentEmail,
  recipientId: input.studentId,
  subject: "Assignment published",
  body: `${input.assignmentTitle} is now available in GradeAI.`,
  relatedAssignmentId: input.assignmentId,
  relatedStudentId: input.studentId,
});

type WorkflowEmailCategory = "assignment-published" | "submission-received" | "grade-released";

export const WorkflowEmailRequestSchema = z.discriminatedUnion("category", [
  z.object({
    category: z.literal("assignment-published"),
    assignmentId: z.string().uuid(),
  }),
  z.object({
    category: z.literal("submission-received"),
    assignmentId: z.string().uuid(),
    submissionId: z.string().uuid(),
  }),
  z.object({
    category: z.literal("grade-released"),
    assignmentId: z.string().uuid(),
    submissionId: z.string().uuid(),
  }),
]);

export type WorkflowEmailRequest = z.infer<typeof WorkflowEmailRequestSchema>;

export const sendWorkflowNotificationEmail = async (request: WorkflowEmailRequest) => {
  const parsed = WorkflowEmailRequestSchema.safeParse(request);

  if (!parsed.success) {
    log.warn("Workflow notification email request was invalid", {
      category: typeof request === "object" && request ? ("category" in request ? request.category : null) : null,
      assignmentId:
        typeof request === "object" && request && "assignmentId" in request && typeof request.assignmentId === "string"
          ? request.assignmentId
          : null,
      hasSubmissionId:
        typeof request === "object" && request && "submissionId" in request && typeof request.submissionId === "string",
    });
    return false;
  }

  const { error } = await supabase.functions.invoke("send-workflow-notification-email", {
    body: parsed.data,
  });

  if (error) {
    log.warn("Workflow notification email did not send", {
      category: request.category as WorkflowEmailCategory,
      assignmentId: request.assignmentId,
      submissionId: "submissionId" in request ? request.submissionId : null,
    });
    return false;
  }

  return true;
};

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
        ((clearedOnlyResult.data || []) as CommunicationMessageClearedOnlyRow[]).map(
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
        ((readOnlyResult.data || []) as CommunicationMessageReadOnlyRow[]).map(
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
      ((legacyResult.data || []) as CommunicationMessageLegacyRow[]).map(
        normalizeLegacyMessage,
      ),
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
