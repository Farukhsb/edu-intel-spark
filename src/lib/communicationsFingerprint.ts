import type { DraftCommunicationMessage } from "@/lib/communicationsHelpers";

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
