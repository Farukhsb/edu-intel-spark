import { z } from "npm:zod";

export type ExplainGradeMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export interface ExplainGradeRequestPayload {
  submissionId: string;
  message: string;
  messages: ExplainGradeMessage[];
}

const ExplainGradeMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const ExplainGradeBodySchema = z.object({
  submissionId: z.string().uuid(),
  message: z.string().min(1).max(2000).optional(),
  messages: z.array(ExplainGradeMessageSchema).optional(),
});

export const isExplainGradeMessage = (value: unknown): value is ExplainGradeMessage =>
  ExplainGradeMessageSchema.safeParse(value).success;

export const parseExplainGradeRequestPayload = (body: unknown) => {
  const candidate = body && typeof body === "object" ? body : null;
  const rawMessages = Array.isArray((candidate as { messages?: unknown } | null)?.messages)
    ? ((candidate as { messages: unknown[] }).messages.filter(isExplainGradeMessage) as ExplainGradeMessage[])
    : [];
  const latestUserMessage = [...rawMessages].reverse().find((entry) => entry.role === "user");

  const parsed = ExplainGradeBodySchema.safeParse({
    submissionId:
      candidate &&
      "submissionId" in candidate &&
      typeof (candidate as { submissionId?: unknown }).submissionId === "string"
        ? (candidate as { submissionId: string }).submissionId
        : undefined,
    message:
      candidate &&
      "message" in candidate &&
      typeof (candidate as { message?: unknown }).message === "string"
        ? (candidate as { message: string }).message
        : latestUserMessage?.content,
    messages: rawMessages.length > 0 ? rawMessages : undefined,
  });

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error,
    };
  }

  return {
    success: true as const,
    data: {
      submissionId: parsed.data.submissionId,
      message: parsed.data.message ?? latestUserMessage?.content ?? "",
      messages:
        parsed.data.messages && parsed.data.messages.length > 0
          ? parsed.data.messages
          : ([{ role: "user", content: parsed.data.message ?? latestUserMessage?.content ?? "" }] satisfies ExplainGradeMessage[]),
    } satisfies ExplainGradeRequestPayload,
  };
};
