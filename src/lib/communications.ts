import { supabase } from "@/integrations/supabase/client";
import { getE2EAuthenticatedUserId } from "@/lib/e2eAuth";
import { log } from "@/lib/logger";
import { z } from "zod";

export type CommunicationCategory =
  | "feedback-summary"
  | "at-risk-alert"
  | "grade-released"
  | "intervention-follow-up"
  | "intervention-overdue-reminder"
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

export interface CommunicationDispatchResult {
  ok: boolean;
  status: "created" | "duplicate" | "failed" | "unauthenticated";
  message: CommunicationMessage | null;
}

const normalizeMessageToken = (value: string | null | undefined) =>
  value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

export const buildCommunicationMessageFingerprint = (
  message: Pick<
    DraftCommunicationMessage,
    | "category"
    | "recipientName"
    | "recipientEmail"
    | "recipientId"
    | "subject"
    | "body"
    | "relatedStudentId"
    | "relatedAssignmentId"
  >,
) =>
  [
    message.category,
    normalizeMessageToken(message.recipientName),
    normalizeMessageToken(message.recipientEmail),
    normalizeMessageToken(message.recipientId),
    normalizeMessageToken(message.subject),
    normalizeMessageToken(message.body),
    normalizeMessageToken(message.relatedStudentId),
    normalizeMessageToken(message.relatedAssignmentId),
  ].join("|");

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

const CommunicationCategorySchema = z.enum([
  "feedback-summary",
  "at-risk-alert",
  "grade-released",
  "intervention-follow-up",
  "intervention-overdue-reminder",
  "submission-received",
  "ai-grading-ready",
  "integrity-check-ready",
  "assignment-published",
]);

const CommunicationMessageRowSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  cleared: z.boolean().nullable(),
  read: z.boolean().nullable(),
  category: CommunicationCategorySchema,
  recipient_name: z.string(),
  recipient_email: z.string().nullable(),
  recipient_id: z.string().nullable(),
  subject: z.string(),
  body: z.string(),
  related_student_id: z.string().nullable(),
  related_assignment_id: z.string().nullable(),
});

const CommunicationMessageLegacyRowSchema = CommunicationMessageRowSchema.omit({
  cleared: true,
  read: true,
});

const CommunicationMessageClearedOnlyRowSchema = CommunicationMessageRowSchema.omit({
  read: true,
});

const CommunicationMessageReadOnlyRowSchema = CommunicationMessageRowSchema.omit({
  cleared: true,
});

const WorkflowEmailResponseSchema = z.object({
  success: z.boolean().optional(),
  skipped: z.boolean().optional(),
  reason: z.string().optional(),
  sentCount: z.number().optional(),
});

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

const parseCommunicationMessageRows = <TRow>(
  rows: unknown,
  schema: z.ZodType<TRow>,
) => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.flatMap((row) => {
    const parsed = schema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
};

const findExistingCommunicationMessage = async (
  message: DraftCommunicationMessage,
) => {
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
        data: parseCommunicationMessageRows(
          fallbackResult.data,
          CommunicationMessageClearedOnlyRowSchema,
        ),
        error: fallbackResult.error,
        mode: "cleared-only" as const,
      };
    }

    if (missingCleared && !missingRead) {
      const fallbackResult = await fetchWithSelect(COMMUNICATION_MESSAGE_READ_ONLY_SELECT);
      return {
        data: parseCommunicationMessageRows(
          fallbackResult.data,
          CommunicationMessageReadOnlyRowSchema,
        ),
        error: fallbackResult.error,
        mode: "read-only" as const,
      };
    }

    const fallbackResult = await fetchWithSelect(LEGACY_COMMUNICATION_MESSAGE_SELECT);
    return {
      data: parseCommunicationMessageRows(
        fallbackResult.data,
        CommunicationMessageLegacyRowSchema,
      ),
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

export const dispatchCommunicationMessage = async (
  message: DraftCommunicationMessage,
): Promise<CommunicationDispatchResult> => {
  const e2eUserId = getE2EAuthenticatedUserId();
  const userId =
    e2eUserId ??
    (
      await supabase.auth.getUser()
    ).data.user?.id ??
    null;

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
    const normalizedExistingMessages =
      existingResult.mode === "full"
        ? (existingResult.data as CommunicationMessageRow[]).map((item) => normalizeMessage(item))
        : existingResult.mode === "cleared-only"
          ? (existingResult.data as CommunicationMessageClearedOnlyRow[]).map((item) =>
              normalizeClearedOnlyMessage(item),
            )
          : existingResult.mode === "read-only"
            ? (existingResult.data as CommunicationMessageReadOnlyRow[]).map((item) =>
                normalizeReadOnlyMessage(item),
              )
            : (existingResult.data as CommunicationMessageLegacyRow[]).map((item) => normalizeLegacyMessage(item));

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
      const normalizedMessage = normalizeLegacyMessage(parsedLegacyMessage.data);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("gradeai:communications-updated"));
      }

      return {
        ok: true,
        status: "created",
        message: normalizedMessage,
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

  const normalizedMessage = normalizeMessage(parsedInsertedMessage.data);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gradeai:communications-updated"));
  }

  return {
    ok: true,
    status: "created",
    message: normalizedMessage,
  };
};

export const queueCommunicationMessage = async (
  message: DraftCommunicationMessage
) => {
  const result = await dispatchCommunicationMessage(message);
  return result.message;
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

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gradeai:communications-updated"));
  }

  const parsedRow = CommunicationMessageRowSchema.safeParse(data);
  return parsedRow.success ? normalizeMessage(parsedRow.data) : null;
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

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gradeai:communications-updated"));
  }

  const parsedRow = CommunicationMessageRowSchema.safeParse(data);
  return parsedRow.success ? normalizeMessage(parsedRow.data) : null;
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
  body: `Your released result for ${input.assignmentTitle} is now available`,
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

export interface WorkflowEmailDispatchResult {
  ok: boolean;
  status: "sent" | "duplicate" | "failed" | "invalid";
  reason?: string | null;
}

type FunctionErrorLike = {
  message?: string;
  context?: {
    clone?: () => {
      text: () => Promise<string>;
    };
  };
};

const readFunctionErrorResponse = async (error: FunctionErrorLike | null | undefined) => {
  const response = error?.context;
  if (!response?.clone) return null;

  try {
    const text = await response.clone().text();
    const normalized = text.replace(/\s+/g, " ").trim();
    return normalized.slice(0, 500) || null;
  } catch {
    return null;
  }
};

export const dispatchWorkflowNotificationEmail = async (
  request: WorkflowEmailRequest,
): Promise<WorkflowEmailDispatchResult> => {
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
    return { ok: false, status: "invalid", reason: "invalid_request" };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? null;
  const safeRequestContext = {
    category: request.category as WorkflowEmailCategory,
    assignmentId: request.assignmentId,
    submissionId: "submissionId" in request ? request.submissionId : null,
  };

  if (!accessToken) {
    log.warn("Workflow notification email could not be sent because the browser session is missing", {
      ...safeRequestContext,
    });
    return { ok: false, status: "failed", reason: "missing_session" };
  }

  log.info("Workflow notification email invoke started", safeRequestContext);

  const { data, error } = await supabase.functions.invoke("send-workflow-notification-email", {
    body: parsed.data,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    const functionResponse = await readFunctionErrorResponse(error as FunctionErrorLike);
    log.warn("Workflow notification email did not send", {
      ...safeRequestContext,
      errorMessage: error.message ?? null,
      functionResponse,
    });
    return { ok: false, status: "failed", reason: "invoke_failed" };
  }

  const parsedResponse = WorkflowEmailResponseSchema.safeParse(data);
  const duplicate = parsedResponse.success && parsedResponse.data.reason === "duplicate_notification";

  if (duplicate) {
    log.info("Workflow notification email invoke succeeded", {
      ...safeRequestContext,
      outcome: "duplicate",
      reason: "duplicate_notification",
    });
    return { ok: true, status: "duplicate", reason: "duplicate_notification" };
  }

  const reason = parsedResponse.success ? parsedResponse.data.reason ?? null : null;
  log.info("Workflow notification email invoke succeeded", {
    ...safeRequestContext,
    outcome: "sent",
    reason,
  });

  return { ok: true, status: "sent", reason };
};

export const sendWorkflowNotificationEmail = async (request: WorkflowEmailRequest) => {
  const result = await dispatchWorkflowNotificationEmail(request);
  return result.ok;
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
        parseCommunicationMessageRows(
          clearedOnlyResult.data,
          CommunicationMessageClearedOnlyRowSchema,
        ).map(
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
        parseCommunicationMessageRows(
          readOnlyResult.data,
          CommunicationMessageReadOnlyRowSchema,
        ).map(
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
      parseCommunicationMessageRows(
        legacyResult.data,
        CommunicationMessageLegacyRowSchema,
      ).map(
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
    parseCommunicationMessageRows(data, CommunicationMessageRowSchema).map(normalizeMessage),
    options
  ).slice(0, 6);
};
