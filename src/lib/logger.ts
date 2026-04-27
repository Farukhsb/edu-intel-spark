import { env } from "@/lib/env";
import { captureAppError } from "@/lib/sentry";

type SafeContext = Record<string, unknown> | undefined;

const isDevelopment = env.VITE_APP_ENV === "development";

const SENSITIVE_KEYS = new Set([
  "submission",
  "submissions",
  "grade",
  "grades",
  "feedback",
  "prompt",
  "prompts",
  "content",
  "documentText",
  "document_text",
  "extractedText",
  "extracted_text",
  "env",
  "environment",
  "token",
  "key",
  "secret",
]);

const sanitizeContext = (context?: SafeContext): SafeContext => {
  if (!context) return undefined;

  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      SENSITIVE_KEYS.has(key) ? "[REDACTED]" : value,
    ]),
  );
};

const writeConsole = (
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context?: SafeContext,
  error?: unknown,
) => {
  if (!isDevelopment) return;

  const safeContext = sanitizeContext(context);
  if (level === "error") {
    console.error(message, error, safeContext);
    return;
  }

  if (level === "warn") {
    console.warn(message, safeContext);
    return;
  }

  if (level === "info") {
    console.info(message, safeContext);
    return;
  }

  console.debug(message, safeContext);
};

export const log = {
  debug(message: string, context?: SafeContext) {
    writeConsole("debug", message, context);
  },
  info(message: string, context?: SafeContext) {
    writeConsole("info", message, context);
  },
  warn(message: string, context?: SafeContext) {
    writeConsole("warn", message, context);
  },
  error(message: string, error?: unknown, context?: SafeContext) {
    const safeContext = sanitizeContext(context);
    captureAppError(error ?? new Error(message), {
      message,
      ...safeContext,
    });
    writeConsole("error", message, safeContext, error);
  },
};

export const loggerInternals = {
  sanitizeContext,
};
