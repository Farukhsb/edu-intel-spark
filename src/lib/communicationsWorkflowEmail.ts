import { supabase } from "@/integrations/supabase/client";
import { log } from "@/lib/logger";
import { z } from "zod";
import { WorkflowEmailResponseSchema } from "@/lib/communicationsHelpers";

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
