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

export type DraftCommunicationMessage = Omit<CommunicationMessage, "id" | "createdAt" | "cleared" | "read">;

export interface CommunicationDispatchResult {
  ok: boolean;
  status: "created" | "duplicate" | "failed" | "unauthenticated";
  message: CommunicationMessage | null;
}

export interface CommunicationMessageRow {
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

export type CommunicationMessageLegacyRow = Omit<CommunicationMessageRow, "read" | "cleared">;
export type CommunicationMessageClearedOnlyRow = Omit<CommunicationMessageRow, "read">;
export type CommunicationMessageReadOnlyRow = Omit<CommunicationMessageRow, "cleared">;

export type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export const CommunicationCategorySchema = z.enum([
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

export const CommunicationMessageRowSchema = z.object({
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

export const CommunicationMessageLegacyRowSchema = CommunicationMessageRowSchema.omit({
  cleared: true,
  read: true,
});

export const CommunicationMessageClearedOnlyRowSchema = CommunicationMessageRowSchema.omit({
  read: true,
});

export const CommunicationMessageReadOnlyRowSchema = CommunicationMessageRowSchema.omit({
  cleared: true,
});

export const WorkflowEmailResponseSchema = z.object({
  success: z.boolean().optional(),
  skipped: z.boolean().optional(),
  reason: z.string().optional(),
  sentCount: z.number().optional(),
});

export const COMMUNICATION_MESSAGE_SELECT =
  "id, created_at, cleared, read, category, recipient_name, recipient_email, recipient_id, subject, body, related_student_id, related_assignment_id";

export const COMMUNICATION_MESSAGE_CLEARED_ONLY_SELECT =
  "id, created_at, cleared, category, recipient_name, recipient_email, recipient_id, subject, body, related_student_id, related_assignment_id";

export const COMMUNICATION_MESSAGE_READ_ONLY_SELECT =
  "id, created_at, read, category, recipient_name, recipient_email, recipient_id, subject, body, related_student_id, related_assignment_id";

export const LEGACY_COMMUNICATION_MESSAGE_SELECT =
  "id, created_at, category, recipient_name, recipient_email, recipient_id, subject, body, related_student_id, related_assignment_id";

export const toSafeSupabaseErrorContext = (error: SupabaseLikeError | null | undefined) => ({
  errorCode: error?.code ?? null,
  errorMessage: error?.message ?? null,
  errorDetails: error?.details ?? null,
  errorHint: error?.hint ?? null,
});

export const getNotificationStateColumnAvailability = (error: SupabaseLikeError | null | undefined) => {
  const text = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    missingRead: error?.code === "42703" && text.includes("read"),
    missingCleared: error?.code === "42703" && text.includes("cleared"),
  };
};

export const isMissingNotificationStateColumnError = (error: SupabaseLikeError | null | undefined) => {
  const { missingRead, missingCleared } = getNotificationStateColumnAvailability(error);
  return missingRead || missingCleared;
};

export const normalizeMessage = (message: CommunicationMessageRow): CommunicationMessage => ({
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

export const normalizeLegacyMessage = (
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

export const normalizeClearedOnlyMessage = (
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

export const normalizeReadOnlyMessage = (
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

export const parseCommunicationMessageRows = <TRow>(rows: unknown, schema: z.ZodType<TRow>) => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.flatMap((row) => {
    const parsed = schema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
};
